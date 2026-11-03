/**
 * D57c (2026-11-03): the pre-delivery panel setup module of the System page.
 *
 * The module is the console twin of the panel's own /setup page: operations 118/119
 * `getPanelSetup` / `setPanelSetup`, offered to the VENDOR accounts only (root, gsp.teknisi —
 * identity, not role; D57), and Live-only like the demo panel is SIMULATED-only. The Core checks
 * the same identity on every request; what the page proves is the reader, the wording and the
 * shape of what travels.
 *
 * | Rule proven | Case |
 * |------------|------|
 * | Offered to a vendor session only; a client supervisor never sees it and nothing is asked for it | "a client session…" |
 * | A vendor session loads with ONE GET (StrictMode included) and fills both words and both logo states | "loads once" |
 * | Save sends ONLY what changed; the answer repaints the panel; one success note | "sends only the change" |
 * | A picked PNG joins the body as base64 with its slot; the pick alone already enables Save | "a picked PNG" |
 * | The refusals are worded on the field, not swallowed: 403, 422-with-reason, 401 | "worded" |
 * | Nothing dirty: Save is disabled and no write is ever sent | "nothing dirty" |
 * | A Core that cannot answer the load: the outage is stated and the fields stay disabled | "outage at load" |
 * | Simulated mode never offers the module, vendor or not | "Simulated" |
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { CoreMode } from '@dems/shared/live'
import { ApiErrorCode } from '@dems/shared/api'
import { ALWAYS_VISIBLE, VENDOR_ROOT_USERNAME, createManualClock, createMemoryAuthStorage, createSim } from '@dems/shared/sim'
import { afterEach, describe, expect, it } from 'vitest'
import { createAppRouter } from '@/router'
import { SUPERVISOR_SESSION, createLiveTestBed, type LiveTestBed } from '@/runtime/testing/live-harness'

/** What the front panel holds of its pre-delivery setup (the shape of operations 118/119). */
interface PanelSetupState {
  satker: string
  client: string
  clientLogoSaved: boolean
  splashLogoSaved: boolean
}

const BLANK: PanelSetupState = { satker: '', client: '', clientLogoSaved: false, splashLogoSaved: false }
const SET_UP: PanelSetupState = { satker: 'DITRESKRIMUM POLDA METRO JAYA', client: 'PT GSP', clientLogoSaved: true, splashLogoSaved: false }

/** The refusal envelope of the contract, with the code typed as the contract types it. */
const refusal = (status: number, code: (typeof ApiErrorCode)[keyof typeof ApiErrorCode], message: string, details?: Record<string, string>): { status: number; body: Record<string, unknown> } => ({
  status,
  body: { error: { code, message, ...(details ? { details } : {}), requestId: 'req-test' } },
})

let bed: LiveTestBed | undefined
let held: PanelSetupState = { ...SET_UP }
/** Scripted refusal for the next write; null applies the change to `held`, as the model Core would. */
let writeRefusal: { status: number; code: (typeof ApiErrorCode)[keyof typeof ApiErrorCode]; message: string; reason?: string } | null = null

function reset(initial: PanelSetupState = SET_UP): void {
  held = { ...initial }
  writeRefusal = null
}

/** The same supervisor session under the root identity: D57 gates on the account, not the role. */
const ROOT_SESSION: typeof SUPERVISOR_SESSION = {
  ...SUPERVISOR_SESSION,
  operator: { ...SUPERVISOR_SESSION.operator, id: 'OPR-001', username: VENDOR_ROOT_USERNAME, name: 'Root', displayName: 'Root', initials: 'R' },
}

const isVendor = (created: LiveTestBed): boolean => {
  const username = created.core.session?.operator.username
  return username === VENDOR_ROOT_USERNAME || username === 'gsp.teknisi'
}

