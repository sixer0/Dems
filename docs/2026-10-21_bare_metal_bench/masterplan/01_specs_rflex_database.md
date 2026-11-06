---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
date: 2026-10-22
agent: database-specialist
row: 91
type: spec (R-FLEX database delta)
narrative_tier: 1
status: needs-review (two choices go to row 96; the recommended path is complete without them)
source_plan: docs/2026-10-21_bare_metal_bench/identification/02_structured.md (row 91, :259; RQ-A3 :97, RQ-A4 :98, RQ-A6 :100, RQ-N4 :109)
names_from: masterplan/01_specs_rflex_register.md (row 87). Names missing there are written `<REQ:...>` and filed in delegation_progress/file_requests.md
inputs: research/01_explore_rflex_audio_identity.md, 01_explore_rflex_network_core.md, 01_explore_rflex_network_ui_docs.md; decisions.md D10, D11, D12
repo_state: branch task4/input-av-core-port, working tree, read-only (nothing run against a database)
---

# R-FLEX database delta (row 91)

All paths are relative to `/Users/gsp-budi/Documents/DEMS/apps/core-server` unless stated.
"Migration NNNN:L" means `src/db/migrations/NNNN_*.sql` line L.

## 0. Decision summary

| Item | Decision | Status |
|---|---|---|
| (a) Exclusivity | **Service check inside the registration unit.** The existing unit lock (serial pipeline plus the audit chain lock) already serialises every writer, so no new lock is needed. **No new DB index** on the recommended path | Recommended. "Both" (service plus DB-A1) is option B, which goes to row 96 as Q-DB1 |
| (b) Release on re-bind | Release is a **slot clear plus a binding-column clear**: (1) the old MIC leaves any selector slot (`capture_config.mic_primary_id` / `mic_standby_id` set to NULL); (2) the old input row's `usb_serial` and `usb_port` are set to NULL (`usb_id`, the key columns and the row itself are kept). No retire, no delete | FIRM on the DB side. The service-side meaning is row 88's |
| (c) `usb_port` | **Keep** the column. Its *value* becomes informational (no longer compared). Its *presence* becomes the bound/released marker for a serial-less row. Keep `usb_serial` unchanged | Recommended. Q-R3 (RQ-A6) goes to row 96. "Drop" does not fit the release in (b) |
| (d) `capture_network_config` | **No DB change.** `interface_name` and `camera_subnet` are already nullable. "Global" needs no required field at DB level | FIRM. Depends on row 90 for the read side |
| (e) Migration pair | **No migration. Version stays 15 / `dbc-16`**; DB-M1..DB-M5 are not used. Option B's pair (`0034_audio_input_binding`, `0035_audio_input_binding_privileges`, set 17, schema v16, `dbc-17`) is fully specified in section 6 for the case row 96 picks it | Recommended path has no DB object change |
| (f) Reset keep-set / fixtures | Keep-set unchanged. DB fixtures unchanged. Module test fixtures gain cases (section 7) | FIRM |
| (g) Existing rows / rollback | No stored row is rewritten on deploy (MG-8 kept). Rows keep their meaning under the rule in section 5. Rollback = code rollback to the row 80 restore point; no DB down step on the recommended path | FIRM |

## 1. 5W1H (Tier 1)

| W | Answer |
|---|---|
| What | The database side of D10(1) (USB audio: no port lock; a bound card is exclusive; re-binding releases the old binding) and D10(2) (camera network "global"). It covers what is stored, which constraint holds it, how a release is written, what migrates and how it rolls back |
| Who | Producer: row 91. Consumers: row 88 (audio delta, the service meaning of the same release), row 90 (network read side), row 94 (impact/tests), row 95 (reconcile), row 96 (user sheet), row 98 (migration row; becomes "no migration" on the recommended path), code rows 99-114, row 13 (install DB delta: migration count), row 44 (bench DB create/migrate) |
| When | Spec wave S2, 2026-10-22. Runs in parallel with rows 88 and 90 |
| Where | Tables `capture_audio_inputs` (T-45), `capture_config` (T-31), `capture_devices` (T-32), `capture_network_config` (T-46). Module `src/modules/capture-inputs/audio-cards/`. Version row `schema_meta` |
| Why | D10 ruling 1 needs an exclusivity rule that code does not have today (`01_explore_rflex_audio_identity.md` §5: "D10's 'bound card is exclusive' has no equivalent in code"). It also needs a release form the runtime role can write. D10(2) needs the network columns to be optional. They already are |
| How | Each grant, constraint and column was re-read in the migration files and in `src/db/schema/capture.ts`. Each choice is checked against the runtime role's privileges, the unit-of-work lock and the repo's migration rules (MG-5, MG-8, the data-step precedent of 0021) |

