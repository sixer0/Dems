/**
 * What the Core server states about ONE evidence item beside its v2 members (wave H, driver C2;
 * gate findings G94-01 / -02 / -05 / -14, G89-03 / -04 / -09, G81-01 / -07 / -10, G75-03).
 *
 * ONE reader for this app, next to `item-v2.ts` and in its style: it takes `unknown`, never throws,
 * and a member it cannot read is "not reported" (`null`) - never a guess. Every component of the
 * Evidence page reads the members below THROUGH this file; the member NAMES are in the one table
 * `MEMBER`, so a renamed member is one edit.
 *
 * | Source | Members |
 * |--------|---------|
 * | Operation 40 body | `media.source` / `packageSuffix` / `fileIds` / `reason`; `access.play` / `readTranscript` / `export`; `exports[]`; `exportDestinationDefault`; `transcript.noSpeech` / `reason` (optional, read when sent) |
 * | The item (replicated slice, ops 39 / 40) | `integritySource`, `signature.simulated` / `developmentKey`, `sealedPackage`, `interrupted`, `interruptedCause` (else the custody entry), `manifestHash`, `manifestVersion`, `files`, `tracks` |
 */
import { evidenceItemKindOf, interruptedFactOf, sealedPackageOf, type EvidenceItemKind, type SealedPackageFact } from '@dems/shared/sim'
import { CAMERA_FILE_IDS, type CameraFileId } from './item-v2'

/**
 * The member names, in ONE place: the names of the CONTRACT (`packages/shared/src/api/evidence.ts`
 * `EvidenceDetailSchema` / `EvidenceMediaRefSchema`, `state-slices.ts` `EvidenceItemSchema`). Reconcile
 * pass R: `media.fileIds` and `access.readTranscript` (this table read `files` / `transcript`, which no
 * Core sends); the real-shape tests feed the contract's own examples through it, unmodified.
 */
export const MEMBER = {
  // Operation 40 body.
  media: 'media',
  mediaSource: 'source',
  mediaPackageSuffix: 'packageSuffix',
  mediaFiles: 'fileIds',
  mediaReason: 'reason',
  access: 'access',
  accessPlay: 'play',
  accessTranscript: 'readTranscript',
  accessExport: 'export',
  exports: 'exports',
  exportDestinationDefault: 'exportDestinationDefault',
  exportId: 'exportId',
  exportJobId: 'jobId',
  exportKind: 'kind',
  exportCompletedAt: 'completedAt',
  transcript: 'transcript',
  transcriptNoSpeech: 'noSpeech',
  transcriptReason: 'reason',
  // The item.
  integritySource: 'integritySource',
  sealedPackage: 'sealedPackage',
  signature: 'signature',
  signatureSimulated: 'simulated',
  signatureDevelopmentKey: 'developmentKey',
  signatureAlgorithm: 'algorithm',
  signatureKeyId: 'keyId',
  interrupted: 'interrupted',
  interruptedCause: 'interruptedCause',
  manifestHash: 'manifestHash',
  manifestVersion: 'manifestVersion',
  files: 'files',
  tracks: 'tracks',
  trackId: 'trackId',
  sha256: 'sha256',
} as const

const CODE = /^[A-Z][A-Z0-9_]{0,63}$/
const SHA256 = /^[0-9a-f]{64}$/
const MAX_EXPORTS = 100

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const flag = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null)
const code = (value: unknown): string | null => (typeof value === 'string' && CODE.test(value) ? value : null)
const text = (value: unknown, max = 64): string | null => (typeof value === 'string' && value.length > 0 && value.length <= max ? value : null)
const isCameraFile = (value: unknown): value is CameraFileId => (CAMERA_FILE_IDS as readonly unknown[]).includes(value)

// ── Operation 40 body ───────────────────────────────────────────────────────────────────────

export type MediaSourceFact = 'LIVE_STREAM' | 'DEMO_PACKAGE' | 'NONE'
const MEDIA_SOURCES: readonly string[] = ['LIVE_STREAM', 'DEMO_PACKAGE', 'NONE']

