---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-09
agent: security-review
blueprint_row: 126
type: row record (tier 2) — security design review delta for R-9, R-10, R-11
status: complete
verdict: CAUTION
finding_ids: SEC35-27..SEC35-49
finding_counts: {Critical: 0, High: 4, Medium: 11, Low: 8}
deliverable: masterplan/09_security_design_review.md §11 (lines 438-773)
errata_marks: PE-126-01..PE-126-05
generated: 2026-10-09 15:04
---

# Row 126 — security design review delta (R-9 discovery and connect flow, R-10 notifications, R-11 development sources)

## 1. Status

| Item | Value |
|---|---|
| Status | **complete** |
| Verdict of the delta | **CAUTION** — 0 Critical; 4 High, 11 Medium, 8 Low (23 findings SEC35-27..SEC35-49) |
| Row's own verification | each of the six points has a finding ID, a severity and a mitigation mapped to a row of 129-142: **6/6**; Critical left without a mitigation: **0** |
| Files written | `masterplan/09_security_design_review.md` (new §11; two pointers; front matter; footer) and this record |
| Files not touched | every other spec, `11_audit_errata.md`, `identification/02_structured.md`, `decisions/decisions.md`, `02_plan.md`, the trackers, all code; `verification/02_security.md` was **not** written (the row's deliverable is the delta in `masterplan/09`) |
| Read-only actions outside the task folder | the published tarball of `onvif` 0.8.3 downloaded to the session scratch directory and read (not installed, not executed; its SHA-512 equals the registry integrity value); one 30-line script in the scratch directory that called the installed `xml2js` 0.6.0 on hostile input. No network probe, no camera or microphone opened, no credential handled |

Why CAUTION and not PASS: three High findings need a spec text changed before their implementing
row starts (SEC35-28, SEC35-31, SEC35-40) and one design claim is false as written (SEC35-34:
the credential cannot be zeroed in memory). Why not FAIL: nothing is Critical and every finding has
a mitigation inside rows that already exist.

## 2. Findings

Full text (where, risk, mitigation, check) is in `masterplan/09_security_design_review.md` §11.2-§11.9.

| ID | Severity | Point | Title | Mitigation in row | Check for row 127 |
|---|---|:-:|---|---|---|
| SEC35-27 | Medium | 1 | The outbound exemptions of the static network guard are not written; the guard would stay green while "the server opens no outbound connection" turned false | 131, 142, 61 | `M4-SEC-NET-1` |
| SEC35-28 | **High** | 1 | Forged probe answers: a clone silently replaces the real camera in the list ("the first source address is kept"), 64 forged responders crowd real cameras out, a spoofed source makes any on-link host a candidate | 131, 132, 137, 138 | `M4-SEC-DISC-2` |
| SEC35-29 | **High** | 1 | Searching is allowed while a session records, and one uncaught exception in the datagram handler ends the Core (`index.ts:95`); measured: an exception in the parse callback leaves `parseString` synchronously, a recursive walk overflows the stack inside the 16 KiB cap | 131, 132 | `M4-SEC-DISC-1`, `M4-SEC-DISC-3` |
| SEC35-30 | Low | 1 | What the probe reveals; it is sent on up to 4 interfaces of a multi-homed host; IPv4 only | 131, 132, class C-1 pack | `M4-SEC-DISC-4` |
| SEC35-31 | **High** | 2 | Credential phishing by a rogue responder: the package sends the account name in clear and a SHA-1 digest of the password on the first authenticated request, unasked — offline-attackable by the receiving device | 142, 137, 128 (texts) | `M4-SEC-CONN-1`, `M4-SEC-UI-1` |
| SEC35-32 | Medium | 2 | Residual SSRF / port-scan: port and path are the responder's choice; with a spoofed source the host is any on-link machine | 131, 142 | `M4-SEC-CONN-3` |
| SEC35-33 | Medium | 2 | A hostile device answering the test: unlimited body, no total deadline, no abort, unguarded reads in the package | 142 | `M4-SEC-CONN-3` |
| SEC35-34 | Medium | 3 | The stated memory guarantee (Buffer + zeroing) is not achievable; the real guarantee is "request-scoped, never serialised" | 128 (spec 05), 142, 137 | `M4-SEC-CRED-1` |
| SEC35-35 | Low | 3 | Non-ASCII passwords are hashed wrongly by the package (false refusals that count at the camera); the username is concatenated unescaped | 142, 137 | `M4-SEC-CRED-2` |
| SEC35-36 | Medium | 3 | The typed username is credential material; the shared blanking rule lets it through for op 89 and for ops 95 / 96 in text form | 142, 129 (next CHECK swap) | `M4-SEC-CRED-1` |
| SEC35-37 | Medium | 3 | Browser side: autofill of the operator's console password into the camera fields; save offers; OP-125-6 decided (reveal control allowed under four conditions); ops 95 / 96 into the Try-it deny list | 137, 142 or 132, 128 | `M4-SEC-UI-1` |
| SEC35-38 | Medium | 4 | The lock-out guard counts tests, a camera counts rejected requests (one failed test can be several); the threshold has no source | 142, 128 (constants) | `M4-SEC-CONN-2`, `M4-SEC-CONN-4` |
| SEC35-39 | Low | 4 | No per-operator bound on tests, no long-window bound on searches, a starved pre-check search; four constants disagree between specs 03 and 05 | 132, 142, 128 | `M4-SEC-RATE-1` |
| SEC35-40 | **High** | 5 | A package labelled `PRODUCTION` from whatever local process pushes into the unauthenticated loopback listener, in `REAL_PRODUCTION` with an adopted camera assigned | 136, 66, 71, 140, 141, 128 (texts) | `M5-SEC-SRC-1`, `M7-SEC-SRC-2` |
| SEC35-41 | Medium | 5 | Soft spots of the fence: class of a candidate found through the production adapter on loopback; no audit trace of the capture operation at boot; `DEFAULT 'FAKE'` | 136, 142, 61 | `M4-SEC-FENCE-1` |
| SEC35-42 | Medium | 5 | The reset-guard exemption for development packages: `NULL` must block, the summary column must be cross-checked | 129 | `M4-SEC-RESET-1` |
| SEC35-43 | Low | 5 | Helper processes: program-path checks, exact device-name match (a wrong match would record the screen), pipe-path ids, leftovers after a hard kill | 136, 134, 135 | `M4-SEC-HELPER-1` |
| SEC35-44 | Medium | 6 | Local-device recordings are protected by a git-ignore line only: cloud sync unknown, plain files until M7, agents must not open them with a viewing tool, no retention rule, no "microphone is on" indicator | 134, 135, 140, 137, 138, 128 | `M4-SEC-PRIV-1`, `M5-SEC-PRIV-2` |
| SEC35-45 | Low | + | `WEB_CONSOLE_SESSION` is a session property, not proof of a browser | 142, 128 | `M4-SEC-CRED-1` |
| SEC35-46 | Medium | + | Audit: the guard trip is not marked, and no record says which address a credential was sent to | 142, 128 | `M4-SEC-AUD-1` |
| SEC35-47 | Low | + | Op 96: the re-verification is a second exposure and does not bind the device; F-122-2 stays with row 84 | 142, 84 | `M4-SEC-ADOPT-1` |
| SEC35-48 | Low | + | Untrusted device text is stored and shown everywhere without sanitising at the source | 131, 137, 138 | `M4-SEC-TXT-1` |
| SEC35-49 | Low | + | The new dependency brings every ONVIF write operation into the process behind a call list; version of `xml2js` to be re-measured | 131, 142 | `M4-SEC-DEP-1` |

Six points of the row: 1 -> SEC35-27..30; 2 -> SEC35-31..33; 3 -> SEC35-34..37; 4 -> SEC35-38, 39;
5 -> SEC35-40..43; 6 -> SEC35-44.

## 3. Answers to the questions put with the row

| Question | Answer | Source |
|---|---|---|
| Which exemptions does the network guard need, and how narrow? | By file, pinned by name: `dgram` in `src/capture/adapters/camera/ws-discovery.ts` only; the package `onvif` (added to the forbidden list) in `…/onvif-session.ts` only, imported as `onvif/lib/cam`; `http` / `https` for the name `Agent` in that same file; `net`: none after D82 | SEC35-27; `network.test.ts:42-45`, `:148-152` |
| Do the username and password of ops 95 / 96 fall under `isCredentialKeyName`? | As an object, yes — the parent member `credential` blanks both. As text, only `secret`; the username survives. In the body of op 89 the username survives in both forms | SEC35-36; `redaction.ts:100-105`, `:137`, `:240` (read, not run) |
| Does `onvif` 0.8.3 ever send the password in clear or as Basic? | No — read in the source: `PasswordDigest` only, HTTP Digest only, a Basic-only challenge is not answered. H-21 confirmed by reading. But the digest is sent unasked on the first authenticated request, with the username in clear | `09` §11.1 P-1..P-5 |
| Does `xml2js` resist entity expansion and prototype pollution? | On the installed 0.6.0: yes, measured. The danger is our own code in the callback (rethrown synchronously) and recursive walks | `09` §11.1 (b) |
| Can a device token forge `WEB_CONSOLE_SESSION`? | No; but any HTTP client with an operator password and no device credential holds the condition | SEC35-45; `decision.ts:185-188` |
| Is an authentication-failed test audited? | Yes, one row per attempt for every outcome (`03:817-819`). Missing: the guard trip and the target address | SEC35-46 |
| Can configuration alone turn a production deployment into development sources? | Only by whoever starts the Core, after every production device was unassigned; the result is labelled development everywhere. The real bypass is the loopback listener | §11.6; SEC35-40 |
| Can the reset-guard exemption erase real evidence? | Not through the runtime role (no UPDATE grant on any of the three facts). Conditions: `IS TRUE` only, cross-check, count shown | SEC35-42 |

## 4. Decisions needed

**From the user.**

| # | Question | Recommendation |
|---|---|---|
| U-1 | Over plain HTTP a camera — or a device pretending to be one — receives the account name in clear and a digest of the password that can be attacked offline. Accept for this phase? | Accept, with the confirmation step in the dialog, a password used for that camera only, and a dedicated camera network when real cameras arrive |
| U-2 | Confirm D83 (O-5): a reset may erase packages recorded from development sources | Confirm, with the three conditions of SEC35-42 |
| U-3 | Is this repository's folder covered by a cloud-sync or backup tool? Recordings of the user's face and voice under `.data/` would leave this Mac. No agent will look this up | Answer before row 134; if yes, exclude `.data/` or move the data directory |
| U-4 | When may local-device test recordings be deleted? | After each gate of rows 134, 135, 140, by the command the row hands over, run by the user |
| U-5 | (Information, at class C) the lock-out rule of the target camera model | Before the first real connection test |

**For the controller to record.**

| # | Decision proposed |
|---|---|
| C-1 | OP-125-6: a reveal control for the value being typed is allowed — off by default, hidden again on blur, submit and close, never for a stored value, never on in a gate capture |
| C-2 | Lock-out guard default: 2 `AUTHENTICATION_FAILED` per host in 30 minutes, with at most 2 rejected credential-bearing requests per failed test; stated in row 142 as a conservative default without a source |
| C-3 | `host` and `endpointRef` in `CAPTURE_CONNECTION_TESTED` and `CAPTURE_CANDIDATE_ADOPTED` for `PRODUCTION` candidates (lifts "never the host" for those two types; compatible with D75 — the audit table is in the git-ignored cluster) |
| C-4 | Searching while `RECORDING` is switched on only after `M4-SEC-DISC-1` and `M4-SEC-DISC-3` pass; until then op 93 answers `409 INVALID_STATE` in that state |
| C-5 | No listener and no session start for a source kind without an opener; in this phase no all-`PRODUCTION` package can be sealed |
| C-6 | The typed camera username is credential material |
| C-7 | Agent rules: no viewing tool on local-device media or its frames; no device-identifying value (address, MAC, serial) in tool output of the real-LAN check |
| C-8 | Row 128 reconciles: search window 3,000 vs 5,000 ms; test deadline 15 s vs 10 s; failure window 10 vs 15 minutes; search spacing per Core vs per session; R-9 AC-7 and blueprint row 142 ("credential only from operation 89") against D81 |

## 5. Hand-over to the spec gate (row 128)

| Spec | Correction | Finding |
|---|---|---|
| `05_capture_architecture_spec.md` §A.6.1 (`:480`, `:489-494`) | conflict rule instead of "the first source address is kept"; excluded source addresses; one answer per source; registered-first cap; close at the datagram cap | SEC35-28 |
| same, §A.6.1a (`:530-533`), §J H-14 | pinned parser options; handler containment; fixed-path reads | SEC35-29 |
| same, §A.6.2 (`:571-594`), §A.8.1 ST-4, §G.1 G-R10 | remove the RTSP half (D82); pre-authentication calls without a credential; request budget; per-test agent with deadline and byte cap; facade | SEC35-27, 33, 38 |
| same, §A.6.3 CR-2, CR-3, CR-5 (`:601-604`) | the real memory guarantee; honest "digest" wording | SEC35-31, 34 |
| same, §A.1.1 RG-1 (`:156`), §A.1.2 rows 1-2 (`:203-204`) | class by how a candidate was found; `REAL_PRODUCTION` records nothing in this phase | SEC35-40, 41 |
| same, §A.6.4, §A.7.1 ML-2, §G.1 G-R9 / G-R11 / G-R12 | helper path checks, exact-name rule, id patterns, leftover check; the guard exemptions | SEC35-27, 43 |
| `03_api_contract.md` §2.6 shapes (`:411`, `:418-430`) | `conflict`, `addressChanged`, `interfaceCount`; character sets of `username` / `secret` | SEC35-28, 30, 35 |
| same, §2.6 rules (`:443`, `:457`, `:459`), §7 (`:1003-1016`) | gate of C-4; limit set; guard; one value per constant | SEC35-29, 38, 39 |
| same, §5.2 (`:817-847`), §0 (`:97`), access notes (`:397-400`), §2.6 "Adoption" (`:452`) | `guardTripped`; `host` / `endpointRef` if C-3; wording of `WEB_CONSOLE_SESSION`; profile comparison | SEC35-45, 46, 47 |
| `01_specs.md` R-9 AC-7 (`:293`), R-11 AC-8 (`:331`), C-N13 (`:396`) | AC-7 against D81; the docs rule for local-device media; name the findings | SEC35-44 |
| `06_evidence_package_spec.md` §H.5 (`:867-872`) | the loopback-ingest case and the guard "the Core itself opened the source" | SEC35-40 |
| `04_database_contract.md` §E.2, N.10 (`:1343`), N.15 O-5 (`:1466`), N.6 | guard predicate and cross-check; forbidden-key additions | SEC35-36, 42 |
| `08_client_ux_spec.md` §8c.3, §8d.2, §8d.3 (`:797`, `:804-809`), §8f, §15.3 | conflict rows; confirmation tick; field attributes; reveal control; "is on" indicator; "Searched N networks" | SEC35-28, 30, 31, 37, 44 |
| `identification/02_structured.md` rows 66, 71, 131, 142 (task-architect) | the refusal of SEC35-40; row 142's credential-source wording | SEC35-40 |
| `05` §J | hypotheses H-22..H-26 of `09` §11.11 | — |

## 6. Checks for row 127 (24)

| Check | Proves | Method / depth | Row |
|---|---|---|---|
| `M4-SEC-NET-1` | the two pinned outbound files and no third | static, positive controls | 131, 142 |
| `M4-SEC-DISC-1` | hostile datagrams never stop the Core | unit on the stub, fake clock | 131 |
| `M4-SEC-DISC-2` | clone, crowd-out and spoofed-source rules | unit on the stub | 131 |
| `M4-SEC-DISC-3` | a hostile flood during `RECORDING` does not disturb the session | integration with the fake worker, 2 runs | 131, 132 |
| `M4-SEC-DISC-4` | interface count only; 0 identifying values in output and committed files | unit + the real-LAN check (2 + 1) | 131 |
| `M4-SEC-CONN-1` | the password never leaves in clear, Basic or base64 | stub request log | 142 |
| `M4-SEC-CONN-2` | at most 2 rejected credential-bearing requests per failed test | stub request log | 142 |
| `M4-SEC-CONN-3` | hostile device answers and service addresses are bounded | stub | 142 |
| `M4-SEC-CONN-4` | lock-out guard semantics | unit, fake clock | 142 |
| `M4-SEC-CRED-1` | username and secret canaries: 0 hits anywhere, device-bound session included | integration + web, per run | 142, 137 |
| `M4-SEC-CRED-2` | rejected character classes -> 422, 0 outbound | unit | 142 |
| `M4-SEC-UI-1` | fields stay empty with a saved console login; confirmation tick; reveal control; Try-it deny list of 10 | agent-browser, 2 + 1 | 137 |
| `M4-SEC-RATE-1` | every rate bound | unit, fake clock | 132, 142 |
| `M5-SEC-SRC-1` | `REAL_PRODUCTION` session start refused, 0 listeners, 0 evidence | integration + socket snapshot, 2 runs | 140 (with 66, 71) |
| `M7-SEC-SRC-2` | every package of this phase has `developmentSources = true` | server check, 2 + 1 | 141 |
| `M4-SEC-FENCE-1` | each row of the boot table; loopback candidate never `PRODUCTION`; boot audit row; INSERT pin | unit + static | 136, 61 |
| `M4-SEC-RESET-1` | reset guard predicate and cross-check | throw-away database, 2 runs | 129 |
| `M4-SEC-HELPER-1` | helper path, argument, name-match and id rules | unit + static | 136, 134, 135 |
| `M4-SEC-PRIV-1` | no local-device media, frame, waveform or transcript in git or `docs/`; no viewing tool; no permission-database tool; deletion command handed over | gate check of each row | 134, 135, 140 |
| `M5-SEC-PRIV-2` | the "is on" indicator on three clients | agent-browser / emulator, 2 + 1 | 137, 138 |
| `M4-SEC-AUD-1` | guard trip marked; refusals unaudited; host per C-3 | unit | 142 |
| `M4-SEC-ADOPT-1` | profiles changed between test and adoption -> 409, 0 rows | stub | 142 |
| `M4-SEC-TXT-1` | hostile device text is sanitised and drawn as one line | unit + clients | 131, 137, 138 |
| `M4-SEC-DEP-1` | lockfile integrity of `onvif` equals the reviewed value; audit after install | install log | 131 |

Also: `X-SEC-1` gains the device-identifying patterns from row 131 on; the pinned total of Try-it
denied operations (`03_api_contract.md:1151`) becomes 10.

## 7. Erratum rows for `masterplan/11_audit_errata.md` (not edited by this row)

Line numbers are after the edit (`grep -n`, 2026-10-09 15:04). The pre-edit copy is in the session
scratch directory (`09_pre_row126.md`); `git diff` of the file shows 350 insertions and 2 deletions (the two replaced lines are the front-matter and footer date lines).

| document:line | before | after | mark | source |
|---|---|---|---|---|
| `masterplan/09_security_design_review.md:27-28` | front matter `last_updated` (status sweep) | row-126 entry prepended; new key `delta_row_126` with the verdict and counts of the delta | PE-126-01 | blueprint row 126; D73-D84 |
| `masterplan/09_security_design_review.md:40-43` | — | pointer under the row-35 verdict: the new scope is reviewed in §11 with its own verdict; counts not merged | PE-126-02 | row 126 |
| `masterplan/09_security_design_review.md:368-371` | §6 ended at "The only exposure-shaped gap is the unpinned RTSP ingest bind (SEC35-23)." | pointer: one bounded exception (discovery socket) and the first outbound connections; table in §11.8 | PE-126-03 | D75; `01_specs.md` C-N13 |
| `masterplan/09_security_design_review.md:438-773` | — | new section 11: frame, evidence, findings SEC35-27..SEC35-49 by the row's six points, socket summary, hand-over, hypotheses H-22..H-26, decisions, GDPR / ISO view, self-gate | PE-126-04 | rows 120-125; D72-D84 |
| `masterplan/09_security_design_review.md:777` | footer `Last Updated` (status sweep) | row-126 entry prepended | PE-126-05 | row 126 |

## 8. Limits of this review

| Limit | Consequence |
|---|---|
| The `onvif` source was read, not run | H-22..H-24 are for row 142 to prove on the stub |
| `xml2js` was measured at 0.6.0; the package asks for `^0.6.2` | row 131 repeats the measurement on the pinned version |
| `redaction.ts` was read, not run | `M4-SEC-CRED-1` includes the unit cases |
| No camera's lock-out rule has a source here | the guard default is conservative and labelled so (H-25, U-5) |
| Browser password-manager behaviour not measured | H-26, `M4-SEC-UI-1` |
| Whether the folder is synced or backed up is not known and was not looked up | U-3 |
