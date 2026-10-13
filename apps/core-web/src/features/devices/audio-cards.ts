/**
 * The sound cards of the Core's host and the registration of one of their inputs as a microphone
 * (task 4, blueprint row 72, package WP-07d; contract `packages/shared/src/api/capture-audio-cards.ts`,
 * operations 98 `searchCaptureAudioCards` and 99 `registerCaptureAudioInput`; both web console only).
 * Kept in a `.ts` module so the component file exports only components.
 *
 * Operation 98 is ONE request and ONE answer: the Core lists its sound cards because an operator
 * asked. Nothing here lists by itself, polls, retries or re-lists after a registration. Operation 99
 * names a card, a device index and an input number and nothing else: no text a card announced is
 * ever sent back to the Core.
 *
 * The technician picks a card and ONE input of it per microphone (the tested idea of the input
 * application): `InputChoice` is one input of one card, never a set and never a mix.
 *
 * | Export | What it is |
 * |--------|------------|
 * | `audioCardsGate` | Checking, then allowed, or refused with its reason: the role, an open session, the Core's own spacing |
 * | `listRefusal`, `registerRefusal` | What a refused listing or registration is, by its status and reason |
 * | `inputsOf`, `withRegistration` | The inputs of a card as the Core stated them; the listing with what an answer of operation 99 stated |
 * | `useAudioCards` | The control in both data modes |
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CAPTURE_AUDIO_CARD_SEARCH_PATH,
  CAPTURE_AUDIO_INPUT_REGISTER_PATH,
  CaptureAudioCardReason,
  type CaptureAudioCard,
  type CaptureAudioCardSearch,
  type CaptureAudioInputRegisterRequest,
  type CaptureAudioInputRegistration,
} from '@dems/shared/api'
import type { CoreCallFailure } from '@dems/shared/client'
import { hasActiveSession, Permission, useSim, type OperatorRole } from '@dems/shared/sim'
import { useCaptureDiscoveryGate, type CaptureDiscoveryGate } from './camera-search'
import { rolesHolding } from './capture-selector'
import { reportDevicesError } from './report'

export type { CaptureAudioCard, CaptureAudioCardSearch, CaptureAudioInputRegistration }

// ── The gate ─────────────────────────────────────────────────────────────────────────────

export type AudioCardsBlock =
  | { readonly kind: 'CHECKING' }
  | { readonly kind: 'ROLE'; readonly roles: readonly OperatorRole[] }
  /** A session is open: both operations are idle only (`409 CAPTURE_CONFIG_LOCKED`). */
  | { readonly kind: 'LOCKED' }
  /** `429`: the Core's own number of seconds; the control re-enables by itself and nothing is sent then. */
  | { readonly kind: 'LIMITED'; readonly seconds: number }

/** Pure. The role is the lasting reason, so it is said first. */
export function audioCardsGate(input: { readonly resolved: boolean; readonly can: boolean; readonly locked: boolean; readonly limitedSeconds: number | null }): AudioCardsBlock | null {
  if (!input.resolved) return { kind: 'CHECKING' }
  if (!input.can) return { kind: 'ROLE', roles: rolesHolding(Permission.CAPTURE_CONFIG) }
  if (input.locked) return { kind: 'LOCKED' }
  if (input.limitedSeconds !== null) return { kind: 'LIMITED', seconds: input.limitedSeconds }
  return null
}

// ── The two commands (operations 98 and 99) ──────────────────────────────────────────────

/** A refused or unanswered call: the status and the codes, never the answer's text. */
export interface AudioCardsFailure {
  readonly ok: false
  readonly status: number | null
  readonly code: string
  readonly reason: string | null
  readonly retryAfterSeconds: number | null
  /** The failed Live call, for the refusal presenter; `null` in Simulated mode. */
  readonly failure: CoreCallFailure | null
}

export type ListAnswer = { readonly ok: true; readonly listing: CaptureAudioCardSearch } | AudioCardsFailure
export type RegisterAnswer = { readonly ok: true; readonly registration: CaptureAudioInputRegistration } | AudioCardsFailure

