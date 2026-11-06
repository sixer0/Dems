/**
 * The line protocol of the address helper, as the Core speaks it (task 4 row 105, WP-19b; decision
 * C19; `decisions/103_helper_privilege_form.md` PF-3, PF-4; the helper as delivered:
 * `scripts/host/netalias/dems-core-netalias`, record 104).
 *
 *   request   ONE line of at most 64 bytes: `add <a.b.c.d>/24 <minutes>` or `del <a.b.c.d>/24`.
 *             The interface is never in it: the helper reads it from its own root-owned file.
 *   answer    ONE line `<code> <NAME>`, then the helper closes the connection. The pairs are a
 *             closed set of 41 (`HELPER_CODES`, a copy of the helper's own table `CODES`).
 *
 * NOTHING FREE-FORM. A request line is made HERE, from four integers 0 to 255 and one integer of
 * minutes, and from nothing else: no text of an operator, of the database or of a device is ever
 * joined into it. An answer is accepted only when it is byte for byte one pair of the table;
 * whatever else arrived is dropped where it was read and becomes one fixed word.
 *
 * This file is pure: it imports nothing, opens nothing, reads no clock and logs nothing.
 */

// ── The helper's closed set of answers ─────────────────────────────────────────────────────────

/**
 * The helper's table `CODES`, name by name and number by number (41 entries: the 36 of record 104
 * and the five of the helper's R119 fixes, `implementation/h2_helper_r119_fixes.md` - 38, 46, 47,
 * 48, 55, all answered by `add` BEFORE an address is set, so nothing was changed).
 */
export const HELPER_CODES = Object.freeze({
  OK: 0,
  // the call itself
  ARGUMENTS: 10,
  PEER_UNKNOWN: 11,
  PEER_NOT_SERVICE_USER: 12,
  REQUEST_TOO_LONG: 13,
  REQUEST_MALFORMED: 14,
  VERB_UNKNOWN: 15,
  REQUEST_TIMEOUT: 16,
  // the address
  ADDRESS_MALFORMED: 20,
  PREFIX_NOT_24: 21,
  ADDRESS_LOOPBACK: 22,
  ADDRESS_LINK_LOCAL: 23,
  ADDRESS_MULTICAST: 24,
  ADDRESS_NOT_PRIVATE: 25,
  HOST_PART_OUT_OF_RANGE: 26,
  LIFETIME_OUT_OF_RANGE: 27,
  // the installation
  SERVICE_USER_UNRESOLVED: 30,
  INTERFACE_FILE_UNSAFE: 31,
  INTERFACE_NAME_INVALID: 32,
  INTERFACE_ABSENT: 33,
  INTERFACE_HAS_DEFAULT_ROUTE: 34,
  STATE_DIR_UNSAFE: 35,
  TOOL_MISSING: 36,
  CONFLICT_TOOL_MISSING: 37,
  CONFLICT_TOOL_NOT_EXPECTED: 38,
  // the host's state
  OTHER_INTERFACE_HOLDS_SUBNET: 40,
  ALIAS_LIMIT_REACHED: 41,
  ADDRESS_ALREADY_PRESENT: 42,
  CAMERA_INTERFACE_HOLDS_SUBNET: 43,
  ADDRESS_IN_USE: 44,
  NOT_MARKED: 45,
  INTERFACE_NOT_ARPABLE: 46,
  INTERFACE_DOWN: 47,
  INTERFACE_STATE_UNKNOWN: 48,
  // a tool did not do its work
  HOST_STATE_UNREADABLE: 50,
  CONFLICT_CHECK_FAILED: 51,
  ADD_FAILED: 52,
  DEL_FAILED: 53,
  MARK_WRITE_FAILED: 54,
  CONFLICT_RESULT_UNKNOWN: 55,
  INTERNAL: 60,
} as const);

export type HelperCodeName = keyof typeof HELPER_CODES;

/** The longest request the helper reads, its line feed included (the helper's `REQUEST_MAX_BYTES`). */
export const HELPER_REQUEST_MAX_BYTES = 64;
/**
 * The longest answer the Core reads. The longest pair of the table is 33 bytes with its line feed;
 * the bound is the request's, so one number holds for both directions.
 */
export const HELPER_ANSWER_MAX_BYTES = 64;
/** The lifetime the helper accepts, in minutes (its `MINUTES_MIN`, `MINUTES_MAX`; the CHECK of `alias_minutes`). */
export const ALIAS_MINUTES_MIN = 5;
export const ALIAS_MINUTES_MAX = 480;

// ── The two verbs ──────────────────────────────────────────────────────────────────────────────

