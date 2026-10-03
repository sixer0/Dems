---
task_id: 2026-09-30_dems_demo_stack_setup
task_slug: dems_demo_stack_setup
step: 62
plan_row: blueprint row 62 (rev 6), plus masterplan/06_packaging_spec.md §6.2 (review 62 additions)
date: 2026-10-01
agent: security-review
mode: FAST-TRACK (D112), read-only
narrative_tier: 2
verdict: CAUTION
status: complete
decisions: D44, D45, D50, D51, D74, D94, D104, D110, D112, D113, D118
---

# 02 Security review: web build, launcher and web packages (step 62)

## 1. Verdict

**CAUTION.** No High or Critical finding. No FAIL.

- The launcher's network exposure is sound in a live test: loopback bind only, Host and WS Origin allowlists, the 32-client cap, and no traversal or file leak.
- The CSP and the other security headers are byte-correct on live responses.
- Binary provenance holds for all four Node v26.8.2 platforms.
- No key material, seed bytes, keystore passwords or secrets were found in the tree, in `release/` or in the packages. Each scan ran with a planted positive control.
- Two **Medium** findings need an owner before the packages go to another party. Both are licence-notice completeness issues, not exploitable flaws: F-62-01 (THIRD_PARTY_NOTICES lacks the D74 corrections) and F-62-02 (npm dependency and font licence texts are not shipped).
- Six **Low** findings are recorded as known issues or as fix hand-overs (§5).

| Count | Value |
|---|---|
| Total findings | 8 (plus 5 informational notes) |
| Critical / High | 0 / 0 |
| Medium (CAUTION) | 2 |
| Low | 6 |
| GDPR non-compliances | 0 (synthetic data only; see §6) |
| ISO control gaps | 1 (A.18 licence compliance, the same issue as F-62-01/02) |

## 2. Scope, method and constraints

**In scope:**
- `apps/core-web/**` and `apps/mock-core/**`, including `standalone/dems-web-launcher.cjs`;
- `packages/shared/**` (sim, api, demo-data, demo-evidence, scripts);
- `scripts/release/build-web-packages.ts`;
- `release/web/**` (6 packages) and `release/RUN-ON-ANOTHER-PC.md`;
- `.gitignore` and `THIRD_PARTY_NOTICES.md`;
- logs 08–33, 64–66, 70 and 73 (read for context and hand-overs addressed to step 62).

**Method:**
1. **Static review.** I read the launcher (all 1,015 lines) and the packager (all 709 lines). I also read the key spots in core-web and shared (Scalar config, CSP module, auth storage).
2. **Package inspection.** I verified `release/web/SHA256SUMS.txt`, extracted all 6 packages into the session scratchpad (`/private/tmp/claude-501/…/scratchpad/s62/pk`, outside the workspace), and inventoried their contents.
3. **Live test.** I ran the macOS arm64 SEA from that copy, always with `--no-open`, on 127.0.0.1:4410. I probed it with raw-socket HTTP and WebSocket requests from a scratch script (§9). I stopped it with SIGINT and confirmed no listener was left.
4. **Provenance.** I fetched a fresh `SHASUMS256.txt` from nodejs.org and re-hashed the cached archives and every shipped Node binary. I checked the Apple code signatures and the Windows Authenticode signer.
5. **Scans.** Secrets, key material and credentials, each with a planted positive control (D44): `git grep` (tracked plus untracked-not-ignored) and `/usr/bin/grep`. Then `npm audit --omit=dev` per workspace, `git check-ignore`, and a search for design-book text using 10-word shingles.

