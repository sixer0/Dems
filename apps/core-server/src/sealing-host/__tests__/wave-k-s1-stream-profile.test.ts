// FIX WAVE K, driver S1 - re-gate 89 finding G89b-01 (raised to MAJOR, ruling D222 (2)).
//
// The signed manifest said `tracks[].profile: H264_1080P25` for files whose own init segment says
// 1280 x 720 and whose fragments hold 30 pictures per second: field 36 was the selector's configured
// profile. Now field 36 states what the STREAM is, read from the camera file:
//   the picture size   the video sample entry of the init segment (`videoStreamFormatOf`);
//   the frame rate     measured over the first whole fragments (video samples / the time they span);
// and a configured profile that differs is TOLD (one WARNING notice per session), never written.
//
// The camera files here are built box by box (an init segment with a real `stsd` / `avc1` entry and
// `trun` runs): no media, no device. The first case is the control: without the file's own facts the
// reader still writes the configured profile - the finding.
import { createSim } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { VIDEO_FRAME_RATE_FRAGMENTS, videoSampleEntryOf, videoStreamFormatOf, type ByteSource } from '../../capture';
import { GENERATED_CAMERA_PROFILE } from '../../capture/fence/generated-sources';
import { STREAM_PROFILE_DIFFERS_REASON, noteStreamProfileDiffersTransition, streamProfileDiffersSentence } from '../../engine/sealing-notice-doors';
import { READ_SEAL_AUDIO_INTERVALS, READ_SEAL_AUDIT_ROWS, READ_SEAL_SOURCE_ROWS, createSealSessionReader, streamProfileOf, type SealProfileDifference, type SealStateView, type SealVideoFormat } from '../session-reader';

// ── A camera file, box by box ────────────────────────────────────────────────────────────────────
const u16 = (value: number): Buffer => {
  const out = Buffer.alloc(2);
  out.writeUInt16BE(value);
  return out;
};
const u32 = (value: number): Buffer => {
  const out = Buffer.alloc(4);
  out.writeUInt32BE(value);
  return out;
};
const zeros = (length: number): Buffer => Buffer.alloc(length);
const box = (type: string, ...payload: Uint8Array[]): Buffer => {
  const body = Buffer.concat(payload);
  return Buffer.concat([u32(8 + body.length), Buffer.from(type, 'ascii'), body]);
};
/** A `VisualSampleEntry`: 6 reserved + data reference index, 16 bytes pre-defined, then width and height. */
const sampleEntry = (type: string, width: number, height: number): Buffer => box(type, zeros(6), u16(1), zeros(16), u16(width), u16(height), zeros(50));
const TIMESCALE = 90_000;
function initSegment(width: number, height: number, entry = 'avc1'): Buffer {
  const stsd = box('stsd', u32(0), u32(1), sampleEntry(entry, width, height));
  const trak = box('trak', box('tkhd', u32(0), u32(0), u32(0), u32(1), zeros(68)), box('mdia', box('mdhd', u32(0), u32(0), u32(0), u32(TIMESCALE), u32(0), u32(0)), box('hdlr', u32(0), u32(0), Buffer.from('vide', 'ascii'), zeros(13)), box('minf', box('stbl', stsd))));
  return Buffer.concat([box('ftyp', Buffer.from('isom', 'ascii'), u32(512)), box('moov', box('mvhd', zeros(100)), trak, box('mvex', box('trex', u32(0), u32(1), u32(1), u32(0), u32(0), u32(0x0101_0000))))]);
}
/** One fragment of `frames` video samples of `ticks` each (duration per sample in the `trun`), starting at `base`. */
function fragment(seq: number, base: number, frames: number, ticks: number): Buffer {
  const trun = box('trun', u32(0x00_0105), u32(frames), u32(0), u32(0x0200_0000), ...Array.from({ length: frames }, () => u32(ticks)));
  return Buffer.concat([box('moof', box('mfhd', u32(0), u32(seq)), box('traf', box('tfhd', u32(0x02_0000), u32(1)), box('tfdt', u32(0), u32(base)), trun)), box('mdat', zeros(64))]);
}
function cameraFile(width: number, height: number, framesPerSecond: number, seconds: number): Buffer {
  const ticks = Math.round(TIMESCALE / framesPerSecond);
  return Buffer.concat([initSegment(width, height), ...Array.from({ length: seconds }, (_unused, index) => fragment(index + 1, index * framesPerSecond * ticks, framesPerSecond, ticks))]);
}
const sourceOf = (bytes: Uint8Array): ByteSource => ({ size: bytes.length, read: async (offset, length) => bytes.subarray(offset, offset + length) });

