/**
 * The export jobs on the running Core (blueprint row 91): what the app itself can give them.
 *
 *   coreExportDirectory(app)   the committed REQUEST of an export and the seal of an item, read
 *                              from the engine's committed state (the `audit` and `evidence`
 *                              slices). Always available: operation 87 answers from it for an
 *                              export of an item that is not a real v2 package, exactly as the
 *                              simulator does.
 *   coreExportHost(app, w)     the `EvidenceExportHost` of the jobs: the clock, the directory, the
 *                              failure row through one server-native unit of the pipeline, the
 *                              persistent error log, the fragment opener over the Core credential
 *                              store - and the wiring `w` that only the sealing row can give
 *                              (which items are real packages, where a package lies, the signer).
 *
 *   provideCoreEvidenceExport(app, w)
 *                              THE COMPOSITION (fix pass F-M8; review finding R93-01, ruling D178):
 *                              called ONCE by the sealing composition of a REAL capture operation
 *                              (`sealing-host`), which knows the Core's evidence signer. It builds
 *                              the wiring from the app (the item lookup, the package folder, the
 *                              one fragment opener, the composite gate), PROVIDES the export jobs,
 *                              and registers the boot sweep of interrupted exports (R93-04,
 *                              `boot-sweep.ts`). In capture operation SIMULATED it is never
 *                              called: no export job exists there, and an item with a sealed
 *                              package in the store is then refused by operation 42, by name.
 *
 * THE REQUEST ROW AND THE FAILURE ROW ARE READ FROM THE STORED ROWS (closing pass F-X; review
 * finding R93-11, second half). The engine's audit ring holds the newest 1000 rows and starts
 * again from them at every start of the Core, so it is only a SHORT CUT: `findRequest` and
 * `findFailure` look into it first (a row it holds is the row the database holds - a unit of work
 * commits before the ring gets its rows) and, when it has none, read the database through the
 * app's read door (`app.db.read`, `stored-trail.ts`): the `exports` row joined with its
 * `EVIDENCE_EXPORTED` audit row for a request, the newest `EVIDENCE_EXPORT_FAILED` row for a
 * failure. The answer of a job is therefore the same whatever the ring holds and after any
 * restart. A stored read that FAILS is the database's failure: the door logs and persists it and
 * the caller answers 503 `NOT_READY` - never "no such export".
 * `requestOf` / `failureOf` are the ring alone (synchronous); nothing that answers a caller uses them.
 *
 * THE TRUST LIST OF AN EXPORT IS THE RETAINED CERTIFICATE SET (task 4 row 227b; SX-09 (c), (d);
 * decision C77). `exportTrustedCertificates` is what the export's own verification of its source
 * holds the package's certificate to: the list the Core's own verify trusts
 * (`sealingVerifyTrust(...).trusted`), read from the signer store when a job starts - never the
 * ACTIVE certificate alone. So a package sealed under an EARLIER key is exported after a rotation,
 * and its archive carries, as PUBLIC certificates only, what a receiver verifies it with: the
 * package's own `device-certificate.pem` (the certificate that signed the seal, byte for byte),
 * the retained certificates of its revisions, and the certificate of the export signature
 * (`certificates/<sha256>.pem`, written by `package-export.ts`). Nothing sealed is rewritten and no
 * manifest is signed again.
 *
 * A PACKAGE UNDER A KEY MARKED COMPROMISED IS EXPORTED WITH THE NOTICE (task 4 row V5; decision
 * C84, caution R-3 of security review 230 - until then it was refused, `SOURCE_VERIFY_FAILED`).
 * `exportVerifyTrust` hands a job BOTH lists of the one read of the store: the trusted
 * certificates and the marked ones. The job verifies its source by the Core's own rule
 * (`verifySealedPackageUnderCoreTrust` of `evidence-verify`, the function of operation 41): a
 * package that rests on a marked certificate passes ONLY as the package the database recorded -
 * its manifest digest and the head of its transcript revisions - and then the export manifest,
 * signed by the ACTIVE key, STATES the mark (`sourceSigningKey`: the state, the marked
 * fingerprints, `verifiedAs: STORED_DIGEST`); a receiver's verifier reads that statement and never
 * shows a plain pass. A package under a marked key that is NOT the one of record still fails the
 * job, by name: `SOURCE_SIGNED_BY_COMPROMISED_KEY`.
 */
