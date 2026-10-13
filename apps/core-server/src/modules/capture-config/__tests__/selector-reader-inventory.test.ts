// The reader inventory of the capture selector, AS A TEST (task 4 blueprint row 149; AD-04 (4):
// "full reader inventory; nothing by position"; decisions C18, C21, C25; closes WP-13a).
//
// The selector row holds six columns and the server's row image six members. Since schema set A
// each of them may be NULL (an unassigned slot). `research/027_selector_assumptions.md` measured
// who names them (section 5.1: nine sites in seven files) and stated the file list this test pins
// (section 5.2). A reader is safe only if it was READ for a NULL: so the list of files that name a
// column or a member is CLOSED. A new entry is a decision - the file was read for an unassigned
// slot, its site has a carrying row and a test - never an edit to make this file green.
//
//   I-1  PRODUCTION SOURCES of the server and of packages/shared that name one: the ten files of
//        section 5.2, each with its site of section 5.1.
//   I-2  WHAT ELSE names one is a TEST OR FIXTURE file of the server (a proof, never a reader).
//   I-3  GENERATED AND HISTORICAL files: the migrations and snapshots from set 0004 on, by rule.
//   I-4  THE TWO CLIENT SOURCE TREES name none: 0 files. A client reads the slice, never the row.
//   I-5  THE OTHER WORKSPACES AND THE SCRIPTS name none: 0 files (row 27 section 1).
//
// Each list has a control on a planted reader that must be found.
import { describe, expect, it } from 'vitest';
import { REPOSITORY, isProductionSource, isTestFile, readTree, stripComments, type SourceFile } from '../../../../test/static/scan';

/** The six columns of `capture_config`, built from parts so that this file is not itself an occurrence. */
const COLUMNS = ['video_01_device', 'video_01', 'video_02_device', 'video_02', 'mic_primary', 'mic_standby'].map((stem, index) =>
  [stem, index === 1 || index === 3 ? 'profile' : 'id'].join('_'),
);
/** The six members of the row image (`db/mapping/rows.ts`), built the same way. */
const MEMBERS = ['video01Device', 'video01', 'video02Device', 'video02', 'micPrimary', 'micStandby'].map((stem, index) =>
  [stem, index === 1 || index === 3 ? 'Profile' : 'Id'].join(''),
);
const NAMES = [...COLUMNS, ...MEMBERS];
const NAMED = new RegExp(`(?<![A-Za-z0-9_])(?:${NAMES.join('|')})(?![A-Za-z0-9_])`);

const CS = 'apps/core-server/';
const SH = 'packages/shared/';

/**
 * I-1. The production sources that name a column or a member, with the site of row 27 section 5.1
 * and what the site is. TEN files; `routes.ts` and `initial-state.ts` name one in a comment only.
 */
const SELECTOR_ROW_READERS: Readonly<Record<string, string>> = {
  [`${CS}src/capture/fence/fake-profile.ts`]: 'A8: raw SQL, a NULL slot matches no row (SAFE; decision C21 (9))',
  [`${CS}src/capture/fence/statements.ts`]: 'A7: READ_ASSIGNED_SOURCES, a JOIN on the device id (SAFE)',
  [`${CS}src/db/mapping/changes.ts`]: 'A6: the column list of the write-through (SAFE)',
  [`${CS}src/db/mapping/rows.ts`]: 'A3, A4, A5: captureConfigToRow, captureConfigFromRow, selectorDeviceIds (row 166)',
  [`${CS}src/db/schema/capture.ts`]: 'the definition of the six columns (schema set A, row 17)',
  [`${CS}src/modules/capture-config/routes.ts`]: 'a comment',
  [`${CS}src/modules/capture-config/slices.ts`]: 'A2: the record type and captureConfigSliceOf (row 29)',
  [`${CS}src/modules/capture-config/store.ts`]: 'A1: the statement and recordOf (row 29)',
  [`${SH}src/domain/entities.ts`]: 'A9: interface CaptureConfig (row 28)',
  [`${SH}src/sim/initial-state.ts`]: 'a comment',
};

