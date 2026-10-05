/**
 * The refusal presenter of the mobile app (backend task W51; 04_client_integration_spec §6.2,
 * §8.1 LB-5 to LB-10, AC-C-48, AC-C-59; the Live source's brief list, row 20).
 *
 * One place words what a Live action can reject with, so a refusal reads the same on every screen:
 *
 * | The action rejected with | Kind | Toast | Coalesced |
 * |--------------------------|------|-------|-----------|
 * | `SimPermissionError` `NOT_PERMITTED` (403) | `DENIED` | danger: "Not permitted" / "Requires the X role" (the web's two sentences) | no |
 * | `SimPermissionError` `NOT_SIGNED_IN` (401) | `SIGNED_OUT` | warning: "You are signed out" | yes |
 * | `LiveTransportError`, status 429 (LB-10) | `LIMIT` | warning: "… is limiting requests …" / "Try again in N s." | yes |
 * | `LiveTransportError` `CORE_OFFLINE`, code `TIMEOUT` (LB-7) | `TIMEOUT` | danger: "Core server unreachable" / "The command may or may not have been applied; …" | yes |
 * | `LiveTransportError` `CORE_OFFLINE`, code `SNAPSHOT_TIMEOUT` | `SNAPSHOT_TIMEOUT` | danger: "Core server unreachable" / "The Core did not send its data in time. …" | yes |
 * | `LiveTransportError`, code `CREDENTIALS_UNAVAILABLE` or `CREDENTIALS_TIMEOUT` | `CREDENTIALS` | danger: "This tablet could not read its credential" / "Nothing was sent. …" | yes |
 * | `LiveTransportError`, code `STOPPED` | `STOPPED` | none: the screen that sent the command is gone | — |
 * | `LiveTransportError` `CORE_OFFLINE`, anything else (LB-6) | `OFFLINE` | danger: "Core server unreachable" / "Nothing was changed." | yes |
 * | `LiveTransportError` `UNAVAILABLE`, anything else (500, a contract violation) | `FAILED` | danger: "The Core server could not complete the request" | yes |
 * | `CoreRefusalError` `NOT_AVAILABLE` | `NOT_AVAILABLE` | warning: "Not available right now" | no |
 * | `CoreRefusalError`, any other code (`DEVICE_NOT_PAIRED` among them) | `REFUSED` | danger: "Demo controls are turned off …" for `DEMO_DISABLED`, else "The Core refused this action" | no |
 * | Anything else (`SimTransitionError`, `SimNotFoundError`, an unknown error) | — | none: the call site's own branch, as today (LB-5) | — |
 *
 * **A limit is not an outage (LB-10).** A 429 is told apart by its status before anything else:
 * it never gets the offline wording, and `outage` is false, so nothing that follows the link (the
 * connection banner, the Core chip) may be driven from it.
 *
 * **One toast (LB-6, AC-C-59).** A coalesced kind is shown once in `CORE_ERROR_COALESCE_MS`, over
 * every screen of the app: five presses on a dead link are one toast. A denial is never
 * coalesced: each press was refused and audited by the Core.
 *
 * `describeCoreError` is pure: no React, no toast, no clock. A screen that draws the refusal in
 * place (the Pair screen's error form, the Login alert) reads `kind` and `retryAfterSeconds` from
 * it; every other call site uses `useCoreErrorPresenter()`. The presentation holds i18n keys and
 * numbers only: nothing of an error's message, of a request or of a credential reaches a toast.
 */
import { useToast } from 'heroui-native';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CoreRefusalError, LiveTransportError, LiveTransportReason } from '@dems/shared/live';
import { OperatorRole, ROLE_PERMISSIONS, SimErrorCode, SimPermissionError } from '@dems/shared/sim';
import { triggerHaptic, type HapticEvent } from '@/motion/haptics';
import { reportRuntimeIssue } from './log';

