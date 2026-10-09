/**
 * THE MIRROR OF THE CHECKPOINT IN THE DATABASE: table `transcript_chunks` (database contract dbc-3
 * §B.7; transcript spec §D.1 "mirrored to the DB").
 *
 * The transcriber does not talk to PostgreSQL. It writes through this PORT; the Core implements it
 * on `transcript_chunks` (`apps/core-server/src/modules/transcript-chunks`, same member names) and
 * hands it over when it mounts the transcriber (row 115). The members are exactly what the runtime
 * role may do on that table: INSERT a row, UPDATE the five columns `status, segments,
 * embedding_ref, model_id, computed_at`, SELECT. There is no delete.
 *
 * ONE ROW IS ONE ATTEMPT. `seq` counts the rows of a session from 1. A chunk that ended FAILED
 * keeps its row; running it again is a NEW row with the same audio range (the shape the bulk
 * fixture of dbc-3 §G calls a "FAILED -> rerun pair").
 *
 * THE FILE IS THE TRUTH, THE TABLE FOLLOWS. A mirror write that fails never stops a transcription
 * and never changes the checkpoint: it is logged, and the rows are brought in line at the next
 * write and at every resume (`reconcile` of the runner).
 *
 * `createMemoryChunkMirror` is the stand-in of the automated suite. It REFUSES what the table
 * refuses (the CHECK constraints of §B.7), so a test cannot pass on a row the database would turn
 * down.
 */
import type { CommittedSegment } from './clamp';
import type { ChunkStatus } from './checkpoint';

/** One row of `transcript_chunks`, with the member names of the Core's typed schema. */
export interface ChunkMirrorRow {
  readonly sessionId: string;
  readonly seq: number;
  readonly audioFromMs: number;
  readonly audioToMs: number;
  readonly status: ChunkStatus;
  readonly segments: readonly CommittedSegment[] | null;
  /** The diarization artifact reference (row 78). This row never sets it. */
  readonly embeddingRef: string | null;
  readonly modelId: string | null;
  readonly computedAt: number | null;
}

/** The five columns the runtime role may update. */
export type ChunkMirrorPatch = Pick<ChunkMirrorRow, 'status' | 'segments' | 'modelId' | 'computedAt'>;

/** What the runner reads back of a row: which attempt it is and how far it got. Never its segments. */
export type ChunkMirrorState = Pick<ChunkMirrorRow, 'seq' | 'status' | 'computedAt'>;

export interface ChunkMirror {
  /** Inserts the rows that do not exist yet (by `sessionId, seq`); an existing row is left as it is. */
  insertMissing(rows: readonly ChunkMirrorRow[]): Promise<void>;
  update(sessionId: string, seq: number, patch: ChunkMirrorPatch): Promise<void>;
  read(sessionId: string): Promise<readonly ChunkMirrorState[]>;
}

const SESSION_ID = /^SES-[0-9]{8}-[0-9]{4}$/;
const CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
const CODE_MAX = 64;

/**
 * The `CODE` form of a model identifier, for `transcript_chunks.model_id` (the column is checked
 * `^[A-Z][A-Z0-9_]{0,63}$`, dbc-3 §B.7, while `stt_config.model` is a free identifier):
 * upper case, every other character an underscore, a letter first, 64 characters at most. It is a
 * LABEL of the model family in the working rows; the exact identifier is in the checkpoint file
 * and, once row 78 seals a transcript, in `transcripts`.
 */
export function toModelCode(modelId: string): string {
  const body = modelId.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return (/^[A-Z]/.test(body) ? body : `M_${body}`).slice(0, CODE_MAX);
}

/** What the CHECK constraints of `transcript_chunks` refuse, by constraint name; null when the row is acceptable. */
export function tableRefusal(row: ChunkMirrorRow): string | null {
  if (!SESSION_ID.test(row.sessionId)) return 'transcript_chunks_session_check';
  if (!Number.isInteger(row.seq) || row.seq < 1) return 'transcript_chunks_seq_check';
  if (!Number.isInteger(row.audioFromMs) || !Number.isInteger(row.audioToMs) || row.audioFromMs < 0 || row.audioToMs <= row.audioFromMs) return 'transcript_chunks_audio_check';
  if (!['PENDING', 'RUNNING', 'DONE', 'FAILED'].includes(row.status)) return 'transcript_chunks_status_check';
  if (row.segments !== null && !Array.isArray(row.segments)) return 'transcript_chunks_segments_check';
  if (row.status === 'DONE' && (row.segments === null || row.computedAt === null)) return 'transcript_chunks_done_check';
  if ((row.embeddingRef !== null && !CODE.test(row.embeddingRef)) || (row.modelId !== null && !CODE.test(row.modelId))) return 'transcript_chunks_ref_check';
  return null;
}

export interface MemoryChunkMirror extends ChunkMirror {
  read(sessionId: string): Promise<ChunkMirrorRow[]>;
  /** Every row, in the order of `sessionId, seq`. */
  rows(): ChunkMirrorRow[];
  /** Every write that reached the mirror, in order: `insert <seq>` or `update <seq> <status>`. */
  readonly writes: string[];
  /** Makes the next `count` writes fail, as a database that cannot be reached does. */
  failNext(count: number): void;
}

export function createMemoryChunkMirror(): MemoryChunkMirror {
  const table = new Map<string, ChunkMirrorRow>();
  const writes: string[] = [];
  let failing = 0;
  const key = (sessionId: string, seq: number): string => `${sessionId}#${seq}`;
  const guard = (): void => {
    if (failing > 0) {
      failing -= 1;
      throw new Error('the mirror cannot be reached');
    }
  };
  const check = (row: ChunkMirrorRow): void => {
    const refusal = tableRefusal(row);
    if (refusal !== null) throw Object.assign(new Error(`new row violates check constraint "${refusal}"`), { code: '23514', constraint: refusal });
  };
  const rows = (): ChunkMirrorRow[] => [...table.values()].sort((a, b) => a.sessionId.localeCompare(b.sessionId) || a.seq - b.seq);

  return {
    writes,
    rows,
    failNext(count) {
      failing = count;
    },
    async insertMissing(incoming) {
      guard();
      for (const row of incoming) {
        if (table.has(key(row.sessionId, row.seq))) continue;
        check(row);
        table.set(key(row.sessionId, row.seq), structuredClone(row));
        writes.push(`insert ${row.seq}`);
      }
    },
    async update(sessionId, seq, patch) {
      guard();
      const current = table.get(key(sessionId, seq));
      if (current === undefined) throw new Error('no such row');
      const next = { ...current, ...structuredClone(patch) };
      check(next);
      table.set(key(sessionId, seq), next);
      writes.push(`update ${seq} ${patch.status}`);
    },
    async read(sessionId) {
      guard();
      return rows().filter((row) => row.sessionId === sessionId);
    },
  };
}
