/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Task 4, blueprint row 112 (M10): the commissioning screen of the camera network - settings
// (operations 101, 102), the factory address scan (103) and the temporary host address (104, 105).
// TECHNICIAN only (decision U10). The set-IP screens are row 113 and are not tested here.
//
// | Cell of the row (Verification) | Where |
// |--------------------------------|-------|
// | the screen is absent for a role without the permission | "Simulated mode: a role without CAPTURE_COMMISSION", "Live mode: the navigation and the route guard" |
// | a scan result lists the stub's device | "Simulated mode: the scan" |
// | the text says that a camera outside the list is found only by a typed address | "Simulated mode: TECHNICIAN" |
// | a write needs production capture operation - said in the screen | "Simulated mode: TECHNICIAN", "Simulated mode: a save" |
//
// WHICH ANSWERS ARE SIMULATOR-ONLY (the Core routes of 103 to 105 are being built by other rows; the
// screen is built against the contract `packages/shared/src/api/capture-commissioning.ts`):
//   - the configuration of operation 101 with the interface `simulated0` (`simCaptureNetworkConfig`);
//   - `409 COMMISSIONING_NOT_AVAILABLE` for EVERY save of operation 102 (the simulator has no host);
//   - the ONE synthetic device of operation 103 with `synthetic: true` (`simCameraFactoryScan`);
//   - `{ alias: null }` of operation 104: the simulator never holds a temporary address.
// The blocks named "Simulated mode" assert exactly these. The blocks named "Live mode" hand in
// CONTRACT-SHAPED answers through the fake transport (a stored save, a scan that left a temporary
// address, a removal, the refusal reasons): they prove what the screen does with such an answer,
// NOT that a Core gives it - that stays with the route rows (106 to 108) and the hardware package
// (`9A/H-05`: a real interface name and interface table, record 108).
//
// ROW 113 (WP-22c, the set-IP screens; operations 106 and 107) and ROW 118 (the installation
// acceptance and its revocation; operations 109 and 110) extend this file - the blocks "row 113" and
// "row 118" at its end.
//
// | Cell of row 113 | Where |
// |-----------------|-------|
// | a MAC mismatch stops the job on the screen | "row 113, Live mode: a hardware address mismatch" |
// | the credential field is never pre-filled and is cleared when the job ends | "row 113: the typed camera account" (never pre-filled; cleared at the press, so before the job even exists), "row 113, Live mode: the job" (the fields are gone while the job runs and after it) |
// | the five assertions of the typed account: not in component state, not in a URL / router state / storage / log / error boundary message, cleared on submit, cancel, unmount and navigation, not offered for Try-it, sent once exactly as typed (negative control) | "row 113: the typed camera account" |
// | `409 COMMISSIONING_NOT_AVAILABLE` said in plain words | "row 113, Simulated mode", "row 113, Live mode: every refusal" |
//
// | Cell of row 118 | Where |
// |-----------------|-------|
// | the form sends only keys of the key list | "row 118: the model", "row 118, Simulated mode", "row 118, Live mode" |
// | it is absent for a role without the permission | "rows 113 and 118: a role without CAPTURE_COMMISSION" |
//
// SIMULATOR-ONLY ANSWERS OF THESE TWO ROWS (asserted by the blocks named "Simulated mode"):
//   - operation 106: `409 COMMISSIONING_NOT_AVAILABLE` for EVERY start of the right form - the
//     simulator changes no camera and starts no job; the typed account is dropped unread;
//   - operation 107: `404` for every id - never reached by the screen, because no job starts;
//   - operation 109: `409 INSTALLATION_ACCEPTANCE_NOT_AVAILABLE` - the simulator keeps no record;
//   - operation 110: `409 INSTALLATION_ACCEPTANCE_NOT_IN_FORCE` - it never holds an acceptance.
// Every job (its states, the three hardware addresses, a mismatch, a lost job), every stored
// acceptance and every other refusal in the "Live mode" blocks is a CONTRACT-SHAPED answer handed in
// through the fake transport: it proves what the screen does with it, not that a Core gives it
// (records 111, 111b and 117; hardware checks `9A/H-13`, `9A/H-14`, `9A/H-15`).
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CAPTURE_COMMISSIONING_REFUSAL_SENTENCES,
  CAPTURE_NETWORK_CONFIG_DEFAULTS,
  CaptureCommissioningReason,
  SIM_CAMERA_SUBNET,
  SIM_CAPTURE_INTERFACE_NAME,
  SIM_FACTORY_CAMERA_MAC,
  SIM_FACTORY_CAMERA_NAME,
  simCaptureNetworkConfig,
  CREDENTIAL_CARRYING_OPERATIONS,
  INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES,
  INSTALLATION_ACCEPTANCE_STEP_IDS,
  INSTALLATION_ACCEPTANCE_STEP_KEYS,
  INSTALLATION_ACCEPTANCE_STEP_TITLES,
  InstallationAcceptRequestSchema,
  InstallationAcceptanceReason,
  type AuthSessionInfo,
  type CameraFactoryScan,
  type CameraNetworkJob,
  type CaptureNetworkConfig,
  type FactoryCamera,
  type HostAlias,
  type InstallationAcceptance,
} from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { refusal } from '@dems/shared/live/testing'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, OPERATOR_IDS, OPERATORS, ROLE_PERMISSIONS, type Sim } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { enWeb } from '@/i18n-web'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createAppRouter } from '@/router'
import { webErrorSink } from '@/runtime'
import { createLiveTestBed, type LivePage, type LiveTestBed, type MountedPage } from '@/runtime/testing/live-harness'
import { TRY_IT_DENIED_OPERATIONS, deniedTryItOperation } from '@/features/api-reference/try-it'
import { ACCEPTANCE_STEP_IDS, acceptBodyOf, acceptanceFormSchema, acceptancePassedCount, acceptanceRefusal, acceptanceStepResult, acceptanceStepTitle, emptyAcceptanceForm, revokeBodyOf, revokeFormSchema } from '../acceptance-model'
import { commissioningRefusal, factoryListOf, formValuesOf, isNotProduction, networkSettingsFormSchema, settingsChangeOf, typedScanAddressOf } from '../model'
import { PanelErrorBoundary } from '../parts'
import { COMMISSIONING_RECORD } from '../report'
import { SET_IP_FIELD, macVerdict, scanConflict, scanCountNotKnown, setIpBodyOf, setIpRefusal, validateSetIpAddresses } from '../set-ip-model'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const W = enWeb.web.commissioning
const NETWORK = '/api/v1/capture/network'
const TECHNICIAN_SENTENCE = en.common.rbac.requiresRole.replace('{{role}}', 'TECHNICIAN')
type Call = { method: string; path: string; body?: unknown }

class SilentSocket implements SocketLike {
  readyState = 0
  onopen: SocketLike['onopen'] = null
  onmessage: SocketLike['onmessage'] = null
  onclose: SocketLike['onclose'] = null
  onerror: SocketLike['onerror'] = null
  close() {
    this.readyState = 3
  }
}

const sims: Sim[] = []
let bed: LiveTestBed | undefined
/** The page load and the mounted router of the last `live()` (rows 113 and 118 read the router, the caches and the page's log). */
let livePage: LivePage | undefined
let mounted: MountedPage | undefined

/** The screen in Simulated mode, by its address (the sidebar holds no entry there), on the real router and a real simulator. */
async function simulated(operatorId: string) {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId, issuedAt: Date.now() })
  const sim = createSim({ scenario: 'idle', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  const spy = vi.spyOn(sim, 'request')
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: ['/admin/commissioning'] }) })
  render(<RouterProvider router={router} />)
  const page = await screen.findByTestId('page-commissioning')
  const requests = () => (spy.mock.calls as unknown as [Call][]).map(([call]) => call)
  const network = () => requests().filter((call) => call.path.startsWith(NETWORK))
  return { sim, page, network, requests, router }
}

function sessionOf(operatorId: string): Pick<AuthSessionInfo, 'operator' | 'permissions'> {
  const operator = OPERATORS.find((entry) => entry.id === operatorId)!
  return {
    operator: { id: operator.id, username: operator.username, rank: operator.rank, name: operator.name, displayName: operator.displayName, initials: operator.initials, role: operator.role },
    permissions: [...ROLE_PERMISSIONS[operator.role]],
  }
}

const STORED: CaptureNetworkConfig = { ...simCaptureNetworkConfig(), interfaceName: 'eth1', cameraSubnet: '192.168.10.0/24', revision: 4, updatedAt: 1_760_000_000_000, updatedBy: OPERATOR_IDS.RINA }
const ALIAS: HostAlias = { aliasId: '0b0e6c8e-5a51-4c58-9d0a-2a1f1f6d7c11', address: '192.168.1.253', reason: 'FACTORY_SCAN', addedAt: 1_760_000_000_000, expiresAt: 1_760_001_800_000, removeError: null }

/** The screen in Live mode for `operatorId`, with contract-shaped answers of operations 101 and 104 handed in. */
async function live(operatorId: string, path = '/admin/commissioning') {
  const created = createLiveTestBed({ session: sessionOf(operatorId) })
  bed = created
  created.fake.answer('getCaptureNetworkConfig', { status: 200, body: STORED })
  created.fake.answer('getHostAlias', { status: 200, body: { alias: null } })
  const page = await created.load()
  livePage = page
  mounted = await created.mount(page, path)
  return created
}

const originalMatchMedia = window.matchMedia
/** matchMedia that answers `(min-width: Npx)` for a viewport width (jsdom has no layout): the sidebar is drawn from the desktop width. */
function viewport(width: number) {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query)
    return { matches: min ? width >= Number(min[1]) : false, media: query, onchange: null, addListener: () => undefined, removeListener: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => false } as MediaQueryList
  }) as typeof window.matchMedia
}
async function clearToasts() {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}

const originalGetContext = HTMLCanvasElement.prototype.getContext
const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
  HTMLMediaElement.prototype.play = (() => Promise.resolve()) as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = (() => undefined) as unknown as HTMLMediaElement['pause']
  Element.prototype.scrollTo ??= function scrollTo() {}
  Element.prototype.scrollIntoView ??= function scrollIntoView() {}
  window.scrollTo = (() => undefined) as typeof window.scrollTo
  Element.prototype.getAnimations ??= function getAnimations() {
    return []
  }
})
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
  HTMLMediaElement.prototype.play = originalPlay
  HTMLMediaElement.prototype.pause = originalPause
})
beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
})
afterEach(async () => {
  cleanup()
  await clearToasts()
  for (const sim of sims.splice(0)) sim.stop()
  bed?.dispose()
  bed = undefined
  livePage = undefined
  mounted = undefined
  vi.restoreAllMocks()
})

const field = (name: string) => screen.getByTestId(`com-field-${name}`) as HTMLInputElement | HTMLTextAreaElement
const type = (name: string, text: string) => fireEvent.change(field(name), { target: { value: text } })

