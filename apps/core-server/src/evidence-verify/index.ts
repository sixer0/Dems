/**
 * Verification of a REAL sealed evidence package at the Core (blueprint row 85 / M7-W4; C3 §3
 * operation 41; evidence package spec §D; SH-07, NM-08, CS-08).
 *
 *   package-reader.ts   the package folder as a `PackageReader` (the one file with the file system)
 *   fragment-opener.ts  the port `FragmentOpener` over the Core credential store's session keys and
 *                       the product cipher (the one file that reaches the store)
 *   index.ts            this file: an item -> its folder -> the 15 checks -> the verdict of record
 *                       in the contract's shape -> recorded -> answered; and `readSealedSourceMark`,
 *                       the signed development-source mark of a package folder (row 141, D98(1))
 *
 * The rules themselves are not here: `@dems/shared/evidence-verify` holds the 15 checks as pure
 * logic. This unit supplies what the Core has - the file system, the certificate parser and
 * Ed25519 of the signer unit, a native SHA-256 - and what the Core knows from OUTSIDE the package:
 * the item's sealed manifest hash, its transcript hash, its revision count, the Core's own
 * certificates. Without those anchors a swapped or re-signed package verifies against itself.
 *
 * It registers no route, opens no database connection, logs nothing and reads no configuration:
 * everything comes in as an option (`coreFragmentOpener(app)` is what a composition hands in as
 * `opener`). It is closed (imported through this index only).
 *
 * NOT WIRED YET - nothing calls `createRealEvidenceVerification` outside the tests. See the note
 * `implementation/40_m7_verify_v2.md`, "to wire": the verdict RECORDER (no way exists yet to write
 * a verdict the Core computed into the evidence state and the audit trail), the folder of a
 * session (row 82), the trusted certificates (the signer directory, row 82 / CS-22). The fragment
 * OPENER exists (`fragment-opener.ts`, integration pass A) and is handed in by that composition.
 *
 * PINNED PER RUN. One run reads the clock once, forms one verdict, and that one frozen value is
 * what is recorded and what is answered. A verdict that could not be recorded is not answered.
 */
import { createHash } from 'node:crypto';
import type { VideoTrackId } from '@dems/shared/domain';
import { sep } from 'node:path';
import { VERIFY_REPORT_MAX_FINDINGS, VERIFY_REPORT_MAX_FRAGMENTS, type EvidenceVerifyResultBody } from '@dems/shared/api';
import { PackageFile, packageFolderName, parseManifestV2 } from '@dems/shared/evidence-package';
import { SIGNED_BY_COMPROMISED_KEY_REPORT, TranscriptRevisionsFileSchema, VERIFY_MAX_MANIFEST_BYTES, VERIFY_MAX_SMALL_FILE_BYTES, VERIFY_NOTICE, verifyPackageV2, type FragmentOpener, type HashFactory, type PackageVerifyResult, type VerifyCheckId, type VerifyPorts } from '@dems/shared/evidence-verify';
import { readSigningCertificate, verifyEd25519 } from '../capture';
import type { Principal } from '../plugins/authenticate';
import { createPackageReader } from './package-reader';

export { coreFragmentOpener } from './fragment-opener';
export { PACKAGE_READ_CHUNK_BYTES, createPackageReader } from './package-reader';

/** The members of an evidence item the two package predicates below read (the shared `EvidenceItem`, structurally). */
export interface PackagedItemFacts {
  readonly integritySource?: string | null | undefined;
  readonly manifestVersion?: number | undefined;
  readonly developmentSources?: boolean | null | undefined;
  readonly signature: { readonly algorithm: string; readonly simulated: boolean };
}

/**
 * A SEED-SEALED v2 DEMO ITEM (integration pass E3, row 82c's decision D-82c-7; ev F.2 - F.4): a demo
 * item whose package the seed sealed INTO THIS CORE'S STORE with the product pipeline and the
 * development key (`sealing-host/demo-seed`). `manifestVersion === 2` alone cannot tell it from one
 * of the 14 frozen v1 demo items (the mapping derives the version from the transcript hash): what
 * tells them apart is the SIGNATURE of the row. The frozen and the simulated items carry the
 * stand-in pair (`SIMULATED-SHA256`, simulated); only a package that was really sealed carries an
 * Ed25519 signature that is not simulated, and the mapping admits that pair on a `DEMO_PACKAGE` row
 * only when it is version 2 AND marked `developmentSources: true` (`signatureFromRow`).
 */
