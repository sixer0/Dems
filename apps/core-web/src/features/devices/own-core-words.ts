/**
 * Fix wave L (G75d-06, G70c-02; `contract_wave_l.md` section 5): WHAT A SCREEN OF A CORE IN REAL
 * CAPTURE MAY SAY OF A SOURCE.
 *
 * | Member of `captureDevices.devices[]` | On a Core in real capture |
 * |---|---|
 * | `id`, `kind`, `adapter`, `sourceClass`, `sourceOpen`, `capabilities` | facts of the registry |
 * | `model`, `firmware`, `poePort` of a device with `adapter: FAKE` | MODEL VALUES of the seed dataset ("Dual-lens IP camera DL-2", "USB condenser microphone UM-1") or what a fake device announced: never drawn. A generated source is named as generated |
 * | `online`, `streamState` while nothing records | NOT a checked fact: `online` = the registry row is enabled. No screen says "Online", "Ready" or "Reachable" from it |
 *
 * Pure rules; the words come from `web.waveL.source` / `web.waveL.state`.
 */
import type { TFunction } from 'i18next'
import { LOCAL_DEVICE_ADAPTER, TEST_SOURCE_ADAPTER } from './source-class'

interface NamedDevice {
  readonly id: string
  readonly model?: string | null | undefined
  readonly adapter?: string | null | undefined
}

/** A GENERATED test source: the registry says `adapter: FAKE`. */
export function isGeneratedSource(device: { readonly adapter?: string | null | undefined } | null | undefined): boolean {
  return device?.adapter === TEST_SOURCE_ADAPTER
}

/**
 * The words after the id of a source: on a Core in real capture a generated source reads "Generated
 * test source" (its `model` is a value of the dataset); any other source, and every source of the
 * simulated lane, reads the model the Core holds for it. null: nothing to add to the id.
 */
export function sourceModelText(t: TFunction, device: NamedDevice, realCapture: boolean): string | null {
  if (realCapture && isGeneratedSource(device)) return t('web.waveL.source.generatedCamera')
  return device.model ? device.model : null
}

/** "CAM-01 · Generated test source" / "CAM-01 · <model>" / "CAM-01". */
export function sourceDeviceText(t: TFunction, device: NamedDevice, realCapture: boolean): string {
  const model = sourceModelText(t, device, realCapture)
  return model === null ? device.id : `${device.id} · ${model}`
}

/**
 * Whether the Core holds a CHECKED fact of a registered source that is at rest: it opened it
 * (`sourceOpen`, a local device), or it states when it last checked it (`checkedAt`, a number).
 * Otherwise `online: true` only means "the registry row is enabled".
 */
export function restingSourceChecked(device: { readonly sourceOpen?: unknown; readonly checkedAt?: unknown; readonly adapter?: string | null | undefined } | null | undefined): boolean {
  if (device === null || device === undefined) return false
  if (device.sourceOpen === true) return true
  return typeof device.checkedAt === 'number' && Number.isFinite(device.checkedAt)
}

export { LOCAL_DEVICE_ADAPTER }

/**
 * Closing pass L-Z (remainder R-4 of note 154): whether a microphone line's transport word ("USB input") is
 * drawn. It is the dataset's word for the built-in microphones; a GENERATED source of a Core in real capture
 * is a tone - it has no input of that kind. Every other line, and the simulated lane, keep the word.
 */
export function micTransportShown(realCapture: boolean, device: { readonly adapter?: string | null | undefined } | null | undefined): boolean {
  return !(realCapture && isGeneratedSource(device))
}
