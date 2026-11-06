// Shared code of the project-local PostgreSQL scripts (plan row W07; analysis TD-02;
// database contract sections 7.1 and 7.6).
//
// ISOLATION (decision D26, finding F27). Another PostgreSQL server, not this project's, listens
// on port 5432 of this host. Nothing in scripts/pg/ may ever reach it. Therefore:
//   - one fixed endpoint, 127.0.0.1:4432, checked by assertEndpoint() wherever a host or a port
//     is read from a file or a setting;
//   - every binary is called by its absolute path under node_modules, with the data directory
//     named explicitly;
//   - every libpq-style environment variable (prefix "PG") is removed before anything runs, so a
//     stray variable can never redirect a script;
//   - no Unix socket is used or created.
//
// SECRETS (P19, SD-15, CR-1 to CR-7). A password is generated here, written to a file of mode
// 0600 that is created exclusively, and never printed, never placed in a process argument and
// never placed in a child environment. run() and say() enforce the last three.

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PG_HOST = '127.0.0.1';
export const PG_PORT = 4432;
/** The default PostgreSQL port. On this host it belongs to a server that is not the project's. */
export const FOREIGN_PORT = 5432;

export const ROLE_ADMIN = 'dems_admin';
export const ROLE_OWNER = 'dems_owner';
export const ROLE_APP = 'dems_app';
export const DB_MAINTENANCE = 'postgres';
export const DB_MAIN = 'dems_demo';

/** The five keys of each connection file, in file order (02_plan 3.4; contract 7.6). */
export const OWNER_KEYS = Object.freeze([
  'DEMS_PG_HOST',
  'DEMS_PG_PORT',
  'DEMS_PG_DATABASE',
  'DEMS_PG_OWNER_ROLE',
  'DEMS_PG_OWNER_PASSWORD',
]);
export const APP_KEYS = Object.freeze([
  'DEMS_PG_HOST',
  'DEMS_PG_PORT',
  'DEMS_PG_DATABASE',
  'DEMS_PG_APP_ROLE',
  'DEMS_PG_APP_PASSWORD',
]);

/** The workspace root: scripts/pg/ is two levels below it. */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** The `name` of the root manifest; remove-data refuses any root that does not carry it. */
export const ROOT_PACKAGE_NAME = 'dems-demo';

export class PgScriptError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.name = 'PgScriptError';
    this.exitCode = exitCode;
  }
}

// ---------------------------------------------------------------------------------------------
// Environment: nothing that libpq, the server or the Node driver reads on its own survives.
// ---------------------------------------------------------------------------------------------

/** Removes every variable whose name starts with "PG" (host, port, user, database, password,
 *  service, password file, data directory, options, ...). Returns the removed NAMES. */
export function scrubPgEnv(env = process.env) {
  const removed = [];
  for (const name of Object.keys(env)) {
    if (/^PG[A-Z0-9_]*$/.test(name)) {
      delete env[name];
      removed.push(name);
    }
  }
  return removed.sort();
}

/** Names removed from this process's environment when the module loaded. */
export const SCRUBBED_ENV_NAMES = scrubPgEnv(process.env);

/** The environment handed to every child process: the current one, scrubbed again. */
export function childEnv() {
  const env = { ...process.env };
  scrubPgEnv(env);
  return env;
}

// ---------------------------------------------------------------------------------------------
// Endpoint guard
// ---------------------------------------------------------------------------------------------

/** Accepts exactly 127.0.0.1:4432 and nothing else. */
export function assertEndpoint(host, port) {
  const portNumber = typeof port === 'string' && /^[0-9]+$/.test(port) ? Number(port) : port;
  if (portNumber === FOREIGN_PORT) {
    throw new PgScriptError(
      `refused: port ${FOREIGN_PORT} is another PostgreSQL server on this host, not the project's. ` +
        `The project uses ${PG_HOST}:${PG_PORT} only.`,
    );
  }
  if (host !== PG_HOST) {
    throw new PgScriptError(
      `refused: host ${JSON.stringify(host ?? null)} is not ${PG_HOST}. The project listens on loopback IPv4 only.`,
    );
  }
  if (portNumber !== PG_PORT) {
    throw new PgScriptError(
      `refused: port ${JSON.stringify(port ?? null)} is not ${PG_PORT}. The project uses ${PG_HOST}:${PG_PORT} only.`,
    );
  }
  return { host: PG_HOST, port: PG_PORT };
}

// ---------------------------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------------------------

