# Row 55 — M2 checkpoint code review (task 3, phase C)

| Field | Value |
|---|---|
| Task | `2026-10-07_dems_real_capture_sealing` |
| Blueprint row | 55 — `[M2\|checkpoint]` code review, "blueprint §6 per-milestone review rule; E-04/E-30/E-31 and forward-only checks" |
| Reviewer | `senior-code-reviewer` (paid; DR-07 fallback) |
| Date | 2026-10-08 |
| Tier | 2 |
| Mode | READ-ONLY — no production edit, no migration, no DB write, no test mutation |
| Diff basis | `git diff 0024068 -- apps packages masterplan` + untracked new files (197 tracked files changed, +22,319/−8,001; 60 untracked new files) |
| Sources | `identification/02_structured.md` rev 2.1 row 55 + §6; `masterplan/02_plan.md` M2 (§B.1, §D); `masterplan/04_database_contract.md` (dbc-3) §A–§M; `masterplan/03_api_contract.md` (C3); `gateway_check/25_rv_spec_reconciliation.md`; `decisions/decisions.md` D25–D51; `implementation/09,10,11,12,13,14,15,16,17,18,50,51,53,60,61,62,63,64,65,66` |

---

## 0. Verdict

**M2 is READY FOR GATE, with 2 itemised gate items and 1 misclassification to correct.**

No Blocker. No code-correctness Major that breaks the M2 contract. Two Medium items are ruled on
below and must be written into the row-56 gate record (one already carries a fix-forward
recommendation). Everything else is Low or informational. `npx tsc --noEmit` for **both**
`apps/core-server` and `packages/shared` exits **0** (independently re-run this review). No
`.skip`/`.todo`/`.only`/`@ts-ignore` was introduced anywhere in the diff.

| # | Area | Rows | Verdict |
|---|---|---|---|
| 1 | Typed schema v2 (9 tables + value-sets + CHECK swaps) | 45 | **PASS** |
| 2 | Migrations 0004/0005/0006/0007 + journal/snapshots | 46, 112 | **PASS (1 Low)** |
| 3 | Shared domain/contract foundation | 47 | **PASS** |
| 4 | Core API registry + audit + errors + constants | 48 | **PASS (1 Low)** |
| 5 | Mapping + seed + bulk fixture v2 | 49 (+53) | **FINDINGS ROUTED** (CS-20 → §3) |
| 6 | OpenAPI versions + pinned counts | 50, 50a/RECON-C | **PASS** |
| 7 | Simulated v2 parity | 51, 51a | **CAUTION** (SH-10 → F1) |
| 8 | Capture-config module + real-mode fencing | 52 | **PASS (1 Info)** |
| 9 | Lane re-creation v2 + dems_demo reseed | 44, 53 | **PASS (CS-20 residual; 2 locked AVDs user-gated)** |
| 10 | Reset keep-set + `RESET_BLOCKED_REAL_EVIDENCE` guard | 54 | **PASS** |
| 11 | `stt_config` table + 0006/0007 privileges | 112 | **PASS** |
| 12 | `stt_config` seed + kept entry | 114 | **PASS** |

Cross-cutting checks (E-04, E-30, E-31, forward-only, no-skip/no-weaken, duplication,
reference integrity) are reported in §6.

---

## 1. Method and evidence actually produced this run

- Read every source artifact named in the brief and the two adjudication dossiers.
- Re-ran the two type checks that prove cross-module reference integrity:
  - `npx tsc --noEmit -p apps/core-server` → **exit 0**
  - `npx tsc -p packages/shared --noEmit` → **exit 0**
- Static inspection of the shipped code (not only the reports): migrations 0004–0007, the typed
  schema (`schema/capture.ts`, `recording.ts`, `transcript.ts`, `stt.ts`), `value-sets.ts`,
  `reset/kept-tables.ts`, `reset/real-evidence.ts`, `modules/capture-config/*`,
  `core/audit-details.ts`, `db/mapping/rows.ts`, `db/seed/seed.ts`, `db/fixtures/minimums.ts`,
  `test/db/contract-v2-delta.ts`, `test/acceptance/contract.support.ts`, `contract.test.ts`.
