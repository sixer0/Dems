// Step 96b independent re-verification driver (raw CDP over Node's built-in WebSocket; no installs).
// Verification tooling only. It reads the app; it changes no source and no release file.
// Usage: node cdp-reverify-96b.mjs <devtoolsPort> <appOrigin> <assetsDir> <repoRoot>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [devPort, origin, assetsDir, repoRoot] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wib = () => new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour12: false });

// Demo credentials are synthetic and live in the dataset; the password is read here and never logged.
const dataset = readFileSync(join(repoRoot, 'packages/shared/src/sim/dataset.ts'), 'utf8');
const DEMO_PASSWORD = /DEMO_OPERATOR_PASSWORD\s*=\s*'([^']+)'/.exec(dataset)?.[1];
if (!DEMO_PASSWORD) throw new Error('demo password constant not found in dataset.ts');
const USERNAME = 'andi.pratama';
if (!new RegExp(`username:\\s*'${USERNAME.replace('.', '\\.')}'[\\s\\S]{0,200}?role:\\s*OperatorRole\\.SUPERVISOR`).test(dataset)) {
  throw new Error('andi.pratama is not the SUPERVISOR operator in dataset.ts');
}

const list = await (await fetch(`http://127.0.0.1:${devPort}/json/list`)).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

let id = 0;
const pending = new Map();
const requests = []; // { url, method, type, t }
const responses = []; // { url, status }
const failures = []; // { id, err, blocked }
const wsCreated = [];
let wsFramesReceived = 0;
const cspEvents = []; // page securitypolicyviolation events (relayed through console.debug)
const auditIssues = []; // CDP Audits CSP issues
const consoleProblems = [];
const exceptions = [];
let currentWhere = 'boot';

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    return;
  }
  const p = msg.params || {};
  switch (msg.method) {
    case 'Network.requestWillBeSent':
      requests.push({ url: p.request.url, method: p.request.method, type: p.type, where: currentWhere });
      break;
    case 'Network.webSocketCreated':
      wsCreated.push(p.url);
      requests.push({ url: p.url, method: 'WS', type: 'WebSocket', where: currentWhere });
      break;
    case 'Network.webSocketFrameReceived':
      wsFramesReceived++;
      break;
    case 'Network.responseReceived':
      responses.push({ url: p.response.url, status: p.response.status });
      break;
    case 'Network.loadingFailed':
      if (!p.canceled) failures.push({ err: p.errorText, blocked: p.blockedReason ?? null, where: currentWhere });
      break;
    case 'Runtime.consoleAPICalled': {
      const text = (p.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ');
      if (text.startsWith('__CSPV__')) cspEvents.push({ where: currentWhere, ...JSON.parse(text.slice(8)) });
      else if (p.type === 'error' || p.type === 'warning') consoleProblems.push({ where: currentWhere, level: p.type, text: text.slice(0, 300) });
      break;
    }
    case 'Log.entryAdded':
      if (p.entry.level === 'error' || p.entry.level === 'warning') consoleProblems.push({ where: currentWhere, level: `log.${p.entry.level}`, text: (p.entry.text || '').slice(0, 300) });
      break;
    case 'Runtime.exceptionThrown':
      exceptions.push({ where: currentWhere, text: `${p.exceptionDetails.text} ${p.exceptionDetails.exception?.description?.slice(0, 300) ?? ''}` });
      break;
    case 'Audits.issueAdded':
      if (p.issue.code === 'ContentSecurityPolicyIssue') {
        const d = p.issue.details.contentSecurityPolicyIssueDetails;
        auditIssues.push({ where: currentWhere, directive: d.violatedDirective, blocked: d.blockedURL ?? '', src: d.sourceCodeLocation?.url ?? '' });
      }
      break;
  }
});

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ''}`);
  return r.result.value;
};
const waitFor = async (expr, timeoutMs = 15000, everyMs = 200) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const v = await evaluate(expr);
      if (v) return v;
    } catch {
      /* navigating */
    }
    await sleep(everyMs);
  }
  return false;
};
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const f = join(assetsDir, `${name}.png`);
  writeFileSync(f, Buffer.from(r.data, 'base64'));
  return f;
};
// Real pointer input (not element.click()).
const mouseClick = async (selector) => {
  const r = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; e.scrollIntoView({ block: 'center', inline: 'center' }); const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height }; })()`);
  if (!r || r.w < 1 || r.h < 1) return false;
  await sleep(150);
  const q = await evaluate(`(() => { const b = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: q.x, y: q.y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: q.x, y: q.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: q.x, y: q.y, button: 'left', clickCount: 1 });
  return true;
};
const navigate = async (path, where) => {
  currentWhere = where ?? path;
  await send('Page.navigate', { url: `${origin}${path}` });
};

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Log.enable');
await send('Audits.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `document.addEventListener('securitypolicyviolation', (e) => console.debug('__CSPV__' + JSON.stringify({ dir: e.effectiveDirective, blocked: e.blockedURI, src: e.sourceFile, line: e.lineNumber, col: e.columnNumber, sample: e.sample, path: location.pathname })));`,
});

const browserVersion = (await send('Browser.getVersion')).product;
const result = { step: '96b', origin, browser: browserVersion, startedWib: wib(), checks: [] };
const check = (idc, name, ok, detail = '') => {
  result.checks.push({ id: idc, name, ok: !!ok, detail });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'} [${idc}] ${name} :: ${detail}\n`);
};
const OLD = /TRUSTED\s+RECORDING/i;
const textProbe = `(() => ({ inner: document.body.innerText, full: document.documentElement.textContent, title: document.title, aria: [...document.querySelectorAll('[aria-label],[title],[alt],[placeholder]')].map((e) => [e.getAttribute('aria-label'), e.getAttribute('title'), e.getAttribute('alt'), e.getAttribute('placeholder')].filter(Boolean).join(' | ')).join(' || ') }))()`;

