// Plan row W30 and AC-C-02: the new file of src/realtime is platform neutral and transport
// agnostic. A static scan of live-socket-client.ts, comments removed where the rule is about code
// (the method of test/client-platform-neutral.test.ts and test/live-light-platform-neutral.test.ts).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../src/', import.meta.url));
const REALTIME_DIR = `${SRC_DIR}realtime/`;
const FILE = `${REALTIME_DIR}live-socket-client.ts`;

const raw = readFileSync(FILE, 'utf8');
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
/** The file without block and line comments. */
const code = stripComments(raw);
/** Every module specifier a text imports or re-exports from, static or dynamic. */
const specifiersOf = (text: string) =>
  [...text.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm)].map((match) => match[1] ?? '');
/** The import statements of the file, each on one line. */
const importStatements = (code.match(/^import\s[^;]*;/gm) ?? []).map((statement) => statement.replace(/\s+/g, ' '));

/** Resolves a relative specifier to a source file, as the bundlers do. */
function resolveRelative(from: string, specifier: string): string | null {
  const base = resolve(dirname(from), specifier);
  for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`, base]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Every source file the file loads at run time: `import type` statements are skipped, the rest is followed. */
function loadedAtRunTime(): string[] {
  const seen = new Set<string>();
  const queue = [FILE];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const text = stripComments(readFileSync(file, 'utf8')).replace(/^\s*(import|export)\s+type\s[^;]*;/gm, '');
    for (const specifier of specifiersOf(text)) {
      if (!specifier.startsWith('.')) continue;
      const target = resolveRelative(file, specifier);
      if (target) queue.push(target);
    }
  }
  return [...seen].map((file) => file.slice(SRC_DIR.length)).sort();
}

describe('static scan of src/realtime/live-socket-client.ts', () => {
  it('imports the contract, the heartbeat client and one type of the light Live API, and nothing else', () => {
    expect(specifiersOf(code).sort()).toEqual(['../api/constants', '../api/realtime-messages', '../domain/enums', '../live/mode', './heartbeat-client']);
  });

  it('takes only a type from the light Live API, so nothing of src/live is loaded with the socket client', () => {
    const fromLive = importStatements.filter((statement) => statement.includes("'../live/"));
    expect(fromLive).toEqual(["import type { LiveLinkState } from '../live/mode';"]);
    expect(loadedAtRunTime().filter((file) => file.startsWith('live/'))).toEqual([]);
  });

  it('imports nothing from the simulator folder, from src/live/source, from src/live/testing or from src/client', () => {
    const bad = specifiersOf(code).filter((specifier) => /(^|\/)sim(\/|$)|(^|\/)source(\/|$)|(^|\/)testing(\/|$)|(^|\/)client(\/|$)|^@dems\/shared/.test(specifier));
    expect(bad).toEqual([]);
  });

  it('imports no package at all: no Node built-in, no React, no device framework, no state library', () => {
    expect(specifiersOf(code).filter((specifier) => !specifier.startsWith('.'))).toEqual([]);
    // Positive control: the same scan finds the React import of the heartbeat context.
    expect(specifiersOf(stripComments(readFileSync(`${REALTIME_DIR}heartbeat-context.tsx`, 'utf8')))).toContain('react');
  });

  it('what it loads at run time is the contract, the domain enums and the heartbeat client: no React file, no simulator engine', () => {
    const graph = loadedAtRunTime();
    expect(graph).toEqual(expect.arrayContaining(['realtime/live-socket-client.ts', 'realtime/heartbeat-client.ts', 'api/realtime-messages.ts', 'api/constants.ts', 'domain/enums.ts']));
    expect(graph.filter((file) => file.endsWith('.tsx'))).toEqual([]);
    expect(graph.filter((file) => /^(client|live)\//.test(file))).toEqual([]);
    // The contract names the simulator's vocabulary (roles and permissions) and nothing else of it.
    expect(graph.filter((file) => file.startsWith('sim/') && file !== 'sim/vocabulary.ts' && file !== 'sim/constants.ts')).toEqual([]);
  });

  it('AC-C-02: the file names no node:, react-native, expo, window or document (comments included)', () => {
    const named = /node:|react-native|\bexpo\b|\bwindow\b|\bdocument\b/;
    expect(raw.split('\n').filter((line) => named.test(line))).toEqual([]);
    // Positive control: the pattern does find such a name.
    expect(named.test("import { Platform } from 'react-native';")).toBe(true);
    expect(named.test('window.location.host')).toBe(true);
  });

  it('uses no platform global: the only global looked up is WebSocket, and only inside the default factory', () => {
    expect(code).not.toMatch(/\b(navigator|location|localStorage|sessionStorage|indexedDB|XMLHttpRequest|EventSource|AsyncStorage|SecureStore)\b/);
    expect(code).not.toMatch(/\bfetch\s*\(/);
    expect(code).not.toMatch(/\bBuffer\b|\bprocess\b|\brequire\s*\(|\b__dirname\b|\b__filename\b|\bimport\.meta\b|\b__DEV__\b/);
    const globalThisUses = [...code.matchAll(/globalThis[^;\n]*/g)].map((match) => match[0]);
    expect(globalThisUses).toHaveLength(1);
    expect(globalThisUses[0]).toMatch(/WebSocket/);
    // `new WebSocket(...)` is never written out: the constructor is the injected factory or that one lookup.
    expect(code).not.toMatch(/new\s+WebSocket\b/);
  });

  it('writes nothing to the console: every report goes to the injected onError', () => {
    expect(code).not.toMatch(/\bconsole\s*\./);
  });

  it('the clock, the random source and the timer functions are injected: each global is named once, as a default', () => {
    expect(code.match(/\bDate\.now\b/g)).toEqual(['Date.now']);
    expect(code.match(/\bMath\.random\b/g)).toEqual(['Math.random']);
    expect(code).not.toMatch(/new Date\(/);
    // The global timer functions are called only in DEFAULT_TIMERS; the client calls `timers.*`.
    const timerCall = /(^|[^.\w])(setTimeout|clearTimeout|setInterval|clearInterval)\s*\(/gm;
    const defaults = code.match(/const DEFAULT_TIMERS: LiveSocketTimers = \{[\s\S]*?\n\};/)?.[0] ?? '';
    const declaration = code.match(/export interface LiveSocketTimers \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect([...defaults.matchAll(timerCall)].map((match) => match[2]).sort()).toEqual(['clearInterval', 'clearTimeout', 'setInterval', 'setTimeout']);
    expect([...code.replace(defaults, '').replace(declaration, '').matchAll(timerCall)]).toEqual([]);
    expect(code).toMatch(/timers\.setTimeout\(/);
    expect(code).toMatch(/timers\.setInterval\(/);
    expect(code).toMatch(/timers\.clearTimeout\(/);
    expect(code).toMatch(/timers\.clearInterval\(/);
    expect(code).not.toMatch(/\b(setImmediate|queueMicrotask|requestAnimationFrame)\s*\(/);
  });

  it('reads the backoff and the limits from the existing constants and repeats none of their values', () => {
    expect(code).toMatch(/reconnectDelayMs\(attempt, random\)/);
    expect(code).toMatch(/HEARTBEAT_STALE_AFTER_MS/);
    expect(code).toMatch(/REALTIME_RESYNC_MIN_INTERVAL_MS/);
    expect(code).toMatch(/STALE_CHECK_INTERVAL_MS/);
    expect(code).toMatch(/RealtimeCloseCode\.SESSION_ENDED/);
    expect(code).toMatch(/RealtimeCloseCode\.DEVICE_REVOKED/);
    // No close code and no backoff value is written as a number.
    expect(code).not.toMatch(/\b(4401|4403|4408|1001|1008|1013|2_?500|8_?000)\b/);
  });

  it('never builds a URL and never puts a header value into a message: the URL is passed on as it was given', () => {
    expect(code).not.toMatch(/new URL\(|URLSearchParams|encodeURIComponent/);
    expect(code).toMatch(/socketFactory\(url, requestHeaders\)/);
    // The three client messages are the only things ever sent.
    const sends = [...code.matchAll(/\bsend\(\{[^}]*\}\)/g)].map((match) => match[0]);
    expect(sends).toHaveLength(2);
    for (const call of sends) expect(call).toMatch(/type: ('resync'|desired \? 'subscribe' : 'unsubscribe')/);
  });

  it('uses erasable syntax only: no enum, no namespace, no parameter property', () => {
    expect(code).not.toMatch(/^\s*(export\s+)?(declare\s+)?(const\s+)?enum\s/m);
    expect(code).not.toMatch(/^\s*(export\s+)?namespace\s/m);
    expect(code).not.toMatch(/constructor\s*\([^)]*\b(public|private|protected|readonly)\b/);
  });

  it('the heartbeat client itself is untouched by this row: it still has no send and knows nothing of the Live client', () => {
    const heartbeat = readFileSync(`${REALTIME_DIR}heartbeat-client.ts`, 'utf8');
    expect(heartbeat).not.toMatch(/live-socket-client|\bsend\s*\(/);
    expect(readFileSync(`${REALTIME_DIR}index.ts`, 'utf8')).toMatch(/export \* from '\.\/heartbeat-client';\nexport \* from '\.\/live-socket-client';/);
  });
});
