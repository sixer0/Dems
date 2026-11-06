---
task_id: 2026-10-07_dems_real_capture_sealing
agent: data-analyst
blueprint_row: 124
date: 2026-10-09
status: complete (spec gate row 128 checks it; 6 assumptions and 5 open items for the controller in sections 5 and 6)
tier: 3 (working record of a Tier 1 edit)
file_edited: masterplan/06_evidence_package_spec.md (749 -> 915 lines)
last_updated: 2026-10-09 14:20
---

# Row 124 — evidence package delta: development-source mark in `masterplan/06_evidence_package_spec.md`

## 1. What was done

One file edited: `masterplan/06_evidence_package_spec.md`. No other spec, no blueprint, no tracker,
no decision file, no errata file and no code was written by this row.

Baseline: `git diff --stat HEAD -- masterplan/06_evidence_package_spec.md` printed nothing before
the edit, so `git diff HEAD -- docs/2026-10-07_dems_real_capture_sealing/masterplan/06_evidence_package_spec.md`
shows exactly this row's change: `1 file changed, 183 insertions(+), 17 deletions(-)`. The 17
removed lines are all lines that were replaced by an extended version of themselves (front matter,
B.7a status line, B.10 example, count paragraph, one E.1 cell, the verify-count line, three
self-gate rows, the decisions reference, the footer); no existing field, check or step was removed
or renumbered. A pre-edit copy is in the session scratch directory (`06_pre_row124.md`, 749 lines).

Sources read: `identification/02_structured.md` rev 2.3 rows 83, 85, 122, 124, 125, 127, 128, 136,
141; `masterplan/01_specs.md` §B.2 (R-11, C-N14, open point 7, ambiguities 7 and 9);
`delegation_progress/data_analyst_row120.md`; `decisions/decisions.md` D66, D72, D73, D74, D78,
D79, D80; `masterplan/06_evidence_package_spec.md` whole; `masterplan/05_capture_architecture_spec.md`
§A.1, §C.4 (lines 557-571), §F line 683; `masterplan/07_transcript_spec.md:132`;
`masterplan/04_database_contract.md` §B.5; `masterplan/11_audit_errata.md` §5 (marker convention);
code: `packages/capture-protocol/src/index.ts:148-163,239,427-438`,
`packages/shared/src/api/capture.ts:61-82`, `apps/core-server/src/db/migrations/0004_capture.sql:47-48`.

## 2. The result in one table

| Item of the task | Answer | Where (line after the edit) |
|---|---|---|
| Field per camera track | 124 `tracks[].sourceClass`, enum `PRODUCTION` / `LOCAL_DEVICE` / `FAKE`, not null | 456 |
| Field per audio interval | 125 `audio.sourceIntervals[].sourceClass`, same enum, not null; mirrors `session_audio_intervals` row by row | 457, 477 |
| Package summary flag | 126 `developmentSources`, boolean, not null, derived (true when any class is not `PRODUCTION`) | 458 |
| Signing | Fields are in the canonical body; the only exclusions stay `manifestSha256` (nulled) and `signature.value` | 383-388, 567 |
| Verify rule | New check **V-15**: passes and reports the mark; fails only for a missing (MISSING) or inconsistent (CORRUPT) mark; an edited mark fails V-03, or V-09 if the digest is recomputed | 624, 637-648 |
| Report wording | "DEVELOPMENT SOURCES — this package was not recorded from production devices." placed first; for all-production: "Sources: declared as production devices by the Core that sealed this package." | 644-645 |
| Machine-readable | `sources: { ok, development, tracks[], audioIntervals[] }` in the verify result | 643 |
| Status | top-level `ok` and any exit status unchanged by the value of the mark | 642 |
| Limitation | An all-`PRODUCTION` manifest cannot be told from a truly production one; guards: boot fence (R-11 AC-1, row 136), Core writes the class from the adapter kind, the signature | 863-872 |
| Display | Pointer to row 125; this spec fixes only the data source of a label | 648 |
| First video sample (D66 (4b), D72 (e)) | Was missing. Added as 127 `tracks[].firstVideoSamplePts` and 128 `tracks[].firstVideoSampleTimescale`, nullable | 459-460, 512-521 |
| Media-time origin (D72 (d)) | Was missing. Statement added: file time 0 = T0 − 1024/48000 s | 523-534 |
| Compatibility | No schema or version step. v2: fields required, absence fails V-15. v1: untouched | 504-510 |

