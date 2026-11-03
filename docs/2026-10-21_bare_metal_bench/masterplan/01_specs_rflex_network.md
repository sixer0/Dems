---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
date: 2026-10-22
agent: data-analyst
row: 90
type: spec (R-FLEX network functional delta, "Global penuh")
narrative_tier: 1
confidence: HIGH for "today" facts (re-read in the repo this session, file:line below); MEDIUM for the design (depends on row 89's posture and the user's answers in row 96)
source_structured_task: docs/2026-10-21_bare_metal_bench/identification/02_structured.md (row 90; RQ-N1..N4 lines 106-109)
inputs: research/01_explore_rflex_network_core.md (row 84), research/01_explore_rflex_network_ui_docs.md (row 85), research/01_explore_rflex_security_history.md (row 86), masterplan/01_specs_rflex_register.md (row 87), decisions/decisions.md D10-D12
depends_on: row 87 (names, C); row 89 (security posture, running in parallel; NOT read, it did not exist when this file was written)
last_updated: 2026-10-22
---

# R-FLEX network functional delta (row 90)

All code paths are relative to `apps/core-server/src/` unless stated. Names come only from
`masterplan/01_specs_rflex_register.md` (cited by register id, e.g. RM-N1, NW-R1, NW-C1). One name
the delta needs is missing from the register; it is written `<REQ:...>` and requested in
`delegation_progress/file_requests.md`.

## 0. 5W1H (Tier 1)

| W | Answer |
|---|---|
| What | The functional change to the Core's camera-network rule so that ONVIF cameras are found and dialled on every host interface: destination behaviour per purpose, discovery interface choice, source-address selection, which `capture_network_config` fields stay required, and the boot/fence/host-alias checks that change |
| Who | Decided by: this row (RQ-N1, RQ-N3, RQ-N4 and the functional half of RQ-N2), row 89 (security posture, residual guards), the user via row 96 (RQ-N2 for COMMISSIONING_SCAN / SET_IP, off-link targets). Consumers: rows 91, 92, 93, 94, 95, code rows 102, 103, 106, HIL row 124 |
| When | Spec wave S2 (after row 87), 2026-10-22; code lands before the install (D10 ruling 3) |
| Where | `capture/destination-rule.ts`, `modules/capture-config/network/facts.ts`, `capture/fence/production-parts.ts`, `capture/adapters/camera/{discovery-collector,ws-discovery}.ts`, `capture/host-alias/{facts,caller}.ts`, `capture/boot/program-checks.ts`, `modules/capture-discovery/connect/service.ts`, `capture-composition.ts` |
| Why | D10 ruling 2 (verbatim): "Global penuh" -> discovery and connection on all host interfaces, the single camera-interface rule (destination-rule point 2, DR-4, S13-11) is lifted. D11: risk acknowledged ("Core bisa dial ke perangkat lain di jaringan kantor"). D12 U-RF3: search answers on the camera port only (HOST-23 unchanged) |
| How | Every caller and builder listed by row 84 was re-read at its line this session (section 1); each gets one new behaviour (section 4). The design keeps points 1, 3, 4 of S13-11 untouched (row 86 §2: they "are independent of which interface is used") and replaces only point 2 for the purposes D10(2) names |
| Alternatives | Per decision in sections 3 and 7, with the reason for the choice |
| Assumptions | (A1) "Global penuh" binds what a technician does in the search and with an adopted camera (find, test, adopt, open, watch). Whether it also binds the two commissioning operations that use the root alias helper (scan, set-IP) is RQ-N2's open half and goes to row 96. (A2) Linux connected routes: for a target inside the subnet of exactly one interface, the kernel's route leaves by that interface, so binding the source to that interface's address agrees with the route (standard Linux routing behaviour; not measured on .73 in this row). (A3) Row 89 keeps points 1, 3, 4 (row 86 §2 recommends it; register §3.1 "Not removed") |
| Gaps | Section 9 |

## 1. Today (verified this session)

