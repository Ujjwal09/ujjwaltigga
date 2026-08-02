const TOTAL = 48;
const DAY = 86400000;
const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const el = id => document.getElementById(id);

function dayAgo(n) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d; }
const fmtDate = t => { const d = new Date(t); return `${pad(d.getDate())} ${d.toLocaleString('en-GB', { month: 'short' })}`; };
const daysBetween = (a, b) => Math.max(0, Math.floor((b - a) / DAY));

const GOAL_TIERS = [10, 24, 50, 100];

function topicColor(topic) {
  if (!topic) return null;
  let h = 0;
  for (let i = 0; i < topic.length; i++) h = (h * 31 + topic.charCodeAt(i)) % 360;
  return `hsl(${h} 62% 58%)`;
}
function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

let target = 8;
let goalsView = 'D';
let goalDates = [];          // Date (midnight) per column, earliest..today
let goalSeries = [];         // [{ name, color, cum: [] }]

(async () => {
  const all = await window.tg.getAll();
  const settings = await window.tg.getSettings();
  target = settings && settings.target ? settings.target : 8;

  const slotsOf = k => Object.keys(all[k] || {});
  const countOf = k => slotsOf(k).length;

  // ---- series: last 30 days (index 0 = today) ----
  const days30 = [];
  for (let i = 29; i >= 0; i--) { const d = dayAgo(i); days30.push({ d, key: keyOf(d), n: countOf(keyOf(d)) }); }

  const active = Object.keys(all).filter(k => countOf(k));
  el('sub').textContent = active.length
    ? `${active.length} day${active.length > 1 ? 's' : ''} tracked · earliest ${active.sort()[0]}`
    : 'No data yet — start ticking slots in the tracker.';

  // ---- target box ----
  const targetEl = el('target');
  targetEl.value = target;
  targetEl.addEventListener('input', () => {
    target = Math.max(0.5, parseFloat(targetEl.value) || 8);
    window.tg.setSetting('target', target);
    renderKpis();
  });

  // ---- KPIs (percentages vs daily target) ----
  const hrs = n => n / 2;                          // slots -> hours
  const todaySlots = countOf(keyOf(dayAgo(0)));
  const last7 = [...Array(7)].map((_, i) => countOf(keyOf(dayAgo(i))));
  const avg7 = last7.reduce((a, b) => a + b, 0) / 7;
  let streak = 0;
  for (let i = 0; i < 365; i++) { if (countOf(keyOf(dayAgo(i))) > 0) streak++; else break; }
  const hitDays = active.filter(k => hrs(countOf(k)) >= target).length;

  window.renderKpis = function renderKpis() {
    const pct = h => Math.round(h / target * 100);
    el('kpis').innerHTML = [
      ['Today', `${hrs(todaySlots)}<small> / ${target}h · ${pct(hrs(todaySlots))}%</small>`, true],
      ['7-day avg', `${(+hrs(avg7).toFixed(1))}<small> / ${target}h · ${pct(hrs(avg7))}%</small>`, false],
      ['Target hit', `${hitDays}<small> / ${active.length || 0} days</small>`, true],
      ['Current streak', `${streak}<small> day${streak === 1 ? '' : 's'}</small>`, false],
    ].map(([l, v, a]) => `<div class="kpi"><div class="v ${a ? 'accent' : ''}">${v}</div><div class="l">${l}</div></div>`).join('');
  };
  renderKpis();

  // ---- 30-day trend ----
  el('trend').innerHTML = svgBars(days30.map(x => x.n), days30.map(x => x.d),
    (d, i) => (i % 5 === 0 || i === 29) ? `${d.getDate()}/${d.getMonth() + 1}` : '', TOTAL, true,
    v => v ? v / 2 : '');

  // ---- hour-of-day pattern ----
  const hourHits = Array(24).fill(0);
  const dayN = active.length || 1;
  active.forEach(k => slotsOf(k).forEach(i => { hourHits[Math.floor(Number(i) / 2)]++; }));
  el('hours').innerHTML = svgBars(hourHits.map(h => h / (dayN * 2)), [...Array(24).keys()],
    (h) => h % 3 === 0 ? pad(h) : '', 1, false);

  // ---- topic goals: completion bars (aggregate) ----
  renderGoalsBars(all);

  // ---- build cumulative topic series over full history + trend chart ----
  buildGoalSeries(all, active);
  renderGoals();

  // ---- consistency heatmap ----
  renderHeat(all);

  // ---- tasks ----
  const tasks = await window.tg.getTasks();
  initTasks(tasks);
})();