**Assumptions.**
- A1: Q-R5 is answered "line = DEMS input (MIC-nn)", as the register recommends.
- A2: D10(1) scope is USB audio. Rows with `usb_id IS NULL` (non-USB cards) keep today's per-input key and are outside the identity-exclusivity rule.
- A3: The bench DB is created fresh at row 44, so it holds no `capture_audio_inputs` rows before R-FLEX. This is a hypothesis: the spec waves have no host access (register §10).

## 2. Facts the delta builds on (verified this session)

| # | Fact | Evidence |
|---|---|---|
| D-1 | `card_id`, `card_device`, `input_number`, `native_channels` are NOT NULL. `usb_id` is nullable | Migration 0015:2-7; `src/db/schema/capture.ts:434` |
| D-2 | `usb_serial` and `usb_port` are nullable, with a CHECK on form only. No NOT NULL, no index, and no CHECK that ties them to `usb_id` | Migration 0017:44-45, 0017:51-52; `schema/capture.ts:447-448` |
| D-3 | Only uniqueness: partial UNIQUE INDEX `capture_audio_inputs_card_input_key (card_id, card_device, input_number) WHERE retired_at IS NULL` | Migration 0032:1 (constraint dropped), 0032:7 (index); `schema/capture.ts:474` |
| D-4 | Runtime role `dems_app` on `capture_audio_inputs`: SELECT, INSERT; UPDATE of `usb_id, card_id, card_device, input_number, native_channels, sample_bits, updated_by, updated_at` (0016:33-36), plus `usb_serial, usb_port` (0018:40), plus `retired_at` (0033:18). **No DELETE, no TRUNCATE** (0016:41) | as cited |
| D-5 | Runtime role on `capture_config`: UPDATE of the six slot columns, `revision`, `updated_by`, `updated_at`. No INSERT, no DELETE | Migration 0005:32-37 |
| D-6 | The selector slots have been nullable since schema v7. `capture_config_mic_check` (`mic_standby_id <> mic_primary_id`) is the only DB rule on the two MIC slots | `schema/capture.ts:246-251` (doc), `:261`, `:306` |
| D-7 | A retired row cannot be changed (trigger `capture_audio_inputs_retired_guard`, ZD001). `retired_at` is never cleared | Migration 0033:27-40, 0033:48-50, 0033:55 |
| D-8 | `capture_devices.enabled` is the online/LOST state of a device, not a binding state | `src/modules/capture-config/slices.ts:82` (`device.enabled ? 'LIVE' : 'LOST'`), `:148`; set true by `src/modules/capture-inputs/audio-cards/registrar.ts:35-36` |
| D-9 | Every unit runs on ONE serial queue per process, and every unit first takes the audit chain lock. That lock serialises state changes "in this process and across processes" | `src/core/pipeline.ts:2-8`; `src/core/unit-of-work.ts:8`, `:15-18`, `:228-233` |
| D-10 | The registration of op 99 runs as such a unit (`app.engine.run`) and refuses while a session is open | `src/modules/capture-inputs/audio-cards/index.ts:228-231`; `service.ts:485-486` |
| D-11 | All writes to `capture_audio_inputs` are two statements of one module, pinned by a static list | `src/modules/capture-inputs/audio-cards/statements.ts:49-51` (INSERT), `:57-58` (REFRESH), `:61` (`CAPTURE_AUDIO_CARD_WRITES`) |
| D-12 | Two reads do not filter `retired_at`: the listing read and the by-key read | `statements.ts:31-34`, `:37-40` |
| D-13 | Registration refuses a USB card that states neither a serial nor a port. So every USB row written since 0017 holds `usb_port` or `usb_serial` | `service.ts:446` (predicate), `:479` |
| D-14 | `capture_network_config.interface_name` and `camera_subnet` are nullable with no default. The write side accepts null | Migration 0017:3-4, 0017:13-14; `01_explore_rflex_network_ui_docs.md` RQ-N4 "Write side" |
| D-15 | Version row today: `schema_version = 15`, `contract_revision = 'dbc-16'`. Boot check B-3 refuses a mismatch in both directions | Migration 0033:89; `src/db/schema/meta.ts:121`, `:123`, `:17` |
| D-16 | No down command exists. The DB scripts are create, migrate, seed, reset, status and generate. The migrator's journal is `drizzle.__drizzle_migrations` | `apps/core-server/package.json:16-21`; `src/db/commands/migrations.ts:16`, `:34` |
| D-17 | Repo rules: the generated migration file is never edited by hand. A data step that must precede a constraint is a file of its own, one earlier in the same transaction. "No migration rewrites a stored row" (MG-8) except as a stated exception | Migration 0021:9-14, 0021:29-30 |
| D-18 | Audit change words (`REGISTERED`, `CARD_CHANGED`, `REENABLED`) and the type `CAPTURE_AUDIO_INPUT_CHANGED` are not held by any DB object. So AU-A1 `RELEASED` needs no migration | `grep -l "REENABLED\|CAPTURE_AUDIO_INPUT_CHANGED"` over `src/db/migrations/*.sql` and `src/db/schema/*.ts`: no output |

