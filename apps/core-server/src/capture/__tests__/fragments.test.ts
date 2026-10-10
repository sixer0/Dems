// The camera file read again (blueprint row 59 / M3-W3; capture spec §C.3, §C.5; erratum AU2-08;
// check M3-KC-2, function half): box walk, chain and tail validation of `../fragments`.
//
// The files are built here, box by box, so that every cut position is exact. The claim that a
// media reader ACCEPTS such a cut file is not made here (it needs ffprobe and a real recording):
// that half of M3-KC-2 is the capture e2e series (`apps/capture-worker/test/m3worker.py`, case
// `kc2`), which runs this same function on the real worker's files.
//
// EVERY VERDICT HAS ITS CONTROL: the intact file gives CLEAN / MATCH through the same calls.
import { createHash } from 'node:crypto';
import { linkSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CAPTURE_CHAIN_GENESIS_SHA256 } from '@dems/capture-protocol';
import { describe, expect, it } from 'vitest';
import {
  CameraFileFlag,
  CameraFileState,
  CheckpointVerdict,
  PartNameKind,
  TailReason,
  classifyPartNames,
  compareWithCheckpoints,
  VIDEO_SAMPLE_ENTRY_CODECS,
  validateCameraFile,
  videoSampleEntryOf,
  walkCameraFile,
  type ByteSource,
  type RecordedCheckpoint,
  type Sha256Factory,
} from '../index';

const sha256: Sha256Factory = () => createHash('sha256');
const digest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const source = (bytes: Uint8Array): ByteSource => ({ size: bytes.length, read: async (offset, length) => bytes.subarray(offset, Math.min(bytes.length, offset + length)) });

const u32 = (value: number): Uint8Array => Uint8Array.of((value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255);
const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};
const box = (type: string, ...payload: Uint8Array[]): Uint8Array => {
  const body = concat(...payload);
  return concat(u32(8 + body.length), new TextEncoder().encode(type), body);
};
const fill = (length: number, seed: number): Uint8Array => Uint8Array.from({ length }, (_unused, index) => (seed * 31 + index * 7) & 255);

const INIT = concat(box('ftyp', fill(20, 1)), box('moov', fill(700, 2)));
const moof = (seq: number): Uint8Array => box('moof', box('mfhd', u32(0), u32(seq)), box('traf', fill(60, seq)));
const fragment = (seq: number, payload = 5_000 + seq * 137): Uint8Array => concat(moof(seq), box('mdat', fill(payload, seq)));
const FRAGMENTS = [1, 2, 3, 4, 5].map((seq) => fragment(seq));
const FILE = concat(INIT, ...FRAGMENTS);
/** Where fragment n (from 1) starts and ends in FILE. */
const startOf = (n: number): number => INIT.length + FRAGMENTS.slice(0, n - 1).reduce((sum, part) => sum + part.length, 0);
const endOf = (n: number): number => startOf(n) + (FRAGMENTS[n - 1]?.length ?? 0);

/** The checkpoints of FILE, computed here by the rule of spec §C.3 with nothing of the module under test. */
function expectedCheckpoints(file: Uint8Array = FILE, count = 5): Array<RecordedCheckpoint & { media: null }> {
  const out: Array<RecordedCheckpoint & { media: null }> = [];
  let chain = Buffer.from(CAPTURE_CHAIN_GENESIS_SHA256, 'hex');
  for (let n = 1; n <= count; n += 1) {
    const frag = createHash('sha256').update(file.subarray(startOf(n), endOf(n))).digest();
    chain = createHash('sha256').update(chain).update(frag).digest();
    // `media: null`: the filler `moov` of these files names no track (the hashes and the tail verdict do not depend on it).
    out.push({ index: n, start: startOf(n), len: endOf(n) - startOf(n), fragSha256: frag.toString('hex'), chainSha256: chain.toString('hex'), prefixSha256: digest(file.subarray(0, endOf(n))), media: null });
  }
  return out;
}

describe('the chain rule', () => {
  it('chain 0 is SHA-256 of nothing', () => {
    expect(CAPTURE_CHAIN_GENESIS_SHA256).toBe(digest(new Uint8Array(0)));
  });
});

