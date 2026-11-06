---
task_slug: dems_backend_rbac_pairing
row: W01c (added by decision D41)
date: 2026-10-04
agent: coder-execution
tier: 3 (mechanical output, evidence is command output)
status: complete
---

# W01c - Remove the known flaky assertion (NF-1 / KI-24)

## 1. What was done

One synchronous row query on the RBAC matrix was changed to its awaiting form. One line in one test file; no other file touched.

| Item | Value |
|---|---|
| File | `apps/core-web/src/features/security-audit/__tests__/security-audit.test.tsx` |
| Test | `SecurityAuditPage` > "shows the DEMO Ed25519 certificate, the package verdicts and the three operators" |
| Line | 409 (single occurrence) |
| Failure being fixed | `Unable to find an accessible element with the role 'row'`, empty `rbac-matrix` table in the dump (NF-1 / KI-24 in `docs/2026-09-30_dems_demo_stack_setup/verification/01_verification.md`; recurred 1 in 4 runs in `implementation/16_shared_vocabulary.md` section 11) |
| Cause (as recorded, confirmed by reading the code) | `mountPage()` (lines 75-87) waits for `page-security-audit` and `panel-rbac` only. The matrix rows commit in a later pass (the comment on line 84 says the page mounts in stages), so the synchronous `getAllByRole('row')` can run before any row exists |

### Before (line 409, = `acaff20` blob)

```tsx
    expect(within(screen.getByTestId('rbac-matrix')).getAllByRole('row')).toHaveLength(10)
```

### After (line 409)

```tsx
    expect(await within(screen.getByTestId('rbac-matrix')).findAllByRole('row')).toHaveLength(10)
```

Same `within(screen.getByTestId('rbac-matrix'))` scope, same expectation (`toHaveLength(10)`). No timeout, retry or wrapper added. The enclosing `it` callback was already `async`, so no signature change.

### Other occurrences on the same table in this test file

Searched the file for `rbac-matrix`, `'row'`, `"row"`, `rowgroup`, `ByRole('grid')`. Result:

| Line | Code | Same race? | Action |
|---|---|---|---|
| 285 | `'rbac-matrix'` in the id list, checked with `getByTestId` | No. Asserts the table element exists, not its rows. The element is present from the first commit (the failure dump shows an empty `<table role="grid" data-testid="rbac-matrix">`) | Unchanged |
| 342 | `table.querySelector('[role="row"][data-seq]')` | No. Different table (`audit-table`), and it is preceded by a synchronous count assertion that has not failed | Unchanged (out of scope: not the same table) |
| 409 | `getAllByRole('row')` on `rbac-matrix` | Yes | Changed |

Only line 409 changed. The diff is exactly one line.

## 2. Pre-image and hashes

| Item | Value |
|---|---|
| Pre-image patch | `.cache/rollback/W01c.pre.patch` (0 bytes: the file was identical to `acaff20` before the edit) |
| `acaff20` blob | `f15d955d898d877098e9eccd417daf5dc5f7d03b` (`git rev-parse acaff20:apps/core-web/src/features/security-audit/__tests__/security-audit.test.tsx`) |
| Hash before my edit (`git hash-object`) | `f15d955d898d877098e9eccd417daf5dc5f7d03b` (equal to the `acaff20` blob) |
| **Reference hash after my edit (`git hash-object`)** | **`5470ce3fdcd98fd8c0926cd6afe03a1a1c1af58f`** |
| Post-image patch (convenience) | `.cache/rollback/W01c.post.patch` |

The Security & Audit page row will later own `apps/core-web/src/features/security-audit/` and must keep this line as is. The hash above is the file's reference state: if that row changes the test file for other reasons, the diff against this hash must still show line 409 as `await ... findAllByRole('row')`.

`git diff acaff20 -- <file>` after the edit:

```diff
@@ -406,7 +406,7 @@ describe('SecurityAuditPage', { timeout: 45_000 }, () => {
     const rbac = screen.getByTestId('panel-rbac')
     expect(rbac.querySelectorAll('[data-operator]')).toHaveLength(3)
     expect(rbac.querySelector('[data-operator="OPR-001"]')).toHaveAttribute('data-current', 'true')
-    expect(within(screen.getByTestId('rbac-matrix')).getAllByRole('row')).toHaveLength(10)
+    expect(await within(screen.getByTestId('rbac-matrix')).findAllByRole('row')).toHaveLength(10)
   })
```

## 3. Verification output

### 3.1 The file alone, 10 runs in a row

Command (each run): `npm run test -w @dems/core-web -- --maxWorkers=2 src/features/security-audit/__tests__/security-audit.test.tsx`

| Run | Test Files | Tests | Duration |
|---|---|---|---|
| 1 | 1 passed (1) | 18 passed (18) | 5.36s |
| 2 | 1 passed (1) | 18 passed (18) | 5.49s |
| 3 | 1 passed (1) | 18 passed (18) | 4.80s |
| 4 | 1 passed (1) | 18 passed (18) | 4.92s |
| 5 | 1 passed (1) | 18 passed (18) | 5.23s |
| 6 | 1 passed (1) | 18 passed (18) | 5.08s |
| 7 | 1 passed (1) | 18 passed (18) | 4.97s |
| 8 | 1 passed (1) | 18 passed (18) | 5.23s |
| 9 | 1 passed (1) | 18 passed (18) | 5.08s |
| 10 | 1 passed (1) | 18 passed (18) | 6.37s |

