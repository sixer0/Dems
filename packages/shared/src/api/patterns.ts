/**
 * Wire formats of the demo identifiers (01 G10: the design book fixes none, so the demo does).
 *
 * The simulator mints every one of them (`sim/dataset.ts` `sessionIdFor`, `caseNumberFor`,
 * `evidenceIdFor`; `sim/events.ts` `nextItemId`). These patterns are the contract the REST
 * schemas, the OpenAPI document and the session form validate against. Dates inside the IDs are
 * the sim clock's WIB (UTC+07:00) calendar day.
 */

/** `SES-{YYYYMMDD}-NNNN`, e.g. `SES-20261001-0024`. */
export const SESSION_ID_PATTERN = /^SES-\d{8}-\d{4}$/;

/** `EV-{YYYYMMDD}-NNNN`, e.g. `EV-20260930-0004`. The date is the session's creation day. */
export const EVIDENCE_ID_PATTERN = /^EV-\d{8}-\d{4}$/;

/** `OPR-NNN`, e.g. `OPR-001`. Never a username (12_sim_contract S31-3). */
export const OPERATOR_ID_PATTERN = /^OPR-\d{3}$/;

/** `EXP-NNNNNN`, e.g. `EXP-000042` (the sim's item counter). */
export const EXPORT_ID_PATTERN = /^EXP-\d{6}$/;

/**
 * Case reference `LP/{YYYY}/{MMDD}-NNNN`, e.g. `LP/2026/1001-0007` (book §11.3 field 5; the
 * "LP/" prefix is kept verbatim, D28/Q3). Month 01-12 and day 01-31 are checked; the rest of
 * the calendar is not.
 */
export const CASE_NUMBER_PATTERN = /^LP\/\d{4}\/(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])-\d{4}$/;

/** Machine-readable error codes: SCREAMING_SNAKE_CASE. */
export const API_ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;