/**
 * I-2. Test and fixture files that name one at this row: the fourteen of row 27 section 5.2 and
 * three added since (rows 17, 24, 70). A test is no reader - it sets a slot to NULL to PROVE a
 * reader - so later rows add test files freely (row 30 did while this row ran). What is held is
 * their KIND (a test or fixture file of the server; the shared package and its tests name none)
 * and that none of the seventeen stopped pinning the row's form.
 */
const SELECTOR_ROW_TEST_FILES: readonly string[] = [
  `${CS}src/capture/fence/__tests__/development-session.db.test.ts`,
  `${CS}src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts`,
  `${CS}src/capture/fence/__tests__/fence.db.test.ts`,
  `${CS}src/capture/fence/__tests__/fence.test.ts`,
  `${CS}src/db/mapping/__tests__/from-rows.test.ts`,
  `${CS}src/db/reset/__tests__/m2-guard-keepset.db.test.ts`,
  `${CS}src/modules/capture-config/__tests__/capture-config.db.test.ts`,
  `${CS}src/modules/capture-config/__tests__/slices.test.ts`,
  `${CS}src/modules/capture-inputs/audio-cards/__tests__/routes.db.test.ts`,
  `${CS}src/modules/devices/__tests__/source-class.db.test.ts`,
  `${CS}test/db/constraints.db.test.ts`,
  `${CS}test/db/contract-inventory.json`,
  `${CS}test/db/contract-v2-delta.ts`,
  `${CS}test/db/contract-v7-delta.ts`,
  `${CS}test/db/fixtures.ts`,
  `${CS}test/db/privileges.db.test.ts`,
  `${CS}test/db/set8.db.test.ts`,
];

/** I-3. Generated or historical: a migration file or a snapshot of the server's migration set, from the set that created the table on. */
const MIGRATIONS = `${CS}src/db/migrations/`;
const FIRST_SELECTOR_SET = 4;
function isGeneratedSelectorFile(path: string): boolean {
  if (!path.startsWith(MIGRATIONS)) return false;
  const set = /^(?:meta\/)?(\d{4})_[a-z0-9_]+\.(?:sql|json)$/.exec(path.slice(MIGRATIONS.length));
  return set !== null && Number(set[1]) >= FIRST_SELECTOR_SET;
}

/** The trees that are held to 0 (I-4, I-5). */
const CLIENT_TREES = ['apps/core-web/', 'apps/mobile/'] as const;
const OTHER_TREES = ['apps/capture-worker/', 'apps/mock-core/', 'apps/transcriber/', 'packages/capture-protocol/', 'scripts/'] as const;
/** Never a source of this repository's product: the reference application (driver rule 2: it is not opened). */
const NOT_READ = ['apps/input-av/'] as const;

const read = (tree: string): SourceFile[] => readTree(`${REPOSITORY}/${tree}`).map((file) => ({ path: `${tree}${file.path}`, text: file.text }));
const server = read(CS);
const shared = read(SH);
const clients = CLIENT_TREES.flatMap(read);
const others = OTHER_TREES.flatMap(read);

const naming = (files: readonly SourceFile[]): string[] => files.filter((file) => NAMED.test(file.text)).map((file) => file.path).sort();
/** A production source: `src/**` of its workspace without test files; never a generated file. */
const isProduction = (path: string): boolean => {
  const tree = [CS, SH].find((root) => path.startsWith(root));
  return tree !== undefined && isProductionSource(path.slice(tree.length)) && !isGeneratedSelectorFile(path);
};

const named = naming([...server, ...shared]);
const production = named.filter(isProduction);
const generated = named.filter(isGeneratedSelectorFile);
const testFiles = named.filter((path) => !isProduction(path) && !isGeneratedSelectorFile(path));

/** What the gate says about a list: the files outside it, and its entries that name nothing any more. */
function against(found: readonly string[], list: readonly string[]): { readonly outside: string[]; readonly stale: string[] } {
  return { outside: found.filter((path) => !list.includes(path)), stale: list.filter((path) => !found.includes(path)) };
}

