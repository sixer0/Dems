/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W0, items 5 and 8: the page logs of Network & Time (finding F71-3, decision D155) and of
// the Dashboard and Devices & Inputs (finding F70-5, decision D156).
//
// | Criterion | Where |
// |-----------|-------|
// | Item 5: a Network & Time record goes to the page's own sink, with a fixed sentence and the error's name; never its text, never the console directly | "item 5" |
// | Item 8: one page-report helper, `@/lib/page-report` (decision D165); the Dashboard and Devices records keep their shapes and their own correlation prefixes; neither page holds a copy | "item 8" |
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ErrorRecord } from '@/runtime'
import { webErrorSink } from '@/runtime'
import { newDashboardCorrelationId, reportDashboardError } from '@/features/dashboard/report'
import { newDevicesCorrelationId, reportDevicesError } from '@/features/devices/report'
import { logNetworkTimeError } from '@/features/network-time/log'
import { createPageReporter } from '@/lib/page-report'

const FEATURES = resolve(import.meta.dirname, '../features')
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
const SECRET = 'subject Rudi Hartono, case LP/2026/1001-0101'

beforeEach(() => {
  webErrorSink.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('item 5: Network & Time writes to the page\'s own sink (F71-3)', () => {
  it('one record: the fixed sentence, the error\'s name, the caller\'s context, a correlation ID; no text, no stack', () => {
    const records: ErrorRecord[] = []
    const error = new TypeError(SECRET)
    logNetworkTimeError('PanelBoundary', error, { panel: 'offset', componentStack: '\n    at OffsetPanel' }, { report: (record) => records.push(record as ErrorRecord) })
    expect(records).toHaveLength(1)
    const [record] = records
    expect(record).toMatchObject({
      level: 'error',
      source: 'NetworkTime.PanelBoundary',
      message: 'Network & Time: the step "PanelBoundary" did not complete.',
    })
    expect(record?.context).toMatchObject({ panel: 'offset', errorName: 'TypeError' })
    expect(String(record?.context?.correlationId)).toMatch(/^nt-[0-9a-z]+-\d+$/)
    expect(record?.stack).toBeUndefined()
    expect(typeof record?.at).toBe('number')
    expect(JSON.stringify(record)).not.toContain('Rudi')
    expect(JSON.stringify(record)).not.toContain('LP/2026')
  })

  it('by default the record lands in `webErrorSink`; a non-Error is named by its type', () => {
    logNetworkTimeError('chart', 'a thrown string with the subject Rudi')
    const records = webErrorSink.records().filter((record) => record.source === 'NetworkTime.chart')
    expect(records).toHaveLength(1)
    expect(records[0]?.context).toMatchObject({ errorName: 'string' })
    expect(JSON.stringify(records[0])).not.toContain('Rudi')
  })

  it('the module names no console and no text of the error (the static form of the rule)', () => {
    const log = code(readFileSync(resolve(FEATURES, 'network-time/log.ts'), 'utf8'))
    expect(log).toMatch(/webErrorSink/)
    expect(log).not.toMatch(/console\./)
    expect(log).not.toMatch(/error\.message|String\(error\)|error\.stack|import\.meta\.env\.DEV/)
  })
})

describe('item 8: one page-report helper for the Dashboard and Devices & Inputs (F70-5)', () => {
  /** A refusal of the shape the presenter leaves to a page: class, code and status, and a text that must not be logged. */
  const refused = Object.assign(new Error(SECRET), { name: 'SimTransitionError', code: 'RECORDING_ACTIVE', status: 409 })

  it('the Dashboard\'s record: level error, the caller\'s fixed sentence, the cause by class, code and status, a `dash-` correlation ID', () => {
    const records: ErrorRecord[] = []
    reportDashboardError('features/dashboard.DeviceMenu', refused, 'A device command of the Dashboard was not carried out.', { deviceId: 'CAM-01' }, {
      report: (record) => records.push(record as ErrorRecord),
    })
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ level: 'error', source: 'features/dashboard.DeviceMenu', message: 'A device command of the Dashboard was not carried out.' })
    expect(records[0]?.context).toMatchObject({ deviceId: 'CAM-01', errorName: 'SimTransitionError', code: 'RECORDING_ACTIVE', status: 409 })
    expect(String(records[0]?.context?.correlationId)).toMatch(/^dash-[0-9a-z]+-\d+$/)
    expect(records[0]?.stack).toBeUndefined()
    expect(JSON.stringify(records[0])).not.toContain('Rudi')
  })

  it('the Devices record has the same shape with a `dev-` correlation ID, and its level can be `warn`', () => {
    const records: ErrorRecord[] = []
    const sink = { report: (record: unknown) => records.push(record as ErrorRecord) }
    reportDevicesError('features/devices.run', refused, 'A device command of Devices & Inputs was not carried out.', { deviceId: 'CAM-01' }, 'error', sink)
    reportDevicesError('features/devices.pairedDevices', 'not an error', 'The device registry could not be read.', {}, 'warn', sink)
    expect(records).toHaveLength(2)
    expect(records[0]?.context).toMatchObject({ deviceId: 'CAM-01', errorName: 'SimTransitionError', code: 'RECORDING_ACTIVE', status: 409 })
    expect(String(records[0]?.context?.correlationId)).toMatch(/^dev-[0-9a-z]+-\d+$/)
    expect(records[1]).toMatchObject({ level: 'warn' })
    expect(records[1]?.context).toMatchObject({ errorName: 'string' })
    expect(JSON.stringify(records)).not.toContain('Rudi')
  })

  it('by default both write to `webErrorSink`; each page counts its correlation IDs on its own', () => {
    reportDashboardError('features/dashboard.x', new Error('a'), 'Fixed.')
    reportDevicesError('features/devices.x', new Error('b'), 'Fixed.')
    expect(webErrorSink.records().map((record) => record.source)).toEqual(['features/dashboard.x', 'features/devices.x'])
    const reporter = createPageReporter('test')
    expect(reporter.newCorrelationId()).toMatch(/^test-[0-9a-z]+-1$/)
    expect(reporter.newCorrelationId()).toMatch(/^test-[0-9a-z]+-2$/)
    expect(newDashboardCorrelationId()).toMatch(/^dash-/)
    expect(newDevicesCorrelationId()).toMatch(/^dev-/)
  })

  it('one copy: only `lib/page-report.ts` writes to a sink; the Dashboard and Devices bind their prefixes to it (D165)', () => {
    const helper = code(readFileSync(resolve(FEATURES, '../lib/page-report.ts'), 'utf8'))
    const dashboard = code(readFileSync(resolve(FEATURES, 'dashboard/report.ts'), 'utf8'))
    const devices = code(readFileSync(resolve(FEATURES, 'devices/report.ts'), 'utf8'))
    expect(helper).toMatch(/export function createPageReporter\(/)
    expect(helper).toMatch(/sink\.report\(/)
    for (const [text, prefix] of [
      [dashboard, 'dash'],
      [devices, 'dev'],
    ] as const) {
      expect(text).toMatch(/import \{ createPageReporter \} from '@\/lib\/page-report'/)
      expect(text).toContain(`createPageReporter('${prefix}')`)
      expect(text).not.toMatch(/sink\.report\(|function causeFacts|function createPageReporter/)
    }
    for (const text of [helper, dashboard, devices]) expect(text).not.toMatch(/console\.|error\.message|String\(error\)|\.stack/)
  })
})
