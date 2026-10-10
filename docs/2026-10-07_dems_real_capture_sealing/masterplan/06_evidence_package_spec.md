---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: data-analyst-local
blueprint_row: 32
milestone: M0
class: B (GA:OD-02, OD-03, OD-04, OD-08, OD-15, OD-16, OD-21)
tier: 1
type: evidence-package spec (package layout, manifest v2, signer, verify v2, sealing pipeline v2, tamper demo, export)
status: draft-for-M0-gate
confidence: >-
  HIGH for the package layout, the manifest field inventory, the verify checks and the sealing
  step contracts (mechanical over the M1 spikes S1/S2/S4, the row-30 column names, the row-31
  writer facts and the v1 implementation); MEDIUM for the in-file GCM layout, the fsync policy
  and the export/composite encoder (labelled HYPOTHESIS where a spike did not measure them).
source_translated_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/01_translated.md
source_structured_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/02_structured.md
source_analysis: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/research/03_analysis.md
source_spec: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/masterplan/01_specs.md
last_updated: 2026-10-07 17:45 (row-35 security remediation: SEC35-06/07/10/11/13/20)
source_database_contract: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/masterplan/04_database_contract.md
source_capture_spec: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/masterplan/05_capture_architecture_spec.md
source_transcript_spec: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/masterplan/07_transcript_spec.md
decisions: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/decisions/decisions.md (D4, D7, D8, D10, D12; rev 2.3: D66, D72, D73, D74, D78, D80)
last_updated: 2026-10-09 (row-128 spec-gate fix pass PE-128-67..71 (D89, D91; `gateway_check/27_r9_r11_spec_gate.md`); row 124, errata PE-124-01..PE-124-15: development-source mark, fields 124-126, verify V-15, first video sample fields 127-128, media-time origin; manifest fields 128, verify checks 15); 2026-10-09 (status sweep PE-R8-06..08: §B.7a and the §E.5 R-8 extension CONFIRMED by D24, Q-STT-CFG answer (a); status wording only); 2026-10-08 (RV-SPEC: §B.7a R-8 transcript configuration state added as a proposal, D20; erratum AU2-03 on field 51)
---

# Evidence Package Spec — layout, manifest v2, signer, verify v2, sealing pipeline v2, tamper demo

> **Authority in force.** Blueprint row 32 (`identification/02_structured.md:212`) is the hard gate:
> *"Every manifest v2 field has type plus source; every sealing step has checkpoint, resume rule,
> progress source; verify checks enumerated incl. the one-fragment tamper expectation."* The M7 gate
> adds *"tampering one fragment fails exactly that fragment"* (`structured` §6 M7). Decisions in force:
> **OD-02** (regenerate all demo evidence as v2; only `dems_demo` reseeded; `release/` 0.1.0 untouched;
> tamper demo EV-0005 re-scripted on one fragment), **OD-03** (per-fragment AES-256-GCM in the camera
> file; both stored-bytes and plaintext hashes recorded), **OD-04** (software Ed25519 behind a `Signer`
> interface on this Mac; TPM/PKCS#11 adapter is class C), **OD-08** (a crash during RECORDING seals the
> durable part flagged "interrupted"), **OD-15** (Core key signs transcript revisions; author recorded;
> no approval flow; the sealed machine transcript never changes), **OD-16** (export = decrypted copy +
> manifest + signature, audited; composite side-by-side only on demand, marked derived), **OD-21**
> (fragmented MP4 as "one whole file"; fallback segments + one lossless concatenation stays designed;
> legal confirmation outstanding). All are D4 answers.

**Citation short forms used throughout**

| Short | Source |
|---|---|
| `S1` / `S2` / `S4` | `research/06_spike_s1_fmp4_running_hash.md` / `research/07_spike_s2_mic_switch_timeline.md` / `research/08_spike_s4_av_sync_fixture.md` |
| `register §x` / `SH-nn` / `CS-nn` / `NM-nn` | `research/03_analysis.md` |
| `specs` / R-n / C-Nn | `masterplan/01_specs.md` (row 28) |
| `dbc-3 §x` / `D-DB-nn` | `masterplan/04_database_contract.md` (row 30) |
| `cap §x` / `SP-n` | `masterplan/05_capture_architecture_spec.md` (row 31) |
| `tx §x` | `masterplan/07_transcript_spec.md` (row 33) |
| `coll3 F-nn` | `research/02_collection.md` (F-47/F-52/F-53/F-58..F-61/F-97..F-102) |
| `Dn` | `decisions/decisions.md` decision Dn (D4 = approved gate answers) |
| `NNNN_tables.sql:line` | current migration SQL at `apps/core-server/src/db/migrations/` |
| `v1 <file>` | current v1 implementation under `packages/shared/src/sim/`, `packages/shared/src/demo-data/`, `packages/shared/assets/demo-evidence/` |
| `structured §x / row N` | `identification/02_structured.md` |

---

## 0. Decision inputs in force and the v1 shape this spec evolves

### 0.1 Decisions applied to this spec

