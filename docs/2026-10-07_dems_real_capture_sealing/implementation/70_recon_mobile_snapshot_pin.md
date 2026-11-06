---
task_id: RECON-G (pre-gate fix for the M2 software gate's sole regression — stale mobile SH-10 snapshot-version pin, task 3 phase C)
task_slug: dems_real_capture_sealing
date: 2026-10-08
agent: coder-execution-local
source_plan: gateway_check/07_m2_gate.md (M2-RG-MOB regression row + §"Recommended path"), implementation/69b_recon_snapshot_code.md (SH-10 bump 1->2)
status: completed — one test expectation re-pinned 1->2; M2-RG-MOB exit 0 (194 suites / 1997 tests); no product code touched
tier: 3
---

# RECON-G — mobile SH-10 snapshot-version pin re-point (sim-adapters.test.ts:77)

## 0. Scope as received

The SH-10 `SIM_SNAPSHOT_VERSION` bump 1->2 (RECON-F2a, `packages/shared/src/sim/constants.ts:26`)
propagated to shared + core-server test pins but not to one mobile consumer pin. The M2 software
gate (`gateway_check/07_m2_gate.md`) flagged `apps/mobile/src/runtime/sim-adapters.test.ts:77` as
the sole regression blocking `M2-RG-MOB` exit 0. This row: correct that expectation to 2, sweep
`apps/mobile/**` + `apps/core-web/**` TEST files for any other stale SH-10 pins, and re-run the
mobile suite. Edits confined to test-file expectation values; no assertion skipped/weakened/deleted;
no timeout raised; no product/shared/core-server/migration/openapi/lockfile/doc-tracker writes.

## 1. Contract confirmation (read-only, before any edit)

- `packages/shared/src/sim/constants.ts:26` — `export const SIM_SNAPSHOT_VERSION = 2;` (landed by RECON-F2a).
- `packages/shared/src/sim/store.ts:116` — persist envelope `version: SIM_SNAPSHOT_VERSION` -> the code emits 2.
- Shared pin already re-pointed: `packages/shared/test/sim-v2-parity.test.ts:63` `expect(SIM_SNAPSHOT_VERSION).toBe(2)`.
- Target file clean at receipt: sha256 `5ac45af4690c159312bc6b1e6b49daf478bf04a4c92da784e907d8f9d432b05b`.

## 2. BEFORE baseline — M2-RG-MOB (quoted)

Command deviation (documented, forced): GNU `timeout`/`gtimeout` are absent on this macOS host and
brew installs are forbidden (same finding as `delegation_progress/coder-execution-local__row109.md`,
`verifier-local__row110.md`), so the anti-hang bound used the established equivalent
`perl -e 'alarm shift @ARGV; exec @ARGV' 1200 env CI=true … </dev/null`. Additionally, jest rejects
the vitest-only `--run` flag verbatim:

```
● Unrecognized CLI Parameter:
  Unrecognized option "run". Did you mean "u"?
```

(captured in `.cache/reconG/mob-before.log`, first attempt, exit 127-path then jest usage error).
`CI=true` already forces a single non-interactive jest run, so the final invocation is:

```
perl -e 'alarm shift @ARGV; exec @ARGV' 1200 env CI=true npm run test -w @dems/mobile -- --maxWorkers=2 </dev/null
```

BEFORE result (`M2-RG-MOB-BEFORE_EXIT:1`, matches the gate's recorded baseline exactly):

```
Test Suites: 1 failed, 193 passed, 194 total
Tests:       1 failed, 1996 passed, 1997 total
```

Sole failure, quoted:

```
FAIL src/runtime/sim-adapters.test.ts
  ● AsyncStorage persistence (04 §5.3 key dems.sim.v1) › round-trips a recording session through AsyncStorage and resumes it after a relaunch
    expect(received).toBe(expected) // Object.is equality
    Expected: 1
    Received: 2
      at Object.toBe (src/runtime/sim-adapters.test.ts:77:31)
```

Stale pin confirmed: the code emits 2 (SH-10 contract), the assertion still expected 1. The
session-resume assertions at :91-93 pass in this same run -> behaviour correct, pin stale.

## 3. Sweep for other stale SH-10 pins (apps/mobile/** + apps/core-web/** TEST files)

Greps run over `*.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx` under both apps:
`schemaVersion`, `sim_schema_version`, `SNAPSHOT_VERSION`, `"version":1`, `version:\s*1`,
`version === 1`, `version).toBe(1)`, plus a snapshot/persist-context cross-filter.

| Hit | Verdict | Action |
|---|---|---|
| `apps/mobile/src/runtime/sim-adapters.test.ts:77` `expect(snapshot?.version).toBe(1)` | **is the SH-10 pin** — asserts the version of the envelope the mobile sim actually persists | corrected to `2` (§4) |
| `apps/core-web/src/test/live-runtime-startup.test.tsx:383` `const SNAPSHOT = '{"state":{"marker":"a snapshot the simulator wrote earlier"},"version":1}'` | **NOT an SH-10 pin** — MD-5/AC-C-21 "Live mode does not touch simulator storage" byte-equality sentinel: the string is seeded into sessionStorage and asserted unchanged at :399. It never parses or validates the version and passes with any value; changing it would edit fixture data unrelated to the emitted contract | left untouched (rule: correct ONLY genuine SH-10 pins) |

Zero other hits: no `schemaVersion` / `sim_schema_version` / `SIM_SNAPSHOT_VERSION` references exist
anywhere else under `apps/mobile` or `apps/core-web` (src or tests). No other file in either app was
modified by this row.

## 4. Edit landed (before -> after)

`apps/mobile/src/runtime/sim-adapters.test.ts:77` (one-line expectation + clarifying comment):

```diff
     const snapshot = await storedSnapshot();
-    expect(snapshot?.version).toBe(1);
+    // SH-10: SIM_SNAPSHOT_VERSION is 2 since RECON-F2a; the envelope carries that version.
+    expect(snapshot?.version).toBe(2);
```

Assertion kept, strengthened to the landed contract; nothing skipped, weakened, or deleted; :91-93
untouched. File sha256 after: `d3f59da2debf3210cd45bfe0fc878ab8258cc08bd489d2f14020569b91e67478`.

## 5. AFTER verification — M2-RG-MOB (quoted)

Same command as §2:

```
M2-RG-MOB-AFTER_EXIT:0
Test Suites: 194 passed, 194 total
Tests:       1997 passed, 1997 total
```

Before -> after: `1 failed, 193 passed, 194` / `1 failed, 1996 passed, 1997` (exit 1)
-> `194 passed, 194` / `1997 passed, 1997` (exit 0). Gate floor "exit 0, >= 192 suites / 1988 tests"
met. Logs: `.cache/reconG/mob-before.log`, `.cache/reconG/mob-after.log`.

core-web NOT changed by this row -> no core-web re-run required (its suite was green at the gate:
117 files / 1496 tests per `07_m2_gate.md`).

## 6. Constraint compliance

- Edited exactly one file: `apps/mobile/src/runtime/sim-adapters.test.ts` (test expectation only).
- Untouched: product/source code, `packages/shared/**`, `apps/core-server/**`, migrations,
  openapi.json, lockfile, controller trackers, `docs/2026-10-04_*`. Pre-existing uncommitted changes
  in the tree (prior rows of this wave) were not staged, reverted, or added to.
- No git push/remote, no sudo, no emoji, docs English. Anti-hang honored via the §2 equivalents.

## 7. Handoff note

With this pin corrected, `M2-RG-MOB` returns exit 0, which per `07_m2_gate.md` §"Software-gate
verdict" clears the software half's sole blocker. Remaining gate sign-off needs row 56b (device
kill-matrix, user-side AVD unlock) — outside this row.

*Generated: 2026-10-08 23:04 UTC — coder-execution-local (RECON-G).*