// ── 4a. Login page ──────────────────────────────────────────────────────────────────────────
await navigate('/', 'login');
const loginReady = await waitFor(`!!document.querySelector('[data-testid="login-submit"]')`, 40000);
await sleep(3500);
const loginPath = await evaluate('location.pathname');
const loginText = await evaluate(textProbe);
const taglineEl = await evaluate(`(document.querySelector('.dems-login-tagline')?.innerText || '').replace(/\\s+/g, ' ').trim()`);
const norm = (s) => s.replace(/\s+/g, ' ');
const loginHas1 = norm(loginText.inner).includes('SECURE BY DESIGN.');
const loginHas2 = norm(loginText.inner).includes('TRUSTED BY LAW.');
const loginOld = OLD.test(loginText.inner) || OLD.test(loginText.full) || OLD.test(loginText.aria) || OLD.test(loginText.title);
const coreLink = await waitFor(`(() => { const m = document.body.innerText.replace(/\\s+/g, ' ').match(/core link\\s*:?\\s*(online|offline|connecting[.…]*|stale)/i); return m ? m[0] : ''; })()`, 10000);
result.login = { path: loginPath, taglineElement: taglineEl, has1: loginHas1, has2: loginHas2, oldTaglinePresent: loginOld, coreLink: coreLink || '' , title: loginText.title };
check('4a-1', 'Login page renders', loginReady && loginPath.startsWith('/login'), `path=${loginPath}`);
check('4a-2', 'Login shows "SECURE BY DESIGN." and "TRUSTED BY LAW."', loginHas1 && loginHas2, `rendered text has line1=${loginHas1} line2=${loginHas2}; tagline element="${taglineEl}"`);
check('4a-3', 'Old tagline "TRUSTED RECORDING" absent on Login (innerText, textContent, aria/title/alt, document.title)', !loginOld, `present=${loginOld}`);
result.shots = { login: await shot('13_login') };

