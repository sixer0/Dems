/**
 * THE STT CONFIGURATION OF A SESSION, AS IT WAS AT ITS START (blueprint row 115; R-8 AC-4;
 * transcript spec §B.4, §B.7; C3 §2.5 "When a change applies"; check `M6-STTCFG-NEXT`).
 *
 * One snapshot per session, WRITE-ONCE: the first one taken is the session's for good. Everything
 * the transcriber does for the session reads the snapshot - never the stored row - so a change
 * saved while the session is open (operation 91, `appliesFrom: NEXT_SESSION`) cannot reach its
 * chunks, its checkpoints or its document.
 *
 * NO CREDENTIAL AND NO REFERENCE: a snapshot says how a credential was HELD (`credentialKind`),
 * never the reference target or the key (E-31; manifest field 123 carries five of these members).
 *
 * THE STORE IS A PORT. The durable implementation is `createDatabaseSnapshotStore` (table
 * `session_stt_config`, dbc-6, migrations 0011 and 0012; statements in `statements.ts`): INSERT
 * only for the runtime role, `ON CONFLICT (session_id) DO NOTHING`, then a SELECT, so that
 * "put then get returns the FIRST snapshot, always", also for two puts at once, and a Core that is
 * restarted inside an open session still finds the snapshot of that session. A store that fails
 * (a refusal of the table's CHECKs, `23514`, included) THROWS: the composition then answers "no
 * snapshot" and the session transcribes nothing - it never falls back to the configuration as it
 * is now. `createMemorySnapshotStore` stays for the tests that pass one explicitly; the mount
 * never chooses it.
 */
import type { SttBackend, SttCredentialKind } from '@dems/shared/api';
import { insertSnapshot, readSnapshot, type Queryable } from './statements';

/** The members of the stored row a snapshot is taken from. No credential column is among them. */
export interface StoredSttSelection {
  readonly enabled: boolean;
  readonly backend: SttBackend;
  readonly endpoint: string | null;
  readonly model: string;
  readonly language: string;
  readonly diarization: boolean;
  readonly credentialKind: SttCredentialKind | null;
  readonly revision: number;
}

export interface SttSessionSnapshot extends StoredSttSelection {
  readonly sessionId: string;
  /** The Core instant the snapshot was taken (epoch milliseconds). */
  readonly takenAt: number;
}

/** Manifest field 123 (`transcript.configSnapshot`; ev §B.7a): what the seal records of the snapshot. */
export interface ManifestSttSnapshot {
  readonly enabled: boolean;
  readonly backend: SttBackend;
  readonly model: string;
  readonly diarization: boolean;
  readonly revision: number;
}

export function manifestSnapshotOf(snapshot: SttSessionSnapshot): ManifestSttSnapshot {
  return { enabled: snapshot.enabled, backend: snapshot.backend, model: snapshot.model, diarization: snapshot.diarization, revision: snapshot.revision };
}

export interface SttSnapshotStore {
  /** Stores the snapshot when the session has none. Returns what the session HOLDS: the first one, always. */
  put(snapshot: SttSessionSnapshot): Promise<SttSessionSnapshot>;
  get(sessionId: string): Promise<SttSessionSnapshot | null>;
}

/**
 * THE DURABLE STORE. Write-once by statement (no UPDATE, no DELETE exists) and by privilege (the
 * runtime role has neither). `put` inserts and reads back: what it returns is what the table
 * HOLDS, which is the first snapshot of the session whoever put it. Any failure is thrown.
 */
export function createDatabaseSnapshotStore(db: Queryable): SttSnapshotStore {
  return {
    async put(snapshot) {
      await insertSnapshot(db, snapshot);
      const held = await readSnapshot(db, snapshot.sessionId);
      // Not reachable unless the row was removed by the owner between the two statements.
      if (held === null) throw new Error('the snapshot was stored but cannot be read back');
      return held;
    },
    get: (sessionId) => readSnapshot(db, sessionId),
  };
}

/** How many sessions the stand-in remembers: the open one and a few sealed after it. */
export const MEMORY_SNAPSHOT_SESSIONS = 8;

/** THE STAND-IN for tests (see the file head). Write-once per session, bounded, lost with the process. */
export function createMemorySnapshotStore(): SttSnapshotStore {
  const held = new Map<string, SttSessionSnapshot>();
  return {
    async put(snapshot) {
      const known = held.get(snapshot.sessionId);
      if (known !== undefined) return known;
      const frozen = Object.freeze({ ...snapshot });
      held.set(snapshot.sessionId, frozen);
      while (held.size > MEMORY_SNAPSHOT_SESSIONS) {
        const oldest = held.keys().next().value;
        if (oldest === undefined) break;
        held.delete(oldest);
      }
      return frozen;
    },
    async get(sessionId) {
      return held.get(sessionId) ?? null;
    },
  };
}