- Mechanical greps for the no-skip rule, E-04 reuse, constant duplication, and the OpenAPI pins.
- No test suite, migration or DB command was executed by this review (read-only constraint);
  suite results are taken from the producing rows and cross-checked against static facts
  (op counts, file mtimes, journal, openapi.json content), all of which agreed.

---

## 2. Per-area review

### Area 1 — Typed schema v2 (row 45) — PASS
Nine new tables (T-31…T-39) + T-40 `stt_config`, `FAULT_KIND` at 14, `CAPTURE_DEVICE_KIND`,
`MIC_ROLE`, `STT_BACKEND`, `STT_CREDENTIAL_KIND` in `value-sets.ts`, and the CHECK swaps landed.
Evidence: `schema/{capture,recording,transcript,stt}.ts` present; `value-sets.ts:63` (FAULT_KIND),
`:134` (`CAMERA/MIC/POE`), `:164-166`. The row's NEEDS-REVIEW status was a co-authoring artefact
(consumer-side errors owned by rows 47/49), now resolved — tsc is 0.

### Area 2 — Migrations 0004/0005/0006/0007 (rows 46, 112) — PASS (1 Low)
- Old migrations untouched: `git diff 0024068 -- …/0000_prelude.sql …0003_privileges.sql` is empty
  (**forward-only proven**). 0004 creates the 9 tables + additive ALTERs + FKs/indexes; 0005 revokes
  credential SELECT, adds the SECURITY-DEFINER reveal fn, writes `(2,'dbc-3')`; 0006/0007 mirror the
  pattern for `stt_config`.
- Live application proven by row 53 (lanes + `dems_demo`, journal 8, no-op second run, MG-10).
- **F4 (Low):** `0005_capture_privileges.sql:14` cites a call site
  `apps/core-server/src/modules/capture-config/credential-reveal.ts` and "M2 rows 48 and 52 own that
  code and its static test", but **that file does not exist** (glob of `modules/capture-config/**`
  shows only store/slices/boot/fencing/index + tests) and no capture-config static rule exists at M2
  (row 61/M3 owns the static family; row 66/M4 owns the reveal module). The credential *boundary* is
  real and proven (REVOKE SELECT + SECURITY DEFINER + PUBLIC revoked); only the comment
  over-references future work. Owner: row 46 (comment) / row 66 (module).
- **F7 (Low, observation):** `0005`/`0007` were edited in place at 14:55Z (ASCII-only comment fix,
  RECON-B2b) after they had been applied to *throw-away* DBs but before the row-53 live application
  (18:51Z). Comment-only, live ledger unaffected; still an edit of an applied migration and worth
  recording. No action required.

### Area 3 — Shared contract foundation (row 47) — PASS
Replicated slice count 30 (`state-slices.ts:11`, `REPLICATED_SLICE_NAMES` at `:1030`); capture
slices 29/30 have their own kinds (`:886-1025`); `AdminResource` enum still exactly
`USERS/DEVICES/PAIRING_CODE` (`api/realtime-messages.ts:156`); RBAC gains `CAPTURE_CONFIG` +
`TRANSCRIPT_REVISE` (`sim/auth.ts:48-80`). E-04 satisfied (see §6).

### Area 4 — Core API registry + audit + errors + constants (row 48) — PASS (1 Low)
Registry drift-free at 89 ops (34 GET / 55 POST), 40 error codes, 62 audit types; `audit-details.ts`
adds the nine capture-phase types with exact, secret-free key lists (E-30/E-31 satisfied, §6).
`api/capture.ts` defines the SP-4 pair and the observed-GOP threshold.
- **F5 (Low):** `api/capture.ts:8-9` states "The Core server enforces them through
  `contract-values.test.ts` (CS-25: identity comparisons, not copies)", but that test has **no
  capture section** and no other file (not even M3/M4 code yet) imports any `CAPTURE_*` constant —
  `rg` for the constant names across `apps`+`packages` returns only `capture.ts` itself. So the
  constants are currently dead and CS-25's identity enforcement is not implemented; the docstring
  overclaims. Owner: row 48 (add the enforcement block when the first consumer lands, or soften the
  comment). Not a gate blocker — nothing can drift while there is a single definition.
