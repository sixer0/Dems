/**
 * Settings (04_mobile_specs §4.15, MB 10) at `/settings`; step 88 (05_mobile_plan M-15 part b).
 * Replaces step 70's stub; the export name, the props and the `SafeScreen id="settings"` root stay
 * (T-M02, MA-04).
 *
 * - Compact and compact-landscape: the MB 10 list. A section row pushes `/settings/<section>`;
 *   Device Settings, Storage Management and Network & Time open the existing screens.
 * - Medium and expanded (§2.4 "Categories 320 dp | section pane"): the list in `pane-categories`,
 *   the open section (`?selected=`, default App Preferences) in `pane-section`.
 * - The Account row opens the Profile sheet (role, permissions, Lock console, Sign out).
 */
import { useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { spacing } from '@dems/shared/tokens';
import { useAuthSession } from '@/auth';
import { Pane, PaneLayout, SafeScreen, useLayoutClass } from '@/layout';
import type { SettingsSection } from '@/navigation/params';
import { useAuth, useCoreLink } from '@/runtime';
import { ProfileSheet } from './profile-sheet';
import { SectionBody } from './section-body';
import { paneSection, SECTION_TITLE_KEYS, type SettingsRouteHref } from './settings-model';
import { SettingsHeader, SettingsList } from './settings-list';

export interface SettingsScreenProps {
  /** Section selected with `?selected=` (the section pane on medium and expanded, 04 §4.15), or null. */
  readonly selectedSection: SettingsSection | null;
}

/** §2.4: the categories pane is 320 dp on medium and expanded. */
const CATEGORIES_WIDTH = 320;

export function SettingsScreen({ selectedSection }: SettingsScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { isMultiPane } = useLayoutClass();
  const auth = useAuth();
  const session = useAuthSession();
  const live = useCoreLink().source === 'LIVE';
  const [profileOpen, setProfileOpen] = useState(false);
  const section = paneSection(selectedSection);

  const openSection = useCallback(
    (next: SettingsSection) => {
      if (isMultiPane) router.setParams({ selected: next });
      else router.push(`/settings/${next}` as Href);
    },
    [isMultiPane, router],
  );
  const openRoute = useCallback((href: SettingsRouteHref) => router.push(href), [router]);

  const list = (
    <SettingsList
      operator={auth.operator}
      selected={isMultiPane ? section : null}
      onOpenSection={openSection}
      onOpenRoute={openRoute}
      onOpenProfile={() => setProfileOpen(true)}
    />
  );

  return (
    <SafeScreen id="settings">
      {isMultiPane ? (
        <PaneLayout testID="settings-panes" style={styles.panes}>
          <Pane name="categories" width={CATEGORIES_WIDTH}>
            {list}
          </Pane>
          <Pane name="section" flex={1} style={styles.flexBasisZero}>
            <View style={styles.paneColumn}>
              <SettingsHeader title={t(SECTION_TITLE_KEYS[section])} showBack={false} testID="settings-pane-header" />
              {/* Keyed by section: a newly opened section starts at its top (device finding: the
                  pane kept the previous section's scroll offset). */}
              <ScrollView key={section} style={styles.scroll} contentContainerStyle={styles.paneContent}>
                <SectionBody section={section} />
              </ScrollView>
            </View>
          </Pane>
        </PaneLayout>
      ) : (
        list
      )}
      <ProfileSheet
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        operator={auth.operator}
        live={live}
        onLockConsole={() => {
          setProfileOpen(false);
          session.lockConsole();
        }}
        onSignOut={() => {
          setProfileOpen(false);
          auth.signOut('USER');
        }}
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  panes: { paddingRight: spacing[3] },
  flexBasisZero: { flexBasis: 0 },
  paneColumn: { flex: 1 },
  scroll: { flex: 1 },
  paneContent: { paddingHorizontal: spacing[3], paddingBottom: spacing[4] },
});
