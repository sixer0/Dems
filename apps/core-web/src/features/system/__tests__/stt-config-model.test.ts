// Task 3 blueprint row 117 (R-8): the pure rules of the Transcription (STT) section.
//
// | Rule | Where it is proven |
// |------|--------------------|
// | `model` is trimmed before the shared `isSttModelId` check and before the send (D70 R-3) | "model" |
// | The endpoint is checked for the server backend only, with the shared loopback rule | "endpoint" |
// | The body carries `revision` and the changed members only; nothing changed → `null` | "update body" |
// | The three credential forms are exactly the contract's (REFERENCE ref only, SECRET value only, CLEAR neither) | "credential" |
// | A validation result holds field names and message keys, never a typed value (canary; D70 R-3) | "no value in a validation result" |
// | A refusal is classified by status, code and `details.reason` | "refusals" |
import { describe, expect, it } from 'vitest'
import { SttConfigUpdateRequestSchema, type SttConfig } from '@dems/shared/api'
import type { CoreCallFailure } from '@dems/shared/client'
import {
  buildSttUpdate,
  classifySttSaveFailure,
  draftOf,
  EMPTY_STT_CREDENTIAL,
  hasSttErrors,
  isTranscriberNotReady,
  STT_SECRET_FORM_OFFERED,
  sttChangedNames,
  SttCredentialEdit,
  sttDraftDiffers,
  SttSaveFailure,
  sttTestResultKey,
  validateSttDraft,
} from '../stt-config-model'

const CANARY = 'CANARY-7f3kQ9-do-not-leak'

const STORED: SttConfig = {
  enabled: true,
  backend: 'cpu-local',
  model: 'large-v3',
  language: 'id',
  diarization: true,
  credentialSet: false,
  revision: 4,
  updatedAt: 1_760_000_000_000,
  pendingForNextSession: false,
}
const SERVER: SttConfig = { ...STORED, backend: 'omlx-server', endpoint: 'http://127.0.0.1:8000' }

const failure = (status: number, code: string, details?: Record<string, unknown>): CoreCallFailure =>
  ({ ok: false, operationId: 'updateSttConfig', kind: 'REFUSED', status, error: { code, message: 'text the page never reads', ...(details ? { details } : {}) }, retryAfterSeconds: null, transport: null, requestId: null }) as unknown as CoreCallFailure

describe('model', () => {
  it('is trimmed for the check and for the send', () => {
    const draft = { ...draftOf(STORED), model: '  small-id  ' }
    expect(validateSttDraft(draft, EMPTY_STT_CREDENTIAL)).toEqual({})
    expect(buildSttUpdate(STORED, draft, EMPTY_STT_CREDENTIAL)).toEqual({ revision: 4, model: 'small-id' })
  })

  it('white space around an unchanged model is no change', () => {
    expect(buildSttUpdate(STORED, { ...draftOf(STORED), model: ' large-v3 ' }, EMPTY_STT_CREDENTIAL)).toBeNull()
  })

  it.each(['', '   ', 'two words', 'model.bin', 'a..b', 'trailing.', '../etc', 'x'.repeat(129)])('refuses %j', (model) => {
    expect(validateSttDraft({ ...draftOf(STORED), model }, EMPTY_STT_CREDENTIAL)).toEqual({ model: 'modelInvalid' })
  })
})

describe('endpoint', () => {
  it('is not checked and not sent for cpu-local', () => {
    const draft = { ...draftOf(STORED), endpoint: 'http://192.168.1.9:8000' }
    expect(validateSttDraft(draft, EMPTY_STT_CREDENTIAL)).toEqual({})
    expect(buildSttUpdate(STORED, draft, EMPTY_STT_CREDENTIAL)).toBeNull()
  })

  it.each(['', 'http://192.168.1.9:8000', 'https://127.0.0.1:8000', 'http://127.0.0.1:70000', 'http://localhost.evil.test'])('server backend refuses %j', (endpoint) => {
    expect(validateSttDraft({ ...draftOf(SERVER), endpoint }, EMPTY_STT_CREDENTIAL)).toEqual({ endpoint: 'endpointNotLoopback' })
  })

  it('a loopback address is accepted, trimmed and sent with the backend', () => {
    const draft = { ...draftOf(STORED), backend: 'omlx-server' as const, endpoint: ' http://localhost:8000 ' }
    expect(validateSttDraft(draft, EMPTY_STT_CREDENTIAL)).toEqual({})
    expect(buildSttUpdate(STORED, draft, EMPTY_STT_CREDENTIAL)).toEqual({ revision: 4, backend: 'omlx-server', endpoint: 'http://localhost:8000' })
  })
})

describe('update body', () => {
  it('nothing changed: null, and the draft does not differ', () => {
    expect(buildSttUpdate(STORED, draftOf(STORED), EMPTY_STT_CREDENTIAL)).toBeNull()
    expect(sttDraftDiffers(STORED, draftOf(STORED))).toBe(false)
  })

  it('carries the revision and the changed members only, and parses as the contract body', () => {
    const body = buildSttUpdate(STORED, { ...draftOf(STORED), enabled: false, diarization: false }, EMPTY_STT_CREDENTIAL)
    expect(body).toEqual({ revision: 4, enabled: false, diarization: false })
    expect(SttConfigUpdateRequestSchema.safeParse(body).success).toBe(true)
    expect(sttChangedNames(body!)).toBe('enabled,diarization')
  })
})

