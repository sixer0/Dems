---
task_id: 2026-10-21_bare_metal_bench
date: 2026-10-22
agent: explore
scope: Q7 - fixed helper group of HI-04 part A; the four helper-absence conditions of the Core start check
tier: 2
---
# Q7: helper group and helper-absence conditions (read-only, direct inspection; no graph used)

## 1. The fixed group name: `dems-netalias`
| Source | Evidence |
|---|---|
| scripts/host/netalias/dems-core-netalias.socket:15 | `SocketGroup=dems-netalias` (comment at :6 "members of the group dems-netalias") |
| scripts/host/netalias/dems-core-netalias:87 | `SERVICE_GROUP = "dems-netalias"`; comment :85-86 "Its ONLY member is the Core's service user (HOST-43)" |
| apps/core-server/src/capture/boot/host-checks.ts:200 | `ALIAS_SOCKET_STATE = 'socket root dems-netalias 660'` (the Core's socket check expects this group) |
| HOST-PROFILE-UBUNTU-24.04.md:34 | `<helper-group>` is "fixed by the helper's delivery" (placeholder in the profile; the name comes from the files above) |

HOST-43 (profile :129): `sudo groupadd --system <helper-group>` then `sudo usermod -aG <helper-group> <service-user>`; check `getent group <helper-group>` prints one line whose members are exactly the service user. So: `sudo groupadd --system dems-netalias`, `sudo usermod -aG dems-netalias <service-user>`.
HOST-40 (profile :117) and file G (:248) `SupplementaryGroups=audio <helper-group>` -> `audio dems-netalias`. Profile :125 (section 3.8): HOST-43 "is the exception: file G names it (HOST-40), so it exists on every host, with or without the helper". Creating the group installs nothing of the helper.
Not asked by the Core: no helper-absence check reads the group (the absence logic below inspects only paths). Note the Core's own audio-group check (host-checks.ts:271-278) only requires `audio` among the process groups.

## 2. The four helper-absence conditions (Linux, production Core)
"Nothing of the helper" = all four paths absent. The Core decides in two steps; none is a refusal when all four are absent.

| # | What is inspected | Path | Code |
|---|---|---|---|
| 1 | socket node | `/run/dems-core-netalias/socket` | `/usr/bin/stat -c '%F %U %G %a'`; exit 1 with empty stdout -> `SOCKET_ABSENT` -> status ABSENT (host-checks.ts:199, :302-307, :431) |
| 2 | helper file (with its directory `/usr/local/sbin` as the standing path) | `/usr/local/sbin/dems-core-netalias` | program-checks.ts:124-125, :159 (`standing` = 1: only the system dir is expected there) |
| 3 | socket directory | `/run/dems-core-netalias` | program-checks.ts:126, :160 |
| 4 | the two unit files | `/etc/systemd/system/dems-core-netalias.socket` and `/etc/systemd/system/dems-core-netalias@.service` | program-checks.ts:127-128, :160 |
(Conditions 3 and 4 are one `stat` question with three paths, standing = 0.)

Logic: program-checks.ts:36-47 (header), :306-324 (loop; `nothingOfTheHelper`), :367 `aliasHelper = 'ABSENT'` when both ownership questions are ABSENT, and :330-ish interface file `/etc/dems/netalias-interface` (:129) is then NOT asked (:325-327, status NOT_ASKED).
Outcome when all absent (checks.ts:676-681): no refusal; warning code `CAPTURE_HOST_ALIAS_HELPER_ABSENT` (checks.ts:212), plus an error-log row; audit `SYSTEM_BOOT` with `addressHelperSocket: NOT_PRESENT` (profile :125).

## 3. Refusal codes that follow when NOT absent as a whole
| Situation | Code / reason | Source |
|---|---|---|
| Socket node absent but any of helper file, `/usr/local/sbin` entry beyond standing, socket dir, either unit file present (PARTIAL) | `CAPTURE_HOST_ALIAS_SOCKET` / `SOCKET_ABSENT` | program-checks.ts:42-46, :164, :321 |
| Socket node present but not `socket root dems-netalias 660` (kind, owner, group, mode) | `CAPTURE_HOST_ALIAS_SOCKET` / `SOCKET_OWNER_GROUP_OR_MODE` | host-checks.ts:123-124, :145, :200, :310 |
| Helper file absent / not a regular root file / writable by group or others (socket node present) | `CAPTURE_HOST_ALIAS_HELPER_UNSAFE` (HOST-45), reason `FILE_ABSENT` etc. | program-checks.ts:71, :87, :159 |
| Socket dir or a unit file absent / not root's / writable | `CAPTURE_HOST_ALIAS_GRANT_UNSAFE` (HOST-44) | program-checks.ts:73, :88, :160 |
| `DEMS_CAPTURE_ALIAS_SOCKET` set to another path than `/run/dems-core-netalias/socket` | `CAPTURE_HOST_ALIAS_SOCKET_PATH` / `CONFIGURED_PATH_NOT_THE_INSTALLED_ONE` | checks.ts:162, :665-666 |
| Interface file (`/etc/dems/netalias-interface`) unsafe, helper present | PROGRAM_INTERFACE_FILE refusal (HOST-46) | program-checks.ts:129, :325-337 |
macOS: none of this is asked (profile :9, HOST-44 to HOST-46).

## 4. Consequence for the bench
- Create group `dems-netalias` (HOST-43) and add the service user; install NOTHING from scripts/host/netalias/ (sockets, files, units, `/run/dems-core-netalias`). Then all four paths stay absent and the Core starts with the one warning.
- Do not create `/run/dems-core-netalias` or any of the four paths: any one of them alone turns the start into a `CAPTURE_HOST_ALIAS_SOCKET` refusal.

## Unknowns / not verified
- Not run on a host; the profile marks HOST-43 "to confirm in 9A/H-05".
- The exact `nothingOfTheHelper` body was not read (only its use, program-checks.ts:~315); the "all four absent" reading rests on the header :36-47 and the code in section 2.
- Line numbers for the interface-file branch are approximate (:325-337).