describe('the scan itself', () => {
  it('reads the four workspaces and the other trees: hundreds of files each, the selector module and both client selector screens among them', () => {
    expect(server.length).toBeGreaterThan(500);
    expect(shared.length).toBeGreaterThan(200);
    for (const tree of CLIENT_TREES) expect(clients.filter((file) => file.path.startsWith(tree)).length, tree).toBeGreaterThan(200);
    for (const tree of OTHER_TREES) expect(others.filter((file) => file.path.startsWith(tree)).length, tree).toBeGreaterThan(0);
    const all = new Set([...server, ...shared, ...clients].map((file) => file.path));
    for (const path of [
      `${CS}src/modules/capture-config/store.ts`,
      `${CS}src/db/migrations/0004_capture.sql`,
      `${SH}src/domain/entities.ts`,
      'apps/core-web/src/features/devices/capture-selector.ts',
      'apps/mobile/src/features/capture-selector/capture-selector-model.ts',
    ]) {
      expect(all.has(path), path).toBe(true);
    }
    expect(NOT_READ.every((tree) => ![...server, ...shared, ...clients, ...others].some((file) => file.path.startsWith(tree)))).toBe(true);
  });

  it('the pattern is the twelve names of row 27 section 1: six columns, six members, as whole identifiers', () => {
    expect(NAMES).toHaveLength(12);
    expect(new Set(NAMES).size).toBe(12);
    expect(COLUMNS.every((name) => /^(?:video_0[12]_(?:device_id|profile)|mic_(?:primary|standby)_id)$/.test(name))).toBe(true);
    expect(MEMBERS.every((name) => /^(?:video0[12](?:DeviceId|Profile)|mic(?:Primary|Standby)Id)$/.test(name))).toBe(true);
    for (const name of NAMES) {
      expect(NAMED.test(`row.${name} ?? null`), name).toBe(true);
      expect(NAMED.test(`row.${name}Old`), name).toBe(false);
      expect(NAMED.test(`row.old_${name}`), name).toBe(false);
    }
  });
});

describe('I-1: the production sources that name a selector column or member are the ten of row 27 section 5.2', () => {
  const LIST = Object.keys(SELECTOR_ROW_READERS).sort();

  it('the search equals the stated list: no file outside it, no entry that names nothing', () => {
    expect(LIST).toHaveLength(10);
    expect(LIST.filter((path) => path.startsWith(CS))).toHaveLength(8);
    expect(LIST.filter((path) => path.startsWith(SH))).toHaveLength(2);
    expect(against(production, LIST)).toEqual({ outside: [], stale: [] });
    expect(production).toEqual(LIST);
  });

  it('the two entries marked "a comment" name one in a comment only; the eight others in code', () => {
    const text = new Map([...server, ...shared].map((file) => [file.path, file.text]));
    const inCode = LIST.filter((path) => NAMED.test(stripComments(text.get(path) ?? '')));
    const commentOnly = LIST.filter((path) => SELECTOR_ROW_READERS[path] === 'a comment');
    expect(commentOnly).toEqual([`${CS}src/modules/capture-config/routes.ts`, `${SH}src/sim/initial-state.ts`]);
    expect(inCode).toEqual(LIST.filter((path) => !commentOnly.includes(path)));
  });

  it('CONTROL: a reader planted in a file outside the list is named, in the server and in the shared package', () => {
    const planted: SourceFile[] = [
      { path: `${CS}src/modules/sessions/planted-reader.ts`, text: `export const primary = (row: Row) => row.${MEMBERS[4]};` },
      { path: `${SH}src/sim/planted-reader.ts`, text: `const sql = 'SELECT ${COLUMNS[0]} FROM capture_config';` },
      { path: `${CS}src/modules/sessions/not-a-reader.ts`, text: 'export const primary = (line: Line) => line.deviceId;' },
    ];
    const found = naming([...server, ...shared, ...planted]).filter(isProduction);
    expect(against(found, LIST)).toEqual({ outside: [planted[0]!.path, planted[1]!.path].sort(), stale: [] });
    // And an entry whose file stopped naming one is reported as stale: the list cannot rot.
    expect(against(production.filter((path) => path !== LIST[0]), LIST).stale).toEqual([LIST[0]]);
  });
});

