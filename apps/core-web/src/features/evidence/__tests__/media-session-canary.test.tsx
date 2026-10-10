/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Blueprint row 92 (M8-W3): playback of the sealed files through the media session of operation 88,
// on the Evidence detail page in Live mode (the contract-checked fake transport, the real Live
// start-up, the real router). UX spec flow 5; SEC35-12 / SEC35-13; register E-31; row 137's canary
// pattern.
//
// | Criterion | Where |
// |-----------|-------|
// | `media.source: LIVE_STREAM` enables Play; a press sends operation 88 once per camera file and nothing is asked on mount | "opens on a press" |
// | THE CANARY: the two signed URLs are on the `src` of their own media element and NOWHERE ELSE — not in the error sink, the page's log, a console call, a toast, the markup outside those two attributes, a query key, a query entry, the mutation cache, a request URL, the page address or browser storage; also after a media error and after the player is gone | "the media-session token" |
// | NEGATIVE CONTROL: the same search finds both tokens in the two `src` attributes | "the media-session token" |
// | The two players share one clock: the second is muted and re-aligned beyond the tolerance; the band shows the microphone at the playhead | "two files, one clock" |
// | Only the PATH of the answered URL is used; a URL that is not the media route is refused | "the media path" |
// | The session lives 60 s: a media error renews it ONCE and goes back to the same position, playing on; a second error at the same place stops there with its position (no loop); a seek on a session at its end renews first | "renewal" |
// | A failed fragment (`FRAGMENT_NOT_AUTHENTIC`) is an integrity failure with its file and fragment, never a player error | "refusals" |
// | `409 MEDIA_NOT_AVAILABLE`: the fixed message, no player, no retry; another failure: the failed state with a rate-limited "Open again" | "refusals" |
// | SEAM: when both answers name the same file, one player is drawn and the page says so | "one file" |
// | The item badge "Development source": header and list row in Live mode for `developmentSources: true` only; never in Simulated mode (M7-DEVSRC-EVID-W, software part) | "the development badge" |
import { act, cleanup, configure, fireEvent, screen, waitFor } from '@testing-library/react'
import { toast } from '@heroui/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { EvidenceItem } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import { MEDIA_SESSION_RENEW_MARGIN_MS, MediaSession, cameraFilesOf, mediaPathOf, mediaSessionStale } from '../media-session'
import { RECORDED_VERIFY_V2 } from './fixtures/verify-v2-recorded'
import { createDatasetSim, evidenceIdOf, mountEvidence, stopSims } from './harness'
import { clearToasts, EV, evidenceWith, findDetailBody, installJsdomStubs, openLiveEvidence, toastTexts, type LiveEvidence, serveMediaRoute } from './live-evidence-bed'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 40_000 })

const P = en.evidence.playback
const UI = { timeout: 15_000 }
const TOKEN_1 = 'mts_CANARYone7Qm4xZp0Lk2'
const TOKEN_2 = 'mts_CANARYtwo9Zx1vBn3Hd5'
// As the Core answers it: an absolute loopback URL. The console uses its PATH only, same-origin.
const URL_1 = `http://127.0.0.1:8443/media/${TOKEN_1}`
const URL_2 = `http://127.0.0.1:8443/media/${TOKEN_2}`
const PATH_1 = `/media/${TOKEN_1}`
const PATH_2 = `/media/${TOKEN_2}`
const H = (char: string) => char.repeat(64)

/** The served item as a Core-sealed schema-v2 item recorded from development sources. */
const asSealedV2 =
  (developmentSources: boolean | null | 'absent', fileIds: readonly ('VIDEO-01' | 'VIDEO-02')[] = ['VIDEO-01', 'VIDEO-02']) =>
  (item: EvidenceItem): EvidenceItem => ({
    ...item,
    durationMs: 120_000,
    files: fileIds.map((trackId) => ({ trackId, fileName: `fragments/${trackId}.mp4`, sizeBytes: 3_500, sha256: H(trackId === 'VIDEO-01' ? 'a' : 'b'), fragmentCount: 5 })),
    ...(developmentSources === 'absent' ? {} : { developmentSources }),
    ...({
      audioSourceIntervals: [
        { seq: 1, inputId: 'MIC-01', role: 'PRIMARY', fromMs: 0, toMs: 30_000, reason: 'START' },
        { seq: 2, inputId: 'MIC-02', role: 'STANDBY', fromMs: 30_000, toMs: null, reason: 'MANUAL' },
      ],
    } as Partial<EvidenceItem>),
  })

