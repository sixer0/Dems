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
 *
 * **Wave H C2** (gate findings G89-03 / G81-02 MAJOR, G89-04, G89-05, G89-09).
 * - The rows under the card are THE ITEM'S OWN members. An item whose package this Core sealed
 *   (`item-facts.ts` `hasSealedPackageHere`, or an item that carries sealed `files`) lists its own
 *   camera files with their sealed hashes - before a verify run too - and never the four v1 track
 *   rows (a v2 package has no AUDIO-01 / AUDIO-02 file). A v1 demo item keeps the four rows and
 *   says "Sources: not recorded (v1 package)".
 * - The signature is named by what the item says of it: a REAL signature (`simulated === false`)
 *   reads "Manifest signature (Ed25519, Core key ...)" and is NEVER called simulated or demo; its
 *   only qualifier is the development-key line, from the item's `signature.developmentKey` or from
 *   the verify run of this screen; a key class nobody reported reads "not reported". A simulated
 *   signature keeps "Signature (simulated)".
 * - The bundled-package line is drawn only for the package of a demo item: the detail passes
 *   `bundled` for nothing else (G89-09).
 *
 * **Per-pair audio** (audit 2026-11-05 row 207, M3-16 R1/R2/R4; E7, E8, E10). The AUDIO-0N files of a
 * `/2.1` item are listed apart from the camera files, under "Audio files of the camera-microphone pairs",
 * each "AUDIO-0N · audio of Pair N, in VIDEO-0N" with its own hash (`PairAudio`); the item's signed
 * `audioTracksMissing` statement follows. The camera rows (`evidence-sealed-file-VIDEO-0N`) are unchanged,
 * and a legacy item (no AUDIO-0N file, no statement) draws exactly what it drew before.
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
import { hasSealedPackageHere, isDemoItem, isRealItem, readItemFacts, signingKeyClassOf } from './item-facts';
import { readItemV2 } from './item-v2';
import { PairAudio } from './pair-audio';
import { useClockDue } from './use-clock-due';
import { useCoreVerify } from './use-core-verify';
import { SCRAMBLE_MS } from './use-scramble';
import { V2_SIGNING_KEY_LINE, readVerifyV2, v2FailedNames, verdictOfAnswer, type VerifyV2Answer } from './verify-v2';
import { VerifyV2Report } from './verify-v2-report';

export interface LiveIntegrityTabProps {
  item: EvidenceItem;
  operatorNames: Readonly<Record<string, string>>;
  /** Start a verification as soon as the tab mounts (kebab "Verify"). */
  autoVerify?: boolean;
  /** The bundled package the Core named (`DEMO_PACKAGE`), else null. Display only. */
  bundled: DemoEvidencePackage | null;
  /** Row 92: called with the v2 reading of each verdict the Core gives on this tab (null for a v1 answer). */
  onV2Answer?: (answer: VerifyV2Answer | null) => void;
}

type LivePhase = 'idle' | 'asking' | 'scrambling' | 'done';

