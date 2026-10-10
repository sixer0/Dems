// THE RECEIVER'S COMMAND on a downloaded archive ALONE (task 3 wave H, driver C1; gate finding
// G94-03, ruling D200): `npm run evidence:verify-export -- <archive>`.
//
// A real export of row 85's test package (real bytes, real AES-256-GCM per fragment, a real Ed25519
// signature of a throw-away key). What the command is given is ONE FILE - a copy of the archive in
// an empty folder, as a browser saves a download. No file of the Core's package folder is beside it,
// no database, no session key and no signing key exist for it. The archive is unpacked by the
// system's `unzip`, a reader neither this project nor its archive library wrote.
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildPackage, removeScratch, scratch, type BuiltPackage } from '../../evidence-verify/__tests__/support';
import { parseExportManifest } from '../export-manifest';
import { exportPackage, type ExportOutcome } from '../package-export';
import { systemUnzip } from '../../../cli/verify-export';
import { RECEIVER_EXIT, RECEIVER_USAGE, readReceiverArguments, runReceiverCommand } from '../receiver-cli';
import { portsOf, requestFacts } from './support';

afterEach(removeScratch);

interface Downloaded {
  readonly built: BuiltPackage;
  readonly outcome: ExportOutcome;
  /** The folder the download was saved into: it holds the archive and nothing else. */
  readonly folder: string;
  readonly archive: string;
}

async function download(): Promise<Downloaded> {
  const built = await buildPackage({ revisions: 1 });
  const outcome = await exportPackage(built.dir, built.item, requestFacts(), portsOf(built));
  const folder = scratch('download');
  const archive = join(folder, 'DEMS-export-EXP-000032.zip');
  copyFileSync(built.path(outcome.files.archive), archive);
  return { built, outcome, folder, archive };
}

async function run(argv: readonly string[], cwd: string): Promise<{ status: number; out: string[]; err: string[] }> {
  const out: string[] = [];
  const err: string[] = [];
  const status = await runReceiverCommand(argv, cwd, { out: (line) => void out.push(line), err: (line) => void err.push(line) }, systemUnzip);
  return { status, out, err };
}
const checks = (lines: readonly string[]): string[] => lines.filter((line) => /^X-0[1-7] /.test(line)).map((line) => line.slice(0, 10));
const ALL_PASS = ['X-01  PASS', 'X-02  PASS', 'X-03  PASS', 'X-04  PASS', 'X-05  PASS', 'X-06  PASS', 'X-07  PASS'];
const leftovers = (): string[] => readdirSync(tmpdir()).filter((name) => name.startsWith('dems-verify-export-'));

