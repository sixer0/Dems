---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-12
agent: data-analyst
type: design addendum (settles the design gaps of the plan verification)
narrative_tier: 1
confidence: HIGH for code facts opened in this pass (file:line given); MEDIUM for the decisions that follow from them; LOW wherever a statement is marked HYPOTHESIS or NOT VERIFIED
status: proposed - to be security-reviewed before the implementation blueprint adopts it (decisions/decisions.md, C13)
based_on: verification/03_plan_review.md (row 12), verification/02_security.md (row 13), verification/01_verification.md (row 11), decisions/decisions.md (U1-U14, P1-P9, C1-C13)
amends_without_editing: masterplan/01_specs.md, masterplan/02_plan.md, masterplan/03_db_schema_extension.md (none of the three was edited; where this addendum differs, it governs, and the difference is listed in section 11)
baseline: commit cf2f8008
last_updated: 2026-10-12 21:57 WIB
---

# Design addendum: the gaps found by the plan verification, settled

> **Ringkasan (Bahasa Indonesia).** Dokumen ini hanya desain: tidak ada berkas sumber yang diubah dan tidak ada yang dijalankan. Sembilan hal diputuskan. (1) **Boot produksi pertama (P12-B1):** pagar capture (fence) **tidak diubah sama sekali**. Yang berubah adalah model data: slot selector boleh **kosong (belum ditugaskan)**. Core produksi dengan slot kosong boleh boot, tetapi **menolak memulai sesi**. Pembuktian dengan enumerasi 21 keadaan ada di bagian 1.5: tidak ada keadaan di mana sumber pengembangan terekam di `REAL_PRODUCTION` atau sumber produksi di `REAL_DEVELOPMENT`. (2) **Kredensial kamera tersimpan (P12-B2):** dibuka oleh satu modul, tepat saat injeksi, lewat dependensi konstruktor adapter (tanda tangan `openSource` dan `pullUrl` tidak berubah), dikirim ke relay lewat pesan awal di standard input, dan setiap pembukaan dicatat di audit sebagai fakta tanpa nilai. (3) **Waktu mulai sesi:** dua kamera dibuka paralel, jendela ingest produksi 30 detik (hipotesis, diukur di paket uji hardware), kamera yang terlambat tetap hilang untuk sesi itu seperti hari ini. (4) Lima ketidakcocokan kontrak diputuskan, termasuk operasi pendaftaran mikrofon. (5) Aturan keputusan untuk percobaan E-11 ditulis sekarang, tiga cabang, termasuk cabang "worker menarik sendiri" beserta biayanya. (6) Adapter dibangun di berkas baru dan diuji di level adapter sebelum pencabutan aturan kelas C; sesi penuh pertama adalah langkah WP-13, yang ukurannya M dan dipecah tiga. (7) Kode profil kamera produksi dibentuk dari stream, bukan dari jawaban ONVIF, sehingga kamera H.265 tidak dilaporkan "berbeda". (8) Lima paket ukuran L dipecah. (9) Tabel persyaratan: 61 temuan dan pembacaan pengendali dalam 60 baris, semua punya rumah. **Yang butuh Anda** ada di bagian 10: memindahkan `data/` keluar repositori, menerima digest di LAN kamera produksi, dan nasib input-av bench setelah tahap 2.

## 0. Frame (5W1H), method, limits

| Question | Answer |
|---|---|
| **What** | Nine design decisions: P12-B1, P12-B2, F03, F05, F10/F11 with RC-1 and S13-05, F01/F02, F08, the splits of the L-size packages, and one consolidated requirements table. |
| **Why** | Row 12 judged the plan SOUND WITH CHANGE with two blocking design gaps; the controller routed them to one addendum that takes the most conservative option (`decisions/decisions.md:40`, C13). The implementation blueprint cannot define WP-03, 04, 05, 06, 13, 19, 22, 27 without it. |
| **Who** | Author: data-analyst. Next reader: security-review (P12-B1 touches the neighbourhood of a security control), then task-architect (implementation blueprint). Decision owner for anything in section 10: the user. |
| **When** | 2026-10-12, after the three verification rows, before the implementation blueprint. |
| **Where** | Decisions land in `apps/core-server/src/capture/`, `src/capture-session/`, `src/modules/capture-config/`, `src/db/`, `packages/shared/`, `apps/capture-worker/`. Paths of files that do not exist yet are **proposed names**, marked so. |
| **How** | The binding rows and the three verification documents were read in full; the code each gap is about was opened read-only at `cf2f8008`. Nothing was built, started or migrated. Nothing under `apps/input-av/data/` and no `.env` was opened. The Graft graph was not queried: it refreshes itself before a query, which writes outside this task folder. |

**Abbreviations.** `CS` = `apps/core-server/src`; `WRK` = `apps/capture-worker/src`; `PROTO` = `packages/capture-protocol/src/index.ts`; `SHARED` = `packages/shared/src`; `SPEC`, `PLAN`, `SCH` = the three masterplan documents; `REV` = `verification/03_plan_review.md`; `SEC` = `verification/02_security.md`; `VER` = `verification/01_verification.md`; `DEC` = `decisions/decisions.md`.

**Three labels used below.**

- **HYPOTHESIS (HA-n)**: rests on knowledge of FFmpeg, Linux, macOS or browser behaviour, not on a line or a run. Each names the experiment that settles it and where that experiment lives. All are collected in section 12.
- **NOT VERIFIED**: a fact about the Core's own code that this pass did not open. Each is the first step of the package that needs it.
- **Proposed name**: a file, operation or code that does not exist; the blueprint may rename it.

**Identifier note.** The plan's hardware checks are written `9A/H-nn` here, because `H-nn` is also used for the 38 logic items (`VER` F-10). New hardware checks are `9A/H-21` to `9A/H-27` (section 9.6).

---

## 1. P12-B1: the path to a first `REAL_PRODUCTION` boot

**Decision: the capture fence and the boot checks are not changed by one character. The selector learns a state it lacks today: a slot may be unassigned. A production Core whose slots are unassigned boots, serves commissioning, and refuses every session start. The fence keeps refusing, at boot, every selector that assigns a development source.**

### 1.1 Facts

| # | Fact | Evidence |
|---|---|---|
| 1 | `REAL_PRODUCTION` is refused at boot while the selector assigns a development source; `REAL_DEVELOPMENT` while it assigns a production source | `CS/capture/fence/boot.ts:147-150`, `:151-153` |
| 2 | The fence reads only what the selector **assigns**: a slot that names no device yields no row, and an empty list passes | `CS/capture/fence/statements.ts:21-27` (a JOIN; "No row when the selector table is empty"); `boot.ts:148-149` |
| 3 | The refusal's own remedy says "start once with `DEMS_CAPTURE_DEV_SOURCES=1`, **unassign them** on the Devices page, then start without the flag". No such action exists: the six slot columns are NOT NULL and operation 78 replaces a line, it has no way to clear one | `boot.ts:87-89`, pinned by `CS/capture/fence/__tests__/fence.test.ts:165`; `CS/db/schema/capture.ts:98-103`; `SHARED/api/devices.ts:146-147` |
| 4 | A device is assignable only when its source class is the running operation's | `CS/capture/adapters/registry.ts:128-134` |
| 5 | A registry of an operation refuses to register an adapter of a kind outside that operation | `registry.ts:80`; `CS/capture/adapters/kinds.ts:72-76` |
| 6 | The session start already refuses a selector that is not two video tracks, a PRIMARY and a STANDBY microphone, before anything is opened; the refusal becomes `409 INVALID_STATE` | `CS/modules/capture-config/plan.ts:120-126`; `CS/capture-session/index.ts:616,619-628` |
| 7 | The session-source builder refuses anything but four slots of one class, of the class of the operation, and reads the written rows back | `CS/capture/fence/sources.ts:96-113,121-129` |
| 8 | On the wire the selector slice is two arrays **without a fixed length**: a selector with fewer lines is already a valid slice | `SHARED/api/state-slices.ts:1114-1117` |
| 9 | The runtime role may UPDATE the six slot columns and may neither INSERT nor DELETE the selector row; the engine requires exactly one row | `CS/db/migrations/0005_capture_privileges.sql:32-37`; `CS/db/mapping/from-rows.ts:59-65,157` |
| 10 | In `REAL_PRODUCTION` the device list hides stored development devices, **except** a device the selector names, and the code says why: such a state "is the capture fence's refusal of the boot, not a state without it" | `CS/db/mapping/rows.ts:943-951`; `CS/capture/fence/sources.ts:166-174` |
| 11 | A seeded database is not a production one: production refuses the demonstration password and a development signing key. "Provisioning operators is a task of its own" | `CS/capture/boot/checks.ts:30-34,408,411-416` |
| 12 | In `SIMULATED` an edit is not held to the adapter registry (there is none), so a stored production camera can be assigned there. A stored `USB_AUDIO` microphone cannot exist: nothing registers one | `CS/modules/capture-config/routes.ts:194-195`; `SCH:231` |
| 13 | Tests already put production rows into a clone through the owner connection and boot a production Core on it | `CS/capture/fence/__tests__/fence.db.test.ts:78-81,178-190` |

Fact 12 answers the question row 12 left at MEDIUM confidence: there is a half-route for cameras through `SIMULATED`, none for microphones, and it ends in a selector that both real operations refuse. It is not an installation path. It is harmless by the enumeration of 1.5 and is left as it is (observation OBS-1, for the security review).

### 1.2 Options

| | A. Unassigned slot (chosen) | B. "Not commissioned" hold | C. Placeholder production rows |
|---|---|---|---|
| What | A slot of the selector may be empty. The fence is untouched. Session start refuses an incomplete selector | The boot stops refusing `DEV_SOURCE_WITHOUT_FLAG`; the Core boots with fakes assigned and refuses sessions | A provisioning step writes four registry rows of the production kinds that stand for "not yet commissioned" and points the selector at them |
| Fence (`boot.ts:144-158`) | **unchanged** | **changed**: a security control (SEC35-41 (b), SEC35-43 (a)) becomes a session-time rule | unchanged |
| Other rules | none broken | breaks fact 10: a production Core would list the assigned development devices (R-11 AC-2 "lists 0 development devices") | the registry holds rows that are no device ("a slice must never invent one", `CS/modules/capture-config/slices.ts:94-95`); adoption then creates `CAM-03` beside a dead `CAM-01` that is never deleted |
| Schema | six columns lose NOT NULL; one CHECK added | none | none |
| Contract | none on the wire (fact 8); one optional member on the body of operation 78 | none | none |
| New operation, flag or adapter kind | none | none | none |
| Size | M | S | S to M |

A fourth idea, a separate "commissioning" capture operation or flag, was not tabled: it is a third path by definition.

### 1.3 Chosen: A, and why it is the most conservative

