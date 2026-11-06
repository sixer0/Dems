/**
 * The `recording_fragments` store and the recorder that feeds it from the capture worker's
 * checkpoint records (blueprint row 59 / M3-W3; database contract dbc-3 §B.6; capture spec §A.5,
 * §B.2 "Delivery contract" and R-3, §C.3).
 *
 * TWO PARTS.
 *
 *   createRecordingFragmentStore   the INSERT path of the table as the runtime role: ONE ROW PER
 *                                  FRAGMENT PER CAMERA, IN ORDER, WITHOUT A GAP, IDEMPOTENT ON A
 *                                  REPLAY. The zero-gap rule (fragment n needs fragment n - 1, the
 *                                  byte ranges touch, the chain continues) is part of the insert
 *                                  statement (`statements.ts`). A row that is stored already and
 *                                  equal is `ALREADY_STORED`; a row that would leave a gap is
 *                                  refused (`FRAGMENT_GAP`); a DIFFERENT row under a stored key is
 *                                  refused (`FRAGMENT_CONFLICT`) and the stored row is not touched.
 *
 *   createFragmentRecorder         takes the supervisor's `record` events of ONE session, turns
 *                                  each `FRAGMENT_CHECKPOINT` into a row (camera -> track by the
 *                                  session's plan) and writes it, one after the other, in order.
 *                                  It never holds the supervisor (a record listener is not waited
 *                                  for) and it BOUNDS ITS OWN BACKLOG, as the protocol asks of a
 *                                  record consumer: beyond `backlogLimit` waiting rows a
 *                                  checkpoint is not queued, and that camera file is `behind`.
 *                                  D5 / row 148 (protocol 6, N-32): the plan's map also takes each
 *                                  MICROPHONE of the plan to the sealed track of its channel file
 *                                  (`MIC-0N` -> `AUDIO-0N`), so a channel file's checkpoints become
 *                                  `AUDIO-0N` rows by the same rules; `behind` and the reports name
 *                                  either kind of track.
 *
 * THE FILE IS THE TRUTH (decision D67). A checkpoint that was not written - the database was away,
 * the backlog was full, the Core was down - is not lost evidence: the fragment is in the camera
 * file. RECOVERY walks the file (`walkCameraFile` of the capture unit), and
 * `insertMissing` brings the table in line with it; the same call is how a replay of records is
 * made harmless. This module therefore never retries by itself and never blocks a recording.
 *
 * WHO CALLS IT. The capture-session unit (`src/capture-session/index.ts`, blueprint row 71)
 * creates one recorder per recording session with the plan's camera-to-track map and hands it the
 * worker's records; the sealing host (`src/sealing-host/index.ts`, row 82) builds a store from the
 * same statements, and the seal's pipeline calls `insertMissing` and `read` through its port.
 *
 * FAILURES ARE TYPED AND NEVER SWALLOWED. A statement that fails is a `RecordingFragmentStoreError`
 * with the SQLSTATE and the constraint name (never a value of the row). The recorder hands every
 * failure to its `report` port (the caller writes it to the persistent error log) with the
 * session, the track and the fragment number, and goes on with the other camera.
 */
import {
  CHAIN_GENESIS_SHA256,
  INSERT_RECORDING_FRAGMENT,
  READ_RECORDING_FRAGMENT,
  READ_RECORDING_FRAGMENTS,
  READ_RECORDING_FRAGMENT_HEAD,
  FRAGMENT_TRACK_IDS,
  type FragmentTrackId,
  type Queryable,
  type VideoTrackId,
} from './statements';

export {
  AUDIO_FRAGMENT_TRACK_IDS,
  CHAIN_GENESIS_SHA256,
  FRAGMENT_TRACK_IDS,
  VIDEO_TRACK_IDS,
  type AudioFragmentTrackId,
  type FragmentTrackId,
  type Queryable,
  type VideoTrackId,
} from './statements';

/**
 * One row of `recording_fragments`: the member names of the typed schema (`db/schema/recording.ts`).
 * D28 / migration 0044 (row 146): the table also takes the microphone channel files `AUDIO-0N`. The
 * row type names its track set: `RecordingFragment` alone is a camera-file row (every reader before
 * D28 reads camera files, and keeps compiling as it did); `RecordingFragment<FragmentTrackId>` is
 * any row; the store writes any row and reads back rows of the track it was asked for.
 */
