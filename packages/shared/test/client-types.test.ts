// HB-9 (CL-1): "operation ID in, typed input in, typed success or typed error envelope out".
// The type assertions are checked by `npm run typecheck` (tsc includes this folder); the runtime
// parts run in Vitest.
//
// The types come from the operation table. A table declared `as const` gives literal operation IDs
// and per-operation input and output types. The default table is the registry's own, with literal
// types (`CoreApiOperationTable`, contract A), so a client made without `operations` is typed per
// operation: the last block. A widened table (`operations: CORE_API_OPERATIONS`) gives the loose
// fallback: any string ID, loose input, `unknown` data.
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  CORE_API_OPERATIONS,
  CoreApiMode,
  CoreApiTag,
  type ApiError,
  type CoreApiOperation,
  type CoreApiOperationTable,
  type EvidenceExportRequest,
  type HealthResponse,
  type SessionCommandResponse,
  type SessionStartRequest,
  type SessionStopRequest,
} from '../src/api';
import {
  createCoreClient,
  type CoreCallFailure,
  type CoreCallInput,
  type CoreCallSuccess,
  type CoreCallSuccessOf,
  type CoreFetch,
  type CoreLooseCallInput,
  type CoreOperationId,
  type CoreQuery,
  type RegistryTable,
} from '../src/client';

const base = { tag: CoreApiTag.SERVICE, mode: CoreApiMode.LIVE, summary: 'test', description: 'test', source: 'test' } as const;

const TABLE = [
  {
    ...base,
    operationId: 'readThing',
    method: 'get',
    path: '/api/v1/thing/{id}',
    pathParam: { name: 'id', description: 'test', pattern: /^.+$/ },
    responses: { 200: { description: 'ok', schema: 'SessionCommandResponse' }, 404: { description: 'no', schema: 'ApiError' } },
  },
  {
    ...base,
    operationId: 'stopThing',
    method: 'post',
    path: '/api/v1/thing/stop',
    requestBody: { schema: 'SessionStopRequest', required: true },
    responses: {
      201: { description: 'done', schema: 'SessionCommandResponse' },
      204: { description: 'nothing to say' },
      409: { description: 'no', schema: 'ApiError' },
    },
  },
  {
    ...base,
    operationId: 'startThing',
    method: 'post',
    path: '/api/v1/thing/start',
    requestBody: { schema: 'SessionStartRequest', required: false },
    responses: { 202: { description: 'accepted', schema: 'SessionCommandResponse' } },
  },
] as const satisfies readonly CoreApiOperation[];
type Table = typeof TABLE;

const answer: CoreFetch = async (url) => ({
  status: url.endsWith('/stop') ? 204 : url.endsWith('/start') ? 202 : 200,
  headers: { get: () => null },
  text: async () => (url.endsWith('/stop') ? '' : JSON.stringify({ sessionId: 'SES-20261001-0024', state: 'RECORDING' })),
});

