// Plan row W1, item 2 (decisions D178 DC-4 / FW76-5, D176; test file granted by D182): the one
// paged walk of the Core's lists (`lib/core-page-walk.ts`), which the Security & Audit page (the
// audit export, operation 59) and the System page (the log export, operations 59 and 63) both call.
// The page tests (`live-security-audit-export`, `live-system-export`, `live-security-audit-signout`)
// prove the walk through each page; these unit cases pin what no page test stages:
//
// | Case | Test |
// |------|------|
// | Every page, in order, following the cursor, to the rows the export covers; the page counter after each page | "reads every page in order" |
// | D176: a walk that STARTS signed out sends nothing and ends with the Core's own 401 (`transport: null`) | "a walk that starts signed out" |
// | D176: signed out after the first page, the second page is never asked for | "signed out after the first page" |
// | Without a known count: the stop before the export's own AUDIT_EXPORTED row | "without a known count" |
// | The count check, the sequence check and the head check when no head (or a wrong one) is known | "the count check", "the sequence check", "the head check" |
// | A refused page: the failure kept whole, no further page, no rows | "a refused page" |
// | A server that never stops handing out cursors: ENDLESS for 59 and 63, never what was read | "a server that never stops" |
// | Every event of every page, in order | "every event of every page" |
import { describe, expect, it } from 'vitest'
import { ApiErrorCode, type AuditPage, type EventPage } from '@dems/shared/api'
import { SIGNED_OUT_PAGE, walkAllEvents, walkAuditChain, type CorePageAnswer, type CoreWalkFailure } from '@/lib/core-page-walk'

class PageError extends Error {
  readonly reason: CoreWalkFailure
  constructor(reason: CoreWalkFailure) {
    super('walk failed')
    this.reason = reason
  }
}

const row = (seq: number, extra: Record<string, unknown> = {}) => ({ seq, type: 'DEVICE_COMMAND', details: {}, hash: `h${seq}`, prevHash: `h${seq - 1}`, ...extra })

/** A Core of `rows` audit rows in pages of `limit`; every call is logged. */
function auditCore(rows: readonly ReturnType<typeof row>[], limit = 2) {
  const calls: (string | null)[] = []
  const read = async (cursor: string | null): Promise<CorePageAnswer<AuditPage>> => {
    calls.push(cursor)
    const start = cursor === null ? 0 : Number(cursor)
    const page = rows.slice(start, start + limit)
    return { ok: true, data: { rows: page, head: 'x', total: rows.length, nextCursor: start + limit < rows.length ? String(start + limit) : null } as unknown as AuditPage }
  }
  return { calls, read }
}

const options = (signedIn: () => boolean = () => true, pages: number[] = []) => ({ signedIn, fail: (reason: CoreWalkFailure) => new PageError(reason), onPage: (read: number) => pages.push(read) })

async function failure(promise: Promise<unknown>): Promise<CoreWalkFailure> {
  const caught = await promise.then(
    () => null,
    (error: unknown) => error,
  )
  expect(caught).toBeInstanceOf(PageError)
  return (caught as PageError).reason
}

