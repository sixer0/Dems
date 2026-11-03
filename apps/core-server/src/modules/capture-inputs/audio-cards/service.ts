/**
 * What operations 98 and 99 do (task 4, blueprint row 70, package WP-07c; the contract
 * `packages/shared/src/api/capture-audio-cards.ts`; design addendum 04 section 4.2; security
 * addendum AD-07; decisions U10, C25).
 *
 *   98 `searchCaptureAudioCards`    lists the sound cards through the INJECTED enumerator, once,
 *                                   now. Stores nothing. One CAPTURE_DISCOVERY_SEARCHED row with
 *                                   `scope: AUDIO_CARDS`: a search id and counts.
 *   99 `registerCaptureAudioInput`  lists AGAIN itself, takes the channel count, the USB id and
 *                                   the product from that listing (never from the body), and in
 *                                   ONE unit writes the registry row of the microphone, its input
 *                                   row and one CAPTURE_AUDIO_INPUT_CHANGED row.
 *
 * THE ORDER OF THE REFUSALS, the same for both (each stores nothing and writes no audit row):
 *   503 NOT_READY / DISCOVERY_NOT_READY           no enumerator (the Core is not in production capture);
 *                                                 for 99 also: no registrar of the registry row
 *   409 CAPTURE_CONFIG_LOCKED                     a session is open (idle only)
 *   409 INVALID_STATE / AUDIO_CARD_SEARCH_IN_PROGRESS   a listing is running (one at a time per Core)
 *   429 RATE_LIMITED / AUDIO_CARD_SEARCH_RATE_LIMITED   operation 98 only: the spacing of the camera search
 * and then, for 99, on its own listing:
 *   404 NOT_FOUND                                 no card of this id with this device index
 *   409 INVALID_STATE / AUDIO_INPUT_BEYOND_CARD   the card has no input of this number
 *   409 INVALID_STATE / AUDIO_INPUT_NOT_REGISTRABLE   the card states no channel count (a guessed
 *                                                 count is never stored: row 64, decision DD-6)
 *
 * DEVICE TEXT (AD-07). The listing's result is used AS IT IS: the enumerator handed in has passed every
 * string through its text rule, and this file neither reads raw text nor repairs any. The product
 * is answered and stored (`capture_devices.model`) as the listing returned it. No refusal, no log
 * line, no error-log entry and no audit detail of this file carries a product, a USB id or a card
 * id: they carry a registry id, a code and integers. Nothing here builds a helper argument.
 *
 * A REGISTRATION DECIDES NO ROLE (decision C25): making the microphone primary or standby is the
 * selector's (operation 80). `capture_config` is not read and not written here.
 *
 * THE MATCH OF A STORED INPUT TO A LIVE CARD (row 156, AD-07 (4); R-FLEX row 131, spec
 * `01_specs_rflex_audio.md` sections 3, 5, 6): the identity rule `matchStoredCard` - the USB id,
 * then the SERIAL where the card states one, else ANY unit of the model, on ANY port. The stored
 * port is information; it is compared only as the tie-break of two units that state one serial.
 * A card with another USB id or another serial is NOT the registered card: said as CARD_CHANGED
 * (one audit entry, the microphone not enabled again), never taken silently.
 *
 * ONE MICROPHONE PER INPUT OF A PHYSICAL CARD (decision D48, 2026-10-23, which reverses D10 (1) /
 * Q96-01 a "the physical card is held by one microphone"). One card may hold SEVERAL microphones,
 * each on ANOTHER input (card device and input number): a receiver of two wireless microphones on
 * one USB capture device is two DEMS microphones, PRIMARY and STANDBY. The holders of a card are
 * the LIVE input rows of its USB id (`READ_BOUND_AUDIO_INPUTS`, retired rows never hold) that the
 * identity rule names this card. A holder BLOCKS a registration when it holds THE REQUESTED INPUT,
 * or when the rule cannot tell its card from another unit: two serial-less units of one model
 * (`NOT_TELLABLE`, Q96-03) are both held WHOLE by the stored microphone, so neither unit is offered
 * for any other input.
 *   - operation 98 answers `registered[]`, the inputs of the listed capture device whose stored
 *     card IS this card, and `boundTo`, the FIRST holder of the card (the lowest MIC id), both by
 *     identity over the live rows - not by the key first: a card moved under another kernel card id
 *     (macOS `usb_<port>`) is still the bound card;
 *   - operation 99 for ANOTHER input of a held card is a new microphone (`201 REGISTERED`); for an
 *     input a holder blocks it is refused `409 AUDIO_CARD_ALREADY_BOUND` with `details.deviceId`,
 *     the holder; with `release: true` that holder MOVES to the requested input (bundle M,
 *     Q96-02-M): its row is re-keyed, two audit entries (`RELEASED` for the old input, then
 *     `REENABLED`), answer `200 REENABLED` with `releasedDeviceId` = the holder;
 *   - the SAME card at the SAME input under another kernel key is a port move, not a re-bind: the
 *     holder's row is re-keyed and the answer is `200 REENABLED`, no `release` needed;
 *   - the same input under the same key is its microphone again (`200 REENABLED`), never a second;
 *   - a move onto a key another row holds rolls back `409 AUDIO_INPUT_NOT_REGISTRABLE`;
 *   - an input SEVERAL live rows already block (an older database, spec X-2) is not moved: `409
 *     AUDIO_CARD_ALREADY_BOUND` naming the first of them, the lowest MIC id, also with `release`;
 *   - a RETIRED row neither holds a card nor occupies its key (spec D-A3.4);
 *   - a USB card whose USB id could not be read (the fixed replacement word) would match no card
 *     again: refused `409 AUDIO_INPUT_NOT_REGISTRABLE` before anything is stored.
 * Units of work run one at a time (`core/pipeline.ts`, `core/unit-of-work.ts`): the read of the
 * holders and the write that follows see no other registration in between.
 *
 * WHAT IS NOT HERE (stated, with its row). THE REGISTRY ROW (`capture_devices`) is
 * written by the registrar handed in (`MicrophoneRegistrar`), never by a statement of this module
 * (static rule SEC35-41 (c)). The product's registrar is `registrar.ts` (task 4 rows 185 and 190):
 * the engine's INTERNAL action `registerCaptureMicrophone` in the unit of the registration.
 */
