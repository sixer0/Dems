/**
 * The camera file read again: box walk, fragment chain and tail validation (blueprint row 59 /
 * M3-W3; register NM-04, NM-05; capture spec §A.5 "chain verification", §B.2 R-3, §C.3, §C.5;
 * erratum AU2-08; check M3-KC-2).
 *
 * THE FILE IS THE TRUTH, THE FRAME IS A HINT (decision D67). The capture worker tells the Core
 * about every durable fragment with a `FRAGMENT_CHECKPOINT` record, and those records become the
 * rows of `recording_fragments`. Neither is the authority. At RECOVERY (and before sealing) the
 * camera file itself is walked, and everything a checkpoint says is REBUILT FROM ITS BYTES:
 *
 *   walkCameraFile          the top-level boxes: the init segment (`ftyp`, `moov`), then `moof` +
 *                           `mdat` pairs. Each DECLARED box size is held against the BYTES
 *                           PRESENT; the last `moof` must be followed by a complete `mdat`. For
 *                           every whole fragment: its number (`mfhd.sequence_number`), its byte
 *                           range, the SHA-256 of its stored bytes, the chain and the running
 *                           prefix. What follows the last whole fragment is the TORN TAIL: the
 *                           range `[durableLength, fileLength)` is what the drop-fragment rule
 *                           drops, and `[0, durableLength)` is the durable prefix.
 *   compareWithCheckpoints  the rebuilt fragments against what was recorded (the records of the
 *                           worker, or the rows of `recording_fragments`): file length == the end
 *                           of the last recorded fragment, and every recorded value equal.
 *   validateCameraFile      both, as one verdict with named flags.
 *   classifyPartNames       the `.part` names beside a camera file (pair-58 re-check R-5).
 *
 * WHY A WALK AND NOT A PROBE (erratum AU2-08). A file cut inside an `mdat` is accepted by
 * `ffprobe` and by the decoder with exit code 0, no error line and an over-reported duration: a
 * media reader does not detect a truncated tail. Only the comparison of the declared sizes with
 * the bytes present does. This module is that comparison.
 *
 * WHAT IT IS NOT. It decides nothing and changes nothing: it truncates no file, removes no name
 * and writes no row. The caller (the RECOVERY and sealing rows) acts on the verdict.
 *
 * NO FILE, NO HASH LIBRARY, NO CLOCK IS NAMED HERE (static rules G-R2, G-R8 of this folder): the
 * bytes come through a `ByteSource` and SHA-256 through a `Sha256Factory`, both handed in by the
 * caller. A host with the file system passes a reader over an open file and
 * `() => createHash('sha256')` of its own.
 *
 * THE CHAIN (spec §C.3; S1 §3.1): `chain_0 = SHA-256("")`,
 * `chain_n = SHA-256(chain_{n-1} as 32 raw bytes || fragSha256_n as 32 raw bytes)`, and
 * `prefix_n = SHA-256(file bytes [0, end of fragment n))`. All of it is over STORED bytes, so it
 * is verifiable without any key.
 */
import { CAPTURE_CHAIN_GENESIS_SHA256 } from '@dems/capture-protocol';

/** Random access to the bytes of one file. `read` returns exactly `length` bytes, or fewer only at the end of the file. */
export interface ByteSource {
  /** Length of the file in bytes, as it is NOW (the bytes present). */
  readonly size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
}

/** An incremental SHA-256 whose state can be copied (Node's `Hash` has this shape). */
export interface RunningSha256 {
  update(bytes: Uint8Array): unknown;
  copy(): RunningSha256;
  digest(): Uint8Array;
}
export type Sha256Factory = () => RunningSha256;

/** One whole fragment as the file itself gives it. The names are those of the `FRAGMENT_CHECKPOINT` record. */
export interface RebuiltFragment {
  /** `mfhd.sequence_number`. */
  readonly index: number;
  /** The stored-byte range `[start, start + len)`: the `moof` box and its `mdat` box. */
  readonly start: number;
  readonly len: number;
  readonly fragSha256: string;
  readonly chainSha256: string;
  readonly prefixSha256: string;
  /**
   * Where the fragment lies on the file's media timeline (the span of its tracks, from `tfdt` and
   * `trun` with the timescales of the `moov`), and whether its video starts on a sync sample:
   * the same three values the worker's checkpoint carries, read here by an implementation of its
   * own. Null when the `moov` or the `moof` does not say (the hashes and the tail verdict do not
   * depend on it).
   */
  readonly media: FragmentMedia | null;
}

export interface FragmentMedia {
  readonly mediaStartMs: number;
  readonly mediaDurationMs: number;
  readonly keyframe: boolean;
}

/** Why the bytes after the last whole fragment are no fragment. */
export const TailReason = {
  /** Fewer bytes are left than a box header has. */
  BOX_HEADER_INCOMPLETE: 'BOX_HEADER_INCOMPLETE',
  /** A box declares a size below its own header. */
  BOX_SIZE_INVALID: 'BOX_SIZE_INVALID',
  /** A box declares more bytes than the file holds: the truncated `moof` or `mdat` (S1 §5.5; AU2-08). */
  DECLARED_SIZE_EXCEEDS_BYTES_PRESENT: 'DECLARED_SIZE_EXCEEDS_BYTES_PRESENT',
  /** The file ends after a whole `moof`: its `mdat` never started. */
  MOOF_WITHOUT_MDAT: 'MOOF_WITHOUT_MDAT',
  /** A top-level box that is neither `moof` nor the `mdat` of the `moof` before it (the writer appends nothing else). */
  UNEXPECTED_BOX: 'UNEXPECTED_BOX',
  /** A whole `moof` without a readable `mfhd`. */
  MOOF_UNREADABLE: 'MOOF_UNREADABLE',
  /** A whole fragment whose number is not the one after the fragment before it: the chain ends before it. */
  SEQUENCE_GAP: 'SEQUENCE_GAP',
} as const;
export type TailReason = (typeof TailReason)[keyof typeof TailReason];

