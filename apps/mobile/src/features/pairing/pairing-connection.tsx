/**
 * The "Core connection" card of the Pairing screen (04_mobile_specs §4.2 Layout): a `SectionCard`
 * with the C-1 GlowRing around the link state, the C-4 Stepper (Discover → Verify code → Paired)
 * that animates through the connection steps, one live status line, and the Core identity as a
 * `KeyValueList` (device, room, paired at, last pairing audit row) with the certificate
 * fingerprint in mono and a "SIMULATED" chip.
 *
 * Phones stack it above the code card with a horizontal stepper and a `mini` ring; tablets give it
 * its own pane with a `hero` ring and a vertical stepper whose steps carry descriptions.
 *
 * **LIVE mode** (backend task W57; 04_client_integration_spec §3.2, §9.4): the chip reads `LIVE`,
 * and the card says only what the tablet knows. An unpaired tablet gets no Core data, so before
 * pairing there is no Core name, ID or fingerprint to show: the list holds the Core server, the
 * link state and "This tablet: Not paired". After pairing it holds the Core identity of the redeem
 * answer and the ID the Core gave this tablet. The texts of Simulated mode are not changed.
 */
import { useIsFocused } from 'expo-router';
import { Lock, Link2Off, Radar, ShieldCheck } from 'lucide-react-native';
import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { DATE_PATTERNS, formatClock, formatDate } from '@dems/shared/realtime';
import { useSim, type PairingState } from '@dems/shared/sim';
import { derived, fontFamily, palette, spacing, statusText, toneHex, typography } from '@dems/shared/tokens';
import { GlowRing } from '@/components/composed/glow-ring';
import type { GlowRingState } from '@/components/composed/glow-ring.math';
import { Stepper, type StepDef, type StepStatusWords } from '@/components/composed/stepper';
import { KeyValueList, SectionCard, StatusChip, type KeyValueItem } from '@/components/kit';
import { SPEC_LITERALS, animatePulseOnce, crossFadeIn, useAmbientLoop, type MotionSettings } from '@/motion';
import { reportRuntimeIssue } from '@/runtime';
import { liveRingStateFor, liveStatusKeyFor, liveStepStatusesFor, type LiveLinkView } from './pairing-live-model';
import {
  fingerprintLines,
  ringStateFor,
  selectCertificateFingerprint,
  selectReportedCoreDeviceId,
  selectReportedCoreDeviceIdLive,
  selectCoreName,
  selectLastPairingAudit,
  selectPairedAt,
  stateChipFor,
  statusKeyFor,
  stepStatusesFor,
  type PairOutcome,
  type PairPhase,
  type PairingView,
} from './pairing-model';

/** Loop names for the `?debug=1` overlay and the ≤ 4 cap (03M P3). */
export const PAIRING_LOOPS = { ringBreath: 'pairing-ring-breath', ringRotate: 'pairing-ring-rotate' } as const;

const STEP_KEYS = ['discover', 'verifyCode', 'paired'] as const;
const STEP_DESCRIPTION_KEYS = ['discover', 'verify', 'paired'] as const;

/** What the card needs to know in LIVE mode, besides the view. */
export interface PairingConnectionLive {
  link: LiveLinkView;
  /** The code left the tablet and the answer is not in yet. */
  sent: boolean;
  outcome: PairOutcome | null;
  /** The Core's ID of this tablet while paired, e.g. `DEV-0003`. */
  tabletId: string | null;
}

export interface PairingConnectionProps {
  view: PairingView;
  phase: PairPhase | null;
  simState: PairingState;
  /** Tablet pane (vertical stepper with descriptions, hero ring) or phone stack. */
  split: boolean;
  ringSize: number;
  settings: MotionSettings;
  /** LIVE mode; absent or `null` in Simulated mode, where the card is as it was. */
  live?: PairingConnectionLive | null;
}

