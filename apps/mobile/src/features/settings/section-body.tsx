/**
 * One Settings section's body (04_mobile_specs §4.15 "Sections"), shared by the pushed section route
 * (compact) and the right pane (medium, expanded; §2.4 "Categories 320 dp | section pane").
 */
import { useToast } from 'heroui-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMotionPreferences } from '@/motion';
import type { SettingsSection } from '@/navigation/params';
import { useCoreLinkSourceSetting } from '@/runtime';
import { AboutSection } from './about-section';
import { MaintenanceSection } from './maintenance-section';
import { NotificationsSection } from './notifications-section';
import { PreferencesSection } from './preferences-section';
import { SecuritySection } from './security-section';
import { useSettingsPrefs } from './settings-prefs';

export function SectionBody({ section }: { section: SettingsSection }) {
  usePrefsErrorToast();
  switch (section) {
    case 'preferences':
      return <PreferencesSection />;
    case 'notifications':
      return <NotificationsSection />;
    case 'security':
      return <SecuritySection />;
    case 'maintenance':
      return <MaintenanceSection />;
    case 'about':
      return <AboutSection />;
  }
}

/**
 * Layer 1 of the error rules for the three preference stores (motion kit, Core link, Settings): a
 * failed read or write shows one toast. The stores already wrote the runtime-log record (layer 2)
 * and keep the in-memory value (layer 3).
 */
function usePrefsErrorToast() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const motionError = useMotionPreferences().error;
  const coreError = useCoreLinkSourceSetting().error;
  const settingsError = useSettingsPrefs().error;
  const error = settingsError ?? coreError ?? motionError;
  useEffect(() => {
    if (error === null) return;
    toast.show({ variant: 'warning', label: t(error === 'read' ? 'features.settings.readFailed' : 'features.settings.saveFailed') });
  }, [error, t, toast]);
}
