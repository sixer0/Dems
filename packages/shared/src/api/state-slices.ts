/**
 * The Core state on the wire: one zod schema per replicated slice of the simulator's state
 * (backend task: 2026-10-04 01_specs §3.2, §7.1 API-5 and API-6, §7.18, §9.3, §9.5; plan row W22,
 * contract B).
 *
 * The simulator's state has 35 slices (`sim/types.ts` `SimState`). In Live mode they reach a
 * client in three ways (`STATE_SLICE_DELIVERY`):
 *
 * | Delivery | Slices | How |
 * |----------|--------|-----|
 * | `replicated` | 30 (`REPLICATED_SLICE_NAMES`) | The `state` topic of the socket: one `snapshot`, then `delta` messages (`realtime-messages.ts`). A read of contract C returns the same wire form (API-6) |
 * | `streamed` | `audio` | The `meters` topic, 20 Hz, never stored |
 * | `client` | `clock`, `auth`, `authLockout`, `pairing` | Never sent as a slice. Each client builds them: the clock from `serverTime`, the other three from the answers of the identity and pairing operations |
 *
 * So a snapshot holds exactly the 30 names and nothing else: `ReplicatedStateSchema` refuses a
 * state that carries `auth`, `authLockout`, `pairing`, `clock` or `audio`, or any other member.
 *
 * Rules every schema here follows:
 * - **The wire form is the simulator's own JSON.** A schema accepts, unchanged, the slice the
 *   shared simulator holds; test/api-state-slices.test.ts parses every slice of the real idle state
 *   and of the scenarios, and proves at compile time that each schema's type is the simulator's.
 * - **Strict objects.** 01_specs is silent on unknown members of a slice, so every object here is
 *   strict: a member the schema does not name is refused, not dropped. The server validates what
 *   it sends and the Live source what it receives, so nothing undeclared can ride along
 *   (01_specs §9.5). An operator carries its identity members and its role only: `enabled`, a
 *   password hash, a session list or a last sign-in time is refused (§3.2 row 4).
 * - **Open maps stay flat.** `details` and `params` are the simulator's `Details`: any key, and a
 *   string, a number, a boolean or null as value. Their content is the writer's duty (SR-54).
 * - **Time** is epoch milliseconds on the server clock (API-5), an integer. Levels, rates and
 *   temperatures are plain numbers; counters, sequence numbers and byte sizes are integers.
 * - **Text carries the text rule API-13** (`text.ts`): no U+0000 and no unpaired surrogate, in a
 *   free text and in the keys and values of an open map. A slice is output, and every text in it
 *   came through the rule on its way in or was written by the engine, so the rule here is a second
 *   check that what is sent can be stored and hashed as it is. It was off while the engine could
 *   cut a text in the middle of a surrogate pair (implementation/22_contract_b.md, finding F-1);
 *   the engine now cuts on a character boundary (`sim/text-cut.ts`), and the request schemas
 *   refuse the texts it would cut (plan row W27). So every string of a slice is bound by a value
 *   set, by a pattern or by the rule, which is what API-13 asks of the registry.
 *
 * Framework-free like the rest of `src/api`: zod, the domain enums and the simulator's value sets.
 * The simulator's types are not imported here; the compile-time proofs live in the test.
 */
import { z } from 'zod';
import {
  BootRecoveryState,
  EvidenceLifecycleStage,
  FinalizationStep,
  LensState,
  MicInputId,
  MicRole,
  MicState,
  NetworkDomain,
  SecurityState,
  SessionState,
  StorageState,
  SystemSlot,
  TimeSource,
  TrackId,
  TrackRecState,
  UpdateStep,
} from '../domain/enums';
import {
  AuditCategory,
  AuditType,
  CaptureDeviceKind,
  CaptureStreamState,
  CaseType,
  DiagnosticStatus,
  EvidenceStatus,
  FaultKind,
  IntegritySource,
  PrecheckCheckId,
  PrecheckReasonCode,
  PrecheckStatus,
  RecordingProfileId,
  RetentionPolicyId,
  ScenarioName,
  SecurityPosture,
  ServiceStatus,
  SessionOutcome,
  Severity,
  SimEventType,
  StepStatus,
  SubjectType,
  TabletLinkState,
  TimelineKind,
  UpdateState,
  VerificationStatus,
} from '../sim/vocabulary';
import { OperatorSchema } from './identity';
import { EVIDENCE_ID_PATTERN, MIC_INPUT_ID_PATTERN, SESSION_ID_PATTERN, SHA256_HEX_PATTERN } from './patterns';
import { count, epochMs, nullableEpochMs, operatorId } from './schema-parts';
import { apiText } from './text';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Building blocks
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Free text as the engine holds it: it may be empty, and it carries the text rule (see the file header). */
const text = () => apiText();
/** An identifier or a name the engine mints: never empty, and under the text rule like every string of a slice. */
const label = () => apiText().min(1);
const sessionId = () => z.string().regex(SESSION_ID_PATTERN);
const evidenceId = () => z.string().regex(EVIDENCE_ID_PATTERN);
const sha256 = () => z.string().regex(SHA256_HEX_PATTERN);
/** A measurement that is never negative: a rate, a size in a unit, a percentage. */
const amount = () => z.number().nonnegative();
const videoTrackId = () => z.enum([TrackId.VIDEO_01, TrackId.VIDEO_02]);
const audioTrackId = () => z.enum([TrackId.AUDIO_01, TrackId.AUDIO_02]);
const timeSource = () => z.enum(TimeSource);

/**
 * The simulator's `Details`: flat values under any key (`sim/types.ts`). Audit rows hash them with
 * the canonical JSON form, so nothing nested is allowed.
 */
const details = () => z.record(text(), z.union([text(), z.number(), z.boolean(), z.null()]));

// ═══════════════════════════════════════════════════════════════════════════════════════
// meta, device, operators, tabletLink
// ═══════════════════════════════════════════════════════════════════════════════════════

export const MetaSliceSchema = z
  .strictObject({
    // SH-10: the wire value of `SIM_SNAPSHOT_VERSION` (sim/constants.ts) and of the
    // `MetaSlice.schemaVersion` literal (sim/types.ts); the Core boot check accepts this value.
    schemaVersion: z.literal(2),
    seed: z.int().describe('Seed of the engine\'s random streams (20261001 unless a test sets another).'),
    scenario: z.enum(ScenarioName).describe('The scenario the state was built from.'),
    epoch: count().describe('The engine\'s own epoch. A client follows the `epoch` of the socket messages, not this value.'),
    createdAt: epochMs(),
    counters: z
      .strictObject({
        event: count().describe('Next operational event number (`LOG-000001`).'),
        session: count().describe('Next session number of `SES-{YYYYMMDD}-NNNN`.'),
        caseNumber: count().describe('Next case number of `LP/{YYYY}/{MMDD}-NNNN`.'),
        evidence: count().describe('Next evidence number of `EV-{YYYYMMDD}-NNNN`.'),
        item: count().describe('Timeline items, notes, markers, alerts and diagnostics runs.'),
        export: count().optional().describe('Next export number of `EXP-NNNNNN`. Absent until the first export.'),
      })
      .describe('The counters every identifier is minted from.'),
  })
  .describe('Slice `meta`: seed, scenario and the identifier counters.');
