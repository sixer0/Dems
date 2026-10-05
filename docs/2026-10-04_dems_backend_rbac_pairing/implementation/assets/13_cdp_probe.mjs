// W13: read-only runtime check through Metro's inspector: is ExpoSecureStore in the native module list?
// It evaluates one expression in the running app; it calls no SecureStore function.
const port = process.argv[2];
const timer = setTimeout(() => { console.log('cdp probe: timed out (not fatal)'); process.exit(0); }, 20000);
try {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  for (const t of list) console.log(`cdp target: ${t.title} | ${t.deviceName ?? ''} | ${t.description ?? ''}`);
  const target = list.find((t) => /React Native|Bridgeless|Hermes/i.test(`${t.title} ${t.description}`)) ?? list[0];
  if (!target) { console.log('cdp probe: no inspector target (not fatal)'); process.exit(0); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const expression = `(() => { const m = globalThis.expo && globalThis.expo.modules; if (!m) return JSON.stringify({ expoModules: false });
    const names = Object.keys(m).sort();
    return JSON.stringify({ count: names.length, hasExpoSecureStore: names.includes('ExpoSecureStore'), typeofExpoSecureStore: typeof m.ExpoSecureStore, names }); })()`;
  ws.addEventListener('open', () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } })));
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString());
    if (msg.id !== 1) return;
    const value = msg.result?.result?.value;
    console.log(`cdp Runtime.evaluate: ${value ?? JSON.stringify(msg.error ?? msg.result)}`);
    clearTimeout(timer); ws.close(); process.exit(0);
  });
  ws.addEventListener('error', (ev) => { console.log(`cdp probe: socket error ${ev.message ?? ''} (not fatal)`); clearTimeout(timer); process.exit(0); });
} catch (err) {
  console.log(`cdp probe: ${err instanceof Error ? err.message : String(err)} (not fatal)`);
  clearTimeout(timer); process.exit(0);
}
