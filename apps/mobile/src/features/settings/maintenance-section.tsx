/**
 * Settings → System Maintenance (04_mobile_specs §4.15 `maintenance`):
 *
 * - Run diagnostics: starts (or rejoins) the simulator run and opens a sheet that follows the eight
 *   checks (SCR-02 `runDiagnostics`).
 * - Software update `SectionCard`: v2.4.1 → v2.5.0 (04 §9 #19), simulated; the C-4 Stepper follows
 *   the six `UpdateStep`s once it runs (`startSoftwareUpdate`).
 * - **Demo controls** `Accordion`, collapsed, hidden in presentation mode: one Button per fault
 *   (inject, or clear when active), a scenario choice with Load, Reset (`loadScenario('idle')`) and
 *   Recover while a session is in FAULT (01S §14.5.8; MA-30: "MIC 2 clip", "Storage full").
 *
 * Every simulator command runs through `useSimCommand`: user feedback (toast), a persistent
 * runtime-log record on failure, and nothing thrown into the render.
 */
import { Accordion, Button, Chip, Spinner, TagGroup, useToast } from 'heroui-native';
import { Activity, Download, FlaskConical, LifeBuoy, Play, RotateCcw } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import {
  FaultKind,
  formatWibTime,
  ScenarioName,
  SimTransitionError,
  selectActiveFaults,
  selectDiagnostics,
  selectUpdate,
  useSim,
  useSimActions,
  type DiagnosticStatus,
  type SimState,
} from '@dems/shared/sim';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { Stepper } from '@/components/composed/stepper';
import { SectionCard } from '@/components/kit';
import { useMotionPolicy } from '@/motion';
import { reportRuntimeIssue } from '@/runtime';
import {
  DEMO_FAULTS,
  DEMO_SCENARIOS,
  isDemoFaultActive,
  summarizeDiagnostics,
  targetSlotOf,
  updateStepStatuses,
  type DemoFaultSpec,
} from './settings-model';
import { useSettingsPrefs } from './settings-prefs';
import { SheetFrame } from './sheet-frame';
import { SectionStack, settingsStyles } from './settings-controls';

const selectSessionState = (s: SimState) => s.session?.state ?? null;
const selectScenario = (s: SimState) => s.meta.scenario;

interface CommandOptions {
  source: string;
  context?: Record<string, unknown>;
  /** Friendly text when the simulator refuses the transition (an active session, …). */
  refusedLabel?: string;
}

/** Runs one simulator command with the three error layers; returns false when it threw. */
function useSimCommand() {
  const { t } = useTranslation();
  const { toast } = useToast();
  return useCallback(
    (command: () => void, { source, context, refusedLabel }: CommandOptions): boolean => {
      try {
        command();
        return true;
      } catch (error) {
        if (error instanceof SimTransitionError) {
          toast.show({ variant: 'warning', label: refusedLabel ?? t('system.errors.generic') });
          reportRuntimeIssue('warn', source, error, { ...context, from: error.from, event: error.event });
        } else {
          toast.show({ variant: 'danger', label: t('system.errors.generic') });
          reportRuntimeIssue('error', source, error, context);
        }
        return false;
      }
    },
    [t, toast],
  );
}

export function MaintenanceSection() {
  const { t } = useTranslation();
  const prefs = useSettingsPrefs();
  return (
    <SectionStack testID="settings-maintenance">
      <DiagnosticsCard />
      <UpdateCard />
      {prefs.presentationMode ? (
        <Text maxFontSizeMultiplier={1.2} style={settingsStyles.muted} testID="settings-demo-hidden">
          {t('features.settings.maintenance.demoHiddenPresentation')}
        </Text>
      ) : (
        <DemoControls />
      )}
    </SectionStack>
  );
}

// ── Diagnostics ────────────────────────────────────────────────────────────────────────────

