---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-09
agent: test-expert
blueprint_row: 127
type: row record (tier 3, working record of a Tier 1 edit) — test catalogue delta for R-9, R-10, R-11
status: needs-review
reason_for_needs_review: the delta is complete and its own gate passes (32/32 criteria, totals restated once, recount equal); three points need the controller — the size of the delta (111 checks), one conflict found outside the row's scope (D84 against the kill-matrix phase P1), and the owner / depth assumptions of section 7
file_edited: masterplan/10_test_strategy.md (622 -> 1040 lines)
erratum_marks: PE-127-01..PE-127-18
totals: {active: 330, conditional: 10, named: 340, run_2_plus_1: 150, run_once: 180}
acceptance_criteria_covered: 32/32
last_updated: 2026-10-09
---

# Row 127 — test catalogue delta for R-9, R-10, R-11 (record)

## 1. Status and what was done

| Item | Value |
|---|---|
| Status | **needs-review** (deliverable complete; decisions in section 7) |
| Row verification "every acceptance criterion of R-9..R-11 maps to at least one named check with method, depth and owning row" | **32/32** (R-9 16/16, R-10 6/6, R-11 10/10) — `10_test_strategy.md` §A.4a.9 |
| Row verification "the catalogue totals are restated once" | section K (with the arithmetic), mirrored by section L items 5-6 and the footer |
| Files written | `masterplan/10_test_strategy.md` (updated) and this record (created) |
| Files not touched | every other spec, `11_audit_errata.md`, `identification/02_structured.md`, `decisions/decisions.md`, `masterplan/02_plan.md`, `test/01_test_report.md`, `implementation/99_implementation_report.md`, the trackers, all code — by instruction of the row ("do not edit any other file"; parallel run) |
| Tests run | none (documentation-only row). Two local scripts ran on the document itself: the edit script and the recount (section 4) |

Baseline and method. The file was unmodified against HEAD `4b62350` before the edit, so
`git diff --stat HEAD -- docs/2026-10-07_dems_real_capture_sealing/masterplan/10_test_strategy.md`
shows exactly this row: `1 file changed, 445 insertions(+), 27 deletions(-)`. The 27 removed lines
are lines replaced by an extended version of themselves (dated erratum sentences appended to
existing cells, the totals row of section K, two short-form rows, the front matter). No existing
check, ID or section was removed or renumbered. Edits were applied by a script with single-match
anchors; a pre-edit copy is in the session scratch directory (`row127/10_pre_row127.md`).

Inputs read: `01_specs.md` §B.2 whole (32 criteria, C-N13..C-N15, B.2.6, B.2.7); the records of rows
120-126 whole; `03_api_contract.md` §2.6, §3.1, §5.2 (four audit types), §5.4, §7 (constants), §10.1;
`04_database_contract.md` §N.12-§N.14; `05_capture_architecture_spec.md` §A.1.2, §A.6.5, §A.8.1,
§G.1, §J H-7a..H-21; `08_client_ux_spec.md` §14.2 (tail), §14.3, §15; `09_security_design_review.md`
§11.2-§11.7 (findings SEC35-27..30, 38-44 in full, the others from the record); `decisions.md`
D72-D86; blueprint rows 60, 61, 65-68, 70, 71, 75, 83-85, 89, 127-142; `10_test_strategy.md` whole;
`11_audit_errata.md` §5 (convention). Read from the records rather than from the spec text:
`06_evidence_package_spec.md` §B.12, V-15, §H.5 (record of row 124) and UX flows 9-13 (record of
row 125 and `ux` §15).

## 2. What the delta contains

New section **§A.4a** of `masterplan/10_test_strategy.md` (lines 216-526), the §A.6a precedent:

| Part | Lines | Content |
|---|---|---|
| intro, rules CR-1..CR-7 | 216-238 | fixtures only; two canaries per run (user name and secret); agent rules; constants by name; lanes; captures; depth |
| A.4a.1 | 240-258 | database delta: `M4-MT-9`..`M4-MT-12`, `M4-MT-14`..`M4-MT-16`, `M4-PIN-2`, `M4-DB-APPLY-1`, `M4-SEC-RESET-1` |
| A.4a.2 | 260-282 | discovery, search API, guards, pins, audit: 19 checks incl. `M4-DISC-STUB-1`, `M4-DISC-LAN-1`, `M4-DISC-REC-1`, `M4-SEC-DISC-1..4` |
| A.4a.3 | 284-305 | connect flow on the server: 14 checks incl. `M4-CONN-NOCRED-1`, `M4-CONN-OUT-1`, `M4-CONN-ATOM-1`, `M4-CONN-WEBONLY-1`, `M4-SEC-CRED-1` |
| A.4a.4 | 307-314 | notifications A and B, the pre-check start rule, op 97 |
| A.4a.5 | 316-329 | development fence, plan, helpers, privacy: 10 checks incl. `M4-SEC-FENCE-1`, `M4-LOCAL-AV-1` |
| A.4a.6 | 331-358 | clients: 34 checks (the IDs of `ux` §15.2 plus `M4-SEC-UI-1`, `M4-UX-VOC-1`, `M4-UX-A11Y-1`) |
| A.4a.7 | 360-370 | M5: `M5-NODEV-C-1`, `M5-NODEV-C-W/T/P`, `M5-SRC-REC-1`, `M5-LOCAL-E2E-1`, `M5-LOCAL-CLAP-1`, `M5-SEC-SRC-1`, `M5-SEC-PRIV-2-W/T/P` |
| A.4a.8 | 372-382 | M7: `M7-DEVSRC-SEAL-1`, `-TAMPER-1`, `-BUILD-1`, `M7-SEC-SRC-2`, `M7-DEVSRC-EVID-W/T/P`, `M7-CONN-CRED-1`, `M7-CONN-W-CRED` |
| A.4a.9 | 384-436 | traceability table, 32 rows |
| A.4a.10 | 438-464 | existing checks whose text changes, before / after |
| A.4a.11 | 466-507 | values assumed where two specs disagree (G-1..G-34) — section 6 of this record |
| A.4a.12 | 509-526 | count of the section |

Where each check named in the row brief is:

