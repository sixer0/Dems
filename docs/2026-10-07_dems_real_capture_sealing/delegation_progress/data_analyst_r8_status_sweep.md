---
task_id: 2026-10-07_dems_real_capture_sealing
agent: data-analyst
type: delegation progress (Tier 3 - mechanical record)
date: 2026-10-09
status: complete
scope: status-wording sweep after D24 (Q-STT-CFG, Q-D7, Q-WORKER answered); errata PE-R8-01..22
errata_ledger: masterplan/11_audit_errata.md section 5.7
---

# R-8 / Q-D7 / Q-WORKER status sweep (2026-10-09)

Answers used (read, not changed): D24 (`decisions/decisions.md:36`) - "Q-STT-CFG (a) all 13 proposed R-8
defaults confirmed", "Q-D7 (a) oMLX for development PLUS the whisper.cpp CPU path", "Q-WORKER (a) a small C
program against libavfilter/libavformat ... spawned and supervised by the Core"; D20
(`decisions/decisions.md:32`); D64 (`decisions/decisions.md:77`, check statuses). Convention copied from
`masterplan/11_audit_errata.md` section 5 (ID `PE-<row>-<nn>`, inline "**Erratum PE-... (decision)**").
Rule: status wording only; figures (39 tables, 120 fields, 7/7 flows, per-milestone check counts) NOT
restated or reconciled.

Not edited (as ordered): `identification/02_structured.md`, `masterplan/10_test_strategy.md`,
`masterplan/03_api_contract.md`, `masterplan/05_capture_architecture_spec.md`, trackers, code.

## 1. Per location (before -> after, citation)

Line numbers are after the edit. Citation for every row: D24 (`decisions/decisions.md:36`) unless stated.

