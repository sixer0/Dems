// Task 4, blueprint row 72 (WP-07d): the list of sound cards and the registration of one input as a
// microphone on Devices & Inputs (operations 98 `searchCaptureAudioCards` and 99
// `registerCaptureAudioInput`; contract `packages/shared/src/api/capture-audio-cards.ts`).
//
// | Check | Where |
// |-------|-------|
// | The gate, the refusal names, the inputs of a card and the merge of a registration are pure | "the model" |
// | Verification cell: the screen lists the fixture cards and registers one input | "Simulated mode", "answers of a Core" |
// | Nothing lists by itself; ONE input of ONE card is chosen; the body is three members and no device text | "Simulated mode" |
// | A product name that contains markup is drawn literally, as text | "answers of a Core" |
// | Each answer of 98 and 99 has its state: registered input, 201 / 200 by change code, every refusal with its sentence, empty, truncated | "answers of a Core" |
// | Role and idle gating: disabled with the reason, never hidden, nothing sent | "gates" |
// | R-FLEX row 111 TURNED BY D48 (one microphone per input): T-15 bound chip, EVERY input of a bound card offered, no move control; a second input is a second microphone; ALREADY_BOUND refusal with the holder; W-A8 ambiguous note (Q96-03 a) | "R-FLEX" |
//
// The double: the in-app simulator (two synthetic cards; it registers nothing). The answers only a
// Core gives (a registered input, 201, 200, 404, 429, 503, the two 409 of a listing) are put in at
// `sim.request`, in the shapes of the contract's examples.
//
// The page mounts are the TECHNICIAN (RINA): CAPTURE_CONFIG revoked from SUPERVISOR 2026-10-29
// (0034), so only a technician now reaches the control surface; the refusal test keeps a non-holder.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CAPTURE_AUDIO_CARD_SEARCH_PATH, CAPTURE_AUDIO_INPUT_REGISTER_PATH, type CaptureAudioCard, type CaptureAudioCardSearch } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { OPERATOR_IDS, type Sim } from '@dems/shared/sim'
import { getMissingI18nKeys } from '@/i18n'
import { audioCardsGate, inputOffered, inputsOf, isAmbiguous, listRefusal, registerRefusal, withRegistration } from '../audio-cards'
import { installDevicesBed, mountDevices, toastTexts } from './search-bed'

const A = en.common.captureAudioCards
// CAPTURE_CONFIG revoked from SUPERVISOR 2026-10-29 (migration 0034): TECHNICIAN holds it alone,
// so the refusal of a non-holder names TECHNICIAN only.
const ROLE_SENTENCE = en.common.rbac.requiresRole.replace('{{role}}', 'TECHNICIAN')

const card = (over: Partial<CaptureAudioCard> = {}): CaptureAudioCard => ({
  cardId: 'EXAMPLE_CARD',
  deviceIndex: 0,
  usbId: '0000:0000',
  product: 'Example USB audio interface',
  channelCount: 8,
  sampleBits: [16, 24],
  registered: [{ inputNumber: 1, deviceId: 'MIC-03' }],
  boundTo: 'MIC-03',
  ...over,
})
const listingOf = (cards: CaptureAudioCard[], truncated = false): CaptureAudioCardSearch => ({ searchedAt: 1_760_000_000_000, cards, truncated })

