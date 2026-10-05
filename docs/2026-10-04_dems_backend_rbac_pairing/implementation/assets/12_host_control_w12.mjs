// W12 host control run: the same typed client, under Node with Node's fetch, against the harness.
// It shows that the harness and the client agree before the emulator is involved. Not the proof.
//   node --import tsx .cache/proof-harness/host_control_w12.mjs <run id>
import { CORE_API_EXAMPLES } from '../../packages/shared/src/api/index.ts'
import { createCoreClient } from '../../packages/shared/src/client/index.ts'

const run = process.argv[2] ?? '0'
const base = `http://127.0.0.1:${process.env.PROOF_HARNESS_PORT ?? 4421}`
const bearer = `dvc_HOST_FAKE_${Math.random().toString(16).slice(2).padEnd(16, '0')}`
const first = (id) => Object.values(CORE_API_EXAMPLES[id].request)[0].value
let failed = 0
const line = (check, pass, details) => {
  if (!pass) failed += 1
  console.log(`[HOST-CONTROL run=${run}] ${check} ${pass ? 'PASS' : 'FAIL'} ${JSON.stringify(details)}`)
}
const outline = (r) => (r.ok ? { ok: true, status: r.status, epoch: r.epoch, revision: r.revision, requestId: r.requestId } : { ok: false, kind: r.kind, status: r.status, code: r.error.code, retryAfterSeconds: r.retryAfterSeconds, transport: r.transport })

const client = createCoreClient({ baseUrl: base, credentials: () => bearer })
const health = await client.call('getServiceHealth')
line('P1 GET getServiceHealth', health.ok && health.status === 200, outline(health))
const created = await client.call('createSession', { body: first('createSession') })
line('P2 POST createSession', created.ok && created.status === 201 && created.epoch !== null && Number.isInteger(created.revision), outline(created))
const exported = await client.call('exportEvidence', { params: CORE_API_EXAMPLES.exportEvidence.pathParams, body: first('exportEvidence') })
line('P3 POST exportEvidence 403', !exported.ok && exported.kind === 'FORBIDDEN' && exported.error.code === 'FORBIDDEN', outline(exported))
const limited = await client.call('stopSession', { params: CORE_API_EXAMPLES.stopSession.pathParams, body: first('stopSession') })
line('P4 POST stopSession 429 retry-after', !limited.ok && limited.kind === 'RATE_LIMITED' && limited.retryAfterSeconds === 42, outline(limited))
const violated = await client.call('getStorageStatus')
line('P5 GET getStorageStatus contract violation', !violated.ok && violated.kind === 'CONTRACT_VIOLATION' && !('data' in violated), outline(violated))
const noBearer = await createCoreClient({ baseUrl: base, credentials: () => null }).call('createSession', { body: first('createSession') })
line('P2b POST createSession without a credential is 401', !noBearer.ok && noBearer.kind === 'UNAUTHENTICATED', outline(noBearer))
const started = Date.now()
const slow = await createCoreClient({ baseUrl: base, credentials: () => bearer, timeoutMs: 1000 }).call('getVideoStatus')
line('P7 GET getVideoStatus time-out', !slow.ok && slow.kind === 'TIMEOUT', { ...outline(slow), elapsedMs: Date.now() - started })
console.log(`[HOST-CONTROL run=${run}] DONE fail=${failed}`)
process.exit(failed === 0 ? 0 : 1)
