/**
 * Constants of the template-clone test helper (plan row W11, hand-built element HB-12;
 * database contract §10, rules TI-1 to TI-17).
 *
 * ISOLATION (decision D26, finding F27). Another PostgreSQL server, not this project's, listens
 * on the default port of this host. The helper has one endpoint, `127.0.0.1:4432`, and refuses
 * everything else (`endpoint.ts`). Host and port are always passed to the driver explicitly.
 */
import { DATABASE_HOST, FOREIGN_DATABASE_PORT, RUNTIME_ROLE } from '../../../src/config';

/** The project's PostgreSQL: loopback IPv4, TCP only (02_plan §4.2). */
export const PROJECT_DATABASE_HOST = DATABASE_HOST;
export const PROJECT_DATABASE_PORT = 4432;
/** PostgreSQL's default port: a server that is not the project's. Refused by name. */
export const FOREIGN_PORT = FOREIGN_DATABASE_PORT;

/** Owns every project database; the helper, the templates and the clones use it (TI-4, TI-9). */
export const OWNER_ROLE = 'dems_owner';
/** The runtime role: the code under test connects as it, exactly as in the demo (TI-9). */
export const APP_ROLE = RUNTIME_ROLE;
/**
 * The bootstrap superuser. It is named here for one purpose: to refuse it. Nothing in this
 * folder connects as it or reads its password file (TI-9, HC-1).
 */
export const REFUSED_SUPERUSER_ROLE = 'dems_admin';

/** Where `CREATE DATABASE`, `DROP DATABASE` and the advisory locks are issued (TI-7, DA-12). */
export const MAINTENANCE_DATABASE = 'postgres';

/** Every test database starts with this (TI-2), and the helper touches nothing else (TI-3). */
export const TEST_DATABASE_PREFIX = 'dems_test_';
/** PostgreSQL cuts an identifier at 63 bytes (PG-13). */
export const MAX_IDENTIFIER_BYTES = 63;

/** Environment variable that carries the row label of a run (02_plan §3.4). */
export const ENV_TEST_STEP = 'DEMS_TEST_STEP';
/** The label of a run that sets no row. */
export const LOCAL_LABEL = 'local';

/**
 * Advisory lock class "test clone" (02_plan §3.4: lock key 442002). The second key selects:
 *   0                      the clone lock of TI-7: one `CREATE DATABASE` at a time;
 *   1 to 1073741823        "this run is alive", derived from the run stamp (stale sweep, TI-12).
 */
export const LOCK_CLASS = 442002;
export const CLONE_LOCK_KEY = 0;
export const LIVENESS_KEY_SPACE = 0x3fffffff;

/** A run that crashed is swept after six hours (TI-12). */
export const STALE_AFTER_SECONDS = 6 * 60 * 60;

/** Longest wait for the clone lock, and for any other lock a statement of the helper needs. */
export const DEFAULT_LOCK_TIMEOUT_MS = 120_000;
/** Longest wait for the sessions of a database to end before it is locked or dropped. */
export const DEFAULT_SESSION_DRAIN_MS = 5_000;
/**
 * The forced drop of a database is refused (SQLSTATE 42501) while a backend that `dems_owner` may
 * not end is connected to it. An autovacuum worker is such a backend: it visits a database that
 * has just been written to within seconds and stays for milliseconds. The helper then waits and
 * sends the same drop again: at most this many attempts, this far apart (`ddl.ts`, row W11b).
 */
export const DROP_RETRY_ATTEMPTS = 20;
export const DROP_RETRY_PAUSE_MS = 250;
/**
 * A run that is removed by name (`TestRun.dropDeadRun`, decision D111) must show no client
 * session on its databases twice, this far apart, while the caller holds its liveness lock.
 */
export const DEAD_RUN_SETTLE_MS = 3_000;
/**
 * The limits of a database test file (decision D114): the longest one test may take, and the
 * longest one hook. The helper raises the runner's two limits to these for every file that
 * imports it in a run of the database tests (`index.ts`); the runner's own are 5 s and 10 s.
 *
 * They are CAPS, not waits: nothing takes longer because of them. What they allow for is the
 * waiting a database test does and a unit test never does: for the clone lock, which another run
 * on the host may hold for seconds while it builds its bulk template, and for a drop that is
 * repeated. The price: a database test that hangs is reported after 120 s, not after 5 s.
 */
export const DB_TEST_TIMEOUT_MS = 120_000;
export const DB_HOOK_TIMEOUT_MS = 180_000;
/**
 * Ceiling of a limit a test file states for itself (`useTestDatabase({ needs })`, decision D134).
 * A stated need is a FLOOR the helper raises to, and it may be above the two caps: that is what
 * the option exists for. It is never unlimited: a run must not hang forever because one file
 * asked for "as long as it takes". Fifteen minutes is five times the cap of a test.
 */
export const DB_NEED_MAX_MS = 900_000;
/** Longest wait for a connection, and for a free connection out of a pool. */
export const CONNECT_TIMEOUT_MS = 5_000;
/**
 * How long a clone request that asks for a quiet cluster (`needs.quietCluster`) looks for an
 * empty clone-lock queue before it creates the database anyway (decision D134). Best effort
 * inside this bound: the helper takes no lock for it and blocks nobody, and it says in the
 * timings whether it got the quiet. Five seconds covers one bulk build of another run (measured
 * 1.2 to 3.5 s under the clone lock, row W11b follow-up 2) and costs a busy host little.
 */
export const CLUSTER_QUIET_BUDGET_MS = 5_000;
/** Longest wait of the reachability probe. */
export const PROBE_TIMEOUT_MS = 1_500;

/** A pool of at most five connections per application under test (TI-14). */
export const APP_POOL_MAX = 5;
/** The helper's own fixture pool on a clone or a template. */
export const OWNER_POOL_MAX = 2;
/** A two-digit counter: at most 99 clones of one run exist at the same time (TI-2). */
export const MAX_LIVE_CLONES = 99;

/** The three templates of the contract (§10.1), in build order. */
export const STANDARD_TEMPLATES = ['schema', 'seed', 'bulk'] as const;
export type StandardTemplate = (typeof STANDARD_TEMPLATES)[number];

/** Key of the run identity that the global setup provides to the test files. */
export const PROVIDE_KEY = 'demsTestRun';

/** Prefix of every line the helper prints. A line never holds a credential. */
export const LOG_PREFIX = '[test:db]';
