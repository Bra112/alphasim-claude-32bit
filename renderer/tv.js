// TradingView-style shell for the Backtesting window: toolbars, menus, dialogs, collapsible panels, replay flow.
const IC = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l5 5"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  cam: '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/>', full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  replay: '<path d="M3 12l7-6v12zM11 12l7-6v12z"/>', undo: '<path d="M9 7L4 12l5 5M4 12h10a6 6 0 010 8"/>', redo: '<path d="M15 7l5 5-5 5M20 12H10a6 6 0 000 8"/>',
  ind: '<path d="M3 17l5-6 4 3 5-8 4 4"/>', layout: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M12 4v16"/>', panel: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M15 4v16"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>', stepf: '<path d="M6 5v14l9-7zM18 5v14"/>', stepb: '<path d="M18 5v14l-9-7zM6 5v14"/>',
  chevl: '<path d="M15 6l-6 6 6 6"/>', chevr: '<path d="M9 6l6 6-6 6"/>', chevd: '<path d="M6 9l6 6 6-6"/>', chevu: '<path d="M6 15l6-6 6 6"/>',
  cursor: '<path d="M5 3l14 8-6 2-3 6z"/>', trend: '<path d="M5 19L19 5"/><circle cx="5" cy="19" r="1.6"/><circle cx="19" cy="5" r="1.6"/>', ray: '<path d="M5 19L21 3"/><circle cx="5" cy="19" r="1.6"/>',
  ext: '<path d="M3 21L21 3"/><circle cx="9" cy="15" r="1.6"/><circle cx="15" cy="9" r="1.6"/>', hline: '<path d="M3 12h18"/><circle cx="12" cy="12" r="1.6"/>', hray: '<path d="M5 12h16"/><circle cx="5" cy="12" r="1.6"/>',
  vline: '<path d="M12 3v18"/><circle cx="12" cy="12" r="1.6"/>', cross: '<path d="M3 12h18M12 3v18"/>', channel: '<path d="M4 15L16 5M8 20L20 10"/>', fib: '<path d="M3 5h18M3 10h18M3 15h18M3 20h18"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>', ellipse: '<ellipse cx="12" cy="12" rx="9" ry="6"/>', brush: '<path d="M4 20c4 0 4-4 6-6l7-9 3 3-9 7c-2 2-2 5-7 5z"/>',
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>', pos: '<rect x="4" y="4" width="16" height="7" fill="rgba(8,153,129,.35)"/><rect x="4" y="11" width="16" height="9" fill="rgba(242,54,69,.3)"/>',
  measure: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M8 12l2 2M11 9l2 2M14 6l2 2"/>', magnet: '<path d="M6 4v8a6 6 0 0012 0V4h-4v8a2 2 0 01-4 0V4z"/>', stay: '<path d="M4 20l1-4L16 5l3 3L8 19z"/>',
  zin: '<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6M10 7v6M7 10h6"/>', zout: '<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6M7 10h6"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
};
const ic = (n, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${IC[n] || ''}</svg>`;
document.querySelectorAll('[data-ic]').forEach((b) => (b.innerHTML = ic(b.dataset.ic, +b.dataset.s || 18) + (b.dataset.t ? `<span>${b.dataset.t}</span>` : '') + b.innerHTML));

// ---------- modals and pop-up menus ----------
const openModal = (id) => { closeModals(); $('#' + id).classList.add('open'); };
const closeModals = () => document.querySelectorAll('.modal.open').forEach((m) => m.classList.remove('open'));
document.querySelectorAll('.modal').forEach((m) => m.addEventListener('mousedown', (e) => { if (e.target === m) closeModals(); }));
document.querySelectorAll('.mclose').forEach((b) => (b.onclick = closeModals));
const closeMenus = () => document.querySelectorAll('.popmenu').forEach((m) => m.remove());
document.addEventListener('mousedown', (e) => { if (!e.target.closest('.popmenu') && !e.target.closest('[data-pm]')) closeMenus(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModals(); closeMenus(); } });
function popMenu(anchor, items, side) {
  closeMenus(); const m = document.createElement('div'); m.className = 'popmenu';
  m.innerHTML = items.map((it, i) => (it.head ? `<div class="mh">${it.head}</div>` : `<a data-i="${i}" class="${it.on ? 'on' : ''}">${it.icon ? ic(it.icon, 18) : ''}<span>${it.label}</span></a>`)).join('');
  $('#sim').appendChild(m); const r = anchor.getBoundingClientRect();
  m.style.left = Math.min(side === 'right' ? r.right + 4 : r.left, innerWidth - 230) + 'px'; m.style.top = Math.min(side === 'right' ? r.top : r.bottom + 2, innerHeight - m.offsetHeight - 8) + 'px';
  m.onclick = (e) => { const a = e.target.closest('[data-i]'); if (!a) return; closeMenus(); items[+a.dataset.i].fn(); };
}

// ---------- collapsible panels ----------
const UI = { nav: true, tools: true, order: true, bottom: true };
try { Object.assign(UI, JSON.parse(localStorage.getItem('alphasim.ui') || '{}')); } catch {}
function applyUI() { for (const k in UI) document.body.classList.toggle(k + '-off', !UI[k]); try { localStorage.setItem('alphasim.ui', JSON.stringify(UI)); } catch {} setTimeout(resize, 40); }
const togUI = (k) => { UI[k] = !UI[k]; applyUI(); };
['navx', 'tabN', 'navopen'].forEach((i) => ($('#' + i).onclick = () => togUI('nav'))); ['toolx', 'tabL'].forEach((i) => ($('#' + i).onclick = () => togUI('tools')));
['ordx', 'tabR', 'ordtog'].forEach((i) => ($('#' + i).onclick = () => togUI('order'))); ['botx', 'tabB'].forEach((i) => ($('#' + i).onclick = () => togUI('bottom')));
document.querySelectorAll('[data-bt]').forEach((a) => (a.onclick = () => {
  document.querySelectorAll('[data-bt]').forEach((x) => x.classList.toggle('on', x === a)); document.querySelectorAll('.btab').forEach((t) => t.classList.toggle('on', t.id === 'bt_' + a.dataset.bt));
  if (!UI.bottom) togUI('bottom');
}));
applyUI();

// ---------- timeframes, chart type, indicators, layout ----------
const TFS = [[60, '1m'], [300, '5m'], [900, '15m'], [1800, '30m'], [3600, '1h'], [14400, '4h'], [86400, '1D']], tfLabel = (v) => (TFS.find((t) => t[0] === v) || [0, v + 's'])[1];
$('#tfbar').innerHTML = TFS.map(([v, l]) => `<button class="tb" data-tfb="${v}">${l}</button>`).join('');
document.querySelectorAll('[data-tfb]').forEach((b) => (b.onclick = () => { $('#tf').value = b.dataset.tfb; $('#tf').onchange(); }));
function markTf() { document.querySelectorAll('[data-tfb]').forEach((b) => b.classList.toggle('on', +b.dataset.tfb === S.tf)); }
function setWatermark() { chart.applyOptions({ watermark: { visible: !!S.sym, text: S.sym ? `${S.sym}, ${tfLabel(S.tf)}` : '', fontSize: 56, color: 'rgba(120,123,134,0.13)', horzAlign: 'center', vertAlign: 'center' } }); }
const TYPES = [['candle', 'Candles'], ['bar', 'Bars'], ['line', 'Line'], ['area', 'Area']];
const typeLabel = () => ($('#typebtn').textContent = (TYPES.find((t) => t[0] === S.ctype) || TYPES[0])[1]);
$('#typebtn').onclick = (e) => popMenu(e.currentTarget, TYPES.map(([k, l]) => ({ label: l, on: S.ctype === k, fn: () => { S.ctype = k; makeSeries(); typeLabel(); } })));
$('#indbtn').onclick = (e) => popMenu(e.currentTarget, [{ head: 'Add indicator' }, ...Object.keys(INDS).map((n) => ({ label: n, fn: () => (S.ticks.length ? addInd(n) : toast('Start a replay first')) }))]);
$('#c2btn').onclick = (e) => popMenu(e.currentTarget, [{ head: 'Second chart' }, { label: 'Single chart', on: !S.tf2, fn: () => { $('#tf2').value = 0; $('#tf2').onchange(); } }, ...TFS.map(([v, l]) => ({ label: 'Add chart: ' + l, on: S.tf2 === v, fn: () => { $('#tf2').value = v; $('#tf2').onchange(); } }))]);
$('#undo').onclick = () => { const d = S.draw.pop(); if (d) S.redo.push(d); S.sel = -1; }; $('#redo').onclick = () => { const d = S.redo.pop(); if (d) S.draw.push(d); };

// ---------- left drawing toolbar ----------
const GROUPS = [['cursor', [['cursor', 'Cursor']]], ['trend', [['trend', 'Trend line'], ['ray', 'Ray'], ['ext', 'Extended line'], ['hline', 'Horizontal line'], ['hray', 'Horizontal ray'], ['vline', 'Vertical line'], ['cross', 'Cross line'], ['channel', 'Parallel channel']]],
  ['fib', [['fib', 'Fib retracement']]], ['rect', [['rect', 'Rectangle'], ['ellipse', 'Ellipse'], ['brush', 'Brush']]], ['text', [['text', 'Text']]], ['pos', [['pos', 'Long / short position'], ['measure', 'Measure']]]];
const curTool = {}; GROUPS.forEach(([g, it]) => (curTool[g] = it[0][0]));
const ACTS = [['magnet', 'Magnet mode (snap to candle prices)'], ['stay', 'Stay in drawing mode'], ['zin', 'Zoom in'], ['zout', 'Zoom out'], ['lock', 'Lock all drawings'], ['hide', 'Hide all drawings'], ['trash', 'Remove all drawings']];
$('#tools').innerHTML = GROUPS.map(([g, it]) => `<div class="tg"><button data-g="${g}" title="${it[0][1]}">${ic(curTool[g], 22)}</button>${it.length > 1 ? `<i class="tgc" data-gm="${g}" data-pm="1">${ic('chevr', 10)}</i>` : ''}</div>`).join('') +
  '<span class="tsep"></span>' + ACTS.map(([k, t]) => `<button data-a="${k}" title="${t}">${ic(k === 'hide' ? 'eye' : k, 22)}</button>`).join('');
document.querySelectorAll('#tools [data-g]').forEach((b) => (b.onclick = () => setTool(curTool[b.dataset.g])));
document.querySelectorAll('#tools [data-gm]').forEach((c) => (c.onclick = () => { const it = GROUPS.find((x) => x[0] === c.dataset.gm)[1]; popMenu(c, it.map(([k, l]) => ({ label: l, icon: k, on: S.tool === k, fn: () => setTool(k) })), 'right'); }));
const zoom = (f) => ts.applyOptions({ barSpacing: Math.max(1, Math.min(80, ts.options().barSpacing * f)) });
document.querySelectorAll('#tools [data-a]').forEach((b) => (b.onclick = () => {
  const k = b.dataset.a;
  if (k === 'zin') zoom(1.25); else if (k === 'zout') zoom(0.8); else if (k === 'trash') { S.draw = []; S.sel = -1; S.redo = []; } else S[k] = !S[k];
  markTools();
}));
function markTools() {
  document.querySelectorAll('#tools [data-g]').forEach((b) => { const ids = GROUPS.find((x) => x[0] === b.dataset.g)[1].map((i) => i[0]), on = ids.includes(S.tool); b.classList.toggle('on', on); if (on && curTool[b.dataset.g] !== S.tool) { curTool[b.dataset.g] = S.tool; b.innerHTML = ic(S.tool, 22); } });
  ['magnet', 'stay', 'lock', 'hide'].forEach((k) => { const b = document.querySelector(`#tools [data-a="${k}"]`); if (b) b.classList.toggle('on', !!S[k]); });
}
markTools();

