/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Fix wave K, driver W: the sealed player of the web console (re-gate 94, `gateway_check/13b_m8_regate.md`).
//
// | Finding | Rule | Test |
// |---------|------|------|
// | G94b-02 MAJOR | A file whose stream the Core stopped is a silent black tile in a browser (no error, never ready). The player asks the media route; `409 … FRAGMENT_NOT_AUTHENTIC` stops THAT file with the Core's naming of the file and the fragment, the other file plays on | "refusal at open", "refusal mid-play" |
// | G94b-02 | A media error on a live session is asked about before anything is renewed; the refused file gets no path again | "media error" |
// | G94b-02 | The refused LEADING file hands the lead to the other file | "leading file" |
// | G94b-02, control | A file the Core serves is never worded as an integrity failure | "control" |
// | G94b-02 | The probe: a cut answer is followed from the byte where it was cut; codes only | "the probe" |
// | G94b-07 | The development mark on the camera tiles and the band legend of a development item | "G94b-07" |
// | G94b-08 | 0:00 before a first interval that starts in the same second is inside it; a gap stays a gap | "G94b-08" |
// | G94b-09 | An interrupted recording says so where its sealed prefix ends | "G94b-09" |
//
// The refusal is the media route's own (`apps/core-server/src/media-stream/service.ts` `mediaUnavailable`):
// the contract names the reason in the description of operation 88 and has no exported example of
// the route's body (a request line asks for one); `ROUTE_REFUSAL` below is that body, and the first
// test holds the reason to the registry's text.
import { configure, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CORE_API_OPERATIONS } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import type { EvidenceItem } from '@dems/shared/sim'
import { enWeb } from '@/i18n-web'
import { webErrorSink } from '@/runtime'
import { readItemV2 } from '../item-v2'
import { FRAGMENT_NOT_AUTHENTIC, MediaSession, probeMediaSession } from '../media-session'
import { bandSegments, probeStartByte, segmentAt } from '../sealed-playback'
import { EV, findDetailBody, serveMediaRoute, type LiveEvidence } from './live-evidence-bed'
import { asReal, openItem, setupPage, teardownPage, UI } from './wave-h-c2-bed'

configure({ asyncUtilTimeout: 9_000 })
vi.setConfig({ testTimeout: 60_000 })

const P = en.evidence.playback
const W = enWeb.web.player
const BOTH = { source: 'LIVE_STREAM', packageSuffix: null, fileIds: ['VIDEO-01', 'VIDEO-02'] }
const TOKENS = { 'VIDEO-01': ['mts_WAVEKw1aaaa', 'mts_WAVEKw1bbbb'], 'VIDEO-02': ['mts_WAVEKw2aaaa', 'mts_WAVEKw2bbbb'] } as const
/** The plaintext byte where fragment 3 of the tampered file starts (the gate's item: 2 257 425). */
const CUT_AT = 2_048
const ROUTE_REFUSAL = {
  error: {
    code: 'MEDIA_NOT_AVAILABLE',
    message: 'A fragment of this recording failed its integrity check.',
    details: { simCode: 'MEDIA_NOT_AVAILABLE', reason: FRAGMENT_NOT_AUTHENTIC, fileId: 'VIDEO-02', seq: 3 },
  },
}

type Fetch = typeof fetch
const rangeOf = (init: RequestInit | undefined): string => String((init?.headers as Record<string, string> | undefined)?.range ?? '')
const startOf = (init: RequestInit | undefined): number => Number(/^bytes=(\d+)-$/.exec(rangeOf(init))?.[1] ?? Number.NaN)

