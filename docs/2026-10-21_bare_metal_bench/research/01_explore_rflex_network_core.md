---
task_id: 2026-10-21_bare_metal_bench
date: 2026-10-22
agent: explore (row 84)
scope: RQ-N1, RQ-N2, RQ-N3, code side of RQ-N5; Core network rule for R-FLEX cameras
method: grep/Read of apps/core-server/src (graft not used; no graph queried). Code only, no logic advice. Tier 2.
---

# R-FLEX network: Core code map

All paths under `apps/core-server/src/` unless stated.

## N1. Callers of the rule and builders of DestinationContext

`decideDestination` (capture/destination-rule.ts:343) and `decideNewCameraAddress` (:411). Purposes (`DestinationPurpose`, :96-101): COMMISSIONING_SCAN, SET_IP, TYPED_PROBE, STORED_CAMERA. Only ALIAS_PURPOSES = COMMISSIONING_SCAN, SET_IP (:103).

### Production callers (all in capture/fence/production-parts.ts, the one binding file)
| Line | Binding | Call | Purpose | Wired at |
|---|---|---|---|---|
| 80-92 (call :91) | `storedCameraAddressRuleOf(network)` | `decideDestination` | STORED_CAMERA | capture-composition.ts:464 (`storedAddress`); also `modules/capture-discovery/readdress-route.ts:171` |
| 105-117 (call :116) | `typedProbeRuleOf(network)` | `decideDestination` | TYPED_PROBE | capture-composition.ts:869 (`typedAddressControl(app).provideRule`); consumed modules/capture-discovery/routes.ts:131 |
| 156-158 (call :157) | `factoryScanRuleOf()` | `decideDestination`, facts passed in | COMMISSIONING_SCAN | capture-composition.ts:762 (`captureFactoryScanControl.provide({rule:...})`) |
| 202-204 (call :203) | `cameraNetworkDialRuleOf()` | `decideDestination`, facts passed in | SET_IP | production-parts.ts:250, :260 (set-IP job bundle `rule`) |
| 207-209 (call :208) | `cameraNewAddressRuleOf()` | `decideNewCameraAddress` | set-IP new address (no purpose) | production-parts.ts:260 (`newAddress`) |
| 804-811 (call :810) | `admitted(purpose, address)` in the host commissioning inputs | `decideDestination` | SET_IP (:860, :862) and COMMISSIONING_SCAN (:873) | before ARP/echo programs (neighbour read on camera interface) |

Consumers of the STORED_CAMERA verdict (`judgeStoredCamera`, capture/adapters/camera/stored-address.ts:208; it carries `destination.sourceAddress` on, :231-239): camera-watch.ts:446, onvif-relay.ts:671, modules/capture-discovery/connect/service.ts:379, modules/capture-discovery/adopted-test.ts:304.
Consumers of `sourceAddress` as TCP local bind: onvif-session.ts:556 (`localAddress`, family 4), onvif-network.ts:375 (`localAddress: destination.sourceAddress...`), stream-probe.ts:426-435, onvif-relay.ts:688/:708, camera-watch.ts:454.

Test-only callers: test/acceptance/contract.test.ts:1306 (COMMISSIONING_SCAN), :1424-1425 (SET_IP + decideNewCameraAddress); capture/__tests__/destination-rule.test.ts.

### Builders of DestinationContext
| Where | What |
|---|---|
| modules/capture-config/network/facts.ts:137 `networkFactsOf(stored, interfaces)` | THE product builder. Returns null when no `interfaceName` / `cameraSubnet` stored, or the host does not hold that interface (:138-140). Interface == stored name -> own address (in subnet, alias:false) or private out-of-subnet address (alias:true, :162-166); every other interface -> `otherInterfaceSubnets` (:157-160); all -> `hostAddresses`. Wired modules/capture-config/network/index.ts:198 (`facts:`), fed to capture-composition `input.network` |
| modules/capture-config/network/facts.ts:123 `readHostInterfaces` | reads `os.networkInterfaces()`, IPv4 only, `internal` flag |
| facts.ts:178 | literal context (`cameraAddresses: [], others: []`) used as a form check (`formAccepted`; cameraSubnetAccepted :188, factoryAddressAccepted :194) |
| capture/fence/production-parts.ts:74 | `HOST_NOT_CONFIGURED` (cameraSubnet null: refuses all) used when reader is absent or throws (:91, :116, :810) |
| modules/capture-config/factory-scan/service.ts:430 `supposing(facts, alias)` (used :471; facts read :566-572) | derived: drops aliases, adds ONE supposed alias + its host address |
| modules/capture-config/camera-network/service.ts:399 `withoutAlias` (used :622, :961), :401 `supposing` (used :633); facts read :806-812 | derived, same shape |
| capture/host-alias/facts.ts:27,33,124 (`aliasAddressesHeld`) and caller.ts:36 | read the same context (consumers, not builders) |

