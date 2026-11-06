---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 191b
date: 2026-10-13
agent: coder-execution (wave 11, agent A3)
tier: T3
builds_on: implementation/191_mic_restart_per_attempt.md; implementation/v3_third_contract_step.md (the audit type); decisions C57, C60 (2), C63 (e)
status: complete on the generated microphones (six driver decisions to confirm, section 8; two named remainders and one text request, section 7)
---

# Row 191b: the audio gap of a worker restart is a fact of the evidence

Tier 3: what was built, where, and the output that shows it. Paths are relative to `/Users/gsp-budi/Documents/DEMS`; `CS` = `apps/core-server`. No microphone and no camera of this Mac was opened: every source is a double or a generated fixture.

## 1. Result

| Point of the row | Before (row 191) | After |
|---|---|---|
| (1) audit row | none; error log only | ONE `CAPTURE_AUDIO_ABSENT_ON_RESTART` per later worker that reported audio (DEVICE, WARNING, actor null), in one engine unit with the interval rows |
| (2) interval rows | one row, the earlier worker's, open | the earlier row CLOSED at the instant its worker went down; the later worker's a NEW row (next number, reason START) |
| (3) loss watch | `superseded` built by row 85c, no test at the supervisor | verified against the timings; one supervisor case added; nothing rebuilt |
| (4) sealed manifest | one interval `START 21..8591` - reads as one unbroken source | two intervals of reason START: `0..0`, then `21..8671`; the extract holds the gap row |

## 2. What was built

| File | Change |
|---|---|
| `CS/src/capture-session/statements.ts` | NEW statement `CLOSE_SUPERSEDED_AUDIO_INTERVAL`: `UPDATE ... SET to_media_ms = from_media_ms, to_at = $2 WHERE session_id = $1 AND to_media_ms IS NULL RETURNING seq` |
| `CS/src/capture-session/index.ts` | `recordAudioGap` (one engine unit `captureSession.audioAbsentOnRestart`: close, INSERT, `scope.unit.audit.append`); `sayAudioGap` returns what it measured; `intervalSeqOf` and three `Live` members (`intervalSeqBase`, `intervalSeqTop`, `intervalWrites`); `writeInterval` and `recordSwitch` store under the session's number, not the worker's |
| `CS/src/sealing-host/session-reader.ts` | the ONE read of the interval rows: every row before the LAST row of reason START is stated `0..0`; the statement `READ_SEAL_AUDIO_INTERVALS` is unchanged |
| `CS/src/capture/supervisor.ts` | NOT changed (point (3) needed no line) |

**The table's constraints do not forbid the second row.** `session_audio_intervals_pkey (session_id, seq)`: the later row takes the next number. `session_audio_intervals_one_open_key` (unique on `session_id` where `to_media_ms IS NULL`, `0004_capture.sql:211`): the earlier row must be closed FIRST. `session_audio_intervals_media_check` (`to_media_ms >= from_media_ms`): the earliest close the table admits is where the row began. The close writes the two columns the runtime role may already update (`0005_capture_privileges.sql:47`), each once. NO GRANT WAS ADDED and no row is rewritten or removed.

**Why the number is the session's.** Every worker numbers its interval records from 1 (row 191's stored row stayed the earlier worker's because the later record 1 met `ON CONFLICT DO NOTHING`). Stored number = `intervalSeqBase + index`; the base moves to the highest number used when a later worker first reports audio. Without it a switch of the later worker (its record 2) would have collided with the later START row.

**`from_at` of the later row.** The instant a worker states for its first sample is computed back from the samples it holds: 108 ms BEFORE the earlier worker went down in the run below (184 to 223 ms in row 191). No row may state that. The stored instant is the worker's word held between the Core's two bounds: not before the microphones were started again, not after its record arrived.

## 3. What is stored (run `r191b-s1`, kill after `STARTED`)

```
session_audio_intervals
 seq 1  MIC-01 PRIMARY START  from_media_ms 21  to_media_ms 21    from_at ...883995  to_at ...886153
 seq 2  MIC-01 PRIMARY START  from_media_ms 21  to_media_ms 8671  from_at ...886489  to_at ...894777
        between them: 886489 - 886153 = 336 ms

audit_log  seq 89  CAPTURE_AUDIO_ABSENT_ON_RESTART  DEVICE  WARNING  actor null  device MIC-01  session SES-20261013-0024
 message  Audio was not recorded while the capture worker was replaced (attempt 1 to 2; microphones: MIC-01 PRIMARY, MIC-02 STANDBY)
 details  sessionId, earlierAttempt 1, laterAttempt 2, audioAbsentAtLeastMs 336, audioAbsentAtMostMs 715
```

