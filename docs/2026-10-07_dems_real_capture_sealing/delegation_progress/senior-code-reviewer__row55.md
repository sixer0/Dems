# Row 55 — M2 checkpoint code review (senior-code-reviewer)

Status: COMPLETE
Started: 2026-10-08 ~20:02Z
Finished: 2026-10-08
Mode: READ-ONLY (no production edit, no migration, no DB write, no test mutation)

Artifact: gateway_check/15_m2_code_review.md (Tier 2)

## Outcome
- Overall: M2 READY FOR GATE, with 2 itemised gate items + 1 misclassification to correct.
- No Blocker, no code-correctness Major. tsc core-server + shared both exit 0 (re-run).
- No .skip/.todo/.only/@ts-ignore introduced.

## Per-area verdicts
1 schema v2 (45) PASS; 2 migrations 0004-0007 (46,112) PASS (F4,F7 Low); 3 shared contract (47) PASS;
4 API registry (48) PASS (F5,F6 Low); 5 seed+fixture (49/53) FINDINGS (CS-20 -> §3);
6 OpenAPI pins (50/50a/RECON-C) PASS; 7 sim parity (51/51a) CAUTION (SH-10 F1);
8 capture-config (52) PASS (F10 Info); 9 lanes (44/53) PASS (CS-20 residual; 2 locked AVDs user-gated);
10 reset guard (54) PASS; 11 stt_config table (112) PASS; 12 stt_config seed/kept (114) PASS.

## Adjudications
1. CS-20 §G: MUST at M2 via the bulk-fixture builder (dbc-3 :774, :780-794). Recommend a dedicated
   v2-builder fixture row before the gate; else itemised gate exception. The "owning milestone produces
   rows" reasoning conflates fixture synthesis with runtime capture. Blueprint row 53's "per-lane bulk
   fixture at §F step 4" is a mis-citation (§F step 4 = db:seed; fixture is dems_test_* only).
2. R4: 12/13 contract.test.ts + 3/3 unit = genuine later-milestone walks (ops 76-89 = M4/M5/M6/M7/M8,
   C3 :161-174). 1 (contract.test.ts #5) = stale-pin M2 cleanup mislabelled as frozen-doc deferral
   (openapi.json is 89/0.3.0, not 75/0.2.1). 1 bulk-fixture = CS-20 (M2-owned).
3. Media-profile CODE: erratum needed; canonical = H264_1080P25 (underscore), per C3 :384
   SCREAMING_SNAKE + dbc-3 §B.1 CODE format. Fix sim/initial-state.ts:84; shrink the mapping bridge.

## Findings
F1 Med SH-10 SIM_SNAPSHOT_VERSION still 1 (sim/constants.ts:24, state-slices.ts:124, rows.ts:244)
F2 Med CS-20 §G minimums unmet (minimums.ts:20) -> dedicated builder row
F3 Med contract.test.ts:437,448 stale 75/0.2.1 pins misclassified
F4 Low 0005:14 comment cites nonexistent credential-reveal.ts + false ownership
F5 Low api/capture.ts:8-9 doc overclaims contract-values enforcement (CS-25 unimplemented)
F6 Low MIC_SILENCE_* duplicated sim/constants.ts vs api/capture.ts, no equality guard
F7 Low 0005/0007 in-place ASCII edit of applied migrations (live-safe, comment-only)
F8 Low mapping profile fallback silently normalises hyphens (rows.ts:626)
F9 Info blueprint kept-set/§F step text stale
F10 Info capture-config not mounted in app.ts at M2 (boot unit-proven only)

## Evidence run
- npx tsc --noEmit -p apps/core-server -> exit 0
- npx tsc -p packages/shared --noEmit -> exit 0
- openapi.json parsed: 0.3.0 / 89 ops / 34 GET / 55 POST
- 0000-0003 unchanged vs 0024068; journal 8 entries
- E-04 enum = USERS/DEVICES/PAIRING_CODE; capture slices own kinds 29/30
