/**
 * The Core's side of the address helper (task 4 row 105, WP-19b): the line protocol and the one
 * caller. Used inside the capture unit by the alias lifecycle (row 106), the commissioning scan
 * (row 107) and the set-IP job (row 111). The connection itself is not here: it is the platform's
 * transport, handed in by the composition.
 */
export {
  ALIAS_MINUTES_MAX,
  ALIAS_MINUTES_MIN,
  AliasAddressProblem,
  HELPER_ANSWER_MAX_BYTES,
  HELPER_CODES,
  HELPER_REQUEST_MAX_BYTES,
  HostAliasAction,
  addRequestLine,
  aliasMinutesOf,
  aliasQuadOf,
  delRequestLine,
  dottedOf,
  helperAnswerOf,
  quadOf,
  type AliasQuad,
  type AliasQuadDecision,
  type HelperCodeName,
} from './protocol';
export {
  HELPER_REFUSAL_KINDS,
  HostAliasCoreRefusal,
  HostAliasEffect,
  HostAliasRefusalKind,
  HostAliasTransportFailure,
  createHostAliasCaller,
  helperRefusalOf,
  interfaceAgreementRefusal,
  judgeExchange,
  wrongNetworkRefusal,
  type HostAliasAddRequest,
  type HostAliasCaller,
  type HostAliasCallerDeps,
  type HostAliasExchange,
  type HostAliasFacts,
  type HostAliasHelperRefusal,
  type HostAliasIntent,
  type HostAliasJournal,
  type HostAliasOutcome,
  type HostAliasRefusal,
  type HostAliasRemoveRequest,
  type HostAliasResult,
  type HostAliasTransport,
} from './caller';
// Row 106 (WP-19b): the lifecycle on that caller - its journal, its facts reader, its stored row.
export { HOST_ALIAS_SWEEP_CANDIDATES_MAX, HostAliasFactsUnknownError, aliasAddressesHeld, aliasCandidatesOfConfiguration, hostAliasFactsReaderOf, type HostAliasFactSources } from './facts';
// Row 106b: the third source (the interface file, over a runner handed in) and the port of a job over the lifecycle.
export { hostAliasInterfaceFileSourceOf, interfaceFileNameOf } from './facts';
export { HostAliasJobRefusal, hostAliasJobPortOf, type HostAliasJobOutcome, type HostAliasJobPort, type HostAliasJobSubject } from './job-port';
export {
  HOST_ALIAS_INTENT_LABEL,
  HOST_ALIAS_RESULT_LABEL,
  HostAliasJournalRefusal,
  NEVER_ADDED_CLOSES_AS,
  createHostAliasJournal,
  type HostAliasActor,
  type HostAliasAuditEntry,
  type HostAliasHost,
  type HostAliasJournalDeps,
  type HostAliasJournalOfLifecycle,
  type HostAliasSubject,
  type HostAliasToken,
  type HostAliasUnit,
} from './journal';
export {
  HOST_ALIAS_READ_LABEL,
  HOST_ALIAS_REMOVE_RETRIES,
  HOST_ALIAS_REMOVE_RETRY_MS,
  HostAliasLifecycleRefusal,
  REFUSED_WHILE_A_SESSION_IS_OPEN,
  createHostAliasLifecycle,
  readHostAliasState,
  type HostAliasAcquireRequest,
  type HostAliasAcquired,
  type HostAliasLifecycle,
  type HostAliasLifecycleDeps,
  type HostAliasRecord,
  type HostAliasReleaseRequest,
  type HostAliasReleased,
  type HostAliasSweepReport,
  type HostAliasSwept,
} from './lifecycle';
export {
  CLOSE_HOST_ALIAS,
  HOST_ALIAS_WRITES,
  HostAliasReason,
  HostAliasRemoveReason,
  HostAliasRowError,
  NOTE_HOST_ALIAS_REMOVE_ERROR,
  OPEN_HOST_ALIAS,
  READ_OPEN_HOST_ALIASES,
  SET_HOST_ALIAS_EXPIRY,
  createHostAliasStore,
  type HostAliasOpening,
  type HostAliasQueryable,
  type HostAliasStore,
  type StoredHostAlias,
} from './store';
