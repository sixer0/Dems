---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 8b
date: 2026-10-12
agent: database-specialist
type: schema design (no migration written, no database connected, no source file modified)
narrative_tier: 1
confidence: HIGH for every statement about existing code that carries file:line (each line was opened in this pass unless marked "via R3/R4/R6"); MEDIUM for the proposed shapes (they are design, to be re-measured from the generated SQL); LOW wherever marked HYPOTHESIS
status: proposed - nothing here is applied until implementation is approved (U3, U5)
source_decisions: decisions/decisions.md (U1 line 7, U2 line 8, U3 line 13, U5 line 15, U6 line 16, U7 line 18, U8 line 19)
inputs: research/02_collection_input_av_records.md (R3); research/02_collection_core_records.md (R4); research/03_analysis_record_map.md (R6); research/03_analysis.md (R7); masterplan/01_specs.md (SPEC, read while Amendment 1 was being written: cited by section name, never by line); research/02_collection_rulings.md (R5)
last_updated: 2026-10-12 18:27
---

# Extension of the Core's PostgreSQL schema for the data of the ported input-av functions

> **Ringkasan (Bahasa Indonesia).** Dokumen ini adalah DESAIN perluasan skema PostgreSQL Core sesuai putusan U8 ("database kita perlu diadaptasi untuk menyimpan kebutuhan data tambahan sesuai input-av"). Tidak ada migrasi yang ditulis atau dijalankan, tidak ada database yang dibuka, tidak ada berkas sumber yang diubah. Isinya: (1) inventaris 63 butir data input-av dengan sumber `file:baris` dan SATU putusan per butir: 17 sudah punya kolom di Core, 22 mendapat tempat baru (20 di empat tabel baru, 2 di satu kolom baru), 16 sengaja tidak disimpan, 8 menunggu keputusan; (2) rancangan tabel: `capture_device_streams` (token profil dan video-source ONVIF, lensa, main/sub, codec, ukuran gambar), `capture_audio_inputs` (identitas kartu suara USB, nomor input, format), kolom `session_capture_sources.source_facts` (identitas perangkat yang benar-benar dipakai per sesi), `capture_network_config` (interface dan subnet kamera, daftar IP pabrik, oktet dan umur alias, IP awal kamera), `host_network_aliases` (alias sementara yang sedang terpasang, dengan waktu kedaluwarsa yang tersimpan), dan `installation_acceptances` (berita acara setup awal; tabel kelima, hanya bila pertanyaan OQ-2 dijawab ya); (3) cara pengiriman: tiga set migrasi terpisah mengikuti pola Core hari ini (berkas hasil `drizzle-kit generate` + berkas hak akses tulisan tangan yang menaikkan versi skema 6 -> 7 -> 8 -> 9), daftar "pin" uji yang harus ikut berubah, rollback per set, dan tiga paket kerja baru WP-24, WP-25, WP-26; (4) lima pertanyaan untuk pengguna dengan rekomendasi. Kredensial kamera tetap di mekanisme tersegel dan hanya-tulis milik Core: tidak ada kolom kata sandi baru, tidak ada URL berisi kredensial. Pemeriksaan "jenis catatan dengan dua rumah" = 0. Temuan sampingan untuk WP-04: token profil ONVIF boleh berhuruf kecil, sedangkan kolom pemilih profil Core hanya menerima bentuk KODE huruf besar; rancangan ini menyelesaikannya tanpa mengubah CHECK yang ada.

## 0. Frame (5W1H), method, limits

| Question | Answer |
|---|---|
| **What** | The design of the schema extension: a data-needs inventory with one verdict per item (section 1), the proposed tables and columns with constraints, grants, audit type and retention (section 2), the delivery plan with pins, compatibility and rollback (section 3), open questions and assumptions (section 4). |
| **Why** | U8 (`decisions/decisions.md:19`, verbatim): "database kita perlu diadaptasi untuk menyimpan kebutuhan data tambahan sesuai input-av". The controller's reading on the same line: the gaps of the record map and the data of the ported functions "get a place in the Core schema instead of being dropped". U1 keeps the limit: no second system of record (`decisions/decisions.md:7`). U6/U7 make the network functions required and place them in the Core (`decisions/decisions.md:16,18`). |
| **Who** | Decision owner: the user (section 4). Consumers: the controller (adoption of WP-24 to WP-26 into the plan), the future migration writer (one writer at a time, `apps/core-server/src/db/schema/index.ts:26-28`), WP-04, WP-07, WP-19, WP-22, WP-23 of SPEC section 9, the soundness and security rows. |
| **When** | Designed 2026-10-12. Applied only after the user approves implementation (U3, U5: `decisions/decisions.md:13,15`). Line numbers are of the working tree of that day, which holds uncommitted changes. |
| **Where** | Target: `apps/core-server/src/db/schema/`, `apps/core-server/src/db/migrations/`, `apps/core-server/test/db/`, `apps/core-server/src/db/reset/`. Source of the data needs: `apps/input-av/nvr/`. |
| **How** | Every input-av item was taken from R3 and SPEC section 4 ("persistent data" table) and re-opened at its source line; every Core statement was re-opened at the declaration. Each item got one verdict by the rules of section 1.1. Shapes follow the Core's existing patterns, each named with its precedent. |

**Abbreviations.** `S/` = `apps/core-server/src/db/schema/`; `M/` = `apps/core-server/src/db/migrations/`; `T/` = `apps/core-server/test/db/`; `IAV/` = `apps/input-av/nvr/`; `VOC` = `packages/shared/src/sim/vocabulary.ts`; R3, R4, R6, R7, SPEC as in the header.

**Limits observed.** No source file modified. No database connection, no `db:generate`, no migration file created. Nothing under `apps/input-av/data/` and no `.env` opened. Two files written, both in the task folder. `masterplan/01_specs.md`, `02_plan.md` and the decision files were read, not edited. Graft was not queried (it refreshes its graph before a query, which writes outside the task folder); the questions here are about declarations, which were read directly.

**Reading rule for SPEC.** `masterplan/01_specs.md` was being amended by another agent during this pass (it grew from 485 to 619 lines between two reads). It is cited by section and item name (for example "SPEC F-4.2 DR-3"), never by line.

## 1. Data-needs inventory

### 1.1 Verdict rules

| Verdict | Meaning |
|---|---|
| **HAS** | The Core already has a column for it. Named with file:line. No DDL. |
| **COL** | A new column on an existing Core table. |
| **TBL** | A column of a new table (the table is named; its full shape is in section 2). |
| **NOT** | Deliberately not stored, with the reason. |
| **WAIT** | Waits for an open decision, which is named. A shape is still given in section 2 where one is needed to decide. |

One item, one verdict. A point-in-time copy that belongs to a session or to an acceptance record (a "snapshot") is not counted as a second home of the live value; input-av draws the same line ("tidak ikut berubah bila pengaturan diubah", `IAV/db.py:135`). This reading is assumption AS-2.

### 1.2 Per camera (input-av table `cameras`, rows of kind `video`)