## 3. (a) Binding exclusivity

### 3.1 The rule in DB terms

A non-retired USB input row **binds** a physical card when it holds a stored identity:

```
bound(row)  :=  row.retired_at IS NULL
                AND row.usb_id IS NOT NULL
                AND (row.usb_serial IS NOT NULL OR row.usb_port IS NOT NULL)
```

Which bound row *holds* a given live card follows the identity rule of row 88 (RQ-A1 option (d)):
- **Card states a serial S:** rows with `usb_id = card.usbId AND usb_serial = S`.
- **Card states no serial:** rows with `usb_id = card.usbId AND usb_serial IS NULL AND usb_port IS NOT NULL`. This is "any unit of the model"; the port value is not compared.
- **Exclusivity unit (Q-R1):** under Q-R1 (a) (physical card), the holder set is as above. Under Q-R1 (b) (card input), it is further restricted to the same `card_device` and `input_number`. See section 9 for why this row recommends (b), which differs from the register.

### 3.2 Where it is enforced (decision)

**Recommended: service only, inside the registration unit of op 99.**

1. Read the holders with DB-A2 `READ_BOUND_AUDIO_INPUTS` (`statements.ts`):
   ```sql
   SELECT i.device_id AS "deviceId", i.card_device AS "cardDevice", i.input_number AS "inputNumber",
          i.usb_serial AS "usbSerial", i.usb_port AS "usbPort"
     FROM public.capture_audio_inputs i
    WHERE i.usb_id = $1 AND i.retired_at IS NULL
      AND (i.usb_serial IS NOT NULL OR i.usb_port IS NOT NULL)
    ORDER BY i.device_id
   ```
   The service applies 3.1 to the result and excludes the row of the key being registered (the same `device_id`).
2. If a holder exists and the body has no `release: true` (AU-B1), refuse with `AUDIO_CARD_ALREADY_BOUND` (AU-R1) and set `details.deviceId` to the holder.
3. If a holder exists and `release: true` is set, release every holder (section 4) in the **same** unit, then insert or refresh the new binding.

**Why no extra lock:** the unit already runs on the serial pipeline and takes the audit chain lock first (D-9, D-10). Two registrations cannot interleave in one Core or across processes. All writers of the table sit in one module under a static list (D-11). So a check-then-write inside the unit is race-free without `FOR UPDATE` or an advisory lock.

