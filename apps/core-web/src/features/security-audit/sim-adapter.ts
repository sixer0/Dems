/**
 * Security & Audit reads and writes over the simulator (step 51; step 54 closed W51-1 and the
 * simulator side of the W1 key alignment in `packages/shared/src/sim`).
 *
 * - **Audit export with a reason (W51-1).** The simulator's `exportAudit({ reason })` refuses a
 *   reason under 5 characters (422, no audit row) and writes the reason into its AUDIT_EXPORTED row
 *   (design book §19.2 item 8, §19.3 rule 2). `auditExportOutcome` reads the receipt back from that
 *   row. In Live mode (plan row W75; 04_client_integration_spec §8.2 A7) the result union is the
 *   Live binding's (CL-19) and the row is the Core's, in the replica by the time the action settles
 *   (CL-16); the entry count is then the row's sequence minus one, the stored rows the export covers
 *   (implementation/39 §7.4: the Core's answer counts the same way; the row's own `details.rows`
 *   counts the Core's 1,000-row ring, finding F-1 there). `exportAuditWithReason` is the synchronous
 *   form over a simulator; the dialog runs the action through `settle` in both modes.
 * - **Keys and certificates (W1, D67 (c)).** The simulator's DEVICE_CERT and EVIDENCE_SIGNING_KEY are
 *   now the step-93 DEMO Ed25519 certificate and key (fingerprints guarded by the shared
 *   alignment test). The keys panel still takes the certificate's serial, subject and validity from
 *   `@dems/shared/demo-data` (the simulator keeps fingerprints only), keeps the simulator's TLS
 *   server entry, and labels every DEMO item DEMO (P13).
 * - **Package integrity (P13).** The tamper panel summarises the DEMO packages' precomputed
 *   verification (labelled "DEMO - precomputed"), joined with the shared `matchDemoPackage` (D84:
 *   evidence suffix, session suffix, case sequence and subject, any demo day). The simulator's own
 *   EV 0005 is tampered on AUDIO-02 too since step 54, so both verdicts agree.
 */
import { coreActionsOf } from '@dems/shared/live'
import {
  EXPORT_REASON_MIN_LENGTH,
  type AuditRow,
  type EvidenceItem,
  type ExportResult,
  type KeyRecord,
  type Sim,
} from '@dems/shared/sim'
import { DEMO_EVIDENCE_INDEX, matchDemoPackage, type DemoEvidencePackage } from '@dems/shared/demo-data'

// ── Audit export with a mandatory reason (W51-1) ──────────────────────────────────────────

export const AUDIT_EXPORT_REASON_MIN = EXPORT_REASON_MIN_LENGTH

export function isValidExportReason(reason: string): boolean {
  return reason.trim().length >= AUDIT_EXPORT_REASON_MIN
}

export interface AuditExportReceipt {
  exportId: string
  reason: string
  /** From the AUDIT_EXPORTED row the simulator wrote (`details.rows`, `head`, `chainOk`). */
  entries: number | null
  head: string | null
  chainOk: boolean | null
  auditRowId: string | null
}

export type AuditExportOutcome =
  | { ok: true; receipt: AuditExportReceipt }
  | { ok: false; status: 401 | 403 | 422 | 500; reason: 'NOT_SIGNED_IN' | 'FORBIDDEN' | 'INVALID_REASON' | 'UNEXPECTED' }

/** The newest AUDIT_EXPORTED row of `exportId` in the ring (the simulator's, or the Core's replica), or null. */
export function exportRowOf(rows: readonly AuditRow[], exportId: string): AuditRow | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index] as AuditRow
    if (row.type === 'AUDIT_EXPORTED' && row.details.exportId === exportId) return row
  }
  return null
}

const UNEXPECTED: AuditExportOutcome = { ok: false, status: 500, reason: 'UNEXPECTED' }

