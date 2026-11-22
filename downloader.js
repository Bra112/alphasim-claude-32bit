const fs = require('fs'), path = require('path'), AdmZip = require('adm-zip');
const http = require('http'), https = require('https');
// Electron 22 (needed for Windows 7) runs Node 16, which has no global fetch. This small stand-in covers what the downloader uses.
function nodeFetch(url, opts = {}, hops = 0) {
  return new Promise((resolve, reject) => {
    const u = new URL(url), lib = u.protocol === 'https:' ? https : http, body = opts.body ? String(opts.body) : null, headers = { ...(opts.headers || {}) };
    if (body) { headers['Content-Type'] = headers['Content-Type'] || 'application/x-www-form-urlencoded'; headers['Content-Length'] = Buffer.byteLength(body); }
    const req = lib.request(u, { method: opts.method || 'GET', headers }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && hops < 5) {
        res.resume(); return resolve(nodeFetch(new URL(res.headers.location, u).href, res.statusCode >= 307 ? opts : { headers: opts.headers, signal: opts.signal }, hops + 1));
      }
      const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('error', reject);
      res.on('end', () => { const buf = Buffer.concat(chunks); resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, headers: { get: (k) => res.headers[String(k).toLowerCase()] || null },
        arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), text: async () => buf.toString('utf8') }); });
    });
    req.on('error', reject);
    if (opts.signal) { const ab = () => { req.destroy(); reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); }; if (opts.signal.aborted) return ab(); opts.signal.addEventListener('abort', ab, { once: true }); }
    if (body) req.write(body); req.end();
  });
}
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0 Safari/537.36', Accept: '*/*' };
const doFetch = (u, o = {}) => { const x = { ...o, headers: { ...UA, ...(o.headers || {}) } }; return typeof globalThis.fetch === 'function' ? globalThis.fetch(u, x) : nodeFetch(u, x); };
let stop = false, ctl = null;
exports.cancel = () => { stop = true; try { ctl && ctl.abort(); } catch {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wait = async (ms) => { const end = Date.now() + ms; while (Date.now() < end) { if (stop) throw new Error('Cancelled'); await sleep(Math.min(250, end - Date.now())); } };
const pad = (n) => String(n).padStart(2, '0'), dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const safeDir = (d) => { try { return fs.readdirSync(d); } catch { return []; } };
const FILE_RE = /\.(csv|zip|txt)$/i, KEY_RE = /(\d{4}-\d\d(?:-\d\d)?)/;
const readF64 = (f) => { const b = fs.readFileSync(f); return new Float64Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
function writeAtomic(f, data) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.part', data); fs.renameSync(f + '.part', f); } // never leaves half-written files

// ---- simulator tick store (one binary file per symbol per day, duplicates removed) ----
function sortTriplets(a) {
  const ix = Array.from({ length: a.length / 3 }, (_, i) => i).sort((x, y) => a[x * 3] - a[y * 3]), o = []; let pt = -1, pb = -1, pk = -1;
  for (const s of ix) { const t = a[s * 3], b = a[s * 3 + 1], k = a[s * 3 + 2]; if (t === pt && b === pb && k === pk) continue; o.push(t, b, k); pt = t; pb = b; pk = k; }
  return Float64Array.from(o);
}
function saveTicks(dir, sym, flat) {
  const days = new Map();
  for (let i = 0; i < flat.length; i += 3) { const d = dayOf(flat[i]); if (!days.has(d)) days.set(d, []); days.get(d).push(flat[i], flat[i + 1], flat[i + 2]); }
  fs.mkdirSync(path.join(dir, sym), { recursive: true });
  for (const [d, arr] of days) {
    const f = path.join(dir, sym, d + '.bin'); let all = Float64Array.from(arr);
    if (fs.existsSync(f)) { const old = readF64(f), m = new Float64Array(old.length + all.length); m.set(old); m.set(all, old.length); all = m; }
    const out = sortTriplets(all); fs.writeFileSync(f, Buffer.from(out.buffer, out.byteOffset, out.byteLength));
  }
}

// ---- network: retries with growing pauses when the server is busy ----
async function fetchRetry(url, opts, st, label) {
  for (let a = 0; a < 7; a++) {
    if (stop) throw new Error('Cancelled');
    let ra = 0;
    try {
      ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 30000);
      const r = await doFetch(url, { ...opts, signal: ctl.signal }); clearTimeout(to);
      if (r.status === 404) return null;
      if (r.ok) { st.delay = Math.max(150, st.delay * 0.9); return r; }
      if (r.status !== 429 && r.status < 500) throw Object.assign(new Error('Server answered HTTP ' + r.status), { fatal: true });
      ra = +r.headers.get('retry-after') || 0;
    } catch (e) { if (stop) throw new Error('Cancelled'); if (e.fatal) throw e; }
    st.delay = Math.min(3000, st.delay * 2); // slow down after a busy answer
    const w = Math.max(ra * 1000, Math.min(60000, 1000 * 2 ** a) + Math.random() * 500);
    st.emit(`Server busy. Pausing ${Math.round(w / 1000)}s, then retrying (${label})`); await wait(w);
  }
  throw new Error('The server is busy right now. Everything downloaded so far is saved. Press Download again later and it continues where it stopped.');
}

// ---- Dukascopy: hourly bi5 cached on disk, one finished CSV per day ----
const divisor = (s) => (/JPY$|^XA[UG]/.test(s) ? 1000 : 100000);
async function duka(dl, o, st) {
  const sym = o.symbol.toUpperCase(), div = divisor(sym), dig = div === 1000 ? 3 : 5, today = Date.parse(dayOf(Date.now())), days = [];
  for (let t = Date.parse(o.from); t <= Date.parse(o.to); t += 864e5) { if (new Date(t).getUTCDay() === 6) st.weekend++; else days.push(t); }
  st.total = days.length;
  for (const t of days) {
    if (stop) throw new Error('Cancelled');
    const day = dayOf(t), dow = new Date(t).getUTCDay(), out = path.join(dl, 'dukascopy', sym, `${sym}_${day}.csv`); st.done++;
    if (fs.existsSync(out)) { st.cached++; st.emit(`${sym} ${day} already downloaded`); continue; }
    if (t >= today) { st.future++; continue; }
    const recent = t >= today - 864e5, hours = [];
    for (let h = 0; h < 24; h++) {
      if ((dow === 0 && h < 21) || (dow === 5 && h >= 22)) continue; // forex is closed
      const base = path.join(dl, '.cache', 'dukascopy', sym, day, pad(h) + 'h'); hours.push([h, base]);
      if (fs.existsSync(base + '.bi5') || fs.existsSync(base + '.none')) continue; // already cached
      st.emit(`${sym} ${day} ${pad(h)}:00`);
      const r = await fetchRetry(`https://datafeed.dukascopy.com/datafeed/${sym}/${new Date(t).getUTCFullYear()}/${pad(new Date(t).getUTCMonth())}/${pad(new Date(t).getUTCDate())}/${pad(h)}h_ticks.bi5`, {}, st, `${day} ${pad(h)}h`);
      const b = r ? Buffer.from(await r.arrayBuffer()) : null;
      if (b && b.length) writeAtomic(base + '.bi5', b); else if (!recent) writeAtomic(base + '.none', '');
      await wait(st.delay);
    }
    if (!hours.every(([, b]) => fs.existsSync(b + '.bi5') || fs.existsSync(b + '.none'))) { st.partial++; continue; } // finish on next run
    const lines = ['time,bid,ask,bid_volume,ask_volume'];
    for (const [h, base] of hours) {
      if (!fs.existsSync(base + '.bi5')) continue;
      let raw; try { raw = require('./lzma.js').decompress(fs.readFileSync(base + '.bi5')); } catch { fs.unlinkSync(base + '.bi5'); throw new Error(`Damaged cache file for ${day} ${pad(h)}h was removed. Press Download again.`); }
      const b0 = t + h * 36e5;
      for (let i = 0; i + 20 <= raw.length; i += 20) lines.push(`${new Date(b0 + raw.readUInt32BE(i)).toISOString()},${(raw.readUInt32BE(i + 8) / div).toFixed(dig)},${(raw.readUInt32BE(i + 4) / div).toFixed(dig)},${raw.readFloatBE(i + 16).toFixed(2)},${raw.readFloatBE(i + 12).toFixed(2)}`);
    }
    writeAtomic(out, lines.join('\n') + '\n'); fs.rmSync(path.join(dl, '.cache', 'dukascopy', sym, day), { recursive: true, force: true });
    if (lines.length === 1) st.empty++; else st.files++;
  }
}

// ---- HistData: one CSV per month (their times are EST without DST; the importer converts) ----
async function hist(dl, o, st) {
  const sym = o.symbol.toUpperCase(), a = new Date(o.from), b = new Date(o.to), now = new Date(), months = [];
  for (let y = a.getUTCFullYear(), m = a.getUTCMonth(); y < b.getUTCFullYear() || (y === b.getUTCFullYear() && m <= b.getUTCMonth()); m++) { if (m > 11) { m = 0; y++; } months.push([y, m + 1]); }
  st.total = months.length;
  for (const [y, m] of months) {
    if (stop) throw new Error('Cancelled'); st.done++;
    const out = path.join(dl, 'histdata', sym, `${sym}_${y}-${pad(m)}.csv`);
    if (fs.existsSync(out)) { st.cached++; continue; }
    if (y > now.getUTCFullYear() || (y === now.getUTCFullYear() && m >= now.getUTCMonth() + 1)) { st.future++; continue; } // month not finished
    st.emit(`${sym} ${y}-${pad(m)}`);
    const page = `http://www.histdata.com/download-free-forex-historical-data/?/ascii/tick-data-quotes/${sym.toLowerCase()}/${y}/${m}`;
    const r = await fetchRetry(page, {}, st, `${y}-${pad(m)}`), tk = r && /id="tk"[^>]*value="([^"]+)"/.exec(await r.text());
    if (!tk) { st.missing++; continue; }
    const body = new URLSearchParams({ tk: tk[1], date: String(y), datemonth: `${y}${pad(m)}`, platform: 'ASCII', timeframe: 'T', fxpair: sym });
    const r2 = await fetchRetry('http://www.histdata.com/get_file.php', { method: 'POST', body, headers: { Referer: page } }, st, `${y}-${pad(m)} file`);
    if (!r2) { st.missing++; continue; }
    const z = new AdmZip(Buffer.from(await r2.arrayBuffer())), e = z.getEntries().find((x) => /\.csv$/i.test(x.entryName));
    if (e) { writeAtomic(out, z.readFile(e)); st.files++; } else st.missing++;
    await wait(st.delay * 3);
  }
}
exports.download = async (dl, o, prog) => {
  stop = false;
  if (o.provider === 'truefx') throw new Error('TrueFX needs a free login, so it cannot be downloaded here. Download the monthly zip from truefx.com and use "Import files".');
  const st = { delay: 150, done: 0, total: 0, files: 0, cached: 0, empty: 0, weekend: 0, future: 0, partial: 0, missing: 0 };
  st.emit = (msg) => prog({ done: st.done, total: st.total, msg });
  const sum = (pre) => `${pre}${st.files} new file${st.files === 1 ? '' : 's'}, ${st.cached} already downloaded, ${st.weekend} weekend day${st.weekend === 1 ? '' : 's'} skipped` +
    (st.empty ? `, ${st.empty} day(s) without data` : '') + (st.partial ? `, ${st.partial} recent day(s) will finish on the next run` : '') + (st.future ? `, ${st.future} not published yet` : '') + (st.missing ? `, ${st.missing} not available` : '') + '.';
  try { await (o.provider === 'histdata' ? hist : duka)(dl, o, st); } catch (e) { if (e.message === 'Cancelled') return sum('Stopped, progress is saved. '); throw e; }
  return sum('Done. ');
};

// ---- CSV parsing: AlphaSim/Dukascopy, HistData and TrueFX layouts ----
function parse(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const p = line.split(','); if (p.length < 3) continue; let t, bid, ask, m;
    if (/^\d{4}-\d\d-\d\dT/.test(p[0])) { t = Date.parse(p[0]); bid = +p[1]; ask = +p[2]; }
    else if (p[0].includes('/')) { // TrueFX: EUR/USD,20240102 00:00:00.123,bid,ask
      m = /^(\d{4})(\d\d)(\d\d) (\d\d):(\d\d):(\d\d)\.?(\d*)/.exec(p[1]); if (!m) continue;
      t = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6], +(m[7] || '0').padEnd(3, '0').slice(0, 3)); bid = +p[2]; ask = +p[3];
    } else { // HistData: 20240102 170000123,bid,ask,vol
      m = /^(\d{4})(\d\d)(\d\d) (\d\d)(\d\d)(\d\d)(\d{0,3})/.exec(p[0]); if (!m) continue;
      t = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6], +(m[7] || '0').padEnd(3, '0')) + 5 * 36e5; bid = +p[1]; ask = +p[2];
    }
    if (t && bid && ask) out.push(t, bid, ask);
  }
  return out;
}
// ---- candle (OHLC) CSV: needs a header row (time,open,high,low,close) or MT4 export layout (date,time,o,h,l,c) ----
function parseTime(s) {
  if (/^\d{9,13}$/.test(s)) return +s < 1e11 ? +s * 1000 : +s;
  let m = /^(\d\d)\.(\d\d)\.(\d{4})[ T](\d\d):(\d\d)(?::(\d\d))?/.exec(s); if (m) return Date.UTC(+m[3], m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0));
  m = /^(\d{4})[.\-/](\d\d)[.\-/](\d\d)[ T](\d\d):(\d\d)(?::(\d\d))?/.exec(s); if (m) return Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  return Date.parse(/Z$|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z');
}
const looksOHLC = (t) => {
  const L = t.split(/\r?\n/).filter(Boolean).slice(0, 3); if (!L.length) return false; const h = L[0].toLowerCase();
  if (/open/.test(h)) return true; if (/bid|ask/.test(h)) return false;
  const p = L[0].split(/[,;\t]/); return p.length >= 6 && /^\d{4}[.\-/]\d\d[.\-/]\d\d$/.test(p[0].trim()) && /^\d\d:\d\d/.test((p[1] || '').trim());
};
function ohlcToTicks(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const p = line.split(/[,;\t]/).map((s) => s.trim()); if (p.length < 5) continue;
    const mt4 = /^\d{4}[.\-/]\d\d[.\-/]\d\d$/.test(p[0]) && /^\d\d:\d\d/.test(p[1] || ''), o = mt4 ? 2 : 1, t = mt4 ? parseTime(p[0] + ' ' + p[1]) : parseTime(p[0]);
    const v = [0, 1, 2, 3].map((i) => +p[o + i]); if (!t || v.some((x) => !x)) continue; rows.push({ t, o: v[0], h: v[1], l: v[2], c: v[3] });
  }
  rows.sort((a, b) => a.t - b.t); let tf = 864e5; for (let i = 1; i < rows.length; i++) { const dt = rows[i].t - rows[i - 1].t; if (dt > 0 && dt < tf) tf = dt; }
  const out = [];
  for (const r of rows) { const seq = r.c >= r.o ? [r.o, r.l, r.h, r.c] : [r.o, r.h, r.l, r.c], at = [0, tf * 0.25, tf * 0.5, Math.max(tf - 1000, tf * 0.75)]; seq.forEach((px, i) => out.push(r.t + at[i], px, px)); }
  return out;
}
exports.importFiles = (dir, sym, files, prog = () => {}, kind = 'auto', onFile = () => {}) => {
  let n = 0;
  files.forEach((f, i) => {
    prog({ done: i, total: files.length, msg: `Importing ${path.basename(f)} (${i + 1}/${files.length})` });
    const texts = /\.zip$/i.test(f) ? new AdmZip(f).getEntries().filter((e) => /\.(csv|txt)$/i.test(e.entryName)).map((e) => e.getData().toString('utf8')) : [fs.readFileSync(f, 'utf8')];
    for (const t of texts) { const flat = kind === 'ohlc' || (kind !== 'ticks' && looksOHLC(t)) ? ohlcToTicks(t) : parse(t); n += flat.length / 3; if (flat.length) saveTicks(dir, sym.toUpperCase(), flat); }
    onFile(f);
  });
  prog({ done: files.length, total: files.length, msg: 'Import finished' });
  return n;
};
exports.listFiles = (dl) => {
  const out = [];
  for (const prov of safeDir(dl)) {
    if (prov.startsWith('.')) continue;
    for (const sym of safeDir(path.join(dl, prov))) {
      const d = path.join(dl, prov, sym), fl = safeDir(d).filter((f) => FILE_RE.test(f));
      if (!fl.length) continue;
      const keys = fl.map((f) => (KEY_RE.exec(f) || [])[1]).filter(Boolean).sort();
      out.push({ provider: prov, symbol: sym, files: fl.length, from: keys[0] || '-', to: keys[keys.length - 1] || '-', size: fl.reduce((a, f) => a + fs.statSync(path.join(d, f)).size, 0) });
    }
  }
  return out;
};
exports.importFolder = (dataDir, dl, o, prog, done) => {
  const d = path.join(dl, o.provider, o.symbol);
  const files = safeDir(d).filter((f) => FILE_RE.test(f)).sort().filter((f) => { const k = (KEY_RE.exec(f) || [])[1]; return !k || ((!o.from || k >= o.from.slice(0, k.length)) && (!o.to || k <= o.to.slice(0, k.length))); });
  if (!files.length) throw new Error('No downloaded files in that range');
  const key = (f) => { const s = fs.statSync(f); return f + '|' + s.size + '|' + Math.round(s.mtimeMs); };
  let paths = files.map((f) => path.join(d, f)); if (o.onlyNew && done) paths = paths.filter((f) => !done[key(f)]);
  if (!paths.length) return { ticks: 0, files: 0 };
  return { ticks: exports.importFiles(dataDir, o.symbol, paths, prog, 'auto', (f) => { if (done) done[key(f)] = 1; }), files: paths.length };
};
exports.listData = (dir) => safeDir(dir).map((s) => { const d = safeDir(path.join(dir, s)).filter((f) => f.endsWith('.bin')).map((f) => f.slice(0, 10)).sort(); return { symbol: s, days: d.length, from: d[0], to: d[d.length - 1] }; }).filter((x) => x.days);
exports.loadTicks = (dir, sym, from, to) => {
  const parts = [];
  for (let t = Date.parse(from); t <= Date.parse(to); t += 864e5) { const f = path.join(dir, sym, dayOf(t) + '.bin'); if (fs.existsSync(f)) parts.push(fs.readFileSync(f)); }
  return Buffer.concat(parts);
};

exports.listGaps = (dl, provider, symbol) => {
  const d = path.join(dl, provider, symbol), keys = safeDir(d).map((f) => (KEY_RE.exec(f) || [])[1]).filter(Boolean).sort(), have = new Set(keys), miss = [];
  if (!keys.length) return { missing: [], note: 'No files' };
  if (keys[0].length === 7) { let [y, m] = keys[0].split('-').map(Number); const [ey, em] = keys[keys.length - 1].split('-').map(Number); for (; y < ey || (y === ey && m <= em); m++) { if (m > 12) { m = 1; y++; } const k = `${y}-${pad(m)}`; if (!have.has(k)) miss.push(k); } }
  else for (let t = Date.parse(keys[0]); t <= Date.parse(keys[keys.length - 1]); t += 864e5) { const k = dayOf(t); if (new Date(t).getUTCDay() !== 6 && !have.has(k)) miss.push(k); }
  return { missing: miss.slice(0, 300), total: miss.length, first: keys[0], last: keys[keys.length - 1] };
};
exports.exportCsv = (dir, sym, from, to, out) => {
  fs.writeFileSync(out, 'time,bid,ask\n'); let n = 0;
  for (let t = Date.parse(from); t <= Date.parse(to); t += 864e5) {
    const f = path.join(dir, sym, dayOf(t) + '.bin'); if (!fs.existsSync(f)) continue; const k = readF64(f), L = [];
    for (let i = 0; i < k.length; i += 3) L.push(`${new Date(k[i]).toISOString()},${k[i + 1]},${k[i + 2]}`);
    fs.appendFileSync(out, L.join('\n') + '\n'); n += L.length;
  }
  return n;
};

exports.exportTicks = (dir, sym, from, to, out) => {
  fs.writeFileSync(out, 'time,bid,ask\n'); let n = 0;
  for (let t = Date.parse(from); t <= Date.parse(to); t += 864e5) {
    const f = path.join(dir, sym, dayOf(t) + '.bin'); if (!fs.existsSync(f)) continue;
    const a = readF64(f), parts = []; for (let i = 0; i < a.length; i += 3) parts.push(`${new Date(a[i]).toISOString()},${a[i + 1]},${a[i + 2]}`);
    n += parts.length; if (parts.length) fs.appendFileSync(out, parts.join('\n') + '\n');
  }
  return n;
};
exports.checkGaps = (dir, dl, o) => {
  const sym = o.symbol, store = [], files = [], seen = new Set();
  for (let t = Date.parse(o.from); t <= Date.parse(o.to); t += 864e5) {
    const dow = new Date(t).getUTCDay(), d = dayOf(t); if (dow === 0 || dow === 6) continue;
    if (!fs.existsSync(path.join(dir, sym, d + '.bin'))) store.push(d);
    if (o.provider === 'dukascopy' && !fs.existsSync(path.join(dl, 'dukascopy', sym, `${sym}_${d}.csv`))) files.push(d);
    if (o.provider === 'histdata' && !seen.has(d.slice(0, 7))) { seen.add(d.slice(0, 7)); if (!fs.existsSync(path.join(dl, 'histdata', sym, `${sym}_${d.slice(0, 7)}.csv`))) files.push(d.slice(0, 7)); }
  }
  return { store, files };
};
exports.importCandles = (dir, sym, files, spreadPips, prog = () => {}) => {
  const E = require('./renderer/engine.js'); sym = sym.toUpperCase(); let n = 0;
  files.forEach((f, i) => {
    prog({ done: i, total: files.length, msg: `Importing candles ${path.basename(f)} (${i + 1}/${files.length})` });
    const texts = /\.zip$/i.test(f) ? new AdmZip(f).getEntries().filter((e) => /\.(csv|txt)$/i.test(e.entryName)).map((e) => e.getData().toString('utf8')) : [fs.readFileSync(f, 'utf8')];
    for (const t of texts) { const rows = E.parseOHLC(t); if (!rows.length) continue; n += rows.length; saveTicks(dir, sym, E.ohlcTicks(rows, spreadPips * E.pip(sym))); }
  });
  prog({ done: files.length, total: files.length, msg: 'Import finished' });
  return n;
};

exports._nodeFetch = nodeFetch;