export interface FinishedExport {
  readonly exportId: string
  /** The `{id}` of operation 87: a fresh signed download path is read by it at the press. */
  readonly jobId: string
  readonly kind: string
  readonly completedAt: number | null
}

export interface DetailFacts {
  /** null: the Core reported no media source. */
  readonly mediaSource: MediaSourceFact | null
  readonly packageSuffix: string | null
  /** The camera files the sealed package really holds (1 or 2); null: not reported. */
  readonly mediaFiles: readonly CameraFileId[] | null
  /** Why no media can be played, as a code; null: not reported. */
  readonly mediaReason: string | null
  /** true / false as the Core says it for THIS caller; null: not reported (the client asks as before). */
  readonly access: { readonly play: boolean | null; readonly transcript: boolean | null; readonly export: boolean | null }
  /** The finished exports, newest first as sent; null: not reported. An entry that cannot be read is dropped. */
  readonly exports: readonly FinishedExport[] | null
  /**
   * Fix wave K (G94b-11 / -12): the destination text the Core records for an export that names none
   * (`exportDestinationDefault`); null: not reported (an older Core, the simulator) - the wizard's first option.
   */
  readonly exportDestinationDefault: string | null
  readonly transcript: { readonly noSpeech: boolean | null; readonly reason: string | null }
}

export const NO_DETAIL_FACTS: DetailFacts = {
  mediaSource: null,
  packageSuffix: null,
  mediaFiles: null,
  mediaReason: null,
  access: { play: null, transcript: null, export: null },
  exports: null,
  exportDestinationDefault: null,
  transcript: { noSpeech: null, reason: null },
}

function readCameraFiles(value: unknown): readonly CameraFileId[] | null {
  if (!Array.isArray(value)) return null
  const named = CAMERA_FILE_IDS.filter((fileId) => value.includes(fileId))
  // A list with anything but camera files, or with none, is not a list this reader vouches for.
  return named.length > 0 && value.every(isCameraFile) ? named : null
}

function readExport(value: unknown): FinishedExport | null {
  if (!isRecord(value)) return null
  const exportId = text(value[MEMBER.exportId], 32)
  const jobId = text(value[MEMBER.exportJobId], 32)
  if (exportId === null || jobId === null) return null
  const completedAt = value[MEMBER.exportCompletedAt]
  return { exportId, jobId, kind: code(value[MEMBER.exportKind]) ?? 'PACKAGE', completedAt: typeof completedAt === 'number' && Number.isFinite(completedAt) ? completedAt : null }
}

/** Reads the body of operation 40. Never throws; a member it cannot read is `null` = not reported. */
export function readDetailFacts(body: unknown): DetailFacts {
  if (!isRecord(body)) return NO_DETAIL_FACTS
  const media = isRecord(body[MEMBER.media]) ? (body[MEMBER.media] as Record<string, unknown>) : {}
  const access = isRecord(body[MEMBER.access]) ? (body[MEMBER.access] as Record<string, unknown>) : {}
  const transcript = isRecord(body[MEMBER.transcript]) ? (body[MEMBER.transcript] as Record<string, unknown>) : {}
  const source = media[MEMBER.mediaSource]
  const exports = body[MEMBER.exports]
  return {
    mediaSource: typeof source === 'string' && MEDIA_SOURCES.includes(source) ? (source as MediaSourceFact) : null,
    packageSuffix: text(media[MEMBER.mediaPackageSuffix], 8),
    mediaFiles: readCameraFiles(media[MEMBER.mediaFiles]),
    mediaReason: code(media[MEMBER.mediaReason]),
    access: { play: flag(access[MEMBER.accessPlay]), transcript: flag(access[MEMBER.accessTranscript]), export: flag(access[MEMBER.accessExport]) },
    exports: Array.isArray(exports)
      ? exports
          .slice(0, MAX_EXPORTS)
          .map(readExport)
          .filter((entry): entry is FinishedExport => entry !== null)
      : null,
    exportDestinationDefault: text(body[MEMBER.exportDestinationDefault], 120),
    transcript: { noSpeech: flag(transcript[MEMBER.transcriptNoSpeech]), reason: code(transcript[MEMBER.transcriptReason]) },
  }
}

