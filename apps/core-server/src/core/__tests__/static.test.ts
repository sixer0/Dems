// Static guards of the core services (plan row W21). They read the sources as text, with the
// scaffold's scanner, and keep three rules of this row true for every later row:
//
//   1. One clock. Under `src/core/` only `clock.ts` reads the system time (ENG-13). A duration
//      measured with `performance.now()` is not a time and is allowed.
//   2. One insert path. In the server runtime (`src/` without `src/db/`, which holds the
//      command-line programs of the owner role: seed, reset, migrate) only `audit-writer.ts`
//      inserts into `audit_log` and only `event-writer.ts` inserts into `events` (spec §8.3;
//      database contract §6.4). The unit of work refuses such a statement at run time as well.
//   3. One hash, one mapping. The core services compute no digest of their own: the chain hash
//      is the shared function, imported (SR-53, ENG-9). And they map no row themselves: the
//      stored form of an audit row and of an event, and the digest check of stored rows, are
//      the mapping module's, imported (database contract MR-1).
//
// Every forbidden text is built from fragments, so that this file does not contain it.
import { describe, expect, it } from 'vitest';
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, type SourceFile } from '../../../test/static/scan';

const production = codeOnly(readTree(WORKSPACE).filter((file) => isProductionSource(file.path)));
const core = production.filter((file) => file.path.startsWith('src/core/'));
const runtime = production.filter((file) => !file.path.startsWith('src/db/'));

const SYSTEM_TIME = new RegExp(
  [`\\bDate\\s*\\.\\s*${'now'}\\s*\\(`, `\\bnew\\s+Date\\s*\\(\\s*\\)`, `\\bperformance\\s*\\.\\s*time${'Origin'}\\b`].join('|'),
  'g',
);

const table = (name: string): RegExp[] => [
  new RegExp(`\\b(?:insert|merge)\\s+into\\s+(?:only\\s+)?(?:"?public"?\\s*\\.\\s*)?"?${name}"?(?![A-Za-z0-9_])`, 'gi'),
];
const AUDIT_TABLE = [...table(['audit', 'log'].join('_')), new RegExp(`\\.\\s*insert\\s*\\(\\s*(?:schema\\s*\\.\\s*)?${'audit'}Log\\s*\\)`, 'g')];
const EVENT_TABLE = [...table('events'), new RegExp(`\\.\\s*insert\\s*\\(\\s*(?:schema\\s*\\.\\s*)?${'events'}\\s*\\)`, 'g')];

const OWN_DIGEST = new RegExp([`\\bcreate${'Hash'}\\b`, `['"]node:${'crypto'}['"]`, `@noble/${'hashes'}`, `\\bsubtle\\s*\\.\\s*digest\\b`].join('|'), 'g');

const found = (files: readonly SourceFile[], patterns: readonly RegExp[]): string[] =>
  patterns.flatMap((pattern) => occurrences(files, pattern)).map((place) => place.replace(/:\d+$/, ''));

describe('the scan itself', () => {
  it('reads the production sources of the core folder', () => {
    expect(core.map((file) => file.path).sort()).toEqual([
      'src/core/audit-details.ts',
      'src/core/audit-writer.ts',
      'src/core/boot-checks.ts',
      'src/core/clock.ts',
      'src/core/errors.ts',
      'src/core/event-writer.ts',
      'src/core/index.ts',
      'src/core/limits.ts',
      'src/core/payload-rules.ts',
      'src/core/pipeline.ts',
      'src/core/types.ts',
      'src/core/unit-of-work.ts',
      'src/core/unit-statement.ts',
      'src/core/windows.ts',
    ]);
  });

  it('finds each forbidden text when it is present (positive control)', () => {
    const planted: SourceFile[] = [
      { path: 'src/a.ts', text: `const t = Date.${'now'}();\nconst d = new Date( );\nconst o = performance.time${'Origin'};` },
      { path: 'src/b.ts', text: `await pool.query('INSERT INTO public.${['audit', 'log'].join('_')} (seq) VALUES ($1)');\nawait db.insert(${'audit'}Log).values(row);` },
      { path: 'src/c.ts', text: `insert into "${'events'}" ("seq") values ($1)\nawait tx.insert(schema.${'events'}).values(rows);` },
      { path: 'src/d.ts', text: `import { create${'Hash'} } from 'node:${'crypto'}';` },
    ];
    expect(occurrences(planted, SYSTEM_TIME)).toEqual(['src/a.ts:1', 'src/a.ts:2', 'src/a.ts:3']);
    expect(found(planted, AUDIT_TABLE)).toEqual(['src/b.ts', 'src/b.ts']);
    expect(found(planted, EVENT_TABLE)).toEqual(['src/c.ts', 'src/c.ts']);
    expect(occurrences(planted, OWN_DIGEST)).toEqual(['src/d.ts:1', 'src/d.ts:1']);
    // Not forbidden: a duration, a date built from a value, a read of the tables.
    const allowed: SourceFile[] = [
      { path: 'x.ts', text: `performance.now(); new Date(at).toISOString(); select * from ${['audit', 'log'].join('_')}; db.select().from(${'events'});` },
    ];
    expect(occurrences(allowed, SYSTEM_TIME)).toEqual([]);
    expect(found(allowed, [...AUDIT_TABLE, ...EVENT_TABLE])).toEqual([]);
  });
});