export type MetaSliceBody = z.output<typeof MetaSliceSchema>;

export const DeviceSliceSchema = z
  .strictObject({
    id: label().describe('The Core\'s device ID, e.g. `DEMS-IR-01`.'),
    name: text(),
    room: text(),
    productName: text(),
    softwareVersion: text().describe('Changes after a software update.'),
    identity: z
      .strictObject({
        serialNumber: text(),
        hardwareUuid: text(),
        chassisRevision: text(),
        somPartRevision: text(),
        audioBoardRevision: text(),
        poeBoardRevision: text(),
        powerBoardRevision: text(),
        bspVersion: text(),
        coreSoftwareVersion: text(),
        tabletAppVersion: text(),
        tpmModelFirmware: text(),
        cameraModelFirmware: text(),
        provisioningRecordId: text(),
        deviceCertificateId: text(),
      })
      .describe('Configuration identity of the device (book §24.1). Synthetic values.'),
  })
  .describe('Slice `device`: the Core device record.');
export type DeviceSliceBody = z.output<typeof DeviceSliceSchema>;

/**
 * One operator of the replicated `operators` slice: the members of `Operator` and no other
 * (01_specs §3.2 row 4, §9.5). `enabled`, a password hash, a salt, a session list and the times
 * of the users table exist only behind `listUsers` (USER_ADMIN) or not at all.
 */
export const ReplicatedOperatorSchema = OperatorSchema.strict().describe(
  'An operator as every signed-in client sees it: identity members and role only. Any other member is refused.',
);
export type ReplicatedOperator = z.output<typeof ReplicatedOperatorSchema>;

export const OperatorsSliceSchema = z
  .array(ReplicatedOperatorSchema)
  .describe('Slice `operators`: every operator, with identity members and role only; never `enabled`, never a hash.');
export type OperatorsSliceBody = z.output<typeof OperatorsSliceSchema>;

export const TabletLinkSliceSchema = z
  .strictObject({
    state: z.enum(TabletLinkState),
    changedAt: epochMs(),
  })
  .describe('Slice `tabletLink`: whether a paired device is connected. The server sets it from real connections.');
export type TabletLinkSliceBody = z.output<typeof TabletLinkSliceSchema>;

// ═══════════════════════════════════════════════════════════════════════════════════════
// session, lastSealedSessionId, lastSealedAcknowledged, sessionHistory
// ═══════════════════════════════════════════════════════════════════════════════════════

export const SessionNoteSchema = z
  .strictObject({
    id: label(),
    at: epochMs(),
    authorId: operatorId().nullable(),
    text: text(),
  })
  .describe('A note an investigator wrote during the recording.');
export type SessionNoteBody = z.output<typeof SessionNoteSchema>;

const PrecheckItemStateSchema = z.strictObject({
  id: z.enum(PrecheckCheckId),
  status: z.enum(PrecheckStatus),
  value: text().nullable().describe('Live device state, e.g. ONLINE, READY, NO_SIGNAL, GNSS.'),
  reason: text().nullable().describe('Why the check warns or blocks (English fallback).'),
  reasonCode: z.enum(PrecheckReasonCode).nullable().optional().describe('Machine-readable reason; null while pending or on PASS.'),
  params: details().optional().describe('Values for the reason copy, e.g. `{ track: "AUDIO-01" }`.'),
  resolvesAt: nullableEpochMs().describe('When the check resolves.'),
});

const stepTimes = () => ({ startedAt: nullableEpochMs(), completedAt: nullableEpochMs() });

// ── Selector rows, declared here because the session snapshot reuses them (SH-05) ──

/** One camera row of the selector: which device feeds which video track (`C3 §6` slice 29). */
export const CaptureConfigCameraSchema = z
  .strictObject({
    trackId: videoTrackId(),
    deviceId: label().describe('The capture device feeding this track (`CAM-01`/`CAM-02`).'),
    profile: label().describe('Media profile code; an open set (OD-05/OD-06).'),
    online: z.boolean(),
    streamState: z.enum(CaptureStreamState).describe('A lost stream is what makes a PoE cycle legal (OD-22).'),
  })
  .describe('One video slot of the device selector.');
export type CaptureConfigCameraBody = z.output<typeof CaptureConfigCameraSchema>;

/** One mic slot of the selector: which input is PRIMARY and which is the hot standby (OD-09). */
export const CaptureConfigMicSchema = z
  .strictObject({
    inputId: z.string().regex(MIC_INPUT_ID_PATTERN).describe('The mic input, `MIC-NN`: the built-in `MIC-01` / `MIC-02`, or a microphone registered later (D115 (2)).'),
    deviceId: label().describe('The microphone behind the input: the device of the same ID (D106 (4)).'),
    role: z.enum(MicRole),
    transport: label().describe('Open set (`CODE`): USB, embedded RTSP, ... (OD-06).'),
    online: z.boolean(),
  })
  .describe('One microphone slot of the device selector.');
export type CaptureConfigMicBody = z.output<typeof CaptureConfigMicSchema>;