| Decision | Answer | Effect on this spec |
|---|---|---|
| OD-02 (D4) | L2: regenerate demo evidence as v2; only `dems_demo` reseeded; `release/` untouched; tamper demo EV-0005 re-scripted on one fragment | Sections F, H.4; register SH-07/SH-11/SH-24, CS-19/CS-20, E-20 |
| OD-03 (D4) | Per-fragment AES-256-GCM in the camera file; **both** stored-bytes and plaintext hashes | Sections A.3, B.4, B.6, D (V-04/V-05); `D-DB-02`; `cap §D` |
| OD-04 (D4) | Software Ed25519 behind a `Signer` interface; TPM/PKCS#11 is class C (C-8) | Section C; `dbc-3 §C.4` (signature CHECK relaxed) |
| OD-08 (D4) | A crash during RECORDING seals the durable part flagged "interrupted" | Section E.4; S1 §5.4; `cap §C.5` |
| OD-15 (D4) | Core key signs revisions; author recorded; no approval flow; machine transcript byte-unchanged | Sections B.7, C.4; `tx §A.6` |
| OD-16 (D4) | Export = decrypted copy + manifest + signature, audited; composite on demand marked derived | Section G; register NM-11/NM-12 |
| OD-21 (D4) | fMP4 as "one whole file"; segments + one lossless concat fallback stays designed; **legal confirmation outstanding** | Sections E.3 (fallback step), H.1; coll3 F-97..F-102; W1-C8 |
| D73, D74 (2), D78 (2), D80 (9) — **Erratum PE-124-01** | R-11: a development source (this computer's own camera or microphone, or a fake source) is marked in the manifest; the mark is a **per-source class**; it covers every package whose sources are not production devices; such a package may be sealed and verifies PASS with the mark reported | Sections B.12 (fields 124-126), C.1, D (V-15), E.6, G.2, H.5; `specs` R-11 AC-7, C-N14 |
| D66 (4b), D72 (d), D72 (e) — **Erratum PE-124-01** | pinned mux flags kept, `delay_moov` rejected; the first video frame is held from file time 0; the worker states the true first video sample once, in the `FIRST_VIDEO_SAMPLE` record; file time 0 = T0 − 1024/48000 s | Section B.12 (fields 127-128, media-time origin); `cap §C.4`, `cap §F` |

### 0.2 The v1 shape (baseline this spec evolves)

| Aspect | v1 (current) | Evidence |
|---|---|---|
| Package folder | `packages/shared/assets/demo-evidence/SESSION-<sessionId>/` | `demo-evidence/README.md:8-21` |
| Package files | `evidence-container.json`, `metadata.json`, `manifest.json`, `signature.sig`, `device-certificate.pem`, `audit-session-extract.jsonl`, optional `media/AUDIO-02.m4a`, optional `export/` | `demo-evidence/README.md:10-21` |
| Manifest schema | `dems.evidence-manifest/1`; 13 design-book fields; 4 tracks (VIDEO-01/02, AUDIO-01=MIC 1, AUDIO-02=MIC 2) | `.../SESSION-SES-20260930-0015/manifest.json:2,48-125`; `demo-data/types.ts:41-56` |
| Signature | detached Ed25519 over the **32-byte SHA-256 digest of `manifest.json`**; key `DEMO-KEY-EVSIGN-01`; certificate `device-certificate.pem` | `demo-evidence/README.md:17`; `demo-alignment.ts:34-37`; `demo-data/verify.ts:13-15` |
| Sealing steps | `FINALIZE_TRACKS`, `CALCULATE_HASHES`, `BUILD_MANIFEST`, `ENCRYPT_PAYLOAD`, `SIGN_MANIFEST`, `STORE_SEALED_PACKAGE` | `session-machine.ts:99-106` |
| Signature DB CHECK | `signature_algorithm = 'SIMULATED-SHA256' AND signature_simulated` | `0001_tables.sql:336` |
| Tamper demo | EV-0005, whole `AUDIO-02` track altered; verify fails exactly `track:AUDIO-02` | `demo-alignment.ts:39-41,109-121`; `demo-evidence/README.md:44` |

---

## A. Package layout

### A.1 On-disk structure of one sealed package

Media root is `cap §H` (`<dataDir>/media/sessions/<sessionId>/`, `config.ts:160`; OD-25). The sealed
package is that session directory; the v2 folder name is `SESSION-<sessionId>/` (the v1 naming, so the
demo assets and the store agree) below the media root.

```text
<dataDir>/media/sessions/<sessionId>/
  session-manifest.json          # dems.evidence-manifest/2  (clear)          §B
  signature.sig                  # detached Ed25519/Ecdsa over manifestSha256 (clear)  §C
  device-certificate.pem         # signing certificate, public key only (clear)         §C
  fragments/
    VIDEO-01.mp4                 # fMP4; per-fragment GCM ciphertext in file  (OD-03)
    VIDEO-02.mp4                 # fMP4; per-fragment GCM ciphertext in file  (OD-03)
    fragments.json               # per-fragment IV/tag/keyId, byte ranges (clear)       §B.6
  transcript/
    transcript.json              # dems.transcript/1 machine transcript (clear)         §B.7
    transcript.srt               # subrip rendering (clear)
    transcript.vtt               # webvtt rendering (clear)
    transcript-revisions.json    # append-only signed revisions (clear)                 §B.7
  audit-session-extract.jsonl    # session audit rows at seal (clear)
  composite/                     # only after an on-demand composite export  (OD-16)     §G
  export/                        # only after an export                              §G
```

**`fragments.json` coverage (SEC35-11).** `fragments/fragments.json` is **not** an independent
document: its `files[].fragments[]` array is the **exact serialization** of the manifest's
`files[].fragments[]` records (§B.6) — one source of truth. Verify V-02 asserts that equality, so a
reader using `fragments.json` cannot be fed altered IV/tag/keyId without breaking the signed manifest.

### A.2 Naming

| Rule | Value | Source |
|---|---|---|
| Package folder | `SESSION-<sessionId>` | v1 `demo-evidence/README.md:10`; `cap §H` |
| Camera files | `VIDEO-01.mp4`, `VIDEO-02.mp4` (one whole file per camera) | OD-01 (D4); OD-21; R-4; `specs §E.4` |
| Session audio track | `AUDIO-01` inside both camera files (no separate audio file in a real package) | OD-01 (D4); `cap §F`; R-4 |
| Manifest | `session-manifest.json`, schema `dems.evidence-manifest/2` | `specs §E.4`; register NM-08 |
| Signature | `signature.sig` (detached) | v1 `demo-evidence/README.md:17` |
| Fragments | `fragments/fragments.json` (the per-fragment IV/tag/keyId + ranges) | register NM-05; `cap §D.1` |
| Transcript | `transcript/transcript.json` (+`.srt`/`.vtt`) and `transcript/transcript-revisions.json` | `tx §A.5/§A.6`; OD-15 |
| Export | `export/EXP-<id>.zip`, `export/export-manifest.json`, `export/export-manifest.sig` | v1 `demo-evidence/README.md:21`; §G |
| Composite | `composite/composite.mp4` (+ `composite/README` inside the export manifest) | OD-16; register NM-12 |

### A.3 What is encrypted vs plaintext at rest (OD-03)

| Element | State at rest | Where the key material lives | Source |
|---|---|---|---|
| Camera file `VIDEO-01.mp4`/`VIDEO-02.mp4` | each fragment's stored byte range `[offset, offset+length)` is one **AES-256-GCM** message; structural boxes (moov/moof/trun) stay clear | session key (32 B) in the Core credential store, never beside the media, never in audit/log | OD-03 (D4); `cap §D.1/§D.2`; coll3 F-47/F-52/F-53 |
| Per-fragment IV + tag + key id | **plaintext**, in `fragments/fragments.json` and the manifest fragment records | none (no key bytes) | `cap §D.1`; `D-DB-02` |
| `session-manifest.json` | plaintext | — | OD-03; `specs §E.4` |
| `signature.sig`, `device-certificate.pem` | plaintext | private key in the Core signer store | OD-04; §C.3 |
| `transcript/*`, `transcript-revisions.json`, `audit-session-extract.jsonl` | plaintext | revision signatures by the Core key | OD-15; `tx §A.5/§A.6` |

**Integrity without the key (OD-03/RF-6).** The per-fragment stored-bytes hash chain and the whole-file
stored-bytes hash are checkable on the ciphertext with no session key; the plaintext hash is checkable
only after decryption (export path, §G). This is the two-hash rule of `D-DB-02` and RF-6.

### A.4 What the export contains (OD-16) — see §G

The exported package is a **decrypted copy** of the camera files plus `session-manifest.json` and
`signature.sig`; the receiver verifies the plaintext hashes, the manifest hash and the signature
without the Core's session or signing key (only the public certificate). The composite is added only on
demand, marked `derived: true`, and hashed into the export manifest (§G.3).

---

## B. Manifest v2 schema — every field with type and source

Schema id `dems.evidence-manifest/2` (v1 was `/1`, `manifest.json:2`). JSON, UTF-8, sorted keys for
canonical hashing. `n` = integer, hex64 = lowercase 64-hex SHA-256 (`D-DB-03`). "Source" names the
writing component and the authority.

### B.1 Identity and provenance (8 fields)

| # | Field | Type (nullable) | Source (component; authority) |
|--:|---|---|---|
| 1 | `schema` | string, const `dems.evidence-manifest/2` | Core sealing pipeline (`STORE_SEALED_PACKAGE`); v1 `manifest.json:2`; `specs §E.4` |
| 2 | `evidenceId` | string, not null | Core seal; `evidence_items.id` CHECK (`0001_tables.sql:332`); v1 `manifest.json:5` |
| 3 | `sessionId` | string, not null | Core seal; `evidence_items.session_id`; v1 `manifest.json:6` |
| 4 | `caseNumber` | string, not null | session input; `evidence_items.case_number`; v1 `manifest.json:29` |
| 5 | `manifestVersion` | n, not null, `2` | Core seal; `evidence_items.manifest_version` `D-DB-01`; OD-02 |
| 6 | `integrity` | string enum `REAL`\|`DEMO_PACKAGE`\|`SIMULATED`, not null | Core seal; `evidence_items.integrity_source` `D-DB-04`; OD-19 |
| 7 | `demo` | boolean, not null | demo generator (SH-24) / Core (real); v1 `manifest.json:3` |
| 8 | `notice` | string, not null | demo generator / Core; v1 `manifest.json:4` |

**Erratum PE-124-03 (D73, D80 (9)).** One more top-level field belongs here: **126 `developmentSources`** (§B.12). It is independent of `integrity` (field 6) and `demo` (field 7): those describe how the hashes and the signature were made and whether the item belongs to the demo dataset; field 126 describes **where the pictures and the sound came from**. A development-mode package has real hashes and a real signature **and** `developmentSources = true`.

### B.2 Timeline (11 fields)

| # | Field | Type (nullable) | Source (component; authority) |
|--:|---|---|---|
| 9 | `timeline.timezone` | string (`+07:00`), not null | Core config; v1 `manifest.json:31` |
| 10 | `timeline.createdAt` | bigint epoch-ms, not null | session machine start; `active_session.createdAt`; v1 `manifest.json:32` |
| 11 | `timeline.startedAt` | bigint epoch-ms, not null | session machine `startRecordingTransition`; v1 `manifest.json:33` |
| 12 | `timeline.stoppedAt` | bigint epoch-ms, **nullable** (null only for an interrupted seal) | session machine stop / crash instant; OD-08 |
| 13 | `timeline.sealedAt` | bigint epoch-ms, not null | Core seal (`STORE_SEALED_PACKAGE`); `evidence_items.sealed_at`; v1 `manifest.json:35` |
| 14 | `timeline.recordingDurationMs` | n, not null (>= 0) | Core seal (media-based for interrupted); v1 `manifest.json:36`; OD-08 |
| 15 | `timeline.interrupted` | boolean, not null | Core seal (durable-prefix path); **OD-08**; S1 §5.4 |
| 16 | `timeline.durableEndMs` | bigint epoch-ms, not null | worker/writer durable boundary; S1 §5.4; `cap §C.5` |
| 17 | `timeline.timeSource.source` | string enum `GNSS`\|`NTP`\|`RTC`, not null | network-time module; `evidence_items.start_time_source`; v1 `manifest.json:39` |
| 18 | `timeline.timeSource.state` | string (`LOCKED`…), not null | network-time module; v1 `manifest.json:40` |
| 19 | `timeline.timeSource.fallbackOrder` | array of string, not null | network-time module; v1 `manifest.json:42-46` |

### B.3 Device, operator, subject (14 fields)

| # | Field | Type (nullable) | Source (component; authority) |
|--:|---|---|---|
| 20 | `device.deviceId` | string, not null | Core config; v1 `manifest.json:8` |
| 21 | `device.name` | string, not null | Core config; v1 `manifest.json:9` |
| 22 | `device.serialNumber` | string, not null | Core config; v1 `manifest.json:10` |
| 23 | `device.hardwareUuid` | string, not null | Core config; v1 `manifest.json:11` |
| 24 | `device.softwareVersion` | string, not null | Core build; v1 `manifest.json:12` |
| 25 | `device.certificate.subject` | string, not null | signer/certificate store; v1 `manifest.json:14` |
| 26 | `device.certificate.serialNumber` | string, not null | signer/certificate store; v1 `manifest.json:15` |
| 27 | `device.certificate.sha256` | hex64, not null | signer/certificate store; `demo-alignment.ts:30`; v1 `manifest.json:16` |
| 28 | `operator.investigatorId` | string, not null | session input; `operators.id`; v1 `manifest.json:20` |
| 29 | `operator.displayName` | string, not null | operators store; v1 `manifest.json:21` |
| 30 | `operator.role` | string enum `INVESTIGATOR`\|`SUPERVISOR`\|`TECHNICIAN`, not null | RBAC; v1 `manifest.json:22` |
| 31 | `subject.name` | string, not null | session input; v1 `manifest.json:25` |
| 32 | `subject.type` | string enum `TERSANGKA`\|`SAKSI`\|`LAINNYA`, not null | session input; `evidence_items.subject_type`; v1 `manifest.json:26` |
| 33 | `subject.authorization` | string, not null | session input; v1 `manifest.json:27` |

### B.4 Track records — one per FILE in v2, `tracks[]` of exactly 2 (18 fields)

The v2 rule is "exactly 2 rows, `VIDEO-01`/`VIDEO-02`, position 1..2, both hashes present"
(`dbc-3 §B.12`, enforced by mapping CS-18/seed/tests, not a DB CHECK per `D-DB-05`). Both camera files
carry the single `AUDIO-01` session track (`evidence_tracks.contains_audio`, R-4).

| # | Field | Type (nullable) | Source (component; authority) |
|--:|---|---|---|
| 34 | `tracks[].trackId` | enum `VIDEO-01`\|`VIDEO-02`, not null | Core seal; `evidence_tracks.track_id`; OD-01 |
| 35 | `tracks[].deviceId` | string (`CAM-01`/`CAM-02`), not null | capture config snapshot (SH-06); `capture_devices.id`; OD-05 |
| 36 | `tracks[].profile` | string, not null | capture config snapshot; `capture_config.video_0n_profile`; OD-05 |
| 37 | `tracks[].name` | string, not null | capture config snapshot; v1 `manifest.json:52` |
| 38 | `tracks[].model` | string, not null | `capture_devices.model`; v1 `manifest.json:53` |
| 39 | `tracks[].firmware` | string, not null | `capture_devices.firmware`; v1 `manifest.json:54` |
| 40 | `tracks[].clockOffsetMs` | n, not null | network-time module /`CameraAdapter.ntpOffsetMs`; CS-11; NM-09 |
| 41 | `tracks[].file` | string (`VIDEO-01.mp4`), not null | Core seal; `evidence_tracks`; v1 `manifest.json:84` |
| 42 | `tracks[].mediaType` | string (`video/mp4`), not null | Core seal; v1 `manifest.json:85` |
| 43 | `tracks[].codec` | string, nullable | capture worker; `evidence_tracks.codec` (`dbc-3 §B.12`); OD-06 |
| 44 | `tracks[].bytes` | bigint, not null (>= 0) | worker + seal; `evidence_tracks.size_bytes`; v1 `manifest.json:87` |
| 45 | `tracks[].durationMs` | bigint, nullable (>= 0) | Core seal; `evidence_tracks.duration_ms`; `D-DB-02` sibling |
| 46 | `tracks[].sha256` | hex64, not null | worker + seal; `evidence_tracks.sha256` = **stored bytes**; S1 §3.1/SP-3; `D-DB-02` |
| 47 | `tracks[].sha256Plain` | hex64, nullable | Core seal after decrypt/plaintext pass; `evidence_tracks.sha256_plain`; `D-DB-02`; RF-6 |
| 48 | `tracks[].fragmentChainHead` | hex64, nullable | worker/writer chain head at close; `evidence_tracks.fragment_chain_head`; S1 §3.1 |
| 49 | `tracks[].fragmentCount` | n, nullable (>= 0) | Core seal; `evidence_tracks.fragment_count`; must equal the `recording_fragments` count (`dbc-3 §B.12` MR-V1) |
| 50 | `tracks[].keyframeAligned` | boolean, not null | writer; **SP-4 fragment quantum** (`cap §C.1`); S1 §6.5 |
| 51 | `tracks[].avOffsetMs` | number, nullable | S4 relative flash-to-beep offset, measured sample-exact (erratum AU2-03: the aligned copy path is 0.00 ms, not −1.333 ms); S4 §5; `cap §F` |

**Erratum PE-D9-03 (D157, D160, D161; integration pass D9).** Field 43 `tracks[].codec`: the
"capture worker" names no codec (protocol 4 has no such member; the worker copies the stream). The
source is **the camera file's own init segment**: the four-character type of the first sample entry
of the video track (`moov/trak[hdlr vide]/mdia/minf/stbl/stsd`), read by the Core before the seal.
Stored form (this spec named no enumeration; `dbc-3 §B.12` says "format CODE"): **`H264`** for
`avc1` / `avc3`, **`HEVC`** for `hvc1` / `hev1`. The profile that was asked of the camera
(`H264_720P30`) is never the source. An init segment whose video sample entry is absent or has no
name in that list is an unusable camera file: the seal stops with `CAMERA_FILE_UNUSABLE`
(`reason: VIDEO_SAMPLE_ENTRY_UNKNOWN` / `NO_VIDEO_SAMPLE_ENTRY`), never with a guessed value. The
field stays nullable for a file that is not there or has no init segment (CLOSE_TRACKS names it).
Open, not decided here: the demo generator (row 82c) writes `H.264 + AAC-LC` in this field of the
demo packages, which is neither form.

**Erratum PE-124-03 (D73, D80 (9); D66, D72 (e)).** Three more fields belong to each `tracks[]` record: **124 `tracks[].sourceClass`**, **127 `tracks[].firstVideoSamplePts`** and **128 `tracks[].firstVideoSampleTimescale`** (§B.12).

### B.5 Session audio track and source intervals (10 fields)

`AUDIO-01` is the one session audio track inside both camera files; `MIC-01`/`MIC-02` are inputs
(`MicRole` PRIMARY/STANDBY); `AUDIO-02` is legacy v1 only (OD-01). Interval rows feed the manifest and
the playback band (register SH-02/SH-06; `session_audio_intervals`).

| # | Field | Type (nullable) | Source (component; authority) |
|--:|---|---|---|
| 52 | `audio.trackId` | string const `AUDIO-01`, not null | Core seal; OD-01 |
| 53 | `audio.codec` | string (`AAC-LC mono 48 kHz`), not null | capture worker; OD-06; `evidence_tracks.codec` |
| 54 | `audio.containsIn` | array of `VIDEO-01`\|`VIDEO-02`, not null | Core seal; R-4; `evidence_tracks.contains_audio` |
| 55 | `audio.sourceIntervals[].seq` | n, not null (>= 1) | capture worker; `session_audio_intervals.seq`; S2 §6 finding 3 |
| 56 | `audio.sourceIntervals[].micDeviceId` | string (`MIC-01`/`MIC-02`), not null | capture worker; `session_audio_intervals.mic_device_id`; OD-09 |
| 57 | `audio.sourceIntervals[].role` | enum `PRIMARY`\|`STANDBY`, not null | capture worker; `session_audio_intervals.role`; OD-09/OD-01 |
| 58 | `audio.sourceIntervals[].fromMs` | bigint, not null (>= 0), **media-pts** | capture worker (pre-encode manifest); `session_audio_intervals.from_media_ms`; S2 §6 finding 3 |
| 59 | `audio.sourceIntervals[].toMs` | bigint, **nullable** (open interval) | capture worker; `session_audio_intervals.to_media_ms`; S2 §6 finding 3 |
| 60 | `audio.sourceIntervals[].reason` | enum `START`\|`MANUAL`\|`STOP`, not null | capture worker; `session_audio_intervals.reason`; OD-09 |
| 61 | `audio.sourceIntervals[].switchedBy` | string operator id, nullable | sessions module actor; `session_audio_intervals.switched_by`; OD-09 |

**Erratum PE-124-03 (D73, D80 (9)).** One more field belongs to each interval record: **125 `audio.sourceIntervals[].sourceClass`** (§B.12). `AUDIO-01` is one track fed by whichever microphone is selected, so the track has no single class: the class is carried **per interval**.

### B.6 Fragment records — one array per camera file (17 fields)

`fragments[].fragments[]` mirrors `recording_fragments` one row per closed fragment (`dbc-3 §B.6`).
Per-fragment stored hashes are the tamper locator (S1 SP-7). The chain rule is S1 §3.1:
`chain_0 = SHA-256("")`, `chain_n = SHA-256(chain_{n-1}raw32 || frag_sha_n_raw32)`.

**GCM AAD (SEC35-10).** The additional-authenticated-data of each fragment's GCM message is the
canonical encoding `(trackId, seq, byteOffset, keyId)`. It is **derived, not stored** (the field count
stays 17), and V-02/V-06 recompute it on verify — this binds each ciphertext fragment to its file
position and key, so a fragment cannot be relocated within the file (not merely reordered).

| # | Field | Type (nullable) | Source (component; authority) |
|--:|---|---|---|
| 62 | `files[].trackId` | enum `VIDEO-01`\|`VIDEO-02`, not null | Core seal; S1 §3.1 |
| 63 | `files[].fragments[].seq` | n, not null (>= 1) | writer (`mfhd.sequence_number`); `recording_fragments.seq`; S1 §3.1; coll3 F-60 |
| 64 | `files[].fragments[].byteOffset` | bigint, not null (>= 0) | writer; `recording_fragments.byte_offset`; S1 §3.1 |
| 65 | `files[].fragments[].byteLength` | bigint, not null (>= 1) | writer; `recording_fragments.byte_length`; S1 §3.1 |
| 66 | `files[].fragments[].mediaStartMs` | bigint, not null (>= 0) | writer; `recording_fragments.media_start_ms`; S1 §3.1 |
| 67 | `files[].fragments[].mediaDurationMs` | bigint, not null (>= 1) | writer; `recording_fragments.media_duration_ms`; S1 §3.1 |
| 68 | `files[].fragments[].sha256` | hex64, not null | writer over **stored bytes**; `recording_fragments.sha256`; S1 §3.1; RF-6 |
| 69 | `files[].fragments[].sha256Plain` | hex64, **nullable** | writer over plaintext (present only when the plaintext chain ran); OD-03; RF-6 |
| 70 | `files[].fragments[].chainHash` | hex64, not null | writer; `recording_fragments.chain_hash`; S1 §3.1 |
| 71 | `files[].fragments[].prefixSha256` | hex64, nullable | writer (running prefix); S1 §3.1/SP-3 |
| 72 | `files[].fragments[].keyframe` | boolean, not null | writer (SP-4 keyframe-aligned cut); S1 §6.5; `cap §C.1` |
| 73 | `files[].fragments[].interrupted` | boolean, not null | Core seal (durable-prefix drop rule); OD-08; S1 §5.5 |
| 74 | `files[].fragments[].truncated` | boolean, not null | Core seal (corrupt tail dropped); S1 §5.4/§5.5 |
| 75 | `files[].fragments[].gcmIv` | hex (12 B), not null | writer; `cap §D.1`; OD-03 |
| 76 | `files[].fragments[].gcmTag` | hex (16 B), not null | writer; `cap §D.1`; OD-03 |
| 77 | `files[].fragments[].keyId` | string (`KID-<sessionId>`), not null | Core key manager; `cap §D.2`; OD-03 |
| 78 | `files[].fragments[].durableAt` | bigint epoch-ms, not null | writer at fsync; `recording_fragments.durable_at`; `cap §C.2` |

### B.7 Transcript record (16 fields)

Machine transcript revision 0 is byte-unchanged forever (OD-15). The document format is
`dems.transcript/1` (`tx §A.5`). The DB carries the per-format hashes in `transcripts` and a summary
`transcript_sha256` on `evidence_items` (`dbc-3 §B.8/§B.11`).

| # | Field | Type (nullable) | Source (component; authority) |
|--:|---|---|---|
| 79 | `transcript.file` | string (`transcript/transcript.json`), not null | Core seal; `tx §A.5` |
| 80 | `transcript.docVersion` | string const `dems.transcript/1`, not null | transcriber assembly; `tx §A.5` |
| 81 | `transcript.sha256` | hex64, not null | transcriber assembly; `transcripts.json_sha256`; `evidence_items.transcript_sha256`; OD-15 |
| 82 | `transcript.srtSha256` | hex64, not null | transcriber rendering; `transcripts.srt_sha256`; `dbc-3 §B.8` |
| 83 | `transcript.vttSha256` | hex64, not null | transcriber rendering; `transcripts.vtt_sha256`; `dbc-3 §B.8` |
| 84 | `transcript.model.name` | string, not null | transcriber adapter; `transcripts.model`; D7/OD-24 |
| 85 | `transcript.model.version` | string, not null | transcriber adapter; `transcripts.model`; D7 |
| 86 | `transcript.model.quantisation` | string, not null | transcriber adapter; `transcripts.model`; `tx §B.3` |
| 87 | `transcript.model.modelSha256` | hex64, not null | transcriber adapter; `transcripts.model`; `tx §F` (DOC-05) |
| 88 | `transcript.diarization.numSpeakers` | n, not null | diarizer; `transcripts.diarization`; `tx §A.4` |
| 89 | `transcript.diarization.status` | string enum `LABELLED`\|`UNAVAILABLE`, not null | diarizer; `transcripts.diarization`; OD-20 |
| 90 | `transcript.diarization.confidence` | number, nullable | diarizer; `transcripts.diarization`; `tx §A.4` |
| 91 | `transcript.speakerState` | enum `LABELLED`\|`UNAVAILABLE`, not null | diarizer; `transcripts.labels_status`; OD-15/OD-20 |
| 92 | `transcript.state` | enum `ASSEMBLED`\|`PARTIAL`, not null | Core seal `FINALIZE_TRANSCRIPT`; **resolves row-33 open point 2** (§E.5) |
| 93 | `transcript.failedChunks` | n, not null (>= 0) | Core seal from `transcript_chunks.status='FAILED'`; `dbc-3 §B.7`; §E.5 |
| 94 | `transcript.revisionHead` | n, not null (>= 0; 0 = no revision) | revisions store; `transcript_revisions.revision_no` max; OD-15 |

**Erratum PE-D9-01 (D160; D-D8-1; integration pass D9) — model provenance is recorded as far as the
Core can know it, and the backend says which kind it is.** Fields 84-87 are not "not null" without
condition. Beside a sealed transcript document:

| Backend in field 123 (`configSnapshot.backend`) | 84 `name` | 85 `version` | 86 `quantisation` | 87 `modelSha256` |
|---|---|---|---|---|
| a **server** (`omlx-server`): a program the Core does not start and whose model files it never reads | required: the model identifier the session's snapshot names / the server reported | **null** | **null** | **null** |
| any other (`cpu-local`): the Core reads the model file | required: the adapter's model identifier | required: **declared by the installation** (`cpuLocal.modelVersions[<model id>]` of the host file) | required: the model file's own header | required: SHA-256 of the model file, hashed by the Core |

A null in 85-87 is permitted **only** for a server backend, and a value there is refused for one
(nobody verified it); nothing is loosened for `cpu-local`. No field is added (128 definitions, 119
sealed). The version of a `cpu-local` model is a **declared value**: no member of the model file
and no output of the engine states it; name + SHA-256 identify the file. The source column of rows
84-87 reads "adapter identifier / host file / model file header / Core hash of the model file".
The same rule holds in the transcript document (`header.backend` against `header.model`) and in
`transcripts.model`. Verify prints which kind it is (request to pass D10): for a server backend
"Transcript model: <name> (reported by the STT server; version, quantisation and file hash are not
available to the Core and were not verified)".

