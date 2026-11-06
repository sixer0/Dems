---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 26
agent: verifier
narrative_tier: 3
status: complete
verdict: PASS (7/7; 2 CAUTIONs on AC command wording, 0 FAIL)
date: 2026-10-01
spec: masterplan/01_specs.md §1.2, §1.4, §1.8, §9 (AC-12..AC-15, AC-17, AC-18, AC-46); research/03_analysis.md SD-04 (RA-1..RA-6)
depends_on: rows 17, 18 (implementation/04_core_web_app.md, implementation/05_mobile_app.md, both status complete)
---

# Step 26: pre-baseline gate (read-only monorepo invariants)

## Scope and method

- **What**: the 7 invariants that row 26 names and that both builds inherit: AC-12, AC-13, AC-14, AC-15, AC-17, AC-46, and AC-18 in pre-commit form (the S-1 no-drift test). Supplementary checks the controller asked for follow in §3: overrides, no eas.json or projectId, `.gitignore` coverage including the .docx, and no secrets.
- **Where**: `/Users/gsp-budi/Documents/DEMS`. Every command runs from the workspace root unless stated. npm commands carry `npm_config_cache="$PWD/.cache/npm"` (spec R-4) and `npm_config_update_notifier=false`.
- **Read-only**: no dev server, emulator, Metro or Gradle was started. No process was stopped. `git status` ran with `GIT_OPTIONAL_LOCKS=0`, so it wrote no index. The theme files' sha256 and mtime are the same before and after (AC-18 below).
  - My commands made one workspace write: Vitest's result cache, `packages/shared/node_modules/.vite/vitest/…/results.json` (01:55:28). It is git-ignored.
  - Other recent writes are step 19's: `.locks/*`, `apps/mobile/.expo/*`, `apps/mobile/expo-env.d.ts` and `apps/core-web/node_modules/.vite/deps/*`. `graft/` changes come from the Graft auto-refresh. All of these except `.locks/` are git-ignored; `.locks/` is covered under S-6.
- **Not run**: root `npm run typecheck`, `npm run lint` and the full `npm test`. Row 26's verification cell does not require them; only the S-1 theme test runs, as the AC-18 pre-commit form. No test failed, so no P11 re-run was needed.
- **Sandbox noise**: Node inside the agent sandbox prints `ERROR: failed to copy trust settings of system certificate-25291` on stderr. This is not npm output; those lines are filtered from the quotes below.
- **Graft**: not used. `graft blast` needs a diff against a commit, and the repository has no commit yet (`git log` → `fatal: your current branch 'main' does not have any commits yet`). The checks here are dependency and config invariants, not a code change set.
- **Step 19 state observed, not touched**: `lsof` listeners were PID 3489 on `[::1]:5173` (SMART WMS, D41 f) and PID 3550 on `127.0.0.1:5174`. `ps` is blocked by the sandbox (`operation not permitted: ps`).

## 1. Results summary

| # | Check | Result | Owner if FAIL |
|---|---|---|---|
| 1 | AC-12 `npm ls --workspaces --depth=0`; every §1.4 pin present, exact pins equal, `~` pins in range | **PASS**: exit 0; 112/112 spec rows OK; 4 extras, all approved (D30, D41 a); must-be-absent list clean | row 14 (root) / 15 / 16 / 17 / 18 |
| 2 | AC-13 single React: `react@19.2.3` and `react-dom@19.2.3` only; no nested copy in the apps | **PASS (CAUTION: command wording)**: one physical copy of each, at `node_modules/react` and `node_modules/react-dom`, both 19.2.3; both `test ! -d` exit 0. The literal grep over-matches `lucide-react@`, `@heroui/react@` and `@testing-library/react@` (see F-1) | row 14 (overrides) / 17 / 18 |
| 3 | AC-14 only `react-native@0.86.3`; only `typescript@6.0.3` | **PASS (CAUTION: command wording)**: one `react-native` 0.86.3 and one `typescript` 6.0.3. The literal react-native grep over-matches `lucide-react-native@` and `@testing-library/react-native@` (F-1) | row 18 / 14 |
| 4 | AC-15 no `"workspace:` protocol | **PASS**: no output, exit 1 | row 14–18 (the owning manifest) |
| 5 | AC-17 notices count ≥ 2; no shadcn | **PASS**: count `2`; the shadcn grep finds nothing (exit 2: `components.json` is absent) | row 17 |
| 6 | AC-46 .docx, `apps/mobile/android`, `.cache` git-ignored | **PASS**: exit 0 | row 14 (root .gitignore) / 18 (apps/mobile/.gitignore) |
| 7 | AC-18, pre-commit form (S-1 no-drift) | **PASS**: 5/5 S-1 tests incl. "committed theme files equal the generator output (no drift)". An independent in-memory compare gives equal=true for both files; sha256 and mtime unchanged | row 15 |

**Gate verdict: PASS.** No check routes a correction to rows 14, 15, 17 or 18. The two CAUTIONs are spec command-wording defects (F-1). They need a D29-style wording ruling from the controller, not a code or dependency change.

## 2. Evidence per check

### Check 1: AC-12 (PASS)

