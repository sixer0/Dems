/**
 * THE RECEIVER'S VERIFICATION of an export (blueprint row 91; evidence package spec §G.2; check
 * M8-EXP-1 "export verifies at the destination").
 *
 * What a receiver holds, since wave H (gate finding G94-03, ruling D200): ONE FILE, the downloaded
 * archive `EXP-<id>.zip`, which carries its export manifest and signature inside
 * (`export/EXP-<id>.manifest.json`, `.sig`) - and the archive unpacked into a folder. An export
 * written before wave H is three files (`EXP-<id>.zip`, `export-manifest.json`,
 * `export-manifest.sig`, given as `exportDir`); both forms verify here. What it does NOT hold: the
 * Core's session key and the Core's signing key. It may hold the Core's certificate hash, received
 * out of band (`trustedCertificateSha256`); without it a re-signed export verifies against itself
 * (SEC35-06) and the result says so (`anchored: false`).
 *
 * THE CHECKS (each PASS or FAIL; `ok` is their conjunction):
 *
 *   X-01  the export manifest is a canonical, valid `dems.export-manifest/2`, its composite
 *         marking is consistent, and `export.manifestSha256` is the hash of its canonical body
 *   X-02  the export signature: of this manifest, by the certificate it names, which lies in the
 *         unpacked archive (and is a trusted one when anchors are given)
 *   X-03  the archive file. SELF-CONTAINED form: an archive cannot contain its own hash, so the
 *         manifest names none; the check holds the embedded manifest and signature to their
 *         per-export names, and - when the receiver was told the archive's hash out of band (the job
 *         answer of operation 87, the audit row of the download: `expectedArchiveSha256`) - the
 *         file to that hash. Without it the hash is computed and REPORTED (`archive.sha256`,
 *         `archive.compared: false`): every byte of every entry is still held by X-04 through the
 *         signed manifest. DETACHED form: the archive file has the recorded length and SHA-256
 *   X-04  the unpacked folder holds exactly the recorded entries, each with its length and SHA-256
 *         (and, in the self-contained form, the two export files and nothing else)
 *   X-05  THE SEALED MANIFEST AND ITS FILES, with the ONE verifier of the project
 *         (`verifyPackageV2`) run over the unpacked folder without a key: manifest structure and
 *         hash, the seal's signature and certificate, the transcript and its signed revisions,
 *         file completeness, the source mark (V-01, V-03, V-09, V-10, V-11, V-13, V-14, V-15), and
 *         the manifest is the one the export manifest names
 *   X-06  every DECRYPTED camera file has the sealed length and hashes to the sealed
 *         `tracks[].sha256Plain`, and every fragment range to its `sha256Plain` (spec §G.2
 *         "Plaintext file hash"); since D5 (audit row 153, D30 K-8, D119) the same for every
 *         decrypted pair audio file of a `/2.1` package against `audioTracks[]` / `audioFiles[]`
 *         (`AUDIO_FILE_MISSING`, `AUDIO_FILE_UNREADABLE` - the codes of verify V-04, row 154).
 *         A `/2` package has no audio file and is judged exactly as before
 *   X-07  the composite, when included: the recorded hash and the derived mark
 *
 * NOT CHECKABLE on a decrypted copy (spec §G.2): the stored-bytes hashes and the stored-bytes
 * chain (V-02's file hash, V-04, V-06, V-08). They are verified at the Core before the export is
 * written; the verifier's findings for them on this folder are expected and are not read here.
 *
 * `development` repeats the SIGNED mark of the sealed manifest (V-15): an export of a package that
 * was recorded from development sources stays marked at its destination.
 *
 * It writes nothing and never throws for anything an export can contain.
 */