**Constraints and deviations:**
- **Sandbox bypass for the live run.** The sandbox refuses local `listen` (EPERM, as steps 95 and 100 recorded), so the live launcher run used a per-command sandbox bypass. The `codesign` signature checks were also re-run outside the sandbox. Inside it they report "invalid signature, Authority=(unavailable)" for **every** official Node binary, including the system `/usr/local/bin/node`. That is a sandbox artefact, not a property of the files.
- **No repository files were changed.** The only files written are this report and `delegation_progress/security_review_step_62.md`. Scratch files live in the session scratchpad.
- **Incident (no effect).** One read-only `brew leaves` call, made with `HOMEBREW_NO_INSTALL_FROM_API=1` set, tried to tap `homebrew/core`. The sandbox blocked the write ("Operation not permitted"). `/opt/homebrew/Library/Taps/homebrew/` still does not exist, so the host is unchanged.
- **Not repeated under the fast-track:**
  - the full browser CSP walk and the network log (step 95's run is cited; step 96 owns the re-run);
  - running the Windows, Linux and Intel-Mac binaries (static checks only, F-12);
  - cryptographic Authenticode verification of `node.exe` (no `osslsigncode`; the signer chain is shown instead).

## 3. Checklist results

### 3.1 Launcher network exposure

| Item | Result | Evidence |
|---|---|---|
| Binds 127.0.0.1 only; no interface override | **PASS** | `dems-web-launcher.cjs:43` `HOST = '127.0.0.1'`, `:618` `server.listen({ host: HOST, port, exclusive: true })`. A grep for `process.env` in the launcher finds nothing. Live: `lsof -nP -a -p 38792 -i` shows only `TCP 127.0.0.1:4410 (LISTEN)`. `curl` to `192.168.0.33:4410`, `100.87.25.85:4410` and `[::1]:4410` exits 7 ("Couldn't connect"). `--host 0.0.0.0` and `--listen 0.0.0.0` give "unknown option", exit 1 |
| Host allowlist (DNS rebinding) | **PASS** | `:410` admits only `127.0.0.1:<port>` and `localhost:<port>`. Live: Host `evil.example:4410`, `evil.example`, `127.0.0.1` (no port), `127.0.0.1:4411`, `localhost.:4410`, `[::1]:4410`, `192.168.0.33:4410`, and HTTP/1.0 with no Host all get **421**, with the security headers. `localhost:4410` gets 200 |
| WS Origin check | **PASS** | `:412-413` (Origin absent, `http://127.0.0.1:<port>` or `http://localhost:<port>`); the upgrade path checks Host first (`:554`). Live: own origin, localhost origin and no Origin → 101. Foreign origin, `null`, `https://127.0.0.1:4410`, `http://127.0.0.1:4410.evil.example` and the wrong port → **403**. Wrong Host on upgrade → 421. `/ws/../x` → 404. Version 8 → 426 |
| 32-client cap | **PASS** | `:46`, `:565`. Live, after a settle: baseline 0 clients; 32 accepted, the 33rd gets **503**; health reports `clients 32`; the slots return to 0 within 1,510 ms after the clients close (informational I-1) |
| WS frame hardening | **PASS** | `:327-336`. Live: unmasked frame → close **1002**; 70,000-byte frame → **1009**; fragmented frame → **1003**; a 2^63 length header → **1009** with no allocation; RSV bit → 1002; a 200 B ping → 1002. Health is still 200 afterwards |
| No directory traversal | **PASS** | By construction, requests are looked up in an in-memory map; a filesystem path is never built from a URL (`:474`). The decoded-path guard at `:445-456` rejects `..`, `.`, `\` and NUL segments. Live, 16 encodings all → **404** with no file content: `..%2f`, `..%2F`, `%2e%2e/`, `%2e%2e%2f`, `/assets/..%2f..%2fweb-manifest.json`, `/assets/..%2f..%2fdems-web-launcher.cjs`, raw `/../../`, `/./`, `%5c` (backslash), `%00`, overlong UTF-8 `%c0%ae`, `%ZZ`, double-encoded `%252f`. An absolute-form request target `GET http://127.0.0.1:4410/../../etc/passwd` → 404; `GET http://evil.example/` → 404 (no proxying) |
| SPA fallback does not leak files outside dist | **PASS** | `:477-481`: a last segment with no dot serves `index.html` only. Live: `/etc/passwd`, `/etc/hosts`, `//etc/passwd`, `/%2fetc%2fpasswd` and `/private/etc/passwd` each return 200 with a body **byte-equal to the dist `index.html`** (3,416 B). Dotted paths (`/Users/gsp-budi/Documents/DEMS/package.json`, `/.gitignore`, `/C:/Windows/win.ini`, `/.env`, `/web-manifest.json`, `/dems-web-launcher.cjs`, `/node_modules/.package-lock.json`) → **404**. Methods POST, PUT, DELETE, OPTIONS and TRACE → 405 with `Allow: GET, HEAD`, never `Access-Control-Allow-Origin`; CONNECT is rejected |
| Single-instance mechanism safe | **PASS** (I-2 noted) | `:627-642` probes only `127.0.0.1` on the busy candidate port, needing 200 plus `X-DEMS-Launcher`; `:954-966`. Live: copy B (fresh extract) printed "already running: http://127.0.0.1:4410/" and exited 0. A strict `--port 4410` on the busy port exits 1 with a clear message. The browser opener only runs URLs matching `^[0-9a-z.:/]+$` (`:646`) and uses an argv array (no shell) except on Windows, where the URL character set prevents injection |
| Launcher writes no files | **PASS** | No write API in the source: the grep for `writeFile`, `appendFile`, `createWriteStream`, `mkdir`, `rename`, `unlink`, `copyFile`, `openSync`, `fs.write`, `chmod` and `symlink` matched only a comment at `:147` (positive control: `readFileSync` matched 2). Live: `find <package dir> <cwd> -newer <marker>` after a full run (start, probes, second instance, SIGINT) → **none** |
| No env config; `execArgvExtension:"none"`; runtime scripts unset `NODE_OPTIONS` | **PASS** for the launcher process; **Low** gap in the any-OS sh script (F-62-05) | SEA config `build-web-packages.ts:288` and BUILD-INFO `sea-config …"execArgvExtension":"none"` on all 3 targets. Live: with `NODE_OPTIONS="--require inject.cjs"`, plain `node -e 0` prints `INJECTED-BY-NODE_OPTIONS` (positive control); the SEA `--version` prints no injection. The any-OS `Start (macOS).command` printed `INJECTED pid=39192 argv=[]`: the **pre-check** `node -e` (argv empty) is injected, the launcher process is not (`build-web-packages.ts:481-482`). The Intel `.command` (`:429`), F1 `.cmd` (`:446`) and any-OS `.cmd` (`:468`) unset it before any `node` call |

### 3.2 Security headers on a live response

| Item | Result | Evidence |
|---|---|---|
| CSP from `packagedCsp` byte-equal | **PASS** | The live header and `packagedCsp({delivery:'header',port:4410})` (evaluated with tsx from `apps/core-web/src/lib/packaged-csp.ts`) have the **same SHA-256, `7527e3ac788e5fc1…86d7`**. Launcher source: `dems-web-launcher.cjs:88-103` |
| nosniff, no-referrer, COOP, CORP, Permissions-Policy | **PASS** | Live `GET /`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. The probe confirmed all six headers also on `/api/v1/health`, 421, 404, 304 and 206 responses (`send()` merges them on every response, `:422-431`) |
| CSP meta tag in `index.html` | **PASS** | It equals `packagedCsp({delivery:'meta'})` exactly (`connect-src … ws://127.0.0.1:* ws://localhost:*`, no `frame-ancestors`). It has one `<script type="module" src="/assets/index-Cvv0hQii.js">`, no inline script, no inline event handler and no external `src`/`href` |

### 3.3 CSP violations (the Zod `Function('')` probe)

**Result: Low, known issue (F-62-03). The CSP is not widened, which is correct.**
- The dist has exactly **one** eval-like sink in all 270 JS files: `assets/clsx-5EdaupDn.js` at offset 2163, `try{return Function(``),!0}catch{return!1}`. This is Zod 4.6.5's capability probe.
- There is no `new Function(` and no `eval(` anywhere else in the dist (python scan).
- Step 95's browser walk logged 28 reports, all of this one kind, 2 per page load (log `70_web_packager.md` §4), with no functional impact.
- **Recommendation (known issue, not an eval allowance):** call `z.config({ jitless: true })` once at the top of `apps/core-web/src/main.tsx`, before any schema runs. Zod 4.6.5 supports it (`node_modules/zod/v4/core/core.d.ts:70` `jitless?: boolean`); `main.tsx` does not set it today. Then rebuild the packages and confirm 0 reports in a CSP walk.
- `'unsafe-eval'` must not be added.

### 3.4 Binary provenance

| Item | Result | Evidence |
|---|---|---|
| Official archives vs nodejs.org SHASUMS256 (4 platforms) | **PASS** | Fresh `curl https://nodejs.org/dist/v26.8.2/SHASUMS256.txt` (10:52 WIB): SHA-256 `c31cbd53…7dad3`. This equals the cached copy and BUILD-INFO. Its lines, which equal `shasum -a 256` of the cached archives: `974b6d5f…c9e1` darwin-arm64.tar.gz, `adb8feb2…629c` darwin-x64.tar.gz, `badb3fe6…6f35` linux-x64.tar.gz, `cf02f5d0…9085` win-x64.zip, `23062343…dbca` `win-x64/node.exe`. All 5 also equal spec §10.2 |
| Unmodified runtimes byte-identical | **PASS** | macOS x64 `runtime/node` = `724b8ccb…265f` = the binary extracted from the verified tarball. Outside the sandbox, `codesign --verify --strict` gives "valid on disk / satisfies its Designated Requirement", `Authority=Developer ID Application: Node.js Foundation (HX7739G8FX)`, timestamp 9 Sep 2026. F1 `runtime/node.exe` = `23062343ad39…ddbca` = SHASUMS `win-x64/node.exe`. Its Authenticode PKCS#7 (extracted from the PE security directory) names signer `CN=OpenJS Foundation` and chain `Microsoft ID Verified CS EOC CA 04`. In the 5 packages that ship Node, `licenses/NODE-LICENSE.txt` equals the official archive's `LICENSE` |
| SEA binaries built from those bases, launcher embedded unchanged | **PASS** | Each of the 3 SEA binaries contains the fuse `…:1` (count 1, `…:0` count 0), the marker `DEMS_WEB_LAUNCHER_BUILD=0.1.0` (count 1), and the **complete launcher source byte-for-byte**: offsets 102,334,568 (macOS arm64), 103,886,528 (Windows), 150,436,268 (Linux). The launcher SHA-256 `091a2001…4f16` is the same in the source tree, in BUILD-INFO and in all 3 runtime packages. The macOS arm64 SEA has `Signature=adhoc`, "valid on disk" |
| SEA injection tool pinned | **PASS** | The injector is Node's built-in `--build-sea` (`build-web-packages.ts:294`). There is no `postject` (`node_modules/postject` absent). The builder is `/usr/local/bin/node` v26.8.2 from the official installer: `pkgutil --pkg-info org.nodejs.node.pkg` → `version: v26.8.2`, a universal binary, Developer ID Node.js Foundation (HX7739G8FX) valid. The version is pinned fail-closed at `build-web-packages.ts:105` |
| Packager fails closed and pins the download host | **PASS** | Only `https://nodejs.org/dist/v26.8.2/` may be fetched (`:206`). An archive mismatch makes the build fail (`:230`), and so does a `node.exe` mismatch (`:241`) |
| GPG signature of SHASUMS256 | **Residual risk (I-3)** | gpg is absent (`which gpg gpg2` → not found). Mitigations: the fresh re-fetch matches, both macOS binaries carry a valid Apple Developer ID signature, and the `node.exe` signer is OpenJS Foundation |
| No unexpected executables | **PASS** (F-62-06 noted) | Files with the exec bit: the 3 SEA binaries, `runtime/node` (Intel), `DEMS Web Demo (Intel).command`, `Start (macOS).command` and `start-linux.sh`; `node.exe` and the `.cmd` scripts are Windows files. Every `web/` tree has **0** exec-bit files, and `file` finds no Mach-O, ELF or PE in the dist: 270 js, 58 jpg, 29 m4a, 28 mp4, 15 css, 14 json, 13 woff2, 2 svg, 1 zip, 1 jsonl, 1 html. The one zip (`EXP-000031`) holds only json, jsonl, pem, sig, m4a and mp4. The Windows SEA exe keeps a stale certificate directory (F-62-06) |

### 3.5 No external requests from the web build (AC-57, D45)

**Result: PASS.**
- **index.html.** No external `src` or `href`.
- **Entry chunk.** `index-Cvv0hQii.js` contains only `http://www.w3.org` (an XML namespace) and `https://react.dev` (an error-message URL).
- **Lazy Scalar chunks.** External host strings (`*.scalar.com`, `cdn.jsdelivr.net`, `fonts.scalar.com`, example hosts) appear only as string literals there: `add-scalar-classes-*.js` 206, `slugger-*.js` 38, `client-*.js` 21, `scalar-renderer-*.js` 15, and so on. These are defaults, snippet templates and documentation links.
- **Scalar configuration.** Telemetry, CDN fonts, proxy, agent, MCP and developer tools are all off in `apps/core-web/src/features/api-reference/scalar-config.ts:25-31`: `telemetry: false`, `withDefaultFonts: false`, `showDeveloperTools: 'never'`, `agent: { disabled: true }`, `mcp: { disabled: true }`, `persistAuth: false`, `hideClientButton: true`.
- **Enforcement.** The live CSP has `default-src 'self'`, `connect-src 'self' ws://127.0.0.1:4410 ws://localhost:4410`, and `img-src`/`font-src` limited to self/data/blob, so the browser blocks any external fetch.
- **Runtime evidence (step 95).** 1,247 requests, hosts = {`http://127.0.0.1:4410`, `ws://127.0.0.1:4410`} (`70_web_packager.md` §4).
- **Launcher.** It has no outbound code. Its only `http.get`/`net.connect` calls target `HOST` = 127.0.0.1 (`:629`, `:709`, `:730`). During the live run, `lsof` showed no outbound socket.

### 3.6 DEMO key handling (D50, D51)

**Result: PASS.**
- **Derivation.** The DEMO Ed25519 key is derived in memory from the published phrase `DEMO_SEED_PHRASE` (`packages/shared/scripts/gen-demo-evidence.ts:126-127`; seed = SHA-256 of the phrase, `:351-354`, `createPrivateKey` from an in-memory PKCS#8 wrapper). It is never exported.
- **Pre-publish guard.** The generator refuses to publish if any staged file contains "PRIVATE KEY" (`:1456`). The test does the same (`packages/shared/test/demo-evidence.test.ts:253`).
- **Seed bytes scan.** I derived the seed as hex, base64, base64url and PKCS#8-base64. A `/usr/bin/grep -rlaF -f` over `release/`, the 6 extracted packages (SEA binaries included), the dist and the extracted export zip → exit 1. `git grep --untracked` over the tree → exit 1. Positive control: a planted file is found by both tools.
- **PEM private keys.** The PEM header regex `-----BEGIN [A-Z ]*PRIVATE KEY-----` finds nothing in the tree (`git grep --untracked` exit 1). The plain string "PRIVATE KEY" occurs on 6 lines, all guard code (`gen-demo-evidence.ts:1456`), a test assertion (`demo-evidence.test.ts:253`) or docs prose. In the packages, the only hits are bare header string literals inside the Node binaries. They are also present in the untouched official `node` from the tarball, with no key body.
- **Certificates.** All **16** certificates found in the dist, `packages/shared/assets` and the export zip have subject `O=DEMS Demo (synthetic), OU=DEMO — NOT FOR PRODUCTION, CN=DEMS-IR-01 (DEMO — NOT FOR PRODUCTION)` and are Ed25519.
- **Signature files.** All **15** `.sig` files have `"demo": true`, `keyId DEMO-KEY-EVSIGN-01` and the notice "DEMO SIGNATURE - made with the published DEMO key …".
- **The phrase is public by design (D51).** It is the generator's own constant, so anyone can re-sign. That is intended and labelled, and the key is never presented as real.

### 3.7 Credentials never persisted (AC-50); the demo password

**Result: PASS.**
- **Auth record.** It stores only `{ operatorId, issuedAt }` (`packages/shared/src/sim/platform.ts:122-127`).
- **Password check.** The password is compared once (`packages/shared/src/sim/auth.ts:292`) and only a boolean is passed on.
- **Login form.** It intercepts submission (`apps/core-web/src/features/login/auth-card.tsx:145-146`), uses `method="post"` (`:186`), and its inputs have no `name`. CSP `form-action 'self'` applies, and the launcher answers POST with 405.
- **Where `demo-2026` appears:**
  - the constant `packages/shared/src/sim/dataset.ts:153`;
  - the demo disclosure on Login (`auth-card.tsx:427`, i18n `login.ts:37` "Demo password: {{password}}");
  - the dist chunk `sim-*.js`;
  - test fixtures (core-web and mobile tests);
  - the docs: `release/RUN-ON-ANOTHER-PC.md`, `release/android/INSTALL-ANDROID.md`, and each package's `README-FIRST.txt`.
- **Classification.** These are intentional, published DEMO values. The generic credential-assignment scan (13 hits; positive control found) showed nothing else: only i18n keys, test fixtures, `TOKEN = '\u0000'` placeholders and this constant.

### 3.8 Secrets scan of the tracked tree and `release/` (D44)

**Result: PASS.**

| Scan | Scope | Result | Positive control |
|---|---|---|---|
| DEMO seed bytes (4 encodings) | `git grep --untracked` (178 tracked + 2,088 untracked-not-ignored files) | exit 1 | `git grep --no-index` on the planted file: found |
| Same | `/usr/bin/grep -rla` over `release/`, the extracted packages, the dist and the export zip | exit 1 | planted file: found |
| PEM private-key header | tree | exit 1 | found |
| Same | packages | only bare literals inside the Node binaries (also in the official binary) | found |
| AWS, GitHub, Slack, Google, Stripe token shapes | tree (`:!package-lock.json`) | exit 1 | — |
| Same | packages: text files, launcher, dist | exit 1 | — |
| DEMO keystore password values (value never printed; piped from the git-ignored properties file via process substitution) | tree, `release/`, packages, `docs/` | exit 1 | 2 matches in the properties file itself |
| Key or secret file names (`*.keystore`, `*.jks`, `*.p12`, `*.pfx`, `*.key`, `*.pem`, `.env*`, `*.docx`, `*.map`, `*signing*`, `*.properties`, `.DS_Store`, `._*`) | `release/` and packages | only `release/.DS_Store` (git-ignored, not inside any package) and the DEMO `device-certificate.pem` inside the export zip | — |
| Design-book text | dist (all text assets), packaged notices, README-FIRST, RUN guide, BUILD-INFO, INSTALL-ANDROID, export record | 0 of 110 paragraphs of 80 characters or more found verbatim; 0 of 6,952 10-word shingles | planted paragraph: found |
| Source maps | dist | 0 `.map` files, 0 `sourceMappingURL` | — |

### 3.9 `npm audit --omit=dev` (core-web, mock-core, shared)

**Result: Low, accepted, known issue (F-62-04).**

| Workspace | Critical | High | Moderate | Low |
|---|---|---|---|---|
| @dems/core-web | 0 | 1 | 9 | 5 |
| @dems/mock-core | 0 | 1 | 1 | 0 |
| @dems/shared | 0 | 1 | 1 | 0 |

**The one high advisory, in all three workspaces:** `undici@7.29.0` (10 GHSAs, including GHSA-rfgv-xxqx-mfg5 and GHSA-w293-vg96-wgc3; fixed in 7.29.1).
- **Where it sits.** `node_modules/@scalar/json-magic/node_modules/undici`. It is reached from `@dems/shared` via `@scalar/openapi-parser@0.29.9 → @scalar/json-magic@0.15.3`, and from core-web via `@scalar/api-reference` (`npm ls undici @scalar/json-magic --all`).
- **Not in the shipped bundle.** The only "undici" strings in the dist are Scalar's code-snippet generator entries (`client:'undici'`, `import { request } from 'undici'` templates, `node/undici`). This matches step 53's S53-6.
- **Not exploitable in the offline localhost demo.** undici is a Node HTTP client, used by json-magic's Node-only `fetch-public-url` plugin at build and test time on local files. The launcher has no npm dependencies, and mock-core is a dev server that is not packaged.
- **Moderates and lows.** They are Scalar packages that inherit the advisory, plus `@ai-sdk/provider-utils` (GHSA-866g-f22w-33x8, low) under `@scalar/agent-chat`. The agent is disabled (`scalar-config.ts:28`), and step 95's run made no agent request.
- **Fix availability.** npm reports `fixAvailable: true` for shared and mock-core, `false` for core-web. There are no downgrades below the pins (D45).

### 3.10 `.gitignore` coverage

**Result: PASS, with a Low gap (F-62-07).** `git check-ignore -v`:

| Path | Ignored by |
|---|---|
| `release/probe`, `release/web/x.zip`, `release/android/x.apk` | `.gitignore:61 /release/` |
| `apps/mobile/signing/release-signing.properties` and `…/dems-demo-release.p12` | `.gitignore:62` |
| `x.docx`, `docs/x.docx`, the design book | `.gitignore:9 *.docx` |
| `.env` | `:37` |
| `.env.local`, `apps/core-web/.env.production` | `:38 .env.*` |
| `foo.keystore` | `:31` |
| `apps/mobile/foo.jks`, `apps/mobile/foo.p12` | `apps/mobile/.gitignore:15,17` |
| `.cache/release/x` | `:44` |
| `.locks/x` | `:56` |
| `graft/x` | `:2` |

- **Correctly not ignored:** `.env.example` (re-included by the `!.env.example` rule), `scripts/release/build-web-packages.ts`, `apps/mock-core/standalone/dems-web-launcher.cjs`, `THIRD_PARTY_NOTICES.md`.
- **Tree check.** No `.docx`, `.env*`, keystore, `.p12`/`.pfx`, `release/` or `signing/` path is tracked or untracked-not-ignored (grep exit 1).
- **Gap (F-62-07).** `foo.p12`, `apps/core-web/foo.p12`, `foo.pfx` and `foo.key` at those locations are **not** ignored.

### 3.11 THIRD_PARTY_NOTICES completeness

**Result: CAUTION (F-62-01, F-62-02).**

| Required item | Present? | Evidence |
|---|---|---|
| Pexels photo (hero still) | Yes | "Media assets" table: Pexels 3906592, Leandro Alamino, Pexels License, hashes of both derivatives |
| Videos derived from the Pexels photo (VIDEO-01/02, posters, thumbnails, export payloads) | **No** | `grep -c -i -E "espeak\|VIDEO-0\|derived\|demo video\|Node\.js" THIRD_PARTY_NOTICES.md` → 0. The section still says the files "are only resized and re-encoded … never baked into the files". That is no longer true: step 92 bakes crops, grade, noise, vignette and OSD into 28 mp4 files and their posters (`64_demo_media.md` §4; `media-index.json` `source.still = room-2560.jpg`) |
| eSpeak NG voice output; no macOS voices | **No** (the facts are true, the notice is missing) | `media-index.json`: all 26 voice entries (13 items × interviewer and subject) have `engine: espeak`; `tools.voice` is `espeak-ng 1.52.0`. A grep for `Damayanti\|say -v\|com.apple.speech` over the assets and the dist → exit 1. The notices file says nothing about either. D74 routed this to step 60, but the file's mtime is still `Oct 1 03:23:43` (before steps 92/93) |
| 13 copy-in items (plus BorderBeam and SlidingNumber) | Yes | 13 rows in the "step 37" table plus the 2 earlier rows, with MIT texts reproduced |
| Node runtime licence in the packages | Yes | `licenses/NODE-LICENSE.txt` in the 5 packages that ship Node, byte-equal to the official `LICENSE`. F2 ships no Node, by design |
| Packaged copy matches the repo file | Yes | `licenses/THIRD_PARTY_NOTICES.md` in all 6 packages = repo file, SHA-256 `4c5cbdfd…` (7 identical hashes). The gaps above therefore ship too |
| npm dependency licences (React, Scalar, Zod, TanStack, Motion, i18next and others) and OFL-1.1 fonts (Inter, JetBrains Mono, Orbitron) | **No** in the packages | The notices file defers to "licence files inside `node_modules`", but `node_modules` is not distributed. Only 3 dist JS files keep any `@license` or `/*!` header. No `*.LICENSE.txt` is emitted. The 13 woff2 files ship without the OFL text (whether the woff2 metadata carries it was not verified: no brotli or fontTools here) |

### 3.12 Other row-62 and §6.2 items

| Item | Result | Evidence |
|---|---|---|
| Package contents free of secrets, maps and design-book text (V-S5) | **PASS** | §3.8. Never-inside list (06 §3.7): no `.map`, `.env*`, `signing/**`, keystore, `*.docx`, `docs/`, `node_modules/` or repo source other than the launcher. Full inventory in §9.2 |
| RUN guide confidentiality advice | **PASS** | `release/RUN-ON-ANOTHER-PC.md:28` "Copy the file by **USB stick or a local network share**, not by cloud upload or chat (confidentiality)"; ID summary at `:109`; Play Protect "install without sending" at `:72` |
| Packager checks (no maps, CSP equality, no inline script, release ignored) | **PASS** | `build-web-packages.ts:106-107`, `:149-150`, `:154-155`, `:156-163` |
| Dev stack and host listeners loopback-only | **PASS** | `lsof -nP -iTCP -sTCP:LISTEN` (about 11:07 WIB): mock-core `127.0.0.1:4400`, Vite `127.0.0.1:5173` (`vite.config.ts:18`), Metro `127.0.0.1:8081` (`expo start --localhost`), a launcher PID started 11:05:23, after my runs had ended (step 96's parallel run), on `127.0.0.1:4410`, adb `127.0.0.1:5037`, emulators on `127.0.0.1` and `[::1]` only. `MOCK_CORE_HOST = '127.0.0.1'` (`packages/shared/src/api/constants.ts:8`). One `*:3000` listener belongs to a process from another workspace outside `/Users/gsp-budi/Documents/DEMS`; it is not part of DEMS and was not assessed |
| `~/.zprofile` diff limited to blocks A and B | **PASS** | 21 lines, SHA-256 `e8543f6d…2cd`, equal to the post-row-9 value in `07_js_runtime.md:55`. Against the backup `~/.zprofile.bak.dems-2026-09-30-235451` (`84ff8ea5…75f0`): 0 lines removed, 10 added, all inside `# >>> dems-demo: jdk` and `# >>> dems-demo: android sdk` markers (`JAVA_HOME`, `ANDROID_HOME`, 2× `PATH`). `~/.zshrc` is absent |
| ffmpeg host install limited to step 92's formulae | **PASS** | `brew list --versions` shows exactly the 14 formulae and versions logged in `64_demo_media.md` §2 (ffmpeg 9.0.2, espeak-ng 1.52.0, dav1d 1.5.4, lame 4.0, libvmaf 3.2.1, libvpx 1.17.0, mpg123 1.33.7, opus 1.6.1, pcaudiolib 1.3, sdl2-compat 2.32.72, sdl3 3.4.16, svt-av1 4.2.0, x264 r3222, x265 4.3). The rollback command is at `64_demo_media.md:102` |
| `@scarf/scarf` absent | **PASS** | `node_modules/@scarf` absent; `npm ls @scarf/scarf --all` → `(empty)` |
| Packages reflect the reviewed source | **PASS** for the shipped content; **Low** for provenance (F-62-08) | The launcher hash in packages = source = BUILD-INFO. The three runtime `web/` trees are identical to each other and to `.cache/release/web-dist` (`diff -rq`), and the manifest is identical everywhere (`9c89f80a…`). Only `scripts/release/build-web-packages.ts` is newer than the build (mtime 10:48:10 vs dist 10:43:03) |

## 4. Live-test summary

| Run | Result |
|---|---|
| Probe run 1 (77 checks) | 72 PASS. The 5 "failures" were a harness timing artefact: WS sockets from the earlier origin tests were still half-open, so the cap was reached early and the framing tests got 503. The launcher behaved correctly |
| Probe run 2 (WS cap and framing, with a settle wait) | 10/10 PASS |
| Raw outputs | §9.1 |

## 5. Issues found

| ID | Severity | Type | Location | Description | Remediation | Owner |
|---|---|---|---|---|---|---|
| F-62-01 | Medium (CAUTION) | Licence notice, A.18 | `THIRD_PARTY_NOTICES.md` ("Media assets" section); `licenses/THIRD_PARTY_NOTICES.md` in all 6 packages | The D74 corrections are missing: the videos, posters and thumbnails derived from the Pexels photo (with baked-in grade and OSD), the eSpeak NG 1.52.0 voice output for AUDIO-01/02, and the statement that no macOS system voices are used. The text "never baked into the files" is now inaccurate. Legal risk is low: Pexels needs no attribution, and eSpeak NG formant output is not GPL-encumbered (GPL FAQ, `64_demo_media.md:120`). This is a documentation and accuracy gap that ships to recipients | Add a "Generated demo media" section listing the derived VIDEO/poster/thumbnail files (source: the Pexels still, generator `packages/shared/scripts/gen-demo-media.ts`), the eSpeak NG 1.52.0 `id` voice output (GPL-3.0 tool, output not covered; no voice data stored) and "no macOS system voices (D51)". Correct the "never baked" sentence. Then re-run the packager (or re-stage `licenses/` and regenerate `SHA256SUMS.txt`) | **Step 60** (README and notices, fast-track minimal), then a packager re-run. If not done before the demo: **known issue** |
| F-62-02 | Medium (CAUTION) | Licence notice, A.18 | packages: no npm-dependency or font licence texts; `THIRD_PARTY_NOTICES.md:5` defers to `node_modules` | The bundled MIT, ISC, Apache and similar dependency code and the OFL-1.1 fonts ship without their licence texts | The packager collects the `LICENSE*` files of the production dependency tree of `@dems/core-web` (`npm ls --omit=dev --all --json` plus the `@fontsource-variable/*` OFL files) into `licenses/WEB-DEPENDENCIES.txt` in every package. Alternatively, a Vite legal-comments or licence plugin (needs an install, so post-demo) | **Known issue** (post-demo packager change) |
| F-62-03 | Low | CSP report (cosmetic) | `.cache/release/web-dist/assets/clsx-5EdaupDn.js:1` (Zod 4.6.5 probe); `apps/core-web/src/main.tsx` | 2 `script-src` eval reports per page load from Zod's caught `Function('')` capability probe. No functional effect. The CSP is correctly not widened | Call `z.config({ jitless: true })` at the top of `main.tsx`, rebuild, and confirm 0 reports in a CSP walk. Never add `'unsafe-eval'` | **Known issue** (core-web, post-demo or the next package rebuild) |
| F-62-04 | Low (accepted) | Dependency advisory | `node_modules/@scalar/json-magic/node_modules/undici@7.29.0` | 1 high advisory (10 GHSAs) in the prod tree of all three workspaces. Not in the shipped bundle and not reachable offline (§3.9). 0 critical | Bump `@scalar/openapi-parser` / `@scalar/json-magic` (or add an undici ≥ 7.29.1 override) once compatible. No downgrade below the pins (D45) | **Known issue** (post-demo dependency update) |
| F-62-05 | Low | Defence in depth | `scripts/release/build-web-packages.ts:477-483` (any-OS `Start (macOS).command`, `start-linux.sh`) | The `node -e` version check runs before `env -u NODE_OPTIONS`, so a hostile `NODE_OPTIONS` runs code in that check process (proved live: `INJECTED … argv=[]`). The launcher process itself is clean. Exploiting it needs control of the user's environment already | Add `unset NODE_OPTIONS` right after `cd` in the sh body, matching the `.cmd` scripts. Rebuild | **Known issue** (packager fix at the next rebuild) |
| F-62-06 | Low | Packaging robustness | `DEMS Web Demo.exe` (SEA): the PE security directory still points at offset 103,746,048 (15,688 B), which now holds zeros | The SEA exe carries a dangling or invalid Authenticode directory. SmartScreen and antivirus treat it as unsigned or tampered. Already noted by step 95; the F1 fallback covers it | Clear `IMAGE_DIRECTORY_ENTRY_SECURITY` in `base-node.exe` before `--build-sea` (or `signtool remove /s` on a Windows host) | **Known issue** (packager) |
| F-62-07 | Low | Repository hygiene | `.gitignore` | `*.p12`, `*.pfx` and `*.key` are not ignored outside `apps/mobile/` (`foo.p12` and `foo.pfx` at the root are not ignored). No such file exists today | Append `*.p12`, `*.pfx`, `*.key` (and optionally `*.mobileprovision`) to the root `.gitignore` | **Step 66** (before staging), or **known issue** |
| F-62-08 | Low | Build provenance | `scripts/release/build-web-packages.ts` mtime 10:48:10 > build 10:43:01 | The packager source in the tree is newer than the run that produced the packages. Package content was verified independently (§3.4, §3.12), but the exact script that built them is not preserved | Step 66's "no source changed after the packages were built" check must record this. Either re-run the packager (preferred, together with F-62-01) or note that only the RUN-guide text changed (`release/RUN-ON-ANOTHER-PC.md` mtime 10:48) | **Step 66** |

**Informational notes (no action required for the demo):**
- **I-1.** After a client vanishes, a WS slot stays counted until the next heartbeat write fails (≈1.5 s; server sockets are half-open after the peer's FIN). The cap still holds. A small hardening: handle `'end'` in `WsClient`.
- **I-2.** The single-instance probe trusts any loopback process that answers health with `X-DEMS-Launcher`. A local squatter could steer the browser, but only with local code execution.
- **I-3.** The GPG signature of `SHASUMS256.txt` was not verified (no gpg). It is mitigated by the fresh re-fetch and the Apple and OpenJS signatures (§3.4). Recorded in BUILD-INFO.
- **I-4.** The dev mock-core (not packaged) has an Origin allowlist and CORS, but no Host allowlist. Loopback and dev only.
- **I-5.** Scalar's agent-chat UI code ships in a lazy chunk (`AgentScalarDrawer.vue-*.js`) but is disabled by config and was never requested in step 95's run.

## 6. GDPR assessment (demo scope: synthetic data only)

| GDPR article | Check | Status | Finding |
|---|---|---|---|
| Art. 5, data minimisation | PII fields | OK | Operators, subjects and cases are synthetic (`packages/shared/src/sim/dataset.ts`, the demo-evidence generator "synthetic"). No real person, voice or case. The voice is formant TTS of a fictional script |
| Art. 5, storage limitation | Retention | OK (demo) | Data lives only in browser storage for the launcher origin (sim snapshot, auth record `{operatorId, issuedAt}`). It is cleared by the browser or reset by changing the port |
| Art. 7, consent | Consent before processing | N/A | No real personal data is processed |
| Art. 15 / 16 / 17 / 20 | Access, rectification, erasure, portability | N/A (demo) | Must be designed before any real deployment |
| Art. 25, privacy by design | Architecture | OK | Offline, loopback-only, no telemetry (`scalar-config.ts:25`), no external requests (§3.5), no credentials persisted (§3.7) |
| Art. 32, security of processing | Technical measures | OK | Loopback bind, Host and Origin allowlists, CSP and isolation headers, integrity manifest with per-asset SHA-256 |
| Art. 33, breach notification | Alerting | N/A | No real data |
| Art. 35, DPIA | High-risk processing | N/A for the demo | **Required before production**: the real system records interviews, which is special-category-adjacent data |

## 7. ISO 27001 Annex A mapping

| Control | Status | Finding |
|---|---|---|
| A.9, access control | OK for a demo | Sim auth with a published DEMO password and role gating. Not production authentication (by design) |
| A.10, cryptography | OK | Ed25519 DEMO signatures and SHA-256 manifests, verified in-browser. The DEMO key is derivable by design (D51) and labelled. No TLS on loopback HTTP; acceptable for 127.0.0.1 |
| A.12.4, logging | OK | The launcher logs errors only, to stderr, and writes no files |
| A.12.6, vulnerability management | Partial | `npm audit` run: 1 high, not exploitable (F-62-04, known issue) |
| A.13, communications security | OK | Loopback only; DNS-rebinding defence (421); WS Origin allowlist (403); 32-client cap; frame limits |
| A.14.2, secure development | OK | 13 launcher contract tests (log 70); the packager fails closed on checksums, maps, CSP drift and inline scripts |
| A.16, incident management | N/A | Demo |
| A.18, compliance | **Gap** | Licence notices are incomplete in the distributed packages (F-62-01, F-62-02) |
| ISO 27701 (PIMS) | N/A | No real PII |

## 8. Remediation recommendations (priority order)

1. **F-62-01 (step 60, then a packager re-run).** Add the generated-media, eSpeak NG and no-macOS-voice notices, and fix the "never baked" sentence. Re-run `node --import tsx scripts/release/build-web-packages.ts` so every `licenses/THIRD_PARTY_NOTICES.md` and `SHA256SUMS.txt` is refreshed. This also closes F-62-08.
2. **At the same rebuild (optional, cheap).** F-62-05 (`unset NODE_OPTIONS` in the sh scripts) and F-62-03 (`z.config({ jitless: true })` in `main.tsx`), then confirm 0 CSP reports.
3. **F-62-07 (step 66).** Append `*.p12`, `*.pfx` and `*.key` to the root `.gitignore` before staging.
4. **Post-demo known issues.** F-62-02 (dependency and font licence bundle in the packages), F-62-04 (undici bump via Scalar), F-62-06 (clear the stale Authenticode directory before the Windows SEA build), and I-1.

## 9. Evidence appendix

### 9.1 Live probe output (macOS arm64 SEA, copy outside the workspace, `--no-open`, port 4410)

```
PID=38792 PORT=4410
lsof: DEMS\x20W 38792 gsp-budi 12u IPv4 … TCP 127.0.0.1:4410 (LISTEN)
curl 192.168.0.33:4410 exit 7 | curl 100.87.25.85:4410 exit 7 | curl [::1]:4410 exit 7
CSP live == packagedCsp(header,4410): BYTE-EQUAL   (sha256 7527e3ac788e5fc1e2102e600384f4e45f2925cf208bd3e193d3c0b2565b86d7 both)
PASS GET / 200 + body == dist index.html (3416 B) | PASS security headers on / and /api/v1/health
PASS Host evil.example:4410 / evil.example / 127.0.0.1 / 127.0.0.1:4411 / localhost. / [::1] / 192.168.0.33 / no Host -> 421
PASS Host localhost:4410 -> 200 | PASS POST PUT DELETE OPTIONS TRACE -> 405 (Allow: GET, HEAD), no ACAO | PASS CONNECT rejected
PASS traversal x16 -> 404 (bytes 10, no content) | PASS absolute no-dot paths -> SPA index.html only | PASS dotted absolute paths -> 404
PASS absolute-form targets -> 404 | PASS SPA fallback /dashboard /evidence/EV-0001 /developer/api /session/new (no-cache)
PASS missing asset 404 | PASS other /api/* 404 {"error":"not_found"} | PASS 304 / 206 / 416 / huge suffix range
PASS WS origins: own/localhost/absent 101; evil/null/https/suffix-trick/other-port 403; bad Host 421; /ws/../x 404; v8 426
run 1: SUMMARY 72/77 (5 harness-timing artefacts, see §4)
run 2: baseline clients 0 | WS cap 32 accepted, 33rd 503 | slots released after 1510 ms | 1002 unmasked | 1009 oversize
       | 1003 fragmented | 1009 2^63 header | 1002 RSV | 1002 ping>125 | healthy after | SUMMARY 10/10 passed
copy B: "DEMS Web Demo is already running: http://127.0.0.1:4410/"  exit 0
strict --port 4410 (busy): "port 4410 is already in use…" exit 1 | --host / --listen: "unknown option" exit 1
NODE_OPTIONS=--require inject.cjs: node -e 0 -> INJECTED (control) | SEA --version -> not injected
any-os Start (macOS).command -> "INJECTED pid=39192 argv=[]" (pre-check node -e), launcher line printed, not injected
SIGINT -> "A exited" | files newer than marker in package dir / cwd: (none) | post-run listeners 4410-4419: (none)
```

### 9.2 Package inventory (non-web files) and hashes

```
shasum -a 256 -c release/web/SHA256SUMS.txt -> 6x OK
launcher sha256 091a20013a40141e909dc4559a18e35bdd141bac2bcefcd67cb844533cce4f16 (source = 3 runtime packages = BUILD-INFO)
web-manifest.json 9c89f80acaf2185aa54a28c297193920194ecb7dd6869a6f54793065fc9af384 (3 packages = .cache)
runtime/node (macOS x64) 724b8ccb076a546d78d65752c80a0ee4e0270eeeb3d9fc1a5f3a265cacb0265f
runtime/node.exe (F1)    23062343ad39fc79f12ae39cfb324e93a20ced5f1d342e7b850c148c022ddbca
SEA macOS arm64 478543a1… | SEA Windows 3da64e8c… | SEA Linux 7f05cbfa… (= BUILD-INFO)
exec-bit files: 3 SEA binaries, runtime/node, 2x .command, start-linux.sh; web/ trees: 0
```

---
*Generated: 2026-10-01 11:15 WIB*
*Last Updated: 2026-10-01 11:15 WIB*
