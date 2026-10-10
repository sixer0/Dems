/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Wave H C2 (web): the finished exports of an item, the export dialog of a REAL item, and the stop
// of a media session that only ended.
//
// | Rule | Test |
// |------|------|
// | G94-05: the item page lists the finished exports the Core reports; "Download export" reads ONE fresh path from operation 87 at the press, and nothing on the page view | "G94-05 … lists" |
// | An operator the Core says may not export sees no control; no list reported reads "not reported" | "G94-05 … not permitted", "… not reported" |
// | G94-09: the export dialog of a REAL item has no DEMO chip, no "(simulated)" destination and no DEMO manifest download beside "Download export" | "G94-09" |
// | A demo item keeps its DEMO chip and "(simulated)" destinations (negative control) | "G94-09 … control" |
// | G94-08: a playing player renews BEFORE the session ends (no refused request), and a refused request takes the dead path off the elements at once | "G94-08" |
// | G94-07: a stop caused only by the end of the media session reads "Playback paused: the media session ended"; Play renews | "G94-07" |
import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { EvidenceItem } from '@dems/shared/sim'
import { EV, findDetailBody, type LiveEvidence } from './live-evidence-bed'
import { asReal, openItem, setupPage, teardownPage, UI } from './wave-h-c2-bed'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 60_000 })

const F = en.evidence.itemFacts
const NONE = { source: 'NONE', packageSuffix: null }
const STREAM = { source: 'LIVE_STREAM', packageSuffix: null, fileIds: ['VIDEO-01'] }
const DOWNLOAD_PATH = `/exports/exs_WAVEH${'q7Zm4xLp0k2Vb6Nc1Hy4GjR8sT3w'.repeat(3)}`.slice(0, 95)
const EXPORTS = [
  { exportId: 'EXP-000036', jobId: 'EXPJ-000036', kind: 'PACKAGE', completedAt: 1_790_824_600_000, exportedBy: 'OPR-002', archiveBytes: 136_096_844 },
  { exportId: 'EXP-000033', jobId: 'EXPJ-000033', kind: 'PACKAGE', completedAt: 1_790_824_000_000, exportedBy: 'OPR-002', archiveBytes: 136_096_844 },
]
const ACCESS = { play: true, readTranscript: true, export: true }
const exported = (item: EvidenceItem): EvidenceItem => asReal({ status: 'EXPORTED' })(item)

let opened: LiveEvidence | undefined
beforeEach(setupPage)
afterEach(async () => {
  await teardownPage(opened)
  opened = undefined
})

const requests = (operationId: string) => opened!.bed.fake.log.requestsOf(operationId)
const completeJob = (bed: LiveEvidence['bed'], jobId: string) => ({
  status: 200,
  body: { jobId, evidenceId: EV.sealed, kind: 'PACKAGE', status: 'COMPLETE', progressPct: 100, etaMs: 0, manifestHash: 'ab'.repeat(32), signature: 'cd'.repeat(64), derived: false, createdAt: bed.fake.clock.now(), completedAt: bed.fake.clock.now(), download: { path: DOWNLOAD_PATH, expiresAt: bed.fake.clock.now() + 60_000 } },
})

describe('G94-05: the finished exports of an item on the web item page', () => {
  it('G94-05: the item page lists the finished exports the Core reports; "Download export" reads one fresh path from operation 87 at the press', async () => {
    const followed: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      followed.push(this.getAttribute('href') ?? '')
    })
    opened = await openItem(`/evidence/${EV.sealed}`, EV.sealed, {
      change: exported,
      media: NONE,
      extra: { access: ACCESS, exports: EXPORTS },
      before: (bed) => bed.fake.answer('getEvidenceExportJob', (call) => completeJob(bed, call.params.id ?? '') as never),
    })
    await findDetailBody()
    const panel = await screen.findByTestId('evidence-exports', {}, UI)
    expect(panel).toHaveTextContent(F.exports.title)
    const entries = within(panel).getAllByTestId(/^evidence-export-entry-/)
    expect(entries.map((entry) => entry.dataset.exportId)).toEqual(['EXP-000036', 'EXP-000033'])
    expect(entries[0]).toHaveTextContent('EXP-000036')
    // Nothing is asked of operation 87 on the page view.
    await opened.bed.flush()
    expect(requests('getEvidenceExportJob')).toHaveLength(0)
    const button = screen.getByTestId('evidence-export-download-EXPJ-000036')
    expect(button).toHaveTextContent(en.evidence.exportJob.download)
    fireEvent.click(button)
    await waitFor(() => expect(followed).toEqual([DOWNLOAD_PATH]))
    expect(requests('getEvidenceExportJob')).toHaveLength(1)
    expect(requests('getEvidenceExportJob')[0]!.url).toMatch(/EXPJ-000036$/)
    // The signed path is in no markup of the page.
    expect(document.body.innerHTML).not.toContain('exs_')
  })

  it('G94-05: an operator the Core says may not export sees "not permitted" and no download control', async () => {
    opened = await openItem(`/evidence/${EV.sealed}`, EV.sealed, { change: exported, media: NONE, extra: { access: { ...ACCESS, export: false } } })
    await findDetailBody()
    const panel = await screen.findByTestId('evidence-exports', {}, UI)
    expect(panel).toHaveTextContent(F.exports.mayNotDownload)
    expect(within(panel).queryAllByRole('button')).toEqual([])
  })

  it('G94-05: without an exports member the panel says "Finished exports: not reported"; an empty list says there is none', async () => {
    opened = await openItem(`/evidence/${EV.sealed}`, EV.sealed, { change: exported, media: NONE })
    await findDetailBody()
    expect(await screen.findByTestId('evidence-exports', {}, UI)).toHaveTextContent(F.exports.notReported)
    await teardownPage(opened)
    setupPage()
    opened = await openItem(`/evidence/${EV.sealed}`, EV.sealed, { change: exported, media: NONE, extra: { access: ACCESS, exports: [] } })
    await findDetailBody()
    expect(await screen.findByTestId('evidence-exports', {}, UI)).toHaveTextContent(F.exports.none)
  })
})

