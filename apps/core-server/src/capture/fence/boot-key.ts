/**
 * WHICH KEY THE CORE STARTED WITH (task 4 blueprint row 209, X1-2; security requirement SX-15;
 * design 05 section 2.7 point 3; decision C62): the two PUBLIC members a real boot adds to the
 * details of its `SYSTEM_BOOT` audit entry, beside `captureOperation`:
 *
 *   signingKeyId               the id of the evidence signing key whose certificate lies in the store
 *   signingCertificateSha256   the SHA-256 of that certificate (64 lower-case hex digits)
 *
 * THE ORDER, AND WHAT THE MEMBERS MEAN. The capture unit mounts the fence BEFORE the boot checks,
 * and the readiness runner runs the boot steps in the order they were added, stopping at the first
 * that throws. So the step `capture.fence` writes this entry and commits it BEFORE the step
 * `capture.boot` has asked check 4 (the key loads), 4b (it is no development key in production)
 * or 4c. The two members therefore state ONE fact: the certificate that lay in the signer store at
 * the moment the fence step passed. They do NOT state that the private key loads, that it belongs
 * to this certificate, that the certificate is valid now, that the key is not marked compromised,
 * that it is not a development key, or that this boot went on to start: a boot that check 4 or 4b
 * refuses a moment later leaves the same entry behind. "The Core stated this key" is not "the key
 * passed the checks": whether the boot was refused is in the error log (step `capture.boot`, its
 * code), and which certificate signed a package is in the package itself.
 *
 * ONLY THE PUBLIC CERTIFICATE IS READ (`readStoredCertificate`): no private key and no wrap secret
 * is opened, loaded or asked for here. The read NEVER changes a boot: whatever is wrong with the
 * store, both members are null and the entry is written as before. No reason is kept and nothing
 * is logged here - check 4 names the state of the store with its own code a moment later.
 *
 * THE FORMS ARE ENFORCED BEFORE THE WRITE (`systemBootDetailsOf`): `SYSTEM_BOOT` is one of the
 * simulator's types and has no closed details list, so the audit writer itself accepts any member
 * (finding of row 201). The one writer of the boot entry holds its two values to their forms and
 * refuses a value that is not of them. The reader below hands on a pair of the two forms or the
 * null pair, so that refusal cannot be reached from a stored certificate.
 *
 * The two forms are the ones of `SYSTEM_BOOT_SIGNING_DETAIL_RULES` (`src/core/audit-details.ts`,
 * row 201), WRITTEN HERE A SECOND TIME: the core unit is imported through its index, whose export
 * line does not carry that name yet (a request of row 201, repeated by row 209). A test holds the
 * two statements equal on a table of values; when the name is exported, the table below is that
 * import.
 */
import { sha256Hex } from '@dems/shared/evidence-package';
import { CaptureOperation } from '../adapters/kinds';
import { SIGNING_STORE_SUBPATH, hostProfileStatementOf } from '../boot/checks';
import { readRetainedCertificates, readStoredCertificate, signingKeySeriesNumber } from '../signer';

/** The two members, in the order the entry states them. */
export const SYSTEM_BOOT_SIGNING_MEMBERS = ['signingKeyId', 'signingCertificateSha256'] as const;
export type SystemBootSigningMember = (typeof SYSTEM_BOOT_SIGNING_MEMBERS)[number];

/** The key a boot states: both members of their form, or both null (nothing could be read). */
export type BootSigningKey = { readonly [Member in SystemBootSigningMember]: string | null };

/** What a boot states when the certificate could not be read. */
export const BOOT_SIGNING_KEY_NOT_READ: BootSigningKey = Object.freeze({ signingKeyId: null, signingCertificateSha256: null });

/** The form of each member: a key id as every key-id column holds it; 64 lower-case hex digits. */
const MEMBER_FORM: Readonly<Record<SystemBootSigningMember, RegExp>> = Object.freeze({
  signingKeyId: /^[A-Z0-9][A-Z0-9_-]{0,63}$/,
  signingCertificateSha256: /^[0-9a-f]{64}$/,
});

/** True when `value` is of the form of `member`. Null is not a value: it is asked separately. */
export function isSystemBootSigningValue(member: SystemBootSigningMember, value: unknown): value is string {
  return typeof value === 'string' && MEMBER_FORM[member].test(value);
}

/**
 * The first member that keeps the pair from being written, or null: a member that is neither null
 * nor of its form, or - `signingKeyId` named - a pair of which only one half is stated (a key id
 * without its certificate, or the reverse, states no key).
 */
