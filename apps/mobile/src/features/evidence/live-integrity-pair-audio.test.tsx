/**
 * Audit 2026-11-05 row 207 (M3-16 R1/R2/R4; register E7, E8, E10; the web's row 159 block `pair-audio.tsx`):
 * the Live integrity tab lists the pair audio files AUDIO-0N of a `/2.1` item apart from its camera files, each
 * "in VIDEO-0N" (pair by number, "in" only when that camera file is in the item), and the item's signed
 * `audioTracksMissing` statement. A legacy item draws exactly what it drew before.
 *
 * The file sets are the RECORDED D5 packages of row 206's fixture (`RECORDED_VERIFY_V2_D5`, the real verifier
 * over three /2.1 packages). An op 41 answer carries no file hash, so the item's hashes are stand-ins (H(...)).
 *
 * | Rule | Case |
 * |------|------|
 * | recorded d5Pass item: 4 audio rows "AUDIO-0N · audio of Pair N, in VIDEO-0N" with their hashes; camera rows VIDEO-01..04 unchanged; no AUDIO-0N "sealed file" row (R1) | 1 (tablet + phone) |
 * | recorded d5MicMissing item: the statement in words (E8), silent VIDEO-02, the note (R2) | 2 |
 * | E10: an audio file whose camera file is not in the item says so | 3 |
 * | LEGACY: a /2 camera-only item and a v1 demo item draw no pair-audio block, the same rows as before (R4) | 4, 5 |
 */
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';
import { fireEvent, screen } from '@testing-library/react-native';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';
import { resetLiveEvidenceBed, type LiveEvidenceBed } from './testing/live-evidence-bed';
import { H, bedWith, openItem, realItem, textUnder, type ItemChange } from './testing/real-item-kit';
import { RECORDED_VERIFY_V2_D5, type RecordedVerifyD5Name } from './testing/verify-v2-recorded-d5';

unmountBeforeTheHooksOfThisGroup();
let bed: LiveEvidenceBed | null = null;

beforeEach(async () => {
  resetMissingKeys();
  await resetLiveEvidenceBed();
});
afterEach(() => {
  bed?.stop();
  bed = null;
  expect(getMissingKeys()).toEqual([]);
});

const CAMERAS = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04'] as const;
/** The recorded file set of a D5 package, as item `files` (hex stand-in hashes: H('0'), H('1'), ... in file order). */
const recordedFiles = (name: RecordedVerifyD5Name, drop: readonly string[] = []) =>
  (RECORDED_VERIFY_V2_D5[name].body['files'] as { fileId: string; trackId: string; fragmentCount: number }[])
    .map((file, index) => ({ trackId: file.trackId, fileName: file.fileId, sizeBytes: 1_000 + index, sha256: H(index.toString(16)), fragmentCount: file.fragmentCount }))
    .filter((file) => !drop.includes(file.trackId));
const MIC_02_NOT_ASSIGNED = [{ trackId: 'AUDIO-02', micDeviceId: null, silentIn: ['VIDEO-02'], reason: 'NOT_ASSIGNED' }];

async function integrityOf(change: ItemChange | null, suffix = '0001', window: 'tabletLandscape' | 'phonePortrait' = 'phonePortrait', media: 'NONE' | 'default' = 'NONE'): Promise<string> {
  const { b, id } = await bedWith(suffix, change, { window });
  bed = b;
  if (media === 'NONE') b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
  await openItem(b, id);
  fireEvent.press(screen.getByTestId('evidence-tab-integrity'));
  await b.flush();
  return textUnder('evidence-integrity');
}

