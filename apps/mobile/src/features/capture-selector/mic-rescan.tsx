/**
 * Microphones: "Search again" re-reads the local inputs (task 3, blueprint row 138; ux spec §8g flow
 * 13, control G17; specs R-10 AC-2; decisions D80(5), D83).
 *
 * | Spec | Here |
 * |---|---|
 * | What it is | operation 97 `rescanCaptureInputs`: ONE request, ONE answer. No network search, no list of candidates, nothing to connect, no password; no progress bar and no polling |
 * | §8g.1 states 1, 8 | the button is always in place; "Checking your permissions…" / the role sentence / the waiting sentence disable it, in visible text |
 * | state 3 | the button is pending (`PendingSpinner`) while the request is out |
 * | state 4 | one line per registered microphone: "Ready" or the named state with its sentence (§8f.3); "Checked at" from `scannedAt`, a Core instant |
 * | state 5 | the count of other inputs; no action |
 * | state 6 | the shared rate-limit sentence with the fixed seconds; one timer re-enables the button, no label ticks |
 * | state 7 | "Capture is not ready yet" + Retry (one call per press) |
 * | §8f.3 "Never silently replaced" | a microphone that is not Ready keeps its row and its name; nothing is offered in its place |
 *
 * The result lives in component state only. The rows of the selector and of the Devices list keep
 * following the `captureDevices` slice, which the Core republishes after a re-read.
 */
import { Alert, Button } from 'heroui-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import type { CaptureInputScan } from '@dems/shared/api';
import { formatClock } from '@dems/shared/realtime';
import { Permission, useSimInstance } from '@dems/shared/sim';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { StatusChip } from '@/components/kit';
import { useRoleGate } from '@/features/rbac/use-role-gate';
import { PendingSpinner, busyState, reportRuntimeIssue, useCoreLinkNotice, useMobileLive } from '@/runtime';
import { LOCAL_STATE_TONE, classifyRescanAnswer, inputScanOf, localDeviceSentenceKey, localDeviceStateOf, type RescanAnswerClass } from './capture-notices-model';
import { liveDiscoveryPort, simDiscoveryPort, type DiscoveryPort } from './capture-discovery-port';

export type RescanGate = 'checking' | 'waiting' | 'denied' | 'allowed';

export interface MicRescan {
  readonly gate: RescanGate;
  /** Why the button is disabled, as a sentence; null when it is not. */
  readonly gateHint: string | null;
  readonly pending: boolean;
  /** The last answer of operation 97, or null. */
  readonly result: CaptureInputScan | null;
  readonly note: 'notReady' | 'failed' | 'offline' | null;
  /** The fixed seconds of a `429`; `0` = no time was sent; null = not limited. */
  readonly limitedSeconds: number | null;
  readonly canRescan: boolean;
  run(): void;
}

export function useMicRescan(): MicRescan {
  const { t } = useTranslation();
  const sim = useSimInstance();
  const live = useMobileLive();
  const role = useRoleGate(Permission.CAPTURE_CONFIG);
  const link = useCoreLinkNotice();
  const port = useMemo<DiscoveryPort>(() => (live === null ? simDiscoveryPort(sim) : liveDiscoveryPort(live.client)), [live, sim]);

  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<CaptureInputScan | null>(null);
  const [note, setNote] = useState<MicRescan['note']>(null);
  const [limitedSeconds, setLimitedSeconds] = useState<number | null>(null);
  const out = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // State 6: the button re-enables by itself at the instant the Core named; nothing is re-read by itself.
  useEffect(() => {
    if (limitedSeconds === null) return undefined;
    const timer = setTimeout(() => setLimitedSeconds(null), Math.max(1, limitedSeconds) * 1000);
    return () => clearTimeout(timer);
  }, [limitedSeconds]);

  const gate: RescanGate = !role.known ? 'checking' : link.offline ? 'waiting' : !role.allowed ? 'denied' : 'allowed';

  const run = useCallback(() => {
    if (out.current || gate !== 'allowed' || limitedSeconds !== null) return;
    out.current = true;
    setPending(true);
    setNote(null);
    void port.rescan().then((answer) => {
      out.current = false;
      let outcome: RescanAnswerClass = classifyRescanAnswer(answer.facts.status);
      const scan = outcome === 'ok' ? inputScanOf(answer.body) : null;
      if (outcome === 'ok' && scan === null) outcome = 'failed';
      if (outcome !== 'ok') {
        reportRuntimeIssue(outcome === 'failed' || outcome === 'offline' ? 'error' : 'warn', 'devices.micRescan', `microphone re-read -> ${outcome}`, { result: outcome, status: answer.facts.status });
      }
      if (!mounted.current) return;
      setPending(false);
      if (scan !== null) setResult(scan);
      else if (outcome === 'limited') setLimitedSeconds(answer.facts.retryAfterS ?? 0);
      else if (outcome === 'notReady') setNote('notReady');
      else if (outcome === 'offline') setNote('offline');
      else if (outcome !== 'denied') setNote('failed');
    });
  }, [gate, limitedSeconds, port]);

  const gateHint =
    gate === 'checking'
      ? (role.hint ?? t('mobile.rbac.checking'))
      : gate === 'waiting'
        ? t('features.capture-selector.selector.gate.waiting')
        : gate === 'denied'
          ? t('features.capture-selector.selector.gate.denied', { first: t('common.roles.SUPERVISOR'), second: t('common.roles.TECHNICIAN') })
          : null;

  return { gate, gateHint, pending, result, note, limitedSeconds, canRescan: gate === 'allowed' && !pending && limitedSeconds === null, run };
}

