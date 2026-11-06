# W1: closing consolidation round over the web

**Row**: W1 (controller-added; decisions D176, D178 DC-1 and DC-4 / FW76-5, D179 DC-1 and DC-2). Model: row W0
(`gateway_check/08a_w0_web_consolidation.md`). Agent: coder-execution.
**Time**: 2026-10-06 02:28 to 03:08 WIB.
**Status**: **complete**. Every item landed or was checked. Two choices need the controller's ratification (DC-1, DC-2), and one
test-file grant is recommended (DC-3). No item was stopped.

Code is cited `path:line` relative to `apps/core-web/src/` unless the path says otherwise. "Pre" means the pre-image in
`.cache/rollback/W1/`, copied before the first edit of each file. "Now" means the tree after W1.
Assets (all under `gateway_check/assets/`):

| Asset | What it holds |
|---|---|
| `08b_w1_final_gate.log` | The final gate's output |
| `08b_w1_changes.diff.txt` | Every change against its pre-image; 650 lines, 9 files |
| `08b_w1_mutations.log` | Every mutation and proof run |
| `08b_w1_mutation_config.mts.txt` | The in-memory mutation config |
| `08b_w1_proof_config.mts.txt` | The proof config |
| `08b_w1_mutation_runner.py.txt` | The mutation runner |
| `08b_w1_walker_proof.test.ts.txt` | The 10 walker tests, kept outside the tree |
| `08b_w1_item2_affected.log` | The affected-test run of item 2 |
| `08b_w1_item3_affected.log` | The affected-test run of item 3 |
| `08b_w1_effects_scan.py.txt` | The script that scanned every effect for item 5 |

---

## 1. Outcome per item

| # | Item | Outcome | Visible change | Evidence |
|---|---|---|---|---|
| 1 | Remove the unused `ALLOWED` entry (D178 DC-1) | **Done.** The `system/sim-adapter.ts` entry was removed; the guard stays green. An in-memory proof shows the guard goes red when that file regresses, in three shapes. The old entry would have hidden the pre-W76 shape | None | §2; P01–P04 |
| 2 | One walker for operations 59 and 63 (D178 DC-4, FW76-5) | **Done.** New `lib/core-page-walk.ts`, which both pages' export files call. Kept: every page read, the chain check (59), the D176 check before every page (now inside the walk), never a partial file. **W75 gains the D176 check and the endless-list guard** (DC-2) | None for an operator | §3; 12 files / 166 tests; mutations §3.5 |
| 3 | W54's shell test (D179 DC-1, DC-2) | **Done.** (a) The clean-up clears `bed` before `dispose()`. (b) The test looks for `users-roles-page` / `paired-devices-page`, and both pages carry these IDs | None | §4; 9 files / 162 tests; Q01–Q04 |
| 4 | Users & Roles reads after sign-out (D176, F75-2) | **Checked: compliant, no code.** Both reads need `USER_ADMIN` in the session's own permission list, so they are off when the session is null. Proven in memory: no request and no 401 after a sign-out, in two shapes. The F75-2 shape goes red | None | §5; U00, U01 |
| 5 | Remaining copies for W92 (read-only) | **Listed** (§6): 4 pending guards outside the hook, 2 sanctioned exceptions, 0 reveal timers, 6 page reporters not on the shared helper, 2 console loggers, 0 new effect-started commands | — | §6 |

**Whole web suite: 93 files / 1,244 tests, exit 0.** That is the floor; no test file was added to the tree. Typecheck and lint of
`@dems/core-web` exit 0. The six protected test files match their sha256 recorded at 02:28:59. Mutation runs are in memory
(M15), and every mutated file had the same hash before and after each batch (§7).

## 2. Item 1: the unused `ALLOWED` entry