/** The media route for one tampered file: a stream that the Core stops before the failed fragment, and the clean 409 from there. */
function tamperedRoute(refusal: unknown = ROUTE_REFUSAL): (init: RequestInit | undefined) => Response {
  return (init) => {
    const start = startOf(init)
    if (start >= CUT_AT) return new Response(JSON.stringify(refusal), { status: 409, headers: { 'content-type': 'application/json' } })
    // 206 with the length of the whole rest; the body ends at the failed fragment and the connection is destroyed.
    let sent = false
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent) controller.error(new TypeError('network error'))
        else controller.enqueue(new Uint8Array(CUT_AT - start))
        sent = true
      },
    })
    return new Response(body, { status: 206, headers: { 'content-length': String(8_192 - start), 'content-range': `bytes ${start}-8191/8192` } })
  }
}
const servedRoute = (): Response => new Response(new Uint8Array(64), { status: 206, headers: { 'content-length': '64' } })

interface Probes {
  readonly calls: { readonly path: string; readonly range: string }[]
}
/**
 * Puts the media route under `fetch` (the probe's only door) with one answer per camera file; a
 * file without a route is served. Called AFTER the page is open: the Live test bed holds the global
 * `fetch` while it opens, and puts the previous one back when it is disposed.
 */
function routeMedia(routes: Partial<Record<'VIDEO-01' | 'VIDEO-02', (init: RequestInit | undefined) => Response>>): Probes {
  const calls: Probes['calls'] = []
  serveMediaRoute((path, init) => {
    calls.push({ path, range: rangeOf(init) })
    const fileId = (Object.keys(TOKENS) as (keyof typeof TOKENS)[]).find((entry) => (TOKENS[entry] as readonly string[]).some((token) => path.endsWith(token)))
    const route = fileId === undefined ? undefined : routes[fileId]
    return route ? route(init) : servedRoute()
  })
  return { calls }
}

let opened: LiveEvidence | undefined
beforeEach(setupPage)
afterEach(async () => {
  await teardownPage(opened)
  opened = undefined
})

const sessions = () => opened!.bed.fake.log.requestsOf('createEvidenceMediaSession')
const video = (fileId: string) => screen.getByTestId(`evidence-sealed-video-${fileId}`) as HTMLVideoElement
const player = () => screen.getByTestId('evidence-playback')

async function openPlayer(change: (item: EvidenceItem) => EvidenceItem = asReal(), media: Record<string, unknown> = BOTH): Promise<LiveEvidence> {
  const issued: Record<string, number> = { 'VIDEO-01': 0, 'VIDEO-02': 0 }
  opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, {
    change,
    media,
    before: (bed) =>
      bed.fake.answer('createEvidenceMediaSession', (call) => {
        const fileId = ((call.body as { fileId?: string } | undefined)?.fileId ?? 'VIDEO-01') as 'VIDEO-01' | 'VIDEO-02'
        const list = TOKENS[fileId]
        const token = list[(issued[fileId] = (issued[fileId] ?? 0) + 1) - 1] ?? list[list.length - 1]
        return { status: 201, body: { evidenceId: call.params.id ?? '', fileId, url: `http://127.0.0.1:8443/media/${token}`, expiresAt: bed.fake.clock.now() + 60_000, ranges: true } } as never
      }),
  })
  await findDetailBody()
  await screen.findByTestId('evidence-playback', {}, UI)
  fireEvent.click(screen.getByTestId('evidence-playback-open'))
  await waitFor(() => expect(player()).toHaveAttribute('data-phase', 'ready'), UI)
  return opened
}

const expectIntegrityOfCamera2 = () => {
  const alert = screen.getByTestId('evidence-playback-integrity')
  expect(alert).toHaveAttribute('data-files', 'VIDEO-02')
  // The shared integrity sentence, with the file and the fragment THE CORE named.
  expect(screen.getByTestId('evidence-playback-integrity-VIDEO-02')).toHaveTextContent('This recording failed its integrity check at VIDEO-02 fragment 3.')
  expect(screen.getByTestId('evidence-playback-integrity-VIDEO-02')).toHaveTextContent(P.integrity.replace('{{file}}', 'VIDEO-02').replace('{{seq}}', '3'))
  expect(alert).toHaveTextContent(W.refusedByCore)
  expect(alert).toHaveTextContent('Camera 2 is stopped. Camera 1 plays on.')
  // The mark of the affected file: its tile says so and holds no path any more.
  expect(screen.getByTestId('evidence-sealed-integrity-VIDEO-02')).toHaveTextContent('Stopped: this file failed its integrity check at fragment 3.')
  expect(video('VIDEO-02').hasAttribute('src')).toBe(false)
  expect(screen.queryByTestId('evidence-sealed-integrity-VIDEO-01')).toBeNull()
}

