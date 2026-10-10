/**
 * THE INDEXED VIEW of a sealed camera file (fix wave K, closing pass Z1; gate finding G94b-01;
 * ruling D224 (1)). PURE: numbers in, bytes and numbers out. No file, no key, no clock.
 *
 * WHY. The sealed camera file is `ftyp moov (moof mdat)*` with no segment index (capture spec: the
 * writer's `skip_trailer`). A browser seeks such a file by probing ranges; the Android player
 * (Media3 behind expo-video) gives it no duration and maps every seek to position 0. The cure is
 * one `sidx` box (ISO/IEC 14496-12 §8.16.3) between the init segment and the first fragment.
 *
 * WHAT THE VIEW IS. The SAME decrypted bytes, in the same order, plus that ONE box:
 *
 *   view  =  file[0, at)  |  sidx  |  file[at, size)            at = the first fragment's byteOffset
 *
 * Nothing is written anywhere: the box exists in the answer of the media route only. The sealed
 * package, its hashes, the export archive and Verify never see it.
 *
 * WHERE THE NUMBERS COME FROM: the SIGNED manifest's fragment table and nothing else
 * (`files[].fragments[]`, fields 64-67 and 72: `byteOffset`, `byteLength`, `mediaStartMs`,
 * `mediaDurationMs`, `keyframe`). No box of the file is parsed and nothing is estimated:
 *
 *   referenced_size        the fragment's `byteLength` (a fragment record is one sealed byte range)
 *   subsegment_duration    the distance to the NEXT fragment's `mediaStartMs`; the last fragment's
 *                          own `mediaDurationMs`. (A fragment's own duration spans its audio AND its
 *                          video, so consecutive fragments overlap by some milliseconds; the starts
 *                          are the table's one gapless clock.)
 *   timescale              1000: the table counts whole milliseconds of FILE time
 *   earliest_presentation  the first fragment's `mediaStartMs`
 *   first_offset           0: the first fragment follows the box
 *   starts_with_SAP        the fragment's `keyframe`
 *
 * `reference_ID` is 1. It is the one member the table does not hold (the ID of the video track
 * lives in the file's `moov`). A single-level index is read by its offsets and times; the player
 * this view exists for does not read the member. Recorded as a decision of this pass.
 *
 * AN INDEX IS BUILT ONLY WHEN IT IS EXACT. The table must say, by itself, that the references are
 * the whole of the file after the init segment: a first fragment after byte 0, every fragment
 * starting where the one before ended, the last one ending at the end of the file, starts strictly
 * ascending. An INTERRUPTED recording whose sealed prefix holds that gets an index for what exists.
 * Anything else is a `SeekIndexRefusal`: the session then states no indexed view and the client
 * keeps its no-seek sentence. Never a guessed index.
 */

/** The members of a manifest fragment record the index is built from. */
export interface SeekIndexFragment {
  readonly seq: number;
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly mediaStartMs: number;
  readonly mediaDurationMs: number;
  readonly keyframe: boolean;
}

/** Why a fragment table yields no exact index. Codes: names, never values. */
export const SeekIndexRefusal = {
  NO_FRAGMENTS: 'NO_FRAGMENTS',
  /** The first fragment starts at byte 0: no init segment precedes it. */
  NO_INIT_SEGMENT: 'NO_INIT_SEGMENT',
  /** A fragment does not start where the one before it ended. */
  FRAGMENTS_NOT_CONTIGUOUS: 'FRAGMENTS_NOT_CONTIGUOUS',
  /** The last fragment does not end at the end of the file. */
  FRAGMENTS_NOT_TO_END: 'FRAGMENTS_NOT_TO_END',
  /** A fragment does not start later, in media time, than the one before it. */
  TIMES_NOT_ASCENDING: 'TIMES_NOT_ASCENDING',
  /** A value that is no whole number in the range the box can hold. */
  VALUE_OUT_OF_RANGE: 'VALUE_OUT_OF_RANGE',
  /** More fragments than one box can reference (65 535). */
  TOO_MANY_FRAGMENTS: 'TOO_MANY_FRAGMENTS',
} as const;
export type SeekIndexRefusal = (typeof SeekIndexRefusal)[keyof typeof SeekIndexRefusal];

/** The index of one camera file. It holds no media and no key. */
export interface SeekIndex {
  /** The FILE offset the box is placed at: the first fragment's `byteOffset` (the end of the init segment). */
  readonly at: number;
  /** The `sidx` box, whole. */
  readonly bytes: Uint8Array;
  /** How many fragments it references. */
  readonly references: number;
  /** What the index says the stream lasts, in ms: from the first start to the end of the last fragment. */
  readonly durationMs: number;
}

export type SeekIndexResult = { readonly ok: true; readonly index: SeekIndex } | { readonly ok: false; readonly reason: SeekIndexRefusal };

export const SEEK_INDEX_TIMESCALE = 1000;
export const SEEK_INDEX_REFERENCE_ID = 1;
export const SEEK_INDEX_MAX_REFERENCES = 0xffff;
/** `referenced_size` is 31 bits. */
const MAX_REFERENCED_SIZE = 0x7fff_ffff;
const MAX_U32 = 0xffff_ffff;
/** size, type, version + flags, reference_ID, timescale, two 64-bit times (version 1), reserved, reference_count. */
export const SEEK_INDEX_HEAD_BYTES = 8 + 4 + 4 + 4 + 8 + 8 + 2 + 2;
export const SEEK_INDEX_REFERENCE_BYTES = 12;
/** reference_type 0 (media), starts_with_SAP 1, SAP_type 1, SAP_delta_time 0. */
const SAP_SYNC = 0x9000_0000;

const whole = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const refused = (reason: SeekIndexRefusal): SeekIndexResult => ({ ok: false, reason });

