/**
 * The notice with a confirm step before a pre-check turns on the Core Mac's camera or microphone
 * (fix pass F-M4; review R69-01; decisions D163, D178), for the tablet and the phone.
 *
 * | Piece | What it does |
 * |---|---|
 * | `useLocalSourceGate()` | `ask(send, cancelled)`: when the selector names no local device (`localSourceNoticeOf`, read from the store at the press) `send` runs at once, exactly as before. Otherwise NOTHING is sent: the notice opens; Confirm runs `send`, "Not now" (or closing the dialog) runs `cancelled`. One notice per `ask`, so every press asks once |
 * | `LocalSourceNoticeDialog` | the kit `Dialog` (the pattern of the session flow's own confirmations): the title, the device(s) by id, "Nothing is sent to the Core until you confirm", Confirm and "Not now". It is portalled, so it reads no store: everything comes from the gate |
 * | `LocalSourceNotStarted` | a session left in CREATE (a relaunch, a resume) is never checked by itself: this line says so and offers "Run the device check", which goes through the same gate |
 *
 * Decision D181, ruling 7: the same gate and the same dialog also stand in front of START RECORDING
 * (`ask(send, cancelled, 'START')`), with the wording of `common.localSourceStartNotice` ("... keep it
 * on until the recording ends"). The gate keeps NO memory of an earlier answer: every `ask` asks, so a
 * confirmed pre-check never counts for the start.
 *
 * Decision D184: the operator consents FIRST, then the 3-2-1 countdown runs, then the start is sent.
 * So the screen asks at the press (`consent('START', proceed)`), and the gate at the sender stays as
 * defence in depth. To ask once per press, a Confirm given through `consent` leaves a ONE-SHOT grant:
 * the next `ask` of the same kind consumes it and sends without a second notice. The grant is never
 * remembered beyond that one send: `discard()` drops it (a cancelled countdown), the next `consent`
 * drops a stale one, and a send that reaches `ask` with no grant opens the notice there.
 *
 * Fix wave H (gate 70 finding G70-08; ruling D196): the rule FAILS CLOSED. While the client does not
 * know the device classes of the selector's lines (`localSourcesKnown`: the list is not loaded, in
 * error, stale after a reconnect, or misses a device a line names) the gate sends NOTHING: `ask` runs
 * `cancelled`, `consent` does not proceed, an unused grant is dropped, and one line says "Checking the
 * capture sources…". `checking` is the same fact for the screen, which disables its pre-check and
 * start controls with that reason (`LocalSourcesChecking` draws it). Before, a press went straight
 * through: "no local device found" was read as "no local device".
 *
 * The rule is the client's only; the Core does not require the confirmation. In Simulated mode, and
 * on a selector without a local device, none of this is ever drawn.
 *
 * Error handling: the notice sends nothing itself. A `send` or `cancelled` that throws is written to
 * the persistent runtime log and the notice closes, so the screen stays usable; what `send` starts
 * keeps its own three-layer handling (`use-session-new.ts`).
 */
import { Alert, Button, Dialog, useToast } from 'heroui-native';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { liveLinkOf, useLiveLink } from '@dems/shared/live';
import { useSim, useSimInstance } from '@dems/shared/sim';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { reportRuntimeIssue } from '@/runtime';
import { useSourceBadgeMode } from './development-source-badge';
import {
  localSourceNoticeBlock,
  localSourceNoticeKey,
  localSourceNoticeLine,
  localSourceNoticeOfState,
  localSourcesKnownOfState,
  parseLocalSourceNoticeLine,
  type LocalSourceNotice,
  type LocalSourceNoticeKind,
} from './local-source-notice-model';

const SOURCE = 'features.captureSelector.localSourceNotice';

export interface LocalSourceGate {
  /**
   * `send` at once when a pre-check opens no local device; else the notice, and `send` only on
   * Confirm. `cancelled` runs when the operator declines (release a pending control there).
   */
  ask(send: () => void, cancelled: () => void, kind?: LocalSourceNoticeKind): void;
  /**
   * Asks at the press, before anything else happens (D184): `proceed` at once when no local device is
   * named; else the notice, and on Confirm a one-shot grant for the next `ask(kind)` and `proceed`. A
   * decline does nothing. A grant left by an earlier press is dropped first.
   */
  consent(kind: LocalSourceNoticeKind, proceed: () => void): void;
  /** Drops an unused grant (the countdown was cancelled, the flow stopped): the next send asks again. */
  discard(): void;
  /**
   * Fix wave H (G70-08): the device classes are not known (yet), so the gate sends nothing. The
   * screen disables its pre-check and start controls with "Checking the capture sources…".
   */
  readonly checking: boolean;
  /** The open notice, or null. */
  readonly notice: LocalSourceNotice | null;
  /** What the open notice is about (`PRECHECK` while none is open). */
  readonly kind: LocalSourceNoticeKind;
  confirm(): void;
  cancel(): void;
}

