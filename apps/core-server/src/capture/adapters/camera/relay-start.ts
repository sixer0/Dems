/**
 * THE RELAY START: the one caller of the injection point (task 4 blueprint row 46, work package
 * WP-06b; design addendum 2.3 step 3 and step 4; security AD-03 point 6, BR-07 (3) and (4),
 * S13-02 (d); the form of the start message is the relay's own contract,
 * `implementation/041_relay_record_mode.md` section 3 with the member of row 42).
 *
 * WHAT THIS FILE DOES. It joins the locator of a camera's stream and the opaque credential at
 * `credentialAtInjection` - the ONLY call of that function in the product - puts the result as
 * one member into the start message of the capture relay, and hands the message to the
 * production process door. The door makes the bytes, writes them to the relay's standard input,
 * zero-fills them and keeps the pipe open; its end is the relay's order to stop.
 *
 * WHAT IT NEVER DOES. It reads no member of a credential and makes no text of the message: the
 * message is an object of plain values and the opaque stream access, and `startMessageBytes` of
 * `../credential.ts` is its one reader (called by the door). The relay is started with NO
 * argument and an EMPTY environment: the locator, the account and the ingest address of the
 * session exist in the start message and nowhere else of the process.
 *
 * THE INGEST ADDRESS is the session's, handed through unchanged: the relay announces the
 * byte-identical text (BR-07 (3)). It is a secret of the session attempt. This file gives it to
 * the door and to nothing else, and keeps nothing.
 *
 * THE RELAY'S REPORTS. The relay writes to its standard output only the fixed report lines of its
 * contract. `createRelayReportReader` turns the chunks the door observes into those reports:
 * bounded, whole lines only, a line that is not one of the fixed forms is counted and dropped -
 * never kept, never handed on. THREE forms in record mode (finding F3-01 of the M3 review): the
 * established push, and since row 43 the loss of the camera leg inside a session and its re-open.
 * The reader judges the FORM of one line; which report may follow which, and whose attempt is in
 * force, is the adapter's (`onvif-relay.ts`).
 */
import type { CaptureTimers } from '../../types';
import { credentialAtInjection, type SealedCredential, type StartMessage } from '../credential';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../errors';
import type { ProductionDoor, ProductionProcess } from '../production-door';
import { isSourceAddress } from './stored-address';

/** What a start of the relay needs. Nothing of it is kept after the call. */
export interface CameraRelayStart {
  /** The production process door (`startProductionProcess`), handed in by the composition. */
  readonly door: ProductionDoor;
  /** The relay program: an absolute path (the door refuses another form). */
  readonly program: string;
  readonly timers: CaptureTimers;
  /** The stream locator as `locate` answered it: host and path, a query inside the query rule, never a user part. */
  readonly locator: string;
  /** The credential of the reader, opaque. */
  readonly sealed: SealedCredential;
  /** The ingest address of the session for this track and attempt, unchanged. */
  readonly ingest: string;
  /** The attempt of the worker the relay pushes to: named again in the relay's report. */
  readonly attempt: number;
  /**
   * THE SOURCE ADDRESS (task 4 row 143b; S13-11 point 2): the address of this host the relay's
   * connection to the camera must leave from - the camera-interface address the judgement of the
   * stored camera names (`storedCameraSourceOf`). It becomes the member `source` of the start
   * message; the relay gives it to its one socket before it connects, at the first open and at
   * every re-open, and refuses a record message without it. A RECORD START WITHOUT IT IS REFUSED
   * HERE, before the injection point is called: no start message is made.
   */
  readonly source: string;
  /** Told every chunk of the relay's standard output (its report lines). */
  readonly onOutput: (chunk: Buffer) => void;
}

/**
 * Starts the relay of one camera. Throws `CAPTURE_LOCATOR_INVALID` before anything is started for
 * a locator the injection point refuses; every refusal of the door arrives through
 * `ProductionProcess.started`, as a code.
 */
export function startCameraRelay(start: CameraRelayStart): ProductionProcess {
  // Row 143b: a recording is of a stored camera, and its dial is never made without the source address the rule named.
  if (!isSourceAddress(start.source)) throw new CaptureAdapterError(CaptureAdapterRefusal.START_MESSAGE_INVALID);
  return launch(start, {
    mode: 'record',
    ingest: start.ingest,
  });
}

