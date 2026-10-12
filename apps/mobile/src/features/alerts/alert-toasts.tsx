/**
 * `<AlertToasts />` - the consumer of the Core's alerts that Settings → Notifications promises (fix wave J,
 * JA2-05). Mounted once, in the signed-in layout (`src/app/(app)/_layout.tsx`), so it runs on every screen
 * of both layouts: Home, the session monitor during a recording, Evidence, Settings.
 *
 * - The rules are `alertToastStep` (`alert-toasts-model.ts`): a CRITICAL alert always shows and STAYS
 *   (`duration: 'persistent'`) until it is acknowledged or resolved; a warning shows once for the kit's
 *   default time when its switch is on; one toast per alert id; a resolved alert's toast leaves.
 * - The toast is the app's kit toast (`useToast` of heroui-native, top placement - the provider's default),
 *   in both motion modes: the kit animates it under the full policy and shows it at once under reduced
 *   motion (`animation: 'disable-all'`), so nothing here depends on an animation finishing.
 * - "Acknowledge" on a critical toast is operation 70, the same fire-and-forget call as the bell's: every
 *   signed-in role may acknowledge an alert (the registry: AUTHENTICATED). A refusal or an outage is worded
 *   by the app's one refusal presenter; the toast stays until the Core says "acknowledged".
 * - Accessibility: each toast is announced (`AccessibilityInfo.announceForAccessibility`) with its
 *   severity, and the kit's toast is a live region whose action is a labelled button.
 *
 * The steps run in an effect on the alerts slice (an external system: the kit's toast queue); the "what
 * was shown" memory is a ref, not state - nothing renders from it.
 */
import { useToast } from 'heroui-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo } from 'react-native';
import { settle, useCoreActions } from '@dems/shared/live';
import { formatDate } from '@dems/shared/realtime';
import { useSim } from '@dems/shared/sim';
import { useFailedStart } from '@/features/session-live/capture-start-notice';
import { useSettingsPrefs } from '@/features/settings/settings-prefs';
import { reportRuntimeIssue, useCoreErrorPresenter } from '@/runtime';
import { alertLabel } from './alert-label';
import { NO_ALERT_TOASTS, alertToastLabel, alertToastStep, type AlertToastState } from './alert-toasts-model';

/** The id of an alert's toast: one per alert id. */
export const alertToastId = (alertId: string): string => `alert-${alertId}`;

export function AlertToasts() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const actions = useCoreActions();
  const presentCoreError = useCoreErrorPresenter();
  const prefs = useSettingsPrefs();
  const alerts = useSim((s) => s.alerts);
  const failedStart = useFailedStart();
  const memory = useRef<{ state: AlertToastState; started: boolean }>({ state: NO_ALERT_TOASTS, started: false });
  const notifications = prefs.notifications;
  const hydrated = prefs.hydrated;

  useEffect(() => {
    // The switches are read from storage once: no warning is announced before they are known.
    if (!hydrated) return;
    const step = alertToastStep(memory.current.state, alerts, notifications, !memory.current.started);
    memory.current = { state: step.state, started: true };
    for (const id of step.hide) toast.hide(alertToastId(id));
    for (const { alert, persistent } of step.show) {
      const label = alertLabel(t, alert, failedStart);
      const time = formatDate(alert.at, 'HH:mm:ss');
      toast.show({
        id: alertToastId(alert.id),
        variant: persistent ? 'danger' : 'warning',
        // CT-04: the first sentence of the alert's words; the bell holds all of them. The announcement says all.
        label: alertToastLabel(label),
        description: t(persistent ? 'features.alerts.toast.criticalDescription' : 'features.alerts.toast.warningDescription', { time }),
        ...(persistent
          ? {
              duration: 'persistent' as const,
              actionLabel: t('features.alerts.toast.acknowledge'),
              // Fire-and-forget (operation 70): the toast leaves when the CORE says the alert is acknowledged.
              onActionPress: () => {
                settle(() => actions.acknowledgeAlert(alert.id), {
                  fail: (error) => {
                    if (presentCoreError(error)) return;
                    reportRuntimeIssue('warn', 'alerts.toast.acknowledge', error, { alertId: alert.id });
                  },
                });
              },
            }
          : {}),
      });
      AccessibilityInfo.announceForAccessibility(t(persistent ? 'features.alerts.toast.announceCritical' : 'features.alerts.toast.announceWarning', { label }));
    }
  }, [alerts, notifications, hydrated, toast, t, actions, presentCoreError, failedStart]);

  // Signing out unmounts the signed-in layout: no critical toast of the last operator stays over Login. The kit's
  // `toast` object is a new one per render, so the unmount step reads it from a ref (it must run at unmount ONLY:
  // run on a re-render it would take a persistent toast down).
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);
  useEffect(
    () => () => {
      for (const id of memory.current.state.persistent) toastRef.current.hide(alertToastId(id));
    },
    [],
  );

  return null;
}
