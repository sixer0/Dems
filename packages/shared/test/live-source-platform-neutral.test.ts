// Plan row W44 and AC-C-02: the Live source is platform neutral, takes its transports by
// injection and holds no request function of its own (decision D69). A static scan of every file
// of src/live/source, by the method of test/live-light-platform-neutral.test.ts.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as viaSubpath from '@dems/shared/live/source';
import { API_ERROR_CODES } from '../src/api';
import * as viaFile from '../src/live/source';

const SRC_DIR = fileURLToPath(new URL('../src/', import.meta.url));
const SOURCE_DIR = `${SRC_DIR}live/source/`;
const FILES = [
  'bindings.ts',
  'clock.ts',
  'command-gate.ts',
  'constants.ts',
  'index.ts',
  'live-result.ts',
  'live-sim.ts',
  'neutral-state.ts',
  'rebuild-error.ts',
  'replica.ts',
  'structural-sharing.ts',
  'touch-throttle.ts',
  'types.ts',
];

/** Every source file of the folder, at any depth. */
function walk(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(`${dir}${entry.name}/`, `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`],
  );
}
const files = walk(SOURCE_DIR).sort();

const raw = (name: string) => readFileSync(`${SOURCE_DIR}${name}`, 'utf8');
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
/** The file without block and line comments. */
const code = (name: string) => stripComments(raw(name));
/** Every module specifier a text imports or re-exports from, static or dynamic. */
const specifiersOf = (text: string) =>
  [...text.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm)].map((match) => match[1] ?? '');
/** The import and re-export statements of a file, each on one line. */
const statementsOf = (name: string) => (code(name).match(/^\s*(?:import|export)\s[^;]*\sfrom\s[^;]*;/gm) ?? []).map((statement) => statement.replace(/\s+/g, ' ').trim());
const offenders = (pattern: RegExp, text: (name: string) => string = code) => files.filter((name) => pattern.test(text(name)));

