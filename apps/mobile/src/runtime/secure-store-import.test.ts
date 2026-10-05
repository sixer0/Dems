// Backend task W15, static test (04_client_integration_spec MP-1, AC-C-66): the secure-store package
// is imported by exactly one file under `apps/mobile/src/`, the wrapper `runtime/secure-credentials.ts`.
// Every `.ts` / `.tsx` file is read, tests included. The package's name is put together below, so
// that this file does not hold the text it looks for.
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const PACKAGE = ['expo', 'secure', 'store'].join('-');
const NATIVE_MODULE = ['Expo', 'Secure', 'Store'].join('');
const SRC = join(__dirname, '..');
const WRAPPER = 'runtime/secure-credentials.ts';

/** A module specifier of the package (or of a path inside it), in single or double quotes. */
const SPECIFIER = new RegExp(`['"]${PACKAGE}(?:/[^'"]*)?['"]`);
/** The native module's name as a string: `requireNativeModule` would go around the package. */
const NATIVE = new RegExp(`['"\`]${NATIVE_MODULE}['"\`]`);

function sourceFiles(folder: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(folder)) {
    if (name === 'node_modules') continue;
    const path = join(folder, name);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(name)) found.push(path);
  }
  return found;
}

function filesMatching(pattern: RegExp): string[] {
  return sourceFiles(SRC)
    .filter((path) => pattern.test(readFileSync(path, 'utf8')))
    .map((path) => relative(SRC, path).split(sep).join('/'))
    .sort();
}

describe('the secure-store package has one importer (MP-1, AC-C-66)', () => {
  it('the matcher finds every way of naming the package, and nothing else', () => {
    const naming = [
      `import * as SecureStore from '${PACKAGE}';`,
      `import { getItemAsync } from "${PACKAGE}";`,
      `const store = require('${PACKAGE}');`,
      `const store = await import('${PACKAGE}');`,
      `jest.mock('${PACKAGE}', () => ({}));`,
      `jest.requireActual<object>('${PACKAGE}/build/SecureStore');`,
    ];
    for (const text of naming) expect(SPECIFIER.test(text)).toBe(true);

    const notNaming = [
      `// the wrapper is the only importer of ${PACKAGE}`,
      ` * | \`secure-store\` | \`${PACKAGE}\` through the wrapper |`,
      `import * as Store from '${PACKAGE}-extras';`,
      `import { secureStoreDevProbe } from './secure-credentials';`,
    ];
    for (const text of notNaming) expect(SPECIFIER.test(text)).toBe(false);
    expect(NATIVE.test(`requireNativeModule('${NATIVE_MODULE}')`)).toBe(true);
  });

  it('reads the whole source tree', () => {
    const files = sourceFiles(SRC).map((path) => relative(SRC, path).split(sep).join('/'));
    expect(files.length).toBeGreaterThan(200);
    expect(files).toContain(WRAPPER);
    expect(files).toContain('runtime/dev-probes.ts');
    expect(files).toContain('runtime/secure-store-import.test.ts');
  });

  it('exactly one file names the package: the wrapper', () => {
    expect(filesMatching(SPECIFIER)).toEqual([WRAPPER]);
  });

  it('no file reaches the native module by its own name', () => {
    expect(filesMatching(NATIVE)).toEqual([]);
  });
});
