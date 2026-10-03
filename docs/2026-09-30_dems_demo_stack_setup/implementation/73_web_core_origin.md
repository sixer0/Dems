---
task_id: 2026-09-30_dems_demo_stack_setup
step: 100
decision: D104 (scope), D110 (no shared/api edits while step 54 runs), D112 (finish now, skip optional)
agent: coder-execution
narrative_tier: 3
status: complete (browser check not run: sandbox EPERM, see section 5)
date: 2026-10-01
source_spec: masterplan/06_packaging_spec.md §3.3, §3.4, §3.5, §2.2 (.gitignore), §6.1 row 100
---

# 73 Web Core origin switch (step 100)

## 1. What changed

| File | Change |
|---|---|
| `apps/core-web/src/env.d.ts` | new. `ImportMetaEnv.VITE_DEMS_CORE_ORIGIN?: string` |
| `apps/core-web/src/lib/core-endpoint.ts` | new. `isSameOriginCore()`, `coreHttpOrigin()`, `coreWsUrl()`, `allowedPageOrigins()` (all evaluated at call time), plus `fetchCoreHealth()` (D110 interim, see section 4) |
| `apps/core-web/src/lib/packaged-csp.ts` | new. `packagedCsp({delivery:'header',port})` / `({delivery:'meta'})`, `packagedCspTags()`, Vite plugin `packagedCspPlugin()` (`apply:'build'`) |
| `apps/core-web/vite.config.ts` | `packagedCspPlugin()` added to `plugins`. `base` and `build.sourcemap` unchanged (default `/`, off) |
| `routes/__root.tsx:72` | `<HeartbeatProvider url={coreWsUrl()} …>` |
| `features/home/use-health.ts`, `features/api-reference/service-banner.tsx` | `queryFn: () => fetchCoreHealth()`. The banner address comes from `coreHttpOrigin()` |
| `features/api-reference/sim-fetch.ts` | `coreHttpOrigin()` is resolved inside `createSimAwareFetch`. The module-level `CORE_ORIGIN` is removed. `BlockedRequestError(url, coreOrigin = coreHttpOrigin())` |
| `features/api-reference/use-realtime-feed.ts`, `realtime-panel.tsx` | Socket URL from `coreWsUrl()`. `originAllowed` and the blocked note use `allowedPageOrigins()` |
| `features/api-reference/server-strip.tsx`, `index.tsx` | Show `coreHttpOrigin()` |
| `features/api-reference/api-document.ts` | New `pointAtCoreOrigin(doc)`. In packaged mode it sets `servers[0].url` and swaps the two address strings (the LIVE row and the Realtime WS URL). Dev mode returns the same object untouched |
| `features/login/login-model.ts` | `coreAddress(origin = coreHttpOrigin())` |
| `.gitignore` (append) | `/release/` and `apps/mobile/signing/` |
| `src/lib/__tests__/core-endpoint.test.tsx`, `packaged-csp.test.ts` | new. 28 tests covering both modes |

`packages/shared/**`: **net unchanged.** I edited `api/health.ts` and `api/openapi.ts` before D110 arrived, then reverted both exactly:

- `git status` shows `health.ts` clean.
- `openapi.ts` is untracked, and my identifiers occur 0 times in it.
- The openapi drift test passes, 21/21.

I also deleted my shared test, `packages/shared/test/core-origin.test.ts`.

## 2. Verification (fresh, this session)

| Check | Result |
|---|---|
| `npm run typecheck` core-web / shared | exit 0 / exit 0 |
| `oxlint` core-web / shared | exit 0 / exit 0 |
| `vitest run --maxWorkers=2` core-web | **39 files, 438 tests passed**. The first run had 4 failures in devices, storage and network-time. Those were P11 noise: step 54 was writing those pages' `sim-adapter.ts` files at 10:24–10:26. Re-run: 47/47, then the full suite was green |
| `vitest run --maxWorkers=2` shared | **28 files, 508 tests passed**. `test/openapi.test.ts`, which includes the byte-for-byte check of `openapi.json`: 21/21 |
| Mutation check | Removing `url={coreWsUrl()}` from `__root.tsx` makes the two packaged-mode wiring tests fail (2 failed / 11 passed). Then restored |
| `git check-ignore` | `release/probe`, `release/web/x.zip` → `.gitignore:61:/release/`; `apps/mobile/signing/release-signing.properties` → `:62`; exit 0. **Not ignored** (exit 1): `scripts/release/build-web-packages.ts`, `apps/mock-core/standalone/x.cjs` |

The tests prove both modes:

- **Dev mode (env unset):** `http://127.0.0.1:4400`, `ws://127.0.0.1:4400/ws` and `WEB_DEV_ORIGINS`.
- **Packaged mode (`same-origin`):** `window.location.origin` and `ws://<host>/ws`, or `wss` on https.
- **Through the real router** (`/developer/api` and `/stack-check`): every socket URL and every health fetch URL matches the mode.
- **Packaged Try-it:** health goes to the network on the page origin; the other `/api/v1/*` calls are simulated; the dev Core URL is blocked.
- **CSP header:** equals the §3.3 text exactly.

## 3. Contract for step 95 (launcher and packager)