function resolveRelative(from: string, specifier: string): string | null {
  const base = resolve(dirname(from), specifier);
  for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`, base]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Every source file the folder loads at run time: `import type` statements are skipped, the rest is followed. */
function loadedAtRunTime(): string[] {
  const seen = new Set<string>();
  const queue = files.map((name) => `${SOURCE_DIR}${name}`);
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!/\.tsx?$/.test(file)) continue;
    const text = stripComments(readFileSync(file, 'utf8')).replace(/^\s*(import|export)\s+type\s[^;]*;/gm, '');
    for (const specifier of specifiersOf(text)) {
      if (!specifier.startsWith('.')) continue;
      const target = resolveRelative(file, specifier);
      if (target) queue.push(target);
    }
  }
  return [...seen].map((file) => file.slice(SRC_DIR.length)).sort();
}

describe('static scan of the Live source (src/live/source)', () => {
  it('scans the thirteen files of the folder', () => {
    expect(files).toEqual(FILES);
  });

  it('AC-C-02: no file names node:, react-native, expo, window or document (comments included)', () => {
    expect(offenders(/node:|react-native|\bexpo\b|\bwindow\b|\bdocument\b/, raw)).toEqual([]);
    // Positive control: the pattern does find the word where it is used.
    expect(/\bdocument\b/.test(readFileSync(`${SRC_DIR}sim/platform.ts`, 'utf8'))).toBe(true);
  });

  it('D69: no request function and no connection class is named anywhere, comments included: every request goes through the typed client that is passed in', () => {
    const network = /\bfetch\b|WebSocket|XMLHttpRequest|EventSource|sendBeacon|\bnavigator\b|\bhttps?:\/\/|\bwss?:\/\//;
    expect(offenders(network, raw)).toEqual([]);
    expect(offenders(/\bfetch\s*\(/, raw)).toEqual([]);
    // Positive control: the same pattern finds the typed client and the socket client, which do reach the network.
    expect(network.test(readFileSync(`${SRC_DIR}client/core-client.ts`, 'utf8'))).toBe(true);
    expect(network.test(readFileSync(`${SRC_DIR}realtime/live-socket-client.ts`, 'utf8'))).toBe(true);
  });

  it('imports the contract, the simulator, the light Live API, the two transports and the store library; no Node built-in, no React, no test double', () => {
    const allowed = [
      /^zustand\/(middleware|vanilla)$/,
      /^\.\.\/\.\.\/api\/[a-z-]+$/,
      /^\.\.\/\.\.\/sim\/[a-z-]+$/,
      /^\.\.\/\.\.\/domain\/enums$/,
      /^\.\.\/\.\.\/client\/core-client$/,
      /^\.\.\/\.\.\/realtime\/(live-socket-client|heartbeat-client)$/,
      /^\.\.\/(core-actions|errors|mode)$/,
      /^\.\/[a-z-]+$/,
    ];
    const seen = new Set<string>();
    for (const name of files) {
      for (const specifier of specifiersOf(code(name))) {
        seen.add(specifier);
        expect(allowed.some((pattern) => pattern.test(specifier)), `${name} imports "${specifier}"`).toBe(true);
      }
    }
    const bad = [...seen].filter((specifier) => /^node:|^react|(^|\/)testing(\/|$)|^@dems\/shared|^expo|\.tsx$/.test(specifier));
    expect(bad).toEqual([]);
    // Positive control: the scan does see the imports that exist.
    expect([...seen]).toEqual(expect.arrayContaining(['zustand/vanilla', '../../realtime/live-socket-client', '../../api/sim-actions', '../errors', './command-gate']));
  });

  it('the typed client is taken as a type only: the client itself is injected, and so is its transport', () => {
    const fromClient = files.flatMap((name) => statementsOf(name).filter((statement) => statement.includes("'../../client/")).map((statement) => `${name}: ${statement}`));
    expect(fromClient.length).toBeGreaterThan(0);
    for (const statement of fromClient) expect(statement, statement).toMatch(/: import type /);
    expect(loadedAtRunTime().filter((file) => file.startsWith('client/'))).toEqual([]);
  });

  it('loads the socket client by its own file, never through the barrel that holds the React context; no React file is loaded at all', () => {
    const graph = loadedAtRunTime();
    expect(graph).toEqual(expect.arrayContaining(['realtime/live-socket-client.ts', 'realtime/heartbeat-client.ts', 'live/errors.ts', 'live/mode.ts', 'api/sim-actions.ts']));
    expect(graph.filter((file) => file.endsWith('.tsx'))).toEqual([]);
    expect(graph).not.toContain('realtime/index.ts');
    expect(graph).not.toContain('sim/react.ts');
    expect(graph).not.toContain('live/hooks.ts');
    // The simulator's engine, its actions and its platform adapters are not loaded: the Live source runs no simulator.
    for (const file of ['sim/engine.ts', 'sim/actions.ts', 'sim/platform.ts', 'sim/store.ts', 'sim/scenarios.ts', 'sim/dataset.ts']) expect(graph, file).not.toContain(file);
    expect(graph.filter((file) => file.startsWith('live/testing/'))).toEqual([]);
  });

  it('CPC1-24: the storage of the debt is injected: no file names a storage of the platform, comments included', () => {
    expect(offenders(/\b(sessionStorage|localStorage|AsyncStorage|SecureStore|indexedDB)\b/, raw)).toEqual([]);
    // The option exists, and the module calls its three members and nothing else of it.
    expect(raw('types.ts')).toMatch(/readonly owedSignOut\?: LiveOwedSignOutPort;/);
    const members = [...code('live-sim.ts').matchAll(/\bdebtPort\?\.([a-z]+)\(/g)].map((match) => match[1]);
    expect([...new Set(members)].sort()).toEqual(['clear', 'read', 'write']);
  });

  it('reads no storage, writes nothing to the console and uses no global object', () => {
    expect(offenders(/\b(sessionStorage|localStorage|AsyncStorage|SecureStore|indexedDB)\b|\bcookies?\s*[=.(]/)).toEqual([]);
    expect(offenders(/\bconsole\./)).toEqual([]);
    expect(offenders(/\bglobalThis\b|\bprocess\b|\bBuffer\b|\brequire\s*\(|\bimport\.meta\b|\b__DEV__\b|\bself\b|\bglobal\b/)).toEqual([]);
    expect(offenders(/Math\.random|new Date\(|\bperformance\b/)).toEqual([]);
  });

  it('the clock and the timers are injected: the local clock is named once, as the default of createLiveSim, and NO file of the folder calls a timer function of the platform (CPC1-16, F66-12)', () => {
    expect(offenders(/\bDate\.now\b/)).toEqual(['live-sim.ts']);
    expect(code('live-sim.ts').match(/\bDate\.now\b/g)).toHaveLength(1);
    const timerCall = /(^|[^.\w])(setTimeout|setInterval|clearTimeout|clearInterval|setImmediate|queueMicrotask|requestAnimationFrame)\s*\(/m;
    expect(offenders(timerCall)).toEqual([]);
    // The platform's timer functions exist once in the package: the live socket client's defaults, which this folder imports.
    expect(statementsOf('live-sim.ts').filter((statement) => /\bDEFAULT_TIMERS\b/.test(statement))).toEqual([expect.stringContaining("from '../../realtime/live-socket-client'")]);
    expect(code('live-sim.ts')).toMatch(/const timers = options\.timers \?\? LIVE_SOCKET_DEFAULT_TIMERS;/);
    expect(offenders(/\bconst DEFAULT_TIMERS\b/)).toEqual([]);
    // Positive control: the pattern does find the one copy, where it is.
    const socketClient = stripComments(readFileSync(`${SRC_DIR}realtime/live-socket-client.ts`, 'utf8'));
    expect(socketClient.match(/export const DEFAULT_TIMERS: LiveSocketTimers = \{[\s\S]*?\n\};/)?.[0].match(new RegExp(timerCall.source, 'gm'))).toHaveLength(4);
  });

  it('holds declarations only at module level: loading it calls nothing that could start work', () => {
    // No top-level `await`, no top-level call of a creator, no top-level `new`.
    for (const name of files) {
      const text = code(name);
      expect(/^await\s/m.test(text), name).toBe(false);
      expect(/^(?:create\w+|start|connect)\s*\(/m.test(text), name).toBe(false);
      expect(/^new\s/m.test(text), name).toBe(false);
    }
  });

  it('uses erasable syntax only: no enum, no namespace, no parameter property', () => {
    expect(offenders(/^\s*(export\s+)?(declare\s+)?(const\s+)?enum\s/m)).toEqual([]);
    expect(offenders(/^\s*(export\s+)?namespace\s/m)).toEqual([]);
    expect(offenders(/constructor\s*\([^)]*\b(public|private|protected|readonly)\b/)).toEqual([]);
  });

  it('has exactly one lint directive, and it carries its reason: the Live result is a thenable on purpose', () => {
    const directives = files.flatMap((name) => (raw(name).match(/(?:oxlint|eslint)-disable[^\n]*/g) ?? []).map((line) => `${name}: ${line.trim()}`));
    expect(directives).toEqual(['live-result.ts: oxlint-disable-next-line unicorn/no-thenable']);
    expect(offenders(/@ts-(ignore|expect-error|nocheck)/, raw)).toEqual([]);
  });
});

describe('fix round after CP-C1: the contract\'s codes, and the markers of the local adapters', () => {
  it('CPC1-5: no envelope code is compared as a text of this folder: every comparison names a member of the contract\'s ApiErrorCode', () => {
    // `code === '…'`, `code !== '…'`, with or without `error.` or `failure.error.` before it.
    const literal = /(?<!typeof )\bcode\s*[!=]==\s*['"`]/;
    expect(offenders(literal)).toEqual([]);
    // Positive control: the pattern does find such a comparison where one stands.
    expect(literal.test("if (status === 401 && code === 'NOT_SIGNED_IN') return;")).toBe(true);
    expect(literal.test("if (failure.error.code !== 'FORBIDDEN') return;")).toBe(true);
    // The kind of a value is no code: `typeof code === 'string'` is not meant.
    expect(literal.test("typeof code === 'string'")).toBe(false);
    // A table keyed by envelope codes is keyed by the contract's members, never by a text.
    const table = code('rebuild-error.ts').slice(code('rebuild-error.ts').indexOf('export const ENVELOPE_SIM_CODE'));
    const entries = table.slice(0, table.indexOf('};')).split('\n').filter((line) => line.includes(': SimErrorCode.'));
    expect(entries.length).toBe(10);
    for (const line of entries) expect(line.trim(), line).toMatch(/^\[ApiErrorCode\.[A-Z_]+\]: SimErrorCode\.[A-Z_]+,$/);
  });

  it('CPC1-5: every envelope code the folder mentions is a code of the contract; the three codes of its own are not', () => {
    const mentioned = new Set(files.flatMap((name) => [...code(name).matchAll(/\bApiErrorCode\.([A-Z][A-Z_]+)\b/g)].map((match) => match[1] ?? '')));
    expect(mentioned.size).toBeGreaterThanOrEqual(15);
    for (const name of mentioned) expect(API_ERROR_CODES as readonly string[], name).toContain(name);
    // Every comparison and every table key the reviewer listed is among them.
    for (const name of ['DEVICE_REVOKED', 'NOT_SIGNED_IN', 'NOT_PERMITTED', 'FORBIDDEN', 'INVALID_CREDENTIALS', 'SECURITY_FAULT', 'SESSION_ACTIVE', 'INVALID_CODE', 'INVALID_STATE', 'SIMULATOR_ERROR']) {
      expect([...mentioned], name).toContain(name);
    }
    // The codes this folder gives its own errors are no envelope codes, so they cannot be mistaken for one.
    for (const own of [viaFile.NOT_AVAILABLE, viaFile.LIVE_SNAPSHOT_TIMEOUT_CODE, viaFile.LIVE_STOPPED_CODE, viaFile.LIVE_DEVICE_CLEANUP_GAVE_UP_CODE]) {
      expect(API_ERROR_CODES as readonly string[], own).not.toContain(own);
    }
    // The files that compare codes load the contract's vocabulary itself, not a copy.
    for (const name of ['bindings.ts', 'live-sim.ts', 'rebuild-error.ts']) {
      expect(statementsOf(name).some((statement) => /\bApiErrorCode\b/.test(statement) && statement.includes("'../../api/core-api'")), name).toBe(true);
    }
  });

  it('CPC1-6: each local adapter carries its ID as a text a search finds', () => {
    const marker = (name: string, id: string, near: string): void => {
      const text = raw(name);
      expect(text.includes(id), `${name} names ${id}`).toBe(true);
      // In the comment of the adapter itself, not somewhere else in the file.
      const at = text.indexOf(near);
      expect(at, `${name} holds ${near}`).toBeGreaterThan(0);
      expect(text.slice(Math.max(0, at - 700), at).includes(id), `${id} stands at ${near}`).toBe(true);
    };
    // Gap 3 was closed by the contract close-out W83: the index is read from the contract's table.
    expect(raw('bindings.ts')).toContain('DEVICE_COMMAND_OPERATIONS.RESTART');
    marker('neutral-state.ts', 'F66-5', 'export function lastActivityOf');
    marker('live-sim.ts', 'SIM-GAP-2', ' * Whenever a session or a pairing ends');
    // Decision D100: two gaps of this row, numbered in its own series; the contract close-out W83 ruled
    // both residuals of the demo (decision D184, R-C1 and R-C2) and renamed their markers.
    marker('live-sim.ts', 'RESIDUAL-W44-1', '  function revalidateSession(): void {');
    marker('live-sim.ts', 'RESIDUAL-W44-2', 'const plan = LIVE_BINDINGS.signOut.plan([debt.reason]');
    // No open contract gap is left in this folder (W83 closed gap 3); the two residuals are what remains.
    // The gap about the reason of a sign-out for an expiry (first numbered 4, then 7) is gone: since
    // decision D90 no sign-out is ever sent for an expiry.
    // The pattern is built from parts, so that the close-out's own search over the tree finds nothing here.
    const gapMarker = new RegExp(`${['CONTRACT', 'GAP'].join('-')}-[A-Z0-9-]+`, 'g');
    const gaps = files.flatMap((name) => [...raw(name).matchAll(gapMarker)].map((match) => `${name}: ${match[0]}`));
    expect(gaps).toEqual([]);
    const residuals = files.flatMap((name) => [...raw(name).matchAll(/RESIDUAL-W44-\d+/g)].map((match) => `${name}: ${match[0]}`));
    expect([...new Set(residuals)].sort()).toEqual(['live-sim.ts: RESIDUAL-W44-1', 'live-sim.ts: RESIDUAL-W44-2']);
  });
});

