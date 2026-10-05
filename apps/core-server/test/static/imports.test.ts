// Static guard: what a production source may import (checkpoint CP-B1, findings CPB1-10,
// CPB1-11, CPB1-12, CPB1-16; decisions D62 DN-10, D77 DN-13, D78 DN-11; fix rounds B1 and B2b).
//
// Rules 1, 2, 4 and 5 are server-wide, for every production source under `src/`; rule 3 is for
// the neutral test support:
//
//   1. NO TEST CODE. A production source imports nothing from a `__tests__` folder, nothing from
//      `test/` (the neutral test support `test/support/` and the database helper
//      `test/helpers/db/` included) and no `*.test.ts` file. Test support can then never reach a
//      running server, whatever it does.
//
//   2. A CLOSED UNIT IS IMPORTED THROUGH ITS INDEX. A source of ANOTHER unit that names a file
//      inside a closed unit (`'../../plugins/throttle/windows'`) makes that file part of the
//      unit's interface without its owner having said so, and a move inside the unit then breaks
//      a stranger. The closed units are listed below. Inside its own unit a source imports what
//      it likes.
//
//   3. THE NEUTRAL TEST SUPPORT STANDS ON ITS OWN. `test/support/` is where the helpers live that
//      tests of several rows use. A file there imports production sources, packages and its
//      neighbours in that folder, never a row's `__tests__` folder, and the files of the folder
//      import each other without a cycle. (Until fix round B1 the guard's test support imported
//      the identity row's, and the identity row's imported the guard's.)
//
//   4. NO CYCLE BETWEEN UNITS. Counted by value imports (an import of types only is erased by
//      the compiler and loads nothing). Until fix round B2b the identity module, the pairing
//      module and the stages 4 and 6 imported each other in a circle (finding CPB1-10).
//
//   5. WHAT IS BELOW THE MODULES IMPORTS NO MODULE. The core, the engine, the realtime channel
//      and every plugin import no value of a module: a module is reached through its seam on
//      `app` (the scaffold's rule, `src/app.ts`). And a module imports another module's value
//      only where a decision says so; those places are listed below, each with its reason.
//
// Rule 2 holds for every unit but ONE, so the list is explicit. Closed since fix round B2b:
// every module, the schema, the seed, the reset routine and the bulk fixture. Two kinds of path
// inside a closed unit are offered beside its index (`EXPOSED` below, each with its reason).
// Not closed:
//
//   src/db/commands        has no index, by design: its files are the command-line programs and
//                          the one reader of the owner connection file. The owner programs
//                          (seed, reset, fixture) name the file they need; the static guard of
//                          the credential files names files too (`credentials.test.ts`). An
//                          index for it is a decision of the database rows' owner.
//
// The rules read the relative import specifiers of the sources as text (comments left out) and
// resolve them against the importing file. A bare specifier (`fastify`, `@dems/shared/api`) is a
// package and no concern of this test.
import { describe, expect, it } from 'vitest';
import { deepImports, isListed, relativeImports, testCodeImports, topFoldersOf, unitCycles, unitEdges, unitOf, valueImports } from './imports';
import { WORKSPACE, codeOnly, isProductionSource, isTestFile, readTree, type SourceFile } from './scan';

/**
 * The units that are imported only through their index. An entry that ends with `/` closes every
 * unit of that group, also one that a later row adds.
 */
const CLOSED_UNITS: readonly string[] = [
  'src/core',
  'src/engine',
  'src/realtime',
  'src/plugins/',
  'src/modules/',
  'src/db/mapping',
  'src/db/store',
  'src/db/schema',
  'src/db/seed',
  'src/db/reset',
  'src/db/fixtures',
];

/**
 * Paths inside a closed unit that its owner offers beside the unit's index. An import of exactly
 * such a path is no deep import.
 *
 *   modules/identity/password-hash   the password-hash wrapper (plan row W09, hand-built element
 *                                    HB-4): a folder of another row inside the identity module,
 *                                    with an index of its own. The seed program and the bulk
 *                                    fixture, which run as the owner role without the server,
 *                                    import it there and not through the module's index, which
 *                                    would load the routes and the stages with it;
 *   modules/identity/biometric       the biometric row's folder (W41), with an index of its own:
 *                                    the one function that revokes a biometric token (D105);
 *   db/schema/boot-checks            the boot checks live beside the schema and are NOT
 *                                    re-exported by its index, which is the entry of
 *                                    `drizzle-kit` and loads table definitions only (the
 *                                    schema's own header; the folder is the migration writer's).
 */
