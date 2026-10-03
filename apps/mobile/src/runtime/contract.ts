/**
 * The runtime contract of the mobile app (step 68 typed it; step 73 implements it).
 *
 * What it is: the typed surface the navigation shell (step 70) and every screen build against.
 * The names and types of step 68 are kept; step 73 only added optional members, so fakes built
 * for step 68 (the step-70 router harness, T-M03) still type-check.
 *
 * Who provides it (04_mobile_specs §3.2 slots 9 and 10):
 * - `SimRuntimeProvider` (`sim-runtime-provider.tsx`): status (hydration), Core link, active
 *   session; auth is `UNAVAILABLE_AUTH` at that layer;
 * - `AuthProvider` (`src/auth`): re-provides the contract with the simulator-backed auth.
 * - `RuntimeContractProvider`: injects a complete value (tests, T-M03 fakes, debug tooling).
 */
import { createContext, createElement, useContext, type ReactNode } from 'react';
import type { CoreLinkState, HeartbeatState, SessionState } from '@dems/shared/domain';

export type RuntimeImplementation = 'stub' | 'simulator';

/** Reviews (steps 62, 63, 74) grep for this: the step-68 stub is gone once it reads 'simulator'. */
export const RUNTIME_IMPLEMENTATION: RuntimeImplementation = 'simulator';

// ---------------------------------------------------------------------------------------------
// Contract types
// ---------------------------------------------------------------------------------------------

/** Operator roles (01_specs §14.7 dataset, 04_mobile_specs §6.1). */
export type OperatorRole = 'INVESTIGATOR' | 'SUPERVISOR' | 'TECHNICIAN';

export interface AuthOperator {
  /** The simulator operator id, e.g. "OPR-001" (never the login name, S31-3). */
  readonly id: string;
  /** Display name with rank, e.g. "AKP Budi Santoso". */
  readonly displayName: string;
  /** Avatar initials from the name, e.g. "BS" (04 §9 #29). */
  readonly initials: string;
  readonly role: OperatorRole;
  /** Login name, e.g. "budi.santoso" (step 73; optional so step-68 fakes stay valid). */
  readonly username?: string;
}

export type SignInFailureReason = 'INVALID_CREDENTIALS' | 'LOCKED' | 'CORE_OFFLINE' | 'UNAVAILABLE';

export type SignInResult =
  | { readonly ok: true; readonly operator: AuthOperator }
  | {
      readonly ok: false;
      readonly reason: SignInFailureReason;
      /** Attempts left before the §6.1 lockout (INVALID_CREDENTIALS). */
      readonly attemptsRemaining?: number;
      /** Simulator-clock time the lockout ends, epoch ms (LOCKED). */
      readonly lockedUntilMs?: number;
    };

/** Why the operator left: user action, 15-min idle expiry, or Lock console (04 §3.3, §6.4). */
export type SignOutReason = 'USER' | 'IDLE' | 'LOCK';

export interface AuthContract {
  readonly isAuthenticated: boolean;
  readonly operator: AuthOperator | null;
  /** Credentials stay in memory for the call only: never stored, logged or put in a URL (04 §6.1). */
  signIn(username: string, password: string): Promise<SignInResult>;
  /** Never touches a recording (04 §3.3: "Recording is never touched by sign-out"). */
  signOut(reason?: SignOutReason): void;
}

/** Settings → App Preferences → "Core link source" (04 §4.4 step 2); default SIMULATED (Q-M8, D38). */
export type CoreLinkSource = 'SIMULATED' | 'HEARTBEAT';

export interface CoreLinkInfo {
  readonly source: CoreLinkSource;
  /** SIMULATED: the simulator's tablet link. HEARTBEAT: LIVE → ONLINE, anything else → OFFLINE. */
  readonly state: CoreLinkState;
  /** HEARTBEAT only: the client state behind `state` (Login ring: STALE → ATTENTION, 04 §4.1 L2). */
  readonly heartbeat?: HeartbeatState;
}

