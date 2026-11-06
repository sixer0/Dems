/**
 * Settings → About DEMS (04_mobile_specs §4.15 `about`): product and device identity (a §24.1
 * subset from the simulator, labelled DEMO / synthetic), the native app build (expo-constants),
 * licences and credits (fonts OFL-1.1; the hero photo credit of THIRD_PARTY_NOTICES.md) in a
 * sheet, and "Stack diagnostics" → `/stack-check` (a developer page: development build, presentation
 * mode off; fix wave J, JA2-29). No URLs in app copy (MA-25).
 *
 * Audit M3-10 (row 197; register I4-I7 of masterplan/01_specs_m3.md; D52, D72, D159; web reference row 105
 * `about-panel.tsx` and CS2 `useReportedCoreDeviceId`): on a Core in its own capture (`isOwnCaptureCoreState`, the
 * one rule) the cards draw no DEMO chip and no "Synthetic demo values" description (I5/I7), and the values of the
 * appliance model - product (model), room, serial number, BSP, TPM and provisioning record - read
 * `system.noProducer` (I4). The device id is the shared reader `reportedCoreDeviceIdOf` (I6): the Core's record,
 * "Not reported" while it still holds the dataset's reserved id. The simulated lane is unchanged.
 */
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Chip, LinkButton } from 'heroui-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { isOwnCaptureCoreState, isPlatformNotReported, reportedCoreDeviceIdOf, useSim, type SimState } from '@dems/shared/sim';
import { useCoreLink } from '@/runtime';
import { useCoreComponents } from '@/lib/core-components';
import { spacing } from '@dems/shared/tokens';
import { KeyValueList, SectionCard, type KeyValueItem } from '@/components/kit';
import { developerControlsShown } from './settings-model';
import { useSettingsPrefs } from './settings-prefs';
import { SheetFrame } from './sheet-frame';
import { SectionStack, settingsStyles } from './settings-controls';

const selectDevice = (s: SimState) => s.device;

