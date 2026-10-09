// Static guards of plan row W29, over the folder the row owns (`src/db/reset`). Database-free,
// so they run in every later row's gate.
//
// The routine can destroy data by design; what it must never say to the database is read here
// from its own source:
//   - it rewrites no append-only table: no UPDATE, DELETE or TRUNCATE names `audit_log` or
//     `audit_chain_history` (database contract §6.6, T-AO-4);
//   - a database is dropped in ONE place, by a statement builder that takes a staging or
//     previous name only, and never in the forced form;
//   - it ends, cancels and signals nobody's session;
//   - it names no superuser, no superuser file, and not the owner file either (it reads the
//     owner connection through the database commands' reader);
//   - it starts no child process and makes no console call;
//   - a `ResetError` carries no `cause` (a wrapped error could quote a carried row).
// Every forbidden text is built from fragments, so that this file does not contain it.
import { describe, expect, it } from 'vitest';
import { WORKSPACE, codeOnly, isTestFile, occurrences, readTree, type SourceFile } from '../../../../test/static/scan';

const FOLDER = 'src/db/reset/';
const all = readTree(WORKSPACE).filter((file) => file.path.startsWith(FOLDER));
/** The routine itself: the files of the folder that are not tests. Comments are left out. */
const production = codeOnly(all.filter((file) => !isTestFile(file.path)));

const words = (...parts: string[]): RegExp => new RegExp(`\\b${parts.join('\\s+')}\\b`, 'gi');
const APPEND_ONLY = '(?:audit_log|audit_chain_history)(?![a-z_])';
/** An UPDATE, a DELETE or a TRUNCATE whose target is one of the two append-only tables. */
const REWRITES = new RegExp(
  `\\b(?:${['UP', 'DATE'].join('')}\\s+(?:ONLY\\s+)?(?:public\\.)?${APPEND_ONLY}|${['DE', 'LETE'].join('')}\\s+FROM\\s+(?:ONLY\\s+)?(?:public\\.)?${APPEND_ONLY}|${['TRUN', 'CATE'].join('')}\\b[^;'"\`]*${APPEND_ONLY})`,
  'gi',
);
const DATABASE_DROPPED = words('DROP', 'DATABASE');
const FORCED = new RegExp(`WITH\\s*\\(\\s*${['FOR', 'CE'].join('')}`, 'gi');
const SESSION_ENDED = new RegExp(`pg_(?:${['terminate', 'cancel'].join('|')})_backend|${['pg', 'signal', 'backend'].join('_')}`, 'gi');
const SUPERUSER_ROLE = new RegExp(['dems', 'admin'].join('_'), 'g');
const SUPERUSER_FILE = new RegExp(['pg', 'pwfile'].join('\\.'), 'g');
const OWNER_FILE = new RegExp(['pg', 'owner', 'env'].join('\\.'), 'g');
const CHILD_PROCESS = new RegExp(`['"](?:node:)?${['child', 'process'].join('_')}['"]`, 'g');
const CONSOLE_CALL = new RegExp(`\\b${['con', 'sole'].join('')}\\s*\\.\\s*[a-z]+\\s*\\(`, 'g');
const UPDATED_TABLE = /\bUPDATE\s+public\.([a-z_]+|\$\{[^}]+\})/g;

describe('the scan itself', () => {
  it('reads the files of the routine and of its tests', () => {
    expect(production.map((file) => file.path)).toEqual([
      'src/db/reset/cli.ts',
      'src/db/reset/errors.ts',
      'src/db/reset/index.ts',
      'src/db/reset/kept-tables.ts',
      'src/db/reset/names.ts',
      'src/db/reset/plan.ts',
      'src/db/reset/real-evidence.ts',
      'src/db/reset/routine.ts',
    ]);
    expect(all.filter((file) => isTestFile(file.path)).length).toBeGreaterThan(5);
  });

  it('finds each forbidden text when it is present (positive control)', () => {
    const sql = (...parts: string[]): string => parts.join(' ');
    const planted: SourceFile[] = [
      { path: 'a.ts', text: `${sql('UPDATE', 'public.audit_log')} SET message = $1` },
      { path: 'b.ts', text: `${sql('delete', 'from', 'audit_chain_history')} WHERE reset_no = 1` },
      { path: 'c.ts', text: `${sql('TRUNCATE', 'public.events,', 'public.audit_log')}` },
      { path: 'd.ts', text: `${sql('DROP', 'DATABASE')} x ${sql('WITH', '(FORCE)')}` },
      { path: 'e.ts', text: `SELECT ${['pg', 'terminate', 'backend'].join('_')}(pid)` },
      { path: 'f.ts', text: `import { spawn } from 'node:${['child', 'process'].join('_')}';` },
    ];
    expect(occurrences(planted, REWRITES)).toEqual(['a.ts:1', 'b.ts:1', 'c.ts:1']);
    expect(occurrences(planted, DATABASE_DROPPED)).toEqual(['d.ts:1']);
    expect(occurrences(planted, FORCED)).toEqual(['d.ts:1']);
    expect(occurrences(planted, SESSION_ENDED)).toEqual(['e.ts:1']);
    expect(occurrences(planted, CHILD_PROCESS)).toEqual(['f.ts:1']);
    // Reading those tables, inserting into them, and updating the chain HEAD's neighbours are not rewrites.
    const allowed: SourceFile[] = [
      { path: 'g.ts', text: 'SELECT count(*) FROM public.audit_log; INSERT INTO public.audit_chain_history (reset_no) VALUES ($1)' },
      { path: 'h.ts', text: `${sql('UPDATE', 'public.pairing_codes')} SET state = 'CANCELLED'` },
    ];
    expect(occurrences(allowed, REWRITES)).toEqual([]);
  });
});