interface Held {
  readonly notice: LocalSourceNotice;
  readonly kind: LocalSourceNoticeKind;
  readonly send: () => void;
  readonly cancelled: () => void;
  /** Confirm leaves the one-shot grant (the notice came from `consent`). */
  readonly grants: boolean;
}

/** Runs a continuation of the gate; a throw is logged (persistent runtime log), never raised into a press handler. */
function run(step: string, continuation: () => void, notice: LocalSourceNotice, kind: LocalSourceNoticeKind): void {
  try {
    continuation();
  } catch (error) {
    reportRuntimeIssue('error', `${SOURCE}.${step}`, error, { kind, camera: notice.camera, microphone: notice.microphone });
  }
}

/** Whether the device classes are NOT known now (fix wave H, G70-08); always false in Simulated client mode. */
export function useLocalSourcesChecking(): boolean {
  const { live } = useSourceBadgeMode();
  const link = useLiveLink();
  return !useSim((s) => localSourcesKnownOfState(s, live, link));
}

export function useLocalSourceGate(): LocalSourceGate {
  const sim = useSimInstance();
  const { live } = useSourceBadgeMode();
  const { t } = useTranslation();
  const { toast } = useToast();
  const checking = useLocalSourcesChecking();
  const [held, setHeld] = useState<Held | null>(null);
  // The same value for the callbacks, which must see an answer given in the same turn (a double press).
  const heldRef = useRef<Held | null>(null);
  const hold = useCallback((next: Held | null) => {
    heldRef.current = next;
    setHeld(next);
  }, []);

  // The one-shot grant of a consent given at the press (D184); a ref, so the sender reads it in the same turn.
  const grant = useRef<LocalSourceNoticeKind | null>(null);

  /**
   * G70-08, at the press: true when the classes are unknown. Nothing is sent then - the request is
   * declined, said (one toast) and logged (persistent runtime log); the screen stays usable.
   */
  const refusedUnknown = useCallback(
    (cancelled: () => void, kind: LocalSourceNoticeKind): boolean => {
      const link = liveLinkOf(sim);
      if (localSourcesKnownOfState(sim.store.getState(), live, link)) return false;
      grant.current = null;
      reportRuntimeIssue('warn', `${SOURCE}.unknown`, 'The device classes of the selector are not known: nothing was sent', { kind, link });
      toast.show({ variant: 'warning', label: t('features.capture-selector.localSources.checking') });
      run('unknown', cancelled, { camera: null, microphone: null }, kind);
      return true;
    },
    [sim, live, toast, t],
  );

  const open = useCallback(
    (send: () => void, cancelled: () => void, kind: LocalSourceNoticeKind, grants: boolean): void => {
      if (refusedUnknown(cancelled, kind)) return;
      const notice = localSourceNoticeOfState(sim.store.getState(), live);
      if (notice === null) {
        send();
        return;
      }
      // A notice is already open: this request is declined, the open one stays (nothing is sent twice).
      if (heldRef.current !== null) {
        run('declined', cancelled, notice, kind);
        return;
      }
      reportRuntimeIssue('info', `${SOURCE}.shown`, 'The command would turn on a local device: asked before sending', { kind, camera: notice.camera, microphone: notice.microphone });
      hold({ notice, kind, send, cancelled, grants });
    },
    [sim, live, hold, refusedUnknown],
  );

  const ask = useCallback(
    (send: () => void, cancelled: () => void, kind: LocalSourceNoticeKind = 'PRECHECK'): void => {
      // Consent was given at the press for exactly this send: consumed here, never kept.
      if (grant.current === kind) {
        // G70-08: a consent does not carry a send through a list that became unknown since.
        if (refusedUnknown(cancelled, kind)) return;
        grant.current = null;
        send();
        return;
      }
      open(send, cancelled, kind, false);
    },
    [open, refusedUnknown],
  );

  const consent = useCallback(
    (kind: LocalSourceNoticeKind, proceed: () => void): void => {
      grant.current = null;
      open(proceed, () => undefined, kind, true);
    },
    [open],
  );

  const discard = useCallback(() => {
    grant.current = null;
  }, []);

  const confirm = useCallback(() => {
    const current = heldRef.current;
    if (current === null) return;
    hold(null);
    reportRuntimeIssue('info', `${SOURCE}.confirmed`, 'The operator confirmed turning on a local device', { kind: current.kind, camera: current.notice.camera, microphone: current.notice.microphone });
    if (current.grants) grant.current = current.kind;
    run('confirmed', current.send, current.notice, current.kind);
  }, [hold]);

  const cancel = useCallback(() => {
    const current = heldRef.current;
    if (current === null) return;
    hold(null);
    reportRuntimeIssue('info', `${SOURCE}.declined`, 'The operator declined: nothing was sent', { kind: current.kind, camera: current.notice.camera, microphone: current.notice.microphone });
    run('declined', current.cancelled, current.notice, current.kind);
  }, [hold]);

  return { ask, consent, discard, checking, notice: held?.notice ?? null, kind: held?.kind ?? 'PRECHECK', confirm, cancel };
}