describe('walkCameraFile: an intact file', () => {
  it('is CLEAN: init segment, five whole fragments numbered 1 to 5, and every value equals the rule applied by hand', async () => {
    const walk = await walkCameraFile(source(FILE), sha256);
    expect(walk).toMatchObject({ state: CameraFileState.CLEAN, fileLength: FILE.length, initLength: INIT.length, durableLength: FILE.length, tail: null });
    expect(walk.fragments).toEqual(expectedCheckpoints());
    // The running prefix of the last fragment is the hash of the whole file (spec §C.6, skip_trailer).
    expect(walk.durablePrefixSha256).toBe(digest(FILE));
    // Byte ranges are contiguous and start after the init segment.
    expect(walk.fragments[0]?.start).toBe(INIT.length);
    for (let n = 1; n < walk.fragments.length; n += 1) expect(walk.fragments[n]?.start).toBe((walk.fragments[n - 1]?.start ?? 0) + (walk.fragments[n - 1]?.len ?? 0));
  });

  it('reads a box with a 64-bit size (size field 1) as it reads the others', async () => {
    const payload = fill(3_000, 9);
    const large = concat(u32(1), new TextEncoder().encode('mdat'), u32(0), u32(16 + payload.length), payload);
    const file = concat(INIT, moof(1), large);
    const walk = await walkCameraFile(source(file), sha256);
    expect(walk).toMatchObject({ state: CameraFileState.CLEAN, durableLength: file.length });
    expect(walk.fragments).toHaveLength(1);
    expect(walk.fragments[0]?.fragSha256).toBe(digest(file.subarray(INIT.length)));
  });

  it('reads the file in pieces: a source that hands out at most 1,000 bytes a call gives the same walk', async () => {
    const stingy: ByteSource = { size: FILE.length, read: async (offset, length) => FILE.subarray(offset, Math.min(FILE.length, offset + Math.min(length, 1_000))) };
    // The moof is read in one call by design (it is small); every hash is fed piece by piece.
    const walk = await walkCameraFile({ size: stingy.size, read: async (offset, length) => (length <= 2_000 ? FILE.subarray(offset, Math.min(FILE.length, offset + length)) : stingy.read(offset, length)) }, sha256);
    expect(walk.fragments).toEqual(expectedCheckpoints());
  });
});

describe('walkCameraFile: media time and keyframe flag of a fragment, read from its boxes', () => {
  const u64 = (value: number): Uint8Array => concat(u32(Math.floor(value / 0x1_0000_0000)), u32(value >>> 0));
  const zeros = (length: number): Uint8Array => new Uint8Array(length);
  const text = (value: string): Uint8Array => new TextEncoder().encode(value);
  const trak = (id: number, timescale: number, handler: string): Uint8Array =>
    box('trak', box('tkhd', u32(0), u32(0), u32(0), u32(id), zeros(68)), box('mdia', box('mdhd', u32(0), u32(0), u32(0), u32(timescale), u32(0), u32(0)), box('hdlr', u32(0), u32(0), text(handler), zeros(13))));
  // Video 90 kHz with 1,800 ticks a frame (50 fps), audio 48 kHz with 1,024 samples a frame; the trex default of video is "not a sync sample".
  const init = concat(
    box('ftyp', text('isom'), u32(512), text('isomiso6mp41')),
    box('moov', box('mvhd', zeros(100)), trak(1, 90_000, 'vide'), trak(2, 48_000, 'soun'), box('mvex', box('trex', u32(0), u32(1), u32(1), u32(1_800), u32(0), u32(0x0101_0000)), box('trex', u32(0), u32(2), u32(1), u32(1_024), u32(0), u32(0x0200_0000)))),
  );
  const video = (base: number, frames: number, key: boolean): Uint8Array =>
    box('traf', box('tfhd', u32(0x02_0000), u32(1)), box('tfdt', u32(0x0100_0000), u64(base)), box('trun', u32(0x00_0205), u32(frames), u32(0), u32(key ? 0x0200_0000 : 0x0101_0000), ...Array.from({ length: frames }, () => u32(100))));
  const audio = (base: number, frames: number): Uint8Array => box('traf', box('tfhd', u32(0x02_0008), u32(2), u32(1_024)), box('tfdt', u32(0), u32(base)), box('trun', u32(0x00_0201), u32(frames), u32(0), ...Array.from({ length: frames }, () => u32(10))));
  const frag = (seq: number, ...trafs: Uint8Array[]): Uint8Array => concat(box('moof', box('mfhd', u32(0), u32(seq)), ...trafs), box('mdat', fill(400, seq)));

  it('a fragment with video and audio: the span of both tracks, keyframe true; an audio-only fragment and a fragment that starts off a keyframe: false', async () => {
    const file = concat(
      init,
      frag(1, video(0, 100, true), audio(0, 94)), // 0 .. 2.000 s of video, 0 .. 2.00533 s of audio
      frag(2, audio(94 * 1_024, 47)), // a stalled camera: audio only
      frag(3, video(450_000, 50, false), audio(141 * 1_024, 47)), // video from 5.000 s, first sample not a sync sample
    );
    const walk = await walkCameraFile(source(file), sha256);
    expect(walk.state).toBe(CameraFileState.CLEAN);
    expect(walk.fragments.map((fragmentOf) => fragmentOf.media)).toEqual([
      { mediaStartMs: 0, mediaDurationMs: 2_005, keyframe: true },
      { mediaStartMs: 2_005, mediaDurationMs: 1_003, keyframe: false },
      { mediaStartMs: 3_008, mediaDurationMs: 2_992, keyframe: false },
    ]);
  });

  it('CONTROL: the same fragments under a moov that names no track give media null, and the hashes are the same hashes', async () => {
    const body = concat(frag(1, video(0, 100, true), audio(0, 94)), frag(2, audio(94 * 1_024, 47)));
    const named = await walkCameraFile(source(concat(init, body)), sha256);
    const unnamed = await walkCameraFile(source(concat(box('ftyp', fill(20, 1)), box('moov', fill(init.length - 28 - 8, 2)), body)), sha256);
    expect(unnamed.fragments.map((fragmentOf) => fragmentOf.media)).toEqual([null, null]);
    expect(unnamed.fragments.map((fragmentOf) => fragmentOf.fragSha256)).toEqual(named.fragments.map((fragmentOf) => fragmentOf.fragSha256));
  });
});

