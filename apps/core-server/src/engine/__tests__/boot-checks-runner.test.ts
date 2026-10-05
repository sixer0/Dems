// The one runner of the database boot checks (fix round B2a; decision D101; database contract
// §7.4, §8.5 R-9; decision D87 for the second half of B-1). Database-free: `runDatabaseBootChecks`
// of the core on a stand-in of the app whose pool a script answers.
//
// What is proven here: B-1 has both halves (the database answers; a pooled connection has the
// pinned path), a check that does not pass is named by its own ID with what it threw, the order
// is the contract's, the function writes nothing for a check that failed, and B-8 is reported as
// at a start and never stops the run. The checks against PostgreSQL, on a running server:
// `boot-checks-runner.db.test.ts`.
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';
import * as core from '../../core';
import { REPORTED_BOOT_CHECK, runDatabaseBootChecks } from '../../core';
import { BOOT_CHECK_IDS, BootCheckError } from '../../db/schema/boot-checks';
import { BOOT_STEP_DATABASE_ANSWERS, RUNTIME_SEARCH_PATH, SEARCH_PATH_NOT_PINNED, SEARCH_PATH_QUESTION } from '../../plugins/db';
import type { ErrorLogEntry } from '../../plugins/logger';
import { BootError } from '../../plugins/readiness';

interface Script {
  /** What the pool plugin's probe answers. */
  probe: boolean;
  /** What a pooled connection answers to the path question. */
  path: unknown;
  /** Answers every other statement: rows, or an error to throw; `undefined` answers no row. */
  answer(text: string): unknown[] | Error | undefined;
}

/** What `runDatabaseBootChecks` uses of the app: the probe, the pool, the log and the error log. */
function standIn(script: Partial<Script> = {}) {
  const settings: Script = { probe: true, path: RUNTIME_SEARCH_PATH, answer: () => undefined, ...script };
  const sent: Array<{ text: string; rowMode: unknown }> = [];
  const lines: Array<{ level: string; fields: Record<string, unknown>; text: string }> = [];
  const persisted: ErrorLogEntry[] = [];
  let probes = 0;
  const at = (level: string) => (fields: Record<string, unknown>, text: string) => void lines.push({ level, fields, text });
  const pool = {
    async query(query: string | { text: string; rowMode?: string }) {
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
    log: { trace: at('trace'), debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error'), fatal: at('fatal'), level: 'trace' } as unknown as FastifyBaseLogger,
    errorLog: { file: null, append: (entry: ErrorLogEntry) => void persisted.push(entry) },
  };
  return { app: app as unknown as FastifyInstance, sent, lines, persisted, probes: () => probes };
}

async function failureOf(app: FastifyInstance): Promise<BootError> {
  const thrown: unknown = await runDatabaseBootChecks(app).then(
    () => null,
    (error: unknown) => error,
  );
  expect(thrown).toBeInstanceOf(BootError);
  return thrown as BootError;
}

/** Answers with which B-2 passes, by the text of each statement. */
function healthy(text: string): unknown[] | undefined {
  if (text === 'SHOW server_version_num') return [{ server_version_num: '180004' }];
  if (text === 'SHOW server_encoding') return [{ server_encoding: 'UTF8' }];
  return undefined;
}

describe('the export', () => {
  it('is ONE function of the core, beside the registration of the boot steps', () => {
    expect(typeof core.runDatabaseBootChecks).toBe('function');
    expect(Object.keys(core).filter((name) => /boot/i.test(name)).sort()).toEqual(['REPORTED_BOOT_CHECK', 'registerBootChecks', 'runDatabaseBootChecks']);
    expect(BOOT_STEP_DATABASE_ANSWERS).toBe('B-1');
    expect([...BOOT_CHECK_IDS]).toEqual(['B-2', 'B-3', 'B-4', 'B-5', 'B-6', 'B-7', 'B-8', 'B-9']);
    expect(REPORTED_BOOT_CHECK).toBe('B-8');
  });
});

describe('B-1 on the pool as it is now', () => {
  it('the database does not answer: the run stops at B-1, and nothing else is asked', async () => {
    const built = standIn({ probe: false });
    const failure = await failureOf(built.app);
    expect(failure.stepId).toBe('B-1');
    expect(failure.message).toBe('boot step B-1 failed');
    expect(failure.cause).toBeInstanceOf(Error);
    expect(built.probes()).toBe(1);
    expect(built.sent).toEqual([]);
  });

  it('a pooled connection without the pinned path: B-1, with the code of the pool plugin\'s own boot step', async () => {
    const built = standIn({ path: '"$user", public' });
    const failure = await failureOf(built.app);
    expect(failure.stepId).toBe('B-1');
    expect(failure.cause).toMatchObject({ name: 'DatabaseBootError', code: SEARCH_PATH_NOT_PINNED });
    // The value that was found is not in the text: a setting of the server, but not this function's to quote.
    expect((failure.cause as Error).message).not.toContain('$user');
    // The question is the pool plugin's, asked once, and its one column is read by position.
    expect(built.sent).toEqual([{ text: SEARCH_PATH_QUESTION, rowMode: 'array' }]);
  });

  it.each([[null], [undefined], [''], ['public'], ['pg_catalog,public'], [`${RUNTIME_SEARCH_PATH} `]])('the path %j is not the pinned one either', async (path) => {
    expect((await failureOf(standIn({ path }).app)).stepId).toBe('B-1');
  });
});

describe('B-2 to B-9, in the order of the contract', () => {
  it('a check that does not pass is named by its own ID, with what it threw; the checks after it do not run; nothing is written', async () => {
    // B-1 passes; the pool answers nothing else, so B-2 reads no version.
    const built = standIn();
    const failure = await failureOf(built.app);
    expect(failure.stepId).toBe('B-2');
    expect(failure.cause).toBeInstanceOf(BootCheckError);
    expect(built.sent.map((entry) => entry.text)).toEqual([SEARCH_PATH_QUESTION, 'SHOW server_version_num', 'SHOW server_encoding']);
    // The caller reports the failure once: this function writes no line and no entry for it.
    expect(built.lines).toEqual([]);
    expect(built.persisted).toEqual([]);
  });

  it('with B-2 passing the next one asked is B-3, then it stops there', async () => {
    const built = standIn({ answer: healthy });
    const failure = await failureOf(built.app);
    expect(failure.stepId).toBe('B-3');
    expect(built.sent.slice(0, 3).map((entry) => entry.text)).toEqual([SEARCH_PATH_QUESTION, 'SHOW server_version_num', 'SHOW server_encoding']);
    expect(built.sent.length).toBeGreaterThan(3);
  });

  it('a statement that fails names the check it belongs to and keeps the driver\'s error as the cause', async () => {
    const lost = Object.assign(new Error('terminating connection due to administrator command'), { code: '57P01' });
    const built = standIn({ answer: (text) => (text === 'SHOW server_encoding' ? lost : healthy(text)) });
    const failure = await failureOf(built.app);
    expect(failure.stepId).toBe('B-2');
    expect(failure.cause).toBe(lost);
    // The failure's own text names the step and nothing of the error.
    expect(failure.message).toBe('boot step B-2 failed');
    expect(built.lines).toEqual([]);
  });
});
