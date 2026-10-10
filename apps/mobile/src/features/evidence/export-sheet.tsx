/**
 * Export wizard (04_mobile_specs §4.11 D6 Export; book §19.2–§19.3; S20, S21, EVT-26): a kit
 * `BottomSheet` with the C-4 Stepper — Authorize, Verify source, Destination, Reason, Build and
 * hash, Done — driven by the simulator's `exportEvidence` (the Core decides; the UI never fakes an
 * outcome).
 *
 * - Authorize: an operator without EVIDENCE_EXPORT (INVESTIGATOR, TECHNICIAN) gets the Core's 403.
 *   The attempt is sent, so the Core writes EXPORT_DENIED (EVT-26), and an `Alert danger` "Your role
 *   cannot export" shows with the lock-shackle motion (rotate 20° → 0; reduced: static).
 * - Verify source: the package's precomputed result, "verified by the Core" (D51). A FAIL (evidence
 *   0005, AUDIO-02) blocks the export (§19.3 rule 3: the source is verified before the package is
 *   built).
 * - Destination: kit `RadioGroup` over the two simulated destinations (shared copy).
 * - Reason: kit `TextArea`, mandatory, at least 5 characters after trimming (S21, §19.2 item 8);
 *   the error shows inline under the field.
 * - Build and hash: a short Core round trip, then `exportEvidence(id, { reason, destination })`:
 *   202 → Done (status EXPORTED, ExportEvent + audit row written by the simulator); any refusal is
 *   shown with its mapped message and logged.
 *
 * **Live mode** (backend task W74; 04_client_integration_spec §8.5 S1-5, S1-6, §8.7 S5-1, §8.1
 * LB-2, LB-5, LB-6, LB-10, §14 point 7; F59). Every call is the `exportEvidence` or `verify` action
 * of `useCoreActions()` through `settle`, and the Core server is the judge:
 *
 * | Step | Live behaviour |
 * |------|----------------|
 * | Authorize (S5-1, S1-5) | The role check stays the display hint. A role without EVIDENCE_EXPORT still calls the Core (reason empty) so that the Core audits the denial (one `EXPORT_DENIED` row); only the outcome is logged. "Checking your role on the Core…" lasts until the answer and at least `EXPORT_AUTH_MS` (LB-2). A 403 is the existing denied Alert; with no answer (an outage, a limit) the presenter speaks and the Alert says the Core did not record the attempt |
 * | Verify source (§14 point 7) | Operation 41: the Core's verdict decides, as on the integrity tab; a FAIL blocks the export; without a verdict the step offers "Verify again" |
 * | Reason (F59) | The client keeps its bounds (5 to 500 after trimming); the Core's `422 INVALID_REASON` is the judge and returns to this step with the reason kept |
 * | Build and hash (S1-6) | The request starts with the step; the result shows at the later of the answer and `EXPORT_BUILD_MS` (LB-2). The union maps as today. With no answer the presenter speaks and the wizard returns to Reason with the reason kept (LB-6) |
 * | Done | The Core's export ID and the Core's manifest hash; the Core sends no file (MS-1) |
 *
 * Every wait of Live mode runs on the store's clock (rule 7), which follows the Core's clock. The
 * runtime's hooks do not reach portalled sheet content, so `ExportSheet` reads the Core link and
 * passes `live` down. In Simulated mode every `settle` runs before it returns, so the wizard
 * behaves exactly as before.
 */