function DiagnosticsCard() {
  const { t } = useTranslation();
  const actions = useSimActions();
  const run = useSimCommand();
  const diagnostics = useSim(selectDiagnostics);
  const [open, setOpen] = useState(false);
  const summary = summarizeDiagnostics(diagnostics);

  const start = () => {
    const started = run(() => void actions.runDiagnostics(), { source: 'settings.maintenance.runDiagnostics', refusedLabel: t('system.diagnostics.failedToStart') });
    if (started) setOpen(true);
  };

  return (
    <SectionCard title={t('features.settings.maintenance.diagnosticsTitle')} description={t('system.diagnostics.subtitle')} testID="settings-diagnostics">
      {summary?.complete && diagnostics?.completedAt != null ? (
        <Text maxFontSizeMultiplier={1.2} style={settingsStyles.muted} testID="settings-diagnostics-last">
          {t('features.settings.maintenance.lastRun', {
            time: formatWibTime(diagnostics.completedAt),
            pass: summary.pass,
            warn: summary.warn,
            fail: summary.fail,
          })}
        </Text>
      ) : null}
      <Button testID="settings-run-diagnostics" variant="secondary" size="lg" onPress={start}>
        <Activity size={18} color={palette.gold} />
        <Button.Label>{t('features.settings.maintenance.runDiagnostics')}</Button.Label>
      </Button>
      <DiagnosticsSheet isOpen={open} onClose={() => setOpen(false)} />
    </SectionCard>
  );
}

const DIAGNOSTIC_TONE: Readonly<Record<DiagnosticStatus, 'default' | 'accent' | 'success' | 'warning' | 'danger'>> = {
  PENDING: 'default',
  RUNNING: 'accent',
  PASS: 'success',
  WARN: 'warning',
  FAIL: 'danger',
};

function DiagnosticsSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <SheetFrame isOpen={isOpen} onClose={onClose} title={t('features.settings.maintenance.diagnosticsSheetTitle')} description={t('system.diagnostics.subtitle')} testID="settings-diagnostics-sheet">
      <DiagnosticsBody />
    </SheetFrame>
  );
}

/** Portalled content: reads the simulator through the frame's re-provided context. */
function DiagnosticsBody() {
  const { t } = useTranslation();
  const diagnostics = useSim(selectDiagnostics);
  const summary = summarizeDiagnostics(diagnostics);
  if (!diagnostics || !summary) return null;
  const headline = !summary.complete
    ? t('system.diagnostics.progress', { done: summary.done, total: summary.total })
    : summary.fail > 0
      ? t('system.diagnostics.failed', { count: summary.fail })
      : summary.warn > 0
        ? t('system.diagnostics.warned', { count: summary.warn })
        : t('system.diagnostics.passed');
  return (
    <View style={styles.checks}>
      <Text maxFontSizeMultiplier={1.2} style={settingsStyles.strong} testID="settings-diagnostics-headline" accessibilityLiveRegion="polite">
        {headline}
      </Text>
      {diagnostics.checks.map((check) => (
        <View key={check.id} style={styles.checkRow} testID={`settings-diagnostics-check-${check.id}`}>
          <Text maxFontSizeMultiplier={1.2} style={[settingsStyles.body, styles.checkLabel]} numberOfLines={1}>
            {t(`system.diagnostics.checks.${check.id}`, { defaultValue: check.label })}
          </Text>
          {check.status === 'RUNNING' ? <Spinner size="sm" /> : null}
          <Chip size="sm" variant="soft" color={DIAGNOSTIC_TONE[check.status]}>
            <Chip.Label>{t(`common.diagnosticStatus.${check.status}`)}</Chip.Label>
          </Chip>
        </View>
      ))}
    </View>
  );
}

// ── Software update ────────────────────────────────────────────────────────────────────────

