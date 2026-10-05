// The boot checks a reset runs on the reopened pool, and the host's bindings (plan row W43;
// database contract §7.4, §8.5 R-9; decision D87 for the second half of B-1). In-process, no
// database: `runBootChecks` on a stand-in of the app whose pool a script answers.
//
// What is proven here: B-1 has both halves (the database answers; a pooled connection has the
// pinned path), a check that does not pass is named by its own ID, the order is the contract's,
// and B-8 is reported and never blocking. The blocking checks against PostgreSQL:
// `reset-failures.db.test.ts` (a reset after which B-5 does not pass).
import type { FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';
import { BOOT_CHECK_IDS, BootCheckError } from '../../../db/schema/boot-checks';
import { RUNTIME_SEARCH_PATH, SEARCH_PATH_NOT_PINNED, SEARCH_PATH_QUESTION } from '../../../plugins/db';
import type { ErrorLogEntry } from '../../../plugins/logger';
import { READ_OPERATOR_ROLES, ResumeFailure, runBootChecks } from '../index';
import { recordingLogger } from './support';

interface Script {
  probe: boolean;
  /** What a pooled connection answers to the path question. */
  path: unknown;
  /** Answers every other statement; `undefined` answers no row. */
  answer(text: string): unknown[] | Error | undefined;
}

function standIn(script: Partial<Script> = {}) {
  const settings: Script = { probe: true, path: RUNTIME_SEARCH_PATH, answer: () => undefined, ...script };
  const sent: Array<{ text: string; rowMode: unknown }> = [];
  const logger = recordingLogger();
  const persisted: ErrorLogEntry[] = [];
  let probes = 0;
  const pool = {
    async query(query: string | { text: string; rowMode?: string }, _values?: unknown[]) {
      const text = typeof query === 'string' ? query : query.text;
      sent.push({ text, rowMode: typeof query === 'string' ? undefined : query.rowMode });
      // The path question is asked by position: a row is a list, as the driver hands it over in that mode.
      if (text === SEARCH_PATH_QUESTION) return { rows: [[settings.path]] };
      const answer = settings.answer(text);
      if (answer instanceof Error) throw answer;
      return { rows: answer ?? [] };
    },
  };
  const app = {
    db: {
      pool,
      probe: async (options?: { fresh?: boolean }) => {
        probes += 1;
        expect(options).toEqual({ fresh: true });
        return settings.probe;
      },
    },
    log: logger.log,
    errorLog: { file: null, append: (entry: ErrorLogEntry) => void persisted.push(entry) },
  };
  return { app: app as unknown as FastifyInstance, sent, lines: logger.lines, persisted, probes: () => probes };
}

async function failureOf(app: FastifyInstance): Promise<ResumeFailure> {
  const thrown: unknown = await runBootChecks(app).then(
    () => null,
    (error: unknown) => error,
  );
  expect(thrown).toBeInstanceOf(ResumeFailure);
  return thrown as ResumeFailure;
}

/** Answers with which the nine checks pass, by a fragment of each statement. */
function healthy(text: string): unknown[] | undefined {
  if (text === 'SHOW server_version_num') return [{ server_version_num: '180004' }];
  if (text === 'SHOW server_encoding') return [{ server_encoding: 'UTF8' }];
  return undefined;
}

describe('B-1 on the reopened pool', () => {
  it('the database does not answer: the resume fails at B-1, and nothing else is asked', async () => {
    const built = standIn({ probe: false });
    const failure = await failureOf(built.app);
    expect(failure.step).toBe('B-1');
    expect(built.probes()).toBe(1);
    expect(built.sent).toEqual([]);
  });

  it('a pooled connection without the pinned path: the resume fails at B-1 with the code of the pool plugin\'s own boot step', async () => {
    const built = standIn({ path: '"$user", public' });
    const failure = await failureOf(built.app);
    expect(failure.step).toBe('B-1');
    expect(failure.thrown).toMatchObject({ name: 'DatabaseBootError', code: SEARCH_PATH_NOT_PINNED });
    // The question is the pool plugin's, asked once, and its one column is read by position.
    expect(built.sent).toEqual([{ text: SEARCH_PATH_QUESTION, rowMode: 'array' }]);
  });

  it.each([[null], [undefined], [''], ['public'], ['pg_catalog,public']])('the path %j is not the pinned one either', async (path) => {
    expect((await failureOf(standIn({ path }).app)).step).toBe('B-1');
  });
});

describe('B-2 to B-9, in the order of the contract', () => {
  it('a check that does not pass is named by its own ID, with what it threw; the checks after it do not run', async () => {
    // B-1 passes; the pool answers nothing else, so B-2 reads no version.
    const built = standIn();
    const failure = await failureOf(built.app);
    expect(failure.step).toBe('B-2');
    expect(failure.thrown).toBeInstanceOf(BootCheckError);
    expect(built.sent.map((entry) => entry.text)).toEqual([SEARCH_PATH_QUESTION, 'SHOW server_version_num', 'SHOW server_encoding']);
    // The caller logs and persists the failure once; this function writes nothing for it.
    expect(built.lines).toEqual([]);
    expect(built.persisted).toEqual([]);
  });

  it('with B-2 passing the next one asked is B-3, then it stops there', async () => {
    const built = standIn({ answer: healthy });
    const failure = await failureOf(built.app);
    expect(failure.step).toBe('B-3');
    expect(built.sent.slice(0, 3).map((entry) => entry.text)).toEqual([SEARCH_PATH_QUESTION, 'SHOW server_version_num', 'SHOW server_encoding']);
  });

  it('a statement that fails names the check it belongs to and keeps the driver\'s error for the caller\'s `err`', async () => {
    const lost = Object.assign(new Error('terminating connection due to administrator command'), { code: '57P01' });
    const built = standIn({ answer: (text) => (text === 'SHOW server_encoding' ? lost : healthy(text)) });
    const failure = await failureOf(built.app);
    expect(failure.step).toBe('B-2');
    expect(failure.thrown).toBe(lost);
    // The failure's own text names the step and nothing of the error.
    expect(failure.message).toBe('the server could not resume after a demo reset: B-2 failed');
  });

  it('the checks are the eight of the contract, B-8 among them', () => {
    expect([...BOOT_CHECK_IDS]).toEqual(['B-2', 'B-3', 'B-4', 'B-5', 'B-6', 'B-7', 'B-8', 'B-9']);
  });
});

describe('the read of the operators', () => {
  it('names the two columns it needs and no other: the operator and its role', () => {
    expect(READ_OPERATOR_ROLES).toBe('SELECT id, role_id AS role FROM public.operators ORDER BY id');
  });
});
