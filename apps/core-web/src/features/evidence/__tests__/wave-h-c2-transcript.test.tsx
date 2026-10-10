/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Wave H C2 (web): the transcript pane and the player word a state by what the Core says.
//
// | Rule | Test |
// |------|------|
// | G81-01: the Core's reason `SIMULATED_ITEM` reads "…keeps no transcript for it", never "not available yet" | "G81-01" |
// | Any other 409 keeps "not available yet" (negative control) | "G81-01 … control" |
// | G81-05: an assembled transcript with no segments reads "No speech was detected" in a neutral colour, not "Transcript assembled", and offers no revise control | "G81-05" |
// | G81-07: `access.readTranscript: false` - the page view calls NEITHER operation 84 NOR 86 and says "not permitted" | "G81-07 … transcript" |
// | G81-07: `access.play: false` - no operation 88, Play is off, the player says "not permitted" | "G81-07 … play" |
// | Absent `access`: the pane asks as before (negative control) | "G81-07 … absent" |
import { configure, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { EvidenceItem } from '@dems/shared/sim'
import { webErrorSink } from '@/runtime'
import { EV, findDetailBody, type LiveEvidence } from './live-evidence-bed'
import { asReal, H, openItem, setupPage, teardownPage, UI } from './wave-h-c2-bed'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 40_000 })

const F = en.evidence.itemFacts
const T = en.evidence.transcript
const NONE = { source: 'NONE', packageSuffix: null }
const STREAM = { source: 'LIVE_STREAM', packageSuffix: null }
const summary = (state: string, sha256: string | null = H('b')) => ({ state, sha256, machineTranscriptHash: sha256, labelsStatus: 'UNAVAILABLE', revision: 0, failedChunks: 0, backendUnreachable: false })
const withTranscript =
  (state: string) =>
  (item: EvidenceItem): EvidenceItem =>
    ({ ...item, transcript: summary(state) }) as unknown as EvidenceItem
const realWithTranscript = (state: string) => (item: EvidenceItem) => withTranscript(state)(asReal({ transcriptSha256: H('b'), labelsStatus: 'UNAVAILABLE' })(item))
const DOCUMENT = { documentVersion: 'dems.transcript/1', language: 'id', speakerState: 'UNAVAILABLE', segments: [], sha256: H('a'), machineTranscriptHash: H('b'), assembledAt: 1_790_823_600_000, revision: 0 }
const SEGMENT = { index: 0, startMs: 400, endMs: 4_200, text: 'Silakan mulai dari identitas Anda.', speaker: null }

let opened: LiveEvidence | undefined
beforeEach(setupPage)
afterEach(async () => {
  await teardownPage(opened)
  opened = undefined
})

const requests = (operationId: string) => opened!.bed.fake.log.requestsOf(operationId)
/** The contract's 409 of operation 84 with the Core's reason in `details` (`modules/transcripts/routes.ts`, `notReady`). */
const notReady = (bed: LiveEvidence['bed'], reason: string | null) => {
  const example = bed.fake.example('getTranscript', 409) as { status: number; body: { error: Record<string, unknown> } }
  return { status: 409, body: { ...example.body, error: { ...example.body.error, ...(reason === null ? {} : { details: { reason } }) } } } as never
}

describe('G81-01: a state is worded by the reason the Core gives', () => {
  it('G81-01: 409 TRANSCRIPT_NOT_READY with reason SIMULATED_ITEM reads "the Core server keeps no transcript for it" - never "not available yet"', async () => {
    opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, {
      change: withTranscript('PENDING'),
      media: NONE,
      before: (bed) => bed.fake.answer('getTranscript', () => notReady(bed, 'SIMULATED_ITEM')),
    })
    await findDetailBody()
    const state = await screen.findByTestId('evidence-transcript-not-ready', {}, UI)
    expect(state).toHaveTextContent(F.transcript.simulatedItem)
    expect(state).toHaveAttribute('data-reason', 'SIMULATED_ITEM')
    expect(screen.getByTestId('evidence-transcript')).not.toHaveTextContent(T.notReady)
    expect(webErrorSink.records().filter((record) => record.source.startsWith('Evidence.transcript'))).toEqual([])
  })

  it('G81-01, negative control: a 409 with another reason keeps "The transcript is not available yet."', async () => {
    opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, {
      change: withTranscript('PENDING'),
      media: NONE,
      before: (bed) => bed.fake.answer('getTranscript', () => notReady(bed, 'NO_SEALED_TRANSCRIPT')),
    })
    await findDetailBody()
    const state = await screen.findByTestId('evidence-transcript-not-ready', {}, UI)
    expect(state).toHaveTextContent(T.notReady)
    expect(state).not.toHaveTextContent(F.transcript.simulatedItem)
  })
})