import type { FragmentOpener } from '@dems/shared/evidence-verify';
import { AuditType, type AuditRow, type EvidenceItem } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { SignerError, type LoadedSigner } from '../capture';
import { captureOperationOf } from '../capture/fence';
import type { AuditEntry } from '../core';
import { exportDoorsOf } from '../engine';
import { coreFragmentOpener, hasSealedPackageHere, sessionPackageDir, type RealEvidenceItem } from '../evidence-verify';
import { createTranscriptStore } from '../modules/transcripts';
import type { ReadContext } from '../plugins/db';
import { sealingVerifyTrust } from '../sealing';
import { sweepExportPartials } from './boot-sweep';
import { selectedCompositeEncoder, type CompositeEncoder } from './composite';
import { evidenceExport } from './control';
import { createEvidenceExportRuntime, exportJobIdOf, type EvidenceExportHost, type ExportRequestRecord } from './jobs';
import { ExportFailureCode, ExportKind } from './package-export';
import { readStoredExportFailure, readStoredExportRequest } from './stored-trail';

/** What operation 87 needs to know of an export whatever the item is. */
export interface ExportDirectory {
  /** The request row of that export ID when the RING still holds it. A short cut: `findRequest` is the answer. */
  requestOf(exportId: string): ExportRequestRecord | null;
  /**
   * R93-11: the committed request of that export ID - the ring's row, else the STORED rows (the
   * `exports` row with its `EVIDENCE_EXPORTED` audit row). Null: no export has the ID. Rejects
   * 503 `NOT_READY` when the stored rows could not be read (logged and persisted by the read door).
   */
  findRequest(exportId: string, context?: ReadContext): Promise<ExportRequestRecord | null>;
  /** R93-11: the reason of the newest `EVIDENCE_EXPORT_FAILED` row of that job - the ring's, else the STORED row. Null: the job has none. */
  findFailure(jobId: string, context?: ReadContext): Promise<string | null>;
  /** The sealed manifest hash and signature of an item, as the engine's state holds them. */
  sealOf(evidenceId: string): { readonly manifestHash: string; readonly signatureValue: string } | null;
  /** The reason of the `EVIDENCE_EXPORT_FAILED` row of that job when the RING still holds it. A short cut: `findFailure` is the answer. */
  failureOf(jobId: string): string | null;
  /** What operations 42 and 87 and the download route need to know of an item before they act. Null: no such item. */
  itemOf(evidenceId: string): ExportItemFacts | null;
}

/** An item as the export routes judge it. */
export interface ExportItemFacts {
  readonly evidenceId: string;
  readonly sessionId: string;
  /** A sealed v2 package lies in THIS Core's store (a REAL seal, or a seed-sealed demo item): its export is a job, never the simulator's. */
  readonly sealedHere: boolean;
  /** `integritySource === 'REAL'`: the case scope of SEC35-16 applies. */
  readonly real: boolean;
  /** The operator who holds the case. */
  readonly investigatorId: string;
  /** True when the item's custody chain holds an `EXPORTED` entry of that instant (the simulator completes inside its request). */
  exportedAt(at: number): boolean;
}

/** The part of the app the directory reads. */
export interface ExportDirectoryApp {
  readonly engine: { state(): { readonly audit: { readonly rows: readonly AuditRow[] }; readonly evidence: readonly EvidenceItem[] } };
  /**
   * The read door of the runtime pool (`plugins/db`): where the stored rows of an export are read.
   * The app always has it. A double of a unit test may leave it out: then the ring alone answers.
   */
  readonly db?: { read<T>(source: string, work: (pool: Pool) => Promise<T>, context?: ReadContext): Promise<T> };
}

/** `source` of a failed stored read in the log and the persistent error log. */
export const EXPORT_REQUEST_READ_SOURCE = 'evidenceExport.storedRequest';
export const EXPORT_FAILURE_READ_SOURCE = 'evidenceExport.storedFailure';

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