import {
  ApiErrorCode,
  CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS,
  CAPTURE_AUDIO_USB_PORT_PATTERN,
  CAPTURE_AUDIO_USB_SERIAL_PATTERN,
  CAPTURE_DISCOVERY_MAX_PER_MINUTE,
  CaptureAudioCardReason,
  CaptureAudioInputChange,
  CaptureDiscoveryReason,
  CaptureDiscoveryScope,
  CaptureDiscoveryTrigger,
  RETRY_AFTER_HEADER_NAME,
  captureAudioInputChangedDetails,
  captureDiscoverySearchedDetails,
  type CaptureAudioCard,
  type CaptureAudioCardSearch,
  type CaptureAudioInputRegisterRequest,
  type CaptureAudioInputRegistration,
} from '@dems/shared/api';
import { AuditType, Permission } from '@dems/shared/sim';
import type { AuditEntry } from '../../../core';
import type { EngineUnit } from '../../../engine';
import { ApiFailure } from '../../../plugins/error-envelope';
import type { BoundAudioInput, MicrophoneStore, Queryable, RegisteredAudioInput, StoredCardIdentity } from './store';

// ── The card listing, as this module is HANDED it ──────────────────────────────────────────────
//
// This module is no wiring unit of the adapter layer (static rule A-5): it imports nothing of
// `capture/adapters`. The unit that wires the capture area hands the enumerator in, and the shapes
// below state what this module reads of its answer. `CardEnumerator` of
// `capture/adapters/audio/card-listing.ts` (row 64) satisfies `AudioCardEnumerator` as it is.

/** `factsSource` of a card whose channel count the listing GUESSED. Such a count is never stored. */
export const ASSUMED_CARD_FACTS = 'ASSUMED';

/** One capture device of one sound card, as the listing returned it: every string has passed the listing's text rule. */
export interface ListedAudioCard {
  readonly cardId: string;
  readonly deviceIndex: number;
  readonly usbId: string | null;
  /** The USB port path of the card (`usb-<port>` of its stream file), where the system offers one; passed the listing's text rule like every string. */
  readonly usbPort?: string | null;
  /** The serial number the USB device states, where it states one (row 199); passed the listing's text rule like every string. Compared, stored, and answered by operation 98 in the contract's closed form (`cardAnswer`). */
  readonly usbSerial?: string | null;
  readonly product: string;
  /** The native channel count: inputs are numbered 1 to this value. */
  readonly channelCount: number;
  /** Where the channel count comes from; `ASSUMED` is a guess. */
  readonly factsSource: string;
  readonly sampleBits: readonly (16 | 24 | 32)[];
}

export interface AudioCardListing {
  readonly cards: readonly ListedAudioCard[];
  readonly truncated: boolean;
  readonly skipped: number;
}

/** Reads the host once. Nothing is kept: two calls are two readings. */
export interface AudioCardEnumerator {
  list(): Promise<AudioCardListing>;
}

/**
 * THE REGISTRY ROW IS THE REGISTRAR'S. No statement of this module writes `capture_devices`
 * (static rule SEC35-41 (c)): the registry row of a microphone - class `MIC`, adapter kind
 * `USB_AUDIO`, the next free `MIC-nn` - is written, and re-enabled, by the registrar handed in,
 * INSIDE the unit of the registration, as the camera adoption's registrar does (`capture-discovery/
 * adoption.ts`). A registrar throws to roll the unit back.
 */
export interface MicrophoneRegistrar {
  /** Adds the microphone to the registry in `unit`. Resolves with its id, `MIC-nn`. `model` is the product as the listing returned it. */
  register(unit: AudioCardsUnit, device: { readonly model: string; readonly at: number }): Promise<string>;
  /** The microphone of an input that has a row: enabled again, with the product of the new listing. */
  reenable(unit: AudioCardsUnit, device: { readonly deviceId: string; readonly model: string; readonly at: number }): Promise<void>;
}

// ── Seams ──────────────────────────────────────────────────────────────────────────────────────

/** The operator behind a request, as stage 4 resolved it. */
export interface AudioCardsCaller {
  readonly operatorId: string;
  /** The paired device of the session; null for the web console (the only client kind stage 6 lets through). */
  readonly deviceId: string | null;
}

