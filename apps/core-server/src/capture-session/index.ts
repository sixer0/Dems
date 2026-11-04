/**
 * The capture of a session (blueprint row 71, Core half / M5-W1; register CS-07, SH-03, SH-13,
 * NM-10; capture spec §A.3, §E, §E.1, §F; contract C3 §2.4, §3.1 "recording start", §4, §5.2;
 * database contract `dbc-4` §N.3 MR-S1, MR-S6 and dbc-3 §B.5; decisions D72(k), D72(l), D84, D91
 * R-1 option A, D106, D115, D123, D127). A CLOSED UNIT: other units import this index only.
 *
 * WHAT IT DOES, IN CAPTURE MODE `real`, FOR THE ONE OPEN SESSION:
 *
 *   start    INSIDE the unit that persists RECORDING (`recordingStartedIn`): the selector is held
 *            against the device registry of the running capture operation (a kind without an
 *            opener, a mixed selector, a class that is not the operation's -> 409 `INVALID_STATE`,
 *            `details.reason: SOURCE_KIND_NOT_RECORDABLE`, and the unit is not committed: no
 *            RECORDING, no row, no listener); the session payload says `captureDurable: false`;
 *            the four `session_capture_sources` rows are written in one statement, read back and
 *            held against the operation again (MR-S6).
 *            AFTER the commit (`afterStartCommitted`): the microphones are opened, the plan is
 *            built by the plan builder (row 66), `app.capture.start(sessionId, plan)` is called
 *            ONCE, and the cameras are opened toward the worker's listeners when it acknowledged;
 *   durable  the first `FIRST_DURABLE_FRAGMENT` (or checkpoint) -> `captureDurable: true`: from
 *            then on, and only from then on, the clients present 'recording'. Every
 *            `FRAGMENT_CHECKPOINT` becomes a `recording_fragments` row (the recorder of row 59,
 *            MOUNTED HERE: one per session, fed from `app.capture.on('record')`);
 *   end      the supervisor's `FAULTED`, or a start it refused: `durable: false` (no camera
 *            connected among them) is a FAILED START - the session FAULTS, nothing claims to have
 *            recorded, no evidence item is ever made of it; `durable: true` is an INTERRUPTED
 *            recording - the session FAULTS and the listeners of this unit are told
 *            (`INTERRUPTED`): that event is the hand-off to the sealing row (82), which seals what
 *            is on the disk. The two are told apart by the supervisor's `durable` AND by the files:
 *            a session is a failed start only when the supervisor says so, the payload agrees and
 *            no camera file of the plan exists (THE FILE IS THE TRUTH);
 *   stop     `afterStopCommitted`: `app.capture.stop`, the recorder's last rows, `STOPPED`;
 *   switch   operation 81 (`switchAudioSource`): the command to the worker; its acknowledgement
 *            carries the interval record (media time from the capture side); ONE unit then holds
 *            the session's new active / standby pair on the worker's two-role lane (D61, 2026-11-04:
 *            the selector plane records four numbered channels; the toggle trades channels 1 and 2,
 *            the transcription pair), the closed and the opened
 *            `session_audio_intervals` rows and the `AUDIO_SOURCE_SWITCHED` row with the keys of
 *            C3 §5.2 and the sending device ID. Never automatic (OD-11).
 *
 * THE TRANSCRIPT OF THE SESSION (row 71c, decision D153; transcript spec §B.7; dbc-6 MR-T1):
 *   snapshot    the STT configuration of the session is written INSIDE the unit of the start
 *               (`ports.snapshotIn`), in the transaction of RECORDING and the four source rows.
 *               EVERY real-mode start writes it or is refused (`503 STT_SNAPSHOT_NOT_STORED`,
 *               nothing committed, no worker started; ruling D-71c-2, integration pass D9): a
 *               configuration that cannot be read, a row that is not there, an absent
 *               transcription composition, a snapshot row that cannot be written. A readable
 *               configuration with STT DISABLED writes a snapshot that says so and starts;
 *   open        when the worker acknowledged the start AND the plan carries a tap (the snapshot
 *               enables STT): `ports.transcriber.begin`. A disabled session opens nothing;
 *   close       `ports.transcriber.end` on EVERY end of the capture: a stop and an interrupted
 *               recording (`recorded: true` - the tap is whole, the transcript is run to its end
 *               for the seal), a failed start (`recorded: false` - nothing runs).
 *
 * WHAT THE CAPTURE SIDE KNOWS AND THE SEAL NEEDS (`facts.ts`; evidence spec §B.4 field 40, §B.12
 * fields 127 / 128): the clock offset of each camera as its adapter reports it and the worker's
 * `FIRST_VIDEO_SAMPLE` of each camera file. They are written to a small file of the session
 * beside the media store WHILE the capture runs, so that a seal after a restart of the Core
 * builds the same manifest as the seal it resumes.
 *
 * A SESSION THAT LEAVES RECORDING BY ANOTHER DOOR than this unit's (a critical fault of the
 * simulator; demo operation 73 is refused in real capture, C3 §4 `DEMO_DISABLED`) HAS ITS WORKER
 * STOPPED: no capture worker goes on writing for a session that says it is in FAULT. What is
 * durable is handed over as an interrupted recording.
 *
 * EVERY SOURCE HANDLE IS CLOSED ON EVERY EXIT PATH: a refused start, a failed start, an
 * interrupted recording, a stop, a failure of this unit itself, and A SHUTDOWN OF THE CORE
 * (`shutdown()`, fix pass F-M5 / review R74-09: registered as an `onClose` hook by
 * `registerSessionCaptureShutdown`, called from the sessions module's plugin function). At a
 * shutdown the worker is stopped first, then the session's signal is aborted - which is what
 * reaches a camera helper that is still inside its settle window and in no table yet - and every
 * handle is closed. Nothing is told and no state is written: the session stays as stored and the
 * next boot resumes it.
 *
 * A SWITCH THE WORKER REALISED IS ALWAYS RECORDED (review R74-06). The interval rows and the
 * `AUDIO_SOURCE_SWITCHED` row are written from the worker's record: when the session left
 * RECORDING meanwhile, when the acknowledgement came after the limit (the record nobody waited
 * for is applied when it arrives), and after one retry of a unit that failed.
 *
 * THE TIMES OF A SWITCH, AS STORED (review R74-13; a correction of the sentence of D142 (1) /
 * D144 (5) "both times are in the audit row"). The audit row `AUDIO_SOURCE_SWITCHED` holds the
 * MEDIA times `fromMs` / `toMs` (contract C3 §5.2 names no member for a wall instant) and its own
 * `at`, which is the instant of THE UNIT THAT RECORDED THE SWITCH - after the worker's
 * acknowledgement, not the arrival of the command. The wall instant of the boundary is the
 * worker's `capturedAtMs`: `session_audio_intervals.from_at` of the opened row and `to_at` of the
 * closed one. The arrival instant of the command is not a stored member (erratum proposal in
 * `implementation/112_fix_m5_review.md`).
 *
 * THE CAMERAS OF A START (task 4 row 47; design addendum sections 2.3, 3 and 5.3; security checks
 * AD-05 (1), AD-11 and BR-07 (1), (3), (4)):
 *   the address  each camera track of a start pushes to an address that ONE function builds
 *                (`captureIngestAddress`, of the capture unit): the worker's loopback listener of that track, and a last
 *                path element of 128 bits from the system's random source. The worker records a
 *                push only when the client announced that address byte for byte. The address has
 *                exactly two receivers: the plan of `START` (the worker's standard input) and the
 *                target of the camera's `openSource` (an adapter of production hands it to its
 *                relay in the start message, on standard input). This unit writes it to no log, no
 *                error-log entry, no audit detail, no row, no event and no file. ONE EXCEPTION,
 *                limited to the development operation: the local camera helper takes its target
 *                as the last word of its arguments (`adapters/local/camera-helper-args.ts`);
 *   the profile  the open is told the profile of the plan's camera line: one device may fill both
 *                tracks with two profiles;
 *   together     every camera of the plan is opened IN THE SAME TURN: a camera that is slow to
 *                answer costs the other nothing. In `REAL_PRODUCTION` each open is given up at
 *                `PRODUCTION_CAMERA_OPEN_BOUND_MS` (the worker's window minus 5 s): its signal is
 *                aborted, the camera is reported not opened, and a source that comes up later is
 *                closed at once. An adapter is asked to open a camera ONCE per start, also when
 *                that open is given up (one credential read per camera per attempt);
 *   outside      a camera is opened only in `begin`, after the unit of the start committed and
 *                outside every unit of work: an adapter of production reads the stored credential
 *                in a unit of its own, and a unit cannot submit a unit.
 *   per attempt  (task 4 row 179; BR-07 (2)) a worker that is started again inside a session is
 *                never sent the addresses of an earlier one. This unit hands the supervisor the
 *                source of chance with `start`; the supervisor builds the addresses of every later
 *                worker with the same function and says them here BEFORE it starts that worker
 *                (`Live.ingest`, read at the one line that makes the target of an open). So a
 *                camera is always opened with the address of the worker in force - also when the
 *                first worker never came up and the cameras are opened for the second. When the
 *                worker of a RECORDING is replaced, `REAL_PRODUCTION` closes the camera sources of
 *                the earlier worker and opens every camera again, with the new addresses, once the
 *                next worker listens (`cameraRoundOver`, `cameraRoundAgain`); the development
 *                operation does neither, as before.
 *   open, SA-3   (task 4 row 48; RC-3 / S13-06, AD-01 (4), BR-08) with relay reports here
 *                (`ports.relayReports`) and in `REAL_PRODUCTION`, a camera counts as open only
 *                when the report of its relay and the worker's connect report for the same camera
 *                and attempt have both arrived within `INGEST_PAIRING_BOUND_MS`, in either order
 *                (`ingest-pairing.ts`). An unpaired or contradictory arrival - one without the
 *                other, a second connect report, a relay report for an attempt the Core never
 *                issued, a listener the worker refused although its relay reported - ends the
 *                capture with the cause `CAMERA_INGEST_NOT_PAIRED` (ruling C35 (b)). A camera that
 *                is simply absent is no such fault: the degraded start of D72(k) stays (C35 (a)).
 *                The relay's side is an injected source; without one a `REAL_PRODUCTION` start is
 *                refused (`RELAY_REPORTS_NOT_WIRED`, ruling C34) and the development operation
 *                pairs nothing. Since task 4 row 188: a relay report for an attempt the Core itself
 *                SUPERSEDED (its worker was replaced) is dropped, counted and said in a log line -
 *                never a fault (ruling C37); and where the worker's gate refused a camera AND the
 *                pairing ends the capture for it, the operator keeps ONE critical notice, the one
 *                of the ended capture (ruling C40 (2); `foldGateNotice`).
 *   absence      (finding F3-01 of the M3 review; task 4 row 43) the same source also carries a
 *                relay's word that its CAMERA LEG was lost inside the session and that it is open
 *                again (a report with the member `leg`). The push stands through both, so they are
 *                no report of the pairing and end nothing. This unit states the absence of that
 *                camera with both bounds on the Core's clock in the persistent error log
 *                (`cameraLegSaid`); the camera's own critical notice is the camera watch's.
 *
 * IN CAPTURE MODE `simulated` NOTHING HERE RUNS: `recordingStartedIn` and the two `after...` calls
 * return at once, and operation 81 is the simulator's own hosted action.
 *
 * HOW THE REST OF THE SERVER REACHES IT: `sessionCapture(app)`, one object per app, built on first
 * use from the app's seams (the `captureNotices(app)` idiom): no plugin, `app.ts` is not touched.
 *
 * ERRORS. A refusal of a start or a switch is an `ApiFailure` with a fixed text. Everything that
 * goes wrong after the answer was sent is written to the log AND to the persistent error log with
 * a code, the session ID and the device ID it concerns: never a path, an address or a credential.
 */
