/**
 * THE INGEST ADDRESS OF A CAMERA TRACK: ONE FUNCTION, IN A UNIT THAT IMPORTS NOTHING (task 4 row 47,
 * moved here by integration pass I-3; BR-07 (1), (3); design addendum section 5.3).
 *
 * Until this file the function stood in the session unit (`src/capture-session/index.ts`). The
 * supervisor needs the same function for a later attempt of a session (row 179) and cannot import
 * the session unit, so the function lives here: the session reaches it through the index of the
 * capture unit, the supervisor's own files by a relative import.
 *
 * WHAT THE ADDRESS IS. Host `127.0.0.1`, the loopback port of the track, the session, the track in
 * lower case, and a last element of 128 bits: no trailing slash, no query, nothing to decode.
 * Whoever pushes must announce this string byte for byte, so it is built once per track and
 * attempt and handed on unchanged: never rebuilt, parsed or re-encoded. It is a secret of the
 * session; this file hands it to its caller and to nobody else.
 *
 * WHERE THE CHANCE COMES FROM: THE CALLER. Static rule G-R8 of the capture folder lets no file of
 * it draw a random number or import a source of one (the signer's key file is the one pinned
 * exception). So this file imports nothing and draws nothing: the caller hands in the function
 * that draws (`chance`), which in the product is `randomBytes` of the runtime's cryptography
 * module, named in the caller's own file. A draw of another length is refused, so that a short or
 * empty element can never be built.
 *
 * This file starts nothing, logs nothing, reads no clock, no file and no environment.
 */

/** The camera tracks that have an ingest listener. */
export type CaptureIngestTrackId = 'VIDEO-01' | 'VIDEO-02';

/** The loopback port of each track's ingest: inside the protocol's media range, one per camera. */
export const CAPTURE_INGEST_PORT: Readonly<Record<CaptureIngestTrackId, number>> = Object.freeze({ 'VIDEO-01': 8554, 'VIDEO-02': 8556 });

/**
 * How many bytes of the system's random source the last path element of an ingest address holds
 * (BR-07 (1): at least 128 bits). Written as URL-safe base64 without padding: 22 characters of
 * `A-Z a-z 0-9 - _`, all inside the address grammar of the worker and of the protocol.
 */
export const CAPTURE_INGEST_SECRET_BYTES = 16;

/** The source of chance of an ingest address: asked for a number of bytes, it answers exactly that many. */
export type CaptureIngestChance = (bytes: number) => Uint8Array;

/** `message` of the error of a source of chance that did not answer the bytes it was asked for. */
export const CAPTURE_INGEST_CHANCE_REFUSED = 'CAPTURE_INGEST_CHANCE_REFUSED';

/** The scheme of an ingest address, and the worker's listener host: the address is composed from them at one line. */
const INGEST_SCHEME = 'rtsp:';
const INGEST_HOST = '127.0.0.1';

/**
 * THE ONE FUNCTION THAT BUILDS THE INGEST ADDRESS OF A CAMERA TRACK. The last element is new at
 * every call: `chance` is asked once, for `CAPTURE_INGEST_SECRET_BYTES` bytes.
 */
export function captureIngestAddress(sessionId: string, trackId: CaptureIngestTrackId, chance: CaptureIngestChance): string {
  const drawn = chance(CAPTURE_INGEST_SECRET_BYTES);
  if (!(drawn instanceof Uint8Array) || drawn.length !== CAPTURE_INGEST_SECRET_BYTES) throw new Error(CAPTURE_INGEST_CHANCE_REFUSED);
  return `${INGEST_SCHEME}//${INGEST_HOST}:${CAPTURE_INGEST_PORT[trackId]}/${sessionId}/${trackId.toLowerCase()}/${Buffer.from(drawn).toString('base64url')}`;
}
