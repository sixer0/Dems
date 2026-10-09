// A reader of the FRAGMENT STRUCTURE of a fragmented MP4 file, for the check M6-DF-1 (row 77): "no
// dropped capture fragment while STT runs". Test code only. It reads boxes; it decodes no media.
//
// What it reports for one file:
//   - the `mfhd` sequence number of every fragment (`moof`), in file order;
//   - per track, the decode time each fragment STATES for its first sample (`tfdt`) and the sum of
//     the sample durations it carries (`trun` / `tfhd` / `trex` defaults).
//
// What "nothing dropped, nothing duplicated" means here (`judgeFragments`):
//   1. the sequence numbers are one run of consecutive integers (no gap, no repeat, no step back);
//   2. on every track, each fragment starts exactly where the previous fragment of that track
//      ended (`tfdt[i+1] = tfdt[i] + duration[i]`): a dropped fragment leaves a hole in that
//      timeline, a duplicated one overlaps it;
//   3. every `moof` is followed by its `mdat`.
import { readFileSync } from 'node:fs';

export interface TrackRun {
  readonly trackId: number;
  readonly baseDecodeTime: number;
  readonly samples: number;
  /** Sum of the sample durations, or null when the file does not state them. */
  readonly duration: number | null;
}

export interface Fragment {
  readonly offset: number;
  readonly sequence: number;
  readonly tracks: readonly TrackRun[];
  readonly hasMdat: boolean;
}

export interface FragmentReport {
  readonly fragments: readonly Fragment[];
  readonly topLevel: readonly string[];
}

interface Box {
  readonly type: string;
  readonly start: number;
  readonly body: number;
  readonly end: number;
}

function boxesIn(bytes: Buffer, from: number, to: number): Box[] {
  const found: Box[] = [];
  let offset = from;
  while (offset + 8 <= to) {
    let size = bytes.readUInt32BE(offset);
    const type = bytes.toString('latin1', offset + 4, offset + 8);
    let body = offset + 8;
    if (size === 1) {
      size = Number(bytes.readBigUInt64BE(offset + 8));
      body = offset + 16;
    } else if (size === 0) {
      size = to - offset;
    }
    if (size < body - offset || offset + size > to) break; // a cut-off box: the walk ends here
    found.push({ type, start: offset, body, end: offset + size });
    offset += size;
  }
  return found;
}

/** `trex` defaults of the `moov`: track id -> default sample duration. */
function trexDurations(bytes: Buffer, top: readonly Box[]): Map<number, number> {
  const defaults = new Map<number, number>();
  for (const moov of top.filter((box) => box.type === 'moov')) {
    for (const mvex of boxesIn(bytes, moov.body, moov.end).filter((box) => box.type === 'mvex')) {
      for (const trex of boxesIn(bytes, mvex.body, mvex.end).filter((box) => box.type === 'trex')) {
        defaults.set(bytes.readUInt32BE(trex.body + 4), bytes.readUInt32BE(trex.body + 12));
      }
    }
  }
  return defaults;
}

function readTraf(bytes: Buffer, traf: Box, trex: Map<number, number>): TrackRun {
  const children = boxesIn(bytes, traf.body, traf.end);
  const tfhd = children.find((box) => box.type === 'tfhd');
  if (tfhd === undefined) throw new Error('a traf without tfhd');
  const tfhdFlags = bytes.readUInt32BE(tfhd.body) & 0xffffff;
  const trackId = bytes.readUInt32BE(tfhd.body + 4);
  let cursor = tfhd.body + 8;
  if (tfhdFlags & 0x1) cursor += 8; // base data offset
  if (tfhdFlags & 0x2) cursor += 4; // sample description index
  let defaultDuration: number | null = trex.get(trackId) ?? null;
  if (tfhdFlags & 0x8) defaultDuration = bytes.readUInt32BE(cursor);

  const tfdt = children.find((box) => box.type === 'tfdt');
  if (tfdt === undefined) throw new Error('a traf without tfdt');
  const baseDecodeTime = bytes.readUInt8(tfdt.body) === 1 ? Number(bytes.readBigUInt64BE(tfdt.body + 4)) : bytes.readUInt32BE(tfdt.body + 4);

  let samples = 0;
  let duration: number | null = 0;
  for (const trun of children.filter((box) => box.type === 'trun')) {
    const flags = bytes.readUInt32BE(trun.body) & 0xffffff;
    const count = bytes.readUInt32BE(trun.body + 4);
    let at = trun.body + 8;
    if (flags & 0x1) at += 4; // data offset
    if (flags & 0x4) at += 4; // first sample flags
    const perSample = (flags & 0x100 ? 4 : 0) + (flags & 0x200 ? 4 : 0) + (flags & 0x400 ? 4 : 0) + (flags & 0x800 ? 4 : 0);
    samples += count;
    if (flags & 0x100) {
      for (let index = 0; index < count; index += 1) duration = (duration ?? 0) + bytes.readUInt32BE(at + index * perSample);
    } else if (defaultDuration !== null && duration !== null) {
      duration += count * defaultDuration;
    } else {
      duration = null;
    }
  }
  return { trackId, baseDecodeTime, samples, duration };
}

