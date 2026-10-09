# RECON-B — core-server reconciliation (M2 gate)

Role: sole db-runner this turn. PG RUNNING at 127.0.0.1:4432. Edit ONLY apps/core-server/**.
Goal: tsc exit 0, unit suite exit 0, db suite exit 0, lint exit 0 — after M2 shared-shape rows 47/48/49/51/52/112/114.

## Progress log
- [x] Env: repo root confirmed; PG TCP OK on :4432; timeout shim at .cache/reconB/bin/timeout (macOS has no timeout).
- [ ] Enumerate tsc consumer errors.
- [ ] Enumerate unit failures.
- [ ] Enumerate db failures (lockf db-migrate.lock).
- [ ] Fix + re-verify.

## Step results
- [x] Enumerated tsc: ~25 consumer errors across 4 categories (audio re-key, AccessCaller.sessionCreatorId, op-42 QUEUED, SESSION_HOLDER never).
- [x] Enumerated unit suite: 81 failed / 3921 passed (29 files). Far broader than the brief's known list — see classification below.
- [x] Applied ALL tsc consumer fixes → **tsc exit 0**.
      Files: evidence/index.ts (QUEUED), ticks.db.test.ts + to-rows.test.ts (.inputs),
      decision.test.ts (granted() satisfies SESSION_HOLDER + 13 inline literals sessionCreatorId:null),
      denial.test.ts (3 sites), matrix.db.test.ts (2 sites), rbac-matrix.support.ts (SESSION_HOLDER case + CallerFacts.sessionCreatorId + OperatorRole import).

## Classification of the 81 unit failures
BUCKET A — stale literal pins vs landed shared enum/registry (SAFE to correct, in apps/core-server tests):
  writers forbidden-key 17->28; decision cells 675->801; access-rules 75->89 + kind breakdown + SESSION_HOLDER condition;
  guard 75->89; matrix grants 18->22 / rules 75->89 / extras formula; to-rows §9.4 permissions 12->14 / grants 18->22 / per-role.
BUCKET B1 — core-server SOURCE-BEHAVIOR gaps (STOP; not a pin): realtime/engine/delta/write-plan/messages/round-trip/changes
  (captureConfig+captureDevices not persisted/replicated; transcriptStatus; evidence files round-trip);
  db/mapping/static purity (slices.ts:91); devices/static role-name (status.ts:156/177);
  sessions/evidence module ROUTE lists (routes not registered); audit-details/build/writers type-counts (fixture writes <62).
BUCKET B2 — needs docs OUTSIDE apps/core-server (STOP): DB-schema-parity (contract-inventory tables/columns/constraints/bytea/
  migrations/value-sets/denied-keys; commands 30-tables) => v1 03_database_contract.md; rbac-matrix.test.ts acceptance => v1 01_specs.md.

## Final results (2026-10-08)
- tsc apps/core-server: **exit 0** (fresh). lint oxlint: **exit 0** (fresh).
- DB (3 brief-listed files, under lockf, throwaway DBs): **exit 0, 62/62 pass**; teardown dropped 3, 0 remain; PG left RUNNING on :4432.
- Unit suite: **81 → 64 failing** (3938 pass). NOT green — residual = B1 source-behaviour gaps + B2 out-of-scope-doc expectations + A-spec summary counts + 2 security-intent static scans.
- Artifact: implementation/64_recon_core_server.md (Tier 3).
- STATUS: NEEDS-REVIEW. Full remaining-item list in the artifact. Did not touch packages/shared, core-web/mobile, mock-core/release, openapi.json, lockfile, or trackers. No assertion weakened/skipped; no timeout raised.
