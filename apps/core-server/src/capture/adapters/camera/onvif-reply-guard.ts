/**
 * THE REPLY GUARD of the two ONVIF files (row B1; decision C95; blocking finding B-01 of
 * `verification/060b_m3_review_second_pass.md`; SEC35-33, S13-12, AD-06).
 *
 * WHY IT EXISTS. The ONVIF package reads a device's reply in two synchronous steps: a text
 * replacement that removes the namespace declarations, then the XML parse. The replacement is
 * QUADRATIC for one shape of text - the five letters of a namespace declaration, many times, each
 * far from the next equals sign: it scans from every occurrence to that sign, or to the end of the
 * text. One unauthenticated reply of that shape inside the old 1 MiB cap held the Core's event loop
 * for 41.9 s (measured by the review), and no deadline can end a synchronous step. The package is
 * not changed and is not replaced: a reply is JUDGED HERE, in one pass over its bytes, BEFORE the
 * package is handed any of it.
 *
 * WHAT IS JUDGED, per reply body, as its bytes arrive (constant memory; every byte is looked at
 * once, by two small state machines):
 *
 *   its size             at most the bytes the read it answers needs (`ONVIF_REPLY_MAX_BYTES`);
 *   the namespace shape  after each occurrence of the five letters an equals sign must stand
 *                        within `namespaceNameMaxBytes`, and a double-quoted value that follows
 *                        the sign must close, or its line end, within `namespaceValueMaxBytes`.
 *                        That bounds the work of the package's replacement to a constant per
 *                        occurrence, so to a constant per byte: linear;
 *   its structure        no `<!` but a comment or a CDATA section (so no document type, no entity
 *                        and no notation declaration), no processing instruction but one that
 *                        opens the document, elements nested at most `maxDepth` deep, at most
 *                        `maxElements` elements, `maxAttributes` attributes in all and
 *                        `maxAttributesPerElement` on one element.
 *
 * It does NOT decide whether a reply is well-formed XML: that stays the parser's judgement, and a
 * reply the parser refuses ends as it always did. It only refuses what must not reach the parser.
 *
 * WHAT A REFUSAL IS. A code of the closed list below and nothing else: no byte, no offset and no
 * count of the reply leaves this file, nothing is logged, nothing is kept (AD-06). The two files
 * turn the code into the outcome they already had for a reply that is too large or is no answer.
 *
 * HOW IT IS PUT IN FRONT OF THE PACKAGE (`guardOnvifReplies`). The package makes its requests
 * through the ONE agent the calling file built. The guard wraps that agent's hand-over of a
 * request, so it sees every response of the exchange first, and wraps the response's own
 * subscription call: the package's listeners get a chunk only after the scan admitted it, and get
 * the end of a body only when no chunk of it was refused. No module is imported for that - the
 * agent, the request and the response are named by the three members used. No listener is put on
 * the package's client.
 *
 * Pure but for that wrap: no timer, no clock, no file, no socket, no log.
 */

/** Why a reply was refused. Codes only; never device text. */
export const OnvifReplyRefusal = {
  /** The body is longer than the read it answers needs. */
  OVERSIZED: 'OVERSIZED',
  /** A `<!` that opens neither a comment nor a CDATA section: a document type, an entity, a notation. */
  DECLARATION: 'DECLARATION',
  /** A processing instruction after the document began. */
  INSTRUCTION: 'INSTRUCTION',
  TOO_DEEP: 'TOO_DEEP',
  TOO_MANY_ELEMENTS: 'TOO_MANY_ELEMENTS',
  TOO_MANY_ATTRIBUTES: 'TOO_MANY_ATTRIBUTES',
  /** The shape that makes the package's namespace replacement quadratic. */
  NAMESPACE_SHAPE: 'NAMESPACE_SHAPE',
} as const;
export type OnvifReplyRefusal = (typeof OnvifReplyRefusal)[keyof typeof OnvifReplyRefusal];

/** The structural bounds of one reply. A test passes smaller ones. */
export interface OnvifReplyBounds {
  readonly maxDepth: number;
  readonly maxElements: number;
  readonly maxAttributes: number;
  readonly maxAttributesPerElement: number;
  readonly namespaceNameMaxBytes: number;
  readonly namespaceValueMaxBytes: number;
}

/**
 * The bounds, with what they were fitted to (record `implementation/b1_onvif_reply_bound.md`):
 * the well-formed answers of the fake ONVIF stub nest at most 8 elements and hold at most 88
 * elements and 25 attributes, 5 on one element (measured); the namespace prefixes of an ONVIF
 * envelope are a few letters and its namespace addresses under 100 bytes.
 */