/**
 * What a start of the relay in PROBE MODE needs (task 4 row 50, the stream half of the connection
 * test; the relay's contract: `implementation/042_relay_probe_mode.md` section 2). The parts of a
 * record start WITHOUT the address of a session: a probe pushes nothing and is given none, and the
 * relay refuses a probe message that carries one.
 *
 * `source` (row 143b) is OPTIONAL here and only here: the probe of a STORED camera states it (the
 * connection test of an adopted camera hands in the address its judgement names), the probe of a
 * camera that is not stored yet has no judged source and states none. A source that is handed in
 * and is not a source address is refused as in a record start - never dropped.
 */
export type CameraProbeStart = Pick<CameraRelayStart, 'door' | 'program' | 'timers' | 'locator' | 'sealed' | 'attempt' | 'onOutput'> & { readonly source?: string };

/**
 * Starts the relay to PROBE one stream: it opens the camera as a recording does, reports the
 * stream's facts in one line at the first keyframe and ends. Refusals as `startCameraRelay`.
 */
export function startCameraProbe(start: CameraProbeStart): ProductionProcess {
  if (start.source !== undefined && !isSourceAddress(start.source)) throw new CaptureAdapterError(CaptureAdapterRefusal.START_MESSAGE_INVALID);
  return launch(start, { mode: 'probe' });
}

/** The one start of the relay, for both modes: ONE call of the injection point, one door line. `mode`: the members a mode adds, in their place. */
function launch(start: CameraProbeStart, mode: Readonly<Record<string, string>>): ProductionProcess {
  // The member names and their order are the relay's contract: a closed set per mode, an unknown member is refused there.
  // `source` (row 143b) stands before the access when it is stated: the address the relay's camera socket is given before it connects.
  const message: StartMessage = {
    type: 'start',
    ...mode,
    attempt: start.attempt,
    ...(start.source === undefined ? {} : { source: start.source }),
    access: credentialAtInjection(start.locator, start.sealed),
  };
  return start.door({ command: start.program, args: [], env: {}, message, timers: start.timers, onOutput: start.onOutput });
}

/** The longest report line this file reads. A longer line is dropped whole, to its line feed. */
export const RELAY_REPORT_LINE_MAX_BYTES = 512;

/** What the relay can report on its standard output in record mode. */
export const RelayReportKind = {
  /** The worker answered the relay's record request with success: the push is established (RC-3 (i)). */
  PUSH_ESTABLISHED: 'PUSH_ESTABLISHED',
  /** The camera leg ended inside a session while the push stands; the relay opens it again (row 43; finding F3-01). */
  CAMERA_LOST: 'CAMERA_LOST',
  /** The first keyframe of the leg that was opened again is about to be forwarded: the loss of that number is over. */
  CAMERA_REOPENED: 'CAMERA_REOPENED',
} as const;
export type RelayReportKind = (typeof RelayReportKind)[keyof typeof RelayReportKind];

/** The causes a `camera_lost` line can name: the relay's exit-code numbers of the ends it opens again (`relay_loss_kind`). */
export const RELAY_LOSS_CAUSES: readonly number[] = Object.freeze([20, 23, 31, 32]);
/** The tries of one loss (`RELAY_RETRY_TRIES` of the relay's header). */
export const RELAY_RETRY_TRIES = 6;
/** The largest number a line of the re-open states (`RELAY_COUNT_MAX` of the relay's header). */
export const RELAY_COUNT_MAX = 999_999_999;

/** Every report names the attempt of the relay's own start message. Numbers only: no address, no path, no text. */
export type RelayReport =
  | { readonly kind: typeof RelayReportKind.PUSH_ESTABLISHED; readonly attempt: number }
  | {
      readonly kind: typeof RelayReportKind.CAMERA_LOST;
      readonly attempt: number;
      /** The number of the loss in the relay's life: 1, 2, 3, ... */
      readonly loss: number;
      /** One of `RELAY_LOSS_CAUSES`. */
      readonly cause: number;
    }
  | {
      readonly kind: typeof RelayReportKind.CAMERA_REOPENED;
      readonly attempt: number;
      /** The loss that is over. */
      readonly loss: number;
      /** The tries the re-open took: 1 to `RELAY_RETRY_TRIES`. */
      readonly tries: number;
      /** Pictures of the new leg that were held back before its first keyframe. */
      readonly heldBack: number;
      /** The relay's own measure of the gap, loss to first forwarded keyframe, in ms. */
      readonly gapMs: number;
    };

export interface RelayReportReader {
  /** Takes a chunk of the relay's standard output; calls `onReport` once per whole, well-formed report line. */
  push(chunk: Buffer): void;
  /** Lines that were not a report of the fixed form (too long, not the form, another word). A number, never a text. */
  rejected(): number;
}