describe('walkCameraFile: the truncated tail (spec §C.5; M3-KC-2)', () => {
  const mdatOf3 = startOf(3) + moof(3).length;

  it.each([
    ['inside the mdat of fragment 3, 37 bytes into its payload', mdatOf3 + 8 + 37, TailReason.DECLARED_SIZE_EXCEEDS_BYTES_PRESENT, 'mdat', mdatOf3],
    ['one byte before the end of fragment 3', endOf(3) - 1, TailReason.DECLARED_SIZE_EXCEEDS_BYTES_PRESENT, 'mdat', mdatOf3],
    ['right after the header of the mdat of fragment 3', mdatOf3 + 8, TailReason.DECLARED_SIZE_EXCEEDS_BYTES_PRESENT, 'mdat', mdatOf3],
    ['inside the header of the mdat of fragment 3', mdatOf3 + 5, TailReason.BOX_HEADER_INCOMPLETE, null, mdatOf3],
    ['right after the moof of fragment 3 (its mdat never started)', mdatOf3, TailReason.MOOF_WITHOUT_MDAT, 'moof', startOf(3)],
    ['inside the moof of fragment 3', startOf(3) + 20, TailReason.DECLARED_SIZE_EXCEEDS_BYTES_PRESENT, 'moof', startOf(3)],
    ['three bytes into fragment 3', startOf(3) + 3, TailReason.BOX_HEADER_INCOMPLETE, null, startOf(3)],
  ] as const)('a cut %s: TORN_TAIL, the durable prefix is fragments 1 and 2, and it re-hashes to the prefix recorded for fragment 2', async (_label, cut, reason, boxType, boxStart) => {
    const walk = await walkCameraFile(source(FILE.subarray(0, cut)), sha256);
    expect(walk.state).toBe(CameraFileState.TORN_TAIL);
    expect(walk.fragments).toEqual(expectedCheckpoints().slice(0, 2));
    expect(walk.durableLength).toBe(endOf(2));
    expect(walk.durablePrefixSha256).toBe(digest(FILE.subarray(0, endOf(2))));
    // The drop range of the drop-fragment rule: [start of the torn fragment, end of the file).
    expect(walk.tail).toEqual({ start: startOf(3), bytesPresent: cut - startOf(3), reason, boxType, boxStart, declaredSize: walk.tail?.declaredSize ?? null });
    if (reason === TailReason.DECLARED_SIZE_EXCEEDS_BYTES_PRESENT) expect(walk.tail?.declaredSize).toBeGreaterThan(cut - boxStart);
  });

  it('CONTROL: a cut exactly on the boundary between fragments 2 and 3 is no torn tail (a process kill leaves this)', async () => {
    const walk = await walkCameraFile(source(FILE.subarray(0, endOf(2))), sha256);
    expect(walk).toMatchObject({ state: CameraFileState.CLEAN, tail: null, durableLength: endOf(2) });
    expect(walk.fragments).toHaveLength(2);
  });

  it('a cut inside the FIRST fragment leaves no whole fragment: durable prefix = the init segment, flagged twice', async () => {
    const verdict = await validateCameraFile(source(FILE.subarray(0, startOf(1) + moof(1).length + 100)), sha256);
    expect(verdict.walk).toMatchObject({ state: CameraFileState.TORN_TAIL, durableLength: INIT.length, durablePrefixSha256: null });
    expect(verdict.flags).toEqual([CameraFileFlag.TORN_TAIL, CameraFileFlag.NO_WHOLE_FRAGMENT]);
    expect(verdict.ok).toBe(false);
  });
});