// ── 4b. Sign in as the supervisor demo operator ─────────────────────────────────────────────
const focusField = (testid) => evaluate(`(() => { const el = document.querySelector('[data-testid="${testid}"] input') || document.querySelector('[data-testid="${testid}"]'); if (!el) return false; el.focus(); el.select && el.select(); return document.activeElement === el; })()`);
const f1 = await focusField('login-username-field');
await send('Input.insertText', { text: USERNAME });
const f2 = await focusField('login-password-field');
await send('Input.insertText', { text: DEMO_PASSWORD });
await sleep(500);
const submitEnabled = await waitFor(`(() => { const b = document.querySelector('[data-testid="login-submit"]'); return b && !b.disabled && b.getAttribute('aria-disabled') !== 'true' && !b.hasAttribute('data-disabled'); })()`, 15000);
currentWhere = 'login -> dashboard';
const clicked = await mouseClick('[data-testid="login-submit"]');
const onDash = await waitFor(`location.pathname.startsWith('/dashboard')`, 30000);
await sleep(3500);
const dashPath = await evaluate('location.pathname');
const dashText = await evaluate(textProbe);
const dashH1 = await evaluate(`(document.querySelector('h1')?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 80)`);
const hero = await evaluate(`(document.querySelector('[data-testid="hero-copy"]')?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 200)`);
const dashOld = OLD.test(dashText.inner) || OLD.test(dashText.full) || OLD.test(dashText.aria) || OLD.test(dashText.title);
const operatorShown = /Andi Pratama/i.test(dashText.inner) || /Andi Pratama/i.test(dashText.aria);
const supervisorShown = /supervisor/i.test(dashText.inner) || /supervisor/i.test(dashText.aria);
const dashChars = dashText.inner.length;
result.dashboard = { path: dashPath, h1: dashH1, hero, oldTaglinePresent: dashOld, operatorShown, supervisorShown, innerTextChars: dashChars };
check('4b-1', 'Sign in as andi.pratama (Supervisor) reaches the Dashboard', f1 && f2 && submitEnabled && clicked && onDash && dashPath === '/dashboard', `fieldsFocused=${f1 && f2} submitEnabled=${!!submitEnabled} path=${dashPath}`);
check('4b-2', 'Dashboard renders', dashChars > 400 && /dashboard/i.test(dashH1 + dashText.inner), `h1="${dashH1}" innerTextChars=${dashChars} operatorNameShown=${operatorShown} supervisorShown=${supervisorShown}`);
check('4b-3', 'Dashboard hero shows the new tagline; old tagline absent', /SECURE BY DESIGN\./.test(hero) && /TRUSTED BY LAW\./.test(hero) && !dashOld, `hero="${hero.slice(0, 80)}" oldPresent=${dashOld}`);
const wsOk = wsCreated.length > 0 && wsCreated.every((u) => u.startsWith(origin.replace('http://', 'ws://')));
check('4b-4', 'Core link Online (Login label + live heartbeat socket on the launcher origin)', /online/i.test(coreLink || '') && wsOk && wsFramesReceived > 0, `loginLabel="${coreLink || ''}" sockets=${JSON.stringify([...new Set(wsCreated)])} framesReceived=${wsFramesReceived}`);

