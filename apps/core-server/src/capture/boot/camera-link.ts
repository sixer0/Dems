/**
 * THE LINK OF THE CAMERA INTERFACE, as the kernel states it (audit 2026-11-05 blueprint row 101; defect DF-24;
 * decision D23 (1)). Decision D62 point 1 asked for a sweep "on PoE link-up"; only the 60 s interval was built,
 * because nothing in the Core could see the link. This file is that eye, and nothing more: it READS two files of the
 * kernel's network class below `<root>/<interface>/` and says whether the cable of the camera interface has a
 * carrier. Acting on the answer (an immediate sweep on link-up, silence while down, the LINK_DOWN/UP audit) is row 102's.
 *
 *   <root>/<interface>/carrier     "1" with a carrier, "0" without; the kernel refuses the read (EINVAL) while the
 *                                  interface is administratively down, which is a link without a carrier too
 *   <root>/<interface>/operstate   one word of RFC 2863: up, down, lowerlayerdown, notpresent, dormant, testing, unknown
 *
 * THE SEAM. It sits beside the host-runner seam of the boot (`host-facts.ts`) and, like it, opens no door for its
 * caller: a caller gets a source of readings, not the means to read a file of its choosing. The interface name is the
 * only text in a path and is held to the one form of an interface name (`CAPTURE_INTERFACE_NAME_PATTERN`, the stored
 * row's check); `root` is the kernel's directory, and a test hands in a directory of fixed files instead (the fake
 * sysfs tree). Row 102 may equally hand its sweeper an object of the `CameraLinkSource` shape.
 *
 * READ ONLY, NO PRIVILEGE. Each file is opened for reading, read up to a small bound and closed; nothing is written,
 * created or removed, no process is started, no timer is set and nothing is logged (the capture folder logs in one
 * place). The two files are world-readable on Linux. Pinned in static rule G-R2 (`src/capture/__tests__/static.test.ts`)
 * as the reader of the camera link, by decision D23 (1). A reading never throws: what cannot be read is `UNKNOWN`
 * with the system's short code, and the caller decides (row 102: an unknown link keeps the 60 s sweep).
 *
 * NOT PROVEN WITHOUT THE HOST'S CABLE: that a replug of the camera's PoE port flips `carrier` on the installed
 * interface (live proof, row 47 / DF-47).
 */
import { open } from 'node:fs/promises';
import { CAPTURE_INTERFACE_NAME_PATTERN } from '@dems/shared/api';

/** The kernel's network class on a Linux host. */
export const CAMERA_LINK_ROOT = '/sys/class/net';
/** More text than this is not one of the two answers. */
export const CAMERA_LINK_TEXT_LIMIT = 64;

/** What the link of the camera interface is. */
export const CameraLinkState = Object.freeze({
  /** A carrier: a cable is in and the far end (the PoE switch or the camera) answers. */
  UP: 'UP',
  /** No carrier, or the interface is administratively down. */
  DOWN: 'DOWN',
  /** The kernel has no interface of that name. */
  ABSENT: 'ABSENT',
  /** The files could not be read or said something else. The caller must not take it for DOWN. */
  UNKNOWN: 'UNKNOWN',
} as const);
export type CameraLinkState = (typeof CameraLinkState)[keyof typeof CameraLinkState];

/** The words `operstate` may hold; any other text is not reported. */
export const CAMERA_LINK_OPERSTATES = Object.freeze(['up', 'down', 'lowerlayerdown', 'notpresent', 'dormant', 'testing', 'unknown'] as const);
export type CameraLinkOperstate = (typeof CAMERA_LINK_OPERSTATES)[number];

export interface CameraLinkReading {
  readonly state: CameraLinkState;
  /** The word of `operstate`, or null when it is absent, unreadable or not one of the known words. */
  readonly operstate: CameraLinkOperstate | null;
  /** For `UNKNOWN` only: the system's short code (`EACCES`) or `UNCLEAR` for a text of another form. Otherwise null. */
  readonly reason: string | null;
}

/** A source of readings of ONE interface. Production: `createCameraLinkSource`; a test: any object of this shape. */
export interface CameraLinkSource {
  readonly interfaceName: string;
  read(): Promise<CameraLinkReading>;
}

