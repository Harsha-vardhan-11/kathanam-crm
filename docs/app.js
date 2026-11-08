'use strict';
/* Kathanam's CRM Platform — single-page app. Data lives on the local server (data/db.json). */

// ---------------------------------------------------------------- helpers
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const num = v => +v || 0;
const sum = (arr, f) => arr.reduce((a, x) => a + num(f(x)), 0);
const money = n => (n < 0 ? '−₹' : '₹') + Math.abs(Math.round(num(n))).toLocaleString('en-IN');
const isoLocal = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const today = () => isoLocal(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T00:00'); d.setDate(d.getDate() + n); return isoLocal(d); };
const fmtDate = s => s ? new Date(s + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtShort = s => s ? new Date(s + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
const fmtTime = t => t ? new Date('1970-01-01T' + t).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '';
const byDate = (a, b) => (a.date || '').localeCompare(b.date || '') || (a.start || '').localeCompare(b.start || '');
const opts = arr => arr.map(x => [x, x]);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

// ---------------------------------------------------------------- constants
const STAGES = [
  ['Client & Agreement', 'Quotation, signed contract, client details'],
  ['Payments & Invoices', 'Advance, receipts, payment tracker'],
  ['Event Schedule', 'Dates, locations, crew allocation'],
  ['Team & Vendors', 'Crew details, vendor costs, assignments'],
  ['Travel & Logistics', 'Transport, accommodation, food'],
  ['Production', 'Shot lists, daily checklists, permissions'],
  ['Raw Footage', 'Organised event-wise camera backups'],
  ['Post Production', 'Editing, reels, films, album design'],
  ['Final Deliverables', 'Client-approved and delivered files'],
];
const STAGE_LABEL = { todo: 'To do', doing: 'In progress', done: 'Done' };
const PROJECT_STATUS = ['Enquiry', 'Quoted', 'Booked', 'Shooting', 'Post Production', 'Delivered', 'Cancelled'];
const ROLES = ['Lead Photographer', 'Photographer', 'Candid Photographer', 'Cinematographer', 'Drone Operator', 'Assistant', 'Editor', 'Album Designer', 'Vendor', 'Other'];
const EQUIP_CATS = ['Camera', 'Lens', 'Drone', 'Lighting', 'Audio', 'Gimbal / Rig', 'Storage / Cards', 'Other'];
const EXP_CATS = ['Transport', 'Accommodation', 'Food', 'Equipment Rental', 'Vendor', 'Printing / Album', 'Software', 'Misc'];
const PAY_MODES = ['UPI', 'Cash', 'Bank Transfer', 'Cheque', 'Card'];
const DELIV_STATUS = ['Not started', 'Editing', 'Client review', 'Revisions', 'Approved', 'Delivered'];
const CHECK_GROUPS = ['Shot list', 'Daily checklist', 'Permissions'];
const EVENT_NAMES = ['Engagement', 'Pre-wedding Shoot', 'Haldi', 'Mehendi', 'Sangeet', 'Pelli Kuthuru', 'Pelli Koduku', 'Muhurtham / Wedding', 'Reception', 'Vratham'];
const DELIV_TEMPLATE = ['Wedding Film (full)', 'Highlight / Teaser', 'Instagram Reels', 'Edited Photos', 'Wedding Album Design', 'Printed Album', 'Raw Footage Copy'];
const CHECK_TEMPLATE = [
  ['Shot list', 'Bride & groom portraits'], ['Shot list', 'Family group photos'], ['Shot list', 'Rituals — key moments'],
  ['Shot list', 'Décor & venue details'], ['Shot list', 'Drone aerials'],
  ['Daily checklist', 'Batteries charged'], ['Daily checklist', 'Memory cards formatted'], ['Daily checklist', 'Lenses cleaned'],
  ['Daily checklist', 'Backup drive packed'], ['Daily checklist', 'Crew call time confirmed'],
  ['Permissions', 'Venue photography permission'], ['Permissions', 'Drone permission'], ['Permissions', 'Temple / hall rules checked'],
];
const DEFAULT_TERMS = `1. Booking is confirmed on receipt of the advance amount and the signed agreement.
2. The advance is non-refundable.
3. Balance payment is due on or before the final event day, unless agreed otherwise.
4. Travel, accommodation and food for the crew outside the city are borne by the client.
5. Edited photos are delivered within 30 days; the wedding film within 60–90 days of the last event.
6. Two rounds of revisions are included for the film and the album design.
7. Raw footage is provided only if included in the package, on a client-supplied drive.
8. Kathanam may use selected photos and clips for its portfolio and social media unless the client opts out in writing.
9. Kathanam is not responsible for coverage lost to venue restrictions, power or weather beyond its control.`;

const ICONS = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  projects: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  team: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2c3 .3 5.5 2.5 5.5 5.8"/>',
  gear: '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.6"/><path d="M8 7l1.5-3h5L16 7"/>',
  money: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
};
const icon = n => `<svg viewBox="0 0 24 24">${ICONS[n]}</svg>`;
const NAV = [['dashboard', 'Dashboard', 'home'], ['projects', 'Projects', 'projects'], ['calendar', 'Calendar', 'calendar'],
  ['team', 'Team', 'team'], ['equipment', 'Equipment', 'gear'], ['money', 'Money', 'money'], ['settings', 'Settings', 'settings']];

// ---------------------------------------------------------------- data & sync
let DB = null;
let REV = 0;
let saveQueue = Promise.resolve();
const ui = { q: '', status: '', calMonth: today().slice(0, 7), calDay: null, showPast: false, moneyType: '', moneyProject: '' };

function normalize(d) {
  d = d || {};
  for (const k of ['projects', 'events', 'team', 'equipment', 'transactions']) if (!Array.isArray(d[k])) d[k] = [];
  d.settings = d.settings || {};
  d.projects.forEach(p => { p.stages = p.stages || {}; p.deliverables = p.deliverables || []; p.checklist = p.checklist || []; });
  d.events.forEach(e => { e.crew = e.crew || []; e.equipment = e.equipment || []; });
  return d;
}

// Two ways to store data:
//   'cloud' — hosted (GitHub Pages) + your Google Apps Script: data in your Google Drive, calendar synced.
//   'local' — the optional laptop server (server.py), for offline use on your Wi-Fi.
let MODE = null; // 'cloud' | 'local' | 'setup'
const cloud = () => ({ url: store.get('kc_url') || '', key: store.get('kc_key') || '' });

async function cloudCall(body, conn = cloud()) {
  // text/plain keeps this a "simple" request, which Apps Script accepts from any website.
  const r = await fetch(conn.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, key: conn.key }) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function localCall(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-PIN': store.get('kc_pin') || '' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    const p = prompt('Enter your Kathanam CRM PIN');
    if (p === null) throw new Error('PIN required');
    store.set('kc_pin', p);
    return localCall(method, path, body);
  }
  return { status: res.status, ...(await res.json()) };
}

const backend = {
  get: () => MODE === 'cloud' ? cloudCall({ action: 'get' }) : localCall('GET', '/api/db'),
  put: (rev, data) => MODE === 'cloud' ? cloudCall({ action: 'put', rev, data }) : localCall('PUT', '/api/db', { rev, data }),
};

async function detectMode() {
  if (cloud().url && cloud().key) return 'cloud';
  try {
    const r = await fetch('api/info', { cache: 'no-store' });
    if (r.ok && (await r.json()).port) return 'local';
  } catch { /* not the laptop server */ }
  return 'setup';
}

async function load() {
  if (!MODE) MODE = await detectMode();
  if (MODE === 'setup') return renderSetup();
  try {
    const j = await backend.get();
    if (j.status === 401 && MODE === 'cloud') {
      store.set('kc_key', '');
      MODE = 'setup';
      return renderSetup('That secret key was not accepted. Please enter it again.');
    }
    if (j.status !== 200) throw new Error(j.error);
    DB = normalize(j.data);
    REV = j.rev;
    render();
  } catch (err) {
    $('#main').innerHTML = MODE === 'cloud'
      ? `<div class="card"><h2>Can't reach your data</h2><p class="muted">Check your internet connection and try again.</p><p class="muted small">${esc(err.message || '')}</p><button class="btn gold" onclick="load()">Try again</button> <button class="btn" data-act="disconnect">Change connection</button></div>`
      : `<div class="card"><h2>Can't reach the CRM server</h2><p class="muted">Make sure <b>start.bat</b> (or <code>python server.py</code>) is running on your laptop, and that this device is on the same Wi-Fi.</p><button class="btn gold" onclick="load()">Try again</button></div>`;
  }
}

function commit(msg = 'Saved') {
  render();
  saveQueue = saveQueue.then(async () => {
    try {
      const r = await backend.put(REV, DB);
      if (r.status === 409) { toast('Changed on another device — loaded the latest. Please redo your last edit.', true); return load(); }
      if (r.status !== 200) throw new Error(r.error);
      REV = r.rev;
      const c = r.calendar;
      if (c?.error) toast('Saved, but Google Calendar had a problem: ' + c.error, true);
      else toast(msg + (c && c.created + c.updated + c.deleted ? ' · Google Calendar updated' : ''));
    } catch { toast(MODE === 'cloud' ? 'Could not save — check your internet connection' : 'Could not save — is the server running?', true); }
  });
}

async function syncCalendarNow() {
  try {
    const c = (await cloudCall({ action: 'sync' })).calendar || {};
    toast(c.error ? 'Google Calendar: ' + c.error : `Google Calendar is up to date (${c.created} added, ${c.updated} updated, ${c.deleted} removed)`, !!c.error);
  } catch { toast('Could not reach Google — check your internet connection', true); }
}

// First screen on a new device: connect to the Google Apps Script backend.
function renderSetup(error = '') {
  $('#sideNav').innerHTML = '';
  $('#bottomNav').innerHTML = '';
  $('#main').innerHTML = `
  <div class="setup">
    <div class="logo-crop setup-logo"><img src="logo.png" alt="Kathanam"></div>
    <section class="card">
      <h2>Connect your CRM</h2>
      <p class="muted">Enter the two things from your Google Apps Script setup. You only do this once on each device.</p>
      ${error ? `<p class="alert">⚠ ${esc(error)}</p>` : ''}
      <form id="setupForm" class="form-grid" style="grid-template-columns:1fr">
        <div class="fld"><label for="s_url">Web app URL</label><input id="s_url" name="url" type="url" required placeholder="https://script.google.com/macros/s/…/exec" value="${esc(cloud().url)}"></div>
        <div class="fld"><label for="s_key">Secret key</label><input id="s_key" name="key" type="password" required autocomplete="current-password" placeholder="From the Apps Script log"></div>
        <div><button class="btn gold" type="submit">Connect</button></div>
      </form>
      <p class="muted small" style="margin-top:16px">Don't have these yet? Follow “Put it online” in the README. It takes about 5 minutes, and it's free.</p>
    </section>
  </div>`;
  $('#setupForm').onsubmit = async ev => {
    ev.preventDefault();
    // Accept the whole Apps Script log line too ("YOUR SECRET KEY (keep it private):  abc…"): keep just the key.
    const rawKey = ev.target.key.value.trim();
    const conn = { url: ev.target.url.value.trim(), key: (rawKey.match(/[0-9a-f]{40,}/i) || [rawKey])[0] };
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(conn.url)) return toast('That should be a script.google.com link ending in /exec', true);
    const btn = $('button[type=submit]', ev.target);
    btn.disabled = true;
    btn.textContent = 'Connecting…';
    try {
      const j = await cloudCall({ action: 'get' }, conn);
      if (j.status === 401) throw new Error('key');
      if (j.status !== 200) throw new Error(j.error || 'failed');
      store.set('kc_url', conn.url);
      store.set('kc_key', conn.key);
      MODE = 'cloud';
      toast('Connected');
      load();
    } catch (err) {
      renderSetup(err.message === 'key' ? 'That secret key was not accepted.' : 'Could not connect. Check the URL, and that the deployment has access set to “Anyone”.');
    }
  };
}

