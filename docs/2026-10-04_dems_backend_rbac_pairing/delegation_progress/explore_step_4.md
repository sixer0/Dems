---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: explore
step: 4
row_status: FIRM
status: complete
date: 2026-10-04
---

# Progress: explore, step 4 (mobile simulator consumption)

## Output

- `research/01d_explore_mobile.md` (Tier 2; 741 lines; 45 tables; 21 numbered findings F-M1 to F-M21; section 9 holds the 140-file group tables).

## Verification quoted

| Check | Result |
|---|---|
| `grep -rl "@dems/shared/sim" apps/mobile/src \| wc -l` | 140 (blueprint time: 140) |
| Real import statements | 139; the 140th match is a comment in `apps/mobile/src/runtime/index.ts:4` |
| Files in the group tables | 140 unique, 0 duplicates, 0 missing (`diff` of the grep list against the report's table rows: IDENTICAL) |
| Production / test / harness | 96 / 33 / 11 |
| `SimActions` members | 42; 33 called in production, 9 never called |
| Synchronous-return call expressions | 9 in 6 files (table S1); 8 boolean wrappers (S2); 2 sync-throw dialogs (S3); 9 read-after-write sites (S4); 7 client-side permission sites (S5) |
| Storage keys quoted | `dems.sim.v1`, `dems.mobile.prefs.v1`, `dems.mobile.auth.v1`, `dems.mobile.log.v1`, `dems.auth` (not written on mobile) |
| Cleartext | `app.json` has no cleartext key and no `expo-build-properties`; `usesCleartextTraffic="true"` in the `debug` and `debugOptimized` source manifests only; merged release manifest: no attribute, targetSdk 36 |
| Source folders changed | `git status --porcelain -- apps packages scripts release`: 0 lines |
| Secret values in the report | none (checked by comparing the report text with the two demo constants without printing them) |

## Milestones

1. Read `identification/02_structured.md` (rows 1-22, protocol).
2. Graft first: `graft map`, `graft skeleton` x5, `graft callers useSimActions` (15 callers), `graft callers useSimInstance` (18 callers), `graft grep` for direct store access; all with `--no-refresh`.
3. Scan script over the 140 files (outside the repo) for imports, hooks, selectors, inline slices and actions; Read of every auth, runtime, pairing, guard and wrapper file named in the report.
4. Wrote the report; ran the coverage proof twice (on the draft and on the file in place).

## Blockers

None.

## Deviations (for the controller to log)

1. The 140 includes one comment-only match (`runtime/index.ts:4`).
2. `src/app/` has no matching file; it has a note, not a table.
3. Graft refresh disabled on every call (`--no-refresh`) so the git-ignored `graft/` folder was not rewritten.
4. Only short-lived read-only tools ran (`graft`, `grep`, `node`, `python3`); no Metro, emulator or `adb` (P7).

## Decisions for the controller to record (suggestions)

- Mobile uses 33 of the 42 `SimActions` members. The nine unused ones: `signInWithSecurityKey`, `scanCaseNumber`, `addNote`, `exportAudit`, `exportLogs`, `resetDemo`, `restartServices`, `setPresentationMode`, `updateSettings`.
- Facts the specification rows must resolve rather than assume: whether mobile Live mode keeps the synchronous `Sim` object contract or adds an asynchronous action layer (27 production files named in tables S1 to S4), and where a pairing gate sits (no predicate, no device-credential module and no camera module exist today).

## Graft usage this row

About 320,000 tokens of file reading avoided across the Graft calls (callers useSimActions about 105,000; callers useSimInstance about 98,000; grep about 112,000; five skeletons about 4,800), worth about US$0.19 at the rate the tool reported.

## Files created

- `docs/2026-10-04_dems_backend_rbac_pairing/research/01d_explore_mobile.md`
- `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/explore_step_4.md`