export interface TornTail {
  /** Where the tail starts: the first byte that is not part of a whole fragment of the chain (`== durableLength`). */
  readonly start: number;
  /** How many bytes it holds: `fileLength - start`. */
  readonly bytesPresent: number;
  readonly reason: TailReason;
  /** The box the walk stopped at: its type, where it starts and what it declares (null when no header could be read). */
  readonly boxType: string | null;
  readonly boxStart: number;
  readonly declaredSize: number | null;
}

export const CameraFileState = {
  /** Init segment, then whole fragments only, numbered 1, 2, 3 ...: the file ends on a fragment boundary. */
  CLEAN: 'CLEAN',
  /** Whole fragments (possibly none) and then bytes that are no whole fragment: `tail` says where and why. */
  TORN_TAIL: 'TORN_TAIL',
  /** No `ftyp` + `moov` before the first `moof`: not a camera file of this writer. */
  NO_INIT_SEGMENT: 'NO_INIT_SEGMENT',
} as const;
export type CameraFileState = (typeof CameraFileState)[keyof typeof CameraFileState];

export interface CameraFileWalk {
  readonly state: CameraFileState;
  readonly fileLength: number;
  /** Length of the init segment (0 when there is none). */
  readonly initLength: number;
  /** The whole fragments of the chain, in file order. */
  readonly fragments: readonly RebuiltFragment[];
  /** `[0, durableLength)` is the durable prefix: the init segment and every whole fragment. */
  readonly durableLength: number;
  /** SHA-256 of the durable prefix: the `prefixSha256` of the last whole fragment (null when there is none). */
  readonly durablePrefixSha256: string | null;
  readonly tail: TornTail | null;
}

const HEADER = 8;
const LARGE_HEADER = 16;
/** A `moof` larger than this is not read into memory (a fragment of this writer has a `moof` of a few kilobytes). */
const MOOF_READ_LIMIT = 16 * 1024 * 1024;
const CHUNK = 1024 * 1024;

const hexOf = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

function bytesOf(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let index = 0; index < out.length; index += 1) out[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return out;
}

const be32 = (bytes: Uint8Array, at: number): number => ((bytes[at] ?? 0) * 0x1000000 + ((bytes[at + 1] ?? 0) << 16) + ((bytes[at + 2] ?? 0) << 8) + (bytes[at + 3] ?? 0)) >>> 0;
const typeOf = (bytes: Uint8Array, at: number): string => String.fromCharCode(bytes[at] ?? 0, bytes[at + 1] ?? 0, bytes[at + 2] ?? 0, bytes[at + 3] ?? 0);

interface BoxHead {
  readonly type: string;
  readonly start: number;
  /** Declared size, header included. */
  readonly size: number;
  readonly header: number;
}

type HeadResult = { readonly head: BoxHead } | { readonly reason: TailReason; readonly type: string | null; readonly declared: number | null };

/** The header of the box at `start`, held against the bytes present. */
async function boxHead(source: ByteSource, start: number): Promise<HeadResult> {
  const left = source.size - start;
  if (left < HEADER) return { reason: TailReason.BOX_HEADER_INCOMPLETE, type: null, declared: null };
  const head = await source.read(start, Math.min(LARGE_HEADER, left));
  if (head.length < HEADER) return { reason: TailReason.BOX_HEADER_INCOMPLETE, type: null, declared: null };
  const type = typeOf(head, 4);
  let size = be32(head, 0);
  let header = HEADER;
  if (size === 1) {
    if (head.length < LARGE_HEADER) return { reason: TailReason.BOX_HEADER_INCOMPLETE, type, declared: null };
    size = be32(head, 8) * 0x100000000 + be32(head, 12);
    header = LARGE_HEADER;
  }
  // Size 0 ("to the end of the file") never occurs in a fragmented file of this writer.
  if (size < header || !Number.isSafeInteger(size)) return { reason: TailReason.BOX_SIZE_INVALID, type, declared: size };
  if (size > left) return { reason: TailReason.DECLARED_SIZE_EXCEEDS_BYTES_PRESENT, type, declared: size };
  return { head: { type, start, size, header } };
}

interface Track {
  readonly id: number;
  readonly timescale: number;
  readonly video: boolean;
  /** `trex` defaults. */
  defaultDuration: number;
  defaultFlags: number;
}

/** The child boxes of a container held in memory: `[type, start of payload, end of box]`, or null when one does not fit. */
function children(bytes: Uint8Array, from: number, to: number): Array<readonly [type: string, payload: number, end: number]> | null {
  const out: Array<readonly [string, number, number]> = [];
  let at = from;
  while (at < to) {
    if (to - at < HEADER) return null;
    const size = be32(bytes, at);
    if (size < HEADER || size > to - at) return null;
    out.push([typeOf(bytes, at + 4), at + HEADER, at + size]);
    at += size;
  }
  return out;
}

/** The tracks of an init segment's `moov`: ID, timescale, video or not, and the `trex` defaults. Null when it cannot be read. */
function tracksOf(moov: Uint8Array, header: number): Track[] | null {
  const top = children(moov, header, moov.length);
  if (top === null) return null;
  const tracks: Track[] = [];
  for (const [type, payload, end] of top) {
    if (type !== 'trak') continue;
    let id = 0;
    let timescale = 0;
    let video = false;
    for (const [inner, at, innerEnd] of children(moov, payload, end) ?? []) {
      if (inner === 'tkhd') {
        const where = at + (moov[at] === 1 ? 20 : 12);
        if (where + 4 <= innerEnd) id = be32(moov, where);
      } else if (inner === 'mdia') {
        for (const [leaf, leafAt, leafEnd] of children(moov, at, innerEnd) ?? []) {
          const where = leafAt + (moov[leafAt] === 1 ? 20 : 12);
          if (leaf === 'mdhd' && where + 4 <= leafEnd) timescale = be32(moov, where);
          if (leaf === 'hdlr' && leafAt + 12 <= leafEnd) video = typeOf(moov, leafAt + 8) === 'vide';
        }
      }
    }
    if (id === 0 || timescale === 0) return null;
    tracks.push({ id, timescale, video, defaultDuration: 0, defaultFlags: 0 });
  }
  for (const [type, payload, end] of top) {
    if (type !== 'mvex') continue;
    for (const [inner, at, innerEnd] of children(moov, payload, end) ?? []) {
      if (inner !== 'trex' || at + 24 > innerEnd) continue;
      const track = tracks.find((candidate) => candidate.id === be32(moov, at + 4));
      if (track === undefined) continue;
      track.defaultDuration = be32(moov, at + 12);
      track.defaultFlags = be32(moov, at + 20);
    }
  }
  return tracks.length === 0 ? null : tracks;
}