export function coreExportDirectory(app: ExportDirectoryApp): ExportDirectory {
  const directory: ExportDirectory = {
    async findRequest(exportId, context) {
      const recent = directory.requestOf(exportId);
      if (recent !== null || app.db === undefined) return recent;
      return app.db.read(EXPORT_REQUEST_READ_SOURCE, (pool) => readStoredExportRequest(pool, exportId), context);
    },
    async findFailure(jobId, context) {
      const recent = directory.failureOf(jobId);
      if (recent !== null || app.db === undefined) return recent;
      return app.db.read(EXPORT_FAILURE_READ_SOURCE, (pool) => readStoredExportFailure(pool, jobId), context);
    },
    requestOf(exportId) {
      const rows = app.engine.state().audit.rows;
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index];
        if (row === undefined || row.type !== AuditType.EVIDENCE_EXPORTED || row.details['exportId'] !== exportId) continue;
        const destination = text(row.details['destination']);
        const reason = text(row.details['reason']);
        if (row.evidenceId === null || row.evidenceId === undefined || row.actorId === null || destination === null || reason === null) return null;
        const kind = row.details['kind'];
        return {
          exportId,
          evidenceId: row.evidenceId,
          auditId: row.id,
          at: row.at,
          operatorId: row.actorId,
          destination,
          reason,
          kind: kind === ExportKind.PACKAGE || kind === ExportKind.COMPOSITE ? kind : null,
        };
      }
      return null;
    },
    sealOf(evidenceId) {
      const item = app.engine.state().evidence.find((candidate) => candidate.id === evidenceId);
      return item === undefined ? null : { manifestHash: item.manifestHash, signatureValue: item.signature.value };
    },
    failureOf(jobId) {
      const rows = app.engine.state().audit.rows;
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index];
        if (row === undefined || row.type !== AuditType.EVIDENCE_EXPORT_FAILED || row.details['jobId'] !== jobId) continue;
        return text(row.details['reason']);
      }
      return null;
    },
    itemOf(evidenceId) {
      const item = app.engine.state().evidence.find((candidate) => candidate.id === evidenceId);
      if (item === undefined) return null;
      const custody = Array.isArray(item.custody) ? item.custody : [];
      return {
        evidenceId: item.id,
        sessionId: item.sessionId,
        sealedHere: typeof item.signature === 'object' && item.signature !== null && hasSealedPackageHere(item as Parameters<typeof hasSealedPackageHere>[0]),
        real: item.integritySource === 'REAL',
        investigatorId: typeof item.investigatorId === 'string' ? item.investigatorId : '',
        exportedAt: (at) => custody.some((entry) => entry.action === 'EXPORTED' && entry.at === at),
      };
    },
  };
  return directory;
}

/** What only the sealing composition knows (row 82). */
export interface CoreExportWiring {
  findItem(evidenceId: string): RealEvidenceItem | null | Promise<RealEvidenceItem | null>;
  packageDirOf(sessionId: string): string;
  /** The Core's evidence signer, or null while it cannot sign (then a job fails `SIGNER_UNAVAILABLE`). */
  signer(): LoadedSigner | null;
  trustedCertificateSha256(): readonly string[];
  /**
   * Row V5 (C84 R-3): BOTH lists of ONE read of the signer store - the trusted certificates and those of
   * keys MARKED COMPROMISED. When the wiring gives it, a job takes its trust from this one snapshot (and
   * `trustedCertificateSha256` is not asked); a wiring without it verifies its source as before, under
   * the trusted list alone.
   */
  verifyTrust?(): { readonly trusted: readonly string[]; readonly compromised: readonly string[] };
  /** The opener over the Core credential store: `coreFragmentOpener(app)` of the verify unit. */
  opener(): FragmentOpener | null;
  /** `selectedCompositeEncoder()` - null while the licence decision is open. */
  composite(): CompositeEncoder | null;
}

/** The part of the app the host uses. */
export interface ExportHostApp extends ExportDirectoryApp {
  readonly clock: { now(): number };
  readonly pipeline: { run<Value>(label: string, work: (unit: { readonly audit: { append(entry: AuditEntry): Promise<unknown> } }) => Promise<Value>): Promise<Value> };
  readonly errorLog: { append(entry: { level: 'error'; source: string; message: string; code?: string; context?: Readonly<Record<string, string>> }): void };
}

