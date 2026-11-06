---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 13
date: 2026-10-12
agent: security-review
type: security assessment of a design and a plan (no code exists yet)
narrative_tier: 1
source_plan: masterplan/02_plan.md (v1.1)
verdict: CAUTION
fail_count: 0
caution_count: 17
relay_f1: ACCEPT, conditional (conditions RC-1 to RC-6)
status: complete
---

# Security assessment of the port design and plan (row 13)

> **Ringkasan (Bahasa Indonesia).** Putusan keseluruhan: **CAUTION, 0 FAIL**. Implementasi boleh dimulai; 17 temuan harus menjadi persyaratan paket kerja yang disebut namanya. **Relay (F-1, varian A): DITERIMA dengan syarat** (RC-1 sampai RC-6); bila syarat RC-1 gagal dan tidak ditutup di worker, cadangan yang sudah Anda putuskan (worker menarik sendiri) berlaku. Tiga hal yang paling penting: (1) pustaka RTSP yang dipakai relay, menurut pengetahuan peninjau dan belum diuji di sini, akan menjawab tantangan "Basic", sehingga kata sandi kamera bisa terkirim terang di LAN kamera; relay harus menolak selain Digest. (2) Jawaban atas SEC35-40 bergantung pada percobaan E-11 yang belum dijalankan. (3) `apps/input-av/data/` hanya dilindungi oleh satu baris di berkas `.gitignore` yang sendiri tidak terlacak; satu `git stash -u` atau `git clean -fd` melepas perlindungan itu, dan folder tersebut bisa dibaca oleh grup `staff`. Helper ber-hak root harus menjadi batas penegakan itu sendiri, karena pengguna layanan Core dapat memanggilnya langsung tanpa melewati peran, audit dan aturan "hanya saat idle". Isi prosedur instalasi helper ada di bagian 5.4.

## 0. Frame (5W1H), method, limits

| Question | Answer |
|---|---|
| **What** | A rating, PASS / CAUTION / FAIL, of seven areas of the port design: the camera credential path, the relay of fork F-1 against finding SEC35-40, the privileged alias helper, the network-changing actions and the typed-address probe, evidence and records including the legacy data folder, the interim rule for the bench and the development on doubles, and amendments AM-1 to AM-8. |
| **Why** | Blueprint row 13 (`identification/02_structured.md:149,171`); constraint C6, "the Core's existing guarantees are not weakened" (`identification/01_translated.md:64`); lift condition L-2 and phase 10 entry condition 2 wait for this row (`masterplan/01_specs.md:246`; `masterplan/02_plan.md`, phase 10). |
| **Who** | Reviewer: security-review agent. Decision owner: the user; small matters the controller under U12 B2 (`decisions/decisions.md:24`). Rework rows: 8 (design) and 10 (plan), or the named work package. |
| **When** | 2026-10-12, wave 6, before any code is written. Line numbers are of that day's working tree. |
| **Where** | Documents of `docs/2026-10-12_input_av_core_adapter_plan/`; code of `apps/core-server`, `apps/capture-worker`, `apps/input-av` (source only), read-only. |
| **How** | Reading. Nothing was built, started or bound to a port; no network request was made. Nothing under `apps/input-av/data/` and no `.env` was opened, listed or read. One `ls -ld` was made on the directory entry `apps/input-av/data` itself (owner, group, mode); its content was not listed. Credential-like text in input-av's documents was counted, never printed. The Graft graph was not queried (it refreshes itself, which writes outside this folder). |

**Abbreviations.** `SPEC` = `masterplan/01_specs.md`; `PLAN` = `masterplan/02_plan.md`; `DB` = `masterplan/03_db_schema_extension.md`; `REG` = `decisions/01_decision_register.md`; `DEC` = `decisions/decisions.md`; `T3` = `docs/2026-10-07_dems_real_capture_sealing`; `CORE` = `apps/core-server/src`; `WRK` = `apps/capture-worker/src`; `IAV` = `apps/input-av`.

**Hypotheses.** A statement about how the FFmpeg libraries, the `onvif` package, `sudo`, or the Linux kernel behave is the reviewer's knowledge and was not run or read in source here. Each is marked HYPOTHESIS (HS-n) and names what settles it. A requirement that rests on a hypothesis is written so that it holds either way.

**Severity.** FAIL = blocks the start of implementation. CAUTION = must become a requirement of the named work package before that package closes; where a CAUTION is marked **gate**, the package may not start, or the lift may not happen, until it is met. NOTE = recorded, no requirement.

## 1. Verdict

**Overall: CAUTION. FAIL items: 0. CAUTION items: 17 (6 high, 9 medium, 2 low). The relay of fork F-1 is ACCEPTED on conditions RC-1 to RC-6.**