describe('G89b-01: what the stream of a camera file is, read from the file', () => {
  it('the fixture is a camera file the capture unit reads: its sample entry is H264 (the codec read of pass D9 is unchanged)', async () => {
    expect(await videoSampleEntryOf(sourceOf(cameraFile(1280, 720, 30, 2)))).toEqual({ state: 'KNOWN', codec: 'H264', sampleEntry: 'avc1' });
  });

  it('1280 x 720 at 30 per second - the file of the gate - and 1920 x 1080 at 25: size from the init segment, rate measured over the fragments', async () => {
    expect(await videoStreamFormatOf(sourceOf(cameraFile(1280, 720, 30, 4)))).toEqual({ width: 1280, height: 720, frameRate: 30 });
    expect(await videoStreamFormatOf(sourceOf(cameraFile(1920, 1080, 25, 4)))).toEqual({ width: 1920, height: 1080, frameRate: 25 });
  });

  it('a rate that is not a whole number is the measured one (2 decimals); the measure reads a bounded number of fragments', async () => {
    // 3003 ticks per picture at 90 kHz: 29.97 per second.
    const ntsc = Buffer.concat([initSegment(1280, 720), fragment(1, 0, 30, 3003), fragment(2, 30 * 3003, 30, 3003)]);
    expect(await videoStreamFormatOf(sourceOf(ntsc))).toEqual({ width: 1280, height: 720, frameRate: 29.97 });
    // The fragments after the bound are not read: 8 fragments at 30, then 100 at 10 - still 30.
    const ticks = 3_000;
    const head = Array.from({ length: VIDEO_FRAME_RATE_FRAGMENTS }, (_unused, index) => fragment(index + 1, index * 30 * ticks, 30, ticks));
    const tail = Array.from({ length: 20 }, (_unused, index) => fragment(100 + index, 10_000_000 + index * 90_000, 10, 9_000));
    expect(await videoStreamFormatOf(sourceOf(Buffer.concat([initSegment(1280, 720), ...head, ...tail])))).toEqual({ width: 1280, height: 720, frameRate: 30 });
  });

  it('a file whose fragments cannot be read in the clear (a SEALED camera file) states its size and NO rate; no init segment: null', async () => {
    const sealedLike = Buffer.concat([initSegment(1280, 720), box('moof', Buffer.from(Uint8Array.from({ length: 300 }, (_unused, index) => (index * 37 + 11) & 255))), box('mdat', zeros(64))]);
    expect(await videoStreamFormatOf(sourceOf(sealedLike))).toEqual({ width: 1280, height: 720, frameRate: null });
    expect(await videoStreamFormatOf(sourceOf(initSegment(1280, 720)))).toEqual({ width: 1280, height: 720, frameRate: null });
    expect(await videoStreamFormatOf(sourceOf(fragment(1, 0, 30, 3_000)))).toBeNull();
    expect(await videoStreamFormatOf(sourceOf(new Uint8Array(0)))).toBeNull();
  });
});

describe('G89b-01: field 36 in the vocabulary of the profiles', () => {
  const of = (width: number, height: number, frameRate: number | null): SealVideoFormat => ({ width, height, frameRate });
  it('16:9 pictures by their height; another picture states its width; a rate within 1 % of a whole number is that nominal rate; no measured rate, no rate', () => {
    expect(streamProfileOf('H264', of(1280, 720, 30))).toBe('H264_720P30');
    expect(streamProfileOf('H264', of(1920, 1080, 25))).toBe('H264_1080P25');
    expect(streamProfileOf('HEVC', of(3840, 2160, 25))).toBe('HEVC_2160P25');
    expect(streamProfileOf('H264', of(1280, 720, 29.97))).toBe('H264_720P30');
    expect(streamProfileOf('H264', of(1280, 720, 30.12))).toBe('H264_720P30');
    expect(streamProfileOf('H264', of(1280, 720, 27.4))).toBe('H264_720P27.4');
    expect(streamProfileOf('H264', of(1280, 960, 30))).toBe('H264_1280X960P30');
    expect(streamProfileOf('H264', of(1280, 720, null))).toBe('H264_720P');
  });
});

