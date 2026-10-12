/**
 * What the Core server states about ONE evidence item beyond its sealed members (wave H, driver C2;
 * gate findings G94-02, G94-05, G94-07, G94-09, G94-14, G89-03, G89-04, G89-09, G81-01, G81-07,
 * G81-10, G75-03; rulings D198 to D200). The companion of `item-v2.ts`, in the same defensive
 * style: every reader takes `unknown`, never throws, and a member it cannot read is NOT REPORTED
 * (`null`) - never a guess, and never read as the favourable value.
 *
 * ONE table of member names (`MEMBER`): the item members of operations 39 / 40 and of the
 * replicated `evidence` slice, and the members of operation 40's body. Every component of this app
 * reads them through this file. The names are the ones the contract carries in this tree
 * (`packages/shared/src/api/evidence.ts` `EvidenceDetailSchema`, `state-slices.ts`
 * `EvidenceItemSchema`): `media.fileIds`, `access.readTranscript` (reconcile pass R: this table read
 * `files` / `transcript`, which no Core sends; the real-shape tests feed the contract's own examples
 * through it, unmodified). The contract carries no `transcript.noSpeech` / `transcript.reason`
 * on operation 40: the reason of a transcript that will never come is `details.reason` of
 * operation 84's `409`, and "no speech" is an ASSEMBLED document without segments.
 *
 * | Export | Rule |
 * |--------|------|
 * | `readItemFacts` | the item's own members: interrupted + cause, the signature and its key class, the integrity source, the VIDEO entries of `files` / `tracks` |
 * | `readDetailFacts` | operation 40's body: media source / files / reason, what THIS caller may do, the finished exports |
 * | `isDemoItem` | a v1 / simulated demo item: DEMO_PACKAGE / SIMULATED and the Core states no `sealedPackage` (the ONE rule of both clients, `@dems/shared/sim` `evidenceItemKindOf`) |
 * | `hasSealedPackageHere` | the Core states `sealedPackage`: a product seal, or a seed-sealed demo item (D205) |
 * | `mediaKindOf` | what the Media tab, the hero, the row and Play may show in Live mode |
 * | `cameraFilesFor` | the camera files a player may offer: the Core's list, else the item's own, else not reported |
 */
import { evidenceItemKindOf, interruptedFactOf, sealedPackageOf, type EvidenceItemKind, type SealedPackageFact } from '@dems/shared/sim';
import { CAMERA_FILE_IDS, type CameraFileId } from './item-v2';

/** The ONE table of member names. A name that changes in the contract changes here and nowhere else. */
export const MEMBER = {
  item: {
    interrupted: 'interrupted',
    interruptedCause: 'interruptedCause',
    signature: 'signature',
    signatureAlgorithm: 'algorithm',
    signatureKeyId: 'keyId',
    signatureSimulated: 'simulated',
    signatureDevelopmentKey: 'developmentKey',
    integritySource: 'integritySource',
    sealedPackage: 'sealedPackage',
    manifestVersion: 'manifestVersion',
    developmentSources: 'developmentSources',
    files: 'files',
    tracks: 'tracks',
    trackId: 'trackId',
    /** Fix wave L (contract_wave_l.md section 4, G89c-04): the SIGNED manifest's per-track format on a file entry. */
    fileProfile: 'profile',
  },
  detail: {
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
    exportId: 'exportId',
    exportJobId: 'jobId',
    exportKind: 'kind',
    exportCompletedAt: 'completedAt',
    /** Fix wave K (contract_wave_k.md S2 section 2): the text the Core records when an export names no destination. */
    exportDestinationDefault: 'exportDestinationDefault',
    /** Fix wave J (contract_wave_j.md J-S 3, JA2-03): which export outputs this Core can produce. */
    exportKinds: 'exportKinds',
    /** Fix wave L (contract_wave_l.md section 4, G89c-04): the item as operation 40 answers it, and its notice. */
    evidence: 'evidence',
    streamProfileNotice: 'streamProfileNotice',
    noticeTracks: 'tracks',
    noticeStream: 'stream',
    noticeConfigured: 'configured',
  },
} as const;

export type IntegritySourceFact = 'REAL' | 'DEMO_PACKAGE' | 'SIMULATED';
export type MediaSourceFact = 'LIVE_STREAM' | 'DEMO_PACKAGE' | 'NONE';

