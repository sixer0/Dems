---
task_id: 2026-09-30_dems_demo_stack_setup
task_slug: dems_demo_stack_setup
date: 2026-09-30
agent: request-translator
model_tier: default
status: translated
---

# Translated Tasks: DEMS Demo Stack Setup

## English Translation of the Request

> Study the documents in the DEMS project.
> We are going to build a core and an Android mobile app, based on the document, for a demo.
> The stack is React / React Native. Focus on an elegant, modern UI with full animation for actions and transitions. Focus on a luxurious, elegant user interface and user experience.
>
> First, prepare the stack. I authorise you to download and install every application that is needed. Use ready-made frameworks so the work takes as little time as possible.

Source: verbatim request in `identification/01_original.md`.

## Intent

The user wants a **demo** of the DEMS Edge Client that looks and feels premium. The demo is for showing, not for production. It has two parts:

1. **Core**: a React application representing the DEMS Core Machine (design book §6).
2. **Mobile**: a React Native Android app representing the operator tablet (design book §5).

The user's priority is the quality of the user interface and experience: elegant, modern, luxurious, with animated actions and transitions everywhere. They care more about how the demo looks and feels than about engineering depth.

This request covers **phase one only: preparing the stack**. "Pertama siapkan dulu stacknya" means "first, prepare the stack". That includes:
- installing every missing tool on this Mac;
- choosing ready-made frameworks and libraries that shorten the work;
- scaffolding projects that run.

These must be ready so the feature screens (§5.1 modules, §5.2 flow) can be built quickly in a later task.

"Pelajari dokumen" ("study the documents") is also a goal. The design book must be understood well enough that the stack fits what the demo will need, for example realtime status over WebSocket, audio level meters, video preview, and the session state machine. That understanding must also be written down for the later feature phase.

**Scale category:** New Project (greenfield demo). This task is the environment and scaffold setup phase.

## Goals

1. **Document understanding captured.** The DEMS design book is studied. The software-relevant requirements (§5, §6, §11/§12/§19, §21.2, §21.3) are summarised as input to stack choices and the later feature phase.
2. **Toolchain installed and verified.** Every tool needed to build and run a React web app and a React Native Android app is installed on this macOS arm64 host. Each tool is confirmed with version output, and an Android emulator with a tablet profile starts.
3. **Stack selected, favouring ready-made frameworks.** Choose the UI kits, animation libraries, navigation, and project tooling that give the fastest path to a luxurious, fully animated UI. Record why each was chosen.
4. **Core app scaffolded and running.** The Core app installs and its dev server runs. It renders a placeholder screen that shows the chosen UI kit and at least one animated transition.
5. **Mobile app scaffolded and running.** The mobile app builds, installs and launches on the Android tablet emulator. It renders a placeholder screen with at least one animated transition, which proves the animation stack works on the device.
6. **Demo can run without hardware.** A simulated Core backend (see Assumption A1/A2) answers at least one REST endpoint and one WebSocket heartbeat. Both apps can reach it from their runtimes, including from the Android emulator.
7. **Reproducible.** Versions are pinned, and the run/build commands and installed tool versions are documented, so the feature phase can start immediately.

## Primary Task

On this Mac, install and verify every required tool, then scaffold a running React "Core" app, a running React Native Android tablet app, and (by default) a mock Core service. Use ready-made UI and animation frameworks chosen for an elegant, modern, fully animated demo. Do not build the feature screens yet.

## Scope

- **Files**
  - Read-only source: `/Users/gsp-budi/Documents/DEMS/DEMS_Edge_Client_Engineering_Design_Book_v0.2_DOWNLOAD(2).docx`. Do not move, rename or modify it.
  - To be created: source trees for the Core web app, the mobile app, and (by default) the mock Core service; workspace/package configuration; a run guide. task-architect decides the exact paths and layout.
- **Folders**
  - `/Users/gsp-budi/Documents/DEMS/`: workspace root; new code goes here. Never under `/docs` or `/output`.
  - `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/`: task documentation.
  - Host install locations outside the workspace: the Homebrew prefix, the JDK location, the Android SDK directory and AVD home. Covered by the user's install authorisation.
  - User shell profile (for example `~/.zshrc`), for `JAVA_HOME`, `ANDROID_HOME` and `PATH` entries. Every change must be listed in the implementation docs.
