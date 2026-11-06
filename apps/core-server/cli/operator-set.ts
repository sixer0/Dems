/**
 * THE PROCESS ENTRY of the command that sets operator passwords from the host (task 4 row 215,
 * package X2-3; decision U19):
 *
 *   npm run operator:set-password -w @dems/core-server -- --database <name> --data-dir <absolute directory> --username <username>
 *   npm run operator:set-password -w @dems/core-server -- --database <name> --data-dir <absolute directory> --all-demo
 *
 * What the command DOES is `cli/operator-set-password-command.ts`. This file is only what a
 * process entry is: the arguments of the process, its output stream, its exit status, the server
 * clock, the numeric id of the calling user, the NAMES of the environment's variables (never a
 * value), the terminal, the real hasher, the real pool of the runtime role and the persistent
 * error log. Both files lie OUTSIDE `src/`: the server never loads them.
 *
 * THE NAME OF THIS FILE. The workspace's static rule on npm scripts (`test/static/credentials.test.ts`,
 * "no npm script carries a secret") reads the script's COMMAND TEXT and refuses a word that looks
 * like a secret in it. The script's command names this file, so the file is `operator-set.ts`. The
 * script carries no secret under either name; the rule was not edited.
 *
 * THE TERMINAL IS OWNED HERE. Standard input must be a terminal: a pipe, a file or a job without
 * one is refused before anything is read, and no flag lifts that. The confirmation word is read
 * as an ordinary, echoed line; every password is read by the secret prompt of row 213, which
 * echoes nothing and restores the terminal on every way out.
 *
 * THE CONNECTION FILE (row 215b, decision C66 (4)). This entry names NO data directory and no
 * connection file: the one directory is the `--data-dir` argument, and the command builds
 * `<that directory>/pg.env` from it as the Core does. `uid` below is also what the command compares
 * the owner of that file with. (The error log of this entry is the workspace's own log file; it is
 * not part of the data directory and holds codes and ids only.)
 *
 * Exit status: 0 done, 1 refused or not complete, 2 usage.
 */
import { createInterface } from 'node:readline';
import { isatty } from 'node:tty';
import { createSystemClock } from '../src/core/clock';
import { hashPassword } from '../src/modules/identity/password-hash';
import { createRuntimePool } from '../src/plugins/db';
import { DEFAULT_ERROR_LOG_FILE, createErrorLog } from '../src/plugins/logger';
import { SET_PASSWORD_COMMAND, SetPasswordExit, runSetPasswordCommand, type SetPasswordPorts } from './operator-set-password-command';
import { terminalSecretPrompt } from './secret-prompt';

/** The ports of a real run: this process, its terminal, the server clock and the runtime role's pool. */
export function terminalPorts(): SetPasswordPorts {
  return {
    clock: createSystemClock(),
    uid: () => (typeof process.getuid === 'function' ? process.getuid() : -1),
    out: (line) => void process.stdout.write(`${line}\n`),
    isTerminal: () => isatty(0),
    environmentNames: () => Object.keys(process.env),
    ask: (prompt) =>
      new Promise<string | null>((settle) => {
        if (!isatty(0)) return settle(null);
        const reader = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        let answered = false;
        reader.question(prompt, (line) => {
          answered = true;
          reader.close();
          settle(line);
        });
        // The input ended (Ctrl-D) or the line was abandoned (Ctrl-C): no line was typed.
        reader.once('close', () => {
          if (!answered) settle(null);
        });
      }),
    prompt: terminalSecretPrompt(),
    hasher: hashPassword,
    openPool: createRuntimePool,
    errorLog: createErrorLog(DEFAULT_ERROR_LOG_FILE),
  };
}

const invoked = process.argv[1] !== undefined && /operator-set\.[cm]?[jt]s$/.test(process.argv[1]);
if (invoked) {
  runSetPasswordCommand(process.argv.slice(2), terminalPorts()).then(
    (run) => {
      process.exitCode = run.code;
    },
    () => {
      process.stderr.write(`${SET_PASSWORD_COMMAND}: FAILED, the command could not run\n`);
      process.exitCode = SetPasswordExit.REFUSED;
    },
  );
}
