// npm run pg:init: provisions the project-local PostgreSQL cluster, once (plan row W07).
// Steps RP-1 to RP-6 of the database contract (7.1), with the provisioning trial as RP-5:
//
//   CR-7  git must ignore .data/ BEFORE anything is created
//   RP-1  .data/ (0700) and three generated passwords in three files (0600, created exclusively)
//   RP-2  initdb -U dems_admin -A scram-sha-256 --pwfile=<path> -E UTF8 --locale=C, then
//         listen_addresses = '127.0.0.1', port = 4432, unix_socket_directories = '' and the
//         server-log settings of security ruling 14 (CONF_BLOCK)
//   RP-3  first start; as dems_admin: CREATE ROLE dems_owner (CREATEDB, no superuser), dems_app
//   RP-4  host-authentication check HA-1 to HA-4
//   RP-5  the trial (trial.mjs), as dems_owner; T5-j once as dems_admin
//   RP-6  every superuser session is closed; nothing connects as dems_admin afterwards
//
// It REFUSES when a cluster or a credential file already exists: nothing is ever overwritten.
// "--resume" continues an interrupted provisioning: it creates only what is missing and runs
// RP-3 to RP-6 again, which are idempotent. The server is left running.
// Nothing is printed but file names, modes, key names and role names.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  APP_KEYS,
  DB_MAIN,
  DB_MAINTENANCE,
  OWNER_KEYS,
  PG_HOST,
  PG_PORT,
  PgScriptError,
  ROLE_ADMIN,
  ROLE_APP,
  ROLE_OWNER,
  assertBinaries,
  assertClusterEndpoint,
  connectionFileText,
  hasCluster,
  logEvent,
  lsofListen,
  main,
  newPassword,
  probeTcp,
  readConnectionFile,
  readPwfile,
  rel,
  reportKeyNames,
  reportModes,
  run,
  say,
  underLock,
  writeSecretFile,
} from './lib.mjs';
import { checkHbaFile, reportHba } from './check-hba.mjs';
import { connect, scramVerifier, wrongPasswordSqlState } from './db.mjs';
import { serverState, startServer } from './server.mjs';
import { Recorder, readRoles, runSqlTrial } from './trial.mjs';

export const OWNER_ATTRIBUTES = 'LOGIN NOSUPERUSER CREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS';
export const APP_ATTRIBUTES = 'LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS';

/** Appended to postgresql.conf. What is logged stays at the defaults (contract NL-5): no statement,
 *  duration or bind-parameter logging. HOW the server log is written follows security ruling 14
 *  (finding CPS1-9): terse errors, so a failed statement leaves no DETAIL line with the failing row
 *  or the key value (hash columns among them), and a ring of 24 hourly files instead of one file
 *  that grows without bound. PostgreSQL has no byte cap for its own log; its bound is this ring. */
export const CONF_BLOCK = [
  '',
  '# --- DEMS project-local settings (scripts/pg/init.mjs; plan W07, analysis TD-02) ---',
  '# Loopback IPv4 only, the project port, no Unix socket. Never the default port.',
  `listen_addresses = '${PG_HOST}'`,
  `port = ${PG_PORT}`,
  "unix_socket_directories = ''",
  '# The server log (security ruling 14, CPS1-9). Terse: no DETAIL, HINT, QUERY or CONTEXT line.',
  'log_error_verbosity = terse',
  '# 24 hourly files in .data/postgres/log/, each overwritten when its hour comes round again.',
  '# Size-driven rotation is off: it would reopen the same hour file and append to it. The file',
  '# of pg_ctl -l (.data/postgres.log) keeps only what is written before the collector starts.',
  'logging_collector = on',
  "log_directory = 'log'",
  "log_filename = 'postgresql-%H.log'",
  'log_file_mode = 0600',
  'log_rotation_age = 1h',
  'log_rotation_size = 0',
  'log_truncate_on_rotation = on',
  '',
].join('\n');

const IGNORED_PATHS = Object.freeze([
  '.data/postgres',
  '.data/pg.pwfile',
  '.data/pg.owner.env',
  '.data/pg.env',
  '.data/postgres.log',
  '.data/pg-scripts.log',
]);

