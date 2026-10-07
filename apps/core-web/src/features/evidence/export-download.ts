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
}

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
  const pkg = row.pkg
  const fromPackage = pkg !== null
  const packageDeviceInfo = pkg ? packageDevice(pkg.evidenceSuffix) : null

  const tracks = pkg
    ? pkg.tracks.map((track) => ({ trackId: track.trackId, file: track.file, sha256: track.sealedSha256, durationSec: track.durationSec }))
    : row.item.tracks.map((track) => ({ trackId: track.trackId, file: `${track.trackId}`, sha256: track.sha256, simulated: true }))

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
      : { file: null, sha256: row.item.manifestHash, simulated: true },
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
      : { algorithm: row.item.signature.algorithm, keyId: row.item.signature.keyId, signature: row.item.signature.value, simulated: true },
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
      demo: true,
      notice: fromPackage
        ? 'DEMO export manifest built in the browser by the DEMS demo console from the sealed DEMO package. Not evidence.'
        : 'DEMO export manifest built in the browser from SIMULATED data (no DEMO package for this item). Not evidence.',
      generatedBy: 'core-web Evidence export wizard (step 47)',
      ...items,
    },
    null,
    2,
  )}\n`
}

/** Hands bytes to the browser as a download (`lib/download.ts`, W92-7). Returns false where Blob URLs are unavailable. */
export function saveBytes(data: Uint8Array | string, fileName: string, mimeType: string): boolean {
  if (!canDownload()) return false
  const part: BlobPart = typeof data === 'string' ? data : new Uint8Array(data)
  downloadBlob(new Blob([part], { type: mimeType }), fileName)
  return true
}
