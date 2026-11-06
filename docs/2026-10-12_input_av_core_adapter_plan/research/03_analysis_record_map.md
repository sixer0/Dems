---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 6
date: 2026-10-12
agent: data-analyst
type: data
narrative_tier: 1
confidence: MEDIUM-HIGH (HIGH for the table-level outcomes, MEDIUM for the audit-type matches, see section 12)
source_structured_task: identification/02_structured.md (row 6, profile line 164, constraints C1-C13, goal G2)
source_translated_task: identification/01_translated.md
source_decisions: decisions/decisions.md (U1, U2, U3, P3, P4)
inputs: research/02_collection_input_av_records.md (row 3); research/02_collection_core_records.md (row 4); research/01_explore_input_av.md (row 1, sections 2 and 5); research/02_collection_rulings.md (row 5)
status: complete, with provisional lines waiting for Q3, Q6, Q8, Q10
last_updated: 2026-10-12 17:34
---

# Record-keeping map: every record of input-av against the Core (row 6)

> **Ringkasan (Bahasa Indonesia).** Dokumen ini menjawab tujuan G2: setelah porting, siapa pemilik setiap catatan. Semua 121 catatan yang ditulis input-av (tabel, entri audit, token, berkas, keadaan di luar database, berkas instalasi) diberi tepat satu hasil: 45 dimiliki Core, 63 dihapus, 13 adalah kekurangan di Core. Jumlah jenis catatan dengan dua pemilik pada keadaan target adalah **0**, dengan syarat proses API input-av tidak dijalankan lagi dan alat instalasi yang dipertahankan tidak membuka database, log audit, daftar perangkat, atau basis pengguna input-av. Keempat alat non-perekaman (scan IP pabrik, set IP kamera, kalibrasi gain, doctor), **bila dipertahankan apa adanya**, masih menulis catatan yang jenisnya dimiliki Core; dokumen ini menyebut catatan mana yang harus pindah atau hilang. Data lama di `apps/input-av/data/` ditandai menunggu keputusan Q3 dan tidak dibuka. Tidak ada berkas sumber yang diubah.

## 1. Frame (5W1H)

| Question | Answer |
|---|---|
| **What** | A map that gives every record input-av writes exactly one outcome: `OWNED_BY_CORE` (naming the Core record), `DROPPED` (with the reason), `GAP_IN_CORE` (naming what the Core lacks). One line per non-recording tool. One line for the existing data. A closing count of record kinds with two owners. |
| **Why** | The user's stated reason for the whole task is "agar tidak terjadi pencatatan ganda" (`identification/01_translated.md:18`). U1 narrowed the task to porting (`decisions/decisions.md:7`); P4 reads it as "no second system of record" and "input-av keeps no recording role" (`decisions/decisions.md:10`); the blueprint turns that into constraint C13 (`identification/02_structured.md:52`) and into a testable form: "a record map in which every kind of record has exactly one owner, double-owner count 0" (`identification/02_structured.md:63`). This document is that test. |
| **Who** | Owner of the answer: the user (Q3, Q6, Q8, Q10 remain theirs). Consumers: row 8 (target design, section "fate of `apps/input-av`" and the work packages that close the gaps), row 9 (decision register, Q3 and Q10), row 10 (legacy-data phase), row 11 (goal G2 check), row 13 (single audit chain, installation tools, existing evidence data). |
| **When** | Written 2026-10-12, wave 2, after rows 1, 3, 4, 5 were complete. It describes the **target state after the port**, not today: today the Core's two production adapters are stubs (row 5 section 8). |
| **Where** | Source side: `apps/input-av/nvr/`, `scripts/`, `deploy/` as collected by row 3. Target side: `apps/core-server/src/db/schema/`, `packages/shared/src/sim/vocabulary.ts` as collected by row 4. Nothing under `apps/input-av/data/` and no `.env` was opened. |
| **How** | Each record of row 3 was matched against the Core record of the same kind in row 4; where row 4 did not settle a match, the Core source line was opened read-only (list in section 13). The outcome rules are in section 2. Counts were taken mechanically from the tables of section 4 (command in section 3). |

## 2. Method

### 2.1 Abbreviations

| Short | Meaning |
|---|---|
| `R1`, `R3`, `R4`, `R5` | `research/01_explore_input_av.md`, `research/02_collection_input_av_records.md`, `research/02_collection_core_records.md`, `research/02_collection_rulings.md` |
| `S/` | `apps/core-server/src/db/schema/` |
| `VOC` | `packages/shared/src/sim/vocabulary.ts` |
| input-av paths | relative to `apps/input-av/` (for example `nvr/doctor.py:44`) |

### 2.2 The three outcomes, as used here

| Outcome | Meaning in the target state | What row 8 does with it |
|---|---|---|
| `OWNED_BY_CORE` | The Core already declares a record of this kind. After the port the Core is its only writer; the input-av counterpart is no longer written. | Nothing to add for ownership. Fields that have no home in the Core record are listed in section 7. |
| `DROPPED` | No system of record keeps it after the port. Either it ceases to exist, or it survives only as local working state of an installation tool and is of a kind the Core does not own (C13, `identification/02_structured.md:52`). | Nothing to build. Where a `DROPPED` line depends on an open entry, the entry is named. |
| `GAP_IN_CORE` | The target state needs the record (or needs it if a named condition holds) and the Core has no record of that kind. | A work package, or a decision that removes the need. Consolidated in section 6. |

"Owner" means the system that **writes** the record after the port. A frozen archive that nothing writes is not counted as an owner; this reading matters for Q3 and is stated again in section 10.

### 2.3 Unit rule (what counts as one record)

One line of row 3 is one record, with three stated exceptions so that no line carries two outcomes:

1. The `cameras` table holds three record kinds of goal G2 in one table (camera registry entry, audio source entry, camera credential; `R3` section 1.4, `nvr/db.py:69-103`). It is split into T04a, T04b, T04c.
2. The `settings` table is a key-value container with three keys (`R3` section 1.10). The container is T10; the keys are T10a, T10b, T10c. The key `site` holds six unrelated groups of fields (`R3` section 4, `nvr/settings.py:19-67`) and is split into T10a-1 to T10a-6.
3. A record that row 3 mentions in two sections (for example the JWT secret in sections 3 and 5) is listed once; section 5 reconciles every row-3 section against the identifiers used here.

Each of the 53 `audit.log(...)` call sites of `R3` section 2.1 is one record, in the order of that table.

### 2.4 Limits observed

No source file was modified (U3, `decisions/decisions.md:13`). Nothing under `apps/input-av/data/` was opened, listed or stat-ed. No `.env` file was read. input-av was not started and no device was contacted. Two files were written, both inside the task folder. The Graft graph was not queried: the question is about declared records, which rows 3 and 4 already list with `file:line`; no call-graph question arose.

## 3. Result at a glance

Counted from the tables of section 4 with `grep -E '^\| (T|A|K|C|F|X|I|P|D)[0-9]' research/03_analysis_record_map.md` and a tally of the third column (run 2026-10-12 after writing).

| Group | Records | OWNED_BY_CORE | DROPPED | GAP_IN_CORE |
|---|---|---|---|---|
| T: database tables and settings keys | 21 | 11 | 8 | 2 |
| A: audit entries by call site | 53 | 26 | 16 | 11 |
| K: token and credential material not held in a table | 7 | 3 | 4 | 0 |
| C: environment configuration | 1 | 0 | 1 | 0 |
| F: files written to disk | 13 | 4 | 9 | 0 |
| X: state written outside the data directory | 5 | 1 | 4 | 0 |
| I: installer artifacts | 15 | 0 | 15 | 0 |
| P: other scripts | 5 | 0 | 5 | 0 |
| D: deploy files | 1 | 0 | 1 | 0 |
| **Total** | **121** | **45** | **63** | **13** |

**Closing count: record kinds with two owners after the port = 0.** The conditions that keep it at 0, and what makes it non-zero, are in section 10.

## 4. The map

Columns: identifier; the input-av record with its row-3 location; the one outcome; the Core record, the reason, or what the Core lacks; the open entry or verdict the line depends on ("-" means none).

### 4.1 Database tables and settings keys (group T)