describe('row 207 (M3-16): the pair audio of an item on the Live integrity tab', () => {
  it.each([
    { layout: 'tablet', window: 'tabletLandscape' },
    { layout: 'phone', window: 'phonePortrait' },
  ] as const)('1 - $layout: a recorded D5 item lists 4 audio rows "in VIDEO-0N" with their own hashes, apart from the 4 camera rows', async ({ window }) => {
    await integrityOf(realItem({ files: recordedFiles('d5Pass') }, { cameras: CAMERAS }), '0001', window);
    for (const camera of CAMERAS) expect(screen.getByTestId(`evidence-sealed-file-${camera}`)).toBeTruthy();
    expect(screen.getByTestId('evidence-pair-audio-title')).toHaveTextContent('Audio files of the camera-microphone pairs');
    for (const n of [1, 2, 3, 4]) {
      expect(screen.getByTestId(`evidence-pair-audio-AUDIO-0${n}-label`)).toHaveTextContent(`AUDIO-0${n} · audio of Pair ${n}, in VIDEO-0${n}`);
      expect(screen.getByTestId(`evidence-pair-audio-AUDIO-0${n}-hash`)).toHaveTextContent(H(String(n + 3)));
      // R1: an audio file is never listed as a camera "sealed file".
      expect(screen.queryByTestId(`evidence-sealed-file-AUDIO-0${n}`)).toBeNull();
    }
    expect(screen.queryByTestId('evidence-audio-missing')).toBeNull();
  }, 30_000);

  it('2 - a recorded D5 item whose MIC-02 was not assigned shows the statement: no microphone on MIC-02, VIDEO-02 silent, signed', async () => {
    await integrityOf(realItem({ files: recordedFiles('d5MicMissing'), audioTracksMissing: MIC_02_NOT_ASSIGNED }, { cameras: CAMERAS }));
    expect(screen.getByTestId('evidence-audio-missing')).toHaveTextContent(/Pair microphones that did not record/);
    expect(screen.getByTestId('evidence-audio-missing-AUDIO-02')).toHaveTextContent(
      'AUDIO-02 (Pair 2): no microphone was assigned to MIC-02. VIDEO-02 holds a silent audio track: that silence is not the sound of the room.',
    );
    expect(screen.getByTestId('evidence-audio-missing-note')).toHaveTextContent('Stated in the signed manifest. The recording went on without this microphone.');
    expect(screen.queryByTestId('evidence-pair-audio-AUDIO-02')).toBeNull();
    for (const n of [1, 3, 4]) expect(screen.getByTestId(`evidence-pair-audio-AUDIO-0${n}-label`)).toHaveTextContent(`AUDIO-0${n} · audio of Pair ${n}, in VIDEO-0${n}`);
  }, 30_000);

  it('3 - E10: AUDIO-03 of an item without VIDEO-03 says the camera file is not in the package', async () => {
    await integrityOf(realItem({ files: recordedFiles('d5Pass', ['VIDEO-03']) }, { cameras: ['VIDEO-01', 'VIDEO-02', 'VIDEO-04'] }));
    expect(screen.getByTestId('evidence-pair-audio-AUDIO-03-label')).toHaveTextContent('AUDIO-03 · audio of Pair 3 (camera file VIDEO-03 is not in the package)');
    expect(screen.getByTestId('evidence-pair-audio-AUDIO-04-label')).toHaveTextContent('AUDIO-04 · audio of Pair 4, in VIDEO-04');
  }, 30_000);

  it('4 - LEGACY: a camera-only v2 item draws no pair-audio block; its camera rows are as before', async () => {
    const text = await integrityOf(realItem());
    expect(screen.getByTestId('evidence-sealed-file-VIDEO-01')).toBeTruthy();
    expect(screen.getByTestId('evidence-sealed-file-VIDEO-02')).toBeTruthy();
    expect(screen.queryByTestId('evidence-pair-audio')).toBeNull();
    expect(screen.queryByTestId('evidence-audio-missing')).toBeNull();
    expect(text).not.toMatch(/audio of Pair|Pair microphones|silent audio track/);
  }, 30_000);

  it('5 - LEGACY: a v1 demo item keeps its four track rows and draws no pair-audio block', async () => {
    await integrityOf(null, '0002', 'phonePortrait', 'default');
    expect(screen.getByTestId('evidence-track-AUDIO-02')).toBeTruthy();
    expect(screen.queryByTestId('evidence-sealed-values')).toBeNull();
    expect(screen.queryByTestId('evidence-pair-audio')).toBeNull();
  }, 30_000);
});
