# coder-execution — integration pass D5

Status: **needs-review** (software complete and green on the touched files; no browser / device / real Core).
Note: `implementation/99_integration_pass_d5.md`. Claims: two lines in `file_claims.md`. Requests: two lines in `file_requests.md` (pass D4: `ExportResult`; row 90: op 88 and a mid-stream failed fragment).

## Files

Shared: `packages/shared/src/live/source/{bindings.ts,index.ts}`, `packages/shared/src/i18n/en/evidence.ts` (one key), `packages/shared/test/live-source-bindings.test.ts`.

Mobile: `apps/mobile/src/runtime/{sim-adapters.ts,index.ts,sim-runtime-provider.tsx,use-audio-shared-values.ts,live-device.test.tsx}`; `features/evidence/{media-session.ts,sealed-player.tsx,export-sheet.tsx,export-job-model.ts,export-job-status.tsx,media-session-canary.test.tsx,export-job.test.ts,live-evidence-export.test.tsx}`; `features/session-live/{mic-source-model.ts,use-mic-source.ts,mic-source.test.tsx}`; `features/dashboard/{device-tiles.tsx,use-home-data.ts}`; `features/devices/{sim-adapter.ts,device-detail.tsx}`.

Web: `apps/core-web/src/components/composed/{audio-source-band.tsx,index.ts,dbfs-meter.tsx,__tests__/test-utils.ts,__tests__/dbfs-meter.test.tsx}`; `features/evidence/{audio-source-band.tsx,sealed-player.tsx,export-wizard.tsx,export-job-model.ts,export-job-status.tsx,__tests__/export-job.test.tsx,__tests__/media-session-canary.test.tsx}`; `features/session-monitor/{audio-source.ts,audio-panel.tsx,__tests__/audio-source.test.tsx}`.

Docs: `implementation/99_integration_pass_d5.md`, this file, appended lines in `file_claims.md` and `file_requests.md`.

No file deleted or renamed. No commit. No lockfile, dependency, emulator, adb, browser or build. `packages/shared/src/api/**`, `src/sim/**`, `test/acceptance`, `db/mapping`, `modules/transcripts` untouched.

## Blockers / decisions

None blocking. Decisions D5-1 .. D5-7 in the note §5.
