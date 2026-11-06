/**
 * The installation acceptance and its revocation: operations 109 and 110 of the Core API (task 4,
 * blueprint row 116, package WP-26b; design `masterplan/03_db_schema_extension.md` section 2.6 and
 * `masterplan/04_design_addendum.md` WP-26a / WP-26b; schema set C, table
 * `installation_acceptances`, record `implementation/114_schema_set_c.md`; decisions U10, U11
 * (OQ-2), C2, C61; security finding S13-13).
 *
 * | # | operationId | Access | Audit on success |
 * |--:|-------------|--------|------------------|
 * | 109 | `acceptInstallation` | CAPTURE_COMMISSION + WEB_CONSOLE_SESSION | INSTALLATION_ACCEPTED |
 * | 110 | `revokeInstallationAcceptance` | CAPTURE_COMMISSION + WEB_CONSOLE_SESSION | INSTALLATION_ACCEPTANCE_REVOKED |
 *
 * THIS FILE IS THE CONTRACT ONLY. No Core route (blueprint row 117) and no screen (row 118) exists
 * yet. The in-app simulator answers both (`sim/api.ts`) with a refusal that says it keeps no
 * installation record; it changes nothing.
 *
 * WHAT AN ACCEPTANCE IS. The record that an installation was accepted: who accepted it and when,
 * the software version, a point-in-time copy of the site (the Core's id, name and room as they
 * were, and the site address, which has no other home), the steps that were checked and the
 * diagnostics run as it was. AT MOST ONE IS IN FORCE: the database refuses a second one until the
 * first is revoked, and it keeps every revoked one. What was accepted is never rewritten.
 *
 * WHO. The permission `CAPTURE_COMMISSION`, held by TECHNICIAN only (decision U10), on a web
 * console session only, and idle only (`409 CAPTURE_CONFIG_LOCKED` while a session is open).
 *
 * RECORDING IS NOT GATED ON AN ACCEPTANCE. A session starts whether or not an acceptance is in
 * force (design addendum section 10, item 6: "no gate"); a gate would be a new ruling.
 *
 * NO FREE JSON (S13-13). `steps` and `diagnostics` are documents, and this file is their CLOSED
 * KEY LIST in code: `INSTALLATION_ACCEPTANCE_STEP_KEYS`, `..._DIAGNOSTICS_KEYS`,
 * `..._DIAGNOSTICS_CHECK_KEYS`, `..._DIAGNOSTICS_PARAM_KEYS`. Every object of the two documents
 * is strict: a member outside its list is refused, so none of the 28 denied key names of an audit
 * detail can be sent (`code` is one of them: a step states its `detail`, never a `code`). The
 * bounds are the table's own, no looser and no stricter (`INSTALLATION_ACCEPTANCE_LIMITS`): at
 * most 32 steps, every text at most 200 characters on one line, `steps` at most 8,192 bytes and
 * `diagnostics` at most 16,384 bytes, both counted on the text form the database stores
 * (`installationDocumentBytes`). The database is the backstop behind this file.
 *
 * WHAT THE CLIENT SENDS, AND WHAT IT DOES NOT. The body of an acceptance names the steps and the
 * site address. Who, when, the software version, the copy of the site and the diagnostics are the
 * Core's own facts: no member exists for them.
 */
import { z } from 'zod';
import { AuditType, DiagnosticStatus, Permission } from '../sim/vocabulary';
import { CAPTURE_COMMISSION_ACCESS } from './capture-commissioning';
import { API_BASE_PATH } from './constants';
import { CORE_SERVER_ONLY, CoreApiMode, CoreApiTag, WEB_CONSOLE_ONLY_REASON, type CoreApiRegistryOperation } from './contract-model';
import { ERROR_EXAMPLES, EXAMPLE_INSTANT_MS, apiErrorExample, deniedExamples } from './example-parts';
import type { OperationExamples } from './examples';
import { INVALID_JSON, NOT_SIGNED_IN, SIM_V2_NOTE, notPermitted } from './operation-parts';
import { DIAGNOSTICS_RUN_ID_PATTERN, OPERATOR_ID_PATTERN } from './patterns';
import { epochMs } from './schema-parts';
import { apiText, isWellFormedText } from './text';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Bounds and key lists: the table's, read from migration 0024 and its test (set12, M12S-5, M12S-6)
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The bounds of `installation_acceptances` as the database holds them (schema set C; the CHECKs of the table). */
export const INSTALLATION_ACCEPTANCE_LIMITS = Object.freeze({
  /** `steps` is a list of 0 to this many flat objects (`installation_acceptances_steps_check`). */
  stepsMax: 32,
  /** `steps` in the database's text form, in bytes (`..._steps_bound_check`). */
  stepsMaxBytes: 8_192,
  /** `diagnostics` in the database's text form, in bytes (`..._diagnostics_bound_check`). */
  diagnosticsMaxBytes: 16_384,
  /** Every text of either document: 0 to this many characters, none a control character (one line). */
  textMax: 200,
  /** `software_version`: one line of 1 to this many characters. */
  softwareVersionMax: 64,
  /** `core_device_id`, `site_name`, `room`: one line of 1 to this many characters each. */
  siteTextMax: 200,
  /** `site_address`: 1 to this many characters; line breaks are allowed. */
  siteAddressMax: 500,
  /** `revoke_reason`: this many characters at least ... */
  revokeReasonMin: 5,
  /** ... and this many at most. */
  revokeReasonMax: 500,
} as const);

/** THE KEY LIST of one step. Exactly these members; `detail` is the step's own note, never a `code`. */
export const INSTALLATION_ACCEPTANCE_STEP_KEYS = ['id', 'result', 'detail'] as const;
/** The key list of a step of a record stored BEFORE the closed step list (row V6): read in an answer, never accepted in a request. */
export const INSTALLATION_ACCEPTANCE_LEGACY_STEP_KEYS = ['id', 'passed', 'detail'] as const;