### B.7a Transcript configuration state (CONFIRMED — D24, Q-STT-CFG answer (a); R-8, D20) **Erratum PE-R8-07 (D24)**

> **Status: confirmed (D24, 2026-10-08: Q-STT-CFG answered (a), all 13 defaults).** These fields implement
> R-8 (`01_specs.md` R-8; D20). With them the manifest has **123** fields and field 92's enum gains
> `DISABLED`. The 120-field figures elsewhere in this file were not restated by the status sweep
> (**Erratum PE-R8-07 (D24)**, status wording only). **Erratum PE-124-05:** they are restated now —
> 123 was the count before row 124; with §B.12 the manifest has **128** fields (arithmetic below §B.12).

| # | Field | Type (nullable) | Source (component; authority) |
|--:|---|---|---|
| 92 (amended) | `transcript.state` | enum `ASSEMBLED`\|`PARTIAL`\|**`DISABLED`**, not null | Core seal `FINALIZE_TRANSCRIPT`; `DISABLED` when the session's STT snapshot had `enabled = false` (D20) |
| 121 | `transcript.disabledReason` | string const `DISABLED_BY_CONFIGURATION`, nullable (set only when `state = 'DISABLED'`) | Core seal from the session's `stt_config` snapshot (`dbc-3 §B.13`); human-readable label "transcript disabled by configuration" |
| 122 | `transcript.backendUnreachable` | boolean, not null | Core seal; `true` when STT was enabled but the configured backend could not be reached for one or more chunks (then `state = 'PARTIAL'` per D-EV-1) |
| 123 | `transcript.configSnapshot` | object `{ enabled, backend, model, diarization, revision }`, not null | the `stt_config` snapshot taken at session start; **never** the endpoint credential or reference (E-31) |

**Erratum PE-D9-02 — limit D-71c-2 (D157, D160; integration passes D8, D9).** A session that was
started before the STT snapshot was written inside the unit of the start has no `stt_config`
snapshot. It is sealed `PARTIAL` without a transcript document
(`disabledReason: TRANSCRIPT_UNAVAILABLE_AT_SEAL`) and field 123 holds the fixed stand-in
`{ enabled: true, backend, model: 'not-recorded', diarization, revision }`, whose members other
than `model` describe nothing. No session started by a Core from pass D9 on can reach this state:
**every real-mode start writes its snapshot or is refused** (`503 NOT_READY`,
`details.reason: STT_SNAPSHOT_NOT_STORED`; nothing committed, no worker started) — also when the
stored configuration cannot be read at that instant, when its row is not there, and when the
transcription composition is absent. A readable configuration with STT disabled writes a snapshot
that says disabled, and the session starts.

**Disabled package shape.** When `transcript.state = 'DISABLED'`: no `transcript/` folder is written;
fields 79-91 and 93-94 are `null` (the not-null rules of B.7 apply only to `ASSEMBLED`/`PARTIAL`);
`transcript.sha256` is absent from the signed digest input; verify v2 treats a disabled transcript as
**a declared absence, not a failure**, and reports "transcript disabled by configuration". R-5's
"transcript inside the sealed package" applies only when STT is enabled (D20).

### B.8 Sealing state machine steps (7 fields)

One `sealing.steps[]` entry per step of §E; mirrors `sealing_jobs` (`dbc-3 §B.4`).

| # | Field | Type (nullable) | Source (component; authority) |
|--:|---|---|---|
| 95 | `sealing.steps[].step` | string enum (§E step ids), not null | Core sealing pipeline; `sealing_jobs.step`; SH-01; `specs §E.4` |
| 96 | `sealing.steps[].status` | enum `RUNNING`\|`DONE`\|`FAILED`, not null | Core pipeline; `sealing_jobs.status`; `dbc-3 §B.4` |
| 97 | `sealing.steps[].progress` | n, not null, 0..100 | Core pipeline; `sealing_jobs.progress`; R-6 |
| 98 | `sealing.steps[].etaMs` | bigint, nullable (>= 0) | Core pipeline; `sealing_jobs.eta_ms`; R-6 |
| 99 | `sealing.steps[].attempt` | n, not null (>= 1) | RECOVERY resume; `sealing_jobs.attempt`; OD-08 |
| 100 | `sealing.steps[].checkpoint` | object, nullable | Core pipeline; `sealing_jobs.checkpoint`; §E resume rule |
| 101 | `sealing.steps[].completedAt` | bigint epoch-ms, nullable | Core pipeline; `sealing_jobs.updated_at`; R-6 |

### B.9 Signatures and the manifest's own hash (10 fields)

| # | Field | Type (nullable) | Source (component; authority) |
|--:|---|---|---|
| 102 | `signature.algorithm` | enum `Ed25519`\|`ECDSA-P256-SHA256`, not null | `Signer`; `evidence_items.signature_algorithm`; `dbc-3 §C.4`; OD-04 |
| 103 | `signature.keyId` | string, not null | `Signer`; `evidence_items.signature_key_id`; OD-04 |
| 104 | `signature.value` | hex (Ed25519 = 128 lowercase hex = 64 B), not null | `Signer`; `evidence_items.signature_value`; `D-DB-03`; `dbc-3 §C.5` |
| 105 | `signature.simulated` | boolean, not null | `Signer`; `evidence_items.signature_simulated`; `dbc-3 §C.4` |
| 106 | `signature.file` | string (`signature.sig`), not null | Core seal; v1 `manifest.json:136` |
| 107 | `signature.covers` | string (the signed-bytes description, §C.1), not null | `Signer`; v1 `manifest.json:137` |
| 108 | `signature.certificate.file` | string (`device-certificate.pem`), not null | signer store; v1 `manifest.json:139` |
| 109 | `signature.certificate.sha256` | hex64, not null | signer store; v1 `manifest.json:140` |
| 110 | `signature.signedAt` | bigint epoch-ms, not null | `Signer`; v1 `signature.sig` `signedAt` |
| 111 | `manifestSha256` | hex64, not null | Core seal (`BUILD_MANIFEST`); **the manifest's own hash**; §B.10; v1 `signature.sig` `signedDigest` |

### B.10 Manifest self-hash rule and example shape

