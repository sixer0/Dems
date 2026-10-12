---
task_slug: input_av_core_adapter_plan
agent: task-architect
date: 2026-10-13
type: blueprint refinement record (branch B; decisions C23 to C27)
status: complete
file_updated: identification/03_implementation_blueprint.md
---

# Blueprint refinement: branch B and decisions C23 to C27

Targeted edits only. No step number changed, no row removed, no application file touched, no shell used.

## 1. Read

`decisions/decisions.md` C21, C23 to C27; `verification/05_security_branch_b.md` in full; `decisions/161_selector_names_register.md` in full; `delegation_progress/file_ownership.md` in full; `test/006` and `test/007` (frame and summary sections, first 80 lines each, not the per-run sections); `implementation/076_host_profile.md` by search (RC-5 lines only); `scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md` by search (the H-nn lines only).

## 2. Rows added (6)

| Step | What | Requirement | Size | Model | Deps |
|---|---|---|---|---|---|
| 174 | ONVIF stream locator may carry a query under a closed rule | C24 | S | opus | 26:B |
| 175 | Worker log hygiene of the gate, two refusal codes | BR-04 | S | opus | 58:B |
| 176 | Worker: per-camera end instead of the worker exit | BR-05 | S | opus | 175:B |
| 177 | Worker version rise 0.5.0 to 0.6.0, pins unchanged | BR-06 | S | sonnet | 176:B |
| 178 | Permanent worker test, concurrency and leak cases | BR-09 (second half) | M | opus | 142:B, 176:B |
| 179 | Supervisor: a new secret per track at a worker restart | BR-07 (2) | M? | opus | 47:B |

Rows 175 to 178 carry `worker-build, heavy`. `WRK/src/ingest.c` has one writer at a time by build edge: 58, 175, 176.

Row 179 was not asked for by name. It exists because BR-07 (2) writes another file (`supervisor.ts`) and row 47 already holds three checks; folding it in would have made row 47 exceed the row budget. It is decision 14 of blueprint section 13.

## 3. Rows changed

| Step | Change |
|---|---|
| 9 | marked "skipped unless row 141 reopens the selection"; the list of rows it would replace now names 142 and 175 to 179 |
| 28 | C25 (R-2): carries the widening of `core-api.ts` and `state-slices.ts`; size S to M; the stale "operation count stays 97" reads "not moved (99 since row 63)" |
| 30 | C25: BLOCK item for each of the four slots, STANDBY included; four with all unassigned |
| 33 | C21 (6), C25: the four SIMULATED cells read "boots; a start is accepted as today" |
| 47 | BR-07 (1), (3), (4) written into task and check; the development helper's argument changed or named as an exception |
| 48 | BR-08; dependency 175:C added |
| 50 | dependency 174:B added (same file as row 174) |
| 58 | narrowed to the gate, its match and its attribution (BR-01, BR-02, BR-03); GATE CONDITION BR-01; the version line moved to row 177 |
| 59 | BR-11; depends on 175, 176, 177, 142, 178 as well |
| 60 | review covers 142 and 174 to 179 |
| 80 | BR-12 named in the task |
| 86 | reviews the worker gate, row 179 and row 174; depends on 59, 174, 179 as well |
| 125 | `9A/H-01` also carries the announce line (BR-10) and the loopback rule (BR-12) |
| 126 | `9A/H-10` carries the query-locator check of C24 and the digits-only token limit |
| 136 | 87 identifiers in place of 75 |
| 137 | rates BR-01 to BR-12; secret scan at the C23 gate |
| 141 | GATE CONDITION BR-10; depends on 142 and 178 as well |
| 142 | BR-09 refusal cases (near misses, line absent, second announce); size S to M; dependency 175:B added |
| 150 | dependency 28:B added (C25) |
| 163 | C25, C21 (6): real-capture refusal for four slots, Simulated as today |

Outcome marks only, no cell of task or check changed: row 7 (condition met, the row ran), row 173 (skipped, C21 (9)).

