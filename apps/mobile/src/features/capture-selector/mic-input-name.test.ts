// Integration pass D2, item 5 — microphones are named and paired by the id the Core sends, never by
// the two literals (decisions D106 (4), D115 (2), D133 (1); ux spec §8f.1). The ids here are plain
// strings: the file compiles against the contract before and after its mic id is widened.
import { describe, expect, it } from '@jest/globals';
import { i18n } from '@/i18n';
import { deviceLabel } from './capture-notices-model';
import { isMicInputId, micInputName, micInputNumber } from './mic-input-name';

const t = (key: string, options?: Record<string, unknown>): string => i18n.t(key, options ?? {});

describe('the number of a microphone id', () => {
  it('reads `MIC-NN` of any number and nothing else', () => {
    expect(micInputNumber('MIC-01')).toBe(1);
    expect(micInputNumber('MIC-03')).toBe(3);
    expect(micInputNumber('MIC-12')).toBe(12);
    expect(micInputNumber('MIC-104')).toBe(104);
    for (const other of ['MIC-3', 'MIC-00', 'CAM-03', 'AUDIO-01', 'mic-03', 'MIC-03 ', '']) expect(micInputNumber(other)).toBeNull();
    expect(isMicInputId('MIC-03')).toBe(true);
    expect(isMicInputId(null)).toBe(false);
    expect(isMicInputId(3)).toBe(false);
  });
});

describe('the name of a microphone input', () => {
  it('keeps the words of the built-in pair and names a third microphone by its number', () => {
    expect(micInputName(t, 'MIC-01')).toBe('MIC 1');
    expect(micInputName(t, 'MIC-02')).toBe('MIC 2');
    expect(micInputName(t, 'MIC-03')).toBe('MIC 3');
    expect(micInputName(t, 'MIC-11')).toBe('MIC 11');
  });

  it('says "Core Mac\'s microphone" when the Core says the device is its local microphone (D83), and only then', () => {
    expect(micInputName(t, 'MIC-03', 'localMicrophone')).toBe("Core Mac's microphone");
    expect(micInputName(t, 'MIC-01', 'localMicrophone')).toBe("Core Mac's microphone");
    // A test source keeps its numbered name: the badge beside it says what it is.
    expect(micInputName(t, 'MIC-03', 'test')).toBe('MIC 3');
    expect(micInputName(t, 'MIC-03', null)).toBe('MIC 3');
  });

  it('an id that is no microphone id is shown as sent', () => {
    expect(micInputName(t, 'LINE-IN')).toBe('LINE-IN');
  });

  it('a notification names a third microphone with its label and its id', () => {
    expect(deviceLabel(t, 'MIC-03')).toBe('MIC 3 (MIC-03)');
    expect(deviceLabel(t, 'MIC-02')).toBe('MIC 2 (MIC-02)');
    expect(deviceLabel(t, 'CAM-07')).toBe('CAM-07');
  });
});