export const EXPORT_FAILED_UNIT_LABEL = 'evidenceExport.failed';

/** The audit row of a failed job: the three detail keys of C3 §5.2 and nothing else. */
export function exportFailedEntry(failure: { readonly jobId: string; readonly evidenceId: string; readonly kind: ExportKind; readonly reason: string; readonly operatorId: string | null }): AuditEntry {
  return {
    type: AuditType.EVIDENCE_EXPORT_FAILED,
    message: `Evidence export failed · ${failure.evidenceId}`,
    severity: 'WARNING',
    actorId: failure.operatorId,
    deviceId: null,
    evidenceId: failure.evidenceId,
    details: { jobId: failure.jobId, kind: failure.kind, reason: failure.reason },
  };
}

export function coreExportHost(app: ExportHostApp & { readonly engine: FastifyInstance['engine'] }, wiring: CoreExportWiring): EvidenceExportHost {
  const directory = coreExportDirectory(app);
  return {
    // R93-03: the item is marked EXPORTED, with its custody entry, when the job has completed.
    completeExport: async (completion) => void (await exportDoorsOf(app.engine).completeEvidenceExport(completion)),
    // R93-11: both from the stored rows when the ring does not hold them.
    failureOf: (jobId) => directory.findFailure(jobId),
    now: () => app.clock.now(),
    findItem: (evidenceId) => wiring.findItem(evidenceId),
    packageDirOf: (sessionId) => wiring.packageDirOf(sessionId),
    requestOf: (exportId) => directory.findRequest(exportId),
    ports: () => {
      // Row V5: one snapshot of the store's two lists per job, when the wiring has it; else the trusted list as before.
      const trust = wiring.verifyTrust?.();
      return {
        opener: wiring.opener(),
        signer: wiring.signer(),
        trustedCertificateSha256: trust === undefined ? wiring.trustedCertificateSha256() : trust.trusted,
        ...(trust === undefined ? {} : { compromisedCertificateSha256: trust.compromised }),
        composite: wiring.composite(),
      };
    },
    recordFailure: async (failure) => {
      await app.pipeline.run(EXPORT_FAILED_UNIT_LABEL, async (unit) => {
        await unit.audit.append(exportFailedEntry(failure));
      });
    },
    reportError: (entry) => app.errorLog.append({ level: 'error', source: entry.source, message: entry.message, code: entry.code, context: entry.context }),
  };
}

// ── The composition (fix pass F-M8) ──────────────────────────────────────────────────────────────

/** The boot step that removes the partial artefacts of interrupted exports. Registered after the engine's. */
export const EXPORT_SWEEP_BOOT_STEP = 'evidenceExport.sweepPartials';
const SWEEP_SOURCE = 'evidence-export.bootSweep';

/** What only the sealing composition holds: the Core's evidence signer (loaded when first read; it may throw). */
export interface CoreExportComposition {
  signer(): LoadedSigner;
}

/** `source` of the line and of the error-log entry that name why the evidence signer refused an export job (row 226c). */
export const EXPORT_SIGNER_REFUSAL_SOURCE = 'evidence-export.signer';

/** Why the evidence signer refused: a code of the signer and the key id it names. Never a location, a secret or key material. */
export interface ExportSignerRefusal {
  readonly code: string;
  readonly keyId: string | null;
}

/**
 * THE SIGNER OF A JOB WITH ITS REFUSAL KEPT (task 4 row 226c; decision C81 (4); difference D-1 of the
 * rotation scenario). A job that the signer refuses ends `SIGNER_UNAVAILABLE` (the signer could not
 * be taken) or `SIGNATURE_FAILED` (it did not sign): the two codes of the job's closed list, and
 * the job's own steps keep nothing else of the signer's error. So an operator read "the signature
 * failed" and was not told that the key was rotated under the running Core (`ACTIVE_KEY_CHANGED`: a
 * restart is the remedy), marked compromised (`KEY_COMPROMISED`) or past its certificate's validity
 * (`CERTIFICATE_NOT_VALID_NOW`).
 *
 * `signer()` is what a job reads when it starts: it forgets the refusal of the job before, takes
 * the signer and hands it on with its `sign` watched. `refusal()` is the NAMED refusal
 * (`SignerError`) of that taking or of a signature since - null when the signer refused nothing
 * or threw something without a name. Jobs run one after another, so the refusal read when a job
 * fails is that job's. The watched signer signs exactly as the one handed in: the error is passed
 * on as it was thrown.
 */
