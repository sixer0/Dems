/**
 * What the two auth providers share (04_mobile_specs §3.2 slot 10, §6; backend task W56): the auth
 * session the screens read (`useAuthSession()`), the pure mappings of a sign-in, the activity
 * throttle of the idle lock, and the frame both providers render.
 *
 * `./auth-provider.tsx` holds the provider of SIMULATED and HEARTBEAT mode and the switch;
 * `./live-auth-provider.tsx` holds the provider of LIVE mode. A screen imports from `@/auth` and
 * sees one `AuthSession` in every mode (04_client_integration_spec MB-7: "No screen changes").
 */
import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { settle, type CoreActions } from '@dems/shared/live';
import { selectLockout, type SignInResult as SimSignInResult, type SimState } from '@dems/shared/sim';
import {
  RuntimeContractProvider,
  reportRuntimeIssue,
  type AuthOperator,
  type CoreErrorPresentation,
  type CoreLinkInfo,
  type RuntimeContract,
  type SignInResult,
  type SignOutReason,
} from '@/runtime';
import type { BiometricAvailability, BiometricSignInResult } from './biometric';
import { isSignInBlockedBy, type AuthNotice } from './live-auth-model';

/** Touches closer together than this count once (the simulator itself keeps ≥ 1 s). */
export const ACTIVITY_THROTTLE_MS = 5_000;

export interface AuthLockoutInfo {
  readonly locked: boolean;
  /** Simulator-clock end of the lockout, epoch ms. */
  readonly lockedUntilMs: number | null;
  /** Whole seconds left (for the C-6 countdown); 0 when not locked. */
  readonly retryInSeconds: number;
  readonly attemptsRemaining: number;
}

/**
 * The operator the fingerprint button signs in. In SIMULATED and HEARTBEAT mode it is the
 * simulator's operator. In LIVE mode it comes from the stored marker, which names the operator
 * and holds no role: a role is the Core's data, and nobody is signed in on the Login screen.
 */
export type BiometricOperator = Pick<AuthOperator, 'id' | 'displayName' | 'initials'> & Partial<Pick<AuthOperator, 'role' | 'username'>>;

export interface BiometricInfo {
  /** `unknown` until the first OS query answers. */
  readonly availability: BiometricAvailability | 'unknown';
  readonly enabled: boolean;
  readonly lastOperatorId: string | null;
  /** The operator the fingerprint button signs in, for the prompt subtitle and the Login caption. */
  readonly lastOperator: BiometricOperator | null;
  /**
   * Set when reading or writing the biometric preference failed. SIMULATED and HEARTBEAT:
   * `dems.mobile.auth.v1`. LIVE: the Core or the tablet's secure storage did not take the change.
   */
  readonly prefsError: 'read' | 'write' | null;
  /**
   * LIVE mode: whether the stored token carries the device's authentication requirement (the
   * marker's `protected`). `null` when no token is stored, and in the other modes. While it is not
   * `true`, no text may say that the token is protected by the device's hardware (MB-6a).
   */
  readonly protected: boolean | null;
  /**
   * LIVE mode, MB-1: true in a session that was created with the fingerprint. Biometric sign-in
   * is then changed only after a password sign-in: the Settings switch is disabled, with
   * `features.auth.biometric.passwordSessionRequired`. False in the other modes.
   */
  readonly changeBlocked: boolean;
}

export interface AuthSession {
  /** Why the last operator left, for the Login alert (§3.3); cleared by the next sign-in. */
  readonly lastSignOut: SignOutReason | null;
  /** The "Session expired" dialog is open. */
  readonly expiredNotice: boolean;
  dismissExpiredNotice(): void;
  readonly lockout: AuthLockoutInfo;
  readonly biometric: BiometricInfo;
  /** The operator id a biometric offer is open for, or null. */
  readonly biometricOffer: string | null;
  acceptBiometricOffer(): Promise<void>;
  declineBiometricOffer(): void;
  /**
   * Settings → Security: enable for the signed-in operator, or disable. In LIVE mode it rejects
   * when the Core or the tablet's storage did not take the change (the caller shows its failure).
   */
  setBiometricEnabled(enabled: boolean): Promise<void>;
  refreshBiometricAvailability(): Promise<BiometricAvailability>;
  /** The Login fingerprint button (§6.3). */
  signInWithBiometric(): Promise<BiometricSignInResult>;
  /** Avatar menu → Lock console (§6.4). */
  lockConsole(): void;
  /** Records operator activity (the provider already does this for every touch). */
  touch(): void;
  /**
   * LIVE mode: an Alert for the Login screen that the three notices of `lastSignOut` cannot say
   * (04_client_integration_spec §6.4, §6.5, MB-3, WS-14); `<AuthNoticeAlert />` renders it. `null`
   * while signed in, and in the other modes.
   */
  readonly notice: AuthNotice | null;
  /**
   * LIVE mode: what the Core's refusal of the last sign-in attempt (password or fingerprint) was,
   * when the contract's own result cannot say it: a limit with its `retryAfterSeconds`, an
   * outage, a refusal by code. `null` after an attempt that signed in or failed with a wrong
   * password or a lockout, and in the other modes.
   */
  readonly signInFailure: CoreErrorPresentation | null;
}

