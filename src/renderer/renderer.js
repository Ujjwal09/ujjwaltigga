const TOTAL = 48;
const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

let viewDate = new Date(); viewDate.setHours(0, 0, 0, 0);
const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

let collapse = false;
const foldState = { past: false, future: false };
let doneMap = {};                 // { slotIndex: "topic" }  — presence = utilised
let selected = null;              // currently selected slot index (for the learning box)
let scrolled = false;

const grid = document.getElementById('grid');
const input = document.getElementById('learn');
const btnOk = document.getElementById('confirm');
const btnNo = document.getElementById('cancel');
const selLabel = document.getElementById('selLabel');

const isToday = () => viewDate.getTime() === todayStart.getTime();
const isPastDay = () => viewDate.getTime() < todayStart.getTime();
const isDone = i => Object.prototype.hasOwnProperty.call(doneMap, i);
const savedTopic = i => (isDone(i) ? doneMap[i] : '');
const doneCount = () => Object.keys(doneMap).length;
const slotTime = i => `${pad(Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`;
function nowSlot() { const n = new Date(); return n.getHours() * 2 + (n.getMinutes() >= 30 ? 1 : 0); }

// Deterministic color per topic (stable across sessions). Empty topic -> null (use default teal).
function topicColor(topic) {
  if (!topic) return null;
  let h = 0;
  for (let i = 0; i < topic.length; i++) h = (h * 31 + topic.charCodeAt(i)) % 360;
  return `hsl(${h} 62% 58%)`;
}

async function load() {
  doneMap = { ...(await window.tg.getDay(keyOf(viewDate))) };
  selected = null;
}
function save() {
  window.tg.setDay(keyOf(viewDate), doneMap);
  refreshTopics();
}

function hourRow(h) {
  const a = h * 2, b = h * 2 + 1;
  const cur = isToday(), ns = nowSlot();
  const row = document.createElement('div');
  let cls = 'hour';
  if (cur && (a === ns || b === ns)) cls += ' now';
  else if ((cur && a < ns) || isPastDay()) cls += ' past';
  row.className = cls;
  row.innerHTML = `<span class="hr">${pad(h)}</span><div class="cells"></div>`;
  const cells = row.querySelector('.cells');
  [a, b].forEach(i => {
    const c = document.createElement('div');
    let cc = 'cell';
    if (isDone(i)) cc += ' done';
    if (isDone(i) && doneMap[i]) cc += ' tagged';
    if (cur) { if (i < ns) cc += ' past'; if (i === ns) cc += ' nowcell'; }
    else if (isPastDay()) cc += ' past';
    if (i === selected) cc += ' sel';
    c.className = cc;
    c.dataset.m = i % 2 ? ':30' : ':00';
    if (isDone(i)) {
      const col = topicColor(doneMap[i]);
      if (col) { c.style.background = col; c.style.borderColor = col; }
      c.title = slotTime(i) + (doneMap[i] ? ' · ' + doneMap[i] : '');
    }
    c.onclick = () => selectCell(i);
    cells.appendChild(c);
  });
  return row;
}

function foldRow(label, hoursArr, key) {
  const done = hoursArr.reduce((n, h) => n + (isDone(h * 2) ? 1 : 0) + (isDone(h * 2 + 1) ? 1 : 0), 0);
  const total = hoursArr.length * 2;
  const el = document.createElement('div');
  el.className = 'fold';
  let mini = '';
  hoursArr.forEach(h => [h * 2, h * 2 + 1].forEach(i => {
    const col = isDone(i) ? (topicColor(doneMap[i]) || 'var(--accent)') : '';
    mini += `<i class="${isDone(i) ? 'on' : ''}" ${col ? `style="background:${col}"` : ''}></i>`;
  }));
  el.innerHTML = `<span>${foldState[key] ? '▾' : '▸'} ${label}</span> · <b>${done}/${total}</b><div class="mini">${mini}</div>`;
  el.onclick = () => { foldState[key] = !foldState[key]; render(); };
  return el;
}

