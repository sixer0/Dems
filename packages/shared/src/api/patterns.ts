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

// ── Core server identifiers (backend task: 2026-10-04 01_specs §5.1, §6.1; 03_database_contract §4.7, §4.8) ──
// Minted by the Core server only; the simulator has none of them.

/** Paired device `DEV-NNNN`, e.g. `DEV-0001` (PR-P9). The counter survives a demo reset, so an ID is never minted twice. */
export const DEVICE_ID_PATTERN = /^DEV-\d{4,}$/;

/** Pairing code record `PCD-NNNNNN`, e.g. `PCD-000001`. It names a code in audit rows and the registry; it is not the code. */
export const PAIRING_CODE_ID_PATTERN = /^PCD-\d{6,}$/;

/** The pairing code itself: six decimal digits (PR-P1). Returned once by `issuePairingCode`, typed into the app. */
export const PAIRING_CODE_PATTERN = /^\d{6}$/;

/** QR payload of a pairing code: `DEMS-PAIR:1:` and the code (PR-P7). Not a URL: a code must not appear in one. */
export const PAIRING_QR_PAYLOAD_PATTERN = /^DEMS-PAIR:1:\d{6}$/;

/**
 * The three bearer secrets: a prefix and 43 base64url characters (32 random bytes; ID-P6, PR-P8,
 * §5.6). The server stores only their SHA-256. `ses_` and `dvc_` travel in `Authorization: Bearer`;
 * `bio_` travels in a request body only. None of them ever appears in a URL, a log or an audit row.
 */
export const SESSION_TOKEN_PATTERN = /^ses_[A-Za-z0-9_-]{43}$/;
export const DEVICE_CREDENTIAL_PATTERN = /^dvc_[A-Za-z0-9_-]{43}$/;
export const BIOMETRIC_TOKEN_PATTERN = /^bio_[A-Za-z0-9_-]{43}$/;

// Contract close-out W83 (gap 4, gap W32-4): the literal head of each of the three
// patterns above, so that a guard which must refuse a secret in a URL (CL-6a) and the server's
// token builders read one list. test/api-closeout.test.ts holds each prefix to its pattern.
/** Prefix of a session token (`SESSION_TOKEN_PATTERN`). */
export const SESSION_TOKEN_PREFIX = 'ses_';
/** Prefix of a device credential (`DEVICE_CREDENTIAL_PATTERN`, PR-P8). */
export const DEVICE_CREDENTIAL_PREFIX = 'dvc_';
/** Prefix of a biometric token (`BIOMETRIC_TOKEN_PATTERN`). */
export const BIOMETRIC_TOKEN_PREFIX = 'bio_';
/** The prefixes of every bearer secret of the contract. A value that starts with one never travels in a URL. */
export const BEARER_SECRET_PREFIXES = [SESSION_TOKEN_PREFIX, DEVICE_CREDENTIAL_PREFIX, BIOMETRIC_TOKEN_PREFIX] as const;

// ── Hashes on the wire (backend task: 2026-10-04 01_specs §8.3 ENG-9; `sim/events.ts`, `sim/evidence.ts`) ──

/**
 * A SHA-256 as the simulator writes it: 64 lower-case hexadecimal digits. The audit chain
 * (`prevHash`, `hash`, the head; the genesis value is 64 zeros), the track hashes, the manifest hash
 * and the simulated signature of an evidence item all have this form.
 */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

// ── Identifiers of the domain operations (backend task: 2026-10-04 01_specs §7.8 to §7.15) ──

/**
 * A device of the Core itself, as the simulator names it: `CAM-01`, `MIC-02`, `POE-SWITCH`, and the
 * platform devices `GNSS`, `TPM`, `FRONT-PANEL` (01_specs §7.10). Not a paired device (`DEV-NNNN`).
 */
export const HARDWARE_DEVICE_ID_PATTERN = /^[A-Z][A-Z0-9-]{0,31}$/;

/** Alert `ALR-NNNNNN`, e.g. `ALR-000042` (the simulator's item counter). */
export const ALERT_ID_PATTERN = /^ALR-\d{6,}$/;

/** Diagnostics run `DIAG-NNNNNN`, e.g. `DIAG-000043` (the simulator's item counter). */
export const DIAGNOSTICS_RUN_ID_PATTERN = /^DIAG-\d{6,}$/;

/**
 * The join key of a demo evidence package: the four digits at the end of an evidence ID, e.g.
 * `0004` for `EV-20260930-0004` (`@dems/shared/demo-data` `demoIdSuffix`; 01_specs §11 MS-2).
 */
export const DEMO_PACKAGE_SUFFIX_PATTERN = /^\d{4}$/;

/**
 * The cursor of a list read (API-9): opaque to a client, 1 to 128 letters, digits or hyphens. It
 * has no underscore, so no bearer value fits (`ses_…`, `dvc_…`, `bio_…`) and a cursor can never be
 * mistaken for a credential in a URL (CL-6a). A sequence number, or a time and an identifier
 * joined by hyphens, both fit. So does a row's identifier with a mark of that row
 * (`AUD-000150-9f86d081884c7d65`, `LOG-000150-1790823600000`), the form of the audit list and of
 * the events (W83, gap W39-3).
 */
export const LIST_CURSOR_PATTERN = /^[A-Za-z0-9-]{1,128}$/;
