// Step 39: SessionTimeline (01_specs §14.6 accessibility contract; 03_motion_spec M-C-08).
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TimelineEvent } from '@dems/shared/sim'
import { SessionTimeline } from '../session-timeline'
import { timelineNodeStyle } from '../session-timeline.math'
import { withProviders } from './test-utils'

const originalItemRect = HTMLLIElement.prototype.getBoundingClientRect
afterEach(() => {
  cleanup()
  HTMLLIElement.prototype.getBoundingClientRect = originalItemRect
})

// 14:08:50 WIB on 1 Oct 2026 = 07:08:50 UTC.
const START = Date.UTC(2026, 9, 1, 7, 8, 50)
const at = (seconds: number) => START + seconds * 1000

const EVENTS: TimelineEvent[] = [
  { id: 'TL-1', at: at(0), kind: 'START', label: 'Recording started', detail: 'Session SES-20261001-0024', channel: null },
  { id: 'TL-2', at: at(153), kind: 'NOTE', label: 'Investigator note', detail: 'Initial background information discussed.', channel: null },
  { id: 'TL-3', at: at(257), kind: 'AUDIO_PEAK', label: 'Audio peak -3.1 dBFS', detail: null, channel: 'AUDIO-02' },
  { id: 'TL-4', at: at(412), kind: 'HEALTH', label: 'Health check OK', detail: null, channel: null },
]

describe('timelineNodeStyle', () => {
  it('maps kinds to the §14.6 node looks', () => {
    expect(timelineNodeStyle('START')).toBe('ok')
    expect(timelineNodeStyle('AUTOSAVE')).toBe('ok')
    expect(timelineNodeStyle('NOTE')).toBe('note')
    expect(timelineNodeStyle('MARKER')).toBe('note')
    expect(timelineNodeStyle('AUDIO_PEAK')).toBe('peak')
    expect(timelineNodeStyle('FAULT')).toBe('fault')
  })
})

describe('SessionTimeline', () => {
  it('is an ordered list, oldest first, with UTC+07:00 times (§14.6)', () => {
    render(withProviders(<SessionTimeline events={[...EVENTS].reverse()} now={at(600)} />, { sim: null }))
    const list = screen.getByRole('list', { name: 'SESSION TIMELINE' })
    expect(list.tagName.toLowerCase()).toBe('ol')
    const items = within(list).getAllByRole('listitem')
    expect(items.map((item) => item.getAttribute('data-timeline-item'))).toEqual(['TL-1', 'TL-2', 'TL-3', 'TL-4'])
    expect(within(items[0] as HTMLElement).getByText('14:08:50')).toBeInTheDocument()
    expect(within(items[0] as HTMLElement).getByText('Recording Started')).toBeInTheDocument()
    expect(within(items[0] as HTMLElement).getByText('Session SES-20261001-0024')).toBeInTheDocument()
    // The simulator label becomes the detail when it adds something.
    expect(within(items[2] as HTMLElement).getByText('Audio Peak Detected')).toBeInTheDocument()
    expect(within(items[2] as HTMLElement).getByText('Audio peak -3.1 dBFS')).toBeInTheDocument()
    expect(
      [...document.querySelectorAll('[data-timeline-node]')].map((node) => node.getAttribute('data-timeline-node')),
    ).toEqual(['ok', 'note', 'peak', 'ok'])
  })

  it('hides events after `now` and honours `limit`', () => {
    const { rerender } = render(withProviders(<SessionTimeline events={EVENTS} now={at(300)} />, { sim: null }))
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    rerender(withProviders(<SessionTimeline events={EVENTS} now={at(600)} limit={2} />, { sim: null }))
    expect(screen.getAllByRole('listitem').map((item) => item.getAttribute('data-timeline-item'))).toEqual(['TL-3', 'TL-4'])
  })

  it('announces only newly inserted items through a polite live region', () => {
    const { rerender } = render(withProviders(<SessionTimeline events={EVENTS} now={at(600)} />, { sim: null }))
    const live = screen.getByTestId('session-timeline-live')
    expect(live).toHaveAttribute('aria-live', 'polite')
    expect(live).toBeEmptyDOMElement()

    const marker: TimelineEvent = { id: 'TL-5', at: at(480), kind: 'MARKER', label: 'Subject changes statement', detail: null, channel: null }
    rerender(withProviders(<SessionTimeline events={[...EVENTS, marker]} now={at(600)} />, { sim: null }))
    expect(live).toHaveTextContent('14:16:50, Marker Added, Subject changes statement')
    const newest = document.querySelector('[data-newest="true"]')
    expect(newest).toHaveAttribute('data-timeline-item', 'TL-5')
  })

  it('scrolls its own panel to an inserted item unless the user scrolled in the last 5 s, never <main>', () => {
    const panelScroll = vi.fn()
    const mainScroll = vi.fn()
    const view = (events: TimelineEvent[]) => (
      <main data-testid="main" style={{ overflowY: 'auto' }}>
        <div data-testid="panel" style={{ overflowY: 'auto' }}>
          <SessionTimeline events={events} now={at(600)} />
        </div>
      </main>
    )
    const { rerender } = render(withProviders(view(EVENTS), { sim: null }))
    const panel = screen.getByTestId('panel')
    const main = screen.getByTestId('main')
    for (const [element, scroll] of [[panel, panelScroll], [main, mainScroll]] as const) {
      Object.defineProperty(element, 'scrollHeight', { value: 900, configurable: true })
      Object.defineProperty(element, 'clientHeight', { value: 200, configurable: true })
      element.getBoundingClientRect = () => ({ top: 0, bottom: 200 }) as DOMRect
      element.scrollBy = scroll as unknown as typeof element.scrollBy
    }
    HTMLLIElement.prototype.getBoundingClientRect = () => ({ top: 380, bottom: 410 }) as DOMRect
    expect(panelScroll).not.toHaveBeenCalled()

    const one: TimelineEvent = { id: 'TL-5', at: at(480), kind: 'CHECK', label: 'Integrity check passed', detail: null, channel: null }
    rerender(withProviders(view([...EVENTS, one]), { sim: null }))
    expect(panelScroll).toHaveBeenCalledTimes(1)
    expect(panelScroll).toHaveBeenLastCalledWith({ top: 210, behavior: 'smooth' })
    expect(mainScroll).not.toHaveBeenCalled()

    // The user scrolls the list: the next insertion does not move it.
    screen.getByRole('list').dispatchEvent(new WheelEvent('wheel', { bubbles: true }))
    const two: TimelineEvent = { id: 'TL-6', at: at(540), kind: 'AUTOSAVE', label: 'Autosave · segment 2', detail: null, channel: null }
    rerender(withProviders(view([...EVENTS, one, two]), { sim: null }))
    expect(panelScroll).toHaveBeenCalledTimes(1)
    expect(mainScroll).not.toHaveBeenCalled()
  })

  it('renders static under reduced motion (§8)', () => {
    render(withProviders(<SessionTimeline events={EVENTS} now={at(600)} />, { sim: null, reduced: true }))
    expect(screen.getByTestId('session-timeline')).toHaveAttribute('data-motion', 'reduced')
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })
})
