/**
 * WHAT A STORED-CREDENTIAL CONNECTION TEST DOES WITH THE STREAMS IT JUDGED (task 4 row PR, decision
 * C117; rulings C36 and C61 (1); security AD-06; the function of row 146, `adopted-test.ts`).
 *
 * THE GAP IT CLOSES. A camera's profile list (`capture_devices.profiles`) and its stream rows
 * (`capture_device_streams`) had ONE writer, the adoption. A camera whose list is empty - one
 * registered before the stream rows existed (the data step of migration 0021 emptied old lists),
 * or adopted when no stream half could run - could never be assigned to a slot (no default profile
 * stands in, C36) except by being removed and adopted again. Operation 108 reads the same streams
 * with the same tester; this file is where its reading meets what is stored.
 *
 * THREE CASES, decided INSIDE the unit of work of the test's outcome entry, from what is stored at
 * that moment:
 *   (a) NOTHING IS STORED (an empty list and no stream row): the test stores what the stream
 *       states - by the adoption's own function (`writeAdoptedCameraColumns`: the code rule, the
 *       adoption's one statement, one stream row per judged stream). Nothing is minted here: a
 *       code is the stream test's, exactly as the adoption takes it. `PROFILES_STORED`;
 *   (b) A STATEMENT IS STORED AND THE STREAM STATES SOMETHING ELSE - another set of codes, a
 *       listed code with no stream row, or another codec or picture for a code: NOTHING is stored.
 *       A stored statement is never silently replaced. `STREAM_PROFILE_DIFFERS` (the word of the
 *       sealing notice, one definition), with three counts;
 *   (c) the stored statement and the stream agree: nothing is stored, as before. `PROFILES_AGREE`.
 * And one end that is none of them, `PROFILES_NOT_STORED`: case (a) was due and the write was not
 * made - a session opened while the camera was being asked (the configuration is locked then), the
 * row is gone, or a judged stream is outside the bounds of its table. Nothing is stored; the test
 * keeps its outcome, and the cause is a code.
 *
 * WHAT IS COMPARED: the code (it carries the codec, the picture class and, for H.264, the rate),
 * and the codec, width and height of the code's stream row. NOT compared: the ONVIF tokens and the
 * lens - they are the camera's naming of a stream, not the stream's statement.
 *
 * NOTHING OF A DEVICE LEAVES THIS FILE: a verdict of a closed list and whole numbers. No code of a
 * stream, no token, no address and no text is in a result, a word of the audit message or an error.
 */
import { isSessionActive } from '@dems/shared/sim';
import type { DurableSlices } from '../../db/mapping';
import { STREAM_PROFILE_DIFFERS_REASON, type EngineUnit } from '../../engine';
import { assertAdoptedProfiles, writeAdoptedCameraColumns, type AdoptedCameraStream } from './adoption';

/** The stored list of one camera and the endpoint reference its row holds (handed back unchanged by the write). */
export const READ_STORED_CAMERA_PROFILES = "SELECT onvif_uuid, profiles FROM public.capture_devices WHERE id = $1 AND kind = 'CAMERA'";
/** What each stored code means on the camera: the facts the stream test read when the row was written. */
export const READ_STORED_CAMERA_STREAMS = 'SELECT profile, codec, width, height FROM public.capture_device_streams WHERE device_id = $1';

/** How one test's judged streams stand against what is stored. A closed list. */
export const StoredProfilesVerdict = {
  PROFILES_STORED: 'PROFILES_STORED',
  STREAM_PROFILE_DIFFERS: STREAM_PROFILE_DIFFERS_REASON,
  PROFILES_AGREE: 'PROFILES_AGREE',
  PROFILES_NOT_STORED: 'PROFILES_NOT_STORED',
} as const;
export type StoredProfilesVerdict = (typeof StoredProfilesVerdict)[keyof typeof StoredProfilesVerdict];

