/**
 * The `SESSION_HOLDER` fact of stage 6 (task 3 M2-W7; blueprint row 48; SEC35-18; D4 OD-09;
 * `C3 §0/§2.2`).
 *
 * One read of the open session's creator: `active_session.created_by` - the column the mapping
 * writes from `session.createdBy`, the operator whose `createSession` opened the session (C3 §2.2:
 * "the operator who created the open session, or any SUPERVISOR"). NOT `started_by` (`dbc-3
 * §B.10`): that column names who started the RECORDING, the state has no member for it and the
 * mapping stores it NULL - read from it (as this file did until pass D6, finding F-D4-3) the
 * condition held for a SUPERVISOR only. The guard asks for the fact ONLY for a rule that carries
 * the `SESSION_HOLDER` condition, so no other request pays for it and no other table is touched.
 * The decision itself is pure (`decision.ts`): this module only fetches the fact.
 *
 * The read runs on the pool outside any unit of work: it is a read, and the decision it feeds is
 * made before the handler opens its unit. A Core with no open session answers null, and the
 * condition then holds for a SUPERVISOR only (C3 §2.2) — an operation whose rule carries the
 * condition answers its own 404/409 for "not the open session" after stage 6 lets a SUPERVISOR in.
 */
/** The creator of the open session, or null when none is open. One statement, on the pool. */
export const READ_OPEN_SESSION_CREATOR = 'SELECT created_by FROM public.active_session LIMIT 1';

/** What the read needs of its reader (the pool plugin's pool satisfies it; same shape as `MatrixReader`). */
export interface CreatorReader {
  query<T extends Record<string, unknown>>(text: string): Promise<{ rows: T[] }>;
}

/** The operator ID that created the open session, or null. `created_by` is nullable by schema. */
export async function readOpenSessionCreatorId(reader: CreatorReader): Promise<string | null> {
  const { rows } = await reader.query<{ created_by: string | null }>(READ_OPEN_SESSION_CREATOR);
  const value = rows[0]?.['created_by'];
  return typeof value === 'string' ? value : null;
}
