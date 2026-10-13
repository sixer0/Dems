/**
 * THE PROCESS ENTRY of the rotation command (task 4 row 226, package X1-4; decisions U19, U20):
 *
 *   npm run evidence:rotate-key -w @dems/core-server -- --data-dir <absolute directory>
 *
 * What the command DOES is `cli/rotate-key-command.ts`. This file is only what a process entry is:
 * the arguments of the process, its output stream, its exit status, the host clock, the numeric id
 * of the calling user and the terminal the two values and the confirmation word are typed at - the
 * ports of the production key command's entry, taken as they are. Both files lie OUTSIDE `src/`:
 * the server never loads them.
 *
 * NOTHING SECRET IS TYPED OR PRINTED, and the command reads NO environment variable. Without a
 * terminal on standard input no line is read and the command refuses (`NOT_A_TERMINAL`): it is run
 * by a person at the Core host, as the OS user the Core runs as, WITH THE CORE STOPPED.
 *
 * Exit status: 0 rotated, 1 refused or failed, 2 usage.
 */
import { terminalPorts } from './production-key';
import { RotateKeyExit, runRotateKeyCommand } from './rotate-key-command';

const invoked = process.argv[1] !== undefined && /rotate-key\.[cm]?[jt]s$/.test(process.argv[1]);
if (invoked) {
  runRotateKeyCommand(process.argv.slice(2), terminalPorts()).then(
    (run) => {
      process.exitCode = run.code;
    },
    () => {
      process.stderr.write('evidence:rotate-key: FAILED, the command could not run\n');
      process.exitCode = RotateKeyExit.REFUSED;
    },
  );
}