| Id | input-av record | Outcome | Core record / reason / what is missing | Depends on |
|---|---|---|---|---|
| T01 | `users` (`R3` 1.1, `nvr/db.py:40-48`) | OWNED_BY_CORE | `operators` (`S/rbac.ts:77-106`) and `operator_credentials` (Argon2id, `S/rbac.ts:112-142`). The scrypt hash of input-av is not carried over. | - |
| T02 | `refresh_tokens` (`R3` 1.2, `nvr/db.py:51-57`) | OWNED_BY_CORE | `auth_sessions` (token hash, operator, device, expiry, end reason; `S/identity.ts:18-74`). | - |
| T03 | `rooms` (`R3` 1.3, `nvr/db.py:60-66`) | DROPPED | The Core has no room entity. A room is a text attribute: `core_device.room` (`S/core.ts:158`), `active_session.room` (`S/sessions.ts:50`), `session_history.room` (`S/sessions.ts:150`). One active session per Core is a database rule (`S/sessions.ts:35-38`) and a ruling (R-6, `R5` 12.1). | Q6: becomes GAP_IN_CORE if one Core must serve several rooms |
| T04a | `cameras`, rows of kind `video`, without the credential columns (`R3` 1.4, `nvr/db.py:69-103`) | OWNED_BY_CORE | `capture_devices` (`S/capture.ts:38-87`); choice of camera and profile per slot in `capture_config` (`S/capture.ts:94-155`). Fields without a home: section 7, FG-01 to FG-03. | - |
| T04b | `cameras`, rows of kind `audio` (sound card source; `nvr/db.py:90-92`, `nvr/routers/audio.py:192-196`) | OWNED_BY_CORE | `capture_devices` with kind `MIC` and adapter kind `USB_AUDIO` (`S/capture.ts:38-87`; kinds in `R4` section 5); role assignment in `capture_config.mic_primary_id`, `mic_standby_id`. Fields without a home: FG-04, FG-05. | - |
| T04c | Camera credential: `cameras.username`, `cameras.password` in plain text, and the same pair embedded in `cameras.rtsp_url` (`R3` section 3, `nvr/db.py:76-77,79`, `nvr/registration.py:62-64`) | OWNED_BY_CORE | `capture_device_credentials` (AES-256-GCM envelope, no SELECT for the runtime role; `S/capture.ts:164-190`, `R4` section 6). The plain-text form and the credential-bearing URL are not carried over: "no `user:pass@host` locator is ever composed" (D96, `R5` 14.9). | - |
| T05 | `cases` (`R3` 1.5, `nvr/db.py:110-117`) | OWNED_BY_CORE | The case number is an attribute of the session: `active_session.case_number` (`S/sessions.ts:46`), `session_history.case_number` (`S/sessions.ts:146`), with the counter `caseNumber` (`S/value-sets.ts:189`). No case entity exists; `title` and `description` have no home and go. | - |
| T06 | `sessions` (`R3` 1.6, `nvr/db.py:120-141`) | OWNED_BY_CORE | `active_session` (`S/sessions.ts:40-85`) and `session_history` (`S/sessions.ts:141-160`); sources per session in `session_capture_sources` (`S/recording.ts:183-210`). Fields without a home: FG-06. | - |
| T07 | `recordings` (`R3` 1.7, `nvr/db.py:144-169`) | OWNED_BY_CORE | `evidence_tracks`, one row per file with size, SHA-256, codec, duration (`S/evidence.ts:206-247`); `recording_fragments` (`S/recording.ts:99-128`); the item in `evidence_items` (`S/evidence.ts:66-114`). Fields without a home: FG-07, FG-08. The three `playback_*` columns go with F07. | Q8 for a separate audio row |
| T08 | `markers` (`R3` 1.8, `nvr/db.py:172-179`) | OWNED_BY_CORE | No own table: `active_session.timeline` item of kind `MARKER` and `marker_count` (`S/sessions.ts:60,68`), sealed copy in `evidence_items.markers` (`S/evidence.ts:94`), audit `MARKER_ADDED` (`VOC:363`). `R4` section 8. | - |
| T09 | `devices`, the inventory of every device seen on the network (`R3` 1.9, `nvr/db.py:182-197`, writer `nvr/discovery.py:603-624`) | DROPPED | The Core keeps a record only for an adopted device (`capture_devices`). A search result "is not a descriptor and never enters the registry" (RG-4, `R5` 6.1); a search yields "a candidate LIST only" (D76 (1), `R5` 3.1). `last_seen_at` of an adopted device is in `capture_devices` (`S/capture.ts:52`). | Row 7 verdict on H-25, H-27, H-28: adopting a stored inventory would need a new ruling |
| T10 | `settings`, the key-value container (`R3` 1.10, `nvr/db.py:201-206`) | DROPPED | The Core has no table of arbitrary key-value settings (`R4` cross-cutting fact 2); each setting is a typed single-row table. The three keys follow. | - |
| T10a-1 | `site`: `site_code`, `site_name`, `site_address`, `deployment_mode` (`nvr/settings.py:19-67`) | OWNED_BY_CORE | `core_device.id`, `name`, `room` (`S/core.ts:152-179`). `site_address` and `deployment_mode` have no home and go. | - |
| T10a-2 | `site`: `max_camera_devices`, `lenses_per_device`, `audio_inputs` | DROPPED | The Core's capacity is fixed by its four slots `VIDEO-01`, `VIDEO-02`, `MIC-PRIMARY`, `MIC-STANDBY` (`S/value-sets.ts:151`; `R4` section 1), not by a setting. | Q6 |
| T10a-3 | `site`: `camera_iface`, `camera_subnet` | GAP_IN_CORE | The Core has no stored setting that names the camera network interface or subnet (search `gain\|av_offset\|commission\|subnet` over `S/`, 2026-10-12: no column matched). Needed if any adopted discovery or address-follow logic is bound to one port. | Row 7 verdict on H-23 to H-27 |
| T10a-4 | `site`: `discovery_scope`, `discovery_interval_s`, `device_offline_after_s`, `follow_camera_ip` | DROPPED | In the Core these are contract constants in code, not operator settings (`packages/shared/src/api/capture.ts:41,43,49,51,168` per `R4` section 7; constants fixed by D91, `R5` 7.1). | - |
| T10a-5 | `site`: `factory_default_ips`, `factory_alias_host`, `factory_alias_minutes`, `camera_ip_start` | DROPPED | Configuration of the factory-IP tool only (`R1` 5.1, 5.2). Not a kind the Core owns. | Q10: under "port" it becomes GAP_IN_CORE |
| T10a-6 | `site`: `min_free_gb`, `critical_free_gb` | DROPPED | The Core owns the behaviour through its storage states `READY`, `LOW`, `FULL` (`S/value-sets.ts:99`), the pre-check `STORAGE` (`VOC:108`) and the faults `STORAGE_LOW`, `STORAGE_FULL` (`VOC:223-224`); `storage_policy` holds retention only (`S/core.ts:103-119`). The two thresholds are not a stored setting there. | Row 7 verdict on H-37 |
| T10b | `settings` key `commissioning`: the installation record with who accepted it, when, and the diagnostics (`nvr/commissioning.py:79-96`) | GAP_IN_CORE | The Core has no stored installation-acceptance record and no audit type for one (the 67 types of `VOC:346-435` hold none). Its boot checks refuse to start but store no acceptance (`apps/core-server/src/capture/boot/checks.ts:21-35`). | Q10 |
| T10c | `settings` key `net_aliases`: which temporary host addresses are in place (`nvr/netalias.py:63-70`) | DROPPED | Working state of the alias tool, kept so that an alias can be removed after a restart. Not a kind the Core owns. | Q10: under "port" it becomes GAP_IN_CORE |
| T11 | `audit_log` and its hash-chain format (`R3` 1.11 and section 2, `nvr/audit.py:14-40`) | OWNED_BY_CORE | `audit_log`, `audit_chain_head`, `audit_chain_history` (`S/audit.ts:34-85,91-102,142-176`). The two chains are not compatible in form: input-av hashes a canonical JSON of eight fields (`nvr/audit.py:18-27`); the Core's rows carry a closed type vocabulary, a category and an actor that must be an operator (`S/audit.ts:34-85`). Nothing is merged; see section 9. | - |

### 4.2 Audit entries by call site (group A)

The Core audit type named is the one of the same meaning in `VOC:346-435`. "Class C" marks a type that exists but whose writer on a real camera or microphone path is not built (`R5` section 8); whether the ported path emits it is for rows 7 and 8.