describe('G94b-02: a camera file the Core refuses for its integrity says so in the player', () => {
  it('the contract names the reason this player reads', () => {
    const operation = CORE_API_OPERATIONS.find((entry) => entry.operationId === 'createEvidenceMediaSession')
    expect(operation?.description).toContain(FRAGMENT_NOT_AUTHENTIC)
  })

  it('refusal at open: VIDEO-02 never becomes ready; the player names "VIDEO-02 fragment 3", stops that file, and Camera 1 plays', async () => {
    await openPlayer()
    const probes = routeMedia({ 'VIDEO-02': tamperedRoute() })
    // Camera 1 loads and plays; Camera 2 gives no sign of life (the gate: readyState 0, no error, from the open to the end).
    fireEvent.loadedMetadata(video('VIDEO-01'))
    fireEvent.click(screen.getByTestId('evidence-sealed-play-toggle'))
    video('VIDEO-01').currentTime = 2
    fireEvent.timeUpdate(video('VIDEO-01'))
    expect(screen.queryByTestId('evidence-playback-integrity')).toBeNull()
    await screen.findByTestId('evidence-playback-integrity')
    expectIntegrityOfCamera2()
    // The other file: still on its path, still playing, still the leading one; Play stays usable.
    expect(video('VIDEO-01').getAttribute('src')).toBe(`/media/${TOKENS['VIDEO-01'][0]}`)
    expect(player()).toHaveAttribute('data-playing', 'true')
    expect(player()).toHaveAttribute('data-leading', 'VIDEO-01')
    expect(screen.getByTestId('evidence-sealed-play-toggle')).toBeEnabled()
    expect(screen.queryByTestId('evidence-playback-stopped')).toBeNull()
    // The Core was asked from the start, then from the byte where its answer was cut. Nothing was renewed.
    expect(probes.calls.map((call) => call.range)).toEqual(['bytes=0-', `bytes=${CUT_AT}-`])
    expect(probes.calls.every((call) => call.path === `/media/${TOKENS['VIDEO-02'][0]}`)).toBe(true)
    expect(sessions()).toHaveLength(2)
    // The record holds the Core's codes and never the bearer path.
    const record = webErrorSink.records().find((entry) => entry.source === 'Evidence.playback.integrityStop')
    expect(record?.context).toMatchObject({ evidenceId: EV.sealed, fileId: 'VIDEO-02', namedFile: 'VIDEO-02', seq: 3 })
    expect(JSON.stringify(webErrorSink.records())).not.toContain('mts_')
    // It stays stopped: a later time update or a seek puts no path back on it.
    video('VIDEO-01').currentTime = 5
    fireEvent.timeUpdate(video('VIDEO-01'))
    expect(video('VIDEO-02').hasAttribute('src')).toBe(false)
  })

  it('refusal mid-play: VIDEO-02 waits for data at the altered fragment; the same sentence, Camera 1 plays on', async () => {
    await openPlayer()
    const probes = routeMedia({ 'VIDEO-02': tamperedRoute() })
    for (const fileId of ['VIDEO-01', 'VIDEO-02']) fireEvent.loadedMetadata(video(fileId))
    fireEvent.click(screen.getByTestId('evidence-sealed-play-toggle'))
    for (const fileId of ['VIDEO-01', 'VIDEO-02']) {
      video(fileId).currentTime = 3
      fireEvent.timeUpdate(video(fileId))
    }
    // Both files played for 3 s: nothing is said, and nothing was asked.
    expect(screen.queryByTestId('evidence-playback-integrity')).toBeNull()
    expect(probes.calls).toHaveLength(0)
    // The stream of Camera 2 ends before fragment 3: its element waits and reports nothing else.
    fireEvent.waiting(video('VIDEO-02'))
    video('VIDEO-01').currentTime = 4
    fireEvent.timeUpdate(video('VIDEO-01'))
    await screen.findByTestId('evidence-playback-integrity')
    expectIntegrityOfCamera2()
    expect(player()).toHaveAttribute('data-playing', 'true')
    expect(video('VIDEO-01').getAttribute('src')).toBe(`/media/${TOKENS['VIDEO-01'][0]}`)
    expect(probes.calls.at(-1)?.range).toBe(`bytes=${CUT_AT}-`)
  })

  it('media error on a live session: the Core is asked BEFORE anything is renewed; the refused file gets no path again, the other goes on at the same place', async () => {
    await openPlayer()
    routeMedia({ 'VIDEO-02': tamperedRoute() })
    for (const fileId of ['VIDEO-01', 'VIDEO-02']) fireEvent.loadedMetadata(video(fileId))
    fireEvent.click(screen.getByTestId('evidence-sealed-play-toggle'))
    video('VIDEO-01').currentTime = 3
    fireEvent.timeUpdate(video('VIDEO-01'))
    fireEvent.error(video('VIDEO-02'))
    await screen.findByTestId('evidence-playback-integrity')
    expectIntegrityOfCamera2()
    // The renewal after the answer: new sessions, Camera 1 on its new path at 3 s, Camera 2 on none.
    await waitFor(() => expect(video('VIDEO-01').getAttribute('src')).toBe(`/media/${TOKENS['VIDEO-01'][1]}`))
    expect(video('VIDEO-01').currentTime).toBe(3)
    expect(video('VIDEO-02').hasAttribute('src')).toBe(false)
    expect(screen.queryByTestId('evidence-playback-stopped')).toBeNull()
    expect(player()).toHaveAttribute('data-playing', 'true')
  })

  it('leading file: when VIDEO-01 is the refused one, Camera 2 leads and is heard; with both refused nothing plays', async () => {
    const refusal1 = { error: { ...ROUTE_REFUSAL.error, details: { ...ROUTE_REFUSAL.error.details, fileId: 'VIDEO-01', seq: 1 } } }
    await openPlayer()
    routeMedia({ 'VIDEO-01': tamperedRoute(refusal1), 'VIDEO-02': tamperedRoute() })
    for (const fileId of ['VIDEO-01', 'VIDEO-02']) fireEvent.loadedMetadata(video(fileId))
    fireEvent.click(screen.getByTestId('evidence-sealed-play-toggle'))
    fireEvent.error(video('VIDEO-01'))
    await screen.findByTestId('evidence-playback-integrity-VIDEO-01')
    expect(screen.getByTestId('evidence-playback-integrity-VIDEO-01')).toHaveTextContent('This recording failed its integrity check at VIDEO-01 fragment 1.')
    expect(screen.getByTestId('evidence-playback-integrity')).toHaveTextContent('Camera 1 is stopped. Camera 2 plays on.')
    await waitFor(() => expect(player()).toHaveAttribute('data-leading', 'VIDEO-02'))
    await waitFor(() => expect(video('VIDEO-02').getAttribute('src')).toBe(`/media/${TOKENS['VIDEO-02'][1]}`))
    expect(video('VIDEO-02').muted).toBe(false)
    expect(video('VIDEO-01').hasAttribute('src')).toBe(false)
    // The second file fails too: nothing is left to play.
    fireEvent.error(video('VIDEO-02'))
    await screen.findByTestId('evidence-playback-integrity-VIDEO-02')
    await waitFor(() => expect(screen.getByTestId('evidence-playback-integrity')).toHaveTextContent(W.nothingPlays))
    expect(player()).toHaveAttribute('data-playing', 'false')
    expect(screen.getByTestId('evidence-sealed-play-toggle')).toBeDisabled()
  })

  it('control: a file the Core serves is never worded as an integrity failure - a file without a sign of life reads "has not loaded"', async () => {
    await openPlayer()
    const probes = routeMedia({})
    fireEvent.loadedMetadata(video('VIDEO-01'))
    fireEvent.click(screen.getByTestId('evidence-sealed-play-toggle'))
    await screen.findByTestId('evidence-sealed-not-loaded-VIDEO-02')
    expect(screen.getByTestId('evidence-sealed-not-loaded-VIDEO-02')).toHaveTextContent(W.notLoaded)
    expect(screen.queryByTestId('evidence-playback-integrity')).toBeNull()
    expect(screen.queryByTestId('evidence-sealed-not-loaded-VIDEO-01')).toBeNull()
    expect(video('VIDEO-02').getAttribute('src')).toBe(`/media/${TOKENS['VIDEO-02'][0]}`)
    expect(probes.calls.map((call) => call.range)).toEqual(['bytes=0-'])
    // The file loads after all: the note goes.
    fireEvent.loadedMetadata(video('VIDEO-02'))
    await waitFor(() => expect(screen.queryByTestId('evidence-sealed-not-loaded-VIDEO-02')).toBeNull())
  })
})

