/**
 * The name of a microphone input on the tablet and the phone, from the id the Core sends
 * (integration pass D2, item 5; decisions D106 (4), D115 (2), D133 (1); ux spec §8f.1).
 *
 * The shared contract's microphone id is the numbered form `MIC-NN` — the built-in pair `MIC-01` /
 * `MIC-02` and any microphone registered later (`MIC-03` is the local microphone of the development
 * operation). No screen may index microphones by the two literals; this module is the one rule:
 *
 * | The Core sent | Name |
 * |---|---|
 * | a device whose badge kind is the local microphone (`sourceClass: DEVELOPMENT`, `adapter: LOCAL_DEVICE`, Live mode) | "Core Mac's microphone" (D83, OP-125-7) |
 * | `MIC-01`, `MIC-02` | "MIC 1", "MIC 2" — the words these screens already use |
 * | `MIC-NN` | "Microphone N" (`common.captureDeviceName.microphone`) |
 * | anything else | the id as sent |
 *
 * Pure: the translate function and the device facts are handed in. Ids are typed `string`, so this
 * compiles against the contract before and after its mic id is widened.
 */
import type { DevelopmentSourceKind } from './capture-notices-model';

/** `MIC-NN` (the shared `MIC_INPUT_ID_PATTERN`, with the number captured). */
const MIC_INPUT_ID = /^MIC-(\d{2,})$/;

export type MicNameTranslate = (key: string, options?: Record<string, unknown>) => string;

/** The number of a microphone id (`MIC-03` -> 3), or null when the text is no microphone id. */
export function micInputNumber(inputId: string): number | null {
  const match = MIC_INPUT_ID.exec(inputId);
  if (match === null) return null;
  const number = Number(match[1]);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

/** True for a text that is a microphone input id. */
export function isMicInputId(value: unknown): value is string {
  return typeof value === 'string' && micInputNumber(value) !== null;
}

/**
 * The name of a microphone input. `source` is the badge kind of its device as `developmentSourceOf`
 * decided it (null or absent: no development class was sent, or Simulated mode).
 */
export function micInputName(t: MicNameTranslate, inputId: string, source?: DevelopmentSourceKind | null): string {
  if (source === 'localMicrophone') return t('features.capture-selector.source.kind.localMicrophone');
  const number = micInputNumber(inputId);
  if (number === null) return inputId;
  if (number === 1) return t('common.devices.mic1');
  if (number === 2) return t('common.devices.mic2');
  return t('common.captureDeviceName.microphone', { number });
}