10 of 10 passed; no `FAIL` or `Error` line in any run. (The loop's per-run exit-code echo printed an empty value because zsh names the array `pipestatus`, not `PIPESTATUS`; the pass/fail evidence is the runner's own summary line above. The full-suite run in 3.2 captured its exit code directly.)

Note on strength of this evidence: the failure was 1 in 4 under load from 16 parallel agents. These 10 runs ran on the same busy host (other agents were editing under `apps/core-server/` during the window), but 10 clean runs is evidence consistent with the fix, not proof of absence of every other race. The mechanism is addressed directly (the query now awaits the rows); it is not hidden by a timeout.

### 3.2 Full web suite, once

Command: `npm run test -w @dems/core-web` (exit code captured directly)

```
exit=0
 Test Files  39 passed (39)
      Tests  438 passed (438)
   Duration  18.98s (tests 62%, import 16%, environment 12%, transform 6%, setup 5%)
```

Required result `Tests 438 passed (438)` in 39 files: met on the first run. No mid-edit failure from another agent's files occurred, so no re-run was needed.

### 3.3 Typecheck and lint

```
npm run typecheck -w @dems/core-web   ->  tsc -b            exit=0
npm run lint -w @dems/core-web        ->  oxlint            exit=0  (no diagnostics)
```

## 4. Reference-hash web test files (unchanged)

| File | Required hash | Measured (`git hash-object`) | Match |
|---|---|---|---|
| `apps/core-web/src/test/sim-fetch.test.ts` | `9e8b97c80da596e0ae6e9b37aa69b64e99e3bbdd` | `9e8b97c80da596e0ae6e9b37aa69b64e99e3bbdd` | yes |
| `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx` | `71f6f0337f2339d8e8d66ef232d7334dc0b67d1d` | `71f6f0337f2339d8e8d66ef232d7334dc0b67d1d` | yes |
| `apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx` | `1ab07579e928b9b545003899ec3265d4b8b6c762` | `1ab07579e928b9b545003899ec3265d4b8b6c762` | yes |

## 5. `git status --porcelain` and my footprint

Before my edit, `git status --porcelain -- apps/core-web/src/features/security-audit/__tests__/security-audit.test.tsx` printed nothing (file clean against HEAD). After my edit it prints ` M` for that file.

Whole-repo `git status --porcelain` shows 56 entries because the working tree already carried other agents' uncommitted work when I started. The tracked-modified (` M`) entries are the 21 that were in the session-start snapshot (`.gitignore`, `apps/core-web/package.json`, `vite.config.ts`, the three reference-hash web tests, mobile files, three docs files, `package*.json`, `packages/shared/...`) plus exactly one addition: my test file. Inside `apps/core-web` the porcelain is:

```
 M apps/core-web/package.json
 M apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx
 M apps/core-web/src/features/security-audit/__tests__/security-audit.test.tsx   <- W01c (mine)
 M apps/core-web/src/features/storage/__tests__/storage-page.test.tsx
 M apps/core-web/src/test/sim-fetch.test.ts
 M apps/core-web/vite.config.ts
```

The other five core-web entries were already modified at session start and are untouched by this row (three of them verified by hash in section 4).

Source files modified on disk after I wrote the pre-image patch (`find apps packages -newer .cache/rollback/W01c.pre.patch`, excluding `node_modules`, build output, `.DS_Store`, `*.tsbuildinfo`):

```
apps/core-server/test/helpers/db/testing/fake-cluster.ts      (another agent, apps/core-server; not mine)
apps/core-server/test/helpers/db/__tests__/run.test.ts        (another agent, apps/core-server; not mine)
apps/core-web/src/features/security-audit/__tests__/security-audit.test.tsx   (mine)
```

The two `apps/core-server` files are untracked-folder content (`apps/core-server/` is `??`) edited by a parallel agent. Not part of this row.

Created outside `/docs` (git-ignored by `.gitignore:47 .cache/`): `.cache/rollback/W01c.pre.patch`, `.cache/rollback/W01c.post.patch`.

## 6. Rollback

```
git checkout acaff20 -- apps/core-web/src/features/security-audit/__tests__/security-audit.test.tsx
```

This restores blob `f15d955d898d877098e9eccd417daf5dc5f7d03b` (the pre-edit state, which was identical to `acaff20`). Alternative: `git apply -R .cache/rollback/W01c.post.patch`.

## 7. Findings for the controller

1. **Residual risk, stated plainly.** `findAllByRole` resolves as soon as at least one row exists. If the matrix ever commits its rows in more than one pass (for example the header row first, the 9 body rows after), `toHaveLength(10)` could still fail in a narrower window. The recorded failure showed zero rows, which `findAllByRole` fully covers, and the brief required the same expectation unchanged and no retries. If NF-1 recurs with a row count between 1 and 9, the next step is `await waitFor(...)` around the length check or waiting on a data attribute in the page owner's test. That would be a design decision, so I did not do it.
2. **Same race class, not fixed (out of scope by instruction).** KI-24 also lists F-49-3 / D77 (1 s waits in shell and route tests flaking under load). Not touched here; the row asked for the single `rbac-matrix` assertion only.
3. **Hand-off to the Security & Audit page row.** Keep line 409 as `await ... findAllByRole('row')`. Reference hash `5470ce3fdcd98fd8c0926cd6afe03a1a1c1af58f`.
4. **Suggested KI-24 / NF-1 disposition:** mark as fixed by W01c with the 10 of 10 and 438 of 438 evidence above, and keep it open for one more full-gate cycle if the controller wants a longer soak than 10 runs.
