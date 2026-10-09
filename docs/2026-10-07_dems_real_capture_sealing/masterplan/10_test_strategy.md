---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: test-expert
blueprint_row: 36 (class B, milestone M0, tier 1)
source_plan: identification/02_structured.md (rev 1, rows 36, 38, 39)
status: completed
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
| `cap` | `masterplan/05_capture_architecture_spec.md` (row 31) |
| `ev` | `masterplan/06_evidence_package_spec.md` (row 32) |
| `tx` | `masterplan/07_transcript_spec.md` (row 33) |
| `ux` | `masterplan/08_client_ux_spec.md` (row 34) |
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
| M2-LANE-1 | lane re-creation + per-lane pairing | procedure of `dbc-3` §F steps 1-8 completes: four DBs at schema 2 / `dbc-3`, three lanes with a Core (4421-4423) + Vite (5176-5178), each device paired to its lane, recording starts only after redeem returns | `dbc-3` §F command table (not restated here) | 2+1 (first M2 row runs 2; gate +1) | rev-2 first M2 row (DP-7) -> gate | `dbc-3` §F; `structured` §10 line 383, DP-7; D258 (report §6); section E |
| M2-DB-1 | MT-1 on throw-away clone | `db:migrate` 0004/0005 exit 0 on the v1 copy `dems_test_capture_*`; ledger current; `schema_meta = (2,'dbc-3')`; second run no-ops | `dbc-3` §G path 1; `npm run test:db -w @dems/core-server -- --maxWorkers=2` | 2+1 (gate check) | 30 §G MT-1 -> rev-2 | `dbc-3` §G MT-1; `structured` §6 M2 "migrations ... on a throw-away copy" |
| M2-DB-2 | MT-1 on fresh lanes | full set 0000..0005 applies to a freshly created lane, exit 0 | `dbc-3` §G path 2 | 2+1 (gate check) | 30 §G MT-1 -> rev-2 | same |
| M2-MT-2 | copy-migration on live data | 0004 validates against v1 rows with no data rewrite (v1 items keep `manifest_version = 1`) | db project | 1 | 30 §G MT-2 | `dbc-3` §G MT-2, §A.4, D-DB-05 |
| M2-MT-3 | three FAULT_KIND CHECKs accept new kinds | `MIC_SILENT`/`CAPTURE_FAULT` insert in all three tables (`0001_tables.sql:281/:382/:488`), a 15th value rejected, plus the other MT-3 accept/reject rows | db project | 1 | 30 §G MT-3 | `structured` §6 M2 "three FAULT_KIND CHECKs"; register E-01; `dbc-3` §C.1-§C.3 |
| M2-MT-4 | privileges + credential read restriction | privilege matrix equals `dbc-3` §D; **`SELECT capture_device_credentials` fails 42501 for `dems_app`**; reveal function returns the row; UPDATE on INSERT-only tables fails 42501 | db project | 1 | 30 §G MT-4, §B.3, §D | RK-12 (`structured` §Risk); `dbc-3` §B.3 (D-DB-06), §D; register §G RK-12 |
| M2-MT-5 | reset keeps the kept set | after reset on copy/lane: 11 kept tables image-equal, other tables equal v2 seed checksums, epoch +1 | db project | 1 | 30 §G MT-5, §E.1 | `dbc-3` §E.1; OD-19 |
| M2-MT-6 | reset guard (real evidence) | a `REAL` sealed row makes `db:reset` refuse `RESET_BLOCKED_REAL_EVIDENCE` with the DB untouched; `DEMO_PACKAGE` rows never block | db project | 1 | 30 §G MT-6, §E.2 | OD-19 (D4); RK-16; `dbc-3` §E.2 |
| M2-MT-7 | seed + bulk fixture v2 counts | seed counts (14 permissions, 22 grants, 1 capture_config, 5 devices, 0 credentials) and the `dbc-3` §G bulk minimums table hold; `rbac.matrix` boot equality (D88) | db project | 1 | 30 §G MT-7; register CS-19/CS-20 | `dbc-3` §G; section H |
| M2-MT-8 | catalog/vocabulary pin | catalog text of the three swapped CHECKs equals the 14-kind shared constant; `value-sets.ts` edited in the same commit | db project | 1 | 30 §G MT-8 | `dbc-3` §G MT-8 (CL-12/GD-05 pattern) |
| M2-API-1 | OpenAPI drift at 0.3.0 | `all` document version 0.3.0, 89 ops, 34 GET / 55 POST, registry==document drift test green; `openapi.json` regenerated | `npm run test -w @dems/core-server -- <acceptance/contract> --maxWorkers=2` | 1 | 29 §8 + SH-19 W-row -> rev-2 | `structured` §6 M2; C3 §8; register SH-19 |
| M2-API-2 | offline scope 0.2.0 | `offline` constant 0.2.0 with the 13 simulated ops visible (offline grows 10 -> 23), 89-1 live-only op excluded; scope test re-pinned to OD-17 (byte-for-byte pin superseded) | `npm run test -w @dems/shared -- <api-openapi-scope> --maxWorkers=2` | 1 | 29 §8 + SH-19 W-row | C3 §8; OD-17 (D4); register W1-C9 |
| M2-API-3 | rbac.matrix boot | `rbac.matrix` boot passes with D88 equality on the new permission rows | db project boot test | 1 | rev-2 (SH-04) | `structured` §6 M2; specs C-N9; register SH-04 |
| M2-PIN-1 | pinned-count re-pin sweep | category B/C/D files now pin 89 / 30 / v2+`dbc-3`; grep for stale `75`, `28`, `dbc-2`, `0.1.0`, `0.2.1` in the section-C list = 0 remaining | grep vs section C list, once in the gate | 1 | rev-2 pin W-rows -> gate | register E-06/SH-19/W1-C9; `map` §7.1; section C |
| M2-SIM-1 | Simulated regression vs `c2c983b` (behavior) | shared sim suites (determinism, simulated-isolation, demo-data-alignment, gap-closure, selector-stability) green; simulator answers v2 shapes per OD-17 (single audio, switch, new steps, transcript stub) | `npm run test -w @dems/shared -- --maxWorkers=2` + mock-core suite | 1 | 29/31 -> rev-2 | OD-23 (D4); `structured` §6 M2 (replaces `acaff20` gate); register SH-05..SH-08 |
| M2-SIM-2 | Simulated diff audit | `git diff --name-only c2c983b..HEAD -- packages/shared/src/sim/` lists only files owned by blueprint rows (rule: simulator changes only through rows) | shell | 1 | gate (verifier) | OD-23; `structured` §6 M2 |
| M2-AUD-1 | new audit types | the 9 new types (53 -> 62) write rows whose details equal the exact key lists of C3 §5.2, 0 secret keys; category map gains exactly 9 entries; the 9 new codes (31 -> 40) and the forbidden-key CHECK 17 -> 25 hold (C3 §4/§5; `dbc-3` §C) | core-server unit (`audit-details`, vocabulary) | 1 | 29 §5 -> rev-2 | C3 §5.2; register E-10/E-30; specs C-N9 |
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
| M3-SR-1 | `src/capture/` static guard | G-R1, G-R2, G-R4, G-R5, G-R7, G-R8 hold over `src/capture/**`. **Erratum T-7 (PE-57-07/-08; D65(d), D68(b); 2026-10-09):** **G-R1 as corrected** — no host file imports `node:fs` **except the two pinned pre-capture importers** `src/plugins/config/connection-file.ts` and `src/plugins/logger/error-log.ts` (pinned by name; a third entry is a decision, not a habit); no host file imports `node:child_process`, `node:net` or `node:worker_threads`. **P25 pin** — the guard's pin of the frozen files now covers the waived edits **13-14** (`sttConfigModule` import + registration in `app.ts`, row 113) beside 1-6 and 11-12, and **every added line of `app.ts`** (a line nobody waived fails the pin); edits 7-10 (`config.ts`) are not landed (row 58) | `apps/core-server/src/capture/__tests__/static.test.ts` (vitest, 1) | 1 | 31 §G -> rev-2 creates (row 57; pin extended by row 113) | cap §G G-R1, §I; `explore` §2.4; `static.test.ts:113,120-122,208,233`; `11_audit_errata.md` §5.5 T-7 |
| M3-SR-2 | capture-worker static guard | G-R3, G-R4, G-R6 hold over `apps/capture-worker/**`. **Erratum T-6 (PE-111-02, D66; 2026-10-09):** plus the static rule (beside the AU2-07 rule) that **forbids `use_editlist=1`, `negative_cts_offsets` and `avoid_negative_ts=disabled` in the worker** (forbidden with `empty_moov`: each shifts the whole video track by about 450 ms while the file still decodes rc 0). The one option kept as the negative control of `M3-AV-1/2` must not weaken this rule for the worker itself; where that single occurrence lives is row 58's to pin | `apps/capture-worker/src/__tests__/static.test.ts` | 1 | 31 §G -> rev-2 (row 58 required work, D66; guard family row 61) | cap §G, §C.4; `11_audit_errata.md` §5.5 T-6 |
| M3-RTSP-BIND-1 | RTSP ingest binds 127.0.0.1 only | start the ingest and assert with `lsof -nP -iTCP:<port>` / `netstat -an` that every listener on 8554-8564 is bound to `127.0.0.1` and never `0.0.0.0`/`*`, incl. the NM-14 fixture readers; the static rule G-R4 forbids a wildcard literal in the worker command (added by RV-SPEC G-3). **Erratum T-1 (PE-111-03, D66; 2026-10-09): widened** — the TCP-port form cannot fail on anything that is not a TCP listener on those ports, so the check now takes `lsof -nP -a -p <worker pid> -i` and asserts that **every socket the worker process owns, TCP and UDP, is on `127.0.0.1`**: the worker owns no datagram socket on all interfaces (`UDP *:5000` / `*:5001` must not appear; `rtsp_transport=tcp` on the listen ingest does not prevent it). **Negative control:** a client that requests RTP over UDP (the case in which the row-111 skeleton opened `UDP *:5000` / `*:5001`) — the snapshot is taken with that client connected | capture-worker socket snapshot of the worker pid (TCP + UDP) with a UDP-requesting client + static guard | 1 | rev-2 M3 W-row M3-W4; widened by row 58 (D66 required work) | cap §A.2 W-1, §A.4, §A.8; SEC35-23 (`sec` S7); specs C-N4; `11_audit_errata.md` §5.5 T-1 |
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