// Build goalDates + goalSeries (cumulative hours per named topic) over earliest..today.
function buildGoalSeries(all, active) {
  const names = new Set();
  Object.values(all).forEach(day => Object.values(day).forEach(t => { if (t) names.add(t); }));
  if (!active.length || !names.size) { goalDates = []; goalSeries = []; return; }

  const earliest = new Date(active.slice().sort()[0] + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  goalDates = [];
  for (let t = earliest.getTime(); t <= today.getTime(); t += DAY) goalDates.push(new Date(t));

  goalSeries = [...names].map(name => {
    let acc = 0;
    const cum = goalDates.map(d => {
      const day = all[keyOf(d)] || {};
      const hrs = Object.values(day).filter(tp => tp === name).length * 0.5;
      acc += hrs;
      return acc;
    });
    return { name, color: topicColor(name), cum };
  }).sort((a, b) => b.cum[b.cum.length - 1] - a.cum[a.cum.length - 1]);
}

// Aggregate hours per topic (0.5h per slot) + progress bars toward goal tiers.
function renderGoalsBars(all) {
  const hours = {};
  Object.values(all).forEach(day => Object.values(day).forEach(t => {
    const name = t || '(untagged)';
    hours[name] = (hours[name] || 0) + 0.5;
  }));
  const topics = Object.entries(hours).sort((a, b) => b[1] - a[1]);
  const host = el('goals');
  if (!topics.length) { host.innerHTML = '<div class="empty">No topics yet — set a topic in the tracker, then tick slots.</div>'; return; }

  const maxTier = GOAL_TIERS[GOAL_TIERS.length - 1];
  host.innerHTML = topics.map(([name, h]) => {
    const col = topicColor(name === '(untagged)' ? '' : name) || 'var(--accent)';
    const next = GOAL_TIERS.find(t => h < t);
    const tierLabel = next ? `${h} / ${next} h` : `${h} h — 100h reached 🎉`;
    const width = Math.min(100, h / maxTier * 100);
    const ticks = GOAL_TIERS.map(t =>
      `<span class="${h >= t ? 'hit' : ''}" style="left:${t / maxTier * 100}%">${t}h</span>`).join('');
    return `<div class="goal">
      <div class="top">
        <span class="swatch" style="background:${col}"></span>
        <span class="name">${escapeHtml(name)}</span>
        <span class="hrs"><b>${h}</b> h</span>
        <span class="tier">${tierLabel}</span>
      </div>
      <div class="track"><i style="width:${width}%;background:${col}"></i></div>
      <div class="ticks">${ticks}</div>
    </div>`;
  }).join('');
}

function weekEndIdx(N) { const a = []; for (let i = 0; i < N; i++) if ((i + 1) % 7 === 0) a.push(i); if (N && a[a.length - 1] !== N - 1) a.push(N - 1); return a; }
function monthEndIdx(N) { const a = []; for (let i = 0; i < N; i++) { const cur = goalDates[i].getMonth(); const nxt = i < N - 1 ? goalDates[i + 1].getMonth() : null; if (i === N - 1 || cur !== nxt) a.push(i); } return a; }

function renderGoals() {
  const host = el('goalsChart'), legend = el('goalsLegend');
  const N = goalDates.length;
  if (!N) { host.innerHTML = '<div class="empty">No topics yet — set a topic in the tracker, then tick slots.</div>'; legend.innerHTML = ''; return; }

  const W = 880, H = 280, pl = 34, pr = 48, pt = 18, pb = 24;
  const plotW = W - pl - pr, plotH = H - pt - pb;
  // Adaptive ceiling: step up 10 -> 24 -> 50 -> 100 as the furthest topic climbs.
  const maxCum = Math.max(...goalSeries.map(s => s.cum[N - 1]));
  const maxY = GOAL_TIERS.find(t => t >= maxCum) || Math.max(100, Math.ceil(maxCum / 25) * 25);
  const x = i => pl + (N === 1 ? plotW / 2 : (i / (N - 1)) * plotW);
  const y = v => pt + plotH - (v / maxY) * plotH;

  let vertexIdx, markerIdx;
  if (goalsView === 'D') { vertexIdx = [...Array(N).keys()]; markerIdx = weekEndIdx(N); }
  else if (goalsView === 'W') { vertexIdx = weekEndIdx(N); markerIdx = vertexIdx; }
  else { vertexIdx = monthEndIdx(N); markerIdx = vertexIdx; }

  let grid = '';
  GOAL_TIERS.forEach(t => {
    if (t > maxY) return;
    const yy = y(t);
    grid += `<line x1="${pl}" y1="${yy}" x2="${pl + plotW}" y2="${yy}" stroke="rgba(255,255,255,0.09)" stroke-dasharray="3 4"/>`;
    grid += `<text x="${pl + plotW + 6}" y="${yy + 3}" fill="var(--faint)" font-size="10">${t}h</text>`;
  });
  let xlab = '';
  markerIdx.forEach(i => xlab += `<text x="${x(i)}" y="${H - 6}" fill="var(--faint)" font-size="9" text-anchor="middle">${fmtDate(goalDates[i])}</text>`);

  let lines = '', dots = '', vlabels = '';
  goalSeries.forEach(s => {
    const pts = vertexIdx.map(i => `${x(i).toFixed(1)},${y(s.cum[i]).toFixed(1)}`).join(' ');
    lines += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"/>`;
    markerIdx.forEach(i => {
      const px = x(i), py = y(s.cum[i]);
      dots += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3" fill="${s.color}"/>`;
      vlabels += `<text x="${px.toFixed(1)}" y="${(py - 7).toFixed(1)}" fill="${s.color}" font-size="9" font-weight="600" text-anchor="middle">${(+s.cum[i].toFixed(1))}</text>`;
    });
  });

  const guide = `<line id="hoverGuide" x1="0" x2="0" y1="${pt}" y2="${pt + plotH}" stroke="rgba(255,255,255,0.28)" stroke-width="1" style="display:none"/>`;
  const hoverDots = goalSeries.map((s, si) => `<circle id="hd${si}" r="4.5" fill="${s.color}" stroke="#14151a" stroke-width="1.5" style="display:none"/>`).join('');
  const hit = `<rect id="hoverHit" x="${pl}" y="${pt}" width="${plotW}" height="${plotH}" fill="transparent"/>`;

  host.style.position = 'relative';
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}">${grid}${lines}${dots}${vlabels}${xlab}${guide}${hoverDots}${hit}</svg><div class="charttip" id="charttip" style="display:none"></div>`;

  legend.innerHTML = goalSeries.map(s => {
    const cur = s.cum[N - 1], next = GOAL_TIERS.find(t => cur < t);
    return `<span class="it"><span class="sw" style="background:${s.color}"></span>${escapeHtml(s.name)} · <b>${+cur.toFixed(1)}h</b>${next ? ` → ${next}h` : ' · 100h ✓'}</span>`;
  }).join('');

  // ---- interactivity: hover guide + tooltip ----
  const svg = host.querySelector('svg');
  const tip = el('charttip');
  const guideEl = svg.querySelector('#hoverGuide');
  const move = e => {
    const rect = svg.getBoundingClientRect();
    const vbX = (e.clientX - rect.left) / rect.width * W;
    let i = N === 1 ? 0 : Math.round((vbX - pl) / plotW * (N - 1));
    i = Math.max(0, Math.min(N - 1, i));
    const gx = x(i);
    const vbY = (e.clientY - rect.top) / rect.height * H;

    // pick the single nearest topic line at this x
    let near = 0, best = Infinity;
    goalSeries.forEach((s, si) => {
      const d = Math.abs(y(s.cum[i]) - vbY);
      if (d < best) { best = d; near = si; }
    });
    const s = goalSeries[near];
    const py = y(s.cum[i]);

    guideEl.setAttribute('x1', gx); guideEl.setAttribute('x2', gx); guideEl.style.display = '';
    goalSeries.forEach((_, si) => {
      const dot = svg.querySelector('#hd' + si);
      if (si === near) { dot.setAttribute('cx', gx); dot.setAttribute('cy', py); dot.style.display = ''; }
      else dot.style.display = 'none';
    });

    tip.innerHTML = `<div class="tdate">${fmtDate(goalDates[i])}</div>` +
      `<div class="trow"><span class="sw" style="background:${s.color}"></span>${escapeHtml(s.name)}<b>${+s.cum[i].toFixed(1)}h</b></div>`;
    tip.style.display = '';
    tip.style.left = (gx / W * rect.width) + 'px';
    tip.style.top = (py / H * rect.height) + 'px';
  };
  const leave = () => {
    guideEl.style.display = 'none';
    tip.style.display = 'none';
    goalSeries.forEach((_, si) => { svg.querySelector('#hd' + si).style.display = 'none'; });
  };
  svg.addEventListener('mousemove', move);
  svg.addEventListener('mouseleave', leave);
}
document.querySelectorAll('#viewSeg button').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('#viewSeg button').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); goalsView = b.dataset.v; renderGoals();
  };
});