/**
 * The dialog's outcome of one export result (the simulator's union, or the Live binding's, CL-19):
 * 401, 403 (audited), 422 INVALID_REASON, or the receipt read back from the AUDIT_EXPORTED row in
 * `rows`. `coreRows`: count the entries as the stored rows before that row (Live mode), not as the
 * row's `details.rows` (the simulator's ring count). Pure; never throws.
 */
export function auditExportOutcome(
  result: ExportResult,
  rows: readonly AuditRow[],
  reasonText: string,
  coreRows = false,
): AuditExportOutcome {
  const reason = reasonText.trim()
  if (!result.ok) {
    if (result.reason === 'NOT_SIGNED_IN' || result.reason === 'FORBIDDEN') {
      return { ok: false, status: result.status === 401 ? 401 : 403, reason: result.reason }
    }
    if (result.reason === 'INVALID_REASON') return { ok: false, status: 422, reason: 'INVALID_REASON' }
    return UNEXPECTED
  }
  const row = exportRowOf(rows, result.exportId)
  const rowsValue = coreRows ? (row ? row.seq - 1 : null) : row?.details.rows
  const headValue = row?.details.head
  const chainValue = row?.details.chainOk
  return {
    ok: true,
    receipt: {
      exportId: result.exportId,
      reason,
      entries: typeof rowsValue === 'number' ? rowsValue : null,
      head: typeof headValue === 'string' ? headValue : null,
      chainOk: typeof chainValue === 'boolean' ? chainValue : null,
      auditRowId: row?.id ?? null,
    },
  }
}

/** Whether a Core result is still on its way (a Live source answers later; the simulator at once). */
function isPending(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function'
}

/**
 * The simulator's `exportAudit({ reason })`: 401, 403 (audited), 422 INVALID_REASON below 5
 * characters (no audit row), or 202 with the reason in its AUDIT_EXPORTED row. Never throws. The
 * synchronous form over a simulator (the actions through `coreActionsOf`, CL-12); a Live source
 * answers later, so its callers use `settle` with `auditExportOutcome` instead.
 */
export function exportAuditWithReason(sim: Sim, reasonText: string): AuditExportOutcome {
  const reason = reasonText.trim()
  let result: ReturnType<ReturnType<typeof coreActionsOf>['exportAudit']>
  try {
    result = coreActionsOf(sim).exportAudit({ reason })
  } catch {
    return UNEXPECTED
  }
  if (isPending(result)) return UNEXPECTED
  return auditExportOutcome(result, sim.store.getState().audit.rows, reason)
}

// ── Keys and certificates (W1, D67) ───────────────────────────────────────────────────────

export type KeyEntryId = 'DEVICE_CERT' | 'EVIDENCE_SIGNING_KEY' | 'TLS_SERVER' | 'HARDWARE_ROOT'
export type KeySource = 'DEMO_PACKAGE' | 'SIMULATED' | 'HARDWARE'

export interface KeyEntry {
  id: KeyEntryId
  algorithm: string
  /** Colon-grouped or hex fingerprint text as displayed, or null. */
  fingerprint: string | null
  serial: string | null
  /** Certificate common name without the DEMO suffix (the DEMO chip carries it). */
  subject: string | null
  keyId: string | null
  publicKeyHex: string | null
  notBefore: number | null
  expiresAt: number | null
  source: KeySource
}

/** `CN=DEMS-IR-01 (DEMO — NOT FOR PRODUCTION), OU=…` → `DEMS-IR-01`. */
export function commonName(subject: string): string | null {
  const match = /CN=([^,]+)/.exec(subject)
  if (!match?.[1]) return null
  return match[1].replace(/\s*\(.*\)\s*$/, '').trim() || null
}