describe('G94-09: the export dialog of a REAL item', () => {
  const verdict = (bed: LiveEvidence['bed'], evidenceId: string) => {
    const item = bed.core.served.evidence.find((entry) => entry.id === evidenceId)!
    return { status: 200, body: { evidenceId, ok: true, at: bed.fake.clock.now(), tracks: item.tracks.map((track) => ({ trackId: track.trackId, expected: track.sha256, actual: track.sha256, ok: true })), manifestOk: true, signatureOk: true } }
  }
  async function openWizard(change?: (item: EvidenceItem) => EvidenceItem): Promise<HTMLElement> {
    opened = await openItem(`/evidence/${EV.sealed}`, EV.sealed, {
      ...(change ? { change } : {}),
      media: NONE,
      before: (bed) => {
        bed.fake.answer('verifyEvidence', (call) => verdict(bed, call.params.id ?? '') as never)
        bed.fake.answer('exportEvidence', bed.fake.example('exportEvidence', 202))
      },
    })
    await findDetailBody()
    fireEvent.click(screen.getByTestId('evidence-export'))
    return screen.findByTestId('export-wizard', {}, UI)
  }

  it('G94-09: no DEMO chip, no "(simulated)" destination, the Core-stored note; after the export no DEMO manifest download and no "No archive exists"', async () => {
    const wizard = await openWizard(asReal())
    expect(wizard).not.toHaveTextContent('DEMO')
    expect(wizard).not.toHaveTextContent('(simulated)')
    expect(screen.getByTestId('export-destination')).toHaveTextContent(F.exportReal.destination.CASE_FILE)
    expect(wizard).toHaveTextContent(F.exportReal.destinationLabel)
    expect(screen.getByTestId('export-real-note')).toHaveTextContent(F.exportReal.note)

    fireEvent.change(screen.getByTestId('export-reason'), { target: { value: 'Court order 12/2026, case file' } })
    fireEvent.click(screen.getByTestId('export-next'))
    await screen.findByTestId('export-step-authorise')
    fireEvent.click(screen.getByTestId('export-authorise'))
    fireEvent.click(await screen.findByTestId('export-next'))
    const source = await screen.findByTestId(`export-source-${EV.sealed}`)
    await waitFor(() => expect(source).toHaveAttribute('data-verdict', 'PASS'), UI)
    await waitFor(() => expect(screen.getByTestId('export-next')).not.toBeDisabled())
    fireEvent.click(screen.getByTestId('export-next'))
    fireEvent.click(await screen.findByTestId('export-submit'))
    await screen.findByTestId('export-results', {}, UI)
    await screen.findByTestId(`export-job-${EV.sealed}`, {}, UI)
    expect(screen.queryByTestId(`export-download-${EV.sealed}`)).toBeNull()
    expect(wizard).not.toHaveTextContent('No archive exists')
    expect(wizard).not.toHaveTextContent('DEMO')
    expect(wizard).not.toHaveTextContent('(simulated)')
    // The destination recorded with the export is the plain label: nothing calls it simulated.
    const body = JSON.stringify(requests('exportEvidence').map((call) => call.body))
    expect(body).toContain(F.exportReal.destination.CASE_FILE)
    expect(body).not.toContain('simulated')
  })

  it('G94-09, negative control: a demo item keeps its DEMO chip and its "(simulated)" destinations', async () => {
    const wizard = await openWizard()
    expect(wizard).toHaveTextContent('DEMO')
    expect(screen.getByTestId('export-destination')).toHaveTextContent('Case file transfer (simulated)')
    expect(screen.queryByTestId('export-real-note')).toBeNull()
  })
})

