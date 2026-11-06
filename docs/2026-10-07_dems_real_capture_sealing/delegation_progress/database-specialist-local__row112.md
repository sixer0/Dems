# database-specialist-local - row 112 (R-8 `stt_config` kept table + 0006/0007 migrations, tier 3)

Status: **COMPLETE**. Date: 2026-10-08. Session: database-specialist subagent (fallback slot), phase C milestone M2, blueprint rev 2.1; dependency row 46 landed before start; Q-STT-CFG confirmed (a) at D24, so R-8 lands.

Deliverable: `docs/2026-10-07_dems_real_capture_sealing/implementation/51_m2_stt_config_schema.md` (Tier 3) plus this note. No live database migrated; no commit made.

## What landed

- Typed table T-40 `stt_config` (`src/db/schema/stt.ts`, new): singleton, enabled, backend CHECK
  `('omlx-server','cpu-local')`, loopback-only endpoint CHECK (+ required-when-server), model, language
  `= 'id'`, diarization flag, `credential_kind`/`credential_ref`/`secret_ciphertext`/`nonce` with the exact
  three-way credential CHECK of dbc-3 §B.13, revision >= 1, `updated_by` FK operators RESTRICT, updated_at.
- Generated `0006_stt_config.sql` (non-interactive `drizzle-kit generate`; drift re-run says "No schema changes")
  carrying the CREATE + the forbidden-key swap at both audit sites.
- Hand-written `0007_stt_config_privileges.sql` in the 0005 pattern: column SELECT except the three secret
  columns, explicit REVOKE pinning that, UPDATE on all columns (write-only store), no INSERT/DELETE, owner-owned
  `SECURITY DEFINER dems_stt_credential_reveal()` (PUBLIC revoked, sole EXECUTE grantee `dems_app`, search_path
  pinned), MG-5 re-affirm of `(2,'dbc-3')`. Decision D-a in the artifact: privileges ride in 0007 rather than
  editing the frozen/validated 0005 (MG-4; register row 53 names `0006 stt_config`).
- Forbidden-key list extended 25 -> 28 (`credentialRef`, `credentialValue`, `apiKey`) + `STT_BACKEND`,
  `STT_CREDENTIAL_KIND` value sets; schema/index.ts now counts 40 tables.
- NOT touched: seed row and `kept-tables.ts` (row 114), ops 90-92/OpenAPI pins (row 113), `SIM_SNAPSHOT_VERSION`
  (still 1), `packages/shared/**`, web/mobile/mock-core/release, lockfile, trackers.

## Verification (M2-STTCFG-DB schema clause) — throw-away `dems_test_stt_cfg`, 2 runs

Anti-hang: perl process-group `timeout` shim on PATH (host lacks `timeout`), self-tested (capped sleep -> 124);
every DB command `timeout N /usr/bin/lockf -k .locks/db-migrate.lock npx tsx ... </dev/null`, lock released after
each run; creds in-process via project helpers, never printed; PG `127.0.0.1:4432` only.

| Proof | Result |
|---|---|
| full set 0000..0007 applied (8 migrations, one txn, dems_owner) | PASS exit 0; `schema version after: 2 (dbc-3)` |
| MG-10 second migrate | PASS no-op; ledger current applied=8 pending=0 problems=0 |
| `SELECT secret_ciphertext / nonce / credential_ref / *` as `dems_app` | **42501 x4** |
| col SELECT true x11 / false x3; col UPDATE true x14; table bits [S,I,U,D] all false; INSERT -> 42501; DELETE -> 42501 | PASS |
| write-only loop: app UPDATEs the credential, still cannot read back | PASS (42501 after successful write) |
| reveal via SECURITY DEFINER | PASS `{credential_kind:'ENCRYPTED',ct:20,nc:12}`; PUBLIC holds nothing (`["dems_owner=X/dems_owner","dems_app=X/dems_owner"]`); search_path pin quoted |
| **loopback CHECK refuses LAN** | PASS `23514 @ stt_config_endpoint_loopback_check` for `192.168.1.50`, `10.20.30.40/v1`, remote hostname, `https://[::1]`; positive control `http://localhost:8000/v1` accepted |
| other live CHECKs fire | PASS backend/language/kind/credential x2/nonce/secret-floor/revision/singleton(false); 2nd singleton row -> 23505 PK |
| catalog texts | PASS loopback regex verbatim; backend `= ANY(ARRAY['omlx-server','cpu-local'])`; forbidden keys = 28 = constant at BOTH audit sites |
| live `dems_demo` + lanes never migrated by this test | PROVEN before and after: all four `(1,'dbc-2')`, 30 base tables, `stt_config=false`, journal 4, `strays=[]` |
| throw-away dropped | PASS `remaining=0`; final `pg_database LIKE 'dems%'` = the four only |
| runs | 2 x `STEP C RESULT: ALL PASS`, identical 74-check sets (gate +1 stays at row 56) |
| PG left running | YES - every probe answered through `127.0.0.1:4432` |

## For the controller

- Sequencing note for row 53: the v2 set it applies is now 0000..0007 (it will find two pending files, 0006 + 0007).
- Pin-owner note: known-red v1 pins that referenced 17 forbidden keys now drift to **28** (row 48 `writers.test.ts:159`,
  `contract-inventory.test.ts` denied-key test + inventory regeneration) - assert 28 there.
- Row 115 owns the static single-module rule behind the reveal function; no STT reveal audit type exists (C3 adds
  only `STT_CONFIG_CHANGED`), so that static test is the sole narrowing control.
