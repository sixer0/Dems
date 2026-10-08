---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: verifier
blueprint_row: 39
milestone: M0
tier: 2
type: specification gate
source_register: research/03_analysis.md (row 6)
source_plan: masterplan/02_plan.md (row 37)
inputs_read:
  - identification/02_structured.md row 39 (Verification column)
  - research/03_analysis.md (row 6 register; errata E-01..E-31, register rows, W1-C7 line 335)
  - decisions/decisions.md (D1-D14)
  - masterplan/01_specs.md (28), 03_api_contract.md (29), 04_database_contract.md (30),
    05_capture_architecture_spec.md (31), 06_evidence_package_spec.md (32), 07_transcript_spec.md (33),
    08_client_ux_spec.md (34), 09_security_design_review.md (35) + gateway_check/06_security_remediation.md,
    10_test_strategy.md (36), 02_plan.md (37)
  - test/01_wave_a_regression.md (row 27, ground truth), gateway_check/04_m1_spike_gate.md (row 38, ground truth)
status: passed
verdict: M0 GATE PASS — 0 blocking gaps; 2 rev-2-items and 3 informational items routed
gate_rule: FAIL only if a blocking gap exists; a rev-2-item or informational item does not fail the gate but is listed for row 40
last_updated: 2026-10-07 15:14
---

# M0 spec gate — cross-check of rows 28-37 against the row-6 register (row 39)

Independent verification by reading and grepping the nine documents under review against the row-6
register (`research/03_analysis.md`), the applied security remediation
(`gateway_check/06_security_remediation.md`) and the two ground-truth artifacts (row 27
`test/01_wave_a_regression.md`, row 38 `gateway_check/04_m1_spike_gate.md`). No document under review
was edited; every finding is routed to its producing row. Test suites were not re-run: row 27's run
window was 21:56-22:10 and row 38's 17:24-17:29 (both same day, both green), and I found no reason to
doubt them (spot-checked their internal arithmetic in C9).

## Gate rule (stated up front)

**FAIL only if a blocking gap exists.** A *rev-2-item* (a stale line the plan has already handed to
row 40, or a non-normative doc-sync) and an *informational* item (a historical record or a
citation-level nuance) do **not** fail the gate but are listed for row 40. Blocking = a normative
requirement that is missing, self-contradictory, or wrong in a way that would misdirect M2-M9
implementation with no already-recorded pickup.

## The three mandated counts (stated explicitly)

| Count | Target | Measured | Evidence |
|---|---|---|---|
| Errata coverage | 31/31 | **31/31** reflected in substance (5 are citation-only, carried by the register) | `research/03_analysis.md:88` "Errata ledger count: 31/31 mapped, 0 dropped"; C1 table below |
| Requirement trace | 7/7 | **7/7** R-1..R-7, each with measurable acceptance criteria in row 28 and a R -> spec -> plan chain | `masterplan/01_specs.md:489` "R trace: 7/7"; R-1..R-7 at `01_specs.md:137-211`; `02_plan.md:484` |
| Answered gate decisions | 29/29 | **29/29** = 26 OD (OD-01..OD-26) + Q-AUTO + Q-INSTALL + Q-HW | `masterplan/01_specs.md:490` "gate answers cited: 29/29"; 26 `^\| OD-nn \|` rows + 3 `^\| Q- ` rows counted in `01_specs.md` §D |

## Checklist table (C1..C9)

