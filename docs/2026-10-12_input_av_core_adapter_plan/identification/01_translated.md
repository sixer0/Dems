---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-12
agent: request-translator
model_tier: default
status: translated
---

# Translated Tasks: Rencana adaptasi logika input-av ke adapter Core (tanpa pencatatan ganda)

> **Ringkasan (Bahasa Indonesia).** Pengguna meminta sebuah **rencana**, bukan implementasi: bagaimana logika perangkat keras di `apps/input-av` (kamera ONVIF/RTSP dan mikrofon lewat soundcard USB) dipindahkan ke lapisan adapter Core, sehingga hanya ada **satu** sistem pencatat. Arti "pencatatan ganda" ditafsirkan sebagai "tidak ada sistem pencatat kedua" (satu database, satu rantai audit, satu basis pengguna, satu format bukti, satu daftar perangkat). Tafsiran ini belum dikonfirmasi pengguna dan harus dikonfirmasi di gerbang persetujuan blueprint, bersama empat keputusan yang masih terbuka (H.265, audio lossless, banyak ruangan, host Linux). Folder `apps/input-av/data/` tidak boleh disentuh.

## Intent

The user has a second, separately built product inside the repository: `apps/input-av` ("DEMS EDGE"), a complete standalone recorder that already works on real cameras and a real USB soundcard. The Core, by contrast, has the adapter slots for exactly that hardware (`ONVIF_RTSP`, `USB_AUDIO`) but they are stubs that refuse every call.

The user wants a plan for moving what input-av knows about the hardware into those Core adapter slots. The stated reason is "agar tidak terjadi pencatatan ganda": the result must not leave two things recording or keeping records side by side.

Read together with the preceding request (study input-av and check its compatibility with DEMS as a whole), the underlying aim is: **keep the proven hardware know-how of input-av, drop its role as a second system, and make the Core the only place where sessions, evidence, audit, users and devices are recorded.**

**Scale category:** Migration (of logic from one application into another), delivered in this task as a plan only. It contains Research in the form of a gap analysis between the two code bases.

## Goals

1. **G1 — Logic inventory with a verdict per item.** Every piece of input-av hardware logic is listed and given one verdict: adopt into a Core adapter, already present in the Core, not needed, or blocked by an open decision. The inventory covers at least: camera discovery (WS-Discovery, ARP sweep, factory-IP scan, passive), camera network setup (SetNetworkInterfaces, aliases), ONVIF client, RTSP recording and reconnect behaviour, USB audio capture (ALSA dsnoop, input selection, level meter, mixer gain, A/V offset), storage guard, live preview.
2. **G2 — A single-record statement.** For each kind of record (session, recording / evidence file, audit entry, user and role, device registry entry, camera credential, setting, marker), the plan states which system owns it after the adaptation and what happens to the input-av counterpart. No kind of record has two owners.
3. **G3 — Mapping onto the existing adapter contract.** Each adopted item is mapped to the member of the Core adapter contract it fills (`apps/core-server/src/capture/adapters/types.ts`), or to `apps/capture-worker`, with the contract changes it would require named explicitly.
4. **G4 — Every mismatch resolved or put to the user.** Each of the nine mismatches in the controller's findings (see `01_original.md`) has either a planned resolution or a decision item with options, a recommended default and what it blocks.
5. **G5 — The fate of input-av stated.** The plan says what `apps/input-av` is after the adaptation (retired, kept as a reference, kept as a test bench, reduced to something else) and what happens to its existing recordings and audit log, which are evidence and may not be modified.
6. **G6 — Work sorted by what it needs.** Planned work is separated into what can be done on the present development host with fake devices, what waits for a user decision, and what needs the real hardware or a Linux host.
7. **G7 — Risks and verification.** The plan names its risks and states, per milestone, how completion would be checked.

## Primary Task

Produce an approved-quality plan for adapting the hardware input logic of `apps/input-av` into the Core's capture adapter layer, such that the Core is the only system of record. No code is written in this task.

## Scope