import { createHash } from 'node:crypto';
import { open, readFile, readdir } from 'node:fs/promises';
import { sep } from 'node:path';
import { PackageFile, audioFilePath, cameraFilePath, manifestSignedMessage, parseManifestV2, type ManifestV2 } from '@dems/shared/evidence-package';
import { VERIFY_NOTICE, audioTracksMissingReport, pemCertificateSha256, retainedCertificatePath, verifyPackageV2, type AudioTrackMissingStated, type VerifyCheckId, type VideoAbsenceOfTrack } from '@dems/shared/evidence-verify';
import { readSigningCertificate, verifyEd25519 } from '../capture';
import { corePorts, createPackageReader } from '../evidence-verify';
import { COMPOSITE_ENTRY, EXPORT_MANIFEST_FILE, EXPORT_SIGNATURE_FILE, compositeMarkingHolds, computeExportManifestSha256, isSelfContainedExport, parseExportManifest, parseExportSignature, type ExportManifest } from './export-manifest';

export const RECEIVER_CHECKS = [
  { id: 'X-01', name: 'Export manifest' },
  { id: 'X-02', name: 'Export signature' },
  { id: 'X-03', name: 'Archive hash' },
  { id: 'X-04', name: 'Archive entries' },
  { id: 'X-05', name: 'Sealed manifest, seal and transcript' },
  { id: 'X-06', name: 'Plaintext hashes of the camera files' },
  { id: 'X-07', name: 'Composite marking' },
] as const;
export type ReceiverCheckId = (typeof RECEIVER_CHECKS)[number]['id'];

/** The checks of verify v2 that hold on a decrypted copy and that X-05 requires to PASS. */
export const RECEIVER_VERIFY_V2_CHECKS: readonly VerifyCheckId[] = ['V-01', 'V-03', 'V-09', 'V-10', 'V-11', 'V-13', 'V-14', 'V-15'];

export interface ReceiverCheck {
  readonly id: ReceiverCheckId;
  readonly name: string;
  readonly ok: boolean;
  /** Codes of what did not hold; names of files and checks, never a value. */
  readonly findings: readonly string[];
}

export interface ReceiverVerifyResult {
  readonly ok: boolean;
  readonly checks: readonly ReceiverCheck[];
  readonly exportId: string | null;
  /** The signed development-source mark; null when the sealed manifest could not be relied on. */
  readonly development: boolean | null;
  /** True when a composite is included (and then marked derived). */
  readonly derived: boolean | null;
  /**
   * Task 4 row V6 (decision C97; the request of row P1): the SIGNED member `hostProfileNotAsked` of
   * the sealed manifest, repeated - the package was sealed by a production Core on a platform
   * where the checks of the host profile are not run. PRESENT ONLY when the sealed manifest
   * carries the member AND could be relied on (X-05 passed): every other result is the result of
   * before, member for member. It fails nothing and changes no verdict.
   */
  readonly hostProfileNotAsked?: { readonly platform: string };
  /**
   * Task 4 row R1b (decision C99): the SIGNED member `tracks[].absentInSession` of the sealed
   * manifest, repeated per track that carries it - a camera stopped delivering pictures inside the
   * session. PRESENT ONLY when a track of the sealed manifest carries the member AND the manifest
   * could be relied on (X-05 passed): every other result is the result of before, member for
   * member. It fails nothing and changes no verdict.
   */
  readonly videoAbsentInSession?: readonly VideoAbsenceOfTrack[];
  /**
   * Audit row 153 (D5; D30 K-3, D119): the notice `AUDIO_TRACKS_MISSING` of verify (row 154) - the SIGNED member
   * `audioTracksMissing` of a `/2.1` sealed manifest: a pair microphone recorded nothing and its camera file holds a
   * silent track. PRESENT ONLY when the sealed manifest carries the member AND could be relied on (X-05 passed); every
   * other result is the result of before, member for member. It fails nothing and changes no verdict.
   */
  readonly audioTracksMissing?: { readonly code: typeof VERIFY_NOTICE.AUDIO_TRACKS_MISSING; readonly records: readonly AudioTrackMissingStated[]; readonly report: string };
  /** True when the signing certificates were held against anchors the caller gave. */
  readonly anchored: boolean;
  /**
   * The archive FILE, when the receiver gave it (or the detached form names it): its length and
   * SHA-256 as computed here, and whether that hash was COMPARED with a value from outside the
   * archive (the detached manifest's, or `expectedArchiveSha256`). Null: no archive file was read.
   */
  readonly archive: { readonly bytes: number; readonly sha256: string; readonly compared: boolean } | null;
  /** True for the self-contained form: the export manifest and signature were read from inside the unpacked archive. */
  readonly selfContained: boolean | null;
  /**
   * Task 4 row V5 (decision C84, cautions R-2 and R-3): WHAT THIS RUN SAYS OF A COMPROMISE MARK.
   * ABSENT - and the result is then the one of before, member for member - unless the export
   * manifest STATES a mark (`sourceSigningKey`) or the receiver SUPPLIED a list of marked
   * fingerprints (`compromisedCertificateSha256`).
   *
   *   statedByExport    the marked fingerprints the export manifest states (empty: it states none).
   *                     With every check passed the result is then a pass UNDER A NAMED STATE, never
   *                     a plain pass: the exporting Core held the source to its stored digest, and
   *                     says so under its own (unmarked) signature
   *   listSupplied      the receiver supplied a list
   *   reportedByList    a certificate this export rests on - the seal's, a revision's, or the one
   *                     of the export signature - is in the supplied list and is NOT covered by the
   *                     export's own statement: X-05 (or X-02) fails by a `..._KEY_COMPROMISED` code
   *   onlyMarkFails     `reportedByList`, and nothing else failed: "signature valid, key reported
   *                     compromised by the list supplied - not a pass", a state of its own (the
   *                     receiver holds no record of the Core to hold the package to)
   */
  readonly keyMark?: { readonly statedByExport: readonly string[]; readonly listSupplied: boolean; readonly reportedByList: boolean; readonly onlyMarkFails: boolean };
}

