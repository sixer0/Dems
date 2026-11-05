/**
 * The statements of the capture-session unit (blueprint row 71; database contract `dbc-4` §N.3
 * rules MR-S1, MR-S6, and dbc-3 §B.5 with its privileges, migrations 0005 and 0009).
 *
 * Every statement is a constant text with bind parameters; no value is ever part of a statement
 * text (SR-67). Every table is named with its schema.
 *
 * WHAT THE RUNTIME ROLE MAY DO HERE.
 *   `session_capture_sources`   SELECT and INSERT; no UPDATE, no DELETE (0009): the eight rows of a
 *                               session (D60 / D61, 2026-11-04) are written once.
 *   `session_audio_intervals`   SELECT, INSERT, and UPDATE of `to_media_ms`, `to_at` only (0005):
 *                               an interval is opened by an INSERT and closed by that one UPDATE.
 */

/**
 * MR-S1: the EIGHT source rows of a session IN ONE STATEMENT (D60, 2026-11-04: six rows, was four;
 * D61, 2026-11-04: eight — the four video tracks `VIDEO-01`..`VIDEO-04` and the four numbered
 * microphone channels `MIC-01`..`MIC-04; `SOURCE_ROWS_PER_SESSION` = 8). Parameters: the session
 * ID, the instant, then (slot, device ID, adapter kind, source facts) EIGHT times, so `$3`..`$34`.
 * The caller in `recordingStartedIn` flattens `buildSessionCaptureSources` in exactly that order;
 * the four-tuple text of the two-track era bound 18 parameters and the eight-row call died with
 * SQLSTATE 08P01 (`bind message supplies 34 parameters, but prepared statement requires 18`).
 * A session that already has a row is a primary-key violation: the unit that persists RECORDING
 * fails and nothing is stored.
 *
 * The source facts (task 4 row 71; schema v7) are the text of a flat JSON map, `{}` for a slot
 * that states none. They are written HERE and never again: the runtime role has no UPDATE on the
 * table (0009) and `0016` pins `REVOKE UPDATE (source_facts)`.
 */
export const INSERT_SESSION_CAPTURE_SOURCES = `INSERT INTO public.session_capture_sources (session_id, slot, device_id, adapter_kind, recorded_at, source_facts)
VALUES ($1::text, $3::text, $4::text, $5::text, $2::bigint, $6::jsonb),
       ($1::text, $7::text, $8::text, $9::text, $2::bigint, $10::jsonb),
       ($1::text, $11::text, $12::text, $13::text, $2::bigint, $14::jsonb),
       ($1::text, $15::text, $16::text, $17::text, $2::bigint, $18::jsonb),
       ($1::text, $19::text, $20::text, $21::text, $2::bigint, $22::jsonb),
       ($1::text, $23::text, $24::text, $25::text, $2::bigint, $26::jsonb),
       ($1::text, $27::text, $28::text, $29::text, $2::bigint, $30::jsonb),
       ($1::text, $31::text, $32::text, $33::text, $2::bigint, $34::jsonb)`;

/** MR-S6: the rows a session start wrote, read back in the same transaction. */
export const READ_SESSION_CAPTURE_SOURCES = 'SELECT slot, device_id, adapter_kind FROM public.session_capture_sources WHERE session_id = $1 ORDER BY slot';

/**
 * Opens interval `seq` of a session. Parameters: session, seq, microphone device, role, media ms,
 * instant, the operator who switched (null for the interval of the start), reason. A row that is
 * stored already under that number is left as it is (a replayed record never rewrites an interval).
 */
export const INSERT_AUDIO_INTERVAL = `INSERT INTO public.session_audio_intervals (session_id, seq, mic_device_id, role, from_media_ms, from_at, switched_by, reason)
VALUES ($1::text, $2::integer, $3::text, $4::text, $5::bigint, $6::bigint, $7::text, $8::text)
ON CONFLICT (session_id, seq) DO NOTHING`;

/**
 * Closes the open interval of a session at a media time. Parameters: session, media ms, instant.
 * Only a row that is open and begins at or before that time is closed; the two columns are the
 * only ones the runtime role may update. Returns where the closed interval began, in media ms.
 */
export const CLOSE_OPEN_AUDIO_INTERVAL = `UPDATE public.session_audio_intervals SET to_media_ms = $2::bigint, to_at = $3::bigint
WHERE session_id = $1::text AND to_media_ms IS NULL AND from_media_ms <= $2::bigint
RETURNING from_media_ms`;

/**
 * Task 4 row 191b (decision C57): THE EARLIER WORKER'S END. The capture worker of a session was
 * replaced while nothing was durable; no file holds anything of the worker that went down. The
 * interval that was open is closed WHERE IT BEGAN in media time (`to_media_ms = from_media_ms`:
 * none of it is in any file - the least the table's `media_check` admits) and at the instant the
 * earlier worker went down (`to_at`, the Core's clock). Parameters: session, that instant.
 *
 * NO NEW GRANT: these are the two columns the runtime role may update (0005), and each is written
 * once - only a row that is still open is touched. The later worker's interval is then stated by
 * a NEW row (`INSERT_AUDIO_INTERVAL`, the next number, reason START): the table's one-open index
 * (`session_audio_intervals_one_open_key`) admits it only after this close. The gap of the audio
 * is what the two rows state between them: `to_at` of this row, `from_at` of the next.
 */
export const CLOSE_SUPERSEDED_AUDIO_INTERVAL = `UPDATE public.session_audio_intervals SET to_media_ms = from_media_ms, to_at = $2::bigint
WHERE session_id = $1::text AND to_media_ms IS NULL
RETURNING seq`;

/** The reasons an interval row is opened with (`session_audio_intervals_reason_check`). */
export const AudioIntervalRowReason = { START: 'START', MANUAL: 'MANUAL' } as const;
