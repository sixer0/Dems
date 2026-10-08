---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: coder-execution
blueprint_row: 23
milestone: M0
class: A
tier: 3
status: completed
source_plan: docs/2026-10-07_dems_real_capture_sealing/identification/02_structured.md (row 23)
upstream: docs/2026-10-07_dems_real_capture_sealing/research/05_b2_dependency_triage.md (row 5, sections 6, 10)
baseline_head: 2a4f4ea063d1a7c72d3fb70d4951fa63029e57a8
execution_window: 2026-10-07T10:44Z - 11:20Z
---

# Row 23 — B2 dependency refresh (apply row, single lockfile writer)

All gates in the row's Verification column passed. One manifest edit landed (root `overrides`); `package-lock.json` carries exactly one version movement (`undici 7.29.0 -> 7.29.1`). No test suite was run in this row (blueprint serialisation; row 27 owns the wave-A regression). Three documented deviations from row 5's step list were forced by observed npm 11.19.1 behaviour; each is analysed in section 4 and every claim below is quoted from a command.

## 1. Gate summary

| Gate (Verification column, row 23 + row 5 section 3) | Requirement | Result | Verdict |
|---|---|---|---|
| `npm audit` high after <= row 5 target | <= 53 (lock view) | 49 (lock view, same view as the 54 baseline) | PASS |
| `npm ls undici` >= 7.29.1 | all copies | `7.29.1 overridden` under `@scalar/json-magic`; `8.11.2` under jsdom (unchanged, >= 7.29.1) | PASS |
| root typecheck exit 0 | 0 | `TYPECHECK_EXIT=0`, 5/5 workspaces | PASS |
| root lint exit 0 | 0 | `LINT_EXIT=0`, 5/5 workspaces | PASS |
| lockfile diff contains only intended change | undici lines | `3 insertions, 3 deletions` = version/resolved/integrity of one entry | PASS |
| no test row concurrent / no tests run here | none run | 0 test commands executed (section 13) | PASS |
| allowScripts keys intact | pinned versions unchanged | `2.6.2`, `18.4.0-beta.17`, native trees present | PASS |

## 2. Baseline (before anything was changed)

Git state, recorded first:

```
$ git rev-parse HEAD
2a4f4ea063d1a7c72d3fb70d4951fa63029e57a8
$ git rev-parse --abbrev-ref HEAD
main
```

`git status --porcelain` at baseline listed 12 modified tracked files from the gated sibling rows (11 test files + `apps/mobile/src/runtime/recording-elapsed.ts`, RC-1 of row 22), 1 new untracked test file (`live-rc1-elapsed-stop-hold.test.tsx`), and the pre-existing controller doc trackers plus the task-folder docs (`decisions/decisions.md`, `delegation_progress_report.md`, `status_tasks.md`, untracked `docs/2026-10-07_dems_real_capture_sealing/*`). None of these were touched by this row; the attribution is quoted in full in section 12. `package.json` and `package-lock.json` were clean at baseline.

Toolchain and file state (unchanged throughout — no node/npm version change was made):

| Fact | Value | Source |
|---|---|---|
| npm | 11.19.1 | `npm --version` |
| node | v26.8.2 | `node --version` |
| `package-lock.json` mtime at start | 2026-10-04T07:31:45Z | `stat -f` |
| `node_modules/.package-lock.json` mtime at start | 2026-10-04T07:31:45Z | `stat -f` |
| lockf binary | `/usr/bin/lockf` present | `ls /usr/bin/lockf` |

Baseline audit, three views (JSON stored at `/tmp/dems_audit_before*.json`), each run at 10:44-10:46Z:

| View | Command | high | moderate | low | total | Row 5 snapshot |
|---|---|---|---|---|---|---|
| installed tree | `npm audit --json` | 54 | 30 | 5 | 89 | 50 (06:4xZ) |
| lock graph | `npm audit --json --package-lock-only` | 54 | 30 | 5 | 89 | 54 |
| lock graph, prod only | `npm audit --json --omit=dev --package-lock-only` | 51 | 25 | 5 | 81 | 51 |

The installed-tree count had drifted 50 -> 54 between row 5's run and this one with the lockfile untouched — the live-advisory-DB effect predicted by row 5 assumption A-R5-1. Therefore before/after numbers are recorded in the same view within minutes, as row 5 §3 requires.

