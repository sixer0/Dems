/**
 * Login view model (04_mobile_specs §4.1, §6.1–§6.3; 01_specs §14.8). Pure functions only, so
 * T-M04's state table is tested without rendering (`login-model.test.ts`).
 *
 * - `loginSchema`: the local zod schema (§5.7: "the login schema is local (two required strings)").
 * - `ringStateFor`: L2, the Core link and the lockout → the C-1 GlowRing tone.
 * - `noticeFor`: L9, which one Alert the card shows (§6.2 states), highest priority first.
 * - `biometricButtonFor`: L7, hidden / disabled with a caption / enabled (§6.3 step 2).
 * - `splitAroundToken`: renders an i18n sentence with a live C-6 value in the middle.
 *
 * Credentials never enter this module's outputs: they are validated here and handed to
 * `useAuth().signIn` by the screen, nothing else (§6.1 "Never").
 */
import { z } from 'zod';
import { CORE_HTTP_ORIGIN } from '@dems/shared/api';
import type { GlowRingState } from '@/components/composed/glow-ring.math';
import type { BiometricAvailability } from '@/auth';
import type { CoreLinkInfo, SignOutReason } from '@/runtime';

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

export interface RingInputs {
  readonly coreLink: CoreLinkInfo;
  readonly locked: boolean;
}

/**
 * The login ring (§4.1 L2): the §6.1 lockout → amber (ATTENTION, M-C-22); the Core link OFFLINE →
 * CRITICAL; a STALE heartbeat → ATTENTION; otherwise READY (gold).
 */
export function ringStateFor({ coreLink, locked }: RingInputs): GlowRingState {
  if (locked) return 'attention';
  if (coreLink.state === 'OFFLINE') return 'critical';
  if (coreLink.heartbeat === 'STALE') return 'attention';
  return 'ready';
}

/** The L11 chip: `ONLINE`, `STALE` or `OFFLINE`, with its status tone. */
export type CoreChipKind = 'ONLINE' | 'STALE' | 'OFFLINE';

export function coreChipFor(coreLink: CoreLinkInfo): { kind: CoreChipKind; tone: 'success' | 'warning' | 'danger' } {
  if (coreLink.state === 'OFFLINE') return { kind: 'OFFLINE', tone: 'danger' };
  if (coreLink.heartbeat === 'STALE') return { kind: 'STALE', tone: 'warning' };
  return { kind: 'ONLINE', tone: 'success' };
}

/** Heartbeat mode with the Core down: Sign In is disabled (§4.1 L6). Mirrors `isSignInBlocked`. */
export function isCoreBlocked(coreLink: CoreLinkInfo): boolean {
  return coreLink.source === 'HEARTBEAT' && coreLink.state === 'OFFLINE';
}

/** `host:port` of the Core for the offline Alert ("Core service unreachable at 127.0.0.1:4400."). */
export function coreAddress(origin: string = CORE_HTTP_ORIGIN): string {
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
  | { readonly kind: 'core-offline' };

export type LoginNotice =
  | { readonly kind: 'locked'; readonly retryInSeconds: number }
  | { readonly kind: 'core-offline' }
  | AttemptOutcome
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
}

/**
 * Picks the Alert (§4.1 L9, §6.2), one at a time, most urgent first:
 * Locked (warning, live countdown) → Core offline (danger + Retry) → the last attempt's error
 * (danger: generic message + attempts left; or the biometric results) → Signed out / Expired
 * (accent). A lockout that has ended no longer shows, even if the last attempt caused it.
 */
export function noticeFor({ lockout, coreBlocked, lastAttempt, lastSignOut }: NoticeInputs): LoginNotice | null {
  if (lockout.locked) return { kind: 'locked', retryInSeconds: lockout.retryInSeconds };
  if (coreBlocked) return { kind: 'core-offline' };
  if (lastAttempt && lastAttempt.kind !== 'core-offline') return lastAttempt;
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