## N2. Camera-interface binding per purpose
The binding is all inside `decideDestination` (destination-rule.ts:343-373), not per caller. Point 2 enforcement:
- :352 target is a host address -> HOST_ADDRESS
- :353 target inside any OTHER interface subnet -> OTHER_INTERFACE_SUBNET
- :357-361 target inside camera subnet -> source = first non-alias camera-interface address; none -> NO_CAMERA_SOURCE (:360)
- :362-365 target outside camera subnet -> source only for ALIAS_PURPOSES, an alias whose /24 holds the target; else OUTSIDE_CAMERA_SUBNET (:364)
- :373 result `sourceAddress`, `viaAlias`.
- `factsOf` (:289-315) returns null (-> NOT_CONFIGURED, :351) when `cameraSubnet` is null/unreadable, or an interface address is non-private, or a non-alias address lies outside the camera subnet (:302). Camera subnet prefix must be /16-/30 (:111-112), alias prefix /24 (:114).

Per purpose:
| Purpose | Needs camera interface | Alias helper | Writes camera address |
|---|---|---|---|
| TYPED_PROBE | yes (facts null => refuse; target must be in camera subnet) | no (alias refused) | no |
| STORED_CAMERA | yes (same) | no | no |
| COMMISSIONING_SCAN | yes | yes: factory-scan/service.ts:471 judges with ONE supposed alias, alias host from `settings.aliasHost`; helper add via host-alias jobs (capture-composition.ts:762 `alias: jobs`) | no (read only: unauthenticated clock read, production-parts.ts:179-190) |
| SET_IP | yes | yes: camera-network/service.ts:626-634 (alias = first-three-octets + aliasHost) | yes: `decideNewCameraAddress` (:411) requires new address inside camera subnet (:431), not host/gateway/registered camera |
The alias path also requires interface agreement: host-alias/caller.ts:261-265 (`interfaceAgreementRefusal`: stored row vs interface file, NETWORK_NOT_CONFIGURED when no stored interface), used caller.ts:472; lifecycle.ts:237.
Neighbour/echo programs (ARP) run on the stored camera interface: production-parts.ts:659-673 (`neighbourReadingOf` filters `device === cameraInterface`), :815-821 `interfaceNow()` -> INTERFACE_UNKNOWN.

## N3. Discovery (WS-Discovery) interface eligibility
Rule `selectInterfaces` (capture/adapters/camera/discovery-collector.ts:63-80), "by property and never by name" (:60-62):
- IPv4 only (:67); skip `internal` (loopback), netmask null, /32 (0xffffffff), /0 (:73); skip all-zero MAC (:74, tunnels); dedupe by address (:75); link-local eligible.
- FOUR-INTERFACE BOUND: `DISCOVERY_MAX_INTERFACES = 4` (discovery-collector.ts:32), applied :76 (first four in `os.networkInterfaces()` key order; the rest are only added to `ownAddresses`, :71).
- Wi-Fi is NOT excluded: no name or type test anywhere. `grep -i wi-?fi|wlan|wireless` in capture/ and modules/ finds only macOS audio files (unrelated). A Wi-Fi interface with an IPv4 non-zero-MAC address is eligible, subject to the four bound.
- Not tied to `capture_network_config`: ws-discovery.ts:178 reads `os.networkInterfaces()` directly (:187 `selectInterfaces`). One udp4 socket, bound to the interface address when one, unbound when several (header :6-8), multicast sent per interface (:284 `setMulticastInterface`).
- None eligible, or typed-probe source not among probed interfaces -> `NO_ELIGIBLE_INTERFACE` (ws-discovery.ts:191-195). So TYPED_PROBE sourceAddress (camera interface) must be among the four probed.
- Other listed files: onvif-network.ts (set-IP SOAP, binds `localAddress` from rule, :356-375), connection-target.ts, relay-start.ts, stored-address.ts (STORED_CAMERA admission, carries `sourceAddress`), onvif-session.ts (`localAddress` :556), onvif-relay.ts, camera-watch.ts: none selects interfaces; all take `sourceAddress` from the rule. factory-scan/ and camera-network/ judge via the rule only.

