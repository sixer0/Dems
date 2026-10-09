/**
 * The v2 pipeline part of the bulk fixture (dbc-3 §G minimums, ruled an M2 deliverable by CS-20
 * of the row-55 review): the six tables the recording, transcript and sealing pipeline will hold
 * in live use - `session_audio_intervals`, `recording_fragments`, `transcript_chunks`,
 * `transcripts`, `transcript_revisions`, `sealing_jobs` - plus the discovered capture devices and
 * the fake camera credentials that bring `capture_devices` and `capture_device_credentials` to
 * their §G rows. The seed supplies the five built-in devices, the one `capture_config` and the
 * one `stt_config`; nothing here touches them.
 *
 * SYNTHETIC BUT VALID. These rows stand in for data that only the later milestones produce, and
 * they are built to be internally consistent, not placeholders: sequence runs start at 1 without
 * a gap; fragment chains recompute (`chain_hash` of the first row is `SHA-256("")`, then
 * `sha256(prevChain ‖ fragmentHash)`, the fold of the shared simulator's file chain, see
 * `@dems/shared/sim` `evidence.ts` and the note on `recording.ts:91`), and the 40 newest fixture
 * recordings carry their head and row count onto their two VIDEO track rows exactly as §G
 * requires ("head equals `fragment_chain_head`"); DONE chunks hold a segments array and their
 * instant; every transcript hangs on a SEALED item and every SEALED item on a sealed session;
 * revisions chain through `parent_sha256` from the transcript's `json_sha256` and sign in the
 * Ed25519 form (128 hex, `signature_simulated` false); sealing jobs cover all six
 * `FINALIZATION_STEPS_V2` of every sealed session. No session ids reach a foreign key (D-DB-07:
 * these tables are format-checked, not keyed to `session_history`), and the two keyed kinds
 * (`transcripts.evidence_id`, the mic and switcher of the intervals, the revision author) name
 * rows that exist in the base or that this fixture inserts before them.
 *
 * NOT FABRICATED TEXT (D18/D-EV-1). The segment arrays carry timing structure only - media
 * positions of a synthetic VAD pass - never invented transcript text. The transcript `model` and
 * `diarization` documents state what generated them (the fixture STT stand-in), and the hashes
 * are the SHA-256 of self-describing `dems-bulk-fixture/...` texts, the pattern of `rng.ts`.
 *
 * THE ONE SHAPE. These tables are server-native: no slice of the one mapping carries them, so the
 * rows are built in the select shape directly (like the seed's capture rows) and every §G rule
 * that the database does not check is mirrored in `validate.ts` before a statement is sent.
 *
 * v1-shape evidence (decision of this row, logged in `67_recon_cs20_pins.md`): the track rows
 * patched here keep `sha256_plain` NULL, so the one mapping still reads the items in their v1
 * shape (`rows.ts:528` requires all three v2 columns together). Flipping the whole dataset to
 * `manifest_version = 2` with two files per item is SH-24's regeneration of `packages/shared` -
 * RECON-E's - and is outside this row's constraint. §G's floors hold either way: the loaded
 * counts meet the minimums with margin.
 */
import { createHash } from 'node:crypto';
import { FINALIZATION_STEPS_V2 } from '@dems/shared/domain';
import { OperatorRole, SessionOutcome } from '@dems/shared/sim';
import type {
  CaptureDeviceCredentialRow,
  CaptureDeviceRow,
  EvidenceTrackRow,
  RecordingFragmentRow,
  SealingJobRow,
  SessionAudioIntervalRow,
  SessionCaptureSourceRow,
  TranscriptChunkRow,
  TranscriptRevisionRow,
  TranscriptRow,
} from '../schema';
import type { IdentityRows } from './identity';
import { BULK_MIX } from './minimums';
import type { RecordingRows } from './recordings';
import { FIXTURE_TAG } from './rng';
import type { World } from './world';
import { MINUTE_MS, SECOND_MS } from './world';

/** What this part adds, by table (the names `rows.ts` and the loader know). */
export interface PipelineRows {
  readonly captureDevices: CaptureDeviceRow[];
  readonly captureDeviceCredentials: CaptureDeviceCredentialRow[];
  /** Schema v3 (dbc-4 §N.10): four rows per session that has an interval or a fragment row. */
  readonly sessionCaptureSources: SessionCaptureSourceRow[];
  readonly sessionAudioIntervals: SessionAudioIntervalRow[];
  readonly recordingFragments: RecordingFragmentRow[];
  readonly transcriptChunks: TranscriptChunkRow[];
  readonly transcripts: TranscriptRow[];
  readonly transcriptRevisions: TranscriptRevisionRow[];
  readonly sealingJobs: SealingJobRow[];
}

