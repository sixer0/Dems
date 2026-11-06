/**
 * The microphone pair of the Session Live monitor, its pure reads (task 3 M5, blueprint row 73;
 * `masterplan/08_client_ux_spec.md` §3 flow 2; decision D4 OD-11). The web twin is
 * `apps/core-web/src/features/session-monitor/audio-source.ts` (row 72, cut back by audit row 157).
 * The apps do not import each other, so the reads are written once per app and held by this file's tests.
 *
 * Audit row 185 (M3-05; D5, D134, D136, D138): operation 81 `switchAudioSource` is RETIRED. The
 * microphone of each pair is fixed by setup (camera `VIDEO-0N` with channel `MIC-0N`); the Core and the
 * in-app simulator answer every call `409 AUDIO_SOURCE_FIXED_BY_PAIRING`. The tablet sends it nowhere
 * (register O4): the gate of the toggle (`micSwitchGate`, `MicSwitchBlock`, `isSessionHolder`,
 * `sessionStartRoles`) and the refusal classes (`switchRefusal`, `switchFailureFacts`, `SwitchRefusal`)
 * are removed with the switch, because no refusal path is left (spec M3-05 R3, its second branch).
 *
 * | Export | What it is |
 * |---|---|
 * | `selectActiveInputId`, `selectStandbyInputId` | The pair as the Core holds it; each member `null` when it is absent (task 4 row 170) |
 * | `micSourceRole` | The pair word a MIC card says while a session records |
 * | `silentInputOf`, `noSignalInputOf` | The input an active `MIC_SILENT` / `MIC_NO_SIGNAL` warning names (ux §3.2 step 8) |
 * | `captureDurableOf` | D84 / D91: "Connecting cameras…" until the first durable fragment |
 *
 * **Nothing here sends a command.** The pair is read from the store (`session.audioSource`, with the
 * meters' `activeInputId` behind it); a warning only names an input (OD-11).
 */
import { audioPairInForce, selectorInForce } from '@/features/capture-selector/selector-in-force';
import { SessionState, type AudioTrackId, type MicInputId } from '@dems/shared/domain';
import {
  meterInputOfChannel,
  micInputOfChannel, // D61 (2026-11-04): the role lookup became the channel lookup
  PRIMARY_MIC_CHANNEL,
  SECOND_MIC_CHANNEL,
  type ChannelMicLine, // D61 (2026-11-04): the role alias became the channel line
  type SimState,
} from '@dems/shared/sim';
import { isMicInputId } from '@/features/capture-selector/mic-input-name';

// Audit row 185 (M3-05 R1/R3; D134, D136): the gate of the mic toggle (G4 / G5) and the refusal classes of
// operation 81 stood here. Op 81 is retired and the tablet sends it nowhere, so both are removed.

// ── The view ─────────────────────────────────────────────────────────────────────────────

// Task 4 row 170 (site M4; decision C18 (2); names register section 7, files 16-18): an input is found by
// the lookups of row 164 - `meterInputOfChannel` for a meter channel, `micInputOfChannel` for a channel
// (D61 of 2026-11-04: the role lookup became the channel lookup) - and
// every answer here may be `null`: ABSENT. No line stands in for another, and no built-in input
// (`MIC-01`, `MIC-02`) is answered for a channel or a role the selector holds no line for. Integration
// pass D2 (D133 (1)) stays: a mic input id is the Core's `MIC-NN` text, typed `string`.

/** `common.devices.*` key of a mic input's short name ("MIC 1"). */
export const MIC_INPUT_LABEL_KEY: Readonly<Record<MicInputId, string>> = {
  'MIC-01': 'common.devices.mic1',
  'MIC-02': 'common.devices.mic2',
};

/** One microphone line of the capture configuration, as the lookups read it: its input AND its channel (shared `ChannelMicLine`; D61 of 2026-11-04: the role became the numbered channel). */
export type MicLine = ChannelMicLine;

/**
 * The mic input behind a meter channel (SH-17: the meters are keyed by input since schema v2), or
 * `null`. Ruling D137 generalized by D61 (2026-11-04): each of the FOUR simultaneous channels has
 * an input exactly when a line NAMES that channel - never a line by its place, never the built-in
 * table. A channel without its line has no input: `null`.
 * The lines are stated by the caller (`micLinesInForce(state)`); there is no default list.
 */
export const inputOfChannel = (channel: AudioTrackId, mics: readonly MicLine[]): string | null => meterInputOfChannel(mics, channel);

/**
 * The input inside `AUDIO-01` now, or `null`: the pair of the OPEN session; with no open session the
 * PRIMARY line of the current selector (`audioPairInForce`, fix 157: a SEALED session's pair names
 * nothing any more); the meters' member behind both - the Core's own statement of the active input,
 * which is `null` when the selector holds no PRIMARY line (names register E41, section 4.5).
 */
export const selectActiveInputId = (s: SimState): string | null => {
  // Typed as the slice states it once the seam `AudioSliceInState` is out (task 4 row 28; row 149 removes it).
  const meters: string | null = s.audio.activeInputId;
  return audioPairInForce(s).activeInputId ?? meters;
};

