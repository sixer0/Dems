/**
 * Action layer: binds `SimActions` to one store (masterplan/01_specs.md §14.7).
 *
 * Every action reads the state, applies one pure transition at `clock.now()`, and commits the
 * result with one `setState` (nothing when the transition returns the same state).
 *
 * Errors (callers in the UI catch them and show a toast; they are programming errors or
 * disabled paths, never silent):
 * - `SimTransitionError`: a disallowed session transition (AC-52), a stop reason under 5
 *   characters, or a software update during a session;
 * - `SimNotFoundError`: an unknown evidence item or device;
 * - `SimPermissionError`: archiving without EVIDENCE_REVIEW.
 * Actions with a result type (sign-in, createSession, exportEvidence, exportAudit, pair)
 * report refusals in the result instead of throwing.
 */
import type { AudioRuntime } from './audio';
import {
  biometricFailure,
  biometricSignIn,
  passwordSignIn,
  securityKeySignIn,
  signOutTransition,
  touchTransition,
  type AuthTransition,
} from './auth';
import { applyCaptureTelemetryTransition, clearCaptureWarningTransition, feedCaptureLevels, raiseCaptureWarningTransition } from './capture-telemetry';
import { deriveDeviceState } from './derive';
import { appendActivity, verifyAuditChain } from './events';
import {
  archiveEvidenceTransition,
  exportAuditTransition,
  exportEvidenceTransition,
  verifyEvidenceTransition,
} from './evidence-actions';
import {
  acknowledgeAlertTransition,
  clearFaultTransition,
  injectFaultTransition,
  resetClipTransition,
} from './faults';
import {
  deviceCommandTransition,
  restartServicesTransition,
  runDiagnosticsTransition,
  setStoragePolicyTransition,
  startSoftwareUpdateTransition,
} from './maintenance';
import { pairTransition, unpairTransition } from './pairing';
import type { RngStreams } from './rng';
import { loadScenarioState } from './scenarios';
import {
  acknowledgePrecheckWarningsTransition,
  acknowledgeSummaryTransition,
  addMarkerTransition,
  addNoteTransition,
  beginPrecheckTransition,
  cancelTransition,
  createSessionTransition,
  recoverTransition,
  retryPrecheckTransition,
  scanCaseNumberTransition,
  snapshotTransition,
  startRecordingTransition,
  stopRecordingTransition,
} from './session-machine';
import type { SimStore } from './store';
import type {
  AuthSessionStorage,
  EpochMs,
  SettingsSlice,
  SignInResult,
  SimActions,
  SimClock,
  SimState,
} from './types';
import { FaultKind, SignOutReason, TabletLinkState } from './vocabulary';

export interface ActionContext {
  store: SimStore;
  clock: SimClock;
  authStorage: AuthSessionStorage;
  /** The engine's RNG streams (precheck, finalization, diagnostics, update draws). */
  rng: RngStreams;
  /** Transient audio state shared with the audio subsystem (test tones). */
  audio: AudioRuntime;
}

/**
 * Applies a settings patch (step 54): unknown keys and wrong types are ignored, so a stale or
 * hand-written patch can never put an invalid value in the store. No audit row: these are console
 * preferences, not evidence or device actions.
 */
export function updateSettingsPatch(state: SimState, patch: Partial<SettingsSlice>): SimState {
  const current = state.settings;
  const next: SettingsSlice = {
    presentationMode: typeof patch.presentationMode === 'boolean' ? patch.presentationMode : current.presentationMode,
    timeFormat: patch.timeFormat === '12' || patch.timeFormat === '24' ? patch.timeFormat : current.timeFormat,
    notifyWarnings: typeof patch.notifyWarnings === 'boolean' ? patch.notifyWarnings : current.notifyWarnings,
    notifySound: typeof patch.notifySound === 'boolean' ? patch.notifySound : current.notifySound,
  };
  const changed = (Object.keys(next) as (keyof SettingsSlice)[]).some((key) => next[key] !== current[key]);
  return changed ? { ...state, settings: next } : state;
}

