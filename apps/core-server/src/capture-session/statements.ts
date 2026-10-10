/**
 * The statements of the capture-session unit (blueprint row 71; database contract `dbc-4` §N.3
 * rules MR-S1, MR-S6, and dbc-3 §B.5 with its privileges, migrations 0005 and 0009).
 *
 * Every statement is a constant text with bind parameters; no value is ever part of a statement
 * text (SR-67). Every table is named with its schema.
 *
 * WHAT THE RUNTIME ROLE MAY DO HERE.
 *   `session_capture_sources`   SELECT and INSERT; no UPDATE, no DELETE (0009): the four rows of a
 *                               session are written once.
 *   `session_audio_intervals`   SELECT, INSERT, and UPDATE of `to_media_ms`, `to_at` only (0005):
 *                               an interval is opened by an INSERT and closed by that one UPDATE.
 */

/**
 * MR-S1: the four source rows of a session IN ONE STATEMENT. Parameters: the session ID, the
 * instant, then (slot, device ID, adapter kind) four times. A session that already has a row is a
 * primary-key violation: the unit that persists RECORDING fails and nothing is stored.
 */
export const INSERT_SESSION_CAPTURE_SOURCES = `INSERT INTO public.session_capture_sources (session_id, slot, device_id, adapter_kind, recorded_at)
VALUES ($1::text, $3::text, $4::text, $5::text, $2::bigint),
       ($1::text, $6::text, $7::text, $8::text, $2::bigint),
       ($1::text, $9::text, $10::text, $11::text, $2::bigint),
       ($1::text, $12::text, $13::text, $14::text, $2::bigint)`;

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

/** The reasons an interval row is opened with (`session_audio_intervals_reason_check`). */
export const AudioIntervalRowReason = { START: 'START', MANUAL: 'MANUAL' } as const;
