# Progress: coder-execution, step 64 (plan row W42, realtime channel HB-8)

Status: **complete** (the row: gated PASS by decision D111, which also closed DN-9; the follow-up of 18:54 to 19:40: complete, see the last section) (started 2026-10-04 15:45 WIB)

Document: `implementation/42_realtime_channel.md`. Evidence: `implementation/assets/42_*`.

## Timeline

| Time | What |
|---|---|
| 15:45 to 15:52 | Inputs read: spec §9, §4.7, §6.8, §8.6, §14.2, §15.6; the contract's realtime messages and examples; the engine host §9, the identity core §9.3, the guard (D83 DN-3), the request guards, pairing (D93), user administration §9, the emulator proof §17.4, the Live socket client |
| 15:52 | Pre-images saved under `.cache/rollback/w42/` (the stub `src/realtime/index.ts`, `plugins/readiness/__tests__/readiness.test.ts`) |
| 15:53 to 16:03 | Production files written: `limits.ts`, `admission.ts`, `messages.ts`, `publication.ts`, `tablet-link.ts`, `hub.ts`, `index.ts` |
| 16:03 | Controller note applied: no log call of the folder holds `reason`, `error`, `cause` or `e` (renamed to `refusal`, `helloReason`) |
| 16:04 | Notice to the controller: `modules/health/__tests__/health.test.ts:126-133` breaks by design (TS2322 and `FST_ERR_DEC_ALREADY_PRESENT`) |
| 16:05 | Ruling D99 applied: that one test asserts 0 sockets on a fresh app (pre-image `.cache/rollback/w42/health.test.ts.pre`); own stub line removed from `readiness.test.ts` (D52) |
| 16:15 | Unit tests of the hub green (127) |
| 16:20 to 16:28 | First real handshakes. Found and fixed: a refused handshake leaked its server-side socket (`app.close()` never returned); a peer reset during a refused handshake was an unhandled `error` event; an upgrade on a REST route was accepted and its raw URL logged |
| 16:33 to 16:35 | State, control and backpressure tests over real sockets green |
| 16:39 | First contact (a) and (b) green on the current tree of `packages/shared` (after D97): no mismatch |
| 16:43 | Row command exit 0 (5 files, 87 tests); typecheck and lint exit 0 |
| 16:45 to 17:07 | Mutation check, first pass: 82 of 91 detected. The 9 others: 4 redundant conditions (removed), 4 missing tests (added), and ONE REAL DEFECT: a device socket closed during its admission (first snapshot over the hard limit) was still registered as present. Fixed with a `present` flag, test added |
| 17:08 to 17:10 | `hub-types.ts` split off (hub.ts 902 to 773 lines); tests added; `shutdown.db.test.ts` added; unit 163, db 90 green |
| 17:10 to 17:21 | A second mutation run was started with a list that had not been updated (a quoting mistake); stopped at 17:21. Its runner was ended before its teardown: three databases with the label `step_64m` stayed (section 18 of the document) |
| 17:21 | The ten changed or new mutations: 10 of 10 detected |
| 17:22 to 17:25 | Whole `unit` 140 files / 3,600 exit 0; whole `db` 108 files with 2 red in other rows' files (the biometric row's hand-over, F-14); typecheck and lint exit 0 |
| 17:25 to 17:46 | Final mutation run on the finished code: 94 of 95 detected (I16 is equivalent) |
| 17:47 to 17:50 | Final runs: whole `unit` 141 files / 3,609 exit 0; whole `db` 108 files / 1,540 passed, 1 skipped, exit 0; typecheck exit 0; lint exit 0 without a warning; row command 6 files / 90 tests exit 0; unit of the folder 7 files / 163 tests exit 0 |
| 17:50 | End state read: no listener, `.locks/postgres.pid` 19121, 0 databases with the prefix `dems_test_step_64_`, 3 with `dems_test_step_64m_tmdoqjg5_` |
| 17:52 | Document and this file closed |