/** The session the live mini-bar (04 §3.8) and the post-sign-in resync (§3.3, §3.7) read. */
export interface ActiveSessionInfo {
  /** `null` = no session (IDLE, 01_specs §14.7). */
  readonly state: SessionState | null;
  readonly sessionId: string | null;
  /** Recording start on the simulator clock, epoch ms; timers derive from it (S4). */
  readonly startedAtMs: number | null;
  /**
   * SEALED sessions: false while the summary still waits for `acknowledgeSummary` (SCR-02), which
   * makes the §3.7 target `/session/summary/<id>`. Absent in step-68 fakes (counts as acknowledged).
   */
  readonly summaryAcknowledged?: boolean;
}

export interface RuntimeStatus {
  /** False until the simulator snapshot and the runtime prefs have hydrated (04 §5.2 hydration gate). */
  readonly ready: boolean;
  readonly implementation: RuntimeImplementation;
  /** True when the hydrated snapshot replaced the fresh dataset (a relaunch resumed, MA-08). */
  readonly restored?: boolean;
}

export interface RuntimeContract {
  readonly status: RuntimeStatus;
  readonly auth: AuthContract;
  readonly coreLink: CoreLinkInfo;
  readonly session: ActiveSessionInfo;
}

// ---------------------------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------------------------

export const IDLE_SESSION: ActiveSessionInfo = { state: null, sessionId: null, startedAtMs: null };
export const SIMULATED_ONLINE: CoreLinkInfo = { source: 'SIMULATED', state: 'ONLINE' };
const DEFAULT_STATUS: RuntimeStatus = { ready: true, implementation: RUNTIME_IMPLEMENTATION };

/** Signed-out auth that cannot sign in: the value outside `AuthProvider`. */
export const UNAVAILABLE_AUTH: AuthContract = {
  isAuthenticated: false,
  operator: null,
  signIn: async () => ({ ok: false, reason: 'UNAVAILABLE' }),
  signOut: () => {},
};

/** Initials from a display name or user id: "AKP Budi Santoso" → "BS", "budi.santoso" → "BS". */
export function initialsFor(name: string): string {
  const words = name
    .split(/[\s._-]+/)
    .filter((word) => /^[A-Za-z]/.test(word) && !/^[A-Z]{2,}$/.test(word)); // skip ranks such as "AKP"
  const letters = (words.length > 1 ? [words[0], words[words.length - 1]] : words).map((w) => w[0]!.toUpperCase());
  return letters.join('') || '?';
}

/**
 * A complete contract value for tests and debug tooling; unspecified parts take the defaults
 * (ready, signed out and unable to sign in, Core link SIMULATED/ONLINE, no session).
 */
export function createRuntimeContract(overrides: Partial<RuntimeContract> = {}): RuntimeContract {
  return {
    status: overrides.status ?? DEFAULT_STATUS,
    auth: overrides.auth ?? UNAVAILABLE_AUTH,
    coreLink: overrides.coreLink ?? SIMULATED_ONLINE,
    session: overrides.session ?? IDLE_SESSION,
  };
}

const RuntimeContext = createContext<RuntimeContract>(createRuntimeContract());

export interface RuntimeContractProviderProps {
  value: RuntimeContract;
  children?: ReactNode;
}

/** Provides a contract value: the runtime layers use it, and so do fakes in tests (T-M03). */
export function RuntimeContractProvider({ value, children }: RuntimeContractProviderProps) {
  return createElement(RuntimeContext.Provider, { value }, children);
}

// ---------------------------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------------------------

/** The full contract (prefer the narrow hooks below in screens). */
export function useRuntime(): RuntimeContract {
  return useContext(RuntimeContext);
}

/** Signed-in state and the sign-in/out actions (the `Stack.Protected` guard reads `isAuthenticated`). */
export function useAuth(): AuthContract {
  return useContext(RuntimeContext).auth;
}

/** The Core link as the app sees it (Login trust line, §5.3 Core check, connection banner). */
export function useCoreLink(): CoreLinkInfo {
  return useContext(RuntimeContext).coreLink;
}

/** The active session summary (live mini-bar, post-sign-in resync precedence). */
export function useActiveSession(): ActiveSessionInfo {
  return useContext(RuntimeContext).session;
}

/** Hydration status for the boot gate (04 §3.2: splash held until ready, at most 2 s). */
export function useRuntimeStatus(): RuntimeStatus {
  return useContext(RuntimeContext).status;
}
