// Plan row W18 and AC-C-02: the light Live API holds no network code and is platform neutral. A
// static scan of the top-level files of src/live (the method of test/sim-platform-neutral.test.ts
// and test/client-platform-neutral.test.ts). The folders src/live/source and src/live/testing are
// the heavy module and the test double of later rows; they are not part of the light API.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as viaSubpath from '@dems/shared/live';
import * as viaFile from '../src/live';

const SRC_DIR = fileURLToPath(new URL('../src/', import.meta.url));
const LIVE_DIR = `${SRC_DIR}live/`;
const LIGHT_FILES = ['constants.ts', 'core-actions.ts', 'errors.ts', 'hooks.ts', 'index.ts', 'mode.ts', 'settle.ts'];

/** Every top-level source file of src/live: whatever sits here is the light API. */
const files = readdirSync(LIVE_DIR, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();

const raw = (name: string) => readFileSync(`${LIVE_DIR}${name}`, 'utf8');
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
/** The file without block and line comments. */
const code = (name: string) => stripComments(raw(name));
/** Every module specifier a text imports or re-exports from, static or dynamic. */
const specifiersOf = (text: string) =>
  [...text.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm)].map((match) => match[1] ?? '');
const offenders = (pattern: RegExp, text: (name: string) => string = code) => files.filter((name) => pattern.test(text(name)));

