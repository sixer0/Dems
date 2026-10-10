/**
 * THE RECEIVER'S COMMAND (task 3 wave H, driver C1; gate finding G94-03, ruling D200):
 *
 *   npm run evidence:verify-export -- <archive.zip> [--sha256 <hex>] [--trust <certificate sha256>]...
 *
 * THE PROCESS ENTRY is `cli/verify-export.ts` of this workspace (the arguments, the two output
 * streams, the exit status, and the one `unzip` process); this file is everything else.
 *
 * Verifies ONE downloaded export archive at its destination. It needs NO Core, NO database and NO
 * key: it reads the archive file it is given and nothing else of this machine. It unpacks the
 * archive into a new private folder of the system's temporary directory with the system's `unzip`
 * (a reader this project did not write; the archive is STORED, ZIP64), runs the receiver checks
 * X-01 to X-07 of `receiver-verify.ts` over it, prints one line per check and removes the folder.
 *
 *   --sha256 <hex>   the SHA-256 of the archive as the Core stated it OUTSIDE the archive (the
 *                    export job of the web console / operation 87 `archive.sha256`, the audit row
 *                    of the download). The archive carries its export manifest and signature
 *                    inside and so cannot contain its own hash; with this value X-03 holds the
 *                    file to it. Without it the computed hash is printed for the receiver to compare.
 *   --trust <hex>    SHA-256 of the Core's signing certificate, received out of band (repeatable).
 *                    WITHOUT IT the signatures are checked against the certificate that lies in
 *                    the archive: the result then says only that the export is consistent with
 *                    itself, and the command says so (`anchored: no`).
 *
 * EXIT STATUS: 0 every check passed; 1 a check failed (the lines name which, by code); 2 the
 * command could not run (usage, the archive cannot be read, no `unzip`).
 *
 * WHAT IS REFUSED BEFORE UNPACKING: an archive that lists an absolute path, a `..` part or a
 * name outside the plain relative form of the archive writer - nothing is written for it.
 *
 * It prints names, codes and hashes: never a byte of media.
 */
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { verifyExportAtDestination, type ReceiverVerifyResult } from './receiver-verify';
import { isArchiveEntryName } from './zip-store';

export const RECEIVER_EXIT = { OK: 0, FAILED: 1, NOT_RUN: 2 } as const;

export const RECEIVER_USAGE = 'usage: npm run evidence:verify-export -- <archive.zip> [--sha256 <archive sha256>] [--trust <certificate sha256>]...';

export interface ReceiverCommand {
  readonly archive: string;
  readonly sha256: string | null;
  readonly trusted: readonly string[];
}

const HEX64 = /^[0-9a-f]{64}$/;

/** Reads the arguments. Null: not a call of this command. */
export function readReceiverArguments(argv: readonly string[]): ReceiverCommand | null {
  let archive: string | null = null;
  let sha256: string | null = null;
  const trusted: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? '';
    if (argument === '--sha256' || argument === '--trust') {
      const value = (argv[index + 1] ?? '').toLowerCase();
      if (!HEX64.test(value)) return null;
      if (argument === '--sha256') {
        if (sha256 !== null) return null;
        sha256 = value;
      } else trusted.push(value);
      index += 1;
    } else if (argument.startsWith('--') || archive !== null) return null;
    else archive = argument;
  }
  return archive === null || archive === '' ? null : { archive, sha256, trusted };
}

/** The lines of a result, as the command prints them. */
export function receiverReportLines(result: ReceiverVerifyResult): string[] {
  const lines = result.checks.map((check) => `${check.id}  ${check.ok ? 'PASS' : 'FAIL'}  ${check.name}${check.findings.length === 0 ? '' : `: ${check.findings.join(', ')}`}`);
  lines.push(`export: ${result.exportId ?? 'not established'}`);
  lines.push(`development sources: ${result.development === null ? 'not established' : result.development ? 'yes - recorded from DEVELOPMENT sources' : 'no'}`);
  lines.push(`composite (derived output) included: ${result.derived === null ? 'not established' : result.derived ? 'yes' : 'no'}`);
  lines.push(`anchored: ${result.anchored ? 'yes - the signing certificate was held to the given --trust value(s)' : 'no - no --trust given: the signatures were checked against the certificate inside the archive (self-consistency only)'}`);
  if (result.archive !== null) {
    lines.push(`archive sha256: ${result.archive.sha256} (${result.archive.bytes} bytes)${result.archive.compared ? ' - compared with the given value' : ' - NOT compared: no --sha256 given; compare it with the value the Core states for this export'}`);
  }
  lines.push(result.ok ? 'RESULT: PASS' : 'RESULT: FAIL');
  return lines;
}

