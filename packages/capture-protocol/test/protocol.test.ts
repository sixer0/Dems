// The frames, the plan and the back-off of the capture protocol (blueprint row 57 / M3-W1; capture
// spec §B.2). Each acceptance stands beside the refusal of the nearest wrong value.
//
// Blueprint row 58 (M3-W2) adds: protocol version 2, the lossless RECORD class (check M3-REC-1,
// frame half; the supervisor half is `apps/core-server/src/capture/__tests__/records.test.ts`),
// the mic inputs and the PCM tap of the plan, and the loopback media port range.
import { describe, expect, it } from 'vitest';
import {
  CAPTURE_IPC_DEFAULTS,
  CAPTURE_MEDIA_PORT_MAX,
  CAPTURE_MEDIA_PORT_MIN,
  CAPTURE_PROTOCOL_VERSION,
  CapturePlanSchema,
  CaptureRecordKind,
  DURABLE_RECORD_KINDS,
  FrameViolation,
  LOOPBACK_RTSP_URL,
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

describe('the messages', () => {
  it('the protocol has the three commands and the eight worker messages of spec §B.2 (the eight of its table, HELLO, ACK and, since version 2, RECORD)', () => {
    expect(CAPTURE_PROTOCOL_VERSION).toBe(2);
    expect(Object.values(SupervisorMessageType)).toEqual(['START', 'STOP', 'SWITCH_AUDIO_SOURCE']);
    expect(Object.values(WorkerMessageType)).toEqual(['HELLO', 'ACK', 'TELEMETRY', 'PROGRESS', 'HEARTBEAT', 'WARNING', 'CRASH', 'RECORD']);
    expect(Object.values(CaptureRecordKind)).toEqual(['FIRST_VIDEO_SAMPLE', 'FIRST_DURABLE_FRAGMENT', 'FRAGMENT_CHECKPOINT', 'SEAL_COMPLETE']);
    expect(DURABLE_RECORD_KINDS).toEqual(['FIRST_DURABLE_FRAGMENT', 'FRAGMENT_CHECKPOINT']);
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
      { v, type: 'TELEMETRY', sessionId: 'S-1', levels: [{ role: 'PRIMARY', dbfs: -18.5, clipped: false }], ingest: [{ deviceId: 'VIDEO-01', state: 'CONNECTED' }], fragments: [{ deviceId: 'VIDEO-01', count: 3, bytes: 4096 }], clocks: [{ deviceId: 'VIDEO-01', lagMs: 4.8, trendPpm: null, nearBound: false }], tapActive: false },
      { v, type: 'PROGRESS', sessionId: 'S-1', step: 'HASH', progress: 0.25, etaMs: 1200 },
      { v, type: 'WARNING', sessionId: 'S-1', code: 'MIC_SILENT', state: 'ACTIVE', subject: 'PRIMARY' },
      { v, type: 'WARNING', sessionId: 'S-1', code: 'CAPTURE_FAULT', state: 'CLEARED', subject: 'CAM-02' },
      { v, type: 'CRASH', sessionId: null, code: 'ENCODER_INIT', signal: null, exitCode: 3 },
      { v, type: 'RECORD', sessionId: 'S-1', seq: 1, record: { kind: 'FIRST_DURABLE_FRAGMENT', deviceId: 'VIDEO-01', bytes: 5131 } },
      {
        v,
        type: 'RECORD',
        sessionId: 'S-1',
        seq: 2,
        record: { kind: 'FRAGMENT_CHECKPOINT', deviceId: 'VIDEO-01', index: 1, start: 1231, len: 3900, fragSha256: 'a'.repeat(64), chainSha256: 'b'.repeat(64), prefixSha256: 'c'.repeat(64), plaintextSha256: null, gcmIv: null, gcmTag: null, keyId: null },
      },
      { v, type: 'RECORD', sessionId: 'S-1', seq: 3, record: { kind: 'SEAL_COMPLETE' } },
      { v, type: 'RECORD', sessionId: 'S-1', seq: 4, record: { kind: 'FIRST_VIDEO_SAMPLE', deviceId: 'VIDEO-01', pts: 526386, timescale: 90000 } },
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
    expect(not({ v, type: 'WARNING', sessionId: 'S-1', code: 'AUTO_SWITCHED', state: 'ACTIVE', subject: null })).toEqual(refused);
    expect(not({ v, type: 'WARNING', sessionId: 'S-1', code: 'MIC_SILENT', subject: null })).toEqual(refused);
    expect(not({ v, type: 'WARNING', sessionId: 'S-1', code: 'MIC_SILENT', state: 'GONE', subject: null })).toEqual(refused);
    expect(not({ v, type: 'WARNING', sessionId: 'S-1', code: 'MIC_SILENT', state: 'CLEARED', subject: null })).toMatchObject({ ok: true });
    expect(not({ v, type: 'STOP', sessionId: 'S-1', correlationId: 'c', reason: 'STOPPED' })).toEqual(refused);
    expect(decodeWorkerLine('{"v":2,')).toEqual({ ok: false, violation: FrameViolation.NOT_JSON });
    expect(decodeWorkerLine(JSON.stringify({ v, type: 'HEARTBEAT', counter: 1 }), 10)).toEqual({ ok: false, violation: FrameViolation.TOO_LONG });
  });

  it('M3-REC-1 (frame): a record carries a sequence number from 1 and one of three kinds; anything else is no message', () => {
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
    const checkpoint = { kind: 'FRAGMENT_CHECKPOINT', deviceId: 'VIDEO-01', index: 1, start: 0, len: 10, fragSha256: 'a'.repeat(64), chainSha256: 'b'.repeat(64), prefixSha256: 'c'.repeat(64), plaintextSha256: null, gcmIv: null, gcmTag: null, keyId: null };
    expect(not({ ...first, record: checkpoint })).toBe(true);
    expect(not({ ...first, record: { ...checkpoint, fragSha256: 'A'.repeat(64) } })).toBe(false);
    expect(not({ ...first, record: { ...checkpoint, index: 0 } })).toBe(false);
    expect(not({ ...first, record: { ...checkpoint, len: 0 } })).toBe(false);
    expect(not({ ...first, record: { kind: 'FIRST_VIDEO_SAMPLE', deviceId: 'VIDEO-01', pts: 0, timescale: 90000 } })).toBe(true);
    expect(not({ ...first, record: { kind: 'FIRST_VIDEO_SAMPLE', deviceId: 'VIDEO-01', pts: -1, timescale: 90000 } })).toBe(false);
    expect(not({ ...first, record: { kind: 'FIRST_VIDEO_SAMPLE', deviceId: 'VIDEO-01', pts: 0, timescale: 0 } })).toBe(false);
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
