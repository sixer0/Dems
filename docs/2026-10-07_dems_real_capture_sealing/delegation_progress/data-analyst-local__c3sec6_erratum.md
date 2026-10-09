---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-08
agent: data-analyst-local
blueprint_row: 47
blueprint_rev: 2.1
phase: C
milestone: M2
class: DOC-ONLY erratum (routed from row 47 finding, D31)
type: doc-sync (Tier 3, single-token vocabulary correction + one-line erratum note)
status: complete - EDIT APPLIED
file_touched: masterplan/03_api_contract.md (only)
verification: no stray MICROPHONE capture-kind token in C3; kinds read CAMERA/MIC/POE; operation/endpoint/slice counts unchanged (git diff confined to 2 hunks in section 6)
last_updated: 2026-10-08 05:25
---

# C3 §6 erratum — capture-device kind vocabulary (progress)

## Status

**COMPLETE — DOC-ONLY.** No code, no tests, no controller trackers touched. Only
`masterplan/03_api_contract.md` was edited. The change aligns the `captureDevices` slice
kind vocabulary in §6 to the DB-authoritative set.

## What was wrong

§6 "Realtime slices 28 -> 30", payload shape-summary table, row 30 (`captureDevices`) listed
the capture-device kind as `CAMERA|MICROPHONE`. That label is not in the normative DB vocabulary
and cannot represent `POE-SWITCH` at all.

## Authoritative source (why the DB set wins)

- `masterplan/04_database_contract.md` (dbc-3) §B.2 `capture_devices`: `kind` column carries
  `CHECK IN ('CAMERA','MIC','POE')`.
- Row 45 (`implementation/10_m2_schema_check.md`) authored that CHECK; live schema confirms it:
  `apps/core-server/src/db/schema/value-sets.ts:134` `CAPTURE_DEVICE_KIND = ['CAMERA','MIC','POE']`
  and `apps/core-server/src/db/schema/capture.ts:54` id-prefix/kind check (`CAM`/`MIC`/`POE`).
- Row 47 (`implementation/14_m2_shared_contract.md` D-c-2) already implemented the DB set and
  flagged C3 §6 as needing this erratum; the controller routed it here (D31).

## Edit applied

1. §6 table row 30: `kind: CAMERA\|MICROPHONE` -> `kind: CAMERA\|MIC\|POE`.
2. Added a one-line erratum note at the end of §6 citing that the DB CHECK (dbc-3 §B.2) is
   normative and this aligns C3 §6 to it, with source = row 47 finding, D31. The note describes
   the prior label without re-introducing the stray `MICROPHONE` token.

Kind-vocabulary wording only. Slice count (28 -> 30), the "two replicated slices" sentence, the
row numbering (29/30), and every operation/endpoint count elsewhere in the file are untouched.

## Verification (quoted)

- `rg -n "MICROPHONE" masterplan/03_api_contract.md` -> no matches (was line 599).
- §6 row 30 now reads `{ devices: [{ id, kind: CAMERA\|MIC\|POE, ... }] }`.
- `git diff --stat` on the file: `1 file changed, 5 insertions(+), 1 deletion(-)` — two hunks, both
  inside §6 (the row-30 line, and the appended erratum paragraph). No other section modified.
- Counts re-checked intact: `## 6. Realtime slices 28 → 30`, `adds **two** replicated`,
  `snapshot becomes 30 names` all present and unchanged.
- Repo-wide `git status` shows other files modified, but those are pre-existing working-tree state
  from rows 46/47/etc. — none were touched by this task. Only `03_api_contract.md` was written here.

## Diff (exact)

```diff
@@ -596,7 +596,7 @@ snapshot becomes 30 names.
 | # | New slice | Delivery | Payload (shape summary) | Published by | Read by (client) |
 |--:|---|---|---|---|---|
 | 29 | `captureConfig` | replicated | `{ cameras: [{ trackId, deviceId, profile, online, streamState }], mics: [{ inputId, deviceId, role, transport, online }], locked: boolean, updatedAt: epochMs }` | ops 78/79/80 (and 81 for `activeInputId` adjacency) | web WB-05/WB-02/WB-11; tablet/phone MB-08/MB-09 |
-| 30 | `captureDevices` | replicated | `{ devices: [{ id, kind: CAMERA\|MICROPHONE, model, firmware, host, poePort, online, streamState, capabilities }] }` | supervisor telemetry (`applyCaptureTelemetry`, `register SH-18`) | web WB-05/WB-11; mobile MB-08/MB-09 |
+| 30 | `captureDevices` | replicated | `{ devices: [{ id, kind: CAMERA\|MIC\|POE, model, firmware, host, poePort, online, streamState, capabilities }] }` | supervisor telemetry (`applyCaptureTelemetry`, `register SH-18`) | web WB-05/WB-11; mobile MB-08/MB-09 |

@@ -613,6 +613,10 @@ show the input levels and which is active (`register SH-17`; `live-sim.ts:902-90
 site, `SH-25`; coordinate with DR-1, OD-26). This is the E-02 correction. No new message type is
 added: `meters`, `state`, `delta` and the control messages are unchanged (`realtime-messages.ts`).

+**Erratum (capture-device kind).** The `captureDevices` kind vocabulary above previously used a
+long-form audio label outside the DB set; it now reads `CAMERA|MIC|POE`, aligned to the normative DB
+CHECK `capture_devices_kind_check` (`dbc-3 §B.2`: `CHECK IN ('CAMERA','MIC','POE')`, authored by row 45) — source: row 47 finding, D31.
+
 ---

 ## 7. Constants in `@dems/shared/api` (CS-25)
```

---
*Generated: 2026-10-08 05:25*
