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
 * THE MATCH OF A STORED INPUT TO A LIVE CARD (row 156, AD-07 (4)): an input is found by its exact
 * stored key (card id, device index, input number) and the card behind that key is then held to
 * the identity rule `matchStoredCard` - the USB id and, where the system offers one and the store
 * holds one, the USB port path. Anything but the same card is said as CARD_CHANGED, so that no
 * other card is ever taken silently. `capture_audio_inputs` has NO port column today: the store of
 * this module answers no port, and the rule then matches by the USB id and says NOT_TELLABLE when
 * the host holds two cards of it (the request for the column is filed).
 *
 * WHAT IS NOT HERE (stated, with its row). THE REGISTRY ROW (`capture_devices`) is
 * written by the registrar handed in (`MicrophoneRegistrar`), never by a statement of this module
 * (static rule SEC35-41 (c)). The product's registrar is `registrar.ts` (task 4 rows 185 and 190):
 * the engine's INTERNAL action `registerCaptureMicrophone` in the unit of the registration.
 */
import {
  ApiErrorCode,
  CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS,
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
import type { MicrophoneStore, Queryable, RegisteredAudioInput } from './store';

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

/** One card of the listing as the contract answers it. Every string is the listing's own result. */
function cardAnswer(card: ListedAudioCard, registered: readonly RegisteredAudioInput[]): CaptureAudioCard {
  return {
    cardId: card.cardId,
    deviceIndex: card.deviceIndex,
    usbId: card.usbId,
    product: card.product,
    channelCount: card.channelCount,
    sampleBits: [...card.sampleBits],
    registered: registered
      .filter((input) => input.cardId === card.cardId && input.cardDevice === card.deviceIndex)
      .map((input) => ({ inputNumber: input.inputNumber, deviceId: input.deviceId }))
      .sort((left, right) => left.inputNumber - right.inputNumber),
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
  const cards = listing.cards.map((card) => cardAnswer(card, registered));
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
 * What the Core can say of the live card behind the key of a stored input. Only `SAME_CARD` is a
 * match; every other answer is SAID (`CARD_CHANGED`, one audit entry) and never taken silently.
 */
export const StoredCardMatch = {
  /** The USB id is the stored one and, where both sides state a port path, the port is the stored one. */
  SAME_CARD: 'SAME_CARD',
  /** Another USB id behind the key: another product took the place. */
  USB_ID_DIFFERS: 'USB_ID_DIFFERS',
  /** The stored USB id on ANOTHER port: a card of the same product, not the card that was registered. */
  PORT_DIFFERS: 'PORT_DIFFERS',
  /** No port to compare on one side, and the host holds a second card of that USB id: the USB id alone cannot tell them apart. */
  NOT_TELLABLE: 'NOT_TELLABLE',
} as const;
export type StoredCardMatch = (typeof StoredCardMatch)[keyof typeof StoredCardMatch];

const portOf = (value: string | null | undefined): string | null => (typeof value === 'string' && value !== '' ? value : null);

/**
 * THE IDENTITY RULE. A stored input is matched to a live card by its USB id AND its USB port path
 * where the system offers one (the listing's `usbPort`, row 64) and the store holds one. Never by
 * the product text, and never by the card id alone: the kernel derives that id from the product,
 * so a second card of the same product can sit behind the stored key.
 *
 *   USB id differs                              USB_ID_DIFFERS
 *   both ports stated, they differ              PORT_DIFFERS
 *   both ports stated, they are equal           SAME_CARD
 *   a port is missing on one side               SAME_CARD by the USB id - unless the listing holds
 *                                               ANOTHER card of that USB id: NOT_TELLABLE
 *   no USB id on either side (not a USB card)   SAME_CARD: the key is all such a card has
 */
export function matchStoredCard(stored: { readonly usbId: string | null; readonly usbPort?: string | null }, card: ListedAudioCard, listing: readonly ListedAudioCard[]): StoredCardMatch {
  if (stored.usbId !== card.usbId) return StoredCardMatch.USB_ID_DIFFERS;
  const storedPort = portOf(stored.usbPort);
  const livePort = portOf(card.usbPort);
  if (storedPort !== null && livePort !== null) return storedPort === livePort ? StoredCardMatch.SAME_CARD : StoredCardMatch.PORT_DIFFERS;
  if (card.usbId !== null && listing.some((other) => other.cardId !== card.cardId && other.usbId === card.usbId)) return StoredCardMatch.NOT_TELLABLE;
  return StoredCardMatch.SAME_CARD;
}

export interface AudioInputRegistrationOutcome {
  /** True for a new microphone (`201`); false when the input already had one (`200`). */
  readonly created: boolean;
  readonly registration: CaptureAudioInputRegistration;
}

const MESSAGE_OF_CHANGE: Readonly<Record<CaptureAudioInputChange, (deviceId: string) => string>> = Object.freeze({
  REGISTERED: (deviceId: string) => `Microphone ${deviceId} registered`,
  REENABLED: (deviceId: string) => `Microphone ${deviceId} enabled again`,
  CARD_CHANGED: (deviceId: string) => `Microphone ${deviceId} is on another sound card`,
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

  const key = { cardId: card.cardId, cardDevice: card.deviceIndex, inputNumber: body.inputNumber };
  const sampleBits = sampleBitsOf(card);

  // ONE UNIT: the registry row, the input row, the audit row. Anything thrown rolls all of it back.
  const outcome = await host.unit(REGISTER_UNIT_LABEL, async (unit) => {
    if (unit.sessionOpen()) throw locked();
    const at = host.now();
    const existing = await store.inputOf(unit.db, key);
    let deviceId: string;
    let change: CaptureAudioInputChange;
    let match: StoredCardMatch | null = null;
    const usbPort = portOf(card.usbPort);
    if (existing === null) {
      deviceId = await registrar.register(unit, { model: card.product, at });
      await store.insertInput(unit.db, { ...key, deviceId, usbId: card.usbId, usbPort, nativeChannels: card.channelCount, sampleBits, operatorId: caller.operatorId, at });
      change = CaptureAudioInputChange.REGISTERED;
    } else {
      // The input has its microphone: re-enabled, never duplicated. A card behind the same key
      // that is not the registered one by the identity rule - another USB id, the same product on
      // another port, or a card the USB id alone cannot tell apart - is SAID (AD-07 (4)), never
      // taken silently.
      deviceId = existing.deviceId;
      match = matchStoredCard(existing, card, listing.cards);
      change = match === StoredCardMatch.SAME_CARD ? CaptureAudioInputChange.REENABLED : CaptureAudioInputChange.CARD_CHANGED;
      await registrar.reenable(unit, { deviceId, model: card.product, at });
      await store.refreshInput(unit.db, { deviceId, usbId: card.usbId, usbPort, nativeChannels: card.channelCount, sampleBits, operatorId: caller.operatorId, at });
    }
    await unit.audit({
      type: AuditType.CAPTURE_AUDIO_INPUT_CHANGED,
      message: MESSAGE_OF_CHANGE[change](deviceId),
      actorId: caller.operatorId,
      deviceId,
      details: captureAudioInputChangedDetails({ deviceId, change, inputNumber: body.inputNumber, channelCount: card.channelCount, permission: Permission.CAPTURE_CONFIG }),
    });
    // The adapter registry of the running operation is told when the unit COMMITTED, never for one that rolled back.
    unit.afterCommit(() => seams.admit({ id: deviceId, kind: 'MIC', adapterKind: 'USB_AUDIO', model: card.product }));
    return { deviceId, change, match };
  });

  // Codes, ids and counts: the match is a code of the identity rule, never a port or a USB id.
  host.note(
    { code: AuditType.CAPTURE_AUDIO_INPUT_CHANGED, source: SOURCE, deviceId: outcome.deviceId, change: outcome.change, ...(outcome.match === null ? {} : { match: outcome.match }), inputNumber: body.inputNumber, channelCount: card.channelCount },
    'sound-card input registered',
  );
  return {
    created: outcome.change === CaptureAudioInputChange.REGISTERED,
    registration: { deviceId: outcome.deviceId, change: outcome.change, inputNumber: body.inputNumber, channelCount: card.channelCount },
  };
}
