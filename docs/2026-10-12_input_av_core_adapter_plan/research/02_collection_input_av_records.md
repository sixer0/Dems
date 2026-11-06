---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 3
date: 2026-10-12
agent: data-collector
narrative_tier: 2
items_collected: 11 tables, 1 audit format, 53 audit.log call sites (one with a variable action), 3 settings keys, 4 token types, 13 disk artifact groups
source_of_truth: identification/02_structured.md (row 3)
---

# Records written by input-av (collected from source code only)

Collection only. No analysis, no verdict, no mapping to Core records.

## 0. Scope statement and method

- Source read: `apps/input-av/nvr/*.py` (all of `db.py`, `audit.py`, `settings.py`, `security.py`, `config.py`, `recorder.py`, `service.py`, `playback.py`, `export.py`, `audio.py`, `storage.py`, `mediamtx.py`, `netalias.py`, `commissioning.py`, `main.py` read in full; `discovery.py`, `factory.py`, `passive.py`, `registration.py`, `routers/*.py` read at the write and audit sites only), `apps/input-av/scripts/*`, `apps/input-av/deploy/*`.
- **Nothing under `apps/input-av/data/` was opened, listed, stat-ed or read.** No `.env` file was read. input-av was not started. Nothing was written outside this task folder. Every record below is derived from the code that writes it. The only directory listings made were `ls` of `apps/input-av/` (top level), `nvr/`, `scripts/`, `deploy/`, `bin/`, `docs/` (names and sizes only; no content of `docs/` or `bin/` was read).
- `apps/input-av/bin/mediamtx` (a binary) and `apps/input-av/docs/*.md` were not read.
- Verification of counts: `grep -rn "CREATE TABLE" nvr scripts deploy docs README.md` returned 0 matches. `grep -rn "__tablename__" nvr --include='*.py'` returned 11 matches (`db.py:41,52,61,70,111,122,147,174,184,203,211`). The tables are created by SQLAlchemy `Base.metadata.create_all(engine)` at `nvr/db.py:250`; no literal `CREATE TABLE` statement exists in the code base. Count stated beside the grep count: 0 literal `CREATE TABLE`, 11 declared tables.
- Late-added columns: `_add_missing_columns()` (`nvr/db.py:254-272`) issues `ALTER TABLE <t> ADD COLUMN <c> <type>` (line 264) for any model column absent in an existing table.
- Database engine: SQLite by default, `NVR_DB_URL` default `sqlite:///{DATA_DIR/'nvr.db'}` (`config.py:14`); `connect_args check_same_thread=False` (`db.py:226-227`). Pragmas on connect: `journal_mode=WAL`, `foreign_keys=ON`, `synchronous=FULL` (`db.py:232-234`).
- All timestamp columns use `UTCDateTime` (`db.py:21-33`): stored as UTC naive, returned UTC aware.
- Id helpers: `new_id()` = `uuid4().hex` (32 chars) (`db.py:17-18`).

## 1. SQLite tables (declared in `nvr/db.py`)

Notation: column: type, constraint/default. Comments quoted from the source are in quotes.

### 1.1 `users` (`db.py:40-48`)
| Column | Declaration |
|---|---|
| id | int PK |
| username | String(64) unique |
| full_name | String(200) default "" |
| password_hash | String(255) |
| role | String(16) ("admin \| operator \| auditor", `db.py:46`) |
| active | Boolean default True |
| created_at | datetime default utcnow |

Writers: bootstrap admin `main.py:32-34`; `POST /users` `routers/admin.py:47-49`; update `routers/admin.py:70-75` (fields full_name, role, active, password).

### 1.2 `refresh_tokens` (`db.py:51-57`)
| Column | Declaration |
|---|---|
| jti | String(32) PK |
| user_id | int FK users.id |
| device | String(200) default "" |
| expires_at | datetime |
| revoked | Boolean default False |

Writers: insert `security.py:66`; set `revoked=True` `routers/auth.py:48` (rotation on refresh) and `routers/auth.py:62` (logout).

### 1.3 `rooms` (`db.py:60-66`)
| Column | Declaration |
|---|---|
| id | int PK |
| name | String(100) unique |
| description | Text default "" |
| (relationship) cameras | ordered by Camera.sort_order, Camera.id |

Writers: `routers/admin.py:98-99` (create), `routers/admin.py:131-132` (bulk create), update `routers/admin.py:197`, delete `routers/admin.py:207`.

### 1.4 `cameras` (`db.py:69-103`)
| Column | Declaration |
|---|---|
| id | int PK |
| room_id | int FK rooms.id |
| name | String(100) |
| host | String(255) nullable |
| port | int default 80 |
| username | String(100) default "" |
| password | String(255) default "" (stored in this table; no encryption code in `db.py`) |
| profile_token | String(100) nullable |
| rtsp_url | Text ("berisi kredensial; jangan diekspos", `db.py:79`) |
| device_info | JSON default dict |
| enabled | Boolean default True |
| device_group | String(32) nullable ("Satu kamera fisik (mis. dual-lens) = beberapa baris Camera dengan device_group sama", `db.py:82-83`) |
| device_mac | String(17) nullable |
| lens | int default 1 |
| video_source_token | String(100) nullable |
| preview_url | Text nullable ("Sub-stream untuk live preview", `db.py:88`) |
| kind | String(8) default "video" ("video" = camera, "audio" = soundcard; `rtsp_url` = "alsa:<device>" or "pulse:<source>", settings in `device_info`; `db.py:90-92`) |
| poe_port | int nullable |
| sort_order | int default 0 |
| record_stream | String(8) default "main" ("main" or "sub"; `record_url` property returns `preview_url` when "sub", `db.py:100-102`) |