// ---- tasks ----
function initTasks(loaded) {
  let tasks = Array.isArray(loaded) ? loaded : [];
  let showCompleted = false;
  const saveTasks = () => window.tg.setTasks(tasks);

  function render() {
    const now = Date.now();
    const activeT = tasks.filter(t => !t.done);
    const doneT = tasks.filter(t => t.done);

    el('activeRows').innerHTML = activeT.map(t => {
      const age = daysBetween(t.start, now);
      return `<tr data-id="${t.id}">
        <td class="c"><span class="chk" data-id="${t.id}"></span></td>
        <td class="tname">${escapeHtml(t.name)}</td>
        <td class="d">${fmtDate(t.start)}</td>
        <td class="o"><span class="agebadge ${age >= 7 ? 'warn' : ''}">${age}d</span></td>
      </tr>`;
    }).join('');
    el('activeEmpty').style.display = activeT.length ? 'none' : '';

    el('doneCount').textContent = doneT.length;
    el('completedHdr').firstChild.textContent = (showCompleted ? '▾ ' : '▸ ') + 'Completed (';
    el('completedTable').style.display = (showCompleted && doneT.length) ? '' : 'none';
    el('completedRows').innerHTML = doneT.map(t => `<tr class="done" data-id="${t.id}">
        <td class="c"><span class="chk on" data-id="${t.id}"></span></td>
        <td class="tname">${escapeHtml(t.name)}</td>
        <td class="d">${fmtDate(t.doneAt)}</td>
        <td class="o">${daysBetween(t.start, t.doneAt)}d</td>
      </tr>`).join('');

    document.querySelectorAll('.chk').forEach(c => {
      c.onclick = () => {
        const t = tasks.find(x => x.id === c.dataset.id); if (!t) return;
        t.done = !t.done; t.doneAt = t.done ? Date.now() : null; saveTasks(); render();
      };
    });
  }
  function addTask() {
    const inp = el('taskInput'); const name = inp.value.trim(); if (!name) return;
    tasks.push({ id: Date.now() + '' + Math.random().toString(36).slice(2, 5), name, start: Date.now(), done: false, doneAt: null });
    inp.value = ''; saveTasks(); render();
  }
  el('addTask').onclick = addTask;
  el('taskInput').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
  el('completedHdr').onclick = () => { showCompleted = !showCompleted; render(); };
  render();
}