export function projectPaths(root = ROOT, overrides = {}) {
  const data = path.join(root, '.data');
  const bin = path.join(
    root,
    'node_modules',
    '@embedded-postgres',
    `${process.platform}-${process.arch}`,
    'native',
    'bin',
  );
  const locks = path.join(root, '.locks');
  return Object.freeze({
    root,
    data,
    pgdata: path.join(data, 'postgres'),
    serverLog: path.join(data, 'postgres.log'),
    scriptLog: path.join(data, 'pg-scripts.log'),
    pwfile: path.join(data, 'pg.pwfile'),
    ownerEnv: path.join(data, 'pg.owner.env'),
    appEnv: path.join(data, 'pg.env'),
    bin,
    initdb: path.join(bin, 'initdb'),
    pgCtl: path.join(bin, 'pg_ctl'),
    postgres: path.join(bin, 'postgres'),
    locks,
    pidFile: path.join(locks, 'postgres.pid'),
    lockFile: path.join(locks, 'postgres.lock'),
    npmLock: path.join(locks, 'npm.lock'),
    ...overrides,
  });
}

/** A path as shown to a person: relative to the workspace root when it lies inside it. */
export function rel(file, root = ROOT) {
  const r = path.relative(root, file);
  return r && !r.startsWith('..') && !path.isAbsolute(r) ? r : file;
}

export function hasCluster(paths) {
  return fs.existsSync(path.join(paths.pgdata, 'PG_VERSION'));
}