/** The unit of work of one operation, as far as this file uses it. `index.ts` builds it on a unit of the engine. */
export interface AudioCardsUnit {
  /** The unit's own connection: every write of the registration runs on it. */
  readonly db: Queryable;
  /** The engine's unit behind it, for a registrar that runs an action of the engine in it. */
  readonly scope: EngineUnit;
  /** True when a session is open in the state this unit sees, behind its lock. */
  sessionOpen(): boolean;
  audit(entry: AuditEntry): Promise<void>;
  /** Runs after the commit, never for a unit that rolled back. */
  afterCommit(task: () => void): void;
}

/** The registered microphone a registry is told of, after the commit. The shape of a stored registry row. */
export interface RegisteredMicrophone {
  readonly id: string;
  readonly kind: 'MIC';
  readonly adapterKind: 'USB_AUDIO';
  readonly model: string | null;
}

export interface AudioCardsHost {
  now(): number;
  /** True while a session is open: the quick answer before any listing. The unit asks again behind its lock. */
  sessionOpen(): boolean;
  /** A read on the pool, outside a unit. */
  read<Value>(label: string, work: (db: Queryable) => Promise<Value>): Promise<Value>;
  /** One unit of work: everything `work` writes commits together or not at all. Rejects with what `work` threw. */
  unit<Value>(label: string, work: (unit: AudioCardsUnit) => Promise<Value>): Promise<Value>;
  /** A line of the log: codes, ids and counts only. */
  note(fields: Record<string, unknown>, message: string): void;
  /** A failure for the log AND the persistent error log. Never device text. */
  failed(source: string, message: string, error: unknown, context?: Record<string, string | number>): void;
}

export interface AudioCardsSeams {
  readonly host: AudioCardsHost;
  readonly store: MicrophoneStore;
  readonly gate: ListingGate;
  /** The enumerator of the card listing; null when this Core has none (not in production capture, or none handed in). */
  enumerator(): AudioCardEnumerator | null;
  /** The writer of the registry row; null when none was handed in: operation 99 then answers `503` and stores nothing. */
  registrar(): MicrophoneRegistrar | null;
  /** Hands a committed microphone to the adapter registry of the running operation. Must not throw. */
  admit(device: RegisteredMicrophone): void;
  /** The id of a listing for its audit row (`DSC-...`). */
  nextSearchId(now: number): string;
}

// ── Refusals: fixed texts that quote nothing of the request and nothing of a device ────────────

const SOURCE = 'captureAudioCards';
const LISTING_FAILED = 'the sound cards of the host could not be listed';

const notReady = (): ApiFailure => new ApiFailure(503, ApiErrorCode.NOT_READY, 'The sound cards cannot be listed on this Core.', { details: { reason: CaptureDiscoveryReason.DISCOVERY_NOT_READY } });
const locked = (): ApiFailure => new ApiFailure(409, ApiErrorCode.CAPTURE_CONFIG_LOCKED, 'The capture configuration cannot be changed while a session is open.');
const invalidState = (reason: CaptureAudioCardReason, text: string): ApiFailure => new ApiFailure(409, ApiErrorCode.INVALID_STATE, text, { details: { reason } });
const inProgress = (): ApiFailure => invalidState(CaptureAudioCardReason.AUDIO_CARD_SEARCH_IN_PROGRESS, 'The sound cards are being listed. Try again shortly.');
const beyondCard = (): ApiFailure => invalidState(CaptureAudioCardReason.AUDIO_INPUT_BEYOND_CARD, 'The sound card has no such input.');
const notRegistrable = (): ApiFailure => invalidState(CaptureAudioCardReason.AUDIO_INPUT_NOT_REGISTRABLE, 'This sound card does not state its inputs. Its inputs cannot be registered.');
const notIdentifiable = (): ApiFailure => invalidState(CaptureAudioCardReason.AUDIO_INPUT_NOT_REGISTRABLE, 'This sound card states no USB ID. It could not be found again, so its inputs cannot be registered.');
const inputTaken = (): ApiFailure => invalidState(CaptureAudioCardReason.AUDIO_INPUT_NOT_REGISTRABLE, 'Another microphone is stored under this input. The microphone of this sound card cannot be moved to it.');
const alreadyBound = (holder: string): ApiFailure =>
  new ApiFailure(409, ApiErrorCode.INVALID_STATE, 'Another microphone holds this input of the sound card.', { details: { reason: CaptureAudioCardReason.AUDIO_CARD_ALREADY_BOUND, deviceId: holder } });
const noCard = (): ApiFailure => new ApiFailure(404, ApiErrorCode.NOT_FOUND, 'No sound card has this ID.');
const rateLimited = (retryAfterMs: number): ApiFailure =>
  new ApiFailure(429, ApiErrorCode.RATE_LIMITED, 'The sound cards were listed a moment ago. Try again shortly.', {
    details: { reason: CaptureAudioCardReason.AUDIO_CARD_SEARCH_RATE_LIMITED, retryInMs: retryAfterMs },
    headers: { [RETRY_AFTER_HEADER_NAME]: String(Math.max(1, Math.ceil(retryAfterMs / 1_000))) },
  });

// ── One listing at a time, and the spacing of operation 98 (AD-07 (3)) ─────────────────────────

