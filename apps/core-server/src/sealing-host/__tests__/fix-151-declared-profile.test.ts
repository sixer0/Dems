// FIX 151 - manifest field 36 `tracks[].profile` is a FORMAT statement: what the stream DECLARES.
//
// The finding (gate environment note 08, smoke (a)): the first session sealed on lane 2 after wave K
// corrected the selector - two generated 1280 x 720 streams at 30 per second under a selector that
// says `H264_720P30` - was sealed with `VIDEO-01: H264_720P27.67`, `VIDEO-02: H264_720P26` and the
// notice `STREAM_PROFILE_DIFFERS`. Wave K MEASURED the rate: video samples / the time they span over
// the first 8 fragments. The first video sample of a camera file is held from file time 0 to the
// first keyframe the worker could place, and the muxer writes that hold into the sample's own
// duration: 1.572 s and 3.121 s in that session. 571 pictures over 20.6 s are 27.7 per second.
//
// The rule (controller ruling of 2026-10-11): the field states what the stream declares about
// itself - the picture size of the init segment's sample entry and the nominal frame rate of its
// own parameter set - in the profile vocabulary; never a measured average, never a fraction. The
// notice is due only when the DECLARED format is not the configured profile.
//
// The init segments are REAL (`fix-151-init-segments.ts`: the clear head of camera files the
// product sealed); the fragments after them are built box by box in the shape the worker's muxer
// writes (a `trun` with one duration per sample, the first one carrying the hold). No media.
import { createHash } from 'node:crypto';
import { createSim } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { videoSampleEntryOf, videoStreamFormatOf, walkCameraFile, type ByteSource } from '../../capture';
import { READ_SEAL_AUDIO_INTERVALS, READ_SEAL_AUDIT_ROWS, READ_SEAL_SOURCE_ROWS, createSealSessionReader, streamProfileDiffers, streamProfileOf, type SealProfileDifference, type SealStateView } from '../session-reader';
import { INTERRUPTED, REAL_INIT_SEGMENT, SEALED_AS_MEASURED, SEED_INIT_SEGMENT, avcCBox, spsNal, type RealTrackTable, type SpsInput } from './fix-151-init-segments';

// ── Boxes ────────────────────────────────────────────────────────────────────────────────────────
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
const TIMESCALE = 90_000;
const sourceOf = (bytes: Uint8Array): ByteSource => ({ size: bytes.length, read: async (offset, length) => bytes.subarray(offset, offset + length) });

/** A made-up init segment: one video track whose sample entry holds `inner` after its 78 fixed bytes. */
function initSegment(width: number, height: number, inner: Uint8Array | null, entry = 'avc1'): Buffer {
  const sampleEntry = box(entry, zeros(6), u16(1), zeros(16), u16(width), u16(height), zeros(50), ...(inner === null ? [] : [inner]));
  const stsd = box('stsd', u32(0), u32(1), sampleEntry);
  const trak = box('trak', box('tkhd', u32(0), u32(0), u32(0), u32(1), zeros(68)), box('mdia', box('mdhd', u32(0), u32(0), u32(0), u32(TIMESCALE), u32(0), u32(0)), box('hdlr', u32(0), u32(0), Buffer.from('vide', 'ascii'), zeros(13)), box('minf', box('stbl', stsd))));
  return Buffer.concat([box('ftyp', Buffer.from('isom', 'ascii'), u32(512)), box('moov', box('mvhd', zeros(100)), trak, box('mvex', box('trex', u32(0), u32(1), u32(1), u32(0), u32(0), u32(0x0101_0000))))]);
}
const declaring = (input: SpsInput, entry = 'avc1'): Buffer => initSegment(input.width, input.height, avcCBox(spsNal(input)), entry);

