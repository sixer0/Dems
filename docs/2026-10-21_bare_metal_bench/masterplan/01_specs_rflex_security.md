---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
date: 2026-10-22
agent: security-review
row: 89
type: spec (R-FLEX security posture delta, "Global penuh")
narrative_tier: 1
assessment: CAUTION
source_structured_task: docs/2026-10-21_bare_metal_bench/identification/02_structured.md (row 89, line 257; RQ-N2 line 107, RQ-N5 line 110, RQ-N6 line 111; Risk Assessment line 485-486)
inputs: research/01_explore_rflex_network_core.md (row 84), research/01_explore_rflex_network_ui_docs.md (row 85), research/01_explore_rflex_security_history.md (row 86), masterplan/01_specs_rflex_register.md (row 87), decisions/decisions.md D10-D12
names: R-FLEX names ONLY from masterplan/01_specs_rflex_register.md; one missing name requested as <REQ:...> (delegation_progress/file_requests.md)
code_state: read-only re-read of apps/core-server/src/capture/destination-rule.ts on branch task4/input-av-core-port, 2026-10-22
last_updated: 2026-10-22
---

# R-FLEX security posture delta: "Global penuh" (row 89)

## 0. Ruling, risk acceptance, and what this spec does

**The ruling (D10 ruling 2, decisions.md:23):** ONVIF cameras "Global penuh" -> "discovery and connection on all host interfaces, the single camera-interface rule (destination-rule point 2, DR-4, S13-11) is lifted."

**The risk acceptance (D11, decisions.md:24), quoted:**

> "RISK ACKNOWLEDGED by the user's choice of "Global penuh" with the option text shown ("membatalkan temuan keamanan S13-11 dan aturan isolasi HOST-19..23; Core bisa dial ke perangkat lain di jaringan kantor"). The revised blueprint must still carry a security-review row stating the new posture and any residual guard the user may keep"

**Fixed rulings this spec does not reopen** (driver_rules.md, "Spec waves"): D10, D11, D12. In particular D12 U-RF3: "search answers on the camera port only, AC7 unchanged" (decisions.md:28).

**What this spec does.** It lists every refusal of the destination rule and says, per refusal, whether it is lifted or kept and why (section 2). It proposes residual guards and the threat each still defends (section 3). It states the new source-address rule (section 4), says per purpose whether "global" applies (section 5), states the HOST-23 consequence (section 6), and lists residual risks (section 7). Questions for the user go to "For row 96" (section 9). The posture assessment is in section 10.

### 0.1 5W1H (Tier 1)

| W | Answer |
|---|---|
| What | The security delta of lifting destination-rule point 2 (S13-11 pt 2, DR-4) for cameras, with the guards that stay |
| Who | Decides: the user (D10, D11; residual guards at row 96, posture confirmed at gate row 119). Consumers: row 90 (network spec), 93 (host docs), 14 (install security delta, HOST-23 scope), 95 (reconcile), 96 (decision sheet), 102 (code change of the rule), 117 (security review of the code) |
| When | Spec wave S2 (after row 87), 2026-10-22, before any R-FLEX code (D10 ruling 3: code first, before the install) |
| Where | `apps/core-server/src/capture/destination-rule.ts` (the one pure rule), its builder `modules/capture-config/network/facts.ts`, its binding file `capture/fence/production-parts.ts`; host firewall HOST-22/23 (`scripts/host/HOST-PROFILE-UBUNTU-24.04.md:84-85`) |
| Why | D10(2) cancels the threat that only point 2 defends ("Core acts on / routes via the wrong network", row 86 §2). Points 1, 3, 4, set-IP, AD-02 and S13-08 defend threats that do not depend on which interface is used (row 86 §2), so they stay |
| How | Each refusal code read in `destination-rule.ts:36-86` and its raise sites (grep this session); threat taken from row 86's table (SEC/ADD/SPEC citations carried through); per-purpose wiring from row 84 N1/N2; HOST-23 from row 85 and the host profile |
| Alternatives | Per purpose: global vs bound (section 5); source rule: on-link only vs routed allowed vs kernel choice (section 4.3); HOST-23: decided (U-RF3), not re-offered |
| Assumptions | (S1) D10(2) "all host interfaces" means directly attached IPv4 networks, not routed reach through a gateway (recommendation; confirm at row 96, Q89-2). (S2) The bench host has the camera port enp4s0 and Wi-Fi wlp3s0 (02_structured.md:486, :204) |
| Gaps | Section 11 |

## 1. The threat that is cancelled, and the threats that stay

From row 86 (`research/01_explore_rflex_security_history.md` §0-§2):

