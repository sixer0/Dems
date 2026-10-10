/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Blueprint row 92 (M8-W3): the background export job (operations 42 and 87; UX spec flow 5 step 7;
// OD-16; the client contract of row 91).
//
// | What is held | Where |
// |--------------|-------|
// | The job ID of an accepted export; a job answer is read defensively; a composite is always derived | "the model" |
// | Progress only moves forward on screen; COMPLETE is 100 | "the model" |
// | The wizard, Live mode: after the 202 the job is read until it is finished — Running with the Core's percent (never backwards), then Complete with the hash and the signature of the export manifest, and "The export is stored on the Core"; a Core-sealed (v2) item gets NO download control | "start, poll, result" |
// | A FAILED job is an answer worded as FAIL with its cause; `COMPOSITE_ENCODER_NOT_SELECTED` reads "Composite video is not available in this build", as a state and not an error; reading stops | "a failed job" |
// | A job the Core does not know: said so, read once | "an unknown job" |
import { cleanup, configure, fireEvent, screen, waitFor } from '@testing-library/react'
import { toast } from '@heroui/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EXPORT_ACCEPTED_NO_ARCHIVE_EXAMPLE, type EvidenceVerifyResultBody } from '@dems/shared/api'
import type { EvidenceItem } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import { COMPOSITE_NOT_SELECTED, EXPORT_JOB_POLL_MS, answeredArchiveOnCoreOf, answeredJobIdOf, exportJobIdOf, forwardProgress, isTerminalJob, readExportDownload, readExportJob } from '../export-job-model'
import { RECORDED_VERIFY_V2 } from './fixtures/verify-v2-recorded'
import { clearToasts, EV, evidenceWith, findDetailBody, installJsdomStubs, openLiveEvidence, type LiveEvidence } from './live-evidence-bed'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 60_000 })

const UI = { timeout: 15_000 }
const POLLS = { timeout: EXPORT_JOB_POLL_MS * 4 + 4_000, interval: 100 }
const H = (char: string) => char.repeat(64)
const JOB = { jobId: 'EXPJ-000032', evidenceId: EV.sealed, kind: 'PACKAGE', status: 'RUNNING', progressPct: 40, etaMs: null, derived: false, createdAt: 1_790_824_500_000 }

describe('the model', () => {
  it('the job ID of an export; a job answer is read defensively', () => {
    expect(exportJobIdOf('EXP-000032')).toBe('EXPJ-000032')
    for (const id of ['EXPJ-000032', 'EXP-32', 'exp-000032', '']) expect(exportJobIdOf(id)).toBeNull()
    // Pass D5: the job the 202 names wins when it is one; anything else falls back to the rule.
    expect(exportJobIdOf('EXP-000032', 'EXPJ-000777')).toBe('EXPJ-000777')
    for (const answered of [undefined, null, 'EXP-000777', 'EXPJ-7', 7]) expect(exportJobIdOf('EXP-000032', answered)).toBe('EXPJ-000032')
    expect(answeredJobIdOf({ ok: true, status: 202, exportId: 'EXP-000032', jobId: 'EXPJ-000777' })).toBe('EXPJ-000777')
    expect(answeredJobIdOf({ ok: true, status: 202, exportId: 'EXP-000032' })).toBeNull()
    expect(readExportJob(JOB)).toEqual({ jobId: 'EXPJ-000032', evidenceId: EV.sealed, kind: 'PACKAGE', status: 'RUNNING', progressPct: 40, derived: false, manifestHash: null, signature: null, failureReason: null, downloadable: false })
    for (const bad of [null, [], { ...JOB, status: 'DONE' }, { ...JOB, jobId: 'EXP-000032' }, { ...JOB, evidenceId: 7 }]) expect(readExportJob(bad)).toBeNull()
    expect(readExportJob({ ...JOB, progressPct: 250 })?.progressPct).toBe(100)
    expect(readExportJob({ ...JOB, progressPct: 'half' })?.progressPct).toBe(0)
    // A composite is derived whatever the flag says; a failure reason is read only from a FAILED job.
    expect(readExportJob({ ...JOB, kind: 'COMPOSITE', derived: false })?.derived).toBe(true)
    expect(readExportJob({ ...JOB, failureReason: 'X_Y' })?.failureReason).toBeNull()
    expect(readExportJob({ ...JOB, status: 'FAILED', failureReason: COMPOSITE_NOT_SELECTED })?.failureReason).toBe('COMPOSITE_ENCODER_NOT_SELECTED')
    expect(readExportJob({ ...JOB, status: 'FAILED', failureReason: 'not a code' })?.failureReason).toBeNull()
  })

  it('progress only moves forward; COMPLETE is 100; a job is finished at COMPLETE and at FAILED', () => {
    expect(forwardProgress(40, { status: 'RUNNING', progressPct: 20 })).toBe(40)
    expect(forwardProgress(40, { status: 'RUNNING', progressPct: 55 })).toBe(55)
    expect(forwardProgress(40, { status: 'COMPLETE', progressPct: 0 })).toBe(100)
    expect(forwardProgress(40, { status: 'FAILED', progressPct: 10 })).toBe(40)
    expect([isTerminalJob({ status: 'QUEUED' }), isTerminalJob({ status: 'RUNNING' }), isTerminalJob({ status: 'COMPLETE' }), isTerminalJob({ status: 'FAILED' }), isTerminalJob(null)]).toEqual([false, false, true, true, false])
  })
})