/**
 * The index of a camera file of `fileBytes` bytes whose signed manifest lists `fragments` (in table
 * order), or why the table yields none. Never throws for anything a table can hold.
 */
export function buildSeekIndex(fileBytes: number, fragments: readonly SeekIndexFragment[]): SeekIndexResult {
  if (!whole(fileBytes)) return refused(SeekIndexRefusal.VALUE_OUT_OF_RANGE);
  const first = fragments[0];
  const last = fragments[fragments.length - 1];
  if (first === undefined || last === undefined) return refused(SeekIndexRefusal.NO_FRAGMENTS);
  if (fragments.length > SEEK_INDEX_MAX_REFERENCES) return refused(SeekIndexRefusal.TOO_MANY_FRAGMENTS);
  for (const fragment of fragments) {
    if (!whole(fragment.byteOffset) || !whole(fragment.byteLength) || !whole(fragment.mediaStartMs) || !whole(fragment.mediaDurationMs)) return refused(SeekIndexRefusal.VALUE_OUT_OF_RANGE);
    if (fragment.byteLength < 1 || fragment.byteLength > MAX_REFERENCED_SIZE || fragment.mediaDurationMs < 1 || fragment.mediaDurationMs > MAX_U32) return refused(SeekIndexRefusal.VALUE_OUT_OF_RANGE);
  }
  if (first.byteOffset === 0) return refused(SeekIndexRefusal.NO_INIT_SEGMENT);

  const durations: number[] = [];
  for (let at = 0; at < fragments.length; at += 1) {
    const fragment = fragments[at] as SeekIndexFragment;
    const next = fragments[at + 1];
    if (next === undefined) {
      durations.push(fragment.mediaDurationMs);
      break;
    }
    if (next.byteOffset !== fragment.byteOffset + fragment.byteLength) return refused(SeekIndexRefusal.FRAGMENTS_NOT_CONTIGUOUS);
    const duration = next.mediaStartMs - fragment.mediaStartMs;
    if (duration < 1) return refused(SeekIndexRefusal.TIMES_NOT_ASCENDING);
    if (duration > MAX_U32) return refused(SeekIndexRefusal.VALUE_OUT_OF_RANGE);
    durations.push(duration);
  }
  if (last.byteOffset + last.byteLength !== fileBytes) return refused(SeekIndexRefusal.FRAGMENTS_NOT_TO_END);

  const bytes = new Uint8Array(SEEK_INDEX_HEAD_BYTES + SEEK_INDEX_REFERENCE_BYTES * fragments.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, bytes.byteLength);
  bytes.set([0x73, 0x69, 0x64, 0x78], 4); // 'sidx'
  view.setUint32(8, 0x0100_0000); // version 1, no flags
  view.setUint32(12, SEEK_INDEX_REFERENCE_ID);
  view.setUint32(16, SEEK_INDEX_TIMESCALE);
  view.setBigUint64(20, BigInt(first.mediaStartMs));
  view.setBigUint64(28, 0n); // first_offset: the first fragment follows this box
  view.setUint16(36, 0);
  view.setUint16(38, fragments.length);
  for (let at = 0; at < fragments.length; at += 1) {
    const fragment = fragments[at] as SeekIndexFragment;
    const where = SEEK_INDEX_HEAD_BYTES + SEEK_INDEX_REFERENCE_BYTES * at;
    view.setUint32(where, fragment.byteLength);
    view.setUint32(where + 4, durations[at] as number);
    view.setUint32(where + 8, fragment.keyframe ? SAP_SYNC : 0);
  }
  return { ok: true, index: { at: first.byteOffset, bytes, references: fragments.length, durationMs: last.mediaStartMs + last.mediaDurationMs - first.mediaStartMs } };
}

/** The length of the indexed view of a file of `fileBytes` bytes. */
export function indexedViewSize(fileBytes: number, index: Pick<SeekIndex, 'bytes'>): number {
  return fileBytes + index.bytes.byteLength;
}

/** One stretch of a view range: bytes of the FILE (`[start, end)` in file offsets), or bytes of the index box. */
export type ViewPart = { readonly kind: 'FILE'; readonly start: number; readonly end: number } | { readonly kind: 'INDEX'; readonly from: number; readonly to: number };

/**
 * What a range `[start, end)` of the VIEW is made of, in view order: at most the file bytes before
 * the box, a part of the box, the file bytes after it. Offsets of a FILE part are FILE offsets:
 * behind the box every view offset is the file offset plus the length of the box.
 */
export function partsOfViewRange(index: Pick<SeekIndex, 'at' | 'bytes'>, range: { readonly start: number; readonly end: number }): ViewPart[] {
  const parts: ViewPart[] = [];
  if (range.end <= range.start) return parts;
  const boxStart = index.at;
  const boxEnd = index.at + index.bytes.byteLength;
  if (range.start < boxStart) parts.push({ kind: 'FILE', start: range.start, end: Math.min(range.end, boxStart) });
  if (range.start < boxEnd && range.end > boxStart) parts.push({ kind: 'INDEX', from: Math.max(range.start, boxStart) - boxStart, to: Math.min(range.end, boxEnd) - boxStart });
  if (range.end > boxEnd) parts.push({ kind: 'FILE', start: Math.max(range.start, boxEnd) - index.bytes.byteLength, end: range.end - index.bytes.byteLength });
  return parts;
}

/** The FILE offset a VIEW offset stands for (an offset inside the box stands for the place the box is at). */
export function fileOffsetOfViewOffset(index: Pick<SeekIndex, 'at' | 'bytes'>, offset: number): number {
  if (offset <= index.at) return offset;
  return Math.max(index.at, offset - index.bytes.byteLength);
}
