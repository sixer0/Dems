/**
 * THE SESSION AS THE SEAL READS IT (blueprint row 82b; evidence package spec §B.1-§B.5, §B.12,
 * §E.6; database contract dbc-3 §B.5, dbc-4 §N.3): the production `SealSessionReader`.
 *
 * WHERE EVERY MEMBER COMES FROM.
 *
 *   the engine's COMMITTED state   the session (case, subject, instants), the ID and the name of
 *                                  the Core's stored device record, the operator, the camera
 *                                  lines of the capture snapshot the session took at its start,
 *                                  and the registry row of a camera (what its adapter reported);
 *   the Core itself                its own build (`CORE_SERVER_VERSION`) and the clock it reads
 *                                  (`CORE_TIME_SOURCE`) - see "ONLY FACTS THE CORE HAS" below;
 *   `session_capture_sources`      the four rows of the session START (T-41): the device and the
 *                                  adapter kind of every slot. The source classes of the manifest
 *                                  are computed from these rows by row 83's builder, never from
 *                                  the device registry or a flag at sealing time (ev §E.6);
 *   `session_audio_intervals`      the audio-source intervals in FILE time;
 *   `audit_log`                    the rows of the session, as `audit-session-extract.jsonl`; and,
 *                                  out of the same rows, the worker restarts that cost audio
 *                                  (`audioRestartGapsOf`, task 4 row 191c: manifest fields 129-132)
 *                                  and the absences of a camera inside the session
 *                                  (`videoAbsencesOf`, task 4 row R1b: manifest fields 134-138);
 *   the session's STT snapshot     the five members of manifest field 123 (R-8): the row of
 *                                  `session_stt_config` the session start wrote in its own unit
 *                                  (row 71c; dbc-6 MR-T1);
 *   the capture facts of the       what the capture side reported while it recorded (row 71c,
 *   session                        `capture-session/facts.ts`): the clock offset of each camera
 *                                  (field 40) and the worker's first video sample (fields 127, 128).
 *
 * THE EVIDENCE ID IS THE ENGINE'S. A session gets its evidence ID when it enters FINALIZING. A
 * session that has none yet is moved there first, with every step PENDING (`begin`): the ID in the
 * manifest is then the ID the engine commits the item under, by construction.
 *
 * WHAT HAS NO SOURCE IN THE CORE TODAY is said in `STAND_INS` below, value by value, and in the
 * row's note: nothing of it is taken from a client or made up per session.
 *
 * ONLY FACTS THE CORE HAS (fix wave H driver A; gate 89 finding G89-01, ruling D199). The engine's
 * state is the hosted SIMULATOR's: its `time` slice (GNSS, locked), its `device.softwareVersion`
 * (2.4.1), `device.identity` (a serial number and a hardware UUID of the dataset) and the model and
 * firmware of its `cameras` are values of a demonstration. Under the signature of a real package
 * each was a false statement. This reader takes NONE of them:
 *
 *   field 17-19  the time source      `CORE_TIME_SOURCE`: the host's system clock. Never the
 *                                     `time` slice, never the session's `startTimeSource`;
 *   field 22-23  serial, hardware UUID `NOT_CONFIGURED`: no installation step and no setting gives
 *                                     a Core an identity of its own (spec defect, note 120);
 *   field 24     software version     the Core's build, `src/version.ts`;
 *   field 38-39  camera model,        by the adapter kind of the session-START row of that slot:
 *                firmware             a generated source says so and has no firmware; any other
 *                                     camera states its registry row (`capture_devices`), and
 *                                     `NOT_REPORTED` where the row holds nothing. Never the
 *                                     simulator's camera.
 *
 * Fields 20, 21 (`deviceId`, `name`) WERE the Core's stored device record, whose values are the
 * seed's. Since closing pass Z1 (decision D207) they are the CONFIGURED installation identity
 * (`installation-identity.ts`: `DEMS_INSTALLATION_DEVICE_ID`, `DEMS_INSTALLATION_NAME`), or
 * `NOT_CONFIGURED` - the stored record stays the id the audit rows and the clients use, and is not
 * read here.
 *
 * This file opens no file and no key (the camera file's sample entry comes through a port). A read that cannot be completed throws: the seal does not
 * start on half a session record.
 */
import {
  MANIFEST_AUDIO_ABSENT_MAX_MS,
  MANIFEST_HOST_PROFILE_NOT_ASKED_PLATFORMS,
  MANIFEST_VIDEO_ABSENCE_ENDS,
  MANIFEST_VIDEO_ABSENT_MAX_MS,
  VIDEO_TRACK_IDS, // D60 (2026-11-04)
  type ManifestAudioIntervalInput,
  type ManifestAudioRestartGap,
  type ManifestHostProfileNotAsked,
  type ManifestVideoAbsence,
  type SessionCaptureSourceRow,
} from '@dems/shared/evidence-package';
import type { QueryResultRow } from 'pg';
import { SealingError, SealingFailure, type SealSessionFacts, type SealSessionReader, type SealTrackFacts, type SttConfigSnapshot } from '../sealing';
import { CORE_SERVER_VERSION } from '../version';

/** A connection that runs one parameterised statement (the runtime pool). */
export interface Queryable {
  query<Row extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<{ readonly rows: Row[] }>;
}