/** D212 (row 226): the LIVE "paired" line names no Core when the id is not reported (I6); any other line is unchanged. */
function liveStatusTextKey(key: string, reportedId: string | null): string {
  return key === 'paired' && reportedId === null ? 'pairedNoId' : key;
}

export function PairingConnection({ view, phase, simState, split, ringSize, settings, live = null }: PairingConnectionProps) {
  const { t } = useTranslation();
  // I6 (M3-10 R1, row 200): the Core id through the S9 rule; the reserved id reads "Not reported".
  const reportedId = useSim(live === null ? selectReportedCoreDeviceId : selectReportedCoreDeviceIdLive);
  const device = reportedId ?? t('system.noProducer');
  const room = useSim(selectCoreName);
  const fingerprint = useSim(selectCertificateFingerprint);
  const pairedAt = useSim(selectPairedAt);
  const lastAudit = useSim(selectLastPairingAudit);
  const chip = stateChipFor(view, simState);
  const paired = simState === 'PAIRED';
  const offline = live !== null && live.link === 'offline' && view !== 'pairing' && view !== 'paired';
  // One key per status text: the line cross-fades when it changes.
  const statusKey = live === null ? statusKeyFor(view, phase) : `live.${liveStatusKeyFor({ view, phase, sent: live.sent, link: live.link, outcome: live.outcome })}`;
  const statuses = live === null ? stepStatusesFor(view, phase) : liveStepStatusesFor(view, phase, live.link);
  const statusText =
    live === null
      ? t(`features.pairing.connection.status.${statusKey}`, { device })
      : t(`features.pairing.live.connection.status.${liveStatusTextKey(statusKey.slice('live.'.length), reportedId)}`, { device, tablet: live.tabletId ?? '' });

  const steps: StepDef[] = STEP_KEYS.map((key, i) => ({
    key,
    label: t(`mobile.pairing.steps.${key}`),
    ...(split
      ? {
          description:
            live === null
              ? t(`features.pairing.connection.steps.${STEP_DESCRIPTION_KEYS[i]}`, { device })
              : t(`features.pairing.live.connection.steps.${STEP_DESCRIPTION_KEYS[i]}`),
        }
      : {}),
  }));
  const words: StepStatusWords = {
    step: t('features.pairing.stepper.step'),
    of: t('features.pairing.stepper.of'),
    pending: t('features.pairing.stepper.pending'),
    active: t('features.pairing.stepper.active'),
    running: t('features.pairing.stepper.running'),
    done: t('features.pairing.stepper.done'),
    warn: t('features.pairing.stepper.warn'),
    error: t('features.pairing.stepper.error'),
  };

  const pairedAtItem: KeyValueItem = {
    id: 'paired-at',
    label: t('features.pairing.identity.pairedAt'),
    value: paired && pairedAt !== null ? formatDate(pairedAt, DATE_PATTERNS.dateTime) : t('features.pairing.identity.notPaired'),
    mono: paired && pairedAt !== null,
    testID: 'pairing-identity-paired-at',
  };
  const lastAuditItem: KeyValueItem = {
    id: 'last-audit',
    label: t('features.pairing.identity.lastAudit'),
    value: lastAudit
      ? t('features.pairing.identity.lastAuditValue', {
          seq: lastAudit[0],
          event: t(`common.auditType.${lastAudit[1]}`),
          time: formatClock(lastAudit[2]),
        })
      : t('features.pairing.identity.noAudit'),
    testID: 'pairing-identity-last-audit',
  };
  const tabletItem: KeyValueItem = {
    id: 'tablet',
    label: t('features.pairing.live.identity.tablet'),
    value: paired && live?.tabletId ? live.tabletId : t('features.pairing.identity.notPaired'),
    mono: paired && Boolean(live?.tabletId),
    testID: 'pairing-identity-tablet',
  };
  const items: KeyValueItem[] =
    live === null
      ? [
          { id: 'device', label: t('features.pairing.identity.device'), value: device, mono: reportedId !== null, testID: 'pairing-identity-device' },
          { id: 'room', label: t('features.pairing.identity.room'), value: room, testID: 'pairing-identity-room' },
          pairedAtItem,
          lastAuditItem,
        ]
      : paired
        ? [
            { id: 'device', label: t('features.pairing.live.identity.coreDevice'), value: device, mono: reportedId !== null, testID: 'pairing-identity-device' },
            { id: 'room', label: t('features.pairing.live.identity.coreName'), value: room, testID: 'pairing-identity-room' },
            tabletItem,
            pairedAtItem,
            // The replica holds audit rows only while an operator is signed in: no row, no line.
            ...(lastAudit ? [lastAuditItem] : []),
          ]
        : [
            // Nothing is known about the Core before pairing: the list holds what the tablet does know.
            { id: 'server', label: t('features.pairing.live.identity.server'), value: t('features.pairing.live.identity.serverValue'), testID: 'pairing-identity-server' },
            { id: 'link', label: t('features.pairing.live.identity.link'), value: t(`features.pairing.live.identity.linkState.${live.link}`), testID: 'pairing-identity-link' },
            tabletItem,
          ];

  // LIVE mode before pairing: the Core has not said who it is.
  const fingerprintKnown = live === null || fingerprint !== '';

  const ring = (
    <RingBoundary>
      <PairingRing
        view={view}
        offline={offline}
        ringState={live === null ? ringStateFor(view) : liveRingStateFor(view, live.link)}
        mode={split ? 'hero' : 'mini'}
        size={ringSize}
        settings={settings}
        label={t('features.pairing.connection.ringLabel', { state: t(chip.key) })}
      />
    </RingBoundary>
  );

  const statusLine = (
    <Animated.View key={statusKey} entering={crossFadeIn(settings)} style={split ? styles.statusSplit : styles.statusStacked}>
      <Text
        testID="pairing-status-line"
        accessibilityLiveRegion="polite"
        maxFontSizeMultiplier={1.2}
        style={[styles.status, view === 'locked' || view === 'failed' || offline ? styles.statusAlert : null, view === 'paired' ? styles.statusOk : null, split ? styles.center : null]}
      >
        {statusText}
      </Text>
    </Animated.View>
  );

  return (
    <SectionCard
      testID="pairing-connection"
      title={t('features.pairing.connection.title')}
      action={<StatusChip testID="pairing-state-chip" tone={chip.tone} label={t(chip.key)} icon={null} size="sm" />}
    >
      {split ? (
        <View style={styles.heroBlock}>
          {ring}
          {statusLine}
        </View>
      ) : (
        <View style={styles.miniRow}>
          {ring}
          <View style={styles.miniText}>{statusLine}</View>
        </View>
      )}
      <Stepper
        // Remount on every status change so each badge mounts with its final glyph (step 78 S78-7:
        // on dems_phone a badge's first UI-thread update can land before Fabric mounts the glyph).
        // The remount replays the badges' enter stagger, so each connection step still animates in.
        key={statuses.join('|')}
        testID="pairing-stepper"
        steps={steps}
        statuses={statuses}
        orientation={split ? 'vertical' : 'horizontal'}
        motion={settings.policy}
        statusWords={words}
        style={split ? styles.stepperSplit : styles.stepperStacked}
      />
      <KeyValueList items={items} accessibilityLabel={t('features.pairing.identity.title')} testID="pairing-identity" />
      <View
        style={styles.fingerprint}
        testID="pairing-fingerprint"
        accessible
        accessibilityLabel={`${t('features.pairing.identity.fingerprint')}, ${fingerprintKnown ? fingerprint : t('features.pairing.live.identity.fingerprintUnknown')}`}
      >
        <View style={styles.fingerprintHead}>
          <Text maxFontSizeMultiplier={1.2} style={styles.fingerprintLabel}>
            {t('features.pairing.identity.fingerprint')}
          </Text>
          {/* The mode chip (§3.2). Its test ID is the screen's from before Live mode and stays. */}
          <StatusChip
            testID="pairing-simulated-chip"
            tone={live === null ? 'info' : live.link === 'offline' ? 'danger' : 'success'}
            label={t(live === null ? 'mobile.pairing.simulated' : 'mobile.pairing.live')}
            icon={null}
            size="sm"
          />
        </View>
        {fingerprintKnown ? (
          fingerprintLines(fingerprint).map((line) => (
            <Text key={line} selectable maxFontSizeMultiplier={1.2} style={styles.fingerprintValue}>
              {line}
            </Text>
          ))
        ) : (
          <Text testID="pairing-fingerprint-unknown" maxFontSizeMultiplier={1.2} style={styles.fingerprintUnknown}>
            {t('features.pairing.live.identity.fingerprintUnknown')}
          </Text>
        )}
      </View>
    </SectionCard>
  );
}

