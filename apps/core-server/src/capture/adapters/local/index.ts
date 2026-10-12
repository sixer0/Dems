/**
 * The local-device sources of the Core process (blueprint row 134: the camera; row 135: the
 * microphone). Capture spec §A.6.4, §A.7.1; R-11. Development only.
 *
 * NOT re-exported by the adapter layer's barrel. The kind `LOCAL_DEVICE`, its boot fence and its
 * registration are the capture fence's (blueprint row 136, `src/capture/fence/`), which imports
 * what it needs from here and is the only importer.
 */
export { createLocalCameraAdapter, type LocalCameraAdapter, type LocalCameraAdapterOptions } from './camera-adapter';
export { CAMERA_HELPER_LIMITS, createCameraHelpers, diagnoseHelperOutput, errorOfHelperExit, type CameraHelperLimits, type CameraHelperOptions, type CameraHelpers, type OpenCameraHelper } from './camera-helper';
export {
  CAMERA_HELPER_TABLE,
  CameraHelperArgumentError,
  CameraHelperEncoder,
  LOCAL_CAMERA_DEVICE_NAME,
  LOCAL_CAMERA_FRAME_RATE,
  LOCAL_CAMERA_GOP_FRAMES,
  LOCAL_CAMERA_PROFILE,
  cameraPrecheckArguments,
  cameraPushArguments,
  deviceListArguments,
  isLoopbackIngest,
  type CameraPushArguments,
} from './camera-helper-args';
export { LOCAL_DEVICE_NAME_MAX, isUsableDeviceName, parseDeviceList, selectLocalDevice, type DeviceSelection, type LocalDeviceList } from './device-list';
export { LocalSourceError, LocalSourceErrorCode, LocalSourceErrorReason } from './errors';
export { HelperProgramRefusal, helperProgramRefusal } from './helper-program';
export { LEFTOVER_CANDIDATE_LIMIT, leftoverHelperPids, leftoverPrograms, linuxProgramPathReader, processShortName, programPathReaderFor, type LeftoverProcess, type ProgramPathReader } from './leftover';
export { createLocalMicAdapter, type LocalMicAdapter, type LocalMicAdapterOptions } from './mic-adapter';
export { MIC_HELPER_LIMITS, createMicHelper, type LocalMicStream, type MicHelper, type MicHelperLimits, type MicHelperOptions, type MicPrepareRequest } from './mic-helper';
export { LOCAL_MIC_DEVICE_NAME, MIC_HELPER_TABLE, MicGeneratedTone, MicHelperArgumentError, SPEECH_FIXTURE_SUBPATH, isMicPipeArgument, isSpeechFixtureArgument, micPrecheckArguments, micPushArguments, speechFixturePath, type MicSource } from './mic-helper-args';
export type { PipeFiles } from './pipe-files';
export { FILE_HEAD_MAX_BYTES, readFileHead, type FileHeadReader } from './process-door';
export { HELPER_OUTPUT_CAP_BYTES, inspectProgram, startHelperProcess, type HelperDoor, type HelperExit, type HelperProcess, type HelperProcessOptions, type PathStepFacts, type ProgramFacts, type ProgramInspector } from './process-door';