describe('G94b-02: the probe of the media route', () => {
  const session = () => new MediaSession('VIDEO-02', `/media/${TOKENS['VIDEO-02'][0]}`, 1_790_825_000_000)
  const asFetch = (route: (init: RequestInit | undefined) => Response | Promise<Response>, seen: string[] = []): Fetch =>
    (async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(rangeOf(init))
      return route(init)
    }) as Fetch

  it('a range that starts in the failed fragment: the file and the fragment the Core names', async () => {
    const seen: string[] = []
    expect(await probeMediaSession(session(), { startByte: CUT_AT + 10, fetch: asFetch(tamperedRoute(), seen) })).toEqual({ kind: 'NOT_AUTHENTIC', fileId: 'VIDEO-02', seq: 3 })
    expect(seen).toEqual([`bytes=${CUT_AT + 10}-`])
  })
  it('an answer cut before the failed fragment is followed from the byte where it was cut - also when the body ends short without an error', async () => {
    const short = (init: RequestInit | undefined): Response =>
      startOf(init) >= CUT_AT ? new Response(JSON.stringify(ROUTE_REFUSAL), { status: 409 }) : new Response(new Uint8Array(CUT_AT - startOf(init)), { status: 206, headers: { 'content-length': '8192' } })
    const seen: string[] = []
    expect(await probeMediaSession(session(), { startByte: 100, fetch: asFetch(short, seen) })).toEqual({ kind: 'NOT_AUTHENTIC', fileId: 'VIDEO-02', seq: 3 })
    expect(seen).toEqual(['bytes=100-', `bytes=${CUT_AT}-`])
  })
  it('controls: a served file, a file read up to the limit, another refusal, an expired session, no network - none is an integrity failure', async () => {
    expect(await probeMediaSession(session(), { fetch: asFetch(servedRoute) })).toEqual({ kind: 'SERVED' })
    const endless = (): Response => new Response(new Uint8Array(4_096), { status: 206, headers: { 'content-length': '1000000' } })
    expect(await probeMediaSession(session(), { maxBytes: 1_024, fetch: asFetch(endless) })).toEqual({ kind: 'SERVED' })
    const gone = (): Response => new Response(JSON.stringify({ error: { code: 'MEDIA_NOT_AVAILABLE', details: { reason: 'PACKAGE_MISSING' } } }), { status: 409 })
    expect(await probeMediaSession(session(), { fetch: asFetch(gone) })).toEqual({ kind: 'REFUSED', status: 409, reason: 'PACKAGE_MISSING' })
    const expired = (): Response => new Response(JSON.stringify({ error: { code: 'NOT_PERMITTED', details: { reason: 'MEDIA_SESSION_EXPIRED' } } }), { status: 403 })
    expect(await probeMediaSession(session(), { fetch: asFetch(expired) })).toEqual({ kind: 'REFUSED', status: 403, reason: 'MEDIA_SESSION_EXPIRED' })
    const offline = (): Promise<Response> => Promise.reject(new TypeError('Failed to fetch'))
    expect(await probeMediaSession(session(), { fetch: asFetch(offline) })).toEqual({ kind: 'UNKNOWN' })
    expect(await probeMediaSession(session(), { fetch: asFetch(() => new Response('', { status: 416 })) })).toEqual({ kind: 'SERVED' })
  })
  it('the outcome and the request carry no bearer path beyond the request itself; a refusal without a fragment names none', async () => {
    const noSeq = { error: { code: 'MEDIA_NOT_AVAILABLE', details: { reason: FRAGMENT_NOT_AUTHENTIC } } }
    const outcome = await probeMediaSession(session(), { fetch: asFetch(() => new Response(JSON.stringify(noSeq), { status: 409 })) })
    expect(outcome).toEqual({ kind: 'NOT_AUTHENTIC', fileId: 'VIDEO-02', seq: null })
    expect(JSON.stringify(outcome)).not.toContain('mts_')
  })
  it('where the probe starts: 0 for a file that never played; else the playhead share of the file, three fragments back', () => {
    expect(probeStartByte({ sizeBytes: 1_000_000, fragmentCount: 100, positionMs: 0, totalMs: 100_000 })).toBe(0)
    expect(probeStartByte({ sizeBytes: 0, fragmentCount: 100, positionMs: 50_000, totalMs: 100_000 })).toBe(0)
    expect(probeStartByte({ sizeBytes: 1_000_000, fragmentCount: 100, positionMs: 50_000, totalMs: 100_000 })).toBe(470_000)
    expect(probeStartByte({ sizeBytes: 1_000_000, fragmentCount: 0, positionMs: 50_000, totalMs: 100_000 })).toBe(400_000)
    expect(probeStartByte({ sizeBytes: 1_000_000, fragmentCount: 5, positionMs: 30_000, totalMs: 100_000 })).toBe(0)
  })
})

