// Regenerates the README screenshots in docs/ by driving headless Chrome over CDP.
// Uses the built-in demo mode (#demo), so no Firebase project and no real cart is involved.
// No dependencies: needs Node 22+ (built-in WebSocket) and Google Chrome.
//
//   cd public && python3 -m http.server 8000 &   # serve the site
//   node scripts/screenshots.mjs docs
//
// Env: CHROME (path to Chrome), URL (default http://127.0.0.1:8000/).
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

const OUT = process.argv[2] || 'docs';
const CH = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL0 = (process.env.URL || 'http://127.0.0.1:8000/') + '#demo';
const PORT = 9334;
mkdirSync(OUT, { recursive: true });

const proc = spawn(CH, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`, `--user-data-dir=${tmpdir()}/family-cart-shots-profile`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let list;
for (let i = 0; i < 50; i++) {
  try { list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (list.find((t) => t.type === 'page')) break; } catch {}
  await sleep(200);
}
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const cdp = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result.result.value;
};
const view = (w, h, mobile = false) => cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile });
const shot = async (name) => {
  const r = await cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64'));
  console.log('wrote', name);
};
// Fresh page in the given mode; waits out the boot splash.
const load = async (mode) => {
  await cdp('Page.navigate', { url: URL0 }); await sleep(800);
  await ev(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('mode', '${mode}'); localStorage.setItem('theme', 'mint'); localStorage.setItem('meSkipped', '1'); location.reload()`);
  await sleep(2200);
};

await cdp('Page.enable');

// Phone-sized shots: the app is a single calm column, so a phone frame shows it best.
await view(390, 844, true);
await load('light');
await shot('list-light');
await load('dark');
await shot('list-dark');
await load('light');
await ev(`document.getElementById('tab-regulars').click(); 1`); await sleep(600);
await shot('products');
await ev(`document.getElementById('tab-prices').click(); 1`); await sleep(1200);
await shot('prices');
await ev(`document.getElementById('tab-list').click(); document.getElementById('shop-btn').click(); 1`); await sleep(1200);
await shot('shop-mode');

// Live sync: the demo "family member" adds an item ~14s after load.
await ev(`document.getElementById('shop-close').click(); 1`);
await load('light');
await sleep(12500);
await shot('live-sync');

ws.close(); proc.kill();