export function isSeedSealedDemoItem(item: PackagedItemFacts): boolean {
  return item.integritySource === 'DEMO_PACKAGE' && item.manifestVersion === 2 && item.developmentSources === true && item.signature.algorithm === 'Ed25519' && item.signature.simulated === false;
}

/**
 * An item whose sealed v2 package lies in THIS Core's evidence store: a REAL seal, or a seed-sealed
 * demo item. Every other item (the frozen v1 demo packages, the simulator's own items, a fixture's)
 * has no folder here by design - a reader that finds none for them has found the normal state.
 */
export function hasSealedPackageHere(item: PackagedItemFacts): boolean {
  return (item.integritySource === 'REAL' && item.manifestVersion === 2) || isSeedSealedDemoItem(item);
}

/** What the Core knows of a real v2 item from outside its package. */
export interface RealEvidenceItem {
  readonly evidenceId: string;
  readonly sessionId: string;
  /** `evidence_items.manifest_hash`: the digest that was signed when the item was sealed. */
  readonly manifestSha256: string;
  /** `evidence_items.transcript_sha256`; null for a transcript disabled by configuration. */
  readonly transcriptSha256: string | null;
  /** How many transcript revisions the database holds. */
  readonly revisionCount: number;
  /**
   * The hash of the LAST transcript revision the database holds (`transcript_revisions.sha256` of
   * the head); null when it holds none. Asked only for a package under a compromised key (row 227):
   * a caller that does not state it gets a failure there when the package has revisions.
   */
  readonly revisionHeadSha256?: string | null;
}

/**
 * WHAT THE CORE SAYS OF THE KEY A PACKAGE WAS SIGNED WITH (task 4 row 227; SX-09 (d)).
 *
 *   NOT_COMPROMISED                  no certificate the verdict rests on belongs to a key marked compromised
 *   COMPROMISED_KEY_STORED_DIGEST    the manifest or a transcript revision is signed by a key that was LATER
 *                                    MARKED COMPROMISED, and the package is the one this Core sealed: its
 *                                    manifest digest (and the head of its revisions) equals what the Core's
 *                                    database stored. The verdict passes, and says so - never a plain pass
 *   COMPROMISED_KEY_NOT_STORED_DIGEST  signed by such a key and NOT what the database stored: a FAILURE.
 *                                    After a compromise the holder of the key can sign anything
 */
export const SigningKeyVerdict = {
  NOT_COMPROMISED: 'NOT_COMPROMISED',
  COMPROMISED_KEY_STORED_DIGEST: 'COMPROMISED_KEY_STORED_DIGEST',
  COMPROMISED_KEY_NOT_STORED_DIGEST: 'COMPROMISED_KEY_NOT_STORED_DIGEST',
} as const;
export type SigningKeyVerdict = (typeof SigningKeyVerdict)[keyof typeof SigningKeyVerdict];

/**
 * The notice of an answer whose package is under a compromised key, carried in `notices` of
 * operation 41. Since row V4 the code and the two report lines are members of the SHARED vocabulary
 * (`VERIFY_NOTICE.SIGNED_BY_COMPROMISED_KEY`, `SIGNED_BY_COMPROMISED_KEY_REPORT`); since row V5 they
 * are those members BY REFERENCE, so the Core and the contract cannot word the state differently.
 */
export const COMPROMISED_KEY_NOTICE_CODE = VERIFY_NOTICE.SIGNED_BY_COMPROMISED_KEY;
export const COMPROMISED_KEY_NOTICE_REPORT: Readonly<Record<Exclude<SigningKeyVerdict, 'NOT_COMPROMISED'>, string>> = Object.freeze({
  COMPROMISED_KEY_STORED_DIGEST: SIGNED_BY_COMPROMISED_KEY_REPORT.COMPROMISED_KEY_STORED_DIGEST,
  COMPROMISED_KEY_NOT_STORED_DIGEST: SIGNED_BY_COMPROMISED_KEY_REPORT.COMPROMISED_KEY_NOT_STORED_DIGEST,
});

