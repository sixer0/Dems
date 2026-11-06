/**
 * What the global setup of the Vitest project `db` hands to the test files (`provide` in the
 * main process, `inject` in a worker). It holds names and times only: a test file reads the
 * connection files itself, so no credential ever travels between processes.
 */

export interface ProvidedTestRun {
  /** `local` or `step_<row>`. */
  readonly label: string;
  /** Eight base-36 characters. */
  readonly stamp: string;
  /** `dems_test_<label>_<stamp>_`. */
  readonly prefix: string;
  /** ISO 8601, when the run started. */
  readonly startedAt: string;
  /** `server_version` of the PostgreSQL the run uses. */
  readonly serverVersion: string;
  /** The standard templates the global setup built: a subset of `schema`, `seed`. */
  readonly templates: readonly string[];
}

declare module 'vitest' {
  export interface ProvidedContext {
    demsTestRun: ProvidedTestRun;
  }
}