/** One toast of a coalesced kind in this time (LB-6: "coalesced to one per 3 s"). */
export const CORE_ERROR_COALESCE_MS = 3_000;

export type CoreErrorKind =
  | 'DENIED'
  | 'SIGNED_OUT'
  | 'LIMIT'
  | 'TIMEOUT'
  | 'SNAPSHOT_TIMEOUT'
  | 'CREDENTIALS'
  | 'STOPPED'
  | 'OFFLINE'
  | 'FAILED'
  | 'NOT_AVAILABLE'
  | 'REFUSED';

/** An i18n key of the app's resources with its interpolation values. */
export interface CoreErrorText {
  readonly key: string;
  readonly values?: Readonly<Record<string, string | number>>;
}

export interface CoreErrorPresentation {
  readonly kind: CoreErrorKind;
  /** The toast variant. */
  readonly variant: 'danger' | 'warning';
  /** The toast's first sentence; `null` for a kind that shows nothing (`STOPPED`). */
  readonly label: CoreErrorText | null;
  readonly description: CoreErrorText | null;
  /** The role the denied toast names, or `null` (no role holds the permission, or another kind). */
  readonly role: OperatorRole | null;
  /** `retry-after` of a 429 in whole seconds, or `null`. */
  readonly retryAfterSeconds: number | null;
  /** True when the Core server gave no answer: the only kinds a "link lost" notice may follow. Never true for a 429 (LB-10). */
  readonly outage: boolean;
  /** Shown once in `CORE_ERROR_COALESCE_MS`. */
  readonly coalesced: boolean;
  /** The haptic of the settle, by the existing map (LB-8); `null` for none. */
  readonly haptic: HapticEvent | null;
}

/** Least privileged first, as the web console orders them: "Requires the X role" names the first holder. */
const ROLE_ORDER: readonly OperatorRole[] = [OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR, OperatorRole.TECHNICIAN];

/**
 * The first role that holds the permission a refusal names. `label` is the simulator's own form:
 * one permission, or `A | B` for an any-of rule; then the first role that holds any of them.
 */
export function requiredRoleFor(label: string): OperatorRole | null {
  const wanted = label
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  if (wanted.length === 0) return null;
  return ROLE_ORDER.find((role) => (ROLE_PERMISSIONS[role] as readonly string[]).some((held) => wanted.includes(held))) ?? null;
}

const HTTP_TOO_MANY_REQUESTS = 429;
/** Codes of a `LiveTransportError` (the typed client's and the Live source's own words). */
const CODE_TIMEOUT = 'TIMEOUT';
const CODE_SNAPSHOT_TIMEOUT = 'SNAPSHOT_TIMEOUT';
const CODE_STOPPED = 'STOPPED';
const CODE_RATE_LIMITED = 'RATE_LIMITED';
const CREDENTIAL_CODES: readonly string[] = ['CREDENTIALS_UNAVAILABLE', 'CREDENTIALS_TIMEOUT'];
/** Codes of a `CoreRefusalError`. */
const CODE_NOT_AVAILABLE = 'NOT_AVAILABLE';
/**
 * A map, not an object: a code that names an inherited member (`toString`) must find nothing.
 *
 * `DEVICE_NOT_PAIRED` has no text of its own, on purpose (decision D118): the Core also answers it
 * when an operation wants the device credential and got a session token (`details.reason:
 * 'DEVICE_CREDENTIAL_REQUIRED'`), which is a mistake of the caller, not an unpaired tablet. The
 * error carries no `details`, so the two cannot be told apart here: both read as an ordinary
 * refused action. Whether the tablet is paired is the pairing gate's word (`usePairing()`), and
 * only `DEVICE_REVOKED` retires a credential.
 */
const REFUSAL_TEXT: ReadonlyMap<string, string> = new Map([['DEMO_DISABLED', 'mobile.live.refusal.demoDisabled']]);

