---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-14
agent: security-review
blueprint_row: 86
milestone: M6
conditions: L-2, L-3; gate conditions AD-01 (6), AD-02, AD-08
tree: branch task4/input-av-core-port, head 1fbeada7 plus the uncommitted tree as read 2026-10-14 10:05-10:29 WIB
narrative_tier: 1
status: complete
verdict: CAUTION (no FAIL)
---

# Row 86: security review before the class-C lift

## 0. Verdict and gate conditions

**VERDICT: CAUTION. FAIL: 0. The lift may proceed under the precondition list in section 6.** Nothing I read lets a credential reach an argument, an environment, a log or a file. Nothing lets a source of the wrong class, a loopback address or a wrong-path push be recorded as a production camera. Every caution below has a named row. None is a defect that the lift turns on: each one is either fail-closed today, or it concerns what the evidence states rather than who can feed it.

| Gate condition | Met? | Evidence |
|---|---|---|
| **AD-01 (6)**: the branch selection is confirmed in the Ubuntu 24.04 container (BR-10) | **YES** | `test/141_container_e11_relay_state.md:18-27`: O-1 ACCEPTED 18 / INCONCLUSIVE 3 / REFUSED 0 of 21, E-11b 12 of 12, the announce line identical 18 of 18, BR-09 38 of 38, the row-58 gate 12/12 three times. Adopted by C89 (`decisions/decisions.md:125`): "BRANCH B IS CONFIRMED ON LINUX and its provisional status ... ENDS". |
| **AD-02**: the stored-address rule of rows 143/144 is built, with its source half (143b/143c) | **YES** for items (1) and (2). Item (3) is row 148, after the lift, by design. Item (4) is row 87's text 4, applied by row 88. | (1) The one judgement is `judgeStoredCamera` (`apps/core-server/src/capture/adapters/camera/stored-address.ts:176-208`). An absent rule gives `RULE_ABSENT`, and no permissive value exists. It is asked at open, before the reader (`onvif-relay.ts:662-674`); at every watch read (`camera-watch.ts:445-447`); at the credential reader's device gate, before the reveal (`modules/capture-config/credential-reader.ts:259, :294`); and at operation 108, step 5 (`modules/capture-discovery/adopted-test.ts` header steps 4-5). The candidate test in production is required by the one maker (`connect/index.ts:276`) and judged at `connect/service.ts:375-385`. Source half: the relay binds before it connects (`apps/capture-worker/src/relay/relay_rtsp.c:320`). The relay refuses a record message with no valid source (`relay_core.c:205, :293`). The Core refuses a record start with no source address (`relay-start.ts`, diff since 0f5d2a8e: `isSourceAddress(start.source)`). (2) The permissive rule exists only under `test/`. That is static rule A-10 with `RULE_BINDERS` (SR-8), plus SR-14 (`src/capture/__tests__/static.test.ts:418-470`), and it is green (below). |
| **AD-08**: the static rule of row 157 is green | **YES** | I ran it once on the tree as it stood (no database, no port): `npx vitest run --project unit src/capture/__tests__/static.test.ts` gave `Test Files 1 passed (1)`, `Tests 79 passed (79)` at 10:23 WIB. The mount pins, the entry statement with its three members (`src/index.ts:120`, SR-11) and the "no test key maker under `src/`" rule are all in that file. AD-08 (1) and (4) belong to row 89, which runs after the lift. |

The F-07 question that C50 put to this row: confirmed at the real entry. `src/index.ts:123-131` hands the process's host facts through `provideHost` before the boot steps. The entry is pinned by text (rule 157) and has not been started by a test (C66 (2)). That residual is accepted and routed (C-8).

## 1. Frame (5W1H)