1. **No refusal is removed, narrowed or made conditional.** `captureOperationDecisionOf` (`CS/capture/fence/operation.ts:71-81`), `captureFenceRefusalOf` (`boot.ts:144-158`), the development-key refusal (`checks.ts:408`) and the demonstration-password refusal (`checks.ts:411-416`) keep their text. Option B is the only one that edits the control, and it breaks a second rule on the way (fact 10).
2. **It supplies the state the fence already assumes.** The refusal text has told operators to "unassign" since it was written (fact 3), and the fence statement already treats a slot without a device as "not assigned" (fact 2). The gap is in the data model, so that is where the change goes.
3. **It adds a refusal instead of removing one.** "Exactly four assigned slots" is already a session-start rule (facts 6, 7). Under A it is reached in practice; it gains a twin in the simulator so that no operation starts a session on an incomplete selector.
4. **It is true.** Before commissioning, a production room has no camera and no microphone. Option C would state four devices that do not exist, in an evidence system's registry, for ever.

Cost accepted with A: it is the one place in the three schema sets where an existing column changes (NOT NULL removed). `SCH` section 3.3 says no existing column changes nullability; that sentence no longer holds for `capture_config` (section 11, erratum E-A1).

### 1.4 What changes

| # | Change | Where | Carried by |
|---|---|---|---|
| 1 | `video_01_device_id`, `video_01_profile`, `video_02_device_id`, `video_02_profile`, `mic_primary_id`, `mic_standby_id` become nullable. New CHECK `capture_config_slot_pair_check` (proposed name): per video slot, device id and profile are both NULL or both set. The three existing CHECKs keep their text (a comparison with NULL does not fail a CHECK). **No grant changes**: UPDATE on these columns exists (fact 9) | `CS/db/schema/capture.ts:98-103,145-152`; inside schema set A, in its generated file. No fourth set: U11 rules three sets (`DEC:23`) | WP-24 |
| 2 | Row mapping: a NULL slot is an absent line of the slice, both directions; `selectorDeviceIds` ignores NULL | `CS/db/mapping/rows.ts:906-931,957-959`; `CS/modules/capture-config/slices.ts:97-123` | WP-13a |
| 3 | Operation 78 gains one optional body member, `unassign` (proposed name): a list of slot names. Same permission (`CAPTURE_CONFIG`), same lock (refused while a session is open), same audit type (`CAPTURE_CONFIG_CHANGED`). It is the **only writer of an empty slot**. The seed keeps writing the four fakes, so every existing database and test is unchanged | `SHARED/api/devices.ts:146-147`; the hosted action `setCaptureConfig` (`CS/modules/capture-config/routes.ts:252`) | WP-13a |
| 4 | The simulator's session start refuses an incomplete selector with the same `409` the real start gives. NOT VERIFIED: the simulator's start action in `SHARED/sim` was not opened; whether it assumes two cameras is the first step of WP-13a | `SHARED/sim` | WP-13a |
| 5 | Both clients draw an absent line as "not assigned" and offer the assignment. NOT VERIFIED: 42 non-test files under `SHARED`, `apps/core-web/src`, `apps/mobile/src` name `captureConfig` (counted by search); which of them assume two lines is measured first | clients | WP-13a |
| 6 | Pre-check: an unassigned slot is a BLOCK item worded "source not assigned", not "not recordable" | the pre-check of `CS/capture-notices` (NOT VERIFIED: not opened) | WP-13a |
| 7 | **A strengthening at the lift.** Today "an adapter of a production kind cannot state an opener" is held by the list (`registry.ts:82`). Once the list holds the production kinds, nothing at registration stops an `ONVIF_RTSP` adapter **with** an opener from being registered in `REAL_DEVELOPMENT`, where that kind is registrable for its search half (`kinds.ts:74`). New rule in `register()`: an adapter that states an opener is refused unless its source class is the class the operation records. The later class checks (`plan.ts:151-153`, `sources.ts:126-128`) stay as the second and third line | `registry.ts:79-93` | WP-13c |

Pins that move: `fence.test.ts:165` keeps its text and gains a test that the remedy is now executable; the schema pins of `SCH` 3.4 (named CHECKs +1); the body schema of operation 78 and its generated description. The operation count stays 97.

**First production boot, as a sequence.** (a) `db:migrate`, `db:seed`. (b) Boot once in `SIMULATED`: give every operator a credential of their own (X-2) and unassign the four slots through operation 78; each is an audit entry. (c) Provision the production signing key (X-1). (d) Boot `REAL_PRODUCTION`: the fence reads zero assigned sources and passes; the boot checks pass. (e) Commission: network settings, scan, set address, adopt cameras (`ONVIF_RTSP` rows), register microphone inputs (`USB_AUDIO` rows, section 4). (f) Assign the four slots: allowed, their class is the operation's. (g) A session can start. A later provisioning command for production databases, if one is built (X-2, fact 11), writes the selector row with six NULLs and no fake device rows; step (b)'s unassign then has nothing to do.

### 1.5 Proof by enumeration

Each slot is U (unassigned), D (a development kind: `FAKE`, `LOCAL_DEVICE`) or P (a production kind: `ONVIF_RTSP`, `USB_AUDIO`). Every selector falls into exactly one of seven categories. Boot outcomes are `boot.ts:147-153`; a refused flag combination never reaches this table (`operation.ts:76-78`, the boot stops).