describe('walkCameraFile: what the writer never appends', () => {
  it.each([
    ['a trailer box after the last fragment', concat(FILE, box('mfra', fill(40, 3))), 5, TailReason.UNEXPECTED_BOX, 'mfra'],
    ['a free box between fragments 2 and 3', concat(FILE.subarray(0, endOf(2)), box('free', fill(16, 4)), FILE.subarray(endOf(2))), 2, TailReason.UNEXPECTED_BOX, 'free'],
    ['two moof boxes in a row', concat(FILE.subarray(0, endOf(2)), moof(3), FILE.subarray(startOf(3))), 2, TailReason.UNEXPECTED_BOX, 'moof'],
    ['an mdat without its moof', concat(FILE.subarray(0, endOf(2)), box('mdat', fill(50, 5))), 2, TailReason.UNEXPECTED_BOX, 'mdat'],
    ['a box that declares a size below its header', concat(FILE.subarray(0, endOf(2)), u32(4), new TextEncoder().encode('moof'), fill(40, 6)), 2, TailReason.BOX_SIZE_INVALID, 'moof'],
    ['a moof without an mfhd', concat(FILE.subarray(0, endOf(2)), box('moof', box('traf', fill(60, 7))), box('mdat', fill(50, 7))), 2, TailReason.MOOF_UNREADABLE, 'moof'],
    ['fragment 3 cut OUT of the middle (4 follows 2): the chain ends before the gap', concat(FILE.subarray(0, endOf(2)), FILE.subarray(startOf(4))), 2, TailReason.SEQUENCE_GAP, 'moof'],
    ['fragment numbers that do not start at 1', concat(INIT, fragment(2)), 0, TailReason.SEQUENCE_GAP, 'moof'],
  ] as const)('%s: TORN_TAIL with the reason named, and the whole fragments before it are kept', async (_label, file, whole, reason, boxType) => {
    const walk = await walkCameraFile(source(file), sha256);
    expect(walk.state).toBe(CameraFileState.TORN_TAIL);
    expect(walk.fragments).toEqual(expectedCheckpoints().slice(0, whole));
    expect(walk.tail).toMatchObject({ reason, boxType, start: whole === 0 ? INIT.length : endOf(whole) });
  });

  it.each([
    ['an empty file', new Uint8Array(0)],
    ['a file that starts with a moof', concat(moof(1), box('mdat', fill(50, 1)))],
    ['a file that starts with an mdat', box('mdat', fill(50, 1))],
    ['an ftyp alone', box('ftyp', fill(20, 1))],
    ['a moov cut in the middle', INIT.subarray(0, 300)],
    ['an ftyp and a moof but no moov', concat(box('ftyp', fill(20, 1)), fragment(1))],
  ])('%s is NO_INIT_SEGMENT: nothing of it is a durable prefix', async (_label, file) => {
    const verdict = await validateCameraFile(source(file), sha256);
    expect(verdict.walk).toMatchObject({ state: CameraFileState.NO_INIT_SEGMENT, durableLength: 0, fragments: [] });
    expect(verdict.flags).toEqual([CameraFileFlag.NO_INIT_SEGMENT]);
  });

  it('an init segment with no fragment after it is flagged NO_WHOLE_FRAGMENT (the writer never leaves such a file under an evidence name)', async () => {
    const verdict = await validateCameraFile(source(INIT), sha256);
    expect(verdict.walk.state).toBe(CameraFileState.CLEAN);
    expect(verdict.flags).toEqual([CameraFileFlag.NO_WHOLE_FRAGMENT]);
  });
});

