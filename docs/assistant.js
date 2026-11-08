'use strict';
/* Kathanam CRM — Assistant. You describe a booking in plain words; Gemini (free, via your Apps Script)
   proposes CRM changes; you tick what's right and confirm. Nothing is saved before you confirm. */

ICONS.spark = '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>';
NAV.splice(1, 0, ['assistant', 'Assistant', 'spark']);

ui.agent = { messages: [], plan: null, checked: [], busy: false, draft: '' };

const A_ORDER = ['create_project', 'add_team_member', 'add_equipment', 'update_project', 'add_event', 'update_event', 'add_payment', 'add_deliverable'];
const EXAMPLES = [
  'New booking: Ravi & Priya, 98765 43210. Haldi 12 Dec morning at home in Guntur, wedding 13 Dec 7pm at N Convention Hyderabad, reception 14 Dec 7pm same venue. Candid photo + candid video + drone for wedding and reception, traditional photo and video for all. 2 LED screens and live streaming at reception. Quote 4.5L, advance 1L received by UPI today.',
  'Add a sangeet for Arjun & Meghana on 19 Dec 6pm at Taj Krishna, candid photography and drone.',
  'Paid Ravi Kumar 8000 for the Haldi, and spent 3500 on travel to Guntur.',
];

const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const isTime = v => /^\d{2}:\d{2}$/.test(v || '');

function agentContext() {
  const recent = DB.projects.filter(p => p.status !== 'Cancelled').slice(-40);
  return {
    today: today(),
    projectStatuses: PROJECT_STATUS,
    projects: recent.map(p => ({
      id: p.id, name: p.name, clientName: p.clientName || '', clientPhone: p.clientPhone || '', status: p.status, quotation: num(p.quotation),
      events: DB.events.filter(e => e.projectId === p.id).map(e => ({ id: e.id, title: e.title, date: e.date, start: e.start || '', location: e.location || '', services: e.services })),
    })),
    team: DB.team.map(m => ({ name: m.name, role: m.role || '' })),
    equipment: DB.equipment.map(g => g.name),
  };
}

// ---------------------------------------------------------------- checking a proposed plan
function planKeys(plan) {
  const keys = {};
  plan.actions.forEach(a => { if (a.type === 'create_project' && a.key) keys[a.key] = a.name || (a.clientName ? a.clientName + ' Wedding' : 'New project'); });
  return keys;
}
function refLabel(ref, keys) {
  if (keys[ref]) return `${esc(keys[ref])} <span class="badge gold">new</span>`;
  return project(ref) ? esc(project(ref).name) : '<span class="warn">unknown project</span>';
}
function checkAction(a, keys) {
  const hasProject = ref => !!(keys[ref] || project(ref));
  switch (a.type) {
    case 'create_project': return a.name || a.clientName ? '' : 'Needs a client or project name';
    case 'update_project': return project(a.projectRef) ? '' : 'Could not find that project';
    case 'add_event': return !hasProject(a.projectRef) ? 'Which project is this for?' : !isDate(a.date) ? 'Needs a date' : '';
    case 'update_event': return DB.events.some(e => e.id === a.eventId) ? '' : 'Could not find that event';
    case 'add_payment':
      if (!(num(a.amount) > 0)) return 'Needs an amount';
      return a.payType === 'in' && !hasProject(a.projectRef) ? 'Which project is this payment for?' : '';
    case 'add_team_member': case 'add_equipment': return a.name ? '' : 'Needs a name';
    case 'add_deliverable': return !hasProject(a.projectRef) ? 'Which project?' : a.name ? '' : 'Needs a name';
    default: return 'Unknown action';
  }
}

