# Delegation progress — data-analyst, blueprint row 29 (API contract C3)

| Field | Value |
|---|---|
| Row | 29 (class B, milestone M0, tier 1) |
| Agent | data-analyst-local |
| Status | **COMPLETE** (self-gate passed; 4 open items carried to the M0 gate, none blocking) |
| Started / finished | 2026-10-07 16:40 / 2026-10-07 16:58 (WIB) |
| Output (only file produced besides this one) | `docs/2026-10-07_dems_real_capture_sealing/masterplan/03_api_contract.md` |

## What was produced

`masterplan/03_api_contract.md` — API Contract C3: **13 new operations (76-88)**, **24 modified
operations** of the existing 75 (22 rows), **7 new error codes**, **7 new audit types with exact
detail-key lists**, **2 new realtime slices (28 → 30)**, **10 contract constants (CS-25)**,
OpenAPI version plan (`all` → 0.3.0, `offline` → 0.2.0), non-goals and self-gate.

## Inputs read (Source of Truth first)

| Order | File | Use |
|---|---|---|
| 1 | `identification/02_structured.md` | row 29 verification gate; §3.1 count; §6 milestones |
| 2 | `identification/01_translated.md` | gate answers in force (via decisions) |
| 3 | `research/03_analysis.md` | register: SH/CS/WB/MB/NM/DOC rows, §C gate mapping, §A errata |
| 4 | `masterplan/01_specs.md` | phase spec (sections A-H, D decisions-superseded) |
| 5 | `decisions/decisions.md` | D4 gate answers OD-01/09/10/15/17/22; D7/D8/D10/D12 |
| 6 | `research/02_collection.md` | CENC facts (F-47/F-52/F-102), audit facts |
| 7 | `packages/shared/src/api/*.ts` | contract conventions, access/audit model, slices, versions (read-only) |
| 8 | `apps/core-server/test/acceptance/contract.test.ts`, `rbac-matrix.test.ts`, `contract-values.test.ts`, `apps/core-server/src/core/audit-details.ts`, `.../devices/operations.ts` | conventions + pinned counts + audit allow-list + command map |
| 9 | `docs/2026-10-04_dems_backend_rbac_pairing/masterplan/01_specs.md` §7/§13 | predecessor style, formality |
| 10 | sibling peers `masterplan/05_capture_architecture_spec.md` (row 31), `07_transcript_spec.md` (row 33) | align op name `switchAudioSource`, constants, revision record |

## Self-gate results (also in the document §10)

| Gate (structured row 29) | Result |
|---|---|
| Method + path + access + audit for every new/modified op | **13/13 new**, **24/24 modified** |
| Total operation count stated | **75 + 13 = 88** (projected 34 GET / 54 POST) |
| `AdminResource.DEVICES` used for capture | **0** (literal grepped; prohibition written in the repo's bracketed form `AdminResource.DEVICE[S]`) |
| New audit types with exact detail-key lists, 0 secret keys | **7/7** (`CAPTURE_CONFIG_CHANGED`, `AUDIO_SOURCE_SWITCHED`, `CAMERA_POE_CYCLED`, `TRANSCRIPT_REVISED`, `MIC_SILENT`, `EVIDENCE_MEDIA_SERVED`, `EVIDENCE_EXPORT_FAILED`) |
| Six gate answers cited by decision ID | **6/6** (OD-01, OD-09, OD-10, OD-15, OD-17, OD-22, all `D4`) |
| W1-C7 not repeated | no `--maxWorkers`/`--poolOptions` claim |

## Grep evidence

```
$ grep -c "AdminResource\.DEVICES" masterplan/03_api_contract.md
0
$ grep -n "AdminResource\.DEVICE\[S\]" masterplan/03_api_contract.md
455, 470, 565, 581   # the E-04 prohibition, bracketed form
```

## Open items carried to the M0 gate (row 39) — none blocking

1. **Path spelling.** `register SH-13` and sibling `capture-spec §E` write
   `/api/v1/sessions/{id}/audio-source` (plural); area-4 paths are singular
   (`sessions.ts:132`). C3 normalizes to singular and flags the erratum.
2. **Fragment quantum (S1 SP-4).** `CAPTURE_GOP_FRAMES`/`CAPTURE_FRAGMENT_TARGET_MS` is a contract
   constant **with an open decision** (`capture-spec §C.1`); row 39 confirms.
3. **`offline` visibility.** Ops 76-87 are `mode: simulated` only if the shared simulator emulates
   them in M2 (OD-17); row 39 re-checks.
4. **`SESSION_HOLDER` condition.** Proposed addition to `CoreApiAccessCondition`; not yet in
   `contract-model.ts`; M2 adds it.

## Register rows not satisfiable in this row

None. Every register row mapped to row 29 (SH-03/04/12/13/14/16/19/25, CS-04/06/07/12/14/22/25,
NM-06/07/09/10/11/12, WB-04/09/11, MB-07/09, E-04/E-12/E-30/E-31, W1-C1/C7/C9/C10) is addressed in
the contract; the code edits they need are M2 steps, stated as such.

## Files touched

- Created: `masterplan/03_api_contract.md`
- Created: `delegation_progress/data-analyst__row29.md`
- No file outside the task folder was edited.
