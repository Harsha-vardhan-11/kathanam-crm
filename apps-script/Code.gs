/**
 * Kathanam's CRM — free backend that runs inside your own Google account.
 *
 *  • Stores all CRM data as one file in your Google Drive (folder "Kathanam CRM"),
 *    with a daily backup copy next to it.
 *  • Copies every event into your Google Calendar automatically.
 *  • Google Apps Script is free. There's no Cloud console, no API key and no billing.
 *
 * One-time setup (see README → "Put it online"):
 *   1. script.google.com → New project → paste this file → Save.
 *   2. Choose the function "setup" at the top → Run → allow access.
 *      Copy the secret key from the log.
 *   3. Deploy → New deployment → Web app → Execute as: Me · Who has access: Anyone → Deploy.
 *      Copy the Web app URL.
 *   4. Open the CRM, then paste the URL and the secret key.
 */

const FOLDER_NAME = 'Kathanam CRM';
const DATA_FILE_NAME = 'Kathanam CRM - data.json';
const BACKUPS_TO_KEEP = 30;
const TZ = 'Asia/Kolkata';
const EMPTY = { projects: [], events: [], team: [], equipment: [], transactions: [], settings: {} };

// ------------------------------------------------------------------ setup (run once by hand)
function setup() {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
    props.setProperty('KEY', key);
  }
  dataFile_();
  CalendarApp.getDefaultCalendar(); // asks for calendar permission now, not later
  Logger.log('YOUR SECRET KEY (keep it private):  ' + key);
  Logger.log('Next: Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone → Deploy.');
}

// To get a new key (e.g. if a phone is lost): run this, then enter the new key on your devices.
function resetKey() {
  PropertiesService.getScriptProperties().deleteProperty('KEY');
  setup();
}

// ------------------------------------------------------------------ web app
function doGet() {
  return out_({ status: 200, app: 'kathanam-crm' });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return out_({ status: 400, error: 'Bad request' });
  }
  const key = PropertiesService.getScriptProperties().getProperty('KEY');
  if (!key) return out_({ status: 500, error: 'Run setup() in the Apps Script editor first' });
  if (req.key !== key) return out_({ status: 401, error: 'Wrong secret key' });

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return out_({ status: 503, error: 'Busy — please try again' });
  try {
    if (req.action === 'get') {
      const cur = read_();
      return out_({ status: 200, rev: cur.rev, data: cur.data });
    }
    if (req.action === 'put') {
      const cur = read_();
      // Another device saved since this one loaded: refuse so nothing is silently overwritten.
      if (Number(req.rev) !== cur.rev) return out_({ status: 409, rev: cur.rev });
      const next = { rev: cur.rev + 1, savedAt: new Date().toISOString(), data: req.data };
      write_(next);
      return out_({ status: 200, rev: next.rev, calendar: safeSync_(req.data) });
    }
    if (req.action === 'sync') {
      return out_({ status: 200, calendar: safeSync_(read_().data) });
    }
    return out_({ status: 400, error: 'Unknown action' });
  } finally {
    lock.releaseLock();
  }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------------ storage (Google Drive)
function folder_() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

function dataFile_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FILE_ID');
  if (id) {
    try {
      const f = DriveApp.getFileById(id);
      if (!f.isTrashed()) return f;
    } catch (err) { /* deleted: make a new one below */ }
  }
  const f = folder_().createFile(DATA_FILE_NAME, JSON.stringify({ rev: 0, data: EMPTY }), MimeType.PLAIN_TEXT);
  props.setProperty('FILE_ID', f.getId());
  return f;
}

function read_() {
  const obj = JSON.parse(dataFile_().getBlob().getDataAsString('UTF-8') || '{}');
  return { rev: Number(obj.rev) || 0, data: obj.data || EMPTY };
}

function write_(obj) {
  const f = dataFile_();
  const props = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  if (props.getProperty('LAST_BACKUP') !== today) {
    f.makeCopy('backup ' + today + ' - ' + DATA_FILE_NAME, folder_());
    props.setProperty('LAST_BACKUP', today);
    pruneBackups_();
  }
  f.setContent(JSON.stringify(obj));
}

