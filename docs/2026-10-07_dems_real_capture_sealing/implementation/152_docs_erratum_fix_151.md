---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-11
agent: coder-execution (documentation erratum after fix 151)
scope: documents only - masterplan/06_evidence_package_spec.md and this note; no code, test, script, README, lane, git write
status: needs-review
---

# 152 - Documentation erratum for fix 151 (PE-WK-47)

Documents only. Edited: `masterplan/06_evidence_package_spec.md`. Created: this note. Not edited: `masterplan/05_capture_architecture_spec.md`
(see item "05" below), `03`, `07`, `08`, the README, `decisions/decisions.md`, `status_tasks.md`, `file_claims.md`, any
`delegation_progress/*` file, anything under `apps/*`, `packages/*`, `scripts/`. No command of the product was run; no lane touched; read-only
`git status`, `grep` and `sed` only; no git write.

Convention continued from notes 147 and 148: a numbered erratum in place, one row in the file's errata index, a mention in the file's
`last_updated` (prepended), no earlier sentence deleted (a superseded sentence stays, with a bracketed mark that names what supersedes it).
The last id used before this pass was `PE-WK-46` (note 148); this pass uses `PE-WK-47`.

Sources read: `implementation/151_fix_manifest_profile_declared.md` (section 2 is the rule as built), notes 147 and 148, decision D226
(`decisions/decisions.md:239`), and the code, in the tree of 2026-10-11 (`b05106b` plus fix 151, uncommitted; the verification gate was
driving the environment and the files were not edited by this pass).

## 1. Changes

| Id | Section | What changed | Source |
|---|---|---|---|
| PE-WK-47 | 06 `last_updated` (line 26) | New entry prepended, naming PE-WK-47, the superseded sentences of PE-WK-16, the two limits, this note, note 151, D226 | note 147 convention |
| PE-WK-47 | 06 errata index (after the PE-WK-16 row, new row after PE-WK-19) | PE-WK-16's index row keeps its text and gains the bracket "[SUPERSEDED by PE-WK-47: the rate is not measured; it is the rate the stream declares]"; new index row PE-WK-47 | D226 |
| PE-WK-47 | 06 §B.4 table, field 36 row (line 330) | The cell keeps the PE-WK-16 text and gains "Erratum PE-WK-47 (fix 151): the field is the format the stream DECLARES ... never a measured rate and never a fraction; where PE-WK-16 below says 'measured', read PE-WK-47" | note 151 section 2 |
| PE-WK-16 (marked, not deleted) | 06 §B.4, PE-WK-16 paragraph (lines 411-415) | Four brackets added in place: (1) after "frame rate MEASURED over the first whole fragments": SUPERSEDED, nothing is measured, no fragment is read, `VIDEO_FRAME_RATE_FRAGMENTS` no longer exists; (2) after the cites `fragments.ts:558`, `:590`, `facts.ts:289`: those are of `b05106b`; (3) after "within 1 %" / "otherwise the measured rate with two decimals" / the `session-reader.ts:218-236`, `:381-382`, `:405` cites: SUPERSEDED in two parts, cites are of `b05106b`; (4) after "STREAM_PROFILE_DIFFERS": REFINED, "the stream" is the DECLARED format, a delivered or measured rate never raises it | `fragments.ts:718-732`; `session-reader.ts:225-266` |
| PE-WK-47 | 06 §B.4, new paragraph after PE-WK-16 (lines 418-434) | The correction: why the wave K measure was wrong (the hold of the first sample is inside the measured span; `EV-20261011-0025` sealed `H264_720P27.67` / `H264_720P26` from two 30-per-second streams) and a 10-row rule table: what the field is; picture size; nominal rate (first H.264 sequence parameter set of `avcC`, `time_scale / (2 x num_units_in_tick)`, `fixed_frame_rate_flag` not read); whole numbers only (N x 1000 / 1001 written N); the text shape; no rate stated = `H264_720P` (the six ways a stream states none, and a rate with no whole-number name); no picture size / no file = configured profile; the notice only for a declared difference; no fragment is read (a recording file and a sealed file give the same answer); sealed packages not re-judged (`EV-20261011-0025` and `ALR-000033` for ever, verify PASS 15 of 15). A closing paragraph: second recording `EV-20261011-0026` (`H264_720P30` on both tracks, no notice), unit proof, what was not run | see section 2 |
| PE-WK-47 | 06 §H.8 heading and intro (lines 1163, 1165) | Heading gains "PE-WK-47"; intro gains one sentence naming the two rows added after fix 151 | note 151 section 7 |
| PE-WK-47 | 06 §H.8, new limit row 1 (line 1172) | No manifest member states delivered or dropped frames: a camera delivering fewer frames than its nominal rate seals with the nominal label and no notice; for the next manifest revision, a per-track member (frames written; the span they cover excluding the hold of the first sample, fields 127 / 128 give the hold) fed by the worker's counters, not by re-reading `trun` boxes (ciphertext in a sealed file); until then the label is no proof of the delivered rate | note 151 section 7 item 2; `packages/shared/src/evidence-package/manifest.ts:163` (`firstVideoSamplePts`) |
| PE-WK-47 | 06 §H.8, new limit row 2 (line 1173) | HEVC parameter sets are not read: `hvc1` / `hev1` seals as `HEVC_<picture>P` (rate-less) and raises no notice under a selector of that codec and picture; the same label for an H.264 stream with no timing; source for an always-stated rate would be the worker (`frame_period_us`, `ingest.c:653-657`, logged only), a protocol member and a next-task item | `fragments.ts:459`, `:571`, `:702-705`; `session-reader.ts:246-250`, `:265`; `apps/capture-worker/src/ingest.c:653-657`; note 151 section 7 items 3, 4 |