export const HostAliasAction = {
  ADD: 'ADD',
  REMOVE: 'REMOVE',
} as const;
export type HostAliasAction = (typeof HostAliasAction)[keyof typeof HostAliasAction];

// ── An address the helper would take ───────────────────────────────────────────────────────────

/** Four numbers 0 to 255. Made by `aliasQuadOf` only; a request line is built from these and never from text. */
export type AliasQuad = readonly [number, number, number, number];

/** Why a value is not an address the helper would take. The helper's own names for the same refusals. */
export const AliasAddressProblem = {
  /** Not one strict dotted quad: a name, a prefix, a port, white space, a leading zero, another type. */
  ADDRESS_MALFORMED: 'ADDRESS_MALFORMED',
  /** Outside 10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16. */
  ADDRESS_NOT_PRIVATE: 'ADDRESS_NOT_PRIVATE',
  /** The host part of the /24 is 0 or 255. */
  HOST_PART_OUT_OF_RANGE: 'HOST_PART_OUT_OF_RANGE',
} as const;
export type AliasAddressProblem = (typeof AliasAddressProblem)[keyof typeof AliasAddressProblem];

const DOTTED_QUAD = /^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/;
const LONGEST_QUAD = '255.255.255.255'.length;

/** The four numbers of one strict dotted quad, or null. Leading zeros and every other numeric form are refused, not normalised. */
export function quadOf(value: unknown): AliasQuad | null {
  if (typeof value !== 'string' || value.length > LONGEST_QUAD) return null;
  const match = DOTTED_QUAD.exec(value);
  if (match === null) return null;
  const parts = [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return Object.freeze([parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 0]) as AliasQuad;
}

function isPrivate(quad: AliasQuad): boolean {
  if (quad[0] === 10) return true;
  if (quad[0] === 172 && quad[1] >= 16 && quad[1] <= 31) return true;
  return quad[0] === 192 && quad[1] === 168;
}

export type AliasQuadDecision = { readonly ok: true; readonly quad: AliasQuad } | { readonly ok: false; readonly problem: AliasAddressProblem };

/** The helper's bound 2 (S13-08 (2)), judged before a line is built: RFC 1918, host part 1 to 254. */
export function aliasQuadOf(value: unknown): AliasQuadDecision {
  const quad = quadOf(value);
  if (quad === null) return { ok: false, problem: AliasAddressProblem.ADDRESS_MALFORMED };
  if (!isPrivate(quad)) return { ok: false, problem: AliasAddressProblem.ADDRESS_NOT_PRIVATE };
  if (quad[3] < 1 || quad[3] > 254) return { ok: false, problem: AliasAddressProblem.HOST_PART_OUT_OF_RANGE };
  return { ok: true, quad };
}

/** The address rebuilt from its four numbers: never the caller's text. */
export function dottedOf(quad: AliasQuad): string {
  return `${quad[0]}.${quad[1]}.${quad[2]}.${quad[3]}`;
}

/** The minutes as the helper takes them, or null: an integer 5 to 480, of type number. */
export function aliasMinutesOf(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return value >= ALIAS_MINUTES_MIN && value <= ALIAS_MINUTES_MAX ? value : null;
}

// ── The request line ───────────────────────────────────────────────────────────────────────────

/** `add <a.b.c.d>/24 <minutes>` with its line feed. Both arguments are already numbers. */
export function addRequestLine(quad: AliasQuad, minutes: number): string {
  return `add ${dottedOf(quad)}/24 ${minutes}\n`;
}

/** `del <a.b.c.d>/24` with its line feed. */
export function delRequestLine(quad: AliasQuad): string {
  return `del ${dottedOf(quad)}/24\n`;
}

// ── The answer ─────────────────────────────────────────────────────────────────────────────────

const ANSWER_LINE = /^(0|[1-9]\d?) ([A-Z][A-Z0-9_]{1,31})\n$/;
const NAMES: ReadonlyMap<string, HelperCodeName> = new Map((Object.keys(HELPER_CODES) as HelperCodeName[]).map((name) => [name, name]));

/**
 * The pair of the table an answer is, or null. The text must be exactly one line `<code> <NAME>`
 * with its line feed and nothing after it, the name must be of the table and the number must be
 * that name's. The text is not kept: what leaves is a name of the closed set.
 */
export function helperAnswerOf(text: unknown): HelperCodeName | null {
  if (typeof text !== 'string' || text.length > HELPER_ANSWER_MAX_BYTES) return null;
  const match = ANSWER_LINE.exec(text);
  if (match === null) return null;
  const name = NAMES.get(match[2] ?? '');
  if (name === undefined) return null;
  return HELPER_CODES[name] === Number(match[1]) ? name : null;
}
