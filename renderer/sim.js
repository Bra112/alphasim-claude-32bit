// Backtesting window: replay, orders, indicators, drawings.
const S = { sym: '', ticks: new Float64Array(0), idx: 0, tf: 60, tf2: 0, candles: [], cand2: [], play: false, bid: 0, ask: 0, simT: 0, from: '', to: '', start: 10000, bal: 10000, lev: 100, comm: 0,
  pos: [], pend: [], hist: [], draw: [], ind: [], tool: 'cursor', ctype: 'candle', magnet: false, stay: false, lock: false, hide: false, redo: [], hover: null, avail: [], pick: '', extending: false, availTo: '', dp: null, sel: -1, cur: null, drag: null, brush: false, id: 1, lines: new Map(), prec: 5 };
const playLbl = (on) => { $('#play').textContent = on ? '\u275A\u275A' : '\u25B6'; }, moreData = () => !!S.availTo && S.to < S.availTo;
const isLine = () => S.ctype === 'line' || S.ctype === 'area', ptOf = (c) => ({ time: c.time, value: c.close }), upd = (ser, c) => ser.update(ser === series && isLine() ? ptOf(c) : c);
let posDirty = true; const moved = new Set(), pip = () => E.pip(S.sym), bucket = (t, tf = S.tf) => Math.floor(t / 1000 / tf) * tf;
const mkOpts = () => { const o = chartOpts(); o.timeScale = { ...o.timeScale, timeVisible: true, secondsVisible: false, rightOffset: 25 }; o.crosshair = { mode: 0 }; return o; };
const candleOpts = { upColor: '#089981', downColor: '#f23645', wickUpColor: '#089981', wickDownColor: '#f23645', borderVisible: false };
const chart = LW.createChart($('#chart'), mkOpts()), chart2 = LW.createChart($('#chart2'), mkOpts()), series2 = chart2.addCandlestickSeries(candleOpts);
let series = chart.addCandlestickSeries(candleOpts);
themeCbs.push(() => { chart.applyOptions(chartOpts()); chart2.applyOptions(chartOpts()); });
const ov = $('#ov'), ctx = ov.getContext('2d'), ts = chart.timeScale();
function resize() {
  [[chart, '#chart'], [chart2, '#chart2']].forEach(([c, s]) => { const el = $(s); if (el.clientWidth) c.applyOptions({ width: el.clientWidth, height: el.clientHeight }); });
  const el = $('#chart'); if (el.clientWidth) { ov.width = el.clientWidth; ov.height = el.clientHeight; }
}
new ResizeObserver(resize).observe($('#chartarea'));

// ---------- candles + indicators ----------
function pushC(arr, tf, ser, t, p, live) {
  const b = bucket(t, tf), l = arr[arr.length - 1];
  if (l && l.time === b) { if (p > l.high) l.high = p; if (p < l.low) l.low = p; l.close = p; }
  else { if (l && live) upd(ser, l); arr.push({ time: b, open: p, high: p, low: p, close: p }); }
}
function build(arr, tf, ser) { arr.length = 0; const k = S.ticks; for (let i = 0; i < S.idx; i++) pushC(arr, tf, ser, k[i * 3], k[i * 3 + 1], false); ser.setData(ser === series && isLine() ? arr.map(ptOf) : arr); }
const INDS = { 'SMA 20': ['sma', 20, '#f59e0b'], 'SMA 50': ['sma', 50, '#3b82f6'], 'EMA 20': ['ema', 20, '#ec4899'], 'EMA 50': ['ema', 50, '#14b8a6'], 'Bollinger 20': ['bb', 20, '#8b5cf6'], 'RSI 14': ['rsi', 14, '#6a4fc7'] };
function calcInd(o, from, full) {
  const c = S.candles, arr = o.ser.map(() => []);
  for (let i = Math.max(0, from); i < c.length; i++) { const r = E.indStep(o.type, o.p, c, i, o.st[i - 1]); o.st[i] = r.state; r.out.forEach((v, j) => { if (v != null) arr[j].push({ time: c[i].time, value: v }); }); }
  o.n = c.length; o.ser.forEach((s, j) => (full ? s.setData(arr[j]) : arr[j].forEach((pt) => s.update(pt))));
}
const rebuildInd = () => S.ind.forEach((o) => { o.st = []; calcInd(o, 0, true); });
const updateInd = () => S.ind.forEach((o) => calcInd(o, o.n - 1, false));
function scaleMargins() { series.priceScale().applyOptions({ scaleMargins: S.ind.some((o) => o.type === 'rsi') ? { top: 0.05, bottom: 0.3 } : { top: 0.1, bottom: 0.1 } }); }
function addInd(name) {
  const [type, p, color] = INDS[name], mk = (x = {}) => chart.addLineSeries({ color, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, ...x }), o = { name, type, p, st: [], n: 0 };
  if (type === 'bb') o.ser = [mk(), mk({ lineStyle: 2 }), mk({ lineStyle: 2 })];
  else if (type === 'rsi') { const s = mk({ priceScaleId: 'rsi' }); chart.priceScale('rsi').applyOptions({ scaleMargins: { top: 0.78, bottom: 0.02 } }); [70, 30].forEach((v) => s.createPriceLine({ price: v, color: '#aaa', lineWidth: 1, lineStyle: 2, axisLabelVisible: false })); o.ser = [s]; }
  else o.ser = [mk()];
  S.ind.push(o); calcInd(o, 0, true); scaleMargins(); renderInds();
}
function renderInds() {
  $('#inds').innerHTML = S.ind.map((o, i) => `<span class="chip">${o.name} <a data-ri="${i}">&times;</a></span>`).join('');
  $('#inds').querySelectorAll('[data-ri]').forEach((a) => (a.onclick = () => { const o = S.ind.splice(+a.dataset.ri, 1)[0]; o.ser.forEach((s) => chart.removeSeries(s)); scaleMargins(); renderInds(); }));
}
function rebuild() { build(S.candles, S.tf, series); if (S.tf2) build(S.cand2, S.tf2, series2); rebuildInd(); chart.timeScale().scrollToRealTime(); }
function makeSeries() {
  [...S.lines.keys()].forEach(clearLines); chart.removeSeries(series); const t = S.ctype;
  series = t === 'bar' ? chart.addBarSeries({ upColor: candleOpts.upColor, downColor: candleOpts.downColor }) : t === 'line' ? chart.addLineSeries({ color: '#2962ff', lineWidth: 2 }) : t === 'area' ? chart.addAreaSeries({ lineColor: '#2962ff', topColor: 'rgba(41,98,255,.28)', bottomColor: 'rgba(41,98,255,0)', lineWidth: 2 }) : chart.addCandlestickSeries(candleOpts);
  series.applyOptions({ priceFormat: { type: 'price', precision: S.prec, minMove: Math.pow(10, -S.prec) } }); series.setData(isLine() ? S.candles.map(ptOf) : S.candles);
  S.pos.forEach(posLines); S.pend.forEach(pendLine); scaleMargins();
}