describe('G81-05: a recording without speech', () => {
  it('G81-05: an assembled transcript with zero segments reads "No speech was detected" in a neutral colour, not "Transcript assembled", with no revise control', async () => {
    opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, {
      change: realWithTranscript('READY'),
      media: NONE,
      before: (bed) => {
        bed.fake.answer('getTranscript', () => ({ status: 200, body: DOCUMENT }) as never)
        bed.fake.answer('listTranscriptRevisions', () => ({ status: 200, body: { items: [], nextCursor: null } }) as never)
      },
    })
    await findDetailBody()
    const note = await screen.findByTestId('evidence-transcript-no-speech', {}, UI)
    expect(note).toHaveTextContent(F.transcript.noSpeech)
    const chip = screen.getByTestId('evidence-transcript-state')
    expect(chip).toHaveTextContent(F.web.noSpeechChip)
    expect(chip).toHaveAttribute('data-tone', 'neutral')
    expect(screen.getByTestId('evidence-transcript')).toHaveAttribute('data-state', 'NO_SPEECH')
    expect(screen.getByTestId('evidence-transcript')).not.toHaveTextContent(T.state.ASSEMBLED)
    expect(screen.queryAllByTestId(/^evidence-transcript-revise-/)).toEqual([])
  })

  it('G81-05, negative control: an assembled transcript WITH a segment still reads "Transcript assembled" as a success', async () => {
    opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, {
      change: realWithTranscript('READY'),
      media: NONE,
      before: (bed) => {
        bed.fake.answer('getTranscript', () => ({ status: 200, body: { ...DOCUMENT, segments: [SEGMENT] } }) as never)
        bed.fake.answer('listTranscriptRevisions', () => ({ status: 200, body: { items: [], nextCursor: null } }) as never)
      },
    })
    await findDetailBody()
    await screen.findByTestId('evidence-transcript-segments', {}, UI)
    const chip = screen.getByTestId('evidence-transcript-state')
    expect(chip).toHaveTextContent(T.state.ASSEMBLED)
    expect(chip).toHaveAttribute('data-tone', 'success')
    expect(screen.queryByTestId('evidence-transcript-no-speech')).toBeNull()
  })
})

describe('G81-07: a page view asks for nothing the Core says this operator may not have', () => {
  it('G81-07: access.readTranscript false - the page view calls neither operation 84 nor 86 and says "You are not permitted to read this transcript."', async () => {
    opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, {
      change: realWithTranscript('READY'),
      media: NONE,
      extra: { access: { play: false, readTranscript: false, export: false } },
      before: (bed) => bed.fake.answer('getTranscript', () => ({ status: 200, body: { ...DOCUMENT, segments: [SEGMENT] } }) as never),
    })
    await findDetailBody()
    const refused = await screen.findByTestId('evidence-transcript-may-not-read', {}, UI)
    expect(refused).toHaveTextContent(F.transcript.mayNotRead)
    await opened.bed.flush()
    expect(requests('getTranscript')).toHaveLength(0)
    expect(requests('listTranscriptRevisions')).toHaveLength(0)
    // The item's state is not restated as a role problem, and no document is drawn.
    expect(screen.getByTestId('evidence-transcript')).not.toHaveTextContent(T.notPermitted)
    expect(screen.queryByTestId('evidence-transcript-segments')).toBeNull()
  })

  it('G81-07: access.play false on a streamable item - operation 88 is never asked, Play is off and the player says "You are not permitted to play this recording."', async () => {
    opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, {
      change: asReal(),
      media: STREAM,
      extra: { access: { play: false, readTranscript: false, export: false } },
    })
    await findDetailBody()
    const refused = await screen.findByTestId('evidence-playback-not-permitted', {}, UI)
    expect(refused).toHaveTextContent(F.media.mayNotPlay)
    expect(screen.getByTestId('evidence-play')).toBeDisabled()
    expect(screen.getByTestId('evidence-playback-open')).toBeDisabled()
    expect(requests('createEvidenceMediaSession')).toHaveLength(0)
  })

  it('G81-07, negative control: without an access member the pane asks operation 84 as before', async () => {
    opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, {
      change: realWithTranscript('READY'),
      media: NONE,
      before: (bed) => {
        bed.fake.answer('getTranscript', () => ({ status: 200, body: { ...DOCUMENT, segments: [SEGMENT] } }) as never)
        bed.fake.answer('listTranscriptRevisions', () => ({ status: 200, body: { items: [], nextCursor: null } }) as never)
      },
    })
    await findDetailBody()
    await screen.findByTestId('evidence-transcript-segments', {}, UI)
    await waitFor(() => expect(requests('getTranscript')).toHaveLength(1))
    expect(screen.queryByTestId('evidence-transcript-may-not-read')).toBeNull()
  })
})
