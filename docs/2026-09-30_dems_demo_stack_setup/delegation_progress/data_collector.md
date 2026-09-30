# Delegation Progress: data-collector (Blueprint Row 2)

| Field | Value |
|---|---|
| Agent | data-collector |
| Blueprint row | 2 (research, wave W1, parallel with rows 1 and 7) |
| Status | **complete** |
| Started / finished | 2026-09-30 22:34 WIB / 2026-09-30 23:05 WIB |
| Output | `research/02_collection.md` (Tier 2; 97 finding items plus a 115-row npm registry snapshot; query log included) |
| Shared files touched | None. `delegation_progress_report.md` and `status_tasks.md` were not written (parallel isolation, CLAUDE.md §3.4) |
| Filename note | The delegation asked for `delegation_progress/data-collector.md`. The docs-accountability hook blocked it (snake_case rule, CLAUDE.md §3.1), so this file is `data_collector.md`, matching the sibling files `document_reader.md` and `git_specialist.md` |

## Files created

- `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/research/02_collection.md`
- `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/delegation_progress/data_collector.md` (this file)

Nothing was installed or changed on the host. Scratchpad artefacts (npm cache, tarballs, the cmdline-tools zip, manifests) live only in the session scratchpad.

## Row-2 verification self-check

| Criterion (from 02_structured.md row 2) | Result |
|---|---|
| File exists | Yes |
| Each decision area has at least 2 options with source URLs | Yes. Area 1 compares SDK 57 vs SDK 58 beta and Node 22 / 24 / 26. Area 2 covers 8 kits. Area 3 covers 16 libraries. Area 4 covers 8 animated registries, 3 web kits and 2 dashboard templates. Area 5 covers Fastify vs Hono vs ws, and tsx vs Node type stripping. Area 6 covers npm vs pnpm (hoisted/isolated). Area 7 covers formula vs `.pkg` cask JDK and cask vs manual command-line tools. Area 8 covers every candidate |
| Every version cites official docs, release notes or quoted `npm view` output | Yes. npm view output, `npm pack` tarball files, official manifests (dl.google.com, formulae.brew.sh, nodejs.org) and official docs |
| Query log included, with no design-book text | Yes. 20 WebSearch queries, 69 WebFetch URLs, and a list of curl hosts. A grep for DEMS, evidence and Polri in the Query Log matched only the confidentiality statement itself |
| No conclusions | Yes. Facts, significance and discrepancies are recorded; no choices are made |

## Milestones for the controller to record

- M1: Expo SDK 57 pin set captured from `bundledNativeModules.json`: RN 0.86.3, React 19.2.3, Reanimated 4.5.1, worklets 0.10.1, gesture-handler ~2.32.0, Skia 2.6.2.
- M2: Node 26.8.2 is inside every engines range checked (RN 0.86.3, Metro 0.84.5, Expo CLI NODE_MIN 20.19.4, Vite 8, Vitest 5, pnpm 12). Node 26 becomes LTS on 2026-10-28. Corepack is absent locally.
- M3: The JDK 17 requirement is corroborated by RN docs, Expo docs and AGP 9.x. The SDK 57 Gradle wrapper is 9.3.1. Homebrew `openjdk` (unversioned) is 27.
- M4: Local Homebrew source confirms that `.pkg` casks (`zulu@17`, `temurin@17`) run `/usr/sbin/installer` with sudo. The `openjdk@17` formula has a macOS 27 (`arm64_golden_gate`) bottle.
- M5: Tablet AVD device IDs `pixel_tablet`, `medium_tablet` and `small_tablet` were confirmed from the official cmdline-tools 23.0 jar.
- M6: The debug cleartext allowance is present in the Expo SDK 57 bare template (evidence for H4). The 10.0.2.2 loopback alias is confirmed from official Android docs (H3). Expo CLI auto-reverses only the Metro port.

## Blockers

- None blocking.
- GitHub unauthenticated API rate limit exhausted during the session, before 22:51 WIB (reset 16:42 UTC). A few licence file checks are listed as gaps in section "Gaps" of the collection file.

## Decisions / items for the controller

- No decisions were made; this is collection only.
- Discrepancies for row 3 to resolve are listed in Gaps item 14:
  - RN docs (Platform 35) vs RN 0.86.3 catalog (compileSdk 36).
  - Reanimated 4.5.x docs table vs npm peer range.
- Licence flags for row 3's attention, as facts:
  - Animate UI and React Bits are MIT + Commons Clause.
  - The coss repo root is AGPL-3.0 (the MIT for `apps/ui` is unverified).
  - Uniwind Pro, HeroUI Pro, Tamagui Pro, Magic UI Pro, Aceternity Pro and Motion+ are paid tiers.
  - The OSS cores are free.
- A new SDK is imminent: Expo SDK 58 beta (RN 0.88 RC) since 2026-09-15; RN 0.88 stable is scheduled for 2026-10-12 (secondary).

---
*Generated: 2026-09-30 23:05 WIB*