export function AboutSection() {
  const { t } = useTranslation();
  const router = useRouter();
  const device = useSim(selectDevice);
  const platformNotReported = useSim((state) => isPlatformNotReported(state.security));
  const [licencesOpen, setLicencesOpen] = useState(false);
  // Fix wave J (JA2-29): the stack diagnostics page is a developer page, not an operator's.
  const developer = developerControlsShown({ dev: __DEV__, presentationMode: useSettingsPrefs().presentationMode });
  const appBuild = Constants.expoConfig?.version ?? t('common.states.notAvailable');

  // Round two (JW-26 mobile half; contract J2-S 2). On a Core in its OWN capture the model's "Software release"
  // and "Device app" versions are versions of nothing real: they are not drawn. The versions of the real
  // components are a card of their own: the Core's from operation 64 `components` (by name), the app's own build.
  const ownCapture = useSim(isOwnCaptureCoreState);
  const live = useCoreLink().source === 'LIVE';
  const components = useCoreComponents();
  const notReported = t('common.platformNotReported.value');
  // M3-10 (I4, I6, I7): what a Core in its own capture has no producer for reads "Not reported"; the device id is its record (S9 rule).
  const noProducer = t('system.noProducer');
  const modelValue = (value: string): string => (ownCapture ? noProducer : value);
  const reportedId = useSim(reportedCoreDeviceIdOf);
  const product: KeyValueItem[] = [
    { id: 'product', label: t('features.settings.about.product'), value: modelValue(device.productName), testID: 'settings-about-product' },
    ...(ownCapture
      ? []
      : [
          { id: 'release', label: t('features.settings.about.softwareRelease'), value: `v${device.softwareVersion}`, mono: true, testID: 'settings-about-version' },
          { id: 'tablet', label: t('features.settings.about.tabletApp'), value: `v${device.identity.tabletAppVersion}`, mono: true },
        ]),
    ...(live ? [] : [{ id: 'build', label: t('features.settings.about.appBuild'), value: appBuild, mono: true, testID: 'settings-about-build' }]),
  ];
  const versions: KeyValueItem[] = [
    { id: 'core', label: t('features.settings.about.versions.core'), value: components?.core ?? notReported, mono: components?.core != null, testID: 'settings-about-core-version' },
    ...(components?.captureWorker != null ? [{ id: 'worker', label: t('features.settings.about.versions.captureWorker'), value: components.captureWorker, mono: true, testID: 'settings-about-worker-version' }] : []),
    ...(components?.apiContract != null ? [{ id: 'contract', label: t('features.settings.about.versions.apiContract'), value: components.apiContract, mono: true, testID: 'settings-about-contract-version' }] : []),
    { id: 'app', label: t('features.settings.about.versions.mobileApp'), value: appBuild, mono: true, testID: 'settings-about-build' },
  ];
  const identity: KeyValueItem[] = [
    { id: 'device', label: t('system.about.deviceId'), value: reportedId ?? noProducer, mono: reportedId !== null, testID: 'settings-about-device' },
    { id: 'room', label: t('system.about.room'), value: modelValue(device.room), testID: 'settings-about-room' },
    { id: 'serial', label: t('system.about.fields.serialNumber'), value: modelValue(device.identity.serialNumber), mono: !ownCapture, testID: 'settings-about-serial' },
    { id: 'bsp', label: t('system.about.fields.bspVersion'), value: modelValue(device.identity.bspVersion), mono: !ownCapture, testID: 'settings-about-bsp' },
    // Closing pass J (D217 (7)): a Core that states `security.platformNotReported` reads no TPM - the field says so, not the dataset's model.
    { id: 'tpm', label: t('system.about.fields.tpmModelFirmware'), value: platformNotReported ? t('common.platformNotReported.value') : modelValue(device.identity.tpmModelFirmware), testID: 'settings-about-tpm' },
    { id: 'provisioning', label: t('system.about.fields.provisioningRecordId'), value: modelValue(device.identity.provisioningRecordId), mono: !ownCapture, testID: 'settings-about-provisioning' },
  ];
  // M3-10 (I5, I7): the DEMO chip marks the model's values on the simulated lane only - never on a Core in its own capture.
  const demoChip = ownCapture ? undefined : (
    <Chip size="sm" variant="soft" color="warning" testID="settings-about-demo">
      <Chip.Label>{t('system.demo.badge')}</Chip.Label>
    </Chip>
  );

  return (
    <SectionStack testID="settings-about">
      <SectionCard title={t('features.settings.about.productTitle')} action={demoChip} testID="settings-about-product-card">
        <KeyValueList items={product} />
      </SectionCard>
      {live ? (
        <SectionCard title={t('features.settings.about.versions.title')} description={t('features.settings.about.versions.note')} testID="settings-about-versions">
          <KeyValueList items={versions} />
        </SectionCard>
      ) : null}
      <SectionCard title={t('features.settings.about.identityTitle')} description={ownCapture ? undefined : t('system.about.synthetic')} action={demoChip} testID="settings-about-identity">
        <KeyValueList items={identity} />
      </SectionCard>
      <SectionCard title={t('features.settings.about.licences')} testID="settings-about-licences">
        <View style={styles.links}>
          <LinkButton size="sm" onPress={() => setLicencesOpen(true)} testID="settings-about-licences-open">
            <LinkButton.Label>{t('features.settings.about.licencesOpen')}</LinkButton.Label>
          </LinkButton>
          {developer ? (
            <LinkButton size="sm" onPress={() => router.push('/stack-check')} testID="settings-about-stack-check">
              <LinkButton.Label>{t('features.settings.about.stackDiagnostics')}</LinkButton.Label>
            </LinkButton>
          ) : null}
        </View>
      </SectionCard>
      <SheetFrame isOpen={licencesOpen} onClose={() => setLicencesOpen(false)} title={t('features.settings.about.licences')} testID="settings-licences-sheet">
        <LicenceLine title={t('features.settings.about.fonts')} body={t('features.settings.about.fontsLine')} />
        <LicenceLine title={t('features.settings.about.photo')} body={t('features.settings.about.photoLine')} />
        <Text maxFontSizeMultiplier={1.2} style={settingsStyles.muted}>
          {t('features.settings.about.noticesFile')}
        </Text>
      </SheetFrame>
    </SectionStack>
  );
}

function LicenceLine({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.licence}>
      <Text maxFontSizeMultiplier={1.2} style={settingsStyles.strong}>
        {title}
      </Text>
      <Text maxFontSizeMultiplier={1.2} style={settingsStyles.body}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  licence: { gap: 2 },
});