`preview_path` property: `f"cam{self.id}"` (`db.py:105-107`).

Writers: ONVIF registration `registration.py:62-70`; manual create `routers/admin.py:251-273`; audio source create `routers/audio.py:192-196`; update `routers/admin.py:381-387`; audio source update `routers/audio.py:237-247`; delete `routers/admin.py:398`; IP follow (host, rtsp_url, preview_url) `discovery.py:612-625` (`_follow_ip`); preview URL backfill `routers/sessions.py:216-228`.

`device_info` JSON keys written by code (seen at the write sites): `last_test {ok, at}` (`routers/admin.py:416-424`); `preview_codec`, `preview_codec_at`, `preview_profile` (`routers/sessions.py:217-228`); `profile`, `preview_profile` and ONVIF device info (`registration.py:66-67`); audio: `audio {inputs, device_channels, sample_rate, bits}` (`routers/audio.py:117-118,193-195`) and `av_offset_ms` (`routers/audio.py:195,242-243`).

### 1.5 `cases` (`db.py:110-117`)
| Column | Declaration |
|---|---|
| id | int PK |
| case_number | String(100) unique |
| title | String(300) default "" |
| description | Text default "" |
| created_by | int FK users.id |
| created_at | datetime default utcnow |

Writers: `routers/sessions.py:45-46` (POST /cases), `routers/sessions.py:88-89` (created implicitly by REKAM with `case_number`).

### 1.6 `sessions` (class `RecordingSession`, `db.py:120-141`)
| Column | Declaration |
|---|---|
| id | String(32) PK default new_id |
| case_id | int FK cases.id |
| room_id | int FK rooms.id |
| operator_id | int FK users.id |
| stopped_by | int FK users.id nullable |
| status | String(16) default "recording" ("recording\|stopped\|interrupted") |
| started_at | datetime default utcnow |
| stopped_at | datetime nullable |
| notes | Text default "" |
| extra | JSON default dict ("Metadata bebas dari tablet: nama terperiksa, jenis pemeriksaan, device id, dsb.") |
| clock_synced | bool nullable |
| site | JSON default dict ("Salinan identitas lokasi saat sesi dimulai") |

Writers: insert `service.py:127-131`; stop (status, stopped_at, stopped_by) `service.py:280-285`; recovery after crash (status "interrupted", stopped_at) `service.py:341-343`.

### 1.7 `recordings` (`db.py:144-169`)
| Column | Declaration |
|---|---|
| id | String(32) PK default new_id |
| session_id | FK sessions.id |
| camera_id | FK cameras.id |
| camera_name | String(100) |
| part | int default 1 |
| file_path | Text |
| status | String(16) default "recording" ("recording\|complete\|error\|interrupted") |
| started_at | datetime default utcnow |
| stopped_at | datetime nullable |
| size_bytes | int nullable |
| duration_s | float nullable |
| sha256 | String(64) nullable |
| error | Text nullable |
| media_start_at | datetime nullable ("Perkiraan waktu (UTC) sampel media pertama di file") |
| playback_path | Text nullable ("Salinan putar (MP4 H.264) ... BUKAN bukti asli") |
| playback_sha256 | String(64) nullable |
| playback_status | String(16) nullable ("pending\|processing\|ready\|error") |

Writers: insert `service.py:159-162` (`_start_part`); finalize (stopped_at, media_start_at, size_bytes, sha256, duration_s, playback_status="pending", status, error) `service.py:225-241`; delete of a discarded retry row `service.py:253-256`; crash recovery `service.py:339-340` via `_finalize`; playback fields set by `playback._set` `playback.py:97-103` (called `playback.py:80,143,145,198,206`); queue re-arming at startup `playback.py:46-53`.

### 1.8 `markers` (`db.py:172-179`)
| Column | Declaration |
|---|---|
| id | int PK |
| session_id | FK sessions.id |
| ts | datetime default utcnow |
| user_id | FK users.id |
| text | Text |

Writer: `routers/sessions.py:149-150` (POST /sessions/{id}/markers; allowed only while session status is "recording", `sessions.py:146-148`).

### 1.9 `devices` (`db.py:182-197`)
| Column | Declaration |
|---|---|
| id | int PK |
| key | String(64) unique (MAC, or "ip:<ip>" when MAC unknown) |
| mac | String(17) nullable |
| ip | String(45) |
| vendor | String(200) default "" |
| interface | String(32) default "" |
| onvif | Boolean default False |
| onvif_xaddr | Text nullable |
| onvif_name | String(200) default "" |
| onvif_hardware | String(200) default "" |
| status | String(16) default "online" ("online \| offline") |
| first_seen | datetime default utcnow |
| last_seen | datetime default utcnow |
| last_change | datetime default utcnow |

