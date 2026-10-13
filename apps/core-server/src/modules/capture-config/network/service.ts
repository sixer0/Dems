/**
 * What operations 101 and 102 do (task 4 blueprint row 108, package WP-19d; contract
 * `packages/shared/src/api/capture-commissioning.ts`, row 102; schema set B; decisions U10, U11).
 *
 * OPERATION 101 reads the one row. An empty table answers the contract's defaults with
 * `revision: 1`, no interface, no subnet, `updatedAt: null`. Nothing is written by a read.
 *
 * OPERATION 102, in this order, each refusal storing NOTHING and writing NO audit row:
 *
 *   409 CAPTURE_CONFIG_LOCKED                      a session is open (asked before the unit and again inside it)
 *   409 INVALID_STATE  COMMISSIONING_NOT_AVAILABLE this Core is not in production capture, or the host's
 *                                                  interfaces cannot be read for a chosen interface
 *   409 INVALID_STATE  REVISION_CONFLICT           `revision` of the body is not the stored one
 *   422 INVALID_INPUT  NETWORK_CONFIG_NOT_ALLOWED  a CHANGED setting is refused as a whole: an interface the
 *                                                  host does not have, a subnet the destination rule does not
 *                                                  accept (host bits set), a factory address listed twice or
 *                                                  one the rule does not class as a private host address
 *   200, unchanged revision, no row                the body changes nothing
 *   200                                            ONE unit of work: the row, ONE CAPTURE_NETWORK_CONFIG_CHANGED
 *                                                  entry (the NAMES of the changed settings and the new
 *                                                  revision; never a value), and - after the commit, never for
 *                                                  a unit that rolled back - the new row handed to the reader of
 *                                                  the network facts (`committed`)
 *
 * THE CORE CHOOSES NOTHING. The interface is what the technician wrote, or null; it is only
 * compared with the names the host states, through the reader handed in. A setting the body does
 * not carry, and one it repeats unchanged, is left as it is and is not judged again.
 *
 * No refusal quotes an address, an interface name or any other part of the body; no log line of
 * this file holds one either (names of settings, counts and codes only).
 */
import {
  ApiErrorCode,
  CAPTURE_COMMISSIONING_REFUSAL_SENTENCES,
  CAPTURE_NETWORK_CONFIG_DEFAULTS,
  CAPTURE_NETWORK_CONFIG_FIELDS,
  CAPTURE_NETWORK_CONFIG_LIMITS,
  CaptureCommissioningReason,
  STT_REVISION_CONFLICT_REASON,
  type CaptureNetworkConfig,
  type CaptureNetworkConfigField,
  type CaptureNetworkConfigUpdateRequest,
} from '@dems/shared/api';
import { AuditType, Permission } from '@dems/shared/sim';
import type { AuditEntry } from '../../../core';
import { ApiFailure } from '../../../plugins/error-envelope';
import { cameraSubnetAccepted, factoryAddressAccepted, hostHoldsInterface, type HostInterface } from './facts';
import type { NetworkConfigStore, NetworkConfigValues, Queryable, StoredNetworkConfig } from './store';

/** The operator behind a request, as stage 4 resolved it. */
export interface NetworkConfigCaller {
  readonly operatorId: string;
  readonly deviceId: string | null;
}

/** The unit of work of a change, as far as this file uses it. `index.ts` builds it on a unit of the engine. */
export interface NetworkConfigUnit {
  readonly db: Queryable;
  /** True when a session is open in the state this unit sees. */
  sessionOpen(): boolean;
  audit(entry: AuditEntry): Promise<void>;
  /** Runs after the commit, never for a unit that rolled back. */
  afterCommit(task: () => void): void;
}

export interface NetworkConfigHost {
  now(): number;
  sessionOpen(): boolean;
  /** A read on the pool, outside a unit. */
  read<Value>(label: string, work: (db: Queryable) => Promise<Value>): Promise<Value>;
  /** One unit of work: everything `work` writes commits together or not at all. Rejects with what `work` threw. */
  unit<Value>(label: string, work: (unit: NetworkConfigUnit) => Promise<Value>): Promise<Value>;
  /** A line of the log: codes, names of settings and counts only. */
  note(fields: Record<string, unknown>, message: string): void;
  /** A failure for the log AND the persistent error log. */
  failed(source: string, message: string, error: unknown): void;
}

export interface NetworkConfigSeams {
  readonly host: NetworkConfigHost;
  readonly store: NetworkConfigStore;
  /** True on a Core in production capture: the only Core whose camera network can be set up. */
  available(): boolean;
  /** The interfaces of the host, now. May throw: a chosen interface is then not judged and the change is refused. */
  interfaces(): readonly HostInterface[];
  /** The row a unit committed: the reader of the network facts answers from it from now on. */
  committed(stored: StoredNetworkConfig): void;
}

