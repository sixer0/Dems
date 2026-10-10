// Blueprint row 92 (M8-W3): the schema-v2 members of an evidence item, read defensively, and the
// rule of the item badge "Development source" (R-11; UX §8f.2; decisions D83, D91).
//
// | What is held | Where |
// |--------------|-------|
// | A v1 item reads as "nothing stated"; a v2 item gives its files (both hashes), intervals, transcript summary | "the reader" |
// | `developmentSources`: only `true` / `false` as sent; everything else is null = not recorded | "developmentSources" |
// | The badge: only for `true`, only on Live data; `false` / `null` / absent draw nothing | "the item badge" |
// | A member that cannot be read is dropped, never guessed (a list with a hole is no list) | "malformed members" |
import { describe, expect, it } from 'vitest'
import { EvidenceItemSchema } from '@dems/shared/api'
import { cameraFileOf, itemDevelopmentBadge, readItemV2 } from '../item-v2'
import { createDatasetSim, evidenceIdOf, stopSims } from './harness'

const H = (char: string) => char.repeat(64)
const V2_MEMBERS = {
  files: [
    { trackId: 'VIDEO-01', fileName: 'fragments/VIDEO-01.mp4', sizeBytes: 4_000, sha256: H('a'), sha256Plain: H('b'), fragmentCount: 5, fragmentChainHead: H('c') },
    { trackId: 'VIDEO-02', fileName: 'fragments/VIDEO-02.mp4', sizeBytes: 4_100, sha256: H('d'), fragmentCount: 5 },
  ],
  transcriptSha256: H('e'),
  manifestVersion: 2,
  labelsStatus: 'UNAVAILABLE',
  developmentSources: true,
  audioSourceIntervals: [
    { seq: 1, inputId: 'MIC-01', role: 'PRIMARY', fromMs: 0, toMs: 30_000, reason: 'START' },
    { seq: 2, inputId: 'MIC-02', role: 'STANDBY', fromMs: 30_000, toMs: null, reason: 'MANUAL' },
  ],
  transcript: { state: 'PARTIAL', sha256: H('e'), machineTranscriptHash: H('e'), labelsStatus: 'UNAVAILABLE', revision: 2, failedChunks: 3, backendUnreachable: true },
}

function datasetItem(): Record<string, unknown> {
  const sim = createDatasetSim()
  const id = evidenceIdOf(sim, '0001')
  const item = JSON.parse(JSON.stringify(sim.store.getState().evidence.find((entry) => entry.id === id))) as Record<string, unknown>
  stopSims()
  return item
}

describe('the reader', () => {
  it('a v1 item: not v2, no file, no interval, no transcript, sources NOT RECORDED', () => {
    const v1 = readItemV2(datasetItem())
    expect(v1).toMatchObject({ isV2: false, files: [], audioIntervals: [], transcript: null, developmentSources: null, manifestVersion: null })
  })

  it('a v2 item as the contract carries it: files with both hashes, intervals, the transcript summary', () => {
    const item = { ...datasetItem(), ...V2_MEMBERS }
    // The members used here are the contract's: the item parses with the registry schema.
    expect(EvidenceItemSchema.safeParse(item).success).toBe(true)
    const v2 = readItemV2(item)
    expect(v2.isV2).toBe(true)
    expect(cameraFileOf(v2, 'VIDEO-01')).toEqual({ trackId: 'VIDEO-01', fileName: 'fragments/VIDEO-01.mp4', sizeBytes: 4_000, sha256: H('a'), sha256Plain: H('b'), fragmentCount: 5, fragmentChainHead: H('c') })
    expect(cameraFileOf(v2, 'VIDEO-02')).toMatchObject({ sha256: H('d'), sha256Plain: null, fragmentChainHead: null })
    expect(v2.audioIntervals).toEqual([
      { seq: 1, inputId: 'MIC-01', fromMs: 0, toMs: 30_000, reason: 'START' },
      { seq: 2, inputId: 'MIC-02', fromMs: 30_000, toMs: null, reason: 'MANUAL' },
    ])
    expect(v2.transcript).toEqual({ state: 'PARTIAL', sha256: H('e'), machineTranscriptHash: H('e'), labelsStatus: 'UNAVAILABLE', revision: 2, failedChunks: 3, backendUnreachable: true })
    expect([v2.transcriptSha256, v2.labelsStatus, v2.manifestVersion, v2.developmentSources]).toEqual([H('e'), 'UNAVAILABLE', 2, true])
    expect(v2.signature).toMatchObject({ simulated: true })
  })

  it('never throws on anything', () => {
    for (const value of [null, undefined, 'EV-1', 7, [], { files: 'none', audioSourceIntervals: {}, transcript: [], signature: 1 }]) {
      expect(readItemV2(value)).toMatchObject({ isV2: false, files: [], audioIntervals: [], transcript: null, developmentSources: null })
    }
  })
})

describe('malformed members', () => {
  it('a file without a readable hash is dropped; a hash is never invented', () => {
    const v2 = readItemV2({ files: [{ trackId: 'VIDEO-01', sha256: 'abc' }, V2_MEMBERS.files[1], null] })
    expect(v2.files.map((file) => file.trackId)).toEqual(['VIDEO-02'])
  })

  it('one unreadable interval empties the list: a band with a hole would name the wrong microphone', () => {
    const good = V2_MEMBERS.audioSourceIntervals
    for (const bad of [{ seq: 3, inputId: 'CAM-01', fromMs: 0, toMs: 5 }, { seq: 3, inputId: 'MIC-01', fromMs: 9, toMs: 5 }, { seq: 3, inputId: 'MIC-01', fromMs: -1, toMs: 5 }, { inputId: 'MIC-01', fromMs: 0, toMs: 5 }, 'MIC-01', { seq: 3, inputId: 'MIC-01', fromMs: 0, toMs: 'end' }]) {
      expect(readItemV2({ audioSourceIntervals: [...good, bad] }).audioIntervals).toEqual([])
    }
    // CONTROL: the good ones alone are read, and an input beyond the pair (MIC-03) is an input.
    expect(readItemV2({ audioSourceIntervals: [...good, { seq: 3, inputId: 'MIC-03', fromMs: 40_000, toMs: 50_000, reason: 'MANUAL' }] }).audioIntervals).toHaveLength(3)
  })

  it('a transcript summary with an unknown state is not a summary', () => {
    expect(readItemV2({ transcript: { ...V2_MEMBERS.transcript, state: 'FINE' } }).transcript).toBeNull()
  })
})

describe('developmentSources (R-11): null is never production', () => {
  it('only the booleans are read; every other value is null', () => {
    expect(readItemV2({ developmentSources: true }).developmentSources).toBe(true)
    expect(readItemV2({ developmentSources: false }).developmentSources).toBe(false)
    for (const value of [null, undefined, 'true', 'false', 1, 0, 'PRODUCTION', {}]) expect(readItemV2({ developmentSources: value }).developmentSources).toBeNull()
    expect(readItemV2({}).developmentSources).toBeNull()
  })
})

describe('the item badge', () => {
  it('is drawn only for `true`, and only on Live data', () => {
    expect(itemDevelopmentBadge({ developmentSources: true }, true)).toBe(true)
    // Simulated client mode: no badge (D83, D91) — the mode banner says what the data is.
    expect(itemDevelopmentBadge({ developmentSources: true }, false)).toBe(false)
    for (const live of [true, false]) {
      expect(itemDevelopmentBadge({ developmentSources: false }, live)).toBe(false)
      expect(itemDevelopmentBadge({ developmentSources: null }, live)).toBe(false)
    }
  })
})
