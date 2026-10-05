/**
 * Settings → App Preferences (04_mobile_specs §4.15 `preferences`; brief of step 88):
 *
 * - Reduce motion: the in-app override of §7.7, through the motion kit (`useMotionPreferences`;
 *   persisted by merge into `dems.mobile.prefs.v1`, D57). The OS setting is shown when it already
 *   reduces motion.
 * - Haptics (§7.6), through the same kit hook.
 * - Presentation mode: `presentationMode` merged into `dems.mobile.prefs.v1`, which the Login screen
 *   reads to hide the demo operators (D88); it also hides the Demo controls here.
 * - Core link source: Simulated (default) or the mock-core heartbeat (Q-M8, D38), through the
 *   runtime (`useCoreLinkSourceSetting`, merge-write). Release builds show Heartbeat disabled
 *   (Simulated-only APK, 06_packaging_spec §2.6, D112).
 *   Backend task W82 (04_client_integration_spec §3.3, §9.5; AC-C-31, AC-C-83): the third segment
 *   `Live` (debug builds; disabled in a release build, as Heartbeat). A change across the LIVE
 *   boundary asks first, signs the operator out and then stores the source (`useCoreLinkSwitch`);
 *   SIMULATED <-> HEARTBEAT stays instant. One line about Live follows the existing hint.
 * - Meter size (brief): the monitor's default meter size, merged as `meterSize`.
 * - Language: English; Bahasa Indonesia is shown disabled ("later", A10).
 * - Performance overlay: debug builds only (D-69-5: session-only, no stored field).
 */
import { useTranslation } from 'react-i18next';
import { CORE_LINK_SOURCES, isCoreLinkSourceAvailable, type CoreLinkSource } from '@/runtime';
import { useMotionPreferences } from '@/motion';
import { CoreModeDialog, useCoreLinkSwitch } from './core-link-switch';
import { METER_SIZES, type MeterSize } from './settings-model';
import { useSettingsPrefs } from './settings-prefs';
import { GroupCard, SectionStack, SegmentRow, SwitchRow } from './settings-controls';

export function PreferencesSection() {
  const { t } = useTranslation();
  const motion = useMotionPreferences();
  const core = useCoreLinkSwitch();
  const prefs = useSettingsPrefs();

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

        <GroupCard title={t('features.settings.preferences.coreGroup')} index={2} testID="settings-preferences-core">
          <SegmentRow<CoreLinkSource>
            key="core-link"
            testID="settings-core-link"
            label={t('mobile.coreLink.sourceLabel')}
            description={
              __DEV__
                ? `${t('features.settings.preferences.coreLinkHint')} ${t('features.settings.preferences.coreLinkHintLive')}`
                : `${t('features.settings.preferences.coreLinkHintRelease')} ${t('features.settings.preferences.coreLinkHintLiveRelease')}`
            }
            value={core.source}
            options={CORE_LINK_SOURCES.map((source) => ({
              value: source,
              label: t(`mobile.coreLink.source.${source}`),
              // Release builds are Simulated-only (06_packaging_spec §2.6, D112): Heartbeat and Live are disabled.
              isDisabled: !isCoreLinkSourceAvailable(source),
            }))}
            onChange={core.request}
          />
        </GroupCard>

        <GroupCard title={t('features.settings.preferences.displayGroup')} index={3} testID="settings-preferences-display">
          <SegmentRow<MeterSize>
            key="meter-size"
            testID="settings-meter-size"
            label={t('features.settings.preferences.meterSize')}
            description={t('features.settings.preferences.meterSizeHint')}
            value={prefs.meterSize}
            options={METER_SIZES.map((size) => ({
              value: size,
              label: t(size === 'card' ? 'features.settings.preferences.meterStandard' : 'features.settings.preferences.meterCompact'),
            }))}
            onChange={prefs.setMeterSize}
          />
          <SegmentRow<'en' | 'id'>
            key="language"
            testID="settings-language"
            label={t('features.settings.preferences.language')}
            description={t('features.settings.preferences.languageHint')}
            value="en"
            options={[
              { value: 'en', label: t('features.settings.preferences.languageEnglish') },
              { value: 'id', label: t('features.settings.preferences.languageIndonesian'), isDisabled: true },
            ]}
            onChange={() => undefined}
          />
        </GroupCard>

        {__DEV__ ? (
          <GroupCard title={t('features.settings.preferences.debugGroup')} index={4} testID="settings-preferences-debug">
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