// ---------- trading ----------
const floating = () => S.pos.reduce((a, p) => a + E.pnl(S.sym, p, p.dir > 0 ? S.bid : S.ask), 0);
const usedMargin = () => S.pos.reduce((a, p) => a + E.margin(S.sym, p.lots, p.entry, S.lev), 0);
function sizeLots(slp, price) {
  const v = +$('#lots').value; if ($('#smode').value !== 'risk') return v;
  return slp ? E.lotsForRisk(S.sym, (S.bal * v) / 100, slp, price) : 0;
}
const mkLine = (price, color, title) => series.createPriceLine({ price, color, lineWidth: 1, lineStyle: 2, title });
function clearLines(key) { const L = S.lines.get(key); if (L) Object.values(L).forEach((l) => series.removePriceLine(l)); S.lines.delete(key); }
function posLines(p) {
  clearLines(p.id); const L = { entry: mkLine(p.entry, '#6a4fc7', (p.dir > 0 ? 'Buy ' : 'Sell ') + p.lots) }; if (p.sl) L.sl = mkLine(p.sl, '#e5566d', 'SL'); if (p.tp) L.tp = mkLine(p.tp, '#20a67a', 'TP'); S.lines.set(p.id, L);
}
function syncLines(p) { const L = S.lines.get(p.id); if (!L || (!!p.sl !== !!L.sl) || (!!p.tp !== !!L.tp)) return posLines(p); if (L.sl) L.sl.applyOptions({ price: p.sl }); if (L.tp) L.tp.applyOptions({ price: p.tp }); }
const pendLine = (o) => { clearLines('p' + o.id); S.lines.set('p' + o.id, { e: mkLine(o.price, '#f59e0b', o.kind.replace(/^(buy|sell)/, '$1 ')) }); };
function fill(dir, e, o) {
  const sl = o.slp ? e - dir * o.slp * pip() : 0, tp = o.tpp ? e + dir * o.tpp * pip() : 0, lots = o.lots;
  if (E.margin(S.sym, lots, e, S.lev) > S.bal + floating() - usedMargin()) return toast('Not enough margin');
  const p = { id: S.id++, dir, lots, entry: e, sl, tp, sl0: sl, tp0: tp, t: S.simT, strat: o.strat || '', trail: o.trail || 0 };
  p.risk = sl ? Math.abs(E.pnl(S.sym, p, sl)) : 0; S.pos.push(p); posLines(p); posDirty = true;
}
function place(dir) {
  if (!S.bid) return toast('Load data first');
  const ty = $('#otype').value, slp = +$('#sl').value, tpp = +$('#tp').value, ref = dir > 0 ? S.ask : S.bid, price = +$('#oprice').value, o = { slp, tpp, strat: $('#strat').value, trail: +$('#trail').value || 0 };
  o.lots = sizeLots(slp, ty === 'market' ? ref : price || ref); if (!o.lots) return toast('Set a stop loss to size by risk');
  if (ty === 'market') return fill(dir, ref, o);
  if (!price) return toast('Enter an order price');
  const kind = (dir > 0 ? 'buy' : 'sell') + ty;
  if ((kind === 'buylimit' && price >= ref) || (kind === 'buystop' && price <= ref) || (kind === 'selllimit' && price <= ref) || (kind === 'sellstop' && price >= ref)) return toast('Price is on the wrong side of the market for this order type');
  const po = { id: S.id++, kind, dir, price, ...o }; S.pend.push(po); pendLine(po); posDirty = true;
}
function removePend(o) { S.pend = S.pend.filter((x) => x !== o); clearLines('p' + o.id); posDirty = true; }
function closePos(p, px, t, frac = 1) {
  const l = +(p.lots * frac).toFixed(2), pnl = E.pnl(S.sym, p, px, l) - S.comm * l; S.bal += pnl;
  S.hist.unshift({ id: frac < 1 ? S.id++ : p.id, strat: p.strat, risk: p.risk * (l / p.lots), sl: p.sl0, tp: p.tp0, dir: p.dir, lots: l, entry: p.entry, exit: px, pnl, t: p.t, closed: t || S.simT });
  if (frac < 1) { p.risk -= p.risk * (l / p.lots); p.lots = +(p.lots - l).toFixed(2); posLines(p); } else { S.pos = S.pos.filter((x) => x !== p); clearLines(p.id); }
  posDirty = true;
}
function onTick(t, bid, ask) {
  S.bid = bid; S.ask = ask; S.simT = t; pushC(S.candles, S.tf, series, t, bid, true); if (S.tf2) pushC(S.cand2, S.tf2, series2, t, bid, true);
  for (const o of S.pend.slice()) if (E.pendingHit(o.kind, o.price, bid, ask)) { removePend(o); fill(o.dir, o.kind.endsWith('limit') ? o.price : o.dir > 0 ? ask : bid, o); }
  for (const p of S.pos.slice()) { const was = p.sl, r = E.tickPos(S.sym, p, bid, ask); if (r) closePos(p, r.price, t); else if (p.sl !== was) moved.add(p); }
}
function advance(until) {
  const k = S.ticks, n = k.length / 3;
  while (S.idx < n && k[S.idx * 3] <= until) { onTick(k[S.idx * 3], k[S.idx * 3 + 1], k[S.idx * 3 + 2]); S.idx++; }
  if (S.idx >= n && S.play && !moreData()) { S.play = false; playLbl(0); toast('End of data'); }
  const l = S.candles[S.candles.length - 1]; if (l) upd(series, l); const l2 = S.cand2[S.cand2.length - 1]; if (S.tf2 && l2) series2.update(l2);
  updateInd(); moved.forEach((p) => S.pos.includes(p) && (syncLines(p), (posDirty = posDirty || false))); moved.clear();
  if (S.pos.length) { const used = usedMargin(); if (S.bal + floating() <= used * 0.5) { S.pos.slice().forEach((p) => closePos(p, p.dir > 0 ? S.bid : S.ask)); toast('Stop out: margin level too low'); } }
  ui();
}
setInterval(ui, 150); // keeps positions and live P&L current while paused
setInterval(() => { const n = S.ticks.length / 3; if (S.play && S.idx > n - 3000 && moreData() && !S.extending) extendData(); if (S.play && S.idx < n) advance(S.simT + +$('#speed').value * 40); }, 40);
$('#play').onclick = () => { if (!S.ticks.length) return toast('Load data first'); S.play = !S.play; playLbl(S.play); };
$('#step').onclick = () => { if (S.ticks.length) advance((Math.floor(S.simT / 1000 / S.tf) + 1) * S.tf * 1000); };
function seek(ms) { let lo = 0, hi = S.ticks.length / 3; while (lo < hi) { const m = (lo + hi) >> 1; if (S.ticks[m * 3] < ms) lo = m + 1; else hi = m; } return lo; }
$('#back').onclick = stepBack;
function stepBack() {
  if (!S.ticks.length) return; if (S.pos.length || S.pend.length) return toast('Close positions and cancel orders before stepping back');
  let target = bucket(S.simT) * 1000; if (seek(target) >= S.idx) target -= S.tf * 1000;
  if (S.hist.some((h) => h.closed > target)) return toast('Cannot step back past a closed trade');
  S.idx = seek(target); const k = S.idx * 3; S.simT = S.ticks[k - 3] || S.ticks[0]; S.bid = S.ticks[k - 2] || 0; S.ask = S.ticks[k - 1] || 0; S.play = false; playLbl(0); rebuild(); ui();
}
$('#tf').onchange = () => { S.tf = +$('#tf').value; if (S.ticks.length) { rebuild(); S.sel = -1; } markTf(); setWatermark(); };
$('#tf2').onchange = () => { S.tf2 = +$('#tf2').value; $('#wrap2').style.display = S.tf2 ? 'block' : 'none'; resize(); if (S.ticks.length) build(S.cand2, S.tf2, series2); };
$('#buy').onclick = () => place(1); $('#sell').onclick = () => place(-1);
$('#otype').onchange = () => ($('#oprice').style.display = $('#otype').value === 'market' ? 'none' : 'block');
$('#set_lev').oninput = () => (S.lev = +$('#set_lev').value || 100); $('#set_comm').oninput = () => (S.comm = +$('#set_comm').value || 0);

