const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path'), fs = require('fs');
const dl = require('./downloader'), lic = require('./license');
const root = () => app.getPath('userData');
const dataDir = () => path.join(root(), 'data'), simDir = () => path.join(root(), 'sims');
const safe = (n) => String(n).replace(/[^\w\- ]/g, '_').slice(0, 80);
let win;
app.whenReady().then(() => {
  if (app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR) { try { const { autoUpdater } = require('electron-updater'); autoUpdater.checkForUpdatesAndNotify().catch(() => {}); } catch {} } // silent when offline
  win = new BrowserWindow({ width: 1440, height: 900, minWidth: 1100, minHeight: 700, backgroundColor: '#0e0e13', title: 'AlphaSim', icon: path.join(__dirname, 'build', 'icon.png'), icon: path.join(__dirname, 'build', 'icon.png'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false } });
  const log = (s) => { try { fs.mkdirSync(root(), { recursive: true }); fs.appendFileSync(path.join(root(), 'log.txt'), new Date().toISOString() + ' ' + s + '\n'); } catch {} };
  win.webContents.on('preload-error', (e, p, err) => log('preload-error ' + p + ' ' + (err && err.stack || err)));
  win.webContents.on('console-message', (e, level, msg, line, src) => { if (level >= 2) log('renderer ' + msg + ' (' + String(src).split('/').pop() + ':' + line + ')'); });
  win.webContents.on('before-input-event', (e, i) => { if (i.type === 'keyDown' && (i.key === 'F12' || (i.control && i.shift && String(i.key).toLowerCase() === 'i'))) win.webContents.toggleDevTools(); });
  win.loadFile('renderer/index.html');
});
app.on('window-all-closed', () => app.quit());
const wrap = (fn) => async (e, o) => { try { return await fn(e, o); } catch (err) { return { ok: false, error: String(err.message || err) }; } };
ipcMain.handle('data:list', () => dl.listData(dataDir()));
ipcMain.handle('data:cancel', () => dl.cancel());
const settings = () => { try { return JSON.parse(fs.readFileSync(kvf('settings'), 'utf8')); } catch { return {}; } };
const dlDir = () => { const d = settings().dlDir || path.join(app.getPath('documents'), 'AlphaSim', 'Downloads'); fs.mkdirSync(d, { recursive: true }); return d; };
const prog = (e) => (p) => e.sender.send('dl:progress', p);
ipcMain.handle('data:download', wrap(async (e, o) => ({ ok: true, summary: await dl.download(dlDir(), o, prog(e)) })));
ipcMain.handle('dir:get', () => dlDir());
ipcMain.handle('dir:open', () => shell.openPath(dlDir()));
ipcMain.handle('dir:choose', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  if (!r.canceled) { fs.mkdirSync(path.join(root(), 'kv'), { recursive: true }); fs.writeFileSync(kvf('settings'), JSON.stringify({ ...settings(), dlDir: r.filePaths[0] })); }
  return dlDir();
});
ipcMain.handle('files:list', () => dl.listFiles(dlDir()));
ipcMain.handle('files:import', wrap((e, o) => {
  let done = {}; try { done = JSON.parse(fs.readFileSync(kvf('imported'), 'utf8')); } catch {}
  const r = dl.importFolder(dataDir(), dlDir(), o, prog(e), done);
  fs.mkdirSync(path.join(root(), 'kv'), { recursive: true }); fs.writeFileSync(kvf('imported'), JSON.stringify(done)); return { ok: true, ...r };
}));
ipcMain.handle('data:import', wrap(async (e, o) => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Tick data', extensions: ['csv', 'txt', 'zip'] }] });
  if (r.canceled) return { ok: false, error: 'Cancelled' };
  const sym = o.symbol.toUpperCase(), to = path.join(dlDir(), 'manual', sym); fs.mkdirSync(to, { recursive: true }); // keep a copy in the downloads folder
  const copies = r.filePaths.map((f) => { const c = path.join(to, path.basename(f)); if (path.resolve(f) !== path.resolve(c)) fs.copyFileSync(f, c); return c; });
  return { ok: true, ticks: dl.importFiles(dataDir(), sym, copies, prog(e), o.kind || 'auto') };
}));
ipcMain.handle('data:load', wrap((e, o) => dl.loadTicks(dataDir(), o.symbol, o.from, o.to)));
ipcMain.handle('lic:get', () => lic.get(root()));
ipcMain.handle('lic:activate', (e, key) => lic.activate(root(), key));
ipcMain.handle('sim:save', wrap((e, sim) => {
  if (lic.get(root()).mode !== 'full') return { ok: false, error: 'Saving is a full version feature' };
  fs.mkdirSync(simDir(), { recursive: true });
  fs.writeFileSync(path.join(simDir(), safe(sim.name) + '.json'), JSON.stringify({ ...sim, updated: Date.now() }));
  return { ok: true };
}));
ipcMain.handle('sim:list', () => {
  try {
    return fs.readdirSync(simDir()).filter((f) => f.endsWith('.json')).map((f) => {
      const d = JSON.parse(fs.readFileSync(path.join(simDir(), f), 'utf8')), h = d.hist || [];
      return { name: d.name, symbol: d.symbol, updated: d.updated, trades: h.length, pnl: h.reduce((a, t) => a + t.pnl, 0), wins: h.filter((t) => t.pnl > 0).length,
        gp: h.filter((t) => t.pnl > 0).reduce((a, t) => a + t.pnl, 0), gl: -h.filter((t) => t.pnl < 0).reduce((a, t) => a + t.pnl, 0) };
    }).sort((a, b) => b.updated - a.updated);
  } catch { return []; }
});
ipcMain.handle('sim:load', wrap((e, name) => ({ ok: true, sim: JSON.parse(fs.readFileSync(path.join(simDir(), safe(name) + '.json'), 'utf8')) })));
ipcMain.handle('sim:delete', wrap((e, name) => { fs.unlinkSync(path.join(simDir(), safe(name) + '.json')); return { ok: true }; }));

