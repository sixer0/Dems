/**
 * Settings → About DEMS (04_mobile_specs §4.15 `about`): product and device identity (a §24.1
 * subset from the simulator, labelled DEMO / synthetic), the native app build (expo-constants),
 * licences and credits (fonts OFL-1.1; the hero photo credit of THIRD_PARTY_NOTICES.md) in a
 * sheet, and "Stack diagnostics" → `/stack-check`. No URLs in app copy (MA-25).
 */
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Chip, LinkButton } from 'heroui-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSim, type SimState } from '@dems/shared/sim';
import { spacing } from '@dems/shared/tokens';
import { KeyValueList, SectionCard, type KeyValueItem } from '@/components/kit';
import { SheetFrame } from './sheet-frame';
import { SectionStack, settingsStyles } from './settings-controls';

const selectDevice = (s: SimState) => s.device;

export function AboutSection() {
  const { t } = useTranslation();
  const router = useRouter();
  const device = useSim(selectDevice);
  const [licencesOpen, setLicencesOpen] = useState(false);
  const appBuild = Constants.expoConfig?.version ?? t('common.states.notAvailable');

  const product: KeyValueItem[] = [
    { id: 'product', label: t('features.settings.about.product'), value: device.productName, testID: 'settings-about-product' },
    { id: 'release', label: t('features.settings.about.softwareRelease'), value: `v${device.softwareVersion}`, mono: true, testID: 'settings-about-version' },
    { id: 'tablet', label: t('features.settings.about.tabletApp'), value: `v${device.identity.tabletAppVersion}`, mono: true },
    { id: 'build', label: t('features.settings.about.appBuild'), value: appBuild, mono: true, testID: 'settings-about-build' },
  ];
  const identity: KeyValueItem[] = [
    { id: 'device', label: t('system.about.deviceId'), value: device.id, mono: true, testID: 'settings-about-device' },
    { id: 'room', label: t('system.about.room'), value: device.room },
    { id: 'serial', label: t('system.about.fields.serialNumber'), value: device.identity.serialNumber, mono: true },
    { id: 'bsp', label: t('system.about.fields.bspVersion'), value: device.identity.bspVersion, mono: true },
    { id: 'tpm', label: t('system.about.fields.tpmModelFirmware'), value: device.identity.tpmModelFirmware },
    { id: 'provisioning', label: t('system.about.fields.provisioningRecordId'), value: device.identity.provisioningRecordId, mono: true },
  ];
  const demoChip = (
    <Chip size="sm" variant="soft" color="warning" testID="settings-about-demo">
      <Chip.Label>{t('system.demo.badge')}</Chip.Label>
    </Chip>
  );

  return (
    <SectionStack testID="settings-about">
      <SectionCard title={t('features.settings.about.productTitle')} action={demoChip} testID="settings-about-product-card">
        <KeyValueList items={product} />
      </SectionCard>
      <SectionCard title={t('system.about.identityTitle')} description={t('system.about.synthetic')} action={demoChip} testID="settings-about-identity">
        <KeyValueList items={identity} />
      </SectionCard>
      <SectionCard title={t('features.settings.about.licences')} testID="settings-about-licences">
        <View style={styles.links}>
          <LinkButton size="sm" onPress={() => setLicencesOpen(true)} testID="settings-about-licences-open">
            <LinkButton.Label>{t('features.settings.about.licencesOpen')}</LinkButton.Label>
          </LinkButton>
          <LinkButton size="sm" onPress={() => router.push('/stack-check')} testID="settings-about-stack-check">
            <LinkButton.Label>{t('features.settings.about.stackDiagnostics')}</LinkButton.Label>
          </LinkButton>
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
