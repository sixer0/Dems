/**
 * Security & Audit reads and writes over the simulator (step 51; step 54 closed W51-1 and the
 * simulator side of the W1 key alignment in `packages/shared/src/sim`).
 *
 * - **Audit export with a reason (W51-1).** The simulator's `exportAudit({ reason })` refuses a
 *   reason under 5 characters (422, no audit row) and writes the reason into its AUDIT_EXPORTED row
 *   (design book §19.2 item 8, §19.3 rule 2). `exportAuditWithReason` passes the request through and
 *   reads the receipt back from that row.
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
import {
  EXPORT_REASON_MIN_LENGTH,
  type AuditRow,
  type EvidenceItem,
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

function exportRowOf(rows: readonly AuditRow[], exportId: string): AuditRow | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index] as AuditRow
    if (row.type === 'AUDIT_EXPORTED' && row.details.exportId === exportId) return row
  }
  return null
}

/**
 * The simulator's `exportAudit({ reason })`: 401, 403 (audited), 422 INVALID_REASON below 5
 * characters (no audit row), or 202 with the reason in its AUDIT_EXPORTED row. Never throws.
 */
export function exportAuditWithReason(sim: Pick<Sim, 'actions' | 'store'>, reasonText: string): AuditExportOutcome {
  const reason = reasonText.trim()
  let result: ReturnType<Sim['actions']['exportAudit']>
  try {
    result = sim.actions.exportAudit({ reason })
  } catch {
    return { ok: false, status: 500, reason: 'UNEXPECTED' }
  }
  if (!result.ok) {
    if (result.reason === 'NOT_SIGNED_IN' || result.reason === 'FORBIDDEN') {
      return { ok: false, status: result.status === 401 ? 401 : 403, reason: result.reason }
    }
    if (result.reason === 'INVALID_REASON') return { ok: false, status: 422, reason: 'INVALID_REASON' }
    return { ok: false, status: 500, reason: 'UNEXPECTED' }
  }
  const row = exportRowOf(sim.store.getState().audit.rows, result.exportId)
  const rowsValue = row?.details.rows
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