export const ActiveSessionSchema = z
  .strictObject({
    id: sessionId(),
    state: z.enum(SessionState),
    input: z
      .strictObject({
        caseNumber: text(),
        subjectType: z.enum(SubjectType),
        subjectName: text(),
        investigatorId: operatorId(),
        room: text(),
        profileId: z.enum(RecordingProfileId),
        notes: text(),
      })
      .describe('The create input after normalisation; `notes` is empty when none was given.'),
    createdAt: epochMs(),
    createdBy: operatorId().nullable(),
    precheck: z
      .strictObject({
        items: z.array(PrecheckItemStateSchema),
        ...stepTimes(),
        outcome: z.enum(['PASS', 'WARN', 'BLOCK']).nullable().describe('Null while checks run.'),
        warningsAcknowledged: z.boolean(),
      })
      .describe('The pre-recording checks (book §5.3).'),
    armedAt: nullableEpochMs(),
    startedAt: nullableEpochMs(),
    stoppedAt: nullableEpochMs(),
    stopReason: text().nullable(),
    sealedAt: nullableEpochMs(),
    finalization: z
      .strictObject({
        steps: z.array(
          z.strictObject({
            id: z.enum(FinalizationStep),
            status: z.enum(StepStatus),
            ...stepTimes(),
            durationMs: count().nullable(),
            // Schema v2 (SH-05; op 83; `dbc-3 §B.4`): per-step progress and ETA, written by the
            // Core and rendered forward-only by clients. Optional: a v1 state carries neither.
            progress: count().optional().describe('Sealing progress of this step, 0..100.'),
            etaMs: nullableEpochMs().optional().describe('Estimated milliseconds left for this step.'),
            detail: text().nullable().optional().describe('What the progress line shows (fragment count, chunk counters).'),
            attempt: count().optional().describe('Attempt of this step, >= 1; a resumed run increments it.'),
          }),
        ),
        ...stepTimes(),
      })
      .describe('The sealing steps v2 (`CLOSE_TRACKS` .. `STORE_SEALED_PACKAGE`; book §12.2, `ev §E`).'),
    timeline: z.array(
      z.strictObject({
        id: label(),
        at: epochMs(),
        kind: z.enum(TimelineKind),
        label: text().describe('English fallback; a client renders its own copy from `kind` and `params`.'),
        detail: text().nullable(),
        channel: audioTrackId().nullable(),
        params: details().optional(),
      }),
    ),
    notes: z.array(SessionNoteSchema),
    markerCount: count(),
    snapshotCount: count(),
    bytesWritten: count(),
    fault: z
      .strictObject({ kind: z.enum(FaultKind), at: epochMs(), fromState: z.enum(SessionState) })
      .nullable()
      .describe('The critical fault that moved the session to FAULT, if any.'),
    recovery: z
      .strictObject({ stage: z.enum(BootRecoveryState), startedAt: epochMs(), completesAt: epochMs() })
      .nullable(),
    evidenceId: evidenceId().nullable(),
    startTimeSource: timeSource().nullable().optional().describe('Time source when the recording started.'),
    stopTimeSource: timeSource().nullable().optional().describe('Time source when the recording stopped or faulted.'),
    // ── Schema v2 (register SH-05; op 27 carries all three; `dbc-3 §B.10`) ──────────────────
    /** The selector as it was when recording started; a later edit never changes this session. */
    captureConfig: z
      .strictObject({
        cameras: z.array(CaptureConfigCameraSchema),
        mics: z.array(CaptureConfigMicSchema),
        revision: count().describe('Selector revision the snapshot was taken at.'),
        updatedAt: epochMs(),
      })
      .nullable()
      .optional()
      .describe('Capture-config snapshot of this session (SH-06 writes it at start).'),
    /** Which mic input feeds `AUDIO-01` right now and which is the hot standby (op 81; OD-09). */
    audioSource: z
      .strictObject({
        sessionId: sessionId(),
        activeInputId: z.enum(MicInputId),
        standbyInputId: z.enum(MicInputId),
        switchedAt: nullableEpochMs().describe('When the last switch took effect; null before the first.'),
        intervalFromMs: count().describe('Media-pts start of the interval the switch opened (never wall clock).'),
      })
      .nullable()
      .optional()
      .describe('The active/standby mic pair of this session.'),
    captureDurable: z
      .boolean()
      .optional()
      .describe('False from the accepted start until the first durable fragment ("connecting cameras"), then true; the state stays RECORDING (D84, D91 R-1). Absent reads as true.'),
    /** Incremental transcript state of this session (op 84; R-5). */
    transcript: z
      .strictObject({
        state: z.enum(['PENDING', 'PARTIAL', 'READY', 'FAILED']),
        chunksTotal: count(),
        chunksDone: count(),
        chunksFailed: count(),
        sha256: text().nullable().describe('Null until the transcript is assembled and hashed.'),
      })
      .nullable()
      .optional()
      .describe('Transcript progress of the open session.'),
  })
  .describe('The open session with its pre-check, timeline, notes and finalization.');
export type ActiveSessionBody = z.output<typeof ActiveSessionSchema>;

export const SessionSliceSchema = ActiveSessionSchema.nullable().describe('Slice `session`: the open session, or null when idle.');
export type SessionSliceBody = z.output<typeof SessionSliceSchema>;

export const LastSealedSessionIdSliceSchema = sessionId()
  .nullable()
  .describe('Slice `lastSealedSessionId`: the session whose summary is shown after the seal, or null.');
export type LastSealedSessionIdSliceBody = z.output<typeof LastSealedSessionIdSliceSchema>;

export const LastSealedAcknowledgedSliceSchema = z
  .boolean()
  .describe('Slice `lastSealedAcknowledged`: whether that summary was acknowledged.');
export type LastSealedAcknowledgedSliceBody = z.output<typeof LastSealedAcknowledgedSliceSchema>;

export const SessionHistoryEntrySchema = z
  .strictObject({
    id: sessionId(),
    outcome: z.enum(SessionOutcome),
    caseNumber: text(),
    subjectName: text(),
    subjectType: z.enum(SubjectType),
    investigatorId: operatorId(),
    room: text(),
    profileId: z.enum(RecordingProfileId),
    createdAt: epochMs(),
    startedAt: nullableEpochMs(),
    endedAt: epochMs(),
    durationMs: count(),
    sizeBytes: count(),
    evidenceId: evidenceId().nullable(),
    faultKind: z.enum(FaultKind).nullable().describe('INCOMPLETE only: the fault that ended it.'),
    startTimeSource: timeSource().nullable().optional(),
    endTimeSource: timeSource().nullable().optional(),
  })
  .describe('A finished session.');
export type SessionHistoryEntryBody = z.output<typeof SessionHistoryEntrySchema>;

export const SessionHistorySliceSchema = z.array(SessionHistoryEntrySchema).describe('Slice `sessionHistory`: the finished sessions.');
export type SessionHistorySliceBody = z.output<typeof SessionHistorySliceSchema>;

// ═══════════════════════════════════════════════════════════════════════════════════════
// activeCameraId, cameras, mics, audio
// ═══════════════════════════════════════════════════════════════════════════════════════

export const ActiveCameraIdSliceSchema = videoTrackId().describe('Slice `activeCameraId`: the camera the monitor shows.');
export type ActiveCameraIdSliceBody = z.output<typeof ActiveCameraIdSliceSchema>;

export const CamerasSliceSchema = z
  .array(
    z.strictObject({
      id: videoTrackId(),
      deviceId: label().describe('e.g. CAM-01.'),
      name: text(),
      room: text(),
      lens: z.enum(LensState),
      online: z.boolean(),
      recState: z.enum(TrackRecState).nullable().describe('Null when not recording.'),
      resolution: z.literal('1080p'),
      fps: z.literal(25),
      codec: z.literal('H.264'),
      bitrateMbps: amount(),
      poePort: text(),
      model: text(),
      firmware: text(),
    }),
  )
  .describe('Slice `cameras`: VIDEO-01 and VIDEO-02.');
export type CamerasSliceBody = z.output<typeof CamerasSliceSchema>;

export const MicsSliceSchema = z
  .array(
    z.strictObject({
      id: audioTrackId(),
      deviceId: label().describe('e.g. MIC-01.'),
      name: text().describe('e.g. "MIC 1 – Interviewer".'),
      role: z.enum(['Interviewer', 'Subject']),
      /** Schema v2 (SH-05): the capture role inside AUDIO-01 (OD-01 T1, OD-09). */
      micRole: z.enum(MicRole),
      channel: z.union([z.literal(1), z.literal(2)]),
      state: z.enum(MicState),
      recState: z.enum(TrackRecState).nullable(),
      gainDb: z.number(),
      phantom: z.boolean(),
      clipLatched: z.boolean().describe('CLIP latch; stays true until the clip is reset.'),
    }),
  )
  .describe('Slice `mics`: AUDIO-01 and AUDIO-02, never merged (SYS-003).');
export type MicsSliceBody = z.output<typeof MicsSliceSchema>;

