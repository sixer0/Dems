/**
 * Hash-chain status for the Audit view (04_mobile_specs §4.16; 03_motion_spec M-C-21, M-PG-SEC, P7;
 * parity with the web Security & Audit chain panel, implementation/30_page_security_audit.md).
 *
 * - `ChainStatusChip`: the header chip "Chain OK" / "Discontinuity". When the simulator's
 *   AUDIT_TAMPER fault appears it escalates ONCE (one e3 red halo pulse, `totalMs` passed explicitly,
 *   relay F74-02 / D73) and then holds a steady red chip (P7 "calm under pressure": no loop, no shake).
 * - `ChainStrip`: the newest entries as linked blocks (oldest left, head right). Links light up in
 *   sequence on enter (opacity 0.3 → 1, 80 ms apart). The head breathes subtly while the chain is
 *   intact (`glowBreath`, the screen's one ambient loop, paused off-focus and under reduced motion).
 *   A broken entry is a red block; a break older than the strip is pinned in front with a gap. The
 *   Verify button runs `verifyAuditChain()` (Spinner → PASS pop / FAIL pulse, no shake) and states
 *   the entries checked at the store's time.
 *
 *   Site S1-7 / S4-3 (backend task W80; 04_client_integration_spec §8.5, §8.7, §8.1 LB-1, LB-5,
 *   LB-6, LB-10; 09b_m1_mobile_consolidation §8 and decision D166): the action comes from
 *   `useCoreActions()` and settles through `settle` inside the runtime's `usePendingPress`, in both
 *   modes.
 *   - Simulated mode: the simulator's own check, synchronous, one frame after the Spinner shows,
 *     exactly as before (the hook sets no state and the button gets no new prop).
 *   - Live mode: operation 60 `verifyAuditChain` on the Core server, sent at the press. Busy at
 *     once, spinner late (LB-1, D166): the button is marked busy while the request is out and a
 *     second press sends nothing; its look does not change for `LIVE_PENDING_REVEAL_MS`, then the
 *     runtime's `PendingSpinner` and "Verifying…" show until the answer. The verdict is the Core's
 *     `view` (its check of the audit ring it holds), stamped with the store's clock, which is the
 *     Core's (S4-3); the Core's `stored` and `lineage` lines follow it (`chain-live.tsx`). A
 *     rejection goes to the runtime's refusal presenter first and the last verdict, if any, stays.
 * - `TamperAlert`: the EVT-30 discontinuity `Alert status="danger"` (same copy as the web Alert),
 *   with "Show entry" and "Acknowledge". Acknowledging stops the broken row's slow glow; the break
 *   stays on record.
 */
import { Alert, Button, Spinner, useToast } from 'heroui-native';
import { ShieldAlert, ShieldCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, cancelAnimation, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { settle, useCoreActions } from '@dems/shared/live';
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime';
import { useSimInstance, type AuditRow, type ChainVerifyResult } from '@dems/shared/sim';
import { derived, fontFamily, palette, radius, spacing, statusText, typography } from '@dems/shared/tokens';
import { StatusChip } from '@/components/kit';
import {
  SPEC_LITERALS,
  animateBreath,
  animatePulseOnce,
  animateSpring,
  enterRise,
  glowShadow,
  triggerHaptic,
  useAmbientLoop,
  useMotionSettings,
} from '@/motion';
import { PendingSpinner, busyState, reportRuntimeIssue, useCoreErrorPresenter, useCoreLink, usePendingPress } from '@/runtime';
import { shortHash, stripEntries } from './audit-model';
import { LiveChainLines } from './chain-live';

/** One escalation pulse (03M R8 / M-C-10), always passed explicitly to the builder (D73). */
export const CHAIN_ESCALATION_PULSE_MS = SPEC_LITERALS.escalationPulseMs;
/** M-C-21 strip: links light up 80 ms apart. */
export const LINK_STAGGER_MS = 80;
/** Blocks in the strip (the phone width holds eight with their links). */
export const STRIP_BLOCKS = 8;

// ── Header chip ──────────────────────────────────────────────────────────────────────────

export function ChainStatusChip({ breakSeq }: { breakSeq: number | null }) {
  const { t } = useTranslation();
  const m = useMotionSettings();
  const halo = useSharedValue(0);
  const broken = breakSeq !== null;
  const previous = useRef(breakSeq);

  // One pulse on the intact → broken edge (and on a new break), never on mount or on clearing.
  useEffect(() => {
    const before = previous.current;
    previous.current = breakSeq;
    if (breakSeq === null || before === breakSeq) return;
    if (m.policy === 'reduced') return;
    halo.set(animatePulseOnce(1, 0, m, CHAIN_ESCALATION_PULSE_MS));
  }, [breakSeq, m, halo]);
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.get() }));

  return (
    <View style={styles.chipWrap} testID="audit-chain-chip" accessibilityLabel={broken ? t('features.audit.chain.broken') : t('features.audit.chain.ok')}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radius.px.full, boxShadow: glowShadow(3, 'danger') }, haloStyle]}
      />
      <StatusChip
        size="md"
        tone={broken ? 'danger' : 'success'}
        icon={broken ? ShieldAlert : ShieldCheck}
        label={broken ? t('features.audit.chain.broken') : t('features.audit.chain.ok')}
        testID={broken ? 'audit-chain-chip-broken' : 'audit-chain-chip-ok'}
      />
    </View>
  );
}

