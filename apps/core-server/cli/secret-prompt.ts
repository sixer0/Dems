/**
 * THE TERMINAL SECRET PROMPT (task 4 blueprint row 213, package X2-2; design
 * `masterplan/05_design_x1_x2.md` section 3.4; security review SX-04; requirements R-X2-2, R-X2-3).
 *
 * A PORT, `readSecretLine(label)`, and its real implementation on standard input. The command that
 * sets an operator's password (row 215) sees only the port; its tests hand in a port that returns
 * values made in the test run.
 *
 * WHAT THE REAL IMPLEMENTATION DOES
 *   - It REFUSES unless standard input is a terminal. No argument, no environment variable and no
 *     option of this file lifts that: this file reads no environment variable and no argument.
 *     A pipe, a file, a here-document, no terminal at all: `NOT_A_TERMINAL`, and no byte is read.
 *   - It puts the terminal into raw mode, so nothing is echoed, and writes NOTHING per key - not
 *     even a mask character, which would show the length. It writes the label before the entry and
 *     one line break after it.
 *   - In raw mode the interrupt key is a byte, not a signal: bytes 0x03 and 0x04 ABORT.
 *   - Any other control character (backspace and tab included) and any escape sequence (an arrow
 *     key, a function key, a bracketed paste) REFUSE THE ENTRY: taken silently they would become
 *     part of a password nobody can type on a tablet. A refused entry is read to its line end and
 *     thrown away, so what was typed after the bad key does not become the next entry.
 *   - The bytes of one character may arrive in two reads; they are joined, and the whole line must
 *     be well-formed UTF-8.
 *   - The terminal is restored on EVERY exit path: a line, a refused entry, an abort byte, the end
 *     of the input, an error of the terminal, SIGTERM, SIGHUP and an uncaught error.
 *   - The line is returned as a `Buffer` of its UTF-8 bytes, which THE CALLER ZEROES (`fill(0)`)
 *     when it is done. This file's own copy and every chunk it was handed are zeroed before it
 *     returns. Limit of the runtime: a caller that turns the buffer into a string cannot wipe that
 *     string (design 3.2, "an honest limit of the runtime").
 *   - Nothing is logged. This file imports no logger and no file system, and no error it throws
 *     holds a typed value: an error has a code and fixed words.
 *
 * WHAT THE TERMINAL TEST IS AND IS NOT. "Standard input is a terminal" stops the ACCIDENT: a pipe,
 * a here-document, a scheduled job, a script that forgot it is not a person. It does NOT stop a
 * program that opens a pseudo-terminal and types into it. Nothing in this file can. The rule
 * against that is R-X2-9, and it is a rule for agents, not a control: agents never type, receive,
 * keep or read a real password; every real password is typed by its owner at this prompt. Outside
 * this file's reach as well: a terminal recorder that logs input, a remote session, a screen share
 * (the installer's note says so).
 *
 * It lies OUTSIDE `src/` because the server's own sources own no terminal and read no process
 * stream (as `cli/verify-export.ts`): a command is not the server and is never loaded by it.
 *
 * THE ATTENDED CHECK (design 3.11): run by a person, with a THROW-AWAY value, on each host kind:
 *
 *   npx tsx cli/secret-prompt.ts          (from apps/core-server)
 *
 * It reads one hidden line, discards it, and says only which outcome it saw - never the value and
 * never its length. The person checks: nothing appeared while typing; the terminal echoes again
 * afterwards; after Ctrl-C at the prompt the terminal echoes again too. Exit status: 0 a line was
 * read, 1 anything else (not a terminal, aborted, entry refused).
 */
import { isUtf8 } from 'node:buffer';
import { isatty } from 'node:tty';

/** A line longer than this many bytes is refused. Far above any password bound; it only bounds memory. */
export const SECRET_LINE_MAX_BYTES = 1024;

/** Why the prompt could not be used at all. Fixed words, no value. */
export const SECRET_PROMPT_FAILURE = {
  NOT_A_TERMINAL: 'standard input is not a terminal: a hidden line is typed by a person at the terminal, never read from a pipe or a file',
  TERMINAL_ERROR: 'the terminal could not be read or could not be put into or out of hidden input',
  BUSY: 'a hidden line is already being read',
} as const;
export type SecretPromptFailureCode = keyof typeof SECRET_PROMPT_FAILURE;

