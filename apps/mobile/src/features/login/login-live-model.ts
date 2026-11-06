/**
 * The Login screen in LIVE mode: the pure part (backend task W59; 04_client_integration_spec §9.2,
 * §3.5, §6.5, §8.1 LB-10; AC-C-72, AC-C-104, AC-C-110; decisions D116, D118, D129). No React, no
 * clock, no storage: every function gets what it reads as an argument.
 *
 * What differs from the simulator, and why this file exists:
 *
 * | Point | SIMULATED and HEARTBEAT (unchanged) | LIVE |
 * |---|---|---|
 * | Trust line (L11) | "Core: DEMS-IR-01 • paired (simulated)"; "Pair this device" | "Core: DEMS-IR-01 • paired as DEV-0003"; "Pairing details" |
 * | Demo operators (L10) | Role chips, the password hint, the simulator's pairing code | The plain sentence of condition C1, the password hint; no role chip (a role is the Core's data), no pairing-code hint (the simulator's code means nothing to the Core server) |
 * | Core offline (L9) | HEARTBEAT: the Alert follows the link at once and names mock-core's address | The Alert follows the link without flicker and names no address; Retry asks the Live socket; no "Use Simulated mode" (M3-01 L6, D160) |
 * | A refusal the sign-in result cannot say | Does not exist | The auth layer's `signInFailure`: a limit (no Alert, the form stays filled), no answer (the presenter's two sentences, in place) |
 * | Why the operator is here | "Signed out", "Session expired" | Plus the auth layer's notice: `TOKEN_REUSE`, a dead biometric token, a disabled account, the 8-hour limit |
 *
 * **A limit is not an outage and not a wrong password (LB-10, finding F76).** The auth layer shows
 * the limit toast with the seconds of `retry-after`. This screen then shows no Alert of its own,
 * keeps what was typed, and changes nothing that follows the link (the chip, the ring, the mode).
 */
import { reportedCoreDeviceIdOf } from '@dems/shared/sim';
import type { CoreErrorPresentation, CoreLinkInfo, PairingInfo } from '@/runtime';
import type { AttemptOutcome } from './login-model';

/** LIVE mode: the Core server is the Core. The runtime's word (`useCoreLink().source`), and nothing else, decides it. */
export function isLiveLogin(coreLink: Pick<CoreLinkInfo, 'source'>): boolean {
  return coreLink.source === 'LIVE';
}

// ---------------------------------------------------------------------------------------------
// L11: the trust line (§9.2; AC-C-72)
// ---------------------------------------------------------------------------------------------

export type LiveTrustLine =
  /**
   * `core`: the Core's own device ID from the replica's `pairing` slice, or `null` while it is not there yet.
   * `coreNotReported`: the copy holds the dataset's reserved id, which is not this installation's id (I6, S9).
   */
  | { readonly kind: 'paired'; readonly core: string | null; readonly tablet: string; readonly coreNotReported?: true }
  /** The gate is not PAIRED (also while the stored credential is still being read). */
  | { readonly kind: 'unpaired' };

/**
 * The Core id a login card shows from the paired copy `pairing.coreDeviceId` (M3-10 R1, register I6):
 * the copy goes through the ONE shared S9 reader `reportedCoreDeviceIdOf` (shared `sim/core-facts.ts`,
 * web `useReportedCoreDeviceId`, tablet About row 197). `null` = "Not reported" (`system.noProducer`).
 *
 * `ownCapture` is the reader's own-capture input. LIVE passes `true`: the copy came from a Core server
 * (`pairedSlice`), never from the simulated lane whose dataset id S9 keeps, and before the sign-in the
 * replica holds the neutral `time` / `security` slices, which carry no own-capture member (row 199, D-199-1).
 * The simulated lane passes the state's own `isOwnCaptureCoreState`, so its dataset id is kept (CONTROL).
 */
export function reportedPairedCoreIdOf(coreDeviceId: string, ownCapture: boolean): string | null {
  return reportedCoreDeviceIdOf({ device: { id: coreDeviceId }, time: ownCapture ? { hostClock: true } : null });
}

/**
 * The trust line of LIVE mode. The tablet's ID comes from the pairing gate (`usePairing()`), which
 * is the runtime's word on whether this tablet is paired; the Core's name from the `pairing` slice,
 * which holds the identity the Core server returned at the pairing, shown through I6
 * (`reportedPairedCoreIdOf`): the reserved id reads "Not reported", any other id as it is.
 */
export function liveTrustLineFor(pairing: Pick<PairingInfo, 'state' | 'deviceId'>, coreDeviceId: string): LiveTrustLine {
  if (pairing.state !== 'PAIRED' || pairing.deviceId === null) return { kind: 'unpaired' };
  const core = coreDeviceId.trim();
  if (core === '') return { kind: 'paired', core: null, tablet: pairing.deviceId };
  const reported = reportedPairedCoreIdOf(core, true);
  return reported === null
    ? { kind: 'paired', core: null, tablet: pairing.deviceId, coreNotReported: true }
    : { kind: 'paired', core: reported, tablet: pairing.deviceId };
}