describe('G94-07 / G94-08: the end of a media session is not an integrity failure, and no dead path is asked again', () => {
  const TOKENS = ['mts_WAVEHc2aaaa', 'mts_WAVEHc2bbbb', 'mts_WAVEHc2cccc', 'mts_WAVEHc2dddd']
  async function openPlayer(): Promise<LiveEvidence> {
    let count = 0
    opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, {
      change: asReal(),
      media: STREAM,
      before: (bed) =>
        bed.fake.answer('createEvidenceMediaSession', (call) => {
          const token = TOKENS[count++ % TOKENS.length]!
          return { status: 201, body: { evidenceId: call.params.id ?? '', fileId: 'VIDEO-01', url: `http://127.0.0.1:8443/media/${token}`, expiresAt: bed.fake.clock.now() + 60_000, ranges: true } } as never
        }),
    })
    await findDetailBody()
    await screen.findByTestId('evidence-playback', {}, UI)
    fireEvent.click(screen.getByTestId('evidence-playback-open'))
    await waitFor(() => expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-phase', 'ready'), UI)
    return opened
  }
  const video = () => screen.getByTestId('evidence-sealed-video-VIDEO-01') as HTMLVideoElement
  const sessions = () => requests('createEvidenceMediaSession')

  it('G94-08: while it plays, the player renews BEFORE the session ends: the element gets the new path without any refused request', async () => {
    const { bed } = await openPlayer()
    fireEvent.click(screen.getByTestId('evidence-sealed-play-toggle'))
    video().currentTime = 10
    fireEvent.timeUpdate(video())
    expect(sessions()).toHaveLength(1)
    expect(video().getAttribute('src')).toBe(`/media/${TOKENS[0]}`)
    // 56 s later the session (60 s) is inside its 5 s margin: the next step of the media clock renews it.
    await bed.elapse(56_000, 1_000)
    video().currentTime = 66
    fireEvent.timeUpdate(video())
    await waitFor(() => expect(sessions()).toHaveLength(2))
    await waitFor(() => expect(video().getAttribute('src')).toBe(`/media/${TOKENS[1]}`))
    expect(video().currentTime).toBe(66)
    expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-playing', 'true')
    expect(screen.queryByTestId('evidence-playback-stopped')).toBeNull()
    // One renewal for one end: further time updates on the fresh session ask nothing.
    video().currentTime = 67
    fireEvent.timeUpdate(video())
    await bed.flush()
    expect(sessions()).toHaveLength(2)
  })

  it('G94-08: a refused media request takes the dead path off the element at once (it cannot be asked again), then the new session is put on it', async () => {
    await openPlayer()
    fireEvent.click(screen.getByTestId('evidence-sealed-play-toggle'))
    video().currentTime = 30
    fireEvent.timeUpdate(video())
    fireEvent.error(video())
    // Before the renewal answers, the element holds no path at all.
    expect(video().hasAttribute('src')).toBe(false)
    await waitFor(() => expect(sessions()).toHaveLength(2))
    await waitFor(() => expect(video().getAttribute('src')).toBe(`/media/${TOKENS[1]}`))
  })

  it('G94-07: a second stop at the same place on a session that has ENDED reads "the media session ended", not the integrity sentence; Play renews and goes on', async () => {
    const { bed } = await openPlayer()
    // Paused playback: nothing renews by itself while the session runs out (61 s).
    video().currentTime = 30
    fireEvent.timeUpdate(video())
    fireEvent.error(video())
    await waitFor(() => expect(sessions()).toHaveLength(2))
    await waitFor(() => expect(screen.queryByTestId('evidence-playback-renewing')).toBeNull())
    await bed.elapse(61_000, 1_000)
    fireEvent.error(video())
    const stopped = await screen.findByTestId('evidence-playback-stopped')
    expect(stopped).toHaveAttribute('data-cause', 'SESSION_ENDED')
    expect(stopped).toHaveTextContent(F.playback.sessionEnded)
    expect(stopped).not.toHaveTextContent('integrity')
    expect(video().hasAttribute('src')).toBe(false)
    expect(sessions()).toHaveLength(2)
    // "Press Play to continue": the press asks for a new session and goes back to the place.
    const toggle = screen.getByTestId('evidence-sealed-play-toggle')
    expect(toggle).toBeEnabled()
    fireEvent.click(toggle)
    await waitFor(() => expect(sessions()).toHaveLength(3))
    await waitFor(() => expect(video().getAttribute('src')).toBe(`/media/${TOKENS[2]}`))
    await waitFor(() => expect(screen.queryByTestId('evidence-playback-stopped')).toBeNull())
    expect(video().currentTime).toBe(30)
  })
})