export interface RecordingFragment<Track extends FragmentTrackId = VideoTrackId> {
  readonly sessionId: string;
  /** A camera file (`VIDEO-0N`) or, since D28 / migration 0044 (row 146), a microphone channel file (`AUDIO-0N`). */
  readonly trackId: Track;
  /** `mfhd.sequence_number`: 1, 2, 3 ... of this camera file. */
  readonly seq: number;
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly mediaStartMs: number;
  readonly mediaDurationMs: number;
  /** SHA-256 of the fragment's stored bytes. */
  readonly sha256: string;
  readonly chainHash: string;
  /** Epoch ms: when the sync that covers the fragment returned. */
  readonly durableAt: number;
}

export type RecordingFragmentStoreErrorCode =
  /** The value is no fragment row (a member is missing, not a whole number, not a digest): nothing was sent to the database. */
  | 'ROW_INVALID'
  /** The fragment before is not stored, or this one does not continue its bytes or its chain: nothing was inserted. */
  | 'FRAGMENT_GAP'
  /** Another row is stored under this key: the stored row is kept as it is. */
  | 'FRAGMENT_CONFLICT'
  | 'WRITE_FAILED'
  | 'READ_FAILED';

export class RecordingFragmentStoreError extends Error {
  readonly code: RecordingFragmentStoreErrorCode;
  /** The SQLSTATE of the database, when it gave one. */
  readonly sqlState: string | null;
  /** The constraint the database named, when it named one. */
  readonly constraint: string | null;
  /** The member of the row the refusal is about (a name, never a value), when there is one. */
  readonly member: string | null;

  constructor(code: RecordingFragmentStoreErrorCode, message: string, options: { cause?: unknown; member?: string } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'RecordingFragmentStoreError';
    this.code = code;
    const fields = (options.cause ?? {}) as { code?: unknown; constraint?: unknown };
    this.sqlState = typeof fields.code === 'string' ? fields.code : null;
    this.constraint = typeof fields.constraint === 'string' ? fields.constraint : null;
    this.member = options.member ?? null;
  }
}

export const FragmentInsertOutcome = { INSERTED: 'INSERTED', ALREADY_STORED: 'ALREADY_STORED' } as const;
export type FragmentInsertOutcome = (typeof FragmentInsertOutcome)[keyof typeof FragmentInsertOutcome];

export interface RecordingFragmentStore {
  /** One fragment row under the zero-gap rule. Resolves `INSERTED` or `ALREADY_STORED` (the same row again); rejects otherwise. */
  insert(row: AnyRecordingFragment): Promise<FragmentInsertOutcome>;
  /**
   * Brings the table in line with a list of fragments of ONE camera file, in order (what the file
   * walk of RECOVERY rebuilt, or a replay of records): rows that are stored are left, the others
   * are inserted. Stops at the first refusal and rejects with it.
   */
  insertMissing(rows: readonly AnyRecordingFragment[]): Promise<{ readonly inserted: number; readonly alreadyStored: number }>;
  /** The rows of one track file, in order; they carry the track they were read for. */
  read<Track extends FragmentTrackId>(sessionId: string, trackId: Track): Promise<RecordingFragment<Track>[]>;
  /** The last stored fragment of a camera file (or microphone channel file), or null. */
  head<Track extends FragmentTrackId>(sessionId: string, trackId: Track): Promise<RecordingFragment<Track> | null>;
}

/** A row of any fragment track: a camera file or (D28 / 0044, row 146) a microphone channel file. */
export type AnyRecordingFragment = RecordingFragment<FragmentTrackId>;

interface StoredRow {
  session_id: string;
  track_id: string;
  seq: number;
  byte_offset: string | number;
  byte_length: string | number;
  media_start_ms: string | number;
  media_duration_ms: string | number;
  sha256: string;
  chain_hash: string;
  durable_at: string | number;
}