const AudioFrameSchema = z
  .strictObject({
    seq: count(),
    at: epochMs(),
    dbfs: z.number().min(-90).max(0).describe('Ballistic level in dBFS; -90 means no signal.'),
    peak: z.number().min(-90).max(0).describe('Peak-hold level in dBFS.'),
    clip: z.boolean(),
    noSignal: z.boolean(),
  })
  .describe('One 20 Hz audio frame: numbers and booleans only.');

/**
 * The wire form of the `audio` slice (register SH-17; E-02; `C3 §6`). Schema v2 re-keys it from the
 * v1 `AUDIO-01`/`AUDIO-02` **channels** to the two microphone **inputs** `MIC-01`/`MIC-02` and adds
 * `activeInputId`, so the meters show both input levels and which one feeds `AUDIO-01` (OD-01 T1,
 * OD-09). This is the E-02 correction: the change is here and in `realtime-messages.ts`, and the
 * fifth call site is `live/source/live-sim.ts` (`onMeters`).
 *
 * It is **not** one of the 30 replicated slices: it travels only in `meters` frames, to connections
 * that subscribed, and is never stored (class X).
 */
export const AudioSliceSchema = z
  .strictObject({
    inputs: z.strictObject({ [MicInputId.MIC_01]: AudioFrameSchema, [MicInputId.MIC_02]: AudioFrameSchema }),
    activeInputId: z.enum(MicInputId).describe('The input whose level is the one inside AUDIO-01 right now (op 81 moves it).'),
  })
  .describe('Slice `audio`: the newest frame of each mic input plus the active one. Streamed in `meters` messages only; not part of a snapshot.');
export type AudioSliceBody = z.output<typeof AudioSliceSchema>;

// ═══════════════════════════════════════════════════════════════════════════════════════
// storage, storagePolicy, time, network
// ═══════════════════════════════════════════════════════════════════════════════════════

export const StorageSliceSchema = z
  .strictObject({
    state: z.enum(StorageState),
    volumes: z
      .array(
        z.strictObject({
          id: z.enum(['NVME-SYS', 'HDD-EVIDENCE']),
          kind: z.enum(['SYSTEM', 'EVIDENCE']),
          label: text(),
          totalBytes: count(),
          usedBytes: count(),
        }),
      )
      .describe('System volume, then evidence volume.'),
    writeBytesPerSec: amount(),
    bitrateMbps: amount(),
    history: z.array(z.strictObject({ at: epochMs(), usedBytes: count() })).describe('Natural usage; a demo fill is never written here.'),
    lastWriteVerifiedAt: nullableEpochMs(),
    simulatedFillBytes: count().optional().describe('Bytes the STORAGE_LOW and STORAGE_FULL demo faults add to the evidence volume.'),
    writeRateHistory: z.array(z.strictObject({ at: epochMs(), bytesPerSec: amount() })).optional().describe('1 Hz write-rate samples, at most 120.'),
  })
  .describe('Slice `storage`: volumes, write rate and history.');
export type StorageSliceBody = z.output<typeof StorageSliceSchema>;

export const StoragePolicySliceSchema = z
  .strictObject({
    retentionPolicy: z.enum(RetentionPolicyId),
    retentionDays: amount(),
    autoArchive: z.boolean(),
  })
  .describe('Slice `storagePolicy`: the retention policy.');
export type StoragePolicySliceBody = z.output<typeof StoragePolicySliceSchema>;

export const TimeSliceSchema = z
  .strictObject({
    source: timeSource().describe('Active source, priority GNSS, then NTP, then RTC.'),
    locked: z.boolean(),
    stratum: count(),
    offsetMs: z.number(),
    lastSyncAt: epochMs(),
    gnss: z.strictObject({ locked: z.boolean(), satellites: count() }),
    ntp: z.strictObject({ server: text(), reachable: z.boolean(), stratum: count() }),
    rtc: z.strictObject({ driftPpm: z.number() }),
    history: z.array(z.strictObject({ at: epochMs(), offsetMs: z.number(), source: timeSource() })),
  })
  .describe('Slice `time`: the time service of the Core device. Not the server clock.');
export type TimeSliceBody = z.output<typeof TimeSliceSchema>;

export const NetworkSliceSchema = z
  .strictObject({
    ip: text(),
    lanName: text(),
    gateway: text(),
    linkUp: z.boolean(),
    linkSpeedMbps: amount(),
    poe: z
      .strictObject({
        activePorts: count(),
        totalPorts: count(),
        budgetW: amount(),
        drawW: amount(),
        poweredPorts: count().optional(),
        sparePorts: count().optional(),
      })
      .describe('Two PoE ports: one powers the dual-lens camera, one is the spare.'),
    bandwidth: z.strictObject({
      downMbps: amount(),
      upMbps: amount(),
      history: z.array(z.strictObject({ at: epochMs(), downMbps: amount(), upMbps: amount() })),
    }),
    domains: z.array(z.strictObject({ id: z.enum(NetworkDomain), vlan: count(), active: z.boolean() })),
  })
  .describe('Slice `network`: the simulated LAN of the Core device. It says nothing about the server\'s own listener.');
export type NetworkSliceBody = z.output<typeof NetworkSliceSchema>;

// ═══════════════════════════════════════════════════════════════════════════════════════
// security, services, health, otherDevices, ports
// ═══════════════════════════════════════════════════════════════════════════════════════

export const SecuritySliceSchema = z
  .strictObject({
    state: z.enum(SecurityState),
    posture: z.enum(SecurityPosture),
    tpm: z.strictObject({ model: text(), ok: z.boolean() }),
    secureBoot: z.boolean(),
    encryption: z.literal('AES-256-GCM'),
    hashAlgorithm: z.literal('SHA-256'),
    tamper: z.boolean().describe('Enclosure tamper switch tripped.'),
    controls: z.array(z.strictObject({ id: label(), label: text(), ok: z.boolean(), detail: text() })),
    keys: z
      .array(
        z.strictObject({
          id: label(),
          label: text(),
          algorithm: text(),
          fingerprint: text().describe('Fingerprint of the public part.'),
          expiresAt: epochMs(),
          simulated: z.boolean(),
          demo: z.boolean().optional().describe('True for the DEMO key or certificate of the demo evidence packages.'),
          keyId: text().optional(),
        }),
      )
      .describe('The device\'s simulated keys and certificates, as records: identifiers and fingerprints, never key material.'),
  })
  .describe('Slice `security`: the simulated security state of the Core device (TPM, Secure Boot, tamper switch).');
export type SecuritySliceBody = z.output<typeof SecuritySliceSchema>;

export const ServicesSliceSchema = z
  .array(
    z.strictObject({
      id: label(),
      name: text(),
      status: z.enum(ServiceStatus),
      startedAt: nullableEpochMs().optional().describe('When the service last started; a STOPPED service shows none.'),
    }),
  )
  .describe('Slice `services`: the 17 Core services (the 16 of book §6.1 and the transcriber service).');
export type ServicesSliceBody = z.output<typeof ServicesSliceSchema>;

const healthReading = () => ({
  cpuPercent: amount(),
  cpuTempC: z.number(),
  storageTempC: z.number(),
  ambientTempC: z.number(),
  fanRpm: amount(),
});

