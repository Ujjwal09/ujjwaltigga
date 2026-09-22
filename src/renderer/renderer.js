const TOTAL = 48;
const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

let viewDate = new Date(); viewDate.setHours(0, 0, 0, 0);
const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

let collapse = false;
const expanded = new Set();        // ids of empty-hour groups the user expanded (collapse mode)
let doneMap = {};                  // { slotIndex: "specific topic" }  — actually done (utilised)
let planMap = {};                  // { slotIndex: "specific topic" }  — intended (planned)
let catMap = {};                   // { topic: category }  — remembered mapping (global)
let mode = 'track';                // 'track' | 'plan'
let selected = null;
let scrolled = false;
let dailyTarget = 8;               // hours/day; footer % is measured against this

const grid = document.getElementById('grid');
const catIn = document.getElementById('cat');
const input = document.getElementById('learn');
const btnOk = document.getElementById('confirm');
const btnNo = document.getElementById('cancel');
const selLabel = document.getElementById('selLabel');
const boxLbl = document.getElementById('boxLbl');
const swatch = document.getElementById('swatch');
const mTrack = document.getElementById('mTrack');
const mPlan = document.getElementById('mPlan');

const isToday = () => viewDate.getTime() === todayStart.getTime();
const isFuture = () => viewDate.getTime() > todayStart.getTime();
const isPastDay = () => viewDate.getTime() < todayStart.getTime();
const slotTime = i => `${pad(Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`;
function nowSlot() { const n = new Date(); return n.getHours() * 2 + (n.getMinutes() >= 30 ? 1 : 0); }
const store = () => (mode === 'plan' ? planMap : doneMap);
const has = (map, i) => Object.prototype.hasOwnProperty.call(map, i);

// Category of a stored value: remembered mapping, else the value itself.
const catOf = v => (v ? (catMap[v] || v) : '');
// Deterministic colour per category.
function catColor(cat) {
  if (!cat) return null;
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) % 360;
  return `hsl(${h} 62% 58%)`;
}

async function load() {
  doneMap = { ...(await window.tg.getDay(keyOf(viewDate))) };
  planMap = { ...(await window.tg.getPlan(keyOf(viewDate))) };
  selected = null;
}
function saveCurrent() {
  if (mode === 'plan') window.tg.setPlan(keyOf(viewDate), planMap);
  else window.tg.setDay(keyOf(viewDate), doneMap);
}
function saveCat() { window.tg.setCatMap(catMap); refreshLists(); }

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
    const dv = doneMap[i], pv = planMap[i];
    const done = has(doneMap, i), planned = has(planMap, i);
    let cc = 'cell';
    if (done) { cc += ' done'; if (dv && dv !== catOf(dv)) cc += ' tagged'; }
    else if (planned) cc += ' planned';
    if (cur) { if (i < ns) cc += ' past'; if (i === ns) cc += ' nowcell'; }
    else if (isPastDay()) cc += ' past';
    if (i === selected) cc += ' sel';
    c.className = cc;
    c.dataset.m = i % 2 ? ':30' : ':00';
    if (done) {
      const col = catColor(catOf(dv));
      if (col) { c.style.background = col; c.style.borderColor = col; }
      c.title = slotTime(i) + ' · ' + (catOf(dv) || '—') + (dv && dv !== catOf(dv) ? ' — ' + dv : '') + (planned ? '  (planned)' : '');
    } else if (planned) {
      const col = catColor(catOf(pv)) || '#f0c274';
      c.style.color = col; c.style.borderColor = col;
      c.title = slotTime(i) + ' · plan: ' + (catOf(pv) || '(tbd)') + (pv && pv !== catOf(pv) ? ' — ' + pv : '');
    }
    c.onclick = () => clickCell(i);
    cells.appendChild(c);
  });
  return row;
}

const hourHasData = h => has(doneMap, h * 2) || has(doneMap, h * 2 + 1) || has(planMap, h * 2) || has(planMap, h * 2 + 1);