| # | Fact | Evidence |
|---|---|---|
| T1 | `decideDestination` refuses in this order: bad purpose -> NOT_CONFIGURED; address class (point 1); facts null -> NOT_CONFIGURED; host address -> HOST_ADDRESS; target in any OTHER interface subnet -> OTHER_INTERFACE_SUBNET; inside camera subnet with no own camera address -> NO_CAMERA_SOURCE; outside camera subnet without a matching alias (alias only for COMMISSIONING_SCAN / SET_IP) -> OUTSIDE_CAMERA_SUBNET; edges; port | `capture/destination-rule.ts:343-373` |
| T2 | `factsOf` returns null (-> NOT_CONFIGURED) when `cameraSubnet` is null, when a camera-interface address is not private (:297), or when a non-alias camera address lies outside the camera subnet | `destination-rule.ts:289-315` |
| T3 | `DestinationContext` = `cameraSubnet` (nullable), `cameraAddresses`, `otherInterfaceSubnets`, `hostAddresses`, `allowedPorts` | `destination-rule.ts:157-168` |
| T4 | The one product builder `networkFactsOf` returns null when the row is absent, `interfaceName` or `cameraSubnet` is null, the subnet is unparsable, the host lacks the interface, or the port list is no array | `modules/capture-config/network/facts.ts:137-142` |
| T5 | The form checks call the STORED_CAMERA binding on a context with a subnet and no addresses and expect `NO_CAMERA_SOURCE` (`FORM_ACCEPTED`) | `facts.ts:173-195` |
| T6 | Null facts are replaced by `HOST_NOT_CONFIGURED` (cameraSubnet null) at the three reader call sites | `capture/fence/production-parts.ts:74`, `:91`, `:116`, `:810` |
| T7 | Every consumer of a STORED_CAMERA admission needs `sourceAddress`: an admission without one is a refusal (connect test `SOURCE_ABSENT`, camera watch `ADDRESS_REFUSED`, session open `ADDRESS_REFUSED`) | `modules/capture-discovery/connect/service.ts:378-381`; `capture/adapters/camera/camera-watch.ts:446-452`; `onvif-relay.ts:671-675` |
| T8 | The connection test maps the rule's `NOT_CONFIGURED` to `COMMISSIONING_NOT_CONFIGURED` with "the camera network of this Core is not set up" | `connect/service.ts:364-366`, `:385` |
| T9 | Discovery picks interfaces by property (IPv4, not internal, netmask not /0 or /32, MAC not all zero), first four in `os.networkInterfaces()` order; it never reads `capture_network_config` | `capture/adapters/camera/discovery-collector.ts:32`, `:63-80`; `ws-discovery.ts:178`, `:187` |
| T10 | A typed probe is refused `NO_ELIGIBLE_INTERFACE` when the rule's `sourceAddress` is not the address of a probed interface | `ws-discovery.ts:188-195` |
| T11 | The commissioning neighbour/echo programs and the neighbour reader work on the STORED camera interface (`interfaceNow`, filter by device) | `production-parts.ts:659-673`, `:815-821`, `:858-873` |
| T12 | Factory scan refuses `COMMISSIONING_NOT_CONFIGURED` when `!settings.configured` or facts null; set-IP refuses it when facts null or `cameraSubnet` null | `modules/capture-config/factory-scan/service.ts:565`, `:575`; `modules/capture-config/camera-network/service.ts:621` |
| T13 | HOST-46 boot check compares the interface file with `capture_network_config.interface_name`; a null stored interface is `NOT_ASKED`, not a pass | `capture/boot/program-checks.ts:20-23`, `:285-294`, `:331-342` |
| T14 | The alias caller refuses `NETWORK_NOT_CONFIGURED` with no stored interface and checks row vs file before the wrong-network guard, which reads `otherInterfaceSubnets` | `capture/host-alias/caller.ts:261-265`, `:291-301`, `:472-475`; `capture/host-alias/facts.ts:52-66` |
| T15 | Scan, set-IP, host-alias, typed probe and re-address are mounted only when the composition was handed a network reader | `capture-composition.ts:864-871` |

## 2. Decisions summary