**Why no DB index on the recommended path:**
- A DB rule can hold only the serial branch (DB-A1). The serial-less branch has no DB-visible identity. Its form also depends on Q-R2 (a port tiebreak, Q-R2 (ii), would contradict any model-wide index).
- DB-A1's columns depend on Q-R1.
- The index needs the data step of section 6.3, which needs a third migration file the register does not name.

**Option B (both):** add DB-A1 as a backstop for the serial branch. The cost is listed in section 6 and the choice in section 9 (Q-DB1).

### 3.3 Statement fixes found while reading (no DB object)

`READ_REGISTERED_AUDIO_INPUTS` (`statements.ts:31-34`) and `READ_AUDIO_INPUT_OF_CARD` (`:37-40`) should each gain `AND i.retired_at IS NULL` (`WHERE` for the first). The partial index (D-3) allows one retired row and one live row on the same key, and `store.inputOf` takes the first row. Today this is latent because op 111 is unrouted (register F6). Owner: the audio code row (row 97 assigns it).

## 4. (b) Release on re-bind

### 4.1 Forms ruled out (with the DB reason)

| Form | Why not |
|---|---|
| DELETE the old row | The runtime role has no DELETE (0016:41). The FK from `capture_audio_inputs` to `capture_devices` is ON DELETE RESTRICT (0015:49) |
| Retire (`retired_at`) | The controller's brief and register AU-X1 say not to use it. Op 111 has no server route (register F6), and retire is one-way and trigger-guarded (D-7). The grant exists (0033:18), so it remains a fallback for row 88 only |
| `capture_devices.enabled = false` | `enabled` is the LIVE/LOST state (D-8). A lost card would look released, and the loss watch could flip it |
| Clear `usb_id` | Turns the row into a non-USB row, which the runtime matches by kernel `card_id` (`01_explore_rflex_audio_identity.md` §3 step 1). It would still open the card |
| Clear the key columns | `card_id`, `card_device`, `input_number` are NOT NULL (D-1) |
| New column `released_at` | Not in the register ("No new column is registered", register §4.2), and not needed |

### 4.2 The release (recommended, FIRM on the DB side)

Written inside the op 99 unit that carries `release: true`, for each holder H (section 3.2 step 3):

1. **Binding-column clear** on H:
   ```sql
   UPDATE public.capture_audio_inputs
      SET usb_serial = NULL, usb_port = NULL, updated_by = $2, updated_at = $3
    WHERE device_id = $1 AND retired_at IS NULL
   ```
   - Statement name `<REQ:RELEASE_AUDIO_INPUT>`, added to `CAPTURE_AUDIO_CARD_WRITES` (`statements.ts:61`). The row count must be 1, otherwise the unit fails.
   - Privileges already exist: 0018:40 and 0016:35-36. The retire guard never fires because the WHERE excludes retired rows.
   - Kept: `usb_id`, `card_id`, `card_device`, `input_number`, `native_channels`, the row and its `MIC-nn`. The row keeps its key in the partial index, so a later registration of that same card input finds this MIC again (no second MIC for one input).
   - Alternative without a new name: call `REFRESH_AUDIO_INPUT` (`statements.ts:57-58`) with H's own `usb_id`, `native_channels`, `sample_bits` and NULL for `$3`/`$4`. Not recommended: the statement is wider than the release needs.
2. **Slot clear:** if H's `MIC-nn` is in `capture_config.mic_primary_id` or `mic_standby_id`, set that column to NULL and `revision = revision + 1`, through the engine's selector writer in the same unit (grant 0005:35-37; NULL allowed since v7, D-6). Audit: AU-A2 (`CAPTURE_CONFIG_CHANGED`, scope `MIC`). Row 88 confirms.
3. **Audit:** one `CAPTURE_AUDIO_INPUT_CHANGED` per released H with change AU-A1 `RELEASED` (no DB change, D-18). The new binding's own audit follows. The answer carries AU-B2 `releasedDeviceId`.
4. **Order inside the unit:** release first, then the INSERT or REFRESH of the new binding. Under option B the index would then never see two holders.