`manifestSha256` is `SHA-256(canonical manifest body)` where the canonical body is the manifest JSON
with `manifestSha256` set to `null` (self-reference excluded) and `signature.value` excluded; keys are
sorted and the encoding is UTF-8. It is written both into the manifest and into `signature.sig` as
`signedDigest`, and the signature covers it (v1 precedent: the digest lives in `signature.sig`,
`demo-evidence/README.md:17`). The exclusion-of-length/self fields pattern is citable from C2PA
(`coll3 F-58`: exclusion ranges never overlap headers/length fields).

**What the canonical body contains (Erratum PE-124-04; D73, D78 (2)).** The two exclusions above are
the **only** ones. Fields 124-128 of §B.12 — the source class of every camera file and of every audio
interval, the package flag `developmentSources`, and the first video sample — are ordinary members of
the canonical body. They are therefore inside `manifestSha256` and under the signature: changing,
adding or removing any of them changes the digest (§C.1; verify V-03 and V-09).

Example (fields elided with `…`; a demo item; the three `sourceClass` values, `developmentSources` and
the two first-video-sample members were added by **Erratum PE-124-04**):

```json
{
  "schema": "dems.evidence-manifest/2",
  "evidenceId": "EV-20261007-0005",
  "sessionId": "SES-20261007-0015",
  "manifestVersion": 2,
  "integrity": "DEMO_PACKAGE",
  "developmentSources": true,
  "tracks": [{ "trackId": "VIDEO-01", "sha256": "…stored…", "sha256Plain": "…plain…",
               "fragmentChainHead": "…", "fragmentCount": 8, "keyframeAligned": true,
               "sourceClass": "FAKE", "firstVideoSamplePts": null, "firstVideoSampleTimescale": null },
             { "trackId": "VIDEO-02", "sha256": "…", "sha256Plain": "…",
               "fragmentChainHead": "…", "fragmentCount": 8, "keyframeAligned": true,
               "sourceClass": "FAKE", "firstVideoSamplePts": null, "firstVideoSampleTimescale": null }],
  "audio": { "trackId": "AUDIO-01", "containsIn": ["VIDEO-01", "VIDEO-02"],
             "sourceIntervals": [{ "seq": 1, "micDeviceId": "MIC-01", "role": "PRIMARY",
                                   "fromMs": 0, "toMs": 4202, "reason": "START", "switchedBy": null,
                                   "sourceClass": "FAKE" }] },
  "files": [{ "trackId": "VIDEO-01", "fragments": [{ "seq": 1, "byteOffset": 1259,
             "byteLength": 41482, "sha256": "…", "chainHash": "…", "keyframe": true,
             "interrupted": false, "truncated": false, "gcmIv": "…", "gcmTag": "…",
             "keyId": "KID-SES-20261007-0015" }] }],
  "transcript": { "state": "ASSEMBLED", "speakerState": "LABELLED", "failedChunks": 0,
                  "sha256": "…", "revisionHead": 0 },
  "signature": { "algorithm": "Ed25519", "keyId": "CORE-KEY-EVSIGN-01", "simulated": false,
                 "value": "…128hex…" },
  "manifestSha256": "…"
}
```

### B.11 Export block (derived; 9 fields — present only in an export, §G)

| # | Field | Type (nullable) | Source (component; authority) |
|--:|---|---|---|
| 112 | `export.exportId` | string (`EXP-…`), not null | export module; export counter; v1 `demo-alignment.ts:44` |
| 113 | `export.exportedAt` | bigint epoch-ms, not null | export module; v1 `metadata.json` export |
| 114 | `export.exportedBy` | string operator id, not null | export module; OD-16 audit |
| 115 | `export.authorizationRef` | string, not null | export module; v1 `demo-data/types.ts:192` |
| 116 | `export.derived` | boolean, not null | export module; OD-16 |
| 117 | `export.composite.included` | boolean, not null | composite job; OD-16; register NM-12 |
| 118 | `export.composite.encoder` | string, nullable | composite job (after M8 licence check); OD-16; DOC-05 |
| 119 | `export.composite.sha256` | hex64, nullable | composite job (hashed into the export manifest); OD-16 |
| 120 | `export.manifestSha256` | hex64, not null | export module (SHA-256 of `export-manifest.json`); v1 `demo-data/types.ts:196-197` |

### B.12 Source class of every recorded source, and the first video sample (rev 2.3; fields 124-128) **Erratum PE-124-02 (D73, D78, D80 (9))**

> **Status: specified by blueprint row 124 (rev 2.3, approved by D78).** Checked at the spec gate
> (row 128). Row 83 builds fields 124-128 from its first build (D81); row 141 adds the exhaustive kind -> class mapping check, V-15, the report lines, the `sources` block of operation 41 and the `developmentSources` member of operations 39 / 40. **Erratum PE-128-71 (D81; D83 D-DB-14).** It
> answers `specs` R-11 AC-7, open point 7 of `specs` §B.2.6 and ambiguity 9 of `specs` §B.2.7.

| Frame | Content |
|---|---|
| Subject | How a sealed package says that its pictures or sound did not come from production devices, and what verify does with that statement |
| Stakeholders | Whoever reads a verify report or opens an export (investigator, supervisor, a receiver outside the Core); the builders (rows 83, 85, 141); the specs that must agree with this one (rows 121, 122, 125, 127) |
| Timeline | Specified now (rev 2.3 spec delta); built at M7 by row 141, after rows 83, 85 and 136 |
| Scope in | Three manifest fields for the source class; the signing statement; one verify check; the limitation; two fields and one statement already decided for the first video sample (D66, D72) |
| Scope out | The adapter-kind names and device shapes (row 121); where the adapter kind is stored (row 122); the helpers and the boot fence (rows 123, 136); the label on the clients (row 125) |
| Rationale | D73 asked for a development fallback with a manifest mark; D78 (2) allowed such a package to be sealed and to verify PASS with the mark reported; D80 (9) ruled that the mark is a per-source class and covers every package whose sources are not production devices |
| Method | Read this file whole, `specs` §B.2, `decisions` D66, D72-D80, `cap §C.4` and `§F`, `packages/capture-protocol/src/index.ts:148-163,427-438`, `packages/shared/src/api/capture.ts:61-82`; searched the code for an existing v2 manifest (none, see "Compatibility") |

**Fields.**

| # | Field | Type (nullable) | Source (component; authority) |
|--:|---|---|---|
| 124 | `tracks[].sourceClass` | enum `PRODUCTION`\|`LOCAL_DEVICE`\|`FAKE`, not null | Core seal (`BUILD_MANIFEST`), from the adapter kind of that camera slot as recorded for the session at its start (plan builder row 66; kind registry row 136); **never from a request body**; D73, D80 (9); R-11 AC-7 |
| 125 | `audio.sourceIntervals[].sourceClass` | enum `PRODUCTION`\|`LOCAL_DEVICE`\|`FAKE`, not null | Core seal (`BUILD_MANIFEST`), from the adapter kind of the interval's `micDeviceId` (field 56) in the same session-start record; never from a request body; D73, D80 (9) |
| 126 | `developmentSources` | boolean, not null | Core seal (`BUILD_MANIFEST`); **derived**: `true` when at least one value of field 124 or field 125 in this manifest is not `PRODUCTION`, otherwise `false`; D80 (9) |
| 127 | `tracks[].firstVideoSamplePts` | n (whole number, >= 0), **nullable** | capture worker, the `pts` of the `FIRST_VIDEO_SAMPLE` record for that camera (`packages/capture-protocol/src/index.ts:427-438`), joined on `tracks[].deviceId` (field 35; D72 (g)); `null` when no such record exists for the file; **Erratum PE-124-12 (D66 (4b), D72 (e))** |
| 128 | `tracks[].firstVideoSampleTimescale` | n (>= 1), **nullable** (`null` exactly when field 127 is `null`) | capture worker, the `timescale` of the same record (ticks per second of the video track); **Erratum PE-124-12 (D66 (4b), D72 (e))** |

**Values of the source class.**

| Value | Meaning | Where it occurs |
|---|---|---|
| `PRODUCTION` | A network camera or a product microphone reached through a production adapter | A real device adopted through the R-9 connect flow; the product adapters themselves are class C (`cap §A.1` "Real adapters are class C") |
| `LOCAL_DEVICE` | This computer's own camera or microphone behind the R-11 helper (adapter kind `LOCAL_DEVICE`, row 136) | Development mode, camera 1 and microphone 1 (D74 (2)) |
| `FAKE` | Any synthetic source: a fake adapter or fixture stream (register NM-14), and the generated media of a demo package (SH-24 generators) | Development mode, camera 2 and microphone 2 (D74 (2)); every test session on fixtures; every regenerated demo package (§F.4) |

**Rules.**

| # | Rule | Authority |
|--:|---|---|
| 1 | **The Core writes the class; nobody else can.** It is computed from the adapter kind by one closed mapping in the Core. No operation accepts a source class, and no client value reaches fields 124-126 | D73 (boot fence and manifest mark as one design constraint); R-11 AC-1, AC-2 |
| 2 | **The mapping is exhaustive and fails closed.** Every adapter kind has exactly one class, checked at compile time. A kind without a class is never written as `PRODUCTION`: `BUILD_MANIFEST` fails and nothing is signed (§E.1 failure path "unserialisable field") | this row (design); gate row 128 |
| 3 | **The class is the one of the session's start.** It is read from what was recorded for the session when it started, not from the device registry or the development flag at sealing time: a seal resumed by RECOVERY after a restart writes the same bytes (§E.1 `BUILD_MANIFEST` "the hash is deterministic") | §E.1; OD-08; OD-10 (configuration locked while a session is open) |
| 4 | **Audio: per interval, following `session_audio_intervals`.** Each `audio.sourceIntervals[]` record mirrors one `session_audio_intervals` row (§B.5); field 125 is the class of that row's microphone. When the operator switches from a local microphone to a fake one, the intervals before and after the switch carry different classes. Within one manifest the same `micDeviceId` always has the same class. A standby microphone that was never selected has no interval, contributed no sample and therefore has no mark | D80 (9) "per-source class"; `dbc-3 §B.5`; OD-09 |
| 5 | **The package flag is a summary, not a second source of truth.** Field 126 is recomputed by verify from fields 124 and 125 (V-15) | this row (design) |
| 6 | **Demo packages carry the mark.** A generated demo package has `FAKE` on every source and `developmentSources = true`, in addition to `demo = true` and `integrity = 'DEMO_PACKAGE'` | D80 (9) "covers every package whose sources are not production devices" |
| 7 | **Interrupted and fallback seals carry it unchanged.** The OD-08 interrupted seal (§E.4) and the OD-21 fallback path (§E.3) write fields 124-126 by the same rules | OD-08; OD-21 |

**Dependency on row 121 (stated so that row 128 can reconcile).** `03_api_contract.md` had no
adapter-kind vocabulary when this was written (`grep -n -i "LOCAL_DEVICE\|adapterKind"
masterplan/03_api_contract.md` returned 0 lines on 2026-10-09; row 121 is writing it). This spec
assumes exactly this: (a) every capture device has one adapter kind; (b) one kind is named
`LOCAL_DEVICE` (the name used by blueprint rows 124, 136 and 141); (c) fake sources have a kind of
their own, assumed to be named `FAKE`; (d) every other kind is a production adapter. The three
**manifest** values `PRODUCTION` / `LOCAL_DEVICE` / `FAKE` are fixed by this spec and do not change if
row 121 names its kinds differently or has several production or several fake kinds — only the
mapping of rule 2 changes. **Reconciled at row 128 (D81; D83 D-DB-11; erratum PE-128-67):** the API device shapes carry a two-valued class `PRODUCTION` | `DEVELOPMENT` (C3 §2.6) and the manifest keeps its three values; both derive from `capture_devices.adapter_kind` by the mapping of `dbc-4` §N.2 (`ONVIF_RTSP`, `USB_AUDIO`, `SNMP_POE` -> `PRODUCTION`; `FAKE` -> `FAKE`; `LOCAL_DEVICE` -> `LOCAL_DEVICE`). The `sources` block of operation 41 uses the manifest values.

**Alternatives considered.**

| Alternative | Why not |
|---|---|
| A package flag only | Row 124 asks for a mark on every track; with the microphone changing during a session a flag cannot say which part came from which source |
| A boolean per source | D80 (9) calls it a class; a reader has a real interest in telling the developer's own face and voice (`LOCAL_DEVICE`, R-11 AC-8) from synthetic media (`FAKE`) |
| Writing the adapter kind itself into the manifest | It would tie the signed format to an enum that row 121 owns and that will grow with every new adapter; the class has three stable values |
| Reusing `integrity` or `demo` | They answer other questions (how hashes and signature were made; demo dataset membership). A development package has real hashes and a real signature |
| Marking the configured microphones instead of the intervals | A configured but never selected microphone is in no recorded sample; row 124 says "every track recorded from" |
| Extending V-01 and V-02 instead of a new check | Row 85 builds "14 checks V-01..V-14" and row 141 builds the mark; one new check keeps the two rows apart |

**Compatibility (Erratum PE-124-14).**