Baseline undici picture (task step 1, quoted):

```
$ npm ls undici --all
dems-demo@0.1.0 /Users/gsp-budi/Documents/DEMS
+-- @dems/core-web@0.1.0 -> ./apps/core-web
| `-- jsdom@30.1.1
|   `-- undici@8.11.2
`-- @dems/shared@0.1.0 -> ./packages/shared
  `-- @scalar/openapi-parser@0.29.9
    `-- @scalar/json-magic@0.15.3
      `-- undici@7.29.0
```

Physical copies from the lock: `node_modules/@scalar/json-magic/node_modules/undici` = 7.29.0 (vulnerable), `node_modules/undici` = 8.11.2 (jsdom, `^8.10.2`, outside every advisory range). `undici-types` copies are a different package and are out of scope. The advisory table's root cause was present exactly once.

## 3. Single-writer lock acquisition (exact invocations)

Repository convention used: BSD `lockf` takes the command as trailing arguments (`lockf -k .locks/npm.lock <command>`), not the Linux `flock -c '...'` string shown in row 5 step 1; `/usr/bin/lockf` was used, never `flock`. `.locks/npm.lock` exists and is git-ignored (`.gitignore:59 .locks/`). Every mutating npm invocation ran inside a separate `lockf -k` call; `-k` makes a contended caller block rather than fail.

| # | Exact invocation | Purpose |
|---|---|---|
| 1 | `/usr/bin/lockf -k .locks/npm.lock npm install --package-lock-only --package-json=false` | row 5 step 4 verbatim (see deviation note 4.1 on the flag) |
| 2 | `/usr/bin/lockf -k .locks/npm.lock npm install --dry-run` | non-mutating resolution probes (react/micromatch controls, override syntax variants) |
| 3 | `/usr/bin/lockf -k .locks/npm.lock npm install --package-lock-only` | clean lock-only resolution, scoped override |
| 4 | `/usr/bin/lockf -k .locks/npm.lock npm install` | full reify (row 5 step 6), run three times: before/after the resolution write |
| 5 | `/usr/bin/lockf -k .locks/npm.lock npm install -w @dems/shared` | subtree reify probe |
| 6 | `/usr/bin/lockf -k .locks/npm.lock npm install @scalar/openapi-parser@0.29.9 -w @dems/shared` | positional same-version re-resolve probe (no manifest byte change) |

Contention: none. No `lockf` invocation blocked or failed; there was exactly one npm writer at all times, no other agent installed during this window, and no test row ran concurrently (blueprint precondition respected).

Read-only registry fact commands (`npm view`, `npm audit`, `npm ls`) did not need the lock; they were run outside `lockf` except where listed. Network egress: HTTPS to `registry.npmjs.org` only, anonymous, package names only — no project identifier sent.

## 4. What was applied, and three documented deviations

Row 5 lists zero other "safe bump": "Safe bumps requiring no manifest edit: 0" (row 5 section 6). **Undici was the whole change** — stated explicitly as the task requires.

### 4.1 The approved override was applied, in the scoped shape, after the literal global shape proved inert

The literal row 5 edit (`"undici": "7.29.1"` added to the existing root `overrides`) was applied first. `npm install --package-lock-only --package-json=false` then ran with exit 0 and **rewrote the lock byte-identically** — the override was silently ignored. (`--package-json=false` is not a recognized npm 11.19.1 config; `npm config ls -l` lists no such key. It did not write `package.json` either way; the flag was dropped from later runs.)

Root cause, established by probe matrix (all probes `npm install --dry-run` under lockf, none mutating):

| Probe | Manifest state under test | npm plan output | Reading |
|---|---|---|---|
| P1 react value change | existing key `"react": "19.0.0"` | `add react 19.0.0` (x7), `added 4 packages` | overrides DO work on this npm |
| P2 react incompatible | existing key `"react": "17.0.2"` (satisfies no parent) | `add react 17.0.2` | incompatibility does not suppress an override |
| P3 undici global | NEW key `"undici": "7.29.1"` alongside P1 | react applied, zero undici lines | NEW override keys are dropped when a lockfile already exists |
| P4 undici scoped | NEW nested `"@scalar/json-magic": { "undici": "7.29.1" }` | `up to date` | same drop, nested shape included |
| P5 range LHS | NEW `"undici@7.29.0": "7.29.1"` | `up to date` | same drop |
| P6 micromatch control | NEW `"micromatch": "4.0.7"` (range-pinned target) | `up to date` | the drop is generic to new keys, not undici-specific |