| Asked for | Check |
|---|---|
| discovery on the fake ONVIF stub, loopback only, passes with no camera on the LAN | `M4-DISC-STUB-1` (2+1), `M4-DISC-NOLAN-1` |
| real-LAN probe, 2 + 1, "N responders, N may be 0", zero ends in R-10, "not run", counts and model class only | `M4-DISC-LAN-1` |
| forged / hostile probe answers (SEC35-28, SEC35-29) | `M4-SEC-DISC-2` (clone, 64 responders, spoofed source), `M4-SEC-DISC-1` (malformed / oversized XML, exception in the parse callback), `M4-SEC-DISC-3` (flood during `RECORDING`) |
| the check that lifts the 409 during `RECORDING` | `M4-DISC-REC-1`: (a) 409 before the lift, (b) the lift is one constant pinned to the recorded PASS of `M4-SEC-DISC-1` and `M4-SEC-DISC-3`, (c) after it a search completes and the fragment sequence stays contiguous |
| "no connection test without an operator-entered credential", API + UI, by construction | `M4-CONN-NOCRED-1` (+ G-R14 in `M4-SR-1`) |
| five connection-test outcomes on fixtures | `M4-CONN-OUT-1`; on the web console `M4-CONN-W` |
| adoption atomicity; 503 before row 84; development sources adoptable | `M4-CONN-ATOM-1` (= MT-13) |
| credential secrecy, canary, user name included, client logs | `M4-SEC-CRED-1` (server) and every `M4-CONN-W` run (web) |
| web-only enforcement; Try-it deny list 10 | `M4-CONN-WEBONLY-1`; `M4-PIN-1` (pin) and `M4-SEC-UI-1` (browser) |
| rate limits and the lock-out guard | `M4-SEC-RATE-1`, `M4-SEC-CONN-4`, `M4-SEC-CONN-2`, `M4-CONN-GUARD-W` |
| three notifications on web, tablet, phone incl. clearing and the operator without `CAPTURE_CONFIG` | `M4-NODEV-A-1`, `M4-NODEV-B-1`, `M5-NODEV-C-1`; `M4-DISC-EMPTY-W/T/P`, `M4-NODEV-B-W/T/P`, `M5-NODEV-C-W/T/P`, `M4-NODEV-NOCFG-T` |
| pre-check start rule | `M4-PRECHK-RULE-1`; `M4-MIC-ACTIVE-W/T/P` |
| op 97 microphone re-read | `M4-MIC-RESCAN-1`; `M4-MIC-RESCAN-W/T/P` |
| development fence (five boot refusals, stored `LOCAL_DEVICE` row, mixed session, no listener without an opener) | `M4-SEC-FENCE-1`, `M4-LOCAL-PLAN-1`, `M5-SEC-SRC-1` |
| local-device capture end to end; H-17 without the camera, then the clap | `M4-LOCAL-AV-1` (generated input through the helper line, 2+1), `M4-LOCAL-CAM-1`, `M4-LOCAL-MIC-1`, `M5-LOCAL-E2E-1`, `M5-LOCAL-CLAP-1` (manual-with-user, once) |
| permission denied / device busy ends in R-10, never a fake | `M4-LOCAL-ERR-1`, `M4-DEVSRC-LOCAL` |
| migration `0008` + `0009` | `M4-MT-9`, `M4-DB-APPLY-1`, `M4-MT-11`, `M4-MT-16`, `M4-PIN-2` |
| `session_capture_sources` written with `RECORDING`, INSERT-only | `M5-SRC-REC-1` (+ privilege half in `M4-MT-11`) |
| manifest mark, V-15, tamper, PASS with the line first, reset-guard exemption | `M7-DEVSRC-SEAL-1`, `M7-DEVSRC-TAMPER-1`, `M7-DEVSRC-BUILD-1`, `M4-SEC-RESET-1` |
| UI label per flow 12 and the Simulated-mode rule | `M4-DEVSRC-LABEL-W/T/P`, `M7-DEVSRC-EVID-W/T/P` |
| i18n / vocabulary and accessibility | `M4-UX-VOC-1`, `M4-UX-A11Y-1` |

How `M5-LOCAL-CLAP-1` is recorded without storing media: one table row in the M5 gate report —
date, session id, file sha256, offset in ms (or in frames, stated by the user), the ±40 ms bound,
verdict, "user present: yes", path and size of the recording under `.data/`. A local script prints
only the offset and the verdict. No frame, still, waveform, audio excerpt or transcript goes to
`docs/`; no agent opens the media with a viewing tool; the gate reads the record and does not repeat
the clap.

## 3. Traceability summary (full table with method, depth, owner, negative control: §A.4a.9)