describe('G94b-07: the development mark in the sealed player of a development item', () => {
  const intervals = (sourceClass?: string) => ({
    audioSourceIntervals: [{ seq: 1, inputId: 'MIC-01', role: 'PRIMARY', fromMs: 21, toMs: 28_000, reason: 'START', ...(sourceClass === undefined ? {} : { sourceClass }) }],
  })

  it('a development item: the mark on each camera tile and in the band legend, before any verify run', async () => {
    await openPlayer(asReal({ developmentSources: true, ...intervals('FAKE') }))
    routeMedia({})
    for (const fileId of ['VIDEO-01', 'VIDEO-02']) expect(screen.getByTestId(`evidence-playback-development-${fileId}`)).toHaveTextContent(en.common.sourceClass.badge)
    expect(screen.getByTestId('evidence-band-development-MIC-01')).toHaveTextContent(en.common.sourceClass.badge)
    expect(screen.getByTestId('evidence-band-development-MIC-01')).toHaveAttribute('data-adapter', 'FAKE')
  })
  it('a development item whose intervals state no class: the plain mark in the legend; a microphone stated PRODUCTION carries none', async () => {
    await openPlayer(asReal({ developmentSources: true, ...intervals() }))
    routeMedia({})
    expect(screen.getByTestId('evidence-band-development-MIC-01')).toHaveTextContent(en.common.sourceClass.badge)
    expect(readItemV2({ files: [], ...intervals('PRODUCTION') }).audioIntervals[0]?.sourceClass).toBe('PRODUCTION')
    expect(readItemV2({ files: [], ...intervals() }).audioIntervals[0]).not.toHaveProperty('sourceClass')
  })
  it('control: an item that is not a development item carries no mark in the player', async () => {
    await openPlayer(asReal({ developmentSources: false, ...intervals('PRODUCTION') }))
    routeMedia({})
    expect(screen.queryByTestId('evidence-playback-development-VIDEO-01')).toBeNull()
    expect(screen.queryByTestId('evidence-band-development-MIC-01')).toBeNull()
    expect(player()).not.toHaveTextContent(/production/i)
  })
})

