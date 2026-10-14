# Row E1 (wave 12) - status: needs-review

- Record: `implementation/e1_slice_stream_state.md`.
- No product file written. `modules/capture-config/slices.ts` builds a boot-time snapshot only (`index.ts:120`; one caller `store.ts:202-203`; one non-test reader, the boot log). Clients read the engine's slices: built by `db/mapping/rows.ts:898, :961`, changed by the transitions of `packages/shared/src/sim/capture-telemetry.ts`. Finding E-01 cannot be closed in the owned file.
- Mapping by reading: fault -> `LOST`; recording without fault -> `LIVE`; idle -> `LIVE` on the selector line (no idle member, not nullable), `null` on the registry entry of an adopted camera.
- Requests (file_requests.md, three lines): N2 - the fault transitions set / restore `streamState`; owner of rows.ts - the rest state; N2 - nullable selector `streamState` or a "not read" member; W5 - nothing changed, its reader rule stays the only line.
- For the controller: `LOST` makes a PoE cycle legal (OD-22); the simulator shares the transitions.
- DRIVER DECISION DD-E1-1: no unobservable edit of slices.ts.
- Checks: slices.test.ts unedited `23 passed (23)`; `git status` of the module empty. Other suites not run (no change).
- Edit tool only for existing files: kept.