export const READ_SEAL_SOURCE_ROWS = 'SELECT slot, device_id, adapter_kind, recorded_at FROM public.session_capture_sources WHERE session_id = $1 ORDER BY slot';
export const READ_SEAL_AUDIO_INTERVALS = 'SELECT seq, mic_device_id, role, from_media_ms, to_media_ms, reason, switched_by FROM public.session_audio_intervals WHERE session_id = $1 ORDER BY seq';
export const READ_SEAL_AUDIT_ROWS =
  'SELECT seq, id, at, type, category, severity, actor_id, message, session_id, evidence_id, device_id, details, prev_hash, hash FROM public.audit_log WHERE session_id = $1 ORDER BY seq';

/**
 * VALUES THE CORE HAS NO SOURCE FOR (each is a line of the row's note, "stand-in values"):
 *
 *   subject.authorization   field 33 "session input": the session input (operation 24) has four
 *                           members - case number, subject name, subject type, investigator - and
 *                           none is an authorization. The fixed text below stands in until the
 *                           contract gives the session input that member;
 *   tracks[].clockOffsetMs  field 40: the offset the capture WORKER measured at anchoring, from the
 *                           capture facts (tidy pass F-Y); the camera adapter's report where the
 *                           worker reported none. The
 *                           stand-in 0 is written ONLY for a camera whose adapter reported none
 *                           (the field is "not null") and for a session that has no capture facts;
 *   tracks[].codec          field 43: NO LONGER A STAND-IN (integration pass D9). Protocol 4 names no
 *                           codec and the worker copies the stream, so the value is read from the
 *                           camera file's own init segment (the video sample entry) through the
 *                           port `videoSampleEntry`: `H264` | `HEVC` (ev §B.4, erratum PE-D9-03).
 *                           Null only where no camera file / no init segment is there (CLOSE_TRACKS
 *                           then names the file) or the reader was given no port;
 *   tracks[].avOffsetMs     field 51: a measured flash-to-beep offset of a test fixture. Nothing
 *                           on the capture side measures it for a session -> null;
 *   fields 127 / 128        the worker's `FIRST_VIDEO_SAMPLE` of the camera file, from the capture
 *                           facts; null when no such record exists for the file (the spec's rule).
 */
/**
 * FIELDS 17-19 OF A PACKAGE THIS CORE SEALS (G89-01). What the Core has is the clock of the
 * computer it runs on, read through the operating system: it has no GNSS receiver, runs no
 * network-time client of its own and measures no lock. The spec's enumeration of field 17 is
 * `GNSS | NTP | RTC` (ev §B.2) and holds no value for "the host's system clock" (spec defect, note
 * 120): `RTC` is the one that claims no external reference, so it is the honest one of the three.
 * `state` says in words which clock it is; there is no fallback chain, so the order is empty.
 */
export const CORE_TIME_SOURCE = Object.freeze({ source: 'RTC' as const, state: 'HOST_SYSTEM_CLOCK', fallbackOrder: Object.freeze([]) as readonly string[] });
/** Fields 22, 23: the Core was given no serial number and no hardware UUID. The schema's fields are "not null" text (spec defect, note 120). */
export const NOT_CONFIGURED = 'NOT_CONFIGURED';
/** Fields 38, 39 of a camera whose registry row holds no value for the member. */
export const NOT_REPORTED = 'NOT_REPORTED';
/** Fields 38, 39 of a DEVELOPMENT source, by adapter kind: what the Core knows of it. */
export const SOURCE_WORDS = Object.freeze({
  FAKE: Object.freeze({ model: 'Generated test source (no camera)', firmware: 'None (generated test source)' }),
  LOCAL_DEVICE: Object.freeze({ model: 'Local development device of the Core computer', firmware: 'Not reported (local development device)' }),
});

export const STAND_INS = Object.freeze({
  subjectAuthorization: 'Name and subject type only, as entered at session creation',
  clockOffsetMs: 0,
  audioCodec: 'AAC-LC mono 48 kHz',
  unknownText: 'UNKNOWN',
});

/** Field 8 `notice`, by the capture operation the Core runs in. */
export const SEAL_NOTICE = Object.freeze({
  REAL_DEVELOPMENT: 'DEVELOPMENT - sealed by a Core in development capture mode; see the source classes of this manifest.',
  REAL_PRODUCTION: 'Sealed by the DEMS Core.',
});

// D60 (2026-11-04): the value set of camera tracks, widened from two to four. What ONE session seals is its
// OWN start record (`sealedTracks` below): a session that started under the two-track shape still seals exactly
// its two files - the manifest names its own list and the verifier reads it as a prefix of this order.
const TRACKS = VIDEO_TRACK_IDS;
const OPERATOR_ROLES = ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const;
const SUBJECT_TYPES = ['TERSANGKA', 'SAKSI', 'LAINNYA'] as const;
const INTERVAL_REASONS = ['START', 'MANUAL', 'STOP'] as const;

/** The members of the committed state the reader uses (the engine's `state()` satisfies it). */
export interface SealStateView {
  readonly session: {
    readonly id: string;
    readonly state: string;
    readonly evidenceId: string | null;
    readonly createdAt: number;
    readonly startedAt: number | null;
    readonly stoppedAt: number | null;
    readonly input: { readonly caseNumber: string; readonly subjectName: string; readonly subjectType: string; readonly investigatorId: string };
    readonly startTimeSource?: string | null;
    readonly captureConfig?: { readonly cameras: readonly { readonly trackId: string; readonly deviceId: string; readonly profile: string }[] } | null;
  } | null;
  /**
   * NOTHING OF IT IS READ since closing pass Z1 (D207: fields 20, 21 are the configured installation identity).
   * `softwareVersion` and `identity` are the hosted simulator's dataset (G89-01): a view may carry
   * them (the engine's state does), this reader never takes them.
   */
  readonly device: { readonly id: string; readonly name: string; readonly softwareVersion?: string; readonly identity?: { readonly serialNumber: string; readonly hardwareUuid: string } };
  readonly operators: readonly { readonly id: string; readonly displayName: string; readonly role: string }[];
  /** G89-01: the label of the track slot ONLY IS READ. `model` and `firmware` of a simulator camera are never taken. */
  readonly cameras: readonly { readonly id: string; readonly name: string; readonly deviceId?: string; readonly model?: string; readonly firmware?: string }[];
  /** G89-01: NEVER READ (the simulator's time source); a view may carry it. */
  readonly time?: { readonly source: string; readonly locked: boolean };
  readonly captureDevices: { readonly devices: readonly { readonly id: string; readonly model: string | null; readonly firmware: string | null }[] };
}

