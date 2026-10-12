---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 12
date: 2026-10-12
agent: senior-code-reviewer
type: plan review (technical soundness of the design and the plan against the Core's code)
narrative_tier: 2
status: complete
verdict: SOUND WITH CHANGE - 2 blocking design gaps, 16 items for the implementation blueprint, 8 notes
reviewed: masterplan/01_specs.md (Amendment 1), masterplan/02_plan.md (v1.1), masterplan/03_db_schema_extension.md, decisions/decisions.md (U1-U14, C1-C5), test/01_hevc_experiment.md, research/01_explore_core.md, research/03_analysis.md
baseline: commit cf2f8008 (working tree clean except the untracked `apps/input-av/` and this task folder)
---

# Row 12: technical review of the port design and plan against the Core's code

> **Ringkasan (Bahasa Indonesia).** Arsitektur rencana ini cocok dengan kode Core: relay di depan worker yang tidak diubah, audio lewat named pipe f32le mono 48 kHz, dan tabel samping untuk skema. Tetapi ada **dua celah desain yang harus diputuskan sebelum blueprint implementasi diterbitkan**: (B1) Core `REAL_PRODUCTION` tidak bisa boot pada database yang selektornya masih menunjuk perangkat pengembangan, dan tidak ada jalur yang sah untuk mendaftarkan serta menugaskan perangkat produksi sebelum boot itu, jadi sesi produksi pertama tidak terjangkau; (B2) tidak ada jalur baca untuk kredensial kamera yang tersimpan: fungsi reveal di database tidak punya pemanggil, dan `openSource` tidak menerima kredensial. Selain itu 16 hal harus masuk blueprint implementasi, yang terpenting: pemeriksaan selesai fase 3 dan 4 tidak bisa dijalankan sebelum WP-13, WP-13 bukan ukuran S, lima paket sebenarnya ukuran L, dan sekitar dua belas aturan statis yang akan merah tidak disebut di desain. Tidak ada kode, build, tes, worker atau server yang dijalankan.

## 0. Method and limits

| Item | Statement |
|---|---|
| What was done | The eight review questions were answered by opening the Core's code and comparing it with what the design says it lands on. Every finding names the line that supports it. |
| What was run | One program, for its help text only: `/opt/homebrew/bin/ffmpeg -hide_banner -h demuxer=rtsp`, `-h muxer=rtsp`, `-devices` (FFmpeg 9.0.2, libavformat 63.1.102, the worker's pinned version). No build, test, worker, server or migration. |
| Not opened | `apps/input-av/data/`, any `.env`. No source file and no plan document was changed. |
| Graft | Not queried: the graph refreshes itself before a query, which writes outside this task folder. Searches were read-only `grep`. Dependency statements below are therefore from named lines, not from a blast-radius query. |
| Not re-verified | The count "17 files name `NOT_H264`", the 21 pin rows of design section 6.3 one by one, the input-av source lines, the 48 citations row 11 already opened. |
| Reviewer knowledge, not verified here | Marked HYPOTHESIS (HR-n) where a statement rests on what the reviewer knows about FFmpeg, Linux or browsers and not on a line or a run. |

Abbreviations: `CS` = `apps/core-server/src`; `CST` = `CS/capture/__tests__/static.test.ts`; `AST` = `CS/capture/adapters/__tests__/static.test.ts`; `WRK` = `apps/capture-worker/src`; `PROTO` = `packages/capture-protocol/src/index.ts`; `SPEC`, `PLAN`, `SCH` = the three masterplan documents.

**Ranking.** BLOCKING = a design decision is missing and the implementation blueprint cannot define the named packages without it. Neither blocking item stops phase 1 (WP-01 remainder, WP-09), WP-24 or WP-02. BLUEPRINT = must become a requirement, a re-sizing or a re-ordering in the implementation blueprint. NOTE = to be known, no rework.

## 1. Overall verdict

**SOUND WITH CHANGE.** The three structural choices hold against the code:

- The relay in front of the unchanged worker fits the worker's rules: the listener address grammar admits a per-session path element (`WRK/capture_worker.c:110-126`; `PROTO:508`), the sockets check concerns the worker's own descriptors only (`WRK/ingest.c:95-109`), and the camera-facing socket lives in another process.
- An ALSA helper that writes f32le mono 48 kHz into the existing pipe satisfies the worker as it is: the plan check wants `PCM_FIFO`, 48,000 Hz, one channel, a path that is a FIFO (`WRK/capture_worker.c:149,176,203`), and the pipe is read non-blocking into a resampler that follows +-5,000 ppm (`WRK/audio.c:94,345-361`).
- Side tables instead of new registry columns leave the engine's device slice alone, which is correct (`SCH:180`).

It is not ready to be executed as written. Two gaps need a decision, and the plan understates what phases 3, 4, 6 and 10 touch.

## 2. Findings, ranked

### 2.1 BLOCKING

| Id | Finding | Evidence | Why it matters | Blocks | Rework |
|---|---|---|---|---|---|
| **P12-B1** | **No path leads to a first `REAL_PRODUCTION` boot with production sources.** The boot refuses `REAL_PRODUCTION` while the selector assigns a development source. The selector's four slots are NOT NULL and are seeded with the built-in fake devices. A production device can be assigned only by a registry of the production operation, and commissioning is designed as a function of the production operation (DR-1). So the operation that must run to register and assign production devices cannot start until they are assigned. | Refusal: `CS/capture/fence/boot.ts:147-149`, message `:87-89`. Slots NOT NULL: `CS/db/schema/capture.ts:98-103`; two different microphones required: `:147`. Assignment only in the operation's own class: `CS/capture/adapters/registry.ts:132`. Production kinds registrable in development for the camera search half only, never `USB_AUDIO`: `CS/capture/adapters/kinds.ts:72-75`. Neither `SPEC`, `PLAN` nor `SCH` names `DEV_SOURCE_WITHOUT_FLAG` (search of the task folder: 0 matches). | Checks H-16 and H-17, and every commissioning check that needs a running production Core (H-06, H-13 to H-15), fail on first contact whatever the quality of the code. The fix changes a security control (SEC35-41 (b), SEC35-43 (a)), so it is a decision row and a security review, not an implementation detail. Confidence: HIGH that the boot refuses; MEDIUM that no legal sequence of operations gets around it (the capture-config routes were not read in full). | WP-13, WP-19, WP-22, WP-27 (H-16); the order of section 9A | Row 8 (design of a "production, not yet configured" state, or of another first-install path); row 13 for the changed control; then the plan |
| **P12-B2** | **The stored camera credential has no read path, and the opener has no way to receive it.** The design says `openSource` "builds the start message at `credentialAtInjection`" (S1-7). That function needs a `SealedCredential`. The stored credential can be read only through the owner's reveal function, and no file of the Core calls it; the module the migration names as its one call site does not exist. `openSource` and `pullUrl` take no credential, and `GetStreamUri` at each open (H-11) needs an authenticated call. | `CS/capture/adapters/credential.ts:122-125`; `CS/capture/adapters/types.ts:140,143`; reveal function and its "one module" `CS/db/migrations/0005_capture_privileges.sql:13-15,61-75`; `ls CS/modules/capture-config/` holds no `credential-reveal.ts`; search for `dems_capture_credential_reveal` in `CS` outside migrations: 0 callers (the STT twin has one: `CS/transcription/credential-reveal.ts:19`). Audit detail of a reveal is "the supervisor reveal path", device id and reason only: `CS/core/audit-details.ts:300-304`. Search for "reveal" in the three masterplan documents: 0 matches. | This is the one place where the production camera path crosses the write-only store. It needs: the reveal module with its static rule, the envelope opened with the store's key, who the actor of `CAPTURE_CREDENTIAL_REVEALED` is when the system reveals at a session start, how often (per open, per reconnect, per connection-test probe), and a constructor dependency on the adapter. None is designed, and row 13's table rates "stored how" without the read side. | WP-04 (locator per open), WP-05 (probe of an adopted camera), WP-06 | Row 8; row 13 to rate it; then WP-06 split (P12-F09) |

### 2.2 For the implementation blueprint

| Id | Sev. | Finding | Evidence | Rework |
|---|---|---|---|---|
| P12-F01 | High | **The completion checks of phases 3 and 4 cannot run before WP-13.** "In a test registry a session on fakes records through the relay" needs a registered production adapter that states an opener. The registry refuses that for any kind outside the list, and the session-source builder refuses it again, both from one module constant with no injection point. | `CS/capture/adapters/registry.ts:36,82`; `CS/capture/fence/sources.ts:86,106`; whole selector must be recordable: `CS/modules/capture-config/plan.ts:124,135`. `PLAN:331,355` | Reword: phases 3 and 4 close on adapter-level tests (adapter, relay, a worker driven directly). The first full session through registry, fence and plan builder is a named step of WP-13. Do not add a test-only switch for the list: `registry.ts:29-35` forbids exactly that |
| P12-F02 | High | **WP-13 is not size S and is more than "the boot calls the loader".** The production registry must supply what the development one does: `openSources`, `probeAdapters`, `admit` for a device registered after boot, `closeAll`. The loader takes device entries only; a built adapter also needs the door, the program paths, the run directory, timers, the clock, the credential reader and the loss callback. Rule A-1 ("class-C files never load in a test") turns red as soon as a test imports the built adapter, which is phase 3, not phase 6. | `CS/capture/fence/index.ts:160-179,305-311,326-329`; `CS/capture/adapters/real.ts:17-36`; `AST:36-48,95-101` | Size M. Build the adapters in new files and leave the two stubs until the lift, or move the A-1 rewrite to WP-06 and WP-07. Name the production registry builder as a deliverable |
| P12-F03 | High | **Session-start timing is not designed.** The worker waits 15,000 ms for a camera to connect, takes one connection per listener, and never listens again in that session. The session opens the cameras one after the other and awaits each. The relay cannot announce before it holds the stream (codec, parameter sets). Consequences: a slow first camera can cost the second its window; a camera that is down at the start is lost for the whole session, so the reconnect rule "no attempt limit" helps only after a first connection. input-av records such a camera when it returns. | `PROTO:382-397`; `WRK/ingest.c:482-483,504,540`; `PROTO:215`; `CS/capture-session/index.ts:1129-1140` | WP-06: open both relays concurrently, set the window for the production operation, and state the "absent at start" behaviour as a known limit or design around it. WP-27: two new checks (P12-F14) |
| P12-F04 | High | **About twelve static rules that will turn red are not named in the design.** See section 4. The design names the opener pins and the door; it does not name G-R1, G-R2's exact lists, G-R9, G-R10/G-R11, G-R12's forbidden characters and format list, G-R13, G-R14, the hash pin of `config.ts`, or the frozen unit list of `app.ts`. | Section 4 of this document | Each affected package lists its rule and whether the rule is amended by a decision row or the code is shaped to keep it |
| P12-F05 | High | **Four contract mismatches.** (a) `pullUrl` is synchronous; a locator resolved by `GetStreamUri` at each open cannot be returned by it. (b) `enumerate()` answers one entry per registered microphone; it cannot list cards and inputs that are not registered. (c) No operation registers a microphone at all. (d) A microphone helper is launched through a `start` member found by duck typing, outside the contract. | (a) `CS/capture/adapters/types.ts:143`; (b) `:180-186,210`, `CS/modules/capture-inputs/routes.ts:10-13`; (c) `SCH:231` says so itself; (d) `CS/capture-session/index.ts:947-951` | WP-04: make `pullUrl` asynchronous (four implementations and their tests) or resolve inside `openSource`. WP-07: a card-listing member and a registration operation. WP-08: implement `start` |
| P12-F06 | High | **Every new operation moves pins the design does not list.** The operation count 97 is pinned in at least seven places; each operation needs a registry entry, a schema, a simulator answer and an OpenAPI entry; the list of credential-carrying operations is stated in the shared package. New operations by this plan: card listing, microphone registration, network configuration read and write, alias add and remove, commissioning scan, set camera network, acceptance and its revocation, and a body on operation 93. | `CS/plugins/permission-guard/__tests__/guard.test.ts:251`; `access-rules.test.ts:65,67`; `apps/core-web/src/test/live-api-reference-page.test.tsx:133,303`; `live-api-reference-document.test.tsx:146,238`; `packages/shared/src/sim/api.ts:767`; pattern `CS/modules/capture-inputs/index.ts:8-9` | One contract package per group of operations, landing before its live path, as task 3 did (D106). State what each answers in `SIMULATED` |
| P12-F07 | High | **A permission is stored data, not vocabulary.** The commissioning permission (U10) needs a row in `permissions` and one in `role_permissions`; the boot compares the stored grants with the shared role table and refuses on a difference. No migration writes these rows today (the seed does), so an existing database, the local demo database of B4 included, stops booting when the vocabulary lands without the rows. | `CS/db/migrations/0001_tables.sql:34-41`; `CS/plugins/permission-guard/matrix.ts:167`; `CS/modules/capture-config/__tests__/rbac-boot-equality.test.ts:14-19,89`; `slices.test.ts:229` (count 14) | The rows travel in the hand-written file of set B (WP-25) and land in the same commit as the vocabulary of WP-23. `SCH:178` covers audit types only |
| P12-F08 | High | **HEVC reaches further than the connection test and the reader's frame rate.** See section 5. Most important: the configured profile code against the sealed stream statement. With no frame rate read for HEVC, the notice `STREAM_PROFILE_DIFFERS` is due unless the configured code begins with `HEVC_<picture>`. The bench cameras report H264 over ONVIF and deliver H.265, and WP-04 fixes the code form before WP-05 judges the codec. | `CS/sealing-host/session-reader.ts:246-265`; `CS/capture/fragments.ts:541-546,702-705`; `PLAN:298,316` | Decide the profile-code form with the stream result in hand: WP-04's code depends on WP-05, or the notice rule is amended (an evidence-specification change, so "sealing unchanged" in `SPEC:563` no longer holds) |
| P12-F09 | High | **Five packages are size L and must be split; WP-13 is M.** Section 6 gives the splits. WP-03 and WP-06 also share one C program: the retry rule of WP-06 lives inside the relay WP-03 builds. | Section 6 | Blueprint rows |
| P12-F10 | Med. | **Relay behaviour the design leaves open.** (a) After a reconnect the relay must hold back until a keyframe; the worker enforces that only at the start of a file. (b) The credential reaches libavformat's RTSP client only as the user part of a URL: the pinned demuxer has no account option. The design's "never URL" (`SPEC:226`) is not achievable as written; it holds outside the relay's memory only. Row 13 knows this (HS-1, S13-01, S13-02); the design text and the wording of rule CR must follow. (c) Percent-encoding of an account with `@`, `:`, `/`, `%`. (d) The relay needs the same library pin as the worker, at build and at start. | (a) `WRK/ingest.c:632` via `research/03_analysis.md:233`; (b) help text of the installed demuxer, section 0: options end at `user_agent` and the TLS files, none for an account; `CS/capture/adapters/credential.ts:5-10`; (d) `WRK/ingest.c:58-77` | WP-03 requirements; a decision row for the wording of (b) |
| P12-F11 | Med. | **Measure SA-2 may have no home.** If E-11 shows that the listener accepts a push to another path, SA-2 becomes a worker change. No package holds it (WP-11 is tied to E-10 only), and the worker reaches the stream through `avformat_open_input` alone. HYPOTHESIS HR-1: the announced address is not exposed by the library's public interface, so the worker could not compare it without a library change. | `WRK/ingest.c:481-490`; `SPEC:310`; `PLAN:277` | Run E-11 first. Add a conditional package, and state now what stands if SA-2 cannot be built (SA-3 and the host rules alone), for row 13 to rate |
| P12-F12 | Med. | **Linux first-contact risks that a check on the Mac can remove.** (a) The worker refuses to compile and to start on any libavformat but 63.1.102. HYPOTHESIS HR-2: Ubuntu 24.04 packages FFmpeg 6.1, so the profile must build FFmpeg 9.0.2 from source, with the ALSA input, or a re-verification on another version is ruled. (b) Leftover-process detection matches `ps -axo pid=,comm=` against the full program path. HYPOTHESIS HR-3: on Linux `comm` is the short name, so nothing would ever match. (c) HYPOTHESIS HR-4: Ubuntu has two `arping` packages whose `-D` means different things; the helper's conflict check needs the iputils one. | (a) `WRK/ingest.c:59-61,63-77`; (b) `CS/capture/adapters/local/leftover.ts:13-14,26`; (c) `SPEC:398` | WP-14: make the Ubuntu 24.04 container build of worker, relay and helper a required check of track D, not "if available" (`PLAN:227`). WP-02: do not reuse the leftover check unchanged. WP-14 and WP-20: name the package and check the variant |
| P12-F13 | Med. | **The double of WP-08 exercises none of the risky path.** Text equality with input-av proves the argument list was copied, not that the pinned helper accepts it: the installed FFmpeg has no ALSA input on macOS (devices listed: `avfoundation`, `lavfi`), and input-av ran another FFmpeg version (HR-2). | Section 0 (`-devices` output); `CS/capture/adapters/local/mic-helper-args.ts:6` | Add two checks that run real code: on the Mac, the real helper with a generated multi-channel source in place of the device, through the channel selection, the pipe and the worker; in the Linux container, the Linux argument list against an ALSA `null` or `file` device for option parsing |
| P12-F14 | Med. | **Section 9A needs its capture operation per check, and five checks are missing.** H-09 "record one camera" is not possible through the product: a session needs four recordable slots of one class. H-06, H-13 to H-15 need a running production Core, so they need H-16 first (and P12-B1). Missing: camera absent at session start; time from start to both ingests connected against the window; an account with special characters; leftover processes after a killed Core on Linux; the `arping` variant. | `CS/modules/capture-config/plan.ts:124,135`; `PLAN:539,551,558` | WP-27 |
| P12-F15 | Med. | **The audit vocabulary is a single-writer hot file set.** Each new audit type edits the same pinned files, and WP-07, WP-12, WP-23 and WP-26 run in phases the plan lets overlap. | `packages/shared/src/sim/vocabulary.ts:346-435`; `CS/core/audit-details.ts`; `CS/db/fixtures/operations.ts:487`; `PLAN:182,440` | One owner per wave, or one vocabulary package ahead of the consumers |
| P12-F16 | Low | **Stale or missing pin statements.** Task 3 is committed (head `cf2f8008`, tree clean), so phase 0's "commit task 3's uncommitted work" and risk R-20 are met already. The schema tests live in `apps/core-server/test/db/`. The count of value sets (44) is a pin that sets A and B move and `SCH` section 3.4 omits. | `git status`, `git log -1`; `apps/core-server/test/db/contract-inventory.test.ts:265,315` | Phase 0 list; WP-24, WP-25 |

### 2.3 Notes

| Id | Note |
|---|---|
| P12-N01 | E-6 (WP-09) is true by construction: a 32-bit float holds every 24-bit integer exactly. It says nothing about the stored audio, which is resampled and encoded to AAC. |
| P12-N02 | One camera may fill both video slots with two distinct profiles (`CS/db/schema/capture.ts:148-151`), so main and sub stream of one camera is a legal production selector: two relays on one camera. Not considered in the design; worth a line in WP-04. |
| P12-N03 | The unique key `(card_id, card_device, input_number)` of `capture_audio_inputs` rests on an ALSA card id that two identical interfaces share in a varying order. Harmless at one room per Core; state it. |
| P12-N04 | HYPOTHESIS HR-5: Safari and iOS players refuse `hev1` and play `hvc1`. E-8 on this Mac shows the browsers of this Mac only; the operator workstation's browser is not named anywhere. |
| P12-N05 | HYPOTHESIS HR-6: `valid_lft` on an IPv4 address is honoured by current Linux kernels, so H-S is likely to hold. E-13 stays the proof. |
| P12-N06 | Arrival stamping (F-1 sub-choice) is wrong for a stream with B-frames. The plan lists B-frames as unproven and H-09 covers it. |
| P12-N07 | `CS/db/mapping/rows.ts:925` casts microphone ids to `'MIC-01' | 'MIC-02'`. Development already runs with `MIC-03`, so it is cosmetic, but WP-07 will meet it. |
| P12-N08 | The frozen camera slice states `1080p`, `25` and `H.264` as literals (section 5, row 4). Under variant C the clients keep working and show wrong facts for a real camera. |

## 3. The eight questions

| # | Question | Answer |
|---|---|---|
| 1 | Are the claimed changes sufficient and correctly located? | The seams exist where the design says. Not sufficient: P12-B2, P12-F02, P12-F04, P12-F05, P12-F06, P12-F07. Missed second call sites: the `start` member (`CS/capture-session/index.ts:950`), `admit` (`CS/capture/fence/index.ts:305`), the clock read straight after the open (`CS/capture-session/index.ts:1143-1153`). |
| 2 | Does the relay fit the worker's rules and the credential rules? | Loopback listener: yes. Sockets check: yes. Process door: a second pinned door is needed and three exact-list pins move (`CST:156,160,221`). Credential: not in an argument, an environment variable or a log if built as designed; **in a URL inside the relay's memory, unavoidably** (P12-F10 b). What breaks: P12-F03 (timing), P12-F11 (SA-2), P12-B2 (where the credential comes from). |
| 3 | Does the ALSA helper satisfy the worker; is channel selection expressible; primary and standby? | Worker side: yes (section 1). "Open all channels, select one" is expressible as one helper per role on the shared device. Three obstacles on the Core side: `|` is a forbidden character of any helper argument and `alsa` is not an allowed format (`CST:744-745`), so `pan=mono|c0=c<k>` cannot pass rule G-R12 unchanged, while WP-08's own completion check demands that exact text; the rule "no value read from the database reaches an argument" (`CS/capture/adapters/local/mic-helper-args.ts:20-22`) meets a card name, a channel count and an input number that come from the database; writing the generated ALSA configuration needs a new file-system file in an exact-list pin (`CST:160`). Semantics: the Core requires two different microphones per session and stores the active one only (`CS/db/schema/capture.ts:147`; `CS/modules/capture-config/plan.ts:124`). A room with one microphone cannot record. input-av's "several inputs of a room, all recorded" has no counterpart; the design says so (`SPEC:362`), the user accepted it (U12 A1). |
| 4 | What else assumes H.264? | Section 5. |
| 5 | Is the privileged boundary sound; is there a pattern; does the platform seam allow development on macOS? | The boundary of DR-2 is sound in shape. There is **no existing pattern**: no file of the Core names `sudo` or reads the platform (search of `CS`: 0 matches), and the host units may start no process and open no socket (`CST:138-145`), so the helper's caller, the ping and the neighbour read must live under `CS/capture/` behind a pinned door. The typed or alias-bound probe meets "one datagram socket, one destination" (`CST:242-262`). Development on macOS with a double is possible for the Core side. Caution: "the real helper run with stand-ins for `ip` and `arping`" needs an injection point, and an injection point in a root helper must not exist in the installed file. |
| 6 | Do the tables fit? | Grants, the no-DELETE rule, the version step per set, the kept-table carry and Simulated mode: yes. Missing: P12-F07 (permission rows), the value-set count pin (P12-F16), the writer of set C (already row 11's F-02). No collision with task 3's tree: it is committed. |
| 7 | Are track D's checks runnable on this Mac with an honest double? | Section 7. |
| 8 | Order, cycles, sizes? | No cycle. Wrong order: P12-F01 (full-session checks before the lift), P12-F08 (WP-04 before WP-05 for the code form), P12-B1 (H-16 after the checks that need it). Sizes: section 6. |

## 4. Static rules and pins the design does not name

| Rule | What it holds today | Line | Hit by |
|---|---|---|---|
| G-R1 | Modules, engine, plugins and core start no process, open no socket, import no file system | `CST:129-146` | WP-19, WP-22 (commissioning cannot live in `modules/`), WP-20 (command runner) |
| G-R2 | Exact lists of the files that import the process module and the file system | `CST:150-160` | WP-02 (third process file), WP-08 (ALSA configuration writer), WP-07 (card listing read) |
| G-R2, G-R10 | No socket module anywhere under `capture/` | `CST:162-167,438` | WP-06: "presence by TCP reachability" (S1-8) has no permitted place; use the ONVIF time read or the relay's probe |
| G-R8 | Only two files start a process | `CST:220-221` | WP-02 |
| G-R9 | One datagram socket, one file, one destination | `CST:242-262` | WP-12, WP-19 |
| G-R10, G-R11 | One importer of the `onvif` package; five reads; the type declaration declares those five only; the exports of the session file are an exact list | `CST:362-380,424-440`; `CS/capture/adapters/camera/onvif-cam.d.ts` | WP-22 (second importer, four new calls), WP-04 and WP-06 (new exports) |
| G-R12 | Every helper argument is a table literal or one of the listed computed values; no `|`; formats limited to five; ten argument lists; the door's `stdio` line | `CST:724-787` | WP-08, WP-02, WP-19 (`sudo` arguments) |
| G-R13 | `discover` is called from one file | `CST:343,355-356` | WP-19 if the scan reuses the probe |
| G-R14 | No camera maker's name and no default account in the adapter layer or the fence | `CST:789-833` | WP-19 (factory address list by maker: keep maker names out of these folders) |
| `config.ts` | Byte-equal to a frozen file once the waived lines are removed | `CST:548-560` | every new configuration key (relay path, helper path) |
| `app.ts` | Frozen unit list | `CS/modules/capture-inputs/index.ts:14-16` | every new module |
| A-1 | Class-C files import three files and state no opener; loaded by the loader only | `AST:36-48,95-101` | P12-F02 |
| Counts | 97 operations; 14 permissions; 44 value sets; 15 migration files | P12-F06, P12-F07, P12-F16 | WP-07, WP-12, WP-19, WP-22, WP-23 to WP-26 |

## 5. What in the Core names or assumes H.264

| # | Place | Line | State | In the design? |
|---|---|---|---|---|
| 1 | Connection test: profiles filtered to H.264, outcome `NOT_H264` | `CS/capture/adapters/camera/onvif-session.ts:222,477,491-492` | must change | yes (WP-05) |
| 2 | Reader: sample entries `hvc1` and `hev1` map to `HEVC` | `CS/capture/fragments.ts:453-459` | ready | yes |
| 3 | Reader: frame rate read from `avcC` only; null for HEVC | `CS/capture/fragments.ts:541-546,702-705` | gap | yes (WP-10, conditional) |
| 4 | Sealed stream statement and the notice `STREAM_PROFILE_DIFFERS` | `CS/sealing-host/session-reader.ts:246-265` | follows from 3: `HEVC_1080P` with no rate; notice unless the configured code matches | **no** (P12-F08) |
| 5 | Camera status slice: `resolution`, `fps`, `codec` are the literals `1080p`, `25`, `H.264` | `packages/shared/src/api/state-slices.ts:526-528`; `packages/shared/src/sim/types.ts:330,581` | wrong facts for a real camera; a contract change if corrected | **no** |
| 6 | Camera tile and live overlay fall back to "H.264" | `apps/core-web/src/features/devices/camera-tile.tsx:129`; `features/session-monitor/model.ts:456` | follows 5 | no |
| 7 | Contract texts: "usable H.264 profile", five outcomes | `packages/shared/src/api/capture-discovery.ts:270,614-618,882` | text and generated description | partly (I-2) |
| 8 | Stored and returned "usable H.264 profile codes" | `CS/modules/capture-discovery/store.ts:64`; `connect/service.ts:79`; `CS/capture/adapters/types.ts:104` | meaning changes | partly |
| 9 | Worker: copies any codec, `codec_tag = 0`, refuses a stream without parameter sets | `WRK/ingest.c:361-362,512` | proven on generated sources (`test/01_hevc_experiment.md`) | yes |
| 10 | Playback: plain video element, sealed file over the media route | `CS/modules/media-stream/index.ts:1-12`; `SPEC:335` | unproven (E-8); P12-N04 | yes |
| 11 | Manifest field 43 vocabulary `H264` or `HEVC`; adapter profile type | `CS/sealing-host/session-reader.ts:271`; `CS/capture/adapters/types.ts:110-111` | ready | yes |
| 12 | Evidence verification and export | hash-based, codec not named (search of `apps/core-web/src`, `apps/mobile/src` for a codec name outside the files above: none) | ready | yes |

Sealing and verification of an HEVC session were not run by the experiment (`test/01_hevc_experiment.md:30`); condition L-4 should wait for E-8, as row 11's F-05 says.

## 6. Verdict per work package

Verdicts: **sound**, **sound with change**, **unsound**. In the blueprint's vocabulary (row 12 cell): sound = SOUND; sound with change = NEEDS_CHANGE; a package whose core claim only real hardware can settle is also marked UNPROVEN.

| WP | Verdict | Reason (file:line) | Size as planned / as judged |
|---|---|---|---|
| WP-01 | sound with change | E-10 must include a time jump and a resume that does not start on a keyframe; E-11 needs a fallback (P12-F11); E-8 shows this Mac's players only | S / S |
| WP-02 | sound with change | Keep standard input open as the liveness channel instead of closing it after the start message: the worker already ends on end of input (`WRK/capture_worker.c:461`), which makes "no child outlives the Core" the same mechanism on macOS and Linux and E-7 an honest proof. Pins `CST:156,221,778`. Leftover check: P12-F12 b | S / S |
| WP-03 | sound with change; UNPROVEN on real cameras | P12-F10; needs a pull-side RTSP fixture with Digest authentication and HEVC, which does not exist (`apps/capture-worker/test-fixtures/` holds pushers) | M / **L**: split into relay core, fixture server, reconnect and keyframe gating |
| WP-04 | sound with change | `pullUrl` synchronous (`CS/capture/adapters/types.ts:143`); needs the credential (P12-B2); code form (P12-F08); export pin `CST:425-428` | M / M |
| WP-05 | sound with change | Section 5 rows 5 to 8; the probe is a second user of the injection point in the same file, which the rewritten pin must allow | M / M |
| WP-06 | sound with change; its completion check is **unsound** as written | P12-B2, P12-F01, P12-F03; presence by TCP has no permitted place (`CST:165,438`) | M / **L**: split into reveal path, adapter with SA-2 and SA-3, loss and audit writers |
| WP-07 | sound with change | P12-F05 b and c; a registration writes the engine's device slice as adoption does (`CS/modules/capture-discovery/connect/service.ts:486-500`); no screen is planned although H-07 lists inputs "in the console" | M / **L**: split into adapter, registration operation with its contract, screens |
| WP-08 | sound with change; UNPROVEN until H-08 | Question 3; P12-F13 | M / M |
| WP-09 | sound | P12-N01 | S / S |
| WP-10 | sound with change | Scope should name section 5 rows 3 to 6 | S to M / M |
| WP-11 | sound | Conditional on E-10; `WRK/ingest.c:540` is the right place | M / M |
| WP-12 | sound with change | G-R9 (`CST:242-262`); a body on operation 93 moves contract pins; role not stated (row 11 F-11) | M / M |
| WP-13 | sound with change | P12-F02, P12-F01, P12-B1 | S / **M** |
| WP-14 | sound with change | P12-F12 | M / M |
| WP-15 | sound with change | Through WP-27 (P12-F14) | M / M |
| WP-16, WP-17, WP-18 | sound | Closed on paper by rulings U12 A1, A8, A10 | - |
| WP-19 | sound with change; UNPROVEN until H-05, H-06 | Question 5; the operations that read and write the network configuration belong to no package; alias lifecycle at job end, shutdown and boot | M / **L**: split into helper file, Core caller with guard and lifecycle, scan operation, configuration operations |
| WP-20 | sound with change | The boot checks are an ordered list with named refusals (`CS/capture/boot/checks.ts:19-39`); add the relay's path rule and version, and the `arping` variant | S / S |
| WP-21 | sound | User action | S |
| WP-22 | sound with change; UNPROVEN until H-14 | G-R10 and G-R11 (`CST:362-380`); P12-F06; C1 against the 180 s job (row 11 F-03) | M / **L**: split into operation, job with wait by MAC, screens |
| WP-23 | sound with change | P12-F07, P12-F15 | S / S |
| WP-24 | sound with change | P12-F16; otherwise the design follows the Core's delivery pattern (`CS/db/schema/meta.ts:38-40`; `CS/db/migrations/0009`, `0014`) | S / S |
| WP-25 | sound with change | Carries the permission rows (P12-F07); address types have a stated fallback (`SCH:277`) | S / S |
| WP-26 | sound with change | Writer still unassigned in the plan (`PLAN:596`) against C2 | S / S to M |
| WP-27 | sound with change | P12-F14, P12-B1 | M / M |

## 7. Track D: is each check runnable on this Mac, and is the double honest?

| WP | Runnable on the Mac | Does the double exercise the code path? | First-contact risk | Covered by section 9A? |
|---|---|---|---|---|
| WP-01 | yes | yes: the release worker is the real one | medium | H-09, H-20 |
| WP-02 | yes | yes if liveness is end of input; no for a Linux-only parent-death call | medium | H-02 |
| WP-03 | yes, once the fixture exists | partly: a hand-written RTSP server stands in for a camera's authentication and packetisation | **high** | H-09; **not** the special-character account |
| WP-04 | yes | partly: fake ONVIF answers | medium | H-10 |
| WP-05 | yes | partly | medium (15,000 ms) | H-09, H-10 |
| WP-06 | adapter level only before the lift (P12-F01) | partly | **high** (P12-F03) | H-11; **not** absent-at-start, **not** connect time |
| WP-07 | yes | no for the listing: fixture text, unless taken from a real host | medium | H-07 |
| WP-08 | text equality only | **no**: ALSA, the helper's option parsing and channel selection are bypassed (P12-F13) | **high**; the bench recordings of this scheme were silent | H-08 |
| WP-12 | yes | partly | low | H-12 |
| WP-13 | yes, and it is where the full path first runs | yes on fakes | **high** (P12-B1) | H-16, H-17 |
| WP-14 | document and print-only scripts | no, unless the container build is made required | **high** (P12-F12 a) | H-01, H-03 |
| WP-19 | yes for the Core side | partly: a helper double; the script against stand-ins | **high** | H-05, H-06, H-13; **not** the `arping` variant |
| WP-20 | yes | partly: fixture outputs | medium | H-04 |
| WP-22 | yes | partly: stub with the network calls | **high** (H-T) | H-14, H-15 |
| WP-23 to WP-26 | yes | yes: a real PostgreSQL | low | not needed |
| WP-27 | dry run | no by nature | - | - |

## 8. What is done well

- The design separates what is proven on hardware from what is not, and never calls a package tested (`SPEC` section 2).
- WP-01 was run before anything leaned on it, and its report states exactly what it does not show.
- The pin table of section 6.3 is the right instrument; this review extends it, it does not replace it.
- The schema design follows the Core's own delivery rules and names its fallbacks.
- U13 was turned into a real split (tracks D and H) with moved checks per package, not into a relabelling.

## 9. Files read

Task folder: `identification/02_structured.md`, `decisions/decisions.md`, `masterplan/01_specs.md` (all), `masterplan/02_plan.md:156-604`, `masterplan/03_db_schema_extension.md:159-473`, `test/01_hevc_experiment.md`, headings of `research/01_explore_core.md` and `research/03_analysis.md` with `:229-233`, and the verdict tables of `verification/01_verification.md` and `verification/02_security.md` (to avoid contradicting them).

Code, read-only: under `apps/core-server/src/capture/adapters/`: `types.ts`, `registry.ts`, `real.ts`, `credential.ts`, `kinds.ts`, `mic-transport.ts`, `camera/onvif-rtsp.ts`, `camera/onvif-session.ts:203-242,470-496`, `audio/usb-audio.ts`, `local/process-door.ts`, `local/helper-program.ts`, `local/leftover.ts`, `local/mic-helper-args.ts`, `local/camera-adapter.ts`, `__tests__/static.test.ts:1-140`. Under `capture/`: `__tests__/static.test.ts` (rules G-R1, G-R2, G-R8 to G-R14, the `config.ts` pin), `fence/index.ts:160-179,300-330,495-529`, `fence/sources.ts:55-125`, `fence/boot.ts:1-68,145-155`, `fence/statements.ts`, `boot/checks.ts:11-39`, `fragments.ts` (codec lines). `capture-session/index.ts:947-979,1040-1160`. `modules/capture-inputs/index.ts`, `routes.ts:1-60`; `modules/capture-config/plan.ts:100-165`; `modules/capture-discovery/connect/service.ts:486-500`; `modules/media-stream/index.ts:1-45`. `db/schema/capture.ts:30-190`, `db/schema/meta.ts:30-42`, `db/migrations/0005_capture_privileges.sql`, `credential-store/index.ts:1-60`, `core/audit-details.ts:290-310`, `sealing-host/session-reader.ts:232-275`. `packages/capture-protocol/src/index.ts` (plan schema, loopback address, worker settings); `packages/shared/src/sim/vocabulary.ts:20-50`, `api/state-slices.ts:520-532`. `apps/capture-worker/src/capture_worker.c:80-270,455-500`, `ingest.c:40-175,340-372,415-435,470-610`, `audio.c` (pipe open, filter build, clock range).

---
*Written: 2026-10-12 21:32 WIB*