/**
 * The source shape of one session (dbc-4 §N.10): which device feeds each of the four slots, with
 * the adapter kind the row records. No shape mixes a production kind with a development kind
 * (row 123 RG-3).
 */
export interface SourceShape {
  readonly name: 'FAKE' | 'DEVELOPMENT' | 'PRODUCTION';
  readonly slots: ReadonlyArray<{
    readonly slot: SessionCaptureSourceRow['slot'];
    readonly deviceId: string;
    readonly adapterKind: SessionCaptureSourceRow['adapterKind'];
  }>;
}

/** All four slots on the seed's built-ins: the shape of every demo session (D81). */
export const FAKE_SOURCE_SHAPE: SourceShape = {
  name: 'FAKE',
  slots: [
    { slot: 'VIDEO-01', deviceId: 'CAM-01', adapterKind: 'FAKE' },
    { slot: 'VIDEO-02', deviceId: 'CAM-02', adapterKind: 'FAKE' },
    { slot: 'MIC-PRIMARY', deviceId: 'MIC-01', adapterKind: 'FAKE' },
    { slot: 'MIC-STANDBY', deviceId: 'MIC-02', adapterKind: 'FAKE' },
  ],
};
/** The development shape of D74(2): this Mac's camera and microphone in slots 1, fakes in slots 2. */
export const DEVELOPMENT_SOURCE_SHAPE: SourceShape = {
  name: 'DEVELOPMENT',
  slots: [
    { slot: 'VIDEO-01', deviceId: 'CAM-06', adapterKind: 'LOCAL_DEVICE' },
    { slot: 'VIDEO-02', deviceId: 'CAM-02', adapterKind: 'FAKE' },
    { slot: 'MIC-PRIMARY', deviceId: 'MIC-05', adapterKind: 'LOCAL_DEVICE' },
    { slot: 'MIC-STANDBY', deviceId: 'MIC-02', adapterKind: 'FAKE' },
  ],
};
/** All-production: two discovered cameras and two USB microphones. */
export const PRODUCTION_SOURCE_SHAPE: SourceShape = {
  name: 'PRODUCTION',
  slots: [
    { slot: 'VIDEO-01', deviceId: 'CAM-03', adapterKind: 'ONVIF_RTSP' },
    { slot: 'VIDEO-02', deviceId: 'CAM-04', adapterKind: 'ONVIF_RTSP' },
    { slot: 'MIC-PRIMARY', deviceId: 'MIC-03', adapterKind: 'USB_AUDIO' },
    { slot: 'MIC-STANDBY', deviceId: 'MIC-04', adapterKind: 'USB_AUDIO' },
  ],
};
/** All-production on the dual-lens camera: one device in both VIDEO rows (OD-05). */
export const PRODUCTION_DUAL_LENS_SOURCE_SHAPE: SourceShape = {
  name: 'PRODUCTION',
  slots: [
    { slot: 'VIDEO-01', deviceId: 'CAM-03', adapterKind: 'ONVIF_RTSP' },
    { slot: 'VIDEO-02', deviceId: 'CAM-03', adapterKind: 'ONVIF_RTSP' },
    { slot: 'MIC-PRIMARY', deviceId: 'MIC-03', adapterKind: 'USB_AUDIO' },
    { slot: 'MIC-STANDBY', deviceId: 'MIC-04', adapterKind: 'USB_AUDIO' },
  ],
};

const micOf = (shape: SourceShape, slot: 'MIC-PRIMARY' | 'MIC-STANDBY'): string =>
  (shape.slots.find((entry) => entry.slot === slot) as SourceShape['slots'][number]).deviceId;

/** A sealed session with a timeline: the unit the intervals and the jobs are built on. */
interface SealedSession {
  readonly sessionId: string;
  readonly evidenceId: string | null;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly durationMs: number;
  readonly investigatorId: string;
}

/** A fixture recording with an evidence item: the unit the fragments and chunks are built on. */
interface RecordedSession {
  readonly sessionId: string;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly durationMs: number;
}

/** The ids of the seed's five built-in capture devices (`seed/seed.ts` `device()` rows). */
export const BUILT_IN_CAPTURE_DEVICE_IDS = ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02', 'POE-SWITCH'] as const;
/** The two camera files a recording closes (`VIDEO_TRACK_ID`; the fragments' whole domain). */
const CAMERA_TRACKS = ['VIDEO-01', 'VIDEO-02'] as const;
/** One fragment every 30 s on a full chain (§G's 40 newest), every 75 s on a sampled session. */
const FULL_CHAIN_PERIOD_MS = 30_000;
const SAMPLED_PERIOD_MS = 75_000;
/** One transcript chunk covers 150 s of audio, at least five per session (§G floor of 2,000 rows). */
const CHUNK_PERIOD_MS = 150_000;
/** The trailing interval every sealed session closes with, so no row spans the whole take. */
const STOP_TAIL_MS = 30_000;

