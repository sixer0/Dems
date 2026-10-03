---
task_id: 2026-09-30_dems_demo_stack_setup
step: 53
plan_row: 02_plan §4 W-19 (API Reference page)
date: 2026-10-01
agent: coder-execution
tier: 3
lane: FAST LANE (D75)
status: complete
---

# Step 53: API Reference page `/developer/api`

**Outcome: PASS.**

- The page renders Scalar inside an L2 card, in a lazy chunk of its own.
- Try-it routing works:
  - **LIVE:** health goes to mock-core and returns 200.
  - **SIMULATED:** every other endpoint is answered in the browser by `sim.request`.
  - Export as INVESTIGATOR returns 403 FORBIDDEN.
  - Any foreign URL is rejected.
- The Realtime panel shows the live 1 Hz heartbeat on 127.0.0.1:5173.
- The network log contains only 127.0.0.1:5173 and 127.0.0.1:4400 (AC-57).
- **H-S17 holds.**
- Both controller hand-overs in `vite.config.ts` are in place (D74 M7, D91).
- The suite went from **361 tests in 32 files** to **390 tests in 34 files**: +29, all from this step.

## 1. Files written

| Path | Role |
|---|---|
| `apps/core-web/src/features/api-reference/index.tsx` | Page; replaces the stub. Export `ApiReferencePage` and `data-testid="page-api-reference"` are kept (19_app_shell §2) |
| `…/api-document.ts` | `createOpenApiDocument({includeSimulated})` (D62) plus the `DEMO_EVIDENCE_INDEX.apiExamples` payloads (D67), placed first in each `examples` map; Download JSON |
| `…/scalar-config.ts` | Config (no runtime Scalar import): see the flags below |
| `…/scalar-theme.ts` | `customCss` = `@dems/shared/theme/scalar.css?raw` + the element rules (D49), bound to selectors checked in the browser (§3) |
| `…/scalar-renderer.tsx` | The **only** runtime `@scalar` import, plus the wrapper's `style.css` (its JS does not import it) |
| `…/renderer-panel.tsx` | `lazy(() => import('./scalar-renderer'))`; the chunk request starts on the renderer beat (≥ 200 ms, cancelled on unmount); skeleton; error boundary; 160 ms cross-fade when the filter changes |
| `…/sim-fetch.ts` | `createSimAwareFetch` (Scalar `customFetch`) |
| `…/sim-adapter.ts` | `answerSimulated`: SIM-GAP-W53-1..4 (§4) |
| `…/server-strip.tsx`, `service-banner.tsx`, `realtime-panel.tsx`, `use-realtime-feed.ts`, `panel.tsx`, `choreography.ts`, `actions.ts`, `log.ts`, `api-reference.css` | Strip, header banner, Realtime WS panel (its own heartbeat client; M-C-06 pulse, SlidingNumber, AnimatedListItem), boundary with rate-limited retry, M-PG-API beats, copy and download with toasts, structured dev log |
| `packages/shared/src/i18n/en/api-reference.ts` | Additive keys (`renderer.title`, `banner.ONLINE_NO_VERSION`/`detail`, `server.*`, `tooltips.live`/`rbac`, `realtime.state.*` and notes, `states.renderer*`); OFFLINE copy clarified |
| `apps/core-web/src/test/scalar-config.test.ts` (14 tests), `src/test/sim-fetch.test.ts` (15 tests) | The two test files named in 01_specs §14.13 |
| `apps/core-web/vite.config.ts` | **Hand-over only.** (1) `test.include: ['src/**/*.test.{ts,tsx}']` (D74 M7). (2) `optimizeDeps.include: ['react-hook-form', '@hookform/resolvers', '@hookform/resolvers/zod', 'zod']` (D91). The rest is unchanged |

**Scalar flags (AC-57 config part):**
- `telemetry: false`, `withDefaultFonts: false`, `showDeveloperTools: 'never'`.
- `agent: {disabled: true}`, `mcp: {disabled: true}` (D45).
- `persistAuth: false`, `hideClientButton: true`, `documentDownloadType: 'none'`.
- `theme: 'none'`, `forceDarkModeState: 'dark'`.
- No `proxyUrl`, `externalUrls` or `plugins`.

**Why agent and MCP must be disabled explicitly:** on a local URL, Scalar 1.72.3 *enables* the agent chat and the MCP button by default. The evidence is `ApiReference.vue.script.js:772-776` (`isLocalUrl(window.location.href)`) and `:939-943`.

## 2. Verification (fresh, 2026-10-01 WIB)