export function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** The password of the superuser travels as a file path, never as a value (CR-4). */
export function initdbArgs(paths) {
  return ['-D', paths.pgdata, '-U', ROLE_ADMIN, '-A', 'scram-sha-256', `--pwfile=${paths.pwfile}`, '-E', 'UTF8', '--locale=C'];
}

export function existingArtefacts(paths) {
  return [paths.pgdata, paths.pwfile, paths.ownerEnv, paths.appEnv]
    .filter((file) => fs.existsSync(file))
    .map((file) => rel(file, paths.root));
}

export function assertFreshTarget(paths) {
  const found = existingArtefacts(paths);
  if (found.length > 0) {
    throw new PgScriptError(
      `refused: already provisioned, or partly provisioned (${found.join(', ')}). Nothing was changed.\n` +
        '  The server:            npm run pg:status / npm run pg:start\n' +
        '  An interrupted init:   node scripts/pg/init.mjs --resume   (creates only what is missing)\n' +
        '  A new cluster:         npm run pg:remove-data, then npm run pg:init   (deletes every database)',
    );
  }
}

/** CR-7: `git check-ignore -v` must match every path before it is created. Outside a git work
 *  tree there is nothing to commit to, and the check is skipped with a note. */
export function assertIgnored(paths) {
  const inside = run('git', ['-C', paths.root, 'rev-parse', '--is-inside-work-tree']);
  if (inside.status !== 0) return { skipped: true, lines: [] };
  const r = run('git', ['-C', paths.root, 'check-ignore', '-v', '--', ...IGNORED_PATHS]);
  const lines = r.stdout.split('\n').filter((line) => line !== '');
  const matched = new Set(lines.map((line) => line.split('\t')[1]));
  const missing = IGNORED_PATHS.filter((target) => !matched.has(target));
  if (missing.length > 0) {
    throw new PgScriptError(
      `refused: git does not ignore ${missing.join(', ')}. Add "/.data/" to .gitignore first. Nothing was created.`,
    );
  }
  return { skipped: false, lines };
}

export function prepareDataDir(paths) {
  fs.mkdirSync(paths.data, { mode: 0o700, recursive: false });
  fs.chmodSync(paths.data, 0o700);
}

/** RP-1: three passwords, three files. A file that exists is kept (CR-5). Returns the names of
 *  the files it created. */
export function writeCredentialFiles(paths) {
  const created = [];
  const make = (file, text) => {
    if (fs.existsSync(file)) return;
    writeSecretFile(file, text());
    created.push(rel(file, paths.root));
  };
  make(paths.pwfile, () => `${newPassword()}\n`);
  make(paths.ownerEnv, () => connectionFileText(OWNER_KEYS, [PG_HOST, PG_PORT, DB_MAINTENANCE, ROLE_OWNER, newPassword()]));
  make(paths.appEnv, () => connectionFileText(APP_KEYS, [PG_HOST, PG_PORT, DB_MAIN, ROLE_APP, newPassword()]));
  return created;
}

/** RP-3: both project roles, each only when pg_roles has no such row. */
async function provisionRoles(paths) {
  const owner = readConnectionFile(paths.ownerEnv, OWNER_KEYS, paths.root);
  const app = readConnectionFile(paths.appEnv, APP_KEYS, paths.root);
  const admin = await connect({
    user: ROLE_ADMIN,
    password: readPwfile(paths.pwfile, paths.root),
    database: DB_MAINTENANCE,
    appName: 'dems-pg-init',
  });
  try {
    const here = (await admin.query("SELECT current_setting('data_directory') AS dir, current_user AS role")).rows[0];
    if (fs.realpathSync(here.dir) !== fs.realpathSync(paths.pgdata)) {
      throw new PgScriptError(
        `refused: the server that answered on ${PG_HOST}:${PG_PORT} does not run on this project's data directory. Nothing was changed.`,
      );
    }
    say(`  connected as ${here.role}; the server's data_directory is ${rel(here.dir, paths.root)} (this project's)`);
    for (const [role, attributes, password] of [
      [ROLE_OWNER, OWNER_ATTRIBUTES, owner.password],
      [ROLE_APP, APP_ATTRIBUTES, app.password],
    ]) {
      const exists = (await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role])).rowCount === 1;
      if (exists) {
        say(`  role ${role}: exists already, left as it is`);
        continue;
      }
      // A utility statement takes no bind parameter. The literal is escaped by the driver and
      // holds the SCRAM verifier, not the password.
      await admin.query(`CREATE ROLE ${role} ${attributes} PASSWORD ${admin.escapeLiteral(scramVerifier(password))}`);
      say(`  role ${role}: created (${attributes}; PASSWORD given as a SCRAM-SHA-256 verifier, not printed)`);
    }
  } finally {
    await admin.end().catch(() => {});
  }
  say('  the superuser session of RP-3 is closed');
}