const toFragment = (row: StoredRow): AnyRecordingFragment => ({
  sessionId: row.session_id,
  trackId: row.track_id as FragmentTrackId,
  seq: Number(row.seq),
  byteOffset: Number(row.byte_offset),
  byteLength: Number(row.byte_length),
  mediaStartMs: Number(row.media_start_ms),
  mediaDurationMs: Number(row.media_duration_ms),
  sha256: row.sha256,
  chainHash: row.chain_hash,
  durableAt: Number(row.durable_at),
});

const HEX64 = /^[0-9a-f]{64}$/;
const whole = (value: unknown, least: number): boolean => typeof value === 'number' && Number.isSafeInteger(value) && value >= least;

/** The member of `row` that makes it no fragment row, or null. The table's CHECKs say the same; this answers before a statement is sent. */
export function invalidMember(row: AnyRecordingFragment): keyof AnyRecordingFragment | null {
  if (typeof row.sessionId !== 'string' || row.sessionId.length === 0) return 'sessionId';
  if (!(FRAGMENT_TRACK_IDS as readonly string[]).includes(row.trackId)) return 'trackId'; // D28 / 0044 (row 146): camera and microphone channel files
  if (!whole(row.seq, 1) || row.seq > 2_147_483_647) return 'seq';
  if (!whole(row.byteOffset, 0)) return 'byteOffset';
  if (!whole(row.byteLength, 1)) return 'byteLength';
  if (!whole(row.mediaStartMs, 0)) return 'mediaStartMs';
  if (!whole(row.mediaDurationMs, 1)) return 'mediaDurationMs';
  if (typeof row.sha256 !== 'string' || !HEX64.test(row.sha256)) return 'sha256';
  if (typeof row.chainHash !== 'string' || !HEX64.test(row.chainHash)) return 'chainHash';
  if (!whole(row.durableAt, 0)) return 'durableAt';
  return null;
}

/** The first member in which a stored row differs from the row given again, or null when they are the same fragment. `durableAt` is not compared: a replay may carry a later instant. */
function differsIn(stored: AnyRecordingFragment, given: AnyRecordingFragment): keyof AnyRecordingFragment | null {
  const members = ['byteOffset', 'byteLength', 'mediaStartMs', 'mediaDurationMs', 'sha256', 'chainHash'] as const;
  return members.find((member) => stored[member] !== given[member]) ?? null;
}

export function createRecordingFragmentStore(connection: Queryable): RecordingFragmentStore {
  const readOne = async (row: AnyRecordingFragment): Promise<AnyRecordingFragment | null> => {
    try {
      const found = (await connection.query<StoredRow>(READ_RECORDING_FRAGMENT, [row.sessionId, row.trackId, row.seq])).rows[0];
      return found === undefined ? null : toFragment(found);
    } catch (error) {
      throw new RecordingFragmentStoreError('READ_FAILED', 'the stored fragment row could not be read', { cause: error });
    }
  };

  const insert = async (row: AnyRecordingFragment): Promise<FragmentInsertOutcome> => {
    const member = invalidMember(row);
    if (member !== null) throw new RecordingFragmentStoreError('ROW_INVALID', 'the value is no fragment row', { member });
    let inserted: number | null;
    try {
      inserted = (
        await connection.query(INSERT_RECORDING_FRAGMENT, [row.sessionId, row.trackId, row.seq, row.byteOffset, row.byteLength, row.mediaStartMs, row.mediaDurationMs, row.sha256, row.chainHash, row.durableAt, CHAIN_GENESIS_SHA256])
      ).rowCount;
    } catch (error) {
      throw new RecordingFragmentStoreError('WRITE_FAILED', 'a fragment row could not be inserted', { cause: error });
    }
    if (inserted === 1) return FragmentInsertOutcome.INSERTED;
    // Nothing was inserted: the key is taken (a replay, or another fragment claims it), or the rule refused the row.
    const stored = await readOne(row);
    if (stored === null) throw new RecordingFragmentStoreError('FRAGMENT_GAP', 'the fragment before this one is not stored, or this one does not continue its bytes or its chain');
    const differs = differsIn(stored, row);
    if (differs !== null) throw new RecordingFragmentStoreError('FRAGMENT_CONFLICT', 'another fragment is stored under this number; the stored row is kept', { member: differs });
    return FragmentInsertOutcome.ALREADY_STORED;
  };

  return Object.freeze({
    insert,

    async insertMissing(rows: readonly AnyRecordingFragment[]): Promise<{ readonly inserted: number; readonly alreadyStored: number }> {
      let inserted = 0;
      let alreadyStored = 0;
      for (const row of rows) {
        if ((await insert(row)) === FragmentInsertOutcome.INSERTED) inserted += 1;
        else alreadyStored += 1;
      }
      return { inserted, alreadyStored };
    },

    async read<Track extends FragmentTrackId>(sessionId: string, trackId: Track): Promise<RecordingFragment<Track>[]> {
      try {
        // The statement selects `track_id = $2`, so every row read carries the track asked for.
        return (await connection.query<StoredRow>(READ_RECORDING_FRAGMENTS, [sessionId, trackId])).rows.map(toFragment) as RecordingFragment<Track>[];
      } catch (error) {
        throw new RecordingFragmentStoreError('READ_FAILED', 'the fragment rows could not be read', { cause: error });
      }
    },

    async head<Track extends FragmentTrackId>(sessionId: string, trackId: Track): Promise<RecordingFragment<Track> | null> {
      try {
        const found = (await connection.query<StoredRow>(READ_RECORDING_FRAGMENT_HEAD, [sessionId, trackId])).rows[0];
        return found === undefined ? null : (toFragment(found) as RecordingFragment<Track>);
      } catch (error) {
        throw new RecordingFragmentStoreError('READ_FAILED', 'the last fragment row could not be read', { cause: error });
      }
    },
  });
}