/** One fragment: a video `traf` (track 1) whose `trun` lists one duration per sample, starting at `base`. */
function fragment(seq: number, base: number, durations: readonly number[]): Buffer {
  const trun = box('trun', u32(0x00_0105), u32(durations.length), u32(0), u32(0x0200_0000), ...durations.map((ticks) => u32(ticks)));
  return Buffer.concat([box('moof', box('mfhd', u32(0), u32(seq)), box('traf', box('tfhd', u32(0x02_0000), u32(1)), box('tfdt', u32(0), u32(base)), trun)), box('mdat', zeros(64))]);
}

/** The `trun` durations of a recording, fragment by fragment. */
type Plan = readonly (readonly number[])[];

/** `fragments` fragments of `perFragment` samples lasting `ticksPerSample` each. */
const steady = (ticksPerSample: number, fragments: number, perFragment: number): Plan => Array.from({ length: fragments }, () => Array.from({ length: perFragment }, () => ticksPerSample));

/**
 * A recording as the worker writes it for a track of a signed table: 30 pictures per second
 * (3,000 ticks each), cut into fragments of the table's spans, and the first sample HELD from file
 * time 0 - its duration is the hold (the track's first video sample time) plus its own period.
 */
function asRecorded(track: RealTrackTable): Plan {
  const hold = track.firstVideoSamplePts;
  return track.rows.map(([, , durationMs], index) => {
    const frames = Math.max(1, Math.round(((durationMs * TIMESCALE) / 1000 - (index === 0 ? hold : 0)) / 3_000));
    return Array.from({ length: frames }, (_unused, sample) => 3_000 + (index === 0 && sample === 0 ? hold : 0));
  });
}

function fileOf(init: Uint8Array, plan: Plan): Buffer {
  const parts: Buffer[] = [];
  let base = 0;
  plan.forEach((durations, index) => {
    parts.push(fragment(index + 1, base, durations));
    base += durations.reduce((sum, ticks) => sum + ticks, 0);
  });
  return Buffer.concat([init, ...parts]);
}

/** What fix wave K measured: the video samples of the first 8 fragments / the time their `trun` durations span, 2 decimals. */
function measuredAsWaveK(plan: Plan): number {
  const head = plan.slice(0, 8);
  const samples = head.reduce((sum, durations) => sum + durations.length, 0);
  const ticks = head.reduce((sum, durations) => sum + durations.reduce((inner, value) => inner + value, 0), 0);
  return Math.round(((samples * TIMESCALE) / ticks) * 100) / 100;
}

const [FIRST, SECOND] = SEALED_AS_MEASURED as readonly [RealTrackTable, RealTrackTable];
/** The two camera files of the session of the finding, as recorded (before the seal). */
const FINDING = { 'VIDEO-01': fileOf(REAL_INIT_SEGMENT, asRecorded(FIRST)), 'VIDEO-02': fileOf(REAL_INIT_SEGMENT, asRecorded(SECOND)) } as const;
/** A 720p30 stream DELIVERED at 27 per second: 27 pictures per fragment, 3,333 ticks apart. */
const SLOW = steady(3_333, 12, 27);

// ── The cause, on the item's own signed numbers ──────────────────────────────────────────────────
describe('fix 151 - the cause: the wave K measure divided by a span that holds the first sample', () => {
  it('30 pictures per second after the hold, over the span of the first 8 fragments of the signed table, IS the sealed fraction of both tracks', () => {
    for (const track of SEALED_AS_MEASURED) {
      const last = track.rows[7]!;
      const spanS = (last[1] + last[2]) / 1000;
      const holdS = track.firstVideoSamplePts / track.firstVideoSampleTimescale;
      const predicted = ((spanS - holdS) * 30) / spanS;
      const sealed = Number(/P([0-9.]+)$/.exec(track.sealedProfile)![1]);
      // VIDEO-01: hold 1.572 s, span 20.599 s -> 27.71 (sealed 27.67). VIDEO-02: hold 3.121 s, span 22.136 s -> 25.77 (sealed 26:
      // within 1 % of a whole number the wave K text wrote that number). The fragment spans are whole ms and include the audio run.
      expect(Math.abs(predicted - sealed)).toBeLessThan(0.3);
      expect(sealed).toBeLessThan(28);
    }
    expect(SEALED_AS_MEASURED.map((track) => track.sealedProfile)).toEqual(['H264_720P27.67', 'H264_720P26']);
  });

  it('CONTROL - the old arithmetic on files built from the signed tables (30 per second, the first sample held): 27.7 and 25.8, the fractions of the sealed manifest; without the hold: 30', () => {
    expect(Math.abs(measuredAsWaveK(asRecorded(FIRST)) - 27.67)).toBeLessThan(0.15);
    expect(Math.abs(measuredAsWaveK(asRecorded(SECOND)) - 25.77)).toBeLessThan(0.15);
    expect(measuredAsWaveK(asRecorded({ ...FIRST, firstVideoSamplePts: 0 }))).toBe(30);
    expect(measuredAsWaveK(SLOW)).toBe(27);
  });
});