describe('the model (contract `capture-commissioning.ts`)', () => {
  it('a refusal is named by its status and reason: the thirteen reasons of the contract, the lock, a stale revision, the role, a body not accepted, the rest', () => {
    const statusOf = (reason: string) => (reason === 'COMMISSIONING_ADDRESS_NOT_ALLOWED' || reason === 'NETWORK_CONFIG_NOT_ALLOWED' ? 422 : reason === 'COMMISSIONING_SCAN_RATE_LIMITED' ? 429 : 409)
    const reasons = Object.values(CaptureCommissioningReason)
    // Fifteen since row V6: `CAMERA_SCAN_TOO_OLD` (R119-03) and `CAMERA_HARDWARE_ADDRESS_NOT_BOUND` (R119-04), each worded by the contract's sentence.
    expect(reasons).toHaveLength(15)
    for (const reason of reasons) {
      expect(commissioningRefusal({ status: statusOf(reason), code: 'X', reason, cause: null })).toEqual({ kind: 'REASON', reason, cause: null })
      // Every reason has the contract's own sentence, and it quotes no address.
      expect(CAPTURE_COMMISSIONING_REFUSAL_SENTENCES[reason]).not.toMatch(/\d+\.\d+\.\d+\.\d+/)
    }
    expect(commissioningRefusal({ status: 409, code: 'INVALID_STATE', reason: 'HOST_ALIAS_FAILED', cause: 'HELPER_REFUSED' })).toEqual({ kind: 'REASON', reason: 'HOST_ALIAS_FAILED', cause: 'HELPER_REFUSED' })
    expect(commissioningRefusal({ status: 409, code: 'CAPTURE_CONFIG_LOCKED', reason: null, cause: null })).toEqual({ kind: 'LOCKED' })
    expect(commissioningRefusal({ status: 409, code: 'INVALID_STATE', reason: 'REVISION_CONFLICT', cause: null })).toEqual({ kind: 'REVISION_CONFLICT' })
    expect(commissioningRefusal({ status: 403, code: 'NOT_PERMITTED', reason: null, cause: null })).toEqual({ kind: 'ROLE' })
    expect(commissioningRefusal({ status: 422, code: 'INVALID_INPUT', reason: null, cause: null })).toEqual({ kind: 'INVALID_INPUT' })
    for (const status of [500, 503, 429, null]) expect(commissioningRefusal({ status, code: 'X', reason: null, cause: null })).toEqual({ kind: 'OTHER' })
    expect(isNotProduction({ kind: 'REASON', reason: 'COMMISSIONING_NOT_AVAILABLE', cause: null })).toBe(true)
    expect(isNotProduction({ kind: 'REASON', reason: 'COMMISSIONING_NOT_CONFIGURED', cause: null })).toBe(false)
    expect(isNotProduction({ kind: 'LOCKED' })).toBe(false)
  })

  it('the form holds the contract\'s forms, and a save carries the revision and ONLY what changed', () => {
    const config = STORED
    const values = formValuesOf(config)
    expect(networkSettingsFormSchema.safeParse(values).success).toBe(true)
    expect(settingsChangeOf(values, config)).toBeNull()
    expect(settingsChangeOf({ ...values, interfaceName: ' eth2 ' }, config)).toEqual({ revision: 4, interfaceName: 'eth2' })
    // An empty interface or subnet is "not chosen": null clears the choice.
    expect(settingsChangeOf({ ...values, cameraSubnet: '' }, config)).toEqual({ revision: 4, cameraSubnet: null })
    expect(settingsChangeOf({ ...values, factoryAddresses: '192.168.1.64, 192.168.1.108\n10.0.0.7', aliasMinutes: '45' }, config)).toEqual({ revision: 4, factoryAddresses: ['192.168.1.64', '192.168.1.108', '10.0.0.7'], aliasMinutes: 45 })
    expect(factoryListOf(' 192.168.1.64\n\n192.168.1.108 ,10.0.0.7 ')).toEqual(['192.168.1.64', '192.168.1.108', '10.0.0.7'])
    const refusedFields = (over: Partial<typeof values>) => {
      const parsed = networkSettingsFormSchema.safeParse({ ...values, ...over })
      return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)
    }
    expect(refusedFields({ interfaceName: 'Eth 1' })).toEqual(['interfaceName'])
    expect(refusedFields({ cameraSubnet: '8.8.8.0/24' })).toEqual(['cameraSubnet'])
    expect(refusedFields({ cameraSubnet: '192.168.10.0/8' })).toEqual(['cameraSubnet'])
    // A public address, a port, a name, a network or broadcast address, and one address twice are no factory list.
    for (const list of ['8.8.8.8', '192.168.1.64:80', 'camera.local', '192.168.1.0', '192.168.1.255', '192.168.1.64\n192.168.1.64']) expect(refusedFields({ factoryAddresses: list }), list).toEqual(['factoryAddresses'])
    expect(refusedFields({ factoryAddresses: Array.from({ length: 33 }, (_, index) => `10.0.0.${index + 1}`).join('\n') })).toEqual(['factoryAddresses'])
    expect(refusedFields({ aliasHost: '1' })).toEqual(['aliasHost'])
    expect(refusedFields({ aliasMinutes: '481' })).toEqual(['aliasMinutes'])
    expect(refusedFields({ cameraIpStart: '2.5' })).toEqual(['cameraIpStart'])
    // Values outside the form send nothing.
    expect(settingsChangeOf({ ...values, aliasHost: 'x' }, config)).toBeNull()
    expect(typedScanAddressOf(' 192.168.1.64 ')).toBe('192.168.1.64')
    for (const text of ['', '8.8.8.8', '192.168.1.64:80', '192.168.1.0', '192.168.1.64/24', 'camera.local', '127.0.0.1']) expect(typedScanAddressOf(text), text).toBeNull()
  })
})

