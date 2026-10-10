/**
 * The development-source label of the web console: which devices carry it, and from which data
 * (task 3, R-11, blueprint row 137; `masterplan/08_client_ux_spec.md` §8f flow 12; decisions D83,
 * D91 ruling R-2 option A). Kept in a `.ts` module so the badge file exports only components.
 *
 * | Rule | Where |
 * |------|-------|
 * | Decided by the Core: the badge is drawn only from a `sourceClass` the Core sent. No switch, no filter, no local rule ("a loopback address means development") | `isDevelopmentSource` |
 * | `adapter` and `sourceClass` are OPTIONAL members of a capture device. Absent = no badge | `isDevelopmentSource` |
 * | Only in real capture, never in Simulated client mode, where the mode banner already says it (D83, D91) | `useRealCapture` |
 * | One wording everywhere; the kind is a secondary text | `sourceKindKey` |
 *
 * **What "real capture" is here.** The console knows two data modes: Live (a Core server) and
 * Simulated (the in-app simulator). The badge is drawn in Live mode only. A Core that itself runs
 * simulated capture is told apart by its data, not by the console: such a Core sends no
 * `sourceClass` for its built-in devices (C3 §2.6, contract note of row 132), so nothing is drawn.
 * Operation 71, which names the demo state, needs `DEMO_CONTROL` and cannot be read by every role,
 * so it is not the source of this rule (recorded for the controller in the row's note).
 */
import { CaptureSourceClass } from '@dems/shared/api'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { VideoTrackId } from '@dems/shared/domain'
import { useSim } from '@dems/shared/sim'
import { micInputName } from '@/lib/capture-notices'
import { useWebLive } from '@/runtime'
import type { CaptureDevice } from './capture-selector'

/** The adapter kinds of a development source (C3 §2.6 "Device shapes"). */
export const LOCAL_DEVICE_ADAPTER = 'LOCAL_DEVICE'
export const TEST_SOURCE_ADAPTER = 'FAKE'

export type SourceDeviceKind = 'CAMERA' | 'MIC'

/** Whether the console shows data of real capture: Live mode. False in Simulated client mode (D83). */
export function useRealCapture(): boolean {
  return useWebLive() !== null
}

/**
 * Whether the Core this console shows RECORDS FOR REAL (wave H, G70-03; ruling D196); pure. The
 * console has no operation that names the Core's capture operation for every role, so it is told
 * apart by the Core's data, the rule of this file's header: a Core in real capture states the class
 * of its sources (`sourceClass`, DEVELOPMENT or PRODUCTION), a Core in simulated capture states none
 * for its built-in devices (D91, D131). A Live console that holds NO device (the list not received
 * yet, or a Core without a source) has nothing that says "simulated", so it counts as real capture:
 * the neutral side - no demo picture is drawn on a guess. Never true in Simulated client mode.
 */
export function isRealCaptureCore(live: boolean, devices: readonly { readonly sourceClass?: string | null | undefined }[]): boolean {
  if (!live) return false
  return devices.length === 0 || devices.some((device) => device.sourceClass != null)
}

/** `isRealCaptureCore` of the console's data: Live mode and the replicated `captureDevices` slice. */
export function useRealCaptureCore(): boolean {
  const live = useRealCapture()
  const stated = useSim((state) => isRealCaptureCore(true, state.captureDevices.devices))
  return live && stated
}

/** True exactly when the Core sent `sourceClass: DEVELOPMENT`. An absent member is not a development source. */
export function isDevelopmentSource(source: { readonly sourceClass?: string | null } | null | undefined): boolean {
  return source?.sourceClass === CaptureSourceClass.DEVELOPMENT
}

/** The text key of the kind beside the badge; `null` for an adapter this build has no word for (the badge still stands). */
export function sourceKindKey(
  adapter: string | null | undefined,
  kind: SourceDeviceKind,
): 'common.sourceClass.kind.localCamera' | 'common.sourceClass.kind.localMicrophone' | 'common.sourceClass.kind.test' | null {
  if (adapter === LOCAL_DEVICE_ADAPTER) return kind === 'CAMERA' ? 'common.sourceClass.kind.localCamera' : 'common.sourceClass.kind.localMicrophone'
  if (adapter === TEST_SOURCE_ADAPTER) return 'common.sourceClass.kind.test'
  return null
}

