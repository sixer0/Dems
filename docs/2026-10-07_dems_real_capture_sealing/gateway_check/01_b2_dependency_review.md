---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: security-review
blueprint_row: 24
milestone: M0
class: A
tier: 2
status: completed
verdict: PASS
source_plan: docs/2026-10-07_dems_real_capture_sealing/identification/02_structured.md (row 24)
reviews: docs/2026-10-07_dems_real_capture_sealing/implementation/08_b2_dependency_refresh.md (row 23)
baseline: docs/2026-10-07_dems_real_capture_sealing/research/05_b2_dependency_triage.md (row 5)
baseline_head: 2a4f4ea063d1a7c72d3fb70d4951fa63029e57a8
---

# Row 24 — B2 dependency-diff security review (review row; no writes except this file and the progress note)

## Verdict

**PASS.**

The tracked diff of `package.json` + `package-lock.json` contains exactly the scoped override `"@scalar/json-magic": { "undici": "7.29.1" }` added to the existing root `overrides` block plus the single matching lockfile entry (`node_modules/@scalar/json-magic/node_modules/undici` 7.29.0 -> 7.29.1, version/resolved/integrity). No other package moved: a whole-lockfile version comparison against `HEAD` reports 1 changed, 0 downgrades, 0 added, 0 removed. The one high advisory this change targets (`undici`) is confirmed cleared (`"undici" in vulnerabilities` = false; physical copy 7.29.1, jsdom's 8.11.2 untouched). The only remaining root causes are `braces` (GHSA-vfj7-8cjw-p6xm) and `node-forge` (GHSA-86w9-cpqp-85rv), both accepted-risk with registry-confirmed no published fix (latest release is the vulnerable version), dev/build/test-only, class A (Core runtime) = 0; the other 51 high entries are pure propagation from those two roots. Install-script count is unchanged (17 -> 17, delta 0) and both `allowScripts` keys are byte-identical. `npm ls undici` shows the override active and correctly scoped (no leak to jsdom); `npm ls --depth=0` reports no invalid/extraneous/missing; `npm run typecheck` and `npm run lint` both exit 0. One external observation, not a regression: the live advisory-DB high count now reads 53 (lock) / 50 (`--omit=dev`) versus row 23's recorded 49 / 46, which is the registry drift anticipated by row 5 assumption A-R5-1; it equals row 5's baseline 54 minus the one durably-cleared `undici` entry, remains within the `<= 53` gate, and no new advisory class appeared. No scope creep, no downgrade, no advisory-class regression.

## 1. Diff scope proof

```
$ git rev-parse HEAD
2a4f4ea063d1a7c72d3fb70d4951fa63029e57a8
$ git rev-parse --abbrev-ref HEAD
main
$ git diff --stat -- package.json package-lock.json
 package-lock.json | 6 +++---
 package.json      | 5 ++++-
 2 files changed, 7 insertions(+), 4 deletions(-)
```

`package.json` — one scoped entry appended to the existing `overrides` block; the five react pins byte-identical; no `allowScripts` line in the diff:

```diff
     "react-dom": "19.2.3",
     "react-test-renderer": "19.2.3",
     "@types/react": "19.2.18",
-    "@types/react-dom": "19.2.7"
+    "@types/react-dom": "19.2.7",
+    "@scalar/json-magic": {
+      "undici": "7.29.1"
+    }
   },
```

`package-lock.json` — the complete diff is one hunk of three lines (version/resolved/integrity); `license`/`engines` unchanged:

```diff
     "node_modules/@scalar/json-magic/node_modules/undici": {
-      "version": "7.29.0",
-      "resolved": "https://registry.npmjs.org/undici/-/undici-7.29.0.tgz",
-      "integrity": "sha512-IDxfleLmmbSskfWSUATiN1nfn2rDuvnMOqb5CWR92iIfojA0Ud+ulOAAEQ57LPr9rWmsreUyf5lwyao+7GNNVw==",
+      "version": "7.29.1",
+      "resolved": "https://registry.npmjs.org/undici/-/undici-7.29.1.tgz",
+      "integrity": "sha512-RYONW2MeafgYlkVOKYKkA/Ag7BmXqgIWCa8t1m0JcxrQg9pI9lEqRhAOruOBCbAohOa/gkCF+iPi9hrgvTzu6Q==",
       "license": "MIT",
       "engines": {
         "node": ">=20.18.1"
```

Whole-lockfile independent comparison (`git show HEAD:package-lock.json` vs working copy, every `packages.<path>.version`):

```
CHANGED: node_modules/@scalar/json-magic/node_modules/undici 7.29.0 -> 7.29.1
=== SUMMARY === changed: 1  downgrades: 0  added: 0  removed: 0
```

Scope result: exactly the two allowed files changed. No added/removed packages, no react pin movement, `allowScripts` untouched (`git diff -- package.json | grep -c allowScripts` = `0`), no `overrides` mirror side-effect written into the lock. PASS.

## 2. Advisory closure re-run

Command evidence (this review, 2026-10-07T14:2xZ, read-only):

```
$ npm audit --json --package-lock-only          -> LOCK-VIEW:     high 53 (moderate 20, low 7, critical 0, total 80)
$ npm audit --json --omit=dev --package-lock-only -> LOCK-OMITDEV: high 50 (moderate 16, low 7, critical 0, total 73)
$ npm view braces version     -> 3.0.3     (latest release; vulnerable range is <=3.0.3)
$ npm view node-forge version -> 1.4.0     (latest release; vulnerable range is <=1.4.0)
$ npm ls undici --all         -> undici@7.29.1 overridden (json-magic) + undici@8.11.2 (jsdom)
```

| View | Row 5 baseline | Row 23 after (11:05-11:10Z) | Row 24 re-run (14:2xZ) | Gate | Result |
|---|---|---|---|---|---|
| lock graph (`--package-lock-only`) | 54 | 49 | 53 | `<= 53` | PASS (at boundary) |
| lock graph `--omit=dev` | 51 | 46 | 50 | row 5 target 50 | PASS |
| `undici` entry present in tree | yes (7.29.0) | no | no | must be cleared | PASS |

Root-cause census of the 53 current high entries (parsed `via[]`):

```
TOTAL_HIGH_ENTRIES: 53
undici_in_tree: false
--- root-cause modules (via contains object) ---
braces    : GHSA-vfj7-8cjw-p6xm
node-forge: GHSA-86w9-cpqp-85rv
--- propagation-only count: 51 ---
```

Disposition counts: (i) cleared = 1; (ii) accepted-risk = 2; (iii) propagation-only = 51; (iv) unexpected = 0; total remaining high = 53.

### Advisory disposition table (every remaining high classified)

| Module | Installed | Advisory | Disposition | Evidence |
|---|---|---|---|---|
| undici | 7.29.1 (was 7.29.0) | GHSA-rfgv-xxqx-mfg5, GHSA-w293-vg96-wgc3 (10 advisories `< 7.29.1`) | **(i) cleared by this change** | `"undici" in vulnerabilities` = false; `npm ls undici` = 7.29.1 overridden; lock 7.29.1; `npm view undici@7.29.1 dist.integrity` = `sha512-RYONW2MeafgYlkVOKYKkA/Ag7BmXqgIWCa8t1m0JcxrQg9pI9lEqRhAOruOBCbAohOa/gkCF+iPi9hrgvTzu6Q==` (matches lock) |
| braces | 3.0.3 | GHSA-vfj7-8cjw-p6xm (CWE-674 stack exhaustion) | **(ii) accepted-risk, reason kept** | `npm view braces version` = 3.0.3 = latest release (no fix published; `fixAvailable: false`); range `<=3.0.3`; class C only (jest 29 / metro dev-time globbing via micromatch); class A = 0 |
| node-forge | 1.4.0 | GHSA-86w9-cpqp-85rv (CWE-347 RSA PKCS#1 v1.5 verify) | **(ii) accepted-risk, reason kept** | `npm view node-forge version` = 1.4.0 = latest release (no fix published); only `fixAvailable` = `expo@44.0.6` major downgrade (rejected); build-time `@expo/cli` / code-signing-certificates only; DEMS signing is Ed25519 (OD-04), not node-forge |
| @expo/cli | 57.0.27 | via braces + node-forge | (iii) propagation-only | `via` all strings; no own advisory object |
| @expo/code-signing-certificates | 0.0.6 | via node-forge | (iii) propagation-only | `via` all strings |
| @expo/metro | 56.0.2 | via braces | (iii) propagation-only | `via` all strings |
| @expo/metro-config | 57.0.12 | via braces | (iii) propagation-only | `via` all strings |
| @expo/metro-file-map | 57.0.3 | via braces | (iii) propagation-only | `via` all strings |
| @jest/console | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| @jest/core | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| @jest/environment | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| @jest/expect | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| @jest/fake-timers | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| @jest/globals | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| @jest/reporters | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| @jest/test-result | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| @jest/test-sequencer | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| @jest/transform | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| @react-native/community-cli-plugin | 0.86.3 | via braces | (iii) propagation-only | `via` all strings |
| @react-native/jest-preset | 0.86.3 | via braces | (iii) propagation-only | `via` all strings |
| @react-native/metro-config | 0.86.3 | via braces | (iii) propagation-only | `via` all strings |
| @react-native/virtualized-lists | 0.86.3 | via braces | (iii) propagation-only | `via` all strings |
| @shopify/react-native-skia | 2.6.2 | via braces (no own advisory) | (iii) propagation-only | `via` all strings; installed version matches exact-version `allowScripts` key |
| babel-jest | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| create-jest | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| expect | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| expo | 57.0.26 | via braces + node-forge | (iii) propagation-only | `via` all strings |
| heroui-native | 1.0.10 | via braces | (iii) propagation-only | `via` all strings |
| jest | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| jest-circus | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| jest-cli | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| jest-config | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| jest-environment-jsdom | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| jest-environment-node | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| jest-expo | 57.0.5 | via braces | (iii) propagation-only | `via` all strings |
| jest-haste-map | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| jest-message-util | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| jest-resolve | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| jest-resolve-dependencies | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| jest-runner | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| jest-runtime | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| jest-snapshot | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| jest-watch-typeahead | 2.2.1 | via braces | (iii) propagation-only | `via` all strings |
| jest-watcher | 29.7.0 | via braces | (iii) propagation-only | `via` all strings |
| metro | 0.84.5 | via braces | (iii) propagation-only | `via` all strings |
| metro-config | 0.84.6 | via braces | (iii) propagation-only | `via` all strings |
| metro-file-map | 0.84.5 | via braces | (iii) propagation-only | `via` all strings |
| metro-transform-worker | 0.84.5 | via braces | (iii) propagation-only | `via` all strings |
| micromatch | 4.0.8 | via braces (no own advisory) | (iii) propagation-only | `via` all strings; range `>=0.2.0`, `fixAvailable: false` |
| react-native | 0.86.3 | via braces | (iii) propagation-only | `via` all strings |
| react-native-reanimated | 4.5.1 | via braces | (iii) propagation-only | `via` all strings |
| react-native-worklets | 0.10.1 | via braces | (iii) propagation-only | `via` all strings |
| uniwind | 1.12.0 | via braces | (iii) propagation-only | `via` all strings |
| victory-native | 42.0.1 | via braces | (iii) propagation-only | `via` all strings |

No entry classified (iv) unexpected: every high traces to `braces` or `node-forge`; `undici` is absent. The count delta versus row 23 (49 -> 53) is advisory-DB drift on the same two roots (see section 7), not a new advisory class.

## 3. Changed direct dependencies

| Package | Relationship | Before | After | Disposition |
|---|---|---|---|---|
| `undici` (`node_modules/@scalar/json-magic/node_modules/undici`) | transitive (npm override applied to the `@scalar/json-magic` edge; `json-magic` is itself transitive under `@scalar/openapi-parser` in `packages/shared` and under `@dems/core-web`) | 7.29.0 | 7.29.1 | **advisory closed** — GHSA-rfgv-xxqx-mfg5 + GHSA-w293-vg96-wgc3 cleared; `"undici" in vulnerabilities` = false |

No root manifest dependency version changed. The `package.json` change is policy (`overrides`) only; the `package-lock.json` change is the one resolution above. `@scalar/json-magic` itself (0.15.3) and its lock entry did not move; only its nested `undici` edge did. Reason kept: none — every changed dependency closed its advisory.

## 4. Downgrade-ban proof

```
$ git diff -- package.json package-lock.json | grep -Ei "expo|reanimated|skia|worklets|victory-native|api-reference-react|heroui|uniwind|react-native"
(empty: no named downgrade trap appears in the diff)
```

Whole-tree version comparison (stronger than the grep):

```
=== SUMMARY === changed: 1  downgrades: 0  added: 0  removed: 0
```

All 15 row-5 named downgrade traps (expo, react-native-reanimated, @shopify/react-native-skia, react-native-worklets, victory-native, and the other `fixAvailable` downgrade targets) are absent from the diff and unchanged in the lock. PASS.

## 5. Install-script count before / after

`python3`-equivalent count over `hasInstallScript` in `package-lock.json`:

| Tree | Count | Delta |
|---|---|---|
| BEFORE (`git show HEAD:package-lock.json`) | 17 | — |
| AFTER (working tree) | 17 | **0** |

The 17 module paths are byte-identical between the two states (`@embedded-postgres/*` x8, `esbuild` x3, `vue-demi` x3, `fsevents`, `@shopify/react-native-skia`, `unrs-resolver`). `allowScripts` unchanged in the diff (`grep -c allowScripts` = 0):

```json
"allowScripts": {
  "@shopify/react-native-skia@2.6.2": true,
  "@embedded-postgres/darwin-arm64@18.4.0-beta.17": true
}
```

Both keys carry the two pinned versions and were not revoked or added. Newly allowed install scripts = 0. PASS.

## 6. Override sanity

```
$ npm ls undici --all
dems-demo@0.1.0 /Users/gsp-budi/Documents/DEMS
├─┬ @dems/core-web@0.1.0 -> ./apps/core-web
│ └─┬ jsdom@30.1.1
│   └── undici@8.11.2
└─┬ @dems/shared@0.1.0 -> ./packages/shared
  └─┬ @scalar/openapi-parser@0.29.9
    └─┬ @scalar/json-magic@0.15.3
      └── undici@7.29.1 overridden
```

| Check | Result |
|---|---|
| `@scalar/json-magic` copy | 7.29.1, npm-annotated `overridden` |
| jsdom copy unaffected | 8.11.2 (unchanged; override did not leak) |
| physical installed copy | `require('./node_modules/@scalar/json-magic/node_modules/undici/package.json').version` = `7.29.1` |
| hoisted copy | `require('./node_modules/undici/package.json').version` = `8.11.2` |
| `npm ls --depth=0` invalid/extraneous/missing | none (`grep -Ei "invalid\|extraneous\|missing\|UNMET"` empty; exit 0) |

The scoped shape took effect exactly where needed and did not leak to unrelated consumers. PASS.

## 7. Integrity

| Gate | Exit | Basis |
|---|---|---|
| `npm run typecheck` | 0 | re-run by this row; tail shows `tsc --noEmit` for `@dems/mobile` and `@dems/mock-core` |
| `npm run lint` | 0 | re-run by this row; tail shows `eslint .` for `@dems/mobile` and `oxlint` for `@dems/mock-core` |

Re-ran independently (both exit 0). No test suite was run in this row; row 27 owns the wave-A regression.

## 8. Findings

| ID | Severity | What | Remediation | Routed to row 23 |
|---|---|---|---|---|
| R24-01 | Observation (Low) | Live advisory-DB high count re-measures 53 (lock) / 50 (omit-dev) versus row 23's recorded 49 / 46; expected baseline minus the one cleared entry was 53. Still within `<= 53`; `undici` stays cleared; no new root cause. | None to row 23's code. Downstream gates (27, 39) must re-record the live count before comparing rather than quoting "49" as durable. | No code action (documentation note; acknowledged) |
| — | — | No scope creep, no downgrade, no advisory-class regression, no new install script, no credential/secret exposure, no permission/`allowScripts` change. | — | none |

## 9. Verification ledger

| Check (row 24 gate) | Result |
|---|---|
| Diff contains ONLY the scoped override + matching lock entry | PASS |
| Every remaining high classified (i-iv) | PASS (1 cleared / 2 accepted-risk / 51 propagation / 0 unexpected) |
| Changed direct dependency listed with advisory closed or reason kept | PASS (undici: closed; none kept) |
| Downgrade ban respected (0 downgrades, traps absent) | PASS |
| New install scripts count stated (0 delta) + `allowScripts` quote | PASS |
| Override effective and scoped; no invalid/extraneous | PASS |
| Integrity (`typecheck`, `lint`) | PASS (re-run, exit 0) |
| No edits outside the two output files | PASS |

---
*Generated: 2026-10-07 14:30Z*
*Last Updated: 2026-10-07 14:30*