export interface MicRescanProps {
  testID?: string;
  /** Leaves out the description line (a notification already says what the action is about). */
  compact?: boolean;
}

const K = 'features.capture-selector.inputs';

/** G17 with its result, wherever a microphone can be searched again. */
export function MicRescanControl({ testID = 'mic-rescan', compact = false }: MicRescanProps) {
  const { t } = useTranslation();
  const rescan = useMicRescan();
  const { result } = rescan;
  return (
    <View style={styles.block} testID={testID}>
      <View style={styles.actionRow}>
        <Button
          variant="outline"
          size="sm"
          isDisabled={!rescan.canRescan}
          onPress={rescan.run}
          testID={`${testID}-action`}
          accessibilityLabel={t(`${K}.againLabel`)}
          {...(rescan.gateHint === null ? {} : { accessibilityHint: rescan.gateHint })}
          {...busyState(rescan.pending, !rescan.canRescan)}
        >
          {rescan.pending ? <PendingSpinner color={palette.gold} testID={`${testID}-spinner`} /> : null}
          <Button.Label>{t(`${K}.again`)}</Button.Label>
        </Button>
      </View>
      {compact ? null : (
        <Text maxFontSizeMultiplier={1.2} style={styles.muted} testID={`${testID}-description`}>
          {t(`${K}.description`)}
        </Text>
      )}
      {rescan.gateHint !== null ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.muted} testID={`${testID}-gate`} accessibilityLiveRegion="polite">
          {rescan.gateHint}
        </Text>
      ) : null}
      {rescan.limitedSeconds !== null ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.line} testID={`${testID}-limited`}>
          {rescan.limitedSeconds > 0 ? t('common.coreErrors.limited', { seconds: rescan.limitedSeconds }) : t('common.coreErrors.limitedNoTime')}
        </Text>
      ) : null}
      {rescan.note === 'notReady' ? (
        <Alert status="warning" testID={`${testID}-not-ready`}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{t(`${K}.notReady`)}</Alert.Description>
            <View style={styles.actionRow}>
              <Button variant="outline" size="sm" isDisabled={!rescan.canRescan} onPress={rescan.run} testID={`${testID}-retry`}>
                <Button.Label>{t('common.actions.retry')}</Button.Label>
              </Button>
            </View>
          </Alert.Content>
        </Alert>
      ) : null}
      {rescan.note === 'failed' || rescan.note === 'offline' ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.line} testID={`${testID}-failed`}>
          {rescan.note === 'offline' ? t('common.coreErrors.offline') : t(`${K}.failed`)}
        </Text>
      ) : null}
      {result !== null ? (
        <View style={styles.block} testID={`${testID}-result`} accessibilityLiveRegion="polite">
          {result.inputs.map((input) => {
            const state = localDeviceStateOf(input.present, input.errorCode);
            const sentence = localDeviceSentenceKey(state, 'MIC');
            const stateText = t(`features.capture-selector.localDevice.state.${state}`);
            const name = input.inputId ?? input.deviceId;
            return (
              <View key={input.deviceId} style={styles.block} testID={`${testID}-input-${input.deviceId}`} accessible accessibilityLabel={t(`${K}.result`, { input: name, state: stateText })}>
                <View style={styles.actionRow}>
                  <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.name}>
                    {name}
                  </Text>
                  <StatusChip size="sm" tone={LOCAL_STATE_TONE[state]} label={stateText} icon={null} testID={`${testID}-state-${input.deviceId}`} />
                </View>
                {sentence !== null ? (
                  <Text maxFontSizeMultiplier={1.2} style={styles.muted} testID={`${testID}-sentence-${input.deviceId}`}>
                    {t(`features.capture-selector.localDevice.${sentence}`)}
                  </Text>
                ) : null}
              </View>
            );
          })}
          <Text maxFontSizeMultiplier={1.2} style={styles.muted} testID={`${testID}-checked-at`}>
            {t(`${K}.checkedAt`, { time: formatClock(result.scannedAt) })}
          </Text>
          {result.unregisteredCount >= 1 ? (
            <Text maxFontSizeMultiplier={1.2} style={styles.muted} testID={`${testID}-unregistered`}>
              {t(`${K}.unregistered`, { count: result.unregisteredCount })}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing[1] },
  actionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[1] },
  name: { fontFamily: fontFamily.native.medium, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  line: { fontFamily: fontFamily.native.normal, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  muted: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.gray },
});