| AC | Named checks (primary first) |
|---|---|
| R-9 AC-1 | `M4-DISC-TRIG-1`; `M4-SR-1` (G-R13) |
| R-9 AC-2 | `M4-DISC-STUB-1`; `M4-DISC-W`, `-T`, `-P`; `M4-SEC-DISC-2` |
| R-9 AC-3 | `M4-DISC-STUB-1`; `M4-DISC-LAN-1` |
| R-9 AC-4 | `M4-DISC-LIFE-1`; `M4-DISC-OWNER-W` |
| R-9 AC-5 | `M4-CONN-ORDER-1`; `M4-CONN-W`; `M7-CONN-CRED-1`; `M7-CONN-W-CRED`; `M4-CONN-PTR-T`, `-P` |
| R-9 AC-6 | `M4-CONN-OUT-1`; `M4-CONN-W` |
| R-9 AC-7 | `M4-CONN-NOCRED-1`; `M4-SR-1` (G-R14); `M4-SEC-CONN-2` |
| R-9 AC-8 | `M4-CONN-ATOM-1`; `M4-CONN-ABANDON-W` |
| R-9 AC-9 | `M4-AUD-1`; `M4-SEC-AUD-1`; `M4-SEC-CRED-1` |
| R-9 AC-10 | `M4-CONN-SSRF-1`; `M4-SEC-CONN-3` |
| R-9 AC-11 | `M4-SEC-RATE-1`; `M4-SEC-CONN-4`; `M4-SEC-CONN-2`; `M4-CONN-GUARD-W` |
| R-9 AC-12 | `M4-DISC-RBAC-1`; `M4-CONN-WEBONLY-1`; `M4-DISC-RBAC-W/T/P`; `M4-CONN-PTR-T/P`; `M4-NODEV-NOCFG-T`; `M4-PC-1` |
| R-9 AC-13 | `M4-LOCK-1` (amended); `M4-DISC-REC-1`; `M4-CONN-LOCK-W` |
| R-9 AC-14 | `M4-DISC-NOLAN-1` |
| R-9 AC-15 | `M4-DISC-LAN-1`; `M4-DISC-SOCK-1` |
| R-9 AC-16 | `M4-DISC-LAN-1`; `M4-SEC-DISC-4`; `X-SEC-1` (amended); `M4-SEC-PRIV-1` |
| R-10 AC-1 | `M4-NODEV-A-1`; `M4-DISC-EMPTY-W/T/P` |
| R-10 AC-2 | `M4-NODEV-B-1`; `M4-PRECHK-RULE-1`; `M4-MIC-RESCAN-1`; `M4-NODEV-B-W/T/P`; `M4-MIC-ACTIVE-W/T/P`; `M4-MIC-RESCAN-W/T/P` |
| R-10 AC-3 | `M5-NODEV-C-1`; `M5-NODEV-C-W/T/P` |
| R-10 AC-4 | `M4-DISC-EMPTY-W/T/P`; `M4-NODEV-B-W/T/P`; `M5-NODEV-C-W/T/P`; `M4-NODEV-NOCFG-T`; `M4-UX-UNIT` |
| R-10 AC-5 | `M4-NODEV-A-1`; `M4-NODEV-B-1`; `M5-NODEV-C-1` (raise, clear, raise) and the client runs |
| R-10 AC-6 | `M4-NODEV-A-1`; `M4-NODEV-B-1`; `M4-AUD-1` |
| R-11 AC-1 | `M4-SEC-FENCE-1`; `M4-SR-1` (G-R15) |
| R-11 AC-2 | `M4-LOCAL-SEL-1`; `M4-DEVSRC-LABEL-W/T/P` |
| R-11 AC-3 | `M4-LOCAL-PLAN-1`; `M5-LOCAL-E2E-1` |
| R-11 AC-4 | `M4-LOCAL-WORKER-1`; `M3-RTSP-BIND-1` (amended) |
| R-11 AC-5 | `M4-LOCAL-ERR-1`; `M4-DEVSRC-LOCAL`; `M4-SR-1` (G-R14) |
| R-11 AC-6 | `M4-DEVSRC-LABEL-W/T/P`; `M7-DEVSRC-EVID-W/T/P`; `M5-SEC-PRIV-2-W/T/P` |
| R-11 AC-7 | `M7-DEVSRC-SEAL-1`; `M7-DEVSRC-TAMPER-1`; `M7-DEVSRC-BUILD-1`; `M7-SEC-SRC-2`; `M5-SRC-REC-1` |
| R-11 AC-8 | `M4-SEC-PRIV-1`; `X-MEDIA-1` (amended); `M5-LOCAL-E2E-1` |
| R-11 AC-9 | `M4-SEC-PRIV-1`; `M4-LOCAL-CAM-1`, `M4-LOCAL-MIC-1` (hand-over rule) |
| R-11 AC-10 | `M5-LOCAL-E2E-1`; `M4-LOCAL-AV-1`; `M5-LOCAL-CLAP-1`; `M7-DEVSRC-SEAL-1` |

Script check on the written file: 32 traceability rows (16 / 6 / 10), 8 cells each; every check ID
named in a traceability row exists as a check row; 111 new IDs, none in two rows. Twenty-four new
checks trace to a contract or a finding and to no criterion (migration and pins 10, security
findings 11, `M4-SEC-UI-1`, `M4-UX-VOC-1`, `M4-UX-A11Y-1`) — listed under the table.

Reuse of proposed IDs: all 20 families of `ux` §15.2 (38 IDs) and all 24 checks of the security
record are used under their proposed names. Two changes: `M5-SEC-PRIV-2` is split per client into
`-W` / `-T` / `-P` (a 2+1 check has exactly three executions); MT-13 of the database contract is the
same check as the adoption-atomicity check and carries one ID, `M4-CONN-ATOM-1`. Three texts differ
from the proposals because of later rulings: `M4-CONN-GUARD-W` counts two refused passwords (D86
C-2), `M4-MIC-ACTIVE-*` has no toggle (D83), `M4-DEVSRC-LABEL-*` shows no badge in Simulated client
mode (D83).

## 4. Totals, with the arithmetic

| | Before row 127 | Added by §A.4a | After |
|---|--:|--:|--:|
| M4 | 14 | 91 (48 once, 43 run 2+1) | **105** |
| M5 | 13 | 11 (2 once, 9 run 2+1) | **24** |
| M7 scheduled | 52 | 9 (2 once, 7 run 2+1) | **61** |
| M0, M1, M2, M3, M6, M8, M9, X | 7, 21, 29, 22, 21, 18, 16, 6 | 0 | unchanged |
| **Active** | **219** | **111** | **330** = 7 + 21 + 29 + 22 + 105 + 24 + 21 + 61 + 18 + 16 + 6 |
| run 2+1 | 91 | 59 | **150** |
| run once | 128 | 52 | **180** (150 + 180 = 330) |
| Conditional (OD-21 fallback cells) | 10 | 0 | **10** |
| **Named** | **229** | **111** | **340** |

The checks of rows 129 and 130 (10 checks of §A.4a.1) are active, not conditional: the schema change
is confirmed by D83. Composition of the 111: 38 from `ux` §15.2, 26 from the security record, 7 MT
checks, 40 named by this row.

Mechanical recount (the script validated itself on the pre-edit copy first, printing
128 / 91 / 219 / 10 = 229 named, the figures of the old section K). Output on the written file:

```text
milestone  once  2+1  active  conditional
M0            7    0       7            0
M1            3   18      21            0
M2           26    3      29            0
M3           15    7      22            0
M4           59   46     105            0
M5           12   12      24            0
M6           13    8      21            0
M7           11   50      61           10
M8           12    6      18            0
M9           16    0      16            0
X             6    0       6            0
TOTAL       180  150     330           10   named = 340
unclassified cells: none
check IDs appearing in more than one row: none
table rows whose column count differs from the header: none
```

The last line covers every table of the file. One old row failed it before this edit (section D.2,
"expected at M9": a literal `|` inside a command split the cell); the pipe is now escaped (mark
PE-127-11). Other self-gate greps re-run: run-count audit 0 hits; loop / campaign phrasing — 13 more
matching lines, all only through the word "loopback"; `biometric` 3 lines as before, 0 checks;
`maxWorkers` 26 -> 29 lines.

Load on the gates: the 59 new 2+1 checks are 177 executions (118 by the owning rows, 59 at the
gates). 40 of them are client checks (M4 30, M5 6, M7 4); rule CR-7 lets client checks share one
lane boot and one sign-in. No check runs more than three times.

## 5. For the task-architect — Verification cells (the blueprint was not edited)