export const NETWORK_CONFIG_READ_LABEL = 'captureNetworkConfig.read';
export const NETWORK_CONFIG_UNIT_LABEL = 'captureNetworkConfig.update';
export const NETWORK_CONFIG_CHANGED_MESSAGE = 'Camera network configuration changed';
const SOURCE = 'captureNetworkConfig';
const HOST_UNREADABLE = 'the network interfaces of the host could not be read: the chosen camera interface was not judged and nothing was stored';

// ── Refusals: fixed texts that quote nothing of the request ────────────────────────────────────

const R = CaptureCommissioningReason;
const locked = (): ApiFailure => new ApiFailure(409, ApiErrorCode.CAPTURE_CONFIG_LOCKED, 'The capture configuration cannot be changed while a session is open.');
const notAvailable = (): ApiFailure =>
  new ApiFailure(409, ApiErrorCode.INVALID_STATE, CAPTURE_COMMISSIONING_REFUSAL_SENTENCES[R.COMMISSIONING_NOT_AVAILABLE], { details: { reason: R.COMMISSIONING_NOT_AVAILABLE } });
const revisionConflict = (currentRevision: number): ApiFailure =>
  new ApiFailure(409, ApiErrorCode.INVALID_STATE, 'The camera network configuration changed since it was read. Read it again.', { details: { reason: STT_REVISION_CONFLICT_REASON, currentRevision } });
const notAllowed = (): ApiFailure =>
  new ApiFailure(422, ApiErrorCode.INVALID_INPUT, CAPTURE_COMMISSIONING_REFUSAL_SENTENCES[R.NETWORK_CONFIG_NOT_ALLOWED], { details: { in: 'body', reason: R.NETWORK_CONFIG_NOT_ALLOWED } });

// ── The answer ─────────────────────────────────────────────────────────────────────────────────

/** The revision of a configuration nobody has written yet. */
export const UNWRITTEN_REVISION = 1;

/** The settings of an empty table: the contract's defaults; no interface and no subnet, because the Core chooses neither. */
const UNWRITTEN: NetworkConfigValues = Object.freeze({
  interfaceName: null,
  cameraSubnet: null,
  factoryAddresses: CAPTURE_NETWORK_CONFIG_DEFAULTS.factoryAddresses,
  aliasHost: CAPTURE_NETWORK_CONFIG_DEFAULTS.aliasHost,
  aliasMinutes: CAPTURE_NETWORK_CONFIG_DEFAULTS.aliasMinutes,
  cameraIpStart: CAPTURE_NETWORK_CONFIG_DEFAULTS.cameraIpStart,
});

/** The body of operations 101 and 102 from the stored row, or from an empty table. */
export function networkConfigOf(stored: StoredNetworkConfig | null): CaptureNetworkConfig {
  const values: NetworkConfigValues = stored ?? UNWRITTEN;
  return {
    configured: values.interfaceName !== null && values.cameraSubnet !== null,
    interfaceName: values.interfaceName,
    cameraSubnet: values.cameraSubnet,
    factoryAddresses: [...values.factoryAddresses],
    aliasHost: values.aliasHost,
    aliasMinutes: values.aliasMinutes,
    cameraIpStart: values.cameraIpStart,
    revision: stored === null ? UNWRITTEN_REVISION : stored.revision,
    updatedAt: stored === null ? null : stored.updatedAt,
    updatedBy: stored === null ? null : stored.updatedBy,
  };
}

// ── Operation 101 ──────────────────────────────────────────────────────────────────────────────

export async function readNetworkConfig(seams: NetworkConfigSeams): Promise<CaptureNetworkConfig> {
  return networkConfigOf(await seams.host.read(NETWORK_CONFIG_READ_LABEL, (db) => seams.store.read(db)));
}

// ── Operation 102 ──────────────────────────────────────────────────────────────────────────────

const sameList = (left: readonly string[], right: readonly string[]): boolean => left.length === right.length && left.every((entry, index) => entry === right[index]);

/** The settings after the body: a member the body does not carry stays as it is. */
function merged(current: NetworkConfigValues, body: CaptureNetworkConfigUpdateRequest): NetworkConfigValues {
  return {
    interfaceName: body.interfaceName === undefined ? current.interfaceName : body.interfaceName,
    cameraSubnet: body.cameraSubnet === undefined ? current.cameraSubnet : body.cameraSubnet,
    factoryAddresses: body.factoryAddresses === undefined ? current.factoryAddresses : body.factoryAddresses,
    aliasHost: body.aliasHost ?? current.aliasHost,
    aliasMinutes: body.aliasMinutes ?? current.aliasMinutes,
    cameraIpStart: body.cameraIpStart ?? current.cameraIpStart,
  };
}