| Check ID | Name | Asserts (one line) | Command / workspace | Runs | Owning row | Cites |
|---|---|---|---|---|---|---|
| M4-RG-* / M4-QA-1 | suites + typecheck/lint | 7 runs exit 0 at floors | section B.4 | 1 each | rev-2 M4 | `structured` §6 intro |
| M4-SEL-W | selector edit + audit from web | agent-browser edit writes exactly **one** `CAPTURE_CONFIG_CHANGED` row with permission + changed fields; slice `captureConfig` republishes | agent-browser CLI on lane web (127.0.0.1, never `localhost`) | 2+1 | ux §2 + C3 ops 76-80 -> rev-2 | specs R-1 AC-1; `structured` §6 M4; ux §2 |
| M4-SEL-T | same on tablet emulator | selector change visible after refresh on the recreated lane; device re-paired to its lane | `dems2_tablet` (emulator-5556) via lane 2, app launch `demsdemo:///login?core=LIVE&motion=off` | 2+1 | ux §2 -> rev-2 | specs R-1 AC-2; `structured` §6 M4; register E-24 |
| M4-SEL-P | same on phone emulator | same assertion on phone | `dems2_phone` (emulator-5554) via lane 1 | 2+1 | ux §2 -> rev-2 | same |
| M4-LOCK-1 | config locked while session open | edit during an open session refused `409 CAPTURE_CONFIG_LOCKED` with **no** audit row and no state change (unit; also asserted inside each SEL run) | core-server unit, fake clock | 1 | 30/29 -> rev-2 | specs R-1 AC-1; OD-10 (D4); C3 §4 |
| M4-FAKE-1 | fake adapters | fake `CameraAdapter` / `PoeController` / `AudioInputAdapter` satisfy the device contract; two fakes emulate two cameras (OD-05); real adapters = class C, **not executed** | unit/integration under `apps/capture-worker/src/adapters/` fakes | 1 | 31 §A.1/§A.6 -> rev-2 | `structured` §6 M4 (fake)/§9 C-1..C-4 (real); register NM-01 |
| M4-PC-1 | permission-check state | gated controls G1-G3/G9 show "Checking your permissions..." before enable/refuse (unit inventory + asserted in SEL runs) | web/mobile state unit + e2e assert | 1 | 34 §11 -> rev-2 | ux §11 (10 controls x 3 clients, 6 reads); specs C-N12; register E-16 |

