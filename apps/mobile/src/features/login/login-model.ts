/**
 * Login view model (04_mobile_specs §4.1, §6.1–§6.3; 01_specs §14.8). Pure functions only, so
 * T-M04's state table is tested without rendering (`login-model.test.ts`).
 *
 * - `loginSchema`: the local zod schema (§5.7: "the login schema is local (two required strings)").
 * - `ringStateFor`: L2, the Core link and the lockout → the C-1 GlowRing tone.
 * - `liveCoreLookOf`: LIVE only, the runtime's notice and view of the link → the look of the L2 ring,
 *   the L11 chip and the ambient loops (row M2 follow-up, decision D180).
 * - `noticeFor`: L9, which one Alert the card shows (§6.2 states), highest priority first.
 * - `biometricButtonFor`: L7, hidden / disabled with a caption / enabled (§6.3 step 2).
 * - `splitAroundToken`: renders an i18n sentence with a live C-6 value in the middle.
 *
 * Credentials never enter this module's outputs: they are validated here and handed to
 * `useAuth().signIn` by the screen, nothing else (§6.1 "Never").
 */
import { z } from 'zod';
import type { GlowRingState } from '@/components/composed/glow-ring.math';
import type { AuthNoticeKind, BiometricAvailability } from '@/auth';
import { coreLinkViewOf, formatCoreAddress, getCoreAddress, type CoreErrorText, type CoreLinkInfo, type CoreLinkView, type SignOutReason } from '@/runtime';

// ---------------------------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------------------------

/** i18n keys of the field errors (shared `login.*`, 01_specs §14.8). */
export const FIELD_ERROR_KEYS = {
  usernameRequired: 'login.username.required',
  passwordRequired: 'login.password.required',
} as const;

/**
 * Two required strings (§5.7). The username is trimmed (the simulator matches it trimmed and
 * lower-cased); the password is taken verbatim. Messages are i18n keys, translated at render.
 */
export const loginSchema = z.object({
  username: z.string().trim().min(1, FIELD_ERROR_KEYS.usernameRequired),
  password: z.string().min(1, FIELD_ERROR_KEYS.passwordRequired),
});

export type LoginFormInput = z.input<typeof loginSchema>;
export type LoginFormValues = z.output<typeof loginSchema>;

export const EMPTY_LOGIN_FORM: LoginFormInput = { username: '', password: '' };

// ---------------------------------------------------------------------------------------------
// L2: ring tone
// ---------------------------------------------------------------------------------------------

/**
 * LIVE mode: how the L2 ring, the L11 chip and the ambient loops read the Core link (row M2
 * follow-up, decision D180; findings L-1, L-2 of `gateway_check/09c`). Not the two-valued `state`:
 * there a link that is still connecting reads OFFLINE, so a cold start showed "Core offline" and a
 * critical ring while the offline Alert, which follows the runtime's rule, stayed hidden. The input
 * is the runtime's notice of the link, `useCoreLinkNotice()` (rows M0, M1):
 *
 * | The runtime says | Look | Chip | Ring |
 * |---|---|---|---|
 * | the notice shows (from the first OFFLINE or STALE until the first heartbeat; a reconnect attempt keeps it, no flicker), or the view is `down` | `offline` | Core offline (danger) | critical |
 * | the view is `up` | `up` | Core online (success) | ready |
 * | the view is `settling` and the notice does not show: a cold start, a reconnect with no outage before it | `connecting` | Connecting to Core… (warning) | attention |
 *
 * The view `none` (no LIVE source) never reaches it, because only LIVE asks; it would read `connecting`.
 */
export type LiveCoreLook = 'up' | 'connecting' | 'offline';

export function liveCoreLookOf(link: { readonly view: CoreLinkView; readonly offline: boolean }): LiveCoreLook {
  if (link.offline || link.view === 'down') return 'offline';
  return link.view === 'up' ? 'up' : 'connecting';
}

/** LIVE: the look handed in, or, without one, the link's view alone (a settling link reads `connecting`). */
function liveLookFor(coreLink: CoreLinkInfo, liveLook: LiveCoreLook | null): LiveCoreLook {
  return liveLook ?? liveCoreLookOf({ view: coreLinkViewOf(coreLink), offline: false });
}

const LIVE_RING: Readonly<Record<LiveCoreLook, GlowRingState>> = { up: 'ready', connecting: 'attention', offline: 'critical' };

export interface RingInputs {
  readonly coreLink: CoreLinkInfo;
  readonly locked: boolean;
  /** LIVE: the controller's `coreLook` (`liveCoreLookOf(useCoreLinkNotice())`); the other modes leave it out. */
  readonly liveLook?: LiveCoreLook | null;
}

/**
 * The login ring (§4.1 L2): the §6.1 lockout → amber (ATTENTION, M-C-22); the Core link OFFLINE →
 * CRITICAL; a STALE heartbeat → ATTENTION; otherwise READY (gold). LIVE: the look of the link
 * (`liveCoreLookOf`), so a link that is still connecting is ATTENTION, never CRITICAL.
 */