// Pick up edits made on another device when coming back to this one.
document.addEventListener('visibilitychange', () => { if (!document.hidden && DB && $('#modal').hidden) load(); });

// ---------------------------------------------------------------- lookups & money maths
const project = id => DB.projects.find(p => p.id === id);
const member = id => DB.team.find(m => m.id === id);
const gear = id => DB.equipment.find(g => g.id === id);
const projName = id => project(id)?.name || '—';
const txOf = (pid, type) => DB.transactions.filter(t => t.projectId === pid && (!type || t.type === type));

function projectFin(p) {
  const received = sum(txOf(p.id, 'in'), t => t.amount);
  const payouts = txOf(p.id, 'payout');
  const paidOut = sum(payouts.filter(t => t.status !== 'pending'), t => t.amount);
  const payoutDue = sum(payouts.filter(t => t.status === 'pending'), t => t.amount);
  const expenses = sum(txOf(p.id, 'expense'), t => t.amount);
  const quote = num(p.quotation);
  return { quote, received, paidOut, payoutDue, expenses, balance: Math.max(quote - received, 0), profit: quote - paidOut - payoutDue - expenses };
}
function globalFin() {
  const tx = DB.transactions;
  return {
    received: sum(tx.filter(t => t.type === 'in'), t => t.amount),
    paidOut: sum(tx.filter(t => t.type === 'payout' && t.status !== 'pending'), t => t.amount),
    payoutDue: sum(tx.filter(t => t.type === 'payout' && t.status === 'pending'), t => t.amount),
    expenses: sum(tx.filter(t => t.type === 'expense'), t => t.amount),
    clientDue: sum(DB.projects.filter(p => p.status !== 'Cancelled'), p => projectFin(p).balance),
  };
}
const stagesDone = p => STAGES.filter((_, i) => p.stages[i + 1] === 'done').length;

// Crew or equipment booked on two events the same day.
function conflicts(ev) {
  const others = DB.events.filter(o => o.id !== ev.id && o.date === ev.date);
  const crew = ev.crew.filter(id => others.some(o => o.crew.includes(id))).map(id => member(id)?.name).filter(Boolean);
  const eq = ev.equipment.filter(id => others.some(o => o.equipment.includes(id))).map(id => gear(id)?.name).filter(Boolean);
  return [...crew, ...eq];
}

// ---------------------------------------------------------------- Google Calendar
const gcalStamp = (date, time) => date.replace(/-/g, '') + (time ? 'T' + time.replace(':', '') + '00' : '');
function eventDetails(e) {
  const p = project(e.projectId);
  return [
    p && `Project: ${p.name}`,
    p?.clientName && `Client: ${p.clientName}${p.clientPhone ? ' (' + p.clientPhone + ')' : ''}`,
    e.crew.length && `Crew: ${e.crew.map(id => member(id)?.name).filter(Boolean).join(', ')}`,
    e.equipment.length && `Equipment: ${e.equipment.map(id => gear(id)?.name).filter(Boolean).join(', ')}`,
    e.notes && `Notes: ${e.notes}`,
  ].filter(Boolean).join('\n');
}
function eventTitle(e) { const p = project(e.projectId); return `${e.title || 'Event'}${p ? ' — ' + p.name : ''}`; }
function gcalUrl(e) {
  let dates;
  if (e.start) {
    let end = e.end;
    if (!end || end <= e.start) { const h = Math.min(+e.start.slice(0, 2) + 4, 23); end = String(h).padStart(2, '0') + e.start.slice(2); }
    dates = gcalStamp(e.date, e.start) + '/' + gcalStamp(e.date, end);
  } else {
    dates = gcalStamp(e.date) + '/' + gcalStamp(addDays(e.date, 1));
  }
  const q = new URLSearchParams({ action: 'TEMPLATE', text: eventTitle(e), dates, details: eventDetails(e), location: e.location || '', ctz: 'Asia/Kolkata' });
  return 'https://calendar.google.com/calendar/render?' + q;
}
function downloadIcs(events, name = 'kathanam-events.ics') {
  const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kathanam//CRM//EN', 'CALSCALE:GREGORIAN', 'X-WR-TIMEZONE:Asia/Kolkata'];
  events.forEach(e => {
    L.push('BEGIN:VEVENT', `UID:${e.id}@kathanam-crm`, `DTSTAMP:${stamp}`);
    if (e.start) {
      const end = e.end && e.end > e.start ? e.end : String(Math.min(+e.start.slice(0, 2) + 4, 23)).padStart(2, '0') + e.start.slice(2);
      L.push(`DTSTART;TZID=Asia/Kolkata:${gcalStamp(e.date, e.start)}`, `DTEND;TZID=Asia/Kolkata:${gcalStamp(e.date, end)}`);
    } else {
      L.push(`DTSTART;VALUE=DATE:${gcalStamp(e.date)}`, `DTEND;VALUE=DATE:${gcalStamp(addDays(e.date, 1))}`);
    }
    L.push(`SUMMARY:${icsEsc(eventTitle(e))}`, `LOCATION:${icsEsc(e.location)}`, `DESCRIPTION:${icsEsc(eventDetails(e))}`, 'END:VEVENT');
  });
  L.push('END:VCALENDAR');
  download(new Blob([L.join('\r\n')], { type: 'text/calendar' }), name);
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// ---------------------------------------------------------------- UI bits
function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (err ? ' err' : '');
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), err ? 5000 : 1800);
}
const kpi = (lbl, val, sub = '', cls = '') => `<div class="kpi"><div class="lbl">${lbl}</div><div class="val ${cls}">${val}</div><div class="sub">${sub}</div></div>`;
const empty = msg => `<div class="empty">${msg}</div>`;
const statusBadge = s => `<span class="badge ${['Booked', 'Shooting', 'Post Production'].includes(s) ? 'gold' : s === 'Delivered' ? 'green' : s === 'Cancelled' ? 'red' : ''}">${esc(s || 'Enquiry')}</span>`;
const datebox = d => { const x = new Date(d + 'T00:00'); return `<div class="datebox"><div class="d">${x.getDate()}</div><div class="m">${x.toLocaleDateString('en-IN', { month: 'short' })}</div></div>`; };

function eventRow(e, { showProject = true } = {}) {
  const crew = e.crew.map(id => member(id)?.name).filter(Boolean);
  const warn = conflicts(e);
  const time = e.start ? fmtTime(e.start) + (e.end ? '–' + fmtTime(e.end) : '') : 'All day';
  return `<div class="row">
    ${datebox(e.date)}
    <div class="grow clickable" data-act="editEvent" data-id="${e.id}">
      <div class="title">${esc(e.title || 'Event')}${showProject ? ` <span class="muted small">· ${esc(projName(e.projectId))}</span>` : ''}</div>
      <div class="meta">${fmtDate(e.date)} · ${time}${e.location ? ' · ' + esc(e.location) : ''}</div>
      <div class="meta">${crew.length ? 'Crew: ' + esc(crew.join(', ')) : 'No crew assigned'}${e.equipment.length ? ` · ${e.equipment.length} equipment` : ''}${num(e.gb) ? ` · ${num(e.gb)} GB` : ''}</div>
      ${warn.length ? `<div class="alert">⚠ Double-booked that day: ${esc(warn.join(', '))}</div>` : ''}
    </div>
    <div class="right">${MODE === 'cloud'
      ? '<span class="badge green" title="Synced to Google Calendar automatically">✓ In Google Calendar</span>'
      : `<a class="btn sm" href="${gcalUrl(e)}" target="_blank" rel="noopener">+ Google Calendar</a>`}</div>
  </div>`;
}

function projectRow(p) {
  const f = projectFin(p);
  const next = DB.events.filter(e => e.projectId === p.id && e.date >= today()).sort(byDate)[0];
  const done = stagesDone(p);
  return `<div class="row clickable no-date" data-go="#/project/${p.id}/1">
    <div class="grow">
      <div class="title">${esc(p.name)} ${statusBadge(p.status)}</div>
      <div class="meta">${esc(p.clientName || 'No client yet')}${next ? ` · Next: ${esc(next.title)} on ${fmtShort(next.date)}` : ''}</div>
      <div class="bar"><i style="width:${(done / 9) * 100}%"></i></div>
      <div class="meta">${done}/9 stages done</div>
    </div>
    <div class="right" style="flex-direction:column;align-items:flex-end;gap:0">
      <span class="amt">${money(f.quote)}</span>
      ${f.balance ? `<span class="small warn">${money(f.balance)} due</span>` : f.quote ? '<span class="small pos">Fully paid</span>' : ''}
    </div>
  </div>`;
}