- **F6 (Low):** `MIC_SILENCE_DBFS`/`MIC_SILENCE_DURATION_MS` are duplicated by value in
  `sim/constants.ts:128-129` and `api/capture.ts:32-34`, deliberately (the sim keeps its own copy to
  avoid a dependency on the API module), but no test pins the two copies equal — the natural home,
  `contract-values.test.ts`, has no capture section. Owner: row 48/51. Drift risk is real but small.

### Area 5 — Mapping + seed + bulk fixture v2 (row 49 + 53) — FINDINGS ROUTED
CS-18 (mapping v2 shapes) and CS-19 (seed 14/22/1/5/0) are complete and verified. CS-20 (§G bulk
minimums) is **not met**: `db/fixtures/minimums.ts` still carries the dbc-2 §11 **30-table** set (no
v2 table appears; `rg` for the six pipeline tables in `fixtures/*.ts` = 0). The 6 v2 pipeline tables
hold 0 rows on all four DBs (row 53 §7.1). This is adjudicated in **§3** and is finding **F2**.

### Area 6 — OpenAPI versions + pinned counts (row 50 + 50a/RECON-C) — PASS
`packages/shared/openapi/openapi.json` is verifiably `version 0.3.0, 89 ops (34 GET / 55 POST)`
(parsed this review). The app-side pins that row 50 flagged were re-pinned by RECON-C:
`live-api-reference-{document,page}.test.tsx` now assert 89 / 0.3.0 / offline 23;
`rbac-matrix.test.ts` was re-pointed at the composed 89-row contract. Only stale header *comments*
("75 operations") remain. Offline 23, versions, counts all match C3 §8.

### Area 7 — Simulated v2 parity (row 51, 51a) — CAUTION
SH-05/06/07/08, dataset SH-09, SC8 retirement (OD-23), live-sim seam (SH-21/25), and 22 sim capture
routes (51a) landed. **F1 (Medium): SH-10 is not closed.** `research/03_analysis.md` defines SH-10 as
"Constants/store: `SIM_SNAPSHOT_VERSION` 1 -> 2; simulated-driver step timing constants", and dbc-3
requires the bump "in the same commit" as `DB_SCHEMA_VERSION = 2`. It is still 1 in all three coupled
sites: `packages/shared/src/sim/constants.ts:24`, the wire literal
`packages/shared/src/api/state-slices.ts:124` (`z.literal(1)`), and the Core mapping
`apps/core-server/src/db/mapping/rows.ts:244`. Row 51 explicitly routed this as an atomic bump "with
rows 48/49/52"; none of those rows landed it, so the deferral fell through. The sealing-driver timing
half of SH-10 did land. Owner: row 51 (with row 48/49 for the atomic bump). The new parity test even
pins the deferred state (`sim-v2-parity.test.ts:57-60`), so the bump cannot land silently — good — but
SH-10 remains an unclosed register row presented as closed.

### Area 8 — Capture-config module + real-mode fencing (row 52) — PASS (1 Info)
Clean 5-file module (530 lines): `store.ts` (one-statement read of `capture_config` +
`capture_devices` + session-open fact, no credential table reachable), `slices.ts` (pure builders,
fail-closed via the contract zod schema), `boot.ts`, `fencing.ts` (mode vocabulary), `index.ts`
(boot step + `WeakMap` control idiom, mirrors `permissionGuard(app)`). No duplication with the sim
(imports `DEFAULT_CAPTURE_*`), no route registration (correctly row 66/M4). **F10 (Info):** the
module is *not mounted* in `app.ts` at M2 (`rg captureConfigModule app.ts` = empty); the plugin is
"exported ready to mount" and row 57/M4-W2 owns the `app.ts` edit, so the boot step is proven only
through the module's unit tests, not through an assembled boot. Consistent with the plan, but the gate
should not claim a live NM-09 boot. `effects.db.test.ts` + the live 409 were deferred by row 52 to
this checkpoint/gate and cannot be run read-only here — route to the row-56 gate.

