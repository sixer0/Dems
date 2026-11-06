/**
 * Export downloads (01_specs §14.5.3 export wizard; design book §19.2, §19.3; D50, D51, D67 (d);
 * review 40 R2).
 *
 * - **EV 0004** (the only item with an export in the dataset, D51): step 93's prebuilt
 *   `EXP-000031.zip`. Before saving, its bytes are hashed in the browser and compared with the SHA-256
 *   that its own `export-manifest.json` records (`checkExportPackage`), so the download proves itself.
 * - **Every other item**: the export manifest of this export, built in the browser from the package
 *   (or from the simulator for items without a package) with the eight §19.2 items, labelled DEMO.
 *   No payload archive exists for those items, and the file says so.
 *
 * The file is handed to the browser through a Blob URL (`saveBytes`). Nothing is uploaded anywhere.
 *
 * Fix wave J, pass J5 (truth rule 3f) - WHAT THE CONSOLE-WRITTEN FILES ARE ON A CORE:
 * - The export of a recording sealed on a Core is the Core's JOB (operations 42 and 87) and its signed
 *   archive comes from the Core's download route. The console writes NO file for such an item, nor for
 *   any item that is not a demonstration item: `consoleWritesExportFile` is the one rule (the wizard
 *   draws no download control without it, and `buildDemoExportManifest` refuses).
 * - A v1 / simulated DEMONSTRATION item (the dataset a development Core is seeded with) has no archive
 *   on any Core: this manifest is all there is. On the demonstration (the in-browser simulator, a Core
 *   in simulated capture) its wording is unchanged. On a Core in its own capture (`ownCapture`, the one
 *   reader `isOwnCaptureCoreState`) the file carries no `demo` member, no `simulated` member and no
 *   word of the demo console or of simulated data: it says it is the console's summary of a
 *   demonstration item this Core holds (`demonstrationItem: true`), and that it is not evidence.
 * - The same for the detail page's manifest summary of an item without a bundled package
 *   (`manifestSummaryDownload`).
 */
import {
  checkExportPackage,
  DEMO_EVIDENCE_INDEX,
  EXPORT_MANIFEST_ITEMS,
  getDemoEvidenceDocuments,
  type DemoAssetLoader,
  type DemoCheckResult,
  type DemoVerificationReport,
} from '@dems/shared/demo-data'
import type { DeviceSlice, EvidenceVerifyResult, SimOperator } from '@dems/shared/sim'
import { toWibIso } from '@dems/shared/sim'
import { isDemoItem } from './item-facts'
import type { EvidenceRow } from './model'
import { canDownload, downloadBlob } from '@/lib/download'

export type ExportDownloadPlan =
  | {
      kind: 'zip'
      /** The prebuilt package's export ID (EXP-000031), not the ID of this re-export (EXP-000032 onwards). */
      prebuiltExportId: string
      zipPath: string
      manifestPath: string
      fileName: string
      bytes: number
    }
  | { kind: 'manifest'; fileName: string }

/** What the wizard downloads for this row and export. */
export function exportDownloadPlan(row: Pick<EvidenceRow, 'pkg' | 'id'>, exportId: string): ExportDownloadPlan {
  const prebuilt = row.pkg?.export
  if (prebuilt) {
    return {
      kind: 'zip',
      prebuiltExportId: prebuilt.exportId,
      zipPath: prebuilt.zip.path,
      manifestPath: prebuilt.manifest.path,
      fileName: prebuilt.zip.path.slice(prebuilt.zip.path.lastIndexOf('/') + 1),
      bytes: prebuilt.zip.bytes,
    }
  }
  return { kind: 'manifest', fileName: `${exportId}-${row.id}-export-manifest.demo.json` }
}

/**
 * Whether the CONSOLE writes the export file of this row (pass J5; the wizard's rule since row 92 and wave H C2,
 * G94-09, now in one place). Simulated mode: always (the simulator makes no archive). Live mode: only for a
 * v1 / simulated demonstration item - never for an item with sealed files, an item sealed on this Core, a REAL
 * item, or an item whose kind the Core does not state: their export is the Core's job and the Core's archive.
 */
export function consoleWritesExportFile(row: Pick<EvidenceRow, 'item'>, live: boolean): boolean {
  if (!live) return true
  const files = (row.item as { files?: unknown }).files
  return !(Array.isArray(files) && files.length > 0) && isDemoItem(row.item)
}

/** The console was asked to write an export file for an item whose export is the Core's own archive. */
export class ExportFileNotForItemError extends Error {
  override readonly name = 'ExportFileNotForItemError'
  constructor(evidenceId: string) {
    super(`The console writes no export file for ${evidenceId}: it is not a demonstration item; its export is the archive of the Core.`)
  }
}