// ── What the stream declares ─────────────────────────────────────────────────────────────────────
describe('fix 151 - the format a camera file DECLARES, read from its init segment', () => {
  it('the REAL init segments (lane 2, generated sources; the demo item): H264, 1280 x 720, 30 per second', async () => {
    for (const init of [REAL_INIT_SEGMENT, SEED_INIT_SEGMENT]) {
      expect(await videoSampleEntryOf(sourceOf(init))).toEqual({ state: 'KNOWN', codec: 'H264', sampleEntry: 'avc1' });
      expect(await videoStreamFormatOf(sourceOf(init))).toEqual({ width: 1280, height: 720, frameRate: 30 });
    }
    expect(REAL_INIT_SEGMENT.length).toBe(1249);
    expect(SEED_INIT_SEGMENT.length).toBe(1269);
  });

  it('the answer does not depend on the fragments: held first sample, slow delivery, ciphertext after the init segment, no fragment at all', async () => {
    const declared = { width: 1280, height: 720, frameRate: 30 };
    // 30 per second with the holds of the session of the finding.
    expect(await videoStreamFormatOf(sourceOf(FINDING['VIDEO-01']))).toEqual(declared);
    expect(await videoStreamFormatOf(sourceOf(FINDING['VIDEO-02']))).toEqual(declared);
    // DELIVERED at 27 per second (3,333 ticks between pictures, 27 per fragment): the format is still what the stream declares.
    expect(await videoStreamFormatOf(sourceOf(fileOf(REAL_INIT_SEGMENT, SLOW)))).toEqual(declared);
    // A sealed camera file: the init segment in the clear, then boxes whose content is not a `moof`.
    const sealedLike = Buffer.concat([REAL_INIT_SEGMENT, box('moof', Buffer.from(Uint8Array.from({ length: 300 }, (_unused, index) => (index * 37 + 11) & 255))), box('mdat', zeros(64))]);
    expect(await videoStreamFormatOf(sourceOf(sealedLike))).toEqual(declared);
    expect(await videoStreamFormatOf(sourceOf(REAL_INIT_SEGMENT))).toEqual(declared);
  });

  it('an INTERRUPTED prefix (whole fragments, then a torn tail) declares the same; an init segment that is not whole declares nothing', async () => {
    const whole = fileOf(REAL_INIT_SEGMENT, asRecorded(INTERRUPTED[0]!));
    const torn = Buffer.concat([whole, fragment(99, 0, [3_000, 3_000]).subarray(0, 40)]);
    expect((await walkCameraFile(sourceOf(torn), () => createHash('sha256'))).state).toBe('TORN_TAIL');
    expect(await videoStreamFormatOf(sourceOf(torn))).toEqual({ width: 1280, height: 720, frameRate: 30 });
    expect(await videoStreamFormatOf(sourceOf(REAL_INIT_SEGMENT.subarray(0, 700)))).toBeNull();
    expect(await videoStreamFormatOf(sourceOf(fragment(1, 0, [3_000])))).toBeNull();
    expect(await videoStreamFormatOf(sourceOf(new Uint8Array(0)))).toBeNull();
  });

  it('made-up parameter sets: 1080p at 25, the 1000 / 1001 family, High profile, a rate that is no whole number; and a stream that declares NO rate', async () => {
    expect(await videoStreamFormatOf(sourceOf(declaring({ width: 1920, height: 1088, timing: { unitsInTick: 1, timeScale: 50 } })))).toEqual({ width: 1920, height: 1088, frameRate: 25 });
    expect(await videoStreamFormatOf(sourceOf(declaring({ width: 1280, height: 720, timing: { unitsInTick: 1001, timeScale: 60_000 } })))).toEqual({ width: 1280, height: 720, frameRate: 60_000 / 2002 });
    expect(await videoStreamFormatOf(sourceOf(declaring({ width: 1280, height: 720, profile: 100, timing: { unitsInTick: 1, timeScale: 60 } })))).toEqual({ width: 1280, height: 720, frameRate: 30 });
    expect(await videoStreamFormatOf(sourceOf(declaring({ width: 1280, height: 720, timing: { unitsInTick: 2, timeScale: 50 } })))).toEqual({ width: 1280, height: 720, frameRate: 12.5 });
    // A VUI without timing information, no VUI, an `avcC` without a parameter set (`avc3`), no `avcC`, a parameter set cut short, another codec.
    const none = { width: 1280, height: 720, frameRate: null };
    expect(await videoStreamFormatOf(sourceOf(declaring({ width: 1280, height: 720, timing: null })))).toEqual(none);
    expect(await videoStreamFormatOf(sourceOf(declaring({ width: 1280, height: 720 })))).toEqual(none);
    expect(await videoStreamFormatOf(sourceOf(initSegment(1280, 720, avcCBox(null), 'avc3')))).toEqual(none);
    expect(await videoStreamFormatOf(sourceOf(initSegment(1280, 720, null)))).toEqual(none);
    expect(await videoStreamFormatOf(sourceOf(initSegment(1280, 720, avcCBox(spsNal({ width: 1280, height: 720, timing: { unitsInTick: 1, timeScale: 60 } }).subarray(0, 9)))))).toEqual(none);
    expect(await videoStreamFormatOf(sourceOf(initSegment(1920, 1080, null, 'hvc1')))).toEqual({ width: 1920, height: 1080, frameRate: null });
  });
});