function describe(a, keys) {
  const t = (d, s, e) => `${fmtDate(d)}${isTime(s) ? ' · ' + fmtTime(s) + (isTime(e) ? '–' + fmtTime(e) : '') : ''}`;
  const svc = a => (a.services || []).map(s => `<span class="badge gold">${esc(s)}</span>`).join('') + (a.servicesNote ? `<span class="badge">${esc(a.servicesNote)}</span>` : '');
  const newPeople = (list, find) => (list || []).map(n => esc(n) + (find(n) ? '' : ' <span class="badge">new</span>')).join(', ');
  switch (a.type) {
    case 'create_project':
      return `<b>New client project:</b> ${esc(a.name || a.clientName + ' Wedding')}
        <div class="meta">${[a.clientName && 'Client: ' + esc(a.clientName), a.clientPhone && esc(a.clientPhone), a.clientEmail && esc(a.clientEmail), a.package && esc(a.package),
          num(a.quotation) ? 'Quote ' + money(a.quotation) : '', 'Status: ' + esc(PROJECT_STATUS.includes(a.status) ? a.status : 'Enquiry')].filter(Boolean).join(' · ')}</div>
        ${a.notes ? `<div class="meta">${esc(a.notes)}</div>` : ''}`;
    case 'update_project': {
      const changes = ['name', 'clientName', 'clientPhone', 'clientEmail', 'clientAddress', 'package', 'quotation', 'status', 'notes'].filter(k => a[k] !== undefined && a[k] !== '');
      return `<b>Update project:</b> ${refLabel(a.projectRef, keys)}<div class="meta">${changes.map(k => `${k}: ${k === 'quotation' ? money(a[k]) : esc(a[k])}`).join(' · ')}</div>`;
    }
    case 'add_event':
      return `<b>${esc(a.title || 'Event')}</b> for ${refLabel(a.projectRef, keys)}
        <div class="meta">${isDate(a.date) ? t(a.date, a.start, a.end) : '<span class="warn">date missing</span>'}${a.location ? ' · ' + esc(a.location) : ''}</div>
        ${svc(a) ? `<div class="tag-list">${svc(a)}</div>` : ''}
        ${(a.crew || []).length ? `<div class="meta">Crew: ${newPeople(a.crew, memberByName)}</div>` : ''}
        ${(a.equipment || []).length ? `<div class="meta">Equipment: ${newPeople(a.equipment, gearByName)}</div>` : ''}
        ${a.notes ? `<div class="meta">${esc(a.notes)}</div>` : ''}`;
    case 'update_event': {
      const e = DB.events.find(x => x.id === a.eventId);
      const bits = [isDate(a.date) && t(a.date, a.start, a.end), a.location && esc(a.location), a.title && 'Rename to ' + esc(a.title), a.notes && esc(a.notes)].filter(Boolean);
      return `<b>Update ${esc(e?.title || 'event')}</b>${e ? ' (' + fmtShort(e.date) + ')' : ''}<div class="meta">${bits.join(' · ')}</div>${svc(a) ? `<div class="tag-list">${svc(a)}</div>` : ''}`;
    }
    case 'add_payment':
      if (a.payType === 'in') return `<b>Client payment ${money(a.amount)}</b> for ${refLabel(a.projectRef, keys)}<div class="meta">${fmtDate(isDate(a.date) ? a.date : today())}${a.mode ? ' · ' + esc(a.mode) : ''}${a.note ? ' · ' + esc(a.note) : ''}</div>`;
      if (a.payType === 'payout') return `<b>Payout ${money(a.amount)}</b> to ${esc(a.payee || 'payee')} ${a.payStatus === 'pending' ? '<span class="badge amber">Pending</span>' : '<span class="badge green">Paid</span>'}<div class="meta">${a.projectRef ? refLabel(a.projectRef, keys) + ' · ' : ''}${fmtDate(isDate(a.date) ? a.date : today())}${a.note ? ' · ' + esc(a.note) : ''}</div>`;
      return `<b>Expense ${money(a.amount)}</b> · ${esc(EXP_CATS.includes(a.category) ? a.category : 'Misc')}<div class="meta">${a.projectRef ? refLabel(a.projectRef, keys) + ' · ' : ''}${fmtDate(isDate(a.date) ? a.date : today())}${a.note ? ' · ' + esc(a.note) : ''}</div>`;
    case 'add_team_member': return `<b>New team member:</b> ${esc(a.name)}<div class="meta">${[a.role, a.phone, num(a.rate) ? money(a.rate) + '/day' : ''].filter(Boolean).map(esc).join(' · ')}</div>`;
    case 'add_equipment': return `<b>New equipment:</b> ${esc(a.name)}`;
    case 'add_deliverable': return `<b>Deliverable:</b> ${esc(a.name)} for ${refLabel(a.projectRef, keys)}${isDate(a.due) ? `<div class="meta">Due ${fmtDate(a.due)}</div>` : ''}`;
    default: return esc(a.type);
  }
}