| # | Area | Rating | C6 guarantee weakened by the design as written? | Rework |
|---|---|---|---|---|
| 1 | Camera credential path | CAUTION | Yes, in one place: the RTSP leg has no "digest only" rule (S13-01). Otherwise kept | WP-02, WP-03, WP-06, WP-22; row 8 for the wording |
| 2 | Relay (F-1 A) against SEC35-40 | CAUTION, **ACCEPT** | Not if RC-1 to RC-6 hold. RC-1 is unproven today | WP-01 (E-11), WP-03, WP-06, WP-11, WP-14 |
| 3 | Privileged alias helper | CAUTION | A new privilege on the evidence host. Bounded only if the helper enforces its own limits (S13-08) | WP-19, WP-14, WP-20 |
| 4 | Camera network set, scan, typed probe | CAUTION | No guarantee removed; a new outbound reach that the design does not yet bound by rule | WP-19, WP-22, WP-12 |
| 5 | Evidence and records | PASS for the Core's sealing, audit chain, RBAC and schema sets A to C; **CAUTION** for the legacy folder | The Core's: no. The legacy folder is outside the Core's guarantees and is the weakest point of the repository | Phase 0; WP-21; WP-27 |
| 6 | Bench interim rule and doubles | CAUTION | No | Phase 0; WP-03; WP-19; WP-27 |
| 7 | Amendments AM-1 to AM-8 | CAUTION (AM-1, AM-2, AM-3); PASS (AM-4 to AM-8 with area 4's limits) | AM-1's replacement is unproven until E-11 | WP-13 (lift), WP-05, WP-12 |

Why no FAIL: nothing is built, every weakness found has a concrete requirement that fits a work package the plan already has, and the plan's own gates (L-2, L-3, phase 10 entry condition 2, installation by the user) sit before the points where harm could occur. Two findings turn into a FAIL if their gate is skipped: S13-01 and S13-05.

## 2. Ranked findings

Rank order is the order of work. "Gate" names the point that may not be passed without it.

| Rank | Id | Sev. | Finding, one line | Work package | Gate |
|---|---|---|---|---|---|
| 1 | S13-14 | High | The legacy folder is protected by one line of an untracked ignore file; `git stash -u` or `git clean -fd` removes that protection; the folder is group-accessible | Phase 0 (before the baseline commit); WP-21 moved forward | first git write of phase 0 |
| 2 | S13-01 | High | No rule that the relay answers a Digest challenge only; a Basic challenge would put the camera password on the camera LAN in clear (HS-1) | WP-03 (and WP-05 probe mode) | L-3 |
| 3 | S13-05 | High | SA-2 is unproven: experiment E-11 has not run; the listener may accept a push on any path (HS-3) | WP-01 (E-11), WP-06 | start of WP-03; L-2 |
| 4 | S13-08 | High | The helper, not the Core, is the enforcement boundary: the service user can call it directly, past role, idle rule, wrong-network guard and audit | WP-19 | user installation (UA-3) |
| 5 | S13-11 | High | Outbound requests of scan, set-IP and typed probe have no destination rule: private ranges, camera interface only, port, rate | WP-19, WP-22, WP-12 | each package's close |
| 6 | S13-15 | High | Cameras registered in input-av have their passwords in plain text in the legacy database; adopting them unchanged leaves a readable copy of a "sealed" credential | WP-27 (procedure), WP-15 | stage 2 |
| 7 | S13-02 | Medium | Relay process hygiene is not specified: library log text, core dumps, same-user memory read, program path rule | WP-02, WP-03 | L-3 |
| 8 | S13-06 | Medium | SA-3 does not define "push established", and does not cover a resumed push if WP-11 lands | WP-06, WP-11 | L-2 |
| 9 | S13-07 | Medium | Other local users can reach the loopback listener; the relay parses camera data with the Core's rights | WP-14, WP-03, WP-20 | stage 2 |
| 10 | S13-09 | Medium | The `sudo` path forbids `NoNewPrivileges` and a capability bound on the process that holds evidence and keys | WP-14, WP-19 | decision row before WP-19 closes |
| 11 | S13-10 | Medium | Alias cleanup rests on an unproven kernel lifetime (H-S); no orphan sweep; no intent audit before the act | WP-19, WP-23 | WP-19 close; H-06 |
| 12 | S13-12 | Medium | Device text handling in the ported calls: fault text, names, tokens, XML | WP-19, WP-22 | each package's close |
| 13 | S13-03 | Medium | Digest over plain HTTP and RTSP was accepted for the development network only (D87 (2)); production needs its own acceptance and host rules | WP-14; decision row | stage 2 |
| 14 | S13-04 | Medium | The set-IP job sends an authenticated request to the new address; lock-out guard must cover the fourth operation and the RTSP leg | WP-22, WP-05 | WP-22 close |
| 15 | S13-16 | Medium | Doubles and scripts: the test seam of the helper, fixture credentials, the secret scan list, the acceptance scripts | WP-19, WP-03, WP-27, phase 0 | each package's close |
| 16 | S13-13 | Low | `installation_acceptances.diagnostics` and `steps` are free JSON with no forbidden-key check; device text enters `source_facts` | WP-24, WP-26 | each set's close |
| 17 | S13-17 | Low | Evidence specification section H.5 must state the new guard at the lift | WP-13 | stage 1 |

Notes (no requirement): N-1 to N-6, section 9.

## 3. Area 1: the camera credential path. CAUTION

### 3.1 The path as designed, step by step

| Step | Design | Evidence | Rating |
|---|---|---|---|
| Typed where | Web console only (D80(3)); body of operations 89, 95, 96 and one new fourth operation for set-IP | `SPEC:423` (DR-8); `REG:440` (AM-7) | PASS |
| Sealed how, in memory | `SealedCredential`: no enumerable member, fixed mark when printed, read only by `usingCredential` and `credentialAtInjection` | `CORE/capture/adapters/credential.ts:37-51,69-71,122-125` | PASS |
| Stored how | Only through adoption into `capture_device_credentials` (AES-GCM envelope, `key_ref` into the credential store, no SELECT for the runtime role beyond `device_id`) | `CORE/db/schema/capture.ts:157-188`; `CORE/db/schema/index.ts:48-49` | PASS; no new table holds a secret (section 7.2) |
| Handed to the relay how | One start message on the relay's standard input, built at `credentialAtInjection`, through a second pinned process door; environment handed over explicitly, empty by default | `SPEC:59,132,137,226`; today's door closes standard input: `CORE/capture/adapters/local/process-door.ts:96`; environment rule `:11-12,92` | PASS as a channel. The worker's door already carries frames this way (`CORE/capture/ipc.ts:19,62`). Requirements in S13-02 |
| Sent to the camera, ONVIF | Digest only: WS-UsernameToken `PasswordDigest` or HTTP Digest; a Basic challenge is answered with nothing (`SCHEME_NOT_ALLOWED`) | `CORE/capture/adapters/camera/onvif-session.ts:19-31,143-153,333-340` | PASS for the built connection test. The set-IP file is new (S13-04) |
| Sent to the camera, RTSP | **Not stated.** The design says "RTSP over TCP toward the camera, set by the relay" and nothing about the authentication scheme | `SPEC:221,226`; `SPEC:423` covers ONVIF only | **CAUTION, S13-01** |
| Set-IP job | Retyped per job, used for that job, never kept (C1) | `DEC:28` | PASS; S13-04 |

input-av as built, for contrast, and never to be carried: the password inside the stored URL (`IAV/nvr/onvif_client.py:262-263,275-283`), stored in plain text beside it (`IAV/nvr/registration.py:62-65`), and HTTP Digest tried on any 401 (`IAV/nvr/onvif_client.py:117-120`). The design excludes all three (`SPEC:65,119`).

### 3.2 Findings

**S13-01 (High, gate L-3). The RTSP leg has no "digest only" rule.**
- Risk. HS-1: libavformat's RTSP client takes the account from the user part of the URL it is given and answers whatever scheme the server challenges with, Basic included. A camera set to Basic, or any device on the camera LAN that answers at the camera's address with a Basic challenge, then receives the password in a reversible form. The Core's ONVIF path refuses exactly this (`onvif-session.ts:25`); the relay as specified does not. This is the forged-responder case of SEC35-31 (`T3/decisions/decisions.md:99`) on a second protocol.
- Not a difference between variants A and B: the worker pulling by itself would use the same library.
- Requirement (WP-03; WP-05 for probe mode). (a) The relay sends a credential only in answer to a Digest challenge; a challenge of another scheme ends the open with a code equal in meaning to `SCHEME_NOT_ALLOWED`, and no request carrying the credential leaves. (b) Test added to E-12: a fake camera that challenges Basic; pass when the fake receives 0 requests with an `Authorization: Basic` header, in record mode and in probe mode, 2 runs each. (c) If the pinned library cannot be held to this without a change to the library, the work stops and the user decides (a patch to the pinned build, or a written acceptance of Basic for one named camera model). It is not a controller decision.
- Settles HS-1: the test of (b).

**S13-02 (Medium, gate L-3). Relay process hygiene is not specified.**
- Risk. HS-2: the library has no separate credential option for RTSP, so the relay must compose the user-part form in its own memory. The Core's rule "nothing in the Core composes the user-part form" (`credential.ts:9-10`) then needs a stated exception for one process, and that process needs rules: the library prints URLs in its own log messages; a core dump or a same-user debugger reads the memory; finding SEC35-04 (`T3/masterplan/09_security_design_review.md:232`) was about exactly this text reaching a log.
- Requirement (WP-02, WP-03). (a) The relay installs its own library log callback and writes codes and counters only, never library message text (precedent: the worker counts open errors, `WRK/ingest.c:86-91`); it never prints a stream description. (b) Both output streams of the relay are read into bounded buffers and used for classification only, as the local door does (`process-door.ts:13-14,48-49`); anything kept passes `blankCredentialLocators` (`credential.ts:135-137`). (c) At start the relay sets its core-dump limit to 0 and, on Linux, marks itself not dumpable; the start message buffer is overwritten after use (best effort, no claim of erasure, as CR-3). (d) The start message is never echoed, and a failed write to a dead relay raises an error that names no part of the message. (e) The relay program path passes the existing program rule (root-owned or server-owned, no group or other write, directories likewise; `CORE/capture/adapters/local/helper-program.ts:6-12`) and a boot check names a failure. (f) The exception to the composing rule is written into the design as an erratum that names the relay as the one process. (g) E-12 searches, besides the four places the plan names (`PLAN`, phase 3), the relay's outputs in three failure runs (wrong password, unreachable camera, malformed description), the process listing and the process environment during a run, and every line the session persisted.

**S13-03 (Medium, gate stage 2). Digest on an unencrypted camera LAN in production.**
- Evidence. Rule CR-5 accepts the account name in clear and an offline-attackable digest "on the development network, D87(2)" (`research/02_collection_rulings.md:340`); the design carries the same wire form to production cameras (`SPEC:459`, SN-4).
- Requirement. (a) A decision row by the user, before stage 2, that accepts digest authentication over plain HTTP and RTSP on the production camera LAN, or names the alternative. (b) WP-14, host profile: the camera interface is a dedicated port on a dedicated switch; forwarding between the camera interface and any other interface is off and checked at boot (WP-20); (c) WP-27, procedure: the factory account's password is replaced in the camera's own page before the camera is adopted, and the new password is long enough that a captured digest is not practical to attack (the procedure gives the length rule).

**S13-04 (Medium). The set-IP job and the lock-out guard.**
- Evidence. input-av reads the MAC with the credential at the old address, then polls the **new** address with the credential every 4 s for up to 180 s (`IAV/nvr/factory.py:160,176-181`). Whatever answers at the new address receives a digest each time. The Core's guard counts rejected credential-bearing requests per host (`CORE/modules/capture-discovery/connect/limits.ts:16-31`); the plan does not say that the fourth operation or the RTSP probe count against it.
- Requirement (WP-22). (a) The new address is polled without a credential first (the unauthenticated time read); the authenticated MAC read is made once, after that read answers, and at most 3 times in the job. (b) The credential of the job is a `SealedCredential` held in the job's closure, never in a module-level value or a job record; it is dropped on every exit: success, failure, timeout, abort, Core shutdown. A static test holds the file to "no member named for a credential outside the one call site". (c) The fourth operation and its requests count against the same lock-out guard and the same single-flight and spacing bounds as operations 95 and 96. (d) WP-05: a refused RTSP authentication counts as a refused credential-bearing request.
- Hypothesis H-V of the design (`SPEC:448`), judged here: keep the guard keyed by host. It under-permits (two refusals for camera A block camera B on the same factory address for 30 minutes), which is the safe direction; a successful set-IP clears the entry of the old address, because the camera has left it. No reset control for the technician is needed. NOTE, not a requirement beyond (c).

**Controller decision C1 (retyped per job, never kept): supported.** It adds no stored secret and keeps "lifetime = one call" (`DEC:28`; `REG:447`).

## 4. Area 2: the relay in front of the worker (F-1, variant A). CAUTION; ACCEPT

### 4.1 What SEC35-40 says, in full

Finding SEC35-40 (`T3/masterplan/09_security_design_review.md:638`; High): the worker listens on `127.0.0.1`, takes the first RTSP push, has no pull path and no authentication; in `REAL_PRODUCTION` "any local process that pushes a stream during the window is recorded, and the Core signs a manifest whose every source reads `PRODUCTION`", "reachable without the signing key and without changing code or configuration". Its remediation (3) names the entry criterion of class C-2: "the pull path (the recording process dials the camera, so no listener exists) **or a per-session ingest secret**; `06` section H.5 gains the guard 'the Core itself opened the source'". The finding's text covers the camera listener only, which confirms hypothesis H-Q of the design (`SPEC:312`).

So measure SA-2 is one of the two forms the earlier review itself accepted. The question is whether it is enforced, and by what.

### 4.2 What listens where, who can connect

| Point | Fact | Evidence |
|---|---|---|
| Listener | The worker, on `127.0.0.1`, ports 8554 (`VIDEO-01`) and 8556 (`VIDEO-02`), for the listen window; TCP only; the worker ends fatally if any of its sockets is not a loopback stream socket | `CORE/capture-session/index.ts:153,1056`; `WRK/ingest.c:482-484,94-108` |
| Today's address | Predictable: `/<sessionId>/<track>` | `CORE/capture-session/index.ts:1056` |
| One connection | The ingest takes one session and ends on its teardown | `WRK/ingest.c:540` |
| Who can connect | Any process of any local account: a loopback TCP port has no owner check | by construction |
| How the worker learns the address | In the plan frame on its standard input, not in an argument | `CORE/capture/ipc.ts:10-19,62` |
| The relay | Listens nowhere by design; dials the camera and the loopback port | `SPEC:59` |
| What the worker logs at connect | Port, codec, size, parameter-set length. Not the address | `WRK/ingest.c:525-526` |

### 4.3 What a local unprivileged process could do, with SA-1 to SA-3 as designed

| Attack | By another local account | By a process running as the Core's user |
|---|---|---|
| Push a stream and have it sealed as that camera | Stopped by SA-2 **if the listener enforces the path** (RC-1), and by the firewall rule of RC-5 before it reaches the port. Without RC-1: reaches the worker; SA-3 then turns it into a fault, if "established" is defined as in RC-3 | Can read the run directory and, with a debugger, the plan; defeats SA-2. Stated by the design (`SPEC:312`). This account already holds the database role, the credential store and the signing path: nothing new is exposed |
| Take the single connection so the real camera cannot record | Possible without RC-5 (a detected capture fault, availability only). Stopped by RC-5 | Possible; detected |
| Read the camera stream | No: the listener sends no media | Yes, by other means it already has |
| Read the camera credential | No: it is in a pipe between two processes of the Core's user | Yes with a debugger unless S13-02 (c); limited by it |
| Inject microphone audio | No, if the pipe is mode 0600 in a 0700 directory (RC-6) | Yes; same residual as the camera |

### 4.4 Decision

**ACCEPT variant A, on these conditions.** The fallback the user ruled (the worker pulls, variant B) applies only if RC-1 cannot be met.

| # | Condition | Work package | Check |
|---|---|---|---|
| RC-1 (**gate**) | Experiment E-11 runs before WP-03 starts and shows: a push addressed to any other path than the session's is never recorded: the worker does not reach `ingest_connected` for it, and 0 bytes of it reach a file. HS-3: the reviewer expects the library's listen mode **not** to compare the path. If E-11 confirms that, the path comparison is added to the worker's ingest before the stream is probed (a small change; "unchanged worker" then no longer holds and the worker's suite is re-run), or variant B is taken. Either is acceptable to this review; accepting a push on any path is not | WP-01 (E-11); then WP-06 or the worker | E-11, 2 runs: wrong path; right path from a second client after the first |
| RC-2 | The ingest secret is at least 128 bits from the system's random source, one per session attempt and per track, in URL-safe text. It exists in the plan frame and the relay's start message only: not in a log line, an audit detail, a database row, an error text or a file. A static test and one runtime search hold this | WP-06 | search for the secret of a test session in the log sink, the audit table and the session tables: 0 hits |
| RC-3 | SA-3 defined: a camera counts as open only when (i) the relay of that slot reports that the worker answered its record request with success, and (ii) the worker's connect report for that port arrives within a stated bound of it. A worker connect report without (i), or (i) without (ii), ends the track as a capture fault with an audit entry; nothing of that track is sealed as that camera. A completed TCP connect alone is never "established" | WP-06 | the plan's check "a foreign push ends the track as a fault" (`PLAN`, phase 3) run in both orders: foreign client first, relay first |
| RC-4 | If WP-11 lands (the ingest accepts a resumed push), every resumed connection is held to RC-1 and RC-3 again; a resumed push that no relay of the session attests is a fault | WP-11 | one test: foreign client connects in the gap |
| RC-5 | Host profile: a firewall rule lets only the Core's service user open a connection to `127.0.0.1` ports 8554 to 8564; the production host has no other interactive account. A boot check names a missing rule | WP-14, WP-20 | H-01 on the real host; fixture test in track D |
| RC-6 | The relay opens no listening socket and no datagram socket: RTSP over TCP is forced on the camera leg and the protocol list is TCP only (the worker's note on datagram ports opened on every interface applies to the client side as well, `WRK/ingest.c:10`); it dials only the host of its locator and the loopback ingest port; it opens no file after start. On Linux it gives up the right to gain privileges and, where the kernel offers it, file-system access, before it parses the first byte from the camera. The run directory is 0700 and the microphone pipes 0600, checked at boot | WP-03, WP-14, WP-20 | socket snapshot of the relay in a test run; static check that the relay source opens no file |

**Why A is still the better variant after this review.** Under B the process that writes both evidence files and holds the session would parse the camera network and hold the credential (`SPEC:294`); a flaw in the library's RTSP or codec parsing would then sit inside the evidence writer. Under A it sits in a process that can be confined (RC-6) and whose death is a camera fault. The price of A is a local listener whose abuse RC-1 to RC-5 reduce to what an attacker with the Core's own account can already do.

**Residual accepted with this ACCEPT.** A process running as the Core's service user can defeat SA-2 and feed a microphone pipe. That account can already read the credential store and write to the database; the host rules of WP-14 (single purpose, no other account, private run directory) are the control. The sealed manifest still says "declared as production devices by the Core that sealed this package" (`T3/masterplan/06_evidence_package_spec.md:880`); that word stays (S13-17).

**S13-05 (High, gate)** = RC-1 and RC-2. **S13-06 (Medium)** = RC-3 and RC-4. **S13-07 (Medium)** = RC-5 and RC-6.

## 5. Area 3: the privileged alias helper. CAUTION

### 5.1 As built in input-av

| # | Weakness | Evidence |
|---|---|---|
| B-1 | Any existing interface is accepted from the caller. The name pattern admits `.` and `-` in first place, so `..` passes the existence test | `IAV/scripts/dems-netalias:21-22` |
| B-2 | A third verb runs `tcpdump` as root | `:24-30` |
| B-3 | The conflict check is skipped without a word when `arping` is absent | `:40` |
| B-4 | `del` removes any private `/24` address from any interface, the host's own address included | `:33-36,45` |
| B-5 | `ip`, `arping`, `tcpdump`, `timeout` are found by search path | `:28,40,43,45` |
| B-6 | The service tries `ip addr` itself first and uses the helper only when refused, so with the capability the check never runs | `IAV/nvr/netalias.py:36-45` |
| B-7 | "Host already in the subnet" is true for any interface, so scan and set-IP can act on the office network | `IAV/nvr/netalias.py:73-81,87-92` |
| B-8 | Removal by a timer in memory; the helper writes no record of its own | `IAV/nvr/netalias.py:107-114` |
| B-9 | The sudoers line gives the whole helper without a password; the unit therefore sets no `NoNewPrivileges` and no capability bound | `IAV/scripts/install.sh:86-89`; `IAV/deploy/dems-nvr.service:19-20` |

### 5.2 As designed (DR-1 to DR-4, DR-9; U9, U10, U11)

The design closes B-1 (interface from a root-owned file), B-2 (no packet capture), B-3 (mandatory check), B-6 (no capability, no direct `ip`), B-7 (DR-4), and gives the action a role, an idle rule and an audit entry (`SPEC:416-426`; `PLAN`, phase 10). The interface is chosen once by the technician and never by the Core (`DEC:23`, OQ-4; `DB`, section 2.4), and the helper's file is the enforcement copy: a difference between it and the database row is a named refusal (`DB`, section 2.4). That is the right shape. **TECHNICIAN only (U10): PASS**, provided the permission is checked on the server by the permission guard (as `CORE/modules/capture-discovery/routes.ts:9` does for the search) and the operation is refused outside a web-console session.

It does not close B-4, B-5 and B-8, and it places DR-4, the idle rule and the audit in the Core only.

### 5.3 Findings

**S13-08 (High, gate: installation by the user). The helper must enforce its own limits.**
- Risk. Whatever runs as the Core's service user can execute `sudo -n <helper> ...` directly. Then the role, the idle rule, DR-4, the single job and the audit entry are all skipped. With `del` as built, such a caller removes the camera interface's own address during a recording.
- Requirement (WP-19). The helper, by itself and whatever its caller:
  1. takes exactly the verb and one address; reads the interface from the root-owned file; validates the file's one line against the name pattern (first character alphanumeric) and against `/sys/class/net`; refuses when that interface carries the default route;
  2. accepts an RFC 1918 address with `/24` only, host part 1 to 254;
  3. refuses `add` when any **other** interface holds an address in that `/24` (DR-4, inside the helper), and when 2 helper-added addresses are already in place;
  4. runs the conflict check always and refuses when the tool is missing;
  5. adds the address marked as its own (an address label or a root-owned state file under `/run`) and with a lifetime it bounds itself to 5 to 480 minutes;
  6. `del` removes only an address it marked; never another;
  7. calls its tools by absolute path, sets its own search path, takes nothing from the environment, evaluates no input;
  8. writes one line per call to the system journal: calling user, verb, address, result. This is a trail the Core's user cannot edit, against which the Core's audit entries can be reconciled;
  9. answers with fixed exit codes; its messages contain no text of the caller.
- Check added to phase 10's "5 refusals of 5": refusal of `del` for an unmarked address; refusal on an overlap with another interface; refusal on the default-route interface; refusal of a third alias; a journal line per call: 9 of 9.

**S13-09 (Medium). `sudo` against a root service.**
- Evidence. Note SN-2 names the cost and the alternative and designs neither (`SPEC:457`). With `sudo` the unit of the process that holds evidence, the database role and the signing path cannot set `NoNewPrivileges` or bound its capabilities.
- Requirement (WP-14 with WP-19). A decision row before WP-19 closes. First choice of this review: a root-owned service reached over a local socket (owner root, group the Core's, mode 0660, the peer's user checked), taking the same two verbs, so that the Core's unit keeps `NoNewPrivileges` and an empty capability set. `sudo -n` is acceptable when the row says why the service was not taken; S13-08 applies to either form unchanged.

**S13-10 (Medium). Cleanup on crash.**
- Evidence. DR-3 rests on hypothesis H-S, to be settled only on the real host (`SPEC:418`; `PLAN`, H-06).
- Requirement (WP-19, WP-23). (a) If H-S fails, the removal is scheduled by root at the moment of adding (a transient timer of the init system), never by the Core's memory. (b) The start-up sweep removes, through the helper, every marked address on the interface, with or without a row in `host_network_aliases`, and writes `BOOT_SWEEP` for each. (c) An audit entry is written before the helper is called (intent) and after (result), as the schema design recommends for the camera network set (`DB`, section 2.5, last paragraph); a Core that dies between the two leaves the intent. (d) Until H-06 has passed, the function is not used on an installation (already the plan's rule).

