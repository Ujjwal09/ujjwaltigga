const TOTAL = 48;
const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const el = id => document.getElementById(id);

function dayAgo(n) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d; }

const GOAL_TIERS = [10, 24, 50, 100];

function topicColor(topic) {
  if (!topic) return null;
  let h = 0;
  for (let i = 0; i < topic.length; i++) h = (h * 31 + topic.charCodeAt(i)) % 360;
  return `hsl(${h} 62% 58%)`;
}

(async () => {
  const all = await window.tg.getAll();
  const slotsOf = k => Object.keys(all[k] || {});
  const countOf = k => slotsOf(k).length;

  // ---- series: last 30 days (index 0 = today) ----
  const days30 = [];
  for (let i = 29; i >= 0; i--) { const d = dayAgo(i); days30.push({ d, key: keyOf(d), n: countOf(keyOf(d)) }); }

  const active = Object.keys(all).filter(k => countOf(k));
  el('sub').textContent = active.length
    ? `${active.length} day${active.length > 1 ? 's' : ''} tracked · earliest ${active.sort()[0]}`
    : 'No data yet — start ticking slots in the tracker.';

  // ---- KPIs ----
  const today = countOf(keyOf(dayAgo(0)));
  const last7 = [...Array(7)].map((_, i) => countOf(keyOf(dayAgo(i))));
  const avg7 = Math.round(last7.reduce((a, b) => a + b, 0) / 7);
  const avg30 = Math.round(days30.reduce((a, b) => a + b.n, 0) / 30);

  // current streak: consecutive days (ending today or yesterday) with any utilisation
  let streak = 0;
  for (let i = 0; i < 365; i++) { if (countOf(keyOf(dayAgo(i))) > 0) streak++; else if (i > 0) break; else break; }

  const pct = n => Math.round(n / TOTAL * 100);
  el('kpis').innerHTML = [
    ['Today', `${today}<small>/48 · ${pct(today)}%</small>`, true],
    ['7-day avg', `${avg7}<small>/48 · ${pct(avg7)}%</small>`, false],
    ['30-day avg', `${avg30}<small>/48 · ${pct(avg30)}%</small>`, false],
    ['Current streak', `${streak}<small> day${streak === 1 ? '' : 's'}</small>`, true],
  ].map(([l, v, a]) => `<div class="kpi"><div class="v ${a ? 'accent' : ''}">${v}</div><div class="l">${l}</div></div>`).join('');

  // ---- 30-day trend (SVG bars) ----
  el('trend').innerHTML = svgBars(days30.map(x => x.n), days30.map(x => x.d),
    (d, i) => (i % 5 === 0 || i === 29) ? `${d.getDate()}/${d.getMonth() + 1}` : '', TOTAL, true);

  // ---- hour-of-day pattern: how often each hour's 2 slots are done, across all data ----
  const hourHits = Array(24).fill(0);
  const dayN = active.length || 1;
  active.forEach(k => slotsOf(k).forEach(i => { hourHits[Math.floor(Number(i) / 2)]++; }));
  const hourPct = hourHits.map(h => h / (dayN * 2)); // 0..1
  el('hours').innerHTML = svgBars(hourPct, [...Array(24).keys()],
    (h) => h % 3 === 0 ? pad(h) : '', 1, false);

  // ---- topic goals: total hours per topic + progress to 10/24/50/100 ----
  renderGoals(all);

  // ---- consistency heatmap: last 5 weeks (7 rows Sun..Sat? use columns=weeks) ----
  renderHeat(all);
})();

// Aggregate hours per topic (0.5h per slot) and render progress toward goal tiers.
function renderGoals(all) {
  const hours = {}; // topic -> hours
  Object.values(all).forEach(day => Object.values(day).forEach(t => {
    const name = t || '(untagged)';
    hours[name] = (hours[name] || 0) + 0.5;
  }));
  const topics = Object.entries(hours).sort((a, b) => b[1] - a[1]);
  const host = document.getElementById('goals');
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

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Generic SVG bar chart. vals scaled to `max`. labelFn(item,i)->string for x-axis.
function svgBars(vals, items, labelFn, max, dimPast) {
  if (!vals.length) return '<div class="empty">No data</div>';
  const W = 560, H = 150, pb = 18, pl = 4;
  const n = vals.length, gap = 2;
  const bw = (W - pl) / n - gap;
  const chartH = H - pb;
  let bars = '', labels = '';
  vals.forEach((v, i) => {
    const h = max > 0 ? (v / max) * (chartH - 6) : 0;
    const x = pl + i * (bw + gap);
    const y = chartH - h;
    const dim = dimPast && i === n - 1 && v === 0;
    bars += `<rect class="bar ${dim ? 'dim' : ''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="2"></rect>`;
    const lab = labelFn(items[i], i);
    if (lab) labels += `<text class="axis" x="${(x + bw / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle">${lab}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}">${bars}${labels}</svg>`;
}

function renderHeat(all) {
  const weeks = 5;
  // build 7 rows (Mon..Sun) x `weeks` columns ending this week
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const monOffset = (today.getDay() + 6) % 7; // days since Monday
  const start = new Date(today); start.setDate(today.getDate() - monOffset - (weeks - 1) * 7);
  const shade = p => p === 0 ? 'rgba(255,255,255,0.05)'
    : `rgba(94,234,212,${(0.12 + p * 0.88).toFixed(2)})`;
  let cols = '';
  for (let w = 0; w < weeks; w++) {
    let cells = '';
    for (let dow = 0; dow < 7; dow++) {
      const d = new Date(start); d.setDate(start.getDate() + w * 7 + dow);
      const future = d > today;
      const n = Object.keys(all[keyOf(d)] || {}).length;
      const p = future ? -1 : n / 48;
      const bg = future ? 'transparent' : shade(p);
      const title = future ? '' : `${keyOf(d)} — ${n}/48`;
      cells += `<div class="cell" style="background:${bg}" title="${title}"></div>`;
    }
    cols += `<div class="col">${cells}</div>`;
  }
  document.getElementById('heat').innerHTML = `<div class="hm">${cols}</div>`;
}
