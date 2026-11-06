# coder-execution, step 27 (plan row W05): early proof (f), the Vite dev proxy

| Field | Value |
|---|---|
| Step / row | 27 / W05 |
| Agent | coder-execution |
| Status | **complete** (step 27, accepted as D29), and the follow-up of D29 / F30 is **complete** too (section "Follow-up" below) |
| Result line | ADQ-6 same-origin proxy CONFIRMED; fallback row Ff is not needed |
| Started | 2026-10-04, wave E1 (about 06:26 WIB); first recorded timestamp 06:31:47 WIB |
| Last live run | 06:47:00 WIB; final listener check 06:47:07 WIB |
| Time box | 45 min; kept |
| Write paths used | `apps/core-web/vite.config.ts`; `.cache/proof-harness/**`; `.cache/rollback/W05.pre.patch`; `.locks/core-server.lane1.lock` (by `lockf`); the output document, its assets and this file |
| Shared trackers | Not written (parallel run, P8): `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md`. The controller records the status of row W05 from this file |

## Files created or updated

| Path | Change |
|---|---|
| `apps/core-web/vite.config.ts` | Modified: the `server.proxy` block behind `DEMS_CORE_PROXY_PORT` (38 lines added, 4 removed; hash `cb48698`, was `7374427`). **Follow-up:** `cors: false` together with the proxy (now 47 lines added, 4 removed against `acaff20`; hash `f6dde3b`) |
| `docs/2026-10-04_dems_backend_rbac_pairing/implementation/05_proof_vite_proxy.md` | Created: the output document (Tier 3). **Follow-up:** section 12 appended, and two one-line pointers to it added (top table, F27-1) |
| `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/05_run_check.log` | Created: the main live check, 237 lines |
| `.../assets/05_browser_run.json` | Created: the headless Chromium run |
| `.../assets/05_resolve_config.log` | Created: the config per command and value |
| `.../assets/05_build_compare.log` | Created: builds before and after, `diff -r` |
| `.../assets/05_gate_runs.log` | Created: tests before and after, typecheck, lint |
| `.../assets/05_run_cors_option.log`, `05_run_backend_down.log`, `05_run_lane_snippet.log` | Created: the three extra lane runs |
| `.../assets/05_harness.mjs`, `05_run_check.sh`, `05_cdp_driver.mjs`, `05_ws_client.mjs` | Created: copies of the scratch scripts |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_27.md` | Created: this file |
| `.cache/proof-harness/**` (git-ignored) | Created: `harness.mjs`, `run_check.sh`, `cdp-driver.mjs`, `ws-client.mjs`, `format-log.mjs`, `resolve-config.mjs`, `run_cors_option.sh`, `vite-inline-nocors.mjs`, `run_backend_down.sh`, `run_lane_snippet.sh`, logs and `out*/`. Left in place for W12 |
| `.cache/rollback/W05.pre.patch` (git-ignored) | Created before the first edit; 0 bytes (the file equalled `acaff20`) |
| `.locks/core-server.lane1.lock` (git-ignored) | Created by `lockf -k` |
| `.cache/proof-harness-w05b/**` (git-ignored) | **Follow-up:** created. This row's own copies (`harness.mjs`, `cdp-driver.mjs`, `ws-client.mjs`, `format-log.mjs`), two control configs, `resolve-config.mjs`, `run_check_b.sh`, `run_unset_b.sh`, logs and `out*/`. Nothing under `.cache/proof-harness/` was written in the follow-up |

## Log

- 06:27-06:31 Inputs read: 02_structured (row 27, P1-P25, early proofs), 02_plan (W05, §4.3, §5.3, §6, §8.1), 04_client_integration_spec §4 (WT-1 to WT-4, AC-C-33, AC-C-34, AC-C-102, CA-05), 01_specs (§2.1, §2.3, §2.4, §9.2, §14.2, SR-19, SR-21, SR-69, SR-70), `vite.config.ts`, `core-endpoint.ts`, Vite 8.3.1's proxy, CORS and preview code, the predecessor's CDP driver.
- 06:31 P23 pre-image saved (0 bytes). `git check-ignore`: `.cache/` and `.locks/` are ignored (`.gitignore:47`, `:59`).
- 06:31-06:32 Web tests before the edit: 438 passed of 438 in 39 files (the two files of W01 were already fixed in the tree).
- 06:34 Two builds with the unedited config (plain, packaged) into the scratch folder.
- 06:35 The edit. Typecheck and lint exit 0. `resolve-config.mjs`: proxy only for the dev server with 4420 to 4423; none for build and preview; any other value throws.
- 06:35 Three builds after the edit: byte-identical to the two before (`diff -r`), also with the variable set to 4421 and to 9999.
- 06:36-06:38 Harness, check script, CDP driver and socket client written. A sandboxed bind answers `listen EPERM`, so the live runs used the per-command bypass.
- 06:38:45-06:38:56 Main live check on lane 1 inside `lockf`: curl, `ws` client, HeadlessChrome 153; Vite without the variable; Vite with 9999. All points pass. Everything stopped.
- 06:40 Extra run: the option `server.cors: false` as an inline override (no file change).
- 06:40-06:41 Web tests after the edit: 438 passed of 438 in 39 files; typecheck and lint exit 0.
- 06:43 Extra run: the proxy with the backend down (502, empty body).
- 06:46-06:47 Extra run: the documented lane start lines, as written. Final `lsof`: no listener on 4421, 5176, 9396.
- 06:42-06:50 Evidence copied to `implementation/assets/05_*`; the 213 MB of scratch builds removed; documents written.

## Verification (the row's cell), with the place of the quoted output

| Point | Result | Where |
|---|---|---|
| `curl -si` through 5176 returns `Set-Cookie`, `x-dems-epoch`, `x-dems-revision`, `retry-after` | Pass | 05_proof_vite_proxy.md §3.2 |
| The next request and a `ws` upgrade reach the harness with `Cookie` and `Origin` unchanged | Pass (curl and `ws` client; and the real browser) | §3.3, §3.4 |
| Vite's own socket still connects | Pass (`vite-hmr`, 101, `{"type":"connected"}`; browser console "[vite] connected.") | §3.6 |
| `npm run test -w @dems/core-web -- --maxWorkers=2` unchanged | 438 of 438 before and after; no failure in either run | §6 |
| Typecheck and lint exit 0 | Pass | §6 |
| The block holds no `headers`, no `changeOrigin`, no rewrite hook | Pass (the block is quoted; a search of the function body finds none) | §1 |
| `Host` seen by the harness | `127.0.0.1:5176` | §3.5 |
| Variable unset | No proxy; the dev server answers as before; the harness logs nothing | §3.8 |
| Negative case of SR-70 | `Origin: http://localhost:5176` (and four more values) arrive unchanged; also from a real page opened under `localhost` | §3.7 |
| Nothing left running | `lsof` exit 1, no output | §8 |