**Effect on the runtime (dependency on row 88).**
- A released row has `usb_id` set and neither serial nor port. This is the shape a pre-0017 row has today, which the runtime refuses as `IDENTITY_NOT_STORED`. That refusal is undecided and raises no fault (`mic-loss.ts:295` per the research §9).
- **So the release form needs the rule to keep "no serial AND no port = no stored identity, never opened".** If row 88 removes RM-A3/RM-A4 (register recommendation), "any unit of the model" must apply only to rows with `usb_port IS NOT NULL`.
- Row 95 must reconcile this. See section 9, Q-DB2.

**Re-taking a released row (dependency on row 88).** A later op 99 on the released row's own key finds the row by key (`statements.ts:37`). Today that is CARD_CHANGED, then REENABLED on a second call (`service.ts:497-512`). Recommendation to row 88: a released row matched by key is a plain re-bind in one call, and it goes through the same exclusivity check.

**macOS note (row 88).** On macOS `card_id = usb_<port>` (`macos-card-tie.ts:134`), so a port move changes the key. Keeping the binding across a port move (AC9) then means re-keying the existing row, not a release plus a new MIC.
- The DB permits it: UPDATE of `card_id, card_device, input_number` is granted (0016:35-36), and the partial index holds the new key.
- No statement does it today: `REFRESH_AUDIO_INPUT` does not touch the key (`statements.ts:54-58`).
- This is row 88's choice. It needs no DB object.

## 5. (c) `usb_port`, `usb_serial` and the existing-row rule (g)

**Recommendation (Q-R3 / RQ-A6): keep `usb_port`.**
- The value is informational: it is still written by INSERT and REFRESH (`statements.ts:49-51`, `:57-58`) and returned to op 98 (AU-L2). It is no longer compared.
- The presence (NULL / non-NULL) is the bound/released marker of a serial-less row (3.1, 4.2).
- `usb_serial` is unchanged: it stays the identity of a serial-stating card.
- The CHECKs `capture_audio_inputs_usb_serial_check` / `_usb_port_check` (0017:51-52) and the grant (0018:40) are unchanged.

**"Drop `usb_port`" is incompatible with 4.2.** Without the column, a bound serial-less row (`usb_id`, no serial) cannot be told from a released one. Drop would force the release back to retire (row 88) or to a new column (not registered). If row 96 still picks drop, section 6.2 gives the statement. Rows 88 and 95 must then re-decide the release.

**Existing-row rule (no stored row is rewritten on deploy; MG-8 kept, D-17):**

| Stored shape (non-retired) | Meaning after R-FLEX | Action at deploy |
|---|---|---|
| `usb_id`, `usb_serial` set (port any) | Bound to that serial unit, on any port | none |
| `usb_id` set, serial NULL, `usb_port` set | Bound to "any unit of the model" (port value informational) | none |
| `usb_id` set, serial NULL, port NULL (pre-0017 rows, or released) | Not bound; never opened; re-register to bind (as today: IDENTITY_NOT_STORED) | none |
| `usb_id` NULL (non-USB card) | Outside the identity rule (A2); per-input key D-3 as today | none |
| `retired_at` set | Never binds; unchanged (D-7) | none |
| Two or more bound rows that 3.1 says hold the same card (e.g. two inputs of one card under Q-R1 (a), or two identical serial-less units of one model) | Pre-existing conflict. Nothing fails at deploy (no DB rule). The next op 99 for that card refuses AU-R1 or, with `release`, releases every other holder. The listing names a holder in AU-L1 (rule for which one: row 88/92; suggestion: the slotted one, primary first, else the lowest MIC id) | none (surfaced, not auto-fixed) |

The bench DB is expected to be empty of such rows (A3). Row 44 records the count with a read-only `SELECT count(*) FROM capture_audio_inputs WHERE retired_at IS NULL` before the first registration.

## 6. (e) Migration and privileges pair

### 6.1 Recommended path: no migration

> **No migration. Schema version stays 15, contract revision stays `dbc-16`.** DB-M1 to DB-M5 (`0034_audio_input_binding.sql`, `0035_audio_input_binding_privileges.sql`, set 17, `DB_SCHEMA_VERSION = 16`, `DB_CONTRACT_REVISION = 'dbc-17'`, `contract-v16-delta.ts`, `set17.db.test.ts`) are **not used**. `src/db/schema/meta.ts:121,123` and the journal (34 entries, last `0033_capture_device_retirement_privileges`) are unchanged.

