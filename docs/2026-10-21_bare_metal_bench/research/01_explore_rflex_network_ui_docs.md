---
task_id: 2026-10-21_bare_metal_bench
row: 85
date: 2026-10-22
agent: explore
scope: RQ-N4 and RQ-N6 (R-FLEX wave W-a), read-only, code and docs only
tier: 2
---

# R-FLEX network config, console and host docs: source map

Method: direct grep and reads (the `graft/` folder holds only INDEX.md; no graph query was used). No design is proposed; options the code allows are listed.

## RQ-N4 - capture_network_config

### Storage (migrations)
- `apps/core-server/src/db/migrations/0017_network_commissioning.sql:1-20`: table `capture_network_config`, singleton row. `interface_name` and `camera_subnet` are NULLABLE, no default (lines 3-4). CHECKs: interface regex (13), subnet IPv4 /16-/30 (14), factory_addresses array of at most 32 dotted quads, default 4 factory addresses (5, 15), alias_host 2-254 default 253 (16), alias_minutes 5-480 default 30 (17), camera_ip_start 2-250 default 101 (18).
- `0018_network_commissioning_privileges.sql`: runtime-role grants (SELECT, INSERT, column-list UPDATE; per 0031 header lines 9-12).
- `0031_network_config_onvif_ports_privileges.sql:15`: `GRANT UPDATE (onvif_ports)`; the column `onvif_ports` itself comes from 0030 (default `[80]`, 1-8 ports). 0031 header lines 5-6 cite S13-11 point 3.

### Shared contract
- Operations 101 `getCaptureNetworkConfig`, 102 `updateCaptureNetworkConfig`: `packages/shared/src/api/capture-commissioning.ts:9-10`, definitions `:576`, `:599`; path constant `:541` (`/api/v1/capture/network/config`); also in `packages/shared/openapi/openapi.json` (not line-read; unknown line numbers).
- Limits `:119-143`; defaults `:149-` ("The interface and the subnet have NO default: the Core never chooses them"); field list `:152`.
- Answer schema `:391-406`: `configured` = both interface and subnet set (`:392`), `interfaceName`/`cameraSubnet` nullable. Update schema `:411-421`: every field optional except `revision`; interface and subnet accept `null` (clears the choice).
- Patterns: subnet `:100` (private only, /16-/30), interface `:111` (letters either case).

### Core module and routes
- `apps/core-server/src/modules/capture-config/network/routes.ts:6-7` (101 GET, 102 POST; permission CAPTURE_COMMISSION + WEB_CONSOLE_SESSION); `service.ts` (`networkConfigOf` :136-139: `configured = interfaceName !== null && cameraSubnet !== null`; unwritten row :125-127 both null; `judge` :193-201); `store.ts:50-68` SQL; `facts.ts`.
- `camera-network/` (set-address job) and `host-alias/` hold the consumers; `modules/capture-discovery/` holds search, typed-address, readdress.

