---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
date: 2026-10-22
agent: verifier
row: 116
type: verification (R-FLEX against masterplan/01_specs_rflex.md)
narrative_tier: 3 (checks), 2 (findings)
verdict: CAUTION
blocking_findings: 0
---

# R-FLEX verification (row 116)

## 1. Verification scope

| Item | Value |
|---|---|
| Spec | `masterplan/01_specs_rflex.md` (row 95). It defines exactly RF-A1..RF-A6, RF-N1..RF-N9 and RF-P1..RF-P3 (spec :47-74). No extra or missing ids. |
| Decisions | `decisions/decisions.md` D10, D11, D16 (with `decisions/02_rflex_decision_sheet.md`), D18-D28; D32 (row 142) exists only in the host copy (`ssh dems`, `decisions.md:50`) |
| Change set | `rflex-only.diff` (72 files). `sha256sum rflex-only.diff` -> `ff0adfca6570fbf88d6668638225a0c9fd41966941e58bec3e3fe4c37805370d` (matches the brief) |
| Code read | Read-only snapshot `C:\Users\TRIAL\dems-review-snapshot` (HEAD `e05a1567`, R-FLEX uncommitted). The snapshot equals the live host for all 72 files: `xargs sha256sum < rflex-files.txt` locally and over `ssh dems` -> 72 lines each, `diff` -> no difference |
| Test evidence | Not run by this row: no `node_modules` in the snapshot, local Node v24.18.0 is outside the engine range `>=26.8.2 <27`, and the brief forbids suites on the host. Results are read from the host run logs in `docs/.../test/04_rflex_regression_logs/` (`h_s*` 18:42-19:03, `r_s*` 19:16-19:36, JSON reports) and the row reports `implementation/50-87_*.md` |
| Not read | `.data/`, `*.env`, signer and credential files (brief). Effect: the `SHA256SUMS` part of RF-P2 is not checked |

Requirement labels: PASS = the code meets it and a passing test pins it. PARTIAL = part of the acceptance is still open or not evidenced. Bench HIL items (rows 66-69, 125-127, 90 AC-8) belong to later rows. They are listed but do not count against code PASS.

## 2. Checks summary

| Check | Result | Evidence |
|---|---|---|
| Intent alignment (18 requirements) | 14 PASS, 4 PARTIAL, 0 FAIL | Section 3 |
| Syntax / types | PASS for R-FLEX workspaces | host `h_s1_typecheck.log`: `@dems/shared`, `@dems/core-server`, `@dems/core-web` with no `error TS`. The one error, `apps/mobile src/runtime/live-stall-link.test.ts(28,12) TS2339`, is in `apps/mobile`. No mobile file is in `rflex-files.txt`. Lint: `h_s2_lint.log.meta rc=0`, "0 errors" |
| Logic | PASS, with LOW observations F-4, F-6, F-7 | Section 3 and section 6 |
| Integration | PASS for contract/openapi/web; PARTIAL for the booted-composition DB cases on the host | `contract.test.ts` 44/44, `capture-composition.test.ts` 80/80 (host `r_s4` JSON). `capture-composition.db.test.ts` 5 fail on the host. The cause is `DEMS_CAPTURE_WORKER` (an environment problem, F-3) |
| Regression (R-FLEX test files, host run) | PASS except `ws-discovery.test.ts` 2 flood cases. The cause of those 2 is not yet known (F-2) | Section 3 and section 6 |
| Rollback dry-run | PASS | `patch -R -E -p1 --dry-run < rflex-only.diff`. On the snapshot: 72 `checking file`, 0 fail/reject. On the host (diff fed over stdin): `rc=0`, 72 files, 0 fail/reject/hunk lines |

## 3. Requirements

### 3.1 D10 ruling 1, audio