function txRow(t, { showProject = true } = {}) {
  const who = t.type === 'payout' ? (member(t.memberId)?.name || t.payee || 'Payee') : t.type === 'in' ? 'Client payment' : (t.category || 'Expense');
  const sign = t.type === 'in' ? '+' : '−';
  const cls = t.type === 'in' ? 'pos' : 'neg';
  const pend = t.type === 'payout' && t.status === 'pending';
  return `<div class="row no-date">
    <div class="grow clickable" data-act="editTx" data-id="${t.id}">
      <div class="title">${esc(who)} ${t.type === 'payout' ? `<span class="badge ${pend ? 'amber' : 'green'}">${pend ? 'Pending' : 'Paid'}</span>` : ''}</div>
      <div class="meta">${fmtDate(t.date)}${t.mode ? ' · ' + esc(t.mode) : ''}${showProject && t.projectId ? ' · ' + esc(projName(t.projectId)) : ''}${t.note ? ' · ' + esc(t.note) : ''}</div>
    </div>
    <div class="right">
      ${pend ? `<button class="btn sm" data-act="markPaid" data-id="${t.id}">Mark paid</button>` : ''}
      ${t.type === 'in' && t.projectId ? `<button class="btn sm" data-act="printReceipt" data-id="${t.id}">Receipt</button>` : ''}
      <span class="amt ${cls}">${sign}${money(t.amount)}</span>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- forms
function fieldHtml(f, v) {
  const id = 'f_' + f.k;
  if (f.type === 'checkbox') return `<label class="check ${f.full ? 'full' : ''}"><input type="checkbox" name="${f.k}" ${v ? 'checked' : ''}> ${esc(f.label)}</label>`;
  let inp;
  if (f.type === 'textarea') inp = `<textarea id="${id}" name="${f.k}" rows="${f.rows || 3}" placeholder="${esc(f.ph || '')}">${esc(v)}</textarea>`;
  else if (f.type === 'select') inp = `<select id="${id}" name="${f.k}">${f.options.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(v ?? '') ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>`;
  else if (f.type === 'multi') inp = `<div class="chips">${f.options.length ? f.options.map(([ov, ol]) => `<label class="chip"><input type="checkbox" name="${f.k}" value="${esc(ov)}" ${(v || []).includes(ov) ? 'checked' : ''}><span>${esc(ol)}</span></label>`).join('') : `<span class="muted small">${esc(f.emptyMsg || 'Nothing to choose yet')}</span>`}</div>`;
  else {
    inp = `<input id="${id}" name="${f.k}" type="${f.type || 'text'}" value="${esc(v ?? '')}" placeholder="${esc(f.ph || '')}" ${f.required ? 'required' : ''} ${f.type === 'number' ? 'step="any" min="0" inputmode="decimal"' : ''} ${f.list ? `list="dl_${f.k}"` : ''}>`;
    if (f.list) inp += `<datalist id="dl_${f.k}">${f.list.map(o => `<option value="${esc(o)}">`).join('')}</datalist>`;
  }
  return `<div class="fld ${f.full ? 'full' : ''}"><label for="${id}">${esc(f.label)}</label>${inp}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}</div>`;
}

function openForm({ title, fields, values = {}, onSubmit, onDelete, submitLabel = 'Save' }) {
  const m = $('#modal');
  m.innerHTML = `<form class="sheet" novalidate>
    <div class="sheet-h"><h2 style="margin:0">${esc(title)}</h2><button type="button" class="btn ghost sm" data-close>✕</button></div>
    <div class="sheet-b"><div class="form-grid">${fields.map(f => fieldHtml(f, values[f.k] ?? f.def)).join('')}</div></div>
    <div class="sheet-f">${onDelete ? '<button type="button" class="btn danger" data-del>Delete</button>' : ''}<span class="spacer"></span>
      <button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn gold">${esc(submitLabel)}</button></div>
  </form>`;
  m.hidden = false;
  const form = $('form', m);
  setTimeout(() => $('input:not([type=checkbox]),textarea,select', form)?.focus(), 30);
  $$('[data-close]', m).forEach(b => (b.onclick = closeModal));
  if (onDelete) $('[data-del]', m).onclick = () => { if (confirm('Delete this? This cannot be undone.')) { onDelete(); closeModal(); } };
  form.onsubmit = ev => {
    ev.preventDefault();
    const out = {};
    for (const f of fields) {
      if (f.type === 'multi') out[f.k] = $$(`input[name="${f.k}"]:checked`, form).map(i => i.value);
      else if (f.type === 'checkbox') out[f.k] = form.elements[f.k].checked;
      else if (f.type === 'number') out[f.k] = num(form.elements[f.k].value);
      else out[f.k] = form.elements[f.k].value.trim();
      if (f.required && !out[f.k]) { toast(`${f.label} is required`, true); form.elements[f.k]?.focus?.(); return; }
    }
    if (onSubmit(out) !== false) closeModal();
  };
}
function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
$('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

const projectOptions = (blank) => [...(blank ? [['', blank]] : []), ...DB.projects.map(p => [p.id, p.name])];

function editProject(id) {
  const p = id ? project(id) : null;
  openForm({
    title: p ? 'Edit project' : 'New project',
    values: p || { status: 'Enquiry' },
    fields: [
      { k: 'name', label: 'Project name', full: true, required: true, ph: 'e.g. Ravi & Priya Wedding 2026' },
      { k: 'status', label: 'Status', type: 'select', options: opts(PROJECT_STATUS) },
      { k: 'package', label: 'Package', ph: 'e.g. Gold — Photo + Film' },
      { k: 'clientName', label: 'Client name', ph: 'Bride / groom / family contact' },
      { k: 'clientPhone', label: 'Client phone', type: 'tel' },
      { k: 'clientEmail', label: 'Client email', type: 'email' },
      { k: 'quotation', label: 'Quotation amount (₹)', type: 'number' },
      { k: 'clientAddress', label: 'Address', type: 'textarea', rows: 2, full: true },
      { k: 'contractSigned', label: 'Contract signed', type: 'checkbox' },
      { k: 'contractDate', label: 'Contract date', type: 'date' },
      { k: 'notes', label: 'Notes', type: 'textarea', full: true },
    ],
    onSubmit: v => {
      if (p) Object.assign(p, v);
      else {
        const np = { id: uid(), createdAt: today(), stages: {}, deliverables: [], checklist: [], terms: DB.settings.defaultTerms || DEFAULT_TERMS, ...v };
        DB.projects.push(np);
        location.hash = `#/project/${np.id}/1`;
      }
      commit(p ? 'Project updated' : 'Project created');
    },
    onDelete: p && (() => {
      DB.projects = DB.projects.filter(x => x.id !== p.id);
      DB.events = DB.events.filter(e => e.projectId !== p.id);
      DB.transactions = DB.transactions.filter(t => t.projectId !== p.id);
      location.hash = '#/projects';
      commit('Project deleted');
    }),
  });
}

function editEvent(id, preset = {}) {
  const e = id ? DB.events.find(x => x.id === id) : null;
  if (!DB.projects.length) { toast('Create a project first, then add its events', true); return editProject(); }
  openForm({
    title: e ? 'Edit event' : 'New event',
    values: e || { projectId: DB.projects[DB.projects.length - 1].id, ...preset },
    fields: [
      { k: 'projectId', label: 'Project', type: 'select', options: projectOptions(), full: true },
      { k: 'title', label: 'Event', list: EVENT_NAMES, required: true, ph: 'Haldi, Wedding, Reception…' },
      { k: 'date', label: 'Date', type: 'date', required: true },
      { k: 'start', label: 'Start time', type: 'time' },
      { k: 'end', label: 'End time', type: 'time' },
      { k: 'location', label: 'Location / venue', full: true },
      { k: 'crew', label: 'Crew', type: 'multi', full: true, options: DB.team.map(m => [m.id, `${m.name}${m.role ? ' · ' + m.role : ''}`]), emptyMsg: 'Add people on the Team page first' },
      { k: 'equipment', label: 'Equipment taken', type: 'multi', full: true, options: DB.equipment.map(g => [g.id, g.name]), emptyMsg: 'Add gear on the Equipment page first' },
      { k: 'gb', label: 'Footage size (GB)', type: 'number', hint: 'Fill after the shoot' },
      { k: 'backup', label: 'Backup location', ph: 'e.g. SSD-2 / NAS / Drive' },
      { k: 'backedUp', label: 'Backup done (2 copies)', type: 'checkbox', full: true },
      { k: 'notes', label: 'Notes', type: 'textarea', full: true },
    ],
    onSubmit: v => {
      if (e) Object.assign(e, v);
      else DB.events.push({ id: uid(), ...v });
      commit(e ? 'Event updated' : 'Event added');
    },
    onDelete: e && (() => { DB.events = DB.events.filter(x => x.id !== e.id); commit('Event deleted'); }),
  });
}

