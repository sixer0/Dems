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
// actions to operations. The registry now holds all 75 operations.
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