| Threat (id used below) | Defended by today | Status under "Global penuh" |
|---|---|---|
| **T-WRONGNET**: the Core scans, dials, or re-addresses devices on the office/other LAN, or a route silently leaves by another interface (SEC:231, SEC:235; SPEC:397, :419; bench finding 17 / H-U) | Point 2 only (OTHER_INTERFACE_SUBNET, OUTSIDE_CAMERA_SUBNET, NO_CAMERA_SOURCE, NOT_CONFIGURED as "no camera interface"), DR-4, S13-08 pt 3 | **Accepted by D11** for TYPED_PROBE and STORED_CAMERA. Kept for COMMISSIONING_SCAN and SET_IP if row 96 confirms section 5 |
| **T-SSRF-SELF**: request forgery to the Core itself / loopback / link-local / special addresses / names that resolve elsewhere (SEC:231 "the Core itself"; SEC:234) | Point 1 | Stays: independent of interface |
| **T-SSRF-PUBLIC**: the Core used to reach the internet or a routable address | Point 1 PUBLIC_ADDRESS | Stays |
| **T-PORT**: the Core used to probe arbitrary services/ports; redirects; unbounded replies (SEC:236; input-av `factory.py:154`) | Point 3 | Stays |
| **T-FLOOD**: the Core used as a sweep/flood engine; camera lock-out by repeated attempts (SEC:237) | Point 4 | Stays; its weight rises (more networks reachable) |
| **T-READDRESS**: a camera taken off its network, address collision with the Core/gateway/another camera, prefix tampering (SEC:239) | set-IP paragraph | Stays |
| **T-FAKESOURCE**: a stored row at loopback/host address posing as a production camera; credential revealed to a refused address (ADD:147-163) | AD-02 (point 1 at every use) | Stays (uses point 1, not point 2) |
| **T-ROOTHELPER**: the privileged alias helper used to re-address the host, incl. onto the office network (SEC:193-197; PLAN:782 R-19) | S13-08 pt 2 (alias /24, RFC 1918, host 1-254) and pt 3 (DR-4 inside the helper) | Stays, provided COMMISSIONING_SCAN and SET_IP stay bound (section 5) |

## 2. Lifted vs kept: every destination-rule refusal

Source: `apps/core-server/src/capture/destination-rule.ts`; "def" = line in the refusal block `:36-86`; "raised" = raise sites (grep this session). Names as in the register (§3.1: RM-N1..N4 and the "Not removed" list). Purposes abbreviated: TP = `TYPED_PROBE`, SC = `STORED_CAMERA`, CS = `COMMISSIONING_SCAN`, SI = `SET_IP`, NA = `decideNewCameraAddress` (set-IP new address, no purpose).

### 2.1 Point 1: address class (no host facts), `classify` :249-259, `refusalOfText` :234-246

| Refusal code | def | raised | Threat it defends (row 86) | Lifted / kept | Reason |
|---|---|---|---|---|---|
| `NOT_AN_ADDRESS` | :38 | :250 | T-SSRF-SELF (malformed input reaching the dialler) | **Kept** (all purposes) | Input hygiene; independent of interface |
| `HOST_NAME` | :40 | :245 | T-SSRF-SELF: a name resolving to the host or elsewhere; "Names are never resolved" (RULE:40) | **Kept** | Lifting point 2 adds no reason to resolve names; DNS rebinding stays impossible |
| `MALFORMED_IPV4` | :42 | :237, :243, :245 | T-SSRF-SELF: strange encodings (octal, hex, bare integer) that parsers read differently | **Kept** | Interface-independent |
| `IPV6_LITERAL` | :44 | :243 | T-SSRF-SELF / scope: IPv6 is outside the designed surface | **Kept** | Global does not widen to IPv6; discovery is IPv4 only (discovery-collector.ts:67, row 84 N3) |
| `IPV4_MAPPED_IPV6` | :46 | :242 | T-SSRF-SELF: `::ffff:127.0.0.1`-style bypass | **Kept** | Interface-independent |
| `LOOPBACK` | :48 | :241, :254 | T-SSRF-SELF: the Core's own services (Core and DB on 127.0.0.1, HOST-24; worker listeners 8554-8564, HOST-25) | **Kept** | Most important residual guard; also the AD-02 core |
| `UNSPECIFIED` | :50 | :240, :253 | T-SSRF-SELF: 0.0.0.0 reaches local listeners on Linux | **Kept** | Interface-independent |
| `LINK_LOCAL` | :52 | :255 | T-SSRF-SELF: link-local reach, metadata-style endpoints (row 86 table pt 1) | **Kept** | Global reach makes a link-local Wi-Fi/USB-gadget network more likely, not less |
| `MULTICAST` | :54 | :256 | T-FLOOD / fan-out: one request reaching many hosts | **Kept** | Interface-independent. The search's own multicast is outside the rule (ws-discovery.ts:12, TTL 1) |
| `BROADCAST` | :56 | :257 | T-FLOOD / fan-out | **Kept** | Interface-independent |
| `PUBLIC_ADDRESS` | :58 | :258 | T-SSRF-PUBLIC | **Kept** | D10(2) asks for host interfaces, not the internet. Note: office LANs are also RFC 1918, so this guard does NOT protect office hosts (accepted by D11) |