/** `sample_is_non_sync_sample` of the sample flags (ISO/IEC 14496-12, 8.8.3). */
const NON_SYNC = 0x0001_0000;

/** The span of media time one whole `moof` covers, and whether its video starts on a sync sample. Null when it cannot be read. */
function mediaOf(moof: Uint8Array, header: number, tracks: readonly Track[]): FragmentMedia | null {
  const top = children(moof, header, moof.length);
  if (top === null) return null;
  let low: number | null = null;
  let high = 0;
  let video = false;
  let sync = false;
  for (const [type, payload, end] of top) {
    if (type !== 'traf') continue;
    const inner = children(moof, payload, end);
    if (inner === null) return null;
    let track: Track | undefined;
    let defaultDuration: number | null = null;
    let defaultFlags: number | null = null;
    let base = 0;
    let total = 0;
    let samples = 0;
    let firstFlags: number | null = null;
    for (const [leaf, at, leafEnd] of inner) {
      if (leaf === 'tfhd') {
        if (at + 8 > leafEnd) return null;
        const flags = be32(moof, at) & 0xffffff;
        track = tracks.find((candidate) => candidate.id === be32(moof, at + 4));
        let cursor = at + 8;
        if (flags & 0x1) cursor += 8;
        if (flags & 0x2) cursor += 4;
        if (flags & 0x8) {
          if (cursor + 4 > leafEnd) return null;
          defaultDuration = be32(moof, cursor);
          cursor += 4;
        }
        if (flags & 0x10) cursor += 4;
        if (flags & 0x20) {
          if (cursor + 4 > leafEnd) return null;
          defaultFlags = be32(moof, cursor);
        }
      } else if (leaf === 'tfdt') {
        if (at + 8 > leafEnd || (moof[at] === 1 && at + 12 > leafEnd)) return null;
        base = moof[at] === 1 ? be32(moof, at + 4) * 0x1_0000_0000 + be32(moof, at + 8) : be32(moof, at + 4);
      } else if (leaf === 'trun') {
        if (track === undefined || at + 8 > leafEnd) return null;
        const flags = be32(moof, at) & 0xffffff;
        const count = be32(moof, at + 4);
        let cursor = at + 8;
        if (flags & 0x1) cursor += 4;
        let runFirst: number | null = null;
        if (flags & 0x4) {
          if (cursor + 4 > leafEnd) return null;
          runFirst = be32(moof, cursor);
          cursor += 4;
        }
        const stride = (flags & 0x100 ? 4 : 0) + (flags & 0x200 ? 4 : 0) + (flags & 0x400 ? 4 : 0) + (flags & 0x800 ? 4 : 0);
        if (cursor + count * stride > leafEnd) return null;
        const duration = defaultDuration ?? track.defaultDuration;
        for (let sample = 0; sample < count; sample += 1) {
          const entry = cursor + sample * stride;
          total += flags & 0x100 ? be32(moof, entry) : duration;
          if (sample === 0 && firstFlags === null) {
            const own = entry + (flags & 0x100 ? 4 : 0) + (flags & 0x200 ? 4 : 0);
            firstFlags = runFirst ?? (flags & 0x400 ? be32(moof, own) : (defaultFlags ?? track.defaultFlags));
          }
        }
        samples += count;
      }
    }
    if (track === undefined) return null;
    if (samples === 0) continue;
    const from = Math.floor((base * 1_000_000) / track.timescale);
    const to = Math.floor(((base + total) * 1_000_000) / track.timescale);
    low = low === null ? from : Math.min(low, from);
    high = Math.max(high, to);
    if (track.video) {
      video = true;
      sync = firstFlags !== null && (firstFlags & NON_SYNC) === 0;
    }
  }
  if (low === null) return null;
  return { mediaStartMs: Math.floor(low / 1_000), mediaDurationMs: Math.max(1, Math.floor((high - low + 500) / 1_000)), keyframe: video && sync };
}

/** `mfhd.sequence_number` of a whole `moof`, or null when it has none that can be read. */
function sequenceNumber(moof: Uint8Array, header: number): number | null {
  let at = header;
  while (moof.length - at >= HEADER) {
    const size = be32(moof, at);
    if (size < HEADER || size > moof.length - at) return null;
    if (typeOf(moof, at + 4) === 'mfhd') return size >= HEADER + 8 ? be32(moof, at + HEADER + 4) : null;
    at += size;
  }
  return null;
}

/**
 * Walks one camera file. Reads every byte of the durable prefix once (for the hashes) and nothing
 * else. Never throws for what the file holds: every shape of a damaged file is a verdict.
 */