## Test ledger (P24)

| Workspace | Before | After | Added |
|---|---|---|---|
| `@dems/core-web` | 438 tests in 39 files, 0 failed | 438 tests in 39 files, 0 failed | 0 |

## Findings (for the controller to number)

| Local ID | Finding |
|---|---|
| F27-1 | **Security.** The Vite dev server's own CORS layer (on by default, runs before the proxy) adds `Access-Control-Allow-Origin: <origin>` and `Vary: Origin` to every proxied answer whose request carries a loopback `Origin`, and answers CORS preflights itself with 204. It never sends `Access-Control-Allow-Credentials`. SR-04 and OR-5 stay true for the Core server; AC-C-33 (curl without `Origin`) still passes; the Origin guard stays the control. Option measured and not applied: `server.cors: false` removes the header and everything still works in a real browser |
| F27-2 | `vite preview` inherits `server.proxy` by default, against WT-3. Closed in the file with `command === 'serve' && !isPreview`; `defineConfig` therefore takes a function |
| F27-3 | The backend sees `Host: 127.0.0.1:517x` (the dev server's), no `x-forwarded-*`, and `Connection: close` on each REST call. A browser's socket upgrade carries no `Sec-Fetch-*` header. A same-origin GET carries the cookie and no `Origin` (the case OR-3 accepts). A server close code (4403) reaches the page |
| F27-4 | The keys `/api/v1` and `/ws` are prefix matches: no console route or public file may start with either |
| F27-5 | Backend down: the proxy answers 502, `text/plain`, empty body; the upgrade ends with close code 1006 (WT-4 measured) |
| F27-6 | Host state: nothing listened on 5173 to 5175 during the row. `.locks/vite.users/` and `.locks/mock-core.users/` were emptied at 06:36 by another process; this row did not touch them |

## Decisions needed

| Local ID | Decision | Recommendation |
|---|---|---|
| D27-1 | What to do about the dev server's CORS header (F27-1): accept as a residual, or add `cors: false` to the `server` block (always, or only with the proxy on) | Route it through the security reviewer (it touches OR-5 and SD-07). A change is one line in `vite.config.ts` and needs a slot |
| D27-2 | Unset variable means no proxy (the delegation's wording); WT-1 and 02_plan §5.3 read as "4420 by default" | Keep it; the main-instance rows start Vite with `DEMS_CORE_PROXY_PORT=4420`; correct the two texts |
| D27-3 | File names for a lane's Vite log and PID: `.locks/core-server.lane<k>.vite.log`, `.vite.pid` | Adopt them (RB-11's pattern already removes them); add one sentence to P14 |

## Deviations

1. `defineConfig` takes a function (F27-2).
2. The harness is a plain `.mjs` with proof routes under `/api/v1/proof/*`; the three contract-valid canned answers of 02_plan §6 are left to W12.
3. Three lane-1 runs beyond the main check (the `cors: false` option, the backend-down case, a dry run of the documented start lines).
4. Evidence and script copies under `implementation/assets/05_*`.

## Open items for W50

The negative test against the real Origin guard; the static test of the config (look at the body of
`coreDevProxy`, the option names occur in its doc comment); `hello` and `heartbeat` from the real server;
a hot reload after a source edit (this row edited no source file).

## Follow-up: dev CORS off with the proxy (D29, F30)

Controller ruling on F27-1 (recorded as F30): `server.cors` is switched off while the proxy is on.
Evidence: `implementation/05_proof_vite_proxy.md` section 12. No new assets file was written.

| Field | Value |
|---|---|
| Status | **complete** |
| Window | 2026-10-04 07:14 to 07:25 WIB |
| Change | `coreDevProxy` returns `{ proxy, cors: false }` when the variable selects a proxy and `{}` otherwise; the `server` block spreads it for the dev server only (not preview, not build) |
| Lane 1 | Busy at 07:14 (step 34); waited, not forced. Free at 07:17. Runs under the lock: 07:19:04-07:19:15 (`run_check_b.sh`) and 07:20:10-07:20:14 (`run_unset_b.sh`) |
| Sandbox bypass | The two `lockf` runs |

### Log

- 07:14 Lane lock probe: busy (`lockf` exit 75; `node 15183` listening on 4421 is step 34's harness). The shared `harness.mjs` differs from this row's copy (step 34 extends it), so the follow-up works in `.cache/proof-harness-w05b/` with copies from `implementation/assets/05_*`.
- 07:15 Two builds with the file as step 27 left it. Two control configs made (the `acaff20` file and the step-27 file, each with its two relative paths written as absolute ones).
- 07:16 The edit. Typecheck and lint exit 0. Resolved config: `server.cors=false` only together with a proxy; Vite's default for unset, preview and build. Five builds after the edit: byte-identical to the two before; tree hashes equal those of section 5.
- 07:17 Lock free.
- 07:19 `run_check_b.sh`: proxy on, curl, `ws` client, HeadlessChrome 153; then three dev servers without the variable (two controls and the real file).
- 07:20 `run_unset_b.sh`: the unset comparison again with all three config files named `vite.config.ts`.
- 07:21 Web tests 438 passed of 438 in 39 files (one run); typecheck and lint exit 0.
- 07:22 Final `lsof`: no listener on 4421, 5176, 9396. Scratch builds removed.

### Verification of the follow-up

| Point | Result | Where (05_proof_vite_proxy.md) |
|---|---|---|
| Proxy on: a proxied answer to `Origin: http://127.0.0.1:5174` has no `Access-Control-Allow-Origin` | Pass (200 and 403 answers, every header printed) | §12.2, 3b and 3c |
| Proxy on: a preflight is no longer answered 204 by Vite | Pass: it is forwarded; the harness logged the `OPTIONS` and answered 404 without a CORS header | §12.2, 3d and harness lines #5, #6 |
| Same-origin flow in the real browser | Pass: page loaded, POST set the cookie (`httpOnly`, `sameSite: Strict`), second request and `/ws` upgrade carried it, Vite's socket connected, `page errors: []` | §12.3 |
| Variable unset: headers as before | Pass: the ten-request capture of the file as it is now equals the one of the `acaff20` control line for line; the step-27 control differs only in the body length of Vite's client script, which follows a random socket token | §12.4 |
| Typecheck, lint | exit 0, exit 0 | §12.6 |
| `npm run test -w @dems/core-web -- --maxWorkers=2` | 438 passed (438), one run, no failure | §12.6 |
| Build byte-identical with and without the variable | Pass (`diff -r` IDENTICAL five times; tree hashes `27f7a8b43ebaebcb` packaged, `6e74094d06b9b93d` plain, as in step 27) | §12.5 |
| Nothing left | `lsof` exit 1, no output | §12.7 |

### For the controller to record

1. D27-1 closed by D29; F27-1 (F30) no longer applies while the proxy is on.
2. **New:** a CORS preflight now reaches the Core server (`OPTIONS /api/v1/...` with a foreign `Origin`). The real server must answer it without an `Access-Control-Allow-*` header; the status it gives is for W08 and W23 to state and test (AC-B-43).
3. `coreDevProxy` returns `{ proxy, cors }` now. W50's static test looks at the `proxy` entries in the function body or at the resolved `server.proxy`, and can pin `server.cors === false` whenever a proxy is set.
4. `cors: false` covers the whole dev server while the proxy is on (also Vite's own pages); no effect on the console, which is same-origin.
5. Rollback unchanged; `.cache/proof-harness-w05b` joins the scratch folders of RB-17.

## Blockers

None.