Writers: insert `discovery.py:603-606`; update of ip/status/last_seen/onvif fields `discovery.py:608-624`; delete of an "ip:" placeholder row `discovery.py:598-600`; offline marking `discovery.py:659-662`; delete by admin `routers/devices.py:57`.

### 1.10 `settings` (class `Setting`, `db.py:201-206`)
| Column | Declaration |
|---|---|
| key | String(64) PK |
| value | JSON |
| updated_at | datetime default utcnow |

Keys written by code (complete list from a grep for `Setting(` and `db.get(Setting`):

| Key | Constant | Writer | Content |
|---|---|---|---|
| `site` | `settings.KEY` `settings.py:16` | `settings.save` `settings.py:107-123` (insert `:118`, update `:116`) | the `SiteSettings` model dump (fields listed in section 4) |
| `commissioning` | `commissioning.KEY` `commissioning.py:12` | `commissioning.complete` `commissioning.py:79-96` (insert `:93`, update `:91`); delete by `commissioning.reset` `commissioning.py:99-105` (`:104`) | `rep`: completed_at, by {id, username, full_name}, version, site snapshot, steps, diagnostics (`commissioning.py:84-87`) |
| `net_aliases` | `netalias.STATE_KEY` `netalias.py:21` | `netalias._save_state` `netalias.py:63-70` (insert `:69`, update `:67`) | dict keyed `"<iface>\|<cidr>"` -> {iface, cidr, added_at} (`netalias.py:98`) |

No other `Setting(` constructor exists in `nvr/`.

### 1.11 `audit_log` (class `AuditLog`, `db.py:209-222`)
| Column | Declaration |
|---|---|
| id | int PK (autoincrement) |
| ts | datetime default utcnow |
| user_id | int nullable (no FK declared) |
| username | String(64) default "" |
| action | String(64) |
| object_type | String(32) default "" |
| object_id | String(64) default "" |
| details | JSON default dict |
| ip | String(64) default "" |
| prev_hash | String(64) |
| hash | String(64) |

Docstring (`db.py:210`): "Append-only; setiap baris memuat hash baris sebelumnya (hash chain)." Writer: `audit.log` only (`audit.py:30-40`).

## 2. Audit log format (`nvr/audit.py`)

- Rule (`audit.py:1-5`): `hash_n = SHA256(prev_hash || canonical JSON of entry n)`.
- Genesis: `GENESIS = "0" * 64` (`audit.py:14`).
- Canonical JSON (`audit.py:18-23`): `json.dumps({ts, user_id, username, action, object_type, object_id, details, ip}, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()`, with `ts` formatted `"%Y-%m-%dT%H:%M:%S.%fZ"` (line 20). `prev_hash` and `hash` are not part of the canonical payload.
- Hash: `sha256(prev.encode() + _canonical(e)).hexdigest()` (`audit.py:26-27`).
- `log(action, user=None, object_type="", object_id="", details=None, ip="", username=None)` (`audit.py:30-31`): takes a process-wide `threading.Lock` (`audit.py:15,32`) and opens its own `SessionLocal()`; reads the last row's `hash` ordered by id desc (line 33) or GENESIS; `user_id = user.id if user else None`; `username = username if given else (user.username if user else "system")` (lines 35); `object_id` stored as `str(object_id)` (line 36); `details or {}`; commits (line 40).
- `verify_chain()` (`audit.py:43-52`): walks all rows by id ascending, returns `{"valid": False, "entries_checked": n, "broken_at_id": id}` or `{"valid": True, "entries_checked": n, "head_hash": prev}`. Exposed at `GET /audit/verify` (`routers/audit_internal.py:32-35`).
- Readers: `GET /audit` (`routers/audit_internal.py:15-30`) returns id, ts, user_id, username, action, object_type, object_id, details, ip, hash (not prev_hash); session export includes `prev_hash` (`export.py:68-71`).
- Audit-derived read in commissioning: counts `audit_log` rows `action == "user.update"` with `details["password"] == "(diubah)"` (`commissioning.py:36-38`).
- Count of call sites: `grep -rn "audit\.log(" nvr --include='*.py'` = 53 lines (52 literal action sites + 1 site with a variable action, `discovery.py:637`).

### 2.1 Every `audit.log(...)` call site: action, object_type, writer file:line