const LINE_FEED = 0x0a;
/**
 * The fixed form of the record-mode report line, as the relay makes it (`relay_established_line`
 * of `apps/capture-worker/src/relay/relay_core.c`, row 42): three members in this order, version
 * 1, the attempt of the start message (1 to 999,999,999), nothing else. An attempt of 0 is the
 * relay's word for "the start message stated none": this file always states one, so 0 is refused.
 */
const PUSH_ESTABLISHED_LINE = /^\{"report":"push_established","v":1,"attempt":([1-9][0-9]{0,8})\}$/;
/** The largest attempt the relay takes in a start message (`RELAY_ATTEMPT_MAX` of its header). */
export const RELAY_ATTEMPT_MAX = 999_999_999;
/**
 * The two lines of the re-open (task 4 row 43; `relay_loss_line` and `relay_reopened_line` of
 * `relay_core.c`), read with the strictness of the established line: the members in the relay's
 * order and no other, version 1, every number in the relay's own form (no sign, no leading zero,
 * at most 9 digits) and inside the relay's own bounds - `attempt` and `loss` from 1, `cause` one of
 * the four codes the relay opens again, `tries` 1 to 6, `held_back` and `gap_ms` from 0. A line
 * that differs by a byte is no report: counted and dropped, as every unknown line.
 */
const CAMERA_LOST_LINE = /^\{"report":"camera_lost","v":1,"attempt":([1-9][0-9]{0,8}),"loss":([1-9][0-9]{0,8}),"cause":(20|23|31|32)\}$/;
const CAMERA_REOPENED_LINE = /^\{"report":"camera_reopened","v":1,"attempt":([1-9][0-9]{0,8}),"loss":([1-9][0-9]{0,8}),"tries":([1-6]),"held_back":(0|[1-9][0-9]{0,8}),"gap_ms":(0|[1-9][0-9]{0,8})\}$/;

/** A whole line as the report it is, or null. Every pattern is anchored at both ends and holds no nested repeat. */
function reportOf(text: string): RelayReport | null {
  const established = PUSH_ESTABLISHED_LINE.exec(text);
  if (established !== null) return { kind: RelayReportKind.PUSH_ESTABLISHED, attempt: Number(established[1]) };
  const lost = CAMERA_LOST_LINE.exec(text);
  if (lost !== null) return { kind: RelayReportKind.CAMERA_LOST, attempt: Number(lost[1]), loss: Number(lost[2]), cause: Number(lost[3]) };
  const reopened = CAMERA_REOPENED_LINE.exec(text);
  if (reopened !== null) {
    return { kind: RelayReportKind.CAMERA_REOPENED, attempt: Number(reopened[1]), loss: Number(reopened[2]), tries: Number(reopened[3]), heldBack: Number(reopened[4]), gapMs: Number(reopened[5]) };
  }
  return null;
}

/** A reader of the relay's report lines. It keeps at most one unfinished line of the bound and no finished one. */
export function createRelayReportReader(onReport: (report: RelayReport) => void): RelayReportReader {
  let pending = Buffer.alloc(0);
  let overflow = false;
  let rejected = 0;

  const line = (bytes: Buffer): void => {
    // The fixed forms are ASCII; `latin1` maps every byte to one character, so no other byte can pass the pattern.
    const report = reportOf(bytes.toString('latin1'));
    if (report === null) {
      rejected += 1;
      return;
    }
    onReport(Object.freeze(report));
  };

  return {
    push(chunk) {
      let from = 0;
      for (;;) {
        const end = chunk.indexOf(LINE_FEED, from);
        if (end === -1) break;
        const part = chunk.subarray(from, end);
        from = end + 1;
        if (overflow || pending.length + part.length > RELAY_REPORT_LINE_MAX_BYTES) rejected += 1;
        else line(pending.length === 0 ? part : Buffer.concat([pending, part]));
        pending = Buffer.alloc(0);
        overflow = false;
      }
      const rest = chunk.subarray(from);
      if (overflow || pending.length + rest.length > RELAY_REPORT_LINE_MAX_BYTES) {
        // An unfinished line beyond the bound is dropped to its line feed; nothing of it is kept.
        pending = Buffer.alloc(0);
        overflow = true;
      } else if (rest.length > 0) {
        pending = Buffer.concat([pending, rest]);
      }
    },
    rejected: () => rejected,
  };
}