const EXPOSED: readonly string[] = ['src/modules/identity/password-hash', 'src/modules/identity/biometric', 'src/db/schema/boot-checks'];

/** The folders whose units are BELOW the modules: none of them imports a value of a module. */
const BELOW_THE_MODULES: readonly string[] = ['src/core', 'src/engine', 'src/realtime', 'src/plugins/'];

/**
 * The value imports from one module into another. Each is a decision, not a habit: a module
 * reaches another through its seam on `app`. A new one fails this test until it is listed here
 * with its reason.
 *
 *   admin   -> identity   `revokeBiometricTokens` of `identity/biometric`: one writer of every
 *                         UPDATE of `biometric_tokens` (decision D105);
 *   pairing -> identity   the same function (D105), in the unit of a revoke and of an unpair;
 *                         `SESSION_IDLE_TIMEOUT_MS`, the limit the registry read applies to a
 *                         device's session; `createSweeper`, the timer helper of the expiry
 *                         sweeps (review CPB1-10 proposes the core as its home).
 */
const MODULE_TO_MODULE: readonly string[] = ['src/modules/admin -> src/modules/identity', 'src/modules/pairing -> src/modules/identity'];

const tree = readTree(WORKSPACE);
const production = codeOnly(tree.filter((file) => isProductionSource(file.path) && file.path.endsWith('.ts')));
const topFolders = topFoldersOf(tree);
const imports = relativeImports(production);
const edges = unitEdges(valueImports(production), topFolders);