// ── The wizard, Live mode ────────────────────────────────────────────────────────────────────────

let opened: LiveEvidence | undefined
beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  webErrorSink.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  installJsdomStubs()
})
afterEach(async () => {
  cleanup()
  await clearToasts()
  toast.clear()
  opened?.bed.dispose()
  opened = undefined
  vi.restoreAllMocks()
})

const asV2 = (item: EvidenceItem): EvidenceItem => ({
  ...item,
  files: (['VIDEO-01', 'VIDEO-02'] as const).map((trackId) => ({ trackId, fileName: `fragments/${trackId}.mp4`, sizeBytes: 3_500, sha256: H(trackId === 'VIDEO-01' ? 'a' : 'b'), fragmentCount: 5 })),
})

/** The SUPERVISOR exports a Core-sealed item: Reason, Authorise, the Core's verification, Export. `jobs` are the answers of operation 87, in order (the last one repeats). */
async function exportSealed(
  jobs: readonly (Record<string, unknown> | 404)[],
  options: { composite?: boolean; accepted?: (evidenceId: string) => { status: number; body: unknown }; job?: boolean } = {},
): Promise<LiveEvidence> {
  let polls = 0
  opened = await openLiveEvidence(`/evidence/${EV.sealed}`, {
    before: (bed) => {
      bed.core.served = { ...bed.core.served, evidence: evidenceWith(bed, EV.sealed, asV2) }
      bed.fake.answer('getTranscript', () => bed.fake.example('getTranscript', 409))
      bed.fake.answer('verifyEvidence', (call) => ({ status: 200, body: { ...RECORDED_VERIFY_V2.pass.body, evidenceId: call.params.id ?? '', at: bed.fake.clock.now() } as EvidenceVerifyResultBody }))
      bed.fake.answer('exportEvidence', (call) => (options.accepted?.(call.params.id ?? '') ?? { status: 202, body: { exportId: 'EXP-000032', evidenceId: call.params.id ?? '', status: 'QUEUED', archiveOnCore: true } }) as never)
      bed.fake.answer('getEvidenceExportJob', () => {
        const job = jobs[Math.min(polls, jobs.length - 1)]!
        polls += 1
        return job === 404 ? bed.fake.example('getEvidenceExportJob', 404) : { status: 200, body: job }
      })
    },
  })
  await findDetailBody()
  fireEvent.click(screen.getByTestId('evidence-export'))
  await screen.findByTestId('export-wizard', {}, UI)
  fireEvent.change(screen.getByTestId('export-reason'), { target: { value: 'Court order 12/2026' } })
  if (options.composite === true) {
    // Pass D5: the kind of the new job, on the Reason step (Live only).
    fireEvent.click(screen.getByTestId('export-kind'))
    fireEvent.click(await screen.findByRole('option', { name: 'Composite' }))
  }
  fireEvent.click(screen.getByTestId('export-next'))
  await screen.findByTestId('export-step-authorise')
  fireEvent.click(screen.getByTestId('export-authorise'))
  fireEvent.click(await screen.findByTestId('export-next'))
  const source = await screen.findByTestId(`export-source-${EV.sealed}`)
  await waitFor(() => expect(source).toHaveAttribute('data-verdict', 'PASS'), UI)
  await waitFor(() => expect(screen.getByTestId('export-next')).not.toBeDisabled())
  fireEvent.click(screen.getByTestId('export-next'))
  fireEvent.click(await screen.findByTestId('export-submit'))
  if (options.job !== false) await screen.findByTestId(`export-job-${EV.sealed}`, {}, UI)
  return opened
}
const job = () => screen.getByTestId(`export-job-${EV.sealed}`)
const jobReads = () => opened!.bed.fake.log.requestsOf('getEvidenceExportJob')

