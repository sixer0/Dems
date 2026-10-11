export * from './constants';
export * from './health';
export * from './realtime-messages';
// Core API contract (step 33): ID patterns, session form schema, REST bodies, examples and the
// OpenAPI 3.1 document builder. Framework-free (zod only); the document is built on demand.
export * from './patterns';
export * from './session-schema';
export * from './core-api';
export * from './examples';
export * from './openapi';
// Backend task (2026-10-04 01_specs §7; plan row W19, contract A): the text rule, the areas the Core
// server answers (schemas, operations, examples), and the operation table with literal types. The
// registry model (`contract-model.ts`) is re-exported by `core-api.ts`.
export * from './text';
export * from './identity';
export * from './administration';
export * from './pairing';
export * from './demo-controls';
export * from './operation-table';
// Backend task (01_specs §3.2, §9; plan row W22, contract B): the Core state on the wire (one schema
// per replicated slice) and the examples of the socket's messages. The messages themselves are in
// `./realtime-messages`, exported at the top.
export * from './state-slices';
export * from './realtime-examples';
// Backend task (01_specs §7.8 to §7.15, §7.17; plan row W27, contract C): areas 4 to 11 (schemas,
// operations, examples), the state values their examples show, and the map of the 42 simulator
// actions to operations. The registry held 75 at that row; it holds 97 now (`core-api.ts`, pinned by test/api-registry.test.ts).
export * from './sessions';
export * from './evidence';
export * from './devices';
export * from './storage';
export * from './network-time';
export * from './security-audit';
export * from './system';
export * from './alerts';
export * from './state-examples';
export * from './sim-actions';
// Task 3 M2-W7 (blueprint row 48; register CS-25; C3 §7): the capture-phase constants, pinned by
// the Core server's contract-values test.
export * from './capture';
// Task 3 M6 (blueprint row 113; C3 §2.5; R-8, D20/D24): the STT configuration of operations 90-92
// (schemas, operations, examples) and the one rule of an update the simulator and the server share.
export * from './transcription';
// Task 3 R-9..R-11 (blueprint row 132, decision D106; C3 §2.6): camera search, connection test,
// adoption and the local-input re-read of operations 93-97 (schemas, operations, examples, the
// audit-detail builders the Core server and the simulator share).
export * from './capture-discovery';
// Task 3 row 113, fix round 1 (navigator finding N-1): the one rule set of the two client
// log-blanking lists (web error sink, mobile runtime log). Dependency-free.
export * from './redaction';