### 2.2 Point 1 with host facts

| Refusal code | def | raised | Threat | Lifted / kept | Reason |
|---|---|---|---|---|---|
| `NETWORK_ADDRESS` | :60 | :320 via `edgeRefusal`, applied :369 (decide), :427-428 (NA) | T-FLOOD (directed-broadcast-like edge), T-READDRESS (an edge is not a host) | **Kept**, basis changes for TP/SC | Applied on the /24 and on the **source interface's own prefix** (today: camera/alias prefix). See section 4 rule step 6 |
| `SUBNET_BROADCAST` | :62 | :321 (same) | Same | **Kept**, basis changes for TP/SC | Same |
| `HOST_ADDRESS` | :64 | :352, :424 | T-SSRF-SELF: "an address the Core host itself holds, on any interface, alias addresses included" (RULE:64) | **Kept** (all purposes) | More important under global: with every interface in reach, the Core's Wi-Fi address becomes a reachable target. Fact source must list every interface's addresses (`hostAddresses`, facts.ts:137-166) |

### 2.3 Point 2: interface binding (the lifted point)

| Refusal code | def | raised | Threat | Lifted / kept | Reason |
|---|---|---|---|---|---|
| `OTHER_INTERFACE_SUBNET` (RM-N1) | :66 | :353 (decide), :425 (NA) | T-WRONGNET (DR-4; SEC:235; SPEC:419) | **Lifted for TP, SC.** **Kept for CS, SI, NA** (recommended, row 96 Q-R4) | D10(2) lifts it for discovery and connection; D11 accepts T-WRONGNET. CS/SI write a camera's address and use the root alias helper (section 5) |
| `NOT_CONFIGURED` (RM-N4), meaning "no camera interface / no camera subnet" | :68 | :351 (facts null), :420 (NA) | T-WRONGNET (fail-closed when the camera network is unknown, C55) | **Lifted for TP, SC in this meaning.** **Kept for CS, SI, NA** | Under global, TP/SC no longer need a configured camera network. Fail-closed is kept in another form: an unreadable interface list still refuses (section 4 step 0) |
| `NOT_CONFIGURED`, other meanings | :68 | :345 (bad purpose/request), :413 (bad request), :433 (gateway unreadable), :446 (registry unreadable) | Fail-closed on malformed input or unreadable facts | **Kept** (all purposes) | Not interface-related (register RM-N4: "The constant STAYS") |
| `OUTSIDE_CAMERA_SUBNET` (RM-N2) | :70 | :364 (decide), :426 (NA) | T-WRONGNET; for NA also T-READDRESS (camera moved off the camera network) | **Lifted for TP, SC.** **Kept for CS, SI, NA** | Same as RM-N1. For NA it is the set-IP paragraph's "inside the configured camera subnet" element (row 86 table, set-IP row) |
| `NO_CAMERA_SOURCE` (RM-N3) | :72 | :360 | T-WRONGNET: "the route would leave by another interface" | **Lifted for TP, SC** (replaced by NW-R1 `NO_SOURCE_INTERFACE` and `<REQ:DestinationRefusal.SOURCE_AMBIGUOUS>`, section 4). **Kept for CS, SI** | Under global the source comes from the interface that holds the target's subnet. **Side effect to carry to rows 90/102:** `NO_CAMERA_SOURCE` is the form-check sentinel `FORM_ACCEPTED` (`modules/capture-config/network/facts.ts:174`), asked through `storedCameraAddressRuleOf` (STORED_CAMERA, facts.ts:178). Once SC stops raising it, `cameraSubnetAccepted` and `factoryAddressAccepted` would reject every form. The form check must ask a still-bound purpose or test the class refusals directly |

### 2.4 Point 3: port, `decidePort` :326-333

| Refusal code | def | raised | Threat | Lifted / kept | Reason |
|---|---|---|---|---|---|
| `PORT_OUT_OF_RANGE` | :74 | :331 | T-PORT | **Kept** | Interface-independent |
| `PORT_NOT_LISTED` | :76 | :332 | T-PORT: dialling arbitrary services | **Kept** | More important under global: office hosts are reachable; the short list (default `[80]`, max 8, `DESTINATION_DEFAULT_PORTS` :109, `DESTINATION_MAX_PORTS` :111) is what keeps the reach to ONVIF ports |
| `PORT_LIST_INVALID` | :78 | :329 | T-PORT: a corrupt list opening everything | **Kept** | Fail-closed |

### 2.5 Set-IP paragraph, `decideNewCameraAddress` :411-448

