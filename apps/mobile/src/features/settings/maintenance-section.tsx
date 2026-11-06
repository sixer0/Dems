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
 * Every Core command runs through `useCoreCommand`: user feedback (toast), a persistent
 * runtime-log record on failure, and nothing thrown into the render.
 *
 * Both data modes (backend task W82; 04_client_integration_spec §8.6 S2-7, §8.1 LB-1 to LB-10;
 * AC-C-52). The actions come from `useCoreActions()` and every command goes through `settle` in the
 * callback form (the web wrapper's, B-10): what followed the former `true` runs in `ok`. The simulator
 * settles before `settle` returns, so SIMULATED and HEARTBEAT behave exactly as before; the Core
 * server settles once it answered and the store holds what the answer named (CL-16).
 *
 * | Use (S2-7) | Operation | Live behaviour |
 * |---|---|---|
 * | Run diagnostics | 65 `runDiagnostics` | The sheet opens in `ok`, once the Core accepted the run |
 * | Install update | 67 `startSoftwareUpdate` | The started toast in `ok`; a 409 (a session is open) is the warning of the simulator's refusal |
 * | Fault buttons | 73 `injectFault`, 74 `clearFault`, then 52 `resetMicClip` for MIC 2 clip | The toast in `ok`; the latch reset is the next command, sent in the clear's `ok` |
 * | Load, Reset | 72 `loadScenario` | The scenario chip and the toast in `ok`, once the snapshot of the new epoch is in (CL-18) |
 * | Recover | 33 `recoverSession` | The toast in `ok` |
 *
 * Each control is busy from its press until its command settled and shows the kit's spinner late
 * (`usePendingPress`, `busyState`, `PendingSpinner` of `@/runtime`). A Live rejection goes to the
 * refusal presenter first (a denial, an outage, a limit, `DEMO_DISABLED`); only what it leaves gets
 * this screen's own message. In LIVE mode the Demo controls show only with DEMO_CONTROL and the
 * Core's demo flag (`session.demoControls`, AC-C-52), otherwise one line says why; and the copy says
 * nothing about a simulation (`features.settings.live.*`; the diagnostics subtitle, the Install label and
 * the started toast are the web console's shared `system.live.*`: closing copy round, D177 DN-5).
 *
 * O-2 / ruling R2 (E-fix row FX-M2; decision D201, amending 04_client_integration_spec §6.3): Install
 * update needs `MAINTENANCE` (the Core's `startSoftwareUpdate`). Without it the button stays in place,
 * disabled, with "Requires the Technician role" (`useRoleGate`, the device-restart pattern), in both
 * modes; a role change pushed by the Core re-gates it in place.
 */
import { settle, useCoreActions, useCorePermission, useLiveSelector } from '@dems/shared/live';
import { Accordion, Button, Chip, Dialog, Spinner, TagGroup, useToast } from 'heroui-native';
import { Activity, Download, FlaskConical, LifeBuoy, Play, RotateCcw } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import {
  FaultKind,
  formatWibTime,
  Permission,
  ScenarioName,
  SimTransitionError,
  selectActiveFaults,
  selectDiagnostics,
  selectUpdate,
  useSim,
  type DiagnosticStatus,
  type SimState,
  isPlatformNotReported,
  isUpdaterNotAvailable,
} from '@dems/shared/sim';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { Stepper } from '@/components/composed/stepper';
import { SectionCard } from '@/components/kit';
import { useMotionPolicy } from '@/motion';
import { PendingSpinner, busyState, reportRuntimeIssue, useCoreErrorPresenter, useCoreLink, usePendingPress, type MobileLiveSim } from '@/runtime';
import { diagnosticNotReported, summaryOf } from '@/features/devices/diagnostics-sheet';
import { useRoleGate } from '@/features/rbac/use-role-gate';
import {
  DEMO_FAULTS,
  DEMO_SCENARIOS,
  demoControlsAccess,
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

interface CommandOptions<T> {
  source: string;
  context?: Record<string, unknown>;
  /** Friendly text when the simulator or the Core refuses the transition (an active session, …). */
  refusedLabel?: string;
  /** What followed the former `true`: the command was accepted (S2-7, the callback form). */
  ok?: (value: T) => void;
  /** Once after `ok` or the failure, in every path: the pending control's release. */
  done?: () => void;
}

/**
 * Runs one Core command with the three error layers (S2-7, the callback form of B-10). A Live
 * rejection goes to the refusal presenter first; a refused transition is a warning with the site's
 * text; anything else the generic danger toast. Every failure writes the persistent runtime log.
 */
function useCoreCommand() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const live = useCoreLink().source === 'LIVE';
  const presentCoreError = useCoreErrorPresenter();
  return useCallback(
    <T,>(command: () => T | PromiseLike<T>, { source, context, refusedLabel, ok, done }: CommandOptions<T>): void => {
      settle(command, {
        ...(ok ? { ok } : {}),
        fail: (error) => {
          // Live mode: a denial, an outage, a limit or DEMO_DISABLED is the presenter's (one wording on every screen).
          if (live && presentCoreError(error)) {
            reportRuntimeIssue('warn', source, error, context);
            return;
          }
          if (error instanceof SimTransitionError) {
            toast.show({ variant: 'warning', label: refusedLabel ?? t('system.errors.generic') });
            reportRuntimeIssue('warn', source, error, { ...context, from: error.from, event: error.event });
          } else {
            toast.show({ variant: 'danger', label: t('system.errors.generic') });
            reportRuntimeIssue('error', source, error, context);
          }
        },
        ...(done ? { done } : {}),
      });
    },
    [live, presentCoreError, t, toast],
  );
}

/** The demo flag of the Core server, as the signed-in session read it (DC-3); false outside LIVE. */
const selectDemoFlag = (handle: MobileLiveSim | null): boolean => handle?.session?.demoControls === true;

export function MaintenanceSection() {
  const { t } = useTranslation();
  const prefs = useSettingsPrefs();
  const live = useCoreLink().source === 'LIVE';
  const permitted = useCorePermission(Permission.DEMO_CONTROL);
  const demoFlag = useLiveSelector(selectDemoFlag);
  const access = demoControlsAccess({ presentationMode: prefs.presentationMode, live, permitted, demoFlag });
  return (
    <SectionStack testID="settings-maintenance">
      <DiagnosticsCard />
      <UpdateCard />
      {access === 'presentation' ? (
        <Text maxFontSizeMultiplier={1.2} style={settingsStyles.muted} testID="settings-demo-hidden">
          {t('features.settings.maintenance.demoHiddenPresentation')}
        </Text>
      ) : access === 'shown' ? (
        <DemoControls />
      ) : (
        // AC-C-52: LIVE mode without DEMO_CONTROL, or the Core server without its demo flag: no panel, one true line.
        <Text maxFontSizeMultiplier={1.2} style={settingsStyles.muted} testID={`settings-demo-${access}`}>
          {t(access === 'not-permitted' ? 'features.settings.live.demoNotPermitted' : 'features.settings.live.demoFlagOff')}
        </Text>
      )}
    </SectionStack>
  );
}

// ── Diagnostics ────────────────────────────────────────────────────────────────────────────

function DiagnosticsCard() {
  const { t } = useTranslation();
  const actions = useCoreActions();
  const run = useCoreCommand();
  const press = usePendingPress();
  const live = useCoreLink().source === 'LIVE';
  const diagnostics = useSim(selectDiagnostics);
  const [open, setOpen] = useState(false);
  const summary = summarizeDiagnostics(diagnostics);
  const platformNotReported = useSim((s) => isPlatformNotReported(s.security));
  const notReported = diagnostics ? diagnostics.checks.filter((check) => diagnosticNotReported(check, platformNotReported)).length : 0;
  const subtitle = t(live ? 'system.live.diagnosticsSubtitle' : 'system.diagnostics.subtitle');

  // S2-7: the sheet opens in `ok`, once the simulator or the Core accepted the run.
  const start = () => {
    press.run((release) =>
      run(() => actions.runDiagnostics(), {
        source: 'settings.maintenance.runDiagnostics',
        refusedLabel: t('system.diagnostics.failedToStart'),
        ok: () => setOpen(true),
        done: release,
      }),
    );
  };

  return (
    <SectionCard title={t('features.settings.maintenance.diagnosticsTitle')} description={subtitle} testID="settings-diagnostics">
      {summary?.complete && diagnostics?.completedAt != null ? (
        <Text maxFontSizeMultiplier={1.2} style={settingsStyles.muted} testID="settings-diagnostics-last">
          {notReported > 0
            ? // JT-03: rows the Core does not read are neither passed nor "attention" - the Devices sheet's headline.
              t('features.settings.maintenance.lastRunNotReported', { time: formatWibTime(diagnostics.completedAt), summary: summaryOf(diagnostics, 'system.diagnostics.subtitle', t, platformNotReported) })
            : t('features.settings.maintenance.lastRun', {
                time: formatWibTime(diagnostics.completedAt),
                pass: summary.pass,
                warn: summary.warn,
                fail: summary.fail,
              })}
        </Text>
      ) : null}
      <Button testID="settings-run-diagnostics" variant="secondary" size="lg" onPress={start} accessibilityLabel={t('features.settings.maintenance.runDiagnostics')} {...busyState(press.busy)}>
        {press.pending ? <PendingSpinner color={palette.gold} testID="settings-run-diagnostics-spinner" /> : <Activity size={18} color={palette.gold} />}
        <Button.Label>{t('features.settings.maintenance.runDiagnostics')}</Button.Label>
      </Button>
      <DiagnosticsSheet isOpen={open} onClose={() => setOpen(false)} description={subtitle} />
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

function DiagnosticsSheet({ isOpen, onClose, description }: { isOpen: boolean; onClose: () => void; description: string }) {
  const { t } = useTranslation();
  return (
    <SheetFrame isOpen={isOpen} onClose={onClose} title={t('features.settings.maintenance.diagnosticsSheetTitle')} description={description} testID="settings-diagnostics-sheet">
      <DiagnosticsBody />
    </SheetFrame>
  );
}

/** Portalled content: reads the simulator through the frame's re-provided context. */
function DiagnosticsBody() {
  const { t } = useTranslation();
  const diagnostics = useSim(selectDiagnostics);
  const summary = summarizeDiagnostics(diagnostics);
  // Fix wave J (JT-03, the Settings half J-P handed over): the SAME rule and the SAME headline as the Devices
  // sheet (`diagnosticNotReported`, `summaryOf`). A row over hardware the Core does not read is "Not reported",
  // never PASS, and such a run is never "all passed".
  const platformNotReported = useSim((s) => isPlatformNotReported(s.security));
  if (!diagnostics || !summary) return null;
  const anyNotReported = diagnostics.checks.some((check) => diagnosticNotReported(check, platformNotReported));
  const headline = summary.complete && anyNotReported
    ? summaryOf(diagnostics, 'system.diagnostics.subtitle', t, platformNotReported)
    : !summary.complete
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
          {diagnosticNotReported(check, platformNotReported) ? (
            <Chip size="sm" variant="soft" color="default" testID={`settings-diagnostics-check-${check.id}-not-reported`}>
              <Chip.Label>{t('common.platformNotReported.value')}</Chip.Label>
            </Chip>
          ) : (
            <Chip size="sm" variant="soft" color={DIAGNOSTIC_TONE[check.status]}>
              <Chip.Label>{t(`common.diagnosticStatus.${check.status}`)}</Chip.Label>
            </Chip>
          )}
        </View>
      ))}
    </View>
  );
}

// ── Software update ────────────────────────────────────────────────────────────────────────

function UpdateCard() {
  const { t } = useTranslation();
  const actions = useCoreActions();
  const run = useCoreCommand();
  const press = usePendingPress();
  const live = useCoreLink().source === 'LIVE';
  const { toast } = useToast();
  const motion = useMotionPolicy();
  const update = useSim(selectUpdate);
  const maintenance = useRoleGate(Permission.MAINTENANCE);
  const locked = !maintenance.allowed;
  const running = update.state === 'RUNNING';
  const showPipeline = update.state !== 'IDLE';
  const slot = targetSlotOf(update);

  // S2-7: the started toast in `ok`, once the simulator or the Core accepted the update.
  // Fix wave J (JT-06, truth rule 3e): "Install update" started at one press - a sequence that names an install
  // to the inactive system slot and a reboot. The press now asks first, saying what will happen.
  const [confirming, setConfirming] = useState(false);
  const install = () => {
    if (locked) return;
    setConfirming(false);
    press.run((release) =>
      run(() => actions.startSoftwareUpdate(), {
        source: 'settings.maintenance.startSoftwareUpdate',
        refusedLabel: t('system.update.blockedBySession'),
        ok: () => {
          if (update.availableVersion) {
            toast.show({ variant: 'default', label: t(live ? 'system.live.startedToast' : 'system.update.startedToast', { version: update.availableVersion }) });
          }
        },
        done: release,
      }),
    );
  };

  const body =
    update.state === 'PASS'
      ? t('system.update.completedBody', { version: update.currentVersion, slot: update.activeSlot })
      : update.availableVersion
        ? t('features.settings.maintenance.updateAvailable', { version: update.availableVersion })
        : t('system.update.upToDateBody', { version: update.currentVersion, slot: update.activeSlot });

  // JT-06 (contract_wave_j.md J-S 11): a Core in its own capture has no updater. Its versions and steps are no
  // readings: none is drawn, and no Install control is offered.
  if (isUpdaterNotAvailable(update)) {
    return (
      <SectionCard title={t('common.quickActions.softwareUpdate.title')} testID="settings-update">
        <Text maxFontSizeMultiplier={1.2} style={settingsStyles.body} testID="settings-update-not-available">
          {t('common.truth.updaterNotAvailable')}
        </Text>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={t('common.quickActions.softwareUpdate.title')}
      description={t('features.settings.maintenance.updateCurrent', { version: update.currentVersion, slot: update.activeSlot })}
      action={
        // LIVE: the Core runs a demonstration update (no software is installed), so the chip says DEMO, not "simulated".
        <Chip size="sm" variant="soft" color="warning" testID="settings-update-chip">
          <Chip.Label>{t(live ? 'system.demo.badge' : 'common.simulated.chip')}</Chip.Label>
        </Chip>
      }
      testID="settings-update"
    >
      <Text maxFontSizeMultiplier={1.2} style={settingsStyles.body} testID="settings-update-body">
        {body}
      </Text>
      {live ? (
        <Text maxFontSizeMultiplier={1.2} style={settingsStyles.muted} testID="settings-update-live-note">
          {t('features.settings.live.updateNote')}
        </Text>
      ) : null}
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
        <>
          <Button
            testID="settings-update-install"
            variant="primary"
            size="lg"
            isDisabled={locked}
            onPress={() => (locked ? undefined : setConfirming(true))}
            accessibilityLabel={t(live ? 'system.live.install' : 'system.update.install')}
            {...(locked && maintenance.hint ? { accessibilityHint: maintenance.hint } : {})}
            {...busyState(press.busy, locked)}
          >
            {press.pending ? <PendingSpinner color={palette.black} testID="settings-update-install-spinner" /> : <Download size={18} color={locked ? palette.gray : palette.black} />}
            <Button.Label>{t(live ? 'system.live.install' : 'system.update.install')}</Button.Label>
          </Button>
          {locked && maintenance.hint ? (
            <Text maxFontSizeMultiplier={1.2} style={settingsStyles.muted} testID="settings-update-install-locked">
              {maintenance.hint}
            </Text>
          ) : null}
        </>
      ) : null}
      <Dialog isOpen={confirming} onOpenChange={(open) => (open ? undefined : setConfirming(false))}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content testID="settings-update-confirm-dialog">
            <Dialog.Title>{t('features.settings.maintenance.installConfirmTitle', { version: update.availableVersion ?? '' })}</Dialog.Title>
            <Dialog.Description>{t('features.settings.maintenance.installConfirmBody', { slot })}</Dialog.Description>
            <Dialog.Description>{t(live ? 'features.settings.live.updateNote' : 'features.settings.maintenance.installConfirmSimulated')}</Dialog.Description>
            <View style={styles.confirmActions}>
              <Button testID="settings-update-confirm" variant="primary" onPress={install}>
                <Button.Label>{t('features.settings.maintenance.installConfirm')}</Button.Label>
              </Button>
              <Button testID="settings-update-cancel" variant="outline" onPress={() => setConfirming(false)}>
                <Button.Label>{t('features.settings.maintenance.installCancel')}</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
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
  const actions = useCoreActions();
  const run = useCoreCommand();
  const live = useCoreLink().source === 'LIVE';
  const loadPress = usePendingPress();
  const resetPress = usePendingPress();
  const recoverPress = usePendingPress();
  const { toast } = useToast();
  const active = useSim(selectActiveFaults);
  const sessionState = useSim(selectSessionState);
  const currentScenario = useSim(selectScenario);
  const [scenario, setScenario] = useState<ScenarioName>(currentScenario);

  // S2-7: the toast in `ok`; `release` frees the pressed fault button once the last command settled.
  const toggleFault = (spec: DemoFaultSpec, release: () => void) => {
    const on = !isDemoFaultActive(active, spec);
    const fault = t(`system.demo.faults.${spec.kind}`);
    const source = on ? 'settings.demo.inject' : 'settings.demo.clearFault';
    const context = { kind: spec.kind };
    if (on) {
      run(() => actions.inject(spec.kind, spec.target), {
        source,
        context,
        ok: () => toast.show({ variant: spec.critical ? 'danger' : 'warning', label: t('system.demo.injected', { fault }) }),
        done: release,
      });
      return;
    }
    const cleared = () => toast.show({ variant: 'success', label: t('system.demo.cleared', { fault }) });
    if (spec.kind !== FaultKind.MIC_CLIP) {
      run(() => actions.clearFault(spec.kind, spec.target), { source, context, ok: cleared, done: release });
      return;
    }
    // The CLIP latch stays until reset (faults.ts): clearing the demo fault also resets it, as the
    // next command (sequences nest, CL-25); the button is released when that one settled.
    const channel = spec.target?.channel ?? 'AUDIO-02';
    let chained = false;
    run(() => actions.clearFault(spec.kind, spec.target), {
      source,
      context,
      ok: () => {
        chained = true;
        run(() => actions.resetClip(channel), { source, context: { ...context, channel }, ok: cleared, done: release });
      },
      done: () => {
        if (!chained) release();
      },
    });
  };

  // S2-7: the scenario chip and the toast in `ok`.
  const loadScenario = (name: ScenarioName, reset: boolean, release: () => void) => {
    run(() => actions.loadScenario(name), {
      source: reset ? 'settings.demo.reset' : 'settings.demo.loadScenario',
      context: { scenario: name },
      ok: () => {
        setScenario(name);
        toast.show({
          variant: 'success',
          label: reset ? t('system.demo.resetDone') : t('system.demo.scenarioLoaded', { scenario: t(`system.demo.scenarios.${name}`) }),
        });
      },
      done: release,
    });
  };

  const recover = (release: () => void) => {
    run(() => actions.recover(), { source: 'settings.demo.recover', ok: () => toast.show({ variant: 'default', label: t('system.demo.recovered') }), done: release });
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
            <Text maxFontSizeMultiplier={1.2} style={settingsStyles.muted} testID="settings-demo-note">
              {t(live ? 'features.settings.live.demoNote' : 'system.demo.note')}
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
              {DEMO_FAULTS.map((spec) => (
                <DemoFaultButton key={spec.kind} spec={spec} on={isDemoFaultActive(active, spec)} onToggle={toggleFault} />
              ))}
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
              <Button
                testID="settings-demo-load"
                size="md"
                variant="primary"
                onPress={() => loadPress.run((release) => loadScenario(scenario, false, release))}
                accessibilityLabel={t('features.settings.maintenance.loadScenario')}
                {...busyState(loadPress.busy)}
              >
                {loadPress.pending ? <PendingSpinner color={palette.black} testID="settings-demo-load-spinner" /> : <Play size={16} color={palette.black} />}
                <Button.Label>{t('features.settings.maintenance.loadScenario')}</Button.Label>
              </Button>
              <Button
                testID="settings-demo-reset"
                size="md"
                variant="outline"
                onPress={() => resetPress.run((release) => loadScenario(ScenarioName.IDLE, true, release))}
                accessibilityLabel={t('system.demo.reset')}
                {...busyState(resetPress.busy)}
              >
                {resetPress.pending ? <PendingSpinner color={palette.gold} testID="settings-demo-reset-spinner" /> : <RotateCcw size={16} color={palette.gold} />}
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
                <Button
                  size="md"
                  variant="danger-soft"
                  onPress={() => recoverPress.run(recover)}
                  testID="settings-demo-recover-button"
                  accessibilityLabel={t('system.demo.recover')}
                  {...busyState(recoverPress.busy)}
                >
                  {recoverPress.pending ? <PendingSpinner color={palette.danger} testID="settings-demo-recover-spinner" /> : <LifeBuoy size={16} color={palette.danger} />}
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

/**
 * One fault button with its own pending state (LB-1: the control that sent the command ignores
 * further presses until it settled). The button keeps its `selected` state; while its command is out
 * the busy state joins it. It has no icon, so the kit's spinner shows before the label when late.
 */
function DemoFaultButton({ spec, on, onToggle }: { spec: DemoFaultSpec; on: boolean; onToggle: (spec: DemoFaultSpec, release: () => void) => void }) {
  const { t } = useTranslation();
  const press = usePendingPress();
  return (
    <Button
      testID={`settings-demo-fault-${spec.kind}`}
      size="sm"
      variant={on ? 'danger-soft' : 'outline'}
      accessibilityLabel={t(`system.demo.faults.${spec.kind}`)}
      accessibilityState={{ selected: on, ...busyState(press.busy).accessibilityState }}
      accessibilityHint={t(on ? 'features.settings.maintenance.faultActiveHint' : 'features.settings.maintenance.faultIdleHint')}
      onPress={() => press.run((release) => onToggle(spec, release))}
    >
      {press.pending ? <PendingSpinner color={on ? palette.danger : palette.gold} testID={`settings-demo-fault-${spec.kind}-spinner`} /> : null}
      <Button.Label>{t(`system.demo.faults.${spec.kind}`)}</Button.Label>
    </Button>
  );
}

const styles = StyleSheet.create({
  confirmActions: { gap: spacing[1], marginTop: spacing[3] },
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
