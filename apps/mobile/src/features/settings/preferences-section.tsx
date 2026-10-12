/**
 * Settings → App Preferences (04_mobile_specs §4.15 `preferences`; brief of step 88):
 *
 * - Reduce motion: the in-app override of §7.7, through the motion kit (`useMotionPreferences`;
 *   persisted by merge into `dems.mobile.prefs.v1`, D57). The OS setting is shown when it already
 *   reduces motion.
 * - Haptics (§7.6), through the same kit hook.
 * - Presentation mode: `presentationMode` merged into `dems.mobile.prefs.v1`, which the Login screen
 *   reads to hide the demo operators (D88); it also hides the Demo controls here.
 * - Developer group (fix wave J, JA2-29 / N-03): Core link source and Performance overlay. Shown only
 *   in a development build while presentation mode is off (`developerControlsShown`); a release
 *   build and a presentation never show them. Core link source: Simulated (default), the mock-core
 *   heartbeat (Q-M8, D38) or Live (backend task W82; 04_client_integration_spec §3.3, §9.5), through
 *   the runtime (`useCoreLinkSourceSetting`, merge-write). A change across the LIVE boundary asks
 *   first, signs the operator out and then stores the source (`useCoreLinkSwitch`);
 *   SIMULATED <-> HEARTBEAT stays instant. The launch URL switch `core=LIVE` (runtime/debug.ts) is
 *   independent of this control. Performance overlay: session-only (D-69-5), read by
 *   `motion/debug-overlay.tsx`.
 * - Not shown (fix wave J, Settings audit): "Meter size" had no reader (the session monitor keeps its
 *   own choice, hand-over H-S88-2) and "Language" had one usable value; a control without an effect
 *   is not drawn. The stored `meterSize` field and its setter stay in `settings-prefs.ts` for the
 *   monitor's owner.
 */
import { useTranslation } from 'react-i18next';
import { CORE_LINK_SOURCES, isCoreLinkSourceAvailable, type CoreLinkSource } from '@/runtime';
import { useMotionPreferences } from '@/motion';
import { CoreModeDialog, useCoreLinkSwitch } from './core-link-switch';
import { developerControlsShown } from './settings-model';
import { useSettingsPrefs } from './settings-prefs';
import { GroupCard, SectionStack, SegmentRow, SwitchRow } from './settings-controls';

export function PreferencesSection() {
  const { t } = useTranslation();
  const motion = useMotionPreferences();
  const core = useCoreLinkSwitch();
  const prefs = useSettingsPrefs();
  const developer = developerControlsShown({ dev: __DEV__, presentationMode: prefs.presentationMode });

  return (
    <>
      <SectionStack testID="settings-preferences">
        <GroupCard title={t('features.settings.preferences.motionGroup')} index={0} testID="settings-preferences-motion">
          <SwitchRow
            key="reduce-motion"
            testID="settings-reduce-motion"
            label={t('system.settings.reduceMotion')}
            description={motion.osReduceMotion ? t('system.settings.reduceMotionOs') : t('system.settings.reduceMotionHint')}
            isSelected={motion.reduceMotionOverride}
            onChange={motion.setReduceMotionOverride}
          />
          <SwitchRow
            key="haptics"
            testID="settings-haptics"
            label={t('mobile.haptics.label')}
            description={t('mobile.haptics.description')}
            isSelected={motion.hapticsEnabled}
            onChange={motion.setHapticsEnabled}
          />
        </GroupCard>

        <GroupCard title={t('features.settings.preferences.demoGroup')} index={1} testID="settings-preferences-demo">
          <SwitchRow
            key="presentation"
            testID="settings-presentation-mode"
            label={t('system.settings.presentationMode')}
            description={t('system.settings.presentationModeHint')}
            isSelected={prefs.presentationMode}
            onChange={prefs.setPresentationMode}
          />
        </GroupCard>

        {/* Fix wave J (JA2-29, N-03): the developer controls are not an operator's menu. One group,
            shown only in a development build while presentation mode is off (`developerControlsShown`). */}
        {developer ? (
          <GroupCard title={t('features.settings.preferences.debugGroup')} index={2} testID="settings-preferences-debug">
            <SegmentRow<CoreLinkSource>
              key="core-link"
              testID="settings-core-link"
              label={t('mobile.coreLink.sourceLabel')}
              description={`${t('features.settings.preferences.coreLinkHint')} ${t('features.settings.preferences.coreLinkHintLive')}`}
              value={core.source}
              options={CORE_LINK_SOURCES.map((source) => ({
                value: source,
                label: t(`mobile.coreLink.source.${source}`),
                isDisabled: !isCoreLinkSourceAvailable(source),
              }))}
              onChange={core.request}
            />
            <SwitchRow
              key="overlay"
              testID="settings-performance-overlay"
              label={t('features.settings.preferences.performanceOverlay')}
              description={t('features.settings.preferences.performanceOverlayHint')}
              isSelected={motion.debugOverlay}
              onChange={motion.setDebugOverlay}
            />
          </GroupCard>
        ) : null}
      </SectionStack>
      {/* Outside the stack: the dialog's root view must not add a gap between the cards. */}
      <CoreModeDialog target={core.target} busy={core.busy} pending={core.pending} onConfirm={core.confirm} onCancel={core.cancel} />
    </>
  );
}