/** The SHA-256 of a self-describing fixture text: lowercase hex, 64 characters. */
function taggedHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

// ── discovered capture devices and their credentials (dbc-3 §G: 5 built-ins + 3 discovered) ────

function buildCaptureWorld(world: World): { captureDevices: CaptureDeviceRow[]; captureDeviceCredentials: CaptureDeviceCredentialRow[] } {
  const rng = world.rng('pipeline:capture-devices');
  const seenAgo = () => world.now - rng.int(5, 120) * MINUTE_MS;
  const captureDevices: CaptureDeviceRow[] = [
    {
      // The dual-profile discovery camera §G asks for (OD-05): two profiles, one device.
      id: 'CAM-03',
      kind: 'CAMERA',
      transport: 'RTSP',
      model: 'Discovery camera DX-1 (dual profile)',
      firmware: '2.1.7',
      address: '127.0.0.1:8556',
      mac: '9A:1B:2C:3D:4E:03',
      onvifUuid: rng.uuid(),
      profiles: ['H264_1080P25', 'H264_720P30'],
      poePort: 'POE_CAM_2',
      enabled: true,
      lastSeenAt: seenAgo(),
      adapterKind: 'ONVIF_RTSP',
    },
    {
      id: 'CAM-04',
      kind: 'CAMERA',
      transport: 'ONVIF',
      model: 'Discovery camera DX-2',
      firmware: '1.4.0',
      address: '127.0.0.1:8557',
      mac: '9A:1B:2C:3D:4E:04',
      onvifUuid: rng.uuid(),
      profiles: ['H264_1080P25'],
      poePort: 'POE_CAM_2',
      enabled: true,
      lastSeenAt: seenAgo(),
      adapterKind: 'ONVIF_RTSP',
    },
    {
      // The third discovered camera of dbc-4 §N.10: three `ONVIF_RTSP` rows, three distinct
      // endpoint references (the partial unique index `capture_devices_onvif_uuid_key`).
      id: 'CAM-05',
      kind: 'CAMERA',
      transport: 'ONVIF',
      model: 'Discovery camera DX-2',
      firmware: '1.4.0',
      address: '127.0.0.1:8558',
      mac: '9A:1B:2C:3D:4E:05',
      onvifUuid: rng.uuid(),
      profiles: ['H264_1080P25'],
      poePort: 'POE_CAM_3',
      enabled: true,
      lastSeenAt: seenAgo(),
      adapterKind: 'ONVIF_RTSP',
    },
    {
      // The Core Mac's own camera (R-11; D-DB-13: a row of its own, never a re-labelled built-in).
      id: 'CAM-06',
      kind: 'CAMERA',
      transport: 'LOCAL',
      model: 'Core Mac camera (fixture)',
      firmware: null,
      address: null,
      mac: null,
      onvifUuid: null,
      profiles: ['H264_1080P25'],
      poePort: null,
      enabled: true,
      lastSeenAt: seenAgo(),
      adapterKind: 'LOCAL_DEVICE',
    },
    {
      id: 'MIC-03',
      kind: 'MIC',
      transport: 'USB',
      model: 'Discovery microphone DM-1',
      firmware: '0.9.2',
      address: null,
      mac: null,
      onvifUuid: null,
      profiles: ['PCM_48K16'],
      poePort: null,
      enabled: true,
      lastSeenAt: seenAgo(),
      adapterKind: 'USB_AUDIO',
    },
    {
      id: 'MIC-04',
      kind: 'MIC',
      transport: 'USB',
      model: 'Discovery microphone DM-1',
      firmware: '0.9.2',
      address: null,
      mac: null,
      onvifUuid: null,
      profiles: ['PCM_48K16'],
      poePort: null,
      enabled: true,
      lastSeenAt: seenAgo(),
      adapterKind: 'USB_AUDIO',
    },
    {
      // The Core Mac's own microphone (R-11).
      id: 'MIC-05',
      kind: 'MIC',
      transport: 'LOCAL',
      model: 'Core Mac microphone (fixture)',
      firmware: null,
      address: null,
      mac: null,
      onvifUuid: null,
      profiles: ['PCM_48K16'],
      poePort: null,
      enabled: true,
      lastSeenAt: seenAgo(),
      adapterKind: 'LOCAL_DEVICE',
    },
  ];

  const credentials = world.rng('pipeline:device-credentials');
  const older = world.dayAt(45, 9);
  const newer = world.dayAt(3, 9);
  const captureDeviceCredentials: CaptureDeviceCredentialRow[] = [
    {
      deviceId: 'CAM-03',
      username: 'fixture.camera.cam03',
      encryption: 'AES-256-GCM',
      secretCiphertext: credentials.bytes(45),
      nonce: credentials.bytes(12),
      keyRef: 'FIXTURE_AEAD_KEY_1',
      rotatedAt: older,
    },
    {
      // Rotated after the row above: the §G "at least 1 rotated" pair on the two fake cameras.
      deviceId: 'CAM-04',
      username: 'fixture.camera.cam04',
      encryption: 'AES-256-GCM',
      secretCiphertext: credentials.bytes(45),
      nonce: credentials.bytes(12),
      keyRef: 'FIXTURE_AEAD_KEY_2',
      rotatedAt: newer,
    },
  ];
  return { captureDevices, captureDeviceCredentials };
}