function editTx(id, preset = {}) {
  const t = id ? DB.transactions.find(x => x.id === id) : null;
  const type = t?.type || preset.type || 'in';
  const titles = { in: 'client payment', payout: 'team / vendor payout', expense: 'expense' };
  const fields = [
    { k: 'projectId', label: 'Project', type: 'select', options: projectOptions(type === 'in' ? null : '— General / no project —'), full: true },
  ];
  if (type === 'payout') fields.push(
    { k: 'memberId', label: 'Team member', type: 'select', options: [['', '— Vendor / other —'], ...DB.team.map(m => [m.id, m.name])] },
    { k: 'payee', label: 'Vendor / payee name', hint: 'If not a team member' },
  );
  if (type === 'expense') fields.push({ k: 'category', label: 'Category', type: 'select', options: opts(EXP_CATS) });
  fields.push(
    { k: 'amount', label: 'Amount (₹)', type: 'number', required: true },
    { k: 'date', label: 'Date', type: 'date', required: true },
    { k: 'mode', label: 'Mode', type: 'select', options: opts(PAY_MODES) },
  );
  if (type === 'payout') fields.push({ k: 'status', label: 'Status', type: 'select', options: [['paid', 'Paid'], ['pending', 'Pending (owed)']] });
  fields.push({ k: 'note', label: type === 'in' ? 'Note (e.g. Advance, 2nd instalment, receipt no.)' : 'Note', full: true });
  if (type === 'in' && !DB.projects.length) { toast('Create a project first', true); return editProject(); }
  openForm({
    title: (t ? 'Edit ' : 'Record ') + titles[type],
    values: t || { date: today(), mode: 'UPI', status: 'paid', category: 'Transport', ...preset },
    fields,
    onSubmit: v => {
      if (t) Object.assign(t, v);
      else DB.transactions.push({ id: uid(), type, ...v });
      commit('Saved');
    },
    onDelete: t && (() => { DB.transactions = DB.transactions.filter(x => x.id !== t.id); commit('Deleted'); }),
  });
}

function editMember(id) {
  const m = id ? member(id) : null;
  openForm({
    title: m ? 'Edit team member' : 'Add team member',
    values: m || {},
    fields: [
      { k: 'name', label: 'Name', required: true },
      { k: 'role', label: 'Role', list: ROLES },
      { k: 'phone', label: 'Phone', type: 'tel' },
      { k: 'rate', label: 'Day rate (₹)', type: 'number' },
      { k: 'upi', label: 'UPI ID / bank note', full: true },
      { k: 'notes', label: 'Notes', type: 'textarea', full: true },
    ],
    onSubmit: v => { if (m) Object.assign(m, v); else DB.team.push({ id: uid(), ...v }); commit('Saved'); },
    onDelete: m && (() => {
      DB.team = DB.team.filter(x => x.id !== m.id);
      DB.events.forEach(e => (e.crew = e.crew.filter(c => c !== m.id)));
      commit('Removed');
    }),
  });
}

function editGear(id) {
  const g = id ? gear(id) : null;
  openForm({
    title: g ? 'Edit equipment' : 'Add equipment',
    values: g || { category: 'Camera', owner: 'Kathanam' },
    fields: [
      { k: 'name', label: 'Name', required: true, ph: 'e.g. Sony A7 IV #1' },
      { k: 'category', label: 'Category', type: 'select', options: opts(EQUIP_CATS) },
      { k: 'serial', label: 'Serial / ID' },
      { k: 'owner', label: 'Owned by', hint: 'Kathanam, a crew member, or rented' },
      { k: 'notes', label: 'Notes', type: 'textarea', full: true },
    ],
    onSubmit: v => { if (g) Object.assign(g, v); else DB.equipment.push({ id: uid(), ...v }); commit('Saved'); },
    onDelete: g && (() => {
      DB.equipment = DB.equipment.filter(x => x.id !== g.id);
      DB.events.forEach(e => (e.equipment = e.equipment.filter(c => c !== g.id)));
      commit('Removed');
    }),
  });
}

function editDeliverable(pid, did) {
  const p = project(pid);
  const d = did ? p.deliverables.find(x => x.id === did) : null;
  openForm({
    title: d ? 'Edit deliverable' : 'Add deliverable',
    values: d || { status: 'Not started' },
    fields: [
      { k: 'name', label: 'Deliverable', required: true, list: DELIV_TEMPLATE, full: true },
      { k: 'status', label: 'Status', type: 'select', options: opts(DELIV_STATUS) },
      { k: 'due', label: 'Due date', type: 'date' },
      { k: 'editor', label: 'Editor / owner', type: 'select', options: [['', '—'], ...DB.team.map(m => [m.id, m.name])] },
      { k: 'deliveredOn', label: 'Delivered on', type: 'date' },
      { k: 'link', label: 'Delivery link (Drive / WeTransfer…)', type: 'url', full: true },
      { k: 'notes', label: 'Notes', type: 'textarea', full: true },
    ],
    onSubmit: v => { if (d) Object.assign(d, v); else p.deliverables.push({ id: uid(), ...v }); commit('Saved'); },
    onDelete: d && (() => { p.deliverables = p.deliverables.filter(x => x.id !== d.id); commit('Deleted'); }),
  });
}

function editTerms(pid) {
  const p = project(pid);
  openForm({
    title: 'Terms & conditions',
    values: { terms: p.terms || DB.settings.defaultTerms || DEFAULT_TERMS },
    fields: [{ k: 'terms', label: 'Terms for this project', type: 'textarea', rows: 14, full: true }],
    onSubmit: v => { p.terms = v.terms; commit('Terms saved'); },
  });
}

// ---------------------------------------------------------------- views
const VIEWS = {};

VIEWS.dashboard = () => {
  const t = today();
  const upcoming = DB.events.filter(e => e.date >= t).sort(byDate);
  const g = globalFin();
  const active = DB.projects.filter(p => !['Delivered', 'Cancelled'].includes(p.status));
  const hour = new Date().getHours();
  return `
  <header class="page-h">
    <div><h1>${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}</h1><p class="muted">${fmtDate(t)} · ${DB.projects.length} projects · ${upcoming.length} upcoming events</p></div>
    <div class="actions"><button class="btn gold" data-act="newProject">+ New project</button><button class="btn" data-act="newEvent">+ Event</button><button class="btn" data-act="newTx" data-type="expense">+ Expense</button></div>
  </header>
  <section class="kpis">
    ${kpi('Next 30 days', upcoming.filter(e => e.date <= addDays(t, 30)).length + ' events', upcoming[0] ? 'Next: ' + fmtShort(upcoming[0].date) : 'Nothing booked yet')}
    ${kpi('Received', money(g.received), 'from clients', 'pos')}
    ${kpi('Client dues', money(g.clientDue), 'yet to collect', 'warn')}
    ${kpi('Paid to team', money(g.paidOut), money(g.payoutDue) + ' still owed')}
    ${kpi('Expenses', money(g.expenses), 'travel, food, vendors…')}
    ${kpi('Cash in hand', money(g.received - g.paidOut - g.expenses), 'received − paid out', g.received - g.paidOut - g.expenses >= 0 ? 'pos' : 'neg')}
  </section>
  <div class="grid2">
    <section class="card"><div class="card-h"><h2>Upcoming events</h2><a href="#/calendar" class="small">Calendar →</a></div>
      ${upcoming.slice(0, 6).map(e => eventRow(e)).join('') || empty('No upcoming events. Open a project and add its event dates.')}</section>
    <section class="card"><div class="card-h"><h2>Active projects</h2><a href="#/projects" class="small">All →</a></div>
      ${active.map(projectRow).join('') || empty('No active projects. Click “New project” to add your first wedding.')}</section>
  </div>`;
};