/** The verdict as the audit row and the custody entry of operation 41 carry it (C3 §3, §5). */
export interface VerdictRecord {
  readonly evidenceId: string;
  readonly ok: boolean;
  /** The server clock of the run. */
  readonly at: number;
  readonly manifestOk: boolean;
  readonly signatureOk: boolean;
  /** The camera files that did not verify, in track order. */
  readonly failedTracks: readonly string[];
  /** The custody text: null for a pass, else what did not verify, e.g. `Mismatch: VIDEO-02 fragment 3`. Names, never values. */
  readonly detail: string | null;
  /**
   * Fix wave K (G89b-04; ruling D222 (3)): the fragments whose stored bytes did not verify, as
   * `<trackId>:<seq>` in report order - the places the custody text names, for the audit row.
   * Empty for a pass and for a failure that names no fragment. Names, never values.
   */
  readonly failedFragments: readonly string[];
  /**
   * Task 4 row V5 (decision C84, caution R-1; SX-09 (d)): present - with the code of the answer's
   * notice - exactly when the verdict was formed UNDER A SIGNING KEY MARKED COMPROMISED
   * (`signingKey` of the run is not `NOT_COMPROMISED`). The recorder hands it on, and the audit row
   * and the custody entry then say so: a pass that rests on the stored digest alone is never
   * recorded as a plain pass. Absent in every other verdict.
   */
  readonly notice?: typeof COMPROMISED_KEY_NOTICE_CODE;
}

/**
 * THE SEAM to the audit trail and the evidence state. Resolves once the audit row
 * (EVIDENCE_VERIFIED / EVIDENCE_VERIFY_FAILED), the custody entry and the item's verification
 * state are committed; rejects otherwise.
 */
export type VerdictRecorder = (principal: Principal, verdict: VerdictRecord) => Promise<void>;

export interface RealVerificationOptions {
  /** The item of that ID when it has a real sealed v2 package, else null. */
  readonly findItem: (evidenceId: string) => RealEvidenceItem | null | Promise<RealEvidenceItem | null>;
  /** The folder of a session's package. */
  readonly packageDirOf: (sessionId: string) => string;
  /** The server clock. */
  readonly now: () => number;
  /** null: the Core has no session keys (then V-05 fails: at the Core the plaintext check is required). */
  readonly opener: FragmentOpener | null;
  /** SHA-256 of the Core's own signing certificates, the retained ones included (spec §C.3). */
  readonly trustedCertificateSha256: () => readonly string[];
  /**
   * SHA-256 of the Core's certificates whose key was MARKED COMPROMISED (row 227). Never trusted as
   * they stand: see `SigningKeyVerdict`. Absent or empty: no key of this Core is marked.
   */
  readonly compromisedCertificateSha256?: () => readonly string[];
  readonly record: VerdictRecorder;
  /** A test reads in small chunks. */
  readonly chunkBytes?: number;
}

export interface RealVerificationRun {
  readonly body: EvidenceVerifyResultBody;
  readonly report: PackageVerifyResult;
  /** Row 227: never `NOT_COMPROMISED` for a package or a revision under a key marked compromised. */
  readonly signingKey: SigningKeyVerdict;
}

export interface RealVerification {
  /** The seam of the evidence module: the recorded verdict in the contract's shape, or null. */
  verify(principal: Principal, evidenceId: string): Promise<EvidenceVerifyResultBody | null>;
  /** The same run with the full report of the 14 checks. */
  run(principal: Principal, evidenceId: string): Promise<RealVerificationRun | null>;
}

const SESSION_FOLDER = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;

/** The manifest file of a v1 package (`SESSION-<sessionId>/manifest.json`; the 14 frozen demo packages). */
export const PACKAGE_MANIFEST_FILE_V1 = 'manifest.json';