export const ONVIF_REPLY_BOUNDS: OnvifReplyBounds = Object.freeze({
  maxDepth: 32,
  maxElements: 8_192,
  maxAttributes: 4_096,
  maxAttributesPerElement: 128,
  namespaceNameMaxBytes: 48,
  namespaceValueMaxBytes: 512,
});

/**
 * The largest body of a reply, by the device operation it answers. The gateway set includes the
 * package's own read-back of the gateway. A name that is not listed gets the smallest value.
 *
 * MEASURED on the fake ONVIF stub (bytes of the well-formed answer): clock 773, services 836,
 * capabilities 588, profiles 1,012 (one profile) and 3,635 (four profiles, about 900 a profile),
 * stream address 586, interfaces 778, interface set 431, gateway set 360 and its read-back 484,
 * reboot 410. The caps are 20 to 100 times those: a real device writes a longer envelope and more
 * members (the profile list is read to 16 profiles; 128 KiB is 8 KiB a profile). The sizes of the
 * bench cameras' answers are NOT known here - hardware check; a camera whose answer is refused by
 * size ends as the byte cap does, by name, and nothing else changes.
 */
export const ONVIF_REPLY_MAX_BYTES: Readonly<Record<string, number>> = Object.freeze({
  GetSystemDateAndTime: 16 * 1024,
  GetServices: 64 * 1024,
  GetCapabilities: 64 * 1024,
  GetProfiles: 128 * 1024,
  GetStreamUri: 16 * 1024,
  GetNetworkInterfaces: 64 * 1024,
  SetNetworkInterfaces: 16 * 1024,
  SetNetworkDefaultGateway: 16 * 1024,
  SystemReboot: 16 * 1024,
});
const SMALLEST_REPLY_BYTES = 16 * 1024;

/** The cap of the reply to one operation: its listed value, never above `ceiling` (the calling file's own byte limit). */
export function onvifReplyMaxBytes(operation: string | null, ceiling: number): number {
  const listed = operation !== null && Object.hasOwn(ONVIF_REPLY_MAX_BYTES, operation) ? ONVIF_REPLY_MAX_BYTES[operation] : undefined;
  return Math.max(0, Math.min(listed ?? SMALLEST_REPLY_BYTES, ceiling));
}

/** The scan of ONE reply body. `push` answers null for a chunk that may be handed on; after a refusal it answers that refusal for ever. */
export interface OnvifReplyScan {
  push(chunk: Uint8Array): OnvifReplyRefusal | null;
}

const LT = 0x3c;
const GT = 0x3e;
const SLASH = 0x2f;
const BANG = 0x21;
const QUERY = 0x3f;
const EQUALS = 0x3d;
const DOUBLE_QUOTE = 0x22;
const SINGLE_QUOTE = 0x27;
const DASH = 0x2d;
const BRACKET_OPEN = 0x5b;
const BRACKET_CLOSE = 0x5d;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;
/** The five letters. No proper prefix of them is also their suffix, so a mismatch restarts at the first letter or at none. */
const FIVE_LETTERS: readonly number[] = [0x78, 0x6d, 0x6c, 0x6e, 0x73];
/** What may follow `<![`. */
const CDATA_WORD: readonly number[] = [0x43, 0x44, 0x41, 0x54, 0x41, BRACKET_OPEN];

/** How many of the five letters stand matched after `byte`, having had `matched` before it. */
const lettersAfter = (matched: number, byte: number): number => (byte === FIVE_LETTERS[matched] ? matched + 1 : byte === FIVE_LETTERS[0] ? 1 : 0);

// The states of the structure machine.
const TEXT = 0;
const AFTER_LT = 1;
const START_TAG = 2;
const START_TAG_DOUBLE = 3;
const START_TAG_SINGLE = 4;
const END_TAG = 5;
const AFTER_BANG = 6;
const COMMENT_OPENING = 7;
const CDATA_OPENING = 8;
const COMMENT = 9;
const CDATA = 10;
const INSTRUCTION = 11;

/**
 * One reply body, judged as it arrives. Linear in the bytes pushed and constant in memory: each
 * byte moves two small machines by one step, and neither ever looks back.
 */
