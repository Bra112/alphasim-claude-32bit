// Pure trading maths (no DOM) so it can be tested in Node. Loaded by the renderer and by main.js.
(function (g) {
  const E = {};
  const jpy = (s) => /JPY$/.test(s);
  E.unit = (s) => (/^XA/.test(s) ? 100 : 100000);
  E.prec = (s) => (/JPY$|^XA/.test(s) ? 3 : 5);
  E.pip = (s) => Math.pow(10, -(E.prec(s) - 1));
  E.pnl = (s, p, px, lots) => { let d = (px - p.entry) * p.dir * (lots ?? p.lots) * E.unit(s); if (jpy(s)) d /= px; return d; };
  E.lotsForRisk = (s, riskUsd, slPips, price) => {
    const perLot = slPips * E.pip(s) * E.unit(s) / (jpy(s) ? price : 1);
    return perLot > 0 ? Math.max(0.01, Math.floor((riskUsd / perLot) * 100) / 100) : 0;
  };
  E.margin = (s, lots, price, lev) => (/USD$|^XA/.test(s) ? lots * E.unit(s) * price : lots * E.unit(s)) / lev;
  E.pendingHit = (kind, price, bid, ask) => ({ buylimit: ask <= price, buystop: ask >= price, selllimit: bid >= price, sellstop: bid <= price }[kind]);
  // one tick against one open position. Mutates p.sl when trailing. Returns {price, why} when it should close.
  E.tickPos = (s, p, bid, ask) => {
    const px = p.dir > 0 ? bid : ask;
    if (p.trail) { const n = p.dir > 0 ? bid - p.trail * E.pip(s) : ask + p.trail * E.pip(s); if (!p.sl || (p.dir > 0 ? n > p.sl : n < p.sl)) p.sl = n; }
    if (p.sl && (p.dir > 0 ? px <= p.sl : px >= p.sl)) return { price: p.sl, why: 'SL' };
    if (p.tp && (p.dir > 0 ? px >= p.tp : px <= p.tp)) return { price: p.tp, why: 'TP' };
    return null;
  };
  // indicators: returns {out:[values aligned to series], state}
  E.indStep = (type, p, c, i, prev) => {
    const cl = c[i].close, win = () => c.slice(i - p + 1, i + 1).map((x) => x.close);
    if (type === 'sma') return { out: [i + 1 >= p ? win().reduce((a, b) => a + b, 0) / p : null], state: null };
    if (type === 'ema') { const k = 2 / (p + 1), e = i === 0 || !prev ? cl : prev.e + k * (cl - prev.e); return { out: [i + 1 >= p ? e : null], state: { e } }; }
    if (type === 'bb') {
      if (i + 1 < p) return { out: [null, null, null], state: null };
      const w = win(), m = w.reduce((a, b) => a + b, 0) / p, sd = Math.sqrt(w.reduce((a, b) => a + (b - m) * (b - m), 0) / p);
      return { out: [m, m + 2 * sd, m - 2 * sd], state: null };
    }
    if (type === 'rsi') {
      if (i === 0) return { out: [null], state: { sg: 0, sl: 0 } };
      const ch = cl - c[i - 1].close, g = Math.max(ch, 0), l = Math.max(-ch, 0), q = prev || { sg: 0, sl: 0 };
      if (i < p) return { out: [null], state: { sg: q.sg + g, sl: q.sl + l } };
      const ag = i === p ? (q.sg + g) / p : (q.ag * (p - 1) + g) / p, al = i === p ? (q.sl + l) / p : (q.al * (p - 1) + l) / p;
      return { out: [al === 0 ? 100 : 100 - 100 / (1 + ag / al)], state: { ag, al } };
    }
    return { out: [], state: null };
  };
  // candle CSV (MT4 history, TradingView, generic) -> rows
  E.parseOHLC = (text) => {
    const rows = [];
    for (const line of text.split(/\r?\n/)) {
      const p = line.trim().split(/[,;\t]/); if (p.length < 5) continue; let ts, n;
      if (/^\d{4}[.\-/]\d\d[.\-/]\d\d$/.test(p[0]) && /^\d\d:\d\d/.test(p[1] || '')) { ts = Date.parse(p[0].replace(/[./]/g, '-') + 'T' + p[1].padEnd(8, ':00').slice(0, 8) + 'Z'); n = p.slice(2, 6); }
      else if (/^\d{10}(\d{3})?$/.test(p[0])) { ts = p[0].length === 10 ? +p[0] * 1000 : +p[0]; n = p.slice(1, 5); }
      else { ts = Date.parse(p[0].replace(' ', 'T').replace(/Z?$/, p[0].includes('T') && /[+-]\d\d:?\d\d$|Z$/.test(p[0]) ? '' : 'Z')); n = p.slice(1, 5); }
      n = n.map(Number); if (!ts || n.some((v) => !isFinite(v) || v <= 0)) continue;
      rows.push({ t: ts, o: n[0], h: n[1], l: n[2], c: n[3] });
    }
    return rows.sort((a, b) => a.t - b.t);
  };
  // candles -> synthetic ticks (O, then low/high first by candle direction, then C), flat [t,bid,ask,...]
  E.ohlcTicks = (rows, spread) => {
    let tf = Infinity; for (let i = 1; i < rows.length; i++) { const d = rows[i].t - rows[i - 1].t; if (d > 0 && d < tf) tf = d; } if (!isFinite(tf)) tf = 60000;
    const out = [];
    for (const r of rows) { const pts = r.c >= r.o ? [r.o, r.l, r.h, r.c] : [r.o, r.h, r.l, r.c]; pts.forEach((p, k) => out.push(r.t + Math.floor((k * tf) / 4), p, p + spread)); }
    return out;
  };
  g.E = E; if (typeof module !== 'undefined' && module.exports) module.exports = E;
})(typeof window !== 'undefined' ? window : globalThis);