## Files created or updated

Created under `apps/core-server/src/realtime/`: `admission.ts`, `hub.ts`, `hub-types.ts`, `limits.ts`,
`messages.ts`, `publication.ts`, `tablet-link.ts`; `__tests__/admission.test.ts`, `messages.test.ts`,
`hub.lifetime.test.ts`, `hub.state.test.ts`, `hub.control.test.ts`, `plugin.test.ts`, `static.test.ts`,
`upgrade.db.test.ts`, `state.db.test.ts`, `control.db.test.ts`, `backpressure.db.test.ts`,
`first-contact.db.test.ts`, `shutdown.db.test.ts`, `hub-support.ts`, `support.ts`.

Replaced: `apps/core-server/src/realtime/index.ts` (the scaffold's stub).

Edited by design (section 12 of the document):
`apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts` (own stub assertion, D52);
`apps/core-server/src/modules/health/__tests__/health.test.ts` (one test, ruling D99).

Documents: `implementation/42_realtime_channel.md`; `implementation/assets/42_test_db_verbose.log`,
`42_test_unit_verbose.log`, `42_gate_final.log`, `42_mutations.log`, `42_mutations_first_pass.log`, `42_mutation_I4_output.log`, `42_mutate.py`, `42_vitest.mutation.config.ts.txt`;
this file.

Not written (parallel run, P8): `delegation_progress_report.md`, `status_tasks.md`,
`decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md`.

## For the controller

Milestones: the channel is in place and green; the first contact with the shared client layer
found no mismatch; three defects of the handshake path were found and fixed (F-1 socket leak, F-2
process-ending reset, F-3 raw URL logged); the mutation check found and this row fixed one defect
of its own first version (F-13).

Blocker: none for the rows that depend on this one (W47, W48, W49, W50, W51, W58).

Decisions needed (document section 13): DN-1 (close code 1009 for an oversize client message),
DN-2 (an early `resync` is answered late), DN-3 (`meters.seq` continues across an engine restart),
DN-4 (open sockets stay open while readiness is off), DN-6 (F-1 and F-2 to the security review
W45; F-4 residual), DN-7 (how the server workspace imports the Live socket client, before W49),
DN-8 (roles after a demo reset, for W43), **DN-9 (the three leftover databases)**.

Gaps: `CONTRACT-GAP-W42-1` (close code 1009 in the contract's list), `-2` and `-3` (description
text). No schema, simulator or package gap.

Findings for other rows: F-4 (foundation or W45), F-5 (W45), F-8 (W49), F-9 (W43), F-10
(health count against the hub's), F-11 (W53 / W58), F-14 (the biometric row's hand-over was red
at 17:23 and green at 17:48).

## Follow-up: per-principal cap, undecodable upgrades, test support (decisions D113, D116)

Status: **complete**. Document: `implementation/42_realtime_channel.md` section 21. Evidence:
`implementation/assets/42b_*`. Label of the runs: `DEMS_TEST_STEP=64b`.

| Time | What |
|---|---|
| 18:54 | Pre-images of every file of `apps/core-server/src/realtime/` saved under `.cache/rollback/w42b/` |
| 18:54 to 19:02 | CPS1-5: the cap of one principal in `limits.ts`, `admission.ts`, `hub.ts` (displacement, close 1013). CPS1-4: `handshake.ts` (new) and its wiring in `index.ts` (bound 5,000 ms at the pace step, 32 waiting sockets). Test support moved to `apps/core-server/test/support/realtime.ts`, re-export at the old path, `TestSocket.closed` fixed. Unit tests of the folder green |
| 19:05 to 19:06 | Typecheck exit 0; unit and `db` tests of the folder green; `test/acceptance/shared-state.test.ts` green; **`test/acceptance/pairing-lifecycle.test.ts:1288` red (1 of 31): this row's defect** (a session on a device was counted under the device) |
| 19:07 | Corrected: an OPERATOR socket is counted under its session, on the web and on a device; only a DEVICE socket under its device. Tests updated |
| 19:12 | `db` tests of the folder and both acceptance tests green (9 files, 136 tests); lint: one warning in an own test file, fixed |
| 19:15 to 19:20 | Mutation re-run, unit scope: 54 of 54 detected |
| 19:21 to 19:26 | Mutation re-run against real sockets: 8 of 8 detected; every run reached its teardown |
| 19:26 | Folder: unit 18 files / 312 tests (with the static guards), `db` 7 files / 99 tests, the two acceptance tests 37 tests: all exit 0 |
| 19:26 to 19:27 | ONE whole `unit` run: 145 files / 3,748 tests, exit 0 |
| 19:27 to 19:31 | ONE whole `db` run: 114 of 115 files, 1,691 of 1,692 tests, exit 1: one red test of another row, `src/modules/demo/__tests__/reset-failures.db.test.ts:391` (also red alone at 19:31:30) |
| 19:31 to 19:32 | Typecheck exit 0; lint exit 0 without a warning; end state read: 0 databases with the prefix `dems_test_step_64`, no listener, `.locks/postgres.pid` 19121 |
| 19:40 | Section 21 of the document and this section closed |

Files of the follow-up, all under `apps/core-server/`:

- new: `src/realtime/handshake.ts`, `test/support/realtime.ts`,
  `src/realtime/__tests__/hub.principal-cap.test.ts`, `handshake.test.ts`, `support.db.test.ts`;
- modified: `src/realtime/limits.ts`, `admission.ts`, `hub.ts`, `hub-types.ts`, `index.ts`;
  `src/realtime/__tests__/support.ts` (now the re-export), `admission.test.ts`, `plugin.test.ts`,
  `static.test.ts`, `upgrade.db.test.ts`; import paths only in `hub-support.ts`,
  `hub.lifetime.test.ts`, `hub.state.test.ts`, `hub.control.test.ts`, `messages.test.ts`,
  `control.db.test.ts`, `state.db.test.ts`, `backpressure.db.test.ts`, `first-contact.db.test.ts`,
  `shutdown.db.test.ts`;
- not changed: `messages.ts`, `publication.ts`, `tablet-link.ts`; nothing outside the two allowed paths.

Documents: section 21 of `implementation/42_realtime_channel.md`; `implementation/assets/42b_gate_final.log`,
`42b_test_unit_verbose.log`, `42b_test_db_verbose.log`, `42b_mutations.log`, `42b_mutate.py`; this file.
Not written (parallel run): `delegation_progress_report.md`, `status_tasks.md`,
`decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md`.

### For the controller

The numbers: **4** sockets per operator session, **2** per device credential (16 in all and 6
without a principal unchanged); a handshake has **5,000 ms** (checked every 250 ms), at most **32**
sockets wait in a handshake. At the cap of a principal the newest is admitted and the principal's
oldest is closed with **1013**, reason `replaced by a newer connection`.

Decisions needed (document 21.8): DN-10 (the two numbers are this row's choice), DN-11
(displacement with close code 1013, no new close code, no contract change), DN-12 (waiting
handshakes have a cap of their own instead of being counted in the hub's 16).

Findings: F-15 (a session with more live tabs than its cap rotates; for W50), F-16 (the cap is per
session, not per operator), F-17 (a principal below its cap is still refused by a full hub),
F-18 (a request on an undecodable path is outside the throttle, with or without `Upgrade`; the
foundation's). F-4 is closed. Nothing is proposed for `plugins/error-envelope`.

Another row's red test: `src/modules/demo/__tests__/reset-failures.db.test.ts:391`, at 19:27:35 to
19:31:05 in the whole `db` run and alone at 19:31:30 (`expected [ …(87) ] to have a length of 86 but
got 87`). `src/engine/host.ts` was written at 19:12:57.

Blocker: none.
