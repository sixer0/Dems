/**
 * Task 4 blueprint rows 44 and 159: A STAND-IN OF THE CORE for one relay. Test code only.
 *
 * It starts the capture relay with the Core's own code, imported read-only and unchanged:
 *   - `startCameraRelay` / `startCameraProbe` of apps/core-server/src/capture/adapters/camera/relay-start.ts
 *     (the ONE caller of the injection point), and
 *   - `startProductionProcess` of apps/core-server/src/capture/adapters/production-door.ts (the ONE file that
 *     starts a production program).
 *
 * So the relay is a child of a Node process, started with the door's own `spawn` call: no shell, no argument,
 * an empty environment, three pipes, the start message written by the door. Killing THIS process is "the parent
 * killed".
 *
 * THE TAP. The door keeps a bounded, blanked head of each output stream and nothing else. A search for a secret
 * must read what the relay really wrote, so `spawn` of node:child_process is wrapped BEFORE the door is loaded:
 * the wrapper calls the real `spawn` with the door's arguments unchanged and adds one more `data` listener to
 * the two output streams of the relay program (and of no other child). Nothing of the door's behaviour changes;
 * the listener is additive, as the door's own `onOutput` observer is.
 *
 * Protocol (standard input, one JSON line, then command lines; standard output, JSON lines):
 *   in   {"program","mode":"record"|"probe","locator","username","secret","ingest","attempt","args"?:[...]}
 *   in   end | kill | bound <ms> | quit
 *   out  {"ev":"spawned",...} {"ev":"pid",...} {"ev":"started",...} {"ev":"out"|"err"|"door_out","b":base64}
 *        {"ev":"bound"} {"ev":"ended",...}
 * The start values arrive on standard input, never as an argument or in the environment of this process. What an
 * error of the door says is sent whole to the driver, which keeps COUNTS of the run's texts in it and no text.
 *
 *     node --import tsx apps/capture-worker/test-fixtures/row044_door_parent.mts      (repository root)
 */
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspect } from 'node:util';

const require = createRequire(import.meta.url);
const emit = (o: Record<string, unknown>): void => {
  process.stdout.write(JSON.stringify(o) + '\n');
};

let program = '';
const cp = require('node:child_process') as typeof import('node:child_process');
const realSpawn = cp.spawn;
(cp as { spawn: unknown }).spawn = function (this: unknown, ...a: unknown[]) {
  const child = (realSpawn as (...x: unknown[]) => import('node:child_process').ChildProcess).apply(this, a);
  if (a[0] === program) {
    const o = (a[2] ?? {}) as { env?: Record<string, string>; shell?: unknown; detached?: unknown; stdio?: unknown };
    emit({
      ev: 'spawned',
      argument_count: Array.isArray(a[1]) ? a[1].length : -1,
      environment_given: o.env !== undefined,
      environment_keys: o.env === undefined ? -1 : Object.keys(o.env).length,
      shell: o.shell ?? null,
      detached: o.detached ?? null,
      stdio: o.stdio ?? null,
    });
    child.stdout?.on('data', (d: Buffer) => emit({ ev: 'out', b: d.toString('base64') }));
    child.stderr?.on('data', (d: Buffer) => emit({ ev: 'err', b: d.toString('base64') }));
  }
  return child;
};
syncBuiltinESMExports();

const CORE = resolve(import.meta.dirname, '..', '..', 'core-server', 'src', 'capture', 'adapters');
const load = async (file: string): Promise<Record<string, any>> => {
  const m = (await import(pathToFileURL(resolve(CORE, file)).href)) as Record<string, any>;
  return m.default && typeof m.default === 'object' && !('startProductionProcess' in m) && !('startCameraRelay' in m) && !('sealCredential' in m) ? m.default : m;
};

/** Everything an error could show, in every form a log line could take. The driver counts in it. */
function describe(e: unknown): Record<string, unknown> {
  const x = e as { name?: unknown; code?: unknown; message?: unknown; stack?: unknown; cause?: unknown };
  let json = '';
  try {
    json = JSON.stringify(e, Object.getOwnPropertyNames(Object(e)));
  } catch {
    json = '';
  }
  return {
    name: String(x?.name),
    code: String(x?.code),
    has_cause: x?.cause !== undefined,
    own_members: Object.getOwnPropertyNames(Object(e)).sort(),
    all_text: [String(x?.message), String(x?.stack), String(e), json, inspect(e, { depth: 8, showHidden: true }), String(x?.cause)].join('\n'),
  };
}

