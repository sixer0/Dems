/**
 * Test support (not a test file): a configuration, a log capture, a search for credentials in a
 * captured log and a stand-in pool, for tests that run the app factory in-process, with no
 * database and no listener. Every row imports it.
 *
 * NEUTRAL TEST SUPPORT (fix round B1, review finding CPB1-12). This file lives in
 * `apps/core-server/test/support/` because tests of several rows use it; it moved here from
 * `src/plugins/config/__tests__/test-config.ts`, which re-exports it for one round. No production source imports
 * anything under `test/` (static test `test/static/imports.test.ts`).
 */
import type { Pool } from 'pg';
import { testConfiguration } from '../../src/test-configuration';
import { Secret, createConfig, type ConfigInput, type CoreServerConfig } from '../../src/config';
import type { LogStream } from '../../src/plugins/logger';

/** Nothing listens on this loopback port, so a pool that points at it is refused at once. */
export const CLOSED_PORT = 1;

/**
 * A configuration that needs no database: the pool points at a closed loopback port and the
 * data directory does not exist. The logger is silent unless `logLevel` is overridden.
 *
 * It is a TEST CONFIGURATION (`testConfiguration` of `src/test-configuration.ts`): on an app built from it a
 * seam and a request stage can be replaced. On an app built from any other configuration, the
 * entry point's among them, `replace` throws (checkpoint findings CPB1-5 and CPS1-2).
 */
export function unitTestConfig(overrides: Partial<ConfigInput> = {}): CoreServerConfig {
  return testConfiguration(createConfig({
    port: 4420,
    demoControls: false,
    logLevel: 'silent',
    dataDir: '/nonexistent/dems-unit-test-data',
    // Wave H closing pass Z1 (decision D207): a test Core has an installation identity, so a rig in a
    // production capture operation boots as before. A test ABOUT a Core without one passes `null`.
    installationDeviceId: 'DEMS-TEST-01',
    installationName: 'Unit test installation',
    database: {
      host: '127.0.0.1',
      port: CLOSED_PORT,
      database: 'dems_unit_test',
      user: 'dems_app',
      password: new Secret('unit-test-password'),
    },
    ...overrides,
  }));
}

export interface CapturedLog {
  /** Pass as `buildApp({ logStream })`. */
  readonly stream: LogStream;
  /** Everything written so far, as one string. */
  text(): string;
  /** Everything written so far, one parsed JSON object per line. */
  lines(): Array<Record<string, unknown>>;
}

export function captureLog(): CapturedLog {
  const chunks: string[] = [];
  return {
    stream: {
      write(chunk: string) {
        chunks.push(chunk);
      },
    },
    text: () => chunks.join(''),
    lines: () =>
      chunks
        .join('')
        .split('\n')
        .filter((line) => line !== '')
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

/** The scheme as clients send it, white space, then any value. */
const BEARER_VALUE = /\bBearer\s+[^\s"\\]+/g;
/** The scheme in any case, when what follows is a token of this server. */
const BEARER_TOKEN = /\bbearer\s+(?:ses|dvc|bio)_/gi;
/** A token by its prefix: session, device credential, biometric (spec §4.1, §5.6). */
const TOKEN_VALUE = /\b(?:ses|dvc|bio)_[A-Za-z0-9_-]{4,}/g;
/** A session cookie with a value. The cookie's name alone is not a credential. */
const SESSION_COOKIE_PAIR = /\bdems_session_[0-9]+=[^;\s"\\]+/g;

/**
 * What in a log text looks like a credential as a client sends it; an empty list means nothing
 * does. Each entry names the kind and the line of the text, never the value.
 *
 * It looks for VALUES, not for words: the field name `hasBearer` in the Origin guard's refusal
 * line, a code such as `BEARER_WITH_WEB_ORIGIN`, the cookie name `dems_session_4420` and the
 * word "bearer" in a sentence are not credentials and are not reported.
 */
export function credentialLeaks(text: string): string[] {
  const kinds: ReadonlyArray<readonly [kind: string, pattern: RegExp]> = [
    ['bearer value', BEARER_VALUE],
    ['bearer value', BEARER_TOKEN],
    ['token', TOKEN_VALUE],
    ['session cookie', SESSION_COOKIE_PAIR],
  ];
  const found = new Set<string>();
  for (const [kind, pattern] of kinds) {
    for (const match of text.matchAll(pattern)) {
      found.add(`${kind} in line ${text.slice(0, match.index).split('\n').length}`);
    }
  }
  return [...found];
}

export interface FakePool {
  /** Pass as `buildApp({ createPool: () => fake.pool })`. */
  readonly pool: Pool;
  /** The text of every statement the pool was asked to run. */
  readonly queries: string[];
  /** How often `end()` was called. */
  readonly ended: () => number;
  /** Emits the pool's `error` event, as an idle connection does when the database stops. */
  emitError(error: Error): void;
}

/**
 * A stand-in for the `pg` pool that opens no connection. `answer` decides each query: resolve
 * for a database that answers, reject for one that does not.
 */
export function createFakePool(answer: (text: string) => Promise<unknown> = async () => ({ rows: [] })): FakePool {
  const queries: string[] = [];
  const listeners: Array<(error: Error) => void> = [];
  let ended = 0;
  const pool = {
    query(text: string) {
      queries.push(text);
      return answer(text);
    },
    on(event: string, listener: (error: Error) => void) {
      if (event === 'error') listeners.push(listener);
      return pool;
    },
    async end() {
      ended += 1;
    },
  };
  return {
    pool: pool as unknown as Pool,
    queries,
    ended: () => ended,
    emitError(error) {
      for (const listener of listeners) listener(error);
    },
  };
}