export interface SealSessionReaderOptions {
  readonly state: () => SealStateView;
  readonly db: () => Queryable;
  /** Moves a session that has no evidence ID yet to FINALIZING with every step PENDING (the engine assigns the ID). */
  readonly begin: (sessionId: string) => Promise<void>;
  /** The session's own STT snapshot, or null when the session took none. */
  readonly sttSnapshot: (sessionId: string) => Promise<SttConfigSnapshot | null>;
  /**
   * What the capture side reported of the session (`readSessionCaptureFacts`), or null when it
   * kept nothing. Absent: the reader asks nothing and writes the stand-ins.
   */
  readonly captureFacts?: (sessionId: string) => Promise<SealCaptureFacts | null>;
  /**
   * Manifest field 43 (integration pass D9): the video sample entry of a camera file's own init
   * segment (`readSessionVideoSampleEntry`), or null when the file is not there. Absent: the reader
   * asks nothing and the codec is null. A file that is there and names NO codec this Core knows
   * stops the seal with `CAMERA_FILE_UNUSABLE`: the field is never a guess.
   */
  readonly videoSampleEntry?: (sessionId: string, trackId: (typeof TRACKS)[number]) => Promise<SealVideoSampleEntry | null>;
  /**
   * Manifest field 36 (fix wave K, driver S1; G89b-01, ruling D222 (2); fix 151): what the video stream
   * of a camera file DECLARES - picture size and nominal frame rate, read from its init segment
   * (`readSessionVideoFormat`). With it field 36 states the STREAM (`streamProfileOf`), never the
   * selector's configured profile and never a measured rate.
   * Null (the file is not there, or its init segment names no picture size) and the option being
   * absent: field 36 is the configured profile, as before this wave.
   */
  readonly videoFormat?: (sessionId: string, trackId: (typeof TRACKS)[number]) => Promise<SealVideoFormat | null>;
  /** Told once per read and camera file whose DECLARED stream format is NOT what the selector configured (`streamProfileDiffers`): the manifest states the stream. */
  readonly onProfileDiffers?: (sessionId: string, differences: readonly SealProfileDifference[]) => void;
  readonly notice: string;
  readonly timezone: string;
  /**
   * Closing pass Z1 (decision D207): the installation identity of this Core - manifest fields 20, 21
   * (`installation-identity.ts`). A member that is null, or the option being absent, is stated as
   * `NOT_CONFIGURED`. The stored device record of the state is NOT read for them.
   */
  readonly identity?: { readonly deviceId: string | null; readonly name: string | null };
  /**
   * Task 4 row P1 (decision U21 (2)): manifest field 133. The platform of this Core when it is a PRODUCTION Core
   * whose boot checks did NOT ask its host profile (macOS), read at every seal; null when the profile was asked
   * (Linux) or none is asked by design (development). Null, and the option being absent: the facts carry no such
   * member and the manifest is the one of before.
   */
  readonly hostProfileNotAsked?: () => ManifestHostProfileNotAsked | null;
  /** Told once per read of a session that has NO STT snapshot. */
  readonly onNoSttSnapshot?: (sessionId: string) => void;
  /** Told once per read whose capture facts are of ANOTHER session of that ID (they are not used). */
  readonly onForeignCaptureFacts?: (sessionId: string) => void;
}

/** One camera file whose stream is not what the selector configured (field 36 states `stream`). */
export interface SealProfileDifference {
  readonly trackId: string;
  readonly configured: string;
  readonly stream: string;
}

/** What the reader uses of a camera file's video stream (`VideoStreamFormat` of the capture unit satisfies it). */
export interface SealVideoFormat {
  readonly width: number;
  readonly height: number;
  /** Frames per second as the stream's own parameter set DECLARES them; null when it declares none. Never a measured rate. */
  readonly frameRate: number | null;
}

/**
 * The whole-number NOMINAL rate of a declared frame rate, or null when there is none: the rate
 * itself when it is a whole number, and N for the N * 1000 / 1001 family (29.97 is the nominal 30,
 * 23.976 the nominal 24). Any other declared rate has no whole-number name.
 */
function nominalRateOf(declared: number | null): number | null {
  if (declared === null || !Number.isFinite(declared) || declared <= 0) return null;
  const nominal = Math.round(declared);
  if (nominal < 1) return null;
  const exact = Math.abs(declared - nominal) <= 1e-6;
  const drop = Math.abs(declared - (nominal * 1000) / 1001) <= 1e-3;
  return exact || drop ? nominal : null;
}

