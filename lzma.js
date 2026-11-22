// Small LZMA ("lzma alone", the format Dukascopy .bi5 files use) decoder, so downloads do not depend on a third-party package.
exports.decompress = function (buf) {
  const lo = buf.readUInt32LE(5), hi = buf.readUInt32LE(9), unknown = lo === 0xffffffff && hi === 0xffffffff, size = hi * 4294967296 + lo;
  let d = buf[0]; const lc = d % 9; d = (d / 9) | 0; const lp = d % 5, pb = (d / 5) | 0;
  let ip = 13, range = 0xffffffff, code = 0;
  for (let i = 0; i < 5; i++) code = ((code << 8) | buf[ip++]) >>> 0;
  const norm = () => { if (range < 16777216) { range = (range << 8) >>> 0; code = ((code << 8) | (ip < buf.length ? buf[ip] : 0)) >>> 0; ip++; } };
  const P = (n) => new Uint16Array(n).fill(1024);
  function bit(pr, i) {
    const p = pr[i], bound = (range >>> 11) * p; let b;
    if (code < bound) { range = bound; pr[i] = p + ((2048 - p) >>> 5); b = 0; } else { range -= bound; code -= bound; pr[i] = p - (p >>> 5); b = 1; }
    norm(); return b;
  }
  const tree = (pr, off, n) => { let m = 1; for (let i = 0; i < n; i++) m = (m << 1) | bit(pr, off + m); return m - (1 << n); };
  const rtree = (pr, off, n) => { let m = 1, s = 0; for (let i = 0; i < n; i++) { const b = bit(pr, off + m); m = (m << 1) | b; s |= b << i; } return s; };
  const direct = (n) => { let r = 0; for (let i = 0; i < n; i++) { range >>>= 1; let b = 0; if (code >= range) { code -= range; b = 1; } r = r * 2 + b; norm(); } return r; };
  const mkLen = () => ({ c: P(2), low: P(128), mid: P(128), high: P(256) });
  const lenDec = (L, ps) => (!bit(L.c, 0) ? tree(L.low, ps * 8, 3) : !bit(L.c, 1) ? 8 + tree(L.mid, ps * 8, 3) : 16 + tree(L.high, 0, 8));
  const lit = P(0x300 << (lc + lp)), isMatch = P(192), isRep = P(12), g0 = P(12), g1 = P(12), g2 = P(12), r0l = P(192), posSlot = P(256), posDec = P(115), align = P(16), mLen = mkLen(), rLen = mkLen();
  let out = Buffer.alloc(unknown ? 1 << 20 : size), o = 0, state = 0, rep0 = 0, rep1 = 0, rep2 = 0, rep3 = 0;
  const pbMask = (1 << pb) - 1, lpMask = (1 << lp) - 1;
  while (unknown || o < size) {
    if (unknown && o + 300 > out.length) { const n = Buffer.alloc(out.length * 2); out.copy(n); out = n; }
    const ps = o & pbMask;
    if (!bit(isMatch, (state << 4) + ps)) {
      const base = 0x300 * (((o & lpMask) << lc) + ((o ? out[o - 1] : 0) >> (8 - lc))); let sym = 1;
      if (state >= 7) { let mb = out[o - rep0 - 1]; do { const m = (mb >> 7) & 1; mb <<= 1; const b = bit(lit, base + ((1 + m) << 8) + sym); sym = (sym << 1) | b; if (m !== b) break; } while (sym < 0x100); }
      while (sym < 0x100) sym = (sym << 1) | bit(lit, base + sym);
      out[o++] = sym & 255; state = state < 4 ? 0 : state < 10 ? state - 3 : state - 6; continue;
    }
    let len;
    if (bit(isRep, state)) {
      if (!bit(g0, state)) { if (!bit(r0l, (state << 4) + ps)) { state = state < 7 ? 9 : 11; out[o] = out[o - rep0 - 1]; o++; continue; } }
      else { let dd; if (!bit(g1, state)) dd = rep1; else { if (!bit(g2, state)) dd = rep2; else { dd = rep3; rep3 = rep2; } rep2 = rep1; } rep1 = rep0; rep0 = dd; }
      len = lenDec(rLen, ps); state = state < 7 ? 8 : 11;
    } else {
      rep3 = rep2; rep2 = rep1; rep1 = rep0; len = lenDec(mLen, ps); state = state < 7 ? 7 : 10;
      const slot = tree(posSlot, (len < 4 ? len : 3) * 64, 6); let dist = slot;
      if (slot >= 4) { const nb = (slot >> 1) - 1; dist = (2 | (slot & 1)) * Math.pow(2, nb); if (slot < 14) dist += rtree(posDec, dist - slot, nb); else { dist += direct(nb - 4) * 16; dist += rtree(align, 0, 4); } }
      if (dist === 0xffffffff) break; // end marker
      rep0 = dist;
    }
    len += 2; if (rep0 >= o) throw new Error('LZMA data is damaged');
    for (let i = 0; i < len && (unknown || o < size); i++, o++) out[o] = out[o - rep0 - 1];
  }
  return out.subarray(0, o);
};
