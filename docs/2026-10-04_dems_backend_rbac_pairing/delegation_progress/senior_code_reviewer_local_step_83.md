# Delegation progress: senior-code-reviewer-local, step 83 (W61, CHECKPOINT CP-W1)

| Field | Value |
|---|---|
| Task | 2026-10-04_dems_backend_rbac_pairing |
| Blueprint step / plan row | 83 / W61 |
| Agent | senior-code-reviewer-local (tier R) |
| Status | **complete** |
| Verdict | **PASS WITH FIXES** — 0 Blocker, 1 High, 4 Medium, 6 Low, 4 Info (15 findings) |
| Open blockers | **0** |
| Output document | `gateway_check/08_cp_web_runtime.md` |
| Started / finished | 2026-10-05 16:07 / 17:10 WIB |

## Files created (and nothing else)

- `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/08_cp_web_runtime.md`
- `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/assets/08_protected_artefacts.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/assets/08_credentials_build_checks.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/assets/08_mode_switch_pins.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/assets/08_command_totals.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/senior_code_reviewer_local_step_83.md` (this file)

No source file and no test file was written. `status_tasks.md`, `delegation_progress_report.md`,
`decisions/decisions.md`, `masterplan/02_plan.md` and every other row's document were left alone
(parallel run, P6/P17). Proof of the read-only claim: `find apps/core-web/src packages/shared/src
-newermt "2026-10-05 16:07"` returns nothing (checked at 17:07). No credential, token, cookie value or
password appears in any output.

## Commands run (all from the workspace root, no `cd`; P9 worker limit; P15 quoted totals)

```
16:16  npm run test -w @dems/shared    -- --maxWorkers=2   68 files / 1,814 tests passed   exit 0
16:17  npm run test -w @dems/core-web  -- --maxWorkers=2   55 files /   759 tests passed   exit 0   (background, 56.38 s)
16:17  npm run build -w @dems/core-web                     526 modules, vite part exit 0
16:5x  npm run typecheck -w @dems/core-web                 exit 0
16:5x  npm run lint    -w @dems/core-web                   exit 0, no finding
16:5x  npm run lint    -w @dems/shared                     exit 0, no finding
```

`npm run test:db` was **not** run (another agent owns the database folder). Read-only commands:
`git diff --stat acaff20 -- <paths>`, `git cat-file -e`, `git rev-parse acaff20:<path>`,
`git hash-object`, `git status --porcelain`, `rg`, `ls`, `stat`, and the marker greps over the build
output. Logs: `/tmp/cpw1_web.log`, `/tmp/cpw1_shared.log`, `/tmp/cpw1_build.log`.

**One deviation of my own (CPW1-15).** The build command's script is `vite build && tsc -b`, and npm
appended my `--outDir`/`--emptyOutDir` flags to `tsc`, not to `vite`, so the bundle went to the default
`apps/core-web/dist` — git-ignored (`.gitignore:11`) and present since Oct 1 — instead of `$TMPDIR`. No
tracked file changed (`git status --porcelain apps/core-web/dist` is empty) and no gate reads that path.
Per M12 I did not `rm` inside the tree, so it is disclosed rather than deleted; the CSP result stands
(0 files with `unsafe-eval`, 0 with `new Function(`).

## The five answers routed to me by D136 (report section 6)

| # | Question | Ruling in one line |
|---|---|---|
| 1 | Decision 9 / F76-14 | The **shell** copy stays (`components/shell/mode-switch.tsx:30`); the Login copy is deleted; `switching`, the login copy's record discipline and an optional `source` argument move with it; **no test file changes** (all four pin only the three identical IDs through their own surface). Owner: one controller slot over W54/W55 paths — CPW1-1 |
| 2 | Decision 3 | **`warning` is truer**, derived from `isLinkUp(link)` so CONNECTING after a loss stays `danger` while the sticky notice is up; one expression in `mode-indicator.tsx` + one assertion at `live-shell-indicator.test.tsx:252`. Owner W54 — CPW1-6 |
| 3 | F79 / F-15 | **No** — the displaced tab must keep reconnecting (stopping strands it; the server expects the loser back; mobile shares the client and needs the 1013 reconnect; the client cannot even tell 1013-replaced from 1013-cap because it reads `event.code` only). The decision lands in `packages/shared/src/realtime/live-socket-client.ts:43,889`; the optional wording carve-out lands in `apps/core-web/src/components/shell/live-notices.tsx:58` (W54). README sentence → W86 — CPW1-11 |
| 4 | D128's note | It must leave the feature folder, but **not** into `lib/presentation-mode.ts` ([CS] §7.3 G15 says that file has no change): move it to `runtime/presentation-follow.ts` beside `query-bridge.ts`, and retarget W55's static rule. Owner: W55's follow-up in W50's path — CPW1-4 |
| 5 | Anything else the page rows must know | Report section 8: ten rules (the one way in, the presenter first, the cache contract, never persist a secret, the three things a Live test needs, what the shell already says, the seam table with its one pending correction, namespace ownership, the do-not-touch list, and the current ledger 55/759) |

## Findings

| Severity | IDs |
|---|---|
| Blocker | none |
| High | CPW1-1 (the two confirmed-mode-change implementations, still unfixed after D128 point 4) |
| Medium | CPW1-2 (**F76-13 is false** — `core-endpoint.test.tsx` and `packaged-csp.test.ts` exist at `apps/core-web/src/lib/__tests__/` and are blob-equal to `acaff20`; the repair measured the wrong folder, and D136(g) routed the false claim to W88), CPW1-3 (the health reader uses the global `fetch`, so any Live test reaching `/login` issues a real request — stub it in the harness), CPW1-4 (the root route imports a feature helper), CPW1-5 (static tests pin the source text of another row's file) |
| Low | CPW1-6 (the RECONNECTING tone), CPW1-7 (`main.tsx` has no catch around the boot → a white page), CPW1-8 (`reportShellError` writes a raw `error.message`, which W55 forbids for the same sink), CPW1-9 (three definitions of the `['health']` query), CPW1-10 (`i18n.test.ts:2` still says 13 namespaces), CPW1-11 (a displaced socket is worded "unreachable") |
| Info | CPW1-12 (the redactor covers only the three bearer prefixes — W81/W84 must not rely on it), CPW1-13 (`setCoreEndpointMode` is a module global), CPW1-14 (`boot.ts:174`'s unreachable fall-through shape), CPW1-15 (my build artefact) |

## What held up under challenge (the clean part of the review)

- **Mode isolation**: the heavy module is behind one dev-gated dynamic import; the endpoint row follows
  the data source, not the stored mode; a refusal and an unreachable Core build no simulator; the fresh
  production build repeats W50's marker profile exactly.
- **Credentials**: no token in web storage, a URL, a query or a log anywhere in the three rows; the client
  is `browser-cookie` only and refuses credential-shaped paths; the cache is emptied in the turn of a
  session end or a lost permission, mutation cache included.
- **Packaged CSP**: blob `78c8898e…` confirmed, `z.config({jitless:true})` still first, no `unsafe-eval`
  and no `new Function(` in the built assets.
- **AC-C-35/36/41 re-measured, not trusted**: all four protected files blob-equal to `acaff20`; the three
  guard files and `apps/mock-core/**` untouched.

## Suggested fix order (report section 9)

1. CPW1-2 (correct the record before W88 writes it) → 2. CPW1-1 + CPW1-8 → 3. CPW1-4 + CPW1-5's first pin
→ 4. CPW1-3 → 5. CPW1-6/7/11 → 6. the rest as close-out and instruction items.