export function bootSigningKeyProblemOf(key: { readonly [Member in SystemBootSigningMember]: unknown }): SystemBootSigningMember | null {
  for (const member of SYSTEM_BOOT_SIGNING_MEMBERS) {
    if (key[member] !== null && !isSystemBootSigningValue(member, key[member])) return member;
  }
  return (key.signingKeyId === null) === (key.signingCertificateSha256 === null) ? null : 'signingKeyId';
}

/** `code` of a boot entry whose signing member is not of its form. */
export const SYSTEM_BOOT_SIGNING_MEMBER_INVALID = 'SYSTEM_BOOT_SIGNING_MEMBER_INVALID';

/** A signing member the writer of the boot entry refuses. It names the member, never the value. */
export class SystemBootSigningMemberError extends Error {
  readonly code = SYSTEM_BOOT_SIGNING_MEMBER_INVALID;
  readonly member: SystemBootSigningMember;
  constructor(member: SystemBootSigningMember) {
    super(`the member ${member} of the boot audit entry is not of its form: the entry is not written`);
    this.name = 'SystemBootSigningMemberError';
    this.member = member;
  }
}

/** The reader of the stored certificate, by the two public facts this file uses of it. */
export type StoredCertificateReader = (options: { readonly dir: string }) => { readonly keyId: string; readonly sha256: string };

/**
 * The key the store of `dataDir` states, from its PUBLIC certificate alone. NEVER THROWS: an absent
 * store, an unreadable or refused certificate, a reader that fails in any way and a value that is
 * not of its form all answer the null pair.
 */
export function storedBootSigningKey(dataDir: string, read: StoredCertificateReader = readStoredCertificate): BootSigningKey {
  try {
    const certificate = read({ dir: `${dataDir}/${SIGNING_STORE_SUBPATH}` });
    const stated = { signingKeyId: certificate.keyId, signingCertificateSha256: certificate.sha256 };
    return bootSigningKeyProblemOf(stated) === null ? Object.freeze(stated) : BOOT_SIGNING_KEY_NOT_READ;
  } catch {
    // On purpose without a reason: the read must not change a boot, and check 4 names the store's state with its own code.
    return BOOT_SIGNING_KEY_NOT_READ;
  }
}

// ── THE STATE OF THE SIGNER STORE, AND WHAT CHANGED SINCE THE PREVIOUS BOOT (task 4 row V5; decision C84, caution R-1) ──
//
// The two host commands `evidence:rotate-key` and `evidence:mark-compromised` write no audit entry: they
// touch no database (ruled, C69 and C84 - a compromise response must not need the database). So THE NEXT
// BOOT says it. The boot entry states the store as PUBLIC FACTS and names what differs from the previous
// boot entry of the same database:
//
//   signingKeysRetained        how many certificates the retained set holds (every key that is or was active)
//   signingKeysCompromised     the places in the key series (`01`..`99`, comma-joined, ascending) of the retained
//                              keys that carry the compromise mark; the empty text = none is marked
//   signingCertificatesSha256  SHA-256 over one line `<key id> <certificate SHA-256>` per retained certificate
//   signingStoreChange         `NO_EARLIER_STATEMENT` (no boot entry of a real operation before this one),
//                              `NOT_READ` (the store could not be read now), `NONE`, or the change codes
//                              `KEY_ROTATED`, `KEY_MARKED_COMPROMISED`, `KEY_MARK_REMOVED`, `RETAINED_SET_CHANGED`
//
// The four members are null together when the store cannot be read (and `signingStoreChange` is `NOT_READ`,
// or `NO_EARLIER_STATEMENT` on a first boot). Like the two members above they state what LAY IN THE STORE when
// the fence step passed, before the boot checks judged a key: an entry with a change code may be followed by
// a refused start. Only the retained-set reader of the signer is used: public certificate files and the
// presence of a mark file; no key and no wrap secret is opened. A reader that fails never changes a boot.
//
// The forms are those of `SYSTEM_BOOT_SIGNING_STORE_DETAIL_RULES` (`src/core/audit-details.ts`), which the
// audit writer itself applies to every `SYSTEM_BOOT` row; written here a second time for the same reason as
// the two forms above, and held equal by a test.

/** The four members of the store's state, in the order the entry states them. */
export const SYSTEM_BOOT_SIGNING_STORE_MEMBERS = ['signingKeysRetained', 'signingKeysCompromised', 'signingCertificatesSha256', 'signingStoreChange'] as const;