export function exportSignerWithRefusal(take: () => LoadedSigner): { signer(): LoadedSigner | null; refusal(): ExportSignerRefusal | null } {
  let refusal: ExportSignerRefusal | null = null;
  const keep = (error: unknown): void => {
    if (error instanceof SignerError) refusal = Object.freeze({ code: error.code, keyId: error.keyId });
  };
  return {
    signer() {
      refusal = null;
      let loaded: LoadedSigner;
      try {
        loaded = take();
      } catch (error) {
        keep(error);
        // No usable signing key: a job then fails `SIGNER_UNAVAILABLE` before its source is verified.
        return null;
      }
      const { signer, certificate } = loaded;
      return Object.freeze({
        certificate,
        signer: Object.freeze({
          algorithm: signer.algorithm,
          keyId: signer.keyId,
          sign: async (message: Uint8Array): Promise<Uint8Array> => {
            try {
              return await signer.sign(message);
            } catch (error) {
              keep(error);
              throw error;
            }
          },
          publicKey: (): Uint8Array => signer.publicKey(),
        }),
      });
    },
    refusal: () => refusal,
  };
}

/**
 * The signer's reason of a failed job, SAID (row 226c): one error line of the Core and one entry of
 * the persistent error log, both under the job's own failure code, with the job, the item, the
 * signer's code as `signerReason` and the key id the signer named. Only for the two codes a signer
 * can be the cause of; the code of the job and its audit row are not changed (the row's details are
 * the three keys of C3 §5.2, and the answer of operation 87 has one code: neither has a member for
 * a second reason).
 */
export function reportExportSignerRefusal(
  app: Pick<ExportHostApp, 'errorLog'> & { readonly log: { error(fields: Readonly<Record<string, unknown>>, message: string): void } },
  failure: { readonly jobId: string; readonly evidenceId: string; readonly reason: string },
  refusal: ExportSignerRefusal | null,
): void {
  if (refusal === null || (failure.reason !== ExportFailureCode.SIGNATURE_FAILED && failure.reason !== ExportFailureCode.SIGNER_UNAVAILABLE)) return;
  const message = 'an export job was refused by the evidence signer of the Core';
  const context = { jobId: failure.jobId, evidenceId: failure.evidenceId, signerReason: refusal.code, signingKeyId: refusal.keyId ?? '' };
  app.log.error({ code: failure.reason, source: EXPORT_SIGNER_REFUSAL_SOURCE, ...context }, message);
  app.errorLog.append({ level: 'error', source: EXPORT_SIGNER_REFUSAL_SOURCE, message, code: failure.reason, context });
}

/**
 * THE BOOT SWEEP on the app (R93-04): removes every `.partial` export artefact under every package
 * folder of the media store, and records each interrupted export ONCE as
 * `EVIDENCE_EXPORT_FAILED { reason: EXPORT_INTERRUPTED }` (the partial is gone afterwards, so the
 * next start finds nothing to record). Never rejects: what it could not do goes to the persistent
 * error log, and the boot goes on.
 */
