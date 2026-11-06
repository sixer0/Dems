# coder-execution — row 23 (B2 dependency refresh, M0, class A, tier 3)

Status: DONE — targeted refresh applied as the single lockfile writer, all gates pass. Date: 2026-10-07. Session: coder-execution subagent (row 23 delegation).

Deliverable: `docs/2026-10-07_dems_real_capture_sealing/implementation/08_b2_dependency_refresh.md`

Depends on: row 5 (triage, gated; its section 10 action list is this row's instruction set), row 22 (done, gated); serialised away from rows 16-22 (their tree edits carried, untouched) and ahead of rows 24-27.

## Gate results (Verification column, row 23)

| Gate | Requirement | Measured | Verdict |
|---|---|---|---|
| `npm audit` high after <= row 5 target | <= 53 | 49 lock view / 46 lock omit-dev / 49 installed | PASS |
| `npm ls undici` >= 7.29.1 | all copies | `undici@7.29.1 overridden` + `8.11.2` (jsdom, unchanged) | PASS |
| root `npm run typecheck` | exit 0 | exit 0, 5/5 workspaces | PASS |
| root `npm run lint` | exit 0 | exit 0, 5/5 workspaces | PASS |
| diff scope | override + lock resolution only | package.json +5/-1 (overrides block, 1 scoped entry); package-lock.json +3/-3 (undici version/resolved/integrity) | PASS |
| allowScripts integrity | both pinned keys match installed, scripts not revoked | `@shopify/react-native-skia@2.6.2` and `@embedded-postgres/darwin-arm64@18.4.0-beta.17` byte-unchanged in manifest AND installed; native build trees present; 0 newly allowed scripts | PASS |
| no tests run in this row | none | 0 test commands (row 27 owns the wave) | PASS |

## What changed

- Root `package.json` `overrides`: added one parent-scoped entry `"@scalar/json-magic": { "undici": "7.29.1" }`; the five react pins byte-identical. `package-lock.json`: the single physical vulnerable copy `node_modules/@scalar/json-magic/node_modules/undici` moved 7.29.0 -> 7.29.1 (registry integrity `sha512-RYON…zu6Q==` accepted and reified by `npm install`, exit 0). Nothing else moved anywhere in the tree.
- High-entry attribution: the ONLY high advisory entry cleared by the change is `undici` itself (before/after high-set diff), exactly as row 5 predicted. The extra 54->49 movement (moderate 30->20, two `@scalar` re-grades moderate->low) is live-advisory-DB drift inside the run window (row 5 A-R5-1), recorded view-for-view in the report.

## Three deviations from row 5's step list — all forced by observed npm 11.19.1 behaviour, all evidenced in report section 4

1. Override SHAPE: the literal global `"undici": "7.29.1"` was applied first and proven inert by six dry-run/write probes (new override keys are silently dropped against an existing complete lockfile; existing-key value changes DO apply — react 19.0.0/17.0.2 controls). The parent-scoped one-key form is the shape row 5's own step-7 post-state expects ("7.29.1 under json-magic, 8.11.2 under jsdom"); the global shape would also have force-downgraded jsdom's 8.11.2, tripping row 5's step-5 stop gate.
2. Stated FALLBACK not applied: `@scalar/api-reference-react` 0.9.78 cannot pass this row's hard gate — `packages/shared` pins `@scalar/openapi-parser@0.29.9` exact -> `json-magic@0.15.3` exact -> `undici@7.29.0` exact (all three specs verified via `npm view`), so a 7.29.0 copy would survive the bump and `npm ls undici >= 7.29.1` would fail while the whole Scalar subtree churned. Rejected on evidence, documented, not executed.
3. Lock RESOLUTION WRITE: five native re-resolve levers (lock-only, reify, `-w @dems/shared`, positional same-version install, entry prune) all failed to recreate the missing edge — npm even synced the physical tree DOWN to a pruned lock ("removed 1 package"). The row finished the resolution in the lock entry-for-entry from `npm view undici@7.29.1` registry data (version, tarball URL, dist.integrity, license, engines); `npm install` then downloaded, integrity-verified, and annotated the node `overridden` itself. Net lock bytes are what npm's resolver produces for this edge.

## Controller follow-ups routed from this row

- `decisions/decisions.md` entries owed (row 5 step 8 + this row's findings): (a) ACCEPTED RISK x2 — braces GHSA-vfj7-8cjw-p6xm, node-forge GHSA-86w9-cpqp-85rv: no published fixes, class C only, class A = 0, audit enabled, reasons in report section 10; (b) TOOLCHAIN FINDING for future bump rows (Q-INSTALL capture deps, Scalar 0.9.78 modernisation): newly added root `overrides` keys do NOT take effect against an existing complete `package-lock.json` on npm 11.19.1 — plan rows accordingly (fresh edges only); (c) baseline numbers now 54/51 (row 5) drifted to 49/46 post-fix WITH same-run audit-DB movement — row 27 and the M0 gate (row 39) should re-record the current-view baseline before comparing.
- Row 24 review scope: `package.json` (1 scoped override entry) + `package-lock.json` (undici 3 lines); confirm 0 newly allowed install scripts (already evidenced); confirm the accepted-risk register; judge deviation 3's authored-resolution path.
- Row 27: `--maxWorkers=2` all workspaces per D12c; wave runs on this post-B2 tree.

## Red lines and constraints

Single writer under `/usr/bin/lockf -k .locks/npm.lock` (BSD positional form, `-c` variant not applicable on macOS), no contention; no `npm audit fix`/`npm update`/downgrades; no dependency removal; no node/npm change; `.data/*`, `apps/mock-core/**`, `release/**`, all test files untouched; registry HTTPS only, package names only; no secrets in any artifact. Post-state `git status`: new entries are exactly `M package.json`, `M package-lock.json` + this row's two doc files; the 12 sibling test edits and controller trackers byte-identical to the baseline quote.