/** The codes of `signingStoreChange`: three that stand alone, then the four change codes in the order they are joined. */
export const BootSigningStoreChange = {
  NO_EARLIER_STATEMENT: 'NO_EARLIER_STATEMENT',
  NONE: 'NONE',
  NOT_READ: 'NOT_READ',
  KEY_ROTATED: 'KEY_ROTATED',
  KEY_MARKED_COMPROMISED: 'KEY_MARKED_COMPROMISED',
  KEY_MARK_REMOVED: 'KEY_MARK_REMOVED',
  RETAINED_SET_CHANGED: 'RETAINED_SET_CHANGED',
} as const;
export type BootSigningStoreChange = (typeof BootSigningStoreChange)[keyof typeof BootSigningStoreChange];
const CHANGE_CODES: readonly BootSigningStoreChange[] = ['KEY_ROTATED', 'KEY_MARKED_COMPROMISED', 'KEY_MARK_REMOVED', 'RETAINED_SET_CHANGED'];

/** The retained set as a boot states it: public facts only. */
export interface BootSigningStore {
  /** How many certificates the retained set holds. */
  readonly retained: number;
  /** The two-digit places of the marked keys, ascending. */
  readonly compromisedPlaces: readonly string[];
  /** SHA-256 over the lines `<key id> <certificate SHA-256>`, in series order. */
  readonly certificatesSha256: string;
}

const PLACE = /^(?:0[1-9]|[1-9]\d)$/;
const PLACES = /^(?:(?:0[1-9]|[1-9]\d)(?:,(?:0[1-9]|[1-9]\d))*)?$/;
/** The places a member text states, or null when it is not of its form (ascending, each once). */
function placesOf(value: unknown): readonly string[] | null {
  if (typeof value !== 'string' || !PLACES.test(value)) return null;
  const places = value === '' ? [] : value.split(',');
  return places.every((place, index) => index === 0 || place > (places[index - 1] as string)) ? places : null;
}

/** The reader of the retained set, by the public facts this file uses of it. */
export type RetainedCertificateSetReader = (options: { readonly dir: string }) => { readonly certificates: readonly { readonly certificate: { readonly keyId: string; readonly sha256: string }; readonly compromised: boolean }[] };

/**
 * The state of the store of `dataDir`, from its PUBLIC certificates and the presence of mark files
 * alone. NEVER THROWS: a store that cannot be taken, a reader that fails in any way, a key id
 * outside the series, a fingerprint that is not of its form and more certificates than the series
 * has places all answer null (nothing is stated). An absent store is the empty set.
 */
export function storedBootSigningStore(dataDir: string, read: RetainedCertificateSetReader = readRetainedCertificates): BootSigningStore | null {
  try {
    const set = read({ dir: `${dataDir}/${SIGNING_STORE_SUBPATH}` }).certificates;
    const lines: string[] = [];
    const compromisedPlaces: string[] = [];
    for (const entry of set) {
      const place = signingKeySeriesNumber(entry.certificate.keyId);
      if (place === null || !isSystemBootSigningValue('signingCertificateSha256', entry.certificate.sha256)) return null;
      lines.push(`${entry.certificate.keyId} ${entry.certificate.sha256}\n`);
      if (entry.compromised === true) compromisedPlaces.push(String(place).padStart(2, '0'));
    }
    compromisedPlaces.sort();
    if (set.length > 99 || !compromisedPlaces.every((place, index) => PLACE.test(place) && (index === 0 || place > (compromisedPlaces[index - 1] as string)))) return null;
    return Object.freeze({ retained: set.length, compromisedPlaces: Object.freeze(compromisedPlaces), certificatesSha256: sha256Hex(new TextEncoder().encode(lines.join(''))) });
  } catch {
    // On purpose without a reason, as the certificate read above: the read must not change a boot.
    return null;
  }
}

/**
 * THE ONE READ OF THE EARLIER STATEMENT: the details of the newest boot entry of a real operation
 * in this database (an entry of the fence carries `captureOperation`; the shared code's own
 * `SYSTEM_BOOT` rows - a recovery, an update restart - do not and are not statements of a store).
 * Run inside the unit of the boot entry, before it is appended. No bind value.
 */
export const READ_PREVIOUS_BOOT_STATEMENT = "SELECT a.details FROM public.audit_log a WHERE a.type = 'SYSTEM_BOOT' AND jsonb_exists(a.details, 'captureOperation') ORDER BY a.seq DESC LIMIT 1";