describe('the scan itself', () => {
  const folders: ReadonlySet<string> = new Set(['core', 'engine', 'realtime', 'plugins', 'modules', 'db']);

  it('finds the relative imports of a source in every form, and no package (positive control)', () => {
    const planted: SourceFile[] = [
      {
        path: 'src/modules/a/handler.ts',
        text: [
          "import { x } from '../../core';",
          "import type { Y } from '../../core/types';",
          "export { z } from './store';",
          "import '../../plugins/logger/index';",
          "const lazy = await import('../../engine/host');",
          "import {\n  one,\n  two,\n} from '../b/statements';",
          "import fastify from 'fastify';",
          "import { api } from '@dems/shared/api';",
        ].join('\n'),
      },
    ];
    expect(relativeImports(planted).map((entry) => `${entry.line} ${entry.specifier} -> ${entry.target}`)).toEqual([
      '1 ../../core -> src/core',
      '2 ../../core/types -> src/core/types',
      '3 ./store -> src/modules/a/store',
      '4 ../../plugins/logger/index -> src/plugins/logger/index',
      '5 ../../engine/host -> src/engine/host',
      '9 ../b/statements -> src/modules/b/statements',
    ]);
  });

  it('knows the unit of a path', () => {
    expect(unitOf('src/core/pipeline', folders)).toBe('src/core');
    expect(unitOf('src/core', folders)).toBe('src/core');
    expect(unitOf('src/plugins/throttle/limits', folders)).toBe('src/plugins/throttle');
    expect(unitOf('src/modules/identity/biometric/store', folders)).toBe('src/modules/identity');
    expect(unitOf('src/db/mapping', folders)).toBe('src/db/mapping');
    expect(unitOf('src/db/store/store', folders)).toBe('src/db/store');
    // A file directly under `src/` is in no unit, and neither is anything outside `src/`.
    expect(unitOf('src/app', folders)).toBeNull();
    expect(unitOf('src/config', folders)).toBeNull();
    expect(unitOf('test/support/apps', folders)).toBeNull();
    expect(isListed('src/plugins/throttle', CLOSED_UNITS)).toBe(true);
    expect(isListed('src/core', CLOSED_UNITS)).toBe(true);
    expect(isListed('src/modules/identity', CLOSED_UNITS)).toBe(true);
    expect(isListed('src/db/schema', CLOSED_UNITS)).toBe(true);
    expect(isListed('src/db/commands', CLOSED_UNITS)).toBe(false);
  });

  it('reports an import of test code and a deep import into a closed unit, and nothing else (positive control)', () => {
    const planted: SourceFile[] = [
      {
        path: 'src/modules/a/handler.ts',
        text: [
          "import { signedIn } from '../../../test/support';",
          "import { helper } from '../identity/__tests__/support';",
          "import { suite } from './handler.test';",
          "import { windows } from '../../plugins/throttle/windows';",
          "import type { Unit } from '../../core/types';",
          "import { rows } from '../../db/mapping/rows';",
          "import { apply } from '../../db/store/store';",
          "import { host } from '../../engine/host';",
          "import { values } from '../../db/schema/value-sets';",
          "import { limits } from '../identity/limits';",
          "import { store } from '../identity/biometric/store';",
          // Allowed: the index of a closed unit, a file of its own unit, a unit that is not
          // closed, a file outside every unit, and a path a closed unit offers beside its index.
          "import { core } from '../../core';",
          "import { index } from '../../plugins/throttle/index';",
          "import { own } from './statements';",
          "import { names } from '../../db/commands/database-names';",
          "import { config } from '../../config';",
          "import { revoke } from '../identity/biometric';",
          "import { hash } from '../identity/password-hash/index';",
          "import { checks } from '../../db/schema/boot-checks';",
        ].join('\n'),
      },
      // Inside its own unit a source imports what it likes.
      { path: 'src/core/pipeline.ts', text: "import { unit } from './unit-of-work';\nimport { rule } from '../core/unit-statement';" },
    ];
    const found = relativeImports(planted);
    expect(testCodeImports(found).map((place) => place.replace(/ imports test code.*$/, ''))).toEqual([
      'src/modules/a/handler.ts:1',
      'src/modules/a/handler.ts:2',
      'src/modules/a/handler.ts:3',
    ]);
    expect(deepImports(found, CLOSED_UNITS, folders, EXPOSED)).toEqual([
      // Test code inside a closed unit is refused by both rules.
      "src/modules/a/handler.ts:2 reaches into src/modules/identity: ../identity/__tests__/support (import the unit's index, '../identity')",
      "src/modules/a/handler.ts:4 reaches into src/plugins/throttle: ../../plugins/throttle/windows (import the unit's index, '../../plugins/throttle')",
      "src/modules/a/handler.ts:5 reaches into src/core: ../../core/types (import the unit's index, '../../core')",
      "src/modules/a/handler.ts:6 reaches into src/db/mapping: ../../db/mapping/rows (import the unit's index, '../../db/mapping')",
      "src/modules/a/handler.ts:7 reaches into src/db/store: ../../db/store/store (import the unit's index, '../../db/store')",
      "src/modules/a/handler.ts:8 reaches into src/engine: ../../engine/host (import the unit's index, '../../engine')",
      "src/modules/a/handler.ts:9 reaches into src/db/schema: ../../db/schema/value-sets (import the unit's index, '../../db/schema')",
      "src/modules/a/handler.ts:10 reaches into src/modules/identity: ../identity/limits (import the unit's index, '../identity')",
      "src/modules/a/handler.ts:11 reaches into src/modules/identity: ../identity/biometric/store (import the unit's index, '../identity')",
    ]);
    // Without the list of exposed paths the three imports of them are deep imports too.
    expect(deepImports(found, CLOSED_UNITS, folders)).toHaveLength(12);
  });

  it('reads the production sources of the server, the module folders included, and sees their imports', () => {
    const paths = production.map((file) => file.path);
    for (const folder of ['src/core/', 'src/engine/', 'src/plugins/', 'src/modules/', 'src/db/seed/', 'src/db/reset/', 'src/db/fixtures/']) {
      expect(paths.some((path) => path.startsWith(folder)), folder).toBe(true);
    }
    expect(paths.some((path) => isTestFile(path))).toBe(false);
    expect(imports.length).toBeGreaterThan(300);
    for (const folder of folders) expect(topFolders.has(folder), folder).toBe(true);
  });

  it('every closed unit exists and has an index', () => {
    const files = new Set(tree.map((file) => file.path));
    const units = new Set(production.flatMap((file) => unitOf(file.path, topFolders) ?? []));
    const closed = [...units].filter((unit) => isListed(unit, CLOSED_UNITS)).sort();
    for (const unit of closed) expect(files.has(`${unit}/index.ts`), unit).toBe(true);
    for (const named of CLOSED_UNITS.filter((unit) => !unit.endsWith('/'))) expect(closed, named).toContain(named);
    expect(closed.filter((unit) => unit.startsWith('src/plugins/')).length).toBeGreaterThanOrEqual(10);
  });
});

