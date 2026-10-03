/**
 * Hash & Integrity tab (04_mobile_specs §4.11 D5c; D50, D51, D67; row 83).
 *
 * Shows the DEMO package's integrity data: per-track SHA-256 (sealed vs stored), the manifest hash
 * the signature covers, the Ed25519 signature (DEMO key), the DEMO device certificate and the audit
 * extract. The verdict is the package's precomputed result, labelled "verified by the Core" (D51):
 * PASS for the 13 pristine items, FAIL on `track:AUDIO-02` for the tampered evidence 0005.
 *
 * Verify: kit `Button` → `Spinner` ("asking the Core") → 600 ms scramble of the stored hashes
 * (`useScramble`, ≤ 20 text updates) → PASS chip with a bouncy pop and a green glow, or FAIL with
 * one red pulse (no shake; pulse length passed explicitly, relay F74-02). Haptic Success or Error (§7.6). The simulator records the verification
 * (audit row, custody entry) through `recordCoreVerification` (SIM-GAP-M83-1 guard).
 *
 * Below: the C-4 lifecycle (§19.1, horizontal scroll) and the chain of custody (`ListGroup`).
 */
import { Button, ListGroup, Separator, Spinner, useToast } from 'heroui-native';
import { CircleCheck, CircleX } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime';
import { useSimInstance, type EvidenceItem } from '@dems/shared/sim';
import { derived, fontFamily, palette, radius, spacing, statusText, typography } from '@dems/shared/tokens';
import { StatusChip } from '@/components/kit';
import { Stepper, type StepDef } from '@/components/composed/stepper';
import { animatePulseOnce, animateSpring, glowShadow, triggerHaptic, useMotionPolicy, useMotionSettings } from '@/motion';
import { newCorrelationId } from '@/runtime';
import { LIFECYCLE_STAGES, failedCheckNames, lifecycleStatuses, type IntegrityModel, type IntegrityRow } from './evidence-model';
import { recordCoreVerification } from './sim-adapter';
import { SCRAMBLE_MS, useScramble } from './use-scramble';

/** How long the "asking the Core" spinner shows before the scramble (a simulated round trip). */
export const VERIFY_ASK_MS = 450;

export type VerifyPhase = 'idle' | 'asking' | 'scrambling' | 'done';

export interface IntegrityTabProps {
  item: EvidenceItem;
  integrity: IntegrityModel;
  operatorNames: Readonly<Record<string, string>>;
  /** Start a verification as soon as the tab mounts (kebab "Verify"). */
  autoVerify?: boolean;
}

