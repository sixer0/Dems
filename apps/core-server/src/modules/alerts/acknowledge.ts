/**
 * Operation 70 `acknowledgeAlert`: whether a call acknowledged an alert, and the one log line
 * of an acknowledgement (plan row W40; spec §7.15, §13.2; SR-82, AC-B-89).
 *
 * WHAT CHANGED is read from the `alerts` slice before and after the hosted action, inside the
 * action's unit of work: the alert of that ID was not acknowledged before and is acknowledged
 * after. The simulator leaves an unknown alert and an acknowledged one as they are, and the
 * operation still answers 204 (spec §7.15); such a call acknowledged nothing.
 *
 * THE LOG LINE (SR-82). `acknowledgeAlert` writes no audit row (parity with the simulator, spec
 * §13.2), and an acknowledgement is a value every console sees. So a call that acknowledged an
 * alert writes ONE line at level info:
 *
 *     { operatorId: 'OPR-001', alertId: 'ALR-000003' }  "alert acknowledged"
 *
 * It holds the operator's ID and the alert's ID, and nothing else of the alert. A call that
 * changed nothing, and a call that was refused, write no line.
 */
import type { SimAlert } from '@dems/shared/sim';
import type { Principal } from '../../plugins/authenticate';

/** Label of the unit of work of operation 70. It appears in the pipeline's log lines. */
export const ACKNOWLEDGE_UNIT_LABEL = 'alerts.acknowledgeAlert';

/** The fixed text of the log line of an acknowledgement. */
export const ALERT_ACKNOWLEDGED_MESSAGE = 'alert acknowledged';

const isAcknowledged = (alerts: readonly SimAlert[], alertId: string): boolean => alerts.some((alert) => alert.id === alertId && alert.acknowledged);

/** True when the alert of that ID is acknowledged in `after` and was not in `before`. */
export function becameAcknowledged(before: readonly SimAlert[], after: readonly SimAlert[], alertId: string): boolean {
  return isAcknowledged(after, alertId) && !isAcknowledged(before, alertId);
}

/** The fields of the log line of an acknowledgement: who, and which alert by ID. */
export interface AcknowledgementLine {
  readonly operatorId: string | null;
  readonly alertId: string;
}

/**
 * The fields of the one log line of an acknowledgement (SR-82). The operator ID is the
 * caller's, as stage 4 resolved it: the hosted action has just run as this operator. It is read
 * for the line only; who may call is decided by stage 6, never here.
 */
export function acknowledgementLine(caller: Principal, alertId: string): AcknowledgementLine {
  return { operatorId: caller.kind === 'OPERATOR' ? caller.operatorId : null, alertId };
}