describe('the model', () => {
  it('the gate: Checking, then the role first, an open session, the spacing of the Core, else allowed', () => {
    const base = { resolved: true, can: true, locked: false, limitedSeconds: null }
    expect(audioCardsGate(base)).toBeNull()
    expect(audioCardsGate({ ...base, resolved: false })).toEqual({ kind: 'CHECKING' })
    // CAPTURE_CONFIG revoked from SUPERVISOR 2026-10-29 (0034): rolesHolding names TECHNICIAN only.
    expect(audioCardsGate({ ...base, can: false, locked: true })).toEqual({ kind: 'ROLE', roles: ['TECHNICIAN'] })
    expect(audioCardsGate({ ...base, locked: true, limitedSeconds: 5 })).toEqual({ kind: 'LOCKED' })
    expect(audioCardsGate({ ...base, limitedSeconds: 5 })).toEqual({ kind: 'LIMITED', seconds: 5 })
  })

  it('a refused listing and a refused registration are named by status, code and reason', () => {
    const of = (status: number | null, reason: string | null = null, code = 'INVALID_STATE') => ({ status, code, reason })
    expect(listRefusal(of(429, 'AUDIO_CARD_SEARCH_RATE_LIMITED', 'RATE_LIMITED'))).toBe('LIMITED')
    expect(listRefusal(of(503, 'DISCOVERY_NOT_READY', 'NOT_READY'))).toBe('NOT_READY')
    expect(listRefusal(of(409, null, 'CAPTURE_CONFIG_LOCKED'))).toBe('LOCKED')
    expect(listRefusal(of(409, 'AUDIO_CARD_SEARCH_IN_PROGRESS'))).toBe('BUSY')
    expect(listRefusal(of(403, 'WEB_CONSOLE_ONLY', 'NOT_PERMITTED'))).toBe('ROLE')
    expect(listRefusal(of(409))).toBe('OTHER')
    expect(listRefusal(of(null))).toBe('OTHER')
    expect(registerRefusal(of(404, null, 'NOT_FOUND'))).toBe('NOT_FOUND')
    expect(registerRefusal(of(409, 'AUDIO_INPUT_BEYOND_CARD'))).toBe('BEYOND_CARD')
    expect(registerRefusal(of(409, 'AUDIO_INPUT_NOT_REGISTRABLE'))).toBe('NOT_REGISTRABLE')
    expect(registerRefusal(of(409, 'AUDIO_CARD_ALREADY_BOUND'))).toBe('ALREADY_BOUND')
    expect(registerRefusal(of(409, 'AUDIO_CARD_SEARCH_IN_PROGRESS'))).toBe('BUSY')
    expect(registerRefusal(of(409, null, 'CAPTURE_CONFIG_LOCKED'))).toBe('LOCKED')
    expect(registerRefusal(of(503))).toBe('NOT_READY')
    expect(registerRefusal(of(422, null, 'INVALID_INPUT'))).toBe('OTHER')
  })

  it('the inputs of a card are 1 to its channel count, each with the microphone the listing names; a registration is merged into its card only', () => {
    expect(inputsOf(card({ channelCount: 3 }))).toEqual([
      { inputNumber: 1, deviceId: 'MIC-03' },
      { inputNumber: 2, deviceId: null },
      { inputNumber: 3, deviceId: null },
    ])
    const other = card({ cardId: 'OTHER', registered: [], boundTo: null })
    const merged = withRegistration(listingOf([card(), other]), { cardId: 'EXAMPLE_CARD', deviceIndex: 0, inputNumber: 2 }, { deviceId: 'MIC-04', inputNumber: 2 })
    expect(merged.cards[0]?.registered).toEqual([
      { inputNumber: 1, deviceId: 'MIC-03' },
      { inputNumber: 2, deviceId: 'MIC-04' },
    ])
    expect(merged.cards[1]).toBe(other)
    // The same input again (REENABLED): one entry, never two.
    expect(withRegistration(merged, { cardId: 'EXAMPLE_CARD', deviceIndex: 0, inputNumber: 1 }, { deviceId: 'MIC-03', inputNumber: 1 }).cards[0]?.registered).toHaveLength(2)
    // A move (bundle M): the holder leaves its old input and holds the card at the new one.
    const moved = withRegistration(listingOf([card()]), { cardId: 'EXAMPLE_CARD', deviceIndex: 0, inputNumber: 3 }, { deviceId: 'MIC-03', inputNumber: 3 })
    expect(moved.cards[0]?.registered).toEqual([{ inputNumber: 3, deviceId: 'MIC-03' }])
    expect(moved.cards[0]?.boundTo).toBe('MIC-03')
    // A new microphone on a free card holds it from then on.
    expect(withRegistration(listingOf([other]), { cardId: 'OTHER', deviceIndex: 0, inputNumber: 1 }, { deviceId: 'MIC-05', inputNumber: 1 }).cards[0]?.boundTo).toBe('MIC-05')
    // D48: a second microphone on a held card leaves its first holder in `boundTo`.
    expect(merged.cards[0]?.boundTo).toBe('MIC-03')
  })

  it('D48: a bound card offers every input (one microphone per input); two serial-less units of one model bound to one microphone are ambiguous and offer none', () => {
    const bound = card({ channelCount: 3 })
    const offered = (moving: boolean, ambiguous = false) => inputsOf(bound).map((input) => inputOffered(bound, input, { moving, ambiguous }))
    expect(offered(false)).toEqual([true, true, true])
    expect(offered(true)).toEqual([true, true, true])
    expect(offered(false, true)).toEqual([false, false, false])
    expect(offered(true, true)).toEqual([false, false, false])
    const free = card({ registered: [], boundTo: null, channelCount: 2 })
    expect(inputsOf(free).map((input) => inputOffered(free, input, { moving: false, ambiguous: false }))).toEqual([true, true])
    const twinA = card({ cardId: 'TWIN_A', usbSerial: null, registered: [] })
    const twinB = card({ cardId: 'TWIN_B', usbSerial: null })
    expect(isAmbiguous(twinA, [twinA, twinB])).toBe(true)
    expect(isAmbiguous(twinB, [twinA, twinB])).toBe(true)
    // A stated serial number, another model, another holder, or no holder: not ambiguous.
    expect(isAmbiguous(twinA, [twinA, { ...twinB, usbSerial: 'SN1' }])).toBe(false)
    expect(isAmbiguous(twinA, [twinA, { ...twinB, usbId: '1111:2222' }])).toBe(false)
    expect(isAmbiguous(twinA, [twinA, { ...twinB, boundTo: 'MIC-04' }])).toBe(false)
    expect(isAmbiguous({ ...twinA, boundTo: null }, [{ ...twinA, boundTo: null }, { ...twinB, boundTo: null }])).toBe(false)
    expect(isAmbiguous(twinA, [twinA])).toBe(false)
  })
})