### 5.4 What the installation procedure must contain (U12 B5; user action UA-3)

To be written by WP-14 as steps for the user, each with the command and the line that shows it took effect. No agent runs any of it (SR-10).

1. **Before installing:** this review's findings S13-08 to S13-10 are closed in the helper as delivered; the file's SHA-256 is printed in the procedure and the user compares it with the file in hand.
2. **The helper file:** installed owner root, group root, mode 0755, in a directory whose every parent is owned by root and not writable by group or others; not a symbolic link.
3. **The interface file:** one line, the camera interface, chosen by the technician from the list of the host's interfaces with their addresses shown; owner root, mode 0644, directory owned by root. The procedure makes the user confirm that the interface is **not** the one that carries the default route or the office address. It is written once; changing it is a repeat of this step by the user, never an action of the Core.
4. **The privilege grant:** if `sudo`: one file under the sudoers include directory, owner root, mode 0440, one line naming the service user, the one absolute path, no wildcard; checked with the syntax checker before it is moved into place; environment reset stated for that command. If the root service: its unit and socket files, owner root, socket mode 0660 with the Core's group.
5. **Prerequisites:** the conflict-check tool present; the helper's self-test verb or a dry mode run once and its output compared with the expected text.
6. **Proof of the bound,** run by the user as the service user: the nine refusals of S13-08, each expected to fail, and the journal line for each.
7. **Firewall:** the Core's own services are not reachable on the camera interface or on any alias address (note SN-5); the loopback rule of RC-5.
8. **The Core's boot check passes:** helper and grant are root-owned and not writable by the service user (WP-20; SN-1), and the interface file agrees with the database row.
9. **Removal:** the three commands that take the grant, the helper and the interface file away, and the command that lists any marked address left behind.
10. **Record:** the user's confirmation becomes a decision row with the date, the host and the file's hash.

