// W12 follow-up: are the harness's canned answers still valid against the registry as it stands?
// The same checks harness.mjs makes at start, without Fastify and without a port.
//   node --import tsx .cache/proof-harness/canned_check_w12.mjs
import { ApiErrorSchema, CORE_API_EXAMPLES, CORE_API_OPERATIONS, sessionCreateSchema, validateCoreApiResponse } from '../../packages/shared/src/api/index.ts'

const exampleOf = (operationId, status, name) => CORE_API_EXAMPLES[operationId].responses[status][name].value
const CANNED = {
  health: ['getServiceHealth', 200, exampleOf('getServiceHealth', 200, 'live')],
  created: ['createSession', 201, exampleOf('createSession', 201, 'created')],
  notSignedIn: ['createSession', 401, exampleOf('createSession', 401, 'notSignedIn')],
  invalidInput: ['createSession', 422, exampleOf('createSession', 422, 'invalidInput')],
  exportForbidden: ['exportEvidence', 403, exampleOf('exportEvidence', 403, 'forbidden')],
  video: ['getVideoStatus', 200, exampleOf('getVideoStatus', 200, 'recording')],
}
let bad = 0
for (const [name, [operationId, status, body]] of Object.entries(CANNED)) {
  const result = validateCoreApiResponse(operationId, status, body)
  if (!result.ok) bad += 1
  console.log(`${name.padEnd(16)} ${operationId} ${status} -> ${result.ok ? 'valid' : `INVALID ${result.reason}`}`)
}
const rate = ApiErrorSchema.safeParse({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' } }).success
const envelope429 = validateCoreApiResponse('stopSession', 429, { error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' } })
const violation = validateCoreApiResponse('getStorageStatus', 200, { state: 'READY', totalBytes: 'not-a-number', leakedMember: 'x' })
const request = sessionCreateSchema.safeParse(Object.values(CORE_API_EXAMPLES.createSession.request)[0].value).success
console.log(`rateLimited      envelope parses: ${rate}; as an answer of stopSession: ${envelope429.ok ? 'valid' : `INVALID ${envelope429.reason}`}`)
console.log(`storageViolation is refused: ${violation.ok === false} (${violation.ok ? '' : violation.reason})`)
console.log(`createSession request example parses: ${request}`)
console.log(`registry operations: ${CORE_API_OPERATIONS.length}`)
process.exit(bad === 0 && rate && violation.ok === false && request ? 0 : 1)