/** What a refused listing is (operation 98). */
export type ListRefusal = 'LIMITED' | 'NOT_READY' | 'LOCKED' | 'BUSY' | 'ROLE' | 'OTHER'

export function listRefusal(failure: Pick<AudioCardsFailure, 'status' | 'code' | 'reason'>): ListRefusal {
  if (failure.status === 429) return 'LIMITED'
  if (failure.status === 503) return 'NOT_READY'
  if (failure.status === 409 && failure.code === 'CAPTURE_CONFIG_LOCKED') return 'LOCKED'
  if (failure.status === 409 && failure.reason === CaptureAudioCardReason.AUDIO_CARD_SEARCH_IN_PROGRESS) return 'BUSY'
  if (failure.status === 403) return 'ROLE'
  return 'OTHER'
}

/** What a refused registration is (operation 99): the refusals of a listing, and the three of the card or its input. */
export type RegisterRefusal = ListRefusal | 'NOT_FOUND' | 'BEYOND_CARD' | 'NOT_REGISTRABLE'

export function registerRefusal(failure: Pick<AudioCardsFailure, 'status' | 'code' | 'reason'>): RegisterRefusal {
  if (failure.status === 404) return 'NOT_FOUND'
  if (failure.status === 409 && failure.reason === CaptureAudioCardReason.AUDIO_INPUT_BEYOND_CARD) return 'BEYOND_CARD'
  if (failure.status === 409 && failure.reason === CaptureAudioCardReason.AUDIO_INPUT_NOT_REGISTRABLE) return 'NOT_REGISTRABLE'
  return listRefusal(failure)
}

const reasonOf = (details: unknown): string | null => {
  const reason = (details as { reason?: unknown } | null | undefined)?.reason
  return typeof reason === 'string' ? reason : null
}

interface SimAnswer {
  readonly status: number
  readonly body: unknown
}

function simFailure(response: SimAnswer): AudioCardsFailure {
  const error = (response.body as { error?: { code?: unknown; details?: unknown } } | null)?.error
  return { ok: false, status: response.status, code: typeof error?.code === 'string' ? error.code : 'SIMULATOR_ERROR', reason: reasonOf(error?.details), retryAfterSeconds: null, failure: null }
}

const liveFailure = (answer: CoreCallFailure): AudioCardsFailure => ({
  ok: false,
  status: answer.status,
  code: answer.error.code,
  reason: reasonOf(answer.error.details),
  retryAfterSeconds: answer.retryAfterSeconds,
  failure: answer,
})

async function listAudioCards(gate: Pick<CaptureDiscoveryGate, 'live' | 'sim'>): Promise<ListAnswer> {
  if (gate.live !== null) {
    const answer = await gate.live.client.call('searchCaptureAudioCards')
    return answer.ok ? { ok: true, listing: answer.data } : liveFailure(answer)
  }
  // Simulated mode: the simulator's own answer to the same operation (a fixed list of two test cards).
  const response = gate.sim.request({ method: 'POST', path: CAPTURE_AUDIO_CARD_SEARCH_PATH })
  return response.status === 200 ? { ok: true, listing: response.body as CaptureAudioCardSearch } : simFailure(response)
}

async function registerAudioInput(gate: Pick<CaptureDiscoveryGate, 'live' | 'sim'>, body: CaptureAudioInputRegisterRequest): Promise<RegisterAnswer> {
  if (gate.live !== null) {
    const answer = await gate.live.client.call('registerCaptureAudioInput', { body })
    return answer.ok ? { ok: true, registration: answer.data } : liveFailure(answer)
  }
  const response = gate.sim.request({ method: 'POST', path: CAPTURE_AUDIO_INPUT_REGISTER_PATH, body })
  return response.status === 200 || response.status === 201 ? { ok: true, registration: response.body as CaptureAudioInputRegistration } : simFailure(response)
}

// ── The list ─────────────────────────────────────────────────────────────────────────────

/** ONE input of ONE card: exactly the three members of the body of operation 99. */
export type InputChoice = CaptureAudioInputRegisterRequest

/** The key of a card entry in a listing: the card id and the device index, both of the kernel's form (no device text). */
export const cardKeyOf = (card: Pick<CaptureAudioCard, 'cardId' | 'deviceIndex'>): string => `${card.cardId}-${card.deviceIndex}`

