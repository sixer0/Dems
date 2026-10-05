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
 * the manifest hash, the signature) and "Not verified on this screen yet".
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
 */
import { Alert, Button, Spinner, useToast } from 'heroui-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import type { DemoEvidencePackage } from '@dems/shared/demo-data';
import { useSimInstance, type EpochMs, type EvidenceItem } from '@dems/shared/sim';
import { StatusChip } from '@/components/kit';
import { triggerHaptic, useMotionPolicy } from '@/motion';
import { bundledDiffers, coreIntegrityView, packageIntegrity, type CoreVerdict } from './evidence-model';
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

  const onVerdict = useCallback(
    (next: CoreVerdict) => {
      setVerdict(next);
      setPhase('scrambling');
      setScrambleAt(sim.store.getState().clock.now);
    },
    [sim],
  );
  const onNoVerdict = useCallback(
    (presented: boolean) => {
      setPhase(verdict === null ? 'idle' : 'done');
      if (!presented) toast.show({ variant: 'danger', label: t('features.evidence.integrity.verifyError') });
    },
    [verdict, t, toast],
  );
  const core = useCoreVerify(item.id, reduced ? 0 : VERIFY_ASK_MS, { onVerdict, onNoVerdict });
  const { run } = core;

  const verify = () => {
    if (phase === 'asking' || phase === 'scrambling') return;
    if (run()) setPhase('asking');
  };

  // Kebab "Verify": one request once the tab is mounted (a microtask, so a StrictMode re-run sends one).
  useEffect(() => {
    if (!autoPending) return undefined;
    let disposed = false;
    queueMicrotask(() => {
      if (disposed) return;
      setAutoPending(false);
      if (run()) setPhase('asking');
    });
    return () => {
      disposed = true;
    };
  }, [autoPending, run]);

  const onScrambled = useCallback(() => {
    setScrambleAt(null);
    setPhase('done');
    setResultKey((k) => k + 1);
    const pass = verdict?.ok === true;
    triggerHaptic(pass ? 'verifyPass' : 'verifyFail');
    toast.show({
      variant: pass ? 'success' : 'danger',
      label: pass ? t('features.evidence.integrity.passToast', { id: item.id }) : t('features.evidence.integrity.failToast', { id: item.id }),
    });
  }, [verdict, item.id, t, toast]);
  useClockDue(scrambleAt, reduced ? 0 : SCRAMBLE_MS, onScrambled);

  const view = useMemo(() => coreIntegrityView(item, verdict), [item, verdict]);
  const bundledModel = useMemo(() => (bundled ? packageIntegrity(bundled) : null), [bundled]);
  const done = phase === 'done' && view.verdict !== null;
  const busy = phase === 'asking' || phase === 'scrambling';
  const differs = done && verdict !== null && bundledModel !== null && bundledDiffers(bundledModel, verdict);

  return (
    <View style={styles.root} testID="evidence-integrity">
      <View style={styles.verifyCard}>
        <View style={styles.verifyHead}>
          <View style={styles.verifyTitle}>
            <Text maxFontSizeMultiplier={1.2} style={styles.h3}>
              {t('features.evidence.integrity.verifiedByCore')}
            </Text>
            <StatusChip size="sm" tone="sealed" icon={null} label={t('features.evidence.integrity.coreLabel')} testID="evidence-integrity-label" />
          </View>
          <Button size="sm" variant={done ? 'outline' : 'primary'} isDisabled={busy} onPress={verify} testID="evidence-verify">
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
          {t('features.evidence.integrity.coreNote')}
        </Text>
        {view.verdict !== null ? (
          <VerdictLine verdict={view.verdict} failed={view.failed} done={done} resultKey={resultKey} />
        ) : (
          <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="evidence-verdict-pending">
            {t('features.evidence.integrity.notVerified')}
          </Text>
        )}
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
          <TrackHashRow key={row.id} row={row} scrambling={phase === 'scrambling'} reduced={reduced} revealed={done} />
        ))}
      </Section>

      <Section title={t('features.evidence.integrity.manifestHash')}>
        <HashText testID="evidence-manifest-hash" value={view.manifestHash} />
        <CheckLine row={view.checks.find((row) => row.id === 'manifest')} revealed={done} label={t('features.evidence.integrity.checks.manifest')} />
      </Section>

      <Section title={view.signature.algorithm === 'Ed25519' ? t('features.evidence.integrity.signature') : t('features.evidence.integrity.signatureSimulated')}>
        <HashText testID="evidence-signature" value={view.signature.value} />
        <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
          {t('features.evidence.integrity.keyId')}: {view.signature.keyId}
        </Text>
        <CheckLine row={view.checks.find((row) => row.id === 'signature')} revealed={done} label={t('features.evidence.integrity.checks.signature')} />
      </Section>

      <LifecycleStrip stage={item.lifecycleStage} />
      <CustodyLog item={item} operatorNames={operatorNames} />
    </View>
  );
}
