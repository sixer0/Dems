/**
 * The installation acceptance and its revocation in the commissioning area: the requests, the
 * refusals and the form rules (task 4, blueprint row 118, derived; contract
 * `implementation/116_acceptance_contract.md`, operations 109 `acceptInstallation` and 110
 * `revokeInstallationAcceptance` as built by `implementation/117_acceptance_ops.md`; decisions U10,
 * U11, C2, C80; security finding S13-13).
 *
 * | Export | What it is |
 * |--------|------------|
 * | `acceptInstallation`, `revokeInstallationAcceptance` | Operations 109 and 110 in both data modes. One request per press |
 * | `acceptanceRefusal` | What a refusal is, by status and `details.reason`; pure |
 * | `ACCEPTANCE_STEP_IDS`, `acceptanceStepTitle` | The steps the form offers: THE CONTRACT'S closed list and its titles (row V6) |
 * | `acceptanceStepResult`, `acceptancePassedCount` | The result of a check for its two ticks; how many steps of a stored record passed |
 * | `acceptanceFormSchema`, `acceptBodyOf` | The form's rules, and the body through the contract's own schema: `siteAddress` (only when typed) and `steps`, each step exactly `id`, `result`, `detail` |
 * | `revokeFormSchema`, `revokeBodyOf` | The reason of a revocation: 5 to 500 characters after trimming |
 *
 * WHAT THE FORM SENDS, AND WHAT IT CANNOT. The body of an acceptance is `{ siteAddress?, steps }`
 * and nothing else: who accepts, when, the software version, the copy of the Core's id, name and
 * room, and the diagnostics run are the CORE'S OWN FACTS - the contract has no member for them and
 * the form has no field for them. `acceptBodyOf` builds the body from the closed key list and
 * passes it through `InstallationAcceptRequestSchema`, whose objects are strict.
 *
 * NO READ EXISTS (decision C80). The console cannot ask whether an acceptance is in force: it
 * learns the state from the answer of a request. The panel says so.
 *
 * THE STEP LIST IS THE CONTRACT'S (row V6; security review of row 119, caution R119-07; decision
 * C94 (h)). The form reads `INSTALLATION_ACCEPTANCE_STEP_IDS` - the 27 checks of the hardware
 * acceptance package, in the order of its run - and their titles from `@dems/shared/api`; it has
 * no list of its own (the six codes of row 118 are gone). Every check is sent, exactly once, with
 * one result of the contract's closed set:
 *
 *   "passed" ticked                      PASS
 *   "not run" ticked (and not passed)    NOT_RUN   - a note that says why is required
 *   neither                              FAIL      - a note that says why is required
 *
 * So an untouched form cannot be sent: each check must be ticked as passed, or state why not.
 */
import { z } from 'zod'
import {
  INSTALLATION_ACCEPTANCE_LIMITS,
  INSTALLATION_ACCEPTANCE_STEP_IDS,
  INSTALLATION_ACCEPTANCE_STEP_TITLES,
  InstallationAcceptRequestSchema,
  InstallationAcceptanceReason,
  InstallationAcceptanceRevokeRequestSchema,
  InstallationAcceptanceStepResult,
  isInstallationAcceptanceText,
  type InstallationAcceptRequest,
  type InstallationAcceptance,
  type InstallationAcceptanceRevokeRequest,
  type InstallationAcceptanceStepId,
} from '@dems/shared/api'
import { liveFailure, simAnswer, type CommissioningAnswer, type CommissioningFailure, type CommissioningTarget } from './model'

const ACCEPTANCE_PATH = '/api/v1/installation/acceptance'

// ── The requests ─────────────────────────────────────────────────────────────────────────

/** Operation 109: records the acceptance. The answer is the stored record. */
export async function acceptInstallation(target: CommissioningTarget, body: InstallationAcceptRequest): Promise<CommissioningAnswer<InstallationAcceptance>> {
  if (target.live !== null) {
    const answer = await target.live.client.call('acceptInstallation', { body })
    return answer.ok ? { ok: true, data: answer.data } : liveFailure('acceptInstallation', answer)
  }
  return simAnswer('acceptInstallation', target.sim.request({ method: 'POST', path: ACCEPTANCE_PATH, body }))
}

/** Operation 110: revokes the one acceptance in force. No id: the Core names it from its own state. */
export async function revokeInstallationAcceptance(target: CommissioningTarget, body: InstallationAcceptanceRevokeRequest): Promise<CommissioningAnswer<InstallationAcceptance>> {
  if (target.live !== null) {
    const answer = await target.live.client.call('revokeInstallationAcceptance', { body })
    return answer.ok ? { ok: true, data: answer.data } : liveFailure('revokeInstallationAcceptance', answer)
  }
  return simAnswer('revokeInstallationAcceptance', target.sim.request({ method: 'POST', path: `${ACCEPTANCE_PATH}/revoke`, body }))
}

// ── What a refusal is ────────────────────────────────────────────────────────────────────

const ACCEPTANCE_REASONS = Object.values(InstallationAcceptanceReason) as readonly string[]

export type AcceptanceRefusal =
  /** One of the six reasons of the contract on `409 INVALID_STATE`: its sentence is the contract's (`INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES`). */
  | { readonly kind: 'REASON'; readonly reason: InstallationAcceptanceReason }
  /** `409 CAPTURE_CONFIG_LOCKED`: a session is open (idle only). */
  | { readonly kind: 'LOCKED' }
  /** `403`: the role, or not a web console session. */
  | { readonly kind: 'ROLE' }
  /** `422`: the body was not accepted as written. */
  | { readonly kind: 'INVALID_INPUT' }
  /** Anything else (an outage, a time-out, a 5xx): whether the record changed is not known. */
  | { readonly kind: 'OTHER' }