/** Why a listing runs: an operator's search (98) or the Core's own second listing of a registration (99). */
export type ListingPurpose = 'SEARCH' | 'REGISTRATION';

export interface ListingGate {
  /**
   * Runs `work` as THE listing of this Core. Rejects `409 AUDIO_CARD_SEARCH_IN_PROGRESS` while
   * another one runs (for both purposes), and `429 AUDIO_CARD_SEARCH_RATE_LIMITED` for a SEARCH
   * that begins within the spacing of the last accepted search. A registration is not spaced: an
   * operator registers two inputs of a card one after the other.
   */
  run<Value>(purpose: ListingPurpose, work: () => Promise<Value>): Promise<Value>;
  /** Listings that were let through since the process began. */
  started(): number;
}

const MINUTE_MS = 60_000;

/**
 * THE BOUNDS OF A CARD SEARCH ARE THE CAMERA SEARCH'S PER-CORE BOUNDS (AD-07 (3); task 4 row 156;
 * `capture-discovery/limits.ts`): one RUNNING listing per Core (single flight: a second call starts
 * NO process), 5 s between two accepted searches, and at most `CAPTURE_DISCOVERY_MAX_PER_MINUTE`
 * accepted searches in a minute. As there: a search that was started counts whatever became of it,
 * and a refused call counts nothing and changes nothing.
 */
export function createListingGate(now: () => number, minIntervalMs: number = CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS, maxPerMinute: number = CAPTURE_DISCOVERY_MAX_PER_MINUTE): ListingGate {
  let running = false;
  let lastSearchAt: number | null = null;
  /** The instants of the accepted searches of the last minute, oldest first. */
  let searches: number[] = [];
  let started = 0;
  return {
    async run(purpose, work) {
      if (running) throw inProgress();
      const at = now();
      if (purpose === 'SEARCH') {
        // A clock that went back never locks the search out: the bound is asked only for a later instant.
        if (lastSearchAt !== null && at >= lastSearchAt && at - lastSearchAt < minIntervalMs) throw rateLimited(minIntervalMs - (at - lastSearchAt));
        // The same for the minute: instants of the future (a clock that went back) are dropped, not waited for.
        searches = searches.filter((earlier) => earlier <= at && at - earlier < MINUTE_MS);
        if (searches.length >= maxPerMinute) throw rateLimited(Math.max(1, (searches[searches.length - maxPerMinute] ?? at) + MINUTE_MS - at));
        lastSearchAt = at;
        searches.push(at);
      }
      running = true;
      started += 1;
      try {
        return await work();
      } finally {
        running = false;
      }
    },
    started: () => started,
  };
}

// ── The listing ────────────────────────────────────────────────────────────────────────────────

async function listed(seams: AudioCardsSeams, enumerator: AudioCardEnumerator, purpose: ListingPurpose): Promise<AudioCardListing> {
  return seams.gate.run(purpose, async () => {
    try {
      return await enumerator.list();
    } catch (error) {
      // The source of the listing failed (a file of the host that cannot be read, the listing program). Nothing is answered from a half listing.
      seams.host.failed(`${SOURCE}.list`, LISTING_FAILED, error, { purpose });
      throw notReady();
    }
  });
}

/**
 * One card of the listing as the contract answers it. Every string is the listing's own result.
 *
 * `boundTo` and `registered` (R-FLEX row 131, AU-L1): BY IDENTITY over the live rows of the card's
 * USB id (`bound`), never by the key first. `boundTo` is the FIRST microphone (the lowest MIC id)
 * that holds the physical card (`holdsCard`; since D48 a card holds one microphone per input, so it
 * may have several); `registered` the inputs on this capture device whose stored card IS this card
 * (`SAME_CARD`), each with its microphone. A card that is not USB has nothing but its key: its rows
 * are found by the key.
 *
 * `usbSerial`, `usbPort` (row V3's contract step; the request of rows 199 / 200, served by row 146b's
 * agent): the serial and the port are ANSWERED, so that a console can show WHICH of two cards of
 * one model a row is. Each is the listing's own text when it has the contract's closed form
 * (`CAPTURE_AUDIO_USB_SERIAL_PATTERN`, `CAPTURE_AUDIO_USB_PORT_PATTERN`: letters, digits and
 * `: . _ -`, 1 to 64 characters - the rule of the two columns), else `null`: a card that states
 * none, a card that is not USB, and a text outside the form are all "none" to a client. Nothing is
 * cut or repaired. They stay out of every log line, error-log entry and audit detail of this file.
 */
