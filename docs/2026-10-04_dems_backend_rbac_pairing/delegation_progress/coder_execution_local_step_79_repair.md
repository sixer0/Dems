---
task_slug: dems_backend_rbac_pairing
step: 79
plan_row: W57
agent: coder-execution-local
date: 2026-10-05
status: evidence-complete
subject: step-79 (W57) EVIDENCE and DOCUMENTATION repair — gate blockers closed
decision_ref: D135 (verifier report gateway_check/06a_w54_w57_gate_evidence.md, claims 20 and 21)
mode: read-only on the tree; no source file written; no device session run
---

# Step 79 (W57): evidence & documentation repair — progress (coder-execution-local)

## Status

**Evidence-complete.** The two named missing assets are re-created and the five unfilled result
cells are filled with **fresh runs performed now**. No source file under `apps/**` or `packages/**`
was written. No device session was run; the only device action was the permitted read-only
`emulator-user-lock.sh status tablet`. The lane database was not touched.

This file repairs the documentation/evidence gaps the read-only verifier named in
`gateway_check/06a_w54_w57_gate_evidence.md` (claims 20 and 21). The code and its tests were already
confirmed by that verifier (6 suites / 66 tests; the four new Live files; the granted line of
`home-screen.tsx:217`; the two existing pairing test files blob-equal to `acaff20`; mutation run 27
of 27 detected). Nothing here re-judges the code.

## Files written (exactly the authorised paths)

| Path | Action |
|---|---|
| `implementation/57_mobile_pairing_flow.md` | **append only** — the five placeholder cells filled (`@@MUT_SUMMARY@@` :41, `@@GATE_SUMMARY@@` :42, `@@RUN2@@` :345, `@@GATE_BODY@@` :358, `@@GENERATED@@` ×2 footer). Earlier sections §1–§13 otherwise unchanged. |
| `implementation/assets/57_gate_final.log` | **created** — the final-gate run output (curated summary blocks; secret-scanned clean). |
| `implementation/assets/57_live_tests_verbose.txt` | **created** — verbose run of the four new Live files (ANSI stripped; secret-scanned clean). |
| `delegation_progress/coder_execution_local_step_79_repair.md` | **created** — this file. |

No other file was created or changed. `status_tasks.md`, `delegation_progress_report.md`,
`decisions/decisions.md`, `masterplan/**`, and every other row's document were left untouched.

## Fresh runs (performed now, 2026-10-05 WIB; Node v26.8.2, npm 11.19.1; one workspace at a time, `--maxWorkers=2`; load average before the runs 3.88 — P9 guard not fired)

