# Row V7d - status: complete (2026-10-14)

Decision C141 / C126 (b); request lines 567, 568 closed. Record: `implementation/v7d_op44_not_read.md`.

- Op 44 / 46: `VideoTrackStatusSchema.streamState` nullable (`packages/shared/src/api/core-api.ts:424`); both builders `slot?.streamState ?? null` (`shared/src/sim/api.ts:424`, `core-server/src/modules/devices/status.ts:238`). Built-in demo cameras unchanged (their lines carry the model's LIVE).
- `capture-config/slices.ts:139`, `:178`: built-in by `enabled`, else null (`streamStateAtRest`, :80).
- Sweep: one more flag-derived LIVE fixed - `shared/src/sim/capture-notices.ts:316` `withDeviceOnline` (a check reads the control service, not the stream): registered camera null after a clear, ingest LIVE and fault LOST kept. Others verdicted correct (record section 3).
- Mutations M1-M7b RED, reverted. Checks: shared 184/184 after regen (+1292 before, 2 drift reds pre-regen), tsc 0, oxlint 0; OpenAPI regenerated (110 ops; only streamState schema + 3 descriptions); Core unit 708 + 156 (loopback under the heavy lock); Core db 98/98; Core tsc only N13's 9; web / mobile tsc 0.
- Request: one line to W6. Edit tool only for existing files.