export function ringStateFor({ coreLink, locked, liveLook = null }: RingInputs): GlowRingState {
  if (locked) return 'attention';
  if (coreLink.source === 'LIVE') return LIVE_RING[liveLookFor(coreLink, liveLook)];
  if (coreLink.state === 'OFFLINE') return 'critical';
  // Unreachable from the runtime's links (a STALE heartbeat makes `state` OFFLINE, `core-link.ts`
  // `coreLinkStateFor`), kept because step 75's test pins it with a hand-built link (row M2, L-2).
  if (coreLink.heartbeat === 'STALE') return 'attention';
  return 'ready';
}

/** The L11 chip: `ONLINE`, `STALE` or `OFFLINE`, with its status tone; LIVE adds `SETTLING` (still connecting). */
export type CoreChipKind = 'ONLINE' | 'STALE' | 'OFFLINE' | 'SETTLING';

export interface CoreChip {
  readonly kind: CoreChipKind;
  readonly tone: 'success' | 'warning' | 'danger';
}

const LIVE_CHIP: Readonly<Record<LiveCoreLook, CoreChip>> = {
  up: { kind: 'ONLINE', tone: 'success' },
  connecting: { kind: 'SETTLING', tone: 'warning' },
  offline: { kind: 'OFFLINE', tone: 'danger' },
};

/** The L11 chip of a link. LIVE: the look of the link (`liveCoreLookOf`), as the ring. */
export function coreChipFor(coreLink: CoreLinkInfo, liveLook: LiveCoreLook | null = null): CoreChip {
  if (coreLink.source === 'LIVE') return LIVE_CHIP[liveLookFor(coreLink, liveLook)];
  if (coreLink.state === 'OFFLINE') return { kind: 'OFFLINE', tone: 'danger' };
  // Unreachable from the runtime's links, as in `ringStateFor` (row M2, L-2).
  if (coreLink.heartbeat === 'STALE') return { kind: 'STALE', tone: 'warning' };
  return { kind: 'ONLINE', tone: 'success' };
}

/**
 * Heartbeat mode with the Core down: Sign In is disabled (§4.1 L6). Mirrors `isSignInBlocked`.
 * Backend task W59 (04_client_integration_spec §9.5): so is LIVE mode while the link to the Core
 * server is not ONLINE. The simulator's own link (SIMULATED) never blocks, as before.
 */
export function isCoreBlocked(coreLink: CoreLinkInfo): boolean {
  return coreLink.source !== 'SIMULATED' && coreLink.state === 'OFFLINE';
}

/**
 * `host:port` for the offline Alert. Default (D263, row 236): the configured Core server address of the runtime
 * (`core-address.ts`; `127.0.0.1:4420` until it is set on the Pair screen). Given an origin (the heartbeat
 * source's mock-core, `CORE_HTTP_ORIGIN`): that origin without its scheme ("Core service unreachable at 127.0.0.1:4400.").
 */
export function coreAddress(origin?: string): string {
  if (origin === undefined) return formatCoreAddress(getCoreAddress());
  return origin.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/+$/, '');
}

// ---------------------------------------------------------------------------------------------
// L9: the one Alert
// ---------------------------------------------------------------------------------------------

/** The outcome of the last attempt this screen made (password or fingerprint). */
export type AttemptOutcome =
  | { readonly kind: 'invalid'; readonly attemptsRemaining: number }
  | { readonly kind: 'biometric-failed'; readonly attemptsRemaining: number }
  | { readonly kind: 'biometric-lockout' }
  | { readonly kind: 'biometric-error' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'core-offline' }
  /**
   * LIVE mode (backend task W59): the sign-in was sent and the Core server gave no answer, while
   * the link still reads ONLINE. The two sentences are the refusal presenter's own, as i18n keys.
   * Built by `liveAttemptFor` (`./login-live-model.ts`), never by the simulator's paths.
   */
  | { readonly kind: 'no-answer'; readonly title: CoreErrorText; readonly body: CoreErrorText | null };

export type LoginNotice =
  | { readonly kind: 'locked'; readonly retryInSeconds: number }
  | { readonly kind: 'core-offline' }
  | AttemptOutcome
  /** LIVE mode: the auth layer's Alert of a session end or of a dead biometric token (`<AuthNoticeAlert />`). */
  | { readonly kind: 'auth-notice'; readonly notice: AuthNoticeKind }
  | { readonly kind: 'signed-out'; readonly reason: 'USER' | 'LOCK' }
  | { readonly kind: 'expired' };

export interface NoticeInputs {
  /** The simulator lockout (§6.1), live. */
  readonly lockout: { readonly locked: boolean; readonly retryInSeconds: number };
  /** Heartbeat mode with the Core OFFLINE. */
  readonly coreBlocked: boolean;
  /** This screen's last attempt (password or fingerprint), until the next one. */
  readonly lastAttempt: AttemptOutcome | null;
  /** Why the previous operator left (§3.3), until this screen makes an attempt. */
  readonly lastSignOut: SignOutReason | null;
  /**
   * LIVE mode: the kind of `useAuthSession().notice` (04_client_integration_spec §6.4, §6.5, MB-3,
   * WS-14), while the auth layer holds one. Absent or `null` in the other modes.
   */
  readonly authNotice?: AuthNoticeKind | null;
}

