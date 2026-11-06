---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
date: 2026-10-22
agent: data-analyst
row: 95
type: spec (R-FLEX consolidated specification; reconciliation of rows 88-94 against the R-FLEX register, row 87)
narrative_tier: 1
confidence: HIGH for conflicts found and the facts re-checked this session (cited); MEDIUM for reconciliation choices that still wait on the user (row 96)
source_structured_task: docs/2026-10-21_bare_metal_bench/identification/02_structured.md (row 95, line 263)
inputs: masterplan/01_specs_rflex_register.md (87), 01_specs_rflex_audio.md (88), 01_specs_rflex_security.md (89, CAUTION), 01_specs_rflex_network.md (90), 01_specs_rflex_database.md (91), 01_specs_rflex_api_ui.md (92), 01_specs_rflex_host_docs.md (93), research/03_analysis_rflex_impact.md (94), delegation_progress/file_requests.md (all lines incl. RULINGs), decisions/decisions.md D10-D15, status_tasks.md (last rows); install-side row-96 items from masterplan/01_specs_service.md (15), 01_specs_register.md (12), 01_specs_security.md (14), 01_specs_database.md (13), research/03_analysis_applicability.md (11), research/03_analysis_impact.md (16) as the controller asked
names_from: masterplan/01_specs_rflex_register.md, including its section 11 that this row adds
last_updated: 2026-10-22
---

# R-FLEX consolidated specification (row 95)

## 0. How to read this file

- This file is the single R-FLEX specification for rows 96 (decision sheet), 97 (refinement of code rows 98-114), and code rows 98-121. Where it differs from a delta file (rows 88-94), **this file wins**. Each difference is listed in section 3 (overrides) with its reason. The seven delta files are not edited (row 95 brief).
- Names come only from the R-FLEX register. Section 11 of the register was added by this row (section 4 below). Every `<REQ:...>` in rows 88-94 is resolved in section 4.2.
- "Bundle M" and "bundle C" name the two release mechanisms in section 2.1.
- "R-FLEX-R-A/R-B" (row 94 code rollback) and "INSTALL-R-A/R-B" (row 16 install rollback) are qualified this way here because the two rows use the same letters for different things (section 9.4).

### 0.1 5W1H (Tier 1)

| W | Answer |
|---|---|
| What | One reconciled specification of R-FLEX: USB audio with no port lock, an exclusive binding, and release on re-bind (D10(1)); ONVIF "Global penuh" with residual guards (D10(2), D11); code before the install (D10(3)). It also holds the name resolution against the register and the de-duplicated question list for row 96 |
| Who | Producer: row 95. Consumers: row 96 (sheet), 97 (refinement), 98-114 (code), 115-121 (tests, security, gates), 17/18/19 (install reconciliation, runbook, verification texts). Decides: the user at row 96 on every item in section 8 |
| When | After rows 88-94 landed (D15), 2026-10-22, beside install rows 11/13/14/16 |
| Where | Docs only. Code areas: `apps/core-server` (capture adapters audio/camera, destination rule, audio-cards module, network facts, fence, host alias), `packages/shared` (API, i18n), `apps/core-web` (devices, commissioning), `scripts/host` |
| Why | The six deltas and the impact analysis were written in parallel (D13). Some depend on each other, three conflict outright (status_tasks.md, row-91 entry), and two requested names overlap (D14). Without one reconciled file, rows 97-114 would implement contradictory designs |
| How | (1) Every conflict was located at file:section. (2) Where code decides it, the code was re-read this session: `core/pipeline.ts:5-8`, `core/unit-of-work.ts:8,15-18`, `audio-cards/statements.ts:31-61`, `audio-cards/index.ts:228-231`, `i18n/en/common.ts:787-797`, `i18n/en/devices.ts:429-438`. (3) Otherwise the choice that satisfies D10/D11/D12 with the fewest new names and no migration was taken, and the alternative went to row 96 with its cost |
| Alternatives | Per conflict in section 2 |
| Assumptions | (A1) The bench DB is created fresh at row 44 and holds no `capture_audio_inputs` rows (88 A1, 91 A3, 94 §6.1; unverified on the host). (A2) One Core process per host (88 A2). (A3) The recommendations of section 8 hold until the user answers. Every item that depends on them is marked `[Q96-nn]` |
| Gaps | Section 10 |

## 1. Requirements: every D10 ruling mapped (verification item "every D10 ruling mapped")

Ruling text: decisions.md D10 (verbatim quotes in 88 §0.1 and 89 §0). Test levels: U = unit, DB = routes/db test, W = web test, H = bench HIL, S = static/grep, G = gate.

### 1.1 D10 ruling 1: USB audio ("bebas sepenuhnya, tapi jika device sudah pairing ke 1 input ... jangan open lagi ke pairing baru. jika ... pair ulang dengan line tertentu maka line yang lama harus di lepas")