| Check | Command / method | Result |
|---|---|---|
| Suite **before** the include change | `npx vitest run --maxWorkers=2` (cwd `apps/core-web`), 09:20:52 | `Test Files 32 passed (32)` / `Tests 361 passed (361)`, exit 0 |
| Suite **after** | same, 09:51:32 | `Test Files 34 passed (34)` / `Tests 390 passed (390)`, exit 0. The +2 files and +29 tests are this step's two `.test.ts` files; no other `.test.ts` existed |
| Own tests and routes | `npx vitest run src/test/scalar-config.test.ts src/test/sim-fetch.test.ts src/test/routes.test.tsx --maxWorkers=2`, 09:54 | `Test Files 3 passed (3)` / `Tests 60 passed (60)` (29 + 31; AC-48 `page-api-reference`, 0 missing i18n keys) |
| Typecheck | `npm run typecheck -w @dems/core-web` | exit 0 at 09:39. Runs from 09:52 to 10:03 gave exit 2, with errors only in files other steps were editing at the time: `packages/shared/src/sim/{actions,initial-state,maintenance}.ts` (sim owner), `components/media/camera-feed.tsx` and `src/test/visual-audit-45b.test.tsx`. That is **P11 noise**. A retry loop (every ~45 s) reached **exit 0 at 10:03:54**; lint exit 0 and the 3 test files 60/60 again at 10:04 |
| Lint | `npm run lint -w @dems/core-web` | exit 0; oxlint on the feature folder is clean |
| Shared i18n | `npx vitest run test/i18n.test.ts` (packages/shared) | 14/14 |
| No `@scalar` import outside the folder | `grep -rnE "from '@scalar\|import '@scalar\|import\('@scalar" apps/core-web/src` | 3 lines, all in the folder: `scalar-config.ts:19` (`import type`), `scalar-renderer.tsx:7` and `:10`. The same check is a test (Vite glob), which also asserts the renderer loads only through `lazy(() => import(...))` |
| AC-58 unit | sim-fetch.test.ts | LIVE passthrough (same `Request` object, no simulated header). session/current 200 with `x-dems-simulated: 1` and a body valid for the contract. INVESTIGATOR export 403 FORBIDDEN plus an `EXPORT_DENIED` row (actor OPR-001). SUPERVISOR 202 plus `EVIDENCE_EXPORTED`. Demo create body gives 201. 5 foreign or non-API URLs (including `proxy.scalar.com`) rejected, `networkFetch` never called |
| Demo payloads against their schema | scalar-config.test.ts | All 4 `apiExamples` payloads are applied first, have no duplicate, and validate with the `components.schemas` entry their `$ref` names. Every other example in the document also validates |
| Browser, AC-57 network | headless Chromium (CDP, `chrome-headless-shell` 1243) on **my own Vite 127.0.0.1:5173**, mock-core under P5 | `performanceResourceHosts: ["127.0.0.1:5173","127.0.0.1:4400"]`. `nonLocal: []`. 411 requests (405 to 5173, 5 to 4400, all `GET /api/v1/health`, plus 1 `blob:`). WebSockets only to `5173` (HMR) and `4400/ws`. 0 requests for `/session/current`, and 0 matching `scalar.com`, CDN, font, posthog, agent or undici. Full log: `assets/32_network_log_5173.json` |
| Browser, page | same run | Realtime chip ONLINE, seq 39 → 60, 5 messages, `09:49:19 UTC+07:00`. Banner `MOCK-CORE ONLINE • v0.1.0 • WS 1 Hz`. Try-it health **200 OK** (live). Try-it session/current **200 OK** in 1 ms (simulated). Badges LIVE / SIMULATED / RBAC + AUDIT. Selected sidebar item has the gold inset edge. `overflowX 0`. Scalar `--scalar-color-accent` is `#FFC86B` and `--scalar-font` is Inter Variable |
| Browser, filter and Connect | same server | Filter: `10 operations` → off `1 operation` (Introduction, Service, Models) → on `10`. Connect off: panel chip OFFLINE while the global banner stays ONLINE; on again → ONLINE |
| Browser, 5178 (shared P14) | before 5173 was free | Same host result (`127.0.0.1:5178`, `127.0.0.1:4400` only). The Realtime panel shows OFFLINE with the origin-allowlist note. Try-it export as OPR-001 gave **403 Forbidden**, the status dot amber `rgb(245,158,11)` (4xx amber, D49), the path prefilled `EV-20260930-0004` and the body `"Prosecutor request"` (demo data) |
| Screenshot | 1920×1080 | `assets/32_api_reference_1920.png`: export operation, demo example `EXP-000031`, Realtime ONLINE |