| Action | object_type | Call site |
|---|---|---|
| `camera_device.register` | camera_device | `registration.py:74` |
| `recording.playback_copy_failed` | recording | `playback.py:199` |
| `recording.playback_copy` | recording | `playback.py:207` |
| `session.start` | session | `service.py:141` |
| `recording.resumed` | recording | `service.py:177` |
| `recording.stream_lost` (when data was received) or `recording.connect_failed` (no data) | recording | `service.py:201` |
| `session.stop` | session | `service.py:295` |
| `session.interrupted` | session | `service.py:344` |
| `system.commissioned` | system | `commissioning.py:95` |
| `system.commissioning_reset` | system | `commissioning.py:106` |
| `network.link_up` / `network.link_down` | interface | `discovery.py:388` |
| `camera.ip_followed` | camera | `discovery.py:629` |
| variable `action` = `device.discovered`, `device.ip_changed`, `device.online` (events list built at `discovery.py:604,610,613`) | device | `discovery.py:637` |
| `device.offline` | device | `discovery.py:668` |
| `device.factory_scan` | network | `factory.py:76` |
| `device.set_ip` (single device) | device | `factory.py:99` |
| `device.set_ip` (wizard, `"via": "wizard"`) | device | `factory.py:171` |
| `case.create` (POST /cases) | case | `routers/sessions.py:51` |
| `case.create` (implicit, from REKAM) | case | `routers/sessions.py:91` |
| `storage.rejected` | room | `routers/sessions.py:101` |
| `session.marker` | session | `routers/sessions.py:153` |
| `session.export` | session | `routers/sessions.py:167` |
| `room.preview` | room | `routers/sessions.py:202` |
| `recording.play` (kind=playback) / `recording.download` (kind=original) | recording | `routers/sessions.py:255` |
| `recording.verify` | recording | `routers/sessions.py:292` |
| `audio.connected` | audio | `audio.py:362` |
| `audio.disconnected` | audio | `audio.py:367` |
| `user.create` | user | `routers/admin.py:54` |
| `user.update` | user | `routers/admin.py:75` |
| `room.create` | room | `routers/admin.py:104` |
| `room.bulk_create` | room | `routers/admin.py:136` |
| `room.update` | room | `routers/admin.py:197` |
| `room.delete` | room | `routers/admin.py:209` |
| `camera.create` | camera | `routers/admin.py:273` |
| `settings.update` | settings | `routers/admin.py:347` |
| `camera.update` | camera | `routers/admin.py:387` |
| `camera.delete` | camera | `routers/admin.py:400` |
| `device.dhcp_request` | device | `passive.py:114` |
| `storage.critical` | storage | `storage.py:114` |
| `storage.low` | storage | `storage.py:120` |
| `network.alias_add` | interface | `netalias.py:101` |
| `network.alias_remove_failed` | interface | `netalias.py:130` |
| `network.alias_remove` | interface | `netalias.py:133` |
| `system.bootstrap_admin` | user | `main.py:35` |
| `system.start` | (empty) | `main.py:50` |
| `system.stop` | (empty) | `main.py:62` |
| `auth.login_failed` | user | `routers/auth.py:30` |
| `auth.login` | user | `routers/auth.py:34` |
| `auth.logout` | user | `routers/auth.py:64` |
| `audio.mixer` | audio | `routers/audio.py:77` |
| `audio_source.create` | camera | `routers/audio.py:198` |
| `audio_source.update` | camera | `routers/audio.py:247` |
| `device.forget` | device | `routers/devices.py:59` |

Row count check: the table has 53 rows, equal to the 53 grep lines (rows with two actions in one site, and the variable-action site, are one row each).

### 2.2 `details` payload keys per site (as written in code)

- `session.start` (`service.py:141-147`): room_id, case_id, cameras (list of camera ids), clock_synced, extra, site, sleep_inhibited, audio_devices [{camera_id, name, card, name, product, usbid, channels, inputs}].
- `session.stop` (`service.py:295-296`): reason, recordings [{id, camera_id, part, status, sha256, size_bytes, duration_s}] (summary built `service.py:288-290`).
- `session.interrupted` (`service.py:344-346`): recordings [{id, sha256, status}].
- `recording.resumed` (`service.py:177-178`): session_id, camera_id, part.
- `recording.stream_lost` / `recording.connect_failed` (`service.py:201-204`): session_id, camera_id, part, sha256, error (last 300 chars of ffmpeg stderr).
- `recording.playback_copy` (`playback.py:207-210`): source_sha256, playback_sha256, method, source_codec, note "salinan putar, bukan bukti asli", audio_from.
- `recording.playback_copy_failed` (`playback.py:199-201`): source_sha256, codec, exit_code, output_duration_s, error.
- `recording.verify` (`routers/sessions.py:292-293`): recording_id, expected_sha256, actual_sha256, match.
- `session.export` (`routers/sessions.py:167-168`): file, sha256, integrity_ok.
- `session.marker` (`routers/sessions.py:153-154`): marker_id, text, offset_s.
- `recording.play` / `recording.download` (`routers/sessions.py:255-256`): kind.
- `system.commissioned` (`commissioning.py:95`): the full `rep` dict (section 1.10).
- `auth.login_failed` (`routers/auth.py:30-32`): details {device}; `username` argument set to `body.username[:64]`; object_id = user id or "".
- `auth.login` (`routers/auth.py:34-35`): details {device}.

## 3. User, token and credential material (`nvr/security.py`, `nvr/config.py`)