Every R-FLEX write fits existing objects and grants:

| Write | Grant |
|---|---|
| Release (4.2 step 1) | 0018:40, 0016:35-36 |
| Slot clear (4.2 step 2) | 0005:35-37 |
| New binding (INSERT / REFRESH) | 0016:33-36, 0018:40 |
| Audit `RELEASED` | no DB object (D-18) |
| Network optionality | already nullable (D-14) |

Consequences:
- Row 98 becomes "no migration; record N/A with this section as evidence". Row 97 refines it.
- Row 13 / row 44 migration count: the journal head stays idx 33.

### 6.2 Option B (only if row 96 picks Q-DB1 "both", or Q-R3 "drop")

**Set 17 = `0034_audio_input_binding.sql` (generated) + `0035_audio_input_binding_privileges.sql` (hand-written).** If an existing-row data step is needed (6.3), it is a third file and needs a register entry.

**0034_audio_input_binding.sql** is generated by `drizzle-kit generate` (`package.json:21`) from `src/db/schema/capture.ts` (next to `:474`). It is never hand-edited (D-17). Expected content:
- With Q-R1 (a):
  ```sql
  CREATE UNIQUE INDEX "capture_audio_inputs_usb_identity_key" ON "capture_audio_inputs" USING btree ("usb_id","usb_serial") WHERE "capture_audio_inputs"."retired_at" IS NULL AND "capture_audio_inputs"."usb_serial" IS NOT NULL;
  ```
- With Q-R1 (b): the same index on `("usb_id","usb_serial","card_device","input_number")`.
- Only if Q-R3 = drop:
  ```sql
  ALTER TABLE "capture_audio_inputs" DROP COLUMN "usb_port";
  ```
  This drops `capture_audio_inputs_usb_port_check` with it. It is not compatible with 4.2 (section 5).

A released row (serial NULL) drops out of the index by its predicate, so 4.2 needs no change under option B.

**0035_audio_input_binding_privileges.sql** follows the 0029 / 0031 pattern (0029:11-17, 0031:21-26):
```sql
-- Custom SQL migration file, put your code below! --
-- 0035_audio_input_binding_privileges (hand-written; R-FLEX, contract revision dbc-17; MG-2, MG-5).
-- Migration set 17: 0034 (generated) + this file. No statement names the owner role (MG-9, OW-9).
-- NO GRANT IS NEEDED, AND NONE IS WRITTEN: an index carries no privilege; the runtime role already
-- updates usb_serial / usb_port (0018) and still holds no DELETE, no TRUNCATE (0016).
UPDATE public.schema_meta SET schema_version = 16, contract_revision = 'dbc-17' WHERE singleton;
```
- If `usb_port` is dropped, the column grant of 0018:40 lapses with the column. No REVOKE is needed.
- In the same commit: `src/db/schema/meta.ts` gets `DB_SCHEMA_VERSION = 16` and `DB_CONTRACT_REVISION = 'dbc-17'` (B-3, D-15).

**Tests and pins under option B:**
- `test/db/contract-v16-delta.ts` (new; DB-M5) and `test/db/set17.db.test.ts` (new; cases `M17S-1..n` on the pattern of `set16.db.test.ts:17-30`):
  - index present with its predicate;
  - two live serial rows refused 23505;
  - a released row (serial NULL) not held;
  - a retired row not held;
  - version row 16 / `dbc-17`.
- Extend: `test/db/contract-inventory.json` (the `capture_audio_inputs` block near `:5066-5136`), `catalog.db.test.ts`, `constraints.db.test.ts`.
- `privileges.db.test.ts` is unchanged unless the column is dropped.

### 6.3 Existing-row data step (option B only)