export interface SignatureFacts {
  readonly algorithm: string;
  readonly keyId: string;
  /** True: the simulated stand-in. False: a real Ed25519 signature of the Core key. */
  readonly simulated: boolean;
  /** `true` / `false` as the item states it; null: not reported (never read as a production key). */
  readonly developmentKey: boolean | null;
}

export interface ItemFacts {
  /** The ONE interrupted fact (`interruptedFactOf`, decision D207): the Core's member from the sealed manifest, else the custody entry; null: nothing states it. */
  readonly interrupted: boolean | null;
  /** The code of the interruption, or null (not reported / none named). */
  readonly interruptedCause: string | null;
  readonly signature: SignatureFacts | null;
  readonly integritySource: IntegritySourceFact | null;
  /** `sealedPackage` as the Core states it; null: not stated. */
  readonly sealedPackage: SealedPackageFact | null;
  /** The ONE rule of the kind of item (`@dems/shared/sim` `evidenceItemKindOf`). */
  readonly kind: EvidenceItemKind;
  readonly manifestVersion: 1 | 2 | null;
  readonly developmentSources: boolean | null;
  /** The VIDEO entries the item's own `files` name (file order), else those of its `tracks`; empty: not reported. */
  readonly cameraFiles: readonly CameraFileId[];
  /** The item's own track IDs, in the item's order (a v2 item names its camera files only). */
  readonly trackIds: readonly string[];
}

export interface MediaFacts {
  readonly source: MediaSourceFact;
  readonly packageSuffix: string | null;
  /** The camera files the sealed package really holds (1 or 2); null: not reported. */
  readonly files: readonly CameraFileId[] | null;
  /** The code of `NONE`; null: not reported. */
  readonly reason: string | null;
}

export interface AccessFacts {
  /** `false`: this caller is refused; `true`: permitted; null: not reported (the client asks as before). */
  readonly play: boolean | null;
  readonly transcript: boolean | null;
  readonly export: boolean | null;
}

export type ExportKindFact = 'PACKAGE' | 'COMPOSITE';

export interface FinishedExportFact {
  readonly exportId: string;
  readonly jobId: string;
  readonly kind: ExportKindFact;
  readonly completedAt: number | null;
}

export interface DetailFacts {
  /** null: operation 40 named no media source this client can read. */
  readonly media: MediaFacts | null;
  readonly access: AccessFacts;
  /** The finished exports, newest first as answered; null: not reported. */
  readonly exports: readonly FinishedExportFact[] | null;
  /** `exportDestinationDefault` of operation 40; null: not stated (never a default of this app). */
  readonly exportDestinationDefault: string | null;
  /**
   * Fix wave J (JA2-03): `exportKinds` of operation 40, read BY NAME - per kind whether a request of it is
   * accepted. Null: not stated. An entry that is not `{ kind: 'PACKAGE' | 'COMPOSITE', available: boolean }` is
   * dropped (an unknown kind is not offered).
   */
  readonly exportKinds: readonly { readonly kind: 'PACKAGE' | 'COMPOSITE'; readonly available: boolean }[] | null;
  /**
   * Fix wave L (G89c-04): the format of each camera file AS SIGNED (manifest field 36, `evidence.files[].profile`
   * of operation 40), in file order; null: the Core stated none (no sealed manifest was read). Never `profileId`.
   */
  readonly sealedProfiles: readonly SealedProfileFact[] | null;
  /**
   * Fix wave L (G89c-04): the session's `STREAM_PROFILE_DIFFERS` notice as the item carries it; null: the Core
   * holds no such notice for the item's session (never read as "was checked and equal").
   */
  readonly streamProfileNotice: readonly StreamProfileNoticeFact[] | null;
}

export interface SealedProfileFact {
  readonly trackId: CameraFileId;
  readonly profile: string;
}

export interface StreamProfileNoticeFact {
  readonly trackId: CameraFileId;
  /** What the recorded stream declared: the value the manifest states. */
  readonly stream: string;
  /** What the selector had configured for the track. */
  readonly configured: string;
}

const CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
/** A profile code as the contract's schema accepts it (`H264_720P30`, `H264_720P27.67`). */
const PROFILE = /^[A-Za-z0-9_.-]{1,48}$/;
const profileCode = (value: unknown): string | null => (typeof value === 'string' && PROFILE.test(value) ? value : null);
const EXPORT_ID = /^EXP-\d{6,}$/;
const JOB_ID = /^EXPJ-\d{6,}$/;
const SUFFIX = /^\d{4}$/;
const MAX_EXPORTS = 100;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 64): string | null => (typeof value === 'string' && value.length > 0 && value.length <= max ? value : null);
const flag = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);
const code = (value: unknown): string | null => (typeof value === 'string' && CODE.test(value) ? value : null);
const isCameraFile = (value: unknown): value is CameraFileId => (CAMERA_FILE_IDS as readonly unknown[]).includes(value);

/** The camera files a list of `{ trackId }` entries names, in the order of `CAMERA_FILE_IDS`, each once. */
function cameraEntries(value: unknown): CameraFileId[] {
  if (!Array.isArray(value)) return [];
  const named = value.map((entry) => (isRecord(entry) ? entry[MEMBER.item.trackId] : null));
  return CAMERA_FILE_IDS.filter((fileId) => named.includes(fileId));
}

function readSignature(value: unknown): SignatureFacts | null {
  if (!isRecord(value)) return null;
  const algorithm = text(value[MEMBER.item.signatureAlgorithm], 32);
  const keyId = text(value[MEMBER.item.signatureKeyId]);
  const simulated = flag(value[MEMBER.item.signatureSimulated]);
  if (algorithm === null || keyId === null || simulated === null) return null;
  return { algorithm, keyId, simulated, developmentKey: flag(value[MEMBER.item.signatureDevelopmentKey]) };
}

/** Reads the facts an evidence item states about itself. Never throws. */
export function readItemFacts(item: unknown): ItemFacts {
  const source = isRecord(item) ? item : {};
  const integritySource = source[MEMBER.item.integritySource];
  const manifestVersion = source[MEMBER.item.manifestVersion];
  const fromFiles = cameraEntries(source[MEMBER.item.files]);
  const tracks = source[MEMBER.item.tracks];
  const interrupted = interruptedFactOf(item);
  return {
    interrupted: interrupted.interrupted,
    interruptedCause: interrupted.cause,
    sealedPackage: sealedPackageOf(source),
    kind: evidenceItemKindOf(item),
    signature: readSignature(source[MEMBER.item.signature]),
    integritySource: integritySource === 'REAL' || integritySource === 'DEMO_PACKAGE' || integritySource === 'SIMULATED' ? integritySource : null,
    manifestVersion: manifestVersion === 1 || manifestVersion === 2 ? manifestVersion : null,
    developmentSources: flag(source[MEMBER.item.developmentSources]),
    cameraFiles: fromFiles.length > 0 ? fromFiles : cameraEntries(tracks),
    trackIds: Array.isArray(tracks)
      ? tracks.map((entry) => (isRecord(entry) ? text(entry[MEMBER.item.trackId]) : null)).filter((id): id is string => id !== null)
      : [],
  };
}

function readMedia(value: unknown): MediaFacts | null {
  if (!isRecord(value)) return null;
  const source = value[MEMBER.detail.mediaSource];
  if (source !== 'LIVE_STREAM' && source !== 'DEMO_PACKAGE' && source !== 'NONE') return null;
  const suffix = value[MEMBER.detail.mediaPackageSuffix];
  const files = value[MEMBER.detail.mediaFiles];
  const named = Array.isArray(files) ? CAMERA_FILE_IDS.filter((fileId) => files.includes(fileId)) : [];
  return {
    source,
    packageSuffix: source === 'DEMO_PACKAGE' && typeof suffix === 'string' && SUFFIX.test(suffix) ? suffix : null,
    // A list with an entry that is no camera file is not a list this client can read: not reported.
    files: Array.isArray(files) && named.length > 0 && files.every(isCameraFile) ? named : null,
    reason: source === 'NONE' ? code(value[MEMBER.detail.mediaReason]) : null,
  };
}

function readExport(value: unknown): FinishedExportFact | null {
  if (!isRecord(value)) return null;
  const exportId = value[MEMBER.detail.exportId];
  const jobId = value[MEMBER.detail.exportJobId];
  if (typeof exportId !== 'string' || !EXPORT_ID.test(exportId) || typeof jobId !== 'string' || !JOB_ID.test(jobId)) return null;
  const completedAt = value[MEMBER.detail.exportCompletedAt];
  return {
    exportId,
    jobId,
    kind: value[MEMBER.detail.exportKind] === 'COMPOSITE' ? 'COMPOSITE' : 'PACKAGE',
    completedAt: typeof completedAt === 'number' && Number.isFinite(completedAt) && completedAt >= 0 ? completedAt : null,
  };
}

