# coder-execution, step 31 (plan row W09): password-hash wrapper HB-4

| Field | Value |
|---|---|
| Step / row | 31 / W09 |
| Agent | coder-execution (tier R) |
| Status | **complete** |
| Result line | TD-05 built-in CONFIRMED; the fallback row Fh is not needed |
| First recorded timestamp | 2026-10-04 06:56:38 WIB (this file) |
| Final verification run | 2026-10-04 07:07:11 WIB |
| Write paths used | `apps/core-server/src/modules/identity/password-hash/**`; the output document; this file |
| Shared trackers | Not written (parallel run, P8): `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md`. The controller records the status of row W09 from this file |
| Sandbox bypass | None |
| Packages installed | None. No `package.json` or lockfile touched |
| Processes left running | None |

## Files created or updated

| Path | Change |
|---|---|
| `apps/core-server/src/modules/identity/password-hash/password-hash.ts` | Created: the wrapper (328 lines) |
| `apps/core-server/src/modules/identity/password-hash/index.ts` | Created: the folder's public surface (25 lines) |
| `apps/core-server/src/modules/identity/password-hash/argon2-builtin.test.ts` | Created: 9 tests (proof AS-08, the vectors) |
| `apps/core-server/src/modules/identity/password-hash/password-hash.test.ts` | Created: 62 tests (the wrapper) |
| `apps/core-server/src/modules/identity/password-hash/password-hash.wiring.test.ts` | Created: 3 tests (what the default exports hand to `node:crypto`) |
| `docs/2026-10-04_dems_backend_rbac_pairing/implementation/09_password_hash_wrapper.md` | Created: the output document (Tier 3) |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_31.md` | Created: this file |

Created and removed again by this row (its own files): `apps/core-server/.vitest/json/output.json`
with its two folders (the default output of Vitest's JSON reporter, finding F-8), and six evidence
copies `implementation/assets/09_*` (withdrawn to keep one output document, 02_plan §8.7; their
content is appendix A of the output document).

## Milestones

| # | What | State |
|---|---|---|
| 1 | Inputs read: blueprint row 31; P6, P9, P10, P12, P19, P21, P22, P24; "Early proofs / conditional rows" (Fh); plan W09 and §7 (SD-21); specs SR-05 to SR-08, ID-P10, ID-2, AC-B-24, AC-B-30, §14.1; database contract §4.5 and §5; analysis TD-05; research 02e A5 to A7; decisions D11, D12, D16 | done |
| 2 | Facts of the built-in on Node v26.8.2: names, parameters, units, callback form, no warning, error shapes, RFC 9106 vectors of all three variants in both forms | done |
| 3 | Wrapper: `hashPassword`, `verifyPassword`, `verifyAgainstDummy`, `needsRehash`, plus the factory `createPasswordHasher` and `deriveArgon2id` | done |
| 4 | Tests: 74 in 3 files, `unit` project; 13 single-change mutations each make the suite fail | done |
| 5 | Verification: tests, typecheck, lint exit 0; `git status`; test ledger | done |
| 6 | Output document | done |

## Verification (final run, 07:07:11 WIB)

| Command | Result |
|---|---|
| `npm run test -w @dems/core-server -- --maxWorkers=2 src/modules/identity/password-hash` | exit 0: `Test Files  3 passed (3)`, `Tests  74 passed (74)`, `Duration  546ms` |
| `npm run typecheck -w @dems/core-server` | exit 0 (`tsc --noEmit`, no output) |
| `npm run lint -w @dems/core-server` | exit 0 (`oxlint`, no finding) |
| `npm run test -w @dems/core-server -- --maxWorkers=2` (whole `unit` project) | exit 0: `Test Files  4 passed (4)`, `Tests  75 passed (75)` |

The runner output is quoted in full in section 8 of the output document.

## Test ledger (P24)

| Workspace, project | Before | After | New test files |
|---|---|---|---|
| `@dems/core-server`, `unit` | 1 test in 1 file | 75 tests in 4 files | `argon2-builtin.test.ts` (9), `password-hash.test.ts` (62), `password-hash.wiring.test.ts` (3): 74 tests in 3 files |
| `@dems/core-server`, `db` | not run | — | none |
| Other workspaces | not touched | — | none |

## Blockers

None.

## Findings (for F-n)

| ID | Finding |
|---|---|
| F-1 | `crypto.argon2` on Node v26.8.2 works as documented, emits no warning, reproduces the RFC 9106 vectors (Argon2d, Argon2i, Argon2id; both forms). AS-08 holds |
| F-2 | A message of the built-in can quote an argument (`ERR_INVALID_ARG_TYPE ... Received type number (12345)`). The wrapper drops the cause; other rows that pass a secret to `node:crypto` must not log its raw error (W24, W32, W41) |
| F-3 | `memory: 67` and `memory: 64` give different tags despite the documented rounding: store exactly the value that was passed. No effect on 19,456 |
| F-4 | The built-in accepts an empty message; the wrapper refuses it |
| F-5 | A lone surrogate becomes U+FFFD in the UTF-8 bytes, so two ill-formed strings can collide. No rule exists for it; none was added. No effect while no operation changes a password (ID-11) |
| F-6 | One derivation with the parameters of SR-05: about 16 ms on a quiet host (load 4.89), 16 to 27 ms median under the wave's load, worst single sample 64.7 ms. The seed (three operators): about 50 to 80 ms |
| F-7 | **Host load**: 1-minute load average 30.12 at 07:05:13, 40.62 at 07:06:17, 41.38 at 07:07:11 (4.89 at about 06:55). P9's load guard names 10 |
| F-8 | Vitest 5.0.3 with `--reporter=json` and no `--outputFile` writes `apps/core-server/.vitest/json/output.json`, which is not git-ignored. This row's stray copy is removed |
| F-9 | Sandboxed runs print six lines `ERROR: failed to copy trust settings of system certificate` before the runner starts: noise |

## Deviations from the plan (for DR-n)

| ID | Deviation |
|---|---|
| DV-1 | Two exports beyond the four named functions: `createPasswordHasher` (injectable derivation and random source) and `deriveArgon2id`. They are the spy seam for this row's dummy-path tests and for AC-B-24 in W24 |
| DV-2 | Two record types: `PasswordHashRecord` (produced) and `StoredPasswordHash` (accepted: `algorithm: string`, bytes as any `Uint8Array`) |
| DV-3 | Three test files; one replaces `node:crypto` by call-through spies to prove the default wiring |
| DV-4 | The wrapper writes no error log (row rule 4); every failure is a coded `PasswordHashError` that the caller logs |
| DV-5 | `prettier` 3.9.9 from `node_modules` was run once on the five new files (`--print-width 100 --single-quote`); nothing installed, no manifest edited |
| DV-6 | The shared trackers and `implementation/99_implementation_report.md` were not written (parallel run, P8) |
| DV-7 | The expected vector tags were written from the published texts as the agent knows them (no network, P20; the research holds no vector). The run reproduces all ten literals bit for bit; a reviewer with network access can compare the RFC literal with the RFC text |

## Decisions needed (for D-n)

| ID | Decision | Proposal |
|---|---|---|
| D-a | How the 128 characters of ID-P10 are counted: the wrapper counts UTF-16 code units, as zod's `.max(128)` does (at most 384 UTF-8 bytes) | Record it; W19 writes the `signIn` body as `z.string().min(1).max(128)` |
| D-b | Lone surrogates (F-5) | Accept for this task |
| D-c | `.vitest/` in `.gitignore`, or a rule to pass `--outputFile` (F-8) | Either, by the row that owns `.gitignore` |
| D-d | A malformed stored record makes `verifyPassword` reject with `RECORD_INVALID` without a derivation | Accept: the CHECK constraints make such a row impossible; W24 answers 500 and logs the code |

## Rollback (R-NEW)

`git clean -fd -- apps/core-server/src/modules/identity/password-hash`, on the controller's
instruction only. No stub existed before, so P23 does not apply.