export async function walkCameraFile(source: ByteSource, sha256: Sha256Factory): Promise<CameraFileWalk> {
  const fileLength = source.size;
  let prefix = sha256();
  const feed = async (hashes: readonly RunningSha256[], from: number, length: number): Promise<boolean> => {
    for (let done = 0; done < length; ) {
      const piece = await source.read(from + done, Math.min(CHUNK, length - done));
      if (piece.length === 0) return false;
      for (const hash of hashes) hash.update(piece);
      done += piece.length;
    }
    return true;
  };
  const torn = (state: CameraFileState, initLength: number, fragments: readonly RebuiltFragment[], durableLength: number, tail: Omit<TornTail, 'start' | 'bytesPresent'> | null): CameraFileWalk => ({
    state,
    fileLength,
    initLength,
    fragments,
    durableLength,
    durablePrefixSha256: fragments.at(-1)?.prefixSha256 ?? null,
    tail: tail === null ? null : { start: durableLength, bytesPresent: fileLength - durableLength, ...tail },
  });

  // ── The init segment: every box before the first `moof`; `ftyp` and `moov` must be among them. ──
  let at = 0;
  let ftyp = false;
  let moov = false;
  let tracks: Track[] | null = null;
  for (;;) {
    if (at === fileLength) {
      // The file ends before any `moof`: an init segment alone (no fragment), or not even that.
      if (ftyp && moov) break;
      return torn(CameraFileState.NO_INIT_SEGMENT, 0, [], 0, null);
    }
    const result = await boxHead(source, at);
    if ('reason' in result) {
      // Not even the init segment is whole: nothing of this file is a durable prefix.
      return torn(CameraFileState.NO_INIT_SEGMENT, 0, [], 0, { reason: result.reason, boxType: result.type, boxStart: at, declaredSize: result.declared });
    }
    if (result.head.type === 'moof') break;
    if (result.head.type === 'mdat') return torn(CameraFileState.NO_INIT_SEGMENT, 0, [], 0, { reason: TailReason.UNEXPECTED_BOX, boxType: 'mdat', boxStart: at, declaredSize: result.head.size });
    ftyp ||= result.head.type === 'ftyp';
    if (result.head.type === 'moov') {
      moov = true;
      if (result.head.size <= MOOF_READ_LIMIT) {
        const moovBytes = await source.read(at, result.head.size);
        tracks = moovBytes.length === result.head.size ? tracksOf(moovBytes, result.head.header) : null;
      }
    }
    at += result.head.size;
  }
  if (!ftyp || !moov) return torn(CameraFileState.NO_INIT_SEGMENT, 0, [], 0, { reason: TailReason.UNEXPECTED_BOX, boxType: 'moof', boxStart: at, declaredSize: null });
  const initLength = at;
  if (!(await feed([prefix], 0, initLength))) return torn(CameraFileState.NO_INIT_SEGMENT, 0, [], 0, null);

  // ── The fragments: `moof`, `mdat`, `moof`, `mdat` ... ─────────────────────────────────────────
  const fragments: RebuiltFragment[] = [];
  let chain = bytesOf(CAPTURE_CHAIN_GENESIS_SHA256);
  let durableLength = initLength;
  while (durableLength < fileLength) {
    const stop = (reason: TailReason, boxType: string | null, boxStart: number, declaredSize: number | null): CameraFileWalk =>
      torn(CameraFileState.TORN_TAIL, initLength, fragments, durableLength, { reason, boxType, boxStart, declaredSize });
    const first = await boxHead(source, durableLength);
    if ('reason' in first) return stop(first.reason, first.type, durableLength, first.declared);
    const moof = first.head;
    if (moof.type !== 'moof') return stop(TailReason.UNEXPECTED_BOX, moof.type, moof.start, moof.size);
    const mdatStart = moof.start + moof.size;
    if (mdatStart === fileLength) return stop(TailReason.MOOF_WITHOUT_MDAT, 'moof', moof.start, moof.size);
    const second = await boxHead(source, mdatStart);
    if ('reason' in second) return stop(second.reason, second.type, mdatStart, second.declared);
    const mdat = second.head;
    if (mdat.type !== 'mdat') return stop(TailReason.UNEXPECTED_BOX, mdat.type, mdat.start, mdat.size);
    if (moof.size > MOOF_READ_LIMIT) return stop(TailReason.MOOF_UNREADABLE, 'moof', moof.start, moof.size);
    const moofBytes = await source.read(moof.start, moof.size);
    const index = moofBytes.length === moof.size ? sequenceNumber(moofBytes, moof.header) : null;
    if (index === null) return stop(TailReason.MOOF_UNREADABLE, 'moof', moof.start, moof.size);
    if (index !== fragments.length + 1) return stop(TailReason.SEQUENCE_GAP, 'moof', moof.start, moof.size);
    const len = moof.size + mdat.size;
    const own = sha256();
    // The running prefix moves on a copy: a fragment that cannot be read to its end leaves it untouched.
    const ahead = prefix.copy();
    if (!(await feed([own, ahead], moof.start, len))) return stop(TailReason.DECLARED_SIZE_EXCEEDS_BYTES_PRESENT, 'mdat', mdat.start, mdat.size);
    const frag = own.digest();
    const link = sha256();
    link.update(chain);
    link.update(frag);
    chain = link.digest();
    // The digest is taken from a copy: the running state goes on into the next fragment.
    const media = tracks === null ? null : mediaOf(moofBytes, moof.header, tracks);
    fragments.push({ index, start: moof.start, len, fragSha256: hexOf(frag), chainSha256: hexOf(chain), prefixSha256: hexOf(ahead.copy().digest()), media });
    prefix = ahead;
    durableLength = moof.start + len;
  }
  return torn(CameraFileState.CLEAN, initLength, fragments, durableLength, null);
}

// ── The video codec of a camera file: the sample entry of its init segment (integration pass D9) ──

/**
 * Manifest field 43 `tracks[].codec` (evidence package spec §B.4, erratum PE-D9-03; database
 * contract §B.12 "format CODE"). THE FILE SAYS IT, NOT THE PLAN: the worker copies what the camera
 * sends, so the profile that was ASKED of the camera (`H264_720P30`) is not what is recorded here.
 * The codec is the four-character type of the first sample entry of the video track
 * (`moov/trak[hdlr vide]/mdia/minf/stbl/stsd`; ISO/IEC 14496-12 8.5.2, 14496-15):
 *
 *   `avc1`, `avc3` -> `H264`        `hvc1`, `hev1` -> `HEVC`
 *
 * Any other sample entry has NO name here: it is reported as it is and never mapped to a guess.
 */
export const VideoCodec = { H264: 'H264', HEVC: 'HEVC' } as const;
export type VideoCodec = (typeof VideoCodec)[keyof typeof VideoCodec];
export const VIDEO_SAMPLE_ENTRY_CODECS: Readonly<Record<string, VideoCodec>> = Object.freeze({ avc1: VideoCodec.H264, avc3: VideoCodec.H264, hvc1: VideoCodec.HEVC, hev1: VideoCodec.HEVC });

