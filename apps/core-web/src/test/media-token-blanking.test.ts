// Task 3 blueprint row 90 (C3 §2.4; SEC35-13; E-31; check M8-BLK-1): log-blanking list 1 of 2, the
// web error sink. A signed media URL of operation 88 that reaches a report - in its message, its
// stack or its context - is kept with the token blanked (`mts_***`), never as it came.
import { describe, expect, it, vi } from 'vitest'
import { createErrorSink, redactCredentials } from '@/runtime/error-sink'

// A synthetic token of the real form: nothing here was ever issued.
const TOKEN = ['mts_', 'AQEBnyfKXzCA', 'MARKER', 'x9_-Zq7Lm2Xw8Rt5Kd0Pu3Vb6Nc1Hy4Gj'].join('')
const URL_TEXT = `http://127.0.0.1:4420/media/${TOKEN}`

describe('M8-BLK-1: the media session token in the web error sink', () => {
  it('blanks the token in a text', () => {
    expect(redactCredentials(`media element failed for ${URL_TEXT}`)).toBe('media element failed for http://127.0.0.1:4420/media/mts_***')
  })

  it('a report holds no part of the token: message, stack, context, and what goes to the console', () => {
    const console = { error: vi.fn(), warn: vi.fn() }
    const sink = createErrorSink({ dev: true, console })
    sink.report({ level: 'error', source: 'evidence.player', message: `load failed: ${URL_TEXT}`, stack: `Error: ${URL_TEXT}\n    at play`, context: { src: URL_TEXT, session: { url: URL_TEXT } }, at: 1 })
    const kept = JSON.stringify(sink.records())
    expect(sink.records()).toHaveLength(1)
    expect(kept).toContain('mts_***')
    expect(kept).not.toContain('MARKER')
    expect(kept).not.toMatch(/mts_(?!\*\*\*)/)
    const printed = JSON.stringify([...console.error.mock.calls, ...console.warn.mock.calls])
    expect(printed).not.toContain('MARKER')
  })

  it('control: the same text under a prefix that is no token of this server is kept as it came', () => {
    const other = URL_TEXT.replace('mts_', 'xyz_')
    expect(redactCredentials(other)).toBe(other)
  })
})
