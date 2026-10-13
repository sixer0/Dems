/**
 * What operations 104 `getHostAlias` and 105 `removeHostAlias` do (task 4 row 106b; contract
 * `packages/shared/src/api/capture-commissioning.ts`, row 102; decisions C19, C74 (D-1), U10;
 * security item S13-10).
 *
 * 104 IS A PLAIN READ of the one open row of the alias lifecycle's journal: no helper call, no
 * write, no audit entry. It answers on every Core and while a session is open.
 *
 * 105 IS THE TECHNICIAN'S REMOVAL: `release({ removeReason: MANUAL })` of the ONE lifecycle the
 * composition of production capture made and handed in. The address is never taken from the
 * request (there is no body): the lifecycle names it from its own state. Each refusal below asks
 * NOTHING of the helper and writes NOTHING, but the last:
 *
 *   409 CAPTURE_CONFIG_LOCKED                               a session is open (decision C74, D-1: a
 *                                                           MANUAL removal is refused then; the
 *                                                           system's own removals are not)
 *   409 INVALID_STATE  COMMISSIONING_NOT_AVAILABLE          this Core is not in production capture,
 *                                                           was handed no lifecycle, or the helper
 *                                                           does not exist on this platform
 *   409 INVALID_STATE  COMMISSIONING_JOB_IN_PROGRESS        a scan runs: its own removal is under way
 *   409 INVALID_STATE  HOST_ALIAS_NOT_PRESENT               none is in place
 *   409 INVALID_STATE  COMMISSIONING_HELPER_NOT_CONFIGURED  the helper cannot be reached as installed
 *   409 INVALID_STATE  HOST_ALIAS_REMOVE_FAILED + cause     the helper was asked and did not remove
 *                                                           it: the address is still in place, the
 *                                                           lifecycle wrote ONE HOST_ALIAS_REMOVE_FAILED
 *                                                           entry and armed its retry
 *
 * THE AUDIT ENTRIES ARE THE LIFECYCLE'S: `HOST_ALIAS_REQUESTED` before the helper is called, then
 * `HOST_ALIAS_REMOVED` (`removeReason: MANUAL`) or `HOST_ALIAS_REMOVE_FAILED`. This file writes none.
 *
 * `details.cause` is a CODE of a closed set, never a text of the helper. This file opens nothing,
 * starts nothing and logs nothing: everything is a seam.
 */
import { ApiErrorCode, CAPTURE_COMMISSIONING_REFUSAL_SENTENCES, CaptureCommissioningReason, type HostAlias, type HostAliasState } from '@dems/shared/api';
import { Permission } from '@dems/shared/sim';
import { ApiFailure } from '../../../plugins/error-envelope';

/** The operator behind a request, as stage 4 resolved it. */
export interface HostAliasRouteCaller {
  readonly operatorId: string;
  readonly deviceId: string | null;
}

export const HOST_ALIAS_REMOVE_OPERATION_ID = 'removeHostAlias';

/** What a removal answers: the lifecycle's `HostAliasReleased`, by shape. */
export type HostAliasRemoval = { readonly ok: true; readonly removed: boolean } | { readonly ok: false; readonly refusal: string; readonly stillInPlace: boolean };

/**
 * THE LIFECYCLE AS THIS FOLDER TAKES IT (the capture unit's `HostAliasLifecycle` fits it): the
 * technician's removal, and the removal at the close of the app. Neither rejects.
 */
export interface HostAliasRemover {
  release(request: {
    readonly removeReason: 'MANUAL';
    readonly actor: { readonly operatorId: string; readonly deviceId: string | null; readonly operationId: string; readonly permission: string };
  }): Promise<HostAliasRemoval>;
  shutdown(): Promise<unknown>;
}