describe('the one paged walk (`lib/core-page-walk.ts`)', () => {
  it('reads every page in order, following the cursor, to the rows the export covers; the page counter after each page', async () => {
    const core = auditCore([1, 2, 3, 4, 5, 6].map((seq) => row(seq)))
    const pages: number[] = []
    const rows = await walkAuditChain(core.read, { exportId: 'EXP-1', rows: 5, head: 'h5' }, options(() => true, pages))
    expect(rows.map((item) => item.seq)).toEqual([1, 2, 3, 4, 5])
    expect(core.calls).toEqual([null, '2', '4'])
    expect(pages).toEqual([1, 2, 3])
  })

  it('D176: a walk that starts signed out reads nothing and ends with the Core\'s own 401 (a refusal, not an outage)', async () => {
    const core = auditCore([row(1)])
    const reason = await failure(walkAuditChain(core.read, { exportId: 'EXP-1', rows: 1, head: 'h1' }, options(() => false)))
    expect(core.calls).toEqual([])
    expect(reason).toEqual({ kind: 'CALL', list: 'AUDIT', failure: SIGNED_OUT_PAGE })
    expect(SIGNED_OUT_PAGE).toMatchObject({ ok: false, status: 401, error: { code: ApiErrorCode.NOT_SIGNED_IN }, transport: null })
    const events = { calls: 0 }
    const eventReason = await failure(walkAllEvents(async () => ((events.calls += 1), { ok: true, data: { events: [], nextCursor: null } as unknown as EventPage }), options(() => false)))
    expect(events.calls).toBe(0)
    expect(eventReason).toMatchObject({ kind: 'CALL', list: 'EVENTS' })
  })

  it('D176: signed out after the first page — the second page is never asked for', async () => {
    const core = auditCore([1, 2, 3, 4].map((seq) => row(seq)))
    let asked = 0
    const reason = await failure(walkAuditChain(core.read, { exportId: 'EXP-1', rows: 4, head: 'h4' }, options(() => (asked += 1) === 1)))
    expect(core.calls).toEqual([null])
    expect(reason).toMatchObject({ kind: 'CALL', failure: { status: 401 } })
  })

  it('without a known count the walk stops before the export\'s own AUDIT_EXPORTED row', async () => {
    const exported = row(4, { type: 'AUDIT_EXPORTED', details: { exportId: 'EXP-1' } })
    const core = auditCore([row(1), row(2), row(3), exported, row(5)])
    const rows = await walkAuditChain(core.read, { exportId: 'EXP-1', rows: null, head: null }, options())
    expect(rows.map((item) => item.seq)).toEqual([1, 2, 3])
    expect(core.calls).toEqual([null, '2'])
  })

  it('the count check: a list that ends early (no head known) is a moved chain, never a short file', async () => {
    const core = auditCore([1, 2, 3].map((seq) => row(seq)))
    expect(await failure(walkAuditChain(core.read, { exportId: 'EXP-1', rows: 5, head: null }, options()))).toEqual({ kind: 'CHAIN', walked: 3, lastSeq: 3 })
  })

  it('the sequence check: a duplicated row in place of a missing one (right count, no head known) is a moved chain', async () => {
    const core = auditCore([row(1), row(2), row(2), row(4)])
    expect(await failure(walkAuditChain(core.read, { exportId: 'EXP-1', rows: 4, head: null }, options()))).toMatchObject({ kind: 'CHAIN', walked: 4 })
  })

  it('the head check: the right count ending on another hash is a moved chain', async () => {
    const core = auditCore([1, 2, 3].map((seq) => row(seq)))
    expect(await failure(walkAuditChain(core.read, { exportId: 'EXP-1', rows: 3, head: 'other' }, options()))).toMatchObject({ kind: 'CHAIN' })
  })

  it('a refused page: the failure kept whole, no further page, no rows', async () => {
    const refused = { ok: false as const, status: 503, error: { code: 'NOT_READY' } }
    const calls: (string | null)[] = []
    const reason = await failure(walkAuditChain(async (cursor) => (calls.push(cursor), cursor === null ? { ok: true, data: { rows: [row(1), row(2)], nextCursor: '2' } as unknown as AuditPage } : refused), { exportId: 'EXP-1', rows: 4, head: 'h4' }, options()))
    expect(reason).toEqual({ kind: 'CALL', list: 'AUDIT', failure: refused })
    expect(calls).toEqual([null, '2'])
  })

  it('a server that never stops handing out cursors: ENDLESS, never what was read (audit, unknown count; events)', async () => {
    let auditCalls = 0
    const audit = await failure(walkAuditChain(async () => ((auditCalls += 1), { ok: true, data: { rows: [], nextCursor: 'again' } as unknown as AuditPage }), { exportId: 'EXP-1', rows: null, head: null }, options()))
    expect(audit).toEqual({ kind: 'ENDLESS', list: 'AUDIT' })
    expect(auditCalls).toBe(10_000)
    let eventCalls = 0
    const events = await failure(walkAllEvents(async () => ((eventCalls += 1), { ok: true, data: { events: [{ seq: eventCalls }], nextCursor: 'again' } as unknown as EventPage }), options()))
    expect(events).toEqual({ kind: 'ENDLESS', list: 'EVENTS' })
    expect(eventCalls).toBe(10_000)
  })

  it('every event of every page, in order', async () => {
    const pages: EventPage[] = [{ events: [{ seq: 1 }, { seq: 2 }], nextCursor: 'b' }, { events: [{ seq: 3 }], nextCursor: null }] as unknown as EventPage[]
    const cursors: (string | null)[] = []
    const events = await walkAllEvents(async (cursor) => (cursors.push(cursor), { ok: true, data: pages[cursors.length - 1] as EventPage }), options())
    expect((events as unknown as { seq: number }[]).map((event) => event.seq)).toEqual([1, 2, 3])
    expect(cursors).toEqual([null, 'b'])
  })
})