export const VideoSampleEntryState = {
  /** The sample entry is one this Core has a codec name for. */
  KNOWN: 'KNOWN',
  /** A video sample entry is there and its type has no codec name here. */
  UNKNOWN_SAMPLE_ENTRY: 'UNKNOWN_SAMPLE_ENTRY',
  /** The init segment is whole and names no video track with a sample entry. */
  NO_VIDEO_SAMPLE_ENTRY: 'NO_VIDEO_SAMPLE_ENTRY',
  /** No whole `moov` before the first fragment: the walk of the file names that (`NO_INIT_SEGMENT`). */
  NO_INIT_SEGMENT: 'NO_INIT_SEGMENT',
} as const;
export type VideoSampleEntryState = (typeof VideoSampleEntryState)[keyof typeof VideoSampleEntryState];

export type VideoSampleEntryRead =
  | { readonly state: typeof VideoSampleEntryState.KNOWN; readonly codec: VideoCodec; readonly sampleEntry: string }
  /** `sampleEntry`: the four characters as the file holds them, anything but a letter or a digit shown as `?` (for a log line, never for the manifest). */
  | { readonly state: typeof VideoSampleEntryState.UNKNOWN_SAMPLE_ENTRY; readonly codec: null; readonly sampleEntry: string }
  | { readonly state: typeof VideoSampleEntryState.NO_VIDEO_SAMPLE_ENTRY | typeof VideoSampleEntryState.NO_INIT_SEGMENT; readonly codec: null; readonly sampleEntry: null };

/** The type of the first sample entry of the first video track of a `moov` held in memory, or null. */
function videoSampleEntryIn(moov: Uint8Array, header: number): string | null {
  const child = (from: number, to: number, type: string): readonly [number, number] | null => {
    const found = (children(moov, from, to) ?? []).find(([name]) => name === type);
    return found === undefined ? null : [found[1], found[2]];
  };
  for (const [type, payload, end] of children(moov, header, moov.length) ?? []) {
    if (type !== 'trak') continue;
    const mdia = child(payload, end, 'mdia');
    if (mdia === null) continue;
    const hdlr = child(mdia[0], mdia[1], 'hdlr');
    // `hdlr`: version and flags (4), pre_defined (4), handler_type (4).
    if (hdlr === null || hdlr[0] + 12 > hdlr[1] || typeOf(moov, hdlr[0] + 8) !== 'vide') continue;
    const minf = child(mdia[0], mdia[1], 'minf');
    const stbl = minf === null ? null : child(minf[0], minf[1], 'stbl');
    const stsd = stbl === null ? null : child(stbl[0], stbl[1], 'stsd');
    if (stsd === null) return null;
    // `stsd`: version and flags (4), entry_count (4), then the entries, each a box.
    const first = stsd[0] + 8;
    if (first + HEADER > stsd[1] || be32(moov, stsd[0] + 4) < 1) return null;
    const size = be32(moov, first);
    if (size < HEADER || size > stsd[1] - first) return null;
    return typeOf(moov, first + 4);
  }
  return null;
}

/**
 * The video sample entry of a camera file's init segment. Reads the top-level box headers up to
 * the first `moof` and the `moov` itself; every declared size is held against the bytes present,
 * as the walk does. Decides nothing: the caller acts on the state.
 */
export async function videoSampleEntryOf(source: ByteSource): Promise<VideoSampleEntryRead> {
  const none = (state: typeof VideoSampleEntryState.NO_VIDEO_SAMPLE_ENTRY | typeof VideoSampleEntryState.NO_INIT_SEGMENT): VideoSampleEntryRead => ({ state, codec: null, sampleEntry: null });
  for (let at = 0; at < source.size; ) {
    const result = await boxHead(source, at);
    if ('reason' in result || result.head.type === 'moof' || result.head.type === 'mdat') return none(VideoSampleEntryState.NO_INIT_SEGMENT);
    if (result.head.type !== 'moov') {
      at += result.head.size;
      continue;
    }
    if (result.head.size > MOOF_READ_LIMIT) return none(VideoSampleEntryState.NO_INIT_SEGMENT);
    const moov = await source.read(at, result.head.size);
    if (moov.length !== result.head.size) return none(VideoSampleEntryState.NO_INIT_SEGMENT);
    const entry = videoSampleEntryIn(moov, result.head.header);
    if (entry === null) return none(VideoSampleEntryState.NO_VIDEO_SAMPLE_ENTRY);
    const codec = Object.prototype.hasOwnProperty.call(VIDEO_SAMPLE_ENTRY_CODECS, entry) ? VIDEO_SAMPLE_ENTRY_CODECS[entry] : undefined;
    if (codec !== undefined) return { state: VideoSampleEntryState.KNOWN, codec, sampleEntry: entry };
    return { state: VideoSampleEntryState.UNKNOWN_SAMPLE_ENTRY, codec: null, sampleEntry: entry.replace(/[^A-Za-z0-9]/g, '?') };
  }
  return none(VideoSampleEntryState.NO_INIT_SEGMENT);
}

// ── What the video stream of a camera file DECLARES (fix wave K, driver S1; fix 151) ──────────────

/**
 * The picture size and the frame rate a camera file DECLARES ABOUT ITSELF, read from its init
 * segment (ruling D222 (2): a manifest states what the stream is, never the profile somebody
 * configured; controller ruling of 2026-10-11, fix 151: a FORMAT statement is what the stream
 * declares, never a measured average).
 *   width, height   the first video sample entry of the init segment (`VisualSampleEntry`, ISO/IEC
 *                   14496-12 §12.1.3: two 16-bit members at byte 32 and 34 of the entry box);
 *   frameRate       the NOMINAL rate the video's own parameter set states: for H.264 the timing
 *                   information of the sequence parameter set held in the `avcC` box of the sample
 *                   entry (ITU-T H.264 E.1.1 / E.2.1: `time_scale / (2 * num_units_in_tick)`
 *                   frames per second). Null when the stream states none: no `avcC`, no parameter
 *                   set in it (`avc3`), a parameter set without timing information, or a codec
 *                   whose parameter sets this Core does not read (HEVC: open item of fix 151).
 *
 * WHY NOT A MEASURE (fix 151). Wave K measured samples / the time they span over the first
 * fragments. The first video sample of a camera file is HELD from file time 0 to the first keyframe
 * the worker could place (capture spec §C.4; the muxer writes it with its own duration plus the
 * hold), so that quotient was always below the rate of the stream: `EV-20261011-0025` was sealed
 * as `H264_720P27.67` / `H264_720P26` from two 30-per-second streams held 1.572 s and 3.121 s. And
 * a rate delivered under load is a fact about the delivery, not the format. Nothing here reads a
 * fragment any more: the answer is the same for a recording file and for a sealed one.
 */