| Id | input-av action (call site) | Outcome | Core record / reason / what is missing | Depends on |
|---|---|---|---|---|
| A01 | `camera_device.register` (`nvr/registration.py:74`) | OWNED_BY_CORE | `CAPTURE_CANDIDATE_ADOPTED` (`VOC:433`). | - |
| A02 | `recording.playback_copy_failed` (`nvr/playback.py:199`) | DROPPED | Goes with the playback copy, F07. | - |
| A03 | `recording.playback_copy` (`nvr/playback.py:207`) | DROPPED | Goes with the playback copy, F07. | - |
| A04 | `session.start` (`nvr/service.py:141`) | OWNED_BY_CORE | `SESSION_CREATED`, `RECORDING_STARTED` (`VOC:354,357`). | - |
| A05 | `recording.resumed` (`nvr/service.py:177`) | OWNED_BY_CORE | `FAULT_CLEARED` for fault kind `CAMERA_LOSS` (`VOC:380,220`). Class C. The part number has no home (FG-07). | Row 7 verdict on H-10 |
| A06 | `recording.stream_lost` or `recording.connect_failed` (`nvr/service.py:201`) | OWNED_BY_CORE | `FAULT_RAISED` for `CAMERA_LOSS` or `CAPTURE_FAULT` (`VOC:379,220,235`); `CAPTURE_DEVICE_UNREACHABLE` (`VOC:434`). Class C. | Row 7 verdict on H-10 |
| A07 | `session.stop` (`nvr/service.py:295`) | OWNED_BY_CORE | `RECORDING_STOPPED`, then `EVIDENCE_SEALED` (`VOC:358,360`). | - |
| A08 | `session.interrupted` (`nvr/service.py:344`) | OWNED_BY_CORE | `SESSION_INCOMPLETE`, `RECOVERY_STARTED`, `RECOVERY_COMPLETED` (`VOC:361,381-382`). | - |
| A09 | `system.commissioned` (`nvr/commissioning.py:95`) | GAP_IN_CORE | No audit type for an installation acceptance. Same gap as T10b. | Q10 |
| A10 | `system.commissioning_reset` (`nvr/commissioning.py:106`) | GAP_IN_CORE | Same gap as T10b. | Q10 |
| A11 | `network.link_up`, `network.link_down` (`nvr/discovery.py:388`) | DROPPED | No audit type for the link state of a port. The Core records the consequence per device (`CAPTURE_DEVICE_UNREACHABLE`, `FAULT_RAISED`) and holds port state in `hardware_snapshot.ports` (`S/core.ts:230`). | Row 7 verdict on H-23 |
| A12 | `camera.ip_followed` (`nvr/discovery.py:629`) | GAP_IN_CORE | `capture_devices.address` can be updated at run time (`R4` section 5, writer (c)), but no audit type records that a registered camera's address changed. | Row 7 verdict on H-11: needed only if address-follow is adopted |
| A13 | `device.discovered`, `device.ip_changed`, `device.online` (`nvr/discovery.py:637`) | DROPPED | Goes with T09. A search as a whole is audited by `CAPTURE_DISCOVERY_SEARCHED` (`VOC:431`). | - |
| A14 | `device.offline` (`nvr/discovery.py:668`) | OWNED_BY_CORE | `CAPTURE_DEVICE_UNREACHABLE` (`VOC:434`), for a registered capture device only; an unregistered device has no record (T09). | - |
| A15 | `device.factory_scan` (`nvr/factory.py:76`) | GAP_IN_CORE | No audit type covers a scan of factory addresses that adds a host address and probes other subnets. `CAPTURE_DISCOVERY_SEARCHED` is the type of the probe-only search (D80 (1), `R5` 7.1). | Q10: void under "drop" |
| A16 | `device.set_ip`, single device (`nvr/factory.py:99`) | GAP_IN_CORE | No audit type for a change of a camera's network configuration. The Core's connection code states "No configuration call exists here: no clock, GOP, profile or network set, no reboot" (`R5` 8.11). | Q10: void under "drop" |
| A17 | `device.set_ip`, wizard (`nvr/factory.py:171`) | GAP_IN_CORE | Same gap as A16. | Q10: void under "drop" |
| A18 | `case.create`, direct (`nvr/routers/sessions.py:51`) | DROPPED | No case entity in the Core (T05); the case number is recorded with the session. | - |
| A19 | `case.create`, implicit at record start (`nvr/routers/sessions.py:91`) | DROPPED | As A18. | - |
| A20 | `storage.rejected` (`nvr/routers/sessions.py:101`) | OWNED_BY_CORE | `PRECHECK_BLOCKED` on the check `STORAGE` (`VOC:356,108`). | - |
| A21 | `session.marker` (`nvr/routers/sessions.py:153`) | OWNED_BY_CORE | `MARKER_ADDED` (`VOC:363`). | - |
| A22 | `session.export` (`nvr/routers/sessions.py:167`) | OWNED_BY_CORE | `EVIDENCE_EXPORTED`, `EVIDENCE_EXPORT_FAILED`, `EXPORT_DENIED` (`VOC:374,420,375`). | - |
| A23 | `room.preview` (`nvr/routers/sessions.py:202`) | DROPPED | "No live preview of real cameras in this phase" (OD-12, `R5` 4.2); live preview is class C-6. | - |
| A24 | `recording.play`, `recording.download` (`nvr/routers/sessions.py:255`) | OWNED_BY_CORE | `EVIDENCE_MEDIA_SERVED`, `EVIDENCE_REVIEW_OPENED` (`VOC:419,373`); a download of the original is an export (A22). | - |
| A25 | `recording.verify` (`nvr/routers/sessions.py:292`) | OWNED_BY_CORE | `EVIDENCE_VERIFIED`, `EVIDENCE_VERIFY_FAILED` (`VOC:371-372`). | - |
| A26 | `audio.connected` (`nvr/audio.py:362`) | OWNED_BY_CORE | `FAULT_CLEARED` for `MIC_NO_SIGNAL` (`VOC:380,221`). Class C. | Row 7 verdict on H-22 |
| A27 | `audio.disconnected` (`nvr/audio.py:367`) | OWNED_BY_CORE | `FAULT_RAISED` for `MIC_NO_SIGNAL`; `CAPTURE_DEVICE_UNREACHABLE` (`VOC:379,221,434`). Class C. | Row 7 verdict on H-22 |
| A28 | `user.create` (`nvr/routers/admin.py:54`) | GAP_IN_CORE | The Core has no operation that creates an operator (the runtime role has no INSERT on `operators`, `S/rbac.ts:77-106`) and no audit type for it. Known before this task: "provisioning of operators stays a task of its own" (D241, `R5` 7.5). Not a work item of the port. | - |
| A29 | `user.update` (`nvr/routers/admin.py:75`) | OWNED_BY_CORE | `ROLE_CHANGED`, `USER_ENABLED`, `USER_DISABLED` (`VOC:406-408`). A password change has no type; it belongs to the gap of A28. | - |
| A30 | `room.create` (`nvr/routers/admin.py:104`) | DROPPED | Goes with T03. | Q6 |
| A31 | `room.bulk_create` (`nvr/routers/admin.py:136`) | DROPPED | Goes with T03. | Q6 |
| A32 | `room.update` (`nvr/routers/admin.py:197`) | DROPPED | Goes with T03. | Q6 |
| A33 | `room.delete` (`nvr/routers/admin.py:209`) | DROPPED | Goes with T03. | Q6 |
| A34 | `camera.create`, manual with a typed address (`nvr/routers/admin.py:273`) | OWNED_BY_CORE | `CAPTURE_CANDIDATE_ADOPTED` (`VOC:433`) is the registration record. The typed-address path itself is "NOT in scope - recorded as a gap" in the Core (D80 (10), `R5` 7.1); that is logic, for row 7. | - |
| A35 | `settings.update` (`nvr/routers/admin.py:347`) | OWNED_BY_CORE | Each Core setting has its own change type: `CAPTURE_CONFIG_CHANGED`, `STORAGE_POLICY_CHANGED`, `STT_CONFIG_CHANGED` (`VOC:414,393,426`). A setting added for T10a-3 would bring its own type by the same pattern. | - |
| A36 | `camera.update` (`nvr/routers/admin.py:387`) | OWNED_BY_CORE | `CAPTURE_CONFIG_CHANGED` for the assignment, `CAPTURE_CREDENTIAL_SET` for the credential (`VOC:414,421`). | - |
| A37 | `camera.delete` (`nvr/routers/admin.py:400`) | DROPPED | The Core never deletes a registry row: `active_session` is "the only table the runtime role may DELETE from" (`S/sessions.ts:37`); a device is switched by `capture_devices.enabled`. | - |
| A38 | `device.dhcp_request` (`nvr/passive.py:114`) | DROPPED | Goes with T09 (passive monitor). | Row 7 verdict on H-28 |
| A39 | `storage.critical` (`nvr/storage.py:114`) | OWNED_BY_CORE | `FAULT_RAISED` for `STORAGE_FULL` (`VOC:379,224`). | - |
| A40 | `storage.low` (`nvr/storage.py:120`) | OWNED_BY_CORE | `FAULT_RAISED` for `STORAGE_LOW` (`VOC:379,223`). | - |
| A41 | `network.alias_add` (`nvr/netalias.py:101`) | GAP_IN_CORE | No audit type for a change of the host's own network addresses. | Q10: void under "drop" |
| A42 | `network.alias_remove_failed` (`nvr/netalias.py:130`) | GAP_IN_CORE | As A41. | Q10: void under "drop" |
| A43 | `network.alias_remove` (`nvr/netalias.py:133`) | GAP_IN_CORE | As A41. | Q10: void under "drop" |
| A44 | `system.bootstrap_admin` (`nvr/main.py:35`) | DROPPED | The Core has no bootstrap administrator: operators are written by the seed (`R4` section 4) and a production Core refuses to start on the seed's demo password (`apps/core-server/src/capture/boot/checks.ts:94`; D241, `R5` 7.5). | - |
| A45 | `system.start` (`nvr/main.py:50`) | OWNED_BY_CORE | `SYSTEM_BOOT` (`VOC:397`). | - |
| A46 | `system.stop` (`nvr/main.py:62`) | DROPPED | The Core's vocabulary has no stop type; an unclean stop shows as `RECOVERY_STARTED` at the next start (`VOC:381`). Not a need of the port. | - |
| A47 | `auth.login_failed` (`nvr/routers/auth.py:30`) | OWNED_BY_CORE | `AUTH_FAILED`, `AUTH_LOCKED` (`VOC:349-350`). | - |
| A48 | `auth.login` (`nvr/routers/auth.py:34`) | OWNED_BY_CORE | `AUTH_SUCCESS` (`VOC:348`). | - |
| A49 | `auth.logout` (`nvr/routers/auth.py:64`) | OWNED_BY_CORE | `AUTH_SIGNED_OUT` (`VOC:351`). | - |
| A50 | `audio.mixer` (`nvr/routers/audio.py:77`) | GAP_IN_CORE | No audit type for a change of capture gain, and no stored gain value (search of `S/` in T10a-3). input-av itself stores no gain either, only this entry (`R1` 5.3). | Q10: void under "drop" |
| A51 | `audio_source.create` (`nvr/routers/audio.py:198`) | OWNED_BY_CORE | `CAPTURE_CONFIG_CHANGED` when the microphone is assigned a role (`VOC:414`). Registration of a `USB_AUDIO` device has no built writer (class C-4, `R5` 9.6). | - |
| A52 | `audio_source.update` (`nvr/routers/audio.py:247`) | OWNED_BY_CORE | `CAPTURE_CONFIG_CHANGED` (`VOC:414`). The offset and the input selection have no home (FG-04, FG-05). | - |
| A53 | `device.forget` (`nvr/routers/devices.py:59`) | DROPPED | Goes with T09. | - |