describe('the export subpath @dems/shared/live/source', () => {
  it('resolves to src/live/source/index.ts: the same module objects as the file itself', () => {
    expect(viaSubpath.createLiveSim).toBe(viaFile.createLiveSim);
    expect(viaSubpath.asSim).toBe(viaFile.asSim);
    expect(viaSubpath.LIVE_BINDINGS).toBe(viaFile.LIVE_BINDINGS);
    const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')) as { exports: Record<string, string> };
    expect(manifest.exports['./live/source']).toBe('./src/live/source/index.ts');
  });

  it('exports the Live source and nothing else', () => {
    expect(Object.keys(viaSubpath).sort()).toEqual([
      'DEVICE_COMMAND_OPERATION_INDEX',
      'ENVELOPE_SIM_CODE',
      'LIVE_BINDINGS',
      'LIVE_BINDING_NAMES',
      'LIVE_BOOT_TIMEOUT_MS',
      'LIVE_DEVICE_CLEANUP_GAVE_UP_CODE',
      'LIVE_DEVICE_CLEANUP_RETRIES',
      'LIVE_DEVICE_CLEANUP_RETRY_MS',
      'LIVE_ERROR_LOG_SIZE',
      'LIVE_ERROR_SOURCE',
      'LIVE_HELD_MESSAGES_MAX',
      'LIVE_PERMISSION_REFRESH_MS',
      'LIVE_RESULT_DISCRIMINANT',
      'LIVE_SECRETS_TIMEOUT_MS',
      'LIVE_SESSION_OPERATION',
      'LIVE_SESSION_PROBE_RETRY_MAX_MS',
      'LIVE_SESSION_PROBE_RETRY_MS',
      'LIVE_SETTLE_TIMEOUT_MS',
      'LIVE_SIGN_IN_STATUS_OPERATION',
      'LIVE_SNAPSHOT_TIMEOUT_CODE',
      'LIVE_STOPPED_CODE',
      'LIVE_SUBSCRIBER_REPORT_INTERVAL_MS',
      'LIVE_TOUCH_INTERVAL_MS',
      'LIVE_VALUE_ACTION_NAMES',
      'LiveActionFlow',
      'LiveMisuse',
      'NEUTRAL_LOCKOUT',
      'NOT_AVAILABLE',
      'asSim',
      'attemptResult',
      'attemptsRemainingOf',
      'authSliceOf',
      'createCommandGate',
      'createLiveClock',
      'createLiveResult',
      'createLiveSim',
      'createNeutralState',
      'createTouchThrottle',
      'envelopeSimCodeOf',
      'failedPairing',
      'foldStateMessages',
      'hasReached',
      'isRefusal',
      'lockoutSliceOf',
      'neutralPairing',
      'noSignalFrame',
      'operationOf',
      'pairedSlice',
      'permissionLabelOf',
      'rebuildRefusal',
      'rejectedLiveResult',
      'replacementPatch',
      'resolvedLiveResult',
      'shareStructure',
      'signedOutAuthSlice',
      'silentAudio',
      'transportErrorOf',
    ]);
  });

  it('the constants of §2.4 that belong to the source have the specification\'s values', () => {
    expect([viaFile.LIVE_SETTLE_TIMEOUT_MS, viaFile.LIVE_BOOT_TIMEOUT_MS, viaFile.LIVE_TOUCH_INTERVAL_MS]).toEqual([2_000, 4_000, 60_000]);
    expect([viaFile.LIVE_PERMISSION_REFRESH_MS, viaFile.LIVE_ERROR_LOG_SIZE]).toEqual([1_000, 50]);
  });

  it('the constants of the fix round after CP-C1 (decision D80)', () => {
    expect([viaFile.LIVE_SESSION_PROBE_RETRY_MS, viaFile.LIVE_SESSION_PROBE_RETRY_MAX_MS]).toEqual([2_000, 30_000]);
    expect(viaFile.LIVE_HELD_MESSAGES_MAX).toBe(256);
    expect(viaFile.LIVE_SECRETS_TIMEOUT_MS).toBe(5_000);
    expect([viaFile.LIVE_DEVICE_CLEANUP_RETRY_MS, viaFile.LIVE_DEVICE_CLEANUP_RETRIES]).toEqual([2_000, 3]);
    expect(viaFile.LIVE_SUBSCRIBER_REPORT_INTERVAL_MS).toBe(1_000);
    expect(viaFile.LIVE_STOPPED_CODE).toBe('STOPPED');
    expect(viaFile.LIVE_DEVICE_CLEANUP_GAVE_UP_CODE).toBe('DEVICE_CLEANUP_GAVE_UP');
    expect(viaFile.LiveMisuse).toEqual({ READ_AS_VALUE: 'READ_AS_VALUE', NOT_OBSERVED: 'NOT_OBSERVED' });
  });

  it('the public surface of a Live source has no member that returns a credential or a token (MP-3)', () => {
    const socket = {
      subscribe: () => () => undefined,
      getSnapshot: () => ({ state: 'CONNECTING', seq: null, serverTime: null, lastBeatAt: null, clients: null, reconnectAttempt: 0 }),
      start: () => undefined,
      stop: () => undefined,
      getStatus: () => ({ connection: 0 }),
      getLatestMeters: () => null,
      reconnect: () => false,
      setMetersWanted: () => undefined,
      requestResync: () => false,
    };
    const source = viaFile.createLiveSim({
      client: { call: () => Promise.resolve({}) },
      socket: { url: 'ws://127.0.0.1:4420/ws', create: () => socket as never },
      autoStart: false,
    });
    const members = Object.keys(source).sort();
    expect(members).toEqual([
      'actions',
      'auditChain',
      'client',
      'clock',
      'coreMode',
      'destroy',
      'errors',
      'flush',
      'heartbeat',
      'isReady',
      'isRunning',
      'lastSessionEnd',
      'link',
      'onControl',
      'onLiveChange',
      'onResync',
      'onSessionEnd',
      'ready',
      'reconnect',
      'request',
      'rng',
      'seed',
      'session',
      'setPairing',
      'socketStatus',
      'start',
      'stop',
      'store',
      'tick',
      'wasRestored',
    ]);
    expect(members.filter((name) => /token|credential|secret|bearer|password|cookie|header/i.test(name))).toEqual([]);
    // The 42 actions under the simulator's names, one stable object.
    expect(Object.keys(source.actions)).toEqual(viaFile.LIVE_BINDING_NAMES);
    expect(source.actions).toBe(source.actions);
    expect(source.coreMode).toBe('LIVE');
  });
});