/**
 * The folder of a session's sealed package: `<mediaStoreDir>/SESSION-<sessionId>` (evidence
 * package spec §A.1, §A.2; decision D133 (2)). It is the one form the store scan of the reset
 * guard lists and the sealing pipeline writes. A folder named after the session alone
 * (`<mediaStoreDir>/<sessionId>`, the live media directory of capture spec §H) is NOT a package
 * and is never answered here.
 */
export function sessionPackageDir(mediaStoreDir: string, sessionId: string): string {
  if (!SESSION_FOLDER.test(sessionId)) throw new Error('a session ID that is no folder name');
  return `${mediaStoreDir}${sep}${packageFolderName(sessionId)}`;
}

/**
 * Where the manifest of a session's package lies, by manifest version (decision D133 (2)):
 * v2 `SESSION-<sessionId>/session-manifest.json`, v1 `SESSION-<sessionId>/manifest.json`.
 */
export function sessionManifestPath(mediaStoreDir: string, sessionId: string, manifestVersion: 1 | 2): string {
  return `${sessionPackageDir(mediaStoreDir, sessionId)}${sep}${manifestVersion === 2 ? PackageFile.MANIFEST : PACKAGE_MANIFEST_FILE_V1}`;
}

const nativeSha256: HashFactory = () => {
  const hash = createHash('sha256');
  return { update: (chunk) => void hash.update(chunk), digestHex: () => hash.digest('hex') };
};

/** The ports of the Core, for one package folder. */
export function corePorts(packageDir: string, opener: FragmentOpener | null, chunkBytes?: number): VerifyPorts {
  return {
    reader: createPackageReader(packageDir, chunkBytes === undefined ? {} : { chunkBytes }),
    opener,
    sha256: nativeSha256,
    readCertificate: (pemText) => {
      try {
        // Parses, and checks the self-signature (signer unit). The key ID is a label here.
        const certificate = readSigningCertificate(pemText, 'PACKAGE-CERTIFICATE');
        // The subject and the serial number are the certificate's OWN (F-M7 R88-08): V-13 holds manifest fields 25 / 26 to them.
        return { publicKey: certificate.publicKey, notBefore: certificate.notBefore, notAfter: certificate.notAfter, subject: certificate.subject, serialNumber: certificate.serialNumber };
      } catch {
        return null;
      }
    },
    // The TPM / PKCS#11 algorithm has no verifier on this machine (class C-8): it does not verify.
    verifySignature: (algorithm, publicKey, message, signature) => algorithm === 'Ed25519' && verifyEd25519(publicKey, message, signature),
  };
}

const passed = (report: PackageVerifyResult, ...ids: readonly VerifyCheckId[]): boolean =>
  ids.every((id) => report.checks.find((check) => check.id === id)?.status === 'PASS');

/**
 * The report in the shape of operation 41 (`EvidenceVerifyResult`, C3 §3). `tracks` is the v1
 * member and stays empty: a v2 item answers `files`. A flag is true only for checks that PASSED:
 * a check that was skipped is not a pass.
 *
 *   manifestOk    V-01, V-02, V-03, V-07, V-12, V-14, V-15 (the manifest and the package it describes)
 *   signatureOk   V-09, V-13
 *   transcriptOk  V-10, V-11; absent when the manifest declares that no document is sealed
 *                 (DISABLED by configuration, UNAVAILABLE at the seal): nothing of a transcript
 *                 was checked, so nothing is answered as a pass (D110, D113)
 *
 * The report members (rows 85, 119, 141): `overall`, `interrupted`, `checks` (all 15, each with
 * its findings - names, never values), `fragments` (the ones that did not verify),
 * `transcriptState` and `sources`. A list longer than the contract's bound is cut and its true
 * length answered beside it (`findingCount`, `failedFragmentCount`). The English entry lines of
 * the source report stay in the report (`verifyReportLines`); the answer carries the data.
 */