import { Alert, Button, Description, FieldError, Label, RadioGroup, Spinner, TextArea, TextField, useToast } from 'heroui-native';
import { Lock } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { settle, useCoreActions } from '@dems/shared/live';
import { Permission, roleHas, useSimInstance, type EpochMs, type ExportResult } from '@dems/shared/sim';
import { fontFamily, palette, spacing, statusText, typography } from '@dems/shared/tokens';
import { Stepper, type StepDef, type StepStatus } from '@/components/composed/stepper';
import { KeyValueList } from '@/components/kit';
import { animateSpring, triggerHaptic, useMotionSettings } from '@/motion';
import { newCorrelationId, reportRuntimeIssue, useCoreErrorPresenter, useCoreLink } from '@/runtime';
import {
  EXPORT_DESTINATIONS,
  EXPORT_REASON_MAX,
  EXPORT_REASON_MIN,
  EXPORT_STEPS,
  checkExportReason,
  coreIntegrityView,
  failedCheckNames,
  integrityFor,
  packageFor,
  shortHash,
  type CoreVerdict,
  type ExportDestination,
} from './evidence-model';
import { EXPORT_IN_PROGRESS, answeredJobIdOf, type ExportJobKind } from './export-job-model';
import { ExportJobStatus } from './export-job-status';
import { VERIFY_ASK_MS } from './integrity-tab';
import { SheetFrame } from './sheet-frame';
import { useClockDue } from './use-clock-due';
import { useCoreVerify } from './use-core-verify';
import { useEvidenceItem, useSignedInOperator } from './use-evidence-data';

/** Simulated Core round trips (the role check and the package build). */
export const EXPORT_AUTH_MS = 400;
export const EXPORT_BUILD_MS = 900;

/** `probing`: Live mode, the denied role's call is out and the Core has not answered yet. */
type AuthState = 'checking' | 'probing' | 'authorized' | 'denied';
type FailureReason = Extract<ExportResult, { ok: false }>['reason'] | 'UNKNOWN' | typeof EXPORT_IN_PROGRESS;
/** Operation 42, schema v2 (integration pass D5): what a new export job builds. PACKAGE is the default and is not named in the request. */
const EXPORT_KINDS: readonly ExportJobKind[] = ['PACKAGE', 'COMPOSITE'];
/** Live: what the export request got, kept until the build step's minimum time has run (LB-2). */
type BuildAnswer = { readonly kind: 'result'; readonly result: ExportResult } | { readonly kind: 'error'; readonly error: unknown };
/** Live: the Core's verdict of the source (step 1); `asking` while operation 41 is out, `none` without a verdict. */
type SourceCheck = { readonly kind: 'asking' } | { readonly kind: 'verdict'; readonly verdict: CoreVerdict } | { readonly kind: 'none' };

export interface ExportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  evidenceId: string;
}

export function ExportSheet({ isOpen, onClose, evidenceId }: ExportSheetProps) {
  const { t } = useTranslation();
  const live = useCoreLink().source === 'LIVE';
  return (
    <SheetFrame
      isOpen={isOpen}
      onClose={onClose}
      title={t('features.evidence.export.title', { id: evidenceId })}
      closeLabel={t('features.evidence.export.close')}
      testID="evidence-export-sheet"
    >
      <ExportWizard evidenceId={evidenceId} onClose={onClose} live={live} />
    </SheetFrame>
  );
}

