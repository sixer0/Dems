/**
 * THE PROCESS ENTRY of the receiver's command (task 3 wave H, driver C1; gate finding G94-03,
 * ruling D200):
 *
 *   npm run evidence:verify-export -- <archive.zip> [--sha256 <hex>] [--trust <certificate sha256>]...
 *
 * What the command DOES is `src/evidence-export/receiver-cli.ts` (the arguments, the checks, the
 * report). This file is only what a process entry is: the arguments of the process, its two
 * output streams, its exit status - and the ONE other process the command starts, the system's
 * `unzip`, which reads the archive (a reader this project did not write). It lies OUTSIDE `src/`
 * because the server's own sources start no process and read no environment (static rules
 * T-CR-2 and SR-01): this command is not the server and is never loaded by it.
 *
 * `unzip` is started WITHOUT a shell, with a fixed argument list of the option letters and two
 * paths (the archive the user named, a new private folder of the temporary directory). No secret
 * exists in this command, so none can become an argument.
 *
 * It needs no Core, no database and no key. Exit status: 0 PASS, 1 a check failed, 2 not run.
 */
import { spawnSync } from 'node:child_process';
import { RECEIVER_EXIT, runReceiverCommand, type ArchiveUnpacker } from '../src/evidence-export/receiver-cli';

const UNZIP = 'unzip';
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

/** The system's `unzip` as the reader of the command. */
export const systemUnzip: ArchiveUnpacker = {
  list(archive) {
    const listing = spawnSync(UNZIP, ['-Z1', archive], { encoding: 'utf8', maxBuffer: MAX_OUTPUT_BYTES });
    if (listing.error !== undefined || listing.status === null) return 'NO_READER';
    if (listing.status !== 0) return null;
    return listing.stdout.split('\n').filter((name) => name !== '');
  },
  unpack(archive, intoDir) {
    // `unzip` checks the CRC of every entry as it unpacks: a non-zero status is an archive whose bytes are not what its directory says.
    return spawnSync(UNZIP, ['-q', '-o', archive, '-d', intoDir], { encoding: 'utf8', maxBuffer: MAX_OUTPUT_BYTES }).status;
  },
};

const invoked = process.argv[1] !== undefined && /verify-export\.[cm]?[jt]s$/.test(process.argv[1]);
if (invoked) {
  // npm runs a workspace script inside the workspace: `INIT_CWD` is the folder the user typed the command in.
  runReceiverCommand(process.argv.slice(2), process.env['INIT_CWD'] ?? process.cwd(), { out: (line) => void process.stdout.write(`${line}\n`), err: (line) => void process.stderr.write(`${line}\n`) }, systemUnzip).then(
    (status) => {
      process.exitCode = status;
    },
    () => {
      process.stderr.write('the export could not be verified: the command failed\n');
      process.exitCode = RECEIVER_EXIT.NOT_RUN;
    },
  );
}