// ── From the worker's records to rows ──────────────────────────────────────────────────────────

/** The members of a `FRAGMENT_CHECKPOINT` record this module reads (`@dems/capture-protocol`; structural, so a rebuilt fragment of the file walk fits as well). */
export interface CheckpointFacts {
  readonly index: number;
  readonly start: number;
  readonly len: number;
  readonly fragSha256: string;
  readonly chainSha256: string;
  readonly mediaStartMs: number;
  readonly mediaDurationMs: number;
  readonly durableAt: number;
}

/** The row of one checkpoint: `index` is the row's `seq`, `start`/`len` its byte range, the stored-bytes digest and chain its two hashes. */
export function fragmentRowOf<Track extends FragmentTrackId>(sessionId: string, trackId: Track, checkpoint: CheckpointFacts): RecordingFragment<Track> {
  return {
    sessionId,
    trackId,
    seq: checkpoint.index,
    byteOffset: checkpoint.start,
    byteLength: checkpoint.len,
    mediaStartMs: checkpoint.mediaStartMs,
    mediaDurationMs: checkpoint.mediaDurationMs,
    sha256: checkpoint.fragSha256,
    chainHash: checkpoint.chainSha256,
    durableAt: checkpoint.durableAt,
  };
}

/** What the recorder could not do. Identifiers and codes only: never a value of a row, never a path. */
export interface FragmentRecorderReport {
  readonly source: 'recording-fragments.recorder';
  readonly code: 'FRAGMENT_ROW_NOT_STORED' | 'FRAGMENT_BACKLOG_FULL' | 'FRAGMENT_CAMERA_UNKNOWN';
  readonly sessionId: string;
  /** Row 148 (D5): a camera file's `VIDEO-0N` or a channel file's `AUDIO-0N`; null when the record named no device of the plan. */
  readonly trackId: FragmentTrackId | null;
  /** The fragment number the report is about, or null. */
  readonly seq: number | null;
  readonly err: unknown;
}

/** A `record` event of the capture supervisor, as far as this module reads it. */
export interface FragmentRecordEvent {
  readonly sessionId: string;
  readonly record: { readonly kind: string; readonly deviceId?: string } & Partial<CheckpointFacts>;
}

export interface FragmentRecorderOptions {
  /** The recording session this recorder belongs to: events of another session are not its own and are ignored. */
  readonly sessionId: string;
  /**
   * Device -> track of its file, from the session's capture plan: a camera to its video track
   * (`CAM-01` -> `VIDEO-01`) and, row 148 (D5, protocol 6 N-32), a microphone of the plan to the
   * sealed track of its channel file (`MIC-03` on channel `MIC-02` -> `AUDIO-02`).
   */
  readonly tracks: ReadonlyMap<string, FragmentTrackId>;
  readonly store: Pick<RecordingFragmentStore, 'insert'>;
  /** Where a failure goes: the caller writes it to the persistent error log. Must not throw. */
  readonly report: (report: FragmentRecorderReport) => void;
  /** Most rows that wait for the database at one time. Default 256 (about two minutes of two cameras). */
  readonly backlogLimit?: number;
}