// ── The text of field 36 and when the notice is due ──────────────────────────────────────────────
describe('fix 151 - field 36 is a code of the profile vocabulary, and the notice follows the DECLARED format', () => {
  const CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
  const of = (width: number, height: number, frameRate: number | null) => ({ width, height, frameRate });

  it('never a fraction: a whole declared rate is stated, 30000 / 1001 is the nominal 30, any other rate and no rate leave the rate out', () => {
    const texts = [
      [streamProfileOf('H264', of(1280, 720, 30)), 'H264_720P30'],
      [streamProfileOf('H264', of(1920, 1080, 25)), 'H264_1080P25'],
      [streamProfileOf('HEVC', of(3840, 2160, 25)), 'HEVC_2160P25'],
      [streamProfileOf('H264', of(1280, 720, 30_000 / 1001)), 'H264_720P30'],
      [streamProfileOf('H264', of(1920, 1080, 24_000 / 1001)), 'H264_1080P24'],
      [streamProfileOf('H264', of(1280, 960, 30)), 'H264_1280X960P30'],
      [streamProfileOf('H264', of(1280, 720, null)), 'H264_720P'],
      [streamProfileOf('H264', of(1280, 720, 12.5)), 'H264_720P'],
      // The two figures of the finding, had they been handed in as a rate: no fraction is ever written.
      [streamProfileOf('H264', of(1280, 720, 27.67)), 'H264_720P'],
      [streamProfileOf('H264', of(1280, 720, 25.77)), 'H264_720P'],
    ] as const;
    for (const [text, expected] of texts) {
      expect(text).toBe(expected);
      expect(text).toMatch(CODE);
    }
  });

  it('the notice: due when the declared text is another profile; NOT due for a stream that declares no rate under a profile of its codec and picture; due for a declared rate no code can name', () => {
    expect(streamProfileDiffers('H264_720P30', 'H264', of(1280, 720, 30))).toBe(false);
    expect(streamProfileDiffers('H264_720P30', 'H264', of(1280, 720, 30_000 / 1001))).toBe(false);
    expect(streamProfileDiffers('H264_1080P25', 'H264', of(1280, 720, 30))).toBe(true);
    expect(streamProfileDiffers('H264_720P25', 'H264', of(1280, 720, 30))).toBe(true);
    expect(streamProfileDiffers('H264_720P30', 'H264', of(1280, 720, null))).toBe(false);
    expect(streamProfileDiffers('HEVC_1080P25', 'HEVC', of(1920, 1080, null))).toBe(false);
    expect(streamProfileDiffers('H264_1080P25', 'H264', of(1280, 720, null))).toBe(true);
    expect(streamProfileDiffers('H264_720P30_WIDE', 'H264', of(1280, 720, null))).toBe(true);
    expect(streamProfileDiffers('H264_720P30', 'HEVC', of(1280, 720, null))).toBe(true);
    expect(streamProfileDiffers('H264_720P30', 'H264', of(1280, 720, 12.5))).toBe(true);
  });
});