| Item | Where written / produced | Persisted? |
|---|---|---|
| Password hash: scrypt, format `scrypt$16384$8$1$<b64 salt>$<b64 hash>` (n=2**14, r=8, p=1, dklen=32, salt 16 random bytes) | `security.py:23-26`; stored in `users.password_hash` | Yes (users table) |
| `DUMMY_HASH` (constant-time login for unknown usernames) | `security.py:40` | No (in memory) |
| Access token (JWT HS256; claims sub, role, typ="access", iat, exp; TTL `NVR_ACCESS_TOKEN_MINUTES` default 15) | `security.py:62-63`, `_encode` `security.py:44-46`, config `config.py:31` | No |
| Refresh token (JWT; claims sub, typ="refresh", jti; TTL `NVR_REFRESH_TOKEN_DAYS` default 7) with row in `refresh_tokens` | `security.py:64-68`, config `config.py:32` | Row yes (jti, user_id, device, expires_at, revoked); the JWT string no |
| Preview token (JWT; typ="preview", paths list; TTL `NVR_PREVIEW_TOKEN_MINUTES` default 60) | `security.py:73-77`, config `config.py:33` | No |
| Media token (JWT; typ="media", rec = `"playback:<rec_id>"`, `"original:<rec_id>"` or `"export:<zip name>"`; default TTL 4 hours) | `security.py:80-82`; issued at `routers/sessions.py:168` (export) and `routers/sessions.py:254` (play-token) | No |
| JWT secret: env `NVR_JWT_SECRET`, otherwise generated with `secrets.token_urlsafe(48)` and written to file `DATA_DIR/.jwt_secret`, chmod 0600 | `config.py:17-30` (write `:25`, chmod `:26`) | Yes (file) |
| Bootstrap admin: created once when `users` is empty; username `NVR_ADMIN_USER` (default "admin"), password `NVR_ADMIN_PASSWORD` or `secrets.token_urlsafe(12)`; when no env password, the generated one is printed to stdout | `main.py:27-38`; config `config.py:36-37` | Hash in users; plaintext only on stdout |
| Camera credentials: `cameras.username`, `cameras.password` columns (plain String columns) and username/password embedded in `cameras.rtsp_url` | `db.py:76-77,79`; written `registration.py:62-64`, `routers/admin.py:251-253` | Yes (cameras table) |
| Credential redaction of ffmpeg stderr kept in memory | `recorder.py:174` (`redact` imported `recorder.py:23`) | No |
| Authorization roles | `ROLES = ("admin", "operator", "auditor")` `security.py:17`; checked by `require()` `security.py:97-102` | - |

## 4. Settings keys (`nvr/settings.py`, stored under `settings.key = "site"`)

`SiteSettings` fields (`settings.py:19-67`): site_code (max 50), site_name (max 200), site_address (max 500), deployment_mode ("appliance"|"lan", default "lan"), max_camera_devices (8, 1-16), lenses_per_device (2, 1-4), audio_inputs (8, 1-32), camera_iface (default `config.CAMERA_IFACE`), camera_subnet (default `config.CAMERA_SUBNET`), discovery_scope ("all"|"onvif", default "onvif"), discovery_interval_s (default from `config.DISCOVERY_INTERVAL`, 5-600), device_offline_after_s (default from `config.DEVICE_OFFLINE_AFTER`, 15-3600), follow_camera_ip (True), factory_default_ips (default ["192.168.1.64", "192.168.1.108", "192.168.0.90", "192.168.1.13"]), factory_alias_host (253), factory_alias_minutes (30), camera_ip_start (101), min_free_gb (10.0), critical_free_gb (2.0).

`PRESETS` dict (`settings.py:88-91`). Session-start snapshot `site_snapshot()` returns site_code, site_name, site_address, deployment_mode (`settings.py:130-133`) and is stored in `sessions.site` (`service.py:129`).

Environment-variable configuration keys read by `config.py` (names and defaults only; no `.env` read): NVR_DATA_DIR ("data"), NVR_DB_URL, NVR_JWT_SECRET, NVR_ACCESS_TOKEN_MINUTES (15), NVR_REFRESH_TOKEN_DAYS (7), NVR_PREVIEW_TOKEN_MINUTES (60), NVR_ADMIN_USER ("admin"), NVR_ADMIN_PASSWORD, NVR_MEDIAMTX_API ("http://127.0.0.1:9997"), NVR_PREVIEW_HLS_BASE, NVR_PREVIEW_WEBRTC_BASE, NVR_FFMPEG ("ffmpeg"), NVR_FFPROBE ("ffprobe"), NVR_RECONNECT_DELAY (2), NVR_CORS_ORIGINS, NVR_DISCOVERY ("1"), NVR_CAMERA_IFACE, NVR_CAMERA_SUBNET, NVR_DISCOVERY_INTERVAL (30), NVR_DEVICE_OFFLINE_AFTER (90), NVR_SWEEP ("1"), NVR_SYSFS_NET ("/sys/class/net"), NVR_OUI_FILE ("/usr/share/ieee-data/oui.csv") (`config.py:11-65`).

## 5. Every file type written to disk, with writer

`DATA_DIR = Path(NVR_DATA_DIR or "data").resolve()` (`config.py:11`); `RECORDINGS_DIR = DATA_DIR/"recordings"`, `EXPORTS_DIR = DATA_DIR/"exports"` (`config.py:12-13`). Directories created: `main.py:43-44`, `storage.py:29`, `export.py:37`, `recorder.py:143`.

