/**
 * The pure rules of the Transcription (STT) configuration section (task 3 blueprint row 117; R-8;
 * `masterplan/08_client_ux_spec.md` §8a; `masterplan/03_api_contract.md` §2.5, operations 90-92).
 *
 * | Rule | Where | Authority |
 * |------|-------|-----------|
 * | The draft never holds a credential the Core returned: the Core returns none, and `draftOf` reads none | `draftOf` | E-31; C3 §2.5 "Credential never returned" |
 * | `model` is trimmed before it is checked and before it is sent; the check is the shared `isSttModelId` | `validateSttDraft`, `buildSttUpdate` | D70 (row 113 navigator R-3) |
 * | The endpoint is checked with the shared loopback rule; it is sent for the server backend only | same | OD-13; ux §8a |
 * | An update body carries `revision` and ONLY the members that differ from the stored configuration | `buildSttUpdate` | C3 §2.5 (one audit row names the changed fields) |
 * | A validation result names fields and message keys. It NEVER carries a typed value | `SttFieldErrors` | D70 R-3 |
 * | A refusal is classified from `status`, `code`, `details.reason` only; the answer's text is not read | `classifySttSaveFailure`, `classifySttTestFailure` | C3 §2.5; ux §8a "Errors" |
 */
import {
  ApiErrorCode,
  isSttLoopbackEndpoint,
  isSttModelId,
  STT_CREDENTIAL_REF_PATTERN,
  STT_CREDENTIAL_STORE_NOT_READY_REASON,
  STT_CREDENTIAL_VALUE_MAX_LENGTH,
  STT_REVISION_CONFLICT_REASON,
  STT_TRANSCRIBER_NOT_READY_REASON,
  SttBackend,
  SttConfigRefusalReason,
  SttCredentialWriteKind,
  type SttConfig,
  type SttConfigUpdateRequest,
} from '@dems/shared/api'
import { OperatorRole, ROLE_PERMISSIONS, type Permission } from '@dems/shared/sim'

/**
 * EVERY role the access rule of a permission admits, least privileged first (gate 81, finding
 * G81-03): the read-only hint of this section named "the Supervisor role" although the contract
 * gives `CAPTURE_CONFIG` to the Supervisor AND the Technician (C3 §2.5, operations 91 / 92; ux
 * §8a). A hint states the rule, not its first member. Read from the one role table.
 */
const ROLES_IN_ORDER = [OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR, OperatorRole.TECHNICIAN] as const
export function rolesHoldingPermission(permission: Permission): readonly OperatorRole[] {
  return ROLES_IN_ORDER.filter((role) => (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission))
}

/**
 * What this section reads of a failed call of the typed client (`SttCallFailure`, which fits this
 * shape): the status, the code and `details`. Never the answer's text. Declared here because the
 * files of this folder do not import the typed client's module (MD-6, TS-15).
 */
export interface SttCallFailure {
  readonly ok: false
  readonly status: number | null
  readonly error: { readonly code: string; readonly details?: unknown }
}

/**
 * Whether the section offers the SECRET form of the credential. Until blueprint row 84 mounts the
 * Core credential store a SECRET write answers `503 CREDENTIAL_STORE_NOT_READY` (decision D68(c)),
 * so the section offers the REFERENCE form only. The SECRET form, its body and the wording of that
 * 503 are built and tested; row 84 turns this on.
 */
export const STT_SECRET_FORM_OFFERED = false

/** What the operator does with the credential in this edit. `KEEP` sends no `credential` member. */
export const SttCredentialEdit = {
  KEEP: 'KEEP',
  REFERENCE: 'REFERENCE',
  SECRET: 'SECRET',
  CLEAR: 'CLEAR',
} as const
export type SttCredentialEdit = (typeof SttCredentialEdit)[keyof typeof SttCredentialEdit]

/** The stored, non-secret members the form edits. */
export interface SttDraft {
  readonly enabled: boolean
  readonly backend: SttBackend
  readonly endpoint: string
  readonly model: string
  readonly diarization: boolean
}

/**
 * The write-only part of the form. It starts empty every time (never pre-filled: no value exists
 * on the client and the Core returns none) and is emptied on a save, on a close and on unmount.
 */
export interface SttCredentialDraft {
  readonly edit: SttCredentialEdit
  /** The typed reference or secret. Never logged, never put in an error, never kept after a save. */
  readonly text: string
}

export const EMPTY_STT_CREDENTIAL: SttCredentialDraft = { edit: SttCredentialEdit.KEEP, text: '' }

export function draftOf(config: SttConfig): SttDraft {
  return {
    enabled: config.enabled,
    backend: config.backend,
    endpoint: config.endpoint ?? '',
    model: config.model,
    diarization: config.diarization,
  }
}

/** The fields a message can be shown under. */
export type SttField = 'endpoint' | 'model' | 'credential'

/** i18n keys under `system.stt`. A closed set: a message is never built from input. */
export type SttFieldMessage = 'endpointNotLoopback' | 'modelInvalid' | 'credentialRefInvalid' | 'credentialInvalid'

/** Field name → message key. Holds no typed value, so it is safe to render, to log and to throw. */
export type SttFieldErrors = Readonly<Partial<Record<SttField, SttFieldMessage>>>

const usesEndpoint = (backend: SttBackend): boolean => backend === SttBackend.OMLX_SERVER