## 6. Area 4: network-changing actions on a camera and the typed-address probe. CAUTION

**S13-11 (High). Bound every address the Core dials on an operator's word.**
- Risk. The scan, the set-IP job and the typed probe make the Core open connections to addresses a signed-in person supplies (`SPEC:420,472`; AM-3, AM-5, AM-6). Without rules this is a request-forgery reach: a technician account, or whoever holds one, uses the Core to touch hosts on the office network or the Core itself, and, with set-IP, sends a digest there. input-av bounds the stored list to private IPv4 (`IAV/nvr/settings.py:69-78`, as cited in `SPEC:395`) and nothing else; its ONVIF port is free (`IAV/nvr/factory.py:154`).
- Requirement (WP-19 for the scan, WP-22 for set-IP, WP-12 for the typed probe of the search). One pure function, used by all three, decides a target before any packet leaves:
  1. an IPv4 literal only, no name; inside `10.0.0.0/8`, `172.16.0.0/12` or `192.168.0.0/16`; never loopback, link-local, multicast, broadcast, a network or broadcast address of its `/24`, or an address of the Core host itself;
  2. not inside the subnet of any interface other than the camera interface (DR-4), and the connection is made from the camera-interface or alias address; a route that would leave by another interface is a refusal, not a fallback;
  3. the ONVIF port from a short stored list (default 80; the list is a setting), the service path fixed by the Core, redirects never followed, answer size and time bounded as the connection test is;
  4. rate: one commissioning job and one scan at a time per Core; a scan covers at most the 32 stored addresses plus one typed; a stated minimum spacing between scans and between typed probes, and the per-host spacing of the connection test (`limits.ts:9-14`);
  5. the answer is parsed into the named fields and nothing of its raw body is returned to the client: the operation is not a way to read an arbitrary host's reply; a link to the camera's own page is built from the validated address, never from device text.