The microphones are in the row's `device_id` (the one the later worker's audio begins with) and in the message (all of the session, with roles): the detail list of the type is closed and holds no device (V3, DD-6). Both bounds are stated whenever they were measured; a bound whose instant is unknown, or above one day, is left out.

## 4. THE CHECK THAT MATTERS: what the sealed package states

How the seal derives its audio statements: `sealing-host/session-reader.ts` reads ALL interval rows (`READ_SEAL_AUDIO_INTERVALS`, `ORDER BY seq`) and all audit rows of the session (`READ_SEAL_AUDIT_ROWS`, `WHERE session_id = $1`); `sealing/pipeline/pipeline.ts:703` closes the last open interval at the media end. It did NOT read only the first row. Read from the files of the sealed package of run `r191b-s1`:

| File | Member | Value |
|---|---|---|
| `session-manifest.json` (signed) | `audio.sourceIntervals[0]` | `seq` 1, `reason` START, `fromMs` 0, `toMs` 0 |
| | `audio.sourceIntervals[1]` | `seq` 2, `reason` START, `fromMs` 21, `toMs` 8671 |
| | `timeline.startedAt` / `stoppedAt` / `recordingDurationMs` / `interrupted` | the session's start / the stop / 10,405 / false |
| | `tracks[].durationMs` | 8,718 and 8,722 |
| `audit-session-extract.jsonl` (NOT signed, known limit 7) | row of `type` `CAPTURE_AUDIO_ABSENT_ON_RESTART` | `details.earlierAttempt` 1, `details.laterAttempt` 2, `details.audioAbsentAtLeastMs` 336, `details.audioAbsentAtMostMs` 715, `deviceId` MIC-01, with its `prevHash` and `hash` |

So: the signed manifest no longer shows one unbroken source - the audio source began twice and the first span is empty; the gap in milliseconds is in the extract.

**Two findings, returned and not fixed (section 7).** (a) The manifest has NO member for a wall instant of an interval or for the gap, and its `timeline` is the session's: `recordingDurationMs` 10,405 against files of 8,718 / 8,722 ms. (b) The numbers of the gap are only in the unsigned extract.

**Why the read was changed (one place, `session-reader.ts`, the map after `READ_SEAL_AUDIO_INTERVALS`).** The manifest's own rule refuses an interval that starts before the previous one ended (`manifest.ts:349`). Stated as stored, a later worker whose audio begins earlier in its file than the earlier worker's did (31 against 42 ms, the case of the session suite) would make the seal refuse its own manifest; in the measured runs both were 21 and it would have passed by coincidence. The earlier worker's rows count in a file that does not exist, and fields 58 / 59 are FILE time of the sealed file: `0..0` claims no part of it.

## 5. Point (3): the loss watch and a superseded attempt

Row 85c answers `superseded` from the supervisor's phase `RESTARTING` (`capture-composition.ts:517`). Read in `supervisor.ts:771`: the phase is set in the same step that records the down, and is left only at the later worker's acknowledgement (`:865`); `awaitSources` holds it while the session closes and opens. Row 191's third request line: the session's close began 12 to 19 ms after the worker went down, the helper ended 33 to 46 ms after (56 ms in the run here); the later worker acknowledged at 287 to 362 ms. COVERED. The missing test is added: `RESTARTING` in the turn of the exit, at 12, 19, 33, 46 ms, to the end of the back-off and 16 s beyond it while the sources are waited for, not before the down and not after the acknowledgement.

Two edges, stated and not built (no line requested in `mic-loss.ts`): a word that arrives BEFORE the supervisor has seen the exit is of an attempt still in force - raised, then cleared by the watch itself (C60 (2)); not seen in any run. A worker that dies BEFORE its `START` was acknowledged leaves `STARTING`, where `superseded` is false: no handle was started then.

## 6. Checks

From `CS`, `--maxWorkers=2`; database and process runs with the command sandbox off under their locks.

| Check | Result line |
|---|---|
| `npx tsc --noEmit` (after the last edit) | no error line |
| `vitest run --project unit src/capture/__tests__/supervisor.test.ts src/sealing-host/__tests__/sealing-host.test.ts src/capture-session/__tests__` | `Test Files  5 passed (5)`, `Tests  144 passed (144)` |
| `vitest run --project db src/capture-session/__tests__/session-capture.db.test.ts` (db-migrate lock) | run 1: `1 failed | 93 passed (94)` - MY new case (it stopped a session that held nothing durable); run 2: `Tests  94 passed (94)`, `0 remain` |
| `ROW191B=1 sh .cache/task4-row191/run.sh settled r191b-s1` (both locks, one hold) | `Tests  1 passed (1)`, `0 remain` |
| static rule files: `static.test.ts`, `src/capture/__tests__/static.test.ts`, `src/core/__tests__/static.test.ts`, `src/sealing-host/__tests__`, `src/engine/__tests__/static`, with `mic-loss.test.ts` and `capture-composition.test.ts` | `Tests  4 failed | 774 passed (778)` - the four are NOT this row's (below) |

