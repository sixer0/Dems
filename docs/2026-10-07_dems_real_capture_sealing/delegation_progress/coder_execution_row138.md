# coder-execution — row 138 (tablet / phone Devices delta, R-9 / R-10 / R-11)

Status: **needs-review** — software complete; device flows F1-F6 and decisions 1-3 of the note are open. Date 2026-10-09. No commit.

Note: `implementation/69_r9_mobile_devices.md`.

## Files (under `apps/mobile/src/`)

New, `features/capture-selector/`: `camera-search-model.ts`, `capture-notices-model.ts`, `capture-discovery-port.ts`, `use-camera-search.tsx`, `camera-search-panel.tsx`, `capture-notices.tsx`, `mic-rescan.tsx`, `development-source-badge.tsx`; tests `camera-search-model.test.ts`, `capture-notices-model.test.ts`, `camera-search.test.tsx`, `capture-notices.test.tsx`, `precheck-capture-notices.test.tsx`, `development-source.test.tsx`, `no-credential-inputs.static.test.ts`.

Edited, same folder: `capture-selector.tsx`, `capture-selector-model.ts`, `use-capture-selector.ts`, `capture-source-sheet.tsx`, `settings-capture-section.tsx`, `i18n.ts`; tests `capture-selector.test.tsx`, `capture-selector-model.test.ts`, `camera-clock-card.test.tsx`, `settings-capture-section.test.tsx`.

Edited elsewhere: `features/devices/{devices-screen.tsx,device-row.tsx,device-detail.tsx,testing/live-devices-bed.tsx}`, `features/session-new/devices-check-step.tsx`, `features/dashboard/home-header.tsx`, `runtime/sim-adapters.ts`, `runtime/sim-adapters.test.ts`.

Docs: `delegation_progress/file_claims.md` (2 lines), `file_requests.md` (1 line: badge mount on Session Live / Home tiles).

## Results

- typecheck: 1 error, not mine (`features/evidence/verify-v2.test.tsx:186`).
- lint: 0 errors.
- jest (touched folders, `--maxWorkers=2`): green; `capture-selector` 11 suites / 108 tests.
- `capture-selector.test.tsx:145`: the test was wrong (row 66's selector rule), fixed in the test.
- Row 132's request (`deviceConsole: true`): applied with its test.

## Blockers / open

- None blocking. Not proven: LIVE calls of ops 93 / 94 / 97 against a server; the badge in real capture.