export async function sweepInterruptedExports(app: ExportHostApp & { readonly config: { readonly mediaStoreDir: string } }): Promise<{ readonly removed: number; readonly recorded: number }> {
  let recorded = 0;
  try {
    const swept = await sweepExportPartials(app.config.mediaStoreDir);
    for (const entry of swept.skipped) {
      app.errorLog.append({ level: 'error', source: SWEEP_SOURCE, message: 'an entry of an export folder was not swept', code: entry.reason, context: { sessionId: entry.sessionId ?? '', entry: entry.entry } });
    }
    const directory = coreExportDirectory(app);
    const seen = new Set<string>();
    for (const partial of swept.removed) {
      if (partial.exportId === null || seen.has(partial.exportId)) continue;
      seen.add(partial.exportId);
      const item = app.engine.state().evidence.find((candidate) => candidate.sessionId === partial.sessionId);
      // R93-11: the request of an interrupted export may be older than the ring - the stored rows say whose it was.
      let request: ExportRequestRecord | null = null;
      try {
        request = await directory.findRequest(partial.exportId);
      } catch {
        // The read door has logged the database's failure; the failure row is still written, without the operator.
        app.errorLog.append({ level: 'error', source: SWEEP_SOURCE, message: 'the request of an interrupted export could not be read', code: 'EXPORT_REQUEST_NOT_READ', context: { sessionId: partial.sessionId, exportId: partial.exportId } });
      }
      const composite = swept.removed.some((other) => other.exportId === partial.exportId && other.composite);
      const jobId = exportJobIdOf(partial.exportId);
      if (item === undefined) {
        app.errorLog.append({ level: 'error', source: SWEEP_SOURCE, message: 'an interrupted export was removed and its evidence item is not known', code: 'EXPORT_INTERRUPTED_ITEM_UNKNOWN', context: { sessionId: partial.sessionId, jobId } });
        continue;
      }
      try {
        await app.pipeline.run(EXPORT_FAILED_UNIT_LABEL, async (unit) => {
          await unit.audit.append(
            exportFailedEntry({ jobId, evidenceId: item.id, kind: composite ? ExportKind.COMPOSITE : (request?.kind ?? ExportKind.PACKAGE), reason: ExportFailureCode.EXPORT_INTERRUPTED, operatorId: request?.operatorId ?? null }),
          );
        });
        recorded += 1;
      } catch {
        app.errorLog.append({ level: 'error', source: SWEEP_SOURCE, message: 'the audit row of an interrupted export could not be written', code: 'EXPORT_FAILURE_NOT_AUDITED', context: { jobId, evidenceId: item.id } });
      }
    }
    return { removed: swept.removed.length, recorded };
  } catch {
    app.errorLog.append({ level: 'error', source: SWEEP_SOURCE, message: 'the export folders could not be swept for interrupted exports', code: 'EXPORT_SWEEP_FAILED', context: {} });
    return { removed: 0, recorded };
  }
}

/**
 * THE CERTIFICATES AN EXPORT TRUSTS ITS SOURCE UNDER (task 4 row 227b; SX-09 (c), (d)): SHA-256 of
 * every retained certificate of `<dataDir>/signer` that the Core's own verify trusts - the ONE list
 * of `sealingVerifyTrust`, so the export and operation 41 cannot disagree on a package:
 *
 *   - each certificate was parsed and its self-signature verified by the store before it is listed;
 *   - only a key that is or was the ACTIVE one: a key provisioned and never active is not listed;
 *   - `production: true` (a `REAL_PRODUCTION` Core): a DEVELOPMENT-marked certificate is never
 *     listed, so a package under one is not exported by a production Core;
 *   - the certificate of a key MARKED COMPROMISED is never listed here: it is in the OTHER list of
 *     `exportVerifyTrust`, under which a package passes only as the one of record (the header);
 *   - a store that cannot be taken lists nothing (fail closed).
 *
 * Reads public certificate files only: no key is opened, and what it returns are digests.
 */
export function exportTrustedCertificates(options: { readonly dataDir: string; readonly production: boolean }): readonly string[] {
  return sealingVerifyTrust({ dataDir: options.dataDir, production: options.production }).trusted;
}

/**
 * BOTH LISTS OF ONE READ OF THE STORE (task 4 row V5; C84 R-3): `trusted` as above, and `compromised`
 * - the certificates of the retained keys that carry the compromise mark (never a development one
 * on a production Core, never a key that was not active). One call, one snapshot: a mark set while
 * a job starts is in both lists or in neither. Digests only.
 */
export function exportVerifyTrust(options: { readonly dataDir: string; readonly production: boolean }): { readonly trusted: readonly string[]; readonly compromised: readonly string[] } {
  const trust = sealingVerifyTrust({ dataDir: options.dataDir, production: options.production });
  return { trusted: trust.trusted, compromised: trust.compromised };
}