/**
 * What changed in the store against the earlier statement. `previous` is the `details` value of the
 * row `READ_PREVIOUS_BOOT_STATEMENT` returned, or undefined when it returned none. Only members of
 * their form are read from it; anything else in it is as if it were not stated. NEVER THROWS.
 *
 *   KEY_ROTATED             both entries state an active key, and its id or its certificate differs
 *   KEY_MARKED_COMPROMISED  a retained key is marked now that the earlier entry did not state as marked -
 *                           an earlier entry that states NO list (written before this step, or with an
 *                           unreadable store) counts as stating none, so a mark is named at least once
 *   KEY_MARK_REMOVED        the earlier entry states a key as marked that is not marked now
 *   RETAINED_SET_CHANGED    both entries state the digest of the retained set, and it differs
 */
export function bootSigningStoreChangeOf(key: BootSigningKey, store: BootSigningStore | null, previous: unknown): string {
  if (previous === undefined || previous === null || typeof previous !== 'object') return BootSigningStoreChange.NO_EARLIER_STATEMENT;
  if (store === null) return BootSigningStoreChange.NOT_READ;
  const earlier = previous as Readonly<Record<string, unknown>>;
  const found = new Set<BootSigningStoreChange>();
  const keyBefore = { signingKeyId: earlier['signingKeyId'], signingCertificateSha256: earlier['signingCertificateSha256'] };
  if (key.signingKeyId !== null && isSystemBootSigningValue('signingKeyId', keyBefore.signingKeyId) && isSystemBootSigningValue('signingCertificateSha256', keyBefore.signingCertificateSha256)) {
    if (keyBefore.signingKeyId !== key.signingKeyId || keyBefore.signingCertificateSha256 !== key.signingCertificateSha256) found.add(BootSigningStoreChange.KEY_ROTATED);
  }
  const markedBefore = placesOf(earlier['signingKeysCompromised']);
  if (store.compromisedPlaces.some((place) => markedBefore === null || !markedBefore.includes(place))) found.add(BootSigningStoreChange.KEY_MARKED_COMPROMISED);
  if (markedBefore !== null && markedBefore.some((place) => !store.compromisedPlaces.includes(place))) found.add(BootSigningStoreChange.KEY_MARK_REMOVED);
  const setBefore = earlier['signingCertificatesSha256'];
  if (isSystemBootSigningValue('signingCertificateSha256', setBefore) && setBefore !== store.certificatesSha256) found.add(BootSigningStoreChange.RETAINED_SET_CHANGED);
  return found.size === 0 ? BootSigningStoreChange.NONE : CHANGE_CODES.filter((code) => found.has(code)).join(',');
}

/** The four members of the store's state as an entry holds them: all of their form, or the first three null. */
export type BootSigningStoreStatement = {
  readonly signingKeysRetained: number | null;
  readonly signingKeysCompromised: string | null;
  readonly signingCertificatesSha256: string | null;
  readonly signingStoreChange: string;
};

// ── THE HOST OF A PRODUCTION BOOT (task 4 row P1; decisions U21 (2), C66 (1), C71 C-7) ──
//
// A production Core is allowed on Linux and on macOS. On Linux the boot checks ask the whole host profile; on
// macOS they ask NONE of it (the loopback owner rule, the crash collector, forwarding, the clock, sleep, the
// address helper's socket). Until this row the second fact was a warning in the log alone. The boot entry of a
// `REAL_PRODUCTION` boot now states it:
//
//   hostPlatform   `linux` or `darwin` - the platform word the entry point handed to the boot checks; null when
//                  it handed in another word or none (the word itself is never written: a closed set or null)
//   hostProfile    `WILL_BE_ASKED` (linux) | `WILL_NOT_BE_ASKED` (darwin) | `PLATFORM_NOT_SUPPORTED` (null above)
//
// WHAT THE FENCE CAN KNOW, AND WHAT THE MEMBERS THEREFORE MEAN. This entry is committed BEFORE the step
// `capture.boot` runs (see the header). The fence knows the platform word and what that word MEANS for the checks
// that follow - `hostProfileStatementOf`, the one function check 4d-2 itself uses, of the platform alone. So the
// members say "on this platform the host profile WILL (NOT) be asked", never "it was asked" and never "it was
// found in place": an entry with `WILL_BE_ASKED` may be followed by a start that a host check refuses, and an
// entry with `PLATFORM_NOT_SUPPORTED` IS followed by a refused start. What a boot that PASSED found is in the
// outcome of the boot checks (`hostProfile`), and from there in every manifest that boot seals.
//
// `REAL_DEVELOPMENT` asks no host profile by design and states NEITHER member (its entry is the one of before
// this row); a simulated boot writes no entry of the fence at all. Neither member is written when no boot checks
// are mounted on the app (a test of the fence alone): there is no platform to state.
//
// The forms are those of `SYSTEM_BOOT_HOST_DETAIL_RULES` (`src/core/audit-details.ts`), which the audit writer
// applies to every `SYSTEM_BOOT` row; a test holds the two equal.