Errata count: 1 new (PE-WK-47) in 1 document (`06_evidence_package_spec.md`); 1 earlier erratum marked in place (PE-WK-16). Registry totals
unchanged (97 / 36 / 61 / 67, schema 6 / `dbc-7`), manifest schema `dems.manifest/2` unchanged, no manifest member added.

## 2. Statements checked against the code (read in the tree, 2026-10-11)

| Statement in PE-WK-47 | Where it was read |
|---|---|
| The format is the FIRST video sample entry's width and height | `apps/core-server/src/capture/fragments.ts:690-694` (`videoFormatIn`, begins `:675`) |
| The rate is read from the first sequence parameter set held in `avcC`; a count of zero is not read | `fragments.ts:702-705` (`& 0x1f) >= 1`, length at `:704`, read at `:705`) |
| `time_scale / (2 x num_units_in_tick)` from the VUI timing information | `fragments.ts:667-671` (`timing_info_present_flag` `:667`; zero tick or scale refused `:670`; quotient `:671`) |
| `fixed_frame_rate_flag` is not read | `fragments.ts:667-671`: the function returns after the two 32-bit members |
| No VUI, VUI without timing, a parameter set that cannot be read to that point -> null | `fragments.ts:656` (`vui_parameters_present_flag`, `overrun`), `:667`, `:641` (more than 255 cycle entries), `:572` (not a type-7 NAL, shorter than 4, longer than 4,096 = `:564`) |
| No `avcC` (`avc3`, HEVC `hvcC`) -> null; HEVC parameter sets are not read | `fragments.ts:459` (`avc3` and `hvc1` / `hev1` are known sample entries), `:702-705` (only `avcC` is looked for) |
| Whole numbers only; N x 1000 / 1001 written N; 12.5 has no name | `apps/core-server/src/sealing-host/session-reader.ts:225-232` (`nominalRateOf`: exact within 1e-6, or `nominal * 1000 / 1001` within 1e-3, else null; `Math.round(12.5)` = 13 fails both) |
| Text shape `<codec>_<height>P<rate>` (16:9) / `<codec>_<width>X<height>P<rate>`; empty rate when none | `session-reader.ts:246-250` (`width * 9 === height * 16`) |
| Notice rule: declared whole rate -> texts differ; no rate -> codec or picture differ; unnameable declared rate -> differs | `session-reader.ts:261-266` (`:263`, `:265`, `:264`), used at `:432` |
| No picture size / no file -> configured profile | `session-reader.ts:406-413` (null entry), `:436` (`stream ?? configured`) |
| No fragment is read; a recording file and a sealed file give the same answer | `fragments.ts:718-732` (`videoStreamFormatOf` stops at `moov`, refuses at the first `moof` / `mdat` `:721`); `apps/core-server/src/capture-session/facts.ts:288-289` (recording file first, then the sealed camera file's path) |
| `VIDEO_FRAME_RATE_FRAGMENTS` and the measure no longer exist | `grep -rn "VIDEO_FRAME_RATE_FRAGMENTS" apps/core-server/src`: 0 hits |
| The notice is told once per session | `sealing-host/index.ts:274-290` (`profileDiffersTold`, unchanged); handed to the reader at `:435` |

Not re-read by this pass (taken from note 151 and D226, marked "the driver's run, not repeated" in the spec): the facts of the sealed
items (`EV-20261011-0025` labels and `ALR-000033`, verify 15 of 15 for `-0025`, `-0026` and `EV-20261010-0015`; `EV-20261011-0026`
`H264_720P30` on both tracks; holds of 1572 / 3121 ms and 1580 / 3103 ms). No package, manifest, key file or `.data/pg*.env` was opened.

## 3. Open items

| # | Item | Why open |
|--:|---|---|
| 1 | `05_capture_architecture_spec.md` was NOT changed. Its erratum PE-WK-15 (line 710-716) does not repeat the wrong statement: it says the manifest "said the truth against a selector that did not" and gives no rate rule. Its line cites (`fence/fake-profile.ts`, `boot.ts`) are untouched by fix 151. Its last sentence "the manifest then states the stream and the notice is raised" holds for a declared difference | The task allowed 05 only if PE-WK-15 repeated it |
| 2 | `README.md:644` ("The manifest states the recorded stream (`PE-WK-16`) ... picture size and measured frame rate") repeats the measured-rate sentence and is now stale | README outside this task; its owner should read PE-WK-47 |
| 3 | `masterplan/03_api_contract.md`: erratum PE-WK-13 (index row line 70; paragraph line 1225-1226) says the notice is raised "when the recorded stream is not the configured profile"; the ruling now reads "declared format differs from the configured profile". The sentence is not false but is imprecise. PE-WK-47 refines it from the evidence spec side only | `03` outside this task |
| 4 | Fix 151 open items 4 and 6 are not documented as limits: a stream with no timing seals `H264_720P` and raises no rate notice (covered by the HEVC / no-timing row of §H.8); the notice text for an unnameable declared rate ("VIDEO-01 is H264_720P (configured H264_720P30)") does not say the declared rate (not met by any source here) | Not behaviour a spec reader needs; named here for the next pass |
| 5 | Nothing in PE-WK-47 is gate-verified. The seal e2e and the kill matrix on the built worker were not run (fix 151 section 7 item 7); fix 151 is uncommitted. If the fix is changed before the commit, the line cites above move | Files in flight; the verification gate was driving the environment |
| 6 | Not edited, by the task's rule: `decisions/decisions.md` (D226 counts erratum ids up to `PE-WK-46` and does not name this one), `status_tasks.md`, the tracking table of `02_plan.md`, `file_requests.md`, `file_claims.md` (this task allowed no line there) | Controller's files |

## 4. Checks

No validation command applies to markdown; none was run. Checked by reading and counting: `PE-WK-47` appears in the file's `last_updated`,
the errata index (own row, plus the bracket on the PE-WK-16 row), the field 36 table cell, the PE-WK-16 paragraph (one bracket), its own
paragraph, the §H.8 heading and the two limit rows; no earlier sentence was deleted (every change is an insertion: a word-level diff against
`HEAD` shows five removed tokens, each a closing punctuation or bracket that reappears after an inserted bracket); no emoji (a range scan of the file, 0 hits). `git status` shows
`masterplan/06_evidence_package_spec.md` as the only masterplan file modified, plus this note as new.

---
*Generated: 2026-10-11*
