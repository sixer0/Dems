/**
 * Row and button hand-offs of the Sessions hub (step-82 brief; 04_mobile_specs §2.5 rule 3, §3.7).
 *
 * `useOpenSession()` returns one function: on a multi-pane window a `detail` hand-off selects the
 * row into the detail pane (`?selected=`, so rotation keeps it, MA-13); every other hand-off pushes
 * its route (the session-flow screens, the summary, the evidence detail, or the session detail on a
 * phone). A navigation failure never leaves the operator on a dead tap: it shows a toast and goes to
 * the persistent runtime log (three-layer rule: feedback, log, the list stays usable).
 */
import { useRouter, type Href } from 'expo-router';
import { useToast } from 'heroui-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLayoutClass } from '@/layout';
import { reportRuntimeIssue } from '@/runtime';
import { handOffFor, type SessionRow } from './sessions-model';

/** Pushes an href with the toast + log fallback (named `use…`: it calls hooks, D66). */
export function useSafePush(): (href: string, source: string, context?: Readonly<Record<string, unknown>>) => void {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation();
  return useCallback(
    (href, source, context) => {
      try {
        router.push(href as Href);
      } catch (error) {
        toast.show({ variant: 'danger', label: t('features.sessions.detail.actions.navigateFailed') });
        reportRuntimeIssue('error', `features.sessions.${source}`, error, { href, ...context });
      }
    },
    [router, toast, t],
  );
}

export function useOpenSession(): (row: SessionRow) => void {
  const router = useRouter();
  const { isMultiPane } = useLayoutClass();
  const push = useSafePush();
  return useCallback(
    (row: SessionRow) => {
      const handOff = handOffFor(row, isMultiPane);
      if (handOff.kind === 'detail' && isMultiPane) {
        router.setParams({ selected: row.id });
        return;
      }
      push(handOff.href, `open.${handOff.kind}`, { sessionId: row.id });
    },
    [isMultiPane, router, push],
  );
}