export interface VideoStreamFormat {
  readonly width: number;
  readonly height: number;
  /** Frames per second as the stream's parameter set states them (may be a fraction: 30000 / 1001); null when it states none. */
  readonly frameRate: number | null;
}

/** A parameter set longer than this is not read (a real one is some tens of bytes). */
const PARAMETER_SET_READ_LIMIT = 4096;

/**
 * The frame rate an H.264 sequence parameter set states (`vui_parameters`, `timing_info_present_flag`),
 * or null when it states none or cannot be read to that point. `nal` is the NAL unit as `avcC`
 * holds it (header byte first, emulation prevention bytes still in).
 *
 * Exported for the stream half of the connection test (task 4 row 50; AD-06 (1)): the profile code
 * minted from a probed stream reads the rate with THIS function, so that it states what the seal
 * will state of the recorded file.
 */
export function avcDeclaredFrameRate(nal: Uint8Array): number | null {
  if (nal.length < 4 || nal.length > PARAMETER_SET_READ_LIMIT || ((nal[0] ?? 0) & 0x1f) !== 7) return null;
  // The payload without the emulation prevention bytes (00 00 03 -> 00 00).
  const rbsp: number[] = [];
  for (let index = 1; index < nal.length; index += 1) {
    if (index + 2 < nal.length && nal[index] === 0 && nal[index + 1] === 0 && nal[index + 2] === 3) {
      rbsp.push(0, 0);
      index += 2;
    } else rbsp.push(nal[index] ?? 0);
  }
  const bits = rbsp.length * 8;
  let at = 0;
  let overrun = false;
  const u = (count: number): number => {
    let value = 0;
    for (let bit = 0; bit < count; bit += 1) {
      if (at >= bits) {
        overrun = true;
        return 0;
      }
      value = value * 2 + (((rbsp[at >> 3] ?? 0) >> (7 - (at & 7))) & 1);
      at += 1;
    }
    return value;
  };
  const ue = (): number => {
    let zeros = 0;
    while (u(1) === 0) {
      if (overrun || zeros >= 31) {
        overrun = true;
        return 0;
      }
      zeros += 1;
    }
    return 2 ** zeros - 1 + u(zeros);
  };
  const se = (): number => {
    const code = ue();
    return code % 2 === 1 ? (code + 1) / 2 : -(code / 2);
  };
  const profile = u(8);
  u(16); // constraint flags, level
  ue(); // seq_parameter_set_id
  if ([100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135].includes(profile)) {
    const chroma = ue();
    if (chroma === 3) u(1);
    ue();
    ue();
    u(1);
    if (u(1) === 1) {
      // seq_scaling_matrix_present_flag: the lists are walked, not kept.
      for (let list = 0; list < (chroma === 3 ? 12 : 8); list += 1) {
        if (u(1) === 0) continue;
        let last = 8;
        let next = 8;
        for (let entry = 0; entry < (list < 6 ? 16 : 64) && !overrun; entry += 1) {
          if (next !== 0) next = (last + se() + 256) % 256;
          last = next === 0 ? last : next;
        }
      }
    }
  }
  ue(); // log2_max_frame_num_minus4
  const order = ue();
  if (order === 0) ue();
  else if (order === 1) {
    u(1);
    se();
    se();
    const cycle = ue();
    if (cycle > 255) return null;
    for (let entry = 0; entry < cycle && !overrun; entry += 1) se();
  }
  ue(); // max_num_ref_frames
  u(1);
  ue(); // pic_width_in_mbs_minus1
  ue(); // pic_height_in_map_units_minus1
  if (u(1) === 0) u(1); // frame_mbs_only_flag, mb_adaptive_frame_field_flag
  u(1);
  if (u(1) === 1) {
    ue();
    ue();
    ue();
    ue();
  }
  if (u(1) === 0 || overrun) return null; // vui_parameters_present_flag
  if (u(1) === 1 && u(8) === 255) u(32); // aspect ratio
  if (u(1) === 1) u(1); // overscan
  if (u(1) === 1) {
    u(4);
    if (u(1) === 1) u(24);
  }
  if (u(1) === 1) {
    ue();
    ue();
  }
  if (u(1) === 0 || overrun) return null; // timing_info_present_flag
  const unitsInTick = u(32);
  const timeScale = u(32);
  if (overrun || unitsInTick === 0 || timeScale === 0) return null;
  return timeScale / (2 * unitsInTick);
}