export const isChoiceOf = (choice: InputChoice | null, card: Pick<CaptureAudioCard, 'cardId' | 'deviceIndex'>): boolean =>
  choice !== null && choice.cardId === card.cardId && choice.deviceIndex === card.deviceIndex

export interface CardInput {
  readonly inputNumber: number
  /** The registered microphone behind the input (`MIC-03`); `null` for an input that is not registered. */
  readonly deviceId: string | null
}

/** The inputs of a card as the Core stated them: 1 to its channel count, each with the microphone the listing names for it. */
export function inputsOf(card: Pick<CaptureAudioCard, 'channelCount' | 'registered'>): CardInput[] {
  return Array.from({ length: card.channelCount }, (_unused, index) => {
    const inputNumber = index + 1
    return { inputNumber, deviceId: card.registered.find((entry) => entry.inputNumber === inputNumber)?.deviceId ?? null }
  })
}

/**
 * The listing with what an answer of operation 99 stated: the input the request named is the
 * microphone the answer names. Two statements of the Core put together; nothing else of the listing
 * changes, and the Core is not asked again (nothing lists by itself).
 */
export function withRegistration(listing: CaptureAudioCardSearch, choice: InputChoice, registration: Pick<CaptureAudioInputRegistration, 'deviceId' | 'inputNumber'>): CaptureAudioCardSearch {
  return {
    ...listing,
    cards: listing.cards.map((card) =>
      isChoiceOf(choice, card)
        ? { ...card, registered: [...card.registered.filter((entry) => entry.inputNumber !== registration.inputNumber), { inputNumber: registration.inputNumber, deviceId: registration.deviceId }] }
        : card,
    ),
  }
}

// ── The control ──────────────────────────────────────────────────────────────────────────

/** The inline notice a refused call leaves until the next call is accepted. */
export type AudioCardsNotice = 'NOT_READY' | 'BUSY' | 'LOCKED' | 'LIST_FAILED' | null

/** What the last registration did, or how it was refused. */
export type RegisterOutcome =
  | { readonly kind: 'DONE'; readonly registration: CaptureAudioInputRegistration }
  | { readonly kind: 'REFUSED'; readonly refusal: 'NOT_FOUND' | 'BEYOND_CARD' | 'NOT_REGISTRABLE' | 'FAILED' }

export interface AudioCardsController {
  readonly block: AudioCardsBlock | null
  /** The last listing of this page, with the registrations made since; `null` before the first. */
  readonly listing: CaptureAudioCardSearch | null
  /** Which request is out, from the press until the answer. No progress bar, no polling. */
  readonly busy: 'LIST' | 'REGISTER' | null
  readonly notice: AudioCardsNotice
  readonly choice: InputChoice | null
  readonly choose: (choice: InputChoice) => void
  readonly outcome: RegisterOutcome | null
  /** One operation 98. One call at a time; resolves with the answer; never rejects. */
  readonly list: () => Promise<ListAnswer | null>
  /** One operation 99 for the chosen input. Nothing is sent without a choice. */
  readonly register: () => Promise<RegisterAnswer | null>
}

const LIST_THREW_RECORD = 'A listing of the sound cards could not be sent.'
const LIST_FAILED_RECORD = 'A listing of the sound cards was not carried out.'
const REGISTER_THREW_RECORD = 'A registration of a sound-card input could not be sent.'
const REGISTER_FAILED_RECORD = 'A registration of a sound-card input was not carried out.'

