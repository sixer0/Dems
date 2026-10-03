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
 */
import { Alert, Button, Description, FieldError, Label, RadioGroup, Spinner, TextArea, TextField, useToast } from 'heroui-native';
import { Lock } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Permission, roleHas, useSimActions, useSimInstance, type ExportResult } from '@dems/shared/sim';
import { fontFamily, palette, spacing, statusText, typography } from '@dems/shared/tokens';
import { Stepper, type StepDef, type StepStatus } from '@/components/composed/stepper';
import { KeyValueList } from '@/components/kit';
import { animateSpring, triggerHaptic, useMotionSettings } from '@/motion';
import { newCorrelationId, reportRuntimeIssue } from '@/runtime';
import {
  EXPORT_DESTINATIONS,
  EXPORT_REASON_MAX,
  EXPORT_REASON_MIN,
  EXPORT_STEPS,
  checkExportReason,
  failedCheckNames,
  integrityFor,
  packageFor,
  shortHash,
  type ExportDestination,
} from './evidence-model';
import { SheetFrame } from './sheet-frame';
import { useEvidenceItem, useSignedInOperator } from './use-evidence-data';

/** Simulated Core round trips (the role check and the package build). */
export const EXPORT_AUTH_MS = 400;
export const EXPORT_BUILD_MS = 900;

type AuthState = 'checking' | 'authorized' | 'denied';
type FailureReason = Extract<ExportResult, { ok: false }>['reason'] | 'UNKNOWN';

export interface ExportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  evidenceId: string;
}

export function ExportSheet({ isOpen, onClose, evidenceId }: ExportSheetProps) {
  const { t } = useTranslation();
  return (
    <SheetFrame
      isOpen={isOpen}
      onClose={onClose}
      title={t('features.evidence.export.title', { id: evidenceId })}
      closeLabel={t('features.evidence.export.close')}
      testID="evidence-export-sheet"
    >
      <ExportWizard evidenceId={evidenceId} onClose={onClose} />
    </SheetFrame>
  );
}

function ExportWizard({ evidenceId, onClose }: { evidenceId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const m = useMotionSettings();
  const sim = useSimInstance();
  const actions = useSimActions();
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
  const [correlationId] = useState(() => newCorrelationId('export'));
  // Edge-to-edge windows do not resize for the keyboard (04 §2.6, H-MB-06) and the gorhom sheet does
  // not track a kit TextArea, so the wizard grows by the keyboard height: the dynamically sized sheet
  // rises and the reason field stays above the keyboard (device finding, step 83).
  const keyboardHeight = useKeyboardState((state) => (state.isVisible ? state.height : 0));

  const integrity = useMemo(() => (item ? integrityFor(item, sim.clock.now()) : null), [item, sim]);
  const pkg = useMemo(() => packageFor(evidenceId), [evidenceId]);
  const sourceOk = integrity?.verdict === 'PASS';
  const check = checkExportReason(reason);
  const destinationText = t(destination === 'usb' ? 'evidence.exportWizard.destinationUsb' : 'evidence.exportWizard.destinationNetwork');

  // Authorize: ask the Core. Without EVIDENCE_EXPORT the attempt is sent so the Core audits it.
  useEffect(() => {
    if (auth !== 'checking') return undefined;
    const timer = setTimeout(() => {
      if (roleHas(operator.role, Permission.EVIDENCE_EXPORT)) {
        setAuth('authorized');
        return;
      }
      try {
        const result = actions.exportEvidence(evidenceId, { reason: '', destination: '' });
        reportRuntimeIssue('warn', 'evidence.export.denied', 'Export denied by RBAC', {
          evidenceId,
          role: operator.role,
          status: result.ok ? 202 : result.status,
        }, correlationId);
      } catch (error) {
        reportRuntimeIssue('error', 'evidence.export.authorize', error, { evidenceId }, correlationId);
      }
      triggerHaptic('signInFailure');
      setAuth('denied');
    }, m.policy === 'reduced' ? 0 : EXPORT_AUTH_MS);
    return () => clearTimeout(timer);
  }, [auth, operator.role, actions, evidenceId, correlationId, m.policy]);

  const submit = useCallback(() => {
    setTouched(true);
    if (!check.valid || building) return;
    setStep(4);
    setBuilding(true);
    setFailure(null);
  }, [check.valid, building]);

  // Build and hash: a Core round trip, then the real export call.
  useEffect(() => {
    if (!building) return undefined;
    const timer = setTimeout(() => {
      let result: ExportResult | null = null;
      try {
        result = actions.exportEvidence(evidenceId, { reason: check.value, destination: destinationText });
      } catch (error) {
        reportRuntimeIssue('error', 'evidence.export.submit', error, { evidenceId }, correlationId);
      }
      setBuilding(false);
      if (result?.ok) {
        setExportId(result.exportId);
        setStep(5);
        triggerHaptic('sealedStamp');
        toast.show({ variant: 'success', label: t('evidence.exportWizard.success', { id: evidenceId }) });
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
    }, m.policy === 'reduced' ? 0 : EXPORT_BUILD_MS);
    return () => clearTimeout(timer);
  }, [building, actions, evidenceId, check.value, check.length, destinationText, correlationId, m.policy, t, toast]);

  const steps: StepDef[] = useMemo(() => EXPORT_STEPS.map((key) => ({ key, label: t(`features.evidence.export.steps.${key}`) })), [t]);
  const statuses: StepStatus[] = useMemo(
    () =>
      EXPORT_STEPS.map((_, i) => {
        if (step === 5) return 'done';
        if (i === 0 && auth === 'denied') return 'error';
        if (i === 1 && step === 1 && !sourceOk) return 'error';
        if (i === 4 && building) return 'running';
        if (i === step && failure) return 'error';
        if (i < step) return 'done';
        if (i === step) return 'active';
        return 'pending';
      }),
    [step, auth, sourceOk, building, failure],
  );

  if (!item || !integrity) {
    return (
      <Text maxFontSizeMultiplier={1.2} style={styles.body}>
        {t('features.evidence.export.failed.NOT_FOUND')}
      </Text>
    );
  }

  const next = () => {
    triggerHaptic('primaryPress');
    setFailure(null);
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
        auth === 'checking' ? (
          <View style={styles.inline} testID="evidence-export-authorizing">
            <Spinner size="sm" />
            <Text maxFontSizeMultiplier={1.2} style={styles.body}>
              {t('features.evidence.export.authorizing')}
            </Text>
          </View>
        ) : auth === 'denied' ? (
          <DeniedAlert />
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

      {step === 1 ? (
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
              <Alert.Title>{t(`features.evidence.export.failed.${failure}`)}</Alert.Title>
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
              ...(pkg
                ? [{ id: 'manifest', label: t('features.evidence.export.manifestSha'), value: shortHash(pkg.signature.signedDigest), mono: true }]
                : []),
            ]}
          />
          <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
            {t('features.evidence.export.zipNote')}
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
        {step === 5 || auth === 'denied' || (step === 1 && !sourceOk) || (step === 4 && failure && failure !== 'INVALID_REASON') ? (
          <Button variant={step === 5 ? 'primary' : 'outline'} onPress={onClose} testID="evidence-export-finish">
            <Button.Label>{step === 5 ? t('features.evidence.export.finish') : t('features.evidence.export.close')}</Button.Label>
          </Button>
        ) : null}
      </View>
    </View>
  );
}

/** "Your role cannot export" with the lock-shackle motion (M-C-22 lockout form; reduced: static). */
function DeniedAlert() {
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
        <Alert.Description>{t('features.evidence.export.deniedBody')}</Alert.Description>
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
