import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DATA_DIR can point at a mounted volume (e.g. Railway "/data") so the dedup
// state survives redeploys/restarts. Falls back to a local ./data folder.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'seen-orders.json');

// Tiny file-backed dedup store so the Packaging team never gets the same
// order twice (platforms retry pushes, and polling overlaps windows).
// For higher volume, swap this for Redis/DB - the interface stays the same.
let seen = new Set();

function load() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    seen = new Set(JSON.parse(raw));
    console.log(`[store] Loaded ${seen.size} seen orders from ${FILE}`);
  } catch (err) {
    console.log(`[store] No existing store found at ${FILE}, starting fresh`);
    seen = new Set();
  }
}

function persist() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    // Keep the file from growing forever: cap at last 5000 keys.
    const arr = [...seen].slice(-5000);
    seen = new Set(arr);
    fs.writeFileSync(FILE, JSON.stringify(arr));
  } catch (err) {
    console.error('[store] persist failed:', err.message);
  }
}

load();

// key format: "<platform>:<orderId>"
export function isNew(key) {
  return !seen.has(key);
}

export function markSeen(key) {
  seen.add(key);
  persist();
}

export default { isNew, markSeen };