| Command | Result | Runner time | Wall clock |
|---|---|--:|---|
| `npm run test -w @dems/mobile -- --maxWorkers=2` (whole workspace) | **92 suites / 1,207 tests / 0 failed / exit 0** | 58.65 s | 11:36:56–11:37:55 |
| `npm run test -w @dems/mobile -- src/features/pairing --maxWorkers=2` (the folder's six suites) | **6 suites / 66 tests / 0 failed / exit 0** | 14.004 s | 11:35:43–11:35:58 |
| four new Live files, `--verbose` | **4 suites / 51 tests / exit 0** | 13.901 s | 11:36:24–11:36:38 |
| `npm run typecheck -w @dems/mobile` | **exit 0** (`tsc --noEmit`, no output) | — | 11:38:37 |
| `npm run lint -w @dems/mobile` | **exit 0** (`eslint .`, no finding) | — | 11:38:42–11:38:54 |

Per-file pairing counts (fresh `--json` run, 0 failed): `pairing-screen.test.tsx` 8 ·
`pairing-model.test.ts` 7 · `stack-check-service-name.test.tsx` 2 · `pairing-live-model.test.ts` 12 ·
`pairing-live-static.test.ts` 10 · `pairing-live.test.tsx` 27. Four new files = 51; two existing
(unchanged, blob-equal to `acaff20`) = 15. **The row's claim "the folder: 6 suites, 66 tests" is exact.**

### Ledger / P11 attribution of the whole-workspace number

The whole-workspace figure (92 / 1,207) is **above** the read-only verifier's 10:09 snapshot
(90 / 1,187) by **+2 suites / +20 tests**. That delta is entirely W59's `apps/mobile/src/features/login/**`:
`live-login.test.tsx` (born 10:14:33, i.e. *after* the verifier's A.2 run started) and
`login-live-model.test.ts` were created since. All four login suites are green under jest (jest does
not typecheck). The pairing folder contributes **exactly 6 suites** inside the whole run (verified by
grep of the run log). W57's own share is therefore the pairing folder's 6 / 66 plus the one granted
line of `home-screen.tsx`, pinned by `stack-check-service-name.test.tsx` inside that folder. Zero
failures anywhere in the workspace.

## Finding (for the record) — the verifier's reds vs my fresh numbers

The verifier saw `@dems/mobile` **typecheck exit 2** and **lint exit 1** at 10:14–10:15, with every
error inside `apps/mobile/src/features/login/**` (W59, D133) — another row's folder, mid-edit at that
moment (protocol P11). Those errors named no file under `features/pairing` and not the granted line of
`home-screen.tsx`. **My fresh run at 11:38 sees both exit 0**: W59 has since edited those files
(`live-login.test.tsx` mtime 10:27:02, `use-login-controller.ts` mtime 10:26:29) and they now typecheck
and lint clean. The earlier reds were transient W59 noise, not W57's. Whoever gates W57 must not read
them as W57's; whoever gates W59 owned them and they are resolved on the current tree.

## Assets — list and integrity

Two assets named at `57_mobile_pairing_flow.md:611` and §4.6 were absent (verifier claim 20); both are
now present with the **exact names the document uses**, so nothing dangles. The document's §13 asset
list was NOT renamed — the files match it. Total `57_*` assets: **30** (was 28).

| Asset | Content | Secret scan |
|---|---|---|
| `57_gate_final.log` | Curated final-gate block: the four commands' summary lines, exit codes, timestamps, the per-file pairing breakdown, and the P11 attribution note. The raw 8 MB whole-workspace stdout (which carries other rows' login/auth console noise) was deliberately **not** copied in. | 0 password / 0 pairing-code / 0 credential-prefix / 0 bearer / 0 cookie |
| `57_live_tests_verbose.txt` | Full `--verbose` runner output of the four new Live files (4 suites / 51 tests / exit 0), ANSI stripped. Body (excluding the `##` header) scanned: 0 secret-shape matches, 0 six-digit runs. The marker code is assembled in-file and never printed. | 0 (body) |

No pairing code, credential or token appears in any log or document written here. A code typed on a
device is written nowhere.

## Device facts for the controller's ruling on DN-6 (read-only only)

- **Tablet lock — unchanged.** `bash apps/mobile/scripts/emulator-user-lock.sh status tablet` (the
  script's read-only action) returned, at 11:xx today:
  `tablet (emulator-5556): AVD dems2_tablet, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable`
  — line-for-line equal to D125 and to the verifier's G.1. `adb devices` showed emulator-5554/5556/5558 attached.
- **What this row left (the row's own note, §8):** `dems2_tablet` is **paired with the lane 2 Core as
  `DEV-0001`** (device name `sdk_gphone64_arm64`, platform `android`, app `0.1.0`); the device
  credential is in the app's secure store, entry name `key_v1-dems.live.device.v1` (value never read);
  the app's Core link source is **SIMULATED** (D124 ruling 6) — a row that needs the paired tablet
  launches with `core=LIVE`; app stopped; landscape `2560x1600`.
- **`dems_lane_2` must keep its pairing tables:** per the row's §8, `paired_devices 1`,
  `device_credentials 1`, `pairing_codes 1` (the redeemed code), `biometric_tokens 0`, `audit_log 95`.
  Independently re-measured read-only by the verifier's `db:status` (report G.4) at identical counts.
  `db:reset` keeps these tables by design ([DB:§8.5 R-5]); dropping them is a controller decision.
- **What I did NOT do:** I did not touch the keyguard, the fingerprint sensor, the app's stored
  credential, or the lane database; I ran no device session (the lane-1 phone is in use by another
  row's check today). The only device command was the permitted read-only `status tablet`.
- **Action requested of the controller (not mine to take):** put the sentence "do not drop
  `paired_devices` / `device_credentials` on `dems_lane_2`" into the briefs of the later rows that use
  the tablet (verifier §I item 7).

## Decision sheet — PREPARED, NOT DECIDED (DN-1 … DN-8)

These are the controller's to rule (D135). Costs are stated exactly; nothing here is executed.

| ID | Subject | Option / one-line change | Exact cost | What it would break |
|---|---|---|---|---|
| **DN-1** | F-1: after a landscape→portrait turn while the Pair screen is open, the connection pane squeezes to **144 dp** (clipped). Predecessor's defect — visible in **Simulated mode on `acaff20` code**; this row changed no layout line. Cold-start portrait (364/364 dp) and portrait→landscape are fine. | **A:** accept as KI-01's recorded state. **B:** one line in `features/pairing/**` — give the code pane a React key per sizing mode at `pairing-screen.tsx:143` so the pane remounts at the class change (typed code survives: it lives in the controller). **C:** the layout-kit owner makes `Pane` drop a fixed width cleanly in `apps/mobile/src/layout/pane-layout.tsx` (outside this row). | A: zero code. B: **exactly one line in `features/pairing/**` PLUS a repeat of the tablet layout session** (session 2). C: one line in `layout/pane-layout.tsx`, covers every two-pane screen; whether other screens show the same after a turn was not examined. | B changes a **Simulated** layout after a turn, which plan §17 KI-01 ("no Simulated layout changes") forbids this row absent this ruling. **DF-8 makes the tablet layout check itself deferrable** ("A phone check only → KI-01 stays fully open"), so the geometry item can be deferred rather than fixed. Note: **D124 already moved the Pair-chip-label item into this row and it is DONE** (first item (a)); DN-1 is only the turn-clipping geometry, not the label. |
| **DN-2** | DV-1 / F-2: no Core address in the unpaired identity list (shows "This computer, through adb reverse"). | Export one accessor from `apps/mobile/src/runtime/sim-adapters.ts` returning host+port of the device-side address; read it in `pairing-connection.tsx`. | One line in `runtime/sim-adapters.ts` (**W51's file, not this row's write path** → needs a grant) + a read here. | Functionally none if the literal stays in `sim-adapters.ts`; but `runtime/live-no-raw-fetch.test.tsx` rule 2 allows the address/constants in **one file only**, so the accessor must keep the literal there. Cross-row grant required. |
| **DN-3** | DV-2 / F-3: the granted line prints the service name **without** the `dems-` prefix ("core-server", "mock-core"). | Print `health.data.service` raw (with the `dems-` prefix). | One line (`home-screen.tsx:217`). | Turns **W51's** `runtime/live-health.test.tsx:235` red — it matches the whole string "mock-core v0.1.0 · api v1" in Simulated mode; the raw name is "dems-mock-core". Would require editing W51's test too. Recommendation in the row: accept. |
| **DN-4** | DV-3: the 429-on-redeem wording ("The Core server is limiting requests. The code was not checked and no attempt was counted."). | Replace the sentence (copy only). | One copy string. | Nothing functional; it differs from the presenter's toast **on purpose** (it states what a 429 does NOT mean). Accept, or supply the sentence. |
| **DN-5** | DV-4: the three gate-notice titles ("Pairing revoked", "Tablet not registered", "Tablet unpaired"). | Remove or supply titles (copy only). | Three copy strings. | Nothing functional (the kit Alert has title+body). Accept, or supply titles. |
| **DN-6** | Tablet paired with lane 2 as `DEV-0001`; `dems_lane_2` must keep its pairing tables. | Not a code change — a briefing instruction. | Put "do not drop `paired_devices` / `device_credentials`" into the later tablet-using briefs. | Nothing; `db:reset` keeps them by design ([DB:§8.5 R-5]). Facts above. |
| **DN-7** | The W60 seams (report §9). | Not a code change — route them into W60's brief. | Copy the §9 seam table into W60's brief. | Nothing; the Pair screen already reads the gate itself (`usePairing()`, `isPairingBlocked()`). |
| **DN-8** | F-4: the typed client's 8 s time-out runs on global timers, so a fake clock cannot drive it in a mobile test. | Pass `timers` to `createCoreClient` (in `packages/shared/src/client/core-client.ts:660` / the mobile adapters `runtime/sim-adapters.ts:387-396`). | One parameter threaded through the client factory — **touches `packages/shared` (no writer) or W51's `sim-adapters.ts`** → contract/owner decision. | Threading `timers` changes a shared signature used by other rows; alternatively accept (this row tests a time-out through the pure model and a lost connection at the screen). For the typed-client / mobile-adapters owner. |

## Flag — `@@LATER@@` in the predecessor's progress file (NOT applied; scope conflict)

Task step 1 asked me to fill `@@LATER@@` at `delegation_progress/coder_execution_step_79.md:44`. That
file is the **predecessor's** (`agent: coder-execution`), not my own progress file. My Documentation
Contract restricts writes to exactly three targets — `implementation/57_mobile_pairing_flow.md`,
`implementation/assets/57_*`, and **my own** `delegation_progress/coder_execution_local_step_79_repair.md`
— and says "write ONLY ... Nothing else". Editing the predecessor's file is outside that allow-list, so
**I did not touch it.** This is non-gating: the verifier's gating claims 20 and 21 concern the
implementation document and the assets (both now closed); `@@LATER@@` is a cosmetic milestone row and
is not among the claims. If the controller wants it filled, the ready-to-paste milestone line is:

```
| 22:04 | Report and the 30 `57_*` assets written; the two existing pairing test files confirmed blob-equal to `acaff20`; the folder at 6 suites / 66 tests; typecheck and lint exit 0. Final self-check: no reverse rule, app not running, nothing listening on 4422 or 8081–8086, tablet in its start pose, lock as the user set it |
```

(The timestamp 22:04 is inferred from the row's last recorded activity — CLG log 22:03:33, mutation
run 2 at 21:58:14, asset mtimes up to 22:03.) Applying it requires either the controller editing that
file or explicitly widening my write scope to it.

## Verification of this repair

- `grep '@@[A-Z0-9_]+@@' implementation/57_mobile_pairing_flow.md` → **none** (all five cells filled).
- Every name in the document's §13 asset list resolves to a file in `assets/` (loop over §13 names →
  no MISSING); `57_*` count = 30.
- Both new assets secret-scanned (counts only): 0 seeded-password literal, 0 pairing-code literal,
  0 credential-prefix (`ses_`/`dvc_`/`bio_`), 0 bearer value, 0 cookie name.
- Read-only git: no `git add`/commit/write performed.

## Next steps (controller)

1. Gate W57 on claims 20 and 21 now closed (assets present; result cells filled with fresh quotable totals).
2. Rule DN-1 … DN-8 (sheet above). DN-1 may be deferred under DF-8 rather than fixed.
3. Optionally authorise the `@@LATER@@` fill in the predecessor's file (content supplied above).
4. Ledger correction (verifier L-4 / §I item 9): W57's new tests are **51 in 4 files**; the whole-workspace
   mobile total now reads 92 / 1,207 (above ledger due to W59's login suites, not W57).