/** What a refused acceptance or revocation is; pure. */
export function acceptanceRefusal(failure: Pick<CommissioningFailure, 'status' | 'code' | 'reason'>): AcceptanceRefusal {
  const { status, code, reason } = failure
  if (status === 409 && code === 'CAPTURE_CONFIG_LOCKED') return { kind: 'LOCKED' }
  if (status === 409 && reason !== null && ACCEPTANCE_REASONS.includes(reason)) return { kind: 'REASON', reason: reason as InstallationAcceptanceReason }
  if (status === 403) return { kind: 'ROLE' }
  if (status === 422) return { kind: 'INVALID_INPUT' }
  return { kind: 'OTHER' }
}

// ── The acceptance form ──────────────────────────────────────────────────────────────────

/** The steps the form offers, in their order: THE CONTRACT'S CLOSED LIST, read and never copied. */
export const ACCEPTANCE_STEP_IDS = INSTALLATION_ACCEPTANCE_STEP_IDS
export type AcceptanceStepId = InstallationAcceptanceStepId
/** What a check is, in the words of the hardware acceptance package's recording sheet (the contract's text). */
export const acceptanceStepTitle = (id: AcceptanceStepId): string => INSTALLATION_ACCEPTANCE_STEP_TITLES[id]

/** One check as the form holds it: two ticks and a note. */
export interface AcceptanceStepValues {
  passed: boolean
  notRun: boolean
  detail: string
}

/** The form's values: one entry per step of `ACCEPTANCE_STEP_IDS`, in its order. */
export interface AcceptanceFormValues {
  siteAddress: string
  steps: AcceptanceStepValues[]
}

export const emptyAcceptanceForm = (): AcceptanceFormValues => ({ siteAddress: '', steps: ACCEPTANCE_STEP_IDS.map(() => ({ passed: false, notRun: false, detail: '' })) })

/** The result of a check for its two ticks: one of the contract's closed set. "Passed" wins over "not run"; neither is FAIL. */
export function acceptanceStepResult(step: Pick<AcceptanceStepValues, 'passed' | 'notRun'>): InstallationAcceptanceStepResult {
  if (step.passed === true) return InstallationAcceptanceStepResult.PASS
  return step.notRun === true ? InstallationAcceptanceStepResult.NOT_RUN : InstallationAcceptanceStepResult.FAIL
}

/** How many steps of a stored record passed: `result: PASS`, or - for a record stored before the contract's list - `passed: true`. */
export function acceptancePassedCount(steps: InstallationAcceptance['steps']): number {
  return steps.filter((step) => ('result' in step ? step.result === InstallationAcceptanceStepResult.PASS : step.passed === true)).length
}

const L = INSTALLATION_ACCEPTANCE_LIMITS
const characters = (text: string): number => Array.from(text).length

/**
 * The rule of each field, no looser than the contract's: the site address at most 500 characters
 * (line breaks allowed), a note on one line of at most 200. The message of an issue is the field's
 * name, which the panel words; it never quotes what was typed.
 */
export const acceptanceFormSchema = z.object({
  siteAddress: z.string().refine((text) => characters(text.trim()) <= L.siteAddressMax, 'siteAddress'),
  steps: z
    .array(
      z
        .object({ passed: z.boolean(), notRun: z.boolean(), detail: z.string().refine((text) => isInstallationAcceptanceText(text.trim()), 'detail') })
        // The contract's rule: a check that failed or was not run states why. The issue is the note's, where the panel words it.
        .refine((step) => step.passed || step.detail.trim() !== '', { message: 'reason', path: ['detail'] }),
    )
    .length(ACCEPTANCE_STEP_IDS.length),
})

/**
 * The body of operation 109 for the form's values, through the contract's own schema: the site
 * address only when one was typed, and EVERY check of the contract's list once as exactly `id`,
 * `result`, `detail` (`null` for no note). `null`: outside the schema (a note of two lines, a
 * failed or not-run check without its note, the steps larger than their bound as the database
 * counts them) - nothing is sent then.
 */
export function acceptBodyOf(values: AcceptanceFormValues): InstallationAcceptRequest | null {
  if (values.steps.length !== ACCEPTANCE_STEP_IDS.length) return null
  const siteAddress = values.siteAddress.trim()
  const steps = ACCEPTANCE_STEP_IDS.map((id, index) => {
    const detail = values.steps[index]!.detail.trim()
    return { id, result: acceptanceStepResult(values.steps[index]!), detail: detail === '' ? null : detail }
  })
  const parsed = InstallationAcceptRequestSchema.safeParse({ ...(siteAddress === '' ? {} : { siteAddress }), steps })
  return parsed.success ? parsed.data : null
}

// ── The revocation form ──────────────────────────────────────────────────────────────────

export interface RevokeFormValues {
  reason: string
}

export const revokeFormSchema = z.object({
  reason: z.string().refine((text) => characters(text.trim()) >= L.revokeReasonMin && characters(text.trim()) <= L.revokeReasonMax, 'reason'),
})

/** The body of operation 110: the reason, trimmed, through the contract's schema; `null` when it is outside it. */
export function revokeBodyOf(values: RevokeFormValues): InstallationAcceptanceRevokeRequest | null {
  const parsed = InstallationAcceptanceRevokeRequestSchema.safeParse({ reason: values.reason })
  return parsed.success ? parsed.data : null
}