// ---------------------------------------------------------------- applying a confirmed plan
const lc = s => String(s || '').trim().toLowerCase();
const memberByName = n => DB.team.find(m => lc(m.name) === lc(n)) || DB.team.find(m => lc(m.name).split(' ')[0] === lc(n));
const gearByName = n => DB.equipment.find(g => lc(g.name) === lc(n));
function memberId(name, extra = {}) {
  const m = memberByName(name);
  if (m) return m.id;
  const nm = { id: uid(), name: String(name).trim(), ...extra };
  DB.team.push(nm);
  return nm.id;
}
function gearId(name) {
  const g = gearByName(name);
  if (g) return g.id;
  const ng = { id: uid(), name: String(name).trim(), category: 'Other', owner: 'Kathanam' };
  DB.equipment.push(ng);
  return ng.id;
}
const pick = (a, ks) => Object.fromEntries(ks.filter(k => a[k] !== undefined && a[k] !== null && a[k] !== '').map(k => [k, k === 'quotation' || k === 'rate' ? num(a[k]) : String(a[k]).trim()]));

function applyPlan() {
  const plan = ui.agent.plan;
  const keys = {};
  const chosen = plan.actions.map((a, i) => ({ a, i })).filter(({ a, i }) => ui.agent.checked[i] && !a._problem)
    .sort((x, y) => A_ORDER.indexOf(x.a.type) - A_ORDER.indexOf(y.a.type));
  const ref = r => keys[r] || (project(r) ? r : null);
  let done = 0;
  let skipped = 0;
  let focus = null;

  for (const { a } of chosen) {
    if (a.type === 'create_project') {
      const p = {
        id: uid(), createdAt: today(), stages: {}, deliverables: [], checklist: [], terms: DB.settings.defaultTerms || DEFAULT_TERMS,
        ...pick(a, ['clientName', 'clientPhone', 'clientEmail', 'clientAddress', 'package', 'quotation', 'notes']),
        name: (a.name || a.clientName + ' Wedding').trim(),
        status: PROJECT_STATUS.includes(a.status) ? a.status : 'Enquiry',
      };
      DB.projects.push(p);
      if (a.key) keys[a.key] = p.id;
      focus = focus || p.id;
    } else if (a.type === 'update_project') {
      const p = project(a.projectRef);
      const ch = pick(a, ['name', 'clientName', 'clientPhone', 'clientEmail', 'clientAddress', 'package', 'quotation', 'notes']);
      if (PROJECT_STATUS.includes(a.status)) ch.status = a.status;
      Object.assign(p, ch);
      focus = focus || p.id;
    } else if (a.type === 'add_team_member') {
      if (!memberByName(a.name)) DB.team.push({ id: uid(), ...pick(a, ['name', 'role', 'phone', 'rate']) });
    } else if (a.type === 'add_equipment') {
      gearId(a.name);
    } else if (a.type === 'add_event') {
      const pid = ref(a.projectRef);
      if (!pid) { skipped++; continue; }
      DB.events.push({
        id: uid(), projectId: pid, title: (a.title || 'Event').trim(), date: a.date,
        start: isTime(a.start) ? a.start : '', end: isTime(a.end) ? a.end : '', location: (a.location || '').trim(),
        services: (a.services || []).filter(s => SERVICES.includes(s)), servicesNote: (a.servicesNote || '').trim(),
        crew: (a.crew || []).map(n => memberId(n)), equipment: (a.equipment || []).map(gearId), notes: (a.notes || '').trim(),
      });
      focus = focus || pid;
    } else if (a.type === 'update_event') {
      const e = DB.events.find(x => x.id === a.eventId);
      Object.assign(e, pick(a, ['title', 'location', 'notes', 'servicesNote']));
      if (isDate(a.date)) e.date = a.date;
      if (isTime(a.start)) e.start = a.start;
      if (isTime(a.end)) e.end = a.end;
      if ((a.services || []).length) e.services = a.services.filter(s => SERVICES.includes(s));
      if ((a.crew || []).length) e.crew = [...new Set([...e.crew, ...a.crew.map(n => memberId(n))])];
      if ((a.equipment || []).length) e.equipment = [...new Set([...e.equipment, ...a.equipment.map(gearId)])];
      focus = focus || e.projectId;
    } else if (a.type === 'add_payment') {
      const type = ['in', 'payout', 'expense'].includes(a.payType) ? a.payType : 'expense';
      const pid = a.projectRef ? ref(a.projectRef) : '';
      if (type === 'in' && !pid) { skipped++; continue; }
      const t = { id: uid(), type, projectId: pid || '', amount: num(a.amount), date: isDate(a.date) ? a.date : today(),
        mode: PAY_MODES.find(m => lc(m) === lc(a.mode)) || 'UPI', note: (a.note || '').trim() };
      if (type === 'payout') {
        const m = a.payee && memberByName(a.payee);
        if (m) t.memberId = m.id; else t.payee = (a.payee || '').trim();
        t.status = a.payStatus === 'pending' ? 'pending' : 'paid';
      }
      if (type === 'expense') t.category = EXP_CATS.includes(a.category) ? a.category : 'Misc';
      DB.transactions.push(t);
      focus = focus || pid;
    } else if (a.type === 'add_deliverable') {
      const pid = ref(a.projectRef);
      if (!pid) { skipped++; continue; }
      project(pid).deliverables.push({ id: uid(), name: a.name.trim(), status: 'Not started', due: isDate(a.due) ? a.due : '' });
    }
    done++;
  }
  ui.agent = { messages: [], plan: null, checked: [], busy: false, draft: '' };
  if (!done) return toast('Nothing was added', true);
  if (focus) location.hash = `#/project/${focus}/${DB.events.some(e => e.projectId === focus) ? 3 : 1}`;
  commit(`Assistant added ${done} item${done > 1 ? 's' : ''}${skipped ? ` (${skipped} skipped)` : ''}`);
}