| Check | Target | Measured | Result |
|---|---|---|---|
| C1 errata coverage | 31/31 | 31/31 reflected; 5 citation-only line refreshes carried by the register | **PASS** (GAP-04 informational) |
| C2 requirement trace | 7/7 | 7/7 R, 27 measurable criteria, R -> spec -> W-row chain complete | **PASS** |
| C3 gate answers applied | 29/29 + D7 flag | 29/29 applied; D7 OD-24 amendment present and flagged; 5/5 superseded only-as-superseded | **PASS** |
| C4 numeric consistency | all pinned numbers agree | Agree in the authoritative rows 29/30/37; row 36 carries 4 stale counts (already handed to row 40) | **PASS** (GAP-01 rev-2-item) |
| C5 remediation landed | 21 APPLIED / 2 DEFERRED | All four Highs' normative text present; both deferred items have named targets | **PASS** |
| C6 prior gates cited correctly | row 38 + row 27 cited | Both cited with artifact names that resolve to real files | **PASS** |
| C7 plan integrity | 6 sub-items | All hold (lane re-creation, WS fields 44/44, max wave 4, 0 collisions, 3 flags landed, F-1..F-8) | **PASS** |
| C8 forbidden-content sweep | 0 violations | 0 live violations across the nine documents | **PASS** |
| C9 ground-truth statements | match artifacts | Match row 27 and row 38 exactly | **PASS** |

### C1 — errata coverage (31/31)

High-impact errata, quoted evidence:

| Erratum | Register before/after | Owning spec must show | Evidence / GAP |
|---|---|---|---|
| E-01 | one FAULT_KIND CHECK -> three sites (`:281/:382/:488`) | row 30 | `04_database_contract.md:475` "C.1 ... `0001_tables.sql:281` (E-01 site 1 of 3)"; `:483` site 2; `:491` site 3 "the row the map missed"; `:827` "3/3 FAULT_KIND CHECK sites with file:line" |
| E-03 | retire SC8 "simulator untouched" at M2 | row 28/37 | `01_specs.md:279` OD-23 "retire SC8 'simulator untouched'; Simulated regression against `c2c983b` at M2 and M9" |
| E-04 | capture uses `CaptureResource`, never `AdminResource.DEVICES` | row 29/31/34 | `03_api_contract.md:682` "**0 uses of `AdminResource.DEVICE[S]` for capture** (E-04)"; `:566` "never a value added to `AdminResource`"; `05_capture_architecture_spec.md` G-R5; `08_client_ux_spec.md:109` "**never** reuse `AdminResource.DEVICE[S]`" |
| E-05 | path is `apps/core-server/src/index.ts:16`, not shared | row 31 | `05_capture_architecture_spec.md:353` "CS-03 `apps/core-server/src/index.ts:16`"; `:572` |
| E-06 | ledger 71/1,851 etc. | row 27/36 | row 27 §4 `test/01_wave_a_regression.md:163-172`; row 36 §C |
| E-13..E-17 | client drifts | row 34 | `08_client_ux_spec.md:606` "E-13..E-17 handling (5/5)"; per-item table `:607-616` |
| E-18 | CS-25 capture constants in `@dems/shared/api` | row 29 | `03_api_contract.md:578` "Constants in `@dems/shared/api` (CS-25)"; `:581` |
| E-19 | lanes folded into `dbc-3` §F path | row 30 | `04_database_contract.md:670` "lanes do not exist (E-19/E-20)"; `:795` "CS-17 ... E-19 folded (lane path F)" |
| E-20 | reseed only `dems_demo` | row 30/32 | `04_database_contract.md:666` "E.3 What reseeding `dems_demo` does (OD-02 L2; E-20)" |
| E-21 | model on disk (MLX excluded) | row 33 | embodied `07_transcript_spec.md:82/148-161`; tagged in register only (GAP-04) |
| E-22 | no benchmark on this Mac | row 33/36/40 | `07_transcript_spec.md:336-341` "records no RTF, no WER"; `01_specs.md:189` AC-4 "Cites E-22" |
| E-23 | 2+1 checks; no long loops | row 36 | `07_transcript_spec.md:267` "one **2 + 1** check"; `01_specs.md:189` "one **2 + 1** check" |
| E-24 | lane re-creation procedure | row 30 §F + plan M2-W1 | `04_database_contract.md:677` "F. Lane re-creation procedure ... E-24, D240"; `:696` "per-lane device re-pairing"; `02_plan.md:151` M2-W1 |
| E-30 | audit detail keys | row 29 | `03_api_contract.md:436-452` `AUDIO_SOURCE_SWITCHED` keys incl. `sendingDeviceId`; `:405` "B15/E-30" |
| E-31 | signed-URL prefix to BOTH blanking lists | row 29/32/34 | `03_api_contract.md:274-280` both lists (`error-sink.ts:52`, `log.ts:46`); `06_evidence_package_spec.md:637`; `08_client_ux_spec.md:447` |