export interface HostAliasRouteSeams {
  /** True while a session is open. Throws the engine's own refusal when the engine does not run. */
  sessionOpen(): boolean;
  /** The alias in place, or null: the plain read of the journal's one open row. */
  state(): Promise<HostAlias | null>;
  /** True on a Core in production capture. */
  available(): boolean;
  /** The lifecycle the composition handed in, or null. */
  remover(): HostAliasRemover | null;
  /** True while a scan (or, with row 111, a set-network job) runs. */
  jobRunning(): boolean;
}

const R = CaptureCommissioningReason;
const sentence = (reason: CaptureCommissioningReason): string => CAPTURE_COMMISSIONING_REFUSAL_SENTENCES[reason];
const locked = (): ApiFailure => new ApiFailure(409, ApiErrorCode.CAPTURE_CONFIG_LOCKED, 'The alias address cannot be removed while a session is open.');
const invalidState = (reason: CaptureCommissioningReason): ApiFailure => new ApiFailure(409, ApiErrorCode.INVALID_STATE, sentence(reason), { details: { reason } });
const removeFailed = (cause: string): ApiFailure => new ApiFailure(409, ApiErrorCode.INVALID_STATE, sentence(R.HOST_ALIAS_REMOVE_FAILED), { details: { reason: R.HOST_ALIAS_REMOVE_FAILED, cause } });

/** The lifecycle's refusal while a session is open (`HostAliasLifecycleRefusal.SESSION_OPEN`; the journal's is the same word). */
export const ALIAS_REFUSED_SESSION = 'SESSION_IS_OPEN';
/** The helper does not exist on this platform (`HostAliasCoreRefusal`, row 105). */
const NOT_THIS_PLATFORM = 'NOT_AVAILABLE_ON_THIS_PLATFORM';
/** The helper cannot be reached as installed: the words of the check before dialling (row 105). */
const HELPER_NOT_AS_INSTALLED: readonly string[] = ['HELPER_NOT_CONFIGURED', 'HELPER_NOT_INSTALLED', 'HELPER_SOCKET_UNSAFE'];
/** `details.cause` when the lifecycle's word is not a code. */
export const ALIAS_REMOVAL_CAUSE_UNNAMED = 'ALIAS_REMOVAL_NOT_CONFIRMED';
const CODE = /^[A-Z][A-Z0-9_]{0,63}$/;

/** Operation 104. */
export async function readHostAlias(seams: HostAliasRouteSeams): Promise<HostAliasState> {
  return { alias: await seams.state() };
}

/** Operation 105. */
export async function removeHostAlias(seams: HostAliasRouteSeams, caller: HostAliasRouteCaller): Promise<HostAliasState> {
  if (seams.sessionOpen()) throw locked();
  const remover = seams.available() ? seams.remover() : null;
  if (remover === null) throw invalidState(R.COMMISSIONING_NOT_AVAILABLE);
  if (seams.jobRunning()) throw invalidState(R.COMMISSIONING_JOB_IN_PROGRESS);

  const removal = await remover.release({
    removeReason: 'MANUAL',
    actor: { operatorId: caller.operatorId, deviceId: caller.deviceId, operationId: HOST_ALIAS_REMOVE_OPERATION_ID, permission: Permission.CAPTURE_COMMISSION },
  });
  if (removal.ok) {
    if (!removal.removed) throw invalidState(R.HOST_ALIAS_NOT_PRESENT);
    return { alias: null };
  }
  // A session that opened since the look above: seen by the lifecycle, or inside the unit of its intent.
  if (removal.refusal === ALIAS_REFUSED_SESSION) throw locked();
  if (removal.refusal === NOT_THIS_PLATFORM) throw invalidState(R.COMMISSIONING_NOT_AVAILABLE);
  if (HELPER_NOT_AS_INSTALLED.includes(removal.refusal)) throw invalidState(R.COMMISSIONING_HELPER_NOT_CONFIGURED);
  throw removeFailed(typeof removal.refusal === 'string' && CODE.test(removal.refusal) ? removal.refusal : ALIAS_REMOVAL_CAUSE_UNNAMED);
}