/** The per-file format the SIGNED manifest states, from an item's `files` (file order); null when no entry states one. */
export function readSealedProfiles(item: unknown): readonly SealedProfileFact[] | null {
  const files = isRecord(item) ? item[MEMBER.item.files] : null;
  if (!Array.isArray(files)) return null;
  const stated: SealedProfileFact[] = [];
  for (const entry of files) {
    if (!isRecord(entry)) continue;
    const trackId = entry[MEMBER.item.trackId];
    const profile = profileCode(entry[MEMBER.item.fileProfile]);
    if (isCameraFile(trackId) && profile !== null && !stated.some((fact) => fact.trackId === trackId)) stated.push({ trackId, profile });
  }
  return stated.length === 0 ? null : stated;
}

function readStreamProfileNotice(item: unknown): readonly StreamProfileNoticeFact[] | null {
  const notice = isRecord(item) ? item[MEMBER.detail.streamProfileNotice] : null;
  const tracks = isRecord(notice) ? notice[MEMBER.detail.noticeTracks] : null;
  if (!Array.isArray(tracks)) return null;
  const stated: StreamProfileNoticeFact[] = [];
  for (const entry of tracks) {
    if (!isRecord(entry)) continue;
    const trackId = entry[MEMBER.item.trackId];
    const stream = profileCode(entry[MEMBER.detail.noticeStream]);
    const configured = profileCode(entry[MEMBER.detail.noticeConfigured]);
    if (isCameraFile(trackId) && stream !== null && configured !== null) stated.push({ trackId, stream, configured });
  }
  return stated.length === 0 ? null : stated;
}

/** Reads operation 40's body. Never throws. An entry of `exports` that cannot be read is dropped (never invented). */
export function readDetailFacts(body: unknown): DetailFacts {
  const source = isRecord(body) ? body : {};
  const access = isRecord(source[MEMBER.detail.access]) ? (source[MEMBER.detail.access] as Record<string, unknown>) : {};
  const exports = source[MEMBER.detail.exports];
  return {
    media: readMedia(source[MEMBER.detail.media]),
    access: {
      play: flag(access[MEMBER.detail.accessPlay]),
      transcript: flag(access[MEMBER.detail.accessTranscript]),
      export: flag(access[MEMBER.detail.accessExport]),
    },
    exports: Array.isArray(exports)
      ? exports
          .slice(0, MAX_EXPORTS)
          .map(readExport)
          .filter((entry): entry is FinishedExportFact => entry !== null)
      : null,
    exportDestinationDefault: text(source[MEMBER.detail.exportDestinationDefault], 200),
    exportKinds: readExportKinds(source[MEMBER.detail.exportKinds]),
    sealedProfiles: readSealedProfiles(source[MEMBER.detail.evidence]),
    streamProfileNotice: readStreamProfileNotice(source[MEMBER.detail.evidence]),
  };
}

/** What a client knows before operation 40 answered, and when it did not: nothing is reported. */
export const NO_DETAIL_FACTS: DetailFacts = readDetailFacts(null);

/**
 * The item's package was sealed by THIS Core: the Core states `sealedPackage` for it (a product
 * seal, or a demonstration item the seed sealed here - decision D205). The ONE rule of both clients
 * (`@dems/shared/sim` `evidenceItemKindOf`; its mapping table is tested once, in shared). Neither
 * `manifestVersion` (D-85-1) nor the signature is the test: the Core says it itself.
 */
export function hasSealedPackageHere(item: Pick<ItemFacts, 'kind'>): boolean {
  return item.kind === 'SEALED_HERE';
}

/**
 * A v1 / simulated demo item: `integritySource` DEMO_PACKAGE or SIMULATED and the Core states no
 * sealed package for it. An item that reports no integrity source is NOT a demo item: nothing
 * bundled is ever shown for it.
 */
export function isDemoItem(item: Pick<ItemFacts, 'kind'>): boolean {
  return item.kind === 'DEMO';
}