// ── Strip ────────────────────────────────────────────────────────────────────────────────

type VerifyState = { kind: 'idle' } | { kind: 'running' } | { kind: 'done'; result: ChainVerifyResult; at: number };

/**
 * Runs `verifyAuditChain()` (site S1-7): in Simulated mode one frame after the Spinner shows, as
 * before; in Live mode at the press. Only a press starts it: nothing is sent from a mount effect
 * (decision D158, F69-1), so a development build's StrictMode sends nothing at mount.
 */
function useChainVerify() {
  const actions = useCoreActions();
  const sim = useSimInstance();
  const live = useCoreLink().source === 'LIVE';
  const presentCoreError = useCoreErrorPresenter();
  const press = usePendingPress();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [state, setState] = useState<VerifyState>({ kind: 'idle' });
  const frame = useRef<number | null>(null);
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  // One request per press (LB-1). In Simulated mode the action settles before `run` returns, so the
  // hook sets no state and the button gets no new prop: the screen is as before.
  const start = () =>
    press.run((release) =>
      settle(() => actions.verifyAuditChain(), {
        ok: (result) => {
          // S4-3: the store's clock; in Live mode the store is the Live source, its clock the Core's.
          setState({ kind: 'done', result, at: sim.store.getState().clock.now });
          triggerHaptic(result.ok ? 'verifyPass' : 'verifyFail');
        },
        fail: (error) => {
          if (live) {
            // LB-5, LB-6, LB-10: the presenter words a refusal, a dead link or a limit; the last verdict stays.
            const presented = presentCoreError(error);
            reportRuntimeIssue(presented ? 'warn' : 'error', 'audit.verifyChain.core', error, { presented });
            if (!presented) toast.show({ variant: 'danger', label: t('features.audit.errors.verify') });
            return;
          }
          reportRuntimeIssue('error', 'audit.verifyChain', error);
          toast.show({ variant: 'danger', label: t('features.audit.errors.verify') });
          setState({ kind: 'idle' });
        },
        done: release,
      }),
    );

  const run = () => {
    if (state.kind === 'running') return;
    if (live) {
      start();
      return;
    }
    setState({ kind: 'running' });
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      start();
    });
  };
  return { state, run, busy: press.busy, pending: press.pending, live };
}

export interface ChainStripProps {
  /** The audit ring, oldest first. */
  rows: readonly AuditRow[];
  head: string;
  total: number;
  breakSeq: number | null;
  /** Screen focus: the head breath pauses off-focus (04 §7.1 Loops). */
  focused: boolean;
}