describe('credential', () => {
  it('the SECRET form is not offered before blueprint row 84', () => {
    expect(STT_SECRET_FORM_OFFERED).toBe(false)
  })

  it('REFERENCE: ref only, trimmed', () => {
    const body = buildSttUpdate(STORED, draftOf(STORED), { edit: SttCredentialEdit.REFERENCE, text: ' omlx-settings:auth.api_key ' })
    expect(body).toEqual({ revision: 4, credential: { kind: 'REFERENCE', ref: 'omlx-settings:auth.api_key' } })
    expect(SttConfigUpdateRequestSchema.safeParse(body).success).toBe(true)
  })

  it('SECRET: value only, exactly as typed', () => {
    const body = buildSttUpdate(STORED, draftOf(STORED), { edit: SttCredentialEdit.SECRET, text: ' s3cr3t ' })
    expect(body).toEqual({ revision: 4, credential: { kind: 'SECRET', value: ' s3cr3t ' } })
    expect(SttConfigUpdateRequestSchema.safeParse(body).success).toBe(true)
  })

  it('CLEAR: neither; KEEP: no member', () => {
    expect(buildSttUpdate(STORED, draftOf(STORED), { edit: SttCredentialEdit.CLEAR, text: '' })).toEqual({ revision: 4, credential: { kind: 'CLEAR' } })
    expect(buildSttUpdate(STORED, draftOf(STORED), { edit: SttCredentialEdit.KEEP, text: 'ignored' })).toBeNull()
  })

  it('a log record names `credential`, never what it holds', () => {
    const body = buildSttUpdate(STORED, draftOf(STORED), { edit: SttCredentialEdit.SECRET, text: CANARY })!
    expect(sttChangedNames(body)).toBe('credential')
  })

  it.each(['', 'no-colon', 'store: pointer', 'Store:pointer', `x:${'p'.repeat(201)}`])('REFERENCE refuses %j', (text) => {
    expect(validateSttDraft(draftOf(STORED), { edit: SttCredentialEdit.REFERENCE, text })).toEqual({ credential: 'credentialRefInvalid' })
  })

  it('SECRET refuses an empty and an over-long value', () => {
    expect(validateSttDraft(draftOf(STORED), { edit: SttCredentialEdit.SECRET, text: '' })).toEqual({ credential: 'credentialInvalid' })
    expect(validateSttDraft(draftOf(STORED), { edit: SttCredentialEdit.SECRET, text: 'x'.repeat(4097) })).toEqual({ credential: 'credentialInvalid' })
  })
})

describe('no value in a validation result (D70 R-3)', () => {
  const drafts = [
    { edit: SttCredentialEdit.REFERENCE, text: `bad ref ${CANARY}` },
    { edit: SttCredentialEdit.SECRET, text: CANARY.repeat(400) },
  ] as const

  it.each(drafts)('a refused $edit names the field and a message key only', (credential) => {
    const errors = validateSttDraft({ ...draftOf(SERVER), endpoint: `http://${CANARY}`, model: `${CANARY} x` }, credential)
    expect(hasSttErrors(errors)).toBe(true)
    expect(Object.keys(errors).sort()).toEqual(['credential', 'endpoint', 'model'])
    expect(JSON.stringify(errors)).not.toContain('CANARY')
  })

  it('negative control: the search finds the canary where it is', () => {
    expect(JSON.stringify({ field: 'credential.value', value: CANARY })).toContain('CANARY')
  })
})

describe('refusals', () => {
  it('classifies a failed save', () => {
    expect(classifySttSaveFailure(failure(409, 'INVALID_STATE', { reason: 'REVISION_CONFLICT', currentRevision: 5 }))).toBe(SttSaveFailure.CONFLICT)
    expect(classifySttSaveFailure(failure(409, 'INVALID_STATE'))).toBe(SttSaveFailure.OTHER)
    expect(classifySttSaveFailure(failure(422, 'INVALID_INPUT', { reason: 'ENDPOINT_NOT_LOOPBACK' }))).toBe(SttSaveFailure.ENDPOINT_NOT_LOOPBACK)
    expect(classifySttSaveFailure(failure(422, 'INVALID_INPUT', { reason: 'BACKEND_UNKNOWN' }))).toBe(SttSaveFailure.REFUSED)
    expect(classifySttSaveFailure(failure(422, 'INVALID_INPUT'))).toBe(SttSaveFailure.REFUSED)
    expect(classifySttSaveFailure(failure(503, 'NOT_READY', { reason: 'CREDENTIAL_STORE_NOT_READY' }))).toBe(SttSaveFailure.CREDENTIAL_STORE_NOT_READY)
    // A 503 without that reason is the Core starting: the shared presenter's sentence, not this section's.
    expect(classifySttSaveFailure(failure(503, 'NOT_READY'))).toBe(SttSaveFailure.OTHER)
    expect(classifySttSaveFailure(failure(503, 'NOT_READY', { reason: 'STT_CONFIG_NOT_SEEDED' }))).toBe(SttSaveFailure.OTHER)
    expect(classifySttSaveFailure(null)).toBe(SttSaveFailure.OTHER)
  })

  it('knows the 503 of the connection test', () => {
    expect(isTranscriberNotReady(failure(503, 'NOT_READY', { reason: 'TRANSCRIBER_NOT_READY' }))).toBe(true)
    expect(isTranscriberNotReady(failure(503, 'NOT_READY'))).toBe(false)
    expect(isTranscriberNotReady(failure(500, 'INTERNAL', { reason: 'TRANSCRIBER_NOT_READY' }))).toBe(false)
    expect(isTranscriberNotReady(null)).toBe(false)
  })

  it('words a test outcome', () => {
    expect(sttTestResultKey({ reachable: true, modelAvailable: true })).toBe('reachable')
    expect(sttTestResultKey({ reachable: true, modelAvailable: false })).toBe('modelMissing')
    expect(sttTestResultKey({ reachable: false, modelAvailable: false })).toBe('unreachable')
  })
})