/**
 * Provides the export jobs of real packages to the app and registers the boot sweep. Called ONCE,
 * by the sealing composition of a real capture operation (one line there). Builds nothing that
 * opens a file, a key or a connection before the first job runs.
 */
export function provideCoreEvidenceExport(app: FastifyInstance, composition: CoreExportComposition): void {
  const mediaStoreDir = app.config.mediaStoreDir;
  // Row 226c: the signer of a job, and why it refused when it did (`exportSignerWithRefusal`).
  const signing = exportSignerWithRefusal(() => composition.signer());
  const signer = (): LoadedSigner | null => signing.signer();
  // Row 227b: the operation of this Core, from the one definition - a production Core never trusts a development certificate.
  // The word is the value of `CaptureOperation.REAL_PRODUCTION`, held to that type by the compiler: the export is no
  // wiring unit of the adapter layer and does not import it (rule of `capture/adapters/__tests__/static.test.ts`).
  const production = captureOperationOf(app.config) === 'REAL_PRODUCTION';
  const opener = coreFragmentOpener(app);
  const wiring: CoreExportWiring = {
    findItem: async (evidenceId) => {
      const item = app.engine.state().evidence.find((entry) => entry.id === evidenceId);
      if (item === undefined || !hasSealedPackageHere(item as Parameters<typeof hasSealedPackageHere>[0])) return null;
      const transcriptSha256 = item.transcriptSha256 ?? null;
      const head = transcriptSha256 === null ? null : await createTranscriptStore(app.db.pool).revisionHead(evidenceId);
      const revisionCount = head === null ? 0 : head.revisionNo;
      // Row V5: the hash of the last revision the database holds - the second anchor of a package under a marked key (as operation 41 hands it).
      return { evidenceId, sessionId: item.sessionId, manifestSha256: item.manifestHash, transcriptSha256, revisionCount, revisionHeadSha256: head === null || head.revisionNo === 0 ? null : head.parentSha256 };
    },
    packageDirOf: (sessionId) => sessionPackageDir(mediaStoreDir, sessionId),
    signer,
    // Row 227b: the retained set of the store, read when a job starts - not the ACTIVE certificate alone.
    trustedCertificateSha256: () => exportTrustedCertificates({ dataDir: app.config.dataDir, production }),
    // Row V5 (C84 R-3): the same read with the marked certificates beside the trusted ones - what a job is handed.
    verifyTrust: () => exportVerifyTrust({ dataDir: app.config.dataDir, production }),
    opener: () => opener,
    composite: () => selectedCompositeEncoder(),
  };
  const host = coreExportHost(app, wiring);
  const runtime = createEvidenceExportRuntime({
    ...host,
    // Row 226c (C81 (4)): a job the signer refused says WHY in the log and the error log, before its failure row is committed.
    recordFailure: async (failure) => {
      reportExportSignerRefusal(app, failure, signing.refusal());
      await host.recordFailure(failure);
    },
  });
  evidenceExport(app).provide(runtime);
  // G94-12 (wave H C1): a Core that stops does not let an export run on. The job in flight is aborted
  // (its partial artefact is removed by its own failure path), queued jobs end without running, each
  // FAILED `EXPORT_INTERRUPTED`; the close waits until none is left. Never rejects.
  app.addHook('onClose', async () => {
    try {
      await runtime.stop();
    } catch {
      app.errorLog.append({ level: 'error', source: 'evidence-export.stop', message: 'the export jobs could not be stopped at the close of the server', code: 'EXPORT_STOP_FAILED', context: {} });
    }
  });
  app.readiness.addBootStep({
    id: EXPORT_SWEEP_BOOT_STEP,
    run: async () => {
      const swept = await sweepInterruptedExports(app);
      if (swept.removed > 0) app.log.warn({ code: ExportFailureCode.EXPORT_INTERRUPTED, source: SWEEP_SOURCE, removed: swept.removed, recorded: swept.recorded }, 'partial artefacts of interrupted exports were removed');
    },
  });
}