/**
 * THE CLOSED STEP LIST OF AN INSTALLATION ACCEPTANCE (security review of row 119, caution R119-07;
 * decision C94 (h): "the step list comes from the CONTRACT, not from a screen").
 *
 * WHERE IT COMES FROM: the hardware acceptance package the installer runs,
 * `scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md`. Its result record (section 9.1) has "one
 * line per check, 27 lines, in the order of section 6", each with a result that is "exactly one of
 * PASS, FAIL, NOT RUN". THE LIST IS THOSE 27 CHECK IDS, `9A/H-01` to `9A/H-27`, each once, in the
 * order of the frame's run (section 6; the recording sheet of section 9.2). The frame's preparation
 * steps (`PREP-01` to `PREP-14`) and the helper's installation steps (`HI-01` to `HI-10`) have no
 * result line in that record and are NOT in the list; the table also holds at most 32 steps.
 *
 * A request names EVERY id of the list exactly ONCE: an id outside the list, a missing id, a
 * repeated id and an empty list are refused. A check that was not run is stated as `NOT_RUN` with
 * its reason, never left out.
 *
 * `INSTALLATION_ACCEPTANCE_STEP_LIST_VERSION` names this list. A changed list is a new version.
 * (The table has no column for it yet: a stored record states its steps by id, not the version.)
 */
export const INSTALLATION_ACCEPTANCE_STEP_LIST_VERSION = 1;
export const INSTALLATION_ACCEPTANCE_STEP_IDS = [
  '9A/H-27',
  '9A/H-01',
  '9A/H-02',
  '9A/H-24',
  '9A/H-03',
  '9A/H-04',
  '9A/H-16',
  '9A/H-05',
  '9A/H-25',
  '9A/H-06',
  '9A/H-07',
  '9A/H-08',
  '9A/H-12',
  '9A/H-13',
  '9A/H-15',
  '9A/H-14',
  '9A/H-10',
  '9A/H-23',
  '9A/H-17',
  '9A/H-21',
  '9A/H-09',
  '9A/H-26',
  '9A/H-18',
  '9A/H-20',
  '9A/H-22',
  '9A/H-11',
  '9A/H-19',
] as const;
export type InstallationAcceptanceStepId = (typeof INSTALLATION_ACCEPTANCE_STEP_IDS)[number];
/** The closed form of an id of the list: `9A/H-` and two digits. A form only: the list decides. */
export const INSTALLATION_ACCEPTANCE_CHECK_ID_PATTERN = /^9A\/H-\d{2}$/;

/** What each check of the list is, in the words of the frame's recording sheet (section 9.2). English fallback text of a screen; never sent in a request. */
export const INSTALLATION_ACCEPTANCE_STEP_TITLES: Readonly<Record<InstallationAcceptanceStepId, string>> = Object.freeze({
  '9A/H-27': 'No input-av installation on the host',
  '9A/H-01': 'Host profile, builds, wrong-path refusal',
  '9A/H-02': 'No child process outlives the Core',
  '9A/H-24': 'Leftovers after a kill',
  '9A/H-03': 'Durability level of the evidence disk',
  '9A/H-04': 'Missing prerequisite named at start',
  '9A/H-16': 'Production boot, session start refused',
  '9A/H-05': 'Address helper as installed',
  '9A/H-25': 'Conflict check of the helper',
  '9A/H-06': 'Temporary address lifetime',
  '9A/H-07': 'Card listing, re-plug',
  '9A/H-08': 'Shared capture, level',
  '9A/H-12': 'Camera search, typed address',
  '9A/H-13': 'Factory-address scan',
  '9A/H-15': 'Two cameras on one address',
  '9A/H-14': 'Set camera address',
  '9A/H-10': 'Connect flow, profiles',
  '9A/H-23': 'Camera password with special characters',
  '9A/H-17': 'S1 recorded, sealed, verified',
  '9A/H-21': 'Time to both ingests',
  '9A/H-09': 'H.265 readings from S1',
  '9A/H-26': 'Profile notice not raised',
  '9A/H-18': 'Clap offset, start and end',
  '9A/H-20': 'Playback, three clients',
  '9A/H-22': 'S2 camera absent at start',
  '9A/H-11': 'S3 link loss and return',
  '9A/H-19': 'S4 drift',
});

/** The result of one check: the frame's closed set ("exactly one of PASS, FAIL, NOT RUN"). */
export const InstallationAcceptanceStepResult = { PASS: 'PASS', FAIL: 'FAIL', NOT_RUN: 'NOT_RUN' } as const;
export type InstallationAcceptanceStepResult = (typeof InstallationAcceptanceStepResult)[keyof typeof InstallationAcceptanceStepResult];
/** THE KEY LIST of the diagnostics: the Core's diagnostics run as it is (`DiagnosticsRun`). */
export const INSTALLATION_ACCEPTANCE_DIAGNOSTICS_KEYS = ['id', 'startedAt', 'completedAt', 'checks'] as const;
/** THE KEY LIST of one check of the run (`DiagnosticCheck`). */
export const INSTALLATION_ACCEPTANCE_DIAGNOSTICS_CHECK_KEYS = ['id', 'label', 'status', 'detail', 'params', 'resolvesAt'] as const;
/**
 * THE KEY LIST of the `params` of a check: the values behind its `detail`, as the diagnostics of
 * the Core state them today (`sim/maintenance.ts`, `evaluateDiagnostic`). A test holds this list
 * equal to what that function can produce: a new diagnostics value is added HERE first.
 */
export const INSTALLATION_ACCEPTANCE_DIAGNOSTICS_PARAM_KEYS = [
  'rule',
  'cpuPercent',
  'cpuTempC',
  'storageState',
  'fanRpm',
  'linkUp',
  'linkSpeedMbps',
  'activePorts',
  'totalPorts',
  'tracks',
  'reason',
  'source',
  'offsetMs',
  'ntpServer',
  'securityState',
  'posture',
] as const;
export type InstallationAcceptanceDiagnosticsParamKey = (typeof INSTALLATION_ACCEPTANCE_DIAGNOSTICS_PARAM_KEYS)[number];