- For set-IP in addition (WP-22): the new address lies inside the configured camera subnet, is not the Core's, not the gateway's, not a registered camera's; the prefix comes from the configuration, not from the request; a gateway, when given, lies inside that subnet; a reboot is sent only when the camera asks for it. **DHCP mode is not carried:** the camera network has no DHCP by the design's own account (`SPEC:394`), so the mode can only lose a camera.
- Check: a table test of the function with at least one case per rule; each ported operation refuses the same cases with 0 packets sent.

**S13-12 (Medium). Device text is untrusted.**
- Evidence. input-av passes the camera's fault text and the first 200 characters of its reply into an error that reaches the job's step list, the screen and the caller (`IAV/nvr/onvif_client.py:127-130`; `IAV/nvr/factory.py:98,198-203`); probe scopes become names (`IAV/nvr/onvif_client.py:65-67`); the camera's interface token is written back into the next request (`IAV/nvr/onvif_client.py:213`). In task 3, an exception inside the XML parse callback could end the Core (SEC35-29, `T3/decisions/decisions.md:99`).
- Requirement (WP-19, WP-22). (a) A device's text never reaches a log, an audit detail or an error message: a failure is a code (the schema design's `remove_error` is the model, `DB`, section 2.5). (b) Every device string that is shown or stored (name, model, firmware, MAC, endpoint reference, token) is bounded in length, held to a character rule and stripped of control characters before it leaves the adapter; the console renders it as text. (c) The new set-IP file takes the parse and exception guards of the connection-test file; a test feeds it a malformed and an oversized reply and an interface token with markup characters: the Core stays up and the request it sends is well-formed. (d) The dialog shows, before the credential is typed, the target address and the MAC from the host's neighbour table (not from the device's own answer), then the MAC the device reports after authentication; a mismatch stops the job (extends SN-4).

