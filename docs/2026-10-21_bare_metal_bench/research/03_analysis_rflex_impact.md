---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
date: 2026-10-22
agent: data-analyst
row: 94
type: impact (R-FLEX blast radius, test plan, stored data, UX, rollback)
narrative_tier: 1
confidence: HIGH for caller/test enumeration (grep this session, file:line); MEDIUM for conditional effects that depend on rows 88-92 and the row 96 answers (marked "conditional")
source_structured_task: docs/2026-10-21_bare_metal_bench/identification/02_structured.md (row 94, line 262; RQs lines 89-111)
inputs: research/01_explore_rflex_{audio_identity,audio_ui,network_core,network_ui_docs,security_history}.md; masterplan/01_specs_rflex_register.md; implementation/48_rflex_restore_point.md; decisions/decisions.md D10-D12; delegation_progress/driver_rules.md (Spec waves)
last_updated: 2026-10-22
---

# R-FLEX impact analysis with test plan (row 94)

## Source Tasks
- Structured: docs/2026-10-21_bare_metal_bench/identification/02_structured.md (row 94; R-FLEX code rows 98-115)
- Translated / original: identification/01_translated.md, identification/01_original.md (not re-read; the row's scope is fully stated in 02_structured.md:262)
- Register (only source of names): masterplan/01_specs_rflex_register.md (row 87)

## Exploration & Collection Summary
- research/01_explore_rflex_audio_identity.md (row 82), research/01_explore_rflex_audio_ui.md (row 83), research/01_explore_rflex_network_core.md (row 84), research/01_explore_rflex_network_ui_docs.md (row 85), research/01_explore_rflex_security_history.md (row 86)
- No data-collector output for R-FLEX (not in the blueprint).
- Rows 88-93 (the deltas) did not exist when this row ran (`ls masterplan/` = `01_specs_register.md`, `01_specs_rflex_register.md`, `01_specs_service.md`). Where impact depends on a delta's choice, it is stated per option and marked **conditional**; row 95 picks the branch.

## 0. 5W1H (Tier 1)

| W | Answer |
|---|---|
| What | The blast radius of R-FLEX (register names AU-*, RM-*, NW-*, DB-*, W-*, CF-*) across workspaces; every production caller and test file that changes; stored-data, UX and security-visible effects; rollback and the row-115 regression plan |
| Who | Consumers: row 95 (reconcile), row 97 (refine code rows 98-114), code rows 98-114 (which test file each extends), row 115 test-expert (what to run), rows 77/120 (rollback readiness, R-FLEX-only diff), the controller (host load) |
| When | Spec stage S2, 2026-10-22, in parallel with rows 88-93 |
| Where | `apps/core-server`, `packages/shared` (incl. `openapi/openapi.json`, `src/sim`, `src/i18n/en`), `apps/core-web`, `apps/mobile` (consumer only), `scripts/host`; the Mac dev DB and the bench DB |
| Why | D10 (USB no port lock, exclusive binding, release on re-bind; ONVIF global), D11 (risk accepted), D12 (U-RF3 search answers on the camera port only; AC9) |
| How | Every register name grepped over `apps/` and `packages/` test files this session (command in section 9); production callers taken from rows 82-85 and the register; scripts and pins read from `package.json`, `scripts/test/regression.sh`, `scripts/host/test_host_profile_scripts.sh`; restore point contents listed with `tar -tzf` (read only) |
| Alternatives | DB-enforced vs service-only exclusivity (row 91); keep vs drop `usb_port` (Q-R3); scan/set-IP bound vs global (Q-R4). Their impact is costed below so rows 91/95/96 can choose with the price visible |
| Assumptions | (A1) Rows 98-114 follow the register exactly. (A2) No new operation (register OP-0 "NOT recommended"). (A3) `usb_port` kept (register DB-A3 recommendation). (A4) Q-R4 answered "stay bound" (register recommendation). Each assumption that flips changes a named part of this file |
| Gaps | Section 10 |

## Overview

R-FLEX touches four workspaces for real (core-server, shared, core-web, scripts/host) and one as a consumer only (mobile). The biggest code surface is the network side: the destination rule's point-2 refusals are pinned in 20 core-server test files, and the context shape (`otherInterfaceSubnets`, register NW-C1) in 22. The audio side is narrower (two identity rules, one service, one panel) but carries the only stored-data effect. The largest optional cost is the migration: if row 91 adds a DB object (DB-M1..M5), 25 test files that pin schema version 15 / `dbc-16` / 34 migrations move with it; a service-only exclusivity (DB-A2) costs none of them. Rollback via the row 80 restore point works but has one trap: the untracked archive contains this task's own `docs/` files, which a plain `tar -x` would overwrite with their 16:34 versions.

## Requirements (the impact the code rows must keep inside)

- F1 (D10(1), AC9): a port move keeps the binding: `PORT_DIFFERS` gone from both identity rules (RM-A1, RM-A2).
- F2 (D10(1), AC9): a bound card is not offered for a new binding: `boundTo` (AU-L1), `AUDIO_CARD_ALREADY_BOUND` (AU-R1), `READ_BOUND_AUDIO_INPUTS` (DB-A2).
- F3 (D10(1)): re-bind releases the old binding: `release` (AU-B1), `releasedDeviceId` (AU-B2), audit `RELEASED` (AU-A1).
- F4 (D10(2), D11): typed probe and stored camera are not interface-bound: `OTHER_INTERFACE_SUBNET`, `OUTSIDE_CAMERA_SUBNET`, `NO_CAMERA_SOURCE`, `NOT_CONFIGURED`-for-empty-config no longer raised for `TYPED_PROBE` / `STORED_CAMERA` (RM-N1..N4).
- NF1: points 1, 3, 4 of the destination rule and AD-02 unchanged (register 3.1 "Not removed"; row 86 §2).
- NF2: stored rows stay readable without a data migration (scale design, 02_structured.md:133-135).
- NF3: test-suite consolidation: changes extend existing test files; a new test file needs a stated reason (02_structured.md:45; memory `feedback-test-suite-consolidation`).
- NF4: host load: one heavy runner at a time; per-workspace `--maxWorkers=2` (task brief; CLAUDE.md §6; memory `feedback-test-depth-2-plus-1`).

## Key Findings

### Finding 1 - The network context rename is the widest single change [Confidence: HIGH]
- `otherInterfaceSubnets` (to become `interfaceSubnets`, NW-C1, provisional row 90) appears in 22 test files (section 4.1, list N-CTX). Every test that builds a `DestinationContext` literal names it.
- Evidence: grep -w `otherInterfaceSubnets` over test files, this session (section 9).
- Implication: if row 90 renames the member, rows 102-106 each touch these files in their own area; the rename must land in row 102 first (contract edge) or the other rows fail typecheck. A cheaper alternative for row 90: keep the member name and change only its meaning/consumers (no test-literal churn). Recorded "For row 96/95" below.

### Finding 2 - Point-2 refusal pins sit in 20 core-server test files [Confidence: HIGH]
- `OUTSIDE_CAMERA_SUBNET` 17 files, `OTHER_INTERFACE_SUBNET` 11, `NO_CAMERA_SOURCE` 3, `DestinationRefusal.NOT_CONFIGURED` 1, `COMMISSIONING_NOT_CONFIGURED` 8 files across 3 workspaces (section 4).
- Under the assumed Q-R4 "stay bound", the pins on `COMMISSIONING_SCAN` / `SET_IP` paths (factory-scan, camera-network, host-alias, set-IP cases of destination-rule and contract tests) stay true; only TYPED_PROBE / STORED_CAMERA pins flip from refusal to allow. That halves the change: the network/routes.db.test.ts (18 lines) and network/service.test.ts (7 lines) cases must be read per case to see which purpose each judges.
- Implication: row 102's "each lifted refusal has an allow test" lands in `capture/__tests__/destination-rule.test.ts` (no new file).

### Finding 3 - A migration costs 25 version-pin files; service-only costs none [Confidence: HIGH]
- Files pinning schema version 15 / `dbc-16` / 34 migrations: 9 under `apps/core-server/test/db` and 16 under `apps/core-server/src` (section 4.4, list DB-VER). Example: `test/db/migrate.db.test.ts:32` `toHaveLength(34)`, `:68` `{ schemaVersion: 15, contractRevision: 'dbc-16' }`; `test/db/boot-checks.db.test.ts:111,137`.
- B-3 (`apps/core-server/src/db/schema/boot-checks.ts:101-107`) requires `schema_meta` to EQUAL the server constants, so a migrated DB refuses an older Core and vice versa.
- Implication for row 91: DB-A1 (partial unique index) only covers serial-stating cards (register 4.2); DB-A2 is needed anyway. Recommendation: service-only (DB-A2) unless row 91 finds a concurrency gap that only a DB constraint closes. This also removes the DB-rollback burden (section 7.3).

### Finding 4 - Restore-point archive would overwrite this task's docs [Confidence: HIGH]
- `tar -tzf .data/rflex-restore-20261022/untracked.tar.gz` lists 54 members, 36 of them under `docs/2026-10-19_*` and `docs/2026-10-21_bare_metal_bench/` (incl. `status_tasks.md`, `decisions/decisions.md`, `identification/02_structured.md`). The restore command in `implementation/48_rflex_restore_point.md:85` (`tar -xzf $S/untracked.tar.gz`) extracts all of them over the current, newer files.
- Also: `tar -x` does not delete files R-FLEX creates (new migration files, a new set test), and `git apply` requires a tree at HEAD, which needs a git write (`git restore`) that the blueprint reserves to the user's word (02_structured.md:160).
- Implication: the rollback in section 7 excludes `docs/` on extraction and offers a narrower R-FLEX-only reverse patch as the default.

### Finding 5 - Mobile is a consumer only [Confidence: HIGH]
- `grep -rlE 'audio-cards|AudioCard|usbPort|capture/network/config|NetworkConfig|COMMISSIONING_NOT_CONFIGURED|DISCOVERY_ADDRESS_NOT_ALLOWED' apps/mobile/src` returned nothing. Mobile reads `interfaceCount` (`apps/mobile/src/features/capture-selector/camera-search.test.tsx:292,314,503`), which NW-S1 leaves unchanged, and imports `@dems/shared/sim` (316 imports) and `@dems/shared/api` (79), which R-FLEX changes (AU-L1, AU-B1/B2 in the sim and schemas).
- Implication: no mobile file changes (register W-X); mobile typecheck and unit run once at row 115 as consumer regression.

### Finding 6 - Count pins do not move unless an operation or schema is added [Confidence: HIGH]
- Operation count 111 is pinned in `packages/shared/test/api-registry.test.ts:362,399,401,682,878,879,896,1232,1287`, `api-openapi-scope.test.ts:339,356,507`, `openapi.test.ts:262`, `apps/core-server/test/acceptance/contract.test.ts:539-542,646`, `rbac-matrix.test.ts:1035-1038`. Component counts: `api-registry.test.ts:963`, `api-openapi-scope.test.ts:240,602` (191 schemas).
- R-FLEX adds members to existing schemas (AU-L1, AU-B1, AU-B2), not operations or named schemas (OP-0 not recommended). So the count pins stay. They move only if row 92 adds a named component schema; row 92 must state it.
- The byte-for-byte openapi pins DO move: `api-openapi-scope.test.ts:333` ("is the committed openapi.json, byte for byte"), `contract.test.ts:630` ("equals what the generator produces now"). Row 100 regenerates; these tests then pass unchanged.

### Finding 7 - Static source-text pins touch the rule binding [Confidence: HIGH]
- `apps/core-server/src/capture/__tests__/static.test.ts:1391` pins the literal text `decideDestination({ purpose, address }, facts ?? HOST_NOT_CONFIGURED)` in `production-parts.ts`. `apps/core-server/src/capture/adapters/__tests__/static.test.ts:523` pins the fence's import of `identifyRegisteredCard`; `:585`, `:632`, `:657` pin how `decideDestination` / `STORED_CAMERA` are bound and that the stored-address judgement does not name `decideDestination`/`networkInterfaces`.
- `CAPTURE_AUDIO_CARD_WRITES` (`modules/capture-inputs/audio-cards/statements.ts:61`) is read by `__tests__/capture-composition.test.ts`, `modules/capture-config/__tests__/selector-reader-inventory.test.ts`, `engine/__tests__/readdress-door.db.test.ts`, `test/acceptance/contract.test.ts`, `rbac-matrix.test.ts` (grep this session). A release that writes (slot clear or row update) adds a statement to that list only if it is a new SQL write; row 108 must say which and extend these pins.
- Implication: row 110 (single writer of static pins) owns `capture/__tests__/static.test.ts`, `capture/adapters/__tests__/static.test.ts` and `apps/core-server/test/static/*`; the `HOST_NOT_CONFIGURED` text pin changes only if row 102/103 changes that line.

## 1. Blast radius per workspace (production files)

Paths relative to the repo root. "From" = research row that found it. Assumptions A2-A4 apply.

### 1.1 apps/core-server

| Area | File:line | Change (register id) | From |
|---|---|---|---|
| Audio identity, runtime | `src/capture/adapters/audio/usb-audio-production.ts:283-293` (`CardMismatch`), `:323-326` (doc), `:331-361` (`identifyRegisteredCard`; `:342` IDENTITY_NOT_STORED, `:357-361` port branch) | RM-A1 remove; RM-A3 (Q-R3); AU-R2 (Q-R2) | 82 §3 |
| Audio identity, macOS twin | `src/capture/adapters/audio/usb-audio-macos.ts:399` (wrapper), `:490` (open) | behaviour follows the shared rule; on macOS `cardId = usb_<port>` (`macos-card-tie.ts:134`), so the card id itself is the port there: row 88 must state the macOS outcome | 82 §0.3, §2 |
| Loss watch | `src/capture/adapters/audio/mic-loss.ts:159-161`, `:291-295`; fence wiring `src/capture/fence/index.ts:769`, `:869` | no code change expected; a moved card stops raising `MIC_DISCONNECTED` (was CARD_CHANGED) | 82 §9 |
| Audio registration/listing | `src/modules/capture-inputs/audio-cards/service.ts:203`, `:298-313` (`cardAnswer`), `:372-386` (`StoredCardMatch`), `:423-444` (`matchStoredCard`), `:446`, `:479` (`unidentifiable`), `:455-459` (`MESSAGE_OF_CHANGE`), `:463-534` (`registerAudioInput`) | RM-A2, RM-A4, RM-A5, AU-L1, AU-R1, AU-B1, AU-B2, AU-R3 | 82 §5-6, 83 §2 |
| Audio statements/store | `src/modules/capture-inputs/audio-cards/statements.ts:31,37,49,57,61`; `store.ts` | DB-A2 `READ_BOUND_AUDIO_INPUTS` added; `CAPTURE_AUDIO_CARD_WRITES` extended if the release adds a write | 82 §1, register 4.2 |
| Audit list | `src/core/audit-details.ts:207` (`CAPTURE_AUDIO_INPUT_CHANGES`), key list `:673-680`; `:523-534` (CAPTURE_CONFIG_CHANGED, if AU-A2) | AU-A1 `RELEASED` | 82 §6 |
| Stored mic read (runtime) | `src/capture-composition.ts:212-268`; `src/capture/fence/sources.ts:146-148,177,222` | unchanged under A3 (keep `usb_port`); changed only if Q-R3 = drop | 82 §7 |
| Destination rule | `src/capture/destination-rule.ts:34-86` (refusal block), `:289-315` (`factsOf`), `:343-373` (`decideDestination`), `:411-448` (`decideNewCameraAddress`) | RM-N1..N4, NW-R1, NW-C1 | 84 N1, N2, N5 |
| Context builder | `src/modules/capture-config/network/facts.ts:123`, `:137-166` (`networkFactsOf`), `:174-195` (`FORM_ACCEPTED` uses `NO_CAMERA_SOURCE`) | NW-C1; RM-N3 sentinel rewrite if the constant is deleted | 84 N1, register RM-N3 |
| Binding file | `src/capture/fence/production-parts.ts:74` (`HOST_NOT_CONFIGURED`), `:80-117` (stored/typed rules), `:156-158`, `:202-209`, `:659-673`, `:720`, `:804-821` | stored/typed rules no longer refuse on null facts; scan/set-IP unchanged under A4 | 84 N1, N2 |
| Composition | `src/capture-composition.ts:19-26` (C55 fail-closed comment), `:464`, `:734-762`, `:869-871` | comment/ruling text; wiring only if rule factories change signature | 84, 85 |
| Discovery module | `src/modules/capture-discovery/connect/service.ts:364,379,385`; `typed-address.ts:40,63`; `routes.ts:28,71,131`; `readdress-route.ts:171`; `adopted-test.ts:304` | `COMMISSIONING_NOT_CONFIGURED` no longer answered on the test/typed path (RM-N4) | 84 N1, 85 |
| Discovery adapter | `src/capture/adapters/camera/discovery-collector.ts:32,63-80`; `ws-discovery.ts:178-195` (`NO_ELIGIBLE_INTERFACE` when the typed-probe source is not among the probed) | NW-K1 (value kept); source selection (NW-R1) must stay consistent with the probed set | 84 N3 |
| Source-address consumers | `src/capture/adapters/camera/stored-address.ts:208-239`; `onvif-session.ts:556`; `onvif-network.ts:375`; `stream-probe.ts:426-435`; `onvif-relay.ts:671,688,708`; `camera-watch.ts:446,454` | change only if NW-R1 changes `sourceAddress` semantics (e.g. no local bind on a routed target) | 84 N1 |
| Derived contexts | `src/modules/capture-config/factory-scan/service.ts:430,471,566-572`; `camera-network/service.ts:399-401,622-634,806-812` | NW-C1 shape only (A4: behaviour unchanged) | 84 N1 |
| Host alias | `src/capture/host-alias/facts.ts:12,27,33,52-66,124`; `caller.ts:36,241-265,472`; `lifecycle.ts:237,442` | NW-C1 shape only (A4) | 84 |
| Boot checks | `src/capture/boot/program-checks.ts:74-75,129,179-182,285-294,331-342`; `boot/checks.ts:669` | unchanged under A4 (CF-2, CF-3) | 84, register 8 |
| Network config service | `src/modules/capture-config/network/service.ts:136-139` (`configured`) | text meaning only (OP-101/102) | 85 |
| DB (conditional, row 91) | `src/db/schema/capture.ts:429-472`; `src/db/schema/meta.ts:121,123`; `src/db/migrations/0034_*`, `0035_*`, `meta/_journal.json`, `meta/0034_snapshot.json`, `meta/0035_snapshot.json` | DB-A1, DB-M1..M4 only if row 91 adds an object | register 4.1 |

### 1.2 packages/shared (incl. openapi, sim, i18n)

| File:line | Change | From |
|---|---|---|
| `src/api/capture-audio-cards.ts:94` (`CaptureAudioInputChange`), `:102-111` (reasons), `:125-157` (`CaptureAudioCardSchema`), `:175-192` (op 99 body/answer), `:289`, `:305` (contract text) | AU-A1, AU-R1, AU-L1, AU-B1, AU-B2 | 83 §1, register |
| `src/api/capture-commissioning.ts:392`, `:583` | OP-101/102 description text | 85, register |
| `src/api/capture-discovery.ts:173`, `:258`, `:510,538,629,669` | behaviour text only (OP-93..97); `interfaceCount` unchanged (NW-S1) | register |
| `src/api/examples.ts`, `src/sim/api.ts` (`simCaptureNetworkConfig` `:789`), `src/sim/capture-registry.ts` | sim answers `boundTo`, `release`, `releasedDeviceId`, `AUDIO_CARD_ALREADY_BOUND` | 83 §6, 85 |
| `src/i18n/en/common.ts:871-872` (W-N3 remove), `:1043-1085` (W-A1..W-A6) | words | register 7 |
| `openapi/openapi.json` (op 98 `:24928`, op 99 `:25197`, op 101 `:25988`, op 102 `:26218`) | regenerated by `npm run openapi:gen -w @dems/shared` (row 100) | register 2 |

### 1.3 apps/core-web

| File:line | Change | From |
|---|---|---|
| `src/features/devices/audio-cards-panel.tsx:38-80`, `:92-105`; `audio-cards.ts:78,90,158-163,170,186-189,298-312` | bound card shown and not offered (AU-L1, W-A1), release action (AU-B1, W-A2, W-A3), new refusal (W-A4) | 83 §3 |
| `src/features/devices/capture-selector-panel.tsx:418-600`; `capture-selector.ts:230-237,266-269` | conditional on AU-A2 / Q-R5: a released MIC leaves its slot | 83 §3-4 |
| `src/features/devices/camera-connect-dialog.tsx:661-665`; `camera-connect.ts:205,229` | W-N3 reader removed | register W-N3 |
| `src/features/commissioning/index.tsx:296-320`; `model.ts:75-76,242-243` | `notConfigured` alert text (W-N1); hints (W-N2); form already optional | 85 |
| `src/i18n-web.ts:132-134` (W-N3 mirror), `:759-770` (W-N1, W-N2) | words; file already modified by the uncommitted LCD work (gitStatus) | 85 |
| `src/features/devices/camera-search*.tsx` | none (NW-S1) | 85 |

### 1.4 apps/mobile
None (Finding 5; register W-X). Consumer of `@dems/shared/sim` and `@dems/shared/api` types.

### 1.5 scripts/host
| File:line | Change | From |
|---|---|---|
| `scripts/host/HOST-PROFILE-UBUNTU-24.04.md:81-85,132,161,276,293,297` | HOST-19..23/46 wording per row 93 (HOST-23 stays camera-port only, U-RF3) | 85 RQ-N6 |
| `scripts/host/40-network-firewall.sh:16,26-43,84-88` | per row 93; under U-RF3 the HOST-23 line is unchanged | 85 |
| `scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md:235,245-246,255,258-259` | wording (room network no longer assumed separate) | 85 |
| `scripts/host/test_host_profile_scripts.sh:229-238` (`:234` the only HOST-23 assertion) | unchanged if the ufw line is unchanged | 85 |

## 2. Callers that change (from rows 82-85), condensed

| Register id | Definition | Production callers that change | Source |
|---|---|---|---|
| RM-A1 | `usb-audio-production.ts:287` | `:358`; doc `:323-326`; behaviour reaches `usb-audio-macos.ts:399,490`, `capture/fence/index.ts:769,869`, `mic-loss.ts:291-295` | register 3.1; row 82 §2 |
| RM-A2 | `service.ts:380` | `service.ts:439`, doc `:417` | register |
| RM-A3/A4 (Q-R3) | `usb-audio-production.ts:289`; `service.ts:382` | `usb-audio-production.ts:342`; `service.ts:430`, doc `:50,:406` | register |
| RM-A5 (row 88) | `service.ts:446,203` | `service.ts:479` | register |
| RM-N1 | `destination-rule.ts:66` | `:353`, `:425` | register |
| RM-N2 | `destination-rule.ts:70` | `:364`, `:426` (set-IP keeps it under A4) | register |
| RM-N3 | `destination-rule.ts:72` | `:360`; `network/facts.ts:174-195` (`FORM_ACCEPTED`) | register |
| RM-N4 | `destination-rule.ts:68` (constant stays) | `:351`, `:420`; `connect/service.ts:364,385`; `production-parts.ts:74,91,116,810` | register |
| NW-C1 | `destination-rule.ts:289-315` | builder `network/facts.ts:137-166`; derived `factory-scan/service.ts:430`, `camera-network/service.ts:399,401`; readers `host-alias/facts.ts:27,33,124`, `caller.ts:36` | row 84 N1 |
| AU-L1/B1/B2/R1 | `capture-audio-cards.ts` | `service.ts:298-313,463-534`; web `audio-cards-panel.tsx`, `audio-cards.ts`; sim `capture-registry.ts` | rows 82, 83 |
| AU-A1 | `audit-details.ts:207` + `capture-audio-cards.ts:94` (lists must stay equal) | `service.ts:513-520` | register 5 |
| W-N3 | `common.ts:871-872`, `i18n-web.ts:132-134` | `camera-connect-dialog.tsx:661-665`, `camera-connect.ts:205,229` | register 7 |

## 3. Test plan principle (consolidation rule)

- Every change below EXTENDS or EDITS an existing file. No per-row test file.
- The only justified new files are conditional on row 91 adding a migration set: `apps/core-server/test/db/set17.db.test.ts` and `apps/core-server/test/db/contract-v16-delta.ts` (DB-M5). Reason: the repo's pattern is one set test and one contract delta per migration set (`set4`..`set16.db.test.ts`, `contract-v2..v15-delta.ts` all present, `ls apps/core-server/test/db`); adding set 17 cases into `set16.db.test.ts` would break that pattern. If row 91 adds no DB object, no new test file exists in R-FLEX.
- Allow/refuse pairs required by row 102 go into `capture/__tests__/destination-rule.test.ts`; the port-move case required by row 107 goes into `usb-audio-production.test.ts` (and `macos-card-listing.test.ts` for the macOS twin); exclusivity and release cases required by row 108 go into `audio-cards/__tests__/service.test.ts` and `routes.db.test.ts`.

## 4. Every test file that must be extended or changed

Line numbers are grep hits this session (command in section 9). "E" = extend with new cases, "C" = change existing assertions, "C?" = change only if the conditional choice is taken.

### 4.1 apps/core-server - audio (owner rows 107, 108)

| File | Lines (hits) | E/C | Why |
|---|---|---|---|
| `src/capture/adapters/audio/__tests__/usb-audio-production.test.ts` | PORT_DIFFERS 545,629,670,972; IDENTITY_NOT_STORED 610,672; identifyRegisteredCard 46,654,678-694,1082; usbPort 133,459-1125 | C + E | RM-A1/A3; port-move case (AC9); two-identical-cards per Q-R2 |
| `src/capture/adapters/audio/__tests__/macos-card-listing.test.ts` | PORT_DIFFERS 864,867,877; IDENTITY_NOT_STORED 889,890; identifyRegisteredCard 10,32,816,839,898 | C | macOS twin |
| `src/capture/adapters/audio/__tests__/mic-loss.test.ts` | identifyRegisteredCard 5,20,140; usbPort 79 | E | a port move raises no `MIC_DISCONNECTED` |
| `src/capture/adapters/audio/__tests__/usb-audio-macos.test.ts` | usbPort 153,401 | C? | only if macOS outcome changes (row 88) |
| `src/capture/adapters/audio/__tests__/card-listing.test.ts`, `card-listing-reader.test.ts`, `alsa-config.test.ts` | usbPort (18, 2, 2 hits) | none under A3 | listing still reads the port; C? only if Q-R3 = drop |
| `src/capture/adapters/__tests__/real.test.ts` | 128-133, 444 | C? | mutant comment names the rule; usbPort fixture only if drop |
| `src/capture/adapters/local/__tests__/mic-helper-args.test.ts` | usbPort 494 | C? | only if drop |
| `src/capture/fence/__tests__/fence.test.ts` | usbPort 1116-1143 | C? | only if drop |
| `src/__tests__/capture-composition.test.ts` | identifyRegisteredCard 25,578,1212,1230,1316,1343; usbPort 148-1037; usb_port 462 | C | composed watch passes the rule; port-move expectation |
| `src/__tests__/capture-composition.db.test.ts` | captureAudioCards 18-121; usbPort 130; usb_port 65 | C? | only if listing/answer shape asserted there |
| `src/modules/capture-inputs/audio-cards/__tests__/service.test.ts` | PORT_DIFFERS 455,480,539,551,552,622; IDENTITY_NOT_STORED 499-549; matchStoredCard 20,530-573; REENABLED 357-665; AUDIO_INPUT_NOT_REGISTRABLE 396,522,523; CAPTURE_AUDIO_INPUT_CHANGED 364,365,444,445,585,586,642,754 | C + E | RM-A2/A4/A5; AU-R1 refusal; AU-B1 release + AU-A1 audit; `boundTo` in `cardAnswer` |
| `src/modules/capture-inputs/audio-cards/__tests__/routes.db.test.ts` | PORT_DIFFERS/IDENTITY_NOT_STORED 533; REENABLED 338-529; usb_port 323-528; CAPTURE_AUDIO_INPUT_CHANGED 306-635 | C + E | row 108 verification: bound card refused; re-bind releases with audit |
| `src/modules/capture-inputs/audio-cards/__tests__/fixtures.ts` | (row 82 §8) | C? | if fixtures gain `boundTo` |
| `src/modules/capture-config/__tests__/e2e/first-full-session.db.test.ts` | usb_port 442; captureAudioCards 104,517 | C? | only if drop or answer shape asserted |
| `src/core/__tests__/writers.test.ts` | CAPTURE_AUDIO_INPUT_CHANGED 352-354,479,534,1131,1157-1160 | C | AU-A1 closed list + audit text |
| `src/db/fixtures/__tests__/audit-details.test.ts` | 200 | C | AU-A1 in fixture audit vocabulary |
| `src/modules/capture-config/__tests__/routes.test.ts` | 62,63,67 | C? | AU-A2 slot clear only |
| `src/modules/capture-config/__tests__/selector-reader-inventory.test.ts` | CAPTURE_AUDIO_CARD_WRITES | C? | only if the release adds a write statement |
| `src/engine/__tests__/readdress-door.db.test.ts` | CAPTURE_AUDIO_CARD_WRITES; capture_network_config 295 | C? | same |

### 4.2 apps/core-server - network (owner rows 102-106)

| File | Lines (hits) | E/C | Owner row |
|---|---|---|---|
| `src/capture/__tests__/destination-rule.test.ts` | OUTSIDE_CAMERA_SUBNET 195,227,234,235,240,244,245,368,369; OTHER_INTERFACE_SUBNET 214,219,370; NO_CAMERA_SOURCE 250; NOT_CONFIGURED 171,266,270,408-410; otherInterfaceSubnets 42,61,160,168,184,192,218,263; decideNewCameraAddress 24,344-351,441-444 | C + E | 102 |
| `src/capture/adapters/camera/__tests__/stored-address-cases.ts` | 17, 62, 63 | C | 103 |
| `src/capture/adapters/camera/__tests__/stored-address.test.ts` | 6, 160 | C? | 103 |
| `src/capture/adapters/camera/__tests__/onvif-network.test.ts` | 21, 277, 280, 293 | C? (set-IP: unchanged under A4; NW-C1 shape) | 103 |
| `src/capture/adapters/camera/__tests__/onvif-relay.test.ts` | 75, 585 | C | 103 |
| `src/capture/adapters/camera/__tests__/camera-watch.test.ts` | 35, 672, 692 | C | 103 |
| `src/capture/adapters/camera/__tests__/ws-discovery.test.ts` | otherInterfaceSubnets 489; decideDestination 17,494,592; NO_ELIGIBLE_INTERFACE 371,584 | C + E (typed probe source outside the probed set) | 103 |
| `src/capture/adapters/camera/__tests__/discovery-collector.test.ts` | DISCOVERY_MAX_INTERFACES 11, 54 | C? (NW-K1 value kept) | 103 |
| `src/modules/capture-discovery/__tests__/search.test.ts` | 543, 548 | C | 104 |
| `src/modules/capture-discovery/__tests__/adopted-test.test.ts` | 8,19,36,39,311,312 | C | 104 |
| `src/modules/capture-discovery/__tests__/readdress.test.ts` | 16,39,43,195,427,453,457,460 | C | 104 |
| `src/modules/capture-discovery/__tests__/readdress.db.test.ts` | 66 | C (NW-C1) | 104 |
| `src/modules/capture-discovery/connect/__tests__/service.test.ts` | COMMISSIONING_NOT_CONFIGURED 743,744,752,760,765; 664,676,772 | C | 104 |
| `src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts` | NO_ELIGIBLE_INTERFACE 380-396 | C? | 104 |
| `src/modules/capture-config/network/__tests__/service.test.ts` | networkFactsOf 36-222; OUTSIDE 79,153,782,790,855,858,867; OTHER 80; NO_CAMERA_SOURCE 137,161; otherInterfaceSubnets 65 | C | 105 |
| `src/modules/capture-config/network/__tests__/routes.db.test.ts` | OUTSIDE 326-567 (18 lines); OTHER 327; NO_CAMERA_SOURCE 338,488,567; capture_network_config 120-578 | C (per case: purpose decides) | 105 |
| `src/modules/capture-config/factory-scan/__tests__/service.test.ts` | COMMISSIONING_NOT_CONFIGURED 182-184,586,587; otherInterfaceSubnets 97 | C? (A4: unchanged except NW-C1) | 105 |
| `src/modules/capture-config/factory-scan/__tests__/routes.db.test.ts` | 9,38,81,241,242 | C? | 105 |
| `src/modules/capture-config/camera-network/__tests__/service.test.ts` | 31,76,77,115,260,261,287,639 | C? | 105 |
| `src/modules/capture-config/camera-network/__tests__/routes.db.test.ts` | 45,107,111,119,293,295 | C? | 105 |
| `src/modules/capture-config/__tests__/credential-reader.test.ts` | 21,67,71,406,407,545 | C | 105 |
| `src/modules/capture-config/__tests__/credential-reader.db.test.ts` | 41,52,148,344 | C | 105 |
| `src/modules/capture-config/__tests__/camera-adapter-open.db.test.ts` | 38,73,108,433,475,697,698 | C | 105 |
| `src/modules/capture-config/__tests__/adopted-camera-test.db.test.ts` | 99,144,147,550 | C | 105 |
| `src/capture/host-alias/__tests__/caller.test.ts` | otherInterfaceSubnets 51-427; INTERFACE_FILE_DIFFERS_FROM_ROW 405-428; NETWORK_NOT_CONFIGURED 407,408 | C? (NW-C1 only under A4) | 106 |
| `src/capture/host-alias/__tests__/lifecycle.test.ts` | 50, 639, 640, 965, 995 | C? | 106 |
| `src/capture/host-alias/__tests__/lifecycle.db.test.ts` | 56 | C? | 106 |
| `src/capture/boot/__tests__/program-checks.test.ts`, `checks.test.ts`, `boot.test.ts`, `host-support.ts` | INTERFACE_FILE_DIFFERS_FROM_ROW 116-121; 601-606; 551,555,703; 185 | none under A4 | 106 |
| `src/capture/__tests__/boot.db.test.ts` | capture_network_config 179-189 | none under A4 | 106 |
| `src/__tests__/capture-composition.test.ts` | OTHER 265; OUTSIDE 296,297; otherInterfaceSubnets 79 | C | 109 |
| `src/__tests__/capture-composition.db.test.ts` | OUTSIDE 327,331; OTHER 332; otherInterfaceSubnets 54; INTERFACE_FILE_DIFFERS_FROM_ROW 828,830 | C | 109 |
| `src/__tests__/host-alias-socket.test.ts` | otherInterfaceSubnets 176 | C? (NW-C1) | 109 |
| `test/support/loopback-destination.ts`, `test/support/stored-camera-address.ts` | 7, 21 | C | 102 (support used by many) |

### 4.3 apps/core-server - static pins and acceptance (owner rows 109, 110)

| File | Lines | E/C | Why |
|---|---|---|---|
| `src/capture/__tests__/static.test.ts` | 1391 (`facts ?? HOST_NOT_CONFIGURED` text pin) | C? | only if `production-parts.ts:810` changes |
| `src/capture/adapters/__tests__/static.test.ts` | 523 (fence imports `identifyRegisteredCard`), 585, 632, 657 (rule binding / judgement text) | C? | only if the fence import or the binder text changes |
| `test/static/imports.test.ts`, `test/static/module-rules.ts`, `test/static/routes.test.ts`, `test/static/search-path.test.ts` | (rule tables; `search-path.test.ts` names the migration constants) | C? | a new module import edge (e.g. audio-cards service importing the identity rule to share it) or a new migration file name |
| `test/acceptance/contract.test.ts` | audio flows 183,1186-1232; network 199,1246-1317,1445; rule direct 75,79,1306,1424,1425; openapi equality 630-646; count pins 539-542 | C | flows answer `boundTo`/release; TYPED_PROBE no longer `COMMISSIONING_NOT_CONFIGURED`; counts stay |
| `test/acceptance/rbac-matrix.test.ts` | 100,386,433,1134-1140,1386; counts 1035-1038 | none expected | no new operation (A2) |
| `src/plugins/permission-guard/__tests__/access-rules.test.ts` (136-142), `decision.test.ts` (99,154,390), `src/modules/devices/__tests__/routes.test.ts` (112,118) | | none expected | access unchanged |

### 4.4 apps/core-server - database (owner row 98; conditional on row 91)

Under "service-only" (DB-A2, no migration): none of these change except `test/db/constraints.db.test.ts` if row 91 adds a case proving no new constraint (optional).

If row 91 adds a DB object (DB-M1..M5), list DB-VER (files pinning version 15 / `dbc-16` / 34 migrations, grep this session):
- `apps/core-server/test/db/`: `boot-checks.db.test.ts` (111,137), `migrate.db.test.ts` (32,68,91,92,107), `set4.db.test.ts` (134-140), `commands.db.test.ts`, `catalog.db.test.ts` (205,399), `contract-inventory.ts` (314-342), `contract-inventory.test.ts` (81), `contract-inventory.json`, `contract-v15-delta.ts`, `set16.db.test.ts` (253,524,543), `constraints.db.test.ts` (313,471, new index), `privileges.db.test.ts` (144-155), `fixtures.ts` (789)
- `apps/core-server/src/`: `capture/fence/__tests__/development-session.db.test.ts`, `capture/fence/__tests__/fence.db.test.ts`, `transcription/__tests__/snapshot-store.db.test.ts`, `plugins/permission-guard/__tests__/session-holder.db.test.ts`, `db/reset/__tests__/m4-sec-reset.db.test.ts`, `db/reset/__tests__/reset-failures.db.test.ts`, `db/reset/__tests__/store-root.db.test.ts`, `db/seed/__tests__/seed.db.test.ts`, `sealing/__tests__/stt-states.db.test.ts`, `sealing/__tests__/production-key-proof.db.test.ts`, `sealing/__tests__/last-resort.db.test.ts`, `modules/capture-inputs/audio-cards/__tests__/routes.db.test.ts`, `modules/capture-discovery/connect/__tests__/connect.db.test.ts`
- New (justified, section 3): `test/db/set17.db.test.ts`, `test/db/contract-v16-delta.ts`
- If Q-R3 = drop `usb_port` additionally: `test/db/set9.db.test.ts` (31 hits), `contract-v8-delta.ts` (16,141,152), `src/db/reset/__tests__/m2-guard-keepset.db.test.ts` (202) and the C? rows of 4.1.

Note: the version-pin list is "files that contain the literal", not "assertions that fail"; some may read the constant. Row 98 confirms by running `test:db` once.

### 4.5 packages/shared (owner rows 99-101)

| File | Lines | E/C | Why |
|---|---|---|---|
| `test/api-capture-discovery.test.ts` | CaptureAudioInputChange 93,764,769; ops 262,264,627-639,676,770; NOT_REGISTRABLE 657; usbPort 718,721 | C + E | AU-L1, AU-B1, AU-B2, AU-R1, AU-A1 |
| `test/api-capture-commissioning.test.ts` | 96,114,162,171,189,409 | C | OP-101/102 description; `COMMISSIONING_NOT_CONFIGURED` text at 409 |
| `test/openapi.test.ts` | audio 771-795; network 834-854; count 262 | C | schema members; count unchanged |
| `test/api-openapi-scope.test.ts` | byte pin 333; ops 124,129; counts 240,339,356,507,602 | pass after regeneration | Finding 6 |
| `test/api-registry.test.ts` | rows 199,200,218; 470,478,706; counts 362-1287 | C? | only if the registry row text (description/source column) is pinned verbatim |
| `test/api-text-rule.test.ts` | 160 | C? | contract text rule over the changed descriptions |
| `test/sim-capture-discovery.test.ts` | 546-553, 580, 581, 591 | C + E | sim answers bound/release |
| `test/i18n.test.ts`, `test/i18n-vocabulary-sync.test.ts` (194) | | C | W-A1..A5 added, W-N3 removed |

### 4.6 apps/core-web (owner rows 111, 112)

| File | Lines | E/C | Why |
|---|---|---|---|
| `src/features/devices/__tests__/audio-cards.test.tsx` | 2,3,26,42-334 (NOT_REGISTRABLE 62,168,242; REENABLED 82,183-219) | C + E | bound card shown not offered; release flow; AU-R1 refusal sentence; CARD_CHANGED text |
| `src/features/devices/__tests__/selector-microphones.test.tsx`, `capture-selector.test.tsx` | (row 83 §6) | C? | only if AU-A2 empties a slot |
| `src/features/devices/__tests__/camera-connect.test.tsx` | 51, 53 | C | W-N3 removed |
| `src/features/devices/__tests__/camera-connect-canary.test.tsx` | 258,267,271,273,274,294 | C | same |
| `src/features/commissioning/__tests__/commissioning.test.tsx` | 239,414-501,611,909,1480-1486 | C | W-N1/W-N2 text; `COMMISSIONING_NOT_CONFIGURED` cases |
| `src/features/devices/__tests__/camera-search.test.tsx` | interfaceCount 60 | none | NW-S1 |
| `src/test/live-devices-capture-selector.test.tsx`, `selector-in-force.test.tsx` | (row 83 §6) | C? | AU-A2 only |

### 4.7 apps/mobile
No file changes. `src/features/capture-selector/camera-search.test.tsx` (292,314,345,351,503) must pass unchanged.

### 4.8 scripts/host (owner rows 113, 114)
- `scripts/host/test_host_profile_scripts.sh:229-238` (HOST-23 assertion `:234`): unchanged under U-RF3; extended only if row 93 adds an item. Also counts "the 49 items of HOST-PROFILE" (header `:6-7`): an added or removed HOST item moves that count.

## 5. Static pin tests and count pins (summary for row 110)

| Pin | Where | Moves? |
|---|---|---|
| Operation count 111 | Finding 6 list | No (A2). Moves to 112 only with OP-0 |
| Component schema count 191 / offline 71 | `api-registry.test.ts:963`; `api-openapi-scope.test.ts:240,602` | Only if row 92 adds a NAMED schema |
| openapi byte pin | `api-openapi-scope.test.ts:333`; `contract.test.ts:630` | Regenerated by row 100; pass |
| Migration count 34, version 15 / dbc-16 | section 4.4 DB-VER | Only with a migration set |
| Audit change closed list | `writers.test.ts:352,479,534`; shared `CaptureAudioInputChange` `api-capture-discovery.test.ts:93,764,769` | Yes (AU-A1); both lists equal |
| Source-text pins | `capture/__tests__/static.test.ts:1391`; `capture/adapters/__tests__/static.test.ts:523,585,632,657` | Only if those source lines change |
| Writes inventory | `CAPTURE_AUDIO_CARD_WRITES` readers (Finding 7) | Only if the release adds a write statement |
| Host profile items 49 | `test_host_profile_scripts.sh:6-7` | Only if row 93 adds/removes an item |
| `network.test.ts` (listen host, CORS, outbound module exemptions `:153-198`) | `apps/core-server/test/static/network.test.ts` | No: it does not pin camera-subnet rules (row 85) |

## 6. Stored data effects

### 6.1 `capture_audio_inputs`

| Row state | Today | After R-FLEX (A3 keep) | Evidence |
|---|---|---|---|
| `usb_serial` set | matched by serial on any port | unchanged | `usb-audio-production.ts:347-355` |
| `usb_serial` NULL, `usb_port` set | matched only at the stored port; elsewhere `CARD_CHANGED`/`PORT_DIFFERS` -> loss watch raises `MIC_DISCONNECTED` | matched as "any unit of the model" at the stored device index; port still refreshed by `REFRESH_AUDIO_INPUT` on re-registration, no longer compared | `:357-361`; `mic-loss.ts:291-294`; `statements.ts:57` |
| both NULL (rows from before 0017) | `IDENTITY_NOT_STORED` (said as CARD_CHANGED until re-registered) | per Q-R3/RM-A3: "any unit of the model" if removed; unchanged if kept | `:342-343`; register RM-A3 |
| two non-retired rows of one physical card (multi-input card, or renamed `card_id`) | allowed | now "bound" for both; a NEW binding of that card refused (AU-R1). If DB-A1 is created and Q-R1 = (a), index creation FAILS on such data | row 82 §5; register DB-A1, Q-R1 |
| `retired_at` set | ignored by the partial key, but NOT filtered by `statements.ts:31,37` | DB-A2 must filter `retired_at IS NULL`, else a retired MIC blocks its card forever | row 82 §0.4 |

- No data migration is needed under A3 (row 82 §7).
- Pre-migration check (only if DB-A1 is used), read-only, for the Mac dev DB at row 98 and the host DB before row 44's migrate: `SELECT usb_id, usb_serial, count(*) FROM capture_audio_inputs WHERE retired_at IS NULL AND usb_serial IS NOT NULL GROUP BY 1, 2 HAVING count(*) > 1;` expected 0 rows.
- Bench host: the install DB is created fresh at row 44 after gate G-RF; the seed builds 0 rows of both tables (`apps/core-server/src/db/fixtures/minimums.ts:105,109`). So the bench has no pre-R-FLEX rows; the first rows are the user's own bindings at rows 125-127. The Docker-era pg_dump of 2026-10-21 (D2) is not restored by the blueprint; whether it holds audio rows is unknown (not read; no host access in this wave).
- Both tables are kept across `db:reset` (`src/db/reset/kept-tables.ts:86,116`; pinned `kept-tables.test.ts:57,94,117,178`): R-FLEX does not change the keep-set.

### 6.2 `capture_network_config`
- Singleton; `interface_name`, `camera_subnet` already nullable (register F10). No DB change (DB-N1, DB-N2).
- Behaviour change for a stored row with both NULL (the unwritten state, `network/service.ts:125-127`): today every destination purpose is refused `NOT_CONFIGURED` (fail-closed ruling C55, `capture-composition.ts:19-26`); after R-FLEX, typed probe and stored cameras dial without any config. Scan and set-IP stay refused under A4.
- A stored row WITH values keeps driving scan/set-IP and the HOST-46 boot comparison (A4).
- `configured` flag: same computation, narrower meaning (OP-101/102 text).

### 6.3 `audit_events`
- New value `RELEASED` of `CAPTURE_AUDIO_INPUT_CHANGED` (AU-A1). Audit rows are append-only; after a code rollback, existing `RELEASED` rows remain in the DB. Whether the pre-R-FLEX code reads (rather than only writes) the `change` value against its closed list is not verified: **hypothesis** that the reader tolerates it; row 108 should confirm, because it decides whether a rollback must also roll back the DB (section 7.3).

## 7. Rollback

### 7.1 What the restore point holds (row 80)
`/Users/gsp-budi/Documents/DEMS/.data/rflex-restore-20261022/`: `head.txt` (e05a1567, `task4/input-av-core-port`), `porcelain.txt`, `tracked.diff` (22 files, sha256 ec4896...8501), `untracked.tar.gz` (54 members: 36 under `docs/`, 18 code/deploy files), `SHA256SUMS` (bare file names, so it must be checked from inside the folder). Evidence: `implementation/48_rflex_restore_point.md:62-87`; `cat SHA256SUMS`, `tar -tzf` this session.

### 7.2 Code rollback (needs the user's word: it rewrites tracked files and removes files, 02_structured.md:160)

**Option R-B (recommended): reverse only the R-FLEX change.** Keeps docs and anything else written after row 80.
1. At row 120 (or before any rollback), build the R-FLEX-only patch without a git write: in a scratch folder `a/`, export HEAD with `git archive e05a1567 | tar -x -C a` (read-only on the repo), then `(cd a && git apply --binary <S>/tracked.diff && tar -xzf <S>/untracked.tar.gz --exclude 'docs/*')`; make `b` a symlink to the repo; then for each R-FLEX path root `apps packages scripts`: `diff -ruN --exclude=node_modules a/<root> b/<root>` appended into `<REQ:rflex_only_diff>` in the restore folder, with its sha256. Restricting to `apps packages scripts` keeps `.cache/`, `graft/`, `.data/` and `docs/` out. Binary files (none expected in R-FLEX) would show as "Binary files differ" and must be listed by hand. Row 120 already records an R-FLEX-only diff hash (02_structured.md, row 120).
2. Rollback: `cd /Users/gsp-budi/Documents/DEMS && patch -R -E -p1 --dry-run < <REQ:rflex_only_diff>`, then without `--dry-run`. `-E` removes files that become empty, which are the files R-FLEX created (e.g. `0034_*.sql`, `set17.db.test.ts`); the host's `patch` is `patch 2.0-12u11-Apple` (`patch --version`, this session), which accepts `-R`, `-E` (`--remove-empty-files`), `-p` and `-C, --check, --dry-run` (`patch --help` / `man patch`, this session).
3. Check: `git diff HEAD --binary | shasum -a 256` equals `ec4896...8501` and `git ls-files -o --exclude-standard` outside `docs/` equals the archive's 18 non-docs members.

**Option R-A: full restore of the row-80 state** (whole tree back; also undoes any non-R-FLEX edit made since).
```
cd /Users/gsp-budi/Documents/DEMS
S=.data/rflex-restore-20261022
(cd $S && shasum -a 256 -c SHA256SUMS)                 # 4 x OK, before anything else
git restore --source=HEAD --staged --worktree -- . ':!docs'   # USER'S WORD: git write
# remove files R-FLEX created (list them from `git ls-files -o --exclude-standard` vs the archive list) - USER'S WORD: deletion
git apply --binary $S/tracked.diff
tar -xzf $S/untracked.tar.gz --exclude 'docs/*'        # never overwrite this task's docs
git diff HEAD --binary | shasum -a 256                  # must equal ec4896...8501
```
Note: `implementation/48_rflex_restore_point.md:86` writes the integrity check as `shasum -a 256 -c $S/SHA256SUMS` from the repo root; with bare names in the file that form fails to find the files. Run it inside the folder as above.

### 7.3 DB rollback
- No down migrations exist: the migrator applies forward only and MG-4 forbids editing applied files (`apps/core-server/src/db/commands/migrations.ts:1-18`). B-3 refuses a Core whose constants differ from `schema_meta` (`src/db/schema/boot-checks.ts:101-107`).
- **If no migration (service-only)**: no DB rollback. Rows written by R-FLEX (released slots = NULL, `RELEASED` audits) are valid under the old schema (capture_config slots nullable, register DB-C1); see 6.3 hypothesis.
- **If migration set 17 is applied**:
  - Mac test DBs: none to roll back; each run creates and drops its own `dems_test_*` database (`apps/core-server/test/support/reset.ts:12,96-117`).
  - Mac dev DB (only if a row runs `npm run db:migrate` against it): take `pg_dump -Fc` before row 98 touches it; rollback = restore that dump, or drop and `npm run db:create && npm run db:migrate && npm run db:seed` with the rolled-back tree. Row 98's verification names "the Mac test DB" only, so the dev DB should stay untouched until row 115.
  - Bench host DB: created at row 44 after G-RF with the R-FLEX journal head. Rollback = drop that bench DB and re-run row 44 with the rolled-back tree (no production data on the bench; operators re-type passwords per D6/OI-1). Taking a `pg_dump` right after row 44 makes a forward-only recovery possible.

### 7.4 Host-doc and script rollback
Covered by R-B/R-A (files under `scripts/host`). Nothing is applied on the host by R-FLEX rows 113-114 (docs and print-only test).

## 8. UX effects

| Surface | Before | After | Words |
|---|---|---|---|
| Console, sound cards panel (`audio-cards-panel.tsx`) | every input selectable; registered ones carry a chip; serial/port never drawn | a bound card shows "Bound to MIC-nn" and its inputs are not offered; an explicit move action re-binds and reports the released MIC | W-A1..W-A4 |
| Console, after moving the USB plug | mic becomes a fault (`MIC_DISCONNECTED`), re-registration answered CARD_CHANGED | nothing happens; the binding holds (AC9) | W-A5 text change |
| Console, 4-slot selector | slot keeps MIC id through CARD_CHANGED | conditional (AU-A2, Q-R5): a released MIC may leave its slot "Not assigned"; a release during an open session is refused (`CAPTURE_CONFIG_LOCKED`, row 83 §4) | existing |
| Commissioning page | warning "until both are set, a scan is refused"; search/connection need the config | warning narrower; hints say what interface/subnet are still for | W-N1, W-N2 |
| Camera connect dialog | "network not configured" message possible | message removed; the test dials on any interface | W-N3 removed |
| Camera search | up to 4 interfaces probed (unchanged); typed address only inside the camera subnet | typed address on any interface subnet; on the bench, answers on non-camera interfaces are dropped by ufw (HOST-22 default deny, HOST-23 camera port only, U-RF3), so the list in practice still comes from the camera port | none new (NW-S1) |
| Mobile | | no visible change | W-X |
| Security posture | Core cannot dial the office LAN | Core can dial private addresses on any host interface (D11; points 1, 3, 4 stay) | row 89/117 |

## 9. Regression surface and the row-115 run

### 9.1 Regression surface per workspace

| Workspace | Surface | Suite command (once) | Source |
|---|---|---|---|
| all | typecheck, lint | `npm run typecheck`; `npm run lint` | root `package.json` scripts `typecheck`, `lint` |
| packages/shared | unit incl. openapi, registry, sim, i18n | `npm run test -w @dems/shared -- --maxWorkers=2` | `packages/shared/package.json` `test: vitest run` |
| apps/core-server unit | capture, modules, static, acceptance | `npx vitest run --root apps/core-server --project unit --maxWorkers=2` | `scripts/test/regression.sh` step 5 (uses 4 there; this row lowers to 2 per the host rule) |
| apps/core-server db | module db tests, `test/db`, composition db | `/usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2` | regression.sh step 6; root `test:db` |
| apps/core-web | devices, commissioning, selector | `npm run test -w @dems/core-web -- --maxWorkers=2` | regression.sh step 7 |
| apps/mobile (consumer) | shared types and sim | `npx -w apps/mobile jest --maxWorkers=2` | regression.sh step 8 |
| scripts/host | profile scripts print-only | `bash scripts/host/test_host_profile_scripts.sh` | script header `:4` (no npm script exists) |
| apps/core-server composed capture (fence + composition) | dev session through the changed wiring | `npm run test:dev-session-e2e` | root `package.json` (already wraps `heavy-host.lock` + `db-migrate.lock`, `--maxWorkers=1`) |

### 9.2 Row-115 order (strictly one after another; one heavy runner on the host)
1. `npm run typecheck` 2. `npm run lint` 3. shared unit 4. core-server unit 5. core-server db 6. core-web unit 7. mobile unit 8. host-script test 9. dev-session e2e.
- Wrap each of steps 4-7 and 9 in `/usr/bin/lockf -k -t 3600 .locks/heavy-host.lock` so no other heavy runner (Gradle, emulator, another vitest) overlaps; the lock file exists (`ls .locks`). Stop idle emulators and dev stacks first (CLAUDE.md §6).
- Needs the Bash sandbox off and the project PostgreSQL up (`npm run pg:start`) for step 5 and 9 (regression.sh header).
- Test depth: one run per suite; a failure is routed to the owning row (section 4 owner column), fixed, and only that suite re-run once (memory `feedback-test-depth-2-plus-1`; row 115 verification).
- Not run at row 115 (not touched by R-FLEX): regression.sh steps 4 (capture-protocol), 9 (transcriber), 10 (mock-core), 11 (pg-scripts), 12 and 16 (capture worker C code), 13 (seal e2e), 15 (kill matrix). The full `npm run test:regression` (about 75 min, regression.sh header) stays available if gate G-RF asks for it; it hard-codes `--maxWorkers=4` for core-server unit, so it does not follow the 2-worker rule as written.

### 9.3 Grep used for section 4 (reproducible)
```
cd /Users/gsp-budi/Documents/DEMS
for pat in PORT_DIFFERS IDENTITY_NOT_STORED OTHER_INTERFACE_SUBNET OUTSIDE_CAMERA_SUBNET NO_CAMERA_SOURCE \
  COMMISSIONING_NOT_CONFIGURED networkNotConfigured otherInterfaceSubnets DISCOVERY_MAX_INTERFACES \
  AUDIO_INPUT_NOT_REGISTRABLE matchStoredCard identifyRegisteredCard CaptureAudioInputChange usbPort usb_port \
  interfaceCount capture_network_config HOST_NOT_CONFIGURED; do
  grep -rnw --include='*.ts' --include='*.tsx' "$pat" apps packages | grep -v node_modules | grep -E '__tests__|/test/|\.test\.'
done
grep -rlE "dbc-16|schemaVersion: 15|schema_version: 15" apps/core-server --include='*.ts'
```

## Files and Modules Involved
Sections 1 and 4 (every path with its role).

## Implementation Order (impact view; row 97 owns the final order)
1. Row 102 (destination rule + `destination-rule.test.ts`, `test/support/loopback-destination.ts`, `stored-camera-address.ts`) first: NW-C1 shape is a contract for rows 103-106 and 109.
2. Row 99 then 100 (shared API, openapi regeneration) before 111/112 (web) and before 104/108 route tests.
3. Row 107 before 108 (identity rule before exclusivity).
4. Row 110 last among code rows (static pins after composition, 109).
5. Row 98 only if row 91 adds a DB object; then it gates every db test (DB-VER list) through the `db-runner` lock.

## Risks

| Risk | Trigger | Mitigation | Stop rule |
|---|---|---|---|
| Rollback overwrites task docs | `tar -xzf untracked.tar.gz` without exclusion | R-B reverse patch; R-A with `--exclude 'docs/*'` | any rollback command not listing the docs exclusion is not run |
| NW-C1 rename breaks 22 files at once | row 90 renames `otherInterfaceSubnets` | land row 102 first; or keep the member name (For row 96) | typecheck red after row 102 -> rows 103-106 wait |
| Version-pin churn (25 files) | row 91 adds a migration | prefer DB-A2 service-only (Finding 3) | - |
| Retired MIC blocks its card forever | DB-A2 query without `retired_at IS NULL` | row 108 case in `service.test.ts` with a retired row | - |
| DB-A1 creation fails on existing duplicates | Q-R1 (a) with two live rows of one serial card | pre-migration check query (6.1) | query returns rows -> stop row 98 / row 44 |
| Typed probe source outside the probed interfaces | NW-R1 picks a source interface that the four-interface bound did not probe | ws-discovery case (4.2) | - |
| Host overload during row 115 | parallel heavy runners | `heavy-host.lock` per step, `--maxWorkers=2`, idle emulators stopped | load average high or tests time out -> pause, do not add runners |
| Audit reader rejects `RELEASED` after rollback | rollback with RELEASED rows present | confirm at row 108 (6.3) | - |

## Acceptance Criteria (for this row and for row 115)
1. Every test file in section 4 named with lines; no R-FLEX test file outside section 3's two conditional exceptions.
2. Row 115 reports a pass count for each of the 9 suites in 9.2 with command output, each run once (second run only after a fix).
3. Rollback dry-run (`patch -R --dry-run`) succeeds at row 77 and the restore-folder `SHA256SUMS` check prints 4 x OK.
4. Pre-migration duplicate query returns 0 rows wherever a migration set 17 is applied.
5. Count pins (operation 111, schemas 191) unchanged unless row 92 records an added named schema.

## Recommendations
1. Row 91: enforce exclusivity in the service (DB-A2) without a migration; it avoids 25 version-pin edits and the DB rollback path.
2. Row 90: keep the `DestinationContext` member name if the meaning can change without a rename; otherwise land row 102 first.
3. Row 77/120: build `<REQ:rflex_only_diff>` and use rollback R-B; correct the integrity-check form of 48_rflex_restore_point.md:86.
4. Row 115: run 9.2 in order under `heavy-host.lock` with `--maxWorkers=2`; do not run `npm run test:regression` as the default.
5. Row 108: filter `retired_at IS NULL` in `READ_BOUND_AUDIO_INPUTS` and confirm the audit reader behaviour for `RELEASED`.

## For row 96 (open questions)

| Id | Question | Options | Recommendation |
|---|---|---|---|
| I-1 | Which rollback form is approved for R-FLEX before the commit (row 120)? | R-B reverse R-FLEX-only patch / R-A full restore to row 80 | R-B: touches only R-FLEX files, keeps docs and later work |
| I-2 | Does row 115 run the full `test:regression` (about 75 min, `--maxWorkers=4` hard-coded) or the 9-suite R-FLEX set? | full / R-FLEX set | R-FLEX set (9.2); full only if gate G-RF asks |
| I-3 (to row 95, not the user) | Rename `otherInterfaceSubnets` -> `interfaceSubnets` (NW-C1) or keep the name | rename / keep | keep, unless row 90 needs the new meaning visible in the type |

## 10. Gaps
- Rows 88-93 were not available: conditional rows are marked C? and must be resolved by row 95/97.
- Per-case purpose of the 18 `OUTSIDE_CAMERA_SUBNET` hits in `network/__tests__/routes.db.test.ts` and 7 in `network/__tests__/service.test.ts` not read case by case (they may judge scan/set-IP, which stay bound under A4).
- Version-pin list is by literal match; which assertions actually fail is known only after the row-98 db run.
- Audit reader tolerance of an unknown `change` value (6.3): not verified.
- Bench Docker-era pg_dump contents: unknown (no host access in this wave).
- `test/static/imports.test.ts` contents relevant to `capture_network_config` not read (row 85 gap carried).
- No graft graph query used; grep and reads only.

---
*Generated: 2026-10-22*
*Last Updated: 2026-10-22*
