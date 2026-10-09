# Progress — coder-execution / row 53 (M2-W1 v2 completion, PAID, sole db-runner)

Attempt 3 (sessions `ses_ee31…` and `ses_ee32…` died mid-run; durable DB work survived and was
RE-PROVEN by this attempt before continuing). Repo `/Users/gsp-budi/Documents/DEMS`, HEAD `0024068`
(uncommitted M2 wave in tree; this row commits nothing).

- [x] STEP 0 — inputs read (structured rev 2.1 row 53, dbc-3 §E/§F/§G/§H, artifacts 09/11/12/51/53, report §6/§7, D44-D48); env probes; baseline probe; artifact `implementation/50_m2_lane_v2_completion.md` exists (attempt-2, §0-§4)
- [x] STEP 1 — 0004/0005/0006/0007 live on `dems_lane_1/2/3` — re-proven attempt 3: all four DBs schema_meta=(2,'dbc-3'), journal 8, 40 tables, MG-10 no-op run recorded in artifact §1
- [x] STEP 2 — migrate + v2 reseed `dems_demo`, kept tables intact — re-proven: paired_devices=5/creds=5/auth_sessions=11 carried, v2 seed 14/22/1/5/0 + stt_config=1
- [x] STEP 2b — per-lane v2 seed via reset — re-proven: capture_devices=5, capture_config=1, stt_config=1 per lane, each lane keeps exactly 1 paired device/credential
- [~] STEP 3 — CS-20 per-lane bulk fixture: NOT POSSIBLE inside the shipped design (v2 builders for the nine §G tables do not exist — grep 0; `target.ts` BF-1/TI-13 name guard refuses lanes before connecting). Board ASK posted with the two options; proceeding per interpretation (assert §G minimums as residual with exact owner list; M2-LANE-1 does not include CS-20 counts). Artifact §3.
- [x] STEP 4 — SH-24 media pipeline into git-ignored `.data/` — attempt-2 execution re-verified attempt 3: `.data/demo-evidence-v2/` 6.0 MiB incl. `tts/d7-tts-fixture.wav` + ffprobe-proven mp4s; git media diff 0; oMLX restored DOWN (port 8000 no listener). Artifact §4.
- [x] STEP 5 — lane stack restarted (Metro 8081, Cores 4421-4423, Vite 5176-5178); lanes mapped BY AVD identity (serials rotated); app reinstalled `-r` (stopped-state repair, data preserved); M2-LANE-1 RUN 1 all clauses (artifact §5.4): 4 DBs at 2/dbc-3, db:status ledger x4 exit 0, Cores ready (v2 boot checks live), Vite root+proxy ok, 1 PAIRED per lane, lane 3 device ONLINE with row-44 pairedAt, D258 gate demo clients 1->0->1 no re-pairing; SMART WMS/oMLX ports untouched. USER-GATE: `dems2_phone`/`dems2_tablet` keyguards (PIN) re-armed at cold boot — no PIN typed (rule); one-click `emulator-user-lock.sh unlock` posted to board; lanes 1/2 assert at DB/API level.
- [x] STEP 5b — M2-LANE-1 RUN 2 (19:50Z): identical clause-by-clause result to run 1 (artifact §5.5); the +1 belongs to row 56 per the 2+1 rule
- [x] STEP 6 — M2-RG-PG `tests 57 / pass 57 / fail 0` exit 0. M2-RG-CSD `Test Files 2 failed | 124 passed (126); Tests 14 failed | 1828 passed (1842)` = exactly the D48 itemisation: 13x contract.test.ts (D44-R4 later-milestone routes, `unregistered` list names the 14 capture/evidence ops) + 1x bulk-fixture minimums = CS-20 (residual §7.1); 0 new failures; throw-aways cleaned (0 remain); lanes never touched by the suite. Exit-0 for M2-RG-CSD NOT claimed — reachable only via the §7.1 controller decision. Artifact §6, §7; status `needs-review`.

Row verdict: NEEDS-REVIEW. Completed+proven: migration/reseed of all four DBs (2 runs), lane stack restart, M2-LANE-1 assertion both runs with live lane-3 reconnect + gate demo, M2-RG-PG, SH-24 media-location re-verification, red-line compliance. Remaining exactly two items: (1) CS-20 v2 builders + per-lane application decision (board ASK, options A/B in artifact §7.1); (2) lanes 1/2 device live reconnect after user keyguard unlock (one-click command posted; DB/API pairing clauses already pass).

Findings (attempt 3):
- Host has no `timeout` binary (rows 46/52 same); anti-hang = `lockf -k -t` + `</dev/null` + tool caps.
- Android 16 AVD cold boot: force-stopped app is hidden from implicit VIEW resolution AND explicit
  `-n` start fails with START_CLASS_NOT_FOUND while the keyguard is up (PIN devices) or the package
  sits in the stopped state; signature-compatible `adb install -r` restores launchability with app
  data (and lane credentials) intact. Unlocked AVD launches normally.
- CS-20 §G minimums: lanes+demo currently hold SEED-state v2 tables (9 new tables 0 rows except
  capture_devices=5/capture_config=1/stt_config=1); bulk-fixture.db.test.ts is digest-clean with
  the empty v2 tables (RECON-B2a design); the §G minimums ride a dedicated builder change (artifact §3).
- M2-RG-PG: `npm run test:pg-scripts` -> tests 57 / pass 57 / fail 0 (exit 0), at floor.