export const HealthSliceSchema = z
  .strictObject({
    ...healthReading(),
    fanOk: z.boolean(),
    series: z.array(z.strictObject({ at: epochMs(), ...healthReading() })),
    micLevels: z
      .array(z.strictObject({ at: epochMs(), [TrackId.AUDIO_01]: z.number(), [TrackId.AUDIO_02]: z.number() }))
      .optional()
      .describe('1 Hz peak level of both microphone channels, at most 120.'),
  })
  .describe('Slice `health`: load, temperatures and fan, with their 1 Hz series.');
export type HealthSliceBody = z.output<typeof HealthSliceSchema>;

export const OtherDevicesSliceSchema = z
  .array(
    z.strictObject({
      id: z.enum(['POE-SWITCH', 'REC-INDICATOR', 'TABLET']),
      name: text(),
      online: z.boolean(),
      status: text().describe('Short live status, e.g. "2/2 Ports Active", "CONNECTED".'),
    }),
  )
  .describe('Slice `otherDevices`: PoE switch, recording indicator and tablet.');
export type OtherDevicesSliceBody = z.output<typeof OtherDevicesSliceSchema>;

export const PortsSliceSchema = z
  .array(
    z.strictObject({
      id: z.enum(['POE_CAM_1', 'POE_CAM_2_AUX', 'MGMT_LAN', 'MIC_IN_1', 'MIC_IN_2', 'GNSS_SMA', 'RELAY_IO']),
      label: text(),
      link: z.boolean().describe('The port is healthy; a spare port reads true while it is ready.'),
      spare: z.boolean().optional(),
    }),
  )
  .describe('Slice `ports`: the rear-panel ports.');
export type PortsSliceBody = z.output<typeof PortsSliceSchema>;

// ═══════════════════════════════════════════════════════════════════════════════════════
// evidence
// ═══════════════════════════════════════════════════════════════════════════════════════

export const EvidenceItemSchema = z
  .strictObject({
    id: evidenceId(),
    sessionId: sessionId(),
    caseNumber: text(),
    subjectName: text(),
    subjectType: z.enum(SubjectType),
    investigatorId: operatorId(),
    room: text(),
    profileId: z.enum(RecordingProfileId),
    recordedAt: epochMs(),
    endedAt: epochMs(),
    sealedAt: nullableEpochMs(),
    durationMs: count(),
    sizeBytes: count(),
    status: z.enum(EvidenceStatus),
    lifecycleStage: z.enum(EvidenceLifecycleStage),
    tracks: z
      .array(z.strictObject({ trackId: z.enum(TrackId), label: text(), sizeBytes: count(), sha256: sha256() }))
      .describe('VIDEO-01, VIDEO-02, AUDIO-01 and AUDIO-02, each with its own hash. The two audio tracks are never merged.'),
    manifestHash: sha256(),
    signature: z
      .strictObject({
        // Schema v2 (C3 §3 op 39/41; register W1-C10; `dbc-3 §C.4/§C.5`): a real Ed25519 signature
        // is 64 BYTES (128 lower-case hex characters); the SIMULATED-SHA256 stand-in stays 64 hex
        // characters so every v1 row keeps parsing. The pair rule below mirrors the DB CHECK.
        value: z
          .string()
          .regex(/^(?:[0-9a-f]{64}|[0-9a-f]{128})$/)
          .describe('sha256(manifestHash and keyId) for the simulated stand-in; the Ed25519 signature of the manifest hash for a real one.'),
        keyId: text(),
        algorithm: z.enum(['Ed25519', 'SIMULATED-SHA256']).describe('Schema v2: real seals sign with Ed25519 (OD-02); the stand-in remains for v1 rows.'),
        simulated: z.boolean(),
      })
      .superRefine((signature, report) => {
        const simulatedPair = signature.algorithm === 'SIMULATED-SHA256' && signature.simulated && signature.value.length === 64;
        const realPair = signature.algorithm === 'Ed25519' && !signature.simulated && signature.value.length === 128;
        if (!simulatedPair && !realPair) {
          report.addIssue({
            code: 'custom',
            message: 'algorithm, simulated and the value length must form one of the two pairs of dbc-3 §C.4/§C.5.',
            path: ['algorithm'],
          });
        }
      })
      .describe('The signature of the manifest: the simulated stand-in (v1) or a real Ed25519 (schema v2).'),
    custody: z.array(z.strictObject({ at: epochMs(), action: text(), actorId: operatorId().nullable(), detail: text().nullable() })),
    verification: z.strictObject({ status: z.enum(VerificationStatus), at: nullableEpochMs() }),
    tampered: z.boolean().describe('Set by the evidence tamper demo fault; verification then fails.'),
    tamperedTrackId: z.enum(TrackId).nullable().optional(),
    caseType: z.enum(CaseType).optional(),
    markers: z.array(z.strictObject({ id: label(), at: epochMs(), index: count(), label: text() })).optional(),
    notes: z.array(SessionNoteSchema).optional(),
    integritySource: z.enum(IntegritySource).optional(),
    startTimeSource: timeSource().nullable().optional(),
    endTimeSource: timeSource().nullable().optional(),
    // ── Schema v2 (task 3 M2-W7; register SH-07/SH-14; `C3 §3` op 39; `dbc-3 §B.12`) ──────────
    // Optional until the producers land (sim parity M2-W9 row 51; mapping M2-W4 row 49): a v1 item
    // still parses, a v2 item carries all three. One whole fMP4 per camera with BOTH hashes and the
    // fragment-chain head (D224/D225); the audio-source intervals (media pts); the transcript
    // summary — never the transcript body (the body travels through op 84).
    files: z
      .array(
        z.strictObject({
          trackId: z.enum(TrackId).describe('The track the file carries (VIDEO-01, VIDEO-02, AUDIO-01).'),
          fileName: text().describe('Relative path inside the package; never absolute or credential-bearing.'),
          sizeBytes: count(),
          sha256: sha256().describe('SHA-256 of the whole file\'s stored bytes.'),
          fragmentCount: count().describe('Fragments the append-only file was written in (0 for the synthetic legacy shape).'),
          // Schema v2 additions the DB mapping fills (`dbc-3 §B.12`; D-DB-02): optional so every
          // producer that still writes the SH-07 preview shape keeps parsing.
          sha256Plain: sha256().optional().describe('SHA-256 of the plaintext bytes (stored-bytes vs plaintext: both hashes verify).'),
          fragmentChainHead: sha256().nullable().optional().describe('Head of this file\'s per-fragment hash chain (`dbc-3 §B.12`).'),
        }),
      )
      .optional()
      .describe('Schema v2: one whole file per camera (D224/D225) with its hashes; mirrors the simulator\'s `EvidenceFileEntry` (SH-07).'),
    fragmentChainHead: sha256().nullable().optional().describe('Schema v2 item-level chain head (SH-07 preview shape): the chain the fragments of this item continue.'),
    transcriptSha256: sha256().nullable().optional().describe('Schema v2 item-level transcript hash (SH-07 preview; `evidence_items.transcript_sha256`, dbc-3 §B.11).'),
    manifestVersion: z.union([z.literal(1), z.literal(2)]).optional().describe('Manifest version of the seal (`evidence_items.manifest_version`, dbc-3 §B.11): 2 for every v2 seal, also one without a transcript hash. Absent: derived as before.'),
    labelsStatus: z.enum(['LABELLED', 'UNAVAILABLE']).nullable().optional().describe('Whether the sealed transcript carries speaker labels (`evidence_items.labels_status`); null or absent when the seal states none.'),
    audioSourceIntervals: z
      .array(
        z.strictObject({
          seq: count(),
          inputId: z.enum(MicInputId),
          role: z.enum(MicRole),
          fromMs: count().describe('Media-pts start (S2 §6 finding 3).'),
          toMs: nullableEpochMs().describe('Media-pts end; null for the open interval of a live session.'),
          reason: z.enum(['START', 'MANUAL', 'STOP']),
        }),
      )
      .optional()
      .describe('Schema v2: which mic input fed AUDIO-01 over which media-pts spans (op 82 serves the full rows).'),
    transcript: z
      .strictObject({
        state: z.enum(['PENDING', 'PARTIAL', 'READY', 'FAILED', 'DISABLED']).describe('DISABLED only when R-8 turns STT off (D20; lands with M6).'),
        sha256: sha256().nullable().describe('Hash of the canonical transcript document; null until assembled.'),
        machineTranscriptHash: sha256().nullable().describe('Hash of the SEALED machine transcript — byte-unchanged by any revision (OD-15).'),
        labelsStatus: z.enum(['LABELLED', 'UNAVAILABLE']).nullable().describe('Diarization state (D226); null before assembly.'),
        revision: count().describe('Current max(revision_no); 0 when no revision exists (SEC35-21).'),
        failedChunks: count().optional().describe('Chunks (not attempts) that ended FAILED; above 0 only with state PARTIAL. No text stands in for a failed chunk (D-EV-1; manifest field 93).'),
        backendUnreachable: z.boolean().optional().describe('True when STT was enabled but the configured backend could not be reached for one or more chunks (manifest field 122).'),
      })
      .nullable()
      .optional()
      .describe('Schema v2: the transcript summary inside the item; the body arrives through op 84.'),
  })
  .describe('One evidence item (schema v2 adds files, audio-source intervals and the transcript summary).');