describe('G94-03: the download is ONE self-contained archive, and the receiver command verifies it alone', () => {
  it('the archive carries its export manifest and signature inside, under their per-export names; the manifest names no hash of the archive', async () => {
    const { built, outcome } = await download();
    const archive = readFileSync(built.path(outcome.files.archive));
    for (const name of ['export/EXP-000032.manifest.json', 'export/EXP-000032.manifest.sig']) expect(archive.includes(Buffer.from(name)), name).toBe(true);
    // The embedded manifest is byte for byte the one the Core keeps beside the archive, and it is the signed one.
    const kept = readFileSync(built.path(outcome.files.manifest));
    expect(archive.includes(kept)).toBe(true);
    const manifest = parseExportManifest(kept.toString('utf8'));
    expect(manifest.package).not.toHaveProperty('sha256');
    expect(manifest.package.entries.map((entry) => entry.path)).not.toContain('export/EXP-000032.manifest.json');
    expect(manifest.export.manifestSha256).toBe(outcome.manifestSha256);
  });

  it('export -> the downloaded bytes alone -> the command -> PASS, exit 0; relative path, the hash printed for comparison, nothing left in the temporary folder', async () => {
    const { folder, outcome } = await download();
    expect(readdirSync(folder)).toEqual(['DEMS-export-EXP-000032.zip']); // the ONLY file the receiver holds
    const before = leftovers();
    const result = await run(['DEMS-export-EXP-000032.zip'], folder);
    expect(result.err).toEqual([]);
    expect(checks(result.out)).toEqual(ALL_PASS);
    expect(result.out).toContain('export: EXP-000032');
    expect(result.out.find((line) => line.startsWith('archive sha256:'))).toContain(`${outcome.archive.sha256} (${outcome.archive.bytes} bytes) - NOT compared`);
    expect(result.out.find((line) => line.startsWith('anchored:'))).toContain('no - no --trust given');
    expect(result.out.at(-1)).toBe('RESULT: PASS');
    expect(result.status).toBe(RECEIVER_EXIT.OK);
    expect(leftovers()).toEqual(before);
    expect(readdirSync(folder)).toEqual(['DEMS-export-EXP-000032.zip']);
  });

  it('with the hash the Core states and the certificate anchor: PASS, compared and anchored', async () => {
    const { archive, built, outcome } = await download();
    const result = await run([archive, '--sha256', outcome.archive.sha256, '--trust', built.signer.certificate.sha256], '/');
    expect(checks(result.out)).toEqual(ALL_PASS);
    expect(result.out.find((line) => line.startsWith('archive sha256:'))).toContain('compared with the given value');
    expect(result.out.find((line) => line.startsWith('anchored:'))).toContain('yes');
    expect(result.status).toBe(RECEIVER_EXIT.OK);
  });

  it('NEGATIVE CONTROL: ONE altered byte of a camera file inside the archive -> exit 1, the entry and the plaintext check named', async () => {
    const { archive, built } = await download();
    const bytes = readFileSync(archive);
    const at = bytes.indexOf(Buffer.from('fragments/VIDEO-02.mp4')) + 22 + 20 + built.fragment('VIDEO-02', 2).byteOffset + 9;
    bytes[at] = (bytes[at] ?? 0) ^ 0x01;
    writeFileSync(archive, bytes);
    const result = await run([archive], '/');
    expect(result.status).toBe(RECEIVER_EXIT.FAILED);
    expect(result.out.find((line) => line.startsWith('X-04'))).toBe('X-04  FAIL  Archive entries: ENTRY_HASH_MISMATCH:fragments/VIDEO-02.mp4');
    expect(result.out.find((line) => line.startsWith('X-06'))).toContain('PLAINTEXT_HASH_MISMATCH:VIDEO-02');
    expect(result.out.at(-1)).toBe('RESULT: FAIL');
  });

  it('NEGATIVE CONTROLS: a wrong stated hash fails X-03 by name; an altered embedded manifest fails X-01; another anchor fails X-02', async () => {
    const { archive, built, outcome } = await download();
    const wrong = await run([archive, '--sha256', 'ab'.repeat(32)], '/');
    expect(wrong.status).toBe(RECEIVER_EXIT.FAILED);
    expect(wrong.out.find((line) => line.startsWith('X-03'))).toBe('X-03  FAIL  Archive hash: ARCHIVE_HASH_MISMATCH');
    expect(checks(wrong.out).filter((line) => line.endsWith('FAIL'))).toEqual(['X-03  FAIL']);

    const foreign = await run([archive, '--trust', '0'.repeat(64)], '/');
    expect(foreign.status).toBe(RECEIVER_EXIT.FAILED);
    expect(foreign.out.find((line) => line.startsWith('X-02'))).toContain('EXPORT_CERTIFICATE_NOT_TRUSTED');

    // One character of the embedded export manifest (the destination text), same length: the CRC of the entry and the manifest's own digest both say so.
    const bytes = readFileSync(archive);
    const kept = readFileSync(built.path(outcome.files.manifest));
    const at = bytes.indexOf(kept) + kept.indexOf(Buffer.from('Case file transfer'));
    bytes[at] = 'K'.charCodeAt(0);
    writeFileSync(archive, bytes);
    const edited = await run([archive], '/');
    expect(edited.status).toBe(RECEIVER_EXIT.FAILED);
    expect(edited.out.find((line) => line.startsWith('X-01'))).toContain('EXPORT_MANIFEST_HASH_MISMATCH');
  });

  it('exit 2 and the usage for no archive, an unknown option, a hash that is none, a file that is not there; a file that is no archive fails', async () => {
    const folder = scratch('not-an-export');
    for (const argv of [[], ['--sha256'], ['a.zip', '--sha256', 'xyz'], ['a.zip', '--verbose'], ['a.zip', 'b.zip']]) {
      expect(readReceiverArguments(argv)).toBeNull();
      expect(await run(argv, folder)).toMatchObject({ status: RECEIVER_EXIT.NOT_RUN, err: [RECEIVER_USAGE], out: [] });
    }
    expect(await run(['missing.zip'], folder)).toMatchObject({ status: RECEIVER_EXIT.NOT_RUN, out: [] });
    writeFileSync(join(folder, 'text.zip'), 'this is not an archive');
    const noArchive = await run(['text.zip'], folder);
    expect(noArchive.status).toBe(RECEIVER_EXIT.FAILED);
    expect(noArchive.out.at(-1)).toBe('RESULT: FAIL');
    expect(existsSync(join(folder, 'text.zip'))).toBe(true);
  });
});
