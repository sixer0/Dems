---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: test-expert
blueprint_row: 36 (class B, milestone M0, tier 1)
source_plan: identification/02_structured.md (rev 1, rows 36, 38, 39)
status: completed
delta_row_127: {blueprint_row: 127, date: 2026-10-09, section: A.4a, marks: PE-127-01..PE-127-18, new_checks: 111, totals: "330 active + 10 conditional = 340 named"}
---

# Test Strategy — DEMS real capture, sealing v2 and transcript

## 0. Purpose, inputs and short forms

This strategy maps every milestone gate M0-M9 of `identification/02_structured.md` §6 to **named
checks with run counts**, per blueprint row 36. It is the verification contract for the M2-M9 rows
that row 40 (rev 2) will create: every W-row must carry at least one check ID from this catalogue
into its Verification column. No tests are run in this row; nothing here executes an emulator, a
lane or an external service.

Short forms used in every "cites" column:

| Short form | File |
|---|---|
| `structured` | `identification/02_structured.md` (blueprint rev 1) |
| `specs` | `masterplan/01_specs.md` (row 28) |
| `C3` | `masterplan/03_api_contract.md` (row 29) |
| `dbc-3` | `masterplan/04_database_contract.md` (row 30) |
| `dbc-4` | the same file, section N (row 122: schema version 3, migration set `0008` + `0009`) — **Erratum PE-127-01** |
| `cap` | `masterplan/05_capture_architecture_spec.md` (row 31) |
| `ev` | `masterplan/06_evidence_package_spec.md` (row 32) |
| `tx` | `masterplan/07_transcript_spec.md` (row 33) |
| `ux` | `masterplan/08_client_ux_spec.md` (row 34; flows 9-13 and §14, §15 by row 125) |
| `sec` | `masterplan/09_security_design_review.md` (row 35; §11 = row 126, findings SEC35-27..SEC35-49) — **Erratum PE-127-01** |
| `register` | `research/03_analysis.md` (row 6, errata-applied register) |
| `explore` | `research/01_explore.md` (row 1) |
| `b2` | `research/05_b2_dependency_triage.md` (row 5) |
| `S1` / `S2` / `S4` / `TT` / `PICK` | spike artifacts `research/06`, `research/07`, `research/08`, `research/10`, `research/12` (rows 7, 8, 9, 12, 15) |
| `map` | `docs/2026-10-04_dems_backend_rbac_pairing/research/10_next_phase_impact_map.md` §7 (predecessor category convention) |
| `D4..D12` | `decisions/decisions.md` (this task); `D231/D232/D233/D258` via `report/report.md` §6 |

Hard-gate phrases this document must satisfy (`structured` row 36 Verification): every gate M1-M9
maps to named checks with run counts; the pinned-count file list matches row 6 (register E-06,
W1-C9, `map` §7.1 B/C/D families); 0 checks with >= 10 loops outside the pre-handover section.
The self-gate with grep evidence is section K.

**Two run-count classes only** (`structured` §6 intro):
- `2+1` — 2 runs by the producing row + 1 independent verification run at the gate, for every
  device / browser / spike / DB-backed gate check (standing rule D232/D233; `specs` §B preamble).
- `1` — once per workspace per checkpoint for unit/regression suites and static/doc checks
  (`structured` §6 intro; `dbc-3` §G "once per checkpoint" for MT unit-style tests).
There is no third class; no check in this file executes 10 or more times outside the pre-handover
section (section F.3, section K).

**Erratum PE-127-01 (row 127, 2026-10-09; D73, D78, D80-D86).** The checks of the new scope R-9
(camera discovery and the credential-gated connect flow), R-10 (no-device notifications) and R-11
(development-only local camera and microphone) are in **§A.4a**, with the traceability of the 32
acceptance criteria (§A.4a.9), the changed existing checks (§A.4a.10) and the values assumed where
two specs disagree (§A.4a.11). The two run-count classes stay the only ones: the one
manual-with-user check (`M5-LOCAL-CLAP-1`) runs once, in class `1`; the real-LAN probe
(`M4-DISC-LAN-1`) is a `2+1` check whose valid outcomes include "not run" with its reason. The
totals are restated once, in section K.

**Artifact conventions** (paths numbered after the existing `gateway_check/01..05`; row 37 and row
40 confirm the final names): M0 = `test/01_wave_a_regression.md` + `gateway_check/05_m0_spec_gate.md`;
M1 = `gateway_check/04_m1_spike_gate.md` (row 38); M2..M9 = one gate report per milestone,
convention `gateway_check/07_m2_gate.md` .. `gateway_check/14_m9_gate.md`, produced by the rev-2
verifier row; per-check command lines and outputs are recorded by the producing W-row in its own
`implementation/` artifact and copied into the gate report; device/browser checks attach
screenshots and console logs under `gateway_check/assets/`.

---

## A. Check catalogue per milestone

### A.0 M0 — wave-A checkpoint (row 27 + row 39)

| Check ID | Name | Asserts (one line) | Command / workspace | Runs | Owning row | Artifact | Cites |
|---|---|---|---|---|---|---|---|
| M0-RG-SHARED | shared suite | exit 0, count >= 71 files / 1,851 tests | `npm run test -w @dems/shared -- --maxWorkers=2` | 1 | 27 -> rev-2 | `test/01_wave_a_regression.md` | `structured` r27, r39; register E-06 |
| M0-RG-CSU | core-server unit | exit 0, >= 160 / 3,954 | `npm run test -w @dems/core-server -- --maxWorkers=2` | 1 | 27 | same | same |
| M0-RG-CSD | core-server db | exit 0, >= 124 / 1,751, 0 leftover test databases | `npm run test:db -w @dems/core-server -- --maxWorkers=2` | 1 | 27 | same | same; `dbc-3` §G command form |
| M0-RG-WEB | core-web suite | exit 0, >= 117 / 1,495 | `npm run test -w @dems/core-web -- --maxWorkers=2` | 1 | 27 | same | same |
| M0-RG-MOB | mobile suite | exit 0, >= 192 / 1,988 | `npm run test -w @dems/mobile -- --maxWorkers=2` | 1 | 27 | same | same; row 19 re-confirmed at W5 |
| M0-QA-1 | root typecheck + lint | both exit 0 on the post-B2 tree | root `typecheck` / `lint` scripts | 1 | 27 | same | `structured` r27 Verification |
| M0-LP-1 | ledger re-pin | added tests named (B10 rows 16-21, RC-1 row 22, B2 row 23); new floors recorded | grep of run logs vs E-06 values | 1 | 27 + 39 | same + `gateway_check/05_m0_spec_gate.md` | register E-06; section D.4 |

Row 39's M0 spec gate (errata 31/31, R 7/7, answered-OD applied, cross-check of rows 28-37 incl.
this file) is the verifier's own checklist — not duplicated here; it explicitly checks this
strategy against row 6 (`structured` §6 M0 row).

### A.1 M1 — spike gate (row 38, independent +1 over rows 7/8/9/12/15)

Each M1 check = the spike row's 2 runs + row 38's independent +1 (`structured` §6 M1). Row 38
re-runs the recipes quoted in each spike artifact (`TT` §9.2 is the written +1 recipe; `S1` runs
1/3 produced byte-identical chains, so chain equality is a reusable assertion).

Each spike row's own artifact (`research/06/07/08/10`, `PICK`) holds the two producing runs with
commands; **artifact of record for every M1 check** = `gateway_check/04_m1_spike_gate.md` (row 38)
with outputs and screenshots/logs under `gateway_check/assets/`.

| Check ID | Name | Asserts (one line) | Command / workspace | Runs | Owning row | Cites |
|---|---|---|---|---|---|---|
| M1-S1-1 | playable-while-growing | ffprobe reads the fMP4 while the writer grows it | `S1` §4.1 recipe (shell, FFmpeg) | 2+1 | 7 -> 38 -> rev-2 M3 | `structured` r7, §6 M1; S1 §4.1; specs R-4 AC-1 |
| M1-S1-2 | running hash equality | running prefix hash at close == `shasum -a 256` of the closed file | `S1` §4.4 recipe | 2+1 | 7 -> 38 | S1 §4.4/§6.3; specs R-4 AC-1 |
| M1-S1-3 | contiguous chain | fragment `seq` contiguous, no gap; per-fragment chain hashes link | `S1` §4.4/§5.2 | 2+1 | 7 -> 38 | S1 §4.4; specs R-4 AC-1/AC-2 |
| M1-S1-4 | crash truncation detected | SIGKILL mid-write: truncated tail detected (<= 20 ms bound), durable prefix re-hashes | `S1` §5.2-§5.5 | 2+1 | 7 -> 38 | S1 §5.4; specs R-4 AC-1; ev §E.4 |
| M1-S1-5 | S1 media-in-git zero | `git status --porcelain` lists 0 media files after the run | shell grep | 2+1 | 7 -> 38 | structured r7, r38; specs C-N3 (OD-25) |
| M1-S2-1 | one audio stream | ffprobe shows exactly 1 audio stream after the switch | `S2` acceptance table | 2+1 | 8 -> 38 | S2 §0/§4; structured r8; specs R-3 AC-1 |
| M1-S2-2 | PTS monotonic | audio PTS strictly monotonic across the switch | `S2` §4 | 2+1 | 8 -> 38 | S2 §4; specs R-3 AC-1 |
| M1-S2-3 | switch gap bound | **(corrected, AU2-05/AU2-07)** 0 inserted / 0 dropped samples by decoded sample count (= duration x 48,000 ± priming) + per-input continuity at the absolute sample index; boundary within one worker input quantum + IPC latency (<= 21.333 ms only for a 1024-sample pull loop). The packet-grid "0.001 ms" metric recorded at row 38 is **not** gap evidence (reads 0.0000 ms on a copy with 20.8 ms removed) | `S2` §4; AU-2 `s2/analyse_switch.py` method | 2+1 | 8 -> 38 (property re-proven by AU-2, D18) | S2 §4 (12/12); AU-2 §2; specs R-3 AC-1 |
| M1-S2-4 | interval log recoverable | switch instant logged as source interval; from/to media ms for both inputs, recoverable from the file | `S2` §6 finding 3 | 2+1 | 8 -> 38 | S2 §6; specs R-3 AC-2 |
| M1-S4-1 | AV within bound | aligned fixture measures AV offset within +/-40 ms (product bound) | `S4` analyzer recipe | 2+1 | 9 -> 38 | structured r9/§6 M1; S4; **erratum AU2-03:** true value 0.00 ms (+0.021 ms = one sample, sample-exact); the recorded "-1.333 ms" is a 10 ms-window artefact |
| M1-S4-2 | analyzer self-test | injected **+80 ms and −80 ms** offsets are flagged by the analyzer with the correct sign (not silently accepted); the −80 ms case is added by AU2-04 | `S4` self-test | 2+1 | 9 -> 38 (+80 ms); −80 ms measured by AU-2 (−80.052 ms) | structured r9; S4; **erratum AU2-03:** +80 ms measures 80.021 ms sample-exact (the recorded 78.667 ms is a window artefact) |
| M1-TT-1 | transcript non-empty | non-empty JSON transcript with segment start/end timestamps | `TT` §9.2 (+1 re-run of sealed fixture) | 2+1 | 12 -> 38 | structured r12; specs R-5 AC-1; TT §7 |
| M1-TT-2 | per-sentence coverage | >= 1 segment per scripted sentence (13 sentences), scoped to the whisper-granularity runs as the blueprint words it | `TT` §7/§9.2-5 | 2+1 | 12 -> 38 | structured r12; TT §7 |
| M1-TT-3 | language id | returned language is `id` | `TT` §4.1 | 2+1 | 12 -> 38 | OD-20 (D4); TT §7 |
| M1-TT-4 | CPU engine proof | GPU/Metal disabled in the quoted command | `TT` §3/§4 command quote | 2+1 | 12 -> 38 | structured r12; specs C-N1. **Erratum AU3-01/AU2-01: NOT MET at M1** — row 12 and row 38 ran on the oMLX/MLX server on `Device(gpu, 0)`; gate `04` STT-5 passed only the documented adaptation. The CPU clause moves to the rev-2.1 `cpu-local` functional-check row and to `M6-TF-1` on `cpu-local` |
| M1-TT-5 | two-speaker fixture | check runs on the two-voice Indonesian fixture (sealed bytes sha256 `6743181a...`, 65.72 s) | `TT` §2.4, §9.2-2 | 2+1 | 12 -> 38 | tx §E.1-1; TT §7 |
| M1-TT-6 | no throughput claim | artifact contains no RTF/WER/throughput figure (grep 0 matches) | `TT` §9.1 grep | 2+1 | 12 -> 38 | D230; structured §6 M1 "no RTF figure"; TT §9.1 |
| M1-TT-7 | server restored | oMLX server back to the handed-over DOWN state, no key material in artifacts | `TT` §3 | 2+1 | 12 -> 38 | D7(d) standing rule; TT §7 |
| M1-EP-1 | pick cites evidence | `PICK` matrix scores both engines on >= 7 named criteria and every score cites a row artifact (executed: 12 criteria) | doc check vs PICK §2 | 1 | 15 -> 38 | structured r15/r38; PICK §2.1 |
| M1-EP-2 | residual risk stated | pick memo states residual risk (incl. GStreamer "not evaluated on host", D12(d)) | doc check vs PICK §4 | 1 | 15 -> 38 | structured r15; PICK §4 |
| M1-GATE-1 | no media tracked | row 38 records "0 media files tracked by git" across all spike outputs | shell grep | 1 (gate-level) | 38 | structured r38 Verification |

### A.2 M2 — contract + DB foundation + Simulated parity

Suite runs of M2 are the `M2-RG-*` family (7 workspaces, 1 per checkpoint, floors per section D.4).
DB-backed gate checks run 2+1 per `dbc-3` §G "Run counts"; unit-style MT/catalog tests run once
per checkpoint. MT-1..MT-8 are **re-referenced, not re-specified** — pass conditions are `dbc-3` §G.
**Artifact of record for every M2 check** = `gateway_check/07_m2_gate.md` (rev-2 verifier row;
naming per section 0, confirmed by row 37), fed by each producing W-row's `implementation/` note.

| Check ID | Name | Asserts (one line) | Command / workspace | Runs | Owning row | Cites |
|---|---|---|---|---|---|---|
| M2-RG-SHARED / M2-RG-CSU / M2-RG-CSD / M2-RG-WEB / M2-RG-MOB / M2-RG-MOCK / M2-RG-PG | workspace suites | all 7 exit 0 at or above the current floors, added tests named | forms in section B.4 | 1 each | rev-2 M2 W-rows + gate | `structured` §6 M2, §6 intro; `map` §7; register E-06 |
| M2-QA-1 | typecheck + lint | root typecheck and lint exit 0 | root scripts | 1 | rev-2 | row 27 pattern |
| M2-LANE-1 | lane re-creation + per-lane pairing | procedure of `dbc-3` §F steps 1-8 completes: four DBs at schema 2 / `dbc-3`, three lanes with a Core (4421-4423) + Vite (5176-5178), each device paired to its lane, recording starts only after redeem returns **Erratum (PE-127-05, 2026-10-09; D83):** the M2 statement stands; after row 130 the four databases are at schema 3 / `dbc-4` (`M4-DB-APPLY-1`, §A.4a.1) | `dbc-3` §F command table (not restated here) | 2+1 (first M2 row runs 2; gate +1) | rev-2 first M2 row (DP-7) -> gate | `dbc-3` §F; `structured` §10 line 383, DP-7; D258 (report §6); section E |
| M2-DB-1 | MT-1 on throw-away clone | `db:migrate` 0004/0005 exit 0 on the v1 copy `dems_test_capture_*`; ledger current; `schema_meta = (2,'dbc-3')`; second run no-ops | `dbc-3` §G path 1; `npm run test:db -w @dems/core-server -- --maxWorkers=2` | 2+1 (gate check) | 30 §G MT-1 -> rev-2 | `dbc-3` §G MT-1; `structured` §6 M2 "migrations ... on a throw-away copy" |
| M2-DB-2 | MT-1 on fresh lanes | full set 0000..0005 applies to a freshly created lane, exit 0 | `dbc-3` §G path 2 | 2+1 (gate check) | 30 §G MT-1 -> rev-2 | same |
| M2-MT-2 | copy-migration on live data | 0004 validates against v1 rows with no data rewrite (v1 items keep `manifest_version = 1`) | db project | 1 | 30 §G MT-2 | `dbc-3` §G MT-2, §A.4, D-DB-05 |
| M2-MT-3 | three FAULT_KIND CHECKs accept new kinds | `MIC_SILENT`/`CAPTURE_FAULT` insert in all three tables (`0001_tables.sql:281/:382/:488`), a 15th value rejected, plus the other MT-3 accept/reject rows | db project | 1 | 30 §G MT-3 | `structured` §6 M2 "three FAULT_KIND CHECKs"; register E-01; `dbc-3` §C.1-§C.3 |
| M2-MT-4 | privileges + credential read restriction | privilege matrix equals `dbc-3` §D; **`SELECT capture_device_credentials` fails 42501 for `dems_app`**; reveal function returns the row; UPDATE on INSERT-only tables fails 42501 | db project | 1 | 30 §G MT-4, §B.3, §D | RK-12 (`structured` §Risk); `dbc-3` §B.3 (D-DB-06), §D; register §G RK-12 |
| M2-MT-5 | reset keeps the kept set | after reset on copy/lane: 11 kept tables image-equal, other tables equal v2 seed checksums, epoch +1 | db project | 1 | 30 §G MT-5, §E.1 | `dbc-3` §E.1; OD-19 |
| M2-MT-6 | reset guard (real evidence) | a `REAL` sealed row makes `db:reset` refuse `RESET_BLOCKED_REAL_EVIDENCE` with the DB untouched; `DEMO_PACKAGE` rows never block **Erratum (PE-127-05, 2026-10-09; D83 O-5, D86, SEC35-42):** from row 129 on, an item with `development_sources IS TRUE` whose four `session_capture_sources` rows are all development kinds is exempt from the block; `NULL` and `false` block — proven by `M4-SEC-RESET-1` (§A.4a.1); the narrowing awaits the user's confirmation (U-2) | db project | 1 | 30 §G MT-6, §E.2 | OD-19 (D4); RK-16; `dbc-3` §E.2 |
| M2-MT-7 | seed + bulk fixture v2 counts | seed counts (14 permissions, 22 grants, 1 capture_config, 5 devices, 0 credentials) and the `dbc-3` §G bulk minimums table hold; `rbac.matrix` boot equality (D88) | db project | 1 | 30 §G MT-7; register CS-19/CS-20 | `dbc-3` §G; section H |
| M2-MT-8 | catalog/vocabulary pin | catalog text of the three swapped CHECKs equals the 14-kind shared constant; `value-sets.ts` edited in the same commit | db project | 1 | 30 §G MT-8 | `dbc-3` §G MT-8 (CL-12/GD-05 pattern) |
| M2-API-1 | OpenAPI drift at 0.3.0 | `all` document version 0.3.0, 89 ops, 34 GET / 55 POST, registry==document drift test green; `openapi.json` regenerated **Erratum (PE-127-05, 2026-10-09):** 89 / 34 / 55 are the M2 values (as built since row 113: 92 / 35 / 57); the target after R-9..R-11 is **97 / 36 / 61**, re-pinned by `M4-PIN-1` (§A.4a.2). No `info.version` step is assumed for the five operations (D69: versions step once at the M6 gate) | `npm run test -w @dems/core-server -- <acceptance/contract> --maxWorkers=2` | 1 | 29 §8 + SH-19 W-row -> rev-2 | `structured` §6 M2; C3 §8; register SH-19 |
| M2-API-2 | offline scope 0.2.0 | `offline` constant 0.2.0 with the 13 simulated ops visible (offline grows 10 -> 23), 89-1 live-only op excluded; scope test re-pinned to OD-17 (byte-for-byte pin superseded) **Erratum (PE-127-05, 2026-10-09):** as built 26; target after R-9..R-11 **31** (ops 93-97 are `simulated`) — `M4-PIN-1` | `npm run test -w @dems/shared -- <api-openapi-scope> --maxWorkers=2` | 1 | 29 §8 + SH-19 W-row | C3 §8; OD-17 (D4); register W1-C9 |
| M2-API-3 | rbac.matrix boot | `rbac.matrix` boot passes with D88 equality on the new permission rows | db project boot test | 1 | rev-2 (SH-04) | `structured` §6 M2; specs C-N9; register SH-04 |
| M2-PIN-1 | pinned-count re-pin sweep | category B/C/D files now pin 89 / 30 / v2+`dbc-3`; grep for stale `75`, `28`, `dbc-2`, `0.1.0`, `0.2.1` in the section-C list = 0 remaining **Erratum (PE-127-05, 2026-10-09):** the pins move again with rows 129 / 132 / 142 — operations 97, schema v3 + `dbc-4` — in the checks `M4-PIN-1` and `M4-PIN-2`; the stale list of X-PIN-1 is extended (section C) | grep vs section C list, once in the gate | 1 | rev-2 pin W-rows -> gate | register E-06/SH-19/W1-C9; `map` §7.1; section C |
| M2-SIM-1 | Simulated regression vs `c2c983b` (behavior) | shared sim suites (determinism, simulated-isolation, demo-data-alignment, gap-closure, selector-stability) green; simulator answers v2 shapes per OD-17 (single audio, switch, new steps, transcript stub) | `npm run test -w @dems/shared -- --maxWorkers=2` + mock-core suite | 1 | 29/31 -> rev-2 | OD-23 (D4); `structured` §6 M2 (replaces `acaff20` gate); register SH-05..SH-08 |
| M2-SIM-2 | Simulated diff audit | `git diff --name-only c2c983b..HEAD -- packages/shared/src/sim/` lists only files owned by blueprint rows (rule: simulator changes only through rows) | shell | 1 | gate (verifier) | OD-23; `structured` §6 M2 |
| M2-AUD-1 | new audit types | the 9 new types (53 -> 62) write rows whose details equal the exact key lists of C3 §5.2, 0 secret keys; category map gains exactly 9 entries; the 9 new codes (31 -> 40) and the forbidden-key CHECK 17 -> 25 hold (C3 §4/§5; `dbc-3` §C) **Erratum (PE-127-05, 2026-10-09):** as built 63 types; R-9..R-11 add four (-> **67**), no new error code and no forbidden-key CHECK change — `M4-AUD-1`, `M4-PIN-1` | core-server unit (`audit-details`, vocabulary) | 1 | 29 §5 -> rev-2 | C3 §5.2; register E-10/E-30; specs C-N9 |
| M2-AUD-2 | refusal audit rules | camera-credential refusals are audited (fact only, `reason` key); `DEVICE_CREDENTIAL_REQUIRED` refusals write **no** row | core-server unit + e2e assert in M4 runs | 1 | 29 §5.1 (B4/E-30) | C3 §5.1; register E-30; `structured` §8 B4 |
| M2-CRD-1 | credential write-only API | no operation ever returns or logs a credential value; `CAPTURE_CREDENTIAL_SET` audit detail carries the device ID only | core-server unit/API contract test | 1 | 30 §B.3 + 29 §5 -> rev-2 | `dbc-3` §B.3 (D-DB-06/RK-12); C3 §5.1; row 35 surface (ref) |
| M2-DB-CHK-1 | signature CHECK relaxed | `Ed25519` + 128-hex + `simulated=false` accepted; `SIMULATED-SHA256` + 64-hex still accepted; `Ed25519` + 64-hex or `simulated=true` rejected (part of MT-3, named separately because the M2 gate cites it) | db project | 1 | 30 §C.4/§C.5 | `structured` §6 M2; `explore` §2.7 (line nuance :335/:336); OD-04/OD-03 |

### A.3 M3 — capture worker + supervisor + IPC on fake devices

Artifact of record for every M3 check: `gateway_check/08_m3_gate.md` (rev-2 verifier; section 0),
with producing rows' `implementation/` notes and `test/` checkpoint logs attached.