| Req | Requirement | Source | Acceptance criteria (measurable) | Owner rows |
|---|---|---|---|---|
| RF-A1 | **No port lock.** A bound USB card is recognised on any USB port, at open, in the loss watch and in ops 98/99. Rule: USB id plus serial where the card states one, else any unit of the model (RQ-A1 option d). `PORT_DIFFERS` is removed from both matchers (RM-A1, RM-A2) | 88 §3; register RM-A1/A2 FIRM | 88 T-1 (one shared case table; `grep -c PORT_DIFFERS` over both test files = 0), T-2, T-3, T-4 (port move: `CARD_ABSENT` then `RETURNED`, 0 `CARD_CHANGED` causes), T-7, T-8; H-3 (row 127): same MIC id after a port move, 0 `CARD_CHANGED` log/audit lines for it | 107, 108 |
| RF-A2 | **A bound card is exclusive.** Op 98 marks it `boundTo` (AU-L1) and does not offer it for a new binding. Op 99 refuses a new binding with `AUDIO_CARD_ALREADY_BOUND` (AU-R1, 409, `details.deviceId` = holder). The check runs in the service inside the op 99 unit (DB-A2 `READ_BOUND_AUDIO_INPUTS`, `retired_at IS NULL`). No DB index on the recommended path. Unit of exclusivity: [Q96-01] | 88 §5; 91 §3; 92 §2.1-2.2 | 88 T-6, T-7, T-9, T-11 (two concurrent op 99: exactly one 201, exactly one live row with the card's identity), T-15 (web); H-1 (row 125): `boundTo` = the MIC id, input not offered again; 94 risk "retired MIC blocks its card": a service test with a retired row | 108, 111 |
| RF-A3 | **A re-bind releases the old binding.** Reconciled mechanism (section 2.1, bundle M, [Q96-02]): op 99 with `release: true` (AU-B1) for another input of a held card **moves the holder** (re-key to the new input), audits `RELEASED` (old input) then `REENABLED` (new input) (AU-A1), and answers `releasedDeviceId` = the holder (AU-B2). Moving a MIC between PRIMARY and STANDBY on the selector clears the old line in one op 78 edit (Q-R5 reading B). Exactly one live row ever holds a card | 88 §6.2-6.3 (adopted); 91 §4.2 (alternative, bundle C) | 88 T-10 (MIC row `input_number` = 2; exactly 1 live row; audits `RELEASED`(1) then `REENABLED`(2)), T-12 (session open: 409 `CAPTURE_CONFIG_LOCKED`, no change), T-13/T-14 (selector move, 2 x `CAPTURE_CONFIG_CHANGED` scope MIC); H-2 (row 126): STANDBY = MIC, PRIMARY = Not assigned | 108, 111 |
| RF-A4 | **A port move is not a re-bind.** Same physical card at the same input number under a new kernel key (macOS `usb_<port>`, or a renamed Linux card) re-keys the existing MIC row (`REKEY_AUDIO_INPUT`, register DB-A6) and answers `REENABLED` with no `release` needed | 88 D-A4.1/D-A4.2; AC9 "a port move keeps the binding" | 88 T-8 (200, same MIC id, stored `card_id`/`usb_port` refreshed, live row count unchanged, 1 audit `REENABLED`); H-3 records `cardId` before and after (confirms or refutes D-A4.1's Linux hypothesis) | 107, 108 |
| RF-A5 | **Two identical serial-less cards** never record from the wrong unit without notice [Q96-03] | 88 §4 | 88 T-5 (recommended: `CARD_AMBIGUOUS`/`MODEL_SHARED`, `CARD_UNDECIDED`, 0 faults) | 107 |
| RF-A6 | **Every state change audited** with existing types. No serial, port or USB id in audit details. `RELEASED` is added to both closed lists, which stay equal (`core/audit-details.ts:207`, `capture-audio-cards.ts:94`) | 88 §8; register AU-A1 | `writers.test.ts:352,479,534` and `api-capture-discovery.test.ts:764` pin the 4-value list; op 99 answer enum stays 3 values (92 §2.2) | 108, 109, 99 |

### 1.2 D10 ruling 2: ONVIF "Global penuh" (discovery and connection on all host interfaces; point 2, DR-4, S13-11 lifted)

| Req | Requirement | Source | Acceptance criteria | Owner rows |
|---|---|---|---|---|
| RF-N1 | **Connection is global.** `TYPED_PROBE` and `STORED_CAMERA` no longer raise `OTHER_INTERFACE_SUBNET`, `OUTSIDE_CAMERA_SUBNET`, `NO_CAMERA_SOURCE`, or `NOT_CONFIGURED` in its "no camera interface/subnet" meaning (RM-N1..N4). The source is chosen by the reconciled rule of section 2.5 | 89 §2.3, §4; 90 §3 | 90 AC-1 (`cameraSubnet: null`, one eligible `wlp*` 192.168.0.73/24 interface: 192.168.0.50 allowed with `sourceAddress` 192.168.0.73, `viaAlias` false); 89 §8 allow tests per lifted code; 90 AC-8 (bench: `ss -tnp` shows the Wi-Fi source) | 102, 103 |
| RF-N2 | **Discovery is global.** Discovery stays property-based on every eligible interface (Wi-Fi included). `DISCOVERY_MAX_INTERFACES` stays 4 (NW-K1). A typed probe's source interface is always probed first. Multicast answers are admitted on the camera port only (U-RF3, fixed): on other interfaces a camera is found by typed address | 90 §5; 89 §6; 93 E-P7 | 90 AC-6 (5 interfaces, typed source on the 5th: probed, not `NO_ELIGIBLE_INTERFACE`, `probed.length = 4`); rows 66-69: `interfaceCount` = eligible interfaces (expected 2 on .73; hypothesis until read) | 103, 104 |
| RF-N3 | **The network config is optional for global purposes.** `interface_name`/`camera_subnet` stay nullable (no DB change, DB-N1). They are required only for `COMMISSIONING_SCAN`, `SET_IP` and the alias helper [Q96-04]. The connection test no longer answers `COMMISSIONING_NOT_CONFIGURED` (W-N3 removed) | 90 §7, U4; 91 §8; 92 §2.3, §8 | 90 AC-4 (`grep -n COMMISSIONING_NOT_CONFIGURED modules/capture-discovery/connect/service.ts` = 0 lines), AC-5 (`networkFactsOf(null, interfaces)` non-null, `allowedPorts = [80]`); web tests `camera-connect*.test.tsx` without the branch | 102, 104, 105, 106, 112 |
| RF-N4 | **Residual guards kept** (points 1, 3, 4, set-IP paragraph, AD-02, S13-08, `HOST_ADDRESS` on every interface, alias never a source for TP/SC): RG-1..RG-14 [Q96-05] | 89 §2-§3 | 89 §8: at least one refusal test per kept code for TP and SC on a non-camera interface; AD-02 check unchanged (loopback row: 409 at session start, 0 reveals, 0 relay starts) | 102, 117 |
| RF-N5 | **On-link only.** A TP/SC target outside every eligible interface's subnet is refused `NO_SOURCE_INTERFACE` (NW-R1), never routed through a gateway [Q96-06] | 89 RG-12; 90 §3.2 step 6 | refusal test for an off-link target; row 16 finding 4 scenario (enp4s0 down, stored camera 192.168.100.x): NW-R1, 0 packets towards the default gateway | 102, 117 |
| RF-N6 | **Ambiguous source refused.** Equal-longest prefix on two different interfaces: `SOURCE_INTERFACE_AMBIGUOUS` (NW-R2, D14) | 90 §3.2 step 5; D14 | table test: same /24 on two interfaces -> NW-R2, whichever is the camera interface | 102 |
| RF-N7 | **Fail-closed kept.** Unreadable host facts (no reader, reader throws, null) refuse every purpose with `NOT_CONFIGURED` (remaining meaning, RM-N4) | 89 §4.2 step 0 (adopted over 90 C1, section 3 O-5) | test: context without `interfaceSubnets` -> `NOT_CONFIGURED` for TP and SC; 0 packets (SEC:240 form) | 102 |
| RF-N8 | **Form check survives.** `FORM_ACCEPTED` (sentinel `NO_CAMERA_SOURCE`, `facts.ts:174`) asks the SET_IP binding instead of STORED_CAMERA (under [Q96-04] = bound) | 89 RR-5; 90 B2 | tests on `cameraSubnetAccepted` and `factoryAddressAccepted` pass unchanged | 105, 117 |
| RF-N9 | **Host documents say "host hygiene".** HOST-19, 23, 24, 46 wording amended; no item added or removed; HOST-23 rule stays camera-port-only, pinned by a new count assertion | 93 §3-§6 | 93 §4 row-113 diff check (only the listed lines change); 93 §5.1 (`grep -c 'would-run: ufw allow'` = 1); `shellcheck` clean | 113, 114 |

### 1.3 D10 ruling 3: code first ("Masuk blueprint ini dulu")

| Req | Requirement | Acceptance criteria | Owner rows |
|---|---|---|---|
| RF-P1 | R-FLEX code, tests and gates complete before the install touches the Core | Row 20 not started before gate row 119 is approved (02_structured.md critical path, :434); rows 115 (tests), 116-118 (verification, security, review) report PASS; row 119 approved by the user | 97-121, G-RF |
| RF-P2 | A rollback path exists before the commit | 94 §7: `patch -R -E -p1 --dry-run < <rflex_only_diff>` succeeds at row 77/120; `SHA256SUMS` check inside the restore folder prints 4 x OK [Q96-18] | 80, 120 |
| RF-P3 | No DB migration on the recommended path: journal head stays idx 33 (34 files), schema 15 / `dbc-16` | `meta.ts:121,123` unchanged; journal 34 entries; row 98 records N/A with 91 §6.1 as evidence [Q96-07] | 98 |

### 1.4 D11 / D12 carried

| Item | Mapping |
|---|---|
| D11 risk accepted, security-review row | RF-N4..N7; posture CAUTION (89 §10) to be confirmed at row 117 and gate 119; RR-2 (DHCP reuse) goes to the user as [Q96-08]; no code guard found (D14) |
| D12 U-RF3 | RF-N2; HOST-23 unchanged (93 E-P7); [Q96-14] is a notice only |
| D12 U-RF4 AC6/AC9 | Section 7 gives the reconciled AC6/AC7/AC9 text |
| D12 U-RF5 second mic out of scope | RF-A5 has no bench test; Q-R1 (a)/(b) are equal on the bench (1-input BOMGE) |

## 2. Conflicts settled (task item 2)

### 2.1 (a) Release mechanics: row 88 "move the holder" vs row 91 "clear the old MIC's identity and slot"

| | Bundle M (row 88 §6.2, **adopted**) | Bundle C (row 91 §4.2, kept as option of [Q96-02]) |
|---|---|---|
| What a release writes | holder row re-keyed to the new input: UPDATE `card_id, card_device, input_number` + identity, by `device_id`, `retired_at IS NULL` (`REKEY_AUDIO_INPUT`, DB-A6) | old row: `usb_serial = NULL, usb_port = NULL` (`RELEASE_AUDIO_INPUT`, DB-A7); old MIC's selector slot set NULL (AU-A2); a NEW MIC row is inserted for the new input |
| Grants it uses | 0016:35-36 (UPDATE of `card_id, card_device, input_number, ...`), 0018:40 (`usb_serial, usb_port`). Both cited by row 91 (D-4) | 0018:40, 0016:35-36, 0005:35-37 |
| New write statements | 1 (`REKEY_AUDIO_INPUT`). It is needed **in both bundles** anyway, for the macOS port move (88 D-A4.2; 91 §4.2 "macOS note") | 2 (`REKEY_AUDIO_INPUT` + `RELEASE_AUDIO_INPUT`) |
| MIC ids | one MIC per physical card (and input) for ever | a released MIC remains as a row that can never be deleted (no DELETE grant, 0016:41) or retired (op 111 unrouted, register F6) |
| Selector | the holder keeps its line, which continues from the new input | the old line becomes "Not assigned"; the operator assigns the new MIC |
| Console can tell a released MIC | not needed (none exists) | **No.** `online` is the registry `enabled` flag (92 T17; 91 D-8: LIVE/LOST), which bundle C does not change, so the released MIC is offered in the mic menu as a live device. Telling it needs a new slice member (not registered) or M4 option (ii), which both 88 and 91 reject (`enabled` is not a binding state). Row 92 M4 (iii) calls exactly this "NOT acceptable" |
| RM-A3/A4 (no serial AND no port) | free choice; R-FLEX never produces that shape. Recommended: remove (treat as "no serial") per register | **must stay "never opened"** (91 Q-DB2), or "any unit of the model" must be limited to `usb_port IS NOT NULL`. Otherwise a released row re-opens the card |
| `usb_port` drop (Q-R3) | possible (presence carries no meaning) | impossible (presence is the bound marker, 91 §5) |
| Audit | `RELEASED` (old input) + `REENABLED` (new input), same MIC | `RELEASED` for the old MIC + `REGISTERED` for the new one + `CAPTURE_CONFIG_CHANGED` if a slot was cleared |
| Bench runnable | not on the bench (1-input BOMGE); proven by DB test T-10 | not on the bench either; same limit |

**Decision: bundle M** for the op 99 path, plus the selector move (Q-R5 reading B) for "line = PRIMARY/STANDBY". Reasons:
1. Both bundles are consistent with the DB grants row 91 cites. Bundle M needs one write statement that both bundles need anyway, and no new state.
2. Bundle C leaves the console unable to tell a released MIC from a live one, which row 92 rejected; fixing that needs an unregistered member.
3. Bundle M removes conflict (c) (section 2.3) instead of constraining the identity rule.
4. Row 88 states that the literal reading "a NEW MIC id takes the card" needs a lasting released mark, and names RD3 or a new column. Row 91 shows a third way (identity clear). That makes bundle C feasible, but not better. It is put to the user as an option of [Q96-02] with its costs, not dropped.

### 2.2 (b) Q-R1 exclusivity unit: row 88 (a) physical card vs row 91 (b) card input

Not settled here; it is a reading of the user's own words. **Put to the user as [Q96-01]** with both positions:
- (a) physical card. This is the literal reading of "device sudah pairing ke 1 input ... jangan open lagi ke pairing baru" (88, register).
- (b) card input. This keeps the task-4 multi-input design: two MICs on two inputs of one interface (91 §9; DB fixture is a four-channel card, `test/db/fixtures.ts:771`).

The recommendation given to the user is **(a)**, because the user's sentence speaks of the device. Row 91's dissent is shown as the consequence: under (a) a 2-input interface feeds one line only, and an older database holding two MICs on one card is a pre-existing conflict. That conflict is surfaced at the next op 99, not at deploy, because there is no DB index on the recommended path. On the bench (a) and (b) behave identically (1-input BOMGE, 03_deployment_check D2). Under (b), op 99's release path (T-9/T-10) no longer arises from "another input". It remains only for the identical-unit and renamed-key cases, and AU-L1 moves into `registered[]` (92 Q-92-2).

### 2.3 (c) Q-DB2: "no serial and no port = never opened" vs removal of RM-A3/RM-A4

Settled by 2.1. Under bundle M no row reaches that shape through R-FLEX, so the RM-A3/A4 choice is free and stays the user's (second half of [Q96-09], recommended "treat as no serial", register). Under bundle C the refusal must be kept (91 Q-DB2). The user's answers to [Q96-02] and [Q96-09] are therefore coupled. The sheet must state that "bundle C + remove RM-A3/A4" is not a valid combination.

### 2.4 (d) Row 92 dependencies on rows 88 and 90

| Row 92 item | Resolution |
|---|---|
| M4 released microphone (`<REQ:devices.micLines.released>`) | Bundle M: no released MIC exists, so **M4 is not built**. The name is registered as reserved (W-A9, provisional - row 96, bundle C only). Its row-92 condition "slot clear + `enabled=false`" is unreachable, because no spec sets `enabled=false`. Under bundle C its use also needs a slice member (section 2.1) |
| M2 exclude retired MICs | Not required (no retire, AU-X1 not used). Allowed as hygiene; row 97 decides (MINOR) |
| W-A3 `.released` text and the `releaseHint` text | **Rewritten for bundle M** (section 6.2). Row 92's texts say the holder "will stop using this sound card" and "the new microphone", which is false under bundle M |
| W-A2 `.release` label | Register draft "Move this microphone here" fits bundle M better than row 92's "Release from {{device}}". Section 6.2 gives the text |
| Op 99 status of a release | Bundle M: **200** with `change: REENABLED`, `deviceId` = `releasedDeviceId` = the holder (88 D-A4.4). Row 92 §2.2's "201 ... `releasedDeviceId` set" applies only to bundle C |
| AU-A2 sentence in op 99 audit text, "removed from its microphone line" suffix | Not used (bundle M does not clear a slot on op 99) |
| W-A6 / RM-A5 (`dep: row 88`) | Decided by 88 D-A1.4: the predicate becomes "the USB id is the replacement word". Row 92's alternative W-A6 text and the `:305` text apply |
| Selector rule for Q-R5 B (88 D-A4.6) | Row 92 §5 M3 is "unchanged" but must change: the other line's mic becomes an **enabled** "move" option with `devices.micLines.onOtherLine.<role>` text re-worded (88 D-A4.6; T-14). Row 92 missed this because it assumed Q-R5 = A |
| W-N3 removal (`dep: row 90`) | Confirmed by 90 U4 / AC-4: **FIRM** under either answer of [Q96-04], because STORED_CAMERA is global by D10(2) |
| `common.captureSearch.typedAddress.notAllowed` text | Registered W-N4 (text change of an existing key, `common.ts:794`). The text "a network the Core is connected to" matches RF-N5 (on-link) |

### 2.5 Network: rows 89 and 90 source rule (found during reconciliation)

Reconciled source rule for TYPED_PROBE and STORED_CAMERA (replaces `destination-rule.ts:352-373` for these two purposes only):

| Step | Statement | Refusal | From |
|---|---|---|---|
| 0 | Context carries no `interfaceSubnets` (facts unreadable; `HOST_NOT_CONFIGURED` stand-in) | `NOT_CONFIGURED` | 89 step 0 (O-5) |
| 1 | Point 1 class of the target | class code | both |
| 2 | Target is any host address, aliases included | `HOST_ADDRESS` | both |
| 3 | Candidates = non-alias addresses of eligible interfaces (IPv4, not internal, netmask not /0 or /32, MAC not all-zero). An interface whose own address is not private is skipped as a source; it does not make the context unreadable | - | 89 step 3 + 90 §3.3 (compatible) |
| 4 | Keep the candidates whose subnet holds the target; longest prefix wins | none left: `NO_SOURCE_INTERFACE` (NW-R1) | 90 steps 4, 6; 89 step 4 |
| 5 | Two or more **different** interfaces at the same longest prefix: refuse, **even if one of them is the stored camera interface** | `SOURCE_INTERFACE_AMBIGUOUS` (NW-R2) | 90 step 5 (O-4) |
| 6 | Edges on the /24 and on the chosen prefix | `NETWORK_ADDRESS` / `SUBNET_BROADCAST` | both |
| 7 | Port list (point 3) | point-3 codes | both |
| 8 | Admission `sourceAddress` = chosen address, `viaAlias: false` | - | both |

COMMISSIONING_SCAN and SET_IP: unchanged under [Q96-04] = bound (89 §5, 90 §3.1).

### 2.6 (e) Row 94 "C?" items resolved

Basis: bundle M, Q-R3 keep, Q-R4 bound, NW-C1 per 2.7, no migration. Each "C" assumes the recommendation holds. An item flips if the named answer differs.

| File (row 94 §4) | Resolution | Flips if |
|---|---|---|
| `usb-audio-macos.test.ts` | none expected (wrapper unchanged, 88 §12). Port-move case T-3 goes in `macos-card-listing.test.ts` (already C) | - |
| `card-listing.test.ts`, `card-listing-reader.test.ts`, `alsa-config.test.ts`, `mic-helper-args.test.ts`, `fence/__tests__/fence.test.ts` | none | Q96-09 = drop |
| `adapters/__tests__/real.test.ts` | C only for the mutant comment if it names the port rule (`:128-133`) | - |
| `__tests__/capture-composition.db.test.ts`, `capture-config/__tests__/e2e/first-full-session.db.test.ts` | **C if** they assert the op 98 card object exactly (`boundTo` is a required nullable member). Row 108 checks with one run | - |
| `audio-cards/__tests__/fixtures.ts` | **C + E** (91 §7: `INTERFACE_ON_ANOTHER_PORT`, `TWO_CARDS_INTERFACE_MOVED` change meaning; new texts for AU-R1, release, macOS re-key) | - |
| `capture-config/__tests__/routes.test.ts` | **E** for the op 78 mic move (88 T-13, Q-R5 B) if this is the op 78 route file; no op 99 slot clear | Q96-02 = bundle C (then C for AU-A2) |
| `selector-reader-inventory.test.ts`, `engine/__tests__/readdress-door.db.test.ts` | **C** (`CAPTURE_AUDIO_CARD_WRITES` gains `REKEY_AUDIO_INPUT`) | bundle C: also `RELEASE_AUDIO_INPUT` |
| `stored-address.test.ts` | **C** (STORED_CAMERA global) | - |
| `onvif-network.test.ts`, factory-scan and camera-network service/routes tests | none (set-IP/scan bound; context member kept, 2.7) | Q96-04 = global |
| `discovery-collector.test.ts` | none for the value; **E** for typed-source-first ordering only if the ordering lives in the collector (else in `ws-discovery.test.ts`, already C + E) | Q96-13 |
| `capture-discovery.db.test.ts` (`NO_ELIGIBLE_INTERFACE`) | none expected | - |
| host-alias `caller.test.ts`, `lifecycle(.db).test.ts`, `host-alias-socket.test.ts` | **none** (`otherInterfaceSubnets` kept, 2.7; no B6 derivation) | - |
| `capture/__tests__/static.test.ts:1391` | none (`production-parts.ts:810` unchanged; RF-N7 is met by `HOST_NOT_CONFIGURED` lacking `interfaceSubnets`) | - |
| `capture/adapters/__tests__/static.test.ts:585,632,657` | **C if** the pinned text is the C1/C2 doc comment that row 90 rewrites; row 110 checks | - |
| `test/static/*` | none (no new import edge, 88 D-A1.5; no migration) | Q96-07 = option B |
| `packages/shared` `api-registry.test.ts`, `api-text-rule.test.ts` | run once after row 99; fix only if red | - |
| web `selector-microphones.test.tsx`, `capture-selector.test.tsx` | **C** (other-line mic option becomes an enabled move, T-14) | Q-R5 = A only |
| web `live-devices-capture-selector.test.tsx`, `selector-in-force.test.tsx` | none | bundle C |
| DB version-pin list (94 §4.4, 25 files) | none | Q96-07 = option B |

### 2.7 (f) Row 94 I-3: keep `otherInterfaceSubnets`

**Decision: keep the member `otherInterfaceSubnets` with today's name and meaning, and ADD `interfaceSubnets` (NW-C1 name) beside it.** This overrides 90 §3.3 "replaced by" and 90 B6. Rules:
- `interfaceSubnets` lists every eligible interface address with name, address, network and prefix length. It is filled by the production builder B1 always. It is absent in `HOST_NOT_CONFIGURED` and in test literals that only exercise bound purposes. Absent means RF-N7 (`NOT_CONFIGURED`, fail-closed). Present but without a candidate means NW-R1.
- Bound purposes and the alias guard (`HostAliasFacts.otherInterfaceSubnets`, `caller.ts:241-255`) keep reading `otherInterfaceSubnets` unchanged. 90's B6 derivation and its "silent regression of the alias guard" risk disappear.
- Effect (94 Finding 1): the 22 test files that build a context need no edit unless they test TP/SC. The rename churn is avoided.
- Optional versus required in the TypeScript type is row 102's choice, under the absence rule above.

### 2.8 (g) Row 93: rows 66-69 and 128 "search result names the interface" cannot pass

Confirmed: the answer carries only `interfaceCount`, "a count, never a name or an address" (`capture-discovery.ts:258`; register F9, NW-S1 FIRM). **Routed to row 19** (controller already routed it, status_tasks.md). Row 19 adopts 93 §7 verbatim:
- rows 66-69: "camera listed and connected; the search answer's `interfaceCount` equals the number of eligible host interfaces (expected 2, enp4s0 and wlp3s0; hypothesis until read in row 66); no credential in doc";
- row 128: "search lists the 4 cameras; `interfaceCount` equals the row-66 value".

Not a user question unless [Q96-15] (per-result interface) is answered (b).

### 2.9 Other conflicts found

| # | Conflict | Resolution |
|---|---|---|
| X-1 | Serialisation: 88 D-A3.2 wraps the op 99 unit in the listing gate because "READ COMMITTED can race". 91 says the unit pipeline already serialises | **91 holds** (verified: `core/pipeline.ts:5-8` "no two units ever interleave"; `core/unit-of-work.ts:15-18`: every unit takes `audit_chain_lock()` first, "in this process and across processes"). The gate extension is dropped (O-2). 88 T-11 stays valid; its second answer is `AUDIO_CARD_ALREADY_BOUND` (or `AUDIO_CARD_SEARCH_IN_PROGRESS` if the listing part collides) |
| X-2 | Several pre-existing holders of one card (older DBs only; 91 §5 last row) under bundle M | Op 99 with `release` refuses `AUDIO_CARD_ALREADY_BOUND` naming the first holder by 91's rule (slotted primary, then standby, then lowest MIC id). `boundTo` uses the same rule. Out of bench scope (A1); row 97 records it as a known limit |
| X-3 | AC9 text (93 §8) "Re-binding it to another input releases the old binding" cannot be run on the bench (1-input mic) | Section 7 rewords AC9: bench evidence via the selector move (H-2) plus DB test T-10 |
| X-4 | Controller ruling (file_requests.md) says row 95 "replaces `<REQ:DestinationRefusal.SOURCE_AMBIGUOUS>` in 01_specs_rflex_security.md", but the row-95 brief says "Do not edit the seven delta files" | The brief governs: the substitution is recorded here (4.2), and 89's file is not edited. Flagged to the controller |
| X-5 | Rows 94 and 16 both use "R-A/R-B" for different rollbacks (94: code, R-B = R-FLEX-only reverse patch; 16: install, R-A = data kept, R-B = full purge) | Qualified in this file and in section 8 (R-FLEX-R-x vs INSTALL-R-x). Row 96 must use the qualified names |

## 3. Overrides of the delta files (each with its reason)

| Id | Overrides | New content | Reason |
|---|---|---|---|
| O-1 | 91 §4.2 (release form), 91 A1, 92 §2.2 "201 ... released" | Bundle M | Section 2.1 |
| O-2 | 88 D-A3.2 (gate around the op 99 unit) | No extra serialisation | X-1 (code re-read) |
| O-3 | 92 §3.3 texts of W-A2, W-A3, `releaseHint`; 92 §5 M3 "unchanged"; 92 §5 M4 | Section 6.2 texts; M3 becomes a move option; M4 not built | 2.4 |
| O-4 | 89 §4.2 step 5 (prefer the stored camera interface on overlap) | Refuse every cross-interface tie (NW-R2) | Today the overlap is refused (`OTHER_INTERFACE_SUBNET`, 90 T1), so 89's "same as today" does not hold. D14 defines the code as "two interfaces hold the target subnet, no source can be named". 89's own weak-host hypothesis (§4.3) is unverified. Strict refusal keeps DR-4's "no silent fallback". No effect on the bench: enp4s0 192.168.100/24 and wlp3s0 192.168.0/24 do not overlap (93 I10) |
| O-5 | 90 C1/B3 (unreadable facts produce NW-R1) | Unreadable facts produce `NOT_CONFIGURED` (RF-N7) | 89 step 0 (security row). It keeps NW-R1 meaning only "no on-link interface", and the register keeps `NOT_CONFIGURED` for unreadable facts (RM-N4) |
| O-6 | 90 §3.3, B6; register NW-C1 "replaced by" | Keep `otherInterfaceSubnets`, add `interfaceSubnets` | 2.7 (94 I-3) |
| O-7 | 89 `<REQ:DestinationRefusal.SOURCE_AMBIGUOUS>`, 90 `<REQ:SOURCE_INTERFACE_AMBIGUOUS>` | `DestinationRefusal.SOURCE_INTERFACE_AMBIGUOUS` (NW-R2) | D14 |
| O-8 | 92 W-A9 condition "slot clear + `enabled=false`" | Reserved for bundle C only | 2.4 |
| O-9 | 91 Q-DB2 as a fixed constraint | Coupled to [Q96-02]; free under bundle M | 2.3 |
| O-10 | 93 §8 AC9 text | Section 7 | X-3 |
| O-11 | 88 §12 "a re-key write" (unnamed) | Named `REKEY_AUDIO_INPUT` (DB-A6) | A write needs a register name (driver_rules "Names") |

## 4. Register reconciliation (verification item "0 name conflicts with register")

### 4.1 Names added to the register (section 11 of 01_specs_rflex_register.md, additive edit by this row)

| Register id | Name | Requested by | Status |
|---|---|---|---|
| NW-R2 | `DestinationRefusal.SOURCE_INTERFACE_AMBIGUOUS` | rows 89, 90; D14 | FIRM |
| W-A7 | `common.captureAudioCards.releaseHint` | row 92 | FIRM (text per bundle M, 6.2) |
| W-A8 | `common.captureAudioCards.card.notTellable` | row 92 | provisional - row 96 (Q96-03) |
| W-A9 | `devices.micLines.released` | row 92 | provisional - row 96 (bundle C only); not built under bundle M |
| W-N4 | `common.captureSearch.typedAddress.notAllowed` (text change of an existing key, `packages/shared/src/i18n/en/common.ts:794`) | row 92 | FIRM |
| DB-A6 | `REKEY_AUDIO_INPUT` (statement constant) | row 95 (88 D-A4.2 / §12 unnamed) | FIRM |
| DB-A7 | `RELEASE_AUDIO_INPUT` (statement constant) | row 91 | provisional - row 96 (bundle C only) |
| DB-M0 | `0034_audio_input_binding_data.sql` (data step; DB-M1/M2 then shift to `0035_audio_input_binding.sql` / `0036_audio_input_binding_privileges.sql`) | row 91 | provisional - row 96 (Q96-07 option B only) |
| RB-1 | `rflex_only_diff` = `.data/rflex-restore-20261022/rflex-only.diff` + its line in `SHA256SUMS`, written by row 120 | row 94 | FIRM |

Rejected: none. Not added here because they belong to the INSTALL register (row 12/17): `ufw_revert_unit`, `pg_socket_dir`, `pg_conf_dir`, `pg_common_conf`, `pg_log_file`, `host_baseline_dir`, `install_backup_dir`, `disk_free_threshold`, `cli_cache_dir` (held by RULING) (section 9.2).

**Conflict check (this session):** each new name was grepped in the register before the edit (0 hits each) and in `apps/` + `packages/` `*.ts(x)` (0 hits each, except `typedAddress`, an existing block whose `notAllowed` key W-N4 deliberately re-words). `devices.micLines` exists (`devices.ts:429`) with members `label` and `onOtherLine`, so `released` does not collide. W-A3 `common.captureAudioCards.released` and W-A9 `devices.micLines.released` are different paths. **Result: 0 name conflicts.**

### 4.2 Placeholder substitution table (deltas keep their text; implement with the right column)

| Placeholder in | Placeholder | Use |
|---|---|---|
| 89 §2.3, §4.2, §5, §8, §9 | `<REQ:DestinationRefusal.SOURCE_AMBIGUOUS>` | NW-R2 `DestinationRefusal.SOURCE_INTERFACE_AMBIGUOUS` |
| 90 §3.1, §3.2, §4.2, §9, §10 | `<REQ:SOURCE_INTERFACE_AMBIGUOUS>` | NW-R2 |
| 91 §4.2 | `<REQ:RELEASE_AUDIO_INPUT>` | DB-A7 (bundle C only) |
| 91 §6.3 | `<REQ:audio_input_binding_data migration file>` | DB-M0 (option B only) |
| 92 §3.1-3.3 | `<REQ:common.captureAudioCards.releaseHint>` | W-A7 |
| 92 §3.2-3.3 | `<REQ:common.captureAudioCards.card.notTellable>` | W-A8 |
| 92 §5 M4, §10 | `<REQ:devices.micLines.released>` | W-A9 (bundle C only) |
| 92 §8 | `<REQ:common.captureSearch.typedAddress.notAllowed>` | W-N4 |
| 94 §7.2, Recommendations | `<REQ:rflex_only_diff>` | RB-1 |

### 4.3 Status of existing register ids after reconciliation

| Id | Register status | After row 95 |
|---|---|---|
| RM-A3/A4 | provisional - row 96 | still row 96 (Q96-09), coupled to Q96-02 (2.3) |
| RM-A5 | provisional - row 88 | **decided**: predicate = "USB id is the replacement word" (88 D-A1.4); code `AUDIO_INPUT_NOT_REGISTRABLE` kept |
| RM-N1..N3 constant deletion | provisional - row 96 | not deleted under Q96-04 = bound |
| RM-N4 | FIRM | unchanged; constant also carries RF-N7 |
| NW-R1 | provisional - row 89/90 | used (RF-N5); "refuse routed" pending Q96-06 |
| NW-C1 | provisional - row 90 | **added beside** `otherInterfaceSubnets` (O-6) |
| NW-K1 | provisional - row 89/90 | 4 kept (90 §5.2); Q96-13 notice |
| AU-R2/AU-R3 | provisional - row 96 | row 96 (Q96-03) |
| AU-L1 per-card meaning | provisional - row 96 | row 96 (Q96-01) |
| AU-A2 | provisional - row 88 | used by the selector move (Q-R5 B) only; and by bundle C |
| AU-X1, DB-A5 | provisional - row 88 | **not used** (88 §6.2) |
| DB-A1, DB-M1..M5 | provisional | **not used** on the recommended path (91 §6.1); Q96-07 notice |
| W-A6 | provisional - row 88 | text change applies (D-A1.4) |
| W-N3 | provisional - row 92 | **remove, FIRM** (90 U4) |
| W-N1 bracket, CF-2, CF-3 | provisional - row 96 | per Q96-04 |
| OP-111 | provisional - row 88 | not used |

## 5. Functional specification (consolidated, short form; details stay in the delta sections cited)

### 5.1 Audio (rows 107-111)

- Identity rule: 88 §3 table, both matchers. One shared case table (T-1). Two functions are kept (88 D-A1.5).
- `usb_port`: written and refreshed, informational, compared only as the `SERIAL_SHARED`/`NOT_TELLABLE` tie-break (88 D-A1.2). [Q96-09]
- Reads used by op 98/99 and DB-A2 filter `retired_at IS NULL` (88 D-A3.4; 91 §3.3).
- Op 98: `boundTo` per card by identity over all live rows; `registered[]` computed by identity, not key first (88 D-A3.5; 92 §2.1).
- Op 99 inside its unit:
  1. read holders (DB-A2);
  2. a holder at the same input number under another key: re-key, `REENABLED` (RF-A4);
  3. a holder at another input with no `release`: 409 `AUDIO_CARD_ALREADY_BOUND`;
  4. the same with `release: true`: bundle M re-key to the new input, audits `RELEASED` then `REENABLED`, answer 200, `releasedDeviceId` = holder;
  5. a row already at the target key: rollback `AUDIO_INPUT_NOT_REGISTRABLE` (88 D-A4.2/D-A4.4, R-3);
  6. session open: `CAPTURE_CONFIG_LOCKED`.
- Selector move: op 78 `{unassign: [X], <other line>: MIC}`. Server unchanged if op 78 orders `unassign` first for mics. Not shown in code (88 E16), so **T-13 decides**. A refusal there becomes an op 78 change at row 97 (88 R-2).
- Loss watch and runtime: no writes; 88 §7.
- No migration, no new operation, no new environment name, no new audit type.

### 5.2 Network (rows 102-106)

- Per purpose: 90 §3.1 under Q96-04 = bound. Source rule: section 2.5. Context: section 2.7. Builder B1: a context whenever the host is readable, also with no config row (`allowedPorts` default `[80]`); `readHostInterfaces` also keeps the MAC per address (90 B1).
- Callers C1-C7 and consumers U1-U7: 90 §4, with O-5 for C1/C2/B3 and O-6 for B6 (no derivation).
- Discovery: 90 §5. Boot, fence and host alias: 90 §6 (no behaviour change under bound).
- Residual guards: 89 §3 RG-1..RG-14. Posture CAUTION stays until rows 117/119.

### 5.3 API, words, console (rows 99-101, 111, 112)

- 92 §2-§9 with the corrections of 2.4 and section 6.
- Registry stays 111 operations; openapi stays 45 operations; it is regenerated.

### 5.4 DB (row 98)

- No migration (91 §6.1). Row 98 = N/A with that evidence.
- Existing-row rule 91 §5, read with bundle M: no "released" shape is produced; a pre-0017 row (no serial, no port) follows Q96-09.
- Rollback: code only (91 §6.4 recommended path).

### 5.5 Host docs (rows 113, 114)

- 93 §4-§6 as written. `[DEP-89-1]` is resolved: the kept-guard list in E-P3 equals 89 RG-1..RG-7 (literal, private, special classes, host-own, edges, port list, size/spacing), which matches E-P3's default. `[DEP-89-2]`: no host egress rule proposed by 89, so none is added. `[DEP-89-3]`: E-P13 stays, with acceptance per [Q96-08]. `[DEP-89-4]`: on-link, per Q96-06.

## 6. Words (deltas to row 92's texts; row 101 applies, single writer)

### 6.1 Unchanged from row 92

W-A1, W-A4, W-A5, W-A6 (alternative text), W-A8 (row 92 text), W-N1/W-N2 (bound variant), W-N4 (row 92 text), W-N3 removal.

### 6.2 Re-worded for bundle M (O-3)

| Key | Text |
|---|---|
| W-A2 `common.captureAudioCards.release` | `Move {{device}} to another input` |
| W-A7 `common.captureAudioCards.releaseHint` | `{{device}} will move to the input you choose and stop using its present input. Choose the input, then register it.` |
| W-A3 `common.captureAudioCards.released` | `{{released}} now uses input {{number}} of this sound card. Its old input was released.` |
| `devices.micLines.onOtherLine.PRIMARY` / `.STANDBY` (existing, `devices.ts:434-437`) | `on the primary line - choose to move it here` / `on the standby line - choose to move it here` (88 D-A4.6; exact text row 101) |

Under bundle C the row-92 texts of W-A2, W-A3 and W-A7 apply, and W-A9 is built.

## 7. Acceptance-criteria text (reconciled; row 96 shows it, row 17 maps it)

- **AC6:** 93 §8 text unchanged.
- **AC7:** unchanged (D12).
- **AC9 (reconciled, O-10):**
  - Audio, all on the bench mic:
    - the USB mic bound to one DEMS input is shown bound (`boundTo`) and is not offered for a new binding (row 125);
    - after a move to another USB port the same MIC id is recognised, with no `AUDIO_CARD_CHANGED` for it and re-registration answering `REENABLED` (row 127);
    - re-binding releases the old binding: moving the MIC from PRIMARY to STANDBY leaves PRIMARY "Not assigned" (row 126, Q-R5 B). The op 99 release to another input of a multi-input card (`RELEASED` then `REENABLED`, `releasedDeviceId` in the answer) is proven by DB test T-10 at row 115, because the bench mic has one input.
  - Cameras: the global search reports every eligible host interface searched (`interfaceCount` equals the eligible interfaces, expected 2: enp4s0 and wlp3s0) and lists the 4 cameras. A device on wlp3s0 is reachable by typed address (9A/H-12, if such a device exists).
  - Binding and cameras persist after the final reboot.

## 8. Consolidated open questions for row 96 (de-duplicated)

Legend: R = needs the user's ruling; N = notice (decided by a spec row or by this row; the user may overrule). "Rows" = rows that depend on the answer.

### 8.1 R-FLEX audio

| Id | Merges | Kind | Question | Options | Recommendation | Consequence | Rows |
|---|---|---|---|---|---|---|---|
| Q96-01 | Q-R1 (87, 88, 91), Q-92-2 | R | Unit of exclusivity | (a) physical card: one MIC per card; (b) one card input: other inputs of a bound card stay bindable | (a), the literal reading of "device sudah pairing ke 1 input". Row 91 recommends (b) | (a): a 2-input interface feeds one line only; older DBs with two MICs on one card are surfaced at the next op 99. (b): `boundTo` moves into `registered[]` (spec addition at row 97); op 99 release only for identical-unit/renamed cases. Bench: identical | 107, 108, 111, 99, 125, AC9 |
| Q96-02 | Q-R5 (87, 88), Q-92-3, release-form conflict 88/91 | R | What "line" means and how a re-bind releases | (A-M) op 99 moves the holder to the new input (bundle M); (A-C) a NEW MIC takes the card, the old MIC keeps its row with serial/port cleared and leaves its slot (bundle C); (B) selector move PRIMARY<->STANDBY; combinations | **(A-M) + (B)** | A-M: one write statement, no dead MICs, nothing new in the console. A-C: 2 statements, a released MIC stays listed as live in the mic menu (needs an unregistered slice member to fix), forces Q96-09 second half = keep. B: web change plus T-13 on op 78; the only path runnable on the bench (row 126) | 108, 111, 126, AC9 |
| Q96-03 | Q-R2 (87, 88), AU-R2/R3, W-A8 | R | Two identical serial-less cards | (i) second unit not bindable; (ii) port as a tie-break; (iii) `CARD_AMBIGUOUS`/`MODEL_SHARED`, no fault | (i)+(iii) | A second identical mic shows "Bound to MIC-a"; while both are plugged in, MIC-a does not open, with no fault. Not on the bench (U-RF5) | 107, 108, 111 |
| Q96-09 | Q-R3 (87, 88, 91) + RM-A3/A4 + Q-DB2 | R | Stored `usb_port`, and rows with neither serial nor port | port: keep / drop; rows: treat as "no serial" / keep refusing | keep; treat as "no serial" (valid only with bundle M) | drop: migration (option B) + the C? rows of 94 §4.1. "Treat as no serial" + bundle C is invalid (2.3) | 98, 107, 108 |
| Q96-07 | Q-DB1 (91) | N | Where exclusivity is held | service only / service + DB-A1 index | service only (88, 91, 94 agree; unit pipeline serialises, X-1) | index: set 17 with 3 files (DB-M0), 25 version-pin files, manual-only down, pre-migration duplicate check | 98, 13/17 (migration count) |

### 8.2 R-FLEX network and security

| Id | Merges | Kind | Question | Options | Recommendation | Consequence | Rows |
|---|---|---|---|---|---|---|---|
| Q96-04 | Q-R4 (87), Q89-5, N-96-1, Q-92-4 (wording variant), HOST-46 part of row 11/93 | R | Do COMMISSIONING_SCAN and SET_IP stay bound to the configured camera interface? | stay bound / global | stay bound | global: helper file per interface, HOST-46 compares a set, admission carries an interface name (unregistered), S13-08 re-review; RM-N1..N3 deletable; W-N1/W-N2/op 101-102 texts take the variant | 102, 105, 106, 113, 124, CF-2/3 |
| Q96-05 | Q89-1, N-96-3 (RG-13) | R | Residual guards RG-1..RG-14 | keep all / drop named guards (each a D-id, MAJOR) | keep all | a drop reopens the guard's threat (89 §3) | 102, 117, 119 |
| Q96-06 | Q89-2, N-96-2, RG-12, row 16 finding 4 | R | On-link only, or also routed targets? | (a) on-link only, NW-R1; (b) any private target, kernel route | (a) | **(b) has this consequence (row 16 finding 4):** if enp4s0 goes down, a stored camera 192.168.100.x is no longer on-link. The kernel would then route the dial through the Wi-Fi default gateway, and the camera credential digest would go to the office router. RG-12 is what stops that. (b) also drops DR-4's "no silent fallback route" entirely | 102, 117, 93 E-P1/E-P3/N4 |
| Q96-08 | Q89-3 (RR-2), F96-2 (93), D14 caution | R | Cameras reached off the camera port: DHCP address reuse may send a stored credential digest to another device; digest over unencrypted transport off the camera port | (a) accept with an operating rule: cameras stay on the static camera port, Wi-Fi only for tests, and the limit is stated (E-P13); (b) require a static/reserved address for such a camera (documented); (c) new code: a device identity check before any credential (new row and names); (d) refuse stored cameras off the camera port (conflicts with D10(2)) | (a) + (b) worded in host docs; (c) as a follow-up outside this blueprint | (c) adds a code row (MAJOR); (d) reverses D10(2) | 113, 117, 119 |
| Q96-10 | Q89-4 | N | Overlapping subnets on two interfaces | refuse always (decided here, O-4) / prefer the camera interface (89's original) | refuse always | no bench effect (no overlap on .73) | 102 |
| Q96-13 | N-96-4 | N | `DISCOVERY_MAX_INTERFACES` | keep 4 + typed-source first / raise / unbounded | keep 4 | - | 103 |
| Q96-14 | N-96-5 | N | U-RF3 consequence: off the camera port, cameras are found by typed address only (the typed-reply admission is a hypothesis until 9A/H-12) | keep U-RF3 / reopen U-RF3 and AC7 | keep (fixed ruling D12) | reopening changes HOST-23 and AC7 | 93, 113, 36, 66-72 |
| Q96-15 | Q-92-1 | R | Per-result interface name in the search answer | keep the count only / add a name (contract change) | count only | (b) reverses F9/NW-S1 and would let rows 66-69/128 keep their old check | 99, 104, 19 |
| Q96-16 | N-96-6 | R | HIL row 124 (camera-port network config) on the bench | N/A unless scan/set-IP will be used / always set | N/A if Q96-04 = bound and no factory-default camera is to be re-addressed | - | 124 |

### 8.3 Host documents, acceptance text, tests, rollback

| Id | Merges | Kind | Question | Options | Recommendation | Rows |
|---|---|---|---|---|---|---|
| Q96-11 | F96-1 (93), row 11 HOST-19/A8 | R | HOST-19 accepts a network-manager equivalent of file B | yes (product text) / no (A8 stays a bench deviation) | yes | 113, 34, 78 |
| Q96-12 | F96-3 | R | Hardware-acceptance documents (UA-12, HW-3, collect-h01.sh) | later task / a row beside 113 (MINOR) | later task | 113 |
| Q96-17 | row 96 scope "AC6/AC7/AC9 wording", 93 §8, X-3 | R | Accept the AC texts of section 7 | as written / amended | as written | 17, 74, 125-128 |
| Q96-18 | I-1 (94) | R | Code rollback form for R-FLEX before the commit | R-FLEX-R-B reverse R-FLEX-only patch (`rflex-only.diff`, RB-1) / R-FLEX-R-A full restore to row 80 (exclude `docs/*`) | R-FLEX-R-B | 77, 120 |
| Q96-19 | I-2 (94) | R | Row 115 scope | the 9-suite R-FLEX set, one heavy runner, `--maxWorkers=2` / full `test:regression` (about 75 min, maxWorkers 4) | R-FLEX set; full only if G-RF asks | 115 |

### 8.4 Install side (added at the controller's request; ids kept from their source rows)

| Id | Merges | Kind | Question | Recommendation | Rows |
|---|---|---|---|---|---|
| F-S1 | R96-11-01, row 14 §4 | R | Service-account home | `/nonexistent`, no home (rows 11, 14, 15 agree); install register :63 still says `/opt/dems/core/.data` (row 17 fixes the register) | 21, 17 |
| F-S2 | - | R | ExecStart form | `node .../tsx/dist/cli.mjs src/index.ts` + `KillMode=mixed`; switch to `--import tsx` if the row-58 stop test fails | 33, 58 |
| F-S3 | + RULING `cli_cache_dir` held | R | CLI invocation | direct tsx (rows 14, 15); then `cli_cache_dir` is not created | 57, 17 |
| F-S4 | R14-5 | R | Console start | unit enabled (loopback only, separate account) | 122 |
| R96-11-02 | - | R | 9A/H-07 as a named check | keep it out; rows 125-127 observe re-plug under the R-FLEX rule | 37, 125-127 |
| R96-11-03 | related to Q96-14 | R | Name 9A/H-12 in rows 66-69 | name it (steps .1-.2, plus .3-.4 after row 124) | 66-69, 124 |
| R96-11-04 | - | R | HOST-28 check scope | USB card only, by id | 37 |
| R14-1 | - | R | SSH rule source on Wi-Fi | any source on wlp3s0 (Mac address from DHCP) | 36 |
| R14-2 | - | R | ufw built-in accepts on Wi-Fi (ICMP echo, mDNS, UPnP) | keep the package defaults and record them | 36, 72 |
| R14-3 | O2 (decisions.md) | R | Plaintext-password files (newer HANDOFF on the .73 Desktop; Mac findings folder mode 0755) | the user deletes or restricts them to 0600, plus a new `gsp-dems` login password if one is in them; deletion only on the user's word | - |
| R14-4 | - | R | sshd settings found at R0 | record only in this task; key-only login as a follow-up | 36 |
| 96-R12-1 | - | R | Installation display name (`DEMS_INSTALLATION_NAME`) | the user types it at row 57 | 57 |
| 96-R12-2 | - | R | Local ports of the camera-page forwards | 18101/18102/18103/18117 unless taken on the Mac | 66-69 |
| 96-R13-1 | - | R | Bench in service on the seeded `dems_demo` or a fresh DB after acceptance | keep `dems_demo` | 44, 79 |
| 96-R13-2 | - | N | PostgreSQL 18.6-1.pgdg24.04+2 with `apt-mark hold` (U-RF10 delegated to row 13; fallback 18.4); `pg.owner.env` exists only while `db:*` runs (owner role PASSWORD NULL between runs) | as decided | 39, 41, 44 |
| 96-R16-1 | - | R | Set the watchdog no-reboot flag right after row 21 instead of row 123 (the only row-order change proposed) | after row 21 | 21, 123 |
| 96-R16-2 | - | R | Recordings only while the user is at the bench (a Wi-Fi loss means no console control) | yes | 125-128 |
| 96-R16-3 | X-5 naming | R | Install rollback default | INSTALL-R-A (data kept); INSTALL-R-B (full purge) only on a separate word after the user is told the signing key is in no backup | 77 |
| 96-R16-4 | - | R | Docker restore | not planned unless asked | - |

**Count:** 19 R-FLEX items (Q96-01..Q96-19; 4 of them notices). They replace 26 source ids: Q-R1..Q-R5, Q89-1..5, N-96-1..6, Q-92-1..4, Q-DB1, Q-DB2, F96-1..3, I-1, I-2 (I-3 settled in 2.7). Plus 20 install items. Every source id named in the brief and in the controller's additions appears in a "Merges" or "Id" cell above.

## 9. Routed items (not for the user)

### 9.1 For row 97 (refinement) and row 19 (verification texts)

- HOST-17 has no install row; recommend recording it in row 21 (preflight) (row 11 Finding 2; MINOR). Rows 97/19.
- Rows 66-69 and 128 checks replaced per 2.8 (row 19).
- Section 2.6 C? resolutions decide which test files each code row extends.
- Op 78 mic move: T-13 first. If op 78 refuses, add the op 78 change (camera rule `routes.ts:76-84` as the model) (88 R-2).
- X-2 multi-holder limit recorded. `REKEY_AUDIO_INPUT` added to `CAPTURE_AUDIO_CARD_WRITES` (`statements.ts:61`).
- Row 108 confirms whether pre-R-FLEX code tolerates an audit `change` of `RELEASED` on read (91 §6.4, 94 §6.3; hypothesis). It decides whether a code rollback also needs a DB step.
- 94's correction: run the `SHA256SUMS` check inside the restore folder (`48_rflex_restore_point.md:86` form fails).
- Row 103 counts the eligible interfaces on .73 (hypothesis: 2).

### 9.2 For row 17 (install reconciliation; D15 moves the DEP resolution there)

- `<DEP:row91:migrations>` (row 13): **row 91 outcome = no migration on the recommended path: 34 migration files, journal head idx 33 `0033_capture_device_retirement_privileges`, schema 15 / `dbc-16`.** It changes to 36 files and 16 / `dbc-17` only if the user picks Q96-07 index or Q96-09 drop (37 files if the DB-M0 data step is needed).
- `<DEP:row91:down_migration>` (row 16): **none on the recommended path.** The rollback is code only (R-FLEX-R-B or R-FLEX-R-A). A bench DB built with R-FLEX code stays valid for the old code (91 §6.4 rows 1-4; `RELEASED` audit reading per 9.1).
- INSTALL-register name requests: `ufw_revert_unit` (rows 14, 16; proposal `dems-ufw-revert`), `pg_socket_dir`, `pg_conf_dir`, `pg_common_conf`, `pg_log_file` (row 13), `host_baseline_dir`, `install_backup_dir`, `disk_free_threshold` (row 16), `cli_cache_dir` (row 15, held by RULING until F-S3).
- `<DEP:row11:...>` and `<DEP:row13:...>` placeholders of row 16: row 11 and row 13 have landed; row 17 resolves them.
- Register conflict install register :63 (home) vs F-S1.

## 10. Risks and gaps

| Risk | Trigger | Mitigation |
|---|---|---|
| The user picks bundle C after the code rows start | late answer | Q96-02 is answered at row 96, before row 97; bundle C adds DB-A7, W-A9, a slice member (new name) and Q96-09 "keep" -> MAJOR at row 97 |
| Op 78 refuses the mic move | 88 E16 unverified | T-13 at row 108; op 78 change at row 97 |
| Typed-probe reply dropped by ufw on Wi-Fi | conntrack hypothesis wrong | 9A/H-12 / row 72; fallback only by the user (Q96-14) |
| Weak-host egress | overlapping subnets | refused by O-4 |
| Implementers read a delta file instead of this one | parallel docs | section 0 rule; row 97 cites this file per row (02_structured.md row 97 acceptance "traceable to masterplan/01_specs_rflex.md") |

Gaps:
- No database was queried. The bench row counts (A1) and the .73 eligible-interface count stay hypotheses.
- Op 78's mic ordering (88 E16) was not read here.
- The typed-probe conntrack behaviour is not measured.
- The audit reader's tolerance of `RELEASED` is not verified.
- The X-1 claim rests on the doc comments of `pipeline.ts`/`unit-of-work.ts` and on `index.ts:228-231` (op 99 runs through `app.engine.run`). The queue implementation body was not traced.

## 11. Implementation order (input to row 97)

102 (rule + context, contract for 103-106, 109) -> 99 then 100 (shared API, openapi) -> 107 (identity) -> 108 (exclusivity, re-key, release, T-6..T-13) -> 103-106 -> 109 -> 101/111/112 (words, web) -> 113/114 (host docs) -> 110 (static pins last). Row 98 = N/A record (Q96-07 recommended). This is the same order as 88 §12, 90 §8 and 94 "Implementation Order", which agree.

No `masterplan/02_plan.md` is written by this row; code planning is row 97's.

---
*Generated: 2026-10-22*
*Last Updated: 2026-10-22*