/** Why case (a) was due and nothing was written. A closed list. */
export const ProfilesNotStoredCause = {
  SESSION_ACTIVE: 'SESSION_ACTIVE',
  ROW_ABSENT: 'ROW_ABSENT',
  STREAM_OUT_OF_BOUNDS: 'STREAM_OUT_OF_BOUNDS',
} as const;
export type ProfilesNotStoredCause = (typeof ProfilesNotStoredCause)[keyof typeof ProfilesNotStoredCause];

/** The result of one comparison: a verdict and counts. Never a code of a stream. */
export interface StoredProfilesComparison {
  readonly verdict: StoredProfilesVerdict;
  /** Codes the stored list held BEFORE this test. */
  readonly stored: number;
  /** Streams this test judged. */
  readonly stated: number;
  /** Codes that are stored and not stated, stated and not stored, or in both with other facts. 0 unless the verdict is the difference. */
  readonly differing: number;
  /** Only for `PROFILES_NOT_STORED`. */
  readonly cause?: ProfilesNotStoredCause;
}

/** The unit this file works in: the statements of the engine's unit and the state inside it. */
export interface StoredProfilesUnit {
  readonly unit: Pick<EngineUnit['unit'], 'query'>;
  pending(): Pick<DurableSlices, 'session'>;
  /**
   * Row V7: the engine's door for the stored profile list of a camera, bound to THIS unit
   * (`storeCaptureDeviceProfilesIn(scope, change)` in the module's wiring). REQUIRED: a unit that
   * cannot make the device entry state what it stores does not store.
   */
  storeProfiles(change: { readonly deviceId: string; readonly profiles: readonly string[] }): Promise<unknown>;
}

const PROFILE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;

/** The stored list as codes, or null when the column holds anything else (the schema's CHECK refuses that; read as "not a list"). */
function storedCodesOf(list: unknown): readonly string[] | null {
  if (!Array.isArray(list) || list.some((code) => typeof code !== 'string' || !PROFILE_CODE.test(code))) return null;
  return [...new Set(list as string[])];
}

interface StoredStreamFacts {
  readonly codec: unknown;
  readonly width: unknown;
  readonly height: unknown;
}

function storedStreamsOf(rows: readonly unknown[]): ReadonlyMap<string, StoredStreamFacts> {
  const byCode = new Map<string, StoredStreamFacts>();
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue;
    const { profile, codec, width, height } = row as { profile?: unknown; codec?: unknown; width?: unknown; height?: unknown };
    if (typeof profile === 'string') byCode.set(profile, { codec, width, height });
  }
  return byCode;
}

/**
 * THE JUDGEMENT, pure: the stored list, the stored stream rows and the streams of this test.
 * `PROFILES_STORED` here means "nothing is stored: the write is due" - the caller makes it.
 */
export function compareStoredProfiles(storedList: unknown, storedStreamRows: readonly unknown[], stated: readonly AdoptedCameraStream[]): StoredProfilesComparison {
  const codes = storedCodesOf(storedList);
  const streams = storedStreamsOf(storedStreamRows);
  const statedCodes = new Set(stated.map((stream) => stream.code));
  // A column that is no list of codes states nothing this file can read: nothing is written over it.
  if (codes === null) return { verdict: StoredProfilesVerdict.STREAM_PROFILE_DIFFERS, stored: 0, stated: statedCodes.size, differing: statedCodes.size };
  if (codes.length === 0) {
    // (a) Nothing is stored. A stream row WITHOUT a listed code is a stored statement too: it is not written over.
    if (streams.size === 0) return { verdict: StoredProfilesVerdict.PROFILES_STORED, stored: 0, stated: statedCodes.size, differing: 0 };
    return { verdict: StoredProfilesVerdict.STREAM_PROFILE_DIFFERS, stored: 0, stated: statedCodes.size, differing: statedCodes.size };
  }
  let differing = 0;
  for (const code of codes) if (!statedCodes.has(code)) differing += 1;
  for (const stream of stated) {
    const held = codes.includes(stream.code) ? streams.get(stream.code) : undefined;
    // Stated and not listed; listed with no stream row; listed with another codec or picture.
    if (held === undefined || held.codec !== stream.codec || held.width !== stream.width || held.height !== stream.height) differing += 1;
  }
  return { verdict: differing === 0 ? StoredProfilesVerdict.PROFILES_AGREE : StoredProfilesVerdict.STREAM_PROFILE_DIFFERS, stored: codes.length, stated: statedCodes.size, differing };
}