export type EvidenceItemBody = z.output<typeof EvidenceItemSchema>;

export const EvidenceSliceSchema = z.array(EvidenceItemSchema).describe('Slice `evidence`: every evidence item.');
export type EvidenceSliceBody = z.output<typeof EvidenceSliceSchema>;

// ═══════════════════════════════════════════════════════════════════════════════════════
// events, alerts, audit
// ═══════════════════════════════════════════════════════════════════════════════════════

export const SimEventSchema = z
  .strictObject({
    id: label().describe('`LOG-NNNNNN`.'),
    seq: count(),
    at: epochMs(),
    type: z.enum(SimEventType),
    severity: z.enum(Severity),
    message: text().describe('English fallback; a client renders its own copy from `type` and `params`.'),
    params: details(),
    sessionId: sessionId().nullable(),
    deviceId: label().nullable(),
  })
  .describe('One operational event. It never holds a password, a token, a code or a credential (SR-54).');
export type SimEventBody = z.output<typeof SimEventSchema>;

export const EventsSliceSchema = z.array(SimEventSchema).describe('Slice `events`: the ring of the newest 500 events, oldest first.');
export type EventsSliceBody = z.output<typeof EventsSliceSchema>;

export const SimAlertSchema = z
  .strictObject({
    id: label(),
    at: epochMs(),
    severity: z.enum(Severity),
    kind: z.enum({ ...FaultKind, SYSTEM: 'SYSTEM' } as const).describe('A fault kind, or SYSTEM for an alert no fault raised.'),
    message: text(),
    active: z.boolean(),
    acknowledged: z.boolean(),
    resolvedAt: nullableEpochMs(),
    target: text().nullable().optional().describe('The fault target key, so clearing one target resolves its alert.'),
    params: details().optional(),
  })
  .describe('One alert.');
export type SimAlertBody = z.output<typeof SimAlertSchema>;

export const AlertsSliceSchema = z.array(SimAlertSchema).describe('Slice `alerts`: the newest 100 alerts.');
export type AlertsSliceBody = z.output<typeof AlertsSliceSchema>;

export const AuditRowSchema = z
  .strictObject({
    seq: count().describe('Position in the chain, from 1.'),
    id: label().describe('`AUD-NNNNNN`.'),
    at: epochMs(),
    type: z.enum(AuditType),
    category: z.enum(AuditCategory),
    severity: z.enum(Severity),
    actorId: operatorId().nullable().describe('Operator ID, or null for the system. Never a username typed at a failed sign-in.'),
    message: text().describe('English fallback; a client renders its own copy from `type` and `details`.'),
    sessionId: sessionId().nullable(),
    evidenceId: evidenceId().nullable(),
    deviceId: label().nullable().describe('A device of the Core (e.g. CAM-01) or a paired device of the registry (`DEV-NNNN`), or null.'),
    details: details().describe('Flat values. Never a password, a token, a code, a credential or a typed username (SR-54).'),
    prevHash: sha256(),
    hash: sha256().describe('sha256(prevHash and the canonical JSON of the twelve members above).'),
  })
  .describe('One audit row with its full hashed body, so a client can verify the chain itself.');
export type AuditRowBody = z.output<typeof AuditRowSchema>;

export const AuditSliceSchema = z
  .strictObject({
    rows: z.array(AuditRowSchema).describe('The ring of the newest 1,000 rows, oldest first.'),
    head: sha256().describe('Hash of the newest row, or 64 zeros when the chain is empty.'),
    total: count().describe('Rows ever appended; the next `seq` is `total + 1`.'),
    dropped: count().describe('Rows dropped off the front of the ring.'),
  })
  .describe('Slice `audit`: the view of the audit chain. It is replaced as a whole only when a ring row changed in place.');
export type AuditSliceBody = z.output<typeof AuditSliceSchema>;

// ═══════════════════════════════════════════════════════════════════════════════════════
// faults, diagnostics, update, settings
// ═══════════════════════════════════════════════════════════════════════════════════════

export const FaultsSliceSchema = z
  .strictObject({
    active: z.array(z.strictObject({ kind: z.enum(FaultKind), since: epochMs(), target: text().nullable() })),
  })
  .describe('Slice `faults`: the demo faults that are injected and not cleared.');
export type FaultsSliceBody = z.output<typeof FaultsSliceSchema>;

export const DiagnosticsSliceSchema = z
  .strictObject({
    id: label(),
    startedAt: epochMs(),
    completedAt: nullableEpochMs(),
    checks: z.array(
      z.strictObject({
        id: label(),
        label: text(),
        status: z.enum(DiagnosticStatus),
        detail: text().nullable(),
        params: details().optional(),
        resolvesAt: nullableEpochMs().optional(),
      }),
    ),
  })
  .nullable()
  .describe('Slice `diagnostics`: the newest diagnostics run, or null before the first.');
export type DiagnosticsSliceBody = z.output<typeof DiagnosticsSliceSchema>;

