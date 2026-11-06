// Blueprint row 92 (M8-W3): the schema-v2 members of an evidence item, read defensively, and the
// rule of the item badge "Development source" (R-11; UX §8f.2; decisions D83, D91). The web console
// holds the same cases for its own copy of the reader.
import { describe, expect, it } from '@jest/globals';
import { EXAMPLE_EVIDENCE_ITEM, EvidenceItemSchema } from '@dems/shared/api';
import { CAMERA_FILE_IDS, cameraFileOf, itemDevelopmentBadge, readItemV2 } from './item-v2';
import { RECORDED_VERIFY_V2_D5, type RecordedVerifyD5Name } from './testing/verify-v2-recorded-d5';

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
      // Fix wave K (G94b-07): the interval's own source class is kept; this item states none.
      { seq: 1, inputId: 'MIC-01', fromMs: 0, toMs: 30_000, reason: 'START', sourceClass: null },
      { seq: 2, inputId: 'MIC-02', fromMs: 30_000, toMs: null, reason: 'MANUAL', sourceClass: null },
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

// Audit 2026-11-05 row 207 (M3-16 R1/R2/R4; register E7, E10; the web's row 159 cases, describe "row 159 (D5)").
// The file sets are the RECORDED D5 packages of row 206's fixture (`RECORDED_VERIFY_V2_D5`: the real verifier
// over three /2.1 packages). An op 41 answer carries no file hash, so the hashes below are hex stand-ins (H('0')..H('7') in file order).
//
// | Rule | Case |
// |------|------|
// | recorded d5Pass: four AUDIO-0N, each the audio of pair N, "in VIDEO-0N"; the camera reader still names four cameras (R4) | 1 |
// | recorded d5MicMissing (MIC-02 not assigned): three audio files + one statement, silent VIDEO-02 | 2 |
// | E10: an audio file whose camera file is not in the item is not said to be "in" it | 3 |
// | a statement that cannot be read whole is no statement | 4 |
// | LEGACY: a /2 item and a v1 item state neither | 5 |
describe('row 207 (M3-16): the pair audio files and the missing-microphone statement of an item', () => {
  const recordedFiles = (name: RecordedVerifyD5Name) =>
    (RECORDED_VERIFY_V2_D5[name].body['files'] as { fileId: string; trackId: string; fragmentCount: number }[]).map((file, index) => ({
      trackId: file.trackId,
      fileName: file.fileId,
      sizeBytes: 1_000 + index,
      sha256: H(index.toString(16)),
      fragmentCount: file.fragmentCount,
    }));
  const MIC_02_NOT_ASSIGNED = [{ trackId: 'AUDIO-02', micDeviceId: null, silentIn: ['VIDEO-02'], reason: 'NOT_ASSIGNED' }];

  it('1 - recorded d5Pass: AUDIO-01..04 are the audio of pairs 1..4, each in VIDEO-0N; the item parses; cameraFileOf still names the four cameras', () => {
    const item = { ...V1_ITEM, ...V2_MEMBERS, files: recordedFiles('d5Pass') };
    expect(EvidenceItemSchema.safeParse(item).success).toBe(true);
    const v2 = readItemV2(item);
    expect(v2.pairAudioFiles.map((a) => [a.trackId, a.pair, a.camera, a.inCamera])).toEqual([
      ['AUDIO-01', 1, 'VIDEO-01', 'VIDEO-01'],
      ['AUDIO-02', 2, 'VIDEO-02', 'VIDEO-02'],
      ['AUDIO-03', 3, 'VIDEO-03', 'VIDEO-03'],
      ['AUDIO-04', 4, 'VIDEO-04', 'VIDEO-04'],
    ]);
    expect(v2.pairAudioFiles.map((a) => a.file.sha256)).toEqual([H('4'), H('5'), H('6'), H('7')]);
    expect(v2.audioTracksMissing).toEqual([]);
    expect(CAMERA_FILE_IDS.map((id) => cameraFileOf(v2, id)?.trackId)).toEqual(['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04']);
  });

  it('2 - recorded d5MicMissing: three audio files and the statement (AUDIO-02, pair 2, no microphone, silent in VIDEO-02)', () => {
    const item = { ...V1_ITEM, ...V2_MEMBERS, files: recordedFiles('d5MicMissing'), audioTracksMissing: MIC_02_NOT_ASSIGNED };
    expect(EvidenceItemSchema.safeParse(item).success).toBe(true);
    const v2 = readItemV2(item);
    expect(v2.pairAudioFiles.map((a) => a.trackId)).toEqual(['AUDIO-01', 'AUDIO-03', 'AUDIO-04']);
    expect(v2.audioTracksMissing).toEqual([{ trackId: 'AUDIO-02', pair: 2, camera: 'VIDEO-02', micDeviceId: null, silentIn: 'VIDEO-02', reason: 'NOT_ASSIGNED' }]);
  });

  it('3 - E10: AUDIO-03 without VIDEO-03 in the item is pair 3 but in no camera file', () => {
    const files = recordedFiles('d5Pass').filter((file) => file.trackId !== 'VIDEO-03');
    const v2 = readItemV2({ files });
    expect(v2.pairAudioFiles.find((a) => a.trackId === 'AUDIO-03')).toMatchObject({ pair: 3, camera: 'VIDEO-03', inCamera: null });
    expect(v2.pairAudioFiles.find((a) => a.trackId === 'AUDIO-04')).toMatchObject({ inCamera: 'VIDEO-04' });
  });

  it('4 - a statement with one unreadable entry is no statement (never guessed)', () => {
    const files = recordedFiles('d5MicMissing');
    for (const bad of [
      [...MIC_02_NOT_ASSIGNED, { trackId: 'AUDIO-09', micDeviceId: null, silentIn: [], reason: 'NOT_ASSIGNED' }],
      [{ trackId: 'AUDIO-02', micDeviceId: 'MIC-04', silentIn: ['VIDEO-02'], reason: 'NOT_ASSIGNED' }],
      [{ trackId: 'AUDIO-02', micDeviceId: null, silentIn: ['VIDEO-02'], reason: 'NOT_OPENED' }],
      [{ trackId: 'AUDIO-02', micDeviceId: null, silentIn: ['VIDEO-03'], reason: 'NOT_ASSIGNED' }],
      [...MIC_02_NOT_ASSIGNED, ...MIC_02_NOT_ASSIGNED],
      'AUDIO-02',
    ]) expect(readItemV2({ files, audioTracksMissing: bad }).audioTracksMissing).toEqual([]);
    expect(readItemV2({ files, audioTracksMissing: [{ trackId: 'AUDIO-02', micDeviceId: 'MIC-04', silentIn: [], reason: 'NOT_OPENED' }] }).audioTracksMissing).toEqual([
      { trackId: 'AUDIO-02', pair: 2, camera: 'VIDEO-02', micDeviceId: 'MIC-04', silentIn: null, reason: 'NOT_OPENED' },
    ]);
  });

  it('5 - LEGACY: a /2 item (camera files only) and a v1 item state neither', () => {
    for (const item of [{ ...V1_ITEM, ...V2_MEMBERS }, V1_ITEM]) expect(readItemV2(item)).toMatchObject({ pairAudioFiles: [], audioTracksMissing: [] });
  });
});