1. **Build command (unchanged from §3.6):** in `apps/core-web`, run `VITE_DEMS_CORE_ORIGIN=same-origin node ../../node_modules/vite/bin/vite.js build --outDir <root>/.cache/release/web-dist --emptyOutDir`.
   - The env value is exactly `same-origin`. Any other value, or no value, gives the dev build: Core on `127.0.0.1:4400` and no CSP meta tag.
   - Do not use a `.env` file. `base` is `/`.
2. **One origin, these paths:**
   - `/` and the SPA fallback, `/assets/*`, and the other static files;
   - `GET /api/v1/health`: `HealthResponseSchema` from the page's own origin. The app polls it every 10 s and after each WS resync;
   - `WS /ws`: heartbeat frames.
3. **WebSocket Origin:** the browser sends `Origin: http://127.0.0.1:<port>`, the page origin. The launcher's WS allowlist **must accept its own origin**, plus `http://localhost:<port>` if the Host allowlist admits `localhost`. Expect **2 sockets** while `/developer/api` is open (the shell and the Realtime panel), so health reports `clients: 2`.
4. **Other requests:** no `/api/v1/*` request other than health reaches the launcher. sim-fetch answers or blocks them in the browser. The §3.3 404 for other `/api/*` stays as specified.
5. **CSP header:** use `packagedCsp({ delivery: 'header', port })` from `apps/core-web/src/lib/packaged-csp.ts`. For port 4410 it is byte-equal to the §3.3 text (asserted in `packaged-csp.test.ts`):
   `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self' ws://127.0.0.1:4410 ws://localhost:4410; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
   - The launcher is dependency-free `.cjs`, so it carries its own copy. **Recommended:** `standalone-launcher.test.ts` imports `packagedCsp` and asserts equality, to stop drift.
   - The other §3.3 headers (nosniff, no-referrer, COOP, CORP, Permissions-Policy) are header-only and remain step 95's job.
6. **CSP meta tag (built `index.html`):** the plugin prepends `<meta http-equiv="Content-Security-Policy" content="…">` to `<head>`.
   - The content is the header policy with two changes: `connect-src 'self' ws://127.0.0.1:* ws://localhost:*`, and no `frame-ancestors` (meta tags ignore it).
   - The browser enforces both policies, so the effective connect-src is the header's port.
   - **A widening must change `packaged-csp.ts` and the launcher header together.**
   - Step 95 should assert that `web-dist/index.html` contains this meta tag, and that it has **no inline `<script>`** (one without `src`), which `script-src 'self'` would block.
7. **Runtime CSP proof:** still step 95/96 (R-PK-4). Walk the 10 pages, Start Session, and Scalar Try-it, and collect `securitypolicyviolation` events. It was not proven here (section 5).
8. **Preflight:** `git check-ignore -q release/probe` → exit 0.

## 4. Decisions and deviations

| # | Decision | Reason |
|---|---|---|
| 1 | The shared `fetchHealth(fetchImpl, origin)` and `createOpenApiDocument({serverUrl})` from §3.4 are **not** made (reverted). Two app-side interims replace them: `fetchCoreHealth()` uses the shared `fetchImpl` seam, so the schema check stays shared; `pointAtCoreOrigin()` handles the OpenAPI document | D110: step 54 owns `packages/shared/src/api` while it runs. **End pass:** optionally move both into shared, as §3.4 says. The behaviour is identical and the tests already pin it |
| 2 | `pointAtCoreOrigin` rewrites `servers[0].url` in packaged mode, rather than leaving it for step 95 to inject | It is functional, not cosmetic. Without it, Scalar's Try-it requests `http://127.0.0.1:4400/…`, which `simAwareFetch` blocks as off-origin. Try-it would break in the package |
| 3 | `.gitignore` gets `/release/` (anchored), not the spec's and D110's `release/` | An unanchored `release/` also ignores `scripts/release/build-web-packages.ts`, step 95's packager source (verified: `.gitignore:59:release/ scripts/release/build-web-packages.ts`, before the fix). `git check-ignore -q release/x` still passes |
| 4 | The CSP meta tag is emitted only for `vite build` with `same-origin` | Dev mode uses Vite's inline React-refresh preamble, which `script-src 'self'` blocks. The default build talks to `:4400`, which `connect-src 'self'` blocks |
| 5 | The log is named `73_web_core_origin.md` (spec row: `71_web_same_origin_core.md`) | The controller named it. `71_` is taken |

**Residual (cosmetic):** the health operation's own prose (`packages/shared/src/api/core-api.ts:427`, *"served by mock-core on 127.0.0.1:4400 (CORS allows the web dev origins)"*) is outside the §3.4 list. It still shows in the packaged Scalar view. Owner: the end pass, after step 54.

**Side effect:** editing `vite.config.ts` makes any running Vite dev server (the shared 5173) restart once.

## 5. Not done

**Browser check** (own Vite with `same-origin` behind a local proxy, plus the AC-PK-W2 dev check): not run.

- The sandbox refuses local listening (`listen 127.0.0.1:5191` → `EPERM`) and loopback connections (`curl 127.0.0.1:4400` → exit 7).
- D112 asked to skip optional work.
- Coverage instead: the router wiring tests in both modes. Step 95/96 run the real runtime checks on the launcher.
- `sandbox.network.allowLocalBinding: true` would allow the check later.