**Other points of the design in this area: PASS.** Idle only and refused during a session (DR-1); one job at a time and set-IP refused while the last scan saw two endpoints on the address (DR-6); the MAC read before and matched after (DR-7); no automatic follow by MAC (DR-10); the camera page is not proxied (DR-12) (`SPEC:416-427`).

## 7. Area 5: evidence and records

### 7.1 Sealing, audit chain, RBAC: PASS

Stored form C keeps the Core's fMP4, sealing, verification and export untouched (`SPEC:341-355`; U12 A1, `DEC:24`); seams S4 and S5 do not change (`SPEC:108,169,175`). Every network-changing action is one Core audit type in the one chain (DR-11; `PLAN`, phase 10 check "exactly 1 audit entry"); the forbidden detail keys already include `password`, `secret`, `credential`, `username`, `mediaUrl`, `onvifUuid` (`CORE/db/schema/value-sets.ts:203-233`). No user, token or audit chain of input-av is carried (`SPEC:212`). C6 is not weakened here.

### 7.2 Schema sets A to C: PASS, one low finding

No column of `capture_device_streams`, `capture_audio_inputs`, `session_capture_sources.source_facts`, `capture_network_config`, `host_network_aliases` or `installation_acceptances` holds a credential, a locator or an address with a user part; the design says so and the column lists agree (`DB`, sections 2.1 to 2.6; "No secret" line of 2.1; forbidden keys of 2.3). The runtime role gets no DELETE on any of them.

**S13-13 (Low).** `installation_acceptances.diagnostics` is "CHECK object" and `steps` "CHECK array" with no key rule (`DB`, section 2.6), while audit details and `source_facts` carry the flat-map and forbidden-key checks. `source_facts.model` and `.firmware` are device text. Requirement: WP-26 gives `diagnostics` and `steps` a closed key list in code, the forbidden-key check and a size bound; WP-24 applies S13-12 (b) to the device text in `source_facts`.

### 7.3 The legacy folder `apps/input-av/data/`: CAUTION

Known without opening it: by the code it holds the database with plain-text camera passwords and URLs that contain them, a token secret, recordings and exports (`research/03_analysis_record_map.md:344`; `IAV/nvr/registration.py:62-65`).