/** The two members of the host statement, in the order the entry states them. */
export const SYSTEM_BOOT_HOST_MEMBERS = ['hostPlatform', 'hostProfile'] as const;

/** The codes of `hostProfile`. */
export const BootHostProfile = {
  WILL_BE_ASKED: 'WILL_BE_ASKED',
  WILL_NOT_BE_ASKED: 'WILL_NOT_BE_ASKED',
  PLATFORM_NOT_SUPPORTED: 'PLATFORM_NOT_SUPPORTED',
} as const;
export type BootHostProfile = (typeof BootHostProfile)[keyof typeof BootHostProfile];

/** The host statement as an entry holds it. */
export type BootHostStatement = { readonly hostPlatform: 'linux' | 'darwin' | null; readonly hostProfile: BootHostProfile };

/**
 * The host statement of a boot, or null when the boot states none: any operation but `REAL_PRODUCTION`, and
 * `platform` undefined (no boot checks are mounted). `platform` null = mounted, no host facts handed in.
 * NEVER THROWS, and the platform word reaches the entry only as one of the two words of the closed list.
 */
export function bootHostStatementOf(operation: CaptureOperation, platform: string | null | undefined): BootHostStatement | null {
  if (operation !== CaptureOperation.REAL_PRODUCTION || platform === undefined) return null;
  const statement = hostProfileStatementOf(platform);
  if (statement === null) return Object.freeze({ hostPlatform: null, hostProfile: BootHostProfile.PLATFORM_NOT_SUPPORTED });
  return Object.freeze({ hostPlatform: statement.platform, hostProfile: statement.asked ? BootHostProfile.WILL_BE_ASKED : BootHostProfile.WILL_NOT_BE_ASKED });
}

// ── THE ADDRESS HELPER OF A PRODUCTION BOOT ON LINUX (task 4 row HC; decision C94 (j), review 119 R119-12) ──
//
// The address helper (a root service on a local socket; the commissioning functions that change an address use it) is
// NOT part of every production installation. A Linux host without it starts, and the boot entry says what it saw:
//
//   addressHelperSocket   `PRESENT` | `NOT_PRESENT` - whether THE INSTALLED SOCKET PATH of the helper was there
//
// WHAT THE FENCE CAN KNOW, AND WHAT THE MEMBER THEREFORE MEANS. This entry is committed BEFORE the step `capture.boot`
// runs. The fence asks the host no question (it has no command runner); it looks ONCE at one fixed path - the path the
// delivered socket unit installs - through the file inspector it already holds, and states whether something was there.
// `NOT_PRESENT` therefore says "nothing was found at the helper's socket path when the fence step passed" - also when the
// path could not be reached. It does NOT say that the helper is absent as a whole (a helper file or a unit file may lie
// there: the boot checks then REFUSE the start, by the socket's own code), and `PRESENT` does NOT say that the node is a
// socket, is root's, or has the delivered group and mode (the boot checks judge that, and refuse what is wrong). What the
// checks found is in the log: `CAPTURE_HOST_ALIAS_HELPER_ABSENT` when nothing of the helper is installed.
//
// Stated by a `REAL_PRODUCTION` boot on `linux` only - the one platform where the helper exists and the host profile is
// asked. On macOS, in `REAL_DEVELOPMENT`, and where no boot checks are mounted the member is NOT written: the entry is
// the one of before this row, member for member.
//
// The form is the one of `SYSTEM_BOOT_ADDRESS_HELPER_DETAIL_RULES` (`src/core/audit-details.ts`); a test holds the two equal.

/** The one member of the address helper's statement. */
export const SYSTEM_BOOT_ADDRESS_HELPER_MEMBERS = ['addressHelperSocket'] as const;

/** The codes of `addressHelperSocket`. */
export const BootAddressHelperSocket = { PRESENT: 'PRESENT', NOT_PRESENT: 'NOT_PRESENT' } as const;
export type BootAddressHelperSocket = (typeof BootAddressHelperSocket)[keyof typeof BootAddressHelperSocket];