function cardAnswer(card: ListedAudioCard, registered: readonly RegisteredAudioInput[], bound: ReadonlyMap<string, readonly BoundAudioInput[]>, listing: readonly ListedAudioCard[]): CaptureAudioCard {
  const byNumber = (left: { inputNumber: number }, right: { inputNumber: number }): number => left.inputNumber - right.inputNumber;
  let inputs: { inputNumber: number; deviceId: string }[];
  let boundTo: string | null;
  if (card.usbId === null) {
    const held = registered.filter((input) => input.cardId === card.cardId && (input.identity === undefined || matchStoredCard(input.identity, card, listing) === StoredCardMatch.SAME_CARD));
    inputs = held.filter((input) => input.cardDevice === card.deviceIndex).map((input) => ({ inputNumber: input.inputNumber, deviceId: input.deviceId }));
    boundTo = held[0]?.deviceId ?? null;
  } else {
    const usbId = card.usbId;
    const holding = (bound.get(usbId) ?? []).filter((row) => holdsCard(boundIdentityOf(usbId, row), card, listing));
    inputs = holding
      .filter((row) => row.cardDevice === card.deviceIndex && matchStoredCard(boundIdentityOf(usbId, row), card, listing) === StoredCardMatch.SAME_CARD)
      .map((row) => ({ inputNumber: row.inputNumber, deviceId: row.deviceId }));
    boundTo = holding[0]?.deviceId ?? null;
  }
  return {
    cardId: card.cardId,
    deviceIndex: card.deviceIndex,
    usbId: card.usbId,
    usbSerial: answeredIdentityOf(card.usbSerial, CAPTURE_AUDIO_USB_SERIAL_PATTERN),
    usbPort: answeredIdentityOf(card.usbPort, CAPTURE_AUDIO_USB_PORT_PATTERN),
    product: card.product,
    channelCount: card.channelCount,
    sampleBits: [...card.sampleBits],
    registered: inputs.sort(byNumber),
    boundTo,
  };
}

// ── Operation 98 ───────────────────────────────────────────────────────────────────────────────

export const SEARCH_UNIT_LABEL = 'captureAudioCards.search';
export const REGISTER_UNIT_LABEL = 'captureAudioCards.register';

export async function searchAudioCards(seams: AudioCardsSeams, caller: AudioCardsCaller): Promise<CaptureAudioCardSearch> {
  const { host } = seams;
  const enumerator = seams.enumerator();
  if (enumerator === null) throw notReady();
  if (host.sessionOpen()) throw locked();
  const searchedAt = host.now();
  const listing = await listed(seams, enumerator, 'SEARCH');
  const registered = await host.read(`${SOURCE}.registeredInputs`, (db) => seams.store.registeredInputs(db));
  // The live holders of every USB id of the listing (DB-A2), one read per USB id.
  const usbIds = [...new Set(listing.cards.flatMap((card) => (card.usbId === null ? [] : [card.usbId])))];
  const bound = await host.read(`${SOURCE}.boundInputs`, async (db) => {
    const rows = new Map<string, readonly BoundAudioInput[]>();
    for (const usbId of usbIds) rows.set(usbId, await seams.store.boundInputs(db, usbId));
    return rows;
  });
  const cards = listing.cards.map((card) => cardAnswer(card, registered, bound, listing.cards));
  const registeredCount = cards.reduce((sum, card) => sum + card.registered.length, 0);
  const searchId = seams.nextSearchId(searchedAt);
  await host.unit(SEARCH_UNIT_LABEL, async (unit) => {
    // A session that opened while the host was read: nothing was stored, and nothing is said of a listing made in a locked state.
    if (unit.sessionOpen()) throw locked();
    await unit.audit({
      type: AuditType.CAPTURE_DISCOVERY_SEARCHED,
      message: 'Sound cards listed',
      actorId: caller.operatorId,
      deviceId: caller.deviceId,
      details: captureDiscoverySearchedDetails({
        searchId,
        scope: CaptureDiscoveryScope.AUDIO_CARDS,
        trigger: CaptureDiscoveryTrigger.MANUAL,
        outcome: 'COMPLETE',
        responderCount: cards.length,
        newCount: cards.filter((card) => card.registered.length === 0).length,
        registeredCount,
        interfaceCount: 0,
        operationId: 'searchCaptureAudioCards',
        permission: Permission.CAPTURE_CONFIG,
      }),
    });
  });
  // Counts and codes only: no card id, no USB id, no product.
  host.note({ code: AuditType.CAPTURE_DISCOVERY_SEARCHED, source: SOURCE, searchId, cards: cards.length, registered: registeredCount, skipped: listing.skipped, truncated: listing.truncated }, 'sound cards listed');
  return { searchedAt, cards, truncated: listing.truncated };
}

// ── Operation 99 ───────────────────────────────────────────────────────────────────────────────

/** The sample size stored for a card that states none: the default of the column (`capture_audio_inputs.sample_bits`). */
const DEFAULT_SAMPLE_BITS = 24;
/** The sample size stored with an input: the largest the card offers by the listing, a member of the closed set. */
const sampleBitsOf = (card: ListedAudioCard): 16 | 24 | 32 => card.sampleBits.reduce<16 | 24 | 32 | null>((max, bits) => (max === null || bits > max ? bits : max), null) ?? DEFAULT_SAMPLE_BITS;

// ── The identity of the card behind a stored input (AD-07 (4); task 4 row 156) ─────────────────

/**
 * What the Core can say of a live card held against a stored input. Only `SAME_CARD` is a match;
 * every other answer is SAID (`CARD_CHANGED`, one audit entry) and never taken silently. R-FLEX
 * row 131 removed `PORT_DIFFERS` and `IDENTITY_NOT_STORED` (register RM-A2, RM-A4): a port is no lock.
 */