```
$ npm ls --workspaces --depth=0
exit=0
dems-demo@0.1.0 /Users/gsp-budi/Documents/DEMS
+-- @dems/core-web@0.1.0 -> ./apps/core-web
| +-- @dems/shared@0.1.0 deduped -> ./packages/shared
| +-- @fontsource-variable/inter@5.3.0
| +-- @fontsource-variable/jetbrains-mono@5.3.0
| +-- @fontsource-variable/orbitron@5.3.0
| +-- @heroui/react@3.2.6
| +-- @heroui/styles@3.2.6
| +-- @hookform/resolvers@5.9.1
| +-- @tailwindcss/vite@4.3.3
| +-- @tanstack/react-query@5.104.0
| +-- @tanstack/react-router@1.170.40
| +-- @tanstack/react-table@8.21.3
| +-- @tanstack/router-plugin@1.168.41
| +-- @testing-library/dom@10.4.2
| +-- @testing-library/jest-dom@7.0.1
| +-- @testing-library/react@16.3.3
| +-- @types/node@26.6.3
| +-- @types/react-dom@19.2.7 overridden
| +-- @types/react@19.2.18 overridden
| +-- @vitejs/plugin-react@6.1.1
| +-- clsx@2.1.1
| +-- jsdom@30.1.1
| +-- lucide-react@1.49.0
| +-- motion@13.4.6
| +-- oxlint@1.86.0
| +-- react-dom@19.2.3 overridden
| +-- react-hook-form@7.89.0
| +-- react-is@19.2.3
| +-- react-use-measure@2.1.7
| +-- react@19.2.3 overridden
| +-- recharts@3.10.1
| +-- tailwind-merge@3.7.0
| +-- tailwindcss@4.3.3
| +-- typescript@6.0.3
| +-- vite@8.3.1
| +-- vitest@5.0.3
| `-- zod@4.6.5
+-- @dems/mobile@0.1.0 -> ./apps/mobile
| +-- @dems/shared@0.1.0 deduped -> ./packages/shared
| +-- @expo-google-fonts/inter@0.4.2
| +-- @expo-google-fonts/jetbrains-mono@0.4.1
| +-- @expo-google-fonts/orbitron@0.4.2
| +-- @expo/ui@57.0.21
| +-- @gorhom/bottom-sheet@5.2.14
| +-- @hookform/resolvers@5.9.1
| +-- @shopify/flash-list@2.0.2
| +-- @shopify/react-native-skia@2.6.2
| +-- @tanstack/react-query@5.104.0 deduped
| +-- @testing-library/react-native@13.3.3
| +-- @types/react@19.2.18 deduped
| +-- eslint-config-expo@57.0.2
| +-- eslint@9.39.5
| +-- expo-blur@57.0.3
| +-- expo-constants@57.0.20
| +-- expo-device@57.0.2
| +-- expo-doctor@1.20.4
| +-- expo-font@57.0.4
| +-- expo-glass-effect@57.0.4
| +-- expo-haptics@57.0.3
| +-- expo-image@57.0.5
| +-- expo-keep-awake@57.0.2
| +-- expo-linear-gradient@57.0.2
| +-- expo-linking@57.0.11
| +-- expo-local-authentication@57.0.3
| +-- expo-router@57.0.24
| +-- expo-splash-screen@57.0.9
| +-- expo-status-bar@57.0.1
| +-- expo-symbols@57.0.3
| +-- expo-system-ui@57.0.4
| +-- expo-video@57.0.5
| +-- expo-web-browser@57.0.3
| +-- expo@57.0.26
| +-- heroui-native@1.0.10
| +-- i18next@26.4.2
| +-- jest-expo@57.0.5
| +-- jest@29.7.0
| +-- lucide-react-native@1.49.0
| +-- react-dom@19.2.3 deduped
| +-- react-hook-form@7.89.0 deduped
| +-- react-i18next@17.0.15
| +-- react-native-gesture-handler@2.32.0
| +-- react-native-reanimated@4.5.1
| +-- react-native-safe-area-context@5.7.0
| +-- react-native-screens@4.26.2
| +-- react-native-svg@15.15.4
| +-- react-native-web@0.21.3
| +-- react-native-worklets@0.10.1
| +-- react-native@0.86.3
| +-- react-test-renderer@19.2.3 overridden
| +-- react@19.2.3 deduped
| +-- tailwind-merge@3.7.0 deduped
| +-- tailwind-variants@3.3.1
| +-- tailwindcss@4.3.3 deduped
| +-- typescript@6.0.3 deduped
| +-- uniwind@1.12.0
| +-- victory-native@42.0.1
| +-- zod@4.6.5 deduped
| `-- zustand@5.0.15
+-- @dems/mock-core@0.1.0 -> ./apps/mock-core
| +-- @dems/shared@0.1.0 deduped -> ./packages/shared
| +-- @fastify/cors@11.3.0
| +-- @fastify/websocket@11.3.1
| +-- @types/node@26.6.3 deduped
| +-- @types/ws@8.18.2
| +-- fastify@5.12.5
| +-- oxlint@1.86.0 deduped
| +-- tsx@4.23.15
| +-- typescript@6.0.3 deduped
| +-- vitest@5.0.3 deduped
| `-- ws@8.22.0
`-- @dems/shared@0.1.0 -> ./packages/shared
  +-- @types/node@26.6.3 deduped
  +-- @types/react@19.2.18 deduped
  +-- oxlint@1.86.0 deduped
  +-- react@19.2.3 deduped
  +-- tsx@4.23.15 deduped
  +-- typescript@6.0.3 deduped
  +-- vitest@5.0.3 deduped
  `-- zod@4.6.5 deduped