// ── 4c. Evidence Verify (the F96-1 regression check) ────────────────────────────────────────
const STATE = `(() => { const v = document.querySelector('[data-testid=evidence-verdict]'); const rows = [...document.querySelectorAll('[data-testid=evidence-checks] [data-check]')].map((c) => ({ id: c.dataset.check, phase: c.dataset.phase, source: c.dataset.source ?? null, text: c.innerText.replace(/\\s+/g, ' ').trim().slice(0, 160) })); const b = document.querySelector('[data-testid=evidence-verify]'); return { verdict: v?.dataset.verdict ?? null, verdictText: (v?.innerText || '').trim(), rows, button: (b?.innerText || '').trim(), card: (document.querySelector('[data-testid=evidence-verify-card]')?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 900), label: (document.querySelector('[data-testid=evidence-verify-label]')?.innerText || '').trim() }; })()`;
const verify = async (evidenceId, tag) => {
  const out = { evidenceId };
  // User path first: Evidence -> search -> row -> preview "open" -> Hash & Integrity tab. Fall back to the deep link.
  const path = [];
  await navigate('/evidence', `evidence list (${evidenceId})`);
  const hasSearch = await waitFor(`!!document.querySelector('[data-testid=evidence-search]')`, 30000);
  await sleep(2500);
  out.listedInEvidencePage = await evaluate(`document.body.innerText.includes(${JSON.stringify(evidenceId)})`);
  const rowSel = `[data-row-id="${evidenceId}"]`;
  if (hasSearch) {
    await evaluate(`(() => { const el = document.querySelector('[data-testid=evidence-search]'); el.focus(); el.select && el.select(); return true; })()`);
    await send('Input.insertText', { text: evidenceId });
    path.push('search');
  }
  const rowFound = await waitFor(`!!document.querySelector(${JSON.stringify(rowSel)})`, 10000);
  await sleep(1200);
  currentWhere = `/evidence/${evidenceId} (verify)`;
  if (rowFound) {
    const cellSel = (await evaluate(`!!document.querySelector(${JSON.stringify(rowSel + ' [role=rowheader]')})`)) ? `${rowSel} [role=rowheader]` : rowSel;
    if (await mouseClick(cellSel)) path.push('row click');
    const got = await waitFor(`location.pathname.includes(${JSON.stringify(evidenceId)}) ? 'detail' : (document.querySelector('[data-testid=evidence-preview-open]') ? 'preview' : '')`, 8000);
    if (got === 'preview') {
      await sleep(600);
      if (await mouseClick('[data-testid=evidence-preview-open]')) path.push('preview open');
      await waitFor(`location.pathname.includes(${JSON.stringify(evidenceId)})`, 10000);
    }
  }
  if (await evaluate(`location.pathname.includes(${JSON.stringify(evidenceId)})`)) {
    await waitFor(`!!document.querySelector('[data-testid=evidence-tab-integrity]')`, 15000);
    await sleep(1000);
    if (!(await evaluate(`!!document.querySelector('[data-testid=evidence-verify]')`))) {
      if (await mouseClick('[data-testid=evidence-tab-integrity]')) path.push('Hash & Integrity tab');
      await waitFor(`!!document.querySelector('[data-testid=evidence-verify]')`, 8000);
    }
  }
  if (!(await evaluate(`location.pathname.includes(${JSON.stringify(evidenceId)}) && !!document.querySelector('[data-testid=evidence-verify]')`))) {
    path.push('FALLBACK deep link /evidence/<id>?tab=integrity');
    await navigate(`/evidence/${evidenceId}?tab=integrity`, `/evidence/${evidenceId} (verify)`);
  }
  out.reachedBy = path.join(' -> ');
  out.ready = !!(await waitFor(`!!document.querySelector('[data-testid=evidence-verify]')`, 30000));
  await sleep(1500);
  out.url = await evaluate('location.pathname + location.search');
  out.before = await evaluate(STATE);
  // In-page timing: click time and first settled verdict + all rows settled.
  await evaluate(`(() => {
    window.__vt = { click: null, verdict: null, value: null, allSettled: null, samples: [] };
    document.querySelector('[data-testid=evidence-verify]').addEventListener('pointerdown', () => { if (window.__vt.click === null) window.__vt.click = performance.now(); }, { capture: true });
    const look = () => {
      if (window.__vt.click === null) return;
      const v = document.querySelector('[data-testid=evidence-verdict]')?.dataset.verdict ?? null;
      const rows = [...document.querySelectorAll('[data-testid=evidence-checks] [data-check]')];
      const settled = rows.filter((c) => c.dataset.phase === 'pass' || c.dataset.phase === 'fail').length;
      const last = window.__vt.samples[window.__vt.samples.length - 1];
      if (!last || last.v !== v || last.settled !== settled) window.__vt.samples.push({ ms: Math.round(performance.now() - window.__vt.click), v, settled, total: rows.length });
      if ((v === 'PASS' || v === 'FAIL') && window.__vt.sawRunning && window.__vt.verdict === null) { window.__vt.verdict = performance.now(); window.__vt.value = v; }
      if (v === 'RUNNING') window.__vt.sawRunning = true;
      if (rows.length && settled === rows.length && window.__vt.sawRunning && window.__vt.allSettled === null) window.__vt.allSettled = performance.now();
    };
    new MutationObserver(look).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    window.__vtTimer = setInterval(look, 50);
    return true;
  })()`);
  const reqBefore = requests.length;
  const cspBefore = cspEvents.length;
  out.clicked = await mouseClick('[data-testid=evidence-verify]');
  out.clickWib = wib();
  const done = await waitFor(`(() => { const t = window.__vt; return t && t.verdict !== null && t.allSettled !== null; })()`, 60000, 100);
  out.finished = !!done;
  await sleep(1800); // let the verdict animation settle for the screenshot
  const vt = await evaluate(`(() => { const t = window.__vt; clearInterval(window.__vtTimer); return { sawRunning: !!t.sawRunning, value: t.value, msToVerdict: t.verdict === null ? null : Math.round(t.verdict - t.click), msToAllSettled: t.allSettled === null ? null : Math.round(t.allSettled - t.click), samples: t.samples.slice(0, 40) }; })()`);
  out.timing = vt;
  out.after = await evaluate(STATE);
  out.shot = await shot(`13_verify_${tag}`);
  const during = requests.slice(reqBefore);
  out.requestsDuringVerify = during.length;
  out.dataUrlRequestsDuringVerify = during.filter((r) => r.url.startsWith('data:')).length;
  out.cspDuringVerify = cspEvents.length - cspBefore;
  return out;
};

