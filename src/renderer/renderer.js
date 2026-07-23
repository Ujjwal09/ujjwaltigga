const TOTAL = 48;
const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

let viewDate = new Date(); viewDate.setHours(0, 0, 0, 0);
const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

let collapse = false;
const foldState = { past: false, future: false };
let doneSet = new Set();
let scrolled = false;

const grid = document.getElementById('grid');

const isToday = () => viewDate.getTime() === todayStart.getTime();
const isPastDay = () => viewDate.getTime() < todayStart.getTime();
function nowSlot() { const n = new Date(); return n.getHours() * 2 + (n.getMinutes() >= 30 ? 1 : 0); }

async function load() {
  doneSet = new Set(await window.tg.getDay(keyOf(viewDate)));
}
function save() {
  window.tg.setDay(keyOf(viewDate), [...doneSet].sort((a, b) => a - b));
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
    if (doneSet.has(i)) cc += ' done';
    if (cur) { if (i < ns) cc += ' past'; if (i === ns) cc += ' nowcell'; }
    else if (isPastDay()) cc += ' past';
    c.className = cc;
    c.dataset.m = i % 2 ? ':30' : ':00';
    c.onclick = () => { doneSet.has(i) ? doneSet.delete(i) : doneSet.add(i); save(); render(); };
    cells.appendChild(c);
  });
  return row;
}

function foldRow(label, hoursArr, key) {
  const done = hoursArr.reduce((n, h) => n + (doneSet.has(h * 2) ? 1 : 0) + (doneSet.has(h * 2 + 1) ? 1 : 0), 0);
  const total = hoursArr.length * 2;
  const el = document.createElement('div');
  el.className = 'fold';
  let mini = '';
  hoursArr.forEach(h => [h * 2, h * 2 + 1].forEach(i => mini += `<i class="${doneSet.has(i) ? 'on' : ''}"></i>`));
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

  document.getElementById('c-done').textContent = doneSet.size;
  document.getElementById('meter').style.width = (doneSet.size / TOTAL * 100) + '%';
  document.getElementById('pct').textContent = Math.round(doneSet.size / TOTAL * 100) + '%';
  document.getElementById('date').textContent =
    viewDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  document.getElementById('todayTag').style.display = isToday() ? '' : 'none';
  document.getElementById('next').disabled = isToday();

  if (cur && !scrolled) {
    const nEl = grid.querySelector('.now');
    if (nEl) { nEl.scrollIntoView({ block: 'center' }); scrolled = true; }
  }
}

// navigation
document.getElementById('prev').onclick = async () => { viewDate.setDate(viewDate.getDate() - 1); scrolled = false; await load(); render(); };
document.getElementById('next').onclick = async () => { if (isToday()) return; viewDate.setDate(viewDate.getDate() + 1); await load(); render(); };

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

(async () => { await load(); render(); })();
