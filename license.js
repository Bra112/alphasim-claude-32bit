// While development continues every feature is unlocked. Set ENFORCE = true when the Supabase check is connected.
// Demo limits below are kept so that switching it on later needs no other change.
const fs = require('fs'), path = require('path');
const ENFORCE = false;
const DEMO = { maxDays: 3, canSave: false, symbols: ['EURUSD'] };
const file = (dir) => path.join(dir, 'license.json');
exports.DEMO = DEMO;
exports.get = (dir) => {
  if (!ENFORCE) return { mode: 'full', demo: null, enforced: false };
  try { const l = JSON.parse(fs.readFileSync(file(dir), 'utf8')); if (l.mode === 'full') return { ...l, demo: null, enforced: true }; } catch {}
  return { mode: 'demo', demo: DEMO, enforced: true };
};
// Placeholder key check. Replace with the Supabase call (send key + machine id, store the signed answer).
exports.activate = (dir, key) => {
  if (!/^ALPHA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(String(key).trim().toUpperCase())) return { ok: false, error: 'Invalid license key' };
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file(dir), JSON.stringify({ mode: 'full', key: key.trim().toUpperCase() })); return { ok: true };
};