### 4.3 Token and credential material not held in a table (group K)

| Id | input-av record (`R3` section 3) | Outcome | Core record / reason | Depends on |
|---|---|---|---|---|
| K01 | `DUMMY_HASH`, in memory (`nvr/security.py:40`) | DROPPED | Never persisted; goes with the user base (T01). | - |
| K02 | Access token, JWT, not persisted (`nvr/security.py:62-63`) | OWNED_BY_CORE | The sign-in session of the Core: `auth_sessions` (`S/identity.ts:18-74`). | - |
| K03 | Preview token, JWT, not persisted (`nvr/security.py:73-77`) | DROPPED | Goes with live preview (A23, X01). | - |
| K04 | Media token, JWT, not persisted (`nvr/security.py:80-82`) | OWNED_BY_CORE | The signed media session of operation 88 and the signed download of an export job (`apps/core-server/src/modules/media-stream/index.ts:5-11`; `apps/core-server/src/modules/evidence-export/index.ts:13-15`). | - |
| K05 | Role list `("admin", "operator", "auditor")` in code (`nvr/security.py:17`) | OWNED_BY_CORE | `roles`, `permissions`, `role_permissions` (`S/rbac.ts:28-74`); roles `INVESTIGATOR`, `SUPERVISOR`, `TECHNICIAN` (`S/value-sets.ts:15`). | - |
| K06 | Redaction of FFmpeg error text, in memory (`nvr/recorder.py:174`) | DROPPED | Not a record. The Core has its own blanking of credential-bearing URLs in logs (D241 S99-04, `R5` 14.10). | - |
| K07 | Bootstrap administrator rule: created when `users` is empty, generated password printed to standard output (`nvr/main.py:27-38`) | DROPPED | As A44. | - |

### 4.4 Environment configuration (group C)

| Id | input-av record | Outcome | Reason | Depends on |
|---|---|---|---|---|
| C01 | The 23 `NVR_*` environment keys read by `nvr/config.py:11-65` (`R3` section 4) | DROPPED | Configuration of the input-av service; goes with the service (C13). The Core has its own environment keys (for example `DEMS_CAPTURE_MODE`, `DEMS_CAPTURE_WORKER`; `apps/core-server/src/capture/boot/checks.ts:86-87`). | - |

### 4.5 Files written to disk (group F, numbering of `R3` section 5)

| Id | input-av artifact | Outcome | Core record / reason | Depends on |
|---|---|---|---|---|
| F01 | SQLite database `DATA_DIR/nvr.db` with its side files (`nvr/config.py:14`, `nvr/db.py:226-250`) | DROPPED | Container of group T. No second database in the target state (P4). The existing file is section 9. | Q3 for the existing file |
| F02 | JWT secret file `DATA_DIR/.jwt_secret` (`nvr/config.py:25-26`) | DROPPED | Goes with the input-av token scheme (K02 to K04). | - |
| F03 | Video evidence file `cam<id>-p<NN>.ts` (`nvr/service.py:153-154`, `nvr/recorder.py:148-152`) | OWNED_BY_CORE | `SESSION-<id>/VIDEO-0n.mp4` written by the capture worker, sealed as `fragments/VIDEO-0n.mp4` with `fragments.json`, manifest and signature (`apps/core-server/src/sealing/pipeline/contract.ts:7-26`, `R4` section 2b). The container (MPEG-TS or fMP4) is not an ownership question. | Q8 for the container |
| F04 | Audio evidence file, 1 to 2 inputs, `.flac` (`nvr/recorder.py:124-125`) | OWNED_BY_CORE | The one session audio track `AUDIO-01` carried inside the camera files (`S/evidence.ts:196-199`; `R5` 11.3). The Core has no separate audio file. | Q8: under "as input-av stores" it becomes GAP_IN_CORE |
| F05 | Audio evidence file, more than 2 inputs, `.wav` (`nvr/recorder.py:126-127`) | OWNED_BY_CORE | As F04. The Core track is mono (OD-06, `R5` 4.1), so the separate inputs are not kept as channels. | Q8: under "as input-av stores" it becomes GAP_IN_CORE |
| F06 | Audio capture input parameters, process arguments (`nvr/recorder.py:205-215`) | DROPPED | Not a record; it is logic (TS-10 of `R1`), judged by row 7. | - |
| F07 | Playback copy, video, `<stem>.play.mp4` (`nvr/playback.py:157-204`) | DROPPED | The Core serves the sealed file itself through the media route (`apps/core-server/src/modules/media-stream/index.ts:5-11`) and keeps no derived copy. Open consequence in section 11, risk R-3. | Row 7 and Q8 |
| F08 | Playback copy, audio, `<stem>.play.m4a` (`nvr/playback.py:147-154`) | DROPPED | As F07. | Row 7 and Q8 |
| F09 | Export package `EXPORTS_DIR/<case>_<session8>_<stamp>.zip` (`nvr/export.py:36-84`) | OWNED_BY_CORE | The `exports` table (`S/evidence.ts:286-321`) and the export job with its download (`apps/core-server/src/modules/evidence-export/index.ts:1-25`). | - |
| F10 | Generated ALSA configuration `DATA_DIR/alsa/dems-alsa.conf` (`nvr/audio.py:463-488`) | DROPPED | A derived file, rebuilt from the cards present; it holds no fact a registry lacks. Whether the Core's adapter generates its own is row 7 (H-15). One generator per host: see R-5. | Row 7 verdict on H-15 |
| F11 | Audio test recording in the system temporary directory (`nvr/audio.py:299-317`) | DROPPED | Temporary, deleted after one hour by the code itself. | Q10 |
| F12 | Application log lines on standard output; `mediamtx.log` (`R3` section 5 row 12; `scripts/start-lan-test.sh:42`) | DROPPED | Process logs of the input-av service; go with the service. | - |
| F13 | FFmpeg work products held in memory (`nvr/recorder.py:30,51,156-168`) | DROPPED | Not persisted except through `recordings.error` and `recordings.media_start_at`, which are fields of T07 (FG-08). | - |

### 4.6 State written outside the data directory (group X, `R3` section 5 second table)

