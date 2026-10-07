// FXR-W, finding W92-7 (`verification/11_code_review_shared_web.md`; decision D242): the console's
// four Blob-URL downloads go through one helper, `lib/download.ts`, whose URL is revoked only after
// `DOWNLOAD_REVOKE_DELAY_MS` (at least 1 s), never in the turn of the click (the API Reference copy
// revoked at 0 ms).
//
// | Held | Where |
// |------|-------|
// | The file name, the type, one click, the anchor gone after it; the URL revoked once, not before 1 s | "the helper" |
// | Each of the four exports' entry points goes through it and keeps the 1 s floor | "the four exports" |
// | Static: `URL.createObjectURL` for a download appears in `lib/download.ts` only | "static" |
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from '@heroui/react'
import { downloadText } from '@/features/api-reference/actions'
import { saveBytes } from '@/features/evidence/export-download'
import { downloadAuditFile } from '@/features/security-audit/export-file'
import { downloadJson } from '@/features/system/live-log-export'
import { DOWNLOAD_REVOKE_DELAY_MS, downloadBlob } from '../download'

let created: Blob[] = []
let createObjectURL: ReturnType<typeof vi.fn>
let revokeObjectURL: ReturnType<typeof vi.fn>
let clicks: Array<{ href: string; download: string; attached: boolean }> = []

beforeEach(() => {
  vi.useFakeTimers()
  created = []
  clicks = []
  createObjectURL = vi.fn((blob: Blob) => {
    created.push(blob)
    return `blob:fxr-w-${created.length}`
  })
  revokeObjectURL = vi.fn()
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicks.push({ href: this.getAttribute('href') ?? '', download: this.download, attached: this.isConnected })
  })
  vi.spyOn(toast, 'success').mockImplementation(() => '')
  vi.spyOn(toast, 'danger').mockImplementation(() => '')
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('the helper', () => {
  it('one click on an attached anchor named by the file; the anchor is gone; the URL lives at least 1 s and is revoked once', () => {
    downloadBlob(new Blob(['{}'], { type: 'application/json' }), 'dems-x.json')
    expect(clicks).toEqual([{ href: 'blob:fxr-w-1', download: 'dems-x.json', attached: true }])
    expect(document.querySelectorAll('a')).toHaveLength(0)
    expect(DOWNLOAD_REVOKE_DELAY_MS).toBeGreaterThanOrEqual(1_000)
    vi.advanceTimersByTime(0)
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(999)
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(DOWNLOAD_REVOKE_DELAY_MS)
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fxr-w-1')
  })

  it('throws where Blob URLs cannot be created (the caller\'s own error path speaks)', () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: undefined })
    expect(() => downloadBlob(new Blob(['x']), 'x.json')).toThrow()
    expect(clicks).toEqual([])
  })
})

describe('the four exports go through it and keep the floor', () => {
  it.each([
    ['Evidence (`saveBytes`)', () => saveBytes(new Uint8Array([1, 2, 3]), 'EV-1-manifest.demo.json', 'application/json'), 'EV-1-manifest.demo.json', 'application/json'],
    ['API Reference (`downloadText`)', () => downloadText('{"openapi":"3.1.0"}', 'dems-openapi.json', { ok: 'ok', failed: 'failed' }, 'test'), 'dems-openapi.json', 'application/json'],
    ['System (`downloadJson`)', () => downloadJson('dems-logs-x.json', { a: 1 }), 'dems-logs-x.json', 'application/json'],
    ['Security & Audit (`downloadAuditFile`)', () => downloadAuditFile('dems-audit-EXP-000001.json', { exportId: 'EXP-000001' } as never), 'dems-audit-EXP-000001.json', 'application/json'],
  ])('%s', (_name, run, fileName, type) => {
    run()
    expect(clicks.map((click) => click.download)).toEqual([fileName])
    expect(created[0]?.type).toBe(type)
    vi.advanceTimersByTime(999)
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(DOWNLOAD_REVOKE_DELAY_MS)
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it('Evidence still answers false where Blob URLs are unavailable, and clicks nothing', () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: undefined })
    expect(saveBytes('x', 'x.json', 'application/json')).toBe(false)
    expect(clicks).toEqual([])
  })
})

describe('static: one Blob-URL download in the console', () => {
  it('`URL.createObjectURL` for a download is called only in `lib/download.ts` (the Login backdrop\'s still image is no download)', () => {
    const src = resolve(import.meta.dirname, '../..')
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) return name === '__tests__' || name === 'test' || name === 'testing' ? [] : walk(path)
        return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
      })
    const callers = walk(src)
      .filter((path) => /URL\.createObjectURL\(/.test(readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')))
      .map((path) => relative(src, path))
      .sort()
    expect(callers).toEqual(['features/login/graded-still.ts', 'lib/download.ts'])
  })
})
