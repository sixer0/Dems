/**
 * The process door of the PRODUCTION programs (task 4 blueprint row 21, work package WP-02; design
 * addendum 2.3 step 4; decision text SR-1; security S13-02 (b) (d), AD-03 point 6, AD-09 point 3,
 * BR-07 (4); review verdict on WP-02: a second pinned door, standard input kept open).
 *
 * THIS IS THE ONE FILE THAT STARTS A PRODUCTION PROGRAM: the relay of a camera, the guard, the
 * audio helper on Linux. The door of the local-device helpers (`local/process-door.ts`) closes the
 * child's standard input and is development code; it is not edited and not reused. This door
 * follows its rules and adds what a program that takes a secret needs:
 *   - no shell: the program is executed directly, by an absolute path, with an argument list;
 *   - the child's environment is built HERE from a closed list of keys
 *     (`PRODUCTION_ENVIRONMENT_KEYS`); a key outside it is a refusal, and nothing of the server's
 *     own environment is handed over;
 *   - the START MESSAGE goes to the child's standard input and nowhere else. This door makes its
 *     bytes with the one serialiser (`startMessageBytes` of `credential.ts`), writes them, and
 *     zero-fills them when the write has completed, failed or run into its bound. It makes no text
 *     of them, puts none of them in an argument, the environment, an error or a log line;
 *   - the write is BOUNDED: a child that does not take the message within `writeBoundMs` is killed;
 *   - standard input STAYS OPEN after the message. Its end is the child's order to stop
 *     (`endInput`), and it ends by itself when the server process ends: the same liveness rule on
 *     macOS and Linux;
 *   - a child is started only when the server's own core-file limit is 0, because a child
 *     inherits it (AD-09): a dump of a process that holds a credential is never written;
 *   - standard output and standard error are read into bounded buffers (64 KiB each; a caller may
 *     name another cap for its call, at most 1 MiB - row N5b), are never logged, and what is handed
 *     on has the user part of every locator blanked (S13-02 (b));
 *   - on a caller's ask (`processGroup`, row N5b) the child leads a process group of its own and every
 *     signal of the door goes to that group, so a descendant it forked dies with it. Without the ask
 *     the door signals its own child only, as it always did;
 *   - standard error can also be handed on LINE BY LINE while the child runs (`onDiagnostics`,
 *     masterplan 06 section 4.6, SM-12 (3), SM-35 (7)): bounded per line, per second and per life
 *     of the child, every byte that is not printable ASCII replaced, the user part of a locator
 *     blanked, nothing of a line kept here. Without that observer nothing of this file changes;
 *   - a refusal is a code (`ProductionDoorRefusal`) with a fixed sentence: no part of the message,
 *     of the argument list or of the system's error text is in it;
 *   - every child is waited for (`ended` settles when it has ended and its streams are closed), a
 *     child of a refused start is killed, and every live child is killed when the server exits.
 *
 * It knows nothing about cameras or sound cards: which program, which arguments, what a line of
 * output or an exit means, and the bound within which a stopped child must have ended are the
 * caller's.
 */
import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';
import type { CaptureTimers } from '../types';
import { blankCredentialLocators, startMessageBytes, type StartMessage } from './credential';

/** How much of each output stream is kept. What comes after is read and dropped. */
export const PRODUCTION_OUTPUT_CAP_BYTES = 64 * 1024;

/**
 * The most a caller may ask the door to keep of each output stream for ONE call (`outputCapBytes`;
 * task 4 row N5b, decision C131 (2)). An ask above it, or one that is not a whole number of at least 1,
 * starts nothing (`OUTPUT_CAP_NOT_ALLOWED`): what a child can make this process hold stays bounded.
 */
export const PRODUCTION_OUTPUT_CAP_MAX_BYTES = 1024 * 1024;

/** How long the child has to take the start message before it is killed. */
export const START_MESSAGE_WRITE_BOUND_MS = 5_000;