import { randomBytes } from 'node:crypto';
import { mkdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { AudioSourceIntervalReason, CaptureIngestState, CaptureMicRole, CaptureRecordKind, CaptureStopReason, CaptureSyncLevel, CaptureWarningState, type AudioSourceIntervalRecord, type CapturePlan, type FirstVideoSampleRecord } from '@dems/capture-protocol'; // CaptureMicRole: D61 (2026-11-04) - the worker's two-role lane, traded by op 81
import { INGEST_PAIRING_BOUND_MS, createIngestPairing, type IngestPairing, type IngestPairingFailure, type RelayIngestReport, type RelayIngestReports } from './ingest-pairing';
export { INGEST_PAIRING_BOUND_MS, IngestPairingFault, type IngestPairingFailure, type RelayIngestReport, type RelayIngestReports } from './ingest-pairing';
import { ApiErrorCode, CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES, type AudioSourceStateBody } from '@dems/shared/api';
import { SessionState, VIDEO_TRACK_IDS } from '@dems/shared/domain'; // VIDEO_TRACK_IDS: D60 (2026-11-04)
import { CaptureAdvisoryReason, CaptureNoticeReason, PRIMARY_MIC_CHANNEL, type ActiveSession, type CaptureAdvisoryNotice, type CaptureVolumeSyncNotice } from '@dems/shared/sim'; // PRIMARY_MIC_CHANNEL: D61 (2026-11-04)
import type { FastifyInstance } from 'fastify';
import { CapturePhase, CaptureSupervisorError, captureIngestAddress, isCameraAbsentReason, isCameraIntegrityReason, type CaptureCameraEnd, type CaptureEventOf, type CaptureStopOutcome, type CaptureSupervisor } from '../capture';
import { CaptureAdapterError, CaptureAdapterKind, CaptureOperation, type AudioStreamHandle, type CameraSourceTarget, type CaptureDeviceRegistry, type SourceHandle } from '../capture/adapters';
import { NO_SOURCE_FACTS, assertSessionSourcesOfOperation, audioCardStatementOf, buildSessionCaptureSources, captureFenceControl, captureOperationOf, micSourceFactsOf, type CaptureSourceSlot, type SessionCaptureSource, type SessionSourceFacts } from '../capture/fence';
import { captureCheckpointDoorsOf, captureDoorsOf, markCaptureConnectingIn, switchCaptureAudioSourceIn, type EngineUnit, type HostedActionArguments } from '../engine';
import { CapturePlanError, MIC_CHANNEL_IDS, assertRecordableSelector, buildCapturePlan, type CapturePlanMicSource, type CapturePlanSelector, type MicChannelId, type RecordableSelector } from '../modules/capture-config'; // MIC_CHANNEL_IDS / MicChannelId / CapturePlanMicSource: D61 (2026-11-04) — the per-channel audio file of the plan
import { createFragmentRecorder, createRecordingFragmentStore, type FragmentRecorder, type VideoTrackId } from '../modules/recording-fragments';
import type { Principal } from '../plugins/authenticate';
import { ApiFailure } from '../plugins/error-envelope';
import { transcriptionControl } from '../transcription';
import { describeError } from '../plugins/logger';
import { SESSION_CAPTURE_FACTS_VERSION, sessionCaptureFactsPath, writeSessionCaptureFacts, type SessionCaptureFacts } from './facts';
import { AudioIntervalRowReason, CLOSE_OPEN_AUDIO_INTERVAL, CLOSE_SUPERSEDED_AUDIO_INTERVAL, INSERT_AUDIO_INTERVAL, INSERT_SESSION_CAPTURE_SOURCES, READ_SESSION_CAPTURE_SOURCES } from './statements';

export { SESSION_CAPTURE_FACTS_FOLDER, SESSION_CAPTURE_FACTS_VERSION, parseSessionCaptureFacts, readSessionCaptureFacts, readSessionVideoFormat, readSessionVideoSampleEntry, removeSessionCaptureFacts, sessionCaptureFactsPath, withCameraEnded, type SessionCameraEnd, type SessionCameraFacts, type SessionCaptureFacts } from './facts';
export { AudioIntervalRowReason, CLOSE_OPEN_AUDIO_INTERVAL, CLOSE_SUPERSEDED_AUDIO_INTERVAL, INSERT_AUDIO_INTERVAL, INSERT_SESSION_CAPTURE_SOURCES, READ_SESSION_CAPTURE_SOURCES } from './statements';

/** `details.reason` of a start that is refused for its sources (C3 §4, erratum PE-128-34). */
export const SOURCE_KIND_NOT_RECORDABLE = 'SOURCE_KIND_NOT_RECORDABLE';

/**
 * The no-delivery bound of a source (capture spec §A.6.4 HL, ML-5): a microphone helper that has not
 * started within it is reported, never waited for. The figure is the local adapters'
 * `FIRST_DELIVERY_MS` (8 s); a test of this unit holds the two equal.
 */
export const MIC_START_BOUND_MS = 8_000;

/**
 * THE ADVISORY THRESHOLD OF A CAMERA CLOCK (tidy pass F-Y; ruling D179). The worker accepts a camera
 * whose clock is up to 2 s away from the Core's and records it at its own clock. The offset it
 * measured is kept for manifest field 40 whatever its size; ABOVE this size (in ms) the camera also
 * gets the advisory alert `CAMERA_CLOCK_OFFSET`. Default of the port `clockOffsetAdvisoryMs`.
 */
export const CAMERA_CLOCK_OFFSET_ADVISORY_MS = 500;

/** `details.reason` of a stop that is refused because the capture holds nothing durable yet (D84). */
export const CAPTURE_NOT_DURABLE = 'CAPTURE_NOT_DURABLE';

/** `details.reason` of a start that is refused because its STT snapshot was not written in its unit, whatever the cause (row 71c; every cause since pass D9). */
export const STT_SNAPSHOT_NOT_STORED = 'STT_SNAPSHOT_NOT_STORED';

/** The `cause` of a capture that was ended because its session left RECORDING by another door. */
export const SESSION_LEFT_RECORDING = 'SESSION_LEFT_RECORDING';

/** The `reason` of the capture fault of a stop that did not end cleanly (the recording is sealed as interrupted). */
export const STOP_NOT_CLEAN = 'CAPTURE_STOP_NOT_CLEAN';

/** The fault-row key `reason` of a start at which no camera connected (C3 §5.3, erratum PE-121-09). */
export const NO_CAMERA_CONNECTED = 'NO_CAMERA_CONNECTED';

// The ingest address of a camera track is built by `captureIngestAddress` of the capture unit
// (`src/capture/ingest-address.ts`, moved there by integration pass I-3 so that the supervisor can
// reach the same function). That unit may draw no random number (static rule G-R8): THIS file
// names the source, `randomBytes` of the runtime's cryptography module, and hands it in at the
// one call.

/**
 * How long ONE camera open of a `REAL_PRODUCTION` start is waited for, in ms (design addendum
 * section 3): the production ingest window (30,000 ms, a constant of the capture unit) minus
 * 5,000 ms, so that a relay has reported before the worker's window ends. A test of this unit
 * holds the two figures 5,000 ms apart. Default of the port `cameraOpenBoundMs`; the development
 * operation has no such bound, as before.
 */
export const PRODUCTION_CAMERA_OPEN_BOUND_MS = 25_000;

/** The `cause` of a camera that was not opened because its open was given up at the bound. */
export const CAMERA_OPEN_BOUND = 'CAMERA_OPEN_BOUND';

/**
 * The `details.cause` of a start refused 409 `SOURCE_KIND_NOT_RECORDABLE` because the capture operation is
 * `REAL_PRODUCTION` and no source of relay reports is handed to this unit (controller ruling C34: SA-3 fail-closed).
 */
export const RELAY_REPORTS_NOT_WIRED = 'RELAY_REPORTS_NOT_WIRED';

/** The cause of a capture that was ended because a camera did not count as open by SA-3 (row 48; `ingest-pairing.ts`). */
export const CAMERA_INGEST_NOT_PAIRED = 'CAMERA_INGEST_NOT_PAIRED';

/**
 * How many dropped relay reports of superseded attempts a capture says with a log line of their own (task 4 row 188;
 * ruling C37). Every one is counted; beyond this number the count is said once, at the end of the capture.
 */
export const SUPERSEDED_REPORT_LINES = 8;

/** The `cause` of a camera that was not opened because the session holds no address for it (row 179: a camera is never opened toward a guessed or an earlier address). */
export const INGEST_ADDRESS_UNKNOWN = 'INGEST_ADDRESS_UNKNOWN';

/** The folder of a session below the media root, and its camera files (evidence spec §A: `SESSION-<id>/VIDEO-0n.mp4`). */
export const sessionMediaFolder = (sessionId: string): string => `SESSION-${sessionId}`;
export const cameraFileName = (trackId: VideoTrackId): string => `${trackId}.mp4`;
/**
 * D61 (2026-11-04): the standalone audio file of one microphone CHANNEL, named after the channel as a
 * camera file is named after its track (`SESSION-<id>/MIC-0n.m4a`). The worker creates it by the same
 * never-overwrite rule; a channel the plan does not name one for is metered but not recorded on its own file.
 */
export const micFileName = (channel: MicChannelId): string => `${channel}.m4a`;

/** File (media) time in ms of a sample counted from T0 (protocol 4, `AUDIO_SOURCE_INTERVAL`; dbc-3 §B.5 erratum PE-128-44). */
export function mediaMsOfSample(sample: number, sampleRateHz: number): number {
  return Math.floor(((sample + CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES) * 1000) / sampleRateHz);
}

const SOURCE = 'captureSession';
const SESSION_ID = /^SES-[0-9]{8}-[0-9]{4}$/;
const TRACKS: readonly VideoTrackId[] = VIDEO_TRACK_IDS; // D60 (2026-11-04): four recorded tracks (was two)

const TEXT = Object.freeze({
  NOT_RECORDABLE: 'This capture configuration cannot be recorded: an assigned source cannot be opened in the running capture operation.',
  HELPERS_LEFT: 'Capture sources of an earlier run are still running. Try again when they have ended.',
  SNAPSHOT_NOT_STORED: 'The session could not be started: its transcription settings could not be recorded. Try again.',
  NOT_RECORDING: 'The session is not recording.',
  NOT_DURABLE: 'Nothing is recorded yet: the cameras are still connecting. The session ends by itself when no camera connects.',
  NOT_OPEN: 'This session is not the open session.',
  NO_SUCH_INPUT: 'The requested microphone is not one of the four inputs of this session.', // D61 (2026-11-04): four numbered channels (was two)
  SWITCH_REFUSED: 'The requested microphone cannot become the active source now.',
  SWITCH_NOT_RECORDED: 'The microphone was switched, but the switch could not be recorded. It is in the error log.',
});

/** What this unit tells its listeners about the capture of a session. Identifiers and codes only. */
export type SessionCaptureEvent =
  /** The start committed: the four source rows are stored, the session says 'connecting cameras'. */
  | { readonly type: 'CONNECTING'; readonly sessionId: string; readonly sources: readonly SessionCaptureSource[] }
  /** `app.capture.start` was acknowledged: the worker listens; `cameras` are the ones whose source was opened. */
  | { readonly type: 'STARTED'; readonly sessionId: string; readonly cameras: readonly string[]; readonly camerasNotOpened: readonly string[] }
  /** The first durable fragment: the session presents 'recording' from here. */
  | { readonly type: 'DURABLE'; readonly sessionId: string }
  /**
   * The worker says a camera of the plan did not connect within the ingest-open window (protocol 4
   * `CAMERA_NOT_CONNECTED`; review R74-03). When the session records, that is the degraded start
   * the notices unit words as a WARNING; when no camera connects, FAILED_START follows instead.
   */
  | { readonly type: 'CAMERA_NOT_CONNECTED'; readonly sessionId: string; readonly deviceId: string }
  /**
   * A FAILED START: nothing durable, no evidence item. `cause` is the worker's or the supervisor's
   * code (`NO_CAMERA_CONNECTED`, ...). `reason` and `evidenceFiles` are the two keys of the fault
   * row of situation C (C3 §5.3): `reason` is `NO_CAMERA_CONNECTED` exactly when that was the
   * cause, the cause's own code otherwise; `evidenceFiles` is 0 - nothing was recorded. This unit
   * ALWAYS writes both; they are optional in the type only so that an event another unit's test
   * builds by hand stays one.
   */
  | { readonly type: 'FAILED_START'; readonly sessionId: string; readonly cause: string | null; readonly reason?: string; readonly evidenceFiles?: 0 }
  /**
   * An INTERRUPTED recording: the capture ended for good and the session holds durable media. THE
   * HAND-OFF TO THE SEALING ROW (82): seal what the camera files hold, as interrupted. The worker
   * has exited and every source handle is closed when this is said.
   */
  | { readonly type: 'INTERRUPTED'; readonly sessionId: string; readonly cause: string | null; readonly files: readonly SessionCameraFile[]; readonly firstVideo: readonly SessionFirstVideo[]; readonly cameraEnds?: readonly CaptureCameraEnd[] }
  /**
   * A stop: the worker flushed, closed its files and exited; the recorder wrote its last rows. THE HAND-OFF of a normal seal.
   *
   * `cameraEnds` (fix wave H driver A, C3; decision D202), on this event and on INTERRUPTED: the
   * cameras the worker GAVE UP while the session went on - which, why (the supervisor's closed
   * reason) and where their file ends. Absent when none ended. The same facts are in the session's
   * capture facts file before the event is told: the seal reads them there (`facts.ts`, `ended`).
   */
  | { readonly type: 'STOPPED'; readonly sessionId: string; readonly files: readonly SessionCameraFile[]; readonly fragmentRowsBehind: readonly VideoTrackId[]; readonly firstVideo: readonly SessionFirstVideo[]; readonly cameraEnds?: readonly CaptureCameraEnd[] };

/**
 * The start-up of one camera file as the worker reported it (protocol 4, `FIRST_VIDEO_SAMPLE`): a
 * stream copy starts at the first keyframe that can be placed at or after T0, so up to one camera
 * GOP of delivered video is NOT in the file. Specified behaviour, stated so that the manifest and
 * the operator can see it. Of the LAST worker of the session (the one whose file it is).
 */
export interface SessionFirstVideo {
  readonly deviceId: string;
  /** Presentation time of the first video sample, in ticks of `timescale`, counted from T0 (manifest field 127). */
  readonly pts: number;
  /** Ticks per second of the video track (manifest field 128). */
  readonly timescale: number;
  /** How long the first written frame is held from T0, in ms. */
  readonly heldMs: number;
  /** Video packets delivered before the first written sample, by the reason each could not be written. */
  readonly skipped: FirstVideoSampleRecord['skipped'];
  /** Camera time from the first skipped packet to the first written sample, in ms. */
  readonly skippedSpanMs: number;
}

/** One camera file of a session's plan. `path` is for the unit that opens the file; it is never logged. */
export interface SessionCameraFile {
  readonly trackId: VideoTrackId;
  readonly deviceId: string;
  readonly path: string;
}

export type SessionCaptureListener = (event: SessionCaptureEvent) => void | Promise<void>;

/** What a test, or the wiring of another row, may put in place of this unit's defaults. */
export interface SessionCapturePorts {
  /** The device registry of the running capture operation; null: none (the start is refused). */
  registry(): CaptureDeviceRegistry | null;
  /** SEC35-43 (d): helper processes of an earlier run; null: the process table could not be read. */
  leftoverHelpers(): Promise<readonly number[] | null>;
  /** Creates the folder of a session below the media root. */
  ensureDir(path: string): Promise<void>;
  /** How long the start of one microphone helper is waited for: the no-delivery bound (`MIC_START_BOUND_MS`). */
  micStartBoundMs: number;
  /** How long one camera open of a `REAL_PRODUCTION` start is waited for (`PRODUCTION_CAMERA_OPEN_BOUND_MS`). Not applied in another operation. */
  cameraOpenBoundMs: number;
  /**
   * SA-3 (task 4 row 48): where the relays of this Core report that the worker answered their record
   * request. Null (the default, until the rows of the relay's report fill it): no relay reports
   * here. In `REAL_PRODUCTION` a start is then REFUSED (`RELAY_REPORTS_NOT_WIRED`, ruling C34); a
   * null source is admitted in the development operation only, where nothing is paired. With a
   * source, in `REAL_PRODUCTION`, a camera counts as open only by the pairing of
   * `ingest-pairing.ts`, and a pairing fault ends the capture.
   */
  relayReports: RelayIngestReports | null;
  /** SA-3: the bound between the relay's report and the worker's connect report of one camera (`INGEST_PAIRING_BOUND_MS`). */
  ingestPairingBoundMs: number;
  /** Above this size of the clock offset the worker measured (ms) a camera gets the advisory alert (`CAMERA_CLOCK_OFFSET_ADVISORY_MS`). */
  clockOffsetAdvisoryMs: number;
  /**
   * The capture operation the sources of a session belong to (default: the registry's own). Read for
   * ONE thing: how grave a volume without the full sync is (CRITICAL in `REAL_PRODUCTION`, D189).
   */
  operationOf(registry: CaptureDeviceRegistry): CaptureOperation;
  /** Whether a file is at that path (the camera file of a plan: the truth about 'durable'). */
  fileExists(path: string): Promise<boolean>;
  /** The PCM tap of the session's plan, or null. */
  tapPathFor(sessionId: string): Promise<string | null>;
  /**
   * The STT snapshot of the session, written through `db`: the unit of its start. `ok: false`
   * refuses the start, whatever the code; `storeFailed: true` means a statement failed ON `db`.
   */
  snapshotIn(db: Pick<EngineUnit['unit'], 'query'>, sessionId: string): Promise<{ readonly ok: true } | { readonly ok: false; readonly code: string; readonly storeFailed: boolean }>;
  /** After the unit of the start committed: what a taken snapshot starts. Returns at once. */
  startCommitted(sessionId: string): void;
  /** The transcriber session of the recording (`transcriptionControl(app).runs`). Neither call throws into the capture. */
  readonly transcriber: {
    begin(sessionId: string): Promise<unknown>;
    end(sessionId: string, how: { readonly recorded: boolean }): void;
  };
  /** Writes the facts file of a session (atomically: a seal never reads half of it). */
  writeFacts(path: string, facts: SessionCaptureFacts): Promise<void>;
}

export interface SessionCapture {
  /** True in capture mode `real`: the sessions of this Core record through the capture worker. */
  readonly real: boolean;
  /**
   * BEFORE the unit of a start, outside every unit (it reads the process table). Throws 503 when
   * helper processes of an earlier run are left. Does nothing in mode `simulated`.
   */
  beforeStart(): Promise<void>;
  /**
   * INSIDE the unit that ran the hosted `startRecording`, right after it. Throws the 409 of the
   * header; the caller lets it propagate, so the unit is not committed. Mode `simulated`: nothing.
   */
  recordingStartedIn(scope: EngineUnit, sessionId: string): Promise<void>;
  /**
   * INSIDE the unit of a stop, BEFORE the hosted `stopRecording`. A session whose capture holds
   * nothing durable yet ('connecting cameras') is not stopped into a seal: 409 `INVALID_STATE`,
   * `details.reason: CAPTURE_NOT_DURABLE` - no evidence item is made of a recording that has no
   * media (D84). Such a session ends by itself, as a failed start, when the ingest-open window
   * closes. Mode `simulated`: nothing.
   */
  stopRequestedIn(scope: EngineUnit, sessionId: string): void;
  /** AFTER the unit of a start committed. Returns at once; the capture starts in the background. */
  afterStartCommitted(sessionId: string): void;
  /** A start whose unit did NOT commit: what `recordingStartedIn` prepared is dropped. */
  startAbandoned(sessionId: string): void;
  /** AFTER the unit of a stop committed. Returns at once; the worker is stopped in the background. */
  afterStopCommitted(sessionId: string): void;
  /** Operation 81. Resolves with the answer of the contract; rejects with an `ApiFailure`. */
  switchAudioSource(principal: Principal, sessionId: string, inputId: string): Promise<AudioSourceStateBody>;
  /** Returns the function that removes the listener. */
  on(listener: SessionCaptureListener): () => void;
  /** Resolves when nothing of this unit runs in the background. For a test and for a shutdown. */
  idle(): Promise<void>;
  /**
   * THE SHUTDOWN OF THE CORE (review R74-09): the worker of the live capture is stopped, the
   * session's signal is aborted (a source that is still being opened ends there), every handle is
   * closed, and the background work is awaited. Tells no listener and writes no state. Safe to
   * call twice and while no capture runs. Never rejects.
   */
  shutdown(): Promise<void>;
  /** The session whose capture this unit holds now, or null. */
  liveSessionId(): string | null;
  /** Replaces ports. Before the first start only. */
  replace(ports: Partial<SessionCapturePorts>): void;
}

interface Prepared {
  readonly sessionId: string;
  readonly selector: CapturePlanSelector;
  readonly recordable: RecordableSelector;
  readonly sources: readonly SessionCaptureSource[];
}

interface Live {
  readonly sessionId: string;
  readonly supervisor: CaptureSupervisor;
  readonly abort: AbortController;
  readonly handles: SourceHandle[];
  readonly offs: Array<() => void>;
  readonly files: SessionCameraFile[];
  /** By camera: what the newest worker said about the start of its file. */
  readonly firstVideo: Map<string, SessionFirstVideo>;
  recorder: FragmentRecorder | null;
  /** True once `captureDurable: true` was committed. */
  durableSaid: boolean;
  durableAsked: boolean;
  /** True once the end of this capture is being handled: an end is handled once. */
  ended: boolean;
  /**
   * THE END WAS ASKED (closing pass F-X, review R74-08). `begin`, the stop and the end of a capture run
   * on ONE chain, so `ended` is set only after `begin` returned: `begin` could never see it, and a stop
   * that committed while it still waited (a microphone start is waited for up to `MIC_START_BOUND_MS`)
   * reached the worker that much later - the worker recorded past the committed stop. `leaving` is
   * set OUTSIDE the chain, the moment a stop commits or the worker ends the session; `begin` then
   * opens nothing more and waits for nothing more, and the step queued behind it runs. The chain
   * keeps its order.
   */
  leaving: boolean;
  /** Resolves when `leaving` is set. */
  readonly left: Promise<void>;
  leave(): void;
  /** The last instant of the audio timeline the worker reported, in media ms; null before. */
  audioEndMs: number | null;
  /** The instant of the session's source rows: what ties the facts file to THIS session. */
  readonly startRecordedAt: number;
  /** By camera: the clock offset its adapter reported at the start, in ms; null: it reported none. */
  readonly clockOffsets: Map<string, number | null>;
  /**
   * By camera: the offset the WORKER measured when it anchored the camera (camera clock minus Core
   * clock, whole ms) and which worker of the session measured it. Manifest field 40 (tidy pass F-Y).
   */
  readonly measuredOffsets: Map<string, { readonly attempt: number; readonly offsetMs: number }>;
  /** By camera: the sync level the worker stated with the first durable fragment of its file (R63-09). */
  readonly syncLevels: Map<string, CaptureSyncLevel>;
  /** The notices this capture raised and resolves when it ends: the clock-offset advice by camera, the volume notice once. */
  readonly noticesRaised: Map<string, CaptureAdvisoryNotice | CaptureVolumeSyncNotice>;
  /** True for a capture whose sources are production's (`REAL_PRODUCTION`): a volume without the full sync is CRITICAL there. */
  readonly production: boolean;
  /**
   * Task 4 row 179 (BR-07 (2)): by camera, the address its source pushes to FOR THE WORKER IN FORCE.
   * Filled from the plan of the start; replaced, all cameras at once, when the supervisor renews the
   * addresses for a later worker of the session. Read at ONE line, the target of a camera open. A
   * secret of the session: never logged, told, stored or put into an error.
   */
  readonly ingest: Map<string, string>;
  /** The camera opens of the worker in force (row 179): null before the first open of the session. */
  cameras: CameraRound | null;
  /** Task 4 row 191: the microphone handles of the attempt in force, by device. Each is in `handles` as well, which is what the end of a capture closes. */
  readonly micHandles: Map<string, AudioStreamHandle>;
  /** Row 191: the attempt the handles in force were opened for (1 at the start). An outcome of a microphone start of an earlier attempt is dropped. */
  micAttempt: number;
  /** Row 191: true once the handles in force were started (`startMicrophones`): a handle starts once, so a later worker needs new ones. */
  micsStarted: boolean;
  /** Row 191: the microphones made ready for a later worker - which attempt, and the inputs once every close and open has an outcome; null before the first restart. */
  micsAgain: { readonly attempt: number; readonly ready: Promise<ReadonlyMap<string, AudioStreamHandle['input']>> } | null;
  /** Row 191: the microphone starts of the attempt in force; resolved once each has an outcome. */
  micStarts: Promise<void>;
  /** Row 191: resolves `micStarts` of a later attempt, whose starts are launched when its worker has acknowledged `START`; null otherwise. */
  micStartsSettle: (() => void) | null;
  /** Row 191: how many outcomes of microphone starts of superseded attempts were dropped. */
  micReportsDropped: number;
  /** Row 191: the first sample of the audio timeline each worker of the session reported, by attempt (the Core's record of the gap a restart leaves). */
  readonly audioFrom: Map<number, number>;
  /** Row 191: when the worker of an attempt went down and was replaced, by the attempt that followed it. */
  readonly workerDownAt: Map<number, number>;
  /** Row 191: when the microphones of a later attempt were started (the Core's clock), by attempt. */
  readonly micsStartedAt: Map<number, number>;
  /**
   * Row 191b: every worker numbers its interval records from 1. The stored number of a record is
   * `intervalSeqBase + index`: the base is 0 for the first worker that reported audio and, for a
   * later one, the highest number the workers before it used (`intervalSeqTop`).
   */
  intervalSeqBase: number;
  intervalSeqTop: number;
  /** Row 191b: the interval rows of the start and of a restart are written one after the other, in the order their records arrived. */
  intervalWrites: Promise<void>;
  /** SA-3 (row 48): the pairing of this capture; null when it is not applied (no relay reports here, or not `REAL_PRODUCTION`). */
  pairing: IngestPairing | null;
  /** SA-3: by camera, the attempt and the ingest state the worker last reported: a connect report is a CHANGE to `CONNECTED`. */
  readonly ingestSaid: Map<string, string>;
  /**
   * Row 188 (C40 (2)): by camera, the refusal of the worker's gate this capture was told - the worker's own word
   * (`CAMERA_ANNOUNCE_NOT_MATCHED` / `_NOT_SEEN`) and the attempt it was said in. Read when the pairing ends the capture.
   */
  readonly gateRefusals: Map<string, { readonly reason: string; readonly attempt: number }>;
  /** Row 188 (C37): true once the total of the dropped relay reports of superseded attempts was said at the end of the capture. */
  supersededSummed: boolean;
  /**
   * Finding F3-01: by camera and stream, the absence inside this capture that is OPEN - the relay said its camera leg
   * was lost and has not said it re-opened: the relay's number of the loss, the attempt, and the instant of the Core's
   * clock at which the word arrived (the earlier bound of the absence).
   */
  readonly cameraAbsences: Map<string, { readonly deviceId: string; readonly profile: string; readonly attempt: number; readonly loss: number; readonly lostAt: number }>;
  /** Finding F3-01 (C37): how many words of a relay about its camera leg were dropped because they named an attempt that is not in force. */
  cameraLegsDropped: number;
  /** Row R1b: the audit entries of the absences that ENDED, one after the other; `release` waits for it, so the seal reads every entry. */
  absenceWrites: Promise<void>;
  /** Row R1b: the instant of the Core's clock at which the end of this capture was asked (`leave`); null until then. */
  leftAt: number | null;
  /** Row R1b: the highest capture attempt a relay word of this capture was taken for - the attempt in force when the last absence was said. */
  absenceAttempt: number;
  /** True once the tap path of the session was asked of the transcription unit: from then on its scratch folder may exist. */
  tapAsked: boolean;
  /** True once the transcriber session was asked for; true again once it was told the end. */
  transcriberBegun: boolean;
  transcriberEnded: boolean;
  /** The writes of the facts file, one after the other. */
  factsWritten: Promise<void>;
  /** C3: the cameras the worker gave up while the session went on, by camera. The FIRST end of a camera stands. */
  readonly cameraEnds: Map<string, CaptureCameraEnd>;
  /** Operation 81 calls that wait for the worker's acknowledgement now. */
  switchesWaiting: number;
  /** By microphone: who last asked for it to become the source (the actor of the row its record writes). */
  readonly switchAskedBy: Map<string, SwitchActor>;
  /** Switch records that arrived while a call waited: taken by that call, or applied when it was refused for a late acknowledgement. */
  readonly switchRecordsSeen: Map<number, AudioSourceIntervalRecord>;
  /** The `index` of every switch record that was recorded (or is being recorded): a record is applied once. */
  readonly switchesRecorded: Set<number>;
  /**
   * Closing pass Z1 (driver A decision 3): by camera, what the worker reported durable so far - the
   * number of `FRAGMENT_CHECKPOINT` records and the end of the newest one's byte range - and the Core
   * clock at the newest of them. Said to the session payload through the engine's capture-checkpoint
   * door at most every `CHECKPOINT_FACTS_INTERVAL_MS` and once when the capture ends.
   */
  readonly checkpoints: Map<string, { fragments: number; bytes: number }>;
  checkpointsAt: number | null;
  /** The Core clock when the figures were last said (the window is counted from it); null before the first. */
  checkpointsSaidAt: number | null;
  /** How many checkpoints the figures the session payload states cover. */
  checkpointsSaid: number;
  /** The calls of the door, one after the other: the call at the end of a capture runs after one that is in flight. */
  checkpointsSaying: Promise<void>;
}

/**
 * THE CAMERA OPENS OF ONE WORKER OF A SESSION (task 4 row 179). A worker that is started again
 * inside a session listens at new addresses (BR-07 (2)); what was opened toward the earlier worker
 * pushes to nothing and announces a dead secret. So the opens belong to a round: the round of a
 * worker that went down is over (its opens in flight are given up without a report, its sources
 * are closed), and the next round opens every camera of the plan again with the addresses of the
 * new worker, once that worker listens.
 */
interface CameraRound {
  /** Aborted when the worker of this round went down and a later one replaces it. */
  readonly over: AbortController;
  /** The camera sources this round opened and the session still holds. */
  readonly handles: SourceHandle[];
  readonly opened: string[];
  readonly notOpened: string[];
  /** The sources of the round before this one are closed (resolved at once for the first round). */
  closing: Promise<void>;
  /** Resolves when every open of this round has an outcome. */
  readonly settled: Promise<void>;
  settle(): void;
}

function newCameraRound(): CameraRound {
  let settle: () => void = () => undefined;
  const settled = new Promise<void>((resolve) => (settle = resolve));
  return { over: new AbortController(), handles: [], opened: [], notOpened: [], closing: Promise.resolve(), settled, settle: () => settle() };
}

/** The session payload hears the checkpoint figures at most this often (one engine unit per window, never one per fragment). */
export const CHECKPOINT_FACTS_INTERVAL_MS = 5_000;

/** Who a switch is recorded for: the operator, and the paired device the command came from (E-30 / SEC35-17). */
interface SwitchActor {
  readonly operatorId: string | null;
  readonly sendingDeviceId: string | null;
}

/**
 * Row 191b: what a worker restart cost the audio of a session, as the session measured it on the
 * Core's own clock (`sayAudioGap`) and as `recordAudioGap` stores it.
 */
interface AudioGap {
  /** The last attempt before the later one that reported audio (the one before it, when none did). */
  readonly earlierAttempt: number;
  readonly laterAttempt: number;
  /** When the earlier worker went down: `to_at` of the interval row it leaves. */
  readonly earlierEndAt: number;
  /** `from_at` of the later worker's row: the worker's instant, held between the two bounds. */
  readonly laterFromAt: number;
  /** Earlier worker down -> the microphones were started again; null when an instant is not known. */
  readonly atLeastMs: number | null;
  /** Earlier worker down -> the later worker's record arrived; null when the instant is not known. */
  readonly atMostMs: number | null;
}

/** The longest gap the audit row may state, in ms (`CAPTURE_AUDIO_ABSENT_MAX_MS` of `core/audit-details.ts`): a larger number is a clock fault and is not stated. */
const AUDIO_GAP_MAX_MS = 86_400_000;

/** Row R1b: the longest absence of a camera the audit row may state, in ms (`CAPTURE_VIDEO_ABSENT_MAX_MS` of `core/audit-details.ts`): a larger number is a clock fault and is not stated. */
const VIDEO_ABSENCE_MAX_MS = 86_400_000;
/**
 * Row R1b: the longest the relay lets a PLAYING camera be silent before it calls its leg lost
 * (`RELAY_IO_BOUND_US` of `apps/capture-worker/src/relay/relay.h`: "playing, without a COMPLETE
 * PICTURE, else CAMERA_STALLED"; held equal by a test of this unit). The relay's word of a loss
 * comes at most this long after the last picture it forwarded, and the Core's clock starts only at
 * that word: so this is what is ADDED to the Core's own span for the most an absence can have been.
 */
export const RELAY_PLAYING_SILENCE_BOUND_MS = 5_000;
/** Row R1b: an absence that is open - what `Live.cameraAbsences` holds. */
type OpenCameraAbsence = Live['cameraAbsences'] extends Map<string, infer Entry> ? Entry : never;
/** Row R1b: how an absence ended, with the two bounds as measured (null: the instant a bound is measured from is not known). */
interface CameraAbsenceEnd {
  readonly ended: 'RE_OPENED' | 'NOT_RE_OPENED';
  /** The relay's tries of the re-open; null when it did not re-open or did not say. */
  readonly tries: number | null;
  readonly atLeastMs: number | null;
  readonly atMostMs: number | null;
}

const instancesOfShutdown = new WeakSet<object>();

/**
 * Registers the shutdown of the capture-session unit as an `onClose` hook of the app (review
 * R74-09). Called at plugin time (a hook cannot be added to a booted app) by the sessions module.
 * The unit itself is still built on first use; an app that never built it has nothing to close.
 */
export function registerSessionCaptureShutdown(app: FastifyInstance): void {
  if (instancesOfShutdown.has(app.stages)) return;
  instancesOfShutdown.add(app.stages);
  app.addHook('onClose', async () => {
    await instances.get(app.stages)?.shutdown();
  });
}

const instances = new WeakMap<object, SessionCapture>();

/** The capture-session unit of an app. Available after `ready()`. */
export function sessionCapture(app: FastifyInstance): SessionCapture {
  const known = instances.get(app.stages);
  if (known !== undefined) return known;
  const created = createSessionCapture(app);
  instances.set(app.stages, created);
  return created;
}

function refusal(status: 409 | 503, code: ApiErrorCode, text: string, details: Record<string, string | null>, cause?: unknown): ApiFailure {
  return new ApiFailure(status, code, text, { details, ...(cause === undefined ? {} : { cause }) });
}

function createSessionCapture(app: FastifyInstance): SessionCapture {
  // The ONE reader of the capture mode (static rule G-R16): a refused combination answers SIMULATED.
  const real = captureOperationOf(app.config) !== CaptureOperation.SIMULATED;
  const ports: SessionCapturePorts = {
    registry: () => captureFenceControl(app).registry(),
    leftoverHelpers: () => captureFenceControl(app).leftoverHelpers(),
    ensureDir: async (path) => {
      await mkdir(path, { recursive: true, mode: 0o700 });
    },
    micStartBoundMs: MIC_START_BOUND_MS,
    cameraOpenBoundMs: PRODUCTION_CAMERA_OPEN_BOUND_MS,
    relayReports: null,
    ingestPairingBoundMs: INGEST_PAIRING_BOUND_MS,
    clockOffsetAdvisoryMs: CAMERA_CLOCK_OFFSET_ADVISORY_MS,
    operationOf: (registry) => registry.operation,
    fileExists: (path) =>
      stat(path).then(
        () => true,
        () => false,
      ),
    // The transcription unit says where the tap of a session is, and null when its snapshot has none.
    tapPathFor: (sessionId) => transcriptionControl(app).tapPathFor(sessionId),
    async snapshotIn(db, sessionId) {
      // `snapshotSttConfigIn` never throws; an app without the transcription composition has no transcriber.
      let control: ReturnType<typeof transcriptionControl>;
      try {
        control = transcriptionControl(app);
      } catch {
        return { ok: false, code: 'TRANSCRIPTION_NOT_MOUNTED', storeFailed: false };
      }
      const outcome = await control.snapshotSttConfigIn(db, sessionId);
      return outcome.ok ? { ok: true } : { ok: false, code: outcome.code, storeFailed: outcome.code === 'SNAPSHOT_STORE_FAILED' };
    },
    startCommitted: (sessionId) => transcriptionControl(app).sessionStartCommitted(sessionId),
    transcriber: {
      begin: (sessionId) => transcriptionControl(app).runs.begin(sessionId),
      end: (sessionId, how) => transcriptionControl(app).runs.end(sessionId, how),
    },
    async writeFacts(path, facts) {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await writeSessionCaptureFacts(path, facts);
    },
  };
  const listeners = new Set<SessionCaptureListener>();
  const prepared = new Map<string, Prepared>();
  let live: Live | null = null;
  let background: Promise<void> = Promise.resolve();
  /** Writes that were started from a record and are not finished: `idle()` waits for them. */
  const writes = new Set<Promise<void>>();
  const track = (write: Promise<void>): void => {
    writes.add(write);
    void write.finally(() => writes.delete(write));
  };

  // ── Saying what went wrong ───────────────────────────────────────────────────────────────────

  function persist(level: 'error' | 'warn', code: string, message: string, err: unknown, context: Record<string, string | number | boolean | null>): void {
    if (level === 'error') app.log.error({ err, code, ...context }, message);
    else app.log.warn({ code, ...context }, message);
    app.errorLog.append({ level, source: SOURCE, message, ...(err === null || err === undefined ? {} : describeError(err)), code, context });
  }

  function tell(event: SessionCaptureEvent): void {
    for (const listener of listeners) {
      const failed = (err: unknown): void => persist('error', 'CAPTURE_SESSION_LISTENER_FAILED', 'a listener of the capture session failed', err, { sessionId: event.sessionId, event: event.type });
      try {
        const result = listener(event);
        if (result instanceof Promise) result.catch(failed);
      } catch (err) {
        failed(err);
      }
    }
  }

  /** Runs `work` after everything that already runs in the background. Never rejects. */
  function inBackground(sessionId: string, step: string, work: () => Promise<void>): void {
    background = background
      .then(work)
      .catch((err: unknown) => persist('error', 'CAPTURE_SESSION_STEP_FAILED', 'a step of the capture session failed', err, { sessionId, step }));
  }

  // ── Closing ──────────────────────────────────────────────────────────────────────────────────

  /** Closes every source handle of a capture and ends its subscriptions. Safe to call twice. */
  async function release(of: Live): Promise<void> {
    of.abort.abort();
    // Row 188 (C37): the reports of superseded attempts beyond the lines that were said, as one count at the end of the capture.
    const dropped = of.pairing?.supersededReports() ?? 0;
    if (dropped > SUPERSEDED_REPORT_LINES && !of.supersededSummed) {
      of.supersededSummed = true;
      app.log.info({ code: 'CAPTURE_RELAY_REPORTS_SUPERSEDED_TOTAL', sessionId: of.sessionId, dropped, said: SUPERSEDED_REPORT_LINES }, 'relay reports for superseded attempts were dropped during this capture: the total');
    }
    of.pairing?.end();
    for (const off of of.offs.splice(0)) off();
    // Finding F3-01: an absence of a camera that is still open when the capture ends. The camera did not come back; the end is its later bound.
    if (of.cameraAbsences.size > 0) {
      const endedAt = app.clock.now();
      const inForce = attemptInForceAtEnd(of);
      for (const open of of.cameraAbsences.values()) {
        persist('warn', 'CAPTURE_CAMERA_ABSENT_AT_END', 'a camera of the session had stopped delivering video and had not come back when the capture ended: the recording of this camera holds nothing after the first instant', null, { sessionId: of.sessionId, deviceId: open.deviceId, profile: open.profile, attempt: open.attempt, loss: open.loss, lostAt: open.lostAt, endedAt, absentAtLeastMs: Math.max(0, endedAt - open.lostAt) });
        // Row R1b: the audit entry of an absence that did NOT end. An absence said in a SUPERSEDED attempt writes nothing:
        // the files of the session begin with the later worker, and nothing of the earlier one is in them.
        if (open.attempt !== inForce) continue;
        // At least: to the FIRST instant the end of the capture was asked (the recording still ran then); at most: to now
        // (the worker has been stopped by every caller of this function), plus the relay's silence bound.
        const atLeastMs = of.leftAt === null ? null : Math.max(0, of.leftAt - open.lostAt);
        recordVideoAbsence(of, open, { ended: 'NOT_RE_OPENED', tries: null, atLeastMs, atMostMs: Math.max(endedAt - open.lostAt, atLeastMs ?? 0, 0) + RELAY_PLAYING_SILENCE_BOUND_MS });
      }
      of.cameraAbsences.clear();
    }
    // Row R1b: every audit entry of an absence is stored (or its failure said) BEFORE the capture is handed over: the seal reads them.
    await of.absenceWrites;
    for (const handle of of.handles.splice(0)) {
      try {
        await handle.close();
      } catch (err) {
        persist('error', 'CAPTURE_SOURCE_NOT_CLOSED', 'a capture source could not be closed', err, { sessionId: of.sessionId, deviceId: handle.deviceId });
      }
    }
    // What this capture told the operator about a camera clock or the evidence volume ends with it.
    const notices = [...of.noticesRaised.values()];
    of.noticesRaised.clear();
    for (const notice of notices) {
      try {
        await app.engine.clearCaptureWarning({ code: notice.code, subject: notice.subject } as Parameters<typeof app.engine.clearCaptureWarning>[0]);
      } catch (err) {
        persist('warn', 'CAPTURE_NOTICE_NOT_RESOLVED', 'a notice of an ended capture could not be resolved', err, { sessionId: of.sessionId, notice: notice.code, deviceId: notice.subject });
      }
    }
    // No exit path leaves a transcriber session open: one that was not told the end is told it here.
    // (Only an OPENED one: whether a capture that was never opened recorded nothing is said by the path that ended it.)
    if (of.transcriberBegun) endTranscriber(of, of.durableSaid);
    if (live === of) live = null;
  }

  /** Tells the transcriber session of a capture that the capture is over. Once; never throws. */
  function endTranscriber(of: Live, recorded: boolean): void {
    if (of.transcriberEnded) return;
    // A capture that recorded NOTHING is told to the transcription unit from the moment the tap path was
    // asked for, whether or not its session was opened (fix pass F-M6's request, D180 / R80-04): the
    // scratch folder of the session may hold a raw PCM tap, and that unit's end is what removes it
    // (idempotent). A capture that recorded tells it only when a transcriber session was opened.
    if (!of.transcriberBegun && (recorded || !of.tapAsked)) return;
    of.transcriberEnded = true;
    try {
      ports.transcriber.end(of.sessionId, { recorded });
    } catch (err) {
      persist('error', 'CAPTURE_TRANSCRIBER_NOT_ENDED', 'the transcriber session of an ended capture could not be told the end', err, { sessionId: of.sessionId, recorded });
    }
  }

  /** The facts file of a capture as it stands now: written after the write before it, never rejected. */
  function writeFacts(of: Live): Promise<void> {
    const facts: SessionCaptureFacts = {
      version: SESSION_CAPTURE_FACTS_VERSION,
      sessionId: of.sessionId,
      startRecordedAt: of.startRecordedAt,
      cameras: of.files.map((file) => {
        const first = of.firstVideo.get(file.deviceId) ?? null;
        const ended = of.cameraEnds.get(file.deviceId) ?? null;
        return {
          trackId: file.trackId,
          deviceId: file.deviceId,
          clockOffsetMs: of.clockOffsets.get(file.deviceId) ?? null,
          measuredClockOffsetMs: of.measuredOffsets.get(file.deviceId)?.offsetMs ?? null,
          syncLevel: of.syncLevels.get(file.deviceId) ?? null,
          ...(ended === null ? {} : { ended: { reason: ended.reason, at: ended.at, lastDurableFragmentIndex: ended.lastDurableFragmentIndex, lastDurableMediaEndMs: ended.lastDurableMediaEndMs } }),
          firstVideo: first === null ? null : { pts: first.pts, timescale: first.timescale, heldMs: first.heldMs, skipped: first.skipped, skippedSpanMs: first.skippedSpanMs },
        };
      }),
    };
    of.factsWritten = of.factsWritten
      .then(() => ports.writeFacts(sessionCaptureFactsPath(app.config.mediaStoreDir, of.sessionId), facts))
      .catch((err: unknown) => persist('error', 'CAPTURE_FACTS_NOT_WRITTEN', 'what the capture side knows of a session could not be written for its seal: the manifest will hold the stand-in values', err, { sessionId: of.sessionId }));
    return of.factsWritten;
  }

  // ── The start, inside the unit ───────────────────────────────────────────────────────────────

  function notRecordable(cause: unknown, deviceId: string | null, why: string): ApiFailure {
    return refusal(409, ApiErrorCode.INVALID_STATE, TEXT.NOT_RECORDABLE, { reason: SOURCE_KIND_NOT_RECORDABLE, cause: why, deviceId }, cause);
  }

  /**
   * The source facts of one row of a start (task 4 row 71; schema design 2.3; AD-07 (1), S13-13): for a microphone slot,
   * what its adapter states of the card behind the input - which physical device records - as the fence's builder admits
   * it (closed keys; every text through the card text rule; bounded). `{}` for a camera slot and for an adapter that
   * states nothing (the fakes, the generated and the local sources).
   *
   * NEVER REFUSES A START: an adapter that throws, and a `USB_AUDIO` input whose adapter states nothing, are written to
   * the error log with the session and the device, and the row stores `{}`. No text of a device is put into that entry.
   */
  function sourceFactsOf(registry: CaptureDeviceRegistry, row: SessionCaptureSource): SessionSourceFacts {
    // D61 (2026-11-04): the four numbered microphone channels carry card facts (was the two roles `MIC-PRIMARY`/`MIC-STANDBY`).
    if (!(MIC_CHANNEL_IDS as readonly string[]).includes(row.slot)) return NO_SOURCE_FACTS;
    try {
      const facts = micSourceFactsOf(audioCardStatementOf(registry.resolve('MIC', row.deviceId), row.deviceId));
      if (row.adapterKind === CaptureAdapterKind.USB_AUDIO && Object.keys(facts).length === 0) {
        persist('warn', 'CAPTURE_SOURCE_FACTS_NOT_STATED', 'the adapter of a sound-card input stated no card facts at the session start: the source row holds none', null, { sessionId: row.sessionId, deviceId: row.deviceId, slot: row.slot });
      }
      return facts;
    } catch (err) {
      // The CODE of a refusal of the adapter layer (a closed vocabulary), never the message of what was thrown: an
      // unexpected error of an adapter may quote the card, and the log is a store as well (AD-07 (1)).
      persist('warn', 'CAPTURE_SOURCE_FACTS_NOT_READ', 'the card facts of a microphone could not be read at the session start: the source row holds none', null, { sessionId: row.sessionId, deviceId: row.deviceId, slot: row.slot, cause: err instanceof CaptureAdapterError ? err.code : 'UNEXPECTED' });
      return NO_SOURCE_FACTS;
    }
  }

  async function recordingStartedIn(scope: EngineUnit, sessionId: string): Promise<void> {
    if (!real) return;
    const state = scope.pending();
    const session = state.session;
    if (session === null || session.id !== sessionId || session.state !== SessionState.RECORDING) return;
    const registry = ports.registry();
    if (registry === null) throw notRecordable(undefined, null, 'NO_REGISTRY');
    const selector: CapturePlanSelector = session.captureConfig ?? state.captureConfig;
    let recordable: RecordableSelector;
    let sources: readonly SessionCaptureSource[];
    try {
      // Row 66's rule over all four slots, then row 136's builder, which trusts none of it.
      recordable = assertRecordableSelector(selector, registry);
      sources = buildSessionCaptureSources({ sessionId, operation: registry.operation, slots: recordable.slots, recordedAt: app.clock.now() });
    } catch (cause) {
      if (cause instanceof CapturePlanError) throw notRecordable(cause, cause.deviceId, cause.reason);
      if (cause instanceof CaptureAdapterError) throw notRecordable(cause, cause.deviceId, cause.code);
      throw cause;
    }
    // Controller ruling C34: SA-3 is FAIL-CLOSED in production. A `REAL_PRODUCTION` start without a source of relay reports
    // could pair nothing, so it is refused here, in the unit of the start and before anything is written: nothing is
    // committed, no worker and no source is started. After the class rule above, so that a selector the operation cannot
    // record keeps its own cause.
    if (ports.operationOf(registry) === CaptureOperation.REAL_PRODUCTION && ports.relayReports === null) throw notRecordable(undefined, null, RELAY_REPORTS_NOT_WIRED);
    await markCaptureConnectingIn(scope, sessionId);
    const first = sources[0];
    if (first === undefined) throw notRecordable(undefined, null, 'SELECTOR_SHAPE');
    // MR-S1 (D61, 2026-11-04): eight rows (four video slots, four numbered microphone channels; D60: six, was four), one statement, in the transaction that persists RECORDING. Each row carries its source facts
    // (task 4 row 71): they are written here or never, the runtime role cannot update the column.
    await scope.unit.query(INSERT_SESSION_CAPTURE_SOURCES, [sessionId, first.recordedAt, ...sources.flatMap((row) => [row.slot, row.deviceId, row.adapterKind, JSON.stringify(sourceFactsOf(registry, row))])]);
    // MR-S6: what was written is read back and held against the running operation again.
    const stored = (await scope.unit.query<{ slot: CaptureSourceSlot; device_id: string; adapter_kind: SessionCaptureSource['adapterKind'] }>(READ_SESSION_CAPTURE_SOURCES, [sessionId])).rows;
    try {
      assertSessionSourcesOfOperation(stored.map((row) => ({ slot: row.slot, deviceId: row.device_id, adapterKind: row.adapter_kind })), registry.operation);
    } catch (cause) {
      if (cause instanceof CaptureAdapterError) throw notRecordable(cause, cause.deviceId, cause.code);
      throw cause;
    }
    // dbc-6 MR-T1: the STT configuration of the session, in this same transaction.
    const snapshot = await ports.snapshotIn(scope.unit, sessionId);
    if (!snapshot.ok) {
      // EVERY real-mode start writes its snapshot or is refused (ruling D-71c-2, integration pass D9): a
      // configuration that cannot be read at this instant, a row that is gone, an absent transcription
      // composition and a statement that failed on the unit all end here. Throwing rolls the unit back:
      // no RECORDING, no source row, no snapshot row; the worker is started only after the commit.
      // The cause is in the error log by its code; the answer names the refusal only.
      persist('error', 'STT_SNAPSHOT_NOT_TAKEN', 'the STT snapshot of a starting session was not taken: the start is refused', null, { sessionId, cause: snapshot.code, storeFailed: snapshot.storeFailed });
      throw refusal(503, ApiErrorCode.NOT_READY, TEXT.SNAPSHOT_NOT_STORED, { reason: STT_SNAPSHOT_NOT_STORED });
    }
    prepared.set(sessionId, { sessionId, selector, recordable, sources });
  }

  // ── The start, after the commit ──────────────────────────────────────────────────────────────

  async function markDurable(of: Live): Promise<void> {
    if (of.durableSaid || of.durableAsked || of.ended) return;
    of.durableAsked = true;
    try {
      await captureDoorsOf(app.engine).markCaptureDurable(of.sessionId);
      of.durableSaid = true;
      tell({ type: 'DURABLE', sessionId: of.sessionId });
    } catch (err) {
      // Asked again at the next fragment record: the session must not stay 'connecting' for a write that failed once.
      persist('error', 'CAPTURE_DURABLE_NOT_SAID', 'the first durable fragment could not be recorded on the session', err, { sessionId: of.sessionId });
    } finally {
      of.durableAsked = false;
    }
  }

  /**
   * Closing pass Z1: the checkpoint figures of this capture, said to the session payload. Never
   * rejects and never stops a recording: a figure that could not be said is said by the next call.
   */
  function sayCheckpoints(of: Live): Promise<void> {
    of.checkpointsSaying = of.checkpointsSaying.then(() => sayCheckpointsNow(of));
    return of.checkpointsSaying;
  }

  async function sayCheckpointsNow(of: Live): Promise<void> {
    const cameras = [...of.checkpoints].map(([deviceId, held]) => ({ deviceId, fragments: held.fragments, bytes: held.bytes }));
    const heard = cameras.reduce((sum, camera) => sum + camera.fragments, 0);
    if (of.checkpointsAt === null || heard === of.checkpointsSaid) return;
    const lastAt = of.checkpointsAt;
    // The window opens when the figures are asked, so a slow unit does not let the next checkpoint ask again at once.
    of.checkpointsSaidAt = app.clock.now();
    try {
      await captureCheckpointDoorsOf(app.engine).applyCaptureCheckpoints(of.sessionId, { lastAt, cameras });
      of.checkpointsSaid = heard;
    } catch (err) {
      persist('warn', 'CAPTURE_CHECKPOINTS_NOT_SAID', 'the checkpoint figures of a recording could not be put on the session; the recording is not affected', err, { sessionId: of.sessionId });
    }
  }

  /** One `FRAGMENT_CHECKPOINT` of the worker: counted by camera; said when the window has passed. */
  function noteCheckpoint(of: Live, deviceId: string, start: number, len: number): void {
    const held = of.checkpoints.get(deviceId) ?? { fragments: 0, bytes: 0 };
    const end = Number.isSafeInteger(start) && Number.isSafeInteger(len) && start >= 0 && len >= 0 ? start + len : held.bytes;
    of.checkpoints.set(deviceId, { fragments: held.fragments + 1, bytes: Math.max(held.bytes, end) });
    const now = app.clock.now();
    of.checkpointsAt = of.checkpointsAt === null ? now : Math.max(now, of.checkpointsAt);
    if (of.checkpointsSaidAt === null || now - of.checkpointsSaidAt >= CHECKPOINT_FACTS_INTERVAL_MS) track(sayCheckpoints(of));
  }

  /** Row 191b: the stored number of a worker's interval record (`Live.intervalSeqBase`). */
  function intervalSeqOf(of: Live, record: AudioSourceIntervalRecord): number {
    const seq = of.intervalSeqBase + record.index;
    of.intervalSeqTop = Math.max(of.intervalSeqTop, seq);
    return seq;
  }

  /** The interval of a start, stored in the order the records arrived (a replayed record rewrites nothing). */
  function writeInterval(of: Live, record: AudioSourceIntervalRecord): Promise<void> {
    const seq = intervalSeqOf(of, record);
    of.intervalWrites = of.intervalWrites.then(async () => {
      try {
        await app.db.pool.query(INSERT_AUDIO_INTERVAL, [of.sessionId, seq, record.deviceId, record.role, mediaMsOfSample(record.fromSample, record.sampleRateHz), record.capturedAtMs, null, AudioIntervalRowReason.START]);
      } catch (err) {
        persist('error', 'AUDIO_INTERVAL_NOT_STORED', 'an audio-source interval could not be stored', err, { sessionId: of.sessionId, seq, deviceId: record.deviceId });
      }
    });
    return of.intervalWrites;
  }

  /**
   * Task 4 row 191b (decision C57): THE GAP OF A RESTART AS A FACT OF THE EVIDENCE. One unit of the
   * engine holds three things, so that none is stored without the others:
   *
   *   the earlier worker's END   the interval that was open is closed where it began in media time
   *                              and at the instant that worker went down (`CLOSE_SUPERSEDED_AUDIO_INTERVAL`);
   *   the later worker's BEGIN   a NEW row under the next number, reason START, with the later
   *                              worker's own media time. Its `from_at` is the worker's instant HELD
   *                              BETWEEN THE TWO BOUNDS of the Core's clock (not before the
   *                              microphones were started again, not after its record arrived): the
   *                              instant a worker states for its first sample is computed back from
   *                              the samples it holds and was measured BEFORE the earlier worker
   *                              went down (row 191), which no row may state;
   *   the audit row              `CAPTURE_AUDIO_ABSENT_ON_RESTART` (DEVICE, WARNING, no actor): the
   *                              session, the two attempts and both bounds in ms whenever they were
   *                              measured. Its device is the microphone the later worker's audio
   *                              begins with; its message names every microphone of the session
   *                              with its role (the detail list of the type is closed and holds no device).
   *
   * No UPDATE grant is used that the runtime role had not (the two closing columns, each written
   * once). A unit that fails is run once more; then the two interval rows are written apart and
   * the failure is said: the audit row is then MISSING and the error log says so by its code.
   */
  function recordAudioGap(of: Live, record: AudioSourceIntervalRecord, gap: AudioGap): Promise<void> {
    const { sessionId } = of;
    const seq = intervalSeqOf(of, record);
    const row = [sessionId, seq, record.deviceId, record.role, mediaMsOfSample(record.fromSample, record.sampleRateHz), gap.laterFromAt, null, AudioIntervalRowReason.START] as const;
    const bound = (ms: number | null): ms is number => ms !== null && Number.isSafeInteger(ms) && ms >= 0 && ms <= AUDIO_GAP_MAX_MS;
    const details = {
      sessionId,
      earlierAttempt: gap.earlierAttempt,
      laterAttempt: gap.laterAttempt,
      ...(bound(gap.atLeastMs) ? { audioAbsentAtLeastMs: gap.atLeastMs } : {}),
      ...(bound(gap.atMostMs) ? { audioAbsentAtMostMs: gap.atMostMs } : {}),
    };
    const context = { sessionId, seq, deviceId: record.deviceId, earlierAttempt: gap.earlierAttempt, laterAttempt: gap.laterAttempt };
    const unit = (): Promise<unknown> =>
      app.engine.run('captureSession.audioAbsentOnRestart', async (scope) => {
        const lines = scope.pending().session?.captureConfig?.mics ?? [];
        const named = lines.length === 0 ? `${record.deviceId} ${record.role}` : lines.map((line) => `${line.deviceId} ${line.channel}`).join(', '); // D61 (2026-11-04): the selector names channels, not roles
        await scope.unit.query(CLOSE_SUPERSEDED_AUDIO_INTERVAL, [sessionId, gap.earlierEndAt]);
        await scope.unit.query(INSERT_AUDIO_INTERVAL, [...row]);
        await scope.unit.audit.append({
          type: 'CAPTURE_AUDIO_ABSENT_ON_RESTART',
          message: `Audio was not recorded while the capture worker was replaced (attempt ${String(gap.earlierAttempt)} to ${String(gap.laterAttempt)}; microphones: ${named})`,
          severity: 'WARNING',
          actorId: null,
          deviceId: record.deviceId,
          sessionId,
          details,
        });
      });
    of.intervalWrites = of.intervalWrites.then(async () => {
      try {
        try {
          await unit();
        } catch (first) {
          persist('warn', 'CAPTURE_AUDIO_GAP_UNIT_RETRIED', 'the unit that records the audio gap of a worker restart failed and is run once more', first, context);
          await unit();
        }
      } catch (err) {
        // The later worker DOES feed the file. The interval rows are evidence metadata: stored by themselves when the unit could not be.
        persist('error', 'CAPTURE_AUDIO_GAP_NOT_AUDITED', 'the audio gap of a worker restart could not be recorded in its unit: the audit row is missing; the interval rows are written apart', err, context);
        try {
          await app.db.pool.query(CLOSE_SUPERSEDED_AUDIO_INTERVAL, [sessionId, gap.earlierEndAt]);
          await app.db.pool.query(INSERT_AUDIO_INTERVAL, [...row]);
        } catch (again) {
          persist('error', 'AUDIO_INTERVAL_NOT_STORED', 'an audio-source interval could not be stored', again, { sessionId, seq, deviceId: record.deviceId });
        }
      }
    });
    return of.intervalWrites;
  }

  /**
   * Task 4 row 191: WHAT A RESTART COST THE AUDIO, SAID ONCE PER LATER WORKER, when that worker
   * reports the first sample of its audio timeline. A worker is replaced only while the session
   * holds nothing durable, so nothing of the earlier worker is in any file: the recorded audio of
   * the session BEGINS with the later worker. This entry states how long no audio was captured,
   * as TWO BOUNDS ON THE CORE'S OWN CLOCK, because the instant a worker states for its first sample
   * is computed from the samples it had received and is not exact for a source that delivers its
   * first samples in a burst (measured with the generated microphones: 185 ms BEFORE the earlier
   * worker went down, row's record):
   *
   *   `audioAbsentAtLeastMs`  from the instant the earlier worker went down to the instant the
   *                           microphones were started again (before that nothing fed a pipe);
   *   `audioAbsentAtMostMs`   from the same instant to the arrival of this record (by then the
   *                           later worker has samples).
   *
   * Beside them: the worker's own statement (`workerAudioFromAt`), and - when the earlier worker
   * had stated its first sample - how long the session had been heard by the earlier worker
   * without any of it being recorded (`earlierAudioNotRecordedMs`).
   *
   * THE INTERVAL ROWS (row 191b): the row of the earlier worker (`intervalRowOf` names its
   * attempt, `intervalRowFromAt` its instant) is written once and never rewritten. It is CLOSED at
   * the instant its worker went down, and the later worker's interval is a NEW row
   * (`recordAudioGap`, which also writes the audit row of the gap); this entry of the error log
   * stays beside them with the worker's own word. The earlier attempt is the LAST one before this
   * that reported audio, and the gap is measured from the instant THAT worker went down.
   *
   * Returns what `recordAudioGap` stores, or null when this record opens no gap (the first worker
   * of the session, or a record this worker repeats).
   */
  function sayAudioGap(of: Live, attempt: number, record: AudioSourceIntervalRecord): AudioGap | null {
    const said = of.audioFrom.has(attempt);
    if (!said) of.audioFrom.set(attempt, record.capturedAtMs);
    if (attempt <= 1 || said) return null;
    const startedAt = of.micsStartedAt.get(attempt) ?? null;
    const heardAt = app.clock.now();
    const earlier = [...of.audioFrom].filter(([known]) => known < attempt).sort(([a], [b]) => b - a)[0] ?? null;
    const downAt = (earlier === null ? undefined : of.workerDownAt.get(earlier[0] + 1)) ?? of.workerDownAt.get(attempt) ?? null;
    // A number every earlier worker used stays its own: the later worker's records are stored after them.
    of.intervalSeqBase = of.intervalSeqTop;
    const atLeastMs = downAt === null || startedAt === null ? null : Math.max(0, startedAt - downAt);
    const atMostMs = downAt === null ? null : Math.max(0, heardAt - downAt);
    const notBefore = startedAt ?? downAt;
    const gap: AudioGap = {
      earlierAttempt: earlier === null ? attempt - 1 : earlier[0],
      laterAttempt: attempt,
      earlierEndAt: downAt ?? heardAt,
      laterFromAt: Math.min(heardAt, notBefore === null ? record.capturedAtMs : Math.max(record.capturedAtMs, notBefore)),
      atLeastMs,
      atMostMs,
    };
    persist('warn','CAPTURE_AUDIO_BEGINS_AFTER_RESTART', 'the capture worker of the session was replaced before anything was durable: the recorded audio begins with the later worker, and nothing heard before it is recorded', null, {
      sessionId: of.sessionId,
      attempt,
      deviceId: record.deviceId,
      role: record.role,
      workerDownAt: downAt,
      microphonesStartedAt: startedAt,
      audioHeardAt: heardAt,
      audioAbsentAtLeastMs: atLeastMs,
      audioAbsentAtMostMs: atMostMs,
      workerAudioFromAt: record.capturedAtMs,
      audioFromMediaMs: mediaMsOfSample(record.fromSample, record.sampleRateHz),
      intervalRowOf: earlier === null ? attempt : earlier[0],
      intervalRowFromAt: earlier === null ? record.capturedAtMs : earlier[1],
      earlierAudioNotRecordedMs: earlier === null || downAt === null ? null : Math.max(0, downAt - earlier[1]),
    });
    return gap;
  }

  async function closeLastInterval(of: Live): Promise<void> {
    if (of.audioEndMs === null) return;
    try {
      await app.db.pool.query(CLOSE_OPEN_AUDIO_INTERVAL, [of.sessionId, of.audioEndMs, app.clock.now()]);
    } catch (err) {
      persist('error', 'AUDIO_INTERVAL_NOT_CLOSED', 'the last audio-source interval could not be closed', err, { sessionId: of.sessionId });
    }
  }

  function onRecord(of: Live, event: CaptureEventOf<'record'>): void {
    if (event.sessionId !== of.sessionId) return;
    watchSession(of);
    const { record } = event;
    if (record.kind === CaptureRecordKind.FIRST_DURABLE_FRAGMENT) onSyncLevel(of, record.deviceId, record.syncLevel ?? null);
    if (record.kind === CaptureRecordKind.FIRST_DURABLE_FRAGMENT || record.kind === CaptureRecordKind.FRAGMENT_CHECKPOINT) {
      // The FIRST of them makes the session 'recording'; asked again while it was not said.
      if (!of.durableSaid) track(markDurable(of));
      of.recorder?.take(event);
      if (record.kind === CaptureRecordKind.FRAGMENT_CHECKPOINT) noteCheckpoint(of, record.deviceId, record.start, record.len);
      return;
    }
    // The interval of the start is this unit's to store; the interval of a switch is stored by the unit of operation 81.
    if (record.kind === CaptureRecordKind.AUDIO_SOURCE_INTERVAL && record.reason === AudioSourceIntervalReason.SESSION_START) {
      // Row 191b: the first record of a LATER worker closes the earlier worker's interval, opens its own by a new row and writes the audit row of the gap.
      const gap = sayAudioGap(of, event.attempt, record);
      track(gap === null ? writeInterval(of, record) : recordAudioGap(of, record, gap));
      return;
    }
    if (record.kind === CaptureRecordKind.AUDIO_SOURCE_INTERVAL) {
      // The record of a switch. A call of operation 81 that waits takes it with its acknowledgement;
      // a record NOBODY waits for (its acknowledgement came after the limit and the call was refused,
      // review R74-06 (b)) is applied here, so the Core never says another microphone than the worker feeds.
      if (of.switchesWaiting > 0) of.switchRecordsSeen.set(record.index, record);
      else inBackground(of.sessionId, 'lateSwitchRecord', () => recordSwitch(of, record, of.switchAskedBy.get(record.deviceId) ?? { operatorId: null, sendingDeviceId: null }).then(() => undefined, () => undefined));
      return;
    }
    if (record.kind === CaptureRecordKind.FIRST_VIDEO_SAMPLE) {
      const first: SessionFirstVideo = { deviceId: record.deviceId, pts: record.pts, timescale: record.timescale, heldMs: Math.round((record.pts * 1000) / record.timescale), skipped: record.skipped, skippedSpanMs: record.skippedSpanMs };
      of.firstVideo.set(record.deviceId, first);
      // Kept for the seal while the capture runs (manifest fields 127 / 128): a restart of the Core does not lose it.
      track(writeFacts(of));
      // Said once per camera file, at level `warn` only when delivered video is not in the file.
      if (first.skippedSpanMs > 0) persist('warn', 'CAPTURE_FIRST_VIDEO_HELD', 'video delivered before the first keyframe at or after the start is not in the camera file', null, { sessionId: of.sessionId, deviceId: first.deviceId, heldMs: first.heldMs, skippedSpanMs: first.skippedSpanMs });
      return;
    }
    if (record.kind === CaptureRecordKind.AUDIO_TIMELINE_END) of.audioEndMs = mediaMsOfSample(record.samples, record.sampleRateHz);
  }

  /** Raises a notice of this capture through the engine and holds it for the end of the capture. Never throws. */
  function raiseNotice(of: Live, key: string, notice: CaptureAdvisoryNotice | CaptureVolumeSyncNotice): void {
    if (of.noticesRaised.has(key)) return;
    of.noticesRaised.set(key, notice);
    track(
      Promise.resolve()
        .then(() => app.engine.raiseCaptureWarning({ ...notice, sessionId: of.sessionId } as Parameters<typeof app.engine.raiseCaptureWarning>[0]))
        .then(
          () => undefined,
          (err: unknown) => {
            // What the engine did not raise is not held: nothing is resolved for it at the end.
            if (of.noticesRaised.get(key) === notice) of.noticesRaised.delete(key);
            persist('error', 'CAPTURE_NOTICE_NOT_RAISED', 'a notice of the capture could not be raised for the operator', err, { sessionId: of.sessionId, notice: notice.code, deviceId: notice.subject });
          },
        ),
    );
  }

  /**
   * THE SYNC LEVEL A CAMERA FILE REALLY HAS (tidy pass F-Y, item 3; review R63-09; ruling D188;
   * decision D189). Kept per camera file in the capture facts - the manifest has no durability
   * field. The worker's statement is the ONLY truthful source of the level (the boot cannot learn
   * it: Node's `fsync` falls back silently), so a level weaker than the full sync - or none stated -
   * is told to the operator here, ONCE per session: CRITICAL where the sources are production's,
   * advice in the development operation. The session keeps recording.
   */
  function onSyncLevel(of: Live, deviceId: string, level: CaptureSyncLevel | null): void {
    if (!of.files.some((file) => file.deviceId === deviceId)) return;
    if (level !== null) of.syncLevels.set(deviceId, level);
    track(writeFacts(of));
    if (level === CaptureSyncLevel.FULL) return;
    persist(of.production ? 'error' : 'warn', 'CAPTURE_VOLUME_SYNC_NOT_FULL', 'the evidence volume did not confirm the full sync for a camera file of the session: the recording may not survive a power loss', null, { sessionId: of.sessionId, deviceId, syncLevel: level ?? 'NOT_STATED', production: of.production });
    raiseNotice(of, CaptureNoticeReason.EVIDENCE_VOLUME_SYNC_NOT_FULL, { code: CaptureNoticeReason.EVIDENCE_VOLUME_SYNC_NOT_FULL, subject: null, critical: of.production, syncLevel: level ?? 'NOT_STATED' });
  }

  /**
   * THE CLOCK OF A CAMERA AS THE WORKER MEASURED IT (tidy pass F-Y, item 4; fix F-M3 decision 3).
   * The worker anchors a camera whose clock is up to 2 s away from the Core's and records it at its
   * own clock; what it measured is in `TELEMETRY.clocks[].lagMs` (arrival time minus camera time).
   * The FIRST reading of a camera from the worker whose file it is, is the offset at anchoring:
   * kept as camera minus Core (`-lagMs`, whole ms) for manifest field 40. It contains the delivery
   * delay (about 20 ms on the fixture): a static offset cannot be told from it without a round trip.
   * Above the advisory threshold the camera gets ONE advisory alert with the number; a later worker
   * of the session (a restart before anything was durable) measures again.
   */
  function onClocks(of: Live, event: CaptureEventOf<'telemetry'>): void {
    if (of.ended || event.frame.clocks.length === 0) return;
    const attempt = of.supervisor.status().attempt;
    let measured = false;
    for (const clock of event.frame.clocks) {
      if (!Number.isFinite(clock.lagMs) || !of.files.some((file) => file.deviceId === clock.deviceId)) continue;
      if (of.measuredOffsets.get(clock.deviceId)?.attempt === attempt) continue;
      // `+ 0`: a lag of zero is the offset 0, never -0.
      const offsetMs = Math.round(-clock.lagMs) + 0;
      of.measuredOffsets.set(clock.deviceId, { attempt, offsetMs });
      measured = true;
      const above = Math.abs(offsetMs) > ports.clockOffsetAdvisoryMs;
      app.log.info({ code: 'CAPTURE_CLOCK_OFFSET_MEASURED', sessionId: of.sessionId, deviceId: clock.deviceId, offsetMs, advisoryMs: ports.clockOffsetAdvisoryMs, above }, 'the capture worker measured the clock offset of a camera: recorded for the manifest, not corrected');
      if (!above) continue;
      persist('warn', 'CAPTURE_CAMERA_CLOCK_OFFSET', 'the clock of a camera differs from the Core by more than the advisory threshold: the recording keeps the camera\'s own timeline and records the offset', null, { sessionId: of.sessionId, deviceId: clock.deviceId, offsetMs, advisoryMs: ports.clockOffsetAdvisoryMs });
      raiseNotice(of, `${CaptureAdvisoryReason.CAMERA_CLOCK_OFFSET}|${clock.deviceId}`, { code: CaptureAdvisoryReason.CAMERA_CLOCK_OFFSET, subject: clock.deviceId, offsetMs });
    }
    if (measured) track(writeFacts(of));
  }

  /**
   * SA-3, THE WORKER'S SIDE (task 4 row 48). The worker's connect report of a camera is its ingest
   * state in a telemetry frame CHANGING to `CONNECTED` (a level said many times a second is one
   * report; `CONNECTED` again after another state, for the same worker, is a second connect and a
   * fault of the pairing). The attempt is the supervisor's at the moment the frame is read.
   */
  function onIngest(of: Live, event: CaptureEventOf<'telemetry'>): void {
    const pairing = of.pairing;
    if (pairing === null || of.ended || event.frame.ingest.length === 0) return;
    const attempt = of.supervisor.status().attempt;
    for (const ingest of event.frame.ingest) {
      const said = `${attempt}:${ingest.state}`;
      if (of.ingestSaid.get(ingest.deviceId) === said) continue;
      of.ingestSaid.set(ingest.deviceId, said);
      if (ingest.state === CaptureIngestState.CONNECTED) pairing.workerConnected(ingest.deviceId, attempt);
    }
  }

  /**
   * A CAMERA'S ABSENCE INSIDE A SESSION, AS A FACT OF THE SESSION'S RECORD (finding F3-01 of the M3
   * review; task 4 row 43; the audio side's model is row 191 / 191b). The relay of a camera says
   * that its camera leg was lost while its push to the worker stands, and later that it is open
   * again. NEITHER IS A REPORT OF THE PAIRING: the worker keeps its one connection, so nothing here
   * reaches `relayReported` and no rule of SA-3 changes (C35 (b) is about an arrival; a re-open is
   * none). What this function does with them:
   *   - C37: a word that names another attempt than the one in force, another session's, or a
   *     device that is no camera of the plan, is dropped - never a fault;
   *   - LOST: the instant of the Core's clock is kept, and ONE entry of the persistent error log
   *     (`CAPTURE_CAMERA_ABSENT_IN_SESSION`, level warn) states the camera, the stream, the attempt,
   *     the relay's number of the loss, its cause and that instant;
   *   - REOPENED, for the loss that is open: ONE entry (`CAPTURE_CAMERA_BACK_IN_SESSION`) with BOTH
   *     bounds on the Core's clock, their difference, and the relay's own numbers (its measure of
   *     the gap, the pictures it held back before the first keyframe, its tries);
   *   - an absence that is still open when the capture ends is closed by `release` with the end as
   *     its later bound (`CAPTURE_CAMERA_ABSENT_AT_END`): the camera did not come back.
   * THE NOTICE is not written here: the camera's own fault (`CAPTURE_FAULT` / `CAMERA_STREAM_ENDED`
   * about that camera) is raised and cleared by the camera watch through the watch fault sink, on
   * the same two reports - one critical notice and one `FAULT_RAISED` / `FAULT_CLEARED` pair of
   * audit entries per absence (C40, C60 (2)). The capture is NOT ended by an absence.
   * NOT YET STATED ANYWHERE SIGNED: no audit type and no member of the sealed manifest holds the
   * bounds of a video absence in milliseconds (the audio side has `CAPTURE_AUDIO_ABSENT_ON_RESTART`
   * and `audio.absentOnRestart`). Until the contract has them, the numbers live in the error log.
   */
  function cameraLegSaid(of: Live, cameras: ReadonlySet<string>, report: RelayIngestReport): void {
    const leg = report.leg;
    if (leg === undefined || of.ended || !cameras.has(report.deviceId)) return;
    const whole = (value: unknown, least: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= least;
    if (typeof leg.profile !== 'string' || !/^[A-Z][A-Z0-9_]{0,63}$/.test(leg.profile) || !whole(leg.loss, 1)) return;
    let inForce: number;
    try {
      inForce = of.supervisor.status().attempt;
    } catch {
      return;
    }
    of.absenceAttempt = Math.max(of.absenceAttempt, inForce);
    if (report.attempt !== inForce) {
      of.cameraLegsDropped += 1;
      if (of.cameraLegsDropped <= SUPERSEDED_REPORT_LINES) {
        app.log.info({ code: 'CAPTURE_CAMERA_LEG_REPORT_SUPERSEDED', sessionId: of.sessionId, deviceId: report.deviceId, attempt: report.attempt, attemptInForce: inForce, dropped: of.cameraLegsDropped }, 'a relay\'s word about its camera leg named an attempt that is not in force and was dropped; no fault');
      }
      return;
    }
    const key = `${report.deviceId} ${leg.profile}`;
    const said = { sessionId: of.sessionId, deviceId: report.deviceId, profile: leg.profile, attempt: report.attempt, loss: leg.loss };
    if (leg.event === 'LOST') {
      // One open absence per stream: a loss said while one is open is the same absence going on.
      if (of.cameraAbsences.has(key)) return;
      const lostAt = app.clock.now();
      of.cameraAbsences.set(key, { deviceId: report.deviceId, profile: leg.profile, attempt: report.attempt, loss: leg.loss, lostAt });
      const cause = typeof leg.cause === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(leg.cause) ? leg.cause : null;
      persist('warn', 'CAPTURE_CAMERA_ABSENT_IN_SESSION', 'a camera of the session stopped delivering video while the recording goes on: its relay keeps the push and opens the camera again; the recording of this camera has a gap from here', null, { ...said, cause, lostAt });
      return;
    }
    if (leg.event !== 'REOPENED') return;
    const open = of.cameraAbsences.get(key);
    // Only the loss this capture was told of ends here: by its number, of the attempt it was said in.
    if (open === undefined || open.loss !== leg.loss || open.attempt !== report.attempt) return;
    of.cameraAbsences.delete(key);
    const backAt = app.clock.now();
    persist('warn', 'CAPTURE_CAMERA_BACK_IN_SESSION', 'a camera of the session delivers video again: its relay opened it again and forwards from the first keyframe; the recording of this camera has a gap between the two instants', null, {
      ...said,
      lostAt: open.lostAt,
      backAt,
      absentMs: Math.max(0, backAt - open.lostAt),
      relayGapMs: whole(leg.gapMs, 0) ? leg.gapMs : null,
      heldBack: whole(leg.heldBack, 0) ? leg.heldBack : null,
      tries: whole(leg.tries, 1) ? leg.tries : null,
    });
    // Row R1b: THE AUDIT ENTRY of the absence, written now that it ended. At least: the relay's own measure (its monotonic
    // clock, from the instant it called the camera lost to the first keyframe of the new leg) - the Core's span is no lower
    // bound, because both of its instants are arrivals. At most: the Core's span, never below the relay's measure, plus
    // the relay's silence bound (the last picture came at most that long before the relay's word of the loss).
    const relayGapMs = whole(leg.gapMs, 0) ? leg.gapMs : null;
    recordVideoAbsence(of, open, {
      ended: 'RE_OPENED',
      tries: whole(leg.tries, 1) ? leg.tries : null,
      atLeastMs: relayGapMs,
      atMostMs: Math.max(backAt - open.lostAt, relayGapMs ?? 0, 0) + RELAY_PLAYING_SILENCE_BOUND_MS,
    });
  }

  /** Row R1b: the capture attempt in force when a capture ends - the supervisor's while it still holds the session, else the highest this capture saw. */
  function attemptInForceAtEnd(of: Live): number {
    let said = 0;
    try {
      const status = of.supervisor.status();
      if (status.sessionId === of.sessionId) said = status.attempt;
    } catch {
      said = 0;
    }
    return Math.max(1, said, of.absenceAttempt, of.micAttempt, ...of.workerDownAt.keys());
  }

  /**
   * Row R1b (decision C99; finding F3-01): ONE audit entry `CAPTURE_VIDEO_ABSENT_IN_SESSION` per
   * absence of a camera inside the session, written WHEN THE ABSENCE ENDS - by the relay's re-open
   * (`cameraLegSaid`) or by the end of the capture with the camera still away (`release`). DEVICE,
   * WARNING, no actor; the row's device is the camera. Through the engine (one unit of its own)
   * and the audit writer, which holds the entry to the closed list of the type. The entries are
   * written one after the other and `release` waits for them: the seal reads these rows for the
   * signed manifest member `tracks[].absentInSession`, so the signed numbers ARE the stored ones.
   * A bound outside 0 to one day is left out (a clock fault is not stated as a measurement). A
   * unit that fails is run once more; then the failure is said by its code in the persistent error
   * log - the entry is then MISSING and the manifest states one absence fewer than happened.
   * A camera whose track is not in the plan has no entry (it has no file either).
   */
  function recordVideoAbsence(of: Live, open: OpenCameraAbsence, end: CameraAbsenceEnd): void {
    const { sessionId } = of;
    const trackId = of.files.find((file) => file.deviceId === open.deviceId)?.trackId ?? null;
    const context = { sessionId, deviceId: open.deviceId, trackId, attempt: open.attempt, loss: open.loss, ended: end.ended };
    if (trackId === null) {
      persist('error', 'CAPTURE_VIDEO_ABSENCE_NOT_AUDITED', 'the absence of a camera inside the session could not be recorded: the camera has no track in this session', null, context);
      return;
    }
    const bound = (ms: number | null): ms is number => ms !== null && Number.isSafeInteger(ms) && ms >= 0 && ms <= VIDEO_ABSENCE_MAX_MS;
    const atLeastMs = bound(end.atLeastMs) ? end.atLeastMs : null;
    // The most is never stated below the least.
    const atMostMs = bound(end.atMostMs) && (atLeastMs === null || end.atMostMs >= atLeastMs) ? end.atMostMs : null;
    const details = {
      sessionId,
      deviceId: open.deviceId,
      trackId,
      attempt: open.attempt,
      loss: open.loss,
      ...(end.tries === null ? {} : { tries: end.tries }),
      ...(atLeastMs === null ? {} : { videoAbsentAtLeastMs: atLeastMs }),
      ...(atMostMs === null ? {} : { videoAbsentAtMostMs: atMostMs }),
      ended: end.ended,
    };
    const how = end.ended === 'RE_OPENED' ? 'its relay opened it again' : 'it had not come back when the capture ended';
    const unit = (): Promise<unknown> =>
      app.engine.run('captureSession.videoAbsentInSession', async (scope) => {
        await scope.unit.audit.append({
          type: 'CAPTURE_VIDEO_ABSENT_IN_SESSION',
          message: `Video was not recorded while a camera of the session was absent (${open.deviceId}, ${trackId}; attempt ${String(open.attempt)}, loss ${String(open.loss)}): ${how}`,
          severity: 'WARNING',
          actorId: null,
          deviceId: open.deviceId,
          sessionId,
          details,
        });
      });
    of.absenceWrites = of.absenceWrites.then(async () => {
      try {
        try {
          await unit();
        } catch (first) {
          persist('warn', 'CAPTURE_VIDEO_ABSENCE_UNIT_RETRIED', 'the unit that records the absence of a camera inside the session failed and is run once more', first, context);
          await unit();
        }
      } catch (err) {
        persist('error', 'CAPTURE_VIDEO_ABSENCE_NOT_AUDITED', 'the absence of a camera inside the session could not be recorded: the audit row is missing, and the sealed manifest will state one absence fewer', err, context);
      }
    });
    track(of.absenceWrites);
  }

  /**
   * Finding F3-01: a camera counts as open for a LATER worker of the session (the pairing's word). An absence of that
   * camera that was said in an EARLIER attempt and never ended - its relay was closed with its worker - is over here:
   * the camera delivers again, to the later worker. The relay of the earlier attempt can no longer say so itself.
   */
  function cameraOpenAgain(of: Live, deviceId: string, attempt: number): void {
    // A Map may lose the entry it is at while it is walked.
    of.absenceAttempt = Math.max(of.absenceAttempt, attempt);
    // Row R1b: NO audit entry here - the absence was said in an attempt that is now SUPERSEDED, and the files of the
    // session begin with the later worker: nothing of the earlier attempt's timeline is in them.
    for (const [key, open] of of.cameraAbsences) {
      if (open.deviceId !== deviceId || open.attempt >= attempt) continue;
      of.cameraAbsences.delete(key);
      const backAt = app.clock.now();
      persist('warn', 'CAPTURE_CAMERA_BACK_IN_SESSION', 'a camera of the session delivers video again: it was opened for a later capture worker of the session; the recording of this camera has a gap between the two instants', null, {
        sessionId: of.sessionId,
        deviceId,
        profile: open.profile,
        attempt: open.attempt,
        loss: open.loss,
        lostAt: open.lostAt,
        backAt,
        absentMs: Math.max(0, backAt - open.lostAt),
        relayGapMs: null,
        heldBack: null,
        tries: null,
        laterAttempt: attempt,
      });
    }
  }

  /**
   * SA-3, THE FAULT (RC-3, BR-08; design addendum 5.3): the protocol has no frame that drops one
   * camera of a running session, so a pairing that failed ENDS THE CAPTURE of the session, by the
   * door every end of a capture takes (`captureEnded`: the fault of the session with its audit
   * entry, the worker stopped, every source closed). Said once: the pairing says one fault. The
   * error-log entry names the camera, the attempt and the closed reason; the cause the session
   * records is the one word `CAMERA_INGEST_NOT_PAIRED`.
   */
  function pairingFailed(of: Live, failure: IngestPairingFailure): void {
    if (of.ended) return;
    // Row 188 (C40 (2)): when the worker's gate refused this camera for this attempt, the entry names the gate's own word beside the pairing's.
    const gate = of.gateRefusals.get(failure.deviceId);
    const gateReason: Record<string, string> = gate !== undefined && gate.attempt === failure.attempt ? { gateReason: gate.reason } : {};
    persist('error', 'CAPTURE_INGEST_NOT_PAIRED', 'a camera of the session did not count as open: the report of its relay and the connect report of the capture worker did not pair, and the capture is ended', null, { sessionId: of.sessionId, deviceId: failure.deviceId, attempt: failure.attempt, reason: failure.reason, ...gateReason });
    let durable = false;
    try {
      const status = of.supervisor.status();
      durable = status.sessionId === of.sessionId && status.durable;
    } catch {
      // A supervisor that cannot say: the file on the disk decides in `captureEnded`.
    }
    of.leave();
    inBackground(of.sessionId, 'captureEnded', () => captureEnded(of, CAMERA_INGEST_NOT_PAIRED, durable).then(() => foldGateNotice(of, failure)));
  }

  /**
   * ONE NOTICE, WITH THE STRONGER CAUSE (task 4 row 188; controller ruling C40 (2)). One arrival can
   * be said twice: the worker's gate refuses a push (`CAMERA_ANNOUNCE_NOT_MATCHED` / `_NOT_SEEN`: the
   * capture forwarder raises it as a critical fault of THAT CAMERA, at once and by itself), and the
   * pairing ends the capture for the same camera and attempt because its relay reported
   * (`CAMERA_INGEST_NOT_PAIRED`: the critical fault of the capture as a whole, raised by the door of
   * `captureEnded`). The end of the capture is the stronger of the two: it says that nothing is
   * being recorded any more. So, once that fault STANDS, the camera's own notice is resolved here -
   * the operator has one critical notice, not two. The refusal of the gate is not lost: its audit
   * entry stays, and the error-log entry of the pairing names the gate's reason beside it.
   *
   * A gate refusal WITHOUT a pairing end is not touched (C40 (2): it is the critical fault of that
   * camera and the capture goes on), and neither is the notice of another camera or another attempt.
   * Never throws.
   */
  async function foldGateNotice(of: Live, failure: IngestPairingFailure): Promise<void> {
    const gate = of.gateRefusals.get(failure.deviceId);
    if (gate === undefined || gate.attempt !== failure.attempt) return;
    const context = { sessionId: of.sessionId, deviceId: failure.deviceId, attempt: failure.attempt, gateReason: gate.reason, cause: CAMERA_INGEST_NOT_PAIRED };
    try {
      // Only when the stronger notice is really there - the session is in FAULT by its capture: a capture end the engine did not
      // record leaves the camera's notice as the one that is.
      const session = app.engine.slice('session');
      if (session === null || session.id !== of.sessionId || session.fault?.kind !== 'CAPTURE_FAULT') return;
      await app.engine.clearCaptureWarning({ code: 'CAPTURE_FAULT', subject: failure.deviceId, reason: gate.reason } as Parameters<typeof app.engine.clearCaptureWarning>[0]);
      app.log.info({ code: 'CAPTURE_GATE_NOTICE_FOLDED', ...context }, 'the refusal of the capture worker\'s gate and the end of the capture by the pairing are one arrival: the camera\'s own notice is resolved, the notice of the ended capture stands');
    } catch (err) {
      persist('error', 'CAPTURE_GATE_NOTICE_NOT_FOLDED', 'the notice of a camera the capture worker\'s gate refused could not be resolved after the pairing ended the capture: two notices stand for one arrival', err, context);
    }
  }

  /**
   * C3 (fix wave H driver A; decision D202): what the supervisor says of cameras it gave up - its
   * status until the stop, the outcome of the stop after it - is kept by camera and written into
   * the facts file, so that the seal marks those tracks with their cause. A camera of another plan
   * is not this session's. Resolves when the facts file holds what is known.
   */
  async function noteCameraEnds(of: Live, ends: readonly CaptureCameraEnd[] | undefined): Promise<void> {
    let changed = false;
    for (const end of ends ?? []) {
      if (of.cameraEnds.has(end.deviceId) || !of.files.some((file) => file.deviceId === end.deviceId)) continue;
      of.cameraEnds.set(end.deviceId, end);
      changed = true;
      persist('warn', 'CAPTURE_CAMERA_ENDED', 'a camera was given up while the session went on: its track is sealed as interrupted, with this cause', null, { sessionId: of.sessionId, deviceId: end.deviceId, reason: end.reason, lastDurableFragmentIndex: end.lastDurableFragmentIndex, lastDurableMediaEndMs: end.lastDurableMediaEndMs });
    }
    if (changed) await writeFacts(of);
  }
  /** The supervisor's status list, when it is of THIS session (a double written before the member has none). */
  const cameraEndsNow = (of: Live): readonly CaptureCameraEnd[] | undefined => {
    try {
      const status = of.supervisor.status();
      return status.sessionId === of.sessionId ? status.cameraEnds : undefined;
    } catch {
      return undefined;
    }
  };
  const cameraEndsOf = (of: Live): { readonly cameraEnds?: readonly CaptureCameraEnd[] } => (of.cameraEnds.size === 0 ? {} : { cameraEnds: Object.freeze([...of.cameraEnds.values()]) });

  /** The end of a capture that did not come from a stop: a failed start or an interrupted recording. */
  async function captureEnded(of: Live, cause: string | null, supervisorDurable: boolean): Promise<void> {
    if (of.ended) return;
    of.ended = true;
    // THE FILE IS THE TRUTH (D67): a camera file of the plan on the disk is durable media, whatever a frame said.
    let onDisk = false;
    for (const file of of.files) onDisk = onDisk || (await ports.fileExists(file.path));
    const durable = supervisorDurable || of.durableSaid || onDisk;
    let outcome: 'FAILED_START' | 'INTERRUPTED' | 'IGNORED' = 'IGNORED';
    // The engine's door is asked twice before its failure stands (review R74-07): the end of a capture is said once by the worker.
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        outcome = (await captureDoorsOf(app.engine).endCapture(of.sessionId, { durable, cause })).value;
        break;
      } catch (err) {
        if (attempt === 2) persist('error', 'CAPTURE_END_NOT_RECORDED', 'the end of a capture could not be recorded on the session', err, { sessionId: of.sessionId, durable });
      }
    }
    // The worker of a session that ended is ended too, so that the supervisor is free for the next session.
    const endsAtEnd = cameraEndsNow(of);
    try {
      const stopped: CaptureStopOutcome | undefined = await of.supervisor.stop(of.sessionId, CaptureStopReason.CRASH);
      await noteCameraEnds(of, stopped?.cameraEnds ?? endsAtEnd);
    } catch (err) {
      await noteCameraEnds(of, endsAtEnd);
      if (!(err instanceof CaptureSupervisorError)) persist('error', 'CAPTURE_WORKER_NOT_STOPPED', 'the capture worker of an ended session could not be stopped', err, { sessionId: of.sessionId });
    }
    await of.recorder?.idle();
    await sayCheckpoints(of);
    await closeLastInterval(of);
    await of.factsWritten;
    // DURABLE MEDIA IS ALWAYS HANDED OVER (review R74-07). When the engine ignored the end (the session
    // had left RECORDING: a stop that committed and never reached the worker) or its door failed, the
    // camera files are still evidence: the listeners are told INTERRUPTED and the seal's controller
    // joins or refuses by itself. Without this the session waited for the next boot.
    const handedOver = outcome === 'INTERRUPTED' || (durable && outcome !== 'FAILED_START');
    // The tap of an interrupted recording is whole now; a failed start recorded nothing.
    endTranscriber(of, handedOver);
    await release(of);
    persist('warn', handedOver ? 'CAPTURE_INTERRUPTED' : 'CAPTURE_START_FAILED', handedOver ? 'a recording was interrupted: its durable media is to be sealed as interrupted' : 'a recording did not start: nothing is durable and no evidence item is made', null, {
      sessionId: of.sessionId,
      cause,
      outcome,
      durable,
    });
    if (handedOver) tell({ type: 'INTERRUPTED', sessionId: of.sessionId, cause, files: Object.freeze([...of.files]), firstVideo: Object.freeze([...of.firstVideo.values()]), ...cameraEndsOf(of) });
    else if (outcome === 'FAILED_START') tell({ type: 'FAILED_START', sessionId: of.sessionId, cause, reason: cause ?? 'CAPTURE_START_FAILED', evidenceFiles: 0 });
  }

  /**
   * THE SESSION LEFT RECORDING BY ANOTHER DOOR (row 71c): the engine's committed session is not this
   * capture's RECORDING session any more, and this unit did not end the capture. Looked at whenever
   * the worker says something (a record, a telemetry frame). The worker is stopped; nothing keeps
   * recording for a session that says it is in FAULT.
   */
  function watchSession(of: Live): void {
    if (of.ended || live !== of) return;
    const session = app.engine.slice('session');
    const left = session === null || session.id !== of.sessionId || session.state === SessionState.FAULT || session.state === SessionState.RECOVERY;
    if (!left) return;
    const state = session === null || session.id !== of.sessionId ? 'NONE' : session.state;
    inBackground(of.sessionId, 'sessionLeftRecording', () => sessionLeftRecording(of, state));
  }

  async function sessionLeftRecording(of: Live, state: string): Promise<void> {
    if (of.ended) return;
    of.ended = true;
    persist('error', 'CAPTURE_SESSION_LEFT_RECORDING', 'the session left RECORDING while its capture ran: the capture worker is stopped', null, { sessionId: of.sessionId, state });
    const endsAtEnd = cameraEndsNow(of);
    try {
      const stopped: CaptureStopOutcome | undefined = await of.supervisor.stop(of.sessionId, CaptureStopReason.CRASH);
      await noteCameraEnds(of, stopped?.cameraEnds ?? endsAtEnd);
    } catch (err) {
      await noteCameraEnds(of, endsAtEnd);
      if (!(err instanceof CaptureSupervisorError)) persist('error', 'CAPTURE_WORKER_NOT_STOPPED', 'the capture worker of a session that left RECORDING could not be stopped', err, { sessionId: of.sessionId });
    }
    let onDisk = false;
    for (const file of of.files) onDisk = onDisk || (await ports.fileExists(file.path));
    const durable = of.durableSaid || onDisk;
    await of.recorder?.idle();
    await sayCheckpoints(of);
    await closeLastInterval(of);
    await of.factsWritten;
    endTranscriber(of, durable);
    await release(of);
    if (durable) tell({ type: 'INTERRUPTED', sessionId: of.sessionId, cause: SESSION_LEFT_RECORDING, files: Object.freeze([...of.files]), firstVideo: Object.freeze([...of.firstVideo.values()]), ...cameraEndsOf(of) });
    else tell({ type: 'FAILED_START', sessionId: of.sessionId, cause: SESSION_LEFT_RECORDING, reason: SESSION_LEFT_RECORDING, evidenceFiles: 0 });
  }

  /**
   * Launches the helper of every microphone handle that has one, ALL IN THE SAME TURN, and resolves
   * when each has an outcome. Never rejects. A start that neither succeeds nor fails within
   * `ports.micStartBoundMs` (the no-delivery bound) is reported and no longer waited for.
   */
  function startMicrophones(current: Live, ready: Prepared): Promise<void> {
    const starts: Promise<void>[] = [];
    // Row 191: the attempt these starts belong to. When its worker is replaced, what they still say is of a superseded attempt.
    const attempt = current.micAttempt;
    for (const handle of current.handles) {
      const launch = (handle as { start?: (signal?: AbortSignal) => Promise<void> }).start;
      if (typeof launch !== 'function' || current.ended || current.leaving) continue;
      const channel = ready.selector.mics.find((mic) => mic.deviceId === handle.deviceId)?.channel ?? null;
      // D80(6) / ML-7, carried onto the numbered plane by D61 (2026-11-04): a later channel alone missing warns; the transcription channel (1, feeding `AUDIO-01`) that does not start is an error. Neither is replaced.
      const failed = (err: unknown, cause: string): void =>
        persist(channel === PRIMARY_MIC_CHANNEL ? 'error' : 'warn', 'CAPTURE_MIC_NOT_STARTED', 'a microphone of the session could not be started', err, { sessionId: current.sessionId, deviceId: handle.deviceId, channel, cause });
      let bound: ReturnType<typeof setTimeout> | undefined;
      let launched: Promise<void>;
      try {
        launched = Promise.resolve(launch.call(handle, current.abort.signal));
      } catch (err) {
        launched = Promise.reject(err);
      }
      const settled = launched.then(
        () => 'STARTED' as const,
        (err: unknown) => ({ err }),
      );
      const late = new Promise<'BOUND'>((resolve) => {
        bound = setTimeout(() => resolve('BOUND'), ports.micStartBoundMs);
        bound.unref?.();
      });
      starts.push(
        Promise.race([settled, late]).then((outcome) => {
          clearTimeout(bound);
          // The capture is being ended (a stop, or the worker's end): a start that was cut short by it is no failed start.
          if (current.leaving || current.ended) return;
          if (outcome === 'STARTED') return;
          // Row 191 (the reading of C37 for microphones): the worker this start fed was replaced and its handle is closed. The
          // start that ended with it is no failed microphone of the session: dropped, counted, said in one line.
          if (current.micAttempt !== attempt) {
            current.micReportsDropped += 1;
            app.log.info(
              { code: 'CAPTURE_MIC_REPORT_SUPERSEDED', sessionId: current.sessionId, deviceId: handle.deviceId, channel, attempt, attemptInForce: current.micAttempt, dropped: current.micReportsDropped }, // D61 (2026-11-04): the selector names channels now
              'the outcome of a microphone start of an attempt this Core has superseded was dropped: its worker was replaced and the microphone is started again; no fault',
            );
            return;
          }
          if (outcome === 'BOUND') failed(null, 'MIC_START_BOUND');
          else failed(outcome.err, 'MIC_START_FAILED');
        }),
      );
    }
    return Promise.all(starts).then(() => undefined);
  }

  /**
   * Task 4 row 191: THE MICROPHONES OF A LATER WORKER OF THE SESSION (the rule drafted by row 184;
   * measured there: a later worker received 0 samples, because the helper of a microphone ends when
   * the worker that read its pipe goes down, and a handle starts once).
   *
   * Asked twice per restart with the same attempt and answered with ONE piece of work: by the
   * session when it hears `RESTARTING` (so the work runs inside the supervisor's back-off), and by
   * the supervisor before it starts the worker of that attempt, which waits for the promise
   * (`CaptureAttemptIngest.sources`). In this order, through the contract of the adapter layer and
   * nothing else (`close()`, `open()`), in EVERY operation - the generated and the local sources
   * of development and the production adapter get the same treatment:
   *
   *   1. every microphone handle of the earlier attempt is closed, one after the other, and all are
   *      closed before any is opened (an input is held by one handle; a close removes the pipe);
   *   2. every microphone the earlier attempt held is opened again, one after the other as at the
   *      start (an open may list the cards and write a configuration): the pipe is made again
   *      BEFORE the later worker is given its plan - a worker refuses for good a plan whose
   *      microphone path is no named pipe;
   *   3. it resolves with the inputs that are open. `startMicrophonesAgain` starts them when that
   *      worker has acknowledged `START`, before its cameras are opened.
   *
   * A microphone that cannot be opened again is said as at a first start (D80(6)): the PRIMARY an
   * error, the STANDBY a warning, neither replaced by the other. Without the PRIMARY there is no
   * plan, as at a first start (`buildCapturePlan`): the promise rejects and the supervisor starts
   * no worker - the capture ends with its fault. Without the STANDBY the later worker's plan has
   * one microphone. Each close and each open is held to `ports.micStartBoundMs`, so the promise
   * always settles; a source that comes up after its bound is closed at once and never held.
   *
   * A session whose microphones were never started (its first worker did not come up: the handles
   * are open and unstarted) keeps them as they are. Never asked for an attempt twice with two
   * outcomes: the work of an attempt is made once.
   */
  function microphonesAgain(current: Live, registry: CaptureDeviceRegistry, ready: Prepared, attempt: number): Promise<ReadonlyMap<string, AudioStreamHandle['input']>> {
    if (current.micsAgain?.attempt === attempt) return current.micsAgain.ready;
    const inForce = (): ReadonlyMap<string, AudioStreamHandle['input']> => new Map([...current.micHandles].map(([deviceId, handle]) => [deviceId, handle.input]));
    if (!current.micsStarted || current.ended || current.leaving) return Promise.resolve(inForce());
    const { sessionId } = current;
    const before = current.micsAgain?.ready.then(() => undefined, () => undefined) ?? Promise.resolve();
    // From here an outcome of a start of the earlier attempt is of a superseded attempt, and STARTED waits for the starts of this one.
    current.micAttempt = attempt;
    current.micsStarted = false;
    const superseded = current.micStartsSettle;
    current.micStarts = new Promise<void>((resolve) => (current.micStartsSettle = resolve));
    superseded?.();
    /** `work`, or 'BOUND' when it has no outcome within the bound of a microphone start. Never rejects for the bound's sake. */
    const bounded = async <Result>(work: Promise<Result>): Promise<Result | 'BOUND'> => {
      let bound: ReturnType<typeof setTimeout> | undefined;
      const late = new Promise<'BOUND'>((resolve) => {
        bound = setTimeout(() => resolve('BOUND'), ports.micStartBoundMs);
        bound.unref?.();
      });
      try {
        return await Promise.race([work, late]);
      } finally {
        clearTimeout(bound);
      }
    };
    const made = before.then(async () => {
      const earlier = [...current.micHandles.values()];
      current.micHandles.clear();
      // 1. Closed first, all of them.
      for (const handle of earlier) {
        const held = current.handles.indexOf(handle);
        // Not held any more: the end of the capture closed it meanwhile.
        if (held === -1) continue;
        current.handles.splice(held, 1);
        try {
          const closing = handle.close();
          if ((await bounded(closing)) === 'BOUND') {
            closing.catch(() => undefined);
            persist('error', 'CAPTURE_SOURCE_NOT_CLOSED', 'a capture source could not be closed', null, { sessionId, deviceId: handle.deviceId, attempt, cause: 'MIC_CLOSE_BOUND' });
          }
        } catch (err) {
          persist('error', 'CAPTURE_SOURCE_NOT_CLOSED', 'a capture source could not be closed', err, { sessionId, deviceId: handle.deviceId, attempt });
        }
      }
      // 2. Opened again, in the order of the selector.
      const inputs = new Map<string, AudioStreamHandle['input']>();
      for (const mic of ready.selector.mics) {
        if (!earlier.some((handle) => handle.deviceId === mic.deviceId)) continue;
        if (current.ended || current.leaving || current.abort.signal.aborted) break;
        const failed = (err: unknown, cause: string | null): void =>
          persist(mic.channel === PRIMARY_MIC_CHANNEL ? 'error' : 'warn', 'CAPTURE_MIC_NOT_OPENED', 'a microphone of the session could not be opened again for a later capture worker', err, { sessionId, deviceId: mic.deviceId, channel: mic.channel, attempt, ...(cause === null ? {} : { cause }) }); // D61 (2026-11-04): the transcription channel (1) is the error; a later channel warns
        let asked: Promise<AudioStreamHandle>;
        try {
          asked = Promise.resolve(registry.resolve('MIC', mic.deviceId).open(mic.deviceId, { sessionId, signal: current.abort.signal }));
        } catch (err) {
          asked = Promise.reject(err);
        }
        try {
          const handle = await bounded(asked);
          if (handle === 'BOUND') {
            // Given up at the bound; a source that comes up afterwards feeds nothing and is closed.
            asked.then((late) => late.close()).catch(() => undefined);
            failed(null, 'MIC_OPEN_BOUND');
            continue;
          }
          current.handles.push(handle);
          current.micHandles.set(mic.deviceId, handle);
          // The capture was ended while this source was being opened: `release` has run and will not see the handle.
          if (current.abort.signal.aborted) await release(current);
          else inputs.set(mic.deviceId, handle.input);
        } catch (err) {
          failed(err, null);
        }
      }
      const transcription = ready.selector.mics.find((mic) => mic.channel === PRIMARY_MIC_CHANNEL); // D61 (2026-11-04): channel 1 feeds `AUDIO-01`, the transcribed track (was the PRIMARY role)
      // Said above with the microphone and its channel; the supervisor reads only that the sources are not ready.
      if (transcription === undefined || !inputs.has(transcription.deviceId)) throw new Error('the channel-1 microphone of the session is not open for the later capture worker');
      return inputs as ReadonlyMap<string, AudioStreamHandle['input']>;
    });
    // Asked for by the supervisor a back-off later: a rejection is not unhandled meanwhile.
    made.catch(() => undefined);
    track(made.then(() => undefined, () => undefined));
    current.micsAgain = { attempt, ready: made };
    return made;
  }

  /**
   * Task 4 row 191: THE LATER WORKER ACCEPTED ITS PLAN (phase `RECORDING` after `RESTARTING`). The
   * microphones `microphonesAgain` opened for it are started, all in the same turn, exactly as at
   * the first start (`startMicrophones`): nothing waits for them, each is held to its bound, and
   * one that cannot start is said with its role and never replaced.
   */
  function startMicrophonesAgain(current: Live, ready: Prepared): void {
    if (current.micsStarted || current.ended || current.leaving) return;
    current.micsStarted = true;
    current.micsStartedAt.set(current.micAttempt, app.clock.now());
    const settle = current.micStartsSettle;
    current.micStartsSettle = null;
    const starts = startMicrophones(current, ready);
    track(starts);
    void starts.then(() => settle?.());
  }

  /**
   * Opens the source of every camera of the plan toward the worker's listeners, ALL IN THE SAME
   * TURN (task 4 row 47; design addendum section 3), and resolves when each has an outcome. Never
   * rejects. Each adapter is asked ONCE. `opened` and `notOpened` are filled as the outcomes come.
   *
   * In `REAL_PRODUCTION` an open that has no outcome within `ports.cameraOpenBoundMs` is given up:
   * its own signal is aborted (what stops a relay that is still being started), the camera is
   * reported with the cause `CAMERA_OPEN_BOUND`, and a source that comes up afterwards is closed at
   * once and never held. In another operation the open gets the session's signal and no bound,
   * as before.
   *
   * The target of an open holds the ingest address: nothing here reports it. A failed open is
   * said by its device and a cause; the error-log entry of a failure holds the error's name, its
   * code and its stack frames, never its text (`describeError`).
   */
  function openCameras(current: Live, registry: CaptureDeviceRegistry, plan: CapturePlan, round: CameraRound): Promise<void> {
    const { sessionId } = current;
    const { opened, notOpened } = round;
    const opens: Promise<void>[] = [];
    // Row 179: a round whose worker went down opens nothing more; what it has in flight ends without a report (a later round opens the camera again).
    const over = new Promise<'OVER'>((resolve) => {
      if (round.over.signal.aborted) resolve('OVER');
      else round.over.signal.addEventListener('abort', () => resolve('OVER'), { once: true });
    });
    for (const camera of plan.cameras) {
      if (current.ended || current.leaving || round.over.signal.aborted) break;
      const { deviceId } = camera;
      const failed = (err: unknown, cause: string | null): void => {
        // One camera short of the four the plan names (D60, 2026-11-04; was: one of two) is a degraded session (D72(k)); with none the worker ends the session itself (`NO_CAMERA_CONNECTED`).
        notOpened.push(deviceId);
        persist('warn', 'CAPTURE_CAMERA_NOT_OPENED', 'a camera of the session could not be opened', err, { sessionId, deviceId, ...(cause === null ? {} : { cause }) });
      };
      // The signal of THIS open: the session's own, and in production one that the bound can abort without ending the session.
      const own = current.production ? new AbortController() : null;
      const forward = (): void => own?.abort();
      if (own !== null) {
        if (current.abort.signal.aborted) own.abort();
        else current.abort.signal.addEventListener('abort', forward, { once: true });
      }
      const unlink = (): void => current.abort.signal.removeEventListener('abort', forward);
      // Row 179: the address of the worker IN FORCE at this open, which is the plan's only for the first worker of a session.
      const address = current.ingest.get(deviceId);
      if (address === undefined) {
        unlink();
        failed(null, INGEST_ADDRESS_UNKNOWN);
        continue;
      }
      const target: CameraSourceTarget = { ingestUrl: address, sessionId, attempt: current.supervisor.status().attempt, ...(camera.profile === null ? {} : { profile: camera.profile }) };
      let asked: Promise<SourceHandle>;
      try {
        asked = Promise.resolve(registry.resolve('CAMERA', deviceId).openSource(deviceId, target, own?.signal ?? current.abort.signal));
      } catch (err) {
        asked = Promise.reject(err);
      }
      let givenUp = false;
      const settled = asked.then(
        async (handle) => {
          if (givenUp || round.over.signal.aborted) {
            // It came up after its bound (the camera was reported not opened), or for a worker that is gone (row 179): its source feeds nothing and is closed.
            try {
              await handle.close();
            } catch (err) {
              persist('error', 'CAPTURE_SOURCE_NOT_CLOSED', 'a capture source could not be closed', err, { sessionId, deviceId });
            }
            return;
          }
          current.handles.push(handle);
          round.handles.push(handle);
          // A source that came up although the session's signal was aborted meanwhile (a shutdown) is closed at once.
          if (current.abort.signal.aborted) await release(current);
          opened.push(deviceId);
        },
        (err: unknown) => {
          if (!givenUp && !round.over.signal.aborted) failed(err, null);
        },
      );
      if (own === null) {
        opens.push(settled);
        continue;
      }
      let bound: ReturnType<typeof setTimeout> | undefined;
      const late = new Promise<'BOUND'>((resolve) => {
        bound = setTimeout(() => resolve('BOUND'), ports.cameraOpenBoundMs);
        bound.unref?.();
      });
      opens.push(
        Promise.race([settled.then(() => 'SETTLED' as const), late, over]).then((outcome) => {
          clearTimeout(bound);
          unlink();
          if (outcome === 'SETTLED') return;
          givenUp = true;
          own.abort();
          // Given up at the bound: said. Over with its worker (row 179): not a camera that failed, the next round opens it again.
          if (outcome === 'BOUND') failed(null, CAMERA_OPEN_BOUND);
        }),
      );
    }
    return Promise.all(opens).then(() => undefined);
  }

  /**
   * Task 4 row 179: THE WORKER OF A RECORDING WENT DOWN AND THE SUPERVISOR STARTS ANOTHER (phase
   * `RESTARTING`: only while the session holds no durable fragment). In `REAL_PRODUCTION` the camera
   * round of that worker is over: its opens in flight are given up, and its sources - relays that
   * push to a listener that is gone, with an address no later worker accepts - are closed. A new
   * round stands in its place and waits for the next worker.
   *
   * The development operation is left as it was (decision of the row): its camera sources are
   * neither closed nor opened again when a worker is replaced, exactly as before row 179.
   */
  function cameraRoundOver(current: Live): void {
    const earlier = current.cameras;
    if (!current.production || earlier === null || earlier.over.signal.aborted || current.ended || current.leaving) return;
    earlier.over.abort();
    const next = newCameraRound();
    current.cameras = next;
    next.closing = earlier.closing.then(async () => {
      for (const handle of earlier.handles.splice(0)) {
        const held = current.handles.indexOf(handle);
        // Not held any more: the end of the capture closed it meanwhile.
        if (held === -1) continue;
        current.handles.splice(held, 1);
        try {
          await handle.close();
        } catch (err) {
          persist('error', 'CAPTURE_SOURCE_NOT_CLOSED', 'a capture source could not be closed', err, { sessionId: current.sessionId, deviceId: handle.deviceId });
        }
      }
    });
    track(next.closing);
  }

  /**
   * Task 4 row 179: THE NEXT WORKER OF THE SESSION ACCEPTED ITS PLAN AND LISTENS (phase `RECORDING`
   * after `RESTARTING`). The supervisor said the addresses of that worker before it started it
   * (`current.ingest`); every camera of the plan is opened again toward them - one open per camera
   * and attempt, each with the bound of a start - once the sources of the earlier round are closed.
   */
  function cameraRoundAgain(current: Live, registry: CaptureDeviceRegistry, plan: CapturePlan): void {
    const round = current.cameras;
    if (!current.production || round === null || round.over.signal.aborted) return;
    track(round.closing.then(() => openCameras(current, registry, plan, round)).then(round.settle));
  }

  async function begin(ready: Prepared): Promise<void> {
    const { sessionId } = ready;
    const supervisor = app.capture;
    const registry = ports.registry();
    let sayGone: () => void = () => undefined;
    const gone = { promise: new Promise<void>((resolve) => (sayGone = resolve)), resolve: (): void => sayGone() };
    const current: Live = {
      sessionId,
      supervisor,
      abort: new AbortController(),
      handles: [],
      offs: [],
      files: [],
      firstVideo: new Map(),
      recorder: null,
      durableSaid: false,
      durableAsked: false,
      ended: false,
      leaving: false,
      left: gone.promise,
      leave() {
        // Row R1b: the FIRST instant the end was asked is the later edge of what an open absence lasted at least.
        if (current.leftAt === null) current.leftAt = app.clock.now();
        current.leaving = true;
        gone.resolve();
      },
      audioEndMs: null,
      startRecordedAt: ready.sources[0]?.recordedAt ?? 0,
      clockOffsets: new Map(),
      measuredOffsets: new Map(),
      syncLevels: new Map(),
      noticesRaised: new Map(),
      production: registry !== null && ports.operationOf(registry) === CaptureOperation.REAL_PRODUCTION,
      ingest: new Map(),
      cameras: null,
      micHandles: new Map(),
      micAttempt: 1,
      micsStarted: false,
      micsAgain: null,
      micStarts: Promise.resolve(),
      micStartsSettle: null,
      micReportsDropped: 0,
      audioFrom: new Map(),
      workerDownAt: new Map(),
      micsStartedAt: new Map(),
      intervalSeqBase: 0,
      intervalSeqTop: 0,
      intervalWrites: Promise.resolve(),
      pairing: null,
      ingestSaid: new Map(),
      gateRefusals: new Map(),
      supersededSummed: false,
      cameraAbsences: new Map(),
      cameraLegsDropped: 0,
      absenceWrites: Promise.resolve(),
      leftAt: null,
      absenceAttempt: 0,
      tapAsked: false,
      transcriberBegun: false,
      transcriberEnded: false,
      factsWritten: Promise.resolve(),
      cameraEnds: new Map(),
      checkpoints: new Map(),
      checkpointsAt: null,
      checkpointsSaidAt: null,
      checkpointsSaid: 0,
      checkpointsSaying: Promise.resolve(),
      switchesWaiting: 0,
      switchAskedBy: new Map(),
      switchRecordsSeen: new Map(),
      switchesRecorded: new Set(),
    };
    live = current;
    tell({ type: 'CONNECTING', sessionId, sources: ready.sources });
    try {
      if (registry === null || !SESSION_ID.test(sessionId)) throw new CaptureSupervisorError('CAPTURE_PLAN_INVALID', 'the capture registry is gone, or the session ID is not usable');
      const folder = `${app.config.mediaStoreDir}/${sessionMediaFolder(sessionId)}`;
      await ports.ensureDir(folder);

      // The microphones first: the plan names where each one's samples come from AND the channel's own audio file
      // (D61, 2026-11-04: one entry per numbered channel; `outputPath` is the twin of a camera's, named per channel).
      const mics: Partial<Record<MicChannelId, CapturePlanMicSource>> = {};
      for (const mic of ready.selector.mics) {
        try {
          const handle = await registry.resolve('MIC', mic.deviceId).open(mic.deviceId, { sessionId, signal: current.abort.signal });
          current.handles.push(handle);
          current.micHandles.set(mic.deviceId, handle);
          // The unit was shut down while this source was being opened: `release` has run and will not see the handle.
          if (current.abort.signal.aborted) await release(current);
          mics[mic.channel] = { input: handle.input, outputPath: `${folder}/${micFileName(mic.channel)}` }; // D61 (2026-11-04): opened, so its file is named
        } catch (err) {
          // A later channel may be missing (D80(6) generalized by D61, 2026-11-04); without channel 1 - the transcription channel - the plan builder refuses below.
          persist(mic.channel === PRIMARY_MIC_CHANNEL ? 'error' : 'warn', 'CAPTURE_MIC_NOT_OPENED', 'a microphone of the session could not be opened', err, { sessionId, deviceId: mic.deviceId, channel: mic.channel });
        }
      }
      const cameras: Partial<Record<VideoTrackId, { ingestUrl: string; outputPath: string }>> = {};
      for (const camera of ready.selector.cameras) {
        const trackId = TRACKS.find((track) => track === camera.trackId);
        if (trackId === undefined) continue;
        const outputPath = `${folder}/${cameraFileName(trackId)}`;
        // BR-07: a new address per track at every start, from the one function that builds it. Its receivers are the plan and the open below.
        cameras[trackId] = { ingestUrl: captureIngestAddress(sessionId, trackId, randomBytes), outputPath };
        current.files.push({ trackId, deviceId: camera.deviceId, path: outputPath });
      }
      let pcmTapPath: string | null = null;
      current.tapAsked = true;
      try {
        pcmTapPath = await ports.tapPathFor(sessionId);
      } catch (err) {
        // A recording never waits for, or fails because of, the transcriber (RK-1): it records without a tap.
        persist('warn', 'CAPTURE_TAP_PATH_UNKNOWN', 'the PCM tap of the session is not known: the session records without one', err, { sessionId });
      }
      const plan: CapturePlan = buildCapturePlan({ selector: ready.selector, registry, cameras, mics, pcmTapPath });
      // Row 179: the addresses of the FIRST worker are the plan's; the supervisor replaces them, all at once, for every later worker.
      const addressesInForce = (addresses: ReadonlyMap<string, string>): void => {
        current.ingest.clear();
        for (const [deviceId, address] of addresses) current.ingest.set(deviceId, address);
      };
      addressesInForce(new Map(plan.cameras.map((camera) => [camera.deviceId, camera.ingestUrl])));

      // The recorder of row 59, one per recording session, fed from the supervisor's records.
      current.recorder = createFragmentRecorder({
        sessionId,
        tracks: new Map(plan.cameras.map((camera) => [camera.deviceId, camera.trackId as VideoTrackId])),
        store: createRecordingFragmentStore(app.db.pool),
        report: (failure) => persist('error', failure.code, 'a fragment row of the recording could not be stored', failure.err, { sessionId, trackId: failure.trackId, seq: failure.seq }),
      });
      // The facts file of THIS session replaces whatever an earlier session of the same ID left (a reset reuses IDs).
      await writeFacts(current);
      current.offs.push(supervisor.on('record', (event) => onRecord(current, event)));
      current.offs.push(
        supervisor.on('telemetry', (event) => {
          if (event.sessionId !== sessionId) return;
          watchSession(current);
          onIngest(current, event);
          onClocks(current, event);
        }),
      );
      current.offs.push(
        supervisor.on('warning', (event) => {
          // Review R74-03: a camera of the plan that did not connect is said to the listeners (the notices unit words the degraded start).
          // Task 4 row 182: the worker names four causes of a camera that never delivered (until then one word for all). Each is still
          // "the worker refused, or gave up, this listener" for the pairing; which of them is a MISSING camera is ruling C35 (`../capture`).
          const absent = isCameraAbsentReason(event.reason);
          if (event.sessionId !== sessionId || event.source !== 'worker' || !(absent || isCameraIntegrityReason(event.reason)) || event.state !== CaptureWarningState.ACTIVE || event.subject === null) return;
          const attempt = supervisor.status().attempt;
          // Row 188 (C40 (2)): a refusal of the worker's GATE is kept by camera BEFORE the pairing judges it, so that an end of the
          // capture by the pairing for the same camera and attempt is said as ONE notice (`foldGateNotice`).
          if (!absent && event.reason !== null) current.gateRefusals.set(event.subject, { reason: event.reason, attempt });
          // SA-3 / BR-08 (row 48): the worker refused, or gave up, the listener of this camera - with the pairing applied, a fault of the capture.
          current.pairing?.workerRefused(event.subject, attempt);
          // C35 (a): only a missing camera is the degraded start the notices unit words as a WARNING. C35 (b): a refusal of the worker's
          // gate is an integrity fault - the capture forwarder raises it as a critical fault of the camera under its own reason, so it is
          // not ALSO said as "did not connect".
          if (absent) tell({ type: 'CAMERA_NOT_CONNECTED', sessionId, deviceId: event.subject });
        }),
      );
      current.offs.push(
        supervisor.on('phase', (event) => {
          if (event.sessionId !== sessionId) return;
          // SA-3 (row 48): the pairing is of ONE worker. A worker that listens begins its attempt; one that went down ends
          // it at once (what a relay or a late frame of it still says is of an earlier attempt and pairs with nothing).
          if (event.phase === CapturePhase.RECORDING) current.pairing?.begin(supervisor.status().attempt);
          if (event.phase === CapturePhase.RESTARTING) current.pairing?.begin(supervisor.status().attempt + 1);
          // Row 179: the worker of a recording went down and is replaced / the next worker listens (see `cameraRoundOver`).
          if (event.phase === CapturePhase.RESTARTING) cameraRoundOver(current);
          // Row 191: the microphones of the worker that went down are closed and opened again NOW, inside the back-off; the next worker waits for them.
          if (event.phase === CapturePhase.RESTARTING) {
            const status = supervisor.status();
            if (status.lastCrash !== null) current.workerDownAt.set(status.attempt + 1, status.lastCrash.at);
            void microphonesAgain(current, registry, ready, status.attempt + 1).catch(() => undefined);
          }
          // Row 191: the next worker accepted its plan - its microphones are started first, in this turn, as at the first start; then the cameras (row 179).
          if (event.phase === CapturePhase.RECORDING && event.previous === CapturePhase.RESTARTING) startMicrophonesAgain(current, ready);
          if (event.phase === CapturePhase.RECORDING && event.previous === CapturePhase.RESTARTING) cameraRoundAgain(current, registry, plan);
          if (event.phase !== CapturePhase.FAULTED) return;
          const status = supervisor.status();
          current.leave();
          inBackground(sessionId, 'captureEnded', () => captureEnded(current, status.lastCrash?.detail ?? status.lastCrash?.code ?? null, status.sessionId === sessionId && status.durable));
        }),
      );

      // SA-3 (row 48): with relay reports here, in REAL_PRODUCTION, a camera counts as open only by the pairing. Subscribed
      // BEFORE the worker is started, so that no report of a relay of this session can come before its listener.
      const relayReports = current.production ? ports.relayReports : null;
      if (relayReports !== null) {
        const planCameras: ReadonlySet<string> = new Set(plan.cameras.map((camera) => camera.deviceId));
        current.pairing = createIngestPairing({
          cameras: plan.cameras.map((camera) => camera.deviceId),
          boundMs: ports.ingestPairingBoundMs,
          after(delayMs, callback) {
            const timer = setTimeout(callback, delayMs);
            timer.unref?.();
            return () => clearTimeout(timer);
          },
          opened: (deviceId, attempt) => {
            app.log.info({ code: 'CAPTURE_CAMERA_INGEST_PAIRED', sessionId, deviceId, attempt }, 'a camera of the session counts as open: the report of its relay and the connect report of the capture worker are paired');
            cameraOpenAgain(current, deviceId, attempt);
          },
          fault: (failure) => pairingFailed(current, failure),
          // Row 188 (C37): a relay of an attempt the Core itself superseded still spoke. Dropped by the pairing; said here in ONE
          // line per report with the running count - the first `SUPERSEDED_REPORT_LINES` of a capture, the rest are counted only.
          superseded: (dropped) => {
            if (dropped.count > SUPERSEDED_REPORT_LINES) return;
            app.log.info(
              { code: 'CAPTURE_RELAY_REPORT_SUPERSEDED', sessionId, deviceId: dropped.deviceId, attempt: dropped.attempt, attemptInForce: dropped.inForce, dropped: dropped.count },
              'a relay report for an attempt this Core has superseded was dropped: its worker was replaced and its relay is being ended; no fault',
            );
          },
        });
        current.offs.push(
          relayReports.subscribe((report) => {
            if (report.sessionId !== sessionId) return;
            // Finding F3-01: a relay's word about its camera leg is NOT a report of the pairing (the push stands; a re-open is no second arrival).
            if (report.leg !== undefined) cameraLegSaid(current, planCameras, report);
            else current.pairing?.relayReported(report.deviceId, report.attempt);
          }),
        );
      }

      // ONCE (D72(l)): the supervisor restarts a worker by itself while nothing is durable. Row 179 (BR-07 (2)): every
      // such later worker gets addresses of its own, built by the same function from the same source, and says them here.
      // Row 191: every such later worker also waits until the microphones were closed and opened again for it (`microphonesAgain`).
      await supervisor.start(sessionId, plan, { chance: randomBytes, renewed: (_attempt, addresses) => addressesInForce(addresses), sources: (attempt) => microphonesAgain(current, registry, ready, attempt) });

      // ML-5: `open` only PREPARED the pipe of a microphone; its helper is launched when the worker has
      // accepted the plan. BOTH ARE LAUNCHED NOW, TOGETHER, and nothing below waits for either
      // (integration pass D9, item 4; row 140's finding F-6): started one after the other, the second
      // helper was launched a settle time late and lost the head of its track (96,000 samples measured),
      // and the cameras were opened after both. Each start is held to the no-delivery bound; a
      // microphone that cannot start is reported with its role, never replaced (OD-11, cap §E.1: the
      // worker's `MIC_DISCONNECTED` then names it), and it delays neither the other nor a camera.
      // Row 191: a handle starts once. When this worker is replaced, new handles are opened and started for the next one.
      current.micsStarted = true;
      current.micStarts = startMicrophones(current, ready);

      // The worker listens and writes the tap: the transcriber session of an STT-enabled session is
      // opened. Not awaited: a recording never waits for the transcriber (RK-1).
      if (pcmTapPath !== null && !current.ended && !current.leaving) {
        current.transcriberBegun = true;
        track(
          ports.transcriber.begin(sessionId).then(
            () => undefined,
            (err: unknown) => persist('error', 'CAPTURE_TRANSCRIBER_NOT_OPENED', 'the transcriber session of the recording could not be opened: the session is not transcribed', err, { sessionId }),
          ),
        );
      }

      // The worker listens now: the cameras are opened toward its listeners, BOTH IN THE SAME TURN
      // (row 47): a camera that is slow to answer does not cost the other its window. Waited for until
      // each has an outcome ... unless the end of the capture was asked meanwhile (R74-08): an open
      // that is still in flight then ends by the session's signal, and a source it brings is closed.
      // Row 179: the opens are the round of the worker in force. When that worker goes down before it holds a fragment,
      // the round is over and the next one opens the cameras again; what is said below is the outcome of the newest round.
      const first = newCameraRound();
      current.cameras = first;
      void openCameras(current, registry, plan, first).then(first.settle);
      let cameraOutcomes: CameraRound = first;
      for (let waited: CameraRound | null = null; waited !== current.cameras && !current.leaving; ) {
        waited = cameraOutcomes = current.cameras;
        await Promise.race([waited.settled, current.left]);
      }
      // Said in the order of the plan, whichever camera answered first.
      const inPlanOrder = (ids: readonly string[]): string[] => plan.cameras.map((camera) => camera.deviceId).filter((deviceId) => ids.includes(deviceId));
      // Field 40: the clock of each camera against the Core's, as its adapter reports it. A read; never a reason to end a capture.
      for (const camera of plan.cameras) {
        if (current.leaving) break;
        let offset: number | null = null;
        try {
          const reported = await registry.resolve('CAMERA', camera.deviceId).ntpOffsetMs(camera.deviceId);
          if (Number.isFinite(reported)) offset = Math.round(reported);
        } catch (err) {
          persist('warn', 'CAPTURE_CLOCK_OFFSET_UNKNOWN', 'the clock offset of a camera of the session is not reported by its adapter', err, { sessionId, deviceId: camera.deviceId });
        }
        current.clockOffsets.set(camera.deviceId, offset);
      }
      // Every microphone start has an outcome by now or within its bound: said before the session says STARTED.
      // ... unless the end of the capture was asked meanwhile (R74-08): the step queued behind this one stops the worker NOW.
      // Row 191: the starts waited for are those of the worker in force (a worker that was replaced meanwhile has new ones).
      for (let waited: Promise<void> | null = null; waited !== current.micStarts && !current.leaving; ) {
        waited = current.micStarts;
        await Promise.race([waited, current.left]);
      }
      await writeFacts(current);
      if (!current.ended) tell({ type: 'STARTED', sessionId, cameras: inPlanOrder(cameraOutcomes.opened), camerasNotOpened: inPlanOrder(cameraOutcomes.notOpened) });
    } catch (err) {
      const cause = err instanceof CaptureSupervisorError ? (err.detail ?? err.code) : err instanceof CapturePlanError ? err.reason : err instanceof CaptureAdapterError ? err.code : 'CAPTURE_START_FAILED';
      if (!(err instanceof CaptureSupervisorError)) persist('error', 'CAPTURE_START_NOT_MADE', 'the capture of a session could not be started', err, { sessionId, cause });
      const status = supervisor.status();
      await captureEnded(current, cause, status.sessionId === sessionId && status.durable);
    }
  }

  // ── Operation 81 ─────────────────────────────────────────────────────────────────────────────

  const stateOf = (session: ActiveSession): AudioSourceStateBody | null => {
    const source = session.audioSource ?? null;
    return source === null ? null : { sessionId: session.id, activeInputId: source.activeInputId, standbyInputId: source.standbyInputId, switchedAt: source.switchedAt ?? app.clock.now(), intervalFromMs: source.intervalFromMs };
  };

  const notOpen = (): ApiFailure => new ApiFailure(404, ApiErrorCode.NOT_FOUND, TEXT.NOT_OPEN);
  const conflict = (reason: string, cause?: unknown): ApiFailure => refusal(409, ApiErrorCode.AUDIO_SOURCE_CONFLICT, reason === 'NO_SUCH_INPUT' ? TEXT.NO_SUCH_INPUT : TEXT.SWITCH_REFUSED, { reason }, cause);

  /** Mode `simulated`: the simulator's own hosted action, in one unit, on the session the path names. */
  async function switchSimulated(principal: Principal, sessionId: string, inputId: string): Promise<AudioSourceStateBody> {
    await app.engine.run('captureSession.switchAudioSource', async (scope) => {
      const session = scope.pending().session;
      if (session === null || session.id !== sessionId) throw notOpen();
      // C3 §4 (request of pass D4): a well-formed input that is no input of the session is 409 AUDIO_SOURCE_CONFLICT, as in real capture - never the 404 of the hosted action.
      if (!(session.captureConfig?.mics ?? scope.pending().captureConfig.mics).some((mic) => mic.inputId === inputId)) throw conflict('NO_SUCH_INPUT');
      await scope.command(principal, 'switchAudioSource', ...([inputId] as HostedActionArguments<'switchAudioSource'>));
    });
    const session = app.engine.slice('session');
    const answer = session === null || session.id !== sessionId ? null : stateOf(session);
    if (answer === null) throw conflict('NO_AUDIO_SOURCE');
    return answer;
  }

  async function switchReal(principal: Principal, sessionId: string, inputId: string): Promise<AudioSourceStateBody> {
    const session = app.engine.slice('session');
    if (session === null || session.id !== sessionId) throw notOpen();
    if (session.state !== SessionState.RECORDING) throw new ApiFailure(409, ApiErrorCode.INVALID_STATE, TEXT.NOT_RECORDING, { details: { from: session.state, event: 'switchAudioSource' } });
    const mic = (session.captureConfig?.mics ?? []).find((entry) => entry.inputId === inputId);
    const current = stateOf(session);
    if (mic === undefined || current === null) throw conflict('NO_SUCH_INPUT');
    // The input that already feeds the track: nothing changes and nothing is written.
    if (current.activeInputId === inputId) return current;
    const of = live;
    if (of === null || of.sessionId !== sessionId || of.ended) throw conflict('CAPTURE_NOT_RUNNING');

    const actor: SwitchActor = {
      operatorId: principal.kind === 'OPERATOR' ? principal.operatorId : null,
      // E-30 / SEC35-17: the paired device a command came from is named; a web console session has none.
      sendingDeviceId: principal.kind === 'OPERATOR' ? principal.deviceId : null,
    };
    of.switchAskedBy.set(mic.deviceId, actor);
    // D61 (2026-11-04): the worker's two-role lane trades the transcription pair - channel 1 is `PRIMARY`, channel 2 `STANDBY`
    // (`sim/types.ts`); a later channel has no role on that lane until the worker's own D61 wave, and cannot be switched to.
    const workerRole = mic.channel === 'MIC-01' ? CaptureMicRole.PRIMARY : mic.channel === 'MIC-02' ? CaptureMicRole.STANDBY : null;
    if (workerRole === null) throw conflict('SWITCH_REFUSED');
    let record: AudioSourceIntervalRecord | null;
    of.switchesWaiting += 1;
    try {
      record = await of.supervisor.switchAudioSource(sessionId, workerRole);
    } catch (cause) {
      if (!(cause instanceof CaptureSupervisorError)) throw cause;
      // The command was not acknowledged in time or was refused. A record of THAT microphone that
      // arrived while this call waited says the worker did switch: it is recorded, never dropped (R74-06 (b)).
      const seen = [...of.switchRecordsSeen.values()].find((entry) => entry.deviceId === mic.deviceId && !of.switchesRecorded.has(of.intervalSeqBase + entry.index));
      if (seen === undefined) throw conflict(cause.detail ?? cause.code, cause);
      record = seen;
    } finally {
      of.switchesWaiting -= 1;
      if (of.switchesWaiting === 0) of.switchRecordsSeen.clear();
    }
    // The worker says that role already feeds the track: the Core's state says another. Said, never guessed.
    if (record === null || record.deviceId !== mic.deviceId) {
      persist('error', 'AUDIO_SWITCH_WITHOUT_RECORD', 'the capture worker acknowledged a switch without the interval record of that microphone', null, { sessionId, deviceId: mic.deviceId });
      throw conflict('SWITCH_NOT_REALISED');
    }
    const realised = await recordSwitch(of, record, actor);
    const after = app.engine.slice('session');
    const answer = after === null || after.id !== sessionId ? null : stateOf(after);
    // The session's pair was not moved (it left RECORDING while the worker switched): the answer is what the record says feeds the track.
    if (answer === null || answer.activeInputId !== inputId) return { sessionId, activeInputId: inputId, standbyInputId: realised.fromInputId, switchedAt: app.clock.now(), intervalFromMs: realised.toMs };
    return answer;
  }

  /**
   * RECORDS A SWITCH THE WORKER REALISED, from its interval record (review R74-06). ONE unit holds
   * the session's new pair (when the session still records), the closed and the opened
   * `session_audio_intervals` rows and the `AUDIO_SOURCE_SWITCHED` row with the keys of C3 §5.2.
   * The rows are written WHATEVER the engine's transition says: the worker has switched, and the
   * interval is evidence metadata. A unit that fails is run once more; then the two interval rows
   * are written apart and the failure is said (503). A record is recorded once.
   */
  async function recordSwitch(of: Live, record: AudioSourceIntervalRecord, actor: SwitchActor): Promise<{ readonly fromInputId: string; readonly toMs: number }> {
    const { sessionId } = of;
    const atMediaMs = mediaMsOfSample(record.fromSample, record.sampleRateHz);
    const lines = app.engine.slice('session')?.captureConfig?.mics ?? [];
    const toInputId = lines.find((line) => line.deviceId === record.deviceId)?.inputId ?? record.deviceId;
    const otherInputId = lines.find((line) => line.deviceId !== record.deviceId)?.inputId ?? toInputId;
    // Row 191b: the stored number, not the worker's own (a later worker counts from 1 again); a record is applied once under it.
    const seq = intervalSeqOf(of, record);
    if (of.switchesRecorded.has(seq)) return { fromInputId: otherInputId, toMs: atMediaMs };
    of.switchesRecorded.add(seq);
    const intervalValues = [sessionId, seq, record.deviceId, record.role, atMediaMs, record.capturedAtMs, actor.operatorId, AudioIntervalRowReason.MANUAL] as const;
    let fromInputId = otherInputId;
    const unit = (): Promise<unknown> =>
      app.engine.run('captureSession.switchAudioSource', async (scope) => {
        const switched = await switchCaptureAudioSourceIn(scope, { sessionId, toInputId, atMediaMs });
        // Where the closed interval began is the stored row's (the capture side's media time), not a wall clock.
        const closed = (await scope.unit.query<{ from_media_ms: string | number }>(CLOSE_OPEN_AUDIO_INTERVAL, [sessionId, atMediaMs, record.capturedAtMs])).rows[0];
        const fromMs = closed === undefined ? (switched?.fromMs ?? atMediaMs) : Number(closed.from_media_ms);
        fromInputId = switched?.fromInputId ?? otherInputId;
        await scope.unit.query(INSERT_AUDIO_INTERVAL, [...intervalValues]);
        // `at` of this row is the instant of THIS unit (after the worker's acknowledgement); the wall instant of the boundary is the interval row's `from_at` (see the header).
        await scope.unit.audit.append({
          type: 'AUDIO_SOURCE_SWITCHED',
          message: `Audio source switched to ${toInputId}`,
          actorId: actor.operatorId,
          deviceId: actor.sendingDeviceId,
          sessionId,
          details: { fromInput: fromInputId, toInput: toInputId, fromMs, toMs: switched?.toMs ?? atMediaMs, ...(actor.sendingDeviceId === null ? {} : { sendingDeviceId: actor.sendingDeviceId }) },
        });
        if (switched === null) persist('warn', 'AUDIO_SWITCH_OUTSIDE_RECORDING', 'a realised microphone switch was recorded for a session that is no longer recording: its rows are written, its state is not moved', null, { sessionId, seq, deviceId: record.deviceId, atMediaMs });
      });
    try {
      try {
        await unit();
      } catch (first) {
        persist('warn', 'AUDIO_SWITCH_UNIT_RETRIED', 'the unit of a realised microphone switch failed and is run once more', first, { sessionId, seq, deviceId: record.deviceId });
        await unit();
      }
    } catch (err) {
      // The worker HAS switched. The interval is evidence metadata: it is stored by itself when the unit could not be.
      persist('error', 'AUDIO_SWITCH_NOT_RECORDED', 'a realised microphone switch could not be recorded in its unit; the interval rows are written apart', err, { sessionId, seq, deviceId: record.deviceId, atMediaMs });
      try {
        await app.db.pool.query(CLOSE_OPEN_AUDIO_INTERVAL, [sessionId, atMediaMs, record.capturedAtMs]);
        await app.db.pool.query(INSERT_AUDIO_INTERVAL, [...intervalValues]);
      } catch (again) {
        persist('error', 'AUDIO_INTERVAL_NOT_STORED', 'an audio-source interval could not be stored', again, { sessionId, seq, deviceId: record.deviceId });
      }
      throw refusal(503, ApiErrorCode.NOT_READY, TEXT.SWITCH_NOT_RECORDED, { reason: 'AUDIO_SWITCH_NOT_RECORDED' }, err);
    }
    return { fromInputId, toMs: atMediaMs };
  }

  // ── The unit ─────────────────────────────────────────────────────────────────────────────────

  return {
    real,

    async beforeStart() {
      if (!real) return;
      const left = await ports.leftoverHelpers();
      if (left === null || left.length > 0) {
        persist('warn', 'CAPTURE_HELPERS_LEFT', 'a session start was refused: helper processes of an earlier run are left', null, { count: left === null ? -1 : left.length });
        throw refusal(503, ApiErrorCode.NOT_READY, TEXT.HELPERS_LEFT, { reason: 'CAPTURE_HELPERS_LEFT' });
      }
    },

    recordingStartedIn,

    stopRequestedIn(scope, sessionId) {
      if (!real) return;
      const session = scope.pending().session;
      if (session === null || session.id !== sessionId || session.state !== SessionState.RECORDING || session.captureDurable !== false) return;
      throw refusal(409, ApiErrorCode.INVALID_STATE, TEXT.NOT_DURABLE, { reason: CAPTURE_NOT_DURABLE });
    },

    afterStartCommitted(sessionId) {
      const ready = prepared.get(sessionId);
      prepared.delete(sessionId);
      if (!real || ready === undefined) return;
      try {
        ports.startCommitted(sessionId);
      } catch (err) {
        persist('warn', 'CAPTURE_STT_START_NOT_SAID', 'the transcription unit could not be told that the session started', err, { sessionId });
      }
      inBackground(sessionId, 'begin', () => begin(ready));
    },

    startAbandoned(sessionId) {
      prepared.delete(sessionId);
    },

    afterStopCommitted(sessionId) {
      if (!real) return;
      // R74-08: said outside the chain, so a `begin` that still waits returns and this stop is not held behind it.
      if (live !== null && live.sessionId === sessionId) live.leave();
      inBackground(sessionId, 'stop', async () => {
        const of = live;
        if (of === null || of.sessionId !== sessionId || of.ended) return;
        of.ended = true;
        // HOW the stop ended (fix pass F-M3, review R63-01): a stop that is not clean - a CRASH while the
        // worker closed, a non-zero exit, the kill at the grace, no end of the audio timeline - is an
        // INTERRUPTED recording, never a normal one. A seam that says nothing (an older double) reads as clean.
        let notClean: string | null = null;
        const endsAtStop = cameraEndsNow(of);
        try {
          // The final shape (`CaptureStopOutcome`, ruling D179): `down.detail` is the worker's own account (a CRASH code,
          // STOP_NOT_ACKNOWLEDGED, TIMELINE_END_MISSING); without one, `down.code` names it (STOP_TIMEOUT: killed at the grace).
          // A double of the seam that resolves nothing reads as clean.
          const outcome: CaptureStopOutcome | undefined = await of.supervisor.stop(sessionId, CaptureStopReason.STOPPED);
          if (outcome !== undefined && !outcome.clean) notClean = outcome.down?.detail ?? outcome.down?.code ?? STOP_NOT_CLEAN;
          // C3: a camera given up while the session went on - for a CLEAN stop too - is in the facts before the hand-off.
          await noteCameraEnds(of, outcome?.cameraEnds ?? endsAtStop);
        } catch (err) {
          await noteCameraEnds(of, endsAtStop);
          persist('error', 'CAPTURE_WORKER_NOT_STOPPED', 'the capture worker of a stopped session could not be stopped', err, { sessionId });
        }
        await of.recorder?.idle();
        await sayCheckpoints(of);
        await closeLastInterval(of);
        await of.factsWritten;
        const behind = of.recorder?.status().behind ?? [];
        // The worker has exited: the tap is whole. The transcript is run to its end for the seal.
        endTranscriber(of, true);
        await release(of);
        if (notClean === null) {
          tell({ type: 'STOPPED', sessionId, files: Object.freeze([...of.files]), fragmentRowsBehind: behind, firstVideo: Object.freeze([...of.firstVideo.values()]), ...cameraEndsOf(of) });
          return;
        }
        // The operator is told in words that are no clean stop (decision D179 (b)): the capture-wide fault, with the
        // reason of this unit. One fault of the capture at a time: when the capture side raised it already, this writes nothing.
        persist('warn', 'CAPTURE_STOP_NOT_CLEAN', 'the capture worker did not stop cleanly: the recording is handed over as interrupted', null, { sessionId, cause: notClean });
        try {
          await app.engine.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: null, reason: STOP_NOT_CLEAN } as Parameters<typeof app.engine.raiseCaptureWarning>[0]);
        } catch (err) {
          persist('error', 'CAPTURE_STOP_FAULT_NOT_RAISED', 'the alert of a stop that was not clean could not be raised', err, { sessionId });
        }
        tell({ type: 'INTERRUPTED', sessionId, cause: notClean, files: Object.freeze([...of.files]), firstVideo: Object.freeze([...of.firstVideo.values()]), ...cameraEndsOf(of) });
      });
    },

    switchAudioSource: (principal, sessionId, inputId) => (real ? switchReal(principal, sessionId, inputId) : switchSimulated(principal, sessionId, inputId)),

    on(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async idle() {
      // A step may queue another one while it runs: wait until the chain stops growing.
      for (let seen: Promise<void> | null = null; seen !== background || writes.size > 0; ) {
        seen = background;
        await seen;
        await Promise.all(writes);
        await live?.recorder?.idle();
      }
    },

    async shutdown() {
      const of = live;
      if (of !== null && !of.ended) {
        of.ended = true;
        // The worker FIRST: a source closed under a recording worker is a lost camera for it.
        try {
          await of.supervisor.stop(of.sessionId, CaptureStopReason.SHUTDOWN);
        } catch (err) {
          // The capture unit's own shutdown stopped it already (the entry point calls it first): nothing is left to stop.
          if (!(err instanceof CaptureSupervisorError)) persist('error', 'CAPTURE_WORKER_NOT_STOPPED', 'the capture worker could not be stopped at the shutdown of the Core', err, { sessionId: of.sessionId });
        }
        // Aborts the session's signal - what reaches a source that is still being opened - and closes every handle.
        await release(of);
        persist('warn', 'CAPTURE_SESSION_SHUT_DOWN', 'the Core shut down while a session was being captured: the worker was stopped and its sources closed; the next boot resumes the session', null, { sessionId: of.sessionId, durable: of.durableSaid });
      }
      try {
        await this.idle();
      } catch (err) {
        persist('error', 'CAPTURE_SESSION_STEP_FAILED', 'the background work of the capture session did not end at the shutdown', err, { sessionId: of?.sessionId ?? null });
      }
    },

    liveSessionId: () => live?.sessionId ?? null,

    replace(next) {
      if (live !== null) throw new Error('the ports of the capture session are replaced only while no capture runs');
      Object.assign(ports, next);
    },
  };
}
