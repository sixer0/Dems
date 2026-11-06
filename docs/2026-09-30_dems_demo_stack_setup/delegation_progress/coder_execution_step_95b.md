# coder-execution — step 95b (web packager rebuild, D124) progress

Status: complete

| Time (WIB) | Event |
|---|---|
| start | Read verification/02_security.md (F-62-01..08) and implementation/70_web_packager.md. THIRD_PARTY_NOTICES.md sha256 = 4cbdec5c…920f (expected) |
| 11:35 | scripts/release/collect-web-licenses.ts written (389 npm packages, 0 unresolved, 871,171 B; 3 OFL files byte-equal to @fontsource-variable LICENSE). Packager edited: licenses/ in every package, `unset NODE_OPTIONS` before the version check, source fingerprint + git status in BUILD-INFO, guide rewritten only on text change. Packager tsc exit 0. main.tsx: `import { z } from 'zod'` + `z.config({ jitless: true })`. F-62-06: no signtool/osslsigncode on host -> known issue |
| 11:29 | Run 1 (packager exit 0, 29 s; gate typecheck 0 / lint 0 / vitest 0). Smoke on :4420: self-test ok, Login -> Dashboard OK, 0 external requests, but **CSP 28 reports**: the body-level `z.config` runs after the statically imported modules have built their schemas, so the probe still fires |
| 11:31 | Controller D127 received: add `build.assetsInlineLimit: 0` (F96-1), guide inside every package (F96-2), Online wording (F96-3), any-OS start file (F96-4), USB-debugging-off line (D126); smoke adds Evidence Verify PASS/FAIL, export zip, CSP 0 |
| 11:33 | Controller D128 received: final build must wait for implementation/80_tagline.md (new hero tagline); smoke asserts the tagline on Login |
| 11:34–11:42 | vite.config.ts `build: { assetsInlineLimit: 0 }`; main.tsx: `z.config({ jitless: true })` then the simulator, i18n and router are loaded with `await import()` (DR-95b-1); packager: guide inside every package, wording fixes, USB-debugging line. Trial build 2 (after 80_tagline.md, 11:33:47): smoke on :4420 **27/27**, CSP 0, Verify PASS 8/8 and FAIL on AUDIO-02, export zip OK, tagline OK. Gate at normal load: typecheck 0, lint 0, vitest 438/438 (one earlier run under load average 108 had 2 timeouts) |
| 11:44 | Build 3 (with `--verify-inputs` and the inputs sidecar); sidecar renamed `BUILD-INPUTS.txt` so it is not mistaken for a package checksum |
| 11:45 | **Final build 4** (11:45:10–11:45:58, exit 0): 6 packages + `.sha256` + `SHA256SUMS.txt` + `BUILD-INFO.txt` + `BUILD-INPUTS.txt`; `shasum -c` 6x OK; `--verify-inputs`: no input changed |
| 11:46–11:47 | Final smoke on :4420 from a copy in `$TMPDIR`: SEA and any-OS self-test exit 0; browser **27/27**; CSP 0; external requests 0; Verify PASS 8/8 and FAIL on AUDIO-02; export zip downloaded; tagline shown; SIGINT exit 0, no listener left |
| 11:48 | F-62-05 proof (hostile `NODE_OPTIONS`: control injects, scripts and SEA do not). Package inventory: notices `4cbdec5c…920f` in 6/6, licences and guide byte-equal in 6/6, no forbidden files |
| 11:52 | `implementation/78_web_packager_rebuild.md` written; post-build verification appended to `BUILD-INFO.txt`. Not edited (parallel rule): `02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`, `99_implementation_report.md` |

Files created: `scripts/release/collect-web-licenses.ts`, `release/web/BUILD-INPUTS.txt`, `docs/.../implementation/78_web_packager_rebuild.md`, `docs/.../implementation/assets/78_{login,dashboard,stack_check,api_reference_try_it,verify_ev0001_pass,verify_ev0005_fail,export_zip}.png`, `78_browser_smoke.json`
Files changed: `scripts/release/build-web-packages.ts`, `apps/core-web/vite.config.ts`, `apps/core-web/src/main.tsx`, `release/web/*` (6 packages, 6 `.sha256`, `SHA256SUMS.txt`, `BUILD-INFO.txt`), `release/RUN-ON-ANOTHER-PC.md`
Blockers: none.
Decisions for the controller: **DR-95b-1** (the one-line `z.config` gave 28 CSP reports; `main.tsx` now loads the simulator, i18n and router with `await import()` after the call, which gives 0), DR-95b-2 (F-62-06 stays a known issue), DR-95b-3 (`BUILD-INPUTS.txt` + `--verify-inputs`), DR-95b-4 (launcher tests not re-run: they bind 4410/4411; launcher byte-identical)