Exact sentence per row. "+1" is the gate's independent run. Unit, static and contract checks run
once per checkpoint (section B.2 of the catalogue); where a row's present text says "2 runs" for
such a check, the 2 runs apply to its DB-backed, harness, browser and device checks only.

| Row | Sentence for the Verification cell |
|---|---|
| 129 | `M4-MT-9` (2 runs; +1 at row 70), `M4-MT-10`, `M4-MT-11`, `M4-MT-12`, `M4-MT-14`, `M4-MT-15`, `M4-MT-16`, `M4-PIN-2` and `M4-SEC-RESET-1` (2 runs; +1 at row 70) pass on throw-away databases; the migration is the set `0008` + `0009`, version `(3, 'dbc-4')` (D83); live `dems_demo` and the lanes are not migrated by this row. |
| 130 | `M4-DB-APPLY-1` passes: the four databases report `3 (dbc-4)`, a second run applies nothing, kept tables and per-lane pairing are intact (run 1 applies, run 2 is the no-op run; +1 at row 70). |
| 131 | `M4-DISC-NOLAN-1`, `M4-DISC-SOCK-1`, `M4-SEC-NET-1` (`dgram` half), `M4-SEC-DISC-1`, `M4-SEC-DISC-2`, `M4-SEC-DISC-4`, `M4-SEC-TXT-1`, `M4-SEC-DEP-1` and `M4-SR-1` (G-R9, G-R13) pass on the fake stub with no camera on the LAN; `M4-SEC-DISC-3` 2 runs; `M4-DISC-LAN-1` 2 runs (+1 at row 70), each ending in `FOUND (N)`, `EMPTY` or `NOT RUN (reason)`, the report quoting counts and model class only. |
| 132 | `M4-DISC-STUB-1` 2 runs and `M4-DISC-REC-1` 2 runs (+1 each at row 70); `M4-DISC-TRIG-1`, `M4-DISC-LIFE-1`, `M4-DISC-RBAC-1`, `M4-SEC-RATE-1` (search bounds), `M4-AUD-1` (`CAPTURE_DISCOVERY_SEARCHED`) and `M4-LOCK-1` pass; `M4-PIN-1` records the values this row lands (the totals 97 / 36 / 61 / 67 hold after row 142). |
| 133 | `M4-NODEV-A-1` and `M4-NODEV-B-1` 2 runs each (+1 at row 70); `M4-PRECHK-RULE-1`, `M4-MIC-RESCAN-1` and `M4-AUD-1` (`CAPTURE_DEVICE_UNREACHABLE`) pass. |
| 134 | `M4-LOCAL-AV-1` 2 runs on a generated input before the camera is opened; then, with the permission granted by the user, `M4-LOCAL-CAM-1` 2 runs (+1 each at row 70); `M4-LOCAL-WORKER-1`, `M4-SEC-HELPER-1` (exact name match) and `M4-SEC-PRIV-1` pass. |
| 135 | With the permission granted by the user, `M4-LOCAL-MIC-1` 2 runs (+1 at row 70); `M4-LOCAL-WORKER-1`, `M4-SEC-HELPER-1` (pipe path) and `M4-SEC-PRIV-1` pass. |
| 136 | `M4-SEC-FENCE-1` (the five boot refusals and the stored `LOCAL_DEVICE` cases), `M4-LOCAL-SEL-1`, `M4-LOCAL-PLAN-1` (four sources; a mixed session and a source kind without an opener refused), `M4-LOCAL-ERR-1`, `M4-SEC-HELPER-1` and `M4-SR-1` (G-R12, G-R14, G-R15) pass. |
| 137 | `M4-DISC-W`, `M4-DISC-EMPTY-W`, `M4-DISC-RBAC-W`, `M4-DISC-OWNER-W`, `M4-CONN-W`, `M4-CONN-ABANDON-W`, `M4-CONN-LOCK-W`, `M4-CONN-GUARD-W`, `M4-NODEV-B-W`, `M4-MIC-RESCAN-W`, `M4-MIC-ACTIVE-W`, `M4-DEVSRC-LABEL-W` and `M4-SEC-UI-1` pass 2 runs each via agent-browser on a lane with fixture credentials on the fake stub (+1 at row 70); `M4-CONN-NOCRED-1` (UI half), `M4-DEVSRC-LOCAL`, `M4-UX-UNIT`, `M4-UX-VOC-1` and `M4-UX-A11Y-1` pass; core-web suite `--maxWorkers=2`; `M7-CONN-W-CRED` is run after row 84. |
| 138 | `M4-DISC-T` / `-P`, `M4-DISC-EMPTY-T` / `-P`, `M4-DISC-RBAC-T` / `-P`, `M4-CONN-PTR-T` / `-P`, `M4-NODEV-B-T` / `-P`, `M4-NODEV-NOCFG-T`, `M4-MIC-RESCAN-T` / `-P`, `M4-MIC-ACTIVE-T` / `-P` and `M4-DEVSRC-LABEL-T` / `-P` pass 2 runs each on the lanes (+1 at row 70); no password field exists on tablet or phone (D80(3)); `M4-DEVSRC-LOCAL`, `M4-UX-UNIT`, `M4-UX-VOC-1` and `M4-UX-A11Y-1` pass; mobile jest `--maxWorkers=2`; no PIN typed by an agent. |
| 139 | `M5-NODEV-C-1` 2 runs on fakes (+1 at row 75): 0 cameras -> `FAULTED`, one alert, one audit row, 0 evidence items; 1 camera -> recording with one warning; `M5-NODEV-C-W` / `-T` / `-P` 2 runs each. |
| 140 | With the permission granted by the user: `M5-LOCAL-E2E-1` 2 runs (+1 at row 75); `M5-LOCAL-CLAP-1` once with the user present, recorded as one table row with no media in `docs/`; `M5-SEC-SRC-1` 2 runs; `M5-SEC-PRIV-2-W` / `-T` / `-P` 2 runs each; `M4-SEC-PRIV-1` passes; recordings only under `.data/`, 0 media in git. |
| 141 | `M7-DEVSRC-SEAL-1`, `M7-DEVSRC-TAMPER-1` and `M7-SEC-SRC-2` 2 runs each on the server (+1 at row 89); `M7-DEVSRC-BUILD-1` passes; `M7-DEVSRC-EVID-W` / `-T` / `-P` 2 runs each with rows 137 / 138. |
| 142 | `M4-CONN-ATOM-1` 2 runs (+1 at row 70); `M4-CONN-NOCRED-1`, `M4-CONN-OUT-1`, `M4-CONN-SSRF-1`, `M4-CONN-ORDER-1`, `M4-CONN-WEBONLY-1`, `M4-SEC-CONN-1`..`M4-SEC-CONN-4`, `M4-SEC-CRED-1`, `M4-SEC-CRED-2`, `M4-SEC-AUD-1`, `M4-SEC-ADOPT-1`, `M4-SEC-RATE-1` (test bounds), `M4-SEC-NET-1` (`onvif` half), `M4-SR-1` (G-R10, G-R11), `M4-AUD-1` and `M4-PIN-1` (97 / 36 / 61 / 67, Try-it denied 10) pass on the fake stub; adoption with a credential answers `503 CREDENTIAL_STORE_NOT_READY` until row 84. |
| 70 (gate) | With AP3 the gate also runs the +1 of the 43 M4 checks of `10_test_strategy.md` §A.4a that run 2+1 and reads the results of the 48 that run once: `M4-DISC-LAN-1` ends in `FOUND (N)`, in `EMPTY` with the R-10 notification shown, or in `NOT RUN (reason)`; `M4-CONN-NOCRED-1` shows 0 outbound requests; `M4-SEC-DISC-1` and `M4-SEC-DISC-3` are recorded PASS before part (c) of `M4-DISC-REC-1` is run; identifying results stay in `.data/`. |
| 75 (gate) | With AP3: the +1 of `M5-LOCAL-E2E-1` (two playable files), `M5-NODEV-C-1` (`FAULTED`, one alert, 0 evidence items), `M5-NODEV-C-W` / `-T` / `-P`, `M5-SEC-SRC-1` and `M5-SEC-PRIV-2-W` / `-T` / `-P`; `M5-SRC-REC-1` read; the record of `M5-LOCAL-CLAP-1` read, not repeated. |
| 89 (gate) | With AP3: the +1 of `M7-DEVSRC-SEAL-1` (PASS with the development line first), `M7-DEVSRC-TAMPER-1`, `M7-SEC-SRC-2`, `M7-DEVSRC-EVID-W` / `-T` / `-P` and `M7-CONN-W-CRED`; `M7-DEVSRC-BUILD-1` and `M7-CONN-CRED-1` read; verify runs 15 checks (V-01..V-15). |

