// Shows startup problems on screen instead of failing silently. Press F12 for the full developer console.
(function () {
  let box;
  function show(msg) {
    if (!box) { box = document.createElement('pre'); box.style.cssText = 'position:fixed;z-index:99999;left:0;right:0;top:0;max-height:40%;overflow:auto;margin:0;padding:10px 14px;background:#b3261e;color:#fff;font:12px Consolas,monospace;white-space:pre-wrap'; (document.body || document.documentElement).appendChild(box); box.onclick = () => box.remove(); }
    box.textContent += msg + '\n';
  }
  window.addEventListener('error', (e) => show('Error: ' + (e.message || 'unknown') + ' (' + String(e.filename || '').split('/').pop() + ':' + e.lineno + ')'));
  window.addEventListener('unhandledrejection', (e) => show('Error: ' + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason)));
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.api) show('Startup problem: the bridge to the app (preload) did not load.');
    if (!window.LightweightCharts) show('Startup problem: the chart library did not load.');
  });
})();
