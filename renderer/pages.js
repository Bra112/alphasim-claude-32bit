// Journal pages: dashboard, trade log, trade details, reports, calendar, playbook, notebook.
const P = { all: [], trades: [], meta: {}, plays: [], notes: [], sims: [], cal: new Date(), calSet: false, sel: null, nf: 'All notes', nid: null };
const F = { from: '', to: '', sym: '', strat: '', sess: '' };
const sum = (a) => a.reduce((x, t) => x + t.pnl, 0), esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dstr = (ms) => new Date(ms).toISOString().slice(0, 10), fmtD = (ms) => new Date(ms).toISOString().replace('T', ' ').slice(0, 16), pf = (v) => (isFinite(v) ? v.toFixed(2) : '∞');
const csv = (rows) => rows.map((r) => r.map((v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');
const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
function stats(a) {
  const w = a.filter((t) => t.pnl > 0), l = a.filter((t) => t.pnl < 0), gp = sum(w), gl = -sum(l); let c = 0, pk = 0, dd = 0;
  [...a].sort((x, y) => x.closed - y.closed).forEach((t) => { c += t.pnl; pk = Math.max(pk, c); dd = Math.max(dd, pk - c); }); const rs = a.filter((t) => t.r != null);
  return { n: a.length, net: sum(a), wins: w.length, losses: l.length, wr: a.length ? (w.length / a.length) * 100 : 0, gp, gl, pf: gl ? gp / gl : gp ? Infinity : 0, avgW: w.length ? gp / w.length : 0, avgL: l.length ? gl / l.length : 0,
    maxW: Math.max(0, ...a.map((t) => t.pnl)), maxL: Math.min(0, ...a.map((t) => t.pnl)), exp: a.length ? sum(a) / a.length : 0, dd, avgR: rs.length ? rs.reduce((x, t) => x + t.r, 0) / rs.length : 0 };
}
const donut = (pct, col = '#20a67a', txt) => `<svg viewBox="0 0 42 42" class="donut"><circle cx="21" cy="21" r="15.9" fill="none" style="stroke:var(--soft)" stroke-width="4"/><circle cx="21" cy="21" r="15.9" fill="none" stroke="${col}" stroke-width="4" stroke-dasharray="${Math.min(100, pct)} 100" transform="rotate(-90 21 21)"/><text x="21" y="24" text-anchor="middle" font-size="8">${txt ?? Math.round(pct) + '%'}</text></svg>`;
function area(el, vals) {
  if (vals.length < 2) { el.innerHTML = '<div class="empty">No trades yet. Run a backtest and save the session.</div>'; return; }
  const W = 600, H = 220, pad = 26, mn = Math.min(0, ...vals), mx = Math.max(0, ...vals), rg = mx - mn || 1, x = (i) => pad + (i * (W - 2 * pad)) / (vals.length - 1), y = (v) => H - pad - ((v - mn) / rg) * (H - 2 * pad);
  const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(' L'), col = vals[vals.length - 1] >= 0 ? '#20a67a' : '#e5566d';
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="area"><line x1="${pad}" x2="${W - pad}" y1="${y(0)}" y2="${y(0)}" style="stroke:var(--line)" stroke-dasharray="3"/><path d="M${x(0)},${y(0)} L${pts} L${x(vals.length - 1)},${y(0)}Z" fill="${col}" fill-opacity=".18"/><path d="M${pts}" fill="none" stroke="${col}" stroke-width="2"/><text x="4" y="${y(mx) + 4}" font-size="10" fill="#7b7a95">${money(mx)}</text><text x="4" y="${y(mn)}" font-size="10" fill="#7b7a95">${money(mn)}</text></svg>`;
}
const cumul = () => { let c = 0; return [0, ...[...P.trades].reverse().map((t) => (c += t.pnl))]; };
const tradeRows = (l) => '<tr><th>Closed</th><th>Symbol</th><th>Side</th><th>Lots</th><th>Entry</th><th>Exit</th><th>P&L</th><th>R</th><th>Strategy</th></tr>' + (l.map((t) =>
  `<tr data-k="${esc(t.key)}"><td>${fmtD(t.closed)}</td><td>${t.symbol}</td><td>${t.dir > 0 ? 'Buy' : 'Sell'}</td><td>${t.lots}</td><td>${t.entry.toFixed(t.prec)}</td><td>${t.exit.toFixed(t.prec)}</td><td class="${cls(t.pnl)}">${money(t.pnl)}</td><td>${t.r == null ? '-' : t.r.toFixed(2) + 'R'}</td><td>${esc(t.strat) || '-'}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">No trades yet</td></tr>');
const wireRows = (el) => el.querySelectorAll('[data-k]').forEach((r) => (r.onclick = () => { P.sel = r.dataset.k; go('detail'); }));

// ---- filters ----
function applyFilters() {
  P.trades = P.all.filter((t) => (!F.from || dstr(t.closed) >= F.from) && (!F.to || dstr(t.closed) <= F.to) && (!F.symbol || t.symbol === F.symbol) && (!F.strat || (F.strat === '__none' ? !t.strat : t.strat === F.strat)) && (!F.sess || t.sim === F.sess) && (!F.acct || t.acct === F.acct));
}
F.symbol = '';
[['ffrom', 'from'], ['fto', 'to'], ['fsym', 'symbol'], ['fstrat', 'strat'], ['fsess', 'sess'], ['facc', 'acct']].forEach(([id, k]) => ($('#' + id).onchange = () => { F[k] = $('#' + id).value; renderAll(); }));
$('#fclear').onclick = () => { Object.keys(F).forEach((k) => (F[k] = '')); ['ffrom', 'fto', 'fsym', 'fstrat', 'fsess', 'facc'].forEach((i) => ($('#' + i).value = '')); renderAll(); };
function fillFilters() {
  const opt = (a, first) => `<option value="">${first}</option>` + a.map((v) => `<option value="${esc(Array.isArray(v) ? v[0] : v)}">${esc(Array.isArray(v) ? v[1] : v)}</option>`).join('');
  const keep = (id, html) => { const v = $('#' + id).value; $('#' + id).innerHTML = html; $('#' + id).value = v; };
  keep('fsym', opt([...new Set(P.all.map((t) => t.symbol))], 'All symbols')); keep('fstrat', opt([['__none', 'No strategy'], ...P.plays.map((p) => p.name)], 'All strategies')); keep('fsess', opt(P.sims.map((s) => s.name), 'All sessions'));
  const accs = [...new Set(P.all.map((t) => t.acct).filter(Boolean))]; keep('facc', opt(accs, 'All accounts')); $('#acclist').innerHTML = accs.map((a) => `<option value="${esc(a)}">`).join('');
}
// ---- dashboard ----
function radar(el, vals) {
  const labels = ['Win %', 'Profit factor', 'Avg win/loss', 'Recovery', 'Drawdown', 'Consistency'], cx = 110, cy = 100, R = 70, pt = (i, v) => { const a = -Math.PI / 2 + (i * Math.PI) / 3; return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v]; };
  const ring = (v) => labels.map((_, i) => pt(i, v).join(',')).join(' '), score = Math.round((vals.reduce((a, b) => a + b, 0) / 6) * 100);
  el.innerHTML = `<div class="kp"><svg viewBox="0 0 220 200" style="width:230px">${[0.33, 0.66, 1].map((v) => `<polygon points="${ring(v)}" fill="none" style="stroke:var(--line)"/>`).join('')}<polygon points="${vals.map((v, i) => pt(i, v).join(',')).join(' ')}" fill="#6a4fc7" fill-opacity=".3" stroke="#6a4fc7" stroke-width="2"/>${labels.map((l, i) => { const [x, y] = pt(i, 1.28); return `<text x="${x}" y="${y}" font-size="9" text-anchor="middle" fill="#7b7a95">${l}</text>`; }).join('')}</svg><div><small>Your score</small><b style="font-size:28px;display:block">${score}</b></div></div>`;
}
function streaks(a) {
  const s = [...a].sort((x, y) => x.closed - y.closed), run = (arr) => { let cur = 0, mw = 0, ml = 0, last = 0; arr.forEach((v) => { const d = v > 0 ? 1 : v < 0 ? -1 : 0; if (!d) return; cur = d === last ? cur + d : d; last = d; if (cur > mw) mw = cur; if (-cur > ml) ml = -cur; }); return { cur, mw, ml }; };
  const days = {}; s.forEach((t) => { days[dstr(t.closed)] = (days[dstr(t.closed)] || 0) + t.pnl; }); return { t: run(s.map((t) => t.pnl)), d: run(Object.keys(days).sort().map((k) => days[k])), days: Object.values(days) };
}
function renderDash() {
  const s = stats(P.trades), st = streaks(P.trades), dw = st.days.filter((v) => v > 0).length, dl = st.days.filter((v) => v < 0).length, cons = st.days.length ? dw / st.days.length : 0;
  $('#kpis').innerHTML = [['Net P&L', `<b class="${cls(s.net)}">${money(s.net)}</b>`], ['Trade win %', `<div class="kp">${donut(s.wr)}<span>${s.wins}W / ${s.losses}L</span></div>`],
    ['Avg win / loss', `<b>${s.avgL ? (s.avgW / s.avgL).toFixed(2) : '0.00'}</b><small>${money(s.avgW)} / ${money(-s.avgL)}</small>`], ['Profit factor', `<div class="kp">${donut((Math.min(s.pf, 3) / 3) * 100, '#6a4fc7', pf(s.pf))}</div>`]]
    .map(([a, b]) => `<div class="card kpi"><small>${a}</small>${b}</div>`).join('');
  area($('#dashChart'), cumul()); $('#dashRecent').innerHTML = tradeRows(P.trades.slice(0, 6)); wireRows($('#dashRecent'));
  const rec = s.dd ? Math.max(0, s.net) / s.dd : s.net > 0 ? 3 : 0;
  radar($('#dashScore'), [s.wr / 100, Math.min(s.pf, 3) / 3, Math.min(s.avgL ? s.avgW / s.avgL : 0, 3) / 3, Math.min(rec, 3) / 3, s.gp ? 1 - Math.min(1, s.dd / s.gp) : 0, cons]);
  const sv = (v) => (v > 0 ? `${v} win${v > 1 ? 's' : ''}` : v < 0 ? `${-v} loss${v < -1 ? 'es' : ''}` : '-');
  $('#dashExtra').innerHTML = `<div class="strk"><div><small>Current trade streak</small><b>${sv(st.t.cur)}</b></div><div><small>Current day streak</small><b>${sv(st.d.cur)}</b></div><div><small>Best win streak (trades)</small><b>${st.t.mw}</b></div><div><small>Worst loss streak (trades)</small><b>${st.t.ml}</b></div></div>
    <div class="kp" style="margin-top:12px">${donut(st.days.length ? (dw / st.days.length) * 100 : 0)}<span>Winning days: ${dw} won, ${dl} lost</span></div>`;
  renderCal();
}
// ---- calendar ----
function calendar(el) {
  const y = P.cal.getFullYear(), m = P.cal.getMonth(), days = {};
  P.trades.forEach((t) => { const d = new Date(t.closed); if (d.getUTCFullYear() === y && d.getUTCMonth() === m) { const k = d.getUTCDate(); days[k] ??= { pnl: 0, n: 0 }; days[k].pnl += t.pnl; days[k].n++; } });
  const first = new Date(Date.UTC(y, m, 1)).getUTCDay(), dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), mp = Object.values(days).reduce((a, d) => a + d.pnl, 0);
  let h = `<div class="calh"><button data-cm="-1">&lsaquo;</button><b>${P.cal.toLocaleString('en', { month: 'long', year: 'numeric' })}</b><button data-cm="1">&rsaquo;</button><button data-cm="0">This month</button><span class="grow"></span><span class="${cls(mp)}">Monthly P&L ${money(mp)}</span></div><div class="cal">`;
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Week'].forEach((d) => (h += `<span>${d}</span>`));
  for (let d = 1 - first; d <= dim;) { let wk = 0, wd = 0;
    for (let c = 0; c < 7; c++, d++) { if (d < 1 || d > dim) { h += '<div class="day off"></div>'; continue; } const x = days[d]; if (x) { wk += x.pnl; wd++; }
      h += `<div class="day ${x ? (x.pnl >= 0 ? 'win' : 'loss') : ''}"><i>${d}</i>${x ? `<b>${money(x.pnl)}</b><small>${x.n} trade${x.n > 1 ? 's' : ''}</small>` : ''}</div>`; }
    h += `<div class="day wk"><small>Week</small><b class="${cls(wk)}">${money(wk)}</b><small>${wd} day${wd === 1 ? '' : 's'}</small></div>`; }
  el.innerHTML = h + '</div>'; el.querySelectorAll('[data-cm]').forEach((b) => (b.onclick = () => { const v = +b.dataset.cm; P.cal = v ? new Date(y, m + v, 1) : new Date(); renderCal(); }));
}
const renderCal = () => { calendar($('#dashCal')); calendar($('#calPage')); };
// ---- trade log ----
function logList() { const q = $('#lq').value.toLowerCase(), o = $('#lo').value, d = $('#ld').value;
  return P.trades.filter((t) => (!q || (t.symbol + ' ' + t.strat + ' ' + t.sim + ' ' + t.tags.join(' ')).toLowerCase().includes(q)) && (!o || (o === 'w' ? t.pnl > 0 : t.pnl < 0)) && (!d || t.dir === +d)); }
function renderLog() { $('#logTable').innerHTML = tradeRows(logList()); wireRows($('#logTable')); }
['lq', 'lo', 'ld'].forEach((i) => ($('#' + i).oninput = renderLog));
$('#lexp').onclick = async () => { const r = await api.saveFile({ name: 'alphasim-trades.csv', content: csv([['Closed', 'Symbol', 'Side', 'Lots', 'Entry', 'Exit', 'P&L', 'R', 'Strategy', 'Tags', 'Mistakes', 'Session'],
  ...logList().map((t) => [fmtD(t.closed), t.symbol, t.dir > 0 ? 'Buy' : 'Sell', t.lots, t.entry, t.exit, t.pnl.toFixed(2), t.r == null ? '' : t.r.toFixed(2), t.strat, t.tags.join(' '), t.mistakes.join(' '), t.sim])]) }); if (r.ok) toast('Exported'); };
// ---- trade details ----
let dch, dser, dlines = [], dtf = 0, curTrade = null;
const lightbox = (src, onDel) => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px';
  d.innerHTML = `<img src="${src}" style="max-width:90%;max-height:80%"><div><button id="lbd">Delete</button> <button id="lbc">Close</button></div>`; document.body.appendChild(d); d.querySelector('#lbc').onclick = () => d.remove(); d.querySelector('#lbd').onclick = async () => { await onDel(); d.remove(); }; };
async function renderShots(t) {
  const l = (await api.listShots(t.key)) || []; $('#dshots').innerHTML = l.map((s, i) => `<img data-s="${i}" src="${s.dataUrl}">`).join('') || '<small class="dim">No screenshots yet</small>';
  $('#dshots').querySelectorAll('[data-s]').forEach((im) => (im.onclick = () => lightbox(im.src, async () => { await api.delShot({ key: t.key, name: l[im.dataset.s].name }); renderShots(t); })));
}
async function renderDetail() {
  const t = P.trades.find((x) => x.key === P.sel) || P.trades[0]; curTrade = t || null;
  if (!t) { $('#dstats').innerHTML = '<div class="empty">No trades yet.</div>'; return; } P.sel = t.key;
  const kv = (a, b) => `<div class="kv"><span class="dim">${a}</span><span>${b}</span></div>`, pb = P.plays.find((p) => p.name === t.strat), rules = (pb && pb.rules) || [];
  $('#dstats').innerHTML = `<small>Net P&L</small><div style="font-size:26px;font-weight:700" class="${cls(t.pnl)}">${money(t.pnl)}</div>` + kv('Symbol', t.symbol) + kv('Side', t.dir > 0 ? 'Long' : 'Short') + kv('Lots', t.lots) + kv('Entry', t.entry.toFixed(t.prec)) + kv('Exit', t.exit.toFixed(t.prec)) +
    kv('Risk', t.risk ? money(t.risk) : '-') + kv('R multiple', t.r == null ? '-' : t.r.toFixed(2) + 'R') + kv('Opened', fmtD(t.t)) + kv('Closed', fmtD(t.closed)) + kv('Session', esc(t.sim)) +
    `<label>Strategy<select id="dstrat"><option value="">No strategy</option>${P.plays.map((p) => `<option ${p.name === t.strat ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
     ${rules.length ? `<label>Rules followed</label>${rules.map((r, i) => `<div class="chk"><input type="checkbox" data-rule="${i}" ${t.checks.includes(i) ? 'checked' : ''}>${esc(r)}</div>`).join('')}` : ''}
     <label>Tags<input id="dtags" value="${esc(t.tags.join(', '))}" placeholder="e.g. london, trend"></label><label>Mistakes<input id="dmist" value="${esc(t.mistakes.join(', '))}" placeholder="e.g. moved stop, late entry"></label>
     <label>Notes<textarea id="dnote">${esc(t.note)}</textarea></label><div class="row" style="margin-top:10px"><button id="dsave" class="pri">Save</button><button id="dcap">Capture chart</button><button id="dadd">Add image</button></div><div class="shots" id="dshots"></div>`;
  $('#dsave').onclick = async () => { P.meta[t.key] = { strat: $('#dstrat').value, note: $('#dnote').value, tags: list($('#dtags').value), mistakes: list($('#dmist').value), checks: [...document.querySelectorAll('[data-rule]')].filter((c) => c.checked).map((c) => +c.dataset.rule) };
    await api.kvSet({ key: 'meta', value: P.meta }); toast('Trade updated'); refresh(); };
  $('#dcap').onclick = async () => { if (!dch) return; const sc = dch.takeScreenshot(); sc.getContext('2d').drawImage($('#dov'), 0, 0, sc.width, sc.height); await api.saveShot({ key: t.key, dataUrl: sc.toDataURL('image/png') }); renderShots(t); toast('Screenshot saved'); };
  $('#dadd').onclick = async () => { const r = await api.pickImage(); if (r && r.dataUrl) { await api.saveShot({ key: t.key, dataUrl: r.dataUrl }); renderShots(t); } };
  renderShots(t);
  const box = $('#dchart'); $('#dmsg').textContent = '';
  if (!dch) { dch = LW.createChart(box, { ...chartOpts(), timeScale: { ...chartOpts().timeScale, timeVisible: true } });
    dser = dch.addCandlestickSeries({ upColor: '#20a67a', downColor: '#e5566d', wickUpColor: '#20a67a', wickDownColor: '#e5566d', borderVisible: false }); themeCbs.push(() => dch.applyOptions(chartOpts())); }
  dch.applyOptions({ width: box.clientWidth, height: box.clientHeight }); dlines.forEach((l) => dser.removePriceLine(l)); dlines = []; dser.setData([]); dser.setMarkers([]);
  const r = await api.loadTicks({ symbol: t.symbol, from: dstr(t.t), to: dstr(t.closed) });
  if (!r || r.ok === false || !r.length) { $('#dmsg').textContent = 'Tick data for this trade is not stored. Download it in the Data center to see the chart.'; return; }
  const u = new Uint8Array(r), k = new Float64Array(u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength)), tf = Math.max(60, t.tf || 60), c = [], lo = t.t - 3 * 36e5, hi = t.closed + 3 * 36e5; dtf = tf;
  for (let i = 0; i < k.length; i += 3) { if (k[i] < lo || k[i] > hi) continue; const b = Math.floor(k[i] / 1000 / tf) * tf, l = c[c.length - 1], p = k[i + 1];
    if (l && l.time === b) { l.high = Math.max(l.high, p); l.low = Math.min(l.low, p); l.close = p; } else c.push({ time: b, open: p, high: p, low: p, close: p }); }
  dser.applyOptions({ priceFormat: { type: 'price', precision: t.prec, minMove: Math.pow(10, -t.prec) } }); dser.setData(c);
  const eb = Math.floor(t.t / 1000 / tf) * tf, xb = Math.floor(t.closed / 1000 / tf) * tf;
  dser.setMarkers([{ time: eb, position: t.dir > 0 ? 'belowBar' : 'aboveBar', color: '#6a4fc7', shape: t.dir > 0 ? 'arrowUp' : 'arrowDown', text: 'Entry' }, { time: xb, position: t.dir > 0 ? 'aboveBar' : 'belowBar', color: t.pnl >= 0 ? '#20a67a' : '#e5566d', shape: t.dir > 0 ? 'arrowDown' : 'arrowUp', text: 'Exit' }].sort((a, b) => a.time - b.time));
  dlines = [dser.createPriceLine({ price: t.entry, color: '#6a4fc7', lineStyle: 2, title: 'Entry' }), dser.createPriceLine({ price: t.exit, color: t.pnl >= 0 ? '#20a67a' : '#e5566d', lineStyle: 2, title: 'Exit' })]; dch.timeScale().fitContent();
}
function detOverlay() { // position box (entry to exit, with planned TP and SL zones)
  const c = $('#dov'), x = c.getContext('2d'), box = $('#dchart'); if (c.width !== box.clientWidth || c.height !== box.clientHeight) { c.width = box.clientWidth; c.height = box.clientHeight; }
  x.clearRect(0, 0, c.width, c.height); const t = curTrade;
  if (t && dch && dtf && $('#detail').classList.contains('on')) {
    const X = (ms) => dch.timeScale().timeToCoordinate(Math.floor(ms / 1000 / dtf) * dtf), Y = (p) => dser.priceToCoordinate(p); let x1 = X(t.t), x2 = X(t.closed), ye = Y(t.entry);
    if (x1 != null && x2 != null && ye != null) { if (x2 - x1 < 8) x2 = x1 + 8; const rect = (p, col) => { const y = Y(p); if (y != null) { x.fillStyle = col; x.fillRect(x1, Math.min(ye, y), x2 - x1, Math.abs(y - ye)); } };
      if (t.tp0 && t.sl0) { rect(t.tp0, 'rgba(32,166,122,.22)'); rect(t.sl0, 'rgba(229,86,109,.22)'); } else rect(t.exit, t.pnl >= 0 ? 'rgba(32,166,122,.22)' : 'rgba(229,86,109,.22)'); }
  }
  requestAnimationFrame(detOverlay);
}
detOverlay();
new ResizeObserver(() => { if (dch) { const b = $('#dchart'); dch.applyOptions({ width: b.clientWidth, height: b.clientHeight }); } }).observe($('#dchart'));
// ---- reports ----
const grp = (f) => P.trades.reduce((o, t) => { const k = f(t); o[k] = (o[k] || 0) + t.pnl; return o; }, {}); let repRows = [];
function bars(title, g) { const e = Object.entries(g), mx = Math.max(1, ...e.map(([, v]) => Math.abs(v))); repRows.push([title], ...e.map(([k, v]) => [k, v.toFixed(2)]));
  return `<div class="card"><h3>${title}</h3>${e.map(([k, v]) => `<div class="bar2"><span>${k}</span><div><i class="${cls(v)}" style="width:${(Math.abs(v) / mx) * 100}%"></i></div><b class="${cls(v)}">${money(v)}</b></div>`).join('') || '<div class="empty">No data</div>'}</div>`; }
function renderReports() {
  const s = stats(P.trades), tiles = [['Total trades', s.n], ['Win rate', s.wr.toFixed(1) + '%'], ['Profit factor', pf(s.pf)], ['Expectancy', money(s.exp)], ['Average win', money(s.avgW)], ['Average loss', money(-s.avgL)], ['Largest win', money(s.maxW)], ['Largest loss', money(s.maxL)], ['Max drawdown', money(-s.dd)], ['Average R', s.avgR.toFixed(2) + 'R']];
  $('#repStats').innerHTML = tiles.map(([a, b]) => `<div class="card kpi"><small>${a}</small><b>${b}</b></div>`).join(''); repRows = [['Metric', 'Value'], ...tiles]; area($('#repChart'), cumul());
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], wd = grp((t) => days[new Date(t.closed).getUTCDay()]), wo = {}; days.forEach((d) => wd[d] != null && (wo[d] = wd[d]));
  const hr = grp((t) => String(new Date(t.closed).getUTCHours()).padStart(2, '0') + ':00'), ho = Object.fromEntries(Object.entries(hr).sort()), tg = {}; P.trades.forEach((t) => t.tags.forEach((g) => (tg[g] = (tg[g] || 0) + t.pnl))); const ms = {}; P.trades.forEach((t) => t.mistakes.forEach((g) => (ms[g] = (ms[g] || 0) + t.pnl)));
  $('#repBars').innerHTML = bars('P&L by symbol', grp((t) => t.symbol)) + bars('P&L by weekday', wo) + bars('P&L by hour (UTC)', ho) + bars('P&L by strategy', grp((t) => t.strat || 'None')) + bars('P&L by side', grp((t) => (t.dir > 0 ? 'Buy' : 'Sell'))) + bars('P&L by tag', tg) + bars('Cost of mistakes', ms);
}
$('#rexp').onclick = async () => { const r = await api.saveFile({ name: 'alphasim-report.csv', content: csv(repRows) }); if (r.ok) toast('Exported'); };
// ---- playbook ----
const PT = { 'Breakout': ['Trade a break of a clear level with momentum.', ['Clear range or level', 'Break with a strong candle', 'Retest holds', 'Stop beyond the level', 'Target at least 2R']],
  'Pullback to trend': ['Join an established trend on a pullback.', ['Higher timeframe trend is clear', 'Pullback to support or a moving average', 'Rejection candle', 'Stop below the swing', 'Target the prior high']],
  'Reversal at level': ['Fade an extreme at a key level.', ['Key level or exhaustion', 'Rejection wick or divergence', 'Confirmation candle', 'Tight stop', 'Target mid-range']],
  'Opening range': ['Trade the first-hour range break.', ['Mark the opening range', 'Wait for a close outside', 'Stop inside the range', 'Skip if the range is too wide']], 'News fade': ['Fade the spike after a news release.', ['Wait for the spike to finish', 'Look for failure to extend', 'Small size', 'Hard stop']] };
$('#ptpl').innerHTML = '<option value="">Template...</option>' + Object.keys(PT).map((n) => `<option>${n}</option>`).join('');
$('#ptpl').onchange = () => { const t = PT[$('#ptpl').value]; if (t) { $('#pname').value = $('#ptpl').value; $('#pdesc').value = t[0]; $('#prules').value = t[1].join('\n'); } };
function fillStrats() { const cur = $('#strat').value; $('#strat').innerHTML = '<option value="">No strategy</option>' + P.plays.map((p) => `<option>${esc(p.name)}</option>`).join(''); $('#strat').value = cur; }
function renderPlay() {
  $('#playGrid').innerHTML = P.plays.map((p) => { const a = P.all.filter((t) => t.strat === p.name), s = stats(a);
    return `<div class="card pb"><div class="row"><b>${esc(p.name)}</b><span class="grow"></span><button data-pe="${p.id}">Export</button><button data-pd="${p.id}">Delete</button></div><small>${a.length} trades</small>
    <div class="kp">${donut(s.wr)}<div><small>Net P&L</small><br><b class="${cls(s.net)}">${money(s.net)}</b><br><small>Profit factor ${pf(s.pf)}</small></div></div><p class="dim">${esc(p.desc)}</p>${(p.rules || []).map((r) => `<div class="chk">&#9632; ${esc(r)}</div>`).join('')}</div>`; }).join('') || '<div class="empty">Create a playbook, then pick it in the Backtesting order panel to tag trades.</div>';
  $('#playGrid').querySelectorAll('[data-pd]').forEach((b) => (b.onclick = async () => { P.plays = P.plays.filter((p) => p.id != b.dataset.pd); await api.kvSet({ key: 'plays', value: P.plays }); renderPlay(); fillFilters(); }));
  $('#playGrid').querySelectorAll('[data-pe]').forEach((b) => (b.onclick = async () => { const p = P.plays.find((x) => x.id == b.dataset.pe); await api.saveFile({ name: p.name + '.alphaplaybook.json', content: JSON.stringify({ name: p.name, desc: p.desc, rules: p.rules || [] }, null, 2) }); }));
  fillStrats();
}
$('#padd').onclick = async () => { const n = $('#pname').value.trim(); if (!n) return toast('Name the playbook');
  P.plays.push({ id: Date.now(), name: n, desc: $('#pdesc').value, rules: $('#prules').value.split('\n').map((x) => x.trim()).filter(Boolean) }); await api.kvSet({ key: 'plays', value: P.plays }); $('#pname').value = $('#pdesc').value = $('#prules').value = ''; renderPlay(); fillFilters(); };
$('#pimp').onclick = async () => { const r = await api.openFile(); if (!r.ok) return; try { const o = JSON.parse(r.text); if (!o.name) throw 0; P.plays.push({ id: Date.now(), name: String(o.name), desc: String(o.desc || ''), rules: (o.rules || []).map(String) }); await api.kvSet({ key: 'plays', value: P.plays }); renderPlay(); fillFilters(); } catch { toast('Not a playbook file'); } };
// ---- notebook ----
const FOLD = ['All notes', 'Trade notes', 'Daily journal', 'Session recap', 'Trading plan', 'Recently deleted'], curNote = () => P.notes.find((n) => n.id === P.nid), saveNotes = () => api.kvSet({ key: 'notes', value: P.notes });
const NTPL = { 'Pre-market plan': '<h3>Pre-market</h3><ol><li>Key levels</li><li>Bias</li><li>Risk plan</li></ol><h3>Rules</h3><ul><li></li></ul>', 'Post-session review': '<h3>What I did right</h3><ol><li></li></ol><h3>Mistakes and fixes</h3><ol><li></li></ol>', 'Trade review': '<h3>Setup</h3><p></p><h3>Execution</h3><p></p><h3>Lesson</h3><p></p>' };
$('#ntpl').innerHTML = '<option value="">Blank note</option>' + Object.keys(NTPL).map((n) => `<option>${n}</option>`).join('');
function renderNotes() {
  $('#folders').innerHTML = FOLD.map((f) => `<a data-f="${f}" class="${f === P.nf ? 'on' : ''}">${f}</a>`).join(''); $('#folders').querySelectorAll('[data-f]').forEach((a) => (a.onclick = () => { P.nf = a.dataset.f; renderNotes(); }));
  const q = $('#nsearch').value.toLowerCase(), del = P.nf === 'Recently deleted';
  const l = P.notes.filter((n) => !!n.deleted === del && (del || P.nf === 'All notes' || n.folder === P.nf) && (!q || (n.title + n.html + (n.tags || []).join(' ')).toLowerCase().includes(q))).sort((a, b) => b.updated - a.updated);
  $('#noteList').innerHTML = l.map((n) => `<div class="n ${n.id === P.nid ? 'on' : ''}" data-n="${n.id}"><b>${esc(n.title) || 'Untitled'}</b><br><small>${dstr(n.updated)} ${(n.tags || []).map((t) => '#' + esc(t)).join(' ')}</small></div>`).join('') || '<div class="empty">No notes</div>';
  $('#noteList').querySelectorAll('[data-n]').forEach((d) => (d.onclick = () => { P.nid = +d.dataset.n; renderNotes(); loadEditor(); })); $('#nfold').innerHTML = FOLD.slice(1, 5).map((f) => `<option>${f}</option>`).join(''); $('#nrest').style.display = del ? '' : 'none';
}
function loadEditor() { const n = curNote(); $('#editor').style.opacity = n ? 1 : 0.4; $('#ntitle').value = n ? n.title : ''; $('#nbody').innerHTML = n ? n.html : ''; $('#ntags').value = n ? (n.tags || []).join(', ') : ''; if (n && !n.deleted) $('#nfold').value = n.folder; }
let nt; const touch = () => { const n = curNote(); if (!n || n.deleted) return; n.title = $('#ntitle').value; n.html = $('#nbody').innerHTML; n.folder = $('#nfold').value; n.tags = list($('#ntags').value); n.updated = Date.now(); clearTimeout(nt); nt = setTimeout(() => { saveNotes(); renderNotes(); }, 500); };
$('#ntitle').oninput = $('#nbody').oninput = $('#ntags').oninput = touch; $('#nfold').onchange = touch; $('#nsearch').oninput = renderNotes;
$('#nnew').onclick = () => { const tp = $('#ntpl').value, n = { id: Date.now(), title: tp, html: tp ? NTPL[tp] : '', tags: [], folder: ['All notes', 'Recently deleted'].includes(P.nf) ? 'Trade notes' : P.nf, created: Date.now(), updated: Date.now() }; P.notes.unshift(n); P.nid = n.id; if (P.nf === 'Recently deleted') P.nf = 'All notes'; saveNotes(); renderNotes(); loadEditor(); $('#ntitle').focus(); };
$('#ndel').onclick = () => { const n = curNote(); if (!n) return; if (n.deleted) P.notes = P.notes.filter((x) => x !== n); else n.deleted = true; P.nid = null; saveNotes(); renderNotes(); loadEditor(); };
$('#nrest').onclick = () => { const n = curNote(); if (n) { delete n.deleted; n.updated = Date.now(); P.nf = 'All notes'; saveNotes(); renderNotes(); } };
$('#nimg').onclick = async () => { const r = await api.pickImage(); if (r && r.dataUrl) { $('#nbody').focus(); document.execCommand('insertImage', false, r.dataUrl); touch(); } };
document.querySelectorAll('[data-cmd]').forEach((b) => { b.onmousedown = (e) => e.preventDefault(); b.onclick = () => { document.execCommand(b.dataset.cmd); touch(); }; });
// ---- saved sessions (Backtesting bar) ----
$('#openbtn').onclick = () => $('#savedsel').value && openSim($('#savedsel').value);
$('#delbtn').onclick = async () => { const n = $('#savedsel').value; if (n && confirm(`Delete session "${n}"?`)) { await api.deleteSim(n); refresh(); } };

function renderAll() { applyFilters(); renderDash(); renderLog(); renderReports(); renderPlay(); renderNotes(); if (!curNote()) loadEditor(); if ($('#detail').classList.contains('on')) renderDetail(); }
async function refresh() {
  P.meta = (await api.kvGet('meta')) || {}; P.plays = (await api.kvGet('plays')) || []; P.notes = (await api.kvGet('notes')) || []; P.sims = await api.listSims();
  P.all = (await api.allTrades()).map((t) => { const key = t.sim + '#' + t.id, m = P.meta[key] || {};
    return { ...t, key, strat: m.strat ?? t.strat ?? '', note: m.note || '', tags: m.tags || [], mistakes: m.mistakes || [], checks: m.checks || [], r: t.risk ? t.pnl / t.risk : null, prec: E.prec(t.symbol) }; }).sort((a, b) => b.closed - a.closed);
  if (!P.calSet && P.all.length) { const d = new Date(P.all[0].closed); P.cal = new Date(d.getUTCFullYear(), d.getUTCMonth(), 1); P.calSet = true; }
  $('#savedsel').innerHTML = P.sims.map((s) => `<option>${esc(s.name)}</option>`).join('') || '<option value="">No saved sessions</option>'; fillFilters(); renderAll();
}
function show(pg) { if (pg === 'detail') renderDetail(); if (pg === 'cal') renderCal(); if (pg === 'note') renderNotes(); }
window.Pages = { refresh, show };