export const UpdateSliceSchema = z
  .strictObject({
    currentVersion: text(),
    availableVersion: text().nullable(),
    activeSlot: z.enum(SystemSlot),
    state: z.enum(UpdateState),
    steps: z.array(z.strictObject({ id: z.enum(UpdateStep), status: z.enum(StepStatus), resolvesAt: nullableEpochMs().optional() })),
    startedAt: nullableEpochMs(),
    completedAt: nullableEpochMs(),
  })
  .describe('Slice `update`: the simulated A/B software update.');
export type UpdateSliceBody = z.output<typeof UpdateSliceSchema>;

export const SettingsSliceSchema = z
  .strictObject({
    presentationMode: z.boolean(),
    timeFormat: z.enum(['24', '12']),
    notifyWarnings: z.boolean(),
    notifySound: z.boolean(),
  })
  .describe('Slice `settings`: display preferences of the console.');
export type SettingsSliceBody = z.output<typeof SettingsSliceSchema>;

// ═══════════════════════════════════════════════════════════════════════════════════════
// captureConfig, captureDevices — slices 29 and 30 (SH-16; C3 §6; E-04)
// ═══════════════════════════════════════════════════════════════════════════════════════


/**
 * Slice 29, `captureConfig` (register SH-16; ops 76/78/79/80/89 publish it): the device selector as
 * a replicated slice. `locked` is true while a session is open — the server refuses every edit then
 * with `409 CAPTURE_CONFIG_LOCKED` (OD-10), and clients grey the controls out from this flag.
 */
export const CaptureConfigSliceSchema = z
  .strictObject({
    cameras: z.array(CaptureConfigCameraSchema).describe('VIDEO-01 first, then VIDEO-02.'),
    mics: z.array(CaptureConfigMicSchema).describe('In input order (ascending input ID): MIC-01, then MIC-02; the role is a member of the row.'),
    locked: z.boolean().describe('True while a session is open: no edit is accepted then (OD-10).'),
    updatedAt: epochMs(),
  })
  .describe('Slice `captureConfig`: the device selector (ops 76-80, 89). Its own slice, never the paired-client registry (E-04).');
export type CaptureConfigSliceBody = z.output<typeof CaptureConfigSliceSchema>;

/**
 * One device of the capture registry. The field list is `C3 §2.3`: **no credential** member exists
 * here at all (RK-12), and `host` is a host or address only, never a `user:password@` URL (C-N8).
 */
export const CaptureDeviceStatusSchema = z
  .strictObject({
    id: label().describe('`CAM-nn`, `MIC-nn` or `POE-…` (`dbc-3 §B.2` id CHECK).'),
    kind: z.enum(CaptureDeviceKind).describe('The `capture_devices.kind` value set: CAMERA, MIC, POE.'),
    model: text().nullable(),
    firmware: text().nullable(),
    host: text().nullable().describe('Host or address only; never a credential URL (C-N8).'),
    poePort: text().nullable(),
    online: z.boolean(),
    streamState: z.enum(CaptureStreamState).nullable().describe('Null for a device with no stream (a mic, the PoE switch).'),
    capabilities: z.array(label()).describe('Capability codes the adapters reported; an open set.'),
    adapter: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]{0,63}$/)
      .optional()
      .describe('The adapter kind behind the device (C3 §2.6 "Device shapes"): `ONVIF_RTSP`, `USB_AUDIO`, `SNMP_POE`, `FAKE` or `LOCAL_DEVICE`. Present on a device that operation 96 registered.'),
    sourceClass: z
      .enum(['PRODUCTION', 'DEVELOPMENT'])
      .optional()
      .describe('Derived by the Core from `adapter`: `DEVELOPMENT` exactly for `FAKE` and `LOCAL_DEVICE`. Never set by a client.'),
  })
  .describe('One capture device (`dbc-3 §B.2`); carries no credential (RK-12).');
export type CaptureDeviceStatusBody = z.output<typeof CaptureDeviceStatusSchema>;

/**
 * Slice 30, `captureDevices` (register SH-16; E-04): the capture-device registry, fed by supervisor
 * telemetry (`applyCaptureTelemetry`, SH-18). This slice is its own kind precisely so that capture
 * never reuses `AdminResource.DEVICES`, which stays the paired-client registry event.
 */
export const CaptureDevicesSliceSchema = z
  .strictObject({
    devices: z.array(CaptureDeviceStatusSchema),
  })
  .describe('Slice `captureDevices`: the capture-device registry (op 77). Never `AdminResource.DEVICE[S]` (E-04).');
export type CaptureDevicesSliceBody = z.output<typeof CaptureDevicesSliceSchema>;

// ═══════════════════════════════════════════════════════════════════════════════════════
// The 35 slices and the replicated state
// ═══════════════════════════════════════════════════════════════════════════════════════

export const StateSliceDelivery = { REPLICATED: 'replicated', STREAMED: 'streamed', CLIENT: 'client' } as const;
export type StateSliceDelivery = (typeof StateSliceDelivery)[keyof typeof StateSliceDelivery];

/**
 * How each of the 35 slices of `SimState` reaches a client in Live mode (01_specs §3.2), in state
 * order. The test holds the keys equal to `keyof SimState`, so a new slice must be classified here
 * before it compiles.
 */
export const STATE_SLICE_DELIVERY = {
  meta: StateSliceDelivery.REPLICATED,
  /** Derived on the client from `serverTime` (hello, heartbeat). */
  clock: StateSliceDelivery.CLIENT,
  device: StateSliceDelivery.REPLICATED,
  operators: StateSliceDelivery.REPLICATED,
  /** Per connection: filled from `AuthSessionInfo` and the control messages. The engine's own slice is only the actor scope of one command. */
  auth: StateSliceDelivery.CLIENT,
  /** Per console: synthesised from `SignInStatus`. Another console's lock state is never sent. */
  authLockout: StateSliceDelivery.CLIENT,
  /** Per device: from `PairingRedeemed` and `DeviceRegistration`. The engine's own slice is not used. */
  pairing: StateSliceDelivery.CLIENT,
  tabletLink: StateSliceDelivery.REPLICATED,
  session: StateSliceDelivery.REPLICATED,
  lastSealedSessionId: StateSliceDelivery.REPLICATED,
  lastSealedAcknowledged: StateSliceDelivery.REPLICATED,
  sessionHistory: StateSliceDelivery.REPLICATED,
  activeCameraId: StateSliceDelivery.REPLICATED,
  cameras: StateSliceDelivery.REPLICATED,
  mics: StateSliceDelivery.REPLICATED,
  /** The `meters` topic, 20 Hz; never stored, never in a snapshot. */
  audio: StateSliceDelivery.STREAMED,
  storage: StateSliceDelivery.REPLICATED,
  storagePolicy: StateSliceDelivery.REPLICATED,
  time: StateSliceDelivery.REPLICATED,
  network: StateSliceDelivery.REPLICATED,
  security: StateSliceDelivery.REPLICATED,
  services: StateSliceDelivery.REPLICATED,
  health: StateSliceDelivery.REPLICATED,
  otherDevices: StateSliceDelivery.REPLICATED,
  ports: StateSliceDelivery.REPLICATED,
  evidence: StateSliceDelivery.REPLICATED,
  events: StateSliceDelivery.REPLICATED,
  alerts: StateSliceDelivery.REPLICATED,
  audit: StateSliceDelivery.REPLICATED,
  faults: StateSliceDelivery.REPLICATED,
  diagnostics: StateSliceDelivery.REPLICATED,
  update: StateSliceDelivery.REPLICATED,
  settings: StateSliceDelivery.REPLICATED,
  /** Slice 29 (SH-16): the device selector, published by ops 78/79/80/89. */
  captureConfig: StateSliceDelivery.REPLICATED,
  /** Slice 30 (SH-16, E-04): the capture-device registry; its own kind, never `AdminResource.DEVICES`. */
  captureDevices: StateSliceDelivery.REPLICATED,
} as const;