| Refusal code | def | raised | Threat | Lifted / kept | Reason |
|---|---|---|---|---|---|
| `DHCP_NOT_CARRIED` | :80 | :414 | T-READDRESS ("the mode can only lose a camera", SEC:239) | **Kept** | Interface-independent |
| `GATEWAY_ADDRESS` | :82 | :441 | T-READDRESS (collision with the gateway) | **Kept** | Same |
| `REGISTERED_CAMERA_ADDRESS` | :84 | :447 | T-READDRESS (duplicate address) | **Kept** | Same |
| `GATEWAY_OUTSIDE_SUBNET` | :86 | :438 | T-READDRESS (prefix/gateway tampering) | **Kept** | Same; with SI bound, "subnet" stays the configured camera subnet |

### 2.6 Point 4: size and spacing (not `DestinationRefusal` codes; listed for completeness)

| Guard | Where | Threat | Lifted / kept | Reason |
|---|---|---|---|---|
| `ScanSizeRefusal.TOO_MANY_STORED` / `TOO_MANY_TYPED` / `NOTHING_TO_SCAN` | :464-466; bounds `SCAN_MAX_STORED_ADDRESSES = 32` :113, `SCAN_MAX_TYPED_ADDRESSES = 1` :115 | T-FLOOD | **Kept** | Interface-independent |
| `spacingAllowance` with `DESTINATION_MIN_INTERVAL_MS` SCAN / TYPED_PROBE / HOST | :478; :133-137 | T-FLOOD; camera lock-out | **Kept** | Same |
| `DISCOVERY_MAX_INTERFACES = 4` (NW-K1) | `capture/adapters/camera/discovery-collector.ts:32` | T-FLOOD (resource bound of one search) | **Kept at 4** (recommendation; row 90 decides per RQ-N3) | The bench host has fewer eligible interfaces after Docker removal (register NW-K1, hypothesis). Raising it widens fan-out with no bench need |

**Count:** 25 `DestinationRefusal` codes (def :38-:86). Lifted (for TP and SC only): 4 (`OTHER_INTERFACE_SUBNET`, `OUTSIDE_CAMERA_SUBNET`, `NO_CAMERA_SOURCE`, `NOT_CONFIGURED` in its "no camera network" meaning). Kept for every purpose: 21. Point 4: 3 size refusals and 3 spacings kept.

## 3. Residual guards proposed (each with the threat it still defends)

These go to the user at row 96 and are confirmed at gate row 119 (02_structured.md:110, :485). "Drop" of any guard is recorded as a D-id (02_structured.md:485) and is MAJOR (02_structured.md:87).