const NO_LOCKOUT: AuthLockoutInfo = { locked: false, lockedUntilMs: null, retryInSeconds: 0, attemptsRemaining: 5 };

/** The biometric part of a session that has none: outside `AuthProvider`. */
export const NO_BIOMETRIC: BiometricInfo = {
  availability: 'unknown',
  enabled: false,
  lastOperatorId: null,
  lastOperator: null,
  prefsError: null,
  protected: null,
  changeBlocked: false,
};

const DEFAULT_SESSION: AuthSession = {
  lastSignOut: null,
  expiredNotice: false,
  dismissExpiredNotice: () => {},
  lockout: NO_LOCKOUT,
  biometric: NO_BIOMETRIC,
  biometricOffer: null,
  acceptBiometricOffer: async () => {},
  declineBiometricOffer: () => {},
  setBiometricEnabled: async () => {},
  refreshBiometricAvailability: async () => 'unavailable',
  signInWithBiometric: async () => ({ kind: 'unavailable' }),
  lockConsole: () => {},
  touch: () => {},
  notice: null,
  signInFailure: null,
};

const AuthSessionContext = createContext<AuthSession>(DEFAULT_SESSION);

/** Login, Settings and the avatar menu read the auth session here (inert outside `AuthProvider`). */
export function useAuthSession(): AuthSession {
  return useContext(AuthSessionContext);
}

/** The lockout as the Login screen shows it; changes at most once per second while locked (pure). */
export function lockoutInfoOf(s: SimState): AuthLockoutInfo {
  const status = selectLockout(s);
  return {
    locked: status.locked,
    lockedUntilMs: status.lockedUntil,
    retryInSeconds: status.locked ? Math.ceil(status.retryInMs / 1000) : 0,
    attemptsRemaining: status.attemptsRemaining,
  };
}

/** The auth slice as both providers read it (primitives, so `useSim` compares it shallowly). */
export const selectAuthView = (s: SimState) => ({ status: s.auth.status, operatorId: s.auth.operatorId });

/** The contract's result for a sign-in result of the Core, simulated or not (pure). */
export function toContractSignInResult(result: SimSignInResult, operator: AuthOperator | null): SignInResult {
  if (result.ok) return operator ? { ok: true, operator } : { ok: false, reason: 'UNAVAILABLE' };
  if (result.reason === 'LOCKED') return { ok: false, reason: 'LOCKED', lockedUntilMs: result.lockedUntil };
  return { ok: false, reason: 'INVALID_CREDENTIALS', attemptsRemaining: result.attemptsRemaining };
}

/**
 * Sign In is disabled while the Core is down (04 §4.1 L6): heartbeat mode with the Core OFFLINE,
 * and LIVE mode while the link to the Core server is not ONLINE (04_client_integration_spec §9.5).
 */
export function isSignInBlocked(link: CoreLinkInfo): boolean {
  return isSignInBlockedBy(link);
}

/**
 * Activity for the idle lock: a throttled `touch()` on any touch inside the app. The simulator
 * counts it at once; a Live source reports it to the Core at most once a minute (CL-27), and
 * sends nothing while nobody is signed in. A failure is logged, never thrown.
 */
export function useActivityTouch(actions: CoreActions): () => void {
  const lastTouch = useRef(0);
  return useCallback(() => {
    const now = Date.now();
    if (now - lastTouch.current < ACTIVITY_THROTTLE_MS) return;
    lastTouch.current = now;
    settle(() => actions.touch(), { fail: (error) => reportRuntimeIssue('warn', 'auth.touch', error) });
  }, [actions]);
}

export interface AuthFrameProps {
  /** The runtime contract with the auth of this provider. */
  contract: RuntimeContract;
  session: AuthSession;
  /** Any touch inside the app. */
  onActivity: () => void;
  /** The global dialogs of the provider: rendered beside the app, so they survive a route change. */
  overlays?: ReactNode;
  children?: ReactNode;
}

/** What both providers render: the contract, the auth session, the activity boundary, the dialogs. */
export function AuthFrame({ contract, session, onActivity, overlays, children }: AuthFrameProps) {
  return (
    <RuntimeContractProvider value={contract}>
      <AuthSessionContext.Provider value={session}>
        <View testID="auth-activity-boundary" style={styles.fill} onTouchStart={onActivity}>
          {children}
        </View>
        {overlays}
      </AuthSessionContext.Provider>
    </RuntimeContractProvider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