/** The only error of this file: a code and its fixed words. Never a typed value, never a cause. */
export class SecretPromptError extends Error {
  readonly code: SecretPromptFailureCode;
  constructor(code: SecretPromptFailureCode) {
    super(SECRET_PROMPT_FAILURE[code]);
    this.name = 'SecretPromptError';
    this.code = code;
  }
}

/** Why one entry was refused. Fixed words, no value. The person types the entry again. */
export const SECRET_ENTRY_REFUSAL = {
  CONTROL_CHARACTER: 'the entry held a control character (backspace and tab count): type it again',
  ESCAPE_SEQUENCE: 'the entry held a special key (an arrow key, a function key, a paste): type it again',
  INVALID_TEXT: 'the entry was not well-formed text: type it again',
  TOO_LONG: 'the entry was too long: type it again',
  INPUT_AFTER_LINE_END: 'more input followed the end of the line: type one line, then wait',
} as const;
export type SecretEntryRefusalCode = keyof typeof SECRET_ENTRY_REFUSAL;

/** What ended a read without a line. */
export type SecretAbortCause = 'INTERRUPT_BYTE' | 'END_BYTE' | 'INPUT_ENDED' | 'SIGTERM' | 'SIGHUP' | 'UNCAUGHT_ERROR';

export type SecretLine =
  /** One line, as its UTF-8 bytes, without the line end. THE CALLER ZEROES `secret` (`fill(0)`). */
  | { readonly kind: 'LINE'; readonly secret: Buffer }
  | { readonly kind: 'ENTRY_REFUSED'; readonly code: SecretEntryRefusalCode }
  | { readonly kind: 'ABORTED'; readonly cause: SecretAbortCause };

/** THE PORT. A test hands in an object of this shape that returns values made in the test run. */
export interface SecretPromptPort {
  /** Reads one hidden line. Rejects with `SecretPromptError` when no line can be asked for at all. */
  readSecretLine(label: string): Promise<SecretLine>;
}

/** What the real implementation needs of a terminal. The real one is `standardInputTerminal()`. */
export interface SecretTerminal {
  /** Whether standard input is a terminal. Asked first; on `false` nothing below is called. */
  isTerminal(): boolean;
  /** `true` = hidden input (no echo, keys as bytes); `false` = the terminal as it was. */
  setRawMode(raw: boolean): void;
  /** Starts handing over what is typed; returns the function that stops it. */
  listen(handlers: SecretTerminalHandlers): () => void;
  /** The label, and the one line break after the entry. Never called in between. */
  write(text: string): void;
}
export interface SecretTerminalHandlers {
  data(chunk: Buffer): void;
  end(): void;
  error(): void;
}

export type SecretInterruption = 'SIGTERM' | 'SIGHUP' | 'UNCAUGHT_ERROR';
/** The three interruptions that are not bytes. The real one is `processInterruptions()`. */
export interface SecretInterruptions {
  /** Calls `restore` when one of the three happens; returns the function that stops watching. */
  watch(restore: (cause: SecretInterruption) => void): () => void;
}

const INTERRUPT_BYTE = 0x03;
const END_BYTE = 0x04;
const ESCAPE_BYTE = 0x1b;
const CARRIAGE_RETURN = 0x0d;
const LINE_FEED = 0x0a;
const DELETE_BYTE = 0x7f;
/** A control character of the second block (U+0080 to U+009F) is the lead byte 0xC2 and a byte 0x80 to 0x9F. */
const SECOND_BLOCK_LEAD = 0xc2;

function holdsSecondBlockControl(bytes: Buffer): boolean {
  for (let index = 0; index + 1 < bytes.length; index += 1) {
    const next = bytes[index + 1] ?? 0;
    if (bytes[index] === SECOND_BLOCK_LEAD && next >= 0x80 && next <= 0x9f) return true;
  }
  return false;
}

