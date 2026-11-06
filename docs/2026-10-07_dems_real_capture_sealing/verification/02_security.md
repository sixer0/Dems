---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-11
agent: security-review
blueprint_row: 99 (M9-CH-2, final verification chain step 2 of 4)
commit: 713d83f (main, local)
tier: 2
status: complete
verdict: CAUTION
---

# Final security review - DEMS task 3 (real capture, sealing v2, transcript, evidence consumption)

## 1. Verdict

**CAUTION.** 0 CRITICAL open (the row's hard gate is met). 1 HIGH, 3 MEDIUM, 6 LOW, 5 NOTE.

The cryptographic and access-control core that this task added reads sound at HEAD: the two signed
tokens, the per-fragment cipher and its AAD, the key store, the capture fence, the three
development rigs, the case scope, the reset guard and the process doors. Nothing found lets a
caller forge, read or destroy sealed evidence through the API.

The verdict is CAUTION and not PASS for three reasons that are about what surrounds that core:

1. The published demo password is the password of every operator in every capture operation,
   `REAL_PRODUCTION` included, and no code refuses it (S99-01).
2. The confirmation before this Mac's camera or microphone is opened is a rule of the clients only;
   the Core opens the device for any caller that holds `SESSION_START` (S99-02).
3. Decrypted evidence stays on disk without a retention rule: every finished export archive
   (S99-03), beside the plaintext that D147 already accepted.

None of the three is exploitable from outside this host at HEAD: the listener is the constant
`127.0.0.1` (`apps/core-server/src/config.ts:37`), and a `REAL_PRODUCTION` Core can record nothing
yet (no production source has an opener, no command provisions a production signing key). They are
conditions for any use beyond the development Mac, and each needs a decision of the user (section 6).

Row text against this deliverable: the blueprint row names `gateway_check/22_security_final.md`;
the controller's brief for this run names `verification/02_security.md`. This file follows the brief.

## 2. Method and limits

Read-only review of the code at `713d83f`. One targeted static test file was run
(`npx vitest run --root apps/core-server test/static/lane-camera-stub.test.ts`: 1 file, 17 tests
passed, load 4.4). One read-only probe of the server's log blanking with synthetic values. No lane,
device, browser, database or network call. No file under `.data/` was opened; names and modes only
(`ls`, `stat`). `npm audit --offline` was run and is not a measurement (section 5).

Evidence classes used below: **read** = I read the code at HEAD; **record** = taken from a gate,
review or decision of this task folder and not re-verified by me.

## 3. Findings

| ID | Severity | Where (file:line) | What | Remediation |
|---|---|---|---|---|
| S99-01 | HIGH | `apps/core-server/src/db/seed/seed.ts:239`; `packages/shared/src/sim/dataset.ts:153`; `apps/core-server/src/db/seed/demo-core.ts:56-58`; `apps/core-web/src/features/login/auth-card.tsx:499`, `use-login-controller.ts:418`; `apps/mobile/src/features/login/login-card.tsx:549`, `:567`; `apps/core-server/src/capture/boot/checks.ts:56-71` | The seed gives EVERY operator the published demo password, in every capture operation. `demo-core.ts` skips only the seed-sealed v2 packages outside `REAL_DEVELOPMENT`; the operator rows and their credentials are written all the same. The boot refusals of real capture hold no check on operator credentials, the registry has no password-change operation, and both login cards print the password and fill it in. The brief's expectation "production refuses the seed" is NOT met at HEAD. Effect today: any process on the host can sign in as SUPERVISOR on lane 2 and play or export what was recorded there, recordings of this Mac's camera and microphone included. OD-13 names "demo-password replacement" as a precondition of a LAN listener; nothing enforces it for a loopback `REAL_PRODUCTION` Core, and the README's limits table does not list it | Before any `REAL_PRODUCTION` use: (a) a boot refusal in `REAL_PRODUCTION` when any stored operator credential verifies against the demo password (one check beside `CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION`), (b) `db:seed` / `db:reset` refuse a `REAL_PRODUCTION` environment, (c) an operator-provisioning and password-change path, (d) the login cards show the demo list only when the Core says `demoControls`. Until then: state it in the README limits table |
| S99-02 | MEDIUM | `apps/core-web/src/features/devices/local-source-gate.ts:3` ("A CLIENT rule only"); `packages/shared/src/i18n/en/common.ts:1011-1029`; `apps/core-server/src/modules/sessions/routes.ts` (no confirmation member on operations 28 / 33); `packages/shared/src/api` registry: op 33 = `PERMISSION SESSION_START` only | The notice "This will turn on this Mac's camera" and its Confirm exist on web, tablet and phone and fail closed there. The Core does not ask for it: a `beginPrecheck` or a start on a selector that names a `LOCAL_DEVICE` source opens the device for any caller with `SESSION_START`, from any HTTP client. With S99-01 that is any local process. "No path opens the camera without the attended confirmation" is true of the three clients and false of the API. D163 is an agent rule precisely because nothing technical holds | Make the confirmation a fact of the request: operations 33 and 28 refuse (`409`, one audit row) a selector that names a local device unless the body names those device ids as confirmed; or add `WEB_CONSOLE_SESSION` to them for such a selector. Record the choice as a decision |
| S99-03 | MEDIUM | `apps/core-server/src/evidence-export/finished.ts:11-16`; `package-export.ts:5-14`, `:402`; `zip-store.ts:71` | Every finished export leaves `export/EXP-<id>.zip` in the package folder: the camera files DECRYPTED, mode 0600 in a 0700 folder, kept until a reset removes the package, downloadable again. For an exported item the per-fragment encryption at rest no longer protects the footage. The file states the cost itself; the evidence package spec has no retention rule (G94-11) | A retention rule for finished archives (remove after a stated time or after the first completed download, with an audit row), or seal the archive to a recipient key. User decision (section 6) |
| S99-04 | LOW | `packages/shared/src/api/redaction.ts:69`, `:78`; `apps/core-server/src/evidence-export/secret-sweep.ts:45`; probe output below | SEC35-04 asked for the camera-credential URL form (`scheme://user:password@host`) in both log-blanking lists. The shared rule blanks the five token prefixes and `bearer` / `basic` values; it has no URL-userinfo rule. Probe: `blankCredentialMembers({ note: 'rtsp://user:pw@10.0.0.5/stream' })` returned the text unchanged, while `mts_` paths became `mts_***`. Only the export secret sweep knows the form. Not reachable at HEAD: no code composes such a URL (`capture.open` has no caller, no pull path exists) | Add the userinfo form to the shared rule with a test, before the first code that builds a credential-bearing URL lands |
| S99-05 | LOW | `apps/core-server/src/credential-store/index.ts:277` (`retainOnly`, no caller in `src`); `modules/capture-discovery/connect/service.ts` | R69-09 is open: the key of a replaced or never-committed credential envelope is never destroyed. On this host `.data/credential-store/keys` holds 175 `CAPTURE_DEVICE_K_*` key files (names counted, not opened). Each is the key of one typed camera secret whose ciphertext row may be gone; harmless without the row, and unbounded growth of key material | Call `retainOnly(CAPTURE_DEVICE, <stored key refs>)` at boot or after each credential write |
| S99-06 | LOW | `apps/core-server/src/capture/signer/host-key.ts:61-72`, `:226-231` | The signer's private-file read is weaker than the key store's (`credential-store/key-store.ts:211-237`): `statSync` follows a link, only the mode is checked (no owner), the check and the read are two calls on a path (no `O_NOFOLLOW`, no `fstat` on the handle), and the mode of the `signer/` directory is not checked at load. The wrap secret that decrypts the key sits beside it, so "encrypted at rest" (SEC35-07) protects against a copy of the one file only | Read the three signer files through the key store's `readPrivate` pattern; check the directory at load |
| S99-07 | LOW | `.gitignore:37`, `:70`, `:95-96`; `apps/core-server/src/sealing/dev-key-cli.ts:26` | Key material is kept out of git by WHERE it is written (`/.data/`). By extension only `*.key` and `*.pem` are ignored: `git check-ignore` answers "not ignored" for `x/CORE-KEY.p8`, `x/CORE-KEY.wrap`, `x/a.blob`. `evidence:dev-key --data-dir <dir>` with a directory inside the repository would leave a private key one `git add -A` from a commit. The re-include of the public demo certificates is exact (14 tracked `device-certificate.pem`, nothing else of `*.pem`) | Add `*.p8`, `*.wrap`, `*.blob` to the extension block |
| S99-08 | LOW | `apps/capture-worker/Makefile:39-45`; `otool -L apps/capture-worker/build/capture-worker`; `apps/core-server/src/capture/boot/checks.ts:390-391` | The worker's program path is held to the owner and write rule; the five FFmpeg libraries it loads are dynamic, from `/opt/homebrew/opt/ffmpeg/lib` (`/opt/homebrew/opt` and `Cellar` are `drwxrwxr-x gsp-budi:admin`). The fence's own text refuses a package-manager FFmpeg for the HELPER for that reason. The boot check compares the libavformat version, not the files | For a distributed Core: a private or static FFmpeg build under the same path rule (falls together with the licence decision, section 6) |
| S99-09 | LOW | registry: op 91 `updateSttConfig` = `PERMISSION CAPTURE_CONFIG`, no condition; ops 89 / 95 / 96 carry `WEB_CONSOLE_SESSION`; `packages/shared/src/api/transcription.ts:60-61` | Operation 91 accepts a typed secret (`credential` kind `SECRET` / `CLEAR`) from any session, a paired tablet or phone included, while the three camera-credential operations are web-console only. The key is sent to a loopback endpoint only (`apps/transcriber/src/backends/omlx-http.ts:70`) | Either add the condition to op 91 when the body carries a credential, or record why the STT key differs |
| S99-10 | NOTE | `npm audit --offline --json` -> all zero | The offline audit has no advisory data and proves nothing. A live audit is a network call and was not made. From the lockfile (read): `braces` 3.0.3 and `node-forge` 1.4.0 are the versions the record accepted (D19 / AU1-3; `gateway_check/01_b2_dependency_review.md:112-113`): root advisories **GHSA-vfj7-8cjw-p6xm** (braces, dev-time globbing) and **GHSA-86w9-cpqp-85rv** (node-forge, build-time Expo signing; DEMS signs with Ed25519 from `node:crypto`). `undici` 7.29.1 / 8.11.2. Whether a new root advisory was published since is NOT known | The test-run row or the user runs `npm audit --json` once online and compares the unique root advisories with these two |
| S99-11 | NOTE | `git diff c2c983b HEAD -- '*package.json'` | Runtime dependencies added by this task: `onvif` 0.8.3, `xml2js` 0.6.2, `yazl` 3.3.1 (`@types/yazl` dev), all exact pins; two new workspaces (`@dems/capture-protocol`, `@dems/transcriber`: `zod` 4.6.5 only). A second `xml2js` 0.6.0 is still at the root of `node_modules` for another dependent (SEC35-49 named the split). `onvif` brings every ONVIF write call into the process behind the one facade file (SEC35-49, record) | None new |
| S99-12 | NOTE | `apps/capture-worker/Makefile:39-45`; `THIRD_PARTY_NOTICES.md:362-374`; decisions D139, D208 (R96-3) | FFmpeg licence, facts only: the worker links `libavformat`, `libavcodec`, `libavfilter`, `libswresample`, `libavutil` dynamically through `pkg-config`; on this host they resolve to the Homebrew build, whose configuration includes `--enable-gpl --enable-version3 --enable-libx264 --enable-libx265`. The helper `.data/helpers/ffmpeg` is a copy of the same build. Neither is in git or in a release package. No record covers a DISTRIBUTED worker. No ruling here | User decision (section 6) |
| S99-13 | NOTE | `README.md:440`, `:568`; `apps/core-server/src/capture/adapters/camera/onvif-rtsp.ts:32`, `audio/usb-audio.ts:25` | `REAL_PRODUCTION` cannot operate at HEAD: no command provisions a production signing key, no production source has an opener, and the stored camera credential has no read path. Its refusals (development key, development source, camera stub, seal rig, source rig, fake microphone, installation identity) are proven by unit and boot-function tests, not by a started production Core | Keep stated; re-review when the first production opener lands (it activates S99-04 and SEC35-02) |
| S99-14 | NOTE | `apps/core-server/src/evidence-facts/index.ts:238-241`; `modules/transcripts/routes.ts:353-358`; `media-stream/service.ts:289-294` | The case scope (SEC35-16) covers playing, the sealed transcript, its revisions, export and download. It does not cover the item's metadata: list and detail of a REAL item, and the replicated state, go to every signed-in operator and paired device. That is the contract's wording; what the detail of a REAL item holds beyond identifiers was not read in this pass (hypothesis, not a finding) | Confirm with the privacy statement of SEC35-26 that metadata of real cases is meant to be visible to all roles |

Probe behind S99-04 (synthetic values, no real token):

```
in : { route: '/media/mts_<70 chars>/extra', url: 'http://127.0.0.1:4420/media/mts_<70 chars>', note: 'rtsp://user:pw@10.0.0.5/stream' }
out: {"route":"/media/mts_***/extra","url":"http://127.0.0.1:4420/media/mts_***","note":"rtsp://user:pw@10.0.0.5/stream"}
```

## 4. What was reviewed and found sound (read at HEAD)

| Area | Result | Evidence |
|---|---|---|
| Media session token `mts_` | HMAC-SHA-256 over payload + operator id + sign-in session id; MAC verified before any claim, constant time, one refusal code; 60 s expiry inside the MAC; 8 random bytes; view bit under the MAC; role, item and case scope read again per request; an answer in flight is cut when its sign-in session ends | `media-stream/token.ts:96-98`, `:131-158`; `service.ts:425-446`, `:481` |
| Export download token `exs_` | Same construction, another MAC label (domain separation), bound to export id + evidence id; job must be COMPLETE and of that item; path built from engine and token values only, `lstat` refuses a link; audit row before the first byte | `evidence-export/download-token.ts:40`, `:114-139`; `service.ts:268-322` |
| Tokens in logs | Request line holds the route pattern; an unmatched path is blanked by the shared rule (probe above); the dev proxy blanks the signed path on a proxy error | `plugins/logger/request-log.ts`; `logger-options.ts:216-256`; `apps/core-web/vite.config.ts:39`, `:66` |
| Per-fragment cipher | AES-256-GCM, 96-bit random nonce, 128-bit tag; AAD = label, track id, sequence, byte offset, key id; a record of another key is refused before decryption; nonce repeat refused inside a process | `credential-store/fragment-cipher.ts:107` (`fragmentAad`), `:145` (`createFragmentSealer`), `:181-187` (`openFragment`) |
| Session keys | One key per session, `O_EXCL` + `O_NOFOLLOW`, 0600 in 0700, owner checked on the handle; per-media-root folder; binding to the session instance; refusal at seal and at start (`SESSION_KEY_NOT_OF_SESSION`); no key crosses the sealer port. On this host: store folders `drwx------`, key files `-rw-------` | `credential-store/key-store.ts:181-237`; `index.ts:287-327`; `sealing-host/session-key.ts:51-78`, `:116-125` |
| Signing key and development mark | Development mark read from the certificate subject by the verifier, not from a manifest text; `REAL_PRODUCTION` refuses to start with a development key; the seal refuses a development key for production sources; `.compromised` marker stops loading | `packages/shared/src/evidence-verify/verify.ts:1091`; `capture/boot/index.ts:140-146`; `sealing/pipeline/pipeline.ts:799-800`; `capture/signer/host-key.ts:226` |
| Capture fence | One function reads the three flags; a refused combination answers `SIMULATED`; development flag refused beside a non-loopback listener, beside demo controls and in simulated mode | `capture/fence/operation.ts:71-86`; `fence/boot.ts` |
| Seal rig, source rig, camera stub | Each refused for `REAL_PRODUCTION` before the Core is started, and again by the product seam (`replace` and `developmentSealerOver` in the sealing host, `installDevelopmentSourceSwitch` in the fence, `developmentDiscoveryAdmissionOf`); FAKE-source sessions and devices only; no file under `src/` imports `test/support`; the switch words are closed sets held by pattern on both sides; `lane.sh` unsets the attendance and capture variables it does not set | `test/support/lane-seal-rig.ts:183-189`; `lane-source-rig.ts:156-162`; `sealing-host/index.ts:263-268`, `:627`; `capture/fence/index.ts:451-454`; `fence/development-discovery.ts:66`; `scripts/lane/lane.sh:193-205`, `:258-261`; static test run above |
| Reset and `--discard-unsealed-fake-recordings` | Command line only (the server never passes it); development lane only in `lane.sh`; four FAKE sources and no sealed item; `development_sources IS TRUE` plus the four-row cross-check; signed manifest verified before a folder is cleared | `db/reset/routine.ts:238-244`; `db/reset/real-evidence.ts:25-55`; `scripts/lane/lane.sh:389-394` |
| Process doors | Three spawn sites in the Core, all `shell: false`, empty or explicit environment, fixed argument tables; device name and ingest URL held by pattern; ingest and fixtures are `rtsp://127.0.0.1:<8554-8564>` | `capture/ipc.ts:56-62`; `adapters/local/process-door.ts:91-97`; `db/seed/demo-helper.ts:66`; `adapters/local/camera-helper-args.ts:98`, `:112`, `:132`; `packages/capture-protocol/src/index.ts:147-148`, `:508` |
| Production sources not recordable (SEC35-40) | The ONVIF and USB adapters refuse `openSource`; the registry refuses a kind without an opener | `adapters/camera/onvif-rtsp.ts:32`; `audio/usb-audio.ts:25`; `registry.ts:124` |
| Connection test target | IPv4 literal of the candidate only, no user part, no query, no fragment, bounded path; the confirmed text and the dialled target come from one function | `adapters/camera/connection-target.ts:26`, `:54` |
| STT endpoint | Loopback only, checked again in the client, redirects are errors | `apps/transcriber/src/backends/omlx-http.ts:55-70` |
| SQL | No request value is interpolated into a statement; interpolations are constants and quoted identifiers of the reset and the schema | grep over `apps/core-server/src` (22 sites read) |
| Range handling | One range, 15 digits at most, suffix and open forms, `416` with `content-range` | `media-stream/ranges.ts:11-36` |
| Web and mobile sinks | No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `WebView` or `srcDoc` outside tests; device names, transcript text and reasons are rendered as React text | grep over `apps/core-web/src`, `apps/mobile/src`, `packages/shared/src` |
| Origin rule (task 2, unchanged) | A cookie request with another origin is refused; a command with a cookie needs the web console origin; the listener is a constant | `plugins/origin-guard/origin-decision.ts`; `config.ts:37`, `:86-91` |
| RBAC of operations 76-97 | Reads 76 / 77 / 82 / 83 / 90 authenticated; configuration 78-80, 91-94, 97 `CAPTURE_CONFIG`; 81 `SESSION_START` + `SESSION_HOLDER`; 84 / 86 / 88 `EVIDENCE_VIEW`; 85 `TRANSCRIPT_REVISE`; 87 `EVIDENCE_EXPORT`; 89 / 95 / 96 `CAPTURE_CONFIG` + `WEB_CONSOLE_SESSION` | registry printed from `packages/shared/src/api` at HEAD |
| Repository | 10,290 tracked files; no key, `.env`, model or recording tracked; tracked media are the demo assets and one task-2 gate video; `.data/` is `drwx------` and ignored | `git ls-files`, `git check-ignore`, `stat` |

## 5. State of earlier security findings at HEAD

Status words: **fixed** (where), **accepted** (by which decision), **open**, **not built** (the
code the finding is about does not exist yet). Column "basis": read = verified by me in the code;
record = from the task's own gates and decisions.

| ID | Severity | Status at HEAD | Basis |
|---|---|---|---|
| SEC35-01 credential write operation | High | fixed: operation 89, web console only | read (registry) |
| SEC35-02 reveal function reach | High | not built: no caller of the capture reveal exists in `src`; the STT reveal has one module (`transcription/credential-reveal.ts`) | read |
| SEC35-03 key store for credentials | Medium | fixed: `credential-store/key-store.ts`; rotation leaves orphan keys (S99-05) | read |
| SEC35-04 credential URL and worker stderr | Medium | partly: stderr is captured by code, no URL is composed; the blanking rule is missing (S99-04) | read |
| SEC35-06 signer threat model | Medium | fixed in spec `06` section C.3; README states the development key | record |
| SEC35-07 signer key at rest, runbook | Medium | partly: 0600 / 0700, wrapped key, `.compromised` marker; read path weaker than the store's (S99-06); runbook is text | read |
| SEC35-08 session key store | Medium | fixed | read |
| SEC35-09 key loss, no escrow | Medium | accepted: no escrow (spec `05` D.2; README limits) - user confirmation still owed (section 6) | record |
| SEC35-10 GCM AAD | Medium | fixed: `fragment-cipher.ts:107` (`fragmentAad`) | read |
| SEC35-11 `fragments.json` coverage | Medium | fixed by V-02 | record (gate 12d) |
| SEC35-12 media token key, TTL, binding | Medium | fixed | read |
| SEC35-13 token prefix in blanking lists | Medium | fixed: `mts`, `exs` in the shared rule | read + probe |
| SEC35-14 STT key handling | Medium | fixed | record (review 19) |
| SEC35-16 case scope of REAL evidence | High | fixed: one predicate `holdsCase` on 84 / 85 / 86 / 88, media route, 42 / 87, download, `access.*`; confirmed by D24 Q-SEC-1 (a) | read |
| SEC35-17, -19, -21 | Low | fixed in contract | record |
| SEC35-18 `SESSION_HOLDER` | Low | fixed: op 81 carries it. R74-15: stop / recover / marker / note keep the permission only | read (registry); R74-15 record |
| SEC35-20 per-revision certificate | Medium | fixed (V-11). R88-14 (one trusted certificate after rotation) not re-checked | record |
| SEC35-22 code and audit-type counts | Medium | fixed | record |
| SEC35-23 RTSP ingest bind | High | fixed: loopback pattern and port range | read |
| SEC35-25 `src/capture` spawn allowlist | Medium | fixed: three spawn sites | read |
| SEC35-26 privacy, DPIA | Medium | open, carried: README "Privacy, personal data and custody" (`README.md:498-501`), limits row 26 "accepted risk". No DPIA, consent basis, retention or erasure rule exists | read |
| SEC35-27 outbound exemptions in the static scan | Medium | fixed | record (review 17) |
| SEC35-28 forged discovery answers | High | fixed in the collector (conflict mark, not testable) | record (review 17 PASS) |
| SEC35-29 search during a session, parser crash | High | fixed | record (review 17) |
| SEC35-31 credential phishing by a rogue responder | High | reduced, residual accepted: confirmed target text, operator-entered credential only, scheme rule, lock-out guard. A digest sent to a rogue device stays possible by design | read (`connection-target.ts`) + record |
| SEC35-32, -33 residual SSRF, hostile device | Medium | fixed / bounded | read (target rule) + record |
| SEC35-34 memory guarantee wording | Medium | fixed: the file states "no zeroing is claimed" (`connect/service.ts:19-24`) | read |
| SEC35-35, -36, -38, -39 | Low-Medium | fixed | record |
| SEC35-37 browser autofill, reveal, Try-it | Medium | fixed; gate check M4-SEC-UI-1 "PASS for what was driven; two parts NOT RUN" (`gateway_check/09b_m4_regate.md:76`) | record |
| SEC35-40 PRODUCTION label from a loopback push | High | fixed: production sources are not recordable | read |
| SEC35-41, -42 fence soft spots, reset exemption | Medium | fixed | read (`real-evidence.ts`, fence) |
| SEC35-43 helper program path | Low | fixed for the helper (owner and directories); the worker's libraries are outside the rule (S99-08). R69-15: the local device is matched by one literal name | read |
| SEC35-44 local recordings rest on a git-ignore line | Medium | accepted: `.data/` is 0700 and ignored; a backup or sync tool over `Documents` is not knowable from here | read (modes) |
| SEC35-45 `WEB_CONSOLE_SESSION` is not a factor | Low | accepted as stated | record |
| SEC35-46, -47, -48, -49 | Low-Medium | fixed / accepted | record |
| R69-01 no notice before a local device is opened | Major | fixed on the three clients; not enforced by the Core (S99-02) | read |
| R69-05 `holdsClearSecret` | Minor | second line only; `storeSealed` is first (`connect/service.ts:403-404`) | read |
| R69-06 two rules for the seed helper | Minor | not re-checked | - |
| R69-09 orphan credential keys | Minor | open (S99-05) | read |
| R69-14 limits of log layer 5 | Note | stands (message text and `%s` values are not blanked) | record |
| R80-04 PCM tap never removed | Major | fixed: `transcription/scratch.ts:71`, called at `transcription/index.ts:433` and by the reset | read |
| R88-04 media root readable by others | Major | fixed: `READABLE_BY_OTHERS` and three sibling refusals (`capture/boot/checks.ts:172-196`); D147 itself (plaintext until sealed) is **accepted** | read |
| R88-07 clients ignore `developmentKey` | Major | fixed: both clients read it (`integrity-tab.tsx`, `live-integrity-tab.tsx`, `verify-v2.ts`) | read (presence) |
| R88-08 development mark not anchored | Major | fixed: from the trusted certificate (`verify.ts:1091`) | read |
| R88-09 reset beside an unsealed recording | Major | fixed: unsealed folders block; rule (15) | read |
| R88-12 / G89-06 session key reused across sessions | Minor | fixed: binding, start refusal, reset destroys the lane's keys | read |
| R88-13 nonce guard | Minor | fixed and stated honestly (`session-key.ts:29-39`) | read |
| R93-05 export download without a token | - | fixed: `exs_` | read |
| R93-08 answer in flight after sign-out | Minor | fixed: cut every 8 pieces; token expiry does not cut an answer in flight (D-90-9 accepted) | read |
| R93-09 dev proxy prints the token path | Minor | fixed | read |
| R93-16 enumerable headers on mobile | Minor | not re-checked | - |
| R93-22 token visible to Resource Timing | Note | accepted (platform behaviour) | record |
| D147 plaintext on the media root until sealed | - | accepted by D147; removal after the seal is by proof (`sealing/pipeline/sealed-plaintext.ts`); the quarantine keeps plaintext until a person decides | read |
| `AUDIT_EXTRACT_NOT_SIGNED`, shortened revision list offline | - | accepted, stated limits; the notice exists in the verifier | read (presence) |
| braces GHSA-vfj7-8cjw-p6xm, node-forge GHSA-86w9-cpqp-85rv | High (advisory) | accepted risk (D19 / AU1-3); same versions in the lockfile; not re-measured (S99-10) | read (lockfile) + record |

## 6. Decisions the user still owes

| # | Decision | Why it is the user's |
|---|---|---|
| 1 | The demo password outside demonstration (S99-01): accept as a stated limit of a loopback demo, or require the boot refusal and an operator-provisioning path before `REAL_PRODUCTION` is called usable | It defines what "production" may mean for this repository |
| 2 | Server-side confirmation before a local device is opened (S99-02), or the client notice is enough for development capture | Privacy of the user's own camera and microphone (D163) |
| 3 | Retention of decrypted export archives (S99-03) | Spec `06` section G has no rule; evidence copies are not deleted silently |
| 4 | SEC35-26: legal basis, retention, erasure and a DPIA for recordings of real people | Carried since row 35; README row 26 says "accepted risk" without a recorded user decision that I found |
| 5 | SEC35-09: no key escrow - loss of `.data/credential-store` makes sealed footage unreadable | Custody policy |
| 6 | FFmpeg for a distributed Core (D139, D208 R96-3): GPL terms for the distribution, an LGPL-only build, or no FFmpeg shipped | Licence |
| 7 | Whether metadata of REAL items is visible to every role (S99-14) | Scope of SEC35-16 |

## 7. What was not checked, and why

| Not checked | Why |
|---|---|
| A live dependency audit | Needs the registry; network calls were excluded for this run. The offline run has no data |
| Any behaviour on a running Core, device or browser (cookies on the wire, CORS preflights, the connect dialog, playback) | No lane, device or browser in this run; the gates 09b-09d, 12b-12d, 13b-13d are the record |
| Verify checks V-01..V-15 one by one, the `sidx` builder, the hash chains, transcript revision signing and the `from` rule | Relied on gates 12d and 13d (both PASS WITH CONDITIONS) and reviews 20 / 21; only the entry points were read |
| The per-operator caches of the mobile app; R93-16; R69-06 | Not reached in this pass |
| ONVIF session internals (SEC35-28, -29, -33, -35, -36, -38) | Review 17 read them in full and passed them; only the target rule was re-read |
| The capture worker's C sources | Out of reach of this pass beyond the build file and the linkage |
| Contents of `.data/` | Forbidden by the brief; names and modes only |
| `masterplan/02_plan.md` tracking row | The plan has no row 99 / M9-CH-2 entry; nothing was edited there. `status_tasks.md` is the controller's |

---
*Generated: 2026-10-11 20:58*