## 3. Count arithmetic

The task brief says "120 fields today". The file already held **123**: §B.7a (confirmed by D24,
erratum PE-R8-07) added fields 121-123, and its status line said that the 120 figures elsewhere
"were not restated". This row restated them.

| Step | Fields | Running total |
|---|--:|--:|
| Row 32: B.1 8 + B.2 11 + B.3 14 + B.4 18 + B.5 10 + B.6 17 + B.7 16 + B.8 7 + B.9 10 + B.11 9 | 120 | 120 |
| B.7a fields 121-123 (D24) — already in the file | +3 | 123 |
| Row 124: fields 124-126, source class (D73, D80 (9)) | +3 | 126 |
| Row 124, already-decided item: fields 127-128, first video sample (D66 (4b), D72 (e)) | +2 | **128** |

Cross-check by location: 9 + 11 + 14 + 21 + 11 + 17 + 19 + 7 + 10 + 9 = 128.

Places in the file that quote a count, all updated: line 329-330 (B.7a status), 536-544 (count
paragraph), 880 (self-gate, fields), 882 (self-gate, verify checks), 888 (row-35 line, kept as a
historical figure with today's figures beside it). Verify checks: 14 -> **15** (line 626). Sealing
steps: 8, unchanged (line 732).

## 4. What changed, with line ranges (after the edit)

| Mark | Lines | Content |
|---|---|---|
| PE-124-01 | 25-26, 76-77 | Front matter (decisions, `last_updated`); §0.1 two decision rows (D73 / D74 / D78 / D80; D66 / D72) |
| PE-124-02 | 436-502 | New §B.12: status, frame table (subject, stakeholders, timeline, scope, rationale, method), fields 124-126, value table, 7 rules, dependency on row 121, alternatives |
| PE-124-03 | 181, 245, 266 | Pointers under B.1, B.4, B.5 to the new fields |
| PE-124-04 | 383-388, 390-391, 399-409 | §B.10: what the canonical body contains; example extended |
| PE-124-05 | 329-330, 536-544 | Count restated: 128, with the arithmetic |
| PE-124-06 | 567 | §C.1 row: the mark is covered by the seal signature |
| PE-124-07 | 624, 626, 637-648 | §D: check V-15; verify count 15; new §D.1 (result, status, machine-readable block, report lines, tampering, key availability) |
| PE-124-08 | 674, 708, 728-736 | §E.1 `BUILD_MANIFEST` failure cell; §E.4 row; new §E.6 |
| PE-124-09 | 800 | §G.2 row: the mark travels with an export |
| PE-124-10 | 863-872 | New §H.5: what the mark cannot prove, and what guards it |
| PE-124-11 | 648 | §D.1 "Display" row: pointer to row 125 |
| PE-124-12 | 459-460, 512-521 | Fields 127-128 and the paragraph "First video sample" |
| PE-124-13 | 523-534 | Paragraph "Media-time origin" |
| PE-124-14 | 504-510 | Compatibility table |
| PE-124-15 | 880, 882, 888-889, 909-910, 915 | Self-gate rows, a new self-gate row for row 124, references, footer |

Check run after the edit (14:19): every mark PE-124-01..15 occurs at least once (`grep -n -o`);
table column counts are consistent in every table this row touched (the two mismatches a script
reports, lines 615 and 816, are old rows V-06 and SEC35-13 whose cells contain a literal `|`).

## 5. Assumptions for the spec gate (row 128)

| # | Assumption | If it does not hold |
|--:|---|---|
| A-1 | Row 121 gives every capture device one adapter kind; one is named `LOCAL_DEVICE`; fakes have their own kind, assumed `FAKE`; every other kind is a production adapter. On 2026-10-09 `03_api_contract.md` had 0 lines matching `LOCAL_DEVICE` or `adapterKind`, and no code defines an adapter kind | Only the kind -> class mapping (§B.12 rule 2) changes. The manifest values `PRODUCTION` / `LOCAL_DEVICE` / `FAKE` stay. If row 121 exposes a source class on a device shape it must use these three names |
| A-2 | The response shape of operation 41 can carry a `sources` block (§D.1). `03_api_contract.md` owns that shape and was not edited | Row 121 or the gate renames the block; §D.1 line 643 follows |
| A-3 | The adapter kind of each slot is recorded for the session at its start and survives a restart (needed by §B.12 rule 3, §E.6) | Row 122 must provide it; otherwise a RECOVERY seal could write a class from the registry of a later boot |
| A-4 | D80 (9) "covers every package whose sources are not production devices" includes the generated demo packages: they get `FAKE` and `developmentSources = true` (§B.12 rule 6) | If the controller wants demo packages without the mark, rule 6 and the B.10 example change; a fourth value would then be needed, because `PRODUCTION` would be false for them |
| A-5 | A standby microphone that was never selected carries no mark (it is in no recorded sample). With D74 (2) this cannot hide a development session: camera 1, camera 2 and microphone 1 are already non-production | If the controller wants configured-but-unused inputs listed, an `audio.inputs[]` list is a further field group |
| A-6 | No v2 package is kept that was sealed without fields 124-126. Evidence: `grep -rl "dems.evidence-manifest/2" packages apps` = 0 files; row 83 not started | See hand-over to rows 83 / 141 below |

## 6. Open items and findings for the controller

1. **Count in the brief versus the file.** The brief and blueprint row 83 say "120-field manifest".
   The file was at 123 since D24 and is at 128 now. Row 83's text needs the new figure.
2. **Verify checks 14 -> 15.** Blueprint row 85 says "14 checks V-01..V-14" — still true for row 85,
   because V-15 is built by row 141. Rows 86, 89 and the test catalogue (row 127) quote "14 checks"
   in places; they need "15 after row 141".
3. **Fields 127-128 are a shape chosen by this row.** That the true first video pts goes into the
   manifest is decided (D66 (4b), D72 (e)); that it is two fields named `firstVideoSamplePts` and
   `firstVideoSampleTimescale` on `tracks[]`, kept as ticks and timescale rather than milliseconds,
   is this row's choice. For the gate.
4. **Origin of the interval times is not stated anywhere.** D72 (d) fixes file time 0 = T0 − 1024
   samples. Fragment times (fields 66-67) come from the writer and are file time. Whether
   `audio.sourceIntervals[].fromMs` / `toMs` (`session_audio_intervals.from_media_ms`) count from T0
   or from file time 0 is written neither in `04_database_contract.md` §B.5 nor in spec 05 §E. The
   difference is 21.333 ms. Recorded as open in the spec (lines 529-534); owners: rows 82 and 83.
   Not decided here.
5. **"Production configuration" is still undefined** (`specs` §B.2.7 item 7). §H.5 names the boot
   fence as the first guard of the limitation; the guard is only as exact as that definition
   (rows 61, 123, 126).

## 7. Hand-over

| Row | What it needs from this row |
|---|---|
| 121 (API contract) | The three manifest values; the `sources` block of the verify result (§D.1 line 643) to be carried into operation 41's response; no operation may accept a source class (§B.12 rule 1); if an evidence list or summary shape shows the mark, it is the package flag (field 126) |
| 122 (database contract) | (a) A durable per-session record of the adapter kind of each camera slot and each microphone, written at session start (§E.6); (b) whether `evidence_items` gets a column for field 126 so that evidence lists can show the label without reading the manifest (R-11 AC-6), and `evidence_tracks` one for field 124; (c) `session_audio_intervals` needs **no** new column for field 125 if (a) exists — the class follows from `mic_device_id`; (d) **no manifest schema or version step**: `manifest_version` stays 2 |
| 125 (client UX) | The label on a sealed item is derived from manifest fields 124-126 or the V-15 `sources` block, never from client state (§D.1 line 648). The verify report shows the development line first and never collapsed (line 644). A package can be REAL in `integrity` and still from development sources: "REAL" alone must not read as "production" (line 181). A v1 item reads "not recorded (v1 package)" (line 510). The regenerated demo packages will show the mark too (A-4), including the tamper demo of §F |
| 127 (test catalogue) | Proposed checks: (1) development-mode package verifies PASS, `sources.development = true`, four sources with the classes of D74 (2); (2) edit one `sourceClass` in the sealed manifest -> V-03 fails; (3) edit it and recompute `manifestSha256` and the digest in `signature.sig` -> V-09 fails; (4) delete field 126 -> fails; (5) flag inconsistent with the classes in a re-signed fixture -> V-15 CORRUPT; (6) a microphone switch from local to fake gives two intervals with two classes; (7) an adapter kind without a class fails `BUILD_MANIFEST`, nothing signed; (8) a seal resumed after a restart with the development flag changed writes the same manifest bytes; (9) a development-mode session can never seal with `developmentSources = false`; (10) fields 127-128 equal the `FIRST_VIDEO_SAMPLE` record. Totals: verify checks 15, manifest fields 128 |
| 83 (manifest builder) | Build 128 fields, not 120. **Recommended:** include fields 124-128 from the first build, so that no v2 package without them is ever sealed (before row 136 lands every source on this computer is a fixture, class `FAKE`). If the controller keeps fields 124-126 wholly in row 141, v2 packages sealed between rows 83 and 141 are development artifacts under `.data/`, fail V-15 afterwards and are regenerated; still no version step |
| 141 (mark + verify) | Fields 124-126 per §B.12 with rules 1-7; the exhaustive kind -> class mapping with a compile-time check; V-15 and §D.1; the report lines verbatim; when V-03 or V-09 fails the source line reads "Sources: not trustworthy — the manifest was altered" |
| 85 (verify v2) | Unchanged scope (V-01..V-14). Leave room for a fifteenth check and for the `sources` block |
| 126 (security review) | §H.5 as written; §B.12 rules 1-3; the "declared" wording |

## 8. Erratum rows for `masterplan/11_audit_errata.md` (not edited; for the controller to place)

Format of its §5.1: ID | spec file:line (after the edit) | old text (abridged) | new text | source | decision.

| ID | spec file:line | old text (abridged) | new text | source file:line | decision |
|---|---|---|---|---|---|
| **PE-124-01** | `masterplan/06_evidence_package_spec.md:25-26,76-77` | decisions "(D4, D7, D8, D10, D12)"; §0.1 ends at OD-21 | rev 2.3 decisions named; two §0.1 rows for the development-source mark and for the first video sample / origin | `decisions/decisions.md` D66, D72-D74, D78, D80 | D73, D78, D80 |
| **PE-124-02** | `06:436-502` (§B.12, new) | (no source-class field) | fields 124 `tracks[].sourceClass`, 125 `audio.sourceIntervals[].sourceClass` (enum `PRODUCTION` / `LOCAL_DEVICE` / `FAKE`, not null), 126 `developmentSources` (boolean, derived); 7 rules; dependency on row 121; alternatives | `masterplan/01_specs.md` R-11 AC-7, §B.2.6 item 7; `identification/02_structured.md:376` | D73, D78 (2), D80 (9) |
| **PE-124-03** | `06:181,245,266` | (B.1, B.4, B.5 without pointers) | pointers to fields 126; 124, 127, 128; 125 | — | D73, D80 (9) |
| **PE-124-04** | `06:383-388,390-391,399-409` (§B.10) | canonical body: two exclusions, nothing on new fields; example without them | the two exclusions are the only ones; fields 124-128 are in the signed digest; example extended | `06` §B.10 | D73, D78 (2) |
| **PE-124-05** | `06:329-330,536-544` | "Field count: 120 field definitions ... 120/120"; B.7a "120-field figures ... not restated" | **128** = 120 + 3 (D24) + 3 (source class) + 2 (first video sample) | `06` §B.7a (PE-R8-07) | D24, D73, D66 |
| **PE-124-06** | `06:567` (§C.1) | (no statement) | the mark is covered by the seal signature; editing it fails V-03, or V-09 if the digest is recomputed | `06` §B.10, §D | D78 (2) |
| **PE-124-07** | `06:624,626,637-648` (§D, §D.1 new) | "Verify count: 14 checks" | check V-15 (passes and reports; MISSING / CORRUPT only for a missing or inconsistent mark); count 15; report lines, `sources` block, status unchanged | `masterplan/01_specs.md` R-11 AC-7 | D78 (2), D80 (9) |
| **PE-124-08** | `06:674,708,728-736` (§E.1, §E.4, §E.6 new) | (no statement) | written in `BUILD_MANIFEST` from the session-start record; fails closed; interrupted seal carries it; steps stay 8 | `06` §E.1 | D73, D78 (2) |
| **PE-124-09** | `06:800` (§G.2) | (no statement) | the mark travels with every export | `06` §G | D78 (2) |
| **PE-124-10** | `06:863-872` (§H.5, new) | (no statement) | an all-`PRODUCTION` manifest is not distinguishable from a truly production package; guards: boot fence, Core-written class, signature; "declared" wording | `masterplan/01_specs.md` R-11 AC-1, AC-2, C-N14; `06` §C.3 | D73, D72 (l) |
| **PE-124-11** | `06:648` | (no statement) | display is owned by row 125; the label derives from the manifest or the verify result | `identification/02_structured.md:377` | D73 |
| **PE-124-12** | `06:459-460,512-521` | (no field; `cap §C.4` says "record the true first video pts per camera file in the manifest") | fields 127 `tracks[].firstVideoSamplePts`, 128 `tracks[].firstVideoSampleTimescale`, nullable, from the `FIRST_VIDEO_SAMPLE` record | `packages/capture-protocol/src/index.ts:148-155,427-438`; `masterplan/05_capture_architecture_spec.md:569` | D66 (4b), D72 (d), D72 (e) |
| **PE-124-13** | `06:523-534` | (no statement) | file time 0 = T0 − 1024/48000 s under the pinned flags; origin of the interval fields named as open | `packages/shared/src/api/capture.ts:61-82`; `masterplan/05_capture_architecture_spec.md:683` | D72 (d) |
| **PE-124-14** | `06:504-510` | (no statement) | v2: fields required, absence fails, never read as `PRODUCTION`; no schema or version step; v1 untouched | `grep -rl "dems.evidence-manifest/2" packages apps` = 0 files | D73 |
| **PE-124-15** | `06:880,882,888-889,909-910,915` | self-gate "120/120", "14 checks"; references; footer | 128/128, 15 checks, a self-gate row for row 124, rev 2.3 references | — | D73 |

## 9. Not done, by instruction

- `masterplan/11_audit_errata.md`, `03_api_contract.md`, `04_database_contract.md`,
  `05_capture_architecture_spec.md`, `08_client_ux_spec.md`, `10_test_strategy.md`,
  `identification/02_structured.md`, `decisions/decisions.md`, the trackers and all code were not
  touched.
- No UX was designed (row 125). No adapter kind was defined (row 121). No storage was designed
  (row 122).
- No implementation plan was written: `masterplan/02_plan.md` is not in this row's output.
