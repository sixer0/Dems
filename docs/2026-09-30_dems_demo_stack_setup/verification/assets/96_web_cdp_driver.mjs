// Minimal raw-CDP driver for step 96 (Node 26 built-in WebSocket). Verification tooling only.
// usage:
//   node cdp.mjs collect <out.jsonl>            long-running event collector (Network, WS, console, CSP, Audits)
//   node cdp.mjs nav <url>
//   node cdp.mjs eval '<js expression>'
//   node cdp.mjs shot <name>                    -> verification/assets/96_web_<name>.png
//   node cdp.mjs click '<text>' [selector] [index] [exact]
//   node cdp.mjs clicksel '<css selector>' [index]
//   node cdp.mjs type '<text>'
//   node cdp.mjs key <Enter|Tab|Escape>
//   node cdp.mjs hold '<text>' <ms> [selector]
const PORT = process.env.CDP_PORT || 9333;
const ASSETS = '/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/verification/assets';
import { writeFileSync, appendFileSync } from 'node:fs';

async function pageWs() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const p = list.find((t) => t.type === 'page');
  if (!p) throw new Error('no page target');
  return p.webSocketDebuggerUrl;
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    const listeners = [];
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      } else if (msg.method) listeners.forEach((l) => l(msg));
    };
    ws.onerror = (e) => reject(e);
    ws.onopen = () =>
      resolve({
        send: (method, params = {}) =>
          new Promise((res, rej) => {
            const i = ++id;
            pending.set(i, { res, rej });
            ws.send(JSON.stringify({ id: i, method, params }));
          }),
        on: (fn) => listeners.push(fn),
        close: () => ws.close(),
      });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [, , cmd, ...args] = process.argv;
const c = await connect(await pageWs());

async function evaluate(expr) {
  const r = await c.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
  return r.result.value;
}

const FIND = (text, sel, idx, exact) => `(() => {
  const sel = ${JSON.stringify(sel || 'button, a, [role=button], [role=tab], [role=menuitem], [role=option], [role=radio], [role=switch], [role=checkbox], label, summary, li, [tabindex]')};
  const want = ${JSON.stringify(text)}.toLowerCase();
  const exact = ${exact ? 'true' : 'false'};
  const els = [...document.querySelectorAll(sel)].filter((e) => {
    const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    const st = getComputedStyle(e); if (st.visibility === 'hidden' || st.display === 'none') return false;
    const t = ((e.innerText || '') + ' ' + (e.getAttribute('aria-label') || '')).trim().toLowerCase().replace(/\\s+/g, ' ');
    return exact ? (e.innerText || e.getAttribute('aria-label') || '').trim().toLowerCase() === want : t.includes(want);
  });
  // prefer the innermost matches
  const inner = els.filter((e) => !els.some((o) => o !== e && e.contains(o)));
  const e = inner[${Number(idx) || 0}];
  if (!e) return { found: false, count: inner.length };
  e.scrollIntoView({ block: 'center', inline: 'center' });
  const r = e.getBoundingClientRect();
  return { found: true, count: inner.length, x: r.x + r.width / 2, y: r.y + r.height / 2, tag: e.tagName, text: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 80), disabled: !!(e.disabled || e.getAttribute('aria-disabled') === 'true') };
})()`;