| Selector | `REAL_PRODUCTION` | `REAL_DEVELOPMENT` | `SIMULATED` |
|---|---|---|---|
| 1. all four U | boots; session start refused (`SELECTOR_SHAPE`, `plan.ts:124-126`) | boots; session start refused, same line | boots; start refused (1.4 #4) |
| 2. some U, the rest D | **boot refused** `DEV_SOURCE_WITHOUT_FLAG` | boots; session start refused (`SELECTOR_SHAPE`) | boots; start refused |
| 3. some U, the rest P | boots; session start refused (`SELECTOR_SHAPE`) | **boot refused** `DEV_FLAG_WITH_PRODUCTION_SOURCE` | boots; start refused |
| 4. some U, D and P | **boot refused** | **boot refused** | boots; start refused |
| 5. four assigned, all D | **boot refused** | boots; records development sources (today's behaviour) | boots; simulator media only |
| 6. four assigned, all P | boots; records production sources once the lift has landed and each device has an adapter with an opener; before that refused (`sources.ts:86,106`) | **boot refused** | boots; simulator media only |
| 7. four assigned, D and P | **boot refused** | **boot refused** | boots; simulator media only |

Twenty-one states. Development sources record in exactly one (5, `REAL_DEVELOPMENT`); production sources in exactly one (6, `REAL_PRODUCTION`). `SIMULATED` opens no source at all: no adapter is registered there (`kinds.ts:75`) and its four rows are written as `FAKE` (`sources.ts:103,127`).

**The selector changes after the boot.** Two ways:

| Way | `REAL_PRODUCTION`, a D device is put into a slot | `REAL_DEVELOPMENT`, a P device is put into a slot |
|---|---|---|
| Through operation 78 or 79 | refused: the device is unknown to the registry (`registry.ts:80` let no development adapter in) or its class is wrong (`registry.ts:132`); `422` (`routes.ts:203-211`) | refused the same way; after the lift also by 1.4 #7 |
| Behind the Core's back, by the database owner | session start: `assertRecordable` finds no adapter (`plan.ts:135-142`); if that were bypassed, the source builder refuses the kind and the class (`sources.ts:106-107,126-128`); if that were bypassed, the re-read of the written rows refuses (`CS/capture-session/index.ts:637`). The next boot is refused | the same three lines; the next boot is refused |

So no state lets a development source record in `REAL_PRODUCTION` or a production source in `REAL_DEVELOPMENT`, and a Core with no assignable source (categories 1 to 3, and 6 before commissioning) refuses a session start. Unassigning can only move a selector toward category 1; it cannot create a D or a P.

### 1.6 How the production adapters are exercised on this Mac

| Level | Capture operation | Adapter kind | What stands in | Records? |
|---|---|---|---|---|
| Adapter tests (phases 3 and 4) | **none**: the adapter object is built directly with injected seams; no registry, no fence, no session | `ONVIF_RTSP`, `USB_AUDIO`, as the adapter states | fake ONVIF stub (`apps/core-server/test/support/fake-onvif-stub.ts`); the generated RTSP camera of WP-03b; a microphone double that writes the pipe format; the real relay and the real release worker, the worker driven by its own harness | a file in a temporary folder; never a session |
| Search and connection test | `REAL_DEVELOPMENT`, as today | the candidate is `FAKE`: a loopback answer is never a production camera (`CS/modules/capture-discovery/connect/service.ts:266-268`) | fake ONVIF stub through the lane launcher (`CS/capture/fence/development-discovery.ts:66-75`) | no: a test is a read |
| Full session (first run: WP-13c) | **`REAL_PRODUCTION`** | **`ONVIF_RTSP`, `USB_AUDIO`** | a clone database of the suite (C8) in which the test's owner connection wrote the production rows, as fact 13 does today; camera address `127.0.0.1`; a signing key made for the run in a temporary data directory; fixture operators without the demonstration password | yes: one sealed session in the temporary data directory, removed with it |

Why this is not a third path a real installation could reach:

1. No new operation, flag or kind exists. The doubles run the production operation with the production kinds.
2. The seams (door, ONVIF session factory, card enumerator, program paths, clock) are parameters with real defaults, following the mount's existing seams (`CS/capture/fence/index.ts:411-415`). A static rule added in WP-13b holds every non-test file to "calls the production registry builder without a seam argument".
3. A production row with a loopback address cannot come out of any product path: adoption refuses it (`service.ts:266-268`), and the two new writers of a camera address (WP-12, WP-22) refuse loopback by the target rule of S13-11. It can be written only by the database owner, which is what the test does and what a real installation's service user cannot do (`dems_app` has no UPDATE on `adapter_kind`, `CS/db/schema/capture.ts:53-57`).
4. The stub is refused in production by the launcher (`development-discovery.ts:72`); the full-session test does not search, it reads rows.
5. No source file names the stub or its target (static rules CPB1-12, G-R9, cited at `development-discovery.ts:9-12`). Unchanged.

Hygiene of the full-session test, as requirements of WP-13c: it never runs against `dems_demo`; its key and its data directory are made for the run and removed; the package it seals, which reads `PRODUCTION` although its sources are doubles, never leaves that directory. NOT VERIFIED: how today's tests make a signing key that is not a development key (through the signer or through the injected check of `checks.ts:334`); measured as WP-13c's first step, and the test states which.

**No lane for a manual trial is built.** A served "production Core on doubles" would hand a person sealed packages that read `PRODUCTION`. The automated test is the exercise; the manual trial is track H.

### 1.7 Must not weaken; tests on this Mac

Must not weaken: the three fence refusals of facts 1 and their order; "one session is never both" (`sources.ts:123-124`); the demonstration-controls refusal (`operation.ts:77`); the development-key and demonstration-password refusals; "no listener for a kind without an opener" (`sources.ts:105-106`); the runtime role's lack of INSERT and DELETE on the selector.

| Test | Pass when |
|---|---|
| The table of 1.5 as a table test: 7 categories by 3 operations | 21 of 21 outcomes as stated |
| Fence unchanged | the fence's existing tests show 0 changed results; `git diff` of `boot.ts`, `operation.ts`, `checks.ts` is empty at the end of WP-13a |
| The remedy is executable | on a seeded clone: boot development, unassign four, boot production: passes, 1 `SYSTEM_BOOT` row, session start answers `409` |
| No recording without sources | categories 1 to 3 in each real operation: worker started 0 times, `session_capture_sources` rows 0 |
| 1.4 #7 | an `ONVIF_RTSP` adapter with an opener registered in a `REAL_DEVELOPMENT` registry: refused `CAPTURE_ADAPTER_INVALID` |
| Set A | applies to a seeded version-6 database with the six columns unchanged in content; a video slot with a device and no profile is refused by the database |

---

## 2. P12-B2: the read path of the stored camera credential

**Decision: one module reveals, one function injects, the contract's signatures do not change. The production camera adapter is built with a credential reader as a constructor dependency and calls it inside `openSource`, at the injection and nowhere else. Every reveal is one audit entry that names the device and a reason code. The relay receives the credential in its start message on standard input and is the one process in which a credential ever stands in a URL.**

### 2.1 Facts

| # | Fact | Evidence |
|---|---|---|
| 1 | The injection point needs a `SealedCredential`; it has no caller, and a static test holds it so | `CS/capture/adapters/credential.ts:122-125`; `CS/capture/adapters/__tests__/static.test.ts:121-125` |
| 2 | The reveal function exists in the database, EXECUTE granted to the runtime role, "the call site is exactly one module (`.../modules/capture-config/credential-reveal.ts`)". That file does not exist; the function has 0 callers | `CS/db/migrations/0005_capture_privileges.sql:11-16,61-75`; `REV` P12-B2 |
| 3 | The credential store can open a capture-device envelope, bound to the device id | `CS/credential-store/index.ts:111-114,238-243` |
| 4 | The pattern exists for the transcriber: one file names the reveal function, another opens the envelope | `CS/transcription/credential-reveal.ts:1-19,50-59` |
| 5 | The audit detail of a reveal is the device id and a reason code, nothing else | `CS/core/audit-details.ts:300-304` |
| 6 | Under `src/capture/` only `credential.ts` may read `.username` or `.secret` | `static.test.ts:52,115-119` |
| 7 | `pullUrl` is synchronous and has **no caller** in the product: only its four implementations name it | `CS/capture/adapters/types.ts:143`; search of `CS` outside tests: `onvif-rtsp.ts:35`, `onvif-discovery.ts:50`, and the fake and local adapters |
| 8 | `openSource` is told the device and the ingest address, **not the profile**; the session has it | `types.ts:120-123,140`; `CS/capture-session/index.ts:1131`; `plan.ts:205` |
| 9 | A stream address is accepted only when its host is the camera's own and it has no user part | `CS/capture/adapters/camera/onvif-session.ts:227-240` |
| 10 | Today's door closes the child's standard input; the worker ends when its standard input ends | `CS/capture/adapters/local/process-door.ts:96`; `WRK/capture_worker.c:459-461` |

### 2.2 Options

| | a. A credential parameter on `openSource` | b. A reader as constructor dependency (chosen) | c. The relay fetches it |
|---|---|---|---|
| Who reveals | the session start | the adapter, inside `openSource` | the relay |
| Contract | signature change in four implementations and their tests | none on signatures | none |
| Where a credential travels | through the session code, which today never holds one | reader to adapter to injection, in one function | the relay would hold a database role and the store's key |
| Verdict | spreads the secret to a unit that has none | **chosen** | rejected: it moves the write-only store into the process that parses camera data |

### 2.3 Chosen: b

**The path, step by step.**

| Step | What | Where (proposed names marked *) | Rule |
|---|---|---|---|
| 1 | `revealCaptureCredential(connection, deviceId)`: the one statement that names `dems_capture_credential_reveal`; returns the user name and the sealed envelope, never a secret | `CS/modules/capture-config/credential-reveal.ts`*, the path the migration names | static rule: exactly one file of the server names the function (twin of the transcriber's rule) |
| 2 | The **credential reader** `credentialFor(deviceId, reason, actorId)`: in **one unit** it calls step 1 and appends `CAPTURE_CREDENTIAL_REVEALED`; if the audit entry cannot be written the unit rolls back and no credential is returned. Outside the unit it opens the envelope with the store (`capture.open(deviceId, sealed)`) and returns a `SealedCredential` | `CS/modules/capture-config/credential-reader.ts`* | no reveal without its audit entry; a failure is a code |
| 3 | `openSource(deviceId, target, signal)`: calls the reader once; resolves the locator with one authenticated `GetStreamUri` through `usingCredential` (the pattern of the connection test); calls `credentialAtInjection(locator, sealed)`; hands the frozen result, as one member of the start message, to the production door | `CS/capture/adapters/camera/relay-start.ts`*, the **one** caller of the injection point | the file never names `.username` or `.secret` (fact 6): the door serialises the message whole |
| 4 | The production door writes one line to the relay's standard input, overwrites its buffer, and **keeps the pipe open**: its end is the relay's order to stop (fact 10; `REV` WP-02) | `CS/capture/adapters/production-door.ts`* | never an argument, an environment variable, a log line, a file or a stored URL |
| 5 | The relay composes the user-part form in its own memory, percent-encoding both values, opens the camera, answers a Digest challenge only | `apps/capture-worker/src/capture_relay.c`* | S13-01, S13-02 |

**Which contract members change.** Only one, and by one member: `CameraSourceTarget` becomes `{ ingestUrl, profile }` (fact 8; decided in 4.1 e). `openSource` keeps its three parameters. `pullUrl` keeps its synchronous signature and is not edited: it has no caller (fact 7), so the locator of a production camera is resolved **inside** `openSource` and never crosses the adapter boundary; the production adapter's `pullUrl` refuses by a named code (`LOCATOR_RESOLVED_AT_OPEN`*). This settles `REV` P12-F05 (a) without touching four implementations.

**When a reveal happens, and what the audit records.**

| Occasion | Reveals | Reason code* | Actor |
|---|---|---|---|
| Session start, per camera line of the plan | 1 | `SESSION_OPEN` | none (the system; the start itself is audited with its operator) |
| The relay process is started again inside a session (only if WP-11 is built, 2.4) | 1 | `RELAY_RESTART` | none |
| Connection test of an **adopted** camera when the operator types no credential | 1 | `CONNECTION_TEST` | the operator |
| The relay reconnects to the camera by itself | 0 | - | - |
| Presence, pre-check, clock offset | 0: the unauthenticated time read of the existing connection file (`onvif-session.ts:450-451`) | - | - |
| Set-IP job, commissioning scan, test of a candidate | 0: the credential is the one typed for that operation (C1, C7) | - | - |

The detail keys stay `deviceId` and `reason` (fact 5): no vocabulary change. The comment "the supervisor reveal path" (`audit-details.ts:301`) gets an erratum. A session with two cameras therefore shows 2 reveal entries; more than `2 + restarts` is a finding.

**How long it lives.**

| Holder | From | To | Bound |
|---|---|---|---|
| Core process | the store opens the envelope | the write of the start message has completed or failed | one call of `openSource`; no member, no cache, no retry keeps it. A second attempt is a second reveal with its own entry. No erasure is claimed (CR-3, `credential.ts:18-20`) |
| Pipe | the write | the relay reads it | the kernel's buffer, between two processes of the Core's user |
| Relay process | the read | the process ends | **the life of the relay**: it needs the URL at every re-open of the camera leg |

### 2.4 Reconnect

1. **The camera leg drops while the relay lives.** The relay re-opens with what it holds. No reveal, no ONVIF call, no Core involvement. Retry rule of `SPEC` S1-8.
2. **The camera refuses the credential or the locator on a re-open.** The relay does not hammer: after 2 authentication refusals it ends with a code (`AUTH_REFUSED`*), which is the lock-out bound of D86 C-2, and each refusal counts against the Core's guard (S13-04 (d)). A missing stream path ends it with `LOCATOR_STALE`*.
3. **The relay process has ended.** A new relay means a new push to the worker, and the worker takes one push per listener per session (`WRK/ingest.c:540`). So a relay restart inside a session exists only if WP-11 is built, and then it is a new reveal (`RELAY_RESTART`), a new `GetStreamUri` and a new start message, attested again (RC-4). Without WP-11 an ended relay is a camera loss for the rest of the session. Stated limit LA-1.

"Locator resolved at each open" (H-11) therefore means at each **start of a relay**, not at each reconnect inside it.

### 2.5 Reconciliation with C1, C7 and with review F10 (b)

- **C1, C7.** The set-IP job never calls the reader. Static rule in WP-22a: the set-network file and the job file do not import the reader or the reveal module. The job's credential is the `SealedCredential` typed for that one operation, held in the job's closure, dropped on every exit (S13-04 (b)).
- **F10 (b), "never URL" (`SPEC:226`).** Not achievable as written: the pinned RTSP client takes an account only as the user part of its URL (`REV` section 0, the demuxer's option list). The rule becomes: **no process but the relay ever holds a locator with a user part; the Core composes none** (rule A-2 stays as it is). Erratum E-A2 names the relay as the one exception to `credential.ts:9-10`.
- **The bound of that exception, and the hygiene S13-02 requires of the relay:** (a) its own log callback: codes and counters, never library text, never a stream description; (b) both output streams read into bounded buffers, used for classification, anything kept passes `blankCredentialLocators` (`credential.ts:135-137`); (c) core-dump limit 0 at start and, on Linux, not dumpable; the start-message buffer overwritten after use; (d) the message is never echoed, and a failed write names no part of it; (e) the relay's path passes the program rule (`CS/capture/adapters/local/helper-program.ts:31-44`) and a boot check names a failure; (f) erratum E-A2; (g) the search of E-12 covers the relay's outputs in three failure runs, the process listing and environment during a run, and every line the session persisted.
- **F10 (c).** Both values are percent-encoded by the relay with every character outside `A-Z a-z 0-9 - . _ ~` escaped. HYPOTHESIS HA-7: the pinned client decodes the user part before it computes the digest. Settled in track D by WP-03a's test with an account that holds `@ : / %` and a space, against the fixture of WP-03b; on a real camera by `9A/H-23`.
- **F10 (d).** The relay refuses to compile and to start on any libavformat but the worker's (`WRK/ingest.c:58-77`), and a boot check compares its stated version (WP-20).

### 2.6 Must not weaken; tests on this Mac

Must not weaken: the runtime role's lack of SELECT on the credential table; rule A-2; "a credential is a parameter of one call" (CR-1); the forbidden audit keys; the lock-out guard.

| Test | Pass when |
|---|---|
| Static | callers of the reveal function: 1 file. Callers of `credentialAtInjection` outside `credential.ts`: 1 file. Files under `src/capture/` that read a credential member: 1 (`credential.ts`). Importers of the reader in the commissioning files: 0 |
| Reader, on the test PostgreSQL | one call yields 1 credential and 1 audit entry with exactly two detail keys; with the audit append made to fail: 0 credentials, 0 entries |
| A session on doubles with two cameras | reveal entries: 2; the fake ONVIF stub logs 1 authenticated `GetStreamUri` per camera |
| E-12, extended (S13-02 g) | occurrences of the fixture secret in the argument lists, the environments, both output streams, the log sink, the audit table, the session tables: 0, in a good run and in three failure runs |
| Reconnect | the fixture drops the connection: reveal entries stay 2. The fixture refuses the credential on re-open: the relay ends after 2 refusals; requests carrying a credential after that: 0 |
| Digest only (S13-01 b) | the fixture challenges Basic: requests with an `Authorization: Basic` header received: 0, record mode and probe mode, 2 runs each |

---

## 3. F03: session-start timing with real cameras

**Decision: the two cameras are opened in the same turn, not one after the other. Each open is bounded. The production launcher passes an ingest window of 30,000 ms. A camera that has not connected inside the window is lost for that session, as today: no change is needed for a present camera to be usable.**

### 3.1 Facts

| # | Fact | Evidence |
|---|---|---|
| 1 | The window is a named setting of the worker process, an argument, default 15,000 ms, 1,000 to 600,000 ms. It is "fixed per installation" and "tunable without a code change" | `PROTO:372-397`; `CS/capture/worker-arguments.ts:24-34` |
| 2 | The worker listens once per camera and takes one push; a camera given up while opening stays given up | `WRK/ingest.c:482-483,500,540` |
| 3 | With no camera inside the window the session ends `NO_CAMERA_CONNECTED`; a single missing camera is a warning and a degraded session | `PROTO:381-384,269`; `capture-session/index.ts:1086-1091` |
| 4 | The session opens the cameras in a loop and awaits each | `capture-session/index.ts:1129-1140` |
| 5 | The same function already launches both microphones "in the same turn", for the reason that serial starts cost the second one the head of its track | `capture-session/index.ts:1105-1112` |
| 6 | The relay cannot announce before it holds the codec and the parameter sets (`SPEC` F-1, hypothesis H-F) | design |

### 3.2 Options and choice

| | Keep serial | Parallel, bounded (chosen) | Parallel, and a late camera joins |
|---|---|---|---|
| A slow first camera | costs the second its window | costs nothing | costs nothing |
| A camera absent at start | start waits two bounds in the worst case | start waits one bound | recorded when it returns, as input-av does |
| Changes | none | the loop of fact 4; one argument of the launcher | the worker must listen again: WP-11, a change to the verified ingest |

Chosen: **parallel, bounded.** The third option is not needed for a production camera to be usable at all, so today's behaviour stays (limit LA-2: a camera absent at the start of a session is not in that session; input-av differs here). It is revisited only if WP-11 is built for another reason.

| Parameter | Value | Basis |
|---|---|---|
| Ingest window, `REAL_PRODUCTION` | 30,000 ms | HYPOTHESIS HA-8: enough for reveal, `GetStreamUri`, the relay's start, RTSP set-up and the wait for the first keyframe of a real camera. The setting exists (fact 1); only the launcher's value changes, and only for this operation |
| Bound of one `openSource` | window minus 5,000 ms = 25,000 ms | the relay must report "push established" (RC-3 (i)) before the worker's window ends; at the bound the relay is stopped and the camera is `CAMERA_NOT_CONNECTED` |
| Development operation | unchanged, 15,000 ms | nothing in it needs more |

The operator is not surprised by an absent camera: presence (the unauthenticated time read) is a pre-check item before the start. The clock-offset read after the opens (`capture-session/index.ts:1143-1153`) stays; it uses the same unauthenticated read.

Must not weaken: "one camera of two is a degraded session, none ends it"; the bound on a microphone start; the rule that a recording never waits for the transcriber.

Tests on this Mac (fixture of WP-03b with a configurable delay before its first keyframe): camera A delays 20 s, camera B none: B is connected in under 5 s and both record. Camera A absent: the session starts with B after one bound, 1 warning, 1 audit entry, A's file absent. Both absent: `FAILED_START`, 0 evidence files. On hardware: `9A/H-21` (time from start to both ingests connected, against the window) and `9A/H-22` (camera absent at start).

---

## 4. F05: the contract mismatches, and how a USB audio input becomes a capture device

**Decision: five mismatches (the review's four and one found in this pass), five answers; none changes a signature. Microphone registration is two new operations: one lists the sound cards, one registers an input.**

### 4.1 The mismatches

| | Mismatch | Evidence | Decision |
|---|---|---|---|
| a | `pullUrl` is synchronous; a locator resolved per open cannot be returned by it | `types.ts:143` | Not changed. It has no caller; the production adapter resolves inside `openSource` (2.3) |
| b | `enumerate()` answers one entry per **registered** microphone; it cannot list cards | `types.ts:180-186,210` | Not changed. Card listing is an extra of the built production registry (`audioCards()`*), by the pattern of `openSources` and `probeAdapters` (`CS/capture/fence/index.ts:160-179`). Fakes and the local adapter are not edited |
| c | No operation registers a microphone | `SCH:231` | Two new operations, 4.2 |
| d | A microphone helper is launched through a `start` member found by duck typing | `capture-session/index.ts:950` | `start?(signal)` becomes a declared optional member of `AudioStreamHandle`; the session's call is unchanged; the `USB_AUDIO` adapter implements it |
| e | `openSource` is not told which profile to pull. One camera may fill both slots with two profiles (`CS/db/schema/capture.ts:148-151`; `REV` P12-N02) | `types.ts:120-123`; `capture-session/index.ts:1131` | `CameraSourceTarget` gains `profile`; the session passes the plan's value (`plan.ts:205`); the production adapter keys an open source by device **and** profile. Fake and local adapters ignore the member |

Also named by the review as missed call sites and placed here: `admit` for a device registered after the boot (`fence/index.ts:305-311`) is implemented by the production registry builder for adopted cameras and registered inputs (WP-13b).

### 4.2 Microphone registration (schema set A)

| Question | Answer |
|---|---|
| Who triggers enumeration | The operator, by a new operation `searchCaptureAudioCards`* (POST, no body). Nothing enumerates in the background; nothing chooses a card (`SPEC` section 5, last row) |
| What it answers | Per card: card id, USB id, product name (bounded, control characters stripped, S13-12 b), device index, native channel count, formats; per input number, the registry id if it is registered. Not stored (the rule of U11 OQ-1 for scan results) |
| Its audit entry | `CAPTURE_DISCOVERY_SEARCHED`, the existing type, with a third scope value `AUDIO_CARDS`* beside `CAMERA_NETWORK` and `MIC_LOCAL` (`CS/core/audit-details.ts:321`) |
| Registration | `registerCaptureAudioInput`*, body: card id, device index, input number. The Core enumerates again itself and takes channel count, USB id and product from **that** listing, never from the body. Refusals: input beyond the card (the new named error of S3-2), a session is open, the Core is not `REAL_PRODUCTION` |
| Where it is stored | One unit: a `capture_devices` row (next `MIC-nn`, the adapter kind written as the literal `USB_AUDIO` in the statement, the rule of `CS/capture/fence/statements.ts:8-10`) and its `capture_audio_inputs` row (`SCH` 2.2). An input that has a row is re-enabled, not duplicated (`SCH:229`) |
| Its audit entry | `CAPTURE_AUDIO_INPUT_CHANGED`, category `DEVICE` (`SCH:231`; `VER` F-04), detail: device id, a change code (`REGISTERED`, `CARD_CHANGED`, `REENABLED`), input number, channel count. No device text |
| Role | `CAPTURE_CONFIG`, held by SUPERVISOR and TECHNICIAN, the permission of camera adoption. Web console only, idle only. The commissioning permission of U10 is for alias, scan and set-IP; a microphone registration changes no network. Controller reading, reversible |
| After the write | the registry admits the device at once (`admit`), so it is assignable without a restart |
| In `SIMULATED` and `REAL_DEVELOPMENT` | both answer `503` with the code the camera search uses when it has no adapter (`development-discovery.ts:28-30`): `USB_AUDIO` is registrable in production only (`kinds.ts:72-76`) |
| Arguments of the helper | The rule "no value read from the database reaches an argument" (`CS/capture/adapters/local/mic-helper-args.ts:20-22`) is **kept**: at `open` the adapter enumerates, matches the stored row to a live card, and builds the arguments from the live listing, as the macOS table does with the device name (`mic-helper-args.ts:9-12`) |

Tests on this Mac: fixed card listings behind the injected enumerator; registration twice of one input yields 1 device; an input beyond the card is refused by name; the unit rolls back as a whole; a session on doubles shows the card facts in `source_facts`. On hardware: `9A/H-07`.

---

## 5. F10 / F11 with RC-1 and S13-05: keyframe gating, and the home of SA-2

**Decision: the relay holds back after every re-open until a keyframe. The home of SA-2 is selected by experiment E-11 through the rule below, written now so that its result needs no further design round.**

### 5.1 Keyframe gating after a reconnect (F10 a)

Fact: the worker drops what precedes a keyframe only at the start of a file (`WRK/ingest.c:631-639`); after a gap it would mux whatever comes first.

Rule for the relay: after every open of the camera leg, the first and each later one, it forwards nothing until it holds the parameter sets and has seen a packet flagged as a keyframe; what it drops it counts and reports as a number. The gap is one fault interval: `CAMERA_LOSS` raised at the loss, cleared at the first forwarded keyframe. Stamps stay arrival stamps (`SPEC` F-1 sub-choice), so the gap is a jump in time inside one track.

- HYPOTHESIS HA-1: the pinned client flags keyframes reliably for H.264 and HEVC over RTSP. Settled in track D by WP-03c: the fixture resumes in the middle of a group of pictures; the recorded file decodes with 0 errors after the gap.
- E-10 is extended as the review asks: the resumed push carries a time jump and does not begin on a keyframe at the camera side. If the worker, the muxer or the Core reader does not accept the jump, WP-11 is triggered.

### 5.2 E-11: what is measured

Run in track D on this Mac, inside WP-01, with the release worker and two pushers, **before WP-03 starts** (C11). Three observations, 2 runs each:

| Obs. | Push | Recorded as |
|---|---|---|
| O-1 | to another path than the plan's, before any other | REFUSED (no `ingest_connected`, 0 bytes in any file) or ACCEPTED |
| O-2 | to the right path from a second client after the first is connected | REFUSED or ACCEPTED |
| O-3 | to the right path after a wrong-path push was turned away | CONNECTS inside the window, or the listener is consumed |

If O-1 is ACCEPTED, one more step, **E-11b** (track D, WP-01, a read of the installed library's public headers and a probe program of a few lines): can the worker read the path a client announced, through the public interface of libavformat 63.1.102, **before** it probes the stream? READABLE or NOT READABLE. Row 12's HR-1 expects NOT READABLE; row 13's HS-3 expects O-1 ACCEPTED.

### 5.3 The decision rule

| Branch | Selected when | Home of SA-2 | The worker | Packages |
|---|---|---|---|---|
| **A** | O-1 REFUSED and O-2 REFUSED | The Core alone: the plan's ingest address carries, in place of today's predictable path (`capture-session/index.ts:1056`), a 128-bit random element per session attempt and per track, in the characters the worker's grammar admits (`WRK/capture_worker.c:110-126`; `PROTO:508`). RC-2 holds it out of every log, audit detail, row, error and file | **unchanged** | WP-06b |
| **B** | O-1 or O-2 ACCEPTED, and E-11b READABLE | The worker compares the announced path with the plan's before it probes; a foreign push never reaches `ingest_connected`. The secret is built as in A | **changed**: new sub-package WP-11b; "unchanged worker" no longer holds; worker version step (`CS/capture/boot/checks.ts:285`); its whole suite and kill matrix run again | WP-06b, WP-11b (S to M) |
| **C** | O-1 or O-2 ACCEPTED, and E-11b NOT READABLE | RC-1 cannot be met. **The worker pulls** (U12 A3). No listener exists, so SA-2, SA-3 and RC-1 to RC-5 fall away for cameras | **changed deeply** | see 5.4 |

O-3 selects nothing. If the listener is consumed by a wrong-path push, a local process can deny one camera to one session: a detected fault, covered on the host by RC-5. It is recorded as a residual for the security review.

Considered and not chosen for branch C: binding the relay to a source port named in the plan and having the worker compare the peer of its own socket. A port is 16 bits, RC-2 asks for 128, and row 13 named the two forms it accepts (`SEC:155`). A third form would need its own review.

**SA-3 in branches A and B (RC-3).** A camera counts as open only when (i) its own relay reports that the worker answered its record request, and (ii) the worker's connect report for that port arrives within 5,000 ms of it, in either order (HYPOTHESIS HA-9 for the value). One without the other is a capture fault with an audit entry. The capture protocol has no frame that drops one camera of a running session (search of `PROTO` for such a frame: none), so the fault **ends the capture of that session**; nothing of it is sealed as that camera. No worker change is made for this.

### 5.4 Cost of branch C, stated now

| Item | Consequence | Evidence |
|---|---|---|
| Protocol | The plan's camera gains an input union; the version rises above 4; the plan builder and its tests follow | `PROTO:508-535`; `SPEC` F-1 table |
| Credential | It travels in the worker's plan frame on standard input (never an argument). The process that writes both evidence files holds it and parses the camera network | `SPEC:294` |
| Worker rules | "Listens on loopback, never dials out" (D82) is lost and needs an amending row; the socket check must admit one outbound TCP socket per camera; S13-01 and S13-02 apply to the worker | `WRK/ingest.c:94-109,481-490` |
| Reconnect and gating | Move into the worker: WP-11 becomes mandatory, not conditional | `WRK/ingest.c:540` |
| Timing | The worker anchors on the camera's own clock and refuses one outside 2,000 ms. The arrival-stamp choice of fork F-1 must be decided again, or cameras need their clocks set, which is class C | `WRK/ingest.c:583-589` |
| Fault isolation | A malformed stream ends the session's one worker, not one relay | `SPEC:295` |
| Packages | WP-03a is not built (WP-03b, the fixture, still is); WP-03c merges into WP-11; WP-06b loses SA-2 and SA-3; WP-02 stays for the microphone helper | - |
| Review | Row 13 rated variant A. Variant B is acceptable to it in principle (`SEC:155`) but its credential path was not rated: a security review of the changed worker precedes the lift | `SEC` 4.4 |
| Time | Estimate, not a commitment: 3 to 5 working days more in track D | sizes of `SPEC` F-1: M in the worker plus M in protocol and plan builder, plus the worker's re-verification |

Must not weaken, in every branch: "a push that the Core did not start is never sealed as a camera" (SEC35-40); the worker's loopback-only listener in A and B; rule A-2.

Tests on this Mac: E-11 and E-11b as above. Branch A or B: the plan's check "a foreign push ends the track as a fault" in both orders (foreign first, relay first); the search for the secret of a test session in the log sink, the audit table and the session tables: 0 hits. Branch C: E-12 against the worker.

---

## 6. F01 / F02: building and testing the openers before the lift; WP-13

**Decision: the production adapters are built in new files beside the two stubs and are registered nowhere until the lift. Phases 3 and 4 close on adapter-level checks. The first session through registry, fence, plan builder, seal and verification is a named step of WP-13, which is size M and is split in three.**

### 6.1 Facts

| # | Fact | Evidence |
|---|---|---|
| 1 | The registry refuses an adapter that states an opener for a kind outside one module constant, and the session-source builder refuses it again. There is no injection point, and the comment forbids making one | `CS/capture/adapters/registry.ts:29-36,82`; `CS/capture/fence/sources.ts:86,106` |
| 2 | Rule A-1 names three files: they may import three vocabulary files only, must state no opener, and are named by the loader alone | `CS/capture/adapters/__tests__/static.test.ts:36-48,95-101` |
| 3 | The production registry is empty and its loader takes device entries only | `CS/capture/fence/index.ts:326-329`; `CS/capture/adapters/real.ts:17-37` |
| 4 | The development registry shows what a built registry must supply: open sources, probe adapters, admission after boot, close | `fence/index.ts:160-179,289-316` |
| 5 | In production the boot outcome carries no device list | `CS/capture/fence/boot.ts:262-270` |

### 6.2 Options and choice

| | Rewrite rule A-1 in phase 3 | New files, stubs untouched (chosen) | A test-only switch for the list |
|---|---|---|---|
| Rule A-1 before the lift | changes meaning twice | unchanged and green | unchanged |
| The stubs | replaced early; `REAL_PRODUCTION` would load built code before L-2 | stay until the lift | stay |
| Verdict | the lift's content leaks into phase 3 | **chosen** | forbidden by fact 1 |

### 6.3 Before the lift: what closes phases 3 and 4

| Check | Runs | Proves |
|---|---|---|
| T-1 unit | the adapter with a door double and a fake ONVIF session | the order of 2.3, the bounds of section 3, the codes |
| T-2 adapter level | the real relay, the real release worker driven by its own harness, the fixture camera of WP-03b, the fake ONVIF stub; for audio the real helper with a generated multi-channel source in place of the device, through the channel selection, the pipe and the worker (`REV` P12-F13) | a decodable file with the expected frames; no registry, no fence, no session |
| T-3 behind the rule | the built adapter handed to a real registry | **refused** `CAPTURE_ADAPTER_INVALID` (fact 1): the rule still guards while the adapters exist |
| T-4 Linux container | worker, relay and guard build against the pinned library on Ubuntu 24.04; the Linux helper argument list is parsed against an ALSA `null` or `file` device (`REV` P12-F12, P12-F13) | the build and the option parsing, not the device |

The plan's sentences "in a test registry a session on fakes records through the relay" (`PLAN:331`) and its twin for audio (`PLAN:355`) are replaced by T-1 to T-3.

### 6.4 After the lift: WP-13, size M, in three parts

| Part | Content | Size | One check |
|---|---|---|---|
| **WP-13a** | The unassigned selector (1.4 #2 to #6). No dependency on the adapters; may land early | M | the 21-state table of 1.5 passes; the fence's files are unchanged |
| **WP-13b** | The production registry builder and the new loader signature: `loadProductionAdapters(operation, devices, deps)`, `deps` holding the door, the program paths, the run directory, timers, the clock, the credential reader, the ONVIF session factory, the card enumerator and the loss callbacks. The builder reads the stored devices itself (fact 5), supplies everything of fact 4 plus `audioCards()`, and registers the search and test half (`SPEC` S2-1). Still **not called by the boot** | M | built against a clone with production rows it lists the expected devices; calling it for another operation is refused before any import (`real.ts:30`) |
| **WP-13c** | The lift itself, one change set: the list; the stubs replaced; the boot calls the builder; 1.4 #7; the pins of `SPEC` 6.3 row by row; rule A-1 rewritten; decision row AM-1; evidence specification H.5 (S13-17); the erratum of 2.5. **And the first full session**, by 1.6 | M | each pin row in its end state; 1 session from four production-kind sources on doubles recorded, sealed and verified, one of them HEVC (this is what L-4 needs from E-8, `VER` F-05); a `REAL_DEVELOPMENT` suite with 0 changed results; `SNMP_POE` with an opener still refused |

Entry of WP-13c: L-1 to L-5 as the plan has them, with L-2 reading "the branch E-11 selected is built and its checks pass" and L-4 reading "E-8's sealing and verification half is part of WP-13c's check".

Must not weaken: fact 1 until the change set of WP-13c; "the loader refuses another operation before the import"; "lift both kinds together".

---

## 7. F08: HEVC against the sealed notice `STREAM_PROFILE_DIFFERS`

**Decision: the profile code of a production stream is the stream's own statement, formed by the function the seal already uses, from what the stream test read. The sealed rule is not edited. An H.265 camera that reports H264 over ONVIF then carries the code `HEVC_1080P`, and the notice is not due.**

### 7.1 Facts

| # | Fact | Evidence |
|---|---|---|
| 1 | The seal states a stream as `<codec>_<picture><rate>`, without a rate when the Core read none | `CS/sealing-host/session-reader.ts:238-250` |
| 2 | The notice is due when: the stream declares a whole rate and its text is not the configured code; or it declares none and the configured code does not begin with the stream's text followed by digits only | `session-reader.ts:253-265` |
| 3 | For HEVC the Core reads no rate | `CS/capture/fragments.ts:541-546,698-705` |
| 4 | Today's connection test reads the encoding from the ONVIF answer and filters to H.264; the four bench cameras report H264 and deliver H.265 | `CS/capture/adapters/camera/onvif-session.ts:222,491-492`; `SPEC:337` |
| 5 | The camera slice states `1080p`, `25` and `H.264` as literals | `SHARED/api/state-slices.ts:526-528` |
| 6 | As designed, a stream row is unique per device, lens and role, and its key columns cannot be updated | `SCH:202,204` |

Consequence of 2 to 4 under the plan as written: a production H.265 camera adopted with a code from its ONVIF answer (`H264_...`) would carry the notice in every session.

### 7.2 Options and choice

| | a. The code is the stream statement (chosen) | b. Amend the notice rule | c. Read the HEVC rate only |
|---|---|---|---|
| Sealed rule | unchanged; "sealing unchanged" (`SPEC:563`) holds | changed: an evidence-specification change, and the clients' verify rule may recompute it (NOT VERIFIED) | unchanged |
| Solves codec H264 against HEVC | yes | yes | no |
| Cost | the code is minted by the stream test, so the order of WP-04 and WP-05 changes | a change to what a sealed package means | none of the problem |

Chosen: **a.**

| Rule | Statement |
|---|---|
| Minting | The stream test (WP-05) forms the code with `streamProfileOf` (fact 1) from the codec, the picture size and the parameter-set bytes the relay's probe mode reports. The rate is computed by the reader's own function on those bytes (`fragments.ts:702-705`), so the two cannot disagree by construction. No rate is written that this function did not yield |
| HEVC | `HEVC_1080P`, no rate (fact 3). By fact 2 the notice is not due |
| The ONVIF answer | advice for the screen only; never the code, never `capture_device_streams.codec` |
| Order | WP-04 reads tokens, sources and sizes and mints nothing. The code is written at adoption, which already follows a passed test (D76 (3)). This removes the order fault of `REV` P12-F08 |
| A stream that changed | A new test mints a new code; the selector still holds the old one; the pre-check blocks with "test the camera again and assign"; a session started anyway carries the notice, which is what the notice is for |
| Schema set A, as a requirement on WP-24 | The unique constraint on device, lens and role (fact 6) becomes a plain index: after the ruled H.264 fallback (U12 A4) the same lens and role gets a second statement, and its key cannot be updated. "Usable now" stays the list in `capture_devices.profiles` |
| Limit LA-3 | Two streams of one camera with the same statement cannot both be codes (the selector's CHECK needs two distinct codes for one camera, `capture.ts:148-151`; the rule of fact 2 admits no suffix). A dual-lens camera whose lenses deliver the same format fills one slot only. No bench camera is dual-lens (`SPEC` section 2). Lifting it is an evidence-specification change, not planned |
| If WP-10a later reads the HEVC rate | every HEVC code minted before it lacks the rate and the notice becomes due (fact 2, first case). So WP-10a lands before the first production adoption, or every adopted HEVC camera is tested again |

HYPOTHESIS HA-2: the picture size the relay's probe reports equals the size in the sample entry the worker's muxer writes (same library, same stream). HYPOTHESIS HA-3: the parameter-set bytes of the probe are the ones that end in the file's `avcC`. Both settled in track D by WP-05's check: for the H.264 and the HEVC fixture the minted code is compared with the statement of the sealed file, and the notice is absent; on hardware by `9A/H-17` (criterion added: the notice is not raised).

### 7.3 The other H.264 assumptions (`REV` section 5)

| Rows | Decision | Carried by |
|---|---|---|
| 1, 7, 8 | Codec judged from the stream; wording "usable profile"; `NOT_H264` stays for a stream that is neither | WP-05 |
| 5, 6 | The camera slice states the stream's facts in place of three literals. A wire change of a frozen slice and both clients; required before stage 2, because an evidence console must not state `H.264` for an H.265 camera | **WP-10b** (M), not conditional |
| 3 | HEVC rate in the reader | **WP-10a**, conditional as planned, with the order rule above |
| 10 | Playback: E-8 on this Mac, `9A/H-20` on real material; HYPOTHESIS HA-14 (`hev1` in the operator's browser) | WP-01, WP-15 |

Must not weaken: "a manifest states what the stream is, never what somebody configured" (`fragments.ts:536-540`); the copy-only rule.

---

## 8. Splits of the L-size packages, and the single-writer files

Parent numbers are kept. Every part is S or M and has one check. Paths of new files are proposed names.

### 8.1 Splits

| Part | Content | Size | One check |
|---|---|---|---|
| **WP-03b** (first) | Test support: a pull-side RTSP camera on loopback with Digest authentication, a Basic-challenge mode, H.264 and HEVC, parameter sets in the description or in band, a delay before the first keyframe, a drop and a resume in mid group, an account with special characters | M | each mode answers a reference client as stated; it binds `127.0.0.1` only and no port of 8554 to 8564 |
| **WP-03a** | Relay, record mode: start message, pull over TCP, video only, push; Digest only (S13-01); hygiene S13-02 a, c, d; sockets of RC-6; the library pin at build and at start | M | T-2 of 6.3 for one camera; 0 `Authorization: Basic` requests |
| **WP-03c** | Relay: reconnect by the retry rule, keyframe gating (5.1), probe mode, the "push established" report | M | the fixture drops and resumes in mid group: one file, 0 decode errors after the gap |
| **WP-03d** | E-12 extended (S13-02 g); the special-character account | S | 0 occurrences in every place named |
| **WP-06a** | Reveal module, credential reader, audit, static rules (2.3 steps 1, 2) | S | the reader's two tests of 2.6 |
| **WP-06b** | The camera adapter in a new file: `openSource`, the profile member, SA-2 by the selected branch, SA-3, parallel open and the window (section 3) | M | the three timing tests of section 3; a foreign push in both orders |
| **WP-06c** | Loss callback, presence and clock offset by the unauthenticated read (no socket module, `REV` section 4, G-R2), audit writers for camera loss and unreachable | M | a killed fixture raises 1 fault and clears 1; 0 reveals for presence |
| **WP-07a** | Card listing parser and enumerator seam, identity, "input beyond the card" | M | fixed listings give the expected cards; no automatic choice exists |
| **WP-07b** | Contract package: the two operations of 4.2, schemas, simulator answers, description; the operation-count pins | S | every count pin passes at 99; no live path yet |
| **WP-07c** | Live path: the registration unit, `admit`, session source facts | M | the registration tests of 4.2 |
| **WP-07d** | Web console: card list, register an input | S | the screen lists the fixture cards and registers one |
| **WP-19a** | The helper as a file, with the nine self-enforced bounds of S13-08; tool paths as constants; the test copy made by a build step (S13-16 (1)) | M | 9 refusals of 9; the delivered file's hash test |
| **WP-19b** | The Core's one caller; the wrong-network guard; alias lifecycle at job end, shutdown and boot; intent and result audit (S13-10); the interface-file mismatch refusal (`VER` F-07) | M | against the helper double: 1 intent and 1 result entry per action; a marked address without a row is swept |
| **WP-19c** | The scan operation with the shared target function of S13-11 | M | the target table test; the same cases refused with 0 packets |
| **WP-19d** | Read and write of `capture_network_config`, audit `CAPTURE_NETWORK_CONFIG_CHANGED` (`VER` F-04) | S | a change writes 1 entry naming the changed fields |
| **WP-22a** | The set-network file: the four ONVIF calls, parse and exception guards (S13-12), the type declaration | M | malformed, oversized and markup-token replies: the Core stays up, the request is well-formed |
| **WP-22b** | The job: credential in the closure (C7), unauthenticated poll first (S13-04), wait by MAC, next free address, refusal on the conflict flag, lock-out | M | against the stub: same MAC at the new address; at most 3 authenticated reads; 0 credential occurrences |
| **WP-22c** | Web console screens: target address, MAC from the neighbour table, MAC after authentication (S13-12 d) | M | a mismatch stops the job on the screen |
| **WP-13a, b, c** | section 6.4 | M each | section 6.4 |
| **WP-10a, WP-10b** | section 7.3 | S to M, M | E-1 and E-8 repeated; the slice states the fixture's facts |
| **WP-11b** | only in branch B (5.3) | S to M | a wrong-path push never reaches `ingest_connected` |
| **WP-23a** | Audit vocabulary of the whole plan, in one change set ahead of its consumers | S | the writer accepts each type and rejects a foreign detail key |
| **WP-23b** | Contract package of the commissioning operations (configuration read and write, scan, alias removal, set camera network, job state): entries, schemas, simulator answers | S to M | count pins pass at the new number |
| **WP-23c** | The commissioning permission: vocabulary and the two stored rows together, **in the commit of schema set B** (`REV` P12-F07) | S | a migrated demo database boots; the permission is held by 1 role |
| **WP-26a, WP-26b** | The table; the acceptance and revocation operations with their audit entries (C2), key list and size bound for `steps` and `diagnostics` (S13-13) | S, S to M | a second acceptance in force is refused; a forbidden key is refused |
| **WP-02** (not split, one addition) | The production door, and a small guard program that ends its child when its own standard input ends, so that the FFmpeg helper of a microphone follows the same liveness rule as the relay on macOS and Linux. HYPOTHESIS HA-11: the FFmpeg program does not end by itself when its standard input ends; E-7 runs once without the guard to show whether it is needed | S | E-7: 0 surviving children after the Core is killed, relay and helper |

### 8.2 Single-writer files: one writer per wave

| File set | Lines | Writers, in this order | Rule |
|---|---|---|---|
| Audit vocabulary | `SHARED/sim/vocabulary.ts:346-435` and its category map; `CS/core/audit-details.ts`; `CS/db/fixtures/operations.ts:487`; `CS/core/__tests__/writers.test.ts:54`; `CS/db/fixtures/__tests__/audit-details.test.ts:149,272,285` | **WP-23a only** | all ten new types land at once (67 to 77): input changed; network configuration changed; alias added, removed, removal failed; factory scan; camera network set; device address changed; installation accepted, acceptance revoked. WP-07, WP-12, WP-19, WP-22, WP-26 write none |
| Operation pins (97) | `CS/plugins/permission-guard/__tests__/guard.test.ts:251`; `access-rules.test.ts:65,67`; `apps/core-web/src/test/live-api-reference-page.test.tsx:133,303`; `live-api-reference-document.test.tsx:146,238`; `SHARED/sim/api.ts:767`; the frozen unit list of `app.ts` | WP-07b, then WP-23b, then WP-26b | never two in one wave; each lands before its live path (the rule of D106). WP-12 and WP-13a change a body, not the count |
| Value sets (44) | `apps/core-server/test/db/contract-inventory.test.ts:265,315`; `CS/db/schema/value-sets.ts` | WP-24, then WP-25 | the migration writer's |
| Schema version, migrations | `CS/db/schema/meta.ts:38,40`; the migrations folder and its tag list; the pins of `SCH` 3.4 | WP-24, WP-25, WP-26a, strictly in this order | one migration writer (`CS/db/schema/index.ts:26-28`); each set its own commit (C9) |
| Permissions (14) | `CS/modules/capture-config/__tests__/slices.test.ts:229`; `CS/plugins/permission-guard/matrix.ts:167`; `rbac-boot-equality.test.ts:14-19,89` | WP-23c inside WP-25's commit | vocabulary and rows never apart |
| Static rules of the capture unit | `CS/capture/__tests__/static.test.ts` (G-R1, G-R2, G-R8 to G-R14, the `config.ts` hash at `:548-560`) | one package per wave; first WP-02 | each package names its rule and "amended by a decision row" or "code shaped to keep it" (`REV` P12-F04; 8.3) |
| Static rules of the adapter layer | `CS/capture/adapters/__tests__/static.test.ts` | WP-06a (injection pin), then WP-13c (A-1) | - |
| Adapter contract | `CS/capture/adapters/types.ts` | WP-06b (`profile`), then WP-07a (`start`, the new error code) | - |
| Session start | `CS/capture-session/index.ts` | WP-06b, then WP-13c | 1,432 lines, one writer at a time |
| Fence wiring | `CS/capture/fence/index.ts` | WP-13b, then WP-13c | `boot.ts`, `operation.ts`: **no writer** |
| Configuration keys | `CS/config.ts` | WP-02 (relay and guard paths), then WP-08, then WP-19b | each key moves the hash pin |

### 8.3 The static rules the review lists, each decided

| Rule | Hit by | Decision |
|---|---|---|
| G-R1 (modules start no process, open no socket) | WP-19, WP-22, WP-20 | **kept**: commissioning code lives under `src/capture/` behind a door; modules hold routes only |
| G-R2, G-R8 (exact lists of process and file-system importers) | WP-02, WP-08, WP-07a | **amended by list**: + the production door, + the ALSA configuration writer, + the card listing reader; one decision row |
| G-R2, G-R10 (no socket module under `capture/`) | WP-06c | **kept**: presence uses the ONVIF time read |
| G-R9 (one datagram socket, one destination) | WP-12, WP-19c | **amended**: the unicast probe to a validated address, in the same one file; decision row with AM-3 |
| G-R10, G-R11 (one importer of the `onvif` package; five reads) | WP-22a, WP-04 | **amended**: a second importer, the set-network file, with its four calls declared; the connection file keeps "no configuration call" |
| G-R12 (helper arguments: literals, no vertical bar, five formats) | WP-08, WP-19b | **amended narrowly**: the format list gains `alsa`; the bar is admitted in exactly one argument made by one table function from an integer 0 to 63. Reason: U2 makes the tested `pan` text the default. `sudo` arguments are literals plus one validated address |
| G-R13 (`discover` called from one file) | WP-19c | **kept**: the scan has its own probe call, not `discover` |
| G-R14 (no maker's name in the adapter layer or the fence) | WP-19 | **kept**: the factory list is data in `capture_network_config`, without names |
| `config.ts` hash, `app.ts` unit list | every new key and module | **amended per package**, single writer (8.2) |
| A-1 | WP-13c | rewritten at the lift only (section 6) |

---

## 9. Requirements table for the implementation blueprint

One line per finding. "Check" is the acceptance check the blueprint carries. Nothing is without a home; what needs the user is repeated in section 10.

### 9.1 Blocking gaps (row 12)

| Id | Carried by | Acceptance check |
|---|---|---|
| P12-B1 | WP-24 (nullability), WP-13a, WP-13c; WP-27 (order of 9A) | The 21 states of 1.5; fence files unchanged; a seeded clone reaches a production boot through the sequence of 1.4 |
| P12-B2 | WP-06a, WP-06b, WP-02, WP-03a | The static and runtime tests of 2.6 |

### 9.2 Technical review (row 12)

| Id | Carried by | Acceptance check |
|---|---|---|
| P12-F01 | Phases 3 and 4 reworded; WP-13c | T-1 to T-3 close the phases; the first full session is WP-13c's |
| P12-F02 | WP-13a, b, c | section 6.4, one check each |
| P12-F03 | WP-06b; WP-27 | the three timing tests; `9A/H-21`, `9A/H-22` |
| P12-F04 | every package of 8.3 | each rule row of 8.3 in its stated end state |
| P12-F05 | WP-06b (a, e), WP-13b (b), WP-07b, c (c), WP-07a with WP-08 (d) | section 4 tests |
| P12-F06 | WP-07b, WP-23b, WP-26b | count pins pass after each; every new operation has a stated `SIMULATED` answer |
| P12-F07 | WP-23c in WP-25's commit | a migrated demo database boots with the new permission |
| P12-F08 | WP-05, WP-24 (index), WP-10a, WP-10b | the minted code equals the sealed statement for both fixtures; the notice is absent |
| P12-F09 | section 8.1 | every part S or M with one check |
| P12-F10 | WP-03a (b, c, d), WP-03c (a) | sections 2.5, 5.1 |
| P12-F11 | WP-01 (E-11, E-11b); WP-06b or WP-11b or branch C | the branch of 5.3 is selected by the recorded observations, with a log entry |
| P12-F12 | WP-14 (container build **required**, not "if available"); WP-02 (leftover check reads the program path, HA-12); WP-14, WP-20 (the `arping` package named, HA-13) | T-4 of 6.3; `9A/H-24`, `9A/H-25` |
| P12-F13 | WP-08 | the two real-code checks of T-2 and T-4 |
| P12-F14 | WP-27 | section 9.6 |
| P12-F15 | WP-23a | 8.2, first row |
| P12-F16 | Phase 0 (the baseline exists, C6); WP-24, WP-25 (value-set count; tests under `apps/core-server/test/db/`) | the pin passes at its re-measured value |

### 9.3 Verification (row 11)

| Id | Carried by | Acceptance check |
|---|---|---|
| F-01 | Blueprint: one governing package table; section 11 lists what is superseded | no package has two definitions |
| F-02 | WP-26b | accept and revoke exist with one audit entry each; who may accept: the commissioning permission, web console, idle (proposed; the gate question is section 10, item 6) |
| F-03 | WP-22b; C7 | the credential is absent after the job on every exit path |
| F-04 | WP-23a (types), WP-19d and WP-07c (writers) | each change writes 1 entry |
| F-05 | WP-01 (E-1 recorded as "worker part"), WP-13c | a sealed and verified HEVC session before the lift closes |
| F-06 | WP-27 | precondition before `9A/H-01`: no input-av service, helper, sudoers line or ALSA generator on the host (`9A/H-27`) |
| F-07 | WP-19b, WP-27 | a difference between the root-owned file and the row is a named refusal; one line in `9A/H-05` |
| F-08 | C8; WP-27 | the acceptance host's database is migrated by the user, a step of the procedure |
| F-09 | C9 | each set is its own commit |
| F-10 | Blueprint | hardware checks carry a prefix of their own |
| F-11 | C10; WP-12 | the typed probe has the search's permission, web console only |
| F-12 | WP-25 | the defaults are described as input-av's defaults, untested |

### 9.4 Security (row 13)

| Id | Carried by | Acceptance check |
|---|---|---|
| S13-01 | WP-03a; WP-03c for probe mode | 0 `Authorization: Basic` requests, 2 runs each mode. If the library cannot be held to it: stop, the user decides (section 10, item 4) |
| S13-02 | WP-02, WP-03a, WP-03d, WP-20 | the seven points of 2.5 |
| S13-03 | WP-14 (dedicated port, forwarding off, checked at boot by WP-20); WP-27 (password rule) | **the user's acceptance before stage 2** (section 10, item 2) |
| S13-04 | WP-22b; WP-05 (a refused RTSP authentication counts) | at most 3 authenticated reads per job; the guard counts the fourth operation |
| S13-05 | WP-01 (E-11), then 5.3 | = RC-1, RC-2 |
| S13-06 | WP-06b; WP-11 if built | = RC-3, RC-4 |
| S13-07 | WP-14, WP-20, WP-03a | = RC-5, RC-6 |
| S13-08 | WP-19a | 9 refusals of 9; one journal line per call |
| S13-09 | WP-14 with WP-19b | a decision row before WP-19b closes: a root service on a local socket is the first choice; `sudo -n` only with a written reason. Controller's row; the user installs either (section 10, item 5) |
| S13-10 | WP-19b, WP-23a | intent and result entries; the boot sweep; a root-scheduled removal if the design's hypothesis H-S fails |
| S13-11 | WP-19c (the one function), WP-22b, WP-12 | the table test; each operation refuses the same cases with 0 packets; DHCP mode not carried |
| S13-12 | WP-19c, WP-22a, WP-22c | device text reaches no log, audit detail or error; the malformed-reply tests |
| S13-13 | WP-26b; WP-24 for device text in `source_facts` | a forbidden key and an oversized body are refused |
| S13-14 | C12 (in force); phase 0; WP-21 brought forward | `git check-ignore -v apps/input-av/data` names the local exclude file; staged paths under `apps/input-av/` per commit: 0. **The move is the user's** (section 10, item 1) |
| S13-15 | WP-27 (procedure), WP-15 (condition of stage 2) | per camera, a recorded "password changed before adoption", without the value |
| S13-16 | WP-19a (1), WP-03b (2: one synthetic account constant), phase 0 (3: two more scan needles), WP-27 (4, 5, 6) | each of its six points has a line in the named package |
| S13-17 | WP-13c | section H.5 states the guard; the word "declared" stays |
| RC-1 | WP-01, gate before WP-03a | E-11 recorded; branch selected |
| RC-2 | WP-06b | 128 bits; 0 hits in logs, audit and tables |
| RC-3 | WP-06b | 5.3, SA-3; both orders |
| RC-4 | WP-11, only if built | a foreign client in the gap is a fault |
| RC-5 | WP-14, WP-20 | fixture test in track D; `9A/H-01` on the host |
| RC-6 | WP-03a, WP-14, WP-20 | socket snapshot of the relay: 0 listening, 0 datagram; run directory 0700, pipes 0600 |

### 9.5 Controller readings

| Id | Carried by | Acceptance check |
|---|---|---|
| C1, C7 | WP-22b | 2.5; S13-04 (b) |
| C2 | WP-26a, WP-26b | the package is table, operation and audit entry |
| C8 | WP-24, 25, 26a; WP-27 | migrations run on this Mac's PostgreSQL only |
| C9 | every schema package | one commit per set |
| C10 | WP-12 | F-11's check |
| C11 | WP-01, 5.3 | RC-1 as a gate |
| C12 | phase 0; every agent | S13-14's check |

Count: 2 + 16 + 12 + 23 + 7 = 60 lines carry 2 + 16 + 12 + 17 + 6 + 8 = 61 identifiers (C1 and C7 share a line). Identifiers without a package or without a check: 0.

### 9.6 Additions to the hardware acceptance test package (WP-27)

Order of 9A changes with P12-B1: the production boot no longer waits for cameras. New order: host checks (H-01 to H-04, after `9A/H-27`); X-1, X-2 and the unassign step; **H-16** (a production boot on an unassigned selector, with its session start refused: both are pass criteria); helper (H-05, H-06); microphones (H-07, H-08); network functions (H-12 to H-15); cameras (H-10, H-11); **H-09 is folded into H-17**: one camera cannot be recorded alone through the product (`plan.ts:124`), so its readings are taken from the session of four sources.

| Check | Proves | Pass criterion |
|---|---|---|
| `9A/H-21` | time from start to both ingests connected (HA-8) | both inside the 30 s window; the figure recorded |
| `9A/H-22` | a camera absent at start (LA-2) | the session starts with the other; 1 warning; the absent one is not in the package |
| `9A/H-23` | an account with special characters (HA-7) | authenticated; 0 credential occurrences in any log |
| `9A/H-24` | leftover processes after a killed Core on Linux (HA-11, HA-12) | 0 after the kill; a planted leftover is named at boot |
| `9A/H-25` | the `arping` package (HA-13) | the conflict check refuses a taken address |
| `9A/H-26` | H-17 extended: `STREAM_PROFILE_DIFFERS` (HA-2, HA-3) | not raised for the H.265 cameras |
| `9A/H-27` | TC-1 (`VER` F-06) | no input-av service, helper, sudoers line or generator on the host |

---

## 10. For the user

None of these stops the autonomous work of track D (U12 B2, U14) except item 4, and only if its condition occurs.

| # | Matter | Needed by | From |
|---|---|---|---|
| 1 | **Move `apps/input-av/data/` out of the repository** to a folder of mode 0700, or confirm in writing that it stays. C12 protects it against this task's git work only | now; asked once | S13-14 (d), WP-21 |
| 2 | **Accept, or refuse, digest authentication over plain HTTP and RTSP on the production camera LAN** | before stage 2 | S13-03 |
| 3 | **What the bench input-av may do after stage 2** | with the stage 2 ruling | `VER` N-02 |
| 4 | Only if the pinned library cannot be held to "Digest only": a patch to the pinned build, or a written acceptance of Basic for one named camera model. The work on the relay stops until then | when WP-03a reports it | S13-01 (c) |
| 5 | Installation of the privileged helper in the form the controller's row chooses (root service or `sudo`) | track H | U12 B5; S13-09 |
| 6 | Whether recording is refused while no installation acceptance is in force. Default taken here: **no gate** | any time; a gate is a new ruling | `VER` F-02 |
| 7 | X-1 (production signing key) and X-2 (operators without the demonstration password) remain yours. X-2 has no tool: the path of 1.4 assumes a seeded database whose operator credentials were replaced | before `9A/H-16` | `checks.ts:30-34` |
| 8 | Per camera: change its password in the camera before it is adopted by a production Core | before stage 2 | S13-15 |
| 9 | The acceptance host carries no input-av installation | before `9A/H-01` | `VER` F-06 |

For information, no action: if E-11 selects branch C, the fallback you ruled in U12 A3 applies, with the cost of 5.4. Limits LA-1 to LA-3 are part of the stage 2 summary.

---

## 11. What this addendum supersedes, without editing

| Erratum | Document, place | Was | Is |
|---|---|---|---|
| E-A1 | `SCH` 3.3 "Existing rows" | no existing column changes nullability | six columns of `capture_config` become nullable, in set A (1.4 #1) |
| E-A2 | `SPEC:226`; `CS/capture/adapters/credential.ts:9-10` (at the lift) | the credential is "never URL"; "nothing composes the user-part form" | no process but the relay holds it; the Core composes none (2.5) |
| E-A3 | `SCH:202` | unique on device, lens, role | a plain index (7.2) |
| E-A4 | `SPEC` S1-4, S1-7; `PLAN:303` | `pullUrl` returns the locator per open; `openSource` "builds the start message" from a credential it is never given | 2.3 |
| E-A5 | `SPEC` S1-8 | presence by TCP reachability | the unauthenticated ONVIF time read (8.3) |
| E-A6 | `PLAN:331,355` | phases 3 and 4 close on a session in a test registry | 6.3 |
| E-A7 | `PLAN:586`, `SPEC:522` | WP-13 size S | M, three parts (6.4) |
| E-A8 | `PLAN:539,551`; 9A | H-16 late; H-09 records one camera | 9.6 |
| E-A9 | `SPEC:310`, `PLAN:277` | SA-2 "future work in WP-06" | the rule of 5.3 |
| E-A10 | `PLAN:298`; WP-04 | WP-04 fixes the code form | the stream test mints it (7.2) |
| E-A11 | `PLAN:227,365` | a Linux container "if available" | required for T-4 (9.2, P12-F12) |

Effect on the estimate of C5 (an estimate, not a commitment): WP-13a, WP-10b, the contract packages and E-11b add about 3 to 4 working days to track D in branches A and B; branch C adds the 3 to 5 days of 5.4 on top.

---

## 12. Hypotheses, and what was not verified

| Id | Statement | Settled by | Where |
|---|---|---|---|
| HA-1 | The pinned RTSP client flags keyframes reliably for H.264 and HEVC | WP-03c, resume in mid group | track D; `9A/H-11` |
| HA-2 | The probe's picture size equals the sample entry's | WP-05 comparison on two fixtures | track D; `9A/H-26` |
| HA-3 | The probe's parameter sets are those of the file's `avcC` | same | track D; `9A/H-26` |
| HA-4 | The pinned client answers a Basic challenge (row 13's HS-1) | S13-01 (b) | track D |
| HA-5 | The worker's listener does not compare the path (HS-3; the design's H-I) | E-11 | track D |
| HA-6 | The announced path is not readable through the public interface (row 12's HR-1) | E-11b | track D |
| HA-7 | The client decodes a percent-encoded user part before the digest | WP-03d | track D; `9A/H-23` |
| HA-8 | 30 s is enough for a real camera to reach "connected" | - | `9A/H-21`, hardware only |
| HA-9 | The relay's report and the worker's connect report lie within 5 s | WP-06b on doubles | track D; `9A/H-17` |
| HA-10 | Core-dump limit 0, "not dumpable" and giving up the right to gain privileges are available to the relay on Ubuntu 24.04 | the container build (T-4) for the calls; the host for the effect | track D; `9A/H-01` |
| HA-11 | The FFmpeg program does not end when its standard input ends; an end of the Core closes the pipe on both systems | E-7, with and without the guard | track D (macOS and container); `9A/H-02`, `9A/H-24` |
| HA-12 | On Linux the process table's `comm` is a short name (HR-3) | the container | track D; `9A/H-24` |
| HA-13 | Ubuntu 24.04 packages FFmpeg 6.1 and two `arping` variants (HR-2, HR-4) | the container build | track D; `9A/H-25` |
| HA-14 | The operator's browser plays `hev1` (HR-5) | E-8 | track D for this Mac's browsers; `9A/H-20` |

The design's own hypotheses (H-F to H-W, H-DB-n) and rows 12 and 13's (HR-n, HS-n) keep their experiments; this table adds none to them except where it renames one.

**NOT VERIFIED in this pass (each is the first step of the package named).** The simulator's session-start action and `setCaptureConfig` in `SHARED/sim` (WP-13a). Which client files assume two selector lines (WP-13a). The pre-check of `CS/capture-notices` (WP-13a). How today's tests obtain a signing key that is not a development key (WP-13c). Whether the clients' verify rule recomputes `STREAM_PROFILE_DIFFERS` (it matters only for option b of 7.2, which was not chosen). `CS/capture/boot/index.ts`, `CS/credential-store/envelope.ts`, the rbac module, the web console and the mobile client were not opened. Statements about `apps/capture-worker` beyond the lines cited rest on rows 11 to 13.

**Assumptions.** AS-A1: rows 11 to 13 are accurate where this pass did not re-open a line. AS-A2: U11's "three schema sets" forbids a fourth set but not a nullability change inside set A; if the controller reads it otherwise, 1.4 #1 becomes a set of its own with one more version step. AS-A3: adding an optional member to the body of operation 78 is a "small matter" under U12 B2.

**Alternatives considered and not chosen**, beyond the option tables: an owner-role command in place of the `unassign` member (it would leave the clearing of a selector outside the audit chain); a seed option for an empty selector (the seed is the demonstration's; a production database is X-2's subject); a served production lane on doubles (1.6).

**External research.** No external dimension is in scope for this task and no web source was used. Dimensions 1 to 7: no findings.

## 13. Lines opened in this pass (read-only)

In full: `CS/capture/fence/boot.ts`, `sources.ts`, `operation.ts`, `statements.ts`, `index.ts`, `development-discovery.ts`; `CS/capture/boot/checks.ts`; `CS/capture/adapters/types.ts`, `registry.ts`, `kinds.ts`, `real.ts`, `credential.ts`, `camera/onvif-rtsp.ts`, `audio/usb-audio.ts`, `local/helper-program.ts`, `local/leftover.ts`; `CS/modules/capture-config/plan.ts`, `routes.ts`, `store.ts`, `slices.ts`; `CS/db/schema/capture.ts`; `CS/db/migrations/0005_capture_privileges.sql`; `CS/transcription/credential-reveal.ts`.

In part: `CS/capture-session/index.ts:596-645,925-1180`; `CS/capture/adapters/local/process-door.ts:1-60,84-110`, `mic-helper-args.ts:1-30`; `camera/onvif-session.ts:203-242`; `CS/capture/adapters/__tests__/static.test.ts:30-130`; `CS/capture/fence/__tests__/fence.db.test.ts:78-83,160-215`; `CS/modules/capture-config/boot.ts:1-40`; `CS/modules/capture-discovery/connect/service.ts:245-275,478-530`; `CS/modules/capture-inputs/routes.ts:1-40`; `CS/db/mapping/rows.ts:895-963`, `from-rows.ts:59-65`; `CS/core/audit-details.ts:285-312`; `CS/sealing-host/session-reader.ts:238-275`; `CS/capture/fragments.ts:448-460,536-548,698-706`; `PROTO:372-400,500-512`; `SHARED/api/state-slices.ts:518-530,1114-1117`; `SHARED/sim/initial-state.ts:157-169`; `WRK/capture_worker.c:104-128,455-466`; `WRK/ingest.c:470-545,622-640`; `apps/core-server/test/support/fake-onvif-stub.ts:1-40`.

Searches (read-only): writers and readers of `capture_config` under `CS` (20 files); `captureConfig` under `SHARED`, `apps/core-web/src`, `apps/mobile/src` (42 non-test files); callers of `pullUrl`, `credentialAtInjection`, `usingCredential`, `loadProductionAdapters`, `buildProductionRegistry`; `ingestOpenWindowMs`; a per-camera drop frame in `PROTO` (none); "unassign" (the fence's text and its tests only).

Not opened: `apps/input-av/data/`, any `.env`. No source file and no other plan document was changed. Nothing was built, started or migrated.

---
*Generated: 2026-10-12 21:57 WIB*
*Last Updated: 2026-10-12 21:57 WIB*