// Generic SVG bar chart. vals scaled to `max`. labelFn(item,i)->string for x-axis.
// valFmt(v,i)->string (optional) prints an absolute value above each bar.
function svgBars(vals, items, labelFn, max, dimPast, valFmt) {
  if (!vals.length) return '<div class="empty">No data</div>';
  const W = 560, H = 150, pb = 18, pt = 10, pl = 4;
  const n = vals.length, gap = 2;
  const bw = (W - pl) / n - gap;
  const chartH = H - pb;
  let bars = '', labels = '', vlabels = '';
  vals.forEach((v, i) => {
    const h = max > 0 ? (v / max) * (chartH - pt) : 0;
    const x = pl + i * (bw + gap);
    const y = chartH - h;
    const dim = dimPast && i === n - 1 && v === 0;
    bars += `<rect class="bar ${dim ? 'dim' : ''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="2"></rect>`;
    const lab = labelFn(items[i], i);
    if (lab) labels += `<text class="axis" x="${(x + bw / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle">${lab}</text>`;
    if (valFmt) {
      const vl = valFmt(v, i);
      if (vl !== '') vlabels += `<text class="vlabel" x="${(x + bw / 2).toFixed(1)}" y="${(y - 2.5).toFixed(1)}" text-anchor="middle">${vl}</text>`;
    }
  });
  return `<svg viewBox="0 0 ${W} ${H}">${bars}${labels}${vlabels}</svg>`;
}

function renderHeat(all) {
  const weeks = 5;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const monOffset = (today.getDay() + 6) % 7;
  const start = new Date(today); start.setDate(today.getDate() - monOffset - (weeks - 1) * 7);
  const shade = p => p === 0 ? 'rgba(255,255,255,0.05)' : `rgba(94,234,212,${(0.12 + p * 0.88).toFixed(2)})`;
  let cols = '';
  for (let w = 0; w < weeks; w++) {
    let cells = '';
    for (let dow = 0; dow < 7; dow++) {
      const d = new Date(start); d.setDate(start.getDate() + w * 7 + dow);
      const future = d > today;
      const n = Object.keys(all[keyOf(d)] || {}).length;
      const p = future ? -1 : n / 48;
      const bg = future ? 'transparent' : shade(p);
      const title = future ? '' : `${keyOf(d)} — ${n / 2} h`;
      cells += `<div class="cell" style="background:${bg}" title="${title}"></div>`;
    }
    cols += `<div class="col">${cells}</div>`;
  }
  el('heat').innerHTML = `<div class="hm">${cols}</div>`;
}
