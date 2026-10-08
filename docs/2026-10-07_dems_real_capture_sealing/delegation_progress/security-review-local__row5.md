---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 5
agent: security-review-local
class: A
milestone: M0
tier: 2
status: done
date: 2026-10-07
artifact: docs/2026-10-07_dems_real_capture_sealing/research/05_b2_dependency_triage.md
baseline_head: 2a4f4ea063d1a7c72d3fb70d4951fa63029e57a8
---

# Row 5 progress — B2 dependency triage (analysis only)

## Status

DONE. Analysis-only contract honoured: no dependency, manifest or lockfile change; no `npm audit fix`, `npm install`, `npm update`; `git diff --stat package-lock.json` empty and `node_modules` untouched (mtimes still 2026-10-04T00:31:45Z).

## Acceptance criteria check (row 5 Verification column)

| Criterion | Result | Evidence |
|---|---|---|
| Advisory rows = `npm audit --json` high total (99 expected, delta explained) | MET with corrected baseline | 54 rows delivered = today's measured high total; delta vs 99 explained in artifact section 3 with five evidence lines (lockfile unchanged since `b90a3c6`, identical full-vs-omit-dev delta of 3, lock-graph vs installed-graph gap of 4 in the same repo, six alternative metrics none of which reproduces 99/96, live advisory DB) |
| Each row has path class plus action | MET | Artifact section 4, 54 rows, class A/B/C/D plus per-row action; class totals A 0 / B 9 / C 45 / D 0 |
| `git diff --stat package-lock.json` empty | MET | Quoted before and after in artifact section 9 |
| Target versions proposed incl. `undici` >= 7.29.1 | MET | Section 6: undici -> 7.29.1 via root `overrides`; fallback via `@scalar/api-reference-react` 0.9.78 (`@scalar/json-magic` 0.15.5 already pins 7.29.1 upstream) |
| No `npm audit fix` | MET | Commands listed in artifact section 13; only audit/view/read-only runs |

## Numbers the controller needs

| Item | Value |
|---|---|
| High found vs expected | 54 (lock graph) / 51 (`--omit=dev`) / 50 (installed graph) vs 99/96 expected |
| Distinct GHSA ids behind all highs | 12 (undici 10 incl. 2 high, braces 1, node-forge 1) |
| Real root causes at high | 3 libraries: `undici` 7.29.0, `braces` 3.0.3, `node-forge` 1.4.0; 51 of 54 high entries are graph propagation |
| Proposals by class | safe bump with no manifest edit: 0; needs manifest edit: 1 (undici override); blocked, no published fix: 2 (braces GHSA-vfj7-8cjw-p6xm, node-forge GHSA-86w9-cpqp-85rv); no action / propagation only: 51, of which 15 carry an npm `fixAvailable` that is a downgrade and must be rejected |
| Advisories reaching the Core | 0 — `apps/core-server` production closure (129 nodes) has zero flagged entries at any severity; mock-core closure clean incl. dev; `release/` has no package.json and is outside the audit graph |
| Post-fix target for row 23 | high = 53 (lock view), 50 (`--omit=dev`), 49 (installed view); hard check `npm ls undici` >= 7.29.1 |
| Install-script exposure | 17 script-bearing packages; `allowScripts` allows exactly 2, both version-pinned; 1 high-flagged script package (skia, propagation only), 1 moderate (nested esbuild, not allowed); no advisory originates from an install script |

## Issues & decisions log (for the controller to fold into shared trackers)

| ID | Note | Suggested route |
|---|---|---|
| R5-N1 | The blueprint's "99 high" is not reproducible on the current lockfile (last changed `b90a3c6`). Use 54/51 as the row-23 baseline and 53/50 as its "<= target" number, always stating which audit view was used. | update row 5/23 expectations in masterplan when written |
| R5-N2 | Two high root causes have no published fix at all (braces latest 3.0.3, node-forge latest 1.4.0). Any expectation that B2 drives the high count near zero is unachievable without upstream releases; both are dev/build-only (class C) and outside the Core boundary. Recommend recording them as accepted risks with reasons in `decisions/decisions.md`, keeping `npm audit` enabled rather than suppressed. | user-visible decision at the M0 gate (no new approval needed for row 5 itself) |
| R5-N3 | npm's `fixAvailable` for 15 high entries names downgrades (expo 44.0.6, react-native-reanimated 4.2.2, skia 1.12.4, worklets 0.7.4, victory-native 41.26.0). A blind `npm audit fix --force` would break mobile builds and also revoke two exact-version `allowScripts` keys. | carry as a red line into rows 23 and 24 |
| R5-N4 | jest 29 -> 30 / jest-expo 57 -> 58 would be test-strategy modernisation, not advisory closure (jest itself has no advisory). Out of B2 scope; belongs to row 36. | row 36 test strategy |
| R5-N5 | `undici` 7.29.0 has two declaration points: `@scalar/api-reference-react` 0.9.76 (core-web production) and `@scalar/openapi-parser` 0.29.9 (packages/shared dev). One physical nested copy, so one root override clears both. | row 23 step 3 |
| R5-N6 | `masterplan/02_plan.md` did not exist when this row ran (`masterplan/` empty), so the plan tracking table could not be updated; and this row's Documentation Contract forbids touching `status_tasks.md` / `decisions.md`. Recorded here instead. | controller folds status into shared trackers |
| R5-N7 | Baseline working tree was already dirty with two controller-owned docs (`decisions/decisions.md`, `status_tasks.md`). Reported, not touched. Zero dirty files originated from this row. | controller owns those trackers |
| R5-N8 | Vitest 5.0.3 workspaces (shared, core-server, core-web, mock-core) do not expose `--maxWorkers` in their CLI surface; the flag is honoured by jest (mobile). Row 23/27 commands must verify or substitute `--poolOptions.threads.maxThreads=2` so throttled execution is not falsely reported. | rows 23, 27 and row 36 command list |

## Verification of this row's own claims

- Closure/intersection numbers derived directly from `package-lock.json` (`packages` map, workspace links resolved), not from `node_modules`.
- Propagation clusters computed from `via` references in `npm audit --json`; cluster sizes (22 + 26 + 1 + 2 + 2 + 1) sum to the reported 54.
- Registry targets verified with `npm view`: undici 7.29.1 and 7.30.0 exist; braces latest 3.0.3; node-forge latest 1.4.0; `@scalar/json-magic@latest` dependencies pin `undici: 7.29.1`.
- Browser-bundle claim evidenced by grep of the last local build output for undici implementation symbols (absent) and by the `@scalar/json-magic` export map (undici reachable only through the Node plugin).
- No secret, token or credential value appears anywhere in the artifact; only package names, versions, GHSA ids and advisory titles.
