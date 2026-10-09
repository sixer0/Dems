/**
 * Hash & Integrity tab in Live mode (backend task W74; 04_client_integration_spec §14 point 7,
 * §8.5 "verify", §8.1 LB-2, LB-5, LB-6; 01_specs MS-2; AC-C-61).
 *
 * **The Core server's verdict is the record.** Verify sends operation 41 `verifyEvidence` (the
 * `verify` action of `useCoreActions()`, through `settle`, in `use-core-verify.ts`) and shows its
 * `EvidenceVerifyResult` as it came: the verdict chip, the per-track list (the sealed hash and the
 * hash the Core computed), the manifest and signature checks. The custody entry is the Core's
 * (the replica holds it when the action settles, CL-16). Nothing of the verdict is computed or
 * assumed on the tablet, and no demo control is called.
 *
 * Before a verdict the tab shows the Core's sealed record from the replica (the four track hashes,
 * the manifest hash, the signature).
 *
 * **The verification the record holds** (closing-fix CF-M2, defect R-T-2; the web console's rule
 * after E2E-W1-3, `storedVerification`): the heading names the Core's state of the item, never a
 * fixed "Verified by the Core": PASS "Verified by the Core", FAIL "Verification failed on the Core",
 * NOT_RUN "Not verified yet". A line under the note names the record's last verification (result,
 * time, who: the actor of its custody entry). A new Verify replaces the heading with its own verdict
 * when that verdict is revealed; while the run is paced ("Asking the Core…", the scramble) the card
 * keeps what it showed when the run started, so the replica's delta (which arrives before the answer,
 * CL-16) never reveals the verdict early. Afterwards the line follows the record (the new run).
 *
 * **The bundled demo package** (only when the Core's media reference is `DEMO_PACKAGE`; the detail
 * passes the package the Core named, else `null`): its precomputed result is shown beside the Core's
 * verdict, labelled "Bundled demo package", for display only. It writes nothing. When it differs
 * from the Core's verdict an info Alert says so, and the Core's verdict stays the record.
 *
 * Pacing (LB-2): "Asking the Core…" spans the real request and lasts at least `VERIFY_ASK_MS`; the
 * 600 ms scramble of the Core's hashes follows (M-C-21), then the verdict pops. Both waits run on the
 * store's clock (rule 7), which in Live mode follows the Core's clock. A refusal or an outage goes to
 * the refusal presenter first; the button returns to idle and the last verdict, if any, stays.
 *
 * **Verify v2** (blueprint row 87; evidence package spec §D, §F.3; UX spec flow 5, P-16; MB-12). An
 * answer with a `files` member is a schema-v2 result (`verify-v2.ts`, the one reader of this app):
 * the card draws `VerifyV2Report` (per camera file the stored bytes, the decrypted bytes and the
 * fragment chain; the transcript hash; the manifest; the signature; the failed fragment by name and
 * the transcript state where the answer carries them). The verdict is the Core's `ok`
 * (`verdictOfAnswer`). A v2 answer has no hashes to scramble, so nothing is paced after it: the whole
 * result shows when the "asking" state ends, and no timer of this screen reveals or counts a part of
 * it. The v1 per-track rows are not marked for a v2 answer (it judges files, not tracks). The pinned
 * record line (CF-M2) is the same rule for v1 and v2.
 */
import { Alert, Button, Spinner, useToast } from 'heroui-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import type { DemoEvidencePackage } from '@dems/shared/demo-data';
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime';
import { useSimInstance, type EpochMs, type EvidenceItem } from '@dems/shared/sim';
import { StatusChip } from '@/components/kit';
import { triggerHaptic, useMotionPolicy } from '@/motion';
import { reportRuntimeIssue } from '@/runtime';
import {
  CORE_HEADING_KEYS,
  bundledDiffers,
  coreIntegrityView,
  coreVerificationState,
  packageIntegrity,
  storedVerification,
  type CoreVerdict,
  type StoredVerification,
} from './evidence-model';
import {
  CheckLine,
  CustodyLog,
  HashText,
  LifecycleStrip,
  Section,
  TrackHashRow,
  VERIFY_ASK_MS,
  VerdictLine,
  integrityStyles as styles,
} from './integrity-tab';
import { useClockDue } from './use-clock-due';
import { useCoreVerify } from './use-core-verify';
import { SCRAMBLE_MS } from './use-scramble';
import { readVerifyV2, v2FailedNames, verdictOfAnswer } from './verify-v2';
import { VerifyV2Report } from './verify-v2-report';

export interface LiveIntegrityTabProps {
  item: EvidenceItem;
  operatorNames: Readonly<Record<string, string>>;
  /** Start a verification as soon as the tab mounts (kebab "Verify"). */
  autoVerify?: boolean;
  /** The bundled package the Core named (`DEMO_PACKAGE`), else null. Display only. */
  bundled: DemoEvidencePackage | null;
}

