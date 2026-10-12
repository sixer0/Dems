/**
 * Settings → Notifications (04_mobile_specs §4.15 `notifications`): one `Switch` per alert
 * category, persisted by merge as `notifications` in `dems.mobile.prefs.v1`. Critical alerts are
 * always on: a disabled, selected `Switch` with the explanation.
 */
import { useTranslation } from 'react-i18next';
import { ALWAYS_SHOWN_KINDS, NOTIFICATION_CATEGORIES } from './settings-model';
import { useSettingsPrefs } from './settings-prefs';
import { GroupCard, SectionStack, SwitchRow } from './settings-controls';

export function NotificationsSection() {
  const { t } = useTranslation();
  const prefs = useSettingsPrefs();
  return (
    <SectionStack testID="settings-notifications">
      <GroupCard
        title={t('features.settings.notifications.intro')}
        index={0}
        testID="settings-notifications-categories"
        footnote={t('system.settings.localNote')}
      >
        {NOTIFICATION_CATEGORIES.map((category) => (
          <SwitchRow
            key={category}
            testID={`settings-notify-${category}`}
            label={t(`features.settings.notifications.categories.${category}.label`)}
            description={t(`features.settings.notifications.categories.${category}.hint`)}
            isSelected={prefs.notifications[category]}
            onChange={(on) => prefs.setNotification(category, on)}
          />
        ))}
        <SwitchRow
          key="critical"
          testID="settings-notify-critical"
          label={t('features.settings.notifications.critical')}
          // Fix wave Q (CP-06): the critical kinds by name, from the severity table - a camera loss among them.
          description={t('features.settings.notifications.criticalHint', { kinds: ALWAYS_SHOWN_KINDS.map((kind) => t(`common.faultKind.${kind}`)).join(', ') })}
          isSelected
          isDisabled
          onChange={() => undefined}
        />
      </GroupCard>
    </SectionStack>
  );
}
