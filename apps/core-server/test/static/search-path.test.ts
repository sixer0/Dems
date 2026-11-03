// Static guard: no temporary object and no search-path change in the server (checkpoint CP-B1,
// finding CPB1-3; finding F53, decision D87).
//
// The query builder names every table without its schema. PostgreSQL finds such a name through
// the search path, and it looks into the session's temporary schema FIRST unless the path names
// that schema itself. So a temporary table called like a real one, left on a pooled connection,
// would stand in for the real table. Two things keep that from happening at run time: the pool
// pins the path with the temporary schema last (`plugins/db`), and every unit of work pins it
// again for its transaction (`core/unit-of-work.ts`). This test keeps the third: no production
// source creates a temporary object or touches the path, so that nothing has to be defended
// against in the first place.
//
// In production sources under `src/` these texts appear nowhere but in the listed files, in
// code or in a string (comments are left out for TypeScript; an SQL file is read as it is):
//
//   TEMP, TEMPORARY     as a word, in any case: `CREATE TEMP TABLE`, `SELECT ... INTO TEMPORARY`
//   pg_temp             the temporary schema by its name
//   search_path         the setting
//   set_config(         the function that changes a setting
//
// Every forbidden text is built from fragments, so that this file does not contain it.
import { describe, expect, it } from 'vitest';
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, scanCoverage, type SourceFile } from './scan';

const TEMP_WORD = new RegExp(`\\b${'TEM'}${'P'}(?:${'ORARY'})?\\b`, 'gi');
const TEMP_SCHEMA = new RegExp(`\\b${'pg'}_${'temp'}(?:_\\d+)?\\b`, 'gi');
const PATH_SETTING = new RegExp(`\\b${'search'}_${'path'}\\b`, 'gi');
const SETTING_FUNCTION = new RegExp(`\\b${'set'}_${'config'}\\s*\\(`, 'gi');
const PATTERNS: ReadonlyArray<readonly [name: string, pattern: RegExp]> = [
  ['temporary object', TEMP_WORD],
  ['temporary schema', TEMP_SCHEMA],
  ['path setting', PATH_SETTING],
  ['setting function', SETTING_FUNCTION],
];

/**
 * The only production sources that may hold one of the texts, each with what it does with it.
 * The list is exact: a file that is not here fails the test, and so does a file that is here and
 * holds none of the texts any more.
 *
 * Not in the list, and not found: `src/core/unit-statement.ts`, the guard that REFUSES these
 * words in a statement of a unit of work. It holds them only inside regular expressions, where
 * each is written behind an anchor (`\b`), so none of them stands there as a word.
 */
const ALLOWED: Readonly<Record<string, string>> = {
  'src/plugins/db/index.ts': 'pins the path on every connection of the runtime pool (a start-up option) and reads it back in boot step B-1',
  'src/core/unit-of-work.ts': 'pins the path, with the statement limit, for the transaction of every unit of work',
  'src/db/migrations/0002_audit_guards.sql': 'the two SECURITY DEFINER functions of the audit chain pin their own path (migration, owner role)',
  // R2 (D44): the two privilege migrations of schema v2 follow the 0002 pattern exactly - each
  // SECURITY DEFINER reveal function pins its own search_path (dbc-3 §D, MG-5; rows 46 and 112).
  'src/db/migrations/0005_capture_privileges.sql': 'the capture credential reveal function pins its own path (migration, owner role)',
  'src/db/migrations/0007_stt_config_privileges.sql': 'the STT credential reveal function pins its own path (migration, owner role)',
  // Task 4 set 16 (design 07, decision C147), the same pattern: the SECURITY DEFINER destroy
  // function of a retired device's credential and the guard of a retired row pin their own path.
  // RB-9 as amended (decision D54; migrations 0036 and its 0038 correction), the same pattern: the
  // purge, the re-seal and the ticket-open functions pin their own search_path (and 0036 says so in
  // prose at line 46, which an SQL file carries as it is).
  'src/db/migrations/0036_operator_purge.sql': 'the operator purge, re-seal and ticket functions pin their own path (migration, owner role)',
  'src/db/migrations/0038_operator_purge_reseal_correction.sql': 'the corrected re-seal function pins its own path (migration, owner role)',
  'src/db/migrations/0033_capture_device_retirement_privileges.sql': 'the capture credential destroy function and the retired-row guard pin their own path (migration, owner role)',
};

// TypeScript without its comments; an SQL file as it is (its comments are not TypeScript's).
const all = readTree(WORKSPACE).filter((file) => isProductionSource(file.path));
const production: SourceFile[] = [...codeOnly(all.filter((file) => !file.path.endsWith('.sql'))), ...all.filter((file) => file.path.endsWith('.sql'))];

const places = (files: readonly SourceFile[]): string[] => [...new Set(PATTERNS.flatMap(([, pattern]) => occurrences(files, pattern)))].sort();
const filesOf = (found: readonly string[]): string[] => [...new Set(found.map((place) => place.replace(/:\d+$/, '')))].sort();