| # | Residual guard | Code anchor | Threat still defended | Recommendation |
|---|---|---|---|---|
| RG-1 | IPv4 literal only, never a name (`NOT_AN_ADDRESS`, `HOST_NAME`, `MALFORMED_IPV4`, `IPV6_LITERAL`, `IPV4_MAPPED_IPV6`) | :234-250 | T-SSRF-SELF: name resolution / DNS rebinding to the host; parser-confusion encodings | Keep |
| RG-2 | Special classes refused (`LOOPBACK`, `UNSPECIFIED`, `LINK_LOCAL`, `MULTICAST`, `BROADCAST`) | :253-257 | T-SSRF-SELF: the Core's own services on 127.0.0.1 (HOST-24/25), 0.0.0.0 local reach, link-local endpoints; T-FLOOD fan-out | Keep |
| RG-3 | Public addresses refused (`PUBLIC_ADDRESS`) | :258 | T-SSRF-PUBLIC: Core as a relay to the internet; stored credential sent off-site | Keep |
| RG-4 | The Core's own addresses refused on every interface, aliases included (`HOST_ADDRESS`) | :352, :424 | T-SSRF-SELF via the Core's Wi-Fi or camera-port address (listeners bound to 0.0.0.0 by other software, e.g. sshd) | Keep; fact source must cover every interface |
| RG-5 | Network/broadcast edges refused on the /24 and on the source interface's prefix (`NETWORK_ADDRESS`, `SUBNET_BROADCAST`) | :317-323, :369 | T-FLOOD (directed broadcast), T-READDRESS | Keep |
| RG-6 | Port from the short stored list (point 3) | :326-333 | T-PORT: probing non-ONVIF services on office hosts | Keep (weight rises under global) |
| RG-7 | Scan size and spacing (point 4) | :113-136, :462-480 | T-FLOOD; camera account lock-out | Keep |
| RG-8 | Set-IP paragraph (`DHCP_NOT_CARRIED`, `GATEWAY_ADDRESS`, `REGISTERED_CAMERA_ADDRESS`, `GATEWAY_OUTSIDE_SUBNET`, NA's `OUTSIDE_CAMERA_SUBNET`) | :411-448 | T-READDRESS | Keep |
| RG-9 | AD-02 stored-address guard: the same rule (points 1, 3, 4 and HOST_ADDRESS) at every open, connection test and presence read, BEFORE the credential reader; no permissive value in `src/` | RULE header :2-3, :27-29; consumers `stored-address.ts:208`, camera-watch.ts:446, onvif-relay.ts:671, connect/service.ts:379, adopted-test.ts:304 (row 84 N1) | T-FAKESOURCE: a runtime-DB-credential holder inserting an `ONVIF_RTSP` row at 127.0.0.1 so a local process signs as PRODUCTION; credential reveal to a refused address (ADD:147-163, W-6) | Keep; unchanged by the lift (it uses point 1, not point 2) |
| RG-10 | S13-08 pt 2 alias bound: the root helper accepts only an RFC 1918 address with `/24`, host part 1-254 (`ALIAS_PREFIX_LENGTH = 24` :120; helper `checked_address:324`, `parse_quad:308` per row 86) | helper + :120 | T-ROOTHELPER: a compromised Core account or technician re-addressing the host, incl. onto the office network (R-19, PLAN:782) | Keep. Also keep S13-08 pt 3 (DR-4 inside the helper, SEC:197) and the interface agreement check (`host-alias/caller.ts:261-265`, HOST-46) by keeping CS and SI bound (section 5) |
| RG-11 | Alias sources only for CS and SI (`ALIAS_PURPOSES`, :104); TP and SC never use an alias as source | :104, :362-365 | T-ROOTHELPER / T-WRONGNET: a temporary alias becoming a long-lived path to a factory or office subnet | Keep; in the global source rule (section 4), alias addresses are not candidate sources |
| RG-12 | On-link only: a TP/SC target must lie in the subnet of an eligible interface; no routed target (NW-R1 `NO_SOURCE_INTERFACE`) | new, section 4 | T-WRONGNET residue that D11 did not accept: reaching networks *behind* a gateway (other office subnets, VPNs) through the default route. D11's text accepts "perangkat lain di jaringan kantor", i.e. the attached office network | Keep (recommended; Q89-2) |
| RG-13 | Tunnel/virtual interfaces are not sources: same eligibility as discovery (IPv4, not internal, netmask neither /32 nor /0, MAC not all-zero) | `discovery-collector.ts:63-80` (row 84 N3) | T-WRONGNET via a VPN tunnel (`wg`, `tun`) holding a private address: the Core reaching a remote site | Keep (recommended; one eligibility rule for "found on" and "dialled from") |
| RG-14 | Host guards outside the rule: HOST-20 forwarding off, HOST-24 Core and DB listen on 127.0.0.1 only, HOST-25 loopback rule 8554-8564 | HOST-PROFILE :82, :86, :87 | HOST-20: the host becoming a router between camera port and Wi-Fi (now the only separation left between the networks); HOST-24/25: office devices reaching the Core's services | Keep (02_structured.md:485 lists HOST-20, HOST-24) |

## 4. New source-address selection rule (replaces destination-rule.ts:352-373 for TYPED_PROBE and STORED_CAMERA)

### 4.1 Why a rule is needed

Today the source is chosen inside `decideDestination`: inside the camera subnet, the first non-alias camera-interface address (:357-361); outside it, an alias for alias purposes only (:362-365); the answer names `sourceAddress` (:373) and every consumer binds the TCP/UDP socket to it (`onvif-session.ts:556`, `onvif-network.ts:375`, `stream-probe.ts:426-435`, `onvif-relay.ts:688/:708`, `camera-watch.ts:454`; row 84 N1). The typed probe also requires the source to be on a probed interface (`ws-discovery.ts:189-195`). Lifting point 2 removes the camera interface as the only source, so the rule must name a source another way. Without one, the socket is unbound and the kernel picks the route: the "silent fallback" DR-4 was written against (SPEC:419).

### 4.2 The rule (TP and SC; recommended)

Inputs: the context's per-interface list (register NW-C1 `interfaceSubnets`: every up IPv4 interface with name, address, network, prefix length; provisional, row 90).

| Step | Statement | Refusal |
|---|---|---|
| 0 | The interface list cannot be read or is not well-formed -> refuse everything (fail-closed, C55 kept in this form) | `NOT_CONFIGURED` (remaining meaning, register RM-N4) |
| 1 | Point 1 class of the target (section 2.1) | the class code |
| 2 | The target is any address the host holds, aliases included | `HOST_ADDRESS` |
| 3 | Candidate sources = the non-alias addresses of **eligible** interfaces (RG-13: IPv4, not internal, netmask neither /32 nor /0, MAC not all-zero; source address itself private). An interface with a non-private address is skipped as a source, not a reason to refuse the whole context (today `factsOf` returns null on any non-private camera address, :299) | - |
| 4 | Keep the candidates whose own subnet (address/prefix) contains the target. None -> refuse; **no route through a gateway** (RG-12) | NW-R1 `NO_SOURCE_INTERFACE` |
| 5 | More than one interface remains (overlapping subnets, e.g. camera port and Wi-Fi both on 192.168.0.0/24): if the stored camera interface (`capture_network_config.interface_name`) is one of them, use it; otherwise refuse | `<REQ:DestinationRefusal.SOURCE_AMBIGUOUS>` (requested; delegation_progress/file_requests.md) |
| 6 | Edges: `edgeRefusal` on the /24 and on the chosen interface's prefix | `NETWORK_ADDRESS` / `SUBNET_BROADCAST` |
| 7 | Port (point 3) | point 3 codes |
| 8 | Answer `sourceAddress` = the chosen interface's address, `viaAlias: false`. The caller binds to it (caller's half, RULE:27-28, unchanged) | - |