| RQ | Decision | Status |
|---|---|---|
| RQ-N1 | Every caller and builder listed with its new behaviour (section 4). 7 production call sites, 2 test-only, 6 builders/derivers, 9 consumers | DECIDED (row 90) |
| RQ-N2 | TYPED_PROBE and STORED_CAMERA: global (any eligible interface, source chosen per section 3.2). COMMISSIONING_SCAN and SET_IP: **recommended to stay bound to the configured camera interface** (they use the root helper tied to ONE interface by HOST-46, and S13-08 pt 2/3 survive only so). Final word: user via row 96 (Q-R4 of the register), dependent on row 89 | TYPED/STORED DECIDED (FIRM per D10(2)); SCAN/SET_IP recommended, open -> row 96 (N-96-1) |
| RQ-N3 | Discovery stays property-based on all interface types, Wi-Fi included (no name test). `DISCOVERY_MAX_INTERFACES` (NW-K1) **stays 4**; the interface holding a typed probe's source is always among the four. Multicast answers arrive only on the camera port (U-RF3, HOST-23): stated consequence, not changed | DECIDED (row 90); the bound value is reopened only if row 89 or the user asks (N-96-4) |
| RQ-N4 | `interface_name` and `camera_subnet` stay NULLABLE (no DB change, DB-N1). They become **required only for COMMISSIONING_SCAN, SET_IP and the alias helper** (and for nothing if N-96-1 = global). Search, typed probe, connection test, adoption, session open, camera watch and re-address work with both null. The console network-config step becomes optional | DECIDED (row 90); the "required for scan/set-IP" half follows N-96-1 |
| Boot | HOST-46 (`program-checks.ts:285-294`) and host-alias agreement (`caller.ts:261-265`) unchanged in behaviour; only their reach is described anew. No new boot check. Details section 6 | DECIDED under the recommendation of N-96-1; changes listed for the alternative |

## 3. The new destination rule (functional)

### 3.1 Per purpose

| Purpose | Today | New behaviour (recommended) | Refusals raised for location |
|---|---|---|---|
| TYPED_PROBE | camera subnet only; source = own camera-interface address; NOT_CONFIGURED without config | **Global.** Any target that passes point 1 and is not a host address; source per 3.2. Works with `capture_network_config` empty | NW-R1 `NO_SOURCE_INTERFACE`; `<REQ:SOURCE_INTERFACE_AMBIGUOUS>`. Never again: OTHER_INTERFACE_SUBNET, OUTSIDE_CAMERA_SUBNET, NO_CAMERA_SOURCE, NOT_CONFIGURED-for-empty-config (RM-N1..N4, FIRM) |
| STORED_CAMERA | same as TYPED_PROBE | **Global**, same as TYPED_PROBE. Every open, connection test, presence read and re-address judgement (AD-02 stays: same function at every use) | same as TYPED_PROBE |
| COMMISSIONING_SCAN | camera subnet or one alias /24 on the camera interface | **Unchanged** (recommended; N-96-1). Still needs `cameraSubnet` and the camera interface; others = every interface subnet except the camera interface's | OTHER_INTERFACE_SUBNET, NO_CAMERA_SOURCE, OUTSIDE_CAMERA_SUBNET, NOT_CONFIGURED (constants kept for these purposes) |
| SET_IP | as scan; new address via `decideNewCameraAddress` inside the camera subnet | **Unchanged** (recommended; N-96-1), including `decideNewCameraAddress` (`destination-rule.ts:411-448`) | as scan |

Points 1, 3, 4 and the set-IP paragraph apply to every purpose as today (register §3.1 "Not removed"; row 86 §2). Keep/drop of each residual guard is row 89's.

### 3.2 Source-address selection for the global purposes

Today the source is "the first non-alias camera-interface address" (`destination-rule.ts:357-361`). New statement, applied for TYPED_PROBE and STORED_CAMERA:

1. Candidates are the entries of `interfaceSubnets` (NW-C1) whose subnet holds the target. An entry is one IPv4 address of one eligible interface with its prefix length.
2. **Eligible interface** = the same property test discovery uses (`discovery-collector.ts:67-74`): IPv4, not internal, netmask not /0 and not /32, hardware address not all zero (tunnels and VPN devices have none). One definition for "where the Core searches" and "where it dials" (recommended; it is also a residual guard -> row 89 confirms, N-96-3).
3. Addresses the alias helper put on the camera interface (`cameraAddresses` with `alias: true`) are never a source for these purposes (today alias is refused for them, `destination-rule.ts:362-364`); they stay in `hostAddresses` (HOST_ADDRESS).
4. The longest prefix wins (what the kernel's connected route picks, A2). Within one interface, the first address in the host's order.
5. Two or more DIFFERENT interfaces with the same longest prefix holding the target: refused `<REQ:SOURCE_INTERFACE_AMBIGUOUS>`. This is exactly bench finding 17 / hypothesis H-U (same /24 on the camera port and on Wi-Fi, row 86 §1 DR-4 row): the one wrong-network case that remains a refusal under "Global penuh", because no source can be named that agrees with the route.
6. No candidate (target not on-link on any eligible interface, i.e. it would leave through a gateway): refused NW-R1 `NO_SOURCE_INTERFACE`. Recommended (on-link only). Allowing routed targets is a posture choice: row 89 / row 96 (N-96-2).
7. The admission keeps its shape: `address`, `port`, `sourceAddress`, `viaAlias` (`false` for these purposes). Every consumer (T7) keeps binding `localAddress`/`source` to it unchanged, so the "no admission without a source" contract (T7) holds without code change in the consumers.

### 3.3 The context (`DestinationContext`)

| Member | New content | Note |
|---|---|---|
| `cameraSubnet` | unchanged: configured subnet or null | null no longer makes the context unreadable; it only refuses COMMISSIONING_SCAN / SET_IP with NOT_CONFIGURED |
| `cameraAddresses` | unchanged: what the stored camera interface holds (own and alias); empty when no interface is stored or the host lacks it | |
| `otherInterfaceSubnets` | **replaced by** `interfaceSubnets` (NW-C1): every eligible interface's address with interface name, address, network, prefix length, the camera interface included | for the bound purposes the rule derives "other" = entries whose address is not in `cameraAddresses` |
| `hostAddresses` | unchanged: every IPv4 address on any interface, eligible or not | HOST_ADDRESS keeps covering loopback-side and tunnel addresses |
| `allowedPorts` | unchanged | point 3 |

`factsOf` validation: the "camera-interface address private" test (`destination-rule.ts:297`) stays for `cameraAddresses`; it is NOT extended to `interfaceSubnets` — an office/Wi-Fi interface may hold any address, and point 1 already refuses public TARGETS (PUBLIC_ADDRESS). The "non-alias camera address inside the camera subnet" test applies only when `cameraSubnet` is non-null.

## 4. RQ-N1: every caller and builder, new behaviour

### 4.1 Rule callers (production)

| # | Site | Purpose | New behaviour |
|---|---|---|---|
| C1 | `capture/fence/production-parts.ts:80-92` `storedCameraAddressRuleOf` (call :91) | STORED_CAMERA | Global per 3.2. Reader absent/throws/null -> `HOST_NOT_CONFIGURED` (:74) whose shape gains `interfaceSubnets: []` -> refusal NW-R1 (fail-closed C55 kept: nothing dialled). `unreadable` report unchanged |
| C2 | `production-parts.ts:105-117` `typedProbeRuleOf` (call :116) | TYPED_PROBE | Global per 3.2; same fallback as C1. Doc comment "held to the configured camera subnet" (:98-104) rewritten |
| C3 | `production-parts.ts:156-158` `factoryScanRuleOf` (call :157) | COMMISSIONING_SCAN | Unchanged (N-96-1 recommended) |
| C4 | `production-parts.ts:202-204` `cameraNetworkDialRuleOf` (call :203) | SET_IP | Unchanged (N-96-1 recommended) |
| C5 | `production-parts.ts:207-209` `cameraNewAddressRuleOf` (call :208) | set-IP new address | Unchanged; OUTSIDE_CAMERA_SUBNET at `destination-rule.ts:426` stays |
| C6 | `production-parts.ts:804-811` `admitted` (call :810), used by `job.neighbour`/`job.answers` (SET_IP, :860-862) and `scan.mac` (COMMISSIONING_SCAN, :873) | SET_IP / SCAN | Unchanged; `interfaceNow` (:815-821) and the neighbour filter (:659-673) stay on the stored camera interface |
| C7 | `modules/capture-discovery/readdress-route.ts:171` `readdressRuleOf` -> C1 | STORED_CAMERA | Follows C1: a confirmed re-address (op 100) is judged globally |

### 4.2 Rule callers (test-only)

| # | Site | New behaviour |
|---|---|---|
| C8 | `apps/core-server/test/acceptance/contract.test.ts:1306` (SCAN), `:1424-1425` (SET_IP + new address) | Unchanged under N-96-1 recommendation; context literals rename `otherInterfaceSubnets` -> `interfaceSubnets` |
| C9 | `capture/__tests__/destination-rule.test.ts` (point 2 cases :195-262, :368-370) | Point-2 cases for TYPED_PROBE / STORED_CAMERA flip to allow-with-source or NW-R1 / `<REQ:SOURCE_INTERFACE_AMBIGUOUS>`; SCAN/SET_IP cases kept. Row 94 enumerates |

### 4.3 Builders of `DestinationContext`

| # | Site | New behaviour |
|---|---|---|
| B1 | `modules/capture-config/network/facts.ts:137` `networkFactsOf` (wired `network/index.ts:198`) | Returns a context whenever the host's interfaces are readable and the stored port list is an array — **also when the row is absent or interface/subnet are null**. Fills `interfaceSubnets` from every eligible interface (3.2 step 2; `readHostInterfaces` :123 must also read the hardware address and keep it per address). Null only for unreadable host facts or a non-array port list. With no row: `allowedPorts` = `DESTINATION_DEFAULT_PORTS` |
| B2 | `facts.ts:173-195` `FORM_ACCEPTED` / `formAccepted` / `cameraSubnetAccepted` / `factoryAddressAccepted` | Under N-96-1 = bound: `formAccepted` asks the SET_IP binding (C4) instead of STORED_CAMERA; sentinel `NO_CAMERA_SOURCE` and both checks unchanged (RM-N3 constant kept). Under N-96-1 = global: sentinel becomes NW-R1 on a context with `interfaceSubnets: []`, and the subnet prefix bounds move into `subnetOf` of `facts.ts:88` |
| B3 | `capture/fence/production-parts.ts:74` `HOST_NOT_CONFIGURED` | Shape follows 3.3; still refuses every purpose |
| B4 | `modules/capture-config/factory-scan/service.ts:430` `supposing` | Unchanged (scan bound); spreads the new member unchanged |
| B5 | `modules/capture-config/camera-network/service.ts:399` `withoutAlias`, `:401` `supposing` | Unchanged (set-IP bound) |
| B6 | `capture/host-alias/facts.ts:27-66` `hostAliasFactsReaderOf` (consumer that re-shapes) | `HostAliasFacts.otherInterfaceSubnets` (`caller.ts:241-255`) is KEPT as the alias guard's own member and derived here from `interfaceSubnets` minus the stored interface's entries; because B1 no longer returns null for a missing interface, the reader throws `HostAliasFactsUnknownError` when a stored interface exists but `cameraSubnet` is null or the host lacks that interface (today's meaning kept) |

### 4.4 Consumers of the admission and of the refusal word

| # | Site | New behaviour |
|---|---|---|
| U1 | `capture/adapters/camera/stored-address.ts:208-239` `judgeStoredCamera` | Unchanged code; now receives sources on any eligible interface |
| U2 | `camera-watch.ts:446-454`, `onvif-relay.ts:671-708`, `onvif-session.ts:556`, `stream-probe.ts:426-435`, `modules/capture-discovery/adopted-test.ts:304` | Unchanged code: bind to the named source (now possibly the Wi-Fi or another LAN address) |
| U3 | `onvif-network.ts:356-375` (set-IP SOAP) | Unchanged (SET_IP bound) |
| U4 | `modules/capture-discovery/connect/service.ts:364-366`, `:378-385` | The F3-06 branch `RULE_NOT_CONFIGURED -> COMMISSIONING_NOT_CONFIGURED` is removed (RM-N4: STORED_CAMERA no longer raises NOT_CONFIGURED for empty config). Every refusal, including NOT_CONFIGURED from unreadable facts, answers `CANDIDATE_NOT_TESTABLE`. Text `CANDIDATE_ADDRESS_REFUSED_TEXT` loses "from its camera interface" (wording: row 92). Words W-N3 removed (row 92) |
| U5 | `modules/capture-discovery/typed-address.ts:40,63`; `routes.ts:28,71,131` | Unchanged: refusals still answer `422 DISCOVERY_ADDRESS_NOT_ALLOWED` (F8); fewer addresses are refused |
| U6 | `ws-discovery.ts:188-195` (typed-probe source must be probed) | Unchanged check; it now holds by construction because of 5.2 |
| U7 | `capture-composition.ts:19-26` (C55 text), `:464`, `:762`, `:869-871` | Wiring unchanged. Header text of C55 rewritten: "no reader, or an unreadable host: every address refused"; "not configured" no longer means refused for stored cameras |

## 5. RQ-N3: discovery

### 5.1 Eligibility

- Kept: by property, never by name (`discovery-collector.ts:60-75`). Wi-Fi is already eligible (row 84 N3) and stays so under "Global penuh". Link-local stays eligible for the multicast probe (a link-local candidate is still refused LINK_LOCAL when tested or adopted, point 1).
- Not tied to `capture_network_config` (today and after).

### 5.2 The bound of four

- **Decision: `DISCOVERY_MAX_INTERFACES` stays 4 (NW-K1).** Reason: it is a DS-4 cost bound of one search (one socket, 2 probes x 2 rounds per interface, `ws-discovery.ts:1-14`), the same family as point 4; "Global penuh" asks that no interface is excluded by role, not that the bound grows. The bench host has no Docker since D2 (bridges gone); a camera port plus Wi-Fi is two interfaces (hypothesis, not counted in this row; row 103 counts it in its fixture/bench note).
- **Change:** when a search carries a typed probe, the interface whose address is the rule's `sourceAddress` is placed first among the probed interfaces, then the others in table order up to four. So a typed address on a fifth interface is never refused `NO_ELIGIBLE_INTERFACE` for ordering alone.
- A host with more than four eligible interfaces: the multicast probe reaches the first four (table order). Recorded limit; the search answer keeps reporting `interfaceCount` (F9), so the console can show how many networks were searched.
- Alternative (raise to 8 = `DESTINATION_MAX_PORTS`-like small bound, or unbounded): not chosen; no measured need. Reopen via N-96-4.

### 5.3 Consequence of U-RF3 (fixed ruling, not changed here)

HOST-23 admits UDP answers from port 3702 on the camera interface only (`scripts/host/HOST-PROFILE-UBUNTU-24.04.md:85`; `40-network-firewall.sh:84-88`), and HOST-22 is default deny. Hence on Wi-Fi or any other interface:
- the multicast search sends its probes but its answers (unicast from each camera to the Core's ephemeral port) are dropped: cameras there are NOT listed by the multicast search;
- the typed probe (unicast to one address) is expected to work, because its answer is a reply to a flow the Core opened (ufw's connection tracking admits it) — HYPOTHESIS, to be measured on .73 by the HIL/bench rows; and stored-camera TCP dials (ONVIF HTTP, RTSP) are replies to outgoing connections and pass.
So, with U-RF3 as approved, "global discovery" on non-camera interfaces means "typed address + connect", not "listed by search". This is stated for row 93 (HOST-23 wording) and row 92 (console hint). The user may revisit only through row 96 (N-96-5); this row does not reopen U-RF3.

## 6. Boot, fence and host-alias checks

| Check | Site | Change |
|---|---|---|
| HOST-46 interface file vs stored row | `capture/boot/program-checks.ts:285-294` (`interfaceReason`), `:331-342` | **No change in behaviour** under N-96-1 = bound: the helper stays tied to one interface; a null stored interface stays `NOT_ASKED` (already so). Header text :20-23 stays. Since the network-config step becomes optional, a Core with the helper installed and no stored interface reports `NOT_ASKED` — accepted (helper unused until a scan/set-IP is configured) |
| Alias agreement | `capture/host-alias/caller.ts:261-265`, `:472` | No change: `NETWORK_NOT_CONFIGURED` still answers an alias request without a stored interface; only scan and set-IP ask for aliases |
| Alias wrong-network guard | `caller.ts:291-301` (`wrongNetworkRefusal`) | No change in logic; its `otherInterfaceSubnets` input is derived in B6 |
| HOST-20 forwarding | `capture/boot/host-checks.ts:113` | No change (host hygiene; row 85 "hygiene-compatible") |
| Fence commissioning inputs | `production-parts.ts:720`, `:815-821`, `:659-673` | No change (bound purposes) |
| Fence reader fallbacks | `production-parts.ts:91`, `:116`, `:810` | Fallback constant `HOST_NOT_CONFIGURED` re-shaped (B3); refusal for global purposes becomes NW-R1 instead of NOT_CONFIGURED |
| CF-2, CF-3 names | `program-checks.ts:75,111,129`; `caller.ts:110,113,262` | Unchanged (register CF-2/CF-3 FIRM unless N-96-1 = global) |

**If the user chooses N-96-1 = global** (not recommended), these change: the helper interface file (CF-2) would need one name per interface or be dropped, HOST-46 would compare a set, `interfaceNow` and the neighbour filter would take the interface of the rule's source (the admission would have to carry an interface name — a new member not in the register), `decideNewCameraAddress` would need a subnet per interface, and S13-08 pt 2/3 would need re-review by row 89. That is a larger change than D10(2) states and is why staying bound is recommended.

## 7. RQ-N4: required fields and the console step

| Field | Required for | Not required for |
|---|---|---|
| `interface_name` | COMMISSIONING_SCAN, SET_IP, alias helper (HOST-46 comparison) | search, typed probe, connection test, adoption, session open, camera watch, re-address |
| `camera_subnet` | COMMISSIONING_SCAN, SET_IP (`decideNewCameraAddress`) | as above |
| `factory_addresses`, `alias_host`, `alias_minutes`, `camera_ip_start` | scan / set-IP (defaults exist, DB-N2) | as above |
| `onvif_ports` | every purpose (point 3); default `[80]` when no row (B1) | — |

- DB: no change (DB-N1, DB-N2 FIRM). API: `configured` keeps its formula (`network/service.ts:136-139`: both set) and its meaning narrows to "scan and set-IP can run" (OP-101/102 text change, register). Row 92 owns wording W-N1/W-N2.
- Console (`apps/core-web/src/features/commissioning/index.tsx:237-392`): the step is OPTIONAL; the not-configured alert (:296-304) speaks only of scan and set-IP. The form already submits empty as null (`commissioning/model.ts:75-76`, `:242-243`).
- HIL row 124: becomes "set only if factory-default cameras will be re-addressed on the bench"; otherwise N/A with reference to this section (decided by the user via row 96 only as a scheduling question, N-96-6).

## 8. Implementation order (for row 97 refinement)

1. Row 102: rule (3.1-3.3) + `destination-rule.test.ts`; after row 89 and row 96 answers (contract dependency 89:C, 90:C).
2. Row 103: B1/B2, discovery ordering (5.2), adapter tests (no consumer code change expected, U1-U3).
3. Row 106: B6, fence fallback B3, connect-service U4, boot texts; HOST-46 behaviour unchanged.
4. Row 92/99/104-105 (word/API text) in parallel with 3; row 124 last.

## 9. Acceptance criteria (measurable)

1. `decideDestination` for TYPED_PROBE and STORED_CAMERA on a context with `cameraSubnet: null` and one eligible interface `wlp* 192.168.0.73/24` allows `192.168.0.50` with `sourceAddress = 192.168.0.73`, `viaAlias = false` (table test).
2. Same purposes: target on no eligible interface -> NW-R1; target inside the same /24 on two interfaces -> `<REQ:SOURCE_INTERFACE_AMBIGUOUS>`; target = a host address -> HOST_ADDRESS; each point-1 code unchanged (all existing point-1 tests pass unmodified).
3. COMMISSIONING_SCAN and SET_IP: every existing point-2 test passes unmodified except for the context member rename (under N-96-1 = bound).
4. `grep -n "COMMISSIONING_NOT_CONFIGURED" modules/capture-discovery/connect/service.ts` returns 0 lines; the connection test of a candidate on Wi-Fi with an empty network config reaches the tester bound to the Wi-Fi address (service test).
5. `networkFactsOf(null, interfaces)` returns a non-null context with `interfaceSubnets` filled and `allowedPorts = [80]`.
6. Discovery fixture with 5 eligible interfaces and a typed source on the 5th: the 5th is probed and the search is not refused `NO_ELIGIBLE_INTERFACE`; `probed.length = 4`.
7. Boot tests `capture/boot/__tests__/{checks,boot}.test.ts` and host-alias tests pass with HOST-46 results unchanged.
8. Bench (HIL, later row): a camera reachable only via the Wi-Fi subnet is adopted by typed address and opens a session; packet capture or `ss -tnp` shows the Core's source = the Wi-Fi address.

## 10. Risks

| Risk | Trigger | Mitigation |
|---|---|---|
| Core dials office devices (accepted by D11) | technician types an office address | points 1, 3, 4 kept; on-link only (N-96-2); residual guards per row 89 |
| Weak-host routing disagreement | overlapping subnets on two interfaces | refused `<REQ:SOURCE_INTERFACE_AMBIGUOUS>` (3.2 step 5) |
| Operator expects Wi-Fi cameras in the search list | U-RF3 firewall drops multicast answers off the camera port | 5.3 stated in console hint (row 92) and HOST-23 note (row 93) |
| Typed-probe reply on Wi-Fi also dropped by ufw | conntrack does not match the reply (hypothesis 5.3 wrong) | bench check in HIL; fallback: N-96-5 |
| Silent regression of the alias guard | B6 derivation wrong | host-alias tests (row 94 list) |

## 11. For row 96 (open; depend on row 89 where marked)

| Id | Question | Options | Recommendation | Depends on |
|---|---|---|---|---|
| N-96-1 | RQ-N2 / register Q-R4: do COMMISSIONING_SCAN and SET_IP stay bound to the configured camera interface? | (a) stay bound; (b) global | (a): the root helper and HOST-46 are one-interface by design; S13-08 pt 2/3 and DR-4-in-helper stay valid; re-addressing devices is the riskiest act (sends a digest, writes an address) and D10(2) names discovery and connection, not re-addressing. Consequence of (b): section 6 last paragraph | **row 89** (posture), user |
| N-96-2 | Off-link (routed) targets for TYPED_PROBE / STORED_CAMERA | (a) refuse NW-R1 (on-link only); (b) allow via the default route, source = kernel's choice | (a): keeps a named source for every dial (T7 contract) and keeps point 1's private-range reach to directly attached networks | **row 89**, user |
| N-96-3 | Source interfaces limited to the discovery eligibility test (excludes tunnels/VPN, zero MAC) | (a) yes; (b) any non-internal interface | (a): one definition for search and dial; a VPN to another site is not a "host interface" a camera sits on | **row 89** (residual guard) |
| N-96-4 | `DISCOVERY_MAX_INTERFACES` | (a) keep 4 + typed-source priority; (b) raise; (c) unbounded | (a) | row 89 (point-4 family) |
| N-96-5 | Search answers off the camera port (U-RF3 consequence, 5.3) | (a) keep U-RF3: other interfaces = typed address only; (b) reopen U-RF3 / AC7 | (a): U-RF3 and AC7 are fixed rulings (D12); listed only so the user sees the consequence | user (D12 holder); row 93 |
| N-96-6 | HIL row 124 on the bench | (a) N/A unless set-IP/scan will be used; (b) always set the camera port config | (a) if N-96-1 = (a) and no factory-default camera is to be re-addressed; else (b) | user |

## 12. Gaps

- Row 89's file did not exist when this row ran; every "depends on row 89" item is a recommendation, not a decision. Row 95 must reconcile.
- The ufw conntrack behaviour for the typed unicast reply (5.3) is reasoning, not measured.
- Number of eligible interfaces on .73 after Docker removal not counted here (no host access in spec waves).
- `<REQ:SOURCE_INTERFACE_AMBIGUOUS>` awaits a register value (request filed).
- Test enumeration per line is row 94's; the lists above are by site.

---
*Generated: 2026-10-22*
*Last Updated: 2026-10-22*