export function IntegrityTab({ item, integrity, operatorNames, autoVerify = false }: IntegrityTabProps) {
  const { t } = useTranslation();
  const policy = useMotionPolicy();
  const reduced = policy === 'reduced';
  const sim = useSimInstance();
  const { toast } = useToast();
  const [phase, setPhase] = useState<VerifyPhase>(autoVerify ? 'asking' : 'idle');
  const [resultKey, setResultKey] = useState(0);
  const correlation = useRef<string | null>(null);

  const verify = useCallback(() => {
    correlation.current = newCorrelationId('verify');
    setPhase('asking');
  }, []);

  // "Asking the Core": a short simulated round trip, then the scramble.
  useEffect(() => {
    if (phase !== 'asking') return undefined;
    const timer = setTimeout(() => setPhase('scrambling'), reduced ? 0 : VERIFY_ASK_MS);
    return () => clearTimeout(timer);
  }, [phase, reduced]);

  const onScrambled = useCallback(() => {
    setPhase('done');
    setResultKey((k) => k + 1);
    const pass = integrity.verdict === 'PASS';
    triggerHaptic(pass ? 'verifyPass' : 'verifyFail');
    toast.show({
      variant: pass ? 'success' : 'danger',
      label: pass ? t('features.evidence.integrity.passToast', { id: item.id }) : t('features.evidence.integrity.failToast', { id: item.id }),
    });
    recordCoreVerification(sim, item, integrity, correlation.current ?? undefined);
  }, [integrity, item, sim, t, toast]);

  // The scramble pass: each stored hash scrambles in its own row (`ScrambledHash`), so this tab
  // renders only at the start and the end of the pass.
  // The latest completion handler, so a re-render during the pass never restarts its timer.
  const finish = useRef(onScrambled);
  useEffect(() => {
    finish.current = onScrambled;
  }, [onScrambled]);
  useEffect(() => {
    if (phase !== 'scrambling') return undefined;
    const timer = setTimeout(() => finish.current(), reduced ? 0 : SCRAMBLE_MS);
    return () => clearTimeout(timer);
  }, [phase, reduced]);

  const done = phase === 'done';
  const busy = phase === 'asking' || phase === 'scrambling';

  return (
    <View style={styles.root} testID="evidence-integrity">
      <View style={styles.verifyCard}>
        <View style={styles.verifyHead}>
          <View style={styles.verifyTitle}>
            <Text maxFontSizeMultiplier={1.2} style={styles.h3}>
              {t('features.evidence.integrity.verifiedByCore')}
            </Text>
            <StatusChip
              size="sm"
              tone={integrity.source === 'package' ? 'sealed' : 'default'}
              icon={null}
              label={integrity.source === 'package' ? integrity.label : t('common.simulated.chip')}
              testID="evidence-integrity-label"
            />
          </View>
          <Button
            size="sm"
            variant={done ? 'outline' : 'primary'}
            isDisabled={busy}
            onPress={verify}
            testID="evidence-verify"
          >
            {busy ? <Spinner size="sm" /> : null}
            <Button.Label>
              {busy
                ? t('features.evidence.integrity.verifying')
                : done
                  ? t('features.evidence.integrity.verifyAgain')
                  : t('features.evidence.integrity.verify')}
            </Button.Label>
          </Button>
        </View>
        <Text maxFontSizeMultiplier={1.2} style={styles.note}>
          {integrity.source === 'package' ? t('features.evidence.integrity.verifiedByCoreNote') : t('features.evidence.integrity.noPackage')}
        </Text>
        <VerdictLine integrity={integrity} done={done} resultKey={resultKey} />
      </View>

      <Section title={t('features.evidence.integrity.trackTitle')}>
        {integrity.tracks.map((row) => (
          <TrackHashRow key={row.id} row={row} scrambling={phase === 'scrambling'} reduced={reduced} revealed={done} />
        ))}
      </Section>

      <Section title={t('features.evidence.integrity.manifestHash')}>
        <HashText testID="evidence-manifest-hash" value={integrity.manifestHash} />
        <CheckLine row={integrity.checks.find((row) => row.id === 'manifest')} revealed={done} label={t('features.evidence.integrity.checks.manifest')} />
      </Section>

      <Section
        title={
          integrity.signature.algorithm === 'Ed25519'
            ? t('features.evidence.integrity.signature')
            : t('features.evidence.integrity.signatureSimulated')
        }
      >
        <HashText testID="evidence-signature" value={integrity.signature.value} />
        <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
          {t('features.evidence.integrity.keyId')}: {integrity.signature.keyId}
        </Text>
        <CheckLine row={integrity.checks.find((row) => row.id === 'signature')} revealed={done} label={t('features.evidence.integrity.checks.signature')} />
      </Section>

      {integrity.certificate ? (
        <Section title={t('features.evidence.integrity.certificate')}>
          <Text maxFontSizeMultiplier={1.2} selectable style={styles.caption}>
            {integrity.certificate.subject}
          </Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
            {t('features.evidence.integrity.certificateSha')}
          </Text>
          <HashText testID="evidence-certificate-sha" value={integrity.certificate.sha256} />
          <CheckLine row={integrity.checks.find((row) => row.id === 'certificate')} revealed={done} label={t('features.evidence.integrity.checks.certificate')} />
        </Section>
      ) : null}

      {integrity.audit ? (
        <Section title={t('features.evidence.integrity.auditChain')}>
          <Text maxFontSizeMultiplier={1.2} style={styles.body}>
            {t('features.evidence.integrity.auditChainValue', {
              rows: integrity.audit.rows,
              first: integrity.audit.firstSeq,
              last: integrity.audit.lastSeq,
            })}
          </Text>
          <CheckLine row={integrity.checks.find((row) => row.id === 'auditChain')} revealed={done} label={t('features.evidence.integrity.checks.auditChain')} />
        </Section>
      ) : null}

      <LifecycleStrip stage={item.lifecycleStage} />
      <CustodyLog item={item} operatorNames={operatorNames} />
    </View>
  );
}

/** One escalation pulse of the verdict glow (03M R8: exactly one; M-C-21 PASS glow, FAIL red pulse). */
export const VERDICT_PULSE_MS = 600;

