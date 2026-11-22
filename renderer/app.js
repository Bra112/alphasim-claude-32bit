// Core: helpers, theme, navigation, Data center, license.
const $ = (s) => document.querySelector(s), LW = window.LightweightCharts; // window.api (from preload) is used directly: a const named api would clash with it
let lic = { mode: 'demo', demo: { maxDays: 3, canSave: false, symbols: ['EURUSD'] } };
const toast = (m) => { const t = $('#toast'); t.textContent = m; t.style.display = 'block'; setTimeout(() => (t.style.display = 'none'), 3500); };
const money = (v) => (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(2), cls = (v) => (v >= 0 ? 'up' : 'dn');

// ---------- theme ----------
let theme = 'light'; const themeCbs = [];
const chartOpts = () => { const d = theme === 'dark', ln = d ? '#1e222d' : '#f0f3fa', bd = d ? '#2a2e39' : '#e0e3eb';
  return { layout: { background: { color: d ? '#131722' : '#ffffff' }, textColor: '#787b86' }, grid: { vertLines: { color: ln }, horzLines: { color: ln } }, rightPriceScale: { borderColor: bd }, timeScale: { borderColor: bd } }; };
function setTheme(t, save = true) { theme = t; document.documentElement.dataset.theme = t; $('#themebtn').textContent = t === 'dark' ? 'Light theme' : 'Dark theme'; themeCbs.forEach((f) => f()); if (save) api.kvSet({ key: 'prefs', value: { theme: t } }); }
$('#themebtn').onclick = () => setTheme(theme === 'dark' ? 'light' : 'dark');

// ---------- navigation ----------
function go(pg) {
  document.querySelectorAll('[data-page]').forEach((x) => x.classList.toggle('on', x.dataset.page === pg));
  document.querySelectorAll('.page').forEach((x) => x.classList.toggle('on', x.id === pg));
  $('#filters').style.display = ['dash', 'log', 'reports', 'cal'].includes(pg) ? 'flex' : 'none';
  if (pg === 'data' || pg === 'sim') refreshData(); if (pg === 'data') refreshFiles();
  resize(); if (window.Pages) Pages.show(pg);
}
document.querySelectorAll('nav [data-page]').forEach((x) => (x.onclick = () => go(x.dataset.page)));
$('#newsess').onclick = () => go('sim'); $('#mode').onclick = () => go('data');
async function refreshSims() { if (window.Pages) await Pages.refresh(); }

// ---------- Data center ----------
api.onProgress((p) => { $('#pbar').style.width = (p.total ? (p.done / p.total) * 100 : 0) + '%'; $('#pmsg').textContent = p.msg; });
async function refreshFiles() {
  $('#ddir').textContent = await api.getDir(); const g = await api.listFiles();
  $('#ftable').innerHTML = '<tr><th>Provider</th><th>Symbol</th><th>Files</th><th>From</th><th>To</th><th>Size</th><th></th></tr>' + (g.map((x, i) =>
    `<tr><td>${x.provider}</td><td>${x.symbol}</td><td>${x.files}</td><td>${x.from}</td><td>${x.to}</td><td>${(x.size / 1048576).toFixed(1)} MB</td><td><button data-i="${i}">Import</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">No downloaded files yet</td></tr>');
  document.querySelectorAll('#ftable [data-i]').forEach((b) => (b.onclick = async () => {
    const x = g[b.dataset.i]; b.disabled = true; $('#pmsg').textContent = 'Importing...';
    const r = await api.importFolder({ provider: x.provider, symbol: x.symbol, from: $('#ifrom').value, to: $('#ito').value });
    $('#pmsg').textContent = r.ok ? `Imported ${r.ticks.toLocaleString()} ticks from ${r.files} file(s)` : r.error; b.disabled = false; refreshData();
  }));
}
let dlBusy = false;
$('#dgo').onclick = async () => {
  if (dlBusy) return; const o = { provider: $('#dprov').value, symbol: $('#dsym').value.trim().toUpperCase(), from: $('#dfrom').value, to: $('#dto').value };
  if (!o.symbol || !o.from || !o.to || o.from > o.to) return toast('Pick a symbol and a valid date range');
  dlBusy = true; $('#dgo').disabled = true; $('#pmsg').textContent = 'Starting...';
  const r = await api.download(o); dlBusy = false; $('#dgo').disabled = false; $('#pmsg').textContent = r.ok ? r.summary : r.error; if (r.ok) $('#pbar').style.width = '100%'; refreshFiles();
};
$('#dstop').onclick = () => api.cancelDownload();
$('#dchg').onclick = async () => { await api.chooseDir(); refreshFiles(); }; $('#dopen').onclick = () => api.openDir();
$('#dimp').onclick = async () => { const r = await api.importData({ symbol: $('#dsym').value.trim() || 'EURUSD' }); $('#pmsg').textContent = r.ok ? `Imported ${r.ticks.toLocaleString()} ticks` : r.error; refreshFiles(); refreshData(); };
$('#dohlc').onclick = async () => { const r = await api.importCandles({ symbol: $('#dsym').value.trim() || 'EURUSD', spread: +$('#dspread').value || 0 }); $('#pmsg').textContent = r.ok ? `Imported ${r.candles.toLocaleString()} candles as ticks` : r.error; refreshFiles(); refreshData(); };
$('#dexp').onclick = async () => { const r = await api.exportTicks({ symbol: $('#dsym').value.trim().toUpperCase(), from: $('#dfrom').value, to: $('#dto').value }); $('#pmsg').textContent = r.ok ? `Exported ${r.rows.toLocaleString()} ticks` : r.error; };
$('#dgap').onclick = async () => {
  const r = await api.checkGaps({ provider: $('#dprov').value, symbol: $('#dsym').value.trim().toUpperCase(), from: $('#dfrom').value, to: $('#dto').value }); if (!r.ok) return toast(r.error);
  const fmt = (a) => (a.length ? `${a.length} missing: ${a.slice(0, 40).join(', ')}${a.length > 40 ? ' ...' : ''}` : 'none missing');
  $('#gapout').innerHTML = `<div><b>Ready for Backtesting:</b> ${fmt(r.store)}</div><div><b>Downloaded files:</b> ${fmt(r.files)}</div><small>Weekdays only. Market holidays show up as gaps.</small>`;
};

// ---------- license ----------
async function refreshLic() {
  lic = await api.getLicense(); const full = lic.mode === 'full';
  $('#mode').innerHTML = full ? '<b>Full version</b>' + (lic.enforced === false ? '<br>All features unlocked' : '') : '<b>Demo mode</b><br>EURUSD, 3-day range, no saving';
  $('#ltxt').textContent = full ? 'Full version is active.' : 'Demo mode is active. Enter a license key to unlock all symbols, any date range and saving.';
}
$('#lgo').onclick = async () => { const r = await api.activate($('#lkey').value); $('#lmsg').textContent = r.ok ? 'Activated' : r.error; await refreshLic(); refreshData(); };

addEventListener('DOMContentLoaded', async () => { // runs after every script has loaded
  const pr = await api.kvGet('prefs'); await refreshLic(); setTheme((pr && pr.theme) || 'light', false);
  await refreshData(); await refreshSims(); resize(); ui(); $('#otype').onchange();
});