```

- The listing has no `invalid`, `missing`, `extraneous` or `UNMET` marker.
- `overridden` marks the root `overrides` applying, as SD-04 intends.

**Pin comparison.**
- **Method**: a Node script encodes every row of 01_specs §1.4 for the four workspaces. It compares each spec pin with the declared value in the workspace `package.json` and with the installed version, resolved from the workspace directory upward.
- **Rules**: exact pins must be equal. `~X.Y.Z` pins must resolve to `>=X.Y.Z <X.(Y+1).0`. `*` must resolve to the local `@dems/shared`. The six template-kept mobile packages (spec lists no version) must be present.
- **Extras**: packages not in §1.4 must be covered by a decision.
- **Must be absent**: the list is checked against `apps/mobile/package.json`.
- **Script**: session scratchpad `ac12_pins.mjs`.

<details><summary>Full comparator output (125 lines)</summary>

```
$ node ac12_pins.mjs
exit=0
OK   packages/shared  dependencies     zod                                spec=4.6.5       declared=4.6.5      installed=4.6.5 @node_modules/zod [exact]
OK   packages/shared  peerDependencies react                              spec=19.2.3      declared=19.2.3     installed=n/a [peer exact]
OK   packages/shared  devDependencies  typescript                         spec=6.0.3       declared=6.0.3      installed=6.0.3 @node_modules/typescript [exact]
OK   packages/shared  devDependencies  tsx                                spec=4.23.15     declared=4.23.15    installed=4.23.15 @node_modules/tsx [exact]
OK   packages/shared  devDependencies  vitest                             spec=5.0.3       declared=5.0.3      installed=5.0.3 @node_modules/vitest [exact]
OK   packages/shared  devDependencies  oxlint                             spec=1.86.0      declared=1.86.0     installed=1.86.0 @node_modules/oxlint [exact]
OK   packages/shared  devDependencies  @types/node                        spec=26.6.3      declared=26.6.3     installed=26.6.3 @node_modules/@types/node [exact]
OK   packages/shared  devDependencies  react                              spec=19.2.3      declared=19.2.3     installed=19.2.3 @node_modules/react [exact]
OK   packages/shared  devDependencies  @types/react                       spec=19.2.18     declared=19.2.18    installed=19.2.18 @node_modules/@types/react [exact]
OK   apps/mock-core   dependencies     @dems/shared                       spec=*           declared=*          installed=0.1.0 @node_modules/@dems/shared [internal]
OK   apps/mock-core   dependencies     fastify                            spec=5.12.5      declared=5.12.5     installed=5.12.5 @node_modules/fastify [exact]
OK   apps/mock-core   dependencies     @fastify/websocket                 spec=11.3.1      declared=11.3.1     installed=11.3.1 @node_modules/@fastify/websocket [exact]
OK   apps/mock-core   dependencies     @fastify/cors                      spec=11.3.0      declared=11.3.0     installed=11.3.0 @node_modules/@fastify/cors [exact]
OK   apps/mock-core   dependencies     tsx                                spec=4.23.15     declared=4.23.15    installed=4.23.15 @node_modules/tsx [exact]
OK   apps/mock-core   devDependencies  typescript                         spec=6.0.3       declared=6.0.3      installed=6.0.3 @node_modules/typescript [exact]
OK   apps/mock-core   devDependencies  @types/node                        spec=26.6.3      declared=26.6.3     installed=26.6.3 @node_modules/@types/node [exact]
OK   apps/mock-core   devDependencies  @types/ws                          spec=8.18.2      declared=8.18.2     installed=8.18.2 @node_modules/@types/ws [exact]
OK   apps/mock-core   devDependencies  ws                                 spec=8.22.0      declared=8.22.0     installed=8.22.0 @node_modules/ws [exact]
OK   apps/mock-core   devDependencies  vitest                             spec=5.0.3       declared=5.0.3      installed=5.0.3 @node_modules/vitest [exact]
OK   apps/mock-core   devDependencies  oxlint                             spec=1.86.0      declared=1.86.0     installed=1.86.0 @node_modules/oxlint [exact]
OK   apps/core-web    dependencies     react                              spec=19.2.3      declared=19.2.3     installed=19.2.3 @node_modules/react [exact]
OK   apps/core-web    dependencies     react-dom                          spec=19.2.3      declared=19.2.3     installed=19.2.3 @node_modules/react-dom [exact]
OK   apps/core-web    dependencies     react-is                           spec=19.2.3      declared=19.2.3     installed=19.2.3 @node_modules/react-is [exact]
OK   apps/core-web    dependencies     @heroui/react                      spec=3.2.6       declared=3.2.6      installed=3.2.6 @node_modules/@heroui/react [exact]
OK   apps/core-web    dependencies     @heroui/styles                     spec=3.2.6       declared=3.2.6      installed=3.2.6 @node_modules/@heroui/styles [exact]
OK   apps/core-web    dependencies     motion                             spec=13.4.6      declared=13.4.6     installed=13.4.6 @node_modules/motion [exact]
OK   apps/core-web    dependencies     @tanstack/react-router             spec=1.170.40    declared=1.170.40   installed=1.170.40 @node_modules/@tanstack/react-router [exact]
OK   apps/core-web    dependencies     @tanstack/react-query              spec=5.104.0     declared=5.104.0    installed=5.104.0 @node_modules/@tanstack/react-query [exact]
OK   apps/core-web    dependencies     @tanstack/react-table              spec=8.21.3      declared=8.21.3     installed=8.21.3 @node_modules/@tanstack/react-table [exact]
OK   apps/core-web    dependencies     recharts                           spec=3.10.1      declared=3.10.1     installed=3.10.1 @node_modules/recharts [exact]
OK   apps/core-web    dependencies     lucide-react                       spec=1.49.0      declared=1.49.0     installed=1.49.0 @node_modules/lucide-react [exact]
OK   apps/core-web    dependencies     @fontsource-variable/orbitron      spec=5.3.0       declared=5.3.0      installed=5.3.0 @node_modules/@fontsource-variable/orbitron [exact]
OK   apps/core-web    dependencies     @fontsource-variable/inter         spec=5.3.0       declared=5.3.0      installed=5.3.0 @node_modules/@fontsource-variable/inter [exact]
OK   apps/core-web    dependencies     @fontsource-variable/jetbrains-mono spec=5.3.0       declared=5.3.0      installed=5.3.0 @node_modules/@fontsource-variable/jetbrains-mono [exact]
OK   apps/core-web    dependencies     react-hook-form                    spec=7.89.0      declared=7.89.0     installed=7.89.0 @node_modules/react-hook-form [exact]
OK   apps/core-web    dependencies     zod                                spec=4.6.5       declared=4.6.5      installed=4.6.5 @node_modules/zod [exact]
OK   apps/core-web    dependencies     @hookform/resolvers                spec=5.9.1       declared=5.9.1      installed=5.9.1 @apps/core-web/node_modules/@hookform/resolvers [exact]
OK   apps/core-web    dependencies     clsx                               spec=2.1.1       declared=2.1.1      installed=2.1.1 @node_modules/clsx [exact]
OK   apps/core-web    dependencies     tailwind-merge                     spec=3.7.0       declared=3.7.0      installed=3.7.0 @node_modules/tailwind-merge [exact]
OK   apps/core-web    dependencies     react-use-measure                  spec=2.1.7       declared=2.1.7      installed=2.1.7 @node_modules/react-use-measure [exact]
OK   apps/core-web    dependencies     @dems/shared                       spec=*           declared=*          installed=0.1.0 @node_modules/@dems/shared [internal]
OK   apps/core-web    devDependencies  vite                               spec=8.3.1       declared=8.3.1      installed=8.3.1 @node_modules/vite [exact]
OK   apps/core-web    devDependencies  @vitejs/plugin-react               spec=6.1.1       declared=6.1.1      installed=6.1.1 @node_modules/@vitejs/plugin-react [exact]
OK   apps/core-web    devDependencies  @tanstack/router-plugin            spec=1.168.41    declared=1.168.41   installed=1.168.41 @node_modules/@tanstack/router-plugin [exact]
OK   apps/core-web    devDependencies  tailwindcss                        spec=4.3.3       declared=4.3.3      installed=4.3.3 @node_modules/tailwindcss [exact]
OK   apps/core-web    devDependencies  @tailwindcss/vite                  spec=4.3.3       declared=4.3.3      installed=4.3.3 @node_modules/@tailwindcss/vite [exact]
OK   apps/core-web    devDependencies  typescript                         spec=6.0.3       declared=6.0.3      installed=6.0.3 @node_modules/typescript [exact]
OK   apps/core-web    devDependencies  @types/react                       spec=19.2.18     declared=19.2.18    installed=19.2.18 @node_modules/@types/react [exact]
OK   apps/core-web    devDependencies  @types/react-dom                   spec=19.2.7      declared=19.2.7     installed=19.2.7 @node_modules/@types/react-dom [exact]
OK   apps/core-web    devDependencies  @types/node                        spec=26.6.3      declared=26.6.3     installed=26.6.3 @node_modules/@types/node [exact]
OK   apps/core-web    devDependencies  oxlint                             spec=1.86.0      declared=1.86.0     installed=1.86.0 @node_modules/oxlint [exact]
OK   apps/core-web    devDependencies  vitest                             spec=5.0.3       declared=5.0.3      installed=5.0.3 @node_modules/vitest [exact]
OK   apps/core-web    devDependencies  jsdom                              spec=30.1.1      declared=30.1.1     installed=30.1.1 @node_modules/jsdom [exact]
OK   apps/core-web    devDependencies  @testing-library/react             spec=16.3.3      declared=16.3.3     installed=16.3.3 @node_modules/@testing-library/react [exact]
OK   apps/core-web    devDependencies  @testing-library/dom               spec=10.4.2      declared=10.4.2     installed=10.4.2 @node_modules/@testing-library/dom [exact]
OK   apps/core-web    devDependencies  @testing-library/jest-dom          spec=7.0.1       declared=7.0.1      installed=7.0.1 @node_modules/@testing-library/jest-dom [exact]
OK   apps/mobile      dependencies     expo                               spec=~57.0.26    declared=~57.0.26   installed=57.0.26 @node_modules/expo [tilde]
OK   apps/mobile      dependencies     react                              spec=19.2.3      declared=19.2.3     installed=19.2.3 @node_modules/react [exact]
OK   apps/mobile      dependencies     react-dom                          spec=19.2.3      declared=19.2.3     installed=19.2.3 @node_modules/react-dom [exact]
OK   apps/mobile      dependencies     react-native                       spec=0.86.3      declared=0.86.3     installed=0.86.3 @node_modules/react-native [exact]
OK   apps/mobile      dependencies     react-native-web                   spec=~0.21.0     declared=~0.21.0    installed=0.21.3 @node_modules/react-native-web [tilde]
OK   apps/mobile      dependencies     expo-router                        spec=~57.0.24    declared=~57.0.24   installed=57.0.24 @node_modules/expo-router [tilde]
OK   apps/mobile      dependencies     react-native-screens               spec=~4.26.0     declared=~4.26.0    installed=4.26.2 @node_modules/react-native-screens [tilde]
OK   apps/mobile      dependencies     react-native-safe-area-context     spec=~5.7.0      declared=~5.7.0     installed=5.7.0 @node_modules/react-native-safe-area-context [tilde]
OK   apps/mobile      dependencies     react-native-reanimated            spec=4.5.1       declared=4.5.1      installed=4.5.1 @node_modules/react-native-reanimated [exact]
OK   apps/mobile      dependencies     react-native-worklets              spec=0.10.1      declared=0.10.1     installed=0.10.1 @node_modules/react-native-worklets [exact]
OK   apps/mobile      dependencies     react-native-gesture-handler       spec=~2.32.0     declared=~2.32.0    installed=2.32.0 @node_modules/react-native-gesture-handler [tilde]
OK   apps/mobile      dependencies     react-native-svg                   spec=15.15.4     declared=15.15.4    installed=15.15.4 @node_modules/react-native-svg [exact]
OK   apps/mobile      dependencies     @shopify/react-native-skia         spec=2.6.2       declared=2.6.2      installed=2.6.2 @node_modules/@shopify/react-native-skia [exact]
OK   apps/mobile      dependencies     @shopify/flash-list                spec=2.0.2       declared=2.0.2      installed=2.0.2 @node_modules/@shopify/flash-list [exact]
OK   apps/mobile      dependencies     expo-video                         spec=~57.0.5     declared=~57.0.5    installed=57.0.5 @node_modules/expo-video [tilde]
OK   apps/mobile      dependencies     expo-blur                          spec=~57.0.3     declared=~57.0.3    installed=57.0.3 @node_modules/expo-blur [tilde]
OK   apps/mobile      dependencies     expo-linear-gradient               spec=~57.0.2     declared=~57.0.2    installed=57.0.2 @node_modules/expo-linear-gradient [tilde]
OK   apps/mobile      dependencies     expo-haptics                       spec=~57.0.3     declared=~57.0.3    installed=57.0.3 @node_modules/expo-haptics [tilde]
OK   apps/mobile      dependencies     expo-keep-awake                    spec=~57.0.2     declared=~57.0.2    installed=57.0.2 @node_modules/expo-keep-awake [tilde]
OK   apps/mobile      dependencies     expo-font                          spec=~57.0.4     declared=~57.0.4    installed=57.0.4 @node_modules/expo-font [tilde]
OK   apps/mobile      dependencies     expo-splash-screen                 spec=~57.0.9     declared=~57.0.9    installed=57.0.9 @node_modules/expo-splash-screen [tilde]
OK   apps/mobile      dependencies     expo-status-bar                    spec=~57.0.1     declared=~57.0.1    installed=57.0.1 @node_modules/expo-status-bar [tilde]
OK   apps/mobile      dependencies     expo-system-ui                     spec=~57.0.4     declared=~57.0.4    installed=57.0.4 @node_modules/expo-system-ui [tilde]
OK   apps/mobile      dependencies     expo-constants                     spec=~57.0.20    declared=~57.0.20   installed=57.0.20 @node_modules/expo-constants [tilde]
OK   apps/mobile      dependencies     expo-linking                       spec=~57.0.11    declared=~57.0.11   installed=57.0.11 @node_modules/expo-linking [tilde]
OK   apps/mobile      dependencies     expo-image                         spec=(template)  declared=~57.0.5    installed=57.0.5 @node_modules/expo-image [template-kept]
OK   apps/mobile      dependencies     expo-symbols                       spec=(template)  declared=~57.0.3    installed=57.0.3 @node_modules/expo-symbols [template-kept]
OK   apps/mobile      dependencies     expo-web-browser                   spec=(template)  declared=~57.0.3    installed=57.0.3 @node_modules/expo-web-browser [template-kept]
OK   apps/mobile      dependencies     expo-device                        spec=(template)  declared=~57.0.2    installed=57.0.2 @node_modules/expo-device [template-kept]
OK   apps/mobile      dependencies     @expo/ui                           spec=(template)  declared=~57.0.21   installed=57.0.21 @node_modules/@expo/ui [template-kept]
OK   apps/mobile      dependencies     expo-glass-effect                  spec=(template)  declared=~57.0.4    installed=57.0.4 @node_modules/expo-glass-effect [template-kept]
OK   apps/mobile      dependencies     heroui-native                      spec=1.0.10      declared=1.0.10     installed=1.0.10 @node_modules/heroui-native [exact]
OK   apps/mobile      dependencies     uniwind                            spec=1.12.0      declared=1.12.0     installed=1.12.0 @node_modules/uniwind [exact]
OK   apps/mobile      dependencies     tailwindcss                        spec=4.3.3       declared=4.3.3      installed=4.3.3 @node_modules/tailwindcss [exact]
OK   apps/mobile      dependencies     tailwind-variants                  spec=3.3.1       declared=3.3.1      installed=3.3.1 @node_modules/tailwind-variants [exact]
OK   apps/mobile      dependencies     tailwind-merge                     spec=3.7.0       declared=3.7.0      installed=3.7.0 @node_modules/tailwind-merge [exact]
OK   apps/mobile      dependencies     @gorhom/bottom-sheet               spec=5.2.14      declared=5.2.14     installed=5.2.14 @node_modules/@gorhom/bottom-sheet [exact]
OK   apps/mobile      dependencies     victory-native                     spec=42.0.1      declared=42.0.1     installed=42.0.1 @node_modules/victory-native [exact]
OK   apps/mobile      dependencies     lucide-react-native                spec=1.49.0      declared=1.49.0     installed=1.49.0 @node_modules/lucide-react-native [exact]
OK   apps/mobile      dependencies     @expo-google-fonts/orbitron        spec=0.4.2       declared=0.4.2      installed=0.4.2 @node_modules/@expo-google-fonts/orbitron [exact]
OK   apps/mobile      dependencies     @expo-google-fonts/inter           spec=0.4.2       declared=0.4.2      installed=0.4.2 @node_modules/@expo-google-fonts/inter [exact]
OK   apps/mobile      dependencies     @expo-google-fonts/jetbrains-mono  spec=0.4.1       declared=0.4.1      installed=0.4.1 @node_modules/@expo-google-fonts/jetbrains-mono [exact]
OK   apps/mobile      dependencies     @tanstack/react-query              spec=5.104.0     declared=5.104.0    installed=5.104.0 @node_modules/@tanstack/react-query [exact]
OK   apps/mobile      dependencies     react-hook-form                    spec=7.89.0      declared=7.89.0     installed=7.89.0 @node_modules/react-hook-form [exact]
OK   apps/mobile      dependencies     zod                                spec=4.6.5       declared=4.6.5      installed=4.6.5 @node_modules/zod [exact]
OK   apps/mobile      dependencies     @hookform/resolvers                spec=5.9.1       declared=5.9.1      installed=5.9.1 @apps/mobile/node_modules/@hookform/resolvers [exact]
OK   apps/mobile      dependencies     @dems/shared                       spec=*           declared=*          installed=0.1.0 @node_modules/@dems/shared [internal]
OK   apps/mobile      devDependencies  typescript                         spec=6.0.3       declared=6.0.3      installed=6.0.3 @node_modules/typescript [exact]
OK   apps/mobile      devDependencies  @types/react                       spec=19.2.18     declared=19.2.18    installed=19.2.18 @node_modules/@types/react [exact]
OK   apps/mobile      devDependencies  jest-expo                          spec=~57.0.5     declared=~57.0.5    installed=57.0.5 @node_modules/jest-expo [tilde]
OK   apps/mobile      devDependencies  jest                               spec=29.7.0      declared=29.7.0     installed=29.7.0 @node_modules/jest [exact]
OK   apps/mobile      devDependencies  @testing-library/react-native      spec=13.3.3      declared=13.3.3     installed=13.3.3 @node_modules/@testing-library/react-native [exact]
OK   apps/mobile      devDependencies  react-test-renderer                spec=19.2.3      declared=19.2.3     installed=19.2.3 @node_modules/react-test-renderer [exact]
OK   apps/mobile      devDependencies  eslint                             spec=9.39.5      declared=9.39.5     installed=9.39.5 @node_modules/eslint [exact]
OK   apps/mobile      devDependencies  eslint-config-expo                 spec=57.0.2      declared=57.0.2     installed=57.0.2 @node_modules/eslint-config-expo [exact]
OK   apps/mobile      devDependencies  expo-doctor                        spec=1.20.4      declared=1.20.4     installed=1.20.4 @node_modules/expo-doctor [exact]
EXTRA-APPROVED apps/mobile dependencies expo-local-authentication=~57.0.3 installed=57.0.3 [R-1 ~ (D30)]
EXTRA-APPROVED apps/mobile dependencies i18next=26.4.2 installed=26.4.2 [26.4.2 (D30, D41a)]
EXTRA-APPROVED apps/mobile dependencies react-i18next=17.0.15 installed=17.0.15 [17.0.15 (D30, D41a)]
EXTRA-APPROVED apps/mobile dependencies zustand=5.0.15 installed=5.0.15 [5.0.15 (D30)]
OK   must-be-absent (direct, apps/mobile) expo-updates: absent
OK   must-be-absent (direct, apps/mobile) expo-dev-client: absent
OK   must-be-absent (direct, apps/mobile) eas-cli: absent
OK   must-be-absent (direct, apps/mobile) moti: absent
OK   must-be-absent (direct, apps/mobile) nativewind: absent
OK   must-be-absent (direct, apps/mobile) @react-navigation/native: absent
OK   must-be-absent react-native-gesture-handler@3.x: installed 2.32.0

