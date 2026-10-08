# security-review — row 24 (B2 dependency-diff review, M0, class A, tier 2)

Status: DONE — verdict **PASS**. Date: 2026-10-07T14:30Z. Session: security-review subagent (row 24 delegation).

Deliverable: `docs/2026-10-07_dems_real_capture_sealing/gateway_check/01_b2_dependency_review.md`

Reviews: `implementation/08_b2_dependency_refresh.md` (row 23). Baseline: `research/05_b2_dependency_triage.md` (row 5). Controller record: `decisions/decisions.md` D14(a). Baseline HEAD: `2a4f4ea`.

## Gate results (Verification column, row 24)

| Gate | Requirement | Measured | Verdict |
|---|---|---|---|
| Verdict | PASS/CAUTION/FAIL | PASS | PASS |
| Diff scope | scoped override + matching lock entry only | `git diff --stat` = package.json +5/-1, package-lock.json +3/-3; whole-lock compare: 1 changed, 0 downgrades, 0 added, 0 removed | PASS |
| Every changed direct dependency, advisory closed or reason kept | list | `undici` 7.29.0 -> 7.29.1 (transitive override edge) = advisory closed; none kept | PASS |
| Advisory closure | re-run audit; classify every high | lock 53 high / omit-dev 50 (row 23 recorded 49/46) = live advisory-DB drift; `undici` absent; roots only braces + node-forge | PASS |
| Disposition counts | (i)/(ii)/(iii)/(iv) | 1 cleared / 2 accepted-risk / 51 propagation / 0 unexpected | PASS |
| Downgrade ban | 0 downgrades; 15 named traps absent | whole-lock compare 0 downgrades; named-trap grep empty | PASS |
| New install scripts count | delta stated | 17 -> 17 (delta 0); `allowScripts` 2 keys byte-unchanged | PASS |
| Override sanity | `npm ls undici`, no invalid/extraneous | 7.29.1 overridden under json-magic, jsdom 8.11.2 unaffected; depth-0 no invalid/extraneous (exit 0) | PASS |
| Integrity | typecheck + lint exit 0 | re-ran both: exit 0 | PASS |
| No edits outside the two output files | contract | honoured | PASS |

## Verdict rationale

- Scope: exactly the two allowed files; the only lock movement in the tree is `undici 7.29.0 -> 7.29.1`.
- Advisory closure: the targeted high (`undici`, 2 high CVEs + 8 lower) is cleared; the residual is confined to two no-fix root causes (braces GHSA-vfj7-8cjw-p6xm, node-forge GHSA-86w9-cpqp-85rv), both accepted-risk, dev/build/test-only, class A = 0.
- No downgrade, no advisory-class regression, no scope creep, no newly allowed install scripts.

## Live drift observation (R24-01, Low, no code action)

My read-only re-run of `npm audit` at 14:2xZ reads 53 high (lock) / 50 (`--omit=dev`), versus row 23's in-window 49 / 46. This equals row 5's baseline 54 minus the one durably-cleared `undici` entry, so 53 is the durable expected post-state and row 23's 49 was a transient low from the live advisory DB (row 5 assumption A-R5-1). It remains within the `<= 53` gate and no new root cause appeared. Downstream gates (27, 39) should re-record the current view rather than quoting "49" as durable.

## Findings routed to row 23

| ID | Severity | What | Action |
|---|---|---|---|
| R24-01 | Low (observation) | Audit count drift 49 -> 53 between row 23's run and this review; external registry drift, still within gate | None; documentation note only |
| — | — | No scope creep, downgrade, advisory-class regression, secret exposure, or permission/`allowScripts` change | none |

## Red lines and constraints honoured

No edit to `package.json`, the lockfile, or any source/test file (only the two contract docs written); no installs, no `npm audit fix`, no `npm update`; network limited to read-only `npm audit` / `npm ls` / `npm view` registry metadata (package names only, anonymous); no emulators; no controller docs touched; no secrets printed. English, no emoji, tables over prose, every claim carries command output.
