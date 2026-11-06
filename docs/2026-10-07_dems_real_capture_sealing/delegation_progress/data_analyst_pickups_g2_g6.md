---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-09
agent: data-analyst
source_gate: gateway_check/25_rv_spec_reconciliation.md (row 106; G-2 at :146, G-6 at :150)
class: DOC-ONLY pickups (Tier 3)
status: complete
files_touched: masterplan/01_specs.md (1 line), masterplan/05_capture_architecture_spec.md (1 line)
last_updated: 2026-10-09 09:32
---

# Row 106 pickups G-2 and G-6, plus media-CODE sweep (record)

Evidence for the edits: `git diff -U0 -- masterplan/01_specs.md masterplan/05_capture_architecture_spec.md`
reports `2 files changed, 2 insertions(+), 2 deletions(-)`, hunks `@@ -231 +231 @@` and `@@ -389 +389 @@`.

## 1. G-2 - mirror of the CF-12 split in R-8 AC-5

- Was it missing: YES. `masterplan/01_specs.md:231` still attributed the verify clause to
  `M6-STTCFG-OFF`.
- Line changed: `masterplan/01_specs.md:231` (one line, one clause).
- Before: `... in the manifest, and v2 verify passes; `M6-STTCFG-OFF` **2 + 1**.`
- After: `... in the manifest, and v2 verify passes (verify clause proven at M7 by `M7-VV-SRV` / the CF-12 split check, blueprint row 119); seal-state clause `M6-STTCFG-OFF` **2 + 1**.`
- Source: `gateway_check/25_rv_spec_reconciliation.md:146` (G-2, wording applied verbatim);
  pairs with G-1 at `:145` and checklist item 8b at `:93`.
- Counts: R-8 still has 7 acceptance criteria (`01_specs.md:227`-`:233`); no requirement added.
- Consistency with G-1: at the time of this edit G-1 was NOT yet applied in
  `masterplan/10_test_strategy.md` (`:228` still ends "v2 verify PASS on server"; no `M7-STTCFG-*`
  row exists; file read-only here, not edited). The G-2 wording names `M7-VV-SRV` and "the CF-12
  split check" generically, so it stays correct whatever ID G-1 gives the new M7 row (the gate
  suggests `M7-STTCFG-VERIFY`). Optional follow-up once G-1 lands: replace "the CF-12 split check"
  with the actual ID.

## 2. G-6 - cross-document pointer for `M3-KC-4`

- Was it missing: YES. `masterplan/05_capture_architecture_spec.md:389` pointed to test §A.4.
- Confirmation (read-only): `masterplan/10_test_strategy.md:148` is "### A.3 M3 - capture worker +
  supervisor + IPC on fake devices"; `:169` is "### A.4 M4 - device selector + fake adapters";
  the `M3-KC-4` row sits at `:161`, inside §A.3.
- Line changed: `masterplan/05_capture_architecture_spec.md:389`.
- Before: `(check `M3-KC-4`, `10_test_strategy.md` §A.4)`
- After: `(check `M3-KC-4`, `10_test_strategy.md` §A.3)`
- Source: `gateway_check/25_rv_spec_reconciliation.md:150` (G-6).
- Not changed, on purpose: the other "§A.4" mentions in file 05 (`:126`, `:309`, `:663`) refer to
  file 05's own section A.4 (RTSP ingest binding), not to the test strategy. They are correct.

## 3. Media-profile CODE erratum (`H264_1080P25`) - sweep of `masterplan/*.md`

- Was anything to fix: NO. Zero occurrences of either spelling in any masterplan file.
- Commands (system grep, run in the task folder):
  - `/usr/bin/grep -rn -E "H264[-_]1080P25" masterplan/` -> 0 lines
  - `/usr/bin/grep -n -E "H264|h264" masterplan/*.md` -> 0 lines
  - `/usr/bin/grep -n -o -E ".{50}[0-9]P25.{30}|.{50}[0-9]p25.{30}" masterplan/*.md` -> 0 lines
- Occurrence list: empty (no hyphenated form, no deliberate negative example, in any of the 11
  files including `10_test_strategy.md`, which was only read).
- Where the hyphenated literal does still appear in the task folder (history records, outside this
  row's file set, not edited): `decisions/decisions.md`, `gateway_check/15_m2_code_review.md`,
  `implementation/65_recon_core_wiring.md`, `implementation/68_recon_snapshot_code.md`,
  `implementation/69a_recon_media_code.md`, `delegation_progress/coder-execution-local__reconF1.md`,
  `delegation_progress/coder-execution__reconE.md`, `delegation_progress/coder-execution__reconB2a.md`.
  These describe the before-state of the fix and should stay as written.
- Sources: decision `gateway_check/15_m2_code_review.md:266`-`:285` (section 5); code landing
  `implementation/69a_recon_media_code.md:45`; doc half routed at `69a:181`-`:182`.

## 4. Open points for the controller

1. The "correct any hyphen example" half of the media-CODE erratum is closed with nothing to do.
   The "standardise the CODE in the contract text" half is still unplaced: neither
   `03_api_contract.md` nor `04_database_contract.md` names the profile CODE literal at all. Adding
   a normative sentence is a new statement in files outside this row's set (01 and 05 only), so it
   was not written. Decision needed: add one line to C3 / dbc-3, or close the erratum as
   "code-only, enforced by the 0004 CHECK and the B2a bridge".
2. The brief speaks of three forwarded errata but describes one. The only other residuals found
   under that heading are code items, not spec text: the stale comment at
   `apps/core-server/src/db/seed/seed.ts:251` and the four unwritten fail-closed cases for
   `to-rows.test.ts` (`implementation/69a_recon_media_code.md:177`-`:185`). Not touched.
3. O-1 of the gate (`25_rv_spec_reconciliation.md:161`, optional refresh of a line pointer in
   `masterplan/11_audit_errata.md:43`) was left alone: optional, and that file is outside this row.
4. Front-matter `last_updated` stamps of files 01 and 05 were not changed (only the two lines above).