| ID | File:line | Before | After |
|---|---|---|---|
| PE-R8-01 | `04_database_contract.md:21,894` | front matter / footer: "proposed §B.13 `stt_config` for R-8 pending Q-STT-CFG ... counts unchanged until confirmed" | "§B.13 `stt_config` CONFIRMED by D24, Q-STT-CFG answer (a)"; 2026-10-08 entry kept as "added as a proposal" |
| PE-R8-02 | `04_database_contract.md:469-474` | "(proposed T-40) ... (PROPOSED - pending Q-STT-CFG confirmation at the second gate ...)"; "Status: proposed, not counted ... until the user confirms ... If confirmed: tables 39 -> 40, kept set 11 -> 12 ... If rejected: delete this section." | "(T-40) ... (CONFIRMED - D24 ...)"; "Status: confirmed (D24 ...). With it: tables 39 -> 40, kept set 11 -> 12 ..."; note that the 39 / 11 figures elsewhere are not restated |
| PE-R8-03 | `04_database_contract.md:484` | "seed value per Q-STT-CFG (proposed `true`)" | "seed value `true` (Q-STT-CFG item 11, confirmed D24)" (item 11 of the gate list = enabled; all 13 defaults confirmed) |
| PE-R8-04 | `04_database_contract.md:503,510` | "Privileges (`0005`, if confirmed)"; "`M2-STTCFG-DB` (conditional ...)" | "(`0005`; confirmed, D24)"; "(active, D24/D64 ...)" (D64: `decisions/decisions.md:77`) |
| PE-R8-05 | `04_database_contract.md:680` | "Proposed by R-8 (D20; pending Q-STT-CFG - not counted)"; "would make the kept set 12" | "Added by R-8 (D20; confirmed, D24, Q-STT-CFG (a))"; "makes the kept set 12" |
| PE-R8-06 | `06_evidence_package_spec.md:26,749` | "proposed §B.7a ... field count stays 120 until Q-STT-CFG" | "§B.7a and the §E.5 R-8 extension CONFIRMED by D24" |
| PE-R8-07 | `06_evidence_package_spec.md:316-321` | "(PROPOSED - pending Q-STT-CFG ...)"; "Status: proposed, not counted ... not in the 120-field count or the self-gate until the user confirms Q-STT-CFG; if confirmed the manifest has 123 fields ... If rejected: delete" | "(CONFIRMED - D24 ...)"; "Status: confirmed (D24 ...). With them the manifest has 123 fields and field 92's enum gains `DISABLED`"; note that the 120-field figures elsewhere are not restated |
| PE-R8-08 | `06_evidence_package_spec.md:576,580` | "Proposed extension (R-8, D20; pending Q-STT-CFG)"; "`M6-STTCFG-OFF` / `M6-STTCFG-UNREACH` (conditional)" | "Extension (R-8, D20; confirmed, D24, Q-STT-CFG (a))"; "(active, D24/D64)" |
| PE-R8-09 | `07_transcript_spec.md:19,456` | "proposed §B.7 R-8 STT configuration" | "§B.7 R-8 CONFIRMED by D24"; 2026-10-08 entry kept as "added as a proposal" |
| PE-R8-10 | `07_transcript_spec.md:38-39` | "R-8 STT configuration (§B.7, proposed, pending Q-STT-CFG)" | "(§B.7, confirmed by D24, Q-STT-CFG answer (a))" |
| PE-R8-11 | `07_transcript_spec.md:264-269` | "(PROPOSED - pending Q-STT-CFG confirmation at the second gate ...)"; "Status: proposed."; "Nothing here is counted or scheduled until Q-STT-CFG is confirmed." | "(CONFIRMED - D24 ...)"; "Status: confirmed (D24 ...)."; "Counted and scheduled as the R-8 rows of blueprint rev 2.1 (D24 ...)" |
| PE-R8-12 | `08_client_ux_spec.md:28,717` | "proposed §8a Flow 8 STT configuration" | "§8a Flow 8 CONFIRMED by D24" |
| PE-R8-13 | `08_client_ux_spec.md:583-587` | "Flow 8 (PROPOSED) ... pending Q-STT-CFG ..."; "Status: proposed (D20). Not counted in the 7/7 flows, the 10/10 gated controls or the self-gate until the user confirms Q-STT-CFG. If confirmed: flows 8/8 (24 client definitions), gated controls G11-G12 added." | "Flow 8 (CONFIRMED) ... D24"; "Status: confirmed (D24 ...). With it: flows 8/8 (24 client definitions), gated controls G11-G12 added"; note that the 7/7 and 10/10 figures elsewhere are not restated |
| PE-R8-14 | `09_security_design_review.md:27,429` | front matter / footer: "§10 addendum for the proposed R-8 STT configuration surface" | "§10 confirmed by D24" |
| PE-R8-15 | `09_security_design_review.md:414-420` | "Addendum - proposed R-8 STT configuration surface (... pending Q-STT-CFG, D20)"; "if the user confirms Q-STT-CFG"; table header "Design in the proposed sections" | "Addendum - R-8 ... (... CONFIRMED by D24 ...)"; "the user confirmed Q-STT-CFG on 2026-10-08 (D24)"; "Design in the R-8 sections" |
| PE-R8-16 | `02_plan.md:379` | "**conditional** M6-STTCFG-* + M2-STTCFG-DB (8, pending Q-STT-CFG, test §A.6a)" | "**active (were conditional)** ... (8; Q-STT-CFG answered (a), D24, test §A.6a active per D64)" |
| PE-R8-17 | `02_plan.md:381` | "**proposed** M8-EV-SCOPE-1 (sec SEC35-16)" | "**active** M8-EV-SCOPE-1 (sec SEC35-16; Q-SEC-1 (a), D24; active per D64)" (`10_test_strategy.md:278` read only: "Q-SEC-1 (a) confirmed, D24") |
| PE-R8-18 | `02_plan.md:433` | F-9 "Q-STT-CFG - R-8 STT configuration menu (D20)" | "... - ANSWERED (a), all 13 defaults confirmed, D24: the Confirm branch is in force"; Confirm / Reject text unchanged |
| PE-R8-19 | `02_plan.md:485` | column header "Landing if confirmed" | "Landing if confirmed (in force: Q-SEC-1 (a), Q-SEC-2 (a), Q-SEC-3 default, D24)" |
| PE-R8-20 | `02_plan.md:575,576` | "M3 13 (incl. proposed `M3-RTSP-BIND-1`)"; "M8 11 (incl. proposed `M8-EV-SCOPE-1`)" | "(incl. `M3-RTSP-BIND-1`, active per D64)"; "(incl. `M8-EV-SCOPE-1`, active per D64)"; figures untouched |
| PE-R8-21 | `02_plan.md:432,434` (extra, same subject) | F-6 "OD-24 / D7 TranscriberAdapter confirmation ..."; F-10 "Q-WORKER - capture-worker build form" | F-6 "ANSWERED, D24: oMLX for development PLUS `cpu-local` proven on this Mac - this row's option (b), labelled Q-D7 (a) in the blueprint - is in force"; F-10 "ANSWERED (a), D24: C program is in force". NOTE the label difference: the plan lists the recommended option as (b), the blueprint as (a) |
| PE-R8-22 | `01_specs.md:17,314-316,529` | "Q-D7 reframed ... - **pending**; Q-WORKER ... - **pending**" | "answered (a), D24: oMLX for development plus the whisper.cpp CPU path proven on this Mac"; "answered (a), D24: a small C program against libavfilter/libavformat of the installed FFmpeg, spawned and supervised by the Core" |