// ---------- symbol search and replay ----------
function renderSymList() {
  const q = $('#symq').value.trim().toUpperCase(), rows = S.avail.filter((a) => !q || a.symbol.includes(q));
  $('#symlist').innerHTML = rows.map((a) => `<div class="symrow" data-s="${a.symbol}"><b>${a.symbol}</b><span class="dim">${a.from} to ${a.to}</span><span class="tag">${a.imported ? 'Ready' : 'Downloaded'}</span></div>`).join('') || '<div class="empty">No tick data yet.<br>Download it in the Data center first.</div>';
  $('#symlist').querySelectorAll('[data-s]').forEach((r) => (r.onclick = () => { S.pick = r.dataset.s; $('#symname').textContent = S.pick; closeModals(); openReplay(); }));
}
$('#symq').oninput = renderSymList;
$('#symbtn').onclick = async () => { await refreshData(); openModal('m_sym'); $('#symq').value = ''; renderSymList(); $('#symq').focus(); };
$('#emptysym').onclick = () => $('#symbtn').click(); $('#emptydata').onclick = () => go('data');
async function openReplay() {
  if (!S.pick) return $('#symbtn').click(); if (!S.avail.length) await refreshData();
  const a = S.avail.find((x) => x.symbol === S.pick); if (!a) return toast('No data for ' + S.pick);
  const d = $('#rdate'); d.min = a.from; d.max = a.to; const def = addDays(a.from, 3) > a.to ? a.from : addDays(a.from, 3);
  if (S.sym === S.pick && S.simT) d.value = new Date(S.simT).toISOString().slice(0, 10); else if (!d.value || d.value < a.from || d.value > a.to) d.value = def;
  $('#rsym').textContent = S.pick; $('#rinfo').textContent = `Data available from ${a.from} to ${a.to}.`; openModal('m_replay');
}
$('#replaybtn').onclick = openReplay; $('#rpdate').onclick = openReplay; $('#rchange').onclick = () => $('#symbtn').click();
$('#rstart').onclick = async () => { if (!$('#rdate').value) return toast('Pick a start date'); closeModals(); await startReplay(S.pick, $('#rdate').value, $('#rtime').value); };
function setReplayUI(on) { $('#replaybar').style.display = on ? 'flex' : 'none'; $('#empty').style.display = S.ticks.length ? 'none' : 'flex'; }
$('#rpexit').onclick = () => { S.play = false; playLbl(0); setReplayUI(false); };
setReplayUI(false);