/** The real implementation of the port, over a terminal and the three interruptions. */
export function createSecretPrompt(deps: { readonly terminal: SecretTerminal; readonly interruptions: SecretInterruptions }): SecretPromptPort {
  const { terminal, interruptions } = deps;
  let busy = false;

  function readSecretLine(label: string): Promise<SecretLine> {
    // Before anything else, and with nothing that lifts it (R-X2-3).
    if (!terminal.isTerminal()) return Promise.reject(new SecretPromptError('NOT_A_TERMINAL'));
    if (busy) return Promise.reject(new SecretPromptError('BUSY'));
    busy = true;

    return new Promise<SecretLine>((resolve, reject) => {
      /** This file's one copy of what is typed. Zeroed on every exit path. */
      const held = Buffer.alloc(SECRET_LINE_MAX_BYTES);
      let length = 0;
      let refused: SecretEntryRefusalCode | null = null;
      let finished = false;
      let raw = false;
      let stopListening: (() => void) | null = null;
      let stopWatching: (() => void) | null = null;

      /** The one way out. `outcome` null = the terminal failed. Restores first, then answers. */
      const finish = (outcome: SecretLine | null): void => {
        if (finished) return;
        finished = true;
        let restored = true;
        try {
          stopListening?.();
        } catch {
          restored = false;
        }
        if (raw) {
          try {
            terminal.setRawMode(false);
            raw = false;
          } catch {
            restored = false;
          }
        }
        try {
          stopWatching?.();
        } catch {
          // Nothing to restore here: the watch holds no terminal state.
        }
        held.fill(0);
        try {
          terminal.write('\n');
        } catch {
          // The line break is a courtesy; its failure changes no outcome.
        }
        busy = false;
        if (outcome === null || !restored) {
          if (outcome !== null && outcome.kind === 'LINE') outcome.secret.fill(0);
          reject(new SecretPromptError('TERMINAL_ERROR'));
          return;
        }
        resolve(outcome);
      };

      const endOfLine = (): void => {
        if (refused !== null) return finish({ kind: 'ENTRY_REFUSED', code: refused });
        const line = held.subarray(0, length);
        if (!isUtf8(line)) return finish({ kind: 'ENTRY_REFUSED', code: 'INVALID_TEXT' });
        if (holdsSecondBlockControl(line)) return finish({ kind: 'ENTRY_REFUSED', code: 'CONTROL_CHARACTER' });
        // A buffer of its own (not from the shared pool), so that zeroing it zeroes every byte of it.
        const secret = Buffer.alloc(length);
        line.copy(secret);
        finish({ kind: 'LINE', secret });
      };

      const data = (chunk: Buffer): void => {
        try {
          if (finished) return;
          if (!Buffer.isBuffer(chunk)) return finish(null);
          for (let index = 0; index < chunk.length; index += 1) {
            const byte = chunk[index] ?? 0;
            if (byte === INTERRUPT_BYTE) return finish({ kind: 'ABORTED', cause: 'INTERRUPT_BYTE' });
            if (byte === END_BYTE) return finish({ kind: 'ABORTED', cause: 'END_BYTE' });
            if (byte === CARRIAGE_RETURN || byte === LINE_FEED) {
              let after = chunk.length - index - 1;
              if (byte === CARRIAGE_RETURN && after >= 1 && chunk[index + 1] === LINE_FEED) after -= 1;
              if (after > 0 && refused === null) refused = 'INPUT_AFTER_LINE_END';
              return endOfLine();
            }
            // A refused entry is read to its line end and thrown away.
            if (refused !== null) continue;
            if (byte === ESCAPE_BYTE) refused = 'ESCAPE_SEQUENCE';
            else if (byte < 0x20 || byte === DELETE_BYTE) refused = 'CONTROL_CHARACTER';
            else if (length >= SECRET_LINE_MAX_BYTES) refused = 'TOO_LONG';
            else {
              held[length] = byte;
              length += 1;
            }
            // A byte of 0x80 and above is part of a character whose other bytes may come with the next read: it is kept as it is.
          }
        } finally {
          if (Buffer.isBuffer(chunk)) chunk.fill(0);
        }
      };

      try {
        stopWatching = interruptions.watch((cause) => finish({ kind: 'ABORTED', cause }));
        terminal.setRawMode(true);
        raw = true;
        terminal.write(label);
        stopListening = terminal.listen({
          data,
          end: () => finish({ kind: 'ABORTED', cause: 'INPUT_ENDED' }),
          error: () => finish(null),
        });
      } catch {
        finish(null);
      }
    });
  }

  return { readSecretLine };
}