/**
 * FIELD 36 AS THE STREAM DECLARES IT (fix wave K, G89b-01; fix 151, controller ruling of
 * 2026-10-11): a FORMAT statement in the profile vocabulary of the capture units (`H264_1080P25`,
 * `H264_720P30`; a CODE, `^[A-Z][A-Z0-9_]{0,63}$`), built from what the stream says about itself -
 * the picture size of the init segment's sample entry and the nominal frame rate of its parameter
 * set. NEVER a measured average and never a fraction: how many frames were delivered is another fact.
 *   `<codec>_<height>P<rate>`            a 16:9 picture (1920x1080, 1280x720, ...);
 *   `<codec>_<width>X<height>P<rate>`    any other picture: the width is stated, never implied;
 *   the rate is the whole-number nominal rate the stream declares (`nominalRateOf`);
 *   NO rate (`H264_720P`) when the stream declares none, or one that has no whole-number name: a
 *   fact the Core does not have is absent (evidence package spec §B.4, erratum PE-WK-16).
 */
export function streamProfileOf(codec: string, format: SealVideoFormat): string {
  const picture = format.width * 9 === format.height * 16 ? `${String(format.height)}P` : `${String(format.width)}X${String(format.height)}P`;
  const nominal = nominalRateOf(format.frameRate);
  return `${codec}_${picture}${nominal === null ? '' : String(nominal)}`;
}

/**
 * WHEN THE NOTICE `STREAM_PROFILE_DIFFERS` IS DUE (fix 151): only when what the stream DECLARES is
 * not the configured profile.
 *   - the stream declares a whole-number rate: its text is not the configured one;
 *   - the stream declares NO rate: codec and picture differ. A configured `H264_720P30` over a
 *     stream that says `H264_720P` is not contradicted by anything the stream declares;
 *   - the stream declares a rate that has no whole-number name: it differs from every profile code.
 * A delivered frame rate below the nominal one is never a difference of the format.
 */
export function streamProfileDiffers(configured: string, codec: string, format: SealVideoFormat): boolean {
  const stream = streamProfileOf(codec, format);
  if (nominalRateOf(format.frameRate) !== null) return stream !== configured;
  if (format.frameRate !== null) return true;
  return !(configured.startsWith(stream) && /^[0-9]*$/.test(configured.slice(stream.length)));
}

/** What the reader uses of a camera file's video sample entry (`VideoSampleEntryRead` of the capture unit satisfies it). */
export interface SealVideoSampleEntry {
  readonly state: 'KNOWN' | 'UNKNOWN_SAMPLE_ENTRY' | 'NO_VIDEO_SAMPLE_ENTRY' | 'NO_INIT_SEGMENT';
  /** The stored form of field 43: `H264` | `HEVC` (ev §B.4, erratum PE-D9-03); null unless KNOWN. */
  readonly codec: string | null;
  readonly sampleEntry: string | null;
}

/** The members of the capture facts the reader uses (`SessionCaptureFacts` of the capture session satisfies it). */
export interface SealCaptureFacts {
  readonly sessionId: string;
  readonly startRecordedAt: number;
  readonly cameras: readonly {
    readonly trackId: string;
    readonly deviceId: string;
    readonly clockOffsetMs: number | null;
    /**
     * Tidy pass F-Y (fix F-M3 decision 3): the offset the WORKER measured when it anchored the camera
     * (camera clock minus Core clock, whole ms). Manifest field 40 is THIS value when it is there;
     * the adapter's report above is the fallback. Absent / null: the worker reported none.
     */
    readonly measuredClockOffsetMs?: number | null;
    /** C3: the camera was given up while the session went on (`capture-session/facts.ts`); absent / null: it was not. */
    readonly ended?: { readonly reason: string } | null;
    readonly firstVideo: { readonly pts: number; readonly timescale: number } | null;
  }[];
}

/**
 * A SESSION WITHOUT AN STT SNAPSHOT (row 71c). Since row 71c every session start in a real
 * capture mode writes its snapshot in its own unit, so this is a session recorded before that row,
 * or one whose stored configuration could not be read at its start. No transcriber ran for it and
 * no transcript exists.
 *
 * THE SPEC DEFINES NO STATE FOR IT. Manifest field 123 is "not null", and the transcript block is
 * one of four shapes (ev §B.7a, D110): none says "no configuration was recorded". This Core does
 * not invent a fifth. Of the two shapes without a document:
 *
 *   DISABLED / `DISABLED_BY_CONFIGURATION`          says the configuration switched STT off. Not
 *                                                   known, and not what happened;
 *   PARTIAL / `TRANSCRIPT_UNAVAILABLE_AT_SEAL`      says no transcript could be handed over at the
 *                                                   seal. That IS what happened.
 *
 * The second is sealed. Its field 123 must hold five members: they are the fixed values below,
 * whose `model` says in the manifest itself that NOTHING WAS RECORDED. `enabled` is `true` because
 * the shape requires it; `backend`, `diarization` and `revision` describe no configuration that
 * was in force. Never the configuration as it is now. (Decision D-71c-2 of the row's note: a
 * question for the spec owner - a fifth shape, or a nullable field 123.)
 */
export const STT_SNAPSHOT_NOT_RECORDED_MODEL = 'not-recorded';
export const NO_STT_SNAPSHOT_RECORDED: SttConfigSnapshot = Object.freeze({ enabled: true, backend: 'cpu-local', model: STT_SNAPSHOT_NOT_RECORDED_MODEL, diarization: false, revision: 1 });

/**
 * True for THE stand-in of a session that recorded no snapshot: the transcript step then waits for
 * nothing. BY IDENTITY, never by a member (code review row 80, R80-07): `not-recorded` is a valid
 * model identifier, and a session whose real snapshot names such a model HAS a snapshot. A copy of
 * the stand-in is not it either - the step then asks the transcription unit, which answers
 * `NO_SNAPSHOT` for a session that has none.
 */