### Area 9 — Lane re-creation v2 (rows 44 + 53) — PASS (with CS-20 residual)
Row 53 completed the first live v2 transition: three lanes migrated 0004–0007, `dems_demo` migrated +
v2-reseeded with kept tables intact (5 pairings preserved, `pairedAt` row-44 era), M2-LANE-1 asserted
twice (four DBs at `(2,'dbc-3')`, 40 tables, journal 8, lanes answering, one device paired per lane,
blocked-until-redeem demonstrated on lane 3). CS-17/NM-14/CS-02 closed. Residuals: CS-20 (§3) and two
keyguard-locked AVDs (`dems2_phone`/`dems2_tablet`) which are a **user-gated device UAT item**, not a
code defect (agents must not touch device locks). v2 migration correctness on real data is proven.

### Area 10 — Reset keep-set + guard (row 54) — PASS
`kept-tables.ts` carries 12 kept tables in correct FK order (capture trio upsert per D-DB-08, then
`stt_config`, lineage last); `real-evidence.ts` is a pure, fail-safe two-sided guard (DB REAL-sealed
row vs disk REAL package, disagreement blocks) with a SELECT-only preview and audited refusal. Design
correction (guard moved into R-3 start) is sound and documented. Throw-away verification (M2-MT-5/6)
passed in the producing row; live untouched.

### Area 11 — `stt_config` table + privileges (row 112) — PASS
`schema/stt.ts` matches dbc-3 §B.13 (singleton PK, backend CHECK, endpoint-required + loopback CHECK,
language `id`, three-way credential CHECK, GCM envelope floors). 0007 grants column-level SELECT for
all but the three credential columns, UPDATE all columns, no INSERT/DELETE, and a SECURITY DEFINER
`dems_stt_credential_reveal()` with PUBLIC revoked. Live DBs proven untouched. No credential value
seeded or logged.

### Area 12 — `stt_config` seed + kept entry (row 114) — PASS
`seed.ts` writes one `STT_CONFIG_SEED_DEFAULT` row (enabled, `cpu-local`, `ggml-large-v3-turbo`,
language `id`, labelling on, no secret); `kept-tables.ts` 11→12 via `upsert`. Image-equality after a
permitted reset proven twice, including an edited op-91-shaped row. Secret-absent grep clean.

---

## 3. Adjudication 1 — CS-20 §G minimums (six empty v2 pipeline tables)

**Ruling: the six `§G` minimums MUST be produced by the M2 bulk-fixture builder (CS-20). They are
NOT legitimately deferred as "produced by M3/M6/M7". Recommend a dedicated v2-builder fixture row
before the M2 gate; if the controller instead defers, it must be an explicit itemised gate exception,
not a milestone-staging claim.**

Citation and reasoning (dbc-3 §G):

1. **The minimums are a fixture deliverable in the M2 gate set, stated as such.** `04_database_contract.md:777`
   ("Bulk-fixture v2 minimums added to the dbc-2 §11 table (total after seed + fixture …)") introduces
   the table at `:780-794`, which enumerates **all six** pipeline tables —
   `session_audio_intervals` 720 (`:788`), `recording_fragments` 6,500 (`:789`),
   `transcript_chunks` 2,000 (`:790`), `transcripts` 400 (`:791`), `transcript_revisions` 30 (`:792`),
   `sealing_jobs` 3,000 (`:793`). The pass condition is `MT-7` at `:774`: "…the bulk fixture meets
   the G minimums table". `MT-7` is a named **M2** check (`test_strategy.md:135`, `M2-MT-7`), and
   `CS-20` is a register row closed by `M2-W4` (`:842`, `:562`).