function renderPos() {
  const f = (v) => v.toFixed(S.prec);
  $('#open').innerHTML = S.pos.map((p) => `<div class="pos"><div class="r1"><b>${p.dir > 0 ? 'Buy' : 'Sell'} ${p.lots}</b><span>@ ${f(p.entry)}</span><b data-pl="${p.id}"></b></div>
    <div class="r2">SL<input data-f="sl" data-id="${p.id}" type="number" step="any" value="${p.sl ? f(p.sl) : ''}">TP<input data-f="tp" data-id="${p.id}" type="number" step="any" value="${p.tp ? f(p.tp) : ''}">
    <button data-a="be" data-id="${p.id}">BE</button><button data-a="half" data-id="${p.id}">1/2</button><button data-a="x" data-id="${p.id}">Close</button></div></div>`).join('') +
    S.pend.map((o) => `<div class="pos"><div class="r1"><b>${o.kind.replace(/^(buy|sell)/, '$1 ')} ${o.lots}</b><span>@ ${f(o.price)}</span><button data-a="cp" data-id="${o.id}">Cancel</button></div></div>`).join('') || '<div class="dim">None</div>';
  $('#hist').innerHTML = '<tr><th>Closed (UTC)</th><th>Side</th><th>Lots</th><th>Entry</th><th>Exit</th><th>P&L</th></tr>' + S.hist.slice(0, 300).map((h) => `<tr><td>${new Date(h.closed).toISOString().replace('T', ' ').slice(0, 16)}</td><td>${h.dir > 0 ? 'Buy' : 'Sell'}</td><td>${h.lots}</td><td>${f(h.entry)}</td><td>${f(h.exit)}</td><td class="${cls(h.pnl)}">${money(h.pnl)}</td></tr>`).join('');
}
$('#open').onchange = (e) => { const i = e.target; if (!i.dataset.f) return; const p = S.pos.find((x) => x.id == i.dataset.id); if (p) { p[i.dataset.f] = +i.value || 0; syncLines(p); } };
$('#open').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return; const id = +b.dataset.id, p = S.pos.find((x) => x.id === id), px = p && (p.dir > 0 ? S.bid : S.ask);
  if (b.dataset.a === 'x') closePos(p, px); else if (b.dataset.a === 'half') { if (p.lots >= 0.02) closePos(p, px, S.simT, 0.5); else toast('Position too small to split'); }
  else if (b.dataset.a === 'be') { p.sl = p.entry; syncLines(p); posDirty = true; } else if (b.dataset.a === 'cp') removePend(S.pend.find((o) => o.id === id));
  ui();
};
function ui() {
  const f = (v) => (v ? v.toFixed(S.prec) : '-'); $('#bid').textContent = f(S.bid); $('#ask').textContent = f(S.ask);
  $('#bal').textContent = money(S.bal); $('#eq').textContent = money(S.bal + floating());
  { const fl = floating(), um = usedMargin(); $('#fl').textContent = money(fl); $('#fl').className = cls(fl); $('#mg').textContent = money(um); $('#fm').textContent = money(S.bal + fl - um); $('#ml').textContent = um ? ((S.bal + fl) / um * 100).toFixed(0) + '%' : '-'; $('#npos').textContent = S.pos.length + S.pend.length; }
  $('#clock').textContent = S.simT ? new Date(S.simT).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : '';
  if (posDirty) { renderPos(); posDirty = false; }
  S.pos.forEach((p) => { const el = document.querySelector(`[data-pl="${p.id}"]`), v = E.pnl(S.sym, p, p.dir > 0 ? S.bid : S.ask); if (el) { el.textContent = money(v); el.className = cls(v); }
    const si = document.querySelector(`[data-f="sl"][data-id="${p.id}"]`); if (si && document.activeElement !== si) si.value = p.sl ? p.sl.toFixed(S.prec) : ''; });
}