describe('compareWithCheckpoints: the file against what was recorded', () => {
  const recorded = expectedCheckpoints();

  it('MATCH: every record equals the bytes and the file ends where the last recorded fragment ends', async () => {
    const verdict = await validateCameraFile(source(FILE), sha256, recorded);
    expect(verdict).toMatchObject({ ok: true, flags: [] });
    expect(verdict.comparison).toEqual({ verdict: CheckpointVerdict.MATCH, matched: 5, firstMismatch: null, unrecorded: [], missing: [], lengthEqualsLastRecordedEnd: true });
  });

  it('the rows of recording_fragments carry no prefix: a null prefix is not compared, everything else is', async () => {
    const rows = recorded.map((record) => ({ ...record, prefixSha256: null }));
    expect((await validateCameraFile(source(FILE), sha256, rows)).comparison?.verdict).toBe(CheckpointVerdict.MATCH);
    const wrong = rows.map((row, at) => (at === 3 ? { ...row, chainSha256: 'f'.repeat(64) } : row));
    expect((await validateCameraFile(source(FILE), sha256, wrong)).comparison).toMatchObject({ verdict: CheckpointVerdict.MISMATCH, matched: 3, firstMismatch: { index: 4, member: 'chainSha256' } });
  });

  it('FRAGMENTS_BEYOND_RECORDS: the worker died between its write and its record; the file holds two whole fragments more than the records', async () => {
    const verdict = await validateCameraFile(source(FILE), sha256, recorded.slice(0, 3));
    expect(verdict.flags).toEqual([CameraFileFlag.FRAGMENTS_BEYOND_RECORDS]);
    expect(verdict.comparison).toMatchObject({ verdict: CheckpointVerdict.FRAGMENTS_BEYOND_RECORDS, matched: 3, lengthEqualsLastRecordedEnd: false });
    // The file is the truth: the two fragments are handed back rebuilt, ready to be recorded.
    expect(verdict.comparison?.unrecorded).toEqual(recorded.slice(3));
    expect(verdict.comparison?.unrecorded.map((rebuilt) => rebuilt.index)).toEqual([4, 5]);
  });

  it('FILE_SHORTER_THAN_RECORDS: a fragment that was recorded as durable is not whole in the file (cut inside the mdat of fragment 4)', async () => {
    const cut = FILE.subarray(0, startOf(4) + moof(4).length + 8 + 500);
    const verdict = await validateCameraFile(source(cut), sha256, recorded);
    expect(verdict.flags).toEqual([CameraFileFlag.TORN_TAIL, CameraFileFlag.FILE_SHORTER_THAN_RECORDS]);
    expect(verdict.comparison).toMatchObject({ verdict: CheckpointVerdict.FILE_SHORTER_THAN_RECORDS, matched: 3, lengthEqualsLastRecordedEnd: false });
    expect(verdict.comparison?.missing).toEqual(recorded.slice(3));
  });

  it('MISMATCH: one byte changed inside fragment 3 fails exactly fragment 3 (the tamper locator); fragments 1 and 2 still match', async () => {
    const tampered = Uint8Array.from(FILE);
    const at = startOf(3) + moof(3).length + 8 + 100;
    tampered[at] = (tampered[at] ?? 0) ^ 1;
    const verdict = await validateCameraFile(source(tampered), sha256, recorded);
    // The box structure is untouched: only the hashes can see it.
    expect(verdict.walk.state).toBe(CameraFileState.CLEAN);
    expect(verdict.flags).toEqual([CameraFileFlag.CHECKPOINT_MISMATCH]);
    expect(verdict.comparison).toMatchObject({ verdict: CheckpointVerdict.MISMATCH, matched: 2, firstMismatch: { index: 3, member: 'fragSha256' } });
    // And fragment by fragment: 3 differs in its own digest, 4 and 5 only through chain and prefix.
    const own = verdict.walk.fragments.map((rebuilt, position) => rebuilt.fragSha256 === recorded[position]?.fragSha256);
    expect(own).toEqual([true, true, false, true, true]);
  });

  it.each([
    ['a wrong start', { start: 1 }, 'start'],
    ['a wrong length', { len: 1 }, 'len'],
    ['a wrong chain value', { chainSha256: '0'.repeat(64) }, 'chainSha256'],
    ['a wrong prefix', { prefixSha256: '0'.repeat(64) }, 'prefixSha256'],
  ] as const)('MISMATCH on %s of fragment 2', async (_label, change, member) => {
    const wrong = recorded.map((record) => (record.index === 2 ? { ...record, ...change } : record));
    const walk = await walkCameraFile(source(FILE), sha256);
    expect(compareWithCheckpoints(walk, wrong)).toMatchObject({ verdict: CheckpointVerdict.MISMATCH, matched: 1, firstMismatch: { index: 2, member } });
  });

  it('RECORDS_NOT_CONTIGUOUS: records numbered 1, 2, 4 are no chain, whatever the file holds', async () => {
    const walk = await walkCameraFile(source(FILE), sha256);
    expect(compareWithCheckpoints(walk, [recorded[0]!, recorded[1]!, recorded[3]!]).verdict).toBe(CheckpointVerdict.RECORDS_NOT_CONTIGUOUS);
    expect(compareWithCheckpoints(walk, [recorded[1]!]).verdict).toBe(CheckpointVerdict.RECORDS_NOT_CONTIGUOUS);
    // CONTROL: no record at all is not "not contiguous": every fragment of the file is then unrecorded.
    expect(compareWithCheckpoints(walk, [])).toMatchObject({ verdict: CheckpointVerdict.FRAGMENTS_BEYOND_RECORDS, matched: 0 });
  });
});