// ── The item ────────────────────────────────────────────────────────────────────────────────

export type IntegritySourceFact = 'REAL' | 'DEMO_PACKAGE' | 'SIMULATED'
const INTEGRITY_SOURCES: readonly string[] = ['REAL', 'DEMO_PACKAGE', 'SIMULATED']

/** The class of the signing key as the ITEM states it. `NOT_REPORTED`: the member is absent - never read as a production key. */
export type KeyClassFact = 'DEVELOPMENT' | 'NOT_DEVELOPMENT' | 'NOT_ESTABLISHED' | 'NOT_REPORTED'

export interface ItemSignatureFact {
  readonly algorithm: string | null
  readonly keyId: string | null
  /** true: the simulated stand-in; false: a real signature of the Core key; null: not reported. */
  readonly simulated: boolean | null
  readonly keyClass: KeyClassFact
}

export interface SealedFileFact {
  readonly trackId: string
  readonly sha256: string
}

export interface ItemFacts {
  readonly integritySource: IntegritySourceFact | null
  /** `sealedPackage` as the Core states it; null: not stated. */
  readonly sealedPackage: SealedPackageFact | null
  /** The ONE rule of the kind of item (`@dems/shared/sim` `evidenceItemKindOf`). */
  readonly kind: EvidenceItemKind
  readonly signature: ItemSignatureFact | null
  /** The ONE interrupted fact (`interruptedFactOf`, decision D207): the Core's member from the sealed manifest, else the custody entry. true only draws the mark. */
  readonly interrupted: boolean | null
  readonly interruptedCause: string | null
  readonly manifestHash: string | null
  readonly manifestVersion: 1 | 2 | null
  /** The sealed camera files as the item names them: `files[]`, else the VIDEO entries of `tracks[]`. Never an AUDIO row, never a bundled value. */
  readonly sealedFiles: readonly SealedFileFact[]
}

function readSignature(value: unknown): ItemSignatureFact | null {
  if (!isRecord(value)) return null
  const key = value[MEMBER.signatureDevelopmentKey]
  return {
    algorithm: text(value[MEMBER.signatureAlgorithm], 32),
    keyId: text(value[MEMBER.signatureKeyId], 64),
    simulated: flag(value[MEMBER.signatureSimulated]),
    keyClass: key === true ? 'DEVELOPMENT' : key === false ? 'NOT_DEVELOPMENT' : key === null ? 'NOT_ESTABLISHED' : 'NOT_REPORTED',
  }
}

function readSealedFiles(source: Record<string, unknown>): readonly SealedFileFact[] {
  const read = (list: unknown): SealedFileFact[] =>
    Array.isArray(list)
      ? list.flatMap((entry) => {
          if (!isRecord(entry)) return []
          const trackId = entry[MEMBER.trackId]
          const sha256 = entry[MEMBER.sha256]
          return isCameraFile(trackId) && typeof sha256 === 'string' && SHA256.test(sha256) ? [{ trackId, sha256 }] : []
        })
      : []
  const files = read(source[MEMBER.files])
  return files.length > 0 ? files : read(source[MEMBER.tracks])
}

/** Reads the members of an evidence item this page words. Never throws. */
export function readItemFacts(item: unknown): ItemFacts {
  const source = isRecord(item) ? item : {}
  const integrity = source[MEMBER.integritySource]
  const version = source[MEMBER.manifestVersion]
  const manifestHash = source[MEMBER.manifestHash]
  const interrupted = interruptedFactOf(item)
  return {
    integritySource: typeof integrity === 'string' && INTEGRITY_SOURCES.includes(integrity) ? (integrity as IntegritySourceFact) : null,
    sealedPackage: sealedPackageOf(source),
    kind: evidenceItemKindOf(item),
    signature: readSignature(source[MEMBER.signature]),
    interrupted: interrupted.interrupted,
    interruptedCause: interrupted.cause,
    manifestHash: typeof manifestHash === 'string' && SHA256.test(manifestHash) ? manifestHash : null,
    manifestVersion: version === 1 || version === 2 ? version : null,
    sealedFiles: readSealedFiles(source),
  }
}