/** Mounts /system on a fresh bed whose Core answers the two operations from `held`. */
async function openSystem(session: typeof SUPERVISOR_SESSION, options: { failLoad?: boolean; blank?: boolean } = {}): Promise<LiveTestBed> {
  reset(options.blank ? BLANK : SET_UP)
  const created = createLiveTestBed({ session })
  bed = created
  created.fake.answer('getPanelSetup', () => {
    if (!created.core.alive() || created.core.session === null) return refusal(401, ApiErrorCode.NOT_SIGNED_IN, 'Sign in first.')
    if (!isVendor(created)) return refusal(403, ApiErrorCode.NOT_PERMITTED, 'Only the vendor accounts may open the pre-delivery panel setup.')
    // The outage arrives as the transport rejecting, exactly as against a dead port (the harness's
    // own `answered` form): the client words it as its network failure, never as an empty panel.
    if (options.failLoad) return { outage: true } as never
    return { status: 200, body: { ...held } }
  })
  created.fake.answer('setPanelSetup', (call) => {
    if (!created.core.alive() || created.core.session === null) return refusal(401, ApiErrorCode.NOT_SIGNED_IN, 'Sign in first.')
    if (!isVendor(created)) return refusal(403, ApiErrorCode.NOT_PERMITTED, 'Only the vendor accounts may open the pre-delivery panel setup.')
    if (writeRefusal !== null) {
      const s = writeRefusal
      return refusal(s.status, s.code, s.message, s.reason ? { reason: s.reason } : undefined)
    }
    const body = (call.body ?? {}) as Partial<{ satker: string; client: string; logoBase64: string; logoTarget: string }>
    if (body.satker !== undefined) held = { ...held, satker: body.satker }
    if (body.client !== undefined) held = { ...held, client: body.client }
    if (body.logoBase64 !== undefined) {
      const target = body.logoTarget ?? 'client'
      held = {
        ...held,
        ...(target === 'client' || target === 'both' ? { clientLogoSaved: true } : {}),
        ...(target === 'splash' || target === 'both' ? { splashLogoSaved: true } : {}),
      }
    }
    return { status: 200, body: { ...held } }
  })
  const page = await created.load()
  await created.mount(page, '/system', { strict: true })
  await screen.findByTestId('page-system')
  return created
}

const panel = async (): Promise<HTMLElement> => screen.findByTestId('panel-pre-delivery-setup')
// The react-aria TextField puts the test id on its wrapper: the input lives inside it.
const field = (name: 'satker' | 'client'): HTMLInputElement =>
  (screen.getByTestId(`panel-setup-${name}`) as HTMLElement).querySelector('input') as HTMLInputElement
const saveButton = (): HTMLButtonElement => screen.getByTestId('panel-setup-save') as HTMLButtonElement

