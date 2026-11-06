import { useToast } from 'heroui-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SEAL_RECORDING_KEPT_SENTENCE, sealBlockedNoticeOf, useSim } from '@dems/shared/sim';
import { useActiveSession } from '@/runtime';
import { isSessionBusy, sessionResyncHref, type SessionHref } from './session-routes';

/**
 * Deep-link policies of the session flow (04_mobile_specs §3.5):
 *
 * - `/session/new` is refused while a session is busy (RECORDING, STOPPING, FINALIZING, FAULT,
 *   RECOVERY): a toast explains it and the route goes to where that session belongs (§3.7).
 *   CREATE, PRECHECK and ARMED are the wizard itself, so it stays open for them.
 * - `/session/live` "redirects to /home if nothing is recording": when the state is not
 *   RECORDING it goes to the §3.7 route of the current state, or `/home` when there is none.
 *
 * Each hook returns the redirect target, or `null` when the route may render its screen.
 */
export function useSessionNewRedirect(): SessionHref | '/home' | null {
  const { t } = useTranslation();
  const { toast } = useToast();
  const session = useActiveSession();
  const busy = isSessionBusy(session.state);
  const shown = useRef(false);
  // Fix wave I (re-gate 75, G75b-02): the session that keeps the Core busy is one whose seal is BLOCKED - nothing
  // the operator can "finish or recover". The notice of the refused visit names that state and the session.
  const blockedId = useSim((s) => (s.session === null ? null : (sealBlockedNoticeOf(s, s.session.id)?.sessionId ?? null)));

  // One toast per refused visit, however often the redirecting render repeats.
  useEffect(() => {
    if (!busy || shown.current) return;
    shown.current = true;
    toast.show({
      variant: 'warning',
      label: t(blockedId !== null ? 'features.navigation.sealBlocked.title' : 'features.navigation.sessionBusy.title'),
      description:
        blockedId !== null
          ? `${t('features.navigation.sealBlocked.description', { sessionId: blockedId })} ${SEAL_RECORDING_KEPT_SENTENCE}`
          : t('features.navigation.sessionBusy.description'),
    });
  }, [busy, blockedId, toast, t]);

  if (!busy) return null;
  return sessionResyncHref(session.state, { sessionId: session.sessionId }) ?? '/home';
}

export function useSessionLiveRedirect(): SessionHref | '/home' | null {
  const session = useActiveSession();
  if (session.state === 'RECORDING') return null;
  return sessionResyncHref(session.state, { sessionId: session.sessionId }) ?? '/home';
}