export function createActions(context: ActionContext): SimActions {
  const { store, clock, authStorage, rng, audio } = context;

  const applyAuth = (transition: AuthTransition): SignInResult => {
    store.setState(transition.patch);
    if (transition.record === null) authStorage.clear();
    else if (transition.record) authStorage.save(transition.record);
    return transition.result;
  };

  /** Applies one pure transition at the current sim time. */
  const commit = (transition: (state: SimState, now: EpochMs) => SimState): void => {
    const state = store.getState();
    const next = transition(state, clock.now());
    if (next !== state) store.setState(next);
  };

  /** Applies a transition that also returns a result. */
  const commitWith = <R>(transition: (state: SimState, now: EpochMs) => { state: SimState; result: R }): R => {
    const state = store.getState();
    const { state: next, result } = transition(state, clock.now());
    if (next !== state) store.setState(next);
    return result;
  };

  return {
    // ── Auth (step 31) ──
    signIn: (username, password) => applyAuth(passwordSignIn(store.getState(), clock.now(), username, password)),
    signInWithBiometric: (operatorId) =>
      applyAuth(biometricSignIn(store.getState(), clock.now(), operatorId)),
    recordBiometricFailure: (operatorId) =>
      applyAuth(biometricFailure(store.getState(), clock.now(), operatorId)),
    signInWithSecurityKey: () => applyAuth(securityKeySignIn(store.getState(), clock.now())),
    signOut: (reason = SignOutReason.USER) => {
      const patch = signOutTransition(store.getState(), clock.now(), reason);
      if (patch) store.setState(patch);
      authStorage.clear();
    },
    touch: () => {
      const patch = touchTransition(store.getState(), clock.now());
      if (patch) store.setState(patch);
    },

    // ── Session machine (step 32) ──
    createSession: (input) => commitWith((state, now) => createSessionTransition(state, now, input)),
    scanCaseNumber: () => commitWith(scanCaseNumberTransition),
    beginPrecheck: () => commit((state, now) => beginPrecheckTransition(state, now, rng)),
    acknowledgePrecheckWarnings: () => commit(acknowledgePrecheckWarningsTransition),
    retryPrecheck: () => commit((state, now) => retryPrecheckTransition(state, now, rng)),
    startRecording: () => commit(startRecordingTransition),
    stopRecording: (reason) => commit((state, now) => stopRecordingTransition(state, now, reason)),
    cancel: () => commit(cancelTransition),
    recover: () =>
      commit((state, now) => {
        const powerFail = state.session?.fault?.kind === FaultKind.POWER_FAIL;
        const recovering = recoverTransition(state, now);
        // The reboot that starts recovery restores power: POWER_FAIL clears itself.
        return powerFail ? clearFaultTransition(recovering, now, FaultKind.POWER_FAIL) : recovering;
      }),
    addMarker: (label) => commit((state, now) => addMarkerTransition(state, now, label)),
    addNote: (text) => commit((state, now) => addNoteTransition(state, now, text)),
    snapshot: () => commit(snapshotTransition),
    acknowledgeSummary: (sessionId) => commit((state, now) => acknowledgeSummaryTransition(state, now, sessionId)),

    // ── Evidence and audit (step 32) ──
    verify: (evidenceId) => commitWith((state, now) => verifyEvidenceTransition(state, now, evidenceId)),
    exportEvidence: (evidenceId, request) =>
      commitWith((state, now) => exportEvidenceTransition(state, now, evidenceId, request)),
    archiveEvidence: (evidenceId) => commit((state, now) => archiveEvidenceTransition(state, now, evidenceId)),
    exportAudit: (request) => commitWith((state, now) => exportAuditTransition(state, now, request)),
    exportLogs: (request) => commitWith((state, now) => exportAuditTransition(state, now, request, 'LOGS')),
    verifyAuditChain: () => verifyAuditChain(store.getState().audit),

    // ── Faults and scenarios (step 32) ──
    inject: (kind, target) => commit((state, now) => injectFaultTransition(state, now, kind, target)),
    clearFault: (kind, target) => commit((state, now) => clearFaultTransition(state, now, kind, target)),
    resetClip: (channel) => commit((state) => resetClipTransition(state, channel)),
    acknowledgeAlert: (alertId) => commit((state) => acknowledgeAlertTransition(state, alertId)),
    loadScenario: (name) => commit((state, now) => loadScenarioState(state, name, now)),
    resetDemo: () => commit((state, now) => loadScenarioState(state, 'idle', now, { reset: true })),

    // ── Devices, storage, maintenance (step 32) ──
    runDiagnostics: () =>
      commitWith((state, now) => {
        const { state: next, runId } = runDiagnosticsTransition(state, now, rng);
        return { state: next, result: runId };
      }),
    deviceCommand: (deviceId, command) =>
      commit((state, now) => deviceCommandTransition(state, now, deviceId, command, audio)),
    setStoragePolicy: (policy) => commit((state, now) => setStoragePolicyTransition(state, now, policy)),
    startSoftwareUpdate: () => commit((state, now) => startSoftwareUpdateTransition(state, now, rng)),
    restartServices: () => commitWith(restartServicesTransition),
    setActiveCamera: (cameraId) => {
      const state = store.getState();
      if (state.activeCameraId === cameraId || !state.cameras.some((c) => c.id === cameraId)) return;
      store.setState({ activeCameraId: cameraId });
    },

    // ── Console settings (step 54) ──
    setPresentationMode: (enabled) => commit((state) => updateSettingsPatch(state, { presentationMode: enabled === true })),
    updateSettings: (patch) => commit((state) => updateSettingsPatch(state, patch)),

    // ── Pairing (step 32) and the tablet link (step 31) ──
    pair: (code) => commitWith((state, now) => pairTransition(state, now, code)),
    unpair: () => commit(unpairTransition),
    setTabletLink: (next) => {
      const state = store.getState();
      if (state.tabletLink.state === next) return;
      const now = clock.now();
      const connected = next === TabletLinkState.CONNECTED;
      store.setState(
        deriveDeviceState({
          ...state,
          ...appendActivity(state, now, {
            audit: {
              type: 'TABLET_LINK_CHANGED',
              message: connected ? 'Tablet control connected' : 'Tablet control offline — recording continues',
              severity: connected ? 'INFO' : 'WARNING',
              deviceId: 'TABLET',
              details: { state: next },
            },
            event: {
              type: connected ? 'TABLET_CONNECTED' : 'TABLET_DISCONNECTED',
              message: connected ? 'Tablet connected' : 'Tablet offline — recording continues on the Core',
              severity: connected ? 'SUCCESS' : 'WARNING',
              deviceId: 'TABLET',
            },
          }),
          tabletLink: { state: next, changedAt: now },
        }),
      );
    },

    // ── Capture telemetry and warnings (task 3, register SH-18): INTERNAL, as `setTabletLink` ──
    applyCaptureTelemetry: (telemetry) => {
      const state = store.getState();
      // The levels are transient: they reach the meters through the audio subsystem, not the store.
      feedCaptureLevels(audio, state, clock.now(), telemetry.levels);
      const next = applyCaptureTelemetryTransition(state, telemetry);
      if (next !== state) store.setState(next);
    },
    raiseCaptureWarning: (warning) => commit((state, now) => raiseCaptureWarningTransition(state, now, warning)),
    clearCaptureWarning: (warning) => commit((state, now) => clearCaptureWarningTransition(state, now, warning)),
  };
}