/** The microphone lines of the selector in force, for a state that may hold no selector at all (a hand-built or neutral state). */
const linesInForce = (s: SimState): readonly MicLine[] => (selectorInForce(s) as { readonly mics?: readonly MicLine[] } | undefined)?.mics ?? [];

/**
 * The hot standby, or `null`: the pair in force (the OPEN session's; with no open session the current
 * selector's channel-2 line). An open session that states no pair is read from the selector it
 * records under (its snapshot, else the stored one) BY CHANNEL (D61 of 2026-11-04): the line of the
 * SECOND channel - or the line of the transcribed channel when the active input is the one that
 * channel holds (the two traded places in a switch the holder did not state). A channel without a
 * line is absent: no other line stands in, and the other input of the built-in pair is not answered.
 */
export const selectStandbyInputId = (s: SimState): string | null => {
  const named = audioPairInForce(s).standbyInputId;
  if (named !== null) return named;
  const lines = linesInForce(s);
  const standby = micInputOfChannel(lines, SECOND_MIC_CHANNEL); // D61: the former STANDBY role is the second channel
  const active = selectActiveInputId(s);
  return active !== null && active === standby ? micInputOfChannel(lines, PRIMARY_MIC_CHANNEL) : standby;
};

/** What a mic card or tile says about its input while a session records. */
export type MicSourceRole = 'ACTIVE' | 'STANDBY';

/**
 * The role of `inputId` in the TRANSCRIPTION PAIR, or `null`; pure. D61 (2026-11-04): FOUR
 * simultaneous channels - an input that is neither the transcribed one nor its standby (channel 3
 * or 4) records without a pair word. A card whose channel has no input says no role, and no input
 * is "Standby" to an active input that is absent.
 */
export function micSourceRole(inputId: string | null, activeInputId: string | null, standbyInputId: string | null): MicSourceRole | null {
  if (inputId === null || activeInputId === null) return null;
  if (inputId === activeInputId) return 'ACTIVE';
  return inputId === standbyInputId ? 'STANDBY' : null;
}

/**
 * The input a fault's target names, or `null`: the input itself by the id the Core sent (`MIC-NN`,
 * any number); the input of a meter channel (`meterInputOfChannel`: `null` when that channel has no
 * input - no input is then named for the fault); a target that cannot be read is about the active
 * input, which may itself be absent.
 */
function inputOfFaultTarget(target: string | null | undefined, activeInputId: string | null, mics: readonly MicLine[]): string | null {
  if (target === 'AUDIO-01' || target === 'AUDIO-02') return meterInputOfChannel(mics, target);
  return isMicInputId(target) ? target : activeInputId;
}

/**
 * The input an active `MIC_SILENT` warning names, or `null` when none is active. The fault's target
 * is the channel of the input or the input itself; a warning without a readable target is about the
 * active input.
 */
export function silentInputOf(faults: SimState['faults']['active'], activeInputId: string | null, mics: readonly MicLine[]): string | null {
  const fault = faults.find((entry) => entry.kind === 'MIC_SILENT');
  if (!fault) return null;
  return inputOfFaultTarget(fault.target, activeInputId, mics);
}

/**
 * Round two (JA2-06): the input an active `MIC_NO_SIGNAL` fault names, or `null`. On the monitor the ACTIVE
 * microphone without a signal showed only in its small meter; this is the fact the monitor's warning
 * states (audit row 185: it offers no switch - op 81 is retired). Same target rule as
 * `silentInputOf`; a real-capture Core states the condition as `MIC_SILENT` and is read there.
 */
export function noSignalInputOf(faults: SimState['faults']['active'], activeInputId: string | null, mics: readonly MicLine[]): string | null {
  const fault = faults.find((entry) => entry.kind === 'MIC_NO_SIGNAL');
  if (!fault) return null;
  return inputOfFaultTarget(fault.target, activeInputId, mics);
}

// ── "Connecting cameras…" (D84, D91 ruling R-1 option A; ux §8 step 5, erratum PE-128-79) ──

/**
 * Whether the capture of `session` has its first durable fragment. The stored state stays
 * `RECORDING` from the accepted start; the session payload member `captureDurable` is `false` until
 * the first durable fragment, and until then the monitor reads "Connecting cameras…", never
 * "Recording".
 *
 * The member joins the shared session schema with row 71 (request filed by row 72), so this ONE
 * helper reads it defensively: only an explicit `false` means "not durable yet". A session without
 * the member (the simulator, a Core before row 71) reads as durable, as before.
 */
export function captureDurableOf(session: unknown): boolean {
  if (typeof session !== 'object' || session === null) return true;
  return (session as { captureDurable?: unknown }).captureDurable !== false;
}

/** RECORDING, before the first durable fragment: "Connecting cameras…". */
export const selectConnectingCameras = (s: SimState): boolean => s.session?.state === SessionState.RECORDING && !captureDurableOf(s.session);
