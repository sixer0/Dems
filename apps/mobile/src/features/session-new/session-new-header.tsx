/**
 * Start Session header (04_mobile_specs §4.4; MB 3 (650–885, 45–75)): guarded back arrow, the
 * title "Start New Session" and a right icon the mockup does not explain, read as "Load last
 * session profile" (hypothesis; the web's "Start with last profile", 04 §5.7) → a kit `Menu` with
 * "Start with last profile" and "Clear form". The menu belongs to step 1 only (later steps cannot
 * change the created session). Menu content is portalled above the simulator provider, so it only
 * receives callbacks and flags, never simulator hooks (step 79 finding).
 */
import { Button, Menu } from 'heroui-native';
import { ArrowLeft, FolderDown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { palette, spacing } from '@dems/shared/tokens';

const ICON = 24;

export interface SessionNewHeaderProps {
  onBack(): void;
  /** Step 1 only: the profile menu. */
  showMenu: boolean;
  hasLastProfile: boolean;
  onLastProfile(): void;
  onClearForm(): void;
  /** Tablets: a 64 dp header with the larger title (§2.3). */
  large: boolean;
  /** Fix wave M (G70d-03): a session exists (CREATE, PRECHECK, ARMED) - the header offers "Cancel session" (it asks first). */
  onCancelSession?: (() => void) | undefined;
}

export function SessionNewHeader({ onBack, showMenu, hasLastProfile, onLastProfile, onClearForm, large, onCancelSession }: SessionNewHeaderProps) {
  const { t } = useTranslation();
  return (
    <View style={[styles.header, large ? styles.headerLarge : null]} testID="session-new-header">
      <Button
        testID="session-new-back"
        isIconOnly
        variant="ghost"
        size="lg"
        accessibilityLabel={t('features.session-new.header.back')}
        onPress={onBack}
      >
        <ArrowLeft size={ICON} color={palette.gold} />
      </Button>
      {/* Round two (JA2-10): beside "Cancel session" the title shrinks to fit - it read "Start New Sessi..." on the phone. */}
      <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} className={large ? 'text-h2 font-semibold text-foreground' : 'text-h3 font-semibold text-foreground'} style={styles.title}>
        {t('common.actions.startNewSession')}
      </Text>
      {onCancelSession ? (
        <Button testID="session-new-cancel" variant="outline" size="sm" onPress={onCancelSession} accessibilityLabel={t('features.session-new.header.cancelSession')}>
          <Button.Label>{t('features.session-new.header.cancelSession')}</Button.Label>
        </Button>
      ) : null}
      {showMenu ? (
        <Menu>
          <Menu.Trigger asChild>
            <Button
              testID="session-new-profile-menu"
              isIconOnly
              variant="ghost"
              size="lg"
              accessibilityLabel={t('features.session-new.header.profileMenu')}
            >
              <FolderDown size={ICON} color={palette.gold} />
            </Button>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Overlay />
            <Menu.Content presentation="popover" width={260} placement="bottom" align="end">
              <Menu.Item testID="session-new-menu-last-profile" isDisabled={!hasLastProfile} onPress={onLastProfile}>
                <View style={styles.menuText}>
                  <Menu.ItemTitle>{t('features.session-new.header.lastProfile')}</Menu.ItemTitle>
                  <Menu.ItemDescription>
                    {hasLastProfile ? t('features.session-new.header.lastProfileHint') : t('features.session-new.header.noLastProfile')}
                  </Menu.ItemDescription>
                </View>
              </Menu.Item>
              <Menu.Item testID="session-new-menu-clear" onPress={onClearForm}>
                <Menu.ItemTitle>{t('features.session-new.header.clearForm')}</Menu.ItemTitle>
              </Menu.Item>
            </Menu.Content>
          </Menu.Portal>
        </Menu>
      ) : onCancelSession ? null : (
        <View style={styles.spacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], minHeight: 56, paddingHorizontal: spacing[1] },
  headerLarge: { minHeight: 64, paddingHorizontal: spacing[3] },
  title: { flex: 1 },
  spacer: { width: 48 },
  menuText: { flex: 1 },
});