export const StoredCardMatch = {
  /** The USB id is the stored one, and the stored serial is the live one - or, with no serial stored, the live card is the one serial-less unit of the model, on any port. */
  SAME_CARD: 'SAME_CARD',
  /** Another USB id behind the key: another product took the place. */
  USB_ID_DIFFERS: 'USB_ID_DIFFERS',
  /** The serial is not the stored one: another serial, a serial where none was stored, or none where one was stored. Another unit of the product. */
  SERIAL_DIFFERS: 'SERIAL_DIFFERS',
  /** Two live cards of the USB id state the stored serial and the stored port does not say which - or, with no serial stored, two serial-less units of the model are listed (AU-R3, Q96-03). */
  NOT_TELLABLE: 'NOT_TELLABLE',
} as const;
export type StoredCardMatch = (typeof StoredCardMatch)[keyof typeof StoredCardMatch];

/** A serial or a port path of either side: the text, or null for none (absent, null and the empty text are all "none"). */
const identityTextOf = (value: string | null | undefined): string | null => (typeof value === 'string' && value !== '' ? value : null);

/** A serial or a port path as operation 98 ANSWERS it: the text when it has the contract's closed form, else null. Never cut, never repaired. */
function answeredIdentityOf(value: string | null | undefined, form: RegExp): string | null {
  const text = identityTextOf(value);
  return text !== null && form.test(text) ? text : null;
}

/**
 * THE IDENTITY RULE (AD-07 (4); task 4 rows 156, 192, 199; R-FLEX rows 107, 131 - spec
 * `01_specs_rflex_audio.md` section 3, the shared case table `test/support/stored-card-identity-cases.ts`).
 * A stored input is matched to a live card by its USB id, THEN BY THE SERIAL where the card states
 * one, ELSE BY THE MODEL: any serial-less unit of the USB id, on any port. Never by the product
 * text or the card id: the kernel derives the card id from the product (and on macOS from the port).
 *
 *   USB id differs                                        USB_ID_DIFFERS
 *   no USB id on either side (not a USB card)             SAME_CARD: the key is all such a card has
 *   a serial stored, the live card states the same        SAME_CARD, whatever its port - unless
 *                                                         ANOTHER live card of the USB id states that
 *                                                         serial too: then the stored port must be the
 *                                                         live one (a tie-break), else NOT_TELLABLE
 *   a serial stored, the live card states another, or none  SERIAL_DIFFERS
 *   no serial stored, the live card states one            SERIAL_DIFFERS
 *   no serial stored (with or without a port), the live
 *   card states none                                      SAME_CARD, on any port - unless ANOTHER card
 *                                                         of the USB id states no serial either:
 *                                                         NOT_TELLABLE (AU-R3, Q96-03)
 *
 * WHAT THE RULE CANNOT SEE, stated: a serial-less unit replaced by another unit of the model while
 * the first is away is the same identity. Nothing a host offers tells them apart.
 */
export function matchStoredCard(stored: StoredCardIdentity, card: ListedAudioCard, listing: readonly ListedAudioCard[]): StoredCardMatch {
  if (stored.usbId !== card.usbId) return StoredCardMatch.USB_ID_DIFFERS;
  if (card.usbId === null) return StoredCardMatch.SAME_CARD;
  const storedSerial = identityTextOf(stored.usbSerial);
  const liveSerial = identityTextOf(card.usbSerial);
  if (storedSerial !== null) {
    const storedPort = identityTextOf(stored.usbPort);
    const livePort = identityTextOf(card.usbPort);
    if (liveSerial !== storedSerial) return StoredCardMatch.SERIAL_DIFFERS;
    // Two capture devices of ONE card are not two cards: only another card id counts.
    const shared = listing.some((other) => other.cardId !== card.cardId && other.usbId === card.usbId && identityTextOf(other.usbSerial) === storedSerial);
    if (!shared) return StoredCardMatch.SAME_CARD;
    return storedPort !== null && storedPort === livePort ? StoredCardMatch.SAME_CARD : StoredCardMatch.NOT_TELLABLE;
  }
  if (liveSerial !== null) return StoredCardMatch.SERIAL_DIFFERS;
  // Any serial-less unit of the model, on any port; a second one on another card id cannot be told apart.
  const twin = listing.some((other) => other.cardId !== card.cardId && other.usbId === card.usbId && identityTextOf(other.usbSerial) === null);
  return twin ? StoredCardMatch.NOT_TELLABLE : StoredCardMatch.SAME_CARD;
}

/**
 * True when the microphone of `stored` HOLDS the live `card` (R-FLEX row 131; Q96-01 a, Q96-03): the
 * card is its card (`SAME_CARD`), or the rule cannot tell (`NOT_TELLABLE`) and no OTHER card of the
 * listing is its card. Two serial-less units of one model are both held; of two units that share a
 * serial, the one on the stored port is held and the other is free.
 */
function holdsCard(stored: StoredCardIdentity, card: ListedAudioCard, listing: readonly ListedAudioCard[]): boolean {
  const match = matchStoredCard(stored, card, listing);
  if (match === StoredCardMatch.SAME_CARD) return true;
  if (match !== StoredCardMatch.NOT_TELLABLE) return false;
  return !listing.some((other) => other.cardId !== card.cardId && matchStoredCard(stored, other, listing) === StoredCardMatch.SAME_CARD);
}