const v1 = await verify('EV-20260929-0001', 'ev0001_pass');
result.verifyEv0001 = v1;
{
  const rows = v1.after.rows;
  const pass = rows.filter((r) => r.phase === 'pass').length;
  check('4c-1', 'EV-20260929-0001 Verify finishes with PASS (8 of 8)',
    v1.ready && v1.clicked && v1.finished && v1.timing.sawRunning && v1.after.verdict === 'PASS' && rows.length === 8 && pass === 8 && v1.before.verdict !== 'PASS' && v1.cspDuringVerify === 0,
    `before=${v1.before.verdict} sawRunning=${v1.timing.sawRunning} after=${v1.after.verdict} ("${v1.after.verdictText}") pass=${pass}/${rows.length} timeToVerdictMs=${v1.timing.msToVerdict} allSettledMs=${v1.timing.msToAllSettled} csp=${v1.cspDuringVerify} dataUrlFetches=${v1.dataUrlRequestsDuringVerify} reachedBy="${v1.reachedBy}"`);
}
const v5 = await verify('EV-20260930-0005', 'ev0005_fail');
result.verifyEv0005 = v5;
{
  const rows = v5.after.rows;
  const failed = rows.filter((r) => r.phase === 'fail').map((r) => r.id);
  const passed = rows.filter((r) => r.phase === 'pass').length;
  const unfinished = rows.filter((r) => r.phase !== 'pass' && r.phase !== 'fail').map((r) => `${r.id}:${r.phase}`);
  check('4c-2', 'EV-20260930-0005 Verify finishes with FAIL on AUDIO-02 only',
    v5.ready && v5.clicked && v5.finished && v5.timing.sawRunning && v5.after.verdict === 'FAIL' && rows.length === 8 && failed.length === 1 && /AUDIO-02/.test(failed[0]) && passed === 7 && unfinished.length === 0 && v5.before.verdict !== 'FAIL' && v5.cspDuringVerify === 0,
    `before=${v5.before.verdict} sawRunning=${v5.timing.sawRunning} after=${v5.after.verdict} ("${v5.after.verdictText}") failed=[${failed.join(',')}] passed=${passed}/${rows.length} unfinished=[${unfinished.join(',')}] timeToVerdictMs=${v5.timing.msToVerdict} allSettledMs=${v5.timing.msToAllSettled} csp=${v5.cspDuringVerify} dataUrlFetches=${v5.dataUrlRequestsDuringVerify} reachedBy="${v5.reachedBy}"`);
}