export function ChainStrip({ rows, head, total, breakSeq, focused }: ChainStripProps) {
  const { t } = useTranslation();
  const m = useMotionSettings();
  const { tail, olderBreakSeq } = stripEntries(rows, breakSeq, STRIP_BLOCKS);
  const verify = useChainVerify();
  const intact = breakSeq === null;
  /** Simulated mode's one frame between the press and the synchronous check (the Spinner as before). */
  const running = verify.state.kind === 'running';

  return (
    <View style={styles.strip} testID="audit-chain-strip">
      <View style={styles.links} accessibilityRole="summary" accessibilityLabel={t('features.audit.chain.stripLabel')}>
        {olderBreakSeq !== null ? (
          <>
            <LinkBlock index={0} seq={olderBreakSeq} broken head={false} breathing={false} />
            <Text maxFontSizeMultiplier={1.2} style={styles.gap} testID="audit-chain-gap">
              …
            </Text>
          </>
        ) : null}
        {tail.map((row, index) => {
          const isHead = index === tail.length - 1;
          return (
            <View key={row.id} style={index > 0 ? styles.linkCell : null}>
              {index > 0 ? <View style={[styles.connector, row.seq === breakSeq ? styles.connectorBroken : null]} /> : null}
              <LinkBlock
                index={index + 1}
                seq={row.seq}
                broken={row.seq === breakSeq}
                head={isHead}
                breathing={isHead && intact && focused}
              />
            </View>
          );
        })}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.meta}>
          <Text maxFontSizeMultiplier={1.2} style={styles.metaLabel}>
            {t('features.audit.chain.head')}
          </Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.metaHash} testID="audit-chain-head">
            {shortHash(head)}
          </Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.metaCount} testID="audit-chain-total">
            {t('features.audit.chain.entries', { count: total })}
          </Text>
        </View>
        <Button
          size="sm"
          variant="outline"
          onPress={verify.run}
          isDisabled={running}
          accessibilityLabel={t('features.audit.chain.verifyLabel')}
          testID="audit-verify"
          {...busyState(verify.busy, running)}
        >
          {running ? <Spinner size="sm" /> : verify.pending ? <PendingSpinner testID="audit-verify-spinner" /> : null}
          <Button.Label>{running || verify.pending ? t('securityAudit.chain.verifying') : t('common.actions.verify')}</Button.Label>
        </Button>
      </View>
      {verify.state.kind === 'done' ? (
        <VerifyVerdict key={verify.state.at} result={verify.state.result} at={verify.state.at} motion={m.policy} />
      ) : null}
      {verify.live && verify.state.kind === 'done' ? <LiveChainLines /> : null}
    </View>
  );
}

function LinkBlock({ index, seq, broken, head, breathing }: { index: number; seq: number; broken: boolean; head: boolean; breathing: boolean }) {
  const { t } = useTranslation();
  const m = useMotionSettings();
  const running = useAmbientLoop('audit-chain-head', { active: breathing });
  const glow = useSharedValue(head && !broken ? 1 : 0);

  useEffect(() => {
    if (!head || broken) {
      glow.set(0);
      return undefined;
    }
    if (!running) {
      glow.set(1);
      return undefined;
    }
    // Subtle breath (M-PG-SEC ambient): every argument passed, no worklet default parameter.
    glow.set(animateBreath(0.35, 1, 'glowBreath', m, 1));
    return () => cancelAnimation(glow);
  }, [head, broken, running, m, glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));

  const entering =
    m.policy === 'reduced'
      ? undefined
      : FadeIn.duration(240)
          .delay(index * LINK_STAGGER_MS)
          .withInitialValues({ opacity: 0.3 })
          .reduceMotion(ReduceMotion.System);
  const status = broken ? t('securityAudit.audit.chainBroken') : t('securityAudit.audit.chainLinked');

  return (
    <Animated.View
      entering={entering}
      style={styles.blockWrap}
      accessibilityLabel={t('features.audit.chain.linkLabel', { seq, status })}
      testID={`audit-chain-link-${seq}`}
    >
      {head && !broken ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.blockGlow, glowStyle]} testID="audit-chain-head-glow" />
      ) : null}
      <View style={[styles.block, head ? styles.blockHead : null, broken ? styles.blockBroken : null]} />
    </Animated.View>
  );
}