describe('I-2: what else names one is a test or a fixture of the server, never a source', () => {
  /** A test or fixture file of the server: `*.test.ts`, a `__tests__` folder, or its `test/` folder. */
  const isServerTestFile = (path: string): boolean => path.startsWith(CS) && isTestFile(path.slice(CS.length));

  it('the seventeen files of this row all still name one; every other file that does is a test or fixture of the server', () => {
    expect(SELECTOR_ROW_TEST_FILES).toHaveLength(17);
    expect(against(testFiles, SELECTOR_ROW_TEST_FILES).stale).toEqual([]);
    expect(testFiles.filter((path) => !isServerTestFile(path))).toEqual([]);
    // The shared package: its two sources of I-1 and nothing else, no test of it.
    expect(named.filter((path) => path.startsWith(SH))).toEqual([`${SH}src/domain/entities.ts`, `${SH}src/sim/initial-state.ts`]);
  });

  it('CONTROL: a planted file that is neither a source of I-1, a migration nor a test is named', () => {
    const planted: SourceFile[] = [
      { path: `${CS}scripts/planted.ts`, text: `console.log(row.${COLUMNS[5]});` },
      { path: `${SH}test/planted.test.ts`, text: `expect(row.${MEMBERS[0]}).toBeNull();` },
      { path: `${CS}src/modules/sessions/__tests__/a-new-proof.db.test.ts`, text: `await sql('UPDATE capture_config SET ${COLUMNS[4]} = NULL');` },
    ];
    const found = naming([...server, ...shared, ...planted]).filter((path) => !isProduction(path) && !isGeneratedSelectorFile(path));
    expect(found.filter((path) => !isServerTestFile(path))).toEqual([planted[0]!.path, planted[1]!.path]);
  });
});

describe('I-3: generated and historical files', () => {
  it('every one is a migration or a snapshot of the server from set 0004 on; the set that created the table is among them', () => {
    expect(generated.length).toBeGreaterThanOrEqual(16);
    expect(generated).toContain(`${MIGRATIONS}0004_capture.sql`);
    expect(generated.every((path) => /\/(?:\d{4}_[a-z0-9_]+\.sql|meta\/\d{4}_snapshot\.json)$/.test(path))).toBe(true);
  });

  it('CONTROL: a file beside the migrations that is no migration, and a set before the table existed, are not taken as generated', () => {
    expect(isGeneratedSelectorFile(`${MIGRATIONS}0004_capture.sql`)).toBe(true);
    expect(isGeneratedSelectorFile(`${MIGRATIONS}meta/0016_snapshot.json`)).toBe(true);
    expect(isGeneratedSelectorFile(`${MIGRATIONS}0003_before.sql`)).toBe(false);
    expect(isGeneratedSelectorFile(`${MIGRATIONS}helper.ts`)).toBe(false);
    expect(isGeneratedSelectorFile(`${CS}src/db/schema/0004_capture.sql`)).toBe(false);
  });
});

describe('I-4 and I-5: the client source trees and the other workspaces name none', () => {
  it('apps/core-web and apps/mobile: 0 files, sources and tests', () => {
    expect(naming(clients)).toEqual([]);
  });

  it('the capture worker, the mock Core, the transcriber, the capture protocol and the scripts: 0 files', () => {
    expect(naming(others)).toEqual([]);
  });

  it('CONTROL: a reader planted in a client tree is named', () => {
    const planted: SourceFile = { path: 'apps/mobile/src/features/capture-selector/planted.ts', text: `const standby = config.${MEMBERS[5]};` };
    expect(naming([...clients, planted])).toEqual([planted.path]);
  });
});