let opened: LiveEvidence | undefined
let consoleCalls: unknown[][] = []

beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  webErrorSink.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  installJsdomStubs()
  Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: vi.fn() })
  consoleCalls = []
  for (const level of ['error', 'warn', 'log', 'info', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...parts: unknown[]) => void consoleCalls.push(parts))
  }
})
afterEach(async () => {
  cleanup()
  await clearToasts()
  toast.clear()
  opened?.bed.dispose()
  opened = undefined
  stopSims()
  vi.restoreAllMocks()
})

const sessionAnswer = (evidenceId: string, fileId: 'VIDEO-01' | 'VIDEO-02', url: string, expiresAt: number) => ({ status: 201, body: { evidenceId, fileId, url, expiresAt, ranges: true as const } })

async function openSealed(script: (live: LiveEvidence['bed'], calls: { count: number }) => void, developmentSources: boolean | null | 'absent' = true, fileIds?: readonly ('VIDEO-01' | 'VIDEO-02')[]): Promise<LiveEvidence> {
  const calls = { count: 0 }
  opened = await openLiveEvidence(`/evidence/${EV.sealed}?tab=media`, {
    media: { [EV.sealed]: { source: 'LIVE_STREAM', packageSuffix: null } },
    before: (bed) => {
      bed.core.served = { ...bed.core.served, evidence: evidenceWith(bed, EV.sealed, asSealedV2(developmentSources, fileIds)) }
      // The item carries no transcript in these tests: the pane says "not available yet".
      bed.fake.answer('getTranscript', () => bed.fake.example('getTranscript', 409))
      script(bed, calls)
    },
  })
  await findDetailBody()
  await screen.findByTestId('evidence-playback', {}, UI)
  // Fix wave K (G94b-02): the player asks the media route about a file that stopped; a healthy Core serves it.
  serveMediaRoute()
  return opened
}

const bothFiles = (bed: LiveEvidence['bed'], calls: { count: number }) =>
  bed.fake.answer('createEvidenceMediaSession', (call) => {
    calls.count += 1
    const expiresAt = bed.fake.clock.now() + 60_000
    return calls.count % 2 === 1 ? sessionAnswer(call.params.id ?? '', 'VIDEO-01', URL_1, expiresAt) : sessionAnswer(call.params.id ?? '', 'VIDEO-02', URL_2, expiresAt)
  })

const video = (fileId: string) => screen.getByTestId(`evidence-sealed-video-${fileId}`) as HTMLVideoElement
const sessionRequests = () => opened!.bed.fake.log.requestsOf('createEvidenceMediaSession')

/** The markup without the ONE place a media URL has to be: the `src` of the two sealed players. */
function markupWithoutPlayerSources(): string {
  const copy = document.body.cloneNode(true) as HTMLElement
  for (const element of Array.from(copy.querySelectorAll('video[data-sealed-file]'))) element.removeAttribute('src')
  return copy.innerHTML
}

/** Everything a media URL could have been written to, as one text. */
function reported(live: LiveEvidence): string {
  const cache = live.queryClient.getQueryCache().getAll()
  const storage = (area: Storage) => Array.from({ length: area.length }, (_, index) => `${area.key(index)}=${area.getItem(area.key(index) ?? '')}`)
  return JSON.stringify({
    sink: webErrorSink.records(),
    pageSink: live.page.sink.records(),
    console: consoleCalls.map((call) => call.map((part) => (part instanceof Error ? `${part.message} ${part.stack}` : part))),
    toasts: toastTexts(),
    html: markupWithoutPlayerSources(),
    queryKeys: cache.map((query) => query.queryKey),
    queryData: cache.map((query) => ({ data: query.state.data, error: String(query.state.error) })),
    mutations: live.queryClient.getMutationCache().getAll().map((mutation) => ({ variables: mutation.state.variables, data: mutation.state.data })),
    urls: live.bed.fake.log.requests.map((call) => call.url),
    location: `${window.location.href} ${live.router.state.location.href}`,
    history: JSON.stringify(window.history.state),
    local: storage(window.localStorage),
    session: storage(window.sessionStorage),
  })
}
const leaks = (text: string): string[] => [TOKEN_1, TOKEN_2, 'CANARY', 'mts_'].filter((needle) => text.includes(needle))