// A fold row standing in for a run of empty hours [start..end); click to expand/collapse it.
function emptyFoldRow(hoursArr, id) {
  const open = expanded.has(id);
  const from = `${pad(hoursArr[0])}:00`;
  const to = `${pad(hoursArr[hoursArr.length - 1])}:30`;
  const el = document.createElement('div');
  el.className = 'fold';
  el.innerHTML = `<span>${open ? '▾' : '▸'} ${hoursArr.length} empty hour${hoursArr.length > 1 ? 's' : ''}</span>` +
    `<div class="mini" style="color:var(--faint);justify-content:flex-end">${from}–${to}</div>`;
  el.onclick = () => { open ? expanded.delete(id) : expanded.add(id); render(); };
  return el;
}

function render() {
  grid.innerHTML = '';
  const cur = isToday();
  const nowHour = Math.floor(nowSlot() / 2);

  if (collapse) {
    const isShown = h => hourHasData(h) || (cur && h === nowHour);
    let h = 0;
    while (h < 24) {
      if (isShown(h)) { grid.appendChild(hourRow(h)); h++; continue; }
      let j = h;
      while (j < 24 && !isShown(j)) j++;
      const hoursArr = [];
      for (let k = h; k < j; k++) hoursArr.push(k);
      const id = 'g' + h;
      grid.appendChild(emptyFoldRow(hoursArr, id));
      if (expanded.has(id)) hoursArr.forEach(k => grid.appendChild(hourRow(k)));
      h = j;
    }
  } else {
    for (let h = 0; h < 24; h++) grid.appendChild(hourRow(h));
  }

  const n = Object.keys(doneMap).length;
  const hours = n / 2;
  const targetPct = Math.round(hours / dailyTarget * 100);
  document.getElementById('c-done').textContent = hours;
  document.getElementById('meter').style.width = (n / TOTAL * 100) + '%';
  document.getElementById('pct').innerHTML = `${targetPct}% <span class="of">of ${dailyTarget}h</span>`;
  document.getElementById('date').textContent =
    viewDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const tag = document.getElementById('todayTag');
  const dayDiff = Math.round((viewDate - todayStart) / 86400000);
  tag.textContent = isToday() ? 'today' : dayDiff === 1 ? 'tomorrow' : isFuture() ? 'future' : '';
  tag.classList.toggle('future', isFuture());
  tag.style.display = (isToday() || isFuture()) ? '' : 'none';
  const plannedOnly = Object.keys(planMap).filter(i => !has(doneMap, i)).length;
  document.getElementById('planct').textContent = plannedOnly ? `${plannedOnly} planned` : '';

  if (cur && !scrolled) {
    const nEl = grid.querySelector('.now');
    if (nEl) { nEl.scrollIntoView({ block: 'center' }); scrolled = true; }
  }

  sizeToContent();
}

function sizeToContent() {
  requestAnimationFrame(() => {
    const h = document.querySelector('.panel').offsetHeight;
    window.tg.resize(window.innerWidth, h);
  });
}

// ---------- learning / planning box ----------
function clickCell(i) {
  const S = store();
  // clicking an already-selected filled cell (in the current layer) clears it
  if (selected === i && has(S, i)) {
    delete S[i]; saveCurrent();
    selected = null; loadBox(); render(); return;
  }
  if (!has(S, i)) S[i] = mode === 'plan' ? '' : (planMap[i] || '');  // track: fill, pulling from plan if present
  if (mode === 'track' && has(S, i)) saveCurrent();                   // persist the fill immediately
  selected = i; loadBox(); render(); (catIn.value ? input : catIn).focus();
}

function savedPair(i) {
  const v = store()[i];
  const c = catOf(v || '');
  return { cat: c, detail: (v && v !== c) ? v : '' };
}

