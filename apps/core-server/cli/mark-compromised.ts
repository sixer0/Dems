/**
 * THE PROCESS ENTRY of the compromise mark command (task 4 row 226, package X1-4; decisions U19, U20):
 *
 *   npm run evidence:mark-compromised -w @dems/core-server -- --data-dir <absolute directory> --key-id <key id>
 *
 * What the command DOES is `cli/mark-compromised-command.ts`. This file is only what a process
 * entry is: the arguments of the process, its output stream, its exit status, the host clock, the
 * numeric id of the calling user and the terminal the confirmation word is typed at - the ports of
 * the production key command's entry, taken as they are. Both files lie OUTSIDE `src/`: the server
 * never loads them.
 *
 * NOTHING SECRET IS TYPED OR PRINTED, and the command reads NO environment variable. Without a
 * terminal on standard input no line is read and the command refuses (`NOT_A_TERMINAL`): it is run
 * by a person at the Core host, as the OS user the Core runs as.
 *
 * Exit status: 0 marked (or marked already), 1 refused or failed, 2 usage.
 */
import { MarkCompromisedExit, runMarkCompromisedCommand } from './mark-compromised-command';
import { terminalPorts } from './production-key';

const invoked = process.argv[1] !== undefined && /mark-compromised\.[cm]?[jt]s$/.test(process.argv[1]);
if (invoked) {
  runMarkCompromisedCommand(process.argv.slice(2), terminalPorts()).then(
    (run) => {
      process.exitCode = run.code;
    },
    () => {
      process.stderr.write('evidence:mark-compromised: FAILED, the command could not run\n');
      process.exitCode = MarkCompromisedExit.REFUSED;
    },
  );
}
