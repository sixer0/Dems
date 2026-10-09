# coder-execution-local - row 47a (controller-added meter fix-forward, M2, tier 3)

Status: **PARTIAL** - the meters.audio consumer adaptation is COMPLETE and type-correct in both apps;
the "suite exit 0" acceptance criterion is NOT reachable right now for two out-of-scope reasons (§ below).
Date: 2026-10-08. Blueprint rev 2.1; controller-added row per D31/D32.

Deliverable: `docs/2026-10-07_dems_real_capture_sealing/implementation/60_m2_meter_forwardfix.md` (Tier 3)
plus this note. Edits confined to `apps/core-web/**` and `apps/mobile/**`. `packages/shared/**` and
`apps/core-server/**` were NOT touched (read-only). No commit, no push, no remote, no sudo, no DB, no emoji.

## What was done

Migrated every `meters.audio` consumer from the old `channels['AUDIO-01']` shape to the new
`inputs['MIC-0x']` + `activeInputId` shape, using the same `MIC_INPUT_OF_CHANNEL` mapping that shared's
`useAudioChannel` already applies internally. 9 files, +34/-21, no assertion weakened, no skip, no timeout raised:

- core-web: `dbfs-meter.tsx` (the root cause, line 192), `__tests__/test-utils.ts` (`pushAudioFrame`),
  `__tests__/dbfs-meter.test.tsx`, `test/live-shell-notices.test.tsx`, `test/live-meter-clip-reset.test.tsx`,
  `test/live-session-monitor-panels.test.tsx`.
- mobile: `runtime/use-audio-shared-values.ts`, `runtime/use-audio-shared-values.test.tsx`,
  `features/session-live/testing/live-monitor-bed.tsx`.

## Before / after (bounded, CI=true, </dev/null)

| Measure | Before | After |
|---|---|---|
| core-web suite | exit 1, `20 failed / 97 passed (117)`, `91 failed / 1404 passed (1495)` | meters.audio root cause gone: `grep -c "reading 'AUDIO-01'" = 0`; full suite still red (external blockers) |
| mobile suite | exit 1, `129 failed / 65 passed (194)` suites, `117 failed / 853 passed (970)` | meters.audio site gone; full suite still red (external blockers) |
| `typecheck -w @dems/core-web` | 16 meters.audio errors (per row-47 §9) | **0 meters.audio errors** in apps/core-web; 19 total = 2 devices-step PrecheckCheckId (row 67) + 17 packages/shared cascade (row 48) |
| `typecheck -w @dems/mobile` | 9 meters.audio errors (per row-47 §9) | **0 meters.audio errors** in apps/mobile; residuals owned by rows 68/87 + shared cascade |

## Why not exit 0 (both external, outside this row's file set)

1. **`packages/shared` is transiently broken by a CONCURRENT edit (row 48).** D32 launched 47a+48+51 in
   parallel in one tree. While this row ran, `npx tsc -p packages/shared` reported 64 errors and the
   package crashed at module load with DIFFERENT signatures minutes apart
   (`CAPTURE_CONFIG_OPERATIONS is not iterable`, then `operatorId is not defined` at evidence.ts:216,
   then `Cannot convert undefined or null to object` at sessions.ts:202 `z.enum(SessionState)`). Both apps
   import the api barrel, so neither suite can compile/run until row 48 leaves shared green. Forbidden to
   this row. One bounded retry after a fixed pause still showed it broken; did not poll further (anti-hang).
2. **Both suites also carry non-meters.audio consumers of SH-03/SH-04/SH-01** (system-model fault-kind
   12->14; users-roles/security-audit permission 12->14; devices-step/check-icon PrecheckCheckId pair;
   finalizing.model FinalizationStep v2; session-live-screen AUDIO_SWITCH) owned by rows 67/68/87 - out of
   this narrow row's scope ("do NOT build any M4/M7 feature").

## Scope confirmation

`git diff --name-only` attributes NO change under `packages/shared/**` or `apps/core-server/**` to this
row. The 9 changed files are all under `apps/core-web/src` and `apps/mobile/src`. Confirmed I did not
touch packages/shared or core-server.

## Routed to the controller

- Board INFO posted (board_0cd00fdc...): sequence row 48 so `packages/shared` is green before judging
  `M2-RG-WEB`/`M2-RG-MOB`; the meters.audio forward-fix itself is done and will hold once shared builds.
- Note: macOS has no GNU `timeout`; a perl-backed shim was used for bounded execution (proven to SIGTERM a
  hung child). jest does not accept the vitest-only `--run` flag; mobile ran as `CI=true jest --maxWorkers=2`.
