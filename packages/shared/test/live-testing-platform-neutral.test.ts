// Plan row W31, AC-C-02 and TS-15: the fake transport is platform neutral and runner neutral, and no
// production file imports it. A static scan of every file under src/live/testing (the method of
// test/client-platform-neutral.test.ts and test/live-light-platform-neutral.test.ts).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as viaSubpath from '@dems/shared/live/testing';
import * as viaFile from '../src/live/testing';
import { AC_C_02_NAMED, expectScanCovers } from './support/platform-rules';

const REPO_DIR = fileURLToPath(new URL('../../../', import.meta.url));
const SRC_DIR = fileURLToPath(new URL('../src/', import.meta.url));
const TESTING_DIR = `${SRC_DIR}live/testing/`;

function filesOf(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
    if (entry.isDirectory()) return filesOf(`${dir}${entry.name}/`);
    return /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(entry.name) ? [`${dir}${entry.name}`] : [];
  });
}

const files = filesOf(TESTING_DIR).sort();
const short = (file: string) => file.slice(TESTING_DIR.length);
const raw = (file: string) => readFileSync(file, 'utf8');
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
/** The file without block and line comments. */
const code = (file: string) => stripComments(raw(file));
/** Every module specifier a text imports or re-exports from, static or dynamic. */
const specifiersOf = (text: string) =>
  [...text.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm)].map((match) => match[1] ?? '');
const offenders = (pattern: RegExp, text: (file: string) => string = code) => files.filter((file) => pattern.test(text(file))).map(short);