ipcMain.handle('trades:all', () => {
  try {
    return fs.readdirSync(simDir()).filter((f) => f.endsWith('.json')).flatMap((f) => {
      const d = JSON.parse(fs.readFileSync(path.join(simDir(), f), 'utf8'));
      return (d.hist || []).map((t) => ({ ...t, sim: d.name, symbol: d.symbol, tf: d.tf, acct: d.acct || '' }));
    });
  } catch { return []; }
});
const kvf = (k) => path.join(root(), 'kv', safe(k) + '.json');
ipcMain.handle('kv:get', (e, k) => { try { return JSON.parse(fs.readFileSync(kvf(k), 'utf8')); } catch { return null; } });
ipcMain.handle('kv:set', wrap((e, o) => { fs.mkdirSync(path.join(root(), 'kv'), { recursive: true }); fs.writeFileSync(kvf(o.key), JSON.stringify(o.value)); return { ok: true }; }));

const attDir = () => { const d = path.join(root(), 'attachments'); fs.mkdirSync(d, { recursive: true }); return d; };
ipcMain.handle('export:save', wrap(async (e, o) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: o.name }); if (r.canceled) return { ok: false, error: 'Cancelled' };
  fs.writeFileSync(r.filePath, o.text, 'utf8'); return { ok: true, path: r.filePath };
}));
ipcMain.handle('import:json', wrap(async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] }); if (r.canceled) return { ok: false, error: 'Cancelled' };
  return { ok: true, text: fs.readFileSync(r.filePaths[0], 'utf8') };
}));
ipcMain.handle('files:gaps', wrap((e, o) => ({ ok: true, ...dl.listGaps(dlDir(), o.provider, o.symbol) })));
ipcMain.handle('ext:open', (e, url) => { if (/^https:\/\/(www\.)?(dukascopy\.com|histdata\.com|truefx\.com)/.test(url)) shell.openExternal(url); });
ipcMain.handle('att:add', wrap(async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }] }); if (r.canceled) return { ok: false, error: 'Cancelled' };
  return { ok: true, names: r.filePaths.map((f) => { const n = Date.now() + '_' + path.basename(f).replace(/[^\w.\-]/g, '_'); fs.copyFileSync(f, path.join(attDir(), n)); return n; }) };
}));
ipcMain.handle('att:save', wrap((e, o) => { const n = Date.now() + '_snapshot.png'; fs.writeFileSync(path.join(attDir(), n), Buffer.from(o.dataUrl.split(',')[1], 'base64')); return { ok: true, names: [n] }; }));
ipcMain.handle('att:read', (e, n) => { try { const f = path.join(attDir(), path.basename(n)), x = path.extname(f).slice(1).toLowerCase().replace('jpg', 'jpeg'); return `data:image/${x};base64,` + fs.readFileSync(f).toString('base64'); } catch { return ''; } });
ipcMain.handle('att:del', (e, n) => { try { fs.unlinkSync(path.join(attDir(), path.basename(n))); } catch {} return true; });

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
ipcMain.handle('file:save', wrap(async (e, o) => { const r = await dialog.showSaveDialog(win, { defaultPath: o.name }); if (r.canceled) return { ok: false, error: 'Cancelled' }; fs.writeFileSync(r.filePath, o.content); return { ok: true }; }));
ipcMain.handle('file:open', wrap(async () => { const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Playbook', extensions: ['json'] }] }); return r.canceled ? { ok: false } : { ok: true, text: fs.readFileSync(r.filePaths[0], 'utf8') }; }));
ipcMain.handle('img:pick', wrap(async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Images', extensions: Object.keys(MIME) }] }); if (r.canceled) return { ok: false };
  const f = r.filePaths[0]; return { ok: true, dataUrl: `data:${MIME[path.extname(f).slice(1).toLowerCase()] || 'image/png'};base64,` + fs.readFileSync(f).toString('base64') };
}));
const shotDir = (k) => path.join(root(), 'shots', safe(k));
ipcMain.handle('shot:save', wrap((e, o) => {
  const m = /^data:image\/(\w+);base64,(.+)$/.exec(o.dataUrl); if (!m) throw new Error('Bad image'); const d = shotDir(o.key); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, Date.now() + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1])), Buffer.from(m[2], 'base64')); return { ok: true };
}));
ipcMain.handle('shot:list', (e, key) => { try { const d = shotDir(key); return fs.readdirSync(d).sort().map((n) => ({ name: n, dataUrl: `data:${MIME[path.extname(n).slice(1)] || 'image/png'};base64,` + fs.readFileSync(path.join(d, n)).toString('base64') })); } catch { return []; } });
ipcMain.handle('shot:del', wrap((e, o) => { fs.unlinkSync(path.join(shotDir(o.key), path.basename(o.name))); return { ok: true }; }));
ipcMain.handle('data:export', wrap(async (e, o) => {
  if (!o.symbol || !o.from || !o.to) throw new Error('Pick symbol and dates'); const r = await dialog.showSaveDialog(win, { defaultPath: `${o.symbol}_${o.from}_${o.to}.csv` });
  return r.canceled ? { ok: false, error: 'Cancelled' } : { ok: true, rows: dl.exportTicks(dataDir(), o.symbol, o.from, o.to, r.filePath) };
}));
ipcMain.handle('data:gaps', wrap((e, o) => { if (!o.symbol || !o.from || !o.to) throw new Error('Pick symbol and dates'); return { ok: true, ...dl.checkGaps(dataDir(), dlDir(), o) }; }));
ipcMain.handle('data:candles', wrap(async (e, o) => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Candle data', extensions: ['csv', 'txt', 'zip'] }] }); if (r.canceled) return { ok: false, error: 'Cancelled' };
  return { ok: true, candles: dl.importCandles(dataDir(), o.symbol, r.filePaths, o.spread, prog(e)) };
}));
app.whenReady().then(() => { if (app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR) { try { require('electron-updater').autoUpdater.checkForUpdatesAndNotify().catch(() => {}); } catch {} } }); // silent when offline