export function createOnvifReplyScan(maxBytes: number, bounds: OnvifReplyBounds = ONVIF_REPLY_BOUNDS): OnvifReplyScan {
  let refusal: OnvifReplyRefusal | null = null;
  let seen = 0;

  // ── The structure ──
  let state = TEXT;
  let markupSeen = false;
  let depth = 0;
  let elements = 0;
  let attributes = 0;
  let attributesHere = 0;
  /** The byte before this one, inside a start tag, a comment, a CDATA section or an instruction. */
  let previous = 0;
  /** Consecutive closing marks (`-` or `]`) just before this byte, or the letters of the CDATA word matched. */
  let run = 0;

  // ── The namespace shape: what the package's replacement would do, bounded ──
  /** Letters of the five matched outside a value. */
  let letters = 0;
  /** Bytes since the EARLIEST occurrence that has met no equals sign yet; -1 when there is none. */
  let waiting = -1;
  /** The byte before this one ended a wait with its equals sign. */
  let afterEquals = false;
  /** Bytes inside a double-quoted value that followed such a sign; -1 outside one. */
  let value = -1;
  /** Inside a value: letters matched, and bytes since the earliest occurrence there that met no equals sign. */
  let innerLetters = 0;
  let innerWaiting = -1;

  const structure = (byte: number): OnvifReplyRefusal | null => {
    switch (state) {
      case TEXT:
        if (byte === LT) state = AFTER_LT;
        return null;
      case AFTER_LT:
        if (byte === QUERY) {
          // The XML declaration opens a document; anything of the kind later is not part of a SOAP message.
          if (markupSeen) return OnvifReplyRefusal.INSTRUCTION;
          markupSeen = true;
          state = INSTRUCTION;
          previous = 0;
          return null;
        }
        markupSeen = true;
        if (byte === SLASH) {
          if (depth > 0) depth -= 1;
          state = END_TAG;
          return null;
        }
        if (byte === BANG) {
          state = AFTER_BANG;
          return null;
        }
        elements += 1;
        if (elements > bounds.maxElements) return OnvifReplyRefusal.TOO_MANY_ELEMENTS;
        depth += 1;
        if (depth > bounds.maxDepth) return OnvifReplyRefusal.TOO_DEEP;
        attributesHere = 0;
        previous = byte;
        // `<>`: no name. The parser refuses it; the element was counted and is closed here.
        state = byte === GT ? TEXT : START_TAG;
        return null;
      case START_TAG:
        if (byte === GT) {
          if (previous === SLASH && depth > 0) depth -= 1;
          state = TEXT;
        } else if (byte === DOUBLE_QUOTE) state = START_TAG_DOUBLE;
        else if (byte === SINGLE_QUOTE) state = START_TAG_SINGLE;
        else if (byte === EQUALS) {
          attributes += 1;
          attributesHere += 1;
          if (attributes > bounds.maxAttributes || attributesHere > bounds.maxAttributesPerElement) return OnvifReplyRefusal.TOO_MANY_ATTRIBUTES;
        }
        previous = byte;
        return null;
      case START_TAG_DOUBLE:
        if (byte === DOUBLE_QUOTE) {
          state = START_TAG;
          previous = byte;
        }
        return null;
      case START_TAG_SINGLE:
        if (byte === SINGLE_QUOTE) {
          state = START_TAG;
          previous = byte;
        }
        return null;
      case END_TAG:
        if (byte === GT) state = TEXT;
        return null;
      case AFTER_BANG:
        if (byte === DASH) state = COMMENT_OPENING;
        else if (byte === BRACKET_OPEN) {
          state = CDATA_OPENING;
          run = 0;
        } else return OnvifReplyRefusal.DECLARATION;
        return null;
      case COMMENT_OPENING:
        if (byte !== DASH) return OnvifReplyRefusal.DECLARATION;
        state = COMMENT;
        run = 0;
        return null;
      case CDATA_OPENING:
        if (byte !== CDATA_WORD[run]) return OnvifReplyRefusal.DECLARATION;
        run += 1;
        if (run === CDATA_WORD.length) {
          state = CDATA;
          run = 0;
        }
        return null;
      case COMMENT:
        if (byte === GT && run >= 2) state = TEXT;
        run = byte === DASH ? run + 1 : 0;
        return null;
      case CDATA:
        if (byte === GT && run >= 2) state = TEXT;
        run = byte === BRACKET_CLOSE ? run + 1 : 0;
        return null;
      default:
        // INSTRUCTION
        if (byte === GT && previous === QUERY) state = TEXT;
        previous = byte;
        return null;
    }
  };

  const namespaceShape = (byte: number): OnvifReplyRefusal | null => {
    if (value >= 0) {
      if (byte === DOUBLE_QUOTE) {
        // The value closed: the replacement takes the whole declaration, with whatever stood inside it.
        value = -1;
        innerWaiting = -1;
        innerLetters = 0;
        letters = 0;
        return null;
      }
      if (byte === LINE_FEED || byte === CARRIAGE_RETURN) {
        // The value did not close on its line: the replacement gives this declaration up and tries the occurrences inside it.
        value = -1;
        waiting = innerWaiting;
        innerWaiting = -1;
        innerLetters = 0;
        letters = 0;
        return waiting > bounds.namespaceNameMaxBytes ? OnvifReplyRefusal.NAMESPACE_SHAPE : null;
      }
      value += 1;
      if (value > bounds.namespaceValueMaxBytes) return OnvifReplyRefusal.NAMESPACE_SHAPE;
      if (innerWaiting >= 0) innerWaiting = byte === EQUALS ? -1 : innerWaiting + 1;
      innerLetters = lettersAfter(innerLetters, byte);
      if (innerLetters === FIVE_LETTERS.length) {
        innerLetters = 0;
        if (innerWaiting < 0) innerWaiting = 0;
      }
      return null;
    }
    if (afterEquals) {
      afterEquals = false;
      if (byte === DOUBLE_QUOTE) {
        value = 0;
        innerWaiting = -1;
        innerLetters = 0;
        letters = 0;
        return null;
      }
    }
    if (waiting >= 0) {
      if (byte === EQUALS) {
        waiting = -1;
        afterEquals = true;
      } else {
        waiting += 1;
        if (waiting > bounds.namespaceNameMaxBytes) return OnvifReplyRefusal.NAMESPACE_SHAPE;
      }
    }
    letters = lettersAfter(letters, byte);
    if (letters === FIVE_LETTERS.length) {
      letters = 0;
      if (waiting < 0) waiting = 0;
    }
    return null;
  };

  const push = (chunk: Uint8Array): OnvifReplyRefusal | null => {
    if (refusal !== null) return refusal;
    // The bytes inside the cap are judged first, so that a body of a refused shape is named by its shape whatever the
    // size of the chunks it arrived in; what stands above the cap is never looked at.
    const inside = Math.max(0, Math.min(chunk.length, maxBytes - seen));
    for (let index = 0; index < inside; index += 1) {
      const byte = chunk[index] ?? 0;
      refusal = structure(byte) ?? namespaceShape(byte);
      if (refusal !== null) return refusal;
    }
    seen += chunk.length;
    if (seen > maxBytes) refusal = OnvifReplyRefusal.OVERSIZED;
    return refusal;
  };

  return Object.freeze({ push });
}