/**
 * The 'is on' fact of a local device (C3 §2.6 erratum PE-128-38, SEC35-44 (4)): `sourceOpen: true`
 * while the Core holds this Mac's camera or microphone open. An OPTIONAL member of a device of the
 * shared `captureDevices` slice (`packages/shared/src/api/state-slices.ts`): absent = not on.
 */
export function isLocalSourceOn(device: (CaptureDevice & { readonly sourceOpen?: boolean }) | undefined): boolean {
  return device !== undefined && device.adapter === LOCAL_DEVICE_ADAPTER && device.sourceOpen === true
}

/** One registered capture device from the replicated `captureDevices` slice (readable by every signed-in role). */
export function useCaptureDevice(deviceId: string | null): CaptureDevice | undefined {
  return useSim((state) => (deviceId === null ? undefined : state.captureDevices.devices.find((device) => device.id === deviceId)))
}

/** The device that feeds a video track now (the selector's line), or undefined. */
export function useTrackDevice(trackId: VideoTrackId): CaptureDevice | undefined {
  return useSim((state) => {
    const line = state.captureConfig.cameras.find((camera) => camera.trackId === trackId)
    return line === undefined ? undefined : state.captureDevices.devices.find((device) => device.id === line.deviceId)
  })
}

/**
 * The device behind a microphone input now (the selector's line), or undefined. The id is the text
 * the Core sent (`MIC-NN`, any number; integration pass D2).
 */
export function useMicInputDevice(inputId: string): CaptureDevice | undefined {
  return useSim((state) => {
    const line = state.captureConfig.mics.find((mic) => mic.inputId === inputId)
    return line === undefined ? undefined : state.captureDevices.devices.find((device) => device.id === line.deviceId)
  })
}

/**
 * Names a microphone input from the id the Core sent (integration pass D2, item 5): "MIC 1",
 * "Microphone 3", or "This Mac's microphone" when the Core marks the device of that id as its local
 * microphone and the console shows real capture (the rule of the badge's kind text). The device
 * facts are read as one flat string, so the result compares by value.
 */
export function useMicInputName(): (inputId: string) => string {
  const { t } = useTranslation()
  const realCapture = useRealCapture()
  const locals = useSim((state) =>
    state.captureDevices.devices
      .filter((device) => device.kind === 'MIC' && isDevelopmentSource(device) && device.adapter === LOCAL_DEVICE_ADAPTER)
      .map((device) => device.id)
      .join(','),
  )
  return useCallback((inputId: string) => micInputName(t, inputId, realCapture && locals.split(',').includes(inputId)), [t, realCapture, locals])
}

/** The pre-check items that stand for a capture source (ux §8f.2 "Pre-check": camera and microphone rows). */
export type SourcePrecheckId = 'LENS_1' | 'LENS_2' | 'MIC_1' | 'MIC_2' | 'MIC_PRIMARY' | 'MIC_STANDBY'

export function isSourcePrecheckId(id: string): id is SourcePrecheckId {
  return id === 'LENS_1' || id === 'LENS_2' || id === 'MIC_1' || id === 'MIC_2' || id === 'MIC_PRIMARY' || id === 'MIC_STANDBY'
}

/**
 * The device a pre-check row stands for: the selector the open session was created under (the
 * session's `captureConfig` snapshot of operation 27), else the stored one — the two are equal while
 * a session is open (OD-10).
 */
export function usePrecheckDevice(checkId: string): CaptureDevice | undefined {
  return useSim((state) => {
    const config = state.session?.captureConfig ?? state.captureConfig
    let deviceId: string | undefined
    switch (checkId) {
      case 'LENS_1':
        deviceId = config.cameras.find((camera) => camera.trackId === 'VIDEO-01')?.deviceId
        break
      case 'LENS_2':
        deviceId = config.cameras.find((camera) => camera.trackId === 'VIDEO-02')?.deviceId
        break
      case 'MIC_1':
        deviceId = config.mics.find((mic) => mic.inputId === 'MIC-01')?.deviceId
        break
      case 'MIC_2':
        deviceId = config.mics.find((mic) => mic.inputId === 'MIC-02')?.deviceId
        break
      case 'MIC_PRIMARY':
        deviceId = config.mics.find((mic) => mic.role === 'PRIMARY')?.deviceId
        break
      case 'MIC_STANDBY':
        deviceId = config.mics.find((mic) => mic.role === 'STANDBY')?.deviceId
        break
      default:
        deviceId = undefined
    }
    return deviceId === undefined ? undefined : state.captureDevices.devices.find((device) => device.id === deviceId)
  })
}
