/**
 * "Core server address" on the Pair screen (task 2026-11-05 row 236, decision D263, the user's request): host and
 * port of the Core server this device pairs with, shown before pairing in LIVE mode, prefilled with the address in
 * force (`127.0.0.1:4420` until it is set).
 *
 * | Rule | How |
 * |------|-----|
 * | The rules of the address are the runtime's | `validateCoreAddress` (`runtime/core-address.ts`): IPv4 private, loopback or link-local, or a host name; port 1-65535; no scheme, no path, no IPv6. Each refusal has its own sentence under its field |
 * | "Use this address" puts it in force | `setCoreAddress`: the pairing with the previous Core is forgotten first, then the runtime builds a new Live source for the address, so "Reach the Core server" and Pair go to the entered address |
 * | Pair never goes to an address the field does not show | while the field holds an edit that is not in force, `onPendingChange(true)`: the code card keeps Pair disabled |
 * | Nothing is sent from here | the field calls no Core operation and opens no connection itself |
 */
import { Alert, Button, FieldError, InputGroup, Label, Spinner, TextField } from 'heroui-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { derived, fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { SectionCard } from '@/components/kit';
import { formatCoreAddress, sameCoreAddress, useCoreAddressSetting, validateCoreAddress, type CoreAddressCheck } from '@/runtime';

export interface CoreAddressFieldProps {
  /** An attempt runs: the address cannot change under it. */
  disabled: boolean;
  /** True while the fields hold an address that is not in force (an edit, or one being applied). */
  onPendingChange: (pending: boolean) => void;
}

export function CoreAddressField({ disabled, onPendingChange }: CoreAddressFieldProps) {
  const { t } = useTranslation();
  const { address, set } = useCoreAddressSetting();
  const [host, setHost] = useState(address.host);
  const [port, setPort] = useState(String(address.port));
  /** The check of the last "Use this address": its refusals show until the next edit of that field. */
  const [shown, setShown] = useState<CoreAddressCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetFailed, setResetFailed] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The address in force changed under the field (the stored one was read): the field follows it.
  const [seen, setSeen] = useState(address);
  if (!sameCoreAddress(seen, address)) {
    setSeen(address);
    setHost(address.host);
    setPort(String(address.port));
    setShown(null);
  }

  const entered = validateCoreAddress(host, port);
  const pending = busy || !entered.ok || !sameCoreAddress(entered.address, address);
  useEffect(() => {
    onPendingChange(pending);
  }, [pending, onPendingChange]);

  const apply = (): void => {
    const check = validateCoreAddress(host, port);
    setShown(check);
    setResetFailed(false);
    if (!check.ok || sameCoreAddress(check.address, address)) return;
    setBusy(true);
    void set(check.address).then((result) => {
      if (!mounted.current) return;
      setBusy(false);
      setResetFailed(result === 'resetFailed');
    });
  };

  const hostProblem = shown !== null && !shown.ok ? shown.host : null;
  const portProblem = shown !== null && !shown.ok ? shown.port : null;
  const locked = disabled || busy;

  return (
    <SectionCard testID="pairing-core-address" title={t('features.pairing.live.address.title')} description={t('features.pairing.live.address.description')}>
      <View style={styles.row}>
        <View style={styles.host}>
          <TextField isRequired isInvalid={hostProblem !== null} isDisabled={locked}>
            <Label>{t('features.pairing.live.address.host')}</Label>
            <InputGroup>
              <InputGroup.Input
                testID="pairing-core-host"
                value={host}
                onChangeText={(value) => {
                  setHost(value);
                  if (hostProblem !== null) setShown(null);
                }}
                placeholder={t('features.pairing.live.address.hostPlaceholder')}
                accessibilityLabel={t('features.pairing.live.address.hostA11y')}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                keyboardType="url"
                returnKeyType="next"
                className="font-mono"
              />
            </InputGroup>
            {hostProblem !== null ? <FieldError testID="pairing-core-host-error">{t(`features.pairing.live.address.problems.host.${hostProblem}`)}</FieldError> : null}
          </TextField>
        </View>
        <View style={styles.port}>
          <TextField isRequired isInvalid={portProblem !== null} isDisabled={locked}>
            <Label>{t('features.pairing.live.address.port')}</Label>
            <InputGroup>
              <InputGroup.Input
                testID="pairing-core-port"
                value={port}
                onChangeText={(value) => {
                  setPort(value);
                  if (portProblem !== null) setShown(null);
                }}
                accessibilityLabel={t('features.pairing.live.address.portA11y')}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={5}
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={apply}
                className="font-mono"
              />
            </InputGroup>
            {portProblem !== null ? <FieldError testID="pairing-core-port-error">{t(`features.pairing.live.address.problems.port.${portProblem}`)}</FieldError> : null}
          </TextField>
        </View>
      </View>
      <Text style={styles.note} testID="pairing-core-address-in-use" accessibilityLiveRegion="polite">
        {pending && !busy
          ? t('features.pairing.live.address.pending', { address: formatCoreAddress(address) })
          : t('features.pairing.live.address.inUse', { address: formatCoreAddress(address) })}
      </Text>
      {resetFailed ? (
        <Alert status="danger" testID="pairing-core-address-reset-failed">
          <Alert.Indicator />
          <Alert.Content>
            <Text style={styles.alertText}>{t('features.pairing.live.address.resetFailed')}</Text>
          </Alert.Content>
        </Alert>
      ) : null}
      <Button
        testID="pairing-core-address-apply"
        variant="outline"
        size="lg"
        isDisabled={locked}
        onPress={apply}
        accessibilityState={{ busy, disabled: locked }}
      >
        {busy ? <Spinner size="sm" color={palette.gold} /> : null}
        <Button.Label>{busy ? t('features.pairing.live.address.applying') : t('features.pairing.live.address.apply')}</Button.Label>
      </Button>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  host: { flexGrow: 3, flexBasis: 200 },
  port: { flexGrow: 1, flexBasis: 96 },
  note: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: derived.foreground2,
  },
  alertText: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: derived.foreground2,
  },
});
