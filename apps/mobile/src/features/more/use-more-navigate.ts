/**
 * Navigation from More (04_mobile_specs §3.4; step 70 H-MB-01). `router.push('/storage')` and the
 * other console routes turn into tab jumps on phones (the routes are tabs with hidden triggers),
 * and `backBehavior="history"` brings Back to More. Console jumps fire the tab-selection haptic
 * (§7.6 row 1, the same one the bar fires). A failed push is logged persistently and shown as a
 * toast instead of failing silently.
 */
import { useRouter } from 'expo-router';
import { useToast } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { triggerHaptic } from '@/motion';
import { reportRuntimeIssue } from '@/runtime';
import type { MoreHref } from './more-model';

export interface MoreNavigateOptions {
  /** Console destinations are tab jumps: fire the tab-selection haptic. */
  tabJump?: boolean;
}

export function useMoreNavigate(): (href: MoreHref, options?: MoreNavigateOptions) => void {
  const router = useRouter();
  const { t } = useTranslation();
  const { toast } = useToast();
  return (href, options) => {
    try {
      if (options?.tabJump) triggerHaptic('tabSelect');
      router.push(href);
    } catch (error) {
      reportRuntimeIssue('error', 'more.navigate', error, { href });
      toast.show({ variant: 'danger', label: t('common.errors.generic') });
    }
  };
}