/** The verdict under the Verify button: waiting text, then the PASS pop or the FAIL pulse. */
function VerdictLine({ integrity, done, resultKey }: { integrity: IntegrityModel; done: boolean; resultKey: number }) {
  const { t } = useTranslation();
  const m = useMotionSettings();
  const scale = useSharedValue(1);
  const halo = useSharedValue(0);
  const pass = integrity.verdict === 'PASS';

  useEffect(() => {
    if (resultKey === 0) return;
    if (m.policy === 'reduced') {
      scale.set(1);
      halo.set(0);
      return;
    }
    // Relay F74-02: the pulse length is always passed explicitly (no worklet default parameters).
    halo.set(animatePulseOnce(1, 0, m, VERDICT_PULSE_MS));
    if (pass) {
      scale.set(0.6);
      scale.set(animateSpring(1, 'bouncy', m));
    }
  }, [resultKey, pass, m, scale, halo]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.get() }));

  if (!done) {
    return (
      <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="evidence-verdict-pending">
        {t('features.evidence.integrity.notVerified')}
      </Text>
    );
  }
  const checks = failedCheckNames(integrity.failed).join(', ');
  return (
    <View style={styles.verdictRow} testID={`evidence-verdict-${integrity.verdict}`}>
      <View style={styles.verdictChip}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: radius.px.full, boxShadow: glowShadow(3, pass ? 'success' : 'danger') }, haloStyle]}
        />
        <Animated.View style={popStyle}>
          <StatusChip
            size="md"
            tone={pass ? 'success' : 'danger'}
            icon={pass ? CircleCheck : CircleX}
            label={pass ? t('evidence.detail.integrity.pass') : t('evidence.detail.integrity.fail')}
          />
        </Animated.View>
      </View>
      <Text maxFontSizeMultiplier={1.2} style={[styles.body, styles.verdictText, pass ? styles.passText : styles.failText]}>
        {pass ? t('features.evidence.integrity.resultPass') : t('features.evidence.integrity.resultFail', { checks })}
      </Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.label}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function HashText({ value, testID, tone }: { value: string; testID?: string; tone?: 'fail' }) {
  return (
    // The full hash, wrapping onto a second line where needed (evidence hashes are never cut).
    <Text maxFontSizeMultiplier={1.2} selectable testID={testID} style={[styles.hash, tone === 'fail' ? styles.failText : null]}>
      {value}
    </Text>
  );
}

interface TrackHashRowProps {
  row: IntegrityRow;
  scrambling: boolean;
  reduced: boolean;
  revealed: boolean;
}

function TrackHashRow({ row, scrambling, reduced, revealed }: TrackHashRowProps) {
  const { t } = useTranslation();
  const failed = revealed && !row.ok;
  const Icon = row.ok ? CircleCheck : CircleX;
  return (
    <View style={[styles.trackRow, failed ? styles.trackRowFail : null]} testID={`evidence-track-${row.trackId}`}>
      <View style={styles.trackHead}>
        <Text maxFontSizeMultiplier={1.2} style={styles.trackName}>
          {row.trackId ? t(`common.tracks.${row.trackId}`) : row.id}
        </Text>
        {revealed ? (
          <View style={styles.trackState} testID={`evidence-track-${row.trackId}-${row.ok ? 'ok' : 'fail'}`}>
            <Icon size={16} color={row.ok ? statusText.success : statusText.danger} />
          </View>
        ) : null}
      </View>
      <View style={styles.hashLine}>
        <Text maxFontSizeMultiplier={1.2} style={styles.hashKey}>
          {t('features.evidence.integrity.expected')}
        </Text>
        <HashText value={row.expected ?? '—'} />
      </View>
      <View style={styles.hashLine}>
        <Text maxFontSizeMultiplier={1.2} style={styles.hashKey}>
          {t('features.evidence.integrity.actual')}
        </Text>
        <ScrambledHash
          value={row.actual ?? '—'}
          scrambling={scrambling}
          reduced={reduced}
          tone={failed ? 'fail' : undefined}
          testID={`evidence-track-${row.trackId}-stored`}
        />
      </View>
      {failed && row.detail ? (
        <Text maxFontSizeMultiplier={1.2} style={[styles.caption, styles.failText]}>
          {row.detail}
        </Text>
      ) : null}
    </View>
  );
}

/** A stored hash that scrambles during the verify pass (M-C-21; ≤ 20 text updates in 600 ms). */
function ScrambledHash({ value, scrambling, reduced, tone, testID }: { value: string; scrambling: boolean; reduced: boolean; tone?: 'fail'; testID?: string }) {
  const targets = useMemo(() => [value], [value]);
  const [text] = useScramble(targets, scrambling, reduced);
  return <HashText value={text ?? value} tone={tone} testID={testID} />;
}