export interface ReceiverVerifyInput {
  /** DETACHED form only: the folder with the three files of the export. Absent: the self-contained form. */
  readonly exportDir?: string;
  /** The archive, unpacked. */
  readonly unpackedDir: string;
  /** SELF-CONTAINED form: the archive file as received (hashed for the report and for `expectedArchiveSha256`). */
  readonly archiveFile?: string;
  /** SELF-CONTAINED form: the archive's SHA-256 as the Core stated it outside the archive (operation 87 `archive.sha256`). */
  readonly expectedArchiveSha256?: string;
  /** SHA-256 of the Core's certificates, received out of band. */
  readonly trustedCertificateSha256?: readonly string[];
  /**
   * Row V5 (C84 R-2): THE MARKED FINGERPRINTS, received out of band - SHA-256 of every certificate
   * whose key the receiver was told is marked compromised (the form of the hand-over record).
   * Absent: nothing of the run changes. Present: a certificate of the list that this export rests
   * on is never relied on - unless the export manifest itself states that mark, under a signature
   * that is not of a listed certificate AND is held to `trustedCertificateSha256` (an anchored run):
   * then the exporting Core has held the source to its stored digest, and the result is the named
   * pass. In a run without anchors the export's statement covers nothing: not a pass.
   */
  readonly compromisedCertificateSha256?: readonly string[];
  readonly chunkBytes?: number;
}

/** The finding codes that say "a certificate of the supplied list" (shared verifier V-13, V-11; X-02 here). */
const KEY_COMPROMISED_CODE = /_KEY_COMPROMISED$/;
const NOT_TRUSTED_CODE = /CERTIFICATE_NOT_TRUSTED$/;

async function hashRange(file: string, offset: number, length: number | null, chunkBytes: number): Promise<{ sha256: string; bytes: number } | null> {
  try {
    const handle = await open(file, 'r');
    try {
      const hash = createHash('sha256');
      const buffer = Buffer.alloc(chunkBytes);
      let done = 0;
      for (;;) {
        const want = length === null ? chunkBytes : Math.min(chunkBytes, length - done);
        if (want === 0) break;
        const { bytesRead } = await handle.read(buffer, 0, want, offset + done);
        if (bytesRead === 0) break;
        hash.update(buffer.subarray(0, bytesRead));
        done += bytesRead;
      }
      return { sha256: hash.digest('hex'), bytes: done };
    } finally {
      await handle.close();
    }
  } catch {
    return null;
  }
}

