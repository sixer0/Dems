/**
 * The toast of a session run from another console (fix wave Q, CT-05; ruling of D246: "a session this operator
 * did not start on this device never navigates them; a toast / Home entry tells them instead"). The runtime's
 * route sync emits what it did not follow (`foreign-session-signal`); this says it, once per session and phase.
 * Mounted beside the alert toasts in the signed-in layout. Home and the Sessions hub already show the session's
 * state (the System Status card, the hub's top entry): the toast points there.
 */
import { useToast } from 'heroui-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo } from 'react-native';
import { subscribeForeignSession } from '@/runtime';

/** How long the toast stays (it is information, not an alarm; the bell and Home hold the state). */
export const FOREIGN_SESSION_TOAST_MS = 7000;

export function ForeignSessionToasts() {
  const { t } = useTranslation();
  const { toast } = useToast();
  // The kit's `toast` object is a new one per render: the subscription reads it from a ref.
  const latest = useRef({ toast, t });
  useEffect(() => {
    latest.current = { toast, t };
  }, [toast, t]);
  useEffect(
    () =>
      subscribeForeignSession(({ sessionId, phase }) => {
        const label = latest.current.t(`features.sessions.foreign.toast.${phase}`, { id: sessionId });
        latest.current.toast.show({
          id: `foreign-session-${sessionId}-${phase}`,
          variant: 'default',
          label,
          description: latest.current.t('features.sessions.foreign.toast.description'),
          duration: FOREIGN_SESSION_TOAST_MS,
        });
        AccessibilityInfo.announceForAccessibility(label);
      }),
    [],
  );
  return null;
}