describe('a table declared `as const`: types per operation', () => {
  const client = createCoreClient({ baseUrl: 'http://127.0.0.1:4420', credentials: 'browser-cookie', fetch: answer, operations: TABLE });

  it('operation IDs are a literal union', () => {
    expectTypeOf<CoreOperationId<Table>>().toEqualTypeOf<'readThing' | 'stopThing' | 'startThing'>();
    expectTypeOf(client.operationIds).toEqualTypeOf<readonly ('readThing' | 'stopThing' | 'startThing')[]>();
    expect(client.operationIds).toEqual(['readThing', 'stopThing', 'startThing']);
  });

  it('the input follows the path parameter and the request body of the operation', () => {
    expectTypeOf<CoreCallInput<Table, 'readThing'>['params']>().toEqualTypeOf<{ readonly id: string }>();
    expectTypeOf<CoreCallInput<Table, 'readThing'>['body']>().toEqualTypeOf<undefined>();
    expectTypeOf<CoreCallInput<Table, 'stopThing'>['body']>().toEqualTypeOf<SessionStopRequest>();
    expectTypeOf<CoreCallInput<Table, 'stopThing'>['params']>().toEqualTypeOf<undefined>();
    expectTypeOf<CoreCallInput<Table, 'startThing'>['body']>().toEqualTypeOf<SessionStartRequest | undefined>();
  });

  it('the success is one member per documented 2xx status, with the data of its schema', async () => {
    expectTypeOf<CoreCallSuccessOf<Table, 'readThing'>>().toEqualTypeOf<CoreCallSuccess<200, SessionCommandResponse>>();
    expectTypeOf<CoreCallSuccessOf<Table, 'stopThing'>>().toEqualTypeOf<
      CoreCallSuccess<201, SessionCommandResponse> | CoreCallSuccess<204, undefined>
    >();

    const read = await client.call('readThing', { params: { id: 'T-1' } });
    expectTypeOf(read).toEqualTypeOf<CoreCallSuccess<200, SessionCommandResponse> | CoreCallFailure>();
    if (!read.ok) throw new Error('expected a success');
    expectTypeOf(read.data.state).toEqualTypeOf<SessionCommandResponse['state']>();
    expect(read.data.state).toBe('RECORDING');

    const stopped = await client.call('stopThing', { body: { reason: 'Interview completed' } });
    if (!stopped.ok) throw new Error('expected a success');
    if (stopped.status === 204) expectTypeOf(stopped.data).toEqualTypeOf<undefined>();
    else expectTypeOf(stopped.data).toEqualTypeOf<SessionCommandResponse>();
    expect(stopped.status).toBe(204);

    // An optional body: the input argument itself is optional.
    const started = await client.call('startThing');
    expect(started.ok && started.status).toBe(202);
  });

  it('the failure is the typed error envelope', async () => {
    const refused: CoreFetch = async () => ({
      status: 404,
      headers: { get: () => null },
      text: async () => JSON.stringify({ error: { code: 'NOT_FOUND', message: 'No such thing.' } }),
    });
    const result = await createCoreClient({ baseUrl: '', credentials: 'browser-cookie', fetch: refused, operations: TABLE }).call(
      'readThing',
      { params: { id: 'T-9' } },
    );
    if (result.ok) throw new Error('expected a failure');
    // The envelope member: `code` and `message`, plus the optional `details` and `requestId` (01_specs §7.2).
    expectTypeOf(result.error).toEqualTypeOf<ApiError['error']>();
    expectTypeOf(result.error).toExtend<{ code: string; message: string }>();
    expectTypeOf(result.error.details).toEqualTypeOf<Record<string, string | number | boolean | null> | undefined>();
    expectTypeOf(result.error.requestId).toEqualTypeOf<string | undefined>();
    expectTypeOf(result.requestId).toEqualTypeOf<string | null>();
    expectTypeOf(result.status).toEqualTypeOf<number | null>();
    expect(result.error.code).toBe('NOT_FOUND');
  });

  // Never run: each line must be a compile error.
  const misuse = (): void => {
    // @ts-expect-error an ID the table does not hold
    void client.call('noSuchThing');
    // @ts-expect-error the path parameter is required
    void client.call('readThing');
    // @ts-expect-error the path parameter is named `id`
    void client.call('readThing', { params: { key: 'T-1' } });
    // @ts-expect-error a required body is required
    void client.call('stopThing');
    // @ts-expect-error the body has the type of its schema
    void client.call('stopThing', { body: { reason: 5 } });
    // @ts-expect-error an operation without a body takes none
    void client.call('readThing', { params: { id: 'T-1' }, body: {} });
  };
  void misuse;
});

describe('a table that is not `as const`: the loose fallback (`operations: CORE_API_OPERATIONS`)', () => {
  const widened: readonly CoreApiOperation[] = CORE_API_OPERATIONS;
  const client = createCoreClient({ baseUrl: 'http://127.0.0.1:4420', credentials: 'browser-cookie', fetch: answer, operations: widened });

  it('any string is an operation ID, the input is loose and the data is unknown', async () => {
    type Widened = readonly CoreApiOperation[];
    expectTypeOf<CoreOperationId<Widened>>().toEqualTypeOf<string>();
    expectTypeOf<CoreCallInput<Widened, 'createSession'>>().toEqualTypeOf<CoreLooseCallInput>();
    expectTypeOf<CoreCallSuccessOf<Widened, 'createSession'>>().toEqualTypeOf<CoreCallSuccess>();

    const result = await client.call('getCurrentSession');
    if (result.ok) expectTypeOf(result.data).toBeUnknown();
    // The answer of the fake is not a CurrentSessionResponse: the runtime check does not depend on the types.
    expect(result).toMatchObject({ ok: false, kind: 'CONTRACT_VIOLATION' });
  });
});