await main(import.meta.url, 'pg:init', async (args, paths) => {
  const resume = args.includes('--resume');
  underLock(import.meta.url, paths, 300);
  const rec = new Recorder();
  const step = (title) => say(`\n== ${title}`);

  say(`pg:init: project-local PostgreSQL on ${PG_HOST}:${PG_PORT}${resume ? ' (--resume)' : ''}`);

  step('Binaries (SU-1: SHA-256, recomputed here)');
  assertBinaries(paths);
  for (const file of [paths.postgres, paths.initdb, paths.pgCtl]) {
    say(`  ${sha256File(file)}  ${rel(file, paths.root)}`);
  }
  const version = run(paths.postgres, ['--version']).stdout.trim();
  rec.add('T2', 'shell', `${rel(paths.postgres, paths.root)} --version`, version, version === 'postgres (PostgreSQL) 18.4' ? 'PASS' : 'FAIL');
  if (rec.failures.length > 0) throw new PgScriptError('the binary is not PostgreSQL 18.4; nothing was created.');

  step('CR-7: git check-ignore -v, before anything is created');
  const ignored = assertIgnored(paths);
  if (ignored.skipped) say('  not a git work tree: check skipped');
  for (const line of ignored.lines) say(`  ${line}`);

  if (!resume) assertFreshTarget(paths);

  step('RP-1: .data/ (0700) and the three credential files (0600, created exclusively)');
  if (!fs.existsSync(paths.data)) prepareDataDir(paths);
  const created = writeCredentialFiles(paths);
  say(created.length > 0 ? `  created: ${created.join(', ')}` : '  all three files exist already; none was changed');
  say('  three passwords of 32 random bytes each (crypto.randomBytes, base64url); none is printed');

  step('RP-2: initdb');
  if (hasCluster(paths)) {
    say(`  ${rel(paths.pgdata, paths.root)} exists already; initdb is not run again`);
  } else {
    const initArgs = initdbArgs(paths);
    say(`  $ ${rel(paths.initdb, paths.root)} ${initArgs.map((a) => a.replace(paths.root + path.sep, '')).join(' ')}`);
    const r = run(paths.initdb, initArgs);
    for (const line of `${r.stdout}${r.stderr}`.trimEnd().split('\n')) say(`  | ${line}`);
    if (r.status !== 0) throw new PgScriptError(`initdb failed (exit ${r.status}).`);
    fs.appendFileSync(path.join(paths.pgdata, 'postgresql.conf'), CONF_BLOCK);
    say("  postgresql.conf: listen_addresses = '127.0.0.1', port = 4432, unix_socket_directories = '' appended");
    say('  postgresql.conf: log_error_verbosity = terse and the hourly log ring in .data/postgres/log/ appended (ruling 14)');
    logEvent(paths, 'info', 'pg:init', 'cluster created', { pgdata: rel(paths.pgdata, paths.root) });
  }
  assertClusterEndpoint(paths.pgdata);
  const pgVersion = fs.readFileSync(path.join(paths.pgdata, 'PG_VERSION'), 'utf8').trim();
  rec.add('T3', 'shell', 'initdb exit 0; .data/postgres/PG_VERSION', pgVersion, pgVersion === '18' ? 'PASS' : 'FAIL');

  step('First start');
  const before = await serverState(paths);
  if (before.state !== 'running') {
    const lsof = lsofListen();
    say(`  $ lsof -nP -iTCP:${PG_PORT} -sTCP:LISTEN`);
    say(lsof.lines.length === 0 ? '  (no output)' : lsof.lines.map((l) => `  ${l}`).join('\n'));
    say(`  connect probe to ${PG_HOST}:${PG_PORT}: ${await probeTcp()}`);
  }
  const started = await startServer(paths);
  if (started.output) say(`  ${started.output.split('\n').join('\n  ')}`);
  say(`  ${started.started ? 'started' : 'was running already'}: PID ${started.pid}, recorded in ${rel(paths.pidFile, paths.root)}`);
  const listeners = lsofListen();
  for (const line of listeners.lines) say(`  ${line}`);
  rec.add(
    'T4',
    'shell',
    `lsof -nP -iTCP:${PG_PORT} -sTCP:LISTEN`,
    listeners.lines.length === 0 ? 'no listener line (lsof unavailable?)' : `${listeners.lines.length} listener line(s): ${listeners.lines.map((l) => l.split(/\s+/).slice(-2).join(' ')).join('; ')}`,
    listeners.lines.length === 1 && listeners.lines[0].includes(`TCP ${PG_HOST}:${PG_PORT} (LISTEN)`) ? 'PASS' : 'FAIL',
  );

  step('RP-3: the two project roles (as dems_admin, on the maintenance database)');
  await provisionRoles(paths);

  step('RP-4: host authentication HA-1 to HA-4');
  const hbaFile = path.join(paths.pgdata, 'pg_hba.conf');
  const hba = checkHbaFile(hbaFile);
  reportHba(hba, rel(hbaFile, paths.root));
  rec.add('T3-a', 'file', `HA-1 to HA-3 on ${rel(hbaFile, paths.root)}`, hba.ok ? `${hba.lines.length} lines: no trust, loopback addresses only, scram-sha-256 on every line` : hba.failures.map((f) => `${f.rule} line ${f.line}: ${f.reason}`).join('; '), hba.ok ? 'PASS' : 'FAIL');
  const sqlState = await wrongPasswordSqlState();
  rec.add('T3-b', `${ROLE_APP}@${DB_MAINTENANCE}`, 'a connection with a wrong password', `refused, SQLSTATE ${sqlState}`, sqlState === '28P01' ? 'PASS' : 'FAIL');

  step('RP-5: the trial, as dems_owner (T5-j once as dems_admin)');
  await runSqlTrial(paths, rec, { superuserStep: true });

  step('RP-6: no superuser session is open; nothing connects as dems_admin from here on');
  say(`  ${rel(paths.pwfile, paths.root)} is read by scripts/pg/init.mjs and scripts/pg/check-superuser-trigger.mjs only`);
  say('  roles (pg_roles: flags only):');
  say('    rolname       super  createdb  createrole  replication  bypassrls  login');
  for (const role of await readRoles(paths)) {
    say(`    ${role.rolname.padEnd(13)} ${String(role.rolsuper).padEnd(6)} ${String(role.rolcreatedb).padEnd(9)} ${String(role.rolcreaterole).padEnd(11)} ${String(role.rolreplication).padEnd(12)} ${String(role.rolbypassrls).padEnd(10)} ${role.rolcanlogin}`);
  }

  step('Files: modes (T-CR-1) and key names (AC-B-86)');
  const modesOk = reportModes(paths);
  const keysOk = reportKeyNames(paths);

  step('Trial summary');
  for (const row of rec.rows) say(`  ${row.id.padEnd(6)} ${row.verdict}`);
  const failed = rec.failures.length > 0 || !modesOk || !keysOk;
  logEvent(paths, failed ? 'error' : 'info', 'pg:init', failed ? 'provisioning trial failed' : 'provisioning complete', {
    failed: rec.failures.map((row) => row.id),
    modesOk,
    keysOk,
  });
  if (failed) {
    say(`\npg:init: FAILED at ${[...new Set(rec.failures.map((row) => row.id))].join(', ') || 'the file checks'}. The server is left running as evidence.`);
    return 1;
  }
  say(`\npg:init: done. The server is RUNNING on ${PG_HOST}:${PG_PORT} (PID ${started.pid}). Stop it with "npm run pg:stop".`);
  return 0;
});