interface Output {
  out(line: string): void;
  err(line: string): void;
}

/**
 * THE ARCHIVE READER of the command: the system's `unzip`, started by the process entry
 * (`cli/verify-export.ts` of this workspace) and handed in here - this unit, like the rest of the
 * server's sources, starts no process itself.
 */
export interface ArchiveUnpacker {
  /** The entry names of the archive; null when it cannot be read as an archive; 'NO_READER' when the reader is not on this machine. */
  list(archive: string): readonly string[] | null | 'NO_READER';
  /** Unpacks into a folder. The status of the reader (0: every entry unpacked and its CRC held), or null when it did not run. */
  unpack(archive: string, intoDir: string): number | null;
}

/**
 * Runs the command. `cwd` resolves a relative archive path (npm runs a workspace script inside
 * the workspace: the caller hands in the directory the user typed the command in).
 */
export async function runReceiverCommand(argv: readonly string[], cwd: string, output: Output, unpacker: ArchiveUnpacker): Promise<number> {
  const command = readReceiverArguments(argv);
  if (command === null) {
    output.err(RECEIVER_USAGE);
    return RECEIVER_EXIT.NOT_RUN;
  }
  const archive = isAbsolute(command.archive) ? command.archive : resolve(cwd, command.archive);
  try {
    if (!statSync(archive).isFile()) throw new Error('not a file');
  } catch {
    output.err(`the archive cannot be read: ${command.archive}`);
    return RECEIVER_EXIT.NOT_RUN;
  }

  // The names first: nothing is unpacked from an archive that names a place outside the folder.
  const names = unpacker.list(archive);
  if (names === 'NO_READER') {
    output.err('the system command `unzip` is not available: the archive was not unpacked');
    return RECEIVER_EXIT.NOT_RUN;
  }
  if (names === null || names.length === 0) {
    output.out('X-03  FAIL  Archive hash: ARCHIVE_UNREADABLE');
    output.out('RESULT: FAIL');
    return RECEIVER_EXIT.FAILED;
  }
  const unsafe = names.filter((name) => !isArchiveEntryName(name));
  if (unsafe.length > 0) {
    output.out(`X-04  FAIL  Archive entries: UNSAFE_ENTRY_NAME (${unsafe.length} entr${unsafe.length === 1 ? 'y' : 'ies'}; nothing was unpacked)`);
    output.out('RESULT: FAIL');
    return RECEIVER_EXIT.FAILED;
  }

  const unpackedDir = mkdtempSync(join(tmpdir(), 'dems-verify-export-'));
  try {
    // `unzip` checks the CRC of every entry as it unpacks: a non-zero status is an archive whose bytes are not what its directory says.
    const unpacked = unpacker.unpack(archive, unpackedDir);
    const result = await verifyExportAtDestination({
      unpackedDir,
      archiveFile: archive,
      ...(command.sha256 === null ? {} : { expectedArchiveSha256: command.sha256 }),
      ...(command.trusted.length === 0 ? {} : { trustedCertificateSha256: command.trusted }),
    });
    const lines = receiverReportLines(result);
    // The verdict is always the LAST line. An archive the reader did not unpack cleanly fails whatever the checks found.
    const verdict = lines.pop();
    for (const line of lines) output.out(line);
    if (unpacked !== 0) {
      output.out(`the archive did not unpack cleanly (unzip status ${unpacked ?? 'none'}): ARCHIVE_UNPACK_ERROR`);
      output.out('RESULT: FAIL');
      return RECEIVER_EXIT.FAILED;
    }
    output.out(verdict ?? 'RESULT: FAIL');
    return result.ok ? RECEIVER_EXIT.OK : RECEIVER_EXIT.FAILED;
  } finally {
    rmSync(unpackedDir, { recursive: true, force: true });
  }
}