// ── The reader ────────────────────────────────────────────────────────────────────────────────────
const SESSION = 'SES-20261011-8901';
const seeded = createSim({ storage: null, authStorage: null, scheduler: () => () => undefined }).store.getState();
const view = {
  ...seeded,
  session: {
    id: SESSION,
    state: 'FINALIZING',
    evidenceId: 'EV-20261011-0089',
    createdAt: 1_000,
    startedAt: 2_000,
    stoppedAt: 9_000,
    input: { caseNumber: 'LP/2026/1011-0089', subjectName: 'Test Subject', subjectType: 'SAKSI', investigatorId: seeded.operators[0]!.id },
    startTimeSource: seeded.time.source,
    // The selector of lane 2: both lines say 1080p25.
    captureConfig: { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_1080P25' }, { trackId: 'VIDEO-02', deviceId: 'CAM-02', profile: 'H264_1080P25' }] },
  },
} as unknown as SealStateView;

/** The same session under a selector whose two camera lines say `profile` (reconcile pass of wave K). */
const viewWith = (profile: string): SealStateView =>
  ({ ...view, session: { ...view.session, captureConfig: { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile }, { trackId: 'VIDEO-02', deviceId: 'CAM-02', profile }] } } }) as unknown as SealStateView;

async function read(files: Partial<Record<'VIDEO-01' | 'VIDEO-02', Uint8Array>> | null, state: SealStateView = view) {
  const rows: Record<string, unknown[]> = {
    [READ_SEAL_SOURCE_ROWS]: [
      { slot: 'MIC-PRIMARY', device_id: 'MIC-01', adapter_kind: 'FAKE' },
      { slot: 'MIC-STANDBY', device_id: 'MIC-02', adapter_kind: 'FAKE' },
      { slot: 'VIDEO-01', device_id: 'CAM-01', adapter_kind: 'FAKE' },
      { slot: 'VIDEO-02', device_id: 'CAM-02', adapter_kind: 'FAKE' },
    ],
    [READ_SEAL_AUDIO_INTERVALS]: [{ seq: 1, mic_device_id: 'MIC-01', role: 'PRIMARY', from_media_ms: '21', to_media_ms: null, reason: 'START', switched_by: null }],
    [READ_SEAL_AUDIT_ROWS]: [],
  };
  const told: { sessionId: string; differences: readonly SealProfileDifference[] }[] = [];
  const reader = createSealSessionReader({
    state: () => state,
    db: () => ({ query: async (text: string) => ({ rows: (rows[text] ?? []) as never[] }) }),
    begin: async () => undefined,
    sttSnapshot: async () => null,
    notice: 'NOTICE',
    timezone: '+07:00',
    ...(files === null
      ? {}
      : {
          videoSampleEntry: async (_sessionId, trackId) => (files[trackId] === undefined ? null : videoSampleEntryOf(sourceOf(files[trackId]))),
          videoFormat: async (_sessionId, trackId) => (files[trackId] === undefined ? null : videoStreamFormatOf(sourceOf(files[trackId]))),
        }),
    onProfileDiffers: (sessionId, differences) => void told.push({ sessionId, differences }),
  });
  const facts = await reader.read(SESSION);
  if (facts === null) throw new Error('the session was not read');
  return { profiles: facts.tracks.map((track) => track.profile), told };
}

describe('G89b-01: the session reader states the stream in field 36', () => {
  it('CONTROL (the finding): a reader that is not handed the files writes the configured profile for a 720p30 recording', async () => {
    expect(await read(null)).toEqual({ profiles: ['H264_1080P25', 'H264_1080P25'], told: [] });
  });

  it('the files of the gate (1280 x 720 at 30) under a selector that says 1080p25: field 36 is H264_720P30 for both, and the difference is told ONCE with both files', async () => {
    const file = cameraFile(1280, 720, 30, 3);
    const result = await read({ 'VIDEO-01': file, 'VIDEO-02': file });
    expect(result.profiles).toEqual(['H264_720P30', 'H264_720P30']);
    expect(result.told).toEqual([
      {
        sessionId: SESSION,
        differences: [
          { trackId: 'VIDEO-01', configured: 'H264_1080P25', stream: 'H264_720P30' },
          { trackId: 'VIDEO-02', configured: 'H264_1080P25', stream: 'H264_720P30' },
        ],
      },
    ]);
  });

  it('a stream that IS the configured profile: the same text, nothing told; a camera that has no file keeps its configured line and is not told either', async () => {
    const agreeing = await read({ 'VIDEO-01': cameraFile(1920, 1080, 25, 3), 'VIDEO-02': cameraFile(1920, 1080, 25, 3) });
    expect(agreeing).toEqual({ profiles: ['H264_1080P25', 'H264_1080P25'], told: [] });
    const one = await read({ 'VIDEO-01': cameraFile(1280, 720, 30, 3) });
    expect(one.profiles).toEqual(['H264_720P30', 'H264_1080P25']);
    expect(one.told).toHaveLength(1);
    expect(one.told[0]?.differences).toEqual([{ trackId: 'VIDEO-01', configured: 'H264_1080P25', stream: 'H264_720P30' }]);
  });
});

