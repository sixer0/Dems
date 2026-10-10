// Static guards of the engine host's folder (plan row W26). They run in the database-free
// project, so they are part of every later row's gate.
//
//   time and chance   every instant comes from the server clock and every random draw from the
//                     simulator's seeded streams: no file of this folder reads the system time
//                     or a random source (spec ENG-13, ENG-16);
//   timers            only `timer.ts` names a global timer; the host asks it for a repeating
//                     call and cancels it at stop;
//   the actor scope   the engine's `auth` slice is set in one place, and cleared in a `finally`
//                     (SR-79);
//   the two writers   the folder inserts into no table but the health snapshots: audit rows and
//                     events go through the core's writers, every other row through the store;
//   the simulator     is used through its public barrel only, and is never changed.
//
// Every forbidden text is built from fragments, so that this file does not contain it.
import { describe, expect, it } from 'vitest';
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, type SourceFile } from '../../../test/static/scan';

const all = readTree(WORKSPACE).filter((file) => file.path.startsWith('src/engine/'));
const production = codeOnly(all.filter((file) => isProductionSource(file.path)));
const text = (path: string): string => production.find((file) => file.path === path)?.text ?? '';

const SYSTEM_TIME = new RegExp(
  [`\\bDate\\s*\\.\\s*${'now'}\\b`, `\\bnew\\s+Date\\s*\\(`, `\\bperformance\\s*\\.\\s*(?:${'now'}|time${'Origin'})\\b`, `\\bprocess\\s*\\.\\s*hr${'time'}\\b`].join('|'),
  'g',
);
const RANDOM = new RegExp([`\\bMath\\s*\\.\\s*${'random'}\\b`, `\\brandom${'UUID'}\\b`, `\\bget${'RandomValues'}\\b`, `['"]node:${'crypto'}['"]`].join('|'), 'g');
const GLOBAL_TIMER = new RegExp(`\\b(?:set|clear)(?:${['Interval', 'Timeout', 'Immediate'].join('|')})\\s*\\(`, 'g');
const OUTSIDE_WORLD = new RegExp([`['"]node:(?:${['fs', 'net', 'http', 'https', 'child_process', 'worker_threads'].join('|')})(?:/[a-z]+)?['"]`, `\\bfetch\\s*\\(`, `\\bprocess\\s*\\.\\s*env\\b`].join('|'), 'g');
const SQL_WRITE = new RegExp(`\\b(?:${['insert\\s+into', 'delete\\s+from', 'update\\s+public', 'truncate'].join('|')})\\b`, 'gi');
const BUILDER_INSERT = /\.\s*insert\s*\(\s*([A-Za-z.]+)\s*\)/g;
const SIM_DEEP_IMPORT = /from\s+'(?:@dems\/shared\/(?:src\/)?sim\/[^']+|(?:\.\.\/)+(?:\.\.\/)*packages\/[^']+)'/g;
const AUTH_WRITE = /setState\s*\(\s*\{\s*auth\b/g;

const places = (files: readonly SourceFile[], pattern: RegExp): string[] => [...new Set(occurrences(files, pattern).map((place) => place.replace(/:\d+$/, '')))];

describe('the scan itself', () => {
  it('reads the production sources of the engine folder', () => {
    const paths = production.map((file) => file.path);
    for (const expected of ['index.ts', 'host.ts', 'types.ts', 'limits.ts', 'timer.ts', 'scheduler.ts', 'headless-sim.ts', 'actor-scope.ts', 'hosted-actions.ts', 'write-plan.ts', 'delta.ts', 'ring.ts', 'rehydrate.ts', 'errors.ts', 'api-headers.ts', 'internal-actions.ts']) {
      expect(paths, expected).toContain(`src/engine/${expected}`);
    }
    // 15 until task 3 row 132 added `internal-actions.ts` (the in-unit door of `registerCaptureDevice`).
    // +1 by task 3 row 71: `capture-session.ts` (the pure transitions of the capture of a real recording).
    // +1 by task 3 row 82: `seal-doors.ts` (the three INTERNAL sealing actions, beside the seam).
    // +1 by integration pass D6: `fact-doors.ts` (the measured evidence volume, the head of a transcript's revisions).
    // +1 by fix pass F-M8: `export-doors.ts` (the completion of a background export, the record of a download).
    // +1 by fix pass F-M7b: `unsealable-doors.ts` (the terminal outcome of a session that cannot be sealed).
    // +1 by fix pass F-M7c: `sealing-notice-doors.ts` (kept plaintext of a sealed session, a blocked seal, an on-demand retry).
    for (const door of ['export-doors.ts', 'unsealable-doors.ts', 'sealing-notice-doors.ts']) expect(paths, door).toContain(`src/engine/${door}`);
    expect(paths).toHaveLength(22);
    expect(paths.some((path) => path.includes('__tests__'))).toBe(false);
  });

  it('finds each forbidden text when it is present (positive control)', () => {
    const planted: SourceFile[] = [
      { path: 'a.ts', text: `const t = Date.${'now'}();\nconst d = new Date();\nconst p = performance.${'now'}();` },
      { path: 'b.ts', text: `Math.${'random'}();\nimport { x } from 'node:${'crypto'}';` },
      { path: 'c.ts', text: `set${'Interval'}(tick, 50);\nclear${'Timeout'}(handle);` },
      { path: 'd.ts', text: `import { readFileSync } from 'node:${'fs'}';\nawait fetch(url);` },
      { path: 'e.ts', text: `await unit.query('${'INSERT'} INTO public.audit_log ...');\nawait unit.db.insert(auditLog).values(row);` },
      { path: 'f.ts', text: `import { tickMachine } from '@dems/shared/sim/session-machine';` },
    ];
    expect(occurrences(planted, SYSTEM_TIME)).toEqual(['a.ts:1', 'a.ts:2', 'a.ts:3']);
    expect(occurrences(planted, RANDOM)).toEqual(['b.ts:1', 'b.ts:2']);
    expect(occurrences(planted, GLOBAL_TIMER)).toEqual(['c.ts:1', 'c.ts:2']);
    expect(occurrences(planted, OUTSIDE_WORLD)).toEqual(['d.ts:1', 'd.ts:2']);
    expect(occurrences(planted, SQL_WRITE)).toEqual(['e.ts:1']);
    expect([...(planted[4]?.text ?? '').matchAll(BUILDER_INSERT)].map((match) => match[1])).toEqual(['auditLog']);
    expect(occurrences(planted, SIM_DEEP_IMPORT)).toEqual(['f.ts:1']);
  });
});

describe('time and chance (ENG-13, ENG-16)', () => {
  it('no file of the folder reads the system time: every instant is the server clock\'s', () => {
    expect(occurrences(production, SYSTEM_TIME)).toEqual([]);
  });

  it('no file of the folder draws a random number or imports a source of one', () => {
    expect(occurrences(production, RANDOM)).toEqual([]);
  });

  it('only timer.ts names a global timer', () => {
    expect(places(production, GLOBAL_TIMER)).toEqual(['src/engine/timer.ts']);
  });

  it('the folder reads no file, opens no socket and reads no environment', () => {
    expect(occurrences(production, OUTSIDE_WORLD)).toEqual([]);
  });
});

describe('the actor scope (SR-79)', () => {
  it('the engine\'s auth slice is written in actor-scope.ts only', () => {
    expect(places(production, AUTH_WRITE)).toEqual(['src/engine/actor-scope.ts']);
  });

  it('the scope is set, the action is called, and the slice is cleared in a finally', () => {
    const scope = text('src/engine/actor-scope.ts').replace(/\s+/g, ' ');
    expect(scope).toMatch(/store\.setState\(\{ auth: actorAuth\(operatorId, at\) \}\); try \{ return action\(\); \} finally \{ store\.setState\(\{ auth: signedOutAuth\(\) \}\); \}/);
    // The host runs every hosted action through it, and calls an action nowhere else under an identity.
    const host = text('src/engine/host.ts');
    expect(host).toMatch(/withActorScope\(sim\.store, principal\.operatorId, stampOf\(clock\), \(\) => run\(\.\.\.args\)\)/);
    expect([...host.matchAll(/withActorScope\(/g)]).toHaveLength(1);
  });
});

describe('who writes what (database contract §6.4, MR-1)', () => {
  it('the folder holds no statement text of its own that changes a row', () => {
    expect(occurrences(production, SQL_WRITE)).toEqual([]);
  });

  it('the only table the folder inserts into itself is the health snapshots; the audit rows and the events go to the core\'s writers', () => {
    const inserted = production.flatMap((file) => [...file.text.matchAll(BUILDER_INSERT)].map((match) => `${file.path}: ${String(match[1])}`));
    expect(inserted).toEqual(['src/engine/write-plan.ts: healthSnapshots']);
    const plan = text('src/engine/write-plan.ts');
    expect(plan).toContain('unit.audit.appendPrepared(plan.auditRows)');
    expect(plan).toContain('unit.events.appendPrepared(plan.events)');
    expect(plan).toContain('applyChanges(unit.db, plan.rowChanges)');
  });

  it('the row changes come from the one mapping module and the store; the folder has no mapping of its own', () => {
    const plan = text('src/engine/write-plan.ts');
    expect(/import\s*\{([^}]*)\}\s*from\s*'\.\.\/db\/mapping';/.exec(plan)?.[1] ?? '').toMatch(/\bdiffSlices\b[\s\S]*\bnewAuditRows\b[\s\S]*\bnewEvents\b/);
    expect(plan).toMatch(/import \{ applyChanges \} from '\.\.\/db\/store';/);
    expect(text('src/engine/rehydrate.ts')).toMatch(/import \{ readStoredRows \} from '\.\.\/db\/store';/);
    // No column of a table is named in the folder: the typed tables and the mapped rows do.
    const columns = new RegExp([['written', 'at'], ['updated', 'at'], ['prev', 'hash'], ['actor', 'id'], ['next', 'value']].map((parts) => parts.join('_')).join('|'), 'g');
    expect(occurrences(production, columns)).toEqual([]);
  });

  it('the slices that are never stored are not named by the write plan', () => {
    const plan = text('src/engine/write-plan.ts');
    for (const slice of ['audio', 'clock', 'authLockout', 'pairing']) expect(plan, slice).not.toMatch(new RegExp(`\\b${slice}\\b`));
  });
});

describe('the simulator (P13, P21)', () => {
  it('is imported through its public barrel only', () => {
    expect(occurrences(production, SIM_DEEP_IMPORT)).toEqual([]);
    const importing = production.filter((file) => /from '@dems\/shared\/sim'/.test(file.text)).map((file) => file.path);
    expect(importing.length).toBeGreaterThan(5);
  });

  it('the host calls no sign-in action, no pairing action and no scenario action of the simulator', () => {
    const called = new RegExp(`\\bactions\\s*\\.\\s*(?:${['signIn', 'signInWithBiometric', 'recordBiometricFailure', 'signInWithSecurityKey', 'signOut', 'touch', 'pair', 'unpair', 'loadScenario', 'resetDemo'].join('|')})\\b`, 'g');
    expect(occurrences(production, called)).toEqual([]);
    expect(occurrences(production, /\bsim\s*\.\s*request\s*\(/g)).toEqual([]);
  });

  it('the simulator is created with every adapter injected, and never started by itself', () => {
    const sim = text('src/engine/headless-sim.ts');
    for (const option of ['clock: options.clock', 'scheduler: INERT_SCHEDULER', 'timers: INERT_TIMERS', 'storage: NO_STORAGE', 'authStorage: null', 'visibility: ALWAYS_VISIBLE', 'onError: options.onError']) {
      expect(sim, option).toContain(option);
    }
    expect(occurrences(production, /\bsim\s*\.\s*start\s*\(/g)).toEqual([]);
    expect([...text('src/engine/host.ts').matchAll(/\bsim\.tick\(\)/g)]).toHaveLength(1);
  });
});