Rows outside 129-142 that own or share a check of §A.4a:

| Row | Sentence |
|---|---|
| 60 | The fake ONVIF stub provides ST-1..ST-5 of `cap` §A.8.1 (without the RTSP responder ST-4 if row 128 confirms D82) and the generated-input mode used by `M4-LOCAL-AV-1`. |
| 61 | The one capture-mode function and the boot audit row of `M4-SEC-FENCE-1`; the guard-family count gains the rules of `M4-SR-1`. |
| 65 | `M4-MT-12` (upsert half): `adapter_kind` and `kind` stay out of the SET list. |
| 66 | `M4-LOCAL-PLAN-1` (plan builder: four sources; mixed session refused; `SOURCE_KIND_NOT_RECORDABLE`); `M4-LOCK-1` as amended (ops 89, 95, 96). |
| 71 | `M5-SRC-REC-1` passes; with row 139, `M5-NODEV-C-1` (a session presents "recording" only from the first durable fragment; `FAULTED` with nothing durable = failed start, no evidence item — D84). |
| 83 | The manifest has 128 fields; fields 124-128 are built from the first build (D81); `M7-REF-1` is recorded on that manifest. |
| 84 | `M7-CONN-CRED-1` passes: credentialed adoption answers 201, a one-character secret is stored (F-122-2). |
| 85, 86, 89 | "14 checks V-01..V-14" holds for row 85; from row 141 on verify runs 15 (V-15). |

Wording in the blueprint that the checks do not follow (also in section 6): row 131 "plus reading
the responders' unauthenticated device information" (D80(1)); rows 121 / 142 "credential only from
operation 89" (D81); rows 129, 130, 132, 136 "migration `0008`" (the set, D83); row 138 "the connect
flow for the roles and clients row 125 allows" and "the credential is never rendered" (none on
tablet and phone, D80(3)); row 132 "pins equal the C3 totals of row 121" (final after row 142);
row 83 "120-field manifest". No row names operation 97.

## 6. For the spec gate row 128 — where two input specs disagree and what the checks assume

Identical to `10_test_strategy.md` §A.4a.11.

"Assumed" is what the checks of §A.4a are written against. Rulings D80-D86 win over spec text; where
no ruling exists the item says so. Constants are read by name (CR-4), so a value fixed differently
at row 128 moves no test — only the item marked "text of a check changes".