`02_plan.md:26,603` and `01_specs.md:17,529` (front matter / footer) name the range. The ledger rows are in
`masterplan/11_audit_errata.md` section 5.7 (new); OUT-6 and OUT-7 there are marked RESOLVED; a status note
was added under section 2's intro (the 2026-10-08 old/new text of sections 1-2 is left as history).

Out of the ordered list but edited (same subject, same status words): `04_database_contract.md:510`
(`M2-STTCFG-DB` "conditional" -> active; in PE-R8-04), `06_evidence_package_spec.md:580` (in PE-R8-08),
`02_plan.md:432,434` (PE-R8-21, F-6 / F-10 answers).

## 2. Final grep

Command: `grep -n -E "PROPOSED|pending Q-|if confirmed|if R-8 confirmed|Q-STT-CFG"` over `masterplan/*.md`
except `10_test_strategy.md` and `03_api_contract.md` (so `05_capture_architecture_spec.md` was searched:
0 hits).

Literal `PROPOSED`, `pending Q-`, `if confirmed`, `if R-8 confirmed`: 0 hits outside `11_audit_errata.md`,
except `02_plan.md:485` ("Landing if confirmed" - a column header, now annotated).

| Hit (file:line) | Verdict |
|---|---|
| `01_specs.md:214,227,314` | fixed (earlier pass, PE-113-15; and PE-R8-22 for the neighbouring Q-D7 / Q-WORKER text) |
| `01_specs.md:219` (quotes D24: "all 13 proposed R-8 defaults confirmed") | historical-note-leave (verbatim quote of the decision) |
| `02_plan.md:379,433` | fixed (PE-R8-16, -18) |
| `02_plan.md:485` | fixed (PE-R8-19; generic column header, annotated) |
| `04_database_contract.md:21,469,471,484,680` | fixed (PE-R8-01..05) |
| `06_evidence_package_spec.md:26,316,318,576` | fixed (PE-R8-06..08) |
| `07_transcript_spec.md:19,39,264,266` | fixed (PE-R8-09..11) |
| `08_client_ux_spec.md:28,583,585` | fixed (PE-R8-12, -13) |
| `09_security_design_review.md:27,414,418` | fixed (PE-R8-14, -15) |
| `11_audit_errata.md:65,127,129,134,135,139,146,185,190` (sections 1, 2, 4: the 2026-10-08 ledger) | historical-note-leave (records of what the 2026-10-08 edit changed) |
| `11_audit_errata.md:219-221,227,233,264` (section 5: PE-113 old-text quotes, sweep sentence) | historical-note-leave |
| `11_audit_errata.md:320` (OUT-6) and the OUT-7 row | fixed (marked RESOLVED, points to 5.7) |
| `11_audit_errata.md:332,348-366` (section 5.7, this sweep's own rows) | fixed (new text; the old-text quotes are historical) |

Nothing is classed needs-controller from the grep itself. Items seen while checking that the patterns do
NOT catch (listed for the controller; not edited):

1. `05_capture_architecture_spec.md:212` still calls `M3-RTSP-BIND-1` a "proposed addition" (file out of
   scope; the check is active per D64).
2. `07_transcript_spec.md:38` still says "Nothing of either backend is coded yet" (a 2026-10-08 status
   sentence, not an R-8 / Q-D7 / Q-WORKER item; whether it is still true was not verified here).
3. `06_evidence_package_spec.md` has a duplicate front-matter key `last_updated` (line 21 from 2026-10-07 and
   line 26) - pre-existing.
4. Figures not reconciled by order: 39 / 11 tables (04), 120 fields (06), 7/7 flows and 10/10 controls
   (08), per-milestone check counts and "+18 conditional" at `02_plan.md:105,575-576` (the total there is
   superseded by D64: 218 active + 10 conditional). Each edited status block says so.
5. `02_plan.md` F-1, F-2, F-3 (SEC35-16, SEC35-09, SEC35-02 open items) still read as open; the G.2 header
   now says which answers are in force, but the F rows themselves were not marked (not in the order).
6. Q-D7 option labels differ between the plan (F-6: (b) is the recommended oMLX + `cpu-local`) and the
   blueprint ((a) is that option); PE-R8-21 states both.
