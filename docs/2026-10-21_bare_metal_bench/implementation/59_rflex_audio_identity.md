---
task_id: 2026-10-21_bare_metal_bench
row: 107 (R2.1)
agent: coder-execution
date: 2026-10-22
status: complete
spec: masterplan/01_specs_rflex_audio.md §3, §4, §7, §10 (T-1..T-5); masterplan/01_specs_rflex.md RF-A1, RF-A5; Q96-03 (i)+(iii), Q96-09 (treat as no serial)
narrative_tier: 3
---

# Row 107 - runtime USB audio identity without a port lock

## Change
- `apps/core-server/src/capture/adapters/audio/usb-audio-production.ts`
  - `CardMismatch` (:282-293): `PORT_DIFFERS` (RM-A1) and `IDENTITY_NOT_STORED` (RM-A3) removed; `MODEL_SHARED` (AU-R2) added (:291).
  - `identifyRegisteredCard` (:337-365): the "no serial AND no port -> CARD_UNIDENTIFIED" branch is gone (such a row is "no serial"). No serial stored: the one unit of the model that states no serial, on any port (:359-364); none -> `CARD_CHANGED`/`SERIAL_DIFFERS`; two or more -> `CARD_AMBIGUOUS`/`MODEL_SHARED`. Serial branch unchanged (stored port stays only the `SERIAL_SHARED` tie-break).
  - Doc comments updated: file header (:19-28), `CARD_CHANGED`/`CARD_AMBIGUOUS`/`CARD_UNIDENTIFIED` (:85-105), the rule table (:299-333), the start re-check comment (~:766). The open->start re-check (`CARD_MOVED`, same serial/port/index as the open) is unchanged: it guards one handle, not the stored port.
- Mic-loss watch uses the same function (handed in); no code change in `mic-loss.ts` or `usb-audio-macos.ts`.
- NEW `apps/core-server/test/support/stored-card-identity-cases.ts`: T-1 shared case table (15 cases, data only, no imports), with runtime and registration (`StoredCardMatch` word) outcomes. Includes the BOMGE case (3347:2430, no serial, stored port 1-1, live 1-2 -> opens, renamed false). Row 131 runs the registration column against `matchStoredCard`.

## Tests
- `usb-audio-production.test.ts`: T-1 `it.each` over the table (:710); BOMGE/T-2 (:565); T-5 (:580); row-200 cases rewritten (port move now opens; serial-appeared still refused; pre-column row read as no serial; start after a swap -> `CARD_MOVED`); twin test (:455) now uses serials + MODEL_SHARED; admitted-device test (~:990) uses SERIAL_DIFFERS. `grep -c PORT_DIFFERS` = 0.
- `macos-card-listing.test.ts`: T-3 (:865) moved card -> `ok, renamed: true`, two serial-less -> MODEL_SHARED; pre-column row test -> matches/absent; `PORT_DIFFERS` line -> serial case.
- `mic-loss.test.ts`: T-4 (:269), T-5 (:286).
- `real.test.ts`: names no port rule; not edited.

| Command | Result |
|---|---|
| `npm test -w @dems/core-server -- src/capture/adapters/audio/__tests__/usb-audio-production.test.ts --maxWorkers=2` | Tests 62 passed (62) (incl. 15 "T-1 shared case") |
| `npm test -w @dems/core-server -- src/capture/adapters/audio/__tests__/macos-card-listing.test.ts --maxWorkers=2` | Tests 44 passed (44) |
| `npm test -w @dems/core-server -- src/capture/adapters/audio/__tests__/mic-loss.test.ts test/static/test-support-imports.test.ts --maxWorkers=2` | Tests 30 passed (30) |
| `npm test -w @dems/core-server -- test/static/test-support-imports.test.ts` | Tests 2 passed (2) |
| `grep -rn "PORT_DIFFERS\|IDENTITY_NOT_STORED" apps/core-server/src/capture apps/core-server/test` | 0 lines |
| `lockf heavy-host.lock npm run typecheck -w @dems/core-server` | exit 2: 2 errors, both in `src/modules/capture-inputs/audio-cards/service.ts` (:299 `boundTo` missing, :533 `releasedDeviceId` missing) - shared-API change of row 99, owned by row 108/131; 0 errors in row 107 files |

## Deviations / notes
- Typecheck exit 0 not reachable by this row: remaining reds are outside its ownership (rule 8).
- `StoredCardMatch.PORT_DIFFERS`/`IDENTITY_NOT_STORED` in service.ts remain for row 131 (not touched).
