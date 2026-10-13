---
task_slug: input_av_core_adapter_plan
row: 184
work_package: WP-08 (finding of row 179)
date: 2026-10-13
agent: test-expert (batch 8, agent H)
status: complete - measured on development sources; the rule for row 191 is DRAFTED, not implemented; row 191 named "runs" (condition: the controller's ruling of section 7)
tier: T2
---

# Row 184: the microphones of a session when its capture worker is replaced

Tier 2: what was found, why it matters, how it was verified, source. A measurement: no product file was changed, nothing was built, nothing of row 191 is implemented. No microphone and no camera of this Mac was opened: every source is generated (`lavfi`) or a committed fixture.

## 1. Answer

| Question | Fact | Runs |
|---|---|---|
| Are the microphone helpers kept, restarted or orphaned | **Neither kept nor restarted nor orphaned: they end by themselves.** Each helper ended 20 to 56 ms after the worker's SIGKILL (its pipe lost its reader; exit status 224 where it was collected). Helpers alive before the kill: 2; 2 s after: 0; when the later worker listened: 0; at the end: 0. Nothing starts them again | 16 of 16 kills (10 session runs, 6 supervisor-level runs) |
| Are the named pipes kept | **Yes**: both pipes are still named pipes at the same path while the later worker runs; they are removed when the capture ends | 6 of 6 session runs with a later worker; 6 of 6 supervisor-level runs |
| Is the worker replaced at all | **Only while the session holds no durable fragment.** Killed before the first durable fragment: a later worker (attempt 2) listens 279 to 296 ms after the kill (back-off 250 ms). Killed 3 s after the first durable fragment ("mid recording" in the everyday sense): **no later worker**; the supervisor goes `FAULTED`, the session is `INTERRUPTED` and its durable prefix is sealed (`supervisor.ts:728`, header lines 31-34) | 6 of 6 before durable; 4 of 4 after durable |
| Does the later worker receive audio | **No. 0 samples from either microphone.** Level frames of the later worker per microphone: 246 frames, 0 with a level, in each of 6 session runs. Its own summary: `received 0`, `missing` 590,400 to 591,840 samples (12.3 s), `restarts 0`, for both microphones | 6 of 6 |
| What the session audio contains around the restart | In the development session: **nothing is recorded at all** - the first worker held no durable fragment and the later worker ends without a camera (below). With the cameras fed again and the microphones left alone (what `REAL_PRODUCTION` does since row 179; supervisor-level run): **a playable file whose whole audio is digital silence** - 9.54 to 9.56 s, 95 of 95 windows of 100 ms without sound, largest absolute sample 0.0. So the "gap" is not a gap: it has no end | 3 of 3 |
| The same with the microphones started again on the same pipes once the later worker listens (what row 191 would add; supervisor-level run) | both microphones heard in every telemetry line of the later worker (13 of 13), `received` 623,616 to 624,640, `missing` 0 to 4; the file's audio has sound in every 100 ms window from the first (129 or 130 of 129 or 130); no microphone warning. The new helpers were started 309 to 332 ms after the kill; the first telemetry line with a level left the driver 645 to 677 ms after the kill (the driver hands on one line a second: an upper bound) | 3 of 3 |
| What the worker reports | the later worker: `no_mic_delivers_samples` once, then `MIC_DISCONNECTED` for both microphones 5.32 to 5.34 s after the kill (`CAPTURE_FAULT`, `ACTIVE`, subjects `MIC-01` and `MIC-02`). It goes on running | 9 of 9 later workers without microphones |
| What the Core reports (development session) | `CAPTURE_WORKER_DOWN` (reason `WORKER_KILLED`, restart in 250 ms), phase `RECORDING -> RESTARTING -> RECORDING`. **About the microphones' helpers, after their settle time: nothing** (0 log codes in s1-s3); inside the settle time: `CAPTURE_MIC_NOT_STARTED` / `MIC_START_FAILED` for both, the primary at level error (a1-a3). Then the worker's two `MIC_DISCONNECTED` become the faults `CAPTURE_FAULT@MIC-01`, `@MIC-02`. The session still shows `RECORDING`, not durable, for 15.6 s | 6 of 6 |
| How the development session ends | the development cameras are not opened again either (their helpers ended with the worker: row 179 re-opens cameras in `REAL_PRODUCTION` only, `capture-session/index.ts:1349-1421`), so the later worker ends with `NO_CAMERA_CONNECTED` 15.63 to 15.67 s after the kill; `FAILED_START`, session `FAULT`, nothing durable, no evidence item | 6 of 6 |

Row's Verification cell:

| Asked | Measured |
|---|---|
| per microphone the level frames or samples the later worker received after the restart: a count, in 3 runs | `MIC-01`: 0 of 246 level frames, 0 samples; `MIC-02`: 0 of 246, 0 samples - in a1, a2, a3 (killed inside the helpers' settle time) and in s1, s2, s3 (killed after the session said `STARTED`) |
| helper processes alive before and after the restart: two counts | before 2, after 0 - 6 of 6 |
| the rule is drafted with its evidence line and names row 191 as "runs" or "skipped" | section 7: **row 191 runs**, if the controller rules that a restart before the first durable fragment keeps recording in `REAL_PRODUCTION` |

## 2. Why it matters

Row 179 made a later worker of a session possible in `REAL_PRODUCTION` with cameras that are opened again for it. `startMicrophones` runs once, after the first acknowledged `START` (`capture-session/index.ts:1182`, called at `:1542`). `implementation/067_usb_audio_adapter.md` section 7 states that the production adapter never restarts a helper and that a later worker is fed only by `close()` -> `open()` -> `start()`. Together with the facts above: without row 191 a production restart before the first durable fragment yields a hearing that records picture and **no sound**, announced only by two `MIC_DISCONNECTED` warnings five seconds later.

## 3. The two instruments - what is real code and what is a stand-in

**A. The session run** (`.cache/task4-row184/restart.db.test.ts`, 318 lines; the steps of the committed `src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts`):

| Part | Real or stand-in |
|---|---|
| The Core: `buildApp` in the test process, booted; `REAL_DEVELOPMENT`; the fence, the registry, the capture-session unit, the supervisor, the engine, the sealing | **real**, on a throw-away database (cloned from the test template, dropped after the run: `0 remain`) and a data directory of its own under `.cache/task4-row184/runs/<name>/data`. It never listens: every request is injected, so no HTTP port is bound |
| The worker | **real**: `apps/capture-worker/build/capture-worker` (SHA-256 `2c301ae6...8e8795`), started by the supervisor |
| The microphones | **today's development sources**: `MIC-01`, `MIC-02` of adapter kind `FAKE` - the development helper `.data/helpers/ffmpeg` (SHA-256 `c8173e97...e4e1a8`) with `-re -f lavfi -i sine=frequency=440` / `880` into `<dataDir>/run/capture/<session>/MIC-0N.pcm`, started through the development door |
| The cameras | the development generated cameras (`CAM-01`, `CAM-02`, kind `FAKE`) |
| The ingest ports | **one stand-in**: `capture/ingest-address.ts:30` fixes 8554 and 8556, which this host's rules forbid. The module is mocked so that the SAME function returns the same address with 8559 and 8561. Nothing else is replaced |
| The kill | `SIGKILL` to `app.capture.status().workerPid` |

**B. The later-worker run** (`.cache/task4-row184/later_worker.py`, 139 lines):

| Part | Real or stand-in |
|---|---|
| The supervisor | **real**: `createCaptureSupervisor` with the process launcher, through the committed `apps/core-server/test/support/capture-session-driver.ts` |
| The worker, the helper program and its argument list | **real** (the same two programs; the argument list is the one `ps` showed in instrument A) |
| The session | **stand-in**: the script. It starts the helpers once, kills the worker while nothing is durable, waits for the later worker, then either starts the cameras only (`kept`) or two new helpers on the same pipes and then the cameras (`restart`) |
| The cameras | the committed fake cameras (`build/fake_cam`, 450 pictures), started only after the later worker listens: the stand-in for production's camera re-open of row 179 |
| Not present | the capture-session unit, the database, the production adapter (its part is `test/069_t2_audio.md`) |

Not run anywhere: `REAL_PRODUCTION` itself (no relay reports are wired on this Mac; hardware package).

## 4. What was run

Repository root, command sandbox off. One hold of the locks per run.

```
# A: both locks, in the order of `npm run test:dev-session-e2e` (about 25 to 40 s each)
sh .cache/task4-row184/run.sh <none|before|settled|after> <name>
#   = ROW184_KILL=<..> ROW184_NAME=<..> /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock /usr/bin/lockf -k -t 1800 .locks/db-migrate.lock \
#       node_modules/.bin/vitest run --config .cache/task4-row184/vitest.config.ts
# B: the heavy-host lock (about 17 s each)
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock python3 -B .cache/task4-row184/later_worker.py <kept|restart> <name>
```

| Mode | When the worker is killed | Runs |
|---|---|---|
| `none` | never (control): 227 of 227 level frames with a level per microphone, session `SEALED` | c1, c2 |
| `before` | both helpers run and the worker heard both in 5 level frames; inside the helpers' settle time (1,500 ms); not durable | a1, a2, a3 |
| `settled` | the session said `STARTED` (every helper lived through its settle time); not durable - a window of about 0.6 s on this host | s1, s2, s3 |
| `after` | 3 s after the first durable fragment | b1, b2, b3, b4 |
| `kept`, `restart` | instrument B: while nothing is durable | k1-k3, r1-r3 |

All 2026-10-13, 02:18 to 02:38 UTC; 1-minute load 4.3 to 6.5. Each A run printed `Tests  1 passed (1)` (the file asserts only that no process of the session is left) and the database helper's `0 remain`.

## 5. Facts per run

Times in ms after the SIGKILL.

| Run | Durable at the kill | Helpers before / 2 s after | Helpers gone after | Later worker listens | Level frames of the later worker: `MIC-01`, `MIC-02` (with a level / all) | Later worker's `received` | End |
|---|---|---|---|---|---|---|---|
| a1 | no | 2 / 0 | 45, 33 | 281 | 0 / 246, 0 / 246 | 0, 0 | `FAILED_START` `NO_CAMERA_CONNECTED` at 15,672; `FAULT` |
| a2 | no | 2 / 0 | 32, 32 | 288 | 0 / 246, 0 / 246 | 0, 0 | the same at 15,660 |
| a3 | no | 2 / 0 | 35, 47 | 283 | 0 / 246, 0 / 246 | 0, 0 | the same at 15,651 |
| s1 | no | 2 / 0 | 31, 31 | 280 | 0 / 246, 0 / 246 | 0, 0 | the same at 15,679 |
| s2 | no | 2 / 0 | 34, 45 | 279 | 0 / 246, 0 / 246 | 0, 0 | the same at 15,645 |
| s3 | no | 2 / 0 | 56, 33 | 283 | 0 / 246, 0 / 246 | 0, 0 | the same at 15,680 |
| b1 | yes | 2 / 0 | 44, 44 | none | - | - | `INTERRUPTED` at 68; `SEALED` (seal complete at 337) |
| b2 | yes | 2 / 0 | 43, 43 | none | - | - | `INTERRUPTED` at 73; seal failed twice, `FINALIZING` (section 6) |
| b3 | yes | 2 / 0 | 33, 33 | none | - | - | `INTERRUPTED` at 47; the same |
| b4 | yes | 2 / 0 | 41, 41 | none | - | - | `INTERRUPTED` at 55; the same |

| Run (B) | Helpers before / when the later worker listens | Gone after | Later worker listens | Telemetry lines with a level: `MIC-01`, `MIC-02` (of all) | `received` / `missing` per microphone | The file's audio |
|---|---|---|---|---|---|---|
| k1 | 2 / 0 | 38, 38 | 281 | 0, 0 (of 9) | 0 / 456,960 | 9.56 s, 0 of 95 windows with sound, largest sample 0.0 |
| k2 | 2 / 0 | 43, 21 | 290 | 0, 0 (of 9) | 0 / 456,000 | 9.54 s, 0 of 95 |
| k3 | 2 / 0 | 39, 41 | 296 | 0, 0 (of 9) | 0 / 456,000 | 9.54 s, 0 of 95 |
| r1 | 2 / 0, then 2 new at 332 | 45, 42 | 290 | 13, 13 (of 13) | 623,616 / 0 | 12.99 s, 129 of 129 windows with sound |
| r2 | 2 / 0, then 2 new at 309 | 42, 42 | 274 | 13, 13 (of 13) | 624,640 / 0 | 12.99 s, 129 of 129 |
| r3 | 2 / 0, then 2 new at 310 | 32, 32 | 280 | 13, 13 (of 13) | 624,640 / 0 and 4 | 13.01 s, 130 of 130 |

`after` runs, what was sealed (`session-manifest.json`, b1): two fragments per camera file, 5,544 and 5,566 ms; the audio interval `MIC-01` / `PRIMARY` from 21 ms to 5,566 ms. In b3 one camera file holds 4,554 ms: its last fragment was not durable at the kill. The recording ends at the last durable fragment; nothing follows.

In every run: `leftAfterStop` empty (no process named by the session, no worker, no helper of before, `leftoverHelpers()` empty, `openSources()` empty); instrument B: `leftovers` empty.

## 6. What makes it ambiguous, and findings beside the row

1. **Development sources.** The helper ends because its pipe has no reader. The production helper under the guard does the same (`test/069_t2_audio.md`: 22 to 43 ms, 3 of 3, with the adapter's `AUDIO_HELPER_EXITED`); what an ALSA input does at that moment was not run (`9A/H-08`).
2. **`REAL_PRODUCTION` was not run.** "The later worker records picture and silence" is shown with the real supervisor and worker and a script in the place of the session (instrument B). That the production session behaves so follows from `startMicrophones` being called once and from row 179's camera round; it is a reading of the code, checked on doubles by row 179, not a measurement of this row.
3. **The window is narrow.** A later worker exists only before the first durable fragment: here about 2 s after the worker's `START` acknowledgement (first durable record 1.6 to 1.7 s after both microphones were heard). With a real camera the window is as long as the camera needs to deliver its first fragment (the ingest window of production is 30 s).
4. **In development a restart never yields a recording** (6 of 6: `NO_CAMERA_CONNECTED` after 15.6 s, during which the session shows `RECORDING`). Not this row's subject; named because an operator of a development Core sees 15 s of "recording" that holds nothing.
5. **The Core says nothing when a development microphone helper ends after its start** (s1-s3: no log code between `CAPTURE_WORKER_DOWN` and the worker's own warnings). The development adapter has no loss hook wired to the session; the production adapter has one (`onSourceLost`), row 68.
6. **FINDING, cause not determined: the seal of the interrupted session failed in 3 of 4 `after` runs.** b2, b3, b4: step `STORE_SEALED_PACKAGE`, `StoreError WRITE_FAILED` at `db/store/store.ts:181` (`insertInto`, under `engine.completeSeal`), `SEALING_RETRY_SCHEDULED` (retry 1 of 3 after 5 s), failed again; the session was `FINALIZING` when the measurement closed its Core about 9 s after the kill (retries 2 and 3 not seen). b1, one minute earlier, sealed in 0.34 s; the sessions stopped normally sealed (c1, and c2 run afterwards as a control). HYPOTHESIS, not checked: an insert of the interrupted path against the schema as the working tree had it (rows 99 / 192 were in flight; the test templates are built from the tree at each run). The database's own error text was not read. One line in `file_requests.md`.
7. **Side fact, not judged:** in the all-silent file of `kept` the first audio frames do not follow each other (pts 0, 1, 2, then a jump; 3 or 4 frames of 447 or 448). With microphones delivering, 0 of 609.
8. **Coarse first-sound figure** in `restart`: the driver hands on one telemetry line a second, so "645 to 677 ms" is an upper bound; the file has sound from its first 100 ms window.
9. **The PCM tap** (sessions with speech-to-text) was off in every run. `TAP_PATH_OCCUPIED` is a final start refusal of the worker (`packages/capture-protocol/src/index.ts:289`); whether a later worker of a session with a tap is refused by the file its predecessor made was NOT measured.
10. Three runs per cell on one host.

## 7. DRAFT of the production rule for row 191 (for the controller; not implemented)

**Row 191: runs** - on the condition of its own cell: the controller rules that a restart before the first durable fragment keeps recording in `REAL_PRODUCTION`. The alternative ruling is "such a restart is not wanted": then the supervisor must not replace a worker of a `REAL_PRODUCTION` session at all (a change of row 179's behaviour), and row 191 is skipped. A restart that is kept WITHOUT row 191 records silence (section 1); that state should not ship.

Evidence line: later worker 0 of 246 level frames and 0 samples per microphone, 6 of 6 (a1-a3, s1-s3); helpers alive 2 before and 0 after, 16 of 16; cameras fed again and microphones not: 9.5 s of digital silence, 3 of 3 (k1-k3); microphones started again on the same pipes: sound from the first 100 ms window, 3 of 3 (r1-r3); `implementation/067` section 7 points 1, 2, 4, 6.

The rule, drafted:

1. **Helpers are started again per attempt; never kept.** A handle of the production adapter starts once (`067` 7.1) and its helper has ended 20 to 56 ms after the worker went down. For every worker after the first, each microphone of the plan gets `close()` of the handle of the earlier attempt, then `open()`, then `start()`. `open()` re-identifies the card from a fresh listing: a card that moved or was exchanged meanwhile is refused by name, never recorded from silently.
2. **Order.** (a) At `RESTARTING` - where the camera round of the earlier attempt is given up - every microphone handle of that attempt is closed, and all closes are awaited before any open (`067` 7.2: an input is held by one handle; 0 handles of attempt n left open is row 191's verification cell). (b) Every microphone is opened again BEFORE the later worker is given its plan: `close()` removes the pipe and `open()` makes it again at the same path (`067` 7.4), and the worker refuses a plan whose microphone path is no named pipe with `MIC_INPUT_NOT_FIFO`, a final refusal (`apps/capture-worker/src/capture_worker.c:203`); a pipe replaced after the worker opened it would be read by nobody. (c) `start()` after that worker acknowledged `START` and before its cameras are opened, as at the first start (`capture-session/index.ts:1539-1562`: the microphones define the audio timeline).
3. **The open design point row 191 must settle** (not decided here): today the supervisor starts the later worker by itself 250 ms after the first went down, and its one hook toward the session, `renewed`, is synchronous (`capture/types.ts:351-356`). A close-and-open with a card listing cannot be awaited inside it. Either the supervisor waits for the session before it launches a later worker, or the adapter gains a way to start a new helper on the pipe it keeps (instrument B `restart` shows that a new helper on the SAME kept pipe feeds the later worker). The second changes the contract of row 67 ("a handle starts once").
4. **Failure.** A microphone that cannot be opened or started again is reported as at a first start: the primary an error, the standby a warning, neither replaced by the other (`capture-session/index.ts:1188-1190`), and it delays no camera. Whether a later worker without its primary microphone may go on to a durable fragment is the same product question as at a first start; this draft does not change the answer in force there.
5. **Loss reports of the earlier attempt are dropped.** Each microphone of attempt n tells `AUDIO_HELPER_EXITED` when its worker goes (`test/069` section 1). A report that belongs to a superseded attempt is not a fault (ruling C37 for cameras; the same reading is proposed for microphones) - one notice for the restart, not three.
6. **Cost, to be stated to the operator's timeline:** per restart and microphone two listings, one configuration write, one pipe, and the settle time of 1,500 ms before `start()` resolves (`067` 7.5). Sound exists from the new helper's first sample; nothing of the earlier attempt's sound is kept (nothing of that attempt is durable).
7. **After the first durable fragment nothing changes:** no later worker exists (4 of 4), the helpers end by themselves, the session is interrupted and sealed; `close()` of each handle remains the session's duty at that end.

## 8. Driver decisions (for the controller to confirm)

1. **Two kill points before durable and one after.** The row says "killed once in mid recording"; a later worker exists only before the first durable fragment, so "mid recording" was measured both ways.
2. **Instrument B was added** to answer "what does the session audio contain" for the case the development session cannot reach (cameras fed again).
3. **The ingest ports are mocked to 8559 / 8561** in the measurement (the product's 8554 / 8556 are forbidden on this host). The committed end-to-end file binds 8554 / 8556 and was NOT run.
4. **The data directories are under `.cache/task4-row184/`**, not under `.data/` as the committed fixture makes them (the brief: media and logs under `.cache/`).
5. **Drivers under `.cache/task4-row184/`** (in no commit): `restart.db.test.ts` (SHA-256 `867f81ea...7bfd4d9d`), `vitest.config.ts`, `run.sh`, `later_worker.py` (SHA-256 `43c72ba5...a1eb93`), `runs/<name>/result.json` with each run's data directory (58 MB).

## 9. Rules kept

Heavy-host lock for every run and the db-migrate lock for every database run, one hold per run. Worker listeners 127.0.0.1:8559 and :8561 only; no HTTP listener; no lane port; no lane database (throw-away clones on the project PostgreSQL, dropped: `0 remain` in 12 of 12). No `.env` read. Nothing built. No file under `apps/` or `packages/` written; `file_claims.md` and `file_requests.md` edited with the Edit tool. After the last run: `pgrep -fl 'task4-row025|task4-row069|task4-row184|S-ROW184|S-ROW69|mic_host|door_parent|later_worker|e7_with_guard|t2_audio'` printed nothing (exit 1) and no listener stood on 8559-8574. `node scripts/secret-scan/count-only.mjs .cache/task4-row184` -> `TOTAL: 0 in 0 file(s)`.

---
*Generated: 2026-10-13*
