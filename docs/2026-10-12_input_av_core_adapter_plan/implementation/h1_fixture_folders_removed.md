---
task: input_av_core_adapter_plan
row: H1
agent: H1
date: 2026-10-13
authority: decision U21 (1) in decisions/decisions.md; C71 C-4; C86
status: complete
---

# H1 - removal of the `test-row61-*` fixture folders from `.data/`

Hard limits kept: no file content under `.data/` was read (names, counts, sizes, modification times only); only
directories that are direct children of `/Users/gsp-budi/Documents/DEMS/.data/` named `test-row61-*` were deleted;
no tracked file or source was changed. Times below are local (host clock at the checks: 2026-10-13 18:37).

## Step 1 - count and shape (before)

| Check | Command | Output |
|---|---|---|
| directories of the name | `find .data -mindepth 1 -maxdepth 1 -type d -name 'test-row61-*' \| wc -l` | **322** |
| symbolic links of the name | same with `-type l` | **0** (no stop) |
| entries of the name of any type | same without `-type` | 322 |
| entries of the name that are neither directory nor link | `! -type d ! -type l` | 0 |
| oldest modification time | `stat -f '%m %Sm %N'`, sorted | 2026-10-09 23:35:14 `test-row61-row140-74696-1` |
| newest modification time | same | 2026-10-13 14:15:41 `test-row61-i9a-80816-1` |
| total size | `du -sk` over the set, summed | 1,634,684 KiB = **1596.4 MiB (about 1.56 GiB)** |

Entries left alone, by name only (22 in `.data/` besides the set; `stat` types: D = directory, F = regular file):

```
capture-local (D)            capture-worker-boot.jsonl (F)   capture-worker.jsonl (F)
contract-transcript-signer-63035 (D)   contract-transcript-signer-81326 (D)
credential-store (D)         demo-evidence-v2 (D)            dev-fixtures (D)
discovery (D)                gate-75b-set-aside (D)          helpers (D)
media (D)                    pg-scripts.log (F)              pg.env (F)
pg.owner.env (F)             pg.pwfile (F)                   postgres (D)
postgres.log (F)             row61-worker-probe.jsonl (F)    run (D)
signer (D)                   transcriber (D)
```

(`row61-worker-probe.jsonl` is a file, not matched by the pattern `test-row61-*`, and was not touched.)

## Step 2 - not in use

Sandbox note: inside the sandbox `ps` is refused ("operation not permitted"). The process checks (2a repeat, 2b, 2d)
were therefore re-run with the sandbox OFF; they are read-only (`lsof`, `ps`). Everything else ran in the sandbox.

| # | Check | Command | Result |
|---|---|---|---|
| 2a | no process holds a file below the set | `lsof -nP 2>/dev/null \| grep -c '/.data/test-row61-'` | **0** in the sandbox (14,142 lines of lsof seen) and **0** with the sandbox off (14,149 lines seen) |
| 2b | no process started with a folder as argument or working directory | `ps -axo pid,command \| grep 'test-row61-' \| grep -v grep \| wc -l` (sandbox off; 612 processes seen) | **0** |
| 2d | the user's instance does not use them | `ps -axo pid,command \| grep 'task4-row232' \| grep -v grep` then `... \| grep -c 'test-row61'` | processes: pid 57176 `sh .cache/task4-row232/start.sh core`, pid 57178 `node --import tsx .../.cache/task4-row232/launch.mts`, pid 57303 `sh .cache/task4-row232/start.sh web`; listeners `127.0.0.1:4423` (pid 57178) and `127.0.0.1:5178` (pid 57305); count of `test-row61` in their command lines **0** |
| 2e | none modified in the last 60 minutes | `find .data -mindepth 1 -maxdepth 1 -type d -name 'test-row61-*' -mmin -60 \| wc -l` | **0**; and at any depth (`-exec find {} -mmin -60`) **0** |

### 2c - files that mention the name

Command: `grep -rn "test-row61" apps packages scripts --include='*.ts' --include='*.tsx' --include='*.mts' --include='*.py' --include='*.sh' --include='*.md' -l`
(node_modules excluded). A second pass over all text file types (`grep -rIl`) listed the same two files and no others.

| File | Line (quoted) | Verdict |
|---|---|---|
| `apps/core-server/src/capture/boot/__tests__/support.ts` | `:40 export const FIXTURE_DIRECTORY_PREFIX = 'dems-test-row61-';` | Prefix of an OS-temporary directory: `:133 mkdtempSync(join(realpathSync(tmpdir()), \`${FIXTURE_DIRECTORY_PREFIX}${label}-...\`))`. Fine (the name starts with `dems-`, so it could not match `.data/test-row61-*` anyway). |
| same | `:42 export const FIXTURE_PROGRAMS_ROOT = resolve(REPOSITORY, '.cache', 'test-row61-programs');` | Under `.cache/`, not `.data/`. Fine. |
| `apps/core-server/src/capture/boot/__tests__/reserved-ids.test.ts` | `:246 expect(FIXTURE_PROGRAMS_ROOT).toBe(resolve(REPOSITORY, '.cache', 'test-row61-programs'));` | Asserts the `.cache/` location. Fine. |
| same | `:404 expect(support).toContain("export const FIXTURE_PROGRAMS_ROOT = resolve(REPOSITORY, '.cache', 'test-row61-programs');");` | Static check of the same line in `support.ts`. Fine. |

Related lines of the same file (not matching the name, read to confirm the hygiene): `reserved-ids.test.ts:237-238`
assert the fixture directory starts with the OS-temporary root plus the prefix and does NOT start with `${REPOSITORY}/`.
No file mentions `.data/test-row61-*` as a place to write or read: no stop.

All of 2a-2e hold. Step 3 was done.

## Step 3 - deletion

`git status --short` was captured immediately before (665 lines; it differed from the capture taken at the start of the
task by one line, ` M apps/core-server/src/engine/__tests__/boot-checks-runner.test.ts`, another agent's concurrent work).

Command, exactly as ordered, sandbox ON (the sandbox did not refuse it; no override was needed):

```
find /Users/gsp-budi/Documents/DEMS/.data -mindepth 1 -maxdepth 1 -type d -name 'test-row61-*' -exec rm -rf -- {} +
```

Exit code 0.

## Step 4 - after

| Check | Output |
|---|---|
| directories named `test-row61-*` directly under `.data/` | **0** (before: 322) |
| entries of that name of any type | 0 |
| `ls -A .data` excluding the set: before vs after | 22 names both times; `diff` of the two listings: **empty (exit 0)** |
| `git status --short` before step 3 vs after | 665 lines both times; `diff`: **empty (exit 0)**. `.data/` is git-ignored, so the deletion cannot show there. The only difference to the capture taken at the start of the task is the one line above, caused by another agent before step 3. |
| size freed | about 1596.4 MiB (1.56 GiB); `.data/` now measures 8.2 GiB (`du -sh`) |

## Sandbox use

- Sandbox OFF for: the repeat of `lsof -nP` (2a) and the two `ps` checks (2b, 2d) with `lsof -iTCP` for the two ports.
  Reason: `ps` returned "operation not permitted" in the sandbox. All read-only.
- Sandbox ON for: every other command, including the deletion.