| # | Data item | input-av source | Verdict | Home in the Core, or reason |
|---|---|---|---|---|
| D-01 | MAC address | `IAV/db.py:85`; read at `IAV/registration.py:47-49` | HAS | `capture_devices.mac` (`S/capture.ts:47`), pattern `^[0-9A-F:]{17}$` (`S/capture.ts:76`), runtime-updatable (`M/0005_capture_privileges.sql:39-40`). input-av stores lower case (`IAV/registration.py:49`); the Core form is upper case, so the writer converts. |
| D-02 | Host | `IAV/db.py:74` | HAS | `capture_devices.address` (`S/capture.ts:46`). |
| D-03 | ONVIF port | `IAV/db.py:75` | HAS | Same column: the adopted address is "Host, or host and port: never a locator with a user part" (`apps/core-server/src/modules/capture-discovery/adoption.ts:35`). |
| D-04 | Camera user name and password | `IAV/db.py:76-77`; written `IAV/registration.py:63` | HAS | `capture_device_credentials` (`S/capture.ts:164-190`): AES-256-GCM envelope, no SELECT for the runtime role (`M/0005_capture_privileges.sql:21`), one read path through the `SECURITY DEFINER` function (`M/0005_capture_privileges.sql:61-76`). **No new column.** The plain-text form is never carried. |
| D-05 | Record address with the credential inside (`rtsp_url`) | `IAV/db.py:79` ("berisi kredensial; jangan diekspos") | NOT | A credential-bearing locator is never composed or stored; the locator is resolved at each open (SPEC section 3.1, item H-11; SPEC section 5, row "Credential"). |
| D-06 | ONVIF profile token of the recorded stream | `IAV/db.py:78`; `IAV/registration.py:64` | TBL | `capture_device_streams.onvif_profile_token`. The selector keeps naming a profile by a Core code (`capture_config.video_0n_profile`, `S/capture.ts:99,101`). See finding F-DB-1 below. |
| D-07 | Video-source token | `IAV/db.py:87`; `IAV/registration.py:69` | TBL | `capture_device_streams.video_source_token`. Closes R6 FG-01. |
| D-08 | Lens number | `IAV/db.py:86`; `IAV/registration.py:68` | TBL | `capture_device_streams.lens`. |
| D-09 | Device group (several rows = one physical dual-lens camera) | `IAV/db.py:82-84`; `IAV/registration.py:59,68` | HAS | Not needed as a value: in the Core one physical camera IS one registry row, and a dual-lens camera feeds both video slots with two distinct profiles (`capture_config_selector_check`, `S/capture.ts:148-152`). The group is `capture_devices.id` (`S/capture.ts:41`). |
| D-10 | Record-stream choice, main or sub | `IAV/db.py:98,100-102` | HAS | The choice is the profile named per slot: `capture_config.video_01_profile`, `video_02_profile` (`S/capture.ts:99,101`). What makes a profile "main" or "sub" is new: `capture_device_streams.stream_role` (TBL, D-11). |
| D-11 | Which profile is the main stream and which the sub-stream; picture size | `IAV/registration.py:64-67` (`profile`, `preview_profile`); largest-area rule SPEC section 5 | TBL | `capture_device_streams.stream_role`, `width`, `height`. |
| D-12 | Preview sub-stream address (`preview_url`) and `device_info.preview_*` | `IAV/db.py:88-89`; `IAV/registration.py:65` | NOT | Live preview of real cameras is outside this phase (R6 A23, X01), and the address would again be a stored locator (D-05). The sub-stream itself is known as the row with `stream_role = 'SUB'` (D-11), so a later preview needs no further migration. |
| D-13 | Codec as delivered | `IAV/registration.py:66` (inside `device_info.profile`) | TBL | `capture_device_streams.codec`, written from the stream test, not from the ONVIF answer (SPEC S1-5, S1-6: the four bench cameras report H264 and deliver H.265). |
| D-14 | PoE port number | `IAV/db.py:95-96` (integer, typed by the installer) | HAS | `capture_devices.poe_port` (`S/capture.ts:50`), an open `CODE` value (`S/capture.ts:79`; the built-ins use `POE_CAM_1`, `packages/shared/src/sim/initial-state.ts:104`). The integer becomes a code; no migration (`S/capture.ts:13-14`). The code form for a typed number is assumption AS-5. |
| D-15 | Sort order in a room | `IAV/db.py:97`; `IAV/registration.py:58,69` | NOT | The Core's order is the slot: `VIDEO-01`, `VIDEO-02` (`S/value-sets.ts:151`). A second ordering would be a second home for the same fact. Returns only with several rooms per Core (Q6). |
| D-16 | Model, firmware (ONVIF device information) | `IAV/db.py:80`; `IAV/registration.py:44,66` | HAS | `capture_devices.model`, `firmware` (`S/capture.ts:44-45`). |
| D-17 | Enabled flag | `IAV/db.py:81` | HAS | `capture_devices.enabled` (`S/capture.ts:51`). |
| D-18 | Result of the last stream test (`device_info.last_test`) | `IAV/routers/admin.py:416-424` (via R3 1.4) | NOT | Each test is an audit entry `CAPTURE_CONNECTION_TESTED` (`VOC:432`). What a successful test leaves behind is stored: `capture_device_streams.codec`, `width`, `height`, `read_at` (D-11, D-13). A separate "last result" would repeat the audit entry. |
| D-19 | Camera display name | `IAV/db.py:73` | NOT | The Core names a source by its slot and model; `capture_devices` has no name column (`S/capture.ts:41-57`). Not needed by a ported function. Assumption AS-6. |

**Finding F-DB-1 (for WP-04, not a schema defect of this design).** The connection code admits an ONVIF profile token of the form `^[A-Za-z0-9_.:-]{1,64}$` (`apps/core-server/src/capture/adapters/camera/onvif-session.ts:140`) and stores the usable tokens as the registry's profile list (`apps/core-server/src/modules/capture-discovery/connect/service.ts:326`; `adoption.ts:28,38`). The selector admits `CODE` only, `^[A-Z][A-Z0-9_]{0,63}$` (`capture_config_profile_check`, `S/capture.ts:145`; `S/checks.ts:36`). HYPOTHESIS H-DB-1: a real camera whose token has a lower-case letter, a dot, a colon or a hyphen can be adopted and then cannot be assigned to a slot (23514), unless a mapping exists that this pass did not find. The design below resolves it without touching the CHECK: the selector and the profile list carry a Core code; the ONVIF token lives in `capture_device_streams`.

### 1.3 Per audio source (input-av table `cameras`, rows of kind `audio`)

| # | Data item | input-av source | Verdict | Home in the Core, or reason |
|---|---|---|---|---|
| D-20 | Card product name | `IAV/audio.py:88-89,111` | HAS | `capture_devices.model` (`S/capture.ts:44`). Not repeated in the new table. |
| D-21 | USB vendor:product identifier | `IAV/audio.py:84-89` | TBL | `capture_audio_inputs.usb_id`. |
| D-22 | ALSA card identity and device index (the `source` string) | `IAV/routers/audio.py:20-21`; `IAV/audio.py:35` | TBL | `capture_audio_inputs.card_id`, `card_device`. Replaces SPEC S3-3's fallback of packing them into `capture_devices.address`: under U8 a typed column is preferred, and the address column keeps one meaning. |
| D-23 | Selected inputs | `IAV/routers/audio.py:22-24,117` | TBL | `capture_audio_inputs.input_number`: one registry row per selected input (SPEC S3-3; SPEC section 5, "one input per microphone role"). A source of several inputs in one file: WAIT, see D-29. |
| D-24 | Native channel count of the card | `IAV/routers/audio.py:111,117` | TBL | `capture_audio_inputs.native_channels`, with a CHECK that the input does not exceed it (the refusal of `IAV/routers/audio.py:113-116`). |
| D-25 | Sample rate | `IAV/routers/audio.py:25` | TBL | `capture_audio_inputs.sample_rate`, fixed to 48000 by a CHECK: the Core's audio contract is one rate (R4 section 7, last row). Precedent of a one-value CHECK: `stt_config_language_check` (`M/0006_stt_config.sql:20`). |
| D-26 | Sample format (bits) | `IAV/routers/audio.py:26,189-190` | TBL | `capture_audio_inputs.sample_bits`, default 24 (U2: the tested request). |
| D-27 | A/V offset in milliseconds | `IAV/routers/audio.py:32,43,195,241-242`; applied only at `IAV/playback.py:119` | WAIT | **Q8 (stored form) and OQ-3.** The only code that applies it is the playback copy, which is not ported (R6 F07, FG-05). A column is specified (`capture_audio_inputs.av_offset_ms`, set D) and added only when a consumer is approved. |
| D-28 | Capture gain | not stored by input-av: set at `IAV/audio.py:178`, traced only by the audit at `IAV/routers/audio.py:77-78` | TBL | `capture_audio_inputs.gain_control`, `gain_percent` (set D), delivered with WP-18, which SPEC F-4 still holds. Storing it is what lets the Core re-apply a level after a re-plug. |
| D-29 | Several inputs recorded as one multi-channel source | `IAV/routers/audio.py:22` (up to 64) | WAIT | **Q8.** Under the recommended stored form one input feeds one microphone role. Under variant I or M the list returns as further rows of the same table; no other shape is needed. |
| D-30 | "Automatic: first USB card" source | `IAV/audio.py:48` | NOT | Not carried (SPEC section 1: it moved two microphones to another card unnoticed). A microphone is a named card and input. |

### 1.4 Per session

