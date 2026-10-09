/**
 * An operator session that EXPIRES frees its candidate list at once (integration pass C1,
 * decision D120; row 132's open item; C3 §3.1 "signOut and session expiry"; R-9 AC-4).
 *
 * A sign-out is a request of the session itself: the plugin's `onResponse` hook discards its list
 * with the answer. An expiry is not a request: the identity unit ends the session in a unit of the
 * pipeline (the sweeper every 5 s, or stage 4 for a request that arrives past a limit) and writes
 * one `AUTH_EXPIRED` row. That row names the operator, not the session, so this watch does not
 * guess: after every commit that holds such a row it ASKS the session table which of the sessions
 * that still own something here (a list, or starts in the limiter) have ended, and discards those.
 * A session of the same operator that is still open keeps its list.
 *
 * One read, of identifiers only; nothing is written. A read that fails is logged and persisted and
 * changes nothing: the list then goes at its own `expiresAt`, as before this watch existed.
 */
import { AuditType } from '@dems/shared/sim';

/** Which of the given auth sessions have ended. A read; the ids are compared as text. */
export const READ_ENDED_SESSIONS = 'SELECT id::text AS id FROM public.auth_sessions WHERE id::text = ANY($1::text[]) AND ended_at IS NOT NULL';

export interface EndedSessionReader {
  query(text: string, values: readonly unknown[]): Promise<{ rows: Array<{ id: unknown }> }>;
}

export async function readEndedSessions(reader: EndedSessionReader, sessionIds: readonly string[]): Promise<string[]> {
  if (sessionIds.length === 0) return [];
  const { rows } = await reader.query(READ_ENDED_SESSIONS, [sessionIds]);
  const asked = new Set(sessionIds);
  // Only an id that was asked for is ever handed on: the answer cannot name another session.
  return rows.flatMap((row) => (typeof row.id === 'string' && asked.has(row.id) ? [row.id] : []));
}

export interface SessionExpiryWatchOptions {
  /** The sessions that own something in this module now. */
  readonly ownerSessions: () => readonly string[];
  /** Which of them have ended (the table's answer). */
  readonly endedAmong: (sessionIds: readonly string[]) => Promise<readonly string[]>;
  readonly discard: (sessionId: string) => void;
  /** A failed read: `code` and identifiers only. */
  readonly failed: (error: unknown) => void;
}

export interface SessionExpiryWatch {
  /** For `pipeline.onCommit`: looks at the audit rows of the unit that committed. Never throws. */
  committed(unit: { readonly auditRows: readonly { readonly type: string }[] }): void;
  /** Resolves when every check a commit started has ended. */
  settled(): Promise<void>;
  /** Checks that ran to their end, and sessions they discarded: for the tests. */
  stats(): { readonly checks: number; readonly discarded: number };
}

export function createSessionExpiryWatch(options: SessionExpiryWatchOptions): SessionExpiryWatch {
  let chain: Promise<void> = Promise.resolve();
  let checks = 0;
  let discarded = 0;

  const check = async (): Promise<void> => {
    const owners = [...options.ownerSessions()];
    if (owners.length === 0) return;
    try {
      const ended = await options.endedAmong(owners);
      for (const sessionId of ended) {
        options.discard(sessionId);
        discarded += 1;
      }
      checks += 1;
    } catch (error) {
      options.failed(error);
    }
  };

  return {
    committed(unit) {
      if (!unit.auditRows.some((row) => row.type === AuditType.AUTH_EXPIRED)) return;
      // One after the other, in commit order: a check never overlaps the one before it.
      chain = chain.then(check);
    },
    settled: () => chain,
    stats: () => ({ checks, discarded }),
  };
}