export function useAudioCards(): AudioCardsController {
  const gate = useCaptureDiscoveryGate()
  const sessionOpen = useSim(hasActiveSession)
  const configLocked = useSim((state) => state.captureConfig.locked)
  const [busy, setBusy] = useState<'LIST' | 'REGISTER' | null>(null)
  const inFlight = useRef(false)
  const [listing, setListing] = useState<CaptureAudioCardSearch | null>(null)
  const [notice, setNotice] = useState<AudioCardsNotice>(null)
  const [choice, setChoice] = useState<InputChoice | null>(null)
  const [outcome, setOutcome] = useState<RegisterOutcome | null>(null)
  const [limitedSeconds, setLimitedSeconds] = useState<number | null>(null)

  // The control re-enables by itself at the instant the Core named. No label ticks and nothing is sent then.
  useEffect(() => {
    if (limitedSeconds === null) return undefined
    const timer = setTimeout(() => setLimitedSeconds(null), limitedSeconds * 1000)
    return () => clearTimeout(timer)
  }, [limitedSeconds])

  const block = audioCardsGate({ resolved: gate.resolved, can: gate.canConfigure, locked: sessionOpen || configLocked, limitedSeconds })

  /** The refusals both operations share. Returns whether the page words it itself. */
  const shared = useCallback((refusal: ListRefusal, answer: AudioCardsFailure): boolean => {
    switch (refusal) {
      case 'LIMITED':
        setLimitedSeconds(Math.max(1, answer.retryAfterSeconds ?? 1))
        return true
      case 'NOT_READY':
        setNotice('NOT_READY')
        return true
      case 'LOCKED':
        setNotice('LOCKED')
        return true
      case 'BUSY':
        setNotice('BUSY')
        return true
      case 'ROLE':
        return true
      case 'OTHER':
        return false
    }
  }, [])

  const list = useCallback(async (): Promise<ListAnswer | null> => {
    if (inFlight.current || !gate.enabled) return null
    inFlight.current = true
    setBusy('LIST')
    try {
      const answer = await listAudioCards(gate)
      if (answer.ok) {
        // A new listing replaces the old one whole: its choice and the last registration's sentence go with it.
        setNotice(null)
        setOutcome(null)
        setChoice(null)
        setListing(answer.listing)
        return answer
      }
      if (!shared(listRefusal(answer), answer)) {
        setNotice('LIST_FAILED')
        reportDevicesError('features/devices.audioCards', null, LIST_FAILED_RECORD, { operationId: 'searchCaptureAudioCards', status: answer.status, code: answer.code }, 'warn')
      }
      return answer
    } catch (error) {
      reportDevicesError('features/devices.audioCards', error, LIST_THREW_RECORD, { operationId: 'searchCaptureAudioCards' })
      setNotice('LIST_FAILED')
      return null
    } finally {
      inFlight.current = false
      setBusy(null)
    }
  }, [gate, shared])

  const register = useCallback(async (): Promise<RegisterAnswer | null> => {
    if (inFlight.current || !gate.enabled || choice === null) return null
    inFlight.current = true
    setBusy('REGISTER')
    const sent = choice
    try {
      const answer = await registerAudioInput(gate, sent)
      if (answer.ok) {
        setNotice(null)
        setOutcome({ kind: 'DONE', registration: answer.registration })
        setListing((held) => (held === null ? held : withRegistration(held, sent, answer.registration)))
        setChoice(null)
        return answer
      }
      const refusal = registerRefusal(answer)
      if (refusal === 'NOT_FOUND' || refusal === 'BEYOND_CARD' || refusal === 'NOT_REGISTRABLE') {
        setNotice(null)
        setOutcome({ kind: 'REFUSED', refusal })
      } else if (shared(refusal, answer)) {
        setOutcome(null)
      } else {
        setOutcome({ kind: 'REFUSED', refusal: 'FAILED' })
        // Ids of the kernel's form and integers only: no product name is in the record.
        reportDevicesError('features/devices.audioCards', null, REGISTER_FAILED_RECORD, { operationId: 'registerCaptureAudioInput', status: answer.status, code: answer.code }, 'warn')
      }
      return answer
    } catch (error) {
      reportDevicesError('features/devices.audioCards', error, REGISTER_THREW_RECORD, { operationId: 'registerCaptureAudioInput' })
      setOutcome({ kind: 'REFUSED', refusal: 'FAILED' })
      return null
    } finally {
      inFlight.current = false
      setBusy(null)
    }
  }, [gate, choice, shared])

  const choose = useCallback((next: InputChoice) => {
    setChoice(next)
    setOutcome(null)
  }, [])

  return { block, listing, busy, notice, choice, choose, outcome, list, register }
}