/** The schema of each replicated slice, keyed by its name in `SimState`, in state order. */
export const REPLICATED_SLICE_SCHEMAS = {
  meta: MetaSliceSchema,
  device: DeviceSliceSchema,
  operators: OperatorsSliceSchema,
  tabletLink: TabletLinkSliceSchema,
  session: SessionSliceSchema,
  lastSealedSessionId: LastSealedSessionIdSliceSchema,
  lastSealedAcknowledged: LastSealedAcknowledgedSliceSchema,
  sessionHistory: SessionHistorySliceSchema,
  activeCameraId: ActiveCameraIdSliceSchema,
  cameras: CamerasSliceSchema,
  mics: MicsSliceSchema,
  storage: StorageSliceSchema,
  storagePolicy: StoragePolicySliceSchema,
  time: TimeSliceSchema,
  network: NetworkSliceSchema,
  security: SecuritySliceSchema,
  services: ServicesSliceSchema,
  health: HealthSliceSchema,
  otherDevices: OtherDevicesSliceSchema,
  ports: PortsSliceSchema,
  evidence: EvidenceSliceSchema,
  events: EventsSliceSchema,
  alerts: AlertsSliceSchema,
  audit: AuditSliceSchema,
  faults: FaultsSliceSchema,
  diagnostics: DiagnosticsSliceSchema,
  update: UpdateSliceSchema,
  settings: SettingsSliceSchema,
  // Slices 29 and 30 (SH-16): appended at the end so the v1 order stays a prefix of the v1 order.
  captureConfig: CaptureConfigSliceSchema,
  captureDevices: CaptureDevicesSliceSchema,
} as const;
export type ReplicatedSliceName = keyof typeof REPLICATED_SLICE_SCHEMAS;

/** The 30 replicated slice names, in state order. */
export const REPLICATED_SLICE_NAMES = Object.keys(REPLICATED_SLICE_SCHEMAS) as readonly ReplicatedSliceName[];

/**
 * The slices that never travel as a slice (`clock`, `auth`, `authLockout`, `pairing`) and the one
 * that is streamed (`audio`): a snapshot that carries one of them is refused.
 */
export const UNREPLICATED_SLICE_NAMES = (Object.keys(STATE_SLICE_DELIVERY) as (keyof typeof STATE_SLICE_DELIVERY)[]).filter(
  (name) => STATE_SLICE_DELIVERY[name] !== StateSliceDelivery.REPLICATED,
);

/**
 * `state` of a `snapshot`: exactly the 30 replicated slices. Strict: a 31st member is refused,
 * whatever its name.
 */
export const ReplicatedStateSchema = z
  .strictObject(REPLICATED_SLICE_SCHEMAS)
  .describe('The 30 replicated slices of the Core state. No `auth`, `authLockout`, `pairing`, `clock` or `audio`, and no other member.');
export type ReplicatedState = z.output<typeof ReplicatedStateSchema>;

/**
 * The 30 replicated slices of a state, by reference: nothing is copied or changed, so a slice that
 * did not change keeps its identity. Use it to build `snapshot.state` from the engine's state; the
 * other five slices of `SimState` stay behind.
 */
export function pickReplicatedState(state: ReplicatedState): ReplicatedState {
  const source: Readonly<Record<string, unknown>> = state;
  const picked: Record<string, unknown> = {};
  for (const name of REPLICATED_SLICE_NAMES) picked[name] = source[name];
  return picked as ReplicatedState;
}

/** `meta` → `MetaSlice`: the `components.schemas` name of a replicated slice. */
export function stateSliceSchemaName<Name extends ReplicatedSliceName>(name: Name): `${Capitalize<Name>}Slice` {
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}Slice` as `${Capitalize<Name>}Slice`;
}

/**
 * The named schemas of this module, by their `components.schemas` name: the 30 replicated slices
 * (`<Name>Slice`, in state order), then `AudioSlice` and `ReplicatedState`, then the schemas of
 * one element: the open session, a note (a session and an evidence item both hold notes), and the
 * rows a list read of contract C returns one by one (01_specs §7.8, §7.9, §7.13, §7.15).
 */
export const STATE_SCHEMAS = {
  MetaSlice: MetaSliceSchema,
  DeviceSlice: DeviceSliceSchema,
  OperatorsSlice: OperatorsSliceSchema,
  TabletLinkSlice: TabletLinkSliceSchema,
  SessionSlice: SessionSliceSchema,
  LastSealedSessionIdSlice: LastSealedSessionIdSliceSchema,
  LastSealedAcknowledgedSlice: LastSealedAcknowledgedSliceSchema,
  SessionHistorySlice: SessionHistorySliceSchema,
  ActiveCameraIdSlice: ActiveCameraIdSliceSchema,
  CamerasSlice: CamerasSliceSchema,
  MicsSlice: MicsSliceSchema,
  StorageSlice: StorageSliceSchema,
  StoragePolicySlice: StoragePolicySliceSchema,
  TimeSlice: TimeSliceSchema,
  NetworkSlice: NetworkSliceSchema,
  SecuritySlice: SecuritySliceSchema,
  ServicesSlice: ServicesSliceSchema,
  HealthSlice: HealthSliceSchema,
  OtherDevicesSlice: OtherDevicesSliceSchema,
  PortsSlice: PortsSliceSchema,
  EvidenceSlice: EvidenceSliceSchema,
  EventsSlice: EventsSliceSchema,
  AlertsSlice: AlertsSliceSchema,
  AuditSlice: AuditSliceSchema,
  FaultsSlice: FaultsSliceSchema,
  DiagnosticsSlice: DiagnosticsSliceSchema,
  UpdateSlice: UpdateSliceSchema,
  SettingsSlice: SettingsSliceSchema,
  CaptureConfigSlice: CaptureConfigSliceSchema,
  CaptureDevicesSlice: CaptureDevicesSliceSchema,
  AudioSlice: AudioSliceSchema,
  ReplicatedState: ReplicatedStateSchema,
  ActiveSession: ActiveSessionSchema,
  SessionNote: SessionNoteSchema,
  SessionHistoryEntry: SessionHistoryEntrySchema,
  EvidenceItem: EvidenceItemSchema,
  SimEvent: SimEventSchema,
  SimAlert: SimAlertSchema,
  AuditRow: AuditRowSchema,
} as const;