/** Resolves a relative specifier to a source file, as the bundlers do. */
function resolveRelative(from: string, specifier: string): string | null {
  const base = resolve(dirname(from), specifier);
  for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`, base]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Every source file reachable from the light API through relative imports, type-only ones included. */
function reachable(): string[] {
  const seen = new Set<string>();
  const queue = files.map((name) => `${LIVE_DIR}${name}`);
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!/\.tsx?$/.test(file)) continue;
    for (const specifier of specifiersOf(stripComments(readFileSync(file, 'utf8')))) {
      if (!specifier.startsWith('.')) continue;
      const target = resolveRelative(file, specifier);
      if (target) queue.push(target);
    }
  }
  return [...seen].map((file) => file.slice(SRC_DIR.length)).sort();
}

describe('static scan of the light Live API (src/live, top level)', () => {
  it('scans the seven files of the light API (the six of the row and constants.ts)', () => {
    expect(files).toEqual(LIGHT_FILES);
  });

  it('imports only React, the simulator module and its own files', () => {
    const allowed = new Set([
      'react',
      '../sim/engine',
      '../sim/errors',
      '../sim/react',
      '../sim/types',
      '../sim/vocabulary',
      './constants',
      './core-actions',
      './errors',
      './hooks',
      './mode',
      './settle',
    ]);
    const seen = new Set<string>();
    for (const name of files) {
      for (const specifier of specifiersOf(code(name))) {
        seen.add(specifier);
        expect(allowed.has(specifier), `${name} imports "${specifier}"`).toBe(true);
      }
    }
    // Positive control: the scan does see the imports that exist.
    expect([...seen]).toEqual(expect.arrayContaining(['react', '../sim/react', '../sim/errors', './settle', './hooks']));
  });

  it('no network code: imports no Node built-in, nothing under src/client, src/realtime or src/api, and neither heavy folder', () => {
    for (const name of files) {
      const bad = specifiersOf(code(name)).filter((specifier) =>
        /^node:|(^|\/)client(\/|$)|(^|\/)realtime(\/|$)|(^|\/)api(\/|$)|(^|\/)source(\/|$)|(^|\/)testing(\/|$)|^@dems\/shared/.test(specifier),
      );
      expect(bad, name).toEqual([]);
    }
  });

  it('no network code: names no request function and no connection class, comments included', () => {
    const network = /\bfetch\b|WebSocket|XMLHttpRequest|EventSource|sendBeacon|\bnavigator\b|\bhttps?:\/\/|\bwss?:\/\//;
    expect(offenders(network, raw)).toEqual([]);
    // Positive control: the same pattern finds the typed client, which does call the network.
    expect(network.test(readFileSync(`${SRC_DIR}client/core-client.ts`, 'utf8'))).toBe(true);
  });

  it('nothing reachable from the light API, type-only imports included, lies under src/client, src/realtime, src/live/source or src/live/testing', () => {
    const graph = reachable();
    expect(graph.filter((file) => /^(client|realtime)\/|^live\/(source|testing)\//.test(file))).toEqual([]);
    // Positive control: the walk does follow imports into the simulator.
    expect(graph).toEqual(expect.arrayContaining(['live/settle.ts', 'sim/react.ts', 'sim/engine.ts', 'sim/errors.ts']));
  });

  it('AC-C-02: no file names node:, react-native, expo, window or document (comments included)', () => {
    expect(offenders(/node:|react-native|\bexpo\b|\bwindow\b|\bdocument\b/, raw)).toEqual([]);
  });

  it('only hooks.ts imports React; the other files have no runtime import beyond the simulator error classes', () => {
    for (const name of files) {
      const list = specifiersOf(code(name));
      if (name !== 'hooks.ts') expect(list.filter((specifier) => specifier === 'react' || specifier.startsWith('react/')), name).toEqual([]);
    }
    expect(specifiersOf(code('hooks.ts'))).toContain('react');
    expect(specifiersOf(code('settle.ts'))).toEqual([]);
    expect(specifiersOf(code('constants.ts'))).toEqual([]);
    // core-actions.ts and mode.ts import types only, so they load nothing at run time.
    for (const name of ['core-actions.ts', 'mode.ts']) {
      const imports = code(name).match(/^\s*import\s[^;]*;/gm) ?? [];
      expect(imports.length, name).toBeGreaterThan(0);
      for (const statement of imports) expect(statement.trimStart().startsWith('import type '), `${name}: ${statement}`).toBe(true);
    }
    expect(specifiersOf(code('errors.ts'))).toEqual(['../sim/errors']);
  });

  it('reads no storage, starts no timer, writes nothing to the console and uses no global object', () => {
    expect(offenders(/\b(sessionStorage|localStorage|AsyncStorage|SecureStore|indexedDB)\b|\bcookie\b/i)).toEqual([]);
    expect(offenders(/(^|[^.\w])(setTimeout|setInterval|setImmediate|queueMicrotask|requestAnimationFrame)\s*\(/m)).toEqual([]);
    expect(offenders(/\bconsole\./)).toEqual([]);
    expect(offenders(/\bglobalThis\b|\bprocess\b|\bBuffer\b|\brequire\s*\(|\bimport\.meta\b|\b__DEV__\b/)).toEqual([]);
    expect(offenders(/Math\.random|\bDate\.now\b|new Date\(/)).toEqual([]);
  });

  it('uses erasable syntax only: no enum, no namespace, no parameter property', () => {
    expect(offenders(/^\s*(export\s+)?(declare\s+)?(const\s+)?enum\s/m)).toEqual([]);
    expect(offenders(/^\s*(export\s+)?namespace\s/m)).toEqual([]);
    expect(offenders(/constructor\s*\([^)]*\b(public|private|protected|readonly)\b/)).toEqual([]);
  });
});

describe('the export subpath @dems/shared/live', () => {
  it('resolves to src/live/index.ts: the same module objects as the file itself', () => {
    expect(viaSubpath.settle).toBe(viaFile.settle);
    expect(viaSubpath.useCoreActions).toBe(viaFile.useCoreActions);
    expect(viaSubpath.LiveTransportError).toBe(viaFile.LiveTransportError);
  });

  it('exports the light API and nothing else', () => {
    expect(Object.keys(viaSubpath).sort()).toEqual([
      'CORE_MODES',
      'CoreMode',
      'CoreRefusalError',
      'DEFAULT_CORE_MODE',
      'LIVE_PENDING_REVEAL_MS',
      'LIVE_RESYNCED_NOTICE_MS',
      'LiveLinkState',
      'LiveTransportError',
      'LiveTransportReason',
      'SimNotFoundError',
      'SimPermissionError',
      'SimTransitionError',
      'coreActionsOf',
      'coreModeOf',
      'corePermissionOf',
      'liveLinkOf',
      'liveOf',
      'parseCoreMode',
      'settle',
      'useCoreActions',
      'useCoreMode',
      'useCorePermission',
      'useLive',
      'useLiveLink',
      'useLiveSelector',
    ]);
  });

  it('the package manifest maps ./live to the file and keeps the two heavy subpaths apart', () => {
    const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')) as { exports: Record<string, string> };
    expect(manifest.exports['./live']).toBe('./src/live/index.ts');
    expect(manifest.exports['./live/source']).toBe('./src/live/source/index.ts');
    expect(manifest.exports['./live/testing']).toBe('./src/live/testing/index.ts');
  });
});
