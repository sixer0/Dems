// Integration pass D2, item 5 — the web console names and pairs microphones by the id the Core sends
// (`MIC-NN`, any number), never by the two built-in literals (decisions D106 (4), D115 (2), D133 (1);
// ux spec §8f.1). The ids are plain strings: the file compiles before and after the contract's mic
// id is widened.
import { describe, expect, it } from 'vitest'
import type { SimState } from '@dems/shared/sim'
import { audioSourceBandPositions } from '@/components/composed/audio-source-band.math'
import { selectActiveInputId, selectStandbyInputId, silentInputOf } from '@/features/session-monitor/audio-source'
import { i18n } from '@/i18n'
import { captureDeviceName, isMicInputId, micInputName, micInputNumber, otherMicInput } from '@/lib/capture-notices'

const t = i18n.t.bind(i18n)

describe('the number of a microphone id', () => {
  it('reads `MIC-NN` of any number and nothing else', () => {
    expect(micInputNumber('MIC-01')).toBe(1)
    expect(micInputNumber('MIC-03')).toBe(3)
    expect(micInputNumber('MIC-104')).toBe(104)
    for (const other of ['MIC-3', 'MIC-00', 'CAM-03', 'AUDIO-01', 'mic-03', 'MIC-03 ', '']) expect(micInputNumber(other)).toBeNull()
    expect(isMicInputId('MIC-03')).toBe(true)
    expect(isMicInputId(undefined)).toBe(false)
  })
})

describe('the name of a microphone input', () => {
  it('keeps the words of the built-in pair, names a third microphone by its number, and says "This Mac\'s microphone" only when told the device is local', () => {
    expect(micInputName(t, 'MIC-01')).toBe('MIC 1')
    expect(micInputName(t, 'MIC-02')).toBe('MIC 2')
    expect(micInputName(t, 'MIC-03')).toBe('MIC 3')
    expect(micInputName(t, 'MIC-11')).toBe('MIC 11')
    expect(micInputName(t, 'MIC-03', true)).toBe("This Mac's microphone")
    expect(micInputName(t, 'LINE-IN')).toBe('LINE-IN')
  })

  it('a notification and a re-read row name a third microphone with its label and its id', () => {
    expect(captureDeviceName(t, 'MIC-03')).toBe('MIC 3 (MIC-03)')
    expect(captureDeviceName(t, 'MIC-02')).toBe('MIC 2 (MIC-02)')
    expect(captureDeviceName(t, 'CAM-02')).toBe('Camera 2 (CAM-02)')
    expect(captureDeviceName(t, 'CAM-07')).toBe('CAM-07')
  })
})

describe('the pair of the session, by the ids the Core sends', () => {
  const state = (over: Record<string, unknown>): SimState => ({ session: null, audio: { activeInputId: 'MIC-01' }, captureConfig: { cameras: [], mics: [] }, ...over }) as unknown as SimState
  // D61 (2026-11-04): the lines state their CHANNEL; the transcription pair sits on channels 1 and 2.
  const lines = [
    { inputId: 'MIC-03', deviceId: 'MIC-03', channel: 'MIC-01' },
    { inputId: 'MIC-01', deviceId: 'MIC-01', channel: 'MIC-02' },
  ]

  it('the session names the pair: both ids pass through as sent', () => {
    const s = state({ session: { state: 'RECORDING', audioSource: { activeInputId: 'MIC-03', standbyInputId: 'MIC-01' } } })
    expect(selectActiveInputId(s)).toBe('MIC-03')
    expect(selectStandbyInputId(s)).toBe('MIC-01')
  })

  it('no pair on the session: the standby is the other line of the session`s selector snapshot, then of the stored selector, then of the built-in pair', () => {
    expect(selectStandbyInputId(state({ session: { state: 'RECORDING', audioSource: null, captureConfig: { cameras: [], mics: lines } }, audio: { activeInputId: 'MIC-03' } }))).toBe('MIC-01')
    // Moved by fix 157 (was `'MIC-03'`, "the other line than the meters' MIC-01"): with no open session the pair is the
    // stored selector's own - MIC-03 is its PRIMARY (active), MIC-01 its STANDBY.
    expect(selectActiveInputId(state({ captureConfig: { cameras: [], mics: lines } }))).toBe('MIC-03')
    expect(selectStandbyInputId(state({ captureConfig: { cameras: [], mics: lines } }))).toBe('MIC-01')
    // Moved by task 4 row 168 (was `'MIC-01'`, "the other input of the built-in pair"): a selector without a line
    // has no standby - no built-in input stands in (decision C18 (2); site W6).
    expect(selectStandbyInputId(state({ audio: { activeInputId: 'MIC-02' } }))).toBeNull()
    expect(selectActiveInputId(state({ audio: { activeInputId: 'MIC-02' } }))).toBeNull()
    expect(otherMicInput([{ inputId: 'MIC-03' }], 'MIC-03')).toBeNull()
  })

  it('a silence warning that names MIC-03 is about MIC-03', () => {
    const fault = (target: string | null) => [{ kind: 'MIC_SILENT', since: 1, target }] as unknown as SimState['faults']['active']
    // Task 4 row 168: the lines are given - a channel is a line of the selector (here the built-in pair), never a table.
    // D61 (2026-11-04): the lines are given by channel - a meter channel is the line that NAMES it.
    const builtIn = [{ inputId: 'MIC-01', channel: 'MIC-01' }, { inputId: 'MIC-02', channel: 'MIC-02' }] as const
    expect(silentInputOf(fault('MIC-03'), 'MIC-01', builtIn)).toBe('MIC-03')
    expect(silentInputOf(fault('AUDIO-02'), 'MIC-03', builtIn)).toBe('MIC-02')
    expect(silentInputOf(fault(null), 'MIC-03', builtIn)).toBe('MIC-03')
  })
})

describe('the audio-source band colours inputs by position, not by two literals', () => {
  it('the built-in pair keeps positions 0 / 1; a third input takes the next', () => {
    expect([...audioSourceBandPositions([{ inputId: 'MIC-02' }, { inputId: 'MIC-01' }, { inputId: 'MIC-02' }])]).toEqual([['MIC-01', 0], ['MIC-02', 1]])
    expect(audioSourceBandPositions([{ inputId: 'MIC-03' }, { inputId: 'MIC-01' }, { inputId: 'MIC-02' }]).get('MIC-03')).toBe(2)
  })
})