/** The NAMES of the settings that differ, in the contract's order. */
function changedFieldsOf(current: NetworkConfigValues, next: NetworkConfigValues): CaptureNetworkConfigField[] {
  return CAPTURE_NETWORK_CONFIG_FIELDS.filter((field) => (field === 'factoryAddresses' ? !sameList(current.factoryAddresses, next.factoryAddresses) : current[field] !== next[field]));
}

/** The interfaces of the host for the ONE comparison of a chosen name; a reader that throws refuses the change. */
function hostInterfaces(seams: NetworkConfigSeams): readonly HostInterface[] {
  try {
    return seams.interfaces();
  } catch (error) {
    seams.host.failed(`${SOURCE}.hostInterfaces`, HOST_UNREADABLE, error);
    throw notAvailable();
  }
}

/** Every CHANGED setting through the forms of the destination rule and against the host. Throws the one refusal. */
function judge(seams: NetworkConfigSeams, next: NetworkConfigValues, changed: readonly CaptureNetworkConfigField[]): void {
  if (changed.includes('cameraSubnet') && next.cameraSubnet !== null && !cameraSubnetAccepted(next.cameraSubnet)) throw notAllowed();
  if (changed.includes('factoryAddresses')) {
    const list = next.factoryAddresses;
    if (list.length > CAPTURE_NETWORK_CONFIG_LIMITS.factoryAddressesMax || new Set(list).size !== list.length || !list.every(factoryAddressAccepted)) throw notAllowed();
  }
  // Last: the only judgement that reads the host.
  if (changed.includes('interfaceName') && next.interfaceName !== null && !hostHoldsInterface(hostInterfaces(seams), next.interfaceName)) throw notAllowed();
}

export async function changeNetworkConfig(seams: NetworkConfigSeams, caller: NetworkConfigCaller, body: CaptureNetworkConfigUpdateRequest): Promise<CaptureNetworkConfig> {
  const { host, store } = seams;
  if (host.sessionOpen()) throw locked();
  if (!seams.available()) throw notAvailable();

  const outcome = await host.unit(NETWORK_CONFIG_UNIT_LABEL, async (unit) => {
    // A session that opened meanwhile: the addresses of the camera port are not touched during a recording.
    if (unit.sessionOpen()) throw locked();
    const stored = await store.read(unit.db);
    const currentRevision = stored === null ? UNWRITTEN_REVISION : stored.revision;
    if (body.revision !== currentRevision) throw revisionConflict(currentRevision);

    const current: NetworkConfigValues = stored ?? UNWRITTEN;
    const next = merged(current, body);
    const changedFields = changedFieldsOf(current, next);
    // Nothing to store: no statement, no entry, the revision stays.
    if (changedFields.length === 0) return { answer: networkConfigOf(stored), changedFields };
    judge(seams, next, changedFields);

    const now = host.now();
    const write = { values: next, operatorId: caller.operatorId, now };
    const revision = currentRevision + 1;
    const written = stored === null ? await store.insert(unit.db, write, revision) : await store.update(unit.db, write, currentRevision);
    // Another writer changed the row between the read and the write of this unit: the caller reads again.
    if (!written) throw revisionConflict(currentRevision);

    await unit.audit({
      type: AuditType.CAPTURE_NETWORK_CONFIG_CHANGED,
      message: NETWORK_CONFIG_CHANGED_MESSAGE,
      actorId: caller.operatorId,
      deviceId: caller.deviceId,
      details: { changedFields: changedFields.join(','), revision, operationId: 'updateCaptureNetworkConfig', permission: Permission.CAPTURE_COMMISSION },
    });
    const after: StoredNetworkConfig = { ...next, factoryAddresses: Object.freeze([...next.factoryAddresses]), revision, updatedBy: caller.operatorId, updatedAt: now };
    unit.afterCommit(() => seams.committed(after));
    return { answer: networkConfigOf(after), changedFields };
  });

  if (outcome.changedFields.length > 0) {
    // Names of settings and two facts. Never a value of the body.
    host.note({ code: AuditType.CAPTURE_NETWORK_CONFIG_CHANGED, source: SOURCE, changedFields: outcome.changedFields.join(','), revision: outcome.answer.revision, configured: outcome.answer.configured }, 'camera network configuration changed');
  }
  return outcome.answer;
}