export function contractBodyOf(evidenceId: string, at: number, report: PackageVerifyResult): EvidenceVerifyResultBody {
  const transcriptOk = passed(report, 'V-10', 'V-11');
  const plainFailed = new Set((report.checks.find((check) => check.id === 'V-05')?.findings ?? []).map((finding) => finding.trackId));
  return {
    evidenceId,
    ok: report.ok,
    at,
    tracks: [],
    files: report.files.map((file) => {
      const plainOk = file.plainOk === true;
      return {
        fileId: file.file,
        trackId: file.trackId as VideoTrackId, // D60 (2026-11-04)
        storedOk: file.storedOk,
        plainOk,
        // Fix wave K (G89b-06): the plaintext check did not run for this file (`null` in the report,
        // and V-05 holds no finding of this track - a REQUIRED key that is missing is a V-05 failure
        // and stays one). `plainOk: false` is then "not a pass", not a failed comparison.
        ...(file.plainOk === null && !plainFailed.has(file.trackId) ? { plainChecked: false } : {}),
        chainOk: file.chainOk,
        fragmentCount: file.fragmentCount,
        ok: file.storedOk && plainOk && file.chainOk && file.sequenceOk,
      };
    }),
    ...(report.transcript.state === 'DISABLED' || report.transcript.state === 'UNAVAILABLE' ? {} : { transcriptOk }),
    manifestOk: passed(report, 'V-01', 'V-02', 'V-03', 'V-07', 'V-12', 'V-14', 'V-15'),
    signatureOk: passed(report, 'V-09', 'V-13'),
    overall: report.overall,
    interrupted: report.interrupted,
    checks: report.checks.map((check) => ({
      id: check.id,
      name: check.name,
      status: check.status,
      failureClass: check.failureClass,
      skipped: check.skipped,
      findings: check.findings.slice(0, VERIFY_REPORT_MAX_FINDINGS).map((finding) => ({ ...finding })),
      ...(check.findings.length > VERIFY_REPORT_MAX_FINDINGS ? { findingCount: check.findings.length } : {}),
    })),
    // D60 (2026-11-04): a failed fragment names the track of the package's own list - up to four (a legacy package never yields a third).
    fragments: report.fragments.slice(0, VERIFY_REPORT_MAX_FRAGMENTS).map((fragment) => ({ ...fragment, trackId: fragment.trackId as VideoTrackId })),
    failedFragmentCount: report.fragments.length,
    transcriptState: { ...report.transcriptState },
    // Decision D160: the model of the sealed transcript, when a document is sealed and the manifest is the signed one.
    ...(report.transcriptModel === null ? {} : { transcriptModel: { ...report.transcriptModel } }),
    sources: {
      ok: report.sources.ok,
      code: report.sources.code,
      development: report.sources.development,
      report: report.sources.report,
      // D60 (2026-11-04): the manifest names its OWN track list and the verifier read it as a prefix of the
      // widened order (`isSealedTrackList`), so a two-track legacy package answers its two lines here exactly
      // as before; a four-track package answers four. The cast states what that parse already established.
      tracks: report.sources.tracks.map((track) => ({ ...track, trackId: track.trackId as VideoTrackId })),
      audioIntervals: report.sources.audioIntervals.map((interval) => ({ ...interval })),
    },
    // Decisions D147, D178 (F-M7 R88-08): the development-key fact of the certificate that verified the signature;
    // `null` = not established (never `false` from an unverified package). Never part of `signatureOk`.
    signature: { developmentKey: report.signature.developmentKey },
    // R88-06: what the format does not cover, said on every v2 answer.
    notices: report.notices.map((notice) => ({ ...notice })),
  };
}

/** What the custody entry says of a failed run: the places, never a value. */
export function custodyDetailOf(report: PackageVerifyResult): string | null {
  if (report.ok) return null;
  const fragments = report.fragments.filter((fragment) => !fragment.storedOk).map((fragment) => `${fragment.trackId} fragment ${fragment.seq}`);
  if (fragments.length > 0) return `Mismatch: ${fragments.slice(0, 8).join(', ')}${fragments.length > 8 ? ` and ${fragments.length - 8} more` : ''}`;
  const failed = report.checks.filter((check) => check.status === 'FAIL').map((check) => check.id);
  return `Mismatch: ${failed.join(', ') || 'not verified'}`;
}