- **Systems/Domains**
  - macOS 27.0.1 arm64 host toolchain: Node.js v26.8.2, npm 11.19.1, git 2.55.0, Homebrew.
  - Android toolchain: JDK, Android SDK, platform-tools/adb, build-tools, emulator, and an arm64 tablet system image and AVD.
  - React web ecosystem (Core) and React Native ecosystem (mobile).
  - Simulated DEMS Core interfaces: §21.2 REST API baseline and §5.5 realtime WebSocket channel. At this phase, a scaffold and smoke test only.
  - DEMS domain model (§21.3), session state machine (§6) and tablet flow (§5.2). These shape stack choices now and are implemented in a later phase.

### Stack decision areas (research resolves these; not decided here)

| Area | Why the request or document makes it relevant |
|------|-----------------------------------------------|
| Mobile framework and tooling (for example, a managed framework versus a bare React Native CLI) | "gunakan framework2 siap pakai" asks for ready-made frameworks and the shortest path |
| Mobile UI component kit and styling system | "UI Elegant, Modern", "mewah dan elegan" |
| Mobile animation, gesture and navigation-transition libraries | "Full Animation untuk action dan transisi" |
| Rich visuals for realtime indicators (audio level meters, timer, status pulses) | §5.4 recording screen; §5.3 pre-check gate |
| Video playback for the simulated camera preview | §5.1 Camera Preview; §5.5 low-bitrate preview stream |
| Core web build framework, UI kit, styling and animation library | "react", plus the same UI and animation demands |
| Mock Core service framework (REST and WebSocket) | §5.5 REST + Secure WebSocket; §21.2 API baseline; no hardware available for the demo |
| Shared code (TypeScript types for §21.3 entities, design tokens), monorepo tooling, package manager | Two apps built from one domain model and one visual identity; pnpm, yarn and bun are not installed |
| Node.js version compatibility | Installed Node v26.8.2 must be checked against the chosen React Native and web tooling |

### Out of scope for this task

- Feature screens and flows (§5.1 modules, §5.2 flow, §5.3 gate logic, §5.4 recording UI). These are the next task.
- Real hardware integration: cameras, microphones, GNSS, relay/GPIO, the 800x480 LCD.
- Real security and evidence functions: PKI, signing, hashing, chain of custody, encryption.
- iOS builds and Xcode setup. The user asked for Android only.
- Production hardening, app store publishing, deployment, and cloud hosting.

## Constraints

**Explicit (from the request):**
- C1. Core uses React. Mobile uses React Native and targets Android.
- C2. The UI must be elegant, modern and luxurious, with full animation for actions and transitions. UI and UX quality is the stated focus.
- C3. Use ready-made frameworks so the work takes as little time as possible.
- C4. This phase is stack preparation only ("pertama siapkan dulu stacknya").
- C5. Both apps are based on the DEMS design book.
- C6. The purpose is a demo.
- C7. The user authorises downloading and installing all required applications.

**Implicit (inferred; labelled as inferences):**
- I1. The demo must run without DEMS hardware, because no Core Machine, cameras, microphones or GNSS are available. Simulated data and services are therefore needed. Inferred from "untuk demo" together with §5/§6 hardware dependencies.
- I2. The design book is marked confidential. Its content must not appear in web search queries or be uploaded to any external service, including cloud build services, AI services and pastebins (CLAUDE.md §4 Red Lines).
- I3. The host is Apple Silicon (arm64), so tools, the JDK and Android emulator system images must be arm64-compatible.
- I4. The stack must support the §5.5 communication patterns: REST, WebSocket realtime updates with reconnect and resync, and video preview playback.
- I5. The stack must handle high-frequency UI updates (audio meters, timers) smoothly, so the animation approach should not stall on JavaScript-thread load. This is a design inference from §5.4 plus "Full Animation"; research must confirm it.
- I6. The install authorisation covers developer tooling. It does **not** cover outward-facing actions: publishing, pushing to a remote, creating third-party accounts, or uploading source to cloud build services. Those still need explicit confirmation (CLAUDE.md §4).
- I7. Do not delete, move or rename existing workspace files: the `.docx`, `graft/` and `docs/`.

## Assumptions Made

Each assumption has a recommended default. The ones marked **[confirm at gate]** would change what gets installed or scaffolded, so the controller should show them to the user at BLUEPRINT_APPROVAL rather than resolving them silently.