export interface PreparedZip {
  bytes: Uint8Array
  /** `exportPackage` check: the zip's SHA-256 against its export manifest. */
  check: DemoCheckResult
}

/** Loads the prebuilt zip and its export manifest and checks the zip hash (§19.3 rule 4). */
export async function prepareZipDownload(load: DemoAssetLoader, plan: Extract<ExportDownloadPlan, { kind: 'zip' }>): Promise<PreparedZip> {
  const [bytes, manifestBytes] = await Promise.all([load(plan.zipPath), load(plan.manifestPath)])
  return { bytes, check: checkExportPackage(bytes, manifestBytes) }
}

export interface DemoExportManifestInput {
  row: Pick<EvidenceRow, 'id' | 'item' | 'pkg'>
  exportId: string
  exportedAt: number
  operator: Pick<SimOperator, 'id' | 'displayName' | 'role'>
  destination: string
  reason: string
  /** The audit row of the EVIDENCE_EXPORTED event (§19.2 item 8 authorization reference). */
  authorizationRef: string | null
  device: Pick<DeviceSlice, 'id' | 'name' | 'identity'>
  verification: { report: DemoVerificationReport | null; simulated: EvidenceVerifyResult | null }
  /** Live mode (a Core server is the Core). With it the builder refuses an item the console writes no file for. Absent: Simulated mode. */
  live?: boolean
  /** This Core runs its own capture (`isOwnCaptureCoreState`): no `demo` / `simulated` member, and the file states what it is. Absent or false: the demonstration. */
  ownCapture?: boolean
}

/** The file's statement about itself on the demonstration, from the bundled package. Unchanged wording. */
export const EXPORT_MANIFEST_NOTICE_DEMO_PACKAGE = 'DEMO export manifest built in the browser by the DEMS demo console from the sealed DEMO package. Not evidence.'
/** The same for an item without a bundled package. Unchanged wording. */
export const EXPORT_MANIFEST_NOTICE_DEMO_SIMULATED = 'DEMO export manifest built in the browser from SIMULATED data (no DEMO package for this item). Not evidence.'
/** On a Core in its own capture, from the bundled package of the demonstration item. */
export const EXPORT_MANIFEST_NOTICE_OWN_CAPTURE_PACKAGE =
  'Export manifest summary of a demonstration item this DEMS Core server holds, written by the web console from the bundled package of that item. It is not a recording of this Core and not evidence: the Core makes no export archive for a demonstration item. A recording sealed on this Core is exported by the Core itself, as a signed archive.'
/** On a Core in its own capture, from the Core's record of the demonstration item. */
export const EXPORT_MANIFEST_NOTICE_OWN_CAPTURE_RECORD =
  "Export manifest summary of a demonstration item this DEMS Core server holds, written by the web console from the Core's record of that item. It is not a recording of this Core and not evidence: the Core makes no export archive for a demonstration item. A recording sealed on this Core is exported by the Core itself, as a signed archive."

interface ManifestDevice {
  deviceId?: string
  name?: string
  serialNumber?: string
}

function packageDevice(suffix: string): ManifestDevice | null {
  const documents = getDemoEvidenceDocuments(suffix)
  if (!documents) return null
  try {
    const manifest = JSON.parse(documents.manifestJson) as { device?: ManifestDevice }
    return manifest.device ?? null
  } catch {
    return null
  }
}