/** The id of a step of a record stored BEFORE the closed list: a CODE of 1 to 64 characters, e.g. `CAMERAS_ASSIGNED`. No request may carry one. */
export const INSTALLATION_ACCEPTANCE_STEP_ID_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
/** The id of an acceptance: the key of its row, a lower-case UUID the database makes. */
export const INSTALLATION_ACCEPTANCE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ═══════════════════════════════════════════════════════════════════════════════════════
// The text rule and the size rule of the two documents
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * True for a control character as the CHECKs of the table read it (`[[:cntrl:]]`): U+0000 to
 * U+001F and U+007F to U+009F - measured on PostgreSQL 18.4 (UTF8, ctype `C`), code point by code
 * point, by blueprint row 116. A line break, a tab and an escape are all here. AND the two
 * separators U+2028 and U+2029: a database whose ctype is a C-library locale classes them as
 * control characters and refuses them, a database of ctype `C` takes them. They are line breaks,
 * so the contract refuses them on every host: the ONE place where it is stricter than a database
 * of ctype `C`, by two code points, and nowhere looser than any.
 */
export function isInstallationControlCharacter(codePoint: number): boolean {
  return codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f) || codePoint === 0x2028 || codePoint === 0x2029;
}

/** True when no character of `value` is a control character: a text of one line. */
export function isInstallationSingleLine(value: string): boolean {
  for (const character of value) {
    if (isInstallationControlCharacter(character.codePointAt(0) ?? 0)) return false;
  }
  return true;
}

/** How many characters (code points, as the database counts them) `value` has. */
function characterCount(value: string): number {
  return Array.from(value).length;
}

/**
 * True for a text either document may hold: well formed, on one line, at most 200 characters
 * (code points). Exactly the text bound of the two `..._bound_check` constraints.
 */
export function isInstallationAcceptanceText(value: string): boolean {
  return isWellFormedText(value) && isInstallationSingleLine(value) && characterCount(value) <= INSTALLATION_ACCEPTANCE_LIMITS.textMax;
}

/**
 * A text made storable in either document: every control character, and every unpaired surrogate,
 * becomes ONE blank, and the result is cut to `max` characters (code points). For the Core's own
 * facts only (a diagnostics `detail` may quote a device name): what an operator typed is refused,
 * never rewritten. Idempotent.
 */
export function installationAcceptanceTextOf(value: string, max: number = INSTALLATION_ACCEPTANCE_LIMITS.textMax): string {
  let out = '';
  let kept = 0;
  for (const character of value) {
    if (kept >= max) break;
    const codePoint = character.codePointAt(0) ?? 0;
    const lone = codePoint >= 0xd800 && codePoint <= 0xdfff;
    out += lone || isInstallationControlCharacter(codePoint) ? ' ' : character;
    kept += 1;
  }
  return out;
}

/**
 * The bytes of a JSON string as the database prints it, in UTF-8: quotes, and its escapes for `"`,
 * `\` and the C0 characters. A plain loop: no encoder object is needed in any runtime.
 */
function jsonStringBytes(text: string): number {
  let bytes = 2;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint === 0x22 || codePoint === 0x5c) bytes += 2;
    else if (codePoint === 0x08 || codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0c || codePoint === 0x0d) bytes += 2;
    else if (codePoint < 0x20) bytes += 6;
    else bytes += codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/**
 * The bytes of a JSON number as the database prints it. The database never prints an exponent:
 * `1e+21` is stored and printed as a 1 with 21 zeros, `1e-7` as `0.0000001`. JavaScript writes an
 * exponent for a magnitude of 1e21 and above or below 1e-6, so those two forms are expanded.
 */
function jsonNumberBytes(value: number): number {
  const text = String(value);
  const at = text.indexOf('e');
  if (at < 0) return text.length;
  const mantissa = text.slice(0, at);
  const exponent = Number(text.slice(at + 1));
  const sign = mantissa.startsWith('-') ? 1 : 0;
  const digits = mantissa.replace('-', '').replace('.', '');
  const fraction = digits.length - 1;
  if (exponent >= 0) return sign + 1 + Math.max(exponent, fraction) + (fraction > exponent ? 1 : 0);
  return sign + 2 + (-exponent - 1) + digits.length;
}

/**
 * THE SIZE OF A DOCUMENT AS THE DATABASE COUNTS IT: the bytes of the text form `jsonb` prints -
 * one blank after every colon and every comma, about 2% more than `JSON.stringify`. It is what
 * `octet_length(steps::text)` and `octet_length(diagnostics::text)` of the two bound CHECKs
 * measure, so a document this function bounds is a document the table takes. A member whose value
 * is `undefined` is not sent and not counted. Not a number, text, boolean, null, list or object:
 * `Infinity`, so that the bound refuses it.
 */
export function installationDocumentBytes(value: unknown): number {
  if (value === null) return 4;
  if (typeof value === 'boolean') return value ? 4 : 5;
  if (typeof value === 'number') return Number.isFinite(value) ? jsonNumberBytes(value) : Number.POSITIVE_INFINITY;
  if (typeof value === 'string') return jsonStringBytes(value);
  if (Array.isArray(value)) {
    let bytes = 2;
    value.forEach((element, index) => {
      bytes += installationDocumentBytes(element) + (index === 0 ? 0 : 2);
    });
    return bytes;
  }
  if (typeof value === 'object') {
    let bytes = 2;
    let members = 0;
    for (const [key, member] of Object.entries(value)) {
      if (member === undefined) continue;
      bytes += jsonStringBytes(key) + 2 + installationDocumentBytes(member) + (members === 0 ? 0 : 2);
      members += 1;
    }
    return bytes;
  }
  return Number.POSITIVE_INFINITY;
}

/** Message of the one-line rule. It quotes no input. */
export const INSTALLATION_TEXT_RULE_MESSAGE = 'Text must be on one line: no line break and no control character.';
/** Message of the size rule of a document. It quotes no input. */
export const installationDocumentSizeMessage = (maxBytes: number): string => `The document is larger than ${String(maxBytes)} bytes.`;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Refusals
// ═══════════════════════════════════════════════════════════════════════════════════════

