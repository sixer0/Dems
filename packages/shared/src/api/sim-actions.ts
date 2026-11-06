/**
 * The 48 actions of the shared simulator and the operation each one reaches in Live mode
 * (backend task: 2026-10-04 01_specs §7.17; plan row W27, contract C).
 *
 * 01_specs §7.17 maps every member of `SimActions` to an operation. This module is that table as
 * data, so the engine host, the Live source and the conformance test read one definition:
 *
 * | Execution | Members | Meaning |
 * |-----------|--------:|---------|
 * | `hosted` | 33 | The Core server calls the shared action under the caller's identity |
 * | `server-native` | 9 | The shared action is not called: a server module does the work (identity, pairing, the reset routine) |
 * | `not-available` | 1 | No operation exists in Live mode (`signInWithSecurityKey`, X-1: no session without a credential) |
 * | `internal` | 5 | Hosted, but no client may call it: `setTabletLink` (X-2: the server sets the link from real connections), `applyCaptureTelemetry`, `raiseCaptureWarning` and `clearCaptureWarning` (task 3, register SH-18: the server calls them from the capture supervisor's events), and `registerCaptureDevice` (task 3 R-9, C3 §2.6: the server calls it inside the unit of work of operation 96, the adoption) |
 *
 * 42 members reach an operation and together they reach 45 operations: `deviceCommand` is three
 * (one permission each), `setCaptureConfig` is three (operations 78, 79 and 80: one kind of change
 * each), and `setPresentationMode` and `updateSettings` share one. The other operations of the
 * registry are reads and server functions that no action stands for.
 *
 * The keys are held to `keyof SimActions` at compile time (a type-only import, erased when the
 * module loads), so an action added to the simulator does not compile until it has a line here.
 */
import type { CaptureConfigChange, SimActions } from '../sim/types';
import type { DeviceCommand } from '../sim/vocabulary';

export const SimActionExecution = {
  HOSTED: 'hosted',
  SERVER_NATIVE: 'server-native',
  NOT_AVAILABLE: 'not-available',
  INTERNAL: 'internal',
} as const;
export type SimActionExecution = (typeof SimActionExecution)[keyof typeof SimActionExecution];

export interface SimActionBinding {
  /** The operation IDs the action reaches: none, one, or the three of `deviceCommand`. */
  operations: readonly string[];
  execution: SimActionExecution;
}

const hosted = <const Ids extends readonly string[]>(...operations: Ids) => ({ operations, execution: SimActionExecution.HOSTED }) as const;
const serverNative = <const Ids extends readonly string[]>(...operations: Ids) =>
  ({ operations, execution: SimActionExecution.SERVER_NATIVE }) as const;