- **Files (read-only inputs)**:
  - `apps/input-av/README.md`, `apps/input-av/docs/SERAH-TERIMA.md`, `apps/input-av/docs/API-TABLET.md`
  - `apps/input-av/nvr/discovery.py`, `onvif_client.py`, `factory.py`, `netalias.py`, `passive.py`, `recorder.py`, `service.py`, `audio.py`, `routers/audio.py`, `storage.py`, `mediamtx.py`, `db.py`, `audit.py`, `security.py`
  - `apps/core-server/src/capture/adapters/types.ts`, `kinds.ts`, `mic-transport.ts`, `registry.ts`, `real.ts`, `credential.ts`, `camera/onvif-rtsp.ts`, `camera/ws-discovery.ts`, `camera/onvif-discovery.ts`, `camera/onvif-session.ts`, `audio/usb-audio.ts`
  - `apps/capture-worker/src/ingest.c`, `src/audio.c`
  - `packages/shared/src/api/capture.ts`
  - `apps/core-server/src/modules/sessions/index.ts`
  - root `README.md`, section "Real capture, sealing and transcript"
- **Folders**: `apps/input-av/` (source of logic), `apps/core-server/src/capture/` and `apps/capture-worker/` (target), `packages/shared/` (contracts that may be affected), `docs/2026-10-12_input_av_core_adapter_plan/` (output).
- **Systems/Domains**: ONVIF and RTSP camera input; USB audio input on Linux (ALSA); the Core's capture pipeline, evidence sealing, audit chain, RBAC, device registry and credential sealing.
- **Out of scope**: implementing any adapter; changing any source file; running input-av against its real data; touching `apps/input-av/data/`; the tablet and web clients except where the plan must name an effect on them.

## Constraints

Explicit (from the user or from documents the controller cited):

- **C1 — Plan only.** The request is "buat rencana". No implementation, no source changes.
- **C2 — No double recording.** Whatever the plan proposes, its end state has no duplicated record-keeping. See Assumption A1 for what this is taken to mean.
- **C3 — `apps/input-av/data/` is evidence.** It must not be edited, deleted or used for trials. Reading is permitted. Source: `apps/input-av/docs/SERAH-TERIMA.md:11-13` (rule 1). Trials use a scratch instance only (rule 2, line 14).
- **C4 — No real camera credential** may be typed, stored or received by agents. Source: controller, citing root `README.md` and D76.
- **C5 — The target is the Core's adapter layer.** The user names "adapter core" as the destination, so the plan works with the existing adapter contract rather than proposing a different integration point without saying so.

Implicit:

- **C6 — The Core's existing guarantees are not weakened.** Sealed evidence with a signed manifest, sealed write-only camera credentials, one audit chain and Core RBAC are in place today (controller, citing root `README.md`). A plan that adopts input-av behaviour which contradicts these (plain unsigned files, plaintext camera passwords, a separate user base) would recreate the double record the user wants to avoid.
- **C7 — Class-C rule of task 3.** The production adapters are deliberately stubs: an adapter of kind `ONVIF_RTSP` or `USB_AUDIO` that claims an opener is refused at registration, and class-C adapters must never load in a test (`apps/core-server/src/capture/adapters/registry.ts:31-32`, `real.ts:3`, `errors.ts:18,34`). The plan has to say how and when that rule is lifted; it cannot ignore it.
- **C8 — Ready-made frameworks.** The DEMS stack uses ready-made frameworks and component kits rather than hand-built ones (user memory `feedback-ready-made-frameworks`). This bears on how the plan proposes to bring Python logic into a Node / C code base.
- **C9 — Everything under `/docs`**, snake_case, never `/output` (global rules §3).

## Assumptions Made

- **A1 — Meaning of "pencatatan ganda" (interpretation, not confirmed by the user).** Taken to mean: no second system of record. One database, one audit chain, one user / RBAC base, one evidence format and custody chain, one device registry; input-av does not keep running as a parallel recorder and API beside the Core. This is the controller's reading and this agent agrees with it for two reasons: the user asks for the logic to be moved *into* the Core's adapters, which only makes sense if the Core is to do the recording; and this reading is the widest of the three, so a plan that satisfies it also satisfies the two narrower ones ("the same session recorded twice by two recorders", "duplicate log entries"). It still needs the user's confirmation, because the narrower readings would allow a much smaller plan in which input-av stays in service. See Notes, question Q1.
- **A2 — "Logika input av" means the hardware input logic**, not the whole application. The preceding request describes input-av as "api untuk jalur input onvif dan microphone". Its users, cases, rooms, web UI and REST API are treated as the parts that would duplicate the Core, not as things to port. Unconfirmed.
- **A3 — "Adaptasi" leaves the method open.** It could mean rewriting the logic in the Core's languages, or having a Core adapter drive a reduced input-av component. The request does not choose, so the plan should compare the options against C2 rather than assume one. Unconfirmed; see Notes, question Q2.
- **A4 — The four earlier decisions are still open.** The controller reports them unanswered. They are carried as decision items for the plan (Dependencies), not answered here.
- **A5 — Output language.** English body with a Bahasa Indonesia summary, following what the controller reports as the usual practice in this repository's `/docs`. The user-facing presentation at the approval gate is in Bahasa Indonesia.