All 31 errata are reflected in substance. Five pure line-number errata (E-07, E-08, E-09, E-10, E-11)
do not re-quote the corrected `file:line` in the owning spec; the corrected values live in the register
and the specs reflect the concept/adjacent lines (GAP-04, informational).

### C2 — requirement trace (7/7)

| R | Measurable criteria (row 28) | Traced to register / plan |
|---|---|---|
| R-1 | 3 (`01_specs.md:142`) | SH-01/SH-16, CS-25; plan M2-W6/M2-W7/M2-W9 (`02_plan.md:156-159`) |
| R-2 | 3 (`:152`) | SH-13, CS-03..CS-06; plan M3-W1/M3-W2 (`:167-168`) |
| R-3 | 4 (`:162`) | NM-01, SH-04; plan M5-W1/W2/W3 (`:175-177`) |
| R-4 | 5 (`:173`) | NM-04, CS-25, W1-C1; plan M3-W3 + M7-W4 (`:169`, `:205`) |
| R-5 | 5 (`:185`) | NM-06, NM-13, E-22; plan M6-W1..W4 + M7-W6 (`:211-215`) |
| R-6 | 4 (`:197`) | NM-07, SH-14, D-EV-1; plan M2-W10 + M7-W1/W6 (`:160`, `:203`, `:215`) |
| R-7 | 3 (`:208`) | NM-11, RK-12, SH-03; plan M6-W1 + M9-W5 (`:213`, `:257`) |

27 measurable criteria total; every criterion is verifiable on this Mac with fakes except those
explicitly marked class C (Core-device benchmark C-7, physical LAN C-5, Q-HW class-C rows), which the
specs gate behind explicit class-C entry criteria (`01_specs.md` §F; `02_plan.md:463`). No R lacks a
measurable criterion.

### C3 — gate answers applied (29/29)

- Row 28 §D lists all 26 ODs plus Q-AUTO, Q-INSTALL, Q-HW (counted mechanically: 26 + 3 = 29);
  `01_specs.md:490` states "gate answers cited: 29/29".
- The register's gate-answer mapping (§6) assigns each answered OD to its owning spec; the
  authoritative rows 29/30/31/32/33/34 each carry the assigned answers (e.g. OD-17 at
  `03_api_contract.md:64`, OD-14 at `:70`, OD-11/OD-09 at `08_client_ux_spec.md:71/208`).
- **D7 OD-24 amendment present and flagged:** `01_specs.md:280` "**D7 amendment:** this Mac reuses the
  installed oMLX server (`omlx-server`); portable `cpu-local` whisper.cpp for the x86 Linux Core is a
  later wave and is flagged for confirmation at the second blueprint gate"; echoed `07_transcript_spec.md:183`,
  `02_plan.md:418` F-6.