/**
 * Picks the Alert (§4.1 L9, §6.2), one at a time, most urgent first:
 * Locked (warning, live countdown) → Core offline (danger + Retry) → the last attempt's error
 * (danger: generic message + attempts left; or the biometric results) → Signed out / Expired
 * (accent). A lockout that has ended no longer shows, even if the last attempt caused it.
 *
 * LIVE mode adds one step between the last attempt and the arrival notices: the auth layer's
 * notice (why the session ended, or that the biometric token is dead). It outlives an attempt,
 * because an attempt can be what raised it (the fingerprint button on a dead token).
 */
export function noticeFor({ lockout, coreBlocked, lastAttempt, lastSignOut, authNotice }: NoticeInputs): LoginNotice | null {
  if (lockout.locked) return { kind: 'locked', retryInSeconds: lockout.retryInSeconds };
  if (coreBlocked) return { kind: 'core-offline' };
  if (lastAttempt && lastAttempt.kind !== 'core-offline') return lastAttempt;
  if (authNotice) return { kind: 'auth-notice', notice: authNotice };
  if (lastSignOut === 'IDLE') return { kind: 'expired' };
  if (lastSignOut === 'USER' || lastSignOut === 'LOCK') return { kind: 'signed-out', reason: lastSignOut };
  return null;
}

/** The kit Alert status for a notice (§4.1 L9). */
export function alertStatusFor(notice: LoginNotice): 'danger' | 'warning' | 'accent' {
  switch (notice.kind) {
    case 'locked':
    case 'biometric-lockout':
      return 'warning';
    case 'signed-out':
    case 'expired':
      return 'accent';
    default:
      return 'danger';
  }
}

export interface SubmitInputs {
  readonly locked: boolean;
  readonly pending: boolean;
  readonly coreBlocked: boolean;
}

/** L6: Sign In is disabled while locked, while pending, or when the Core is OFFLINE in heartbeat mode. */
export function isSubmitDisabled({ locked, pending, coreBlocked }: SubmitInputs): boolean {
  return locked || pending || coreBlocked;
}

// ---------------------------------------------------------------------------------------------
// L7: biometric button
// ---------------------------------------------------------------------------------------------

export type BiometricButtonView =
  /** No hardware (or not yet known): no button at all. */
  | { readonly kind: 'hidden' }
  /** Hardware without an enrolled fingerprint, or not bound to an operator yet: disabled + caption key. */
  | { readonly kind: 'disabled'; readonly captionKey: string }
  | { readonly kind: 'enabled' };

export interface BiometricButtonInputs {
  readonly availability: BiometricAvailability | 'unknown';
  /** `dems.mobile.auth.v1`: biometric sign-in accepted for `lastOperatorId`. */
  readonly enabled: boolean;
  readonly hasOperator: boolean;
  /** Locked, pending or Core blocked: the fingerprint button follows Sign In. */
  readonly blocked: boolean;
}

/**
 * §6.3 step 2: hidden without hardware; disabled with "Biometrics not set up on this device" when
 * nothing is enrolled; disabled with the enable hint until a password sign-in bound an operator
 * (§6.3 step 1); otherwise enabled (and disabled with no caption while Sign In is blocked).
 */
export function biometricButtonFor({ availability, enabled, hasOperator, blocked }: BiometricButtonInputs): BiometricButtonView {
  if (availability === 'unknown' || availability === 'unavailable') return { kind: 'hidden' };
  if (availability === 'not-enrolled') return { kind: 'disabled', captionKey: 'mobile.biometric.notEnrolled' };
  if (!enabled || !hasOperator) return { kind: 'disabled', captionKey: 'features.login.biometric.notBound' };
  if (blocked) return { kind: 'disabled', captionKey: 'mobile.biometric.button' };
  return { kind: 'enabled' };
}

// ---------------------------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------------------------

const TOKEN = '\u0000';

/**
 * Splits a translated sentence around one interpolated value, so the value can be a live
 * component (C-6 RollingNumber) while the words stay in i18n: `t(key, { countdown: TOKEN })`.
 */
export function splitAroundToken(render: (token: string) => string): { before: string; after: string } {
  const text = render(TOKEN);
  const at = text.indexOf(TOKEN);
  if (at < 0) return { before: text, after: '' };
  return { before: text.slice(0, at), after: text.slice(at + TOKEN.length) };
}

/** Ring size per layout class (§2.4, C-1 `login` mode 200–340 dp). */
export function ringSizeFor(layoutClass: 'compact' | 'compact-landscape' | 'medium' | 'expanded'): number {
  switch (layoutClass) {
    case 'expanded':
      return 340;
    case 'medium':
      return 240;
    default:
      // compact-landscape: §2.4 asks for 160 dp; C-1 login mode starts at 200 (DR-S75-2).
      return 200;
  }
}