| Package | Treatment | Evidence |
|---|---|---|
| v2 (`dems.evidence-manifest/2`) | Fields 124-126 are **required** in every v2 manifest; fields 127-128 are required as keys and may be `null`. A v2 manifest without field 124, 125 or 126 fails V-15 as MISSING. Absence is **never** read as `PRODUCTION` | No v2 manifest exists yet: `grep -rl "dems.evidence-manifest/2" packages apps` returned 0 files on 2026-10-09, and row 83, which builds the manifest, has not started |
| Schema or version step | **None needed.** The schema id stays `dems.evidence-manifest/2`, `manifestVersion` stays `2`, `evidence_items.manifest_version` is untouched. Condition: no v2 package is kept that was sealed without the fields — see the hand-over to rows 83 and 141 in `delegation_progress/data_analyst_row124.md` | same |
| v1 (`dems.evidence-manifest/1`) | Unchanged. The 14 frozen demo packages have no such field and are not rewritten; the v1 verifier is not touched; verify v2 does not apply to them (V-01 requires the v2 schema id). Where a client shows a v1 item, the source class reads "not recorded (v1 package)", never "production". When the demo evidence is regenerated as v2 (OD-02, §F.4) the new packages follow rule 6 | 14 packages under `packages/shared/assets/demo-evidence/`; §F.4 "v1 items remain readable but unreachable" |

**First video sample (Erratum PE-124-12; D66 (4b), D72 (d), D72 (e)).** With the pinned mux flags the
first video frame of a camera file is placed at file time 0 and held until the first keyframe after
T0, up to one GOP (`cap §C.4`). D66 (4b) ruled that in this case "the true first video pts" is
recorded in the manifest; D72 (d) made it the case (`delay_moov` rejected); D72 (e) accepted the
worker's `FIRST_VIDEO_SAMPLE` record that delivers it. Nothing in §B.4 or §B.6 carried it:
`files[].fragments[].mediaStartMs` (field 66) is the fragment's start in the file, where the held
frame begins at 0. Fields 127 and 128 keep the record's two numbers exactly as delivered, so no
rounding to milliseconds enters the signed manifest. `pts` counts from T0; the time of that sample in
the file is `pts / timescale + 1024 / 48000` s. A file whose first fragment was cut before any video
sample arrived, and a generated demo package, have `null` in both.

**Media-time origin (Erratum PE-124-13; D72 (d)).** Under the pinned mux flags
(`+frag_keyframe+empty_moov+default_base_moof+skip_trailer`) **file time 0 = T0 − 1024/48000 s**
(21.333 ms), where T0 is the host instant of audio sample 0: the 1,024 AAC priming samples are
presented because no edit list is written, and both tracks of both files sit that much later
(`cap §F` "File time 0"; the one constant `CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES = 1024`,
`packages/shared/src/api/capture.ts:82`). A reader that maps a media time of this manifest to the
host clock or to a sample index of the PCM tap uses that constant and no other. **Decided (D81; erratum PE-128-68):** `audio.sourceIntervals[].fromMs` / `toMs` (fields 58-59; `session_audio_intervals.from_media_ms` / `to_media_ms`) count in FILE (media) time of the sealed file — the origin of fields 66-67 and of row 77's chunk offsets. A value measured from T0 is converted by adding 1024/48000 s.

**Field count: 128 field definitions (Erratum PE-124-05).** Arithmetic from the row-32 figure:
**120** (row 32: B.1 8 + B.2 11 + B.3 14 + B.4 18 + B.5 10 + B.6 17 + B.7 16 + B.8 7 + B.9 10 +
B.11 9) **+ 3** (B.7a fields 121-123; D24) **= 123** before row 124; **+ 3** (fields 124-126, the
source class; D73, D80 (9)) **= 126**; **+ 2** (fields 127-128, the first video sample; D66, D72 (e))
**= 128**. By where the fields live: top level and identity 8 + 1 = 9; timeline 11; device, operator,
subject 14; `tracks[]` 18 + 3 = 21; audio 10 + 1 = 11; fragments 17; transcript 16 + 3 = 19; sealing
steps 7; signatures 10; export 9; 9 + 11 + 14 + 21 + 11 + 17 + 19 + 7 + 10 + 9 = **128**. B.10 adds no
field (it defines the self-hash rule for field 111). Every one of the 128 has a type and a source.
Blueprint row 83 still says "120-field manifest": that text predates D24 and this row.

---

## C. Signer interface (OD-04)

### C.1 What is signed, with which key, what is returned

```ts
interface Signer {
  readonly algorithm: 'Ed25519' | 'ECDSA-P256-SHA256';
  readonly keyId: string;
  /** Signs the message and returns the raw signature bytes. */
  sign(message: Uint8Array): Promise<Uint8Array> | Uint8Array;
  /** The public key for the certificate and verification. */
  publicKey(): Uint8Array;
}
```

| Aspect | Contract | Source |
|---|---|---|
| Signed message (seal) | the **32-byte digest** `manifestSha256` (SHA-256 of the canonical manifest body, §B.10) — byte-identical to the v1 rule ("the SHA-256 digest (32 raw bytes) of this manifest.json file") | v1 `manifest.json:137`; `demo-data/verify.ts:13` |
| Signed message (revision) | the 32-byte digest of the canonical revision body (OD-15) | OD-15 (D4); `tx §A.6` |
| Covered by the seal signature: the development-source mark (**Erratum PE-124-06**) | fields 124-126 (and 127-128) are inside the canonical manifest body (§B.10), so inside `manifestSha256` and under the signature. Changing a `sourceClass`, changing `developmentSources` or removing any of them after sealing makes V-03 fail (manifest hash) — the report says TAMPERED, manifest altered. Recomputing `manifestSha256` to hide the change makes V-09 fail, because the signature was made over the old digest. Forging both needs the Core signing key (threat model, §C.3 SEC35-06). There is no separate signature for the mark | D73; D78 (2); R-11 AC-7; §B.10; §D V-03, V-09 |
| Key (this Mac) | one Core Ed25519 key, key id `CORE-KEY-EVSIGN-01` (the v1 demo key is `DEMO-KEY-EVSIGN-01`, `demo-alignment.ts:34`) | OD-04 (D4) |
| Returned | 64 raw signature bytes; stored as 128 lowercase hex (`D-DB-03`; `dbc-3 §C.5`) | OD-04; `D-DB-03` |
| Manifest fields produced | `signature.{algorithm,keyId,value,simulated,signedAt,covers}` (§B.9) | `dbc-3 §C.4/§C.5` |
| DB columns bound | `evidence_items.signature_algorithm`, `signature_key_id`, `signature_value`, `signature_simulated` (`0001_tables.sql:314-318`) | `dbc-3 §C.4` |

### C.2 Software Ed25519 implementation on this Mac

| Aspect | Contract | Source |
|---|---|---|
| Algorithm | Ed25519, pure software; no hardware key on this Mac | OD-04 (D4) |
| Hash primitive | `@noble/hashes` SHA-256 (already used by the v1 verifier, `demo-data/verify.ts:23`) | v1 `demo-data/verify.ts:23` |
| Signature primitive | Node `crypto.sign(null, digest, privateKey)` with an Ed25519 `KeyObject`, or `@noble/curves` Ed25519 when the runtime lacks the KeyObject path; the generator's own Node-crypto verification is the v1 precedent | `demo-data/verify.ts:11-15,241-258` |
| Verification (no Core key) | the receiver verifies the 64-byte signature over `manifestSha256` with the **certificate's public key**; WebCrypto/`verifyEd25519` is the v1 path | `demo-data/verify.ts:241-258`; OD-16 |
| `simulated` flag | `false` for a real Ed25519 signature; the DB CHECK accepts only `SIMULATED-SHA256 ⇒ simulated=true` and `Ed25519/ECDSA-P256-SHA256 ⇒ simulated=false` | `dbc-3 §C.4`; `0001_tables.sql:336` |

### C.3 TPM/PKCS#11 adapter (class C, C-8) and key storage

| Aspect | Contract | Source |
|---|---|---|
| Adapter | a second `Signer` implementation with `algorithm='ECDSA-P256-SHA256'`; selected by config; pre-declared in the DB CHECK so no migration is needed | `dbc-3 §C.4`; OD-04; `structured §9 C-8` |
| Entry criteria (C-8) | OD-04 hardware option chosen; a device with a TPM is present; the signature must verify with the device certificate chain | `structured §9 C-8`; `specs §G.2` |
| Key storage (both) | private key in the Core signer store, **never beside the media volume, never in audit/log** (secret-key rule E-31/CS-14) | `cap §D.2`; register CS-14; RK-12 |
| Key storage hardening (SEC35-07) | the signer private key is held **encrypted at rest** (OS keychain or an encrypted file) with restrictive mode (0600), separate from the DB and the media volume; the Core never logs or audits key material, and boot (CS-22) fails closed if the key is absent or unreadable | OD-04; SEC35-07; `cap §D.2`; CS-22 |
| Compromise / revocation runbook (SEC35-07) | normative runbook: (a) stop signing, (b) mark the key compromised in the signer store, (c) issue a new key id + certificate, (d) re-verify every package whose `signature.keyId` equals the compromised key against the retained certificate, (e) record the event (fact only). A compromised key never rewrites an existing manifest (OD-15) | OD-04; OD-15; SEC35-07 |
| Threat model (SEC35-06) | the signer defends **integrity, not confidentiality**: an adversary who can replace the Core key **and** certificate can forge a signature, so the trust anchor is out-of-band certificate distribution; at-rest package theft cannot forge a signature (only the live Core key can). Stated so verifiers do not over-trust `signature.ok` | OD-04; OD-16; SEC35-06 |
| Key id in manifest | `signature.keyId` (§B.9 field 103) | OD-04 |
| Rotation (design note) | rotation issues a **new key id** and a new certificate; sealed packages stay valid because each manifest records its own `keyId` + certificate sha256, the package **retains the certificate set** (every certificate whose key signed content in it), and the DB keeps `transcript_revisions.signature_certificate_sha256` (`dbc-3 §B.9`) so an old revision verifies after rotation; rotation never rewrites an existing manifest (the machine transcript and manifest are immutable, OD-15) | OD-04; OD-15; SEC35-20; `dbc-3 §B.9` |

---

## D. Verify-v2 checks

`verify` is operation 41 (`POST /api/v1/evidence/{id}/verify`, `modules/evidence/index.ts:8`). v1
recomputes track hashes, the manifest hash and the simulated signature (`evidence.ts:265-296`). v2 adds
the fragment chain and the transcript/revision checks. Each check reports `tracks`/`fragments`/
`transcript` sub-results; the top-level `ok` is the conjunction. Failure classes:
**TAMPERED** (a stored byte or signature differs from the sealed value), **CORRUPT** (structure
unreadable / a box or range malformed), **MISSING** (a declared file or field absent), **UNREADABLE**
(permission/IO/parse error).

| # | Check | Reads | Pass condition | Failure class(es) | Reported outcome |
|--:|---|---|---|---|---|
| V-01 | Manifest structure | manifest JSON | parses; `schema='dems.evidence-manifest/2'`; required fields present with a type | MISSING / UNREADABLE | `manifest.structure ok:false` + the missing field name |
| V-02 | Manifest internal consistency | manifest + fragments | `fragmentCount == fragments.length`; byte ranges gapless from file start; `fragmentChainHead == last chainHash`; `sum(bytes) == tracks[].bytes`; **`fragments.json` records are byte-identical to the manifest `files[].fragments[]` (SEC35-11)**; **the recomputed GCM AAD `(trackId, seq, byteOffset, keyId)` matches (SEC35-10, when the key is available)** | TAMPERED / CORRUPT | `manifest.consistency` + the inconsistent field |
| V-03 | Manifest hash | manifest bytes | `SHA-256(canonical body) == manifestSha256 == signature.sig.signedDigest` | TAMPERED | `manifest.ok:false` (manifest altered) |
| V-04 | Per-fragment stored-bytes hash | camera file bytes + manifest | for every fragment, `SHA-256(file[offset, offset+length)) == fragments[].sha256` (no key needed, OD-03) | TAMPERED / CORRUPT / MISSING | per-fragment `ok`; names `(trackId, seq)` |
| V-05 | Plaintext hash after decryption | decrypted file + manifest | `SHA-256(decrypted file) == tracks[].sha256Plain` (export path only) | TAMPERED / MISSING | `plaintext.ok` per file |
| V-06 | Chain-hash continuity (no gap) | fragment records | `chain_0 = SHA-256("")`; `chain_n = SHA-256(chain_{n-1}raw32 || frag_sha_n_raw32)`; every link equals the recorded `chainHash` | TAMPERED / CORRUPT | `chain.ok`; names the first broken `(trackId, seq)` |
| V-07 | Sequence contiguity | fragment records | `seq` is `1..N` contiguous per track with no duplicate; offsets strictly increase | CORRUPT / MISSING | `sequence.ok`; names the gap |
| V-08 | **One-fragment tamper expectation** | camera file bytes + manifest | **tampering exactly one fragment's stored bytes must fail exactly that fragment (V-04) and the chain from that fragment on (V-06), and must be classified TAMPERED, not generic CORRUPT; every other fragment and the manifest/signature still pass** | TAMPERED | `fragments: [{trackId, seq, ok:false, reason:'TAMPERED'}]`; `overall:'TAMPERED'` naming the fragment |
| V-09 | Signature verification over signed bytes | `manifestSha256` + `signature` + certificate | with the key: Ed25519/ECDSA verifies over `manifestSha256` with the certificate public key; **without the key**: stored-bytes integrity (V-04/V-06) is still checkable per OD-03 | TAMPERED / MISSING | `signature.ok`; `signature.simulated`; "integrity checked without key: yes" |
| V-10 | Transcript hash match | `transcript.json` + manifest + DB | `SHA-256(transcript.json) == transcript.sha256 == transcripts.json_sha256` (and `.srt`/`.vtt` hashes) | TAMPERED / MISSING | `transcript.ok` |
| V-11 | Revision signatures | `transcript-revisions.json` | every revision's signature verifies over its `sha256` **against the revision's retained `signature_certificate_sha256`** (SEC35-20), and `parent_sha256` links to the previous revision head / `transcripts.json_sha256` | TAMPERED / MISSING | `revisions.ok`; names the bad `revision_no` |
| V-12 | Interrupted-seal flag interpretation | manifest + camera file | if `timeline.interrupted`: the durable prefix verifies (V-04/V-06 pass for `seq 1..durableN`) and the flag is surfaced as a distinct state; an interrupted package is **still verifiable and clearly marked** (OD-08) | (informational) | `interrupted:true` alongside `ok:true`; UI label "interrupted" |
| V-13 | Certificate validity | `device-certificate.pem` | self-signature verifies; its sha256 matches the manifest; validity covers `signature.signedAt` | TAMPERED / MISSING / UNREADABLE | `certificate.ok` |
| V-14 | File completeness | package directory | every declared file exists and is readable (`VIDEO-0n.mp4`, manifest, signature, certificate, transcript) | MISSING / UNREADABLE | `files.ok`; names the absent file |
| V-15 | **Source class (development-source mark)** — **Erratum PE-124-07 (D78 (2), D80 (9))** | manifest fields 124-126 | (a) well-formed: every `tracks[]` record and every `audio.sourceIntervals[]` record has a `sourceClass` out of the three values, and `developmentSources` is a boolean; (b) consistent: `developmentSources` equals "some source is not `PRODUCTION`", and one `micDeviceId` has one class. **A class other than `PRODUCTION` is not a failure: the check passes and reports it** | (a) MISSING; (b) CORRUPT. The mark itself: none (informational) | `sources.ok`; `sources.development` (boolean); `sources.tracks[]` and `sources.audioIntervals[]` with the class of each; the report line below; top-level `ok` unchanged |