| Check ID | Name | Asserts (one line) | Command / workspace | Runs | Owning row | Cites |
|---|---|---|---|---|---|---|
| M3-RG-* / M3-QA-1 | suites + typecheck/lint | 7 workspace runs exit 0 at floors | section B.4 forms | 1 each | rev-2 M3 | `structured` §6 intro |
| M3-WI-1 | worker integration on fakes | two fake RTSP + two fake mics -> two playable fMP4; running hash == closed-file re-hash; checkpoints contiguous. **Erratum T-5 (PE-111-04/-07, D66; 2026-10-09):** (a) **both files grow on disk during the session** — file size sampled while recording, not only at close (muxer option `flush_packets=1` on each output; without it both files stay at 28 bytes until close); (b) after one fake **camera stops, the audio of its file keeps landing on disk** (a stalled camera must not stop its file's audio from becoming durable); (c) a **fatal error exits non-zero** — a mid-session mux / encoder / selector failure never looks like a clean stop | capture-worker + core-server integration run (`--maxWorkers=2`); on-disk size sampler during the session; stop-one-camera case; forced fatal error with exit-code assert | 2+1 | 31 §A.2/§A.4 -> rev-2 M3 W-rows (row 58 owns the three added assertions as required work); gate +1 | `structured` §6 M3; specs R-2 AC-1; register NM-02/NM-04/NM-14; cap §A.2 W-2/W-3/W-4, §A.8 (3), §C.2; `11_audit_errata.md` §5.5 T-5 |
| M3-AV-1 | AV sync through the worker | the sample-exact flash+beep analyser measures the pipeline output: \|measured − truth\| <= 2 ms (regression bound) for 0 / +80 / −80 ms truths, and within +/-40 ms (product bound), incl. across a mic switch (errata AU2-03/AU2-04). **Erratum T-4 (PE-111-02/-05, D66; 2026-10-09):** (a) the **fake mics are fed from a separate process** timed by its own wall-clock reads, not a generator inside the worker (with the beep synthesised in the worker from the same T0 that shifts the video, a T0 error or a capture latency cancels and cannot be seen); (b) **negative control:** one of the three forbidden mux options of cap §C.4 (`use_editlist=1`, `negative_cts_offsets`, `avoid_negative_ts=disabled` with `empty_moov`) is kept as a control case that this check must **FAIL** — by about 450 ms (446.58 / 454.35 / 452.52 ms measured) although the file still decodes with rc 0; (c) **if row 58 keeps the pinned flags** (the fallback of the `delay_moov` evaluation) the **first video sample is excluded** from the AV measurement (held first frame, up to one GOP; true first video pts recorded in the manifest) | same, analyser fixture; separate-process fake mics; one forbidden-mux-option control run | 2+1 | 31 §A.8 -> rev-2 (row 58: separate-process mics, flags decision, negative control) | `structured` §6 M3; specs R-4; S4 artifact; AU-2 §3; cap §A.2 W-5, §A.8 (1)/(4), §C.4; `11_audit_errata.md` §5.5 T-4 |
| M3-AV-2 | two-clock AV alignment (H-10) | fake camera in a **separate process with its own clock** (video by RTSP copy) + host-fed audio through the selector into **both** camera files; injected ±80 ms and a slow drift are measured per file within the regression bound; no drift beyond it over the run (added by AU2-06). **Erratum T-4 (PE-111-01/-05, D66; 2026-10-09):** (a) fake mics from a **separate process** and the same forbidden-mux-option **negative control** as `M3-AV-1` (and the same first-video-sample exclusion if the pinned flags stay); (b) the **present ±200 ppm drift case keeps its expectation: fitted slope = the injected value within the 2 ms regression bound** (2.0 ms at 10 s, about 6 ms at 30 s) — it never expects a slope near 0, because the present fixture's sender reports carry no rate information (video is anchored on the per-packet PRFT wall clock with a slew limit; the arrival-vs-camera trend is telemetry only and corrects nothing); (c) **new case, owned by row 62:** a fake camera whose RTCP sender reports pair a true wall clock with a **drifting media clock** (drift expressed in the sender reports) — only this case may expect a drift slope near 0 | same analyser, separate-clock fake camera (NM-14); separate-process fake mics; row-62 SR-drift fake camera | 2+1 | 31 §J H-10 -> rev-2 (row 58: mics + negative control; row 62: the SR-drift case) | cap §J H-10, §F "Video anchoring and drift", §A.8 (1)/(2)/(4), §C.4; AU-2 §3/§6 AU2-06; `11_audit_errata.md` §5.5 T-4; long drift stays C-9 |
| M3-KC-1 | RTSP ingest restart per session | after client TEARDOWN the supervisor restarts the **ingest** process and the next session produces a fresh playable file. **Erratum T-2 (PE-57-06, pair-57 F-5; D65(c), D67; 2026-10-09): recorded as two halves under this one ID.** *Process half* — a fresh worker process per session (process identity, one `START` per process, distinct output paths, no start before the old process exited): **MET at row 57** (navigator's own runs, D65). *File half* — "the next session produces a fresh playable file": **OPEN, owned by row 58** (no media exists at row 57, so nothing is measured there). The check is PASS only when both halves are; a row-57 result is recorded as "process half", never as "M3-KC-1 pass". **Scope of the restart wording:** true before the first durable fragment and between sessions only (restart rule option C, see `M3-KC-3`) | kill harness + `FakeWorkerProcess` hook (cap §B.1) for the process half; real worker on fakes + playability probe for the file half | 2+1 | 31 §A.4/§B.2 -> rev-2: **row 57 (process half, met)** + **row 58 (file half)** | S1 §4.5 (G-1, D10(b)); specs R-2 AC-2; `structured` §6 M3; cap §B.2 "Restart rule"; `pair_57_navigator.md:34,82`; `11_audit_errata.md` §5.5 T-2 |
| M3-KC-2 | worker SIGKILL mid-write | truncation detected <= 20 ms, durable prefix re-hashes, drop-fragment rule applied, no torn fragment enters custody; RECOVERY tail validation (box walk: declared sizes vs bytes present, file length == last declared fragment end) flags a cut inside an `mdat` that ffprobe accepts (AU2-08) | kill harness | 2+1 | 31 §C.5 -> rev-2 | cap §C.5; S1 §5.4; AU-2 §1; specs R-4 AC-1; `structured` §6 M3 "each worker-crash check 2 + 1" |
| M3-KC-4 | long-GOP crash loss | fake camera with a long GOP (`-g 250`) killed mid-GOP: the loss is bounded by one fragment = one camera GOP and is reported; the observed-keyframe-interval check raises the OP-GOP outcome (warning or `-frag_duration` ceiling, per the M3 design decision) (added by AU2-08) | kill harness + long-GOP fake camera (NM-14) | 2+1 | 31 §C.1 -> rev-2 | cap §C.1; AU-2 §1 (`gop250_kill`: 0 s durable at 7.0 s) |
| M3-KC-3 | heartbeat/back-off behavior | heartbeat timeout restarts with exponential back-off; unstartable worker emits `CAPTURE_FAULT` and fails session start cleanly. **Erratum T-3 (PE-57-06; D67 = option C per OD-08; 2026-10-09):** **scope** — the in-session restart with back-off applies **only before the first durable fragment** of a session (after the back-off budget: `CAPTURE_FAULT`); until the worker reports durability, "`START` acknowledged" counts as "may be durable" (no respawn after `RECORDING`); between sessions a fresh worker per session as before. **Sibling case (row 58):** a crash **after the durable record** -> the session goes to `FAULTED` (OD-08 interrupted seal of the durable prefix), the **launcher is not called again**, `CAPTURE_FAULT` is raised **once**; no respawned worker ever writes into an existing evidence file. As built at row 57 the supervisor still restarts in-session (`liveness.test.ts:168`); row 58 implements the rule, renames that pin "before the first durable fragment" and adds the sibling | `FakeWorkerProcess` | 2+1 | 31 §A.3/§B.2 -> rev-2: row 57 (as built, met in the pre-durable scope) + row 58 (option-C scope + sibling case) | cap §B.2 "Restart rule"; NM-03; OD-08 (D4); `11_audit_errata.md` §5.5 T-3 |
| M3-SR-1 | `src/capture/` static guard | G-R1, G-R2, G-R4, G-R5, G-R7, G-R8 hold over `src/capture/**`. **Erratum T-7 (PE-57-07/-08; D65(d), D68(b); 2026-10-09):** **G-R1 as corrected** — no host file imports `node:fs` **except the two pinned pre-capture importers** `src/plugins/config/connection-file.ts` and `src/plugins/logger/error-log.ts` (pinned by name; a third entry is a decision, not a habit); no host file imports `node:child_process`, `node:net` or `node:worker_threads`. **P25 pin** — the guard's pin of the frozen files now covers the waived edits **13-14** (`sttConfigModule` import + registration in `app.ts`, row 113) beside 1-6 and 11-12, and **every added line of `app.ts`** (a line nobody waived fails the pin); edits 7-10 (`config.ts`) are not landed (row 58) **Erratum (PE-127-06, 2026-10-09; D82, D86):** unchanged at M3. From M4 the same file also holds G-R9..G-R15 and the extended G-R4 / G-R6 for `src/capture/adapters/**` (G-R10 as corrected: no `node:net` import), and the P25 pin gains the waived edits 15-18 — check `M4-SR-1` (§A.4a.2) | `apps/core-server/src/capture/__tests__/static.test.ts` (vitest, 1) | 1 | 31 §G -> rev-2 creates (row 57; pin extended by row 113) | cap §G G-R1, §I; `explore` §2.4; `static.test.ts:113,120-122,208,233`; `11_audit_errata.md` §5.5 T-7 |
| M3-SR-2 | capture-worker static guard | G-R3, G-R4, G-R6 hold over `apps/capture-worker/**`. **Erratum T-6 (PE-111-02, D66; 2026-10-09):** plus the static rule (beside the AU2-07 rule) that **forbids `use_editlist=1`, `negative_cts_offsets` and `avoid_negative_ts=disabled` in the worker** (forbidden with `empty_moov`: each shifts the whole video track by about 450 ms while the file still decodes rc 0). The one option kept as the negative control of `M3-AV-1/2` must not weaken this rule for the worker itself; where that single occurrence lives is row 58's to pin | `apps/capture-worker/src/__tests__/static.test.ts` | 1 | 31 §G -> rev-2 (row 58 required work, D66; guard family row 61) | cap §G, §C.4; `11_audit_errata.md` §5.5 T-6 |
| M3-RTSP-BIND-1 | RTSP ingest binds 127.0.0.1 only | start the ingest and assert with `lsof -nP -iTCP:<port>` / `netstat -an` that every listener on 8554-8564 is bound to `127.0.0.1` and never `0.0.0.0`/`*`, incl. the NM-14 fixture readers; the static rule G-R4 forbids a wildcard literal in the worker command (added by RV-SPEC G-3). **Erratum T-1 (PE-111-03, D66; 2026-10-09): widened** — the TCP-port form cannot fail on anything that is not a TCP listener on those ports, so the check now takes `lsof -nP -a -p <worker pid> -i` and asserts that **every socket the worker process owns, TCP and UDP, is on `127.0.0.1`**: the worker owns no datagram socket on all interfaces (`UDP *:5000` / `*:5001` must not appear; `rtsp_transport=tcp` on the listen ingest does not prevent it). **Negative control:** a client that requests RTP over UDP (the case in which the row-111 skeleton opened `UDP *:5000` / `*:5001`) — the snapshot is taken with that client connected **Erratum (PE-127-06, 2026-10-09; C-N13, D75):** unchanged for the worker. Added reading: while a camera search runs the worker still owns no datagram socket — the one discovery socket belongs to the Core process and is `M4-DISC-SOCK-1`; the R-11 helpers bind nothing and push to `127.0.0.1` (`M4-LOCAL-WORKER-1`) | capture-worker socket snapshot of the worker pid (TCP + UDP) with a UDP-requesting client + static guard | 1 | rev-2 M3 W-row M3-W4; widened by row 58 (D66 required work) | cap §A.2 W-1, §A.4, §A.8; SEC35-23 (`sec` S7); specs C-N4; `11_audit_errata.md` §5.5 T-1 |
| M3-SR-3 | capture constants muxer safety | capture constants use only `frag_duration`, `frag_size`, `fragment_index`, `min_frag_duration` + the 4 movflags; `frag_type`/`default_prft`/`frag_start_number` never appear | constants unit (`CS-25`) | 1 | 31 §C.4 + C3 §7 -> rev-2 | specs R-4 AC-5; register W1-C1; cap §C.4 |
| M3-MG-1 | 0 media in git | after a full fake capture session `git status --porcelain` media-extension grep = 0; all bytes under `/.data/` or `.cache/` | shell grep | 1 (every capture checkpoint) | rev-2 M3 | `structured` §6 M3; OD-25 (D4); cap §H; specs C-N3 |
| M3-BC-1 | real-mode boot checks | boot requires worker binary, writable evidence store, signer key, model files; refuses otherwise | `CS-22` boot-check unit (no hardware) | 1 | 31 §A.2 (CS-22) -> rev-2 | specs R-2 AC-3, R-7 AC-1 |
| M3-REC-1 | lossless record path (**new, T-8**; PE-57-05, D67; 2026-10-09) | the three records — **first durable fragment**, **fragment checkpoint**, **seal completion** — are handled inline in the supervisor beside `ACK` and never pass through the lossy worker-event queue: (a) every record carries a per-session sequence number and a **sequence gap = `PROTOCOL_VIOLATION`**; (b) with the lossy queue flooded (telemetry / progress at its bound, evictions counted) **no record is dropped** and record order is kept; (c) **completion of sealing is not read from `PROGRESS`** with progress 1 — it comes from the seal-completion record, so an evicted final `PROGRESS` loses nothing. (The record frame is a hint, the file is the truth: the RECOVERY box walk stays `M3-KC-2`) | `packages/capture-protocol` + `src/capture` supervisor unit on `FakeWorkerProcess` (flood scenario), fake clock; section B.4 forms | 1 | row 58 (cap §B.2 required work R-1/R-2) -> gate | cap §B.2 "Delivery contract" + "REQUIRED WORK for row 58" R-1..R-3; `pair_57_navigator.md:323-345`; D67; `11_audit_errata.md` §5.5 T-8 |

**M3 gate log line (T-10; pair-57 F-9, `pair_57_navigator.md:38`; added 2026-10-09).** One line of the
M3 gate report, run once, not a named check of this catalogue: after the lane restart the Core log
shows `capture supervisor booted` after the last boot step, and `capture supervisor stopped` on
SIGTERM (strings `apps/core-server/src/capture/index.ts:67-68`). It is the only cover of the two
entry-point edits 11/12 (`index.ts:83`, `:108`) beyond the static pin and the type checker — no test
starts the entry point. The source names it "the M3 device gate"; the blueprint has no row of that
name (M3 gate = row 64, `gateway_check/08_m3_gate.md`), so the owning row is the controller's to
confirm.

### A.4 M4 — device selector + fake adapters

Artifact of record for every M4 check: `gateway_check/09_m4_gate.md` + screenshots/console logs
under `gateway_check/assets/` (agent-browser and emulator runs), fed by the producing W-rows.

Every client check runs on the **recreated lanes** (section E): web via agent-browser against the
lane Vite port (127.0.0.1:5176-5178), tablet/phone emulators with `adb reverse` remapped to the
lane Core port and re-paired per lane (`dbc-3` §F step 7).

**Erratum PE-127-07 (row 127, 2026-10-09; AP3 = D78).** The M4 gate set (row 70) is the 14 checks
of this table **plus the 91 M4 checks of §A.4a** = 105: discovery on the fake stub, the real-LAN
probe, the connect flow, the no-device notifications, the development fence, the two local helpers,
the migration set `0008` + `0009` and the client deltas.

| Check ID | Name | Asserts (one line) | Command / workspace | Runs | Owning row | Cites |
|---|---|---|---|---|---|---|
| M4-RG-* / M4-QA-1 | suites + typecheck/lint | 7 runs exit 0 at floors | section B.4 | 1 each | rev-2 M4 | `structured` §6 intro |
| M4-SEL-W | selector edit + audit from web | agent-browser edit writes exactly **one** `CAPTURE_CONFIG_CHANGED` row with permission + changed fields; slice `captureConfig` republishes **Erratum (PE-127-07, 2026-10-09; C3 §3.1):** the edited device may be any registered device of the right kind, incl. an adopted `CAM-NN`; each `captureConfig` line carries `sourceClass`; a candidate id is refused (`422`); the run states the lane's capture operation (`SIMULATED` / `REAL_DEVELOPMENT`) | agent-browser CLI on lane web (127.0.0.1, never `localhost`) | 2+1 | ux §2 + C3 ops 76-80 -> rev-2 | specs R-1 AC-1; `structured` §6 M4; ux §2 |
| M4-SEL-T | same on tablet emulator | selector change visible after refresh on the recreated lane; device re-paired to its lane **Erratum (PE-127-07):** as amended for `M4-SEL-W` | `dems2_tablet` (emulator-5556) via lane 2, app launch `demsdemo:///login?core=LIVE&motion=off` | 2+1 | ux §2 -> rev-2 | specs R-1 AC-2; `structured` §6 M4; register E-24 |
| M4-SEL-P | same on phone emulator | same assertion on phone **Erratum (PE-127-07):** as amended for `M4-SEL-W` | `dems2_phone` (emulator-5554) via lane 1 | 2+1 | ux §2 -> rev-2 | same |
| M4-LOCK-1 | config locked while session open | edit during an open session refused `409 CAPTURE_CONFIG_LOCKED` with **no** audit row and no state change (unit; also asserted inside each SEL run) **Erratum (PE-127-07, 2026-10-09; D80(4), D81, D86 C-4):** the same refusal, with no audit row and no state change, holds for ops **89, 95 and 96**; ops 93, 94 and 97 are **not** locked by an open session; the separate refusal of op 93 during `RECORDING` and its lift are `M4-DISC-REC-1` (§A.4a.2) | core-server unit, fake clock | 1 | 30/29 -> rev-2 | specs R-1 AC-1; OD-10 (D4); C3 §4 |
| M4-FAKE-1 | fake adapters | fake `CameraAdapter` / `PoeController` / `AudioInputAdapter` satisfy the device contract; two fakes emulate two cameras (OD-05); real adapters = class C, **not executed** **Erratum (PE-127-07, 2026-10-09; PE-123-02, D82):** the adapters live in the Core process (`apps/core-server/src/capture/adapters/`), not in the worker; the discovery half and the connection-test half of the camera adapter are no longer class C (H-7a) and are checked in §A.4a on fixtures; configuration actions on a camera and the pull path stay class C (H-7b, C-2) | unit/integration under `apps/capture-worker/src/adapters/` fakes | 1 | 31 §A.1/§A.6 -> rev-2 | `structured` §6 M4 (fake)/§9 C-1..C-4 (real); register NM-01 |
| M4-PC-1 | permission-check state | gated controls G1-G3/G9 show "Checking your permissions..." before enable/refuse (unit inventory + asserted in SEL runs) **Erratum (PE-127-07, 2026-10-09; D83):** plus the gated controls of flows 9-13 — G13-G17 (G18 is not built: no microphone toggle at pre-check); asserted inside the `M4-DISC-RBAC-*` runs | web/mobile state unit + e2e assert | 1 | 34 §11 -> rev-2 | ux §11 (10 controls x 3 clients, 6 reads); specs C-N12; register E-16 |

### A.4a R-9..R-11 checks — ACTIVE (NEW SCOPE D73; approved AP3 = D78; rulings D80-D86) **Erratum PE-127-02**

**Scheduled and counted as active.** Blueprint row 127 (`structured` rev 2.3). The checks below cover
the 32 acceptance criteria of `specs` §B.2 (R-9 AC-1..16, R-10 AC-1..6, R-11 AC-1..10) and the
constraints C-N13..C-N15. They count in three gate sets: **M4 + 91** (rows 129-138, 142; gate row
70), **M5 + 11** (rows 139, 140, 71; gate row 75), **M7 + 9** (rows 141, 84; gate row 89). The rows
stay in this section (the §A.6a precedent). Rows 129 and 130 are certain — the schema change is
confirmed by D83 — so their checks are active, not conditional. Where two input specs disagree, the
value each check assumes is listed once in §A.4a.11; the controller rulings D80-D86 are binding.
IDs proposed by the UX delta (`ux` §15.2) and by the security delta (`sec` §11, record
`delegation_progress/security_review_row126.md` §6) are reused unchanged; one check has one ID.

Rules common to every check of this section:

| # | Rule | Authority |
|---|---|---|
| CR-1 | **Fixtures only.** Every automated check searches and connects to the fake ONVIF stub (`cap` §A.8.1 ST-1..ST-3 and ST-5; ST-4 removed, D82) and fake cameras on `127.0.0.1` with fixture credentials that exist only in test set-up. No automated check sends a datagram or opens a connection off loopback. The one exception is `M4-DISC-LAN-1` | specs R-9 AC-14; D74(1) |
| CR-2 | **Canaries.** A check that handles a credential uses two values minted per run in test set-up — a user-name canary and a secret canary (random hex after a fixed prefix). Neither is ever a real credential. "0 hits" always means both canaries, in clear, base64 and URL-encoded form | D86 C-6; SEC35-36 |
| CR-3 | **Agent rules.** No agent types, stores, receives or guesses a real camera credential; a step that needs one stops and hands over to the user. No agent opens local-device media (or a frame, still, waveform or transcript of it) with a viewing tool: checks on it are numeric and local (duration, sample count, level in dBFS, keyframe interval, hashes). No agent touches the macOS permission database or system settings | D76(4); D86 C-7; D74(3); SEC35-44 |
| CR-4 | **Constants by name.** A test reads every limit, window and deadline from the shared constant, never from a literal, and drives time with a fake clock (B.3), so that the reconciliation of row 128 moves no test | D86 C-8; specs C-N5 |
| CR-5 | **Client checks** run on the recreated lanes (section E): web via agent-browser on the lane Vite port (`127.0.0.1`, never `localhost`), tablet = `dems2_tablet` (emulator-5556) on lane 2, phone = `dems2_phone` (emulator-5554) on lane 1, each re-paired to its lane. The lane Core runs with the fake ONVIF stub on loopback; it is started by a test-support launcher (under `apps/core-server/test/support/`) that builds the app with the fake adapter registry and passes the loopback probe target as a constructor argument — no environment variable, no configuration key, no file under `src/` (`cap` DS-15; SEC35-27 (6); **erratum PE-128-91**); a check that needs development sources runs it as `REAL_DEVELOPMENT` with the stub helper in place of this Mac's devices. No PIN is typed by an agent (section G) | section E; `ux` §15.2; D83 |
| CR-6 | **Captures.** No screenshot within 2 s of typing into a password field; the reveal control is never on in a capture; a capture of a local-device session shows no picture of the developer (playback captures use an all-`FAKE` session) | section G; D86 C-1; SEC35-44 |
| CR-7 | **Depth.** Device, browser, real-LAN, harness and DB-backed gate checks run `2+1` (2 runs by the owning row, +1 at the gate); unit, static and contract checks run `1` per checkpoint. Several client checks may share one lane boot and one sign-in; each still has exactly 3 executions. One check is manual-with-user and runs once (`M5-LOCAL-CLAP-1`) | B.1, B.2; D232/D233 |

#### A.4a.1 M4 — database delta `dbc-4` (rows 129, 130)

"Migration `0008`" in the blueprint means the set `0008_capture_sources.sql` (generated) +
`0009_capture_sources_privileges.sql` (hand-written), version `(3, 'dbc-4')` (D83, D-DB-17).
MT-9..MT-16 are **re-referenced, not re-specified** — pass conditions are `dbc-4` §N.12. MT-13 is
`M4-CONN-ATOM-1` (§A.4a.3, row 142).

| Check ID | Name | Asserts (one line) | Command / workspace | Runs | Owning row | Cites |
|---|---|---|---|---|---|---|
| M4-MT-9 | set 4 applies (MT-9) | on a throw-away copy of `dems_demo` and on a fresh database `db:migrate` exits 0 with both files; ledger current with 10 files; `schema_meta = (3,'dbc-4')`; **a second run applies nothing**; on the copy the 5 device rows read `FAKE`, the 13 items read `development_sources IS NULL`, `session_capture_sources` holds 0 rows; live `dems_demo` and the lanes are not touched by this check. **Must FAIL when** `0009` is left out (the version stays `(2,'dbc-3')`) or a file hash differs from the ledger | db project on throw-away databases `dems_test_capture_*`; `npm run test:db -w @dems/core-server -- --maxWorkers=2` | 2+1 (gate check) | 129 -> gate 70 | `dbc-4` §N.8, §N.12 MT-9; D83; `structured` r129 |
| M4-MT-10 | CHECKs of set 4 (MT-10) | `capture_devices`: the 8 legal (kind, adapter) pairs accepted, the 7 illegal pairs refused by `capture_devices_adapter_pairing_check`, a sixth kind and NULL refused; a second row with the same non-null `onvif_uuid` refused `23505`, two NULLs accepted. `session_capture_sources`: a fifth slot, a wrong kind per slot, a second row for one (session, slot) and an unknown `device_id` (`23503`) refused. Every case is an accept/refuse pair, so a dropped CHECK fails the test | db project | 1 | 129 | `dbc-4` §N.2, §N.3, §N.12 MT-10 |
| M4-MT-11 | privileges, no SELECT regression (MT-11) | as `dems_app`: `UPDATE capture_devices SET adapter_kind` fails `42501`; UPDATE and DELETE on `session_capture_sources` fail `42501`, INSERT and SELECT succeed (**INSERT-only**); `UPDATE evidence_items SET development_sources` fails `42501`; **`SELECT` on `capture_device_credentials` and on `stt_config.secret_ciphertext` still fails `42501`**; the matrix covers 41 tables and 426 columns. **Negative control:** on a throw-away database a planted `GRANT SELECT ON ALL TABLES IN SCHEMA public TO dems_app` makes the two secret-table assertions fail | db project | 1 | 129 | `dbc-4` §N.8 (no blanket SELECT), §N.12 MT-11; `M2-MT-4`; RK-12 |
| M4-MT-12 | device upsert keeps the adapter (MT-12) | the engine's UPSERT on an existing id succeeds and leaves `adapter_kind` unchanged; the mapping refuses a slice that changes the adapter of an existing id; neither `adapter_kind` nor `kind` is named in an UPDATE (the D72(f) class: a missing grant stays invisible until the code path runs — so the test runs the path as `dems_app`, not as the owner) | db project | 1 | 129 (pin), 65 (upsert) | `dbc-4` §N.12 MT-12; D72(f); D83 (D-DB-13) |
| M4-MT-14 | reset keeps adopted and local rows (MT-14) | an adopted `ONVIF_RTSP` row and a `LOCAL_DEVICE` row survive a reset with their kind (kept images equal); `session_capture_sources` is emptied; the version stays `(3,'dbc-4')`; the kept set stays 12 | db project | 1 | 129 | `dbc-4` §N.10, §N.12 MT-14 |
| M4-MT-15 | seed and bulk fixture of `dbc-4` (MT-15) | seed: 5 built-ins all `FAKE`, 0 source rows, NULL flags on v1 items; the bulk fixture meets `dbc-4` §N.10 (`capture_devices` 12, `session_capture_sources` 1,600, the `evidence_items` mix) | db project | 1 | 129 | `dbc-4` §N.10, §N.12 MT-15; section H |
| M4-MT-16 | B-3 across the version step (MT-16) | new code on a database at `(2,'dbc-3')` is refused with the message that names `db:migrate`; old code on `(3,'dbc-4')` is refused — both directions, so a Core that boots on the wrong side fails the test | db project boot test | 1 | 129 | `dbc-4` §N.9, §N.12 MT-16 |
| M4-PIN-2 | `dbc-4` pins moved with the migration | the 15 pin groups of `dbc-4` §N.12 carry the new values **in the commit that adds set 4** (41 tables / 426 columns / 41 PK / 40 FK / 15 UNIQUE / 4 unique indexes / 23 indexes / 172 CHECKs; `T-01`..`T-41`; 44 value sets; ten files, six hand-written; `{ i: 83, r: 41 }`; INSERT on 25 tables; every `3` / `dbc-4` version string; `BULK_MINIMUMS` 41); the two pins that stay are unchanged (`KEPT_TABLE_NAMES` 12, `BOOT_CHECK_IDS` `B-2`..`B-9`); the extended X-PIN-1 grep returns 0 stale values. **Must FAIL when** one group keeps its old value (the db suite is red on that group) | db project + `git show --stat` of the commit + grep vs `dbc-4` §N.12 | 1 | 129 | `dbc-4` §N.11, §N.12; section C |
| M4-DB-APPLY-1 | set 4 on the four development databases | `dems_lane_1..3`, then `dems_demo`, each under `/usr/bin/lockf -k .locks/db-migrate.lock` with every lane Core stopped: before = `2 (dbc-3)` with 5 device rows (assumption A-122-1 checked at step 1), after = `3 (dbc-4)`, ledger 10 files; **a second run applies nothing**; kept-table row counts and the per-lane pairing rows equal before and after; no reseed, no reset; old code is refused on each database (B-3). **Must FAIL when** one database reports another version than the other three | `db:status` before and after on the four databases; `db:migrate` under `lockf`; row-count listing | 2+1 (run 1 applies, run 2 is the no-op run, +1 at the gate reads the four databases) | 130 -> gate 70 | `dbc-4` §N.8 (order), §N.14; D83 (O-7: the controller picks the moment); `structured` r130 |
| M4-SEC-RESET-1 | reset-guard exemption cannot erase real evidence | on a throw-away database: an item with `development_sources IS NULL` **blocks** the reset; `false` blocks; `true` with one production kind among its four `session_capture_sources` rows blocks (the cross-check), and so does `true` with fewer or more than four rows; an all-development item passes, the reset prints how many development packages it will erase and proceeds only on the existing confirmation; as `dems_app` none of the three facts can be updated. The predicate in the code is `IS TRUE` (a "not false" form fails the NULL case) | db project on a throw-away database | 2+1 | 129 -> gate 70 | SEC35-42; D83 (O-5), D86; `dbc-4` §N.10; amends `M2-MT-6` (§A.4a.10) |

#### A.4a.2 M4 — discovery, search API and their guards (rows 131, 132)

| Check ID | Name | Asserts (one line) | Command / workspace | Runs | Owning row | Cites |
|---|---|---|---|---|---|---|
| M4-DISC-TRIG-1 | search trigger | a Core booted in capture mode `real` against the stub sends **0** probes at boot, after a fake-clock advance of one hour, and after every read (ops 76, 77, 94); exactly 1 search after op 93; exactly 1 inside a pre-check run with a configured camera unreachable and 0 inside a pre-check with every camera reachable. **Must FAIL when** a probe is counted before a trigger (control: a planted `discover()` call in an `onReady` hook) | core-server unit on the stub, fake clock | 1 | 132 (131: adapter) | specs R-9 AC-1; D74(1); C3 §2.6 "Search trigger" |
| M4-DISC-STUB-1 | discovery on the fake ONVIF stub (loopback only) | N stub devices (N = 0, 1, 3) -> N candidates carrying the announced endpoint reference, name and hardware hints (a vendor value may be null), built from the **probe answer only**; a stub device whose `onvif_uuid` (else whole `address`) is in `capture_devices` reads `REGISTERED` with its `deviceId`, the others `NEW`. After the search: `capture_devices` and `capture_device_credentials` have 0 new and 0 changed rows (count and checksum before and after); the stub request log shows **0** requests to its device service (no follow-up read, D80(1)), 0 authenticated, 0 configuration and 0 RTSP requests. Passes with no camera on the LAN. **Must FAIL when** a candidate count differs from N or the stub logs any request beyond the probe | core-server integration on the stub + db project (`--maxWorkers=2`) | 2+1 | 131 (adapter), 132 (API) -> gate 70 | specs R-9 AC-2, AC-3; D76(1), D80(1), D83 (D-DB-15); `cap` §A.8.1 ST-1, ST-5; `structured` r132 |
| M4-DISC-LIFE-1 | candidates are not devices | the list is gone at `expiresAt`, at sign-out, at expiry of the owner session, at a Core restart and when the owner starts a new search; candidates never appear in op 77 or the `captureDevices` slice; a second operator session reads `search: null` and gets `404 NOT_FOUND` for the first session's candidate id with 0 outbound requests; ops 78 / 79 refuse a candidate id (`422`) | core-server unit, fake clock | 1 | 132 | specs R-9 AC-4; C3 §2.6 "Candidate state" |
| M4-DISC-NOLAN-1 | the automated suite never leaves loopback | during the discovery and connect suites every datagram destination and every TCP peer of the test processes is `127.0.0.1` (the probe target is the injected loopback target; the multicast constant is never the destination under test); the suites pass with the network interface down. **Negative control:** a test case that leaves the default target in place is refused by the test-support guard before a datagram is sent | capture / core-server test-support guard + socket snapshot of the test process | 1 | 131 | specs R-9 AC-14, C-N13 (7); SEC35-27 (6) |
| M4-DISC-SOCK-1 | one UDP socket for the duration of a search | socket snapshot of the Core process (`lsof -nP -a -p <core pid> -i`) on the stub: **0** datagram sockets before the search, **1** during the window, **0** after it and after each error path (send error, window end, adapter failure); the capture worker owns none at any time. **Negative control:** a build that leaves the socket open after the window must show 1 in the "after" snapshot | booted Core on the stub + three snapshots | 1 | 131 | specs C-N13, R-9 AC-15; `cap` §G.1 "Run-time checks"; D75 |
| M4-DISC-LAN-1 | real-LAN probe | one search on the network this Mac is on at test time, outside the command sandbox through the permission gate. Outcome per run is exactly one of: **`FOUND (N)`** with N >= 1; **`EMPTY (N = 0)`** — a pass that must end in the R-10 situation-A notification (asserted in the +1, which runs through op 93 on a booted Core; the two producing runs are adapter-level and report the count); **`NOT RUN (reason)`** when the Mac is on no network it can test (D78) or when no probe left the interface (send error, or the interface output-packet counter did not rise by the number of datagrams sent — H-13). `NOT RUN` is reported as such, never as an empty network and never replaced by a probe elsewhere. Also asserted: socket snapshot 0 / 1 / 0; **0** TCP connections to a non-loopback peer (no authentication, no configuration, no device-information read); the tool output and every committed file carry **counts and model class only — 0 matches of an IPv4, MAC or serial pattern**; identifying results only under git-ignored `.data/` or `.cache/`. **Negative control:** immediately before each run the same harness reports 2 on a stub set to 2 and 0 on a stub set to 0 | adapter harness (runs 1-2) and op 93 on a booted Core (+1); interface counter by name only; grep of the output and of `git status --porcelain` | 2+1 | 131 -> gate 70 | specs R-9 AC-15, AC-16; D75, D78(1), D86 C-7; `cap` §J H-7a, H-13; SEC35-30; `structured` r131, r70 |
| M4-DISC-RBAC-1 | roles on ops 93, 94, 97 | SUPERVISOR and TECHNICIAN are accepted; every other role is refused `403 NOT_PERMITTED` with one `ACCESS_DENIED` row and 0 datagrams; the search inside a pre-check runs for a starter without `CAPTURE_CONFIG`, who then gets the alert and `403` on op 94 | core-server acceptance (`rbac-matrix`) + unit | 1 | 132 | specs R-9 AC-12; D80(2); C3 §2.6 access notes |
| M4-DISC-REC-1 | search during `RECORDING`: refused, then lifted | **(a) before the lift:** with a fake-worker session in `RECORDING`, op 93 answers `409 INVALID_STATE` (`DISCOVERY_NOT_ALLOWED_WHILE_RECORDING`), 0 datagrams, no audit row, no alert (**erratum PE-128-92**); in every other open state (pre-check included) a search is accepted. **(b) the lift** is the constant `CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED`, whose change is allowed only when the gate artifact holds `M4-SEC-DISC-1` PASS and `M4-SEC-DISC-3` PASS (2 runs + 1); a static pin fails when the constant is on and the two results are not recorded. **(c) after the lift:** a search on the stub during `RECORDING` completes with its candidates **and the capture path is unaffected** — fragment `seq` contiguous with 0 dropped or duplicated, checkpoints keep arriving, no `CAPTURE_FAULT`, the session stops cleanly. **Must FAIL when** (a) answers 202, or in (c) one fragment is missing | core-server integration with the fake worker on the stub; analyser over `recording_fragments` | 2+1 | 132 (with 131) -> gate 70 | D86 C-4 (narrows D80(4)); SEC35-29 (6); specs R-9 AC-13 |
| M4-SEC-NET-1 | outbound exemptions pinned by file | the server-wide network guard allows `dgram` in exactly `src/capture/adapters/camera/ws-discovery.ts` and the package `onvif` (imported as `onvif/lib/cam`) in exactly `src/capture/adapters/camera/onvif-session.ts`; `http` / `https` there for the name `Agent` only; `node:net` has **no** exemption (no RTSP client, D82). **Positive controls:** planting each module name in a third file turns the test red | `apps/core-server/test/static/network.test.ts` (static guard) | 1 | 131 (`dgram`), 142 (`onvif`) | SEC35-27; D82; `cap` §G.1 |
| M4-SEC-DISC-1 | hostile probe answers never stop the Core | every case of `cap` §A.8.1 ST-2 (wrong `RelatesTo`, unasked answer, foreign `XAddrs`, no `XAddrs`, two `ProbeMatch` children, empty `ProbeMatches`, 60 KiB body, entity expansion, non-XML bytes, 300 answers) plus 2,300-level nesting at 16 KiB, 1,300 attributes, a DOCTYPE, `__proto__` / `constructor` elements **and a parse callback made to throw**: 0 uncaught exceptions, the process stays up, the search completes, heap growth under 8 MiB. **Negative control:** with the handler's `try` / `catch` removed in a test double, the throwing-callback case must end the test process | core-server unit on the stub, fake clock, on the pinned `xml2js` version | 1 | 131 | SEC35-29; `cap` §J H-14; D86 |
| M4-SEC-DISC-2 | forged answers: clone, crowd-out, spoofed source | a clone answering with a real camera's endpoint reference from a second address -> **two rows, both `conflict`, 0 testable** (the real camera is never silently replaced); 300 responders -> 64 listed, already-registered matches kept first, `truncated: true`; a source that is this host's own address, the broadcast or network address -> dropped and counted; a second answer from one source -> counted, not listed; a registered endpoint reference at another address -> `addressChanged` | core-server unit on the stub | 1 | 131 (132: shape) | SEC35-28; D86 |
| M4-SEC-DISC-3 | hostile flood during `RECORDING` | with a fake-worker session recording, the ST-2 flood and the throwing-callback case are delivered to a search started through the test harness (the API gate of `M4-DISC-REC-1` (a) stays in force): the session continues, its fragment counter advances contiguously, 0 `CAPTURE_FAULT`, the Core process identity is unchanged. This check and `M4-SEC-DISC-1` are the two results that lift the 409 | core-server integration with the fake worker | 2+1 | 131, 132 -> gate 70 | SEC35-29; D86 C-4 |
| M4-SEC-DISC-4 | interface count only | with two fake interfaces the search result and the `CAPTURE_DISCOVERY_SEARCHED` row carry the interface count 2 and no interface name or address; the socket type literal is `udp4`; no log call of `adapters/**` carries a device-identifying key. Its real-network half is the output rule of `M4-DISC-LAN-1` | core-server unit + static | 1 | 131 | SEC35-30; `cap` §G.1 G-R4 (extended); D86 C-7 |
| M4-SEC-RATE-1 | every rate bound | one case per bound of the limit set as fixed at row 128 (search: single-flight per Core, spacing per session and per Core, per-minute and per-hour bound, the pre-check search's own allowance; test: spacing per host and per operator session, per-minute bound per Core; op 97 spacing): the call over the bound answers `429 RATE_LIMITED` with `retry-after`, **0 datagrams or 0 outbound requests**, no audit row; the call at the bound is accepted | core-server unit, fake clock | 1 | 132 (search), 142 (test) | specs R-9 AC-11; SEC35-39; C3 §2.6 "Rate limits", §7 |
| M4-SEC-TXT-1 | untrusted device text | a name / model / scope containing markup, control characters, bidirectional overrides or 5,000 characters is cut to 120 characters and stored and returned as text; drawn as one literal line (component half in `M4-UX-UNIT`) | core-server unit | 1 | 131 (137, 138: drawing) | SEC35-48; C3 §2.6 `CaptureCandidate` |
| M4-SEC-DEP-1 | dependency integrity | the lockfile integrity value of `onvif` 0.8.3 equals the value reviewed by row 126; `xml2js` is pinned exactly; X-DEP-1 is re-run after the install and its counts recorded; the licence entries reach row 96 | install log + lockfile grep | 1 | 131 | SEC35-49; D82(a); `cap` §A.6.1a |
| M4-SR-1 | static rules for adapters, socket and helpers | in `src/capture/__tests__/static.test.ts`: G-R9 (`node:dgram` in one file, one `createSocket`, a `close` on every exit path, no `addMembership`); G-R10 as corrected (**no** file under `src/capture/**` imports `node:net`; D82); G-R11 (`onvif` in one file, pinned call list, `autoconnect: false`); G-R12 (helpers and `mkfifo` only through `ipc.ts`; argument table literals; no wildcard address, datagram transport, listen flag, user-info or shell metacharacter; no screen-capture name); G-R13 (`discover` has exactly the two call sites of R-9 AC-1); G-R14 (no credential literal, no vendor-default table, no `FAKE` substitution in a `catch`); G-R15 (the development flag is read in one function); G-R4 and G-R6 as extended; the P25 pin covers the waived edits 15-18. **Each rule has a planted-violation control** | `apps/core-server/src/capture/__tests__/static.test.ts` (vitest) | 1 | 131 (G-R9, G-R13), 142 (G-R10, G-R11), 136 (G-R12, G-R14, G-R15), 61 (family count) | `cap` §G.1; specs R-9 AC-1, AC-7, R-11 AC-1, AC-5; SEC35-27 |
| M4-PIN-1 | contract pins after R-9..R-11 | the pin files of section C family B and the OpenAPI document hold **97 operations / 36 GET / 61 POST**, `offline` scope 31, **67 audit types**, 40 error codes, 30 slices, 6 access conditions, **Try-it denied list 10** (ops 95, 96 beside 89); `openapi.json` regenerated and the registry == document drift test green; the INTERNAL sim-action count is re-pinned if rows 133 / 139 add an action. Stale grep for `92` / `35` / `57` / `63` / `26` in those files = 0. The final values hold after the later of rows 132 and 142; row 132 records the intermediate values it lands. **Must FAIL when** the registry and the document differ by one operation | shared + core-server acceptance (`contract`, `rbac-matrix`) + core-web API-reference tests + grep | 1 | 132, 142 | C3 §10.1; section C; `structured` r132 |
| M4-AUD-1 | four audit types, exact keys, no values | `CAPTURE_DISCOVERY_SEARCHED`, `CAPTURE_CONNECTION_TESTED`, `CAPTURE_CANDIDATE_ADOPTED`, `CAPTURE_DEVICE_UNREACHABLE` write rows whose details equal the key lists of C3 §5.2 as reconciled at row 128; the category map gains exactly four entries; 0 secret keys; no username, secret, URL or label in any detail, alert `params` or alert text; an empty search writes one search row and no second audit row. **Must FAIL when** a row carries an extra key (control: a planted `username` key is refused by the key rule) | core-server unit (`audit-details`, vocabulary) | 1 | 132, 133, 142 | specs R-9 AC-9, R-10 AC-6; C3 §5.2, §5.4; D80(8); E-30 / E-31 |

#### A.4a.3 M4 — connect flow on the server (row 142)

The connection test is judged from the authenticated ONVIF answer; there is no RTSP client in this
phase (D82). The credential travels in the body of op 95 (memory of that request) and of op 96 (the
op-89 write inside the adoption transaction) — D80(7), D81.

| Check ID | Name | Asserts (one line) | Command / workspace | Runs | Owning row | Cites |
|---|---|---|---|---|---|---|
| M4-CONN-NOCRED-1 | no connection test without an operator-entered credential — by construction | **API:** a `PRODUCTION` candidate tested without the `credential` member answers `422 INVALID_INPUT` (`CREDENTIAL_REQUIRED`) with **0 outbound requests** (stub request log and a socket counter); the test function has one credential input, the request body — it reads no store, no configuration and no other device's entry; a credential stored for device A is never sent to device B; an `AUTHENTICATION_FAILED` outcome is followed by 0 further requests until a new operator call. **UI:** the Test action stays disabled until both fields hold a typed value; the fields open empty and are never pre-filled. The static half (no credential literal, no vendor-default table) is G-R14 in `M4-SR-1`. **Must FAIL when** a handler falls back to any stored or default value (control: such a double makes the stub log one request) | core-server unit on the stub + core-web component test | 1 | 142 (API), 137 (UI) | specs R-9 AC-7; D76(2); C3 §2.6 "Credential required"; `structured` r142, r70 |
| M4-CONN-OUT-1 | five connection-test outcomes on fixtures | each of `REACHABLE`, `AUTHENTICATION_FAILED`, `WRONG_PROFILE`, `NOT_H264`, `UNREACHABLE` is reached once from the stub modes of ST-3 (fixture account, wrong credential, no profile, H.265-only profile, no answer within the deadline on the fake clock); a failed test is a `200` result; one `CAPTURE_CONNECTION_TESTED` row per attempt; the stub request log holds only the pinned read-only call list (any other operation is recorded as a violation) and **0** RTSP connections. **Must FAIL when** two modes yield the same outcome or a write operation reaches the stub | core-server contract test on the stub, fake clock | 1 | 142 | specs R-9 AC-6; D80(11), D82; `cap` §A.6.2, §A.8.1 ST-3, ST-5 |
| M4-CONN-SSRF-1 | not an SSRF or port-scan primitive | a foreign id, an expired id, another session's id and a `testable: false` candidate (a responder announcing a third-party host) are each refused with **0 outbound requests**; a body carrying `host`, `port`, `url` or `address` is `422` (strict schema); no operation accepts a typed address (D80(10)) | core-server unit on the stub | 1 | 142 | specs R-9 AC-10; C3 §2.6 "Not an SSRF…"; D80(10), D80(11); SEC35-32 |
| M4-CONN-ORDER-1 | the flow has one order | op 96 without a fresh `REACHABLE` test answers `409 INVALID_STATE` (`CANDIDATE_NOT_TESTED`), also once `CAPTURE_CONNECTION_TEST_VALIDITY_MS` has passed (fake clock); credential presence must match the tested state (`CREDENTIAL_REQUIRED` / `CREDENTIAL_NOT_EXPECTED`); ops 78 / 79 refuse a candidate id, so an assignment before adoption cannot be expressed; the full sequence search -> test -> adopt -> assign succeeds once for a development candidate without a credential. The same sequence **with** a credential ends at `503` here and is proven after row 84 by `M7-CONN-CRED-1` and `M7-CONN-W-CRED` | core-server unit + db project on the stub | 1 | 142 | specs R-9 AC-5; C3 §2.6 "Adoption…"; D80(7), D81 |
| M4-CONN-WEBONLY-1 | web-only enforcement (`WEB_CONSOLE_SESSION`) | a device-bound operator session is refused on ops **89, 95 and 96** with `403 NOT_PERMITTED` (`WEB_CONSOLE_ONLY`) and one `ACCESS_DENIED` row **before the body is used** (**erratum PE-128-29**, SEC35-45; a malformed body still answers 403, and a canary in that body appears in no log line); a web console session passes the condition; the in-app simulator on tablet and phone refuses the same three. **Must FAIL when** a device token gets any other status on one of the three | core-server acceptance + shared sim unit | 1 | 142 | specs R-9 AC-12; D80(3), D81; C3 §2.6 access notes; SEC35-45 |
| M4-CONN-ATOM-1 | adoption atomicity (MT-13) | as `dems_app`: device row, credential row and audit rows commit together; a failure injected after the device INSERT leaves **0** rows in `capture_devices` and `capture_device_credentials`; two concurrent adoptions of one `endpointRef` leave one row (`409 CANDIDATE_ALREADY_REGISTERED` for the other); each failed or abandoned exit — the four failing outcomes, a refused adoption, sign-out, a Core restart in mid-flow — leaves 0 rows (count before and after) and the candidate still `NEW`. **Before row 84:** adoption with a credential answers `503 NOT_READY` (`CREDENTIAL_STORE_NOT_READY`) and stores nothing; a development source without a credential is adopted (`201`, `credentialSet: false`) | db project + core-server integration on the stub | 2+1 | 142 -> gate 70 | specs R-9 AC-8; `dbc-4` §N.12 MT-13; C3 §2.6 "Before row 84"; D80(7); `structured` r142 |
| M4-SEC-CONN-1 | the password never leaves in clear | the stub request log of a test with the fixture account holds 0 requests carrying the secret canary in clear, as Basic or as base64; the Basic-only stub mode receives no credential at all | core-server unit on the stub | 1 | 142 | SEC35-31; `cap` §J H-21 |
| M4-SEC-CONN-2 | request budget of a failed test | a wrong password yields **at most 2** requests carrying a `UsernameToken` or an `Authorization` header; the pre-authentication requests carry none; a 401 on `GetSystemDateAndTime` is not answered with a credential | core-server unit on the stub | 1 | 142 | SEC35-38; D86 C-2 |
| M4-SEC-CONN-3 | hostile device answers are bounded | an unlimited body, a stalled answer, a one-element service list and a stream address on another host each end within the deadline and the byte cap with a named outcome and no uncaught exception; 0 requests go to a host other than the candidate's | core-server unit on the stub, fake clock | 1 | 142 | SEC35-32, SEC35-33 |
| M4-SEC-CONN-4 | lock-out guard | **2** `AUTHENTICATION_FAILED` outcomes on one host inside the failure window (D86 C-2: 2 per host in 30 minutes; read by name) -> the next test answers `429 RATE_LIMITED` (`CONNECTION_TEST_LOCKOUT_GUARD`) with 0 outbound requests. One case each: counted per Core by host; not reset by a new search, another session or another operator; reset by `REACHABLE` on that host; the re-verification of op 96 counts; `UNREACHABLE` does not count; a Core restart clears it (stated). **Must FAIL when** a third wrong password reaches the stub | core-server unit, fake clock | 1 | 142 | specs R-9 AC-11; SEC35-38; D86 C-2 |
| M4-SEC-CRED-1 | credential secrecy — canary through every channel | after the five outcomes, a refused and an accepted adoption, with the two canaries of CR-2: **0 hits** in every response body, error detail, log line (Core and worker), audit row, alert, realtime frame, candidate state dump, child-process argument list and environment, file under the run directory, and every database table (the credential ciphertext column excepted); the unit cases of the shared redaction cover `username`, `secret` and the nested `credential` object in object and in text form for ops 89, 95, 96 — **the user name is credential material** (D86 C-6); a device-bound session is refused before its body is read. The web half (page, DOM, storage, URL, console and client logs) is asserted in every `M4-CONN-W` run. **Negative control:** a planted log call of the user name makes the sweep fail | core-server integration on the stub + shared redaction unit | 1 | 142 (137: web half) | SEC35-34, SEC35-36, SEC35-45; D86 C-6; C3 §2.6 "Credential in memory"; C-N15 |
| M4-SEC-CRED-2 | rejected character classes | a user name or secret outside the accepted character set answers `422 INVALID_INPUT` with 0 outbound requests (a non-ASCII password is never sent mis-hashed) | core-server unit | 1 | 142 | SEC35-35 |
| M4-SEC-AUD-1 | audit of the guard and of the target | the failure that trips the guard carries `guardTripped: true`; refusals before a request (`422`, `429`, `409 CAPTURE_CONFIG_LOCKED`) write no row; `host` and `endpointRef` appear in `CAPTURE_CONNECTION_TESTED` and `CAPTURE_CANDIDATE_ADOPTED` for `PRODUCTION` candidates only (D86 C-3) and never for a development candidate | core-server unit | 1 | 142 | SEC35-46; D86 C-3; SEC35-19 |
| M4-SEC-ADOPT-1 | re-verification binds the profiles | profiles changed between the test and the adoption -> `409 INVALID_STATE`, 0 rows; no database transaction is open during the network attempt; op 96 never writes `ONVIF_RTSP` for a loopback host | core-server unit on the stub | 1 | 142 | SEC35-47, SEC35-41 (a) |

#### A.4a.4 M4 — no-device notifications and the pre-check rule on the server (row 133)

| Check ID | Name | Asserts (one line) | Command / workspace | Runs | Owning row | Cites |
|---|---|---|---|---|---|---|
| M4-NODEV-A-1 | situation A — a search returned nothing | stub set to 0: one `CAPTURE_DISCOVERY_SEARCHED` row with `responderCount: 0` and **exactly one** `SYSTEM` WARNING alert (`reason: CAPTURE_DISCOVERY_EMPTY`) while three clients are connected; five empty searches -> one alert, five search rows; a search that finds only registered cameras raises nothing; a later search with a responder resolves it; raise, clear, raise -> 2 alerts; no audit row is written by resolving; demo op 74 never clears it. **Must FAIL when** two alerts are active for one (`reason`, `target`) | core-server integration on the stub + db project | 2+1 | 133 -> gate 70 | specs R-10 AC-1, AC-5, AC-6; C3 §5.4; D80(8), D72(h); `structured` r133 |
| M4-NODEV-B-1 | situation B — a configured device unreachable at pre-check | one configured fake camera stopped: exactly one `SYSTEM` WARNING alert naming the device id and one `CAPTURE_DEVICE_UNREACHABLE` row (`phase: PRECHECK`); the one pre-check search ran (`trigger: PRECHECK`) and its count is in the result; one fake microphone removed: one alert, 0 probes; `params` carry ids, counts and codes only (no label text, no address); a later run with the device reachable resolves it; raise, clear, raise -> 2 alerts and 2 `CAPTURE_DEVICE_UNREACHABLE` rows. **Must FAIL when** the alert is raised per client or per refresh (count > 1) | core-server integration on fakes + db project | 2+1 | 133 -> gate 70 | specs R-10 AC-2, AC-5, AC-6; C3 §3.1, §5.4; D80(6); `structured` r133 |
| M4-PRECHK-RULE-1 | pre-check start rule | **blocked:** both cameras unreachable; both microphones unreachable; **the selected active microphone unreachable** (no toggle exists at pre-check — the operator cancels, sets the primary microphone on Devices with op 80 and starts again; D83). **Degraded with an acknowledged warning:** one camera of two, or the standby microphone, unreachable. One case each on the session machine, plus: a start attempted from a blocked result is refused; a pre-check whose search was limited is not failed by that. **Must FAIL when** a session starts with no reachable camera or no reachable active microphone | core-server unit on the session machine, fake clock | 1 | 133 | specs R-10 AC-2; D80(6), D83 (OP-125-1); C3 §3.1 |
| M4-MIC-RESCAN-1 | op 97 — microphone re-read | one call re-reads the local inputs: one entry per **registered** microphone with `present` and the helper's named error (`PERMISSION_DENIED` / `DEVICE_BUSY` / `DEVICE_NOT_FOUND`), other inputs counted only; **0 datagram sockets and 0 probes**; registers nothing; never replaces a local device by a fake; one `CAPTURE_DISCOVERY_SEARCHED` row with `scope: MIC_LOCAL`; `captureDevices` republished; the spacing limit answers 429 | core-server unit with a stub `AudioInputAdapter`, fake clock | 1 | 133 (operation owner to be named by the task-architect) | specs R-10 AC-2, AC-4; D80(5); C3 §2.6 op 97 |

#### A.4a.5 M4 — development sources: fence, plan and helpers (rows 134, 135, 136)

| Check ID | Name | Asserts (one line) | Command / workspace | Runs | Owning row | Cites |
|---|---|---|---|---|---|---|
| M4-SEC-FENCE-1 | the development fence | one test per row of the boot table of `cap` §A.1.2. **Five boot refusals** by code: `DEV_SOURCES_NEED_REAL_CAPTURE`, `DEV_SOURCE_WITHOUT_FLAG`, `DEV_FLAG_WITH_PRODUCTION_SOURCE`, `DEV_HELPER_PROGRAM_UNUSABLE`, `DEV_FLAG_WITH_LAN_LISTENER`. **A stored `LOCAL_DEVICE` row in a production configuration:** assigned in the selector -> boot refused, the message names the device id; registered but unassigned -> ignored, the Core boots; every stored kind is inert in `SIMULATED` (the four databases keep booting after set 4). A candidate reached through a loopback host is never `PRODUCTION`; every boot writes one audit row naming the capture operation; every INSERT into `capture_devices` names `adapter_kind` (static pin). **Must FAIL when** one unsafe combination boots | core-server boot-check unit (CS-22) + static | 1 | 136 (61: the one capture-mode function and the boot audit row) | specs R-11 AC-1, C-N14; `cap` §A.1.2; `dbc-4` §N.9; SEC35-41; D82(e); `structured` r136, r70 |
| M4-LOCAL-SEL-1 | never selectable in a production configuration | in `REAL_PRODUCTION`: ops 76 / 77 list 0 development sources, a search lists 0 development candidates, ops 78 / 79 refuse an assignment that names one (`422 INVALID_INPUT`, `DEVELOPMENT_SOURCE_NOT_ALLOWED`). **Control:** the same calls in `REAL_DEVELOPMENT` list and accept them | core-server contract test | 1 | 136 | specs R-11 AC-2; C3 §2.6 "Device shapes", §3.1 |
| M4-LOCAL-PLAN-1 | the development plan: four sources, no mix | the plan built in `REAL_DEVELOPMENT` names exactly: camera 1 = this Mac's camera (`LOCAL_DEVICE`, a row of its own — the built-ins stay `FAKE`, D83), camera 2 = fake, microphone 1 = this Mac's microphone, microphone 2 = fake; no argument names Desk View or a screen-capture entry. **A mixed session is refused** (one production and one development source in one plan, D82). **A source kind without an opener is refused** before `app.capture.start` with `SOURCE_KIND_NOT_RECORDABLE` — no listener is opened for it (D86 C-5; session-level proof in `M5-SEC-SRC-1`) | core-server unit on the plan builder | 1 | 136 (66: plan builder) | specs R-11 AC-3; D74(2), D82, D83, D86 C-5; SEC35-40 |
| M4-LOCAL-WORKER-1 | the worker is unchanged; helpers push and bind nothing | `git diff --stat` of `apps/capture-worker/src` over rows 134, 135, 136 and 140 = **0 changed lines**; snapshot of each helper process: **0 listening sockets**; the camera helper holds one TCP connection to `127.0.0.1` (it pushes RTSP over TCP into the worker's listen ingest), the microphone helper writes the named pipe (mode 600, under the run directory); no helper owns a datagram socket. **Must FAIL when** a helper shows a `LISTEN` line or a UDP socket | `git diff --stat`; `lsof -nP -a -p <helper pid> -i` with the helpers running on generated inputs | 1 | 134, 135 (136, 140: the diff) | specs R-11 AC-4, C-N4; `cap` §A.6.4, §A.7.1, §G.1; D82(d) |
| M4-LOCAL-ERR-1 | a local device that cannot be opened ends in R-10 | with a stub helper exiting with each named error — permission denied, device busy, device not found: the adapter reports the source unreachable with that cause; at pre-check the situation-B alert names the local device and its cause; at session start the degraded warning (or situation C) follows; **the plan still names the local device and no fake source is put in its slot**; if the two causes cannot be told apart the result is `OPEN_FAILED`, never a guess. The real permission-denied path is observed only if the user chooses to deny, and is otherwise recorded "not exercised" | core-server unit with a stub helper | 1 | 136 (134, 135: helper exit codes) | specs R-11 AC-5; D80(11); `cap` §A.6.4 HL-10, HL-11, §J H-18 |
| M4-SEC-HELPER-1 | helper path, argument, name-match and id rules | the helper program path is refused when it is relative, a symbolic link into a writable directory, group- or other-writable, or not owned by root or the Core's user; a device list with a near-match name or without the name -> `DEVICE_NOT_FOUND`, **0 processes started** (never a screen-capture entry); pipe-path ids are checked against their patterns and the resolved path stays under the run directory; leftover helpers of an earlier run are reported and capture does not start | core-server unit + static argument test | 1 | 136, 134, 135 | SEC35-43; `cap` §G.1 G-R12 |
| M4-SEC-PRIV-1 | privacy of local-device media | at each gate of rows 134, 135 and 140: `git status --porcelain` media count 0; 0 media, image, waveform, spectrogram or transcript files from a local-device session under `docs/`; the row's command log has 0 uses of an image- or audio-reading tool on `.data/` media and 0 permission-database or system-settings tools; test recordings are at most 10 s each, listed with path and size, and the deletion command is handed to the user (no agent deletes them) | shell grep of the tree and of the row's command log | 1 (at the gate of each of rows 134, 135, 140) | 134, 135, 140 | specs R-11 AC-8, AC-9; SEC35-44; D74(3), D86 C-7; OD-25 |
| M4-LOCAL-AV-1 | AV alignment of the local camera path, step 1 — **without the camera** (H-17) | the camera helper's exact option line is run with a **generated** picture and tone (flash + beep) in place of the avfoundation input, through the row-60 harness into the unchanged worker: the measured AV offset is within the 2 ms regression bound of the truth for 0 / +80 / -80 ms and inside the ±40 ms product bound; the worker reports no `no_camera_wall_clock`. **Negative control:** with one of the three wall-clock options removed the same run must FAIL (a constant error of about the start-up delay). A FAIL of the real line switches row 134 to the small native helper | harness e2e (`apps/capture-worker` e2e target of row 60) with the helper on a generated input; sample-exact analyser | 2+1 | 134 -> gate 70 | specs R-11 AC-10; `cap` §A.6.4, §J H-17 step 1; D82(d) |
| M4-LOCAL-CAM-1 | local camera helper with this Mac's camera | with the permission granted by the user, outside the command sandbox: a 10 s capture through the row-60 harness yields a playable file; the observed keyframe interval is within the Q-GOP bound (at most 2 s); numeric results only (duration, frame count, keyframe interval, hash); media only under `.data/` or `.cache/`. Permission missing -> the row stops and hands the user the one-click command; the check is then recorded "blocked: user action", not failed and not replaced by a generated input | harness e2e with the real device (CR-3) | 2+1 | 134 -> gate 70 | specs R-11 AC-4, AC-9; `cap` §J H-15, H-16; `structured` r134 |
| M4-LOCAL-MIC-1 | local microphone helper with this Mac's microphone | with the permission granted: 10 s through the worker gives a decoded sample count = duration x 48,000 (± priming), a level above the silence threshold, and no telemetry gap (`dbfs: null`) or underrun fill; numeric results only. Same hand-over rule as `M4-LOCAL-CAM-1` | harness e2e with the real device (CR-3) | 2+1 | 135 -> gate 70 | specs R-11 AC-4; `cap` §A.7.1, §J H-20; `structured` r135 |

#### A.4a.6 M4 — clients (rows 137, 138)

Web = agent-browser on the web console; tablet / phone = emulator device check (CR-5). Each
client-run also counts in the Core: the number of active alerts and the row counts named in its
cell. Credential entry is **web console only** (D80(3)); tablet and phone get the pointer checks.

| Check ID | Name | Asserts (one line) | Command / workspace | Runs | Owning row | Cites |
|---|---|---|---|---|---|---|
| M4-DISC-W | search for cameras on the web console | with N stub devices: idle -> searching -> list; N rows with "New" / "Already registered"; conflict rows are marked and offer no Connect; the freshness line; "Search again" replaces the list; the progress never moves backwards and draws no countdown. **Must FAIL when** the row count differs from N | agent-browser on lane web | 2+1 | 137 | specs R-9 AC-2; `ux` §8c, §15.2; SEC35-28 |
| M4-DISC-T / M4-DISC-P | search on tablet / phone | the same states and rows on each emulator; no Connect dialog exists there | emulator device check (lane 2 / lane 1) | 2+1 each | 138 | `ux` §8c, §15.2 |
| M4-DISC-EMPTY-W / M4-DISC-EMPTY-T / M4-DISC-EMPTY-P | empty search on the three clients | stub set to 0: the empty state "no camera answered", one banner, one alert-centre item, "Search again"; the empty device list offers "Search for cameras"; five searches still show one alert (one alert in the Core); a later search with a responder leaves **0 stale banners** after the next state update | agent-browser / emulator device check | 2+1 each | 137, 138 (133: alert) | specs R-10 AC-1, AC-4, AC-5; `ux` §8e, §15.2 |
| M4-DISC-RBAC-W / M4-DISC-RBAC-T / M4-DISC-RBAC-P | a role without `CAPTURE_CONFIG` | "Checking your permissions…" first, then the control disabled with the sentence naming the roles; **0** calls of op 94 in the request log | agent-browser / emulator device check + request log | 2+1 each | 137, 138 | specs R-9 AC-12, R-10 AC-4; C-N12; `ux` §11 G13 |
| M4-DISC-OWNER-W | the list belongs to one session | a second operator session in a second browser context sees no list and the alert only | agent-browser, two sessions | 2+1 | 137 | specs R-9 AC-4; C3 §2.6 "ownership" |
| M4-CONN-W | connect flow on the web console with a fake camera | both fields empty on open and after a saved console login; each of the five outcomes once with its message and next action; a development source added without a password and then assigned through the selector; before row 84 an add with a password ends in the "cannot store camera passwords yet" sentence (`503`). After each run **both canaries have 0 occurrences** in the page text, the DOM snapshot, the field values after close, `localStorage`, `sessionStorage`, the URL, the query / mutation cache, the browser console log and the web error sink. **Must FAIL when** a canary is found anywhere or an outcome draws another outcome's message | agent-browser on lane web with fixture credentials on the fake stub | 2+1 | 137 | specs R-9 AC-5, AC-6; `ux` §8d, §15.2; D80(3), D80(7); SEC35-34; `structured` r137 |
| M4-CONN-ABANDON-W | abandoned flow leaves nothing | each exit of `ux` §8d.7 (close, Escape, a failed outcome not retried, sign-out): the described UI state and **0** new rows in `capture_devices` and `capture_device_credentials`; the candidate still reads "New" | agent-browser + row count | 2+1 | 137 | specs R-9 AC-8; `ux` §8d.7 |
| M4-CONN-LOCK-W | connect is locked while a session is open | with a session open: Connect disabled with its sentence, 0 toasts; searching still works outside `RECORDING`; during `RECORDING` the search control shows the refusal of D86 C-4 until the lift of `M4-DISC-REC-1` | agent-browser | 2+1 | 137 | specs R-9 AC-13; D80(4), D86 C-4 |
| M4-CONN-GUARD-W | lock-out guard on the web console | **two** refused passwords: the attempts-left text follows the server's value, then the lock-out sentence and a disabled Test (D86 C-2); no client-side countdown | agent-browser, fake clock on the Core | 2+1 | 137 | specs R-9 AC-11; SEC35-38; D86 C-2 |
| M4-CONN-PTR-T / M4-CONN-PTR-P | tablet / phone point to the web console | Connect is shown disabled with the web-console sentence, never hidden; **0 password fields in the view tree**; 0 calls of ops 95 / 96 / 89 (request log + a static test over `apps/mobile/src`) | emulator device check + mobile jest static test | 2+1 each | 138 | specs R-9 AC-12; D80(3); `ux` §8d.10 |
| M4-NODEV-B-W / M4-NODEV-B-T / M4-NODEV-B-P | situation B on the three clients | pre-check with one fake camera stopped: the warning row names the device (id and label, no address) with the search count; the start is allowed after acknowledging; both stopped: blocked; a later reachable run leaves 0 banners; one alert in the Core across the three clients | agent-browser / emulator device check | 2+1 each | 137, 138 (133) | specs R-10 AC-2, AC-5, AC-6; `ux` §8e |
| M4-NODEV-NOCFG-T | the operator without `CAPTURE_CONFIG` | an operator with `SESSION_START` only: the notification, "Search again" disabled with the role sentence, Retry works, no list, no Connect | emulator device check (tablet) | 2+1 | 138 | specs R-9 AC-12, R-10 AC-4; D80(2) |
| M4-MIC-RESCAN-W / M4-MIC-RESCAN-T / M4-MIC-RESCAN-P | "Search again" on a microphone | one request of op 97, a per-microphone result with its named cause, the description that microphones are not searched on the network; 0 calls of op 93 | agent-browser / emulator device check + request log | 2+1 each | 137, 138 | specs R-10 AC-2, AC-4; D80(5); `ux` §8g |
| M4-MIC-ACTIVE-W / M4-MIC-ACTIVE-T / M4-MIC-ACTIVE-P | active microphone unreachable | blocked with its sentence; **no toggle control exists at pre-check**; after the operator cancels, makes the other microphone primary on Devices and starts again: a warning and a degraded start (D83) | agent-browser / emulator device check | 2+1 each | 137, 138 | specs R-10 AC-2; D83 (OP-125-1); C3 §3.1 |
| M4-DEVSRC-LABEL-W / M4-DEVSRC-LABEL-T / M4-DEVSRC-LABEL-P | the development-source label (flow 12) | in `REAL_DEVELOPMENT`: one badge on Devices rows, selector, search list, pre-check and monitor tiles, with the kind as secondary text ("This Mac's camera" on web, "Core Mac's camera" on tablet and phone; "Test source" for `FAKE`, never "Simulated"); in a production configuration **0 badges, 0 local rows, no group header**; **in Simulated client mode the badge is not shown on devices and demo items — the mode banner says it** (D83); live client on a Core in `SIMULATED`: 0 badges on devices and demo items (ruling R-2 option A, D91; **erratum PE-128-75**) | agent-browser / emulator device check | 2+1 each | 137, 138 | specs R-11 AC-2, AC-6; `ux` §8f; D83 |
| M4-SEC-UI-1 | the credential dialog in the browser | with a saved console login the camera fields stay empty and the console credential is never offered into them; the confirmation tick is required before the first test of a `PRODUCTION` candidate; the reveal control is off by default, shows only the value being typed and is hidden again on blur, submit and close (D86 C-1); the API reference refuses "Try it" for ops 89, 95, 96 — the denied list reads **10** | agent-browser on lane web | 2+1 | 137 | SEC35-31, SEC35-37; D86 C-1; C3 §10.1 |
| M4-DEVSRC-LOCAL | local-device row states | from a stub helper: ready, permission needed, busy, not found; the row keeps its name and badge and no test source appears in its place; 0 frames written to `docs/` | core-web vitest + mobile jest, `--maxWorkers=2` | 1 | 137, 138 | specs R-11 AC-5; `ux` §8f.3 |
| M4-UX-UNIT | component rules of flows 9-13 | fields cleared on close and unmounted; no request variables in the query or mutation cache; a device name containing markup is drawn literally on one line; progress is forward-only under a fake clock; the list order equals the answer order; no countdown and no automatic retry | core-web vitest + mobile jest, fake clocks (P-08) | 1 | 137, 138 | specs R-10 AC-4; `ux` §15.2; SEC35-48 |
| M4-UX-VOC-1 | vocabulary and i18n keys | the keys of `ux` §14.2 exist once in the shared i18n tree with the texts of §14.1; `common.rbac.checking` is the shared key used by the web console too; the two local-device names are overridden in the mobile file; the four new audit types have labels in `common.auditType.*` and its mirror; no key is missing or unused (the existing i18n parity test); no user-facing text calls a `FAKE` source "Simulated" | shared + core-web + mobile unit | 1 | 137, 138 (132, 142: audit labels) | `ux` §14.1, §14.2; D83 |
| M4-UX-A11Y-1 | accessibility of flows 9-13 | per `ux` §14.3, by role and state queries: live regions for search progress and notifications (`status` / `alert`); a disabled control's reason is visible text tied to the control; the Connect dialog traps focus, focuses the user-name field first and returns focus on close; the password field exposes no value in any attribute, title or label; the badge has a text name; mobile touch targets of the actions are at least 44 pt | core-web vitest + mobile jest component tests | 1 | 137, 138 | `ux` §14.3 |

#### A.4a.7 M5 — session start and the local-device session (rows 139, 140, 71)

| Check ID | Name | Asserts (one line) | Command / workspace | Runs | Owning row | Cites |
|---|---|---|---|---|---|---|
| M5-NODEV-C-1 | situation C — no camera at session start | on fakes with 0 cameras pushing: after the ingest-open window (a named setting, shortened in the test) the session is `FAULTED` with `durable: false` = **a failed start: 0 evidence items, 0 evidence files**; exactly one CRITICAL `CAPTURE_FAULT` alert (`reason: NO_CAMERA_CONNECTED`, `evidenceFiles: 0`) and exactly one audit row; **the session never presented "recording"** — until the first durable fragment its state reads "connecting cameras" (0 published states with a recording indicator or a running timer). With 1 camera of two: the session records, with exactly one WARNING naming the missing camera's device id and one `CAPTURE_DEVICE_UNREACHABLE` row (`phase: SESSION_START`). Cleared only by the capture side in a later session, never by demo op 74; a second occurrence is a new alert with its own row. **Must FAIL when** an evidence item exists after the 0-camera start | core-server + capture-worker integration on fakes + db project | 2+1 | 139 (with 71) -> gate 75 | specs R-10 AC-3, AC-5, AC-6; D72(h)(i)(k), D84; `cap` §A.6.5; C3 §5.4; `structured` r139, r75 |
| M5-NODEV-C-W / M5-NODEV-C-T / M5-NODEV-C-P | situation C on the three clients | no camera at start: the fault presentation "Nothing was recorded.", **0 timer, 0 recording indicator, 0 generated meters**, "Search again" under the role and lock rules; one camera: the warning banner and a NO SIGNAL tile; the tablet hand-off never offers a recovery of evidence that does not exist | agent-browser / emulator device check | 2+1 each | 139 (137, 138: surfaces) | specs R-10 AC-3, AC-4; `ux` §8e; D84 |
| M5-SRC-REC-1 | `session_capture_sources` written with `RECORDING`, INSERT-only | the transaction that takes the session into capture (before `app.capture.start`) inserts exactly **four** rows — one per slot, each with the adapter kind of the assigned device at that moment; a later change of the configuration or of the development flag changes none of them; a restarted Core reads the same rows; as `dems_app` UPDATE and DELETE fail `42501` (the privilege half is `M4-MT-11`); a simulated session writes rows per `dbc-4` MR-S3. **Must FAIL when** a session reaches capture with fewer or more than four rows | db project on the session machine | 1 | 71 (with 66) | `dbc-4` §N.3 MR-S1..MR-S3; `ev` §E.6; D83, D84; specs R-11 AC-7 |
| M5-LOCAL-E2E-1 | local-device session end to end | in `REAL_DEVELOPMENT` with this Mac's camera and microphone and the two fake sources (helpers push RTSP over TCP and the microphone pipe): start, one microphone switch (local -> fake), stop through the session machine -> **two playable camera files with the one audio track**; the fake camera's file measures inside the ±40 ms product bound with the flash + beep analyser; the local camera's file is checked numerically only (duration, sample count, keyframe interval, hashes) — its AV bound rests on `M4-LOCAL-AV-1` and `M5-LOCAL-CLAP-1`; the four source rows carry the classes of D74(2); recordings only under `.data/`; 0 media in git. Permission missing -> the row stops and hands over to the user. The result closes no class-C item | session e2e on a development lane, outside the command sandbox (CR-3) | 2+1 | 140 -> gate 75 | specs R-11 AC-3, AC-8, AC-10; D74(2), D82; `structured` r140, r75 |
| M5-LOCAL-CLAP-1 | AV alignment of the local camera, step 2 — the clap (H-17) | **manual-with-user, one execution; 2+1 not applicable.** With the user present, in one development session the user claps once in view of this Mac's camera. A local script computes two numbers from the sealed-or-closed file — the time of the audio transient and the time of the largest inter-frame change around it — and prints **only** the offset in ms and PASS / FAIL against ±40 ms. If the picture event is ambiguous the user steps the player on the web console and states the offset in frames. **How it is recorded:** one table row in the gate report — date, session id, file sha256, offset in ms (or frames), bound, verdict, "user present: yes", the recording's path and size under `.data/`. **No frame, still, waveform, audio excerpt or transcript is stored in `docs/`, and no agent opens the media with a viewing tool.** A FAIL switches the helper to the native fallback and the check is run once more with the user. The gate reads the record; it does not repeat the clap | manual-with-user; local numeric script (CR-3) | 1 (manual-with-user; 2+1 not applicable) | 140 (user present) -> record read at gate 75 | specs R-11 AC-10; `cap` §J H-17 step 2, H-20; D86 C-7; SEC35-44 |
| M5-SEC-SRC-1 | no listener for a source kind without an opener | in `REAL_PRODUCTION` with a registered `ONVIF_RTSP` device row placed by the test set-up and assigned (**erratum PE-128-90**): session start is refused with the typed code (`SOURCE_KIND_NOT_RECORDABLE`); the socket snapshot shows **0 listeners in 8554-8564**; a local push finds the port closed; 0 evidence files; session start also refuses when the class of the four source rows is not the class of the running operation. **Negative control:** in `REAL_DEVELOPMENT` the same push is accepted (the listener exists there) | core-server integration + socket snapshot + a push attempt | 2+1 | 140 (with 66, 71) -> gate 75 | SEC35-40; D86 C-5; D82 |
| M5-SEC-PRIV-2-W / M5-SEC-PRIV-2-T / M5-SEC-PRIV-2-P | the "is on" indicator | whenever a `LOCAL_DEVICE` camera or microphone is open — pre-check included — each client shows the fixed, non-dismissable "This Mac's microphone is on" / "…camera is on" state from Core data (stub helper), and it is gone after close | agent-browser / emulator device check | 2+1 each | 137, 138 (run with row 140) | SEC35-44 (4); record of row 126 §6 (`M5-SEC-PRIV-2`, split per client) |

#### A.4a.8 M7 — the development-source mark and the credentialed adoption (rows 141, 84)

| Check ID | Name | Asserts (one line) | Command / workspace | Runs | Owning row | Cites |
|---|---|---|---|---|---|---|
| M7-DEVSRC-SEAL-1 | a development package seals and verifies PASS with the mark | a package sealed from a development-mode session: manifest fields 124-128 present (128 fields), `tracks[].sourceClass` and `audio.sourceIntervals[].sourceClass` per D74(2), `developmentSources = true`; a microphone switch from local to fake gives two intervals with two classes; fields 127-128 equal the `FIRST_VIDEO_SAMPLE` record; verify runs **15** checks, V-15 passes, top-level `ok` is true and **the report's first line is "DEVELOPMENT SOURCES — this package was not recorded from production devices."**; `sources.development = true` in the result of op 41. **Must FAIL when** the line is missing, not first, or the verdict changes with the mark | core-server db/unit integration (fakes; one run on a local-device package when the permission exists) | 2+1 | 141 -> gate 89 | specs R-11 AC-7, AC-10; `ev` §B.12, §D V-15, §D.1; D78(2), D81; `structured` r141, r89 |
| M7-DEVSRC-TAMPER-1 | an edited mark fails | one `sourceClass` edited in the sealed manifest -> **V-03 fails**; edited with `manifestSha256` and the digest recomputed -> **V-09 fails**; field 126 deleted -> V-15 `MISSING`; a re-signed fixture whose flag contradicts the classes -> V-15 `CORRUPT`; in each case the source line reads "Sources: not trustworthy — the manifest was altered" and nothing presents the edited class as fact. **Control:** the untouched package of `M7-DEVSRC-SEAL-1` passes the same run | core-server db/unit integration | 2+1 | 141 -> gate 89 | specs R-11 AC-7; `ev` §C.1, §D V-15, §D.1 |
| M7-DEVSRC-BUILD-1 | the mark is written by the Core, fails closed | `BUILD_MANIFEST` reads the classes from `session_capture_sources` only; an adapter kind without a class, or fewer or more than four source rows, fails the step and nothing is signed; a seal resumed after a restart with the development flag changed writes the same manifest bytes; a development-mode session can never seal with `developmentSources = false`; the kind -> class mapping is exhaustive at compile time; the item INSERT writes `development_sources` (= field 126) and it is never updated; no operation accepts a source class | core-server unit + db project | 1 | 141 (with 83) | `ev` §B.12 rules 1-7, §E.6; `dbc-4` §N.3 MR-S4 / MR-S5, §N.4 |
| M7-SEC-SRC-2 | no all-`PRODUCTION` package in this phase | every package sealed on this Mac in this phase — the regenerated demo packages included (class `FAKE`, D81) — has `developmentSources = true`; a query over `evidence_items` v2 rows finds 0 with `development_sources` false or NULL | core-server db check over the lanes and `dems_demo` | 2+1 | 141 -> gate 89 | SEC35-40; `ev` §H.5; D86 C-5 |
| M7-DEVSRC-EVID-W / M7-DEVSRC-EVID-T / M7-DEVSRC-EVID-P | the mark on evidence in the three clients | a sealed development package: the badge on the item (from `development_sources` / the manifest, never from client state), the verify line first with a PASS verdict; an edited mark reads "not trustworthy"; a v1 item reads "not recorded"; in Simulated client mode the badge is not drawn on demo items while the verify result still reports the mark (D83) | agent-browser / emulator device check | 2+1 each | 141 with 137, 138 | specs R-11 AC-6, AC-7; `ux` §8f.2; D83 |
| M7-CONN-CRED-1 | credentialed adoption after row 84 (server) | with the credential sealer provided: op 96 with a credential answers `201` with `credentialSet: true`; one `CAPTURE_CREDENTIAL_SET` row (`deviceId` only, `operationId: adoptCaptureCandidate`); **a one-character secret** is stored (the sealer frames the plaintext so that the 33-byte ciphertext CHECK holds — F-122-2); `SELECT` on the credential table still fails `42501` for `dems_app`; op 89 answers 200 for a registered camera; both canaries 0 hits (the sweep of `M4-SEC-CRED-1` run again) | db project + core-server integration on the stub | 1 | 84 (its Verification turns the 503 of `M4-CONN-ATOM-1` into 201) | specs R-9 AC-5; `dbc-4` §N.7 F-122-2; D80(7), D68(c) |
| M7-CONN-W-CRED | credentialed adoption on the web console | after row 84: add with a password succeeds, "Password stored." is shown, the camera is assignable in the selector, and both canaries have 0 occurrences in the channels of `M4-CONN-W` | agent-browser on lane web | 2+1 | 137 (re-run at M7) -> gate 89 | specs R-9 AC-5; `ux` §15.2 |

#### A.4a.9 Traceability — 32 acceptance criteria -> named checks **Erratum PE-127-03**

Primary check first. Method words: unit / db / static guard / agent-browser on the web console /
emulator device check / harness e2e / real-LAN probe / manual-with-user. "Fails when" is the
negative control: what the check reports as FAIL. Sources beyond the criterion itself are in the
check's "Cites" cell.

| AC | Criterion (short) | Named checks | Method | Depth | Owning row | Fails when (negative control) | Sources |
|---|---|---|---|---|---|---|---|
| R-9 AC-1 | search trigger: two cases only | M4-DISC-TRIG-1; M4-SR-1 (G-R13) | unit; static guard | 1 | 132, 131 | a probe is counted at boot, on a timer or on a read; a third call site of `discover()` exists | D74(1); C3 §2.6 |
| R-9 AC-2 | candidate list from unauthenticated probe data | M4-DISC-STUB-1; M4-DISC-W; M4-DISC-T / M4-DISC-P; M4-SEC-DISC-2 | harness e2e + db; agent-browser; emulator; unit | 2+1 (unit 1) | 131, 132, 137, 138 | candidates != N stub devices; an announced field is missing; a registered identity reads "New"; the stub's device service logs a request | D76(1), D80(1), D83 |
| R-9 AC-3 | a search connects, registers, authenticates nothing | M4-DISC-STUB-1; M4-DISC-LAN-1 | harness e2e + db; real-LAN probe | 2+1 | 131, 132 | a row count or checksum differs after the search; any authenticated, configuration or RTSP request is logged | D76(1), D75 |
| R-9 AC-4 | candidates are not capture devices | M4-DISC-LIFE-1; M4-DISC-OWNER-W | unit; agent-browser | 1; 2+1 | 132, 137 | a candidate survives expiry, sign-out or restart; appears in op 77; is readable by another session | D76(1) |
| R-9 AC-5 | connect flow, one order | M4-CONN-ORDER-1; M4-CONN-W; M7-CONN-CRED-1; M7-CONN-W-CRED; M4-CONN-PTR-T / M4-CONN-PTR-P | unit + db; agent-browser; emulator | 1; 2+1 | 142, 137, 84, 138 | an adoption without a fresh `REACHABLE` test succeeds; an assignment names a candidate; a password field exists on tablet or phone | D76(2)-(3), D80(3), D80(7), D81 |
| R-9 AC-6 | five enumerated outcomes, read-only | M4-CONN-OUT-1; M4-CONN-W | unit (contract on fixtures); agent-browser | 1; 2+1 | 142, 137 | two stub modes give one outcome; a write operation or an RTSP connection reaches the stub | D80(11), D82 |
| R-9 AC-7 | no default, reused or guessed credential | M4-CONN-NOCRED-1; M4-SR-1 (G-R14); M4-SEC-CONN-2 | unit; static guard | 1 | 142, 137, 136 | a request leaves without a credential in the body of that call; a credential literal or vendor table exists; a failed outcome is followed by a request | D76(2), D81 |
| R-9 AC-8 | failed or abandoned flow leaves nothing | M4-CONN-ATOM-1; M4-CONN-ABANDON-W | db; agent-browser | 2+1 | 142, 137 | 1 row remains in `capture_devices` or `capture_device_credentials` after any failed exit | D76(2)-(3), D80(7) |
| R-9 AC-9 | every step audited, without values | M4-AUD-1; M4-SEC-AUD-1; M4-SEC-CRED-1 | unit | 1 | 132, 133, 142 | a detail carries an extra key, the user name, the secret or a URL; a step writes no row | D76(3), D86 C-3, C-6 |
| R-9 AC-10 | not an SSRF or port-scan primitive | M4-CONN-SSRF-1; M4-SEC-CONN-3 | unit | 1 | 142 | any refused target produces an outbound request; a body with an address member is accepted | D80(10), D80(11) |
| R-9 AC-11 | rate limits and the lock-out bound | M4-SEC-RATE-1; M4-SEC-CONN-4; M4-SEC-CONN-2; M4-CONN-GUARD-W | unit; agent-browser | 1; 2+1 | 132, 142, 137 | a call over a bound sends a datagram or a request; a third wrong password reaches the stub | D86 C-2, C-8 |
| R-9 AC-12 | roles; credential entry on the web console only | M4-DISC-RBAC-1; M4-CONN-WEBONLY-1; M4-DISC-RBAC-W / M4-DISC-RBAC-T / M4-DISC-RBAC-P; M4-CONN-PTR-T / M4-CONN-PTR-P; M4-NODEV-NOCFG-T; M4-PC-1 | unit; agent-browser; emulator | 1; 2+1 | 132, 142, 137, 138 | another role is accepted; a device-bound session gets any status but 403 on ops 89 / 95 / 96; a control is hidden instead of disabled | D80(2), D80(3) |
| R-9 AC-13 | config lock; searching during a session | M4-LOCK-1; M4-DISC-REC-1; M4-CONN-LOCK-W | unit; harness e2e; agent-browser | 1; 2+1 | 66, 132, 142, 137 | a connect step succeeds or writes an audit row while a session is open; a search during `RECORDING` is accepted before the lift, or disturbs the fragments after it | D80(4), D86 C-4 |
| R-9 AC-14 | the automated suite never touches the real network | M4-DISC-NOLAN-1 | static guard + unit | 1 | 131 | a test process shows a non-loopback peer; a test keeps the multicast target | D74(1) |
| R-9 AC-15 | real-LAN verification | M4-DISC-LAN-1; M4-DISC-SOCK-1 | real-LAN probe; unit (socket snapshot) | 2+1; 1 | 131 -> 70 | N = 0 ends without the notification; "not run" is reported as empty; the socket count is not 0 / 1 / 0; a TCP connection leaves loopback | D75, D78(1) |
| R-9 AC-16 | agent rule on the real network | M4-DISC-LAN-1; M4-SEC-DISC-4; X-SEC-1; M4-SEC-PRIV-1 | real-LAN probe; unit; shell grep | 2+1; 1 | 131, gates | an address, MAC or serial pattern is in tool output or a committed file; a credential pattern is in an evidence file | D75, D76(4), D86 C-7 |
| R-10 AC-1 | situation A: empty search | M4-NODEV-A-1; M4-DISC-EMPTY-W / M4-DISC-EMPTY-T / M4-DISC-EMPTY-P | db; agent-browser; emulator | 2+1 | 133, 137, 138 | alerts != 1 after one or five empty searches; an alert after a registered-only result; no "Search again" | D80(8) |
| R-10 AC-2 | situation B: unreachable at pre-check; start rule | M4-NODEV-B-1; M4-PRECHK-RULE-1; M4-MIC-RESCAN-1; M4-NODEV-B-W / M4-NODEV-B-T / M4-NODEV-B-P; M4-MIC-ACTIVE-W / M4-MIC-ACTIVE-T / M4-MIC-ACTIVE-P; M4-MIC-RESCAN-W / M4-MIC-RESCAN-T / M4-MIC-RESCAN-P | db; unit; agent-browser; emulator | 2+1; 1 | 133, 137, 138 | alerts per device != 1; a start with both cameras or the active microphone unreachable is accepted; a microphone re-read sends a probe | D80(5), D80(6), D83 |
| R-10 AC-3 | situation C: no camera at session start | M5-NODEV-C-1; M5-NODEV-C-W / M5-NODEV-C-T / M5-NODEV-C-P | harness e2e + db; agent-browser; emulator | 2+1 | 139, 71 | an evidence item or file exists; alerts != 1; a timer, recording indicator or generated meter is drawn | D72(k), D72(i), D84 |
| R-10 AC-4 | "Search again" under the same rules | M4-DISC-EMPTY-W / -T / -P; M4-NODEV-B-W / -T / -P; M5-NODEV-C-W / -T / -P; M4-NODEV-NOCFG-T; M4-UX-UNIT | agent-browser; emulator; unit | 2+1; 1 | 137, 138, 139 | the action is missing on a notification; enabled without `CAPTURE_CONFIG`; a countdown or automatic retry is drawn | D74(1) |
| R-10 AC-5 | a later success clears | M4-NODEV-A-1; M4-NODEV-B-1; M5-NODEV-C-1 (raise, clear, raise) and the client runs of AC-1..AC-3 | db; agent-browser; emulator | 2+1 | 133, 139, 137, 138 | a stale banner remains after the next state update; demo op 74 clears a capture alert; the second occurrence reuses the first alert | D72(h) |
| R-10 AC-6 | raised once, shown everywhere, no values | M4-NODEV-A-1; M4-NODEV-B-1; M4-AUD-1 | db; unit | 2+1; 1 | 133, 132 | more than one alert in the Core with three clients connected; `params` or text carry a label, address, user name or URL | D76(3) |
| R-11 AC-1 | development fence at boot | M4-SEC-FENCE-1; M4-SR-1 (G-R15) | unit; static guard | 1 | 136, 61 | one of the five unsafe combinations boots; the flag is read in a second place | D72(l), D82(e) |
| R-11 AC-2 | never selectable in a production configuration | M4-LOCAL-SEL-1; M4-DEVSRC-LABEL-W / M4-DEVSRC-LABEL-T / M4-DEVSRC-LABEL-P | unit (contract); agent-browser; emulator | 1; 2+1 | 136, 137, 138 | a development source is listed, offered or accepted in `REAL_PRODUCTION` | D73 |
| R-11 AC-3 | which source fills which slot | M4-LOCAL-PLAN-1; M5-LOCAL-E2E-1 | unit; harness e2e | 1; 2+1 | 136, 66, 140 | the plan names another source set, Desk View, or a mixed session | D74(2), D82 |
| R-11 AC-4 | the worker is not changed | M4-LOCAL-WORKER-1; M3-RTSP-BIND-1 | shell (`git diff`) + socket snapshot | 1 | 134, 135 | one changed line under `apps/capture-worker/src`; a helper listens or owns a UDP socket | D73 |
| R-11 AC-5 | a local device that cannot be opened ends in R-10 | M4-LOCAL-ERR-1; M4-DEVSRC-LOCAL; M4-SR-1 (G-R14) | unit; static guard | 1 | 136, 137, 138 | a fake source appears in the local device's slot; an unnamed error; no notification | D80(11) |
| R-11 AC-6 | visible label | M4-DEVSRC-LABEL-W / -T / -P; M7-DEVSRC-EVID-W / -T / -P; M5-SEC-PRIV-2-W / -T / -P | agent-browser; emulator | 2+1 | 137, 138, 141 | a development surface without the badge in `REAL_DEVELOPMENT`; a badge in a production configuration | D83 |
| R-11 AC-7 | mark in the manifest; verifies PASS; edited mark fails | M7-DEVSRC-SEAL-1; M7-DEVSRC-TAMPER-1; M7-DEVSRC-BUILD-1; M7-SEC-SRC-2; M5-SRC-REC-1 | db; unit | 2+1; 1 | 141, 83, 71 | the package fails or passes without the line first; an edited mark verifies PASS | D78(2), D81 |
| R-11 AC-8 | recordings stay out of git and out of `docs/` | M4-SEC-PRIV-1; X-MEDIA-1; M5-LOCAL-E2E-1 | shell grep | 1 | 134, 135, 140 | one media, still, waveform or transcript file from a local-device session is tracked or under `docs/` | D74(3), OD-25 |
| R-11 AC-9 | the macOS permission prompt is the user's | M4-SEC-PRIV-1; M4-LOCAL-CAM-1; M4-LOCAL-MIC-1 (hand-over rule) | shell grep of the command log | 1 | 134, 135, 140 | a permission-database or system-settings tool appears in a command log | D74(3) |
| R-11 AC-10 | every function runs end to end in development mode | M5-LOCAL-E2E-1; M4-LOCAL-AV-1; M5-LOCAL-CLAP-1; M7-DEVSRC-SEAL-1 | harness e2e; manual-with-user; db | 2+1; clap 1 | 140, 134, 141 | a file is not playable, has more than one audio track, or the AV offset is outside ±40 ms | D73, D82(d) |

Coverage: R-9 **16/16**, R-10 **6/6**, R-11 **10/10** = **32/32**; every row names at least one
check of this section. C-N13 = `M4-DISC-SOCK-1`, `M4-DISC-LAN-1`, `M4-SEC-NET-1`; C-N14 =
`M4-SEC-FENCE-1`, `M4-LOCAL-SEL-1`, `M4-SEC-PRIV-1`; C-N15 = `M4-CONN-NOCRED-1`, `M4-SEC-CRED-1`,
`M4-SR-1`.

Twenty-four checks of this section trace to a contract or a finding and to no acceptance criterion:
the migration set and the pins (`M4-MT-9`..`M4-MT-12`, `M4-MT-14`..`M4-MT-16`, `M4-DB-APPLY-1`,
`M4-PIN-1`, `M4-PIN-2`; `dbc-4` §N.12, C3 §10.1), eleven security findings (`M4-SEC-NET-1`,
`M4-SEC-DISC-1`, `M4-SEC-DISC-3`, `M4-SEC-CONN-1`, `M4-SEC-CRED-2`, `M4-SEC-ADOPT-1`, `M4-SEC-TXT-1`,
`M4-SEC-DEP-1`, `M4-SEC-HELPER-1`, `M4-SEC-RESET-1`, `M5-SEC-SRC-1`), the browser check
`M4-SEC-UI-1`, and the vocabulary and accessibility checks (`M4-UX-VOC-1`, `M4-UX-A11Y-1`; `ux` §14).

#### A.4a.10 Existing checks whose text changes **Erratum PE-127-04**

Each change is applied in the check's own row or section with its mark; this table is the index.

| Check / place | Before | After | Mark | Source |
|---|---|---|---|---|
| `M2-LANE-1` | four databases at schema 2 / `dbc-3` | still the M2 statement; after row 130 the four databases are at schema 3 / `dbc-4` (`M4-DB-APPLY-1`) | PE-127-05 | D83 |
| `M2-MT-6` | a `REAL` sealed row blocks `db:reset` | plus: an item with `development_sources IS TRUE` whose four source rows are all development is exempt; NULL and false block (`M4-SEC-RESET-1`) | PE-127-05 | D83 (O-5), D86 |
| `M2-API-1`, `M2-API-2`, `M2-PIN-1`, `M2-AUD-1` | 89 ops / 34 GET / 55 POST; offline 23; 62 audit types; `dbc-3` | M2 values kept as history; as built 92 / 35 / 57, offline 26, 63 types; target after R-9..R-11 **97 / 36 / 61, offline 31, 67 types**, schema 3 / `dbc-4` — re-pinned by `M4-PIN-1` and `M4-PIN-2` | PE-127-05 | C3 §10.1; `dbc-4` §N.11 |
| `M3-SR-1` | G-R1, G-R2, G-R4, G-R5, G-R7, G-R8; P25 pin 1-6, 11-14 | unchanged at M3; from M4 the same file also holds G-R9..G-R15 and the extended G-R4 / G-R6 (`M4-SR-1`); P25 pin gains the waived edits 15-18 | PE-127-06 | `cap` §G.1, §I |
| `M3-RTSP-BIND-1` | every socket of the worker process is on `127.0.0.1` | unchanged for the worker; added: the worker still owns no datagram socket while a search runs (the discovery socket belongs to the Core — `M4-DISC-SOCK-1`), and the development helpers bind nothing (`M4-LOCAL-WORKER-1`) | PE-127-06 | C-N13; `cap` §G.1 |
| `M4-SEL-W`, `M4-SEL-T`, `M4-SEL-P` | edit among the seeded devices | any registered device of the right kind incl. an adopted `CAM-NN`; `captureConfig` lines carry `sourceClass`; a candidate id is refused; the run states the lane's capture operation | PE-127-07 | C3 §3.1 |
| `M4-LOCK-1` | edit during an open session -> `409 CAPTURE_CONFIG_LOCKED` | plus ops 89, 95, 96 locked the same way (no audit row); ops 93, 94, 97 are not locked; the `RECORDING` gate of op 93 is `M4-DISC-REC-1` | PE-127-07 | D80(4), D86 C-4 |
| `M4-FAKE-1` | fakes under `apps/capture-worker/src/adapters/`; real adapters class C, not executed | adapters live in the Core process (`apps/core-server/src/capture/adapters/`); the discovery half and the connection-test half of the camera adapter are scheduled (H-7a) and checked in §A.4a; configuration actions and the pull path stay class C | PE-127-07 | `cap` §A.1.1 (PE-123-02), §J H-7a / H-7b |
| `M4-PC-1` | gated controls G1-G3 / G9 | plus the controls of flows 9-13 (G13-G17; G18 is not built, D83) | PE-127-07 | `ux` §11; D83 |
| M4 gate list (A.4 intro; row 70) | 14 checks | 14 + the 91 M4 checks of §A.4a | PE-127-07 | `structured` r70 |
| M5 gate list (A.5 intro; row 75) | 13 checks | 13 + the 11 M5 checks of §A.4a | PE-127-08 | `structured` r75 |
| `M7-REF-1` | reference hashes of a clean fake session | the reference is recorded on a manifest that carries fields 124-128 (class `FAKE`, `developmentSources = true`) — row 83 builds them from its first build | PE-127-09 | D81 |
| `M7-VV-SRV` | op 41 executes the 14 checks V-01..V-14 | 14 as built by row 85; **15 (V-01..V-15) from row 141 on** — the gate +1 runs 15 | PE-127-09 | `ev` §D |
| M7 gate list (A.7 intro; row 89) | 52 scheduled + 10 conditional | 61 scheduled (52 + 9 of §A.4a) + 10 conditional | PE-127-09 | `structured` r89 |
| A.9 class-C register | "C-2/C-1/C-3/C-4 real adapters and ONVIF/PoE" | unauthenticated discovery and the connection test on fixtures left class C-1; every action on a real camera, the pull path (C-2) and the rest stay class C; R-11 results close no class-C item | PE-127-18 | D82; specs R-11 AC-10 |
| section C | pin families at the M2 values | one row for the R-9..R-11 pins | PE-127-10 | C3 §10.1; `dbc-4` §N.12 |
| section D.1, D.2 | G-R1..G-R8; guard counts | rules G-R9..G-R15 in the existing capture guard file (no new guard file, counts unchanged); the server-wide network guard gains two pinned exemptions | PE-127-11 | `cap` §G.1; SEC35-27 |
| section F.1 (P1) | a kill before the first durable fragment seals "the durable part" | ruled (D89(b), D84): P1 is a failed start with no evidence item; matrix IDs and counts unchanged | PE-127-12; PE-128-88 | D84; D89(b) |
| section G | exclusions | four rows added (real camera credentials, local-device media, permission database, real-LAN output) | PE-127-13 | D76(4), D86 C-7, D74(3) |
| `X-SEC-1`, `X-PIN-1`, `X-MEDIA-1` | credential / signed-URL / key shapes; stale `75 / 28 / dbc-2 …` | `X-SEC-1` also sweeps device-identifying patterns (IPv4 outside loopback, MAC, serial) and the canary prefixes from row 131 on; `X-PIN-1` also `92 / 35 / 57 / 63`, `dbc-3`, schema 2 from rows 129 / 132 on; `X-MEDIA-1` also "no local-device still, waveform or transcript under `docs/`" | PE-127-14 | SEC35-30, SEC35-44; record of row 126 §6 |
| **Unaffected (checked):** `M6-STTCFG-API` and the other R-8 checks | — | no change: their `503 CREDENTIAL_STORE_NOT_READY` rule is the same rule `M4-CONN-ATOM-1` uses until row 84 | — | D68(c) |

#### A.4a.11 Values these checks assume where two input specs disagree — for the spec gate row 128 **Erratum PE-127-04**

**Resolved at the spec gate (row 128; erratum PE-128-89):** G-1..G-34 are closed by `gateway_check/27_r9_r11_spec_gate.md` §7.4; the values the checks assume stand, with intermediate pins per row (132: 94 / 36 / 58; 133: 95 / 36 / 59; 142: 97 / 36 / 61).

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
| G-23 | Reset guard and development packages | `dbc-3` §E.2, `M2-MT-6`: every `REAL` sealed row blocks | D83 (O-5), SEC35-42: `development_sources IS TRUE` with the cross-check is exempt — **U-2 confirmed by the user (D87(3))** (**erratum PE-128-89**) | the exemption | if the user declines U-2, `M4-SEC-RESET-1` asserts "development packages block too" |
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
| G-34 | Kill before the first durable fragment (not R-9..R-11; found while reading D84) | this file §F.1 P1 and `M7-KM-P1-*` (7 active + 2 conditional cells): the durable part is sealed, interrupted | D84: `FAULTED` with nothing durable is a failed start with no evidence item | **ruled D89(b)** — matrix and counts unchanged; note in §F.1 (**erratum PE-128-89**) | up to 7 active cells change or drop |

#### A.4a.12 Count of this section

| Table | Once (`1`) | `2+1` | Checks |
|---|---|---|---|
| A.4a.1 database (M4) | 7 | 3 | 10 |
| A.4a.2 discovery and search (M4) | 15 | 4 | 19 |
| A.4a.3 connect flow, server (M4) | 13 | 1 | 14 |
| A.4a.4 notifications and pre-check (M4) | 2 | 2 | 4 |
| A.4a.5 development sources (M4) | 7 | 3 | 10 |
| A.4a.6 clients (M4) | 4 | 30 | 34 |
| **M4 subtotal** | **48** | **43** | **91** |
| A.4a.7 (M5) | 2 | 9 | 11 |
| A.4a.8 (M7) | 2 | 7 | 9 |
| **Section total** | **52** | **59** | **111** |

Of the 111: 38 are the check IDs of `ux` §15.2 (20 families), 26 are the 24 checks of the security
delta (`M5-SEC-PRIV-2` split per client into three), 7 are MT-9..MT-12 and MT-14..MT-16 of
`dbc-4` §N.12 (MT-13 is `M4-CONN-ATOM-1`), and 40 are named by this row: 38 + 26 + 7 + 40 = 111.

### A.5 M5 — manual mic failover end to end

Artifact of record for every M5 check: `gateway_check/10_m5_gate.md` + assets (switch-run captures
obey section G capture rules), fed by the producing W-rows.

**Erratum PE-127-08 (row 127, 2026-10-09; AP3 = D78).** The M5 gate set (row 75) is the 13 checks
of this table **plus the 11 M5 checks of §A.4a.7** = 24: the session-start no-camera check, the
local-device session, the manual clap check (read from its record), the source-row record and the
two security checks.

| Check ID | Name | Asserts (one line) | Command / workspace | Runs | Owning row | Cites |
|---|---|---|---|---|---|---|
| M5-RG-* / M5-QA-1 | suites + typecheck/lint | 7 runs exit 0 at floors | section B.4 | 1 each | rev-2 M5 | — |
| M5-SW-W | mic switch from web during recording | one switch: 1 AAC stream, monotonic PTS, 0 inserted/dropped samples (sample count + per-input continuity, AU2-05), boundary within one input quantum + IPC latency (AU2-07) via file analyser, interval rows written with media-ms, `AUDIO_SOURCE_SWITCHED` carries **sending device ID**, "Checking your permissions..." shown, no auto-switch observed | agent-browser on lane web + analyzer | 2+1 | 31 §E + ux §3 -> rev-2 | specs R-3 AC-1/2/4; `structured` §6 M5; C3 op 81 |
| M5-SW-T | switch from tablet | same assertion set from tablet | `dems2_tablet` on lane 2 | 2+1 | ux §3 -> rev-2 | same |
| M5-SW-P | switch from phone | same assertion set from phone | `dems2_phone` on lane 1 | 2+1 | ux §3 -> rev-2 | same |
| M5-GAP-1 | gap bound analyzer | the switch-gap analyzer is proven on the S2 acceptance vectors **and on a negative vector with 1,000 samples removed at the switch, which it must FAIL** (the packet-grid metric passes it — AU2-05) before any device run trusts it (unit-style, deterministic) | capture-worker analyzer test | 1 | 31 §E -> rev-2 | S2 §4 (12/12); AU-2 §2 (`run1_drop1000.m4a`); specs R-3 AC-1 |
| M5-WARN-1 | silence warning never auto-switches | synthetic level below -50 dBFS for 10 s raises `MIC_SILENT` warning; active mic **unchanged**; 2 s disconnect debounce honored; fake clock, no wall waits | warning-raiser unit | 1 | 31 §E.1 -> rev-2 | specs R-3 AC-3; OD-11 (D4); register NM-10 |

### A.6 M6 — transcript pipeline

Artifact of record for every M6 check: `gateway_check/11_m6_gate.md` + the transcript JSON and
no-throughput grep output attached (D230).

| Check ID | Name | Asserts (one line) | Command / workspace | Runs | Owning row | Cites |
|---|---|---|---|---|---|---|
| M6-RG-* / M6-QA-1 | suites + typecheck/lint | 7 runs exit 0 at floors | section B.4 | 1 each | rev-2 M6 | — |
| M6-TF-1 | functional transcript check | on the sealed two-speaker fixture, run on **both** backends: non-empty segments with timestamps, >= 1 segment per scripted sentence, language `id`, transcript **sealed and verified inside** the package, speaker state LABELLED-or-UNAVAILABLE; on `cpu-local` the quoted command shows `-ng` on the GPU-off build (**CPU clause of R-5 AC-1 restored**, AU3-01) — no RTF/WER figure anywhere (no-throughput grep attached) | `apps/transcriber/` + core-server db integration, fakes | 2+1 | 33 §E.1 criteria 1-6 -> rev-2 | tx §E.1; specs R-5 AC-1/2; D230 |
| M6-DF-1 | no dropped fragment while STT runs | with **`cpu-local`** STT running beside the fake capture (a GPU engine gives no evidence for RK-1, AU3-01), fragment `seq` stays contiguous with 0 dropped/duplicated (one functional check — **not a throughput measurement**) | capture + transcriber integration, analyser over `recording_fragments` | 2+1 | 33 §E.1-8 -> rev-2 | specs R-5 AC-4, C-N2; register E-22; RK-1 |
| M6-KR-1 | chunk resume after a kill | kill mid-transcript: committed chunks survive, resume continues from the last checkpoint, no chunk recomputed twice (`tx §D.1/§D.2`) | transcriber kill harness | 2+1 | 33 §D -> rev-2 | tx §D.1/§D.2; tx §E.1-7; `structured` §6 M6 |
| M6-LB-1 | speaker state behavior | diarizer loaded -> LABELLED with 2 speakers on the fixture; diarizer absent -> UNAVAILABLE with the flag `speaker labels unavailable` — both paths unit-tested, asserted in TF-1 | transcriber unit (model stubbed) | 1 | 33 §A.4 -> rev-2 | tx §A.4; specs R-5 AC-2; D226 labels part |
| M6-AD-1 | TranscriberAdapter contract | one interface, two backends (`omlx-server`, `cpu-local`) return the identical document shape; `TtsFixtureProvider` produces the fixture; config-driven selection, never automatic mid-session | transcriber contract unit | 1 | 33 §B -> rev-2 | tx §B.5/§B.4; specs R-5 AC-5; W1-C12 |
| M6-CP-1 | CPU priority rule | capture outranks STT: bounded thread product <= physical cores asserted; oMLX calls serialised (never beside a large VLM session) | config assertion unit + runbook check | 1 | 33 §C -> rev-2 | tx §C; specs C-N2; D7(d) standing rule |

### A.6a R-8 STT configuration checks — ACTIVE (Q-STT-CFG confirmed, D24; opened by D20)

**Scheduled and counted as active.** The user confirmed Q-STT-CFG (a) — all 13 proposed R-8
defaults — at the second blueprint gate (D24, 2026-10-08; `specs` R-8), so the eight checks below
are active: `M2-STTCFG-DB` counts in the M2 gate set (M2 28 + 1 = 29; milestone map `structured`
§6 "M2 catalogue + M2-STTCFG-DB") and the seven `M6-STTCFG-*` count in the M6 gate set (M6 14 + 7
= 21). The rows stay in this section (not moved to A.2/A.6). Device/browser checks follow the 2+1
rule. The verify clause of the disabled / unreachable states is proven at M7 by `M7-STTCFG-VERIFY`
(§A.7; CF-12).

| Check ID | Name | Asserts (one line) | Command / workspace | Runs | Owning row | Cites |
|---|---|---|---|---|---|---|
| M2-STTCFG-DB | `stt_config` kept table | the singleton row is image-equal after `db:reset` (kept, mode `upsert`); `SELECT secret_*` fails 42501 for `dems_app`; the seed writes the Q-STT-CFG default (confirmed D24: enabled, `omlx-server` on this Mac); the loopback-endpoint and credential CHECKs reject bad rows | db project | 1 | rev-2.1 M2 (row 112) | dbc-3 §B.13; specs R-8 AC-1; OD-19 |
| M6-STTCFG-API | ops 90-92 contract + secrecy | `CAPTURE_CONFIG` required for 91/92; reads 90 for every role; responses carry `credentialSet`/`credentialKind` only; `STT_CONFIG_CHANGED` detail = changed field names + `credentialChanged`; a non-loopback endpoint is refused `422 INVALID_INPUT` (`ENDPOINT_NOT_LOOPBACK`); log-blanking covers the credential. **Erratum T-9 (PE-113-07/-08/-10; D68; 2026-10-09):** (a) a stale `revision` on op 91 = **`409 INVALID_STATE`** with `details.reason: REVISION_CONFLICT` and `details.currentRevision`; nothing stored, no audit row; refused before the named 422 values; an update that changes nothing writes no row and keeps the revision; (b) a `SECRET` credential write on op 91 = **`503 NOT_READY`** with `details.reason: CREDENTIAL_STORE_NOT_READY`, nothing stored, **until row 84** provides the credential sealer (`REFERENCE` and `CLEAR` work) — the 503 is the expected answer at the M6 gate; row 84's own Verification turns it into 200 with `credentialKind: ENCRYPTED`; (c) `changedFields` is a **string**: the changed field names joined with a comma in the fixed order `enabled, backend, endpoint, model, language, diarization, credential` — not a list, never values; (d) op 92 answers `503 NOT_READY` (`TRANSCRIBER_NOT_READY`) on every call until row 115 provides the probe, and **200 on a booted server after row 115** (`reachable: false` is a 200 result) | core-server unit + static; one booted-server call of op 92 (row 115) | 1 | rev-2.1 M6: row 113 (contract, 409, 503, `changedFields`); row 115 (op 92 = 200 on a booted server) | C3 §2.5 (ops 91/92 Errors; rules "Stale revision", "Credential store (interim)"; `STT_CONFIG_CHANGED`), §4; specs R-8 AC-2/3/7; E-30/E-31; SEC35-14; `11_audit_errata.md` §5.5 T-9 |
| M6-STTCFG-NEXT | change applies to the next session | with a session open, op 91 stores the change (`appliesFrom: NEXT_SESSION`); the open session's transcript uses its start snapshot; the next session uses the new value (fake clock, no wall waits) | core-server unit | 1 | rev-2.1 M6 | tx §B.7; specs R-8 AC-4 |
| M6-STTCFG-OFF | STT disabled | a fake recording with STT disabled runs no transcriber work and seals with `transcript.state = 'DISABLED'` + reason `DISABLED_BY_CONFIGURATION` (manifest state only; the verify clause is proven at M7 by `M7-STTCFG-VERIFY` beside `M7-VV-SRV`, CF-12) | capture + transcriber + sealing integration (fakes) | 2+1 | rev-2.1 M6 | ev §B.7a; tx §B.7; specs R-8 AC-5 |
| M6-STTCFG-UNREACH | STT enabled, backend unreachable | backend stopped/blocked: sealing completes per D-EV-1 (`PARTIAL`, `failedChunks` > 0, no fabricated text) and `transcript.backendUnreachable = true`; capture unaffected | same, backend fake refusing connections | 2+1 | rev-2.1 M6 | ev §B.7a/§E.5; tx §B.7; specs R-8 AC-6 |
| M6-STTCFG-WEB | web configuration menu | SUPERVISOR/TECHNICIAN edit + test connection; one `STT_CONFIG_CHANGED` row; INVESTIGATOR sees the "Checking your permissions..." state then a disabled control; credential field write-only (never pre-filled) | agent-browser on lane web | 2+1 | rev-2.1 M6 | ux §8a; specs R-8 AC-2 |
| M6-STTCFG-TAB | tablet read-only status | STT status (enabled/backend/model/last test result) shown read-only; no edit control | `dems2_tablet` on lane 2 | 2+1 | rev-2.1 M6 | ux §8a |
| M6-STTCFG-PHONE | phone read-only status | same as TAB on the phone | `dems2_phone` on lane 1 | 2+1 | rev-2.1 M6 | ux §8a |

### A.7 M7 — sealing v2, kill matrix, verify, tamper

Artifact of record for every M7 check: `gateway_check/12_m7_gate.md`, each cell logged with kill
signal, phase/step, RECOVERY outcome, hash comparison and `sealing_jobs.attempt` trace by the
producing W-row.

The kill matrix is a set of **distinct named checks, each 2+1** — never a >= 10-run loop (section F).
Kill points: recording phases P1-P4 (listed in F.1 from `ev` §E.4 / OD-08 / `cap` §C.5 / `dbc-3` §B.5)
x sealing steps S1-S8 (`ev` §E.1/§E.3 — the 8 steps of row 32). Every clean-path cell compares final
hashes to M7-REF-1; every interrupted cell compares to the per-phase durable-prefix reference
produced by M7-KM-P*-0 (chain determinism rests on S1's byte-identical-chain finding, D10(b)).

**Erratum PE-127-09 (row 127, 2026-10-09; AP3 = D78, D81).** The M7 gate set (row 89) is the 52
scheduled checks of this table **plus the 9 M7 checks of §A.4a.8** = 61 (+ 10 conditional): the
development-source mark in the manifest and in verify, the "no all-`PRODUCTION` package" check and
the credentialed adoption after row 84.

| Check ID | Name | Asserts (one line) | Command / workspace | Runs | Owning row | Cites |
|---|---|---|---|---|---|---|
| M7-RG-* / M7-QA-1 | suites + typecheck/lint | 7 runs exit 0 at floors | section B.4 | 1 each | rev-2 M7 | — |
| M7-REF-1 | uninterrupted reference seal | clean fake session (2 cameras + switch + transcript) seals to SEALED; package + DB hashes recorded as the equality reference **Erratum (PE-127-09, 2026-10-09; D81):** the reference is recorded on a manifest that already carries fields 124-128 (every source class `FAKE`, `developmentSources = true`; 128 fields) — row 83 builds them from its first build, so the reference is taken once | core-server + capture-worker integration | 2+1 | 32 §E.1 -> rev-2 | `structured` §6 M7 "final hashes equal"; ev §E.1 |
| M7-KM-P1..P4-0 | recording-phase kill, seal uninterrupted | kill at phase P (F.1), supervisor/OD-08 path: durable part sealed, `timeline.interrupted=true`, durable-prefix hashes recorded as the per-phase reference; package still verifies (V-12). **Erratum PE-128-88:** for P1 the assertion is a failed start (see F.1): 0 evidence items, no interrupted seal | kill harness (worker/supervisor) | 2+1 each (4 checks) | 32 §E.4 + 31 §B.2 -> rev-2 | OD-08 (D4); ev §E.4; specs R-6 AC-4 |
| M7-KM-C-S1..S6 | clean recording, kill at sealing step S | RECOVERY resumes from step S checkpoint; each step's resume rule honored (no STT re-run, re-sign same digest, idempotent upserts); final hashes **equal M7-REF-1** | kill harness at step boundary | 2+1 each (6 checks) | 32 §E.1/§E.2 -> rev-2 | `structured` §6 M7; ev §E.1 resume rules |
| M7-KM-C-S7..S8 | clean, kill at fallback step | same, on the OD-21 fallback path — **conditional**: run only if the fallback is activated (legal confirmation outstanding, H.1); listed, not scheduled | conditional | 2+1 if triggered (2 checks) | 32 §E.3 -> rev-2 | ev §E.3; OD-21; H.2 below |
| M7-KM-P1..P4 x S1..S6 | interrupted seal x step kill | after the P-kill, kill again at step S of the interrupted pipeline; RECOVERY completes to SEALED (interrupted), durable-prefix hashes equal the M7-KM-P*-0 reference, V-12 surfaces the flag. **Erratum PE-128-88:** not for P1 — the P1 cells assert that recovery never reaches step Sx (F.1) | kill harness, 24 distinct cells | 2+1 each (24 checks) | 32 §E -> rev-2 | `structured` §6 M7 "each recording phase x each sealing step as distinct checks" |
| M7-KM-P1..P4 x S7..S8 | interrupted seal x fallback step | same cross on the fallback path | conditional, 8 cells | 2+1 if triggered (8 checks) | 32 §E.3/§E.4 | same |
| M7-VV-SRV | v2 verify PASS on server | op 41 executes the 14 checks V-01..V-14, all pass on the sealed fake package (server side) **Erratum (PE-127-09, 2026-10-09; `ev` §D, PE-124-07):** 14 checks as built by row 85; **15 (V-01..V-15) from row 141 on** — the gate +1 runs 15; V-15 itself is proven by `M7-DEVSRC-SEAL-1` / `M7-DEVSRC-TAMPER-1` (§A.4a.8) | core-server db/unit integration | 2+1 | 32 §D -> rev-2 | `structured` §6 M7; ev §D (verify count 14) |
| M7-STTCFG-VERIFY | v2 verify of transcript states (CF-12 split of `M6-STTCFG-OFF`/`-UNREACH`) | a `DISABLED` package and an unreachable-`PARTIAL` package verify PASS with the state reported, and tampering `transcript.state` FAILs (added by RV-SPEC G-1) | core-server db/unit integration (fakes) | 2+1 | rev-2.1 M7 (row 119) | ev §B.7a/§D; C3 op 41 V-checks; specs R-8 AC-5/AC-6; `structured` CF-12 |
| M7-VV-WEB | v2 verify PASS on web | agent-browser shows verify PASS incl. both track hashes, transcript, signature, certificate rows | web lane | 2+1 | ux (flow 5/6 surfaces) -> rev-2 | same; ux §2..§8 |
| M7-VV-PHONE | v2 verify PASS on phone | mobile shows the v2 verify verdict with pinned per-run wording | `dems2_phone` lane | 2+1 | ux -> rev-2 | same; ux §9 P-16 |
| M7-TP-1 | one-fragment tamper | alter exactly one fragment's stored bytes -> V-04 fails exactly that `(trackId, seq)`, V-06 fails the chain from that fragment on, everything else passes, classification TAMPERED not CORRUPT; demo EV-0005 re-scripted on one fragment | verify integration + demo seed assertion | 2+1 | 32 §D V-08/§F.2 -> rev-2 | ev §D V-08 (quoted criterion); `structured` §6 M7; OD-02 L2 |
| M7-FF-UNIT | progress forward-only (unit) | `sealing_jobs` progress sequence never decreases on the client render model; fake-clock monotonic derivation from Core instants only | web + mobile unit, fake timers | 1 | 34 §4/§5 -> rev-2 | specs R-6 AC-2; ev §E.2; ux P-01; RC-1 pattern (`recording-elapsed.ts:129`) |
| M7-FF-WEB / M7-FF-TAB / M7-FF-PHONE | progress forward-only on clients | during a real sealing run (fakes) each client's step progress only advances; after a RECOVERY resume the client shows max-seen, never a step back | agent-browser + tablet + phone lanes | 2+1 each (3 checks) | ux §4 + §5 -> rev-2 | `structured` §6 M7; E-13 (MB-04 High); B9/FXR-DEV-2 with MB-04 |

### A.8 M8 — playback, export, composite

Artifact of record for every M8 check: `gateway_check/13_m8_gate.md` + `gateway_check/assets/`
(playback captures, export destination listings, blanked-log quotes).

| Check ID | Name | Asserts (one line) | Command / workspace | Runs | Owning row | Cites |
|---|---|---|---|---|---|---|
| M8-RG-* / M8-QA-1 | suites + typecheck/lint | 7 runs exit 0 at floors | section B.4 | 1 each | rev-2 M8 | — |
| M8-PB-W | playback on web with Range | agent-browser plays `VIDEO-01/02` through op 88 media session: HTTP 206 Range responses, seek works, audio-source band renders intervals | lane web | 2+1 | 31 §D.4 + C3 op 88 -> rev-2 | `structured` §6 M8; ux §6 (flow 5) |
| M8-PB-T / M8-PB-P | playback on tablet / phone | same on emulators (expo-video with Range headers, F-31); one player per camera file with the single embedded audio track | lanes 2 / 1 | 2+1 each | ux §6 + MB-07 -> rev-2 | same; RK-17 |
| M8-EV-SCOPE-1 | REAL-evidence case scope on op 88 | op 88 REAL-evidence case scope: an INVESTIGATOR/TECHNICIAN sees only cases they hold; out-of-scope reads refused `403 NOT_PERMITTED` and the attempt audited (Q-SEC-1 (a) confirmed, D24; added by RV-SPEC G-4) | agent-browser on lane web + emulator lane | 2+1 | rev-2.1 M8 (row 90, M8-W1) | C3 op 88; SEC35-16 (`sec` S8); plan F-1 |
| M8-RNG-1 | Range server unit | 206/416 parsing, byte-range correctness, refusal without `EVIDENCE_VIEW`, no credential in URLs logged | core-server unit (evidence-media) | 1 | 31 §D.4 -> rev-2 | cap §D.4; C3 §5.1 |
| M8-EXP-1 | export verifies at destination | export op 42 job completes; the decrypted copy + manifest + signature + certificate is checked **at the destination folder** by the receiver-side verify (G.2: manifest hash, Ed25519 sig, plaintext hashes, transcript/revisions) | agent-browser export run + verify script | 2+1 | ev §G.1/§G.2 -> rev-2 | `structured` §6 M8; OD-16; specs R-5 AC-3 via revisions |
| M8-CMP-1 | composite derived + hashed | on-demand side-by-side composite carries `export.derived=true`, its sha256 recorded in the export manifest; encoder licence note present (DOC-05) | web run + manifest assertion | 2+1 | ev §G.3 -> rev-2 | `structured` §6 M8; OD-16; specs C.1 |
| M8-BLK-1 | signed-URL prefix blanked | any signed-URL/token prefix appears in **both** blanking lists (web error sink, mobile `runtime/log.ts`); log lines from media serving show blanks, not tokens | static/log unit + grep of collected logs | 1 | 31 §G G-R4 + ev §G.4 -> rev-2 | `structured` §6 M8; E-31; P-07 (ux §9) |
| M8-XAU-1 | export audit + no secret shapes | export writes its audit row (request semantics of modified op 42); no credential-shaped value in package, manifest, audit extract or export manifest (secret sweep before commit) | db/unit + X-SEC-1 attachment | 1 | C3 §5.3 + ev §G -> rev-2 | C3 §5.3; register E-31; report §6 credential rule |
| M8-REV-1 | signed revision immutability | `TRANSCRIPT_REVISE` revision: Core Ed25519 signs, author recorded, sealed machine transcript byte-unchanged (asserted inside EXP/PB runs, unit here) | core-server unit + e2e assert | 1 | C3 op 85 + tx §A.6 -> rev-2 | specs R-5 AC-3; OD-15 |

### A.9 M9 — hardening, release, final chain (Mac part)

Artifact of record for every M9 check: `gateway_check/14_m9_gate.md` (Mac part; the chain verdicts
CH-1..CH-4 are their own reports copied into it).

| Check ID | Name | Asserts (one line) | Command / workspace | Runs | Owning row | Cites |
|---|---|---|---|---|---|---|
| M9-RG-* | full regression, 7 workspaces | all 7 runs exit 0 at the final re-pinned floors (section D.4); mock-core still 4/19 (read-only proof), pg-scripts >= 57 | section B.4 | 1 each | rev-2 M9 (27 pattern) | `structured` §6 M9; row 27 Verification |
| M9-QA-1 | typecheck + lint + build | root typecheck/lint exit 0; release build only if the user asks (then B13/CSP check rides on it) | root scripts | 1 | rev-2 | `structured` §8 B13 |
| M9-SIM-1 | Simulated regression vs `c2c983b` | M2's SIM-1/SIM-2 pair re-run at M9 (OD-23 names M2 **and** M9) | as M2-SIM-* | 1 | 29/OD-23 | OD-23; `structured` §6 M2/M9 |
| M9-PIN-1 | stale-pin sweep (final) | X-PIN-1 grep over the full repo = 0 stale counts/versions/floors outside the section-C list | grep | 1 | rev-2 | RK-14; section C |
| M9-DOC-1 | docs updated (DOC-01..06) | runbook (B6 `scripts/pg/server.mjs`), README corrections, DOC-05 licence table complete vs tx §F component list; DOC-06 regeneration note | doc inventory check | 1 | rev-2 (33 §F; `structured` §6 M9) | `structured` §6 M9 DOC-01..06; tx §F (DOC-05 entry list) |
| M9-HYG-1 | hygiene backlog | B8 mobile items, B12 RC-2..RC-7 nits closed or carried with a named decision; B5/B6/B7 splits only per OD-26 (after M9 or separate task) | review of rev-2 M9 rows | 1 | rev-2 | `structured` §8 (B8, B12, OD-26 default (b)) |
| M9-CH-1..4 | final verification chain | verdicts recorded in order: verifier (full-gate re-check incl. this catalogue n/n milestones) -> security-review (0 Critical open, dependency posture vs b2 baseline) -> test-expert (this strategy's catalogue vs the closed ledger) -> senior-code-reviewer (clean-tree, static-rule family intact) | chain reports `gateway_check/` | 1 each | rev-2 (row 27/38/39 pattern) | `structured` §6 M9 "final chain"; specs §F M9 |

**Class-C register for M9 (listed, NOT executed on this Mac):** C-5 physical device e2e (M4/M5/M8
re-run on hardware; entry `structured` §9), C-7 benchmark on the real Core device (RTF/RAM/WER —
the only place figures are allowed, D230), C-8 TPM/PKCS#11 signer (signature verifies with the
device chain), C-2/C-1/C-3/C-4 real adapters and ONVIF/PoE. Each carries its own +1 when activated
(`structured` §9 "2 + 1"). **Pre-handover section (only if the user announces handover, D233):**
A1-A6 (release-build revoke-to-Pair, timer lag, tablet late stop, RC-1 device check) and C-9
(1-2 h AV drift run; repeated kill loops) — the only items in this strategy that loop more than
10 times, and they exist **only** there (section F.3).

**Erratum PE-127-18 (row 127, 2026-10-09; D75, D82, D86 C-5).** Unauthenticated camera discovery and
the connection test on fixtures left class C-1 and are scheduled in §A.4a. Still class C, listed and
not executed: every authenticated or configuration action on a real camera (C-1), **recording from a
real network camera** (the pull path, C-2 — an adopted camera can be found, tested and assigned,
not recorded, in this phase), the lock-out rule of the target camera model, and the camera-interface
key of the Core device. The R-11 results close no class-C item (`specs` R-11 AC-10).

---

## B. Run-count rules, fake-clock rule and command forms

### B.1 The 2+1 rule

Source: standing user rule D232/D233 (inherited, `structured` §1.2; `report/report.md` §6) and
`structured` §6 intro. Applied as: the producing row runs the check **2 times**; the milestone
gate (verifier, rev-2) runs **1 independent verification**. Applied to: device (emulator) checks,
browser (agent-browser) checks, spike checks, and DB-backed gate checks where the gate names them
(`dbc-3` §G "Run counts"). The 2+1 count is a *depth* rule, not a repetition loop: a 2+1 check has
exactly 3 executions; anything longer belongs to section F.3 (pre-handover only).

### B.2 Run-once categories

Unit/regression suites run **once per workspace per checkpoint** (`structured` §6 intro) — the
`Mx-RG-*` families above; static guards, boot checks, doc/grep checks, and the unit-style MT-2..MT-8
migration/catalog tests run once per checkpoint (`dbc-3` §G). A milestone gate never executes a suite
more than once per workspace; extra per-unit coverage comes from the checkpoints *inside* each
milestone (`structured` §6 intro), which reuse the same commands.

### B.3 Fake-clock rule (no new wall-clock waits)

Rule: tests added or touched by this phase contain **no new wall-clock waits** — timing states are
driven by the virtual clock (`packages/shared/src/live/testing/clock.ts:81` `flush`/`elapse`, jest
fake timers, vitest fake timers). Authority: P-01..P-16 pattern P-08 ("mobile jest
timeouts/`maxWorkers`; fake clocks — every timing state gets a fake-clock test, no wall-clock
waits", ux §9), specs C-N5, `structured` §Verification ("fake clocks only"), B10 rows 16-21.

Enforcement mechanism, two layers:
1. **The B10 pattern** (proven in rows 16-21): per changed test file — file passes 3/3 (2+1);
   zero-waits grep printed; production diff empty; **timeout never raised** to make a test green
   (row 17 explicitly "no timeout raised"; row 19 *removed* the leftover RC-8 ceilings).
2. **Standing grep check X-FC-1** (section J): at every milestone checkpoint, over the files added
   or modified since the previous checkpoint, run the accepted acceptance grep (form proven in
   `implementation/02_b10b_...md` §5 and row 16 §grep):
   `grep -nE "setTimeout\([[:space:]]*[0-9]{3,}|setInterval|sleep\(|await new Promise|await wait\(|Date\.now|performance\.now" <test-files>`
   — every hit must be classified (fake-globals bridge, script-content value, or ceiling — not a
   sleep) or the checkpoint fails. Result quoted in the gate artifact.

### B.4 Command forms per workspace (`--maxWorkers=2` for ALL)

Rule: every workspace run uses `--maxWorkers=2` from the repository root. Authority: register
**W1-C7** (`research/03_analysis.md:335`, corrected per **D12(c)**): vitest 5.0.3 *does* honour
`--maxWorkers` (measured in core-web), so jest and vitest workspaces share one flag; the
`--poolOptions.threads.maxThreads=2` substitute is invalid (`CACError`) and moot (core-web default
pool is `forks`). Verified against each `package.json` now — findings:

| Workspace | Runner | `test` script as found | Prescribed form |
|---|---|---|---|
| `@dems/shared` | vitest | `vitest run` | `npm run test -w @dems/shared -- --maxWorkers=2` |
| `@dems/core-server` (unit) | vitest | `vitest run --project unit` | `npm run test -w @dems/core-server -- --maxWorkers=2` |
| `@dems/core-server` (db) | vitest | `vitest run --project db` | `npm run test:db -w @dems/core-server -- --maxWorkers=2` (form quoted from `dbc-3` §G; optional `DEMS_TEST_STEP=<row>` prefix per predecessor convention) |
| `@dems/core-web` | vitest | `vitest run` | `npm run test -w @dems/core-web -- <path> --maxWorkers=2` (per-file form proven by row 20) |
| `@dems/mobile` | jest | `jest` | `npm run test -w @dems/mobile -- <path> --maxWorkers=2` (form proven by rows 16-21, D10(f): the `npx --rootDir` variant fails on `@/` aliases) |
| `@dems/mock-core` | vitest | `vitest run` | `npm run test -w @dems/mock-core -- --maxWorkers=2` (workspace is read-only; run only) |
| `scripts/pg` | node:test | `npm run test:pg-scripts` = `node --test scripts/pg/` | **finding:** `--maxWorkers` is a jest/vitest flag; `node --test` does not take it. Equivalent knob is `--test-concurrency=2` (append to the runner args if a W-row ever needs it). The floor of 57 is exercised as-is; X-MAX-1 records this as the documented exception, so the "ALL workspaces" rule is satisfied by: every *jest/vitest* workspace runs `--maxWorkers=2`; the node:test runner carries the same intent via `--test-concurrency` and is never parallelized against other suites |
| `apps/capture-worker` (new, M3) | vitest (expected) | created by rev-2 | inherits the rule at creation: `npm run test -w @dems/capture-worker -- --maxWorkers=2`; recorded by X-MAX-1 |
| `apps/transcriber` (new, M6) | vitest (expected) | created by rev-2 | same; STT calls additionally serialised per D7(d) (shared host service — never beside a large VLM session) |

Root `npm test` (all workspaces at once) is **not** accepted as gate evidence — the handover states
it shows load flakes with three idle emulators (`report/report.md` §7); per-workspace runs are the
reliable evidence.

---

## C. Pinned-count file list (categories B/C/D, predecessor convention)

Convention kept from `map` §7.1/§7.2 (task 2 categories: A behavior-model files, B operation
count, C replicated-slice count, D schema/contract/table inventory, S static guards). This section
owns **B, C, D** plus the ledger floors; category A files are not a pin list (they are behavioral
test edits owned by their W-rows); category S is section D-Static. Values used are the register
(row 6) corrected values — E-06 for the ledger, W1-C9/SH-19 for OpenAPI, SH-16/CS-25 for ops/slices.

| Family | Pin (old -> new) | Files that hold the pin (from `map` §7.2; 75's exact lines re-verified in `explore` §2.5) | Updated in M2 by | Confirmed by |
|---|---|---|---|---|
| B — operation count | `75 -> 89` (projected `34 GET / 55 POST`) | shared: api-openapi-scope, api-registry, api-state-examples, client-types, openapi (5); core-server: `src/modules/rbac/__tests__/matrix.db`, `src/plugins/permission-guard/__tests__/{access-rules,decision,guard,matrix}`, `test/acceptance/{contract,rbac-matrix}` (7 — `contract.test.ts:374-380/:424/:433`, `rbac-matrix.test.ts:897-901/:1043/:1058`); core-web: `src/test/live-api-reference-{document,page}.test.tsx` (2 — `:143/:232/:234`, `:128/:132/:135/:302/:303`) = **14 files** | SH-19/WB-09/CS-25 W-row (rev 2; `C3` §8 "M2 owns the edit"); `rbac-matrix.test.ts` iterates the registry so it follows without a literal edit | M2-API-1 (drift), M2-PIN-1 stale-grep, senior-code-reviewer of the pin W-row, row 39 at doc level, M9-PIN-1 final |
| C — replicated slice count | `28 -> 30` (`captureConfig`, `captureDevices`; E-04 own-kind) | shared: api-realtime, api-state-slices, live-source-replica, realtime-live-socket (4); core-server: `src/db/mapping/__tests__/{round-trip,to-rows}`, `src/engine/__tests__/{delta,rehydrate,restart.db}`, `src/modules/devices/__tests__/status`, `src/modules/sessions/__tests__/routes`, `src/realtime/__tests__/{first-contact.db,hub.lifetime,messages,state.db}`, `test/acceptance/shared-state`, `test/db/{contract-inventory,migrate.db}` (14) = **18 files** | SH-16 W-row (rev 2) | M2-RG-* suites, M2-PIN-1, M9-PIN-1 |
| D — schema version, contract revision, table inventory | `schema v1 -> v2`; `dbc-2 -> dbc-3`; `evidence_tracks` shape rows; 30-table inventory | shared: api-state-slices, sim-store (2); core-server: `src/core/__tests__/core-plugin`, `src/db/fixtures/__tests__/{build,bulk-fixture.db}`, `src/db/mapping/__tests__/to-rows`, `src/db/reset/__tests__/{cli.db,reset-failures.db}`, `src/db/seed/__tests__/{seed-order,seed.db}`, `src/db/store/__tests__/write-through.db`, `src/engine/__tests__/{commands.db,recording.db,restart.db,ring}`, `src/modules/evidence/__tests__/{bulk.db,commands.db,consistency.db,immutability.db,reads.db}`, `test/acceptance/contract`, `test/db/{boot-checks.db,catalog.db,commands.db,commands,constraints.db,contract-inventory,migrate.db,privileges.db}` (27); core-web: `src/test/live-{security-audit,system}-export` (2) = **31 files** | CS-16..CS-18 + migrations 0004/0005 W-rows (rev 2; `dbc-3` §A) | M2-DB-*/MT-* checks, M2-PIN-1, M9-PIN-1 |
| OpenAPI document versions | `all 0.2.1 -> 0.3.0`; `offline 0.1.0 -> 0.2.0` (constants `openapi.ts:102/:106` + comment lines `:13/:104-105` + regenerated `packages/shared/openapi/openapi.json`) — register W1-C9/SH-19, `explore` §2.5 | same files as B family (`api-openapi-scope`, `openapi`, contract + web API-reference) | C3 §8 (exact literals listed there) | M2-API-1 + M2-API-2 |
| R-9..R-11 pins (rows 129, 132, 142) — **Erratum PE-127-10** | operations `92 -> 97` (GET `35 -> 36`, POST `57 -> 61`); `offline` scope `26 -> 31`; audit types `63 -> 67`; access conditions `5 -> 6`; Try-it denied operations `8 -> 10`; error codes 40 and slices 30 unchanged; schema `v2 -> v3`, `dbc-3 -> dbc-4`, tables `40 -> 41`, columns `419 -> 426`, CHECKs `166 -> 172`, migration files `8 -> 10` | the family-B files above, plus `apps/core-web/src/features/api-reference/try-it.ts` with its test, `packages/shared/src/api/contract-model.ts` (access conditions) and `packages/shared/src/api/sim-actions.ts` if an INTERNAL action is added; family D: the 15 pin groups of `dbc-4` §N.12 with file:line (referenced, not restated) | rows 132 / 142 (contract; C3 §10.1), row 129 (database, in the commit that adds set 4) | `M4-PIN-1`, `M4-PIN-2`, X-PIN-1 (extended), M9-PIN-1 |
| Test-count floors (ledger) | 71/1,851 shared; 160/3,954 cs-unit; 124/1,751 cs-db; 117/1,495 web; 192/1,988 mobile; 4/19 mock-core; 57 pg-scripts — register E-06 values; mobile 192/1,988 re-confirmed at W5 (row 19 full-suite exit 0) | not files — assertions in every `Mx-RG-*` run line, plus the floor table in each gate artifact | see D.4 re-pin mechanism | every gate + M9-PIN-1 |

Review that confirms **no stale pin survives**: X-PIN-1 at every checkpoint from M2 on —
`grep -rlE "toHaveLength\(75\)|75 operations|toHaveLength\(28\)|28 slices|dbc-2|'0\.1\.0'|'0\.2\.1'|DB_SCHEMA_VERSION = 1" <section-C files>` must return 0
(the predecessor's own grep method, `map` §7.1) — quoted in the gate artifact; final full-repo
sweep at M9-PIN-1. The register line `register:105` ("rows 29/30/36 and the pinned-count lists in
the test strategy must use the errata values") is satisfied: every value above is the corrected one.

**Erratum PE-127-10 (row 127, 2026-10-09).** From rows 129 / 132 on, the X-PIN-1 grep also lists the
as-built values that become stale — the operation counts 92 / 35 / 57, the audit-type count 63, the
`offline` count 26, `dbc-3`, `DB_SCHEMA_VERSION = 2`, "40 tables" / 419 / 166 and "eight files". The
exact patterns are written by the pin rows from the file:line lists of C3 §10.1 and `dbc-4` §N.12;
a number alone (such as `92`) is never a pattern.

---

## D. Static rules for the new folders (and reconciliation with the existing guard family)

### D.1 New guard tests

| New folder | Guard test file | Forbids (rule IDs) | Created at | Owning spec |
|---|---|---|---|---|
| `apps/core-server/src/capture/` | `src/capture/__tests__/static.test.ts` | G-R1 (host modules no `node:fs`/`node:child_process`/`node:net`/`node:worker_threads`; **erratum T-7, PE-57-07, 2026-10-09:** for `node:fs` except the two pinned pre-capture importers `src/plugins/config/connection-file.ts` and `src/plugins/logger/error-log.ts`), G-R2 (fs/child_process only in spawn/handshake files), G-R4 (no key/credential/signed-URL prefix in log/audit calls), G-R5 (no `AdminResource.DEVICES` reuse), G-R7 (no deep `@dems/shared/sim/**` imports), G-R8 (worker start / clock / random only through the seam); the same file holds the P25 pin, which covers waived edits 1-6, 11-12 and 13-14 and every added line of `app.ts` (erratum T-7, PE-57-08, D68(b)) ; **erratum PE-127-11, 2026-10-09:** from M4 the same file holds G-R9..G-R15 and the extended G-R4 / G-R6 for `src/capture/adapters/**` (G-R10 as corrected by D82: no `node:net` import), each with a planted-violation control — check `M4-SR-1`; the P25 pin gains the waived edits 15-18 | M3 | cap §G, §I (row 31); M3-SR-1 |
| `apps/capture-worker/` | `apps/capture-worker/src/__tests__/static.test.ts` | G-R3 (worker is the one OS-boundary; barrel-only sim import), G-R4, G-R6 (no media write outside git-ignored paths; media path under `docs/` = failure); **erratum T-6, PE-111-02, D66, 2026-10-09:** plus the rule that forbids `use_editlist=1`, `negative_cts_offsets` and `avoid_negative_ts=disabled` in the worker (beside the AU2-07 rule) | M3 | cap §G, §C.4; M3-SR-2 |
| `apps/core-server/src/modules/capture-config/` | `.../capture-config/__tests__/static.test.ts` | module-folder convention of the 21 existing guards: forbidden imports, detail-key exactness (CS-14), no fs | M4 | `map` §7.2 S ("new folders ... need their own static rule"); register CS-12 |
| `apps/core-server/src/modules/evidence-media/` | `.../evidence-media/__tests__/static.test.ts` | same convention + G-R4/G-R6 variants (no signed-URL token in logs; no media copies outside store paths) | M8 | `map` §7.2 S; register NM-11; E-31 |
| `packages/capture-protocol/` | `packages/capture-protocol/test/static.test.ts` | pure message schemas: no `node:*` built-ins, no host imports (shared-side convention) | M3 | register NM-03 (new-workspace list `register` §row-402 line); cap §A.3 |
| `packages/shared/src/evidence-package/` | shared-side static test in `packages/shared/test/` | client-safe: no `node:fs`/`child_process`; manifest v2 canonicalization is pure | M7 | register NM-08; ev §B |
| `apps/transcriber/` | `apps/transcriber/src/__tests__/static.test.ts` | never reads `~/.omlx/settings.json` or prints the API key (D7(d)); model path from config only; no runtime downloads (installs are Q-INSTALL-time, logged); never binds port 8000 outside the `omlx-server` adapter | M6 | tx §B.2/§0; D7(d) standing rules; register NM-06 |

### D.2 Reconciliation — nothing double-counts

Baseline from `explore` §2.4 (row 1): **21** `static.test.ts` guards under `apps/core-server/src`,
+ 2 rule libraries (`modules/system/__tests__/static-rules.ts`, `modules/storage/...` — rules, not
guards), + 1 outside src (`test/helpers/db/__tests__/static.test.ts`), and separately the **13-file
`apps/core-server/test/static/` scanner suite** (helpers `scan.ts`, `imports.ts`, `log-calls.ts` +
10 scanners — drift P-09 / HBX-13, deferred by OD-26; **not** guards).

| Count | Value | Note |
|---|---|---|
| baseline (row 1 re-verified) | 21 | unchanged by M2 |
| after M3 | 21 + 1 (`src/capture`) = 22 | capture-worker guard is outside the core-server src glob — counted as a workspace guard, never in the 21/22 number |
| after M4 | 23 (+ `modules/capture-config`) | |
| after M6/M7 | shared-side tests are new files under `packages/shared/test/` — recorded in the shared workspace count (family S of `map` covers only core-server src guards; shared has no `static.test.ts` glob today, so no double-count) | |
| after M8 | 24 (+ `modules/evidence-media`) | |
| expected at M9 | 24 core-server src guards + 1 capture-worker + 1 transcriber + 2 package-side (capture-protocol, evidence-package) + the unchanged 13-file scanner suite + 2 rule libraries + 1 helper guard | each checkpoint records `rg --files apps/core-server/src -g "static.test.ts" \| wc -l` and the delta-with-owner table (row 1 Verification pattern) |

Cross-rule dedup: G-R1 restates the engine folder's `OUTSIDE_WORLD` rule (`engine/__tests__/static.test.ts:29`)
only for the **new** host-module set; the existing 21 guards are untouched, so a violation in `engine/`
is counted once (engine guard) and a violation in `capture/` once (capture guard). The new guards
reuse the `test/static/` scanner helpers (`cap` §G) so the scanner suite's 13 files stay the shared
implementation, not additional checks. No rule appears in two check IDs in section A.

**Erratum PE-127-11 (row 127, 2026-10-09).** Rows 131, 136 and 142 add **no** `static.test.ts` file:
the adapters live under `src/capture/` and extend its guard, so the counts above stay (22 after M3,
23 after M4, 24 after M8). The server-wide network scanner `apps/core-server/test/static/network.test.ts`
(one of the 13 scanner files, not a guard) gains the two file-pinned exemptions of `M4-SEC-NET-1`.
The mobile test behind `M4-CONN-PTR-T` / `M4-CONN-PTR-P` (no password field and no call of ops 89 /
95 / 96 under `apps/mobile/src`) is a jest test of the mobile workspace. `M4-SR-1` and `M4-SEC-NET-1`
are two files with two scopes: a rule is counted in the file that holds it. In the table above the
`|` inside the `rg … wc -l` command is now escaped, so that row has three cells like its header.

---

## E. Lane re-creation and per-lane pairing (M2 precondition)

- Procedure: **`dbc-3` §F, referenced not re-specified** (8 steps: `pg:start` -> `db:create --database
  dems_lane_n` -> `lockf .locks/db-migrate.lock db:migrate` -> `db:seed` per lane -> Core 4421-4423 +
  Vite 5176-5178 -> per-lane re-pair via `adb reverse tcp:4420` mapping, pairing code issued and
  redeemed on that lane -> `dems_demo` migrate + v2 reseed). Red lines carried: project PostgreSQL
  `127.0.0.1:4432` only, `.data/pg.*` secret files never read into arguments/logs, SMART WMS ports
  untouched (`dbc-3` §F "Red lines").
- What a lane-based gate requires: **device re-paired per lane** — pairing is per database
  (`structured` §Cross-task continuity: the three emulators stay paired to the main instance **until
  M2 re-pairs per lane**). Before any M4/M5/M7/M8 client check, the emulator's `adb reverse` maps
  the lane port, the pairing code comes from that lane, and the redeem call must have **returned**
  before any recording starts (D258). Check M2-LANE-1 asserts the resulting state (4 DBs at schema 2,
  per-lane pairings, `dems_demo` intact). Lane-device binding keeps the predecessor pattern
  (lane 1 = `dems2_phone`, lane 2 = `dems2_tablet`, lane 3 / reserved = `dems2_phone2`).
- Failure mode if skipped (RK-10 / E-24): lanes do not exist (only `dems_demo` — drift §4, D240), so
  every lane-based gate fails or silently targets the wrong database — devices still paired to
  `dems_demo` would act on the main instance, audits/credentials would land on the wrong DB, and
  parallel client checks would collide on one session state. Mitigation is exactly M2-LANE-1 as the
  **first M2 row** (`structured` §6 M2, DP-7, RK-10 row).

## F. Kill matrix (distinct checks, never a loop)

### F.1 Axes, listed explicitly

Recording phases (from `ev` §E.4 OD-08 crash path, `cap` §C.5 drop-fragment rule, `dbc-3` §B.5
open-interval rule):

| Phase | Kill point | Spec anchor |
|---|---|---|
| P1 | during RECORDING, before the first durable fragment (moov-only / zero declared fragments) | ev §E.4; S1 §5.2 |
| P2 | mid-write of the next fragment after >= 1 durable (partial tail -> size-mismatch signature, drop-fragment) | ev §E.4; cap §C.5; S1 §5.4 |
| P3 | mid-write with an open `session_audio_intervals` row and a transcript chunk in flight (switch + STT active) | dbc-3 §B.5; tx §D.1/§D.2; ev §E.4 (intervals_incomplete/PARTIAL) |
| P4 | after `STOP` ack (files flushed/closed) but before the S1 checkpoint (FINALIZING entry) | cap §B.2 STOP; ev §E.1 |

**Ruled (D89(b), following D84) — erratum PE-128-88 (supersedes the open-point note of PE-127-12):** a kill in phase P1 is a failed start. Expectation of `M7-KM-P1-0`, `M7-KM-P1-S1`..`S6` and of the two conditional P1 cells: after the kill and the next boot the session is closed as a failed start — 0 evidence items, 0 `sealing_jobs` rows for the session, 0 files under a final name, no interrupted seal; no step S1..S8 is entered for that session (the Sx cell asserts that recovery never reaches step Sx); the four `session_capture_sources` rows remain. "Final hashes equal an uninterrupted run" does not apply to P1. Cell IDs and the counts of section K are unchanged (7 active + 2 conditional cells).

Sealing steps (the 8 of row 32, `ev` §E.1 + §E.3; S7/S8 exist only on the OD-21 fallback path):

| Step | `FinalizationStep` | Path |
|---|---|---|
| S1 | `CLOSE_TRACKS` | normal |
| S2 | `FINALIZE_HASHES` | normal |
| S3 | `FINALIZE_TRANSCRIPT` | normal |
| S4 | `BUILD_MANIFEST` | normal |
| S5 | `SIGN_MANIFEST` | normal |
| S6 | `STORE_SEALED_PACKAGE` | normal |
| S7 | `CONCATENATE_SEGMENTS` | fallback only (OD-21) |
| S8 | `ENCRYPT_PAYLOAD` | fallback only (OD-21) |

### F.2 Matrix (each cell one distinct check ID, runs 2+1)

| kill during -> | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | recording-phase kill, no seal kill |
|---|---|---|---|---|---|---|---|---|---|
| clean recording (no P kill) | M7-KM-C-S1 | M7-KM-C-S2 | M7-KM-C-S3 | M7-KM-C-S4 | M7-KM-C-S5 | M7-KM-C-S6 | M7-KM-C-S7 (cond.) | M7-KM-C-S8 (cond.) | M7-REF-1 |
| P1 failed start (D84) | M7-KM-P1-S1 | ...-P1-S2 | ...-P1-S3 | ...-P1-S4 | ...-P1-S5 | ...-P1-S6 | cond. x1 | cond. x1 | M7-KM-P1-0 |
| P2 interrupted | M7-KM-P2-S1 | ...-P2-S2 | ...-P2-S3 | ...-P2-S4 | ...-P2-S5 | ...-P2-S6 | cond. x1 | cond. x1 | M7-KM-P2-0 |
| P3 interrupted | M7-KM-P3-S1 | ...-P3-S2 | ...-P3-S3 | ...-P3-S4 | ...-P3-S5 | ...-P3-S6 | cond. x1 | cond. x1 | M7-KM-P3-0 |
| P4 (files closed, pre-seal) | M7-KM-P4-S1 | ...-P4-S2 | ...-P4-S3 | ...-P4-S4 | ...-P4-S5 | ...-P4-S6 | cond. x1 | cond. x1 | M7-KM-P4-0 |

- 35 distinct kill checks scheduled on the default path (M7-REF-1 + 4 P*-0 + 6 clean C-S + 24 P x S
  cells) and 10 conditional (fallback) — each **2+1**, none is a loop: a cell = kill once, resume,
  assert, 3
  executions max. Assertions per cell are defined in A.7 (hash equality vs the matching reference,
  resume rule honored, V-12 flag for interrupted, forward-only client progress separately covered
  by M7-FF-*).
- Every cell records in the gate artifact: kill signal, step/phase, RECOVERY outcome, hash
  comparison, `sealing_jobs.attempt` trace.

### F.3 Parked in the pre-handover section ONLY (C-9; never scheduled in M1-M9)

| Item | Why parked | Trigger |
|---|---|---|
| repeated kill loops (same phase/step killed again and again, >= 10 iterations) | the standing rule confines >= 10-run repetitions to the pre-handover session | user announces handover (D233) |
| 1-2 h AV-drift run | long campaign, same rule; the bounded functional bound (+/-40 ms) is covered by M1-S4/M3-AV | user announces handover (D233) |

## G. Exclusions (never executed by agents in this phase)

| Exclusion | Rule / authority | Handling |
|---|---|---|
| biometric device test (A5/C5-bio) | D231; `structured` §8 A5/C5 "stays skipped unless the user asks" | **no biometric check exists in this catalogue** (grep in section K); only jest-level biometric coverage inherited from task 2 is kept |
| any agent typing a PIN, or setting/clearing/changing a lock, PIN, fingerprint or device security setting (`locksettings`, `adb emu finger`, settings writes) | emulator rule, `report/report.md` §6 (never broken); D60/D63/D70 (task 2) | on a locked device the agent stops and hands the user `apps/mobile/scripts/emulator-user-lock.sh unlock`; the user's PIN 9999 on `dems2_phone`/`dems2_tablet` is the user's to type; `dems2_phone2` stays lock-free so one device is always usable — the strategy never references the PIN as an agent input |
| media/evidence capture hygiene | D258 + credential rules (`report/report.md` §6) | pairing codes CSS-blurred before any screenshot; no capture within 2 s of typing into a password field; recordings/attachments start **after** the redeem call returns; scan outputs count-only — applies to every M4/M5/M7/M8 gate artifact (screenshots/logs above) |
| real hardware checks | class C (`structured` §5/§9); Q-HW unknown | real cameras/PoE/mics/physical devices/TPM/Core benchmark appear only in the A.9 class-C register, listed, not executed |
| real camera credentials — **Erratum PE-127-13** | D76(4); `specs` R-9 AC-16 | no agent types, stores, receives or guesses a real camera credential; every credential in a check is a fixture value or a per-run canary (§A.4a CR-2); a step that needs a real connection stops and hands over to the user, who types it in the web console |
| local-device media (this Mac's camera and microphone) — **Erratum PE-127-13** | D74(3), D86 C-7; SEC35-44; `specs` R-11 AC-8 | no agent opens, views, attaches or transcribes such media or a frame of it; checks on it are numeric and local; no still, audio excerpt, waveform, spectrogram, transcript or playback screenshot of it enters `docs/`; recordings stay under `.data/`, are listed with path and size, and are deleted only by the user |
| macOS camera / microphone permission — **Erratum PE-127-13** | D74(3); `specs` R-11 AC-9 | the user answers the system prompt; no agent runs a tool that reads or edits the permission database or the system settings; a missing permission stops the row with a one-click command and the check reads "blocked: user action" |
| identifiers of devices on the user's network — **Erratum PE-127-13** | D75, D78(1), D86 C-7; `specs` R-9 AC-16 | the real-LAN check (`M4-DISC-LAN-1`) prints counts and model class only — no address, MAC or serial in tool output or in a committed file; identifying results only under git-ignored `.data/` / `.cache/`; only the network this Mac is on is probed, and only by that check |
| oMLX host service | D7(d) | DEMS never binds port 8000, never restarts/upgrades oMLX; STT/TTS calls serialised, never beside a large VLM session; start/stop logged in `initialization/` |
| no external services / no sudo / no push | red lines (`structured` spike guard rails; report §6) | all spikes/checks run on synthetic sources in `.cache/` and `/.data/` |

## H. Bulk data / seeding

- v2 bulk fixture: `apps/core-server/src/db/fixtures/*` rebuilt as v2 recordings in M2 (register
  **CS-20**), applied **per lane** at M2-LANE-1 step 4 and on `dems_demo` via the v2 reseed
  (`dbc-3` §E.3). Row counts are stated in **`dbc-3` §G "Bulk-fixture v2 minimums" — referenced,
  not re-specified here** (permissions 14 / grants 22 / evidence_items 505 / evidence_tracks 1,010
  / capture_devices 8 / credentials 2 / session_audio_intervals 720 / recording_fragments 6,500 /
  transcript_chunks 2,000 / transcripts 400 / transcript_revisions 30 / sealing_jobs 3,000 / alerts
  250 with all 14 fault kinds).
- Verified by M2-MT-7 (counts + mix) at the db project; functional runs (M6/M7/M8) run "against the
  seeded demo dataset and the v2 bulk fixture on recreated lanes" per `structured` §Verification
  ("Functional testing" line). Demo evidence regenerated as v2 (OD-02 L2) only on `dems_demo`;
  `release/` untouched.

## I. Flake handling

| Rule | Content | Authority |
|---|---|---|
| re-run once, report both | a flake is re-run **once**; both results (the flake and the rerun) are reported in the row artifact; the check is never marked green silently | W3-W6 practice (rows 16-21: "3/3 runs", per-run status tables, honest drift notes e.g. row 16 zero-wait finding recorded instead of a fake pass) |
| never hide with timeouts | a timeout is never raised to make a test pass; per-test ceilings stay removed (RC-8 sweep, row 19 removed the leftover `40_000`), jest config `testTimeout: 20000` is the single workspace ceiling; `--maxWorkers=2` + per-workspace runs are the load mitigation | rows 16-21 verification columns; D12(b) ("no timeout raised"); RK-19 |
| known host-load flakes | timing-adjacent suites run on a quiet host; if a run times out under load the controller holds new spike rows until it passes (single-writer CPU table); emulator-gate checks prefer the release build for timing criteria (P-12 diagnostics on) | `structured` §10 (Host CPU row), §Verification (UAT line); RK-19 |
| known residual: `worker force exited` | mobile jest prints `A worker process has failed to exit gracefully ... force exited` while exiting **0** — pre-existing, accepted since baseline as N-4 / C1-R1 (unref'd 2 s flush timer, W87-F1). Recorded as a known behaviour: not a failure unless the exit code is non-zero; never "fixed" by raising timeouts | `implementation/04_b10e_rc8_redundant_timeouts.md` §103; task-2 baseline gate N-4 |
| mobile jest serial chain | device-adjacent mobile suites keep the sequential-runner habit (rows 16->22 chain) when run in parallel waves | `structured` §10 (Mobile jest runner) |

## J. Standing checks (every milestone checkpoint, runs = 1 per checkpoint)

| ID | Name | Asserts | Mechanism / cites |
|---|---|---|---|
| X-FC-1 | fake-clock grep | 0 unclassified wall-clock tokens in new/changed test files (B.3 pattern) | rows 16-21 grep proof; P-08; specs C-N5 |
| X-MAX-1 | runner-form audit | every suite line in the checkpoint artifact uses the B.4 form (`--maxWorkers=2`; node:test exception documented) | W1-C7/D12(c); report §7 |
| X-MEDIA-1 | media-out-of-git | `git status --porcelain` media-extension grep = 0 after any capture/kill/e2e checkpoint **Erratum (PE-127-14, 2026-10-09):** from row 134 on also: no still, waveform, spectrogram or transcript of a local-device session under `docs/` (`M4-SEC-PRIV-1`) | OD-25; specs C-N3; S1 §7 (folded into M3-MG-1 from M3 on) |
| X-PIN-1 | stale-pin sweep | 0 stale `75 / 28 / dbc-2 / v1 schema / 0.1.0 / 0.2.1` literals outside the updated section-C list (from M2 onward) **Erratum (PE-127-14, 2026-10-09):** from rows 129 / 132 on also the stale `92 / 35 / 57 / 63 / 26`, `dbc-3` and schema-2 values (section C) | RK-14; section C |
| X-DEP-1 | dependency posture | `npm audit` high count <= the row-23 target (baseline 54 lock-graph / 51 `--omit=dev`, **not 99** — register W1-C6 / b2 §1); `npm ls undici` >= 7.29.1; braces + node-forge accepted-risk entries present | b2 §1/§3/§6; specs C-N10; rows 23/24 |
| X-SEC-1 | secret sweep before commit | captured artifacts and gate attachments contain 0 credential/signed-URL/key-shaped values (predecessor `test/09/12` method) **Erratum (PE-127-14, 2026-10-09; D86 C-6, C-7):** from row 131 on the sweep also covers device-identifying patterns (an IPv4 address outside loopback, a MAC address, a serial number) and the two canary prefixes of §A.4a CR-2 | `structured` §Verification (Security line); E-31; report §6 |

## K. Self-gate (this file's own acceptance, row 36 hard gate)

| Required statement | Result |
|---|---|
| every gate M1-M9 maps to named checks with run counts | **10/10** gates mapped (M0 wave-A + M1-M9; `structured` row 36 words M1-M9 = 9/9, M0 checkpoint included => 10/10). Milestone check counts: M0 7, M1 21, M2 **29** (28 + `M2-STTCFG-DB`, §A.6a), M3 **22** (21 + `M3-REC-1`, T-8), M4 **105** (14 + 91, §A.4a), M5 **24** (13 + 11, §A.4a), M6 **21** (14 + 7 `M6-STTCFG-*`, §A.6a), M7 **61** (52 + 9, §A.4a) scheduled + 10 conditional, M8 **18**, M9 16, standing X 6. **Total named checks: 330 active (7 + 21 + 29 + 22 + 105 + 24 + 21 + 61 + 18 + 16 + 6) + 10 conditional (the OD-21 fallback-cell checks; 330 + 10 = 340 named) — 150 run 2+1 (exactly 3 executions each), 180 run once per checkpoint (150 + 180 = 330).** *Erratum (RV-SPEC, 2026-10-08): was M3 18 / 205 active / 82 run 2+1 / +10 conditional before `M3-AV-2` (AU2-06) and `M3-KC-4` (AU2-08) were added and §A.6a (D20) was appended.* *Erratum (RV-SPEC row 106 pickups, 2026-10-09): was M2 28 / M3 20 / M6 14 / M7 51 / M8 17, 207 active + 18 conditional (225 named), 84 run 2+1 / 123 once. 207 + 1 `M3-RTSP-BIND-1` (G-3) + 1 `M8-EV-SCOPE-1` (G-4) + 8 R-8 checks activated from conditional (G-5; Q-STT-CFG confirmed, D24) + 1 `M7-STTCFG-VERIFY` (G-1, CF-12) = 218 active; conditional 18 − 8 = 10; named 225 + 3 new = 228.* *Erratum (pair-review catalogue changes T-1..T-10, 2026-10-09; `11_audit_errata.md` §5.5, D65-D68): was M3 21 / 218 active + 10 conditional (228 named), 91 run 2+1 / 127 once. 218 + 1 `M3-REC-1` (T-8, lossless record path, runs once) = 219 active; once 127 + 1 = 128; 2+1 unchanged at 91; conditional unchanged at 10; named 228 + 1 = 229. T-1..T-7 and T-9 change the wording of existing checks only (`M3-KC-1` stays one ID with two halves; the `M3-KC-3` sibling and the row-62 SR-drift case of `M3-AV-2` are cases inside their checks); T-10 is a gate log line, not a named check.* *Erratum (row 127, PE-127-15, 2026-10-09; NEW SCOPE D73, AP3 = D78, D83): was M4 14 / M5 13 / M7 52, 219 active + 10 conditional (229 named), 91 run 2+1 / 128 once. 219 + 111 checks of §A.4a (M4 91, M5 11, M7 9) = 330 active; of the 111, 59 run 2+1 and 52 run once: 2+1 91 + 59 = 150, once 128 + 52 = 180; conditional unchanged at 10 — the checks of rows 129 and 130 are active, not conditional, because the schema change is confirmed (D83); named 229 + 111 = 340. The mechanical recount of section L item 6 gives the same figures.* |
| every acceptance criterion of R-9..R-11 maps to at least one named check with method, depth and owning row (`structured` row 127) — **Erratum PE-127-15** | **32/32** (R-9 16/16, R-10 6/6, R-11 10/10) in §A.4a.9; the catalogue totals are restated once, in the row above |
| pinned-count file list matches row 6 | section C uses the register (row 6) corrected values end-to-end: E-06 ledger (71/1,851; 160/3,954; 124/1,751; 117/1,495; 192/1,988 + 4/19 + 57), W1-C9/SH-19 (offline 0.1.0 -> 0.2.0, all 0.2.1 -> 0.3.0), SH-16 (28 -> 30), `map` §7 families B 14 / C 18 / D 31 files — list size **14 + 18 + 31 = 63 pin files + 2 OpenAPI constants/json + 7 ledger floors** |
| 0 checks with >= 10 loops outside the pre-handover section | every scheduled check carries runs = `2+1` (3 executions) or `1`; grep in section L shows loop-like phrasing occurs **only** as negations ("never a loop") and inside F.3 / A.9 pre-handover / class-C rows. Result: **0 scheduled checks with >= 10 loops** |
| no biometric check present | grep `biometric` in this file: appears only in section G (exclusion, D231) and in the self-gate statements K/L — **0 checks** |
| every check cites its spec section | all rows in A/J carry a "Cites" column to a spec section, register row, `structured` row/§6, decision ID or spike artifact |
| `--maxWorkers=2` stated for all workspaces with command forms | B.4 table: 7 current workspaces + 2 new (capture-worker, transcriber); each `package.json` re-checked this session and the findings stated (node:test exception included); rule source W1-C7/D12(c) |

## L. Self-gate evidence (greps executed against this file, 2026-10-07; re-run 2026-10-09 for row 127)

1. execution-count audit — `grep -nE "\|\s*(([0-9]{2,})\s*(x|times|runs)|>= ?10|10\+)\s*\|" masterplan/10_test_strategy.md`
   -> **(no hits)**: no run-count cell in any check table carries >= 10 executions. Run-count cells
   are only `1`, `1 each`, `1 (gate-level)`, `1 (every capture checkpoint)`, `2+1` (with or without
   a qualifier), and `2+1 if triggered` (fallback-conditional). **Re-run for row 127 (PE-127-16,
   2026-10-09): (no hits);** the new cells are `1`, `1 (…)`, `2+1`, `2+1 (…)` and `2+1 each`.
2. loop/campaign phrasing — `grep -niE "loop|repeated|campaign|>= ?10" masterplan/10_test_strategy.md`
   -> hits only at: §0 hard-gate quote, A.7 intro + F heading + F.2 negations ("never a >= 10-run
   loop" / "none is a loop"), B.1 rule statement ("depth rule, not a repetition loop"),
   F.3 pre-handover table (repeated kill loops, long campaign), A.9 pre-handover line, K/L self-gate
   rows. **No check-ID row outside F.3/A.9 uses loop phrasing.**
   **Re-run for row 127 (PE-127-16, 2026-10-09):** 13 more lines match, every one only through the
   network word "loopback" (with that word removed: 0 new matches); no row of §A.4a uses loop,
   repetition or campaign phrasing.
3. biometric — `grep -ni biometric masterplan/10_test_strategy.md` -> lines only in §G (exclusion,
   D231) and in K/L statements: **0 checks**.
4. maxWorkers — `grep -c "maxWorkers"` -> 26 occurrences (29 lines after row 127, PE-127-16), covering every workspace in B.4 and the
   command forms quoted in A.0/A.2/A.3; the node:test exception is recorded in B.4.
5. class arithmetic (manual, matches K; re-pinned 2026-10-09 for the row-106 pickups G-1/G-3/G-4/G-5,
   again 2026-10-09 for the pair-review catalogue changes T-1..T-10: once 127 -> 128, M3 14 -> 15, and
   again 2026-10-09 for row 127 — **Erratum PE-127-16**; the figures before row 127 follow, the
   row-127 step is the last paragraph of this item):
   2+1 cells expand to 91 checks (49 bare — 40 + `M3-AV-2` + `M3-KC-4`, RV-SPEC 2026-10-08, + 5 R-8
   `M6-STTCFG-OFF/UNREACH/WEB/TAB/PHONE` + `M7-STTCFG-VERIFY` + `M8-EV-SCOPE-1` — + M2 LANE 1 +
   M2 DB 2 + M8 PB-T/P grouped 2 + grouped 4+6+24+3 = 37);
   once cells sum to 128 (M0 7, M1 3, M2 26, M3 15, M4 11, M5 10, M6 13, M7 9, M8 12, M9 16, X 6:
   7 + 3 + 26 + 15 + 11 + 10 + 13 + 9 + 12 + 16 + 6 = 128 —
   M2 +1 `M2-STTCFG-DB`, M3 +1 `M3-RTSP-BIND-1` and +1 `M3-REC-1` (T-8), M6 +2 `M6-STTCFG-API/NEXT`);
   total active 91 + 128 = 219, + 10 conditional (OD-21 fallback only; the 8 R-8 checks are active
   since D24) = 229 named.
   **Row 127 (PE-127-16):** §A.4a adds 59 checks that run 2+1 (M4 43, M5 9, M7 7) and 52 that run
   once (M4 48, M5 2, M7 2). 2+1: 91 + 59 = **150**. Once: M0 7, M1 3, M2 26, M3 15, M4 59 (11 + 48),
   M5 12 (10 + 2), M6 13, M7 11 (9 + 2), M8 12, M9 16, X 6: 7 + 3 + 26 + 15 + 59 + 12 + 13 + 11 + 12 +
   16 + 6 = **180**. Total active 150 + 180 = **330**, + 10 conditional = **340** named.
6. mechanical recount (row 127, **Erratum PE-127-16**, 2026-10-09) — a script walks every table of
   this file whose header starts with `Check ID` (sections A.0-A.9, A.4a, A.6a) or `ID` (section J),
   expands grouped rows (`(N checks)` in the Runs cell; `RG-*` = 7 workspaces, + 1 with `QA-1`; an
   `n..m` suffix; otherwise the number of IDs separated by ` / `), classes each row by its Runs cell
   (`1…` = once, `2+1…` = 2+1, `… if triggered` = conditional) and compares the cell count of every
   table row in the file with its header. Run on the file before row 127 it printed 128 / 91 /
   219 / 10 (229 named) — the figures of item 5. Output on this file:

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

## M. What row 37 / row 40 must do with this strategy

- Row 37 (`masterplan/02_plan.md`): give every W-row its section-A check IDs in its Verification
  column; schedule device/browser/DB-gate checks as 2+1 with the gate +1 in the verifier row of the
  milestone; keep <= 8-agent waves while respecting the single-writer rules of `structured` §10.
- Row 40 (rev 2): make M2-LANE-1 the first M2 row (DP-7); confirm the `gateway_check/06..13` naming;
  fold the 10 conditional KM cells into a visible "OD-21-fallback conditional" note so they are
  never silently scheduled.
- Second blueprint gate (row 39 then gate): this file is checked against register row 6 and the
  §6 milestone table; any gate-item change (e.g. OD-21 legal confirmation activating the fallback,
  or a handover announcement enabling F.3/C-9) re-opens only sections A.7/A.9/F.
- **Erratum PE-127-17 (row 127, 2026-10-09).** Row 128 (spec gate of R-9..R-11): reconcile the 34
  points of §A.4a.11; a value fixed differently changes only the check texts named in its last
  column. Task-architect: the Verification cells of rows 129-142 and of the gates 70, 75 and 89
  should name the check IDs of §A.4a — the exact sentences are in
  `delegation_progress/test_expert_row127.md` §5 (the blueprint is not edited by row 127). Rows
  61, 66, 71, 83, 84 and 85 own or share checks of §A.4a as well (same record).

---
*Generated: 2026-10-07 10:35*
*Last Updated: 2026-10-08 (RV-SPEC: AU-2/AU-3 errata — M1-S2-3, M1-S4-1/2, M1-TT-4, M3-AV-1/2, M3-KC-2/4, M5-SW-W, M5-GAP-1, M6-TF-1, M6-DF-1; R-8 conditional checks §A.6a, D20; see masterplan/11_audit_errata.md)*
*Last Updated: 2026-10-09 (RV-SPEC row 106 pickups, `gateway_check/25_rv_spec_reconciliation.md` §4: G-3 `M3-RTSP-BIND-1`, G-4 `M8-EV-SCOPE-1`, G-5 §A.6a R-8 checks active (D24), G-1 CF-12 split `M6-STTCFG-OFF` -> `M7-STTCFG-VERIFY`; totals 218 active + 10 conditional)*
*Last Updated: 2026-10-09 (pair-review catalogue changes T-1..T-10, `masterplan/11_audit_errata.md` §5.5, D65-D68: T-1 `M3-RTSP-BIND-1`, T-2 `M3-KC-1`, T-3 `M3-KC-3`, T-4 `M3-AV-1/2`, T-5 `M3-WI-1`, T-6 `M3-SR-2`, T-7 `M3-SR-1`, T-8 new `M3-REC-1`, T-9 `M6-STTCFG-API`, T-10 M3 gate log line; totals 219 active + 10 conditional = 229 named, 91 run 2+1 / 128 once)*
*Last Updated: 2026-10-09 (row-128 spec-gate fix pass PE-128-88..92 (D89, D91; `gateway_check/27_r9_r11_spec_gate.md`); blueprint row 127, marks PE-127-01..PE-127-18: test catalogue delta for R-9, R-10, R-11 — new §A.4a with 111 checks (M4 91, M5 11, M7 9), traceability 32/32 acceptance criteria, changed existing checks, the values assumed where specs disagree; D73-D86; totals 330 active + 10 conditional = 340 named, 150 run 2+1 / 180 once)*