// ── session_audio_intervals (dbc-3 §G: >= 1 per sealed session, 50 switched, one open in the variant) ──

function buildAudioIntervals(
  world: World,
  identity: IdentityRows,
  sealed: readonly SealedSession[],
  active: { sessionId: string; startedAt: number } | null,
  shapeOf: (sessionId: string) => SourceShape,
): SessionAudioIntervalRow[] {
  const rng = world.rng('pipeline:audio-intervals');
  const mix = BULK_MIX.sessionAudioIntervals;
  const rows: SessionAudioIntervalRow[] = [];
  // The switched sessions: a deterministic draw of 50 from the sealed timeline.
  const switched = new Set(rng.shuffle(sealed.map((session) => session.sessionId)).slice(0, mix.switchedSessions));
  for (const session of sealed) {
    // MR-S2 (dbc-4 §N.3): every interval of a session names one of the two mics its
    // `session_capture_sources` rows record, so the class of an interval is read from that row.
    const shape = shapeOf(session.sessionId);
    const primary = micOf(shape, 'MIC-PRIMARY');
    const standby = micOf(shape, 'MIC-STANDBY');
    const span = (fromMediaMs: number, toMediaMs: number): void => {
      rows.push({
        sessionId: session.sessionId,
        seq: rows.filter((row) => row.sessionId === session.sessionId).length + 1,
        micDeviceId: primary,
        role: 'PRIMARY',
        fromMediaMs,
        toMediaMs,
        fromAt: session.startedAt + fromMediaMs,
        toAt: session.startedAt + toMediaMs,
        switchedBy: null,
        reason: fromMediaMs === 0 ? 'START' : 'STOP',
      });
    };
    if (switched.has(session.sessionId)) {
      // START, three MANUAL switches (switched_by non-null, §G's 2-3), STOP: the mic moves.
      const quarter = Math.max(1, Math.floor(session.durationMs / 4));
      const bounds = [0, quarter, 2 * quarter, 3 * quarter, session.durationMs];
      bounds.slice(0, 4).forEach((from, index) => {
        const to = bounds[index + 1] as number;
        rows.push({
          sessionId: session.sessionId,
          seq: index + 1,
          micDeviceId: index % 2 === 1 ? standby : primary,
          role: index === 0 ? 'PRIMARY' : index % 2 === 1 ? 'STANDBY' : 'PRIMARY',
          fromMediaMs: from,
          toMediaMs: to,
          fromAt: session.startedAt + from,
          toAt: session.startedAt + to,
          switchedBy:
            index === 0
              ? null
              : rng.pick(identity.directory.candidates(session.startedAt + to, world.now, OperatorRole.INVESTIGATOR)).operator.id,
          reason: index === 0 ? 'START' : 'MANUAL',
        });
      });
      rows.push({
        sessionId: session.sessionId,
        seq: 5,
        micDeviceId: primary,
        role: 'PRIMARY',
        fromMediaMs: 3 * quarter,
        toMediaMs: session.durationMs,
        fromAt: session.startedAt + 3 * quarter,
        toAt: session.endedAt,
        switchedBy: null,
        reason: 'STOP',
      });
    } else {
      span(0, session.durationMs - STOP_TAIL_MS);
      span(session.durationMs - STOP_TAIL_MS, session.durationMs);
    }
  }
  if (active !== null) {
    // The RECORDING variant holds exactly one open interval (§G): the live take of the active
    // session has no closing media position yet, and `to_media_ms`/`to_at` stay NULL together.
    rows.push({
      sessionId: active.sessionId,
      seq: 1,
      micDeviceId: micOf(shapeOf(active.sessionId), 'MIC-PRIMARY'),
      role: 'PRIMARY',
      fromMediaMs: 0,
      toMediaMs: null,
      fromAt: active.startedAt,
      toAt: null,
      switchedBy: null,
      reason: 'START',
    });
  }
  if (rows.some((row) => row.reason === 'MANUAL' && row.switchedBy === null)) {
    throw new RangeError('a MANUAL interval without its switcher');
  }
  return rows;
}