| # | Data item | input-av source | Verdict | Home in the Core, or reason |
|---|---|---|---|---|
| D-31 | Audio device identity actually used (card, product, USB id, channels, inputs) | `IAV/service.py:145-147` (audit detail only) | COL | `session_capture_sources.source_facts` (new column). The table already records device id and adapter kind per slot, insert-only (`S/recording.ts:183-191`; `M/0009_capture_sources_privileges.sql:16`). Closes R6 FG-09. |
| D-32 | Camera facts actually used (codec, picture size, MAC) | implied by `IAV/service.py:142` (camera ids only) | COL | Same column, for the two video slots. |
| D-33 | Clock-sync state | `IAV/db.py:134`; `IAV/service.py:128` | HAS | `active_session.start_time_source`, `stop_time_source` (`S/sessions.ts:64-65`); `session_history.start_time_source`, `end_time_source` (`S/sessions.ts:158-159`). Richer than a flag. |
| D-34 | Site snapshot: code, name | `IAV/db.py:135-136`; `IAV/settings.py:130-133` | HAS | `core_device.id`, `name`, `room` (`S/core.ts:156-158`) for the installation (R6 T10a-1); per session `active_session.room`, `session_history.room` (`S/sessions.ts:50,150`). |
| D-35 | Site address | `IAV/settings.py:23` | WAIT | **OQ-2 (acceptance record).** No live home in the Core. Specified as `installation_acceptances.site_address`, the one place it would live. |
| D-36 | Deployment mode (`appliance` or `lan`) | `IAV/settings.py:27,88-91` | NOT | It only selects presets of the discovery scope, which the Core does not have as a setting (D-44). |
| D-37 | Free metadata (`extra`), who stopped | `IAV/db.py:127,132-133` | HAS | Typed columns: `subject_type`, `subject_name`, `investigator_id`, `input_notes` (`S/sessions.ts:47-52`); `stopped_by` (`S/sessions.ts:81`). |
| D-38 | Markers | `IAV/db.py:172-179` | HAS | `active_session.marker_count`, `timeline` (`S/sessions.ts:60,68`); sealed copy `evidence_items.markers` and audit `MARKER_ADDED` (R4 section 8). |

### 1.5 Recording parts and gaps

| # | Data item | input-av source | Verdict | Home in the Core, or reason |
|---|---|---|---|---|
| D-39 | Part number: a new, separately hashed file per reconnect | `IAV/db.py:144-146,152` | NOT | The Core records a reconnect as a gap in the same track, not as a new file (SPEC section 1, fifth departure; R6 FG-07). A part number has nothing to number. |
| D-40 | The gap itself: when a camera was lost and resumed | `IAV/db.py:155-156,160` | HAS | `recording_fragments.media_start_ms`, `media_duration_ms` per closed fragment (`S/recording.ts:107-108`); the fault as an `alerts` row with `kind`, `reason`, `resolved_at` (`S/core.ts:70-99`) and audit `FAULT_RAISED`, `FAULT_CLEARED` (`VOC:379-380`). HYPOTHESIS H-DB-2: a resumed push shows as a jump between consecutive fragment times, so no gap table is needed. It is settled by experiment E-10 of WP-01, which has **not run** (`test/01_hevc_experiment.md`, "NOT RUN"). If E-10 shows the fragment table does not show the gap, a gap table belongs to WP-11, not to this design. |
| D-41 | First-sample time, error text | `IAV/db.py:160-163` | HAS | As D-40. |
| D-42 | Playback copy: path, hash, status | `IAV/db.py:164-168` | NOT | A playback copy, not evidence (`IAV/db.py:164-165`); the Core serves the sealed file itself (R6 F07). |

### 1.6 Discovery and network state

| # | Data item | input-av source | Verdict | Home in the Core, or reason |
|---|---|---|---|---|
| D-43 | Discovered-device rows: key, MAC, address, vendor, interface, ONVIF facts, online or offline, first seen, last seen, last change | `IAV/db.py:182-198`; writer `IAV/discovery.py:603-624`; the factory scan writes them too (`IAV/factory.py:68-69`) | WAIT | **SPEC F-4.3 point 6 (ruling RG-4 and D76 (1)): OQ-1.** Dropped by a ruling, not for lack of a place: a search result "never enters the registry" (R6 T09). A shape is specified as set E so the user can decide on something concrete. Recommendation: do not store a rolling inventory. For an **adopted** camera the facts exist: `capture_devices.address`, `mac`, `last_seen_at` (`S/capture.ts:46-47,52`). |
| D-44 | Discovery scope, interval, offline-after, follow-by-MAC flag | `IAV/settings.py:45-49`; `IAV/config.py:61-62` | NOT | Contract constants in the Core, fixed by a ruling (R6 T10a-4); the follow flag is not carried (SPEC F-4.2 DR-10). A setting would need that ruling changed. |
| D-45 | Network link events (cable up, cable down) | `IAV/discovery.py:377-391` | HAS | The unchained operational log `events` already has the category `NETWORK` (`S/value-sets.ts:27-38`) and an open `CODE` type; current state lives in `hardware_snapshot.network`, `ports` (`S/core.ts:225,230`). No DDL. Written only if the link monitor is adopted (SPEC section 3.2 lists H-23 as not needed). |
| D-46 | Temporary aliases in place: interface, address, added at | `IAV/netalias.py:21,57-70,96-99` | TBL | `host_network_aliases`. Closes R6 T10c. |
| D-47 | Alias lifetime of each alias | in memory only: `IAV/netalias.py:33,107-114` | TBL | `host_network_aliases.expires_at`. Stored, because the in-memory timer dies with the process (SPEC F-4.2 DR-3). |
| D-48 | Commissioning job (scan result, set-IP steps and outcome) | memory only in input-av (SPEC section 4, "persistent data" table) | NOT | A job lasts minutes and its durable trace is the audit entry (`IAV/factory.py:76-77,99-101`). The Core keeps scan results as an in-memory candidate list, as its search does. An open alias row with reason `SET_CAMERA_ADDRESS` is what a restart finds if a job died (section 2.5). |

### 1.7 Settings (input-av key `site`) and commissioning state

| # | Data item | input-av source | Verdict | Home in the Core, or reason |
|---|---|---|---|---|
| D-49 | Camera interface | `IAV/settings.py:40-41`; `IAV/config.py:56-58` | TBL | `capture_network_config.interface_name`. Closes R6 M/G-2. |
| D-50 | Camera subnet | `IAV/settings.py:42,80-85`; `IAV/config.py:59-60` | TBL | `capture_network_config.camera_subnet`. |
| D-51 | Factory default address list | `IAV/settings.py:55-57,69-78` | TBL | `capture_network_config.factory_addresses`. Closes R6 T10a-5. |
| D-52 | Alias host octet | `IAV/settings.py:58` | TBL | `capture_network_config.alias_host`. |
| D-53 | Alias lifetime in minutes | `IAV/settings.py:59` | TBL | `capture_network_config.alias_minutes`. |
| D-54 | First address for new cameras | `IAV/settings.py:62` | TBL | `capture_network_config.camera_ip_start`. |
| D-55 | Audio input count offered; PoE port count; lenses per device | `IAV/settings.py:31,34,37` | WAIT | **Q6 (rooms per Core).** With one room per Core the capacity is the four slots (`S/value-sets.ts:151`) and at most two profiles of one device (`S/capture.ts:148-152`); the card's real channel count is D-24. A stored capacity is needed only for several rooms. |
| D-56 | Disk thresholds | `IAV/settings.py:66-67` | NOT | Not hardware input logic (outside U1); reported by SPEC section 3.2 as hypothesis H-P for the controller. No column here. |
| D-57 | Commissioning record: accepted at, by whom, version, site, steps, diagnostics; and its reset | `IAV/commissioning.py:79-96,99-107` | WAIT | **OQ-2** (is an acceptance gate kept; the remainder of Q10). Specified as `installation_acceptances` (set C). Closes R6 M/G-1 if kept. |
| D-58 | Rooms | `IAV/db.py:60-66` | WAIT | **Q6 (rooms per Core).** A room is a text attribute of the session and of the Core today (`S/sessions.ts:50,150`; `S/core.ts:158`). |
| D-59 | Users and refresh tokens | `IAV/db.py:40-57` | NOT | A second user base. The Core's operators and sign-in sessions own this kind (R6 T01, T02). |
| D-60 | Cases (number, title, description) | `IAV/db.py:110-117` | NOT | The case number is a session attribute (R6 T05); title and description serve no ported function. |
| D-61 | The key-value settings container | `IAV/db.py:201-206` | NOT | The Core uses typed single-row tables (R6 T10); its three keys are D-49 to D-54, D-57 and D-46. |
| D-62 | input-av's own audit log | `IAV/db.py:209-222` | NOT | One audit chain (R6 T11). |
| D-63 | Rows already written under `apps/input-av/data/` | not opened | WAIT | **Q3 (existing data).** This design creates no import target. |