Not run, by rule: `vite build` (P9; AC-73's entry-chunk grep belongs to the build steps 38/58). Mutation checks and the 1440 / reduced-motion views are deferred to the end pass (D75).

## 3. H-S17 and the selectors (evidence)

**H-S17 holds.** Static: `@scalar/api-client` `OperationBlock.vue.script.js:265-270` calls `sendRequest({… customFetch: toValue(__props.options)?.customFetch …})`, and `send-request.js:34-36` calls `customFetch(request)` with a `Request`. Browser: the session/current Try-it returned 200 in 1 ms, with zero wire requests for that path. The fallback (hide the button and use a page-side panel) is not needed.

**Selectors verified in the running renderer (1.72.3):**

| Element | Selector |
|---|---|
| Sidebar chevron | `button[aria-expanded] > .transition-transform`, which uses `rotate-90` |
| Selected operation | `a[aria-current="page"]` |
| Method pills | `.sidebar-heading-type`, `.endpoint-method` |
| Badges | `.badge-colored[style*="--badge-color: #F59E0B"]` |
| Response dot | `a[href*="/Status/NNN"] > span[style]` |

The Try-it client modal renders **inside** `.dems-api-renderer` (`.scalar-container`), so the scoped rules reach it. Observed: `dems-pop` then `dems-pop-b` alternating on parity, and `dems-sheen` on SIMULATED.

## 4. SIM-GAPs (local adapter `features/api-reference/sim-adapter.ts`; step 54 closes them)

| ID | Gap | Bridge |
|---|---|---|
| SIM-GAP-W53-1 | m6: `decodeURIComponent` outside `try` in `handleSimApiRequest`, so `sim.request` can throw | Pre-decode check: 400 `INVALID_PATH`. Everything else is in try/catch (R6) |
| SIM-GAP-W53-2 | `SimApiRequest.method` is `'GET'\|'POST'` only | Local 404 / 405 with `allow`, in the simulator's error shape |
| SIM-GAP-W53-3 | M6 / F-33-1: create-session is not validated with `sessionCreateSchema` | The adapter validates (after 401/403) and answers the documented 422 `INVALID_INPUT` |
| SIM-GAP-W53-4 | M5 / R4: start and stop are not gated on `SESSION_START` | 401 `NOT_SIGNED_IN` / 403 `NOT_PERMITTED`. **Deviation:** these statuses are not yet documented on those two operations (needs a `core-api.ts` hand-over, review 40 §5.e.3) |

## 5. Decisions and drift

| ID | Kind | Item |
|---|---|---|
| S53-1 | decision | Test files sit at `src/test/` (01_specs §14.13 paths and the AC-57/58 commands), not in the feature folder |
| S53-2 | decision | **Realtime panel uses its own heartbeat client.** It runs a panel-scoped `createHeartbeatClient` over a tapping socket factory (raw frames, uptime), so the Connect switch never cuts the shell's link. mock-core then counts 2–3 clients. On origins outside `WEB_DEV_ORIGINS` it starts disconnected and explains why. Tests inject the router-context `socketFactory` |
| S53-3 | decision | **Scalar chunk load is deferred to the renderer beat** (≥ 200 ms, cancelled on unmount). Without this, the route test's next case (`/stack-check`) timed out: Scalar was evaluating in jsdom (1 failure seen at 09:37, 31/31 after the change). It also matches M-PG-API (the frame first, then the renderer) |
| S53-4 | drift (D91) | `optimizeDeps.include` also lists `@hookform/resolvers/zod`, the subpath the app imports (`session-new/index.tsx:28`). With the root entry alone, `/zod` would still be optimised on first use. Vite accepted the config ("Re-optimizing dependencies because vite config has changed", no resolve error) |
| S53-5 | env note | Vitest stubs CSS, including `?raw`, as `''`. The theme content is therefore asserted by the wiring test plus the browser (computed `--scalar-color-accent` `#FFC86B`). In Vite the string is the generated file |
| S53-6 | finding, for step 62 (O-2) | Dev pre-bundle: the only "undici" in `@scalar_api-reference-react.js` is the snippet target id `"node/undici"`. `AgentScalarDrawer.vue-*.js` (431 KB) contains no undici and was **never requested** at runtime with `agent.disabled`. The production-bundle check stays with step 62 |
| S53-7 | note | Status colours: only the Try-it response dot carries a status colour in 1.72.3. The reference's own response tabs are uncoloured, so 3xx blue / 4xx amber / 5xx red apply to the dot |

**Blockers: none.**

## 6. Process (P5, P7, P10, P14)

- **Vite 5178 (P14).** Not listening at 09:39. Under `lockf .locks/vite.lock` I registered `step-53` and started it (PID 73328, log appended to `.locks/vite.5178.log`). At 09:51 I was the last user and stopped it.
- **Vite 5173.** `127.0.0.1:5173` was free; `[::1]:5173` belongs to an unrelated project (SMART WMS Vite, PID 3489), which I did not touch. I started my own (PID 79999 / node 80017) and stopped it after the checks.
- **mock-core (P5).** Not listening. Under the lock I started `npm run dev:mock` (PID 79774) and registered `step-53`. As the last user I stopped it (`shutdown complete`).
- **Cleanup.** `.locks/vite.users/` and `.locks/mock-core.users/` are empty. Ports 4400, 5178 and 9353–9355 are free, and no `s53-chrome` profile remains.
- **Sandbox (P10).** Port binds, CDP and `lsof`/`ps` ran with a per-command sandbox bypass.
- **Not touched.** No `package.json`, no `npm install`, nothing in `packages/shared/src/sim/**`, nothing committed. `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md` and `99_implementation_report.md` are left to the controller.

---
*Generated: 2026-10-01 09:55 WIB*
*Last Updated: 2026-10-01 10:05 WIB (P11 typecheck re-run)*
