/**
 * A START THE CORE REFUSED BECAUSE OF THE SESSION KEY (fix wave I, driver A1: `contract_wave_i.md`
 * section 5; named for the clients by closing pass J, item 7).
 *
 * `startSession` on a Core in real capture can answer `503 NOT_READY` with `details.reason`
 * `SESSION_KEY_NOT_OF_SESSION` (a key of an earlier session with this session number is in the
 * key store) or `SESSION_KEY_STORE_UNAVAILABLE` (the key store cannot be used). Nothing was
 * started; the session stays ARMED and can be cancelled.
 *
 * WHY A READER. A `503 NOT_READY` reaches a client as the transport error of a Core that is not
 * ready (`LiveTransportError`, code `NOT_READY`), which the general presenters word "The Core
 * server is starting". That is wrong for a refused start. The Live source carries the Core's
 * reason code on that error (`detailReason`); `startRefusedReasonOf` reads it BY NAME, and the
 * start handlers of both clients ask it before their presenter and show
 * `common.startRefused.<reason>` - the Core's own two sentences.
 *
 * The reader is structural (no import of the Live error class): this module belongs to the
 * simulator package, which the light Live API imports, never the other way round.
 */

/** The two `details.reason` values, one list for both clients. */
export const START_REFUSED_REASONS = ['SESSION_KEY_NOT_OF_SESSION', 'SESSION_KEY_STORE_UNAVAILABLE'] as const;
export type StartRefusedReason = (typeof START_REFUSED_REASONS)[number];

/** The envelope code of the answer that carries them. */
export const START_REFUSED_CODE = 'NOT_READY';

/** The i18n key of a reason's sentence (block `common.startRefused`). */
export function startRefusedSentenceKey<R extends StartRefusedReason>(reason: R): `common.startRefused.${R}` {
  return `common.startRefused.${reason}`;
}

/**
 * The reason of a refused start, read from the error a Live `startRecording` rejected with: its
 * `code` is `NOT_READY` and its `detailReason` is one of `START_REFUSED_REASONS`. Null for every
 * other error - a Core that IS starting (no reason), another reason, a value that is no error.
 */
export function startRefusedReasonOf(error: unknown): StartRefusedReason | null {
  if (typeof error !== 'object' || error === null) return null;
  const { code, detailReason } = error as { readonly code?: unknown; readonly detailReason?: unknown };
  if (code !== START_REFUSED_CODE || typeof detailReason !== 'string') return null;
  return (START_REFUSED_REASONS as readonly string[]).includes(detailReason) ? (detailReason as StartRefusedReason) : null;
}
