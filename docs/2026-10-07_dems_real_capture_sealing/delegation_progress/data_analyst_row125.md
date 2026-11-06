---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-09
agent: data-analyst
blueprint_row: 125
type: requirements (client UX delta, record of the row)
tier: 3 (working record of a Tier 1 edit)
status: needs-review
confidence: HIGH for the states, refusals and texts mapped to the contract of row 121 and for the counts; MEDIUM for the surfaces that depend on members the contract does not carry yet (open items OP-125-1..5)
file_edited: masterplan/08_client_ux_spec.md (717 -> 1575 lines)
source_structured_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/02_structured.md (row 125, line 377)
decisions: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/decisions/decisions.md (D72(k), D73-D78, D80, D81)
last_updated: 2026-10-09
---

# Row 125 — client UX delta for R-9, R-10, R-11 (record)

## 1. What was done

One file edited: `masterplan/08_client_ux_spec.md`. No other spec, no blueprint, no tracker, no
decision file, no errata file and no code was written. No implementation plan was created
(`masterplan/02_plan.md` is not in this row's output).

Baseline: the file was unmodified against HEAD `101ce62` before the edit, so
`git diff --stat HEAD -- docs/2026-10-07_dems_real_capture_sealing/masterplan/08_client_ux_spec.md`
shows exactly this row: `1 file changed, 869 insertions(+), 11 deletions(-)`. The 11 removed lines
are lines replaced by an extended version of themselves (2 front-matter lines, the footer, flow 1
§2.2 step 2 and §2.5 "Empty device list", flow 5 §6.2 step 6, flow 7 §8.2 step 4, four pattern rows of
§9). No existing flow, control or count was removed or renumbered. Edits were applied by a script
with 24 single-match anchors; a pre-edit copy is in the session scratch directory
(`row125/08_pre_row125.md`).

Status is **needs-review**, not complete: the delta is written and its own gate passes, but five
surfaces rest on members or an operation the contract does not carry (section 5), and two
presentation choices depart from the wording of the brief (OP-125-7).

## 2. Result against the row's verification (as amended by D80 / D81)

| Verification | Result | Where |
|---|---|---|
| Each flow has its states listed for web, tablet and phone | 5/5 new flows (9-13) | §8c.2, §8d.4-§8d.10, §8e.2, §8f.2-§8f.3, §8g.1, §8g.3 |
| The client set allowed to write a credential, with its source | **Web console only** — D80(3) (`decisions/decisions.md:93`), server-enforced by `WEB_CONSOLE_SESSION` on ops 89, 95, 96 | §8d.1 |
| 0 flows show a stored credential | 0 of 13 (per-flow table) | §13.1 |

Totals restated in §13.1: flows 7 + 1 + 5 = **13**; client definitions **39**; gated controls
10 + 2 + 6 = **18** (46 client instances); gated reads 6 + 1 + 1 = **8**; proposed i18n keys **120**
(counted by script: table rows starting with `` | `common. `` in §14.2). Register items touched:
WB 7 of 11 by screen (+2 by label), MB 8 of 13 by screen (+1 by label); no new id minted.

Checks run after the edit: every mark PE-125-01..19 occurs at least once; table column counts are
consistent in every table (one mismatch reported, line 483 — an old row whose cell holds a literal
`|` in a regular expression, not touched); three code claims re-run:
`grep -rl "captureConfig\|captureDevices" apps/core-web/src apps/mobile/src` = 0 files;
`grep -rn "ermissions…\|ermissions\.\.\." apps/core-web/src packages/shared/src` = 0 lines;
`grep -c "developmentSources" masterplan/03_api_contract.md` = 0.

## 3. Decisions taken in this row (for the controller to record)

| # | Decision | Reason |
|--:|---|---|
| 1 | The typed user name and password stay in the open dialog's form state for the two requests (op 95, then op 96) and are cleared on close; they are not asked twice | row 121 left it to this row; a second typing doubles the chance of a typo against a guard of 3 failures per camera |
| 2 | After an *authentication failed* outcome the password field is cleared; after *reachable* both fields become read-only until "Change" | the adoption must send exactly what was tested |
| 3 | Close and Escape are disabled while a test or an adoption is pending | the request cannot be recalled; no half state is drawn |
| 4 | No reveal control for the typed password (as §8a) | conservative; put to row 126 as OP-125-6 |
| 5 | The search progress is a bounded bar from Core instants with a fixed "up to N seconds" text; rate limits show a fixed number and re-enable by themselves — no ticking label, no automatic retry | R-10 AC-4; §2.7 forward-only rule |
| 6 | "Session open" and "web console only" are disabled, explained states; never a toast | D80(3), D80(4) as ruled |
| 7 | On tablet and phone the pointer says "search there": a list belongs to the session that searched, so the web console has its own list | `C3 §2.6` ownership rule |
| 8 | One badge "Development source"; the kind is a secondary text ("This Mac's camera", "Test source"); `FAKE` is called "Test source", not "Simulated" | R-11 AC-6; "Simulated" already names the client mode |
| 9 | In Simulated mode the badge is shown on the simulator's devices (they are `FAKE`); no empty-search scenario is added to the simulator | one rule drawn from data; D81 "truthful" |
| 10 | The microphone action keeps the visible label "Search again" with an explaining description and the accessible name "Search again for microphones" | R-10 AC-4 names one action; D80(5) |
| 11 | Flow 8 (STT) is now counted in the totals, including its read (op 90) as a gated read | the status sweep PE-R8-13 left the figures unrestated |

## 4. Erratum rows for `masterplan/11_audit_errata.md` (not edited; for the controller to place)

Format of its §5.8: ID | line after the edit | old text (abridged) | new text | source | decision.
These are a requirements delta, not corrections of a wrong sentence.

| ID | `08_client_ux_spec.md` line | old text (abridged) | new text | source | decision |
|---|---|---|---|---|---|
| **PE-125-01** | 28, 50-56, 1575 (front matter, authority note, footer) | decisions "(D4, D8, D10, D12)"; no rev 2.3 note | rev 2.3 decisions named; paragraph on flows 9-13 and the binding rulings; dates | `identification/02_structured.md:377` | D73, D78, D80, D81 |
| **PE-125-02** | 99-111 (§0) | (no table) | table "Rev 2.3 rulings applied by flows 9-13" (D80(2)-(7), (9)-(11), D81) | `decisions/decisions.md:93-94` | D80, D81 |
| **PE-125-03** | 129-134 (§1) | catalogue ends at flow 7 | rows 8 (restated), 9-13 with operations, slices, audit | `masterplan/03_api_contract.md` §2.5, §2.6, §3.1, §5.4 | D73, D80 |
| **PE-125-04** | 160, 197, 198, 209 (flow 1) | two seeded camera rows; "No capture devices configured"; no development refusal | adopted cameras selectable; badge; the empty state gains "Search for cameras"; `DEVELOPMENT_SOURCE_NOT_ALLOWED` row; "Source options" row | `01_specs.md` R-10 AC-1, R-11 AC-2; `03` §3.1 | D73, D80(9) |
| **PE-125-05** | 281 (flow 2 §3.6) | (no row) | badge on mic meters and tiles | `01_specs.md` R-11 AC-6 | D73 |
| **PE-125-06** | 445, 482 (flow 5) | verify without a source line | "DEVELOPMENT SOURCES — …" first, verdict unchanged; badge on item and files from the manifest or the verify result | `06_evidence_package_spec.md` §B.12, §D.1 | D78(2), D80(9), D81 |
| **PE-125-07** | 576, 599, 600 (flow 7) | "precheck states (existing)" | reachability check, start rule, two new situations | `03` §3.1 | D72(k), D80(6), D81 |
| **PE-125-08** | 638-677 (§8b, new) | — | frame of the delta (5W1H) and the table of existing building blocks per client | client sources read on 2026-10-09 | D73; standing rule "ready-made kit" |
| **PE-125-09** | 680-775 (§8c, new) | — | flow 9 "Search for cameras": 13 states × 3 clients, row content, freshness and ownership, G13 | `03` §2.6 (ops 93, 94) | D74(1), D76, D80(1), D80(4), D80(10) |
| **PE-125-10** | 778-907 (§8d, new) | — | flow 10 "Connect a camera", web console only: prompt rules, five outcomes, refusals incl. the state before row 84, adoption result, abandon / close, tablet and phone pointer, G14-G16 | `03` §2.6 (ops 95, 96), §4 | D76, D80(3), D80(4), D80(7), D81 |
| **PE-125-11** | 910-975 (§8e, new) | — | flow 11: situations A, B, C and C-degraded with placement per client, severity, text keys, action, clearing; the operator without `CAPTURE_CONFIG` | `03` §5.4; `01_specs.md` R-10 | D72(h)(i)(k), D80(2), D80(8) |
| **PE-125-12** | 978-1059 (§8f, new) | — | flow 12: the one badge, 7 surfaces with data sources, sealed-item rules, local-device rows (4 states), production / Simulated-mode / privacy rules | `03` §2.6 "Device shapes"; `06` §B.12, §D.1 | D74(2), D78(2), D80(9), D80(11), D81 |
| **PE-125-13** | 1062-1126 (§8g, new) | — | flow 13: op 97 states, the start rule at pre-check incl. the active-microphone rule, G17, G18 | `03` §2.6, §3.1 | D80(5), D80(6), D81 |
| **PE-125-14** | 1138, 1141, 1144, 1147 (§9) | P-04, P-07, P-10, P-13 without the new flows | one sentence each (one new factory; blanking of `username` / `secret` / `credential`; constant border on the search list; 18 controls + 8 reads) | `drift §2.1` | D73 |
| **PE-125-15** | 1187-1194, 1201-1206 (§11) | inventory ends at G10; "10/10", "6/6" | rows G11-G18; restated 18/18 controls, 46 instances, 8/8 reads (baseline figures kept) | §8a (PE-R8-13) | D24, D73 |
| **PE-125-16** | 1223 (§12) | (no row) | camera search and development sources: this phase vs class C | `01_specs.md` R-11 AC-10 | D80(11) |
| **PE-125-17** | 1246-1320 (§13.1, new) | — | self-gate of the delta; "stored credential shown" 0 of 13; totals with arithmetic; register items touched; list of changed existing text | this row | D73 |
| **PE-125-18** | 1330-1512 (§14, new) | — | vocabulary table; 120 proposed keys with texts; accessibility table | `packages/shared/src/i18n/en/common.ts` (read only) | D73 |
| **PE-125-19** | 1516-1570 (§15, new) | — | hand-over to rows 126, 127, 133, 137, 138, 139 (+128, 141); 20 named check families; open items OP-125-1..7 | `masterplan/10_test_strategy.md:192-194` (naming) | D73 |

## 5. Open items and blockers for the controller (also §15.3 of the spec)

| ID | Item | Owner |
|---|---|---|
| OP-125-1 | **D81's "toggle to a reachable mic" at pre-check has no operation.** Op 80 answers `409 CAPTURE_CONFIG_LOCKED` once a session exists (the pre-check runs on a session in `PRECHECK`, `packages/shared/src/api/sessions.ts:248`); op 81 is valid only in RECORDING; `03_api_contract.md` §3.1 (lines 559-562) still carries the proposal that predates D81. The spec fixes control G18, its texts and a fallback path that works today (cancel, set primary on Devices, start again) | rows 121 / 128 |
| OP-125-2 | `CaptureDevice` has no `credentialSet`: a registered camera cannot show "Password set" after the dialog closed | row 128 |
| OP-125-3 | The contract carries neither the package mark on ops 39 / 40 nor the `sources` block on op 41 (row 124 A-2): the evidence-list badge and the verify line have no response member | rows 121 / 128, 122 |
| OP-125-4 | A local **camera's** named cause (permission denied, busy) reaches a client only in the situation-B alert of a pre-check; op 97 reports microphones only | rows 123 / 128 |
| OP-125-5 | Which state follows the situation-C fault when nothing is durable (tablet hand-off to Recovery) | rows 71 / 139 |
| OP-125-6 | No reveal control for the typed password against a guard of 3 failures | row 126 |
| OP-125-7 | (a) tablet / phone name the local devices "Core Mac's camera / microphone" (the brief says "This Mac's …", which is right on the web console only); (b) the badge appears across Simulated mode | controller / user |
| — | Wording to reconcile with D80(3): blueprint rows 125 and 138 ("the connect flow for the roles and clients row 125 allows" = none on tablet / phone; its "fixture credentials … never rendered" acceptance has no password field to test there), `01_specs.md` R-9 AC-5 ("2 + 1 on each client that row 125 allows" = web only) and AC-12 | row 128 / task-architect |
| — | Finding: the web console has no "Checking your permissions…" string at all today (mobile only, `apps/mobile/src/i18n/en.mobile.ts:35`); proposed as the shared key `common.rbac.checking` | rows 67 / 137 |
| — | Finding: the capture selector of flow 1 is not in either client yet (0 files), so rows 137 / 138 build on rows 67 / 68, as their dependencies already say | — |

## 6. Files

- Updated: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/masterplan/08_client_ux_spec.md` (717 -> 1575 lines)
- Created: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/delegation_progress/data_analyst_row125.md`
- Not touched: `11_audit_errata.md`, `03_api_contract.md`, `04_database_contract.md`, `05_capture_architecture_spec.md`, `06_evidence_package_spec.md`, `10_test_strategy.md`, the blueprint, the trackers, the i18n file and all code.

---
*Generated: 2026-10-09*
*Last Updated: 2026-10-09*