/** What a package folder's SIGNED manifest says of its sources, as far as it can be relied on. */
export interface SealedSourceMark {
  /**
   * The manifest of the folder is a readable v2 manifest, hashes to its recorded digest, carries a
   * signature its own certificate verifies, agrees with every anchor given, and its source mark is
   * well-formed and consistent (V-01, V-03, V-09, V-13 and V-15 all PASS).
   */
  readonly signed: boolean;
  /** True only when `signed` and at least one source is not PRODUCTION. Never true on doubt. */
  readonly development: boolean;
}

/** What the caller knows of the item from outside the folder; the manifest must agree with each. */
export interface SealedSourceMarkAnchors {
  readonly sessionId: string;
  readonly evidenceId?: string;
  /** `evidence_items.manifest_hash`. */
  readonly manifestSha256?: string;
  /** The Core's own certificates, when the caller has them. */
  readonly trustedCertificateSha256?: readonly string[];
}

/**
 * THE DISK SIDE OF THE RESET GUARD (decision D98(1); SEC35-42; `ev` §H.5). Reads the manifest, the
 * signature file and the certificate of ONE package folder - no camera file, no key - and answers
 * whether its SIGNED manifest marks the package as recorded from development sources.
 *
 * FAIL CLOSED. Anything else than a verified development mark answers `development: false`: a
 * missing or unreadable manifest, a v1 manifest, an edited or re-hashed one, a manifest of another
 * session or with another digest than the anchor, a malformed mark, an all-PRODUCTION manifest,
 * and any error of the reader. It never throws.
 *
 * WHAT IT DOES NOT PROVE. Without `trustedCertificateSha256` the signature is checked against the
 * certificate that lies in the folder: a package re-signed with a key of the attacker's own passes
 * that half. The anchor `manifestSha256` (the digest the database recorded at the seal) is what
 * catches it; a caller without either anchor learns only that the folder is self-consistent.
 */
export async function readSealedSourceMark(packageDir: string, anchors: SealedSourceMarkAnchors): Promise<SealedSourceMark> {
  const none: SealedSourceMark = Object.freeze({ signed: false, development: false });
  try {
    const report = await verifyPackageV2(corePorts(packageDir, null), {
      scope: 'MANIFEST',
      expected: {
        sessionId: anchors.sessionId,
        ...(anchors.evidenceId === undefined ? {} : { evidenceId: anchors.evidenceId }),
        ...(anchors.manifestSha256 === undefined ? {} : { manifestSha256: anchors.manifestSha256 }),
        ...(anchors.trustedCertificateSha256 === undefined ? {} : { trustedCertificateSha256: anchors.trustedCertificateSha256 }),
      },
    });
    if (!passed(report, 'V-01', 'V-03', 'V-09', 'V-13', 'V-15')) return none;
    return Object.freeze({ signed: true, development: report.sources.code === 'DEVELOPMENT' && report.sources.development === true });
  } catch {
    return none;
  }
}

const HEX64 = /^[0-9a-f]{64}$/;
const NOT_TRUSTED_CODES: readonly string[] = ['CERTIFICATE_NOT_TRUSTED', 'REVISION_CERTIFICATE_NOT_TRUSTED'];
/** True when a check says that a certificate the package rests on is not one the verifier trusts. */
const restsOnUntrustedCertificate = (report: PackageVerifyResult): boolean => report.checks.some((check) => check.findings.some((finding) => NOT_TRUSTED_CODES.includes(finding.code)));

/**
 * The hash of the last revision of the package's own list, null for a package without a list or
 * with an empty one, `undefined` when the list cannot be read (then nothing is anchored).
 */
async function packageRevisionHead(packageDir: string): Promise<string | null | undefined> {
  try {
    const reader = createPackageReader(packageDir);
    if ((await reader.entry(PackageFile.TRANSCRIPT_REVISIONS)).kind === 'ABSENT') return null;
    const list = TranscriptRevisionsFileSchema.parse(JSON.parse(await reader.readText(PackageFile.TRANSCRIPT_REVISIONS, VERIFY_MAX_SMALL_FILE_BYTES)));
    return list.revisions.at(-1)?.sha256 ?? null;
  } catch {
    return undefined;
  }
}