SUMMARY spec_rows=112 failures=0
```

</details>

Rows that need a comment:

| Item | Declared | Installed | Ruling |
|---|---|---|---|
| `react-native-web` | `~0.21.0` | 0.21.3 | In range (R-1) |
| `react-native-screens` | `~4.26.0` | 4.26.2 | In range (R-1) |
| `expo-local-authentication` (mobile) | `~57.0.3` | 57.0.3 | Extra; approved by D30 (R-1) |
| `zustand` (mobile) | `5.0.15` | 5.0.15 | Extra; approved by D30. The same pin is due for shared and core-web in step 27, and one hoisted copy results |
| `i18next`, `react-i18next` (mobile) | `26.4.2`, `17.0.15` | same | Extras; approved by D30 and ruled "keep" by D41 (a) |
| `@hookform/resolvers` (core-web, mobile) | `5.9.1` each | 5.9.1 in `apps/core-web/node_modules` and in `apps/mobile/node_modules`, none at root | Pin correct; not hoisted (informational, F-3) |

### Check 2: AC-13 (PASS, CAUTION on command wording)

AC-13 verbatim:

```
$ npm ls react react-dom --all | grep -oE 'react(-dom)?@[0-9.]+' | sort -u
react-dom@19.2.3
react@1.49.0
react@16.3.3
react@19.2.3
react@3.2.6
$ test ! -d apps/mobile/node_modules/react && test ! -d apps/core-web/node_modules/react
exit=0
```

The three extra tokens are not React. The regex has no left boundary, so it matches the tail of other package names:

```
$ npm ls react react-dom --all | grep -oE '[@a-z/.-]*react(-dom)?@[0-9.]+' | grep -vE '^(react|react-dom)@' | sort -u
@heroui/react@3.2.6
@testing-library/react@16.3.3
lucide-react@1.49.0
```

The same listing with a left boundary (a space, as npm prints `+-- react@…`) gives:

```
$ npm ls react react-dom --all | grep -oE "(^| )react(-dom)?@[0-9.]+" | sed "s/^ //" | sort | uniq -c
  45 react-dom@19.2.3
 114 react@19.2.3
