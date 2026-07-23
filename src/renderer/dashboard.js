const TOTAL = 48;
const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const el = id => document.getElementById(id);

function dayAgo(n) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d; }

(async () => {
  const all = await window.tg.getAll();
  const countOf = k => (all[k] || []).length;

  // ---- series: last 30 days (index 0 = today) ----
  const days30 = [];
  for (let i = 29; i >= 0; i--) { const d = dayAgo(i); days30.push({ d, key: keyOf(d), n: countOf(keyOf(d)) }); }

  const active = Object.keys(all).filter(k => all[k].length);
  el('sub').textContent = active.length
    ? `${active.length} day${active.length > 1 ? 's' : ''} tracked · earliest ${active.sort()[0]}`
    : 'No data yet — start ticking slots in the tracker.';

  // ---- KPIs ----
  const today = countOf(keyOf(dayAgo(0)));
  const last7 = [...Array(7)].map((_, i) => countOf(keyOf(dayAgo(i))));
  const avg7 = Math.round(last7.reduce((a, b) => a + b, 0) / 7);
  const avg30 = Math.round(days30.reduce((a, b) => a + b.n, 0) / 30);
  const best = Math.max(0, ...Object.values(all).map(v => v.length));

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
  active.forEach(k => all[k].forEach(i => { hourHits[Math.floor(i / 2)]++; }));
  const hourPct = hourHits.map(h => h / (dayN * 2)); // 0..1
  el('hours').innerHTML = svgBars(hourPct, [...Array(24).keys()],
    (h) => h % 3 === 0 ? pad(h) : '', 1, false);

  // ---- consistency heatmap: last 5 weeks (7 rows Sun..Sat? use columns=weeks) ----
  renderHeat(all);
})();

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
      const p = future ? -1 : (all[keyOf(d)] || []).length / 48;
      const bg = future ? 'transparent' : shade(p);
      const title = future ? '' : `${keyOf(d)} — ${(all[keyOf(d)] || []).length}/48`;
      cells += `<div class="cell" style="background:${bg}" title="${title}"></div>`;
    }
    cols += `<div class="col">${cells}</div>`;
  }
  document.getElementById('heat').innerHTML = `<div class="hm">${cols}</div>`;
}
