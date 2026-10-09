# RECON-D progress — coder-execution (paid, sole db-runner)

Row: pre-gate M2 fix row (CS-20 v2 bulk-fixture builders + F3 contract.test.ts re-pin).
Artifact: implementation/67_recon_cs20_pins.md (complete, Tier 3).

- [x] Read row 55 (CS-20 ruling, F3), dbc-3 §G (:774 MT-7, :780-794 minimums verbatim), row 49,
      row 53, D52, row-66 residual ledger; board context (row 66 RESULT, RECON-E assignment noted
      — its packages/shared scope NOT touched here).
- [x] Pre-work probe: PG running (18.4 on 127.0.0.1:4432); four live DBs OK at 2/dbc-3; six
      pipeline tables 0 rows on all four; snapshot `.cache/reconD/live-db-status-before.txt`.
- [x] Baseline targeted run: `Tests 14 failed | 39 passed (53)` — exactly the row-66 deferral set.
- [x] TASK 1 (CS-20): new `src/db/fixtures/pipeline.ts` (eight builders: the six §G pipeline
      tables + discovered capture devices + fake-device credentials), wired through
      rows/build/load/validate/report + the two fixture test files + static/support guards.
      Verified on throw-away: bulk-fixture.db.test.ts 25/25 PASS; §G per-table minimum-vs-loaded
      quoted in the artifact (intervals 720→1150, fragments 6500→8676, chunks 2000→2109,
      transcripts 400→410, revisions 30→30, jobs 3000→3000, devices 8→8, credentials 2→2;
      permissions/role_permissions pinned at 14/22; evidence_tracks §G floor 1010 with 2060 loaded
      under the SH-24 gate, decision D-RD-2).
- [x] TASK 2 (F3): contract.test.ts #5 re-pinned 75→89 and 0.2.1→0.3.0; the walk line now names
      the 14-route R4 deferral exactly (LANDED_UNROUTED hoisted to module scope, shared with the
      file's own detector; detector assertions unchanged). Targeted run: #5 PASSES.
      The 12 named route-walk deferrals untouched (still red, own names listed in artifact §4.4).
- [x] Full db project: `12 failed | 1836 passed` — 14→12, only the genuine R4 route-walk
      deferrals left. Unit project: 1317 passed | 3 failed — the three pre-existing non-bulk
      deferrals, untouched.
- [x] core-server tsc exit 0; oxlint exit 0; no timeout raised, no assertion skipped/weakened.
- [x] Live DBs: pipeline tables still 0 everywhere; only the live gate-UAT engines' own
      events/health_snapshots ticked between probes (long-lived dems_app backends on the lanes —
      not this row); all run databases torn down ("0 remain"); host :5432 untouched; creds never
      printed; dems_admin never used.
- [x] PG LEFT RUNNING (`pg:status: OK, running`).

Open for the controller: lane re-fixture with §G rows is a gate/UAT call (not taken here);
RECON-E owns the packages/shared side (v2 evidence shape + snapshot version + SIM media) — this
row's D-RD-2 note bounds what stays v1-shaped until it lands.