**Verify count: 15 checks** (14 from row 32, built by row 85; V-15 added by **Erratum PE-124-07**, built by row 141). V-08 is the one-fragment tamper expectation, quoted: *"tampering exactly
one fragment's stored bytes must fail exactly that fragment (V-04) and the chain from that fragment on
(V-06), and must be classified TAMPERED, not generic CORRUPT."* This is the M7 gate criterion
*"tampering one fragment fails exactly that fragment"* (`structured` §6 M7) and the row-32 gate phrase
*"the one-fragment tamper expectation"* (`structured row 32`).

**Key-availability split (OD-03).** V-04/V-06/V-07 (stored-bytes integrity) run without the session
key; V-05 (plaintext) and the decrypted export path require decryption first but still need no signing
key. V-09's with-key/without-key split is exactly OD-03's "integrity can be checked without the key"
and OD-16's "the receiver can verify the package without the Core's key".

### D.1 The development-source mark in verify (V-15) **Erratum PE-124-07 (D78 (2), D80 (9))**

| Aspect | Rule | Authority |
|---|---|---|
| Result | A package with one or more sources of class `LOCAL_DEVICE` or `FAKE` **verifies PASS** when every other check passes. The mark never turns a pass into a failure and never hides a failure: a tampered development package fails exactly as a production one does | D78 (2); R-11 AC-7 |
| Status | Top-level `ok` is the conjunction of the checks as before; V-15 contributes `false` only for a missing or inconsistent mark, never for its value. Operation 41 answers as for any verified package. A command-line wrapper of verify, if one is built, exits with the same status as for a package without the mark (0 on pass) | §D intro; D78 (2) |
| Machine-readable result | `sources: { ok: boolean, development: boolean, tracks: [{ trackId, deviceId, sourceClass }], audioIntervals: [{ seq, micDeviceId, sourceClass }] }`. `development` is recomputed by the verifier, not copied from field 126. **The response shape of operation 41 is owned by `03_api_contract.md` (row 121): carried in C3 §3.1 under these names (row 128)** | this row (design); row 128 reconciles |
| Report line, development package | Placed **first** in the report, before the per-check results, and never collapsed: **"DEVELOPMENT SOURCES — this package was not recorded from production devices."** followed by one entry per source, e.g. "VIDEO-01: CAM-01, this computer's camera (LOCAL_DEVICE). VIDEO-02: CAM-02, fake source (FAKE). AUDIO-01: interval 1 MIC-01, this computer's microphone (LOCAL_DEVICE); interval 2 MIC-02, fake source (FAKE)." The integrity result follows unchanged, e.g. "Integrity: PASS" | D78 (2) "with the development mark reported"; R-11 AC-7 |
| Report line, all `PRODUCTION` | "Sources: declared as production devices by the Core that sealed this package." The word **declared** is required: see §H.5 | §H.5 |
| Tampering with the mark | Editing a `sourceClass` or `developmentSources`, or deleting one, fails **V-03** (TAMPERED, manifest altered). If the editor also recomputes `manifestSha256` and the digest in `signature.sig`, **V-09** fails (TAMPERED). If the edit also leaves the mark malformed or inconsistent, V-15 fails as well. In each case the report must not print the edited class as fact: when V-03 or V-09 fails, the source line reads "Sources: not trustworthy — the manifest was altered" | R-11 AC-7 "a package whose mark was edited after signing fails verification"; §C.1 |
| Key availability | V-15 reads the manifest only: it runs without the session key and without the signing key, also on an export (§G.2) | OD-03; OD-16 |
| Display | Where the clients show the mark is owned by blueprint row 125 (`masterplan/08_client_ux_spec.md`; R-11 AC-6). This spec fixes only the data: a label on a **sealed** item is derived from the `sources` block of V-15 or from manifest fields 124-126, never from client-side state or from the current device list. The verify results of §F.3 (web `WB-04`, mobile `MB-07`, `MB-05`) are the existing places a verify report appears (**Erratum PE-124-11**) | row 125; R-11 AC-6; `specs` C-N14 |

---

## E. Sealing pipeline v2

Steps are the SH-01 v2 `FinalizationStep` set: `CLOSE_TRACKS`, `FINALIZE_HASHES`,
`FINALIZE_TRANSCRIPT`, `BUILD_MANIFEST`, `SIGN_MANIFEST`, `STORE_SEALED_PACKAGE`, plus
`CONCATENATE_SEGMENTS` and `ENCRYPT_PAYLOAD` **only on the OD-21 fallback path** (`SH-01`, map §3.1).
Each row gives **checkpoint** (what is written when), **resume rule** (what RECOVERY does if the
process dies), **progress source** (the client-visible value), and the failure path.

**Progress source (all steps).** Per-step `progress` (0..100) and `eta_ms` are written to
`sealing_jobs` with a Core-instant `updated_at` (`dbc-3 §B.4`); clients display them **forward-only**
from Core instants, never from the client wall clock — the mobile pattern `coreClockOf`
(`apps/mobile/src/runtime/core-clock.ts:82-106`) and the monotonic elapsed ticker
(`apps/mobile/src/runtime/recording-elapsed.ts:128-144`), the E-13 rule (MB-04 High). Estimated
completion uses `recording-elapsed.ts` (monotonic; R-6 AC-2, `specs §E.5`).

### E.1 Normal path — RECORDING -> RECOVERY-safe pipeline -> SEALED

| Step | Checkpoint (what is written when) | Resume rule (RECOVERY if the process dies here) | Progress source | Failure path |
|---|---|---|---|---|
| `CLOSE_TRACKS` | `evidence_tracks` rows created from the closed camera files; `sealing_jobs` row `RUNNING` at 0; the last open `session_audio_intervals` row closed (`to_media_ms`/`to_at`) | rows exist; re-run is idempotent (upsert by `(session_id, track_id)`) | `sealing_jobs.progress` step 0->100; forward-only | a file not closed -> stop, `CAPTURE_FAULT` surfaced (register NM-07) |
| `FINALIZE_HASHES` | per-track `sha256` (stored) and `sha256_plain`; `fragment_chain_head`; `fragment_count`; `recording_fragments` rows are already appended during RECORDING (`dbc-3 §B.6`, INSERT-only) | re-read the camera file and recompute; the running prefix (S1 §3.1) makes this deterministic; a truncated tail applies the drop-fragment rule (E.4) | `sealing_jobs.progress`; fragment count as detail | hash mismatch vs the live chain -> CORRUPT, step FAILED |
| `FINALIZE_TRANSCRIPT` | consume the assembled transcript + `transcripts` row; set `transcript.state`/`failedChunks`; the step completes only after all chunks are terminal (D223) | if the transcript is already committed, **do not re-run STT** (`tx §D.3`); if not, resume from the last committed chunk (`tx §D.2`) | `sealing_jobs.progress`; transcript chunk counters (SH-05) | STT hard-fails -> §E.5 (package still seals, `state='PARTIAL'`) |
| `BUILD_MANIFEST` | `session-manifest.json` written; `manifestSha256` computed (§B.10); `manifest_version`/`transcript_sha256`/`labels_status` set on `evidence_items` (`dbc-3 §B.11`) | rebuild the manifest from the committed rows; the hash is deterministic | `sealing_jobs.progress` | unserialisable field -> FAILED, no signature written (**Erratum PE-124-08**: also an adapter kind with no source class, §B.12 rule 2, §E.6) |
| `SIGN_MANIFEST` | `signature.sig` written; `evidence_items.signature_*` set | re-sign the **same** `manifestSha256` via the `Signer`; signature is idempotent for one key | `sealing_jobs.progress` | `Signer` error -> FAILED, DB stays unsigned, retry per attempt |
| `STORE_SEALED_PACKAGE` | the package directory made durable; `evidence_items.status='SEALED'`, `sealed_at`; `session_history` outcome `SEALED`; audit `EVIDENCE_SEALED` | finished -> session ends SEALED; if interrupted before the DB commit, re-commit (idempotent) | `sealing_jobs.progress` reaches 100; session state SEALED | disk error -> FAILED, resumable once storage returns |

Count: **6/6 normal steps** each with checkpoint + resume rule + progress source + failure path.

### E.2 Progress and forward-only

| Rule | Contract | Source |
|---|---|---|
| Per-step progress | `sealing_jobs` holds one row per `(session_id, step)`; `progress` 0..100; `eta_ms` nullable | `dbc-3 §B.4`; R-6 |
| Forward-only | a resumed attempt may legitimately rewrite progress (`attempt` increments); clients render the max seen, from Core instants, never the client clock | `dbc-3 §B.4` (E-13 is a code rule); `core-clock.ts:82-88`; `recording-elapsed.ts:75` |
| One session | a new session is blocked until the previous reaches SEALED | R-6; `session-machine.ts:108` |
| Audit/event | `applySealingProgress`/`completeSeal` are INTERNAL actions | `cap §B.1`; register SH-18 |

### E.3 OD-21 fallback path (kept designed, never the default)

| Step | Checkpoint | Resume rule | Progress source | Failure path |
|---|---|---|---|---|
| `CONCATENATE_SEGMENTS` | per-segment files concatenated losslessly into `VIDEO-0n.mp4`; segment index written | re-run from the last concatenated segment | `sealing_jobs.progress` | concat error -> FAILED (legal-triggered only) |
| `ENCRYPT_PAYLOAD` | the one-pass seal-level encryption of the concatenated file (if the fallback is used with at-rest encryption) | re-encrypt the concatenated file | `sealing_jobs.progress` | key error -> FAILED |

Count: **8/8 sealing steps** (6 normal + 2 fallback) each with checkpoint + resume rule + progress
source + failure path.

### E.4 OD-08 crash-during-RECORDING path

| Aspect | Contract | Source |
|---|---|---|
| Trigger | the worker/supervisor dies during RECORDING and cannot restart within the back-off budget **and at least one durable fragment exists** (`durable: true`). A session that ends `FAULTED` with nothing durable is a failed start: no seal runs and no evidence item exists (D84). **Erratum PE-128-70 (D84; D89(b))** | `cap §B.2` (CRASH); OD-08 (D4) |
| Drop-fragment rule | compare stored file length against the last declared fragment end; a shorter/partial tail is identified by the size-mismatch signature and the range `[tail_start, EOF)` is dropped; re-hash the durable prefix `[0, tail_start)` | S1 §5.2/§5.4/§5.5 (`size_mismatch_declared_gt_present`, corrupt seq 7 @ 251,168; prefix re-hash equality) |
| Seal | run `CLOSE_TRACKS`..`STORE_SEALED_PACKAGE` on the **durable prefix**, set `timeline.interrupted=true`, `timeline.durableEndMs`, `tracks[].sha256` = durable-prefix hash, `files[].fragments[].interrupted=true` on the durable set | OD-08 (D4); S1 §5.4; `cap §C.5` |
| Transcript | the transcript covers the durable timeline; if the interval map is truncated, record `intervals_incomplete` (state `PARTIAL`) | `tx §D.2`; OD-08 |
| Verify | an interrupted package is **still verifiable** (V-04/V-06 pass on the durable set) and clearly marked (V-12) | OD-08; blue-print M7 |
| Development-source mark (**Erratum PE-124-08**) | an interrupted seal writes fields 124-126 by the same rules as a normal seal (§B.12 rule 7); the two marks are independent — a package can be both interrupted (V-12) and from development sources (V-15) | OD-08; D78 (2) |