function presentation(
  kind: CoreErrorKind,
  variant: CoreErrorPresentation['variant'],
  label: CoreErrorText | null,
  description: CoreErrorText | null,
  rest: Partial<Pick<CoreErrorPresentation, 'role' | 'retryAfterSeconds' | 'outage' | 'coalesced' | 'haptic'>> = {},
): CoreErrorPresentation {
  return {
    kind,
    variant,
    label,
    description,
    role: rest.role ?? null,
    retryAfterSeconds: rest.retryAfterSeconds ?? null,
    outage: rest.outage ?? false,
    coalesced: rest.coalesced ?? false,
    haptic: rest.haptic ?? null,
  };
}

function describeTransport(error: LiveTransportError): CoreErrorPresentation {
  // LB-10 first: a 429 is a limit whatever else the error says.
  if (error.status === HTTP_TOO_MANY_REQUESTS || error.code === CODE_RATE_LIMITED) {
    const seconds = error.retryAfterSeconds !== null && Number.isFinite(error.retryAfterSeconds) && error.retryAfterSeconds > 0 ? Math.ceil(error.retryAfterSeconds) : null;
    return presentation(
      'LIMIT',
      'warning',
      { key: 'mobile.live.refusal.limit' },
      seconds === null ? { key: 'mobile.live.refusal.limitHintSoon' } : { key: 'mobile.live.refusal.limitHint', values: { seconds } },
      { retryAfterSeconds: seconds, coalesced: true, haptic: 'gateWarn' },
    );
  }
  if (error.code === CODE_STOPPED) return presentation('STOPPED', 'warning', null, null);
  if (error.code !== null && CREDENTIAL_CODES.includes(error.code)) {
    return presentation('CREDENTIALS', 'danger', { key: 'mobile.live.refusal.credentials' }, { key: 'mobile.live.refusal.credentialsHint' }, {
      coalesced: true,
      haptic: 'gateBlock',
    });
  }
  if (error.reason === LiveTransportReason.CORE_OFFLINE) {
    const offline = { key: 'mobile.live.refusal.offline' };
    const rest = { outage: true, coalesced: true, haptic: 'coreLinkLost' } as const;
    if (error.code === CODE_TIMEOUT) return presentation('TIMEOUT', 'danger', offline, { key: 'mobile.live.refusal.timeoutHint' }, rest);
    if (error.code === CODE_SNAPSHOT_TIMEOUT) return presentation('SNAPSHOT_TIMEOUT', 'danger', offline, { key: 'mobile.live.refusal.snapshotHint' }, rest);
    return presentation('OFFLINE', 'danger', offline, { key: 'mobile.live.refusal.offlineHint' }, rest);
  }
  return presentation('FAILED', 'danger', { key: 'mobile.live.refusal.failed' }, { key: 'mobile.live.refusal.failedHint' }, {
    coalesced: true,
    haptic: 'gateBlock',
  });
}

/**
 * What the app shows for a rejected Core action, or `null` when the error is not the presenter's:
 * the call site then keeps its own branch (LB-5). Pure.
 */
export function describeCoreError(error: unknown): CoreErrorPresentation | null {
  if (error instanceof SimPermissionError) {
    if (error.code === SimErrorCode.NOT_SIGNED_IN) {
      return presentation('SIGNED_OUT', 'warning', { key: 'mobile.live.refusal.signedOut' }, { key: 'mobile.live.refusal.signedOutHint' }, { coalesced: true });
    }
    const role = requiredRoleFor(error.permission);
    return presentation(
      'DENIED',
      'danger',
      { key: 'common.rbac.deniedTitle' },
      // The role's own name is filled in by the hook: it is a translated word, not a value of the error.
      role === null ? null : { key: 'common.rbac.requiresRole' },
      { role, haptic: 'gateBlock' },
    );
  }
  if (error instanceof LiveTransportError) return describeTransport(error);
  if (error instanceof CoreRefusalError) {
    if (error.code === CODE_NOT_AVAILABLE) {
      return presentation('NOT_AVAILABLE', 'warning', { key: 'mobile.live.refusal.notAvailable' }, { key: 'mobile.live.refusal.notAvailableHint' });
    }
    return presentation('REFUSED', 'danger', { key: REFUSAL_TEXT.get(error.code) ?? 'mobile.live.refusal.refused' }, null, { haptic: 'gateBlock' });
  }
  return null;
}