describe('pass D5: the kind of a new export, the job the 202 names, an export already running', () => {
  it('Composite chosen: the request names `kind: COMPOSITE`; the job is read by the `jobId` of the 202; a build without the encoder reads as row 92 worded it', async () => {
    const bed = await exportSealed([{ ...JOB, jobId: 'EXPJ-000777', kind: 'COMPOSITE', derived: true, status: 'FAILED', progressPct: 0, failureReason: 'COMPOSITE_ENCODER_NOT_SELECTED' }], {
      composite: true,
      accepted: (evidenceId) => ({ status: 202, body: { exportId: 'EXP-000032', evidenceId, status: 'QUEUED', jobId: 'EXPJ-000777' } }),
    })
    expect(bed.bed.fake.log.requestsOf('exportEvidence').at(-1)?.body).toMatchObject({ reason: 'Court order 12/2026', kind: 'COMPOSITE' })
    await waitFor(() => expect(job()).toHaveAttribute('data-status', 'FAILED'), POLLS)
    expect(jobReads()[0]?.url).toMatch(/\/api\/v1\/evidence\/exports\/EXPJ-000777$/)
    expect(job()).toHaveTextContent('Composite video is not available in this build.')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('no kind chosen: the request names none (the Core reads PACKAGE)', async () => {
    const bed = await exportSealed([JOB])
    expect(bed.bed.fake.log.requestsOf('exportEvidence').at(-1)?.body).not.toHaveProperty('kind')
  })

  it('409 EXPORT_IN_PROGRESS: its own sentence on the row, not "Only sealed evidence can be exported"; no job is read', async () => {
    await exportSealed([JOB], {
      job: false,
      accepted: () => ({ status: 409, body: { error: { code: 'EXPORT_IN_PROGRESS', message: 'An export job is already running for this evidence item.' } } }),
    })
    const row = await waitFor(() => {
      const found = document.querySelector('[data-export-failure]')
      expect(found).not.toBeNull()
      return found as HTMLElement
    }, UI)
    expect(row).toHaveAttribute('data-export-failure', 'EXPORT_IN_PROGRESS')
    expect(row).toHaveTextContent('An export of this item is already running.')
    expect(row).not.toHaveTextContent('Only sealed evidence can be exported')
    expect(jobReads()).toHaveLength(0)
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('start, poll, result', () => {
  it('Running with the percent of the Core, never backwards; then Complete with the manifest hash and signature; stored on the Core; no download control', async () => {
    await exportSealed([JOB, { ...JOB, progressPct: 20 }, { ...JOB, status: 'COMPLETE', progressPct: 100, etaMs: 0, manifestHash: 'ab'.repeat(32), signature: 'cd'.repeat(64), completedAt: 1_790_824_600_000 }])
    await waitFor(() => expect(job()).toHaveAttribute('data-status', 'RUNNING'), POLLS)
    expect(job()).toHaveTextContent('Export job EXPJ-000032')
    expect(job()).toHaveTextContent('40% done')
    // The read addresses the job by its ID; the first read follows the 202.
    expect(jobReads()[0]?.url).toMatch(/\/api\/v1\/evidence\/exports\/EXPJ-000032$/)
    // The second answer says 20: the bar stays at 40.
    await waitFor(() => expect(jobReads().length).toBeGreaterThanOrEqual(2), POLLS)
    expect(job()).toHaveTextContent('40% done')
    expect(job()).not.toHaveTextContent('20% done')

    await waitFor(() => expect(job()).toHaveAttribute('data-status', 'COMPLETE'), POLLS)
    expect(screen.getByTestId('export-job-complete')).toHaveTextContent('abababababababab')
    expect(screen.getByTestId('export-job-on-core')).toHaveTextContent('The export is stored on the Core (EXP-000032).')
    expect(screen.queryByTestId('export-job-derived')).toBeNull()
    // No download operation exists: a Core-sealed item gets no download control at all.
    expect(screen.queryByTestId(`export-download-${EV.sealed}`)).toBeNull()
    // Finished: the job is not read again.
    const reads = jobReads().length
    await new Promise((resolve) => setTimeout(resolve, EXPORT_JOB_POLL_MS + 400))
    expect(jobReads()).toHaveLength(reads)
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('a failed job', () => {
  it('COMPOSITE_ENCODER_NOT_SELECTED: "Composite video is not available in this build", marked derived, a state and not an alert; reading stops', async () => {
    await exportSealed([{ ...JOB, kind: 'COMPOSITE', derived: true, status: 'FAILED', progressPct: 0, failureReason: 'COMPOSITE_ENCODER_NOT_SELECTED' }])
    await waitFor(() => expect(job()).toHaveAttribute('data-status', 'FAILED'), POLLS)
    const failed = screen.getByTestId('export-job-failed')
    expect(failed).toHaveTextContent('Composite video is not available in this build.')
    expect(failed).toHaveAttribute('role', 'status')
    expect(failed).not.toHaveTextContent(/COMPOSITE_ENCODER|FAILED \(/)
    expect(screen.getByTestId('export-job-derived')).toHaveTextContent('Derived output — not the sealed evidence')
    expect(screen.queryByTestId('export-job-on-core')).toBeNull()
    const reads = jobReads().length
    await new Promise((resolve) => setTimeout(resolve, EXPORT_JOB_POLL_MS + 400))
    expect(jobReads()).toHaveLength(reads)
  })

  it('any other cause: the FAIL wording with the cause of the Core, as an alert; it is an answer, so nothing is recorded as a failed read', async () => {
    await exportSealed([{ ...JOB, status: 'FAILED', progressPct: 60, failureReason: 'SOURCE_VERIFY_FAILED' }])
    await waitFor(() => expect(job()).toHaveAttribute('data-status', 'FAILED'), POLLS)
    expect(screen.getByTestId('export-job-failed')).toHaveTextContent('The export job FAILED (SOURCE_VERIFY_FAILED).')
    expect(screen.getByTestId('export-job-failed')).toHaveAttribute('role', 'alert')
    expect(screen.getByTestId('export-job-status')).toHaveTextContent('FAILED')
    expect(webErrorSink.records().filter((record) => record.source === 'Evidence.export.job')).toEqual([])
    expect(screen.queryByTestId('export-job-read-failed')).toBeNull()
  })
})

describe('an unknown job', () => {
  it('404: the page says the Core has no job for this export, and reads once', async () => {
    await exportSealed([404])
    await waitFor(() => expect(job()).toHaveAttribute('data-status', 'UNKNOWN'), POLLS)
    expect(screen.getByTestId('export-job-unknown')).toHaveTextContent('The Core server has no job for this export.')
    await new Promise((resolve) => setTimeout(resolve, EXPORT_JOB_POLL_MS + 400))
    expect(jobReads()).toHaveLength(1)
  })
})

// Fix pass F-M8 (review findings R93-01, R93-05; controller ruling D178): the signed download of a finished export.
const DOWNLOAD_TOKEN = `exs_CANARY${'q7Zm4xLp0k2Vb6Nc1Hy4GjR8sT3w'.repeat(3)}`.slice(0, 95)
const DOWNLOAD_PATH = `/exports/${DOWNLOAD_TOKEN}`
const COMPLETE_JOB = { ...JOB, status: 'COMPLETE', progressPct: 100, etaMs: 0, manifestHash: 'ab'.repeat(32), signature: 'cd'.repeat(64), completedAt: 1_790_824_600_000 }
const WITH_DOWNLOAD = { ...COMPLETE_JOB, download: { path: DOWNLOAD_PATH, expiresAt: 1_790_824_660_000 } }

describe('fix F-M8: the download member of a job answer', () => {
  it('only a path of the download route on a COMPLETE job is one; the job this page keeps holds the FACT, never the path', () => {
    expect(readExportDownload(WITH_DOWNLOAD)).toEqual({ path: DOWNLOAD_PATH, expiresAt: 1_790_824_660_000 })
    for (const bad of [
      COMPLETE_JOB,
      { ...WITH_DOWNLOAD, status: 'RUNNING' },
      { ...COMPLETE_JOB, download: { path: `http://127.0.0.1:8443${DOWNLOAD_PATH}`, expiresAt: 1 } },
      { ...COMPLETE_JOB, download: { path: `${DOWNLOAD_PATH}?next=1`, expiresAt: 1 } },
      { ...COMPLETE_JOB, download: { path: `/media/${DOWNLOAD_TOKEN}`, expiresAt: 1 } },
      { ...COMPLETE_JOB, download: { path: `/exports/../api/v1/${DOWNLOAD_TOKEN}`, expiresAt: 1 } },
      { ...COMPLETE_JOB, download: { path: DOWNLOAD_PATH } },
      { ...COMPLETE_JOB, download: DOWNLOAD_PATH },
      null,
    ]) {
      expect(readExportDownload(bad)).toBeNull()
    }
    const kept = readExportJob(WITH_DOWNLOAD)
    expect(kept?.downloadable).toBe(true)
    expect(JSON.stringify(kept)).not.toContain('exs_')
    expect(readExportJob(COMPLETE_JOB)?.downloadable).toBe(false)
  })
})

describe('fix F-M8: "Download export" on a COMPLETE job (web; UX 6.6)', () => {
  it('the press reads the job once more and hands its fresh signed path to the browser; CANARY: the path is in no cache, key, record, storage, address or markup', async () => {
    const followed: string[] = []
    const consoleCalls: unknown[][] = []
    for (const level of ['error', 'warn', 'log', 'info', 'debug'] as const) vi.spyOn(console, level).mockImplementation((...parts: unknown[]) => void consoleCalls.push(parts))
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      followed.push(this.getAttribute('href') ?? '')
    })
    const live = await exportSealed([WITH_DOWNLOAD])
    await waitFor(() => expect(job()).toHaveAttribute('data-status', 'COMPLETE'), POLLS)
    // A job the Core names a download for draws the control, not the "stored on the Core" line.
    expect(screen.queryByTestId('export-job-on-core')).toBeNull()
    const button = screen.getByTestId('export-job-download')
    expect(button).toHaveTextContent('Download export')
    const reads = jobReads().length
    expect(followed).toEqual([])

    fireEvent.click(button)
    await waitFor(() => expect(followed).toEqual([DOWNLOAD_PATH]))
    // ONE fresh read of operation 87 for the press, and no query of the page was started for it.
    expect(jobReads()).toHaveLength(reads + 1)
    expect(screen.queryByTestId('export-job-download-failed')).toBeNull()

    const cache = live.queryClient.getQueryCache().getAll()
    const storage = (area: Storage) => Array.from({ length: area.length }, (_, index) => `${area.key(index)}=${area.getItem(area.key(index) ?? '')}`)
    const reported = JSON.stringify({
      sink: webErrorSink.records(),
      pageSink: live.page.sink.records(),
      console: consoleCalls.map((call) => call.map((part) => (part instanceof Error ? `${part.message} ${part.stack}` : part))),
      html: document.body.innerHTML,
      queryKeys: cache.map((query) => query.queryKey),
      queryData: cache.map((query) => ({ data: query.state.data, error: String(query.state.error) })),
      mutations: live.queryClient.getMutationCache().getAll().map((mutation) => ({ variables: mutation.state.variables, data: mutation.state.data })),
      urls: live.bed.fake.log.requests.map((call) => call.url),
      location: `${window.location.href} ${live.router.state.location.href}`,
      history: JSON.stringify(window.history.state),
      local: storage(window.localStorage),
      session: storage(window.sessionStorage),
    })
    // CONTROL of the canary: the job itself IS in the cache (found by its manifest hash).
    expect(reported).toContain('ab'.repeat(32))
    expect(['CANARY', 'exs_', DOWNLOAD_TOKEN].filter((needle) => reported.includes(needle))).toEqual([])
    // The anchor lived for one click.
    expect(document.querySelector(`a[href^="/exports/"]`)).toBeNull()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('a job the Core names NO download for (a simulated export) keeps the "stored on the Core" line and draws no control', async () => {
    await exportSealed([COMPLETE_JOB])
    await waitFor(() => expect(job()).toHaveAttribute('data-status', 'COMPLETE'), POLLS)
    expect(screen.getByTestId('export-job-on-core')).toBeInTheDocument()
    expect(screen.queryByTestId('export-job-download')).toBeNull()
  })

  it('the fresh read names no download any more: nothing is followed, the page says so, and the next press waits its cooldown', async () => {
    const followed: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      followed.push(this.getAttribute('href') ?? '')
    })
    await exportSealed([WITH_DOWNLOAD, COMPLETE_JOB])
    await waitFor(() => expect(job()).toHaveAttribute('data-status', 'COMPLETE'), POLLS)
    fireEvent.click(screen.getByTestId('export-job-download'))
    const failed = await screen.findByTestId('export-job-download-failed')
    expect(failed).toHaveAttribute('data-outcome', 'UNAVAILABLE')
    expect(failed).toHaveTextContent('This export cannot be downloaded right now.')
    expect(followed).toEqual([])
    // Rate-limited: the first retry is free of a wait only once it was consumed; a second press right after it is refused.
    const reads = jobReads().length
    fireEvent.click(screen.getByTestId('export-job-download'))
    await waitFor(() => expect(jobReads()).toHaveLength(reads + 1))
    await waitFor(() => expect(screen.getByTestId('export-job-download')).toBeDisabled())
  })
})

describe('fix F-M8: named causes of a FAILED job (R93-01, R93-04)', () => {
  it('EXPORT_INTERRUPTED and EXPORT_JOBS_NOT_AVAILABLE read as what happened and that nothing was exported', async () => {
    await exportSealed([{ ...JOB, status: 'FAILED', progressPct: 0, failureReason: 'EXPORT_INTERRUPTED' }])
    await waitFor(() => expect(job()).toHaveAttribute('data-status', 'FAILED'), POLLS)
    expect(screen.getByTestId('export-job-failed')).toHaveTextContent('The export was interrupted (the Core server stopped). Nothing was exported: export again.')
  })
})

describe('G94b-06 (fix wave K): the "stored on the Core" sentence follows `archiveOnCore` of the 202 of operation 42', () => {
  const COMPLETE = { ...JOB, status: 'COMPLETE', progressPct: 100, etaMs: 0, manifestHash: 'ab'.repeat(32), signature: 'cd'.repeat(64), completedAt: 1_790_824_600_000 }
  const answered = (body: Record<string, unknown>) => (evidenceId: string) => ({ status: 202, body: { ...body, evidenceId } })
  const { archiveOnCore: _stated, ...NOT_STATED } = EXPORT_ACCEPTED_NO_ARCHIVE_EXAMPLE

  it('the model reads the member by name: a boolean is handed on, anything else is "not stated"', () => {
    expect(answeredArchiveOnCoreOf({ ok: true, status: 202, exportId: 'EXP-000032', archiveOnCore: false })).toBe(false)
    expect(answeredArchiveOnCoreOf({ ok: true, status: 202, exportId: 'EXP-000032', archiveOnCore: true })).toBe(true)
    expect(answeredArchiveOnCoreOf(NOT_STATED)).toBeNull()
    expect(answeredArchiveOnCoreOf({ archiveOnCore: 'yes' })).toBeNull()
    expect(answeredArchiveOnCoreOf(null)).toBeNull()
  })

  it('`archiveOnCore: false` (EXPORT_ACCEPTED_NO_ARCHIVE_EXAMPLE, a simulated capture): a finished job says a demonstration writes no archive, never "stored on the Core"', async () => {
    expect(EXPORT_ACCEPTED_NO_ARCHIVE_EXAMPLE.archiveOnCore).toBe(false)
    await exportSealed([COMPLETE], { accepted: answered(EXPORT_ACCEPTED_NO_ARCHIVE_EXAMPLE) })
    await waitFor(() => expect(job()).toHaveAttribute('data-status', 'COMPLETE'), POLLS)
    expect(screen.getByTestId('export-job-no-archive')).toHaveTextContent('Demonstration: no archive is written.')
    expect(screen.getByTestId('export-job-no-archive')).toHaveAttribute('data-archive-on-core', 'false')
    expect(screen.queryByTestId('export-job-on-core')).toBeNull()
    expect(screen.queryByText(/stored on the Core/)).toBeNull()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('control: `archiveOnCore: true` (the example with the Core\'s statement turned) - the Core stores the archive and the sentence says so', async () => {
    await exportSealed([COMPLETE], { accepted: answered({ ...EXPORT_ACCEPTED_NO_ARCHIVE_EXAMPLE, archiveOnCore: true }) })
    await waitFor(() => expect(job()).toHaveAttribute('data-status', 'COMPLETE'), POLLS)
    expect(screen.getByTestId('export-job-on-core')).toHaveTextContent('The export is stored on the Core (EXP-000032).')
    expect(screen.queryByTestId('export-job-no-archive')).toBeNull()
  })

  it('control: the 202 states nothing (an older Core) - no archive is claimed', async () => {
    await exportSealed([COMPLETE], { accepted: answered(NOT_STATED) })
    await waitFor(() => expect(job()).toHaveAttribute('data-status', 'COMPLETE'), POLLS)
    expect(screen.getByTestId('export-job-no-archive')).toHaveTextContent('The Core server states no archive for this export.')
    expect(screen.getByTestId('export-job-no-archive')).toHaveAttribute('data-archive-on-core', 'not-stated')
    expect(screen.queryByTestId('export-job-on-core')).toBeNull()
  })
})