// ---------------------------------------------------------------- talking to the assistant
async function sendAgent(text) {
  text = text.trim();
  if (!text || ui.agent.busy) return;
  ui.agent.messages.push({ role: 'user', text });
  ui.agent.draft = '';
  ui.agent.busy = true;
  render();
  try {
    const r = await cloudCall({ action: 'agent', messages: ui.agent.messages.map(m => ({ role: m.role, text: m.text })), context: agentContext() });
    if (r.status === 401) throw new Error('Your secret key is no longer accepted. Reconnect in Settings.');
    if (r.error === 'NO_KEY') ui.agent.messages.push({ role: 'note', text: 'NO_KEY' });
    else if (r.error) ui.agent.messages.push({ role: 'note', text: r.error });
    else {
      const plan = { reply: r.plan.reply || '', questions: r.plan.questions || [], actions: (r.plan.actions || []).filter(a => A_ORDER.includes(a.type)) };
      const keys = planKeys(plan);
      plan.actions.forEach(a => { a._problem = checkAction(a, keys); });
      ui.agent.plan = plan;
      ui.agent.checked = plan.actions.map(a => !a._problem);
      ui.agent.messages.push({ role: 'model', text: JSON.stringify(r.plan), reply: plan.reply, questions: plan.questions });
    }
  } catch (err) {
    ui.agent.messages.push({ role: 'note', text: err.message && !err.message.startsWith('HTTP') && err.message !== 'Failed to fetch' ? err.message : 'Could not reach the assistant — check your internet connection.' });
  }
  ui.agent.busy = false;
  render();
}

const NO_KEY_HELP = `<b>One more step to switch the assistant on (free, about 3 minutes):</b>
  <ol class="steps">
    <li>Open <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">aistudio.google.com/app/apikey</a> with your Google account and click <b>Create API key</b>. No card is needed.</li>
    <li>Copy the key.</li>
    <li>In your Apps Script project, go to ⚙ <b>Project Settings</b> → <b>Script Properties</b> → <b>Add script property</b>. Set Property to <code>GEMINI_KEY</code> and Value to your key, then <b>Save</b>.</li>
    <li>Come back here and send your message again.</li>
  </ol>`;