| Id | Target | Outcome | Core record / reason | Depends on |
|---|---|---|---|---|
| X01 | MediaMTX path configuration (`nvr/mediamtx.py:65-93`) | DROPPED | Live preview only; OD-12 and class C-6 (`R5` 4.2, 5.2). | - |
| X02 | Temporary addresses on a host interface (`nvr/netalias.py:36-47`) | DROPPED | Host state, not a record. Its trace is T10c and A41 to A43. | Q10 |
| X03 | systemd inhibitor process (`nvr/service.py:300-320`) | DROPPED | A process, not a record. Logic item H-36, row 7. | - |
| X04 | Mixer gain on the sound card (`nvr/audio.py:178-185`) | DROPPED | Hardware state. Neither system stores the value; the only trace is A50. | Q10 |
| X05 | The camera's own network configuration (`nvr/factory.py:96,165-171`) | OWNED_BY_CORE | The fact the system keeps is the address of the registered camera: `capture_devices.address`, `mac` (`S/capture.ts:46-47`). The change action is A16, A17. | Q10 |

### 4.7 Installer artifacts (group I, `R3` section 6.1, `scripts/install.sh`)

None of these is a record of a session, a piece of evidence, an audit entry, a user, a device or a credential. All belong to the installation of the input-av service and go with it (C13). The Core's own production image and installer are out of scope of the task that built it (`R5` 13.4).

| Id | Artifact | Outcome | Reason | Depends on |
|---|---|---|---|---|
| I01 | System packages through apt (`scripts/install.sh:61-62`) | DROPPED | Host provisioning of the input-av service. | - |
| I02 | `/var/lib/dems-nvr-ieee.stamp` (`:68-71`) | DROPPED | As I01. | - |
| I03 | Service user `dems`, `audio` group membership (`:75-82`) | DROPPED | As I01. | - |
| I04 | `/usr/local/sbin/dems-netalias`, the root helper (`:86`) | DROPPED | As I01; it is the privileged part of the alias and passive tools. | Q10 |
| I05 | `/etc/sudoers.d/dems-netalias` (`:87-90`) | DROPPED | As I04. | Q10 |
| I06 | NTP switched on with `timedatectl` (`:93`) | DROPPED | Host setting, not a record. | - |
| I07 | Python virtual environment and its marker (`:105-109`) | DROPPED | As I01. | - |
| I08 | `bin/mediamtx` download (`:110-118`) | DROPPED | Preview only (X01). | - |
| I09 | Firewall rules (`:121-125`) | DROPPED | As I01. | - |
| I10 | `/etc/dems-nvr.env` with a generated JWT secret and administrator password (`:137-146`) | DROPPED | Goes with K02 to K04 and K07. | - |
| I11 | `/etc/systemd/system/dems-mediamtx.service` (`:148-160`) | DROPPED | As I01. | - |
| I12 | `/etc/systemd/system/dems-nvr.service` (`:161-181`) | DROPPED | As I01. This unit is what makes input-av a running recorder; C13 removes it. | - |
| I13 | `/etc/dems-nvr/install.json` (`:192-198`) | DROPPED | Read by the doctor only (`nvr/doctor.py:60`). | Q10 |
| I14 | Default data locations `/var/lib/dems-nvr` or `<source>/data` (`:39-43`) | DROPPED | A path choice, not a record. In development mode it is the evidence folder of section 9. | Q3 |
| I15 | Initial administrator password printed (`:216`) | DROPPED | As K07. | - |

### 4.8 Other scripts and deploy files (groups P and D, `R3` sections 6.2 and 6.3)

| Id | Artifact | Outcome | Reason | Depends on |
|---|---|---|---|---|
| P01 | `scripts/start-lan-test.sh`: virtual environment, `bin/mediamtx`, data directory, `mediamtx.log` (`:11-42`) | DROPPED | Starts input-av as a recorder; goes with the service. Its default data directory is `<root>/data` (`:11`), the folder of section 9. | Q3 |
| P02 | `scripts/dems-netalias`: `ip addr add` or `del`, `tcpdump` listen (`:28-45`) | DROPPED | Writes no file; host state only (X02). | Q10 |
| P03 | `scripts/uji/level_audio.py` | DROPPED | Reads a WAV and prints; writes nothing. | - |
| P04 | `scripts/uji/uji_discovery_link_down.py` | DROPPED | A test; calls `init_db()` on the data directory its caller sets (`:7`). | - |
| P05 | `scripts/uji/uji_multi_ruangan.py` | DROPPED | A test on a scratch directory. | - |
| D01 | `deploy/` (two unit files, `mediamtx.yml`, `Caddyfile`) | DROPPED | "None of these files writes a record at run time" (`R3` section 6.3). | - |

## 5. Reconciliation with row 3 (every line of row 3 appears once)

| Row-3 section | Lines in row 3 | Identifiers here | Count |
|---|---|---|---|
| 1.1 to 1.11, tables | 11 tables | T01, T02, T03, T04 (a, b, c), T05, T06, T07, T08, T09, T10, T11 | 11 tables as 13 units |
| 1.10, settings keys | 3 keys | T10a (as -1 to -6), T10b, T10c | 3 keys as 8 units |
| 2, audit format | 1 format | in T11 | 0 extra |
| 2.1, call sites | 53 | A01 to A53, same order | 53 |
| 2.2, detail payloads | attributes of the entries of 2.1 | no own unit; fields noted in section 7 | 0 |
| 3, token and credential material | 11 lines | password hash in T01; `DUMMY_HASH` K01; access token K02; refresh token in T02; preview token K03; media token K04; JWT secret F02; bootstrap administrator K07; camera credentials T04c; redaction K06; roles K05 | 7 new units |
| 4, `SiteSettings` fields | 19 fields | T10a-1 to T10a-6 | counted above |
| 4, environment keys | 23 names | C01 | 1 |
| 5, disk artifacts | 13 | F01 to F13, same numbering | 13 |
| 5, external state | 5 | X01 to X05, same order | 5 |
| 5.1, lifecycle values | values of `status` columns | attributes of T06, T07 | 0 |
| 6.1, installer | 15 lines | I01 to I15, same order | 15 |
| 6.2, other scripts | 5 | P01 to P05 | 5 |
| 6.3, deploy | 1 group | D01 | 1 |
| 7, sources that are only read | not written by input-av | none | 0 |
| **Total units** | | 13 + 8 + 53 + 7 + 1 + 13 + 5 + 15 + 5 + 1 | **121** |

The 11 tables of row 3 equal the 11 `__tablename__` matches it reports (`R3` section 0). The 53 audit lines equal its grep count.

## 6. What the Core lacks (the 13 `GAP_IN_CORE` lines as six gaps)

| Gap | What is missing in the Core | Lines | Needed when | Created by the port? |
|---|---|---|---|---|
| G-1 | A stored installation-acceptance record and its audit types (accepted, reset) | T10b, A09, A10 | If an acceptance gate before the first recording is kept in any form (Q10) | Yes, if kept |
| G-2 | A stored setting naming the camera network interface and subnet | T10a-3 | If adopted discovery or address-follow logic is tied to one port (row 7, H-23 to H-27) | Yes, if adopted |
| G-3 | An audit type for "the address of a registered camera changed" | A12 | If address-follow by MAC is adopted (row 7, H-11) | Yes, if adopted |
| G-4 | Audit types for actions that change a network: factory-address scan, camera network set, host address added, removed, removal failed | A15, A16, A17, A41, A42, A43 | If the factory-IP scan, set camera IP or the alias helper survive in any form (Q10) | Yes, unless Q10 = drop |
| G-5 | An audit type for a change of capture gain | A50 | If gain calibration survives in any form (Q10) | Yes, unless Q10 = drop |
| G-6 | An operation that creates an operator, with its audit type; an audit type for a password change | A28 (and the note of A29) | Already needed by the Core for production (D241) | No: pre-existing, owned by another task |

Reading for row 8: G-1, G-4 and G-5 are the price of keeping the installation tools **without** a second audit log. An action that changes a camera's address or the host's network and is recorded nowhere would break the task-3 rule that "every step [is] audited without values" (D76 (3), `R5` 3.1). So for each of these the choice is between a Core audit type and removing the action, never an unrecorded action and never a private log.

Every new audit type is a change to the shared vocabulary and its category map (`VOC:346-511`) and to the exact detail-key lists; the audit writer rejects an unknown type (`apps/core-server/src/core/audit-writer.ts:198-199`, `R4` section 3). Under U3 nothing of this is touched now; it is listed for the work packages of row 8.

## 7. Fields without a home inside records the Core owns

These do not change an outcome of section 4. They are the content that would be lost, or that row 8 has to place, when the Core becomes the only writer.