| # | Point | Spec A says | Spec B says | The checks assume | Effect if row 128 decides otherwise |
|--:|---|---|---|---|---|
| G-1 | Search window | C3 §7: `CAPTURE_DISCOVERY_WINDOW_MS` = 5,000 ms | `cap` §A.6.1: 3,000 ms (accepted, D82(c)) | 3,000 ms, by name | none |
| G-2 | Connection-test deadline | C3 §7: 10,000 ms | `cap` §A.6.2: 15 s; SEC35-39 (4) recommends 15 s | by name; no check holds a literal | none |
| G-3 | Lock-out guard | C3 §7 and `ux` §8d: 3 failures per host in 15 minutes (a "10 minutes" value is also quoted, D86 C-8) | D86 C-2: 2 failures per host in 30 minutes, at most 2 rejected credential-bearing requests per failed test | D86 C-2 | text of `M4-SEC-CONN-4` and `M4-CONN-GUARD-W` changes ("two refused passwords") |
| G-4 | Search spacing and bounds | C3 §7: 10 s per session, 6 per minute per Core | `cap`: spacing per Core; SEC35-39: also 30 per hour per session, 5 s per Core, a per-operator test spacing, an own allowance for the pre-check search | the SEC35-39 set, one case per bound in `M4-SEC-RATE-1` | cases added or removed in that one check |
| G-5 | Pre-check search under the limit | C3 §2.6: a pre-check search refused by the limit is skipped | SEC35-39 (3): it has its own allowance | own allowance | one case of `M4-SEC-RATE-1`, one clause of `M4-PRECHK-RULE-1` |
| G-6 | Tests in parallel | C3 §7: 6 per minute per Core | `cap` §A.6.2: one at a time per Core | both hold | none |
| G-7 | Searching while a session is open | specs R-9 AC-13, C3 §2.6 "Config lock", D80(4): allowed in every open state | D86 C-4: `409 INVALID_STATE` during `RECORDING` until `M4-SEC-DISC-1` and `M4-SEC-DISC-3` pass | D86 C-4; the `details.reason` value of that 409 is not named in C3 §4 — the check asserts status and code only | `M4-DISC-REC-1` (a) drops out if the gate is not built |
| G-8 | Active microphone unreachable at pre-check | D81 and `ux` §8g (control G18): the operator toggles to the reachable microphone at pre-check | D83 and C3 §3.1: blocked; the operator cancels and sets the primary microphone on Devices (op 80) | D83; G18 is not built; gated controls of flows 9-13 = G13-G17 | text of `M4-MIC-ACTIVE-*`, `M4-PRECHK-RULE-1`, `M4-PC-1` |
| G-9 | Where the connection test takes its credential | specs R-9 AC-5, AC-7 and blueprint rows 121, 142: "only from operation 89" | D80(7), D81, C3 §2.6: the body of op 95 (memory) and of op 96 (the op-89 write inside the adoption) | D81 | `M4-CONN-NOCRED-1`, `M4-CONN-ORDER-1` |
| G-10 | Clients that may enter a camera credential | specs R-9 AC-5 / AC-12, blueprint row 138: "each client row 125 allows"; row 138 acceptance "the credential is never rendered" | D80(3), `ux` §8d: web console only | web only; tablet and phone = `M4-CONN-PTR-T` / `-P` (0 password fields) | none |
| G-11 | Reading device information after a probe | blueprint row 131: "plus reading the responders' unauthenticated device information" | D80(1): probe-answer data only | D80(1): 0 requests to the device service after a search (`M4-DISC-STUB-1`) | none |
| G-12 | RTSP in the connection test | `cap` §A.6.2, §A.8.1 ST-4, §G.1 G-R10: an `OPTIONS` / `DESCRIBE` client in `rtsp-describe.ts` (`node:net`) | D82; SEC35-27 (4): no RTSP client; `node:net` imported by no file under `src/capture/**` | D82: 0 RTSP connections; `NOT_H264` judged from the ONVIF profile answer | `M4-CONN-OUT-1`, `M4-SR-1` (G-R10), `M4-SEC-NET-1` |
| G-13 | Device ids of the local camera and microphone | `cap` §A.1.1 "Development slots": `CAM-01` / `MIC-01` | D83 (D-DB-13): rows of their own with the next free ids; the built-ins stay `FAKE`; the adapter kind is immutable | D83; checks say "the local camera's device id" | none |
| G-14 | "Already registered" match | C3 §2.6: `onvif_uuid`, else the host of `address` | `dbc-4` §N.5 (D-DB-15, accepted D83): `onvif_uuid`, else the whole `address` | D83 | one fixture of `M4-DISC-STUB-1` |
| G-15 | "Migration `0008`" | blueprint rows 129, 130, 132, 136: one migration | `dbc-4` §N.8 (D-DB-17): the set `0008` + `0009`, version `(3, 'dbc-4')` | the set | none |
| G-16 | Badge in Simulated client mode | `ux` §8f.3 and record decision 9: the badge is shown on the simulator's devices and demo items | D83: not shown there; the mode banner says it; the mark stays in the manifest and the verify result | D83 | `M4-DEVSRC-LABEL-*`, `M7-DEVSRC-EVID-*` |
| G-17 | Reveal control for the typed password | `ux` §8d.3, §14.3: none | D86 C-1: allowed — off by default, hidden on blur, submit and close, never on in a gate capture | D86 C-1 | `M4-SEC-UI-1`, `M4-UX-A11Y-1` |
| G-18 | The host in audit rows | C3 §5.2: `CAPTURE_CONNECTION_TESTED` "never … the host" | D86 C-3: `host` and `endpointRef` in the two audit types for `PRODUCTION` candidates | D86 C-3 | `M4-SEC-AUD-1`, key list of `M4-AUD-1` |
| G-19 | The typed user name | shared redaction lets `username` through in text form and in the body of op 89 (SEC35-36) | D86 C-6: credential material | D86 C-6: the canary sweep covers the user name | none |
| G-20 | Two answers with one identity | `cap` §A.6.1: "de-duplicated by endpoint reference, the first source address is kept" | SEC35-28: both listed with `conflict`, neither testable; `addressChanged`; the C3 shape has no such members yet | SEC35-28 | `M4-SEC-DISC-2`, `M4-DISC-W` |
| G-21 | Verify check count | blueprint rows 85, 86, 89 and this file's `M7-VV-SRV`: 14 | `ev` §D: 15 after row 141 | 14 at row 85, 15 from row 141; the M7 gate runs 15 | none |
| G-22 | Manifest field count | blueprint row 83: "120-field manifest" | `ev` §B: 128; D81: row 83 builds fields 124-128 from its first build | 128 | `M7-REF-1` reference taken once |
| G-23 | Reset guard and development packages | `dbc-3` §E.2, `M2-MT-6`: every `REAL` sealed row blocks | D83 (O-5), SEC35-42: `development_sources IS TRUE` with the cross-check is exempt — **U-2, not yet confirmed by the user** | the exemption | if the user declines U-2, `M4-SEC-RESET-1` asserts "development packages block too" |
| G-24 | When the four source rows are written | `dbc-4` MR-S1: in the transaction that persists `RECORDING`, before capture starts | D84, `cap` §A.6.5: a session shows "recording" only from the first durable fragment | the rows are written in the transaction that takes the session into capture, before `app.capture.start`, whatever state name row 71 gives it; a failed start leaves the rows and no evidence item | `M5-SRC-REC-1` |
| G-25 | Development devices with the flag off | C3 §2.6: with the flag off ops 76 / 77 list 0 `DEVELOPMENT` devices | C3 "Simulator" and `dbc-4` §N.9 (O-2): the seeded built-ins are `FAKE` and stay listed and inert in `SIMULATED` | the "0 listed" rule holds in `REAL_PRODUCTION`; `SIMULATED` lists its `FAKE` devices as today | `M4-LOCAL-SEL-1`, `M4-SEL-*` |
| G-26 | Development sources in a search result | C3 §2.6: in development mode a search also lists the loopback development sources | D83 (O-8): local devices enter by row 136's registration, not by adoption | situation A is decided on `responderCount = 0` of the probe alone; listed development sources never make an empty search non-empty | `M4-NODEV-A-1`, `M4-DISC-EMPTY-*` |
| G-27 | How a booted lane Core reaches the stub | `cap` §A.6.1: an injected loopback probe target | SEC35-27 (6): passed by no file under `src/` outside test support | the lane Core of the client checks is started by a test-support launcher that injects the target; not specified in any spec | CR-5 wording |
| G-28 | Pins at row 132 | blueprint row 132: "pins equal the C3 totals of row 121" (97) | ops 95, 96 and two audit types land with row 142, after row 132 | final totals asserted after the later of rows 132 and 142; row 132 states its intermediate values (95 / 36 / 59 if it lands 93, 94, 97) | `M4-PIN-1` |
| G-29 | Audit rows of raise, clear, raise | specs R-10 AC-5: "2 alerts, 2 audit rows" | C3 §5.4: A = search rows; B = 2 `CAPTURE_DEVICE_UNREACHABLE` rows, none on resolve; C = `FAULT_RAISED` twice plus `FAULT_CLEARED` | per situation, as C3 | `M4-NODEV-A-1`, `M4-NODEV-B-1`, `M5-NODEV-C-1` |
| G-30 | Vendor field | specs R-9 AC-2 and C3 `CaptureCandidate`: vendor / model / name | `cap` §A.6.1 V-9: ONVIF has no vendor scope category | name and hardware hints asserted; vendor may be null | none |
| G-31 | Recording in `REAL_PRODUCTION` | `cap` §A.1.2 row 2: "nothing is recordable until a real camera is adopted"; specs R-9 AC-5: assignable after a successful test | D82, D86 C-5: an adopted real camera is assignable but not recordable in this phase; no listener for a kind without an opener | D86 C-5 | `M5-SEC-SRC-1`, `M4-LOCAL-PLAN-1` |
| G-32 | Local-device media in `docs/` | specs R-11 AC-8: no frame or audio excerpt | SEC35-44 (2): also no waveform, spectrogram, transcript text or playback screenshot | the wider rule | `M4-SEC-PRIV-1`, `M5-LOCAL-CLAP-1` |
| G-33 | Owner of operation 97 and of the server side of op 89 | C3: built in M4 by rows 132, 133, 136, 142 | no blueprint row names op 97; row 142 names op 89 only as the credential source | `M4-MIC-RESCAN-1` -> row 133; op 89 -> row 142 (sealer: row 84) | owner cells |
| G-34 | Kill before the first durable fragment (not R-9..R-11; found while reading D84) | this file §F.1 P1 and `M7-KM-P1-*` (7 active + 2 conditional cells): the durable part is sealed, interrupted | D84: `FAULTED` with nothing durable is a failed start with no evidence item | **not decided here** — matrix and counts unchanged; note in §F.1 | up to 7 active cells change or drop |