// ── recording_fragments (dbc-3 §G: 6,500; full chains on the 40 newest, head on the tracks) ─────

interface TrackChain {
  readonly trackId: (typeof CAMERA_TRACKS)[number];
  readonly count: number;
  readonly head: string;
}

function buildFragments(recorded: readonly RecordedSession[], fullChains: ReadonlySet<string>): { rows: RecordingFragmentRow[]; chains: Map<string, TrackChain[]> } {
  const rows: RecordingFragmentRow[] = [];
  const chains = new Map<string, TrackChain[]>();
  const genesis = createHash('sha256').update('', 'utf8').digest('hex');
  for (const session of recorded) {
    const period = fullChains.has(session.sessionId) ? FULL_CHAIN_PERIOD_MS : SAMPLED_PERIOD_MS;
    const perTrack: TrackChain[] = [];
    for (const [trackIndex, trackId] of CAMERA_TRACKS.entries()) {
      const count = Math.max(2, Math.ceil(session.durationMs / period));
      let head = '';
      let byteOffset = 0;
      for (let seq = 1; seq <= count; seq += 1) {
        const mediaStartMs = (seq - 1) * period;
        const mediaDurationMs = Math.min(period, Math.max(1, session.durationMs - mediaStartMs));
        const byteLength = 60_000 + ((seq * 7919 + trackIndex * 31) % 30_001);
        const sha256 = taggedHash(`${FIXTURE_TAG}/recording-fragment/${session.sessionId}/${trackId}/${seq}`);
        head = seq === 1 ? genesis : taggedHash(`${head}${sha256}`);
        rows.push({
          sessionId: session.sessionId,
          trackId,
          seq,
          byteOffset,
          byteLength,
          mediaStartMs,
          mediaDurationMs,
          sha256,
          chainHash: head,
          durableAt: Math.min(session.endedAt, session.startedAt + mediaStartMs + mediaDurationMs),
        });
        byteOffset += byteLength;
      }
      perTrack.push({ trackId, count, head });
    }
    if (fullChains.has(session.sessionId)) chains.set(session.sessionId, perTrack);
  }
  return { rows, chains };
}

/** §G's "head equals fragment_chain_head": the two VIDEO rows of a full-chain session. */
function patchTrackChainHearts(tracks: EvidenceTrackRow[], byEvidence: ReadonlyMap<string, string>, chains: ReadonlyMap<string, TrackChain[]>): void {
  for (const row of tracks) {
    const sessionId = byEvidence.get(row.evidenceId);
    const sessionChains = sessionId === undefined ? undefined : chains.get(sessionId);
    const perTrack = sessionChains?.find((chain) => chain.trackId === row.trackId);
    if (perTrack === undefined) continue;
    row.fragmentCount = perTrack.count;
    row.fragmentChainHead = perTrack.head;
  }
}

// ── transcript_chunks (dbc-3 §G: 2,000; contiguous audio, >= 20 FAILED->rerun pairs, >= 95% DONE) ──

function buildChunks(world: World, recorded: readonly RecordedSession[]): TranscriptChunkRow[] {
  const rng = world.rng('pipeline:transcript-chunks');
  const rows: TranscriptChunkRow[] = [];
  // The rerun demos: 24 of the earliest recordings rerun their middle chunk after a FAILED one.
  const rerun = new Set(recorded.slice(0, BULK_MIX.transcriptChunks.failedRerunPairs + 4).map((session) => session.sessionId));
  for (const session of recorded) {
    // The rerun demos fail their FIRST chunk: every recording is at least three minutes, so the
    // 150 s span of the first chunk always ends strictly inside the take and the rerun is sure.
    const failedAt = rerun.has(session.sessionId) ? 1 : -1;
    let seq = 1;
    let position = 0;
    let failed: { from: number; to: number } | null = null;
    while (position < session.durationMs || failed !== null) {
      const from: number = failed !== null ? failed.from : position;
      const to: number = failed !== null ? failed.to : Math.min(session.durationMs, position + CHUNK_PERIOD_MS);
      const isFailed = failed === null && seq === failedAt && to < session.durationMs;
      const segments = isFailed
        ? null
        : Array.from({ length: Math.max(1, Math.floor((to - from) / (20 * SECOND_MS))) }, (_, index) => ({
            // Timing structure only - a synthetic VAD pass. D18: no transcript text is invented.
            startMs: Math.min(from + index * 20 * SECOND_MS, to - 1),
            endMs: to,
          }));
      rows.push({
        sessionId: session.sessionId,
        seq,
        audioFromMs: from,
        audioToMs: to,
        status: isFailed ? 'FAILED' : 'DONE',
        segments,
        embeddingRef: 'FIXTURE_CHUNK_EMBEDDING',
        modelId: 'FIXTURE_STT_V1',
        computedAt: isFailed ? null : Math.min(world.now - SECOND_MS, session.startedAt + to + rng.int(1, 40) * SECOND_MS),
      });
      seq += 1;
      if (isFailed) failed = { from, to };
      else if (failed !== null) {
        // The rerun just consumed the failed span; the timeline continues after it.
        failed = null;
        position = to;
      } else position = to;
    }
  }
  return rows;
}