### E.5 Transcript-wait interaction (D223) and the row-33 open point resolution

| Rule | Contract | Source |
|---|---|---|
| Sealing waits for the transcript | `FINALIZE_TRANSCRIPT` completes only after the transcript is assembled and hashed; sealing waits (D223), and the transcript lives **inside** the seal (D222) | D223/D222; `specs §E.3/§E.4` |
| Idempotence | a resumed seal consumes the committed transcript + hash and never recomputes or rewrites the machine transcript | OD-15; `tx §D.3` |
| **Row-33 open point 2 (resolved)** | When STT **hard-fails** (all chunk retries exhausted, `transcript_chunks.status='FAILED'`), the package **still seals**: the transcript step is marked with an explicit state **`transcript.state='PARTIAL'`** and the failed-chunk count `transcript.failedChunks`, **no text is fabricated** for a failed chunk (it is simply absent), and the sealed machine transcript is assembled from committed chunks only. The step is `DONE` (not `FAILED`) so sealing proceeds; the state rides in the manifest and the transcript document. `state='ASSEMBLED'` means all chunks are `DONE`. | Blueprint row 33 idea carries the transcript side (`07_transcript_spec.md`; `delegation_progress/data-analyst__row33.md:69-73`); this spec (the sealing owner) **confirms** it and **refines** it with the two-state enum + count; `tx §A.3` (retry then mark FAILED and continue); `dbc-3 §B.7` (`transcript_chunks_done_check`) |

**Extension (R-8, D20; confirmed, D24, Q-STT-CFG (a); Erratum PE-R8-08).** STT **disabled** by configuration → the
transcript step completes immediately with `transcript.state = 'DISABLED'` (§B.7a), no transcriber
work runs during recording, and sealing does not wait. STT **enabled but the backend unreachable** →
the D-EV-1 rule below applies unchanged (`PARTIAL`, `failedChunks`, no fabricated text) and
`transcript.backendUnreachable = true`. Checks `M6-STTCFG-OFF` / `M6-STTCFG-UNREACH` (active, D24/D64; Erratum PE-R8-08).

**Choice recorded (D-EV-1):** a hard STT failure does not block sealing; sealed evidence keeps its
integrity independent of transcript completeness; the incompleteness is explicit
(`state='PARTIAL'`, `failedChunks`) and never fabricated.

### E.6 The development-source mark in the pipeline **Erratum PE-124-08 (D73, D78 (2))**

| Aspect | Contract | Source |
|---|---|---|
| Step | Fields 124-126 are written in `BUILD_MANIFEST`. No new step: sealing steps stay **8/8** | §E.1; §B.12 |
| Input | The adapter kind of each camera slot and of each microphone, **as recorded for the session at its start**. The record is the INSERT-only table `session_capture_sources` (T-41, `dbc-4` §N.3); the requirement of this spec is that it is durable before the first fragment and is not re-read from the device registry or the development flag at sealing time | §B.12 rule 3; hand-over to row 122 |
| Resume | A resumed `BUILD_MANIFEST` rebuilds the same bytes; `SIGN_MANIFEST` re-signs the same `manifestSha256` (§E.1) | §E.1 |
| Failure | An adapter kind without a class, or a session with no start record of its kinds: step FAILED, nothing signed. The Core never writes `PRODUCTION` by default | §B.12 rule 2 |
| A development package may be sealed | Nothing in the pipeline refuses a session because of its source class | D78 (2) |

---

## F. Tamper demo (OD-02)

### F.1 v1 behaviour being replaced

| Aspect | v1 | Source |
|---|---|---|
| Target | EV-0005, whole **`AUDIO-02`** track altered after sealing | `demo-alignment.ts:39-41,109-121`; `demo-evidence/README.md:44` |
| Demo result | verify fails exactly `track:AUDIO-02`; manifest/signature/certificate still pass | `demo-evidence/README.md:44`; `evidence.ts:304-332` |
| DB marker | `evidence_items.tampered`, `tampered_track_id='AUDIO-02'` (4-value CHECK) | `0001_tables.sql:338`; `dbc-3 §C.6` |

### F.2 v2 re-script: ONE fragment of one camera file

| Aspect | v2 | Source |
|---|---|---|
| Target | EV-0005: exactly **one fragment** of one camera file (e.g. `VIDEO-02`, `seq 3`); its stored bytes are altered after sealing (one range `[offset, offset+length)`), leaving every other fragment intact | OD-02 (D4); M7 criterion |
| Verify outcome | V-04 fails exactly `(VIDEO-02, seq 3)`; V-06 fails the chain **from seq 3 on** (S1 chain rule); V-01/V-03/V-09 still pass | §D V-04/V-06; S1 §3.1 |
| Classification | reported as **TAMPERED**, not CORRUPT, and the report names the fragment | §D V-08; M7 |
| DB marker | `tampered_track_id='VIDEO-02'` (the file; the 4-value CHECK at `:338` is kept permissive, `D-DB-05`); the **fragment location lives in the manifest/verify report**, not a DB column (the v2 column list adds no fragment column, `dbc-3 §C.6`) | OD-01/D-DB-05; `dbc-3 §C.6` |
| Demo data | `DEMO_TAMPERED_TRACK` = `VIDEO-02`; a new `DEMO_TAMPERED_FRAGMENT_SEQ` (proposal 3) locates it | `demo-alignment.ts:39-41`; OD-02 |

### F.3 What the demo shows in the UI

| Screen | v2 demo display | Source |
|---|---|---|
| Evidence integrity (web `WB-04`, mobile `MB-07`) | verify FAIL naming the file and the fragment, e.g. "VIDEO-02 fragment 3 tampered (stored-bytes hash mismatch; chain broken from fragment 3)"; transcript/signature/certificate rows show PASS | register WB-04/MB-07; `specs §E.4` |
| Verdict persistence | keep the per-run pinned verdict (W92-10) | register WB-04 (E-11) |
| Summary (mobile `MB-05`) | per-file hashes, transcript hash, label status, real signature note | register MB-05 |

### F.4 Dataset / regeneration note

| Rule | Content | Source |
|---|---|---|
| Scope | regenerate **ALL** demo evidence as v2; reseed **only `dems_demo`**; `release/` 0.1.0 untouched | OD-02 (D4); E-20; DOC-06 |
| Mechanism | `db:reset` (the reset routine) with the v2 seed; the 13 dataset items + 14 frozen packages regenerated as v2 by the SH-24 generators (host FFmpeg; D7 TTS fixture) | `dbc-3 §E.3`; register SH-24 |
| Tamper item | EV-0005 re-scripted on one fragment (§F.2); `integrity_source='DEMO_PACKAGE'` | OD-02; `dbc-3 §E.3` (C.6 row) |
| v1 code paths | dropped (OD-02 L2); v1 items remain readable but unreachable | OD-02; `dbc-3 §B.11` (`D-DB-05`) |

---

## G. Export (OD-16)

### G.1 Export contents and audit

| Aspect | Contract | Source |
|---|---|---|
| Form | **decrypted copy** of the camera files + `session-manifest.json` + `signature.sig` + `device-certificate.pem` + transcript + revisions, in `export/EXP-<id>.zip` | OD-16 (D4); v1 `demo-evidence/README.md:21` |
| Audit | the export writes an audit row (v1 `EVIDENCE_EXPORTED`; row 29 owns the final type list) | `modules/evidence/index.ts:9`; OD-16 |
| `ExportResult` | refusals: NOT_FOUND, NOT_SEALED, FORBIDDEN, SECURITY_FAULT, INVALID_REASON | `modules/evidence/index.ts:92-99` |
| Export manifest | the 8 export items (payload, sessionManifest, signature, export, source, destination) | v1 `demo-data/types.ts:59-66` |
| Export signature | Ed25519 over `SHA-256(export-manifest.json)` | v1 `demo-data/types.ts:196-197` |
| Key requirement (SEC35-09) | the decrypted export requires the **live session key**; if the key is lost the export is impossible while stored-bytes verify (V-04/V-06) still passes; no key escrow by default (`cap §D.2`) | OD-16; SEC35-09; `cap §D.2` |

### G.2 What the receiver can verify without the Core's key

| Check | Receiver has | Pass condition | Source |
|---|---|---|---|
| Manifest hash | decrypted copy + manifest | `SHA-256(manifest bytes) == manifestSha256` | v1 `demo-data/verify.ts:280-284` |
| Signature | certificate public key | Ed25519/ECDSA over `manifestSha256` verifies | v1 `demo-data/verify.ts:287-291` |
| Plaintext file hash | decrypted copy + manifest | `SHA-256(decrypted file) == tracks[].sha256Plain` | OD-03/RF-6; §D V-05 |
| Transcript/revisions | transcript + revisions | §D V-10/V-11 | OD-15 |
| Source class (**Erratum PE-124-09**) | manifest | §D V-15: the export carries `session-manifest.json` unchanged, so the development-source mark travels with every export and the receiver's verify reports it; an export of a development package is not refused for that reason | D78 (2); §D.1 |
| **Not** checkable | stored-bytes hash (the copy is decrypted) | the stored-bytes hash chain is verified at the Core before export; the export carries the recorded chain so a re-encrypt comparison is possible | OD-03; §D V-04 |

### G.3 Composite (on demand, derived)