/**
 * THE THREE BOUNDS of the observer of standard error (`onDiagnostics`). They are fixed here: a
 * caller cannot raise them.
 *   - per LINE: a line is handed on with at most this many characters. A longer one is handed on
 *     ONCE, cut at the bound and marked `cut`; the rest of it is read past, unread, to its end.
 *   - per SECOND: at most this many lines are handed on in one second (the second starts with its
 *     first line). The lines over it are not read, only counted, and the count is handed on when
 *     the second ends.
 *   - per LIFE of the child: after this many lines the observer says `quiet` ONCE and reads
 *     nothing more of this child. At most LIFE x LINE characters are ever handed on.
 */
export const PRODUCTION_DIAGNOSTICS_LINE_CHARS = 512;
export const PRODUCTION_DIAGNOSTICS_LINES_PER_SECOND = 200;
export const PRODUCTION_DIAGNOSTICS_LIFE_LINES = 20_000;

/** The length of the second of the bound above, on the timers of the capture unit. */
export const PRODUCTION_DIAGNOSTICS_SECOND_MS = 1_000;
/** How many lines may wait for the observer. One more is dropped and counted, as a line over the rate is. */
const DIAGNOSTICS_WAITING_LINES = PRODUCTION_DIAGNOSTICS_LINES_PER_SECOND;
/** How many waiting events the observer is told in one turn of the event loop, before the streams are read again. */
const DIAGNOSTICS_EVENTS_PER_TURN = 8;

/**
 * The keys a production program may be started with. A closed list: another key is a decision.
 * `ALSA_CONFIG_PATH` names the sound configuration the Core writes under its run directory for
 * the audio helper. Its value is an absolute path; it is never a secret.
 */
export const PRODUCTION_ENVIRONMENT_KEYS = Object.freeze(['ALSA_CONFIG_PATH'] as const);
export type ProductionEnvironmentKey = (typeof PRODUCTION_ENVIRONMENT_KEYS)[number];
export type ProductionEnvironment = Readonly<Partial<Record<ProductionEnvironmentKey, string>>>;

export const ProductionDoorRefusal = {
  /** The program is not an absolute path: nothing is looked up on a search path. */
  PROGRAM_NOT_ABSOLUTE: 'PRODUCTION_PROGRAM_NOT_ABSOLUTE',
  /** A key outside the closed list, or a value that is not an absolute path. */
  ENVIRONMENT_NOT_ALLOWED: 'PRODUCTION_ENVIRONMENT_NOT_ALLOWED',
  /** The server's own core-file limit is not 0, or cannot be read: a child would inherit it. */
  CORE_FILE_LIMIT_NOT_ZERO: 'PRODUCTION_CORE_FILE_LIMIT_NOT_ZERO',
  /** The serialiser refused the start message. */
  START_MESSAGE_INVALID: 'PRODUCTION_START_MESSAGE_INVALID',
  /** The program could not be started at all. */
  PROGRAM_NOT_STARTED: 'PRODUCTION_PROGRAM_NOT_STARTED',
  /** The child ended, or closed its standard input, before it had taken the whole start message. */
  START_MESSAGE_NOT_TAKEN: 'PRODUCTION_START_MESSAGE_NOT_TAKEN',
  /** The child did not take the start message within the bound. It was killed. */
  START_MESSAGE_TIMEOUT: 'PRODUCTION_START_MESSAGE_TIMEOUT',
  /** Row N5b: the cap asked for this call is not a whole number from 1 to `PRODUCTION_OUTPUT_CAP_MAX_BYTES`. Nothing is started. */
  OUTPUT_CAP_NOT_ALLOWED: 'PRODUCTION_OUTPUT_CAP_NOT_ALLOWED',
} as const;
export type ProductionDoorRefusal = (typeof ProductionDoorRefusal)[keyof typeof ProductionDoorRefusal];