export const isSttSnapshotNotRecorded = (snapshot: SttConfigSnapshot): boolean => snapshot === NO_STT_SNAPSHOT_RECORDED;

const oneOf = <Value extends string>(values: readonly Value[], value: unknown, otherwise: Value): Value => (values.includes(value as Value) ? (value as Value) : otherwise);
const text = (value: string | null | undefined): string => (typeof value === 'string' && value.length > 0 ? value : STAND_INS.unknownText);
const whole = (value: unknown): number => Number(value);

/** The audit type the session writes once per worker restart that cost audio (task 4 row 191b; the vocabulary's name). */
export const AUDIO_ABSENT_ON_RESTART_AUDIT_TYPE = 'CAPTURE_AUDIO_ABSENT_ON_RESTART';

/**
 * Task 4 row 191c (decisions C73, C83): THE RESTARTS THAT COST AUDIO, AS THE SESSION STORED THEM.
 *
 * The source is the session's own audit entries of the type above, out of the rows this reader
 * already reads for `audit-session-extract.jsonl` (`READ_SEAL_AUDIT_ROWS`: no second statement, no
 * other table, never the error log). One record per entry, in the order of the chain: the two
 * attempt numbers and the two measured bounds. The audit entry LEAVES A BOUND OUT when its instant
 * was not known; the manifest states that bound as null ("the gap exists and was not measured").
 *
 * No entry = an empty list = the manifest carries no `audio.absentOnRestart`.
 *
 * An entry whose numbers are not of the form its writer enforces (`core/audit-details.ts`) is not
 * skipped and not repaired: the read throws, and the seal does not start on a session record that
 * would sign fewer restarts, or other numbers, than the audit chain holds.
 */
/**
 * Task 4 row P1 (decisions U21 (2), C66 (1)): manifest field 133 out of what the boot checks of THIS Core found
 * of its host profile (`CaptureBootOutcome.hostProfile`; undefined in a development Core, where none is asked
 * by design, and before the boot step passed).
 *
 *   undefined, or asked        null - the manifest carries no member (development; production on Linux)
 *   not asked, on `darwin`     the member, with the platform
 *   not asked, anywhere else   THROWS: the manifest has no word for that platform, and a seal that left the
 *                              member out would sign "nothing to state" for a Core whose host nobody checked.
 *                              Not reachable while the two lists agree (a test holds them equal).
 */
export function hostProfileNotAskedOf(found: { readonly platform: string; readonly asked: boolean } | undefined): ManifestHostProfileNotAsked | null {
  if (found === undefined || found.asked) return null;
  const platform = MANIFEST_HOST_PROFILE_NOT_ASKED_PLATFORMS.find((word) => word === found.platform);
  if (platform === undefined) throw new Error('the host profile of this Core was not asked on a platform the manifest cannot state');
  return { platform };
}

export function audioRestartGapsOf(auditRows: readonly Record<string, unknown>[]): ManifestAudioRestartGap[] {
  const attempt = (value: unknown): number | null => (typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 ? value : null);
  const bound = (value: unknown): number | null | undefined =>
    value === undefined || value === null ? null : typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MANIFEST_AUDIO_ABSENT_MAX_MS ? value : undefined;
  return auditRows
    .filter((row) => row.type === AUDIO_ABSENT_ON_RESTART_AUDIT_TYPE)
    .map((row) => {
      const details = typeof row.details === 'object' && row.details !== null ? (row.details as Record<string, unknown>) : {};
      const earlierAttempt = attempt(details.earlierAttempt);
      const laterAttempt = attempt(details.laterAttempt);
      const absentAtLeastMs = bound(details.audioAbsentAtLeastMs);
      const absentAtMostMs = bound(details.audioAbsentAtMostMs);
      if (earlierAttempt === null || laterAttempt === null || absentAtLeastMs === undefined || absentAtMostMs === undefined) {
        throw new Error(`the audit entry ${String(row.id)} of a worker restart does not hold the numbers its type requires; the seal does not state the restart from it`);
      }
      return { earlierAttempt, laterAttempt, absentAtLeastMs, absentAtMostMs };
    });
}

/** The audit type the session writes once per absence of a camera inside the session, when the absence ends (task 4 row R1b; the vocabulary's name). */
export const VIDEO_ABSENT_IN_SESSION_AUDIT_TYPE = 'CAPTURE_VIDEO_ABSENT_IN_SESSION';

/** One absence of a camera as the session stored it: the track and the device its entry names, and the record the manifest states. */
export interface StoredVideoAbsence {
  readonly trackId: string;
  readonly deviceId: string;
  readonly absence: ManifestVideoAbsence;
}

/**
 * Task 4 row R1b (decision C99; finding F3-01): THE ABSENCES OF THE SESSION'S CAMERAS INSIDE THE
 * SESSION, AS THE SESSION STORED THEM.
 *
 * The source is the session's own audit entries of the type above, out of the rows this reader
 * already reads for `audit-session-extract.jsonl` (`READ_SEAL_AUDIT_ROWS`: no second statement, no
 * other table, never the error log) - the rule of `audioRestartGapsOf`. One record per entry, in
 * the order of the chain. The entry LEAVES A BOUND OUT when its instant was not known; the manifest
 * states that bound as null ("the absence exists and was not measured").
 *
 * ONLY THE ATTEMPT WHOSE MEDIA IS IN THE FILES. A worker is replaced only while nothing is durable,
 * so the camera files of a session begin with its LAST worker. An absence that ended inside an
 * earlier attempt has its entry in the chain (it was true when it was written) and is NOT stated
 * in the manifest: nothing of that attempt's timeline is in any file. The last attempt is the
 * highest number the session's stored entries name - these entries and those of the worker
 * restarts (`laterAttempt`).
 *
 * No entry = an empty list = no track of the manifest carries `absentInSession`.
 *
 * An entry that is not of the form its writer enforces (`core/audit-details.ts`), or whose row
 * names another device than its details, is not skipped and not repaired: the read throws, and
 * the seal does not start on a session record that would sign fewer absences, or other numbers,
 * than the audit chain holds.
 */