### 1.8 Count

| Verdict | Items | Which |
|---|---|---|
| HAS | 17 | D-01, 02, 03, 04, 09, 10, 14, 16, 17, 20, 33, 34, 37, 38, 40, 41, 45 |
| COL | 2 | D-31, D-32 (one column) |
| TBL | 20 | D-06, 07, 08, 11, 13 (`capture_device_streams`); D-21, 22, 23, 24, 25, 26, 28 (`capture_audio_inputs`; D-28 arrives with set D); D-46, 47 (`host_network_aliases`); D-49 to D-54 (`capture_network_config`) |
| NOT | 16 | D-05, 12, 15, 18, 19, 30, 36, 39, 42, 44, 48, 56, 59, 60, 61, 62 |
| WAIT | 8 | D-27 (Q8, OQ-3), D-29 (Q8), D-35 (OQ-2), D-43 (OQ-1), D-55 (Q6), D-57 (OQ-2), D-58 (Q6), D-63 (Q3) |
| **Total** | **63** | 17 + 2 + 20 + 16 + 8 |

Every item of the task's list and every row of SPEC section 4's "persistent data" table appears above; the two sources overlap, and an item named by both is one line here.

## 2. Proposed schema changes

### 2.0 Rules the design follows (each with its precedent in the Core)

| Rule | Precedent |
|---|---|
| Two database roles only: the owner applies migrations, the runtime role `dems_app` runs the server. No new role | `M/0005_capture_privileges.sql:11-13` ("a 4th DB role is forbidden by D-DB-07") |
| Grants are written by hand in a privileges file, never a blanket `GRANT SELECT ON ALL TABLES` after the first one | `M/0009_capture_sources_privileges.sql:8-11`; `M/0014_key_id_fault_reason_media_root_privileges.sql:10-11` |
| The runtime role deletes from one table only, `active_session`. No new table gets DELETE | `S/sessions.ts:35-38` |
| A closed value set is a CHECK list and a literal in `value-sets.ts`; an open set is checked by the `CODE` format and needs no migration | `S/value-sets.ts:4-12`; `S/checks.ts:36` |
| A camera credential lives only in the sealed, write-only table | `S/capture.ts:157-163`; `M/0005_capture_privileges.sql:21,61-76` |
| A side table keyed by the device id, with a foreign key to the registry | `capture_device_credentials` (`S/capture.ts:164-182`) |
| The id prefix states the device kind, so a side table can restrict itself to one kind by a pattern | `capture_devices_id_check` (`S/capture.ts:68-71`) |
| A settings singleton with an optimistic `revision`, `updated_by`, `updated_at` | `capture_config` (`S/capture.ts:94-107,153`) |
| A singleton the runtime role may create and replace in one statement | `core_media_store` (`M/0014_key_id_fault_reason_media_root_privileges.sql:13-21`) |
| A per-session snapshot table or column, insert-only | `session_capture_sources` (`S/recording.ts:171-182`); `session_stt_config` (R4 section 1) |
| A new NOT NULL column arrives with a permanent default, so existing rows stay valid without a backfill | `capture_devices.adapter_kind` (`M/0008_capture_sources.sql:15`; `S/capture.ts:53-57`) |
| A column written once gets a "boundary pin" `REVOKE UPDATE (col)` | `M/0009_capture_sources_privileges.sql:21-23` |
| A flat detail map with the forbidden-key check | `S/checks.ts:57,60-61`; the 28 key names at `S/value-sets.ts:203-233` |
| Audit types are an open set: a new type is a vocabulary change, not a migration; its category must be one of the eight existing ones | `S/value-sets.ts:11-12,17-26`; `VOC:346-435,439-511` |

**Why side tables and not more columns on `capture_devices`.** The registry row is mapped from the engine's device slice (`apps/core-server/src/db/mapping/changes.ts:73`; R4 section 5, writer (c)) and is part of what the Simulated mode replicates. A side table leaves that mapping, the shared slice type and the simulator untouched; the stream and sound-card facts are written by modules with constant statements, as credentials already are. Alternative considered and not chosen: changing the element shape of `capture_devices.profiles` from a string to an object. That column is written today as a list of strings (`adoption.ts:28,38`) and by the engine as an empty list (`apps/core-server/src/db/mapping/rows.ts:859`), so the change would break an existing shape for every reader.

**Audit type names** below are proposals. The vocabulary, the category and the exact detail keys belong to WP-23 (SPEC F-4.2 DR-11); the closed detail lists of `apps/core-server/src/core/audit-details.ts` were not read in full here.

### 2.1 Set A, table `capture_device_streams` (T-44, new)

One row per usable stream of an adopted camera. The `profile` value is the Core code that `capture_devices.profiles` lists and `capture_config.video_0n_profile` selects; this table holds what that code means on the camera.

| Column | Type | Null / default | Constraint or value set |
|---|---|---|---|
| `device_id` | text | NOT NULL | FK `capture_devices(id)` ON DELETE restrict; CHECK `^CAM-[0-9]{2,}$` (cameras only) |
| `profile` | text | NOT NULL | `CODE` format. Primary key `(device_id, profile)` |
| `onvif_profile_token` | text | NOT NULL | CHECK `^[A-Za-z0-9_.:-]{1,64}$`, the rule of `onvif-session.ts:140` |
| `video_source_token` | text | NULL | same pattern (assumption AS-7) |
| `lens` | smallint | NOT NULL, default 1 | CHECK 1 to 4 (`IAV/settings.py:34`) |
| `stream_role` | text | NOT NULL | new closed set `CAPTURE_STREAM_ROLE = ['MAIN', 'SUB']` (`IAV/db.py:98`) |
| `codec` | text | NULL (unknown until a stream test ran) | closed set `['H264', 'HEVC', 'OTHER']`, the words of `apps/core-server/src/capture/adapters/types.ts:108-112` |
| `width`, `height` | integer | NULL | CHECK both NULL or both between 1 and 16384 |
| `read_at` | bigint | NOT NULL | epoch milliseconds of the read from the camera |

| Aspect | Design |
|---|---|
| Unique | `(device_id, lens, stream_role)`: one main and one sub stream per lens |
| Index | the primary key serves the only lookup (by device) |
| Runtime role | SELECT, INSERT; UPDATE on every column except the two key columns; no DELETE. A stream that a camera no longer offers stays as a row and is ignored: the list of usable codes remains `capture_devices.profiles` |
| Written by | adoption and the connection test, in the same unit of work as the registry row (pattern of `adoption.ts:15-16`) |
| Audit type | existing: `CAPTURE_CANDIDATE_ADOPTED` (`VOC:433`) at adoption, `CAPTURE_CONNECTION_TESTED` (`VOC:432`) at a re-read. No new type |
| Retention | life of the registry row, which is never deleted (R6 A37). Kept across a demo reset, with `capture_devices` (section 3.3) |
| No secret | a token names a profile; it is not a credential. No address and no locator is stored here (D-05, D-12) |

### 2.2 Set A, table `capture_audio_inputs` (T-45, new)

One row per registered sound-card input, one-to-one with a `MIC-nn` registry row of adapter kind `USB_AUDIO`. Fake and local-device microphones have no row.

| Column | Type | Null / default | Constraint or value set |
|---|---|---|---|
| `device_id` | text | NOT NULL, primary key | FK `capture_devices(id)` ON DELETE restrict; CHECK `^MIC-[0-9]{2,}$` |
| `usb_id` | text | NULL (a card that is not USB) | CHECK `^[0-9a-f]{4}:[0-9a-f]{4}$` (`IAV/audio.py:84`) |
| `card_id` | text | NOT NULL | CHECK `^[A-Za-z0-9_]{1,32}$` (assumption AS-8) |
| `card_device` | smallint | NOT NULL, default 0 | CHECK 0 to 31 |
| `input_number` | smallint | NOT NULL | CHECK 1 to 64 (`IAV/routers/audio.py:22`) and `input_number <= native_channels` |
| `native_channels` | smallint | NOT NULL | CHECK 1 to 64 |
| `sample_rate` | integer | NOT NULL, default 48000 | CHECK `= 48000` |
| `sample_bits` | smallint | NOT NULL, default 24 | CHECK in (16, 24, 32) (`IAV/routers/audio.py:189`) |
| `updated_by` | text | NULL | FK `operators(id)` ON DELETE restrict |
| `updated_at` | bigint | NOT NULL | |