export function assertBinaries(paths) {
  for (const file of [paths.postgres, paths.initdb, paths.pgCtl]) {
    try {
      fs.accessSync(file, fs.constants.X_OK);
    } catch {
      throw new PgScriptError(
        `PostgreSQL binary not found or not executable: ${rel(file, paths.root)}. Run "npm install" first.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Secrets: registered values are never printed and never handed to a child process.
// ---------------------------------------------------------------------------------------------

const secrets = new Set();

export function registerSecret(value) {
  if (typeof value === 'string' && value.length >= 8) secrets.add(value);
  return value;
}

export function redact(text) {
  let out = String(text);
  for (const value of secrets) out = out.split(value).join('[redacted]');
  return out;
}

export function assertNoSecret(values, where) {
  for (const value of values) {
    for (const secret of secrets) {
      if (String(value).includes(secret)) {
        throw new PgScriptError(`refused: a secret would be placed in ${where} (CR-4)`);
      }
    }
  }
}

/** At least 24 random bytes as base64url (CR-5); 32 are used. */
export function newPassword() {
  return registerSecret(randomBytes(32).toString('base64url'));
}

export function say(line = '') {
  process.stdout.write(`${redact(line)}\n`);
}

// ---------------------------------------------------------------------------------------------
// Child processes
// ---------------------------------------------------------------------------------------------

/** Runs a command without a shell. Arguments and the child environment are checked for
 *  secrets first. Output is captured unless `inherit` is set. */
export function run(command, args, { cwd = ROOT, inherit = false, env = childEnv() } = {}) {
  assertNoSecret(args, 'a process argument');
  assertNoSecret(Object.values(env), 'a child environment');
  const r = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: inherit ? ['ignore', 'inherit', 'inherit'] : ['ignore', 'pipe', 'pipe'],
  });
  return {
    status: r.status,
    signal: r.signal,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    error: r.error ?? null,
  };
}

// ---------------------------------------------------------------------------------------------
// Credential files (contract 7.6)
// ---------------------------------------------------------------------------------------------

export function modeOf(file) {
  return fs.statSync(file).mode & 0o777;
}

/** CR-3: a credential file readable or writable by group or others stops the loader. The
 *  message names the file and the expected mode, never the content. */
export function assertPrivateMode(file, root = ROOT) {
  const mode = modeOf(file);
  if ((mode & 0o077) !== 0) {
    throw new PgScriptError(
      `${rel(file, root)} has mode ${mode.toString(8)}; expected 600 (no access for group or others). Nothing was read.`,
    );
  }
  return mode;
}

/** Creates a file exclusively with mode 0600. An existing file is never overwritten (CR-5). */
export function writeSecretFile(file, content) {
  fs.writeFileSync(file, content, { mode: 0o600, flag: 'wx' });
  fs.chmodSync(file, 0o600);
}

export function connectionFileText(keys, values) {
  return `${keys.map((key, i) => `${key}=${values[i]}`).join('\n')}\n`;
}

/** Reads the one-line password file of the bootstrap superuser. Only init.mjs and
 *  check-superuser-trigger.mjs call this (provisioning only; contract 7.1 HC-1, 7.6). */
export function readPwfile(file, root = ROOT) {
  assertPrivateMode(file, root);
  const first = fs.readFileSync(file, 'utf8').split('\n')[0];
  if (!first) throw new PgScriptError(`${rel(file, root)} is empty`);
  return registerSecret(first);
}

/** Reads a connection file: plain KEY=value lines, exactly the five keys given, nothing else
 *  (CR-1, CR-2). Errors name the file and a key, never a value. */
export function readConnectionFile(file, keys, root = ROOT) {
  assertPrivateMode(file, root);
  const name = rel(file, root);
  const found = new Map();
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (line === '') return;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match) throw new PgScriptError(`${name}: line ${index + 1} is not KEY=value`);
    const [, key, value] = match;
    if (!keys.includes(key)) throw new PgScriptError(`${name}: unexpected key ${key}`);
    if (found.has(key)) throw new PgScriptError(`${name}: key ${key} appears twice`);
    found.set(key, value);
  });
  for (const key of keys) {
    if (!found.get(key)) throw new PgScriptError(`${name}: key ${key} is missing or empty`);
  }
  const [hostKey, portKey, databaseKey, roleKey, passwordKey] = keys;
  const { host, port } = assertEndpoint(found.get(hostKey), found.get(portKey));
  return {
    host,
    port,
    database: found.get(databaseKey),
    user: found.get(roleKey),
    password: registerSecret(found.get(passwordKey)),
  };
}

/** The key NAMES of a connection file, for the key-name check of AC-B-86. No value leaves. */
export function connectionFileKeys(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => {
      const i = line.indexOf('=');
      return i > 0 ? line.slice(0, i) : '(not KEY=value)';
    });
}

/** T-CR-1: prints the mode of .data/, of the cluster directory, of the three credential files
 *  and of the log files. Returns false when one differs from 700 / 600. */
export function reportModes(paths) {
  let ok = true;
  const expect = (file, mode) => {
    if (!fs.existsSync(file)) return;
    const actual = modeOf(file);
    if (actual !== mode) ok = false;
    say(`  ${actual.toString(8)}  ${rel(file, paths.root)}${actual === mode ? '' : `   <-- expected ${mode.toString(8)}`}`);
  };
  expect(paths.data, 0o700);
  expect(paths.pgdata, 0o700);
  for (const file of [paths.pwfile, paths.ownerEnv, paths.appEnv, paths.serverLog, paths.scriptLog]) expect(file, 0o600);
  return ok;
}

/** AC-B-86: prints the key NAMES of the two connection files. Returns false when they are not
 *  exactly the five pinned keys. */
export function reportKeyNames(paths) {
  let ok = true;
  for (const [file, keys] of [[paths.ownerEnv, OWNER_KEYS], [paths.appEnv, APP_KEYS]]) {
    const names = connectionFileKeys(file);
    const same = names.length === keys.length && names.every((name, i) => name === keys[i]);
    if (!same) ok = false;
    say(`  ${rel(file, paths.root)}: ${names.join(', ')}${same ? '' : '   <-- not the five pinned keys'}`);
  }
  return ok;
}

// ---------------------------------------------------------------------------------------------
// Server settings and state, read from files (no connection needed)
// ---------------------------------------------------------------------------------------------

/** Parses postgresql.conf and then postgresql.auto.conf; the last assignment wins, as in the
 *  server. An include directive stops the read: the result could not be trusted. */
export function readSettings(pgdata) {
  const settings = new Map();
  for (const file of ['postgresql.conf', 'postgresql.auto.conf']) {
    let text;
    try {
      text = fs.readFileSync(path.join(pgdata, file), 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT' && file === 'postgresql.auto.conf') continue;
      throw error;
    }
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (line === '' || line.startsWith('#')) continue;
      const match = /^([A-Za-z_][A-Za-z0-9_.]*)\s*(?:=\s*|\s+)(?:'((?:[^']|'')*)'|([^\s#']*))\s*(?:#.*)?$/.exec(line);
      if (!match) throw new PgScriptError(`${file}: cannot read the line "${line}"`);
      const key = match[1].toLowerCase();
      if (key === 'include' || key === 'include_if_exists' || key === 'include_dir') {
        throw new PgScriptError(`${file}: the directive ${key} is not allowed in the project cluster`);
      }
      settings.set(key, match[2] !== undefined ? match[2].replaceAll("''", "'") : match[3]);
    }
  }
  return settings;
}

/** The configuration files must name 127.0.0.1:4432 and no Unix socket. */
export function assertClusterEndpoint(pgdata) {
  const settings = readSettings(pgdata);
  assertEndpoint(settings.get('listen_addresses'), settings.get('port'));
  if (settings.get('unix_socket_directories') !== '') {
    throw new PgScriptError(
      "refused: unix_socket_directories must be '' (no Unix socket; nothing outside the project).",
    );
  }
  return settings;
}

/** postmaster.pid: line 1 PID, 4 port, 5 socket directory, 6 first listen address, 8 status. */
export function readPostmasterPid(pgdata) {
  let text;
  try {
    text = fs.readFileSync(path.join(pgdata, 'postmaster.pid'), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  const line = text.split('\n');
  return {
    pid: Number(line[0]),
    dataDir: line[1] ?? '',
    port: Number(line[3]),
    socketDir: (line[4] ?? '').trim(),
    listenAddr: (line[5] ?? '').trim(),
    status: (line[7] ?? '').trim(),
  };
}

/** True when the process exists. EPERM also means "exists" (seen from inside a sandbox). */
export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

/** 'open' | 'closed' | 'timeout' | 'error:<code>'. Sees a listener of any user, which lsof
 *  does not (lsof lists this user's processes only: the reason step 28 needed netstat). */
export function probeTcp(timeoutMs = 1500) {
  const { host, port } = assertEndpoint(PG_HOST, PG_PORT);
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs, () => done('timeout'));
    socket.once('connect', () => done('open'));
    socket.once('error', (error) => done(error.code === 'ECONNREFUSED' ? 'closed' : `error:${error.code}`));
  });
}

/** `lsof -nP -iTCP:4432 -sTCP:LISTEN`: the listener lines (without the header). */
export function lsofListen() {
  const r = run('/usr/sbin/lsof', ['-nP', `-iTCP:${PG_PORT}`, '-sTCP:LISTEN']);
  const lines = r.stdout.split('\n').filter((line) => line !== '' && !line.startsWith('COMMAND'));
  return { available: r.error === null, lines };
}

export function tail(file, count) {
  try {
    return fs.readFileSync(file, 'utf8').trimEnd().split('\n').slice(-count).join('\n');
  } catch {
    return '(no log file)';
  }
}

// ---------------------------------------------------------------------------------------------
// The scripts' own log: JSON lines in .data/pg-scripts.log, mode 0600. It lives and dies with
// .data/ (CR-6) and is not written while .data/ does not exist.
// ---------------------------------------------------------------------------------------------

const RUN_ID = randomBytes(4).toString('hex');
const SCRIPT_LOG_MAX_BYTES = 1024 * 1024;

export function logEvent(paths, level, source, message, context = {}, error = null) {
  try {
    if (!fs.existsSync(paths.data)) return;
    try {
      if (fs.statSync(paths.scriptLog).size > SCRIPT_LOG_MAX_BYTES) {
        fs.renameSync(paths.scriptLog, `${paths.scriptLog}.1`);
      }
    } catch {
      // no log yet
    }
    const row = {
      timestamp: new Date().toISOString(),
      level,
      source,
      message: redact(message),
      stack_trace: error?.stack ? redact(error.stack) : undefined,
      context: JSON.parse(redact(JSON.stringify(context))),
      correlation_id: RUN_ID,
    };
    fs.appendFileSync(paths.scriptLog, `${JSON.stringify(row)}\n`, { mode: 0o600 });
    fs.chmodSync(paths.scriptLog, 0o600);
  } catch {
    // The log must never be the reason a lifecycle command fails.
  }
}

// ---------------------------------------------------------------------------------------------
// Command plumbing
// ---------------------------------------------------------------------------------------------

export function isMain(metaUrl) {
  return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(metaUrl);
}

/** Start, stop, init and removal are serialised by .locks/postgres.lock (02_plan 4.1): the
 *  script runs itself again under /usr/bin/lockf, which keeps the lock file (-k). */
export function underLock(metaUrl, paths, timeoutSeconds = 120) {
  if (process.env.DEMS_PG_LOCK_HELD === '1') return;
  fs.mkdirSync(paths.locks, { recursive: true });
  const r = spawnSync(
    '/usr/bin/lockf',
    ['-k', '-t', String(timeoutSeconds), paths.lockFile, process.execPath, fileURLToPath(metaUrl), ...process.argv.slice(2)],
    { stdio: 'inherit', env: { ...process.env, DEMS_PG_LOCK_HELD: '1' } },
  );
  if (r.error) throw new PgScriptError(`cannot take ${rel(paths.lockFile, paths.root)}: ${r.error.message}`);
  process.exit(r.status ?? 1);
}

/** Runs `fn` when the file is the entry point. The exit code is fn's return value, or the
 *  error's exit code. Every failure goes to stderr and to the scripts' log.
 *  A command never acts when the Node test runner executes its file: it stops here, before
 *  `fn`, and writes nothing. */
export async function main(metaUrl, name, fn, paths = projectPaths()) {
  if (!isMain(metaUrl)) return;
  if (process.env.NODE_TEST_CONTEXT) {
    process.stderr.write(`${name} does not run under the test runner\n`);
    process.exitCode = 1;
    return;
  }
  try {
    process.exitCode = (await fn(process.argv.slice(2), paths)) ?? 0;
  } catch (error) {
    const text = error instanceof PgScriptError ? error.message : (error?.stack ?? String(error));
    process.stderr.write(`${redact(`${name}: ${text}`)}\n`);
    logEvent(paths, 'error', name, error?.message ?? String(error), { argv: process.argv.slice(2) }, error);
    process.exitCode = error?.exitCode ?? 1;
  }
}