/** A REAL item: a recording of this Core. */
export function isRealItem(item: Pick<ItemFacts, 'integritySource'>): boolean {
  return item.integritySource === 'REAL';
}

/**
 * What a Live screen may show as the media of an item (G94-02):
 *   SEALED  the Core says the sealed files are streamable: the sealed player (operation 88);
 *   DEMO    the Core named a bundled demo package AND the item is a demo item: bundled media, labelled;
 *   NONE    anything else - no player and no picture.
 */
export type MediaKind = 'SEALED' | 'DEMO' | 'NONE';

export function mediaKindOf(media: MediaFacts | null, item: Pick<ItemFacts, 'kind'>): MediaKind {
  if (media === null) return 'NONE';
  if (media.source === 'LIVE_STREAM') return 'SEALED';
  if (media.source === 'DEMO_PACKAGE' && media.packageSuffix !== null && isDemoItem(item)) return 'DEMO';
  return 'NONE';
}

/** The codes of `media.reason` this app words (`evidence.itemFacts.media.reason.*`); any other code is shown as a code. */
export const WORDED_MEDIA_REASONS = ['PACKAGE_MISSING', 'QUARANTINED', 'UNSEALABLE', 'NOT_SEALED', 'NOT_A_SEALED_PACKAGE', 'MANIFEST_UNREADABLE', 'CAMERA_FILE_MISSING', 'SESSION_KEY_UNAVAILABLE'] as const;

/** The i18n key and options of the reason line under "no playable media". */
export function mediaReasonLine(reason: string | null): { readonly key: string; readonly options?: { readonly reason: string } } {
  if (reason === null) return { key: 'evidence.itemFacts.media.reason.NOT_REPORTED' };
  // Fix wave J (JA2-02; contract_wave_j.md J-S 2): a session sealed on a SIMULATED Core is a demonstration record
  // without media - said so, not "no sealed package ... in the evidence store".
  if (reason === 'DEMONSTRATION_RECORD') return { key: 'common.truth.demonstrationRecord' };
  if ((WORDED_MEDIA_REASONS as readonly string[]).includes(reason)) return { key: `evidence.itemFacts.media.reason.${reason}` };
  return { key: 'evidence.itemFacts.media.reasonOther', options: { reason } };
}

/**
 * The camera files a player may offer: the Core's own list (operation 40 `media.fileIds`), else the
 * VIDEO entries of the item's `files` / `tracks`; null when neither reports any - the player then
 * offers what operation 88 answers, never a pair the Core did not name.
 */
export function cameraFilesFor(media: MediaFacts | null, item: Pick<ItemFacts, 'cameraFiles'>): readonly CameraFileId[] | null {
  if (media !== null && media.files !== null) return media.files;
  return item.cameraFiles.length > 0 ? item.cameraFiles : null;
}

/** The key class of the signing key, from the item and - when a verify run of this screen answered - from that run. */
export type SigningKeyClass = 'DEVELOPMENT' | 'NOT_DEVELOPMENT' | 'UNKNOWN';

export function signingKeyClassOf(signature: SignatureFacts | null, verified: 'DEVELOPMENT' | 'NOT_DEVELOPMENT' | 'NOT_ESTABLISHED' | null = null): SigningKeyClass {
  // A verify run of this screen read the package itself: its answer wins over the item's member.
  if (verified === 'DEVELOPMENT') return 'DEVELOPMENT';
  if (verified === 'NOT_DEVELOPMENT') return 'NOT_DEVELOPMENT';
  if (signature?.developmentKey === true) return 'DEVELOPMENT';
  if (signature?.developmentKey === false) return 'NOT_DEVELOPMENT';
  return 'UNKNOWN';
}

/** `exportKinds` of operation 40 (JA2-03): the well-formed entries; null when the member is not a list. */
function readExportKinds(value: unknown): DetailFacts['exportKinds'] {
  if (!Array.isArray(value)) return null;
  const out: { kind: 'PACKAGE' | 'COMPOSITE'; available: boolean }[] = [];
  for (const entry of value.slice(0, 4)) {
    if (entry === null || typeof entry !== 'object') continue;
    const { kind, available } = entry as { kind?: unknown; available?: unknown };
    if ((kind === 'PACKAGE' || kind === 'COMPOSITE') && typeof available === 'boolean') out.push({ kind, available });
  }
  return out;
}