// ── transcripts + transcript_revisions (dbc-3 §G: one per SEALED; 30 chained Ed25519 revisions) ──

interface SealedItem {
  readonly evidenceId: string;
  readonly sessionId: string;
  readonly sealedAt: number;
}

function buildTranscripts(world: World, sealedItems: readonly SealedItem[]): TranscriptRow[] {
  const rows: TranscriptRow[] = [];
  sealedItems.forEach((item, index) => {
    const labelsStatus = index % 11 === 5 ? 'UNAVAILABLE' : 'LABELLED';
    rows.push({
      evidenceId: item.evidenceId,
      jsonSha256: taggedHash(`${FIXTURE_TAG}/transcript-json/${item.evidenceId}`),
      srtSha256: taggedHash(`${FIXTURE_TAG}/transcript-srt/${item.evidenceId}`),
      vttSha256: taggedHash(`${FIXTURE_TAG}/transcript-vtt/${item.evidenceId}`),
      // Documents that say what produced them; no invented speech (D18).
      model: { engine: 'dems-fixture-stt', version: 1, language: 'id', standIn: true },
      diarization: { method: 'CLUSTER_2SPK', speakers: 2, labels: labelsStatus === 'LABELLED' },
      labelsStatus,
      createdAt: item.sealedAt,
    });
  });
  return rows;
}

function buildRevisions(world: World, identity: IdentityRows, transcripts: readonly TranscriptRow[], sealedItems: readonly SealedItem[]): TranscriptRevisionRow[] {
  const rng = world.rng('pipeline:transcript-revisions');
  const rows: TranscriptRevisionRow[] = [];
  const sealedBy = new Map(sealedItems.map((item) => [item.evidenceId, item]));
  // 5 items carry a chain of three revisions; 15 more carry one correction each: 30 rows (§G).
  const chained = transcripts.filter((_, index) => index % 19 === 3).slice(0, BULK_MIX.transcriptRevisions.chainedItems);
  const singles = transcripts.filter((row) => !chained.includes(row)).slice(0, 15);
  const push = (transcript: TranscriptRow, revisionNo: number, parentSha256: string): void => {
    const item = sealedBy.get(transcript.evidenceId);
    if (item === undefined) throw new RangeError('a revision names a transcript with no sealed session');
    const signedAt = Math.min(world.now - 10 * SECOND_MS, item.sealedAt + rng.int(60, 3_600) * 1_000);
    const sha256 = taggedHash(`${FIXTURE_TAG}/transcript-revision/${transcript.evidenceId}/${revisionNo}`);
    rows.push({
      evidenceId: transcript.evidenceId,
      revisionNo,
      parentSha256,
      sha256,
      authorId: rng.pick(identity.directory.candidates(signedAt, world.now, OperatorRole.INVESTIGATOR)).operator.id,
      reason: `Fixture correction ${revisionNo} of ${transcript.evidenceId}: the speaker boundary of one segment moved; no text is invented (D18).`,
      signatureValue: rng.hex(128),
      signatureKeyId: 'FIXTURE_CORE_SIGNING_KEY',
      signatureAlgorithm: 'Ed25519',
      signatureSimulated: false,
      signatureCertificateSha256: revisionNo === 2 ? null : taggedHash(`${FIXTURE_TAG}/signing-certificate/${revisionNo % 2 === 0 ? 'previous' : 'current'}`),
      createdAt: signedAt,
    });
  };
  for (const transcript of chained) {
    let parent = transcript.jsonSha256;
    for (const revisionNo of [1, 2, 3]) {
      push(transcript, revisionNo, parent);
      parent = rows[rows.length - 1]?.sha256 ?? parent;
    }
  }
  for (const transcript of singles) push(transcript, 1, transcript.jsonSha256);
  return rows;
}