| Id | input-av field | Record | State in the Core | For |
|---|---|---|---|---|
| FG-01 | `device_group`, `lens`, `video_source_token` (one physical dual-lens camera as several rows; `nvr/db.py:82-87`) | T04a | `capture_devices.profiles` is a JSON array and `capture_config` holds a profile per slot (`S/capture.ts:49,94-155`); the Core's ruling supports "one dual-lens or two PoE" (OD-05, `R5` 4.2). Whether `profiles` carries the video-source grouping was not established here. | Row 7 (H-03) |
| FG-02 | `record_stream` main or sub, `preview_url`, `device_info.preview_*` (`nvr/db.py:88,98-102`) | T04a | The recorded profile is `capture_config.video_0n_profile`. Preview fields go with X01. | Row 8 |
| FG-03 | `device_info.last_test` (`nvr/routers/admin.py:416-424`) | T04a | The Core audits each test as `CAPTURE_CONNECTION_TESTED` (`VOC:432`) and stores no "last result" on the device. | - |
| FG-04 | `device_info.audio`: `inputs`, `device_channels`, `sample_rate`, `bits` (`nvr/routers/audio.py:117-118,193-195`) | T04b | No column of `capture_devices` holds an input selection or a sample format (`S/capture.ts:38-57`). The Core's audio contract is one channel at 48 kHz (`R4` section 7, last row). | Row 7 (H-16, H-18), row 8 seam S3, Q8 |
| FG-05 | `device_info.av_offset_ms` (`nvr/routers/audio.py:195,242-243`) | T04b | None. In input-av it is applied only in the playback copy (`R1` 5.3), which is dropped (F07). | Row 7 |
| FG-06 | `sessions.extra` (free metadata), `clock_synced`, `site` snapshot, `stopped_by` (`nvr/db.py:120-141`) | T06 | Typed columns instead of free metadata: `subject_type`, `subject_name`, `investigator_id`, `input_notes`; time source instead of a flag: `start_time_source`, `stop_time_source`; `stopped_by` exists (`R4` section 1). No site snapshot on the session beyond `room`. | - |
| FG-07 | `recordings.part` (a lost stream closes the file and continues as the next numbered, separately hashed part; `nvr/service.py:152,205-211`) | T07, A05 | `evidence_tracks` has one row per track id, key `(evidence_id, track_id)` with track ids `VIDEO-01`, `VIDEO-02`, `AUDIO-01`, `AUDIO-02` (`S/evidence.ts:206-247`); continuity is recorded per fragment in `recording_fragments`. A file-per-part model has no place in that key. | Row 7 (H-10), row 8 seam S6 |
| FG-08 | `recordings.media_start_at`, `error` (`nvr/db.py:160-163`) | T07 | Per-fragment media times in `recording_fragments.media_start_ms` (`S/recording.ts:99-128`); faults as audit and alert rows. | Row 7 (H-09) |
| FG-09 | Card identity written to the session-start audit: card, product, USB id, channels, inputs (`nvr/service.py:141-147`) | A04 | `session_capture_sources` records device id and adapter kind per slot (`S/recording.ts:183-210`); the model is on `capture_devices.model`. The audit detail keys are a closed list and forbid some identifiers (`R4` cross-cutting fact 4). | Row 8 seam S3 |

## 8. The non-recording tools

### 8.1 What each tool still writes if it is kept as built

Facts from `R1` section 5, checked against the source lines cited. "Record kind the Core owns" refers to the eight kinds of goal G2.

| Tool | What it writes if kept as built | Core owns that kind? | Statement |
|---|---|---|---|
| **Factory-IP scan** (`nvr/factory.py:40-79`) | (1) `devices` rows through `discovery.service._seen` (`nvr/factory.py:68-69`); (2) audit entries `device.factory_scan`, `device.discovered`, `device.online`, `device.ip_changed`, `network.alias_add`, later `network.alias_remove` (`nvr/factory.py:76`, `nvr/netalias.py:101,133`); (3) `settings` row `net_aliases` (`nvr/netalias.py:63-70`); (4) a temporary address on the host interface | (1) device registry entry: yes; (2) audit entry: yes; (3) no; (4) not a record | **Does not write "no record the Core owns".** Must go: the `devices` rows (T09). Must move to the Core's chain or go with the action: the audit entries (G-4). May stay as local tool state: `net_aliases`. |
| **Set camera IP, with the new-camera wizard** (`nvr/factory.py:82-104,137-203`) | (1) audit `device.set_ip` (`nvr/factory.py:99,171`); (2) wizard: a `devices` row (`nvr/factory.py:185`); (3) wizard with a room: `cameras` rows that include the camera user name and password in plain text, and audit `camera_device.register` (`nvr/factory.py:187-193`, `nvr/registration.py:62-64,74`); (4) an in-memory job list; (5) the camera's own network configuration and possibly a reboot | (1) audit entry: yes; (2) device registry entry: yes; (3) device registry entry and camera credential: yes; (4), (5) not records | **Does not write "no record the Core owns".** Must go: the wizard's registration step, with its `cameras` rows and plain-text credential (T04a, T04c), and the `devices` row. Must move or go with the action: `device.set_ip` (G-4). It also **receives** a camera user name and password in its request (`nvr/routers/devices.py:81-99`), which meets the Core rule that a camera credential is typed in the web console only (D80 (3), `R5` 7.1): for row 13. |
| **Gain calibration** (`nvr/audio.py:155-321`, `nvr/routers/audio.py:70-79,121-179`) | (1) audit `audio.mixer` (`nvr/routers/audio.py:77`); (2) when a source or its offset is saved: `cameras.device_info.audio`, `av_offset_ms`, and audit `audio_source.create`, `audio_source.update` (`nvr/routers/audio.py:192-198,240-247`); (3) the shared ALSA configuration, regenerated when the meter or the test record starts (`nvr/audio.py:210,306`); (4) temporary WAV files; (5) the MediaMTX path `audiomon` for the live monitor; (6) the gain in the card's mixer | (1) audit entry: yes; (2) device registry entry and audit entry: yes; (3) to (6) not records | **Does not write "no record the Core owns".** Must move or go with the action: `audio.mixer` (G-5). Must go: saving an audio source into `cameras`; the selection it describes needs a home in the Core's registry (FG-04, FG-05). The meter, the monitor and the test record on their own write no record. |
| **Doctor** (`nvr/doctor.py:43-184`) | (1) It calls `init_db()` before any check (`nvr/doctor.py:44-45`), which creates all eleven tables and adds missing columns with `ALTER TABLE` (`nvr/db.py:249-266`): a second, empty system-of-record schema on any machine it runs on. (2) No audit entry, no settings row of its own. (3) Its result is stored by commissioning as the `settings` row `commissioning` and the audit `system.commissioned` (`nvr/commissioning.py:84-95`) | (1) creates the containers of seven kinds the Core owns; (3) audit entry: yes | **Writes no audit entry and no settings row itself, but it creates the whole input-av database.** Must go: the `init_db()` call and the read of audio sources from `cameras` (`nvr/doctor.py:115-117`). The Core already has a place for a diagnostics result: operation 65 with audit `DIAGNOSTICS_RUN` and `hardware_snapshot.diagnostics` (`apps/core-server/src/modules/system/index.ts:7`; `S/core.ts:232`; `VOC:392`). The stored acceptance is G-1. |

All four are reached through the input-av API as its `admin` role (`nvr/routers/devices.py:70-99,149-154`, `nvr/routers/audio.py:70-79`), so keeping any of them behind that API also keeps `users`, `refresh_tokens` and the JWT secret alive: a second user base (T01, T02, F02). Only the doctor has another entry, a command line (`python -m nvr.doctor`, `R1` 5.4).

Adjacent tools of `R1` section 5.5, for completeness: the alias helper (`settings` row `net_aliases`, three audit actions: T10c, A41 to A43); the passive cable monitor (`devices` rows, audit `device.dhcp_request`: T09, A38); commissioning (T10b, A09, A10); the installer (group I); the stream test (`cameras.device_info.last_test`, no audit: FG-03).

### 8.2 Outcome of each tool's records under the three answers to Q10

