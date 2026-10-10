/**
 * The adapter layer of the Core process (blueprint row 65 / M4-W1; register NM-01, NM-09, NM-10;
 * capture spec §A.1, §A.1.1, §A.6, §A.7).
 *
 * WHAT IT OWNS: the three adapter seams (`CameraAdapter`, `PoeController`, `AudioInputAdapter`),
 * the vocabulary of adapter kinds and source classes, the device registry with its refusal rules,
 * the in-memory fakes, the camera-credential and stream-locator handling (SEC35-04), the
 * statement of the microphone transport, and the seam each device command reaches.
 *
 * WHAT IT DOES NOT DO (so nobody reads more into it than is there):
 *   - it is not registered in the app: no seam, no route, no boot step. The selector module and
 *     the plan builder (row 66) and the session wiring (row 71) build a registry and use it;
 *   - it opens no socket, starts no process and writes no file. Search: row 131. Connection test
 *     and adoption: row 142. Local camera and microphone: rows 134 to 136;
 *   - the production adapters are class C: interface-complete stubs behind `real.ts`, which this
 *     barrel does NOT re-export, so that importing the layer never loads them.
 */
export { CAPTURE_DEVICE_COMMANDS, SEAM_OF_DEVICE_COMMAND, operationOfDeviceCommand, type CaptureCommandSeam, type CaptureDeviceCommand } from './commands';
export {
  CREDENTIAL_MARK,
  SealedCredential,
  blankCredentialLocators,
  credentialAtInjection,
  credentialFreeLocator,
  sealCredential,
  streamLocator,
  usingCredential,
  type CameraCredential,
  type InjectedStreamAccess,
} from './credential';
export { CaptureAdapterError, CaptureAdapterRefusal } from './errors';
export {
  FAKE_CAMERA_PROFILE,
  FAKE_CAMERA_SECOND_PROFILE,
  FAKE_MIC_PRIMARY_DBFS,
  FAKE_MIC_STANDBY_DBFS,
  FakeTopology,
  createFakeAudioInputAdapter,
  createFakeCameraAdapter,
  createFakePoeController,
  createFakeRegistry,
  type FakeAudioInputAdapter,
  type FakeAudioOptions,
  type FakeCameraAdapter,
  type FakeCameraOptions,
  type FakePoeController,
  type FakePoeOptions,
  type FakeRegistry,
  type FakeRegistryOptions,
} from './fake';
export {
  CAPTURE_ADAPTER_KINDS,
  CaptureAdapterKind,
  CaptureOperation,
  CaptureSourceClass,
  registrableKindsOf,
  sourceClassOf,
  sourceClassOfOperation,
  type CaptureDeviceClass,
} from './kinds';
export {
  MIC_CLOCK_COMPENSATION_PPM,
  MIC_LATENESS_TARGET_MS,
  MIC_TRANSPORTS,
  MIC_WORKER_BUFFER_CAP_MS,
  micPipePath,
  micTransportOf,
  withinMicClockRange,
  type MicTransportStatement,
} from './mic-transport';
export { OPENER_CAPABLE_KINDS, createCaptureDeviceRegistry, type CaptureDeviceRegistryOptions } from './registry';
export {
  AudioInputErrorCode,
  ConnectionTestOutcome,
  PoePortStatus,
  type AudioInputAdapter,
  type AudioInputDescriptor,
  type AudioOpenTarget,
  type AudioStreamHandle,
  type CameraAdapter,
  type CameraCandidate,
  type CameraSourceTarget,
  type CaptureAdapter,
  type CaptureAdapterOf,
  type CaptureCapability,
  type CaptureDeviceDescriptor,
  type CaptureDeviceEntry,
  type CaptureDeviceRegistry,
  type ConnectionTestResult,
  type DiscoveryResult,
  type DiscoverySearch,
  type MediaProfile,
  type PoeController,
  type SourceHandle,
} from './types';
// The search half of the camera adapter (blueprint row 131; exported by row 132, which owns this
// barrel line and is the one caller of `discover`: static rule G-R13). Importing the barrel loads
// the datagram module and the XML parser; neither opens a socket before `discover()` is called.
export { createOnvifDiscoveryAdapter, type OnvifDiscoveryAdapter } from './camera/onvif-discovery';
export { DiscoveryNotRun, DiscoveryNotRunError, WS_DISCOVERY_GROUP, type WsDiscoveryCounts, type WsDiscoveryOptions, type WsDiscoveryResult } from './camera/ws-discovery';
export type { OnvifCandidate, RegisteredLookup, RegisteredMatch } from './camera/discovery-collector';
// The connection test of a candidate camera (blueprint row 142; exported by row 132, which owns
// this barrel line). Importing the barrel loads the HTTP modules and the ONVIF client's file;
// no connection is opened before `test()` is called.
export { connectionTargetOf } from './camera/connection-target';
export { ONVIF_SESSION_LIMITS, OnvifTestReason, createOnvifConnectionTester, type OnvifConnectionTester, type OnvifConnectionTesterOptions, type OnvifSessionResult } from './camera/onvif-session';