function UpdateCard() {
  const { t } = useTranslation();
  const actions = useSimActions();
  const run = useSimCommand();
  const { toast } = useToast();
  const motion = useMotionPolicy();
  const update = useSim(selectUpdate);
  const running = update.state === 'RUNNING';
  const showPipeline = update.state !== 'IDLE';
  const slot = targetSlotOf(update);

  const install = () => {
    const started = run(() => actions.startSoftwareUpdate(), {
      source: 'settings.maintenance.startSoftwareUpdate',
      refusedLabel: t('system.update.blockedBySession'),
    });
    if (started && update.availableVersion) toast.show({ variant: 'default', label: t('system.update.startedToast', { version: update.availableVersion }) });
  };

  const body =
    update.state === 'PASS'
      ? t('system.update.completedBody', { version: update.currentVersion, slot: update.activeSlot })
      : update.availableVersion
        ? t('features.settings.maintenance.updateAvailable', { version: update.availableVersion })
        : t('system.update.upToDateBody', { version: update.currentVersion, slot: update.activeSlot });

  return (
    <SectionCard
      title={t('common.quickActions.softwareUpdate.title')}
      description={t('features.settings.maintenance.updateCurrent', { version: update.currentVersion, slot: update.activeSlot })}
      action={
        <Chip size="sm" variant="soft" color="warning">
          <Chip.Label>{t('common.simulated.chip')}</Chip.Label>
        </Chip>
      }
      testID="settings-update"
    >
      <Text maxFontSizeMultiplier={1.2} style={settingsStyles.body} testID="settings-update-body">
        {body}
      </Text>
      {showPipeline ? (
        <Stepper
          testID="settings-update-steps"
          orientation="vertical"
          motion={motion}
          steps={update.steps.map((step) => ({ key: step.id, label: t(`common.enums.updateStep.${step.id}`) }))}
          statuses={updateStepStatuses(update)}
        />
      ) : null}
      {update.availableVersion && !running && update.state !== 'PASS' ? (
        <Button testID="settings-update-install" variant="primary" size="lg" onPress={install}>
          <Download size={18} color={palette.black} />
          <Button.Label>{t('system.update.install')}</Button.Label>
        </Button>
      ) : null}
      {running ? (
        <Text maxFontSizeMultiplier={1.2} style={settingsStyles.muted}>
          {t('system.update.installing')} {t('system.update.slot', { slot })}
        </Text>
      ) : null}
    </SectionCard>
  );
}

// ── Demo controls ──────────────────────────────────────────────────────────────────────────

