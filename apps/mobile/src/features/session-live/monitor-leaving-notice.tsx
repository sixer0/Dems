/**
 * What `/session/live` draws while it leaves for a screen other than Finalizing (fix wave J round two, JA2-19).
 *
 * The monitor opens only while a session records. When the recording ends from outside - a fault that opens
 * Session recovery, a session that no longer exists - the route used to render its redirect alone, which
 * draws nothing: the phone showed a black screen for 1.5 s or more until the next route had mounted and
 * faded in. This is that moment's picture: one sentence on the app's canvas. Plain views only (no Reanimated
 * view, no entering or exiting animation), so the hand-over removes it as an ordinary Fabric removal
 * (closing-fix CF-M1).
 */
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';

export function MonitorLeavingNotice({ to }: { to: string }) {
  const { t } = useTranslation();
  const recovery = to === '/session/recovery';
  return (
    <View style={styles.root} testID="monitor-leaving" accessible accessibilityRole="text" accessibilityLiveRegion="polite">
      <Text maxFontSizeMultiplier={1.2} style={styles.title}>
        {t(recovery ? 'features.session-live.leaving.recoveryTitle' : 'features.session-live.leaving.endedTitle')}
      </Text>
      <Text maxFontSizeMultiplier={1.2} style={styles.body}>
        {t(recovery ? 'features.session-live.leaving.recoveryBody' : 'features.session-live.leaving.endedBody')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[1], padding: spacing[4], backgroundColor: palette.black },
  title: { fontFamily: fontFamily.native.semibold, fontSize: typography.h3.size, lineHeight: typography.h3.lineHeight, color: palette.foreground, textAlign: 'center' },
  body: { fontFamily: fontFamily.native.normal, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.gray, textAlign: 'center' },
});