| Tool | "Port" (the function moves into the Core) | "Keep as an installation tool" | "Drop" |
|---|---|---|---|
| Factory-IP scan | Audit: G-4 closed in the Core. `devices` rows: dropped; results are shown as candidates, not stored (RG-4). `net_aliases`, factory parameters: become Core records (T10c, T10a-5 turn into gaps). Needs a ruling: the scan reads devices directly, which the present search may not ("no follow-up TCP read", D80 (1), `R5` 7.1). | Allowed by C13 only if it opens no input-av database: no `_seen`, no `audit.log`. Its actions then have no record unless G-4 is closed and the tool reports to the Core. Local alias state may stay. | A15, A41 to A43, T10a-5, T10c, X02, I04, I05, P02: all dropped. No gap. |
| Set camera IP and wizard | Audit: G-4 closed. Credential: through the Core's write-only path (operation 89 or 96, `R5` 14.3). Registration: the Core's adoption (A01). | Only the set-IP action without the registration step; the credential question stays (row 13); the action needs G-4 or stays unrecorded. | A16, A17 dropped. Cameras must then be given their addresses by other means before the Core is used. |
| Gain calibration | Audit: G-5 closed. Input selection and offset: FG-04, FG-05 placed in the Core registry. Meter: the Core adapter's `level()` member exists in the contract (`R5` 6.2). | Meter, monitor, test record only; gain changes need G-5 or stay unrecorded (the bench already shows the weakness: a gain set with `amixer` directly is in no audit log and is lost when the card is re-plugged, `R1` 5.3). One ALSA generator per host (R-5). | A50 dropped. Levels are set on the hardware and nothing records it. |
| Doctor | The checks feed the Core's diagnostics record (operation 65, `DIAGNOSTICS_RUN`). G-1 closed if acceptance is kept. | As a command-line check that opens no database (the `init_db()` call and the `cameras` read removed). Then it writes nothing: the only one of the four that can reach "writes no record the Core owns" by removal alone. | Dropped with I13. |

These lines are **provisional until Q10 is answered** (`identification/02_structured.md:222`).

## 9. The existing data of input-av

| Item | Outcome | Status |
|---|---|---|
| Everything already written under `apps/input-av/data/` | none assigned | **WAITING FOR OPEN DECISION Q3** (`identification/02_structured.md:211`; question text `identification/01_translated.md:147`) |

What is known without opening the folder:

- By the code, the folder holds the database `nvr.db` with its write-ahead side files, `.jwt_secret`, `recordings/`, `exports/` and `alsa/dems-alsa.conf` (`R3` section 5, rows 1, 2, 3 to 5, 9, 10). By the hand-over document as cited in the translation, it holds 15 sessions that are test recordings but are still treated as evidence data (`identification/01_translated.md:147`; not re-read here).
- The folder is untracked in the DEMS repository and listed in input-av's own ignore file: `git status --short apps/input-av` prints `?? apps/input-av/`; `git check-ignore -v apps/input-av/data` prints `apps/input-av/.gitignore:2:data/` (both run 2026-10-12; neither opens the folder).
- If Q3 is answered "bring it into the Core", the map above shows where that has no lossless target today: recordings in numbered parts (FG-07); separate FLAC or WAV audio and MPEG-TS video against the Core's track model (F03 to F05); audit rows of another hash form whose actor is not a Core operator (T11; `audit_log.actor_id` references `operators.id`, `R4` section 3); plain-text camera credentials (T04c); and no evidence class for an item that was not sealed by the Core (`integrity_source` is `DEMO_PACKAGE`, `SIMULATED` or `REAL`, `R4` section 2a).
- If Q3 is answered "leave it as a separate archive", no line of section 4 changes.

Effect on the closing count: under the reading of section 2.2 (an owner is a system that writes), a frozen archive adds no owner. If the user reads a retained archive as a second holder of sessions, evidence and audit entries, the count for those kinds is not settled until Q3 is. This is the one point where the count depends on a reading, and it is reported as such.

A fact that bears on Q3 before it is answered: three things in the input-av tree would write into that folder if run from the source directory, because the data directory defaults to `data` relative to the working directory (`nvr/config.py:11`) and to `<root>/data` in the test launcher (`scripts/start-lan-test.sh:11`; installer development mode `scripts/install.sh:39-43`). The doctor calls `init_db()`, which issues `ALTER TABLE ... ADD COLUMN` on an existing database when a model column is missing (`nvr/db.py:254-264`). The audio meter and test record regenerate `alsa/dems-alsa.conf` under the data directory (`nvr/audio.py:210,306,395`). Starting the application writes audit rows (`nvr/main.py:50`). So "keep the doctor as a tool" is not neutral toward the evidence folder as the code stands.

## 10. Closing count and the single-record statement

### 10.1 Ownership by record kind (goal G2)

| Record kind | Owner after the port | Fate of the input-av counterpart | Owners |
|---|---|---|---|
| Session | Core: `active_session`, `session_history` | T06 no longer written | 1 |
| Recording or evidence file | Core: `evidence_items`, `evidence_tracks`, `recording_fragments`, files on the media store | T07, F03 to F05 no longer written; F07, F08 dropped | 1 |
| Audit entry | Core: `audit_log` with its chain head | T11 and all 53 actions no longer written; 11 actions need a Core type or go (section 6) | 1 |
| User or role | Core: `operators`, `operator_credentials`, `roles`, `permissions`, `auth_sessions` | T01, T02, K01 to K05, K07, F02 no longer written | 1 |
| Device registry entry | Core: `capture_devices`, `capture_config` | T04a, T04b no longer written; T09 dropped | 1 |
| Camera credential | Core: `capture_device_credentials` | T04c no longer written | 1 |
| Setting | Core: typed single-row tables | T10 dropped; one group is a gap (G-2) | 1 |
| Marker | Core: inside the session and the evidence item, plus the audit entry | T08 no longer written | 1 |
| Further kinds found: case, room, export, media token | Core (case number and room as session attributes; `exports`; signed media session) | T05, T03, F09, K04 | 1 |
| Further kinds found: network device inventory, playback copy, preview, installation acceptance, tool state | none, or a gap (G-1) | T09, F07, F08, X01, T10b, T10c | 0 |

**Record kinds with two owners after the port: 0.**

### 10.2 Conditions that keep it at 0

| # | Condition | Authority |
|---|---|---|
| TC-1 | The input-av application (`nvr.main`, the unit of I12) does not run as a service on the target installation. | C13; P4 |
| TC-2 | No surviving tool opens the input-av database: no `init_db()`, no `audit.log(...)`, no `_seen(...)`, no `Setting` row that mirrors a Core setting, no `register_onvif_device(...)`. | C13; section 8.1 |
| TC-3 | No surviving tool is reached through input-av's own users and tokens. | C6 (one RBAC base), section 8.1 |
| TC-4 | No surviving tool stores a camera credential, and none receives one outside the Core's path. | D76, D80 (3), C6 |
| TC-5 | The existing data has no writer. | Q3; section 9 |

### 10.3 What makes it non-zero