/** Width, height and declared frame rate of the first video sample entry of a `moov` held in memory, or null. */
function videoFormatIn(moov: Uint8Array, header: number): VideoStreamFormat | null {
  const child = (from: number, to: number, type: string): readonly [number, number] | null => {
    const found = (children(moov, from, to) ?? []).find(([name]) => name === type);
    return found === undefined ? null : [found[1], found[2]];
  };
  for (const [type, payload, end] of children(moov, header, moov.length) ?? []) {
    if (type !== 'trak') continue;
    const mdia = child(payload, end, 'mdia');
    if (mdia === null) continue;
    const hdlr = child(mdia[0], mdia[1], 'hdlr');
    if (hdlr === null || hdlr[0] + 12 > hdlr[1] || typeOf(moov, hdlr[0] + 8) !== 'vide') continue;
    const minf = child(mdia[0], mdia[1], 'minf');
    const stbl = minf === null ? null : child(minf[0], minf[1], 'stbl');
    const stsd = stbl === null ? null : child(stbl[0], stbl[1], 'stsd');
    if (stsd === null) return null;
    const first = stsd[0] + 8;
    if (first + 36 > stsd[1] || be32(moov, stsd[0] + 4) < 1) return null;
    const width = ((moov[first + 32] ?? 0) << 8) + (moov[first + 33] ?? 0);
    const height = ((moov[first + 34] ?? 0) << 8) + (moov[first + 35] ?? 0);
    if (width <= 0 || height <= 0) return null;
    // The boxes of the entry follow its 78 fixed bytes (`VisualSampleEntry`). `avcC`: version, profile,
    // compatibility, level, NAL length size, then the count of sequence parameter sets (5 bits) and
    // each as a 16-bit length and the NAL unit. The FIRST one is read.
    let frameRate: number | null = null;
    const entrySize = be32(moov, first);
    const entryEnd = first + entrySize;
    if (entrySize >= HEADER + 78 && entryEnd <= stsd[1]) {
      const avcC = child(first + HEADER + 78, entryEnd, 'avcC');
      if (avcC !== null && avcC[0] + 8 <= avcC[1] && ((moov[avcC[0] + 5] ?? 0) & 0x1f) >= 1) {
        const length = ((moov[avcC[0] + 6] ?? 0) << 8) + (moov[avcC[0] + 7] ?? 0);
        if (avcC[0] + 8 + length <= avcC[1]) frameRate = avcDeclaredFrameRate(moov.subarray(avcC[0] + 8, avcC[0] + 8 + length));
      }
    }
    return { width, height, frameRate };
  }
  return null;
}

/**
 * The video stream format a camera file declares, or null when its init segment is not whole or
 * names no video picture size. Reads the top-level box headers up to the `moov` and the `moov`
 * itself: no fragment, no media byte, no key. Decides nothing.
 */
export async function videoStreamFormatOf(source: ByteSource): Promise<VideoStreamFormat | null> {
  for (let at = 0; at < source.size; ) {
    const result = await boxHead(source, at);
    if ('reason' in result || result.head.type === 'moof' || result.head.type === 'mdat') return null;
    if (result.head.type !== 'moov') {
      at += result.head.size;
      continue;
    }
    if (result.head.size > MOOF_READ_LIMIT) return null;
    const moov = await source.read(at, result.head.size);
    if (moov.length !== result.head.size) return null;
    return videoFormatIn(moov, result.head.header);
  }
  return null;
}

// ── Against what was recorded ──────────────────────────────────────────────────────────────────

/** What a `FRAGMENT_CHECKPOINT` record, or a row of `recording_fragments`, says about one fragment's stored bytes. */
export interface RecordedCheckpoint {
  readonly index: number;
  readonly start: number;
  readonly len: number;
  readonly fragSha256: string;
  readonly chainSha256: string;
  /** Not a column of `recording_fragments`: null when the source has none. */
  readonly prefixSha256: string | null;
}

export const CheckpointVerdict = {
  /** Every recorded fragment is in the file, equal in every recorded value, and the file ends where the last one ends. */
  MATCH: 'MATCH',
  /**
   * Equal as far as the records go, and the file holds whole fragments AFTER the last recorded
   * one: written and not (yet) reported - a worker that died between its write and its record.
   * They are whole on the disk now; whether a sync covered them is not known.
   */
  FRAGMENTS_BEYOND_RECORDS: 'FRAGMENTS_BEYOND_RECORDS',
  /** A fragment that was recorded as durable is not whole in the file: bytes that were declared durable are gone. */
  FILE_SHORTER_THAN_RECORDS: 'FILE_SHORTER_THAN_RECORDS',
  /** A recorded value differs from what the bytes give: `firstMismatch` names the fragment (the tamper locator, S1 SP-7). */
  MISMATCH: 'MISMATCH',
  /** The records themselves are not a chain: not numbered 1, 2, 3 ... */
  RECORDS_NOT_CONTIGUOUS: 'RECORDS_NOT_CONTIGUOUS',
} as const;
export type CheckpointVerdict = (typeof CheckpointVerdict)[keyof typeof CheckpointVerdict];

export interface CheckpointComparison {
  readonly verdict: CheckpointVerdict;
  /** How many recorded fragments equal the file, from the first. */
  readonly matched: number;
  readonly firstMismatch: { readonly index: number; readonly member: keyof RecordedCheckpoint } | null;
  /** Whole fragments of the file after the last recorded one. */
  readonly unrecorded: readonly RebuiltFragment[];
  /** Recorded fragments that are not whole in the file. */
  readonly missing: readonly RecordedCheckpoint[];
  /** Spec §C.5: file length == the end of the last recorded fragment. */
  readonly lengthEqualsLastRecordedEnd: boolean;
}

export function compareWithCheckpoints(walk: CameraFileWalk, recorded: readonly RecordedCheckpoint[]): CheckpointComparison {
  const last = recorded.at(-1);
  const lengthEqualsLastRecordedEnd = last !== undefined && walk.fileLength === last.start + last.len;
  const base = { unrecorded: [] as RebuiltFragment[], missing: [] as RecordedCheckpoint[], lengthEqualsLastRecordedEnd };
  if (recorded.some((record, position) => record.index !== position + 1)) {
    return { ...base, verdict: CheckpointVerdict.RECORDS_NOT_CONTIGUOUS, matched: 0, firstMismatch: null };
  }
  const members = ['start', 'len', 'fragSha256', 'chainSha256', 'prefixSha256'] as const;
  let matched = 0;
  for (const record of recorded) {
    const rebuilt = walk.fragments[matched];
    if (rebuilt === undefined) break;
    const member = members.find((name) => (name === 'prefixSha256' && record.prefixSha256 === null ? false : record[name] !== rebuilt[name]));
    if (member !== undefined) return { ...base, verdict: CheckpointVerdict.MISMATCH, matched, firstMismatch: { index: record.index, member } };
    matched += 1;
  }
  if (matched < recorded.length) return { ...base, verdict: CheckpointVerdict.FILE_SHORTER_THAN_RECORDS, matched, firstMismatch: null, missing: recorded.slice(matched) };
  const unrecorded = walk.fragments.slice(matched);
  return { ...base, verdict: unrecorded.length > 0 ? CheckpointVerdict.FRAGMENTS_BEYOND_RECORDS : CheckpointVerdict.MATCH, matched, firstMismatch: null, unrecorded };
}