export interface FragmentRecorderStatus {
  /** Rows that wait for the database, the one being written included. */
  readonly pending: number;
  readonly inserted: number;
  readonly alreadyStored: number;
  /** Checkpoints that were not written: the first failure of a camera file, every one after it, and those the full backlog turned away. */
  readonly notStored: number;
  /** The files (camera `VIDEO-0N` or channel `AUDIO-0N`, row 148) whose rows are behind their checkpoints: `insertMissing` from the file brings them up. */
  readonly behind: readonly FragmentTrackId[];
}

export interface FragmentRecorder {
  /** Takes one `record` event. Returns at once; true when the event was a checkpoint of this session that was queued. */
  take(event: FragmentRecordEvent): boolean;
  /** Resolves when every row taken so far was written or given up. */
  idle(): Promise<void>;
  status(): FragmentRecorderStatus;
}

const DEFAULT_BACKLOG_LIMIT = 256;

export function createFragmentRecorder(options: FragmentRecorderOptions): FragmentRecorder {
  const limit = options.backlogLimit ?? DEFAULT_BACKLOG_LIMIT;
  const behind = new Set<FragmentTrackId>();
  let chain: Promise<void> = Promise.resolve();
  let pending = 0;
  let inserted = 0;
  let alreadyStored = 0;
  let notStored = 0;
  let unknownSaid = false;
  const report = (entry: Omit<FragmentRecorderReport, 'source' | 'sessionId'>): void => {
    try {
      options.report({ source: 'recording-fragments.recorder', sessionId: options.sessionId, ...entry });
    } catch {
      // The report port failed: nowhere left to say it, and a recording is never stopped for it.
    }
  };

  return Object.freeze({
    take(event: FragmentRecordEvent): boolean {
      if (event.sessionId !== options.sessionId || event.record.kind !== 'FRAGMENT_CHECKPOINT') return false;
      const trackId = event.record.deviceId === undefined ? undefined : options.tracks.get(event.record.deviceId);
      if (trackId === undefined) {
        notStored += 1;
        // A device the plan does not have (neither a camera nor, row 148, a microphone of a channel file): the supervisor
        // refuses such a record; said once if it ever arrives. The code keeps its stored name (error-log readers key on it).
        if (!unknownSaid) report({ code: 'FRAGMENT_CAMERA_UNKNOWN', trackId: null, seq: event.record.index ?? null, err: new RecordingFragmentStoreError('ROW_INVALID', 'the checkpoint names a device that is not in the plan (no camera file and no channel file of it)', { member: 'trackId' }) });
        unknownSaid = true;
        return false;
      }
      const row = fragmentRowOf(options.sessionId, trackId, event.record as CheckpointFacts);
      if (behind.has(trackId)) {
        // A fragment before this one is not stored: this row would be a gap. Not attempted; the file brings the table up.
        notStored += 1;
        return false;
      }
      if (pending >= limit) {
        notStored += 1;
        behind.add(trackId);
        report({ code: 'FRAGMENT_BACKLOG_FULL', trackId, seq: row.seq, err: new RecordingFragmentStoreError('WRITE_FAILED', 'the rows that wait for the database reached the limit; the checkpoint was not queued') });
        return false;
      }
      pending += 1;
      chain = chain.then(async () => {
        try {
          if (behind.has(trackId)) {
            notStored += 1;
            return;
          }
          if ((await options.store.insert(row)) === FragmentInsertOutcome.INSERTED) inserted += 1;
          else alreadyStored += 1;
        } catch (err) {
          notStored += 1;
          behind.add(trackId);
          report({ code: 'FRAGMENT_ROW_NOT_STORED', trackId, seq: row.seq, err });
        } finally {
          pending -= 1;
        }
      });
      return true;
    },

    idle: () => chain,

    status: (): FragmentRecorderStatus => ({ pending, inserted, alreadyStored, notStored, behind: [...behind].sort() }),
  });
}