/** `details.reason` of the refusals of operations 109 and 110. No new error code: each is a reason on `409 INVALID_STATE`. */
export const InstallationAcceptanceReason = {
  /** An acceptance is in force: the database holds at most one (`installation_acceptances_in_force_key`, 23505). Revoke it first. */
  INSTALLATION_ACCEPTANCE_IN_FORCE: 'INSTALLATION_ACCEPTANCE_IN_FORCE',
  /** No acceptance is in force: there is nothing to revoke. The simulator's answer to every revocation. */
  INSTALLATION_ACCEPTANCE_NOT_IN_FORCE: 'INSTALLATION_ACCEPTANCE_NOT_IN_FORCE',
  /** The Core holds no completed diagnostics run: an acceptance records the run as it was, so one must have ended. */
  INSTALLATION_DIAGNOSTICS_NOT_COMPLETE: 'INSTALLATION_DIAGNOSTICS_NOT_COMPLETE',
  /** The Core's own diagnostics run does not fit the record: a value outside the key list, or more than 16,384 bytes. */
  INSTALLATION_DIAGNOSTICS_NOT_STORABLE: 'INSTALLATION_DIAGNOSTICS_NOT_STORABLE',
  /** The Core's id, name, room or software version does not fit the record: longer than its bound, or not on one line. */
  INSTALLATION_SITE_NOT_STORABLE: 'INSTALLATION_SITE_NOT_STORABLE',
  /** The in-app simulator keeps no installation record. Its answer to every acceptance of the right form. */
  INSTALLATION_ACCEPTANCE_NOT_AVAILABLE: 'INSTALLATION_ACCEPTANCE_NOT_AVAILABLE',
  /**
   * The clock of this Core reads EARLIER than the acceptance in force (caution R119-08, decision
   * C94 (i)): a revocation stamped now would stand before the acceptance it revokes. Operation
   * 110. Nothing is changed and no instant is bent; the answer names no value. Since row V6b
   * (decision C105 (5), cut by row R1b) OPERATION 109 answers it too: an acceptance stamped now
   * would stand before a stored instant of the installation record (the acceptance in force, or
   * the revocation of an earlier one). The same member, sentence and status.
   */
  INSTALLATION_CLOCK_BEHIND_RECORD: 'INSTALLATION_CLOCK_BEHIND_RECORD',
} as const;
export type InstallationAcceptanceReason = (typeof InstallationAcceptanceReason)[keyof typeof InstallationAcceptanceReason];

/** The sentence of each refusal reason: the `message` of the envelope. It never quotes a site text, a step or a reason an operator typed. */
export const INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES: Readonly<Record<InstallationAcceptanceReason, string>> = Object.freeze({
  [InstallationAcceptanceReason.INSTALLATION_ACCEPTANCE_IN_FORCE]: 'An installation acceptance is already in force. Revoke it first.',
  [InstallationAcceptanceReason.INSTALLATION_ACCEPTANCE_NOT_IN_FORCE]: 'No installation acceptance is in force.',
  [InstallationAcceptanceReason.INSTALLATION_DIAGNOSTICS_NOT_COMPLETE]: 'Run the diagnostics and wait until they end first.',
  [InstallationAcceptanceReason.INSTALLATION_DIAGNOSTICS_NOT_STORABLE]: 'The diagnostics of this Core cannot be stored with an acceptance.',
  [InstallationAcceptanceReason.INSTALLATION_SITE_NOT_STORABLE]: 'The name, the room or the version of this Core cannot be stored with an acceptance.',
  [InstallationAcceptanceReason.INSTALLATION_ACCEPTANCE_NOT_AVAILABLE]: 'An installation is accepted on a Core server only.',
  [InstallationAcceptanceReason.INSTALLATION_CLOCK_BEHIND_RECORD]: 'The clock of this Core is behind the installation acceptance. Correct the clock, then try again.',
});

/** Message of the rule "a check that failed or was not run states why". It quotes no input. */
export const INSTALLATION_STEP_REASON_RULE_MESSAGE = 'A check that failed or was not run needs a note that says why.';
/** Message of the rule "every check of the list exactly once". It quotes no input. */
export const INSTALLATION_STEP_LIST_RULE_MESSAGE = 'The steps must name every check of the acceptance list exactly once.';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════════════════

/** A text of either document: 0 to 200 characters on one line (the table's text bound). */
const documentText = () => apiText().max(INSTALLATION_ACCEPTANCE_LIMITS.textMax).refine(isInstallationSingleLine, { error: INSTALLATION_TEXT_RULE_MESSAGE });
/** One line of 1 to `max` characters: the form of the version and of the three copies of the site. */
const singleLine = (max: number) => apiText().min(1).max(max).refine(isInstallationSingleLine, { error: INSTALLATION_TEXT_RULE_MESSAGE });
/** A value of `params`: a text of the document, a number, a boolean or null. Never a list or a map (the fourth level is the last). */
const paramValue = () => z.union([documentText(), z.number(), z.boolean(), z.null()]).optional();

/**
 * One step of an acceptance: ONE CHECK OF THE CLOSED LIST with its result. A FLAT object of exactly
 * three members. A check that failed or was not run states why (the frame's record: "reason or
 * note: mandatory for FAIL and NOT RUN").
 */
export const InstallationAcceptanceStepSchema = z
  .strictObject({
    id: z.enum(INSTALLATION_ACCEPTANCE_STEP_IDS).describe('Which check of the hardware acceptance package: one id of the closed list, e.g. `9A/H-17`. An id outside the list is refused.'),
    result: z.enum(InstallationAcceptanceStepResult).describe('The result of the check: `PASS`, `FAIL` or `NOT_RUN`.'),
    detail: documentText().nullable().describe('A note of the check on one line, at most 200 characters; null for none. Required, and not blank, for `FAIL` and `NOT_RUN`. It is drawn as text only.'),
  })
  .refine((step) => step.result === InstallationAcceptanceStepResult.PASS || (step.detail !== null && step.detail.trim() !== ''), { error: INSTALLATION_STEP_REASON_RULE_MESSAGE })
  .describe('One step of an installation acceptance (task 4, schema set C; the closed list of row V6). Exactly `id`, `result`, `detail`: any other member is refused.');
export type InstallationAcceptanceStep = z.output<typeof InstallationAcceptanceStepSchema>;

/**
 * A step of a record that was stored BEFORE the closed list (the first contract: any id of the code
 * form, `passed` as the client said). It exists so that such a record can still be READ and
 * REVOKED; no request may carry it, and a reader shows it as "recorded before the acceptance list".
 */
export const InstallationAcceptanceLegacyStepSchema = z
  .strictObject({
    id: z.string().regex(INSTALLATION_ACCEPTANCE_STEP_ID_PATTERN).describe('A code of the first contract, e.g. `CAMERAS_ASSIGNED`. No check of the acceptance list.'),
    passed: z.boolean().describe('What the client of the first contract sent.'),
    detail: documentText().nullable(),
  })
  .describe('A step of an installation acceptance stored before the closed step list (task 4, row V6). Answer only: a request with this form is refused.');