/** The stored identity of a live row of DB-A2: the USB id it was read by, its serial and its port. */
const boundIdentityOf = (usbId: string, row: BoundAudioInput): StoredCardIdentity => ({ usbId, usbSerial: row.usbSerial, usbPort: row.usbPort });

/**
 * True for a live USB card a later listing could NOT be held against (RM-A5, R-FLEX row 131): its
 * USB id could not be read and was replaced by the listing's fixed word (`CARD_USB_ID_REPLACEMENT`
 * of `capture/adapters/audio/card-listing.ts`, not imported: static rule A-5). Such a row would
 * match no card at runtime (`CARD_UNIDENTIFIED`). A serial-less card with no port IS identified: by its model.
 */
const unidentifiable = (card: ListedAudioCard): boolean => card.usbId === '0000:0000';

/** The changes operation 99 ANSWERS (`RELEASED` is an audit word only). */
type AnsweredChange = CaptureAudioInputRegistration['change'];

export interface AudioInputRegistrationOutcome {
  /** True for a new microphone (`201`); false when the input already had one (`200`). */
  readonly created: boolean;
  readonly registration: CaptureAudioInputRegistration;
}

const MESSAGE_OF_CHANGE: Readonly<Record<CaptureAudioInputChange, (deviceId: string) => string>> = Object.freeze({
  REGISTERED: (deviceId: string) => `Microphone ${deviceId} registered`,
  REENABLED: (deviceId: string) => `Microphone ${deviceId} enabled again`,
  CARD_CHANGED: (deviceId: string) => `Microphone ${deviceId} is on another sound card`,
  RELEASED: (deviceId: string) => `Microphone ${deviceId} released from its old input`,
});