- `CREATE UNIQUE INDEX` fails with 23505 on any DB holding two live rows of one `(usb_id, usb_serial)`. Under Q-R1 (a), that is any multi-input serial card with two MICs, which the task-4 design allowed (`01_explore_rflex_audio_identity.md` §1).
- The migrator applies pending files in one transaction (0021:13-14), so the set would not apply and B-3 would keep the new code from starting.
- So option B needs a data step **before** 0034, as a file of its own (D-17): `<REQ:audio_input_binding_data migration file>`. This shifts the generated file and the privileges file by one number, and the register (row 87/95) must renumber DB-M1/DB-M2.
- Rule (an MG-8 exception, stated as in 0021:29-30):
  - Among live rows that share `(usb_id, usb_serial)` (plus `card_device`, `input_number` under Q-R1 (b)), keep the one named in `capture_config.mic_primary_id`, else `mic_standby_id`, else the lowest `device_id`.
  - Set `usb_serial = NULL, usb_port = NULL` on the others (the release shape of 4.2).
  - Nothing else is touched.

This cost is the main reason section 3.2 recommends service-only.

### 6.4 Down / rollback

| Path | DB down | Code rollback | Data written by R-FLEX, read by old code |
|---|---|---|---|
| **Recommended (no migration)** | None. Version is unchanged, so B-3 accepts the old code | Restore the row 80 restore point (`implementation/48_rflex_restore_point.md`) | (1) Released rows: old code reads them as IDENTITY_NOT_STORED, so they are never opened and say CARD_CHANGED until re-registered. This fails closed. (2) Cleared slots: NULL is legal in old code (v7). (3) Port refreshed by a port move: old code compares the refreshed port, so the card matches where it now is. (4) Audit rows with change `RELEASED`: no DB object; whether old code's audit readers tolerate an unknown change word is a **hypothesis to verify in row 94/116** (the word list is `src/core/audit-details.ts:207` / `packages/shared/src/api/capture-audio-cards.ts:94`) |
| **Option B** | There is no down command (D-16). The DB owner runs one manual transaction: `DROP INDEX capture_audio_inputs_usb_identity_key;` `UPDATE public.schema_meta SET schema_version = 15, contract_revision = 'dbc-16' WHERE singleton;` then `DELETE FROM drizzle.__drizzle_migrations` for the set's rows (the newest 2, or 3 with 6.3). A dropped `usb_port` and the values cleared by 6.3 cannot be restored without a backup, so take `pg_dump` before `db:migrate`. On the bench (fresh DB, A3) the simpler rollback is drop and re-create through row 44 | Same as above | Same as above |

## 7. (f) Reset keep-set and fixtures

| Item | Change | Evidence |
|---|---|---|
| Reset keep-set | **None.** `capture_audio_inputs` (upsert by `device_id`) and `capture_network_config` (upsert by `singleton`) are already kept and carried column by column. Released rows are carried as they are. `capture_config` (kept, upsert) carries the cleared slots | `src/db/reset/kept-tables.ts:96`, `:105`, `:106` |
| Reset tests | None on the recommended path. Under option B with drop of `usb_port`, the hand-typed INSERT in `src/db/reset/__tests__/m2-guard-keepset.db.test.ts:202` names `usb_port` and must change | as cited |
| Bulk fixture minimums / seed | None (both tables minimum 0; the seed writes no row) | `src/db/fixtures/minimums.ts:105`, `:109`; `test/support/seed.ts:95`, `:98` |
| DB contract fixture | None. `captureAudioInput()` has no serial and no port, which under R-FLEX is the not-bound shape. DB tests use it for constraints only | `test/db/fixtures.ts:771-785` |
| Module fixtures (extend the existing file; no new file, per `feedback-test-suite-consolidation`) | `src/modules/capture-inputs/audio-cards/__tests__/fixtures.ts`: existing `INTERFACE_ON_ANOTHER_PORT` (`:52`) and `TWO_CARDS_INTERFACE_MOVED` (`:89`) change meaning (now the same card). New host texts are needed for: (1) card bound to MIC-a, registration of another input/key leading to AU-R1; (2) the same with `release: true` leading to the release of 4.2; (3) a released row re-taken by key | as cited; scenarios owned by the audio code row |
| DB-level tests to extend (recommended path) | `src/modules/capture-inputs/audio-cards/__tests__/routes.db.test.ts`: after a release, the old row has `usb_serial`/`usb_port` NULL, `usb_id`/key unchanged, `retired_at` NULL; the slot is NULL; one `RELEASED` audit entry; the whole unit rolls back when one write fails. `src/core/__tests__/writers.test.ts:352`, `:479`, `:534` (change word list pins) | register AU-A1 |