// ── sealing_jobs (dbc-3 §G: every step of every sealed session DONE; resumed rows; variant RUNNING) ──

function buildSealingJobs(world: World, identity: IdentityRows, sealed: readonly SealedSession[], active: { sessionId: string; startedAt: number } | null): SealingJobRow[] {
  const rng = world.rng('pipeline:sealing-jobs');
  const rows: SealingJobRow[] = [];
  const resumed = new Set(sealed.slice(0, BULK_MIX.sealingJobs.resumedAtLeast + 4).map((session) => session.sessionId));
  const checkpointed = new Set(sealed.slice(4, 4 + BULK_MIX.sealingJobs.checkpointedAtLeast + 4).map((session) => session.sessionId));
  sealed.forEach((session) => {
    FINALIZATION_STEPS_V2.forEach((step, index) => {
      const attempt = resumed.has(session.sessionId) && index === 2 ? 2 : 1;
      const startedAt = Math.min(world.now - SECOND_MS, session.endedAt + index * 4_000);
      const checkpoint =
        checkpointed.has(session.sessionId) && index === 2 && attempt === 2
          ? { resumedFromStep: step, resumedAfterMs: rng.int(4_000, 60_000), bytesHashed: session.durationMs * 1_000, actorHint: session.investigatorId }
          : null;
      rows.push({
        sessionId: session.sessionId,
        step,
        status: 'DONE',
        progress: 100,
        etaMs: null,
        attempt,
        checkpoint,
        errorCode: null,
        startedAt,
        updatedAt: Math.min(world.now - SECOND_MS, startedAt + rng.int(1_500, 45_000)),
      });
    });
  });
  if (active !== null) {
    // The RECOVERY variant: the active session stands at its first step, RUNNING (§G).
    rows.push({
      sessionId: active.sessionId,
      step: FINALIZATION_STEPS_V2[0] as string,
      status: 'RUNNING',
      progress: rng.int(10, 90),
      etaMs: rng.int(3_000, 60_000),
      attempt: 1,
      checkpoint: { resumedFromStep: FINALIZATION_STEPS_V2[0], resumedAfterMs: rng.int(4_000, 60_000), bytesHashed: 0, actorHint: identity.directory.candidates(active.startedAt, world.now, OperatorRole.INVESTIGATOR)[0]?.operator.id ?? null },
      errorCode: null,
      startedAt: active.startedAt,
      updatedAt: world.now - SECOND_MS,
    });
  }
  return rows;
}

// ── assembly ───────────────────────────────────────────────────────────────────────────────────

/**
 * Builds the §G v2 rows. `recordings` is the already-built v1 fixture corpus: its sealed plans
 * anchor the intervals, its recorded plans the fragments and chunks, its SEALED items the
 * transcripts; the seeded slices add their sealed sessions and items. The two VIDEO track rows of
 * the 40 newest fixture recordings are patched in place with their fragment count and chain head.
 */