describe('G94b-08: the microphone at the playhead at 0:00', () => {
  const first = [{ seq: 1, inputId: 'MIC-01', fromMs: 21, toMs: 28_000, reason: 'START' as const }]
  it('0 ms before a first interval that starts at 21 ms is inside it (the gate\'s item)', () => {
    const segments = bandSegments(first, 28_000)
    expect(segmentAt(segments, 0)?.inputId).toBe('MIC-01')
    expect(segmentAt(segments, 20)?.inputId).toBe('MIC-01')
    expect(segmentAt(segments, 21)?.inputId).toBe('MIC-01')
  })
  it('controls: a first interval that starts in a later second, and a gap between two intervals, stay "no interval"', () => {
    expect(segmentAt(bandSegments([{ ...first[0]!, fromMs: 1_500 }], 28_000), 0)).toBeNull()
    expect(segmentAt(bandSegments([{ ...first[0]!, fromMs: 1_500 }], 28_000), 1_200)?.inputId).toBe('MIC-01')
    const gap = bandSegments([{ ...first[0]!, toMs: 5_000 }, { seq: 2, inputId: 'MIC-02', fromMs: 9_000, toMs: 28_000, reason: 'MANUAL' as const }], 28_000)
    expect(segmentAt(gap, 7_000)).toBeNull()
    expect(segmentAt(gap, 8_990)).toBeNull()
  })
  it('the open player reads "Audio at the playhead: MIC 1" at 0:00', async () => {
    await openPlayer(asReal({ audioSourceIntervals: [{ seq: 1, inputId: 'MIC-01', role: 'PRIMARY', fromMs: 21, toMs: 28_000, reason: 'START' }] }))
    routeMedia({})
    expect(screen.getByTestId('evidence-sealed-time')).toHaveTextContent('0:00')
    expect(screen.getByTestId('evidence-band-now')).toHaveAttribute('data-input', 'MIC-01')
    expect(screen.getByTestId('evidence-band-now')).not.toHaveTextContent(P.band.nowNone)
  })
})