/** A REAL item: a recording of this Core (`integritySource === 'REAL'`). */
export function isRealItem(item: unknown): boolean {
  return readItemFacts(item).integritySource === 'REAL'
}

/**
 * An item SEALED ON THIS CORE: the Core states `sealedPackage` for it (a product seal, or a
 * demonstration item the seed sealed here - decision D205). The ONE rule of both clients
 * (`@dems/shared/sim` `evidenceItemKindOf`; its mapping table is tested once, in shared). Neither
 * `manifestVersion` (D-85-1), nor `files[]`, nor the signature is the test: the Core says it itself.
 */
export function isCoreSealedItem(item: unknown): boolean {
  return evidenceItemKindOf(item) === 'SEALED_HERE'
}

/**
 * A v1 / simulated DEMO item: `integritySource` is `DEMO_PACKAGE` or `SIMULATED` AND the Core states
 * no sealed package for it. Only such an item may ever be drawn with bundled demo media, a bundled
 * picture or a bundled package's values. An item that reports no `integritySource` is not a demo
 * item: absent is "not reported", never a guess.
 */
export function isDemoItem(item: unknown): boolean {
  return evidenceItemKindOf(item) === 'DEMO'
}

// ── What the page draws ─────────────────────────────────────────────────────────────────────

/** `STREAM`: the sealed player (op 88). `DEMO`: bundled demo media WITH its demo label. `NONE`: no player and no picture. */
export type MediaKind = 'STREAM' | 'DEMO' | 'NONE'

/**
 * The ONE decision of the player's source in Live mode (G94-02): by the item's media facts only.
 * Streamable -> the sealed player; demo AND the item is a demo item -> bundled demo media; anything
 * else, a member that is absent, or no answer at all (`facts === null`) -> nothing is played or drawn.
 */
export function mediaKindOf(facts: DetailFacts | null, item: unknown): MediaKind {
  if (facts === null) return 'NONE'
  if (facts.mediaSource === 'LIVE_STREAM') return 'STREAM'
  return facts.mediaSource === 'DEMO_PACKAGE' && facts.packageSuffix !== null && isDemoItem(item) ? 'DEMO' : 'NONE'
}

/** The reasons the page words; any other code is shown as a code. */
export const WORDED_MEDIA_REASONS = ['PACKAGE_MISSING', 'QUARANTINED', 'UNSEALABLE', 'NOT_SEALED', 'NOT_A_SEALED_PACKAGE', 'MANIFEST_UNREADABLE', 'CAMERA_FILE_MISSING', 'SESSION_KEY_UNAVAILABLE'] as const
export type WordedMediaReason = (typeof WORDED_MEDIA_REASONS)[number]

/** How the reason of "no playable media" is said: a worded code, a code shown as it is, or that none was reported. */
export function mediaReasonOf(facts: DetailFacts | null): { readonly kind: 'WORDED'; readonly reason: WordedMediaReason } | { readonly kind: 'CODE'; readonly reason: string } | { readonly kind: 'NOT_REPORTED' } | null {
  if (facts === null) return null
  if (facts.mediaReason !== null) {
    return (WORDED_MEDIA_REASONS as readonly string[]).includes(facts.mediaReason) ? { kind: 'WORDED', reason: facts.mediaReason as WordedMediaReason } : { kind: 'CODE', reason: facts.mediaReason }
  }
  return facts.mediaSource === null ? { kind: 'NOT_REPORTED' } : null
}

/**
 * The camera files the player asks operation 88 for: `media.fileIds` of operation 40, else the VIDEO
 * entries the item itself names. null: not reported - the player then offers what operation 88
 * answers for each file, never a pair it assumes.
 */
export function playableFilesOf(facts: DetailFacts | null, item: unknown): readonly CameraFileId[] | null {
  if (facts?.mediaFiles != null) return facts.mediaFiles
  const named = readItemFacts(item).sealedFiles.map((file) => file.trackId)
  const files = CAMERA_FILE_IDS.filter((fileId) => named.includes(fileId))
  return files.length > 0 ? files : null
}
