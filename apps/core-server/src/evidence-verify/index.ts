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
import { sep } from 'node:path';
import { VERIFY_REPORT_MAX_FINDINGS, VERIFY_REPORT_MAX_FRAGMENTS, type EvidenceVerifyResultBody } from '@dems/shared/api';
import { PackageFile, packageFolderName } from '@dems/shared/evidence-package';
import { verifyPackageV2, type FragmentOpener, type HashFactory, type PackageVerifyResult, type VerifyCheckId, type VerifyPorts } from '@dems/shared/evidence-verify';
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
}

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
  readonly record: VerdictRecorder;
  /** A test reads in small chunks. */
  readonly chunkBytes?: number;
}

export interface RealVerificationRun {
  readonly body: EvidenceVerifyResultBody;
  readonly report: PackageVerifyResult;
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
        return { publicKey: certificate.publicKey, notBefore: certificate.notBefore, notAfter: certificate.notAfter };
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
  return {
    evidenceId,
    ok: report.ok,
    at,
    tracks: [],
    files: report.files.map((file) => {
      const plainOk = file.plainOk === true;
      return {
        fileId: file.file,
        trackId: file.trackId as 'VIDEO-01' | 'VIDEO-02',
        storedOk: file.storedOk,
        plainOk,
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
    fragments: report.fragments.slice(0, VERIFY_REPORT_MAX_FRAGMENTS).map((fragment) => ({ ...fragment, trackId: fragment.trackId as 'VIDEO-01' | 'VIDEO-02' })),
    failedFragmentCount: report.fragments.length,
    transcriptState: { ...report.transcriptState },
    // Decision D160: the model of the sealed transcript, when a document is sealed and the manifest is the signed one.
    ...(report.transcriptModel === null ? {} : { transcriptModel: { ...report.transcriptModel } }),
    sources: {
      ok: report.sources.ok,
      code: report.sources.code,
      development: report.sources.development,
      report: report.sources.report,
      tracks: report.sources.tracks.map((track) => ({ ...track, trackId: track.trackId as 'VIDEO-01' | 'VIDEO-02' })),
      audioIntervals: report.sources.audioIntervals.map((interval) => ({ ...interval })),
    },
    // Decision D147: the development-key fact, when a manifest was read. Never part of `signatureOk`.
    ...(report.signature.developmentKey === null ? {} : { signature: { developmentKey: report.signature.developmentKey } }),
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

export function createRealEvidenceVerification(options: RealVerificationOptions): RealVerification {
  async function run(principal: Principal, evidenceId: string): Promise<RealVerificationRun | null> {
    const item = await options.findItem(evidenceId);
    if (item === null) return null;
    // One reading of the clock per run: the verdict, its audit row and its answer carry it.
    const at = options.now();
    const report = await verifyPackageV2(corePorts(options.packageDirOf(item.sessionId), options.opener, options.chunkBytes), {
      plaintext: 'REQUIRED',
      expected: {
        evidenceId: item.evidenceId,
        sessionId: item.sessionId,
        manifestSha256: item.manifestSha256,
        transcriptSha256: item.transcriptSha256,
        revisionCount: item.revisionCount,
        trustedCertificateSha256: options.trustedCertificateSha256(),
      },
    });
    const body = Object.freeze(contractBodyOf(item.evidenceId, at, report));
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
      }),
    );
    return { body, report };
  }
  return { run, verify: async (principal, evidenceId) => (await run(principal, evidenceId))?.body ?? null };
}