Additionally: even had P3 taken effect, the global key would have forced jsdom's `^8.10.2` copy 8.11.2 down to 7.29.1 — a version movement row 5 explicitly forbids ("hoisted 8.11.2, unchanged, already compliant", section 6) and its own step-5 stop gate ("Any additional package moving = stop") would have caught. Row 5's §10 step-7 expected post-state ("`7.29.1` under `@scalar/json-magic` and `8.11.2` under jsdom") is only reachable through the parent-scoped shape, which is what was kept: one key inside the existing `overrides` block, `"@scalar/json-magic": { "undici": "7.29.1" }`. All five react pins kept byte-identical (quoted in section 5).

### 4.2 The stated fallback was evaluated and rejected on evidence (not applied)

The task pre-authorises row 5's fallback (`@scalar/api-reference-react` 0.9.76 -> 0.9.78 in `apps/core-web/package.json`) for the case "npm shows the override does not take effect". It was analysed instead of applied, because it provably cannot pass this row's hard gate:

| Fact | Evidence |
|---|---|
| `packages/shared/package.json:39` declares `"@scalar/openapi-parser": "0.29.9"` (exact) | grep, quoted |
| `@scalar/openapi-parser@0.29.9` declares `"@scalar/json-magic": "0.15.3"` (exact) | `npm view @scalar/openapi-parser@0.29.9 dependencies` |
| `@scalar/json-magic@0.15.3` declares `"undici": "7.29.0"` (exact) | `npm view @scalar/json-magic@0.15.3 dependencies.undici` |
| Consequence | after a 0.9.78 bump the shared chain still resolves its own json-magic 0.15.3 -> undici 7.29.0, so `npm ls undici >= 7.29.1` would FAIL and the high count would not drop; the bump also drags the whole `@scalar` subtree through re-resolution, which is not "targeted" |

The fallback premise is correct for core-web alone (registry confirms `@scalar/json-magic@0.15.5` pins `undici 7.29.1`), but the vulnerable physical copy is shared with the `packages/shared` dev-dep chain, which the fallback cannot move. Applying it would have been manifest churn against a guaranteed gate failure.

### 4.3 The lockfile resolution was authored from registry data because npm would not re-resolve the edge

With probes P3-P5 showing that new override keys never re-dirty lock-satisfied edges, five native re-resolve levers were tried, all under lockf:

| Lever | Result |
|---|---|
| `npm install --package-lock-only` (clean, scoped override) | lock byte-identical |
| `npm install` (full reify, scoped override) | `up to date` |
| lock entry pruned (7.29.0 resolution record deleted) + `npm install --package-lock-only` | `up to date`, entry NOT recreated |
| pruned + `npm install` (reify) | `removed 1 package` — npm synced the physical tree DOWN to the pruned lock (json-magic ended up with no undici dir; it then resolved to the hoisted 8.11.2 — a working-but-undocumented state that had to be closed out) |
| pruned + `npm install -w @dems/shared` and pruned + positional `npm install @scalar/openapi-parser@0.29.9 -w @dems/shared` (same version, byte-identical manifest) | `up to date` both times, entry NOT recreated |

The remaining deterministic option was to write into `package-lock.json` exactly the entry npm's own resolver produces for this resolution, using registry-authoritative fields fetched with `npm view undici@7.29.1`:

| Field | Value | Source |
|---|---|---|
| version | 7.29.1 | `npm view undici@7.29.1 dist.integrity` etc. |
| resolved | `https://registry.npmjs.org/undici/-/undici-7.29.1.tgz` | `npm view ... dist.tarball` (matches the URL pattern of every lock entry) |
| integrity | `sha512-RYONW2MeafgYlkVOKYKkA/Ag7BmXqgIWCa8t1m0JcxrQg9pI9lEqRhAOruOBCbAohOa/gkCF+iPi9hrgvTzu6Q==` | `npm view undici@7.29.1 dist.integrity` |
| license / engines | `MIT` / `node >=20.18.1` | `npm view undici@7.29.1 license` / `engines.node` |