function ExportWizard({ evidenceId, onClose, live }: { evidenceId: string; onClose: () => void; live: boolean }) {
  const { t } = useTranslation();
  const m = useMotionSettings();
  const sim = useSimInstance();
  const actions = useCoreActions();
  const presentCoreError = useCoreErrorPresenter();
  const { toast } = useToast();
  const item = useEvidenceItem(evidenceId);
  const operator = useSignedInOperator();
  const [step, setStep] = useState(0);
  const [auth, setAuth] = useState<AuthState>('checking');
  const [destination, setDestination] = useState<ExportDestination>('usb');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [building, setBuilding] = useState(false);
  const [failure, setFailure] = useState<FailureReason | null>(null);
  const [exportId, setExportId] = useState<string | null>(null);
  /** The job the 202 answer named (Live), or null: the job is then derived from the export ID. */
  const [answeredJobId, setAnsweredJobId] = useState<string | null>(null);
  const [kind, setKind] = useState<ExportJobKind>('PACKAGE');
  const [correlationId] = useState(() => newCorrelationId('export'));
  // Live mode only (all neutral in Simulated mode).
  /** The store's clock when the wizard opened: the Authorize step's minimum time counts from it. */
  const [openedAt] = useState<EpochMs | null>(() => (live ? sim.store.getState().clock.now : null));
  /** False when the denied role's call got no answer of the Core, so nothing was audited. */
  const [denialRecorded, setDenialRecorded] = useState(true);
  /** The store's clock when the build request left, while its result is not shown yet. */
  const [buildFrom, setBuildFrom] = useState<EpochMs | null>(null);
  const [buildAnswer, setBuildAnswer] = useState<BuildAnswer | null>(null);
  const [source, setSource] = useState<SourceCheck>({ kind: 'none' });
  const reduced = m.policy === 'reduced';
  // Edge-to-edge windows do not resize for the keyboard (04 §2.6, H-MB-06) and the gorhom sheet does
  // not track a kit TextArea, so the wizard grows by the keyboard height: the dynamically sized sheet
  // rises and the reason field stays above the keyboard (device finding, step 83).
  const keyboardHeight = useKeyboardState((state) => (state.isVisible ? state.height : 0));

  // Simulated: the package's precomputed result (D51). Live: nothing is computed here; the Core's verdict decides.
  const integrity = useMemo(() => (item && !live ? integrityFor(item, sim.clock.now()) : null), [item, live, sim]);
  const pkg = useMemo(() => (live ? null : packageFor(evidenceId)), [live, evidenceId]);
  const coreSource = useMemo(() => (item && source.kind === 'verdict' ? coreIntegrityView(item, source.verdict) : null), [item, source]);
  const sourceOk = live ? coreSource?.verdict === 'PASS' : integrity?.verdict === 'PASS';
  const check = checkExportReason(reason);
  const destinationText = t(destination === 'usb' ? 'evidence.exportWizard.destinationUsb' : 'evidence.exportWizard.destinationNetwork');

  // Authorize: ask the Core. Without EVIDENCE_EXPORT the attempt is sent so the Core audits it.
  // Simulated: the simulator answers inside `settle`, as the direct call did before.
  useEffect(() => {
    if (live || auth !== 'checking') return undefined;
    const timer = setTimeout(() => {
      if (roleHas(operator.role, Permission.EVIDENCE_EXPORT)) {
        setAuth('authorized');
        return;
      }
      settle(() => actions.exportEvidence(evidenceId, { reason: '', destination: '' }), {
        ok: (result) => logDenied(evidenceId, operator.role, result, correlationId),
        fail: (error) => reportRuntimeIssue('error', 'evidence.export.authorize', error, { evidenceId }, correlationId),
      });
      triggerHaptic('signInFailure');
      setAuth('denied');
    }, m.policy === 'reduced' ? 0 : EXPORT_AUTH_MS);
    return () => clearTimeout(timer);
  }, [live, auth, operator.role, actions, evidenceId, correlationId, m.policy]);

  // Live (S5-1, S1-5): after EXPORT_AUTH_MS on the store's clock the hint decides; a denied role's
  // call then spans its request (LB-2) and the denied Alert follows the Core's answer.
  const authorizeLive = useCallback(() => {
    if (roleHas(operator.role, Permission.EVIDENCE_EXPORT)) {
      setAuth('authorized');
      return;
    }
    setAuth('probing');
    // The reason stays empty on purpose (F59): a role the hint has not caught up with gets the Core's
    // 422, never an export. The Core reads the role before the body and audits a denied role whatever
    // the body (implementation/35 §6.2); the request schema of operation 42 cannot say "after the
    // guard", so a contract-checked client or fake would refuse this body (RESIDUAL-W74-1, W83 ledger #49).
    settle(() => actions.exportEvidence(evidenceId, { reason: '', destination: '' }), {
      ok: (result) => {
        logDenied(evidenceId, operator.role, result, correlationId);
        // The Core audits a denial with its 403; any other answer audited nothing of the kind.
        setDenialRecorded(!result.ok && result.status === 403);
      },
      fail: (error) => {
        const presented = presentCoreError(error);
        reportRuntimeIssue(presented ? 'warn' : 'error', 'evidence.export.authorize', error, { evidenceId, presented }, correlationId);
        setDenialRecorded(false);
      },
      done: () => {
        triggerHaptic('signInFailure');
        setAuth('denied');
      },
    });
  }, [operator.role, actions, evidenceId, correlationId, presentCoreError]);
  useClockDue(live && auth === 'checking' ? openedAt : null, reduced ? 0 : EXPORT_AUTH_MS, authorizeLive);

  // Live, step 1 (§14 point 7): the Core's verdict of the source.
  const onSourceVerdict = useCallback((verdict: CoreVerdict) => {
    setSource({ kind: 'verdict', verdict });
    triggerHaptic(verdict.ok ? 'verifyPass' : 'verifyFail');
  }, []);
  const onNoSourceVerdict = useCallback(() => setSource({ kind: 'none' }), []);
  const sourceCheck = useCoreVerify(evidenceId, reduced ? 0 : VERIFY_ASK_MS, { onVerdict: onSourceVerdict, onNoVerdict: onNoSourceVerdict });
  const askSource = () => {
    if (sourceCheck.run()) setSource({ kind: 'asking' });
  };

  const submit = useCallback(() => {
    setTouched(true);
    if (!check.valid || building) return;
    setStep(4);
    setBuilding(true);
    setFailure(null);
    if (!live) return;
    // Live (S1-6): the request starts with the build step.
    setBuildAnswer(null);
    setBuildFrom(sim.store.getState().clock.now);
    // The Core cannot say beforehand whether this build has a composite encoder: a COMPOSITE is asked for and its job answers.
    settle(() => actions.exportEvidence(evidenceId, { reason: check.value, destination: destinationText, ...(kind === 'COMPOSITE' ? { kind } : {}) }), {
      ok: (result) => setBuildAnswer({ kind: 'result', result }),
      fail: (error) => setBuildAnswer({ kind: 'error', error }),
    });
  }, [check.valid, check.value, building, live, sim, actions, evidenceId, destinationText, kind]);

  /** The answer of the export, shown: Done, or the refusal's message (the union maps as today). */
  const finishBuild = useCallback(
    (result: ExportResult | null) => {
      setBuilding(false);
      if (result?.ok) {
        setExportId(result.exportId);
        setAnsweredJobId(answeredJobIdOf(result));
        setStep(5);
        triggerHaptic('sealedStamp');
        // The shared success sentence says "(simulated)": Live mode has its shared twin (rule 8; closing copy round, D162 DN-5).
        toast.show({ variant: 'success', label: t(live ? 'evidence.live.export.success' : 'evidence.exportWizard.success', { id: evidenceId }) });
        return;
      }
      const reasonCode: FailureReason = result && !result.ok ? result.reason : 'UNKNOWN';
      reportRuntimeIssue('warn', 'evidence.export.refused', `Export refused: ${reasonCode}`, {
        evidenceId,
        status: result && !result.ok ? result.status : null,
        reasonLength: check.length,
      }, correlationId);
      setFailure(reasonCode);
      if (reasonCode === 'INVALID_REASON') setStep(3);
    },
    [live, evidenceId, check.length, correlationId, t, toast],
  );

  // Build and hash, Simulated: a Core round trip, then the real export call (answered inside `settle`).
  useEffect(() => {
    if (live || !building) return undefined;
    const timer = setTimeout(() => {
      settle(() => actions.exportEvidence(evidenceId, { reason: check.value, destination: destinationText }), {
        ok: (result) => finishBuild(result),
        fail: (error) => {
          reportRuntimeIssue('error', 'evidence.export.submit', error, { evidenceId }, correlationId);
          finishBuild(null);
        },
      });
    }, m.policy === 'reduced' ? 0 : EXPORT_BUILD_MS);
    return () => clearTimeout(timer);
  }, [live, building, actions, evidenceId, check.value, destinationText, correlationId, m.policy, finishBuild]);

  // Build and hash, Live: the answer shows at the later of its arrival and EXPORT_BUILD_MS (LB-2).
  const showBuildAnswer = useCallback(() => {
    if (buildAnswer === null) return;
    setBuildFrom(null);
    setBuildAnswer(null);
    if (buildAnswer.kind === 'result') {
      finishBuild(buildAnswer.result);
      return;
    }
    const presented = presentCoreError(buildAnswer.error);
    reportRuntimeIssue(presented ? 'warn' : 'error', 'evidence.export.submit', buildAnswer.error, { evidenceId, presented }, correlationId);
    if (!presented) {
      finishBuild(null);
      return;
    }
    // LB-6: no answer; the presenter said so. Back to Reason, with what was typed.
    setBuilding(false);
    setStep(3);
  }, [buildAnswer, finishBuild, presentCoreError, evidenceId, correlationId]);
  useClockDue(live && buildAnswer !== null ? buildFrom : null, reduced ? 0 : EXPORT_BUILD_MS, showBuildAnswer);

  const steps: StepDef[] = useMemo(() => EXPORT_STEPS.map((key) => ({ key, label: t(`features.evidence.export.steps.${key}`) })), [t]);
  const statuses: StepStatus[] = useMemo(
    () =>
      EXPORT_STEPS.map((_, i) => {
        if (step === 5) return 'done';
        if (i === 0 && auth === 'denied') return 'error';
        if (i === 1 && step === 1 && !sourceOk && !(live && source.kind === 'asking')) return 'error';
        if (i === 4 && building) return 'running';
        if (i === step && failure) return 'error';
        if (i < step) return 'done';
        if (i === step) return 'active';
        return 'pending';
      }),
    [step, auth, sourceOk, live, source.kind, building, failure],
  );

  if (!item || (!live && !integrity)) {
    return (
      <Text maxFontSizeMultiplier={1.2} style={styles.body}>
        {t('features.evidence.export.failed.NOT_FOUND')}
      </Text>
    );
  }

  const next = () => {
    triggerHaptic('primaryPress');
    setFailure(null);
    if (live && step === 0) askSource();
    setStep((s) => Math.min(s + 1, 3));
  };
  const back = () => {
    setFailure(null);
    setStep((s) => Math.max(s - 1, 1));
  };
  const showReasonError = touched && !check.valid;

  return (
    <View style={[styles.root, keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : null]} testID="evidence-export-wizard">
      <Stepper steps={steps} statuses={statuses} orientation="horizontal" motion={m.policy} testID="evidence-export-stepper" />

      {step === 0 ? (
        auth === 'checking' || auth === 'probing' ? (
          <View style={styles.inline} testID="evidence-export-authorizing">
            <Spinner size="sm" />
            <Text maxFontSizeMultiplier={1.2} style={styles.body}>
              {t('features.evidence.export.authorizing')}
            </Text>
          </View>
        ) : auth === 'denied' ? (
          <DeniedAlert recorded={!live || denialRecorded} />
        ) : (
          <Alert status="success" testID="evidence-export-authorized">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>
                {t('features.evidence.export.authorizedAs', {
                  name: operator.displayName ?? '—',
                  role: operator.role ? t(`common.roles.${operator.role}`) : '—',
                })}
              </Alert.Title>
            </Alert.Content>
          </Alert>
        )
      ) : null}

      {step === 1 && live ? (
        <LiveSourceStep source={source} failed={coreSource?.failed ?? []} />
      ) : null}

      {step === 1 && !live && integrity ? (
        <Alert status={sourceOk ? 'success' : 'danger'} testID={`evidence-export-source-${sourceOk ? 'pass' : 'fail'}`}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              {sourceOk
                ? t('features.evidence.export.sourcePass')
                : t('features.evidence.export.sourceFail', { checks: failedCheckNames(integrity.failed).join(', ') })}
            </Alert.Title>
            <Alert.Description>
              {integrity.source === 'package' ? `${t('features.evidence.integrity.verifiedByCore')} · ${integrity.label}` : t('features.evidence.export.sourceSimulated')}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {step === 2 ? (
        <View style={styles.field}>
          <Label>{t('features.evidence.export.destinationLabel')}</Label>
          <RadioGroup value={destination} onValueChange={(value) => setDestination(value as ExportDestination)} testID="evidence-export-destination">
            {EXPORT_DESTINATIONS.map((key) => (
              <RadioGroup.Item key={key} value={key} testID={`evidence-export-destination-${key}`}>
                {t(key === 'usb' ? 'evidence.exportWizard.destinationUsb' : 'evidence.exportWizard.destinationNetwork')}
              </RadioGroup.Item>
            ))}
          </RadioGroup>
          {live ? (
            <>
              <Label>{t('evidence.exportJob.kindLabel')}</Label>
              <RadioGroup value={kind} onValueChange={(value) => setKind(value === 'COMPOSITE' ? 'COMPOSITE' : 'PACKAGE')} testID="evidence-export-kind">
                {EXPORT_KINDS.map((key) => (
                  <RadioGroup.Item key={key} value={key} testID={`evidence-export-kind-${key}`}>
                    {t(`evidence.exportJob.kind.${key}`)}
                  </RadioGroup.Item>
                ))}
              </RadioGroup>
            </>
          ) : null}
        </View>
      ) : null}

      {step === 3 ? (
        <View style={styles.field}>
          <TextField isRequired isInvalid={showReasonError || failure === 'INVALID_REASON'}>
            <Label>{t('features.evidence.export.reasonLabel')}</Label>
            <TextArea
              testID="evidence-export-reason"
              value={reason}
              onChangeText={setReason}
              onBlur={() => setTouched(true)}
              placeholder={t('features.evidence.export.reasonPlaceholder')}
              maxLength={EXPORT_REASON_MAX}
              numberOfLines={3}
              style={styles.textArea}
            />
            {showReasonError || failure === 'INVALID_REASON' ? (
              <FieldError testID="evidence-export-reason-error">
                {t('features.evidence.export.reasonTooShort', { min: EXPORT_REASON_MIN })}
              </FieldError>
            ) : (
              <Description testID="evidence-export-reason-count">
                {t('features.evidence.export.reasonCount', { count: check.length, max: EXPORT_REASON_MAX })}
              </Description>
            )}
          </TextField>
        </View>
      ) : null}

      {step === 4 ? (
        building ? (
          <View style={styles.inline} testID="evidence-export-building">
            <Spinner size="sm" />
            <Text maxFontSizeMultiplier={1.2} style={styles.body}>
              {t('features.evidence.export.building')}
            </Text>
          </View>
        ) : failure ? (
          <Alert status="danger" testID={`evidence-export-failed-${failure}`}>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{failure === EXPORT_IN_PROGRESS ? t('evidence.exportJob.inProgress') : t(`features.evidence.export.failed.${failure}`)}</Alert.Title>
            </Alert.Content>
          </Alert>
        ) : null
      ) : null}

      {step === 5 && exportId ? (
        <View style={styles.field} testID="evidence-export-done">
          <Alert status="success">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t('features.evidence.export.doneTitle')}</Alert.Title>
              <Alert.Description>{t('features.evidence.export.doneBody', { id: evidenceId })}</Alert.Description>
            </Alert.Content>
          </Alert>
          <KeyValueList
            items={[
              { id: 'exportId', label: t('features.evidence.export.exportId'), value: exportId, mono: true, testID: 'evidence-export-id' },
              { id: 'destination', label: t('features.evidence.export.destinationValue'), value: destinationText },
              { id: 'reason', label: t('features.evidence.export.reasonValue'), value: check.value },
              ...(live
                ? [{ id: 'manifest', label: t('features.evidence.export.manifestSha'), value: shortHash(item.manifestHash), mono: true }]
                : pkg
                  ? [{ id: 'manifest', label: t('features.evidence.export.manifestSha'), value: shortHash(pkg.signature.signedDigest), mono: true }]
                  : []),
            ]}
          />
          {/* Row 92: operation 42 only queued the export; operation 87 says when it is done, or that it FAILED. */}
          {live ? <ExportJobStatus exportId={exportId} jobId={answeredJobId} /> : null}
          <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
            {t(live ? 'features.evidence.export.zipNoteLive' : 'features.evidence.export.zipNote')}
          </Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        {step === 2 || step === 3 ? (
          <Button variant="outline" onPress={back} testID="evidence-export-back">
            <Button.Label>{t('features.evidence.export.back')}</Button.Label>
          </Button>
        ) : null}
        {step === 0 && auth === 'authorized' ? (
          <Button variant="primary" onPress={next} testID="evidence-export-next">
            <Button.Label>{t('features.evidence.export.next')}</Button.Label>
          </Button>
        ) : null}
        {step === 1 && live && source.kind === 'none' ? (
          <Button variant="outline" onPress={askSource} testID="evidence-export-verify-again">
            <Button.Label>{t('features.evidence.integrity.verifyAgain')}</Button.Label>
          </Button>
        ) : null}
        {step === 1 || step === 2 ? (
          <Button variant="primary" isDisabled={step === 1 && !sourceOk} onPress={next} testID="evidence-export-next">
            <Button.Label>{t('features.evidence.export.next')}</Button.Label>
          </Button>
        ) : null}
        {step === 3 ? (
          <Button variant="primary" isDisabled={!check.valid} onPress={submit} testID="evidence-export-submit">
            <Button.Label>{t('features.evidence.export.submit')}</Button.Label>
          </Button>
        ) : null}
        {step === 5 || auth === 'denied' || (step === 1 && !sourceOk && !(live && source.kind === 'asking')) || (step === 4 && failure && failure !== 'INVALID_REASON') ? (
          <Button variant={step === 5 ? 'primary' : 'outline'} onPress={onClose} testID="evidence-export-finish">
            <Button.Label>{step === 5 ? t('features.evidence.export.finish') : t('features.evidence.export.close')}</Button.Label>
          </Button>
        ) : null}
      </View>
    </View>
  );
}

/** The Core's audit log entry of a denied export, as logged: the outcome only (S1-5). */
function logDenied(evidenceId: string, role: string | null, result: ExportResult, correlationId: string): void {
  reportRuntimeIssue('warn', 'evidence.export.denied', 'Export denied by RBAC', {
    evidenceId,
    role,
    status: result.ok ? 202 : result.status,
  }, correlationId);
}

/** Live, step 1: asking the Core, then its verdict of the source (§14 point 7), or no verdict. */
function LiveSourceStep({ source, failed }: { source: SourceCheck; failed: readonly string[] }) {
  const { t } = useTranslation();
  if (source.kind === 'asking') {
    return (
      <View style={styles.inline} testID="evidence-export-source-asking">
        <Spinner size="sm" />
        <Text maxFontSizeMultiplier={1.2} style={styles.body}>
          {t('features.evidence.integrity.verifying')}
        </Text>
      </View>
    );
  }
  if (source.kind === 'none') {
    return (
      <Alert status="warning" testID="evidence-export-source-none">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t('features.evidence.integrity.verifyError')}</Alert.Title>
        </Alert.Content>
      </Alert>
    );
  }
  const pass = source.verdict.ok;
  return (
    <Alert status={pass ? 'success' : 'danger'} testID={`evidence-export-source-${pass ? 'pass' : 'fail'}`}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>
          {pass ? t('features.evidence.export.sourcePass') : t('features.evidence.export.sourceFail', { checks: failedCheckNames(failed).join(', ') })}
        </Alert.Title>
        {/* W93-5 (FXR-M; O-CF-M2-1): the source line follows the verdict, never "Verified" under a Core FAIL. */}
        <Alert.Description testID="evidence-export-source-line">
          {`${t(pass ? 'features.evidence.integrity.verifiedByCore' : 'features.evidence.integrity.failedOnCore')} · ${t('features.evidence.integrity.coreLabel')}`}
        </Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

/** "Your role cannot export" with the lock-shackle motion (M-C-22 lockout form; reduced: static). */
function DeniedAlert({ recorded }: { recorded: boolean }) {
  const { t } = useTranslation();
  const m = useMotionSettings();
  const angle = useSharedValue(m.policy === 'reduced' ? 0 : 20);
  useEffect(() => {
    angle.set(animateSpring(0, 'snappy', m));
  }, [angle, m]);
  const shackle = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.get()}deg` }] }));
  return (
    <Alert status="danger" testID="evidence-export-denied">
      <Alert.Indicator>
        <Animated.View style={shackle}>
          <Lock size={18} color={statusText.danger} />
        </Animated.View>
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title>{t('features.evidence.export.deniedTitle')}</Alert.Title>
        <Alert.Description>{t(recorded ? 'features.evidence.export.deniedBody' : 'features.evidence.export.deniedBodyUnrecorded')}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[3] },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  field: { gap: spacing[1] },
  body: { fontFamily: fontFamily.native.normal, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  caption: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  textArea: { minHeight: 88 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[1] },
});