New cases, each in the file of its subject: session suite 92 -> 94 (two new; the gap case of row 191 extended); `supervisor.test.ts` +1; `sealing-host.test.ts` +3.

**One existing result line changed, the direct consequence:** the last assertion of row 191's gap case ("the stored interval row is still the EARLIER worker's") is now the two rows and the audit row; its title says so.

**Reds seen, not mine, files not edited:** `src/capture/__tests__/static.test.ts` SR-2 (the third destination; rows 143b / 143c, C63) and P25 `index.ts` (the entry point; composition rows); `src/credential-store/__tests__/static.test.ts:89` (importer list; rows 85b / 85c); `src/modules/capture-config/__tests__/static.test.ts:175` (`src/capture/host-alias/journal.ts`, `lifecycle.ts`; row 106, agent A1, in flight).

**THE SEAL, as a fact: `SEALED` 1 of 1** - six steps `DONE` at attempt 1, `SEALING_COMPLETE`, no `WRITE_FAILED`, no retry. This is an operator-stopped session restarted before anything was durable; the INTERRUPTED path of row 184 was not run and nothing of it was touched. File audio: 7.49 s, 74 of 74 windows with sound, both files. After the run: no process named by the session, no worker, `leftoverHelpers` and `openSources` empty, no pipe; secret scan of the result file `TOTAL: 0 in 0 file(s)`.

The scenario is row 191's instrument REUSED IN PLACE (`.cache/task4-row191/restart.db.test.ts`): one block that reads the audit rows and the package files, one block of assertions that runs only under `ROW191B=1`.

## 7. Not built, not proven

| What | Where it goes |
|---|---|
| The manifest's timeline of a restarted session, and a signed member for the gap | NAMED REMAINDER, request line 1 (`pipeline.ts:702`, `:717`, `:720`; the manifest schema) |
| A switch before a restart, in the transcript (`transcription/index.ts:244` reads the rows as stored) | NAMED REMAINDER, request line 2 |
| README known limit 7 names the restart gap | text request, line 3 |
| A switch BEFORE a restart end to end | the seal's read is tested on rows; the session side closes whatever row is open; no scenario |
| The unit of the gap failing twice (rows written apart, audit row missing, `CAPTURE_AUDIO_GAP_NOT_AUDITED`) | built as `recordSwitch` does it; not driven by a test |
| Three workers in one session | the code takes the LAST earlier attempt with audio; one restart tested |
| `REAL_PRODUCTION` with real cards | `9A/H-07`, `H-08` |

Row 191's request lines 1 and 2 are SERVED by this row (line 1 without the grant it asked for); line 3 by row 85c and section 5.

## 8. Driver decisions (for the controller)

1. **The earlier row is closed by the existing UPDATE grant**, at `to_media_ms = from_media_ms`. "No UPDATE grant is added" is kept; the row is not INSERT-only in the letter: its two closing columns are written, once, as at every switch and stop.
2. **`from_at` of the later row is held between the two bounds** (section 2), not the worker's bare word.
3. **The seal states superseded rows as `0..0`** (section 4). The alternative - leave the read alone - makes a seal refuse its own manifest whenever the later audio begins earlier in its file.
4. **The microphones are in `device_id` and the message**, not in the details (closed list).
5. **A gap row is written also when the earlier worker never reported audio** (`earlierAttempt` = the attempt before): the restart still delayed the audio.
6. **The stored number of an interval is the session's** (`intervalSeqBase + index`), for switches too.

## 9. Rules kept

Edit tool only for every existing file (three product files, three test files, row 191's scenario file, two shared documents); new files with Write (this record, `row_191b.md`). Nothing committed, staged or reverted; no full suite; no type, pin or shared-package file touched; `mic-loss.ts`, `capture/signer`, `boot/index.ts` not touched. Heavy-host lock for the one scenario run, db-migrate lock for every database run; throw-away databases only (`0 remain`); worker listeners 127.0.0.1:8559 / 8561; nothing under `apps/capture-worker` built; no `.env` read; no real device.

---
*Generated: 2026-10-13*