export type InstallationAcceptanceLegacyStep = z.output<typeof InstallationAcceptanceLegacyStepSchema>;

const stepsBound = (value: unknown): boolean => installationDocumentBytes(value) <= INSTALLATION_ACCEPTANCE_LIMITS.stepsMaxBytes;

/** True when `ids` are the ids of the closed list, each exactly once (in any order). */
export function isInstallationAcceptanceStepList(ids: readonly string[]): boolean {
  return ids.length === INSTALLATION_ACCEPTANCE_STEP_IDS.length && INSTALLATION_ACCEPTANCE_STEP_IDS.every((id) => ids.indexOf(id) >= 0 && ids.indexOf(id) === ids.lastIndexOf(id));
}

/** The `steps` of a REQUEST: every check of the closed list exactly once, at most 8,192 bytes in the database's text form. */
const requestSteps = () =>
  z
    .array(InstallationAcceptanceStepSchema)
    .max(INSTALLATION_ACCEPTANCE_LIMITS.stepsMax)
    .refine((value) => isInstallationAcceptanceStepList(value.map((step) => step.id)), { error: INSTALLATION_STEP_LIST_RULE_MESSAGE })
    .refine(stepsBound, { error: installationDocumentSizeMessage(INSTALLATION_ACCEPTANCE_LIMITS.stepsMaxBytes) })
    .describe(`The checks of the hardware acceptance package with their results: EVERY id of the closed list (${String(INSTALLATION_ACCEPTANCE_STEP_IDS.length)} checks, list version ${String(INSTALLATION_ACCEPTANCE_STEP_LIST_VERSION)}) exactly once - an unknown, a missing or a repeated id and an empty list are refused; at most 8,192 bytes together as the database stores them.`);

/** The `steps` of a stored record as it is answered: the steps of the closed list, or - for a record stored before the list - the steps of the first contract. */
const storedSteps = () =>
  z
    .array(z.union([InstallationAcceptanceStepSchema, InstallationAcceptanceLegacyStepSchema]))
    .max(INSTALLATION_ACCEPTANCE_LIMITS.stepsMax)
    .refine(stepsBound, { error: installationDocumentSizeMessage(INSTALLATION_ACCEPTANCE_LIMITS.stepsMaxBytes) })
    .describe('The steps as they were stored: the checks of the closed list with their results; a record stored before the list holds the steps of the first contract (`passed`), which name no check of the list.');

/** The values behind a check's `detail`: a flat object of the closed key list `INSTALLATION_ACCEPTANCE_DIAGNOSTICS_PARAM_KEYS`. */
const InstallationAcceptanceDiagnosticsParamsSchema = z.strictObject({
  rule: paramValue(),
  cpuPercent: paramValue(),
  cpuTempC: paramValue(),
  storageState: paramValue(),
  fanRpm: paramValue(),
  linkUp: paramValue(),
  linkSpeedMbps: paramValue(),
  activePorts: paramValue(),
  totalPorts: paramValue(),
  tracks: paramValue(),
  reason: paramValue(),
  source: paramValue(),
  offsetMs: paramValue(),
  ntpServer: paramValue(),
  securityState: paramValue(),
  posture: paramValue(),
} satisfies Record<InstallationAcceptanceDiagnosticsParamKey, unknown>);

/**
 * The diagnostics of an acceptance: the Core's diagnostics run as it was, four levels and no
 * deeper (the run, its checks, a check, the flat `params` of a check). Never sent by a client.
 */
export const InstallationAcceptanceDiagnosticsSchema = z
  .strictObject({
    id: z.string().max(INSTALLATION_ACCEPTANCE_LIMITS.textMax).regex(DIAGNOSTICS_RUN_ID_PATTERN).describe('The run, `DIAG-NNNNNN`.'),
    startedAt: epochMs(),
    completedAt: epochMs().describe('When the run ended. An acceptance records a run that has ended.'),
    checks: z.array(
      z.strictObject({
        id: documentText().min(1),
        label: documentText(),
        status: z.enum(DiagnosticStatus),
        detail: documentText().nullable().describe('The English fallback text of the result. It may quote a device name: drawn as text only.'),
        params: InstallationAcceptanceDiagnosticsParamsSchema.optional().describe('The values behind `detail`: a flat object of a closed key list.'),
        resolvesAt: epochMs().nullable().optional(),
      }),
    ),
  })
  .refine((value) => installationDocumentBytes(value) <= INSTALLATION_ACCEPTANCE_LIMITS.diagnosticsMaxBytes, { error: installationDocumentSizeMessage(INSTALLATION_ACCEPTANCE_LIMITS.diagnosticsMaxBytes) })
  .describe('The diagnostics run of the Core as it was when the installation was accepted (task 4, schema set C). A closed key list at every level; at most 16,384 bytes as the database stores it; every text at most 200 characters on one line.');
export type InstallationAcceptanceDiagnostics = z.output<typeof InstallationAcceptanceDiagnosticsSchema>;

/** One row of `installation_acceptances` as operations 109 and 110 answer it. */
export const InstallationAcceptanceSchema = z
  .strictObject({
    acceptanceId: z.string().regex(INSTALLATION_ACCEPTANCE_ID_PATTERN),
    acceptedAt: epochMs(),
    acceptedBy: z.string().regex(OPERATOR_ID_PATTERN).describe('Who accepted: the operator of the session that sent the acceptance.'),
    softwareVersion: singleLine(INSTALLATION_ACCEPTANCE_LIMITS.softwareVersionMax).describe('The software version of the Core at acceptance.'),
    coreDeviceId: singleLine(INSTALLATION_ACCEPTANCE_LIMITS.siteTextMax).describe('The id of the Core as it was at acceptance. A copy: a later change does not change it.'),
    siteName: singleLine(INSTALLATION_ACCEPTANCE_LIMITS.siteTextMax).describe('The name of the Core as it was at acceptance.'),
    room: singleLine(INSTALLATION_ACCEPTANCE_LIMITS.siteTextMax).describe('The room of the Core as it was at acceptance.'),
    siteAddress: apiText().min(1).max(INSTALLATION_ACCEPTANCE_LIMITS.siteAddressMax).nullable().describe('The address of the site as the operator typed it; null for none. It may have several lines. Drawn as text only.'),
    steps: storedSteps(),
    diagnostics: InstallationAcceptanceDiagnosticsSchema,
    revokedAt: epochMs().nullable().describe('When the acceptance was revoked; null while it is in force.'),
    revokedBy: z.string().regex(OPERATOR_ID_PATTERN).nullable().describe('Who revoked it; null while it is in force.'),
    revokeReason: apiText().min(INSTALLATION_ACCEPTANCE_LIMITS.revokeReasonMin).max(INSTALLATION_ACCEPTANCE_LIMITS.revokeReasonMax).nullable().describe('Why it was revoked, as the operator typed it; null while it is in force. Drawn as text only.'),
  })
  .describe('An installation acceptance (task 4, operations 109 and 110; schema set C). In force while `revokedAt` is null; at most one is. It holds no credential.');