/** What one file gave: its trimmed text, or why there is none. */
export type CameraLinkFileFact = { readonly text: string } | { readonly missing: 'ABSENT' | 'REFUSED_WHILE_DOWN' } | { readonly failed: string };

const ABSENT_CODES = new Set(['ENOENT', 'ENOTDIR']);
const SHORT_CODE = /^[A-Z0-9_]{1,32}$/;
const UNCLEAR = 'UNCLEAR';

const operstateOf = (fact: CameraLinkFileFact): CameraLinkOperstate | null => {
  if (!('text' in fact)) return null;
  return (CAMERA_LINK_OPERSTATES as readonly string[]).includes(fact.text) ? (fact.text as CameraLinkOperstate) : null;
};

/**
 * THE JUDGEMENT, a pure function of the two file facts. The carrier decides; `operstate` decides only when the carrier
 * file is absent (an interface type without one), and then only its two plain answers count.
 */
export function cameraLinkReadingOf(carrier: CameraLinkFileFact, operstate: CameraLinkFileFact): CameraLinkReading {
  const word = operstateOf(operstate);
  const unknown = (reason: string): CameraLinkReading => Object.freeze({ state: CameraLinkState.UNKNOWN, operstate: word, reason });
  const known = (state: CameraLinkState): CameraLinkReading => Object.freeze({ state, operstate: word, reason: null });
  // No directory of the interface: both files are absent.
  if ('missing' in operstate && operstate.missing === 'ABSENT' && 'missing' in carrier && carrier.missing === 'ABSENT') return known(CameraLinkState.ABSENT);
  if ('text' in carrier) {
    if (carrier.text === '1') return known(CameraLinkState.UP);
    if (carrier.text === '0') return known(CameraLinkState.DOWN);
    return unknown(UNCLEAR);
  }
  if ('missing' in carrier && carrier.missing === 'REFUSED_WHILE_DOWN') return known(CameraLinkState.DOWN);
  if ('failed' in carrier) return unknown(carrier.failed);
  // The carrier file is absent while the interface is there: the operational state alone.
  if (word === 'up') return known(CameraLinkState.UP);
  if (word === 'down' || word === 'lowerlayerdown' || word === 'notpresent') return known(CameraLinkState.DOWN);
  return unknown('failed' in operstate ? operstate.failed : UNCLEAR);
}

/** One file, read for reading only, up to the bound. `refusedWhileDown`: EINVAL is the kernel's "administratively down". */
async function readFact(file: string, refusedWhileDown: boolean): Promise<CameraLinkFileFact> {
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    handle = await open(file, 'r');
    const bytes = Buffer.alloc(CAMERA_LINK_TEXT_LIMIT + 1);
    let length = 0;
    while (length < bytes.length) {
      const { bytesRead } = await handle.read(bytes, length, bytes.length - length, null);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length > CAMERA_LINK_TEXT_LIMIT) return { failed: UNCLEAR };
    return { text: bytes.subarray(0, length).toString('utf8').trim() };
  } catch (error) {
    const code = typeof (error as { code?: unknown } | null)?.code === 'string' ? (error as { code: string }).code : '';
    if (ABSENT_CODES.has(code)) return { missing: 'ABSENT' };
    if (refusedWhileDown && code === 'EINVAL') return { missing: 'REFUSED_WHILE_DOWN' };
    return { failed: SHORT_CODE.test(code) ? code : 'UNKNOWN' };
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

/**
 * The source of readings of the camera interface `interfaceName`. Refuses a name of any other form at once
 * (`RangeError`): no text that is not an interface name ever becomes part of a path (the form starts with a letter or
 * digit, so neither `.` nor `..` passes). Production hands in no `root`.
 */
export function createCameraLinkSource(interfaceName: string, root: string = CAMERA_LINK_ROOT): CameraLinkSource {
  if (!CAPTURE_INTERFACE_NAME_PATTERN.test(interfaceName)) {
    throw new RangeError('the camera interface is named by one interface name');
  }
  const directory = `${root}/${interfaceName}`;
  return Object.freeze({
    interfaceName,
    async read(): Promise<CameraLinkReading> {
      const [carrier, operstate] = await Promise.all([readFact(`${directory}/carrier`, true), readFact(`${directory}/operstate`, false)]);
      return cameraLinkReadingOf(carrier, operstate);
    },
  });
}