// ── 4d. All 11 routes once; CSP events; request hosts ───────────────────────────────────────
const ROUTES = ['/dashboard', '/session', '/session/new', '/evidence', '/devices', '/storage', '/network-time', '/security-audit', '/system', '/stack-check', '/developer/api'];
result.routes = [];
for (const p of ROUTES) {
  const cspBefore = cspEvents.length;
  const auditBefore = auditIssues.length;
  const excBefore = exceptions.length;
  await navigate(p, `route ${p}`);
  await waitFor(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(p)} && !!document.querySelector('h1')`, 30000);
  await sleep(p === '/developer/api' ? 7000 : 3000);
  const path = await evaluate('location.pathname');
  const h1 = await evaluate(`(document.querySelector('h1')?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 60)`);
  const chars = await evaluate('document.body.innerText.length');
  const extra = p === '/stack-check' ? await evaluate(`(document.querySelector('[data-testid="heartbeat-chip"]')?.innerText || '').trim()`) : undefined;
  const row = { requested: p, path, h1, innerTextChars: chars, csp: cspEvents.length - cspBefore, auditCsp: auditIssues.length - auditBefore, exceptions: exceptions.length - excBefore };
  if (extra !== undefined) row.heartbeatChip = extra;
  result.routes.push(row);
  check('4d-route', `route ${p} renders`, path === p && !!h1 && chars > 100, `path=${path} h1="${h1}" chars=${chars} csp=${row.csp} auditCsp=${row.auditCsp} exceptions=${row.exceptions}${extra !== undefined ? ` heartbeatChip="${extra}"` : ''}`);
}
currentWhere = 'end';
await sleep(1000);

const hostCounts = {};
let dataUrls = 0;
let blobUrls = 0;
let otherSchemes = 0;
for (const r of requests) {
  try {
    const u = new URL(r.url);
    if (u.protocol === 'data:') { dataUrls++; continue; }
    if (u.protocol === 'blob:') { blobUrls++; continue; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:' && u.protocol !== 'ws:' && u.protocol !== 'wss:') { otherSchemes++; continue; }
    const k = `${u.protocol}//${u.host}`;
    hostCounts[k] = (hostCounts[k] ?? 0) + 1;
  } catch {
    otherSchemes++;
  }
}
const allowed = new Set([origin, origin.replace('http://', 'ws://')]);
const externalHosts = Object.keys(hostCounts).filter((h) => !allowed.has(h));
const externalCount = externalHosts.reduce((n, h) => n + hostCounts[h], 0);
const statusCounts = {};
for (const r of responses) statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
const nonNetwork = requests.filter((r) => /^(data|blob):/.test(r.url)).map((r) => ({ where: r.where, type: r.type, url: r.url.slice(0, 70) }));
result.network = { nonNetwork, requests: requests.length, hostCounts, dataUrls, blobUrls, otherSchemes, externalHosts, externalCount, externalSamples: requests.filter((r) => { try { const u = new URL(r.url); return externalHosts.includes(`${u.protocol}//${u.host}`); } catch { return false; } }).slice(0, 20), statusCounts, loadingFailed: failures.slice(0, 20), webSockets: [...new Set(wsCreated)], wsFramesReceived };
result.csp = { pageEvents: cspEvents.length, auditIssues: auditIssues.length, events: cspEvents.slice(0, 40), issues: auditIssues.slice(0, 40) };
result.console = { problems: consoleProblems.slice(0, 40), problemCount: consoleProblems.length, exceptions: exceptions.slice(0, 20), exceptionCount: exceptions.length };
check('4d-1', 'All 11 routes visited once', result.routes.length === 11 && result.routes.every((r) => r.path === r.requested), `visited=${result.routes.length}`);
check('4d-2', 'securitypolicyviolation events = 0 (whole run)', cspEvents.length === 0, `pageEvents=${cspEvents.length} auditsDomainCspIssues=${auditIssues.length}`);
check('4d-3', 'Requests to any host other than the launcher origin = 0', externalCount === 0, `requests=${requests.length} hosts=${JSON.stringify(hostCounts)} external=${externalCount} data:=${dataUrls} blob:=${blobUrls} otherSchemes=${otherSchemes}`);
result.finishedWib = wib();
const passed = result.checks.filter((c) => c.ok).length;
result.summary = `${passed}/${result.checks.length} pass`;
writeFileSync(join(assetsDir, '13_browser_reverify.json'), JSON.stringify(result, null, 2));
process.stdout.write(`summary: ${result.summary}; exceptions=${exceptions.length} consoleProblems=${consoleProblems.length} statusCounts=${JSON.stringify(statusCounts)}\n`);
ws.close();
process.exit(passed === result.checks.length ? 0 : 3);