describe('the scan itself', () => {
  it('finds each forbidden text when it is present, in any case, in code and in strings (positive control)', () => {
    const planted: SourceFile[] = [
      { path: 'src/a.ts', text: `await pool.query('CREATE ${'TEM'}${'P'} TABLE audit_log (seq bigint)');\nawait pool.query(\`create ${'tem'}${'p'}${'orary'} table events (seq bigint)\`);` },
      { path: 'src/b.ts', text: `await unit.query('SELECT 1 AS seq INTO ${'pg'}_${'temp'}.audit_log');\nconst schema = '${'PG'}_${'TEMP'}_3';` },
      { path: 'src/c.ts', text: `await client.query("SET ${'search'}_${'path'} = x");\nawait client.query("SELECT ${'set'}_${'config'} ('${'search'}_${'path'}', $1, false)", [value]);` },
      { path: 'src/d.sql', text: `SELECT * INTO ${'TEM'}${'P'}${'ORARY'} t FROM u;` },
    ];
    expect(occurrences(planted, TEMP_WORD)).toEqual(['src/a.ts:1', 'src/a.ts:2', 'src/d.sql:1']);
    expect(occurrences(planted, TEMP_SCHEMA)).toEqual(['src/b.ts:1', 'src/b.ts:2']);
    expect(occurrences(planted, PATH_SETTING)).toEqual(['src/c.ts:1', 'src/c.ts:2']);
    expect(occurrences(planted, SETTING_FUNCTION)).toEqual(['src/c.ts:2']);
    expect(filesOf(places(planted))).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.sql']);
    // Not forbidden: a word that only contains one of them.
    const harmless: SourceFile[] = [{ path: 'x.ts', text: "const template = 'tpl_seed'; const attempts = 3; const temperature = 21; mkdtempSync(dir); const contemporary = true; reset_configuration();" }];
    expect(places(harmless)).toEqual([]);
  });

  it('reads the production sources of the server: TypeScript and SQL, the module folders included', () => {
    const paths = production.map((file) => file.path);
    for (const folder of ['src/core/', 'src/engine/', 'src/plugins/', 'src/modules/', 'src/db/commands/', 'src/db/reset/', 'src/db/seed/', 'src/db/migrations/']) {
      expect(paths.some((path) => path.startsWith(folder)), folder).toBe(true);
    }
    // Rule R1: no production TypeScript or SQL file of `src/` is missing from the scan.
    expect(scanCoverage(paths, [{ folder: 'src/', extensions: ['.ts', '.sql'] }])).toMatchObject({ missing: [], empty: false });
    expect(paths.filter((path) => path.endsWith('.sql')).length).toBeGreaterThanOrEqual(4);
    expect(paths.some((path) => path.includes('__tests__/') || path.endsWith('.test.ts'))).toBe(false);
  });
});

describe('finding F53: nothing but the places that pin the path names a temporary object or the path', () => {
  it('the list of places is exact', () => {
    expect(filesOf(places(production))).toEqual(Object.keys(ALLOWED).sort());
  });

  it('each listed place holds what the list says it does', () => {
    const text = (path: string): string => production.find((file) => file.path === path)?.text ?? '';
    const count = (path: string, pattern: RegExp): number => occurrences([{ path, text: text(path) }], pattern).length;

    // The pool: the value, the start-up option, the question of the boot check. No setting function, no temporary object.
    expect(count('src/plugins/db/index.ts', PATH_SETTING)).toBeGreaterThanOrEqual(2);
    expect(count('src/plugins/db/index.ts', SETTING_FUNCTION)).toBe(0);
    expect(count('src/plugins/db/index.ts', TEMP_WORD)).toBe(0);
    expect(text('src/plugins/db/index.ts')).toMatch(/options: RUNTIME_CONNECTION_OPTIONS/);

    // The unit: one statement that sets two settings for the transaction; nothing else.
    expect(count('src/core/unit-of-work.ts', SETTING_FUNCTION)).toBe(2);
    expect(count('src/core/unit-of-work.ts', PATH_SETTING)).toBe(1);
    expect(count('src/core/unit-of-work.ts', TEMP_WORD)).toBe(0);
    expect(count('src/core/unit-of-work.ts', TEMP_SCHEMA)).toBe(0);

    // The migration: exactly the two function-level settings, with the temporary schema last.
    const migration = text('src/db/migrations/0002_audit_guards.sql');
    // Not the global patterns: `test` on a global pattern remembers where it stopped.
    const named = new RegExp(`${PATH_SETTING.source}|${TEMP_SCHEMA.source}`, 'i');
    const settings = migration.split('\n').filter((line) => named.test(line));
    expect(settings).toEqual(Array.from({ length: 2 }, () => `SET ${'search'}_${'path'} = pg_catalog, public, ${'pg'}_${'temp'}`));
    expect(count('src/db/migrations/0002_audit_guards.sql', TEMP_WORD)).toBe(0);
    expect(count('src/db/migrations/0002_audit_guards.sql', SETTING_FUNCTION)).toBe(0);
  });
});