export async function registerAudioInput(seams: AudioCardsSeams, caller: AudioCardsCaller, body: CaptureAudioInputRegisterRequest): Promise<AudioInputRegistrationOutcome> {
  const { host, store } = seams;
  const enumerator = seams.enumerator();
  const registrar = seams.registrar();
  // Everything the unit needs is asked for BEFORE the host is read.
  if (enumerator === null || registrar === null) throw notReady();
  if (host.sessionOpen()) throw locked();

  // THE CORE'S OWN SECOND LISTING: the channel count, the USB id and the product come from it.
  const listing = await listed(seams, enumerator, 'REGISTRATION');
  // The card the request NAMED, and only when exactly one entry carries the card id and the device index.
  const named = listing.cards.filter((entry) => entry.cardId === body.cardId && entry.deviceIndex === body.deviceIndex);
  const card = named.length === 1 ? named[0] : undefined;
  if (card === undefined) throw noCard();
  // An input beyond the card is refused by name: an absent input is never replaced by another (S3-2).
  if (!Number.isInteger(body.inputNumber) || body.inputNumber < 1 || body.inputNumber > card.channelCount) throw beyondCard();
  // A count the listing guessed is never stored (row 64, decision DD-6).
  if (card.factsSource === ASSUMED_CARD_FACTS) throw notRegistrable();
  // A USB card whose USB id could not be read could be held against no later listing (RM-A5): nothing is stored for it.
  if (unidentifiable(card)) throw notIdentifiable();

  const key = { cardId: card.cardId, cardDevice: card.deviceIndex, inputNumber: body.inputNumber };
  const sampleBits = sampleBitsOf(card);

  // ONE UNIT: the registry row, the input row, the audit rows. Anything thrown rolls all of it back.
  const outcome = await host.unit(REGISTER_UNIT_LABEL, async (unit): Promise<{ deviceId: string; change: AnsweredChange; match: StoredCardMatch | null; releasedDeviceId: string | null }> => {
    if (unit.sessionOpen()) throw locked();
    const at = host.now();
    // THE IDENTITY THAT IS STORED: the serial and the port path of the Core's own listing (row 199).
    const usbSerial = identityTextOf(card.usbSerial);
    const usbPort = identityTextOf(card.usbPort);
    const facts = { usbId: card.usbId, usbSerial, usbPort, nativeChannels: card.channelCount, sampleBits, operatorId: caller.operatorId, at };
    const said = (deviceId: string, change: CaptureAudioInputChange, inputNumber: number): Promise<void> =>
      unit.audit({
        type: AuditType.CAPTURE_AUDIO_INPUT_CHANGED,
        message: MESSAGE_OF_CHANGE[change](deviceId),
        actorId: caller.operatorId,
        deviceId,
        details: captureAudioInputChangedDetails({ deviceId, change, inputNumber, channelCount: card.channelCount, permission: Permission.CAPTURE_CONFIG }),
      });
    // The adapter registry of the running operation is told when the unit COMMITTED, never for one that rolled back.
    const admitAfterCommit = (deviceId: string): void => unit.afterCommit(() => seams.admit({ id: deviceId, kind: 'MIC', adapterKind: 'USB_AUDIO', model: card.product }));

    // Steps 1-6 of spec 5.1 (R-FLEX rows 131, 108). Step 6, a session open, was refused above.
    const existing = await store.inputOf(unit.db, key);
    // Step 1: THE HOLDERS OF THE PHYSICAL CARD THAT BLOCK THIS INPUT (DB-A2, live rows only, in MIC
    // id order; decision D48): a holder of the SAME input (card device and input number), or one whose
    // card the rule cannot tell from a twin (`NOT_TELLABLE`, Q96-03: it holds both units whole). A
    // holder of ANOTHER input of a card it is told apart by is no obstacle: one microphone per input.
    // `everyHolder` counts the row under the key too (X-2); `holders` are the OTHER microphones.
    const usbId = card.usbId;
    const blocks = (row: BoundAudioInput, identity: StoredCardIdentity): boolean =>
      holdsCard(identity, card, listing.cards) &&
      ((row.cardDevice === key.cardDevice && row.inputNumber === key.inputNumber) || matchStoredCard(identity, card, listing.cards) !== StoredCardMatch.SAME_CARD);
    const everyHolder = usbId === null ? [] : (await store.boundInputs(unit.db, usbId)).filter((row) => blocks(row, boundIdentityOf(usbId, row)));
    const holders = everyHolder.filter((row) => row.deviceId !== existing?.deviceId);
    const holder = holders[0];

    if (holder === undefined || usbId === null) {
      let deviceId: string;
      let change: AnsweredChange;
      let match: StoredCardMatch | null = null;
      if (existing === null) {
        deviceId = await registrar.register(unit, { model: card.product, at });
        await store.insertInput(unit.db, { ...key, deviceId, ...facts });
        change = CaptureAudioInputChange.REGISTERED;
      } else {
        // The input has its microphone: never duplicated. The card behind the key is held to the
        // identity rule (AD-07 (4)). THE SAME CARD, on any port: enabled again. ANOTHER CARD (another
        // USB id, another serial, a twin that cannot be told) is SAID and NOT enabled again by this
        // call; the stored identity then names this card, so the same call again is a plain re-enable.
        deviceId = existing.deviceId;
        match = matchStoredCard(existing, card, listing.cards);
        change = match === StoredCardMatch.SAME_CARD ? CaptureAudioInputChange.REENABLED : CaptureAudioInputChange.CARD_CHANGED;
        if (match === StoredCardMatch.SAME_CARD) await registrar.reenable(unit, { deviceId, model: card.product, at });
        await store.refreshInput(unit.db, { deviceId, ...facts });
      }
      await said(deviceId, change, body.inputNumber);
      admitAfterCommit(deviceId);
      return { deviceId, change, match, releasedDeviceId: null };
    }

    // ANOTHER MICROPHONE BLOCKS THIS INPUT. The same card at the same input under another kernel key
    // is a PORT MOVE (spec 6.1, D-A4.2): the holder's row follows, no release needed. Anything else (a
    // twin the rule cannot tell apart) is refused, unless the request releases the holder (bundle M).
    const match = matchStoredCard(boundIdentityOf(usbId, holder), card, listing.cards);
    // Step 2: the same card at the same input under another kernel key (RF-A4).
    const portMove = match === StoredCardMatch.SAME_CARD && holder.cardDevice === key.cardDevice && holder.inputNumber === key.inputNumber;
    // Step 3: not a port move, no `release` (AU-R1, scoped to the input by D48).
    if (!portMove && body.release !== true) throw alreadyBound(holder.deviceId);
    // X-2: SEVERAL microphones already block this input (an older database). Nothing is moved, so
    // that no second binding of the input is left behind; refused naming the FIRST of them, the
    // lowest MIC id (DB-A2 order, the rule of operation 98 `boundTo`).
    if (everyHolder.length > 1) throw alreadyBound(everyHolder[0]?.deviceId ?? holder.deviceId);
    // Step 5: the holder moves onto the key, so the key must be free (R-3, D-A4.2/D-A4.4).
    if (existing !== null) throw inputTaken();
    // Step 4 (or step 2): RELEASED for the old input (a release only), REKEY, REFRESH, REENABLED (RF-A3).
    if (!portMove) await said(holder.deviceId, CaptureAudioInputChange.RELEASED, holder.inputNumber);
    await store.rekeyInput(unit.db, { deviceId: holder.deviceId, usbId, usbSerial, usbPort, ...key, operatorId: caller.operatorId, at });
    await store.refreshInput(unit.db, { deviceId: holder.deviceId, ...facts });
    await registrar.reenable(unit, { deviceId: holder.deviceId, model: card.product, at });
    await said(holder.deviceId, CaptureAudioInputChange.REENABLED, body.inputNumber);
    admitAfterCommit(holder.deviceId);
    return { deviceId: holder.deviceId, change: CaptureAudioInputChange.REENABLED, match, releasedDeviceId: portMove ? null : holder.deviceId };
  });

  // Codes, ids and counts: the match is a code of the identity rule, never a serial, a port or a USB id.
  host.note(
    { code: AuditType.CAPTURE_AUDIO_INPUT_CHANGED, source: SOURCE, deviceId: outcome.deviceId, change: outcome.change, ...(outcome.match === null ? {} : { match: outcome.match }), ...(outcome.releasedDeviceId === null ? {} : { releasedDeviceId: outcome.releasedDeviceId }), inputNumber: body.inputNumber, channelCount: card.channelCount },
    'sound-card input registered',
  );
  return {
    created: outcome.change === CaptureAudioInputChange.REGISTERED,
    registration: { deviceId: outcome.deviceId, change: outcome.change, inputNumber: body.inputNumber, channelCount: card.channelCount, releasedDeviceId: outcome.releasedDeviceId },
  };
}
