// Blueprint row 92 (M8-W3): the schema-v2 members of an evidence item, read defensively, and the
// rule of the item badge "Development source" (R-11; UX §8f.2; decisions D83, D91). The web console
// holds the same cases for its own copy of the reader.
import { describe, expect, it } from '@jest/globals';
import { EXAMPLE_EVIDENCE_ITEM, EvidenceItemSchema } from '@dems/shared/api';
import { cameraFileOf, itemDevelopmentBadge, readItemV2 } from './item-v2';

const H = (char: string): string => char.repeat(64);
const V1_ITEM: Record<string, unknown> = { ...EXAMPLE_EVIDENCE_ITEM };
const V2_MEMBERS = {
  files: [
    { trackId: 'VIDEO-01', fileName: 'fragments/VIDEO-01.mp4', sizeBytes: 4_000, sha256: H('a'), sha256Plain: H('b'), fragmentCount: 5, fragmentChainHead: H('c') },
    { trackId: 'VIDEO-02', fileName: 'fragments/VIDEO-02.mp4', sizeBytes: 4_100, sha256: H('d'), fragmentCount: 5 },
  ],
  transcriptSha256: H('e'),
  manifestVersion: 2,
  labelsStatus: 'UNAVAILABLE',
  developmentSources: true,
  audioSourceIntervals: [
    { seq: 1, inputId: 'MIC-01', role: 'PRIMARY', fromMs: 0, toMs: 30_000, reason: 'START' },
    { seq: 2, inputId: 'MIC-02', role: 'STANDBY', fromMs: 30_000, toMs: null, reason: 'MANUAL' },
  ],
  transcript: { state: 'PARTIAL', sha256: H('e'), machineTranscriptHash: H('e'), labelsStatus: 'UNAVAILABLE', revision: 2, failedChunks: 3, backendUnreachable: true },
};

describe('the reader', () => {
  it('a v1 item: not v2, no file, no interval, no transcript, sources NOT RECORDED', () => {
    expect(readItemV2(V1_ITEM)).toMatchObject({ isV2: false, files: [], audioIntervals: [], transcript: null, developmentSources: null, manifestVersion: null });
  });

  it('a v2 item as the contract carries it: files with both hashes, intervals, the transcript summary', () => {
    const item = { ...V1_ITEM, ...V2_MEMBERS };
    expect(EvidenceItemSchema.safeParse(item).success).toBe(true);
    const v2 = readItemV2(item);
    expect(v2.isV2).toBe(true);
    expect(cameraFileOf(v2, 'VIDEO-01')).toEqual({ trackId: 'VIDEO-01', fileName: 'fragments/VIDEO-01.mp4', sizeBytes: 4_000, sha256: H('a'), sha256Plain: H('b'), fragmentCount: 5, fragmentChainHead: H('c') });
    expect(cameraFileOf(v2, 'VIDEO-02')).toMatchObject({ sha256: H('d'), sha256Plain: null, fragmentChainHead: null });
    expect(v2.audioIntervals).toEqual([
      { seq: 1, inputId: 'MIC-01', fromMs: 0, toMs: 30_000, reason: 'START' },
      { seq: 2, inputId: 'MIC-02', fromMs: 30_000, toMs: null, reason: 'MANUAL' },
    ]);
    expect(v2.transcript).toEqual({ state: 'PARTIAL', sha256: H('e'), machineTranscriptHash: H('e'), labelsStatus: 'UNAVAILABLE', revision: 2, failedChunks: 3, backendUnreachable: true });
    expect([v2.transcriptSha256, v2.labelsStatus, v2.manifestVersion, v2.developmentSources]).toEqual([H('e'), 'UNAVAILABLE', 2, true]);
  });

  it('never throws; a member that cannot be read is dropped, and a list with a hole is no list', () => {
    for (const value of [null, undefined, 'EV-1', 7, [], { files: 'none', audioSourceIntervals: {}, transcript: [], signature: 1 }]) {
      expect(readItemV2(value)).toMatchObject({ isV2: false, files: [], audioIntervals: [], transcript: null, developmentSources: null });
    }
    expect(readItemV2({ files: [{ trackId: 'VIDEO-01', sha256: 'abc' }, V2_MEMBERS.files[1], null] }).files.map((file) => file.trackId)).toEqual(['VIDEO-02']);
    const good = V2_MEMBERS.audioSourceIntervals;
    for (const bad of [{ seq: 3, inputId: 'CAM-01', fromMs: 0, toMs: 5 }, { seq: 3, inputId: 'MIC-01', fromMs: 9, toMs: 5 }, { inputId: 'MIC-01', fromMs: 0, toMs: 5 }, 'MIC-01']) {
      expect(readItemV2({ audioSourceIntervals: [...good, bad] }).audioIntervals).toEqual([]);
    }
    // CONTROL: the good ones alone are read, and an input beyond the pair (MIC-03) is an input.
    expect(readItemV2({ audioSourceIntervals: [...good, { seq: 3, inputId: 'MIC-03', fromMs: 40_000, toMs: 50_000, reason: 'MANUAL' }] }).audioIntervals).toHaveLength(3);
    expect(readItemV2({ transcript: { ...V2_MEMBERS.transcript, state: 'FINE' } }).transcript).toBeNull();
  });
});

describe('developmentSources (R-11): null is never production', () => {
  it('only the booleans are read; every other value is null', () => {
    expect(readItemV2({ developmentSources: true }).developmentSources).toBe(true);
    expect(readItemV2({ developmentSources: false }).developmentSources).toBe(false);
    for (const value of [null, undefined, 'true', 'false', 1, 0, 'PRODUCTION', {}]) expect(readItemV2({ developmentSources: value }).developmentSources).toBeNull();
    expect(readItemV2({}).developmentSources).toBeNull();
  });

  it('the item badge is drawn only for `true`, and only on Live data', () => {
    expect(itemDevelopmentBadge({ developmentSources: true }, true)).toBe(true);
    expect(itemDevelopmentBadge({ developmentSources: true }, false)).toBe(false);
    for (const live of [true, false]) {
      expect(itemDevelopmentBadge({ developmentSources: false }, live)).toBe(false);
      expect(itemDevelopmentBadge({ developmentSources: null }, live)).toBe(false);
    }
  });
});
