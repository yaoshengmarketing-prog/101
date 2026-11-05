// Capture the public candidate in a real Chromium mobile viewport through DevTools.
// node football/scripts/capture-personnel-preview.mjs
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'football-personnel-chrome-'));
const port = 19234;
const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const endpoint = `http://127.0.0.1:${port}`;
let socket;
try {
  let page;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const tabs = await (await fetch(`${endpoint}/json/list`)).json();
      page = tabs.find(tab => tab.type === 'page');
      if (page) break;
    } catch { /* Chrome has not opened the debug port yet. */ }
    await pause(100);
  }
  if (!page) throw new Error('Chromium debug page did not start');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  await command('Page.enable');
  await command('Runtime.enable');
  const base = 'https://yaoshengmarketing-prog.github.io/101/football/personnel-preview/';
  const folder = path.resolve('football/personnel-preview/screenshots');
  await fs.mkdir(folder, { recursive: true });
  for (const sample of [
    { file: 'mobile-collapsed.png', height: 844, query: '?id=401878761' },
    { file: 'mobile-expanded.png', height: 1100, query: '?id=401878761', clickFirstTeam: true },
  ]) {
    await command('Emulation.setDeviceMetricsOverride', { width: 390, height: sample.height,
      deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: sample.height });
    await command('Page.navigate', { url: base + sample.query });
    let state;
    for (let attempt = 0; attempt < 80; attempt++) {
      const evaluation = await command('Runtime.evaluate', { expression: `({ready:!!document.querySelector('.personnel-card'),
        width:innerWidth,documentWidth:document.documentElement.scrollWidth,
        expanded:!!document.querySelector('.personnel-card[open]')})`, returnByValue: true });
      state = evaluation.result?.value;
      if (state?.ready) break;
      await pause(100);
    }
    if (!state?.ready || state.width !== 390 || state.documentWidth > 390)
      throw new Error(`${sample.file}: viewport/content mismatch ${JSON.stringify(state)}`);
    if (sample.clickFirstTeam) {
      const location = await command('Runtime.evaluate', { expression: `(() => {
        const box = document.querySelector('.personnel-card summary').getBoundingClientRect();
        return {x:box.x+box.width/2,y:box.y+box.height/2};
      })()`, returnByValue: true });
      const { x, y } = location.result.value;
      await command('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      const after = await command('Runtime.evaluate', { expression: `({expanded:!!document.querySelector('.personnel-card[open]'),
        documentWidth:document.documentElement.scrollWidth})`, returnByValue: true });
      state = { ...state, ...after.result.value };
      if (!state.expanded || state.documentWidth > 390) throw new Error(`${sample.file}: mobile click/overflow mismatch ${JSON.stringify(state)}`);
    }
    const screenshot = await command('Page.captureScreenshot', { format: 'png', fromSurface: true,
      captureBeyondViewport: false });
    await fs.writeFile(path.join(folder, sample.file), Buffer.from(screenshot.data, 'base64'));
    console.log(JSON.stringify({ file: sample.file, ...state }));
  }
} finally {
  socket?.close();
  chrome.kill();
  const resolved = path.resolve(profile), tempRoot = path.resolve(os.tmpdir());
  if (!resolved.startsWith(tempRoot + path.sep)) throw new Error('Chromium profile outside temporary directory');
  await pause(300);
  await fs.rm(resolved, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 });
}