export function buildPipeline(world: World, identity: IdentityRows, recordings: RecordingRows): PipelineRows {
  const { captureDevices, captureDeviceCredentials } = buildCaptureWorld(world);

  // The sealed sessions: the fixture's own plans, then the seeded history's (ids are unique
  // between them; the loader proves that by the counts it cross-checks).
  const sealed: SealedSession[] = [
    ...recordings.recordings
      .filter((plan) => plan.sealed && plan.startedAt < plan.endedAt)
      .map((plan) => ({
        sessionId: plan.sessionId,
        evidenceId: plan.evidenceId,
        startedAt: plan.startedAt,
        endedAt: plan.endedAt,
        durationMs: plan.endedAt - plan.startedAt,
        investigatorId: plan.investigatorId,
      })),
    ...world.base.slices.sessionHistory
      .filter((entry) => entry.outcome === SessionOutcome.SEALED && entry.startedAt !== null && entry.durationMs > 0)
      .map((entry) => ({
        sessionId: entry.id,
        evidenceId: entry.evidenceId,
        startedAt: entry.startedAt as number,
        endedAt: entry.endedAt,
        durationMs: entry.durationMs,
        investigatorId: entry.investigatorId,
      })),
  ].sort((a, b) => a.startedAt - b.startedAt || a.sessionId.localeCompare(b.sessionId));

  // The recorded sessions with an evidence item: the fragments' and chunks' domain (the fixture
  // owns their files; the seed's demo items keep the media of the frozen dataset).
  const recorded: RecordedSession[] = recordings.recordings
    .filter((plan) => plan.evidenceId !== null)
    .map((plan) => ({ sessionId: plan.sessionId, startedAt: plan.startedAt, endedAt: plan.endedAt, durationMs: plan.endedAt - plan.startedAt }))
    .sort((a, b) => a.startedAt - b.startedAt || a.sessionId.localeCompare(b.sessionId));

  // The 40 newest fixture recordings get the full chains whose head equals the track's column.
  const fullChains = new Set(
    [...recorded]
      .sort((a, b) => b.endedAt - a.endedAt || b.sessionId.localeCompare(a.sessionId))
      .slice(0, BULK_MIX.recordingFragments.fullChainSessions)
      .map((session) => session.sessionId),
  );

  const active = recordings.activeSession[0];
  const activeTake = active === undefined ? null : { sessionId: active.id, startedAt: active.startedAt ?? active.createdAt };

  // dbc-4 §N.10: the source shape of every session that has an interval or a fragment row. The
  // seeded history and the RECORDING variant stay all-FAKE (D81: demo packages carry class FAKE);
  // 20 of the fixture's own recordings take the development shape and 20 the all-production one,
  // a deterministic draw. A quarter of the production sessions sit on the dual-lens camera.
  const mix = BULK_MIX.sessionCaptureSources;
  const drawn = world
    .rng('pipeline:capture-sources')
    .shuffle(recordings.recordings.filter((plan) => plan.sealed && plan.startedAt < plan.endedAt).map((plan) => plan.sessionId))
    .slice(0, mix.developmentSessions + mix.productionSessions);
  if (drawn.length < mix.developmentSessions + mix.productionSessions) throw new RangeError('too few fixture recordings for the source-shape mix');
  const shapes = new Map<string, SourceShape>();
  drawn.forEach((sessionId, index) => {
    if (index < mix.developmentSessions) shapes.set(sessionId, DEVELOPMENT_SOURCE_SHAPE);
    else shapes.set(sessionId, (index - mix.developmentSessions) % 4 === 3 ? PRODUCTION_DUAL_LENS_SOURCE_SHAPE : PRODUCTION_SOURCE_SHAPE);
  });
  const shapeOf = (sessionId: string): SourceShape => shapes.get(sessionId) ?? FAKE_SOURCE_SHAPE;
  const startOf = new Map<string, number>();
  for (const session of [...sealed, ...recorded]) if (!startOf.has(session.sessionId)) startOf.set(session.sessionId, session.startedAt);
  if (activeTake !== null && !startOf.has(activeTake.sessionId)) startOf.set(activeTake.sessionId, activeTake.startedAt);
  const sessionCaptureSources: SessionCaptureSourceRow[] = [...startOf.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([sessionId, startedAt]) =>
      // MR-S1: the four rows are written with the transition to RECORDING, i.e. at the start.
      shapeOf(sessionId).slots.map((entry) => ({ sessionId, slot: entry.slot, deviceId: entry.deviceId, adapterKind: entry.adapterKind, recordedAt: startedAt })),
    );

  const sessionAudioIntervals = buildAudioIntervals(world, identity, sealed, activeTake, shapeOf);
  const fragments = buildFragments(recorded, fullChains);
  const sessionByEvidence = new Map(recordings.recordings.filter((plan) => plan.evidenceId !== null).map((plan) => [plan.evidenceId as string, plan.sessionId]));
  patchTrackChainHearts(recordings.evidenceTracks, sessionByEvidence, fragments.chains);
  const transcriptChunks = buildChunks(world, recorded);

  // One transcript per SEALED item - the fixture's rows and the seeded dataset's own.
  const sealedItems: SealedItem[] = [
    ...recordings.evidenceItems
      .filter((row) => row.status === 'SEALED')
      .map((row) => ({ evidenceId: row.id, sessionId: row.sessionId, sealedAt: row.sealedAt ?? row.updatedAt })),
    ...world.base.slices.evidence
      .filter((item) => item.status === 'SEALED')
      .map((item) => ({ evidenceId: item.id, sessionId: item.sessionId, sealedAt: item.sealedAt ?? item.endedAt })),
  ];
  const transcripts = buildTranscripts(world, sealedItems);
  const transcriptRevisions = buildRevisions(world, identity, transcripts, sealedItems);
  const sealingJobs = buildSealingJobs(world, identity, sealed, activeTake);

  return {
    captureDevices,
    captureDeviceCredentials,
    sessionCaptureSources,
    sessionAudioIntervals,
    recordingFragments: fragments.rows,
    transcriptChunks,
    transcripts,
    transcriptRevisions,
    sealingJobs,
  };
}