function parseTime(iso: string): number | null {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

/**
 * The keys panel entries: the DEMO device certificate and signing key (Ed25519, from the
 * packages), the simulator's TLS server certificate, and the TPM-resident hardware root key.
 */
export function keyEntries(simKeys: readonly KeyRecord[], hardwareRoot: string): KeyEntry[] {
  const { certificate, key } = DEMO_EVIDENCE_INDEX
  const tls = simKeys.find((entry) => entry.id === 'TLS_SERVER') ?? null
  const entries: KeyEntry[] = [
    {
      id: 'DEVICE_CERT',
      algorithm: key.algorithm,
      fingerprint: certificate.sha256,
      serial: certificate.serialNumber,
      subject: commonName(certificate.subject),
      keyId: null,
      publicKeyHex: null,
      notBefore: parseTime(certificate.notBefore),
      expiresAt: parseTime(certificate.notAfter),
      source: 'DEMO_PACKAGE',
    },
    {
      id: 'EVIDENCE_SIGNING_KEY',
      algorithm: key.algorithm,
      fingerprint: null,
      serial: null,
      subject: null,
      keyId: key.keyId,
      publicKeyHex: key.publicKeyHex,
      notBefore: null,
      expiresAt: parseTime(certificate.notAfter),
      source: 'DEMO_PACKAGE',
    },
  ]
  if (tls) {
    entries.push({
      id: 'TLS_SERVER',
      algorithm: tls.algorithm,
      fingerprint: tls.fingerprint,
      serial: null,
      subject: null,
      keyId: null,
      publicKeyHex: null,
      notBefore: null,
      expiresAt: tls.expiresAt,
      source: 'SIMULATED',
    })
  }
  entries.push({
    id: 'HARDWARE_ROOT',
    algorithm: hardwareRoot,
    fingerprint: null,
    serial: null,
    subject: null,
    keyId: null,
    publicKeyHex: null,
    notBefore: null,
    expiresAt: null,
    source: 'HARDWARE',
  })
  return entries
}

// ── Package integrity (P13; the shared join, D84) ───────────────────────────────────────

type JoinableEvidence = Pick<EvidenceItem, 'id' | 'caseNumber' | 'subjectName' | 'sessionId'>

/**
 * The DEMO package of a simulator evidence item: the shared `matchDemoPackage` (D84, R9): evidence
 * and session suffix, case sequence and subject (review 40 M4 / R2: a presenter-created session
 * seals into suffix 0014, the recording scenario's package, but with another case or subject).
 */
export function guardedPackageOf(item: JoinableEvidence): DemoEvidencePackage | null {
  return matchDemoPackage(item)
}

export interface PackageFailure {
  evidenceSuffix: string
  /** The simulator's evidence ID (IDs are re-dated with the simulator clock). */
  evidenceId: string
  /** Failed track IDs, e.g. `AUDIO-02`, or other failed check IDs. */
  failed: string[]
}

export interface PackageIntegrity {
  pass: number
  fail: number
  failures: PackageFailure[]
  /** The generator's label, e.g. "DEMO - precomputed" (P13). */
  label: string
}

/** Precomputed verification of the DEMO packages that join (guarded) to simulator evidence. */
export function packageIntegrity(evidence: readonly JoinableEvidence[]): PackageIntegrity {
  let pass = 0
  let fail = 0
  let label = ''
  const failures: PackageFailure[] = []
  for (const item of evidence) {
    const pkg = guardedPackageOf(item)
    if (!pkg) continue
    label = pkg.verification.label
    if (pkg.verification.result === 'PASS') {
      pass += 1
    } else {
      fail += 1
      failures.push({
        evidenceSuffix: pkg.evidenceSuffix,
        evidenceId: item.id,
        failed: pkg.verification.failed.map((id) => id.replace(/^track:/, '')),
      })
    }
  }
  return { pass, fail, failures, label }
}

export interface PackageExportRecord {
  exportId: string
  sha256: string
  authorizationRef: string
}

/** The DEMO export record of an exported evidence item (EV 0004 → EXP-000031), or null. */
export function packageExportOf(item: JoinableEvidence | null): PackageExportRecord | null {
  if (!item) return null
  const pkg = guardedPackageOf(item)
  if (!pkg?.export) return null
  return { exportId: pkg.export.exportId, sha256: pkg.export.zip.sha256, authorizationRef: pkg.export.authorizationRef }
}