export type InstallationAcceptance = z.output<typeof InstallationAcceptanceSchema>;

/** Request body of operation 109: the steps and the site address. Everything else is the Core's own fact. */
export const InstallationAcceptRequestSchema = z
  .strictObject({
    siteAddress: apiText().min(1).max(INSTALLATION_ACCEPTANCE_LIMITS.siteAddressMax).nullable().optional().describe('The address of the site, 1 to 500 characters; line breaks are allowed. Absent or null: none is recorded.'),
    steps: requestSteps(),
  })
  .describe('Request body of `POST /api/v1/installation/acceptance` (task 4, operation 109). No member exists for who accepts, when, the version, the name or room of the Core, or the diagnostics: the Core states those itself.');
export type InstallationAcceptRequest = z.output<typeof InstallationAcceptRequestSchema>;

/** Request body of operation 110: why. The Core names the acceptance from its own state, never from a request. */
export const InstallationAcceptanceRevokeRequestSchema = z
  .strictObject({
    reason: apiText()
      .overwrite((value) => value.trim())
      .min(INSTALLATION_ACCEPTANCE_LIMITS.revokeReasonMin)
      .max(INSTALLATION_ACCEPTANCE_LIMITS.revokeReasonMax)
      .describe('Why the acceptance is revoked: 5 to 500 characters after trimming, e.g. that the Core was moved to another room.'),
  })
  .describe('Request body of `POST /api/v1/installation/acceptance/revoke` (task 4, operation 110). No id: the one acceptance in force is revoked.');
export type InstallationAcceptanceRevokeRequest = z.output<typeof InstallationAcceptanceRevokeRequestSchema>;