| Req | Verdict | Code evidence | Tests that pin it (host run unless noted) |
|---|---|---|---|
| RF-A1 no port lock | PASS (bench H-3 pending, row 127) | Adapter matcher: no serial stored -> any serial-less unit of the model, port not compared, `usb-audio-production.ts:359-364`. `PORT_DIFFERS`/`IDENTITY_NOT_STORED` removed from `CardMismatch` (`:284-292`). Registration matcher `service.ts:452-469` (`twin` at `:468`). `grep -rn PORT_DIFFERS apps packages` -> only a comment at `service.ts:406`. `grep -c PORT_DIFFERS` on both matcher test files and on the shared case table -> 0, 0, 0 (88 T-1) | T-1 shared table `test/support/stored-card-identity-cases.ts`, used by `usb-audio-production.test.ts:54,710` ("T-1 shared case: %s") and `service.test.ts:667`. T-2 `usb-audio-production.test.ts:565` (BOMGE port move opens). T-3 `macos-card-listing.test.ts:865`. T-4 `mic-loss.test.ts:269` (CARD_ABSENT then RETURNED, no CARD_CHANGED). Results: usb-audio-production 62/62, macos-card-listing 44/44, mic-loss 28/28, service 35/35 |
| RF-A2 a bound card is exclusive | PASS (H-1 pending, row 125) | Holders = live rows of the USB id that hold this physical card, `service.ts:560-562`. Refusal 409 with `details.deviceId` = holder, `service.ts:218-219,595`. DB-A2 `READ_BOUND_AUDIO_INPUTS ... WHERE i.usb_id = $1 AND i.retired_at IS NULL ORDER BY i.device_id`, `statements.ts:77-82`. No DB index (RF-P3). Op 98 `boundTo` `service.ts:322-328`; contract `capture-audio-cards.ts:167` (required, nullable). Web: only the holder's input is offered, `audio-cards.ts:223-227` | T-9/T-10 `routes.db.test.ts:536`. T-11 `routes.db.test.ts:686-687` (exactly one 201 and one live row). Retired row `service.test.ts:619`. X-2 `service.test.ts:645`. T-15 web `audio-cards.test.tsx:95,407`. Results: audio-cards routes.db 25/25 (`r_s5` JSON), audio-cards.test.tsx 14/14 (`h_s6`) |
| RF-A3 a re-bind releases the old binding (bundle M + selector move) | PASS (H-2 pending, row 126) | `release: true` moves the holder: `RELEASED` (old input) `service.ts:603`, `rekeyInput` `:604`, `REENABLED` at the new input, answer `releasedDeviceId` = holder `:609`. `REKEY_AUDIO_INPUT` writes only live rows, `statements.ts:95-97`. Session open -> locked `service.ts:538`. Selector: one op 78 edit `{unassign:[from], mics:[line]}`, `capture-selector.ts:253` and `:449`. The other line's mic is an enabled option (the `isDisabled={other...}` prop was removed, `capture-selector-panel.tsx` diff). Server judges "held" after the `unassign`, `routes.ts:407-408` (D19) | T-10 `routes.db.test.ts:536`. T-12 `routes.db.test.ts:660-680` (session open: 409 `CAPTURE_CONFIG_LOCKED`, holder not moved). T-13 `capture-config.db.test.ts:990` (SIMULATED case; not in the host failure list, so it passed). T-14 `selector-microphones.test.tsx:200,314` (32/32, `h_s6`). Rollback on a failed move `service.test.ts:439` |
| RF-A4 a port move is not a re-bind | PASS (H-3 pending) | `portMove` = SAME_CARD at the same device index and input under another key, `service.ts:593`. No `release` needed, no `RELEASED` audit (`:603`), `releasedDeviceId` null (`:609`) | T-6/T-7/T-8 `routes.db.test.ts:497,517` (200 REENABLED, card_id/usb_port follow, live row count unchanged, 1 audit). `service.test.ts:506,519` |
| RF-A5 two identical serial-less cards | PASS (bench test excluded by U-RF5) | Adapter: `CARD_AMBIGUOUS`/`MODEL_SHARED`, `usb-audio-production.ts:363`. Registration: `NOT_TELLABLE`, `service.ts:468-469`. The holder holds both units, `holdsCard` `service.ts:478-483`. Web: `isAmbiguous`, nothing offered, `audio-cards.ts:212-221`, text W-A8 `common.ts:1058` | T-5 `usb-audio-production.test.ts:580`. `mic-loss.test.ts:286` (CARD_UNDECIDED, 0 faults). `service.test.ts:547`. `audio-cards.test.tsx:437`. See F-4 for a release case no test covers |
| RF-A6 every change audited, no device identity in audit, closed lists equal | PASS | `CAPTURE_AUDIO_INPUT_CHANGES = ['REGISTERED','CARD_CHANGED','REENABLED','RELEASED']` `audit-details.ts:207`. Shared `CaptureAudioInputChange` `capture-audio-cards.ts:99`. Op 99 answer enum stays 3 values `capture-audio-cards.ts:211`. Audit details carry deviceId, change, inputNumber, channelCount and permission only (`service.ts:550`) | `writers.test.ts:357,1217-1221` (161/161). `api-capture-discovery.test.ts:789-794` (`RELEASED` refused in the answer). Shared suite 2929/2929 (`h_s3`) |

