---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: security-review-local
blueprint_row: 5
milestone: M0
class: A
tier: 2
status: completed
source_plan: docs/2026-10-07_dems_real_capture_sealing/identification/02_structured.md (row 5)
baseline_head: 2a4f4ea063d1a7c72d3fb70d4951fa63029e57a8
---

# Row 5 — B2 dependency triage (dependency advisories, analysis only)

Scope discipline honoured: no dependency was changed, no `npm audit fix` / `npm install` / `npm update` was run, `package-lock.json` and `node_modules/` are byte-identical to the baseline (proof in section 9). All audit commands were read-only (`--package-lock-only` plus one non-mutating installed-tree run; `npm view` for registry facts).

## 1. Headline numbers

| Metric | Value | Source |
|---|---|---|
| Toolchain | npm 11.19.1, node v26.8.2, auditReportVersion 2 | `npm --version`, `node --version` |
| Advisory DB snapshot | live registry query at 2026-10-07T06:4xZ (npm audit has no pinned snapshot) | `npm audit --json` |
| High (full tree, lock graph) | **54** vulnerable module entries / 59 install paths | `npm audit --json --package-lock-only` metadata.vulnerabilities.high |
| High (`--omit=dev`, lock graph) | **51** / 56 paths | `npm audit --json --omit=dev --package-lock-only` |
| High (installed `node_modules` graph) | **50** | `npm audit --json` |
| Other severities (full) | critical 0, moderate 30, low 5, info 0; total 89 entries | same |
| Dependencies counted | prod 1,314 / dev 502 / optional 190 / peer 15 / total 1,907 | metadata.dependencies |
| Distinct GHSA ids behind all 54 highs | **12** (undici 10, braces 1, node-forge 1) | parsed `via[].url` |
| Modules that carry their own advisory (any severity) | **8** out of 89 flagged entries; 81 entries are severity propagation only | parsed `via[]` object vs string |
| High advisories inside the Core server production closure | **0** (closure = 129 nodes; zero flagged at any severity) | lockfile closure walk, section 8 |
| High advisories in `apps/mock-core` (incl. dev) or `release/` | **0** (release/ has no package.json, is not in the workspace graph) | lockfile closure walk |

Blueprint expectation was 99 high; measured 54. Delta explanation: section 3.

## 2. Root-cause analysis (what actually carries an advisory)

`npm audit` reports one entry per vulnerable module, and propagates the worst severity upward through the graph. Three libraries carry every high in this repository.