VIEWS.projects = () => `
  <header class="page-h"><div><h1>Projects</h1><p class="muted">Every wedding / shoot, with its client, schedule and money</p></div>
    <div class="actions"><button class="btn gold" data-act="newProject">+ New project</button></div></header>
  <div class="toolbar">
    <input type="search" placeholder="Search name, client, phone…" value="${esc(ui.q)}" data-input="q">
    <select data-input="status"><option value="">All statuses</option>${PROJECT_STATUS.map(s => `<option ${ui.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
  </div>
  <section class="card" id="projList">${projectList()}</section>`;

function projectList() {
  const q = ui.q.toLowerCase();
  const list = DB.projects
    .filter(p => (!ui.status || p.status === ui.status) && (!q || [p.name, p.clientName, p.clientPhone, p.package].join(' ').toLowerCase().includes(q)))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return list.map(projectRow).join('') || empty(DB.projects.length ? 'No projects match.' : 'No projects yet.');
}

VIEWS.project = r => {
  const p = project(r.id);
  if (!p) return empty('Project not found. <a href="#/projects">Back to projects</a>');
  const f = projectFin(p);
  const tab = Math.min(Math.max(r.tab, 1), 9);
  const st = p.stages[tab] || 'todo';
  return `
  <a href="#/projects" class="crumb">← Projects</a>
  <header class="page-h">
    <div><h1>${esc(p.name)}</h1><p class="muted">${esc(p.clientName || 'No client')} ${p.clientPhone ? `· <a href="tel:${esc(p.clientPhone)}">${esc(p.clientPhone)}</a>` : ''} · ${statusBadge(p.status)}</p></div>
    <div class="actions">
      <select class="inline-select" data-act-change="projStatus" data-id="${p.id}">${PROJECT_STATUS.map(s => `<option ${p.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <button class="btn" data-act="editProject" data-id="${p.id}">Edit</button>
    </div>
  </header>
  <div class="fin">
    <div><div class="lbl">Quotation</div><div class="val">${money(f.quote)}</div></div>
    <div><div class="lbl">Received</div><div class="val pos">${money(f.received)}</div></div>
    <div><div class="lbl">Balance due</div><div class="val ${f.balance ? 'warn' : ''}">${money(f.balance)}</div></div>
    <div><div class="lbl">Team cost</div><div class="val">${money(f.paidOut + f.payoutDue)}</div></div>
    <div><div class="lbl">Expenses</div><div class="val">${money(f.expenses)}</div></div>
    <div><div class="lbl">Est. profit</div><div class="val ${f.profit >= 0 ? 'pos' : 'neg'}">${money(f.profit)}</div></div>
  </div>
  <div class="stages">${STAGES.map(([t], i) => `<button class="stage ${tab === i + 1 ? 'on' : ''}" data-go="#/project/${p.id}/${i + 1}">
      <div class="n">${String(i + 1).padStart(2, '0')}</div><div class="t"><span class="dot ${p.stages[i + 1] || ''}"></span>${t}</div></button>`).join('')}</div>
  <section class="card">
    <div class="card-h">
      <div><h2 style="margin:0">${String(tab).padStart(2, '0')} — ${STAGES[tab - 1][0]}</h2><div class="muted small">${STAGES[tab - 1][1]}</div></div>
      <label class="small muted">Stage&nbsp;<select class="inline-select" data-act-change="stage" data-id="${p.id}" data-tab="${tab}">
        ${Object.entries(STAGE_LABEL).map(([k, l]) => `<option value="${k}" ${st === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    ${TABS[tab](p, f)}
  </section>`;
};

const info = (lbl, v) => `<div><div class="lbl">${lbl}</div><div class="v">${v || '<span class="muted">—</span>'}</div></div>`;
const TABS = {
  1: p => `
    <div class="info">
      ${info('Client', esc(p.clientName))}
      ${info('Phone', p.clientPhone ? `<a href="tel:${esc(p.clientPhone)}">${esc(p.clientPhone)}</a>` : '')}
      ${info('Email', p.clientEmail ? `<a href="mailto:${esc(p.clientEmail)}">${esc(p.clientEmail)}</a>` : '')}
      ${info('Package', esc(p.package))}
      ${info('Quotation', money(p.quotation))}
      ${info('Contract', p.contractSigned ? `<span class="badge green">Signed${p.contractDate ? ' · ' + fmtShort(p.contractDate) : ''}</span>` : '<span class="badge amber">Not signed</span>')}
      ${info('Address', esc(p.clientAddress))}
      ${info('Notes', esc(p.notes))}
    </div>
    <div class="actions" style="margin-top:14px"><button class="btn" data-act="editProject" data-id="${p.id}">Edit client & agreement</button>
      <button class="btn gold" data-act="printQuote" data-id="${p.id}">Print quotation / agreement</button></div>
    <div class="card-h" style="margin-top:24px"><h3>Terms & conditions</h3><button class="btn sm" data-act="editTerms" data-id="${p.id}">Edit terms</button></div>
    <div class="prose">${esc(p.terms || DB.settings.defaultTerms || DEFAULT_TERMS)}</div>`,

  2: (p, f) => {
    const tx = txOf(p.id, 'in').sort(byDate);
    return `<div class="card-h"><div class="muted small">${tx.length} payments · ${money(f.received)} received of ${money(f.quote)}</div>
      <div class="actions"><button class="btn sm" data-act="printStatement" data-id="${p.id}">Print statement</button>
      <button class="btn gold sm" data-act="newTx" data-type="in" data-project="${p.id}">+ Record client payment</button></div></div>
      <div class="bar" style="margin-bottom:10px"><i style="width:${f.quote ? Math.min(f.received / f.quote, 1) * 100 : 0}%"></i></div>
      ${tx.map(t => txRow(t, { showProject: false })).join('') || empty('No payments yet. Record the advance when it arrives.')}`;
  },

  3: p => {
    const evs = DB.events.filter(e => e.projectId === p.id).sort(byDate);
    return `<div class="card-h"><div class="muted small">${evs.length} events</div><div class="actions">
      ${evs.length ? `<button class="btn sm" data-act="icsProject" data-id="${p.id}">Download all (.ics)</button>` : ''}
      <button class="btn gold sm" data-act="newEvent" data-project="${p.id}">+ Add event</button></div></div>
      ${evs.map(e => eventRow(e, { showProject: false })).join('') || empty('No events yet — add Haldi, Wedding, Reception etc. with dates and crew.')}`;
  },

  4: p => {
    const evs = DB.events.filter(e => e.projectId === p.id);
    const crewIds = [...new Set(evs.flatMap(e => e.crew))];
    const payouts = txOf(p.id, 'payout').sort(byDate);
    return `<h3 style="margin-bottom:6px">Crew on this project</h3>
      ${crewIds.map(id => {
        const m = member(id); if (!m) return '';
        const days = evs.filter(e => e.crew.includes(id)).length;
        const paid = sum(payouts.filter(t => t.memberId === id && t.status !== 'pending'), t => t.amount);
        const owed = sum(payouts.filter(t => t.memberId === id && t.status === 'pending'), t => t.amount);
        return `<div class="row no-date"><div class="grow"><div class="title">${esc(m.name)}</div>
          <div class="meta">${esc(m.role || '')} · ${days} event${days > 1 ? 's' : ''}${num(m.rate) ? ` · ${money(m.rate)}/day → ${money(m.rate * days)}` : ''}</div></div>
          <div class="right"><span class="small">Paid <b class="pos">${money(paid)}</b>${owed ? ` · Owed <b class="warn">${money(owed)}</b>` : ''}</span>
          <button class="btn sm" data-act="newTx" data-type="payout" data-project="${p.id}" data-member="${id}" data-amount="${num(m.rate) * days - paid - owed > 0 ? num(m.rate) * days - paid - owed : ''}">Pay</button></div></div>`;
      }).join('') || empty('No crew assigned — assign people in 03 · Event Schedule.')}
      <div class="card-h" style="margin-top:20px"><h3>Payouts & vendor costs</h3><button class="btn gold sm" data-act="newTx" data-type="payout" data-project="${p.id}">+ Record payout</button></div>
      ${payouts.map(t => txRow(t, { showProject: false })).join('') || empty('No payouts recorded yet.')}`;
  },

  5: p => {
    const ex = txOf(p.id, 'expense').sort(byDate);
    const cats = EXP_CATS.map(c => [c, sum(ex.filter(t => t.category === c), t => t.amount)]).filter(([, v]) => v);
    return `<div class="card-h"><div class="tag-list">${cats.map(([c, v]) => `<span class="badge">${c}: ${money(v)}</span>`).join('') || '<span class="muted small">No expenses yet</span>'}</div>
      <button class="btn gold sm" data-act="newTx" data-type="expense" data-project="${p.id}">+ Add expense</button></div>
      ${ex.map(t => txRow(t, { showProject: false })).join('') || empty('Log transport, hotel and food costs here as they happen.')}`;
  },

  6: p => {
    const done = p.checklist.filter(c => c.done).length;
    return `<div class="card-h"><div class="muted small">${done}/${p.checklist.length} done</div><div class="actions">
      ${p.checklist.length ? '' : `<button class="btn sm" data-act="checkTemplate" data-id="${p.id}">Add standard wedding checklist</button>`}
      <button class="btn gold sm" data-act="addCheck" data-id="${p.id}">+ Add item</button></div></div>
      ${CHECK_GROUPS.map(g => {
        const items = p.checklist.filter(c => c.group === g);
        return items.length ? `<div class="group-h">${g}</div>` + items.map(c => `<label class="check-row ${c.done ? 'done' : ''}">
          <input type="checkbox" ${c.done ? 'checked' : ''} data-act-change="toggleCheck" data-id="${p.id}" data-item="${c.id}">
          <span>${esc(c.text)}</span><button class="btn ghost sm" data-act="delCheck" data-id="${p.id}" data-item="${c.id}" aria-label="Remove">✕</button></label>`).join('') : '';
      }).join('') || empty('Shot lists, daily kit checks and venue/drone permissions go here.')}`;
  },

  7: p => {
    const evs = DB.events.filter(e => e.projectId === p.id).sort(byDate);
    const total = sum(evs, e => e.gb);
    const backed = evs.filter(e => e.backedUp).length;
    return `<div class="kpis" style="margin-bottom:8px">${kpi('Total footage', total.toLocaleString('en-IN') + ' GB', (total / 1024).toFixed(2) + ' TB')}${kpi('Backed up', `${backed}/${evs.length}`, 'events with 2 copies', backed === evs.length && evs.length ? 'pos' : 'warn')}</div>
      ${evs.map(e => `<div class="row">${datebox(e.date)}<div class="grow clickable" data-act="editEvent" data-id="${e.id}">
          <div class="title">${esc(e.title)}</div><div class="meta">${num(e.gb) ? num(e.gb) + ' GB' : 'Size not entered'} · ${esc(e.backup || 'No backup location')}</div></div>
          <div class="right"><label class="check"><input type="checkbox" ${e.backedUp ? 'checked' : ''} data-act-change="toggleBackup" data-id="${e.id}"> Backed up</label></div></div>`).join('')
        || empty('Add events in 03 · Event Schedule; then record GB and backup here.')}`;
  },

  8: p => deliverablesTab(p, false),
  9: p => deliverablesTab(p, true),
};

function deliverablesTab(p, finalView) {
  const list = p.deliverables;
  const delivered = list.filter(d => d.status === 'Delivered').length;
  const cls = s => s === 'Delivered' ? 'green' : s === 'Approved' ? 'gold' : s === 'Not started' ? '' : 'amber';
  return `<div class="card-h"><div class="muted small">${delivered}/${list.length} delivered${finalView ? ' to client' : ''}</div><div class="actions">
    ${list.length ? '' : `<button class="btn sm" data-act="delivTemplate" data-id="${p.id}">Add standard deliverables</button>`}
    <button class="btn gold sm" data-act="addDeliv" data-id="${p.id}">+ Add deliverable</button></div></div>
    ${list.map(d => `<div class="row no-date">
      <div class="grow clickable" data-act="editDeliv" data-id="${p.id}" data-item="${d.id}">
        <div class="title">${esc(d.name)} <span class="badge ${cls(d.status)}">${esc(d.status)}</span></div>
        <div class="meta">${d.due ? 'Due ' + fmtShort(d.due) : 'No due date'}${d.editor ? ' · ' + esc(member(d.editor)?.name || '') : ''}${d.deliveredOn ? ' · Delivered ' + fmtShort(d.deliveredOn) : ''}</div>
      </div>
      <div class="right">
        ${d.link ? `<a class="btn sm" href="${esc(d.link)}" target="_blank" rel="noopener">Open link</a>` : ''}
        ${finalView
          ? (d.status !== 'Delivered' ? `<button class="btn sm" data-act="markDelivered" data-id="${p.id}" data-item="${d.id}">Mark delivered</button>` : '')
          : `<select class="inline-select" data-act-change="delivStatus" data-id="${p.id}" data-item="${d.id}">${DELIV_STATUS.map(s => `<option ${d.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>`}
      </div></div>`).join('') || empty(finalView ? 'Nothing to deliver yet — add deliverables in 08 · Post Production.' : 'Plan the film, reels, album etc. here and track their editing status.')}`;
}

VIEWS.calendar = () => {
  const t = today();
  const [y, m] = ui.calMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(y, m, 0).getDate();
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<div class="day blank"></div>';
  for (let d = 1; d <= days; d++) {
    const ds = `${ui.calMonth}-${String(d).padStart(2, '0')}`;
    const evs = DB.events.filter(e => e.date === ds);
    cells += `<div class="day ${evs.length ? 'has' : ''} ${ds === t ? 'today' : ''} ${ds === ui.calDay ? 'sel' : ''}" data-act="pickDay" data-date="${ds}">
      <span class="num">${d}</span>${evs.slice(0, 3).map(e => `<span class="ev">${esc(e.title)}</span>`).join('')}</div>`;
  }
  const list = ui.calDay
    ? DB.events.filter(e => e.date === ui.calDay).sort(byDate)
    : DB.events.filter(e => ui.showPast ? e.date < t : e.date >= t).sort(byDate);
  if (!ui.calDay && ui.showPast) list.reverse();
  const groups = {};
  list.forEach(e => { const k = e.date.slice(0, 7); (groups[k] = groups[k] || []).push(e); });
  return `
  <header class="page-h"><div><h1>Calendar</h1><p class="muted">Booked dates across all projects</p></div>
    <div class="actions"><button class="btn" data-act="icsAll">Export upcoming (.ics)</button><button class="btn gold" data-act="newEvent">+ Event</button></div></header>
  <div class="grid2">
    <section class="card">
      <div class="cal-h"><button class="btn sm" data-act="calNav" data-d="-1">‹</button>
        <h2 style="margin:0">${first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2>
        <button class="btn sm" data-act="calNav" data-d="1">›</button></div>
      <div class="cal">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="dow">${d}</div>`).join('')}${cells}</div>
      <p class="muted small" style="margin:10px 0 0">Tap a date to see its events or book a new one.</p>
    </section>
    <section class="card">
      ${ui.calDay
        ? `<div class="card-h"><h2>${fmtDate(ui.calDay)}</h2><div class="actions"><button class="btn sm" data-act="clearDay">Show all</button><button class="btn gold sm" data-act="newEvent" data-date="${ui.calDay}">+ Book this date</button></div></div>
           ${list.map(e => eventRow(e)).join('') || empty('Free — nothing booked on this date.')}`
        : `<div class="card-h"><h2>${ui.showPast ? 'Past events' : 'Upcoming'}</h2><button class="btn sm" data-act="togglePast">${ui.showPast ? 'Show upcoming' : 'Show past'}</button></div>
           ${Object.entries(groups).map(([k, evs]) => `<div class="group-h">${new Date(k + '-01T00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</div>${evs.map(e => eventRow(e)).join('')}`).join('') || empty('No events.')}`}
    </section>
  </div>`;
};

VIEWS.team = () => {
  const t = today();
  return `
  <header class="page-h"><div><h1>Team</h1><p class="muted">Crew, freelancers and vendors — and what you owe them</p></div>
    <div class="actions"><button class="btn" data-act="newTx" data-type="payout">+ Record payout</button><button class="btn gold" data-act="newMember">+ Add member</button></div></header>
  <section class="card">${DB.team.map(m => {
    const evs = DB.events.filter(e => e.crew.includes(m.id));
    const next = evs.filter(e => e.date >= t).sort(byDate);
    const pay = DB.transactions.filter(x => x.type === 'payout' && x.memberId === m.id);
    const paid = sum(pay.filter(x => x.status !== 'pending'), x => x.amount);
    const owed = sum(pay.filter(x => x.status === 'pending'), x => x.amount);
    return `<div class="row no-date"><div class="grow clickable" data-act="editMember" data-id="${m.id}">
      <div class="title">${esc(m.name)} <span class="muted small">${esc(m.role || '')}</span></div>
      <div class="meta">${m.phone ? esc(m.phone) + ' · ' : ''}${num(m.rate) ? money(m.rate) + '/day · ' : ''}${evs.length} events${next[0] ? ` · next ${esc(next[0].title)} ${fmtShort(next[0].date)}` : ''}</div></div>
      <div class="right"><span class="small">Paid <b class="pos">${money(paid)}</b>${owed ? ` · Owed <b class="warn">${money(owed)}</b>` : ''}</span>
        ${m.phone ? `<a class="btn sm" href="tel:${esc(m.phone)}">Call</a>` : ''}
        <button class="btn sm" data-act="newTx" data-type="payout" data-member="${m.id}">Pay</button></div></div>`;
  }).join('') || empty('Add your photographers, cinematographers, editors and vendors.')}</section>`;
};

VIEWS.equipment = () => {
  const t = today();
  return `
  <header class="page-h"><div><h1>Equipment</h1><p class="muted">Gear inventory and where it's going</p></div>
    <div class="actions"><button class="btn gold" data-act="newGear">+ Add equipment</button></div></header>
  ${EQUIP_CATS.map(c => {
    const items = DB.equipment.filter(g => (g.category || 'Other') === c);
    if (!items.length) return '';
    return `<section class="card"><h2>${c}</h2>${items.map(g => {
      const next = DB.events.filter(e => e.equipment.includes(g.id) && e.date >= t).sort(byDate);
      return `<div class="row no-date"><div class="grow clickable" data-act="editGear" data-id="${g.id}">
        <div class="title">${esc(g.name)}</div>
        <div class="meta">${g.serial ? 'S/N ' + esc(g.serial) + ' · ' : ''}${esc(g.owner || '')}${g.notes ? ' · ' + esc(g.notes) : ''}</div>
        <div class="meta">${next.length ? 'Booked: ' + next.slice(0, 4).map(e => `${esc(e.title)} ${fmtShort(e.date)}`).join(', ') + (next.length > 4 ? ` +${next.length - 4}` : '') : 'Free — no upcoming bookings'}</div></div></div>`;
    }).join('')}</section>`;
  }).join('') || `<section class="card">${empty('List your cameras, lenses, drones, lights and cards. Then tick them on each event.')}</section>`}`;
};

VIEWS.money = () => {
  const list = DB.transactions
    .filter(t => (!ui.moneyType || t.type === ui.moneyType) && (!ui.moneyProject || t.projectId === ui.moneyProject))
    .sort((a, b) => b.date.localeCompare(a.date));
  const inSum = sum(list.filter(t => t.type === 'in'), t => t.amount);
  const outSum = sum(list.filter(t => t.type !== 'in' && t.status !== 'pending'), t => t.amount);
  const owed = sum(list.filter(t => t.status === 'pending'), t => t.amount);
  return `
  <header class="page-h"><div><h1>Money</h1><p class="muted">Client payments in · team payouts & expenses out</p></div>
    <div class="actions"><button class="btn gold" data-act="newTx" data-type="in">+ Client payment</button><button class="btn" data-act="newTx" data-type="payout">+ Payout</button><button class="btn" data-act="newTx" data-type="expense">+ Expense</button></div></header>
  <section class="kpis">${kpi('Money in', money(inSum), '', 'pos')}${kpi('Money out', money(outSum), 'payouts + expenses', 'neg')}${kpi('Net', money(inSum - outSum), '', inSum - outSum >= 0 ? 'pos' : 'neg')}${kpi('Owed to team', money(owed), 'pending payouts', 'warn')}</section>
  <div class="toolbar">
    <select data-input="moneyType"><option value="">All types</option>${[['in', 'Client payments'], ['payout', 'Team / vendor payouts'], ['expense', 'Expenses']].map(([v, l]) => `<option value="${v}" ${ui.moneyType === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <select data-input="moneyProject"><option value="">All projects</option>${DB.projects.map(p => `<option value="${p.id}" ${ui.moneyProject === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
    <button class="btn" data-act="exportCsv">Export CSV</button>
  </div>
  <section class="card">${list.map(t => txRow(t)).join('') || empty('No transactions yet.')}</section>`;
};

VIEWS.settings = () => `
  <header class="page-h"><div><h1>Settings</h1><p class="muted">Backups, phone access and defaults</p></div></header>
  ${MODE === 'cloud' ? `<section class="card"><h2>Use on any device</h2>
    <p>Open this link on your phone, tablet or another computer, and enter the same Web app URL and secret key:</p>
    <div class="prose">${esc(location.href.split('#')[0])}</div>
    <p class="muted small">Then use “Add to Home Screen” to get an app icon. On Android: Chrome ⋮ menu → Add to Home screen. On iPhone: Safari Share → Add to Home Screen.</p>
  </section>` : `<section class="card"><h2>Use on your phone</h2>
    <p>Keep the server running on your laptop, connect your phone to the <b>same Wi-Fi</b>, and open:</p>
    <div id="lanInfo" class="prose">Checking…</div>
    <p class="muted small">Then use your browser's “Add to Home Screen” to get an app icon. On Android: Chrome ⋮ menu → Add to Home screen. On iPhone: Safari Share → Add to Home Screen.</p>
  </section>`}
  ${googleCard()}
  <section class="card"><div class="card-h"><h2>Business details</h2><button class="btn sm" data-act="editBiz">Edit</button></div>
    <p class="muted small" style="margin-top:0">Printed on quotations, statements and receipts.</p>
    <div class="info">${info('Name', esc(biz().name))}${info('Phone', esc(biz().phone))}${info('Email', esc(biz().email))}${info('GSTIN', esc(biz().gstin))}${info('Address', esc(biz().address))}${info('Payment details', esc(biz().payment))}</div>
  </section>
  <section class="card"><h2>Default terms & conditions</h2>
    <p class="muted small">Copied into every new project. You can still change terms per project.</p>
    <div class="prose">${esc(DB.settings.defaultTerms || DEFAULT_TERMS)}</div>
    <div style="margin-top:10px"><button class="btn" data-act="editDefaultTerms">Edit default terms</button></div>
  </section>
  <section class="card"><h2>Backup</h2>
    <p class="muted small">${MODE === 'cloud' ? 'Your data is a file in the “Kathanam CRM” folder of your Google Drive. A dated backup copy is added there every day, and the last 30 are kept.' : 'The server also keeps a daily copy in the <code>data/backups</code> folder. Download a backup now and then and keep it on Google Drive.'}</p>
    <div class="actions"><button class="btn gold" data-act="exportJson">Download backup</button>
      <label class="btn">Restore from backup<input type="file" accept=".json,application/json" hidden data-act-change="importJson"></label></div>
  </section>
  ${MODE === 'cloud' ? `<section class="card"><h2>This device</h2>
    <p class="muted small">Connected to your Google account. Your data is protected by your secret key. If a phone is lost, run <code>resetKey</code> in Apps Script and enter the new key on your other devices.</p>
    <button class="btn danger" data-act="disconnect">Disconnect this device</button>
  </section>` : `<section class="card"><h2>PIN lock</h2>
    <p class="muted small">Anyone on your Wi-Fi can open the CRM unless you set a PIN. Open <code>config.json</code> next to server.py, set <code>"pin": "1234"</code> (your own number), and restart the server.</p>
  </section>`}`;

function googleCard() {
  if (MODE === 'cloud') {
    return `<section class="card"><div class="card-h"><h2>Google Calendar</h2><span class="badge green">✓ Synced automatically</span></div>
      <p>Every event you add, change or delete here is copied to your Google Calendar when you save. The venue, crew and equipment go in the description.</p>
      <p class="muted small">Make changes here, not in Google Calendar. The CRM is the master copy.</p>
      <button class="btn gold" data-act="googleSync">Sync now</button>
    </section>`;
  }
  return `<section class="card"><h2>Google Calendar</h2>
    <p class="muted">In offline mode, each event has a <b>+ Google Calendar</b> button that opens a pre-filled event. To add many at once, export a .ics file and import it at calendar.google.com → Settings → Import & export. The online version syncs automatically.</p>
    <button class="btn" data-act="icsAll">Export upcoming events (.ics)</button>
  </section>`;
}

// ---------------------------------------------------------------- printable documents
const biz = () => ({ name: 'Kathanam', tagline: 'A Golden Media company', ...DB.settings.biz });

function editBiz() {
  openForm({
    title: 'Business details',
    values: biz(),
    fields: [
      { k: 'name', label: 'Business name', required: true },
      { k: 'tagline', label: 'Tagline' },
      { k: 'phone', label: 'Phone', type: 'tel' },
      { k: 'email', label: 'Email', type: 'email' },
      { k: 'gstin', label: 'GSTIN (optional)' },
      { k: 'website', label: 'Website / Instagram' },
      { k: 'address', label: 'Address', type: 'textarea', rows: 2, full: true },
      { k: 'payment', label: 'Payment details (UPI ID / bank account for clients)', type: 'textarea', rows: 3, full: true },
    ],
    onSubmit: v => { DB.settings.biz = v; commit('Business details saved'); },
  });
}

// Indian-style amount in words: 1,25,000 -> "One Lakh Twenty-Five Thousand Rupees Only"
function inWords(n) {
  n = Math.round(num(n));
  if (!n) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = x => x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? '-' + a[x % 10] : '');
  const three = x => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 ? two(x % 100) : '');
  const parts = [];
  [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand']].forEach(([v, w]) => { if (n >= v) { parts.push(three(Math.floor(n / v)) + ' ' + w); n %= v; } });
  if (n) parts.push(three(n));
  return parts.join(' ') + ' Rupees Only';
}

function printDoc(title, body) {
  const w = window.open('', '_blank');
  if (!w) return toast('Allow pop-ups for this page to print', true);
  const B = biz();
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font: 13px/1.55 Inter, system-ui, sans-serif; color: #1b1b1b; margin: 0; background: #fff; }
    .page { max-width: 800px; margin: 0 auto; padding: 24px; }
    .head { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #b8932c; padding-bottom: 12px; }
    .head img { height: 150px; margin: -34px 0 -38px -26px; }
    .head .biz { text-align: right; font-size: 12px; color: #555; }
    .head .biz b { color: #1b1b1b; font-size: 13px; }
    h1 { font: 700 30px 'Cormorant Garamond', serif; color: #9c7a1e; margin: 22px 0 2px; letter-spacing: .5px; }
    h2 { font: 600 19px 'Cormorant Garamond', serif; color: #9c7a1e; margin: 22px 0 8px; border-bottom: 1px solid #e6dcc0; padding-bottom: 4px; }
    .meta { display: flex; justify-content: space-between; gap: 20px; margin-top: 10px; }
    .meta .lbl { font-size: 10.5px; text-transform: uppercase; letter-spacing: 1px; color: #8a8a8a; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 1px; color: #8a8a8a; border-bottom: 1px solid #ddd; padding: 6px 8px; }
    td { padding: 7px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
    .r { text-align: right; white-space: nowrap; }
    .total td { font-weight: 600; font-size: 14px; border-top: 2px solid #b8932c; border-bottom: 0; }
    .big { font: 700 28px 'Cormorant Garamond', serif; color: #1b1b1b; }
    .box { border: 1px solid #e6dcc0; background: #fcf9f1; border-radius: 8px; padding: 12px 14px; }
    .terms { white-space: pre-wrap; font-size: 11.5px; color: #333; }
    .sign { display: flex; justify-content: space-between; gap: 40px; margin-top: 56px; }
    .sign div { flex: 1; border-top: 1px solid #999; padding-top: 6px; font-size: 12px; color: #555; }
    .foot { margin-top: 30px; text-align: center; font-size: 11px; color: #999; }
    .bar { position: sticky; top: 0; background: #0a0a0a; padding: 10px; text-align: center; }
    .bar button { background: linear-gradient(135deg,#f7e08a,#d4af37,#a07c1f); border: 0; padding: 10px 22px; border-radius: 8px; font: 600 14px Inter, sans-serif; cursor: pointer; }
    @media print { .bar { display: none; } .page { padding: 0; } }
  </style></head><body>
  <div class="bar"><button onclick="print()">Print / Save as PDF</button></div>
  <div class="page">
    <div class="head"><img src="${new URL('logo.png', location.href).href}" alt="${esc(B.name)}">
      <div class="biz"><b>${esc(B.name)}</b>${B.tagline ? `<br>${esc(B.tagline)}` : ''}${B.address ? `<br>${esc(B.address).replace(/\n/g, '<br>')}` : ''}
        ${B.phone ? `<br>${esc(B.phone)}` : ''}${B.email ? ` · ${esc(B.email)}` : ''}${B.website ? `<br>${esc(B.website)}` : ''}${B.gstin ? `<br>GSTIN: ${esc(B.gstin)}` : ''}</div></div>
    ${body}
    <div class="foot">${esc(B.name)} — thank you for letting us tell your story.</div>
  </div></body></html>`);
  w.document.close();
}

const docNo = (prefix, id) => `${prefix}-${new Date().getFullYear()}-${String(id).slice(-5).toUpperCase()}`;
const clientBlock = p => `<div><div class="lbl">Client</div><b>${esc(p.clientName || p.name)}</b>${p.clientPhone ? `<br>${esc(p.clientPhone)}` : ''}${p.clientEmail ? `<br>${esc(p.clientEmail)}` : ''}${p.clientAddress ? `<br>${esc(p.clientAddress).replace(/\n/g, '<br>')}` : ''}</div>`;

function printQuotation(pid) {
  const p = project(pid);
  const evs = DB.events.filter(e => e.projectId === p.id).sort(byDate);
  const B = biz();
  printDoc(`Quotation — ${p.name}`, `
    <h1>Quotation &amp; Agreement</h1>
    <div class="meta">${clientBlock(p)}
      <div style="text-align:right"><div class="lbl">Quotation no.</div><b>${docNo('Q', p.id)}</b><div class="lbl" style="margin-top:6px">Date</div>${fmtDate(today())}</div></div>
    <h2>${esc(p.name)}${p.package ? ` · ${esc(p.package)}` : ''}</h2>
    ${evs.length ? `<table><tr><th>Event</th><th>Date</th><th>Time</th><th>Venue</th></tr>
      ${evs.map(e => `<tr><td>${esc(e.title)}</td><td>${fmtDate(e.date)}</td><td>${e.start ? fmtTime(e.start) + (e.end ? ' – ' + fmtTime(e.end) : '') : 'Full day'}</td><td>${esc(e.location)}</td></tr>`).join('')}</table>` : '<p>Event dates to be confirmed.</p>'}
    ${p.deliverables.length ? `<h2>Deliverables</h2><table>${p.deliverables.map(d => `<tr><td>${esc(d.name)}</td><td class="r">${d.due ? 'By ' + fmtDate(d.due) : ''}</td></tr>`).join('')}</table>` : ''}
    <h2>Investment</h2>
    <div class="box"><div class="big">${money(p.quotation)}</div><div>${inWords(p.quotation)}</div></div>
    ${B.payment ? `<h2>Payment details</h2><div class="terms">${esc(B.payment)}</div>` : ''}
    <h2>Terms &amp; conditions</h2>
    <div class="terms">${esc(p.terms || DB.settings.defaultTerms || DEFAULT_TERMS)}</div>
    <div class="sign"><div>Client signature &amp; date</div><div>For ${esc(B.name)}</div></div>`);
}

function printStatement(pid) {
  const p = project(pid);
  const f = projectFin(p);
  const tx = txOf(p.id, 'in').sort(byDate);
  const B = biz();
  printDoc(`Payment statement — ${p.name}`, `
    <h1>Payment Statement</h1>
    <div class="meta">${clientBlock(p)}
      <div style="text-align:right"><div class="lbl">Project</div><b>${esc(p.name)}</b><div class="lbl" style="margin-top:6px">Date</div>${fmtDate(today())}</div></div>
    <h2>Payments received</h2>
    <table><tr><th>Date</th><th>Details</th><th>Mode</th><th class="r">Amount</th></tr>
      ${tx.map(t => `<tr><td>${fmtDate(t.date)}</td><td>${esc(t.note || 'Payment')}</td><td>${esc(t.mode || '')}</td><td class="r">${money(t.amount)}</td></tr>`).join('') || '<tr><td colspan="4">No payments yet</td></tr>'}
      <tr class="total"><td colspan="3">Total received</td><td class="r">${money(f.received)}</td></tr></table>
    <h2>Summary</h2>
    <table><tr><td>Agreed amount</td><td class="r">${money(f.quote)}</td></tr>
      <tr><td>Received</td><td class="r">${money(f.received)}</td></tr>
      <tr class="total"><td>Balance due</td><td class="r">${money(f.balance)}</td></tr></table>
    ${f.balance && B.payment ? `<h2>How to pay</h2><div class="terms">${esc(B.payment)}</div>` : ''}`);
}

function printReceipt(tid) {
  const t = DB.transactions.find(x => x.id === tid);
  const p = project(t.projectId) || { name: '', id: '' };
  const receivedUpTo = sum(txOf(p.id, 'in').filter(x => x.date < t.date || (x.date === t.date && x.id <= t.id)), x => x.amount);
  const balance = Math.max(num(p.quotation) - receivedUpTo, 0);
  const B = biz();
  printDoc(`Receipt — ${p.name}`, `
    <h1>Payment Receipt</h1>
    <div class="meta">${clientBlock(p)}
      <div style="text-align:right"><div class="lbl">Receipt no.</div><b>${docNo('R', t.id)}</b><div class="lbl" style="margin-top:6px">Date</div>${fmtDate(t.date)}</div></div>
    <h2>Received with thanks</h2>
    <div class="box"><div class="big">${money(t.amount)}</div><div>${inWords(t.amount)}</div></div>
    <table style="margin-top:14px">
      <tr><td>Towards</td><td class="r">${esc(p.name)}${t.note ? ' — ' + esc(t.note) : ''}</td></tr>
      <tr><td>Payment mode</td><td class="r">${esc(t.mode || '—')}</td></tr>
      <tr><td>Agreed amount</td><td class="r">${money(p.quotation)}</td></tr>
      <tr><td>Received to date</td><td class="r">${money(receivedUpTo)}</td></tr>
      <tr class="total"><td>Balance due</td><td class="r">${money(balance)}</td></tr></table>
    <div class="sign"><div style="flex:0 0 45%;margin-left:auto">For ${esc(B.name)}</div></div>`);
}

// ---------------------------------------------------------------- render & routing
function route() {
  const [view, id, tab] = location.hash.replace(/^#\/?/, '').split('/');
  return { view: view || 'dashboard', id, tab: +tab || 1 };
}
function render() {
  if (!DB) return;
  const r = route();
  const navKey = r.view === 'project' ? 'projects' : r.view;
  const navHtml = (items) => items.map(([k, l, i]) => `<a href="#/${k}" class="${navKey === k ? 'on' : ''}">${icon(i)}<span>${l}</span></a>`).join('');
  $('#sideNav').innerHTML = navHtml(NAV);
  $('#bottomNav').innerHTML = navHtml(NAV.slice(0, 6));
  $('#main').innerHTML = (VIEWS[r.view] || VIEWS.dashboard)(r);
  if (r.view === 'settings' && MODE === 'local') loadLanInfo();
}
let lastView = '';
window.addEventListener('hashchange', () => {
  const v = route().view + (route().id || '');
  if (v !== lastView) window.scrollTo(0, 0);
  lastView = v;
  ui.calDay = null;
  render();
});

async function loadLanInfo() {
  try {
    const j = await (await fetch('/api/info')).json();
    const el = $('#lanInfo');
    if (el) el.textContent = j.ips.length ? j.ips.map(ip => `http://${ip}:${j.port}`).join('\n') : 'No network address found — is the laptop connected to Wi-Fi?';
  } catch { /* offline */ }
}

// ---------------------------------------------------------------- actions
const ACTIONS = {
  newProject: () => editProject(),
  editProject: d => editProject(d.id),
  newEvent: d => editEvent(null, { ...(d.project && { projectId: d.project }), ...(d.date && { date: d.date }) }),
  editEvent: d => editEvent(d.id),
  newTx: d => editTx(null, { type: d.type, ...(d.project && { projectId: d.project }), ...(d.member && { memberId: d.member }), ...(d.amount && { amount: +d.amount }) }),
  editTx: d => editTx(d.id),
  markPaid: d => { const t = DB.transactions.find(x => x.id === d.id); t.status = 'paid'; t.date = today(); commit('Marked as paid'); },
  newMember: () => editMember(),
  editMember: d => editMember(d.id),
  newGear: () => editGear(),
  editGear: d => editGear(d.id),
  editTerms: d => editTerms(d.id),
  addCheck: d => openForm({
    title: 'Add checklist item',
    fields: [{ k: 'group', label: 'Section', type: 'select', options: opts(CHECK_GROUPS) }, { k: 'text', label: 'Item', required: true, full: true }],
    onSubmit: v => { project(d.id).checklist.push({ id: uid(), done: false, ...v }); commit('Added'); },
  }),
  checkTemplate: d => { project(d.id).checklist.push(...CHECK_TEMPLATE.map(([group, text]) => ({ id: uid(), group, text, done: false }))); commit('Checklist added'); },
  delCheck: (d, e) => { e.preventDefault(); const p = project(d.id); p.checklist = p.checklist.filter(c => c.id !== d.item); commit('Removed'); },
  addDeliv: d => editDeliverable(d.id),
  editDeliv: d => editDeliverable(d.id, d.item),
  delivTemplate: d => { project(d.id).deliverables.push(...DELIV_TEMPLATE.map(name => ({ id: uid(), name, status: 'Not started' }))); commit('Deliverables added'); },
  markDelivered: d => { const x = project(d.id).deliverables.find(i => i.id === d.item); x.status = 'Delivered'; x.deliveredOn = x.deliveredOn || today(); commit('Marked delivered'); },
  pickDay: d => { ui.calDay = ui.calDay === d.date ? null : d.date; render(); },
  clearDay: () => { ui.calDay = null; render(); },
  togglePast: () => { ui.showPast = !ui.showPast; render(); },
  calNav: d => { const [y, m] = ui.calMonth.split('-').map(Number); ui.calMonth = isoLocal(new Date(y, m - 1 + +d.d, 1)).slice(0, 7); ui.calDay = null; render(); },
  icsAll: () => { const evs = DB.events.filter(e => e.date >= today()).sort(byDate); if (!evs.length) return toast('No upcoming events', true); downloadIcs(evs); },
  icsProject: d => downloadIcs(DB.events.filter(e => e.projectId === d.id).sort(byDate), 'kathanam-' + d.id + '.ics'),
  editDefaultTerms: () => openForm({
    title: 'Default terms & conditions',
    values: { terms: DB.settings.defaultTerms || DEFAULT_TERMS },
    fields: [{ k: 'terms', label: 'Terms', type: 'textarea', rows: 14, full: true }],
    onSubmit: v => { DB.settings.defaultTerms = v.terms; commit('Default terms saved'); },
  }),
  editBiz: () => editBiz(),
  printQuote: d => printQuotation(d.id),
  printStatement: d => printStatement(d.id),
  printReceipt: d => printReceipt(d.id),
  googleSync: () => syncCalendarNow(),
  disconnect: () => {
    if (!confirm('Disconnect this device? Your data stays safe in Google Drive. You can reconnect with the URL and key.')) return;
    store.set('kc_key', '');
    MODE = 'setup';
    DB = null;
    location.hash = '';
    renderSetup();
  },
  exportJson: () => download(new Blob([JSON.stringify(DB, null, 1)], { type: 'application/json' }), `kathanam-crm-backup-${today()}.json`),
  exportCsv: () => {
    const rows = [['Date', 'Type', 'Project', 'Payee / Category', 'Amount', 'Mode', 'Status', 'Note']];
    DB.transactions.slice().sort(byDate).forEach(t => rows.push([t.date, { in: 'Client payment', payout: 'Payout', expense: 'Expense' }[t.type], projName(t.projectId),
      t.type === 'payout' ? (member(t.memberId)?.name || t.payee || '') : t.type === 'expense' ? t.category : '', t.amount, t.mode, t.type === 'payout' ? t.status : '', t.note]));
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    download(new Blob(['﻿' + csv], { type: 'text/csv' }), `kathanam-money-${today()}.csv`);
  },
};

const CHANGES = {
  projStatus: (d, el) => { project(d.id).status = el.value; commit('Status updated'); },
  stage: (d, el) => { project(d.id).stages[d.tab] = el.value; commit('Stage updated'); },
  toggleCheck: (d, el) => { project(d.id).checklist.find(c => c.id === d.item).done = el.checked; commit('Saved'); },
  toggleBackup: (d, el) => { DB.events.find(e => e.id === d.id).backedUp = el.checked; commit('Saved'); },
  delivStatus: (d, el) => {
    const x = project(d.id).deliverables.find(i => i.id === d.item);
    x.status = el.value;
    if (el.value === 'Delivered' && !x.deliveredOn) x.deliveredOn = today();
    commit('Saved');
  },
  importJson: async (d, el) => {
    const file = el.files[0];
    if (!file) return;
    try {
      const data = normalize(JSON.parse(await file.text()));
      if (!confirm(`Replace everything with this backup? (${data.projects.length} projects, ${data.events.length} events)`)) return;
      DB = data;
      commit('Backup restored');
    } catch { toast('That file is not a valid backup', true); }
  },
};

document.addEventListener('click', e => {
  const go = e.target.closest('[data-go]');
  const act = e.target.closest('[data-act]');
  if (act && ACTIONS[act.dataset.act] && (!go || go.contains(act))) { ACTIONS[act.dataset.act](act.dataset, e); return; }
  if (go && !e.target.closest('a,button:not([data-go]),select,input,label')) location.hash = go.dataset.go;
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-act-change]');
  if (el && CHANGES[el.dataset.actChange]) CHANGES[el.dataset.actChange](el.dataset, el);
});
document.addEventListener('input', e => {
  const k = e.target.dataset?.input;
  if (!k) return;
  ui[k] = e.target.value;
  if (k === 'q' || k === 'status') $('#projList').innerHTML = projectList();
  else render();
});
$('[data-icon="settings"]').innerHTML = icon('settings');

load();