/** What the Core's own verification of one sealed package gives: the report of record and what it says of the signing key. */
export interface CoreTrustVerification {
  readonly report: PackageVerifyResult;
  /** Never `NOT_COMPROMISED` for a package or a revision under a key marked compromised. */
  readonly signingKey: SigningKeyVerdict;
}

/**
 * THE CORE'S OWN VERIFICATION OF ONE SEALED PACKAGE UNDER ITS TRUST LISTS (row 227, SX-09 (d); made
 * one function by row V5 so that operation 41 and the export's verification of its source are the
 * same rule): the 15 checks with the session key REQUIRED and every anchor of the item, held to
 * `trustedCertificateSha256`; and, for a package that rests on a certificate of
 * `compromisedCertificateSha256`, the second look described below. It records nothing.
 */
export async function verifySealedPackageUnderCoreTrust(input: {
  readonly packageDir: string;
  readonly item: RealEvidenceItem;
  readonly opener: FragmentOpener | null;
  readonly chunkBytes?: number;
  readonly trustedCertificateSha256: readonly string[];
  readonly compromisedCertificateSha256: readonly string[];
}): Promise<CoreTrustVerification> {
  const { packageDir, item } = input;
  const verifyTrusting = (trustedCertificateSha256: readonly string[]): Promise<PackageVerifyResult> =>
    verifyPackageV2(corePorts(packageDir, input.opener, input.chunkBytes), {
      plaintext: 'REQUIRED',
      expected: {
        evidenceId: item.evidenceId,
        sessionId: item.sessionId,
        manifestSha256: item.manifestSha256,
        transcriptSha256: item.transcriptSha256,
        revisionCount: item.revisionCount,
        trustedCertificateSha256,
      },
    });
  const trusted = [...input.trustedCertificateSha256];
  let report = await verifyTrusting(trusted);
  let signingKey: SigningKeyVerdict = SigningKeyVerdict.NOT_COMPROMISED;

  // UNDER A COMPROMISED KEY (row 227; SX-09 (d)). A certificate of a key that was marked compromised is
  // NOT in the trusted list, so such a package has failed above (V-13, or V-11 for a revision). It is
  // looked at once more with those certificates admitted - and may pass ONLY as the package this Core
  // sealed: the manifest digest the database stored (the anchor of every run, here required to be a
  // real digest) and, where it has revisions, the head of their chain as the database holds it. The
  // holder of a compromised key can sign anything; he cannot make it hash to what was stored.
  const compromised = input.compromisedCertificateSha256.filter((digest) => !trusted.includes(digest));
  if (compromised.length > 0 && restsOnUntrustedCertificate(report)) {
    const admitted = await verifyTrusting([...trusted, ...compromised]);
    // Still resting on a certificate that is neither trusted nor a marked one of this Core: a foreign key. The first verdict stands.
    if (!restsOnUntrustedCertificate(admitted)) {
      let stored = admitted.ok && HEX64.test(item.manifestSha256);
      if (stored) {
        const head = await packageRevisionHead(packageDir);
        // No revisions on either side, or the same head on both. A caller that does not state the head anchors nothing.
        stored = head !== undefined && (item.revisionCount === 0 ? head === null : head !== null && item.revisionHeadSha256 === head);
      }
      signingKey = stored ? SigningKeyVerdict.COMPROMISED_KEY_STORED_DIGEST : SigningKeyVerdict.COMPROMISED_KEY_NOT_STORED_DIGEST;
      // A pass: the admitted run. A failure: the admitted run when it names what differs (`MANIFEST_NOT_OF_ITEM`, ...);
      // when it found nothing itself (the revision head differs), the first run, which fails on the certificate.
      if (stored || !admitted.ok) report = admitted;
    }
  }
  return { report, signingKey };
}

