/**
 * THE ALERT TOASTS (fix wave J, JA2-05): the consumer Settings → Notifications promised - "Choose which
 * alert toasts this device shows … Critical alerts always show and stay until acknowledged" - and that
 * no code read (`settings-prefs.ts` said so). Pure: the rules, tested without React.
 *
 * | The Core's alert | The toast |
 * |---|---|
 * | ACTIVE, severity CRITICAL, not acknowledged | always shown; PERSISTENT - it stays until the alert is acknowledged (its action) or resolved; also for an alert that was already active when the operator signed in |
 * | ACTIVE, severity WARNING, NEW since the consumer started | shown once, for the kit's default time, when the switch of its category is on (`devices`, `storage`, `time`, `system`); off = no toast |
 * | INFO / SUCCESS | no toast (the bell and the screens carry them) |
 * | acknowledged (critical), resolved or gone | its toast leaves |
 *
 * One toast per alert id, ever: the id of the toast IS the alert id, and an id that was shown is
 * remembered for as long as the alert is in the store. So a slice that is replicated again (a
 * reconnect, a delta) raises no storm.
 */
import type { SimAlert } from '@dems/shared/sim';
import { shouldNotify, type NotificationPrefs } from '@/features/settings/settings-model';

/**
 * Whether an ACTIVE alert gets a toast under these switches, and of which kind; null = no toast.
 * The switch of a kind is the Settings rule itself (`shouldNotify` over `NOTIFICATION_KINDS`): a warning
 * of a kind no switch covers (a notice of the Core, `SYSTEM`) always shows.
 */
export function alertToastKind(alert: Pick<SimAlert, 'severity' | 'kind'>, prefs: NotificationPrefs): 'critical' | 'warning' | null {
  if (alert.severity === 'CRITICAL') return 'critical';
  if (alert.severity !== 'WARNING') return null;
  return shouldNotify(alert.kind, prefs) ? 'warning' : null;
}

export interface AlertToastState {
  /** Alert ids a toast was shown for (and ids that were present, not critical, when the consumer started). */
  readonly seen: readonly string[];
  /** Alert ids whose PERSISTENT toast is up. */
  readonly persistent: readonly string[];
}

export const NO_ALERT_TOASTS: AlertToastState = Object.freeze({ seen: Object.freeze([]) as readonly string[], persistent: Object.freeze([]) as readonly string[] });

export interface AlertToastStep {
  readonly state: AlertToastState;
  /** Toasts to show now, oldest alert first. */
  readonly show: readonly { readonly alert: SimAlert; readonly persistent: boolean }[];
  /** Persistent toasts to take down now (their alert was acknowledged, resolved, or left the store). */
  readonly hide: readonly string[];
}

/**
 * One step of the consumer: what to show and what to hide for `alerts`, given what was shown before.
 * `first` is the step in which the consumer starts (sign-in, app start): the warnings that are already
 * there are remembered without a toast - only what changes while the operator watches is announced -
 * but an unacknowledged CRITICAL alert is shown at once: it "stays until acknowledged".
 */
export function alertToastStep(previous: AlertToastState, alerts: readonly SimAlert[], prefs: NotificationPrefs, first: boolean): AlertToastStep {
  const present = new Set(alerts.map((alert) => alert.id));
  const seen = new Set(previous.seen.filter((id) => present.has(id)));
  const persistent = new Set(previous.persistent);
  const show: { alert: SimAlert; persistent: boolean }[] = [];
  const hide: string[] = [];
  const byId = new Map(alerts.map((alert) => [alert.id, alert] as const));

  for (const id of previous.persistent) {
    const alert = byId.get(id);
    if (alert === undefined || !alert.active || alert.acknowledged) {
      persistent.delete(id);
      hide.push(id);
    }
  }
  for (const alert of alerts) {
    if (seen.has(alert.id)) continue;
    if (!alert.active) continue;
    const kind = alertToastKind(alert, prefs);
    if (kind === 'critical') {
      // An acknowledged critical alert is not announced again; it is remembered.
      seen.add(alert.id);
      if (!alert.acknowledged) {
        persistent.add(alert.id);
        show.push({ alert, persistent: true });
      }
      continue;
    }
    // A warning whose switch is off is remembered too: turning the switch on later announces only NEW alerts.
    seen.add(alert.id);
    if (kind === 'warning' && !first && !alert.acknowledged) show.push({ alert, persistent: false });
  }
  return { state: { seen: [...seen], persistent: [...persistent] }, show, hide };
}