$ npm ls react react-dom --all | grep -cE 'invalid|missing|extraneous|UNMET'
0
```

Resolved nodes and physical copies on disk (the SD-04 RA-1, RA-3 and RA-6 intent):

```
$ npm query '#react, #react-dom'   (name, version, location)
react 19.2.3 node_modules/react
react-dom 19.2.3 node_modules/react-dom
$ find . -path ./docs -prune -o -path ./.cache -prune -o \( -path '*/node_modules/react/package.json' -o -path '*/node_modules/react-dom/package.json' -o -path '*/node_modules/react-test-renderer/package.json' \) -print   (with version)
19.2.3 ./node_modules/react-test-renderer/package.json
19.2.3 ./node_modules/react-dom/package.json
19.2.3 ./node_modules/react/package.json
$ setopt nullglob; n=(apps/*/node_modules/react apps/*/node_modules/react-dom packages/*/node_modules/react packages/*/node_modules/react-dom); echo "count=${#n}"
count=0
```

**Result.**
- The invariant (one React and one React DOM per runtime, 19.2.3) **holds**.
- The literal AC-13 command cannot print "only react-dom@19.2.3 and react@19.2.3" while core-web depends on `@heroui/react`, `lucide-react` or `@testing-library/react`. The row 17 log already noted this (`implementation/04_core_web_app.md` L60).
- It is a spec wording defect (F-1), not a dependency defect.

### Check 3: AC-14 (PASS, CAUTION on command wording)

AC-14 verbatim:

```
$ npm ls react-native --all | grep -oE 'react-native@[0-9.]+' | sort -u
react-native@0.86.3
react-native@1.49.0
react-native@13.3.3
$ npm ls typescript --all | grep -oE 'typescript@[0-9.]+' | sort -u
typescript@6.0.3
```

Where the extra react-native tokens come from:

```
$ npm ls react-native --all | grep -oE '[@a-z/.-]*react-native@[0-9.]+' | sort | uniq -c
   1 @testing-library/react-native@13.3.3
   1 lucide-react-native@1.49.0
  45 react-native@0.86.3