export function readFragmentsOf(bytes: Buffer): FragmentReport {
  const top = boxesIn(bytes, 0, bytes.length);
  const trex = trexDurations(bytes, top);
  const fragments: Fragment[] = [];
  top.forEach((box, index) => {
    if (box.type !== 'moof') return;
    const children = boxesIn(bytes, box.body, box.end);
    const mfhd = children.find((child) => child.type === 'mfhd');
    if (mfhd === undefined) throw new Error('a moof without mfhd');
    fragments.push({
      offset: box.start,
      sequence: bytes.readUInt32BE(mfhd.body + 4),
      tracks: children.filter((child) => child.type === 'traf').map((traf) => readTraf(bytes, traf, trex)),
      hasMdat: top[index + 1]?.type === 'mdat',
    });
  });
  return { fragments, topLevel: top.map((box) => box.type) };
}

export function readFragments(path: string): FragmentReport {
  return readFragmentsOf(readFileSync(path));
}

export interface FragmentVerdict {
  readonly ok: boolean;
  readonly fragments: number;
  readonly firstSequence: number | null;
  readonly lastSequence: number | null;
  /** Each finding names what is wrong and where; empty when `ok`. */
  readonly findings: readonly string[];
  readonly samplesPerTrack: Readonly<Record<string, number>>;
}

export function judgeFragments(report: FragmentReport): FragmentVerdict {
  const findings: string[] = [];
  const { fragments } = report;
  if (fragments.length === 0) findings.push('NO_FRAGMENT');
  const seen = new Set<number>();
  fragments.forEach((fragment, index) => {
    if (seen.has(fragment.sequence)) findings.push(`DUPLICATED_SEQUENCE ${fragment.sequence} at fragment ${index}`);
    seen.add(fragment.sequence);
    const previous = fragments[index - 1];
    if (previous !== undefined && fragment.sequence !== previous.sequence + 1) findings.push(`SEQUENCE_NOT_CONSECUTIVE ${previous.sequence} -> ${fragment.sequence} at fragment ${index}`);
    if (!fragment.hasMdat) findings.push(`MOOF_WITHOUT_MDAT at fragment ${index}`);
  });
  const lastOfTrack = new Map<number, { fragment: number; end: number | null }>();
  const samplesPerTrack: Record<string, number> = {};
  fragments.forEach((fragment, index) => {
    for (const run of fragment.tracks) {
      samplesPerTrack[String(run.trackId)] = (samplesPerTrack[String(run.trackId)] ?? 0) + run.samples;
      const previous = lastOfTrack.get(run.trackId);
      if (previous !== undefined) {
        if (previous.end === null) findings.push(`DURATION_NOT_STATED track ${run.trackId} at fragment ${previous.fragment}`);
        else if (run.baseDecodeTime > previous.end) findings.push(`TIMELINE_GAP track ${run.trackId} before fragment ${index}: ${run.baseDecodeTime - previous.end} units missing`);
        else if (run.baseDecodeTime < previous.end) findings.push(`TIMELINE_OVERLAP track ${run.trackId} at fragment ${index}: ${previous.end - run.baseDecodeTime} units repeated`);
      }
      lastOfTrack.set(run.trackId, { fragment: index, end: run.duration === null ? null : run.baseDecodeTime + run.duration });
    }
  });
  return {
    ok: findings.length === 0,
    fragments: fragments.length,
    firstSequence: fragments[0]?.sequence ?? null,
    lastSequence: fragments[fragments.length - 1]?.sequence ?? null,
    findings,
    samplesPerTrack,
  };
}

/** A copy of the file bytes without fragment `index` (its `moof` and the `mdat` after it): the negative control "one dropped". */
export function withoutFragment(bytes: Buffer, index: number): Buffer {
  const top = boxesIn(bytes, 0, bytes.length);
  const moofs = top.filter((box) => box.type === 'moof');
  const moof = moofs[index];
  if (moof === undefined) throw new Error('no such fragment');
  const mdat = top[top.indexOf(moof) + 1];
  const end = mdat?.type === 'mdat' ? mdat.end : moof.end;
  return Buffer.concat([bytes.subarray(0, moof.start), bytes.subarray(end)]);
}

/** A copy of the file bytes with fragment `index` written twice: the negative control "one duplicated". */
export function withFragmentTwice(bytes: Buffer, index: number): Buffer {
  const top = boxesIn(bytes, 0, bytes.length);
  const moof = top.filter((box) => box.type === 'moof')[index];
  if (moof === undefined) throw new Error('no such fragment');
  const mdat = top[top.indexOf(moof) + 1];
  const end = mdat?.type === 'mdat' ? mdat.end : moof.end;
  return Buffer.concat([bytes.subarray(0, end), bytes.subarray(moof.start, end), bytes.subarray(end)]);
}