/** The helper's statement as an entry holds it. */
export type BootAddressHelperStatement = { readonly addressHelperSocket: BootAddressHelperSocket };

/**
 * The helper's statement of a boot, or null when the boot states none: any operation but `REAL_PRODUCTION`, any
 * platform word but `linux`, and no reader handed in. `socketPathPresent` is asked ONLY when the member is stated, so
 * nothing of the Linux profile is looked at on another platform. NEVER THROWS: a reader that fails saw nothing.
 */
export function bootAddressHelperStatementOf(operation: CaptureOperation, platform: string | null | undefined, socketPathPresent: (() => boolean) | undefined): BootAddressHelperStatement | null {
  if (operation !== CaptureOperation.REAL_PRODUCTION || platform !== 'linux' || socketPathPresent === undefined) return null;
  let present = false;
  try {
    present = socketPathPresent() === true;
  } catch {
    // On purpose without a reason, as the reads above: the look must not change a boot. The boot checks name the state a moment later.
    present = false;
  }
  return Object.freeze({ addressHelperSocket: present ? BootAddressHelperSocket.PRESENT : BootAddressHelperSocket.NOT_PRESENT });
}

/** The details of the `SYSTEM_BOOT` entry of a real boot: the operation, then the two members, then (row V5) the store's state, then (row P1) the host of a production boot, then (row HC) the address helper of a production boot on Linux. (A type, not an interface: it is handed to the audit writer as a record of detail values.) */
export type SystemBootDetails = { readonly captureOperation: CaptureOperation } & BootSigningKey & Partial<BootSigningStoreStatement> & Partial<BootHostStatement> & Partial<BootAddressHelperStatement>;

/** The severity of the boot entry: WARNING when it names a change of the signer store, else INFO. */
export function systemBootSeverityOf(details: SystemBootDetails): 'INFO' | 'WARNING' {
  const change = details.signingStoreChange;
  return typeof change === 'string' && change.split(',').some((code) => (CHANGE_CODES as readonly string[]).includes(code)) ? 'WARNING' : 'INFO';
}

/**
 * THE WRITER'S RULE: the details of the boot entry, with the two members held to their forms
 * BEFORE anything is appended. A member that is not null and not of its form, or half a pair, is
 * refused (`SystemBootSigningMemberError`): nothing is written.
 *
 * Row V5: called with `statement` - the state of the store (`storedBootSigningStore`) and the
 * details of the earlier boot entry (`previous`, undefined = there is none) - the entry also
 * carries the four members of the store's state. Called without it, it states the two members
 * alone, as before.
 *
 * Row P1: `statement.hostPlatform` - the platform word the boot checks were handed (`bootHostPlatformOf`;
 * undefined or left out = no boot checks are mounted) - adds the two members of the host statement to the
 * entry of a `REAL_PRODUCTION` boot, AFTER every member of before. Left out, or another operation: the
 * entry is the one of before this row, member for member.
 *
 * Row HC: `statement.addressHelperSocketPresent` - a reader of "something lies at the installed socket path of the
 * address helper" - adds the ONE member `addressHelperSocket` to the entry of a `REAL_PRODUCTION` boot on `linux`,
 * AFTER every member of before. Left out, another operation or another platform: nothing is added and nothing is read.
 */
export function systemBootDetailsOf(operation: CaptureOperation, key: BootSigningKey, statement?: { readonly store: BootSigningStore | null; readonly previous: unknown; readonly hostPlatform?: string | null | undefined; readonly addressHelperSocketPresent?: (() => boolean) | undefined }): SystemBootDetails {
  const problem = bootSigningKeyProblemOf(key);
  if (problem !== null) throw new SystemBootSigningMemberError(problem);
  const stated = { captureOperation: operation, signingKeyId: key.signingKeyId, signingCertificateSha256: key.signingCertificateSha256 };
  if (statement === undefined) return stated;
  const { store } = statement;
  const host = bootHostStatementOf(operation, statement.hostPlatform);
  const helper = bootAddressHelperStatementOf(operation, statement.hostPlatform, statement.addressHelperSocketPresent);
  return {
    ...stated,
    signingKeysRetained: store === null ? null : store.retained,
    signingKeysCompromised: store === null ? null : store.compromisedPlaces.join(','),
    signingCertificatesSha256: store === null ? null : store.certificatesSha256,
    signingStoreChange: bootSigningStoreChangeOf(key, store, statement.previous),
    ...(host === null ? {} : host),
    ...(helper === null ? {} : helper),
  };
}
