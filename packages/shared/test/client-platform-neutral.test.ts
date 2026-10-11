// AC-C-02 and plan row W12: the typed client folder is platform neutral. A static scan of every file
// under src/client, with comments removed (the same method as test/sim-platform-neutral.test.ts).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AC_C_02_NAMED } from './support/platform-rules';

const CLIENT_DIR = fileURLToPath(new URL('../src/client/', import.meta.url));

function filesOf(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesOf(`${dir}${entry.name}/`) : entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [`${dir}${entry.name}`] : [],
  );
}

const files = filesOf(CLIENT_DIR);
const raw = (file: string) => readFileSync(file, 'utf8');
/** The file without block and line comments. */
const code = (file: string) =>
  raw(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1');
const short = (file: string) => file.slice(CLIENT_DIR.length);
/** Every module specifier a file imports or re-exports from, static or dynamic. */
const specifiers = (file: string) =>
  [...code(file).matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm)].map((match) => match[1] ?? '');
const offenders = (pattern: RegExp) => files.filter((file) => pattern.test(code(file))).map(short);

describe('static scan of src/client', () => {
  it('scans the client files', () => {
    expect(files.map(short).sort()).toEqual(expect.arrayContaining(['core-client.ts', 'index.ts']));
  });

  it('imports only zod and the contract folder: no Node built-in, nothing from the simulator, no UI or device framework', () => {
    const seen = new Set<string>();
    for (const file of files) {
      for (const specifier of specifiers(file)) {
        seen.add(specifier);
        const allowed = specifier === 'zod' || specifier.startsWith('./') || /^\.\.\/api(\/[\w-]+)?$/.test(specifier);
        expect(allowed, `${short(file)} imports "${specifier}"`).toBe(true);
      }
    }
    // Positive control: the scan does see the imports that exist.
    expect([...seen]).toEqual(expect.arrayContaining(['zod', '../api/core-api', './core-client']));
    expect([...seen].filter((specifier) => /^node:|\/sim(\/|$)|^react|^expo|^zustand/.test(specifier))).toEqual([]);
  });

  it('AC-C-02: no file names node:, react-native, expo, window or document (comments included)', () => {
    expect(files.filter((file) => AC_C_02_NAMED.test(raw(file))).map(short)).toEqual([]);
  });

  it('uses no Node global: no Buffer, process, require, __dirname or module object', () => {
    expect(offenders(/\bBuffer\b|\bprocess\b|\brequire\s*\(|\b__dirname\b|\b__filename\b|\bmodule\.exports\b/)).toEqual([]);
  });

  it('uses no Web Streams and never reads a response stream (CL-3)', () => {
    expect(offenders(/ReadableStream|WritableStream|TransformStream|TextDecoderStream|getReader\s*\(|\.body\s*\.|\.body\s*\?\./)).toEqual([]);
    expect(offenders(/\.json\s*\(\s*\)|\.arrayBuffer\s*\(|\.blob\s*\(|\.formData\s*\(/)).toEqual([]);
    // Positive control: the body is read as text and parsed.
    expect(code(`${CLIENT_DIR}core-client.ts`)).toMatch(/response\.text\(\)/);
    expect(code(`${CLIENT_DIR}core-client.ts`)).toMatch(/JSON\.parse\(/);
  });

  it('names no storage, navigator, XMLHttpRequest or URL class; the only global looked up is fetch', () => {
    expect(offenders(/\b(sessionStorage|localStorage|navigator|XMLHttpRequest|URLSearchParams)\b|new URL\(/)).toEqual([]);
    const globalThisUses = files.flatMap((file) => [...code(file).matchAll(/globalThis[^;\n]*/g)].map((match) => match[0]));
    expect(globalThisUses.length).toBeGreaterThan(0);
    for (const use of globalThisUses) expect(use).toMatch(/fetch|^globalThis, input, init\)/);
  });

  it('writes nothing to the console: the debug log and the report go to injected sinks (CL-6a)', () => {
    expect(offenders(/\bconsole\./)).toEqual([]);
  });
});
