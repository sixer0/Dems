# CF-M1 — mobile runtime link and transitions (progress)

| Field | Value |
|---|---|
| Row | CF-M1 of the closing-fix round CF (D214) |
| Defects | R-P-1 (High), R-P-2 (Medium) + R-S-2 (Low), R-S-1 (Medium) |
| Agent | coder-execution |
| Time | 2026-10-06 13:36–16:35 WIB |
| Status | **needs-review**. R-P-1, R-P-2 and R-S-2 are fixed, with tests and a final device proof. **R-S-1 is not fixed**: at host load 8–13 revoke-to-Pair took 1.3–2.4 s; at load 5–6 the same code took 0.48–0.78 s |
| Report | `gateway_check/12a_cf_mobile_runtime.md`; assets `gateway_check/assets/12a_*` (40 files) |

## Log

- 13:36 read D203, D205, D208, D211, D213, D214; `test/08b_retest_phone.md`, `test/08d_retest_pairing.md`; the R-P-1 device log; the R-P-2 timer crops.
- 13:50–14:40 reproduction before the fix on dems2_phone (lane 1), with JS stalls injected through Metro's Hermes inspector (a Runtime.evaluate busy loop):
  - 7 of 8 stalls of 3.5 s made the false "Core link lost" / "Resynced" banner;
  - one stall made the timer draw a digit of its mount (03:28 -> 03:23);
  - the R-P-1 crash did not reproduce in 5 attempts (2 of them with the banner on screen at the hand-over; one in full motion).
- 14:41–15:03 revoke timings before the fix on dems2_phone2 (main): signed out 776 / 475 ms, signed in 608 / 584 ms, starvation model 551 ms; 5 hand-offs, no "unreachable" frame.
- 15:05–15:15 fixes:
  - R-P-1: skipExiting boundary around the monitor; banner without `exiting`, in a slot of its own;
  - R-P-2, R-S-2: stall-tolerant timers for the Live source; settling for a socket the client restarts itself;
  - R-P-2 timer: React-drawn timer readout;
  - controller note: per-file jest timeout in `pairing-handoff-routes.test.tsx`.
- 15:15–15:40 R-S-1: an in-place Pair draw at the boot anchor was tried and WITHDRAWN. It measured 1.2–1.5 s (it doubled the synchronous render). The files were restored byte-identical.
- 15:42 fresh relaunch of both phones. Final proof:
  - phone2: 4 revokes and 6 re-pairs (15:44–15:53);
  - lane 1: 12 runs, 11 valid web stops (15:44–16:06). 0 crashes, 0 blank frames, Finalizing every time, 0 banner frames, 0 backward timer steps.
- 16:09–16:26 mutation check: 14 of 15 detected (1 equivalent). Typecheck and lint exit 0. Full suite run 1 had 1 timeout (`pairing-live.test.tsx`; fixed with a per-file timeout); run 2: 170 / 170 suites, 1,894 / 1,894 tests.
- 16:22–16:24 end state: both phones LIVE, signed out on Login; phone2 paired to main as DEV-0019; budi INVESTIGATOR on both lanes; nothing recording; browsers closed.
- Slips:
  - one digit of a pairing code (never redeemed, since expired) was printed by a uiautomator dump into my own driver files; redacted;
  - one failed sign-in (401) on phone2: one AUTH_FAILED audit row on main;
  - 7 Metro log errors from my first inspector attempts (missing Origin header).

Shared files not written in this parallel run: `delegation_progress_report.md`, `status_tasks.md`, `masterplan/02_plan.md` (the controller records the outcome).