### 3.2 D10 ruling 2, network

| Req | Verdict | Code evidence | Tests |
|---|---|---|---|
| RF-N1 connection is global | PASS (bench AC-8 pending) | TP/SC go through `decideGlobal` before the point-2 path, `destination-rule.ts:431`. `decideGlobal` is at `:465-489`. Source = on-link candidate, `viaAlias: false` `:488`. Builder B1 fills `interfaceSubnets` for eligible addresses, `network/facts.ts:165-167,196`. Fence bindings `production-parts.ts` (comment-only diff: every changed line is a comment, checked with grep) | `destination-rule.test.ts:303-342` (RM-N1..N4 lifted per purpose; 90 AC-1 at `:342`), 195/195. `stored-address.test.ts:29` (13/13). `connect/__tests__/service.test.ts:780,819` (32/32). The booted-composition case I-9a (`capture-composition.db.test.ts`) cannot boot on the host (F-3) |
| RF-N2 discovery is global, bound 4, typed source first | PASS (rows 66-69 interfaceCount pending) | `selectInterfaces(table, sourceAddress)` puts the source first and slices to `DISCOVERY_MAX_INTERFACES`, `discovery-collector.ts:68,85-86`. `DISCOVERY_MAX_INTERFACES = 4` `:32`. Caller `ws-discovery.ts:190`. The HOST-23 rule stays on the camera port: `40-network-firewall.sh:90` is unchanged | AC-6 `ws-discovery.test.ts:600`. `discovery-collector.test.ts:58` (20/20). `ws-discovery.test.ts` overall 32 passed and 2 failed; the 2 failures are flood cases, not the AC-6 case (F-2) |
| RF-N3 network config optional for global purposes | PASS | `networkFactsOf` gives a context for no row and for a partial row; ports default to `[80]`, `network/facts.ts:174-178`. Unknown (not loaded) stays null, `network/index.ts:204`. AC-4: `grep -c COMMISSIONING_NOT_CONFIGURED .../connect/service.ts` -> `0`. Every refusal is `CANDIDATE_NOT_TESTABLE`, `connect/service.ts:377`. W-N3 removed: `grep networkNotConfigured` in `packages/shared/src` and `apps/core-web/src` -> 0 hits. Alias helper still needs a subnet: `host-alias/facts.ts:68` (row 141) | `network/__tests__/service.test.ts:147` (AC-5: `networkFactsOf(null, HOST)?.allowedPorts` toEqual `[80]`), 37/37. `lifecycle.test.ts:1012` (100/100). `camera-connect.test.tsx` 19/19 (the only `COMMISSIONING_NOT_CONFIGURED` left there, `:51-52`, asserts it now maps to `'OTHER'`) |
| RF-N4 residual guards kept (RG-1..RG-14, Q96-05 a) | PASS (posture confirmed at row 117) | Class first (D-102-1, D20), host address `destination-rule.ts:470`, edges, port list, alias never a source `:393`. Set-IP stays bound (point-2 path `:433-456`). RG-14 is host-side: HOST-20/24 kept in `HOST-PROFILE-UBUNTU-24.04.md` (HOST-24 wording tightened) | `destination-rule.test.ts:410-482` (RG-1..RG-11 per purpose on the non-camera interface, RG-8 set-IP, RG-9 AD-02 loopback) |
| RF-N5 on-link only (Q96-06 a) | PASS | `if (holding.length === 0) return refuse(NO_SOURCE_INTERFACE)` `destination-rule.ts:474`. No gateway path exists | `destination-rule.test.ts:353` (NW-R1 per purpose, RG-12) |
| RF-N6 ambiguous source refused (Q96-10) | PASS | Two different interface names at the longest prefix -> `SOURCE_INTERFACE_AMBIGUOUS`, camera interface included, `destination-rule.ts:478` | `destination-rule.test.ts:363` |
| RF-N7 fail-closed kept | PASS | `globalFactsOf` returns null when `interfaceSubnets` is absent or malformed -> `NOT_CONFIGURED`, `destination-rule.ts:363-366,468` | `destination-rule.test.ts:390`. `network/__tests__/service.test.ts:127`. `connect/__tests__/service.test.ts:755` |
| RF-N8 form check survives | PASS | `FORM_ACCEPTED = 'NO_CAMERA_SOURCE'`, now asked of the SET_IP binding `SET_IP_RULE = cameraNetworkDialRuleOf()`, `network/facts.ts:217-224` | "the forms of a write" `network/__tests__/service.test.ts:270-300`. The diff of that block changes only the fixture `mac: ETH1_MAC` (diff hunk `@@ -218,7 +293,7 @@`); the assertions are unchanged. 37/37 |
| RF-N9 host documents say "host hygiene" | PARTIAL | HOST-19/23/24/46 reworded; the HOST-23 rule `act ufw allow in on "$HP_CAMERA_INTERFACE" proto udp from any port 3702` is unchanged (`40-network-firewall.sh:90`). New count pin `test_host_profile_scripts.sh:235-236` (`grep -c 'would-run: ufw allow'` = 1) | Host `h_s8_host_script.log:134` "ok one firewall rule is printed, the search-answer rule on the camera port (U-RF3)", "RESULT: 141 passed, 0 failed". Open: shellcheck was not run (`h_s8_host_script.log:151` "SKIPPED shellcheck is not installed"; D17), which is one of the acceptance criteria (F-8) |