- **Superseded decisions (5/5 only-as-superseded):** D223 multitrack master, D226 benchmark plan,
  D219 MIC 1/2 mapping, AUDIO-MIX/channel attribution, MLX fp16 copy. `01_specs.md:293-297` retires all
  five; live text elsewhere references the superseded forms only as prohibitions
  (`03_api_contract.md:672` "Superseded items stay superseded: no multi-track master (D223->D224/D225),
  no benchmark plan ..."), or the `oMLX` engine (a different artifact, D7) rather than the MLX fp16 copy.
  Note (verified nuance): the token `D223` is dual-listed in the source blueprint — live in §1.2
  ("sealing waits for the transcript") and superseded in §1.3 ("master multi-track remux"); the specs'
  D223 uses are the live transcript aspect, never the superseded remux.

### C4 — cross-document numeric consistency

| Pinned number | Authoritative statement | Other occurrences | Result |
|---|---|---|---|
| Operations **89** (34 GET / 55 POST) | `03_api_contract.md:106`, `:650`, `:681`; `02_plan.md:98` | row 36 stale `88 / 54 POST` at `10_test_strategy.md:137`, `:360` | authoritative PASS; row 36 = GAP-01 |
| Op **89** `setCaptureDeviceCredential` | `03_api_contract.md:173`, `:207`; remediation §3 | op 89 grep-confirmed in row 29 only | PASS |
| New operations **14** (76-89) | `03_api_contract.md:104` | row 35 historical "13 new operations (76-88)" `09_security_design_review.md:64/79/173/175` | authoritative PASS; row 35 = GAP-03 (record) |
| Slices **28 -> 30** | `03_api_contract.md:546`, `:550`; `08_client_ux_spec.md:109`; `10_test_strategy.md:361` | agree | PASS |
| Tables **30 -> 39** (9 new / 5 changed) | `04_database_contract.md:56`, `:831`; `02_plan.md:99` | agree | PASS |
| Audit types **62** (9 new) | `03_api_contract.md:394`; remediation §6 | row 36 stale "7 new types (53 -> 60)" `10_test_strategy.md:143` | authoritative PASS; row 36 = GAP-01 |
| Error codes **40** (9 new; 31 -> 40) | `03_api_contract.md:342`; `02_plan.md:81` | row 36 lacks the 40 statement | authoritative PASS; row 36 = GAP-01 |
| Offline ops **23** | `03_api_contract.md:648-650` (`10 -> 23`); `02_plan.md:80` | row 36 stale "12 simulated ops / 22" `10_test_strategy.md:138` | authoritative PASS; row 36 = GAP-01 |
| OpenAPI `all` **0.3.0** / `offline` **0.2.0** | `03_api_contract.md:621-622`; `01_specs.md:273`, `:387`; `10_test_strategy.md:363` | agree | PASS |
| **205** active checks / **63** pin files | `10_test_strategy.md:537`, `:561`; `02_plan.md:105` | agree | PASS |
| **44** W-rows / **19** waves max **4** | `02_plan.md:71`, `:529`; `:570` | W-row token count 43 + G-13/14 = 44 | PASS |
| B2 live audit **53** | `test/01_wave_a_regression.md:287`, `:314` | `02_plan.md:430` (`54 -> 49` lock view) | PASS (distinct views) |

**On the task's stale-line note:** row 36 still says "88" / "34 GET / 54 POST" / "12 simulated ops" /
"7 new types (53 -> 60)". Row 37 §0 explicitly hands these to row 40 as **P-1/P-2/P-3**
(`02_plan.md:79-82`). This is therefore classified **accepted-as-rev-2-item, GAP-routed-to-row-36/row-40**
(GAP-01), not a blocking gap. Row 29 §10(6) (`:698`) is *not* a stale line: its `(88 -> 89)`,
`(22 -> 23)`, `(60 -> 62)`, `(38 -> 40)` are the pre-remediation -> post-remediation reconciliation
deltas and match row 35's pre-remediation counts (`09_security_design_review.md:208` "seven new audit
types (60 total)").

### C5 — remediation landed (21 APPLIED / 2 DEFERRED)

`gateway_check/06_security_remediation.md:54` "Counts: APPLIED 21, DEFERRED 2, REJECTED 0". Sample of the
four Highs, normative text verified in the owning spec:

| Finding | Owning spec text | Evidence |
|---|---|---|
| SEC35-01 | op 89 + `CAPTURE_CREDENTIAL_SET` | `03_api_contract.md:173` op 89 row; `:511-518` audit type; `:682` count 89 in self-gate |
| SEC35-02 | reveal control (single-module static rule + audit) | `04_database_contract.md:274-286` reveal control; `:599-605` grant; `:618` privilege matrix |
| SEC35-16 | REAL-evidence case scope, marked provisional | `03_api_contract.md:282-289` "REAL-evidence case scope (SEC35-16, provisional)" + "flagged needs user confirmation at the second blueprint gate"; `:147`, `:186-188` |
| SEC35-23 | bind-to-`127.0.0.1` | `05_capture_architecture_spec.md:165` §A.4 "Bind address (SEC35-23)"; `:184-187` check `M3-RTSP-BIND-1`; `:300-302` fixtures |

Deferred items have named targets: SEC35-18 -> M2 with check `M2-API-3`
(`06_security_remediation.md:289`; `03_api_contract.md:695`); SEC35-26 -> row 40
(`06_security_remediation.md:290`; `02_plan.md:473`). The two second-gate flags SEC35-16 and SEC35-02
plus SEC35-09 have confirm/reject landings in `02_plan.md:469-471`.

### C6 — gates already passed cited correctly

| Consumer | Citation | Resolves to | Result |
|---|---|---|---|
| Row 37 | `02_plan.md:96` "M1 spike gate (row 38) `gateway_check/04_m1_spike_gate.md` — **M1 GATE PASS 25/25**" | file exists; row 38 verdict `04_m1_spike_gate.md:34` "PASS — 25/25" | PASS |
| Row 37 | `02_plan.md:371-372` M0 wave-A `test/01_wave_a_regression.md` + `gateway_check/05_m0_spec_gate.md` | files exist (this report) | PASS |
| Row 36 | `10_test_strategy.md:54-55` M0 = `test/01_wave_a_regression.md`; M1 = `gateway_check/04_m1_spike_gate.md` (row 38) | files exist | PASS |
| Row 36 | `10_test_strategy.md:88` "artifact of record for every M1 check = `gateway_check/04_m1_spike_gate.md`" | file exists | PASS |

### C7 — plan integrity (row 37, spot-verified)

| Item | Evidence | Result |
|---|---|---|
| M2-W1 = lane re-creation + per-lane pairing | `02_plan.md:151` "lane re-creation + per-lane pairing: `db:create` `dems_lane_1..3`; ..." | PASS |
| Every W-row has class/milestone/owner/rollback | `02_plan.md:524` "44/44"; spot-checked 6 across M2/M5/M7/M9 (M2-W2 database-specialist, M2-W7 coder-execution, M5-W1, M7-W3, M9-W2 data-analyst, M9-W4 verifier/security/test/reviewer) all four fields present | PASS |
| No wave > 8 | `02_plan.md:529` "19 waves ... **Max size = 4 (W3)** — no wave exceeds 8"; sizes `:530` | PASS |
| Collision map: no duplicate path within a wave | `02_plan.md:349` "44 distinct W-row output paths ... 0 collisions"; mechanical check: each `implementation/NN_*.md` token appears exactly twice (left/right column of the two-pair table), 0 real duplicates | PASS |
| Three second-gate flags have confirm/reject landings | `02_plan.md:469-471` SEC35-16 -> M8-W1 + `M8-EV-SCOPE-1`; SEC35-09 -> M7-W3; SEC35-02 -> M2-W3 | PASS |
| OD-21/SP-4/D7/GStreamer/Q-HW recorded with block/does-not-block | `02_plan.md:413-420` F-1..F-8 (F-4 OD-21, F-5 SP-4, F-6 D7, F-7 GStreamer, F-8 Q-HW) | PASS |

### C8 — forbidden-content sweep

| Sweep | Method | Result |
|---|---|---|
| Non-existent muxer options outside bracketed idiom | `rg frag_type\|default_prft\|frag_start_number` over nine docs; bracketed forms `frag_typ[e]`/`default_prf[t]`/`frag_start_numbe[r]` are the rule/self-gate mentions (`01_specs.md:178`, `:310`; `05_capture_architecture_spec.md:414`, `:631`, `:640`; `03_api_contract.md:608`; `10_test_strategy.md:163`) | PASS (0 live uses) |
| RTF/WER/throughput figure as a result | `rg RTF\|WER\|throughput [0-9]` over nine docs; only "no RTF/WER" statements and the class-C deferred benchmark (D230) | PASS (0 figures) |
| `AdminResource.DEVICES` used for capture | literal occurrences: `01_specs.md:145` (prohibition), `04_database_contract.md` (prohibition), `05_capture_architecture_spec.md` (G-R5 prohibition), `08_client_ux_spec.md:109` (prohibition), `10_test_strategy.md` (guard); row 29 self-gate `:682` asserts 0 | PASS (0 uses; all prohibitions) |
| Emoji | PCRE scan `1F300-1FAFF / 2600-27BF / FE0F / 1F1E6-1F1FF` over the nine docs | PASS (0 emoji; only typographic `->`/`→`/`+/-`) |
| Leaked secret shape | `~/.omlx/settings.json` `auth.api_key` referenced by path only (`07_transcript_spec.md:215`); `.data/pg.pwfile`/`.data/pg.owner.env`/`.data/pg.env` named as forbidden, never quoted (`04_database_contract.md:706`); no key value printed | PASS |
| `localhost` where `127.0.0.1` is required | `01_specs.md:442`/`02_plan.md:441` = backlog item B13 "Packaged CSP `localhost`" (a finding, carried); `10_test_strategy.md:179` = rune via `127.0.0.1, never localhost`; loopback endpoints use `127.0.0.1` (`09_security_design_review.md:165/352`) | PASS |

### C9 — ground-truth statements

| Claim in the docs | Artifact | Result |
|---|---|---|
| 5/5 workspaces exit 0 at/above floors; mobile 193/1,994; added tests named; typecheck+lint 0; live audit 53 | `test/01_wave_a_regression.md:24-33`, `:87-91`, `:153-154`, `:263-277`, `:287` — all internally consistent; arithmetic `1,988 + 4 + 2 = 1,994`, `192 + 1 = 193` (`:244-245`) | PASS |
| M1 GATE PASS 25/25 | `gateway_check/04_m1_spike_gate.md:34` "PASS — 25/25 criteria PASS, 0 FAIL"; breakdown S1 5/5, S2 4/4, S4 3/3, STT 7/7, row-15 5/5, hygiene 1/1 (`:36`) | PASS |

## Gaps table

| ID | Severity | Where | What | Routed to | Suggested fix |
|---|---|---|---|---|---|
| GAP-01 | rev-2-item | `masterplan/10_test_strategy.md:137,138,140,143,360` | Row 36 still pins `88 ops / 34 GET / 54 POST` (M2-API-1), `12 simulated ops / 88-1` (M2-API-2), `now pin 88` (M2-PIN-1), `7 new types (53 -> 60)` (M2-AUD-1), `75 -> 88` (section C family B); must read `89 / 34 GET / 55 POST`, `13 simulated`, `89-1`, `9 new types (53 -> 62)` / `9 new codes (31 -> 40)`, `75 -> 89`, offline 23 | row 40 (row 36 text; already handed as P-1/P-2/P-3 by `02_plan.md:79-81`) | Fold P-1..P-4 into row 36 in rev 2 |
| GAP-02 | rev-2-item | `masterplan/05_capture_architecture_spec.md:499` | Mic-switch path written in the plural `/api/v1/sessions/{id}/audio-source`; row 29 normalizes to the singular and explicitly flags the plural "as an erratum for the M0 gate (row 39)" (`03_api_contract.md:125-128`, `:690`) | row 31 (+ row 40) | Change row 31 §E to the singular path or record the decision |
| GAP-03 | informational | `masterplan/09_security_design_review.md:64,79,173,175,208` | Row 35 carries pre-remediation counts ("13 new operations (76-88)", "seven new audit types (60 total)", "seven new error codes (38 total)"). By design the review record is not edited (`06_security_remediation.md:341-342`); the remediation report is the superseding record | row 40 (no edit required) | Optional one-line pointer to the remediation report at row 35 §1 |
| GAP-04 | informational | errata E-07, E-08, E-09, E-10, E-11 | Citation-only line-number errata: the corrected `file:line` is carried by the register (`research/03_analysis.md` §A) and reflected by concept in the owning spec, but the exact new ranges are not re-quoted (`03_api_contract.md:392-393` cites `audit-details.ts:90-132`/`:1-18`, not `:1-140`; `08_client_ux_spec.md` covers `devices-panel`/`session-live` by concept) | row 40 (optional doc-sync) | Optional line refresh during rev 2 |
| GAP-05 | informational | `masterplan/01_specs.md` C-N4 (+ `02_plan.md`) | `06_security_remediation.md:248-250` notes row 37/40 should fold "RTSP ingest is loopback" into SP `C-N4` (a doc-sync item, not a gate question); row 31 §A.4 already carries the normative rule | row 37/40 | Add one clause to specs C-N4 |

**Blocking gaps: 0.**

## Gate decisions confirmed (requested by rows 29/31)

| Item | Requested by | Gate finding |
|---|---|---|
| OD-03 per-fragment GCM + both hashes, derived not stored | `01_specs.md` C-N2 / row 31 §D | Confirmed consistent (field counts unchanged 17/120; `03_api_contract.md`, `05_capture_architecture_spec.md:454`, `06_evidence_package_spec.md:266`); no change |
| Fragment-quantum pairing `CAPTURE_GOP_FRAMES=50` / `CAPTURE_FRAGMENT_TARGET_MS=2000` | `03_api_contract.md:602-609`; `05_capture_architecture_spec.md:361,370` | Confirmed consistent across rows 29/31/32/36 and measured in S1; recorded as a contract constant (row 37 F-5) |
| Plural audio-source path erratum | `03_api_contract.md:125-128` | Routed as GAP-02 |

## Overall M0 gate verdict

**PASS.** Rule: FAIL only if a blocking gap exists. Measured: **0 blocking gaps**; the three mandated
counts hold (errata 31/31, R 7/7, answered ODs 29/29); C1..C9 all PASS. Five non-blocking items
(2 rev-2-items, 3 informational) are listed for row 40. No finding was routed as a test failure; no
document under review was edited.

## Readiness statement for row 40 (blueprint rev 2)

Row 40 must carry:

1. **P-1..P-4 pick-ups into row 36's text** (`02_plan.md:79-82`): P-1 `M2-API-1` -> `89 ops, 34 GET /
   55 POST`; P-2 `M2-API-2` -> `89-1` live-only, offline grows 10 -> 23; P-3 `M2-AUD-1` -> 9 new types
   (53 -> 62) and 9 new codes (31 -> 40), forbidden-key CHECK 17 -> 25; P-4 gate-file renumber
   `06_m2..13_m9` -> `07_m2..14_m9` (row 37 already shifted; row 36 §0/§D still use the old names). Also
   fold the section-C pin family `75 -> 88` -> `75 -> 89` (GAP-01).
2. **Rev-2 implementation rows** (already scheduled in row 37): M2-W6/W7 (op 89 registry + audit +
   errors + constants, `02_plan.md:156-157`), M2-W8 (repin 89 / 0.3.0 / offline 0.2.0, `:158`), and the
   SEC35-18 deliverable with check `M2-API-3` (`03_api_contract.md:695`).
3. **The second-gate flags** (`02_plan.md:469-471`, D14(d)): SEC35-16 REAL-evidence case scope
   (provisional; needs user confirmation before M8 ships), SEC35-09 no-key-escrow default, SEC35-02
   reveal mitigation deviation (single-module static rule + audit vs literal `dems_app` revoke); plus
   SEC35-26 privacy/DPIA deferred to row 40 (`06_security_remediation.md:290`).
4. **D7 OD-24 amendment** flagged for second-gate confirmation (`01_specs.md:280`, `:418` F-6); OD-21
   legal confirmation (F-4); SP-4 fragment quantum (F-5); GStreamer install decision (F-7); Q-HW (F-8).
5. **GAP-02** (row 31 plural mic-switch path -> singular) and the optional doc-sync items GAP-03/GAP-04/
   GAP-05.

---

*Generated: 2026-10-07 15:14*
*Last Updated: 2026-10-07 15:14*