function CheckLine({ row, revealed, label }: { row: IntegrityRow | undefined; revealed: boolean; label: string }) {
  if (!row || !revealed) return null;
  const Icon = row.ok ? CircleCheck : CircleX;
  return (
    <View style={styles.checkLine} testID={`evidence-check-${row.id}-${row.ok ? 'ok' : 'fail'}`}>
      <Icon size={14} color={row.ok ? statusText.success : statusText.danger} />
      <Text maxFontSizeMultiplier={1.2} style={[styles.caption, row.ok ? styles.passText : styles.failText]}>
        {label}
      </Text>
    </View>
  );
}

/** The §19.1 lifecycle as a horizontal C-4 wizard strip, scrolled so the current stage shows. */
function LifecycleStrip({ stage }: { stage: string }) {
  const { t } = useTranslation();
  const policy = useMotionPolicy();
  const steps: StepDef[] = useMemo(
    () => LIFECYCLE_STAGES.map((key) => ({ key, label: t(`common.enums.evidenceLifecycleStage.${key}`) })),
    [t],
  );
  const statuses = useMemo(() => lifecycleStatuses(stage), [stage]);
  return (
    <View style={styles.section} testID="evidence-lifecycle">
      <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.label}>
        {t('features.evidence.integrity.lifecycle')}
      </Text>
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}>
        <Stepper steps={steps} statuses={statuses} orientation="horizontal" motion={policy} style={{ width: LIFECYCLE_STEP_WIDTH * steps.length }} />
      </ScrollView>
    </View>
  );
}

const LIFECYCLE_STEP_WIDTH = 92;

function CustodyLog({ item, operatorNames }: { item: EvidenceItem; operatorNames: Readonly<Record<string, string>> }) {
  const { t } = useTranslation();
  const rows = useMemo(() => item.custody.slice().reverse(), [item.custody]);
  return (
    <View style={styles.section} testID="evidence-custody">
      <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.label}>
        {t('features.evidence.integrity.custody')}
      </Text>
      {rows.length === 0 ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
          {t('features.evidence.integrity.custodyEmpty')}
        </Text>
      ) : (
        <ListGroup variant="transparent" className="rounded-xl">
          {rows.map((entry, index) => (
            <View key={`${entry.at}-${entry.action}-${index}`}>
              {index > 0 ? <Separator /> : null}
              <ListGroup.Item testID={`evidence-custody-${index}`}>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{t(`features.evidence.custodyAction.${entry.action}`, { defaultValue: entry.action })}</ListGroup.ItemTitle>
                  <ListGroup.ItemDescription>
                    {formatDate(entry.at, DATE_PATTERNS.dateTime)} ·{' '}
                    {entry.actorId ? (operatorNames[entry.actorId] ?? entry.actorId) : t('features.evidence.integrity.system')}
                    {entry.detail ? ` · ${entry.detail}` : ''}
                  </ListGroup.ItemDescription>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix>{null}</ListGroup.ItemSuffix>
              </ListGroup.Item>
            </View>
          ))}
        </ListGroup>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[3] },
  verifyCard: {
    gap: spacing[1],
    padding: spacing[2],
    borderRadius: radius.px.xl,
    backgroundColor: derived.surface,
    borderWidth: 1,
    borderColor: derived.border,
  },
  verifyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[1] },
  verifyTitle: { flexShrink: 1, gap: spacing[0] },
  h3: { fontFamily: fontFamily.native.semibold, fontSize: typography.h3.size, lineHeight: typography.h3.lineHeight, color: palette.foreground },
  note: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginTop: spacing[1] },
  verdictChip: { borderRadius: radius.px.full },
  verdictText: { flex: 1 },
  passText: { color: statusText.success },
  failText: { color: statusText.danger },
  section: { gap: spacing[1] },
  label: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.size * typography.label.letterSpacing,
    textTransform: 'uppercase',
    color: palette.gray,
  },
  body: { fontFamily: fontFamily.native.normal, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  caption: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  hash: { fontFamily: fontFamily.native.mono, fontSize: typography.data.size, lineHeight: typography.data.lineHeight, color: palette.foreground, flexShrink: 1, flexGrow: 1 },
  trackRow: {
    gap: 2,
    padding: spacing[1] + 2,
    borderRadius: radius.px.lg,
    backgroundColor: derived.surfaceSecondary,
    borderWidth: 1,
    borderColor: derived.separator,
  },
  trackRowFail: { borderColor: statusText.danger },
  trackHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trackName: { fontFamily: fontFamily.native.medium, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: derived.foreground2 },
  trackState: { paddingLeft: spacing[1] },
  hashLine: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[1] },
  hashKey: { width: 52, fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  checkLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[0] },
});