| | |
|---|---|
| **What** | The security acceptance that conditions L-2 ("the answer to SEC35-40 is built and accepted") and L-3 ("the credential never reaches an argument list, the environment, a log or a file") require before row 88 lifts class C for `ONVIF_RTSP` and `USB_AUDIO`. Source: `masterplan/01_specs.md:246-247`. |
| **Who** | For the user: whether the lift is safe. For the controller: the cautions and their rows. For row 88: its precondition list. For row 87: which of its texts hold. |
| **When / where** | 2026-10-14, head `1fbeada7` plus the uncommitted tree. The worker and relay sources and binaries are byte-identical to the A1 baseline (`test/a1_worker_baseline_and_kill_matrix.md` section 4). I re-hashed `announce.c/.h`, `ingest.c`, `capture_worker.c`, `audio.c`, `ipc.c`, the four relay files, `build/capture-worker` (`84c8eceb…`) and `build/capture-relay` (`c375c92f…`); all are equal. `git status apps/capture-worker packages/capture-protocol` is empty. |
| **How** | Read only. Graft was not used: the symbols were located by `grep` and direct reads. One targeted unit-test file was run (the AD-08 file). No suite, port, container or lock was used. No credential, key or `.env` file was read. For the two PEM-header test files of C53 (3) I ran count-only checks: `core/__tests__/writers.test.ts` has 1 header line, `evidence-export/__tests__/export.test.ts` has 6, and both have 0 base64-body lines. These are needle strings, not embedded keys. |
| **Why CAUTION, not PASS** | Twelve cautions, all low or medium (section 3). Two concern the truth of what a sealed package says about a stream (C-1, C-2), and one concerns a rule that becomes live with a row now landing (C-3). |

