import { useRouter } from 'expo-router';
import { Button, Card } from 'heroui-native';
import { SearchX } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { SafeScreen } from '@/layout';

/**
 * `+not-found` (04_mobile_specs §3.1). A deep link that matches no route lands here. The action
 * replaces the screen with `/`, whose boot router then picks `/login`, the resync target or Home.
 * The unmatched path is not shown or logged (deep links are untrusted input).
 */
export function NotFoundScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <SafeScreen id="not-found" contentContainerStyle={styles.body}>
      <Card className="w-full max-w-md rounded-xl">
        <Card.Header>
          <View style={styles.titleRow}>
            <SearchX size={22} color={palette.gold} accessibilityElementsHidden importantForAccessibility="no" />
            <Text accessibilityRole="header" style={styles.title}>
              {t('features.navigation.notFound.title')}
            </Text>
          </View>
          <Card.Description>{t('features.navigation.notFound.description')}</Card.Description>
        </Card.Header>
        <Card.Footer>
          <Button testID="not-found-action" variant="primary" onPress={() => router.replace('/')}>
            <Button.Label>{t('features.navigation.notFound.action')}</Button.Label>
          </Button>
        </Card.Footer>
      </Card>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: spacing[4], justifyContent: 'center', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  title: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h2.size,
    lineHeight: typography.h2.lineHeight,
    color: palette.foreground,
  },
});