// ---------- data ----------
const addDays = (s, n) => new Date(Date.parse(s) + n * 864e5).toISOString().slice(0, 10);
const normD = (s, end) => (s.length === 7 ? (end ? new Date(Date.UTC(+s.slice(0, 4), +s.slice(5), 0)).toISOString().slice(0, 10) : s + '-01') : s);
async function loadData(sym, from, to) {
  const r = await api.loadTicks({ symbol: sym, from, to }); if (r && r.ok === false) { toast(r.error); return 0; }
  const u = r instanceof Uint8Array ? r : new Uint8Array(r || []);
  S.ticks = new Float64Array(u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength)); S.sym = sym; S.from = from; S.to = to; S.prec = E.prec(sym);
  const a = S.avail.find((x) => x.symbol === sym); S.availTo = a ? a.to : to;
  const pf = { type: 'price', precision: S.prec, minMove: Math.pow(10, -S.prec) }; series.applyOptions({ priceFormat: pf }); series2.applyOptions({ priceFormat: pf });
  return S.ticks.length / 3;
}
async function refreshData() {
  const imp = await api.listData(), fl = await api.listFiles(), m = new Map();
  imp.forEach((x) => m.set(x.symbol, { symbol: x.symbol, from: x.from, to: x.to, imported: true, dl: [] }));
  fl.forEach((g) => {
    const a = normD(g.from, false), b = normD(g.to, true); if (!/^\d{4}-\d\d/.test(a)) return; let x = m.get(g.symbol);
    if (!x) m.set(g.symbol, (x = { symbol: g.symbol, from: a, to: b, imported: false, dl: [] })); else { if (a < x.from) x.from = a; if (b > x.to) x.to = b; }
    x.dl.push({ provider: g.provider, from: a, to: b });
  });
  S.avail = [...m.values()].sort((p, q) => p.symbol.localeCompare(q.symbol));
  $('#dtable').innerHTML = '<tr><th>Symbol</th><th>Days</th><th>From</th><th>To</th></tr>' + imp.map((x) => `<tr><td>${x.symbol}</td><td>${x.days}</td><td>${x.from}</td><td>${x.to}</td></tr>`).join('');
  if (window.renderSymList) renderSymList();
}
// Downloaded CSV files are imported on demand: only files for the period being replayed, and only if not imported before.
async function ensureData(sym, from, to) {
  const a = S.avail.find((x) => x.symbol === sym); if (!a || !a.dl.length) return;
  for (const g of a.dl) {
    if (g.to < from || g.from > to) continue;
    const r = await api.importFolder({ provider: g.provider, symbol: sym, from, to, onlyNew: true });
    if (r && r.ok === false && !/No downloaded files/.test(r.error)) toast(r.error);
  }
  await refreshData();
}
function reset(keep) {
  S.play = false; playLbl(0); [...S.lines.keys()].forEach(clearLines); S.pos = []; S.pend = []; if (!keep) { S.hist = []; S.draw = []; S.sel = -1; S.redo = []; S.bal = S.start; } posDirty = true;
}
async function startReplay(sym, date, time) {
  if (!S.avail.length) await refreshData(); const a0 = S.avail.find((x) => x.symbol === sym); if (!a0) return toast('No data for ' + sym);
  const win = +$('#set_win').value || 7, from = date > addDays(a0.from, 3) ? addDays(date, -3) : a0.from; let to = addDays(date, win); if (to > a0.to) to = a0.to;
  toast('Loading data...'); await ensureData(sym, from, to);
  const n = await loadData(sym, from, to); if (!n) return toast('No ticks stored for that period. Download or import them in the Data center.');
  S.start = +$('#set_bal').value || 10000; S.lev = +$('#set_lev').value || 100; S.comm = +$('#set_comm').value || 0; reset(false);
  S.idx = seek(Date.parse(`${date}T${time || '00:00'}:00Z`)); if (S.idx >= n) S.idx = n - 1; if (S.idx < 1) S.idx = Math.min(1, n - 1);
  rebuild(); const k = S.idx * 3; S.simT = S.ticks[k - 3]; S.bid = S.ticks[k - 2]; S.ask = S.ticks[k - 1]; ui(); setReplayUI(true); setWatermark(); toast(`${n.toLocaleString()} ticks loaded`);
}
async function extendData() {
  if (S.extending) return; S.extending = true;
  try {
    const win = +$('#set_win').value || 7, from = addDays(S.to, 1), to = addDays(S.to, win) > S.availTo ? S.availTo : addDays(S.to, win);
    if (from > S.availTo) { S.availTo = S.to; return; }
    await ensureData(S.sym, from, to); const r = await api.loadTicks({ symbol: S.sym, from, to });
    const u = r instanceof Uint8Array ? r : new Uint8Array(r && r.ok === false ? [] : r || []), add = new Float64Array(u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength));
    if (add.length) { const all = new Float64Array(S.ticks.length + add.length); all.set(S.ticks); all.set(add, S.ticks.length); S.ticks = all; }
    S.to = to; if (!add.length && to >= S.availTo) S.availTo = S.to;
  } catch { S.availTo = S.to; } finally { S.extending = false; }
}
$('#save').onclick = async () => {
  const name = $('#simname').value.trim(); if (!name || !S.sym) return toast('Name the session and start a replay first');
  const r = await api.saveSim({ name, acct: $('#simacc').value.trim(), symbol: S.sym, tf: S.tf, tf2: S.tf2, ctype: S.ctype, from: S.from, to: S.to, cursor: S.simT, start: S.start, bal: S.bal, lev: S.lev, comm: S.comm, pos: S.pos, pend: S.pend, hist: S.hist, draw: S.draw, ind: S.ind.map((o) => o.name), id: S.id });
  toast(r.ok ? 'Session saved' : r.error); if (r.ok) { refreshSims(); closeModals(); }
};
async function openSim(name) {
  const r = await api.loadSim(name); if (!r.ok) return toast(r.error); const d = r.sim; if (!S.avail.length) await refreshData();
  await ensureData(d.symbol, d.from, d.to); const n = await loadData(d.symbol, d.from, d.to); if (!n) return toast('Tick data for this session is missing');
  reset(true); S.tf = d.tf; $('#tf').value = d.tf; S.pick = d.symbol; $('#symname').textContent = d.symbol;
  Object.assign(S, { start: d.start, bal: d.bal, lev: d.lev || 100, comm: d.comm || 0, pos: d.pos, pend: d.pend || [], hist: d.hist, draw: d.draw, id: d.id, redo: [] });
  $('#set_bal').value = d.start; $('#set_lev').value = S.lev; $('#set_comm').value = S.comm; $('#tf2').value = d.tf2 || 0; S.tf2 = d.tf2 || 0; $('#wrap2').style.display = S.tf2 ? 'block' : 'none';
  if ((d.ctype || 'candle') !== S.ctype) { S.ctype = d.ctype || 'candle'; makeSeries(); typeLabel(); }
  S.ind.splice(0).forEach((o) => o.ser.forEach((s) => chart.removeSeries(s))); S.pos.forEach(posLines); S.pend.forEach(pendLine);
  S.idx = seek(d.cursor + 1); rebuild(); (d.ind || []).forEach(addInd); const k = S.idx * 3; S.simT = d.cursor; S.bid = S.ticks[k - 2]; S.ask = S.ticks[k - 1];
  $('#simname').value = d.name; $('#simacc').value = d.acct || ''; posDirty = true; markTf(); setReplayUI(true); setWatermark(); ui(); closeModals(); go('sim');
}