### A.5 M5 — manual mic failover end to end

Artifact of record for every M5 check: `gateway_check/10_m5_gate.md` + assets (switch-run captures
obey section G capture rules), fed by the producing W-rows.

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

| Check ID | Name | Asserts (one line) | Command / workspace | Runs | Owning row | Cites |
|---|---|---|---|---|---|---|
| M7-RG-* / M7-QA-1 | suites + typecheck/lint | 7 runs exit 0 at floors | section B.4 | 1 each | rev-2 M7 | — |
| M7-REF-1 | uninterrupted reference seal | clean fake session (2 cameras + switch + transcript) seals to SEALED; package + DB hashes recorded as the equality reference | core-server + capture-worker integration | 2+1 | 32 §E.1 -> rev-2 | `structured` §6 M7 "final hashes equal"; ev §E.1 |
| M7-KM-P1..P4-0 | recording-phase kill, seal uninterrupted | kill at phase P (F.1), supervisor/OD-08 path: durable part sealed, `timeline.interrupted=true`, durable-prefix hashes recorded as the per-phase reference; package still verifies (V-12) | kill harness (worker/supervisor) | 2+1 each (4 checks) | 32 §E.4 + 31 §B.2 -> rev-2 | OD-08 (D4); ev §E.4; specs R-6 AC-4 |
| M7-KM-C-S1..S6 | clean recording, kill at sealing step S | RECOVERY resumes from step S checkpoint; each step's resume rule honored (no STT re-run, re-sign same digest, idempotent upserts); final hashes **equal M7-REF-1** | kill harness at step boundary | 2+1 each (6 checks) | 32 §E.1/§E.2 -> rev-2 | `structured` §6 M7; ev §E.1 resume rules |
| M7-KM-C-S7..S8 | clean, kill at fallback step | same, on the OD-21 fallback path — **conditional**: run only if the fallback is activated (legal confirmation outstanding, H.1); listed, not scheduled | conditional | 2+1 if triggered (2 checks) | 32 §E.3 -> rev-2 | ev §E.3; OD-21; H.2 below |
| M7-KM-P1..P4 x S1..S6 | interrupted seal x step kill | after the P-kill, kill again at step S of the interrupted pipeline; RECOVERY completes to SEALED (interrupted), durable-prefix hashes equal the M7-KM-P*-0 reference, V-12 surfaces the flag | kill harness, 24 distinct cells | 2+1 each (24 checks) | 32 §E -> rev-2 | `structured` §6 M7 "each recording phase x each sealing step as distinct checks" |
| M7-KM-P1..P4 x S7..S8 | interrupted seal x fallback step | same cross on the fallback path | conditional, 8 cells | 2+1 if triggered (8 checks) | 32 §E.3/§E.4 | same |
| M7-VV-SRV | v2 verify PASS on server | op 41 executes the 14 checks V-01..V-14, all pass on the sealed fake package (server side) | core-server db/unit integration | 2+1 | 32 §D -> rev-2 | `structured` §6 M7; ev §D (verify count 14) |
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
| Test-count floors (ledger) | 71/1,851 shared; 160/3,954 cs-unit; 124/1,751 cs-db; 117/1,495 web; 192/1,988 mobile; 4/19 mock-core; 57 pg-scripts — register E-06 values; mobile 192/1,988 re-confirmed at W5 (row 19 full-suite exit 0) | not files — assertions in every `Mx-RG-*` run line, plus the floor table in each gate artifact | see D.4 re-pin mechanism | every gate + M9-PIN-1 |