const timers = {
  after(ms: number, cb: () => void): () => void {
    const t = setTimeout(cb, ms);
    return () => clearTimeout(t);
  },
};

const lines = createInterface({ input: process.stdin });
let proc: import('../../core-server/src/capture/adapters/production-door').ProductionProcess | null = null;
let over = false;

// Integration pass I-9a: THE LIFE BOUND of this stand-in. Its driver ends a run after 300 s (and its watchdog 20 s
// later); a stand-in whose driver hangs with the pipe open would keep its relay - and the ports of the run - without
// end. After the bound it says so, kills the relay and ends with code 3. `ROW44_PARENT_BOUND_MS` may ask for LESS,
// never more. The timer does not keep a finished stand-in alive.
const LIFE_BOUND_MS = 330_000;
const askedBoundMs = Number(process.env['ROW44_PARENT_BOUND_MS']);
const lifeBoundMs = Number.isInteger(askedBoundMs) && askedBoundMs >= 1 && askedBoundMs < LIFE_BOUND_MS ? askedBoundMs : LIFE_BOUND_MS;
setTimeout(() => {
  emit({ ev: 'life_bound', ms: lifeBoundMs, alive: proc?.alive() ?? false });
  proc?.kill('SIGKILL');
  setTimeout(() => process.exit(3), 200);
}, lifeBoundMs).unref();

lines.on('line', (line: string) => {
  void (async () => {
    if (proc === null && !over && line.startsWith('{')) {
      const cfg = JSON.parse(line) as { program: string; mode: string; locator: string; username: string; secret: string; ingest: string; attempt: number; args?: string[] };
      program = cfg.program;
      const doorFile = await load('production-door.ts');
      const startFile = await load('camera/relay-start.ts');
      const credentialFile = await load('credential.ts');
      emit({ ev: 'core_file_limit', soft: String(doorFile.coreFileLimitOfThisProcess()) });
      const door = (o: Record<string, unknown>) => doorFile.startProductionProcess(cfg.args ? { ...o, args: cfg.args } : o);
      const sealed = credentialFile.sealCredential({ username: cfg.username, secret: cfg.secret });
      const common = { door, program: cfg.program, timers, locator: cfg.locator, sealed, attempt: cfg.attempt, onOutput: (d: Buffer) => emit({ ev: 'door_out', b: d.toString('base64') }) };
      try {
        proc = cfg.mode === 'probe' ? startFile.startCameraProbe(common) : startFile.startCameraRelay({ ...common, ingest: cfg.ingest, source: '127.0.0.1' }); // row 143b: a record start states the source address; every double of this Mac is on loopback
      } catch (e) {
        over = true;
        emit({ ev: 'threw', ...describe(e) });
        emit({ ev: 'ended', exitCode: null, signal: null, spawnFailed: true, diagnostics: '', output: '' });
        return;
      }
      const p = proc!;
      emit({ ev: 'pid', pid: p.pid });
      p.started.then(
        () => emit({ ev: 'started', ok: true }),
        (e: unknown) => emit({ ev: 'started', ok: false, ...describe(e) }),
      );
      void p.ended.then((x) => {
        over = true;
        emit({
          ev: 'ended',
          exitCode: x.exitCode,
          signal: x.signal,
          spawnFailed: x.spawnFailed,
          diagnostics: Buffer.from(x.diagnostics, 'utf8').toString('base64'),
          output: Buffer.from(x.output, 'utf8').toString('base64'),
        });
      });
      return;
    }
    const [word, value] = line.trim().split(' ');
    if (word === 'end') proc?.endInput();
    else if (word === 'kill') proc?.kill('SIGKILL');
    else if (word === 'bound')
      timers.after(Number(value), () => {
        emit({ ev: 'bound', alive: proc?.alive() ?? false });
        proc?.kill('SIGKILL');
      });
    else if (word === 'quit') process.exit(0);
  })();
});
// The driver went away: nothing of this run may stay.
lines.on('close', () => {
  proc?.kill('SIGKILL');
  setTimeout(() => process.exit(0), 200);
});
