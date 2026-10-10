/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Wave H C2 (web): Hash & Integrity of an item sealed on this Core states the item's OWN members.
//
// | Rule | Test |
// |------|------|
// | G89-03 / G81-02: a REAL Ed25519 signature is never labelled simulated or demo; the only qualifier is the development-key mark of the item | "G89-03 … development key" |
// | The key class is "not reported" until the item or a verify result states it | "G89-03 … not reported" |
// | A simulated item keeps its simulated label (negative control) | "G89-03 … simulated item" |
// | G89-04: before a verify run a v2 item shows its own camera files, manifest hash and key - no AUDIO rows and none of the six v1 rows | "G89-04" |
// | G89-09: a v2 DEMO item (seed-sealed) shows no bundled v1 package values and no "Bundled demo package" panel, also after a verify | "G89-09" |
// | G89-05: a v1 result carries the sources line "Sources: not recorded (v1 package)" | "G89-05" |
import { configure, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { EvidenceItem } from '@dems/shared/sim'
import { getMissingI18nKeys } from '@/i18n'
import { RECORDED_VERIFY_V2 } from './fixtures/verify-v2-recorded'
import { diskAssets, findPage, installBrowserStubs, mountEvidence } from './harness'
import { EV, findDetailBody, type LiveEvidence } from './live-evidence-bed'
import { asReal, H, openItem, setupPage, teardownPage, UI } from './wave-h-c2-bed'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 40_000 })

const F = en.evidence.itemFacts
const NONE = { source: 'NONE', packageSuffix: null }
const SIMULATED_WORDS = /\(simulated\)|simulated signature|DEMO key|DEMO-KEY|proves nothing about real evidence/
let opened: LiveEvidence | undefined

beforeEach(setupPage)
afterEach(async () => {
  await teardownPage(opened)
  opened = undefined
})

const hashes = () => screen.findByTestId('evidence-hashes', {}, UI)
const hashRows = (card: HTMLElement) => Array.from(card.querySelectorAll('[data-hash]')).map((row) => (row as HTMLElement).dataset.hash)