2. **The "owning milestone produces the rows" argument answers the wrong question.** M3/M6/M7 produce
   *runtime* fragments/transcripts/sealing rows from real capture/STT/sealing. §G describes a
   *synthetic test dataset* with self-contained mix rules ("contiguous full chains", "≥20 FAILED→rerun
   pairs", "one RUNNING job in the RECOVERY variant", `:789-793`) — none of which requires M3/M6/M7
   code. The builder can synthesise these rows today from the landed schema. That is exactly what the
   `src/db/fixtures/*` module is for.
3. **The fixture is a `dems_test_*` artefact, so the "applied per lane" clause is a separate, and
   mis-cited, question.** `fixtures/target.ts` deliberately refuses lanes/`dems_demo` by name
   (BF-1/TI-13). And `§F` step 4 (`:737`) is **`db:seed`**, not a bulk fixture — the blueprint row 53
   phrase "per-lane bulk fixture (CS-20 at dbc-3 §F step 4)" **mis-cites** §F. So CS-20 is a db-project
   fixture check (run on `dems_test_*`), fully buildable at M2, independent of lane application.
4. **Current state confirms the gap, honestly reported.** `minimums.ts` still holds the dbc-2
   30-table set (`minimums.ts:20`, "revision 2, 30 tables"); the six tables are 0 rows on all four
   live DBs (row 53 §7.1); the only red `bulk-fixture.db` test needs exactly this builder (RECON-B2b
   item 17). Row 53 did **not** clear it — it re-ran the v1 builder and proved the gap.

**Recommendation (routed):**
- Add a **dedicated v2-builder fixture row** (a "row 49b/53b", M2) that revises `BULK_MINIMUMS`/
   `BULK_MIX` to the §G table, adds the six pipeline builders + the revised mixes
   (`evidence_items` 505 all `manifest_version=2`, tracks 1,010 exactly 2/item, `capture_devices` 8,
  credentials 2, alerts 14 kinds), `validate.ts` mix rules, and re-pins the digest/template in
  `build.test.ts`/`bulk-fixture.db.test.ts`. Owner: coder-execution; before the M2 gate (row 56).
- If the controller elects to defer, record it as an **explicit itemised gate exception** for `M2-MT-7`
  (owner + deadline), and correct the record: it is *not* "cleared by row 53" and *not* "legitimately
  produced by owning milestones".

---

## 4. Adjudication 2 — R4 deferral scrutiny (13 `contract.test.ts` + 3 unit)

Method: each failing test was matched to the operation it needs and the operation to its milestone via
`masterplan/03_api_contract.md:161-174` and `masterplan/02_plan.md:189` (the ops' authoritative
milestones). All fourteen ops 76–89 are M4/M5/M6/M7/M8; **none is M2**.

| Deferral (# in `66_recon_core_tests.md`) | Ops needed | Milestone (C3 `:161-174`) | Verdict |
|---|---|---|---|
| Unit 1, 2 — `sessions/routes.test.ts` registry walks | 81 `switchAudioSource`, 82 `listAudioSourceIntervals`, 83 `getSealingProgress` | M5 (`:166`), M5 (`:167`), M7 (`:168`) | **Genuine** |
| Unit 3 — `evidence/routes.test.ts` area walk | 84-88 `getTranscript`/`createTranscriptRevision`/`listTranscriptRevisions`/`getEvidenceExportJob`/`createEvidenceMediaSession` | M6/M8 (`:169`), M7/M8 (`:170`), M7/M8 (`:171`), M8 (`:172`), M8 (`:173`) | **Genuine** |
| Db 4 — AC-B-09 router+guard vs registry | the 14 unrouted ops 76-89 | M4 (`76-80,89`), M5 (`81,82`), M7 (`83`), M6-M8 (`84-88`) | **Genuine** |
| Db 6,7 — AC-B-10 area walks (sessions/evidence) | same 14 (404 before any stage) | later | **Genuine** |
| Db 8,9 — AC-B-14 401/403 walks | same 14 | later | **Genuine** |
| Db 10 — AC-B-14 404/405 walk | op 76 `DELETE /capture/config` 405 needs the POST route (row 66/M4) | M4 | **Genuine** |
| Db 11 — AC-B-14 DEMO/NOT_PERMITTED every-role walk | unrouted 76/77/89, 84/86/88 | M4/M6-M8 | **Genuine** |
| Db 12 — AC-B-09 SR-20 every-GET walk | unrouted GETs 76/77/82/83/84/86 (+87-class) | M4/M5/M7/M8 | **Genuine** |
| Db 13 — AC-B-93/API-13 free-text members | op 78 `cameras[]/mics[]` (M4/row 66), op 81 body (M5) | M4/M5 | **Genuine** (base members pass; only later-milestone members fail) |
| Db 14,15,16 — SC6 ledger/error-code/coverage blocks | input = the 404 answers of the deferred walks | later | **Genuine** (deferring the block, not stuffing `NOT_PRODUCED`) |
| **Db 5 — committed-openapi walk** | route walk needs the same 14 ops | later | **MIXED — misclassified** |
| Db 17 — `bulk-fixture.db` minimums | CS-20 builder | **M2** | **Not a later-milestone deferral** → §3 |

**Detail on the one that should be corrected at M2 (Db 5).**
`contract.test.ts:428-451` still asserts `expect(documented).toHaveLength(75)` (`:437`) and
`expect(committed.info.version).toBe('0.2.1')` (`:448`). The artifact's justification — "the committed
openapi.json … MUST NOT be edited in this lane … still lists 75" (`66_recon_core_tests.md:291-293`) —
is **factually wrong**: row 50 already regenerated `packages/shared/openapi/openapi.json` to
**89 ops / version 0.3.0** (parsed this review), and the stale literals live in the *core-server* test
file, which is editable in this lane. The *route comparison* (`:436`, router 75-registered vs
documented 89) is genuinely blocked by the 14 later-milestone routes, so the test correctly cannot be
green at M2 — but the reason stated is wrong and two stale M2 pins were left in place instead of being
re-pinned exactly as the sibling test at `:374-390` was (75→89, GET 27→34, POST 48→55).
**Recommendation:** re-pin `:437`→89 and `:448`→`0.3.0` with an explanatory comment, and record the
residual failure only as the 14-routes walk (same class as Db 4). Owner: RECON-B2b (row 66) / row 49.

**Net R4 verdict:** 12 of 13 `contract.test.ts` failures + all 3 unit failures are **genuine
later-milestone route/handler walks — correctly deferred** (and the `DEFERRED_ROUTE` naming test in
`rbac-matrix.test.ts` makes the exclusion drift-guarded, not silent). 1 (`contract.test.ts` #5) is a
stale-pin M2 cleanup mislabelled as a frozen-doc deferral. The bulk-fixture Db failure is CS-20 (§3).

---

## 5. Adjudication 3 — media-profile CODE spelling erratum

**Ruling: yes, an erratum is required, and the canonical spelling is the underscore form
`H264_1080P25`.**

- The non-conforming value is the shared sim constant
  `packages/shared/src/sim/initial-state.ts:84` → `CAPTURE_PROFILE_1080P25 = 'H264-1080P25'` (hyphen).
- C3 §1 (`masterplan/03_api_contract.md:384`) states "Every machine code is `SCREAMING_SNAKE_CASE`",
  and dbc-3 §B.1 marks `video_01_profile`/`video_02_profile` as "format `CODE`" (`:205`, `:207`). The
  0004 CHECK `^[A-Z][A-Z0-9_]{0,63}$` correctly enforces that; a hyphen cannot be a `CODE`.
- Consequence today: the wire/slice carries `H264-1080P25`, the DB/seed stores `H264_1080P25`
  (`seed.ts` `CAPTURE_SEED_PROFILE`), and `db/mapping/rows.ts:620-626` bridges the two
  (`STORAGE_PROFILE_OF` + a `replace(/-/g,'_')` fallback).

**Recommendation:**
- File a C3/dbc-3 erratum standardising the profile `CODE` on `H264_1080P25` and correcting any
  hyphen example; fix `initial-state.ts:84` to the underscore form (owner: data-analyst for the doc,
  row 51/66 for the constant).
- Once the constant is corrected, shrink the B2a mapping bridge to the single exact pair (and drop the
  blanket `replace(/-/g,'_')` fallback, which silently normalises *any* hyphenated code rather than
  failing closed — see F8). Non-blocking for the M2 gate; the bridge makes the current tree coherent
  under either ruling.

---

## 6. Cross-cutting checks

**E-04 — capture must not reuse `AdminResource.DEVICES`.** PASS. The enum is exactly
`USERS/DEVICES/PAIRING_CODE` (`api/realtime-messages.ts:156`); the paired-client registry stays what
it was. Capture state gets its own slice kinds 29/30 (`state-slices.ts:886-1025`) and its own
`captureConfig`/`captureDevices` realtime kinds (`:988-990`, `:1024-1025`). All non-comment
`AdminResource.*` references are the pre-existing paired-client/admin paths
(`realtime/hub.ts:471`, `realtime/messages.ts:148`); the only capture-adjacent mentions are comments
asserting the negative (`schema/capture.ts:29`, `sim/types.ts:603,1085`). Row 47's claim of 0 capture
uses holds.

**E-30 — audit rules (camera-credential refusals audited; switch carries the sending device ID).**
PASS for the M2 half. `core/audit-details.ts` adds the nine capture-phase types with exact key lists
and 0 secret keys (`CAPTURE_CONFIG_CHANGED`, `AUDIO_SOURCE_SWITCHED` incl. `sendingDeviceId`,
`CAMERA_POE_CYCLED`, `TRANSCRIPT_REVISED`, `MIC_SILENT`, …). The device-ID-in-audit requirement
reaches full behaviour at M5/M8; the M2 registry + detail-key surface is correct and the `B4`
credential-refusal audit rules are present.

**E-31 — credential-shaped values in both log-blanking lists.** Partial by design: the M2 half is the
audit detail-key lists (above) and the forbidden-key list extension to 28 keys (0004 `:214-215`,
0006; `contract-inventory` denied-keys 17→28). The web error sink / mobile `runtime/log.ts` blanking
lists are M8 scope (rows 90-92) and are not expected at M2. No secret key exists in any new M2 list.

**Forward-only rule.** PASS. Migrations 0000–0003 are byte-identical to the baseline; v2 is additive
as 0004–0007; live application happened after the 0005/0007 ASCII comment fix (see Area 2/F7). No
existing migration was rewritten to express v2.

**No-skip / no-weaken rule.** PASS at the diff level. `rg` over the whole diff and the new test files
for `.skip`/`.todo`/`.only`/`xit`/`@ts-ignore`/`eslint-disable` = 0 hits. The R4 failures were *left
failing* (not skipped), and the `rbac-matrix.test.ts` `DEFERRED_ROUTE` exclusion is paired with a
naming test that pins the excluded set exactly, so a landing route forces a re-pin. The pins RECON
touched were re-pointed to *derived* values (e.g. `GRANT_TOTAL`, `EXPECTED_SEED_COUNTS`,
`INITIAL_MIGRATION_TAGS`, `DEVICE_COMMAND_OPERATIONS` distinct-operation count) — strengthening, not
weakening. The one place a stale assertion was left rather than re-pinned is `contract.test.ts` #5
(§4) — an over-strict stale pin, which is safe, not a weakened one.

**Duplication detection.**
- No structural duplication in application code: `capture-config` imports the sim `DEFAULT_CAPTURE_*`
  rather than copying; the two privilege migrations (0005/0007) and the two SECURITY-DEFINER reveal
  functions are near-parallel but operate on different tables (acceptable, and each is a single
  grant/fn line).
- `test/db/contract-v2-delta.ts` (1,481 lines) is a **hand transcription of the dbc-3 delta** — a
  third copy of the schema shape alongside the typed schema and the migration SQL. It is a deliberate
  R1 artefact (the closed task-2 contract must not be edited) and the drift risk is contained:
  `catalog.db.test.ts` compares the composed inventory to the **live** catalog, and
  `contract-inventory.test.ts` compares it to the typed schema. **F-dup (Low):** maintenance burden;
  acceptable given R1.
- **F6 (Low):** `MIC_SILENCE_DBFS`/`_DURATION_MS` duplicated by value across `sim/constants.ts` and
  `api/capture.ts` with no equality pin (see Area 4).

**Reference integrity.** PASS. Independent `tsc` exit 0 for both workspaces; the one symbol B2a
found broken (`contract.DEVICE_COMMAND_OF_OPERATION`) was correctly re-pointed to the landed
`apps/core-server/src/modules/devices/operations.ts` symbol and the contract-derived count. No
dangling import, type or cross-module reference found.

---

## 7. Findings

| # | Sev | Domain | File:Line | Finding | Owner / recommendation |
|---|---|---|---|---|---|
| F1 | 🟡 Medium | Sim parity / contract | `sim/constants.ts:24`; `api/state-slices.ts:124`; `db/mapping/rows.ts:244` | SH-10 `SIM_SNAPSHOT_VERSION` 1→2 (dbc-3 "same commit") not landed; still 1 in all three coupled sites. Row 51's routed atomic bump fell through rows 48/49/52 | Row 51 (+48/49): land the atomic bump before the gate, or record SH-10 as an itemised gate exception |
| F2 | 🟡 Medium | Seed/fixture | `db/fixtures/minimums.ts:20`; `04_database_contract.md:774,780-794` | CS-20 §G minimums for the 6 pipeline tables unmet; builder absent; `M2-MT-7` red | Dedicated v2-builder fixture row before the gate (§3) |
| F3 | 🟡 Medium | Recon classification | `test/acceptance/contract.test.ts:437,448` | Deferral #5 justified as "openapi frozen at 75"; openapi.json is actually 89/0.3.0; stale M2 literals left. Route walk is genuinely later-milestone, but the pins are an M2 cleanup | RECON-B2b/row 66 + 49: re-pin to 89/0.3.0; correct the record (§4) |
| F4 | 🟢 Low | Migrations (comment) | `0005_capture_privileges.sql:14` | Comment cites a nonexistent `capture-config/credential-reveal.ts` and false ownership ("rows 48/52 own … its static test") | Row 46 (comment) / row 66 (module) |
| F5 | 🟢 Low | API constants | `packages/shared/src/api/capture.ts:8-9` | Docstring claims `contract-values.test.ts` enforces the capture constants; no such block exists; constants have 0 consumers; CS-25 enforcement unimplemented | Row 48 |
| F6 | 🟢 Low | Duplication | `sim/constants.ts:128-129` vs `api/capture.ts:32-34` | `MIC_SILENCE_*` duplicated by value with no equality guard | Row 48/51 |
| F7 | 🟢 Low | Forward-only (obs.) | `0005_*`, `0007_*.sql` (mtime 14:55Z) | In-place ASCII edit of already-throw-away-applied migrations; live-safe (pre-live), comment-only | Record only; no action |
| F8 | 🟢 Low | Mapping | `db/mapping/rows.ts:626` | `profile.replace(/-/g,'_')` fallback silently normalises any hyphenated code; B2a's "fail-closed on unknown codes" holds only if the rewritten form fails the `CODE` regex | Row 65/B2a (§5) |
| F9 | ⓘ Info | Blueprint text | row 54 ("11 kept tables"), row 53 ("per-lane bulk fixture … §F step 4") | Landed state is 12 kept tables; §F step 4 is `db:seed`, not a bulk fixture | Controller/task-architect text refresh |
| F10 | ⓘ Info | Config module | `app.ts` (no `captureConfigModule`) | Module not mounted at M2; boot step unit-proven only; registration owned by row 57/M4-W2 | Note in the gate; no action |

No **Blocker** or code-correctness **Major** found. 0 open Blocker/Major before the M2 gate, per the
row-55 acceptance clause.

---

## 8. Overall gate-readiness recommendation

**M2 ready for gate (row 56).** The schema, migrations, shared contract, API registry, OpenAPI pins,
capture-config module, lanes, reset guard and the STT table/seed/kept areas all pass review, with
forward-only and E-04/E-30/E-31 satisfied and no skips or weakened assertions introduced.

Two items must be recorded explicitly in the row-56 gate rather than silently absorbed:

1. **CS-20 / `M2-MT-7` (§3):** the six §G pipeline-table minimums are an **M2 fixture deliverable** —
   recommend a dedicated v2-builder fixture row **before the gate**. If deferred, it must be an
   itemised gate exception (owner + deadline), and the record must state it was *not* cleared by row 53.
2. **SH-10 / `SIM_SNAPSHOT_VERSION` (F1):** either land the atomic 1→2 bump (constant + wire literal +
   mapping) or record SH-10 as an itemised gate exception.

One correction to the recon record: **F3** — `contract.test.ts` #5 is a stale-pin M2 cleanup
mislabelled as a frozen-document deferral; re-pin to 89/0.3.0 and keep only the 14-route walk as the
true deferral.

Everything else is Low/Info and can be fixed alongside the owning milestone or the M2 close-out.

---

*Generated: 2026-10-08 — senior-code-reviewer, row 55 (read-only).*