/** Remembers when each coalesced kind was last shown. One per app: the rule holds across screens. */
export interface CoreErrorCoalescer {
  /** True when a toast of `kind` may be shown now; it then counts as shown. */
  admit(kind: CoreErrorKind): boolean;
  reset(): void;
}

export function createCoreErrorCoalescer(now: () => number = () => Date.now(), windowMs: number = CORE_ERROR_COALESCE_MS): CoreErrorCoalescer {
  const shownAt = new Map<CoreErrorKind, number>();
  return {
    admit(kind) {
      const at = now();
      const last = shownAt.get(kind);
      // A clock that went back opens the window: a toast too many is better than a silent refusal.
      if (last !== undefined && at >= last && at - last < windowMs) return false;
      shownAt.set(kind, at);
      return true;
    },
    reset() {
      shownAt.clear();
    },
  };
}

const appCoalescer = createCoreErrorCoalescer();

/** Test hook: forget what was shown, so each test starts with an open window. */
export function resetCoreErrorPresenterForTests(): void {
  appCoalescer.reset();
}

/** What `present` did with an error. */
export type CoreErrorOutcome =
  /** Not the presenter's: the call site shows its own message. */
  | 'unhandled'
  /** A toast was shown. */
  | 'shown'
  /** The same kind was shown less than `CORE_ERROR_COALESCE_MS` ago: nothing more is shown. */
  | 'coalesced'
  /** The presenter's, and nothing is to be shown (`STOPPED`). */
  | 'silent';

export interface CoreErrorPresenter {
  /**
   * Shows the toast of a rejected Core action. Returns true when the error was the presenter's (a
   * toast was shown, or it was coalesced, or it is silent): the call site then shows nothing more
   * and returns its control to idle. False: the call site's own branch.
   */
  (error: unknown): boolean;
  /** The same, telling what was done. */
  present(error: unknown): CoreErrorOutcome;
}

/**
 * The presenter as a hook: `const presentCoreError = useCoreErrorPresenter()`, then, in the `fail`
 * branch of a `settle`, `if (presentCoreError(error)) return;` before the site's own message.
 */
export function useCoreErrorPresenter(coalescer: CoreErrorCoalescer = appCoalescer): CoreErrorPresenter {
  const { t } = useTranslation();
  const { toast } = useToast();
  const present = useCallback(
    (error: unknown): CoreErrorOutcome => {
      const shown = describeCoreError(error);
      if (shown === null) return 'unhandled';
      if (shown.label === null) return 'silent';
      if (shown.coalesced && !coalescer.admit(shown.kind)) return 'coalesced';
      const values = shown.role === null ? shown.description?.values : { role: t(`common.roles.${shown.role}`) };
      try {
        toast.show({
          variant: shown.variant,
          label: t(shown.label.key, shown.label.values ?? {}),
          ...(shown.description ? { description: t(shown.description.key, values ?? {}) } : {}),
        });
        if (shown.haptic !== null) triggerHaptic(shown.haptic);
      } catch (failure) {
        // A toast that cannot be shown must not turn a refusal into a crash; the refusal itself was
        // reported by the Live source (CL-24).
        reportRuntimeIssue('error', 'runtime.coreErrors.present', failure, { kind: shown.kind });
      }
      return 'shown';
    },
    [t, toast, coalescer],
  );
  return useMemo(() => Object.assign((error: unknown) => present(error) !== 'unhandled', { present }), [present]);
}
