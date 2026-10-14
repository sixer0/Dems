/**
 * THE WORDS OF AN AUDIO PATH THAT IS NOT SAMPLE-CONTINUOUS (task 4 row N2; design
 * `masterplan/06_design_macos_microphone.md` revision 3, sections 6.2, 8.3, 8.6; decisions U25 (3),
 * C107, C110 rulings (2) and (4), C112; SM-30 (5), SM-32, SM-34, SM-38).
 *
 * WHAT IT IS ABOUT. The production microphone path of a Mac (the bench form; not the hardened Linux
 * form) does not deliver every sample of the microphone: about one sample in ten did not arrive in
 * the measurements. The recorder counts what arrived and what it inserted, and the Core states it -
 * to the operator while the session runs (five advisory notices), in the audit log, under the
 * signature of the package (`audio.samplesNotReceived`) and at the head of a transcript. On that
 * path PRIMARY and STANDBY are two channels of ONE device recorded by ONE capture program.
 *
 * ONE WORDING SOURCE. The English block `common.audioNotSampleContinuous` and `common.micSameDevice`
 * of the i18n resources ARE the tables below (imported, not copied), and the sentences of the five
 * notices in `capture-fault-wording.ts` are built from the constants here, so a notice, a screen and
 * a document cannot say two things.
 *
 * THE SIMULATOR STATES NONE OF THIS: no simulated device is on such a path.
 *
 * This file imports nothing: it is read by the simulator's wording table, by the i18n resources and
 * by the clients.
 */

/**
 * THE FIXED SENTENCE (SM-30 (5)): the ONLY wording for where the inserted silence stands, in every
 * document, notice, screen and comment. No text says the silence stands at or near the missing sound.
 */
export const AUDIO_INSERTED_SILENCE_SENTENCE = 'Sound that did not arrive is not in the recording. Silence of the same total length was inserted by the recorder; its places are not the places of the missing sound.';

/** The window the two shortfall notices measure over (the Core cuts it from the worker's counts): 10 s. */
export const MIC_SHORTFALL_WINDOW_SECONDS = 10;
/** THE FLOOR of `MIC_SAMPLES_SHORT_ABOVE_BOUND`, in parts per 100,000 of a window: 12.0%. The Core holds its own constant equal to this one. */
export const MIC_SHORTFALL_FLOOR_PER_100K = 12_000;

/**
 * A shortfall as the operator reads it: parts per 100,000 as a percentage with ONE decimal, cut
 * (never rounded up): 12,000 reads "12.0", 9,476 reads "9.4". Anything that is no whole number of
 * 0 to 100,000 gives null - the sentence is then said without a number, never with a raw placeholder.
 */
export function shortfallPercentText(per100k: unknown): string | null {
  if (typeof per100k !== 'number' || !Number.isSafeInteger(per100k) || per100k < 0 || per100k > 100_000) return null;
  const tenths = Math.floor(per100k / 100);
  return `${String(Math.floor(tenths / 10))}.${String(tenths % 10)}`;
}

/** The longest run a notice states in ms: one day. A larger number is a fault of the count, not a measurement. */
export const MIC_SILENCE_RUN_MAX_MS = 86_400_000;

/**
 * THE WORDS THE OPERATOR READS FOR A PRIMARY / STANDBY PAIR ON ONE DEVICE (design section 6.2; SM-34
 * (1), (4), (6)). The role keeps its contract name `STANDBY`; the operator never reads the bare word
 * for such a pair. A client shows these INSTEAD of the plain texts when PRIMARY and STANDBY resolve
 * to one device (the same USB id and serial, or without a serial the same port), at the assignment,
 * at the pre-check, during the session and in the session's summary; the plain texts stay for two
 * devices. The pair is never called "redundant".
 *
 *   role             the short role label        (plain: `devices.selector.role.STANDBY`)
 *   slot             the long label of the slot  (plain: `common.captureSlot.STANDBY`)
 *   line             the assignment line         (plain: `devices.micLines.label.STANDBY`)
 *   source           the session's source label  (plain: `sessionNew` `MIC_STANDBY`)
 *   joinsAtNextStart a microphone opened after its device's capture program was started is refused
 *   switchRefused    a switch to the STANDBY asked for when that capture program has ended
 */
export const MIC_SAME_DEVICE_WORDS = {
  role: 'Second channel',
  slot: 'Second channel of the same device',
  line: 'Microphone for the standby line - second channel of the same device',
  source: 'MIC (second channel of the same device)',
  joinsAtNextStart: "Both microphones of one device are started together. This microphone joins at the next start of the session's microphones.",
  switchRefused: 'The capture program of this device has ended. Both of its channels are gone; the second channel cannot bring the audio back.',
} as const;

/**
 * THE WORDS OF THE STATEMENT A CLIENT SHOWS AT THE HEAD OF A TRANSCRIPT, of an evidence item and of
 * a session summary whose audio is not sample-continuous (design section 8.6; SM-37 (3), SM-38).
 * Never collapsed. `{{...}}`: whole samples and counts of the answer's `audioNotSampleContinuous`.
 *
 *   title        the heading
 *   sentence     THE FIXED SENTENCE
 *   measured     the numbers, when the recorder's account closed the track
 *   measuredTo   the numbers, when the account reaches a sample only
 *   notMeasured  no number was measured
 *   runs         the runs of 100 ms or more
 *   segment      THE MARK ON A SEGMENT (`insertedSilenceMs`), before the speaker mark
 *   transcript   what a transcript of such audio is not
 */
export const AUDIO_NOT_SAMPLE_CONTINUOUS_WORDS = {
  title: 'Audio is not sample-continuous',
  sentence: AUDIO_INSERTED_SILENCE_SENTENCE,
  measured: '{{arrived}} of {{track}} samples of the track arrived; {{inserted}} are inserted silence, not sound.',
  measuredTo: 'Measured up to sample {{track}} only: {{arrived}} arrived; {{inserted}} are inserted silence. The rest of the track was not measured.',
  notMeasured: 'How much sound did not arrive was not measured.',
  runs: 'Runs of inserted silence of 100 ms or more: {{listed}} listed, {{notListed}} not listed.',
  segment: '[inserted silence {{ms}} ms]',
  transcript: 'This transcript was made from that audio: it does not hold what was said while no sound arrived.',
} as const;