| Case | Kinds with two owners | Which |
|---|---|---|
| Any of the four tools kept **as built** behind the input-av API | up to 5 of the 8 kinds of G2 | audit entry (all four through the API's sign-in and their own actions), user or role (T01, T02), device registry entry (scan, wizard, calibration), camera credential (wizard with a room), setting (`site`, `net_aliases`) |
| The doctor kept as built, command line only | 0 written, but the input-av schema is created on the machine (section 8.1) | containers only |
| Q3 answered "import" while input-av still serves the same data | sessions, evidence, audit entries | until the archive is frozen |
| Q8, either answer | 0 | the stored form changes, not the owner |
| Q6, either answer | 0 | a room entity would be added to the Core, not kept in input-av |

A different defect than a double owner, named so it is not hidden by the count: a tool kept under TC-2 whose gap (G-1, G-4, G-5) is not closed performs actions that **no** system records.

## 11. Findings, risks, assumptions, alternatives

### 11.1 Key findings

| # | Finding | Confidence | Evidence | Implication |
|---|---|---|---|---|
| 1 | Every one of the eight record kinds of G2 has a Core record. The port adds no record kind to the Core for sessions, evidence, users, devices, credentials or markers. | HIGH | `R4` summary table; section 10.1 | The single-record goal is reachable by removal, not by building a second store. |
| 2 | 13 of 121 records are gaps, and 12 of them concern installation actions or follow from a logic verdict; none concerns a session or a piece of evidence. | HIGH for the count, MEDIUM for G-2 and G-3 | section 6 | The cost of "no double recording" lies in the installation tools, not in the recording path. |
| 3 | None of the four non-recording tools, as built, satisfies C13. The doctor comes closest and still creates the database. | HIGH | `nvr/doctor.py:44-45`; `nvr/factory.py:68-69,76,99,185-193`; `nvr/routers/audio.py:77,192-198` | Q10 "keep as a tool" always means "keep after cutting its record writes", which is implementation work on input-av. |
| 4 | Keeping a tool behind the input-av API keeps a second user base. | HIGH | `nvr/routers/devices.py:70-99,149-154` | A kept tool needs a different entry: a local command line, or the Core's sign-in. |
| 5 | The wizard stores a camera password in plain text and the set-IP call receives one. | HIGH | `nvr/registration.py:62-64`; `nvr/routers/devices.py:81-99`; `nvr/db.py:76-79` | A Core guarantee (sealed, write-only credential) is at stake if the wizard survives as built: for row 13. |
| 6 | Running the doctor, the meter or the application from the source tree writes into the folder that holds the existing data. | HIGH for the code path, not observed | `nvr/config.py:11`; `nvr/db.py:254-264`; `nvr/audio.py:395` | Q3 needs an answer, or at least a "do not run from this tree" rule, before any tool is tried. |
| 7 | The Core records a lost stream as fragments and faults on one track; input-av records it as numbered, separately hashed files. | HIGH for the schemas | FG-07 | The reconnect rule (H-10) cannot be adopted with its record form unchanged: for rows 7 and 8. |

### 11.2 Risks

| # | Risk | Trigger | Mitigation |
|---|---|---|---|
| R-1 | An audit-type match of section 4.2 is right in meaning but the Core's exact detail keys cannot carry what the ported path needs to say. | Row 8 designs the detail of a type marked "Class C" | Row 8 reads `apps/core-server/src/core/audit-details.ts` for each type it uses; the detail lists were not read for this map (section 13). |
| R-2 | A `DROPPED` line that depends on a row-7 verdict (T09, T10a-6, A11, A38, F10) turns into a need. | Row 7 gives ADOPT to H-23, H-25, H-27, H-28 or H-37 in a form that stores state | The dependency is named on each line; row 8 re-reads those lines after row 7. |
| R-3 | Dropping the playback copy leaves no way to play H.265 evidence in a browser. input-av makes the copy for that reason ("browsers cannot play H.265", `R1` H-33, H-34). | C11 keeps H.265 and Q8 keeps it in the stored file | Row 7 parameter table and row 8 stored-form variants state how a sealed H.265 file is played. A derived viewing copy, if chosen, is a new Core artifact that must be marked as not evidence, as input-av marks it (`nvr/db.py`, quoted in `R3` 1.7). |
| R-4 | The count of 0 is read as "nothing left to decide". | Report summarised without section 10.2 | The conditions and the three non-zero cases are part of the count. |
| R-5 | Two generators of a shared-capture ALSA configuration on one host (a kept calibration tool and the Core's adapter) open the same card with different parameters. | Q10 "keep" for gain calibration together with ADOPT for H-15 | One generator per host; stated as a design rule for row 8. Hypothesis: not tested, derived from the code's one-rate-per-card rule (`R1` H-15, H-18). |
| R-6 | The existing data is altered by a tool run from the source tree. | Finding 6 | Blanket limit of this task holds; for later work, row 10 carries it. |

### 11.3 Assumptions

| # | Assumption | If wrong |
|---|---|---|
| AS-1 | "Owner" is the system that writes a record after the port. | Section 9: the count for sessions, evidence and audit depends on Q3. |
| AS-2 | The rulings of task 3 collected by row 5 are in force as it reports (one session per Core, OD-06, OD-12, RG-4, D76, D80). | Lines T03, T09, A23, F04, F05 change as their "Depends on" column says. |
| AS-3 | Rows 3 and 4 are complete. Row 3 read four modules by write-pattern search only (`R3` section 9); row 4 did not read migrations beyond two files (`R4` last section). | A record missed there is missing here. |
| AS-4 | P3 and P4 are the controller's readings and are confirmed by the user later (`decisions/decisions.md:9-10`). | A narrower reading of "pencatatan ganda" would allow more of input-av to stay; this map then overstates what must go. |

### 11.4 Alternatives considered for the map itself

| Alternative | Why not chosen |
|---|---|
| One outcome per table, without splitting `cameras` and `site` | A table would carry two outcomes, which the row forbids. |
| One line for "the audit log" instead of 53 | The gaps are in the actions, not in the table; a single line would have read "owned" and hidden G-1, G-4, G-5. |
| A fourth outcome "kept by the tool" | The row fixes three. Tool-local state is placed under `DROPPED` with the entry Q10 named, and section 8.2 gives the three variants. |
| Deciding Q10 here | Not this row's decision (`identification/02_structured.md:222`); row 9 carries it. |

## 12. Confidence by part

| Part | Confidence | Reason |
|---|---|---|
| Group T outcomes | HIGH | Both sides are declared schemas with `file:line`. |
| Group A outcomes `OWNED_BY_CORE` | MEDIUM | Matched by the meaning of the type name and its category; detail-key lists not read; "Class C" types have no writer on a real device path yet. |
| Group A outcomes `GAP_IN_CORE` | HIGH | The full list of 67 types was read (`VOC:346-435`); none covers the action. |
| Groups K, C, F, X, I, P, D | HIGH | Mostly not records, or files with a declared Core counterpart. |
| Section 8 | HIGH | Each write was checked at its source line. |
| Section 9 | LOW by design | The folder was not opened. |

## 13. Verification, and what was not verified

Core and input-av lines opened read-only for this map (beyond what rows 1, 3, 4, 5 quote): `packages/shared/src/sim/vocabulary.ts:340-511`; `apps/core-server/src/db/schema/core.ts:55-314`; `apps/core-server/src/db/schema/capture.ts:38-62`; `apps/core-server/src/db/schema/sessions.ts:33-50,146-150` (by search); `apps/core-server/src/modules/system/index.ts:1-30`; `apps/core-server/src/modules/devices/index.ts:1-30`; `apps/core-server/src/modules/media-stream/index.ts:1-40`; `apps/core-server/src/modules/evidence-export/index.ts:1-45`; `apps/core-server/src/capture/boot/checks.ts` (search for check names, lines 21-35 and 86-103); `apps/input-av/nvr/doctor.py:40-48,112-118`; `nvr/config.py:9-15`; `nvr/db.py:247-266`; `nvr/routers/devices.py:62-100`; `nvr/factory.py:183-195`; `nvr/registration.py:58-72`; `nvr/audio.py:205-212,304-308`. Searches: `pgTable(` over `S/` (43 declarations, equal to row 4's count); `gain|av_offset|avOffset|commission|subnet` over `S/` (5 matching lines, none a column: the words "against" and "gains" in comments).

Not verified:

- The exact detail keys of each Core audit type (`apps/core-server/src/core/audit-details.ts` was searched for type names only).
- Whether `capture_devices.profiles` can express a dual-lens grouping (FG-01).
- Where the Core sets its storage thresholds (T10a-6 states only that they are not in `storage_policy`).
- Any content of `apps/input-av/data/`, and the hand-over document's statement about 15 sessions.
- The citations taken from rows 1, 3, 4, 5 without re-opening the line are marked by their `R` prefix.

Row 6 verification cells (`identification/02_structured.md:142`):

| Criterion | Result | Where |
|---|---|---|
| Every record of step 3 appears once with one outcome | 121 units, reconciled against every section of row 3 | sections 4 and 5 |
| The closing count "record kinds with two owners after the port" equals 0 | 0, with five conditions and the cases that make it non-zero | section 10 |
| Each of the four tools has a line stating "writes no record the Core owns" or naming the record that must move or go | Four lines; each names records that must move or go | section 8.1 |
| Fate of the existing data tied to Q3 | One line, marked waiting | section 9 |

## 14. Recommendations

1. **Row 8** treats C13 as "tools after cutting": for every tool it proposes to keep, it lists the write sites of section 8.1 that are removed, and names the entry by which the tool is reached (TC-3).
2. **Row 8** gives each of G-1, G-4, G-5 one of two endings, a Core audit type or removal of the action, and never an unrecorded action (section 6).
3. **Row 7** returns to lines T09, T10a-3, T10a-6, A11, A12, A38, F10 once its verdicts on H-11, H-15, H-23 to H-28, H-37 exist; those verdicts decide whether G-2 and G-3 are real.
4. **Row 9** puts to the user, with Q10, the fact that "keep as a tool" needs changes to input-av itself, and with Q3 the fact of finding 6. Suggested default for Q3 from this map alone: leave the folder as a separate, unwritten archive, because an import has no lossless target today (section 9). The decision stays the user's.
5. **Row 13** takes findings 4 and 5 (second user base behind a kept tool; the credential path of set camera IP and the wizard).
6. **The controller** records the reading AS-1 and the placement of tool-local state under `DROPPED` as decisions of this row, so that the verifier checks the count against the same reading.

## 15. External research synthesis

No external research dimension is in scope for this task (`identification/01_translated.md:100-102`); no findings for dimensions 1 to 7.

## 16. Plan artifact

No `masterplan/02_plan.md` was written by this row. The plan is row 10's deliverable (`identification/02_structured.md:146`).

---
*Generated: 2026-10-12 17:34*
*Last Updated: 2026-10-12 17:34*
