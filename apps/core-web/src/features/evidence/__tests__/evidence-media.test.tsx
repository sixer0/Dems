// Step 47 media tab (01_specs §14.5.3; D50; review 40 R2/M2): VIDEO-01/VIDEO-02 and the separate MIC
// tracks AUDIO-01/AUDIO-02 play from the package's own stored paths (EV 0005's AUDIO-02 is its
// altered copy, EV 0014 the live loops), the audio switch selects AUDIO-02 (unmuted, AUDIO-01
// muted), the camera switch keeps the position, and playback is labelled as a DEMO excerpt whose
// position follows the step-92 rule p mod excerpt.
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDemoEvidencePackage } from '@dems/shared/demo-data'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { diskAssets, findPage, installBrowserStubs, mountEvidence, stopSims } from './harness'

const UI_TIMEOUT = 30_000
const PKG_0005 = getDemoEvidencePackage('0005')
if (!PKG_0005) throw new Error('DEMO package 0005 is required')

let stubs: ReturnType<typeof installBrowserStubs>

beforeEach(() => {
  resetMissingI18nKeys()
  stubs = installBrowserStubs()
})

afterEach(() => {
  cleanup()
  stopSims()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function audio(id: 'AUDIO-01' | 'AUDIO-02'): HTMLAudioElement {
  return screen.getByTestId(`evidence-audio-${id}`) as HTMLAudioElement
}

describe('media tab', () => {
  it('switches the audio track to AUDIO-02 (MIC 2): unmuted, AUDIO-01 muted, both from the package paths', async () => {
    mountEvidence(`/evidence/${PKG_0005.evidenceId}?tab=media`, { assets: await diskAssets() })
    await findPage('page-evidence-detail')
    const media = await screen.findByTestId('evidence-media')
    expect(media).toHaveAttribute('data-mic', 'AUDIO-01')
    expect(audio('AUDIO-01').muted).toBe(false)
    expect(audio('AUDIO-02').muted).toBe(true)

    fireEvent.click(screen.getByTestId('evidence-mic-AUDIO-02'))
    await waitFor(() => expect(media).toHaveAttribute('data-mic', 'AUDIO-02'))
    expect(audio('AUDIO-02').muted).toBe(false)
    expect(audio('AUDIO-01').muted).toBe(true)
    expect(audio('AUDIO-02')).toHaveAttribute('data-active', 'true')
    expect(screen.getByTestId('evidence-mic-AUDIO-02')).toHaveAttribute('aria-checked', 'true')

    // EV 0005 plays the package's stored (altered) AUDIO-02, not the pristine media-folder copy.
    expect(audio('AUDIO-02').getAttribute('src')).toContain('demo-evidence/SESSION-SES-20260930-0015/media/AUDIO-02.m4a')
    expect(audio('AUDIO-01').getAttribute('src')).toContain('demo-media/evidence/0005/AUDIO-01.m4a')
    expect(getMissingI18nKeys()).toEqual([])
  }, UI_TIMEOUT)

  it('plays video and both MIC tracks together, labelled as a DEMO excerpt, and switches cameras', async () => {
    mountEvidence(`/evidence/${PKG_0005.evidenceId}?tab=media`, { assets: await diskAssets() })
    await findPage('page-evidence-detail')
    const media = await screen.findByTestId('evidence-media')
    expect(screen.getByTestId('evidence-excerpt-chip')).toHaveTextContent('DEMO excerpt')
    expect(screen.getByTestId('evidence-excerpt-note')).toHaveTextContent('0:42')

    const video = screen.getByTestId('evidence-video') as HTMLVideoElement
    expect(video.muted).toBe(true)
    expect(video.getAttribute('src')).toContain('demo-media/evidence/0005/VIDEO-01.mp4')

    fireEvent.click(screen.getByTestId('evidence-play-toggle'))
    await waitFor(() => expect(media).toHaveAttribute('data-playing', 'true'))
    // One video plus two MIC tracks were started in sync.
    expect(stubs.play).toHaveBeenCalledTimes(3)

    fireEvent.click(screen.getByTestId('evidence-camera-VIDEO-02'))
    await waitFor(() => expect(media).toHaveAttribute('data-camera', 'VIDEO-02'))
    expect((screen.getByTestId('evidence-video') as HTMLVideoElement).getAttribute('src')).toContain('demo-media/evidence/0005/VIDEO-02.mp4')

    fireEvent.click(screen.getByTestId('evidence-play-toggle'))
    await waitFor(() => expect(media).toHaveAttribute('data-playing', 'false'))
  }, UI_TIMEOUT)

  it('the header Play button opens the Media tab and starts playback', async () => {
    mountEvidence(`/evidence/${PKG_0005.evidenceId}?tab=metadata`, { assets: await diskAssets() })
    await findPage('page-evidence-detail')
    expect(await screen.findByTestId('evidence-metadata')).toHaveAttribute('data-package', 'demo')
    expect(screen.getByTestId('evidence-manifest-fields').querySelectorAll('[data-field]')).toHaveLength(13)
    fireEvent.click(screen.getByTestId('evidence-play'))
    const media = await screen.findByTestId('evidence-media')
    await waitFor(() => expect(media).toHaveAttribute('data-playing', 'true'))
  }, UI_TIMEOUT)

  it('the recording-scenario package (EV 0014) resolves to the live loops', () => {
    const pkg = getDemoEvidencePackage('0014')
    expect(pkg?.tracks.map((track) => track.stored.path)).toEqual([
      'demo-media/live/VIDEO-01.loop.mp4',
      'demo-media/live/VIDEO-02.loop.mp4',
      'demo-media/live/AUDIO-01.loop.m4a',
      'demo-media/live/AUDIO-02.loop.m4a',
    ])
  })
})