const TEXT: Readonly<Record<ProductionDoorRefusal, string>> = Object.freeze({
  PRODUCTION_PROGRAM_NOT_ABSOLUTE: 'a production program is started by an absolute path',
  PRODUCTION_ENVIRONMENT_NOT_ALLOWED: 'a production program is started with the listed environment keys only',
  PRODUCTION_CORE_FILE_LIMIT_NOT_ZERO: 'no production program is started while the core-file limit of the server is not 0',
  PRODUCTION_START_MESSAGE_INVALID: 'the start message could not be made into bytes',
  PRODUCTION_PROGRAM_NOT_STARTED: 'the production program could not be started',
  PRODUCTION_START_MESSAGE_NOT_TAKEN: 'the production program ended before it had taken its start message',
  PRODUCTION_START_MESSAGE_TIMEOUT: 'the production program did not take its start message in time',
  PRODUCTION_OUTPUT_CAP_NOT_ALLOWED: 'a production program is started with an output cap of 1 byte to 1 MiB only',
});

/** A refusal of the door: a code and its fixed sentence. It has no cause and names no value. */
export class ProductionDoorError extends Error {
  readonly code: ProductionDoorRefusal;
  constructor(code: ProductionDoorRefusal) {
    super(TEXT[code]);
    this.name = 'ProductionDoorError';
    this.code = code;
  }
}

/** The soft core-file limit of the server process in blocks (`Infinity`: unlimited), or null when it cannot be read. */
export type CoreFileLimitReader = () => number | null;

let knownCoreFileLimit: number | null | undefined;

/**
 * Reads the limit from the runtime's own report of the process, in memory: no file, no program.
 * Read once: the runtime has no call that changes a limit of its own process. The network part of
 * the report is left out for this one reading, so that no name lookup is made for it.
 */
export const coreFileLimitOfThisProcess: CoreFileLimitReader = () => {
  if (knownCoreFileLimit !== undefined) return knownCoreFileLimit;
  let limit: number | null = null;
  const report = process.report as unknown as { excludeNetwork?: boolean; getReport(): unknown } | undefined;
  if (report !== undefined) {
    const before = report.excludeNetwork;
    try {
      report.excludeNetwork = true;
      const limits = (report.getReport() as { userLimits?: { core_file_size_blocks?: { soft?: unknown } } }).userLimits;
      const soft = limits?.core_file_size_blocks?.soft;
      if (typeof soft === 'number' && Number.isFinite(soft) && soft >= 0) limit = soft;
      else if (soft === 'unlimited') limit = Number.POSITIVE_INFINITY;
    } catch {
      limit = null;
    } finally {
      report.excludeNetwork = before;
    }
  }
  knownCoreFileLimit = limit;
  return limit;
};