| Fact | Evidence |
|---|---|
| The whole tree `apps/input-av/` is untracked | `git status --porcelain --ignored apps/input-av`: `?? apps/input-av/` |
| `data/` and `.env` are ignored by input-av's own file only | `git check-ignore -v`: `apps/input-av/.gitignore:2:data/`, `:5:.env` |
| That ignore file is itself untracked, inside the untracked tree | same output; `git ls-files apps/input-av` prints nothing |
| The root ignore file has no line for `apps/input-av`, for a database file or for the token secret; its media rules are by extension and cannot name MPEG-TS, whose extension is that of the TypeScript sources | `/Users/gsp-budi/Documents/DEMS/.gitignore:40-42,112-131` |
| The directory entry is mode 0770, group `staff` | `ls -ld apps/input-av/data` (the entry only) |
| No commit hook is installed | `.git/hooks` holds samples only |

**S13-14 (High, gate: the first git write of phase 0).** What can still go wrong, each with its path:

1. `git stash -u` or `git clean -fd` on the repository (ordinary tidy-up commands in a baseline or a branch switch) take the untracked files of `apps/input-av/` away, **the ignore file among them**, and leave the ignored `data/` in place. From then on nothing ignores it, and the next `git add -A` stages recordings, the token secret and the database. SR-9 forbids add-all and clean (`PLAN`, section 5) but names neither `stash` nor the reason.
2. `git clean -fdx`, `-X` or `git stash -a` delete or move the folder itself. Recordings that the hand-over treats as evidence data are then gone or sit inside a stash object.
3. `git add -f`, or an add by a path that contains the folder after case 1.
4. The baseline commit of phase 0 made with an add-all stages the input-av sources, against B6.
5. Any local account of group `staff` can read the folder as far as the directory mode decides; a backup or sync tool over the documents folder copies it (unknowable from here, as SEC35-44 said of `.data/`, `T3/verification/02_security.md:142`).
6. A tool started from the input-av tree writes into it (already SR-2 and WP-21).
7. An agent quotes from it. No phase opens the folder (SR-1); that rule has no mechanical guard.

- Requirement, phase 0, before the baseline commit. (a) The path `apps/input-av/` is ignored from **outside** that tree: one line in the repository's local exclude file (no tracked file changes) or in the root ignore file; verified by `git check-ignore -v apps/input-av/data` naming the new source. (b) SR-9 is extended by name: no `git stash -u`, no `git stash -a`, no `git clean` of any form, no `git add -A`, no `git add -f`, no checkout or reset that removes untracked files; every commit of this task is made by explicit paths. (c) Before each commit the staged list is checked for the prefix `apps/input-av/` and for files of the database, key and transport-stream kinds: 0 expected; the count goes into the commit's progress note. (d) **WP-21 is brought forward:** the user is asked once, now, to move `data/` out of the repository to a folder of mode 0700, or to confirm in a decision row that it stays; the plan lets WP-21 wait for track H (`PLAN`, phase 9), which leaves the folder beside two to three weeks of autonomous commits. Asking is not a stop of the autonomous work; (a) to (c) are in force either way. (e) Not examined, to be checked by the first row that touches it: whether the release packager under `scripts/release/` can reach `apps/input-av`.

**S13-15 (High, gate: stage 2).** A camera that was registered in input-av has its password in that database in plain text. If the same camera is adopted by a production Core with the same password, the "sealed, write-only" credential has a readable copy in a group-accessible folder. Requirement (WP-27 procedure; a condition of stage 2 in WP-15): each camera's password is changed in the camera before its adoption by a production Core, and the procedure records that it was done, per camera, without the value. The same holds for the bench cameras used under B7.

**Q3 as ruled (a separate archive, not imported, U12 A9): supported.** An import would carry plain-text credentials and a foreign audit chain toward the Core (`research/03_analysis_record_map.md:346`).

## 8. Area 6: the bench interim rule and the development on doubles. CAUTION

The bench installation is outside the repository and the plan (`PLAN:154`); the plan starts no input-av program from this tree (SR-2) and no agent types or receives a real credential (SR-5). Under U13 no hardware is attached during track D, so no real stream or credential can reach a test by the plan's own steps. HEVC proof sources are generated (`REG:404-413`). That is sound. What the plan does not yet say:

**S13-16 (Medium).**
1. **The helper's test seam (WP-19).** The helper is "run with stand-ins for `ip` and `arping`" (`PLAN`, phase 10). If the stand-ins are reached through the search path or an environment variable, the same door exists in the installed helper and is a path to root. Requirement: the tool paths are constants of the file; the test runs a copy produced by a build step that substitutes them; one test asserts that the file handed to the user holds the absolute constants, by hash, and reads no environment variable.
2. **Fixture credentials (WP-03, WP-05, WP-22).** The fake camera's account is one obviously synthetic constant in one test file, and it is the search needle of E-12. No test reads an environment file.
3. **The secret scan before a log enters a commit (phase 0).** The existing count-only scan (root ignore file, lines 79-82) gets two more needles: the camera-credential form and the form of the ingest secret of RC-2.
4. **No recording as a fixture.** No file produced by the bench or by a real camera enters the repository or a test, in any phase; fixtures are generated. The root ignore rules do not catch a transport-stream or database file (section 7.3), so this is a stated rule plus the staged-list check of S13-14 (c).
5. **The acceptance scripts (WP-27).** No script takes a password as an argument, an environment variable or a file; none captures packets (a capture holds the digests); what a script prints is codes and counts; any output that is to enter `/docs` passes the count-only scan first; screenshots are taken with the reveal control off (D86 C-1). Sessions recorded in track H are sealed evidence in the Core's data directory and are not copied into the repository.
6. **Bench recordings under B7** are test material that shows real rooms: they stay on the bench machine, and the bench cameras fall under S13-15.

## 9. Area 7: amendments AM-1 to AM-8

