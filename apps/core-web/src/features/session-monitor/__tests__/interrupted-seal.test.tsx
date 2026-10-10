// Wave H, driver B (gates 75 / 89: G75-03, G75-08, B-3; ruling D197): a recording that a capture fault
// ended and the Core sealed is NAMED on the Session Monitor - "Sealed — recording was interrupted" and
// the sentence of its cause - and never the plain sealed state; its Duration stands at the end of the
// recording. Written RED: the banner said "SESSION SEALED", the feed card "Session sealed", and the
// Duration ran on (`stoppedAt` null).
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { formatDuration, type SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  FINALIZATION_ORDER,
  OPERATOR_IDS,
  SimProvider,
  applySealingProgressTransition,
  completeSealTransition,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  interruptedCaptureTransition,
  raiseCaptureWarningTransition,
  type CaptureWarningInput,
  type Sim,
} from '@dems/shared/sim'
import '@/i18n'
import { createAppRouter } from '@/router'
import { InterruptedSealNotice } from '../interrupted-seal'

vi.setConfig({ testTimeout: 30_000 })

const WORDS = en.common.interruptedSeal
const CAUSE = en.common.captureFault.noReason.capture
const START = Date.UTC(2026, 9, 10, 6, 0, 0)
const hex = (seed: string, length = 64): string => seed.repeat(length).slice(0, length)

class SilentSocket implements SocketLike {
  readyState = 0
  onopen: SocketLike['onopen'] = null
  onmessage: SocketLike['onmessage'] = null
  onclose: SocketLike['onclose'] = null
  onerror: SocketLike['onerror'] = null
  close() {
    this.readyState = 3
  }
}

const sims: Sim[] = []
afterEach(() => {
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
})

function recordingSim() {
  const clock = createManualClock(START)
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: START })
  const sim = createSim({ scenario: 'recording', clock, storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  return { sim, clock }
}

/** The Core's order of an interrupted recording and of its seal (`engine/host.ts` capture + seal doors). */
function sealInterrupted(sim: Sim, now: number, interrupted = true) {
  const sessionId = sim.store.getState().session!.id
  const put = (next: ReturnType<typeof sim.store.getState>) => sim.store.setState(next, true)
  if (interrupted) {
    put(raiseCaptureWarningTransition(sim.store.getState(), now, { code: 'CAPTURE_FAULT', subject: null } as CaptureWarningInput))
    put(interruptedCaptureTransition(sim.store.getState(), now, sessionId))
  } else {
    put({ ...sim.store.getState(), session: { ...sim.store.getState().session!, state: 'STOPPING', stoppedAt: now, stopReason: 'Interview finished', captureDurable: true } })
  }
  const steps = FINALIZATION_ORDER.map((id) => ({ id, status: 'RUNNING' as const, progress: 90, etaMs: 100, attempt: 1 }))
  put(applySealingProgressTransition(sim.store.getState(), now + 500, { sessionId, steps }))
  const sealedAt = now + 1_500
  put(
    completeSealTransition(sim.store.getState(), sealedAt, {
      sessionId,
      sealedAt,
      manifestSha256: hex('ab'),
      signature: { value: hex('cd', 128), keyId: 'CORE-KEY-EVSIGN-01', algorithm: 'Ed25519' },
      tracks: [{ trackId: 'VIDEO-01', sizeBytes: 4_000, sha256: hex('01') }],
      interrupted,
      durableEndAt: now - 200,
      transcriptSha256: null,
      labelsStatus: null,
      developmentSources: true,
    }),
  )
  return { sessionId, endedAt: interrupted ? now - 200 : now }
}

function mountPage(sim: Sim) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: ['/session'] }) })
  render(<RouterProvider router={router} />)
}

describe('an interrupted seal on the Session Monitor', () => {
  it('the banner and the feed card name it with its cause; neither says the plain sealed state; the Duration stands at the end of the recording', async () => {
    const { sim, clock } = recordingSim()
    const startedAt = sim.store.getState().session!.startedAt!
    const { endedAt } = sealInterrupted(sim, clock.now())
    mountPage(sim)
    const banner = await screen.findByTestId('sm-status-banner', {}, { timeout: 15_000 })
    await waitFor(() => expect(banner.textContent).toContain(WORDS.title))
    expect(banner.textContent).toContain(CAUSE)
    expect(banner.textContent).not.toContain(en.session.banner.SEALED.title)
    expect(banner.getAttribute('data-interrupted')).toBe('true')
    const card = screen.getByTestId('sm-invitation')
    expect(card.textContent).toContain(WORDS.title)
    expect(card.textContent).not.toContain(en.session.idle.sealedTitle)

    const duration = screen.getByTestId('sm-duration')
    expect(duration.textContent).toBe(formatDuration(endedAt - startedAt))
    // A minute later the same value: the clock of an ended recording does not run.
    act(() => {
      clock.advance(60_000)
      sim.tick()
    })
    expect(screen.getByTestId('sm-duration').textContent).toBe(formatDuration(endedAt - startedAt))
  })

  it('CONTROL - a recording ended by its stop reads the plain sealed state and no interruption', async () => {
    const { sim, clock } = recordingSim()
    sealInterrupted(sim, clock.now(), false)
    mountPage(sim)
    const banner = await screen.findByTestId('sm-status-banner', {}, { timeout: 15_000 })
    await waitFor(() => expect(banner.textContent).toContain(en.session.banner.SEALED.title))
    expect(banner.textContent).not.toContain(WORDS.title)
    expect(banner.getAttribute('data-interrupted')).toBeNull()
    expect(screen.getByTestId('sm-invitation').textContent).toContain(en.session.idle.sealedTitle)
  })
})

describe('the interrupted notice of the seal dialog', () => {
  function mountNotice(sim: Sim, sessionId: string | null) {
    return render(
      <SimProvider sim={sim} autoStart={false}>
        <InterruptedSealNotice sessionId={sessionId} />
      </SimProvider>,
    )
  }

  it('a status line with the title, the cause sentence and what the evidence holds - for that session only', () => {
    const { sim, clock } = recordingSim()
    const { sessionId } = sealInterrupted(sim, clock.now())
    const view = mountNotice(sim, sessionId)
    const notice = within(view.container).getByTestId('sm-interrupted-seal')
    expect(notice.getAttribute('role')).toBe('status')
    expect(notice.textContent).toBe(`${WORDS.title}. ${CAUSE} ${WORDS.kept}`)
    cleanup()
    expect(mountNotice(sim, 'SES-20261010-0999').container.textContent).toBe('')
  })

  it('CONTROL - a stopped recording draws nothing', () => {
    const { sim, clock } = recordingSim()
    const { sessionId } = sealInterrupted(sim, clock.now(), false)
    expect(mountNotice(sim, sessionId).container.textContent).toBe('')
  })
})