| | Pre | Now |
|---|---|---|
| `test/live-strict-mode-starts.test.tsx` | `:222-233`, two entries. One is `{ file: 'system/sim-adapter.ts', token: 'actions.updateSettings(', why: 'W76's folder, not yet in Live mode…' }` (`:228-232`) | `:222-228`, one entry (the device drawer's ref-guarded refresh) |

W76 moved the preference seed onto the helper. Its effect is at `features/system/sim-adapter.ts:131-141`:
`return deferEffectStart(() => { if (seeded.current) return; seeded.current = true; … settle(() => actions.updateSettings(stored), …) })`.
Run after the edit: `src/test/live-strict-mode-starts.test.tsx`, 11 / 11 green. Typecheck exit 0.

**In-memory proof.** The guard reads files from disk, so the runner cannot mutate `system/sim-adapter.ts` in memory and reach
it. Instead the test file is mutated in memory: it regresses the text it read for that one file. In every case the
expected finding text was seen in the output:

| Id | Regression of `system/sim-adapter.ts` (in memory) | Result |
|---|---|---|
| P01 | Pre-W76 shape: a bare `actions.updateSettings(stored)` started in the set-up | red: `system/sim-adapter.ts:131 actions.updateSettings( — outside the helper` |
| P02 | `settle(() => actions.updateSettings(stored))` started in the set-up | red: `…:131 settle( — outside the helper` |
| P03 | The helper called but not returned | red: `…:131 settle( — the helper is not returned` |
| P04 (control) | P01's regression with the removed entry put back | **green**: the old entry would have hidden the pre-W76 shape. This is why it had to go |

## 3. Item 2: one walker for operations 59 and 63

### 3.1 The copies found

| Copy | Pre | Shape |
|---|---|---|
| W75 | `features/security-audit/export-file.ts:85-118` `readExportedRows` and `checkWalk` | Walks 59 to the export's rows. Has a chain check. **No D176 check** (the reader `export-audit-dialog.tsx:55-58` asks no session). **No endless-list guard**: after 10,000 pages without a known count it returned the rows it had read |
| W76 | `features/system/live-log-export.ts:96-145` `readExportedAuditRows`, `checkWalk`, `readAllEvents` | Walks 59 with the chain check and ENDLESS, and walks 63 with ENDLESS. The D176 check sat in the dialog's two readers (`export-logs-dialog.tsx:72-91`, `signedOut()`) |

### 3.2 The one walker: `lib/core-page-walk.ts` (new, 151 lines)

| Export | Line | What it does |
|---|---|---|
| `CORE_PAGE_LIMIT` | `:35` | 200 rows a page |
| `CorePageFailure`, `CorePageAnswer<Data>`, `CorePageReader<Data>` | `:41-50` | The typed client's answer, read structurally |
| `CoreWalkFailure` | `:56-62` | `CALL` (with `list`), `CHAIN`, `ENDLESS` |
| `SIGNED_OUT_PAGE` | `:69-75` | The Core's own 401 `NOT_SIGNED_IN`, in the client's shape with `transport: null` and `retryAfterSeconds: null`, so the refusal presenter reads it exactly as that 401 (SIGNED_OUT, silent) |
| `readSignedIn` (private) | `:96-101` | **D176**: `if (!options.signedIn()) throw options.fail({ kind: 'CALL', list, failure: SIGNED_OUT_PAGE })` comes BEFORE `readPage(cursor)`. A refused page throws the page's error |
| `walkAuditChain` | `:104-126` | Every page of 59, following `nextCursor`. Stops at the rows the export covers or, without a count, before the export's own AUDIT_EXPORTED row. Throws ENDLESS when it never finishes. Then calls `checkChain` |
| `checkChain` (private) | `:129-137` | Count, sequence 1..n, and head |
| `walkAllEvents` | `:140-151` | Every page of 63 to the last one; ENDLESS after 10,000 pages |

Every failure throws whatever the page's `fail(reason)` returns. The page's error class, name and code are its record
(W75's test asserts `errorName: 'AuditWalkError'`; W76's tests assert `'LogWalkError'` and `list`). Why `lib/`: it sits beside
`pending-control.ts`, `effect-start.ts` and `page-report.ts`, the console's other cross-page helpers. It is not `runtime/**`.
It is pure: no hook, and no import of the typed client.

### 3.3 The two pages now

| File | Pre → now |
|---|---|
| `features/security-audit/export-file.ts` (172 → 118 lines) | The loop and `checkWalk` were removed. `AUDIT_PAGE_LIMIT = CORE_PAGE_LIMIT` (`:24`). `AuditWalkError` kept (`:32-44`), now over `CoreWalkFailure`: CALL → the failure's code, CHAIN → `CHAIN_MOVED`, ENDLESS → `ENDLESS_LIST` (new kind for W75). `readExportedRows(readPage, target, { signedIn, onPage? })` (`:60-66`) = `walkAuditChain(…, { …, fail: (reason) => new AuditWalkError(reason) })`. The file builder, file name and download are unchanged |
| `features/security-audit/export-audit-dialog.tsx` | One call site (`:154-160`): `readExportedRows(auditPageReader(webLive), target, { signedIn: () => webLive.session != null, onPage })`. Same session test as W75's role-matrix fix (`rbac-panel.tsx:151`). The rest is unchanged, including rule 2's `presentCoreError(caught.reason.failure)` |
| `features/system/live-log-export.ts` (210 → 161 lines) | The loops and `checkWalk` were removed. `LOG_PAGE_LIMIT = CORE_PAGE_LIMIT` (`:39`). `AuditPageAnswer` / `EventPageAnswer` are aliases. `LogWalkError` kept (`:47-58`, same codes). `LogExportTarget extends AuditChainTarget`; `logExportTarget` unchanged. `readExportedAuditRows` / `readAllEvents(readPage, …, { signedIn, onPage? })` (`:91-98`) bind `fail` (`:84`). The unused `PageFailure` alias was dropped (nothing imported it after the dialog edit) |
| `features/system/export-logs-dialog.tsx` | `signedOut()` and the two readers' checks moved into the walk. The readers keep only `if (live === null) return SIGNED_OUT_PAGE` for narrowing (`:79-88`). `signedIn = () => live !== null && live.session !== null` (`:78`, the same test as before) is passed to both walks (`:95-103`). One import was added (`SIGNED_OUT_PAGE`) and one removed (`PageFailure`) |

Behaviour, page by page:
- **W76**: unchanged. Its D176 test sends 1 page of 59 and 0 of 63 after the sign-out, says nothing and writes no file; green.
- **W75**:
  - After a sign-out, its walk now sends no further page. Before, it sent one more page request, which the Core answered 401.
  - The page reaches the same presenter path either way: SIGNED_OUT is silent, and the inline line names the export. The page
    is normally gone by then (the shell shows the login screen).
  - A server that never stops handing out cursors now ends in `ENDLESS_LIST`, never a partial file.
  - Neither change is visible to an operator (DC-2).

### 3.4 Tests

`npm run test -w @dems/core-web -- --maxWorkers=2 src/test/live-security-audit- src/test/live-system- src/features/security-audit
src/features/system src/test/live-strict-mode-starts.test.tsx src/test/live-runtime-static.test.tsx` → **12 files / 166 tests
passed** (`assets/08b_w1_item2_affected.log`). No test file was edited; no import line needed changing. Typecheck exit 0 and
lint exit 0 after the item.

### 3.5 Mutation run over the walker (in memory, M15)

The brief named three classes. All tree files were identical before and after each batch.

**A page skipped**: 6 of 6 detected by the tree's tests.

| Id | Mutation |
|---|---|
| K01 | The rows of audit page 2 are dropped |
| K02 | The events of page 2 are dropped |
| K03 | The audit walk stops after its first page |
| K04 | The events walk stops after its first page |
| K05 | The first cursor is reused (`nextCursor` not followed) |
| K06 | Pages of 100 rows instead of the contract's 200 |

**The signed-in check removed**

| Id | Mutation | Detected by |
|---|---|---|
| S01 | The check removed | Tree: W76's D176 test |
| S02 | The check only before the first page | Tree: W76's D176 test |
| S06 | W76's call site always says signed in | Tree: W76's D176 test |
| S04 | The check removed | The **injected W75 proof**: W76's D176 test shape, added in memory to `test/live-security-audit-export.test.tsx` |
| S05 | W75's call site always says signed in | The injected W75 proof |
| S07 | `SIGNED_OUT_PAGE` without `transport` (the presenter no longer reads it as the 401) | The injected W75 proof (W75's page logs and toasts "file failed") |
| S03 | The check runs after the request leaves | **Survived the tree's tests.** It differs only when the walk *starts* signed out (the export's 202 arrives after the session ended), and no page test stages that. **Killed by the out-of-tree proof** |
| X00 (control) | The injected W75 proof on the tree as it is | **green**: W75 now sends no page of 59 after a sign-out |

**A partial file emitted**

| Id | Mutation | Detected by |
|---|---|---|
| F01 | A refused events page returns the events read so far | Tree |
| F02 | A refused audit page returns the rows read so far | Tree |
| F03 | The chain check is not run | Tree |
| F04 | A failed check returns the rows | Tree |
| F07 | The head check removed | Tree |
| F10 | The stop at the export's rows removed | Tree |
| F05 | The count check removed | **Survived the tree** (the head check covers it whenever the head is known). Killed by the out-of-tree proof |
| F06 | The sequence check removed | **Survived the tree** (same reason as F05). Killed by the out-of-tree proof |
| F08 | An endless audit list returns what it read | **Survived the tree** (no page test of a server that never stops). Killed by the out-of-tree proof |
| F09 | An endless events list returns what it read | **Survived the tree** (same reason as F08). Killed by the out-of-tree proof |
| F11 | The stop before the export's own row when the count is unknown removed | **Survived the tree** (no page test without a known count). Killed by the out-of-tree proof |

**The page's own parts**: 4 of 4 detected by the tree.

| Id | Mutation |
|---|---|
| P10 | The page counter is not called |
| P11 | W75 names a moved chain wrongly (not `CHAIN_MOVED`) |
| P12 | W76 names a moved chain wrongly (not `CHAIN_MOVED`) |
| P13 | A refused page loses its list name |

Totals over the 28 walker mutants:

| Detected by | Mutants | Count |
|---|---|---|
| The tree's tests alone | K01–K06, S01, S02, S06, F01–F04, F07, F10, P10–P13 | 19 |
| The W75 sign-out proof, injected into W75's own test file in memory | S04, S05, S07 | 3 |
| Survived the tree; then **killed, 6 of 6**, by the walker proof outside the tree | S03, F05, F06, F08, F09, F11 | 6 |

The walker proof is `.cache/w1/proof/core-page-walk.proof.test.ts`, 10 tests, run with `vitest.proof.config.mts`; copy in
`assets/08b_w1_walker_proof.test.ts.txt`. It covers: a walk that starts signed out; a sign-out between pages; a chain with no
head known (count and sequence); an unknown count; an endless list for 59 and 63; a refused page; every event in order.
It is ready to move into the tree (DC-3).

## 4. Item 3: W54's shell test

| | Pre | Now |
|---|---|---|
| (a) `test/live-shell-admin.test.tsx` `afterEach` | `:186-187` `bed?.dispose(); bed = undefined` | `:186-191` a three-line comment, then `const disposing = bed; bed = undefined; disposing?.dispose()` |
| (b) the table and its assertion | `:385-387` `'ur-stub'`, `'pd-stub'`, parameter `stubId`; `:394` `getByTestId(stubId)` | `:388-390` `'users-roles-page'`, `'paired-devices-page'`, parameter `bodyId`; `:397` `getByTestId(bodyId)` |
| `features/users-roles/index.tsx` | `:120` `data-testid="ur-stub"`; docblock `:28-30` "Compatibility test ID `ur-stub`…" | `:120` `data-testid="users-roles-page"`; docblock says which test finds it and that it replaced `ur-stub` (W1, D179 DC-1) |
| `features/paired-devices/index.tsx` | `:82` `data-testid="pd-stub"`; docblock `:13-15` | `:82` `data-testid="paired-devices-page"`; docblock updated the same way |

The new IDs sit inside the page roots (`page-users-roles`, `page-paired-devices`), which stay W54's page contract. A root
cannot be looked up `within` itself, so the body carries the page name. No test of either page referenced the old IDs. W81's
test reads the class `.pd-grid` (`live-paired-devices-list.test.tsx:423`), which is unchanged. `grep` finds `ur-stub` and
`pd-stub` only in the two docblocks that record the rename.

Run: `src/test/live-shell-admin.test.tsx`, `src/test/live-users-roles-`, `src/test/live-paired-devices-`, `src/features/users-roles`,
`src/features/paired-devices` → **9 files / 162 tests passed** (`assets/08b_w1_item3_affected.log`). Typecheck exit 0.

**In-memory proofs**, where a dispose throws injected into the last Live test before the static block (`:631`):

| Id | What | Result |
|---|---|---|
| Q01 | The throwing dispose with the new clean-up | **1 failed / 39 passed**: that test only |
| Q02 | The same with the old clean-up put back in memory | **4 failed / 36 passed**: the failure cascades into the three static tests that build no bed, which is F81-2's cascade |
| Q03 | The Users & Roles body back to `ur-stub` | W54's `/admin/users` row red |
| Q04 | The Paired Devices body back to `pd-stub` | W54's `/admin/devices` row red |

The first Q01/Q02 run (02:53) injected the throw into the `/admin/users` route test. The next test builds its own bed, so no
cascade could show there. It was re-run at 02:54 in the right place, and both runs are in the log.

## 5. Item 4: Users & Roles reads after a sign-out (D176, F75-2)

**Result: compliant; no code changed.**

| Read | Where | `enabled` |
|---|---|---|
| 11 `listUsers` | `features/users-roles/queries.ts:69-87` | `useReadAllowed()` (`:62-67`) = Live and `useCorePermission(Permission.USER_ADMIN)` and the link up |
| 10 `getRoleMatrix` | `queries.ts:89-107` | the same |

`useCorePermission` is `liveOf(sim)?.session?.permissions.includes(permission) ?? false`
(`packages/shared/src/live/mode.ts:90-92`). It is false the moment the session is null, in the same store update in which the
bridge removes both entries. The page's commands (`commands.ts:140`, `:168`) only `invalidateQueries`, which respects
`enabled`. No other read exists in the folder; `grep client.call|refetch|invalidateQueries|fetchQuery|useQuery` was run over it.

**Proof (in memory).** Two tests were injected into `test/live-users-roles-page.test.tsx` on W81's model, counting reads from
**before** the sign-out:
1. A sign-out from this console (`page.live.actions.signOut('USER')`).
2. The Core ending the session (`bed.core.end('SIGNED_OUT')`).

In both: no further `listUsers` / `getRoleMatrix` request after `/login` and 5 s on the Live clock, and no 401 answer.

| Id | What | Result |
|---|---|---|
| U00 (control) | The two tests on the tree as it is | **green, 21 / 21** |
| U01 | `useReadAllowed` without the permission term (the F75-2 shape) | **red**: reads go 1 → 2 in both injected tests. W77's three existing "entries removed" tests also go red, because a re-read refills the removed entries. The tree already guards this shape on this page |

Observation (no change; for W92): the Retry buttons call `query.refetch()`, which bypasses `enabled`. This is in
`users-roles/index.tsx:127,130`, `paired-devices/devices-panel.tsx:62-64` (through `useRetryCooldown`) and
`security-audit/rbac-panel.tsx:164`. It can only happen from a press on a page still on screen in a failed state, and the
shell leaves on a sign-out.

## 6. Item 5: what is left outside the shared helpers (read-only, for W92)

Method:
- `grep` over production files of `features/**` (not `__tests__`) for busy and pending state, ref guards, early-return
  guards, reveal timers and spinner constants, direct `sink.report(`, `console.*`, and correlation-ID makers.
- A script (`assets/08b_w1_effects_scan.py.txt`) that lists every `useEffect`/`useLayoutEffect`/`useInsertionEffect` callback in
  `features/**` with the functions it calls (comments and strings blanked). It covers W0's blind spots: local functions,
  callback props, module functions that receive a client or a store.
- Every non-trivial hit was read.

### 6.1 Pending guards outside `usePendingControl`

| # | Where | What | Note |
|---|---|---|---|
| 1 | `session-new/index.tsx:183-184` (`createInFlight`), `:171` (`creating` state), `:264-294` (`createAndCheck`), `:551-556` (spinner) | Step 1 → 2 ("Next" / create + pre-check): its own ref guard and state; the spinner and "Creating…" show **from the press**, after a 300 ms beat (`CREATE_BEAT_MS`, `model.ts:22`) | Not in W0's list; it predates W0. It works like A9's DV-2 (the old duration is the minimum). Keep with a note, or move to the hook's `busy` with a minimum |
| 2 | `security-audit/chain-panel.tsx:84` (`verifying` state), `:107-129` (`verify`), `:26` `VERIFY_SPINNER_MS = 480` | Verify chain: its own state guard (`if (verifying) return`); the spinner first, then the request after 480 ms | The same pattern as A9 (`session-monitor/integrity-panel.tsx:75`), which D154 DN-4 sanctioned for A9 only. The guard is state, not a ref: it is safe because React flushes a click's update before the next discrete event. A ruling like DN-4, or the hook |
| 3 | `evidence/use-verification.ts:205` (`running` ref), `:236-237` | The verification run (multi-step choreography): its own ref guard | W69's; a phase machine more than a press guard. Keep, with a note |
| 4 | `login/use-login-controller.ts:156-161` (`pending` + `pendingRef`), `:324`, `:357` | Sign-in submit and security key: their own pending state, with the spinner from the press | The Login page was outside W0's seven folders. Sign-in is the one command before a session; its own contract (M-C-22). A ruling |
| — | `devices/index.tsx:86-145` (keyed `inFlight` set, `usePendingReveal`) | One command per device at once | **Sanctioned** (W0 DC-3) |
| — | `session-monitor/integrity-panel.tsx:75` | A9 | **Sanctioned** (D154 DN-4) |

### 6.2 Reveal timers

**None.** `LIVE_PENDING_REVEAL_MS` appears only in comments. Every `setTimeout(() => setX(true|false), …)` in `features/**` is
an entrance or animation timer:
- `storage/choreography.ts:94,117`
- `dashboard/dashboard-motion.ts:89`
- `security-audit/chain-panel.tsx:102`
- `session-monitor/action-bar.tsx:606` (hint)
- `session-monitor/storage-panel.tsx:37`
- `login/auth-card.tsx:149`
- `devices/health-chart.tsx:51`
- `api-reference/renderer-panel.tsx:48`

### 6.3 Page reporters not on `createPageReporter`

| # | Where | What |
|---|---|---|
| 1 | `evidence/log.ts:24-27` (`newCorrelationId`), `:58` `sink.report` | Hand-rolled sink writer, prefix `evi-<kind>-` |
| 2 | `session-new/log.ts:21-24`, `:55` | The same, `sn-` |
| 3 | `storage/log.ts:22-25`, `:55` | The same, `stor-` |
| 4 | `network-time/log.ts:21-24`, `:36` | The same, `nt-` (W0 item 5 moved it to the sink but not onto the helper, which came later, D165) |
| 5 | `session-monitor/log.ts:20-23`, `:44` | The same, `sm-<source>-` |
| 6 | `login/report.ts:34-37`, `:84` (`recordLoginIssue`), and `:57-69` `reportLoginIssue` (dev-build `console.*` of a whole entry) | The Login page's two writers |
| 7 | **`devices/motion.ts:82-92` `logDevicesError`**, called by `devices/panel.tsx:93` (the panel ErrorBoundary) | **`console.error` with `error.message` and `error.stack`**, dev only. The Devices page already binds `createPageReporter('dev')` (`devices/report.ts:11`), so this is the one leftover of the kind W0 item 5 removed from Network & Time |
| 8 | `api-reference/log.ts:9-25` `logApiReference` | `console.*` with `error.message` and `stack`, dev only (predecessor design; the API Reference page is a developer page) |

The six pages that bind the helper:

| Page | Binding |
|---|---|
| Dashboard | `dashboard/report.ts:11` |
| Devices | `devices/report.ts:11` |
| Security & Audit | `security-audit/log.ts:18` |
| System | `system/log.ts:16` |
| Users & Roles | `users-roles/report.ts:12` |
| Paired Devices | `paired-devices/report.ts:13` |

### 6.4 Effect-started commands outside `deferEffectStart`

**None new.** Every effect that names a Core call returns the helper: `session-new/index.tsx:230`, `evidence/detail-page.tsx:109`,
`evidence/export-wizard.tsx:623`, `system/sim-adapter.ts:131` and `paired-devices/devices-panel.tsx:53`. The last one refreshes
the paired list on a tablet change. The one remaining `ALLOWED` exception is `devices/device-drawer.tsx:394`.

Subtle forms the static guard cannot see, each read:

| Where | What it calls | Verdict |
|---|---|---|
| `session-new/index.tsx:380` | `startNow()` | Never at mount; W0 §2.3 |
| `paired-devices/code-display.tsx:37` | the prop `onRevealed()` → `markRevealed(queryClient, …)` | Writes local memory only (`code-memory.ts:125`; no fetch, invalidate or refetch in that module) |
| `paired-devices/issue-panel.tsx:77,92` | `codeEnded`, `codeReplaced`, `clearOutcome` | Local memory only |
| `evidence/export-wizard.tsx:625` | `onState` | The parent's state |
| `login/use-login-controller.ts:370` | A store subscription → `accept` → `onAccepted` → `router.preloadRoute` | No Core command |

One observation outside the rule's scope: `api-reference/use-realtime-feed.ts:150-158` opens its heartbeat socket
(`client.start()`) in the effect's set-up. Under StrictMode a dev build opens, closes and reopens that socket. It is a
connection, not a command, and it predates this task.

## 7. Verification (`assets/08b_w1_final_gate.log`)

```
## 2026-10-06 02:59:22 WIB   2:59  2 users, load averages: 1.20 1.96 2.41
## $ npm run test -w @dems/core-web -- --maxWorkers=2
 Test Files  93 passed (93)
      Tests  1244 passed (1244)
exit=0
## 03:01:32 $ npm run typecheck -w @dems/core-web
> tsc -b
exit=0
## 03:01:41 $ npm run lint -w @dems/core-web
> oxlint
exit=0
## protected test files (sha256 recorded 02:28:59 before any edit)
  apps/core-web/src/test/routes.test.tsx: OK
  apps/core-web/src/test/sim-fetch.test.ts: OK
  apps/core-web/src/features/storage/__tests__/storage-page.test.tsx: OK
  apps/core-web/src/lib/__tests__/core-endpoint.test.tsx: OK
  apps/core-web/src/lib/__tests__/packaged-csp.test.ts: OK
  apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx: OK
## files of apps/core-web/src, packages/shared/src, apps/core-server/src modified since 02:28:59
apps/core-web/src/features/paired-devices/index.tsx
apps/core-web/src/features/security-audit/export-audit-dialog.tsx
apps/core-web/src/features/security-audit/export-file.ts
apps/core-web/src/features/system/export-logs-dialog.tsx
apps/core-web/src/features/system/live-log-export.ts
apps/core-web/src/features/users-roles/index.tsx
apps/core-web/src/lib/core-page-walk.ts
apps/core-web/src/test/live-shell-admin.test.tsx
apps/core-web/src/test/live-strict-mode-starts.test.tsx
```

Notes on the gate:
- The 1-minute load was below 10 before every whole-suite and batch run (1.20–2.64).
- `git status --porcelain` over `runtime/**`, `components/**`, `routes/**`, `vite.config.ts`, `main.tsx`, the other `lib/` files
  and `packages/shared/src` lists only changes that existed before this round (the uncommitted rows W0 to W81). The
  `find -newer` list above shows W1 wrote none of them.
- Nothing was written under `apps/mobile/**`, `apps/core-server/**` or `packages/shared/**`.
- No lane check, no Docker, no git write.
- No secret appears in any asset: they were scanned for the password words.

Mutation and proof runs:

| Batch | Time | Result |
|---|---|---|
| Item 1 | 02:31 | 3 detected + 1 control green |
| Item 2, page skipped and signed in | 02:41–02:44 | 12 detected (including the control's batch), 1 survived (S03) |
| Item 2, partial file and the page's parts | 02:45–02:48 | 10 detected, 5 survived |
| Survivors against the out-of-tree proof | 02:50 | 6 of 6 detected |
| Item 3 | 02:53 and 02:54 | as §4 |
| Item 4 | 02:55 | 1 detected + 1 control green |

- Every batch ends with "the mutated files (and watched files) in the tree, before and after: identical".
- One batch at 02:50:39 stopped at its baseline because the proof file asked for the `node` environment, and the app's setup
  file needs `window`. The directive was removed, and the batch was re-run at 02:50:49.

## 8. Decisions for the controller

| # | Decision | Recommendation |
|---|---|---|
| DC-1 | **Write-set reading of item 2.** "The two pages' export files" was read as each page's export modules: `security-audit/export-file.ts` **and** `export-audit-dialog.tsx` (the brief's "export-file.ts and friends"), and `system/live-log-export.ts` **and** `export-logs-dialog.tsx`. The reason is that the walker must own the D176 check (the brief's mutation class "the signed-in check removed" is over the walker), and that needs the session predicate at the dialogs' call sites. The dialog edits are W75's one call (`:154-160`) and W76's readers, two calls and one import (`:72-103`). The diff is in `08b_w1_changes.diff.txt` | Ratify. To undo only the dialogs, see §9 |
| DC-2 | **W75 gains two guards** from the shared walk. (1) D176: no page of 59 after a sign-out; before, one more request was answered 401. (2) An endless list ends in `ENDLESS_LIST`, never a partial file; before, a 10,000-page walk without a known count returned the rows it had read. The presenter path is unchanged (`SIGNED_OUT_PAGE` carries `transport: null`), and nothing changes for an operator | Ratify |
| DC-3 | **Grant one new test file and one test**, so the tree itself kills what only proofs kill now. The file is `apps/core-web/src/lib/__tests__/core-page-walk.test.ts`, the 10 tests of `08b_w1_walker_proof.test.ts.txt`; it kills S03, F05, F06, F08, F09 and F11. The test is the W75 D176 case in `test/live-security-audit-export.test.tsx` (the injected text is in the runner, `SA_PROOF`); it kills S04, S05 and S07 | Grant before W92, or fold into W83/W88 |
| DC-4 | Item 3: the IDs are `users-roles-page` / `paired-devices-page`, and W54's parameter is now `bodyId` (part of change (b)) | Ratify |
| DC-5 | Item 4: compliant, no code. The Retry `refetch()` bypasses `enabled` on three pages (§5) | Note for W92 |
| DC-6 | Item 5's list (§6), in particular `devices/motion.ts:82` (console with message and stack beside the page's own reporter) and the two spinner-first verifies (#1, #2 of §6.1) | To W92; a closing fix row if wanted |
| DC-7 | Ledger: `@dems/core-web` stays **93 / 1,244** (no test file added in the tree) | No change |

Observation, not this round's to fix: the two download helpers are near copies, `security-audit/export-file.ts:107`
`downloadAuditFile` and `system/live-log-export.ts:149` `downloadJson` (the second tolerates a missing `revokeObjectURL`).
They are a candidate for `lib/` with the walker.

Deviation: the brief says never to `cd`. The first baseline command of the session used a subshell `(cd <repo> && shasum …)`.
It was read-only apart from writing the hash file under `.cache/w1/`. Every later command used absolute paths or `git -C`.

## 9. Rollback (not executed)

1. Copy each pre-image back from the repository root. There are 8, under `.cache/rollback/W1/apps/core-web/src/`:
   - `test/live-strict-mode-starts.test.tsx`
   - `test/live-shell-admin.test.tsx`
   - `features/security-audit/export-file.ts`
   - `features/security-audit/export-audit-dialog.tsx`
   - `features/system/live-log-export.ts`
   - `features/system/export-logs-dialog.tsx`
   - `features/users-roles/index.tsx`
   - `features/paired-devices/index.tsx`

   Use `cp -p .cache/rollback/W1/<path> <path>` for each.
2. Delete the one created file, `apps/core-web/src/lib/core-page-walk.ts`.
3. Re-run `npm run test -w @dems/core-web -- --maxWorkers=2` (expected 93 / 1,244), then typecheck and lint.

To undo item 2 alone, restore the four item 2 files and delete the walker. To undo only DC-1's dialog edits, item 2 must be
undone as a whole: the adapters' new `options` argument needs the dialogs.

## 10. Files

**Created (1)**: `apps/core-web/src/lib/core-page-walk.ts`.

**Updated (8)**:
- `apps/core-web/src/test/live-strict-mode-starts.test.tsx` (item 1)
- `apps/core-web/src/features/security-audit/export-file.ts`, `export-audit-dialog.tsx` (item 2)
- `apps/core-web/src/features/system/live-log-export.ts`, `export-logs-dialog.tsx` (item 2)
- `apps/core-web/src/test/live-shell-admin.test.tsx` (item 3, the two granted changes)
- `apps/core-web/src/features/users-roles/index.tsx`, `apps/core-web/src/features/paired-devices/index.tsx` (item 3, the test IDs and
  their docblocks)

**Documents**: this file; `assets/08b_w1_*` (10 files); `delegation_progress/coder_execution_w1.md`.

**Scratch, outside the tree**:
- `.cache/w1/`: the mutation config, proof config, runner, `mutations.json`, outputs, the walker proof, the effects scan and
  logs.
- `.cache/rollback/W1/`: the 8 pre-images.

## 11. Follow-up: the walker's tests in the tree (decision D182)

The controller passed W1 (D182) and accepted DC-1 and DC-2. **DC-3 was granted**, and this follow-up ran from 03:08 to 03:21 WIB.
Assets: `assets/08b_w1b_gate.log` (the gate) and `assets/08b_w1_mutations.log` (re-copied; the follow-up batches are the
03:10 and 03:14 ones). The runner `assets/08b_w1_mutation_runner.py.txt` was re-copied and holds the `T…` set. No existing
test file was edited, W75's three test files included. The new files need no pre-images.

| File (new) | What |
|---|---|
| `apps/core-web/src/lib/__tests__/core-page-walk.test.ts` (133 lines, 10 tests) | The 10 walker cases of `08b_w1_walker_proof.test.ts.txt`. The header now has the case table. One change was needed for the typecheck: the parameter property of the test's `PageError` became a field, because `erasableSyntaxOnly` refuses `constructor(readonly …)`. The out-of-tree copy only ever ran under Vitest |
| `apps/core-web/src/test/live-security-audit-signout.test.tsx` (163 lines, 1 test) | The W75 sign-out case, in its own file as ruled. It uses W75's bed (`live-security-audit-bed`) and its own copy of the Core of W75's export test (`coreWith`, 450 stored rows, a ring of 200). Page 1 is held, the Core ends the session, then page 1 is released. Checked: 1 request of 59 and none answered 401, no file, no "file failed" toast, no `ExportAuditDialog.buildFile` record. The clean-up clears `bed` before `dispose()` (§4's rule) |

**The walker mutation set against the tree** has 28 mutants, ids `T` + the mutant ids of §3.5.
- Each carries **only its production edit, with no injected test**. The runs are over `live-security-audit-export`,
  `live-system-export`, the new `live-security-audit-signout` and the new `core-page-walk` (baseline: 4 files / 34 tests green).
- Some labels in the log are inherited from §3.5 and still say "with the W75 proof injected". In these `T` runs that text
  is only a label: `edits` holds the production edit alone.

```
## 2026-10-06 03:10:30 WIB batch ['TK01', … 'TS07']
baseline (no mutation) … exit 0 Test Files  4 passed (4) | Tests  34 passed (34)
## 2026-10-06 03:14:01 WIB 13 mutations: 13 detected, 0 survived []
## the mutated files (and watched files) in the tree, before and after: identical
## 2026-10-06 03:14:20 WIB batch ['TF01', … 'TP13']
## 2026-10-06 03:18:12 WIB 15 mutations: 15 detected, 0 survived []
## the mutated files (and watched files) in the tree, before and after: identical
```

**28 of 28 are now detected by the tree's own tests.** The 9 that only the out-of-tree or injected tests caught before:

| Mutant | First failing test |
|---|---|
| TS03, the check after the request | `core-page-walk` "a walk that starts signed out" |
| TS04, the check removed | `core-page-walk`, plus W76's D176 test and the new sign-out test |
| TS05, W75's call site always signed in | `live-security-audit-signout` |
| TS07, `SIGNED_OUT_PAGE` without `transport` | `live-security-audit-signout`, whose page shows "file failed" and writes a record |
| TF05, the count check | `core-page-walk` "the count check" |
| TF06, the sequence check | `core-page-walk` "the sequence check" |
| TF08, an endless audit list | `core-page-walk` "a server that never stops" |
| TF09, an endless events list | `core-page-walk` "a server that never stops" |
| TF11, no stop before the export's row when the count is unknown | `core-page-walk` "without a known count" |

**Gate** (`assets/08b_w1b_gate.log`):

```
## 2026-10-06 03:18 WIB  load averages: 2.00 2.18 2.30
## $ npm run test -w @dems/core-web -- --maxWorkers=2
 Test Files  95 passed (95)
      Tests  1255 passed (1255)
exit=0
## 03:20:32 $ npm run typecheck -w @dems/core-web
exit=0
## 03:20:42 $ npm run lint -w @dems/core-web
exit=0
## protected test files (sha256 recorded 02:28:59 before any edit): all six OK
## files of apps/core-web/src, packages/shared/src, apps/core-server/src modified since the W1 report (03:05)
apps/core-web/src/lib/__tests__/core-page-walk.test.ts
apps/core-web/src/test/live-security-audit-signout.test.tsx
```

**Ledger**: `@dems/core-web` goes from 93 / 1,244 to **95 / 1,255** (+2 files, +11 tests).

**Rollback of the follow-up**: delete the two new test files. The suite then returns to 93 / 1,244.

**Files of the follow-up**: created `apps/core-web/src/lib/__tests__/core-page-walk.test.ts` and
`apps/core-web/src/test/live-security-audit-signout.test.tsx`. Updated: this document (§11 appended),
`delegation_progress/coder_execution_w1.md`, `assets/08b_w1_mutations.log`, `assets/08b_w1_mutation_runner.py.txt`; new
`assets/08b_w1b_gate.log`.