| Aspect | Contract | Source |
|---|---|---|
| Trigger | side-by-side composite **only on demand** | OD-16 (D4) |
| Marking | `export.derived=true`; a `derived` marker in the composite block | OD-16; `dbc-3 §B.11` |
| Hashing | the composite's `sha256` is recorded and hashed into the export manifest | OD-16; register NM-12 |
| Encoder | chosen **after a licence check in M8** (FFmpeg's GPL build triggers GPL obligations; DOC-05) | OD-16; `specs §C.1`; register NM-12 |

### G.4 Credential-shaped-value rules for signed URLs / tokens (E-31)

| Rule | Contract | Source |
|---|---|---|
| Blanking (SEC35-13) | the signed-URL/token prefix is **pinned** to `EVIDENCE_MEDIA_TOKEN_PREFIX = 'mts_'` (`03_api_contract.md §7`) and is added to **BOTH log-blanking lists**: the web error sink (`apps/core-web/src/runtime/error-sink.ts:52`) and the mobile log (`apps/mobile/src/runtime/log.ts:46`), whose regex becomes `\b(ses|dvc|bio|mts)_`; the camera-credential form `rtsp://user:pass@host` (SEC35-04) is added to both lists as well | E-31 (register §A); P-07; register NM-11/WB-04/MB-07; SEC35-04/SEC35-13 |
| Evidence export | no credential-shaped value is ever written into a signed package, its manifest, its audit extract or the export manifest | `cap §G` G-R4; register CS-14 |
| M8 check | "any signed-URL prefix in both log-blanking lists" is an M8 gate criterion, asserted by `M8-BLK-1` (row 36), which row 36/37 must extend to the `mts_` prefix and the camera-credential form | `structured §6 M8`; `specs §F` M8; SEC35-13 |

---

## H. Deferred / known limits

### H.1 OD-21 legal confirmation outstanding

| Aspect | State | Source |
|---|---|---|
| Legal acceptance of fragmented MP4 as "one whole file" | **UNRESOLVED — legal confirmation outstanding; no external authority found.** Must be presented as unresolved, never as clearance | OD-21 (D4); W1-C8; register §G RK-2 |
| Negative evidence | No standards-body, forensic-guidance or case-law source located; searches Q-53..Q-61 logged | coll3 F-102; coll3 §G-11 |
| Positive pattern (not authority) | C2PA hashes a fragmented BMFF asset as one object with per-segment hashes, a Merkle tree and monotonic `sequenceNumber` | coll3 F-58..F-61/F-101 |
| Fallback stays designed | segments + **one lossless concatenation** at sealing (`CONCATENATE_SEGMENTS`, §E.3); adds one pass only if legal says no | OD-21 (D4); `cap §C`; D224 |
| Handover rule | legal confirmation before handover; the fMP4 default stands meanwhile | OD-21; `structured §6` |

### H.2 Fragment quantum (SP-4) and the manifest

| Aspect | State | Source |
|---|---|---|
| Decision | keyframe-aligned fragments (`frag_keyframe + min_frag_duration`); the **GOP is the fragment quantum**; contract constants pair fragment target, GOP and `min_frag_duration` (S1 anchor `-g 50 @ 25 fps` = 2.0 s) | `cap §C.1`; S1 §6.5 (SP-4) |
| Open at M0 | the exact pairing is a decision for the M0 spec gate; recorded as a contract constant (CS-25) | `cap §C.1`; `specs §B` R-4 AC-2 |
| Effect on the manifest | `tracks[].keyframeAligned` (§B.4 field 50) and `files[].fragments[].keyframe` (§B.6 field 72) are written from this choice; a plain `frag_duration` run would produce mid-GOP fragments and weaken per-fragment AEAD/tamper | S1 §6.4/§6.5; OD-03 |
| Why it matters | each fragment must be independently decodable for per-fragment AEAD (OD-03) and for the one-fragment tamper demo (§F) | S1 §6.5; OD-03 |

### H.3 fsync / durability limits (SP-2)

| Aspect | State | Source |
|---|---|---|
| `-flush_packets 1` | a **userspace flush**, not fsync: bytes are visible per box-write to other processes on the same OS, but nothing survives an OS/power loss | S1 §8 SP-2; `cap §C.2` |
| fsync policy | per-fragment `fcntl(F_FULLFSYNC)`/`F_BARRIERFSYNC` after each fragment hash record is the **row-31 decision**, still HYPOTHESIS until an OS-level test | `cap §C.2`, `cap §J` H-1 |
| What verify **can** promise | per-fragment stored-bytes hash + chain + sequence + truncation detection (killed-process level, S1 §5); it re-derives the chain with `dd`/`head`/`shasum`/`xxd` alone | S1 §3.1/§5/§10; `cap §A.5` |
| What verify **cannot** promise | OS/power-loss durability; that a fragment an fsync should have protected is on disk after a hard power cut — class-C/pre-handover only | S1 §10 gap 2; OD-08; `specs §E.1` |

### H.4 Other deferred items

| Item | State | Source |
|---|---|---|
| Class C-7 benchmark (RTF, RAM, WER) | deferred to the real Core device; not on this Mac | E-22; `structured §9 C-7`; `specs §G.2` |
| Class C-9 long AV-drift / repeated kill loops | pre-handover only | D233; `structured §9 C-9` |
| Class C-8 TPM/PKCS#11 signer | deferred; adapter and DB algorithm value pre-declared | OD-04; §C.3; `dbc-3 §C.4` |
| Real-camera SDP variants (no `sprop`, H.265) | class C-2; extradata presence check at ingest | S1 §4.6 SP-6; `cap §A.4` |
| Composite encoder licence | chosen in M8 after a licence check | OD-16; §G.3 |
| In-file GCM layout / Range-decrypt latency | HYPOTHESIS until M7/M8 | `cap §J` H-2/H-3 |

### H.5 What the development-source mark cannot prove **Erratum PE-124-10 (D73, D78 (2))**

| Aspect | State | Source |
|---|---|---|
| The limit, plainly | **The verifier cannot tell a package whose manifest says `PRODUCTION` for every source from a package that truly came from production devices.** The class is a statement made by the Core that sealed the package and covered by that Core's signature. Verify proves that the statement has not been changed since sealing; it does not prove that the statement was true when it was written. Nothing in the media bytes distinguishes a network camera from a local or a fake source | §C.3 threat model (SEC35-06: the signer defends integrity); §D.1 |
| What guards it | (1) **The boot fence** (`specs` R-11 AC-1, C-N14; blueprint row 136): the Core refuses to boot with a development source while the development flag is off, and refuses the flag together with a production configuration — a production configuration cannot select a development source. (2) **The Core writes the class from the adapter kind** (§B.12 rules 1-3): no operation and no client can supply or change it. (3) **The signature** (§C.1): the class cannot be changed after sealing without the Core signing key | D73; D72 (l); R-11 AC-1, AC-2, AC-7 |
| What does not guard it | A person who can change the Core's code or configuration and holds its signing key can seal a package that says `PRODUCTION` for any input. That is the same adversary as in §C.3 and is outside what a manifest field can defend | §C.3 (SEC35-06) |
| The case the first three guards did not cover (**erratum PE-128-69**) | The worker's loopback ingest is unauthenticated; in `REAL_PRODUCTION` a local process could push into an open listener and be signed as `PRODUCTION` (SEC35-40). Guard (4): **the Core itself opened the source** — no listener opens and no session starts for a source kind without an opener (D86 C-5) | D86 C-5; SEC35-40 |
| Defined with the fence (**erratum PE-128-69**) | Defined: a production configuration has at least one assigned device of source class `PRODUCTION`, or a listener outside loopback (`cap` §A.1.2) | `specs` §B.2.7 item 7; `cap` §A.1.2 |
| Consequence for wording | A report or a client never states "recorded from production devices" as a verified fact; it states "declared as production devices by the Core that sealed this package" (§D.1) | this row |
| On this computer | A development-mode session (D74 (2)) and every session on fixtures seal with `developmentSources = true`. In this phase `developmentSources = false` cannot occur: no all-`PRODUCTION` package can be sealed (D86 C-5); check `M7-SEC-SRC-2` (**erratum PE-128-69**) | `cap §A.1`; D74 (2); `specs` R-9 |

---

## I. Self-gate (row-32 Verification, stated explicitly)

| Gate item | Result |
|---|---|
| **Every manifest v2 field has type plus source** | **128/128** (**Erratum PE-124-15**; row 32 recorded 120/120) — sections B.1-B.9 and B.11 (8+11+14+18+10+17+16+7+10+9 = 120), plus B.7a fields 121-123 (D24) = 123, plus B.12 fields 124-126 (source class) and 127-128 (first video sample) = 128; B.10 defines the self-hash rule for field 111. Every row carries a type (with nullability) and a source (component + authority/decision/DB column/spike) |
| **Every sealing step has checkpoint + resume rule + progress source** | **8/8** — E.1 six normal steps + E.3 two fallback steps; each row has checkpoint, resume rule, progress source and failure path; E.4 adds the OD-08 crash path; E.5 the transcript-wait |
| **Verify checks enumerated incl. the one-fragment tamper expectation** | **15 checks** (**Erratum PE-124-15**; row 32 recorded 14) — V-01..V-14 and V-15 (source class, §D.1); the tamper one is V-08, quoted: *"tampering exactly one fragment's stored bytes must fail exactly that fragment (V-04) and the chain from that fragment on (V-06), and must be classified TAMPERED, not generic CORRUPT."* |
| **OD-02/03/04/08/15/16/21 each cited by decision ID** | **7/7** — OD-02 (§0.1, §F.4), OD-03 (§0.1, §A.3, §B.4/§B.6, §D V-04/V-05/V-09, §C), OD-04 (§0.1, §C, §B.9), OD-08 (§0.1, §E.4, §D V-12), OD-15 (§0.1, §B.7, §C.4, §D V-11), OD-16 (§0.1, §G), OD-21 (§0.1, §E.3, §H.1) |
| **Row-33 open point resolved with a stated choice** | **PASS** — §E.5 records **D-EV-1**: a hard STT failure does not block sealing; `transcript.state='PARTIAL'` + `failedChunks`, no fabricated text; confirmed and refined from `delegation_progress/data-analyst__row33.md:69-73` |
| **Alignment with row 30's column names** | **PASS** — quoted cross-references: `recording_fragments` (`session_id,track_id,seq,byte_offset,byte_length,media_start_ms,media_duration_ms,sha256,chain_hash,durable_at` → §B.6 fields 62-68,70,78); `sealing_jobs` (`session_id,step,status,progress,eta_ms,attempt,checkpoint,error_code,started_at,updated_at` → §B.8, §E.1); `transcripts` (`json_sha256,srt_sha256,vtt_sha256,model,diarization,labels_status` → §B.7); `transcript_revisions` (`parent_sha256,sha256,author_id,signature_*` → §B.7/§D V-11); `evidence_items` (`manifest_version,transcript_sha256,labels_status`, `integrity_source` `REAL`; `:335` hashes / `:336` signature / `:338` tamper → §B.1, §B.9, §F.2); `evidence_tracks` (`sha256`=stored, `sha256_plain`, `fragment_count`, `fragment_chain_head`, `contains_audio` → §B.4) |
| **Alignment with row 31's writer facts** | **PASS** — quoted: fragment quantum SP-4 keyframe-aligned (`cap §C.1` → §B.4 field 50, §B.6 field 72, §H.2); flush ≠ fsync SP-2 (`cap §C.2` → §B.6 field 78, §H.3); running SHA-256 chain S1 (`cap §C.3`; S1 §3.1 → §B.6, §D V-06); drop-fragment after truncation (`cap §C.5` → §E.4); per-fragment GCM **outside** the muxer (coll3 F-47/F-52; `cap §D.1` → §A.3); restart-per-session supervisor (`cap §B.2` → §E.4); storage path `media/sessions/<sessionId>/` (OD-25; `cap §H` → §A.1) |
| **Register rows cited (evidence/package/signature/export)** | **PASS** — SH-06, SH-07, SH-09, SH-11, SH-14, SH-24; CS-08, CS-13, CS-21; NM-04, NM-05, NM-07, NM-08, NM-11, NM-12 (sections A-G) |
| **Row-35 security remediation applied (SEC35-06/07/10/11/13/20)** | **PASS** — §A.1 (fragments.json equality), §B.6 (derived GCM AAD), §C.3 (threat model + at-rest key hardening + compromise runbook + retained certificate set), §D V-02/V-11 (fragments equality + per-revision certificate), §G.1/§G.4 (export key requirement; pinned `mts_` prefix + both insertion points). Manifest field count stays **120/120**, sealing steps **8/8**, verify checks **14** (the figures of the row-35 remediation; today 128 fields, 8 steps, 15 checks — **Erratum PE-124-15**) |
| **Row 124 (rev 2.3): development-source mark named with type and values; verify rule stated (reported; tampering fails)** | **PASS** — fields 124 `tracks[].sourceClass`, 125 `audio.sourceIntervals[].sourceClass` (enum `PRODUCTION`\|`LOCAL_DEVICE`\|`FAKE`, not null) and 126 `developmentSources` (boolean, not null) in §B.12; signing in §B.10 and §C.1; verify V-15 and §D.1 (PASS with the mark reported first; an edited mark fails V-03 or V-09); limitation in §H.5; compatibility in §B.12; D66 / D72 items placed as fields 127-128 and the media-time origin statement |
| No emoji; English; tables over prose; no file outside the task folder touched; no DB connection / code change / external service | **PASS** — this document and `delegation_progress/data-analyst__row32.md` are the only writes |

---

## References

| Ref | Path / section |
|---|---|
| Blueprint row 32 | `identification/02_structured.md:212` (gate), §6 M7 (tamper criterion), Gate Questions (OD-02/03/04/08/15/16/21) |
| Register | `research/03_analysis.md` — SH-06/07/09/11/14/24, CS-08/13/21, NM-04/05/07/08/11/12; §A E-20/E-31, §C OD-02..OD-21; §F W1-C2/W1-C8/W1-C10 |
| Phase spec | `masterplan/01_specs.md` — §E.4 evidence package and sealing v2; R-4/R-5/R-6; §F M7/M8; §C.1 licences |
| Database contract | `masterplan/04_database_contract.md` — §B.4 `sealing_jobs`, §B.5 `session_audio_intervals`, §B.6 `recording_fragments`, §B.7 `transcript_chunks`, §B.8 `transcripts`, §B.9 `transcript_revisions`, §B.11 `evidence_items`, §B.12 `evidence_tracks`; §C.4/C.5/C.6; `D-DB-01..D-DB-05` |
| Capture spec | `masterplan/05_capture_architecture_spec.md` — §A.5 writer, §B seam, §C writer design, §D encryption, §H storage paths, §J hypotheses (H-1/H-2/H-3) |
| Transcript spec | `masterplan/07_transcript_spec.md` — §A.3/§A.4/§A.5/§A.6, §D checkpoints/resume, §D.3 D223 |
| Spike S1 | `research/06_spike_s1_fmp4_running_hash.md` — §3.1 hashes, §5.4 durable prefix, §5.5 partial tail, §8 SP-2/SP-3/SP-4/SP-7 |
| Spike S2 | `research/07_spike_s2_mic_switch_timeline.md` — §6 finding 3 (media-pts intervals) |
| Spike S4 | `research/08_spike_s4_av_sync_fixture.md` — §5 relative AV offset ±40 ms |
| Collection | `research/02_collection.md` — F-47/F-52/F-53, F-58..F-61/F-62, F-97..F-102 |
| v1 implementation | `packages/shared/src/sim/evidence.ts`, `session-machine.ts:99-106,851-934`, `demo-alignment.ts`, `demo-data/verify.ts`, `assets/demo-evidence/README.md`, `.../SESSION-SES-20260930-0015/manifest.json`; `apps/core-server/src/modules/evidence/index.ts`; `apps/core-server/src/db/migrations/0001_tables.sql:314-340`; `apps/mobile/src/runtime/{recording-elapsed,core-clock}.ts` |
| Decisions | `decisions/decisions.md` — D4 (gate answers), D7, D8, D10, D12; rev 2.3 (**Erratum PE-124-15**): D66 (4b), D72 (d), (e), (g), (l), D73, D74 (2), D78 (2), D80 (9) |
| Rev 2.3 delta | `masterplan/01_specs.md` §B.2 (R-11 AC-1, AC-2, AC-6, AC-7; open point 7; ambiguities 7 and 9), C-N14; `identification/02_structured.md` rows 124, 136, 141; `packages/capture-protocol/src/index.ts:148-163,427-438`; `packages/shared/src/api/capture.ts:61-82`; working record `delegation_progress/data_analyst_row124.md` |

---

*Generated: 2026-10-07 10:20*
*Last Updated: 2026-10-09 (row-128 spec-gate fix pass PE-128-67..71 (D89, D91; `gateway_check/27_r9_r11_spec_gate.md`); row 124, errata PE-124-01..PE-124-15: development-source mark — fields 124-126, V-15, §D.1, §E.6, §H.5; first video sample fields 127-128 and media-time origin, D66 / D72; manifest fields 128, verify checks 15); 2026-10-09 (status sweep PE-R8-06..08: §B.7a + §E.5 R-8 extension confirmed by D24); 2026-10-08 (RV-SPEC: §B.7a + §E.5 R-8 extension added as a proposal, D20; erratum AU2-03 field 51; earlier: row-35 security remediation SEC35-06/07/10/11/13/20)*