| Aspect | Design |
|---|---|
| Unique | `(card_id, card_device, input_number)`: an input is allocated once (the rule of `IAV/routers/audio.py:100-102`), enforced by the database as the ONVIF endpoint is for cameras (`S/capture.ts:61-65`). Registering an input that already has a row re-enables that device instead of creating another |
| Runtime role | SELECT, INSERT; UPDATE on `usb_id`, `card_id`, `card_device`, `input_number`, `native_channels`, `sample_bits`, `updated_by`, `updated_at`; boundary pin `REVOKE UPDATE (sample_rate)`; no DELETE |
| Audit type | **new** `CAPTURE_AUDIO_INPUT_CHANGED`, category `DEVICE`, for registration and for a change of card or input (no writer for registering a `USB_AUDIO` device exists today, R6 A51). The role assignment stays `CAPTURE_CONFIG_CHANGED` (`VOC:414`) |
| Retention | as 2.1. Kept across a demo reset |
| Not here | the product name (it is `capture_devices.model`, D-20); the role primary or standby (it is `capture_config.mic_primary_id`, `mic_standby_id`, `S/capture.ts:102-103`) |

**Set D, three further columns of this table, delivered only with their function** (WP-18 for gain; a ruled consumer for the offset): `gain_control` text NULL (1 to 64 characters, no control character), `gain_percent` smallint NULL (0 to 100), CHECK both NULL or both set; `av_offset_ms` smallint NULL (CHECK between -2000 and 2000, the range of `IAV/routers/audio.py:32`). Audit type for gain: **new** `CAPTURE_GAIN_CHANGED`, category `DEVICE` (R6 M/G-5). They are kept out of set A so that no column exists before something writes it.

### 2.3 Set A, column `session_capture_sources.source_facts` (new column on T-41)

| Column | Type | Null / default | Constraint |
|---|---|---|---|
| `source_facts` | jsonb | NOT NULL, default `'{}'` | CHECK flat map (`public.dems_jsonb_is_flat`, `S/checks.ts:57`) and none of the 28 forbidden keys (`S/checks.ts:60-61`) |

| Aspect | Design |
|---|---|
| Content | The facts of the device **as it was when the session started**, per slot. Camera slots: `model`, `firmware`, `mac`, `codec`, `width`, `height`, `lens`, `streamRole`. Microphone slots: `model`, `usbId`, `cardId`, `cardDevice`, `inputNumber`, `nativeChannels`, `sampleBits`. The key list is closed in code, as audit details are. Never: a user name, a locator, an ONVIF endpoint reference (`username`, `mediaUrl`, `onvifUuid` are forbidden keys, `S/value-sets.ts:218,226,228`) |
| Not repeated | the device id and the adapter kind (columns of the same row, `S/recording.ts:188-189`); the selected profile code (it is in the selector snapshot `active_session.capture_config`, `S/sessions.ts:82`) |
| Runtime role | unchanged: the table is SELECT and INSERT only (`M/0009_capture_sources_privileges.sql:16`). Boundary pin `REVOKE UPDATE (source_facts)` |
| Audit type | none of its own: the row is written inside the transaction that persists the transition to `RECORDING` (`S/recording.ts:172-174`), which is audited as `RECORDING_STARTED` |
| Retention | as the table today: insert-only, no foreign key to the history, rows removed by a demo reset (`S/recording.ts:178-181`) |
| Existing rows | read `{}`; the simulator's and every earlier session's rows stay valid |
| Not decided here | whether these facts are also printed in the sealed manifest. That is a change of the evidence specification, not of the database |

### 2.4 Set B, table `capture_network_config` (T-46, new, one row)

| Column | Type | Null / default | Constraint or value set |
|---|---|---|---|
| `singleton` | boolean | primary key, default true | CHECK `singleton` |
| `interface_name` | text | NULL = not chosen | CHECK `^[a-z0-9][a-z0-9._-]{0,14}$` (assumption AS-9) |
| `camera_subnet` | cidr | NULL = derive from the interface (`IAV/settings.py:42`) | CHECK IPv4 and prefix length between 16 and 30 |
| `factory_addresses` | jsonb | NOT NULL, default `["192.168.1.64","192.168.1.108","192.168.0.90","192.168.1.13"]` (`IAV/settings.py:55-56`) | CHECK array, at most 32 elements (`IAV/settings.py:57`); each element is validated as a private IPv4 address by the module (`IAV/settings.py:69-78`) |
| `alias_host` | smallint | NOT NULL, default 253 | CHECK 2 to 254 (`IAV/settings.py:58`) |
| `alias_minutes` | smallint | NOT NULL, default 30 | CHECK 5 to 480 (`IAV/settings.py:59`) |
| `camera_ip_start` | smallint | NOT NULL, default 101 | CHECK 2 to 250 (`IAV/settings.py:62`) |
| `revision` | bigint | NOT NULL, default 1 | CHECK `>= 1` |
| `updated_by` | text | NULL | FK `operators(id)` ON DELETE restrict |
| `updated_at` | bigint | NOT NULL | |

| Aspect | Design |
|---|---|
| Defaults | the values input-av was tested with (U2), so the row can be created with defaults alone |
| Runtime role | SELECT; INSERT (one statement, `INSERT ... ON CONFLICT (singleton) DO NOTHING`, that materialises the default row at first use, the `core_media_store` pattern); UPDATE on every column except `singleton`; no DELETE |
| No row, or `interface_name` NULL | the commissioning operations answer "not configured". input-av's "empty = automatic, first physical Ethernet port" (`IAV/config.py:56-57`) is **not** carried: a function that adds an address to a host interface must be told which one (OQ-4) |
| Relation to SPEC F-4.2 DR-2 | the privileged helper reads its interface from a root-owned file. That file is an enforcement copy written at installation, not a system of record; this row is the setting the Core shows, edits and audits. A difference between the two is a named refusal, never silently resolved. For the security row |
| Audit type | **new** `CAPTURE_NETWORK_CONFIG_CHANGED`, category `DEVICE`, detail = names of the changed fields (the pattern of `STT_CONFIG_CHANGED`, `VOC:426`) |
| Retention | replaced in place. Kept across a demo reset: it describes the installation |

`cidr` (and `inet` below) are PostgreSQL's own address types: the database validates the value, no hand-written pattern is needed. They would be the first use of these types in this schema. HYPOTHESIS H-DB-3: `drizzle-kit` 0.31.11 generates them and the inventory tool of `T/contract-inventory.ts` accepts a new type name; the column classes exist in the installed `drizzle-orm` 0.45.3 (`node_modules/drizzle-orm/pg-core/columns/cidr.d.ts`, `inet.d.ts`). Fallback with no loss of function: `text` with a CHECK, as `capture_devices.address` is today.

### 2.5 Set B, table `host_network_aliases` (T-47, new)

One row per temporary address the Core put on the camera interface. The row is the state of that alias (the pattern of `auth_sessions` with its `ended_at`); the audit entries are the trace of the actions.