describe('CPB1-12: no production source imports test code', () => {
  it('nothing from a __tests__ folder, from test/ (test/support and the database helper included) or from a test file', () => {
    expect(testCodeImports(imports)).toEqual([]);
  });
});

describe('CPB1-12: the neutral test support stands on its own', () => {
  const support = codeOnly(tree.filter((file) => file.path.startsWith('test/support/') && file.path.endsWith('.ts')));
  const edges = relativeImports(support);

  /** The cycles among the files of a set of imports, each as `a -> b -> a`. */
  function cyclesOf(found: readonly { readonly file: string; readonly target: string }[]): string[] {
    const next = new Map<string, string[]>();
    for (const edge of found) next.set(edge.file, [...(next.get(edge.file) ?? []), `${edge.target}.ts`]);
    const cycles: string[] = [];
    const walk = (file: string, path: readonly string[]): void => {
      if (path.includes(file)) {
        cycles.push([...path.slice(path.indexOf(file)), file].join(' -> '));
        return;
      }
      for (const target of next.get(file) ?? []) walk(target, [...path, file]);
    };
    for (const file of next.keys()) walk(file, []);
    return [...new Set(cycles)];
  }

  it('finds a cycle when there is one (positive control)', () => {
    const planted = [
      { file: 'test/support/guard.ts', target: 'test/support/identity' },
      { file: 'test/support/identity.ts', target: 'test/support/guard' },
      { file: 'test/support/pairing.ts', target: 'test/support/identity' },
    ];
    expect(cyclesOf(planted)).toContain('test/support/guard.ts -> test/support/identity.ts -> test/support/guard.ts');
    expect(cyclesOf(planted.slice(0, 1))).toEqual([]);
  });

  it('the folder holds the shared helpers, and no file of it imports a __tests__ folder of a row', () => {
    expect(support.map((file) => file.path)).toEqual(expect.arrayContaining(['test/support/config.ts', 'test/support/identity.ts', 'test/support/guard.ts', 'test/support/scratch-routes.ts']));
    expect(edges.length).toBeGreaterThan(20);
    expect(edges.filter((edge) => /(?:^|\/)__tests__(?:\/|$)/.test(edge.target)).map((edge) => `${edge.file}:${edge.line} ${edge.specifier}`)).toEqual([]);
  });

  it('its files import each other without a cycle: the guard support imports the identity support, never the other way round', () => {
    expect(cyclesOf(edges)).toEqual([]);
    const within = edges.filter((edge) => edge.target.startsWith('test/support/')).map((edge) => `${edge.file} -> ${edge.target}.ts`);
    expect(within).toContain('test/support/guard.ts -> test/support/identity.ts');
    expect(within).toContain('test/support/identity.ts -> test/support/scratch-routes.ts');
    expect(within).not.toContain('test/support/identity.ts -> test/support/guard.ts');
  });
});

describe('CPB1-16, CPB1-11, CPB1-10: a closed unit is imported through its index', () => {
  it('no production source of another unit names a file inside the core, the engine, the realtime channel, a plugin, a module, the mapping, the store, the schema, the seed, the reset routine or the fixture', () => {
    expect(deepImports(imports, CLOSED_UNITS, topFolders, EXPOSED)).toEqual([]);
  });

  it('what is offered beside an index is used: each exposed path exists and is imported from another unit', () => {
    const files = new Set(tree.map((file) => file.path));
    for (const path of EXPOSED) {
      expect(files.has(`${path}.ts`) || files.has(`${path}/index.ts`), path).toBe(true);
      const users = imports.filter((entry) => (entry.target === path || entry.target === `${path}/index`) && unitOf(entry.file.replace(/\.ts$/, ''), topFolders) !== unitOf(path, topFolders));
      expect(users.length, path).toBeGreaterThan(0);
    }
    // Without the list the same imports are deep imports: the list is what allows them, and nothing else.
    const refused = deepImports(imports, CLOSED_UNITS, topFolders);
    expect(refused.length).toBeGreaterThan(0);
    expect(refused.every((place) => EXPOSED.some((path) => place.includes(`reaches into ${unitOf(path, topFolders) ?? ''}:`)))).toBe(true);
  });

  it('the one unit that is not closed is the command folder, which has no index', () => {
    const files = new Set(tree.map((file) => file.path));
    const units = [...new Set(production.flatMap((file) => unitOf(file.path, topFolders) ?? []))].sort();
    const open = units.filter((unit) => !isListed(unit, CLOSED_UNITS));
    // `src/db/migrations` holds SQL and its journal: no TypeScript source, so it is no unit of this list.
    expect(open).toEqual(['src/db/commands']);
    expect(files.has('src/db/commands/index.ts')).toBe(false);
  });
});

