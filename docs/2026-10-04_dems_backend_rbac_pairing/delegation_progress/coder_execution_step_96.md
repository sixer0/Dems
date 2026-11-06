# coder-execution, step 96 (plan row W74): Mobile Evidence in LIVE mode

Status: **complete** after the device re-run (D162; see the end of this file). Before it: needs-review, because the first sitting ended at the
600 s cap (exit 142) before the Evidence screen. Report: `implementation/74_mobile_evidence.md`.

| Time (WIB) | Milestone |
|---|---|
| 23:08 | Read plan row W74, CLG/SG, client spec §6.2, §8.1, §8.5, §8.7, §14 point 7, F59, gateway 09 §4 answer 3, 09a §10, impl 51 §4, 60, 35 |
| 23:16 | Pre-images of the 11 files to edit in `.cache/rollback/W74/` (`pre.sha256`); all 11 equal `acaff20` |
| 23:26 | Production edits in place (archive dialog S3-1, list/detail on `useCoreActions`, export sheet S1-5/S1-6/S5-1 + Live step 1, Live integrity tab, op 40 media reference, sim-adapter on core actions, i18n Live keys); typecheck 0, lint 0 |
| 23:27 | Existing evidence suites (Simulated): 4 suites / 40 tests pass |
| 23:33 | Live bed + archive tests 6/6 |
| 23:40 | Export, verify and static Live tests green; workspace static scans 49/49; lint 0/0 |
| 23:43 | Controller note (F69-1, D158): bed option `strict`; `live-evidence-strict.test.tsx` 2/2 |
| 23:50 | Mutation check (M15, in memory): 18 of 18 detected; tree identical before and after |
| 23:52 | Lock status recorded (read-only) |
| 23:55 | Whole mobile suite 110 / 1,395 exit 0; typecheck 0; lint 0/0 |
| 23:56–00:06 | Device sitting on the phone, lane 1 (waited for W78 on the lane lock first). Got the LIVE Login and a LIVE sign-in 200 (screencaps). The pending Summary of SES-20261005-0026 opened with the biometric dialog on top: the summary was not acknowledged and the dialog buttons were not pressed. `uiautomator dump` idle timeouts used up the cap. The last launch was `core=SIMULATED`; exit 142. Backend stopped, ports free, no reverse rule |
| 00:08 | Lock status after: identical |
| 00:09 | Final gate: 112 suites / 1,419 tests exit 0; typecheck 0; eslint 495 files 0/0 |
| 00:12 | Report written |

## Files written

- Production (edited): `apps/mobile/src/features/evidence/{archive-dialog,evidence-detail,evidence-list-screen,export-sheet,integrity-tab,play-sheet}.tsx`, `{evidence-media,evidence-model,i18n,sim-adapter,use-evidence-data}.ts`
- Production (new): `live-integrity-tab.tsx`, `use-clock-due.ts`, `use-core-verify.ts`, `use-evidence-media-ref.ts`
- Tests (new): `live-evidence-{archive,export,verify,strict}.test.tsx`, `live-evidence-static.test.ts`, `testing/live-evidence-bed.tsx`
- Documents: `implementation/74_mobile_evidence.md`, `implementation/assets/74_*` (18 files), this file

## Process notes

Three commands started with a `cd`: at 23:08 (a read-only listing), at 23:16 (a no-op subshell that failed) and at 23:21 (before an edit that used absolute paths). None of them changed anything, and there were no more after 23:21.

## Device re-run (decision D162)

Status after the re-run: **complete** (the controller accepted the code; CLG (d) is now met).

| Time (WIB) | Milestone |
|---|---|
| 00:18 | Lock status before (read-only): phone and tablet have a PIN and 1 fingerprint, keyguard not showing |
| 00:19–00:22 | One sitting on the phone, lane 1, 3 min 8 s, exit 0. LIVE: sign-in 200; the biometric offer got "Not now"; the Summary got Done (`acknowledge 204`); deep link to EV-20261005-0014; Hash & Integrity showed Verify → the Core's PASS ("Core record"); Export as INVESTIGATOR → the Core's 403 and the denied Alert. SIMULATED (last launch): the Evidence list and Hash & Integrity unchanged; 0 Core requests; prefs `{"coreLinkSource":"SIMULATED"}`. `/sdcard/w74.xml` removed. Backend and Metro stopped, ports 4421 and 8083 free, no reverse rule |
| 00:23 | Lock status after: identical |
| 00:25 | Report §15 "Device re-run (decision D162)" written; assets `74_rerun_*` (15 files) |

No code changed in the re-run, so the gate of 00:09 stands (112 / 1,419 exit 0, typecheck 0, lint 0/0; the controller's run at 00:11–00:15: 114 / 1,431).