// ── The reader ────────────────────────────────────────────────────────────────────────────────────
const SESSION = 'SES-20261011-9151';
const seeded = createSim({ storage: null, authStorage: null, scheduler: () => () => undefined }).store.getState();
const viewWith = (first: string, second: string = first): SealStateView =>
  ({
    ...seeded,
    session: {
      id: SESSION,
      state: 'FINALIZING',
      evidenceId: 'EV-20261011-0151',
      createdAt: 1_000,
      startedAt: 2_000,
      stoppedAt: 9_000,
      input: { caseNumber: 'LP/2026/1011-0151', subjectName: 'Test Subject', subjectType: 'SAKSI', investigatorId: seeded.operators[0]!.id },
      startTimeSource: seeded.time.source,
      captureConfig: { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: first }, { trackId: 'VIDEO-02', deviceId: 'CAM-02', profile: second }] },
    },
  }) as unknown as SealStateView;

async function read(files: Partial<Record<'VIDEO-01' | 'VIDEO-02', Uint8Array>>, state: SealStateView) {
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
    videoSampleEntry: async (_sessionId, trackId) => (files[trackId] === undefined ? null : videoSampleEntryOf(sourceOf(files[trackId]))),
    videoFormat: async (_sessionId, trackId) => (files[trackId] === undefined ? null : videoStreamFormatOf(sourceOf(files[trackId]))),
    onProfileDiffers: (sessionId, differences) => void told.push({ sessionId, differences }),
  });
  const facts = await reader.read(SESSION);
  if (facts === null) throw new Error('the session was not read');
  return { profiles: facts.tracks.map((track) => track.profile), told };
}