/** An i18n key of `features.login.live.*` or `mobile.pairing.*`, with its values. */
export interface LiveTrustText {
  readonly textKey: string;
  readonly values: Readonly<Record<string, string>>;
  /** Values that are themselves i18n keys, translated by the screen before `textKey` (I6: `device` = `system.noProducer`). */
  readonly valueKeys?: Readonly<Record<string, string>>;
  /** The label of the link that opens `/pair`. */
  readonly linkKey: string;
}

/** "Core: DEMS-IR-01 • paired as DEV-0003" with "Pairing details"; "Core server • not paired" with "Pair this device". */
export function liveTrustTextFor(line: LiveTrustLine): LiveTrustText {
  if (line.kind === 'unpaired') return { textKey: 'features.login.live.trust.unpaired', values: {}, linkKey: 'mobile.pairing.link' };
  if (line.coreNotReported === true) {
    // I6: "Core: Not reported • paired as DEV-0003".
    return { textKey: 'features.login.live.trust.paired', values: { tablet: line.tablet }, valueKeys: { device: 'system.noProducer' }, linkKey: 'features.login.live.trust.details' };
  }
  if (line.core === null) {
    return { textKey: 'features.login.live.trust.pairedUnnamed', values: { tablet: line.tablet }, linkKey: 'features.login.live.trust.details' };
  }
  return { textKey: 'features.login.live.trust.paired', values: { device: line.core, tablet: line.tablet }, linkKey: 'features.login.live.trust.details' };
}

// ---------------------------------------------------------------------------------------------
// L9: the "Core server unreachable" Alert follows the link without flicker (§3.5)
// ---------------------------------------------------------------------------------------------

/**
 * Whether the offline Alert shows after a change of the Live link's heartbeat: the runtime's one
 * rule (`@/runtime`, `link-notice.ts`; row M0), re-exported under the name this screen and its tests
 * use. The rule is not written here: OFFLINE and STALE show the Alert at once, LIVE hides it, and
 * CONNECTING keeps what is shown, so the Alert neither flashes at a cold start nor flickers while
 * the link retries. A heartbeat that is absent (`undefined`) hides it. Sign In itself stays disabled
 * the whole time the link is not ONLINE (`isCoreBlocked`).
 */
export { offlineNoticeAfter as liveOfflineNoticeAfter } from '@/runtime';

// ---------------------------------------------------------------------------------------------
// L9: the last attempt, read with what the auth layer says the Core's refusal was (S1-1, LB-10)
// ---------------------------------------------------------------------------------------------

/** What this screen reads of `useAuthSession().signInFailure`: i18n keys and flags, never a message of the Core. */
export type LiveSignInFailure = Pick<CoreErrorPresentation, 'kind' | 'outage' | 'label' | 'description'>;

/** LB-10: the last attempt was refused by a limit. The form keeps what was typed. */
export function isLimitFailure(failure: Pick<CoreErrorPresentation, 'kind'> | null): boolean {
  return failure !== null && failure.kind === 'LIMIT';
}

/**
 * The outcome of the last attempt as the Alert shows it in LIVE mode. The sign-in result of the
 * runtime contract has two words for a rejected sign-in, `CORE_OFFLINE` and `UNAVAILABLE`; what
 * the rejection was is `failure` (the refusal presenter's description of it).
 *
 * | The last attempt | `failure` | Shown |
 * |---|---|---|
 * | `unavailable`, or `biometric-error` | a limit (429) | **Nothing**: the limit toast of the auth layer is the wording (LB-10); neither "Sign-in unavailable" nor an offline notice |
 * | `core-offline` | an outage (no answer, a time-out, the Core's data did not arrive) | `no-answer`: the presenter's two sentences, in place. The link may still read ONLINE, so the link's own Alert would say nothing |
 * | `core-offline` | none (the auth layer sent nothing: the link was down) | As before: the Alert of the link, when the link says so |
 * | anything else | anything | The attempt as it is |
 */
export function liveAttemptFor(lastAttempt: AttemptOutcome | null, failure: LiveSignInFailure | null): AttemptOutcome | null {
  if (lastAttempt === null || failure === null) return lastAttempt;
  if (isLimitFailure(failure)) return lastAttempt.kind === 'unavailable' || lastAttempt.kind === 'biometric-error' ? null : lastAttempt;
  if (lastAttempt.kind === 'core-offline' && failure.outage && failure.label !== null) {
    return { kind: 'no-answer', title: failure.label, body: failure.description };
  }
  return lastAttempt;
}