| ID | Assumption (recommended default) | Alternatives considered | Why | Stack impact if wrong |
|----|----------------------------------|-------------------------|-----|-----------------------|
| A1 **[confirm at gate]** | "core" = a React **web** app representing the Core Machine (supervisor/admin console, which can also host a simulated view of the 800x480 status LCD), **plus a lightweight mock Core service** (REST + WebSocket) simulating §21.2 and §5.5 | (b) web UI only, with mocks inside each app; (c) a desktop app (Electron/Tauri); (d) "core" = a shared logic library, not an app | The document calls the central unit the "Core Machine" (§6). The user named React for it. The mobile app needs something to talk to over REST/WS (§5.5), and no hardware exists | (b) removes one Node service package. (c) adds a desktop shell toolchain. (d) changes the layout to a library package |
| A2 **[confirm at gate]** | In this phase the mock Core service is a **scaffold only**: one health endpoint and one WebSocket heartbeat. The simulated session state machine (§6), audio levels and pre-check data are built in the feature phase | Build the full simulator now | Matches "pertama siapkan dulu stacknya" (stack first) | Scope grows if the full simulator is wanted now |
| A3 | The mobile target is an **Android tablet in landscape**. A tablet-profile emulator AVD is created. Phone layouts are not targeted | Phone, or both | §5 describes a tablet as the operator interface | Only the AVD profile and later layout work change |
| A4 | Demo runtime is the **Android emulator on this Mac**. The stack can also produce a sideloadable APK for a physical tablet. No Play Store | Physical-device-only demo | Physical device availability is unknown | A physical device needs USB debugging setup; no stack change |
| A5 | **TypeScript** in every package | JavaScript | Current React and React Native templates default to it; shared §21.3 types | Minor |
| A6 | Builds are **local**. No cloud build service and no third-party account without explicit user confirmation | Cloud builds | Confidential document and source (I2, I6) | A cloud build would need an account and would upload source |
| A7 | Demo data is **synthetic**: no real case, evidence or personal data | None | Demo purpose; confidentiality | None |
| A8 | A **local git repository** is initialised at the workspace root, with no remote and no push, and a `.gitignore` excluding `node_modules`, build outputs and SDK artefacts | No version control | Makes scaffold changes reviewable and reversible; the workspace is not currently a git repo | None; creates `.git/` only |
| A9 | Install through standard channels (Homebrew, official Android SDK tooling, npm). This includes accepting Android SDK licences and adding env vars to the user's shell profile, which the user's install authorisation covers. Every change is logged | Manual installers | "saya ijinkan untuk mengunduh dan install semua aplikasi" (I authorise downloading and installing everything) | None |
| A10 | UI text language (English per design-book terminology, or Indonesian for the demo audience) is decided in the **feature phase**. The stack may include i18n readiness if research finds it cheap | Decide now | It does not change which tools are installed | Adds or removes one library |

## Source Documents

| Path | Type | Purpose | References |
|------|------|---------|------------|
| `/Users/gsp-budi/Documents/DEMS/DEMS_Edge_Client_Engineering_Design_Book_v0.2_DOWNLOAD(2).docx` | document (docx, confidential, read-only) | Domain and functional source for both apps; drives stack capability needs | §5 (5.1–5.5) Tablet Software Design; §6 Core Machine Software (services, session state machine, tracks, LCD); §11/§12/§19 Evidence package and lifecycle; §21.2 Core API baseline; §21.3 Data entities |

Note: request-translator worked from the controller's extract (copied in `identification/01_original.md`). It did not read the full `.docx`. The full-document study required by Goal 1 still needs to be done (see Notes).

## Output Requirements

- **Format**: `md` for all documentation. No output-format keywords (docx/xlsx/pdf/pptx/csv/json) appear in the request, so the default applies. The functional deliverables are runnable code scaffolds, not documents.
- **Destination**:
  - Documentation: `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/` (phase folders per CLAUDE.md §3).
  - Code: under `/Users/gsp-budi/Documents/DEMS/`. task-architect decides the layout. Never `/output`.
- **Style**: English documentation. Every claim about an install or run is backed by quoted command output (tool versions, dev-server start, emulator launch, app launch). No emoji in deliverables.
- **Output Format Question**: Not applicable. This is a setup/implementation task, not a research deliverable.

## Success Criteria (Definition of Done for this phase)