$ npm query '#react-native, #typescript'
react-native 0.86.3 node_modules/react-native
typescript 6.0.3 node_modules/typescript
```

RA-4 (react-native only in `apps/mobile`):

```
$ grep -nE '"react-native(-web)?"' package.json apps/core-web/package.json apps/mock-core/package.json packages/shared/package.json
grep exit=1 (1 = none)
```

**Result.**
- `typescript` passes literally.
- `react-native` passes in intent: one resolved node, 0.86.3.
- The literal grep has the same boundary defect as AC-13 (F-1).

### Check 4: AC-15 (PASS)

```
$ grep -l '"workspace:' package.json apps/*/package.json packages/*/package.json
exit=1
--- files globbed:
apps/core-web/package.json
apps/mobile/package.json
apps/mock-core/package.json
package.json
packages/shared/package.json
```

No output, exit 1: the pass condition exactly. All five manifests were in the glob.

### Check 5: AC-17 (PASS)

```
$ grep -cE 'BorderBeam|SlidingNumber' THIRD_PARTY_NOTICES.md
2
exit=0
$ grep -rn "shadcn" apps/core-web/package.json apps/core-web/components.json 2>/dev/null
exit=2 (1 = no match in readable files; 2 = a named file is absent)
--- components.json present?
absent
--- matching lines in notices:
7:| BorderBeam | Magic UI | MIT | `https://magicui.design/r/border-beam.json` | 2026-10-01 | `apps/core-web/src/components/ui/border-beam.tsx` |
8:| SlidingNumber | Motion Primitives | MIT | `https://motion-primitives.com/c/sliding-number.json` | 2026-10-01 | `apps/core-web/src/components/ui/sliding-number.tsx` (one local change: `as const` on `TRANSITION` for TypeScript 6 literal typing) |
--- wider shadcn sweep (package.json files and lockfile, informational):
$ grep -l "shadcn" package.json apps/*/package.json packages/*/package.json
exit=1
$ grep -c '"node_modules/shadcn' package-lock.json
0
```

The count is `2` (at least 2 is required). The shadcn grep prints nothing: `components.json` does not exist, because `shadcn init` was never run (row 17 log L15).

### Check 6: AC-46 (PASS)

```
$ git check-ignore -q "DEMS_Edge_Client_Engineering_Design_Book_v0.2_DOWNLOAD(2).docx" && git check-ignore -q apps/mobile/android && git check-ignore -q .cache
exit=0
$ git check-ignore -v "DEMS_Edge_Client_Engineering_Design_Book_v0.2_DOWNLOAD(2).docx" apps/mobile/android .cache
.gitignore:9:*.docx	DEMS_Edge_Client_Engineering_Design_Book_v0.2_DOWNLOAD(2).docx
apps/mobile/.gitignore:43:/android	apps/mobile/android
.gitignore:44:.cache/	.cache
```

`apps/mobile/android` is also covered by the root rule `apps/mobile/android/` (root `.gitignore` line 25, S-6 below). Either rule alone ignores it.

### Check 7: AC-18 in pre-commit form, the S-1 no-drift test (PASS)

**Why the pre-commit form.**
- The literal AC-18 (`npm run build -w @dems/shared && git diff --exit-code packages/shared/theme/`) needs a commit to diff against, and none exists yet (step 25 makes it).
- It also writes the theme files (`gen-theme.ts` `main()`), which a read-only gate must not do.
- S-1 (`packages/shared/test/theme.test.ts`) imports `generateTheme()` and compares its output in memory with the files on disk.
- The generator's `main()` runs only when `gen-theme.ts` is argv[1] (`scripts/gen-theme.ts` L173–L175), so importing it writes nothing.

```
--- sha256 + mtime BEFORE
b94ce8d486b03135b9e09b356bd273733251e10673c0f84d8f92fa15a64219b3  packages/shared/theme/heroui-native.css
12edb0c683b1266240b29773cf1a9dcb38eb0cd90fa3b09a35b6225dba0fdab7  packages/shared/theme/heroui-web.css
01:41:57 packages/shared/theme/heroui-native.css
01:41:57 packages/shared/theme/heroui-web.css

$ npm test -w @dems/shared -- test/theme.test.ts --maxWorkers=2 --reporter=verbose
> @dems/shared@0.1.0 test
> vitest run test/theme.test.ts --maxWorkers=2 --reporter=verbose
 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/packages/shared
 ✓ test/theme.test.ts > generateTheme() > web theme declares every palette variable and --radius 1ms
 ✓ test/theme.test.ts > generateTheme() > native theme declares every palette variable and --radius 0ms
 ✓ test/theme.test.ts > generateTheme() > web theme targets the HeroUI dark selectors 0ms
 ✓ test/theme.test.ts > generateTheme() > native theme defines both Uniwind variants with the vendor font variables 0ms
 ✓ test/theme.test.ts > generateTheme() > committed theme files equal the generator output (no drift) 0ms
 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  01:55:28
   Duration  66ms (transform 65%, import 23%, tests 7%, worker 6%)
exit=0

--- independent check: generateTheme() in memory vs files on disk (cd packages/shared && node --import tsx s1_drift.mts)
web: generated 3111 B, on disk 3111 B, equal=true
native: generated 4542 B, on disk 4542 B, equal=true
exit=0