### 3.3 D10 ruling 3, code first

| Req | Verdict | Evidence |
|---|---|---|
| RF-P1 code, tests and gates before the install | PARTIAL (open by design) | Row 20 not started: host `status_tasks.md` last rows say the D30 shims "must be removed before row 20". Rows 115 (no report yet), 116 (this file), 117/118 and gate 119 are still open. The temporary `/usr/bin/lockf` shim and the `/usr/sbin/lsof` symlink (host `status_tasks.md`, D30) must be removed before row 20 |
| RF-P2 rollback path before the commit | PARTIAL | Reverse dry-run passes on the snapshot and on the host (section 2). The diff hash matches the brief. D21: `grep -c DeviceHealth` on the openapi part of the diff -> 0, so the reverse patch keeps the task-4 schema. Not checked: `SHA256SUMS` "4 x OK" inside the restore folder under `.data/` (outside this row's read scope). See F-5 for two non-R-FLEX changes inside the diff |
| RF-P3 no DB migration | PASS | `git diff --stat HEAD -- apps/core-server/src/db/` -> empty. `_journal.json` 34 `"idx"` entries, last tag `0033_capture_device_retirement_privileges`. 34 `*.sql`. `schema/meta.ts:121` `DB_SCHEMA_VERSION = 15`, `:123` `DB_CONTRACT_REVISION = 'dbc-16'`. Row 98 N/A record `implementation/50_rflex_migration.md:1,9,11` |

## 4. File list check (72 files of `rflex-files.txt` against `delegation_progress/file_claims.md`, rows 98-114 and 129-138)

Method: a script compared each changed path with the claim paths of rows 98-114 and 129-138 (glob match).

### 4.1 Changed but not claimed by rows 98-114 / 129-138 (5)

| File | Owner | Status |
|---|---|---|
| `apps/core-server/src/capture/adapters/audio/__tests__/card-listing.test.ts` | controller fix row (row 142) | Unclaimed in `file_claims.md` (snapshot and host). Recorded in host `decisions.md:50` D32 (c) and host `implementation/88_row142_regression_fix.md`. Judged faithful (4.3) |
| `apps/core-server/src/capture/adapters/audio/__tests__/usb-audio-macos.test.ts` | controller fix row (row 142) | Same |
| `apps/core-server/src/capture/host-alias/facts.ts` | row 141 (claimed, `file_claims.md:106`) | Outside the named range; claimed and recorded (D23, `85_rflex_host_alias_null_subnet.md`) |
| `apps/core-server/src/capture/host-alias/__tests__/lifecycle.test.ts` | row 141 (`file_claims.md:107`) | Same |
| `apps/core-web/src/runtime/testing/live-harness.ts` | row 139 (`file_claims.md:132`) | Claimed. This is the task-4 LCD test-bed fix (D27), not R-FLEX behaviour (F-5) |

### 4.2 Claimed but unchanged (21). Every one is accounted for in its row report

| Claim (row) | Report evidence |
|---|---|
| `packages/shared/src/api/examples.ts`, `src/api/index.ts`, `src/sim/capture-registry.ts` (99) | `51_rflex_shared_api.md`: "Not changed (no change needed)" |
| `camera-watch.test.ts`, `onvif-relay.test.ts` (103) | `55_rflex_camera_adapters.md`: "No edit needed" |
| `capture-discovery/__tests__/search.test.ts`, `capture-discovery.db.test.ts` (104) | `56_rflex_capture_discovery.md`: "No change needed" |
| `db/fixtures/__tests__/audit-details.test.ts` (129) | `75_rflex_audit_vocabulary.md`: "no change needed (no pin on the change list); run green" 35/35 |
| `selector-reader-inventory.test.ts`, `engine/__tests__/readdress-door.db.test.ts` (130, "pin") | `76_rflex_audio_statements.md`: "neither names `CAPTURE_AUDIO_CARD_WRITES`", 12/12 and 5/5. Confirmed: `grep -rn CAPTURE_AUDIO_CARD_WRITES src test` -> no test hit |
| `capture-config/__tests__/e2e/first-full-session.db.test.ts` (131) | `77_rflex_audio_listing.md`: "asserts no op-98 card object". Its 1 red (`r89_door_late`) is unattributed in D24; host `r_s5` shows 1 failure in this file |
| `adapters/__tests__/real.test.ts` (107, "if needed") | `59_rflex_audio_identity.md`: "names no port rule; not edited" |
| `capture/__tests__/static.test.ts`, `capture-config/__tests__/static.test.ts`, `capture-discovery/__tests__/static.test.ts`, `test/static/*.test.ts` (110) | `62_rflex_static_pins.md`: unchanged. The 4 red cases are the task-4 failures accepted in D28. Host `r_s4`: `static.test.ts` 4 failed (same count) |
| `capture-selector.test.tsx` (133, "if needed") | `79_rflex_web_selector.md`: "not edited (passes unchanged)". Host `h_s6` 13/13 |
| `i18n.test.ts`, `i18n-vocabulary-sync.test.ts` (101, "only if pin") | `53_rflex_i18n.md`: 55 pass, not edited |
| `api-capture-commissioning.test.ts`, `api-text-rule.test.ts` (137, "if needed") | `83_rflex_shared_network_texts.md`: "Test files not edited", 37/37 |

Two-writer files (claims by several rows, sequenced by D18/D24): `audio-cards/service.ts` (108, 129, 131), `store.ts` (108, 130, 131), `statements.ts` (108, 130), audio-cards `fixtures.ts`/`routes.db.test.ts`/`service.test.ts` (108, 131), `capture-composition.db.test.ts` (109, 136), `capture-audio-cards.ts` and `api-capture-discovery.test.ts` (99, 129), `common.ts` (101, 135), `selector-microphones.test.tsx` (133, 139).

### 4.3 Row 142 controller fix: is it faithful to the spec?

| Fix | Judgement | Evidence |
|---|---|---|
| `card-listing.test.ts:118` `asAnswer` gains `boundTo: null` | Faithful. `boundTo` is a required nullable member (`capture-audio-cards.ts:167-171`, no `.optional()`). `null` with `registered: []` is what the member's description prescribes. Test-only change | Diff: 1+/1-. Host `r_s4` JSON: `card-listing.test.ts` 49 passed |
| `usb-audio-macos.test.ts:783` not-present MIC-02 becomes `product: 0x0016` | Faithful to D10(1)/RF-A1. Under the new rule a serial-less unit of the same model on another socket is the stored card. The test's "not present" intent therefore needs another USB id: the rig derives `usbId` from vendor:product (`usb-audio-macos.test.ts:149-152`), so `1a2b:0016` is not `1a2b:0006` (`:85`). The socket-move case now appears as "present" in `macos-card-listing.test.ts:865` | Diff: 3+/1-. Host `r_s4` JSON: `usb-audio-macos.test.ts` 27 passed. Host `88_row142_regression_fix.md`: audio folder 345/345 |

## 5. Decision conformance

| Decision | Choice the code must reflect | Verdict | Evidence |
|---|---|---|---|
| D10 (1) | No port lock; card exclusive; re-bind releases | PASS | RF-A1..A4 |
| D10 (2) | ONVIF "Global penuh" for search and connection | PASS | RF-N1, RF-N2 |
| D10 (3) | Code before the install | PARTIAL (in progress) | RF-P1 |
| D11 | Risk accepted; a security-review row with the residual guards | PASS in code; posture is for row 117 | RG tests `destination-rule.test.ts:410-482`. `verification/06_rflex_security.md` exists in the snapshot (not reviewed here) |
| Q96-01 a | Physical card is the unit | PASS | Holders by USB id and identity across all inputs `service.ts:560`. T-9 `routes.db.test.ts:536` |
| Q96-02 a + Q96-02-M bundle M | Op 99 moves the holder; selector move clears the old line | PASS | `service.ts:603-609`, `capture-selector.ts:253`, `routes.ts:407-408`. No `RELEASE_AUDIO_INPUT` (DB-A7): `grep` finds it in no code file. No `devices.micLines.released` (W-A9) in `devices.ts` |
| Q96-04 a | Scan/set-IP bound | PASS | `GLOBAL_PURPOSES` holds only TP/SC (`destination-rule.ts:431`). RG-8 test. `host-alias/facts.ts:68` |
| Q96-05 a | All RG-1..RG-14 kept | PASS | RF-N4 |
| Q96-06 a | On-link only | PASS | `destination-rule.ts:474` |
| Q96-09 a | Port kept as information; no-serial-no-port rows read as "no serial" | PASS | `usb-audio-production.ts:359`. DB-A2 no longer filters such rows (`statements.ts:72-82`, D24). `service.test.ts:570,606`. `usb_port` still written (`service.ts` `facts`) |
| Q96-10 | Overlap always refused | PASS | `destination-rule.ts:478` |
| Q96-13 | Bound 4, typed source first | PASS | `discovery-collector.ts:85-86` |
| Q96-15 a | `interfaceCount` only | PASS | `capture-discovery.ts:258` "a count, never a name or an address". The R-FLEX diff of that file changes two description sentences only and adds no member |
| D18 | `release` optional, not `default(false)`; release answer 200 REENABLED, `releasedDeviceId` = `deviceId` | PASS | `capture-audio-cards.ts:196-199`, `service.ts:609` |
| D26 known limit | X-2 order = lowest MIC id only | Conforms (limit stands) | `statements.ts:82` `ORDER BY i.device_id`, `service.ts:599` `everyHolder[0]`. Test `service.test.ts:645`. See F-7 |

## 6. Findings

| Id | Severity | Finding | Evidence | Owning row |
|---|---|---|---|---|
| F-1 | NON-BLOCKING (closed) | Row 107 reported done (usb-audio-production 62/62, macos-card-listing 44/44, mic-loss 28/28) but did not run `card-listing.test.ts` or `usb-audio-macos.test.ts`, which it broke (23 red). Row 142 fixed it faithfully (4.3) | host `88_row142_regression_fix.md` "Tests 23 failed" before, 345/345 after. Snapshot `status_tasks.md` row-107 line | 107 (closed by 142) |
| F-2 | NON-BLOCKING, attribution open | `ws-discovery.test.ts` has 2 failures on the host: "FLOOD_300 ... Test timed out in 5000ms" and "expected 184 to be greater than or equal to 256" (`:241`). The file is in the R-FLEX set, but the failing cases are flood/timing cases. The R-FLEX change to `ws-discovery.ts` is only the interface ordering (`:190`). Hypothesis: load or timing, not R-FLEX. It becomes BLOCKING if the pre-R-FLEX baseline (D32 b) passes them | host `r_s4_core_unit.json` | 115 (attribution), 103 |
| F-3 | NON-BLOCKING (environment, evidence gap) | On the host, every case that boots a production or development Core fails at `capture.boot`: "The program in DEMS_CAPTURE_WORKER cannot be used ...". Several R-FLEX-relevant cases therefore have no host evidence: `capture-composition.db.test.ts` I-9a (op 100 and the op 93 typed address through the real composition, RF-N1/N3), the REAL_* cases of `capture-config.db.test.ts` (11, including the D19 transport path), and `adopted-camera-test.db`/`camera-adapter-open.db`/`readdress.db` at file level. Their only evidence is the Mac row reports (109: db 15/15; 132: 37/37) | host `r_s5_core_db.log:1627-1640` | 115 |
| F-4 | NON-BLOCKING (LOW, code reading, not executed) | With two serial-less units of one model, op 99 with `release: true` on the second unit is accepted. `holdsCard` holds the twin (`service.ts:478-483`), `match` is `NOT_TELLABLE` so `portMove` is false (`:593`), and the release path re-keys the holder onto the twin (`:603-609`). Q96-03 (a) says the second unit cannot be bound. Effect is limited: it moves the same MIC, the web never offers it (`audio-cards.ts:212-227`), and at runtime both units still give `MODEL_SHARED` (no wrong-unit recording). No test pins this case (`service.test.ts:547` covers only the refusal without `release`) | as cited | 108 / 131 |
| F-5 | NON-BLOCKING | `rflex-only.diff` (RB-1, the R-FLEX-R-B reverse patch) also holds non-R-FLEX changes: row 139's task-4 LCD test-bed fix `live-harness.ts` (D27) and row 141's fix. Reversing R-FLEX with this patch also brings back the row-139 canary red | `rflex-files.txt`, `file_claims.md:132` | 120 (rollback note) |
| F-6 | NON-BLOCKING (LOW) | Text drift in the contract. The 200 description and the op 99 prose still say "found on a card at another place", which since RF-A1 is no longer a change (`capture-audio-cards.ts` 200 description; openapi `:25208`). The example `alreadyBound` message "Another microphone uses this sound card." differs from the server's "Another microphone holds this sound card." (`service.ts:219`). Also `unidentifiable` repeats the literal `'0000:0000'` (`service.ts:494`) instead of importing `CARD_USB_ID_REPLACEMENT` (`card-listing.ts:47`); the row gives static rule A-5 as the reason, but the two can drift apart | as cited | 99 / 131 |
| F-7 | NON-BLOCKING (LOW) | The D26 "lowest MIC id" order is a text `ORDER BY device_id`. `HARDWARE_DEVICE_ID_PATTERN` (`patterns.ts:102`) allows ids of different widths, so `MIC-100` would sort before `MIC-11`. This only matters with an older double binding (D26) and 100+ microphones | `statements.ts:82` | 108 (known-limit text) |
| F-8 | NON-BLOCKING | RF-N9's "shellcheck clean" criterion was not run (no shellcheck on the Mac or on the host) | `h_s8_host_script.log:151` | 114 / gate 119 |
| F-9 | NON-BLOCKING (documentation) | Row 142 has no claim line in `delegation_progress/file_claims.md` (host and snapshot). Its decision (D32) and record (`88_row142_regression_fix.md`) exist only on the host, not in the snapshot | `grep 142` over the host `file_claims.md`: no hit | controller |
| F-10 | NON-BLOCKING (scheduled) | Bench and HIL acceptance for R-FLEX is still to run: H-1/H-2/H-3 (rows 125-127), `interfaceCount` (rows 66-69, 128), 90 AC-8 `ss -tnp` on Wi-Fi, and `SHA256SUMS` 4 x OK (row 120, inside `.data/`) | spec :47-73 | 66-69, 120, 125-128 |

Out of R-FLEX scope, seen in the host logs (not attributed to R-FLEX; the R-FLEX diff does not touch these files): `apps/mobile` typecheck TS2339; `core-web src/test/box-check.test.ts` CW-01 (stylesheet; `devices.css` is task-4 working-tree work, not in `rflex-files.txt`); `capture/__tests__/static.test.ts` 4 (D28); boot/fence/session DB failures from `DEMS_CAPTURE_WORKER`.

## 7. Remediation notes (for the owners; this row changes nothing)

- F-2: row 115 runs `ws-discovery.test.ts` alone on the host baseline `~/dems-baseline-r115` and alone on the R-FLEX tree at low load. Record which case fails where.
- F-3: give the host test run a valid `DEMS_CAPTURE_WORKER` (owner, mode and path rules from the message), or record those cases as Mac-only evidence in the row-115 report.
- F-4: either refuse `release` when `match === NOT_TELLABLE` (a code change, for its owner row) or accept and record the behaviour; add a test whichever way is chosen.
- F-5: the row-120 rollback text should say the reverse patch also reverts rows 139 and 141.
- F-6, F-7: text and known-limit wording at the next contract or review touch.
- F-9: the controller appends `row 142 | ...card-listing.test.ts | edit` and `...usb-audio-macos.test.ts | edit` to `file_claims.md`.

## 8. Next steps

1. Row 115 attributes F-2 and F-3 against the baseline (D32 b).
2. Rows 117 and 118 (security posture CAUTION per D11/D14; code review) and gate 119.
3. Bench rows 125-127 and 66-69 for the HIL halves of RF-A1..A3 and RF-N1/N2.

## 9. Verdict

**CAUTION.** 0 BLOCKING findings. All 18 spec requirements are implemented in code as specified, and the R-FLEX test files that can run on the host pass. Four requirements are PARTIAL: RF-N9 (shellcheck not run), RF-P1 and RF-P2 (gate chain and `.data/` checksum still open), and the composition-level evidence for RF-N1/N3 exists only on the Mac (F-3). The 2 `ws-discovery` flood failures (F-2) still need a cause from row 115.

---
*Generated: 2026-10-22*