// ---------- drawing tools ----------
const NPTS = { trend: 2, ray: 2, ext: 2, hray: 1, cross: 1, ellipse: 2, hline: 1, vline: 1, rect: 2, fib: 2, channel: 3, pos: 3, measure: 2, text: 1 };
function setTool(k) { S.tool = k; S.dp = null; $('#textin').style.display = 'none'; markTools(); }
$('#dcolor').oninput = () => { if (S.draw[S.sel]) S.draw[S.sel].color = $('#dcolor').value; };
const lastC = () => S.candles[S.candles.length - 1], firstC = () => S.candles[0];
function X(t) {
  const c = ts.timeToCoordinate(t); if (c != null) return c; const l = lastC(), f = firstC(); if (!l) return null; const sp = ts.options().barSpacing;
  if (t > l.time) { const lx = ts.timeToCoordinate(l.time); return lx != null ? lx + ((t - l.time) / S.tf) * sp : null; }
  const fx = ts.timeToCoordinate(f.time); return fx != null ? fx - ((f.time - t) / S.tf) * sp : null;
}
const Y = (p) => series.priceToCoordinate(p);
function toPt(e) {
  const r = ov.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, lg = ts.coordinateToLogical(x), n = S.candles.length; if (lg == null || !n) return null;
  const i = Math.round(lg), t = i < 0 ? firstC().time + i * S.tf : i >= n ? lastC().time + (i - n + 1) * S.tf : S.candles[i].time; let p = series.coordinateToPrice(y);
  if (S.magnet && S.candles[i]) { const c = S.candles[i], v = [c.open, c.high, c.low, c.close]; p = v.reduce((b, q) => (Math.abs(Y(q) - y) < Math.abs(Y(b) - y) ? q : b), v[0]); }
  return { t, p, x, y };
}
const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const dseg = (px, py, x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy; let t = l ? ((px - x1) * dx + (py - y1) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)); };
const pxs = (d) => { const P = d.pts.map((q) => ({ x: X(q.t), y: Y(q.p) })); return P.some((q) => q.x == null || q.y == null) ? null : P; };
const posBox = (P) => { const x1 = P[0].x, x2 = x1 + 30 * ts.options().barSpacing; return { x1, x2, xm: (x1 + x2) / 2 }; };
const handles = (d, P) => (d.k === 'pos' ? (() => { const b = posBox(P); return [{ x: b.x1, y: P[0].y }, { x: b.xm, y: P[1].y }, { x: b.xm, y: P[2].y }]; })() : d.k === 'brush' ? [] : P);
const rayEnd = (P, W) => { const dx = P[1].x - P[0].x; if (!dx) return { x: P[1].x, y: P[1].y }; const ex = dx > 0 ? W + 60 : -60; return { x: ex, y: P[0].y + ((P[1].y - P[0].y) / dx) * (ex - P[0].x) }; };
const chanOff = (P) => { const dx = P[1].x - P[0].x || 1e-6, m = (P[1].y - P[0].y) / dx; return P[2].y - (P[0].y + m * (P[2].x - P[0].x)); };
function bodyHit(d, P, x, y) {
  const W = ov.width, near = (a, b, c, e) => dseg(x, y, a, b, c, e) < 6, [a, b, c] = P;
  switch (d.k) {
    case 'trend': case 'measure': return near(a.x, a.y, b.x, b.y);
    case 'ray': { const e = rayEnd(P, W); return near(a.x, a.y, e.x, e.y); }
    case 'hline': return Math.abs(y - a.y) < 6; case 'vline': return Math.abs(x - a.x) < 6;
    case 'hray': return Math.abs(y - a.y) < 6 && x >= a.x - 6; case 'cross': return Math.abs(y - a.y) < 6 || Math.abs(x - a.x) < 6;
    case 'ext': { const dx = b.x - a.x; if (!dx) return Math.abs(x - a.x) < 6; const m = (b.y - a.y) / dx; return Math.abs(y - (a.y + m * (x - a.x))) < 6; }
    case 'ellipse': return x >= Math.min(a.x, b.x) - 4 && x <= Math.max(a.x, b.x) + 4 && y >= Math.min(a.y, b.y) - 4 && y <= Math.max(a.y, b.y) + 4;
    case 'rect': case 'fib': return x >= Math.min(a.x, b.x) - 4 && x <= Math.max(a.x, b.x) + 4 && y >= Math.min(a.y, b.y) - 4 && y <= Math.max(a.y, b.y) + 4;
    case 'channel': { const o = chanOff(P); return near(a.x, a.y, b.x, b.y) || near(a.x, a.y + o, b.x, b.y + o); }
    case 'pos': { const bx = posBox(P); return x >= bx.x1 && x <= bx.x2 && y >= Math.min(b.y, c.y, a.y) && y <= Math.max(b.y, c.y, a.y); }
    case 'text': return x >= a.x - 4 && x <= a.x + 120 && y >= a.y - 16 && y <= a.y + 4;
    case 'brush': return P.some((q, i) => i && dseg(x, y, P[i - 1].x, P[i - 1].y, q.x, q.y) < 6);
  }
  return false;
}
function hitDraw(x, y) {
  const order = [...S.draw.keys()].reverse(); if (S.sel >= 0 && S.draw[S.sel]) { order.splice(order.indexOf(S.sel), 1); order.unshift(S.sel); }
  for (const i of order) { const d = S.draw[i], P = pxs(d); if (!P) continue;
    if (i === S.sel) { const H = handles(d, P); for (let h = 0; h < H.length; h++) if (Math.hypot(H[h].x - x, H[h].y - y) < 8) return { i, h }; }
    if (bodyHit(d, P, x, y)) return { i, h: -1 }; }
  return null;
}
function hitLine(y) {
  for (const p of S.pos) for (const f of ['sl', 'tp']) if (p[f] && Math.abs(Y(p[f]) - y) < 5) return { pos: p, f };
  for (const o of S.pend) if (Math.abs(Y(o.price) - y) < 5) return { pend: o };
  return null;
}
const wrap = $('#wrap1');
wrap.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || e.target.closest('#replaybar,#legend,#empty,#textin')) return; const r = ov.getBoundingClientRect(), x = e.clientX - r.left; if (x > ov.width - chart.priceScale('right').width()) return;
  const pt = toPt(e); if (!pt) return;
  if (S.tool === 'cursor') {
    const hl = hitLine(pt.y); if (hl) { S.drag = { line: hl }; e.stopPropagation(); e.preventDefault(); return; }
    const h = S.lock ? null : hitDraw(pt.x, pt.y); if (h) { S.sel = h.i; $('#dcolor').value = S.draw[h.i].color || '#6a4fc7'; S.drag = { ...h, start: pt, orig: S.draw[h.i].pts.map((q) => ({ ...q })) }; e.stopPropagation(); e.preventDefault(); } else S.sel = -1;
    return;
  }
  e.stopPropagation(); e.preventDefault(); const color = $('#dcolor').value;
  if (S.tool === 'brush') { S.dp = { k: 'brush', pts: [{ t: pt.t, p: pt.p }], color }; S.brush = true; return; }
  if (S.tool === 'text') { const el = $('#textin'); Object.assign(el.style, { display: 'block', left: pt.x + 'px', top: pt.y + 'px' }); el.value = ''; el.dataset.t = pt.t; el.dataset.p = pt.p; el.focus(); return; }
  if (!S.dp) S.dp = { k: S.tool, pts: [], color }; S.dp.pts.push({ t: pt.t, p: pt.p });
  if (S.dp.pts.length >= NPTS[S.tool]) { S.draw.push(S.dp); S.sel = S.draw.length - 1; S.dp = null; S.redo = []; if (!S.stay) setTool('cursor'); }
}, true);
wrap.addEventListener('mousemove', (e) => {
  const pt = toPt(e); S.cur = pt; if (!pt) return;
  if (S.brush && S.dp) { S.dp.pts.push({ t: pt.t, p: pt.p }); e.stopPropagation(); return; }
  const g = S.drag; if (!g) return; e.stopPropagation();
  if (g.line) { const price = series.coordinateToPrice(pt.y); if (g.line.pos) { g.line.pos[g.line.f] = price; syncLines(g.line.pos); } else { g.line.pend.price = price; pendLine(g.line.pend); } posDirty = true; return; }
  const d = S.draw[g.i]; if (!d) return;
  if (g.h >= 0) { if (d.k === 'pos' && g.h > 0) d.pts[g.h].p = pt.p; else d.pts[g.h] = { t: pt.t, p: pt.p }; }
  else { const dt = pt.t - g.start.t, dp = pt.p - g.start.p; d.pts = g.orig.map((q) => ({ t: q.t + dt, p: q.p + dp })); }
}, true);
addEventListener('mouseup', () => { if (S.brush && S.dp) { if (S.dp.pts.length > 1) { S.draw.push(S.dp); S.sel = S.draw.length - 1; } S.dp = null; S.brush = false; if (!S.stay) setTool('cursor'); } S.drag = null; });
$('#textin').onkeydown = (e) => { const el = e.target; if (e.key === 'Escape') el.style.display = 'none'; if (e.key === 'Enter' && el.value.trim()) { S.draw.push({ k: 'text', pts: [{ t: +el.dataset.t, p: +el.dataset.p }], text: el.value.trim(), color: $('#dcolor').value }); S.sel = S.draw.length - 1; el.style.display = 'none'; setTool('cursor'); } };
addEventListener('keydown', (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable || !$('#sim').classList.contains('on')) return;
  if (e.key === ' ') { e.preventDefault(); $('#play').click(); } else if (e.key === 'ArrowRight') $('#step').click(); else if (e.key === 'ArrowLeft') stepBack();
  else if (e.key === 'b' || e.key === 'B') place(1); else if (e.key === 's' || e.key === 'S') place(-1); else if (e.key === 'Escape') { setTool('cursor'); S.sel = -1; }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && S.draw[S.sel]) { S.draw.splice(S.sel, 1); S.sel = -1; } else if (e.ctrlKey && e.key === 'z') $('#undo').click(); else if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) $('#redo').click();
});
function renderShape(d, sel, W) {
  const P = pxs(d); if (!P) return; const col = d.color || '#6a4fc7', [a, b, c] = P; ctx.strokeStyle = col; ctx.fillStyle = hexA(col, 0.15); ctx.lineWidth = sel ? 2.5 : 1.5; ctx.beginPath();
  const lab = (txt, x, y) => { ctx.fillStyle = col; ctx.font = '11px sans-serif'; ctx.fillText(txt, x, y); };
  switch (d.k) {
    case 'trend': ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); break;
    case 'ray': { const e = rayEnd(P, W); ctx.moveTo(a.x, a.y); ctx.lineTo(e.x, e.y); ctx.stroke(); break; }
    case 'hline': ctx.moveTo(0, a.y); ctx.lineTo(W, a.y); ctx.stroke(); lab(d.pts[0].p.toFixed(S.prec), 4, a.y - 3); break;
    case 'vline': ctx.moveTo(a.x, 0); ctx.lineTo(a.x, ov.height); ctx.stroke(); break;
    case 'hray': ctx.moveTo(a.x, a.y); ctx.lineTo(W + 60, a.y); ctx.stroke(); lab(d.pts[0].p.toFixed(S.prec), a.x + 4, a.y - 3); break;
    case 'cross': ctx.moveTo(0, a.y); ctx.lineTo(W, a.y); ctx.moveTo(a.x, 0); ctx.lineTo(a.x, ov.height); ctx.stroke(); break;
    case 'ext': { const dx = b.x - a.x, m = dx ? (b.y - a.y) / dx : 0; if (!dx) { ctx.moveTo(a.x, 0); ctx.lineTo(a.x, ov.height); } else { ctx.moveTo(-60, a.y + m * (-60 - a.x)); ctx.lineTo(W + 60, a.y + m * (W + 60 - a.x)); } ctx.stroke(); break; }
    case 'ellipse': ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2 || 1, Math.abs(b.y - a.y) / 2 || 1, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break;
    case 'rect': ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); break;
    case 'channel': { const o = chanOff(P); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x, b.y + o); ctx.lineTo(a.x, a.y + o); ctx.closePath(); ctx.fill(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.moveTo(a.x, a.y + o); ctx.lineTo(b.x, b.y + o); ctx.stroke(); break; }
    case 'fib': for (const lv of [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]) { const p = d.pts[1].p - (d.pts[1].p - d.pts[0].p) * lv, y = Y(p); if (y == null) continue; ctx.beginPath(); ctx.moveTo(Math.min(a.x, b.x), y); ctx.lineTo(Math.max(a.x, b.x), y); ctx.stroke(); lab(`${lv} (${p.toFixed(S.prec)})`, Math.min(a.x, b.x) + 4, y - 3); } break;
    case 'pos': { const bx = posBox(P), tp = d.pts[1].p, sl = d.pts[2].p, en = d.pts[0].p, w = bx.x2 - bx.x1;
      ctx.fillStyle = 'rgba(32,166,122,.22)'; ctx.fillRect(bx.x1, Math.min(a.y, b.y), w, Math.abs(b.y - a.y)); ctx.fillStyle = 'rgba(229,86,109,.22)'; ctx.fillRect(bx.x1, Math.min(a.y, c.y), w, Math.abs(c.y - a.y));
      ctx.moveTo(bx.x1, a.y); ctx.lineTo(bx.x2, a.y); ctx.stroke(); const rr = Math.abs(en - sl) ? Math.abs(tp - en) / Math.abs(en - sl) : 0; lab(`${tp > en ? 'Long' : 'Short'}  R:R ${rr.toFixed(2)}  TP ${(Math.abs(tp - en) / pip()).toFixed(1)}p  SL ${(Math.abs(en - sl) / pip()).toFixed(1)}p`, bx.x1 + 4, a.y - 4); break; }
    case 'measure': { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); const dp = d.pts[1].p - d.pts[0].p, bars = Math.round((d.pts[1].t - d.pts[0].t) / S.tf);
      lab(`${(dp / pip()).toFixed(1)} pips (${((dp / d.pts[0].p) * 100).toFixed(2)}%)  ${bars} bars`, b.x + 6, b.y - 6); break; }
    case 'text': ctx.fillStyle = col; ctx.font = '13px sans-serif'; ctx.fillText(d.text, a.x, a.y); break;
    case 'brush': P.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke(); break;
  }
  if (sel) { ctx.fillStyle = '#fff'; ctx.strokeStyle = col; ctx.lineWidth = 2; handles(d, P).forEach((h) => { ctx.beginPath(); ctx.arc(h.x, h.y, 5, 0, 7); ctx.fill(); ctx.stroke(); }); }
}
function render() {
  ctx.clearRect(0, 0, ov.width, ov.height); const W = ov.width - chart.priceScale('right').width(); ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, ov.height - 28); ctx.clip();
  if (!S.hide) S.draw.forEach((d, i) => renderShape(d, i === S.sel, W));
  if (S.dp && (S.cur || S.brush)) { const n = NPTS[S.dp.k] || 0, ex = S.cur ? [{ t: S.cur.t, p: S.cur.p }] : []; const pts = [...S.dp.pts]; while (pts.length < n && ex.length) pts.push(ex[0]); renderShape({ ...S.dp, pts }, false, W); }
  ctx.restore(); requestAnimationFrame(render);
}
render();