--- sha256 + mtime AFTER
b94ce8d486b03135b9e09b356bd273733251e10673c0f84d8f92fa15a64219b3  packages/shared/theme/heroui-native.css
12edb0c683b1266240b29773cf1a9dcb38eb0cd90fa3b09a35b6225dba0fdab7  packages/shared/theme/heroui-web.css
01:41:57 packages/shared/theme/heroui-native.css
01:41:57 packages/shared/theme/heroui-web.css
```

(An earlier non-verbose run at 01:55:20 also printed `Tests 5 passed (5)`, exit 0.)

- The sizes 3,111 B and 4,542 B match the rev-3 regeneration recorded in `implementation/02_shared_package.md` L156.
- **Carry-forward**: once step 25 has committed, the literal AC-18 applies and step 61 runs it as written.

## 3. Supplementary invariants (requested by the controller)

| # | Check | Result |
|---|---|---|
| S-1 | Root `overrides` equal 01_specs §1.2 exactly; `react-is` absent (SPEC-C2) | **PASS** |
| S-2 | Root scripts equal §1.2 with the D23 AVD names | **PASS with a recorded deviation**: 13/14 identical. `probe:ws` has a trailing `--` (S16-1 in `implementation/03_mock_core_service.md` L155, so AC-39's arguments reach the probe). There are no extra scripts |
| S-3 | `allowScripts` limited to `@shopify/react-native-skia@2.6.2` (D41 e) | **PASS** |
| S-4 | `.npmrc` = `save-exact=true`, with no auth or token line; `.node-version` = `26.8.2` | **PASS** |
| S-5 | AC-27, static part: no `eas.json`; no expo-updates, expo-dev-client or eas-cli; no projectId, owner, updates or runtimeVersion | **PASS**: `test` exit 0; `0`; `0`. There is no `eas.json` anywhere outside `node_modules` |
| S-6 | `.gitignore` covers every §1.8 line and every step-25 exclusion | **PASS**. The root `.gitignore` sha256 is unchanged since row 14. `.locks/` is not ignored yet; that is expected, and step 25 appends it (D35) |
| S-7 | No secrets among the files the baseline would stage | **PASS**: 172 candidate files, 0 hits; the positive control fires; 0 read errors |
| S-8 | Context-bearing libraries have a single copy per runtime | **PASS**. `scheduler` has a second copy under Skia's `react-reconciler`, which is informational (F-4) |
| S-9 | Must-be-absent list (§1.4 mobile) | **PASS** (in the AC-12 comparator) |

```
$ node -e '<compare root overrides with §1.2>'
exact match: true | react-is absent from overrides (SPEC-C2): true
exit=0
$ node -e '<compare root scripts with §1.2>'
DIFF probe:ws "npm run probe:ws -w @dems/mock-core --"
spec scripts: 14 diffs: 1
$ node -e 'console.log("root script count:",Object.keys(require("./package.json").scripts).length)'
root script count: 14
$ node -e '<print selected root keys as JSON>'   (allowScripts excerpt)
 "allowScripts": {
  "@shopify/react-native-skia@2.6.2": true
 }
$ printf '[%s]\n' "$(cat .npmrc)"; printf '[%s]\n' "$(cat .node-version)"; grep -ciE '_auth|token|password' .npmrc
[save-exact=true]
[26.8.2]
0
```

```
$ test ! -e apps/mobile/eas.json; grep -cE '"(expo-updates|expo-dev-client|eas-cli)"' apps/mobile/package.json; grep -cE 'projectId|"owner"|"updates"|runtimeVersion' apps/mobile/app.json
test exit=0
0
0
$ find . -name eas.json -not -path '*/node_modules/*' -not -path './.cache/*'
(no output)
```

`.gitignore` coverage (exit 0 means ignored; the matching rule comes from `git check-ignore -v`). The block collates three runs of `for p in …; do git check-ignore -q "$p"; … git check-ignore -v "$p"; done` plus one `git check-ignore -v apps/mobile/expo-env.d.ts`. Column alignment is normalised, and the §1.8 line check (`grep -nxF -- "<line>" .gitignore`, one per line) is condensed to one line:

```
DEMS_Edge_Client_Engineering_Design_Book_v0.2_DOWNLOAD(2).docx     exit=0  .gitignore:9:*.docx
node_modules                                                       exit=0  .gitignore:12:node_modules/
apps/mobile/node_modules                                           exit=0  apps/mobile/.gitignore:4:node_modules/
apps/core-web/node_modules                                         exit=0  apps/core-web/.gitignore:10:node_modules
.cache                                                             exit=0  .gitignore:44:.cache/
apps/mobile/android                                                exit=0  apps/mobile/.gitignore:43:/android
apps/mobile/ios                                                    exit=0  apps/mobile/.gitignore:42:/ios
apps/mobile/.expo                                                  exit=0  apps/mobile/.gitignore:7:.expo/
apps/core-web/dist                                                 exit=0  apps/core-web/.gitignore:11:dist
graft                                                              exit=0  .gitignore:2:/graft/
.env                                                               exit=0  .gitignore:37:.env
apps/mobile/.env.local                                             exit=0  apps/mobile/.gitignore:34:.env*.local
x.keystore                                                         exit=0  .gitignore:31:*.keystore
x.jks                                                              exit=0  .gitignore:32:*.jks
x.tsbuildinfo                                                      exit=0  .gitignore:18:*.tsbuildinfo
apps/mock-core/logs/errors.log                                     exit=0  .gitignore:45:*.log
coverage/x                                                         exit=0  .gitignore:42:coverage/
apps/core-web/coverage/x                                           exit=0  .gitignore:42:coverage/
apps/mobile/expo-env.d.ts                                          exit=0  apps/mobile/.gitignore:10:expo-env.d.ts
.locks/x                                                           exit=1  (not ignored yet; step 25 appends .locks/, D35)
--- root .gitignore §1.8 lines
.cache/ 44 | apps/mobile/android/ 25 | apps/mobile/ios/ 26 | *.tsbuildinfo 18 | coverage/ 42
$ shasum -a 256 .gitignore
666eea5735b633e41393c6e79ba6eacd3e9cfa3809ed2090b7d65fdd6ca399e9  .gitignore   (row 14 recorded the same hash)
```

The bare `coverage` probe exits 1 only because the dir-only pattern `coverage/` cannot match a path that does not exist. The `coverage/x` probes above show the rule works. `mock-core`'s S16-4 error log (`apps/mock-core/logs/errors.log`) is ignored by `*.log`.

Baseline candidates and the secrets scan. This block is condensed: `sort | uniq -c` printed the per-area counts one per line, and each scan ran as `tr '\n' '\0' < cand.txt | xargs -0 grep -nIE '<pattern>'`:

```
$ GIT_OPTIONAL_LOCKS=0 git status --porcelain --untracked-files=all   (at 01:56 WIB)
candidate files: 172
   1 .gitignore | 1 .ignore | 3 .locks/ | 1 .node-version | 1 .npmrc | 1 THIRD_PARTY_NOTICES.md
  24 apps/core-web | 39 apps/mobile (+1 quoted path, below) | 11 apps/mock-core | 29 packages/shared
  52 docs/ | 1 package-lock.json | 1 package.json | 1 tsconfig.base.json | 5 ui_design/