describe('classifyPartNames: the names a killed worker leaves (pair-58 re-check R-5)', () => {
  const facts = (path: string) => {
    const stat = statSync(path, { bigint: true });
    return { name: path, device: stat.dev, inode: stat.ino, size: Number(stat.size) };
  };

  it('a .part that is a hard link of the camera file is a SECOND NAME of it, not a second file; a .part of its own is an orphan', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dems-row59-parts-'));
    const camera = join(dir, 'VIDEO-01.mp4');
    writeFileSync(camera, FILE);
    // What a kill between link() and unlink() leaves: the temporary name still points at the SAME file.
    linkSync(camera, `${camera}.4711.part`);
    // What a kill before link() leaves: a file of its own.
    writeFileSync(`${camera}.4712.part`, FILE.subarray(0, endOf(1)));
    const verdicts = classifyPartNames(facts(camera), [facts(`${camera}.4711.part`), facts(`${camera}.4712.part`)]);
    expect(verdicts).toEqual([
      { name: `${camera}.4711.part`, kind: PartNameKind.SECOND_NAME_OF_CAMERA_FILE, nameMayBeRemoved: true },
      { name: `${camera}.4712.part`, kind: PartNameKind.ORPHAN_OF_A_DEAD_WORKER, nameMayBeRemoved: false },
    ]);
    // The file has two names and ONE body: the link count says so, and the bytes are the same bytes.
    expect(Number(statSync(camera).nlink)).toBe(2);
  });

  it('with no camera file at all every .part is an orphan (no evidence name ever existed)', () => {
    expect(classifyPartNames(null, [{ name: 'VIDEO-02.mp4.9.part', device: 1, inode: 7, size: 10 }])).toEqual([{ name: 'VIDEO-02.mp4.9.part', kind: PartNameKind.ORPHAN_OF_A_DEAD_WORKER, nameMayBeRemoved: false }]);
  });

  it('the same inode number on ANOTHER device is another file', () => {
    const camera = { name: 'VIDEO-01.mp4', device: 1, inode: 42, size: 10 };
    expect(classifyPartNames(camera, [{ name: 'a.part', device: 2, inode: 42, size: 10 }])[0]?.kind).toBe(PartNameKind.ORPHAN_OF_A_DEAD_WORKER);
    expect(classifyPartNames(camera, [{ name: 'b.part', device: 1n, inode: 42n, size: 10 }])[0]?.kind).toBe(PartNameKind.SECOND_NAME_OF_CAMERA_FILE);
  });
});