describe('§6.6: the routine rewrites no append-only table', () => {
  it('no UPDATE, DELETE or TRUNCATE names audit_log or audit_chain_history', () => {
    expect(occurrences(production, REWRITES)).toEqual([]);
  });

  it('the routine holds no DELETE and no TRUNCATE statement at all', () => {
    expect(occurrences(production, new RegExp(`\\b${['DE', 'LETE'].join('')}\\s+FROM\\b`, 'gi'))).toEqual([]);
    expect(occurrences(production, new RegExp(`\\b${['TRUN', 'CATE'].join('')}\\s+(?:TABLE\\s+)?(?:ONLY\\s+)?(?:public\\.|")`, 'gi'))).toEqual([]);
  });

  it('its UPDATE statements are in one file and name only the two seeded kept tables (by the builder), pairing_codes and operators', () => {
    const found = production.flatMap((file) => [...file.text.matchAll(UPDATED_TABLE)].map((match) => `${file.path}: ${match[1]}`));
    expect(found.sort()).toEqual([
      'src/db/reset/kept-tables.ts: ${table.name}',
      'src/db/reset/kept-tables.ts: operators',
      'src/db/reset/kept-tables.ts: pairing_codes',
    ]);
  });
});

describe('a database is dropped in one place, never by force, and no session is ended', () => {
  it('DROP DATABASE occurs once in the routine: in the statement builder of names.ts', () => {
    const found = occurrences(production, DATABASE_DROPPED);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/^src\/db\/reset\/names\.ts:\d+$/);
  });

  it('the forced form occurs nowhere in the routine', () => {
    expect(occurrences(production, FORCED)).toEqual([]);
  });

  it('nothing ends, cancels or signals a session', () => {
    expect(occurrences(production, SESSION_ENDED)).toEqual([]);
  });
});

describe('roles and credentials', () => {
  it('the routine names no superuser role and neither of the two credential files it does not parse', () => {
    expect(occurrences(production, SUPERUSER_ROLE)).toEqual([]);
    expect(occurrences(all, SUPERUSER_FILE)).toEqual([]);
    // The owner file is read through `readOwnerConnection` of the database commands: one parser.
    expect(occurrences(production, OWNER_FILE)).toEqual([]);
    expect(occurrences(production, /\breadFileSync\b|\bcreateReadStream\b|\breadFile\b/g)).toEqual([]);
  });

  it('the owner connection is read in one statement of routine.ts and held in a local variable only', () => {
    const routine = production.find((file) => file.path === 'src/db/reset/routine.ts')?.text ?? '';
    expect(routine.match(/readOwnerConnection\(/g)).toHaveLength(1);
    expect(routine).toContain('owner = readOwnerConnection(options.dataDir);');
    // It is dropped when the call ends, and never placed on the report, the options or the environment.
    expect(routine).toContain('owner = undefined;');
    expect(routine).not.toMatch(/process\s*\.\s*env\s*\[[^\]]*\]\s*=|process\s*\.\s*env\s*\.\s*[A-Z_]+\s*=/);
    expect(routine).not.toMatch(/\.reveal\(/);
  });

  it('starts no child process and makes no console call', () => {
    expect(occurrences(production, CHILD_PROCESS)).toEqual([]);
    expect(occurrences(production, CONSOLE_CALL)).toEqual([]);
  });
});

describe('errors', () => {
  it('a ResetError is never given a cause', () => {
    expect(occurrences(production, /\bcause\s*:/g)).toEqual([]);
    expect(occurrences(production, /new ResetError\(/g).length).toBeGreaterThan(20);
  });

  it('no message of the routine quotes the detail or the message of a database error', () => {
    expect(occurrences(production, /\.detail\b/g)).toEqual([]);
    // A message is passed on in four places, each for one of this project's own error classes,
    // whose messages are safe by their rows' design: the seed's, the store's, the mapping's, the
    // database commands' and the boot checks'. A driver or query-builder error never is.
    const routine = production.find((file) => file.path === 'src/db/reset/routine.ts')?.text ?? '';
    expect(routine.match(/\b(?:error|failure)\.message\b/g)).toHaveLength(4);
    expect(routine).toContain('error instanceof SeedError || error instanceof StoreError || error instanceof DbCommandError || error instanceof BootCheckError || error instanceof MappingError');
    expect(routine).toContain('if (error instanceof DbCommandError) throw new ResetError(\'RESET_OWNER_CREDENTIALS\', \'R-0\', error.message);');
    expect(routine).toContain('if (failure instanceof DbCommandError) throw new ResetError(\'RESET_DATABASE_UNREACHABLE\', \'R-0\', failure.message);');
    expect(routine).toContain('if (!(error instanceof BootCheckError)) throw error;');
  });
});