// Reconcile pass of wave K (G89b-01, second half; ruling of 2026-10-11): the selector line of a
// generated test source states its ADAPTER'S profile (`capture/fence/fake-profile.ts`), so a session
// recorded from those sources seals the configured profile and tells nothing.
describe('G89b-01 (second half): a session on generated sources whose selector states the adapter\'s profile', () => {
  const generated = cameraFile(1280, 720, 30, 3);
  it('the manifest lines equal the configured profile and NO difference is told', async () => {
    expect(GENERATED_CAMERA_PROFILE).toBe('H264_720P30');
    const result = await read({ 'VIDEO-01': generated, 'VIDEO-02': generated }, viewWith(GENERATED_CAMERA_PROFILE));
    expect(result).toEqual({ profiles: [GENERATED_CAMERA_PROFILE, GENERATED_CAMERA_PROFILE], told: [] });
  });

  it('CONTROL: a deliberately mismatched selector over the same files still states the stream and tells the difference', async () => {
    const result = await read({ 'VIDEO-01': generated, 'VIDEO-02': generated }, viewWith('H264_1080P30'));
    expect(result.profiles).toEqual(['H264_720P30', 'H264_720P30']);
    expect(result.told).toEqual([{ sessionId: SESSION, differences: [{ trackId: 'VIDEO-01', configured: 'H264_1080P30', stream: 'H264_720P30' }, { trackId: 'VIDEO-02', configured: 'H264_1080P30', stream: 'H264_720P30' }] }]);
  });
});

describe('G89b-01: the WARNING notice of the session', () => {
  const tracks = [{ trackId: 'VIDEO-01', configured: 'H264_1080P25', stream: 'H264_720P30' }];
  it('ONE alert of severity WARNING naming the session, the file, the configured profile and the stream; written resolved; once per session', () => {
    const noted = noteStreamProfileDiffersTransition(seeded, 5_000, { sessionId: SESSION, tracks });
    const alert = noted.alerts.at(-1);
    expect(noted.alerts).toHaveLength(seeded.alerts.length + 1);
    expect(alert).toMatchObject({ severity: 'WARNING', kind: 'SYSTEM', active: false, resolvedAt: 5_000, target: SESSION, params: { reason: STREAM_PROFILE_DIFFERS_REASON, sessionId: SESSION, tracks: 'VIDEO-01:H264_720P30:H264_1080P25' } });
    expect(alert?.message).toBe(streamProfileDiffersSentence(tracks));
    expect(alert?.message).toBe('The recorded video is not the configured profile: VIDEO-01 is H264_720P30 (configured H264_1080P25). The evidence manifest states the recorded stream.');
    expect(noteStreamProfileDiffersTransition(noted, 6_000, { sessionId: SESSION, tracks })).toBe(noted);
    // No audit row: nothing was raised and nothing is cleared.
    expect(noted.audit).toBe(seeded.audit);
    // No fault, no critical condition.
    expect(noted.faults).toBe(seeded.faults);
  });

  it('refuses free text: a profile that is no code, a track that is no camera file, no session', () => {
    expect(() => noteStreamProfileDiffersTransition(seeded, 5_000, { sessionId: SESSION, tracks: [{ trackId: 'VIDEO-01', configured: 'x y', stream: 'H264_720P30' }] })).toThrow();
    expect(() => noteStreamProfileDiffersTransition(seeded, 5_000, { sessionId: SESSION, tracks: [{ trackId: 'AUDIO-01', configured: 'A', stream: 'B' }] })).toThrow();
    expect(() => noteStreamProfileDiffersTransition(seeded, 5_000, { sessionId: 'x', tracks })).toThrow();
  });
});
