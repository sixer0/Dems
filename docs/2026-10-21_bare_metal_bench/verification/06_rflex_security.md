---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
date: 2026-10-22
agent: security-review
row: 117
type: verification (security review of R-FLEX as implemented)
review_level: L3 (deep audit; network reach and credential paths of an evidence appliance)
verdict: CAUTION
status: needs-review
inputs: rflex-only.diff (72 files), rflex-files.txt, masterplan/01_specs_rflex_security.md (row 89), decisions/decisions.md (D10, D11, D14, D16, D23, D24, D26, D31), decisions/02_rflex_decision_sheet.md, implementation/50..87, scripts/host/* (changed host docs)
code_state: snapshot C:\Users\TRIAL\dems-review-snapshot, HEAD e05a1567 + uncommitted R-FLEX working tree; identical to host .73 ~/Desktop/DEMS-source for the four files hashed (section 8)
tests: NOT run (controller instruction: another heavy runner active). Every "pinned by" cell names a test that exists in the tree; pass/fail evidence for those tests belongs to row 115
---

# R-FLEX security review (row 117)

## 1. Posture statement (for the user to confirm at gate G-RF)

Plain words. Each sentence is backed by the code cited in sections 3 to 5.

**Cameras (ONVIF).**
1. The Core may now find a camera by its typed address, and connect to an adopted camera, on any network the host is directly plugged into: the camera port, the office/room network and Wi-Fi alike. Before R-FLEX this was only the camera port.
2. It still refuses: names (only numeric IPv4 addresses), IPv6, loopback and other special addresses, internet (public) addresses, the host's own addresses on any network, the first and last address of a network block, any port not on the short stored list (default port 80), and more than the fixed number of addresses per search and per minute.
3. It will not go through a router: if no network of the host directly contains the address, the Core refuses (`NO_SOURCE_INTERFACE`). If two networks of the host both contain it, the Core refuses (`SOURCE_INTERFACE_AMBIGUOUS`). VPN/tunnel interfaces are never used.
4. The factory-address scan and the "change the camera's IP address" job still work only on the one camera port. The root address helper is unchanged.
5. The search's multicast question goes out on up to 4 networks of the host, but the host firewall (once applied, HOST-23) admits search answers on the camera port only. A camera on Wi-Fi or the office network is therefore found by typing its address, not by the plain search.
6. Accepted consequence (D11): a technician can make the Core send ONVIF requests to any private device on the office network/Wi-Fi on the listed ports, and a connection test sends the typed camera password (as a digest, never in plain text) to that device. If an adopted camera's Wi-Fi/DHCP address is later given to another device, the Core will send the stored camera credential digest to that other device without checking it is the same camera (RR-2). The written operating rule (host profile :297) is: cameras stay on the static camera port, Wi-Fi/office network only for tests, and any camera reached off the camera port gets a static address or a DHCP reservation. A device-identity check before sending credentials is a follow-up outside this blueprint.

**USB audio.**
7. A USB sound card is no longer tied to the USB socket it was registered on. It is recognised by its USB id plus its serial number; a card with no serial number is recognised by its USB id (model) alone, on any socket.
8. One physical card belongs to one microphone. Registering another input of a card that a microphone already holds is refused (`AUDIO_CARD_ALREADY_BOUND`, naming the holder) unless the technician explicitly asks to move it (`release: true`, a separate "move" step in the console). A move keeps the microphone id, is written to the audit log as two rows (`RELEASED` old input, then `REENABLED` new input), and is refused while a recording session is open.
9. Consequence to confirm: for a card with no serial number, the Core cannot tell two units of the same model apart. If two are plugged in together, neither is opened (no wrong recording, `AUDIO_CARD_AMBIGUOUS`). But if the registered unit is unplugged and another unit of the same model is plugged into any socket, the Core records from the new unit as if it were the registered one, without notice. Before R-FLEX this was caught when the replacement sat on a different socket.

## 2. Summary

| Item | Value |
|---|---|
| Verdict | **CAUTION** (no High finding; Medium items present) |
| Findings | High 0, Medium 6 (4 already accepted, 2 NEW), Low 6 |
| Gate checks | Credential leak PASS; Destructive op PASS; External call CAUTION; Injection PASS; Permission escalation NA (code) / PASS (host docs) |
| RG-1..RG-14 | all 14 present in code or host docs; 0 weakened, 0 missing; RG-11 pinned only with a configured camera network (L-1); RG-14 host part not yet in force on the bench (install rows pending, section 8) |
| RR-5 form check | resolved: form check now asks the `SET_IP` binding (facts.ts:217-240), pinned by tests |
| GDPR | N/A, see section 6 |
| ISO 27001 gaps | none new that block; Low gaps on A.12.4 (audit of port move) and A.12.1 (installer note) |
| Review level | L3 |
| Skipped | GDPR rows (no personal data handled by the changed code: card ids, USB ids, IPv4 addresses of devices, MIC ids); test execution (instruction) |

## 3. RG-1..RG-14 trace

Line numbers are of the snapshot working tree. Test names are quoted from the `it(...)` text.

| RG | Guard | Enforcing code | Pinned by (test) | State |
|---|---|---|---|---|
| RG-1 | IPv4 literal only, never a name (`NOT_AN_ADDRESS`, `HOST_NAME`, `MALFORMED_IPV4`, `IPV6_LITERAL`, `IPV4_MAPPED_IPV6`) | capture/destination-rule.ts:264-282 (`refusalOfText`, `classify`), called first for every purpose :428-429, before `decideGlobal` :431 | destination-rule.test.ts:411-431 "the residual guards RG-1..RG-11 still refuse, on the non-camera interface" rows `RG-1 a name/nothing/not a strict dotted quad/an IPv6 literal/IPv4-mapped`; :96-130 "point 1: an IPv4 literal only" | Kept, tested |
| RG-2 | Special classes (`LOOPBACK`, `UNSPECIFIED`, `LINK_LOCAL`, `MULTICAST`, `BROADCAST`) | destination-rule.ts:283-287 | destination-rule.test.ts:417-421 (RG-2 rows); :132-190 | Kept, tested |
| RG-3 | Public addresses refused | destination-rule.ts:288 | destination-rule.test.ts:422 `RG-3 public` | Kept, tested |
| RG-4 | Host's own addresses on every interface, aliases included | destination-rule.ts:470 (global), :435 (bound); host set built at :363-393 from `cameraAddresses`, `hostAddresses` and every `interfaceSubnets` entry | destination-rule.test.ts:423-425 (Wi-Fi, camera-port, alias address); :433 "RG-4: a host address absent from the interface list and from hostAddresses is still the host" | Kept, tested |
| RG-5 | Network/broadcast edges on the /24 and on the chosen prefix | destination-rule.ts:482 (`edgeRefusal` :400-405) | destination-rule.test.ts:426-427; :437 "RG-5: the edges of the chosen prefix, below and above a /24" | Kept, tested |
| RG-6 | Port from short stored list | destination-rule.ts:485-486 (`decidePort` :408-416); bounds :133 | destination-rule.test.ts:448 "RG-6 the port from the short stored list, %s" | Kept, tested |
| RG-7 | Scan size and spacing | destination-rule.ts:577-582, :593-; `DISCOVERY_MAX_INTERFACES = 4` discovery-collector.ts:32, slice :86 | destination-rule.test.ts:456 "RG-7 ..."; discovery-collector.test.ts "R-FLEX 5.2 (NW-K1): the typed probe's source interface is placed FIRST ... the bound stays four" | Kept, tested |
| RG-8 | Set-IP paragraph stays bound | destination-rule.ts:526-565 (`decideNewCameraAddress` uses `factsOf`, not global) | destination-rule.test.ts:463 "RG-8 the set-IP paragraph stays bound to the camera subnet, whatever the interface list holds" | Kept, tested |
| RG-9 | AD-02: same rule before any credential use | capture/fence/production-parts.ts:86-97 (`storedCameraAddressRuleOf`, fallback `HOST_NOT_CONFIGURED` :74); stored-address.ts:208 `judgeStoredCamera`; connect/service.ts:373-377 (refuse before bounds, nothing sent) | destination-rule.test.ts:474 "RG-9 AD-02: an interface list that names loopback makes no loopback address a destination"; stored-address.test.ts "R-FLEX (RF-N1, row 103): STORED_CAMERA is global ... facts without `interfaceSubnets` are NOT_CONFIGURED" | Kept, tested |
| RG-10 | Root helper: RFC 1918 /24, host 1-254, refuses a /24 another interface holds | scripts/host/netalias/dems-core-netalias:384 `parse_quad`, :400 `checked_address`, :723 `OTHER_INTERFACE_HOLDS_SUBNET`; `ALIAS_PREFIX_LENGTH = 24` destination-rule.ts:142; helper NOT in the diff (`git status --short scripts/host/netalias` empty) | destination-rule.test.ts:482 "RG-10 the alias is a /24 and reaches its own /24 only"; helper tests unchanged | Kept (unchanged) |
| RG-11 | Alias never a source for TP/SC; alias purposes only CS/SI | destination-rule.ts:124 `ALIAS_PURPOSES`; :375-377 + :393 (alias skipped as candidate); global answer `viaAlias: false` :488 | destination-rule.test.ts:428 "RG-11 the alias /24, never a source for these purposes" -> `NO_SOURCE_INTERFACE` | Kept, tested **only when the camera network is configured**; see L-1 |
| RG-12 | On-link only (Q96-06 a) | destination-rule.ts:473-474 `NO_SOURCE_INTERFACE`; step 5 ambiguity :475-478 | destination-rule.test.ts:353 "NW-R1, %s: a target on no eligible interface (off-link) is refused, never routed through a gateway (RG-12)"; :363 "NW-R2 ..." | Kept, tested |
| RG-13 | Tunnel/virtual not a source: not loopback, prefix not /0 or /32, stated non-zero MAC | modules/capture-config/network/facts.ts:158-167 (`eligible`), :196; defence in depth destination-rule.ts:393; discovery uses the same test discovery-collector.ts:79 | network/__tests__/service.test.ts:176 "row 105, RG-13: interfaceSubnets holds ELIGIBLE addresses only - a tunnel (all-zero hardware address), ..." (mutation-checked per D23); destination-rule.test.ts:380 | Kept, tested; residual L-5 (bridges with real MACs) |
| RG-14 | Host guards: HOST-20 forwarding off, HOST-24 Core/DB on 127.0.0.1, HOST-25 loopback rule | Boot check capture/boot/host-checks.ts:250-255 (`FORWARDING_ON` refuses production start); HOST-PROFILE-UBUNTU-24.04.md:86 (HOST-20), :87 (HOST-21), :88 (HOST-22), :90 (HOST-24, widened to "from any network of the host" by R-FLEX), :91 (HOST-25) | host-checks.test.ts:111-123 "the diagnostics list every check ..." (expects `FORWARDING_ON`); HOST-24/25 are host-doc items with took-effect checks, no unit test | Kept; HOST-24/25 untested by unit tests by nature (host items, verified at 9A/H-01) |

Result: no guard weakened, none missing. Untested-by-unit: RG-14 HOST-24/HOST-25 (host items), RG-11 in the "no camera network configured" state (L-1).

## 4. Residual-risk lines (one per lifted control)

| # | Lifted control | What is now possible | Code evidence | Mitigation kept | Disposition |
|---|---|---|---|---|---|
| RR-A | S13-11 point 2 / DR-4 (`OTHER_INTERFACE_SUBNET`, `OUTSIDE_CAMERA_SUBNET`, `NO_CAMERA_SOURCE`, `NOT_CONFIGURED`-as-"no camera network") for `TYPED_PROBE` and `STORED_CAMERA` | Core dials any on-link private device of the office LAN / Wi-Fi on listed ports (T-WRONGNET) | destination-rule.ts:126 `GLOBAL_PURPOSES`, :431 branch to `decideGlobal` :465-489 | RG-1..RG-13; CS/SI stay bound (:433-457) | Already accepted by D11 |
| RR-B | HOST-19..23 isolation as a Core control | HOST-19/23 reworded as "host hygiene"; the camera port is no longer the Core's only camera path | 40-network-firewall.sh (diff: HOST-19, HOST-23 items + note); HOST-PROFILE posture paragraph (E-P3) | HOST-20 forwarding off + boot check; HOST-22 default deny; HOST-23 answers on camera port only (U-RF3); HOST-24 widened to every network | Already accepted by D11 (wording only; no rule removed: `test_host_profile_scripts.sh` pins exactly one `ufw allow`) |
| RR-1 | (consequence of RR-A) | Connection test sends a typed credential digest to an office device that answers WS-Discovery | connect/service.ts:369-386 (tester bound to the rule's source) | Digest only; one attempt per spacing; port list | Already accepted by D11 (in substance, row 89 RR-1) |
| RR-2 | (consequence of RR-A) DHCP address reuse | Presence reads / opens of an adopted camera on a DHCP network send the stored credential digest to whichever device now holds that address; no identity check before credential use | production-parts.ts:86-97 (rule judges address only); no identity check found in the diff (grep of the 72 files for an identity comparison before credential reveal: none) | Q96-08 (a) and (b) written at HOST-PROFILE-UBUNTU-24.04.md:297: "the cameras of an installation stay on the static camera port, and the room network or Wi-Fi is used to reach a camera only for tests; a camera that is reached outside the camera port has a static address or a DHCP reservation ... The limit, stated: ... it does not check first that this device is the same camera. Such a check is not part of this profile; it is a follow-up outside this revision." **Gap:** the per-camera step of INSTALLER-NOTE (step 10) does not repeat (a)/(b) (L-4) | Already accepted by D11 + D16 (Q96-08 a+b). **(c) recorded here as follow-up FU-1** (outside this blueprint): device identity check before any stored credential is sent |
| RR-C | USB port lock (`PORT_DIFFERS`, `IDENTITY_NOT_STORED` removed) | A serial-less card is matched by model on any port; a sequential swap with another unit of the same model is undetected | usb-audio-production.ts:358-363; service.ts:466-469; comments state the blind spot usb-audio-production.ts:331-332, service.ts:449-450 | Simultaneous twins refused (`MODEL_SHARED`, `NOT_TELLABLE`); one card = one MIC (service.ts:591-609) | Ruled by D10(1) "bebas sepenuhnya" and D16 Q96-01/Q96-03; the sequential-swap consequence is **not worded** in the decision sheet (Q96-03 covers only two units plugged together) -> M-5 NEW |
| RR-5 | Form check sentinel | Would have rejected every form once SC stopped raising `NO_CAMERA_SOURCE` | Fixed: facts.ts:217-240 ask `cameraNetworkDialRuleOf()` (SET_IP, production-parts.ts:212-214), still bound | service.test.ts:271 "a camera subnet: a private IPv4 network with a prefix length of 16 to 30 and no host bit" (accept and refuse lists + rule-reads-it check), :301 "a factory address: one strict private IPv4 host address". A regression to `STORED_CAMERA` would fail every positive case (global answers are never `NO_CAMERA_SOURCE`) | Closed (form check as the spec defines it holds) |

Weak-host egress hypothesis (row 89 §4.3), checked on the bench:

```
$ ssh dems 'ip route get 192.168.0.50 from 192.168.0.73; ip route get 192.168.100.50 from 192.168.100.254; ip route get 192.168.0.50 from 192.168.100.254'
192.168.0.50 from 192.168.0.73 dev wlp3s0
192.168.100.50 from 192.168.100.254 dev enp4s0
192.168.0.50 from 192.168.100.254 dev wlp3s0
```

The third line confirms Linux weak-host behaviour (a bound source does not force the egress port). The rule never produces such a pair: it names only the on-link interface's own address (destination-rule.ts:473-479) and refuses overlaps (:478). So the hypothesis holds and is mitigated by RG-12 + step 5.

## 5. New issues found in the diff

| ID | Sev | Type | Location | Description | Remediation | Verification |
|---|---|---|---|---|---|---|
| M-6 | Medium | Posture conflict (ISO A.13 network segregation; CWE-284 if resolved by opening the firewall) | decisions.md:49 (D31) vs decisions.md:27 (D12 U-RF3), HOST-PROFILE HOST-23 (:89), 40-network-firewall.sh HOST-23 item | D31 sets camera acceptance as "every camera on the Wi-Fi and the camera LAN appears in the discovery list". Under U-RF3 (answers admitted on the camera port only) a Wi-Fi camera is NOT listed by the search; it is found only by typed address. On the bench today the firewall is off (`sudo ufw status` -> `Status: inactive`), so a Wi-Fi camera can appear now and disappear once HOST-22/23 are applied. Meeting D31 literally after install would need port-3702 answers admitted on Wi-Fi, which reverses U-RF3/AC7 and exposes the WS-Discovery parser to the office network | User decides one: (a) keep U-RF3, read D31 as "Wi-Fi cameras reachable by typed address and listed after a typed probe"; (b) widen HOST-23 to Wi-Fi (new risk acceptance, AC7 changed); (c) run the D31 check before the firewall step and record it as a pre-firewall result only | After the ruling: `sudo ufw status numbered` matches the chosen rule; the acceptance text names the firewall state it was measured in |
| M-5 | Medium | CWE-290-like identity weakness (evidence integrity) | usb-audio-production.ts:358-363; service.ts:466-469 | Serial-less sequential swap undetected on any port (RR-C). The decision sheet presented only the two-units-together case | User confirms at G-RF (posture text point 9) or asks for a mitigation (e.g. warn in the console when a serial-less card's port changed, port stays information only) | Decision recorded; if mitigated, a test that a port change of a serial-less card writes a visible notice |
| L-1 | Low | Guard dependency (RG-11) | facts.ts:182, :197-203; destination-rule.ts:375-377, :393 | Alias addresses are recognised only via `cameraAddresses`, which is filled only when the camera interface and subnet are configured and present. With the configuration cleared (or the stored interface missing) while a helper alias still sits on the port, the alias is an ordinary eligible address and can be chosen as the global source for TP/SC, i.e. a factory /24 reachable through the alias. Requires an alias still present (helper lease 5-480 min, `dems-core-netalias:17`) and a config change; ops on the network config while an alias is held are not checked in this review | Mark helper-held aliases from the helper's own state (or refuse config clears while an alias is held); add a test "no camera network configured + alias address on the port -> not a source" | New test fails on today's code, passes after the fix |
| L-2 | Low | ISO A.12.4 audit completeness | service.ts:544-551 (audit details: deviceId, change, inputNumber, channelCount), :593 port move, :613-616 (`match` only in the log line) | A port move / kernel re-key writes one `REENABLED` row identical in shape to a plain re-enable; the old key and the `match` code reach only the process log, not the audit chain. A release is complete (`RELEASED` old input + `REENABLED` new input, pinned by routes.db.test.ts:536 "T-9 / T-10 ..." and service.test.ts:403; rollback pinned by service.test.ts:439) | Add `match` (a closed code, no device text) or a `REKEYED` audit word for step 2 | routes.db.test.ts T-7/T-8 asserts the new word/field |
| L-3 | Low | Information | facts.ts:165-167 | RG-13 excludes only all-zero/absent MACs. A Linux bridge (`docker0`, `virbr0`, `br-*`) or `tap` has a real MAC and a private address and would be an eligible source and probed interface. Relies on HOST-21 (no container runtime / VM bridge / VPN). Bench now: `lo`, `enp4s0`, `wlp3s0` only (`ip -br link`) | Keep HOST-21; optionally exclude interfaces whose kernel type is bridge/veth/tap | `ip -br link` on the production host shows no bridge |
| L-4 | Low | ISO A.12.1 documented procedure | INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md step 10 (diff hunk "Per camera, before the Core adopts it") | Q96-08 (a)+(b) operating rule is only in HOST-PROFILE:297. The installer's per-camera step says a camera on another network "is connected by its typed address" without the static/reservation rule | Add one sentence to step 10 pointing to HOST-PROFILE:297 | `grep -c 'DHCP reservation' INSTALLER-NOTE...` = 1 |
| L-5 | Low | Test gap | HOST-24 / HOST-25 | Host items, no unit test; the bench currently runs no Core and has the firewall off (section 8), so RG-14 is not yet in force there | Verify at 9A/H-01 as the profile states | 9A/H-01 record |
| L-6 | Low | Information (error handling) | connect/service.ts:373-377 | All rule refusals, incl. unreadable host facts, now answer `CANDIDATE_NOT_TESTABLE`; an operator can no longer tell "Core misconfigured" from "device address refused". Not a leak (less information returned); a usability/diagnosis cost | None required; the log line keeps the rule's word | n/a |

Checked and found clean (no finding):
- **Injection (CWE-78/89):** every audio statement is a constant text with bind parameters (statements.ts:31-95, `REKEY_AUDIO_INPUT` :86-88); rekey requires rowCount 1 (store.ts:146-147, :171-173). No `exec`/`spawn` in the changed network or audio files (grep). No HTML sink in the changed web files (grep for `dangerouslySetInnerHTML`/`innerHTML` hits tests only).
- **SSRF-like dialing:** target is rebuilt from four numbers (`formatAddress`, destination-rule.ts:248, :488), never caller text; names never resolved; on-link only; overlap refused. Interface names never leave the Core (search answer carries `interfaceCount` only, row 89 §4.3).
- **Multicast/broadcast scope:** target classes refuse multicast/broadcast (:286-287); edges refused (:482); discovery bound stays 4 (discovery-collector.ts:86). Reordering only moves the typed source first; an ineligible address is never made eligible (test "An internal or host-mask address is never made eligible by being the source").
- **Interface-selection races:** facts are re-read per call (network/index.ts:204, unknown -> null -> `NOT_CONFIGURED`); ws-discovery re-reads interfaces and refuses if the rule's source is not a probed interface (ws-discovery.ts:190-193); a vanished source address fails the bind (fail-closed). Audio holder read and write run in one serial unit (core/pipeline.ts:2-5, unit-of-work audit chain lock :9-18).
- **`release` input validation:** `z.boolean().optional()` in a `strictObject` (packages/shared/src/api/capture-audio-cards.ts:191-200); service tests `body.release !== true` (service.ts:595); a string `'true'` is 422 (test/acceptance/contract.test.ts:1220; packages/shared/test/sim-capture-discovery.test.ts:591). Console sends `release: true` only in an explicit move mode (core-web audio-cards.ts:252, :346-349).
- **Device text:** serial/port answered only in the closed form (service.ts:423-427), stored as NULL otherwise (service.test.ts:829); no device text in refusals, logs or audit details (service.ts:26-30, :612-616).
- **Error leakage:** refusal texts are fixed and quote nothing (service.ts:210-225; connect/service.ts:358-377).
- **Host-alias regression (D23 / row 141):** host-alias/facts.ts:65-68 throws `HostAliasFactsUnknownError` on a null camera subnet; pinned by lifecycle.test.ts "a stored interface whose network facts carry NO camera subnet: facts unknown ... (row 141, D23)".

## 6. Gate results (security-review-gate, 5 checks)

| Check | Result | Details |
|---|---|---|
| Credential leak | PASS | No secret in the 72-file diff or in this report. Credentials are never logged; the change only alters WHERE a stored digest may be sent (covered under External call) |
| Destructive operation | PASS | No migration (implementation/50: N/A, D16 Q96-07); no DELETE; rekey/refresh update one live row with rowCount 1 check; release is reversible by a second release (routes.db.test.ts:536 moves it back) |
| External call | CAUTION | Core now dials office/Wi-Fi devices (RR-A, RR-1) and may send a stored camera digest to a reused DHCP address (RR-2) over unencrypted transport. Destination trust is lower than before; accepted by D11/D16 with written operating rules; identity check deferred (FU-1) |
| Injection | PASS | Parameterised SQL; strict schema; no shell built from input in changed files |
| Permission escalation | PASS / NA | No ACL, role, sudo or helper change (helper untouched). Op 99 `release` uses the existing `CAPTURE_CONFIG` permission (service.ts:550) |

## 7. GDPR / ISO 27701 assessment

| Article / control | Status | Finding | Remediation |
|---|---|---|---|
| GDPR Art. 5, 7, 15-17, 20, 25, 30, 32-35; ISO 27701; ISO 27001 A.18.1.4 | N/A | The changed code handles device identifiers (USB id, serial, card id, device IPv4) and operator ids already in the audit model; no new personal-data field, no new processing purpose. Recorded audio/video (personal data) is not touched by R-FLEX except through RR-C (which unit is recorded) | None for R-FLEX; existing DEMS privacy controls apply |

## 8. ISO 27001 Annex A mapping

| Control | Status | Finding | Remediation |
|---|---|---|---|
| A.9 Access control | OK | Release and registration need `CAPTURE_CONFIG`; idle-only (service.ts:518, :538) | - |
| A.10 Cryptography | PARTIAL (accepted) | Digest over unencrypted HTTP/RTSP now possible off the camera port (HOST-PROFILE:297) | FU-1; operating rule Q96-08 a+b |
| A.12.1 Operational procedures | PARTIAL | L-4 installer note | Add Q96-08 rule to step 10 |
| A.12.4 Logging | PARTIAL | L-2 port move not distinguishable in audit | Add `match` / `REKEYED` |
| A.12.6 Vulnerability mgmt | N/A | No dependency change in the diff | - |
| A.13 Communications / segregation | GAP (accepted D11) + NEW M-6 | Network segregation of the Core's camera traffic lifted; firewall scope vs D31 unresolved | User decision on M-6 |
| A.14.2 Secure development | OK | Every lifted refusal has an allow test and a still-refused test for bound purposes (destination-rule.test.ts:323-350); residual guards re-tested on the non-camera interface (:410-486) | - |
| A.16 Incident management | N/A | No change | - |
| A.18 Compliance | OK | Risk acceptance recorded (D11, D16) | Record M-5, M-6 decisions |

Live-host evidence (read-only, 2026-10-22):

```
$ ssh dems '... sha256sum <4 files>'   -> identical to the snapshot:
c69f6be8...  destination-rule.ts | 315e7e7e...  network/facts.ts | 17248c66...  audio-cards/service.ts | d8feaeb6...  HOST-PROFILE-UBUNTU-24.04.md
$ ip -br -4 addr   -> lo 127.0.0.1/8; enp4s0 192.168.100.254/24; wlp3s0 192.168.0.73/24
$ ip -4 route      -> default via 192.168.0.1 dev wlp3s0 (dhcp); 192.168.100.0/24 dev enp4s0 metric 100
$ sysctl net.ipv4.ip_forward -> 0
$ sudo -n ufw status numbered -> Status: inactive
$ sudo -n ss -H -ltnup -> sshd 0.0.0.0:22; cupsd 127.0.0.1:631; avahi 0.0.0.0:5353; no DEMS listener (Core not installed yet)
```

## 9. Verdict

**CAUTION.** No High finding; no guard of RG-1..RG-14 weakened or missing; RR-5 closed.

CAUTION items, each listed separately:

| # | Item | Severity | Disposition |
|---|---|---|---|
| C-1 | RR-A: TP/SC global, Core dials office LAN / Wi-Fi devices (S13-11 pt 2, DR-4 lifted) | Medium | already accepted by D11 |
| C-2 | RR-B: HOST-19..23 no longer isolate the Core's camera path (wording; rules kept) | Medium | already accepted by D11 |
| C-3 | RR-1: typed credential digest to a non-camera office device on a connection test | Medium | already accepted by D11 |
| C-4 | RR-2: DHCP reuse sends stored credential digest to another device; no identity check | Medium | already accepted by D11 + D16 (Q96-08 a+b, written at HOST-PROFILE:297); (c) = FU-1 follow-up outside this blueprint |
| C-5 | M-5: serial-less USB card swapped (sequentially) with another unit of the same model on any port is recorded from without notice | Medium | NEW - needs the user's decision (confirm at G-RF or ask for a mitigation) |
| C-6 | M-6: D31 acceptance ("Wi-Fi cameras in the discovery list") conflicts with U-RF3 firewall scope once HOST-22/23 are applied; bench firewall currently inactive | Medium | NEW - needs the user's decision (a/b/c in section 5) |

Low items L-1..L-6 are hardening; they do not block. Recommended order: L-1 and L-4 before production; L-2 before certification evidence is collected.

Follow-up outside this blueprint: **FU-1** device identity check (e.g. ONVIF device information matched to the stored record) before any stored or typed credential is sent off the camera port (Q96-08 c).

Decision options for the controller to present (C-5, C-6): fix now / accept recorded risk / change scope.

## 10. Security review log

| # | Timestamp (UTC) | Scope | Level | Result | Decision |
|---|---|---|---|---|---|
| 1 | 2026-10-22T12:39Z | R-FLEX diff (72 files), host docs, live host read-only network/firewall state | L3 | CAUTION (0 High, 6 Medium: 4 accepted D11/D16, 2 NEW; 6 Low) | Pending: controller presents C-5 and C-6 to the user; no override applied |

---
*Generated: 2026-10-22*
*Last Updated: 2026-10-22*