describe('opens on a press', () => {
  it('LIVE_STREAM enables Play; nothing is asked on mount; one press sends operation 88 once per camera file', async () => {
    await openSealed(bothFiles)
    expect(screen.getByTestId('evidence-media-panel')).toHaveAttribute('data-playback', 'sealed')
    expect(screen.getByTestId('evidence-play')).toBeEnabled()
    expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-phase', 'idle')
    expect(screen.getByTestId('evidence-playback-open')).toHaveAttribute('data-gate', 'ALLOWED')
    expect(sessionRequests()).toHaveLength(0)

    fireEvent.click(screen.getByTestId('evidence-playback-open'))
    await waitFor(() => expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-phase', 'ready'), UI)
    expect(sessionRequests()).toHaveLength(2)
    // The request carries no body and no query: the evidence ID in the path, nothing else.
    for (const call of sessionRequests()) expect(call.url).toMatch(new RegExp(`/api/v1/evidence/${EV.sealed}/media-sessions$`))
    expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-files', 'VIDEO-01 VIDEO-02')
    expect(screen.queryByTestId('evidence-playback-one-file')).toBeNull()
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('the media-session token', () => {
  it('is on the `src` of its own player and nowhere else: while playing, after a media error, and after the player is gone', async () => {
    const live = await openSealed(bothFiles)
    fireEvent.click(screen.getByTestId('evidence-playback-open'))
    await waitFor(() => expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-phase', 'ready'), UI)

    // NEGATIVE CONTROL: the search finds each token where it has to be.
    expect(video('VIDEO-01').getAttribute('src')).toBe(PATH_1)
    expect(video('VIDEO-02').getAttribute('src')).toBe(PATH_2)
    // Only the path: the host and the port of the answered URL are never used (same-origin).
    expect(document.body.innerHTML).not.toContain('8443')
    expect(leaks(document.body.innerHTML)).toEqual([TOKEN_1, TOKEN_2, 'CANARY', 'mts_'])
    expect(leaks(JSON.stringify({ html: document.body.innerHTML }))).not.toEqual([])

    fireEvent.click(screen.getByTestId('evidence-sealed-play-toggle'))
    await waitFor(() => expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-playing', 'true'))
    expect(leaks(reported(live))).toEqual([])

    // A media error (the session ended): one record is written — with no URL in it — and the session is renewed.
    fireEvent.error(video('VIDEO-02'))
    await waitFor(() => expect(sessionRequests()).toHaveLength(4))
    await waitFor(() => expect(screen.queryByTestId('evidence-playback-renewing')).toBeNull())
    const records = webErrorSink.records().filter((record) => record.source === 'Evidence.playback.mediaError')
    expect(records).toHaveLength(1)
    expect(records[0]?.context).toMatchObject({ evidenceId: EV.sealed, fileId: 'VIDEO-02' })
    expect(leaks(reported(live))).toEqual([])

    // The session object itself does not print or serialise its URL.
    const session = new MediaSession('VIDEO-01', PATH_1, 5)
    expect(leaks(`${String(session)} ${JSON.stringify(session)} ${JSON.stringify({ ...session })} ${Object.values(session).join(' ')}`)).toEqual([])
    expect(session.takeUrl()).toBe(PATH_1)

    // The player goes (another tab): the URL is taken off the elements, and nothing kept it.
    const first = video('VIDEO-01')
    fireEvent.click(screen.getByTestId('evidence-tab-metadata'))
    await waitFor(() => expect(screen.queryByTestId('evidence-playback')).toBeNull())
    expect(first.hasAttribute('src')).toBe(false)
    expect(leaks(document.body.innerHTML)).toEqual([])
    expect(leaks(reported(live))).toEqual([])
  })
})

describe('two files, one clock', () => {
  it('the second file is muted and follows the first beyond the tolerance; the band names the microphone at the playhead', async () => {
    await openSealed(bothFiles)
    fireEvent.click(screen.getByTestId('evidence-playback-open'))
    await waitFor(() => expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-phase', 'ready'), UI)
    const lead = video('VIDEO-01')
    const follower = video('VIDEO-02')
    expect([lead.muted, follower.muted]).toEqual([false, true])
    expect([lead.dataset.leading, follower.dataset.leading]).toEqual(['true', 'false'])

    lead.currentTime = 45
    follower.currentTime = 44.9
    fireEvent.timeUpdate(lead)
    // Inside the tolerance: the follower is left alone.
    expect(follower.currentTime).toBe(44.9)
    expect(screen.getByTestId('evidence-sealed-time')).toHaveTextContent('0:45 / 2:00')
    expect(screen.getByTestId('evidence-band-now')).toHaveTextContent('Audio at the playhead: MIC 2')
    follower.currentTime = 40
    fireEvent.timeUpdate(lead)
    expect(follower.currentTime).toBe(45)
    // A time update of the follower moves nothing: the leading file is the clock.
    follower.currentTime = 10
    fireEvent.timeUpdate(follower)
    expect(screen.getByTestId('evidence-sealed-time')).toHaveTextContent('0:45 / 2:00')
    expect(screen.getByTestId('evidence-band-segment-1')).toHaveAttribute('width', '25')
  })
})

describe('the media path', () => {
  it('only `/media/mts_…` of the answered URL is used; anything else is no session', () => {
    expect(mediaPathOf(URL_1)).toBe(PATH_1)
    expect(mediaPathOf(`https://core.example:9/media/${TOKEN_1}`)).toBe(PATH_1)
    for (const url of [`http://127.0.0.1/api/v1/evidence/${TOKEN_1}`, `http://127.0.0.1/media/${TOKEN_1}?next=1`, `http://127.0.0.1/media/${TOKEN_1}/../x`, 'http://127.0.0.1/media/ses_abc', `/media/${TOKEN_1}`, 'javascript:alert(1)', '', null, 7]) {
      expect(mediaPathOf(url), String(url)).toBeNull()
    }
    expect(mediaSessionStale({ expiresAt: 60_000 }, 60_000 - MEDIA_SESSION_RENEW_MARGIN_MS - 1)).toBe(false)
    expect(mediaSessionStale({ expiresAt: 60_000 }, 60_000 - MEDIA_SESSION_RENEW_MARGIN_MS)).toBe(true)
    // Fix F-M8: the camera files of an item are the ones it names (one or two); an item that names none is asked for both.
    expect(cameraFilesOf({ files: [{ trackId: 'VIDEO-01' }, { trackId: 'VIDEO-02' }] })).toEqual(['VIDEO-01', 'VIDEO-02'])
    expect(cameraFilesOf({ files: [{ trackId: 'VIDEO-02' }] })).toEqual(['VIDEO-02'])
    expect(cameraFilesOf({ files: [] })).toEqual(['VIDEO-01', 'VIDEO-02'])
  })
})

describe('renewal (the session lives 60 s)', () => {
  it('a media error renews once, goes back to the same position and plays on; a second error at the same place stops there', async () => {
    await openSealed(bothFiles)
    fireEvent.click(screen.getByTestId('evidence-playback-open'))
    await waitFor(() => expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-phase', 'ready'), UI)
    fireEvent.click(screen.getByTestId('evidence-sealed-play-toggle'))
    video('VIDEO-01').currentTime = 70
    fireEvent.timeUpdate(video('VIDEO-01'))
    expect(screen.getByTestId('evidence-sealed-time')).toHaveTextContent('1:10 / 2:00')

    fireEvent.error(video('VIDEO-01'))
    await waitFor(() => expect(sessionRequests()).toHaveLength(4))
    await waitFor(() => expect(screen.queryByTestId('evidence-playback-renewing')).toBeNull())
    // The same place, on the new session, playing again; no stopped state, no generic error.
    expect([video('VIDEO-01').currentTime, video('VIDEO-02').currentTime]).toEqual([70, 70])
    expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-playing', 'true')
    expect(screen.queryByTestId('evidence-playback-stopped')).toBeNull()
    expect(screen.getByTestId('evidence-sealed-time')).toHaveTextContent('1:10 / 2:00')

    // The error comes back at the same place: no second renewal by itself.
    fireEvent.error(video('VIDEO-01'))
    await screen.findByTestId('evidence-playback-stopped')
    expect(sessionRequests()).toHaveLength(4)
    expect(screen.getByTestId('evidence-playback-stopped')).toHaveTextContent('Playback stopped at 1:10 and did not resume.')
    expect(screen.getByTestId('evidence-playback-stopped')).toHaveAttribute('data-integrity', 'false')
    expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-playing', 'false')
  })

  it('a seek on a session at its end renews first and then goes there', async () => {
    const { bed } = await openSealed(bothFiles)
    fireEvent.click(screen.getByTestId('evidence-playback-open'))
    await waitFor(() => expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-phase', 'ready'), UI)
    const scrub = () => screen.getByTestId('evidence-sealed-scrub').querySelector('input') as HTMLInputElement
    // Fresh: a seek asks nothing of the Core.
    fireEvent.change(scrub(), { target: { value: '20' } })
    expect(sessionRequests()).toHaveLength(2)
    expect(video('VIDEO-01').currentTime).toBe(20)
    // 58 s later the session (60 s) is inside its margin.
    await bed.elapse(58_000, 1_000)
    fireEvent.change(scrub(), { target: { value: '90' } })
    await waitFor(() => expect(sessionRequests()).toHaveLength(4))
    await waitFor(() => expect(video('VIDEO-01').currentTime).toBe(90))
    expect(video('VIDEO-02').currentTime).toBe(90)
  })
})

describe('refusals', () => {
  it('R93-12: operation 88 names no fragment - a 409 of it is the fixed "no playback media" state whatever its details say, never an integrity sentence of this player', async () => {
    await openSealed((bed) =>
      bed.fake.answer('createEvidenceMediaSession', () => ({
        status: 409,
        body: { error: { code: 'MEDIA_NOT_AVAILABLE', message: 'No playback media is available for this evidence item.', details: { reason: 'FRAGMENT_NOT_AUTHENTIC', fileId: 'VIDEO-02', seq: 0 } } },
      })),
    )
    fireEvent.click(screen.getByTestId('evidence-playback-open'))
    await screen.findByTestId('evidence-playback-refused', {}, UI)
    expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-refusal', 'NOT_AVAILABLE')
    expect(screen.getByTestId('evidence-playback-refused')).toHaveTextContent('No playback media is available for this evidence item.')
    expect(screen.getByTestId('evidence-playback-refused')).not.toHaveTextContent('fragment')
  })

  it('409 MEDIA_NOT_AVAILABLE: the fixed message, no player, no retry, one request', async () => {
    await openSealed((bed) => bed.fake.answer('createEvidenceMediaSession', () => bed.fake.example('createEvidenceMediaSession', 409)))
    fireEvent.click(screen.getByTestId('evidence-playback-open'))
    await screen.findByTestId('evidence-playback-refused', {}, UI)
    expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-refusal', 'NOT_AVAILABLE')
    expect(screen.getByTestId('evidence-playback-refused')).toHaveTextContent('No playback media is available for this evidence item.')
    expect(screen.queryByTestId('evidence-playback-reopen')).toBeNull()
    expect(document.querySelector('video[data-sealed-file]')).toBeNull()
    expect(sessionRequests()).toHaveLength(1)
  })

  it('an answer that is no session: the failed state, one record with codes, and "Open again" behind its cooldown', async () => {
    await openSealed((bed) => bed.fake.answer('createEvidenceMediaSession', () => bed.fake.example('createEvidenceMediaSession', 404)))
    fireEvent.click(screen.getByTestId('evidence-playback-open'))
    await screen.findByTestId('evidence-playback-refused', {}, UI)
    expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-refusal', 'FAILED')
    expect(screen.getByTestId('evidence-playback-refused')).toHaveTextContent(P.failed)
    expect(screen.getByTestId('evidence-playback-refused')).not.toHaveTextContent(/integrity/i)
    expect(sessionRequests()).toHaveLength(1)
    // The retry is a press, and a second press inside the cooldown sends nothing.
    fireEvent.click(screen.getByTestId('evidence-playback-reopen'))
    await waitFor(() => expect(sessionRequests()).toHaveLength(2))
    await screen.findByTestId('evidence-playback-refused', {}, UI)
    expect(screen.getByTestId('evidence-playback-reopen')).toBeDisabled()
    fireEvent.click(screen.getByTestId('evidence-playback-reopen'))
    await act(async () => {
      await Promise.resolve()
    })
    expect(sessionRequests()).toHaveLength(2)
  })
})

describe('one file (the seam of operation 88: the contract cannot name the file yet)', () => {
  it('both answers name VIDEO-01: one player, its first session kept, and the page says the other file is not shown', async () => {
    await openSealed((bed, calls) =>
      bed.fake.answer('createEvidenceMediaSession', (call) => {
        calls.count += 1
        return sessionAnswer(call.params.id ?? '', 'VIDEO-01', calls.count === 1 ? URL_1 : URL_2, bed.fake.clock.now() + 60_000)
      }),
    )
    fireEvent.click(screen.getByTestId('evidence-playback-open'))
    await waitFor(() => expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-phase', 'ready'), UI)
    expect(sessionRequests()).toHaveLength(2)
    expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-files', 'VIDEO-01')
    expect(video('VIDEO-01').getAttribute('src')).toBe(PATH_1)
    expect(screen.queryByTestId('evidence-sealed-video-VIDEO-02')).toBeNull()
    expect(screen.getByTestId('evidence-playback-one-file')).toBeInTheDocument()
  })
})

describe('fix F-M8: a package of ONE camera', () => {
  it('an item that names one camera file is asked for that file only: one request, one player, and no "other file" note', async () => {
    await openSealed(
      (bed, calls) =>
        bed.fake.answer('createEvidenceMediaSession', (call) => {
          calls.count += 1
          return sessionAnswer(call.params.id ?? '', 'VIDEO-01', URL_1, bed.fake.clock.now() + 60_000)
        }),
      true,
      ['VIDEO-01'],
    )
    fireEvent.click(screen.getByTestId('evidence-playback-open'))
    await waitFor(() => expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-phase', 'ready'), UI)
    expect(sessionRequests()).toHaveLength(1)
    expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-files', 'VIDEO-01')
    expect(video('VIDEO-01').getAttribute('src')).toBe(PATH_1)
    expect(screen.queryByTestId('evidence-sealed-video-VIDEO-02')).toBeNull()
    expect(screen.queryByTestId('evidence-playback-one-file')).toBeNull()
  })

  it('the Core says the second file is not in the package (409 CAMERA_FILE_NOT_IN_PACKAGE): the first file plays, nothing is refused', async () => {
    await openSealed((bed, calls) =>
      bed.fake.answer('createEvidenceMediaSession', (call) => {
        calls.count += 1
        if (calls.count === 2) return { status: 409, body: { error: { code: 'MEDIA_NOT_AVAILABLE', message: 'No playback media is available for this evidence item.', details: { reason: 'CAMERA_FILE_NOT_IN_PACKAGE', fileId: 'VIDEO-02' } } } }
        return sessionAnswer(call.params.id ?? '', 'VIDEO-01', URL_1, bed.fake.clock.now() + 60_000)
      }),
    )
    fireEvent.click(screen.getByTestId('evidence-playback-open'))
    await waitFor(() => expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-phase', 'ready'), UI)
    expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-files', 'VIDEO-01')
    expect(screen.queryByTestId('evidence-playback-refused')).toBeNull()
  })
})

describe('R93-14: a player that does not start does not keep the Pause icon', () => {
  it('a rejected play() of the leading file takes the playing state back', async () => {
    await openSealed(bothFiles)
    fireEvent.click(screen.getByTestId('evidence-playback-open'))
    await waitFor(() => expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-phase', 'ready'), UI)
    // The autoplay rule (after an awaited renewal there is no user gesture left): play() rejects.
    Object.defineProperty(video('VIDEO-01'), 'play', { configurable: true, value: () => Promise.reject(new DOMException('not allowed', 'NotAllowedError')) })
    fireEvent.click(screen.getByTestId('evidence-sealed-play-toggle'))
    await waitFor(() => expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-playing', 'false'))
  })
})

// Closing pass F-X (review row 93, R93-13): the render of the sentence, on the page, after a real verify run.
describe('R93-13: after a stop, what the last Verify run found is said as that - not as the place where playback stopped', () => {
  /** Verify answers `name` on the Integrity tab; then playback of both files stops at 1:10 (an error, one renewal, the error again). */
  async function verifyThenStop(name: 'tamperedFragment' | 'pass'): Promise<HTMLElement> {
    await openSealed((bed, calls) => {
      bothFiles(bed, calls)
      bed.fake.answer('verifyEvidence', (call) => ({ status: 200, body: { ...RECORDED_VERIFY_V2[name].body, evidenceId: call.params.id ?? '', at: bed.fake.clock.now() } }) as never)
    })
    fireEvent.click(screen.getByTestId('evidence-tab-integrity'))
    fireEvent.click(await screen.findByTestId('evidence-verify', {}, UI))
    await waitFor(() => expect(screen.getByTestId('evidence-verify-v2')).toHaveAttribute('data-verdict', name === 'pass' ? 'PASS' : 'FAIL'), UI)
    fireEvent.click(screen.getByTestId('evidence-tab-media'))
    fireEvent.click(await screen.findByTestId('evidence-playback-open', {}, UI))
    await waitFor(() => expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-phase', 'ready'), UI)
    fireEvent.click(screen.getByTestId('evidence-sealed-play-toggle'))
    video('VIDEO-01').currentTime = 70
    fireEvent.timeUpdate(video('VIDEO-01'))
    fireEvent.error(video('VIDEO-01'))
    await waitFor(() => expect(sessionRequests()).toHaveLength(4))
    await waitFor(() => expect(screen.queryByTestId('evidence-playback-renewing')).toBeNull())
    fireEvent.error(video('VIDEO-01'))
    return screen.findByTestId('evidence-playback-stopped')
  }

  it('the last verify run names VIDEO-02 fragment 3: "(Verify: VIDEO-02 fragment 3)", never "at VIDEO-02 fragment 3", and no "Open again"', async () => {
    const stopped = await verifyThenStop('tamperedFragment')
    expect(stopped).toHaveAttribute('data-integrity', 'true')
    expect(stopped.textContent).toBe('This recording failed its integrity check (Verify: VIDEO-02 fragment 3).')
    expect(stopped.textContent).not.toMatch(/\bat VIDEO-0\d fragment/)
    expect(stopped).not.toHaveTextContent('Playback stopped at')
    expect(screen.queryByTestId('evidence-playback-reopen')).toBeNull()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('CONTROL: the last verify run named no failed fragment - the stop names its position and points to Verify, with "Open again"', async () => {
    const stopped = await verifyThenStop('pass')
    expect(stopped).toHaveAttribute('data-integrity', 'false')
    expect(stopped).toHaveTextContent(/Playback stopped at 1:10 and did not resume\..*run Verify to see which\./)
    expect(stopped).not.toHaveTextContent('failed its integrity check')
    expect(screen.getByTestId('evidence-playback-reopen')).toBeInTheDocument()
  })
})

describe('the development badge (R-11; D83, D91)', () => {
  it('Live mode, `developmentSources: true`: the badge on the item header', async () => {
    await openSealed(bothFiles, true)
    expect(screen.getByTestId('evidence-detail-development')).toHaveTextContent(en.common.sourceClass.badge)
  })

  it('Live mode, `false`, `null` and no member: no badge — and no word "production" anywhere on the page', async () => {
    for (const value of [false, null, 'absent'] as const) {
      await openSealed(bothFiles, value)
      expect(screen.queryByTestId('evidence-detail-development'), `developmentSources: ${String(value)}`).toBeNull()
      expect(document.body.textContent ?? '').not.toMatch(/production/i)
      cleanup()
      opened?.bed.dispose()
      opened = undefined
    }
  })

  it('Simulated client mode: no badge on the list row or on the header, even for `developmentSources: true`', async () => {
    const probe = createDatasetSim()
    const id = evidenceIdOf(probe, '0001')
    const { sim } = mountEvidence(`/evidence/${id}`)
    act(() => {
      sim.store.setState((state) => ({ evidence: state.evidence.map((item) => (item.id === id ? { ...item, developmentSources: true } : item)) }))
    })
    await findDetailBody()
    expect(screen.queryByTestId('evidence-detail-development')).toBeNull()
    expect(document.querySelector('[data-testid^="evidence-row-development-"]')).toBeNull()
  })
})
