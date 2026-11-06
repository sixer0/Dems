/**
 * Settings → Capture (task 3, blueprint row 68; register MB-09; ux spec §2.6 "Surface": tablet
 * "Settings → capture", phone "Settings → Devices"). The section holds the device selector — the same
 * `CaptureSelector` card the Devices screen mounts, so the two surfaces can never disagree — and a
 * row to the Devices screen, where status, health and diagnostics live.
 *
 * The selector reads the replicated `captureConfig` / `captureDevices` slices and gates its edit
 * controls itself (G1-G3: "Checking your permissions…", the role sentence, the OD-10 lock). A render
 * failure of it shows the panel card with a rate-limited Retry, never an empty section.
 *
 * Mount points of other rows (D95: this file is row 68's; the others hand over one import and one line):
 * - row 118 (R-8, ux §8a): the STT status is its OWN Settings section ("Transcription status",
 *   `SectionBody` case `transcription`), as §8a's "Entry" row says; it is NOT mounted here.
 * - row 138 (flow 9): the entry row "Search for cameras" (opens the Devices screen, which holds the
 *   search panel) is in the group below; the selector card draws the no-device notifications itself here.
 */
import { useTranslation } from 'react-i18next';
import { CaptureSelector } from './capture-selector';
import { PanelBoundary } from '@/features/devices/panel-boundary';
import { useOpenTabRoot } from '@/navigation/tab-root';
import { GroupCard, NavRow, SectionStack } from '@/features/settings/settings-controls';

export function CaptureSection() {
  const { t } = useTranslation();
  const openTabRoot = useOpenTabRoot();
  return (
    <SectionStack testID="settings-capture">
      <PanelBoundary name="settings-capture-selector">
        <CaptureSelector testID="settings-capture-selector" />
      </PanelBoundary>
      <GroupCard title={t('system.settings.deviceSettings')} index={1} testID="settings-capture-links">
        <NavRow
          testID="settings-capture-open-devices"
          icon="devices"
          label={t('features.capture-selector.settings.devicesLink')}
          description={t('features.capture-selector.settings.devicesHint')}
          onPress={() => openTabRoot('/devices')}
        />
        {/* Row 138 (flow 9, §8c.1): an entry row, not a second implementation — the search runs on the
            Devices screen, at its "Camera search" panel. A press starts no search (R-9 AC-1). */}
        <NavRow
          testID="settings-capture-open-search"
          icon="capture"
          label={t('features.capture-selector.search.openSearch')}
          description={t('features.capture-selector.search.intro')}
          accessibilityHint={t('features.capture-selector.search.openSearchHint')}
          onPress={() => openTabRoot('/devices')}
        />
      </GroupCard>
    </SectionStack>
  );
}