function render() {
  grid.innerHTML = '';
  const cur = isToday();
  const nowHour = Math.floor(nowSlot() / 2);

  if (collapse && cur) {
    const pastHours = [], futureHours = [];
    for (let h = 0; h < 24; h++) { if (h < nowHour) pastHours.push(h); else if (h > nowHour + 2) futureHours.push(h); }
    if (pastHours.length) {
      grid.appendChild(foldRow('Earlier today', pastHours, 'past'));
      if (foldState.past) pastHours.forEach(h => grid.appendChild(hourRow(h)));
    }
    for (let h = nowHour; h <= Math.min(23, nowHour + 2); h++) grid.appendChild(hourRow(h));
    if (futureHours.length) {
      grid.appendChild(foldRow('Later today', futureHours, 'future'));
      if (foldState.future) futureHours.forEach(h => grid.appendChild(hourRow(h)));
    }
  } else {
    for (let h = 0; h < 24; h++) grid.appendChild(hourRow(h));
  }

  const n = doneCount();
  document.getElementById('c-done').textContent = n;
  document.getElementById('meter').style.width = (n / TOTAL * 100) + '%';
  document.getElementById('pct').textContent = Math.round(n / TOTAL * 100) + '%';
  document.getElementById('date').textContent =
    viewDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  document.getElementById('todayTag').style.display = isToday() ? '' : 'none';
  document.getElementById('next').disabled = isToday();

  if (cur && !scrolled) {
    const nEl = grid.querySelector('.now');
    if (nEl) { nEl.scrollIntoView({ block: 'center' }); scrolled = true; }
  }

  sizeToContent();
}

// Shrink/grow the OS window to fit the panel's content (fixes empty frame on collapse).
function sizeToContent() {
  requestAnimationFrame(() => {
    const h = document.querySelector('.panel').offsetHeight;
    window.tg.resize(window.innerWidth, h);
  });
}

// ---------- learning box ----------
function selectCell(i) {
  // clicking an already-selected done cell clears it
  if (selected === i && isDone(i)) {
    delete doneMap[i]; save();
    selected = null; loadBox(); render(); return;
  }
  // clicking a not-yet-done cell marks it done (empty details) and selects it
  if (!isDone(i)) { doneMap[i] = ''; save(); }
  selected = i; loadBox(); render(); input.focus();
}

function loadBox() {
  if (selected === null) {
    input.value = ''; input.disabled = true;
    selLabel.textContent = '— select a cell —'; selLabel.classList.add('none');
  } else {
    input.disabled = false;
    input.value = savedTopic(selected);
    selLabel.textContent = slotTime(selected); selLabel.classList.remove('none');
  }
  updateButtons();
}

function updateButtons() {
  const changed = selected !== null && input.value.trim() !== savedTopic(selected);
  btnOk.classList.toggle('show', changed);
  btnNo.classList.toggle('show', changed);
  input.style.borderColor = changed ? 'var(--accent)' : 'var(--line)';
}

function confirmChange() {
  if (selected === null) return;
  doneMap[selected] = input.value.trim(); save();
  updateButtons(); render();
}
function cancelChange() {
  if (selected === null) return;
  input.value = savedTopic(selected); updateButtons();
}

input.addEventListener('input', updateButtons);
input.addEventListener('keydown', e => {
  if (e.key === 'Enter') confirmChange();
  if (e.key === 'Escape') cancelChange();
});
btnOk.onclick = confirmChange;
btnNo.onclick = cancelChange;

// Build the topic suggestion list from all history.
async function refreshTopics() {
  const all = await window.tg.getAll();
  const set = new Set();
  Object.values(all).forEach(day => Object.values(day).forEach(t => { if (t) set.add(t); }));
  document.getElementById('topics').innerHTML =
    [...set].sort().map(t => `<option value="${t.replace(/"/g, '&quot;')}"></option>`).join('');
}

// navigation
document.getElementById('prev').onclick = async () => { viewDate.setDate(viewDate.getDate() - 1); scrolled = false; await load(); loadBox(); render(); };
document.getElementById('next').onclick = async () => { if (isToday()) return; viewDate.setDate(viewDate.getDate() + 1); await load(); loadBox(); render(); };

// collapse toggle
document.querySelectorAll('#collapseSeg button').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('#collapseSeg button').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); collapse = b.dataset.v === '1'; render();
  };
});

// window controls
let pinned = true;
document.getElementById('pin').classList.add('on');
document.getElementById('pin').onclick = (e) => { pinned = !pinned; window.tg.toggleTop(pinned); e.currentTarget.classList.toggle('on', pinned); };
document.getElementById('min').onclick = () => window.tg.minimize();
document.getElementById('close').onclick = () => window.tg.close();
document.getElementById('statsBtn').onclick = () => window.tg.openDashboard();

// keep "now" marker fresh; re-render every minute if viewing today
setInterval(() => { if (isToday()) render(); }, 60 * 1000);

(async () => { await load(); await refreshTopics(); loadBox(); render(); })();
