/**
 * Run diagnostics (04_mobile_specs §4.12 V5: `Button` "Run diagnostics" → `BottomSheet` of checks,
 * `Spinner` → `StatusChip`, via `runDiagnostics()`). The simulator resolves its eight checks one
 * after another on its own clock (`resolvesAt`), so the sheet only renders `state.diagnostics`;
 * it needs no timer of its own (D73 F74-09). Labels come from `system.diagnostics.checks.<id>`;
 * the simulator's English `detail` text is never shown (review 40 m4).
 *
 * Two device findings apply (step 79 F-79-2, step 83): the kit portals sheet content above the
 * simulator's provider, so the frame re-provides it; the sheet mounts on request and opens once its
 * content has laid out (`useSheetPresence`), and it is exempt from the reduce-motion setting with
 * the short reduced fade instead (a gorhom sheet never snapped open under ReducedMotionConfig).
 *
 * LIVE mode (backend task W78; 04_client_integration_spec §3.2, §8.1 LB-1, LB-2; site S2-8): the
 * sheet opens only once the Core accepted the run, and it renders the Core's `diagnostics` slice, so
 * its subtitle says nothing about a simulation. "Run again" is the control of a command that may be
 * out: it is marked busy from the press, and the kit's `Spinner` shows in it after
 * `LIVE_PENDING_REVEAL_MS` (the caller passes both flags as plain values: this content is
 * portalled, so it reads no runtime hook of its own).
 */
import { BottomSheet, Button, Spinner } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { ReduceMotion } from 'react-native-reanimated';
import { SimContext, useSim, useSimInstance, type DiagnosticCheck, type DiagnosticsRun } from '@dems/shared/sim';
import { fontFamily, palette, spacing, typography, type StatusTone } from '@dems/shared/tokens';
import { StatusChip } from '@/components/kit';
import { REDUCED_FADE_MS, useMotionPolicy } from '@/motion';
import { PendingSpinner, busyState } from '@/runtime';
import { SheetContentSignal, useSheetPresence } from './use-sheet-presence';

const CHECK_TONE: Readonly<Record<string, StatusTone>> = { PASS: 'success', WARN: 'warning', FAIL: 'danger' };

export interface DiagnosticsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Starts another run (the caller holds the Core's actions and the error handling). */
  onRunAgain: () => void;
  /** The Core link source is LIVE: the Core's words. */
  live?: boolean;
  /** A run the caller started is out (LB-1): "Run again" is marked busy. */
  runAgainBusy?: boolean;
  /** It has been out for `LIVE_PENDING_REVEAL_MS` or longer: the kit's `Spinner` shows in "Run again". */
  runAgainPending?: boolean;
}

export function DiagnosticsSheet({ isOpen, onClose, onRunAgain, live = false, runAgainBusy = false, runAgainPending = false }: DiagnosticsSheetProps) {
  const { t } = useTranslation();
  const sim = useSimInstance();
  const reduced = useMotionPolicy() === 'reduced';
  const presence = useSheetPresence(isOpen);
  if (!presence.mounted) return null;
  return (
    <BottomSheet isOpen={presence.open} onOpenChange={(open) => (open ? undefined : onClose())}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content overrideReduceMotion={ReduceMotion.Never} {...(reduced ? { animationConfigs: { duration: REDUCED_FADE_MS } } : {})}>
          <SheetContentSignal onChange={presence.setContentMounted}>
            <SimContext.Provider value={sim}>
              <DiagnosticsBody
                onClose={onClose}
                onRunAgain={onRunAgain}
                closeLabel={t('features.devices.diagnostics.close')}
                subtitleKey={live ? 'system.live.diagnosticsSubtitle' : 'system.diagnostics.subtitle'}
                runAgainBusy={runAgainBusy}
                runAgainPending={runAgainPending}
              />
            </SimContext.Provider>
          </SheetContentSignal>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

interface DiagnosticsBodyProps {
  onClose: () => void;
  onRunAgain: () => void;
  closeLabel: string;
  /** The subtitle's i18n key: the Simulated one says "(simulated)", the LIVE one does not. */
  subtitleKey: string;
  runAgainBusy: boolean;
  runAgainPending: boolean;
}

function DiagnosticsBody({ onClose, onRunAgain, closeLabel, subtitleKey, runAgainBusy, runAgainPending }: DiagnosticsBodyProps) {
  const { t } = useTranslation();
  const run = useSim((s) => s.diagnostics);
  return (
    <View testID="device-diagnostics-sheet">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <BottomSheet.Title>{t('system.diagnostics.title')}</BottomSheet.Title>
          <BottomSheet.Description>{summaryOf(run, subtitleKey, t)}</BottomSheet.Description>
        </View>
        <BottomSheet.Close accessibilityLabel={closeLabel} testID="device-diagnostics-close" onPress={onClose} />
      </View>
      <View style={styles.list} accessibilityLabel={t(subtitleKey)}>
        {(run?.checks ?? []).map((check) => (
          <CheckRow key={check.id} check={check} />
        ))}
      </View>
      {run && run.completedAt !== null ? (
        <Button
          variant="outline"
          onPress={onRunAgain}
          testID="device-diagnostics-again"
          style={styles.again}
          accessibilityLabel={t('system.diagnostics.runAgain')}
          {...busyState(runAgainBusy)}
        >
          {runAgainPending ? <PendingSpinner color={palette.gold} testID="device-diagnostics-again-spinner" /> : null}
          <Button.Label>{t('system.diagnostics.runAgain')}</Button.Label>
        </Button>
      ) : null}
    </View>
  );
}

function summaryOf(run: DiagnosticsRun | null, subtitleKey: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (!run) return t(subtitleKey);
  const done = run.checks.filter((check) => check.status === 'PASS' || check.status === 'WARN' || check.status === 'FAIL').length;
  if (run.completedAt === null) return t('system.diagnostics.progress', { done, total: run.checks.length });
  const failed = run.checks.filter((check) => check.status === 'FAIL').length;
  const warned = run.checks.filter((check) => check.status === 'WARN').length;
  if (failed > 0) return t('system.diagnostics.failed', { count: failed });
  if (warned > 0) return t('system.diagnostics.warned', { count: warned });
  return t('system.diagnostics.passed');
}

function CheckRow({ check }: { check: DiagnosticCheck }) {
  const { t } = useTranslation();
  const label = t(`system.diagnostics.checks.${check.id}`);
  const tone = CHECK_TONE[check.status];
  return (
    <View style={styles.row} testID={`device-diagnostics-${check.id}`} accessible accessibilityLabel={`${label}, ${t(`common.diagnosticStatus.${check.status}`)}`}>
      <Text maxFontSizeMultiplier={1.2} style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {check.status === 'RUNNING' ? (
        <Spinner size="sm" color="warning" testID={`device-diagnostics-${check.id}-running`} />
      ) : tone ? (
        <StatusChip tone={tone} label={t(`common.diagnosticStatus.${check.status}`)} icon={null} size="sm" testID={`device-diagnostics-${check.id}-${check.status}`} />
      ) : (
        <Text maxFontSizeMultiplier={1.2} style={styles.pending}>
          {t(`common.diagnosticStatus.${check.status}`)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], marginBottom: spacing[2] },
  headerText: { flex: 1, gap: spacing[0] },
  list: { gap: spacing[1] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36, gap: spacing[2] },
  label: { flex: 1, fontFamily: fontFamily.native.normal, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  pending: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  again: { marginTop: spacing[3], marginBottom: spacing[2] },
});