| Entry | Protection it lifts | Replacement in the design | Rating |
|---|---|---|---|
| AM-1 (D86 C-5) | No listener and no session start for a kind without an opener; no all-`PRODUCTION` package | SA-1 (built, `CORE/capture/fence/sources.ts:105-106`), SA-2, SA-3. The rule stays for every other kind | **CAUTION:** the replacement is unproven until RC-1; RC-1 to RC-6 are the content of L-2. S13-17 |
| AM-2 (D82) | Codec judged from the authenticated ONVIF answer | Judged from the stream, after the ONVIF half authenticated (`PLAN`, phase 3 check) | **CAUTION:** adds an RTSP authentication to the connection test: S13-01 and S13-04 (d). With them, nothing is lost |
| AM-3 (D80(10), search) | No typed address in the search | Probe-answer data only stays (D80(1)) | **CAUTION:** needs the target rule of S13-11 in WP-12 |
| AM-4 (D75) | No configuration change on a device | Network set only, by a TECHNICIAN, idle, typed credential, audited; clock, GOP, profile, PoE stay forbidden; agents never run it | PASS with S13-11 |
| AM-5 (D80(1)) | No follow-up read in a search | A separate operation on a bounded list; the search unchanged | PASS with S13-11 |
| AM-6 (D80(10), commissioning) | No typed address | Stored list plus one typed address | PASS with S13-11 |
| AM-7 (D81, D80(7)) | Three credential-carrying operations; lifetime one call | A fourth, web console only; C1 chose "typed again" | PASS; S13-04 (c) makes the guard cover it |
| AM-8 (D76 (3)) | Order candidate, credential, test, assignable | One step added before adoption; assignable only after adoption and its test | PASS |

**None removes a protection without naming a replacement.** AM-1's replacement exists on paper and depends on an experiment that has not run; AM-2 and AM-3 need the requirements named.

**S13-17 (Low, gate: stage 1).** At the lift, section H.5 of the evidence specification gains the guard "the Core itself opened the source" and the case of the loopback ingest, as SEC35-40 (3) required; the report line keeps the word "declared" (`T3/masterplan/06_evidence_package_spec.md:880,1129`). Requirement of WP-13.

## 10. Notes

| # | Note |
|---|---|
| N-1 | The MAC a camera reports is its own statement; matching it before and after the move proves continuity of the answering device, not its identity. Adequate for commissioning with one camera plugged in, which the design already asks for (SN-4). |
| N-2 | A SUPERVISOR who administers operators may be able to give an account the TECHNICIAN role; the rbac module was not read for this. If so, U10 is a separation by role and by audit, not by impossibility. |
| N-3 | The relay stamps arrival time (`SPEC:314`). Not a security finding; the evidence then states host time, which is the more defensible clock. |
| N-4 | The alias makes the host answer on a second subnet (SN-5); covered by step 7 of section 5.4. |
| N-5 | `capture_network_config.factory_addresses` is validated by the module only (`DB`, section 2.4). Acceptable because the helper and the target function of S13-11 are the boundaries. |
| N-6 | The design's F-5 choice not to carry the ARP sweep and automatic following is a security gain over input-av and is supported (`SPEC:465-475`). |

## 11. Compliance view (short)

No regulation was identified for this task by the plan (`PLAN`, section 14). What this review can say from the files read, and no more:

| Item | Status | Finding |
|---|---|---|
| GDPR Art. 5(1)(f), Art. 32, security of processing | Gap | Recordings of examinations and credentials in a group-accessible folder inside a development repository (S13-14, S13-15) |
| GDPR Art. 5(1)(e), storage limitation | Not examined | No retention rule for the legacy archive was found in the documents read; Q3 rules "separate archive" only |
| GDPR Art. 25, by design | Met in the design | Credential never stored by commissioning; unadopted devices not stored (U11) |
| GDPR Art. 30, 35 | Not examined | No processing register or impact assessment was looked for |
| ISO 27001 A.9 access control | Met with findings | TECHNICIAN only (U10); helper callable past the role (S13-08) |
| ISO 27001 A.10 cryptography | Gap accepted for development only | Camera LAN in clear (S13-03); Basic not excluded on RTSP (S13-01) |
| ISO 27001 A.12.4 logging | Met with findings | One audit chain; helper journal line and intent entry missing (S13-08, S13-10) |
| ISO 27001 A.13 communications | Findings | Target rule (S13-11); loopback rule (RC-5) |
| ISO 27001 A.14.2 development | Findings | Test seam of the helper; fixtures; staged-list check (S13-16, S13-14) |

## 12. Assumptions, gaps, what was not verified

- **Nothing was run.** E-11 (HS-3) is the largest open point and belongs to WP-01.
- **HS-1** (the library answers Basic), **HS-2** (no separate credential option for RTSP), **HS-3** (listen mode does not compare the path): reviewer's knowledge of the FFmpeg libraries, not read in the pinned source and not run. Settled by the tests of S13-01 (b), by WP-03's first design step, and by E-11.
- `CORE/core/audit-details.ts`, the rbac module, the permission guard's rules, the credential store's envelope code, the web console and `IAV/nvr/discovery.py`, `settings.py`, `routers/devices.py` were not opened; statements about them cite the design or the collection rows.
- The `onvif` package's handling of the four network calls and of markup in a token was not read (S13-12 (c) tests it).
- The content, the file modes and the size of `apps/input-av/data/` are unknown by rule. Whether `apps/input-av/.env` exists was not checked.
- Backup, sync and indexing tools over the repository folder are not knowable from here.
- Line numbers of `masterplan/02_plan.md` are given by phase name where the line was not re-opened.
- Alternative considered for the relay and not required: binding relay and worker by an inherited socket pair instead of a loopback port. It would remove the listener, but it changes the worker's ingest, which is the very thing variant A exists to avoid; RC-1 to RC-5 reach the same result for every attacker short of the Core's own user.
- This row modified no source file and no plan document. The tracking table of `masterplan/02_plan.md` was left as it is, by the row's hard limit; the controller records the result.

## 13. Verification cells of row 13, checked

| Cell (`identification/02_structured.md:149,171`) | Result |
|---|---|
| Each of the five named areas has a rated finding | Credential path: section 3. Evidence sealing: 7.1 (variant C, the ruled one; variant I and M are not planned, `DEC:24` A1). Network-changing tools and who may run them: sections 5, 6. Single audit chain: 7.1. Existing input-av data: 7.3 |
| A statement whether a C6 guarantee is weakened, per area | Section 1, table |
| The row that must rework it | Section 1, last column; section 2, per finding |
| Areas added by the delegation (relay decision, bench and doubles, amendments) | Sections 4, 8, 9 |

---
*Generated: 2026-10-12 21:27*
*Last Updated: 2026-10-12 21:27*