/** The notice a pre-check started now would need, or null — for a line that is drawn, not for a press (a press reads the store itself). */
export function useLocalSourceNotice(): LocalSourceNotice | null {
  const { live } = useSourceBadgeMode();
  return parseLocalSourceNoticeLine(useSim((s) => localSourceNoticeLine(s, live)));
}

/**
 * "Checking the capture sources…" (fix wave H, G70-08): the visible reason of a pre-check or start
 * control that is disabled because the device classes are not known. Nothing while they are known.
 */
export function LocalSourcesChecking({ checking, testID = 'local-sources-checking' }: { checking: boolean; testID?: string }) {
  const { t } = useTranslation();
  if (!checking) return null;
  return (
    <Text maxFontSizeMultiplier={1.2} style={styles.checking} testID={testID} accessibilityLiveRegion="polite">
      {t('features.capture-selector.localSources.checking')}
    </Text>
  );
}

/** The accessibility hint of such a control: the same sentence, or nothing. */
export function useLocalSourcesCheckingHint(checking: boolean): { accessibilityHint?: string } {
  const { t } = useTranslation();
  return checking ? { accessibilityHint: t('features.capture-selector.localSources.checking') } : {};
}

export interface LocalSourceNoticeDialogProps {
  gate: LocalSourceGate;
}

/** The confirm step. Closed (and nothing drawn) while the gate holds no notice. */
export function LocalSourceNoticeDialog({ gate }: LocalSourceNoticeDialogProps) {
  const { t } = useTranslation();
  // The last notice (and its kind) stays drawn while the dialog closes.
  const [shown, setShown] = useState<LocalSourceNotice | null>(gate.notice);
  const [shownKind, setShownKind] = useState<LocalSourceNoticeKind>(gate.kind);
  if (gate.notice !== null && gate.notice !== shown) {
    setShown(gate.notice);
    setShownKind(gate.kind);
  }
  const kind = gate.notice !== null ? gate.kind : shownKind;
  const block = localSourceNoticeBlock(kind);
  return (
    <Dialog isOpen={gate.notice !== null} onOpenChange={(open) => (open ? undefined : gate.cancel())}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content testID={kind === 'START' ? 'local-source-start-notice' : 'local-source-notice'}>
          <Dialog.Title>{t(`${block}.title`)}</Dialog.Title>
          {shown === null ? null : (
            <Dialog.Description testID="local-source-notice-devices">
              {t(localSourceNoticeKey(shown, kind), { camera: shown.camera ?? '', microphone: shown.microphone ?? '' })}
            </Dialog.Description>
          )}
          <Dialog.Description>{t(`${block}.body`)}</Dialog.Description>
          <View style={styles.actions}>
            <Button testID="local-source-notice-confirm" variant="primary" onPress={gate.confirm}>
              <Button.Label>{t(`${block}.confirm`)}</Button.Label>
            </Button>
            <Button testID="local-source-notice-cancel" variant="outline" onPress={gate.cancel}>
              <Button.Label>{t(`${block}.cancel`)}</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

export interface LocalSourceNotStartedProps {
  /** A session waits in CREATE and no command of the screen is out. */
  visible: boolean;
  /** Starts the check through the gate (the same handler as the step's own control). */
  onRun: () => void;
}

/** "The device check was not started again by itself ..." with its control; nothing unless the selector names a local device. */
export function LocalSourceNotStarted({ visible, onRun }: LocalSourceNotStartedProps) {
  const { t } = useTranslation();
  const notice = useLocalSourceNotice();
  // Fix wave H (G70-08): the check is not offered while the device classes are unknown.
  const checking = useLocalSourcesChecking();
  const checkingHint = useLocalSourcesCheckingHint(checking);
  if (!visible || notice === null) return null;
  return (
    <Alert status="warning" testID="local-source-not-started">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{t('common.localSourceNotice.notStarted')}</Alert.Description>
        <View style={styles.run}>
          <Button variant="outline" size="sm" isDisabled={checking} onPress={onRun} testID="local-source-run-check" {...checkingHint}>
            <Button.Label>{t('common.localSourceNotice.runCheck')}</Button.Label>
          </Button>
        </View>
        <LocalSourcesChecking checking={checking} testID="local-source-run-check-checking" />
      </Alert.Content>
    </Alert>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing[1], marginTop: spacing[3] },
  run: { flexDirection: 'row', marginTop: spacing[1] },
  checking: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.gray },
});