function VerifyVerdict({ result, at, motion }: { result: ChainVerifyResult; at: number; motion: 'full' | 'reduced' }) {
  const { t } = useTranslation();
  const m = useMotionSettings();
  const scale = useSharedValue(motion === 'reduced' ? 1 : result.ok ? 0.6 : 1);
  const halo = useSharedValue(0);
  useEffect(() => {
    if (m.policy === 'reduced') return;
    // M-C-21: PASS pops on `bouncy` with one green glow; FAIL gets one red glow pulse, no shake.
    halo.set(animatePulseOnce(1, 0, m, CHAIN_ESCALATION_PULSE_MS));
    if (result.ok) scale.set(animateSpring(1, 'bouncy', m));
  }, [m, result.ok, halo, scale]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.get() }));
  const time = formatDate(at, DATE_PATTERNS.time);
  const text = result.ok
    ? t('features.audit.chain.verifiedAt', { count: result.checked, time })
    : t('features.audit.chain.failedAt', { seq: result.seq, reason: t(`securityAudit.chain.reason.${result.reason}`) });

  return (
    <Animated.View entering={enterRise(0, m, { distance: 'riseSm' })} style={styles.verdict} testID={`audit-verify-${result.ok ? 'PASS' : 'FAIL'}`}>
      <View style={styles.chipWrap}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: radius.px.full, boxShadow: glowShadow(3, result.ok ? 'success' : 'danger') }, haloStyle]}
        />
        <Animated.View style={popStyle}>
          <StatusChip size="sm" tone={result.ok ? 'success' : 'danger'} icon={null} label={result.ok ? t('securityAudit.chain.pass') : t('securityAudit.chain.fail')} />
        </Animated.View>
      </View>
      <Text maxFontSizeMultiplier={1.2} style={[styles.verdictText, result.ok ? null : styles.verdictFail]} testID="audit-verify-text">
        {text}
      </Text>
    </Animated.View>
  );
}

// ── Discontinuity Alert ──────────────────────────────────────────────────────────────────

export interface TamperAlertProps {
  seq: number;
  acknowledged: boolean;
  onShow: () => void;
  onAcknowledge: () => void;
}

export function TamperAlert({ seq, acknowledged, onShow, onAcknowledge }: TamperAlertProps) {
  const { t } = useTranslation();
  const m = useMotionSettings();
  return (
    <Animated.View entering={enterRise(0, m)} testID="audit-tamper-alert">
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t('securityAudit.chain.discontinuityTitle')}</Alert.Title>
          <Alert.Description>{t('securityAudit.chain.discontinuityBody', { index: seq })}</Alert.Description>
          {acknowledged ? (
            <Alert.Description testID="audit-tamper-acknowledged">{t('securityAudit.chain.acknowledged')}</Alert.Description>
          ) : null}
          <View style={styles.alertActions}>
            <Button size="sm" variant="outline" onPress={onShow} testID="audit-tamper-show">
              <Button.Label>{t('features.audit.chain.showEntry')}</Button.Label>
            </Button>
            {acknowledged ? null : (
              <Button size="sm" variant="ghost" onPress={onAcknowledge} testID="audit-tamper-acknowledge">
                <Button.Label>{t('securityAudit.chain.acknowledge')}</Button.Label>
              </Button>
            )}
          </View>
        </Alert.Content>
      </Alert>
    </Animated.View>
  );
}

const BLOCK = 16;

const styles = StyleSheet.create({
  chipWrap: { alignSelf: 'flex-start', borderRadius: radius.px.full },
  strip: {
    backgroundColor: derived.surface,
    borderRadius: radius.px.xl,
    borderWidth: 1,
    borderColor: derived.border,
    padding: spacing[2],
    gap: spacing[1],
  },
  links: { flexDirection: 'row', alignItems: 'center', minHeight: 28 },
  linkCell: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  connector: { flex: 1, height: 1.5, backgroundColor: derived.border, marginHorizontal: 2 },
  connectorBroken: { backgroundColor: palette.danger },
  gap: { color: statusText.danger, fontFamily: fontFamily.native.mono, fontSize: 14, marginHorizontal: spacing[0] },
  blockWrap: { width: BLOCK, height: BLOCK, borderRadius: 4 },
  block: { width: BLOCK, height: BLOCK, borderRadius: 4, borderWidth: 1.5, borderColor: palette.gold, backgroundColor: derived.surfaceSecondary },
  blockHead: { backgroundColor: palette.gold },
  blockBroken: { borderColor: palette.danger, backgroundColor: palette.danger },
  blockGlow: { borderRadius: 4, boxShadow: glowShadow(2) },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[1] },
  meta: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: spacing[1], flex: 1 },
  metaLabel: { fontFamily: fontFamily.native.semibold, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gold, textTransform: 'uppercase', letterSpacing: 0.6 },
  metaHash: { fontFamily: fontFamily.native.monoMedium, fontSize: typography.data.size, lineHeight: typography.data.lineHeight, color: palette.foreground },
  metaCount: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], flexWrap: 'wrap' },
  verdictText: { flex: 1, fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: derived.foreground2 },
  verdictFail: { color: statusText.danger },
  alertActions: { flexDirection: 'row', gap: spacing[1], marginTop: spacing[1] },
});