export function LiveIntegrityTab({ item, operatorNames, autoVerify = false, bundled, onV2Answer }: LiveIntegrityTabProps) {
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
      // Row 92: the screen keeps what this run said of the sources and the failed fragments (never the device list).
      onV2Answer?.(nextV2);
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
    [sim, reveal, item.id, onV2Answer],
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
  // Wave H C2: the item's own facts decide the rows and the signature wording.
  const facts = useMemo(() => readItemFacts(item), [item]);
  const itemV2 = useMemo(() => readItemV2(item), [item]);
  /** A package this Core sealed: its own files are listed, never the v1 track rows (G89-04, G89-09). */
  const sealedHere = hasSealedPackageHere(facts) || isRealItem(facts) || itemV2.isV2;
  /** Row 207 (M3-16 R1): the pair audio files are listed apart (`PairAudio`), never as a "sealed file" of the camera list. */
  const pairAudioIds = new Set<string>(itemV2.pairAudioFiles.map((audio) => audio.trackId));
  const sealedFiles: readonly { readonly trackId: string; readonly sha256: string | null }[] =
    itemV2.files.length > 0
      ? itemV2.files.filter((file) => !pairAudioIds.has(file.trackId))
      : item.tracks.map((track) => ({ trackId: track.trackId, sha256: track.sha256 }));
  const signature = facts.signature;
  const verifiedKeyLine = done && v2 !== null && (v2.signingKey === 'DEVELOPMENT' || v2.signingKey === 'NOT_ESTABLISHED') ? v2.signingKey : null;
  /** The key class of a REAL signature, from the item or this screen's verify run; null: no line (simulated, or said by the verify line). */
  const keyClass = signature !== null && !signature.simulated && verifiedKeyLine === null ? signingKeyClassOf(signature, done && v2 !== null ? v2.signingKey : null) : null;
  const signatureTitle =
    signature === null
      ? t('evidence.itemFacts.signature.notReported')
      : signature.simulated
        ? t('features.evidence.integrity.signatureSimulated')
        : t('evidence.itemFacts.signature.real', { algorithm: signature.algorithm, key: signature.keyId });

  return (
    <View style={styles.root} testID="evidence-integrity">
      <View style={styles.verifyCard}>
        <View style={styles.verifyHead}>
          <View style={styles.verifyTitle}>
            <Text maxFontSizeMultiplier={1.2} style={styles.h3} testID={`evidence-integrity-heading-${headingState}`}>
              {t(CORE_HEADING_KEYS[headingState])}
            </Text>
            <StatusChip size="sm" tone="sealed" icon={null} label={t('features.evidence.integrity.coreLabel')} testID="evidence-integrity-label" />
            {/* Fix wave J (JA2-02, truth rules 3a / 3f; contract_wave_j.md J-S 2): a verdict the simulator computed says so -
                the hashes of a demonstration record were compared, no stored media was read. Never a bare "Verified". */}
            {verdict?.demonstration === true ? (
              <StatusChip size="sm" tone="warning" icon={null} label={t('common.truth.demonstrationChip')} testID="evidence-integrity-demonstration" />
            ) : null}
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
        {/* G89-05: a v1 package records no source class - said where a v2 result states its sources. */}
        {!sealedHere && isDemoItem(facts) ? (
          <Text maxFontSizeMultiplier={1.2} style={styles.caption} accessibilityRole="text" testID="evidence-sources-v1">
            {t('common.sourceClass.verify.v1')}
          </Text>
        ) : null}
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

      {sealedHere ? (
        <Section title={t('evidence.itemFacts.sealed.title')} testID="evidence-sealed-values">
          <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
            {t('evidence.itemFacts.sealed.note')}
          </Text>
          {sealedFiles.length === 0 ? (
            <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="evidence-sealed-no-files">
              {t('evidence.itemFacts.sealed.noFiles')}
            </Text>
          ) : (
            sealedFiles.map((file) => (
              <View key={file.trackId} testID={`evidence-sealed-file-${file.trackId}`}>
                <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
                  {t('evidence.itemFacts.sealed.file', { track: file.trackId })}
                </Text>
                <HashText value={file.sha256 ?? t('evidence.itemFacts.notReported')} />
              </View>
            ))
          )}
          <PairAudio item={itemV2} />
        </Section>
      ) : (
        <Section title={t('features.evidence.integrity.trackTitle')}>
          {view.tracks.map((row) => (
            <TrackHashRow key={row.id} row={row} scrambling={phase === 'scrambling'} reduced={reduced} revealed={v1Revealed} />
          ))}
        </Section>
      )}

      <Section title={t('features.evidence.integrity.manifestHash')}>
        <HashText testID="evidence-manifest-hash" value={view.manifestHash} />
        <CheckLine row={view.checks.find((row) => row.id === 'manifest')} revealed={v1Revealed} label={t('features.evidence.integrity.checks.manifest')} />
      </Section>

      <Section title={signatureTitle} titleTestID="evidence-signature-title">
        <HashText testID="evidence-signature" value={view.signature.value} />
        <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
          {t('features.evidence.integrity.keyId')}: {view.signature.keyId}
        </Text>
        {/* Fix pass F-M7 (R88-07): which key signed, as the Core answered it for this item (operation 41). The item itself carries no such member: before a verification nothing is said here. */}
        {done && v2 !== null && (v2.signingKey === 'DEVELOPMENT' || v2.signingKey === 'NOT_ESTABLISHED') ? (
          <Text maxFontSizeMultiplier={1.2} style={styles.caption} accessibilityRole="text" testID={`evidence-signature-key-${v2.signingKey}`}>
            {t(V2_SIGNING_KEY_LINE[v2.signingKey])}
          </Text>
        ) : null}
        {keyClass === 'DEVELOPMENT' || keyClass === 'UNKNOWN' ? (
          <Text maxFontSizeMultiplier={1.2} style={styles.caption} accessibilityRole="text" testID={`evidence-signature-key-class-${keyClass}`}>
            {t(keyClass === 'DEVELOPMENT' ? 'evidence.itemFacts.signature.developmentKey' : 'evidence.itemFacts.signature.keyClassUnknown')}
          </Text>
        ) : null}
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
