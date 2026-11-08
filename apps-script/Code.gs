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
 *
 * Assistant (optional, free): get a Gemini API key at aistudio.google.com → Get API key
 * (no card needed), then in Apps Script: Project Settings → Script Properties →
 * Add property  GEMINI_KEY = <your key>.
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

  // The assistant only reads what the app sends and proposes changes; it never saves anything itself.
  if (req.action === 'agent') return out_(agent_(req.messages || [], req.context || {}));

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
  if ((ev.services || []).length) lines.push('Coverage: ' + ev.services.join(', '));
  if (ev.servicesNote) lines.push('Coverage notes: ' + ev.servicesNote);
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

// ------------------------------------------------------------------ Assistant (Google Gemini, free tier)
const SERVICES = ['Traditional Photography', 'Traditional Videography', 'Candid Photography', 'Candid Videography', 'Drone', 'Live Streaming', 'LED Screens'];
const ACTION_TYPES = ['create_project', 'update_project', 'add_event', 'update_event', 'add_payment', 'add_team_member', 'add_equipment', 'add_deliverable'];

function agentPrompt_(ctx) {
  return [
    "You are the booking assistant inside the CRM of Kathanam, a wedding photography and films company in India (a Golden Media company).",
    "Turn the user's messages into CRM actions. The app shows your actions to the user as a checklist; nothing is saved until they confirm.",
    "Today is " + (ctx.today || '') + " (Asia/Kolkata).",
    "",
    "RULES",
    "- Dates are YYYY-MM-DD. If no year is given, use the next upcoming occurrence. Times are 24-hour HH:MM (\"7pm\" = 19:00, \"morning\" = leave empty and mention it in notes).",
    "- Amounts are plain rupee numbers: 1L / 1 lakh = 100000, 50k = 50000, 3.5L = 350000.",
    "- If the user refers to an existing project (by client or project name), use its id as projectRef. For a new client, add create_project with key \"new1\" (\"new2\" for a second one) and use that key as projectRef in the other actions.",
    "- Name new projects like \"Ravi & Priya Wedding\" (or \"<Client> <Occasion>\"). New projects get status \"Booked\" if the user says it's confirmed/fixed/advance paid, otherwise \"Enquiry\".",
    "- Each function (Haldi, Mehendi, Sangeet, Pelli Kuthuru, Pelli Koduku, Muhurtham / Wedding, Reception, Engagement, Pre-wedding Shoot, Vratham…) is a separate add_event.",
    "- Coverage goes in services, using only these exact names: " + SERVICES.join(', ') + ". \"candid\" alone means Candid Photography and Candid Videography only if both are clear; \"video\" means Traditional Videography. Anything else (screen sizes, number of cameras, live link, special requests) goes in servicesNote.",
    "- crew and equipment: only names the user actually gives. Never invent people, phone numbers, amounts, dates or venues.",
    "- Money: money received from a client = add_payment payType \"in\". Paying a team member/vendor = \"payout\" (status \"pending\" if not yet paid). Costs like travel, hotel, food = \"expense\" with a category from: Transport, Accommodation, Food, Equipment Rental, Vendor, Printing / Album, Software, Misc.",
    "- To change an existing event, use update_event with eventId and only the fields that change.",
    "- Never delete anything.",
    "- If something essential is missing (client name for a new booking, the date of an event), still propose what you can and ask in questions. Keep questions short; at most 3.",
    "- reply: 1–2 short, friendly sentences saying what you prepared. If the message isn't about the CRM, return no actions and answer briefly.",
    "- Always return the COMPLETE plan for the whole conversation so far, not only the latest message.",
    "",
    "CRM CONTEXT (JSON)",
    JSON.stringify(ctx),
  ].join('\n');
}

function agentSchema_() {
  const S = { type: 'STRING' };
  const N = { type: 'NUMBER' };
  const A = { type: 'ARRAY', items: S };
  return {
    type: 'OBJECT',
    properties: {
      reply: S,
      questions: A,
      actions: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            type: { type: 'STRING', enum: ACTION_TYPES },
            key: S, projectRef: S, eventId: S,
            name: S, clientName: S, clientPhone: S, clientEmail: S, clientAddress: S, package: S, quotation: N, status: S, notes: S,
            title: S, date: S, start: S, end: S, location: S,
            services: { type: 'ARRAY', items: { type: 'STRING', enum: SERVICES } }, servicesNote: S, crew: A, equipment: A,
            payType: { type: 'STRING', enum: ['in', 'payout', 'expense'] }, amount: N, mode: S, category: S, payee: S, payStatus: S, note: S,
            role: S, phone: S, rate: N, due: S,
          },
          required: ['type'],
        },
      },
    },
    required: ['reply', 'actions'],
  };
}

function agent_(messages, ctx) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('GEMINI_KEY');
  if (!apiKey) return { status: 200, error: 'NO_KEY' };

  const contents = messages.slice(-12).map(m => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: String(m.text || '').slice(0, 8000) }] }));
  if (!contents.length) return { status: 400, error: 'Empty message' };
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: agentPrompt_(ctx) }] },
    contents: contents,
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseSchema: agentSchema_() },
  });

  // A model name Google retires returns 404, so fall back to the next one.
  const models = [props.getProperty('GEMINI_MODEL'), 'gemini-flash-latest', 'gemini-2.5-flash'].filter(Boolean);
  let last = '';
  for (let i = 0; i < models.length; i++) {
    const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + models[i] + ':generateContent', {
      method: 'post', contentType: 'application/json', payload: payload,
      headers: { 'x-goog-api-key': apiKey }, muteHttpExceptions: true,
    });
    const code = res.getResponseCode();
    const text = res.getContentText();
    if (code === 404) { last = models[i] + ' not found'; continue; }
    if (code === 429) return { status: 200, error: "The free assistant limit is used up for now. Try again in a minute (or tomorrow), or add it by hand." };
    if (code === 400 && text.indexOf('API key') >= 0) return { status: 200, error: 'Google did not accept the GEMINI_KEY. Check it in Apps Script → Project Settings → Script Properties.' };
    if (code !== 200) return { status: 200, error: 'Assistant error ' + code + ': ' + text.slice(0, 200) };
    try {
      const body = JSON.parse(text);
      const part = body.candidates[0].content.parts.map(p => p.text || '').join('');
      return { status: 200, plan: JSON.parse(part), model: models[i] };
    } catch (err) {
      return { status: 200, error: "The assistant's answer couldn't be read. Please try rephrasing." };
    }
  }
  return { status: 200, error: 'No assistant model available (' + last + ').' };
}
