// The frames, the plan and the back-off of the capture protocol (blueprint row 57 / M3-W1; capture
// spec §B.2). Each acceptance stands beside the refusal of the nearest wrong value.
//
// Blueprint row 58 (M3-W2) adds: protocol version 2, the lossless RECORD class (check M3-REC-1,
// frame half; the supervisor half is `apps/core-server/src/capture/__tests__/records.test.ts`),
// the mic inputs and the PCM tap of the plan, and the loopback media port range.
//
// Blueprint row 59 (M3-W3) adds: protocol version 3 (decision D84 R-7), the content of the
// FRAGMENT_CHECKPOINT record (both chains, media time, keyframe flag, durable instant) and the
// KEYFRAME_INTERVAL record.
//
// Blueprint row 71 (worker half, 71a) adds: protocol version 4 - the warning reason and the
// device-ID-only subject (D84 R-1, R-2), the AUDIO_SOURCE_INTERVAL and AUDIO_TIMELINE_END records,
// what FIRST_VIDEO_SAMPLE says about the video that was not written, the microphone identity and
// rate in a telemetry level, and the named settings of a worker process.
//
// Fix pass F-M3 (review 16, ruling D179) adds: NO FREE TEXT FROM A WORKER - one hostile frame per
// member that reaches a log, an alert or a file name (R63-05 / carried question 8), each refused by
// the decoder as a frame that is no message; the reason FRAGMENT_SIZE_BOUND_REACHED and the named
// setting maxFragmentBytes (R63-02); the sync level a first durable fragment states (R63-09).
//
// Task 4 rows N1 + N3 (design 06 revision 3, section 8.2 (a) to (e); decisions C110, C119 (1)) add:
// protocol version 5 - the input kind PCM_FIFO_GAPPED, the four required account members of a telemetry
// level, and the records MIC_SAMPLE_ACCOUNT (with its identity) and AUDIO_INSERTED_RUN.
import { describe, expect, it } from 'vitest';
import {
  ADVISORY_WARNING_REASONS,
  CAPTURE_AUDIO_DAY_SAMPLES,
  CAPTURE_AUDIO_INSERTED_RUN_MIN_SAMPLES,
  CAPTURE_AUDIO_INSERTED_RUNS_MAX,
  CAPTURE_MIC_ACCOUNT_PERIOD_SAMPLES,
  CAPTURE_MIC_BUFFER_MAX_SAMPLES,
  CaptureMicInputKind,
  CAMERA_RECORD_KINDS,
  CAPTURE_AUDIO_INPUT_QUANTUM_SAMPLES,
  CAPTURE_IPC_DEFAULTS,
  CAPTURE_SWITCH_BOUND_US,
  CAPTURE_WORKER_SETTINGS,
  CAPTURE_WORKER_SETTING_DEFAULTS,
  CaptureSyncLevel,
  CaptureWarningReason,
  MIC_RECORD_KINDS,
  MIC_WARNING_REASONS,
  SESSION_RECORD_KINDS,
  SWITCH_REFUSAL_CODES,
  WARNING_REASONS_OF,
  captureWorkerSettingArguments,
  CAPTURE_MEDIA_PORT_MAX,
  CAPTURE_MEDIA_PORT_MIN,
  CAPTURE_CHAIN_GENESIS_SHA256,
  CAPTURE_PROTOCOL_VERSION,
  CapturePlanSchema,
  CaptureRecordKind,
  DURABLE_RECORD_KINDS,
  FrameViolation,
  LOOPBACK_RTSP_URL,
  ONCE_PER_CAMERA_RECORD_KINDS,
  SupervisorMessageType,
  WorkerMessageType,
  backoffDelayMs,
  createLineSplitter,
  decodeSupervisorLine,
  decodeWorkerLine,
  encodeFrame,
  type CapturePlan,
  type SupervisorMessage,
  type WorkerMessage,
} from '../src/index';

const plan: CapturePlan = {
  cameras: [
    { deviceId: 'CAM-01', trackId: 'VIDEO-01', profile: null, ingestUrl: 'rtsp://127.0.0.1:8554/video01', outputPath: '/data/media/sessions/S-1/VIDEO-01.mp4' },
    { deviceId: 'CAM-02', trackId: 'VIDEO-02', profile: 'wide', ingestUrl: 'rtsp://127.0.0.1:8555/video02', outputPath: '/data/media/sessions/S-1/VIDEO-02.mp4' },
  ],
  mics: [
    { deviceId: 'MIC-01', role: 'PRIMARY', input: { kind: 'PCM_FIFO', path: '/data/run/S-1/MIC-01.pcm' } },
    { deviceId: 'MIC-02', role: 'STANDBY', input: { kind: 'PCM_FIFO', path: '/data/run/S-1/MIC-02.pcm' } },
  ],
  activeMic: 'PRIMARY',
  pcmTapPath: null,
  constants: { fragmentTargetMs: 2_000, minFragDurationMs: 2_000, gopFrames: 50, meterRateHz: 20, audioSampleRateHz: 48_000, audioChannels: 1 },
};
const v = CAPTURE_PROTOCOL_VERSION;
/** A checkpoint as the worker writes it while no cipher is set: the plaintext chain equals the stored-bytes chain. */
const checkpointRecord = {
  kind: 'FRAGMENT_CHECKPOINT',
  deviceId: 'CAM-01',
  index: 1,
  start: 1231,
  len: 3900,
  fragSha256: 'a'.repeat(64),
  chainSha256: 'b'.repeat(64),
  prefixSha256: 'c'.repeat(64),
  plaintextSha256: 'a'.repeat(64),
  plaintextChainSha256: 'b'.repeat(64),
  mediaStartMs: 0,
  mediaDurationMs: 2000,
  keyframe: true,
  durableAt: 1_791_529_000_123,
  gcmIv: null,
  gcmTag: null,
  keyId: null,
} as const;
/** What the worker says of the video it could not write before the first sample (version 4). */
const nothingSkipped = { skipped: { noTimestamp: 0, beforeAudioStart: 0, noCameraClock: 0, beforeKeyframe: 0 }, skippedSpanMs: 0 } as const;
const intervalOfTheStart = { kind: 'AUDIO_SOURCE_INTERVAL', deviceId: 'MIC-01', role: 'PRIMARY', index: 1, fromSample: 0, sampleRateHz: 48_000, capturedAtMs: 1_791_529_000_000, reason: 'SESSION_START', correlationId: null, appliedDelayUs: null } as const;
const intervalOfASwitch = { kind: 'AUDIO_SOURCE_INTERVAL', deviceId: 'MIC-02', role: 'STANDBY', index: 2, fromSample: 124_800, sampleRateHz: 48_000, capturedAtMs: 1_791_529_002_600, reason: 'OPERATOR_SWITCH', correlationId: 'cap:S-1:1:3', appliedDelayUs: 4_210 } as const;
/** The four account members every telemetry level carries since version 5 (a whole pipe: nothing inserted). */
const accountOfALevel = { timelineSamples: 480_000, receivedSamples: 481_200, insertedSamples: 0, nonZero: true } as const;
/**
 * A periodic account of a gapped microphone after one minute (version 5), in the measured pattern of the macOS
 * path (about one packet of 512 in ten missing): 2,880,000 = 2,606,592 - 0 - 1,792 + 275,200.
 */
const periodicAccount = {
  kind: 'MIC_SAMPLE_ACCOUNT',
  deviceId: 'MIC-01',
  role: 'PRIMARY',
  closing: false,
  sampleRateHz: 48_000,
  timelineSamples: 2_880_000,
  receivedSamples: 2_606_592,
  insertedSamples: 275_200,
  discardedSamples: 0,
  bufferedSamples: 1_792,
  nonFiniteSamples: 0,
  fedSamples: 2_880_000,
  fedInsertedSamples: 275_200,
  fedRuns: 5_400,
  fedLongestRunSamples: 512,
  listedRuns: 0,
  runsNotListed: 0,
  runsNotListedSamples: 0,
  openRunFromSample: null,
} as const;
const insertedRun = { kind: 'AUDIO_INSERTED_RUN', deviceId: 'MIC-01', role: 'PRIMARY', index: 1, fromSample: 0, samples: 192_000, sampleRateHz: 48_000 } as const;