/**
 * THE WORK OF ONE TEST IN ITS UNIT: reads what is stored for `deviceId`, judges `stated` against
 * it and, in case (a) only, stores it by the adoption's function. Called with at least one judged
 * stream. A statement that fails rolls the caller's unit back - the outcome entry with it.
 */
export async function settleStatedProfiles(scope: StoredProfilesUnit, deviceId: string, stated: readonly AdoptedCameraStream[], at: number): Promise<StoredProfilesComparison> {
  const { rows } = await scope.unit.query(READ_STORED_CAMERA_PROFILES, [deviceId]);
  const row = rows[0] as { onvif_uuid?: unknown; profiles?: unknown } | undefined;
  const notStored = (cause: ProfilesNotStoredCause): StoredProfilesComparison => ({ verdict: StoredProfilesVerdict.PROFILES_NOT_STORED, stored: 0, stated: stated.length, differing: 0, cause });
  if (rows.length !== 1 || row === undefined) return notStored(ProfilesNotStoredCause.ROW_ABSENT);
  const compared = compareStoredProfiles(row.profiles, (await scope.unit.query(READ_STORED_CAMERA_STREAMS, [deviceId])).rows, stated);
  if (compared.verdict !== StoredProfilesVerdict.PROFILES_STORED) return compared;

  // (a) The write is due. The configuration is locked while a session is open (step 1 of the test, asked again here:
  // the camera was being asked for seconds in between).
  if (isSessionActive(scope.pending().session)) return notStored(ProfilesNotStoredCause.SESSION_ACTIVE);
  const device = { id: deviceId, endpointRef: typeof row.onvif_uuid === 'string' ? row.onvif_uuid : null, profiles: stated.map((stream) => stream.code), streams: stated, at };
  // The code rule and the bounds of the stream table, asked BEFORE a statement: a stream outside them is not stored
  // and is no fault of the test (the adoption's function asks again, at its write).
  try {
    assertAdoptedProfiles(device);
  } catch {
    return notStored(ProfilesNotStoredCause.STREAM_OUT_OF_BOUNDS);
  }
  await writeAdoptedCameraColumns(scope.unit, device);
  // THE ENGINE'S DEVICE LINE (row V7; request of row PR): the replicated device entry states the list this unit has just
  // written to the row - the SAME codes, in the same order - through the engine's door (`storeCaptureDeviceProfilesIn`),
  // so the slice every client reads and the row commit together and a screen shows the profiles without a restart.
  // A door that refuses or fails rolls this unit back: the row is never ahead of the slice.
  await scope.storeProfiles({ deviceId: device.id, profiles: device.profiles });
  return compared;
}

/**
 * The words the outcome entry's message adds: fixed words and whole numbers. Empty when nothing
 * was stored and nothing differs.
 */
export function storedProfilesWords(compared: StoredProfilesComparison): string {
  if (compared.verdict === StoredProfilesVerdict.PROFILES_STORED) return `; profiles stored: ${String(compared.stated)}`;
  if (compared.verdict === StoredProfilesVerdict.STREAM_PROFILE_DIFFERS) return `; ${STREAM_PROFILE_DIFFERS_REASON}: stored ${String(compared.stored)}, stated ${String(compared.stated)}, differing ${String(compared.differing)}; nothing stored`;
  return '';
}