async function mouseClick(x, y, holdMs = 0) {
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  if (holdMs) await sleep(holdMs);
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

try {
  if (cmd === 'collect') {
    const out = args[0];
    const log = (o) => appendFileSync(out, JSON.stringify({ t: new Date().toISOString(), ...o }) + '\n');
    c.on((m) => {
      const p = m.params || {};
      switch (m.method) {
        case 'Network.requestWillBeSent':
          log({ ev: 'req', url: p.request.url, method: p.request.method, type: p.type, id: p.requestId });
          break;
        case 'Network.responseReceived':
          log({ ev: 'res', url: p.response.url, status: p.response.status, type: p.type, id: p.requestId });
          break;
        case 'Network.loadingFailed':
          log({ ev: 'fail', id: p.requestId, err: p.errorText, blocked: p.blockedReason, canceled: p.canceled });
          break;
        case 'Network.webSocketCreated':
          log({ ev: 'ws_open', url: p.url, id: p.requestId });
          break;
        case 'Network.webSocketClosed':
          log({ ev: 'ws_close', id: p.requestId });
          break;
        case 'Runtime.consoleAPICalled': {
          const text = (p.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ');
          log({ ev: text.startsWith('__CSPV__') ? 'csp' : 'console', level: p.type, text: text.slice(0, 600) });
          break;
        }
        case 'Runtime.exceptionThrown':
          log({ ev: 'exception', text: JSON.stringify(p.exceptionDetails).slice(0, 600) });
          break;
        case 'Log.entryAdded':
          log({ ev: 'log', source: p.entry.source, level: p.entry.level, text: (p.entry.text || '').slice(0, 600), url: p.entry.url });
          break;
        case 'Audits.issueAdded':
          log({ ev: 'issue', code: p.issue.code, details: JSON.stringify(p.issue.details).slice(0, 600) });
          break;
        case 'Page.frameNavigated':
          if (!p.frame.parentId) log({ ev: 'nav', url: p.frame.url });
          break;
      }
    });
    await c.send('Network.enable');
    await c.send('Page.enable');
    await c.send('Runtime.enable');
    await c.send('Log.enable');
    await c.send('Audits.enable');
    await c.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `document.addEventListener('securitypolicyviolation', (e) => console.debug('__CSPV__' + JSON.stringify({ d: e.effectiveDirective, b: e.blockedURI, s: e.sourceFile, l: e.lineNumber, c: e.columnNumber, sample: e.sample, p: location.pathname })));`,
    });
    log({ ev: 'collector_ready' });
    console.log('collector ready ->', out);
    await new Promise(() => {}); // run until killed
  } else if (cmd === 'nav') {
    await c.send('Page.enable');
    await c.send('Page.navigate', { url: args[0] });
    await sleep(Number(args[1] || 2500));
    console.log(JSON.stringify(await evaluate('({path: location.pathname, title: document.title})')));
  } else if (cmd === 'eval') {
    console.log(JSON.stringify(await evaluate(args[0]), null, 1));
  } else if (cmd === 'shot') {
    const r = await c.send('Page.captureScreenshot', { format: 'png' });
    const f = `${ASSETS}/96_web_${args[0]}.png`;
    writeFileSync(f, Buffer.from(r.data, 'base64'));
    console.log(f);
  } else if (cmd === 'click' || cmd === 'hold') {
    const holdMs = cmd === 'hold' ? Number(args[1]) : 0;
    const sel = cmd === 'hold' ? args[2] : args[1];
    const idx = cmd === 'hold' ? 0 : args[2];
    const exact = cmd === 'hold' ? false : args[3] === 'exact';
    const f = await evaluate(FIND(args[0], sel, idx, exact));
    if (!f.found) { console.log('NOT FOUND', JSON.stringify(f)); process.exitCode = 2; }
    else { await sleep(150); const g = await evaluate(FIND(args[0], sel, idx, exact)); await mouseClick(g.x, g.y, holdMs); console.log('clicked', JSON.stringify(g)); }
  } else if (cmd === 'clicksel') {
    const f = await evaluate(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(args[0])})][${Number(args[1]) || 0}]; if (!e) return {found:false}; e.scrollIntoView({block:'center'}); const r = e.getBoundingClientRect(); return {found:true, x:r.x+r.width/2, y:r.y+r.height/2, tag:e.tagName, text:(e.innerText||'').slice(0,60)}; })()`);
    if (!f.found) { console.log('NOT FOUND'); process.exitCode = 2; } else { await sleep(150); await mouseClick(f.x, f.y); console.log('clicked', JSON.stringify(f)); }
  } else if (cmd === 'type') {
    await c.send('Input.insertText', { text: args[0] });
    console.log('typed');
  } else if (cmd === 'key') {
    const k = args[0];
    const codes = { Enter: 13, Tab: 9, Escape: 27 };
    await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k, windowsVirtualKeyCode: codes[k], text: k === 'Enter' ? '\r' : undefined });
    await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: codes[k] });
    console.log('key', k);
  } else {
    console.log('unknown command');
    process.exitCode = 64;
  }
} finally {
  if (cmd !== 'collect') c.close();
}
