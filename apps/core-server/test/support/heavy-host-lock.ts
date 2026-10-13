/**
 * THE HEAVY-HOST LOCK FOR A TEST CASE (task 4 row T3; review 060c T-01; decisions C61 (4), C98).
 *
 * A case that starts the capture worker, the relay or the test camera holds `.locks/heavy-host.lock` WHILE IT RUNS,
 * and only then: a full database run is started under the database lock alone, two files of it run side by side, and
 * the worker's fixtures of another session use the same loopback ports (worker listeners 8559-8564, test cameras
 * 8565-8574). The lock is the repository's one - `/usr/bin/lockf -k` on that file - so a case waits for a fixture run
 * and a fixture run waits for a case.
 *
 * Moved here from `src/modules/capture-config/__tests__/camera-adapter-open.db.test.ts` (integration pass I-9a), where
 * two cases used it; the four database files that start a camera double now share this one copy.
 *
 * - A run that was started under the lock already (the RUN line of a file's header) is not asked to take it again.
 * - Taking it twice in one test process is one hold: a block that holds it in its `beforeAll` may contain cases that
 *   ask for it themselves.
 * - The holder is a child whose standard input is this process: when the test process ends, however it ends, the
 *   holder reads the end of its input and the lock is free.
 *
 * Not a test file. It is imported by test files only.
 */
import { execFileSync, spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { it } from 'vitest';

const REPOSITORY = resolve(__dirname, '../../../..');
export const HEAVY_HOST_LOCK = join(REPOSITORY, '.locks/heavy-host.lock');
/** How long a case waits for the lock, in seconds. */
export const HEAVY_HOST_LOCK_WAIT_S = 900;
/** The same in milliseconds: what the timeout of a case or a hook that takes the lock is longer by. */
export const HEAVY_HOST_LOCK_WAIT_MS = HEAVY_HOST_LOCK_WAIT_S * 1_000;

let callerHolds: boolean | null = null;

/** True when an ancestor of this process is `lockf` on the heavy-host lock. Asked of the system once per process. */
export function heavyHostHeldByCaller(): boolean {
  if (callerHolds !== null) return callerHolds;
  callerHolds = false;
  let pid = process.pid;
  for (let depth = 0; depth < 16 && pid > 1; depth += 1) {
    let line: string;
    try {
      line = execFileSync('/bin/ps', ['-o', 'ppid=,command=', '-p', String(pid)], { encoding: 'utf8' }).trim();
    } catch {
      break;
    }
    const match = /^(\d+)\s+([\s\S]*)$/.exec(line);
    if (match === null) break;
    const command = match[2] ?? '';
    if (/(?:^|\/)lockf\s/.test(command) && command.includes('heavy-host.lock')) {
      callerHolds = true;
      break;
    }
    pid = Number(match[1]);
  }
  return callerHolds;
}

/** How many holds of this process are open, and how the one holder is let go. */
let holds = 0;
let letGo: (() => Promise<void>) | null = null;
/** How often this process took the lock from the system (not: found it held). For a test of the helper. */
let taken = 0;
export const heavyHostLockTakenCount = (): number => taken;

/**
 * Takes the heavy-host lock and answers the function that releases it. Throws when the lock was not obtained within
 * its wait: nothing may be started then.
 */
export async function takeHeavyHostLock(): Promise<() => Promise<void>> {
  let released = false;
  const release = async (): Promise<void> => {
    if (released) return;
    released = true;
    holds -= 1;
    if (holds === 0 && letGo !== null) {
      const ending = letGo;
      letGo = null;
      await ending();
    }
  };
  if (holds > 0 || heavyHostHeldByCaller()) {
    holds += 1;
    return release;
  }
  // The holder says one word once `lockf` has the lock, then waits for the end of its input.
  const holder = spawn('/usr/bin/lockf', ['-k', '-t', String(HEAVY_HOST_LOCK_WAIT_S), HEAVY_HOST_LOCK, '/bin/sh', '-c', 'echo held; exec cat'], { stdio: ['pipe', 'pipe', 'pipe'] });
  holder.stderr.resume();
  holder.stdin.on('error', () => undefined);
  // Counted before the wait: a second caller of this process (there is none today: a file runs its cases in order) would join this hold.
  holds += 1;
  const held = await new Promise<boolean>((done) => {
    holder.stdout.once('data', () => done(true));
    holder.once('exit', () => done(false));
    holder.once('error', () => done(false));
  });
  if (!held) {
    holds -= 1;
    throw new Error('the heavy-host lock was not obtained within its wait: nothing was started');
  }
  taken += 1;
  letGo = async () => {
    if (holder.exitCode !== null || holder.signalCode !== null) return;
    const ended = new Promise<void>((done) => holder.once('exit', () => done()));
    holder.stdin.end();
    await ended;
  };
  return release;
}

/** Runs `body` while this process holds the heavy-host lock; the lock is released when `body` ends, however it ends. */
export async function underHeavyHostLock<T>(body: () => Promise<T>): Promise<T> {
  const release = await takeHeavyHostLock();
  try {
    return await body();
  } finally {
    await release();
  }
}

/**
 * `it` for a case that starts the worker, the relay or the test camera: the body runs under the heavy-host lock, and
 * the timeout the case states is its own - the wait for the lock is added here.
 */
export function itUnderHeavyHostLock(name: string, body: () => Promise<void>, timeoutMs: number): void {
  it(name, () => underHeavyHostLock(body), timeoutMs + HEAVY_HOST_LOCK_WAIT_MS);
}