| # | Artifact | Path pattern | Writer (file:line) | Notes (from code) |
|---|---|---|---|---|
| 1 | SQLite database | `DATA_DIR/nvr.db` | `config.py:14`, `db.py:226-227,250` | WAL pragma set at `db.py:232`; WAL mode of SQLite uses side files `nvr.db-wal` and `nvr.db-shm` (SQLite behavior implied by the pragma; not observed) |
| 2 | JWT secret file | `DATA_DIR/.jwt_secret` | `config.py:25-26` | chmod 0600; written only if env secret absent and file absent |
| 3 | Video evidence file (original) | `RECORDINGS_DIR/YYYY/MM/DD/<session_id>/cam<camera_id>-p<part:02d>.ts` | path built `service.py:153-154`; content by FFmpeg `recorder.py:148-152` | MPEG-TS (`-f mpegts`). Args verbatim: `-map 0:v:0 -map 0:a:0? -c:v copy -c:a aac -ar 48000 -b:a 128k -f mpegts <path>` (`recorder.py:148-149`); common prefix `-hide_banner -nostats -loglevel warning -n -progress pipe:1 -stats_period 0.5` (`recorder.py:150-151`); RTSP input args `-rtsp_transport tcp -timeout 5000000 -i <url>` (`recorder.py:216-217`). File made read-only (0o444) and SHA-256 computed on finalize (`service.py:229-234`); empty file deleted (`service.py:235-237`); discarded retry file deleted (`service.py:251`) |
| 4 | Audio evidence file, 1-2 inputs | same directory, `cam<id>-p<NN>.flac` | `service.py:154` (extension from `audio_format`), `recorder.py:124-125` | args `-c:a flac -f flac`; map `0:a:0`; optional `-af pan=...` select filter (`recorder.py:111-116,146`) |
| 5 | Audio evidence file, more than 2 inputs | same directory, `cam<id>-p<NN>.wav` | `recorder.py:126-127` | args `-c:a pcm_s24le` (or `pcm_s32le` when bits==32) `-rf64 auto -f wav` |
| 6 | Audio capture input parameters (source side of 4/5) | n/a (process arguments) | `recorder.py:205-215` | `-thread_queue_size 1024 -f alsa -c:a pcm_s<bits>le -channels <capture_channels> -sample_rate <sample_rate default 48000> -i <dev>`; ALSA device goes through `shared_pcm()` (`audio.py:442-445`) |
| 7 | Playback copy (video) | `<original stem>.play.mp4` beside the original | `playback.py:157,176-178,203-204` | temp name `<stem>.play.part.mp4` (`playback.py:176`), `os.replace` to final (`:203`), chmod 0o444 (`:204`), SHA-256 stored (`:205-206`). Remux `-c:v copy` when source codec is h264, else `libx264 -preset veryfast -crf 20 -pix_fmt yuv420p` (`:158-160`); `-movflags +faststart`; audio `-c:a copy`, or soundcard audio muxed as AAC 192k (`:161-175`); run under `nice -n 10` (`:177`) |
| 8 | Playback copy (audio) | `<original stem>.play.m4a` | `playback.py:147-154,176-178,203-204` | AAC 192k; `listen_mix_filter` mono mix for more than 2 channels (`recorder.py:130-136`) |
| 9 | Export package | `EXPORTS_DIR/<case>_<session id[:8]>_<UTC stamp>.zip` | `export.py:36-84` (name `:40`, write `:49-81`, chmod 0o444 `:83`) | ZIP members: `recordings/cam<camera_id>-<slug>-p<NN><suffix>` (originals, stored uncompressed, `:59-61`), `session.json`, `audit_log.json`, `README.txt`, `SHA256SUMS` (`:76-81`). `session.json` carries session metadata, operator, per-recording `integrity` list, `exported_at`, `exported_by` (`:44-75`). `audit_log.json` holds audit rows where `object_id` is the session id or one of its recording ids, or `details.session_id == session id`, with fields id, ts, username, action, object_type, object_id, details, ip, prev_hash, hash (`:63-71`). `SHA256SUMS` lines `"<hex>  <name>"` (`:80`) |
| 10 | Shared ALSA configuration (generated) | `DATA_DIR/alsa/dems-alsa.conf` (+ `.tmp` during write, `ALSA_CONF.with_suffix(".tmp")`) | `audio.py:395,463-488` (write `:485`, replace `:486`) | Content: first line `</usr/share/alsa/alsa.conf>` then, per capture card, a `pcm.dems_<card>_<dev>_shared` block (`type dsnoop`, `ipc_key 52000 + crc32(card:dev) % 9000`, `ipc_perm 0660`, slave `hw:CARD=..,DEV=..` with channels, rate, format, `period_size 1024`, `buffer_size 8192`) and `pcm.dems_<card>_<dev> { type plug slave.pcm "..._shared" }` (`:473-479`). Format preference `S32_LE, S24_3LE, S24_LE, S16_LE` (`:396`). Sets `os.environ["ALSA_CONFIG_PATH"]` (`:487`). Rewritten only when the text changed (`:483`) |
| 11 | Audio test recording | `<system temp dir>/dems-audio-test/uji-<epoch>.wav` | `audio.py:299-317` | `pcm_s16le` WAV; files older than 3600 s removed on next test (`:311-313`) |
| 12 | Application log lines | stderr/stdout of the process (no file handler) | `logging.getLogger` in `main.py:24`, `playback.py:29`, `mediamtx.py:16`, `discovery.py:40`; `grep -rn "basicConfig\|FileHandler" nvr` returned no match | No log file is opened by `nvr/`. The LAN test launcher redirects MediaMTX stdout/stderr to `$NVR_DATA_DIR/mediamtx.log` (`scripts/start-lan-test.sh:42`) |
| 13 | FFmpeg/ffprobe work products held only in memory | n/a | `recorder.py:30,51`; `FFmpegJob.stderr_tail` (last 30 lines), `media_start` estimate (`recorder.py:156-168`) | persisted indirectly as `recordings.error` (`service.py:240`) and `recordings.media_start_at` (`service.py:227`) |