describe('one clock (ENG-13)', () => {
  it('under src/core only clock.ts reads the system time', () => {
    const places = [...new Set(occurrences(core, SYSTEM_TIME).map((place) => place.replace(/:\d+$/, '')))];
    expect(places).toEqual(['src/core/clock.ts']);
  });
});

describe('one insert path (database contract §6.4; spec §8.3)', () => {
  it('in the server runtime only the audit writer inserts into the audit table', () => {
    expect([...new Set(found(runtime, AUDIT_TABLE))]).toEqual(['src/core/audit-writer.ts']);
  });

  it('in the server runtime only the event writer inserts into the events table', () => {
    expect([...new Set(found(runtime, EVENT_TABLE))]).toEqual(['src/core/event-writer.ts']);
  });
});

describe('one hash (SR-53, ENG-9)', () => {
  it('the core services compute no digest of their own', () => {
    expect(occurrences(core, OWN_DIGEST)).toEqual([]);
  });

  it('the audit writer builds its rows with the shared functions', () => {
    const writer = core.find((file) => file.path === 'src/core/audit-writer.ts')?.text ?? '';
    const imported = /import\s*\{([^}]*)\}\s*from\s*'@dems\/shared\/sim';/.exec(writer)?.[1] ?? '';
    for (const name of ['appendAudit', 'auditBody', 'auditId', 'chainHash', 'AUDIT_TYPE_CATEGORY']) {
      expect(imported, name).toMatch(new RegExp(`\\b${name}\\b`));
    }
    const events = core.find((file) => file.path === 'src/core/event-writer.ts')?.text ?? '';
    const importedForEvents = /import\s*\{([^}]*)\}\s*from\s*'@dems\/shared\/sim';/.exec(events)?.[1] ?? '';
    for (const name of ['appendEvent', 'eventId']) {
      expect(importedForEvents, name).toMatch(new RegExp(`\\b${name}\\b`));
    }
  });
});

describe('one mapping (database contract MR-1)', () => {
  const fromMapping = (path: string): string =>
    /import\s*\{([^}]*)\}\s*from\s*'\.\.\/db\/mapping';/.exec(core.find((file) => file.path === path)?.text ?? '')?.[1] ?? '';

  it('the writers and the boot checks take the row builders and the digest check from the mapping module', () => {
    expect(fromMapping('src/core/audit-writer.ts')).toMatch(/\bauditRowToRow\b/);
    expect(fromMapping('src/core/event-writer.ts')).toMatch(/\beventToRow\b/);
    expect(fromMapping('src/core/boot-checks.ts')).toMatch(/\bverifyStoredAuditRows\b/);
    expect(fromMapping('src/core/payload-rules.ts')).toMatch(/\bisStorableText\b/);
  });

  it('the core services name no column of the two tables and bind none: the typed table and the mapped row do', () => {
    const columns = new RegExp(['actor', 'id'].join('_') + '|' + ['prev', 'hash'].join('_') + '|' + ['evidence', 'id'].join('_') + '|' + ['session', 'id'].join('_'), 'g');
    expect(occurrences(core, columns)).toEqual([]);
    expect(occurrences(core, /\bverifyAuditChain\b|\beventCategory\b/g)).toEqual([]);
  });
});