// ---------- legend (symbol, OHLC, indicators) ----------
const findC = (t) => { const a = S.candles; let lo = 0, hi = a.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (a[m].time === t) return a[m]; if (a[m].time < t) lo = m + 1; else hi = m - 1; } return null; };
chart.subscribeCrosshairMove((p) => { S.hover = p && p.time ? findC(p.time) : null; });
let lgKey = '';
setInterval(() => {
  const c = S.hover || S.candles[S.candles.length - 1], key = c ? [S.sym, S.tf, c.time, c.open, c.high, c.low, c.close].join() : 'x'; if (key === lgKey) return; lgKey = key;
  const f = (v) => v.toFixed(S.prec);
  $('#lgd').innerHTML = c ? `<b>${S.sym}</b> <span class="dim">${tfLabel(S.tf)}</span> <span class="${cls(c.close - c.open)}">O ${f(c.open)} H ${f(c.high)} L ${f(c.low)} C ${f(c.close)} (${((c.close - c.open) / S.pip1()).toFixed(1)} pips)</span>` : '';
}, 120);
S.pip1 = () => E.pip(S.sym) || 1e-4;

// ---------- settings, save, open, image, full screen ----------
let SET = { win: 7, up: '#089981', dn: '#f23645', grid: true }; try { Object.assign(SET, JSON.parse(localStorage.getItem('alphasim.set') || '{}')); } catch {}
function applySet(save) {
  candleOpts.upColor = candleOpts.wickUpColor = SET.up; candleOpts.downColor = candleOpts.wickDownColor = SET.dn;
  if (S.ctype === 'candle') series.applyOptions(candleOpts); series2.applyOptions(candleOpts);
  [chart, chart2].forEach((c) => c.applyOptions({ grid: { vertLines: { visible: SET.grid }, horzLines: { visible: SET.grid } } }));
  if (save) try { localStorage.setItem('alphasim.set', JSON.stringify(SET)); } catch {}
}
$('#set_win').value = SET.win; $('#set_up').value = SET.up; $('#set_dn').value = SET.dn; $('#set_grid').checked = SET.grid; applySet(false);
$('#set_win').oninput = () => { SET.win = +$('#set_win').value || 7; applySet(true); }; $('#set_up').oninput = () => { SET.up = $('#set_up').value; applySet(true); };
$('#set_dn').oninput = () => { SET.dn = $('#set_dn').value; applySet(true); }; $('#set_grid').onchange = () => { SET.grid = $('#set_grid').checked; applySet(true); };
$('#set_theme').value = theme; $('#set_theme').onchange = () => setTheme($('#set_theme').value); themeCbs.push(() => ($('#set_theme').value = theme));
$('#setbtn').onclick = () => openModal('m_set'); $('#openm').onclick = async () => { await refreshSims(); openModal('m_open'); }; $('#savem').onclick = () => { if (!S.sym) return toast('Start a replay first'); openModal('m_save'); $('#simname').focus(); };
$('#snapbtn').onclick = () => {
  try { const c = chart.takeScreenshot(); c.getContext('2d').drawImage(ov, 0, 0, c.width, c.height * 1); c.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `AlphaSim_${S.sym || 'chart'}_${Date.now()}.png`; document.body.appendChild(a); a.click(); a.remove(); }); } catch { toast('Could not save the image'); }
};
$('#fsbtn').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
markTf(); typeLabel();

// ---------- mouse and keyboard view controls ----------
// Wheel zoom, drag to scroll, dragging the price or time axis to stretch, and double-click axis reset come from the chart library.
let pmode = 0;
const setPM = (m) => { pmode = pmode === m ? 0 : m; chart.priceScale('right').applyOptions({ mode: pmode }); $('#sc_pct').classList.toggle('on', pmode === 2); $('#sc_log').classList.toggle('on', pmode === 1); };
$('#sc_pct').onclick = () => setPM(2); $('#sc_log').onclick = () => setPM(1); $('#sc_auto').onclick = () => chart.priceScale('right').applyOptions({ autoScale: true });
$('#jump').onclick = () => ts.scrollToRealTime();
setInterval(() => { try { $('#jump').style.display = S.candles.length && ts.scrollPosition() < -2 ? 'block' : 'none'; } catch {} }, 250);
addEventListener('keydown', (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable || !$('#sim').classList.contains('on') || e.ctrlKey) return;
  if (e.key === '+' || e.key === '=') zoom(1.25); else if (e.key === '-' || e.key === '_') zoom(0.8); else if (e.key === 'End') ts.scrollToRealTime();
});