/**
 * THE MARKED CERTIFICATES A PACKAGE RESTS ON (row V5; C84 R-3): of `compromisedCertificateSha256`,
 * the fingerprints that the package's own seal or one of its transcript revisions names -
 * ascending, each once. Read from the manifest and the revision list of the folder (public data);
 * no key is opened. A folder that cannot be read answers the empty list: the caller, which has
 * just verified the package, then states nothing it did not find.
 */
export async function markedCertificatesOfPackage(packageDir: string, compromisedCertificateSha256: readonly string[]): Promise<readonly string[]> {
  const found = new Set<string>();
  try {
    const reader = createPackageReader(packageDir);
    const manifest = parseManifestV2(JSON.parse(await reader.readText(PackageFile.MANIFEST, VERIFY_MAX_MANIFEST_BYTES)));
    found.add(manifest.signature.certificate.sha256);
    if ((await reader.entry(PackageFile.TRANSCRIPT_REVISIONS)).kind === 'FILE') {
      const list = TranscriptRevisionsFileSchema.parse(JSON.parse(await reader.readText(PackageFile.TRANSCRIPT_REVISIONS, VERIFY_MAX_SMALL_FILE_BYTES)));
      for (const revision of list.revisions) if (revision.signature.certificateSha256 !== null) found.add(revision.signature.certificateSha256);
    }
  } catch {
    return Object.freeze([]);
  }
  return Object.freeze([...found].filter((digest) => compromisedCertificateSha256.includes(digest)).sort());
}

export function createRealEvidenceVerification(options: RealVerificationOptions): RealVerification {
  async function run(principal: Principal, evidenceId: string): Promise<RealVerificationRun | null> {
    const item = await options.findItem(evidenceId);
    if (item === null) return null;
    // One reading of the clock per run: the verdict, its audit row and its answer carry it.
    const at = options.now();
    const packageDir = options.packageDirOf(item.sessionId);
    // Row V5: the two runs and the rule "under a compromised key" are ONE function, which the export's own verification of
    // its source calls too (`verifySealedPackageUnderCoreTrust`) - operation 41 and an export cannot disagree on a package.
    const { report, signingKey } = await verifySealedPackageUnderCoreTrust({
      packageDir,
      item,
      opener: options.opener,
      ...(options.chunkBytes === undefined ? {} : { chunkBytes: options.chunkBytes }),
      trustedCertificateSha256: options.trustedCertificateSha256(),
      compromisedCertificateSha256: options.compromisedCertificateSha256?.() ?? [],
    });
    const answered = contractBodyOf(item.evidenceId, at, report);
    // Never a plain pass, never a silent failure: the state is in the answer, by its code and in words.
    const body = Object.freeze(
      signingKey === SigningKeyVerdict.NOT_COMPROMISED ? answered : { ...answered, notices: [...(answered.notices ?? []), { code: COMPROMISED_KEY_NOTICE_CODE, report: COMPROMISED_KEY_NOTICE_REPORT[signingKey] }] },
    );
    // A package under a compromised key that is not the stored one never answers a pass, whatever a later edit of the above does.
    if (signingKey === SigningKeyVerdict.COMPROMISED_KEY_NOT_STORED_DIGEST && body.ok) throw new Error('a package under a compromised key that is not the stored one was about to pass');
    await options.record(
      principal,
      Object.freeze({
        evidenceId: item.evidenceId,
        ok: body.ok,
        at,
        manifestOk: body.manifestOk,
        signatureOk: body.signatureOk,
        failedTracks: Object.freeze((body.files ?? []).filter((file) => !file.ok).map((file) => file.trackId)),
        detail: custodyDetailOf(report),
        failedFragments: Object.freeze(report.ok ? [] : report.fragments.filter((fragment) => !fragment.storedOk).map((fragment) => `${fragment.trackId}:${fragment.seq}`)),
        // Row V5 (C84 R-1): the audit row and the custody entry of this verdict carry the notice - never a plain pass.
        ...(signingKey === SigningKeyVerdict.NOT_COMPROMISED ? {} : { notice: COMPROMISED_KEY_NOTICE_CODE }),
      }),
    );
    return { body, report, signingKey };
  }
  return { run, verify: async (principal, evidenceId) => (await run(principal, evidenceId))?.body ?? null };
}
