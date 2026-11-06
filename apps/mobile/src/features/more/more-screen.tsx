/**
 * More at `/more` (04_mobile_specs §4.17; §1.1 derived screen "MB 10 grouped rows"; §2.3; 05_mobile_plan
 * M-15 part c). Owner: step 89 (P6). The route file `src/app/(app)/(tabs)/more.tsx` renders
 * `<MoreScreen />`; the root stays `SafeScreen id="more"` (`screen-more`, T-M02, MA-04).
 *
 * Sections, top to bottom:
 *
 * | Section | Content |
 * |---|---|
 * | Header | Emblem + "More" (phone); 64 dp title header on tablets (§2.3) |
 * | Operator card | Avatar, name, role chip, operator id, sign-in time; Lock console, Sign out |
 * | Console | Storage, Network & Time, Audit, Settings as live tiles: **only when the chrome has a More item** (phone bar or phone-landscape rail). On tablets the rail already lists them, so they are not repeated (H-MB-01; "More dissolves", §2.3) |
 * | Device & support | Pairing, Recovery status (FAULT / RECOVERY only), About DEMS, Developer gallery (debug builds only) |
 * | Footer | Emblem, "DEMS EDGE CLIENT · v2.4.1", DEMO label, Core link chip |
 *
 * Motion (§7.3 "list sections stagger"; 03M App. A R1): every section enters on `enterRise` with the
 * R1 stagger (80 + i × 60 ms, `gentle` spring, cap 8); the link rows reveal 30 ms apart (M-C-11).
 * Proof mode multiplies the beats by 10; reduced motion is a 160 ms fade with no stagger. No
 * ambient loops. Each section sits in its own error boundary (`MoreBoundary`).
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { fontFamily, palette, typography } from '@dems/shared/tokens';
import { Emblem } from '@/components/media/emblem';
import { SafeScreen, useLayoutClass, type LayoutClass } from '@/layout';
import { enterRise, useMotionSettings } from '@/motion';
import { developerControlsShown } from '@/features/settings/settings-model';
import { useSettingsPrefs } from '@/features/settings/settings-prefs';
import { ConsoleTiles } from './console-tiles';
import { MoreBoundary } from './more-boundary';
import { MoreFooter, MoreLinks } from './more-links';
import { CONSOLE_DESTINATIONS, consoleColumns, showsConsole } from './more-model';
import { OperatorCard } from './operator-card';

/** Stagger slots: header 0, operator 1, console tiles 2–5 (or the rail note 2), links, footer. */
const SLOT = { header: 0, operator: 1, console: 2 } as const;
/** Tablet content column (the screen holds no panes; a centred column reads better than full width). */
const TABLET_COLUMN_MAX = 720;

export function MoreScreen() {
  const { t } = useTranslation();
  const { layoutClass, nav } = useLayoutClass();
  const settings = useMotionSettings();
  const withConsole = showsConsole(nav);
  // Fix wave J (JA2-29, N-03): the developer gallery follows the one rule for developer pages
  // (development build AND presentation mode off), as Settings does.
  const developer = developerControlsShown({ dev: __DEV__, presentationMode: useSettingsPrefs().presentationMode });
  const linksSlot = withConsole ? SLOT.console + CONSOLE_DESTINATIONS.length : SLOT.console + 1;
  const tablet = !withConsole;

  return (
    <SafeScreen id="more">
      <Animated.View entering={enterRise(SLOT.header, settings)}>
        <MoreHeader layoutClass={layoutClass} />
      </Animated.View>
      <ScrollView testID="more-scroll" style={styles.scroll} contentContainerStyle={[styles.content, tablet ? styles.contentTablet : null]}>
        <View style={[styles.column, tablet ? styles.columnTablet : null]}>
          <Animated.View entering={enterRise(SLOT.operator, settings)}>
            <MoreBoundary name="operator">
              <OperatorCard />
            </MoreBoundary>
          </Animated.View>

          {withConsole ? (
            <MoreBoundary name="console">
              <ConsoleTiles columns={consoleColumns(layoutClass)} firstSlot={SLOT.console} />
            </MoreBoundary>
          ) : (
            <Animated.View entering={enterRise(SLOT.console, settings)}>
              <Text testID="more-in-rail" maxFontSizeMultiplier={1.2} style={styles.railNote}>
                {t('features.more.console.inRail')}
              </Text>
            </Animated.View>
          )}

          <Animated.View entering={enterRise(linksSlot, settings)}>
            <MoreBoundary name="links">
              <MoreLinks debug={developer} />
            </MoreBoundary>
          </Animated.View>

          <Animated.View entering={enterRise(linksSlot + 1, settings)}>
            <MoreBoundary name="footer">
              <MoreFooter />
            </MoreBoundary>
          </Animated.View>
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

/**
 * Header (§2.3 "Header" row): on phones the emblem and the title (a tab root, so no back arrow);
 * the condensed 48 dp header in phone landscape; the 64 dp title header on tablets.
 */
function MoreHeader({ layoutClass }: { layoutClass: LayoutClass }) {
  const { t } = useTranslation();
  const tablet = layoutClass === 'medium' || layoutClass === 'expanded';
  const condensed = layoutClass === 'compact-landscape';
  return (
    <View testID="more-header" style={[styles.header, tablet ? styles.headerTablet : condensed ? styles.headerCondensed : styles.headerCompact]}>
      {tablet ? null : <Emblem size={condensed ? 24 : 28} />}
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.title}>
        {t('features.more.title')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerCompact: { minHeight: 56, paddingHorizontal: 16, paddingTop: 4 },
  headerCondensed: { height: 48, paddingHorizontal: 16 },
  headerTablet: { height: 64, paddingHorizontal: 24 },
  title: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h2.size,
    lineHeight: typography.h2.lineHeight,
    color: palette.foreground,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, flexGrow: 1 },
  contentTablet: { paddingHorizontal: 24, paddingTop: 4 },
  column: { gap: 16 },
  columnTablet: { width: '100%', maxWidth: TABLET_COLUMN_MAX, alignSelf: 'center' },
  railNote: {
    paddingHorizontal: 4,
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
  },
});