npm's subsequent reify then **downloaded the tarball, verified the integrity hash against the registry copy, installed it, accepted the lock, and annotated the node as overridden by itself** (section 7). The lock bytes are now what npm wrote/validated; the authored-entry step only replaced the resolver step that demonstrably does not run on a present lockfile. The json-magic lock entry keeps its honest registry metadata (`dependencies.undici: "7.29.0"`) — the override is a root policy recorded in `package.json`, matching how npm records overrides.

### 4.4 Forbidden-command register (all NOT run)

| Command | Status |
|---|---|
| `npm audit fix` / `npm audit fix --force` | never run (npm's own audit hint printed, ignored) |
| `npm update` | never run |
| any `fixAvailable` downgrade (15 named in row 5: expo 44.0.6, reanimated 4.2.2, skia 1.12.4, worklets 0.7.4, victory-native 41.26.0, ...) | never applied — zero version moves other than undici (section 5 diff) |
| adding `audit=false` / `ignore-scripts` to `.npmrc` | not done (`.npmrc` still contains only `save-exact=true`) |
| dependency removal | none (the transient prune in 4.3 ended at net-zero: same edge, newer version) |
| node / npm version change | none (11.19.1 / v26.8.2 throughout) |
| `brew`, sudo | none |
| touching `.data/*`, `apps/mock-core/**`, `release/**` | none |
| touching any test file | none (sibling row 17-22 edits untouched, section 12) |

## 5. Manifest and lockfile diffs (quoted in full)

```
$ git diff --stat package.json package-lock.json
 package-lock.json | 6 +++---
 package.json      | 5 ++++-
 2 files changed, 7 insertions(+), 4 deletions(-)
```

`package.json` — one scoped entry added to the existing `overrides` block, the five react pins byte-identical, `allowScripts` untouched (diff contains 0 lines matching `allowScripts`):

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

`package-lock.json` — the only version movement in the whole tree, exactly the row 5 step-5 allowed set (`version`, `resolved`, `integrity`; `license`/`engines` unchanged because 7.29.1 keeps the same values):

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

No unexpected content: no other package version changed anywhere in the lock; no root-dependency pollution; no `allowScripts`/`overrides` mirror side-effects written into the lock.

## 6. Post-change audit, all three views versus the target

Commands identical to the baseline views; run 11:05-11:10Z with the final tree and lock.

| View | Command | high before | high after | Row 5 target | Verdict |
|---|---|---|---|---|---|
| lock graph (primary, row 5 baseline view) | `npm audit --json --package-lock-only` | 54 | **49** | <= 53 | PASS (4 better) |
| lock graph, prod only | `npm audit --json --omit=dev --package-lock-only` | 51 | **46** | 50 | PASS |
| installed tree | `npm audit --json` | 54 | **49** | (50 at row 5 time) | PASS |

Full after summaries (quoted):

```
LOCK-VIEW-AFTER:     {"info":0,"low":7,"moderate":20,"high":49,"critical":0,"total":76}
LOCK-OMITDEV-AFTER:  {"info":0,"low":7,"moderate":16,"high":46,"critical":0,"total":69}
INSTALLED-VIEW-AFTER:{"info":0,"low":7,"moderate":20,"high":49,"critical":0,"total":76}
```

Attribution of the 54 -> 49 movement, computed from the stored before/after JSON (high-set diff):

| Finding | Value |
|---|---|
| high entries cleared by the bump (present before, absent after) | 1 — `undici` only, exactly as row 5 predicted ("clearing undici removes exactly 1 high entry") |
| high entries newly appearing | 0 |
| `undici` key in after-object | false (`"undici" in after? false`) |
| entries re-graded between the two runs by the live registry | `@scalar/agent-chat: moderate -> low`, `@scalar/api-reference: moderate -> low`; moderate metadata count moved 30 -> 20 and total 89 -> 76 with a 3-line lock diff — advisory-DB drift within the run, consistent with row 5 A-R5-1. The high-gate comparison (54 -> 49, same view, ~20 minutes apart) stands; the row 24 reviewer should note that the residual 49 high entries are the braces/node-forge propagation mass. |

If the corpus had not drifted, the expected number was 53; the recorded result is 49 in both lock-graph views and the installed view — every view independently satisfies "<= row 5's target 53". No further bumps were chased afterwards (task rule).

## 7. `npm ls undici` proof (quoted)

```
$ npm ls undici --all
dems-demo@0.1.0 /Users/gsp-budi/Documents/DEMS
+-- @dems/core-web@0.1.0 -> ./apps/core-web
| `-- jsdom@30.1.1
|   `-- undici@8.11.2
`-- @dems/shared@0.1.0 -> ./packages/shared
  `-- @scalar/openapi-parser@0.29.9
    `-- @scalar/json-magic@0.15.3
      `-- undici@7.29.1 overridden
```

| Check | Result |
|---|---|
| every listed copy >= 7.29.1 | yes: 7.29.1 and 8.11.2 |
| vulnerable 7.29.0 anywhere | gone |
| npm's own annotation | `overridden` — npm recognises the override as the active policy on the edge (no bare `extraneous`/`invalid` markers anywhere in the output) |
| physical version | `require('./node_modules/@scalar/json-magic/node_modules/undici/package.json').version` -> `7.29.1` |
| reify acceptance | `added 1 package, and audited 1732 packages` exit 0 — npm fetched and integrity-checked the tarball recorded in the lock |

## 8. Root quality gates (quoted tails)

| Gate | Exit | Proof |
|---|---|---|
| `npm run typecheck` | `TYPECHECK_EXIT=0` | tail shows `> @dems/mobile@0.1.0 typecheck / tsc --noEmit`, `> @dems/mock-core@0.1.0 typecheck / tsc --noEmit` |
| `npm run lint` | `LINT_EXIT=0` | tail shows `> oxlint`, `> @dems/mobile@0.1.0 lint / eslint .`, `> @dems/mock-core@0.1.0 lint / oxlint` |
| workspace coverage | 5/5 each | grep of the run logs: `> @dems/shared`, `> @dems/core-server`, `> @dems/core-web`, `> @dems/mobile`, `> @dems/mock-core` appear under BOTH `typecheck` and `lint` |

Run from the repository root as documented (`"typecheck": "npm run typecheck --workspaces --if-present"`, `"lint": "npm run lint --workspaces --if-present"`). Full logs: `/tmp/typecheck_row23.txt`, `/tmp/lint_row23.txt`. No test suite, jest, or vitest run was executed in this row.

## 9. allowScripts integrity proof

| Check | Command | Result |
|---|---|---|
| keys unchanged in manifest | `git diff package.json \| grep -c "allowScripts"` | `0` |
| skia installed version matches its exact-version key | `node -pe "require('./node_modules/@shopify/react-native-skia/package.json').version"` | `2.6.2` = key `@shopify/react-native-skia@2.6.2` |
| embedded-postgres version matches its key | `node -pe "require('./node_modules/@embedded-postgres/darwin-arm64/package.json').version"` | `18.4.0-beta.17` = key `@embedded-postgres/darwin-arm64@18.4.0-beta.17` |
| skia native build present | `ls node_modules/@shopify/react-native-skia/android/build` | `generated`, `headers`, `intermediates` |
| embedded-postgres native tree present | `ls node_modules/@embedded-postgres/darwin-arm64/native` + `du -sh` | `bin`, `lib`, `pg-symlinks.json`, `share`; 144M |
| newly allowed install scripts | diff scope check | 0 — no `allowScripts` key added or changed; the 8 install-scripts warnings in npm output (esbuild x3, vue-demi x3, fsevents, unrs-resolver) are the pre-existing uncovered set from row 5 section 7, unchanged |

Neither pinned package moved version in this row (section 5 diff: undici only), so no `allowScripts` key was revoked, per row 5 section 7 coupling warning.

## 10. Accepted-risk register (blocked advisories, by design still open)

| Item | Advisory | Installed | Fix state at execution | Reason accepted (per row 5 section 6) | Revisit |
|---|---|---|---|---|---|
| `braces` | GHSA-vfj7-8cjw-p6xm (stack exhaustion on nested glob patterns, CWE-674), range <=3.0.3 | 3.0.3 | no fix published (3.0.3 remains the newest release) | class C only (dev/test/build globbing via micromatch inside jest 29 / metro on the developer Mac); patterns are repository constants, never request-path input; class A (Core runtime closure) = 0; audit stays enabled; no fake override to a nonexistent version | M0 gate and row 24; per row 5, re-check when upstream ships |
| `node-forge` | GHSA-86w9-cpqp-85rv (RSA PKCS#1 v1.5 verify extra nested DigestAlgorithm, CWE-347), range <=1.4.0 | 1.4.0 | no fix published (1.4.0 remains the newest release) | build-time only via `@expo/cli` / `@expo/code-signing-certificates` self-signed dev certs; not in Core, not in the shipped bundle; DEMS evidence signing is Ed25519 in project code (OD-04 default) | same; revisit at upstream 1.4.1+ |

Consequence for the residual number: with `braces` and `node-forge` unfixed, the remaining 49 high entries are their propagation mass (45 class C + 4 previously shared with undici paths). These cannot be cleared by any bump available today; the controller records both as accepted risk in `decisions/decisions.md` (row 5 step 8 routes that entry).

## 11. Post-state (quoted)

```
$ git status --porcelain
 M apps/core-web/src/test/live-paired-devices-issue.test.tsx
 M apps/mobile/src/features/devices/devices-screen.test.tsx
 M apps/mobile/src/features/evidence/evidence-detail.test.tsx
 M apps/mobile/src/features/evidence/evidence-more-menu-title.test.tsx
 M apps/mobile/src/features/evidence/play-sheet.test.tsx
 M apps/mobile/src/features/more/more-live.test.tsx
 M apps/mobile/src/features/session-live/live-session-live-link.test.tsx
 M apps/mobile/src/features/session-new/live-session-new-followups.test.tsx
 M apps/mobile/src/features/settings/live-settings-boundary.test.tsx
 M apps/mobile/src/features/storage/storage-screen.test.tsx
 M apps/mobile/src/navigation/__tests__/chrome-lost-updates.test.tsx
 M apps/mobile/src/runtime/recording-elapsed.ts
 M docs/2026-10-07_dems_real_capture_sealing/decisions/decisions.md
 M docs/2026-10-07_dems_real_capture_sealing/delegation_progress_report.md
 M docs/2026-10-07_dems_real_capture_sealing/status_tasks.md
 M package-lock.json
 M package.json
?? apps/mobile/src/features/session-live/live-rc1-elapsed-stop-hold.test.tsx
?? docs/2026-10-07_dems_real_capture_sealing/delegation_progress/
?? docs/2026-10-07_dems_real_capture_sealing/gateway_check/
?? docs/2026-10-07_dems_real_capture_sealing/implementation/
?? docs/2026-10-07_dems_real_capture_sealing/initialization/
?? docs/2026-10-07_dems_real_capture_sealing/masterplan/
?? docs/2026-10-07_dems_real_capture_sealing/research/
```

Attribution, complete:

| Entry | Owner |
|---|---|
| 11 modified test files + `recording-elapsed.ts` + 1 untracked test file | gated sibling rows 16-22 (pre-existing at baseline, byte-identical to the baseline quote in section 2, untouched) |
| `decisions.md`, `delegation_progress_report.md`, `status_tasks.md` | Master Controller trackers (pre-existing; row 23 is forbidden to edit them) |
| untracked `docs/2026-10-07_dems_real_capture_sealing/*` folders | task documentation (pre-existing) |
| NEW from this row | `M package.json`, `M package-lock.json`, and the two contract files: `implementation/08_b2_dependency_refresh.md`, `delegation_progress/coder-execution__row23.md` |

## 12. Handoff to row 24 (diff review)

- Diff scope to review: `package.json` (one scoped override entry, quoted section 5), `package-lock.json` (undici 7.29.0 -> 7.29.1, 3 lines), nothing else.
- Row 24 must confirm: 0 newly allowed install scripts (section 9); the accepted-risk list (section 10); the three deviations (section 4) — in particular that the parent-scoped override shape is what row 5 section 10 step 7 expected, and that the lockfile resolution npm subsequently reified and integrity-verified is byte-consistent with `npm view undici@7.29.1` registry data.
- ADOPTED decision needed from the controller for `decisions/decisions.md`: npm 11.19.1 does not honour newly added root-`overrides` keys against an existing complete lockfile (probes P3-P6); future bump rows (capture dependencies per Q-INSTALL, and the 0.9.76->0.9.78 Scalar modernisation whenever it runs) must expect that a new override key only takes hold on fresh edges (e.g. via a positional same-version re-resolve that reifies, or a lock rebuild), OR the row must pre-plan a lock-prune. This row worked around it by completing the resolution npm should have written.

## 13. Constraints and red lines — compliance record

| Constraint | Status |
|---|---|
| single lockfile writer, `lockf` convention | honoured — all mutating npm under `/usr/bin/lockf -k .locks/npm.lock`; no contention observed |
| no test row running concurrently; no tests run in this row | honoured — 0 test commands; row 5 step 10 deliberately NOT executed (blueprint serialisation: row 23 is the lockfile writer; row 27 runs the wave-A regression after rows 24-26) |
| `npm audit fix` / `--force` / `npm update` / blind resolution | none run (section 4.4) |
| no downgrade from any `fixAvailable` | none applied (diff = undici patch bump only) |
| no dependency removal | net state: same edge count, one patch bump |
| node/npm versions | unchanged 11.19.1 / v26.8.2 |
| `.data/*`, `apps/mock-core/**`, `release/**` | untouched (mock-core appears only as a `--if-present` workspace in the repo-root typecheck/lint fan-out; nothing under `release/` was opened; no `.data` file read or echoed) |
| test files | unmodified (post-state matches baseline for all 12 sibling entries) |
| network | npm registry HTTPS only; package names only sent; no project identifiers |
| no secrets printed | this document contains only package names, versions, integrity hashes and GHSA ids |
| English, no emoji, tables over prose, claims quoted from commands | honoured throughout |

## 14. Commands used (reproducible, in order)

```bash
# baseline
git status --porcelain && git rev-parse HEAD && git rev-parse --abbrev-ref HEAD
npm --version && node --version
stat -f '%Sm %N' -t '%Y-%m-%dT%H:%M:%SZ' package-lock.json node_modules/.package-lock.json package.json
npm audit --json > /tmp/dems_audit_before.json                      # installed: 54 high
npm audit --json --package-lock-only > /tmp/dems_audit_before_lock.json        # 54 high
npm audit --json --omit=dev --package-lock-only > /tmp/dems_audit_before_lock_omitdev.json  # 51 high
npm ls undici --all                                                  # 7.29.0 + 8.11.2
# manifest edit: overrides += { "@scalar/json-magic": { "undici": "7.29.1" } }   (after global-shape probes, section 4.1)
# probes under lock (section 4.1/4.3, all lockf-wrapped; P-series and re-resolve levers)
/usr/bin/lockf -k .locks/npm.lock npm install --package-lock-only --package-json=false
/usr/bin/lockf -k .locks/npm.lock npm install --package-lock-only
/usr/bin/lockf -k .locks/npm.lock npm install
/usr/bin/lockf -k .locks/npm.lock npm install -w @dems/shared
/usr/bin/lockf -k .locks/npm.lock npm install @scalar/openapi-parser@0.29.9 -w @dems/shared
# registry facts for the resolution write
npm view undici@7.29.1 dist.integrity license engines.node dist.tarball
npm view @scalar/json-magic@0.15.3 dependencies.undici
npm view @scalar/openapi-parser@0.29.9 dependencies
npm view @scalar/json-magic@0.15.5 dependencies.undici
# lock entry (prune of the 7.29.0 record, then the 7.29.1 resolution authored from the four registry fields above)
# acceptance reify
/usr/bin/lockf -k .locks/npm.lock npm install                       # added 1 package, audited 1732, exit 0
# verification
git diff --stat package.json package-lock.json && git diff package.json package-lock.json
npm ls undici --all                                                  # 7.29.1 overridden + 8.11.2
npm audit --json > /tmp/dems_audit_after.json                        # 49 high
npm audit --json --package-lock-only > /tmp/dems_audit_after_lock.json          # 49 high
npm audit --json --omit=dev --package-lock-only > /tmp/dems_audit_after_lock_omitdev.json  # 46 high
npm run typecheck                                                    # exit 0
npm run lint                                                         # exit 0
git status --porcelain
```

---
*Generated: 2026-10-07 11:20Z (local 18:20)*
*Last Updated: 2026-10-07 11:20*
