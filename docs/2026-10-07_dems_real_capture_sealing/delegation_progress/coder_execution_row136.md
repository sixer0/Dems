# coder-execution - row 136 (`LOCAL_DEVICE` adapter kind + development boot fence, R-11)

Status: needs-review. The fence, the registration, the builder and the pins are built and green;
four items need the controller (see "Decisions for the controller"). Note:
`implementation/67_r11_local_device_kind.md`.

## Files created
- `apps/core-server/src/capture/fence/`: `operation.ts`, `boot.ts`, `statements.ts`,
  `registration.ts`, `generated-sources.ts`, `sources.ts`, `index.ts`;
  `__tests__/fence.test.ts`, `__tests__/fence.db.test.ts`, `__tests__/support.ts`.
- `scripts/capture/dev-setup.mjs`.
- `docs/.../implementation/67_r11_local_device_kind.md`, this file.

## Files changed
- `apps/core-server/src/config.ts` (P25 edits 15-18, waived by D108 (b): +24 lines).
- `apps/core-server/src/capture/__tests__/static.test.ts` (P25 pin extended; file pins; G-R2 /
  G-R8 allowlists; new G-R12, G-R14, G-R15, SEC35-41 (c) blocks; one import line).
- `apps/core-server/src/capture/adapters/__tests__/static.test.ts` (file-list pin: 14 `local/` files).
- `apps/core-server/src/capture/adapters/local/index.ts` (microphone exports, row 135's request),
  `local/camera-helper.ts` (option `source: 'GENERATED'`),
  `local/__tests__/mic-helper.generated.test.ts` (line 176: names spelled from parts).
- `apps/core-server/src/capture/index.ts` (+19: mounts the fence, hands in the log sinks).
- `apps/core-server/src/plugins/config/load-config.ts` (+9: reads the two keys).
- `package.json` (root): script `capture:dev-setup`.
- `docs/.../delegation_progress/file_requests.md`: 8 appended lines.
- Outside git: `.data/helpers/` now mode 0700, `ffmpeg` copy replaced (0755).

## Not touched
`packages/shared/**`, `db/**`, migrations, `apps/capture-worker/**`, `app.ts`, `index.ts`,
`modules/capture-config/**`, `adapters/kinds.ts`, any UI. No device opened. No commit, no lockfile.

## Results
- unit `fence.test.ts` 45/45; db `fence.db.test.ts` 13/13 (twice); capture static guard 46/46.
- core-server typecheck 0 errors; lint 0 findings in this row's files.
- Red and not this row's: `adapters/__tests__/static.test.ts` A-5 (held for the integration pass),
  `adapters/__tests__/credential.test.ts` canary (`endpointRef` audit keys, rows 132 / 142),
  `engine/__tests__/capture-actions.db.test.ts` A-4 (stops at `transcriber.config`),
  `modules/rbac/__tests__/matrix.db.test.ts` x2.
- Rule broken once, by mistake: the whole db project ran one time (an empty file list in an
  unsandboxed shell). Its result is in the note, §4 item 8.

## Decisions for the controller
1. Boot audit row in `SIMULATED`: not written (25 closed restart tests fail with it). Ruling wanted.
2. `MicInputId` admits `MIC-01` / `MIC-02` only: the local microphone `MIC-03` cannot be assigned
   (boot stops at `engine.rehydrate`). Blocks row 140's microphone slot.
3. Two-line wiring in `modules/capture-config/index.ts` so that ops 78 / 79 ask the registry.
4. Edits of two files outside the ownership map (`capture/index.ts`, `plugins/config/load-config.ts`):
   review.
