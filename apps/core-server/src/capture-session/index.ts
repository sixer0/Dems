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
 *            the session's new active / standby pair, the closed and the opened
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
import { mkdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { AudioSourceIntervalReason, CaptureRecordKind, CaptureStopReason, CaptureSyncLevel, CaptureWarningReason, CaptureWarningState, type AudioSourceIntervalRecord, type CapturePlan, type FirstVideoSampleRecord } from '@dems/capture-protocol';
import { ApiErrorCode, CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES, type AudioSourceStateBody } from '@dems/shared/api';
import { SessionState } from '@dems/shared/domain';
import { CaptureAdvisoryReason, CaptureNoticeReason, type ActiveSession, type CaptureAdvisoryNotice, type CaptureVolumeSyncNotice } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import { CapturePhase, CaptureSupervisorError, type CaptureCameraEnd, type CaptureEventOf, type CaptureStopOutcome, type CaptureSupervisor } from '../capture';
import { CaptureAdapterError, CaptureOperation, type AudioStreamHandle, type CaptureDeviceRegistry, type SourceHandle } from '../capture/adapters';
import { assertSessionSourcesOfOperation, buildSessionCaptureSources, captureFenceControl, captureOperationOf, type CaptureSourceSlot, type SessionCaptureSource } from '../capture/fence';
import { captureCheckpointDoorsOf, captureDoorsOf, markCaptureConnectingIn, switchCaptureAudioSourceIn, type EngineUnit, type HostedActionArguments } from '../engine';
import { CapturePlanError, assertRecordableSelector, buildCapturePlan, type CapturePlanSelector, type RecordableSelector } from '../modules/capture-config';
import { createFragmentRecorder, createRecordingFragmentStore, type FragmentRecorder, type VideoTrackId } from '../modules/recording-fragments';
import type { Principal } from '../plugins/authenticate';
import { ApiFailure } from '../plugins/error-envelope';
import { transcriptionControl } from '../transcription';
import { describeError } from '../plugins/logger';
import { SESSION_CAPTURE_FACTS_VERSION, sessionCaptureFactsPath, writeSessionCaptureFacts, type SessionCaptureFacts } from './facts';
import { AudioIntervalRowReason, CLOSE_OPEN_AUDIO_INTERVAL, INSERT_AUDIO_INTERVAL, INSERT_SESSION_CAPTURE_SOURCES, READ_SESSION_CAPTURE_SOURCES } from './statements';

export { SESSION_CAPTURE_FACTS_FOLDER, SESSION_CAPTURE_FACTS_VERSION, parseSessionCaptureFacts, readSessionCaptureFacts, readSessionVideoSampleEntry, removeSessionCaptureFacts, sessionCaptureFactsPath, withCameraEnded, type SessionCameraEnd, type SessionCameraFacts, type SessionCaptureFacts } from './facts';
export { AudioIntervalRowReason, CLOSE_OPEN_AUDIO_INTERVAL, INSERT_AUDIO_INTERVAL, INSERT_SESSION_CAPTURE_SOURCES, READ_SESSION_CAPTURE_SOURCES } from './statements';

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

/** The loopback port of each track's ingest: inside the protocol's media range, one per camera. */
export const CAPTURE_INGEST_PORT: Readonly<Record<VideoTrackId, number>> = Object.freeze({ 'VIDEO-01': 8554, 'VIDEO-02': 8556 });

/** The folder of a session below the media root, and its camera files (evidence spec §A: `SESSION-<id>/VIDEO-0n.mp4`). */
export const sessionMediaFolder = (sessionId: string): string => `SESSION-${sessionId}`;
export const cameraFileName = (trackId: VideoTrackId): string => `${trackId}.mp4`;

/** File (media) time in ms of a sample counted from T0 (protocol 4, `AUDIO_SOURCE_INTERVAL`; dbc-3 §B.5 erratum PE-128-44). */
export function mediaMsOfSample(sample: number, sampleRateHz: number): number {
  return Math.floor(((sample + CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES) * 1000) / sampleRateHz);
}

const SOURCE = 'captureSession';
const SESSION_ID = /^SES-[0-9]{8}-[0-9]{4}$/;
const TRACKS: readonly VideoTrackId[] = ['VIDEO-01', 'VIDEO-02'];

const TEXT = Object.freeze({
  NOT_RECORDABLE: 'This capture configuration cannot be recorded: an assigned source cannot be opened in the running capture operation.',
  HELPERS_LEFT: 'Capture sources of an earlier run are still running. Try again when they have ended.',
  SNAPSHOT_NOT_STORED: 'The session could not be started: its transcription settings could not be recorded. Try again.',
  NOT_RECORDING: 'The session is not recording.',
  NOT_DURABLE: 'Nothing is recorded yet: the cameras are still connecting. The session ends by itself when no camera connects.',
  NOT_OPEN: 'This session is not the open session.',
  NO_SUCH_INPUT: 'The requested microphone is not one of the two inputs of this session.',
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

/** The session payload hears the checkpoint figures at most this often (one engine unit per window, never one per fragment). */
export const CHECKPOINT_FACTS_INTERVAL_MS = 5_000;

/** Who a switch is recorded for: the operator, and the paired device the command came from (E-30 / SEC35-17). */
interface SwitchActor {
  readonly operatorId: string | null;
  readonly sendingDeviceId: string | null;
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
    for (const off of of.offs.splice(0)) off();
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
    await markCaptureConnectingIn(scope, sessionId);
    const first = sources[0];
    if (first === undefined) throw notRecordable(undefined, null, 'SELECTOR_SHAPE');
    // MR-S1: four rows, one statement, in the transaction that persists RECORDING.
    await scope.unit.query(INSERT_SESSION_CAPTURE_SOURCES, [sessionId, first.recordedAt, ...sources.flatMap((row) => [row.slot, row.deviceId, row.adapterKind])]);
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

  async function writeInterval(of: Live, record: AudioSourceIntervalRecord): Promise<void> {
    try {
      await app.db.pool.query(INSERT_AUDIO_INTERVAL, [of.sessionId, record.index, record.deviceId, record.role, mediaMsOfSample(record.fromSample, record.sampleRateHz), record.capturedAtMs, null, AudioIntervalRowReason.START]);
    } catch (err) {
      persist('error', 'AUDIO_INTERVAL_NOT_STORED', 'an audio-source interval could not be stored', err, { sessionId: of.sessionId, seq: record.index, deviceId: record.deviceId });
    }
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
      track(writeInterval(of, record));
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
    for (const handle of current.handles) {
      const launch = (handle as { start?: (signal?: AbortSignal) => Promise<void> }).start;
      if (typeof launch !== 'function' || current.ended || current.leaving) continue;
      const role = ready.selector.mics.find((mic) => mic.deviceId === handle.deviceId)?.role ?? null;
      // D80(6) / ML-7: the standby alone missing warns; a primary that does not start is an error. Neither is replaced.
      const failed = (err: unknown, cause: string): void =>
        persist(role === 'PRIMARY' ? 'error' : 'warn', 'CAPTURE_MIC_NOT_STARTED', 'a microphone of the session could not be started', err, { sessionId: current.sessionId, deviceId: handle.deviceId, role, cause });
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
          if (outcome === 'BOUND') failed(null, 'MIC_START_BOUND');
          else if (outcome !== 'STARTED') failed(outcome.err, 'MIC_START_FAILED');
        }),
      );
    }
    return Promise.all(starts).then(() => undefined);
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

      // The microphones first: the plan names where each one's samples come from.
      const mics: Record<string, AudioStreamHandle['input']> = {};
      for (const mic of ready.selector.mics) {
        try {
          const handle = await registry.resolve('MIC', mic.deviceId).open(mic.deviceId, { sessionId, signal: current.abort.signal });
          current.handles.push(handle);
          // The unit was shut down while this source was being opened: `release` has run and will not see the handle.
          if (current.abort.signal.aborted) await release(current);
          mics[mic.deviceId] = handle.input;
        } catch (err) {
          // The standby may be missing (D80(6)); without the PRIMARY the plan builder refuses below.
          persist(mic.role === 'PRIMARY' ? 'error' : 'warn', 'CAPTURE_MIC_NOT_OPENED', 'a microphone of the session could not be opened', err, { sessionId, deviceId: mic.deviceId, role: mic.role });
        }
      }
      const cameras: Partial<Record<VideoTrackId, { ingestUrl: string; outputPath: string }>> = {};
      for (const camera of ready.selector.cameras) {
        const trackId = TRACKS.find((track) => track === camera.trackId);
        if (trackId === undefined) continue;
        const outputPath = `${folder}/${cameraFileName(trackId)}`;
        cameras[trackId] = { ingestUrl: `rtsp://127.0.0.1:${CAPTURE_INGEST_PORT[trackId]}/${sessionId}/${trackId.toLowerCase()}`, outputPath };
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
          onClocks(current, event);
        }),
      );
      current.offs.push(
        supervisor.on('warning', (event) => {
          // Review R74-03: a camera of the plan that did not connect is said to the listeners (the notices unit words the degraded start).
          if (event.sessionId !== sessionId || event.source !== 'worker' || event.reason !== CaptureWarningReason.CAMERA_NOT_CONNECTED || event.state !== CaptureWarningState.ACTIVE || event.subject === null) return;
          tell({ type: 'CAMERA_NOT_CONNECTED', sessionId, deviceId: event.subject });
        }),
      );
      current.offs.push(
        supervisor.on('phase', (event) => {
          if (event.sessionId !== sessionId || event.phase !== CapturePhase.FAULTED) return;
          const status = supervisor.status();
          current.leave();
          inBackground(sessionId, 'captureEnded', () => captureEnded(current, status.lastCrash?.detail ?? status.lastCrash?.code ?? null, status.sessionId === sessionId && status.durable));
        }),
      );

      // ONCE (D72(l)): the supervisor restarts a worker by itself while nothing is durable.
      await supervisor.start(sessionId, plan);

      // ML-5: `open` only PREPARED the pipe of a microphone; its helper is launched when the worker has
      // accepted the plan. BOTH ARE LAUNCHED NOW, TOGETHER, and nothing below waits for either
      // (integration pass D9, item 4; row 140's finding F-6): started one after the other, the second
      // helper was launched a settle time late and lost the head of its track (96,000 samples measured),
      // and the cameras were opened after both. Each start is held to the no-delivery bound; a
      // microphone that cannot start is reported with its role, never replaced (OD-11, cap §E.1: the
      // worker's `MIC_DISCONNECTED` then names it), and it delays neither the other nor a camera.
      const micStarts = startMicrophones(current, ready);

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

      // The worker listens now: the cameras are opened toward its listeners.
      const opened: string[] = [];
      const notOpened: string[] = [];
      for (const camera of plan.cameras) {
        if (current.ended || current.leaving) break;
        try {
          current.handles.push(await registry.resolve('CAMERA', camera.deviceId).openSource(camera.deviceId, { ingestUrl: camera.ingestUrl }, current.abort.signal));
          // A source that came up although the session's signal was aborted meanwhile (a shutdown) is closed at once.
          if (current.abort.signal.aborted) await release(current);
          opened.push(camera.deviceId);
        } catch (err) {
          // One camera of two is a degraded session (D72(k)); with none the worker ends the session itself (`NO_CAMERA_CONNECTED`).
          notOpened.push(camera.deviceId);
          persist('warn', 'CAPTURE_CAMERA_NOT_OPENED', 'a camera of the session could not be opened', err, { sessionId, deviceId: camera.deviceId });
        }
      }
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
      await Promise.race([micStarts, current.left]);
      await writeFacts(current);
      if (!current.ended) tell({ type: 'STARTED', sessionId, cameras: opened, camerasNotOpened: notOpened });
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
    let record: AudioSourceIntervalRecord | null;
    of.switchesWaiting += 1;
    try {
      record = await of.supervisor.switchAudioSource(sessionId, mic.role);
    } catch (cause) {
      if (!(cause instanceof CaptureSupervisorError)) throw cause;
      // The command was not acknowledged in time or was refused. A record of THAT microphone that
      // arrived while this call waited says the worker did switch: it is recorded, never dropped (R74-06 (b)).
      const seen = [...of.switchRecordsSeen.values()].find((entry) => entry.deviceId === mic.deviceId && !of.switchesRecorded.has(entry.index));
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
    if (of.switchesRecorded.has(record.index)) return { fromInputId: otherInputId, toMs: atMediaMs };
    of.switchesRecorded.add(record.index);
    const intervalValues = [sessionId, record.index, record.deviceId, record.role, atMediaMs, record.capturedAtMs, actor.operatorId, AudioIntervalRowReason.MANUAL] as const;
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
        if (switched === null) persist('warn', 'AUDIO_SWITCH_OUTSIDE_RECORDING', 'a realised microphone switch was recorded for a session that is no longer recording: its rows are written, its state is not moved', null, { sessionId, seq: record.index, deviceId: record.deviceId, atMediaMs });
      });
    try {
      try {
        await unit();
      } catch (first) {
        persist('warn', 'AUDIO_SWITCH_UNIT_RETRIED', 'the unit of a realised microphone switch failed and is run once more', first, { sessionId, seq: record.index, deviceId: record.deviceId });
        await unit();
      }
    } catch (err) {
      // The worker HAS switched. The interval is evidence metadata: it is stored by itself when the unit could not be.
      persist('error', 'AUDIO_SWITCH_NOT_RECORDED', 'a realised microphone switch could not be recorded in its unit; the interval rows are written apart', err, { sessionId, seq: record.index, deviceId: record.deviceId, atMediaMs });
      try {
        await app.db.pool.query(CLOSE_OPEN_AUDIO_INTERVAL, [sessionId, atMediaMs, record.capturedAtMs]);
        await app.db.pool.query(INSERT_AUDIO_INTERVAL, [...intervalValues]);
      } catch (again) {
        persist('error', 'AUDIO_INTERVAL_NOT_STORED', 'an audio-source interval could not be stored', again, { sessionId, seq: record.index, deviceId: record.deviceId });
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