/** Every member of `SimActions`, in its order (`sim/types.ts`), with the operation it reaches. */
export const SIM_ACTION_OPERATIONS = {
  // Auth: server-native. The simulator's sign-in actions, its idle expiry and its lockout slice are not used.
  signIn: serverNative('signIn'),
  signInWithBiometric: serverNative('signInWithBiometric'),
  recordBiometricFailure: serverNative('reportBiometricFailure'),
  signInWithSecurityKey: { operations: [], execution: SimActionExecution.NOT_AVAILABLE },
  signOut: serverNative('signOut'),
  touch: serverNative('touchSession'),
  // Session machine.
  createSession: hosted('createSession'),
  beginPrecheck: hosted('beginPrecheck'),
  acknowledgePrecheckWarnings: hosted('acknowledgePrecheckWarnings'),
  retryPrecheck: hosted('retryPrecheck'),
  startRecording: hosted('startSession'),
  stopRecording: hosted('stopSession'),
  cancel: hosted('cancelSession'),
  scanCaseNumber: hosted('scanCaseNumber'),
  recover: hosted('recoverSession'),
  addMarker: hosted('addSessionMarker'),
  addNote: hosted('addSessionNote'),
  snapshot: hosted('takeSessionSnapshot'),
  acknowledgeSummary: hosted('acknowledgeSessionSummary'),
  // Evidence and audit.
  verify: hosted('verifyEvidence'),
  exportEvidence: hosted('exportEvidence'),
  archiveEvidence: hosted('archiveEvidence'),
  exportAudit: hosted('exportAudit'),
  exportLogs: hosted('exportLogs'),
  verifyAuditChain: hosted('verifyAuditChain'),
  // Faults and scenarios. A scenario load and a reset run the server's reset routine with the shared builders.
  inject: hosted('injectFault'),
  clearFault: hosted('clearFault'),
  resetClip: hosted('resetMicClip'),
  acknowledgeAlert: hosted('acknowledgeAlert'),
  loadScenario: serverNative('loadScenario'),
  resetDemo: serverNative('resetDemo'),
  // Devices, storage, maintenance.
  runDiagnostics: hosted('runDiagnostics'),
  deviceCommand: hosted('restartDevice', 'testDeviceSignal', 'identifyDevice'),
  setStoragePolicy: hosted('setStoragePolicy'),
  startSoftwareUpdate: hosted('startSoftwareUpdate'),
  restartServices: hosted('restartServices'),
  setActiveCamera: hosted('setActiveCamera'),
  // Console settings.
  setPresentationMode: hosted('updateSettings'),
  updateSettings: hosted('updateSettings'),
  // Pairing and the tablet link.
  pair: serverNative('redeemPairingCode'),
  unpair: serverNative('unpairDevice'),
  setTabletLink: { operations: [], execution: SimActionExecution.INTERNAL },
  // Capture telemetry and warnings (task 3, register SH-18 / CS-04): the supervisor's events, never a client.
  applyCaptureTelemetry: { operations: [], execution: SimActionExecution.INTERNAL },
  raiseCaptureWarning: { operations: [], execution: SimActionExecution.INTERNAL },
  clearCaptureWarning: { operations: [], execution: SimActionExecution.INTERNAL },
  // CS-09 (pass D6): the measured evidence volume of a Core in real capture operation, set by the Core at boot, never by a client.
  applyStorageVolume: { operations: [], execution: SimActionExecution.INTERNAL },
  // The capture selector and the in-session mic switch (task 3, register SH-18; C3 §2.4): hosted.
  setCaptureConfig: hosted('updateCaptureConfig', 'setCaptureCameraSource', 'setPrimaryMic'),
  switchAudioSource: hosted('switchAudioSource'),
  // The adoption of a camera (task 3 R-9; C3 §2.6): run by the server inside operation 96's unit, never by a client.
  registerCaptureDevice: { operations: [], execution: SimActionExecution.INTERNAL },
  // The registration of a `USB_AUDIO` microphone (task 4 row 185; design addendum 04 section 4.2): run by the
  // server inside operation 99's unit, never by a client. One more member and one more `internal` than the header counts.
  registerCaptureMicrophone: { operations: [], execution: SimActionExecution.INTERNAL },
  // The re-address of a registered camera (task 4 row 195, WP-12): run by the server inside operation 100's
  // unit through the engine's door, never by a client. One more member and one more `internal` again.
  readdressCaptureDevice: { operations: [], execution: SimActionExecution.INTERNAL },
  // The stored profile list of a registered camera (task 4 row V7; decision C117): run by the server inside the
  // unit that writes the list to the camera's row (operation 108's storing test), never by a client. `internal` again.
  storeCaptureDeviceProfiles: { operations: [], execution: SimActionExecution.INTERNAL },
  // The retirement of a registered camera or microphone (task 4 row RD2; design 07): run by the server inside
  // operation 111's unit (`retireCaptureDevice`), never by a client. `internal` again (52 -> 53 members).
  retireCaptureDevice: { operations: [], execution: SimActionExecution.INTERNAL },
} as const satisfies Record<keyof SimActions, SimActionBinding>;

export type SimActionName = keyof typeof SIM_ACTION_OPERATIONS;

/**
 * Which operation each `DeviceCommand` reaches (01_specs §7.10, operations 48 to 50; W83,
 * gap 3; E-12). The one table for both sides: the Live source reads the operation of a command,
 * the Core server the command of an operation. The values are `deviceCommand`'s three operations.
 *
 * Task 3 M2-W7 (C3 §0; E-12 "a new device command is a contract-table entry"): `POE_CYCLE` joins
 * the enum and reaches `restartDevice` — operation 48 decides RESTART versus PoE cycle from the
 * body and the camera's stream state (C3 §3 op 48), so the action's operation list does not grow.
 */
export const DEVICE_COMMAND_OPERATIONS = {
  RESTART: 'restartDevice',
  TEST_SIGNAL: 'testDeviceSignal',
  IDENTIFY: 'identifyDevice',
  POE_CYCLE: 'restartDevice',
} as const satisfies Record<DeviceCommand, (typeof SIM_ACTION_OPERATIONS)['deviceCommand']['operations'][number]>;

/**
 * Which operation each kind of selector change reaches (C3 §2.2 operations 78 to 80; task 3 row 66,
 * register SH-18). The one table for both sides, as `DEVICE_COMMAND_OPERATIONS` is: the Live source
 * reads the operation of a change, the Core server the kind of change an operation makes. The
 * values are `setCaptureConfig`'s three operations.
 */
export const CAPTURE_CONFIG_CHANGE_OPERATIONS = {
  UPDATE: 'updateCaptureConfig',
  CAMERA_SOURCE: 'setCaptureCameraSource',
  PRIMARY_MIC: 'setPrimaryMic',
} as const satisfies Record<CaptureConfigChange['kind'], (typeof SIM_ACTION_OPERATIONS)['setCaptureConfig']['operations'][number]>;

/** The command an operation runs, or undefined for an operation that is not one of the three. */
export function deviceCommandOfOperation(operationId: string): DeviceCommand | undefined {
  return (Object.keys(DEVICE_COMMAND_OPERATIONS) as DeviceCommand[]).find((command) => DEVICE_COMMAND_OPERATIONS[command] === operationId);
}

/** The simulator actions that reach `operationId`: none for a read or a server function. */
export function simActionsOfOperation(operationId: string): SimActionName[] {
  return (Object.keys(SIM_ACTION_OPERATIONS) as SimActionName[]).filter((name) =>
    (SIM_ACTION_OPERATIONS[name].operations as readonly string[]).includes(operationId),
  );
}