export function videoAbsencesOf(auditRows: readonly Record<string, unknown>[]): StoredVideoAbsence[] {
  const counted = (value: unknown): number | null => (typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 ? value : null);
  const bound = (value: unknown): number | null | undefined =>
    value === undefined || value === null ? null : typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MANIFEST_VIDEO_ABSENT_MAX_MS ? value : undefined;
  const stored = auditRows
    .filter((row) => row.type === VIDEO_ABSENT_IN_SESSION_AUDIT_TYPE)
    .map((row) => {
      const details = typeof row.details === 'object' && row.details !== null ? (row.details as Record<string, unknown>) : {};
      const trackId = TRACKS.find((track) => track === details.trackId) ?? null;
      const deviceId = typeof details.deviceId === 'string' && details.deviceId.length > 0 && details.deviceId === row.device_id ? details.deviceId : null;
      const attempt = counted(details.attempt);
      const loss = counted(details.loss);
      const absentAtLeastMs = bound(details.videoAbsentAtLeastMs);
      const absentAtMostMs = bound(details.videoAbsentAtMostMs);
      const ended = MANIFEST_VIDEO_ABSENCE_ENDS.find((word) => word === details.ended) ?? null;
      if (trackId === null || deviceId === null || attempt === null || loss === null || absentAtLeastMs === undefined || absentAtMostMs === undefined || ended === null) {
        throw new Error(`the audit entry ${String(row.id)} of a camera absent inside the session does not hold what its type requires; the seal does not state the absence from it`);
      }
      return { trackId, deviceId, absence: { attempt, loss, absentAtLeastMs, absentAtMostMs, ended } };
    });
  if (stored.length === 0) return [];
  const last = Math.max(...stored.map((entry) => entry.absence.attempt), ...audioRestartGapsOf(auditRows).map((gap) => gap.laterAttempt));
  return stored.filter((entry) => entry.absence.attempt === last);
}