describe('Simulated mode: a role without CAPTURE_COMMISSION (decision U10)', () => {
  it.each([['SUPERVISOR', OPERATOR_IDS.ANDI], ['INVESTIGATOR', OPERATOR_IDS.BUDI]] as const)('%s: the screen is absent - the role sentence, no panel, no control, and NOTHING is requested', async (_role, operatorId) => {
    const { sim, page, network } = await simulated(operatorId)
    expect(sim.store.getState().operators.find((operator) => operator.id === operatorId)!.role).not.toBe('TECHNICIAN')
    expect(await within(page).findByTestId('com-forbidden')).toHaveTextContent(TECHNICIAN_SENTENCE)
    for (const id of ['com-panel-settings', 'com-panel-scan', 'com-panel-alias', 'com-settings-form', 'com-scan-button', 'com-alias-state']) expect(screen.queryByTestId(id), id).not.toBeInTheDocument()
    expect(within(page).queryAllByRole('textbox')).toHaveLength(0)
    expect(network()).toEqual([])
    // The sidebar holds no entry in Simulated mode (an item that names a permission is Live only).
    expect(screen.queryByRole('link', { name: W.nav })).not.toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('Simulated mode: TECHNICIAN - the three panels on the simulator\'s synthetic answers', () => {
  it('opening the page reads the configuration and the address state and asks NO address; it says what is synthetic, what needs production capture operation, and that a camera outside the list is found only by a typed address', async () => {
    const { page, network } = await simulated(OPERATOR_IDS.RINA)
    expect(page).toHaveAttribute('data-mode', 'simulated')
    const form = await screen.findByTestId('com-settings-form')
    // SIMULATOR-ONLY: the fixed configuration, whose interface is named as simulated.
    expect(field('interfaceName').value).toBe(SIM_CAPTURE_INTERFACE_NAME)
    expect(field('cameraSubnet').value).toBe(SIM_CAMERA_SUBNET)
    expect(field('factoryAddresses').value).toBe(CAPTURE_NETWORK_CONFIG_DEFAULTS.factoryAddresses.join('\n'))
    expect(field('aliasHost').value).toBe('253')
    expect(field('aliasMinutes').value).toBe('30')
    expect(field('cameraIpStart').value).toBe('101')
    expect(form).toHaveAttribute('data-revision', '1')
    expect(screen.getByTestId('com-settings-written')).toHaveTextContent(W.settings.neverWritten)
    expect(screen.getByTestId('com-simulated')).toHaveTextContent(W.simulated)
    expect(screen.getByTestId('com-production-only')).toHaveTextContent(W.productionOnly)
    expect(screen.queryByTestId('com-not-production')).not.toBeInTheDocument()
    // The row's sentence, at the list and at the scan.
    expect(screen.getByTestId('com-factory-hint')).toHaveTextContent('A camera at an address outside this list is found only by a typed address.')
    expect(screen.getByTestId('com-scan-outside-list')).toHaveTextContent(W.scan.outsideList)
    // SIMULATOR-ONLY: no temporary address, ever.
    await waitFor(() => expect(screen.getByTestId('com-alias-state')).toHaveAttribute('data-present', 'false'))
    expect(screen.getByTestId('com-alias-state')).toHaveTextContent(W.alias.none)
    expect(screen.queryByTestId('com-alias-remove')).not.toBeInTheDocument()
    // Decision U9: nothing scans by itself. Two reads, no write.
    expect(network().map((call) => `${call.method} ${call.path}`).sort()).toEqual([`GET ${NETWORK}/alias`, `GET ${NETWORK}/config`])
    expect(screen.queryByTestId('com-scan-result')).not.toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('the scan: ONE request on one press; the result lists the stub\'s device and says it is synthetic; a typed address is asked beside the list; an address outside the form is refused in the form and nothing is sent', async () => {
    const { sim, network } = await simulated(OPERATOR_IDS.RINA)
    await screen.findByTestId('com-settings-form')
    const scans = () => network().filter((call) => call.method === 'POST' && call.path === `${NETWORK}/scan`)
    fireEvent.click(screen.getByTestId('com-scan-button'))
    const result = await screen.findByTestId('com-scan-result')
    expect(scans()).toEqual([{ method: 'POST', path: `${NETWORK}/scan`, body: {} }])
    // SIMULATOR-ONLY: one synthetic device at the first address of the fixed list.
    expect(result).toHaveAttribute('data-synthetic', 'true')
    expect(result).toHaveAttribute('data-devices', '1')
    expect(screen.getByTestId('com-scan-synthetic')).toHaveTextContent(W.scan.synthetic)
    const first = CAPTURE_NETWORK_CONFIG_DEFAULTS.factoryAddresses[0]
    const row = screen.getByTestId(`com-scan-row-${first}`)
    expect(row).toHaveTextContent(first)
    expect(row).toHaveTextContent(SIM_FACTORY_CAMERA_MAC)
    expect(row).toHaveTextContent(SIM_FACTORY_CAMERA_NAME)
    expect(row).toHaveTextContent(W.scan.onvifYes)
    expect(row).toHaveTextContent(W.scan.notRegistered)
    expect(screen.getByTestId('com-scan-summary')).toHaveTextContent(/^Asked 4 addresses at \d\d:\d\d:\d\d\.$/)
    // No link is drawn for an address or a device text.
    expect(within(result).queryAllByRole('link')).toHaveLength(0)

    // Outside the contract's form: refused beside the field, nothing leaves the page.
    for (const text of ['8.8.8.8', '192.168.1.64:80', 'camera.local']) {
      fireEvent.change(screen.getByTestId('com-scan-address'), { target: { value: text } })
      fireEvent.click(screen.getByTestId('com-scan-button'))
      expect(await screen.findByTestId('com-scan-address-error')).toHaveTextContent(W.scan.address.error)
    }
    expect(scans()).toHaveLength(1)

    // A typed address of the form is the one member of the body.
    fireEvent.change(screen.getByTestId('com-scan-address'), { target: { value: ' 192.168.0.20 ' } })
    fireEvent.click(screen.getByTestId('com-scan-button'))
    expect(await screen.findByTestId('com-scan-row-192.168.0.20')).toHaveTextContent(SIM_FACTORY_CAMERA_NAME)
    expect(scans()).toHaveLength(2)
    expect(scans()[1]!.body).toEqual({ address: '192.168.0.20' })
    expect(screen.getByTestId('com-scan-summary')).toHaveTextContent(/^Asked 5 addresses at /)
    // The simulator stored nothing and wrote no audit row.
    expect(sim.store.getState().audit.rows.filter((entry) => entry.type === 'CAMERA_FACTORY_SCANNED')).toHaveLength(0)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('a save: an unchanged form and a field outside its form send nothing; a changed setting is ONE request, and the SIMULATOR-ONLY answer "not available" is said as its sentence and as the standing notice that this Core is not in production capture operation', async () => {
    const { network } = await simulated(OPERATOR_IDS.RINA)
    await screen.findByTestId('com-settings-form')
    const saves = () => network().filter((call) => call.method === 'POST' && call.path === `${NETWORK}/config`)
    fireEvent.click(screen.getByTestId('com-settings-save'))
    expect(await screen.findByTestId('com-settings-unchanged')).toHaveTextContent(W.settings.unchanged)
    expect(saves()).toHaveLength(0)

    type('cameraSubnet', '8.8.8.0/24')
    type('aliasMinutes', '4')
    fireEvent.click(screen.getByTestId('com-settings-save'))
    expect(await screen.findByTestId('com-error-cameraSubnet')).toHaveTextContent(W.settings.cameraSubnet.error)
    expect(screen.getByTestId('com-error-aliasMinutes')).toHaveTextContent('Type a whole number from 5 to 480.')
    expect(saves()).toHaveLength(0)

    type('cameraSubnet', '192.168.20.0/24')
    type('aliasMinutes', '45')
    fireEvent.click(screen.getByTestId('com-settings-save'))
    const refused = await screen.findByTestId('com-settings-refusal')
    expect(saves()).toEqual([{ method: 'POST', path: `${NETWORK}/config`, body: { revision: 1, cameraSubnet: '192.168.20.0/24', aliasMinutes: 45 } }])
    expect(refused).toHaveAttribute('data-reason', 'COMMISSIONING_NOT_AVAILABLE')
    expect(refused.textContent).toBe(CAPTURE_COMMISSIONING_REFUSAL_SENTENCES.COMMISSIONING_NOT_AVAILABLE)
    expect(screen.getByTestId('com-not-production')).toHaveTextContent(W.notProduction)
    // The stored row is what it was: the form's revision did not move.
    expect(screen.getByTestId('com-settings-form')).toHaveAttribute('data-revision', '1')
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('Live mode: the navigation and the route guard by CAPTURE_COMMISSION (as the other permission-gated screens)', () => {
  it('a role without the permission: no entry in the sidebar, and the address leads to the Dashboard - the screen is never drawn and nothing of it is requested', async () => {
    const created = await live(OPERATOR_IDS.ANDI)
    await screen.findByTestId('page-dashboard')
    expect(screen.queryByTestId('page-commissioning')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: W.nav })).not.toBeInTheDocument()
    for (const operationId of ['getCaptureNetworkConfig', 'getHostAlias', 'scanFactoryCameras']) expect(created.fake.log.requestsOf(operationId), operationId).toEqual([])
  })

  it('TECHNICIAN: the entry is in the sidebar and opens the screen; a stored save moves the revision; a scan that left a temporary address shows it, and "Remove now" removes it (contract-shaped answers, handed in)', async () => {
    viewport(1920)
    const created = await live(OPERATOR_IDS.RINA, '/dashboard')
    await screen.findByTestId('page-dashboard')
    const entries = await screen.findAllByRole('link', { name: W.nav })
    fireEvent.click(entries[0]!)
    const page = await screen.findByTestId('page-commissioning')
    expect(page).toHaveAttribute('data-mode', 'live')
    await screen.findByTestId('com-settings-form')
    // Live mode: no "synthetic" notice; the standing sentence on production capture operation is there.
    expect(screen.queryByTestId('com-simulated')).not.toBeInTheDocument()
    expect(screen.getByTestId('com-production-only')).toHaveTextContent(W.productionOnly)
    expect(field('interfaceName').value).toBe('eth1')
    expect(screen.getByTestId('com-settings-written')).toHaveTextContent(`Revision 4 · Last written at`)
    expect(created.fake.log.requestsOf('scanFactoryCameras')).toEqual([])

    // A stored save: the answer is the new row.
    created.fake.answerOnce('updateCaptureNetworkConfig', { status: 200, body: { ...STORED, interfaceName: 'eth2', revision: 5 } })
    type('interfaceName', 'eth2')
    fireEvent.click(screen.getByTestId('com-settings-save'))
    await waitFor(() => expect(screen.getByTestId('com-settings-form')).toHaveAttribute('data-revision', '5'))
    expect(created.fake.log.requestsOf('updateCaptureNetworkConfig')).toHaveLength(1)
    expect(created.fake.log.requestsOf('updateCaptureNetworkConfig')[0]).toMatchObject({ method: 'POST', path: `${NETWORK}/config`, body: { revision: 4, interfaceName: 'eth2' } })
    expect(screen.queryByTestId('com-settings-refusal')).not.toBeInTheDocument()

    // A scan that found a camera with two answers at one address and left a temporary address in place.
    const found: CameraFactoryScan = {
      scannedAt: 1_760_000_000_000,
      addressCount: 4,
      devices: [{ address: '192.168.1.64', mac: null, onvifReachable: false, endpointCount: 2, deviceCount: 'MORE_THAN_ONE', vendor: null, model: null, name: null, registeredDeviceId: 'CAM-04' }],
      alias: ALIAS,
      synthetic: false,
    }
    created.fake.answerOnce('scanFactoryCameras', { status: 200, body: found })
    fireEvent.click(screen.getByTestId('com-scan-button'))
    const row = await screen.findByTestId('com-scan-row-192.168.1.64')
    expect(screen.queryByTestId('com-scan-synthetic')).not.toBeInTheDocument()
    expect(row).toHaveAttribute('data-conflict', 'true')
    expect(row).toHaveAttribute('data-device-count', 'MORE_THAN_ONE')
    expect(row).toHaveTextContent(W.scan.conflict)
    // A COUNTED conflict is not "not known": the two sentences never stand together.
    expect(screen.queryByTestId('com-scan-count-unknown-192.168.1.64')).not.toBeInTheDocument()
    expect(row).toHaveTextContent(W.scan.macUnknown)
    expect(row).toHaveTextContent(W.scan.deviceUnknown)
    expect(row).toHaveTextContent(W.scan.onvifNo)
    expect(row).toHaveTextContent('Registered as CAM-04')
    // The alias state follows the scan's answer.
    await waitFor(() => expect(screen.getByTestId('com-alias-state')).toHaveAttribute('data-present', 'true'))
    expect(screen.getByTestId('com-alias-address').textContent).toBe('192.168.1.253/24')
    expect(screen.getByTestId('com-alias-state')).toHaveTextContent(W.alias.reasons.FACTORY_SCAN)

    // A removal the helper failed: the sentence with the helper's code; the address is still said to be in place.
    created.fake.answerOnce('removeHostAlias', refusal(409, 'INVALID_STATE', 'The text of the answer is never drawn.', { reason: 'HOST_ALIAS_REMOVE_FAILED', cause: 'HELPER_TIMEOUT' }))
    created.fake.answer('getHostAlias', { status: 200, body: { alias: { ...ALIAS, removeError: 'HELPER_TIMEOUT' } } })
    fireEvent.click(screen.getByTestId('com-alias-remove'))
    const failed = await screen.findByTestId('com-alias-refusal')
    expect(failed.textContent).toBe(`${CAPTURE_COMMISSIONING_REFUSAL_SENTENCES.HOST_ALIAS_REMOVE_FAILED} Helper code: HELPER_TIMEOUT.`)
    expect(await screen.findByTestId('com-alias-remove-error')).toHaveTextContent('The last removal failed (code HELPER_TIMEOUT). The address is still in place.')
    expect(screen.getByTestId('com-alias-state')).toHaveAttribute('data-present', 'true')

    // A removal that worked.
    created.fake.answerOnce('removeHostAlias', { status: 200, body: { alias: null } })
    await waitFor(() => expect(screen.getByTestId('com-alias-remove')).toBeEnabled())
    fireEvent.click(screen.getByTestId('com-alias-remove'))
    await waitFor(() => expect(screen.getByTestId('com-alias-state')).toHaveAttribute('data-present', 'false'))
    expect(created.fake.log.requestsOf('removeHostAlias')).toHaveLength(2)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('every refusal with its sentence: a Core that is not in production capture operation, an open session, a stale revision (the form reads the stored row again), a setting the Core does not allow, a scan before the interface is chosen, a scan too soon', async () => {
    const created = await live(OPERATOR_IDS.RINA)
    await screen.findByTestId('com-settings-form')
    const save = async (answer: ReturnType<typeof refusal>, minutes: string) => {
      created.fake.answerOnce('updateCaptureNetworkConfig', answer)
      type('aliasMinutes', minutes)
      await waitFor(() => expect(screen.getByTestId('com-settings-save')).not.toHaveAttribute('aria-busy'))
      fireEvent.click(screen.getByTestId('com-settings-save'))
    }
    const settingsRefusal = () => screen.getByTestId('com-settings-refusal')

    await save(refusal(409, 'INVALID_STATE', 'Never drawn.', { reason: 'COMMISSIONING_NOT_AVAILABLE' }), '31')
    await waitFor(() => expect(settingsRefusal().textContent).toBe(CAPTURE_COMMISSIONING_REFUSAL_SENTENCES.COMMISSIONING_NOT_AVAILABLE))
    expect(screen.getByTestId('com-not-production')).toHaveTextContent(W.notProduction)

    await save(refusal(409, 'CAPTURE_CONFIG_LOCKED', 'Never drawn.'), '32')
    await waitFor(() => expect(settingsRefusal().textContent).toBe(W.refusal.LOCKED))

    await save(refusal(422, 'INVALID_INPUT', 'Never drawn.', { in: 'body', reason: 'NETWORK_CONFIG_NOT_ALLOWED' }), '33')
    await waitFor(() => expect(settingsRefusal().textContent).toBe(CAPTURE_COMMISSIONING_REFUSAL_SENTENCES.NETWORK_CONFIG_NOT_ALLOWED))

    // A stale revision: the sentence, and the form follows the row the Core holds now.
    created.fake.answer('getCaptureNetworkConfig', { status: 200, body: { ...STORED, aliasMinutes: 60, revision: 9 } })
    await save(refusal(409, 'INVALID_STATE', 'Never drawn.', { reason: 'REVISION_CONFLICT', currentRevision: 9 }), '34')
    await waitFor(() => expect(settingsRefusal().textContent).toBe(W.refusal.REVISION_CONFLICT))
    await waitFor(() => expect(screen.getByTestId('com-settings-form')).toHaveAttribute('data-revision', '9'))
    await waitFor(() => expect(field('aliasMinutes').value).toBe('60'))
    expect(created.fake.log.requestsOf('updateCaptureNetworkConfig')).toHaveLength(4)

    const scan = async (answer: ReturnType<typeof refusal> & { retryAfterSeconds?: number }) => {
      created.fake.answerOnce('scanFactoryCameras', answer)
      await waitFor(() => expect(screen.getByTestId('com-scan-button')).not.toHaveAttribute('aria-busy'))
      fireEvent.click(screen.getByTestId('com-scan-button'))
    }
    await scan(refusal(409, 'INVALID_STATE', 'Never drawn.', { reason: 'COMMISSIONING_NOT_CONFIGURED' }))
    await waitFor(() => expect(screen.getByTestId('com-scan-refusal').textContent).toBe(CAPTURE_COMMISSIONING_REFUSAL_SENTENCES.COMMISSIONING_NOT_CONFIGURED))
    await scan({ ...refusal(429, 'RATE_LIMITED', 'Never drawn.', { reason: 'COMMISSIONING_SCAN_RATE_LIMITED' }), retryAfterSeconds: 30 })
    await waitFor(() => expect(screen.getByTestId('com-scan-refusal').textContent).toBe(CAPTURE_COMMISSIONING_REFUSAL_SENTENCES.COMMISSIONING_SCAN_RATE_LIMITED))
    await scan(refusal(409, 'INVALID_STATE', 'Never drawn.', { reason: 'HOST_ALIAS_FAILED', cause: 'HELPER_REFUSED' }))
    await waitFor(() => expect(screen.getByTestId('com-scan-refusal').textContent).toBe(`${CAPTURE_COMMISSIONING_REFUSAL_SENTENCES.HOST_ALIAS_FAILED} Helper code: HELPER_REFUSED.`))
    expect(screen.queryByTestId('com-scan-result')).not.toBeInTheDocument()
    expect(document.body.textContent ?? '').not.toContain('Never drawn.')
    expect(getMissingI18nKeys()).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// Row 113 (the set-IP screens) and row 118 (the installation acceptance)
// ═══════════════════════════════════════════════════════════════════════════════════════

const S = W.setIp
const A = W.acceptance
const SET_PATH = `${NETWORK}/cameras/address`
const ACCEPTANCE_PATH = '/api/v1/installation/acceptance'
/** Synthetic, drawn for this file: no camera has this account. The password keeps its spaces (it is sent as typed). */
const USER = 'CANARYuser-4Tq'
const PASS = '  CANARYpass s3cr3t-8Wn  '
const MAC = 'AA:BB:CC:00:11:22'
const OTHER_MAC = 'AA:BB:CC:00:99:99'
const JOB_ID = 'CNJ-000123'
const FROM = '192.168.1.64'
const TARGET_ADDRESS = '192.168.10.101'

// Row V6 (R119-03): as the Core's scan answers today - the count of devices at the address is NOT KNOWN.
const camera = (over: Partial<FactoryCamera> = {}): FactoryCamera => ({ address: FROM, mac: MAC, onvifReachable: true, endpointCount: null, deviceCount: 'NOT_KNOWN', vendor: 'Acme', model: 'Dome 4', name: 'Lobby', registeredDeviceId: 'CAM-04', ...over })
const BARE = { vendor: null, model: null, name: null, registeredDeviceId: null } as const
/** A contract-shaped scan: the camera of the tests, an address with two answers (no address change is offered there), and a second camera. */
const SCAN: CameraFactoryScan = {
  scannedAt: 1_760_000_000_000,
  addressCount: 4,
  devices: [camera(), camera({ address: '192.168.1.108', mac: null, endpointCount: 2, deviceCount: 'MORE_THAN_ONE', ...BARE }), camera({ address: '10.0.0.7', mac: OTHER_MAC, ...BARE }), camera({ address: '192.168.0.90', mac: null, ...BARE })],
  alias: null,
  synthetic: false,
}
const job = (over: Partial<CameraNetworkJob> = {}): CameraNetworkJob => ({
  jobId: JOB_ID,
  state: 'RUNNING',
  step: 'REACHING',
  fromAddress: FROM,
  toAddress: null,
  scannedMac: MAC,
  deviceCount: 'NOT_KNOWN',
  neighbourMac: null,
  authenticatedMac: null,
  confirmedMac: null,
  deviceId: null,
  failure: null,
  startedAt: 1_760_000_000_000,
  endedAt: null,
  ...over,
})

const usernameField = () => screen.getByTestId('com-setip-username') as HTMLInputElement
const passwordField = () => screen.getByTestId('com-setip-password') as HTMLInputElement
const startButton = () => screen.getByTestId('com-setip-start')
const tick = (testId: string) => fireEvent.click(within(screen.getByTestId(testId)).getByRole('checkbox'))
const typeAccount = () => {
  fireEvent.change(usernameField(), { target: { value: USER } })
  fireEvent.change(passwordField(), { target: { value: PASS } })
}
/** Types the account, ticks "this is the camera I mean" and presses Start. */
async function fillAndStart() {
  await waitFor(() => expect(startButton()).not.toHaveAttribute('aria-busy'))
  typeAccount()
  tick('com-setip-confirm')
  await waitFor(() => expect(startButton()).toBeEnabled())
  fireEvent.click(startButton())
}
async function pick(address: string = FROM) {
  fireEvent.click(screen.getByTestId(`com-setip-pick-${address}`))
  await waitFor(() => expect(screen.getByTestId('com-setip-form')).toHaveAttribute('data-from', address))
}
/** Live mode, TECHNICIAN, with the contract-shaped scan result on the screen. */
async function liveScanned() {
  const created = await live(OPERATOR_IDS.RINA)
  await screen.findByTestId('com-settings-form')
  created.fake.answerOnce('scanFactoryCameras', { status: 200, body: SCAN })
  fireEvent.click(screen.getByTestId('com-scan-button'))
  await screen.findByTestId(`com-scan-row-${FROM}`)
  return created
}

describe('rows 113 and 118: a role without CAPTURE_COMMISSION (decision U10)', () => {
  it.each([['SUPERVISOR', OPERATOR_IDS.ANDI], ['INVESTIGATOR', OPERATOR_IDS.BUDI]] as const)('%s, Simulated mode: no set-IP panel, no acceptance form, no account field, and nothing is requested', async (_role, operatorId) => {
    const { page, requests } = await simulated(operatorId)
    await within(page).findByTestId('com-forbidden')
    for (const id of ['com-panel-setip', 'com-setip-form', 'com-setip-need-scan', 'com-panel-acceptance', 'com-acceptance-form', 'com-revoke-form', 'com-acceptance-not-gated']) expect(screen.queryByTestId(id), id).not.toBeInTheDocument()
    expect(page.querySelectorAll('input, textarea, [role="checkbox"]')).toHaveLength(0)
    expect(requests().filter((call) => call.path.startsWith(NETWORK) || call.path.startsWith(ACCEPTANCE_PATH))).toEqual([])
  })

  it('Live mode: the address leads to the Dashboard - neither panel is drawn and none of the four operations is asked', async () => {
    const created = await live(OPERATOR_IDS.ANDI)
    await screen.findByTestId('page-dashboard')
    for (const id of ['com-panel-setip', 'com-panel-acceptance']) expect(screen.queryByTestId(id), id).not.toBeInTheDocument()
    for (const operationId of ['setCameraNetwork', 'getCameraNetworkJob', 'acceptInstallation', 'revokeInstallationAcceptance']) expect(created.fake.log.requestsOf(operationId), operationId).toEqual([])
  })
})

describe('row 113: the model (operations 106 and 107 as record 111 built them)', () => {
  it('a refused start is named by its status and reason: "not available", an address not allowed, the two answers of the lock-out guard, and the rest as the commissioning screen names it', () => {
    expect(setIpRefusal({ status: 409, code: 'INVALID_STATE', reason: 'COMMISSIONING_NOT_AVAILABLE', cause: null })).toEqual({ kind: 'NOT_AVAILABLE' })
    expect(setIpRefusal({ status: 422, code: 'INVALID_INPUT', reason: 'COMMISSIONING_ADDRESS_NOT_ALLOWED', cause: null })).toEqual({ kind: 'ADDRESS_NOT_ALLOWED' })
    expect(setIpRefusal({ status: 429, code: 'RATE_LIMITED', reason: 'CONNECTION_TEST_LOCKOUT_GUARD', cause: null })).toEqual({ kind: 'LOCKOUT_GUARD' })
    expect(setIpRefusal({ status: 429, code: 'RATE_LIMITED', reason: 'CONNECTION_TEST_RATE_LIMITED', cause: null })).toEqual({ kind: 'RATE_LIMITED' })
    for (const reason of ['COMMISSIONING_HELPER_NOT_CONFIGURED', 'COMMISSIONING_NOT_CONFIGURED', 'COMMISSIONING_JOB_IN_PROGRESS', 'CAMERA_ADDRESS_CONFLICT', 'CAMERA_NEW_ADDRESS_IN_USE', 'CAMERA_NO_FREE_ADDRESS'] as const) {
      expect(setIpRefusal({ status: 409, code: 'INVALID_STATE', reason, cause: null }), reason).toEqual({ kind: 'REASON', reason, cause: null })
    }
    expect(setIpRefusal({ status: 409, code: 'CAPTURE_CONFIG_LOCKED', reason: null, cause: null })).toEqual({ kind: 'LOCKED' })
    expect(setIpRefusal({ status: 403, code: 'NOT_PERMITTED', reason: 'WEB_CONSOLE_ONLY', cause: null })).toEqual({ kind: 'ROLE' })
    expect(setIpRefusal({ status: 422, code: 'INVALID_INPUT', reason: null, cause: null })).toEqual({ kind: 'INVALID_INPUT' })
    for (const status of [500, 503, 429, null]) expect(setIpRefusal({ status, code: 'X', reason: null, cause: null })).toEqual({ kind: 'OTHER' })
  })

  it('the two addresses hold the contract\'s form; the body is `fromAddress`, the addresses only when typed, and the account pair exactly as handed in; the verdict of the two hardware addresses', () => {
    expect(validateSetIpAddresses(FROM, { toAddress: '', gateway: '' })).toEqual({})
    expect(validateSetIpAddresses(FROM, { toAddress: ` ${TARGET_ADDRESS} `, gateway: '192.168.10.1' })).toEqual({})
    for (const text of ['8.8.8.8', '192.168.10.101:80', '192.168.10.0', 'camera.local', '192.168.10.101/24']) {
      expect(validateSetIpAddresses(FROM, { toAddress: text, gateway: '' }), text).toEqual({ toAddress: 'form' })
      expect(validateSetIpAddresses(FROM, { toAddress: '', gateway: text }), text).toEqual({ gateway: 'form' })
    }
    expect(validateSetIpAddresses(FROM, { toAddress: FROM, gateway: '' })).toEqual({ toAddress: 'same' })

    const credential = { username: 'onvif', secret: '  typed as it is  ' }
    // Row V6 (R119-04): THE HARDWARE ADDRESS OF THE CHOSEN SCAN ROW is in every body, as the row showed it.
    const ROW = { address: FROM, mac: MAC }
    expect(setIpBodyOf(ROW, { toAddress: ` ${TARGET_ADDRESS} `, gateway: '' }, credential)).toEqual({ fromAddress: FROM, scannedMac: MAC, toAddress: TARGET_ADDRESS, credential })
    const least = setIpBodyOf(ROW, { toAddress: '', gateway: '' }, credential)
    expect(Object.keys(least!).sort()).toEqual(['credential', 'fromAddress', 'scannedMac'])
    expect(setIpBodyOf(ROW, { toAddress: '', gateway: '192.168.10.1' }, credential)).toEqual({ fromAddress: FROM, scannedMac: MAC, gateway: '192.168.10.1', credential })
    // Outside the contract's schema: nothing is built, so nothing can be sent.
    expect(setIpBodyOf({ address: '8.8.8.8', mac: MAC }, { toAddress: '', gateway: '' }, credential)).toBeNull()
    expect(setIpBodyOf(ROW, { toAddress: '', gateway: '' }, { username: 'onvif', secret: '' })).toBeNull()
    // A row whose scan showed NO hardware address, or one that is not of the strict form, builds no body at all.
    expect(setIpBodyOf({ address: FROM, mac: null }, { toAddress: '', gateway: '' }, credential)).toBeNull()
    expect(setIpBodyOf({ address: FROM, mac: MAC.toLowerCase() }, { toAddress: '', gateway: '' }, credential)).toBeNull()
    // WHAT THE SCAN KNEW (R119-03): "not known" is its own state - never "no conflict", never "one device".
    expect([scanConflict({ deviceCount: 'MORE_THAN_ONE' }), scanConflict({ deviceCount: 'ONE' }), scanConflict({ deviceCount: 'NOT_KNOWN' })]).toEqual([true, false, false])
    expect([scanCountNotKnown({ deviceCount: 'NOT_KNOWN' }), scanCountNotKnown({ deviceCount: 'ONE' }), scanCountNotKnown({ deviceCount: 'MORE_THAN_ONE' })]).toEqual([true, false, false])
    // An answer this console does not understand (a missing member, a word of a later contract) is "not known" too.
    expect(scanCountNotKnown({} as never)).toBe(true)
    expect(scanCountNotKnown({ deviceCount: 'NONE' } as never)).toBe(true)

    expect(macVerdict({ neighbourMac: null, authenticatedMac: null })).toBe('PENDING')
    expect(macVerdict({ neighbourMac: MAC, authenticatedMac: null })).toBe('PENDING')
    expect(macVerdict({ neighbourMac: MAC, authenticatedMac: MAC })).toBe('SAME')
    expect(macVerdict({ neighbourMac: MAC, authenticatedMac: OTHER_MAC })).toBe('DIFFERENT')
    // The account fields give a browser no sign-in form to fill.
    expect(SET_IP_FIELD.username.autoComplete).toBe('off')
    expect(SET_IP_FIELD.password.autoComplete).toBe('new-password')
  })

  it('THE PIN: the form cannot be submitted from the "Try it" page - operation 106 is on the deny list in every spelling of its path, as each credential-carrying operation is; 109 and 110 are on it too', () => {
    for (const operationId of CREDENTIAL_CARRYING_OPERATIONS) expect(TRY_IT_DENIED_OPERATIONS, operationId).toContain(operationId)
    expect(CREDENTIAL_CARRYING_OPERATIONS).toContain('setCameraNetwork')
    for (const path of [SET_PATH, `${SET_PATH}/`, SET_PATH.toUpperCase(), SET_PATH.replace('/cameras/', '//cameras/'), SET_PATH.replace('address', 'addr%65ss')]) expect(deniedTryItOperation('POST', path), path).toBe('setCameraNetwork')
    expect(deniedTryItOperation('POST', ACCEPTANCE_PATH)).toBe('acceptInstallation')
    expect(deniedTryItOperation('POST', `${ACCEPTANCE_PATH}/revoke`)).toBe('revokeInstallationAcceptance')
    // CONTROL: the read of a job carries no credential and stays offered.
    expect(deniedTryItOperation('GET', `${NETWORK}/jobs/${JOB_ID}`)).toBeNull()
  })
})

describe('row 113, Simulated mode: the set-IP screens on the simulator\'s answers', () => {
  it('nothing is offered before a scan; the chosen camera is shown with its address and the hardware address of the scan; a start is ONE request, and the SIMULATOR-ONLY answer "not available" is said in plain words - without claiming that this Core is not in production capture operation', async () => {
    const { requests } = await simulated(OPERATOR_IDS.RINA)
    await screen.findByTestId('com-settings-form')
    expect(screen.getByTestId('com-setip-need-scan')).toHaveTextContent(S.needScan)
    expect(screen.getByTestId('com-setip-simulated')).toHaveTextContent(S.simulated)
    expect(screen.queryByTestId('com-setip-form')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('com-scan-button'))
    await screen.findByTestId('com-scan-result')
    // SIMULATOR-ONLY: the one synthetic device at the first address of the fixed list.
    const first = CAPTURE_NETWORK_CONFIG_DEFAULTS.factoryAddresses[0]
    await pick(first)
    expect(screen.getByTestId('com-setip-picked-address').textContent).toBe(first)
    expect(screen.getByTestId('com-setip-picked-mac').textContent).toBe(SIM_FACTORY_CAMERA_MAC)
    expect(screen.getByTestId('com-setip-picked')).toHaveTextContent(SIM_FACTORY_CAMERA_NAME)
    expect(screen.getByTestId('com-setip-confirm')).toHaveTextContent(S.confirm.replace('{{address}}', first).replace('{{mac}}', SIM_FACTORY_CAMERA_MAC))
    expect(screen.getByTestId('com-setip-account-note')).toHaveTextContent(S.accountNote)
    // Start needs the account and the tick.
    expect(startButton()).toBeDisabled()
    typeAccount()
    expect(startButton()).toBeDisabled()
    tick('com-setip-confirm')
    await waitFor(() => expect(startButton()).toBeEnabled())

    // An address outside the contract's form is refused beside its field: nothing leaves the page, and the typed account stays for the correction.
    fireEvent.change(screen.getByTestId('com-setip-toAddress'), { target: { value: '8.8.8.8' } })
    fireEvent.click(startButton())
    expect(await screen.findByTestId('com-setip-toAddress-error')).toHaveTextContent(S.addressError.form)
    expect(requests().filter((call) => call.path === SET_PATH)).toHaveLength(0)
    expect(passwordField().value).toBe(PASS)

    fireEvent.change(screen.getByTestId('com-setip-toAddress'), { target: { value: '' } })
    fireEvent.click(startButton())
    const refused = await screen.findByTestId('com-setip-refusal')
    // NEGATIVE CONTROL of the canary search: the ONE request carries the account exactly as typed.
    expect(requests().filter((call) => call.path === SET_PATH)).toEqual([{ method: 'POST', path: SET_PATH, body: { fromAddress: first, scannedMac: SIM_FACTORY_CAMERA_MAC, credential: { username: USER, secret: PASS } } }])
    // SIMULATOR-ONLY: `409 COMMISSIONING_NOT_AVAILABLE` for every start.
    expect(refused).toHaveAttribute('data-refusal', 'NOT_AVAILABLE')
    expect(refused.textContent).toBe(S.refusal.NOT_AVAILABLE)
    expect(S.refusal.NOT_AVAILABLE).toContain('or its host does not provide what an address change needs')
    expect(screen.queryByTestId('com-not-production')).not.toBeInTheDocument()
    // Cleared at the press; no job, so no read of one (operation 107 answers 404 for every id in the simulator).
    expect(usernameField().value).toBe('')
    expect(passwordField().value).toBe('')
    expect(startButton()).toBeDisabled()
    expect(screen.queryByTestId('com-setip-job')).not.toBeInTheDocument()
    expect(requests().filter((call) => call.path.startsWith(`${NETWORK}/jobs`))).toEqual([])
    expect(document.body.innerHTML).not.toContain('CANARY')
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('row 113, Live mode: the job with its three hardware addresses (contract-shaped answers, handed in)', () => {
  it('the screen shows the TARGET address, the hardware address of the NEIGHBOUR TABLE and the one AFTER AUTHENTICATION as the job states them, says "the same device" only when the two are equal, and ends with the address the camera answers at; no other camera is offered meanwhile; the account fields are gone from the press on', async () => {
    const created = await liveScanned()
    // No address change is offered on an address with two answers (the Core refuses it: DR-6).
    expect(screen.queryByTestId('com-setip-pick-192.168.1.108')).not.toBeInTheDocument()
    expect(screen.getByTestId('com-setip-pick-conflict-192.168.1.108')).toHaveTextContent(S.pickConflict)
    // Row V6 (R119-03): THE SCAN STATES WHAT IT KNOWS. The camera's row says in words that the number of devices is NOT
    // KNOWN - it is not drawn as "one device", as "no conflict" or as nothing - and an address change is still offered
    // there, because the job is bound to the hardware address of the row.
    const unknown = screen.getByTestId(`com-scan-count-unknown-${FROM}`)
    expect(unknown.textContent?.trim()).toBe('Number of devices at this address: not known - connect one factory-address camera at a time.')
    expect(screen.getByTestId(`com-scan-row-${FROM}`)).toHaveAttribute('data-device-count', 'NOT_KNOWN')
    expect(screen.getByTestId(`com-scan-row-${FROM}`)).toHaveAttribute('data-conflict', 'false')
    expect(screen.queryByTestId(`com-scan-conflict-${FROM}`)).not.toBeInTheDocument()
    expect(screen.getByTestId(`com-setip-pick-${FROM}`)).toBeInTheDocument()
    // Row V6 (R119-04): a row whose scan showed NO hardware address cannot be started - no button, and the screen says why.
    expect(screen.queryByTestId('com-setip-pick-192.168.0.90')).not.toBeInTheDocument()
    expect(screen.getByTestId('com-setip-pick-nomac-192.168.0.90')).toHaveTextContent(S.pickNoMac)
    await pick()
    // THE DEVICE THAT WILL BE RE-ADDRESSED, before anything is typed.
    expect(screen.getByTestId('com-setip-picked-address').textContent).toBe(FROM)
    expect(screen.getByTestId('com-setip-picked-mac').textContent).toBe(MAC)
    expect(screen.getByTestId('com-setip-picked')).toHaveTextContent('Acme · Dome 4 · Lobby')
    expect(screen.getByTestId('com-setip-registered-note')).toHaveTextContent('This camera is registered as CAM-04.')
    expect(screen.queryByTestId('com-setip-simulated')).not.toBeInTheDocument()

    let current = job()
    let atRequest = 'not asked'
    created.fake.answerOnce('setCameraNetwork', () => {
      // What the two fields hold at the instant the request is answered: emptied at the press.
      atRequest = `${usernameField().value}|${passwordField().value}`
      return { status: 202, body: current }
    })
    created.fake.answer('getCameraNetworkJob', () => ({ status: 200, body: current }))
    const fields = [usernameField(), passwordField()]
    fireEvent.change(screen.getByTestId('com-setip-toAddress'), { target: { value: TARGET_ADDRESS } })
    await fillAndStart()
    const view = await screen.findByTestId('com-setip-job')
    expect(atRequest).toBe('|')
    expect(created.fake.log.requestsOf('setCameraNetwork')).toHaveLength(1)
    expect(created.fake.log.requestsOf('setCameraNetwork')[0]).toMatchObject({ method: 'POST', path: SET_PATH, body: { fromAddress: FROM, scannedMac: MAC, toAddress: TARGET_ADDRESS, credential: { username: USER, secret: PASS } } })
    // The form is gone and its two elements are empty; the job view says so.
    expect(screen.queryByTestId('com-setip-form')).not.toBeInTheDocument()
    for (const element of fields) expect(element.value).toBe('')
    expect(screen.getByTestId('com-setip-account-gone')).toHaveTextContent(S.job.accountGone)
    expect(view).toHaveAttribute('data-state', 'RUNNING')
    expect(view).toHaveAttribute('data-step', 'REACHING')
    expect(screen.getByTestId('com-setip-job-status')).toHaveTextContent(`Job ${JOB_ID} · ${S.job.step.REACHING}`)
    expect(screen.getByTestId('com-setip-job-from').textContent).toBe(FROM)
    expect(screen.getByTestId('com-setip-job-target').textContent).toBe(S.job.targetUnknown)
    for (const id of ['neighbour', 'authenticated', 'confirmed']) expect(screen.getByTestId(`com-setip-mac-${id}`).textContent, id).toBe(S.job.macPending)
    expect(screen.getByTestId('com-setip-verdict')).toHaveAttribute('data-verdict', 'PENDING')
    // A job runs: no other camera is offered.
    expect(screen.getByTestId('com-setip-pick-10.0.0.7')).toBeDisabled()

    // The console asks for a running job BY ITSELF (one read some seconds after the last answer).
    await waitFor(() => expect(created.fake.log.requestsOf('getCameraNetworkJob').length).toBeGreaterThanOrEqual(1), { timeout: 7_000 })
    expect(created.fake.log.requestsOf('getCameraNetworkJob')[0]).toMatchObject({ method: 'GET', path: `${NETWORK}/jobs/${JOB_ID}` })

    // IDENTIFYING: the neighbour table's address is known, the camera's own is not: not compared yet.
    current = job({ step: 'IDENTIFYING', toAddress: TARGET_ADDRESS, neighbourMac: MAC })
    fireEvent.click(screen.getByTestId('com-setip-job-read'))
    await waitFor(() => expect(screen.getByTestId('com-setip-mac-neighbour').textContent).toBe(MAC))
    expect(screen.getByTestId('com-setip-job-target').textContent).toBe(TARGET_ADDRESS)
    expect(screen.getByTestId('com-setip-mac-authenticated').textContent).toBe(S.job.macPending)
    expect(screen.getByTestId('com-setip-verdict')).toHaveAttribute('data-verdict', 'PENDING')

    // WAITING: the camera stated the same address after sign-in.
    current = job({ step: 'WAITING', toAddress: TARGET_ADDRESS, neighbourMac: MAC, authenticatedMac: MAC })
    fireEvent.click(screen.getByTestId('com-setip-job-read'))
    await waitFor(() => expect(screen.getByTestId('com-setip-mac-authenticated').textContent).toBe(MAC))
    expect(screen.getByTestId('com-setip-verdict')).toHaveAttribute('data-verdict', 'SAME')
    expect(screen.getByTestId('com-setip-verdict')).toHaveTextContent(S.job.verdict.SAME)
    expect(screen.getByTestId('com-setip-job-status')).toHaveTextContent('at most 180 seconds')
    expect(screen.getByTestId('com-setip-job-running')).toHaveTextContent(S.job.running)

    // COMPLETED: the same address answered at the target.
    const aliasReads = created.fake.log.requestsOf('getHostAlias').length
    current = job({ state: 'COMPLETED', step: 'DONE', toAddress: TARGET_ADDRESS, neighbourMac: MAC, authenticatedMac: MAC, confirmedMac: MAC, endedAt: 1_760_000_090_000 })
    fireEvent.click(screen.getByTestId('com-setip-job-read'))
    const completed = await screen.findByTestId('com-setip-job-completed')
    expect(completed.textContent).toBe(S.job.completed.replace('{{address}}', TARGET_ADDRESS))
    expect(screen.getByTestId('com-setip-mac-confirmed').textContent).toBe(MAC)
    expect(screen.getByTestId('com-setip-job')).toHaveAttribute('data-state', 'COMPLETED')
    // A registered camera keeps its stored address until the operator confirms the new one (record 111: the job changes no registry row).
    expect(screen.getByTestId('com-setip-job-registered')).toHaveTextContent(S.job.completedRegistered.replace('{{device}}', 'CAM-04'))
    // The job ended: the temporary host address is read again, the other camera is offered again, and no further read of the job is made.
    await waitFor(() => expect(created.fake.log.requestsOf('getHostAlias').length).toBeGreaterThan(aliasReads))
    await waitFor(() => expect(screen.getByTestId('com-setip-pick-10.0.0.7')).toBeEnabled())
    expect(screen.queryByTestId('com-setip-job-read')).not.toBeInTheDocument()
    const reads = created.fake.log.requestsOf('getCameraNetworkJob').length
    await new Promise((resolve) => setTimeout(resolve, 2_600))
    expect(created.fake.log.requestsOf('getCameraNetworkJob')).toHaveLength(reads)

    fireEvent.click(screen.getByTestId('com-setip-job-close'))
    expect(await screen.findByTestId('com-setip-need-scan')).toHaveTextContent(S.needScan)
    expect(document.body.innerHTML).not.toContain('CANARY')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('a hardware address mismatch STOPS THE JOB ON THE SCREEN: both addresses are shown, "not the same device" and "nothing was set" are said; so is a neighbour table that holds none; a job the Core no longer holds is said as that', async () => {
    const created = await liveScanned()
    await pick()
    let current = job()
    created.fake.answer('setCameraNetwork', () => ({ status: 202, body: current }))
    created.fake.answer('getCameraNetworkJob', () => ({ status: 200, body: current }))
    await fillAndStart()
    await screen.findByTestId('com-setip-job')

    // The camera stated ANOTHER hardware address after sign-in: the Core set nothing (record 111, section 4).
    current = job({ state: 'FAILED', step: 'DONE', toAddress: TARGET_ADDRESS, neighbourMac: MAC, authenticatedMac: OTHER_MAC, failure: 'MAC_MISMATCH', endedAt: 1_760_000_010_000 })
    fireEvent.click(screen.getByTestId('com-setip-job-read'))
    const failure = await screen.findByTestId('com-setip-job-failure')
    expect(failure).toHaveAttribute('data-refusal', 'MAC_MISMATCH')
    expect(failure.textContent).toBe(S.job.failure.MAC_MISMATCH)
    expect(S.job.failure.MAC_MISMATCH).toContain('Nothing was set on the camera.')
    expect(screen.getByTestId('com-setip-job')).toHaveAttribute('data-state', 'FAILED')
    expect(screen.getByTestId('com-setip-mac-neighbour').textContent).toBe(MAC)
    expect(screen.getByTestId('com-setip-mac-authenticated').textContent).toBe(OTHER_MAC)
    expect(screen.getByTestId('com-setip-mac-confirmed').textContent).toBe(S.job.macNone)
    expect(screen.getByTestId('com-setip-verdict')).toHaveAttribute('data-verdict', 'DIFFERENT')
    expect(screen.getByTestId('com-setip-verdict')).toHaveTextContent(S.job.verdict.DIFFERENT)
    expect(screen.queryByTestId('com-setip-job-completed')).not.toBeInTheDocument()
    expect(screen.queryByTestId('com-setip-job-read')).not.toBeInTheDocument()

    // The neighbour table held NO address for the camera (record 111, D-5): the same stop.
    fireEvent.click(screen.getByTestId('com-setip-job-close'))
    await pick()
    current = job({ jobId: 'CNJ-000124' })
    await fillAndStart()
    await waitFor(() => expect(screen.getByTestId('com-setip-job')).toHaveAttribute('data-job', 'CNJ-000124'))
    current = job({ jobId: 'CNJ-000124', state: 'FAILED', step: 'DONE', failure: 'MAC_MISMATCH', endedAt: 1_760_000_020_000 })
    fireEvent.click(screen.getByTestId('com-setip-job-read'))
    expect((await screen.findByTestId('com-setip-job-failure')).textContent).toBe(S.job.failure.MAC_MISMATCH)
    expect(screen.getByTestId('com-setip-mac-neighbour').textContent).toBe(S.job.macNone)
    expect(screen.getByTestId('com-setip-verdict')).toHaveAttribute('data-verdict', 'DIFFERENT')

    // Every other failure code has a sentence of its own, and none is the answer's text.
    const failures = ['CAMERA_UNREACHABLE', 'ONVIF_NOT_ENABLED', 'AUTHENTICATION_FAILED', 'SET_REFUSED', 'NOT_FOUND_AT_NEW_ADDRESS', 'HOST_ALIAS_FAILED', 'CORE_RESTARTED'] as const
    expect(Object.keys(S.job.failure).sort()).toEqual([...failures, 'MAC_MISMATCH', 'UNKNOWN'].sort())
    let number = 125
    for (const code of failures) {
      const jobId = `CNJ-000${number++}`
      fireEvent.click(screen.getByTestId('com-setip-job-close'))
      await pick()
      current = job({ jobId })
      await fillAndStart()
      await waitFor(() => expect(screen.getByTestId('com-setip-job')).toHaveAttribute('data-job', jobId))
      current = job({ jobId, state: 'FAILED', step: 'DONE', failure: code, endedAt: 1_760_000_030_000 })
      fireEvent.click(screen.getByTestId('com-setip-job-read'))
      await waitFor(() => expect(screen.getByTestId('com-setip-job-failure').textContent, code).toBe(S.job.failure[code]))
    }

    // `404`: the Core restarted, or the job is another sign-in's. One answer, said as "nothing more is known".
    fireEvent.click(screen.getByTestId('com-setip-job-close'))
    await pick()
    current = job({ jobId: 'CNJ-000200' })
    await fillAndStart()
    await waitFor(() => expect(screen.getByTestId('com-setip-job')).toHaveAttribute('data-job', 'CNJ-000200'))
    created.fake.answer('getCameraNetworkJob', refusal(404, 'NOT_FOUND', 'Never drawn.'))
    fireEvent.click(screen.getByTestId('com-setip-job-read'))
    expect((await screen.findByTestId('com-setip-job-lost')).textContent).toBe(S.job.lost)
    expect(screen.getByTestId('com-setip-job')).toHaveAttribute('data-state', 'LOST')
    expect(document.body.textContent ?? '').not.toContain('Never drawn.')
    expect(document.body.innerHTML).not.toContain('CANARY')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('every refusal of a start with its sentence, each saying that nothing was sent to the camera; "not available" is said for a Core outside production capture operation AND for a production Core without its host inputs; the fields are empty after each', async () => {
    const created = await liveScanned()
    await pick()
    const refused = async (answer: ReturnType<typeof refusal> & { retryAfterSeconds?: number }, kind: string, sentence: string) => {
      created.fake.answerOnce('setCameraNetwork', answer)
      await fillAndStart()
      await waitFor(() => expect(screen.getByTestId('com-setip-refusal')).toHaveAttribute('data-refusal', kind))
      expect(screen.getByTestId('com-setip-refusal').textContent, kind).toBe(sentence)
      expect(usernameField().value).toBe('')
      expect(passwordField().value).toBe('')
      expect(screen.queryByTestId('com-setip-job')).not.toBeInTheDocument()
    }
    const state = (reason: string) => refusal(409, 'INVALID_STATE', 'Never drawn.', { reason })
    const contract = (reason: CaptureCommissioningReason) => `${CAPTURE_COMMISSIONING_REFUSAL_SENTENCES[reason]} ${S.refusal.nothingSent}`

    await refused(state('COMMISSIONING_NOT_AVAILABLE'), 'NOT_AVAILABLE', S.refusal.NOT_AVAILABLE)
    // The set-IP panel does not raise the page's notice "this Core is not in production capture operation": it may be one that lacks its host inputs.
    expect(screen.queryByTestId('com-not-production')).not.toBeInTheDocument()
    await refused(refusal(409, 'CAPTURE_CONFIG_LOCKED', 'Never drawn.'), 'LOCKED', `${W.refusal.LOCKED} ${S.refusal.nothingSent}`)
    for (const reason of ['COMMISSIONING_HELPER_NOT_CONFIGURED', 'COMMISSIONING_NOT_CONFIGURED', 'COMMISSIONING_JOB_IN_PROGRESS', 'CAMERA_ADDRESS_CONFLICT', 'CAMERA_NEW_ADDRESS_IN_USE', 'CAMERA_NO_FREE_ADDRESS'] as const) {
      await refused(state(reason), 'REASON', contract(reason))
      expect(screen.getByTestId('com-setip-refusal')).toHaveAttribute('data-reason', reason)
    }
    await refused(refusal(422, 'INVALID_INPUT', 'Never drawn.', { in: 'body', reason: 'COMMISSIONING_ADDRESS_NOT_ALLOWED' }), 'ADDRESS_NOT_ALLOWED', `${CAPTURE_COMMISSIONING_REFUSAL_SENTENCES.COMMISSIONING_ADDRESS_NOT_ALLOWED} ${S.refusal.ADDRESS_NOT_ALLOWED}`)
    expect(S.refusal.ADDRESS_NOT_ALLOWED).toContain('The present address must be one the last scan of this Core listed')
    await refused({ ...refusal(429, 'RATE_LIMITED', 'Never drawn.', { reason: 'CONNECTION_TEST_LOCKOUT_GUARD' }), retryAfterSeconds: 1_800 }, 'LOCKOUT_GUARD', S.refusal.LOCKOUT_GUARD)
    await refused({ ...refusal(429, 'RATE_LIMITED', 'Never drawn.', { reason: 'CONNECTION_TEST_RATE_LIMITED' }), retryAfterSeconds: 5 }, 'RATE_LIMITED', S.refusal.RATE_LIMITED)
    await refused(refusal(422, 'INVALID_INPUT', 'Never drawn.', { in: 'body' }), 'INVALID_INPUT', `${W.refusal.INVALID_INPUT} ${S.refusal.nothingSent}`)
    await refused(refusal(403, 'NOT_PERMITTED', 'Never drawn.', { reason: 'WEB_CONSOLE_ONLY' }), 'ROLE', `${W.refusal.ROLE} ${S.refusal.nothingSent}`)
    expect(created.fake.log.requestsOf('setCameraNetwork')).toHaveLength(13)
    expect(created.fake.log.requestsOf('getCameraNetworkJob')).toEqual([])
    expect(document.body.textContent ?? '').not.toContain('Never drawn.')
    expect(document.body.innerHTML).not.toContain('CANARY')
    expect(getMissingI18nKeys()).toEqual([])
  })
})

// ── The typed camera account ─────────────────────────────────────────────────────────────

/**
 * Every text a React component under `root` holds in its state or its props (the hook chains, a
 * class component's state, the props of every element), as one text. DOM nodes are not followed:
 * the value of an input element is the element's, not a component's.
 */
function heldByReact(root: Element): string {
  const key = Object.keys(root).find((name) => name.startsWith('__reactFiber$'))
  if (key === undefined) throw new Error('no React fiber on the root element')
  const out: string[] = []
  const seen = new WeakSet<object>()
  const SKIP = new Set(['_owner', '_store', 'stateNode', 'return', 'alternate', 'child', 'sibling', 'ref'])
  const collect = (value: unknown, depth: number): void => {
    if (typeof value === 'string') {
      out.push(value)
      return
    }
    if (typeof value !== 'object' || value === null || depth > 8 || value instanceof Node || value === window || seen.has(value)) return
    seen.add(value)
    for (const [name, member] of Object.entries(value)) {
      if (!SKIP.has(name)) collect(member, depth + 1)
    }
  }
  type Fiber = { memoizedProps: unknown; memoizedState: unknown; child: Fiber | null; sibling: Fiber | null }
  const walk = (fiber: Fiber | null): void => {
    for (let node = fiber; node !== null; node = node.sibling) {
      collect(node.memoizedProps, 0)
      // A function component's hooks are a linked list; a class component's state is a plain object.
      let hook = node.memoizedState as { memoizedState?: unknown; next?: unknown } | null
      let guard = 0
      while (typeof hook === 'object' && hook !== null && guard++ < 200) {
        collect('memoizedState' in hook ? hook.memoizedState : hook, 0)
        hook = 'next' in hook ? (hook.next as typeof hook) : null
      }
      walk(node.child)
    }
  }
  walk((root as unknown as Record<string, Fiber>)[key]!.child)
  return out.join('\n')
}

describe('row 113: the typed camera account (decisions C1, C7) - Live mode, fake transport', () => {
  let consoleCalls: unknown[][] = []
  beforeEach(() => {
    webErrorSink.clear()
    consoleCalls = []
    for (const level of ['error', 'warn', 'log', 'info', 'debug'] as const) vi.spyOn(console, level).mockImplementation((...parts: unknown[]) => void consoleCalls.push(parts))
  })
  const storageOf = (storage: Storage | null): Record<string, string | null> => (storage === null ? {} : Object.fromEntries(Array.from({ length: storage.length }, (_, index) => [storage.key(index) ?? '', storage.getItem(storage.key(index) ?? '')])))
  /** Everything a typed value could have been written to, as one text. The bodies the transport was handed are NOT in it: that is where the account belongs. */
  function reported(created: LiveTestBed): string {
    const cache = mounted!.queryClient.getQueryCache().getAll()
    const { location } = mounted!.router.state
    return JSON.stringify({
      sink: webErrorSink.records(),
      pageSink: livePage!.sink.records(),
      console: consoleCalls.map((call) => call.map((part) => (part instanceof Error ? `${part.message} ${part.stack}` : String(part)))),
      toasts: Array.from(document.querySelectorAll('[data-slot="toast"]')).map((element) => element.textContent ?? ''),
      html: document.body.innerHTML,
      react: heldByReact(screen.getByTestId('page-commissioning')),
      queryKeys: cache.map((query) => query.queryKey),
      queryData: cache.map((query) => ({ data: query.state.data, error: String(query.state.error) })),
      mutations: mounted!.queryClient.getMutationCache().getAll().map((mutation) => ({ variables: mutation.state.variables, data: mutation.state.data })),
      urls: created.fake.log.urls(),
      router: { href: location.href, pathname: location.pathname, search: location.search, hash: location.hash, state: location.state },
      history: { state: window.history.state as unknown, href: window.location.href },
      bedLocation: String((created.location as { href?: unknown }).href),
      local: storageOf(window.localStorage),
      session: storageOf(window.sessionStorage),
      origin: storageOf(created.storage),
    })
  }
  const expectNoCanary = (text: string) => {
    expect(text).not.toContain('CANARY')
    expect(text).not.toContain('s3cr3t')
  }

  it('NEVER PRE-FILLED, and never in component state: the two fields are empty and carry no value attribute; while the account is typed it is in no component\'s state or props, in no markup, URL, router state, storage or log - CONTROL: the typed new address IS found in component state', async () => {
    const created = await liveScanned()
    await pick()
    for (const element of [usernameField(), passwordField()]) {
      expect(element.value).toBe('')
      expect(element.hasAttribute('value')).toBe(false)
      expect(element.getAttribute('autocomplete')).not.toBe('on')
    }
    expect(passwordField().type).toBe('password')
    expect(passwordField().name).toBe(SET_IP_FIELD.password.name)
    expect(screen.getByTestId('com-setip-form').closest('form')).toBeNull()

    typeAccount()
    tick('com-setip-confirm')
    fireEvent.change(screen.getByTestId('com-setip-toAddress'), { target: { value: TARGET_ADDRESS } })
    await waitFor(() => expect(startButton()).toBeEnabled())
    expect(passwordField().value).toBe(PASS)
    for (const element of [usernameField(), passwordField()]) expect(element.hasAttribute('value')).toBe(false)
    const held = heldByReact(screen.getByTestId('page-commissioning'))
    // CONTROL: the search does see what a component holds.
    expect(held).toContain(TARGET_ADDRESS)
    expectNoCanary(held)
    expectNoCanary(reported(created))
    expect(created.fake.log.requestsOf('setCameraNetwork')).toEqual([])
  })

  it('CLEARED ON SUBMIT, and reported nowhere after a refusal, an outage and a stored-nowhere start: the request carries the account ONCE exactly as typed (negative control), and neither value is in a log, a toast, the markup, a component, a cache, a URL, the router state or browser storage', async () => {
    const created = await liveScanned()
    await pick()
    let atRequest = 'not asked'
    created.fake.answerOnce('setCameraNetwork', () => {
      atRequest = `${usernameField().value}|${passwordField().value}`
      return refusal(409, 'INVALID_STATE', 'Never drawn.', { reason: 'COMMISSIONING_NOT_AVAILABLE' })
    })
    await fillAndStart()
    await screen.findByTestId('com-setip-refusal')
    // Empty BEFORE the Core answered: cleared at the press, not by the answer.
    expect(atRequest).toBe('|')
    expect(usernameField().value).toBe('')
    expect(passwordField().value).toBe('')
    expect(startButton()).toBeDisabled()
    expectNoCanary(reported(created))

    // A refusal whose body names the member (`422`), a guard answer, an outage: the same.
    created.fake.answerOnce('setCameraNetwork', refusal(422, 'INVALID_INPUT', 'Never drawn.', { in: 'body', field: 'credential.secret' }))
    await fillAndStart()
    await waitFor(() => expect(screen.getByTestId('com-setip-refusal')).toHaveAttribute('data-refusal', 'INVALID_INPUT'))
    expectNoCanary(reported(created))
    created.fake.failOnce('setCameraNetwork')
    await fillAndStart()
    await waitFor(() => expect(screen.getByTestId('com-setip-refusal')).toHaveAttribute('data-refusal', 'OTHER'))
    expect(screen.getByTestId('com-setip-refusal').textContent).toBe(S.refusal.OTHER)
    expect(passwordField().value).toBe('')
    expectNoCanary(reported(created))

    // A start that is accepted: the job view, and still nowhere.
    created.fake.answerOnce('setCameraNetwork', { status: 202, body: job() })
    created.fake.answer('getCameraNetworkJob', { status: 200, body: job({ state: 'FAILED', step: 'DONE', failure: 'AUTHENTICATION_FAILED', endedAt: 1_760_000_010_000 }) })
    await fillAndStart()
    await screen.findByTestId('com-setip-job')
    fireEvent.click(screen.getByTestId('com-setip-job-read'))
    await screen.findByTestId('com-setip-job-failure')
    expectNoCanary(reported(created))

    // NEGATIVE CONTROL: the same search finds both values in the four bodies that were sent, exactly as typed.
    const sent = created.fake.log.requestsOf('setCameraNetwork')
    expect(sent).toHaveLength(4)
    for (const request of sent) expect((request as { body?: unknown }).body).toEqual({ fromAddress: FROM, scannedMac: MAC, credential: { username: USER, secret: PASS } })
    // (The transport's own log prints a credential-carrying body as its length and member names; the body itself is read here.)
    expect(JSON.stringify(sent.map((request) => (request as { body?: unknown }).body))).toContain('CANARYpass s3cr3t-8Wn')
    expectNoCanary(JSON.stringify(sent))
    // No URL of any request holds a member of the account, and operation 107 was asked by the job's id only.
    for (const url of created.fake.log.urls()) expect(url).not.toMatch(/CANARY|username|secret|credential/)
  })

  it('CLEARED ON CANCEL, ON UNMOUNT (another camera, a new scan) and ON NAVIGATION (one that keeps the page mounted, one that leaves it, and the document being hidden for good): the two elements are empty every time, and nothing was sent', async () => {
    const created = await liveScanned()

    // CANCEL.
    await pick()
    let fields = [usernameField(), passwordField()]
    typeAccount()
    expect(fields.map((element) => element.value)).toEqual([USER, PASS])
    fireEvent.click(screen.getByTestId('com-setip-cancel'))
    await screen.findByTestId('com-setip-need-scan')
    expect(fields.map((element) => element.value)).toEqual(['', ''])
    expect(screen.queryByTestId('com-setip-form')).not.toBeInTheDocument()

    // UNMOUNT: another camera is chosen - the first form's two elements are emptied as they go.
    await pick()
    fields = [usernameField(), passwordField()]
    typeAccount()
    await pick('10.0.0.7')
    expect(fields.map((element) => element.value)).toEqual(['', ''])
    expect(fields[1]!.isConnected).toBe(false)
    expect(usernameField().value).toBe('')
    expect(passwordField().value).toBe('')

    // UNMOUNT: a new scan replaces the result the camera was chosen from.
    fields = [usernameField(), passwordField()]
    typeAccount()
    created.fake.answerOnce('scanFactoryCameras', { status: 200, body: { ...SCAN, scannedAt: SCAN.scannedAt + 60_000 } })
    fireEvent.click(screen.getByTestId('com-scan-button'))
    await screen.findByTestId('com-setip-need-scan')
    expect(fields.map((element) => element.value)).toEqual(['', ''])

    // NAVIGATION THAT KEEPS THE PAGE MOUNTED (the same address with a hash): the same two elements, emptied; Start is disabled again.
    await pick()
    fields = [usernameField(), passwordField()]
    typeAccount()
    tick('com-setip-confirm')
    await waitFor(() => expect(startButton()).toBeEnabled())
    await act(async () => {
      await mounted!.router.navigate({ to: '/admin/commissioning', hash: 'top' })
    })
    expect(mounted!.router.state.location.hash).toBe('top')
    expect(usernameField()).toBe(fields[0])
    expect(fields.map((element) => element.value)).toEqual(['', ''])
    await waitFor(() => expect(startButton()).toBeDisabled())
    expect(JSON.stringify([mounted!.router.state.location.href, mounted!.router.state.location.state, window.history.state])).not.toContain('CANARY')

    // THE DOCUMENT IS HIDDEN FOR GOOD (a reload, a closed tab, a navigation outside the router).
    typeAccount()
    expect(passwordField().value).toBe(PASS)
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(fields.map((element) => element.value)).toEqual(['', ''])

    // NAVIGATION THAT LEAVES THE PAGE.
    typeAccount()
    await act(async () => {
      await mounted!.router.navigate({ to: '/dashboard' })
    })
    await screen.findByTestId('page-dashboard')
    expect(screen.queryByTestId('page-commissioning')).not.toBeInTheDocument()
    expect(fields.map((element) => element.value)).toEqual(['', ''])
    expect(fields[0]!.isConnected).toBe(false)
    expect(JSON.stringify([mounted!.router.state.location.href, mounted!.router.state.location.state, window.history.state, window.location.href])).not.toContain('CANARY')

    expect(created.fake.log.requestsOf('setCameraNetwork')).toEqual([])
  })

  it('AN ERROR BOUNDARY\'S MESSAGE never quotes an error: a panel that fails to render with an error whose text holds the account draws two fixed sentences and records the panel\'s name and the error\'s class - CONTROL: the thrown text did hold both values', () => {
    const thrown = new Error(`the camera account ${USER} / ${PASS} was in this text`)
    function Failing(): never {
      throw thrown
    }
    render(
      <PanelErrorBoundary panel="setip">
        <Failing />
      </PanelErrorBoundary>,
    )
    const fallback = screen.getByTestId('com-panel-fallback')
    expect(fallback).toHaveTextContent(en.common.errors.panelTitle)
    expect(fallback).toHaveTextContent(en.common.errors.panelBody)
    expectNoCanary(document.body.innerHTML)
    const records = webErrorSink.records()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ source: 'features/commissioning.PanelErrorBoundary', message: COMMISSIONING_RECORD.panel, context: { panel: 'setip', errorName: 'Error' } })
    expectNoCanary(JSON.stringify(records))
    // CONTROL (React itself prints a render error to the browser console; that print is not this console's log and is not searched here).
    expect(thrown.message).toContain(USER)
    expect(thrown.message).toContain('s3cr3t')
  })
})

// ── Row 118: the installation acceptance and its revocation ──────────────────────────────

/** Three checks of the contract's list the cases below name: the first (a note), the last (not run) and the one before it (failed). */
const STEP_NOTED = ACCEPTANCE_STEP_IDS[0]
const STEP_FAILED = ACCEPTANCE_STEP_IDS[ACCEPTANCE_STEP_IDS.length - 2]!
const STEP_NOT_RUN = ACCEPTANCE_STEP_IDS[ACCEPTANCE_STEP_IDS.length - 1]!
/** A check that is ticked as passed in every case: its note field is where a too-long note is typed. */
const STEP_OTHER = ACCEPTANCE_STEP_IDS[1]
const ACCEPTED: InstallationAcceptance = {
  acceptanceId: '00000000-0000-4000-8000-0000000000c1',
  acceptedAt: 1_760_000_000_000,
  acceptedBy: OPERATOR_IDS.RINA,
  softwareVersion: '0.6.0',
  coreDeviceId: 'DEMS-IR-01',
  siteName: 'Interview room 1',
  room: 'IR-01',
  siteAddress: 'Example street 1\nExample city',
  // Row V6 (R119-07): THE CONTRACT'S CLOSED LIST - every check once. All passed (a note on the first), but the last,
  // which was not run and says why, and the one before it, which failed and says why.
  steps: ACCEPTANCE_STEP_IDS.map((id) =>
    id === STEP_NOT_RUN
      ? { id, result: 'NOT_RUN' as const, detail: 'Left for the next visit' }
      : id === STEP_FAILED
        ? { id, result: 'FAIL' as const, detail: 'The cable was not unplugged' }
        : { id, result: 'PASS' as const, detail: id === STEP_NOTED ? 'Both lenses checked' : null },
  ),
  diagnostics: { id: 'DIAG-000001', startedAt: 1_759_999_940_000, completedAt: 1_759_999_970_000, checks: [{ id: 'CPU', label: 'CPU and memory', status: 'PASS', detail: 'CPU 12%, 48.5 °C', params: { cpuPercent: 12, cpuTempC: 48.5 } }] },
  revokedAt: null,
  revokedBy: null,
  revokeReason: null,
}
const REASON_TEXT = 'The Core was moved to another room.'
/** What the form sends for: every check ticked as passed but two - one ticked "not run" and one left as failed, each with its note; a note on the first; a site address of two lines. */
const EXPECTED_BODY = { siteAddress: 'Example street 1\nExample city', steps: ACCEPTED.steps }
function fillAcceptance() {
  fireEvent.change(screen.getByTestId('com-acceptance-site-address'), { target: { value: ' Example street 1\nExample city ' } })
  for (const id of ACCEPTANCE_STEP_IDS) if (id !== STEP_FAILED && id !== STEP_NOT_RUN) tick(`com-acceptance-passed-${id}`)
  tick(`com-acceptance-notrun-${STEP_NOT_RUN}`)
  fireEvent.change(screen.getByTestId(`com-acceptance-detail-${STEP_NOT_RUN}`), { target: { value: ' Left for the next visit ' } })
  fireEvent.change(screen.getByTestId(`com-acceptance-detail-${STEP_FAILED}`), { target: { value: 'The cable was not unplugged' } })
  fireEvent.change(screen.getByTestId(`com-acceptance-detail-${STEP_NOTED}`), { target: { value: ' Both lenses checked ' } })
}
/** The body has members of the key list only: `siteAddress` and `steps`; a step is exactly `id`, `result`, `detail`. */
function expectKeyListOnly(body: unknown) {
  const record = body as { steps: Record<string, unknown>[] }
  for (const key of Object.keys(record)) expect(['siteAddress', 'steps']).toContain(key)
  expect(record.steps).toHaveLength(ACCEPTANCE_STEP_IDS.length)
  for (const step of record.steps) expect(Object.keys(step)).toEqual([...INSTALLATION_ACCEPTANCE_STEP_KEYS])
  expect(InstallationAcceptRequestSchema.safeParse(body).success).toBe(true)
}

describe('row 118: the model (contract `installation-acceptance.ts`)', () => {
  it('the body of an acceptance holds keys of the key list only - the site address when typed, every offered step as `id`, `passed`, `detail` - and nothing of the Core\'s own facts; a reason is trimmed; what is outside the contract builds nothing', () => {
    // Row V6 (R119-07): THE STEP LIST IS THE CONTRACT'S - the form reads it and has none of its own.
    expect(ACCEPTANCE_STEP_IDS).toBe(INSTALLATION_ACCEPTANCE_STEP_IDS)
    expect(ACCEPTANCE_STEP_IDS).toHaveLength(27)
    expect(ACCEPTANCE_STEP_IDS.map((id) => acceptanceStepTitle(id))).toEqual(ACCEPTANCE_STEP_IDS.map((id) => INSTALLATION_ACCEPTANCE_STEP_TITLES[id]))
    expect([acceptanceStepResult({ passed: true, notRun: false }), acceptanceStepResult({ passed: false, notRun: true }), acceptanceStepResult({ passed: false, notRun: false }), acceptanceStepResult({ passed: true, notRun: true })]).toEqual(['PASS', 'NOT_RUN', 'FAIL', 'PASS'])
    // AN UNTOUCHED FORM CANNOT BE SENT: every check would be "failed" without a note. Before this row it was sent as six `passed: false`.
    const untouched = emptyAcceptanceForm()
    expect(untouched.steps).toHaveLength(ACCEPTANCE_STEP_IDS.length)
    expect(acceptanceFormSchema.safeParse(untouched).success).toBe(false)
    expect(acceptBodyOf(untouched)).toBeNull()
    // Every check ticked as passed: the least body.
    const values = { siteAddress: '', steps: untouched.steps.map((step) => ({ ...step, passed: true })) }
    expect(acceptanceFormSchema.safeParse(values).success).toBe(true)
    const least = acceptBodyOf(values)!
    expect(Object.keys(least)).toEqual(['steps'])
    expectKeyListOnly(least)
    expect(least.steps.map((step) => step.id)).toEqual([...ACCEPTANCE_STEP_IDS])
    expect(least.steps.every((step) => step.result === 'PASS' && step.detail === null)).toBe(true)
    const last = ACCEPTANCE_STEP_IDS.length - 1
    const filled = values.steps.map((step, index) =>
      index === 0 ? { ...step, detail: ' Both lenses checked ' } : index === last ? { passed: false, notRun: true, detail: ' Left for the next visit ' } : index === last - 1 ? { passed: false, notRun: false, detail: 'The cable was not unplugged' } : step,
    )
    const full = acceptBodyOf({ siteAddress: ' Example street 1\nExample city ', steps: filled })!
    expect(full).toEqual(EXPECTED_BODY)
    // A check that failed or was not run needs its note: refused in the form (the issue is the note's), and no body is built.
    for (const notRun of [true, false]) {
      const silent = values.steps.map((step, index) => (index === 2 ? { passed: false, notRun, detail: '  ' } : step))
      const parsed = acceptanceFormSchema.safeParse({ siteAddress: '', steps: silent })
      expect(parsed.success ? [] : parsed.error.issues.map((issue) => [issue.message, issue.path.join('.')])).toEqual([['reason', 'steps.2.detail']])
      expect(acceptBodyOf({ siteAddress: '', steps: silent })).toBeNull()
    }
    // A stored record: the count of what passed, for the contract's steps and for a record stored before the list.
    expect(acceptancePassedCount(ACCEPTED.steps)).toBe(25)
    expect(acceptancePassedCount([{ id: 'CAMERAS_ASSIGNED', passed: true, detail: null }, { id: 'MICROPHONES_ASSIGNED', passed: false, detail: null }])).toBe(1)
    expectKeyListOnly(full)
    // The Core's own facts have no member: the body cannot name who, when, a version, a name, a room or the diagnostics.
    for (const key of ['acceptedBy', 'acceptedAt', 'softwareVersion', 'coreDeviceId', 'siteName', 'room', 'diagnostics', 'code']) expect(JSON.stringify(full)).not.toContain(`"${key}"`)

    const issues = (over: Partial<typeof values>) => {
      const parsed = acceptanceFormSchema.safeParse({ ...values, ...over })
      return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)
    }
    expect(issues({ siteAddress: 'x'.repeat(500) })).toEqual([])
    expect(issues({ siteAddress: 'x'.repeat(501) })).toEqual(['siteAddress'])
    expect(issues({ steps: values.steps.map((step, index) => (index === 0 ? { ...step, detail: 'x'.repeat(201) } : step)) })).toEqual(['detail'])
    expect(issues({ steps: values.steps.map((step, index) => (index === 0 ? { ...step, detail: 'two\nlines' } : step)) })).toEqual(['detail'])
    expect(acceptBodyOf({ siteAddress: '', steps: values.steps.map((step, index) => (index === 0 ? { ...step, detail: 'two\nlines' } : step)) })).toBeNull()
    expect(acceptBodyOf({ siteAddress: '', steps: values.steps.slice(1) })).toBeNull()

    expect(revokeBodyOf({ reason: `  ${REASON_TEXT}  ` })).toEqual({ reason: REASON_TEXT })
    expect(revokeBodyOf({ reason: '  no  ' })).toBeNull()
    expect(revokeFormSchema.safeParse({ reason: ' abcd ' }).success).toBe(false)
    expect(revokeFormSchema.safeParse({ reason: 'abcde' }).success).toBe(true)
    expect(revokeFormSchema.safeParse({ reason: 'x'.repeat(501) }).success).toBe(false)
  })

  it('a refusal is named by its status and reason: the six reasons of the contract, an open session, the role, a body not accepted, the rest', () => {
    const reasons = Object.values(InstallationAcceptanceReason)
    // Seven since row V6: `INSTALLATION_CLOCK_BEHIND_RECORD` (R119-08), a named 409 of the revocation.
    expect(reasons).toHaveLength(7)
    for (const reason of reasons) {
      expect(acceptanceRefusal({ status: 409, code: 'INVALID_STATE', reason }), reason).toEqual({ kind: 'REASON', reason })
      expect(INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES[reason].length).toBeGreaterThan(10)
    }
    expect(acceptanceRefusal({ status: 409, code: 'CAPTURE_CONFIG_LOCKED', reason: null })).toEqual({ kind: 'LOCKED' })
    expect(acceptanceRefusal({ status: 403, code: 'NOT_PERMITTED', reason: 'WEB_CONSOLE_ONLY' })).toEqual({ kind: 'ROLE' })
    expect(acceptanceRefusal({ status: 422, code: 'INVALID_INPUT', reason: null })).toEqual({ kind: 'INVALID_INPUT' })
    for (const status of [500, 503, 409, null]) expect(acceptanceRefusal({ status, code: 'X', reason: null })).toEqual({ kind: 'OTHER' })
  })
})

describe('row 118, Simulated mode: the form on the simulator\'s answers', () => {
  it('the form states that recording is NOT gated on an acceptance and that the console cannot read the state; an acceptance is ONE request of the key list only, and the SIMULATOR-ONLY answers are said as their sentences; a reason outside its bound is refused in the form and nothing is sent', async () => {
    const { requests } = await simulated(OPERATOR_IDS.RINA)
    await screen.findByTestId('com-settings-form')
    expect(screen.getByTestId('com-acceptance-not-gated').textContent).toBe(A.notGated)
    expect(A.notGated).toContain('Recording is not gated on an acceptance')
    expect(screen.getByTestId('com-acceptance-no-read')).toHaveTextContent(A.noRead)
    expect(screen.getByTestId('com-acceptance-simulated')).toHaveTextContent(A.simulated)
    expect(screen.getByTestId('com-acceptance-core-facts')).toHaveTextContent(A.accept.coreFacts)
    // The offered steps, and no field for anything the Core states itself.
    // Row V6: the id and the title of each check are the contract's (the hardware acceptance package's), with a "not run" tick beside it.
    for (const id of ACCEPTANCE_STEP_IDS) {
      expect(screen.getByTestId(`com-acceptance-step-${id}`)).toHaveTextContent(`${id} ${INSTALLATION_ACCEPTANCE_STEP_TITLES[id]}`)
      expect(screen.getByTestId(`com-acceptance-notrun-${id}`)).toHaveTextContent(A.accept.notRun)
    }
    expect(screen.getByTestId('com-acceptance-steps')).toHaveTextContent(A.accept.stepsLegend)
    expect(screen.getByTestId('com-acceptance-form').querySelectorAll('input:not([type="checkbox"]), textarea')).toHaveLength(ACCEPTANCE_STEP_IDS.length + 1)
    const sent = (path: string) => requests().filter((call) => call.path === path)

    // AN UNTOUCHED FORM: every check would be recorded as failed without a reason - refused beside each note, nothing leaves the page.
    fireEvent.click(screen.getByTestId('com-acceptance-submit'))
    expect(await screen.findByTestId(`com-acceptance-detail-error-${STEP_NOTED}`)).toHaveTextContent('A check that failed or was not run needs one.')
    expect(sent(ACCEPTANCE_PATH)).toHaveLength(0)

    // A note longer than its bound: refused beside its field, nothing leaves the page.
    fillAcceptance()
    fireEvent.change(screen.getByTestId(`com-acceptance-detail-${STEP_OTHER}`), { target: { value: 'x'.repeat(201) } })
    fireEvent.click(screen.getByTestId('com-acceptance-submit'))
    expect(await screen.findByTestId(`com-acceptance-detail-error-${STEP_OTHER}`)).toHaveTextContent('Type a note of at most 200 characters on one line.')
    expect(sent(ACCEPTANCE_PATH)).toHaveLength(0)

    fireEvent.change(screen.getByTestId(`com-acceptance-detail-${STEP_OTHER}`), { target: { value: '' } })
    fireEvent.click(screen.getByTestId('com-acceptance-submit'))
    const refused = await screen.findByTestId('com-acceptance-refusal')
    expect(sent(ACCEPTANCE_PATH)).toEqual([{ method: 'POST', path: ACCEPTANCE_PATH, body: EXPECTED_BODY }])
    expectKeyListOnly(sent(ACCEPTANCE_PATH)[0]!.body)
    // SIMULATOR-ONLY: the simulator keeps no installation record.
    expect(refused).toHaveAttribute('data-reason', 'INSTALLATION_ACCEPTANCE_NOT_AVAILABLE')
    expect(refused.textContent).toBe(INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES.INSTALLATION_ACCEPTANCE_NOT_AVAILABLE)
    expect(screen.queryByTestId('com-acceptance-record')).not.toBeInTheDocument()

    // The revocation: a reason of four characters is refused in the form.
    fireEvent.change(screen.getByTestId('com-revoke-reason'), { target: { value: ' abcd ' } })
    fireEvent.click(screen.getByTestId('com-revoke-submit'))
    expect(await screen.findByTestId('com-revoke-reason-error')).toHaveTextContent('Type a reason of 5 to 500 characters.')
    expect(sent(`${ACCEPTANCE_PATH}/revoke`)).toHaveLength(0)
    fireEvent.change(screen.getByTestId('com-revoke-reason'), { target: { value: `  ${REASON_TEXT}  ` } })
    fireEvent.click(screen.getByTestId('com-revoke-submit'))
    const none = await screen.findByTestId('com-revoke-refusal')
    expect(sent(`${ACCEPTANCE_PATH}/revoke`)).toEqual([{ method: 'POST', path: `${ACCEPTANCE_PATH}/revoke`, body: { reason: REASON_TEXT } }])
    // SIMULATOR-ONLY: the simulator never holds an acceptance.
    expect(none).toHaveAttribute('data-reason', 'INSTALLATION_ACCEPTANCE_NOT_IN_FORCE')
    expect(none.textContent).toBe(INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES.INSTALLATION_ACCEPTANCE_NOT_IN_FORCE)
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('row 118, Live mode: a stored acceptance, its revocation and every refusal (contract-shaped answers, handed in)', () => {
  it('a recorded acceptance is shown as the Core answered it (in force, who, the Core\'s own facts, the steps met, the address as text); a revocation shows it revoked with the typed reason as text; the body of each request is of the key list only', async () => {
    const created = await live(OPERATOR_IDS.RINA)
    await screen.findByTestId('com-settings-form')
    expect(screen.getByTestId('com-acceptance-not-gated').textContent).toBe(A.notGated)
    expect(screen.queryByTestId('com-acceptance-simulated')).not.toBeInTheDocument()
    expect(screen.queryByTestId('com-acceptance-record')).not.toBeInTheDocument()

    created.fake.answerOnce('acceptInstallation', { status: 200, body: ACCEPTED })
    fillAcceptance()
    fireEvent.click(screen.getByTestId('com-acceptance-submit'))
    const record = await screen.findByTestId('com-acceptance-record')
    const sent = created.fake.log.requestsOf('acceptInstallation')
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ method: 'POST', path: ACCEPTANCE_PATH })
    expect((sent[0] as { body?: unknown }).body).toEqual(EXPECTED_BODY)
    expectKeyListOnly((sent[0] as { body?: unknown }).body)
    expect(record).toHaveAttribute('data-in-force', 'true')
    expect(screen.getByTestId('com-acceptance-record-state')).toHaveTextContent(A.record.inForce)
    expect(record).toHaveTextContent(OPERATOR_IDS.RINA)
    expect(record).toHaveTextContent('0.6.0')
    expect(record).toHaveTextContent('DEMS-IR-01 · Interview room 1 · IR-01')
    expect(record).toHaveTextContent('DIAG-000001')
    expect(screen.getByTestId('com-acceptance-record-steps').textContent).toBe('25 of 27 met')
    expect(screen.getByTestId('com-acceptance-record-address').textContent).toBe('Example street 1\nExample city')
    expect(record.querySelectorAll('a')).toHaveLength(0)
    // The form is empty again after a stored acceptance.
    await waitFor(() => expect((screen.getByTestId('com-acceptance-site-address') as HTMLTextAreaElement).value).toBe(''))

    const hostile = '<img src=x onerror=alert(1)> moved'
    created.fake.answerOnce('revokeInstallationAcceptance', { status: 200, body: { ...ACCEPTED, revokedAt: 1_760_000_005_000, revokedBy: OPERATOR_IDS.RINA, revokeReason: hostile } })
    fireEvent.change(screen.getByTestId('com-revoke-reason'), { target: { value: ` ${hostile} ` } })
    fireEvent.click(screen.getByTestId('com-revoke-submit'))
    await waitFor(() => expect(screen.getByTestId('com-acceptance-record')).toHaveAttribute('data-in-force', 'false'))
    expect((created.fake.log.requestsOf('revokeInstallationAcceptance')[0] as { body?: unknown }).body).toEqual({ reason: hostile })
    expect(screen.getByTestId('com-acceptance-record-state')).toHaveTextContent(A.record.revoked)
    // A text an operator typed is drawn as text only.
    expect(screen.getByTestId('com-acceptance-record-reason').textContent).toBe(hostile)
    expect(screen.getByTestId('com-acceptance-record').querySelectorAll('img')).toHaveLength(0)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('every refusal with its sentence: the named refusals of both operations, an open session, the role, a body not accepted, an unanswered request - never the answer\'s text, and no record is shown', async () => {
    const created = await live(OPERATOR_IDS.RINA)
    await screen.findByTestId('com-settings-form')
    const state = (reason: string) => refusal(409, 'INVALID_STATE', 'Never drawn.', { reason })
    // Row V6: a form whose checks are all ticked as passed (an untouched form is not sent at all).
    for (const id of ACCEPTANCE_STEP_IDS) tick(`com-acceptance-passed-${id}`)
    const accept = async (answer: ReturnType<typeof refusal> | null, kind: string, sentence: string) => {
      if (answer === null) created.fake.failOnce('acceptInstallation')
      else created.fake.answerOnce('acceptInstallation', answer)
      await waitFor(() => expect(screen.getByTestId('com-acceptance-submit')).not.toHaveAttribute('aria-busy'))
      fireEvent.click(screen.getByTestId('com-acceptance-submit'))
      await waitFor(() => expect(screen.getByTestId('com-acceptance-refusal')).toHaveAttribute('data-refusal', kind))
      await waitFor(() => expect(screen.getByTestId('com-acceptance-refusal').textContent, sentence).toBe(sentence))
    }
    for (const reason of ['INSTALLATION_ACCEPTANCE_IN_FORCE', 'INSTALLATION_DIAGNOSTICS_NOT_COMPLETE', 'INSTALLATION_DIAGNOSTICS_NOT_STORABLE', 'INSTALLATION_SITE_NOT_STORABLE', 'INSTALLATION_ACCEPTANCE_NOT_AVAILABLE'] as const) {
      await accept(state(reason), 'REASON', INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES[reason])
      expect(screen.getByTestId('com-acceptance-refusal')).toHaveAttribute('data-reason', reason)
    }
    await accept(refusal(409, 'CAPTURE_CONFIG_LOCKED', 'Never drawn.'), 'LOCKED', A.refusal.LOCKED)
    await accept(refusal(403, 'NOT_PERMITTED', 'Never drawn.', { reason: 'WEB_CONSOLE_ONLY' }), 'ROLE', A.refusal.ROLE)
    await accept(refusal(422, 'INVALID_INPUT', 'Never drawn.', { in: 'body' }), 'INVALID_INPUT', A.refusal.INVALID_INPUT)
    await accept(null, 'OTHER', A.refusal.OTHER)
    expect(created.fake.log.requestsOf('acceptInstallation')).toHaveLength(9)

    const revoke = async (answer: ReturnType<typeof refusal>, kind: string, sentence: string) => {
      created.fake.answerOnce('revokeInstallationAcceptance', answer)
      await waitFor(() => expect(screen.getByTestId('com-revoke-submit')).not.toHaveAttribute('aria-busy'))
      fireEvent.change(screen.getByTestId('com-revoke-reason'), { target: { value: REASON_TEXT } })
      fireEvent.click(screen.getByTestId('com-revoke-submit'))
      await waitFor(() => expect(screen.getByTestId('com-revoke-refusal')).toHaveAttribute('data-refusal', kind))
      await waitFor(() => expect(screen.getByTestId('com-revoke-refusal').textContent, sentence).toBe(sentence))
    }
    await revoke(state('INSTALLATION_ACCEPTANCE_NOT_IN_FORCE'), 'REASON', INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES.INSTALLATION_ACCEPTANCE_NOT_IN_FORCE)
    // Row V6 (R119-08): a clock behind the acceptance is a NAMED refusal with the contract's sentence - not an unworded failure.
    await revoke(state('INSTALLATION_CLOCK_BEHIND_RECORD'), 'REASON', INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES.INSTALLATION_CLOCK_BEHIND_RECORD)
    await revoke(refusal(409, 'CAPTURE_CONFIG_LOCKED', 'Never drawn.'), 'LOCKED', A.refusal.LOCKED)
    await revoke(refusal(403, 'NOT_PERMITTED', 'Never drawn.'), 'ROLE', A.refusal.ROLE)
    expect(screen.queryByTestId('com-acceptance-record')).not.toBeInTheDocument()
    expect(document.body.textContent ?? '').not.toContain('Never drawn.')
    expect(getMissingI18nKeys()).toEqual([])
  })
})