describe('G94b-09: an interrupted recording ends early and says so', () => {
  const interruptedItem = asReal({ interrupted: true, interruptedCause: 'CAPTURE_FAULT', durationMs: 31_000 })
  const end = (at: number) => {
    video('VIDEO-01').currentTime = at
    fireEvent.timeUpdate(video('VIDEO-01'))
    fireEvent.ended(video('VIDEO-01'))
  }

  it('at the end of the sealed prefix (0:29 of 0:31) the player says the recording was interrupted', async () => {
    await openPlayer(interruptedItem, { ...BOTH, fileIds: ['VIDEO-01'] })
    routeMedia({})
    fireEvent.loadedMetadata(video('VIDEO-01'))
    expect(screen.queryByTestId('evidence-playback-interrupted-end')).toBeNull()
    fireEvent.click(screen.getByTestId('evidence-sealed-play-toggle'))
    end(29.6)
    const line = await screen.findByTestId('evidence-playback-interrupted-end')
    expect(line).toHaveTextContent('End of the sealed recording at 0:29: the recording was interrupted, so it ends here.')
    expect(player()).toHaveAttribute('data-playing', 'false')
    // Playing again takes the line away until the end is reached again.
    fireEvent.click(screen.getByTestId('evidence-sealed-play-toggle'))
    await waitFor(() => expect(screen.queryByTestId('evidence-playback-interrupted-end')).toBeNull())
  })
  it('control: a recording that was not interrupted ends without that line', async () => {
    await openPlayer(asReal({ durationMs: 31_000 }), { ...BOTH, fileIds: ['VIDEO-01'] })
    routeMedia({})
    fireEvent.loadedMetadata(video('VIDEO-01'))
    fireEvent.click(screen.getByTestId('evidence-sealed-play-toggle'))
    end(31)
    await waitFor(() => expect(player()).toHaveAttribute('data-playing', 'false'))
    expect(screen.queryByTestId('evidence-playback-interrupted-end')).toBeNull()
  })
})