describe('CPB1-10: the units import each other in one direction', () => {
  const planted = (lines: Readonly<Record<string, string>>): ReturnType<typeof unitEdges> =>
    unitEdges(valueImports(Object.entries(lines).map(([path, text]) => ({ path, text }))), new Set(['core', 'engine', 'realtime', 'plugins', 'modules', 'db']));

  it('reads value imports and leaves out imports of types only (positive control)', () => {
    const found = planted({
      'src/plugins/authenticate/index.ts': [
        "import type { OpenSession } from '../../modules/identity';",
        "import { type ResolvedDevice, type DeviceResolver } from '../../modules/pairing';",
        "export type { Principal } from '../../modules/identity';",
        "import { ApiFailure } from '../error-envelope';",
        "import { routeOf, type LogStream } from '../logger';",
        "export * from './console';",
        "import '../readiness';",
        "const lazy = await import('../../modules/rbac');",
      ].join('\n'),
    });
    expect(found.map((edge) => `${edge.from} -> ${edge.to} (${edge.where.join(', ')})`)).toEqual([
      'src/plugins/authenticate -> src/modules/rbac (src/plugins/authenticate/index.ts:8)',
      'src/plugins/authenticate -> src/plugins/error-envelope (src/plugins/authenticate/index.ts:4)',
      'src/plugins/authenticate -> src/plugins/logger (src/plugins/authenticate/index.ts:5)',
      'src/plugins/authenticate -> src/plugins/readiness (src/plugins/authenticate/index.ts:7)',
    ]);
  });

  it('finds the cycle the server had: stage 4 and the identity module, the access rule, the pairing module (positive control)', () => {
    const before = planted({
      'src/plugins/authenticate/index.ts': "import { SESSION_TOUCH_MIN_INTERVAL_MS } from '../../modules/identity/limits';",
      'src/plugins/permission-guard/index.ts': "import { consoleIdentityOf } from '../../modules/identity';\nimport { notSignedIn } from '../authenticate';",
      'src/modules/identity/routes.ts': "import { operatorSessionOf } from '../../plugins/authenticate';\nimport { routeOfOperation } from '../../plugins/permission-guard';",
      'src/modules/identity/biometric/sign-in.ts': "import { readDeviceState } from '../../pairing';",
      'src/modules/pairing/devices.ts': "import { revokeBiometricTokens } from '../identity/biometric';",
      'src/modules/admin/changes.ts': "import { revokeBiometricTokens } from '../identity/biometric';",
    });
    expect(unitCycles(before)).toEqual([['src/modules/identity', 'src/modules/pairing', 'src/plugins/authenticate', 'src/plugins/permission-guard']]);
    // With the three edges of fix round B2b gone, the same graph has none.
    const after = before.filter((edge) => !(edge.from.startsWith('src/plugins/') && edge.to.startsWith('src/modules/')) && !(edge.from === 'src/modules/identity' && edge.to === 'src/modules/pairing'));
    expect(unitCycles(after)).toEqual([]);
  });

  it('rule 4: no cycle between the units of the server', () => {
    expect(edges.length).toBeGreaterThan(60);
    expect(unitCycles(edges).map((group) => group.join(', '))).toEqual([]);
  });

  it('rule 5: the core, the engine, the realtime channel and every plugin import no value of a module', () => {
    const upwards = edges.filter((edge) => isListed(edge.from, BELOW_THE_MODULES) && edge.to.startsWith('src/modules/'));
    expect(upwards.map((edge) => `${edge.from} -> ${edge.to} (${edge.where.join(', ')})`)).toEqual([]);
  });

  it('rule 5: a module imports the value of another module only where a decision says so', () => {
    const between = edges.filter((edge) => edge.from.startsWith('src/modules/') && edge.to.startsWith('src/modules/'));
    expect(between.map((edge) => `${edge.from} -> ${edge.to}`)).toEqual(MODULE_TO_MODULE);
  });
});
