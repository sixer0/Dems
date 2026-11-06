# coder-execution — step 53 (API Reference page) — progress

- **Status:** complete
- **Started / finished:** 2026-10-01 09:18 / 10:05 WIB
- **Log:** `implementation/32_page_api_reference.md` (Tier 3)
- **Assets:** `implementation/assets/32_api_reference_1920.png`, `implementation/assets/32_network_log_5173.json`

## Files written

- `apps/core-web/src/features/api-reference/**`: 17 files. The stub is replaced; `ApiReferencePage` and `page-api-reference` are kept.
- `packages/shared/src/i18n/en/api-reference.ts`: additive keys.
- Tests: `apps/core-web/src/test/scalar-config.test.ts` (14) and `apps/core-web/src/test/sim-fetch.test.ts` (15).
- `apps/core-web/vite.config.ts` (hand-over):
  - `test.include` → `src/**/*.test.{ts,tsx}` (D74 M7);
  - `optimizeDeps.include` → react-hook-form, @hookform/resolvers, @hookform/resolvers/zod, zod (D91).

## Key evidence

- **Full core-web suite:** before 32 files / 361 tests; after 34 / 390. Exit 0 both times.
- **Lint:** exit 0.
- **Typecheck:**
  - exit 0 at 09:39;
  - runs from 09:52 to 10:03 failed only in files other steps were editing at the time (P11 noise);
  - a retry loop reached **exit 0 at 10:03:54**, and lint plus the 60/60 test re-run passed at 10:04.
- **Browser** (own Vite 127.0.0.1:5173 plus mock-core, and the shared 5178):
  - resource hosts are only 127.0.0.1:5173 and 127.0.0.1:4400;
  - the Realtime panel is ONLINE;
  - LIVE health Try-it gives 200;
  - SIMULATED session/current gives 200 in 1 ms, with 0 wire requests;
  - export as INVESTIGATOR gives 403, with the amber dot.
- **H-S17:** holds (static and browser evidence).

## SIM-GAPs (for step 54)

| ID | Gap |
|---|---|
| SIM-GAP-W53-1 | Malformed percent-encoding makes `sim.request` throw (m6) |
| SIM-GAP-W53-2 | The request method type is GET/POST only |
| SIM-GAP-W53-3 | Create-session is not validated with `sessionCreateSchema` (M6) |
| SIM-GAP-W53-4 | Start and stop are not gated on SESSION_START (M5). The 401/403 statuses are undocumented on those operations (deviation) |

## Decisions and drift

S53-1 … S53-7 in the log §5. Highlights:
- the Realtime panel has its own heartbeat client;
- the Scalar chunk is deferred to the renderer beat (fixes the route-test timeout);
- `@hookform/resolvers/zod` is added to the D91 list;
- undici is not in the dev pre-bundle, and the agent drawer chunk was never requested (relayed to step 62).

## Processes

All stopped or released:
- Vite 5178: PID 73328, last user.
- Vite 5173: PID 79999 / 80017.
- mock-core: PID 79774, last user.
- Chrome: PIDs 74809 … 81184.

`.locks/*.users` are empty. Nothing was committed.

**Blockers:** none.