## Source Documents

| Path | Type | Purpose | References |
|------|------|---------|------------|
| `apps/input-av/README.md` | document | what input-av is, features, architecture | whole file |
| `apps/input-av/docs/SERAH-TERIMA.md` | document | state on 2026-10-12, rules, test bench, real hardware results | rules 1-7 (lines 9-26); "Bangku uji" (lines 74-98) |
| `apps/input-av/docs/API-TABLET.md` | document | input-av API as seen by a tablet client | whole file |
| `apps/input-av/nvr/*.py` | source | the logic to be inventoried | files listed under Scope |
| `apps/core-server/src/capture/adapters/types.ts` | source | the adapter contract (target) | whole file |
| `apps/core-server/src/capture/adapters/camera/onvif-rtsp.ts`, `audio/usb-audio.ts` | source | the two stubs to be filled | whole files |
| `apps/core-server/src/capture/adapters/camera/onvif-session.ts` | source | existing connection test | line 491 (`NOT_H264`) |
| `apps/capture-worker/src/ingest.c`, `src/audio.c` | source | how the Core records today | `ingest.c:344,367` |
| `packages/shared/src/api/capture.ts` | source | capture API contract | lines 41, 43 |
| `docs/2026-10-07_dems_real_capture_sealing/masterplan/05_capture_architecture_spec.md` | document | capture architecture the adapters belong to | §A.1, §A.7 (cited in the adapter sources) |
| `docs/2026-10-07_dems_real_capture_sealing/decisions/decisions.md` | document | rulings in force | D76, D86 (C-5), OD-06 |

## Output Requirements