export interface ProductionProcessOptions {
  /** The program: an absolute path. */
  readonly command: string;
  /** Its whole argument list. Never a member of the start message. */
  readonly args: readonly string[];
  /** The child's whole environment, of the listed keys. Default: empty. */
  readonly env?: ProductionEnvironment;
  /** The start message, or null for a program that takes none. Its standard input stays open either way. */
  readonly message: StartMessage | null;
  /** The timers of the capture unit: the bound of the write. */
  readonly timers: CaptureTimers;
  /** Default: `START_MESSAGE_WRITE_BOUND_MS`. */
  readonly writeBoundMs?: number;
  /** Default: the limit of this process. A test passes a fixed answer. */
  readonly coreFileLimit?: CoreFileLimitReader;
  /** Told every chunk of standard output as it arrives, beside the bounded copy. The observer must not throw. */
  readonly onOutput?: (chunk: Buffer) => void;
  /**
   * Told standard error LINE BY LINE while the child runs, beside the bounded head of
   * `ProductionExit.diagnostics`, within the three bounds above. Optional: without it the door
   * reads standard error exactly as before and asks for no timer.
   *
   * The text is the child's, and a device may have chosen part of it (a device NAME can stand in a
   * line): the door has made it harmless to print and has blanked a locator's user part, and it
   * neither keeps nor logs it. What is kept of a line is the reader's decision (AD-06).
   *
   * The observer is told in a LATER turn than the one that read the bytes, a few events per turn,
   * and what it returns is not waited for: the stream is never paused for it. It may throw or
   * return a promise that rejects; neither reaches the door. It is told nothing after `ended`.
   * The second of the rate bound runs on `timers`: timers that never fire never open a new second.
   */
  readonly onDiagnostics?: (event: ProductionDiagnosticsEvent) => void;
  /**
   * Task 4 row N5b (decision C131 (2)): how many bytes of EACH output stream are kept for this call.
   * Default `PRODUCTION_OUTPUT_CAP_BYTES` (64 KiB), the cap of every caller that names none. A whole
   * number from 1 to `PRODUCTION_OUTPUT_CAP_MAX_BYTES` (1 MiB); anything else starts nothing and is
   * `OUTPUT_CAP_NOT_ALLOWED`. The bounds of the observer of standard error do not change with it.
   */
  readonly outputCapBytes?: number;
  /**
   * Task 4 row N5b (decision C131 (3), review SM-10 (3)): `true` starts the child as the leader of a
   * process group of its own (a new session) and sends EVERY signal of the door - `kill`, the kill of
   * a refused start, the kill at the server's exit - to that group, so that a descendant the program
   * forked is ended with it. Only the group the child leads is ever signalled. Default: the child is
   * started in the server's group and the door signals the child alone, as before.
   */
  readonly processGroup?: boolean;
}

/** What the observer of standard error is told. */
export type ProductionDiagnosticsEvent =
  /** One line without its line end: printable ASCII only, at most `PRODUCTION_DIAGNOSTICS_LINE_CHARS` characters. `cut`: the line was longer. */
  | { readonly kind: 'line'; readonly text: string; readonly cut: boolean }
  /** This many lines were NOT handed on since the last event of this kind: over the rate of their second, or more than may wait. */
  | { readonly kind: 'dropped'; readonly lines: number }
  /** Said once: the bound of the child's life is spent, and nothing more of this child is read for the observer. */
  | { readonly kind: 'quiet' };

export interface ProductionExit {
  readonly exitCode: number | null;
  readonly signal: string | null;
  /** True when no process ever existed. */
  readonly spawnFailed: boolean;
  /** The head of standard error, at most `PRODUCTION_OUTPUT_CAP_BYTES` (or the call's `outputCapBytes`), user parts blanked. For classification only. */
  readonly diagnostics: string;
  /** The head of standard output, with the same bound and the same blanking. */
  readonly output: string;
}

export interface ProductionProcess {
  readonly pid: number | null;
  /**
   * Resolves when the whole start message has left this process (at once for a program without
   * one). Rejects with a `ProductionDoorError`; the child of a rejected start is killed.
   */
  readonly started: Promise<void>;
  /** Settles once, when the process has ended and its streams are closed. Never rejects. */
  readonly ended: Promise<ProductionExit>;
  /** True until the process has ended. */
  alive(): boolean;
  /** Ends the child's standard input: its order to stop. */
  endInput(): void;
  kill(signal: 'SIGTERM' | 'SIGKILL'): void;
}

/** Starts a production program. Used through this type, so that a test passes a door that starts nothing. */
export type ProductionDoor = (options: ProductionProcessOptions) => ProductionProcess;

/** `capBytes`: the call's cap, already held to 1 byte to `PRODUCTION_OUTPUT_CAP_MAX_BYTES` (row N5b). */
function boundedText(capBytes: number): { push(chunk: Buffer): void; text(): string } {
  const kept: Buffer[] = [];
  let size = 0;
  return {
    push(chunk) {
      if (size >= capBytes) return;
      const part = chunk.subarray(0, capBytes - size);
      kept.push(part);
      size += part.length;
    },
    text: () => blankCredentialLocators(Buffer.concat(kept).toString('utf8')),
  };
}