| Root cause | Installed | Own advisories | Fixed version on registry | Real exposure |
|---|---|---|---|---|
| `undici` (nested copy) | 7.29.0 at `node_modules/@scalar/json-magic/node_modules/undici` | 10 GHSA, 2 of them high: GHSA-rfgv-xxqx-mfg5 (DoS unrequested WS subprotocol), GHSA-w293-vg96-wgc3 (TLS certificate validation bypass in BalancedPool, CWE-295); 8 moderate/low, all `< 7.29.1` | yes — 7.29.1 and 7.30.0 published | Node HTTP client inside the `@scalar` subtree of `apps/core-web` |
| `braces` | 3.0.3 | 1 high GHSA-vfj7-8cjw-p6xm (stack exhaustion on deeply nested glob patterns, CWE-674), range `<=3.0.3` | **none published — 3.0.3 is still the newest release** | dev/test/build globbing via `micromatch` inside jest 29 and metro |
| `node-forge` | 1.4.0 | 1 high GHSA-86w9-cpqp-85rv (RSA PKCS#1 v1.5 verify accepts extra nested DigestAlgorithm elements, CWE-347), range `<=1.4.0` | **none published — 1.4.0 is still the newest release** | build-time only: `@expo/cli` and `@expo/code-signing-certificates` (self-signed dev/signing certs) |

Second tier (non-high root causes, for completeness; they are what keeps entries alive after the highs are cleared):

| Module | Installed | Severity | Highest fixed version | Declared through | Path class |
|---|---|---|---|---|---|
| `decode-uri-component` | 0.2.2 | moderate | 0.5.0 (major; parent `query-string` pins `^0.2.x`) | mobile tree | C |
| `sprintf-js` | 1.0.3 | moderate | none published (`<=1.1.3`, 1.1.3 is latest) | `@istanbuljs/load-nyc-config` > `argparse` (coverage tooling) | C |
| `uuid` | 7.0.3 | moderate | 11.1.1+ (latest 14.0.2; parent `xcode` pins `^7`) | Expo/Xcode build tooling | C |
| `esbuild` | 0.18.20 (also 0.25.12, 0.28.2 installed) | moderate | 0.25+ exists | `@esbuild-kit/core-utils` (nested pin), dev-only in core-server | C |
| `@ai-sdk/provider-utils` | 4.0.5 | low | 4.0.33+ (latest 5.0.56) | `ai` / `@ai-sdk/gateway` in core-web prod tree | B (low only) |

Propagation clusters (sums to the 54 highs):

| Root set | High entries | Members |
|---|---|---|
| braces only | 22 | braces, micromatch, metro, metro-config, metro-file-map, metro-transform-worker, @expo/metro, @expo/metro-file-map, @jest/console, @jest/environment, @jest/fake-timers, @jest/test-result, @jest/test-sequencer, @react-native/community-cli-plugin, @react-native/metro-config, expect, jest-environment-jsdom, jest-environment-node, jest-haste-map, jest-message-util, jest-resolve, jest-watcher |
| braces + sprintf-js | 26 | @jest/core, @jest/expect, @jest/globals, @jest/reporters, @jest/transform, babel-jest, create-jest, jest, jest-circus, jest-cli, jest-config, jest-expo, jest-resolve-dependencies, jest-runner, jest-runtime, jest-snapshot, jest-watch-typeahead, @react-native/jest-preset, @react-native/virtualized-lists, react-native, react-native-reanimated, react-native-worklets, @shopify/react-native-skia, heroui-native, uniwind, victory-native |
| braces + uuid | 1 | @expo/metro-config |
| braces + node-forge + uuid | 2 | @expo/cli, expo |
| node-forge only | 2 | node-forge, @expo/code-signing-certificates |
| undici only | 1 | undici |

Consequence: clearing undici removes exactly 1 high entry; the other 53 cannot be removed by any bump available today, because both remaining root causes have no published fix. If braces and node-forge were fixed upstream, the high count would fall to 0.

## 3. Delta versus the expected 99 (blueprint row 5 / predecessor B2 note)

Predecessor text being triaged (`docs/2026-10-04_dems_backend_rbac_pairing/report/01_report_inputs.md` line 201): "`npm audit` 99 high / 0 critical (96 with `--omit=dev`)". Measured today: 54 high / 0 critical (51 with `--omit=dev`).

| Evidence | Finding |
|---|---|
| `git log -1 -- package-lock.json` | Last lockfile change `b90a3c6` (2026-10-05 20:16:38 +0700). No dependency has moved since the predecessor ran its audit. Lock mtime 2026-10-04T00:31:45Z, unchanged by this row. |
| Tree identity | The full-vs-`--omit=dev` delta is 3 modules both then (99-96) and now (54-51) — the same three dev-only modules (jest-environment-jsdom, jest-expo, jest-watch-typeahead). Same graph, same metric family, different absolute scale. |
| Metric sensitivity inside this run | Same repository, same moment: 54 highs from the lock graph vs 50 highs from the installed graph (`npm audit --json`). Four mobile UI packages (skia, heroui-native, uniwind, victory-native) drop out when npm resolves the physical tree, because their only high path runs through `react-native` peer resolution. Counting basis changes the number without any dependency change. |
| Alternative metrics computed (none reproduces 99/96) | high install paths 59 (prod 56); all-severity entries 89 (prod 81); all-severity install paths 94 (prod 86); sum of `via` over high entries 152; sum of `effects` over high entries 131; distinct GHSA ids 12. |
| Advisory DB is live | `npm audit` queries the registry each run; entries are added, re-graded and re-scoped over time. The undici cluster (10 advisories, all published against `< 7.29.1`) is itself proof the corpus moved after 2026-10-05. |

Conclusion recorded for the controller: 99 is not reproducible from the current tree and cannot be reproduced from the current lockfile at all; it is a count-basis plus advisory-snapshot artefact of the older run. **Row 23 must use 54 (lock view) / 51 (`--omit=dev`) as the baseline, and 53 / 50 as the post-fix target**, with `npm ls undici` >= 7.29.1 as the hard check named in the blueprint. A further warning for the verifier: because the installed-tree count is 4 lower than the lock-graph count, the audit view used for the "after" number must be stated explicitly in row 23's evidence.

## 4. Advisory table — all 54 high entries

Legend. Path class: **A** = core-server runtime (the security boundary), **B** = client runtime shipped to browser/RN bundle, **C** = dev/test/build tooling executed only on the Mac, **D** = tooling not used at runtime and out of scope (mock-core, release/). `fixAvail(npm)` quotes the raw `fixAvailable` field; `NO-FIX` means npm returned `false`.

| Module | Installed | Sev | Direct/trans | Class | fixAvail(npm) | Proposed target | Action |
|---|---|---|---|---|---|---|---|
| undici | 7.29.0 | high | transitive (`@scalar/json-magic` exact pin) | B (core-web prod closure; absent from built bundle) | api-reference-react@0.8.36 major | **7.29.1** (optionally 7.30.0) | **Bump via root `overrides`** — the only advisory row with a real fix |
| @expo/cli | 57.0.27 | high | transitive | C | expo@44.0.6 (downgrade) | none | Reject downgrade; propagation only |
| @expo/code-signing-certificates | 0.0.6 | high | transitive | C | expo@44.0.6 (downgrade) | none | Accept with reason (node-forge unfixed, build-time cert tool) |
| @expo/metro | 56.0.2 | high | transitive | C | expo@44.0.6 (downgrade) | none | Reject downgrade; propagation via micromatch/braces |
| @expo/metro-config | 57.0.12 | high | transitive | C | expo@44.0.6 (downgrade) | none | Reject downgrade |
| @expo/metro-file-map | 57.0.3 | high | transitive | C | AUTO | none | No action; npm "auto fix" here only re-derives the tree, does not clear braces |
| @jest/console | 29.7.0 | high | transitive | C | jest@30.5.2 | none | No action; braces unfixed |
| @jest/core | 29.7.0 | high | transitive | C | jest@30.5.2 | none | No action |
| @jest/environment | 29.7.0 | high | transitive | C | reanimated@4.2.2 (downgrade) | none | Reject downgrade |
| @jest/expect | 29.7.0 | high | transitive | C | jest@30.5.2 | none | No action |
| @jest/fake-timers | 29.7.0 | high | transitive | C | reanimated@4.2.2 (downgrade) | none | Reject downgrade |
| @jest/globals | 29.7.0 | high | transitive | C | jest@30.5.2 | none | No action |
| @jest/reporters | 29.7.0 | high | transitive | C | jest@30.5.2 | none | No action |
| @jest/test-result | 29.7.0 | high | transitive | C | jest@30.5.2 | none | No action |
| @jest/test-sequencer | 29.7.0 | high | transitive | C | jest@30.5.2 | none | No action |
| @jest/transform | 29.7.0 | high | transitive | C | reanimated@4.2.2 (downgrade) | none | Reject downgrade |
| @react-native/community-cli-plugin | 0.86.3 | high | transitive | C | reanimated@4.2.2 (downgrade) | none | Reject downgrade |
| @react-native/jest-preset | 0.86.3 | high | transitive | C | reanimated@4.2.2 (downgrade) | none | Reject downgrade |
| @react-native/metro-config | 0.86.3 | high | transitive | C | reanimated@4.2.2 (downgrade) | none | Reject downgrade |
| @react-native/virtualized-lists | 0.86.3 | high | transitive | B (ships in RN bundle) | reanimated@4.2.2 (downgrade) | none | No action; no own advisory |
| @shopify/react-native-skia | 2.6.2 | high | direct (mobile prod) | B | skia@1.12.4 (downgrade) | keep 2.6.2 | Reject downgrade; version change breaks the pinned `allowScripts` key (section 7) |
| babel-jest | 29.7.0 | high | transitive | C | reanimated@4.2.2 (downgrade) | none | Reject downgrade |
| braces | 3.0.3 | high | transitive | C | reanimated@4.2.2 (downgrade) | **none exists** (3.0.3 is latest) | **BLOCKED — accept with documented reason** (section 6) |
| create-jest | 29.7.0 | high | transitive | C | jest@30.5.2 | none | No action |
| expect | 29.7.0 | high | transitive | C | jest@30.5.2 | none | No action |
| expo | 57.0.26 | high | direct (mobile prod) | C (flagged through its build/CLI subtree) | expo@44.0.6 (13-major downgrade) | keep ~57.0.26 | Reject downgrade |
| heroui-native | 1.0.10 | high | direct (mobile prod) | B | false | none | No action; `react-native` propagation only |
| jest | 29.7.0 | high | direct (mobile **dev**) | C | jest@30.5.2 | optional 30.x later | Not a security move (no jest advisory); belongs to a test-strategy decision, not row 23 |
| jest-circus | 29.7.0 | high | transitive | C | jest@30.5.2 | none | No action |
| jest-cli | 29.7.0 | high | transitive | C | jest@30.5.2 | none | No action |
| jest-config | 29.7.0 | high | transitive | C | jest@30.5.2 | none | No action |
| jest-environment-jsdom | 29.7.0 | high | transitive | C (dev-only, disappears under `--omit=dev`) | jest-expo@58.0.8 | none | No action |
| jest-environment-node | 29.7.0 | high | transitive | C | reanimated@4.2.2 (downgrade) | none | Reject downgrade |
| jest-expo | 57.0.5 | high | direct (mobile **dev**) | C | jest-expo@58.0.8 | optional 58.x later | Deferred with jest 30 decision |
| jest-haste-map | 29.7.0 | high | transitive | C | reanimated@4.2.2 (downgrade) | none | Reject downgrade |
| jest-message-util | 29.7.0 | high | transitive | C | reanimated@4.2.2 (downgrade) | none | Reject downgrade |
| jest-resolve | 29.7.0 | high | transitive | C | jest@30.5.2 | none | No action |
| jest-resolve-dependencies | 29.7.0 | high | transitive | C | jest@30.5.2 | none | No action |
| jest-runner | 29.7.0 | high | transitive | C | jest@30.5.2 | none | No action |
| jest-runtime | 29.7.0 | high | transitive | C | jest@30.5.2 | none | No action |
| jest-snapshot | 29.7.0 | high | transitive | C | jest@30.5.2 | none | No action |
| jest-watch-typeahead | 2.2.1 | high | transitive | C (dev-only) | jest-expo@58.0.8 | none | No action |
| jest-watcher | 29.7.0 | high | transitive | C | jest@30.5.2 | none | No action |
| metro | 0.84.5 / 0.84.6 (2 paths) | high | transitive | C | reanimated@4.2.2 (downgrade) | none | Reject downgrade |
| metro-config | 0.84.5 / 0.84.6 (3 paths) | high | transitive | C | reanimated@4.2.2 (downgrade) | none | Reject downgrade |
| metro-file-map | 0.84.6 / 0.84.5 (2 paths) | high | transitive | C | reanimated@4.2.2 (downgrade) | none | Reject downgrade |
| metro-transform-worker | 0.84.6 / 0.84.5 (2 paths) | high | transitive | C | reanimated@4.2.2 (downgrade) | none | Reject downgrade |
| micromatch | 4.0.8 | high | transitive | C | reanimated@4.2.2 (downgrade) | inherits braces | No own advisory; nothing to bump |
| node-forge | 1.4.0 | high | transitive (`@expo/cli`) | C | expo@44.0.6 (downgrade) | **none exists** (1.4.0 is latest) | **BLOCKED — accept with documented reason** (section 6) |
| react-native | 0.86.3 | high | direct (mobile prod) | B/C split: runtime ships, flags arrive via community-cli-plugin + jest-preset | reanimated@4.2.2 (downgrade) | keep 0.86.3 | Reject downgrade |
| react-native-reanimated | 4.5.1 | high | direct (mobile prod) | B | reanimated@4.2.2 (downgrade) | keep 4.5.1 | Reject downgrade; npm names the package it would remove, not a fix |
| react-native-worklets | 0.10.1 | high | direct (mobile prod) | B | worklets@0.7.4 (downgrade) | keep 0.10.1 | Reject downgrade |
| uniwind | 1.12.0 | high | direct (mobile prod) | B | false | none | No action; propagation only |
| victory-native | 42.0.1 | high | direct (mobile prod) | B | victory-native@41.26.0 (downgrade) | keep 42.0.1 | Reject downgrade |

Class totals across the 54 high entries: **A = 0**, **B = 9** (undici plus 8 mobile/RN runtime libs), **C = 45**, **D = 0**. Proposal classes: safe bump inside an existing range = 0 (no high can be cleared by a plain `npm update`, because `@scalar/json-magic` pins `undici` to exact `7.29.0` and its four parents pin json-magic to exact `0.15.3`); needs a manifest edit = 1 (undici, via root `overrides` or a core-web `@scalar/api-reference-react` bump); blocked with no published fix = 2 (braces, node-forge); no action, propagation only = 51, of which 15 carry an npm `fixAvailable` that is a downgrade and must be rejected.

## 5. Why no `fixAvailable` value may be applied as-is

| npm suggestion | Direction | Effect if applied | Verdict |
|---|---|---|---|
| `expo@44.0.6` (from expo, @expo/cli, node-forge, code-signing-certificates) | 57 -> 44, 13 majors | Breaks the Expo 57 / RN 0.86 app; closes 0 advisories that are not already closed elsewhere | Reject |
| `react-native-reanimated@4.2.2` (named by 15 entries incl. react-native, metro, jest family) | 4.5.1 -> 4.2.2 downgrade | npm names the package whose removal would cut a graph path, not a patched release; reanimated 4.5.1 has no advisory | Reject |
| `@shopify/react-native-skia@1.12.4`, `victory-native@41.26.0`, `react-native-worklets@0.7.4` | downgrades | Also invalidates the exact-version `allowScripts` key for skia (native build step), breaking mobile installs | Reject |
| `jest@30.5.2`, `jest-expo@58.0.8` | upgrades | Legitimate modernisation, but no jest advisory exists; the high flag comes from `braces`, which stays unfixed even on jest 30 | Out of row-23 scope; route to the test-strategy spec (row 36) |
| `@scalar/api-reference-react@0.8.36` (from undici) | 0.9.76 -> 0.8.36 downgrade | Wrong direction; the correct route is an undici override or the 0.9.78 patch line | Replace with section 6 plan |

## 6. Proposals and the blocked register

| Module | Current | Target | Class of proposal | Manifest edit needed | Note |
|---|---|---|---|---|---|
| undici (nested under `@scalar/json-magic`) | 7.29.0 | **7.29.1** (7.30.0 acceptable) | override required — pin prevents a safe bump | yes, root `package.json` `overrides` (block already exists with react pins) | Deterministic, one key, zero subtree churn. Alternative B: `@scalar/api-reference-react` 0.9.76 -> 0.9.78 in `apps/core-web/package.json`; `@scalar/json-magic@0.15.5` upstream already pins undici 7.29.1, so the pin is fixed upstream — but the four intermediate `@scalar` parents use exact pins, so a subtree refresh is unavoidable. Choose the override first; keep the parent bump as fallback if the override trips a scalar runtime error. |
| undici (hoisted) | 8.11.2 | unchanged | already compliant | no | Pulled by `jsdom` (`^8.10.2`), dev/test only; outside every vulnerable range. |
| braces | 3.0.3 | none exists | **BLOCKED** | n/a | GHSA-vfj7-8cjw-p6xm `<=3.0.3`; registry latest is 3.0.3. Consumers `micromatch` 4.0.8 pins `^3.0.3`; jest 29 and metro both depend on micromatch. Mitigation: accept and document — the trigger is attacker-controlled glob text; here the patterns are repository constants used by the bundler and the test runner on the developer Mac, never a request-path input; it is dev/build only (class C) and outside the Core boundary (class A = 0). Do not fake an override to a nonexistent version and do not disable audit. Re-check at the M0 gate and per row 24. |
| node-forge | 1.4.0 | none exists | **BLOCKED** | n/a | GHSA-86w9-cpqp-85rv `<=1.4.0`; registry latest is 1.4.0. Used by `@expo/cli` / `@expo/code-signing-certificates` to mint and verify self-signed signing certificates during mobile builds. Not present in the Core, not present in the shipped bundle, and DEMS evidence signing is Ed25519 in project code (OD-04 default), not node-forge. Mitigation: accept and document; revisit when upstream releases 1.4.1+. |
| micromatch | 4.0.8 | inherits braces | no action | no | No own advisory. |
| jest / jest-expo (+ 34 derived entries) | 29.7.0 / 57.0.5 | deferred | no action for B2 | no | Test-runner modernisation is a test-strategy decision (row 36), not an advisory closure; upgrading cannot clear these entries. |
| Mobile UI/runtime libs (skia, heroui-native, uniwind, victory-native, react-native, reanimated, worklets, @react-native/virtualized-lists) | as installed | unchanged | **reject the npm-suggested downgrades** | no | Propagation only; several carry the exact-version `allowScripts` risk (section 7). |

Blocked items requiring a recorded decision: **2** (braces, node-forge). Proposals needing a manifest edit: **1** (undici override). Safe bumps requiring no manifest edit: **0**. No-action propagation rows: **51**.

## 7. Install-script / postinstall exposure

Current root `package.json`:

```json
"allowScripts": {
  "@shopify/react-native-skia@2.6.2": true,
  "@embedded-postgres/darwin-arm64@18.4.0-beta.17": true
}
```

Root `.npmrc` (only `.npmrc` in the tracked tree, apart from an identical copy under `.kilo/worktrees/`): `save-exact=true` — no `ignore-scripts`, no `audit=false`, no `foreground-scripts`.

| Fact | Value |
|---|---|
| Packages in the lock declaring an install script (`hasInstallScript`) | 17 |
| Script-bearing packages explicitly allowed by `allowScripts` | 2 (skia 2.6.2, embedded-postgres darwin-arm64 18.4.0-beta.17) |
| Script-bearing packages flagged at high | 1 — `@shopify/react-native-skia` (propagation only, no own advisory) |
| Script-bearing packages flagged at moderate | 1 — `esbuild` 0.18.20 nested under `@esbuild-kit/core-utils` (dev tooling; not in `allowScripts`) |
| Other script-bearing packages | `@embedded-postgres/*` for 6 platforms (only darwin-arm64 allowed; the rest are inert foreign-platform binaries), `esbuild` x3 paths, `fsevents`, `vue-demi` x3, `unrs-resolver` — none flagged |
| Consequence of `.npmrc save-exact=true` | every bump row 23 writes records an exact version — including the transitive `undici` resolution |
| Coupling risk for row 23 | `allowScripts` keys are pinned to exact versions. Any version change to `@shopify/react-native-skia` or `embedded-postgres` silently revokes its install script unless the key is updated in the same commit; the mobile native build and `scripts/pg/*` break without an obvious error. Neither package is in the B2 bump set — keep it that way. |

No advisory in this triage originates from an install-script mechanism; the exposure statement above is for the row-24 review, which must count newly allowed scripts in the diff.

## 8. Runtime-path classification and "does not matter for this phase"

Method: workspace-scoped dependency closures computed directly from `package-lock.json` (`dependencies` + `optionalDependencies` + `peerDependencies` for production, plus `devDependencies` for the dev view), intersected with the flagged install paths. The workspace links (`node_modules/@dems/*`) were resolved to their real folders.

| Class | Definition | High count | Verdict for this phase |
|---|---|---|---|
| A | Anything reachable from `apps/core-server` production deps (`@dems/shared`, `@fastify/{cookie,helmet,rate-limit,swagger,websocket}`, `drizzle-orm`, `fastify`, `fastify-type-provider-zod`, `openapi-types`, `pg`, `rate-limiter-flexible`, `react`, `tsx`, `zod`) | **0** (closure = 129 nodes, zero flagged entries at any severity) | The Core is the security boundary and it is clean. No B2 item can weaken SR-01 (loopback listener), RBAC, or the signer path. Capture dependencies added later in this task inherit a clean base. |
| B | Client runtime code that ships (core-web browser bundle, mobile RN bundle) | 9 | 8 of 9 have no advisory of their own — pure graph propagation. The 9th, `undici`, sits in core-web's production closure through `@scalar/api-reference-react` 0.9.76 -> ... -> `@scalar/json-magic` 0.15.3 -> undici 7.29.0, but its library code is not in the built bundle: the last local build `apps/core-web/dist/assets/add-scalar-classes-BhIQiAle.js` contains the token `undici` only inside Scalar's code-sample generator data (`node:[axios,fetch,ofetch,undici]` and a snippet generator that emits `from 'undici'` as text), with no `BalancedPool` / permessage-deflate implementation; `undici` is imported only by `@scalar/json-magic/dist/bundle/plugins/fetch-urls/fetch-public-url.js`, the Node plugin export (`./bundle/plugins/node`), not the browser plugin export. So the 2 high undici CVEs (WebSocket DoS, TLS bypass in BalancedPool) require a Node HTTP client call the browser can never make. It is still bumped in row 23: it is cheap, it is named in the plan, it removes the only real high inside a production manifest, and it protects any future Node-side Scalar use (SSR, export job, OpenAPI fetch). Evidence caveat: `dist/` is git-ignored and dated 2026-10-05 18:08; re-grep the post-bump build in row 23. |
| C | Dev/test/build tooling on the Mac (jest 29 chain, metro/expo bundler chain, coverage/istanbul, esbuild-kit, Xcode tooling) | 45 | Does not matter for M0-M9 security posture. Nothing in class C is loaded by the Core process, is never reachable from an HTTP/WS request, and never handles custody data, keys or media. Two consequences worth recording: (1) `@dems/mobile` declares `expo` and `react-native` as production dependencies, which is why npm counts their CLI/bundler children as "production" — the classification above is by code path, not by manifest label; (2) `packages/shared` pulls `@scalar/openapi-parser` 0.29.9 as a devDependency, which is a second declaration point for the same nested undici 7.29.0 — the row-23 override clears both at once because there is exactly one physical copy. |
| D | Tooling not used at run time and declared out of scope: `apps/mock-core` (read-only demo), `release/` (frozen 0.1.0 web/android) | **0** | mock-core has zero flagged nodes even including its dev tree (94-node closure clean). `release/` contains no `package.json`, is not in the `workspaces` glob, and therefore contributes nothing to the audit; its `web/` bundle also contains no undici implementation strings. Frozen; out of scope per blueprint §3.1 Scope and §8. |

Non-high severities, for the record: 30 moderate and 5 low entries, none inside the Core production closure; their 5 root causes are listed in section 2 and all sit in class B(low)/C. No `critical`, no `info`.

## 9. No-change proof

Baseline, recorded before any command (step 1):

```
$ git rev-parse HEAD
2a4f4ea063d1a7c72d3fb70d4951fa63029e57a8
$ git rev-parse --abbrev-ref HEAD
main
$ git status --porcelain
 M docs/2026-10-07_dems_real_capture_sealing/decisions/decisions.md
 M docs/2026-10-07_dems_real_capture_sealing/status_tasks.md
$ git diff --stat
 .../decisions/decisions.md                         |  3 ++
 .../status_tasks.md                                | 51 +++++++++++++++++++++-
 2 files changed, 52 insertions(+), 2 deletions(-)
$ git diff --stat package-lock.json
(empty)
```

Deviation from the row's "must be clean" expectation, reported not fixed: at the start of this row the working tree already carried two modified files, both owned by the Master Controller (`decisions/decisions.md`, `status_tasks.md`). They predate this delegation, are shared trackers this row is forbidden to touch, and are documentation only — no source, manifest or lockfile file was dirty. Zero dirty files originated from this row.

After all audit work (step 6):

```
$ git diff --stat package-lock.json
(no output)
$ git status --porcelain
 M docs/2026-10-07_dems_real_capture_sealing/decisions/decisions.md
 M docs/2026-10-07_dems_real_capture_sealing/status_tasks.md
```

Additional integrity evidence:

| Check | Value | Meaning |
|---|---|---|
| `package-lock.json` mtime | 2026-10-04T00:31:45.241Z | not rewritten in this session (session ran 2026-10-07T06:45Z onward) |
| `node_modules/.package-lock.json` mtime | 2026-10-04T00:31:45.335Z | no install/update touched `node_modules` |
| Audit commands used | `npm audit --json [--omit=dev] --package-lock-only`, `npm audit --json`, `npm view <pkg> version/versions/dependencies` | read-only; none writes the lockfile or `node_modules` |
| Files written by this row | `research/05_b2_dependency_triage.md`, `delegation_progress/security-review-local__row5.md` | matches the Documentation Contract exactly |

## 10. Ordered action list for row 23 (apply row)

Preconditions: no test row running (rows 16-22 finished, row 27 not started), single lockfile writer, row 5 accepted.

| # | Action | Command / file | Gate before next step |
|---|---|---|---|
| 1 | Take the repository lock | `/usr/bin/lockf -k .locks/npm.lock -c '<the npm steps below>'` in one shell invocation (`.locks/` is git-ignored, line 59 of `.gitignore`; use `/usr/bin/lockf`, not `flock`) | lock held by this process only |
| 2 | Snapshot the baseline numbers into the row-23 report | `git rev-parse HEAD` (expect `2a4f4ea` or its successor after rows 16-22), `npm audit --json --package-lock-only \| node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).metadata.vulnerabilities'` | records 54 / 51 before |
| 3 | **The only manifest edit**: add `"undici": "7.29.1"` to the existing `overrides` block of root `package.json` (keep the five react overrides untouched). One-line addition, no other file edited. | `package.json` | `git diff --stat` shows exactly one file |
| 4 | Resolve without touching `node_modules` | `npm install --package-lock-only --package-json=false` | `git diff --stat` shows `package.json` + `package-lock.json` only |
| 5 | Read the lock diff before accepting it | `git diff package-lock.json` | the only version movement is `undici 7.29.0 -> 7.29.1` (plus the `overrides` mirror inside the lock). Any additional package moving = stop, revert step 4, escalate: B2 is targeted, not a refresh-everything |
| 6 | Sync the tree (runs allowed install scripts) | `npm install` (or `npm ci` if step 5 stayed minimal and the team prefers a clean rebuild) | install exits 0; skia/embedded-postgres scripts still run, i.e. `allowScripts` keys unchanged (both still match their pinned versions) |
| 7 | Verify the target | `npm ls undici` -> `7.29.1` under `@scalar/json-magic` and `8.11.2` under jsdom; `npm audit --json --package-lock-only` high -> **53**; `npm audit --json --omit=dev --package-lock-only` high -> **50**; `npm audit --json` (installed view) high -> **49** | all four numbers recorded with their view label |
| 8 | Record the two unfixable items once, in the row-23 report and in `decisions/decisions.md` via the controller | braces (GHSA-vfj7-8cjw-p6xm) and node-forge (GHSA-86w9-cpqp-85rv): class C only, class A = 0, no published fix at time of writing, audit stays enabled | row 24 reviewer sees the reason, not a suppression |
| 9 | Root quality gates | `npm run typecheck` then `npm run lint` (both fan out over all workspaces) | exit 0 both |
| 10 | Per-workspace suites, one workspace at a time, from the repository root | `npm run test -w @dems/shared -- --maxWorkers=2`; `npm run test -w @dems/core-server -- --maxWorkers=2`; `npm run test:db -w @dems/core-server -- --maxWorkers=2`; `npm run test -w @dems/core-web -- --maxWorkers=2`; `npm run test -w @dems/mobile -- --maxWorkers=2` | ledger >= 71/1,851, 160/3,954, 124/1,751, 117/1,495, 192/1,988. Runner caveat to settle at apply time: `--maxWorkers` is a real jest flag (`@dems/mobile` uses jest); the four vitest workspaces (vitest 5.0.3) express this as pool sizing, so verify `npx vitest --help` accepts the forwarded flag and otherwise pass `--pool=threads --poolOptions.threads.maxThreads=2`. Do not let a silently ignored flag be reported as throttled execution |
| 11 | Hand to row 24 | Diff scope to review: `package.json` (1 override key), `package-lock.json` (undici), nothing else. Row 24 must confirm 0 newly allowed install scripts | — |

Explicitly forbidden in row 23: `npm audit fix` / `npm audit fix --force`; applying any `fixAvailable` value quoted in section 4 (15 of them are downgrades); touching `@shopify/react-native-skia` or `embedded-postgres` versions without co-editing their exact-version `allowScripts` keys; adding `audit=false` / `ignore-scripts` to `.npmrc`; editing anything under `release/` or `apps/mock-core`.

Fallback if the undici override trips a Scalar runtime error (symptom: API-reference page fails to render, or the shared contract check throws on `undici` imports): revert step 3 and instead raise `@scalar/api-reference-react` 0.9.76 -> 0.9.78 in `apps/core-web/package.json`, which drags the `@scalar` subtree to `json-magic` 0.15.5+ whose pin is already `undici` 7.29.1; then re-run steps 4-10 and re-check the AC-73 static guard (`apps/core-web/src/test/scalar-config.test.ts`) plus the scalar theme/renderer pinning to `@scalar/api-reference` 1.72.3 named in `scalar-theme.ts`.

## 11. Security gate record (this row's own actions)

| Check | Result | Basis |
|---|---|---|
| Credential leak | PASS | Written artifacts contain module names, versions, GHSA ids and advisory titles only; no token, password, connection string, private key or env secret appears; no secret-bearing file was opened |
| Destructive operation | PASS | No manifest, lockfile, `node_modules`, database or media write; two documentation files created; rollback trivially available (`git checkout`) |
| External call | PASS | HTTPS to the npm registry only, via `npm audit` and `npm view`; anonymous read, no credential sent, no project identifier sent beyond package names |
| Injection | PASS | No shell interpolation of untrusted input; the advisory JSON was parsed by `JSON.parse` in throwaway scripts under the OS temp dir, never eval'd |
| Permission escalation | PASS | No permission, ACL, config or `allowScripts` change; the least-privilege posture of the repository is unchanged |
| Overall | **PASS** | Analysis-only row honoured; findings routed forward to rows 23/24 rather than fixed here |

Framework mapping relevant to this row: ISO 27001 A.12.6 (technical vulnerability management) — triage performed with a documented, reproducible method and a stated baseline; A.14.2 (secure development) — production dependency hygiene gated before new capture dependencies are added; A.18.1.4 / GDPR Art. 32 (security of processing) — confirmed by closure analysis that no flagged dependency reaches the Core, which is the component holding PII (sessions, transcripts, biometric-adjacent device data). GDPR articles on data-subject rights, retention and consent are not assessable from a dependency scan and are out of row 5 scope; they belong to row 35 (security design review).

## 12. Assumptions and limits

| ID | Statement |
|---|---|
| A-R5-1 | `npm audit` has no pinned advisory snapshot; the 54/51/50 numbers are the registry state at 2026-10-07T06:4xZ and can drift by a small amount at row 23 time. Re-record both before/after numbers in the same view to keep row 23's "<= target" check meaningful. |
| A-R5-2 | The claim that undici code is absent from the browser bundle rests on the last local build of `apps/core-web/dist` (2026-10-05, git-ignored) plus the `@scalar/json-magic` export map; it is strong but indirect. Row 23 should re-grep the post-bump build for `BalancedPool` if a definitive statement is needed. |
| A-R5-3 | Class A cleanliness covers production manifests of the five workspaces; a future capture dependency (FFmpeg bindings, ONVIF client, whisper runtime wrapper — Q-INSTALL item 6 permits an ONVIF npm package only after B2) changes the closure and must be triaged on arrival, not inherited from this row. |
| A-R5-4 | `masterplan/02_plan.md` does not exist yet in this task folder (`masterplan/` is empty at execution time), so the tracking table of the source-of-truth plan could not be updated. Row identity, status and the Issues-log note are carried in the delegation-progress file instead, and the Documentation Contract for this row forbids touching shared trackers such as `status_tasks.md`. |
| A-R5-5 | Per-row Documentation Contract overrides the agent default of writing `implementation/99_implementation_report.md`; this file is the deliverable for row 5 and the report content lives in sections 1-11. |

## 13. Commands used (reproducible)

```bash
git status --porcelain && git rev-parse HEAD
git diff --stat package-lock.json            # empty, before and after
npm audit --json --package-lock-only         # 54 high, written to temp file, parsed with node
npm audit --json --omit=dev --package-lock-only   # 51 high
npm audit --json                             # 50 high (installed graph)
npm view <pkg> version|versions|dependencies # registry targets only
node <analysis>                              # closures + propagation clusters, scripts in $TMPDIR only
```

---
*Generated: 2026-10-07 06:55*