const ICONS = { paired: ShieldCheck, pairing: Radar, locked: Lock, failed: Link2Off, unpaired: Link2Off } as const;

interface PairingRingProps {
  view: PairingView;
  /** LIVE mode: the Core server is unreachable. */
  offline: boolean;
  ringState: GlowRingState;
  mode: 'mini' | 'hero';
  size: number;
  settings: MotionSettings;
  label: string;
}

/** C-1 ring around the link icon; one glow pulse on success (03M R8, `totalMs` passed, F74-02). */
function PairingRing({ view, offline, ringState, mode, size, settings, label }: PairingRingProps) {
  const focused = useIsFocused();
  const breathing = useAmbientLoop(PAIRING_LOOPS.ringBreath, { paused: !focused });
  useAmbientLoop(PAIRING_LOOPS.ringRotate, { active: mode === 'hero', paused: !focused });
  const Icon = ICONS[view];
  const tone = view === 'paired' ? toneHex.success : view === 'locked' || offline ? toneHex.danger : view === 'pairing' ? palette.gold : toneHex.warning;

  const pulse = useSharedValue(1);
  useEffect(() => {
    if (view === 'paired') pulse.set(animatePulseOnce(1.12, 1, settings, SPEC_LITERALS.escalationPulseMs));
  }, [view, settings, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));

  const iconSize = mode === 'hero' ? 64 : 30;
  return (
    <GlowRing testID="pairing-ring" mode={mode} size={size} state={ringState} motion={settings.policy} paused={!breathing} accessibilityLabel={label}>
      <Animated.View style={pulseStyle}>
        <Icon size={iconSize} color={tone} strokeWidth={1.75} />
      </Animated.View>
    </GlowRing>
  );
}

/** The ring is decoration: a Skia failure (F-79-4) must not take the pairing screen down. */
class RingBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportRuntimeIssue('error', 'PairingScreen.ring', error, { componentStack: info.componentStack ?? null });
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const styles = StyleSheet.create({
  heroBlock: { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2] },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  miniText: { flex: 1 },
  statusStacked: { flex: 1 },
  statusSplit: { alignSelf: 'stretch' },
  status: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: derived.foreground2,
  },
  statusAlert: { color: statusText.warning },
  statusOk: { color: statusText.success },
  center: { textAlign: 'center' },
  stepperStacked: { marginTop: spacing[1] },
  stepperSplit: { marginTop: spacing[1], paddingHorizontal: spacing[1] },
  fingerprint: { gap: spacing[0], paddingHorizontal: spacing[1] },
  fingerprintHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[1], marginBottom: spacing[0] },
  fingerprintLabel: {
    flex: 1,
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
  },
  fingerprintUnknown: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: derived.foreground2,
  },
  fingerprintValue: {
    fontFamily: fontFamily.native.mono,
    fontSize: typography.data.size,
    lineHeight: typography.data.lineHeight + 2,
    letterSpacing: typography.data.letterSpacing * typography.data.size,
    color: palette.gold,
  },
});