describe('the default client: typed by the registry (contract A, `CoreApiOperationTable`)', () => {
  const client = createCoreClient({ baseUrl: 'http://127.0.0.1:4420', credentials: 'browser-cookie', fetch: answer });

  it('the default table type is the registry\'s literal table: operation IDs are a union', () => {
    expectTypeOf<RegistryTable>().toEqualTypeOf<CoreApiOperationTable>();
    expectTypeOf(client.operationIds).toEqualTypeOf<readonly CoreOperationId[]>();
    expectTypeOf<'getServiceHealth' | 'createSession' | 'exportEvidence' | 'signOut'>().toExtend<CoreOperationId>();
    expectTypeOf<'noSuchOperation'>().not.toExtend<CoreOperationId>();
    expectTypeOf<string>().not.toExtend<CoreOperationId>();
    expect(client.operationIds).toEqual(CORE_API_OPERATIONS.map((operation) => operation.operationId));
  });

  it('request and response types are derived per operation', async () => {
    expectTypeOf<CoreCallInput<RegistryTable, 'exportEvidence'>['params']>().toEqualTypeOf<{ readonly id: string }>();
    expectTypeOf<CoreCallInput<RegistryTable, 'exportEvidence'>['body']>().toEqualTypeOf<EvidenceExportRequest>();
    expectTypeOf<CoreCallInput<RegistryTable, 'getServiceHealth'>['body']>().toEqualTypeOf<undefined>();
    expectTypeOf<CoreCallSuccessOf<RegistryTable, 'getServiceHealth'>>().toEqualTypeOf<CoreCallSuccess<200, HealthResponse>>();
    expectTypeOf<CoreCallSuccessOf<RegistryTable, 'createSession'>>().toEqualTypeOf<
      CoreCallSuccess<200, SessionCommandResponse> | CoreCallSuccess<201, SessionCommandResponse>
    >();
    // A success without a body (204) has no data.
    expectTypeOf<CoreCallSuccessOf<RegistryTable, 'signOut'>>().toEqualTypeOf<CoreCallSuccess<204, undefined>>();

    const started = await client.call('startSession', { params: { id: 'SES-20261001-0024' } });
    expectTypeOf(started).toEqualTypeOf<
      CoreCallSuccess<200, SessionCommandResponse> | CoreCallSuccess<202, SessionCommandResponse> | CoreCallFailure
    >();
    if (!started.ok) throw new Error('expected a success');
    expectTypeOf(started.data.state).toEqualTypeOf<SessionCommandResponse['state']>();
    // API-7: both state headers are integers.
    expectTypeOf(started.epoch).toEqualTypeOf<number | null>();
    expectTypeOf(started.revision).toEqualTypeOf<number | null>();
    expect(started.data.state).toBe('RECORDING');
  });

  it('the input type of the full registry can be evaluated: one intersection per operation, not a cross product (TS2590)', () => {
    // Regression for contract C (89 operations). Written as `ParamsOf<U> & BodyOf<U> & QueryOf<U>` over
    // the union U of all operations, the input type is a cross product of n * n * n members, and the
    // compiler refuses a union above 100,000 (n = 47): the first typed `client.call` of a program
    // then fails with TS2590 and NO later call is type-checked (the `misuse` lines below were reported
    // as unused `@ts-expect-error`). `InputOfOperation` in core-client.ts distributes over the union.
    expect(CORE_API_OPERATIONS.length).toBeGreaterThanOrEqual(47); // large enough to reach the limit

    // The input over ALL operation IDs, as the compiler sees it in the generic `call` signature.
    type AnyInput = CoreCallInput<RegistryTable, CoreOperationId>;
    expectTypeOf<AnyInput>().not.toBeAny();
    expectTypeOf<AnyInput>().not.toBeNever();

    // For a literal ID: exactly that operation's three parts, in one member.
    type ExportInput = CoreCallInput<RegistryTable, 'exportEvidence'>;
    expectTypeOf<ExportInput>().toEqualTypeOf<
      { readonly params: { readonly id: string } } & { readonly body: EvidenceExportRequest } & { readonly query?: CoreQuery }
    >();
    expectTypeOf<{ readonly params: { readonly id: string }; readonly body: EvidenceExportRequest }>().toExtend<ExportInput>();
    // A cross product would let one operation's path parameter stand without that operation's body. It does not:
    expectTypeOf<{ readonly params: { readonly id: string } }>().not.toExtend<ExportInput>();
    expectTypeOf<{ readonly body: EvidenceExportRequest }>().not.toExtend<ExportInput>();
    // And each operation's input is one member of the input over all IDs.
    expectTypeOf<ExportInput>().toExtend<AnyInput>();
  });

  // Never run: each line must be a compile error. They are also the other half of the TS2590
  // regression: with the cross product in place the compiler stopped checking typed calls, and every
  // directive below was reported as unused.
  const misuse = (): void => {
    // @ts-expect-error an ID the registry does not hold
    void client.call('noSuchOperation');
    // @ts-expect-error the path parameter is required
    void client.call('exportEvidence', { body: { reason: 'Prosecutor review' } });
    // @ts-expect-error a required body is required
    void client.call('createSession');
    // @ts-expect-error the body has the type of its schema
    void client.call('stopSession', { params: { id: 'SES-20261001-0024' }, body: { reason: 5 } });
    // @ts-expect-error an operation without a body takes none
    void client.call('getServiceHealth', { body: {} });
  };
  void misuse;
});
