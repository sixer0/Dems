---
task_id: 2026-10-12_input_av_core_adapter_plan
row: HC
date: 2026-10-13
agent: coder-execution (agent HC, track D)
tier: T3
decisions: C94 (j) reversing C49 (1); C53 (4c); C49 (2); C55 DD-2; C46; C66 (1); C97
requirement: R119-10, R119-12 (verification/119), BR-12 / `9A/H-16` criterion 6
baseline: `boot/checks.ts` dfb1a117, `boot/index.ts` 5a264525 (record p1_production_platforms.md)
status: needs-review (four items built and green on doubles; ONE open point that only a Linux host settles - section 1)
---

# Row HC: host-checks follow-up - helper absent is a fact, configured socket path, rule table, a code for "no host facts"

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`, `BOOT` = `CS/src/capture/boot`, `FENCE` = `CS/src/capture/fence`. Nothing here has run on a Linux host. The host's command runner is a double in every test (`BOOT/__tests__/host-support.ts`): no `nft`, `systemctl`, `stat`, `ip` or other host command was started by this row.

## 1. Why needs-review: the rule-table row may refuse every start on a prepared Linux host

Item 3 is built as C49 (2) orders. Its row is `/usr/sbin/nft list table inet dems_loopback`. Whether the Core's own account may run it is NOT KNOWN:

| Fact | Source |
|---|---|
| The profile's own check of the table needs the administrator | `scripts/host/HOST-PROFILE-UBUNTU-24.04.md:83` (`sudo nft list table inet dems_loopback`) |
| The Core has an empty capability bounding set and no ambient capability | the same file, item HOST-39, lines 241-242 of file G |
| "A Core with an empty capability set probably cannot list the packet-filter rule set" - HYPOTHESIS, to settle in a container | `implementation/076_host_profile.md:83`; no later record settles it |
| Row 80 read the unit's state for exactly that reason | `BOOT/host-checks.ts`, the comment of the first row of the table; `implementation/080` section 4, request (a) of row 76 |

The tool answers a caller that may not list as it answers an absent table: nothing on standard output, exit code 1 (the runner drops standard error). The Core cannot tell the two apart, so the reason word says both, `RULE_TABLE_ABSENT_OR_NOT_READABLE`, and both are refused (fail closed). **If the hypothesis of record 076 holds, every production start on a prepared Linux host is refused by this row.** This Mac is not affected: on `darwin` no row of the table is asked (row P1, kept and tested).

It is built anyway because the decision is in force, the row is fail-closed, and nothing on a Linux host runs before the hardware package. It is one entry of the table: taking it out is one hunk of `host-checks.ts` plus the named entry of the static test. Request line 1 of `delegation_progress/file_requests.md` asks for the measurement first and names three ways out.

## 2. What was built, per item

### Item 1 - C94 (j): the address helper is not mandatory

On `linux`, in `REAL_PRODUCTION`:

| State of the host | Result |
|---|---|
| ABSENT: no socket node, no helper file, none of the socket's directory and the two unit files | NOT refused. Log: one warning `CAPTURE_HOST_ALIAS_HELPER_ABSENT` with an error-log row (level `warn`). Checks 2 and 3 of the program checks have the status `ABSENT`; the interface file (check 4) is not asked and the stored row is not read |
| PARTIAL, socket node missing, something of the helper there (file, directory or a unit file) | refused `CAPTURE_HOST_ALIAS_SOCKET` / `SOCKET_ABSENT` (the code and reason of before the row) |
| PARTIAL, socket node there, a file missing | refused `CAPTURE_HOST_ALIAS_HELPER_UNSAFE` or `CAPTURE_HOST_ALIAS_GRANT_UNSAFE` / `FILE_ABSENT` (as before) |
| WRONG: a socket of another owner, group or mode; a path that is not a socket | refused `CAPTURE_HOST_ALIAS_SOCKET` / `SOCKET_OWNER_GROUP_OR_MODE` (as before) |
| WRONG file or unit (kind, owner, write bits), or a question that cannot be asked or read | refused by that question's own code and reason, whether or not the socket node is there |

How: the socket question of `host-checks.ts` no longer turns "node not there" into `MISSING`; it is the new status `ABSENT` and is handed on (`HostCheckOutcome.aliasSocket`). Step 4e of `checks.ts` passes it to `program-checks.ts` (`DeliveredProgramDeps.aliasSocket`), which judges socket, file and grant as one installation and answers `ProgramCheckOutcome.aliasHelper` (`IN_PLACE` / `ABSENT` / `NOT_ASKED`). "Nothing of the helper" behind an ownership question = the tool ended with 1 and printed no more lines than the host has without the helper (1 for the helper file's question: the system's own directory; 0 for the grant's).

The commissioning functions are not touched: with the helper absent they answer their own "not configured / not available" refusal as before (V6's and row 105's code).

**The `SYSTEM_BOOT` member** (one, optional), verbatim: `addressHelperSocket: 'PRESENT' | 'NOT_PRESENT'`.

- Declared in `CS/src/core/audit-details.ts` only (`SYSTEM_BOOT_ADDRESS_HELPER_DETAIL_RULES`, entered in the open rule of `SYSTEM_BOOT`). `packages/shared` declares no member of `SYSTEM_BOOT` (it holds example constants only): nothing in shared was edited; one optional request line to V6 for an example.
- Written by the fence BEFORE the boot checks run. What the fence can know then: the platform word, and what ONE look at ONE fixed path shows - the path the delivered socket unit installs (`/run/dems-core-netalias/socket`), through the inspector the fence already holds. It asks the host no question. So `NOT_PRESENT` means "nothing was found at the helper's socket path when the fence step passed (or the path could not be reached)", not "no part of the helper is installed"; `PRESENT` means "something was there", not "it is root's socket with the delivered group and mode". The descriptions in `audit-details.ts` and `FENCE/boot-key.ts` say so. What the checks then found is in the log.
- Stated by a `REAL_PRODUCTION` boot on `linux` only. On `darwin`, in `REAL_DEVELOPMENT`, and without mounted boot checks the row is the row of before, member for member, and the path is not looked at.
- `FENCE/boot.ts` (0f372f96) and `FENCE/operation.ts` (0d55f3cb): empty diff, held by a test.

### Item 2 - C53 (4c), R119-10: a configured socket path is the installed one

Check 4d-3 of `checks.ts`, after 4d-2 and before 4e, `REAL_PRODUCTION` only: `DEMS_CAPTURE_ALIAS_SOCKET` set to anything but `/run/dems-core-netalias/socket` is refused `CAPTURE_HOST_ALIAS_SOCKET_PATH` / `CONFIGURED_PATH_NOT_THE_INSTALLED_ONE`. Unset is not asked (the absent-or-default case of item 1). The configured path is never in a message, a log line or an error-log row. The mount hands in `app.config.captureAliasSocketPath`.

### Item 3 - C49 (2): the rule table is read

The exact row, second of `HOST_COMMAND_CHECKS`, after the unit's state:

```
/usr/sbin/nft list table inet dems_loopback
```

The table is installed by item **HOST-25** of the host profile (file D, `/etc/dems/loopback-ingest.nft`, loaded by the unit of file E). Refused under the existing code `CAPTURE_HOST_LOOPBACK_RULE_MISSING`:

| Answer | Reason |
|---|---|
| nothing printed, exit 1 (table deleted - or the Core may not list it, section 1) | `RULE_TABLE_ABSENT_OR_NOT_READABLE` |
| the table without a chain `output` that is hooked on output | `RULE_CHAIN_MISSING` |
| the chain without a rule that holds `tcp dport 8554-8564`, `skuid != ` and `reject` | `RULE_NOT_IN_CHAIN` |
| any other form, another exit code, not started, timed out | the three words every question has |

So criterion 6 of `9A/H-16` (table deleted, unit active) is expected to be MET - subject to section 1. No caller of `hostCommandRunnerOver` or `captureHostRunnerOf` was added: the boot checks ask through the runner they already own, and the file still calls `run(` in one place with a row of the table. Static rule: one named entry in `CS/src/capture/__tests__/static.test.ts` (the row-80 block): the tool is admitted in one declaration and one row, `list table inet dems_loopback`, every argument a literal; it stays in the refused list for everything else, and a write verb or a file argument fails the test.

### Item 4 - C55 DD-2: a code of its own for "no host facts"

Check 4d-0 of `checks.ts`, before 4d: when the mount was handed no facts (`hostFactsHandedIn === false`), a `REAL_PRODUCTION` start is refused `CAPTURE_HOST_FACTS_NOT_HANDED_IN` / `NO_HOST_FACTS`, at the place where `CAPTURE_HOST_CORE_FILE_LIMIT` / `LIMIT_UNREADABLE` was given for it. Facts that were handed in and whose limit cannot be read keep the limit's code (C46). `HOST_NOT_SEEN` and the pinned lines of the mount are unchanged, so a caller that leaves the new member out is still refused by 4d.

Suites re-stated (they pinned the old code for that case):

| File | Case |
|---|---|
| `BOOT/__tests__/boot.test.ts` | "C46: a mount that is handed NO host facts ..." (code, log line, error-log row) |
| `FENCE/__tests__/fence.db.test.ts` | "C46 / F-07 ...", part 1 (refusal triple and the code list) |

Not re-stated, on purpose: `BOOT/__tests__/checks.test.ts` "check 4d-2 ..." hands in facts with an unreadable limit - that is still the limit's code.

## 3. The diff of `checks.ts`, hunk by hunk

Start: blob `dfb1a117a0a3f434f7fa27e91521490879ad4779` (620 lines), hashed at the start of the row. End: blob `90b3a1e6ee910c5933f0b43f08ce0c239ea4e1ca` (695 lines). 75 lines added, 1 line replaced. Checked mechanically: a scratch copy with the 75 lines removed and the one line restored hashes to `dfb1a117` again.

| # | Where | Lines | What |
|---|---|---|---|
| 1 | header, after the text of 4e | +19 | the three additions described (4d-0, 4d-3, 4e amended) |
| 2 | imports | +2 | `ALIAS_SOCKET_INSTALLED_PATH`, `type AliasSocketFinding` (a second import line of `./host-checks`; the first is unchanged) |
| 3 | `CaptureBootRefusal`, after `HOST_PLATFORM_NOT_SUPPORTED` | +10 | `HOST_FACTS_NOT_HANDED_IN`, `HOST_ALIAS_SOCKET_PATH` |
| 4 | `TEXT` | +4 | the two texts |
| 5 | before `CaptureBootError` | +7 | `NO_HOST_FACTS`, `CONFIGURED_PATH_NOT_THE_INSTALLED_ONE`, `ALIAS_HELPER_ABSENT` |
| 6 | `CaptureBootDeps` | +12 | `hostFactsHandedIn?`, `configuredAliasSocket?` |
| 7 | messages | +1 | `HELPER_ABSENT` |
| 8 | before the comment of 4d | +6 | check 4d-0; `let aliasSocket` |
| 9 | inside 4d, after its refusal line | +1 | `aliasSocket = host.aliasSocket;` |
| 10 | after 4d-2 | +6 | check 4d-3 |
| 11 | 4e | +7, 1 REPLACED | one comment line; the call `deliveredProgramOutcomeOf(deps.programs, ...)` now passes the finding of 4d (`aliasSocket === undefined ? deps.programs : { ...deps.programs, aliasSocket }`); the block that says `CAPTURE_HOST_ALIAS_HELPER_ABSENT` |

No condition, statement or catch of checks 4, 4b, 4b-2, 4b-3, 4c, 4d-2 changed. In 4d one statement was added; its condition and its refusal are as they were.

`BOOT/index.ts`: start `5a264525300ef52408622dba7ef0464bafd3ab44` (688), end `63fe763e3d43425d49f503b5e40200f42b9d4c57` (704). 16 lines added, none replaced (same mechanical check): 6 header lines; 4 export lines; 2 lines reading `captureAliasSocketPath`; 4 lines handing `hostFactsHandedIn` and `configuredAliasSocket` to the checks.

Other blobs at the end: `host-checks.ts` a88c6a1a -> fd7e637d (479 lines), `program-checks.ts` ca14fec9 -> 15680a74 (341), `fence/boot-key.ts` b920eed4 -> 24c358d9 (389), `fence/index.ts` 6bebe210 -> b61d3ed6 (779), `core/audit-details.ts` -> f6c294aa (another agent edited that file during the row; my two insertions applied to its text).

## 4. Tests added or re-stated

| File | Change |
|---|---|
| `BOOT/__tests__/host-support.ts` | `RULE_TABLE_KEY`, `RULE_TABLE_ANSWERS` (1 present, 8 absent, 6 malformed); `fakeHost` knows the table row by its program |
| `BOOT/__tests__/host-checks.test.ts` | table pins re-stated (one code asked twice, 10 rows); 3 cases added (the fixed row; table deleted with the unit active; the socket `ABSENT`) |
| `BOOT/__tests__/program-checks.test.ts` | outcomes re-stated (`aliasHelper`); import pin; 4 cases added (ABSENT, PARTIAL both ways, WRONG) |
| `BOOT/__tests__/checks.test.ts` | 2 cases re-stated; one block of 7 cases added (items 1 to 4 at the boot, `darwin` kept) |
| `BOOT/__tests__/boot.test.ts` | the no-facts case re-stated; 1 case added (the mounted step and the configured path) |
| `FENCE/__tests__/fence.test.ts` | the pinned line of the boot row re-stated; 1 case added (the member) |
| `FENCE/__tests__/fence.db.test.ts` | the no-facts case re-stated; the Linux row states the member, the `darwin` row does not |
| `CS/src/core/__tests__/writers.test.ts` | the member list of the open rule (+1); accepted and refused values of the member |
| `CS/src/capture/__tests__/static.test.ts` | the one named entry (section 2, item 3) |

## 5. Checks run

| Check | Command (from `CS`) | Result |
|---|---|---|
| unit: boot folder, fence, writers, capture static, `test/static` | `npx vitest run --project unit --maxWorkers=2 src/capture/boot src/capture/fence/__tests__/fence.test.ts src/core/__tests__/writers.test.ts src/capture/__tests__/static.test.ts test/static` | `Test Files  30 passed (30)`, `Tests  806 passed (806)` (earlier runs red: the pins this row moves, and two wrong expectations in my own new cases about the order of error-log rows off Linux) |
| database, throw-away clones, both locks, sandbox off | `fence.db.test.ts`, `capture/__tests__/boot.db.test.ts`, `__tests__/capture-composition.db.test.ts`, `sealing/__tests__/production-key-proof.db.test.ts`, `modules/storage/__tests__/volume-at-boot.db.test.ts`, `capture-notices/__tests__/session-start.db.test.ts` | `Tests  1 failed | 78 passed (79)`, `0 remain` - the one is not this row's (below) |
| database, after the last source edit | `fence.db.test.ts` alone | `Tests  49 passed (49)`, `0 remain` |
| typecheck | `npx tsc --noEmit` | 6 errors, none in a file of this row (below) |
| lint | `npx oxlint` on the 7 product files and the 5 boot test files | no output |

Reds seen, not this row's, files not edited: `CS/src/__tests__/capture-composition.db.test.ts:924` (set-IP request without `scannedMac`: agent V6, R119-04); typecheck `src/modules/capture-config/installation-acceptance/service.ts(242,55)` and `packages/shared/src/api/installation-acceptance.ts` (649-651, 682, 683) (agent V6, R119-07).

## 6. Driver decisions (for the controller to confirm)

| # | Decision | Reason |
|---|---|---|
| D-1 | With the helper absent as a whole, the interface file (program check 4) is NOT asked, even when the database stores a camera interface | no helper would read the file; asking it would make the helper mandatory again for every host with a stored network configuration. Not covered: an interface file left behind alone is not seen as a part of the helper |
| D-2 | A partial installation with the socket node missing is refused by the SOCKET's code (`CAPTURE_HOST_ALIAS_SOCKET` / `SOCKET_ABSENT`), reported by the program checks | it is the refusal that host had before the row, and its text is the true one. CONSEQUENCE: "stop the socket unit" after commissioning (the procedure review 119 sketches under R119-12) leaves the helper file and unit files behind and REFUSES the next start. The helper is removed as a whole or left whole. If stopping alone must be allowed, that is a further ruling |
| D-3 | Check 4d-3 (the configured path) is asked on every platform | it compares two texts and asks the host nothing; a path the boot never checked must not be dialled anywhere. Row P1's rule "no question of the Linux profile on darwin" is untouched |
| D-4 | The table row carries the code of the loopback rule, not a code of its own | the hardware chapter's outcome (i) names that code; the reason words tell unit and table apart |
| D-5 | The rule is recognised by three parts of its printed line (ports, "another user than", reject); the service user's name, the counter and the priority word are not compared | the tool prints the user as a name or a number and adds counter figures; a stricter match could refuse a prepared host |
| D-6 | The absent helper is said as a WARNING with an error-log row, and does not raise the severity of the `SYSTEM_BOOT` row | the pattern of row P1 for "the host profile was not asked" |
| D-7 | `addressHelperSocket` is stated both ways on Linux (`PRESENT` too) | a row without the member then always means "not a Linux production boot", never "not looked at" |
| D-8 | A second import line of `./host-checks` in `checks.ts` instead of editing the first | keeps the baseline line unchanged; the linter accepts it |

## 7. Unproven until a Linux host

| Unproven | Check |
|---|---|
| The Core's account, with an empty capability set and no-new-privileges, may run `/usr/sbin/nft list table inet dems_loopback` at all (section 1) | `9A/H-16` step `.1` (a prepared host starts), then step `.9` |
| `nft` is at `/usr/sbin/nft`, runs with an empty environment, prints the table in the form judged (first line `table inet dems_loopback {`, a chain `output` with its `type filter hook output priority ...` line, the rule on one line with `tcp dport 8554-8564`, `skuid != `, `reject`), and answers an absent table with nothing and exit 1 | `9A/H-01.3`, `9A/H-16.9` |
| Criterion 6 of `9A/H-16`: the table deleted with the unit active refuses the start | `9A/H-16.9` |
| A host with nothing of the helper answers the two `stat` questions as assumed (one line for `/usr/local/sbin` and exit 1; no line and exit 1) and starts with the line `CAPTURE_HOST_ALIAS_HELPER_ABSENT` | `9A/H-16` before chapter 4 is run |
| After `HI-01` to `HI-07` the same host starts without that line; each partial state of chapter 4 (a step left out) refuses with the code stated in section 2 | `HI-01` to `HI-07`, `9A/H-05`, `9A/H-04` |
| The fence's look at the socket path as the service user (the socket's directory is reachable for the helper's group): `PRESENT` after installation, `NOT_PRESENT` before | `9A/H-05`, read from the `SYSTEM_BOOT` row |
| A stopped socket unit: whether the node and its directory are gone, and that the start is then refused (D-2) | `9A/H-05`, `HI-08` |

## 8. Requests left (`delegation_progress/file_requests.md`, four lines of row HC)

1. Controller / host profile / hardware package: settle whether the Core may list the table; a ruling if not. Blocking for a Linux production start only.
2. THE DOCUMENT ROW: the order of the hardware chapters written under C49 (1) - `HI-01` to `HI-07` before `9A/H-16` - is no longer forced; step `.9` and criterion 6 of `9A/H-16` now expect outcome (i); the code lists of chapter 2 and the installer note. Not blocking.
3. Agent V6 (optional): an example of the member in `packages/shared/src/api/security-audit.ts`. Not blocking.
4. Reds of other rows (section 5).

## 9. Rules kept

Edit tool only for every existing file; the two records are new files (Write). One scratch script under the session's temporary directory read two product files, wrote copies there and hashed them (section 3); it changed no file of the repository. No commit, no stage. No full suite. No process of the host was started by a test; no port bound; database cases on throw-away clones under `.locks/db-migrate.lock` (with the heavy-host lock), 0 clones left. `packages/shared`, `capture/host-alias`, the commissioning modules, `capture/adapters/camera`, `capture-composition.ts`, the schema and `fence/boot.ts` / `operation.ts` were not edited. `apps/input-av/` not opened.
