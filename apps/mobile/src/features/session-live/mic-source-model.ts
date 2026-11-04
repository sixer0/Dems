/**
 * The mic switch of the Session Live monitor, its pure rules (task 3 M5, blueprint row 73;
 * `masterplan/08_client_ux_spec.md` §3 flow 2, register MB-03; `masterplan/03_api_contract.md` §2.4
 * operation 81; `masterplan/01_specs.md` R-3; decisions D4 OD-09 and OD-11). The web twin is
 * `apps/core-web/src/features/session-monitor/audio-source.ts` (row 72): the same gate, the same
 * refusal classes and the same view, so the three clients cannot disagree. The apps do not import
 * each other, so the rules are written once per app and held by this file's tests.
 *
 * | Export | What it is |
 * |---|---|
 * | `micSwitchGate` | G4 / G5 (ux §3.4): checking → waiting → not recording → the role → the session holder → allowed |
 * | `isSessionHolder` | OD-09: the operator who opened the session, or a SUPERVISOR |
 * | `switchRefusal` | What a refused switch means to the cards (ux §3.2 steps 6-7, §3.5) |
 * | `selectActiveInputId`, `selectStandbyInputId` | The pair as the Core holds it; each member `null` when it is absent (task 4 row 170) |
 * | `silentInputOf` | The input an active `MIC_SILENT` warning names (ux §3.2 step 8) |
 * | `captureDurableOf` | D84 / D91: "Connecting cameras…" until the first durable fragment |
 *
 * **One active microphone, switched by hand.** Nothing here flips the pair: it is read from the
 * store (`session.audioSource`, with the meters' `activeInputId` behind it), so the cards move when
 * the Core's state does. A `MIC_SILENT` warning only names an input; no rule in this file sends a
 * command (OD-11).
 */
import { audioPairInForce, selectorInForce } from '@/features/capture-selector/selector-in-force';
import { ApiErrorCode } from '@dems/shared/api';
import { SessionState, type AudioTrackId, type MicInputId } from '@dems/shared/domain';
import {
  meterInputOfChannel,
  micInputOfChannel, // D61 (2026-11-04): the role lookup became the channel lookup
  PRIMARY_MIC_CHANNEL,
  SECOND_MIC_CHANNEL,
  OperatorRole,
  Permission,
  ROLE_PERMISSIONS,
  SimNotFoundError,
  SimTransitionError,
  type ChannelMicLine, // D61 (2026-11-04): the role alias became the channel line
  type SimState,
} from '@dems/shared/sim';
import { isMicInputId } from '@/features/capture-selector/mic-input-name';

// ── The gate (G4, G5) ────────────────────────────────────────────────────────────────────

/** Why the mic toggle is not offered now; `null` when it is. */
export type MicSwitchBlock =
  /** The operator's role is not known yet: "Checking your permissions…" (E-16). Never read as a refusal. */
  | { readonly kind: 'CHECKING' }
  /** The Core link is down (Live mode): nothing may be sent, and the holder cannot be confirmed (P-13). */
  | { readonly kind: 'WAITING' }
  /** No session is recording (`409 INVALID_STATE`): the toggle is not drawn, its reason is. */
  | { readonly kind: 'NOT_RECORDING' }
  /** `SESSION_START` is not held: the roles that hold it are named. */
  | { readonly kind: 'ROLE'; readonly roles: readonly OperatorRole[] }
  /** `SESSION_START` is held, but the operator neither opened this session nor is a SUPERVISOR (OD-09). */
  | { readonly kind: 'HOLDER' };

/** The roles that hold `SESSION_START`, in the order of the role set. */
export function sessionStartRoles(): readonly OperatorRole[] {
  return Object.values(OperatorRole).filter((role) => (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(Permission.SESSION_START));
}

/** OD-09: the operator who opened the session, or a SUPERVISOR. Pure. */
export function isSessionHolder(input: { readonly operatorId: string | null; readonly role: OperatorRole | null; readonly createdBy: string | null }): boolean {
  if (input.role === OperatorRole.SUPERVISOR) return true;
  return input.operatorId !== null && input.operatorId === input.createdBy;
}

export interface MicSwitchGateInput {
  /** A signed-in operator's role is known. */
  readonly roleKnown: boolean;
  /** The Core link is down: session actions are read-only (the runtime's one rule). */
  readonly linkDown: boolean;
  readonly recording: boolean;
  /** `SESSION_START` is held. */
  readonly canStart: boolean;
  /** `isSessionHolder`. */
  readonly holder: boolean;
}

/**
 * G4 / G5 (ux §3.4). The order is the order of the table in this file's header: an unknown role is
 * never read as "denied" and never as "allowed"; a lost link is said before anything the Core would
 * have to confirm; the state of the session is said before the role (without a recording there is
 * nothing to switch); the role before the holder (the Core answers the permission first).
 */
export function micSwitchGate(input: MicSwitchGateInput): MicSwitchBlock | null {
  if (!input.roleKnown) return { kind: 'CHECKING' };
  if (input.linkDown) return { kind: 'WAITING' };
  if (!input.recording) return { kind: 'NOT_RECORDING' };
  if (!input.canStart) return { kind: 'ROLE', roles: sessionStartRoles() };
  if (!input.holder) return { kind: 'HOLDER' };
  return null;
}

// ── Refusals of operation 81 ─────────────────────────────────────────────────────────────

/** What the cards do with a refusal the presenter left to the screen; pure (ux §3.2 steps 6-7, §3.5). */
export type SwitchRefusal = 'CONFLICT' | 'NOT_RECORDING' | 'NOT_OPEN' | 'OTHER';

interface RefusalFacts {
  readonly code: string | null;
  readonly status: number | null;
}

function factsOf(error: unknown): RefusalFacts {
  const facts = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; status?: unknown };
  return { code: typeof facts.code === 'string' ? facts.code : null, status: typeof facts.status === 'number' ? facts.status : null };
}

/** The class of a refused switch: the Live rejection (code, status) or what the simulator threw. Never its text. */
export function switchRefusal(error: unknown): SwitchRefusal {
  const { code, status } = factsOf(error);
  if (code === ApiErrorCode.AUDIO_SOURCE_CONFLICT) return 'CONFLICT';
  if (code === ApiErrorCode.NOT_FOUND || status === 404 || error instanceof SimNotFoundError) return 'NOT_OPEN';
  if (code === ApiErrorCode.INVALID_STATE || error instanceof SimTransitionError) return 'NOT_RECORDING';
  return 'OTHER';
}

/** The facts of a failed switch for the runtime log: the class, the code and the status. No text, no credential. */
export function switchFailureFacts(error: unknown): Readonly<Record<string, string | number | boolean>> {
  const { code, status } = factsOf(error);
  return { refusal: switchRefusal(error), code: code ?? 'none', status: status ?? 0 };
}

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
 * microphone without a signal showed only in its small meter; this is the fact the warning above the
 * toggle states, with "Switch to standby" when the input is the one inside `AUDIO-01`. Same target rule as
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
