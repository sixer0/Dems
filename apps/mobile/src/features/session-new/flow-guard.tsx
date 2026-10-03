/**
 * Leaving Start Session (04_mobile_specs §3.6; §4.4 "Cancel after data entry → Dialog → cancel()").
 *
 * | Where | Back (hardware, gesture, header arrow) |
 * |---|---|
 * | step 1, nothing typed | leaves |
 * | step 1 with typed details, no session yet | "Discard this session?" (shared `sessionNew.cancelDialog`) → leaves |
 * | a session in CREATE, PRECHECK or ARMED | "Cancel this session?" (`BackGuardDialog variant="flow"`) → `cancel()` (audit SESSION_CANCELLED) → leaves |
 *
 * Step 70's `useBackGuard` holds pops of the route (`usePreventRemove`). When Start Session is the
 * only screen (a deep link or a relaunch resync), Back has nothing to pop and Android would close
 * the app, so `useFlowBackPrompt` also listens to the hardware back button and asks first, then
 * goes Home (the same pattern as the monitor, step 79).
 */
import { useRouter } from 'expo-router';
import { Button, Dialog } from 'heroui-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, StyleSheet, View } from 'react-native';
import { spacing } from '@dems/shared/tokens';
import type { BackGuard } from '@/navigation';

export interface FlowBackPrompt {
  /** A guard that also covers the root case (no screen underneath). */
  readonly guard: BackGuard;
  /** The header arrow: pop (guarded), or ask first when there is nothing to pop. */
  requestBack(): void;
}

export function useFlowBackPrompt(guard: BackGuard, active: boolean): FlowBackPrompt {
  const router = useRouter();
  const [rootPrompt, setRootPrompt] = useState(false);
  const prompting = guard.isPrompting || (rootPrompt && active);

  useEffect(() => {
    if (!active) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (prompting) {
        setRootPrompt(false);
        guard.stay();
        return true;
      }
      if (router.canGoBack()) return false; // the stack pops; usePreventRemove asks
      setRootPrompt(true);
      return true;
    });
    return () => subscription.remove();
  }, [active, prompting, guard, router]);

  return {
    guard: {
      isPrompting: prompting,
      stay: () => {
        setRootPrompt(false);
        guard.stay();
      },
      leave: () => {
        if (rootPrompt) {
          setRootPrompt(false);
          guard.leaveTo('/home');
        } else {
          guard.leave();
        }
      },
      leaveTo: (href) => {
        setRootPrompt(false);
        guard.leaveTo(href);
      },
    },
    requestBack: () => {
      if (router.canGoBack()) router.back();
      else if (active) setRootPrompt(true);
      else router.replace('/home');
    },
  };
}

export interface DiscardDialogProps {
  guard: BackGuard;
}

/** Step 1 with typed details and no session yet: the shared "Discard this session?" dialog. */
export function DiscardDialog({ guard }: DiscardDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog isOpen={guard.isPrompting} onOpenChange={(open) => (open ? undefined : guard.stay())}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content testID="session-new-discard-dialog">
          <Dialog.Title>{t('sessionNew.cancelDialog.title')}</Dialog.Title>
          <Dialog.Description>{t('sessionNew.cancelDialog.body')}</Dialog.Description>
          <View style={styles.actions}>
            <Button testID="session-new-discard-keep" variant="primary" onPress={guard.stay}>
              <Button.Label>{t('sessionNew.cancelDialog.keep')}</Button.Label>
            </Button>
            <Button testID="session-new-discard-confirm" variant="danger" onPress={guard.leave}>
              <Button.Label>{t('sessionNew.cancelDialog.confirm')}</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

const styles = StyleSheet.create({ actions: { gap: spacing[1], marginTop: spacing[3] } });