installDevicesBed()

type Call = Parameters<Sim['request']>[0]
type Answer = ReturnType<Sim['request']>
const answer = (status: number, body: unknown): Answer => ({ status, headers: {}, body }) as Answer
const refusal = (status: number, code: string, reason?: string, extra: Record<string, unknown> = {}): Answer =>
  answer(status, { error: { code, message: 'A sentence of the Core that the page must not draw.', ...(reason === undefined ? {} : { details: { reason, ...extra } }) } })

/** Puts answers of a Core in at the two paths; every other call reaches the simulator. */
function core(sim: Sim, answers: { list?: () => Answer; register?: (body: unknown) => Answer }) {
  const real = sim.request.bind(sim)
  return vi.spyOn(sim, 'request').mockImplementation((call: Call) => {
    if (call.method === 'POST' && call.path === CAPTURE_AUDIO_CARD_SEARCH_PATH && answers.list !== undefined) return answers.list()
    if (call.method === 'POST' && call.path === CAPTURE_AUDIO_INPUT_REGISTER_PATH && answers.register !== undefined) return answers.register(call.body)
    return real(call)
  })
}
const callsTo = (spy: ReturnType<typeof vi.spyOn>, path: string) => (spy.mock.calls as [Call][]).filter(([call]) => call.method === 'POST' && call.path === path)
const radio = (cardKey: string, inputNumber: number) => within(screen.getByTestId(`audio-card-input-${cardKey}-${inputNumber}`)).getByRole('radio') as HTMLInputElement
const list = async () => {
  const button = await screen.findByTestId('audio-cards-list-button')
  await waitFor(() => expect(button).toBeEnabled())
  fireEvent.click(button)
}
const registerButton = () => screen.getByTestId('audio-cards-register-button')