- **Format**: `md`. No format keyword appears in the request ("buat rencana" names no file type), so the default applies.
- **Destination**: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-12_input_av_core_adapter_plan/` — the plan itself in `masterplan/`, per the folder layout of global rules §3.
- **Style**: Tier 1 (global rules §8): full 5W1H, alternatives, assumptions, gaps, every factual claim with `file:line` or a named document. English body, Bahasa Indonesia summary (A5). No emoji.
- **Output Format Question**: not raised. The task is classed as Migration planning for an engineering audience, not as a research report. If the controller classes it as research-type instead, the DOCX-or-Markdown question applies and should be put to the user with the questions below.

## External Research Scope

No external research dimensions detected in the request. This task is internal-only.

Note for the controller: decision 1 (H.265) and the choice of method under A3 could later call for a technology evaluation, but the request itself contains none of the trigger keywords, so no dimension is listed.

## History Relevance Assessment

| Reference | Relevance | Notes |
|-----------|-----------|-------|
| `/docs/2026-10-07_dems_real_capture_sealing/` (README.md, identification/01_translated.md, adapter sources citing its spec and decisions) | Direct | Task 3 built the adapter layer, the capture worker and the sealing this plan targets, and defined the production adapters as class C (needs hardware or the real Core device), specified but not built. This task is in effect the continuation of that hand-over point. |
| `/docs/2026-10-04_dems_backend_rbac_pairing/` | Indirect | Task 2 built the Core's RBAC and pairing. It is the single user and device-trust base that input-av's own users and JWT would duplicate. Its content was not read in detail by this agent; only its identification folder was confirmed to exist. |

### Important Notes From History

- Task 3 sorted work into classes A, B and C; class C means "needs hardware or the real Core device" and was given a documented hand-over point (`docs/2026-10-07_dems_real_capture_sealing/identification/01_translated.md:45-50`).
- The production adapters are class C by ruling, and the registry enforces it: a `ONVIF_RTSP` or `USB_AUDIO` adapter that claims an opener is refused (`apps/core-server/src/capture/adapters/registry.ts:31-32`; `errors.ts:18`, citing D86 C-5 and classes C-2, C-4).
- A real microphone's transport is class C-4 and not built; the only transport today is a named pipe of raw PCM (`mic-transport.ts:9`; controller's findings).
- No process takes a camera credential as built, because recording a real camera is class C-2 (`credential.ts:12`). D76 forbids agents from handling real camera credentials (controller).
- USB was the working assumption for microphones (OD-06, cited at `audio/usb-audio.ts:3`), which matches what input-av does.
- Task 3 has uncommitted work and is on hold while the user tries the served applications (user memory `project-dems-demo-state`). A plan-only task does not collide with it, but any later implementation would touch the same folders.

### Lessons from History

- The user prefers one consolidated decision package they can approve in one sitting, each item with options, a recommended default and what it blocks (task 3 translation, G2, lines 38-44).
- Plans in this project separate what runs on the Mac with fake devices from what needs hardware, with a stated completion line for the former (task 3 translation, G3).
- The user gives short directives and expects quick movement; autonomy was granted in the demo task on condition of a decision log (user memories `user-profile-dems`, `feedback-autonomy-with-decision-log`). That grant was for that task and is not assumed to extend to this one.

## Dependencies

- **Confirmation of A1** (meaning of "pencatatan ganda") before the plan's end state is fixed.
- **Four open decisions**, each of which changes the plan's size:
  1. H.265 accepted, or cameras forced to H.264. All four tested cameras deliver H.265 while ONVIF reports H264 (`SERAH-TERIMA.md:79-80`); the Core's connection test rejects non-H.264.
  2. Evidentiary audio: AAC mono inside the camera file (Core today), or lossless and separate (input-av today).
  3. One Core serving several rooms at once, or one Core per room. input-av records 8 rooms concurrently; the Core allows one open session.
  4. Whether the production Core host is Linux. The input-av microphone path depends on ALSA.
- **Hardware access** for anything beyond planning: the test bench is a separate Ubuntu 24.04 laptop (`SERAH-TERIMA.md:78`), not the macOS development host.
- **Task 3 state**: its capture architecture spec and contracts are the baseline the plan builds on.

## Notes

### Questions for the user (recommended to be asked at or before the blueprint approval gate)

These do not prevent the blueprint from being drafted, because the plan can carry them as decision items with a recommended default. They do prevent the plan from being final.

- **Q1.** "Pencatatan ganda" — apakah maksudnya tidak boleh ada sistem pencatat kedua sama sekali (input-av berhenti menjadi perekam dan API tersendiri; hanya Core yang mencatat sesi, bukti, audit, pengguna dan perangkat)? Atau cukup supaya satu sesi tidak direkam dua kali oleh dua perekam, sementara input-av tetap dipakai?
- **Q2.** Setelah adaptasi, `apps/input-av` menjadi apa: dihentikan, disimpan sebagai acuan dan bangku uji, atau tetap berjalan sebagai komponen perangkat keras yang dikendalikan Core (tanpa database, audit dan pengguna sendiri)?
- **Q3.** Rekaman dan audit log yang sudah ada di `apps/input-av/data/` (15 sesi menurut `SERAH-TERIMA.md:11`; di sana disebut rekaman uji tetapi tetap bagian dari data bukti, baris 116-118): dibiarkan sebagai arsip terpisah, atau rencana harus memuat cara memasukkannya ke Core?
- **Q4-Q7.** The four open decisions listed under Dependencies.

### Observations for the controller to route

- `SERAH-TERIMA.md` describes input-av as running on a Linux laptop with its server live on 2026-10-12 (lines 41-43, 78). The copy under `apps/input-av/` in this repository is on macOS. Whether `apps/input-av/data/` in this working tree is the live evidence folder or a copy was not checked by this agent. C3 applies either way.
- `SERAH-TERIMA.md:24-26` (rule 7) says the input-av project does not use git. Whether `apps/input-av/` is tracked, ignored or untracked in the DEMS repository was not checked. It matters for the plan because an untracked folder holding evidence data sits inside a repository where other agents commit.
- The soundcard on the bench was swapped during the day (EVO 8 removed, a 2-input PCM2902 device attached; `SERAH-TERIMA.md:81`). Hardware-dependent statements in the plan should cite the device they were observed on.
- The multi-room test of input-av used virtual cameras and the laptop's onboard soundcard (`SERAH-TERIMA.md:112`), so "8 concurrent rooms" is not a real-hardware result.

### Not verified by this agent

The facts under "Raw Context" in `01_original.md` come from the controller's reading and were not re-derived, as instructed. This agent read only: `apps/input-av/docs/SERAH-TERIMA.md` lines 1-120, the task 3 `README.md` (first 150 lines) and `identification/01_translated.md` (first 80 lines), and a search for "class C" in `apps/core-server/src/capture/adapters/`.

---
*Generated: 2026-10-12 (clock time not available to this agent)*
*Last Updated: 2026-10-12*