| Column | Type | Null / default | Constraint or value set |
|---|---|---|---|
| `id` | uuid | primary key, default random | precedent `health_snapshots.id` (`S/core.ts:250`) |
| `interface_name` | text | NOT NULL | same pattern as 2.4 |
| `address` | inet | NOT NULL | CHECK IPv4, prefix length 24, inside `10.0.0.0/8`, `172.16.0.0/12` or `192.168.0.0/16` (the helper's own bound, SPEC F-4.2 DR-2) |
| `reason` | text | NOT NULL | new closed set `HOST_ALIAS_REASON = ['FACTORY_SCAN', 'SET_CAMERA_ADDRESS']` (free text in input-av, `IAV/netalias.py:84-85,102`) |
| `added_at` | bigint | NOT NULL | |
| `added_by` | text | NOT NULL | FK `operators(id)` ON DELETE restrict |
| `expires_at` | bigint | NOT NULL | CHECK `> added_at` |
| `removed_at` | bigint | NULL = in place | CHECK `>= added_at` |
| `remove_reason` | text | NULL | new closed set `HOST_ALIAS_REMOVE_REASON = ['EXPIRED', 'MANUAL', 'JOB_DONE', 'BOOT_SWEEP']` (`IAV/netalias.py:111,117,137-139`); CHECK set exactly when `removed_at` is set |
| `removed_by` | text | NULL = the system | FK `operators(id)` ON DELETE restrict |
| `remove_error` | text | NULL | `CODE` format: the reason code of a failed removal (input-av keeps 300 characters of error text, `IAV/netalias.py:130-131`; a code, not text, is the Core's form) |

| Aspect | Design |
|---|---|
| Unique | partial unique index `(interface_name, address) WHERE removed_at IS NULL`: one alias in place per address; also the lookup "which aliases are ours" |
| Runtime role | SELECT, INSERT; UPDATE on `expires_at` (an extension, `IAV/netalias.py:89-91`), `removed_at`, `remove_reason`, `removed_by`, `remove_error`; no DELETE |
| Why `expires_at` is stored | input-av keeps the lifetime in a timer in memory (`IAV/netalias.py:107-114`): after a restart it knows the alias and not when it ends. If hypothesis H-S of SPEC F-4.2 DR-3 holds (the kernel expires the address itself), this column is what the start-up sweep compares against to close rows whose address is already gone |
| Audit types | **new** `HOST_ALIAS_ADDED`, `HOST_ALIAS_REMOVED`, `HOST_ALIAS_REMOVE_FAILED` (R6 A41 to A43, M/G-4). Category to be fixed in WP-23: `DEVICE` or `SECURITY` (there is no network category among the eight, `S/value-sets.ts:17-26`) |
| Retention | rows stay; one row per alias, a handful per installation. Kept across a demo reset: an alias that a reset forgot would stay on the interface with no owner |

**The other audit types of the network functions need no table**: `CAMERA_FACTORY_SCANNED` (R6 A15), `CAMERA_NETWORK_SET` (R6 A16, A17) and `CAPTURE_DEVICE_ADDRESS_CHANGED` (R6 A12, M/G-3; the changed value is `capture_devices.address`, which the runtime role may already update, `M/0005_capture_privileges.sql:39-40`). Names proposed; WP-23 owns them. Recommendation to WP-23: write `CAMERA_NETWORK_SET` before the call as well as after it, so that a Core that dies during the 180-second wait leaves a trace that a change was requested (D-48).

### 2.6 Set C, table `installation_acceptances` (T-48, new; only if OQ-2 is answered yes)

| Column | Type | Null / default | Constraint |
|---|---|---|---|
| `id` | uuid | primary key, default random | |
| `accepted_at` | bigint | NOT NULL | |
| `accepted_by` | text | NOT NULL | FK `operators(id)` ON DELETE restrict |
| `software_version` | text | NOT NULL | 1 to 64 characters (`IAV/commissioning.py:86`) |
| `core_device_id`, `site_name`, `room` | text | NOT NULL | snapshot of `core_device.id`, `name`, `room` (`S/core.ts:156-158`) at acceptance |
| `site_address` | text | NULL | at most 500 characters (`IAV/settings.py:23`). Its only home (D-35) |
| `steps` | jsonb | NOT NULL | CHECK array, at most 32 elements: step id, passed or not, a detail code (`IAV/commissioning.py:15-16`) |
| `diagnostics` | jsonb | NOT NULL | CHECK object: the diagnostics run as it was at acceptance (`IAV/commissioning.py:87`; the Core's live copy is `hardware_snapshot.diagnostics`, `S/core.ts:232`) |
| `revoked_at` | bigint | NULL = in force | CHECK `>= accepted_at` |
| `revoked_by` | text | NULL | FK `operators(id)` ON DELETE restrict |
| `revoke_reason` | text | NULL | 5 to 500 characters (`IAV/commissioning.py:99-107`); CHECK the three revoke columns are all NULL or all set |

| Aspect | Design |
|---|---|
| Unique | partial unique index over the rows with `revoked_at IS NULL`: at most one acceptance in force. input-av replaces or deletes one row (`IAV/commissioning.py:88-94,101-105`); the Core keeps the history because its runtime role does not delete |
| Runtime role | SELECT, INSERT; UPDATE on `revoked_at`, `revoked_by`, `revoke_reason`; no DELETE |
| Audit types | **new** `INSTALLATION_ACCEPTED`, `INSTALLATION_ACCEPTANCE_REVOKED`, category `SYSTEM` (R6 A09, A10, M/G-1). The audit detail carries the record id and counts only: a detail map is flat (`S/value-sets.ts:280-281`), which is why the body needs a table. input-av puts the whole record into its audit entry (`IAV/commissioning.py:95`) |
| Retention | permanent. Kept across a demo reset |

### 2.7 Set E, table `network_sightings` (specified so OQ-1 can be decided; **not recommended**)

Shape if the user lifts RG-4 for it: key (MAC, or `IP:<address>` while the MAC is unknown), `mac`, `address` inet, `vendor`, `interface_name`, `onvif` boolean, `onvif_name`, `onvif_hardware`, `state` in (`ONLINE`, `OFFLINE`), `first_seen_at`, `last_seen_at`, `last_change_at`, `registered_device_id` NULL FK `capture_devices(id)` (`IAV/db.py:182-198`). The ONVIF service address of input-av (`IAV/db.py:192`) would not be stored: it is a URL. Runtime role: SELECT, INSERT, UPDATE; a row is never assignable to a slot.

Why not recommended: (1) it is a second list of devices beside the registry, the one case in this document that comes close to a record kind with two homes; (2) under input-av's scope `all` it would hold every device of an office network (`IAV/settings.py:43-44`), with no way for the runtime role to remove a row; (3) no ported function reads it: the commissioning job works from the scan result in memory and from the MAC it read itself (SPEC F-4.2 DR-7, DR-10); the adopted camera's last-seen time already has a column (D-43).

### 2.8 Check: record kinds with two homes

| New home | Nearest existing Core record | Why it is not a second home |
|---|---|---|
| `capture_device_streams` | `capture_devices.profiles` (list of codes); `capture_config` (the choice) | The list and the choice stay where they are. This table holds only attributes that no column has today (token, source, lens, role, codec, size) |
| `capture_audio_inputs` | `capture_devices.model`, `address` | Model stays in the registry and is not repeated; the address column is not used for card identity (SPEC S3-3's fallback is replaced, not added) |
| `session_capture_sources.source_facts` | registry rows; `active_session.capture_config` | Point-in-time copy for one session (AS-2); it repeats neither the row's own columns nor the selector snapshot |
| `capture_network_config` | contract constants of the search; `hardware_snapshot.network` | The constants govern the search and are not stored; the snapshot is observed state of the management link, this row is a configured value of the camera port |
| `host_network_aliases` | none | No Core record of a host address exists (R6 A41) |
| `installation_acceptances` | `hardware_snapshot.diagnostics`; `core_device` | Point-in-time copy at acceptance (AS-2) |
| Camera credential | `capture_device_credentials` | Untouched. No new column anywhere holds a user name, a password, a key reference or a locator |

**Result: 0 record kinds with two homes** for sets A, B, C and D. Set E is the exception named in 2.7 and is not recommended. Condition that keeps it at 0: SPEC S3-3 is implemented from 2.2 and not also through the address column.

## 3. Delivery, when implementation is approved

### 3.1 How the Core delivers a schema change today

| Fact | Evidence |
|---|---|
| Fifteen files, `0000` to `0014`, applied in journal order by the Drizzle migrator, as the owner role, in one transaction for the whole pending set | `apps/core-server/src/db/commands/migrations.ts:4-6,43-59` |
| A set is a generated file (`drizzle-kit generate`, script `db:generate`) followed by a hand-written privileges file | `apps/core-server/package.json:21`; `M/0008_capture_sources.sql` with `M/0009_capture_sources_privileges.sql`; `M/0013_...` with `M/0014_...` |
| The last file of a set steps `schema_meta`; the constants change in the same commit; boot check B-3 refuses a database on either side of the step | `M/0014_key_id_fault_reason_media_root_privileges.sql:31-35`; `S/meta.ts:13-40` (today `6`, `'dbc-7'`) |
| An applied file is never edited: its hash is compared | `migrations.ts:8-14` |
| A file name is four digits and lower-case words; journal times must rise | `migrations.ts:100,118-120` |
| One writer for the schema folder and the migrations folder | `S/index.ts:26-28` |
| A hand-written file may insert a row (the genesis row of the audit chain) | `S/index.ts:60-62` |
| No down file exists in the folder (15 forward files, none named "down"): rollback is forward | directory listing of `M/`, 2026-10-12 |

### 3.2 Proposed order and names

Three sets, each independent after set A, so that a set can be approved, postponed or dropped on its own. File numbers assume this order and that no other set lands first; the number is taken at generation time.

| Set | Files (name pattern of today) | Content | Version step | Work package |
|---|---|---|---|---|
| **A** (set 8) | `0015_capture_streams_audio_inputs.sql` (generated); `0016_capture_streams_audio_inputs_privileges.sql` (hand-written) | T-44, T-45, column `session_capture_sources.source_facts`; grants of 2.1 to 2.3 | 6 -> 7, `dbc-8` | **WP-24 (new)**. Consumers: WP-04 (streams), WP-07 (inputs, session facts), WP-05 (codec from the stream) |
| **B** (set 9) | `0017_network_commissioning.sql`; `0018_network_commissioning_privileges.sql` | T-46, T-47; grants of 2.4, 2.5 | 7 -> 8, `dbc-9` | **WP-25 (new)**. Consumers: WP-19, WP-22; vocabulary in WP-23 |
| **C** (set 10) | `0019_installation_acceptance.sql`; `0020_installation_acceptance_privileges.sql` | T-48; grants of 2.6 | 8 -> 9, `dbc-10` | **WP-26 (new)**, only if OQ-2 = yes. Consumer: WP-20 |
| **D** | `00nn_audio_calibration.sql`; `00nn_audio_calibration_privileges.sql` | three columns on T-45 (2.2) | +1 | inside existing **WP-18**; no new number |
| **E** | not planned | T `network_sightings` | - | none, unless OQ-1 = yes |

**Proposed work packages for the plan to adopt** (the highest existing number is WP-23, announced by Amendment 1 of SPEC and present in its section 9 table at the last read):

| WP | Content | Size | Depends on | Blocked by | Host | Verification |
|---|---|---|---|---|---|---|
| **WP-24** | Schema set A: typed schema, generated and privileges files, version step, contract delta, the moved pins of 3.4, kept-table entries, a `set8` test | S | - | approval of implementation (U3, U5); this document accepted | development host with the test PostgreSQL | `db:generate` reports no drift; the set applies to an empty and to a seeded version-6 database; existing rows unchanged; the runtime role cannot delete from, or read more than, the grants of 2.1 to 2.3; a `FAKE` session still starts |
| **WP-25** | Schema set B, same parts | S | WP-24 (file order only) | as WP-24; the rulings of SPEC F-4.3 points 1 to 5 for the functions that use it | development host | as WP-24 for 2.4, 2.5; a second open alias on one address is refused by the database |
| **WP-26** | Schema set C, same parts | S | WP-25 (file order only) | OQ-2 | development host | as WP-24 for 2.6; a second acceptance in force is refused |

WP-23 of SPEC already names "the persistent data ... implemented from `masterplan/03_db_schema_extension.md`". Proposal for the plan: WP-23 keeps the vocabulary (audit types, permission) and takes WP-25 as its schema part; WP-24 is separate because its consumers are the recording path (WP-04, WP-07), which does not wait for the rulings of SPEC F-4.3.

Order rule: a schema set lands before the first work package that writes its tables, and never in the same change set as that package (one migration writer, `S/index.ts:26-28`).

### 3.3 Backward compatibility

| Concern | Statement |
|---|---|
| Existing rows | No existing column changes type, name, default or nullability. The one new column on an existing table is NOT NULL with a permanent default (2.3), the form of `M/0008_capture_sources.sql:15`. No CHECK of an existing table is touched |
| Seeded demo data | The seed writes nothing into the new tables: the built-in devices are fake ones and have no stream or sound-card row. `capture_network_config` needs no seed row (2.4). HYPOTHESIS H-DB-4: the seed-order test (`apps/core-server/src/db/seed/__tests__/seed-order.test.ts`, not read) lists only tables the seed writes; if it lists every table, it is one more pin |
| Simulated mode | The engine's device slice, its row mapping and the list of runtime-updatable registry columns are untouched (`apps/core-server/src/db/mapping/changes.ts:73`). A simulated session writes its four source rows with the unchanged statement and reads `{}` for the new column |
| Demo reset | The reset rebuilds a new database and carries the kept tables across (`apps/core-server/src/db/reset/kept-tables.ts:12-18`). T-44 and T-45 extend a kept table and must be kept with it, after `capture_devices` in carry order, mode `upsert`; T-46 `upsert`; T-47 and T-48 `insert`. Otherwise a reset would keep a camera and lose its streams. Column lists are read from the typed schema (`kept-tables.ts:60-64`), so a kept table follows its columns without a second edit |
| Old code on a new database, new code on an old one | Refused at boot by B-3 in both directions (`S/meta.ts:17-18`). Deployment order: `db:migrate`, then start |
| Realtime replication | None of the new tables is a slice (R4, cross-cutting fact 1: modules write these kinds with constant statements) |

### 3.4 Pins and tests that move

Counts are design counts, to be re-measured from the generated file (the grouping of CHECKs is the migration writer's).

| Pin | Today | After A | After B | After C | Where |
|---|---|---|---|---|---|
| Tables | 43 | 45 | 47 | 48 | `S/index.ts:2`; `T/contract-inventory.test.ts:48,59,69`; `T/catalog.db.test.ts:170,369-370`; `T/migrate.db.test.ts:68`; `T/commands.db.test.ts:130`; `T/constraints.db.test.ts:322` (one valid row in each table: a fixture row per new table); `T/set4.db.test.ts:143` |
| Columns | 440 | 461 | 482 | 495 | `T/contract-inventory.test.ts:60`; `T/catalog.db.test.ts:170` |
| Primary keys | 43 | 45 | 47 | 48 | `T/contract-inventory.test.ts:61` |
| Foreign keys | 40 | 43 | 46 | 48 | `T/contract-inventory.test.ts:62` |
| Named CHECKs | 182 | about 195 | about 206 | about 209 | `T/contract-inventory.test.ts:66` |
| Unique constraints / unique indexes | 15 / 4 | 17 / 4 | 17 / 5 | 17 / 6 | `T/contract-inventory.test.ts:63-64` |
| Migration files | 15 | 17 | 19 | 21 | `migrations.ts:43-59` (the tag list); `T/contract-inventory.test.ts:259-265`; `T/migrate.db.test.ts:31,54`; `T/commands.db.test.ts:87,156,161`; `T/set4.db.test.ts:139`; `T/set7.db.test.ts:166,177` |
| Schema version, contract revision | 6, `dbc-7` | 7, `dbc-8` | 8, `dbc-9` | 9, `dbc-10` | `S/meta.ts:38,40`; the boot-check tests |
| Privilege matrix: tables named / with INSERT | 43 / 27 | 45 / 29 | 47 / 31 | 48 / 32 | `T/privileges.db.test.ts:45-133,147` |
| Kept tables | 13 | 15 | 17 | 18 | `apps/core-server/src/db/reset/kept-tables.ts:67,75-89`; `reset/__tests__/kept-tables.test.ts:40,59`; the capture kept list `kept-tables.ts:95-99` and its test `:108` |
| Contract delta | `contract-v6-delta.ts` | new `contract-v7-delta.ts` | `-v8-` | `-v9-` | `T/` (form: `T/contract-v6-delta.ts:16-57`); the checked-in inventory `T/contract-inventory.json`; an erratum of the database contract document that the inventory is parsed from (`T/contract-inventory.ts:30,41`) |
| Per-set test | `set7.db.test.ts` | new `set8.db.test.ts` | `set9` | `set10` | `T/` |
| Closed value sets | - | `CAPTURE_STREAM_ROLE`, stream codec | `HOST_ALIAS_REASON`, `HOST_ALIAS_REMOVE_REASON` | - | `S/value-sets.ts`; the vocabulary pin CL-12 (`S/value-sets.ts:7-9`) once a shared constant exists |
| Forbidden detail keys | 28 | 28 | 28 | 28 | unchanged (`T/contract-inventory.test.ts:343`) |
| Audit types (vocabulary, **not a migration**) | 67 | 68 (`CAPTURE_AUDIO_INPUT_CHANGED`) | plus up to 7 (2.4, 2.5) | plus 2 | `VOC:346-435` and its category map; `apps/core-server/src/core/__tests__/writers.test.ts:54`; `apps/core-server/src/db/fixtures/__tests__/audit-details.test.ts:149,272,285`; `apps/core-server/src/db/fixtures/operations.ts:487` (the fixture must write every type). Owned by WP-23, WP-07, WP-18 |

### 3.5 Rollback per set

All three sets are additive: tables are created, one column is added, nothing is dropped, renamed or retyped.

| Stage | Set A | Set B | Set C |
|---|---|---|---|
| Fails while applying | The whole pending set is one transaction: nothing remains (`migrations.ts:5-6`) | same | same |
| Merged, not yet applied to a database that matters | Revert the commit (schema files, two migration files, journal entry, snapshot, constants, pins). A development or demo database is rebuilt by `db:reset` | same | same |
| Applied, and must be undone | A new forward set (the applied files are never edited, `migrations.ts:8-14`): drop T-44 and T-45, drop the column, step the version. Code older than the set does not start on the newer database until then (B-3) | Forward set: drop T-46, T-47. **Precondition: no alias row is open**; remove the addresses first, or the host keeps an address nobody tracks | Forward set: drop T-48; the acceptance gate must be switched off in the same release |
| What an undo loses | Stream and sound-card rows (re-read by a new connection test and a new enumeration); the facts of sessions recorded meanwhile (not recoverable; sealed packages are unaffected because nothing here is in the manifest) | The network settings (re-entered); alias history (the audit entries remain) | The acceptance bodies (the audit entries remain, without the body) |

## 4. Open questions, assumptions, hypotheses

### 4.1 Questions for the user

| # | Question | Recommendation | Why |
|---|---|---|---|
| OQ-1 | Should devices seen on the camera network but **not adopted** be stored (the input-av `devices` table)? This is SPEC F-4.3 point 6: it needs RG-4 and D76 (1) amended | **No.** Keep the scan result in memory; store only the alias state and the audit entries | Section 2.7: a second list of devices, no way to remove rows, and no ported function reads it |
| OQ-2 | Is the installation acceptance ("setup awal selesai", with who accepted and the diagnostics) kept as a stored Core record? input-av refuses to record without it (`IAV/service.py:112-115`) | **Yes, as set C, decided separately from sets A and B.** | It is the only gap of the record map with no place at all (M/G-1), and the only home for the site address. It can wait without holding the recording path |
| OQ-3 | Should gain and A/V offset be stored now, or with their function? | **With their function (set D, WP-18).** | Gain setting is still held (SPEC F-4); the offset is applied by nothing that is ported. A column nobody writes would be the first of its kind in this schema |
| OQ-4 | May the Core pick the camera interface automatically when none is set, as input-av does? | **No: the technician chooses it once.** | The function adds an address to that interface; a wrong automatic choice is the office network |
| OQ-5 | Three separate sets (three version steps), or one? | **Three.** | Set A serves the recording path and waits for no ruling; set B waits for SPEC F-4.3; set C for OQ-2. One set would tie the first to the slowest decision |

Already-open entries this design depends on and does not answer: **Q6** (rooms: D-15, D-55, D-58), **Q8** (stored form: D-27, D-29), **Q3** (existing data: D-63; no import target is created).

### 4.2 Assumptions

| # | Assumption | If wrong |
|---|---|---|
| AS-1 | U8 asks for a place for the data of functions that are ported or required (U1, U6, U7), not for a copy of every input-av table | Sets C and E and the WAIT items become mandatory; the shapes are already specified |
| AS-2 | A point-in-time copy inside a session or acceptance record is not a second home of the live value | 2.3 and 2.6 would hold references instead of copies, and a later edit of the registry would change what an old session appears to have used |
| AS-3 | One room per Core stays (SPEC F-7 recommendation, Q6 open) | D-15, D-55 and rooms need columns and a room table: a further set, not a change of these |
| AS-4 | The stored form stays the Core's (SPEC F-3 recommendation, Q8 open) | D-29: more rows in T-45; D-27 gets a consumer; D-39, D-40 would need a part model, which is outside this design |
| AS-5 | A typed PoE port number is stored as a code such as `POE_PORT_3` | Only the code form changes; the column is an open set |
| AS-6 | No ported function needs a free display name per camera or microphone | One nullable text column on the registry, which would then touch the engine mapping |
| AS-7 | A video-source token fits the pattern the Core uses for a profile token | The CHECK widens; no other change |
| AS-8 | An ALSA card id is at most 32 characters of letters, digits and underscore | The CHECK widens |
| AS-9 | A Linux interface name is at most 15 characters of lower-case letters, digits, dot, underscore, hyphen (input-av allows 32 of anything, `IAV/settings.py:40`) | The CHECK widens |
| AS-10 | SPEC as read at its last state (619 lines) is what Amendment 1 will say when finished | Work-package references in 3.2 are re-checked against the final text; WP-24 to WP-26 are renumbered if another package took a number |

### 4.3 Hypotheses (not verified in this pass)

| # | Hypothesis | Settled by |
|---|---|---|
| H-DB-1 | An ONVIF profile token with characters outside the `CODE` form cannot be assigned to a slot today | Reading the capture-config validation and one test with such a token (WP-04) |
| H-DB-2 | A resumed push shows as a jump in `recording_fragments` media times, so no gap table is needed | Experiment E-10 of WP-01 (not run) |
| H-DB-3 | `drizzle-kit` generates `cidr` and `inet` columns and the partial unique index of 2.6, and the inventory tool accepts the new type names | The first `db:generate` of WP-25; fallback `text` with CHECK, and a hand-written index statement in the privileges file |
| H-DB-4 | The seed-order test does not list tables the seed leaves empty | Reading that test in WP-24 |

### 4.4 Not examined

`S/audit.ts`, `S/evidence.ts`, `S/rbac.ts`, `S/stt.ts` (cited through R4 only); the full detail-key lists of `apps/core-server/src/core/audit-details.ts`; the seed and reset routines beyond `kept-tables.ts`; the database contract documents themselves; the evidence manifest specification; `IAV/discovery.py`, `IAV/factory.py`, `IAV/audio.py` beyond the lines cited; anything under `apps/input-av/data/`.

## 5. Lines opened in this pass (read-only)

Core: `S/capture.ts` (all), `S/value-sets.ts` (all), `S/meta.ts` (all), `S/index.ts` (all), `S/checks.ts` (all), `S/sessions.ts:28-193`, `S/recording.ts:92-130,164-213`, `S/core.ts:60-326`; `M/0005`, `M/0006`, `M/0007`, `M/0008`, `M/0009`, `M/0010`, `M/0013`, `M/0014` (all); `apps/core-server/src/db/commands/migrations.ts:1-120`, `commands/status.ts:33-38`; `apps/core-server/src/db/reset/kept-tables.ts:1-110`; `apps/core-server/src/db/mapping/changes.ts:52-80`; `apps/core-server/src/modules/capture-discovery/adoption.ts:15-50`; `apps/core-server/src/capture/adapters/camera/onvif-session.ts:137-142,196-242`; `apps/core-server/src/capture/adapters/types.ts:100-116`; `T/contract-v6-delta.ts:1-57`, `T/contract-inventory.test.ts:1-80`, `T/privileges.db.test.ts:30-150`; `VOC:23-44,340-520`; `packages/shared/src/sim/initial-state.ts:96-110`; `apps/core-server/package.json:16-21`.

input-av: `IAV/db.py:36-225`; `IAV/settings.py:1-133`; `IAV/netalias.py:15-140`; `IAV/commissioning.py` (all); `IAV/routers/audio.py:18-30,66-80,100-120,182-250`; `IAV/service.py:100-150`; `IAV/discovery.py:376-392,590-640`; `IAV/registration.py:40-78`; `IAV/factory.py:60-104`; `IAV/config.py:50-66`.

Searches (2026-10-12): count pins `43`, `15`, `67`, `28` and `INITIAL_MIGRATION_TAGS` over `apps/core-server/test` and `apps/core-server/src/db`; audit type member lines between `VOC:346` and `VOC:435` = 67; `PROFILE_TOKEN` in `onvif-session.ts`; `av_offset_ms` in `IAV/`; a file named "down" in `M/` = 0; `cidr.d.ts`, `inet.d.ts` in the installed `drizzle-orm`.

---
*Generated: 2026-10-12 18:27*
*Last Updated: 2026-10-12 18:27*