describe('Simulated mode: the two synthetic cards (the fixture cards)', { timeout: 30_000 }, () => {
  it('nothing lists by itself; a press lists both cards with their inputs enabled; ONE input is chosen; the registration sends three members and is refused with its sentence', async () => {
    const { sim } = await mountDevices('idle', OPERATOR_IDS.RINA)
    const spy = vi.spyOn(sim, 'request')
    const block = await screen.findByTestId('audio-cards')
    expect(within(block).getByTestId('audio-cards-description')).toHaveTextContent(A.description)
    const button = screen.getByTestId('audio-cards-list-button')
    await waitFor(() => expect(button).toBeEnabled())
    expect(button).toHaveTextContent(A.action)
    // Opening the page listed nothing and shows no list.
    expect(callsTo(spy, CAPTURE_AUDIO_CARD_SEARCH_PATH)).toHaveLength(0)
    expect(screen.queryByTestId('audio-cards-result')).not.toBeInTheDocument()

    fireEvent.click(button)
    const result = await screen.findByTestId('audio-cards-result')
    expect(callsTo(spy, CAPTURE_AUDIO_CARD_SEARCH_PATH)).toHaveLength(1)
    expect(result).toHaveAttribute('data-count', '2')
    expect(button).toHaveTextContent(A.again)
    const first = screen.getByTestId('audio-card-DEMS_TEST_A-0')
    const second = screen.getByTestId('audio-card-DEMS_TEST_B-0')
    // The cards say what they are: clearly synthetic.
    expect(first).toHaveTextContent('DEMS test sound card A (simulated)')
    expect(second).toHaveTextContent('DEMS test sound card B (simulated)')
    expect(first).toHaveTextContent('4 inputs')
    expect(second).toHaveTextContent('2 inputs')
    expect(screen.getByTestId('audio-card-usb-DEMS_TEST_A-0')).toHaveTextContent(A.card.notUsb)
    expect(within(first).getAllByRole('radio')).toHaveLength(4)
    expect(within(second).getAllByRole('radio')).toHaveLength(2)
    for (const input of screen.getAllByRole('radio').filter((element) => block.contains(element))) {
      expect(input).toBeEnabled()
      expect(input).not.toBeChecked()
    }
    // The simulator names no registered input: nothing is drawn as registered.
    expect(block.querySelector('[data-registered]')).toBeNull()
    expect(screen.getByTestId('audio-cards-pick-hint')).toHaveTextContent(A.pickHint)
    expect(screen.getByTestId('audio-cards-trust')).toHaveTextContent(A.trustNote)
    expect(screen.getByTestId('audio-cards-listed-at')).toHaveTextContent(/Listed at \d\d:\d\d:\d\d/)

    // Nothing is chosen for the operator: no registration without a choice.
    expect(registerButton()).toBeDisabled()
    expect(screen.getByTestId('audio-cards-register-reason')).toHaveTextContent(A.pickFirst)
    fireEvent.click(registerButton())
    expect(callsTo(spy, CAPTURE_AUDIO_INPUT_REGISTER_PATH)).toHaveLength(0)

    // ONE input of ONE card: a choice on the second card takes the place of the choice on the first.
    fireEvent.click(radio('DEMS_TEST_A-0', 3))
    expect(radio('DEMS_TEST_A-0', 3)).toBeChecked()
    fireEvent.click(radio('DEMS_TEST_B-0', 2))
    expect(radio('DEMS_TEST_B-0', 2)).toBeChecked()
    expect(radio('DEMS_TEST_A-0', 3)).not.toBeChecked()
    expect(screen.getAllByRole('radio').filter((element) => block.contains(element) && (element as HTMLInputElement).checked)).toHaveLength(1)
    expect(screen.queryByTestId('audio-cards-register-reason')).not.toBeInTheDocument()

    fireEvent.click(registerButton())
    const refused = await screen.findByTestId('audio-cards-refused')
    expect(refused).toHaveAttribute('data-refusal', 'NOT_REGISTRABLE')
    expect(refused).toHaveTextContent(A.refusal.AUDIO_INPUT_NOT_REGISTRABLE)
    const sent = callsTo(spy, CAPTURE_AUDIO_INPUT_REGISTER_PATH)
    expect(sent).toHaveLength(1)
    // Three members, an id of the kernel's form and two integers: no text a card announced goes back.
    expect(sent[0]?.[0].body).toEqual({ cardId: 'DEMS_TEST_B', deviceIndex: 0, inputNumber: 2 })
    // The simulator registered nothing and the page says nothing else.
    expect(block.querySelector('[data-registered]')).toBeNull()
    expect(screen.queryByTestId('audio-cards-registered')).not.toBeInTheDocument()
    expect(sim.store.getState().captureDevices.devices.filter((device) => device.kind === 'MIC').map((device) => device.id)).toEqual(['MIC-01', 'MIC-02'])
    expect(toastTexts()).toEqual([])
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('answers of a Core (put in at the two paths)', { timeout: 30_000 }, () => {
  it('a registered input is shown as registered; 201 REGISTERED, 200 REENABLED and 200 CARD_CHANGED each say what the Core did', async () => {
    const { sim } = await mountDevices('idle', OPERATOR_IDS.RINA)
    const changes = [
      answer(201, { deviceId: 'MIC-04', change: 'REGISTERED', inputNumber: 2, channelCount: 8, releasedDeviceId: null }),
      answer(200, { deviceId: 'MIC-03', change: 'REENABLED', inputNumber: 1, channelCount: 8, releasedDeviceId: null }),
      answer(200, { deviceId: 'MIC-04', change: 'CARD_CHANGED', inputNumber: 2, channelCount: 8, releasedDeviceId: null }),
    ]
    const free = card({ cardId: 'FREE_CARD', usbId: '1111:2222', product: 'Free USB audio interface', registered: [], boundTo: null })
    const spy = core(sim, { list: () => answer(200, listingOf([card(), free])), register: () => changes.shift() ?? refusal(500, 'INTERNAL') })
    await list()
    const entry = await screen.findByTestId('audio-card-EXAMPLE_CARD-0')
    expect(entry).toHaveTextContent('Example USB audio interface')
    expect(entry).toHaveTextContent('8 inputs')
    expect(screen.getByTestId('audio-card-usb-EXAMPLE_CARD-0')).toHaveTextContent('USB ID 0000:0000')
    expect(entry).toHaveTextContent('Sample sizes: 16, 24 bit')
    expect(within(entry).getAllByRole('radio')).toHaveLength(8)
    const registered = screen.getByTestId('audio-card-input-EXAMPLE_CARD-0-1')
    expect(registered).toHaveAttribute('data-registered', 'MIC-03')
    expect(registered).toHaveTextContent('Registered as MIC 3 (MIC-03)')
    expect(screen.getByTestId('audio-card-input-EXAMPLE_CARD-0-2')).not.toHaveAttribute('data-registered')
    // T-15 TURNED BY D48 (one microphone per input): the card a microphone holds says so; EVERY input is offered, no move control.
    expect(entry).toHaveAttribute('data-bound-to', 'MIC-03')
    expect(screen.getByTestId('audio-card-bound-EXAMPLE_CARD-0')).toHaveTextContent('Bound to MIC 3 (MIC-03)')
    for (let number = 1; number <= 8; number += 1) expect(radio('EXAMPLE_CARD-0', number)).toBeEnabled()
    expect(screen.queryByTestId('audio-card-move-button-EXAMPLE_CARD-0')).not.toBeInTheDocument()
    // A free card: no chip, no move, every input offered.
    expect(screen.queryByTestId('audio-card-bound-FREE_CARD-0')).not.toBeInTheDocument()
    expect(screen.queryByTestId('audio-card-move-button-FREE_CARD-0')).not.toBeInTheDocument()
    for (let number = 1; number <= 8; number += 1) expect(radio('FREE_CARD-0', number)).toBeEnabled()

    // 201: a new microphone. The input the request named is now the microphone the answer names, and it holds the card.
    fireEvent.click(radio('FREE_CARD-0', 2))
    fireEvent.click(registerButton())
    const done = await screen.findByTestId('audio-cards-registered')
    expect(done).toHaveAttribute('data-change', 'REGISTERED')
    expect(done).toHaveTextContent('Input 2 is registered as MIC 4 (MIC-04). It is not used until it is assigned as a microphone.')
    expect(screen.queryByTestId('audio-cards-released')).not.toBeInTheDocument()
    expect(screen.getByTestId('audio-card-input-FREE_CARD-0-2')).toHaveAttribute('data-registered', 'MIC-04')
    expect(screen.getByTestId('audio-card-bound-FREE_CARD-0')).toHaveTextContent('Bound to MIC 4 (MIC-04)')
    expect(radio('FREE_CARD-0', 2)).not.toBeChecked()
    // D48: the other inputs of the now held card stay offered.
    expect(radio('FREE_CARD-0', 1)).toBeEnabled()
    expect(registerButton()).toBeDisabled()
    // The Core was not asked for a second listing: nothing lists by itself.
    expect(callsTo(spy, CAPTURE_AUDIO_CARD_SEARCH_PATH)).toHaveLength(1)

    // 200 REENABLED: the input already had a microphone; no second one.
    fireEvent.click(radio('EXAMPLE_CARD-0', 1))
    expect(screen.queryByTestId('audio-cards-registered')).not.toBeInTheDocument()
    fireEvent.click(registerButton())
    await waitFor(() => expect(screen.getByTestId('audio-cards-registered')).toHaveAttribute('data-change', 'REENABLED'))
    expect(screen.getByTestId('audio-cards-registered')).toHaveTextContent('Input 1 already has a microphone, MIC 3 (MIC-03). It is enabled again; no second microphone was made.')
    expect(document.querySelectorAll('[data-registered="MIC-03"]')).toHaveLength(1)

    // 200 CARD_CHANGED: said, never silent.
    fireEvent.click(radio('FREE_CARD-0', 2))
    fireEvent.click(registerButton())
    await waitFor(() => expect(screen.getByTestId('audio-cards-registered')).toHaveAttribute('data-change', 'CARD_CHANGED'))
    expect(screen.getByTestId('audio-cards-registered')).toHaveTextContent('Input 2 is MIC 4 (MIC-04), which was stored for another sound card. It now names this sound card.')
    // Without move mode the body is the three members: no `release`.
    expect(callsTo(spy, CAPTURE_AUDIO_INPUT_REGISTER_PATH).map(([call]) => call.body)).toEqual([
      { cardId: 'FREE_CARD', deviceIndex: 0, inputNumber: 2 },
      { cardId: 'EXAMPLE_CARD', deviceIndex: 0, inputNumber: 1 },
      { cardId: 'FREE_CARD', deviceIndex: 0, inputNumber: 2 },
    ])
    expect(toastTexts()).toEqual([])
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('each refusal of a registration has its sentence, and never the text of the answer', async () => {
    const { sim } = await mountDevices('idle', OPERATOR_IDS.RINA)
    const refusals = [
      refusal(404, 'NOT_FOUND'),
      refusal(409, 'INVALID_STATE', 'AUDIO_INPUT_BEYOND_CARD'),
      refusal(409, 'INVALID_STATE', 'AUDIO_INPUT_NOT_REGISTRABLE'),
      refusal(422, 'INVALID_INPUT'),
      refusal(409, 'INVALID_STATE', 'AUDIO_CARD_SEARCH_IN_PROGRESS'),
      refusal(503, 'NOT_READY', 'DISCOVERY_NOT_READY'),
      refusal(409, 'CAPTURE_CONFIG_LOCKED'),
    ]
    core(sim, { list: () => answer(200, listingOf([card({ registered: [], boundTo: null })])), register: () => refusals.shift() ?? refusal(500, 'INTERNAL') })
    await list()
    await screen.findByTestId('audio-card-EXAMPLE_CARD-0')
    fireEvent.click(radio('EXAMPLE_CARD-0', 5))
    const press = () => fireEvent.click(registerButton())

    press()
    await waitFor(() => expect(screen.getByTestId('audio-cards-refused')).toHaveAttribute('data-refusal', 'NOT_FOUND'))
    expect(screen.getByTestId('audio-cards-refused')).toHaveTextContent(A.refusal.NOT_FOUND)
    press()
    await waitFor(() => expect(screen.getByTestId('audio-cards-refused')).toHaveAttribute('data-refusal', 'BEYOND_CARD'))
    expect(screen.getByTestId('audio-cards-refused')).toHaveTextContent(A.refusal.AUDIO_INPUT_BEYOND_CARD)
    press()
    await waitFor(() => expect(screen.getByTestId('audio-cards-refused')).toHaveAttribute('data-refusal', 'NOT_REGISTRABLE'))
    press()
    await waitFor(() => expect(screen.getByTestId('audio-cards-refused')).toHaveAttribute('data-refusal', 'FAILED'))
    expect(screen.getByTestId('audio-cards-refused')).toHaveTextContent(A.refusal.FAILED)
    press()
    expect(await screen.findByTestId('audio-cards-busy')).toHaveTextContent(A.busy)
    expect(screen.queryByTestId('audio-cards-refused')).not.toBeInTheDocument()
    press()
    expect(await screen.findByTestId('audio-cards-not-ready')).toHaveTextContent(A.notReady)
    press()
    expect(await screen.findByTestId('audio-cards-locked')).toHaveTextContent(A.locked)
    // The choice is kept through a refusal, nothing was drawn as registered, and no answer text reached the page.
    expect(radio('EXAMPLE_CARD-0', 5)).toBeChecked()
    expect(document.querySelector('[data-registered]')).toBeNull()
    expect(screen.getByTestId('audio-cards').textContent ?? '').not.toContain('A sentence of the Core')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('a refused listing is an explained state: not ready, another listing running, the spacing of the Core, and "could not be listed"', async () => {
    const { sim } = await mountDevices('idle', OPERATOR_IDS.RINA)
    const answers = [refusal(503, 'NOT_READY', 'DISCOVERY_NOT_READY'), refusal(409, 'INVALID_STATE', 'AUDIO_CARD_SEARCH_IN_PROGRESS'), refusal(500, 'INTERNAL'), refusal(429, 'RATE_LIMITED', 'AUDIO_CARD_SEARCH_RATE_LIMITED')]
    core(sim, { list: () => answers.shift() ?? refusal(500, 'INTERNAL') })
    await list()
    expect(await screen.findByTestId('audio-cards-not-ready')).toHaveTextContent(A.notReady)
    expect(screen.queryByTestId('audio-cards-result')).not.toBeInTheDocument()
    await list()
    expect(await screen.findByTestId('audio-cards-busy')).toHaveTextContent(A.busy)
    await list()
    expect(await screen.findByTestId('audio-cards-list-failed')).toHaveTextContent(A.listFailed)
    await list()
    // 429: disabled with the number of the Core, written once; it re-enables by itself.
    await waitFor(() => expect(screen.getByTestId('audio-cards-list')).toHaveAttribute('data-block', 'LIMITED'))
    expect(screen.getByTestId('audio-cards-list-button')).toBeDisabled()
    expect(screen.getByTestId('audio-cards-list-reason')).toHaveTextContent(en.common.coreErrors.limited.replace('{{seconds}}', '1'))
    expect(screen.queryByTestId('audio-cards-result')).not.toBeInTheDocument()
    expect(screen.getByTestId('audio-cards').textContent ?? '').not.toContain('A sentence of the Core')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('no card is its own state; more cards than the Core lists is a warning; a product name with markup is drawn as text', async () => {
    const hostile = '<img src=x onerror="window.__pwned=1"><b>Card</b>'
    const { sim } = await mountDevices('idle', OPERATOR_IDS.RINA)
    const answers = [answer(200, listingOf([])), answer(200, listingOf([card({ product: hostile, sampleBits: [], registered: [], boundTo: null })], true))]
    core(sim, { list: () => answers.shift() ?? refusal(500, 'INTERNAL') })
    await list()
    expect(await screen.findByTestId('audio-cards-empty')).toHaveTextContent(A.empty)
    expect(screen.queryByTestId('audio-cards-register-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('audio-cards-truncated')).not.toBeInTheDocument()
    await list()
    const entry = await screen.findByTestId('audio-card-EXAMPLE_CARD-0')
    expect(screen.getByTestId('audio-cards-truncated')).toHaveTextContent('The first 32 are listed.')
    expect(entry).toHaveTextContent(hostile)
    expect(entry.querySelector('img, b')).toBeNull()
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined()
    // A card that states no sample size has no such line.
    expect(entry).not.toHaveTextContent('Sample sizes')
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('D48: one microphone per input of a card (answers of a Core)', { timeout: 30_000 }, () => {
  it('a second input of a bound card registers a SECOND microphone: the body has no release, 201 REGISTERED, the first holder keeps its input and the chip', async () => {
    const { sim } = await mountDevices('idle', OPERATOR_IDS.RINA)
    const spy = core(sim, {
      list: () => answer(200, listingOf([card({ channelCount: 4 })])),
      register: () => answer(201, { deviceId: 'MIC-04', change: 'REGISTERED', inputNumber: 2, channelCount: 4, releasedDeviceId: null }),
    })
    await list()
    await screen.findByTestId('audio-card-EXAMPLE_CARD-0')
    expect(screen.queryByTestId('audio-card-move-button-EXAMPLE_CARD-0')).not.toBeInTheDocument()
    expect(radio('EXAMPLE_CARD-0', 2)).toBeEnabled()
    fireEvent.click(radio('EXAMPLE_CARD-0', 2))
    fireEvent.click(registerButton())
    const done = await screen.findByTestId('audio-cards-registered')
    expect(callsTo(spy, CAPTURE_AUDIO_INPUT_REGISTER_PATH).map(([call]) => call.body)).toEqual([{ cardId: 'EXAMPLE_CARD', deviceIndex: 0, inputNumber: 2 }])
    expect(done).toHaveAttribute('data-change', 'REGISTERED')
    expect(done).not.toHaveAttribute('data-released')
    expect(screen.queryByTestId('audio-cards-released')).not.toBeInTheDocument()
    // Both microphones on their own inputs; the card's chip still names its first holder.
    expect(screen.getByTestId('audio-card-input-EXAMPLE_CARD-0-1')).toHaveAttribute('data-registered', 'MIC-03')
    expect(screen.getByTestId('audio-card-input-EXAMPLE_CARD-0-2')).toHaveAttribute('data-registered', 'MIC-04')
    expect(screen.getByTestId('audio-card-bound-EXAMPLE_CARD-0')).toHaveTextContent('Bound to MIC 3 (MIC-03)')
    for (let number = 1; number <= 4; number += 1) expect(radio('EXAMPLE_CARD-0', number)).toBeEnabled()
    expect(callsTo(spy, CAPTURE_AUDIO_CARD_SEARCH_PATH)).toHaveLength(1)
    expect(toastTexts()).toEqual([])
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('409 AUDIO_CARD_ALREADY_BOUND says the holder it names, never the text of the answer; a bound card listed again offers no move control', async () => {
    const { sim } = await mountDevices('idle', OPERATOR_IDS.RINA)
    const listings = [listingOf([card({ registered: [], boundTo: null })]), listingOf([card()])]
    core(sim, {
      list: () => answer(200, listings.shift() ?? listingOf([card()])),
      register: () => refusal(409, 'INVALID_STATE', 'AUDIO_CARD_ALREADY_BOUND', { deviceId: 'MIC-07' }),
    })
    await list()
    await screen.findByTestId('audio-card-EXAMPLE_CARD-0')
    fireEvent.click(radio('EXAMPLE_CARD-0', 2))
    fireEvent.click(registerButton())
    const refused = await screen.findByTestId('audio-cards-refused')
    expect(refused).toHaveAttribute('data-refusal', 'ALREADY_BOUND')
    expect(refused).toHaveAttribute('data-holder', 'MIC-07')
    expect(refused).toHaveTextContent(A.refusal.AUDIO_CARD_ALREADY_BOUND.replaceAll('{{device}}', 'MIC 7 (MIC-07)'))
    expect(refused).toHaveTextContent(/^This input of the sound card is already used by MIC 7 \(MIC-07\)\./)
    expect(screen.getByTestId('audio-cards').textContent ?? '').not.toContain('A sentence of the Core')
    expect(document.querySelector('[data-registered]')).toBeNull()

    // List again: the card is now bound (D48: every input still offered, no move control).
    await list()
    await waitFor(() => expect(screen.getByTestId('audio-card-EXAMPLE_CARD-0')).toHaveAttribute('data-bound-to', 'MIC-03'))
    expect(screen.queryByTestId('audio-cards-refused')).not.toBeInTheDocument()
    expect(screen.queryByTestId('audio-card-move-button-EXAMPLE_CARD-0')).not.toBeInTheDocument()
    expect(screen.getByTestId('audio-card-EXAMPLE_CARD-0')).not.toHaveAttribute('data-moving')
    expect(radio('EXAMPLE_CARD-0', 2)).toBeEnabled()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('W-A8: two serial-less units of one model bound to one microphone are both bound, both say why, and offer nothing', async () => {
    const { sim } = await mountDevices('idle', OPERATOR_IDS.RINA)
    const twinA = card({ cardId: 'TWIN_A', usbSerial: null, channelCount: 2 })
    const twinB = card({ cardId: 'TWIN_B', usbSerial: null, channelCount: 2, registered: [] })
    core(sim, { list: () => answer(200, listingOf([twinA, twinB])) })
    await list()
    await screen.findByTestId('audio-card-TWIN_A-0')
    const note = 'Two sound cards of this model state no serial number. The Core cannot tell which one MIC 3 (MIC-03) uses, so neither is offered.'
    for (const key of ['TWIN_A-0', 'TWIN_B-0']) {
      expect(screen.getByTestId(`audio-card-${key}`)).toHaveAttribute('data-ambiguous', 'true')
      expect(screen.getByTestId(`audio-card-bound-${key}`)).toHaveTextContent('Bound to MIC 3 (MIC-03)')
      expect(screen.getByTestId(`audio-card-not-tellable-${key}`)).toHaveTextContent(note)
      expect(screen.queryByTestId(`audio-card-move-button-${key}`)).not.toBeInTheDocument()
      expect(radio(key, 1)).toBeDisabled()
      expect(radio(key, 2)).toBeDisabled()
    }
    expect(registerButton()).toBeDisabled()
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('gates', { timeout: 30_000 }, () => {
  it('without CAPTURE_CONFIG the control is disabled with the role sentence, never hidden, and nothing is sent', async () => {
    const { sim } = await mountDevices('idle', OPERATOR_IDS.BUDI)
    const spy = vi.spyOn(sim, 'request')
    const button = await screen.findByTestId('audio-cards-list-button')
    await waitFor(() => expect(screen.getByTestId('audio-cards-list')).toHaveAttribute('data-block', 'ROLE'))
    expect(button).toBeDisabled()
    expect(screen.getByTestId('audio-cards-list-reason')).toHaveTextContent(ROLE_SENTENCE)
    fireEvent.click(button)
    expect(callsTo(spy, CAPTURE_AUDIO_CARD_SEARCH_PATH)).toHaveLength(0)
    expect(screen.queryByTestId('audio-cards-result')).not.toBeInTheDocument()
  })

  it('with a session open both operations are idle only: disabled with their sentence, no toast, nothing sent', async () => {
    // Mounted as the TECHNICIAN: the lock is said only by a holder of CAPTURE_CONFIG, revoked from SUPERVISOR 2026-10-29 (0034).
    const { sim } = await mountDevices('recording', OPERATOR_IDS.RINA)
    const spy = vi.spyOn(sim, 'request')
    const button = await screen.findByTestId('audio-cards-list-button')
    await waitFor(() => expect(screen.getByTestId('audio-cards-list')).toHaveAttribute('data-block', 'LOCKED'))
    expect(button).toBeDisabled()
    expect(screen.getByTestId('audio-cards-list-reason')).toHaveTextContent(A.locked)
    fireEvent.click(button)
    expect(callsTo(spy, CAPTURE_AUDIO_CARD_SEARCH_PATH)).toHaveLength(0)
    expect(toastTexts()).toEqual([])
  })
})
