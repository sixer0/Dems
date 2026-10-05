/**
 * `@dems/shared/live/testing`: the contract-checked fake transport (HB-11; backend task
 * 04_client_integration_spec §12.2; research TD-12; plan row W31). One test double for the client
 * tests of the web console (Vitest) and of the mobile app (jest), in place of a real server.
 *
 * FOR TESTS AND TEST HARNESSES ONLY (TS-15): no production file imports this module.
 *
 * | File | Holds |
 * |------|-------|
 * | `fake-transport.ts` | `createFakeTransport`, `withFakeTransport`, the answer helpers (`exampleAnswer`, `refusal`, `rateLimited`, `notReady`) |
 * | `http.ts` | The `fetch`-compatible function and the scripted answers |
 * | `socket.ts` | The socket constructor, the socket factory, and the server's end of a socket |
 * | `contract.ts` | The checks against the operation registry, in both directions |
 * | `log.ts` | The shared call log and its masked text |
 * | `clock.ts` | The manual clock, and a clock on timer functions that are passed in |
 * | `errors.ts` | The named errors and the masking of credentials |
 * | `install.ts` | The opt-in that puts the fake where a runtime keeps its own `fetch` and socket constructor |
 *
 * Platform neutral and runner neutral: this folder imports the contract (`../../api`) and, as types
 * only, the typed client and the socket client it stands in for. It names no test runner, starts no
 * timer, opens no port and reads no real time.
 */
export * from './errors';
export * from './clock';
export {
  createFakeContract,
  type AnswerCheck,
  type ContractIssue,
  type ContractParse,
  type ContractSchema,
  type FakeContract,
  type RequestCheck,
} from './contract';
export {
  describeLogEntry,
  type FakeCallLog,
  type FakeHttpCall,
  type FakeHttpOutcome,
  type FakeLogEntry,
  type FakeSocketClosure,
  type FakeSocketFrame,
  type FakeSocketRecord,
  type FakeSocketState,
} from './log';
export {
  NO_ANSWER,
  OUTAGE,
  type FakeAnswer,
  type FakeFetch,
  type FakeFetchInit,
  type FakeFetchResponse,
  type FakeHeldAnswer,
  type FakeNoAnswer,
  type FakeOutage,
  type FakePosition,
  type FakeReply,
  type FakeResponder,
  type FakeResponseHeaders,
} from './http';
export {
  ABNORMAL_CLOSURE,
  FakeConnection,
  FakeSocket,
  type FakeConnectScript,
  type FakeMessageOptions,
  type FakeOperatorStartOptions,
  type FakeSocketEvent,
  type FakeSocketFactory,
  type FakeSocketOptions,
  type FakeStateMessageOptions,
  type FakeWebSocketConstructor,
} from './socket';
export * from './fake-transport';
export * from './install';