### What is required, what the Core refuses when empty (all file:line)
- Write side: nothing is required. `service.ts:194` judges the subnet only when non-null; `:200` judges the interface only when non-null and requires the host to hold it (`hostHoldsInterface`, `facts.ts:130-131`: name exists and not internal). Null for either is accepted by the schema (`capture-commissioning.ts:414-415`) and by the DB CHECKs (0017:13-14).
- Read side, the single choke point: `facts.ts:138` `networkFactsOf` returns null when stored is null, or interface null, or subnet null, or subnet unparsable, or the host lacks the interface, or the port list is no array (`:142`).
- Null facts -> `NOT_CONFIGURED` refusal for every destination purpose: `apps/core-server/src/capture/destination-rule.ts:351` (`decideDestination`), `:420` (new camera address); `:290` `factsOf` returns null when `cameraSubnet` is null.
- Alias helper path: `capture/host-alias/facts.ts:12,54-55` (no stored interface -> caller answers `NETWORK_NOT_CONFIGURED`).
- Console copy for the empty state: `i18n-web.ts:759` "...until both are set, a scan is refused."; shared description `capture-commissioning.ts:392` names `COMMISSIONING_NOT_CONFIGURED`.
- Fail-closed ruling quoted at `apps/core-server/src/capture-composition.ts:19-26` (decision C55): no reader or a reader answering nothing -> every stored camera address refused. Entry point hands the reader in since I-9a.
- Other fields (factory_addresses, alias_host, camera_ip_start, alias_minutes, onvif_ports) have DB defaults and are never empty on a read; factory_addresses may be an empty array? CHECK allows length 0..32 (0017:15) - hypothesis from the CHECK, not tested.
- Interface and subnet per purpose: destination-rule header `:22` (set-IP uses the configured subnet); `DR-4`/`S13-11` text lives in destination-rule point 2 (cited by D10 ruling 2).
- Search eligibility is separate from the config: `capture/adapters/camera/ws-discovery.ts:9-11` picks eligible IPv4 interfaces, at most four, from `os.networkInterfaces()` (`:178`); it does not read `capture_network_config` (grep found no reference in `modules/capture-discovery/search.ts`). The typed-address path does depend on the rule: `capture-discovery/typed-address.ts:40,63` `NOT_CONFIGURED`; `routes.ts:28,71` answers `422 DISCOVERY_ADDRESS_NOT_ALLOWED`. (Which callers build `DestinationContext` is RQ-N1, row 84's scope.)

### Console
- Network-config FORM FOUND: not in `features/devices/` but in `apps/core-web/src/features/commissioning/index.tsx` (route `/admin/commissioning`, `model.ts:3`): `SettingsForm` `:237-392`, panel `:194`, form `:295`, warning alert when `!config.configured` `:296-304` (`data-testid="com-not-configured"`), the two fields `interfaceName`/`cameraSubnet` rendered at `:304-320`, save `:388-390`.
- Form is optional by construction: `commissioning/model.ts:242-243` (the zod refine accepts empty text for both), `:75-76` empty -> `null`. Calls: `model.ts:110-124`.
- Word keys (`apps/core-web/src/i18n-web.ts`): `web.commissioning.settings.title` :755 area, `.notConfigured` :759, `.interfaceName.{label,hint,error}`, `.cameraSubnet.{label,hint,error}` (:760-770), `.factoryAddresses.*`, `.aliasHost/.aliasMinutes/.cameraIpStart`, `.onvifPorts.*`, `.save`, `.saved`, `.unchanged`, `.revision`, `.lastWritten`, `.neverWritten`; plus `web.commissioning.productionOnly`, `.notProduction`, `.simulated`, `.readFailed`. cameraSubnet hint says "Leave it empty for 'not chosen'" (hint text ~:768).
- Camera search UI (`features/devices/`): `camera-search-panel.tsx` (517 lines), `camera-search-context.tsx`, `camera-search-address.tsx`, `camera-search.ts` - NONE reads the network config (grep for network/subnet/interface/NOT_CONFIGURED: only `:255-256` `common.captureSearch.networksSearched` with `search.interfaceCount`; word in `packages/shared/src/i18n/en/common.ts:778`, mobile `apps/mobile/src/features/capture-selector/i18n.ts:159`). Typed-address refusal surfaces as `422 DISCOVERY_ADDRESS_NOT_ALLOWED` (`camera-search.ts:323` comment). Word keys for the panel: `devices.search.tableLabel`, `common.captureSearch.networksSearched`; other keys not enumerated (unknown).
- Mobile has its own camera-search panel (`apps/mobile/src/features/capture-selector/camera-search-panel.tsx:141`).

### Options the code makes possible (not a design)
1. Keep both nullable; change only the read side (`facts.ts:138`, `destination-rule.ts:290/351/420`) so null no longer means NOT_CONFIGURED.
2. Keep `interfaceName` as the alias-helper interface only (the helper reads `/etc/dems/netalias-interface`, HOST-46) and drop it from destination decisions.
3. Make the form fields hint "optional" (word keys above); form already submits empty as null.
4. Schema/DB need no change for optionality (both already nullable); `configured` flag semantics (`service.ts:139`, `capture-commissioning.ts:392`) would change if its meaning changes, which touches the OpenAPI text and the sim (`packages/shared/src/sim/api.ts`, `simCaptureNetworkConfig` `:789`).

## RQ-N6 - host profile and installer docs

### Host profile text (`scripts/host/HOST-PROFILE-UBUNTU-24.04.md`)
- HOST-19 `:81`: dedicated port/switch, one static private /24, no gateway, no DNS, no DHCP; file B `/etc/netplan/60-dems-camera.yaml` (`:174`). Takes-effect: `ip -br -4 addr show dev <camera-interface>`; default route not on it. Open: netplan renderer (9A/H-01).
- HOST-20 `:82`: forwarding off (file C `:188`); check `sysctl net.ipv4.ip_forward net.ipv6.conf.all.forwarding` = 0 0 and per-interface forwarding 0.
- HOST-21 `:83`: no software that re-enables forwarding.
- HOST-22 `:84`: ufw default deny incoming and routed.
- HOST-23 `:85`: `sudo ufw allow in on <camera-interface> proto udp from any port 3702 comment 'DEMS camera search answers'`; open: 9A/H-12 (whether source-port rule suffices), 9A/H-13 (answers from a factory subnet via a temporary address). Already scoped to the camera interface only. Mirror text `:276` (verification row 8).
- HOST-24 `:86`: Core and DB listen on 127.0.0.1; no ALLOW for 4420-4423.
- HOST-25 `:87`: nftables loopback rule for 8554-8564 (files D `:197`, E `:210`). Not network-scope dependent.
- HOST-46 `:132`: interface file `/etc/dems/netalias-interface`, one line naming `<camera-interface>`, root 0644; not the default-route port; service user reads it via `/usr/bin/cat`; helper is optional all-or-none (`:125`, HOST-44..46). A single interface name, so the helper is tied to one interface by design.
- Ping row for set-address `:161` (route chosen by the kernel; "with HOST-19 in force that is the camera port"). Rollback `:297`; `:293` dedicated port is part of the digest-auth acceptance condition.
- Mac: HOST-20, 25 etc. not asked (`:9`).

### Script `scripts/host/40-network-firewall.sh`
- HOST-19 MANUAL item `:26-43` (netplan file shown, never applied); HOST-20 AUTO `:47`; HOST-22 `:75-80`; HOST-23 AUTO `:84-88`: `act ufw allow in on "$HP_CAMERA_INTERFACE" proto udp from any port 3702 ...` with confirm 9A/H-12/H-13; HOST-24 NONE `:92-100`; needs `service-user camera-interface` (`:16`). The script runs only given `--camera-interface`; no code for other interfaces.

### INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md (`scripts/host/`)
- Step 1 `:235` lists the camera port and firewall; step 8 first production boot `:244`; step 9 optional address helper `:245` (Linux only, all or none, not before check 9A/H-06); step 10 `:246` per camera search and connect in the console; step 7a note `:255`.
- `:258` camera search is an active scan only (stored list + one typed address, ruling U9); `:259` room-network cable plugged in only after step 8 (PREP-11) - an assumption of the current model that the room network is not the camera network.
- No `ufw`/`netplan` text beyond step 1 in this note (grep).

### Pins and tests
- `scripts/host/test_host_profile_scripts.sh:234`: asserts the printed `ufw allow in on enp3s0 proto udp from any port 3702` (the only test of HOST-23); `:229-238` also asserts the netplan address and the loopback rule file.
- `apps/core-server/test/static/network.test.ts` pins listen host 127.0.0.1, no CORS, DB port, env reading, outbound-module exemptions (`:153-198`, e.g. `ws-discovery.ts` allowed `node:dgram`, `onvif-session.ts` allowed https). It does NOT pin HOST-19..25 or camera-subnet rules. `apps/core-server/test/static/imports.test.ts` (modified in git status; not read) contains `capture_network_config` references - purpose unknown.
- No test or source under `apps/core-server/test` or `src` cites HOST-19..HOST-25 (grep returned only the script test above). Rule tests for the destination rule: under `apps/core-server/src/capture/__tests__` and DB tests `test/db/*` (set9, set15, constraints, privileges, catalog) hold the table's CHECKs and grants: any DB change needs `contract-inventory.json`/`contract-v*-delta.ts` upkeep (unknown without reading).
- Hardware docs: `scripts/hardware-acceptance/HW-ACCEPTANCE-2-HOST-HELPER-AUDIO.md`, `-3-NETWORK-CAMERAS-SESSION.md`, `-4-HELPER-INSTALLATION.md`, `collect-h01.sh`, `collect-h12.sh` mention HOST-23/3702/ufw.

### RQ-N6 answer inputs (rulings)
- Per D12 U-RF3 search answers are allowed on the camera port only; HOST-23 text and script already match that (rule is `on <camera-interface>`). Open item: global discovery on other interfaces (D10 ruling 2) means answers on other interfaces are dropped by HOST-22 default deny; the code in `ws-discovery.ts` (up to four interfaces) would then receive no answers there. Whether one interface's rule suffices on the real host is unconfirmed (H-12, H-13).
- HOST-19/HOST-20 text is hygiene-compatible: neither names the destination rule.

## Gaps
- `openapi.json` line numbers not read; i18n key line numbers approximate for :760-770; `imports.test.ts` content not read; full list of destination-rule point-2 text and callers belong to row 84.