export function validateSttDraft(draft: SttDraft, credential: SttCredentialDraft): SttFieldErrors {
  const errors: Partial<Record<SttField, SttFieldMessage>> = {}
  if (usesEndpoint(draft.backend) && !isSttLoopbackEndpoint(draft.endpoint.trim())) errors.endpoint = 'endpointNotLoopback'
  if (!isSttModelId(draft.model.trim())) errors.model = 'modelInvalid'
  if (credential.edit === SttCredentialEdit.REFERENCE && !STT_CREDENTIAL_REF_PATTERN.test(credential.text.trim())) {
    errors.credential = 'credentialRefInvalid'
  }
  if (credential.edit === SttCredentialEdit.SECRET && (credential.text.length === 0 || credential.text.length > STT_CREDENTIAL_VALUE_MAX_LENGTH)) {
    errors.credential = 'credentialInvalid'
  }
  return errors
}

export const hasSttErrors = (errors: SttFieldErrors): boolean => Object.keys(errors).length > 0

/**
 * The body of operation 91 for a VALID draft: `revision` and the members that differ from `stored`.
 * `null` when nothing differs (nothing is sent: the Core would write no audit row either).
 * A reference is trimmed; a secret is sent exactly as typed.
 */
export function buildSttUpdate(stored: SttConfig, draft: SttDraft, credential: SttCredentialDraft): SttConfigUpdateRequest | null {
  const body: { -readonly [K in keyof SttConfigUpdateRequest]: SttConfigUpdateRequest[K] } = { revision: stored.revision }
  const model = draft.model.trim()
  const endpoint = draft.endpoint.trim()
  if (draft.enabled !== stored.enabled) body.enabled = draft.enabled
  if (draft.backend !== stored.backend) body.backend = draft.backend
  if (usesEndpoint(draft.backend) && endpoint !== (stored.endpoint ?? '')) body.endpoint = endpoint
  if (model !== stored.model) body.model = model
  if (draft.diarization !== stored.diarization) body.diarization = draft.diarization
  if (credential.edit === SttCredentialEdit.REFERENCE) body.credential = { kind: SttCredentialWriteKind.REFERENCE, ref: credential.text.trim() }
  else if (credential.edit === SttCredentialEdit.SECRET) body.credential = { kind: SttCredentialWriteKind.SECRET, value: credential.text }
  else if (credential.edit === SttCredentialEdit.CLEAR) body.credential = { kind: SttCredentialWriteKind.CLEAR }
  return Object.keys(body).length === 1 ? null : body
}

/** Whether the non-secret draft differs from the stored configuration (the test runs on the stored one). */
export function sttDraftDiffers(stored: SttConfig, draft: SttDraft): boolean {
  return buildSttUpdate(stored, draft, EMPTY_STT_CREDENTIAL) !== null
}

/** The names of the members of an update body, `credential` as a name only: what a log record may say. */
export function sttChangedNames(body: SttConfigUpdateRequest): string {
  return Object.keys(body)
    .filter((key) => key !== 'revision')
    .join(',')
}

export const SttSaveFailure = {
  /** 409 `REVISION_CONFLICT`: reload prompt. */
  CONFLICT: 'CONFLICT',
  /** 422 `ENDPOINT_NOT_LOOPBACK`: the endpoint field's message. */
  ENDPOINT_NOT_LOOPBACK: 'ENDPOINT_NOT_LOOPBACK',
  /** Another 422: the values were refused. */
  REFUSED: 'REFUSED',
  /** 503 `CREDENTIAL_STORE_NOT_READY`: said plainly; NOT "the Core server is starting". */
  CREDENTIAL_STORE_NOT_READY: 'CREDENTIAL_STORE_NOT_READY',
  /** Anything else: the shared presenter first, then the page's own words. */
  OTHER: 'OTHER',
} as const
export type SttSaveFailure = (typeof SttSaveFailure)[keyof typeof SttSaveFailure]

function reasonOf(failure: SttCallFailure): string | null {
  const details: unknown = failure.error.details
  if (typeof details !== 'object' || details === null) return null
  const reason = (details as { reason?: unknown }).reason
  return typeof reason === 'string' ? reason : null
}

export function classifySttSaveFailure(failure: SttCallFailure | null): SttSaveFailure {
  if (failure === null) return SttSaveFailure.OTHER
  const reason = reasonOf(failure)
  if (failure.status === 409 && reason === STT_REVISION_CONFLICT_REASON) return SttSaveFailure.CONFLICT
  if (failure.status === 503 && failure.error.code === ApiErrorCode.NOT_READY && reason === STT_CREDENTIAL_STORE_NOT_READY_REASON) {
    return SttSaveFailure.CREDENTIAL_STORE_NOT_READY
  }
  if (failure.status === 422) return reason === SttConfigRefusalReason.ENDPOINT_NOT_LOOPBACK ? SttSaveFailure.ENDPOINT_NOT_LOOPBACK : SttSaveFailure.REFUSED
  return SttSaveFailure.OTHER
}

/** True for the 503 of operation 92 that says the transcriber probe is not provided or not ready. */
export function isTranscriberNotReady(failure: SttCallFailure | null): boolean {
  return failure !== null && failure.status === 503 && failure.error.code === ApiErrorCode.NOT_READY && reasonOf(failure) === STT_TRANSCRIBER_NOT_READY_REASON
}

/** Which of the three result sentences a test outcome gets (`reachable: false` is a result, not an error). */
export function sttTestResultKey(result: { readonly reachable: boolean; readonly modelAvailable: boolean }): 'reachable' | 'modelMissing' | 'unreachable' {
  if (!result.reachable) return 'unreachable'
  return result.modelAvailable ? 'reachable' : 'modelMissing'
}