// Integration pass D9, item 3: manifest field 43 `tracks[].codec` is what the init segment itself says.
describe('videoSampleEntryOf: the video codec of a camera file, read from the sample entry of its init segment', () => {
  const zeros = (length: number): Uint8Array => new Uint8Array(length);
  const text = (value: string): Uint8Array => new TextEncoder().encode(value);
  // A visual sample entry: 78 bytes of fixed members, then the codec configuration box.
  const stsd = (...entries: string[]): Uint8Array => box('stsd', u32(0), u32(entries.length), ...entries.map((entry) => box(entry, zeros(78), box(entry.startsWith('hv') || entry.startsWith('he') ? 'hvcC' : 'avcC', fill(30, 3)))));
  const trak = (id: number, handler: string, table: Uint8Array | null): Uint8Array =>
    box(
      'trak',
      box('tkhd', u32(0), u32(0), u32(0), u32(id), zeros(68)),
      box('mdia', box('mdhd', u32(0), u32(0), u32(0), u32(90_000), u32(0), u32(0)), box('hdlr', u32(0), u32(0), text(handler), zeros(13)), ...(table === null ? [] : [box('minf', box('vmhd', zeros(12)), box('stbl', table, box('stts', zeros(8))))])),
    );
  const audio = trak(2, 'soun', box('stsd', u32(0), u32(1), box('mp4a', zeros(28))));
  const init = (video: Uint8Array | null): Uint8Array => concat(box('ftyp', text('isom'), u32(512), text('isomiso6mp41')), box('moov', box('mvhd', zeros(100)), audio, ...(video === null ? [] : [video])));
  const file = (video: Uint8Array | null): Uint8Array => concat(init(video), fragment(1), fragment(2));

  it.each([
    ['avc1', 'H264'],
    ['avc3', 'H264'],
    ['hvc1', 'HEVC'],
    ['hev1', 'HEVC'],
  ] as const)('a generated init segment with the sample entry %s is %s - the audio track before it is not taken for it, and the walk of the same file is CLEAN', async (entry, codec) => {
    const bytes = file(trak(1, 'vide', stsd(entry)));
    expect(await videoSampleEntryOf(source(bytes))).toEqual({ state: 'KNOWN', codec, sampleEntry: entry });
    expect((await walkCameraFile(source(bytes), sha256)).state).toBe(CameraFileState.CLEAN);
  });

  it('the names are these four and no other; the profile that was asked of the camera is never read', () => {
    expect(VIDEO_SAMPLE_ENTRY_CODECS).toEqual({ avc1: 'H264', avc3: 'H264', hvc1: 'HEVC', hev1: 'HEVC' });
  });

  it('CONTROL: a sample entry this Core has no name for is UNKNOWN with codec null - never a guess, also for a name every object has', async () => {
    for (const entry of ['mp4v', 'vp09', 'av01', 'encv']) expect(await videoSampleEntryOf(source(file(trak(1, 'vide', stsd(entry))))), entry).toEqual({ state: 'UNKNOWN_SAMPLE_ENTRY', codec: null, sampleEntry: entry });
    expect(await videoSampleEntryOf(source(file(trak(1, 'vide', stsd('\u0000a/c')))))).toEqual({ state: 'UNKNOWN_SAMPLE_ENTRY', codec: null, sampleEntry: '?a?c' });
  });

  it('no video sample entry: an audio-only moov, a video track without a sample table, an empty stsd, an entry larger than its table', async () => {
    const none = { state: 'NO_VIDEO_SAMPLE_ENTRY', codec: null, sampleEntry: null };
    expect(await videoSampleEntryOf(source(file(null)))).toEqual(none);
    expect(await videoSampleEntryOf(source(file(trak(1, 'vide', null))))).toEqual(none);
    expect(await videoSampleEntryOf(source(file(trak(1, 'vide', box('stsd', u32(0), u32(0))))))).toEqual(none);
    expect(await videoSampleEntryOf(source(file(trak(1, 'vide', box('stsd', u32(0), u32(1), u32(4_000), text('avc1'))))))).toEqual(none);
  });

  it('no init segment: an empty file, a file that starts with a fragment, a moov cut short - the walk names that, this reader guesses nothing', async () => {
    const none = { state: 'NO_INIT_SEGMENT', codec: null, sampleEntry: null };
    const whole = file(trak(1, 'vide', stsd('avc1')));
    expect(await videoSampleEntryOf(source(new Uint8Array(0)))).toEqual(none);
    expect(await videoSampleEntryOf(source(fragment(1)))).toEqual(none);
    expect(await videoSampleEntryOf(source(whole.subarray(0, 120)))).toEqual(none);
    expect(await videoSampleEntryOf(source(box('ftyp', fill(20, 1))))).toEqual(none);
  });
});
