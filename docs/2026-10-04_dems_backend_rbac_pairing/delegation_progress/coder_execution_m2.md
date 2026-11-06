# coder-execution — row M2 (closing mobile consolidation; D164 DN-2, D175 DN-4)

Report: `gateway_check/09c_m2_mobile_closing.md` (written at the end).

| Time (WIB) | Step | Status | Notes |
|---|---|---|---|
| 02:15 | Read 09a (M0), 09b (M1 + follow-ups), W68 / W73 reports, both callers, the chip, the two static tests | done | |
| 02:19 | Pre-images + SHA-256 of the 7 files this row may edit: `.cache/rollback/M2/` (`pre.sha256`); 61 test files of runtime, session-live, session-recovery, more, dashboard, navigation hashed (`.cache/m2/tests-pre.sha256`); baseline list copied from M1 (`.cache/m2/baseline72.txt`) | done | load 3.17 |
| 02:20–02:27 | Item 1: one read-only helper in `@/runtime` | done | The two copies were byte-identical except the name. New `runtime/use-core-link-read-only.ts` (`useCoreLinkReadOnly`), barrel export + one surface row; monitor screen, monitor actions and recovery actions call it; both local functions removed. W73's gated static test `recovery-live-static.test.ts:126`, `:129` pinned the rule's body inside `use-recovery.ts` (its DN-6 compensation for survivor U6) — changed by design to the one-call form: **DN-1, beyond the brief's import-line grant**. New test 14. typecheck exit 0; 14 suites / 195 tests exit 0 (02:24); eslint on the 7 files exit 0; 60 of 61 hashed test files unchanged (the one: the DN-1 pin) |
| 02:25–02:26 | Item 2: W66's chip to `useCoreLinkNotice()` | done | `use-core-link-chip.ts` takes `const { offline } = useCoreLinkNotice();` (11 code lines → 1); W66's pin `home-more-live-static.test.ts:135-136` → `:135` one-call regex (granted). typecheck exit 0; 14 suites / 136 tests exit 0; eslint exit 0 |
| 02:27–02:36 | Item 3: read-only sweep of `features/**` | done | 208 production files; 112 + 128 candidate lines read (`.cache/m2/item3_sweep_raw.txt`). Findings: Login chip / ring / dust from the two-valued `coreLink.state` (and two dead STALE branches); Login's Alert and Pair's notice on the runtime rule but not `useCoreLinkNotice()` (known: M0 DN-4, M1 DN-3); `isCoreBlocked`; the tablet link read from the replica (Devices, Network & Time); the Start Session CORE precheck hint; the Stack Check proof screen (raw heartbeat, health failure). No code changed |
| 02:29–02:31 | Final gate | done | load 2.32; whole suite **139 / 1,709 exit 0** (ledger 138 / 1,695 + 1 / 14); typecheck exit 0; lint exit 0, eslint JSON 534 files 0 / 0; baseline 72 vs acaff20: 0; W60 navigation vs b90a3c6: 0; 59 of 61 hashed test files unchanged (the two by-design pins); only this row's 9 files changed since 02:19; no red file |
| 02:32–02:36 | Mutation run (M15, in memory) | done | control 139 / 139; R 9 / 9 (R1 = W73's U6 now caught by behaviour twice); C 4 / 5 (C1 survives: a gap in W68's tests that predates this row, DN-5); K 3 / 3; total 16 / 17; mutated files identical before and after |
| 02:36–02:40 | Report `gateway_check/09c_m2_mobile_closing.md` + 8 assets `assets/09c_m2_*` | done | Status **needs-review** (DN-1: W73's static pin changed beyond the import-line grant) |

## Follow-up: Login's link visuals (decision D180)

Controller gate D180: M2 PASS (DN-1, DN-2, DN-3 ratified; DN-5 → W87; DN-6 → W93). Granted: L-1 and L-2, with this row as the follow-up writer of `features/login/**`.

| Time (WIB) | Step | Status | Notes |
|---|---|---|---|
| 02:44 | Read login model, screen, card, controller, copy, W59's and step 75's tests | done | `login-model.test.ts` and `login.test.tsx` are baseline files; L-2 is pinned at `login-model.test.ts:46`, `:53` with a hand-built `HEARTBEAT/ONLINE/STALE` link |
| 02:46 | Pre-images + SHA-256 of 6 login files in `.cache/rollback/M2b/`; 28 test files of `features/login` and `runtime` hashed (`.cache/m2b/tests-pre.sha256`) | done | load 2.08 |
| 02:47–02:51 | L-1: `liveCoreLookOf` + LIVE branch in `ringStateFor` / `coreChipFor`; controller `coreLook` from `useCoreLinkNotice()`; screen ring and dust; card chip and icon; key `coreChip.SETTLING` | done | Existing login tests 6 suites / 84, exit 0, unchanged (no pin change needed). typecheck 0; eslint login folder 0 |
| 02:48–02:52 | New test `live-login-link-visuals.test.tsx` (12) | done | Red before: 5 fail with the old LIVE logic in memory (cold start, loops); green after 12 / 12 |
| — | L-2 | done (kept) | Dead in every mode (proof + test); not removed because baseline `login-model.test.ts:46`, `:53` pin it (DN-F2) |
| 02:52–02:54 | Mutation run (M15, in memory) | done | control 58 / 58; V 12 / 12, W 6 / 6 = **18 / 18**; files identical before and after |
| 02:54–02:57 | Final gate | done | Whole suite **140 / 1,721 exit 0** (139 / 1,709 + 1 / 12); typecheck 0; lint 0, eslint JSON 535 files 0 / 0; baseline 72: 0; W60: 0; 28 / 28 hashed tests unchanged; footprint 6 files; login folder + guards 7 suites / 89 exit 0 (02:56:45) |
| 02:57–02:58 | Report section "Follow-up: Login's link visuals (decision D180)" in `gateway_check/09c_m2_mobile_closing.md`; 5 assets `09c_m2b_*` | done | Status **complete**; decisions DN-F1 (notice plus view, not the bare view), DN-F2 (L-2 kept), DN-F3 (new LIVE-only key) |
