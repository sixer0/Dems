// Fix pass F-M4 (decisions D163, D178): the ONE decision "which local devices does this selector
// name" (review finding R69-01), and the local-microphone limit on the selector line (R69-07).
//
// "Real capture" is the console's Live mode (`useRealCapture`, `source-class.ts`). The page tests
// run on the in-app simulator; the rule is switched through that ONE function (a hoisted flag), as
// in `registered-devices.test.tsx`. No real device is named to a Core: the state is a fixture.
//
// | Check | Where |
// |-------|-------|
// | A local device = `adapter: LOCAL_DEVICE` of a device a selector line names; the id, the class alone, or a device no line names decide nothing | "localSourcesOf" |
// | The notice's sentence: camera, microphone, or both | "localSourcesOf" |
// | R69-07: the selector line of a LOCAL microphone says the limit sentence; only in real capture; a line of another microphone never | "the selector line" |
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { OPERATOR_IDS, type Sim } from '@dems/shared/sim'
import type { CaptureDevice } from '../capture-selector'
import { localSourceNoticeKey, localSourcesOf } from '../local-source-gate'
import { installDevicesBed, mountDevices } from './search-bed'

const mode = vi.hoisted(() => ({ realCapture: false }))
vi.mock('../source-class', async (original) => ({ ...(await original<typeof import('../source-class')>()), useRealCapture: () => mode.realCapture }))