function pruneBackups_() {
  const backups = [];
  const it = folder_().getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (f.getName().indexOf('backup ') === 0) backups.push(f);
  }
  backups.sort((a, b) => b.getName().localeCompare(a.getName()));
  backups.slice(BACKUPS_TO_KEEP).forEach(f => f.setTrashed(true));
}

// ------------------------------------------------------------------ Google Calendar sync
function safeSync_(db) {
  try {
    return syncCalendar_(db);
  } catch (err) {
    return { error: String(err && err.message || err) };
  }
}

// Only events whose details changed are touched, so a normal save is quick.
function syncCalendar_(db) {
  const cal = CalendarApp.getDefaultCalendar();
  const props = PropertiesService.getScriptProperties();
  const known = props.getProperties();
  const counts = { created: 0, updated: 0, deleted: 0 };
  const events = {};
  (db.events || []).forEach(e => { if (e.id && e.date) events[e.id] = e; });

  Object.keys(events).forEach(id => {
    const body = toCal_(events[id], db);
    const h = hash_(body);
    const prev = known['ev_' + id] ? JSON.parse(known['ev_' + id]) : null;
    if (prev && prev.h === h) return;
    let gev = prev ? cal.getEventById(prev.g) : null;
    if (gev) {
      apply_(gev, body);
      counts.updated++;
    } else {
      gev = create_(cal, body); // new, or deleted from Google by hand
      counts.created++;
    }
    props.setProperty('ev_' + id, JSON.stringify({ g: gev.getId(), h: h }));
  });

  Object.keys(known).filter(k => k.indexOf('ev_') === 0 && !events[k.slice(3)]).forEach(k => {
    try {
      const gev = cal.getEventById(JSON.parse(known[k]).g);
      if (gev) gev.deleteEvent();
    } catch (err) { /* already gone */ }
    props.deleteProperty(k);
    counts.deleted++;
  });
  return counts;
}

function toCal_(ev, db) {
  const find = (list, id) => (db[list] || []).find(x => x.id === id);
  const p = find('projects', ev.projectId) || {};
  const crew = (ev.crew || []).map(id => (find('team', id) || {}).name).filter(Boolean);
  const gear = (ev.equipment || []).map(id => (find('equipment', id) || {}).name).filter(Boolean);
  const lines = [];
  if (p.name) lines.push('Project: ' + p.name);
  if (p.clientName) lines.push('Client: ' + p.clientName + (p.clientPhone ? ' (' + p.clientPhone + ')' : ''));
  if (crew.length) lines.push('Crew: ' + crew.join(', '));
  if (gear.length) lines.push('Equipment: ' + gear.join(', '));
  if (ev.notes) lines.push('Notes: ' + ev.notes);
  lines.push('— Kathanam CRM');
  let end = ev.end;
  if (ev.start && (!end || end <= ev.start)) end = ('0' + Math.min(Number(ev.start.slice(0, 2)) + 4, 23)).slice(-2) + ev.start.slice(2);
  return {
    title: (ev.title || 'Event') + (p.name ? ' — ' + p.name : ''),
    location: ev.location || '',
    description: lines.join('\n'),
    allDay: !ev.start,
    date: ev.date,
    start: ev.start || '',
    end: ev.start ? end : '',
  };
}

function create_(cal, b) {
  const opts = { location: b.location, description: b.description };
  if (b.allDay) return cal.createAllDayEvent(b.title, at_(b.date), opts);
  return cal.createEvent(b.title, at_(b.date, b.start), at_(b.date, b.end), opts);
}

function apply_(gev, b) {
  gev.setTitle(b.title);
  gev.setLocation(b.location);
  gev.setDescription(b.description);
  if (b.allDay) gev.setAllDayDate(at_(b.date));
  else gev.setTime(at_(b.date, b.start), at_(b.date, b.end));
}

function at_(date, time) {
  return Utilities.parseDate(date + ' ' + (time || '00:00'), TZ, 'yyyy-MM-dd HH:mm');
}

function hash_(obj) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(obj)));
}