1. Every required tool is installed, with version output recorded: JDK, Android SDK platform-tools, build-tools, emulator, a tablet AVD, watchman if the chosen tooling needs it, the chosen package manager, and any framework CLI. `adb devices` lists the running tablet emulator.
2. The chosen frameworks and libraries (UI kit, styling, animation, gestures, navigation for mobile and web; mock-service framework; workspace tooling) are recorded with versions and a short reason each.
3. The Core web app starts its dev server and renders a placeholder screen with a visible animated transition built with the chosen libraries.
4. The mobile app builds, installs and launches on the tablet emulator, and renders a placeholder screen with a visible animated transition built with the chosen libraries.
5. (If A1/A2 are accepted) The mock Core service starts, answers the health endpoint, and emits a WebSocket heartbeat. Both apps receive it, including the emulator through its host-loopback address.
6. A run guide lists the exact commands to install dependencies, start each part, and launch the emulator.
7. The feature phase can begin without further environment work.

## History Relevance Assessment

| Reference | Relevance | Notes |
|-----------|-----------|-------|
| (none) | None | No relevant history. `docs/` contains only this task's `README.md` and `status_tasks.md`. Workspace `.claude/` contains no memory files (Glob returned no matches). `graft/` is a cache only; there is no source code in the workspace. |

### Important Notes From History
- None. Downstream agents should not search for prior DEMS task context; none exists.

### Lessons from History
- None available.

## External Research Scope

- **Technology Trends** (Dim 1): Triggered by "Modern" and "UI Elegant, Modern, Full Animation untuk action dan transisi". Research the current (2026-09) state of the React and React Native UI and animation ecosystems. Also check which React Native, framework-tooling and Node.js release lines are current and compatible, given the installed Node v26.8.2.
- **Technology Evaluation** (Dim 2): Triggered by "gunakan framework2 siap pakai agar pekerjaan sesingkat mungkin" ("use ready-made frameworks so the work is as short as possible"). Compare the options in each area of the Stack decision areas table above. Judge them on time-to-premium-UI, animation quality and performance on Android, arm64 macOS support, and how well web and mobile work together.
- **Vendor Evaluation** (Dim 3), limited: Also triggered by "framework2 siap pakai", because this means relying on third-party frameworks. Check only licence terms (open-source versus commercial or paid tiers) and whether any option requires a third-party account or cloud service. Any cloud service is subject to I2/I6.
- Not triggered: Market Share & Positioning (Dim 4), Regulatory & Compliance (Dim 5), Competitive Landscape (Dim 6), Industry Trends (Dim 7). The evidence and chain-of-custody rules in §11/§12/§19 apply to the real product, not to a demo with synthetic data.
- **Research constraint**: Search queries must be generic technology queries. No confidential design-book content, project names beyond "DEMS", or document excerpts may appear in external queries (I2).

## Dependencies

- Internet access to download Homebrew packages, the JDK, Android SDK components and system images, and npm packages.
- Disk space: 725 GiB free is enough for the Android SDK, emulator images and `node_modules`.
- Homebrew is present (v6.0.22).
- Some installers (for example, JDK packages through Homebrew casks) may ask for an interactive administrator password. An unattended agent cannot answer it, so the user may need to act. Risk flagged for the implementation phase.
- Hardware-accelerated Android emulation on Apple Silicon (arm64 system images).
- Optional: a physical Android tablet with USB debugging, for judging animation smoothness realistically.

## Gaps / Open Items (not blocking this phase)

- Demo date and audience are unknown, so the time budget cannot be sized to a deadline.
- No brand assets were given (logo, colour palette, typography). The "luxurious and elegant" theme direction is a feature-phase design decision. The stack may reserve a design-token foundation.
- Whether a physical Android tablet is available (A4).
- UI text language (A10).

## Notes

- **Full document study (Goal 1).** request-translator saw only the controller's extract. The controller should send the full `.docx` to a document-reading or exploration agent. The resulting digest goes in `research/01_explore.md`, and it must be processed locally only (I2).
- **delegation_progress_report.md not written.** The controller allowed this agent to update it. However, this agent's file-scope boundary limits it to `identification/01_original.md` and `identification/01_translated.md`, and CLAUDE.md §3 marks that file controller-only. The entry for the controller to add is in the agent's return message.
- **Graft.** `graft/` exists but indexes no source code yet. Graft is not useful until the scaffolds exist.
- **Clarification decision.** No `CLARIFICATION_NEEDED` was raised. Every ambiguity has a low-cost, reversible default, and the stack-changing ones (A1, A2) are marked for confirmation at BLUEPRINT_APPROVAL. This avoids an extra round-trip for a user who asked for the shortest path.

---
*Generated: 2026-09-30 (clock time not available to this agent)*
*Last Updated: 2026-09-30*