**In-flight files I could not judge** (named as the brief requires):
- `packages/shared/**` and `db/mapping/rows.ts` (V7).
- `capture-discovery/adopted-profiles.ts` and `adopted-test.ts`. V7 is editing them now. I read them as they stood at 10:12 WIB (PR's state).
- `capture/fence/production-parts.ts`. It is modified at 10:29, which means N7 has started; I did not judge its diff. `src/capture-composition.ts` was unmodified against HEAD when I read it.
- The macOS audio files `capture/adapters/audio/macos-*.ts` (N6, N8, N9). They are not part of this lift's review.
- `capture-session/**` and `sealing/**` (D1). I read `capture-session/ingest-pairing.ts` and `index.ts:925, :2178-2205` while they were unmodified against HEAD; the sealing tests are modified and were not judged.
- `apps/capture-worker/**` (N13). I reviewed it at the A1 baseline, which still holds.

## 2. L-2 and L-3, requirement by requirement

| # | Requirement | Rating | File and symbol (evidence) |
|---|---|---|---|
| 1 | **Relay: own RTSP client, Digest only** (U17, S13-01) | met | `relay_rtsp.c:284` refuses with `RELAY_AUTH_SCHEME_NOT_ALLOWED` when there is no Digest challenge ("nothing was sent"). The challenge reader is `relay_core.c:354`. The account is never part of an address (`relay_core.c:182`). |
| 2 | Relay: hardening of rows 186 and 41-43 | met, with 3 Low left by 186 (its section 2) | Integer parse is `strtol` (`relay_core.c:150`); the `atoi` of the 06 review's L-3 is gone. 186 closed 2 High, 6 Medium and 5 Low. A1 series: relay unit 982, fuzz controls 24/24, row186 23/23 (C88, C123). |
| 3 | Relay: source bind (143b) | met | `relay_rtsp.c:320` `bind` before connect; `relay_core.c:293` `source_ok` is mandatory in record mode. RC-6 erratum: `verification/06_security_relay_client.md` section 12. Linux syscall trace: `bind` 11 = one per dial (`test/141`, line 104). |
| 4 | Relay: process hygiene on Linux (S13-02) | met in the container | `NoNewPrivs 1`, core and file-size limits 0/0, not dumpable, 3,203 of 3,203 samples; descriptors ≤ 5 (`test/141` section 6; C89). |
| 5 | **Credential read path** (144, 145, 146/146b/146c, PR) | met | `credential-reader.ts` header and `:259-294`. Each holder is bound to its reasons. The device gate checks class and the destination rule before any reveal. Reveal and audit happen in one unit, and the value is returned only after `afterCommit`. A session reveal carries the session in `session_id`. Operation 108 audits every test that reached the reader, with two entries (`adopted-test.ts` header, "WHAT IS AUDITED"). PR's storing runs in one engine unit with its entry, and stores only when nothing is stored (`adopted-profiles.ts:120-160`). |
| 6 | Injection point: one caller | met | `credentialAtInjection` is called only at `capture/adapters/camera/relay-start.ts:110`, which passes it in the start message on standard input (`:112`, `args: [], env: {}`). The comment `credential.ts:12-14` is stale; that is erratum E-A2, applied by row 88. |
| 7 | **SR-10** (`capture-composition.ts` in `CREDENTIAL_STORE_USERS`) | met: **CONFIRMED** (see (5)) | `credential-store/__tests__/static.test.ts:28-33, :99-131`. Five lines are pinned. There is one `coreCredentialStore(` call and one store call, `.store.capture.open(`, at `capture-composition.ts:100, :797`. |
| 8 | **SA-2** (no wrong-path push recorded; branch B) | met | Worker gate in `ingest.c:596-607`: there is no preprocessor `if`, argument or plan member around it, and the proof build can only force "no match" (`:196`). The match in `announce.c:89-96` is a whole message, length first, `same_bytes` constant-time, exactly one line, and `Updating control URI` refuses. Per-attempt secret: 16 bytes = 128 bits (`capture/ingest-address.ts:37, :54`; `randomBytes`, `capture-session/index.ts:153`). |
| 9 | **SA-3** (pairing, fail-closed, C34) | met | `capture-session/index.ts:925`: in `REAL_PRODUCTION`, `relayReports === null` gives `RELAY_REPORTS_NOT_WIRED`. Pairing bound `INGEST_PAIRING_BOUND_MS = 5_000` (`ingest-pairing.ts:51`). The composition hands the hub in (C60). |
| 10 | **Superseded-report rule** (188, C37) | met | `ingest-pairing.ts:185-219`: reports of a superseded attempt are dropped, counted and told to `superseded` (three numbers and a device). An attempt never issued is a fault (`:65`). |
| 11 | Relay report reader (R1) | met | `relay-start.ts` (diff since 0f5d2a8e): three patterns anchored at both ends (`CAMERA_LOST_LINE`, `CAMERA_REOPENED_LINE`), numbers only, causes from a closed list `RELAY_LOSS_CAUSES = [20,23,31,32]`, tries 1-6. No address or text is carried. |
| 12 | R1b (video absent as a signed fact) | met as a contract and writer; real-relay proof is row 90 | C108: the optional member `tracks[].absentInSession[]`, byte identity shown; the relay's words came from the test file. Not a security matter. |
| 13 | **E-12** (row 44, L-3 runtime half) | met on doubles | `test/044_e12_credential_search.md` section 3: 42 runs, 0 occurrences, control 42/42. For the C109 blind spot, see answer (3). Thin cells I, J, D have 2-3 samples. Linux `/proc/*/environ` goes to 9A/H-01, H-24. |
| 14 | **Opener rule** (46, 67, 85, 85b-d, 143, 143c, E2) | met before the lift | Registration: `capture/adapters/registry.ts:78-81` (kind allowed for the operation; an opener only on `OPENER_CAPABLE_KINDS`). Fence: `capture/fence/sources.ts:105-108` ("No opener, no row") and `:118-130` (four rows, one class, the operation's class). A-9 and A-11 are green per the C70 record. Admission: `admitDevice` (85d). E2: `relayEnded`, `admitHwAddress` and the session's `sourceAddress` are required (`onvif-session.ts:213, :239`). The camera adapter refuses a profile with no stored stream row before the reveal (`onvif-relay.ts:662-667`). |
| 15 | **Worker gate BR-01..BR-06** (58, 175-177) | met at the A1 baseline | BR-01 is `ingest.c:603-607`. BR-02 is `announce.c:12-25, :89-96`. BR-03 uses per-camera `c->announce` / `c->announce_refused` (`ingest.c:118, :210, :571-572`). BR-04: no `av_log_set_level` (`ingest.c:40, :200`), a message naming a session path is withheld (`:222`), and there are two codes without text (`:234-239`). BR-05 and BR-06 rest on the series. Re-verification: kill matrix 35/35, `make e2e` 160/160 after one re-run (`m5_gap_analyser`, an audio sample count, not the gate), row58_gate 12/12 three times (C123). |
| 16 | **Locator query rule** (174, C24) | met, with caution C-4 | `credential.ts:89-117` (`queryAllowed`): at most 128 characters, 8 parameters, a closed character set, no repeats, names compared whole and case-folded against an 11-name list. A user part is refused (`credentialFreeLocator`, `:127-137`). |
| 17 | **Fail-closed pairing** (48, C34) | met | see 9. |
| 18 | Reply guard (B1) | met | see answer (10). |
| 19 | Production door, standard-error observer (N5) | met for the camera path | see answer (9). |
| 20 | Logs and audit never carry a device text | met in what I read | The B1 guard returns codes only. PR's message carries a closed word and counts (`adopted-profiles.ts:174-175`). The N5 observer reduces lines to ASCII and blanks locators. |

## 3. Cautions, each routed to a row

| # | Severity | Finding | Evidence | Row |
|---|---|---|---|---|
| **C-1** | Medium | **Assignment checks the profile LIST, not the stored stream facts.** A raw token in code form (C61) or a code no stream stated can be assigned and is refused only at the open (`CAPTURE_PROFILE_UNKNOWN`, 0 reveals). Nothing false is recorded, but the operator meets the refusal at start, not at assignment. A camera whose list holds such a code cannot be healed by operation 108 (PR case (b)); it needs to be adopted again. | `modules/capture-config/routes.ts:323-336` with `store.ts:175-189` (`SELECT d.id, d.profiles`); `onvif-relay.ts:662-667` (`stream()` reads `capture_device_streams`) | **V7**: the device entry lists only codes that have a stream row. `assertOwnProfile` judges against codes with a stream row. README states "re-adopt a camera whose list holds a code with no stream row". |
| **C-2** | Medium | **PR decision 4: ONVIF tokens and lens are not compared, and the open does not compare the stream with its stored row.** The open asks `GetStreamUri` for the STORED token (`onvif-relay.ts:687`). If a camera re-maps its tokens, the recorded stream can differ from the stored code's codec and picture, while the track's facts are decoded from the code. HYPOTHESIS: whether the manifest states measured or coded facts was not traced. | `adopted-profiles.ts:43` (no token or lens read); `relay_core.c:739-744` (the probe states codec and size, and record mode compares nothing) | **New row before gate M6, with E3 / row 90**: operation 108 compares the token (and lens); at open, the relay's first keyframe codec and size are held to the stored row, or the manifest states measured facts. Row 88 does not claim it. |
| **C-3** | Medium (latent until D4's Core half) | **S-04, the port half of the stored-address judgement, is still as found.** `service.port === '' ? undefined`, and the admitted `destination.port` is never compared with the dialled port. The stored list `onvif_ports` is now in the schema (`0030`/`0031`, uncommitted), so once the network facts hand `allowedPorts`, a list not starting with 80 admits a dial at 80. The credential reader's gate has the same form. | `stored-address.ts:191-206`; `credential-reader.ts:294`; `capture/destination-rule.ts:326-327`; migrations `0030_network_config_onvif_ports.sql`, `0031_...privileges.sql:19` | **D4** (its Core half must carry the fix); **row 88** precondition if D4's wiring lands first |
| **C-4** | Low | The query rule's name list misses common credential parameters: `passwd`, `pw`, `usr`, `login`, `loginuse`, `loginpas`, `account`, `apikey`, `access_token`. The locator is kept nowhere and goes to the relay's standard input only, so exposure is low. | `credential.ts:105` | Proposed row **174b** (camera adapter owner): refuse by substring class (`pass`, `pwd`, `token`, `key`, `secret`, `auth`, `user`, `login`, `session`); plus the hardware chapter's real-camera check |
| **C-5** | Low | **Row 87's "does not 3" is CONFIRMED and wider.** No device identity is checked at open: Digest does not authenticate the camera to the Core, and the ONVIF certificate is not checked (G-R10, `static.test.ts:762-766`). A device that takes a stored camera's address inside the camera subnet is recorded as that camera, and it receives a Digest response it can attack offline. | `relay_rtsp.c:284` (Digest client only); `credential-reader.ts` (no MAC check) | **Row 87/88**: AM-1 (3) and H.5 "does not 3" carry the sentence. **Hardening row after the lift**: the neighbour table's MAC must equal the stored `mac` before the reveal (the 111b inputs exist). **Hardware chapter**: camera-LAN isolation. |
| **C-6** | Low | N5: nothing pins that the relay's start never hands `onDiagnostics` to the door. Today the call has none (`relay-start.ts:112`). | N5 offer (2), rule A-8 | **Integration pass** (A-8) or **N9** |
| **C-7** | Low | **Row 87's texts are partly out of date** (answer (6)). | `decisions/087_lift_texts.md:49, :104, :240, :273` | **Controller / row 87 re-issue before P-5** |
| **C-8** | Low | `src/index.ts` is pinned by text and has never been started by a test. The bench ran a launcher (C66 (2)). | `src/index.ts:115-131` | **Row 89**: start through the entry, or state the launcher's equivalence line by line |
| **C-9** | Low | Static comments still say SR-10 is "PROVISIONAL until row 86" although C94 confirmed it. | `credential-store/__tests__/static.test.ts:30-31, :99` | **Row 88** (comments only, with the SR confirmations) |
| **C-10** | Low | S-06: `onvif-network.ts:345` holds the source to `DOTTED_QUAD`, not `isSourceAddress`. That admits `0.0.0.0` and multicast as a source. It is not on the recording path, and U24 keeps set calls off the real cameras. | `onvif-network.ts:209, :345` | **Next commissioning row (V6b family)** |
| **C-11** | Low (design) | C103: the Core cannot read the firewall table (answer (4)). | C103 | **Document row / host profile**; a build row before the first Linux installation |
| **C-12** | Low | E-12 is macOS-only, and cells I, J, D have 2-3 process samples. | `test/044` section 3 | Already routed: **9A/H-01, H-24** |

## 4. The items put to this row by name: (1) to (11)

**(1) N-01 (C50) and C61's limit.** Both are CLOSED at the open, not at assignment. The rule "no assignment without stored stream facts" is NOT what is built. Assignment holds the profile to the stored LIST (`routes.ts:323-336`, `store.ts:175`), and the database checks only the code FORM (`devices/status.ts:176-179` says so). What closes both is the open:
- `onvif-relay.ts:662-667` refuses any profile whose stored stream row is absent (`READ_STORED_STREAM_TOKEN`, `capture-composition.ts:199, :251`). That happens before the destination rule and before the reveal.
- The simulator's default (`CAPTURE_CONFIG_EMPTY_SLOT_PROFILE = 'H264_1080P25'`, `packages/shared/src/sim/capture-config.ts:100`) can therefore record only if the camera itself stated that very code, in which case it is the camera's statement, not a stand-in.
- A raw token such as `PROFILE_1` never has a stream row. Stream rows are written only by adoption and PR, with minted codes.
- PR never writes over such a list. A listed code with no row counts as a difference (`adopted-profiles.ts:120-124`).

So no default stands in for a stream's statement in a recording (C36 holds). The residual is C-1 (refusal at start, not at assignment; no healing path) → V7.

**(2) C89, `/dev/urandom` opened four times.** NOT a risk. It is read-only, close-on-exec, 4 bytes, after the no-new-privileges call. The relay's own code opens nothing, its import net is green on ELF, and the descriptor is no path to a secret. HYPOTHESIS: this is the library's random seed for the loopback push (session or SSRC); its source was not read. Consequences:
- A host profile that confines devices (`PrivateDevices=yes` keeps `/dev/urandom`) or a later syscall filter must admit this open.
- If it were denied, the library would fall back to a weaker seed, which affects only identifiers of the loopback push.
- Route: 9A/H-24 already asks "whether the unit leaves `/dev/urandom` readable" (`test/141`, line 151). No row change.

**(3) C109, `ps eww` blind for system binaries.** Row 44 sampled four processes, and **none was a system binary, so none was blind**:
- The relay `apps/capture-worker/build/capture-relay` and the worker `build/capture-worker` are ad-hoc linker-signed (`codesign -dv`: `flags=0x20002(adhoc,linker-signed)`). Both were started with an EMPTY environment: `env={}` (`row044_e12_search.py:54`; `test/m3worker.py:278`), and the door was tapped at "an environment given with 0 keys" in every run (`test/044` section 2). Their "0 words of environment" is therefore the expected value, and it is backed by the spawn options, not by `ps` alone.
- The Core stand-in `/usr/local/bin/node` (hardened runtime, not a platform binary) showed its inherited shell environment.
- The control is `sys.executable` = `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`, and its planted environment text was found 42 of 42 (`row044_e12_search.py:165-201, :237`).

Not sampled, and not places of the product: the test camera, the control pusher (FFmpeg) and `lsof`.

**(4) C103, the firewall rule's table.** For the lift, **the unit's state is enough**:
- Only root, or a holder of `CAP_NET_ADMIN`, can delete the table, and that actor could also forge any fact file.
- Behind the rule stand the per-attempt 128-bit secret, the BR-01 gate and SA-3 pairing, so a missing table weakens defence in depth, not SA-2.
- Giving the Core `CAP_NET_ADMIN` stays ruled out, as C103 rightly says.

Recommended for a real Linux installation (not the lift): **a root-made fact the host profile defines**. A `oneshot` service with a timer, ordered `After=` and `PartOf=` the rule's unit, writes `/run/dems/loopback-rule.state` (root-owned, mode 0644) with the table's digest and the time. The Core reads it and refuses a start when the file is stale or the digest differs. This catches the realistic failure, an accidental `nft flush ruleset` by another firewall manager or a container runtime, which the unit's state cannot see. Criterion 6 of 9A/H-16 is rewritten as "within the timer's period". Route: document row and host profile, then a build row before the first Linux installation.

**(5) The three named amendments.**
- **SR-10: CONFIRMED.** The purpose is pinned to five lines, there is one store question and one call `capture.open`, and a control catches seven planted second uses (`credential-store/__tests__/static.test.ts:104-131`). The composing file is the only place above the units that can hand the store to the reader (C55). C94 had already confirmed it. Only the "PROVISIONAL" comments remain (C-9).
- **SR-11: CONFIRMED.** One runner of the same maker is used once, for the fixed row `/usr/bin/cat /etc/dems/netalias-interface` on `linux` only. The callers of `captureHostRunnerOf` are pinned (`static.test.ts:2104-2170`). The entry has three members (`src/index.ts:120`; `static.test.ts:2351-2352`).
- **SR-14 / SR-5 entry 2 (R2): CONFIRMED.** SR-14 pins the three hand-on lines and the single origin of `sourceAddress` (`static.test.ts:418-470`), and its controls refuse the shorthand blind spot. SR-5 entry 2 admits the bound third parameter only. Every production caller passes three arguments (`static.test.ts:694-746`).

**(6) Row 87's texts (`decisions/087_lift_texts.md`).**

| Text | What holds | What must change |
|---|---|---|
| AM-1 | (1)-(4) hold | (3)(f): add "128 bits" (`ingest-address.ts:37`); this closes 087's gap at `:289`. (3)(h): add the platform: on Linux the helper argument row is fixed (row 79b, 18/18 in the container), so P-8 is closed; on `darwin` the production card listing is `AUDIO_CARD_LISTING_NOT_AVAILABLE` until the N-rows land and pass the M2b gates. **(5) "Agents record nothing from the real devices (U18)" is FALSE since U24** (`decisions.md:141`), which lifted U18 for recording from the source. **P-10 must read U24.** (6): "host profile not asked off Linux" must read P1 / C97: `darwin` is warned and stated in `SYSTEM_BOOT` and the signed manifest; other platforms are refused. Add C-5's sentence to (3) or (6). |
| H.5 guard statement | Holds, and the word "declared" holds | "Does not 3" is CONFIRMED and gains: "a device at that address obtains a Digest response to the stored credential" (C-5). |
| E-A2 | Holds | Cite `relay-start.ts:110` (it was `:107`). `credential.ts:12-14` is still stale. |
| Erratum to 1.6 #3 | Holds | P-6 re-read: migrations now run to `0031`. The only GRANT and REVOKE statements touching `capture_devices` remain `0005` and `0009:21` (`0023:9` states "no grant"). `0031` grants `UPDATE (onvif_ports) ON capture_network_config` only. |

The contradictions it found:
- **X-1, X-2, X-3, X-4, X-6, X-7 and X-8 hold.**
- **X-5's hypothesis is CONFIRMED** by C92 and answered by U22 (the macOS microphone path, in flight).
- **F-2 is sharper than written.** With U21 and U24 the user's own `REAL_PRODUCTION` recordings on this Mac will produce `developmentSources = false`. Check `M7-SEC-SRC-2` ("every package sealed on this Mac ... has `developmentSources = true`") must be rescoped to test data directories, or it fails on the user's data → **gate 92 / document row**.
- **F-3 is closed for Linux** (79b) and open for macOS (N-rows).

**(7) What row 88 must still do for the 060d and 060e lift items.**
- **Q-01:** the client half is done (W5). The Core still states `LIVE` (E-01, C115) → V7 or E1b. This is needed for the proof, not for the code.
- **Q-02:** see (8).
- **S-01:** the device reads are done (`devices/status.ts:164-200`, V6). The state-stream slice is still open (C105) → V7.
- **S-03 / E-02:** E2 made `relayEnded`, `admitHwAddress` and the session `sourceAddress` required. **`candidateSource?` is still optional** (`connect/service.ts:264, :375`) and so is `ConnectionTester.test(…, sourceAddress?)` (`:175`). Row 88 either makes them required or records "stated by the one production maker at `connect/index.ts:276`". The time read's `sourceAddress?` (`onvif-session.ts:904`) is held by SR-5 (every caller passes 3 arguments).
- **S-04:** still as found → C-3.
- **S-06:** still as found → C-10. Not a lift condition for the recording path.
- **F3-06 (operation 108):** still "This device cannot be tested." (`adopted-test.ts:257`, used at `:301, :312, :335, :354`). This is wording, not security. Row 88 ticks it or names its row.
- **Q-12:** of R1, R2, B2, V6 and V6b, I read R1 (the reader), R2 (SR-14 and SR-5), and B2's S-01 part. V6 and V6b were not read; that is stated for gate M3.
- **E-03:** the watch's `captureEnded()` exists (`camera-watch.ts:291, :558`) and **has no caller in the composition**. Row 88 wires it at every capture end and states who reads `lost()`, and that the watch is attached before the first start can happen.
- **E-05:** done (`onvif-session.ts:640-641`, "an exchange that ended is never armed again"). Tick only.
- **`candidateSource`** is the only E-02 member waiting for row 88.

**(8) Q-02 is a condition of the PROOF and of the user's goal, not of the lift's security.** Without V7 the lift is fail-closed:
- A production camera with no stated profile is refused at assignment (`CAMERA_PROFILE_NOT_STATED`) and again at open.
- The only way to assign is operation 78 with a profile from the stored list, which is held by `assertOwnProfile`.

Row 88's code can land without V7. Its real-camera proof, and the hand-over to the user for recording, cannot. I recommend keeping V7 as a precondition of row 88's **closing**, not of its commit (the controller's call; C117 calls it a precondition of row 88).

**(9) N5's standard-error observer: no risk to the camera path.**
- The relay's start passes no `onDiagnostics` (`relay-start.ts:112`), so `lines` is `null` and the path reduces to the old `diagnostics.push(chunk)` inside a `try` (`production-door.ts:479-487`). The only other change, `lines?.end()`, is also inside a `try` (`:533-538`).
- Even if it were used: the per-byte work is bounded (at most 512 characters per line, then an `indexOf` skip), the rate and life are bounded, the line is reduced to ASCII, locators are blanked (including a cut through an open locator, `LOCATOR_OPEN_AT_CUT`), and the observer is told in a later turn and can never stop the door.
- Caution C-6 asks for a pin.

**(10) B1's reply guard: at every ONVIF reply path. C109's header measurement: bounded.**
- `onvif-session.ts` and `onvif-network.ts` are the only importers of the `onvif` package. Both wrap their single agent with `guardOnvifReplies` before the package is handed a byte (`onvif-session.ts:595-605`, `onvif-network.ts:402-404`).
- WS-Discovery has its own parse with a 16 KiB cap and depth 24 (`probe-answer.ts:24-26`).
- No other XML parser of device text exists in `src/`.
- `WWW-Authenticate`: the 2,048-character filter `digestChallengeAllowed` runs inside the `digestAuth` wrapper BEFORE the package's own parse (`onvif-session.ts:298-301, :630-635`; `onvif-network.ts:249-251, :440`). It also refuses when the exchange is unarmed (`CHALLENGED_UNARMED`). The worst measured case is therefore 0.86 ms (C109), against 53.8 ms at the 16 KiB head that Node admits.
- HYPOTHESIS, not traced: if the package splits one header into several challenges before calling `digestAuth`, each piece is still ≤ 2,048 when it is parsed.
- Residual: B1's caps were fitted to the stub; real profile lists go to the hardware chapters (C100 (1)).

**(11) PR's seven driver decisions.** "A stored statement is never replaced" HOLDS. A write happens only when the list is empty AND no stream row exists (`adopted-profiles.ts:121-123, :147, :160`). Every other verdict writes nothing, and only counts and a closed word leave the file.

| # | Decision | Ruling |
|---|---|---|
| 1 | The engine unit | ACCEPT: the store and its entry are atomic |
| 2 | "Empty" = empty list and no row | ACCEPT: the conservative choice |
| 3 | A code with no row is a difference | ACCEPT: it closes the C61 path. State the re-adoption remedy (C-1) |
| 4 | Tokens and lens not compared | **CAUTION C-2** |
| 5 | `PROFILES_NOT_STORED` ends | ACCEPT |
| 6 | `last_seen_at` set | ACCEPT: a true fact |
| 7 | One `settle` member | ACCEPT |

A first test of an EMPTY camera trusts whatever answers at the admitted address, the same trust-on-first-use as adoption, inside the destination rule (C-5 covers it). Concurrency: PR assumes the single-flight test bound of `connect/limits.ts`; not re-run.

## 5. GDPR and ISO 27001 relevance (short)

- **GDPR Art. 25 and 32:**
  - Credentials are write-only and revealed per use with an audited actor (`credential-reader.ts`).
  - No device text or locator reaches logs.
  - Audio and video are evidence held under the task-3 regime.
  - New with the lift: the user's own production recordings (U24) on this Mac hold personal data from the moment row 88 lands. Their retention and erasure follow the task-3 evidence rules, unchanged by this row. Not assessed further here.
- **ISO 27001:**
  - A.9: holders are a closed list; the commissioning permission exists (row 100).
  - A.10: Digest only; per-attempt 128-bit secrets.
  - A.12.4: the audit records the reveal and the outcome; error-log codes only.
  - A.12.6: the library is pinned, and a new version re-runs BR-09.
  - A.13: the destination rule and the source bind (C-5 is the gap).
  - A.14.2: static rules with controls; mutation-checked tests (T3).
  - Gaps: C-1, C-2, C-3, C-5.

## 6. Row 88: what it must include, and what it must not start without

**Must not start without:**
1. **AM-1 recorded (P-5)**, AFTER row 87's texts are corrected per (6) / C-7: U24 replaces U18 in (5) and P-10; P1/C97 replaces (6); 128 bits; the platform sentence for `USB_AUDIO`; C-5.
2. Rows 141 (yes), 59 (yes: 35/35, C123) and 157 (yes: 79/79 today), plus this row's verdict (CAUTION, so P-1 is met).
3. **The B1 fix committed** before any production start against the user's cameras (C100). The instance on port 5178 is not running (C112).
4. **One writer per file:** N7 (`capture-composition.ts`, `fence/production-parts.ts`), V7 (`packages/shared`, `db/mapping/rows.ts`, `adopted-*.ts`) and D1 (`capture-session`) must be landed or quiet on the files row 88 edits.
5. **On `darwin`, no macOS `USB_AUDIO` adapter in the lift** until the N-rows have passed the M2b gates (SM-02, 04, 14, 16, 29, 30, 33, 36) and their security acceptance. Until then the listing answers `AUDIO_CARD_LISTING_NOT_AVAILABLE` (fail-closed), and AM-1 says so.
6. **If D4's Core half wires `onvif_ports` before or with row 88: S-04 is fixed first (C-3).**

**Must include:**
1. The opener list gains exactly `ONVIF_RTSP` and `USB_AUDIO`. Registration refuses an opener whose source class is not the operation's (AM-1 (3)(b), `registry.ts:78-81` today). `SNMP_POE` with an opener is refused.
2. The builder calls the adapter's `admitDevice` BEFORE the registry, with `reader`, the `onAdmission` sink, the opener list and both watches for a later device (C70).
3. **E-03:** the composition calls `cameraWatch.captureEnded()` at every capture end; who reads `lost()` is stated; the watch is attached before any start.
4. **E-02:** `candidateSource` is required, or its maker is recorded at `connect/index.ts:276`.
5. The ticks: E-05 (done), E-01/Q-01 (the reader rule is the only line until V7), F3-06 for operation 108 (wording, or its row), S-06 named for its row.
6. Errata E-A2 (`credential.ts:12-14`) and text 4 applied; P-6 re-read on the final migration list.
7. The SR-10 "PROVISIONAL" comments updated (C-9).
8. Its own verification cell (P-9).

**Before row 88 closes (its proof on a real camera, the user's goal):** V7 (Q-02, E-01, S-01's state stream). The user starts a new Core on the commit that holds B1 and re-adopts the cameras (U24 (3)(a)).

**After the lift, before gate M6:** row 148 (AD-02 (3)), row 89 (AD-08 (1), (4); C-8), row 90 (a dropped camera leg, with E3 and C-2), the C-5 hardening row, 174b (C-4).

## 7. Read / not read

- **Read in full or at the cited lines:** decisions C50-C123; `087_lift_texts.md`; `060d` sections 1 and 9.3; `060e` sections 1-2 and 7; the PR record and its request lines; `test/044`, `test/141` (header, sections 1, 6 and line 151), `test/a1` section 4; the N5, E2 and R2 progress files; `04_security_addendum.md` (AD-01, AD-02, AD-08); the code lines cited above.
- **Not read:** V6/V6b product diffs; `production-parts.ts` (in flight); `capture-composition.ts` beyond `:100, :199-255, :267-298, :483-530, :797`; the adapters' static file (not run: only one test file was allowed); the implementation records of rows 46, 67, 85b-d, 143-146 beyond their decision rows; B1's test reproducer.

---
*Generated: 2026-10-14 10:30 WIB*
*Last Updated: 2026-10-14 10:30 WIB*