For TYPED_PROBE the existing check stays: the chosen source must be one of the probed interfaces (`ws-discovery.ts:191`, `NO_ELIGIBLE_INTERFACE`), so with `DISCOVERY_MAX_INTERFACES = 4` an interface beyond the fourth is not dialled. With step 3 using the discovery eligibility, the two sets differ only by that bound.

### 4.3 Threats of the source rule itself

| Threat | Why it arises | Mitigation in the rule | Residual |
|---|---|---|---|
| Weak-host egress: binding a source address does not force the egress interface on Linux; with overlapping subnets the kernel may send by the other interface | Linux weak-host model (general fact about Linux routing, not verified on the bench) | Step 5 refuses ambiguity unless the camera interface is among the matches; when it is, the case is the same as today's | Hypothesis for row 117: confirm with `ip route get <target> from <source>` on the bench |
| Routed reach (other office subnets, VPN) through the default gateway | Step 4 removed would let the kernel route any private target | Step 4 refuses off-link targets (RG-12). Consistent with the typed probe's TTL 1 (`ws-discovery.ts:338-339`), which cannot reach a routed target anyway | None if kept; if the user drops RG-12, Q89-2 records it |
| Tunnel interface as source (remote-site reach) | VPN interfaces hold private addresses | RG-13 eligibility (all-zero MAC excluded, as discovery does) | A tunnel with a non-zero MAC (e.g. `tap`) passes; HOST-21 says no VPN service is installed on the host (HOST-PROFILE :83) |
| Context changes between decision and dial (DHCP renew on Wi-Fi, interface down) | Wi-Fi addresses are leased | The bind to `sourceAddress` fails if the address is gone (fail-closed by the OS) | Low |
| Interface list as an information leak | The answer names a source | Unchanged: the search answer carries `interfaceCount` only, "a count, never a name or an address" (`capture-discovery.ts:258`, register F9/NW-S1) | None |

## 5. Per purpose: does "global" apply? (RQ-N2)

| Purpose | Today (row 84 N2) | Recommendation | Reason | Refusals that stay for it |
|---|---|---|---|---|
| `TYPED_PROBE` | camera subnet only; source = camera-interface address | **Global (on-link, section 4)** | Core of D10(2) ("discovery and connection on all host interfaces"); sends one WS-Discovery probe, TTL 1, no credential (`ws-discovery.ts:296-305`, :338-339) | Point 1, HOST_ADDRESS, point 3, point 4, new NW-R1 / `<REQ:...SOURCE_AMBIGUOUS>` |
| `STORED_CAMERA` | camera subnet only | **Global (on-link, section 4)** | Core of D10(2): a camera adopted on any attached network must be connectable. Adoption and re-address need a search candidate of the caller's session (`readdress-route.ts:18-21`), so a stored address is never free text | Same as TP, plus AD-02 (RG-9) |
| `COMMISSIONING_SCAN` | camera interface + one supposed alias via the root helper (factory-scan/service.ts:471) | **Stays bound to the configured interface** (register Q-R4, row 96) | Uses the root alias helper (S13-08; HOST-46 interface file `/etc/dems/netalias-interface` names ONE interface, HOST-PROFILE :132); ARP/echo programs run on the stored camera interface (production-parts.ts:659-673, :815-821). Global would put a root-made alias on Wi-Fi: T-ROOTHELPER and the R-19 threat | `OTHER_INTERFACE_SUBNET`, `OUTSIDE_CAMERA_SUBNET`, `NO_CAMERA_SOURCE`, `NOT_CONFIGURED` ("no camera network") |
| `SET_IP` (+ `decideNewCameraAddress`) | same, plus writes a new address inside the camera subnet | **Stays bound** (register Q-R4, row 96) | Writes a camera's address and sends a digest to it (SEC:231); uses the helper alias (camera-network/service.ts:626-634). Global would let a technician re-address an office device (T-READDRESS on the office LAN) | Same as CS, plus RG-8 |

