// Integration pass D10, item 5 (pass D6 item 6, client side): the transcript pane re-reads operations
// 84 and 86 when `transcript.revision` of the item in the replicated slice moves - a revision another
// operator appended. Held on the hook the pane mounts, with the page's own query keys.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { createSim, SimProvider } from '@dems/shared/sim'
import { transcriptQueryKey, transcriptRevisionsQueryKey, useTranscriptFollowsRevision } from '../transcript'

afterEach(cleanup)

/**
 * The refresh starts one task after the effect (`deferEffectStart`, plan row W0; pass E4): every
 * expectation, the controls included, is read after that task.
 */
const nextTask = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))

const EV = 'EV-20261001-0014'
const OTHER = 'EV-20261001-0013'

function mounted(initial: { evidenceId: string; revision: number | null }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  // The reads of the mount, as the pane's two queries hold them (Simulated mode: no Live source in this tree).
  for (const id of [EV, OTHER]) {
    queryClient.setQueryData(transcriptQueryKey(id, null), { revision: 0 })
    queryClient.setQueryData(transcriptRevisionsQueryKey(id, null), [])
  }
  const sim = createSim({ storage: null, authStorage: null, scheduler: () => () => undefined })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SimProvider sim={sim} autoStart={false}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SimProvider>
  )
  const hook = renderHook((props: { evidenceId: string; revision: number | null }) => useTranscriptFollowsRevision(props.evidenceId, props.revision), { wrapper, initialProps: initial })
  const stale = (id: string): [boolean, boolean] => [queryClient.getQueryState(transcriptQueryKey(id, null))?.isInvalidated === true, queryClient.getQueryState(transcriptRevisionsQueryKey(id, null))?.isInvalidated === true]
  return { hook, stale }
}

describe('the pane follows transcript.revision of the slice item', () => {
  it('the head moves 1 -> 2: both reads of that item are fetched again, and only that item\'s', async () => {
    const { hook, stale } = mounted({ evidenceId: EV, revision: 1 })
    // CONTROL: the first value asks nothing, and the same value again asks nothing.
    await nextTask()
    expect(stale(EV)).toEqual([false, false])
    hook.rerender({ evidenceId: EV, revision: 1 })
    await nextTask()
    expect(stale(EV)).toEqual([false, false])

    hook.rerender({ evidenceId: EV, revision: 2 })
    await nextTask()
    expect(stale(EV)).toEqual([true, true])
    expect(stale(OTHER)).toEqual([false, false])
  })

  it('an item that gains its summary (absent after a Core restart, then the next revision) is read again', async () => {
    const { hook, stale } = mounted({ evidenceId: EV, revision: null })
    hook.rerender({ evidenceId: EV, revision: 3 })
    await nextTask()
    expect(stale(EV)).toEqual([true, true])
  })

  it('CONTROL: another item with another head is not a moved head', async () => {
    const { hook, stale } = mounted({ evidenceId: EV, revision: 1 })
    hook.rerender({ evidenceId: OTHER, revision: 4 })
    await nextTask()
    expect(stale(EV)).toEqual([false, false])
    expect(stale(OTHER)).toEqual([false, false])
  })
})
