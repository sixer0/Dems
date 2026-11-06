/**
 * The route error screen of the Expo Router error boundary (`app/_layout.tsx` `ErrorBoundary`): a friendly
 * message and a rate-limited retry (3 s → 6 s → 12 s, max 3). Expo Router renders the boundary INSTEAD of
 * the layout, so none of the layout's providers exist here; `i18n.t` is used, not the hook.
 *
 * Post-review fix FXR-M (finding W93-13): the route error used to be printed with `console.error` IN RENDER,
 * again on every cooldown re-render (once a second during the countdown), and never reached the persistent
 * runtime log (the comment said no client log existed; `reportRuntimeIssue` does). It is now written ONCE
 * per error to `dems.mobile.log.v1` (`app.routeError`, level `error`); this screen prints nothing itself.
 * Moved out of `_layout.tsx` (which Jest cannot load: fonts, CSS) so it can be tested.
 */
import { type ErrorBoundaryProps } from 'expo-router';
import { Button, Card } from 'heroui-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useRetryCooldown } from '@dems/shared/realtime';
import { palette } from '@dems/shared/tokens';
import { i18n } from '@/i18n';
import { reportRuntimeIssue } from '@/runtime/log';

export function RouteErrorFallback({ error, retry }: ErrorBoundaryProps) {
  const { retry: guardedRetry, cooldown, exhausted, canRetry } = useRetryCooldown(() => {
    void retry();
  });
  useEffect(() => {
    reportRuntimeIssue('error', 'app.routeError', error);
  }, [error]);
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: palette.black }} testID="route-error-fallback">
      <Card className="rounded-xl">
        <Card.Header>
          <Card.Title>{i18n.t('mobile.errorBoundary.title')}</Card.Title>
          <Card.Description>{i18n.t('mobile.errorBoundary.description')}</Card.Description>
        </Card.Header>
        <Card.Footer>
          <Button variant="primary" isDisabled={!canRetry} onPress={guardedRetry} testID="route-error-retry">
            <Button.Label>
              {exhausted
                ? i18n.t('mobile.errorBoundary.restart')
                : cooldown > 0
                  ? i18n.t('mobile.errorBoundary.retryIn', { seconds: cooldown })
                  : i18n.t('mobile.errorBoundary.retry')}
            </Button.Label>
          </Button>
        </Card.Footer>
      </Card>
    </View>
  );
}
