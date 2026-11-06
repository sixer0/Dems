/**
 * @vitest-environment jsdom
 */
// LCD bridge task: the seventh cell of the Login device strip in Live mode — the firmware word the
// front panel states about itself (operation 114, PUBLIC). The cell is rendered in isolation, on a
// stubbed `fetch`, because the three things this row must prove are all about its own answer:
//
// | What must hold | Where it is proven here |
//|----------------|---------------------------|
//| The read is the registry's operation, on the Core's own REST surface, with no credential added | "asks the Core, anonymously" |
//| A stated version is shown as it was stated | "shows what the panel said" |
//| An unknown panel is an ordinary state of the strip, not an error, and not an empty hole | "no panel", "a failed read" |
//| No English is hardcoded in the component | every assertion reads `en.login.live.deviceStrip` |
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PanelFirmwareResponse } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { getMissingI18nKeys, i18n, resetMissingI18nKeys } from '@/i18n'
import { MotionPolicyProvider } from '@/motion'
import { PanelFirmwareCell } from '../device-strip'

const T = en.login.live.deviceStrip

/** The cell under the providers it needs, with `fetch` answering what the test says. */
function mountCell(answer: () => Promise<Response>): { readonly urls: string[] } {
  const urls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      urls.push(String(input))
      return answer()
    }),
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MotionPolicyProvider>
          <PanelFirmwareCell />
        </MotionPolicyProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  )
  return { urls }
}

const body = (value: PanelFirmwareResponse): Promise<Response> => Promise.resolve(new Response(JSON.stringify(value), { status: 200 }))

beforeEach(() => resetMissingI18nKeys())

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the panel firmware cell of the Live device strip', () => {
  it("shows what the panel said, asked of the Core's public route with no credential", async () => {
    const { urls } = mountCell(() => body({ panelFirmware: 'v3.8', verdict: 'OK' }))
    const cell = screen.getByTestId('login-panel-firmware')
    await waitFor(() => expect(cell).toHaveTextContent('v3.8'))
    expect(cell).toHaveAttribute('data-state', 'OK')
    expect(cell.textContent).toContain(T.panelFirmware)
    // One read of the registry's path, and nothing that carries a credential: the screen is anonymous.
    expect(urls).toEqual([expect.stringContaining('/api/v1/lcd/panel-info')])
    expect(urls[0]).not.toMatch(/token|credential|session/i)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('a Core that knows nothing of its panel shows the same Unknown the other public cells fall back to', async () => {
    const { urls } = mountCell(() => body({ panelFirmware: '', verdict: '' }))
    const cell = screen.getByTestId('login-panel-firmware')
    await waitFor(() => expect(cell).toHaveTextContent(T.unknown))
    expect(cell).toHaveAttribute('data-state', 'unknown')
    expect(cell.textContent).not.toMatch(/error|failed|500/i)
    expect(urls).toHaveLength(1)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('a read that failed leaves the strip standing: Unknown, no crash, no second wording', async () => {
    mountCell(() => Promise.reject(new Error('ECONNREFUSED')))
    const cell = screen.getByTestId('login-panel-firmware')
    await waitFor(() => expect(cell).toHaveTextContent(T.unknown))
    expect(cell).toHaveAttribute('data-state', 'unknown')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('a word of the tool the console does not know is still shown as itself, and its version stays readable', async () => {
    mountCell(() => body({ panelFirmware: 'v4.0-rc1', verdict: 'PANEL-DIAM' }))
    const cell = screen.getByTestId('login-panel-firmware')
    await waitFor(() => expect(cell).toHaveTextContent('v4.0-rc1'))
    expect(cell).toHaveAttribute('data-state', 'PANEL-DIAM')
    expect(getMissingI18nKeys()).toEqual([])
  })
});