## N5. Guards in destination-rule.ts (keep or drop)
Point 1 (address form; `classify` :249-259, `refusalOfText` :234):
| Code | Where |
|---|---|
| NOT_AN_ADDRESS | :38, :250 |
| HOST_NAME | :40 (via refusalOfText :234) |
| MALFORMED_IPV4, IPV6_LITERAL, IPV4_MAPPED_IPV6 | :42-46 (refusalOfText) |
| UNSPECIFIED (0/8) | :50, :253 |
| LOOPBACK (127/8) | :48, :254 |
| LINK_LOCAL (169.254/16) | :52, :255 |
| MULTICAST (224/4) | :54, :256 |
| BROADCAST (240/4) | :56, :257 |
| PUBLIC_ADDRESS (not RFC1918 private) | :58, :258 |
Point 1 with host facts (:352-353, :367-369): HOST_ADDRESS :64/:352 (Core's own addresses); NETWORK_ADDRESS :60 and SUBNET_BROADCAST :62 via `edgeRefusal` :317-323, applied at :369 on /24 and the camera/alias prefix.
Point 2 (interface binding, candidates to drop for "Global penuh"): OTHER_INTERFACE_SUBNET :66/:353; NOT_CONFIGURED :68/:345,351 (also raised for bad purpose); OUTSIDE_CAMERA_SUBNET :70/:364; NO_CAMERA_SOURCE :72/:360.
Point 3 (port; `decidePort` :326-333): PORT_OUT_OF_RANGE :74/:331, PORT_NOT_LISTED :76/:332, PORT_LIST_INVALID :78/:329 (list 1..`DESTINATION_MAX_PORTS`=8, default [80], :105-107).
Point 4 (scan size/spacing): SCAN_MAX_STORED_ADDRESSES = 32 (:110), SCAN_MAX_TYPED_ADDRESSES = 1 (:112), `DESTINATION_MIN_INTERVAL_MS` SCAN/TYPED_PROBE/HOST (:122-135; names TOO_MANY_STORED/TOO_MANY_TYPED/NOTHING_TO_SCAN at :455-457).
Set-IP (`decideNewCameraAddress` :411-448): DHCP_NOT_CARRIED :80/:414; host/other-interface/outside-camera-subnet reused :426-428 (OUTSIDE_CAMERA_SUBNET at :428 is point-2-like); edge :429-430; GATEWAY_OUTSIDE_SUBNET :86/:438; GATEWAY_ADDRESS :82/:440; REGISTERED_CAMERA_ADDRESS :84/:446; NOT_CONFIGURED for unreadable gateway/registry :434, :444.
(Line numbers for the `DestinationRefusal` constant entries are from the file's refusal block :34-86.)

## Boot/fence/host-alias reads of capture_network_config / camera interface
- capture/boot/program-checks.ts:20-23 header, :74-75 `PROGRAM_INTERFACE_FILE` = `CAPTURE_HOST_INTERFACE_FILE_MISMATCH`; :129 `INTERFACE_FILE = '/etc/dems/netalias-interface'`; :179-182 `storedInterface()`; :285-294 `interfaceReason` (HOST-46: INTERFACE_FILE_ABSENT, _NOT_ONE_NAME, _DIFFERS_FROM_ROW; no stored interface -> not asked, :331-342; INTERFACE_ROW_UNREADABLE :341). Linux only.
- capture/boot/checks.ts:669 (4e delivered programs, calls program-checks); :199 alias socket path check (HOST-44). host-checks.ts:113 HOST-20 forwarding refusal (S13-03 b). HOST-19/HOST-23 not in boot code (grep of capture/boot found HOST-20 only).
- capture/fence/production-parts.ts:720 `cameraInterface` dep, :815-821 `interfaceNow`, :659-673 neighbour filter.
- capture/host-alias/facts.ts:35,52-66 (reads storedInterface + file + network facts), caller.ts:241-265, :472, lifecycle.ts:237, :442; store.ts:63 (`host_network_aliases.interface_name`).
- capture-composition.ts:734-761 (interface file source, `storedInterface: stored.storedInterface()`), :464, :762, :869-871.

## Tests pinning point 2 (will change)
- capture/__tests__/destination-rule.test.ts (37 cases; point 2 at :195, :214, :219, :227, :230-250, :260-262, :368-370)
- capture/__tests__/static.test.ts, module.test.ts, forwarder.test.ts, capture/adapters/__tests__/real.test.ts
- capture/adapters/camera/__tests__/{stored-address-cases.ts, onvif-network.test.ts, onvif-relay.test.ts, camera-watch.test.ts}
- capture/boot/__tests__/{checks.test.ts, boot.test.ts}; capture/host-alias/__tests__/{caller,lifecycle}.test.ts
- __tests__/{capture-composition.test.ts, capture-composition.db.test.ts, host-alias-socket.test.ts}
- modules/capture-discovery/__tests__/{search,adopted-test,readdress,readdress.db}.test.ts, connect/__tests__/service.test.ts
- modules/capture-config/{network,factory-scan,camera-network}/__tests__/*, __tests__/camera-adapter-open.db.test.ts
- apps/core-server/test/acceptance/contract.test.ts:1306,1424; test/support/loopback-destination.ts, stored-camera-address.ts
(Found by grep of refusal codes; not each file read. Discovery eligibility tests under capture/adapters/camera/__tests__ not enumerated.)

## Gaps
- Test list is by grep match, not per-test inspection. graft not used. Facts source `input.network` -> `networkFactsOf` chain confirmed only at network/index.ts:198; the path from there to capture-composition input was not traced line by line.
- The unverified statement: grep for HOST-19/HOST-23 covered capture/boot only.