Not changed although named by a decision: row 5 (landed; its "tree counts 0" is read through the new convention in section 6); row 76 (landed; its document already carries the RC-5 owner rule, so BR-12 is attached in section 11.4 without touching the row).

## 4. Sections changed

0 (summary), 4 (package table: WP-04, WP-06b, WP-11b), 6 (two conventions: secret scan C23, branch B), the profile's honesty paragraph, 7 (heavy, worker-build, sh-hot), 8 (critical path, integration passes, cost table, duration), 8.1 (ruled-since note), 9 (gates M3 and track D; outcome under 9.1; lift entry condition 2), 11.1 (P12-F11, RC-1, RC-2), 11.2 (count), 11.4 (new: BR-01 to BR-12), 12 (two rows), 13 (decisions 10 to 14, ruled note), 14, 15, 16.

## 5. Totals (estimates)

| Measure | Before | After |
|---|---|---|
| Rows | 173 | 179 |
| Size | S 105, M 68 | S 107, M 72 |
| Model | opus 155, sonnet 17, not delegated 1 | opus 160, sonnet 18, not delegated 1 |
| Rows that run / still conditional / skipped | - | 172 / 4 (23, 34, 56, 57) / 2 (9, 173) |
| Levels | 19 | 19 |
| Requirement identifiers | 75 | 87 |
| `EXISTS:` paths | 100 | 108 |

Critical path: not longer. A second chain of the same length now reaches row 141: 8 -> 58 -> 175 -> 176 -> 178 -> 141. Both chains use one worker builder and the heavy-host lock.

Duration: about +0.6 to 1 working day, of which BR-05 about 0.1 to 0.2. New range about 12 to 18 working days before gates and fix waves, about 16 to 26 with the allowance.

## 6. Paths verified in this pass

By Glob: `apps/core-server/src/capture/supervisor.ts`, `apps/core-server/src/capture/adapters/local/camera-helper-args.ts`, `apps/core-server/src/capture/adapters/camera/onvif-session.ts`, `apps/core-server/src/capture/adapters/camera/__tests__/onvif-session.test.ts`, `apps/core-server/src/capture/boot/checks.ts`, `apps/core-server/src/capture-session/index.ts`, `packages/shared/src/api/core-api.ts`, `packages/shared/src/api/state-slices.ts`, `packages/capture-protocol/src/index.ts`, `apps/capture-worker/src/ingest.c`, `apps/capture-worker/src/worker.h`, `scripts/secret-scan/count-only.mjs`, `scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md`, `delegation_progress/file_requests.md`.

By Grep: `worker.h:43` (`WORKER_VERSION "capture-worker/0.5.0"`), `capture/boot/checks.ts:285` (`CAPTURE_WORKER_VERSION`).

Not opened here, quoted from the security check: `ingest.c:512, 524`, `supervisor.ts:794`, `camera-helper-args.ts:135`.

## 7. Limits

- Levels were recomputed by hand for the rows this pass touched, not for the whole table.
- The count of 35 heavy rows before this pass was taken from the document, not recounted; the new figure is that count plus four.
- The version number 0.6.0 in row 177 is this pass's choice of the next minor; the controller may name another.
- The size of row 179 is `M?`: what a restart costs on the relay side was not measured.
- `test/006` and `test/007` were read for their summaries only.

## 8. For the controller

1. Row 141 now carries two gates. Cutting it in two would lift the provisional mark of branch B earlier (decision 10).
2. Hypothesis HB-3 is not planned as a run (decision 11).
3. Whether the two refusal codes of row 175 need a member of the capture protocol is unknown; the row returns `needs-review` if so (decision 12).
4. The four one-line follows of the nullable `activeInputId` have no owner; proposed for integration pass I-2 (decision 13).
5. Row 179 as a row of its own (decision 14).
6. Rows 34 and 57 write `ingest.c` too. If their conditions are met they must be queued behind row 176.