/** The schemas operations 109 and 110 add (merged into `CORE_API_SCHEMAS`). */
export const INSTALLATION_ACCEPTANCE_SCHEMAS = {
  InstallationAcceptanceStep: InstallationAcceptanceStepSchema,
  InstallationAcceptanceDiagnostics: InstallationAcceptanceDiagnosticsSchema,
  InstallationAcceptance: InstallationAcceptanceSchema,
  InstallationAcceptRequest: InstallationAcceptRequestSchema,
  InstallationAcceptanceRevokeRequest: InstallationAcceptanceRevokeRequestSchema,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations
// ═══════════════════════════════════════════════════════════════════════════════════════

export const INSTALLATION_ACCEPTANCE_PATH = `${API_BASE_PATH}/installation/acceptance`;
export const INSTALLATION_ACCEPTANCE_REVOKE_PATH = `${INSTALLATION_ACCEPTANCE_PATH}/revoke`;

const DENIED = { denial: AuditType.ACCESS_DENIED } as const;
const R = InstallationAcceptanceReason;
const L = INSTALLATION_ACCEPTANCE_LIMITS;

const WEB_ONLY_REFUSED = `the operator's session is bound to a paired tablet or phone (NOT_PERMITTED, \`details.reason: ${WEB_CONSOLE_ONLY_REASON}\`; one ACCESS_DENIED audit row; refused before the body is used)`;
const WHO = '**TECHNICIAN only, web console only.** Needs CAPTURE_COMMISSION, which the TECHNICIAN role alone holds, and a web console session (`WEB_CONSOLE_SESSION`): a session of a tablet or a phone is refused `403 NOT_PERMITTED` with `details.reason: WEB_CONSOLE_ONLY` and one ACCESS_DENIED row.';
const IDLE = '**Idle only.** With a session open it answers `409 CAPTURE_CONFIG_LOCKED` and writes no audit row.';
const NOT_GATED = '**Recording is not gated on an acceptance.** A session starts whether or not an acceptance is in force, and a revocation stops nothing: the acceptance is a record, not a switch.';
const refusedText = (text: string) => ({ description: text, schema: 'ApiError' }) as const;
const LOCKED_TEXT = 'A session is open (CAPTURE_CONFIG_LOCKED; no audit row)';
const SOURCE = (number: number, what: string): string =>
  `Task 4, blueprint row 116 (WP-26b), operation ${String(number)}: ${what}; schema set C (\`installation_acceptances\`); decisions U10, U11, C2; security finding S13-13 (not in the design book)`;

export const INSTALLATION_ACCEPTANCE_OPERATIONS = [
  {
    operationId: 'acceptInstallation',
    method: 'post',
    path: INSTALLATION_ACCEPTANCE_PATH,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Accept the installation',
    description: [
      'Records that the installation of this Core was accepted. The body names the steps that were checked and, if there is one, the address of the site. **Everything else is the Core\'s own fact and cannot be sent**: who accepted (the operator of the session) and when, the software version, a copy of the Core\'s id, name and room as they are now, and the newest diagnostics run as it is. The answer is the stored record.',
      WHO,
      IDLE,
      NOT_GATED,
      `**At most one acceptance is in force**, and the database holds that: while one is in force this operation answers \`409 INVALID_STATE\` with \`details.reason: ${R.INSTALLATION_ACCEPTANCE_IN_FORCE}\`, also when two requests arrive at the same moment. Revoke it first (operation 110). What was accepted is never rewritten and never removed. When the clock of the Core reads earlier than an instant the installation record already holds (the acceptance in force, or the revocation of an earlier one): \`${R.INSTALLATION_CLOCK_BEHIND_RECORD}\`, nothing is stored and no instant is bent.`,
      `**The step list is the contract's, not a screen's.** The steps are the ${String(INSTALLATION_ACCEPTANCE_STEP_IDS.length)} checks of the hardware acceptance package (\`9A/H-01\` to \`9A/H-27\`; list version ${String(INSTALLATION_ACCEPTANCE_STEP_LIST_VERSION)}), each with a result of the closed set \`PASS\`, \`FAIL\`, \`NOT_RUN\`. The body names EVERY check exactly once: an id outside the list, a missing id, a repeated id and an empty list are refused \`422\`, and so is a \`FAIL\` or a \`NOT_RUN\` without a note that says why. A check that was not run is stated, never left out.`,
      `**No free JSON.** A step is exactly \`id\` (a check of the list), \`result\` and \`detail\` (a note on one line, or null); any other member is refused \`422\`. At most ${String(L.stepsMax)} steps; every text at most ${String(L.textMax)} characters with no line break and no control character; the steps together at most ${String(L.stepsMaxBytes)} bytes as the database stores them (one blank after every colon and comma). The size and the one-line rule are refinements a JSON Schema cannot state: the Core applies them. The refusal never quotes the input.`,
      `**The diagnostics are read, not sent.** The Core copies its newest diagnostics run. With no run, or a run that has not ended: \`409 INVALID_STATE\` with \`details.reason: ${R.INSTALLATION_DIAGNOSTICS_NOT_COMPLETE}\`. A run with a failed check is recorded as it is: the acceptance is the operator's statement, and the record shows what the Core reported. Device text inside the run is made one line and cut to ${String(L.textMax)} characters before it is stored. A run that still does not fit the record (a value outside the closed key list, or more than ${String(L.diagnosticsMaxBytes)} bytes) answers \`${R.INSTALLATION_DIAGNOSTICS_NOT_STORABLE}\`; an id, name, room or version of the Core that does not fit (longer than its bound, or not on one line) answers \`${R.INSTALLATION_SITE_NOT_STORABLE}\`. Nothing is stored in either case.`,
      'On success writes one INSTALLATION_ACCEPTED row whose details are `acceptanceId`, `stepCount` and `passedCount` (the checks whose result is `PASS`): the record id and counts only, never a step, a site text or the diagnostics.',
      `${SIM_V2_NOTE} The simulator keeps no installation record: a body of the right form answers \`409 INVALID_STATE\` with \`details.reason: ${R.INSTALLATION_ACCEPTANCE_NOT_AVAILABLE}\`. It stores nothing, writes no audit row and changes no state.`,
    ].join('\n\n'),
    source: SOURCE(109, 'the acceptance of the installation'),
    requestBody: { schema: 'InstallationAcceptRequest', required: true },
    responses: {
      200: { description: 'The acceptance as it is stored. It is in force.', schema: 'InstallationAcceptance', services: CORE_SERVER_ONLY },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.CAPTURE_COMMISSION, WEB_ONLY_REFUSED),
      409: refusedText(
        `${LOCKED_TEXT}, or nothing can be accepted (INVALID_STATE, \`details.reason\`: ${R.INSTALLATION_ACCEPTANCE_IN_FORCE}, ${R.INSTALLATION_DIAGNOSTICS_NOT_COMPLETE}, ${R.INSTALLATION_DIAGNOSTICS_NOT_STORABLE}, ${R.INSTALLATION_SITE_NOT_STORABLE}, ${R.INSTALLATION_ACCEPTANCE_NOT_AVAILABLE} or ${R.INSTALLATION_CLOCK_BEHIND_RECORD}). Nothing is stored.`,
      ),
      422: refusedText('The body does not match its schema: a step that is no check of the closed list, a check that is missing or named twice, a result outside its set, a failed or not-run check without a note, a member outside the key list, a text that is too long or not on one line, or steps that are larger than 8,192 bytes together (INVALID_INPUT). The refusal never quotes the input. Nothing is stored.'),
    },
    access: CAPTURE_COMMISSION_ACCESS,
    audit: { success: AuditType.INSTALLATION_ACCEPTED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'revokeInstallationAcceptance',
    method: 'post',
    path: INSTALLATION_ACCEPTANCE_REVOKE_PATH,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Revoke the installation acceptance',
    description: [
      `Revokes the installation acceptance that is in force, with a reason of ${String(L.revokeReasonMin)} to ${String(L.revokeReasonMax)} characters (for example that the Core was moved to another room). **The body holds no id**: the Core names the one acceptance in force from its own state. The record stays, with who revoked it, when and why; the next acceptance can then be recorded (operation 109). The answer is the revoked record.`,
      WHO,
      IDLE,
      NOT_GATED,
      `With none in force it answers \`409 INVALID_STATE\` with \`details.reason: ${R.INSTALLATION_ACCEPTANCE_NOT_IN_FORCE}\` and writes no audit row. When the clock of the Core reads earlier than the acceptance it would revoke: \`${R.INSTALLATION_CLOCK_BEHIND_RECORD}\`, nothing changed, no value named.`,
      'On success writes one INSTALLATION_ACCEPTANCE_REVOKED row whose details are `acceptanceId` only: the typed reason stays in the record and is never copied into the audit row.',
      `${SIM_V2_NOTE} The simulator never holds an acceptance: a body of the right form answers \`409 INVALID_STATE\` with \`details.reason: ${R.INSTALLATION_ACCEPTANCE_NOT_IN_FORCE}\`. It stores nothing, writes no audit row and changes no state.`,
    ].join('\n\n'),
    source: SOURCE(110, 'the revocation of the acceptance in force'),
    requestBody: { schema: 'InstallationAcceptanceRevokeRequest', required: true },
    responses: {
      200: { description: 'The acceptance after the revocation: `revokedAt`, `revokedBy` and `revokeReason` are set.', schema: 'InstallationAcceptance', services: CORE_SERVER_ONLY },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.CAPTURE_COMMISSION, WEB_ONLY_REFUSED),
      409: refusedText(`${LOCKED_TEXT}, no acceptance is in force (INVALID_STATE, \`details.reason: ${R.INSTALLATION_ACCEPTANCE_NOT_IN_FORCE}\`), or the clock of the Core is behind the acceptance (\`${R.INSTALLATION_CLOCK_BEHIND_RECORD}\`). Nothing is changed.`),
      422: refusedText('The body does not match its schema: no reason, a reason outside 5 to 500 characters, or another member (INVALID_INPUT). The refusal never quotes the input. Nothing is changed.'),
    },
    access: CAPTURE_COMMISSION_ACCESS,
    audit: { success: AuditType.INSTALLATION_ACCEPTANCE_REVOKED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════════════════════════════

const SIGNED_OUT = { notSignedIn: ERROR_EXAMPLES.notSignedIn } as const;
const refusal = (summary: string, code: string, message: string, details?: Record<string, string>) => ({ summary, value: apiErrorExample(code, message, details) });
const reasoned = (summary: string, reason: InstallationAcceptanceReason) => refusal(summary, 'INVALID_STATE', INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES[reason], { reason });
const LOCKED = refusal('A session is open', 'CAPTURE_CONFIG_LOCKED', 'The capture configuration cannot be changed while a session is open.', { simCode: 'CAPTURE_CONFIG_LOCKED' });
/** `403` of both operations: a SUPERVISOR does not hold the permission; a TECHNICIAN on a tablet does. */
const denied = (operationId: string) => ({
  ...deniedExamples(operationId, Permission.CAPTURE_COMMISSION, 'SUPERVISOR'),
  webConsoleOnly: {
    summary: 'A tablet or phone session on a web-console-only operation',
    description: 'The caller holds CAPTURE_COMMISSION, but the session is bound to a paired device. One ACCESS_DENIED row is written; the body is not used.',
    value: apiErrorExample('NOT_PERMITTED', 'Your role does not allow this action. The attempt was audited.', {
      operationId,
      permission: Permission.CAPTURE_COMMISSION,
      role: 'TECHNICIAN',
      reason: WEB_CONSOLE_ONLY_REASON,
    }),
  },
});

/** Every check of the closed list once: all passed, but the long session, which was not run and says why. */
const EXAMPLE_STEPS: InstallationAcceptanceStep[] = INSTALLATION_ACCEPTANCE_STEP_IDS.map((id) =>
  id === '9A/H-19'
    ? { id, result: InstallationAcceptanceStepResult.NOT_RUN, detail: 'The long session is planned for the next visit.' }
    : { id, result: InstallationAcceptanceStepResult.PASS, detail: id === '9A/H-17' ? 'Both cameras and both microphones were checked in the recording.' : null },
);
const EXAMPLE_DIAGNOSTICS = {
  id: 'DIAG-000001',
  startedAt: EXAMPLE_INSTANT_MS - 60_000,
  completedAt: EXAMPLE_INSTANT_MS - 30_000,
  checks: [
    { id: 'CPU', label: 'CPU and memory', status: DiagnosticStatus.PASS, detail: 'CPU 12%, 48.5 °C', params: { cpuPercent: 12, cpuTempC: 48.5 } },
    { id: 'CAMERA', label: 'Cameras', status: DiagnosticStatus.PASS, detail: 'Both lenses READY', params: { tracks: '' } },
  ],
} satisfies InstallationAcceptanceDiagnostics;
const EXAMPLE_ACCEPTANCE = {
  acceptanceId: '00000000-0000-4000-8000-0000000000c1',
  acceptedAt: EXAMPLE_INSTANT_MS,
  acceptedBy: 'OPR-003',
  softwareVersion: '0.6.0',
  coreDeviceId: 'DEMS-IR-01',
  siteName: 'Interview room 1',
  room: 'IR-01',
  siteAddress: 'Example street 1\nExample city',
  steps: EXAMPLE_STEPS,
  diagnostics: EXAMPLE_DIAGNOSTICS,
  revokedAt: null,
  revokedBy: null,
  revokeReason: null,
} satisfies InstallationAcceptance;
const EXAMPLE_REVOKE_REASON = 'The Core was moved to another room.';

export const INSTALLATION_ACCEPTANCE_EXAMPLES: Readonly<Record<string, OperationExamples>> = {
  acceptInstallation: {
    request: {
      accepted: { summary: 'Every check of the list with its result, and the address of the site', value: { siteAddress: EXAMPLE_ACCEPTANCE.siteAddress, steps: EXAMPLE_STEPS } satisfies InstallationAcceptRequest },
      noAddress: { summary: 'The steps only', value: { steps: EXAMPLE_STEPS } satisfies InstallationAcceptRequest },
    },
    responses: {
      200: { accepted: { summary: 'The acceptance, in force', description: 'Only the Core server answers this: the in-app simulator keeps no installation record.', value: EXAMPLE_ACCEPTANCE } },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: SIGNED_OUT,
      403: denied('acceptInstallation'),
      409: {
        locked: LOCKED,
        inForce: reasoned('An acceptance is already in force', R.INSTALLATION_ACCEPTANCE_IN_FORCE),
        diagnosticsNotComplete: reasoned('No diagnostics run has ended yet', R.INSTALLATION_DIAGNOSTICS_NOT_COMPLETE),
        notAvailable: reasoned('The in-app simulator keeps no installation record (its answer)', R.INSTALLATION_ACCEPTANCE_NOT_AVAILABLE),
        clockBehind: reasoned('The clock of the Core is behind the stored record', R.INSTALLATION_CLOCK_BEHIND_RECORD),
      },
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
  revokeInstallationAcceptance: {
    request: {
      moved: { summary: 'The Core was moved', value: { reason: EXAMPLE_REVOKE_REASON } satisfies InstallationAcceptanceRevokeRequest },
    },
    responses: {
      200: {
        revoked: {
          summary: 'The acceptance, revoked',
          description: 'Only the Core server answers this: the in-app simulator never holds an acceptance.',
          value: { ...EXAMPLE_ACCEPTANCE, revokedAt: EXAMPLE_INSTANT_MS + 5_000, revokedBy: 'OPR-003', revokeReason: EXAMPLE_REVOKE_REASON } satisfies InstallationAcceptance,
        },
      },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: SIGNED_OUT,
      403: denied('revokeInstallationAcceptance'),
      409: {
        locked: LOCKED,
        notInForce: reasoned('No acceptance is in force (the simulator\'s answer)', R.INSTALLATION_ACCEPTANCE_NOT_IN_FORCE),
        clockBehind: reasoned('The clock of the Core is behind the acceptance in force', R.INSTALLATION_CLOCK_BEHIND_RECORD),
      },
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
};
