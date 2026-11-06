# Row 191b - the audio gap of a worker restart in the evidence (wave 11, agent A3)

Status: **complete** on the generated microphones. Record: `implementation/191b_audio_gap_in_evidence.md`.

- Built: `capture-session/statements.ts` (`CLOSE_SUPERSEDED_AUDIO_INTERVAL`), `capture-session/index.ts` (`recordAudioGap`: close + new INSERT + audit row in one engine unit; the session's own interval numbers), `sealing-host/session-reader.ts` (rows before the last START row are stated 0..0). `supervisor.ts` not changed.
- Constraints: a second row is admitted once the earlier one is closed (`session_audio_intervals_one_open_key`); closed with the existing grant on `to_media_ms`, `to_at`. No grant added.
- Tests: session suite 94 of 94 (2 new, 1 extended; second run after a failure of my own new case); unit 144 of 144 (supervisor +1, seal reader +3); typecheck clean; scenario `r191b-s1` 1 of 1.
- Seal: `SEALED` 1 of 1, six steps DONE at attempt 1, no `WRITE_FAILED` (operator-stopped session; the INTERRUPTED path not run).
- Manifest: two `audio.sourceIntervals` of reason START (0..0, then 21..8671). Extract: one `CAPTURE_AUDIO_ABSENT_ON_RESTART` row with both bounds (336 / 715 ms).
- Named remainders (`file_requests.md`, three lines `row 191b (agent A3)`): the manifest's timeline of a restarted session and a signed member for the gap; the transcript's read of superseded rows; README limit 7 text.
- Reds not mine: capture static SR-2 and P25 `index.ts`; `credential-store/__tests__/static.test.ts:89`; `modules/capture-config/__tests__/static.test.ts:175`.
- Driver decisions: six, section 8 of the record.
- Edit tool only for existing files; new files with Write.
