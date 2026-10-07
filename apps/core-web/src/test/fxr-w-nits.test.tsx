// FXR-W, the cheap Nits of `verification/11_code_review_shared_web.md` (decision D242) that a test can
// hold in core-web. W92-18 (a stale comment), W92-23 and W92-25 (comments in the shared contract) are
// wording only; W92-22 is held by `components/composed/__tests__/glow-ring-fit.test.tsx`, W92-26 by
// `test/live-api-reference-document.test.tsx`, W92-20 and W92-24 by `packages/shared/test/fxr-w-nits.test.ts`.
//
// | Nit | Held here |
// |-----|-----------|
// | W92-19: the `seq` box of both Realtime panels is a named group (ARIA 1.2 does not name a generic `div`) | "W92-19" |
// | W92-21: the server strip's props follow the mode; Live takes no switch props | "W92-21" (a type-level check: `tsc -b` fails if the union widens again) |
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ServerStripProps } from '@/features/api-reference/server-strip'

const source = (path: string) => readFileSync(resolve(import.meta.dirname, '..', path), 'utf8')

describe('W92-19: the seq box is a named group in both Realtime panels', () => {
  it('every element that carries `data-testid="api-realtime-seq"` also carries `role="group"` and its `aria-label`', () => {
    const text = source('features/api-reference/realtime-panel.tsx')
    const boxes = text.match(/<div className="api-rt-seq"[^>]*>/g) ?? []
    expect(boxes).toHaveLength(2)
    for (const box of boxes) {
      expect(box).toContain('role="group"')
      expect(box).toContain('aria-label=')
    }
  })
})

describe('W92-21: the server strip\'s props follow the mode', () => {
  it('Live takes no switch props; Simulated requires them', () => {
    const live: ServerStripProps = { mode: 'live', operationCount: 1, getDocumentJson: () => '{}' }
    const simulated: ServerStripProps = { includeSimulated: true, onIncludeSimulatedChange: () => undefined, operationCount: 1, getDocumentJson: () => '{}' }
    // @ts-expect-error Live mode has no `includeSimulated` (W92-21).
    const liveWithSwitch: ServerStripProps = { mode: 'live', includeSimulated: true, onIncludeSimulatedChange: () => undefined, operationCount: 1, getDocumentJson: () => '{}' }
    // @ts-expect-error Simulated mode needs its switch and handler.
    const simulatedWithout: ServerStripProps = { mode: 'simulated', operationCount: 1, getDocumentJson: () => '{}' }
    expect([live.mode, simulated.mode, liveWithSwitch.mode, simulatedWithout.mode]).toEqual(['live', undefined, 'live', 'simulated'])
    // The Live page passes no dummy any more.
    expect(source('features/api-reference/index.tsx')).not.toMatch(/onIncludeSimulatedChange=\{\(\) => undefined\}/)
  })
})