Review that confirms **no stale pin survives**: X-PIN-1 at every checkpoint from M2 on —
`grep -rlE "toHaveLength\(75\)|75 operations|toHaveLength\(28\)|28 slices|dbc-2|'0\.1\.0'|'0\.2\.1'|DB_SCHEMA_VERSION = 1" <section-C files>` must return 0
(the predecessor's own grep method, `map` §7.1) — quoted in the gate artifact; final full-repo
sweep at M9-PIN-1. The register line `register:105` ("rows 29/30/36 and the pinned-count lists in
the test strategy must use the errata values") is satisfied: every value above is the corrected one.

---

## D. Static rules for the new folders (and reconciliation with the existing guard family)

### D.1 New guard tests

| New folder | Guard test file | Forbids (rule IDs) | Created at | Owning spec |
|---|---|---|---|---|
| `apps/core-server/src/capture/` | `src/capture/__tests__/static.test.ts` | G-R1 (host modules no `node:fs`/`node:child_process`/`node:net`/`node:worker_threads`; **erratum T-7, PE-57-07, 2026-10-09:** for `node:fs` except the two pinned pre-capture importers `src/plugins/config/connection-file.ts` and `src/plugins/logger/error-log.ts`), G-R2 (fs/child_process only in spawn/handshake files), G-R4 (no key/credential/signed-URL prefix in log/audit calls), G-R5 (no `AdminResource.DEVICES` reuse), G-R7 (no deep `@dems/shared/sim/**` imports), G-R8 (worker start / clock / random only through the seam); the same file holds the P25 pin, which covers waived edits 1-6, 11-12 and 13-14 and every added line of `app.ts` (erratum T-7, PE-57-08, D68(b)) | M3 | cap §G, §I (row 31); M3-SR-1 |
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
| expected at M9 | 24 core-server src guards + 1 capture-worker + 1 transcriber + 2 package-side (capture-protocol, evidence-package) + the unchanged 13-file scanner suite + 2 rule libraries + 1 helper guard | each checkpoint records `rg --files apps/core-server/src -g "static.test.ts" | wc -l` and the delta-with-owner table (row 1 Verification pattern) |

Cross-rule dedup: G-R1 restates the engine folder's `OUTSIDE_WORLD` rule (`engine/__tests__/static.test.ts:29`)
only for the **new** host-module set; the existing 21 guards are untouched, so a violation in `engine/`
is counted once (engine guard) and a violation in `capture/` once (capture guard). The new guards
reuse the `test/static/` scanner helpers (`cap` §G) so the scanner suite's 13 files stay the shared
implementation, not additional checks. No rule appears in two check IDs in section A.

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
| P1 interrupted | M7-KM-P1-S1 | ...-P1-S2 | ...-P1-S3 | ...-P1-S4 | ...-P1-S5 | ...-P1-S6 | cond. x1 | cond. x1 | M7-KM-P1-0 |
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
| X-MEDIA-1 | media-out-of-git | `git status --porcelain` media-extension grep = 0 after any capture/kill/e2e checkpoint | OD-25; specs C-N3; S1 §7 (folded into M3-MG-1 from M3 on) |
| X-PIN-1 | stale-pin sweep | 0 stale `75 / 28 / dbc-2 / v1 schema / 0.1.0 / 0.2.1` literals outside the updated section-C list (from M2 onward) | RK-14; section C |
| X-DEP-1 | dependency posture | `npm audit` high count <= the row-23 target (baseline 54 lock-graph / 51 `--omit=dev`, **not 99** — register W1-C6 / b2 §1); `npm ls undici` >= 7.29.1; braces + node-forge accepted-risk entries present | b2 §1/§3/§6; specs C-N10; rows 23/24 |
| X-SEC-1 | secret sweep before commit | captured artifacts and gate attachments contain 0 credential/signed-URL/key-shaped values (predecessor `test/09/12` method) | `structured` §Verification (Security line); E-31; report §6 |

## K. Self-gate (this file's own acceptance, row 36 hard gate)

| Required statement | Result |
|---|---|
| every gate M1-M9 maps to named checks with run counts | **10/10** gates mapped (M0 wave-A + M1-M9; `structured` row 36 words M1-M9 = 9/9, M0 checkpoint included => 10/10). Milestone check counts: M0 7, M1 21, M2 **29** (28 + `M2-STTCFG-DB`, §A.6a), M3 **22** (21 + `M3-REC-1`, T-8), M4 14, M5 13, M6 **21** (14 + 7 `M6-STTCFG-*`, §A.6a), M7 **52** scheduled + 10 conditional, M8 **18**, M9 16, standing X 6. **Total named checks: 219 active (7 + 21 + 29 + 22 + 14 + 13 + 21 + 52 + 18 + 16 + 6) + 10 conditional (the OD-21 fallback-cell checks; 219 + 10 = 229 named) — 91 run 2+1 (exactly 3 executions each), 128 run once per checkpoint (91 + 128 = 219).** *Erratum (RV-SPEC, 2026-10-08): was M3 18 / 205 active / 82 run 2+1 / +10 conditional before `M3-AV-2` (AU2-06) and `M3-KC-4` (AU2-08) were added and §A.6a (D20) was appended.* *Erratum (RV-SPEC row 106 pickups, 2026-10-09): was M2 28 / M3 20 / M6 14 / M7 51 / M8 17, 207 active + 18 conditional (225 named), 84 run 2+1 / 123 once. 207 + 1 `M3-RTSP-BIND-1` (G-3) + 1 `M8-EV-SCOPE-1` (G-4) + 8 R-8 checks activated from conditional (G-5; Q-STT-CFG confirmed, D24) + 1 `M7-STTCFG-VERIFY` (G-1, CF-12) = 218 active; conditional 18 − 8 = 10; named 225 + 3 new = 228.* *Erratum (pair-review catalogue changes T-1..T-10, 2026-10-09; `11_audit_errata.md` §5.5, D65-D68): was M3 21 / 218 active + 10 conditional (228 named), 91 run 2+1 / 127 once. 218 + 1 `M3-REC-1` (T-8, lossless record path, runs once) = 219 active; once 127 + 1 = 128; 2+1 unchanged at 91; conditional unchanged at 10; named 228 + 1 = 229. T-1..T-7 and T-9 change the wording of existing checks only (`M3-KC-1` stays one ID with two halves; the `M3-KC-3` sibling and the row-62 SR-drift case of `M3-AV-2` are cases inside their checks); T-10 is a gate log line, not a named check.* |
| pinned-count file list matches row 6 | section C uses the register (row 6) corrected values end-to-end: E-06 ledger (71/1,851; 160/3,954; 124/1,751; 117/1,495; 192/1,988 + 4/19 + 57), W1-C9/SH-19 (offline 0.1.0 -> 0.2.0, all 0.2.1 -> 0.3.0), SH-16 (28 -> 30), `map` §7 families B 14 / C 18 / D 31 files — list size **14 + 18 + 31 = 63 pin files + 2 OpenAPI constants/json + 7 ledger floors** |
| 0 checks with >= 10 loops outside the pre-handover section | every scheduled check carries runs = `2+1` (3 executions) or `1`; grep in section L shows loop-like phrasing occurs **only** as negations ("never a loop") and inside F.3 / A.9 pre-handover / class-C rows. Result: **0 scheduled checks with >= 10 loops** |
| no biometric check present | grep `biometric` in this file: appears only in section G (exclusion, D231) and in the self-gate statements K/L — **0 checks** |
| every check cites its spec section | all rows in A/J carry a "Cites" column to a spec section, register row, `structured` row/§6, decision ID or spike artifact |
| `--maxWorkers=2` stated for all workspaces with command forms | B.4 table: 7 current workspaces + 2 new (capture-worker, transcriber); each `package.json` re-checked this session and the findings stated (node:test exception included); rule source W1-C7/D12(c) |

## L. Self-gate evidence (greps executed against this file, 2026-10-07)

1. execution-count audit — `grep -nE "\|\s*(([0-9]{2,})\s*(x|times|runs)|>= ?10|10\+)\s*\|" masterplan/10_test_strategy.md`
   -> **(no hits)**: no run-count cell in any check table carries >= 10 executions. Run-count cells
   are only `1`, `1 each`, `1 (gate-level)`, `1 (every capture checkpoint)`, `2+1` (with or without
   a qualifier), and `2+1 if triggered` (fallback-conditional).
2. loop/campaign phrasing — `grep -niE "loop|repeated|campaign|>= ?10" masterplan/10_test_strategy.md`
   -> hits only at: §0 hard-gate quote, A.7 intro + F heading + F.2 negations ("never a >= 10-run
   loop" / "none is a loop"), B.1 rule statement ("depth rule, not a repetition loop"),
   F.3 pre-handover table (repeated kill loops, long campaign), A.9 pre-handover line, K/L self-gate
   rows. **No check-ID row outside F.3/A.9 uses loop phrasing.**
3. biometric — `grep -ni biometric masterplan/10_test_strategy.md` -> lines only in §G (exclusion,
   D231) and in K/L statements: **0 checks**.
4. maxWorkers — `grep -c "maxWorkers"` -> 26 occurrences, covering every workspace in B.4 and the
   command forms quoted in A.0/A.2/A.3; the node:test exception is recorded in B.4.
5. class arithmetic (manual, matches K; re-pinned 2026-10-09 for the row-106 pickups G-1/G-3/G-4/G-5,
   and again 2026-10-09 for the pair-review catalogue changes T-1..T-10: once 127 -> 128, M3 14 -> 15):
   2+1 cells expand to 91 checks (49 bare — 40 + `M3-AV-2` + `M3-KC-4`, RV-SPEC 2026-10-08, + 5 R-8
   `M6-STTCFG-OFF/UNREACH/WEB/TAB/PHONE` + `M7-STTCFG-VERIFY` + `M8-EV-SCOPE-1` — + M2 LANE 1 +
   M2 DB 2 + M8 PB-T/P grouped 2 + grouped 4+6+24+3 = 37);
   once cells sum to 128 (M0 7, M1 3, M2 26, M3 15, M4 11, M5 10, M6 13, M7 9, M8 12, M9 16, X 6:
   7 + 3 + 26 + 15 + 11 + 10 + 13 + 9 + 12 + 16 + 6 = 128 —
   M2 +1 `M2-STTCFG-DB`, M3 +1 `M3-RTSP-BIND-1` and +1 `M3-REC-1` (T-8), M6 +2 `M6-STTCFG-API/NEXT`);
   total active 91 + 128 = 219, + 10 conditional (OD-21 fallback only; the 8 R-8 checks are active
   since D24) = 229 named.

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

---
*Generated: 2026-10-07 10:35*
*Last Updated: 2026-10-08 (RV-SPEC: AU-2/AU-3 errata — M1-S2-3, M1-S4-1/2, M1-TT-4, M3-AV-1/2, M3-KC-2/4, M5-SW-W, M5-GAP-1, M6-TF-1, M6-DF-1; R-8 conditional checks §A.6a, D20; see masterplan/11_audit_errata.md)*
*Last Updated: 2026-10-09 (RV-SPEC row 106 pickups, `gateway_check/25_rv_spec_reconciliation.md` §4: G-3 `M3-RTSP-BIND-1`, G-4 `M8-EV-SCOPE-1`, G-5 §A.6a R-8 checks active (D24), G-1 CF-12 split `M6-STTCFG-OFF` -> `M7-STTCFG-VERIFY`; totals 218 active + 10 conditional)*
*Last Updated: 2026-10-09 (pair-review catalogue changes T-1..T-10, `masterplan/11_audit_errata.md` §5.5, D65-D68: T-1 `M3-RTSP-BIND-1`, T-2 `M3-KC-1`, T-3 `M3-KC-3`, T-4 `M3-AV-1/2`, T-5 `M3-WI-1`, T-6 `M3-SR-2`, T-7 `M3-SR-1`, T-8 new `M3-REC-1`, T-9 `M6-STTCFG-API`, T-10 M3 gate log line; totals 219 active + 10 conditional = 229 named, 91 run 2+1 / 128 once)*