function DemoControls() {
  const { t } = useTranslation();
  const actions = useSimActions();
  const run = useSimCommand();
  const { toast } = useToast();
  const active = useSim(selectActiveFaults);
  const sessionState = useSim(selectSessionState);
  const currentScenario = useSim(selectScenario);
  const [scenario, setScenario] = useState<ScenarioName>(currentScenario);

  const toggleFault = (spec: DemoFaultSpec) => {
    const on = !isDemoFaultActive(active, spec);
    const fault = t(`system.demo.faults.${spec.kind}`);
    const done = run(
      () => {
        if (on) {
          actions.inject(spec.kind, spec.target);
        } else {
          actions.clearFault(spec.kind, spec.target);
          // The CLIP latch stays until reset (faults.ts): clearing the demo fault also resets it.
          if (spec.kind === FaultKind.MIC_CLIP) actions.resetClip(spec.target?.channel ?? 'AUDIO-02');
        }
      },
      { source: on ? 'settings.demo.inject' : 'settings.demo.clearFault', context: { kind: spec.kind } },
    );
    if (!done) return;
    if (on) toast.show({ variant: spec.critical ? 'danger' : 'warning', label: t('system.demo.injected', { fault }) });
    else toast.show({ variant: 'success', label: t('system.demo.cleared', { fault }) });
  };

  const loadScenario = (name: ScenarioName, reset: boolean) => {
    const done = run(() => actions.loadScenario(name), { source: reset ? 'settings.demo.reset' : 'settings.demo.loadScenario', context: { scenario: name } });
    if (!done) return;
    setScenario(name);
    toast.show({
      variant: 'success',
      label: reset ? t('system.demo.resetDone') : t('system.demo.scenarioLoaded', { scenario: t(`system.demo.scenarios.${name}`) }),
    });
  };

  const recover = () => {
    if (run(() => actions.recover(), { source: 'settings.demo.recover' })) toast.show({ variant: 'default', label: t('system.demo.recovered') });
  };

  return (
    <Accordion variant="surface" selectionMode="single" isCollapsible testID="settings-demo" style={styles.demo}>
      <Accordion.Item value="demo">
        <Accordion.Trigger testID="settings-demo-trigger">
          <View style={styles.demoTrigger}>
            <FlaskConical size={20} color={palette.gold} />
            <Text maxFontSizeMultiplier={1.2} style={styles.demoTitle}>
              {t('system.demo.toggle')}
            </Text>
            <Chip size="sm" variant="soft" color="warning" testID="settings-demo-badge">
              <Chip.Label>{t('system.demo.badge')}</Chip.Label>
            </Chip>
          </View>
          <Accordion.Indicator />
        </Accordion.Trigger>
        <Accordion.Content>
          <View style={styles.demoBody} testID="settings-demo-body">
            <Text maxFontSizeMultiplier={1.2} style={settingsStyles.muted}>
              {t('system.demo.note')}
            </Text>

            <View style={styles.demoHead}>
              <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={settingsStyles.strong}>
                {t('system.demo.faultsTitle')}
              </Text>
              <Text maxFontSizeMultiplier={1.2} style={settingsStyles.muted} testID="settings-demo-active-count">
                {t('system.demo.activeCount', { count: active.length })}
              </Text>
            </View>
            <View style={settingsStyles.wrap}>
              {DEMO_FAULTS.map((spec) => {
                const on = isDemoFaultActive(active, spec);
                return (
                  <Button
                    key={spec.kind}
                    testID={`settings-demo-fault-${spec.kind}`}
                    size="sm"
                    variant={on ? 'danger-soft' : 'outline'}
                    accessibilityState={{ selected: on }}
                    accessibilityHint={t(on ? 'features.settings.maintenance.faultActiveHint' : 'features.settings.maintenance.faultIdleHint')}
                    onPress={() => toggleFault(spec)}
                  >
                    <Button.Label>{t(`system.demo.faults.${spec.kind}`)}</Button.Label>
                  </Button>
                );
              })}
            </View>

            <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={settingsStyles.strong}>
              {t('system.demo.scenarioTitle')}
            </Text>
            <TagGroup
              selectionMode="single"
              selectedKeys={[scenario]}
              onSelectionChange={(keys) => {
                const [first] = [...keys];
                if (typeof first === 'string' && (DEMO_SCENARIOS as readonly string[]).includes(first)) setScenario(first as ScenarioName);
              }}
              testID="settings-demo-scenario"
            >
              <TagGroup.List style={settingsStyles.wrap}>
                {DEMO_SCENARIOS.map((name) => (
                  <TagGroup.Item key={name} id={name} testID={`settings-demo-scenario-${name}`}>
                    <TagGroup.ItemLabel>{t(`system.demo.scenarios.${name}`)}</TagGroup.ItemLabel>
                  </TagGroup.Item>
                ))}
              </TagGroup.List>
            </TagGroup>
            <Text maxFontSizeMultiplier={1.2} style={settingsStyles.muted}>
              {t('system.demo.scenarioCurrent', { scenario: t(`system.demo.scenarios.${currentScenario}`) })}
            </Text>
            <View style={styles.demoActions}>
              <Button testID="settings-demo-load" size="md" variant="primary" onPress={() => loadScenario(scenario, false)}>
                <Play size={16} color={palette.black} />
                <Button.Label>{t('features.settings.maintenance.loadScenario')}</Button.Label>
              </Button>
              <Button testID="settings-demo-reset" size="md" variant="outline" onPress={() => loadScenario(ScenarioName.IDLE, true)}>
                <RotateCcw size={16} color={palette.gold} />
                <Button.Label>{t('system.demo.reset')}</Button.Label>
              </Button>
            </View>
            <Text maxFontSizeMultiplier={1.2} style={settingsStyles.muted}>
              {t('system.demo.resetHint')}
            </Text>

            {sessionState === 'FAULT' ? (
              <View style={styles.recover} testID="settings-demo-recover">
                <Text maxFontSizeMultiplier={1.2} style={settingsStyles.body}>
                  {t('system.demo.recoverHint')}
                </Text>
                <Button size="md" variant="danger-soft" onPress={recover} testID="settings-demo-recover-button">
                  <LifeBuoy size={16} color={palette.danger} />
                  <Button.Label>{t('system.demo.recover')}</Button.Label>
                </Button>
              </View>
            ) : null}
          </View>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}

const styles = StyleSheet.create({
  checks: { gap: spacing[2] },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 32 },
  checkLabel: { flex: 1 },
  demo: { borderRadius: 12 },
  demoTrigger: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  demoTitle: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h3.size,
    lineHeight: typography.h3.lineHeight,
    color: palette.foreground,
  },
  demoBody: { gap: spacing[2], paddingBottom: spacing[2] },
  demoHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing[2] },
  demoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  recover: { gap: spacing[2] },
});