## 7. Decisions for the controller to record

| # | Decision / open point | Kind |
|--:|---|---|
| 1 | The delta is 111 checks; totals **330 active + 10 conditional = 340 named** (150 run 2+1, 180 once). Accepting it also accepts the load of section 4 (177 executions for the new 2+1 checks) | to confirm |
| 2 | **D84 against the kill matrix (G-34).** D84 makes a session that ends `FAULTED` with nothing durable a failed start with no evidence item. Phase P1 of §F.1 kills before the first durable fragment and its seven active cells (`M7-KM-P1-0`, `M7-KM-P1-S1..S6`) plus two conditional ones expect an interrupted seal. Not changed by this row (outside R-9..R-11); a dated note is in §F.1 | **needs a ruling** |
| 3 | `M4-DISC-REC-1` defines the lift of the 409 during `RECORDING` as one constant with a static pin that fails while the gate artifact does not record `M4-SEC-DISC-1` and `M4-SEC-DISC-3` as PASS. The `details.reason` of that 409 has no name in the contract | to confirm; name at row 128 |
| 4 | `M4-DISC-LAN-1`: the two producing runs of row 131 are adapter-level (rows 132 / 133 do not exist yet); the R-10 notification on N = 0 is asserted in the gate's +1 through op 93. "Not run" is decided by a send error or by the interface output-packet counter not rising — a method proposal for row 131 to confirm (H-13). The check runs outside the command sandbox | to confirm |
| 5 | `M5-LOCAL-CLAP-1` is class `1`, manual-with-user, one execution; the gate reads its record. The two run-count classes of the catalogue stay the only ones | to record |
| 6 | Owners assumed where no blueprint row names the work: op 97 -> row 133; server side of op 89 -> row 142; `M5-SRC-REC-1` -> row 71; `M7-CONN-CRED-1` -> row 84; reset-guard change (`M4-SEC-RESET-1`) -> row 129; `M5-SEC-PRIV-2-*` built by rows 137 / 138, run with row 140 | to confirm (task-architect) |
| 7 | Unit, static and contract checks of rows 131-142 run once per checkpoint although several Verification cells say "2 runs" for the whole row; section 5 gives the sentences | to confirm (task-architect) |
| 8 | `M4-SEC-RESET-1` asserts the exemption of D83 (O-5) with the three conditions of SEC35-42; if the user declines U-2 the check flips to "development packages block too" | depends on the user (U-2) |
| 9 | Checks that need the user or leave the command sandbox: `M4-LOCAL-CAM-1`, `M4-LOCAL-MIC-1`, `M5-LOCAL-E2E-1`, `M5-LOCAL-CLAP-1` (macOS permission; U-3 answered before row 134), `M4-DISC-LAN-1`. A missing permission reads "blocked: user action", never a fail and never a generated input in its place | to record |
| 10 | How a booted lane Core is pointed at the fake stub for the client checks is not specified in any spec (G-27) | for row 128 |
| 11 | `M6-STTCFG-API` and the other R-8 checks are unaffected (checked): the `503 CREDENTIAL_STORE_NOT_READY` rule is shared, nothing in their text moves | to record |
| 12 | One old table defect was repaired in passing (section D.2, an unescaped pipe character inside a command), because the row brief required every table row to match its header | to record |
| 13 | `masterplan/02_plan.md` (tracking table) and `test/01_test_report.md` were not written: the row allows two files only. The plan's tracking entry for row 127 is the controller's | to record |

## 8. Erratum rows for `masterplan/11_audit_errata.md` (not edited; for the controller to place)

Format of its §5.1. Line numbers are after the edit (`grep -n`, 2026-10-09). These are a
requirements delta, not corrections of a wrong sentence, except PE-127-11 (b).