describe('static scan of src/live/testing', () => {
  it('scans every source file of the fake transport: an independent listing finds no file the scan missed (rule R1)', () => {
    expectScanCovers(TESTING_DIR, files.map(short));
  });

  it('imports only its own files, the contract folder, and the two clients it stands in for', () => {
    const seen = new Set<string>();
    for (const file of files) {
      for (const specifier of specifiersOf(code(file))) {
        seen.add(specifier);
        const allowed =
          /^\.\/[\w-]+$/.test(specifier) ||
          /^\.\.\/\.\.\/api\/[\w-]+$/.test(specifier) ||
          specifier === '../../client/core-client' ||
          specifier === '../../realtime/heartbeat-client';
        expect(allowed, `${short(file)} imports "${specifier}"`).toBe(true);
      }
    }
    // Positive control: the scan does see the imports that exist.
    expect([...seen]).toEqual(
      expect.arrayContaining(['./errors', './http', '../../api/core-api', '../../api/examples', '../../api/realtime-messages', '../../client/core-client', '../../realtime/heartbeat-client']),
    );
  });

  it('no Node built-in, no package, no simulator, no UI framework, and none of the heavy or the light Live modules', () => {
    for (const file of files) {
      const bad = specifiersOf(code(file)).filter((specifier) => !specifier.startsWith('.') || /(^|\/)(sim|source|i18n|domain|demo-data|tokens|brand)(\/|$)/.test(specifier));
      expect(bad, short(file)).toEqual([]);
    }
    expect(offenders(/\bfrom\s+['"](node:|vitest|jest|@jest\/|react|zod|zustand)/)).toEqual([]);
  });

  it('the typed client and the socket client are imported as types only: neither is loaded at run time', () => {
    let typeOnly = 0;
    for (const file of files) {
      for (const statement of code(file).match(/^\s*import\s[^;]*?from\s+['"]\.\.\/\.\.\/(client|realtime)\/[^'"]+['"];/gm) ?? []) {
        expect(statement.trimStart().startsWith('import type '), `${short(file)}: ${statement.trim()}`).toBe(true);
        typeOnly += 1;
      }
    }
    expect(typeOnly).toBeGreaterThanOrEqual(2);
  });

  it('names no test runner: no vi, no jest, no describe, it, expect or hook call', () => {
    expect(offenders(/\bvi\.\w|\bjest\.\w|\bvitest\b|@jest\/globals/)).toEqual([]);
    expect(offenders(/(^|[^.\w])(describe|it|test|expect|beforeEach|afterEach|beforeAll|afterAll)\s*\(/m)).toEqual([]);
    // Positive control: this test file does name them.
    expect(/(^|[^.\w])(describe|it|expect)\s*\(/m.test(stripComments(raw(fileURLToPath(import.meta.url))))).toBe(true);
  });

  it('AC-C-02: no file names node:, react-native, expo, window or document (comments included)', () => {
    expect(offenders(AC_C_02_NAMED, raw)).toEqual([]);
  });

  it('starts no timer and reads no real time: delays and instants come from the injected clock', () => {
    expect(offenders(/(^|[^.\w])(setTimeout|setInterval|setImmediate|queueMicrotask|requestAnimationFrame|requestIdleCallback)\s*\(/m)).toEqual([]);
    expect(offenders(/\bDate\.now\b|new Date\(\s*\)|\bperformance\b|Math\.random/)).toEqual([]);
    // Positive control: the only timer calls are those of the timer functions a caller passes in.
    expect(code(`${TESTING_DIR}clock.ts`)).toMatch(/timers\.setTimeout\(/);
    expect(code(`${TESTING_DIR}socket.ts`)).toMatch(/new Date\(hub\.context\.clock\.now\(\)\)/);
  });

  it('opens no connection: no request function of a runtime, no connection class, no address', () => {
    expect(offenders(/XMLHttpRequest|EventSource|sendBeacon|\bnavigator\b|\bnew\s+WebSocket\b|\bhttps?:\/\/|\bwss?:\/\//)).toEqual([]);
    expect(offenders(/(^|[^.\w])fetch\s*\(/m)).toEqual([]);
  });

  it('uses no Node global and no storage; the global object is named by install.ts only', () => {
    expect(offenders(/\bBuffer\b|\bprocess\b|\brequire\s*\(|\b__dirname\b|\b__filename\b|\bmodule\.exports\b|\bimport\.meta\b|\b__DEV__\b/)).toEqual([]);
    expect(offenders(/\b(sessionStorage|localStorage|AsyncStorage|SecureStore|indexedDB)\b/)).toEqual([]);
    expect(offenders(/\bconsole\./)).toEqual([]);
    expect(offenders(/\bglobalThis\b/)).toEqual(['install.ts']);
    expect(offenders(/\bnew\s+URL\b|\bURLSearchParams\b|\bTextEncoder\b|\bTextDecoder\b|ReadableStream/)).toEqual([]);
  });

  it('uses erasable syntax that every transform of the two apps takes: no enum, namespace, parameter property, declare field or private name', () => {
    expect(offenders(/^\s*(export\s+)?(declare\s+)?(const\s+)?enum\s/m)).toEqual([]);
    expect(offenders(/^\s*(export\s+)?namespace\s/m)).toEqual([]);
    // A parameter property: a modifier that opens a constructor parameter (`readonly` inside a parameter's type is none).
    const parameterProperty = /constructor\s*\((?:[^)]*,)?\s*(?:(?:public|private|protected|readonly)\s+)+\w+\s*[?:]/;
    expect(offenders(parameterProperty)).toEqual([]);
    expect(parameterProperty.test('constructor(private readonly hub: Hub) {}')).toBe(true);
    expect(parameterProperty.test('constructor(a: string, readonly b: number) {}')).toBe(true);
    expect(parameterProperty.test('constructor(reason: string, issues: readonly string[] = []) {}')).toBe(false);
    expect(offenders(/^\s*declare\s/m)).toEqual([]);
    expect(offenders(/(this|\w)\.#\w|^\s*(readonly\s+)?#\w/m)).toEqual([]);
  });
});

describe('the export subpath @dems/shared/live/testing', () => {
  it('resolves to src/live/testing/index.ts: the same module objects as the file itself', () => {
    expect(viaSubpath.createFakeTransport).toBe(viaFile.createFakeTransport);
    expect(viaSubpath.FakeTransportRequestError).toBe(viaFile.FakeTransportRequestError);
    expect(viaSubpath.installFakeTransport).toBe(viaFile.installFakeTransport);
    const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')) as { exports: Record<string, string> };
    expect(manifest.exports['./live/testing']).toBe('./src/live/testing/index.ts');
  });

  it('exports the fake transport, its named errors and its helpers, and nothing else', () => {
    expect(Object.keys(viaSubpath).sort()).toEqual([
      'ABNORMAL_CLOSURE',
      'FAKE_CLOCK_START_MS',
      'FAKE_CREDENTIALS',
      'FakeConnection',
      'FakeMessageViolation',
      'FakeRequestViolation',
      'FakeResponseViolation',
      'FakeSocket',
      'FakeSocketMessageError',
      'FakeSocketUpgradeError',
      'FakeTransportError',
      'FakeTransportRequestError',
      'FakeTransportResponseError',
      'FakeTransportUnscriptedError',
      'FakeTransportUsageError',
      'FakeUpgradeViolation',
      'NO_ANSWER',
      'OUTAGE',
      'clockFromTimers',
      'createFakeClock',
      'createFakeContract',
      'createFakeTransport',
      'describeLogEntry',
      'exampleAnswer',
      'exampleInput',
      'holdsCredential',
      'installFakeTransport',
      'maskCredentials',
      'maskHeaderValue',
      'notReady',
      'rateLimited',
      'refusal',
      'withFakeTransport',
    ]);
  });

  it('every named error is an Error and a FakeTransportError, with its own name', () => {
    const { FakeTransportError } = viaSubpath;
    const made = [
      new viaSubpath.FakeTransportRequestError({ reason: 'UNKNOWN_ROUTE', method: 'GET', route: '/x' }),
      new viaSubpath.FakeTransportResponseError({ reason: 'INVALID_BODY', operationId: 'op', status: 200, stage: 'scripting' }),
      new viaSubpath.FakeTransportUnscriptedError('op', 'GET', '/x'),
      new viaSubpath.FakeSocketUpgradeError('INVALID_URL'),
      new viaSubpath.FakeSocketMessageError({ reason: 'NOT_JSON', direction: 'client' }),
      new viaSubpath.FakeTransportUsageError('misuse'),
    ];
    expect(made.map((error) => error.name)).toEqual([
      'FakeTransportRequestError',
      'FakeTransportResponseError',
      'FakeTransportUnscriptedError',
      'FakeSocketUpgradeError',
      'FakeSocketMessageError',
      'FakeTransportUsageError',
    ]);
    for (const error of made) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(FakeTransportError);
      expect(String(error)).toMatch(new RegExp(`^${error.name}: Fake transport: `));
      expect(error.message).toContain(`[${error.reason}]`);
    }
  });
});

describe('TS-15: the fake transport is imported by tests and test harnesses only', () => {
  /** A test, a test harness or a test set-up file, by the conventions of the three workspaces. */
  const isTestFile = (file: string) => /(^|\/)(test|tests|__tests__|__mocks__|testing|e2e)\//.test(file) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(file) || /(^|\/)jest\.setup\.[jt]s$/.test(file);
  const importsFake = (file: string) =>
    specifiersOf(stripComments(raw(file))).some((specifier) => /(^|\/)live\/testing(\/|$)/.test(specifier) || (/(^|\/)testing(\/[\w-]+)?$/.test(specifier) && file.startsWith(`${SRC_DIR}live/`)));

  it('no file of the shared package outside the folder imports it', () => {
    const others = filesOf(SRC_DIR).filter((file) => !file.startsWith(TESTING_DIR));
    expect(others.length).toBeGreaterThan(50);
    expect(others.filter(importsFake).map((file) => file.slice(SRC_DIR.length))).toEqual([]);
    // Positive control: the same check finds an import of the folder.
    expect(specifiersOf("import { createFakeTransport } from '@dems/shared/live/testing';")).toEqual(['@dems/shared/live/testing']);
  });

  it.each(['apps/core-web/src/', 'apps/mobile/src/', 'apps/mobile/app/', 'apps/core-server/src/', 'apps/mock-core/src/'])('no production file under %s imports it', (folder) => {
    const production = filesOf(`${REPO_DIR}${folder}`).filter((file) => !isTestFile(file.slice(REPO_DIR.length)));
    expect(production.filter(importsFake).map((file) => file.slice(REPO_DIR.length))).toEqual([]);
  });

  it('the rule that tells a test file from a production file knows the layouts in use', () => {
    expect(['apps/core-web/src/test/live-dashboard-a.test.tsx', 'apps/mobile/src/features/audit/testing/audit-harness.tsx', 'apps/core-web/src/features/evidence/__tests__/harness.ts', 'apps/mobile/jest.setup.ts'].every(isTestFile)).toBe(true);
    expect(['apps/core-web/src/main.tsx', 'apps/mobile/src/runtime/debug.ts', 'apps/core-web/src/lib/attest.ts', 'apps/mobile/src/features/audit/audit-screen.tsx'].some(isTestFile)).toBe(false);
  });
});