export async function verifyExportAtDestination(input: ReceiverVerifyInput): Promise<ReceiverVerifyResult> {
  const chunkBytes = input.chunkBytes ?? 1024 * 1024;
  const findings = new Map<ReceiverCheckId, string[]>(RECEIVER_CHECKS.map((check) => [check.id, []]));
  const add = (id: ReceiverCheckId, code: string): void => void findings.get(id)?.push(code);
  const blocked = (...ids: readonly ReceiverCheckId[]): void => ids.forEach((id) => add(id, 'BLOCKED'));
  const inUnpacked = (relative: string): string => `${input.unpackedDir}${sep}${relative.split('/').join(sep)}`;
  const anchors = input.trustedCertificateSha256;
  // Row V5: the marked fingerprints the receiver supplied (undefined: none supplied), and what the export states itself.
  const marks = input.compromisedCertificateSha256;
  let statedByExport: readonly string[] = [];
  let development: boolean | null = null;
  /** Row V6: the sealed manifest's `hostProfileNotAsked.platform`, or null: the manifest carries no such member. */
  let hostProfileNotAsked: string | null = null;
  /** Row R1b: the tracks of the sealed manifest that carry `absentInSession`, with their records; empty: none does. */
  let videoAbsent: readonly VideoAbsenceOfTrack[] = [];
  /** Row 153: the sealed manifest's `audioTracksMissing` records; empty: it carries none. */
  let audioMissing: readonly AudioTrackMissingStated[] = [];
  let archiveReport: ReceiverVerifyResult['archive'] = null;
  let selfContained: boolean | null = null;

  // WHERE THE EXPORT MANIFEST AND ITS SIGNATURE LIE. Detached: the two fixed names of the export
  // folder. Self-contained: the ONE pair `export/EXP-<id>.manifest.{json,sig}` of the unpacked archive.
  let manifestFile: string | null = null;
  let signatureFile: string | null = null;
  let embeddedId: string | null = null;
  let locateFinding: string | null = null;
  if (input.exportDir !== undefined) {
    manifestFile = `${input.exportDir}${sep}${EXPORT_MANIFEST_FILE}`;
    signatureFile = `${input.exportDir}${sep}${EXPORT_SIGNATURE_FILE}`;
  } else {
    try {
      const ids = (await readdir(inUnpacked(PackageFile.EXPORT_DIR))).map((name) => /^(EXP-[0-9]{6})\.manifest\.json$/.exec(name)?.[1]).filter((id): id is string => id !== undefined);
      if (ids.length === 1 && ids[0] !== undefined) {
        embeddedId = ids[0];
        manifestFile = inUnpacked(`${PackageFile.EXPORT_DIR}/${embeddedId}.manifest.json`);
        signatureFile = inUnpacked(`${PackageFile.EXPORT_DIR}/${embeddedId}.manifest.sig`);
      } else locateFinding = ids.length === 0 ? 'EXPORT_MANIFEST_UNREADABLE' : 'EXPORT_MANIFEST_AMBIGUOUS';
    } catch {
      locateFinding = 'EXPORT_MANIFEST_UNREADABLE';
    }
  }

  const result = (manifest: ExportManifest | null): ReceiverVerifyResult => {
    const checks = RECEIVER_CHECKS.map((check) => ({ ...check, ok: (findings.get(check.id) ?? []).length === 0, findings: Object.freeze([...(findings.get(check.id) ?? [])]) }));
    const ok = checks.every((check) => check.ok);
    // Row V5: the member exists only when a mark is stated by the export or a list was supplied (see `ReceiverVerifyResult.keyMark`).
    const every = checks.flatMap((check) => check.findings);
    const reportedByList = every.some((code) => KEY_COMPROMISED_CODE.test(code));
    const keyMark =
      statedByExport.length === 0 && marks === undefined
        ? {}
        : { keyMark: Object.freeze({ statedByExport: Object.freeze([...statedByExport]), listSupplied: marks !== undefined, reportedByList, onlyMarkFails: reportedByList && every.every((code) => KEY_COMPROMISED_CODE.test(code)) }) };
    return Object.freeze({
      ok,
      checks: Object.freeze(checks),
      exportId: manifest?.export.exportId ?? null,
      development: findings.get('X-05')?.length === 0 ? development : null,
      derived: manifest === null ? null : manifest.export.derived,
      anchored: anchors !== undefined,
      archive: archiveReport,
      selfContained,
      ...keyMark,
      // Row V6: stated only from a sealed manifest the run relied on (as `development` is), and only when it carries the member.
      ...(hostProfileNotAsked !== null && findings.get('X-05')?.length === 0 ? { hostProfileNotAsked: Object.freeze({ platform: hostProfileNotAsked }) } : {}),
      // Row R1b: by the same rule - only from a sealed manifest the run relied on, and only when a track carries the member.
      ...(videoAbsent.length > 0 && findings.get('X-05')?.length === 0 ? { videoAbsentInSession: videoAbsent } : {}),
      // Row 153 (D119): by the same rule - only from a sealed manifest the run relied on, and only when it states a missing microphone.
      ...(audioMissing.length > 0 && findings.get('X-05')?.length === 0 ? { audioTracksMissing: Object.freeze({ code: VERIFY_NOTICE.AUDIO_TRACKS_MISSING, records: audioMissing, report: audioTracksMissingReport(audioMissing) }) } : {}),
    });
  };

  // X-01
  let manifest: ExportManifest;
  try {
    if (manifestFile === null) throw new Error(locateFinding ?? 'EXPORT_MANIFEST_UNREADABLE');
    manifest = parseExportManifest(await readFile(manifestFile, 'utf8'));
  } catch (error) {
    add('X-01', error instanceof Error && error.message.startsWith('EXPORT_MANIFEST_') ? error.message : 'EXPORT_MANIFEST_UNREADABLE');
    blocked('X-02', 'X-03', 'X-04', 'X-05', 'X-06', 'X-07');
    return result(null);
  }
  if (computeExportManifestSha256(manifest) !== manifest.export.manifestSha256) add('X-01', 'EXPORT_MANIFEST_HASH_MISMATCH');
  if (!compositeMarkingHolds(manifest)) add('X-01', 'EXPORT_COMPOSITE_MARKING');
  selfContained = isSelfContainedExport(manifest);
  // The form the manifest states is the form it was found in: a detached manifest inside an archive
  // (or the reverse) is not the export the Core wrote.
  if (selfContained !== (input.exportDir === undefined)) add('X-01', 'EXPORT_MANIFEST_FORM_MISMATCH');
  if (embeddedId !== null && embeddedId !== manifest.export.exportId) add('X-01', 'EXPORT_MANIFEST_NAME_MISMATCH');
  // Row V5 (C84 R-3): the export's own statement of a compromise mark. Each fingerprint it states is a certificate of THIS
  // archive - the seal's own, or a retained one among the recorded entries: a statement about a certificate that is not here is refused.
  statedByExport = manifest.sourceSigningKey?.certificateSha256 ?? [];
  for (const digest of statedByExport) {
    if (digest !== manifest.signature.certificateSha256 && !manifest.package.entries.some((entry) => entry.path === retainedCertificatePath(digest))) add('X-01', 'EXPORT_SOURCE_KEY_STATEMENT_UNFOUNDED');
  }

  // X-02
  try {
    const signature = parseExportSignature(await readFile(signatureFile ?? '', 'utf8'));
    if (signature.signedDigest !== manifest.export.manifestSha256) add('X-02', 'EXPORT_SIGNATURE_NOT_OF_MANIFEST');
    if (anchors !== undefined && !anchors.includes(signature.certificateSha256)) add('X-02', 'EXPORT_CERTIFICATE_NOT_TRUSTED');
    // Row V5: an export signed under a certificate of the supplied list attests nothing, its own statement of a mark included.
    if (marks !== undefined && marks.includes(signature.certificateSha256)) add('X-02', 'EXPORT_CERTIFICATE_KEY_COMPROMISED');
    let pemText: string | null = null;
    for (const candidate of [PackageFile.CERTIFICATE, retainedCertificatePath(signature.certificateSha256)]) {
      try {
        const candidateText = await readFile(inUnpacked(candidate), 'utf8');
        if (pemCertificateSha256(candidateText) === signature.certificateSha256) pemText = candidateText;
      } catch {
        // Not there: the next place.
      }
    }
    if (pemText === null) add('X-02', 'EXPORT_CERTIFICATE_MISSING');
    else {
      let verified = false;
      try {
        // Parses and checks the self-signature (the signer unit). The key ID is the one the file names.
        const certificate = readSigningCertificate(pemText, signature.keyId);
        verified =
          signature.algorithm === 'Ed25519' &&
          signature.signedAt >= certificate.notBefore &&
          signature.signedAt <= certificate.notAfter &&
          verifyEd25519(certificate.publicKey, manifestSignedMessage(signature.signedDigest), Uint8Array.from(Buffer.from(signature.signature, 'hex')));
      } catch {
        verified = false;
      }
      if (!verified) add('X-02', 'EXPORT_SIGNATURE_INVALID');
    }
  } catch (error) {
    add('X-02', error instanceof Error && error.message.startsWith('EXPORT_SIGNATURE_') ? error.message : 'EXPORT_SIGNATURE_UNREADABLE');
  }

  // X-03
  const exportFiles = selfContained ? [`${PackageFile.EXPORT_DIR}/${manifest.export.exportId}.manifest.json`, `${PackageFile.EXPORT_DIR}/${manifest.export.exportId}.manifest.sig`] : [];
  if (!selfContained) {
    const archive = input.exportDir === undefined ? null : await hashRange(`${input.exportDir}${sep}${manifest.package.file}`, 0, null, chunkBytes);
    if (archive === null) add('X-03', 'ARCHIVE_MISSING');
    else {
      archiveReport = { bytes: archive.bytes, sha256: archive.sha256, compared: true };
      if (archive.bytes !== manifest.package.bytes || archive.sha256 !== manifest.package.sha256) add('X-03', 'ARCHIVE_HASH_MISMATCH');
    }
  } else {
    const expected = input.expectedArchiveSha256;
    if (expected !== undefined && !/^[0-9a-f]{64}$/.test(expected)) add('X-03', 'ARCHIVE_HASH_EXPECTATION_INVALID');
    if (input.archiveFile !== undefined) {
      const archive = await hashRange(input.archiveFile, 0, null, chunkBytes);
      if (archive === null) add('X-03', 'ARCHIVE_MISSING');
      else {
        archiveReport = { bytes: archive.bytes, sha256: archive.sha256, compared: expected !== undefined };
        if (expected !== undefined && archive.sha256 !== expected) add('X-03', 'ARCHIVE_HASH_MISMATCH');
      }
    } else if (expected !== undefined) add('X-03', 'ARCHIVE_MISSING');
  }

  // X-04
  const listed = await createPackageReader(input.unpackedDir, { chunkBytes }).list(100_000);
  if (listed === null) add('X-04', 'UNPACKED_FOLDER_UNREADABLE');
  else {
    const recorded = new Map(manifest.package.entries.map((entry) => [entry.path, entry]));
    // Self-contained: the two export files are entries of the archive that the manifest cannot list (it is one of them).
    for (const path of listed) if (!recorded.has(path) && !exportFiles.includes(path)) add('X-04', `UNEXPECTED_ENTRY:${path}`);
    for (const path of exportFiles) if (!listed.includes(path)) add('X-04', `ENTRY_MISSING:${path}`);
    for (const entry of manifest.package.entries) {
      const actual = listed.includes(entry.path) ? await hashRange(inUnpacked(entry.path), 0, null, chunkBytes) : null;
      if (actual === null) add('X-04', `ENTRY_MISSING:${entry.path}`);
      else if (actual.bytes !== entry.bytes || actual.sha256 !== entry.sha256) add('X-04', `ENTRY_HASH_MISMATCH:${entry.path}`);
    }
  }

  // X-05: the one verifier, without a key, over the decrypted copy.
  let sealed: ManifestV2 | null = null;
  /** Row V5: V-13 failed ONLY because the seal's certificate is in the supplied list (the signature itself verified). */
  let sealUnderListedKey = false;
  try {
    const report = await verifyPackageV2(corePorts(input.unpackedDir, null, chunkBytes), {
      plaintext: 'WHEN_KEY_AVAILABLE',
      expected: {
        evidenceId: manifest.source.evidenceId,
        sessionId: manifest.source.sessionId,
        manifestSha256: manifest.sessionManifest.manifestSha256,
        ...(anchors === undefined ? {} : { trustedCertificateSha256: anchors }),
        // Row V5 (C84 R-2): the supplied list, less the fingerprints THIS export states as marked - for those the exporting
        // Core has held the source to its stored digest and says so under the export signature (which X-02 holds to the list
        // too). ONLY IN AN ANCHORED RUN: without `--trust` the export signature is held to the certificate inside the archive,
        // which the holder of a marked key could make himself - an unanchored statement covers nothing.
        ...(marks === undefined ? {} : { compromisedCertificateSha256: anchors === undefined ? marks : marks.filter((digest) => !statedByExport.includes(digest)) }),
      },
    });
    for (const id of RECEIVER_VERIFY_V2_CHECKS) {
      const check = report.checks.find((candidate) => candidate.id === id);
      if (check?.status === 'PASS') continue;
      // Row V5: a check that failed ONLY because its certificate is in the supplied list (alone, or beside "not trusted" for a
      // receiver who also took the fingerprint out of the trust list) names THAT code; every other failure names its first finding, as before.
      const listed = check?.findings.find((finding) => KEY_COMPROMISED_CODE.test(finding.code));
      const named = listed !== undefined && check?.findings.every((finding) => KEY_COMPROMISED_CODE.test(finding.code) || NOT_TRUSTED_CODE.test(finding.code)) === true ? listed : check?.findings[0];
      add('X-05', `${id}:${check?.status ?? 'ABSENT'}${named === undefined ? '' : `:${named.code}`}`);
      if (id === 'V-13' && named === listed && listed !== undefined) sealUnderListedKey = true;
    }
    const manifestText = await readFile(inUnpacked(PackageFile.MANIFEST), 'utf8');
    if (createHash('sha256').update(manifestText, 'utf8').digest('hex') !== manifest.sessionManifest.sha256) add('X-05', 'SESSION_MANIFEST_NOT_THE_EXPORTED_ONE');
    sealed = parseManifestV2(JSON.parse(manifestText));
    // The verifier repeats the source mark only from a manifest whose certificate it relies on. Row V5: under a certificate of
    // the supplied list it states none - that is the state X-05 already names by the V-13 line, not a second finding; the
    // sealed manifest's own flag is still held to the export manifest's.
    if ((!sealUnderListedKey && report.sources.development !== manifest.sessionManifest.developmentSources) || sealed.developmentSources !== manifest.sessionManifest.developmentSources) {
      add('X-05', 'DEVELOPMENT_MARK_MISMATCH');
    }
    development = sealed.developmentSources;
    hostProfileNotAsked = sealed.hostProfileNotAsked?.platform ?? null;
    videoAbsent = Object.freeze(
      sealed.tracks
        .filter((track) => track.absentInSession !== undefined)
        .map((track) => Object.freeze({ trackId: track.trackId, absences: Object.freeze((track.absentInSession ?? []).map((absence) => Object.freeze({ absentAtLeastMs: absence.absentAtLeastMs, absentAtMostMs: absence.absentAtMostMs, ended: absence.ended }))) })),
    );
    audioMissing = Object.freeze((sealed.audioTracksMissing ?? []).map((record) => Object.freeze({ trackId: record.trackId, silentIn: Object.freeze([...record.silentIn]), reason: record.reason })));
  } catch {
    add('X-05', 'SESSION_MANIFEST_UNREADABLE');
  }

  // X-06
  if (sealed === null) blocked('X-06');
  else {
    for (const [index, track] of sealed.tracks.entries()) {
      const path = cameraFilePath(track.trackId);
      const file = inUnpacked(path);
      const whole = await hashRange(file, 0, null, chunkBytes);
      const recorded = manifest.payload.files.find((candidate) => candidate.trackId === track.trackId);
      if (recorded === undefined || recorded.sha256Plain !== track.sha256Plain || recorded.bytes !== track.bytes || recorded.path !== path) add('X-06', `PAYLOAD_RECORD_MISMATCH:${track.trackId}`);
      if (whole === null) add('X-06', `CAMERA_FILE_MISSING:${track.trackId}`);
      else {
        if (whole.bytes !== track.bytes || whole.sha256 !== track.sha256Plain) add('X-06', `PLAINTEXT_HASH_MISMATCH:${track.trackId}`);
        for (const fragment of sealed.files[index]?.fragments ?? []) {
          const range = await hashRange(file, fragment.byteOffset, fragment.byteLength, chunkBytes);
          if (range === null || range.bytes !== fragment.byteLength || range.sha256 !== fragment.sha256Plain) add('X-06', `FRAGMENT_PLAINTEXT_MISMATCH:${track.trackId}:${fragment.seq}`);
        }
      }
    }
    // Row 153 (D5; D30 K-8, D119): the pair audio files of a `/2.1` package, by the same rule; none in a `/2` package.
    const audioTracks = sealed.audioTracks ?? [];
    for (const track of audioTracks) {
      const path = audioFilePath(track.trackId);
      const recorded = manifest.payload.audioFiles?.find((candidate) => candidate.trackId === track.trackId);
      if (recorded === undefined || recorded.sha256Plain !== track.sha256Plain || recorded.bytes !== track.bytes || recorded.path !== path) add('X-06', `PAYLOAD_RECORD_MISMATCH:${track.trackId}`);
      if (listed !== null && !listed.includes(path)) {
        add('X-06', `AUDIO_FILE_MISSING:${track.trackId}`);
        continue;
      }
      const file = inUnpacked(path);
      const whole = await hashRange(file, 0, null, chunkBytes);
      if (whole === null) add('X-06', `AUDIO_FILE_UNREADABLE:${track.trackId}`);
      else {
        if (whole.bytes !== track.bytes || whole.sha256 !== track.sha256Plain) add('X-06', `PLAINTEXT_HASH_MISMATCH:${track.trackId}`);
        for (const fragment of sealed.audioFiles?.find((entry) => entry.trackId === track.trackId)?.fragments ?? []) {
          const range = await hashRange(file, fragment.byteOffset, fragment.byteLength, chunkBytes);
          if (range === null || range.bytes !== fragment.byteLength || range.sha256 !== fragment.sha256Plain) add('X-06', `FRAGMENT_PLAINTEXT_MISMATCH:${track.trackId}:${fragment.seq}`);
        }
      }
    }
    // An audio record of the export that the sealed manifest does not state is no file of this package.
    for (const record of manifest.payload.audioFiles ?? []) if (!audioTracks.some((track) => track.trackId === record.trackId)) add('X-06', `PAYLOAD_RECORD_UNEXPECTED:${record.trackId}`);
  }

  // X-07
  if (manifest.composite !== null) {
    const composite = await hashRange(inUnpacked(COMPOSITE_ENTRY), 0, null, chunkBytes);
    if (composite === null) add('X-07', 'COMPOSITE_MISSING');
    else if (composite.sha256 !== manifest.composite.sha256 || composite.sha256 !== manifest.export.composite.sha256 || composite.bytes !== manifest.composite.bytes) add('X-07', 'COMPOSITE_HASH_MISMATCH');
    if (!manifest.export.derived) add('X-07', 'COMPOSITE_NOT_MARKED_DERIVED');
  } else if (listed !== null && listed.includes(COMPOSITE_ENTRY)) add('X-07', 'COMPOSITE_NOT_RECORDED');

  return result(manifest);
}