VIEWS.assistant = () => {
  const ag = ui.agent;
  if (MODE !== 'cloud') {
    return `<header class="page-h"><div><h1>Assistant</h1></div></header>
      <section class="card">${empty('The assistant works in the online version of the CRM (GitHub Pages + your Google account).')}</section>`;
  }
  const plan = ag.plan;
  const keys = plan ? planKeys(plan) : {};
  const lastModel = [...ag.messages].reverse().find(m => m.role === 'model');
  const bubbles = ag.messages.map(m => {
    if (m.role === 'user') return `<div class="bubble me">${esc(m.text)}</div>`;
    if (m.role === 'note') return `<div class="bubble bot">${m.text === 'NO_KEY' ? NO_KEY_HELP : '⚠ ' + esc(m.text)}</div>`;
    return `<div class="bubble bot">${esc(m.reply)}${m === lastModel && m.questions?.length ? `<ul class="qs">${m.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ul><div class="muted small">Answer below and I'll update the plan.</div>` : ''}</div>`;
  }).join('');
  const chosen = plan ? plan.actions.filter((a, i) => ag.checked[i] && !a._problem).length : 0;
  return `
  <header class="page-h"><div><h1>Assistant</h1><p class="muted">Describe a booking, a change or a payment. I'll show you exactly what I'll add, and nothing is saved until you confirm.</p></div>
    ${ag.messages.length ? '<div class="actions"><button class="btn" data-act="agentReset">Start over</button></div>' : ''}</header>
  ${ag.messages.length ? `<section class="card chat">${bubbles}${ag.busy ? '<div class="bubble bot muted">Thinking…</div>' : ''}</section>` : ''}
  ${plan && plan.actions.length && !ag.busy ? `<section class="card">
    <div class="card-h"><h2>Ready to add</h2><span class="muted small">Untick anything that's wrong</span></div>
    ${plan.actions.map((a, i) => `<label class="plan-row ${a._problem ? 'bad' : ''}">
      <input type="checkbox" ${ag.checked[i] && !a._problem ? 'checked' : ''} ${a._problem ? 'disabled' : ''} data-act-change="agentCheck" data-i="${i}">
      <div class="grow">${describe(a, keys)}${a._problem ? `<div class="alert">⚠ ${esc(a._problem)} (answer below to fix)</div>` : ''}</div></label>`).join('')}
    <div class="actions" style="margin-top:14px"><button class="btn gold" data-act="agentApply" ${chosen ? '' : 'disabled'}>Confirm & add ${chosen} item${chosen === 1 ? '' : 's'}</button></div>
  </section>` : ''}
  <section class="card">
    <form id="agentForm">
      <div class="fld"><label for="agentText">${ag.messages.length ? 'Your reply' : 'What happened?'}</label>
        <textarea id="agentText" rows="4" placeholder="e.g. New booking: Ravi & Priya, reception 14 Dec 7pm at N Convention, candid photo + drone + LED screen, quote 3.5L, advance 1L by UPI">${esc(ag.draft)}</textarea></div>
      <div class="actions" style="margin-top:10px">
        <button class="btn gold" type="submit" ${ag.busy ? 'disabled' : ''}>${ag.busy ? 'Working…' : 'Send'}</button>
        ${window.SpeechRecognition || window.webkitSpeechRecognition ? '<button class="btn" type="button" data-act="agentMic">🎤 Speak</button>' : ''}
      </div>
    </form>
    ${ag.messages.length ? '' : `<div class="group-h">Try an example</div>${EXAMPLES.map((x, i) => `<button class="example" data-act="agentExample" data-i="${i}">${esc(x)}</button>`).join('')}`}
  </section>`;
};

function wireAssistant() {
  const form = $('#agentForm');
  if (!form) return;
  const ta = $('#agentText');
  ta.oninput = () => { ui.agent.draft = ta.value; };
  ta.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) form.requestSubmit(); };
  form.onsubmit = e => { e.preventDefault(); sendAgent(ta.value); };
  const chat = $('.chat');
  if (chat) chat.scrollTop = chat.scrollHeight;
}

Object.assign(ACTIONS, {
  agentReset: () => { ui.agent = { messages: [], plan: null, checked: [], busy: false, draft: '' }; render(); },
  agentApply: () => applyPlan(),
  agentExample: d => { ui.agent.draft = EXAMPLES[+d.i]; render(); $('#agentText')?.focus(); },
  agentMic: (d, e) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'en-IN';
    rec.interimResults = false;
    const btn = e.target.closest('button');
    btn.textContent = '🎤 Listening…';
    rec.onresult = ev => {
      const ta = $('#agentText');
      ta.value = (ta.value ? ta.value + ' ' : '') + ev.results[0][0].transcript;
      ui.agent.draft = ta.value;
    };
    rec.onend = () => { btn.textContent = '🎤 Speak'; };
    rec.onerror = () => toast('Could not hear you. Check microphone permission.', true);
    rec.start();
  },
});
Object.assign(CHANGES, {
  agentCheck: (d, el) => { ui.agent.checked[+d.i] = el.checked; render(); },
});