describe('fix 151 - the session reader', () => {
  it('THE FINDING: the session of note 08 - real init segments, 30 per second, first samples held 1.572 s and 3.121 s, selector H264_720P30 - states H264_720P30 twice and tells nothing', async () => {
    const result = await read(FINDING, viewWith('H264_720P30'));
    expect(result).toEqual({ profiles: ['H264_720P30', 'H264_720P30'], told: [] });
  });

  it('a 720p30 stream DELIVERED at about 27 per second states H264_720P30 and raises no notice', async () => {
    const slow = fileOf(REAL_INIT_SEGMENT, SLOW);
    expect(measuredAsWaveK(SLOW)).toBe(27);
    expect(await read({ 'VIDEO-01': slow, 'VIDEO-02': slow }, viewWith('H264_720P30'))).toEqual({ profiles: ['H264_720P30', 'H264_720P30'], told: [] });
  });

  it('a deliberately DIFFERENT declared format is still stated, and told: 1080p25 under a 720p30 selector; the real 720p30 stream under a 1080p25 selector', async () => {
    // The sample entry states the picture (1920 x 1080); the parameter set states the rate.
    const hd = Buffer.concat([initSegment(1920, 1080, avcCBox(spsNal({ width: 1920, height: 1088, timing: { unitsInTick: 1, timeScale: 50 } }))), fragment(1, 0, Array.from({ length: 25 }, () => 3_600))]);
    const first = await read({ 'VIDEO-01': hd, 'VIDEO-02': hd }, viewWith('H264_720P30'));
    expect(first.profiles).toEqual(['H264_1080P25', 'H264_1080P25']);
    expect(first.told).toEqual([{ sessionId: SESSION, differences: [{ trackId: 'VIDEO-01', configured: 'H264_720P30', stream: 'H264_1080P25' }, { trackId: 'VIDEO-02', configured: 'H264_720P30', stream: 'H264_1080P25' }] }]);
    const second = await read(FINDING, viewWith('H264_1080P25'));
    expect(second.profiles).toEqual(['H264_720P30', 'H264_720P30']);
    expect(second.told).toHaveLength(1);
    expect(second.told[0]?.differences.map((entry) => entry.stream)).toEqual(['H264_720P30', 'H264_720P30']);
  });

  it('ONE camera: the file that is there states its stream, the other line keeps its configured profile; only a declared difference is told, for that file alone', async () => {
    const one = await read({ 'VIDEO-01': FINDING['VIDEO-01'] }, viewWith('H264_720P30', 'H264_1080P25'));
    expect(one).toEqual({ profiles: ['H264_720P30', 'H264_1080P25'], told: [] });
    const differing = await read({ 'VIDEO-02': FINDING['VIDEO-02'] }, viewWith('H264_720P30', 'H264_1080P25'));
    expect(differing.profiles).toEqual(['H264_720P30', 'H264_720P30']);
    expect(differing.told).toEqual([{ sessionId: SESSION, differences: [{ trackId: 'VIDEO-02', configured: 'H264_1080P25', stream: 'H264_720P30' }] }]);
  });

  it('an INTERRUPTED prefix and a SEALED camera file (a resumed seal reads that one) state the same text as the whole recording', async () => {
    const torn = Buffer.concat([fileOf(REAL_INIT_SEGMENT, asRecorded(INTERRUPTED[1]!)), fragment(12, 0, [3_000]).subarray(0, 30)]);
    const sealedLike = Buffer.concat([REAL_INIT_SEGMENT, box('moof', Buffer.from(Uint8Array.from({ length: 200 }, (_unused, index) => (index * 91 + 5) & 255))), box('mdat', zeros(32))]);
    expect(await read({ 'VIDEO-01': torn, 'VIDEO-02': sealedLike }, viewWith('H264_720P30'))).toEqual({ profiles: ['H264_720P30', 'H264_720P30'], told: [] });
  });

  it('a stream that declares NO rate states codec and picture only (a fact the Core does not have is absent) and is not told under a profile of that picture', async () => {
    const silent = Buffer.concat([declaring({ width: 1280, height: 720, timing: null }), fragment(1, 0, Array.from({ length: 30 }, () => 3_000))]);
    expect(await read({ 'VIDEO-01': silent, 'VIDEO-02': silent }, viewWith('H264_720P30'))).toEqual({ profiles: ['H264_720P', 'H264_720P'], told: [] });
    const told = await read({ 'VIDEO-01': silent, 'VIDEO-02': silent }, viewWith('H264_1080P25'));
    expect(told.profiles).toEqual(['H264_720P', 'H264_720P']);
    expect(told.told[0]?.differences).toHaveLength(2);
  });
});