/** A whole body at once: null when it may be handed to the package. */
export function scanOnvifReply(body: Uint8Array, maxBytes: number, bounds: OnvifReplyBounds = ONVIF_REPLY_BOUNDS): OnvifReplyRefusal | null {
  return createOnvifReplyScan(maxBytes, bounds).push(body);
}

type Listener = (...values: unknown[]) => void;
/** What a response is to this file: a stream whose subscription call can be wrapped, and that can be destroyed. */
interface GuardedResponse {
  on(event: string, listener: Listener): unknown;
  destroy(): unknown;
}
/** What a request is to this file: the one event that hands its response over. */
interface GuardedRequest {
  prependOnceListener(event: 'response', listener: (response: GuardedResponse) => void): unknown;
}
type AddRequest = (this: unknown, request: GuardedRequest, ...rest: unknown[]) => unknown;

const isChunk = (value: unknown): value is Uint8Array => value instanceof Uint8Array;

/**
 * Puts the scan in front of EVERY response that comes through `agent` (the one agent of an
 * exchange). `maxBytesOfReply` is asked once per response, when its head arrived. A refused reply:
 * the response is destroyed, `refuse` is told the code ONCE for that reply, and the package is
 * handed neither the refused chunk nor any later one nor the end of the body - so it never parses
 * that reply. A body that is not bytes (a decoded stream) is refused as oversized: the package sets
 * no decoding, so that is a body this file cannot judge.
 */
export function guardOnvifReplies(agent: object, maxBytesOfReply: () => number, refuse: (refusal: OnvifReplyRefusal) => void, bounds: OnvifReplyBounds = ONVIF_REPLY_BOUNDS): void {
  const addRequest = Reflect.get(agent, 'addRequest') as AddRequest;
  Object.assign(agent, {
    addRequest(request: GuardedRequest, ...rest: unknown[]): unknown {
      request.prependOnceListener('response', (response) => {
        const scan = createOnvifReplyScan(maxBytesOfReply(), bounds);
        const subscribe = response.on.bind(response);
        let refused = false;
        /** The chunk judged last: a chunk is scanned once, however many listeners ask for it. */
        let judged: unknown;
        const admitted = (chunk: unknown): boolean => {
          if (refused) return false;
          if (chunk === judged) return true;
          judged = chunk;
          const refusal = isChunk(chunk) ? scan.push(chunk) : OnvifReplyRefusal.OVERSIZED;
          if (refusal === null) return true;
          refused = true;
          response.destroy();
          refuse(refusal);
          return false;
        };
        Object.assign(response, {
          on(event: string, listener: Listener): unknown {
            if (event === 'data') {
              return subscribe(event, (chunk: unknown) => {
                if (admitted(chunk)) listener(chunk);
              });
            }
            if (event === 'end') {
              return subscribe(event, () => {
                if (!refused) listener();
              });
            }
            return subscribe(event, listener);
          },
        });
      });
      return addRequest.call(agent, request, ...rest);
    },
  });
}