type LivePhase = 'idle' | 'asking' | 'scrambling' | 'done';

export function LiveIntegrityTab({ item, operatorNames, autoVerify = false, bundled }: LiveIntegrityTabProps) {
  const { t } = useTranslation();
  const reduced = useMotionPolicy() === 'reduced';
  const sim = useSimInstance();
  const { toast } = useToast();
  const [phase, setPhase] = useState<LivePhase>('idle');
  /** The Core's last verdict on this screen. */
  const [verdict, setVerdict] = useState<CoreVerdict | null>(null);
  const [scrambleAt, setScrambleAt] = useState<EpochMs | null>(null);
  const [resultKey, setResultKey] = useState(0);
  const [autoPending, setAutoPending] = useState(autoVerify);
  /** The record's verification as it was when the current run started (`undefined`: no run is paced). */
  const [pinned, setPinned] = useState<StoredVerification | null | undefined>(undefined);
  const recordNow = storedVerification(item);
  const stored = pinned !== undefined ? pinned : recordNow;

  /** The run is over: the verdict is revealed, with its haptic and toast. */
  const reveal = useCallback(
    (final: CoreVerdict | null) => {
      setScrambleAt(null);
      setPhase('done');
      setPinned(undefined);
      setResultKey((k) => k + 1);
      const pass = final !== null && verdictOfAnswer(final, readVerifyV2(final)) === 'PASS';
      triggerHaptic(pass ? 'verifyPass' : 'verifyFail');
      toast.show({
        variant: pass ? 'success' : 'danger',
        label: pass ? t('features.evidence.integrity.passToast', { id: item.id }) : t('features.evidence.integrity.failToast', { id: item.id }),
      });
    },
    [item.id, t, toast],
  );
  const onVerdict = useCallback(
    (next: CoreVerdict) => {
      setVerdict(next);
      const nextV2 = readVerifyV2(next);
      if (nextV2 !== null) {
        if (nextV2.malformed.length > 0) {
          reportRuntimeIssue('warn', 'evidence.verify.v2.malformed', new Error('The verify answer carries members this client cannot read.'), {
            evidenceId: item.id,
            members: nextV2.malformed.join(','),
          });
        }
        // Row 87: a v2 answer is shown whole. There is no hash to scramble and nothing is paced.
        reveal(next);
        return;
      }
      setPhase('scrambling');
      setScrambleAt(sim.store.getState().clock.now);
    },
    [sim, reveal, item.id],
  );
  const onNoVerdict = useCallback(
    (presented: boolean) => {
      setPhase(verdict === null ? 'idle' : 'done');
      setPinned(undefined);
      if (!presented) toast.show({ variant: 'danger', label: t('features.evidence.integrity.verifyError') });
    },
    [verdict, t, toast],
  );
  const core = useCoreVerify(item.id, reduced ? 0 : VERIFY_ASK_MS, { onVerdict, onNoVerdict });
  const { run } = core;

  const verify = () => {
    if (phase === 'asking' || phase === 'scrambling') return;
    if (run()) {
      setPinned(recordNow);
      setPhase('asking');
    }
  };

  // Kebab "Verify": one request once the tab is mounted (a microtask, so a StrictMode re-run sends one).
  useEffect(() => {
    if (!autoPending) return undefined;
    let disposed = false;
    queueMicrotask(() => {
      if (disposed) return;
      setAutoPending(false);
      if (run()) {
        setPinned(storedVerification(item));
        setPhase('asking');
      }
    });
    return () => {
      disposed = true;
    };
  }, [autoPending, run, item]);

  const onScrambled = useCallback(() => reveal(verdict), [reveal, verdict]);
  useClockDue(scrambleAt, reduced ? 0 : SCRAMBLE_MS, onScrambled);

  const view = useMemo(() => coreIntegrityView(item, verdict), [item, verdict]);
  const v2 = useMemo(() => (verdict === null ? null : readVerifyV2(verdict)), [verdict]);
  /** The verdict drawn: the Core's `ok`, through the one mapping (`verdictOfAnswer`). */
  const shownVerdict = verdict === null ? null : verdictOfAnswer(verdict, v2);
  const shownFailed = v2 !== null ? v2FailedNames(v2, t) : view.failed;
  const bundledModel = useMemo(() => (bundled ? packageIntegrity(bundled) : null), [bundled]);
  const done = phase === 'done' && shownVerdict !== null;
  const busy = phase === 'asking' || phase === 'scrambling';
  // A v2 answer has no v1 tracks to compare with the bundled package: only the two verdicts are.
  const differs =
    done && verdict !== null && bundledModel !== null && (v2 !== null ? bundledModel.verdict !== v2.verdict : bundledDiffers(bundledModel, verdict));
  const headingState = coreVerificationState(stored, done ? shownVerdict : null);
  /** The v1 per-track and per-check marks belong to a v1 answer. */
  const v1Revealed = done && v2 === null;
  const lastLine = stored === null ? null : lastVerificationLine(stored, operatorNames, t);

  return (
    <View style={styles.root} testID="evidence-integrity">
      <View style={styles.verifyCard}>
        <View style={styles.verifyHead}>
          <View style={styles.verifyTitle}>
            <Text maxFontSizeMultiplier={1.2} style={styles.h3} testID={`evidence-integrity-heading-${headingState}`}>
              {t(CORE_HEADING_KEYS[headingState])}
            </Text>
            <StatusChip size="sm" tone="sealed" icon={null} label={t('features.evidence.integrity.coreLabel')} testID="evidence-integrity-label" />
          </View>
          <Button size="sm" variant={done ? 'outline' : 'primary'} isDisabled={busy} onPress={verify} testID="evidence-verify">
            {busy ? <Spinner size="sm" /> : null}
            <Button.Label>
              {busy
                ? t('features.evidence.integrity.verifying')
                : done || stored !== null
                  ? t('features.evidence.integrity.verifyAgain')
                  : t('features.evidence.integrity.verify')}
            </Button.Label>
          </Button>
        </View>
        <Text maxFontSizeMultiplier={1.2} style={styles.note}>
          {t('features.evidence.integrity.coreNote')}
        </Text>
        {lastLine !== null && stored !== null ? (
          <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID={`evidence-verify-last-${stored.status}`}>
            {lastLine}
          </Text>
        ) : null}
        {done && shownVerdict !== null ? (
          <VerdictLine verdict={shownVerdict} failed={shownFailed} done={done} resultKey={resultKey} />
        ) : stored !== null ? (
          // The per-check list belongs to a run: the record holds only the verdict (web parity).
          <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="evidence-verify-stored-hint">
            {t('evidence.verify.storedHint')}
          </Text>
        ) : (
          <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="evidence-verdict-pending">
            {t('features.evidence.integrity.coreNotRun')}
          </Text>
        )}
        {done && v2 !== null ? <VerifyV2Report answer={v2} /> : null}
        {done && bundledModel ? (
          <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID={`evidence-bundled-${bundledModel.verdict}`}>
            {t('features.evidence.integrity.bundledResult', {
              verdict: bundledModel.verdict === 'PASS' ? t('evidence.detail.integrity.pass') : t('evidence.detail.integrity.fail'),
              label: bundledModel.label,
            })}
          </Text>
        ) : null}
        {differs ? (
          <Alert status="accent" testID="evidence-bundled-differs">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{t('features.evidence.integrity.bundledDiffers')}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}
      </View>

      <Section title={t('features.evidence.integrity.trackTitle')}>
        {view.tracks.map((row) => (
          <TrackHashRow key={row.id} row={row} scrambling={phase === 'scrambling'} reduced={reduced} revealed={v1Revealed} />
        ))}
      </Section>

      <Section title={t('features.evidence.integrity.manifestHash')}>
        <HashText testID="evidence-manifest-hash" value={view.manifestHash} />
        <CheckLine row={view.checks.find((row) => row.id === 'manifest')} revealed={v1Revealed} label={t('features.evidence.integrity.checks.manifest')} />
      </Section>

      <Section title={view.signature.algorithm === 'Ed25519' ? t('features.evidence.integrity.signature') : t('features.evidence.integrity.signatureSimulated')}>
        <HashText testID="evidence-signature" value={view.signature.value} />
        <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
          {t('features.evidence.integrity.keyId')}: {view.signature.keyId}
        </Text>
        <CheckLine row={view.checks.find((row) => row.id === 'signature')} revealed={v1Revealed} label={t('features.evidence.integrity.checks.signature')} />
      </Section>

      <LifecycleStrip stage={item.lifecycleStage} />
      <CustodyLog item={item} operatorNames={operatorNames} />
    </View>
  );
}

/** "Last verification PASS · 6 Oct 2026 12:47:58 UTC+07:00 · AKP Andi Pratama" (the web's copy, shared keys). */
function lastVerificationLine(
  stored: StoredVerification,
  operatorNames: Readonly<Record<string, string>>,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const result = t(`common.verificationStatus.${stored.status}`);
  if (stored.at === null) return t('evidence.verify.last.resultOnly', { result });
  const at = `${formatDate(stored.at, DATE_PATTERNS.dateTime)} ${formatDate(stored.at, DATE_PATTERNS.zone)}`;
  if (!stored.actorKnown) return t('evidence.verify.last.noActor', { result, at });
  const actor = stored.actorId === null ? t('features.evidence.integrity.system') : (operatorNames[stored.actorId] ?? stored.actorId);
  return t('evidence.verify.last.full', { result, at, actor });
}