Consequences of the recommendation (for rows 90, 92, 93):
- `capture_network_config.interface_name` and `camera_subnet` stay meaningful for CS and SI only; `COMMISSIONING_NOT_CONFIGURED` stays the answer of a scan/set-IP without them, and no longer of a typed probe or a connection test (register RM-N4, W-N1, W-N3).
- RM-N1..N3 constants are NOT deleted (register RM-N1 "Deletion of the constant: provisional - row 96").
- A camera adopted on a non-camera interface (e.g. on Wi-Fi) can be found and connected but cannot be re-addressed by the Core (SI bound). This is by design of the recommendation.
- Boot checks `CAPTURE_HOST_INTERFACE_FILE_MISMATCH` (HOST-46) and the helper interface file stay unchanged (register CF-2, CF-3).
- The context builder must give bound purposes "others" = every interface except the camera interface (today's `otherInterfaceSubnets`), derived from `interfaceSubnets` (NW-C1).

## 6. ufw HOST-23 scope (decided: D12 U-RF3)

**Decision (not reopened):** D12 U-RF3, "search answers on the camera port only, AC7 unchanged" (decisions.md:28). Rule as written today: `sudo ufw allow in on <camera-interface> proto udp from any port 3702 comment 'DEMS camera search answers'` (HOST-PROFILE :85; script `scripts/host/40-network-firewall.sh:84-88`). AC7: "ufw is active and admits SSH only on the room network. No DEMS port is reachable from Wi-Fi" (01_translated.md:63). HOST-22 default: deny incoming, allow outgoing, deny routed (HOST-PROFILE :84).

**Consequence for search answers on other interfaces:**

| Path | On the camera port | On Wi-Fi / any other interface |
|---|---|---|
| Multicast search (probe to 239.255.255.250:3702, TTL 1; devices answer by unicast to the Core's port) | Admitted by HOST-23 | **Dropped by HOST-22 default deny.** The probe is sent there (ws-discovery picks up to 4 eligible interfaces incl. Wi-Fi, row 84 N3), but no answer is admitted, so the search lists no device from that network |
| Typed probe (one unicast probe to `<typed>:3702`, TTL 1) | Admitted | **Hypothesis: admitted** as a reply to the Core's own outgoing datagram (ufw's connection-tracking ESTABLISHED rule), if the device answers from the typed address and port 3702. Not verified on the bench; open as 9A/H-12 (HOST-PROFILE :85) |
| ONVIF/RTSP connections to an adopted camera (TCP, outgoing) | Allowed (outgoing default allow) | Allowed |

So on the bench, "global" in practice means: cameras on the camera port are found by the search; cameras on Wi-Fi are found **by typed address only** and then connect normally. This is the U-RF3 option text (02_structured.md:529: "Wi-Fi devices stay reachable by typed address"). AC9 "cameras are found by the global search" (02_structured.md:61) must be read with this limit: row 93/95 word it, the user saw it at D12. Security effect: the Wi-Fi side of the host keeps admitting SSH only (AC7), so no unsolicited datagram from the office network reaches the Core's search socket; the WS-Discovery parser (SEC35-27..30) is exposed only to the camera port and to typed-probe replies.

## 7. Residual risks under the new posture (for row 117 and gate row 119)

| # | Risk | Source | Mitigation kept | Level |
|---|---|---|---|---|
| RR-1 | Office devices that answer WS-Discovery (printers, Windows hosts) become candidates on a typed probe; a technician's connection test then sends a typed credential to them. "The receiving device can test guesses against the digest: the test's result is not evidence of the device's identity (CT-6)" | `onvif-session.ts:29-32` | Digest only, never Basic (`SCHEME_NOT_ALLOWED`, onvif-session.ts:19-25); one rejected request at most; port list (RG-6) | Medium; accepted in substance by D11 |
| RR-2 | DHCP on Wi-Fi: an adopted camera's address is leased to another device later; presence reads and opens then send the stored camera credential (digest) to that device. The camera network had no DHCP by design (SEC:239, SPEC:394), so this risk is new | D11 scope; SEC:239 | AD-02 does not cover it (point 1 passes a private office address). No identity check before the credential was found (grep of onvif-session/stored-address/camera-watch for identity terms found only CT-6; unverified) | Medium. For row 96: Q89-3 |
| RR-3 | Network/flood reach widens: point 4 bounds one search and spacing, but now over up to 4 interfaces | discovery-collector.ts:32 | RG-7, NW-K1 at 4 | Low |
| RR-4 | HOST-20 forwarding off becomes the only thing that keeps the host from bridging the camera port and Wi-Fi | HOST-PROFILE :82 | RG-14; boot check HOST-20 (`capture/boot/host-checks.ts:113`, row 84) | Low if kept |
| RR-5 | Form check breaks silently (sentinel `FORM_ACCEPTED = NO_CAMERA_SOURCE`, facts.ts:174) when SC stops raising it | section 2.3 | Rows 90/102 must rewrite the sentinel; a test on `cameraSubnetAccepted` / `factoryAddressAccepted` | Implementation risk, not a threat; listed so row 117 checks it |

## 8. Verification hooks for rows 102 and 117

- Every lifted refusal: an allow test for TP and SC on an address in a non-camera interface's subnet, and a refusal test (same code as today) for CS, SI, NA (02_structured.md:270 row 102 acceptance).
- Every residual guard RG-1..RG-11: at least one refusal test per code, for TP and SC on a non-camera interface (the place where the lift makes them load-bearing).
- RG-12/RG-13: off-link target -> NW-R1; tunnel-MAC interface not a source; overlap without camera interface -> `<REQ:...SOURCE_AMBIGUOUS>`; overlap with camera interface -> camera interface chosen.
- Fail-closed: unreadable interface list -> `NOT_CONFIGURED`, 0 packets (SEC:240 check form).
- AD-02 check unchanged: loopback row, assigned, session start 409, 0 reveals, 0 relay starts (ADD:157-163).

## 9. For row 96

| Id | Question | Options | Recommendation | Consequence |
|---|---|---|---|---|
| Q89-1 | Residual guards RG-1..RG-14 (section 3) | (a) keep all; (b) drop named guards (each drop recorded as a D-id, MAJOR) | (a) keep all. None of them is needed to be dropped for D10(2): each defends a threat independent of the interface (row 86 §2) | (b) reopens the threat named in the guard's row |
| Q89-2 | Does "global" include routed targets (behind a gateway) or only directly attached networks? (RG-12) | (a) on-link only, NW-R1 refuses routed targets; (b) any private address, kernel picks the route, source = route's source | (a): matches the D11 text ("perangkat lain di jaringan kantor"), matches the typed probe's TTL 1, keeps VPN/other-subnet reach out | (b) reach widens to every routable private network; DR-4's "no silent fallback route" is dropped entirely |
| Q89-3 | RR-2: stored camera on a DHCP network | (a) accept, operational rule: cameras stay on the static camera port, Wi-Fi only for testing; (b) require a static/reserved address for a camera adopted outside the camera port (documented, row 93); (c) new code: an identity check (e.g. device's ONVIF identity matched to the stored record) before any credential is sent (new spec + names; outside row 89's scope) | (a) for the bench with (b) worded in the host docs; (c) as a follow-up item, not in this blueprint | (c) adds a code row and register names |
| Q89-4 | Overlapping subnets on two interfaces where none is the camera interface (step 5) | (a) refuse with `<REQ:DestinationRefusal.SOURCE_AMBIGUOUS>`; (b) pick by a fixed order (e.g. interface name); (c) leave the source unbound | (a): any choice in (b)/(c) is the silent fallback DR-4 rejected; the overlap is a misconfiguration to fix on the host | (a) needs the register name (requested) |
| Q89-5 | `COMMISSIONING_SCAN` and `SET_IP` stay bound (= register Q-R4, RQ-N2) | stay bound / global | Stay bound (section 5) | Global needs the helper rewritten for several interfaces and reopens T-ROOTHELPER and T-READDRESS on the office network |

## 10. Assessment of the posture as specified

**CAUTION.**

- PASS elements: every one of the 25 refusals and the point-4 guards has a lifted/kept line with a threat and a reason; the lift is confined to the four point-2 refusals for the two purposes D10(2) names; every threat other than T-WRONGNET keeps a guard; the root helper path stays bound; the firewall scope is the decided U-RF3; fail-closed behaviour is kept in a new form.
- Why not PASS: (1) D11 accepts T-WRONGNET by design, so the Core can dial office-LAN devices on the listed ports (accepted risk, not a defect); (2) RR-2 (DHCP address reuse sending the stored camera credential to another device) is new and has no code guard in this spec; (3) the source rule depends on two items still open (Q89-2, Q89-4) and one requested name; (4) the weak-host egress statement in 4.3 is a hypothesis to verify on the bench.
- Not FAIL: no guard is dropped that defends a threat the user did not accept, and no new path reaches loopback, the Core itself, public addresses, arbitrary ports, or the root helper.

## 11. Gaps

- HOST-19..23 rationale text in the task-4 plan: not found by row 86 (row 86 §2 last bullet); HOST-23 consequence above taken from the host profile and the code.
- Conntrack admission of typed-probe replies on Wi-Fi: hypothesis (section 6), open as 9A/H-12.
- Linux egress interface with a bound source under overlapping subnets: hypothesis (section 4.3).
- No device identity check before credential use was found by a keyword grep of three files only (RR-2); row 117 to confirm by reading.
- Line numbers of the helper (`checked_address:324`, `parse_quad:308`) are carried from row 86, not re-read here.

---
*Generated: 2026-10-22*
*Last Updated: 2026-10-22*