describe('D57c: the pre-delivery panel setup on the System page (Live)', () => {
  afterEach(() => {
    cleanup()
    bed?.dispose()
    bed = undefined
  })

  it('a client session never sees the module and nothing is asked for it', async () => {
    const created = await openSystem(SUPERVISOR_SESSION)
    expect(screen.queryByTestId('panel-pre-delivery-setup')).toBeNull()
    expect(created.fake.log.requestsOf('getPanelSetup')).toHaveLength(0)
    expect(created.fake.log.requestsOf('setPanelSetup')).toHaveLength(0)
  })

  it('a vendor session: ONE GET of the operation (StrictMode), both words filled, both logo states stated', async () => {
    const created = await openSystem(ROOT_SESSION)
    const block = await panel()
    expect(field('satker').value).toBe(SET_UP.satker)
    expect(field('client').value).toBe(SET_UP.client)
    expect(block.textContent).toContain('client: stored')
    expect(block.textContent).toContain('splash: empty')
    await waitFor(() => expect(created.fake.log.requestsOf('getPanelSetup')).toHaveLength(1))
  })

  it('save sends ONLY the word that changed; the answer repaints the panel and one note shows', async () => {
    const created = await openSystem(ROOT_SESSION)
    await panel()
    fireEvent.change(field('client'), { target: { value: 'PT GSP SEJAHTERA' } })
    fireEvent.click(saveButton())
    await waitFor(() => expect(created.fake.log.requestsOf('setPanelSetup')).toHaveLength(1))
    expect(created.fake.log.requestsOf('setPanelSetup')[0].body).toEqual({ client: 'PT GSP SEJAHTERA' })
    await waitFor(() => expect(field('client').value).toBe('PT GSP SEJAHTERA'))
    // One note on the field and the same word as a toast: count both, they are the page's pair.
    expect(screen.getAllByText('The panel service accepted the change.').length).toBe(2)
    expect(held.client).toBe('PT GSP SEJAHTERA')
    expect(held.satker).toBe(SET_UP.satker)
  })

  it('a picked PNG joins the body as base64 with its slot; the pick alone already enables Save', async () => {
    const created = await openSystem(ROOT_SESSION, { blank: true })
    const block = await panel()
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])], 'logo.png', { type: 'image/png' })
    const input = within(block).getByTestId('panel-setup-logo-file') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    fireEvent.change(input)
    await waitFor(() => expect(saveButton().disabled).toBe(false))
    const select = within(block).getByRole('combobox') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'splash' } })
    fireEvent.click(saveButton())
    await waitFor(() => expect(created.fake.log.requestsOf('setPanelSetup')).toHaveLength(1))
    const body = created.fake.log.requestsOf('setPanelSetup')[0].body as Record<string, unknown>
    expect(typeof body.logoBase64).toBe('string')
    expect((body.logoBase64 as string).length).toBeGreaterThan(0)
    expect(body.logoTarget).toBe('splash')
    expect(body.satker).toBeUndefined()
    expect(body.client).toBeUndefined()
    expect(held.splashLogoSaved).toBe(true)
    expect(held.clientLogoSaved).toBe(false)
  })

  it('a PNG over the console path bound is refused at the pick: its own sentence, nothing sent', async () => {
    const created = await openSystem(ROOT_SESSION)
    const block = await panel()
    const big = new File([new Uint8Array(50_000)], 'big.png', { type: 'image/png' })
    const input = within(block).getByTestId('panel-setup-logo-file') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [big], configurable: true })
    fireEvent.change(input)
    await waitFor(() => expect(block.textContent).toContain('too large for the console link'))
    expect(saveButton().disabled).toBe(true)
    expect(created.fake.log.requestsOf('setPanelSetup')).toHaveLength(0)
  })

  it('the refusals are worded on the field, not swallowed: 403, 422 with the backend reason, 401', async () => {
    const scripted = [
      [{ status: 403, code: ApiErrorCode.NOT_PERMITTED, message: 'not the vendor' }, 'This module belongs to the vendor accounts only.'],
      [{ status: 422, code: ApiErrorCode.INVALID_INPUT, message: 'The panel backend did not accept the change.', reason: 'PNG tidak sah' }, 'The panel service refused the change: PNG tidak sah'],
      [{ status: 401, code: ApiErrorCode.NOT_SIGNED_IN, message: 'gone' }, 'Sign in again: the panel service no longer recognises this session.'],
    ] as const
    for (const [script, needle] of scripted) {
      const created = await openSystem(ROOT_SESSION)
      await panel()
      writeRefusal = script
      fireEvent.change(field('satker'), { target: { value: 'AKPOL' } })
      fireEvent.click(saveButton())
      if (script.status === 401) {
        // A 401 is the runtime's own signal: the session is over and the console takes the
        // operator back to the sign-in page (the live-evidence-media-signout behaviour). The
        // panel's own sentence exists for a page that stays; here the ride home is the proof.
        await waitFor(() => expect(screen.queryByTestId('page-system') ?? screen.getByText(needle)).toBeTruthy())
      } else {
        await waitFor(() => expect(screen.getByText(needle)).toBeDefined())
      }
      expect(created.fake.log.requestsOf('setPanelSetup')).toHaveLength(1)
      cleanup()
      created.dispose()
      bed = undefined
    }
  })

  it('nothing dirty: Save is disabled and no write is ever sent', async () => {
    const created = await openSystem(ROOT_SESSION)
    await panel()
    expect(saveButton().disabled).toBe(true)
    expect(created.fake.log.requestsOf('setPanelSetup')).toHaveLength(0)
  })

  it('a Core that cannot answer the load: the outage is stated and the fields stay disabled', async () => {
    await openSystem(ROOT_SESSION, { failLoad: true })
    const block = await panel()
    await waitFor(() => expect(block.textContent).toContain('The panel service did not answer. Nothing was changed.'))
    expect(field('satker').disabled).toBe(true)
    expect(field('client').disabled).toBe(true)
    expect(saveButton().disabled).toBe(true)
  })
})

describe('D57c: Simulated mode never offers the module (vendor or not)', () => {
  it('the simulator lane shows no panel and asks nothing', async () => {
    // Mounted as live-system-demo.test.tsx mounts its Simulated control group.
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: 'OPR-001', issuedAt: Date.now() })
    const sim = createSim({
      storage: null,
      authStorage,
      clock: createManualClock(Date.now()),
      visibility: ALWAYS_VISIBLE,
      scheduler: () => () => undefined,
    })
    const router = createAppRouter(
      { sim, queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), coreMode: { mode: CoreMode.SIMULATED, selectable: true, switchTo: async () => false } },
      { history: createMemoryHistory({ initialEntries: ['/system'] }) },
    )
    render(<RouterProvider router={router} />)
    await screen.findByTestId('page-system')
    expect(screen.queryByTestId('panel-pre-delivery-setup')).toBeNull()
    sim.stop()
    cleanup()
  })
})