Modules that write no file of their own (checked by reading): `storage.py` (creates `RECORDINGS_DIR` only, `:29`; writes audit rows `:114,120`), `mediamtx.py` (HTTP calls to MediaMTX API only: `config/paths/add|delete` `mediamtx.py:67-76,87-93`), `netalias.py` (settings row `net_aliases`; runs `ip addr add|del` `netalias.py:37`), `settings.py` (settings row `site`), `service.py` (files via FFmpeg, chmod and unlink as listed in rows 3-5).

External state written by input-av outside the data directory (from code):

| Target | Writer (file:line) | Content |
|---|---|---|
| MediaMTX path configuration (`cam<ID>`, `audiomon`) | `mediamtx.py:65-76` (`ensure_path`), `mediamtx.py:86-93` (`ensure_publisher_path`) | path config for on-demand pull, or an FFmpeg H.264 preview command via `runOnDemand` (`mediamtx.py:52-62`) |
| Linux interface alias addresses | `netalias.py:36-47` (`ip addr add|del`, or `sudo -n /usr/local/sbin/dems-netalias`) | temporary `<subnet>.<alias_host>/24` aliases |
| systemd inhibitor process | `service.py:300-320` (`systemd-inhibit ... sleep infinity`) | process only |
| Mixer gain on a sound card | `audio.py:178-185` (`amixer -c <card> sset <control> <pct>% cap`) | hardware state; audit `audio.mixer` `routers/audio.py:77` |
| Camera network configuration | `factory.py:96,99` and `factory.py:165-171` (ONVIF `set_network`) | camera IP settings; audit `device.set_ip` |

### 5.1 Recording lifecycle values written to the DB (state machine as coded)

- Session `status`: "recording" (insert default `db.py:129`) -> "stopped" (`service.py:282`) or "interrupted" (`service.py:341`).
- Recording `status`: "recording" (default) -> "complete" / "error" / "interrupted" (`service.py:184,190,199,339`; `_finalize` sets `status` at `service.py:239`, and converts "complete" to "error" when no data, `:237`).
- Part numbering: `run.part += 1` per `_start_part` (`service.py:152`); a stream drop finalizes the file with status "error" and a new part starts after delay `RECONNECT_DELAY` (2 s default) or an exponential delay capped at `MAX_RETRY_DELAY = 30.0` (`service.py:20,205-211`); repeated failed retries without data delete the row and decrement `part` (`service.py:193-197`).
- Playback status: "pending" at finalize (`service.py:234`) -> "processing" (`playback.py:145`) -> "ready" (`:206`) or "error" (`:80,143,198`).
- Disk monitor constants: `CHECK_INTERVAL_S = 15`, `WARN_REPEAT_S = 600` (`storage.py:20-21`).

## 6. Installation and deployment artifacts (`scripts/`, `deploy/`)

### 6.1 `scripts/install.sh` writes (appliance mode unless noted)
| Target | Line | Content / mode |
|---|---|---|
| System packages via apt | 61-62 | ffmpeg tcpdump alsa-utils iproute2 iputils-ping iputils-arping util-linux sudo curl python3 python3-venv ieee-data (package list `:36-37`) |
| `/var/lib/dems-nvr-ieee.stamp` | 68-71 | touched after `update-ieee-data` |
| Service user `dems`; `audio` group membership | 75-82 | `useradd --system`, `usermod -aG audio` |
| `/usr/local/sbin/dems-netalias` | 86 | copy of `scripts/dems-netalias`, mode 0755 |
| `/etc/sudoers.d/dems-netalias` | 87-90 | `<user> ALL=(root) NOPASSWD: /usr/local/sbin/dems-netalias`, mode 0440 |
| NTP via `timedatectl set-ntp true` | 93 | system setting |
| `$APP/.venv` and `$APP/.venv/.req-installed` | 105-109 | venv, copy of requirements |
| `$APP/bin/mediamtx` | 110-118 | MediaMTX `v1.9.3` download (`:30`) |
| ufw rules (ports 8000/tcp 8888/tcp 8889/tcp 8189/udp 3702/udp) | 121-125 | firewall |
| `/etc/dems-nvr.env` (`ENV_FILE`) | 137-146 | keys written: NVR_DATA_DIR, NVR_JWT_SECRET (random base64), NVR_ADMIN_USER=admin, NVR_ADMIN_PASSWORD (random 16 chars); mode 0640 (values not read; names taken from the heredoc in the script) |
| `/etc/systemd/system/dems-mediamtx.service` | 148-160 | unit, mode 0644 |
| `/etc/systemd/system/dems-nvr.service` | 161-181 | unit, mode 0644 (uvicorn `nvr.main:app --host 0.0.0.0 --port 8000 --workers 1 --proxy-headers`, `TimeoutStopSec=60`, `KillMode=mixed`) |
| `/etc/dems-nvr/install.json` | 192-198 | JSON: version, mode, installed_at, service_user, app_dir, data_dir, helper_sha256 (read by `doctor.py:60`) |
| Default data locations | 39-43 | appliance `DATA=/var/lib/dems-nvr`; dev `DATA=$SRC/data` |
| Prints initial admin password | 216 | stdout |

