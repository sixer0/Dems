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
 * never kept, never handed on.
 */
import type { CaptureTimers } from '../../types';
import { credentialAtInjection, type SealedCredential, type StartMessage } from '../credential';
import type { ProductionDoor, ProductionProcess } from '../production-door';

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
  /** Told every chunk of the relay's standard output (its report lines). */
  readonly onOutput: (chunk: Buffer) => void;
}

/**
 * Starts the relay of one camera. Throws `CAPTURE_LOCATOR_INVALID` before anything is started for
 * a locator the injection point refuses; every refusal of the door arrives through
 * `ProductionProcess.started`, as a code.
 */
export function startCameraRelay(start: CameraRelayStart): ProductionProcess {
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
 */
export type CameraProbeStart = Pick<CameraRelayStart, 'door' | 'program' | 'timers' | 'locator' | 'sealed' | 'attempt' | 'onOutput'>;

/**
 * Starts the relay to PROBE one stream: it opens the camera as a recording does, reports the
 * stream's facts in one line at the first keyframe and ends. Refusals as `startCameraRelay`.
 */
export function startCameraProbe(start: CameraProbeStart): ProductionProcess {
  return launch(start, { mode: 'probe' });
}

/** The one start of the relay, for both modes: ONE call of the injection point, one door line. `mode`: the members a mode adds, in their place. */
function launch(start: CameraProbeStart, mode: Readonly<Record<string, string>>): ProductionProcess {
  // The member names and their order are the relay's contract: a closed set per mode, an unknown member is refused there.
  const message: StartMessage = {
    type: 'start',
    ...mode,
    attempt: start.attempt,
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
} as const;
export type RelayReportKind = (typeof RelayReportKind)[keyof typeof RelayReportKind];

export interface RelayReport {
  readonly kind: RelayReportKind;
  /** The attempt the relay names: the one of its start message. */
  readonly attempt: number;
}

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

/** A reader of the relay's report lines. It keeps at most one unfinished line of the bound and no finished one. */
export function createRelayReportReader(onReport: (report: RelayReport) => void): RelayReportReader {
  let pending = Buffer.alloc(0);
  let overflow = false;
  let rejected = 0;

  const line = (bytes: Buffer): void => {
    // The fixed forms are ASCII; `latin1` maps every byte to one character, so no other byte can pass the pattern.
    const attempt = PUSH_ESTABLISHED_LINE.exec(bytes.toString('latin1'))?.[1];
    if (attempt === undefined) {
      rejected += 1;
      return;
    }
    onReport({ kind: RelayReportKind.PUSH_ESTABLISHED, attempt: Number(attempt) });
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