## 8. (d) `capture_network_config` for "global" (coordination with row 90)

| Column | DB today | R-FLEX DB decision | Depends on |
|---|---|---|---|
| `interface_name` | nullable, CHECK on form (0017:3, :13) | **unchanged; not required.** Stays the alias-helper / scan interface if Q-R4 keeps scan and set-IP bound | row 90 (read side `facts.ts:138`), row 96 Q-R4 |
| `camera_subnet` | nullable, CHECK private /16-/30 (0017:4, :14) | **unchanged; not required.** Used only by set-IP / scan if they stay bound | row 90, Q-R4 |
| `onvif_ports` | NOT NULL, default `[80]`, 1-8 ports (0030; grant 0031:19) | unchanged (point 3 survives, register §3.1 "Not removed") | row 89 |
| `factory_addresses`, `alias_host`, `alias_minutes`, `camera_ip_start`, `revision` | NOT NULL with defaults (0017:5-9, :15-18) | unchanged | none |
| Row existence | 0 rows until the first commissioning write; read as "both null" | unchanged; no seed row | `minimums.ts:109`; `service.ts:125-127` per RQ-N4 research |

- "Required for global" at DB level: **nothing**. Making either column NOT NULL would contradict D10(2), so it is not proposed.
- The meaning of `configured` (`interface_name AND camera_subnet` set) is code and contract text (register OP-101/102), not a DB object.
- **Marked dependency:** if row 90 decides any column change (rename, NOT NULL, a new column), this delta's "no migration" conclusion is void. Section 6.2 would then carry that change in set 17, and row 95 must reconcile.

## 9. For row 96

| Id | Question | Options | Recommendation | Consequence |
|---|---|---|---|---|
| Q-DB1 | Where is card exclusivity held (RQ-A3)? | (1) service only inside the registration unit; (2) service plus DB-A1 partial unique index (serial branch only) | **(1)**. The unit lock already serialises all writers (D-9, D-10, D-11). The serial-less branch cannot be a DB rule anyway | (1): no migration, version 15/`dbc-16`. (2): set 17, v16/`dbc-17`, a data-step file with a new register name (6.3), renumbering of DB-M1/M2, manual-only down (6.4) |
| Q-R3 (RQ-A6) | Stored `usb_port` | keep (informational value, presence = bound marker) / drop | **keep** | keep: no migration, no data loss. Drop: migration 6.2, and the release of 4.2 no longer works, so release must be re-decided (retire or a new column) |
| Q-R1 (refined) | Exclusivity unit | (a) physical card; (b) card input | **(b)**, which differs from the register's (a) and is flagged for row 95 | (a) forbids two MICs on two inputs of one multi-input interface. That is allowed by task-4 design (`01_explore_rflex_audio_identity.md` §1; DB fixture is a four-channel card, `test/db/fixtures.ts:771`) and would make existing primary+standby on one interface a pre-existing conflict (section 5). For a one-input USB mic (bench BOMGE) (a) and (b) are the same |
| Q-DB2 (for row 95, not the user) | Must "no serial AND no port" stay "no stored identity, never opened" (RM-A3/RM-A4)? | keep the refusal / remove it | **keep** (or limit "any unit of the model" to `usb_port IS NOT NULL`) | Required by the release form of 4.2. Removing it would make a released row re-open the card |

## 10. Gaps

- No database was queried. All statements in sections 4 and 6 are specified, not executed. Row 98 (or the code row) proves them on the Mac test DB under the `db-runner` lock.
- The bench DB row count (A3) is unverified: no host access in spec waves.
- Old-code tolerance of audit change `RELEASED` on read is unverified (6.4).
- The exact `0034` text under option B is what drizzle-kit generates. The text above is the expected form, not generated output.

---
*Generated: 2026-10-22*
*Last Updated: 2026-10-22*