/** Standard input as the terminal; the label goes to standard error, so that standard output stays the command's. */
export function standardInputTerminal(): SecretTerminal {
  return {
    // The descriptor is asked, not the stream: a refusal opens and reads nothing.
    isTerminal: () => isatty(0),
    setRawMode(raw) {
      process.stdin.setRawMode(raw);
    },
    listen(handlers) {
      const input = process.stdin;
      const onData = (chunk: Buffer): void => handlers.data(chunk);
      const onEnd = (): void => handlers.end();
      const onError = (): void => handlers.error();
      input.on('data', onData);
      input.on('end', onEnd);
      input.on('error', onError);
      input.resume();
      return () => {
        input.off('data', onData);
        input.off('end', onEnd);
        input.off('error', onError);
        input.pause();
      };
    },
    write(text) {
      process.stderr.write(text);
    },
  };
}

/**
 * SIGTERM, SIGHUP and an uncaught error of this process. After the restore a signal keeps its
 * meaning: when no other listener of it is left, it is sent again and ends the process as it would
 * have. The uncaught error is only WATCHED (the monitor event): the process still ends on it.
 */
export function processInterruptions(): SecretInterruptions {
  return {
    watch(restore) {
      const signals = ['SIGTERM', 'SIGHUP'] as const;
      const onSignal = (signal: (typeof signals)[number]) => (): void => {
        restore(signal);
        stop();
        if (process.listenerCount(signal) === 0) process.kill(process.pid, signal);
      };
      const listeners = signals.map((signal) => [signal, onSignal(signal)] as const);
      const onUncaught = (): void => restore('UNCAUGHT_ERROR');
      function stop(): void {
        for (const [signal, listener] of listeners) process.off(signal, listener);
        process.off('uncaughtExceptionMonitor', onUncaught);
      }
      for (const [signal, listener] of listeners) process.on(signal, listener);
      process.on('uncaughtExceptionMonitor', onUncaught);
      return stop;
    },
  };
}

/** The prompt of a command's process entry. */
export function terminalSecretPrompt(): SecretPromptPort {
  return createSecretPrompt({ terminal: standardInputTerminal(), interruptions: processInterruptions() });
}

/** The exit status of the attended check. */
export const ATTENDED_CHECK_EXIT = { LINE_READ: 0, NOT_READ: 1 } as const;

/**
 * The attended check: one hidden line, discarded. It looks at no argument and no environment
 * variable, so none can lift the terminal test. It prints the outcome, never the value or its length.
 */
export async function runAttendedCheck(io: {
  readonly isTerminal: () => boolean;
  readonly prompt: SecretPromptPort;
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}): Promise<number> {
  if (!io.isTerminal()) {
    io.err(`refused (NOT_A_TERMINAL): ${SECRET_PROMPT_FAILURE.NOT_A_TERMINAL}`);
    return ATTENDED_CHECK_EXIT.NOT_READ;
  }
  io.out('Attended check of the hidden prompt. Type a THROW-AWAY value, never a real password, then Enter.');
  let answer: SecretLine;
  try {
    answer = await io.prompt.readSecretLine('Throw-away value (nothing will be shown): ');
  } catch (error) {
    const code: SecretPromptFailureCode = error instanceof SecretPromptError ? error.code : 'TERMINAL_ERROR';
    io.err(`refused (${code}): ${SECRET_PROMPT_FAILURE[code]}`);
    return ATTENDED_CHECK_EXIT.NOT_READ;
  }
  if (answer.kind === 'LINE') {
    answer.secret.fill(0);
    io.out('A line was read and discarded. Check: nothing appeared while you typed, and the terminal shows what you type again now.');
    return ATTENDED_CHECK_EXIT.LINE_READ;
  }
  if (answer.kind === 'ENTRY_REFUSED') {
    io.err(`entry refused (${answer.code}): ${SECRET_ENTRY_REFUSAL[answer.code]}`);
    return ATTENDED_CHECK_EXIT.NOT_READ;
  }
  io.err(`aborted (${answer.cause}). Check: the terminal shows what you type again now.`);
  return ATTENDED_CHECK_EXIT.NOT_READ;
}

const invoked = process.argv[1] !== undefined && /secret-prompt\.[cm]?[jt]s$/.test(process.argv[1]);
if (invoked) {
  runAttendedCheck({
    isTerminal: () => isatty(0),
    prompt: terminalSecretPrompt(),
    out: (line) => void process.stdout.write(`${line}\n`),
    err: (line) => void process.stderr.write(`${line}\n`),
  }).then(
    (status) => {
      process.exitCode = status;
    },
    () => {
      process.stderr.write('the attended check failed\n');
      process.exitCode = ATTENDED_CHECK_EXIT.NOT_READ;
    },
  );
}