/** The DEMO export manifest (§19.2, eight items) as pretty JSON. */
export function buildDemoExportManifest(input: DemoExportManifestInput): string {
  const { row, exportId, exportedAt, operator, destination, reason, authorizationRef, device, verification } = input
  if (input.live === true && !consoleWritesExportFile(row, true)) throw new ExportFileNotForItemError(row.id)
  const ownCapture = input.ownCapture === true
  // Where the values of an item without a bundled package come from: the simulator on the demonstration, the Core's record on a Core in its own capture.
  const unpackaged = ownCapture ? ({ source: 'core-record' } as const) : ({ simulated: true } as const)
  const pkg = row.pkg
  const fromPackage = pkg !== null
  const packageDeviceInfo = pkg ? packageDevice(pkg.evidenceSuffix) : null

  const tracks = pkg
    ? pkg.tracks.map((track) => ({ trackId: track.trackId, file: track.file, sha256: track.sealedSha256, durationSec: track.durationSec }))
    : row.item.tracks.map((track) => ({ trackId: track.trackId, file: `${track.trackId}`, sha256: track.sha256, ...unpackaged }))

  const verificationBlock = verification.report
    ? {
        result: verification.report.result,
        label: verification.report.label,
        checks: verification.report.checks.map((check) => ({ id: check.id, ok: check.ok, source: check.source })),
      }
    : verification.simulated
      ? {
          result: verification.simulated.ok ? 'PASS' : 'FAIL',
          label: 'SIMULATED',
          checks: verification.simulated.tracks.map((track) => ({ id: `track:${track.trackId}`, ok: track.ok, source: 'simulated' })),
        }
      : null

  const items: Record<(typeof EXPORT_MANIFEST_ITEMS)[number]['key'], unknown> = {
    payload: {
      representation: 'Not included: DEMO manifest-only export (no archive exists for this item)',
      tracks,
    },
    sessionManifest: pkg
      ? { file: 'manifest.json', sha256: pkg.signature.signedDigest, tracks: tracks.map(({ trackId, sha256 }) => ({ trackId, sha256 })) }
      : { file: null, sha256: row.item.manifestHash, ...unpackaged },
    signature: pkg
      ? {
          algorithm: pkg.signature.algorithm,
          keyId: pkg.signature.keyId,
          purpose: pkg.signature.purpose,
          signedAt: pkg.signature.signedAt,
          signature: pkg.signature.signatureHex,
          certificate: {
            subject: DEMO_EVIDENCE_INDEX.certificate.subject,
            serialNumber: DEMO_EVIDENCE_INDEX.certificate.serialNumber,
            sha256: DEMO_EVIDENCE_INDEX.certificate.sha256,
          },
        }
      : { algorithm: row.item.signature.algorithm, keyId: row.item.signature.keyId, signature: row.item.signature.value, ...unpackaged },
    export: {
      exportId,
      exportedAt: toWibIso(exportedAt),
      exportedBy: { id: operator.id, displayName: operator.displayName, role: operator.role },
    },
    source: {
      deviceId: packageDeviceInfo?.deviceId ?? device.id,
      deviceName: packageDeviceInfo?.name ?? device.name,
      serialNumber: packageDeviceInfo?.serialNumber ?? device.identity.serialNumber,
      sessionId: pkg?.sessionId ?? row.item.sessionId,
      evidenceId: row.id,
    },
    destination: { id: destination },
    package: {
      sha256: null,
      note: 'No export archive is produced for this DEMO item; only the dataset item that was exported ships a prebuilt zip (D51).',
      verification: verificationBlock,
    },
    authorization: { purpose: reason, reference: authorizationRef },
  }

  return `${JSON.stringify(
    {
      schema: 'dems.export-manifest.demo/1',
      ...(ownCapture ? { demonstrationItem: true } : { demo: true }),
      notice: ownCapture
        ? fromPackage
          ? EXPORT_MANIFEST_NOTICE_OWN_CAPTURE_PACKAGE
          : EXPORT_MANIFEST_NOTICE_OWN_CAPTURE_RECORD
        : fromPackage
          ? EXPORT_MANIFEST_NOTICE_DEMO_PACKAGE
          : EXPORT_MANIFEST_NOTICE_DEMO_SIMULATED,
      generatedBy: 'core-web Evidence export wizard (step 47)',
      ...items,
    },
    null,
    2,
  )}\n`
}

/** What the detail page hands over as the manifest summary of a demonstration item WITHOUT a bundled package. */
export interface ManifestSummaryDownload {
  readonly text: string
  readonly fileName: string
}

/**
 * The manifest summary of an item without a bundled package (the detail page's "Download DEMO manifest summary").
 * The demonstration: the simulator's record, `simulated: true`, `<id>-manifest.simulated.json` - unchanged.
 * A Core in its own capture (pass J5): the values are that Core's record of a demonstration item, so the file says
 * that - no `simulated` member, and a file name that does not call the Core's record simulated.
 */
export function manifestSummaryDownload(row: Pick<EvidenceRow, 'id' | 'item'>, ownCapture: boolean): ManifestSummaryDownload {
  const { item } = row
  const values = { evidenceId: row.id, manifestHash: item.manifestHash, tracks: item.tracks, signature: item.signature }
  if (!ownCapture) return { text: `${JSON.stringify({ simulated: true, ...values }, null, 2)}\n`, fileName: `${row.id}-manifest.simulated.json` }
  const head = {
    record: 'CORE',
    demonstrationItem: true,
    note: "The Core server's record of this demonstration item, written by the web console. It is not a recording of this Core and not a signed manifest.",
  }
  return { text: `${JSON.stringify({ ...head, ...values }, null, 2)}\n`, fileName: `${row.id}-manifest.core-record.json` }
}

/** Hands bytes to the browser as a download (`lib/download.ts`, W92-7). Returns false where Blob URLs are unavailable. */
export function saveBytes(data: Uint8Array | string, fileName: string, mimeType: string): boolean {
  if (!canDownload()) return false
  const part: BlobPart = typeof data === 'string' ? data : new Uint8Array(data)
  downloadBlob(new Blob([part], { type: mimeType }), fileName)
  return true
}