const LIMIT = en.common.localSourceNotice.microphoneLimit
const device = (id: string, kind: CaptureDevice['kind'], over: Partial<CaptureDevice> = {}): CaptureDevice => ({ id, kind, model: null, firmware: null, host: null, poePort: null, online: true, streamState: kind === 'CAMERA' ? 'LIVE' : null, capabilities: [], ...over })
const LOCAL_CAMERA = device('CAM-03', 'CAMERA', { adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' })
// D61 (2026-11-04): MIC-03/MIC-04 are built-ins - a development fixture takes the next free id.
const LOCAL_MIC = device('MIC-05', 'MIC', { adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' })
const BUILT_INS = [device('CAM-01', 'CAMERA'), device('CAM-02', 'CAMERA', { adapter: 'FAKE', sourceClass: 'DEVELOPMENT' }), device('MIC-01', 'MIC'), device('MIC-02', 'MIC')]
const config = (cameras: string[], mics: string[]) => ({ cameras: cameras.map((deviceId) => ({ deviceId })), mics: mics.map((deviceId) => ({ deviceId })) })

describe('localSourcesOf: which of this Mac\'s devices a pre-check under the selector opens', () => {
  const registry = { devices: [...BUILT_INS, LOCAL_CAMERA, LOCAL_MIC] }

  it('names the local camera and the local microphone of the selector lines, by the id the Core sent', () => {
    expect(localSourcesOf(config(['CAM-03', 'CAM-02'], ['MIC-05', 'MIC-02']), registry)).toEqual({ camera: 'CAM-03', microphone: 'MIC-05' }) // D61: MIC-03/04 are built-ins - the local fixture is MIC-05
    expect(localSourcesOf(config(['CAM-03', 'CAM-02'], ['MIC-01', 'MIC-02']), registry)).toEqual({ camera: 'CAM-03', microphone: null })
    expect(localSourcesOf(config(['CAM-01', 'CAM-02'], ['MIC-02', 'MIC-05']), registry)).toEqual({ camera: null, microphone: 'MIC-05' })
  })

  it('CONTROL: a selector without a local device is `null` — a registered local device no line names opens nothing', () => {
    expect(localSourcesOf(config(['CAM-01', 'CAM-02'], ['MIC-01', 'MIC-02']), registry)).toBeNull()
    expect(localSourcesOf(config([], []), registry)).toBeNull()
    expect(localSourcesOf(null, registry)).toBeNull()
    expect(localSourcesOf(config(['CAM-03'], ['MIC-03']), null)).toBeNull()
  })

  it('the adapter decides: not the id, not `sourceClass: DEVELOPMENT` alone, not a test source, not a device the registry does not hold', () => {
    const byIdOnly = { devices: [device('CAM-03', 'CAMERA'), device('MIC-03', 'MIC', { sourceClass: 'DEVELOPMENT' })] }
    expect(localSourcesOf(config(['CAM-03'], ['MIC-03']), byIdOnly)).toBeNull()
    expect(localSourcesOf(config(['CAM-02'], []), registry)).toBeNull()
    expect(localSourcesOf(config(['CAM-09'], ['MIC-09']), registry)).toBeNull()
    // A local device under another id is still local.
    expect(localSourcesOf(config(['CAM-07'], []), { devices: [device('CAM-07', 'CAMERA', { adapter: 'LOCAL_DEVICE' })] })).toEqual({ camera: 'CAM-07', microphone: null })
  })

  it('two lines on one local device name it once; two local cameras are both named', () => {
    expect(localSourcesOf(config(['CAM-03', 'CAM-03'], []), registry)).toEqual({ camera: 'CAM-03', microphone: null })
    const two = { devices: [LOCAL_CAMERA, device('CAM-05', 'CAMERA', { adapter: 'LOCAL_DEVICE' })] }
    expect(localSourcesOf(config(['CAM-03', 'CAM-05'], []), two)).toEqual({ camera: 'CAM-03, CAM-05', microphone: null })
  })

  it('the sentence of the notice: camera, microphone, or both (the `web` wording)', () => {
    expect(localSourceNoticeKey({ camera: 'CAM-03', microphone: null })).toBe('common.localSourceNotice.web.camera')
    expect(localSourceNoticeKey({ camera: null, microphone: 'MIC-03' })).toBe('common.localSourceNotice.web.microphone')
    expect(localSourceNoticeKey({ camera: 'CAM-03', microphone: 'MIC-03' })).toBe('common.localSourceNotice.web.both')
  })
})

describe('R69-07 the selector line of a local microphone (Devices & Inputs)', () => {
  installDevicesBed()

  /** Camera 1 and the transcribed channel are this Mac's; channel 2 stays the built-in. (D61) */
  const development = (sim: Sim): void => {
    const state = sim.store.getState()
    sim.store.setState({
      captureDevices: { devices: [...state.captureDevices.devices, LOCAL_CAMERA, LOCAL_MIC] },
      captureConfig: {
        ...state.captureConfig,
        cameras: state.captureConfig.cameras.map((camera) => (camera.trackId === 'VIDEO-01' ? { ...camera, deviceId: 'CAM-05' } : camera)), // D61: CAM-03/04 are built-ins
        mics: [{ ...state.captureConfig.mics[1]! }, { ...state.captureConfig.mics[0]!, inputId: 'MIC-05', deviceId: 'MIC-05' }],
      },
    })
  }

  it('real capture: the line of the local microphone says the limit sentence; the other microphone line and the camera lines do not', async () => {
    mode.realCapture = true
    await mountDevices('idle', OPERATOR_IDS.ANDI, development)
    const local = within(await screen.findByTestId('selector-mic-MIC-05'))
    expect(local.getByTestId('source-limit-selector-MIC-05').textContent).toBe(LIMIT)
    expect(within(screen.getByTestId('selector-mic-MIC-02')).queryByText(LIMIT)).toBeNull()
    expect(document.querySelectorAll('[data-testid^="source-limit-selector-"]')).toHaveLength(1)
    expect(screen.getByTestId('selector-camera-VIDEO-01').textContent).not.toContain(LIMIT)
  })

  it('CONTROL: Simulated client mode: no limit sentence on any selector line', async () => {
    mode.realCapture = false
    await mountDevices('idle', OPERATOR_IDS.ANDI, development)
    await screen.findByTestId('selector-mic-MIC-05')
    expect(document.querySelectorAll('[data-testid^="source-limit-"]')).toHaveLength(0)
  })
})