/** What a camera file is flagged with. A file with no flag may be sealed as it is. */
export const CameraFileFlag = {
  /** The tail is no whole fragment: drop `[durableLength, fileLength)` and seal the durable prefix as interrupted (OD-08). */
  TORN_TAIL: 'TORN_TAIL',
  NO_INIT_SEGMENT: 'NO_INIT_SEGMENT',
  /** The file holds no whole fragment (a final name always has one: the creation rule of the writer). */
  NO_WHOLE_FRAGMENT: 'NO_WHOLE_FRAGMENT',
  FRAGMENTS_BEYOND_RECORDS: 'FRAGMENTS_BEYOND_RECORDS',
  FILE_SHORTER_THAN_RECORDS: 'FILE_SHORTER_THAN_RECORDS',
  CHECKPOINT_MISMATCH: 'CHECKPOINT_MISMATCH',
  RECORDS_NOT_CONTIGUOUS: 'RECORDS_NOT_CONTIGUOUS',
} as const;
export type CameraFileFlag = (typeof CameraFileFlag)[keyof typeof CameraFileFlag];

export interface CameraFileValidation {
  /** True only when the file has no flag at all. */
  readonly ok: boolean;
  readonly flags: readonly CameraFileFlag[];
  readonly walk: CameraFileWalk;
  /** Null when no records were given: the walk alone was asked for. */
  readonly comparison: CheckpointComparison | null;
}

/**
 * THE TAIL VALIDATION OF RECOVERY (spec §C.5, mandatory; erratum AU2-08): every declared box size
 * against the bytes present, the last `moof` followed by a complete `mdat`, and - when the
 * recorded checkpoints are given - file length == the end of the last recorded fragment and every
 * recorded value equal to what the bytes give.
 */
export async function validateCameraFile(source: ByteSource, sha256: Sha256Factory, recorded: readonly RecordedCheckpoint[] | null = null): Promise<CameraFileValidation> {
  const walk = await walkCameraFile(source, sha256);
  const flags: CameraFileFlag[] = [];
  if (walk.state === CameraFileState.NO_INIT_SEGMENT) flags.push(CameraFileFlag.NO_INIT_SEGMENT);
  if (walk.state === CameraFileState.TORN_TAIL) flags.push(CameraFileFlag.TORN_TAIL);
  if (walk.state !== CameraFileState.NO_INIT_SEGMENT && walk.fragments.length === 0) flags.push(CameraFileFlag.NO_WHOLE_FRAGMENT);
  const comparison = recorded === null ? null : compareWithCheckpoints(walk, recorded);
  if (comparison !== null) {
    if (comparison.verdict === CheckpointVerdict.FRAGMENTS_BEYOND_RECORDS) flags.push(CameraFileFlag.FRAGMENTS_BEYOND_RECORDS);
    if (comparison.verdict === CheckpointVerdict.FILE_SHORTER_THAN_RECORDS) flags.push(CameraFileFlag.FILE_SHORTER_THAN_RECORDS);
    if (comparison.verdict === CheckpointVerdict.MISMATCH) flags.push(CameraFileFlag.CHECKPOINT_MISMATCH);
    if (comparison.verdict === CheckpointVerdict.RECORDS_NOT_CONTIGUOUS) flags.push(CameraFileFlag.RECORDS_NOT_CONTIGUOUS);
  }
  return { ok: flags.length === 0, flags, walk, comparison };
}

// ── The `.part` names beside a camera file (pair-58 re-check, navigator B finding R-5) ─────────

/** What the file system says about one name: which file it is (device and inode) and how long. */
export interface NameFacts {
  readonly name: string;
  readonly device: number | bigint;
  readonly inode: number | bigint;
  readonly size: number;
}

export const PartNameKind = {
  /**
   * The same file as the camera file (same device, same inode): the worker was killed between
   * `link()` and `unlink()`. It is a SECOND NAME, NOT A SECOND FILE: it is never hashed, sealed or
   * counted on its own, and removing the NAME removes no byte of the evidence.
   */
  SECOND_NAME_OF_CAMERA_FILE: 'SECOND_NAME_OF_CAMERA_FILE',
  /**
   * A file of its own: a worker died before its first fragment got the final name. No evidence
   * name ever pointed at it and no record ever named it durable; it is reported and left alone.
   */
  ORPHAN_OF_A_DEAD_WORKER: 'ORPHAN_OF_A_DEAD_WORKER',
} as const;
export type PartNameKind = (typeof PartNameKind)[keyof typeof PartNameKind];

export interface PartNameVerdict {
  readonly name: string;
  readonly kind: PartNameKind;
  /** True when removing this NAME cannot remove evidence: the camera file keeps its bytes under its own name. */
  readonly nameMayBeRemoved: boolean;
}

/**
 * Sorts the `<camera file>.<pid>.part` names found beside a camera file. PRECONDITION OF THE
 * WRITER, stated here because recovery depends on it: the evidence volume supports hard links
 * (the writer reaches the final name by `link()`); a second name is therefore expected and
 * harmless, and a volume without hard links fails every session at its first fragment.
 */
export function classifyPartNames(cameraFile: NameFacts | null, parts: readonly NameFacts[]): PartNameVerdict[] {
  return parts.map((part) => {
    const same = cameraFile !== null && BigInt(part.device) === BigInt(cameraFile.device) && BigInt(part.inode) === BigInt(cameraFile.inode);
    return { name: part.name, kind: same ? PartNameKind.SECOND_NAME_OF_CAMERA_FILE : PartNameKind.ORPHAN_OF_A_DEAD_WORKER, nameMayBeRemoved: same };
  });
}