describe('the messages', () => {
  it('the protocol has the three commands and the eight worker messages of spec §B.2 (the eight of its table, HELLO, ACK and, since version 2, RECORD); version 3 since the checkpoint content, version 4 since the microphone rows, version 5 since the sample account', () => {
    expect(CAPTURE_PROTOCOL_VERSION).toBe(5);
    expect(Object.values(SupervisorMessageType)).toEqual(['START', 'STOP', 'SWITCH_AUDIO_SOURCE']);
    expect(Object.values(WorkerMessageType)).toEqual(['HELLO', 'ACK', 'TELEMETRY', 'PROGRESS', 'HEARTBEAT', 'WARNING', 'CRASH', 'RECORD']);
    expect(Object.values(CaptureRecordKind)).toEqual(['FIRST_VIDEO_SAMPLE', 'FIRST_DURABLE_FRAGMENT', 'FRAGMENT_CHECKPOINT', 'KEYFRAME_INTERVAL', 'AUDIO_SOURCE_INTERVAL', 'AUDIO_TIMELINE_END', 'SEAL_COMPLETE', 'MIC_SAMPLE_ACCOUNT', 'AUDIO_INSERTED_RUN']);
    // Every kind says whose device ID it carries: a camera's, a microphone's, or none.
    expect([...CAMERA_RECORD_KINDS, ...MIC_RECORD_KINDS, ...SESSION_RECORD_KINDS].sort()).toEqual(Object.values(CaptureRecordKind).sort());
    expect(MIC_RECORD_KINDS).toEqual(['AUDIO_SOURCE_INTERVAL', 'MIC_SAMPLE_ACCOUNT', 'AUDIO_INSERTED_RUN']);
    expect(SESSION_RECORD_KINDS).toEqual(['AUDIO_TIMELINE_END', 'SEAL_COMPLETE']);
    expect(DURABLE_RECORD_KINDS).toEqual(['FIRST_DURABLE_FRAGMENT', 'FRAGMENT_CHECKPOINT']);
    // The observed keyframe interval says nothing about the disk: it is no sign of durability.
    expect(ONCE_PER_CAMERA_RECORD_KINDS).toEqual(['FIRST_VIDEO_SAMPLE', 'FIRST_DURABLE_FRAGMENT', 'KEYFRAME_INTERVAL']);
  });

  it('every message survives a frame: encode, split, decode gives the same value', () => {
    const commands: SupervisorMessage[] = [
      { v, type: 'START', sessionId: 'S-1', correlationId: 'cap:S-1:1:1', attempt: 1, plan },
      { v, type: 'STOP', sessionId: 'S-1', correlationId: 'cap:S-1:1:2', reason: 'STOPPED' },
      { v, type: 'SWITCH_AUDIO_SOURCE', sessionId: 'S-1', correlationId: 'cap:S-1:1:3', to: 'STANDBY' },
    ];
    const messages: WorkerMessage[] = [
      { v, type: 'HELLO', protocolVersion: 1, workerVersion: '0.1.0' },
      { v, type: 'ACK', correlationId: 'cap:S-1:1:1', ok: true },
      { v, type: 'ACK', correlationId: 'cap:S-1:1:3', ok: false, code: 'MIC_UNPLUGGED' },
      { v, type: 'HEARTBEAT', counter: 7 },
      { v, type: 'TELEMETRY', sessionId: 'S-1', levels: [{ deviceId: 'MIC-01', role: 'PRIMARY', dbfs: -18.5, clipped: false, ratePpm: -12.5, ...accountOfALevel }, { deviceId: 'MIC-02', role: 'STANDBY', dbfs: null, clipped: false, ratePpm: null, timelineSamples: 480_000, receivedSamples: 0, insertedSamples: 480_000, nonZero: false }], ingest: [{ deviceId: 'VIDEO-01', state: 'CONNECTED' }], fragments: [{ deviceId: 'VIDEO-01', count: 3, bytes: 4096 }], clocks: [{ deviceId: 'VIDEO-01', lagMs: 4.8, trendPpm: null, nearBound: false }], tapActive: false },
      { v, type: 'PROGRESS', sessionId: 'S-1', step: 'HASH', progress: 0.25, etaMs: 1200 },
      { v, type: 'WARNING', sessionId: 'S-1', code: 'MIC_SILENT', reason: 'MIC_LEVEL_BELOW_THRESHOLD', state: 'ACTIVE', subject: 'MIC-01' },
      { v, type: 'WARNING', sessionId: 'S-1', code: 'CAPTURE_FAULT', reason: 'MIC_DISCONNECTED', state: 'CLEARED', subject: 'MIC-02' },
      { v, type: 'WARNING', sessionId: 'S-1', code: 'CAPTURE_FAULT', reason: 'KEYFRAME_INTERVAL_ABOVE_BOUND', state: 'ACTIVE', subject: 'CAM-02' },
      { v, type: 'RECORD', sessionId: 'S-1', seq: 7, record: intervalOfTheStart },
      { v, type: 'RECORD', sessionId: 'S-1', seq: 8, record: intervalOfASwitch },
      { v, type: 'RECORD', sessionId: 'S-1', seq: 9, record: { kind: 'AUDIO_TIMELINE_END', samples: 480_000, sampleRateHz: 48_000, intervals: 2 } },
      { v, type: 'CRASH', sessionId: null, code: 'ENCODER_INIT', signal: null, exitCode: 3 },
      { v, type: 'RECORD', sessionId: 'S-1', seq: 1, record: { kind: 'FIRST_DURABLE_FRAGMENT', deviceId: 'VIDEO-01', bytes: 5131 } },
      { v, type: 'RECORD', sessionId: 'S-1', seq: 2, record: checkpointRecord },
      { v, type: 'RECORD', sessionId: 'S-1', seq: 5, record: { ...checkpointRecord, index: 2, plaintextSha256: 'd'.repeat(64), plaintextChainSha256: 'e'.repeat(64), gcmIv: '0'.repeat(24), gcmTag: 'f'.repeat(32), keyId: 'KID-S-1' } },
      { v, type: 'RECORD', sessionId: 'S-1', seq: 6, record: { kind: 'KEYFRAME_INTERVAL', deviceId: 'CAM-01', observedMs: 5000, boundMs: 2000, intervals: 1, complete: true, aboveBound: true } },
      { v, type: 'RECORD', sessionId: 'S-1', seq: 3, record: { kind: 'SEAL_COMPLETE' } },
      { v, type: 'RECORD', sessionId: 'S-1', seq: 4, record: { kind: 'FIRST_VIDEO_SAMPLE', deviceId: 'VIDEO-01', pts: 526386, timescale: 90000, skipped: { noTimestamp: 1, beforeAudioStart: 0, noCameraClock: 0, beforeKeyframe: 29 }, skippedSpanMs: 805 } },
      { v, type: 'RECORD', sessionId: 'S-1', seq: 10, record: insertedRun },
      { v, type: 'RECORD', sessionId: 'S-1', seq: 11, record: periodicAccount },
    ];
    const commandSplitter = createLineSplitter();
    expect(commands.flatMap((command) => commandSplitter.push(encodeFrame(command))).map((line) => decodeSupervisorLine(line ?? ''))).toEqual(commands.map((message) => ({ ok: true, message })));
    const splitter = createLineSplitter();
    expect(messages.flatMap((message) => splitter.push(encodeFrame(message))).map((line) => decodeWorkerLine(line ?? ''))).toEqual(messages.map((message) => ({ ok: true, message })));
  });

  it('refuses what is no message: another version, an unknown type, an extra member, free text as a code, a command as a worker message', () => {
    const not = (value: unknown) => decodeWorkerLine(JSON.stringify(value));
    const refused = { ok: false, violation: FrameViolation.NOT_A_MESSAGE };
    expect(not({ v, type: 'HEARTBEAT', counter: 1 })).toMatchObject({ ok: true });
    expect(not({ v: v - 1, type: 'HEARTBEAT', counter: 1 })).toEqual(refused);
    expect(not({ v: v + 1, type: 'HEARTBEAT', counter: 1 })).toEqual(refused);
    expect(not({ v, type: 'HEARTBEAT', counter: -1 })).toEqual(refused);
    expect(not({ v, type: 'HEARTBEAT', counter: 1, extra: true })).toEqual(refused);
    expect(not({ v, type: 'PING' })).toEqual(refused);
    expect(not({ v, type: 'ACK', correlationId: 'c', ok: false, code: 'free text with spaces' })).toEqual(refused);
    const silent = { v, type: 'WARNING', sessionId: 'S-1', code: 'MIC_SILENT', reason: 'MIC_LEVEL_BELOW_THRESHOLD', state: 'CLEARED', subject: 'MIC-01' };
    expect(not(silent)).toMatchObject({ ok: true });
    expect(not({ ...silent, code: 'AUTO_SWITCHED' })).toEqual(refused);
    expect(not({ ...silent, state: undefined })).toEqual(refused);
    expect(not({ ...silent, state: 'GONE' })).toEqual(refused);
    expect(not({ v, type: 'STOP', sessionId: 'S-1', correlationId: 'c', reason: 'STOPPED' })).toEqual(refused);
    expect(decodeWorkerLine('{"v":5,')).toEqual({ ok: false, violation: FrameViolation.NOT_JSON });
    expect(decodeWorkerLine(JSON.stringify({ v, type: 'HEARTBEAT', counter: 1 }), 10)).toEqual({ ok: false, violation: FrameViolation.TOO_LONG });
  });

  it('version 3 (D84 R-7): no frame of a version-2 worker decodes, not even one that has every member of today', () => {
    const frames = [
      { type: 'HELLO', protocolVersion: 2, workerVersion: 'capture-worker/0.2.0' },
      { type: 'HEARTBEAT', counter: 1 },
      { type: 'WARNING', sessionId: 'S-1', code: 'CAPTURE_FAULT', reason: 'CAMERA_STREAM_ENDED', state: 'ACTIVE', subject: 'CAM-01' },
      { type: 'RECORD', sessionId: 'S-1', seq: 1, record: checkpointRecord },
    ];
    for (const frame of frames) {
      expect(decodeWorkerLine(JSON.stringify({ v: 2, ...frame })), frame.type).toEqual({ ok: false, violation: FrameViolation.NOT_A_MESSAGE });
      // CONTROL: the same frame under version 3 is a message (the version is what refuses it).
      expect(decodeWorkerLine(JSON.stringify({ v, ...frame })).ok, frame.type).toBe(true);
    }
    // What version 2 allowed inside the version: a WARNING without `state`. It is no message since version 3.
    expect(decodeWorkerLine(JSON.stringify({ v, type: 'WARNING', sessionId: 'S-1', code: 'CAPTURE_FAULT', reason: 'CAMERA_STREAM_ENDED', subject: 'CAM-01' })).ok).toBe(false);
    // A command of version 2 is no command for a later worker either.
    expect(decodeSupervisorLine(JSON.stringify({ v: 2, type: 'STOP', sessionId: 'S-1', correlationId: 'c', reason: 'STOPPED' })).ok).toBe(false);
  });

  it('version 4 (row 71): no frame of a version-3 worker decodes, and the frames version 3 allowed are no messages of version 4', () => {
    const today = [
      { type: 'HELLO', protocolVersion: 3, workerVersion: 'capture-worker/0.3.0' },
      { type: 'HEARTBEAT', counter: 1 },
      { type: 'WARNING', sessionId: 'S-1', code: 'CAPTURE_FAULT', reason: 'CAMERA_STREAM_ENDED', state: 'ACTIVE', subject: 'CAM-01' },
      { type: 'RECORD', sessionId: 'S-1', seq: 1, record: intervalOfTheStart },
    ];
    for (const frame of today) {
      expect(decodeWorkerLine(JSON.stringify({ v: 3, ...frame })), frame.type).toEqual({ ok: false, violation: FrameViolation.NOT_A_MESSAGE });
      // CONTROL: the same frame under the version of this package is a message.
      expect(decodeWorkerLine(JSON.stringify({ v, ...frame })).ok, frame.type).toBe(true);
    }
    // The shapes of version 3, sent under the version of this package: each is refused by what version 4 requires.
    const version3Shapes = [
      { type: 'WARNING', sessionId: 'S-1', code: 'CAPTURE_FAULT', state: 'ACTIVE', subject: 'CAM-01' },
      { type: 'TELEMETRY', sessionId: 'S-1', levels: [{ role: 'PRIMARY', dbfs: -18.5, clipped: false }], ingest: [], fragments: [], clocks: [], tapActive: false },
      { type: 'RECORD', sessionId: 'S-1', seq: 1, record: { kind: 'FIRST_VIDEO_SAMPLE', deviceId: 'CAM-01', pts: 0, timescale: 90000 } },
    ];
    for (const frame of version3Shapes) expect(decodeWorkerLine(JSON.stringify({ v, ...frame })).ok, frame.type).toBe(false);
    expect(decodeSupervisorLine(JSON.stringify({ v: 3, type: 'SWITCH_AUDIO_SOURCE', sessionId: 'S-1', correlationId: 'c', to: 'STANDBY' })).ok).toBe(false);
    expect(decodeSupervisorLine(JSON.stringify({ v, type: 'SWITCH_AUDIO_SOURCE', sessionId: 'S-1', correlationId: 'c', to: 'STANDBY' })).ok).toBe(true);
    // The switch names a ROLE of the plan and nothing else: a device ID or a third value is no command.
    expect(decodeSupervisorLine(JSON.stringify({ v, type: 'SWITCH_AUDIO_SOURCE', sessionId: 'S-1', correlationId: 'c', to: 'MIC-02' })).ok).toBe(false);
    expect(SWITCH_REFUSAL_CODES).toEqual(['NOT_RECORDING', 'SESSION_MISMATCH', 'NO_SUCH_MIC', 'SWITCH_PENDING', 'SELECTOR_COMMAND_FAILED']);
  });

  it('a warning names ONE device by its ID and says which cause it is: never a null subject, never a role (D84 R-1, R-2)', () => {
    const ok = (warning: object): boolean => decodeWorkerLine(JSON.stringify({ v, type: 'WARNING', sessionId: 'S-1', ...warning })).ok;
    const silent = { code: 'MIC_SILENT', reason: 'MIC_LEVEL_BELOW_THRESHOLD', state: 'ACTIVE', subject: 'MIC-01' };
    expect(ok(silent)).toBe(true);
    expect(ok({ ...silent, state: 'CLEARED' })).toBe(true);
    // R-1: a null subject is forbidden on the wire, for a raise and for a clear, for both codes.
    expect(ok({ ...silent, subject: null })).toBe(false);
    expect(ok({ ...silent, state: 'CLEARED', subject: null })).toBe(false);
    expect(ok({ code: 'CAPTURE_FAULT', reason: 'CAMERA_STREAM_ENDED', state: 'ACTIVE', subject: null })).toBe(false);
    const { subject: _dropped, ...noSubject } = silent;
    expect(ok(noSubject)).toBe(false);
    expect(ok({ ...silent, subject: '' })).toBe(false);
    // R-2: one subject form per microphone. A role is not a subject.
    expect(ok({ ...silent, subject: 'PRIMARY' })).toBe(false);
    expect(ok({ ...silent, subject: 'STANDBY' })).toBe(false);
    // The reason is required and belongs to its code.
    const { reason: _reason, ...noReason } = silent;
    expect(ok(noReason)).toBe(false);
    expect(ok({ ...silent, reason: 'MIC_DISCONNECTED' })).toBe(false);
    expect(ok({ ...silent, reason: 'SOMETHING_ELSE' })).toBe(false);
    expect(ok({ code: 'CAPTURE_FAULT', reason: 'MIC_LEVEL_BELOW_THRESHOLD', state: 'ACTIVE', subject: 'MIC-01' })).toBe(false);
    for (const reason of WARNING_REASONS_OF.CAPTURE_FAULT) expect(ok({ code: 'CAPTURE_FAULT', reason, state: 'ACTIVE', subject: 'CAM-01' }), reason).toBe(true);
    // Every reason belongs to exactly one code; the microphone reasons and the advisory one are named.
    expect([...WARNING_REASONS_OF.MIC_SILENT, ...WARNING_REASONS_OF.CAPTURE_FAULT].sort()).toEqual(Object.values(CaptureWarningReason).sort());
    expect(MIC_WARNING_REASONS).toEqual(['MIC_LEVEL_BELOW_THRESHOLD', 'MIC_DISCONNECTED', 'MIC_RATE_AT_LIMIT']);
    // R63-02: a fragment closed at the size bound is an advisory about a camera that RECORDS, under the existing code.
    expect(ADVISORY_WARNING_REASONS).toEqual(['KEYFRAME_INTERVAL_ABOVE_BOUND', 'FRAGMENT_SIZE_BOUND_REACHED']);
    expect(WARNING_REASONS_OF.CAPTURE_FAULT).toContain('FRAGMENT_SIZE_BOUND_REACHED');
    expect(WARNING_REASONS_OF.MIC_SILENT).not.toContain('FRAGMENT_SIZE_BOUND_REACHED');
    // Task 4 row 182 (BR-04 (3)): the three causes of a camera that never delivered are members of their own, added
    // inside version 4. Each is a fault of a CAMERA under the existing code - no microphone reason, no advice - and
    // a fixed word: a member-like word that is not of the list (a path, a lower-case form, a suffix) is no message.
    const added = ['CAMERA_ANNOUNCE_NOT_MATCHED', 'CAMERA_ANNOUNCE_NOT_SEEN', 'CAMERA_NO_PICTURE'] as const;
    expect(v).toBe(5);
    expect(Object.values(CaptureWarningReason)).toHaveLength(11);
    for (const reason of added) {
      expect(CaptureWarningReason[reason], reason).toBe(reason);
      expect(ok({ code: 'CAPTURE_FAULT', reason, state: 'ACTIVE', subject: 'CAM-01' }), reason).toBe(true);
      expect(ok({ code: 'MIC_SILENT', reason, state: 'ACTIVE', subject: 'MIC-01' }), reason).toBe(false);
      expect(ok({ code: 'CAPTURE_FAULT', reason, state: 'ACTIVE', subject: null }), reason).toBe(false);
      expect(ok({ code: 'CAPTURE_FAULT', reason: `${reason}:s-1/video-01`, state: 'ACTIVE', subject: 'CAM-01' }), reason).toBe(false);
      expect(ok({ code: 'CAPTURE_FAULT', reason: reason.toLowerCase(), state: 'ACTIVE', subject: 'CAM-01' }), reason).toBe(false);
      expect(MIC_WARNING_REASONS, reason).not.toContain(reason);
      expect(ADVISORY_WARNING_REASONS, reason).not.toContain(reason);
    }
    // The member a worker before them said for all three is still one.
    expect(ok({ code: 'CAPTURE_FAULT', reason: 'CAMERA_NOT_CONNECTED', state: 'ACTIVE', subject: 'CAM-01' })).toBe(true);
    // There is no code and no reason for an automatic switch (OD-11).
    expect(Object.values(CaptureWarningReason).some((reason) => /SWITCH/.test(reason))).toBe(false);
  });

  it('the audio-source interval: the microphone by device ID and role, the first sample at an input-chunk boundary, the command it realises', () => {
    const ok = (record: unknown): boolean => decodeWorkerLine(JSON.stringify({ v, type: 'RECORD', sessionId: 'S-1', seq: 1, record })).ok;
    expect(ok(intervalOfTheStart)).toBe(true);
    expect(ok(intervalOfASwitch)).toBe(true);
    expect([CAPTURE_AUDIO_INPUT_QUANTUM_SAMPLES, CAPTURE_SWITCH_BOUND_US]).toEqual([480, 21_333]);
    // A source changes at a chunk boundary, and nowhere else.
    expect(ok({ ...intervalOfASwitch, fromSample: 124_801 })).toBe(false);
    expect(ok({ ...intervalOfASwitch, fromSample: 124_800 + 480 })).toBe(true);
    expect(ok({ ...intervalOfASwitch, fromSample: -480 })).toBe(false);
    // The start is index 1 at sample 0 without a command; a switch is neither and names its command and its delay.
    expect(ok({ ...intervalOfTheStart, index: 2 })).toBe(false);
    expect(ok({ ...intervalOfTheStart, fromSample: 480 })).toBe(false);
    expect(ok({ ...intervalOfTheStart, correlationId: 'cap:S-1:1:3' })).toBe(false);
    expect(ok({ ...intervalOfTheStart, appliedDelayUs: 0 })).toBe(false);
    expect(ok({ ...intervalOfASwitch, index: 1 })).toBe(false);
    expect(ok({ ...intervalOfASwitch, fromSample: 0 })).toBe(false);
    expect(ok({ ...intervalOfASwitch, correlationId: null })).toBe(false);
    expect(ok({ ...intervalOfASwitch, appliedDelayUs: null })).toBe(false);
    // No third reason: nothing but the start and the operator opens an interval.
    expect(ok({ ...intervalOfASwitch, reason: 'AUTO_SWITCH' })).toBe(false);
    expect(ok({ ...intervalOfASwitch, reason: 'MIC_SILENT' })).toBe(false);
    // The microphone is a device ID with its role beside it; a role is no device ID.
    expect(ok({ ...intervalOfASwitch, deviceId: 'STANDBY' })).toBe(false);
    for (const member of ['deviceId', 'role', 'index', 'fromSample', 'sampleRateHz', 'capturedAtMs', 'reason', 'correlationId', 'appliedDelayUs'] as const) {
      const { [member]: _dropped, ...rest } = intervalOfASwitch;
      expect(ok(rest), member).toBe(false);
    }
    expect(ok({ ...intervalOfASwitch, toSample: 200_000 })).toBe(false);
    // The end of the timeline closes the last interval.
    const end = { kind: 'AUDIO_TIMELINE_END', samples: 480_000, sampleRateHz: 48_000, intervals: 3 };
    expect(ok(end)).toBe(true);
    expect(ok({ ...end, samples: 0 })).toBe(true);
    expect(ok({ ...end, intervals: 0 })).toBe(false);
    expect(ok({ ...end, samples: -1 })).toBe(false);
    expect(ok({ ...end, deviceId: 'MIC-01' })).toBe(false);
  });

  it('the first video sample states the video that arrived before it and was not written (spec §C.4; D126, D130)', () => {
    const ok = (record: unknown): boolean => decodeWorkerLine(JSON.stringify({ v, type: 'RECORD', sessionId: 'S-1', seq: 1, record })).ok;
    const first = { kind: 'FIRST_VIDEO_SAMPLE', deviceId: 'CAM-01', pts: 72_450, timescale: 90_000, skipped: { noTimestamp: 1, beforeAudioStart: 0, noCameraClock: 0, beforeKeyframe: 29 }, skippedSpanMs: 805 };
    expect(ok(first)).toBe(true);
    expect(ok({ ...first, ...nothingSkipped })).toBe(true);
    const { skipped: _skipped, ...withoutCounts } = first;
    expect(ok(withoutCounts)).toBe(false);
    const { skippedSpanMs: _span, ...withoutSpan } = first;
    expect(ok(withoutSpan)).toBe(false);
    expect(ok({ ...first, skipped: { ...first.skipped, beforeKeyframe: -1 } })).toBe(false);
    expect(ok({ ...first, skipped: { noTimestamp: 1, beforeAudioStart: 0, noCameraClock: 0 } })).toBe(false);
    expect(ok({ ...first, skipped: { ...first.skipped, other: 3 } })).toBe(false);
    expect(ok({ ...first, skippedSpanMs: 0.5 })).toBe(false);
  });

  it('a telemetry level names its microphone by device ID, with its role and the rate correction inside the controller limit', () => {
    const ok = (level: unknown): boolean => decodeWorkerLine(JSON.stringify({ v, type: 'TELEMETRY', sessionId: 'S-1', levels: [level], ingest: [], fragments: [], clocks: [], tapActive: false })).ok;
    const level = { deviceId: 'MIC-01', role: 'PRIMARY', dbfs: -20, clipped: false, ratePpm: 4_999.9, ...accountOfALevel };
    expect(ok(level)).toBe(true);
    expect(ok({ ...level, ratePpm: -5_000 })).toBe(true);
    expect(ok({ ...level, ratePpm: null })).toBe(true);
    expect(ok({ ...level, ratePpm: 5_000.1 })).toBe(false);
    expect(ok({ ...level, deviceId: 'PRIMARY' })).toBe(false);
    const { deviceId: _dropped, ...noDevice } = level;
    expect(ok(noDevice)).toBe(false);
    const { ratePpm: _rate, ...noRate } = level;
    expect(ok(noRate)).toBe(false);
  });

  // ── Version 5 (task 4 rows N1 + N3; design 06 section 8.2 (a) to (e)) ──────────────────────────
  it('version 5: no frame of a version-4 worker decodes, and a version-4 telemetry level (without the account) is no message', () => {
    const today = [
      { type: 'HELLO', protocolVersion: 4, workerVersion: 'capture-worker/0.6.0' },
      { type: 'HEARTBEAT', counter: 1 },
      { type: 'RECORD', sessionId: 'S-1', seq: 1, record: intervalOfTheStart },
    ];
    for (const frame of today) {
      expect(decodeWorkerLine(JSON.stringify({ v: 4, ...frame })), frame.type).toEqual({ ok: false, violation: FrameViolation.NOT_A_MESSAGE });
      // CONTROL: the same frame under version 5 is a message (the version is what refuses it).
      expect(decodeWorkerLine(JSON.stringify({ v: 5, ...frame })).ok, frame.type).toBe(true);
    }
    const version4Level = { deviceId: 'MIC-01', role: 'PRIMARY', dbfs: -20, clipped: false, ratePpm: 0 };
    const telemetry = (level: unknown) => decodeWorkerLine(JSON.stringify({ v: 5, type: 'TELEMETRY', sessionId: 'S-1', levels: [level], ingest: [], fragments: [], clocks: [], tapActive: false })).ok;
    expect(telemetry(version4Level)).toBe(false);
    expect(telemetry({ ...version4Level, ...accountOfALevel })).toBe(true);
    expect(decodeSupervisorLine(JSON.stringify({ v: 4, type: 'STOP', sessionId: 'S-1', correlationId: 'c', reason: 'STOPPED' })).ok).toBe(false);
  });

  it('version 5: the three constants of the account, and a telemetry level states timeline, received, inserted and nonZero - each required, each a whole count of one day at most', () => {
    expect([CAPTURE_MIC_ACCOUNT_PERIOD_SAMPLES, CAPTURE_AUDIO_INSERTED_RUN_MIN_SAMPLES, CAPTURE_AUDIO_INSERTED_RUNS_MAX]).toEqual([2_880_000, 4_800, 1_024]);
    expect([CAPTURE_AUDIO_DAY_SAMPLES, CAPTURE_MIC_BUFFER_MAX_SAMPLES]).toEqual([4_147_200_000, 96_000]);
    expect(CAPTURE_MIC_ACCOUNT_PERIOD_SAMPLES % CAPTURE_AUDIO_INPUT_QUANTUM_SAMPLES).toBe(0);
    const ok = (level: unknown): boolean => decodeWorkerLine(JSON.stringify({ v, type: 'TELEMETRY', sessionId: 'S-1', levels: [level], ingest: [], fragments: [], clocks: [], tapActive: false })).ok;
    // A gapped microphone: no rate controller runs, ratePpm is null.
    const gapped = { deviceId: 'MIC-01', role: 'PRIMARY', dbfs: -24, clipped: false, ratePpm: null, timelineSamples: 480_000, receivedSamples: 434_176, insertedSamples: 47_744, nonZero: true };
    expect(ok(gapped)).toBe(true);
    expect(ok({ ...gapped, timelineSamples: 0, receivedSamples: 0, insertedSamples: 0, nonZero: false })).toBe(true);
    expect(ok({ ...gapped, timelineSamples: CAPTURE_AUDIO_DAY_SAMPLES, insertedSamples: CAPTURE_AUDIO_DAY_SAMPLES, receivedSamples: CAPTURE_AUDIO_DAY_SAMPLES })).toBe(true);
    for (const member of ['timelineSamples', 'receivedSamples', 'insertedSamples', 'nonZero'] as const) {
      const { [member]: _dropped, ...rest } = gapped;
      expect(ok(rest), `without ${member}`).toBe(false);
    }
    for (const member of ['timelineSamples', 'receivedSamples', 'insertedSamples'] as const) {
      expect(ok({ ...gapped, [member]: -1 }), `${member} -1`).toBe(false);
      expect(ok({ ...gapped, [member]: 1.5 }), `${member} 1.5`).toBe(false);
      expect(ok({ ...gapped, [member]: CAPTURE_AUDIO_DAY_SAMPLES + 1 }), `${member} above a day`).toBe(false);
      expect(ok({ ...gapped, [member]: '480000' }), `${member} as text`).toBe(false);
    }
    // Inserted never above the timeline: the nearest wrong value on each side.
    expect(ok({ ...gapped, insertedSamples: 480_000 })).toBe(true);
    expect(ok({ ...gapped, insertedSamples: 480_001 })).toBe(false);
    expect(ok({ ...gapped, nonZero: 'yes' })).toBe(false);
    expect(ok({ ...gapped, nonZero: null })).toBe(false);
    expect(ok({ ...gapped, shortfallPercent: 9.9 })).toBe(false);
  });

  it('version 5: the input kind PCM_FIFO_GAPPED - the same bytes, a writer that does not promise every sample', () => {
    expect(Object.values(CaptureMicInputKind)).toEqual(['PCM_FIFO', 'PCM_FIFO_GAPPED']);
    const gappedPlan = { ...plan, mics: [{ ...plan.mics[0], input: { kind: 'PCM_FIFO_GAPPED', path: '/data/run/S-1/MIC-01.pcm' } }, plan.mics[1]] };
    expect(CapturePlanSchema.safeParse(gappedPlan).success).toBe(true);
    // One microphone of each kind, or both gapped.
    expect(CapturePlanSchema.safeParse({ ...gappedPlan, mics: [gappedPlan.mics[0], { ...plan.mics[1], input: { kind: 'PCM_FIFO_GAPPED', path: '/data/run/S-1/MIC-02.pcm' } }] }).success).toBe(true);
    // Near misses of the word, and a member more, are no plan.
    for (const kind of ['PCM_FIFO_GAPPED ', 'pcm_fifo_gapped', 'PCM_FIFO_GAP', 'PCM_FIFO-GAPPED', 'GAPPED']) {
      expect(CapturePlanSchema.safeParse({ ...plan, mics: [{ ...plan.mics[0], input: { kind, path: '/data/run/S-1/MIC-01.pcm' } }] }).success, kind).toBe(false);
    }
    expect(CapturePlanSchema.safeParse({ ...plan, mics: [{ ...plan.mics[0], input: { kind: 'PCM_FIFO_GAPPED', path: '/data/run/S-1/MIC-01.pcm', sampleRateHz: 48_000 } }] }).success).toBe(false);
    expect(CapturePlanSchema.safeParse({ ...plan, mics: [{ ...plan.mics[0], input: { kind: 'PCM_FIFO_GAPPED', path: 'relative.pcm' } }] }).success).toBe(false);
  });

  it('version 5: MIC_SAMPLE_ACCOUNT holds its identity to the sample, and every cross rule refuses its nearest wrong value', () => {
    const ok = (record: unknown): boolean => decodeWorkerLine(JSON.stringify({ v, type: 'RECORD', sessionId: 'S-1', seq: 1, record })).ok;
    expect(ok(periodicAccount)).toBe(true);
    // THE IDENTITY: timeline = received - discarded - buffered + inserted. One sample off in any term is no record.
    expect(periodicAccount.receivedSamples - periodicAccount.discardedSamples - periodicAccount.bufferedSamples + periodicAccount.insertedSamples).toBe(periodicAccount.timelineSamples);
    for (const member of ['receivedSamples', 'insertedSamples', 'bufferedSamples'] as const) {
      expect(ok({ ...periodicAccount, [member]: periodicAccount[member] + 1 }), `${member} + 1`).toBe(false);
      expect(ok({ ...periodicAccount, [member]: periodicAccount[member] - 1 }), `${member} - 1`).toBe(false);
    }
    expect(ok({ ...periodicAccount, discardedSamples: 1 })).toBe(false);
    expect(ok({ ...periodicAccount, discardedSamples: 1, receivedSamples: periodicAccount.receivedSamples + 1 })).toBe(true);
    // The closing account: the buffer's rest is discarded, nothing is buffered and no run is open.
    const closing = { ...periodicAccount, closing: true, bufferedSamples: 0, discardedSamples: 1_792 };
    expect(ok(closing)).toBe(true);
    expect(ok({ ...closing, bufferedSamples: 1_792, discardedSamples: 0 })).toBe(false);
    expect(ok({ ...closing, openRunFromSample: 0 })).toBe(false);
    expect(ok({ ...periodicAccount, openRunFromSample: 2_870_400 })).toBe(true);
    // The timeline grows by whole input chunks.
    expect(ok({ ...periodicAccount, timelineSamples: 2_880_001, insertedSamples: 275_201 })).toBe(false);
    // Bounds.
    expect(ok({ ...periodicAccount, bufferedSamples: CAPTURE_MIC_BUFFER_MAX_SAMPLES + 1, receivedSamples: periodicAccount.receivedSamples + CAPTURE_MIC_BUFFER_MAX_SAMPLES + 1 - 1_792 })).toBe(false);
    expect(ok({ ...periodicAccount, listedRuns: CAPTURE_AUDIO_INSERTED_RUNS_MAX + 1, fedRuns: 9_999 })).toBe(false);
    expect(ok({ ...periodicAccount, listedRuns: CAPTURE_AUDIO_INSERTED_RUNS_MAX, fedRuns: 9_999 })).toBe(true);
    expect(ok({ ...periodicAccount, sampleRateHz: 0 })).toBe(false);
    // Cross rules beside the identity.
    expect(ok({ ...periodicAccount, nonFiniteSamples: periodicAccount.receivedSamples + 1 })).toBe(false);
    expect(ok({ ...periodicAccount, fedSamples: periodicAccount.timelineSamples + 480 })).toBe(false);
    expect(ok({ ...periodicAccount, fedInsertedSamples: periodicAccount.insertedSamples + 1 })).toBe(false);
    expect(ok({ ...periodicAccount, fedSamples: 1_000, fedInsertedSamples: 1_001 })).toBe(false);
    expect(ok({ ...periodicAccount, fedLongestRunSamples: periodicAccount.timelineSamples + 1 })).toBe(false);
    expect(ok({ ...periodicAccount, fedRuns: 2, listedRuns: 2, runsNotListed: 1, runsNotListedSamples: 4_800 })).toBe(false);
    expect(ok({ ...periodicAccount, fedRuns: 3, listedRuns: 2, runsNotListed: 1, runsNotListedSamples: 4_800 })).toBe(true);
    // Strict: every member required, nothing else, never a role as the device, never free text.
    for (const member of Object.keys(periodicAccount).filter((key) => key !== 'kind')) {
      const { [member as keyof typeof periodicAccount]: _dropped, ...rest } = periodicAccount;
      expect(ok(rest), `without ${member}`).toBe(false);
    }
    expect(ok({ ...periodicAccount, shortfallPercent: 9.55 })).toBe(false);
    expect(ok({ ...periodicAccount, deviceId: 'PRIMARY' })).toBe(false);
    expect(ok({ ...periodicAccount, deviceId: 'MIC 01 (USB interface)' })).toBe(false);
    expect(ok({ ...periodicAccount, role: 'SECOND' })).toBe(false);
  });

  it('version 5: AUDIO_INSERTED_RUN - a run of 4,800 samples or more, its first sample and its microphone; the index from 1 to 1,024', () => {
    const ok = (record: unknown): boolean => decodeWorkerLine(JSON.stringify({ v, type: 'RECORD', sessionId: 'S-1', seq: 1, record })).ok;
    expect(ok(insertedRun)).toBe(true);
    expect(ok({ ...insertedRun, samples: CAPTURE_AUDIO_INSERTED_RUN_MIN_SAMPLES })).toBe(true);
    expect(ok({ ...insertedRun, samples: CAPTURE_AUDIO_INSERTED_RUN_MIN_SAMPLES - 1 })).toBe(false);
    expect(ok({ ...insertedRun, index: CAPTURE_AUDIO_INSERTED_RUNS_MAX })).toBe(true);
    expect(ok({ ...insertedRun, index: CAPTURE_AUDIO_INSERTED_RUNS_MAX + 1 })).toBe(false);
    expect(ok({ ...insertedRun, index: 0 })).toBe(false);
    // A run may begin anywhere in a chunk: its first sample is any whole sample of the timeline.
    expect(ok({ ...insertedRun, fromSample: 451_663 })).toBe(true);
    expect(ok({ ...insertedRun, fromSample: -1 })).toBe(false);
    expect(ok({ ...insertedRun, fromSample: CAPTURE_AUDIO_DAY_SAMPLES + 1 })).toBe(false);
    for (const member of ['deviceId', 'role', 'index', 'fromSample', 'samples', 'sampleRateHz'] as const) {
      const { [member]: _dropped, ...rest } = insertedRun;
      expect(ok(rest), `without ${member}`).toBe(false);
    }
    expect(ok({ ...insertedRun, toSample: 196_800 })).toBe(false);
    expect(ok({ ...insertedRun, deviceId: 'STANDBY' })).toBe(false);
  });

  it('the named settings of a worker process: the ingest-open window, the three microphone thresholds and the fragment size bound, as arguments with ranges', () => {
    const MIB = 1024 * 1024;
    expect(CAPTURE_WORKER_SETTING_DEFAULTS).toEqual({ ingestOpenWindowMs: 15_000, micSilenceDbfs: -50, micSilenceDurationMs: 10_000, micDisconnectDebounceMs: 2_000, maxFragmentBytes: 64 * MIB });
    expect(captureWorkerSettingArguments()).toEqual(['--ingest-open-window-ms', '15000', '--mic-silence-dbfs', '-50', '--mic-silence-ms', '10000', '--mic-disconnect-ms', '2000', '--max-fragment-bytes', String(64 * MIB)]);
    expect(captureWorkerSettingArguments({ ingestOpenWindowMs: 2_000, micSilenceDurationMs: 3_000, maxFragmentBytes: 2 * MIB })).toEqual(['--ingest-open-window-ms', '2000', '--mic-silence-dbfs', '-50', '--mic-silence-ms', '3000', '--mic-disconnect-ms', '2000', '--max-fragment-bytes', String(2 * MIB)]);
    expect(Object.values(CAPTURE_WORKER_SETTINGS).map((rule) => rule.argument)).toEqual(['--ingest-open-window-ms', '--mic-silence-dbfs', '--mic-silence-ms', '--mic-disconnect-ms', '--max-fragment-bytes']);
    // R63-02: ONE number. The bound a launcher may pass is never above the worker's compiled sanity cap, and never so small that an init segment plus a frame cannot fit.
    expect(CAPTURE_WORKER_SETTINGS.maxFragmentBytes).toMatchObject({ default: 64 * MIB, min: MIB, max: 256 * MIB });
    for (const bad of [{ maxFragmentBytes: MIB - 1 }, { maxFragmentBytes: 256 * MIB + 1 }, { maxFragmentBytes: 1.5 * MIB + 0.5 }]) expect(() => captureWorkerSettingArguments(bad), JSON.stringify(bad)).toThrow(RangeError);
    // Refused: outside the range, off the step (the listen timeout of the ingest is whole seconds), not a whole number.
    for (const bad of [{ ingestOpenWindowMs: 999 }, { ingestOpenWindowMs: 1_500 }, { ingestOpenWindowMs: 601_000 }, { micSilenceDbfs: 1 }, { micSilenceDbfs: -50.5 }, { micSilenceDurationMs: 50 }, { micDisconnectDebounceMs: Number.NaN }]) {
      expect(() => captureWorkerSettingArguments(bad), JSON.stringify(bad)).toThrow(RangeError);
    }
  });

  it('R63-05 / Q8: NO FREE TEXT FROM A WORKER - one hostile frame per member that reaches a log, an alert or a file name; each is no message', () => {
    const decode = (value: unknown) => decodeWorkerLine(JSON.stringify(value));
    const refused = { ok: false, violation: FrameViolation.NOT_A_MESSAGE };
    const HOSTILE = 'rtsp://admin:pw@10.0.0.5/live';
    const telemetry = {
      v,
      type: 'TELEMETRY',
      sessionId: 'S-1',
      levels: [{ deviceId: 'MIC-01', role: 'PRIMARY', dbfs: -18.5, clipped: false, ratePpm: 0, ...accountOfALevel }],
      ingest: [{ deviceId: 'CAM-01', state: 'CONNECTED' }],
      fragments: [{ deviceId: 'CAM-01', count: 1, bytes: 5131 }],
      clocks: [{ deviceId: 'CAM-01', lagMs: 21.5, trendPpm: null, nearBound: false }],
      tapActive: false,
    };
    // CONTROL: the frame with the IDs of a plan decodes; the same frame with ONE hostile member does not.
    expect(decode(telemetry)).toMatchObject({ ok: true });
    expect(decode({ ...telemetry, clocks: [{ ...telemetry.clocks[0], deviceId: HOSTILE }] }), 'TELEMETRY.clocks[].deviceId').toEqual(refused);
    expect(decode({ ...telemetry, ingest: [{ ...telemetry.ingest[0], deviceId: HOSTILE }] }), 'TELEMETRY.ingest[].deviceId').toEqual(refused);
    expect(decode({ ...telemetry, fragments: [{ ...telemetry.fragments[0], deviceId: HOSTILE }] }), 'TELEMETRY.fragments[].deviceId').toEqual(refused);
    expect(decode({ ...telemetry, levels: [{ ...telemetry.levels[0], deviceId: 'MIC 01; the operator password is hunter2' }] }), 'TELEMETRY.levels[].deviceId').toEqual(refused);
    expect(decode({ ...telemetry, sessionId: 'S-1 of case 12/2026' }), 'sessionId').toEqual(refused);

    const crash = { v, type: 'CRASH', sessionId: 'S-1', code: 'WRITER_SYNC_FAILED', signal: 'SIGSEGV', exitCode: 70 };
    expect(decode(crash)).toMatchObject({ ok: true });
    expect(decode({ ...crash, signal: null })).toMatchObject({ ok: true });
    for (const signal of ['11', 'sigsegv', 'SIG', 'SIGSEGV (core)', 'killed by op', 'SIGABCDEFGHIJKLM']) expect(decode({ ...crash, signal }), `CRASH.signal ${signal}`).toEqual(refused);

    const record = (body: unknown) => ({ v, type: 'RECORD', sessionId: 'S-1', seq: 1, record: body });
    expect(decode(record(intervalOfASwitch))).toMatchObject({ ok: true });
    expect(decode(record({ ...intervalOfASwitch, correlationId: 'the switch of 10:42 by the operator' })), 'AUDIO_SOURCE_INTERVAL.correlationId').toEqual(refused);
    expect(decode(record({ ...intervalOfASwitch, correlationId: 'cap:S-1:1:3/../x' })), 'AUDIO_SOURCE_INTERVAL.correlationId').toEqual(refused);

    const sealed = { ...checkpointRecord, plaintextSha256: 'd'.repeat(64), plaintextChainSha256: 'e'.repeat(64), gcmIv: '0'.repeat(24), gcmTag: 'f'.repeat(32), keyId: 'KID-S-1' };
    expect(decode(record(sealed))).toMatchObject({ ok: true });
    for (const keyId of ['../../etc/passwd', 'S-1', 'KID-', 'KID-S 1', 'kid-S-1']) expect(decode(record({ ...sealed, keyId })), `FRAGMENT_CHECKPOINT.keyId ${keyId}`).toEqual(refused);
    expect(decode(record({ ...checkpointRecord, deviceId: HOSTILE })), 'FRAGMENT_CHECKPOINT.deviceId').toEqual(refused);

    const hello = { v, type: 'HELLO', protocolVersion: v, workerVersion: 'capture-worker/0.5.0' };
    expect(decode(hello)).toMatchObject({ ok: true });
    // A word the allowlist of the supervisor refuses still DECODES (so that the refusal can name it): only free text does not.
    expect(decode({ ...hello, workerVersion: 'capture-worker/0.5.0+negctl' })).toMatchObject({ ok: true });
    expect(decode({ ...hello, workerVersion: 'capture worker 0.5.0 (built by hand)' }), 'HELLO.workerVersion').toEqual(refused);
    expect(decode({ v, type: 'ACK', correlationId: 'cap:S-1:1:1 and more', ok: true }), 'ACK.correlationId').toEqual(refused);
  });

  it('R63-09: a first durable fragment may state the sync level it really got - one of two words, never another', () => {
    const ok = (record: unknown) => decodeWorkerLine(JSON.stringify({ v, type: 'RECORD', sessionId: 'S-1', seq: 1, record })).ok;
    const first = { kind: 'FIRST_DURABLE_FRAGMENT', deviceId: 'CAM-01', bytes: 5131 };
    expect(Object.values(CaptureSyncLevel)).toEqual(['F_FULLFSYNC', 'FSYNC']);
    expect(ok({ ...first, syncLevel: 'F_FULLFSYNC' })).toBe(true);
    expect(ok({ ...first, syncLevel: 'FSYNC' })).toBe(true);
    // Additive inside version 4: the record of a worker before fix pass F-M3 still decodes, and says nothing about the level.
    expect(ok(first)).toBe(true);
    expect(ok({ ...first, syncLevel: 'fsync' })).toBe(false);
    expect(ok({ ...first, syncLevel: 'probably durable' })).toBe(false);
    expect(ok({ ...first, syncLevel: null })).toBe(false);
  });

  it('the checkpoint of a durable fragment: both chains, media time, keyframe flag and the durable instant are required', () => {
    const ok = (record: unknown): boolean => decodeWorkerLine(JSON.stringify({ v, type: 'RECORD', sessionId: 'S-1', seq: 1, record })).ok;
    expect(ok(checkpointRecord)).toBe(true);
    // The checkpoint of version 2 (no plaintext chain, no media time, no durable instant) is no record any more.
    expect(ok({ kind: 'FRAGMENT_CHECKPOINT', deviceId: 'CAM-01', index: 1, start: 1231, len: 3900, fragSha256: 'a'.repeat(64), chainSha256: 'b'.repeat(64), prefixSha256: 'c'.repeat(64), plaintextSha256: null, gcmIv: null, gcmTag: null, keyId: null })).toBe(false);
    for (const member of ['plaintextSha256', 'plaintextChainSha256', 'mediaStartMs', 'mediaDurationMs', 'keyframe', 'durableAt', 'prefixSha256', 'chainSha256', 'gcmIv'] as const) {
      const { [member]: _dropped, ...rest } = checkpointRecord;
      expect(ok(rest), member).toBe(false);
    }
    expect(ok({ ...checkpointRecord, mediaDurationMs: 0 })).toBe(false);
    expect(ok({ ...checkpointRecord, mediaStartMs: -1 })).toBe(false);
    expect(ok({ ...checkpointRecord, durableAt: 0 })).toBe(false);
    expect(ok({ ...checkpointRecord, keyframe: 1 })).toBe(false);
    // A fragment never starts at byte 0: the init segment is before the first one.
    expect(ok({ ...checkpointRecord, start: 0 })).toBe(false);
    expect(ok({ ...checkpointRecord, outputPath: '/data/x.mp4' })).toBe(false);
    // No cipher: the plaintext IS the stored bytes, so the two chains must be equal ...
    expect(ok({ ...checkpointRecord, plaintextSha256: 'd'.repeat(64) })).toBe(false);
    expect(ok({ ...checkpointRecord, plaintextChainSha256: 'd'.repeat(64) })).toBe(false);
    // ... and with a cipher (row 84) they may differ, and its three members come together.
    const sealed = { ...checkpointRecord, plaintextSha256: 'd'.repeat(64), plaintextChainSha256: 'e'.repeat(64), gcmIv: '1'.repeat(24), gcmTag: '2'.repeat(32), keyId: 'KID-S-1' };
    expect(ok(sealed)).toBe(true);
    expect(ok({ ...sealed, gcmTag: null })).toBe(false);
    expect(ok({ ...sealed, keyId: null })).toBe(false);
    expect(ok({ ...sealed, gcmIv: 'short' })).toBe(false);
    expect(CAPTURE_CHAIN_GENESIS_SHA256).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('the observed keyframe interval: a number, its bound and whether it is above it; nothing else', () => {
    const ok = (record: unknown): boolean => decodeWorkerLine(JSON.stringify({ v, type: 'RECORD', sessionId: 'S-1', seq: 1, record })).ok;
    const interval = { kind: 'KEYFRAME_INTERVAL', deviceId: 'CAM-02', observedMs: 1000, boundMs: 2000, intervals: 3, complete: true, aboveBound: false };
    expect(ok(interval)).toBe(true);
    expect(ok({ ...interval, observedMs: 5000, intervals: 0, complete: false, aboveBound: true })).toBe(true);
    expect(ok({ ...interval, boundMs: 0 })).toBe(false);
    expect(ok({ ...interval, observedMs: -1 })).toBe(false);
    expect(ok({ ...interval, aboveBound: 'yes' })).toBe(false);
    expect(ok({ ...interval, reason: 'free text' })).toBe(false);
    const { deviceId: _dropped, ...noCamera } = interval;
    expect(ok(noCamera)).toBe(false);
  });

  it('M3-REC-1 (frame): a record carries a sequence number from 1 and one of its kinds; anything else is no message', () => {
    const not = (value: unknown) => decodeWorkerLine(JSON.stringify(value)).ok;
    const first = { v, type: 'RECORD', sessionId: 'S-1', seq: 1, record: { kind: 'FIRST_DURABLE_FRAGMENT', deviceId: 'VIDEO-01', bytes: 5131 } };
    expect(not(first)).toBe(true);
    // CONTROLS: each nearest wrong value is refused, so the acceptance above is not a schema that takes anything.
    expect(not({ ...first, seq: 0 })).toBe(false);
    expect(not({ ...first, seq: 1.5 })).toBe(false);
    expect(not({ v, type: 'RECORD', sessionId: 'S-1', record: first.record })).toBe(false);
    expect(not({ v, type: 'RECORD', seq: 1, record: first.record })).toBe(false);
    expect(not({ ...first, record: { ...first.record, bytes: 0 } })).toBe(false);
    expect(not({ ...first, record: { kind: 'FRAGMENT_DROPPED', deviceId: 'VIDEO-01' } })).toBe(false);
    expect(not({ ...first, record: { ...first.record, outputPath: '/data/x.mp4' } })).toBe(false);
    expect(not({ ...first, record: { kind: 'SEAL_COMPLETE', progress: 1 } })).toBe(false);
    const checkpoint = { ...checkpointRecord, deviceId: 'VIDEO-01', start: 1231, len: 10 };
    expect(not({ ...first, record: checkpoint })).toBe(true);
    expect(not({ ...first, record: { ...checkpoint, fragSha256: 'A'.repeat(64) } })).toBe(false);
    expect(not({ ...first, record: { ...checkpoint, index: 0 } })).toBe(false);
    expect(not({ ...first, record: { ...checkpoint, len: 0 } })).toBe(false);
    expect(not({ ...first, record: { kind: 'FIRST_VIDEO_SAMPLE', deviceId: 'VIDEO-01', pts: 0, timescale: 90000, ...nothingSkipped } })).toBe(true);
    expect(not({ ...first, record: { kind: 'FIRST_VIDEO_SAMPLE', deviceId: 'VIDEO-01', pts: -1, timescale: 90000, ...nothingSkipped } })).toBe(false);
    expect(not({ ...first, record: { kind: 'FIRST_VIDEO_SAMPLE', deviceId: 'VIDEO-01', pts: 0, timescale: 0, ...nothingSkipped } })).toBe(false);
  });
});

describe('the plan', () => {
  const withCamera = (ingestUrl: string): unknown => ({ ...plan, cameras: [{ ...plan.cameras[0], ingestUrl }] });

  it('takes a plan of loopback ingests', () => {
    expect(CapturePlanSchema.safeParse(plan).success).toBe(true);
    expect(CapturePlanSchema.safeParse(withCamera(`rtsp://127.0.0.1:${CAPTURE_MEDIA_PORT_MAX}/a/b`)).success).toBe(true);
    expect(CapturePlanSchema.safeParse(withCamera(`rtsp://127.0.0.1:${CAPTURE_MEDIA_PORT_MIN}/a`)).success).toBe(true);
  });

  it('refuses a port outside the loopback media range 8554 to 8564 (spec §A.8), on both sides of it', () => {
    expect([CAPTURE_MEDIA_PORT_MIN, CAPTURE_MEDIA_PORT_MAX]).toEqual([8554, 8564]);
    for (const port of [8553, 8565, 554, 65_535, 9000]) expect(CapturePlanSchema.safeParse(withCamera(`rtsp://127.0.0.1:${port}/video01`)).success, String(port)).toBe(false);
  });

  it.each([
    ['another host', 'rtsp://192.168.1.20:8554/video01'],
    ['every interface', 'rtsp://0.0.0.0:8554/video01'],
    ['a name', 'rtsp://localhost:8554/video01'],
    ['credentials', 'rtsp://user:pass@127.0.0.1:8554/video01'],
    ['a trailing slash (S1 SP-1)', 'rtsp://127.0.0.1:8554/video01/'],
    ['no path', 'rtsp://127.0.0.1:8554'],
    ['no port', 'rtsp://127.0.0.1/video01'],
    ['a port out of range', 'rtsp://127.0.0.1:65536/video01'],
    ['another scheme', 'http://127.0.0.1:8554/video01'],
  ])('refuses an ingest address with %s', (_label, url) => {
    expect(LOOPBACK_RTSP_URL.test(url) && Number(LOOPBACK_RTSP_URL.exec(url)?.[1]) <= 65_535).toBe(false);
    expect(CapturePlanSchema.safeParse(withCamera(url)).success).toBe(false);
  });

  it('refuses two cameras on one address or one file, a role held twice, an active role nobody holds, a relative output path and an unknown member', () => {
    const second = plan.cameras[1]!;
    const bad: unknown[] = [
      { ...plan, cameras: [plan.cameras[0], { ...second, ingestUrl: plan.cameras[0]!.ingestUrl }] },
      { ...plan, cameras: [plan.cameras[0], { ...second, outputPath: plan.cameras[0]!.outputPath }] },
      { ...plan, cameras: [plan.cameras[0], { ...second, deviceId: 'CAM-01' }] },
      { ...plan, cameras: [plan.cameras[0], { ...second, trackId: 'VIDEO-01' }] },
      { ...plan, cameras: [{ deviceId: 'CAM-01', profile: null, ingestUrl: plan.cameras[0]!.ingestUrl, outputPath: plan.cameras[0]!.outputPath }] },
      { ...plan, mics: [plan.mics[0], { ...plan.mics[1], role: 'PRIMARY' }] },
      { ...plan, mics: [plan.mics[0], { ...plan.mics[1], input: plan.mics[0]!.input }] },
      { ...plan, mics: [{ deviceId: 'MIC-01', role: 'PRIMARY' }] },
      { ...plan, mics: [{ ...plan.mics[0], input: { kind: 'PCM_FIFO', path: 'relative.pcm' } }] },
      { ...plan, mics: [{ ...plan.mics[0], input: { kind: 'AVFOUNDATION', path: '/dev/x' } }] },
      { ...plan, pcmTapPath: plan.cameras[0]!.outputPath },
      { ...plan, pcmTapPath: 'tap.pcm' },
      { ...plan, pcmTapPath: undefined },
      { ...plan, mics: [plan.mics[0]], activeMic: 'STANDBY' },
      { ...plan, cameras: [{ ...plan.cameras[0], outputPath: 'media/VIDEO-01.mp4' }] },
      { ...plan, cameras: [] },
      { ...plan, password: 'x' },
      // Version 4 (D84 R-2): a role is no identity, and one ID names one device of the plan.
      { ...plan, mics: [{ ...plan.mics[0], deviceId: 'PRIMARY' }, plan.mics[1]] },
      { ...plan, mics: [plan.mics[0], { ...plan.mics[1], deviceId: 'STANDBY' }] },
      { ...plan, mics: [{ ...plan.mics[0], deviceId: 'CAM-01' }, plan.mics[1]] },
    ];
    expect(bad.map((value) => CapturePlanSchema.safeParse(value).success)).toEqual(bad.map(() => false));
  });
});

describe('the line splitter', () => {
  it('gives whole lines whatever the pieces are, and nothing for an unfinished one', () => {
    const splitter = createLineSplitter(64);
    expect(splitter.push('{"a":')).toEqual([]);
    expect(splitter.push('1}\n{"b":2}\r\n\n{"c"')).toEqual(['{"a":1}', '{"b":2}']);
    expect(splitter.push(':3}\n')).toEqual(['{"c":3}']);
  });

  it('never holds more than the limit of an unfinished line: a line that is too long is reported once and dropped to its end', () => {
    const splitter = createLineSplitter(16);
    expect(splitter.push('x'.repeat(10))).toEqual([]);
    expect(splitter.push('x'.repeat(10))).toEqual([null]);
    expect(splitter.push('x'.repeat(1_000))).toEqual([]);
    expect(splitter.push('tail\n{"ok":1}\n')).toEqual(['{"ok":1}']);
    // Too long, in one piece with its line end.
    expect(splitter.push(`${'y'.repeat(17)}\n{"ok":2}\n`)).toEqual([null, '{"ok":2}']);
    // Control: exactly the limit is a line.
    expect(splitter.push(`${'z'.repeat(16)}\n`)).toEqual(['z'.repeat(16)]);
  });
});

describe('the back-off', () => {
  it('is base times factor to the power of the restart, capped', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 60].map((restart) => backoffDelayMs(restart))).toEqual([250, 500, 1_000, 2_000, 4_000, 8_000, 8_000, 8_000]);
    expect(backoffDelayMs(3, { backoffBaseMs: 10, backoffFactor: 3, backoffMaxMs: 1_000 })).toBe(270);
    expect(backoffDelayMs(5_000)).toBe(CAPTURE_IPC_DEFAULTS.backoffMaxMs);
    expect(() => backoffDelayMs(-1)).toThrow(RangeError);
    expect(() => backoffDelayMs(1.5)).toThrow(RangeError);
  });

  it('the heartbeat timeout leaves room for several missed heartbeats', () => {
    expect(CAPTURE_IPC_DEFAULTS.heartbeatTimeoutMs).toBeGreaterThanOrEqual(4 * CAPTURE_IPC_DEFAULTS.heartbeatIntervalMs);
  });
});
