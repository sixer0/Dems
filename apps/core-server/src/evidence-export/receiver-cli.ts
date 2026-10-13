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
 *   --compromised <hex>
 *                    (task 4 row V5; decision C84, caution R-2) SHA-256 of a certificate whose key
 *                    the receiver was TOLD is marked compromised, received out of band (repeatable;
 *                    the form of the hand-over record). A package cannot say this of itself. With
 *                    it, an export that rests on such a certificate is NEVER reported as a pass:
 *                    the result is "NOT A PASS - signature valid, key reported compromised by the
 *                    list supplied" (exit status 3) - unless the export itself states that mark
 *                    under an export signature held to a `--trust` value, in which case the
 *                    exporting Core verified the source against its stored digest and the result
 *                    is a pass under that NAMED state. WITHOUT IT the command behaves as before;
 *                    an export whose manifest states a mark says so in every run.
 *
 * EXIT STATUS: 0 every check passed; 1 a check failed (the lines name which, by code); 2 the
 * command could not run (usage, the archive cannot be read, no `unzip`); 3 nothing failed but the
 * supplied list reports a signing key of this export as compromised (not a pass, not a tamper finding).
 *
 * WHAT IS REFUSED BEFORE UNPACKING: an archive that lists an absolute path, a `..` part or a
 * name outside the plain relative form of the archive writer - nothing is written for it.
 *
 * It prints names, codes and hashes: never a byte of media.
 */
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { hostProfileNotAskedReport, videoAbsentInSessionReport } from '@dems/shared/evidence-verify';
import { verifyExportAtDestination, type ReceiverVerifyResult } from './receiver-verify';
import { isArchiveEntryName } from './zip-store';

export const RECEIVER_EXIT = { OK: 0, FAILED: 1, NOT_RUN: 2, KEY_REPORTED_COMPROMISED: 3 } as const;

export const RECEIVER_USAGE = 'usage: npm run evidence:verify-export -- <archive.zip> [--sha256 <archive sha256>] [--trust <certificate sha256>]... [--compromised <certificate sha256>]...';

/** Row V5: the verdict lines of the two states a compromise mark gives. The words of the state, never a plain "PASS". */
export const RECEIVER_RESULT_KEY_REPORTED = 'RESULT: NOT A PASS - signature valid, key reported compromised by the list supplied';
export const RECEIVER_RESULT_PASS_UNDER_MARK = 'RESULT: PASS - UNDER A SIGNING KEY MARKED COMPROMISED: verified by the exporting Core against the digest it recorded at the seal, as this export states';

export interface ReceiverCommand {
  readonly archive: string;
  readonly sha256: string | null;
  readonly trusted: readonly string[];
  /** Row V5: the `--compromised` values. Absent when none was given. */
  readonly compromised?: readonly string[];
}

const HEX64 = /^[0-9a-f]{64}$/;

/** Reads the arguments. Null: not a call of this command. */
export function readReceiverArguments(argv: readonly string[]): ReceiverCommand | null {
  let archive: string | null = null;
  let sha256: string | null = null;
  const trusted: string[] = [];
  const compromised: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? '';
    if (argument === '--sha256' || argument === '--trust' || argument === '--compromised') {
      const value = (argv[index + 1] ?? '').toLowerCase();
      if (!HEX64.test(value)) return null;
      if (argument === '--sha256') {
        if (sha256 !== null) return null;
        sha256 = value;
      } else if (argument === '--trust') trusted.push(value);
      else compromised.push(value);
      index += 1;
    } else if (argument.startsWith('--') || archive !== null) return null;
    else archive = argument;
  }
  if (archive === null || archive === '') return null;
  return compromised.length === 0 ? { archive, sha256, trusted } : { archive, sha256, trusted, compromised };
}

/** Row V5: the last line of a result and the exit status that goes with it. */
export function receiverVerdictOf(result: ReceiverVerifyResult): { readonly line: string; readonly status: number } {
  const mark = result.keyMark;
  if (result.ok) return mark !== undefined && mark.statedByExport.length > 0 ? { line: RECEIVER_RESULT_PASS_UNDER_MARK, status: RECEIVER_EXIT.OK } : { line: 'RESULT: PASS', status: RECEIVER_EXIT.OK };
  if (mark?.onlyMarkFails === true) return { line: RECEIVER_RESULT_KEY_REPORTED, status: RECEIVER_EXIT.KEY_REPORTED_COMPROMISED };
  return { line: 'RESULT: FAIL', status: RECEIVER_EXIT.FAILED };
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
  // Row V5: what this run says of a compromise mark - only when the export states one or a list was supplied.
  const mark = result.keyMark;
  if (mark !== undefined) {
    if (mark.statedByExport.length > 0) {
      lines.push(`source signing key: MARKED COMPROMISED - stated by this export for the certificate${mark.statedByExport.length === 1 ? '' : 's'} ${mark.statedByExport.join(', ')}; the exporting Core verified the source against the digest it recorded at the seal. The signature of that key alone proves nothing any more`);
    }
    if (mark.listSupplied) lines.push(`marked fingerprints supplied (--compromised): ${mark.reportedByList ? 'a certificate this export rests on is in the list and is not covered by an anchored statement of the export' : 'no certificate this export rests on is reported by the list beyond what the export states'}`);
  }
  // Row V6 (decision C97; row P1's request): the sealed manifest's signed member `hostProfileNotAsked` is SAID, in the
  // one wording of the shared verifier. Only when the manifest carries it; it fails nothing and stands before the verdict.
  if (result.hostProfileNotAsked !== undefined) lines.push(hostProfileNotAskedReport(result.hostProfileNotAsked.platform));
  // Row R1b (decision C99): the sealed manifest's signed member `tracks[].absentInSession` is SAID, in the one wording of
  // the shared verifier. Only when a track carries it; it fails nothing and stands before the verdict.
  if (result.videoAbsentInSession !== undefined) lines.push(videoAbsentInSessionReport(result.videoAbsentInSession));
  lines.push(receiverVerdictOf(result).line);
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
      ...(command.compromised === undefined ? {} : { compromisedCertificateSha256: command.compromised }),
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
    // Row V5: 0 a pass (plain, or under the state the export names); 3 "not a pass" by the supplied list alone; 1 every other failure.
    return receiverVerdictOf(result).status;
  } finally {
    rmSync(unpackedDir, { recursive: true, force: true });
  }
}
