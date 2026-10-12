# File ownership - track D

Source of truth: the Ownership Area column of `identification/03_implementation_blueprint.md` (Execution Profile) and its section 7 (single-writer resources). This file records rulings and the batches.

## Batch 1 (2026-10-12 22:30) - rows 2, 3, 4, 27, 87, 103, 160 (docs only), 13, 20, 95, 147 (code)
| Row | Owner area |
|---|---|
| 13 | one unit test in the capture area of apps/core-server (executor declares) |
| 20 | apps/core-server/src/capture/adapters/types.ts |
| 95 | NEW under apps/core-server/src/capture/: destination rule (+ its test) |
| 147 | apps/core-server/src/capture/adapters/credential.ts (+ its test) |
No overlap. Held back for load (1-minute load about 10 at launch, another session active): heavy rows 6, 10, 12, 39; database row 17; single-writer rows 19, 63.