export function createSealSessionReader(options: SealSessionReaderOptions): SealSessionReader {
  return {
    async read(sessionId: string): Promise<SealSessionFacts | null> {
      let state = options.state();
      if (state.session === null || state.session.id !== sessionId) return null;
      // A session that never recorded has nothing to seal.
      if (state.session.startedAt === null) return null;
      if (state.session.evidenceId === null) {
        await options.begin(sessionId);
        state = options.state();
      }
      const session = state.session;
      if (session === null || session.id !== sessionId || session.startedAt === null || session.evidenceId === null) throw new Error('the session has no evidence ID after its seal began');

      const db = options.db();
      const storedSources = (await db.query<{ slot: string; device_id: string; adapter_kind: string; recorded_at?: string | number }>(READ_SEAL_SOURCE_ROWS, [sessionId])).rows;
      const sourceRows: SessionCaptureSourceRow[] = storedSources.map((row) => ({ slot: row.slot, deviceId: row.device_id, adapterKind: row.adapter_kind }));
      // D60 (2026-11-04): THE MANIFEST NAMES ITS OWN LIST. The tracks this package seals are the video slots of THIS session's
      // start records (T-41): a session that started under the two-track shape still seals exactly its two files, a four-track
      // session seals four (the verifier reads the list as a prefix of VIDEO_TRACK_IDS). Start rows naming no video slot at all -
      // which BUILD_MANIFEST refuses for the missing source rows anyway - fall back to the full value set.
      const sealedTracks: readonly (typeof TRACKS)[number][] = TRACKS.filter((trackId) => sourceRows.some((row) => row.slot === trackId));
      const sealTrackIds = sealedTracks.length > 0 ? sealedTracks : TRACKS;
      // D61 (2026-11-04): the SAME rule on the microphone plane. The channels this package seals are the mic slots of THIS
      // session's start records: a session that started under the two-role shape (0040 renamed them `MIC-01`/`MIC-02`) still
      // seals exactly its own audio - the manifest names its own list and the verifier reads it as a prefix of the new order -
      // and a four-channel session seals four. The signed manifest's single `audio` member (the transcription track `AUDIO-01`)
      // is the two-role worker lane's form until the protocol's own D61 wave; the channel plane is held by the start rows.
      const sealedMicSlots = ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'].filter((slot) => sourceRows.some((row) => row.slot === slot));
      // The capture facts are THIS session's only when they name the instant of its own start rows (a reset reuses session IDs).
      let captureFacts = (await options.captureFacts?.(sessionId)) ?? null;
      if (captureFacts !== null && (captureFacts.sessionId !== sessionId || !storedSources.some((row) => row.recorded_at !== undefined && whole(row.recorded_at) === captureFacts?.startRecordedAt))) {
        options.onForeignCaptureFacts?.(sessionId);
        captureFacts = null;
      }
      // Task 4 row 191b (decision C57): THE INTERVALS OF A WORKER THAT WAS REPLACED. A capture worker is
      // replaced only while nothing is durable, and the session then states the later worker's
      // interval by a NEW row of reason START (`capture-session`, `recordAudioGap`). Every row BEFORE
      // the last START row is therefore of a worker whose audio is in NO file: its stored media times
      // count in a file that does not exist. Fields 58, 59 are FILE time of the sealed file, so such
      // a row is stated with the span 0..0 - it is in the manifest (the audio source began more than
      // once: no continuity is claimed), and it claims no part of the file. The rows themselves are
      // read as they are, by the same statement; nothing is left out and no number is changed.
      const intervalRows = (
        await db.query<{ seq: number; mic_device_id: string; role: string; from_media_ms: string | number; to_media_ms: string | number | null; reason: string; switched_by: string | null }>(READ_SEAL_AUDIO_INTERVALS, [sessionId])
      ).rows;
      const lastStart = intervalRows.reduce((last, row, index) => (row.reason === 'START' ? index : last), -1);
      const audioIntervals: ManifestAudioIntervalInput[] = intervalRows.map((row, index) => ({
        seq: whole(row.seq),
        micDeviceId: row.mic_device_id,
        role: row.role === 'STANDBY' ? 'STANDBY' : 'PRIMARY', // D61 (2026-11-04): the stored role is the two-role worker lane's name of the transcription pair (channels 1 and 2); the numbered channels are the start records'
        fromMs: index < lastStart ? 0 : whole(row.from_media_ms),
        toMs: index < lastStart ? 0 : row.to_media_ms === null ? null : whole(row.to_media_ms),
        reason: oneOf(INTERVAL_REASONS, row.reason, 'START'),
        switchedBy: row.switched_by,
      }));
      const auditRows = (await db.query<Record<string, unknown>>(READ_SEAL_AUDIT_ROWS, [sessionId])).rows;
      // Task 4 row 191c: the restarts that cost audio, from the same rows (fields 129-132 of the SIGNED manifest).
      const audioRestartGaps = audioRestartGapsOf(auditRows);
      // Task 4 row R1b: the absences of the cameras inside the session, from the same rows (fields 134-138 of the SIGNED manifest).
      const videoAbsences = videoAbsencesOf(auditRows);
      // Task 4 row P1: what this Core's boot checks found of its host profile (field 133 of the SIGNED manifest), asked once per read.
      const hostProfileNotAsked = options.hostProfileNotAsked?.() ?? null;
      // One JSON object per line, members in a fixed order: the rows as the chain holds them.
      const auditExtract = Buffer.from(
        auditRows
          .map((row) =>
            JSON.stringify({
              seq: whole(row.seq),
              id: row.id,
              at: whole(row.at),
              type: row.type,
              category: row.category,
              severity: row.severity,
              actorId: row.actor_id ?? null,
              message: row.message,
              sessionId: row.session_id ?? null,
              evidenceId: row.evidence_id ?? null,
              deviceId: row.device_id ?? null,
              details: row.details ?? {},
              prevHash: row.prev_hash,
              hash: row.hash,
            }),
          )
          .map((line) => `${line}\n`)
          .join(''),
        'utf8',
      );

      // Field 43: what each camera file's own init segment says. No file, or no init segment: null here -
      // CLOSE_TRACKS names that file (MISSING / NO_INIT_SEGMENT). An init segment whose video sample entry
      // is absent or has no name here is an unusable camera file (ev §E.1): the seal stops, by name.
      const codecs = new Map<string, string | null>();
      for (const trackId of sealTrackIds) { // D60: the session's own list
        const entry = (await options.videoSampleEntry?.(sessionId, trackId)) ?? null;
        if (entry !== null && (entry.state === 'UNKNOWN_SAMPLE_ENTRY' || entry.state === 'NO_VIDEO_SAMPLE_ENTRY')) {
          throw new SealingError(SealingFailure.CAMERA_FILE_UNUSABLE, 'the init segment of a recording file names no video codec this Core knows', { trackId, reason: entry.state === 'UNKNOWN_SAMPLE_ENTRY' ? 'VIDEO_SAMPLE_ENTRY_UNKNOWN' : 'NO_VIDEO_SAMPLE_ENTRY', sampleEntry: entry.sampleEntry });
        }
        codecs.set(trackId, entry !== null && entry.state === 'KNOWN' ? entry.codec : null);
      }

      // Field 36 (fix wave K, G89b-01; fix 151): what each camera file's own stream DECLARES. Only for a file whose codec the
      // init segment named: the text starts with it. No file / no picture size: null, and field 36 is the configured profile.
      const streamProfiles = new Map<string, { readonly text: string; readonly codec: string; readonly format: SealVideoFormat } | null>();
      for (const trackId of sealTrackIds) { // D60: the session's own list
        const codec = codecs.get(trackId) ?? null;
        const format = codec === null ? null : ((await options.videoFormat?.(sessionId, trackId)) ?? null);
        streamProfiles.set(trackId, codec === null || format === null ? null : { text: streamProfileOf(codec, format), codec, format });
      }

      const profileDifferences: SealProfileDifference[] = [];
      const track = (trackId: (typeof TRACKS)[number]): SealTrackFacts => {
        // The device of a slot is the START record's; the snapshot's line is the fallback of a session that has no rows (the builder then refuses it).
        const line = session.captureConfig?.cameras.find((camera) => camera.trackId === trackId);
        const deviceId = sourceRows.find((row) => row.slot === trackId)?.deviceId ?? line?.deviceId ?? STAND_INS.unknownText;
        const absences = videoAbsences.filter((entry) => entry.trackId === trackId).map((entry) => entry.absence);
        const camera = state.cameras.find((entry) => entry.id === trackId);
        const device = state.captureDevices.devices.find((entry) => entry.id === deviceId);
        // Joined on the track AND the device of the start record (D72 (g)): a report of another camera is not this file's.
        const reported = captureFacts?.cameras.find((entry) => entry.trackId === trackId && entry.deviceId === deviceId) ?? null;
        // Fields 38, 39 (G89-01): by the adapter kind of the START row. A generated source has no model
        // and no firmware to report; another camera states its registry row or says that none was reported.
        const adapterKind = sourceRows.find((row) => row.slot === trackId)?.adapterKind;
        const words = adapterKind === 'FAKE' ? SOURCE_WORDS.FAKE : adapterKind === 'LOCAL_DEVICE' ? { model: device?.model ?? SOURCE_WORDS.LOCAL_DEVICE.model, firmware: SOURCE_WORDS.LOCAL_DEVICE.firmware } : { model: device?.model ?? NOT_REPORTED, firmware: device?.firmware ?? NOT_REPORTED };
        // Field 36: the STREAM when the file says what it is; a configured profile its DECLARED format differs from is told, never written.
        const configured = text(line?.profile);
        const declared = streamProfiles.get(trackId) ?? null;
        const stream = declared?.text ?? null;
        if (declared !== null && streamProfileDiffers(configured, declared.codec, declared.format)) profileDifferences.push({ trackId, configured, stream: declared.text });
        return {
          trackId,
          deviceId,
          profile: stream ?? configured,
          name: text(camera?.name),
          model: text(words.model),
          firmware: text(words.firmware),
          clockOffsetMs: reported?.measuredClockOffsetMs ?? reported?.clockOffsetMs ?? STAND_INS.clockOffsetMs,
          codec: codecs.get(trackId) ?? null,
          avOffsetMs: null,
          firstVideoSamplePts: reported?.firstVideo?.pts ?? null,
          firstVideoSampleTimescale: reported?.firstVideo?.timescale ?? null,
          // Row R1b: no absence of this track's camera = NO member here and no key in the manifest (the track record of before, byte for byte).
          ...(absences.length === 0 ? {} : { absentInSession: absences }),
        };
      };
      // Row R1b: an entry that names a track with ANOTHER device than the start record of the session gave that track is no
      // statement about this session's file: the seal does not start on it (the rule of a malformed entry).
      for (const entry of videoAbsences) {
        if (sourceRows.find((row) => row.slot === entry.trackId)?.deviceId !== entry.deviceId) {
          throw new Error('an audit entry of a camera absent inside the session names a device that is not the one the session started that track with; the seal does not state the absence from it');
        }
      }

      // D60 (2026-11-04): one entry per track the session named at its start (was exactly VIDEO-01 and VIDEO-02).
      const tracks = sealTrackIds.map(track);
      if (profileDifferences.length > 0) options.onProfileDiffers?.(sessionId, profileDifferences);

      const cameraEnds = sealTrackIds.flatMap((trackId) => { // D60: the session's own list
        const deviceId = sourceRows.find((row) => row.slot === trackId)?.deviceId;
        const ended = captureFacts?.cameras.find((entry) => entry.trackId === trackId && entry.deviceId === deviceId)?.ended ?? null;
        return ended === null ? [] : [{ trackId, reason: ended.reason }];
      });
      const operator = state.operators.find((entry) => entry.id === session.input.investigatorId);
      let sttSnapshot = await options.sttSnapshot(sessionId);
      if (sttSnapshot === null) {
        options.onNoSttSnapshot?.(sessionId);
        sttSnapshot = NO_STT_SNAPSHOT_RECORDED;
      }
      return {
        sessionId,
        evidenceId: session.evidenceId,
        caseNumber: session.input.caseNumber,
        notice: options.notice,
        timezone: options.timezone,
        createdAt: session.createdAt,
        startedAt: session.startedAt,
        stoppedAt: session.stoppedAt,
        // G89-01: the Core's own clock and build; an identity that says it was not configured. Nothing of the hosted simulator's dataset.
        timeSource: { source: CORE_TIME_SOURCE.source, state: CORE_TIME_SOURCE.state, fallbackOrder: [...CORE_TIME_SOURCE.fallbackOrder] },
        // Closing pass Z1 (D207): fields 20, 21 are the CONFIGURED installation identity or say that none is - never the stored seed record.
        device: { deviceId: options.identity?.deviceId ?? NOT_CONFIGURED, name: options.identity?.name ?? NOT_CONFIGURED, serialNumber: NOT_CONFIGURED, hardwareUuid: NOT_CONFIGURED, softwareVersion: CORE_SERVER_VERSION },
        operator: { investigatorId: session.input.investigatorId, displayName: text(operator?.displayName), role: oneOf(OPERATOR_ROLES, operator?.role, 'INVESTIGATOR') },
        subject: { name: session.input.subjectName, type: oneOf(SUBJECT_TYPES, session.input.subjectType, 'LAINNYA'), authorization: STAND_INS.subjectAuthorization },
        tracks,
        audioCodec: STAND_INS.audioCodec,
        audioIntervals,
        // Row 191c: no restart = NO member here and no key in the manifest (the manifest of before, byte for byte).
        ...(audioRestartGaps.length === 0 ? {} : { audioRestartGaps }),
        // Row P1: the host profile of this production Core was not asked = the member; asked, or never asked by design = NO member.
        ...(hostProfileNotAsked === null ? {} : { hostProfileNotAsked }),
        sourceRows,
        sttSnapshot,
        auditExtract,
        // C3: by TRACK and joined on the device of the START record, as every capture fact is (a report of another camera is not this file's).
        ...(cameraEnds.length === 0 ? {} : { cameraEnds }),
      };
    },
  };
}