/** Each byte as one character that is harmless to print: printable ASCII as it is, a tab as a space, every other byte as `?`. */
const HARMLESS: string = (() => {
  let all = '';
  for (let byte = 0; byte < 256; byte += 1) all += byte === 0x09 ? ' ' : byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '?';
  return all;
})();

/**
 * A locator that the cut of a line went through: its scheme and what follows it, with no `@` and no slash yet. A user part may be in it.
 *
 * LINEAR (row N5c, decision C138): the form of `USER_PART` in `credential.ts`, anchored at the end - a
 * match starts only where a run of scheme characters starts, and the group takes the run's leading
 * digits and signs (same output as the form before, `([a-z][a-z0-9+.-]*:\/\/)...$`, which was
 * quadratic in a run of letters: 64 KiB about 2.7 s; the cut line is at most
 * `PRODUCTION_DIAGNOSTICS_LINE_CHARS`, so the cost before was 0.2 ms, but the form no longer depends on that bound).
 */
const LOCATOR_OPEN_AT_CUT = /(?<![a-z0-9+.-])([0-9+.-]*[a-z][a-z0-9+.-]*:\/\/)[^/\s'"<>@]*$/i;

/** Takes off what of a locator is left open at the cut of a line (its scheme is kept). Exported for its own test (row N5c). */
export function takeOffLocatorOpenAtCut(text: string): string {
  return text.replace(LOCATOR_OPEN_AT_CUT, '$1');
}

/**
 * The observer of standard error (see `onDiagnostics`). `push` is given every chunk in the turn
 * that read it and does bounded work on it: it never calls the observer. `end` is called once,
 * when the child has ended and its streams are closed: what still waits is told then, and nothing
 * after it.
 *
 * What bounds it: a line being read holds at most LINE characters; the bytes of a line that will
 * not be handed on (the rest of a cut line, a line over the rate) are searched for their line end
 * and never made into text; at most WAITING lines wait; a child whose life is spent is not read
 * for the observer at all. A line ends at a line feed or a carriage return; an empty line is not
 * a line.
 */
function diagnosticsObserver(tell: (event: ProductionDiagnosticsEvent) => void, timers: CaptureTimers): { push(chunk: Buffer): void; end(): void } {
  const waiting: ProductionDiagnosticsEvent[] = [];
  let waitingLines = 0;
  let line = '';
  /** The rest of the line being read is read past; `skippedCounts`: it is a dropped line when it ends. */
  let skipping = false;
  let skippedCounts = false;
  let inSecond = 0;
  let dropped = 0;
  let handedOn = 0;
  let quiet = false;
  let closed = false;
  let cancelSecond: (() => void) | null = null;
  let cancelTurn: (() => void) | null = null;

  const say = (event: ProductionDiagnosticsEvent): void => {
    try {
      const told: unknown = tell(event);
      // Not waited for. A promise that rejects is answered here, so that it is never an unhandled rejection of the server.
      if (told instanceof Promise) told.catch(() => {});
    } catch {
      // An observer never stops the door.
    }
  };
  /** A few events, then the event loop reads the streams again: an observer that is slow holds one turn, not the pipe. */
  const turn = (): void => {
    cancelTurn = null;
    for (let told = 0; told < DIAGNOSTICS_EVENTS_PER_TURN; told += 1) {
      const event = waiting.shift();
      if (event === undefined) return;
      if (event.kind === 'line') waitingLines -= 1;
      say(event);
    }
    if (waiting.length > 0) wake();
  };
  const wake = (): void => {
    if (cancelTurn === null && !closed) cancelTurn = timers.after(0, turn);
  };
  /** The count of the lines not handed on, as one event; added to the last one when that still waits. */
  const stateDropped = (): void => {
    if (dropped === 0) return;
    const last = waiting.at(-1);
    if (last !== undefined && last.kind === 'dropped') waiting[waiting.length - 1] = { kind: 'dropped', lines: last.lines + dropped };
    else waiting.push({ kind: 'dropped', lines: dropped });
    dropped = 0;
    wake();
  };
  const openSecond = (): void => {
    if (cancelSecond !== null) return;
    cancelSecond = timers.after(PRODUCTION_DIAGNOSTICS_SECOND_MS, () => {
      cancelSecond = null;
      inSecond = 0;
      stateDropped();
    });
  };
  const full = (): boolean => inSecond >= PRODUCTION_DIAGNOSTICS_LINES_PER_SECOND || waitingLines >= DIAGNOSTICS_WAITING_LINES;
  const drop = (): void => {
    openSecond();
    dropped += 1;
  };
  const admit = (text: string, cut: boolean): void => {
    if (full()) {
      drop();
      return;
    }
    openSecond();
    inSecond += 1;
    handedOn += 1;
    waitingLines += 1;
    // A cut can go through a locator before its `@`: what is left open at the cut is taken off, then every whole user part is blanked.
    waiting.push({ kind: 'line', text: blankCredentialLocators(cut ? takeOffLocatorOpenAtCut(text) : text), cut });
    if (handedOn >= PRODUCTION_DIAGNOSTICS_LIFE_LINES) {
      stateDropped();
      waiting.push({ kind: 'quiet' });
      quiet = true;
      cancelSecond?.();
      cancelSecond = null;
    }
    wake();
  };

  return {
    push(chunk) {
      if (quiet || closed) return;
      // The next line end of each kind in this chunk, searched once per stretch: -2 not searched yet, -1 none left.
      let lineFeed = -2;
      let carriageReturn = -2;
      const lineEndFrom = (from: number): number => {
        if (lineFeed !== -1 && lineFeed < from) lineFeed = chunk.indexOf(0x0a, from);
        if (carriageReturn !== -1 && carriageReturn < from) carriageReturn = chunk.indexOf(0x0d, from);
        if (lineFeed === -1) return carriageReturn;
        return carriageReturn === -1 ? lineFeed : Math.min(lineFeed, carriageReturn);
      };
      let at = 0;
      while (at < chunk.length && !quiet) {
        if (skipping) {
          const end = lineEndFrom(at);
          if (end === -1) return;
          if (skippedCounts) drop();
          skipping = false;
          skippedCounts = false;
          at = end + 1;
          continue;
        }
        const byte = chunk.readUInt8(at);
        if (byte === 0x0a || byte === 0x0d) {
          at += 1;
          if (line !== '') {
            const whole = line;
            line = '';
            admit(whole, false);
          }
          continue;
        }
        if (line === '' && full()) {
          // Over the rate, or too many waiting: this line is not made into text at all.
          skipping = true;
          skippedCounts = true;
          continue;
        }
        if (line.length >= PRODUCTION_DIAGNOSTICS_LINE_CHARS) {
          const head = line;
          line = '';
          admit(head, true);
          skipping = true;
          continue;
        }
        line += HARMLESS.charAt(byte);
        at += 1;
      }
    },
    end() {
      if (closed) return;
      // A last line without a line end is a line; a line that was being read past is counted if it counted.
      if (!quiet && skipping && skippedCounts) drop();
      else if (!quiet && !skipping && line !== '') admit(line, false);
      line = '';
      cancelSecond?.();
      cancelSecond = null;
      stateDropped();
      closed = true;
      cancelTurn?.();
      cancelTurn = null;
      for (let event = waiting.shift(); event !== undefined; event = waiting.shift()) say(event);
    },
  };
}

/** The child's environment: the listed keys the caller gave, each an absolute path. Null: refused. */
function environmentOf(given: ProductionEnvironment | undefined): Record<string, string> | null {
  const environment: Record<string, string> = {};
  for (const [key, value] of Object.entries(given ?? {})) {
    if (!PRODUCTION_ENVIRONMENT_KEYS.some((allowed) => allowed === key)) return null;
    if (typeof value !== 'string' || !isAbsolute(value) || value.includes('\0')) return null;
    environment[key] = value;
  }
  return environment;
}

function refused(code: ProductionDoorRefusal): ProductionProcess {
  const started = Promise.reject<void>(new ProductionDoorError(code));
  // A caller that reads `ended` only must not turn the refusal into an unhandled rejection.
  started.catch(() => {});
  return {
    pid: null,
    started,
    ended: Promise.resolve({ exitCode: null, signal: null, spawnFailed: true, diagnostics: '', output: '' }),
    alive: () => false,
    endInput: () => {},
    kill: () => {},
  };
}

export const startProductionProcess: ProductionDoor = (options) => {
  if (!isAbsolute(options.command)) return refused(ProductionDoorRefusal.PROGRAM_NOT_ABSOLUTE);
  const environment = environmentOf(options.env);
  if (environment === null) return refused(ProductionDoorRefusal.ENVIRONMENT_NOT_ALLOWED);
  if ((options.coreFileLimit ?? coreFileLimitOfThisProcess)() !== 0) return refused(ProductionDoorRefusal.CORE_FILE_LIMIT_NOT_ZERO);
  // Row N5b: the call's cap of each output stream, the default unless named; a cap outside 1 byte to 1 MiB starts nothing.
  const capBytes = options.outputCapBytes ?? PRODUCTION_OUTPUT_CAP_BYTES;
  if (!Number.isSafeInteger(capBytes) || capBytes < 1 || capBytes > PRODUCTION_OUTPUT_CAP_MAX_BYTES) return refused(ProductionDoorRefusal.OUTPUT_CAP_NOT_ALLOWED);
  // Row N5b: a group of its own only when asked for with `true`; anything else is the door of before.
  const inOwnGroup = options.processGroup === true;

  // The bytes exist from here to `settle`. A message the serialiser refuses starts no process.
  let startBytes: Buffer | null = null;
  if (options.message !== null) {
    try {
      startBytes = startMessageBytes(options.message);
    } catch {
      return refused(ProductionDoorRefusal.START_MESSAGE_INVALID);
    }
  }

  let child;
  try {
    child = spawn(options.command, [...options.args], {
      env: environment,
      shell: false,
      // Row N5b: `true` only on the caller's ask - the child then leads a new session and its own process group (ID = its process ID).
      detached: inOwnGroup,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    startBytes?.fill(0);
    return refused(ProductionDoorRefusal.PROGRAM_NOT_STARTED);
  }
  const running = child;
  const input = running.stdin;
  const diagnostics = boundedText(capBytes);
  const output = boundedText(capBytes);
  let over = false;
  let spawnFailed = running.pid === undefined;
  /**
   * The ONE place that signals the child. A start that failed has no process ID, and a signal sent
   * through its handle would go to process ID 0, which is the server's whole process group: never.
   *
   * Row N5b, with `processGroup`: the signal goes to the group the child LEADS - the negative of its
   * own process ID, which is never 0, never -1 (every process) and never the server's group, because
   * the child was started in a new session. It is sent until the child is over (`close`: it has
   * been waited for and no process holds its streams); a member of the group that still holds a
   * stream keeps the group, so its ID is not given to another group meanwhile. A group already gone
   * is no error. Without the option nothing of the line of before changes.
   */
  const signalChild = (signal: 'SIGTERM' | 'SIGKILL'): void => {
    if (over || running.pid === undefined) return;
    if (!inOwnGroup) {
      running.kill(signal);
      return;
    }
    const leader = running.pid;
    if (!Number.isSafeInteger(leader) || leader <= 1) return;
    try {
      process.kill(-leader, signal);
    } catch {
      // No member of the group is left: nothing to end.
    }
  };
  const killAtExit = (): void => signalChild('SIGKILL');
  process.once('exit', killAtExit);

  // The streams are read as fast as they come and never paused: a full pipe would stop the child.
  const lines = options.onDiagnostics === undefined ? null : diagnosticsObserver(options.onDiagnostics, options.timers);
  running.stderr?.on('data', (chunk: Buffer) => {
    diagnostics.push(chunk);
    try {
      lines?.push(chunk);
    } catch {
      // The reading of the stream never depends on the observer's side.
    }
  });
  running.stdout?.on('data', (chunk: Buffer) => {
    output.push(chunk);
    try {
      options.onOutput?.(chunk);
    } catch {
      // An observer never stops the reading of the stream.
    }
  });
  running.stderr?.on('error', () => {});
  running.stdout?.on('error', () => {});

  let settled = false;
  let cancelBound: () => void = () => {};
  let resolveStarted: () => void = () => {};
  let rejectStarted: (error: ProductionDoorError) => void = () => {};
  const started = new Promise<void>((resolve, reject) => {
    resolveStarted = resolve;
    rejectStarted = reject;
  });
  started.catch(() => {});

  /** The one end of the start: the bound is cancelled, the bytes are zero-filled, a refused child is killed. */
  const settle = (refusal: ProductionDoorRefusal | null): void => {
    if (settled) return;
    settled = true;
    cancelBound();
    // A refused write is taken from the stream BEFORE the bytes are cleared: no cleared byte is ever sent.
    if (refusal !== null) input?.destroy();
    startBytes?.fill(0);
    startBytes = null;
    if (refusal === null) {
      resolveStarted();
      return;
    }
    signalChild('SIGKILL');
    rejectStarted(new ProductionDoorError(spawnFailed ? ProductionDoorRefusal.PROGRAM_NOT_STARTED : refusal));
  };

  const ended = new Promise<ProductionExit>((resolve) => {
    const end = (exitCode: number | null, signal: string | null): void => {
      if (over) return;
      over = true;
      process.removeListener('exit', killAtExit);
      // A child that is gone takes nothing more: a start that was still open is refused, its bytes cleared.
      settle(ProductionDoorRefusal.START_MESSAGE_NOT_TAKEN);
      try {
        // Everything the child wrote has been read: what still waits for the observer is told now, and nothing after this.
        lines?.end();
      } catch {
        // The end of the child is told whatever the observer's side did.
      }
      resolve({ exitCode, signal, spawnFailed, diagnostics: diagnostics.text(), output: output.text() });
    };
    running.on('error', () => {
      // No such file, no permission to execute: the process never existed.
      if (running.pid === undefined) {
        spawnFailed = true;
        end(null, null);
      }
    });
    // `close`, not `exit`: the child has been waited for and everything it wrote has been read.
    running.on('close', (exitCode, signal) => end(exitCode, signal));
  });

  // A write to a child that is gone fails here, also long after the start: it is never thrown.
  input?.on('error', () => settle(ProductionDoorRefusal.START_MESSAGE_NOT_TAKEN));
  if (spawnFailed || input === null) {
    settle(ProductionDoorRefusal.PROGRAM_NOT_STARTED);
  } else if (startBytes === null) {
    settle(null);
  } else {
    cancelBound = options.timers.after(options.writeBoundMs ?? START_MESSAGE_WRITE_BOUND_MS, () => settle(ProductionDoorRefusal.START_MESSAGE_TIMEOUT));
    input.write(startBytes, (error) => settle(error ? ProductionDoorRefusal.START_MESSAGE_NOT_TAKEN : null));
  }

  return {
    get pid() {
      return running.pid ?? null;
    },
    started,
    ended,
    alive: () => !over,
    endInput() {
      if (!over && input !== null && !input.destroyed) input.end();
    },
    kill: signalChild,
  };
};
