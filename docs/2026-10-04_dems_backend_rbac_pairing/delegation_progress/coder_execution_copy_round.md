---
agent: coder-execution
row: closing copy round (D184 DQ-7, D185) — W83 ledger rows #89 to #95
status: complete (7 of 7; #90 landed under decision D186)
started: 2026-10-06 04:39 WIB
finished: 2026-10-06 05:20 WIB (first pass 05:10; D186 phase 05:11 to 05:20)
report: docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/08c_copy_round.md
---

# Progress: closing copy round

| Item | Ledger | State | Note |
|---|---|---|---|
| 1 | #89 `sessionNew.live.*` | done 04:48 | shared `sessionNew.live.speakToTest` / `.scanCaseNumber`; mobile switched, its 2 keys removed; web reads them in Live (new `live` prop on `InfoStep`); new web test 5/5; web session-new 6 files / 65, mobile session-new 7 / 88 green; mutations web 6/6, mobile 4/4 (in memory) |
| 2 | #90 `devices.live.samples` | stopped 05:10, **done 05:14 under D186 (option A)** | shared `devices.live.samples_*` = "Derived from the Core's data · last N samples" / "… · {{count}} sample"; mobile reads it, its `samples_*` removed; web caller unchanged (new value); 3 mobile pins by design; new web test 3/3; mobile devices + i18n 6 / 65, web devices 6 / 73 green; mutations web 3/3, mobile 2/2; pre-#90 snapshots `.cache/rollback/COPY/pre-90/` |
| 3 | #91 `storage.manage.live.applied` | done 04:50 | mobile reads W71's shared key; its `live.applied` removed; static test pin moved (by design); mobile storage 4 / 39, web storage 4 / 43 green; mutations 2/2 |
| 4 | #92 `system.live.*` | done 04:54 | mobile Settings reads `system.live.diagnosticsSubtitle` / `.install` / `.startedToast` (3 keys removed); the mobile Devices diagnostics sheet (W78, same sentence) too (1 key removed; DC-1); 4 test pins by design; mobile settings + devices 13 / 137 green; mutations 5/6 (D6 = unchanged Simulated branch, unpinned) |
| 5 | #93 export success "(simulated)" in Live | done 04:56 | shared `evidence.live.export.success`; mobile reads it, `successLive` removed; 2 test pins by design; web has no such sentence; mobile evidence 9 / 79 green; mutations 1/2 (E2 = unchanged Simulated branch, unpinned) |
| 6 | #94 audit export reason note (Simulated change) | done 04:58 | THE deliberate Simulated change: "Shown here only: the demo simulator does not record the export reason yet." → "Recorded by the simulator in the audit row of the export."; new web test 2/2; web security-audit 6 / 65 green; mutations 2/2 |
| 7 | #95 Metadata "No DEMO package" (web) | done 05:01 | `MetadataTab` `mediaUnavailable` (Live, op 40 unanswered): header chip's `evidence.live.mediaUnavailable`; record note literal (DC-2); new web test 3/3; web evidence 8 / 61 green; mutations 5/5 |

## Final gate (05:02 to 05:07, `gateway_check/assets/08c_copy_final_gate.log`)

- typecheck and lint of shared, core-web, mobile: exit 0, no output
- shared 69 / 1,840 exit 0; core-web 100 / 1,381 exit 0; mobile 140 / 1,721 exit 0
- KI-07 = 62; 78 protected test files byte-identical
- mutations: web 13/13, mobile 12/14 (two unpinned Simulated branches)

Pre-images: `.cache/rollback/COPY/` (28 modified files; `PRE_SHA256.txt`). Diff: `gateway_check/assets/08c_copy_changes.diff.txt`.

## Final gate after D186 (05:15 to 05:20, same log, block "D186 … final gate re-run")

- typecheck and lint of shared, core-web, mobile: exit 0, no output
- shared 69 / 1,840 exit 0; core-web 101 / 1,384 exit 0; mobile 140 / 1,721 exit 0
- KI-07 = 62; 78 protected test files byte-identical; "Derived on this device" no longer found anywhere
- mutations of the round: web 16/16, mobile 14/16 (D6, E2: unchanged Simulated branches, no test pins them)
- report: `gateway_check/08c_copy_round.md` §12 "#90 (decision D186)"; 31 files modified, 4 test files added