function loadBox() {
  boxLbl.textContent = mode === 'plan' ? 'Planning' : 'Learning';
  boxLbl.classList.toggle('plan', mode === 'plan');
  if (selected === null) {
    catIn.value = ''; input.value = ''; catIn.disabled = input.disabled = true;
    selLabel.textContent = '— select a cell —'; selLabel.classList.add('none');
    swatch.style.background = 'var(--faint)';
  } else {
    catIn.disabled = input.disabled = false;
    const s = savedPair(selected);
    catIn.value = s.cat; input.value = s.detail;
    selLabel.textContent = slotTime(selected); selLabel.classList.remove('none');
  }
  updateButtons();
}

function updateButtons() {
  let changed = false;
  if (selected !== null) {
    const s = savedPair(selected);
    changed = catIn.value.trim() !== s.cat || input.value.trim() !== s.detail;
  }
  btnOk.classList.toggle('show', changed);
  btnNo.classList.toggle('show', changed);
  swatch.style.background = catColor(catIn.value.trim()) || 'var(--faint)';
  const col = changed ? (mode === 'plan' ? '#f0c274' : 'var(--accent)') : 'var(--line)';
  catIn.style.borderColor = col; input.style.borderColor = col;
}

function confirmChange() {
  if (selected === null) return;
  const cat = catIn.value.trim(), detail = input.value.trim();
  const val = detail || cat;               // stored value = specific topic, else the category
  store()[selected] = val;
  if (val) catMap[val] = cat || val;       // remember its category
  if (detail && cat) catMap[detail] = cat;
  saveCurrent(); saveCat();
  updateButtons(); render();
}
function cancelChange() {
  if (selected === null) return;
  const s = savedPair(selected); catIn.value = s.cat; input.value = s.detail; updateButtons();
}

// typing a known specific topic auto-fills its remembered category
input.addEventListener('input', () => {
  const d = input.value.trim();
  if (d && catMap[d] && !catIn.value.trim()) catIn.value = catMap[d];
  updateButtons();
});
catIn.addEventListener('input', updateButtons);
[catIn, input].forEach(el => el.addEventListener('keydown', e => {
  if (e.key === 'Enter') confirmChange();
  if (e.key === 'Escape') cancelChange();
}));
btnOk.onclick = confirmChange;
btnNo.onclick = cancelChange;

// Build the category + topic suggestion lists from the remembered map.
function refreshLists() {
  const cats = new Set(Object.values(catMap)), tops = new Set(Object.keys(catMap));
  document.getElementById('cats').innerHTML =
    [...cats].filter(Boolean).sort().map(t => `<option value="${t.replace(/"/g, '&quot;')}"></option>`).join('');
  document.getElementById('topics').innerHTML =
    [...tops].filter(Boolean).sort().map(t => `<option value="${t.replace(/"/g, '&quot;')}"></option>`).join('');
}

// ---------- mode + navigation ----------
function setMode(m) {
  mode = m;
  mTrack.classList.toggle('on', m === 'track');
  mPlan.classList.toggle('on', m === 'plan');
  mPlan.classList.toggle('planon', m === 'plan');
  loadBox();
}
function applyModeForDate() {
  if (isFuture()) { setMode('plan'); mTrack.disabled = true; }
  else { mTrack.disabled = false; setMode(mode); }
}
mTrack.onclick = () => { if (mTrack.disabled) return; selected = null; setMode('track'); render(); };
mPlan.onclick = () => { selected = null; setMode('plan'); render(); };

document.getElementById('prev').onclick = async () => { viewDate.setDate(viewDate.getDate() - 1); scrolled = false; await load(); applyModeForDate(); render(); };
document.getElementById('next').onclick = async () => { viewDate.setDate(viewDate.getDate() + 1); scrolled = false; await load(); applyModeForDate(); render(); };

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

// pick up a target change made in the dashboard when the tracker is focused again
window.addEventListener('focus', async () => {
  const s = await window.tg.getSettings();
  if (s && s.target && s.target !== dailyTarget) { dailyTarget = s.target; render(); }
});

(async () => {
  const settings = await window.tg.getSettings();
  if (settings && settings.target) dailyTarget = settings.target;
  catMap = { ...(await window.tg.getCatMap()) };
  await load(); applyModeForDate(); refreshLists(); loadBox(); render();
})();
