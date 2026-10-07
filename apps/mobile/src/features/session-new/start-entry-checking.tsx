/**
 * The Start Session entry while the operator's role is not yet known (ruling W93-11, decision D243;
 * post-review fix FXR-M): Live mode before the first snapshot. The wizard is not shown on an unknown role;
 * this screen says why and waits. As soon as the role is known the route applies the `SESSION_START` gate
 * (`useStartEntryGuard`): the wizard, or Home with "Not permitted". Hardware back leaves as usual.
 */
import { Spinner } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { SafeScreen } from '@/layout';

export function StartEntryChecking() {
  const { t } = useTranslation();
  return (
    <SafeScreen id="session-new-checking">
      <View style={styles.centre} accessible accessibilityRole="progressbar" accessibilityLabel={t('mobile.rbac.checking')}>
        <Spinner size="md" color={palette.gold} />
        <Text maxFontSizeMultiplier={1.2} style={styles.text} testID="session-new-checking-text">
          {t('mobile.rbac.checking')}
        </Text>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2], padding: spacing[4] },
  text: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.gray,
    textAlign: 'center',
  },
});
