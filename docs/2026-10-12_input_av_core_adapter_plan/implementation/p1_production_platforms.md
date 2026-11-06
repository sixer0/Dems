---
task_id: 2026-10-12_input_av_core_adapter_plan
row: P1
date: 2026-10-13
agent: coder-execution (driver)
tier: T3
builds_on: implementation/080_host_checks.md; implementation/209_x1_system_boot_key.md; implementation/v4_fourth_contract_step.md (item 1); implementation/v5_rotation_audit_receiver_export.md (R-1); implementation/191c_signed_audio_gap.md; implementation/228b_reserved_ids_and_fixture_hygiene.md; decisions U21 (2), C46, C66 (1), C71 C-7, C84
status: complete (five driver decisions to confirm, section 8; one red that is not this row's, section 6)
---

# Row P1: the platforms of a production Core, and "the host profile was not asked" as a fact of the evidence

Tier 3: what was built, where, and the output that shows it. Paths are relative to `/Users/gsp-budi/Documents/DEMS`; `CS` = `apps/core-server`, `SH` = `packages/shared`. No real device, no real key, no Linux host: every host is the test host or a unit double.

## 1. Result

| Point of the row | Before | After |
|---|---|---|
| (1) another platform | any platform but `linux` started a production Core with the warning | refused by `CAPTURE_HOST_PLATFORM_NOT_SUPPORTED`, reason `PLATFORM_NOT_LINUX_OR_DARWIN` (check 4d-2) |
| (1) `linux` | the whole host profile asked | unchanged |
| (1) `darwin` | starts, warning `CAPTURE_HOST_PROFILE_NOT_ASKED` | unchanged |
| (2a) `SYSTEM_BOOT` of a production boot | says nothing of the host | `hostPlatform`, `hostProfile` |
| (2b) sealed manifest | says nothing of the host | optional signed member `hostProfileNotAsked: { platform }` (field 133): present on macOS, ABSENT on Linux |
| SIMULATED, REAL_DEVELOPMENT | no profile asked | nothing changed: no check, no audit member, no manifest member, no outcome member (tested) |

## 2. Part (1): check 4d-2

`CS/src/capture/boot/checks.ts`. The one closed list `PRODUCTION_PLATFORMS = { linux: 'ASKED', darwin: 'NOT_ASKED' }`; `hostProfileStatementOf(platform)` answers `{ platform, asked }` or null. The check, added AFTER the block of 4d and before 4e:

```ts
const hostProfile = operation === CaptureOperation.REAL_PRODUCTION && deps.host !== undefined ? hostProfileStatementOf(deps.host.platform) : undefined;
if (hostProfile === null) return refuse(CaptureBootRefusal.HOST_PLATFORM_NOT_SUPPORTED, PLATFORM_NOT_LINUX_OR_DARWIN);
```

- The platform is `deps.host.platform`: the word the entry already hands in through `provideHost`. No member and no door was added to the facts; `capture/__tests__/static.test.ts` (AD-08) is not touched and passes.
- The reason is a fixed word. The platform's own word reaches no log, no error log and no message (tested with fourteen words, `__proto__` and `constructor` among them: the lookup is by own property).
- WHERE IT STANDS IN THE ORDER (driver decision D-3): after 4d. So a host that cannot be seen (`HOST_NOT_SEEN`, platform `not-stated`) is still refused by 4d's own first code `CAPTURE_HOST_CORE_FILE_LIMIT` / `LIMIT_UNREADABLE` (decision C46; pinned at `boot.test.ts:586` and `fence.db.test.ts`), and on a refused platform the Core's own-process checks of 4d refuse first when they fail. Consequence: on a refused platform whose own-process checks pass, the warning `CAPTURE_HOST_PROFILE_NOT_ASKED` is logged, then the refusal.
- The outcome of a production boot that passed states what was found: `CaptureBootOutcome.hostProfile` (optional; absent in the two other operations and for a decision built without host facts).

### The diff of `checks.ts`, hunk by hunk

Start: blob `694846fa` (561 lines), as the brief states it (`git hash-object` at the start of the row). End: blob `dfb1a117` (620 lines). 60 lines added, 1 line replaced.

| # | Where | Lines | What |
|---|---|---|---|
| 1 | header comment, after the paragraph of 4d | +7 | the paragraph of 4d-2 |
| 2 | `CaptureBootRefusal`, before the spread of the host codes | +5 | `HOST_PLATFORM_NOT_SUPPORTED: 'CAPTURE_HOST_PLATFORM_NOT_SUPPORTED'` with its comment |
| 3 | `TEXT`, before the two spreads | +2 | the message of the code |
| 4 | new section before `// ── the step` | +34 | `PRODUCTION_PLATFORMS`, `ProductionPlatform`, `PLATFORM_NOT_LINUX_OR_DARWIN`, `isProductionPlatform`, `HostProfileStatement`, `hostProfileStatementOf` |
| 5 | `CaptureBootOutcome` | +6 | the optional member `hostProfile` |
| 6 | `runCaptureBootChecks`, after the closing brace of the 4d block | +5 | check 4d-2 (blank line, two comment lines, two statements) |
| 7 | the last statement of the function (after check 5) | 1 replaced | `return Object.freeze({ ..., evidenceVolume, ...(hostProfile === undefined ? {} : { hostProfile }) });` |

No condition, statement or catch of checks 4, 4b, 4b-2, 4b-3, 4c, 4d, 4e was changed: hunks 1 to 6 are insertions between existing lines, hunk 7 is the return of the passed outcome. `host-checks.ts` (`a88c6a1a`) and `program-checks.ts` (`ca14fec9`) have an empty diff, as have `fence/boot.ts` and `fence/operation.ts`.

`CS/src/capture/boot/index.ts`: start `2d9b9345` (663 lines), end `5a264525` (688 lines). Five insertions, nothing replaced: four export names (`PLATFORM_NOT_LINUX_OR_DARWIN`, `PRODUCTION_PLATFORMS`, `hostProfileStatementOf`, `isProductionPlatform`) and two types; the member `hostPlatform(): string | null` of `CaptureBootControl` with its comment; its one-line implementation `hostPlatform: () => (provided === null ? null : provided.platform)`; the function `bootHostPlatformOf(app)` (undefined where no boot checks are mounted). The boot step, `provideHost`, `HOST_NOT_SEEN` and the lines the static rule C46 pins are unchanged.

**NEW BASELINE for later rows: `checks.ts` `dfb1a117a0a3f434f7fa27e91521490879ad4779`, `boot/index.ts` `5a264525300ef52408622dba7ef0464bafd3ab44`** (`fence/boot-key.ts` `b920eed4`, `fence/index.ts` `6bebe210`).

## 3. Part (2a): the boot audit entry

Members, verbatim: **`hostPlatform`**, **`hostProfile`**.

| Member | Values | Rule |
|---|---|---|
| `hostPlatform` | `linux`, `darwin`, or null | `SYSTEM_BOOT_HOST_DETAIL_RULES.hostPlatform`, `orNull` in the open rule |
| `hostProfile` | `WILL_BE_ASKED`, `WILL_NOT_BE_ASKED`, `PLATFORM_NOT_SUPPORTED` | `SYSTEM_BOOT_HOST_DETAIL_RULES.hostProfile` (null refused) |

The pattern of V4 item 1 and V5 R-1, followed member for member: the forms in `CS/src/core/audit-details.ts` (`SYSTEM_BOOT_HOST_PLATFORMS`, `SYSTEM_BOOT_HOST_PROFILE_STATES`, `SYSTEM_BOOT_HOST_DETAIL_RULES`, two entries in `SERVER_AUDIT_OPEN_DETAIL_RULES.SYSTEM_BOOT`: 6 -> 8 named members, the type stays open); the writer's side in `CS/src/capture/fence/boot-key.ts` (`SYSTEM_BOOT_HOST_MEMBERS`, `BootHostProfile`, `bootHostStatementOf`, one optional member `hostPlatform` of the statement `systemBootDetailsOf` takes); one member more in the one statement of `fence/index.ts` that builds the details: `hostPlatform: bootHostPlatformOf(app)`. A test holds the fence's codes, the vocabulary's forms and the list of check 4d-2 equal.

**What the fence can know, and what the members therefore say.** The entry is committed by the step `capture.fence`, before `capture.boot` runs (implementation/209). At that moment the fence knows the platform word the entry point handed to the boot checks, and what that word MEANS for the checks that follow - `hostProfileStatementOf`, the function check 4d-2 itself refuses by, of the platform alone. So the members say "on this platform the host profile WILL (NOT) be asked" - never "it was asked", never "it was in place". An entry with `WILL_BE_ASKED` may be followed by a refused start (shown in the database case: the Linux boot row is there and the start is refused at the loopback rule); an entry with `PLATFORM_NOT_SUPPORTED` IS followed by a refused start. This is written in the description of the members in `audit-details.ts`, `boot-key.ts` and the contract example `SYSTEM_BOOT_HOST_DETAILS_EXAMPLE` (`SH/src/api/security-audit.ts`).

- The platform word itself is never written: one of the two words of the closed list, or null.
- **REAL_DEVELOPMENT**: both members ABSENT - the entry is the entry of before, member for member (tested with every platform word handed in). **SIMULATED**: the fence writes no boot entry at all (`BOOT_AUDIT_OPERATIONS`, unchanged).
- A fence without mounted boot checks (a test of the fence alone): both absent.
- The severity of the entry is not changed by the host statement (driver decision D-4).

## 4. Part (2b): the sealed manifest

Member, verbatim: **`hostProfileNotAsked`**, a strict record with the one member **`platform`** of the closed list `MANIFEST_HOST_PROFILE_NOT_ASKED_PLATFORMS = ['darwin']`. Field 133, the second entry of `MANIFEST_V2_OPTIONAL_FIELDS` (`hostProfileNotAsked.platform`); the 128 required fields did not move.

| File | Change |
|---|---|
| `SH/src/evidence-package/manifest.ts` | the schema of the member; `hostProfileNotAsked: ....optional()` in the body; one cross rule (never beside `demo` or an integrity other than `REAL`); field 133 in the optional list; the type |
| `SH/src/evidence-package/build.ts` | left out or `undefined` gives NO key (the rule of `absentOnRestart`) |
| `CS/src/sealing/pipeline/contract.ts` | ONE optional member of `SealSessionFacts`: `hostProfileNotAsked?` |
| `CS/src/sealing/pipeline/pipeline.ts` | `liveInput`: `...(session.hostProfileNotAsked === undefined ? {} : { hostProfileNotAsked: { platform } })` - part of the frozen input of BUILD_MANIFEST |
| `CS/src/sealing-host/session-reader.ts` | NEW `hostProfileNotAskedOf(found)`; one option `hostProfileNotAsked?: () => ... | null`; the facts carry the member only when there is one |
| `CS/src/sealing-host/index.ts` | ONE line: `hostProfileNotAsked: () => hostProfileNotAskedOf(captureBootControl(app).outcome()?.hostProfile)` (pinned by a test) |

**What it states.** The Core that SEALED the package (built the manifest) is a production Core on a platform where its host profile is not asked - what THAT Core's boot checks found (`outcome().hostProfile`, `asked` false). It is the sealing Core's statement, read at every seal; a session recorded under one boot and sealed under a later one states the later boot (the same host, so the same platform; each boot is in the audit chain by its own `SYSTEM_BOOT` entry).

- **ABSENT** when the profile was asked (production on Linux), when none is asked by design (REAL_DEVELOPMENT: the outcome has no `hostProfile`), and in every package sealed before. SIMULATED mounts no sealing host.
- `linux` can never be stated: the schema refuses it (V-01 FAIL when written in by hand).
- "Not asked" on a platform the manifest has no word for THROWS in the reader (fail closed: the seal does not sign "nothing to state"). Not reachable while the two lists agree; a test holds them equal.
- **Acceptance:** the Core's verify, the export and the receiver's verify are schema-driven; no line of them names the member. NOTHING CHANGES WHAT AN EXISTING PACKAGE VERIFIES AS: the member is optional, the example manifest parses to itself with the same bytes, digest and V-01 verdict.
- No contract schema changed (the manifest is not an OpenAPI schema; the new example is a constant): `openapi.json` was NOT regenerated.

## 5. THE BYTE-IDENTITY PROOF (a manifest without the member = a manifest sealed on Linux)

Instrument: `.cache/task4-rowp1/identity.test.ts` and `vitest.config.ts` (in no commit) - row 191c's instrument under this row's label: the PRODUCT pipeline seals the two fixture sessions of `sealing/__tests__/pipeline-support.ts`; `randomBytes` and the Ed25519 pair of the throw-away signer are a function of their call order, so two processes seal the same bytes. Synthetic values, removed with the temporary directories.

Run twice BEFORE any edit of `packages/shared`, `sealing` or `sealing-host` (only `checks.ts` was edited by then, which the seal does not import), once AFTER the last edit:

```
fixture "switch"        session-manifest.json 10582 bytes
  before   c00b8981bbc903861d088f47fd48a9a191165b55d08609c0724d1ad95381345d
  before2  c00b8981bbc903861d088f47fd48a9a191165b55d08609c0724d1ad95381345d
  after    c00b8981bbc903861d088f47fd48a9a191165b55d08609c0724d1ad95381345d
fixture "one-interval"  session-manifest.json 10444 bytes
  before   13778fc46ffef2e522235690e48fa9367608621fbc4f9c88f9a367ccd004c9c2
  before2  13778fc46ffef2e522235690e48fa9367608621fbc4f9c88f9a367ccd004c9c2
  after    13778fc46ffef2e522235690e48fa9367608621fbc4f9c88f9a367ccd004c9c2
cmp before.*.manifest.json after.*.manifest.json : identical, both fixtures
cmp before.*.signature     after.*.signature     : identical, both fixtures
grep -c hostProfileNotAsked after.*.manifest.json : 0, 0
```

Beside it, in the committed suites: `pipeline.test.ts` - the same recording sealed with the member absent twice gives equal bytes that do not name the member; the control - with the member the bytes differ by exactly the length of `"hostProfileNotAsked":{"platform":"darwin"},`. `evidence-package.test.ts` - `undefined` handed in seals the same bytes and digest as the example.

## 6. The proof on this Mac's platform, and the checks

**One sealed session on `darwin`: verify PASS, export, receiver verify PASS.**

| Step | Where | Result |
|---|---|---|
| the Core's verify | `pipeline.test.ts`, case "row P1: a session a production Core seals on macOS" | `ok` true, `PASS`, all 15 checks; member removed from the file: not ok, V-03 not passing; `linux` in its place: V-01 not passing |
| export + receiver's verify | `export-one-camera.test.ts`, case "row P1" | PACKAGE exported; the received manifest equals the sealed one byte for byte and holds the member; receiver's verify `ok` true, no failing check |
| THROUGH THE REAL BOOT | `production-key-proof.db.test.ts`, PROOF 1 + 3 | the real app in REAL_PRODUCTION on a clone, the test host (`darwin`): `outcome().hostProfile` = `{ platform: 'darwin', asked: false }`; the product's `hostProfileNotAskedOf` of it = `{ platform: 'darwin' }`; the seal with the PRODUCTION key and all-production sources writes the member; every check PASS against the printed fingerprint |

What stays between the two halves of the last row: the one line of `sealing-host/index.ts` that joins them, held by a text pin (no product path records a production session on doubles before the class-C lift, as row 208 states).

**Each platform through the test host, on PostgreSQL** (`fence.db.test.ts`, case "row P1", the capture unit's own mount, the real app):

| Platform handed in | Start | Log codes | `SYSTEM_BOOT` entry |
|---|---|---|---|
| REAL_DEVELOPMENT, `freebsd` | passes | `CAPTURE_BOOT_CHECKS_PASSED` | neither member; outcome without `hostProfile` |
| `darwin` (the test host as it is) | passes | `CAPTURE_HOST_PROFILE_NOT_ASKED`, `CAPTURE_PROGRAM_CHECKS_PASSED`, `CAPTURE_BOOT_CHECKS_PASSED` | `darwin`, `WILL_NOT_BE_ASKED` |
| `linux` (the runner starts nothing) | ASKED: refused `CAPTURE_HOST_LOOPBACK_RULE_MISSING` / `HOST_COMMAND_NOT_STARTED`; the one question asked is `/usr/bin/systemctl is-active dems-loopback-rule.service` | `CAPTURE_HOST_LOOPBACK_RULE_MISSING` | `linux`, `WILL_BE_ASKED` |
| `freebsd` | refused `CAPTURE_HOST_PLATFORM_NOT_SUPPORTED` / `PLATFORM_NOT_LINUX_OR_DARWIN`; no program started | `CAPTURE_HOST_PROFILE_NOT_ASKED`, `CAPTURE_HOST_PLATFORM_NOT_SUPPORTED` | null, `PLATFORM_NOT_SUPPORTED`; the word `freebsd` in neither the row nor the log |

Four boot entries for four boots. A Linux start that PASSES is the unit double (`checks.test.ts`: every question answered, `hostProfile` = `{ platform: 'linux', asked: true }`).

### Checks

From `CS` unless said; `--maxWorkers=2`; database and process runs with the command sandbox off, database runs under `.locks/db-migrate.lock`.

| Check | Result line |
|---|---|
| boot + fence + writers unit (after part 1 and 2a) | `Test Files  12 passed (12)`, `Tests  504 passed (504)` (first run: 2 failed - the two pins this row moves, section 7) |
| static set + unit suites of every touched area (`test/static`, `capture/__tests__/static`, `adapters/__tests__/static`, `core/__tests__`, `engine/__tests__/static`, `capture/boot`, `capture/fence`, `sealing`, `sealing-host`, `evidence-verify`, `evidence-export`, `sign-time-guard`) | `Test Files  88 passed (88)`, `Tests  1729 passed (1729)` |
| `SH`: `evidence-package`, `evidence-verify`, `evidence-transcript-states` | `Test Files  3 passed (3)`, `Tests  218 passed (218)` |
| `SH`: the package's unit files (run once, after the last shared edit) | `Test Files  105 passed (105)`, `Tests  2884 passed (2884)` |
| database: `fence.db.test.ts` | run 1 `6 failed | 43 passed (49)` (the boot-row pin of this row, section 7); run 2 `1 failed | 48 passed (49)` - the one is NOT this row's (below); `0 remain` |
| database: `capture-composition`, `production-key-proof`, `capture-config`, `source-class`, `operator-set-password`, `last-resort`, `stt-states`, `finalize-transcript`, `export-trust-list` | `Test Files  3 failed | 6 passed (9)`, `Tests  3 failed | 101 passed (104)` - the three are NOT this row's (below); `0 remain` |
| database: `production-key-proof.db.test.ts` after its extension | `Tests  1 failed | 3 passed (4)` - the one is the same pin; `0 remain` |
| byte identity (section 5) | 3 runs, `Tests  1 passed (1)` each; `cmp` identical |
| typecheck: `SH`, `CS`, `apps/core-web`, `apps/mobile`, `apps/mock-core`, `apps/transcriber` | 0 lines in each at the end. Two earlier runs of `CS` showed lines in `src/capture-session/index.ts` and then `src/capture-composition.ts` (another row editing; none in a file of this row), gone at the last run |
| oxlint over the touched folders | no line in a file of this row |

**Red seen, not this row's, files not edited:** the pin "schema version 12, contract dbc-13" answers `[13, 'dbc-14']` at `src/capture/fence/__tests__/fence.db.test.ts:170`, `src/sealing/__tests__/production-key-proof.db.test.ts:243`, `src/sealing/__tests__/last-resort.db.test.ts:135`, `src/sealing/__tests__/stt-states.db.test.ts:115`. The schema moved while this row ran (the first run of `fence.db.test.ts` passed that case, the second did not). Request line 2.

Deviation from the driver rules, stated: the unit files of `packages/shared` were run as a whole once (24 s) instead of by name - this row is the package's single writer in the wave.

## 7. Tests added and pins moved

New cases, each in the file of its subject: `checks.test.ts` +2 (4d-2 on fourteen refused words, the order, the outcome; the two other operations unchanged); `fence.test.ts` +1 (the host statement, the three meanings held equal); `writers.test.ts` extended in its `SYSTEM_BOOT` case (three accepted rows, the contract example, eight refused values); `fence.db.test.ts` +1 (section 6); `evidence-package.test.ts` +3 (absent = unchanged; present = accepted and signed; what is refused); `pipeline.test.ts` +3 (verify with two controls; no key = same bytes; frozen with the build); `sealing-host.test.ts` +2; `export-one-camera.test.ts` +1; `production-key-proof.db.test.ts` PROOF 1 + 3 extended.

Pins moved, by delta, each with its comment: the open rule of `SYSTEM_BOOT` 6 -> 8 members (`writers.test.ts`); the import lines of `boot-key.ts` and the text of the one details statement (`fence.test.ts`); the optional manifest fields 4 -> 5 (`evidence-package.test.ts`); `bootRowOf` of `fence.db.test.ts` (a production boot row of that file's host carries the two members; a development row does not). No count of operations, audit types, permissions or schema moved.

## 8. Driver decisions (for the controller)

| # | Decision | Why |
|---|---|---|
| D-1 | `CS/test/support/capture-host.ts`: `TEST_HOST_PLATFORM` `'test-host'` -> `'darwin'` (one word and its comment). NOT in the row's ownership list | the brief assumes the production suites run as `darwin`; the test host stated the invented word `test-host`, which check 4d-2 refuses - every suite that boots REAL_PRODUCTION would have gone red. A fixed word, not `process.platform`: on a Linux machine the suite still boots the Mac case with a runner that starts nothing. No product code admits a test word |
| D-2 | `CS/src/sealing-host/session-reader.ts` and `index.ts` were edited (one function, one option, one line) although the ownership list names `src/sealing` | the seal is a closed unit behind ports; the fact has no other way from the boot outcome to the manifest. Row 191c took the same file for the same reason |
| D-3 | check 4d-2 stands AFTER 4d, not before it | keeps decision C46 by its letter (an unseen host is `CAPTURE_HOST_CORE_FILE_LIMIT`) and the order "an earlier refusal is the one said". The other reading - the platform first - would rename the refusal of an unseen host |
| D-4 | the host statement does not raise the severity of the boot entry; a Mac production boot stays INFO unless the signer store changed | not asked for; a WARNING on every boot of the allowed Mac would bury the rotation warnings of V5. The fact is in the members |
| D-5 | the manifest member's platform list is closed (`darwin`) and the Core's reader throws for "not asked" elsewhere; the member is refused beside a demo package; it is NOT tied to `developmentSources` | a closed list is the strict side for a verifier; a rule on `developmentSources` could fail a production seal on an edge nobody has proven impossible, and a seal that fails is worse than a rule not stated |

Also for the controller: the verification report and the clients do not SHOW field 133 (request line 3) - the verifier accepts it and the signature covers it, and that is all.

## 9. Not built, not proven

| What | Where it goes |
|---|---|
| A production start on a real Linux host: the whole profile asked, `asked: true`, no manifest member | `9A/H-01`, `9A/H-04`; request line 4 |
| A production session RECORDED and sealed by the running product on this Mac | after the class-C lift (row 88); the seal half is proven from the pipeline's session port, the boot half through the real app |
| The member shown in a verdict, an export manifest or a screen | request line 3 |
| README / installer note: what a Mac does not check | request line 1 (the document row) |
| A receiver's verifier that predates the member | refuses a package that carries it (strict), as with fields 129-132 |

## 10. Rules kept

Edit tool only for every existing file (nine product files, nine test files, one test-support file, two shared documents); new files with Write (this record, `row_p1.md`); the two files of the identity instrument under `.cache/task4-rowp1/` were made as copies of row 191c's instrument by a shell command (new files, in no commit). Nothing committed, staged or reverted. Throw-away databases only, each run under `.locks/db-migrate.lock`, `0 remain` after each; the heavy-host lock was not needed (no worker, relay, container or port). Keys only through `realBootFixture` and the suites' own fixtures; none under `.data/`; no `.env` read; no real device contacted. NOT touched: `boot/host-checks.ts`, `boot/program-checks.ts`, `fence/boot.ts`, `fence/operation.ts`, `capture/index.ts`, `src/index.ts`, `capture/__tests__/static.test.ts`, `mic-helper-args.ts`, any schema, `openapi.json`.

---
*Generated: 2026-10-13*