--- step-25 forbidden patterns among candidates (.docx, node_modules, .cache, apps/mobile/android, graft/, .env, keystore/jks, .log, tsbuildinfo, .expo, dist, p12, pem, key):
grep exit=1 (1 = none)
--- high-confidence credential patterns (private-key blocks, AKIA/ASIA, gh*_ / github_pat_, sk-, sk-ant-, xox*-, AIza, npm_, _authToken, EXPO_TOKEN=, glpat-):
grep exit=1 (1 = none)
--- generic key/secret/password/token = "12+ char literal", code and config:
grep exit=1 (1 = none)
--- same, docs/:
grep exit=1 (1 = none)
--- env / credential-like filenames:
grep exit=1 (1 = none)
--- positive control (planted fake AKIA… and api_key = "…" in $TMPDIR): both matched
--- read errors across the 172 files: 0
```

Single-copy check for context-bearing libraries:

```
$ npm query '#react-hook-form, #@tanstack/react-query, #zustand, #i18next, #react-i18next, #react-native-reanimated, #react-native-worklets, #react-native-safe-area-context, #react-native-screens, #react-native-gesture-handler, #@shopify/react-native-skia, #expo, #react-test-renderer, #scheduler'
single  @shopify/react-native-skia  2.6.2 @node_modules/@shopify/react-native-skia
single  @tanstack/react-query  5.104.0 @node_modules/@tanstack/react-query
single  expo  57.0.26 @node_modules/expo
single  i18next  26.4.2 @node_modules/i18next
single  react-hook-form  7.89.0 @node_modules/react-hook-form
single  react-i18next  17.0.15 @node_modules/react-i18next
single  react-native-gesture-handler  2.32.0 @node_modules/react-native-gesture-handler
single  react-native-reanimated  4.5.1 @node_modules/react-native-reanimated
single  react-native-safe-area-context  5.7.0 @node_modules/react-native-safe-area-context
single  react-native-screens  4.26.2 @node_modules/react-native-screens
single  react-native-worklets  0.10.1 @node_modules/react-native-worklets
MULTI   scheduler  0.25.0 @node_modules/react-reconciler/node_modules/scheduler | 0.27.0 @node_modules/scheduler
single  react-test-renderer  19.2.3 @node_modules/react-test-renderer
single  zustand  5.0.15 @node_modules/zustand
$ npm explain react-reconciler | head -12
react-reconciler@0.31.0
node_modules/react-reconciler
  react-reconciler@"0.31.0" from @shopify/react-native-skia@2.6.2
  node_modules/@shopify/react-native-skia
    peer @shopify/react-native-skia@">=2.6.0 <3.0.0" from victory-native@42.0.1
    node_modules/victory-native
      victory-native@"42.0.1" from @dems/mobile@0.1.0
      apps/mobile
        @dems/mobile@0.1.0
        node_modules/@dems/mobile
          workspace apps/mobile from the root project
    @shopify/react-native-skia@"2.6.2" from @dems/mobile@0.1.0
$ node -p 'const p=require("./node_modules/react-reconciler/package.json");p.name+"@"+p.version+" peer react: "+JSON.stringify(p.peerDependencies)+" deps: "+JSON.stringify(p.dependencies)'
react-reconciler@0.31.0 peer react: {"react":"^19.0.0"} deps: {"scheduler":"^0.25.0"}
```

## 4. Findings

| ID | Severity | Finding | Owner / routing | Expected correction |
|---|---|---|---|---|
| F-1 | CAUTION (spec wording) | The greps in AC-13 (`react(-dom)?@`) and AC-14 (`react-native@`) have no left boundary. They also match `lucide-react@`, `@heroui/react@`, `@testing-library/react@`, `lucide-react-native@` and `@testing-library/react-native@`, so their literal output can never meet the pass condition while those dependencies exist. The invariant itself holds | Controller: a wording ruling like D29, not rows 14–18. It affects every later consumer of AC-13 and AC-14: step 27's verification cell ("AC-13 still prints only react@19.2.3 and react-dom@19.2.3"), step 67 and step 61 | Use a boundary: `npm ls react react-dom --all \| grep -oE '(^\| )react(-dom)?@[0-9.]+' \| sed 's/^ //' \| sort -u` and `npm ls react-native --all \| grep -oE '(^\| )react-native@[0-9.]+' \| sed 's/^ //' \| sort -u`. Or use `npm query '#react, #react-dom'` / `'#react-native'` (one node each) |
| F-2 | Info (step 25 precondition) | `.locks/` exists and is not ignored yet. At 01:56 it held `mock-core.lock`, `mock-core.pid` and `mock-core.users/step-19`; `dems_phone`/`dems_tablet` `.lock`/`.pid` files appeared later. All were created by step 19 | Step 25 (already in its task text, D35) | Append `.locks/` to `.gitignore` before staging, then `git check-ignore -q .locks/x` |
| F-3 | Info | `@hookform/resolvers@5.9.1` is installed twice, in `apps/core-web/node_modules` and `apps/mobile/node_modules`; there is no root copy. The version is the same, it is not a React copy, and its peer `react-hook-form` is single (7.89.0) | None needed. Step 27's install may hoist it | None |
| F-4 | Info | `scheduler@0.25.0` is nested under `react-reconciler@0.31.0`, which `@shopify/react-native-skia@2.6.2` pins exactly for its canvas renderer. The peer `react ^19.0.0` accepts 19.2.3. React DOM uses `scheduler@0.27.0`. This is not a second React; row 18 rendered Skia on both AVDs | None | None |
| F-5 | Low (doc) | `implementation/01_workspace_root.md` says "16 root scripts"; the root has 14, matching §1.2's 14 keys | Row 14 log (text only) | Change "16" to "14" when convenient |
| F-6 | Info | The template file `apps/mobile/assets/expo.icon/Assets/expo-symbol 2.svg` has a space in its name. Its mtime 1985-10-26 is the npm tarball default, so it comes from `expo-template-default@57.0.28`, not a local duplicate. Git quotes it in porcelain output | Step 25 (awareness only) | None |
| F-7 | Info | The baseline would include 5 `ui_design/*.png` files of 1.7–2.1 MB each (about 9.5 MB), per D41 (h) | Step 25 (awareness only) | None |

No FAIL, so nothing routes to rows 14, 15, 17 or 18.

## 5. Rollback

Nothing to roll back: the gate changed no tracked or trackable file. To remove the one cache write: `rm -rf packages/shared/node_modules/.vite/vitest` (git-ignored; optional).

---
*Generated: 2026-10-01 01:59 WIB*