describe('G89-03 / G81-02: the signature line states what the item says', () => {
  it('G89-03: a REAL Ed25519 signature of a development key reads "Manifest signature (Ed25519, Core key …)" with the development-key mark; nothing says simulated or demo', async () => {
    opened = await openItem(`/evidence/${EV.sealed}?tab=integrity`, EV.sealed, { change: asReal({}, { developmentKey: true }), media: NONE })
    await findDetailBody()
    const card = await hashes()
    expect(card).toHaveAttribute('data-source', 'item')
    expect(card).toHaveTextContent('Manifest signature (Ed25519, Core key CORE-KEY-EVSIGN-01)')
    expect(screen.getByTestId('evidence-signature-key-item')).toHaveTextContent(F.signature.developmentKey)
    expect(card.textContent ?? '').not.toMatch(SIMULATED_WORDS)
    expect(card).not.toHaveTextContent('DEMO')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('G89-03: the class of the key is "not reported" while neither the item nor a verify result states it', async () => {
    opened = await openItem(`/evidence/${EV.sealed}?tab=integrity`, EV.sealed, { change: asReal(), media: NONE })
    await findDetailBody()
    const card = await hashes()
    expect(screen.getByTestId('evidence-signature-key-item')).toHaveTextContent(F.signature.keyClassUnknown)
    expect(card).not.toHaveTextContent(F.signature.developmentKey)
    expect(card.textContent ?? '').not.toMatch(SIMULATED_WORDS)
  })

  it('G89-03, negative control: a simulated item keeps its simulated label and gets no Core-key line', async () => {
    opened = await openItem(`/evidence/${EV.sealed}?tab=integrity`, EV.sealed, { media: NONE })
    await findDetailBody()
    const card = await hashes()
    expect(card).toHaveTextContent('simulated')
    expect(card).not.toHaveTextContent('Core key')
    expect(screen.queryByTestId('evidence-signature-key-item')).toBeNull()
  })
})

describe('G89-04 / G89-09: the file, hash and key rows of a v2 item are the item\'s own', () => {
  it('G89-04: before a verify run a REAL item lists its camera files, its manifest hash and its signature - no AUDIO row and none of the six v1 rows', async () => {
    opened = await openItem(`/evidence/${EV.sealed}?tab=integrity`, EV.sealed, { change: asReal(), media: NONE })
    await findDetailBody()
    const card = await hashes()
    expect(hashRows(card)).toEqual(['VIDEO-01', 'VIDEO-02', 'manifest', 'manifestVersion', 'signature'])
    expect(card).toHaveTextContent(F.sealed.title)
    expect(card).toHaveTextContent('VIDEO-01 · sealed file')
    expect(card.textContent ?? '').not.toMatch(/AUDIO-0[12]|MIC [12]/)
    const verifyCard = screen.getByTestId('evidence-verify-card')
    expect(verifyCard.querySelectorAll('[data-check]')).toHaveLength(0)
    expect(verifyCard.textContent ?? '').not.toMatch(/AUDIO-0[12]|Pending/)
  })

  it('G89-09: a seed-sealed v2 DEMO item shows no bundled v1 package values and no "Bundled demo package" panel, before and after a verify run', async () => {
    const seedSealed = (item: EvidenceItem): EvidenceItem =>
      ({
        ...asReal()(item),
        integritySource: 'DEMO_PACKAGE',
        files: [
          { trackId: 'VIDEO-01', fileName: 'fragments/VIDEO-01.mp4', sizeBytes: 3_500, sha256: H('a'), fragmentCount: 5 },
          { trackId: 'VIDEO-02', fileName: 'fragments/VIDEO-02.mp4', sizeBytes: 3_500, sha256: H('b'), fragmentCount: 5 },
        ],
      }) as EvidenceItem
    opened = await openItem(`/evidence/${EV.sealed}?tab=integrity`, EV.sealed, {
      change: seedSealed,
      media: { source: 'DEMO_PACKAGE', packageSuffix: '0001' },
      before: (bed) => bed.fake.answer('verifyEvidence', (call) => ({ status: 200, body: { ...RECORDED_VERIFY_V2.pass.body, evidenceId: call.params.id ?? '', at: bed.fake.clock.now() } }) as never),
    })
    await findDetailBody()
    const card = await hashes()
    expect(card).toHaveAttribute('data-source', 'item')
    expect(hashRows(card)).toEqual(['VIDEO-01', 'VIDEO-02', 'manifest', 'manifestVersion', 'signature'])
    expect(card).toHaveTextContent(H('a').slice(0, 16))
    expect(card.textContent ?? '').not.toMatch(/DEMO-KEY|DEMO key|AUDIO-0[12]|certificate/i)
    fireEvent.click(screen.getByTestId('evidence-verify'))
    await waitFor(() => expect(screen.getByTestId('evidence-verdict')).toHaveAttribute('data-verdict', 'PASS'), UI)
    expect(screen.queryByTestId('evidence-bundled')).toBeNull()
    expect(screen.queryByTestId('evidence-bundled-differs')).toBeNull()
    expect(screen.getByTestId('evidence-hashes')).toHaveAttribute('data-source', 'item')
  })
})

describe('G89-05: the sources line of a v1 item', () => {
  it('G89-05: a v1 verify result carries "Sources: not recorded (v1 package)" where a v2 result shows its sources line', async () => {
    installBrowserStubs()
    const { sim } = mountEvidence('/evidence/EV-20260929-0001?tab=integrity', { assets: await diskAssets() })
    await findPage('page-evidence-detail')
    expect(sim.store.getState().evidence.some((entry) => entry.id === 'EV-20260929-0001')).toBe(true)
    expect(screen.queryByTestId('evidence-v1-sources')).toBeNull()
    fireEvent.click(screen.getByTestId('evidence-verify'))
    await waitFor(() => expect(screen.getByTestId('evidence-verdict')).toHaveAttribute('data-verdict', 'PASS'), { timeout: 20_000 })
    expect(screen.getByTestId('evidence-v1-sources')).toHaveTextContent(en.common.sourceClass.verify.v1)
    expect(screen.queryByTestId('evidence-v2-sources')).toBeNull()
  })
})
