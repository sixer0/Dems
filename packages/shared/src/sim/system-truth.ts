/**
 * ONE STATEMENT OF SYSTEM STATE (fix wave J; decision D243; truth rule 3c; findings JT-01, JW-05,
 * JA2-04).
 *
 * `systemStatus` (`selectors.ts`) derives READY / ATTENTION / CRITICAL from the device slices and
 * the fault list. It does not know of three things the Core states elsewhere, and so a Home, a
 * header pill and a status ring said "READY - All systems operational"
 *
 *   - while a seal failed and was being retried, and while it was BLOCKED (the Core takes no new
 *     session then): the facts are in the open session's finalization steps and in the alert of
 *     reason `SEAL_BLOCKED`;
 *   - beside a capture source that does not answer (a red "Not reachable" tile and one new alert):
 *     the fact is the active alert of reason `CAPTURE_DEVICE_UNREACHABLE`;
 *   - for minutes after the link to the Core was cut: then the client holds a replica that nobody
 *     updates, and it knows nothing.
 *
 * `systemTruthOf` is the ONE reader for every surface that states the system at a glance (the web
 * console's ring and pill, the devices' Home, header and ring). It adds no flag id to
 * `systemStatus` - the finite flag set and every wording table keyed by it stay as they are - and
 * it states the further facts beside the flags:
 *
 *   every ACTIVE alert of kind SYSTEM whose severity is WARNING or CRITICAL is a fact (id = its
 *   `params.reason`): a blocked seal, an unsealable recording that nobody has acknowledged, a
 *   source that does not answer, an empty camera search, a volume that does not sync;
 *   a seal that is being retried is a fact (`SEAL_RETRYING`: no alert exists for it);
 *   a lost Core link (the CLIENT says it: `coreLinkLost`) makes the state UNKNOWN - never READY.
 *
 * Pure: no clock, no store. A client passes its replica and whether its link is lost.
 */
import { sealAttentionOf } from './seal-blocked';
import { alertBlocksRecording } from './seal-unsealable';
import { systemStatus, type SystemSeverity, type SystemStatusDetail } from './selectors';
import type { SimAlert, SimState } from './types';
import { SystemState } from './vocabulary';

/** The fact a seal is being retried (no alert carries it). */
export const SYSTEM_FACT_SEAL_RETRYING = 'SEAL_RETRYING';
/** The fact the client lost its link to the Core. */
export const SYSTEM_FACT_CORE_LINK_LOST = 'CORE_LINK_LOST';
/** The state of a client that has lost its link: it knows nothing of the Core. */
export const SYSTEM_STATE_UNKNOWN = 'UNKNOWN';
/** The sentence of that state (English fallback; a client words it). */
export const CORE_LINK_LOST_SENTENCE = 'Core offline — state unknown';

export interface SystemTruthFact {
  /** `params.reason` of the alert (`SEAL_BLOCKED`, `UNSEALABLE`, `CAPTURE_DEVICE_UNREACHABLE`, ...), `SEAL_RETRYING` or `CORE_LINK_LOST`. */
  readonly id: string;
  readonly severity: 'WARNING' | 'CRITICAL';
  /** The Core's sentence (the alert's message), or the fallback of a fact without an alert. */
  readonly message: string;
  /** The device, the session or the volume the fact is about, when it names one. */
  readonly target: string | null;
  /** The alert that carries the fact, when one does. */
  readonly alertId: string | null;
  /** True: the Core takes no new session. False: it says recording is not blocked. Null: the fact does not say. */
  readonly blocksRecording: boolean | null;
}

export interface SystemTruth {
  /** READY only when no flag and no fact exists and the link is up. UNKNOWN when the link is lost. */
  readonly state: SystemState | typeof SYSTEM_STATE_UNKNOWN;
  readonly severity: SystemSeverity | typeof SYSTEM_STATE_UNKNOWN;
  /** The flags of `systemStatus`, as before. */
  readonly flags: SystemStatusDetail['flags'];
  /** What the Core states beyond the flags. */
  readonly facts: readonly SystemTruthFact[];
  /** True exactly when a surface may say "All systems operational". */
  readonly allOperational: boolean;
}

export interface SystemTruthOptions {
  /** The client's link to the Core is lost (its replica is not updated). Absent / false: the link is up, or the reader is the Core itself. */
  readonly coreLinkLost?: boolean;
}

type TruthState = SimState;

function factOfAlert(alert: SimAlert): SystemTruthFact | null {
  if (!alert.active || alert.kind !== 'SYSTEM') return null;
  if (alert.severity !== 'WARNING' && alert.severity !== 'CRITICAL') return null;
  const reason = alert.params?.['reason'];
  if (typeof reason !== 'string' || reason === '') return null;
  return { id: reason, severity: alert.severity, message: alert.message, target: alert.target ?? null, alertId: alert.id, blocksRecording: alertBlocksRecording(alert) };
}

/** The facts beyond the flags, in the order of the alert list, then the retry of a seal. */
export function systemTruthFactsOf(state: Pick<SimState, 'alerts' | 'session'>): SystemTruthFact[] {
  const facts: SystemTruthFact[] = [];
  for (const alert of state.alerts) {
    const fact = factOfAlert(alert);
    if (fact !== null) facts.push(fact);
  }
  const seal = sealAttentionOf(state);
  if (seal?.kind === 'RETRYING') {
    facts.push({ id: SYSTEM_FACT_SEAL_RETRYING, severity: 'WARNING', message: seal.sentence ?? 'Sealing failed and is being run again. The recording is kept on the Core.', target: seal.sessionId, alertId: null, blocksRecording: null });
  }
  return facts;
}

/**
 * THE ONE STATEMENT. A fact of severity CRITICAL makes the state CRITICAL unless the Core itself
 * says that recording is not blocked by it (an unsealable recording that waits for its
 * acknowledgement: attention, not a stop). Any other fact makes a READY state ATTENTION; a
 * RECORDING state stays RECORDING, with the severity telling the rest (as `systemStatus` does).
 */
export function systemTruthOf(state: TruthState, options: SystemTruthOptions = {}): SystemTruth {
  const base = systemStatus(state);
  if (options.coreLinkLost === true) {
    const lost: SystemTruthFact = { id: SYSTEM_FACT_CORE_LINK_LOST, severity: 'CRITICAL', message: CORE_LINK_LOST_SENTENCE, target: null, alertId: null, blocksRecording: null };
    return { state: SYSTEM_STATE_UNKNOWN, severity: SYSTEM_STATE_UNKNOWN, flags: base.flags, facts: [lost], allOperational: false };
  }
  const facts = systemTruthFactsOf(state);
  const critical = base.severity === 'CRITICAL' || facts.some((fact) => fact.severity === 'CRITICAL' && fact.blocksRecording !== false);
  const anything = base.flags.length > 0 || facts.length > 0;
  let next: SystemState;
  if (critical) next = SystemState.CRITICAL;
  else if (base.state === SystemState.RECORDING) next = SystemState.RECORDING;
  else next = anything ? SystemState.ATTENTION : SystemState.READY;
  const severity: SystemSeverity = critical ? 'CRITICAL' : anything ? 'WARNING' : 'OK';
  return { state: next, severity, flags: base.flags, facts, allOperational: !anything };
}