### 6.2 Other scripts
- `scripts/start-lan-test.sh`: exports `NVR_DATA_DIR` default `$ROOT/data` (`:11`); creates venv (`:18-22`), downloads `bin/mediamtx` (`:24-33`), creates the data directory (`:41`), writes `$NVR_DATA_DIR/mediamtx.log` (`:42`).
- `scripts/dems-netalias` (root helper): `ip addr add|del <private /24>` (`:43,45`), `tcpdump` listen mode read-only with `timeout` (`:28-29`); writes no file.
- `scripts/uji/level_audio.py`: reads a WAV, prints levels; writes no file.
- `scripts/uji/uji_discovery_link_down.py`: calls `init_db()` (`:7`) with `NVR_DATA_DIR` set by the caller (docstring `:2`); no direct file write.
- `scripts/uji/uji_multi_ruangan.py`: test script; uses a scratch dir `S` with `cam.mp4`, `d2/` as `NVR_DATA_DIR` (`:5,18`), writes `S/ref.wav` via ffmpeg (`:56-57`).

### 6.3 `deploy/`
- `deploy/dems-nvr.service`, `deploy/dems-mediamtx.service`: example unit files (same content class as the units generated at `install.sh:148-181`).
- `deploy/mediamtx.yml`: static MediaMTX configuration; `authMethod: http` with `authHTTPAddress: http://127.0.0.1:8000/internal/mediamtx/auth` (`:6-7`); API `127.0.0.1:9997` (`:14-15`); HLS `:8888`, WebRTC `:8889`, RTSP `127.0.0.1:8554` (`:19-29`); rtmp, srt, playback disabled (`:34-36`); `paths: {}` (`:38`).
- `deploy/Caddyfile`: reverse proxy; `respond /internal/* 404` (`:6`).
- None of these files writes a record at run time.

## 7. Facts on read-only sources (not written by input-av)

- OUI vendor database read from `NVR_OUI_FILE` default `/usr/share/ieee-data/oui.csv` (`config.py:65`).
- `/proc/asound/card*/usbid`, `stream*`, `/proc/asound/cards` read (`audio.py:83-90,124-126,325-335`).
- `/etc/dems-nvr/install.json` read at `doctor.py:60`.

## 8. Collection log

| Step | Action | Target |
|---|---|---|
| 1 | Read blueprint row 3 | `identification/02_structured.md` |
| 2 | Listed (names only) | `apps/input-av/`, `nvr/`, `scripts/`, `deploy/`; `wc -l nvr/*.py` |
| 3 | Read in full | `db.py`, `audit.py`, `settings.py`, `security.py`, `config.py`, `recorder.py`, `service.py`, `export.py`, `playback.py`, `storage.py`, `mediamtx.py`, `netalias.py`, `audio.py`, `commissioning.py`, `main.py`, `scripts/install.sh`, `scripts/start-lan-test.sh`, `scripts/dems-netalias`, `scripts/uji/level_audio.py`, `scripts/uji/uji_discovery_link_down.py`, `deploy/*` |
| 4 | Grep | `audit\.log\(` (53 lines), `__tablename__` (11), `CREATE TABLE` (0), `Setting(`, file-write patterns (`write_text`, `open(`, `unlink`, `chmod`, `os.replace`, `tempfile`, `mkdir`, `FileHandler`, `basicConfig`) |
| 5 | Read at write and audit sites only | `discovery.py` (383-392, 590-672), `factory.py` (70-102, 165-178), `passive.py` (105-125), `registration.py` (55-78), `routers/admin.py`, `routers/auth.py`, `routers/audio.py`, `routers/devices.py`, `routers/sessions.py`, `routers/audit_internal.py` |
| 6 | grep (names) | `scripts/uji/uji_multi_ruangan.py` for write patterns only |
| - | Not opened | `apps/input-av/data/` (nothing), any `.env`, `bin/mediamtx`, `docs/*.md`, `nvr/web/index.html`, `nvr/doctor.py` (except grep matches), `nvr/onvif_client.py`, `nvr/media.py`, `routers/serializers.py` (except grep matches) |

## 9. Gaps / needs more data

- `doctor.py`, `onvif_client.py`, `media.py`, `routers/serializers.py` were searched with write-pattern greps and matched only as listed (`doctor.py:60` read; no write); they were not read in full. Row 1 covers their logic.
- The remaining parts of `discovery.py`, `passive.py` (`_classify` continuation, after line 125) and `factory.py` (job runner `start_provision`, in-memory `jobs` dict referenced at `routers/devices.py:122,131`) were read only at the lines cited. The `factory.jobs` dict is in memory by the grep evidence (no write pattern matched in `factory.py`).
- Actual contents and row counts of `apps/input-av/data/` are unknown by design.
- `scripts/uji/uji_multi_ruangan.py` was only grepped for write patterns, not read in full.

---
*Generated: 2026-10-12*
*Last Updated: 2026-10-12*