| ID | `masterplan/10_test_strategy.md` line | old text (abridged) | new text | source | decision |
|---|---|---|---|---|---|
| **PE-127-01** | 9, 30, 35, 56-63, 1040 | front matter without a delta key; short forms end at `ux`; "There is no third class…" | key `delta_row_127`; short forms `dbc-4`, `sec`; paragraph pointing to §A.4a, the manual check in class `1`, "not run" as a valid outcome; footer | `identification/02_structured.md:379` | D73, D78, D80-D86 |
| **PE-127-02** | 216-382 | (no section) | §A.4a: rules CR-1..CR-7 and eight check tables, 111 checks (M4 91, M5 11, M7 9) | records of rows 120-126; `01_specs.md` §B.2 | D73, D78, D80-D86 |
| **PE-127-03** | 384-436 | (no table) | traceability: 32 acceptance criteria -> named checks with method, depth, owning row, negative control | `01_specs.md:287-333` | D73 |
| **PE-127-04** | 438-526 | (no table) | index of changed existing checks (before / after); the 34 assumed values G-1..G-34 for row 128; count of the section | D80-D86; the seven input specs | D86 C-8 |
| **PE-127-05** | 139, 146, 149, 150, 152, 155 | `M2-LANE-1`, `M2-MT-6`, `M2-API-1`, `M2-API-2`, `M2-PIN-1`, `M2-AUD-1` at the M2 values | dated sentences: schema 3 / `dbc-4` after row 130; reset-guard exemption; targets 97 / 36 / 61, offline 31, 67 types, re-pinned by `M4-PIN-1` / `M4-PIN-2` | `03_api_contract.md` §10.1; `04_database_contract.md` §N.11 | D83, D86 |
| **PE-127-06** | 175, 177 | `M3-SR-1`: G-R1..G-R8; `M3-RTSP-BIND-1`: worker sockets | from M4 the guard file also holds G-R9..G-R15 (`M4-SR-1`); the discovery socket is the Core's (`M4-DISC-SOCK-1`), helpers bind nothing | `05_capture_architecture_spec.md` §G.1 | D75, D82 |
| **PE-127-07** | 201-204, 209-214 | M4 gate set 14; `M4-SEL-W/T/P`, `M4-LOCK-1`, `M4-FAKE-1`, `M4-PC-1` | gate set 14 + 91 = 105; adopted `CAM-NN` selectable; ops 89 / 95 / 96 locked, 93 / 94 / 97 not; adapters in the Core process, discovery no longer class C; controls G13-G17 | `03_api_contract.md` §3.1; `05` §A.1.1 | D80(4), D82, D83, D86 C-4 |
| **PE-127-08** | 533-536 | M5 gate set 13 | 13 + 11 = 24 | `identification/02_structured.md:327` | D78 |
| **PE-127-09** | 595-598, 603, 609 | M7 gate set 52 + 10 conditional; `M7-REF-1`; `M7-VV-SRV` "14 checks" | 61 + 10 conditional; reference on a manifest with fields 124-128; 15 checks from row 141 on | `06_evidence_package_spec.md` §B.12, §D | D81 |
| **PE-127-10** | 746, 755-759 | pin families at the M2 values; X-PIN-1 stale list | one row for the R-9..R-11 pins; the stale list extended | `03` §10.1; `04` §N.12 | D83 |
| **PE-127-11** | 769, 792, 800-807 | (a) guard row of `src/capture` with G-R1..G-R8; (b) "expected at M9" row with an unescaped pipe character (4 cells under a 3-cell header) | (a) G-R9..G-R15 from M4, no new guard file, counts unchanged, the network scanner's two exemptions; (b) the pipe escaped | `05` §G.1; SEC35-27 | D82 |
| **PE-127-12** | 846-852 | P1: "the durable part is sealed" | open-point note: D84 makes that case a failed start with no evidence item; matrix and counts unchanged | `decisions/decisions.md:97` | D84 (ruling pending) |
| **PE-127-13** | 901-904 | exclusions end at "real hardware checks" | four rows: real camera credentials, local-device media, macOS permission, identifiers of devices on the user's network | `01_specs.md:302`, `:331-332` | D74(3), D75, D76(4), D86 C-7 |
| **PE-127-14** | 938, 939, 941 | `X-MEDIA-1`, `X-PIN-1`, `X-SEC-1` | dated sentences: local-device stills / waveforms / transcripts; the new stale values; device-identifying patterns and the canary prefixes | record of row 126 §6 | D86 C-6, C-7 |
| **PE-127-15** | 947, 948 | "M4 14, M5 13, … M7 52 … 219 active … 229 named — 91 run 2+1 … 128 run once" | "M4 105, M5 24, … M7 61 … 330 active … 340 named — 150 run 2+1 … 180 run once" with the erratum sentence carrying the arithmetic; new self-gate row "32/32" | this row | D73, D78, D83 |
| **PE-127-16** | 955, 960-961, 967-969, 972, 975-977, 986-1014 | section L items 1, 2, 4, 5 as of the pair-review re-pin | re-run notes; the row-127 step of the class arithmetic; item 6 = the mechanical recount with its output | this row | — |
| **PE-127-17** | 1028-1033 | section M ends at the second-gate bullet | bullet for row 128 and for the task-architect | this row | — |
| **PE-127-18** | 659-664 | class-C register: "C-2/C-1/C-3/C-4 real adapters and ONVIF/PoE" | unauthenticated discovery and the connection test on fixtures are scheduled; actions on a real camera and the pull path stay class C | `05` §J H-7a / H-7b | D75, D82, D86 C-5 |

## 9. Limits

| Limit | Consequence |
|---|---|
| Documentation-only row: no test, no probe, no device, no network traffic | every pass criterion is a specification; none is evidence |
| `06_evidence_package_spec.md` §B.12 / V-15 / §H.5 and UX flows 9-13 were taken from the records of rows 124 and 125 and `ux` §14-§15, not re-read in full | report-line wording and state names in `M7-DEVSRC-*` and the client checks follow those records |
| Several response members and reason values the checks name do not exist in the contract yet (`conflict`, `addressChanged`, `interfaceCount`, `guardTripped`, `SOURCE_KIND_NOT_RECORDABLE`, the 409 reason during `RECORDING`, `sources` on op 41) | they come from the accepted security findings; row 128 writes them into C3 or the check texts move (section 6) |
| The interface-counter method for "no probe left the interface" is a proposal | row 131 confirms or replaces it (H-13) |
| Line numbers of section 8 are those of the file as written by this row | a later edit of the file shifts them |

## 10. Files

- Updated: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/masterplan/10_test_strategy.md`
- Created: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/delegation_progress/test_expert_row127.md`

---
*Generated: 2026-10-09*
*Last Updated: 2026-10-09*
