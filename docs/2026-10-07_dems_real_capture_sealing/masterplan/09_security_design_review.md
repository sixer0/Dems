---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: security-review
blueprint_row: 35
milestone: M0
class: B
tier: 1
type: security design review (read-only; documents, not code)
verdict: PASS-WITH-FINDINGS
reviewed:
  - masterplan/03_api_contract.md (row 29)
  - masterplan/04_database_contract.md (row 30)
  - masterplan/05_capture_architecture_spec.md (row 31)
  - masterplan/06_evidence_package_spec.md (row 32)
  - masterplan/07_transcript_spec.md (row 33)
governing_sources:
  - decisions/decisions.md (D4, D7, D10, D12)
  - masterplan/01_specs.md (row 28, §C)
  - research/03_analysis.md (register + W1-C1..W1-C12)
  - research/01_explore.md §2.4 (21 src guards)
predecessor: docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/03_security_design_review.md (read-only; accepted items cited, not re-litigated)
finding_counts: {Critical: 0, High: 4, Medium: 15, Low: 4}
surfaces: 10
surfaces_fail: 0
last_updated: 2026-10-09 15:04 (row-128 spec-gate fix pass PE-128-84..87 (D89, D91; `gateway_check/27_r9_r11_spec_gate.md`); blueprint row 126, marks PE-126-01..PE-126-05: section 11 added — security design review delta for R-9, R-10, R-11, findings SEC35-27..SEC35-49, verdict of the delta CAUTION; sections 1-10 changed by two pointers only); 2026-10-09 (status sweep PE-R8-14..15: §10 R-8 addendum, Q-STT-CFG answered (a) by D24; status wording only); 2026-10-07 17:40
delta_row_126: {blueprint_row: 126, date: 2026-10-09, section: 11, verdict: CAUTION, finding_ids: SEC35-27..SEC35-49, finding_counts: {Critical: 0, High: 4, Medium: 11, Low: 8}, record: delegation_progress/security_review_row126.md}
---

# Security Design Review — real capture, sealing v2 and transcript (phase rows 29-33)

**VERDICT: PASS-WITH-FINDINGS. 0 Critical open.**

No finding makes the design unsafe inside the stated boundary, so the verdict is not FAIL and no
surface is a FAIL (a FAIL is reserved for an open Critical). The review raises **23 findings**: 4 High,
15 Medium, 4 Low, 0 Critical. Every finding names a severity, a concrete mitigation and the owning
spec section. This row changed no specification; findings route to rows 29-33 or to row 37/40.

> **Erratum PE-126-02 (D73-D84).** The verdict and the counts above are those of blueprint row 35
> (rows 29-33) and are unchanged. The new scope R-9, R-10, R-11 (rows 120-125) is reviewed in
> **§11**, with its own verdict (**CAUTION**; 23 findings SEC35-27..SEC35-49: 0 Critical, 4 High,
> 11 Medium, 8 Low). The two sets of counts are not merged.

**Citation convention.** `A §x` / `D §x` / `C §x` / `P §x` / `T §x` = `masterplan/03_api_contract.md` /
`04_database_contract.md` / `05_capture_architecture_spec.md` / `06_evidence_package_spec.md` /
`07_transcript_spec.md`. `SP §x` = `masterplan/01_specs.md`. `REG` = `research/03_analysis.md`.
`Dn` = `decisions/decisions.md`. `P2 §x` = the predecessor review
`docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/03_security_design_review.md`. Code is cited
as `path:line` relative to `/Users/gsp-budi/Documents/DEMS/`. A separator in the counts is a new
surface in this phase; the predecessor's accepted risks are separated in §Pre-existing vs new.

**No secret value appears in this file.** Camera-credential, signer, session-key, oMLX API-key and
signed-URL values are cited by name and shape only; no `.data/pg.*` content, no oMLX key and no media
byte is reproduced.

---

## 1. Surface verdicts (10)

| # | Surface | Verdict | Findings | One-line ruling |
|--:|---|---|---|---|
| S1 | Camera/device credential store (`capture_device_credentials`) | PASS-with-findings | SEC35-01..04 | Write-only and encrypted at rest, but the write operation, audit type, app-layer reveal permission and encryption-key store are undefined; RK-12 leak paths are only partly closed |
| S2 | Signer keys (software Ed25519, TPM class C) | PASS-with-findings | SEC35-06..07 | Key id in the manifest and rotation design are sound; the host-key compromise threat model and the at-rest key protection are not stated, and per-revision certificate retention is missing |
| S3 | Per-fragment GCM encryption keys | PASS-with-findings | SEC35-08..11 | GCM-outside-the-muxer is correct and verify-without-key works; key storage is deferred to this review, key-loss and AAD are unspecified, and `fragments.json` integrity coverage is ambiguous |
| S4 | Media streaming auth (op 88, Range) | PASS-with-findings | SEC35-12..13 | Loopback-only, `EVIDENCE_VIEW`, audited and E-31-aware; the URL signing key/TTL/requester binding and the exact blanking prefix and insertion points are not pinned |
| S5 | Credential-shaped values across logs/errors/audit | PASS-with-findings | SEC35-14 | The 7 new audit detail-key lists and 7 new error messages are secret-clean; both blanking lists are named, but the oMLX API key is in neither and the media-token prefix is undefined |
| S6 | New static rules permitting `child_process`/`fs` (capture/) | PASS-with-findings | SEC35-25 | The rules are equal-to-weaker than the 21 existing guards: G-R2 names no file allowlist and no denied credential/key paths, so a permitted spawn file could reach the filesystem |
| S7 | OD-13 preconditions and network exposure | PASS-with-findings | SEC35-23 | Core, Vite, PostgreSQL and oMLX stay loopback; the new RTSP ingest bind address is not pinned and `-listen` defaults to `0.0.0.0`, a LAN exposure gap |
| S8 | RBAC and audit completeness for the 13 new operations | PASS-with-findings | SEC35-16..19 | Every new operation has success and denial audit; but `SESSION_HOLDER` is unmaterialised, the idle-lock denial row is ambiguous, `sendingDeviceId` is optional, and the pre-existing blanket `EVIDENCE_VIEW` now reaches REAL evidence with no case scope |
| S9 | Transcript revision integrity (OD-15) | PASS-with-findings | SEC35-20..21 | Author is recorded, `TRANSCRIPT_REVISE` is INVESTIGATOR+SUPERVISOR, and the sealed original is append-only and DB-immutable; but per-revision certificate retention after rotation and the `baseRevision` mapping are incomplete |
| S10 | Cross-spec contract consistency (extra surface) | PASS-with-findings | SEC35-01, SEC35-22 | The error-code and audit-type inventories disagree across rows 29/30/33 (`CAPTURE_CREDENTIAL_SET`, `RESET_BLOCKED_REAL_EVIDENCE`, `TRANSCRIPT_AUDIO_UNAVAILABLE`) |

### S1 — Camera/device credential store

The store is designed correctly at rest: `secret_ciphertext bytea` with `octet_length >= 33`,
`nonce` 12 bytes and `encryption = 'AES-256-GCM'`, with `key_ref` holding only a key-directory
reference and never key material (D §B.3). Row 30 revokes blanket `SELECT` from `dems_app` and exposes
one row only through the owner-owned `SECURITY DEFINER` function `dems_capture_credential_reveal(text)`
with `GRANT EXECUTE` to `dems_app` (D §D; `D-DB-06`), which is stronger than the map's "SELECT only for
the supervisor path" (`REG` RK-12). The store is `KEPT` on reset with the `upsert` mode (D §B.0/E.1;
OD-19), and no credential appears in the replicated slices `captureConfig`/`captureDevices` (A §2.3,
A §6). Against that, the surface has four unresolved paths. First, no **write** path exists: row 30
says the store is "written only through operation 80" (D §B.3), but A §2.2 makes op 80
`setPrimaryMic`; the 13 new operations (76-88) contain no credential-set operation at all, and the
audit type `CAPTURE_CREDENTIAL_SET` that row 30 names (D §B.3) is absent from row 29's seven new audit
types (A §5.2). A write-only store with no API and no audit type cannot be RBAC-walked (SEC35-01).
Second, the reveal function is granted to the whole runtime role `dems_app`, and no application-layer
permission gate or single calling module is named (SEC35-02). Third, the key that decrypts
`secret_ciphertext` is not located, and the function returns ciphertext (D §B.3), so the key store,
derivation and rotation are undefined (SEC35-03). Fourth, the credential-bearing RTSP pull URL
(C §A.6 `pullUrl`) and the FFmpeg worker stderr are not covered by any blanking rule, an RK-12 leak
path (SEC35-04).

### S2 — Signer keys

The design matches OD-04: one software Ed25519 key, key id `CORE-KEY-EVSIGN-01`, the 64-byte signature
over the 32-byte `manifestSha256`, and the manifest carries `signature.keyId` + certificate sha256
(P §C.1/B.9; `D §C.4`). The class-C TPM adapter has clear entry criteria (C-8: OD-04 hardware option
chosen, a TPM present, verification with the device certificate chain; SP §G.2), and its
`ECDSA-P256-SHA256` value is pre-declared in the DB CHECK so no migration is needed (D §C.4). Rotation
"issues a new key id and a new certificate" and never rewrites a sealed manifest (P §C.3). The
weakness is honesty and coverage, not the algorithm: the review must state the threat model plainly —
**a party who compromises the Core host key (the key lives in the same host, P §C.3 "Core signer
store") can forge a package that passes V-01..V-14, because every hash and chain in the manifest is
recomputable and re-signable.** The specs do not state this, nor what mitigates detection (SEC35-06);
at-rest protection of the private key file and a compromise/revocation runbook are absent (SEC35-07).

### S3 — Per-fragment GCM encryption keys

Row 31 places AES-256-GCM **outside** the muxer because the muxer's CENC is AES-CTR only with no AEAD
(C §D.1; `REG` W1-C2/F-47/F-52), one key per session `KID-<sessionId>`, with only `keyId` and per-fragment
IV/tag in the manifest (C §D.2, P §B.6). The two-hash design is right: stored-bytes hashes/chain are
verifiable without the key (P §D V-04/V-06; OD-03/RF-6), and the decrypted export carries the plaintext
hash (P §G.2, D §B.12). The gap is that "Storage: the Core credential store (row 35 security review)"
(C §D.2) defers the actual key store to this review row, which owns no implementation, so no spec fixes
generation, storage, access or destruction (SEC35-08). Key loss is not documented: if the session key is
lost the plaintext export and Range playback are impossible while stored-bytes verification still passes
(SEC35-09). GCM AAD is unspecified, so tags authenticate ciphertext only; the chain catches reordering
within a track but the design should bind `(trackId, seq, byteOffset, keyId)` (SEC35-10).
`fragments/fragments.json` duplicates the manifest fragment records (P §A.1 vs P §B.6) but is a separate
clear file whose coverage by the manifest self-hash/signature is unstated (SEC35-11).

### S4 — Media streaming auth

Op 88 `createEvidenceMediaSession` requires `EVIDENCE_VIEW`, is `live` only, and returns a short-lived
signed URL with `ranges: true`; the route serves the decrypted camera file and records
`EVIDENCE_MEDIA_SERVED` with file id and byte counts only, never the URL (A §2.2/§2.3/§5.2; NM-11),
and the URL is loopback-only (`127.0.0.1:<port>`, A §N-4; E-31). The residual is that the URL is a
bearer value: the signing key/HMAC, the TTL and any requester/session binding are unspecified
(SEC35-12), so a leaked URL exposes real evidence for its lifetime to any local reader. E-31 requires
the prefix in both blanking lists, and both lists are in fact named (SEC35-13): row 32 §G.4 names "the
web error sink" and "the mobile `runtime/log.ts`", and row 29 §2.4 names "both log-blanking lists".
They are the two current regexes `apps/core-web/src/runtime/error-sink.ts:52` and
`apps/mobile/src/runtime/log.ts:46`, both `/\b(ses|dvc|bio)_[A-Za-z0-9_-]+/g`. Problem: no spec defines
the signed-URL prefix token or the exact insertion points, so the obligation is not yet executable.

### S5 — Credential-shaped values across logs/errors/audit

Row 29 §5.1 states the hard rule: no credential (`dvc_`), session token (`ses_`), pairing code,
biometric token, key or key id, password, cookie, typed username, raw camera credential, or signed URL
(or any prefix) in any audit detail key or value; camera-credential refusals audit the fact, and
`ACCESS_DENIED` carries `details.reason` only (A §5.1; E-30; RK-12). The seven new types each have an
exact detail-key list and none holds a secret-shaped key (A §5.2; verified against the current
allow-list mechanism in `apps/core-server/src/core/audit-details.ts:90-132` and the forbidden-key
CHECKs at `apps/core-server/src/db/migrations/0001_tables.sql:199` and `:220`). The seven new error
messages are fixed English that quotes no request and names no credential (A §4; `ApiErrorSchema`,
`core-api.ts:194-216`). Two gaps remain: the oMLX API key loaded from `~/.omlx/settings.json` (T §B.2;
D7) is not in either blanking list and has no DEMS log rule, so a client/stack trace could surface it
(SEC35-14); and the media-token prefix is undefined (SEC35-13). The audit of every new detail-key list
and error message is in §3 below.

### S6 — Static rules permitting `child_process`/`fs`

The new rules (C §G) mirror the 21 existing `src/**/__tests__/static.test.ts` guards
(`REG` §B.5; `research/01_explore.md` §2.4), which already forbid `node:fs`/`node:child_process` in
host modules via the `HOST_MODULE` regex (`modules/system/__tests__/static-rules.ts:63-66`) and the
engine `OUTSIDE_WORLD` rule (`engine/__tests__/static.test.ts:29`). G-R1 keeps host modules
(`src/modules/**`, `src/engine/**`, `src/plugins/**`, `src/core/**`) clean and G-R3 frees the separate
`apps/capture-worker/**` process. The boundary is **weaker than the existing guards** at one point:
G-R2 lets `src/capture/**` import `node:fs`/`node:child_process` "only in the files that own the
supervisor spawn/handshake", but it names no file allowlist and no denied paths, and `src/capture/**`
is itself absent from G-R1's host-module list — so the confinement is prose, not an enforceable
allowlist. A permitted spawn file could read the signer key, `~/.omlx/settings.json` or `.data/pg.*`
(SEC35-25). G-R4 (no key/credential/signed-URL prefix in a log/audit call) and G-R5/G-R6/G-R7/G-R8 are
strict and welcome.

### S7 — OD-13 preconditions and network exposure

The design keeps every DEMS-owned listener on loopback: the Core server and lanes 4420/4421-4423, Vite
5173-5178 (5173/5174 SMART WMS untouched), PostgreSQL `127.0.0.1:4432` (D §F), and the oMLX service on
`127.0.0.1:8000` which DEMS never binds or restarts (T §B.2; D7(d); SP C-N4). Op 88's media route is
loopback-only (A §N-4). LAN exposure is class C (C-5) gated on replacing the demo password and B3
(SP C-N4; `REG` E-26). The one hole is the new capture **ingest listener**: the worker runs two
RTSP/TCP ingests (C §A.2) on ports 8554-8564 (C §A.8), and the spec pins neither the bind address nor
that FFmpeg `-listen` defaults to `0.0.0.0`; unmoved, a LAN client could push a stream into a session
(SEC35-23). The OD-13/LAN gate itself is not opened by any of the five specs.

### S8 — RBAC and audit completeness for the 13 new operations

All 13 new operations carry a success and a denial audit (A §2.2): reads are `NONE-R`/`ACCESS_DENIED`,
writes `CAPTURE_CONFIG_CHANGED`/`ACCESS_DENIED`, op 81 `AUDIO_SOURCE_SWITCHED`/`ACCESS_DENIED`, op 85
`TRANSCRIPT_REVISED`/`ACCESS_DENIED`, op 88 `EVIDENCE_MEDIA_SERVED`/`ACCESS_DENIED`. The five-role walk
is in §4. Three low-severity ambiguities: the `SESSION_HOLDER` condition op 81 depends on is proposed
and not yet in `contract-model.ts` (A §0 itself flags it; the current conditions are `CONSOLE_IDENTITY`,
`DEVICE_SESSION`, `DEVICE_CREDENTIAL`, `DEMO_FLAG` at `packages/shared/src/api/contract-model.ts:88-112`)
(SEC35-18); the idle-lock refusal `409 CAPTURE_CONFIG_LOCKED` says no `CAPTURE_CONFIG_CHANGED` row is
written but does not say whether an `ACCESS_DENIED` row is (A §4/§5.1) (SEC35-19); and
`AUDIO_SOURCE_SWITCHED.sendingDeviceId` is optional although B15/OD-09 require the sending device ID
(A §5.2) (SEC35-17). The one High item is access, not audit: `EVIDENCE_VIEW` is granted to **all three
roles** (`packages/shared/src/sim/auth.ts:47-72`) and the new decrypted-media op 88 inherits it, so with
REAL evidence any INVESTIGATOR or TECHNICIAN can stream any case's footage; no case-scoped condition is
added (SEC35-16).

### S9 — Transcript revision integrity (OD-15)

Author attribution is recorded: `transcript_revisions.author_id` is `NOT NULL` FK
`operators.id` (D §B.9), the API returns `authorId`/`number`/`baseRevision`/`machineTranscriptHash` and
the audit type `TRANSCRIPT_REVISED` carries `authorId` and the binding hash and never the body
(A §2.3/§5.2; OD-15). The sealed original cannot be mutated through the revision path: the machine
transcript is revision 0 and byte-unchanged (T §A.5/A.6), `transcripts` and `transcript_revisions` are
**INSERT only** for `dems_app` (no UPDATE, no DELETE; D §B.8/B.9/§D), the new sealed columns on
`evidence_items` have **no UPDATE grant** (D §B.11), and verify V-10/V-11 recompute the transcript hash
and every revision signature and `parent_sha256` link (P §D). `TRANSCRIPT_REVISE` is granted only to
INVESTIGATOR and SUPERVISOR (A §2.1; `REG` CS-12). Two integrity details are incomplete: a revision
records `signature_key_id` but not the signing certificate, so after a key rotation the old revision
cannot be re-verified from the package, which stores one `device-certificate.pem` (SEC35-20); and
`baseRevision` (op 85) has no column in `transcript_revisions`, so the conflict rule must be stated as a
`max(revision_no)` comparison in the write transaction (SEC35-21).

### S10 — Cross-spec contract consistency (extra surface)

Two rows 29/30/33 disagree on the closed vocabularies. Row 29 fixes seven new error codes (38 total) and
seven new audit types (60 total) (A §1/§4/§5); row 30 uses `RESET_BLOCKED_REAL_EVIDENCE` (D §E.2) and
references `CAPTURE_CREDENTIAL_SET` (D §B.3), and row 33 uses `TRANSCRIPT_AUDIO_UNAVAILABLE`
(T §A.1) — none of the three is in row 29's lists. `CAPTURE_CREDENTIAL_SET` is also the missing audit
type for the unwritten credential operation (SEC35-01). Reconcile the union and the pinned counts
(SEC35-22). This is a contract-integrity finding, not a runtime vulnerability.

---

## 2. Findings

Severity scale: Critical / High / Medium / Low. **Critical count: 0.** Every row: what, why it matters,
concrete mitigation, owning spec section.

| ID | Surface | Severity | What | Why it matters | Mitigation | Owning spec |
|---|---|---|---|---|---|---|
| SEC35-01 | S1/S10 | High | No API operation writes `capture_device_credentials`; D §B.3 says "operation 80" but A §2.2 makes op 80 `setPrimaryMic`; the audit type `CAPTURE_CREDENTIAL_SET` (D §B.3) is not among the 7 new types (A §5.2) | A write-only credential store with no authenticated, audited write path cannot be RBAC-enforced or audited; an implementer would invent an un-reviewed route | Add a credential-set operation (or a write-only credential field on op 79), grant it to SUPERVISOR (+TECHNICIAN), add `CAPTURE_CREDENTIAL_SET` with an exact detail-key list holding `deviceId` only; update A §2.2/§5.2 and D §B.3 | 03_api_contract.md §2.2/§5.2 |
| SEC35-02 | S1 | High | `dems_capture_credential_reveal(text)` is `GRANT EXECUTE` to `dems_app` (D §B.3/§D) with no application-layer permission and no single calling module | Any server code path under the runtime role can read every camera secret, bypassing RBAC; the reveal is the only read door | Name the invoking operation and its permission (SUPERVISOR, reveal audited by fact), and add a static rule that only one module calls the function; state it in D §B.3/§D and A §2.2 | 04_database_contract.md §B.3/§D |
| SEC35-03 | S1 | Medium | The AES-256-GCM key that decrypts `secret_ciphertext` is not located; `key_ref` is "a key-directory reference" with no store, derivation or rotation (D §B.3) | Encryption at rest is only as strong as the unlocated key; a weak or co-located key store undermines the whole store | Name the key store (Core credential store / OS keychain), how `key_ref` resolves, rotation on `rotated_at`, and who can read the key; state it in D §B.3 (with C §D.2) | 04_database_contract.md §B.3 |
| SEC35-04 | S1 | Medium | The credential-bearing RTSP pull URL (C §A.6 `pullUrl`) and the FFmpeg worker stderr are not in any blanking rule; the credential-to-URL injection point is unspecified | A `rtsp://user:pass@host` in a worker log or FFmpeg error is an RK-12 credential leak | Compose the URL outside log calls, add the camera-credential form to G-R4 and both blanking lists, and state that FFmpeg stderr is captured by code only; update C §A.6/§G | 05_capture_architecture_spec.md §A.6/§G |
| SEC35-06 | S2 | Medium | The signer threat model is not stated: a compromised Core host key forges packages that pass V-01..V-14 (key in the same host, P §C.3) | For an evidence system the reviewer and the user must know the honest limit of the signature | Add a threat-model paragraph to P §C.3: host-key compromise forges sealed packages; detection relies on off-host verification, certificate pinning and custody, not on the signature alone | 06_evidence_package_spec.md §C.3 |
| SEC35-07 | S2 | Medium | Signer private-key at-rest protection (path, mode, keychain) and a compromise/revocation runbook are absent; rotation issues a new key but never revokes or flags the old | An unmanaged key file is the weakest link; a leaked key is undetectable | Specify key file mode/ownership or OS keychain, a compromise runbook (revoke, re-verify affected packages, notify), and old-certificate retention; update P §C.3 (with D §B.9) | 06_evidence_package_spec.md §C.3 |
| SEC35-08 | S3 | Medium | The session GCM key store is deferred to "row 35 security review" (C §D.2), which owns no implementation; generation, storage, access and destruction are unfixed in every implementation spec | The key is the only thing protecting real footage; an undefined store is an undefined control | Pin the key store (Core credential store path / OS keychain), one random 256-bit key per session, separation from the media volume, and a destruction policy; update C §D.2 and route the implementation to row 37/40 | 05_capture_architecture_spec.md §D.2 |
| SEC35-09 | S3 | Medium | Key-loss consequence is undocumented: without the session key the plaintext export and Range playback are impossible while stored-bytes verification still passes (C §D.2, P §G) | Operators will assume sealed evidence is always readable; a key-loss event silently blocks export | Document "key lost = data unreadable" and decide explicitly whether key backup/escrow exists; state it in C §D.2 / P §G | 05_capture_architecture_spec.md §D.2 |
| SEC35-10 | S3 | Medium | GCM additional-authenticated-data is unspecified; tags authenticate ciphertext only, so a fragment's ciphertext can be relocated within the file | Without AAD the AEAD does not bind a fragment to its position; only the hash chain detects a move | Specify AAD = canonical `(trackId, seq, byteOffset, keyId)` per fragment; update C §D.1 and P §B.6 | 05_capture_architecture_spec.md §D.1 |
| SEC35-11 | S3 | Medium | `fragments/fragments.json` duplicates the manifest fragment records (P §A.1 vs P §B.6) but is a separate clear file with no stated link to `manifestSha256`/`signature.sig` | A reader using `fragments.json` could be fed altered IV/tag/keyId without breaking the signed manifest | State that `fragments.json` is the exact serialization covered by the manifest self-hash, or add a verify check that it equals the manifest records (extend V-02); update P §A.1/§B.6/§D | 06_evidence_package_spec.md §A.1/§B.6 |
| SEC35-12 | S4 | Medium | The signed media URL's signing key/HMAC, TTL and requester binding are unspecified (A §2.3/§2.4) | The URL is a bearer token; a leaked URL replays real evidence for its lifetime to any local reader | Pin a separate media-session signing key, a short TTL, and binding to operator/session and one `evidenceId`/`fileId`; document the replay window; update A §2.3/§2.4 | 03_api_contract.md §2.3 |
| SEC35-13 | S4/S5 | Medium | E-31 says "add the signed-URL prefix to both blanking lists" (A §2.4; P §G.4) but no spec defines the prefix token or the exact insertion points; the lists are `error-sink.ts:52` and `log.ts:46` with `(ses|dvc|bio)` | The blanking obligation is not executable; the media token remains unredacted in logs until the prefix exists | Define the media-token prefix and pin the two `file:line` insertions and the regex extension, with a test; update A §2.4/§8 and P §G.4 | 06_evidence_package_spec.md §G.4 |
| SEC35-14 | S5 | Medium | The oMLX API key (`~/.omlx/settings.json`, T §B.2; D7) is not in either blanking list and has no DEMS log rule | An HTTP client error or a stack trace could print the key, which is outside the `ses|dvc|bio` shapes | State the key is memory-only and sent as an Authorization header on loopback, never logged; add its shape to both blanking lists and a static rule; update T §B.2 | 07_transcript_spec.md §B.2 |
| SEC35-16 | S8 | High | Pre-existing `EVIDENCE_VIEW` (all three roles, `auth.ts:47-72`) now covers REAL evidence; op 88 streams decrypted footage to any authenticated operator with no case scope (A §2.1/§2.2) | With synthetic data the predecessor accepted blanket read (P2 §8 R-12); with REAL cases, any INVESTIGATOR or TECHNICIAN can view any case's footage | Record a decision that real evidence is viewable by every role, or add a case/scope condition; at minimum state the accepted residual for REAL evidence in SP §A and A §2.1 | 03_api_contract.md §2.1/§2.2 |
| SEC35-17 | S8 | Low | `AUDIO_SOURCE_SWITCHED.sendingDeviceId` is optional (`?`), though B15/OD-09 require the sending device ID for a phone-sent command (A §5.2) | An optional identifier weakens the audit of who switched the mic | Make `sendingDeviceId` required when the actor is a device; update A §5.2 | 03_api_contract.md §5.2 |
| SEC35-18 | S8 | Low | The `SESSION_HOLDER` condition op 81 depends on is proposed, not yet in `contract-model.ts` (A §0; current set at `contract-model.ts:88-112`) | Op 81's access rule cannot be finalised until M2 adds the condition | Already flagged by row 29; track it as an M2 deliverable and re-check at the M0/row-39 gate | 03_api_contract.md §0 |
| SEC35-19 | S8 | Low | The `409 CAPTURE_CONFIG_LOCKED` refusal says no `CAPTURE_CONFIG_CHANGED` row is written but does not state whether an `ACCESS_DENIED` row is (A §4/§5.1) | The denial-audit rule for ops 78-80 should be unambiguous for the one-row-per-refusal tradition (P2 SD-03) | State explicitly whether the idle-lock refusal writes `ACCESS_DENIED`; update A §4/§5.1 | 03_api_contract.md §4 |
| SEC35-20 | S9 | Medium | A revision records `signature_key_id` but not its signing certificate (D §B.9); the package stores one `device-certificate.pem` (P §A.1) | After key rotation an old revision cannot be re-verified from the package, breaking V-11 | Store the per-revision certificate sha256 (or retain a certificate set); update D §B.9 and P §B.9/§C.3 | 04_database_contract.md §B.9 |
| SEC35-21 | S9 | Low | `baseRevision` (op 85, A §2.3) has no column in `transcript_revisions` (D §B.9); the conflict rule relies on `max(revision_no)` in the write transaction | An unstated mapping invites a race or a wrong 409 | State the mapping: `baseRevision` = current max `revision_no`, checked inside the INSERT transaction; update A §2.3 / D §B.9 | 03_api_contract.md §2.3 |
| SEC35-22 | S10 | Medium | `RESET_BLOCKED_REAL_EVIDENCE` (D §E.2), `TRANSCRIPT_AUDIO_UNAVAILABLE` (T §A.1) and `CAPTURE_CREDENTIAL_SET` (D §B.3) are used but absent from row 29's 7 new error codes / 7 new audit types (A §1/§4/§5) | The pinned counts (38 codes, 60 types) and the OpenAPI/audit drift tests will disagree across specs | Reconcile the union of new codes and types across rows 29/30/33 and update the counts and lists; update A §4/§5, D §E.2, T §A.1 | 03_api_contract.md §4/§5 |
| SEC35-23 | S7 | High | The capture RTSP ingest bind address is not pinned; FFmpeg `-listen` defaults to `0.0.0.0`; C §A.8 only notes port collisions 8554-8564 | Unmoved, a LAN client could push a stream into a session (content injection / evidence integrity), defeating OD-13 | Pin the RTSP ingest and the fake-fixture listeners to `127.0.0.1` (ports 8554-8564) with a static assertion; update C §A.2/§A.8 and SP C-N4 | 05_capture_architecture_spec.md §A.2/§A.8 |
| SEC35-25 | S6 | Medium | G-R2 confines `src/capture/**` `node:fs`/`node:child_process` to "the files that own the supervisor spawn/handshake" but names no allowlist and no denied paths; `src/capture/**` is absent from G-R1's host-module list (C §G) | A permitted spawn file could read the signer key, the oMLX settings or `.data/pg.*`; the rule is weaker than a pinned allowlist and than the existing guards | Pin the exact allowed files (for example `supervisor.ts`, `ipc.ts`), deny credential/key/env paths, and add a test that no other `src/capture/**` file imports them; update C §G | 05_capture_architecture_spec.md §G |
| SEC35-26 | S8/privacy | Medium | REAL evidence can contain personal data (voice, `subject.name`, camera image), so the predecessor's synthetic-data GDPR exemption (P2 §9) no longer holds; the specs add a reset guard (OD-19) but no consent basis, retention/erasure, DPIA or breach-notification statement | Privacy obligations become live the moment REAL capture runs, even though this Mac stays on fakes | Add a privacy note to SP §A/§E.4 and D §E: processing is under the operator's legal mandate, sealed evidence is under legal hold (no erasure), loopback/demo until Q-HW; record a DPIA entry in row 40 | masterplan/01_specs.md §A/§E.4 |

**No Critical finding exists; the hard gate "0 Critical open" is met.**

---

## 3. Credential-shaped value audit

Every new audit detail-key list and every new error message was checked for a secret-shaped key or
value. `Clean` = no credential, token, key, key id, password, cookie, typed username, raw camera
credential or signed URL (or prefix). `Finding` = a named finding.

| Checked item | Keys / text | Result | Finding |
|---|---|---|---|
| `CAPTURE_CONFIG_CHANGED` (A §5.2) | `operationId, scope, field, trackId?, inputId?, deviceId?, from?, to?, permission?` | Clean (all identifiers/enums) | — |
| `AUDIO_SOURCE_SWITCHED` (A §5.2) | `fromInput, toInput, fromMs, toMs, sendingDeviceId?` | Clean; `sendingDeviceId` optional weakens attribution | SEC35-17 |
| `CAMERA_POE_CYCLED` (A §5.2) | `deviceId, poePort, streamWasLost, confirmed, gapFromMs?, gapToMs?` | Clean | — |
| `TRANSCRIPT_REVISED` (A §5.2) | `revisionId, authorId, number, baseRevision, changeCount, machineTranscriptHash, reason?, permission?` | Clean; never the body; `reason` is free text under the general rule | — |
| `MIC_SILENT` (A §5.2) | `inputId, thresholdDbfs, durationMs, sinceMs, active` | Clean | — |
| `EVIDENCE_MEDIA_SERVED` (A §5.2) | `fileId, bytesServed, rangeStart?, rangeEnd?, signed, expiresAt?` | Clean; never the URL | — |
| `EVIDENCE_EXPORT_FAILED` (A §5.2) | `jobId, kind, reason` | Clean | — |
| Changed `DEVICE_COMMAND` (A §5.3) | adds `command: POE_CYCLE`, `poePort` | Clean | — |
| Changed `ACCESS_DENIED` (A §5.3) | `operationId, permission?, role?, reason?` | Clean; camera-credential refusal carries `reason` only | — |
| Referenced `CAPTURE_CREDENTIAL_SET` (D §B.3) | not defined in A §5.2 | Finding: audit type absent from row 29 | SEC35-01, SEC35-22 |
| Error `CAPTURE_CONFIG_LOCKED` (A §4) | "The capture configuration cannot be changed while a session is open." | Clean | — |
| Error `AUDIO_SOURCE_CONFLICT` (A §4) | "The requested microphone cannot become the active source." | Clean | — |
| Error `CAMERA_NOT_LOST` (A §4) | "Only a camera whose stream is lost can be power-cycled." | Clean | — |
| Error `TRANSCRIPT_NOT_READY` (A §4) | "The transcript is not available yet." | Clean | — |
| Error `TRANSCRIPT_REVISION_CONFLICT` (A §4) | "The transcript revision is based on a revision that is no longer current." | Clean | — |
| Error `EXPORT_IN_PROGRESS` (A §4) | "An export job is already running for this evidence item." | Clean | — |
| Error `MEDIA_NOT_AVAILABLE` (A §4) | "No playback media is available for this evidence item." | Clean | — |
| Error `RESET_BLOCKED_REAL_EVIDENCE` (D §E.2) | not defined in A §4 | Finding: code absent from row 29's 7 new codes | SEC35-22 |
| Error `TRANSCRIPT_AUDIO_UNAVAILABLE` (T §A.1) | not defined in A §4 | Finding: code absent from row 29's 7 new codes | SEC35-22 |
| Log blanking list 1 (web) | `apps/core-web/src/runtime/error-sink.ts:52` `/\b(ses|dvc|bio)_[A-Za-z0-9_-]+/g` | Named in A §2.4 and P §G.4; prefix/insertion not pinned | SEC35-13 |
| Log blanking list 2 (mobile) | `apps/mobile/src/runtime/log.ts:46` `/\b(ses|dvc|bio)_[A-Za-z0-9_-]+/g` plus `SENSITIVE_KEY` at `:44` | Named in A §2.4 and P §G.4; prefix/insertion not pinned | SEC35-13 |
| oMLX API key handling (T §B.2) | memory-only, never in DEMS config; no blanking entry | Finding: key shape not covered by either list | SEC35-14 |
| Forbidden-key CHECKs | `0001_tables.sql:199` and `:220` (17 keys) | Clean today; D §C.6 reserves the additions `secret`, `ciphertext`, `keyRef`, `onvifUuid` for this review | Consolidated into SEC35-01/22 (the reserved swap is needed) |

**Both log blanking lists are named** in the specs (A §2.4 and P §G.4 name the web error sink and the
mobile `runtime/log.ts`); the "single-list" defect does not occur. What is missing is the prefix value
and the exact insertion points (SEC35-13).

**Required forbidden-key extension.** D §C.6 reserves the next `*_details_no_secret_keys_check` swap for
"row 35". This review confirms the extension is needed for the new vocabulary:
`secret`, `secretCiphertext`, `ciphertext`, `nonce`, `keyRef`, `onvifUuid`, `signedUrl`, `mediaUrl`.
The swap must land in 0004 at both `:199` and `:220` (D §C.6; E-30). No secret value was found in the
current 7+ lists, so this is a hardening extension, not a defect fix.

---

## 4. RBAC walk for the new operations (five roles)

The codebase defines exactly three stored roles (INVESTIGATOR, SUPERVISOR, TECHNICIAN;
`packages/shared/src/sim/vocabulary.ts:16-21`). "OPERATOR" is the principal class (a signed-in
operator session), not a stored role, and "ADMIN" does not exist — `SUPERVISOR` holds the
administrative permissions `USER_ADMIN`, `PAIRING_MANAGE`, `DEMO_CONTROL`
(`packages/shared/src/sim/auth.ts:53-72`). The walk uses the register matrix (A §2.1; `REG` SH-04/CS-12)
and the grants in `auth.ts:47-72`.

| Role | New operations it may reach | Reaches anything it should not? |
|---|---|---|
| INVESTIGATOR | 76, 77 (AUTHENTICATED reads), 81 (`SESSION_START` + `SESSION_HOLDER`), 82/83/84/86 (AUTHENTICATED / `EVIDENCE_VIEW`), 85 (`TRANSCRIPT_REVISE`), 88 (`EVIDENCE_VIEW`) | No new capture-config write (no `CAPTURE_CONFIG`) and no export (no `EVIDENCE_EXPORT`); correct. The `SESSION_HOLDER` condition further narrows 81 to the session creator or a supervisor |
| SUPERVISOR | all INVESTIGATOR ops, plus 78/79/80 (`CAPTURE_CONFIG`) and 87 (`EVIDENCE_EXPORT`) | No; it is the widest role by design (evidence export + capture config). It should NOT gain a transparent camera-credential reveal (SEC35-02) |
| TECHNICIAN | 76, 77, 78/79/80 (`CAPTURE_CONFIG`), 82/83/84/86 (intended `EVIDENCE_VIEW`), 88 (`EVIDENCE_VIEW`) | No session `SESSION_START`, no `TRANSCRIPT_REVISE`, no `EVIDENCE_EXPORT`, no `DEVICE_MANAGE` beyond op 48's existing rule; correct |
| OPERATOR (principal class, not a role) | Whatever the underlying role grants; the `SESSION_HOLDER` condition on op 81 checks that the caller is the operator who created the open session or a SUPERVISOR (A §0/§2.1) | No; the condition is correct but is not yet materialised (SEC35-18) |
| ADMIN (no such role) | n/a | No role yields administrative bypass; `SUPERVISOR` is the closest and is bounded by the same per-operation rules |

Cross-role observation: `EVIDENCE_VIEW` reaches every role, and op 88 turns that read into a
decrypted-media stream of REAL evidence with no case scope (SEC35-16). This is the one place a role
reaches an operation whose consequence changed materially in this phase.

---

## 5. Pre-existing vs new

Task 2's review (`P2 gateway_check/03_security_design_review.md`) is read-only; its accepted items are
carried, not re-litigated. This phase's review is scoped to the new surfaces.

| Item | Task 2 (read-only; accepted) | This phase (new surface) |
|---|---|---|
| Boundary | Local demo, one Mac, every listener 127.0.0.1, plain HTTP loopback, synthetic data (P2 §1.4, §2) | Unchanged (SP C-N4); REAL evidence now in scope by design (OD-02/OD-19), so the synthetic-data exemption for blanket read and GDPR lapses (SEC35-16, SEC35-26) |
| Cleartext loopback | Accepted (P2 §8 R-03) | Carried; new RTSP ingest must join it (SEC35-23) |
| Bearer secrets, no proof of possession | Accepted for session token + device credential (P2 §8 R-05, §5.5) | New bearer media URL (SEC35-12) and the oMLX key (SEC35-14) extend the class |
| Blanket read by every role | Accepted (P2 §8 R-12) for synthetic data | Now covers REAL evidence via `EVIDENCE_VIEW` + op 88 (SEC35-16) |
| No MFA, no password change | Accepted (P2 §8 R-16); demo password disclosure with conditions C1-C4 (P2 §5.4, SD-17) | Carried; the LAN gate preconditions (demo password replacement + B3, `REG` E-26) remain the trigger |
| Device credential without auth requirement | Accepted with conditions (P2 §5.5, SD-18) | Unchanged; the camera credential is a new, separate store (S1) |
| Signing | Simulated and labelled (P2 §1.4) | Real software Ed25519; the host-key forger threat model is newly material and must be stated (SEC35-06) |
| GDPR | Not triggered: synthetic data, no erasure/export needed (P2 §9) | REAL evidence can carry personal data; no consent/retention/DPIA statement (SEC35-26) |
| ISO 27001 Annex A | Design-level status recorded (P2 §9) | See §7 |

Items the controller accepted in task 2 (R-01..R-17, P2 §8) are **not** reopened here. The findings
above are all on surfaces that did not exist at task 2 (camera credentials, session-signer keys,
signed media URLs, the RTSP listener, REAL-evidence access).

---

## 6. OD-13 / listener summary

Every listener in the design, its bind address and its gate status. "P0" = present in the current
repository; "new" = introduced by this phase's design.

| Listener | Port | Bind address in the design | Authority | Gate status |
|---|---|---|---|---|
| Core server (main) | 4420 | `127.0.0.1` | SP C-N4; OD-13 (D4) | Loopback-gated; LAN is class C-5 |
| Core server (lanes) | 4421-4423 | `127.0.0.1` | D §F step 5 | Loopback-gated; lane re-creation at M2 |
| Vite dev servers | 5173-5178 | `127.0.0.1` | D §F step 6; P2 §5.3 | Loopback; 5173/5174 SMART WMS untouched |
| PostgreSQL (project cluster) | 4432 | `127.0.0.1` | D §F red lines; D240 | Loopback; never host `*:5432` |
| oMLX STT/TTS service (external) | 8000 | `127.0.0.1` | T §B.2; D7(d) | DEMS never binds/restarts; key handling SEC35-14 |
| Evidence media route (op 88) | Core server port | loopback-only (`http://127.0.0.1:<port>/…`) | A §N-4; E-31 | Signed URL; construction/TTL unpinned (SEC35-12) |
| Capture RTSP ingest (new) | 8554-8564 | **not pinned**; FFmpeg `-listen` defaults to `0.0.0.0` | C §A.2/§A.8 | Finding SEC35-23: must be pinned to `127.0.0.1` |
| Fake RTSP fixture readers (new, tests) | 8554-8564 | expected loopback; not pinned | C §A.8; NM-14 | Same pin required as SEC35-23 |

**No LAN listener is opened by design.** The preconditions that gate any LAN exposure remain the
predecessor's (replace the published demo password + B3/W99-2/W99-3; SP C-N4; `REG` E-26; P2 §5.4 C4),
and none of the five specs opens that path. The only exposure-shaped gap is the unpinned RTSP ingest
bind (SEC35-23).

> **Erratum PE-126-03 (D75; `01_specs.md` C-N13).** Since rev 2.3 one bounded exception to SEC35-23
> exists — the WS-Discovery probe socket of a camera search — and the Core gains its first outbound
> connections (the connection test). The table of every socket after the delta is §11.8; the
> findings are SEC35-27..SEC35-33 and SEC35-40.

---

## 7. GDPR / ISO applicability (design level)

| Dimension | Status | Note |
|---|---|---|
| GDPR — data minimisation | Observation | Sealed evidence is evidentiary, not minimisable; the new capture config carries device identifiers, not personal data (A §2.3) |
| GDPR — consent / legal basis | Gap | No consent or legal-basis statement for REAL capture (SEC35-26); task 2's synthetic exemption (P2 §9) lapses when REAL evidence exists |
| GDPR — retention / erasure / portability | Gap | Reset is blocked while REAL evidence exists (OD-19), but no retention period, erasure path or export-for-data-subject statement exists (SEC35-26) |
| GDPR — security of processing | Partially met | Per-fragment GCM, write-only credentials, signed packages; key stores unpinned (SEC35-03/08) |
| GDPR — DPIA / breach notification | Gap | No DPIA entry and no breach-detection/notification flow for REAL evidence (SEC35-26) |
| ISO A.9 Access control | Met with findings | RBAC + deny-by-default + new permissions (S8); blanket `EVIDENCE_VIEW` on REAL evidence (SEC35-16); reveal permission missing (SEC35-02) |
| ISO A.10 Cryptography | Met with findings | AES-256-GCM per fragment, Ed25519, AES-GCM credential store; key stores/protection unpinned (SEC35-03/07/08), AAD unspecified (SEC35-10) |
| ISO A.12.4 Logging and monitoring | Met with findings | Hash-chained audit + exact detail-key lists; media-token prefix and oMLX key unblanked (SEC35-13/14) |
| ISO A.12.6 Vulnerability management | Carried | B2 baseline 54/51 with accepted-risk entries (`REG` W1-C6); no new dependency added by rows 29-33 |
| ISO A.13 Communications security | Met with findings | Loopback only; RTSP ingest bind unpinned (SEC35-23) |
| ISO A.14.2 Security in development | Met with findings | Static guards extended (C §G), but G-R2 confinement is weaker than the existing guards (SEC35-25) |
| ISO A.16 / A.18 | Carried / gap | Task 2 recorded "not applicable" for a synthetic demo (P2 §9); REAL evidence needs an incident path and a compliance statement (SEC35-26) |

---

## 8. Self-gate

| Gate check (blueprint row 35 / task) | Result |
|---|---|
| At least 7 surface verdicts, numbered | **10/10** (S1-S10, §1) |
| Every finding has severity + mitigation + owning section | **23/23** (§2; each row has all three) |
| 0 Critical open | **0 Critical** (High 4, Medium 15, Low 4) |
| Both log blanking lists named (or a finding) | **Both named** (A §2.4; P §G.4 = web error sink + mobile `runtime/log.ts`); prefix/insertion missing, raised as SEC35-13 |
| RBAC walk for all five roles | **Performed** (§4: INVESTIGATOR, SUPERVISOR, TECHNICIAN, OPERATOR-as-principal, ADMIN-as-nonexistent) |
| Every claim cites `file:line` / decision ID / fact ID | Yes — each finding cites a spec section, a register row, a decision ID and/or `path:line` |
| No emoji; English; tables over prose; no secret printed | Yes — no `.data/pg.*` value, no oMLX key, no media byte |
| No specification edited by this row | Yes — the only writes are this file and `delegation_progress/security-review__row35.md` |

---

## 9. Next steps and routing

| Finding(s) | Route |
|---|---|
| SEC35-01, SEC35-22 | Row 29 (03_api_contract.md) — add the credential operation + audit type; reconcile the new-code/type union with rows 30/33 |
| SEC35-02, SEC35-03, SEC35-20, SEC35-21 | Row 30 (04_database_contract.md) — reveal permission, credential key store, per-revision certificate, `baseRevision` mapping |
| SEC35-04, SEC35-08, SEC35-09, SEC35-10, SEC35-23, SEC35-25 | Row 31 (05_capture_architecture_spec.md) — RTSP bind pin, key store, key-loss statement, AAD, G-R2 allowlist |
| SEC35-11, SEC35-12, SEC35-13 | Row 32 (06_evidence_package_spec.md) — `fragments.json` coverage, media URL signing, blanking prefix/insertion |
| SEC35-14 | Row 33 (07_transcript_spec.md) — oMLX API-key handling |
| SEC35-16, SEC35-17, SEC35-18, SEC35-19 | Rows 29/34 — REAL-evidence access decision, `sendingDeviceId`, `SESSION_HOLDER`, idle-lock audit |
| SEC35-26 | Row 28 (01_specs.md) + row 40 — privacy/DPIA note for REAL evidence |
| All | Row 37/40 fold the accepted mitigations into the M2-M9 rows; no finding blocks the M0 gate |

**Blocker: none.** The review is complete; every finding is design-level and actionable without new
hardware or a new decision beyond the privacy note (SEC35-26) that row 40 can carry.

## 10. Addendum — R-8 STT configuration surface (RV-SPEC, 2026-10-08; CONFIRMED by D24, Q-STT-CFG answer (a); D20) **Erratum PE-R8-15 (D24)**

Not reviewed by row 35 (R-8 did not exist then). Recorded here so the second-gate reader sees the new
surface; the formal review belongs to the security row of the milestone that implements R-8; the
user confirmed Q-STT-CFG on 2026-10-08 (D24). No finding is closed or added to the 23 counted above.

| Surface | Design in the R-8 sections | Security expectation to verify at implementation |
|---|---|---|
| STT credential at rest | `stt_config` holds a REFERENCE (oMLX key stays in `~/.omlx/settings.json`, consistent with SEC35-14 "referenced by path only") or AES-256-GCM ciphertext with a `key_ref` into the Core credential store (`04 §B.13`) | column-level SELECT excludes the secret columns for `dems_app`; one reading module; never in slices/logs/audit; the D-DB-07 "no new DB roles" rule holds |
| API | ops 90-92 (`03 §2.5`): credential write-only, responses carry `credentialSet`/`credentialKind` only; `STT_CONFIG_CHANGED` carries field names only | exact detail-key list; both log-blanking lists cover the credential form; secret sweep `X-SEC-1` |
| Network | endpoint restricted to loopback by API rule and DB CHECK (`ENDPOINT_NOT_LOOPBACK`) | OD-13 holds; no LAN listener or outbound non-loopback call |
| RBAC | edit/test `CAPTURE_CONFIG` (SUPERVISOR + TECHNICIAN), read all roles | RBAC walk extended to ops 90-92 (five roles) |

## 11. Delta 2026-10-09 (blueprint row 126) — R-9 discovery and credential-gated connect flow, R-10 no-device notifications, R-11 development-only local sources **Erratum PE-126-04 (D73-D84)**

**VERDICT OF THE DELTA: CAUTION. 0 Critical. 4 High, 11 Medium, 8 Low — 23 new findings SEC35-27..SEC35-49.**

CAUTION, not PASS: four findings are High and three of them need a text change in a spec before the
implementing row starts (SEC35-28, SEC35-31, SEC35-40); one design claim of the delta is false as
written (SEC35-34: the credential cannot be zeroed). Not FAIL: no finding is Critical, every finding
has a mitigation mapped to a scheduled row, and none needs new hardware or a new blueprint row. The
verdict of rows 29-33 at the top of this file (PASS-WITH-FINDINGS, 23 findings) is unchanged and its
counts are not merged with these.

**What was reviewed (read-only).** `masterplan/01_specs.md` §B.2 and C-N13..C-N15 (row 120);
`03_api_contract.md` §2.6, §3.1, §5.2, §5.4, §7, §9 (row 121); `04_database_contract.md` section N
(row 122); `05_capture_architecture_spec.md` §A.1.1, §A.1.2, §A.6.0-§A.6.5, §A.7.1, §A.8.1, §G.1, §J
H-11..H-21 (row 123); `06_evidence_package_spec.md` §B.12, V-15, §D.1, §H.5 (row 124);
`08_client_ux_spec.md` §8b-§8g, §15 (row 125); `decisions/decisions.md` D72-D84; the six row
records under `delegation_progress/`. Code read for the existing protections:
`apps/core-server/test/static/network.test.ts`, `apps/core-server/src/capture/__tests__/static.test.ts`,
`packages/shared/src/api/redaction.ts`, `apps/core-web/src/features/api-reference/try-it.ts`,
`apps/core-server/src/modules/stt-config/`, `apps/core-server/src/plugins/permission-guard/decision.ts`,
`apps/core-server/src/index.ts`, `packages/capture-protocol/src/index.ts`.

**Citation convention of this section.** Spec lines are `file:line` of the working tree of
2026-10-09 (HEAD `101ce62`, rows 120-125 uncommitted). `PKG path:line` = the published source of the
npm package `onvif` 0.8.3, see §11.1. Severity scale as §2 plus **Info**; none is used.

**No secret value and no device-identifying value appears in this section.** No camera credential
exists in the repository; no real network was probed by this row; no camera or microphone was opened.

### 11.0 Frame (CLAUDE §8, tier 1)

| Axis | Content |
|---|---|
| Subject | The security, privacy and control view of the rev 2.3 scope: a Core that sends a multicast probe to the LAN, lists unauthenticated answers, sends an operator-typed camera credential to a listed device, and can record this Mac's own camera and microphone in a development mode |
| Stakeholders | The user (owner of the network, of every camera credential, of the face and voice in local recordings); operators with `CAPTURE_CONFIG`; the controller (rulings D80-D83); rows 127, 128 and 129-142; rows 61, 65, 66, 71, 84 |
| Timeline | Spec row of 2026-10-09; corrections land at the spec gate row 128; mitigations in M4 (131, 132, 136, 137, 138, 142), M5 (66/71 wiring, 139, 140), M7 (84, 141) |
| Scope — in | The row's six points and what was found beside them (§11.9). Design level: documents and existing code, no new code |
| Scope — out | The class-C pull path for a real camera (C-2); a LAN listener (C-5, OD-13); the findings SEC35-01..26 of rows 29-33 (not re-litigated; three are extended and say so) |
| Rationale | D76 moves a credential from "stored for a configured device" to "typed and sent to whatever answered a multicast probe" — a new trust decision made by an operator on unauthenticated data (`05:440`, V-6). D74 puts personal data of the developer on disk. Both are new surfaces after row 35 |
| Method | Read every delta and record whole; trace each claim to its line; read the package source that will carry the credential; check each new outbound or OS door against the static guards that exist; one measurement of the XML parser on hostile input (§11.1); for each of the row's six points at least one finding with ID, severity, mitigation, owning row and a named check |
| Alternatives considered for the verdict | PASS (rejected: a High with a wrong design claim must be corrected in the spec, not only noted); FAIL (rejected: 0 Critical; every High has a mitigation inside rows already scheduled) |
| Assumptions | A-1: the registry tarball read in §11.1 is the artifact row 131 will install (integrity value quoted). A-2: `xml2js` behaves on the version row 131 pins (`^0.6.2`) as on the installed 0.6.0 measured here — row 131 repeats the measurement. A-3: OD-13 holds (every DEMS listener on loopback) |
| Gaps | No camera lock-out threshold has a source in this repository (SEC35-38). No real device answered a probe in this review (none was sent). Browser password-manager behaviour is stated from the reviewer's knowledge, not measured (SEC35-37). Whether this folder is covered by a cloud-sync or backup tool is not known and may not be read by an agent (U-3) |

### 11.1 Evidence gathered by this row

**(a) The package that will carry the credential.** `onvif` is not installed (`node_modules/onvif`
absent on 2026-10-09). The published tarball of 0.8.3 was downloaded to the session scratch
directory and unpacked for **reading only** (nothing installed, nothing executed, no lockfile
touched): `https://registry.npmjs.org/onvif/-/onvif-0.8.3.tgz`, 55,303 bytes, registry
`dist.integrity` `sha512-55gkQKRH…EFL+tw==` — equal to the SHA-512 of the downloaded file;
`lib/discovery.js` SHA-256 `9370a677…27f6a5`, the value row 123 recorded (`05:510`);
`lib/cam.js` SHA-256 `043886a7…528e8ea7`, 1,301 lines. Read by inspection:

| # | Observation in 0.8.3 | Source | Used by |
|--:|---|---|---|
| P-1 | The password is never sent in clear: the only SOAP credential form is `UsernameToken` with `Password Type="…#PasswordDigest"`; `PasswordText` has 0 matches in `lib/`; `basic` has 0 matches in `lib/` | `PKG lib/cam.js:1243-1251`; grep over `lib/*.js` | SEC35-31 — **H-21 (`05:1386`) confirmed by reading for the HTTP and SOAP layers** |
| P-2 | An HTTP 401 is answered only when a `WWW-Authenticate` value **starts with `Digest`**; a Basic-only challenge ends in the error "Digest authentication headers not found" and nothing is sent | `PKG lib/utils.js:155-163` (`getDigestHeaders`); `PKG lib/cam.js:320-336` | SEC35-31 |
| P-3 | **The `UsernameToken` is attached to every request built with `_envelopeHeader()` whenever the client object holds a username and a password** — `GetServices`, `GetCapabilities`, `GetProfiles`, `GetStreamUri` — without any challenge from the device. It carries the **username in clear** and `base64(SHA-1(nonce + created + password))` | `PKG lib/cam.js:1216-1230`, `:1243-1251`, `:974-984`, `:752-759`; `PKG lib/media.js:1001-1012`, `:1138-1185` | SEC35-31, SEC35-38 |
| P-4 | `GetSystemDateAndTime` is sent without a credential first; on a 401 **or on a body that contains "unauthorized"** it is **sent again with the `UsernameToken`** | `PKG lib/cam.js:529-545`, `:566-584` | SEC35-38 |
| P-5 | HTTP Digest: realm, nonce, qop and **the hash algorithm name** come from the device; default MD5 | `PKG lib/cam.js:437-509` | SEC35-31 |
| P-6 | The response body is collected **without a size limit** | `PKG lib/cam.js:349-360` | SEC35-33 |
| P-7 | The only timeout is a socket **idle** timeout (default 120 s); no total deadline, no abort handle is returned | `PKG lib/cam.js:94`, `:377-384` | SEC35-33 |
| P-8 | The constructor takes an `agent` and uses it for every request | `PKG lib/cam.js:95`, `:291` | SEC35-33 (the door for a deadline and a byte cap) |
| P-9 | `preserveAddress` rewrites host and port of every service address the device returns to the constructor's values | `PKG lib/cam.js:1279-1287` | confirms CT-3 (`05:583`) |
| P-10 | No redirect is followed (0 matches of `location` / `redirect` in `lib/cam.js`) | grep | SEC35-32 |
| P-11 | The events `rawRequest` and `rawResponse` carry the whole envelope — the username and the digest included | `PKG lib/cam.js:367`, `:407` | SEC35-36 |
| P-12 | `GetServices` reads `linerase(data).getServicesResponse.service` and calls `.forEach` on it with no guard; `linerase` turns a one-element list into an object and walks the answer recursively | `PKG lib/cam.js:992-1012`; `PKG lib/utils.js:18-39` | SEC35-33 |
| P-13 | The password is used as a JavaScript **string** (`[username, realm, password].join(':')`; `Buffer.from(this.password, 'ascii')`) and the username is concatenated into XML and into a header unescaped | `PKG lib/cam.js:451`, `:1224`, `:1247`, `:482` | SEC35-34, SEC35-35 |
| P-14 | `package.json` has `main: lib/onvif.js` and no `exports` map; `lib/onvif.js` loads `lib/discovery.js` (the `dgram` code row 123 rejected) | `PKG package.json:6` | SEC35-27 |

Not executed: every statement above is from reading. What only a run can show is listed as
hypotheses H-22..H-24 in §11.11.

**(b) The XML parser on hostile input — one measurement.** A 30-line script in the session scratch
directory called the installed `xml2js` 0.6.0 (`sax` 1.6.1, Node v26.8.2) with `strict: true`,
`explicitArray: true`. Output, 2026-10-09:

| Input | Result | Time |
|---|---|--:|
| Ten-level entity expansion in an internal DTD | callback error "Invalid character entity" — nothing expanded | 1 ms |
| External entity (`SYSTEM "file:///…"`) | callback error "Invalid character entity" — nothing read | < 1 ms |
| Elements named `__proto__` and `constructor` | dropped; `Object.prototype` not changed; the result object keeps the normal prototype | — |
| 2,300 nested elements in 16,100 bytes; 9,000 in 63,000 bytes | parsed, callback OK | — |
| 4,090 sibling elements / 1,300 attributes in 16 KiB | parsed, 2-4 ms, heap + 1 MiB or less | — |
| Bytes that are not XML | callback error | < 1 ms |
| **A recursive walk of the 2,700-level result inside the callback** (`JSON.stringify`) | `RangeError: Maximum call stack size exceeded` | 5 ms |
| **A callback that throws** | **the exception leaves `parseString` synchronously, to its caller** | — |

Reading: H-14 (`05:1379`) holds for entity expansion and for prototype pollution on this version.
Its second half — "never throws outside the parse call" — is the wrong question: the parser does
not throw, but **any exception raised in our own code inside the callback is rethrown out of
`parseString` into the datagram handler**, and any recursive treatment of the parsed tree can be
made to overflow the stack inside the 16 KiB cap. `apps/core-server/src/index.ts:95` turns every
uncaught exception into a process exit. That is SEC35-29.

**(c) The existing guards.** `test/static/network.test.ts:42-45` forbids the module names `https`,
`http2`, `dgram`, `tls`, `undici`, `axios`, `node-fetch` in every runtime source (`:148-152`, "the
server runtime calls no global fetch and imports no outbound client"); it does **not** name `http`,
`net` or any npm package that opens sockets by itself. `src/capture/__tests__/static.test.ts:38`
forbids `net`, `dgram`, `tls`, `http`, `https`, `http2` in the host units only (`:30`, modules,
engine, plugins, core); `src/capture/**` has no socket rule (`05:1245-1247` says so). The only
runtime import of a socket module today is a type import (`src/realtime/index.ts:58`).
`redaction.ts:100-105`: a member name is a credential when it holds `credential` (except three
flags), `secret`, `apikey`, `authorization`, `password`, `passphrase`, or ends in `token` —
**`username` is not one**. `try-it.ts:39-48`: eight denied operations, op 89 among them, ops 95 / 96
not yet. `permission-guard/decision.ts:185-188`: a device-bound session is `principal.deviceId !==
null`.

### 11.2 Point 1 — the SEC35-23 exception: the discovery socket

**What the design gets right.** One `udp4` socket per search, port 0, no `reuseAddr`, no group
membership, TTL 1, closed on every path (`05:474`, `:477`, `:1253`); two fixed probes that carry
nothing about the product (`05:478`); a datagram is used only when on-link, at most 16 KiB, with a
matching `RelatesTo` (`05:480`); 256 datagrams and 64 responders per search; counts-only logging
(`05:484`); "could not run" kept apart from "nothing found" (`05:485`); the package's own discovery
rejected for a crash on one datagram (`05:521`). The Core answers nobody, so it cannot be used as a
reflector or an amplifier: it emits only on an operator action, at most 4 datagrams per interface
per search and 6 searches per minute (`03:1009`).

**What an on-link attacker can still do.** The probe is multicast, so every host on the segment
reads its message ID: `RelatesTo` (`05:480`, "the only secret a responder must have seen") keeps
out blind off-link injection and nothing else. An on-link host can therefore answer as any number
of devices, from its own address or — UDP has no handshake — with the source address of any other
on-link host.

| ID | Sev | Title — where | Risk | Mitigation | Row | Check (for row 127) |
|---|---|---|---|---|---|---|
| SEC35-27 | Medium | **The outbound exemptions are not written, and the guard would stay green while its sentence turned false** — `05:1253-1255` (G-R9..G-R11); `network.test.ts:42-45`, `:148-152` | Row 131 must import `dgram`, which the server-wide scan forbids; the cheapest fix is to drop `dgram` from the list for the whole tree. The scan also does not see the package `onvif`, which opens HTTP and HTTPS connections and ships its own `dgram` discovery (P-14): after row 142 "the server opens no outbound connection" is false and nothing fails | Exemptions **by file, pinned by name, with a positive control each**: (1) `dgram` — exactly `src/capture/adapters/camera/ws-discovery.ts`; (2) the package `onvif` joins the forbidden list and is exempt in exactly `src/capture/adapters/camera/onvif-session.ts`, imported as `onvif/lib/cam` so that `lib/discovery.js` is never loaded into the Core (P-14); (3) `http` and `net` join the scan list; `http` / `https` exempt in `onvif-session.ts` for the name `Agent` only (SEC35-33), the existing type import of `realtime/index.ts` pinned; (4) `net`: **no** exemption — after D82 no RTSP client exists, so G-R10 (`05:1254`) becomes "no file under `src/capture/**` imports `node:net`" and `rtsp-describe.ts` is not created; (5) the test title becomes "…opens no outbound connection except from the two pinned files"; (6) the injected loopback probe target (`05:487`) is passed by no file under `src/` outside test support | 131 (1, 5, 6), 142 (2, 3, 4), 61 (family count) | `M4-SEC-NET-1` static: the pin lists equal exactly the two files; planting each module name in a third file turns the test red |
| SEC35-28 | **High** | **Forged answers: clone, crowd-out and spoofed source** — `05:480` (DS-8), `:481` (DS-9), `:493-494` ("de-duplicated by endpoint reference, the first source address is kept"); `03:1007` | (a) **Clone:** a rogue host reads a real camera's endpoint reference and name with its own probe and answers the Core faster from its own address; the de-duplication keeps the rogue and **silently drops the real camera**. The operator sees one row with the right name and model and types the camera's credential into it (SEC35-31). (b) **Crowd-out:** 64 forged responders arrive first; the real cameras fall off the list. (c) **Spoofed source:** a forged answer whose source is another on-link host — the Core's own LAN address included — makes that host a testable candidate (SEC35-32) | (1) **Never de-duplicate across source addresses silently:** two answers with one endpoint reference from different addresses are both listed with `conflict: true`, neither is testable, and the list says "Two devices announce the same identity"; the same when two endpoint references come from one address. (2) An answer is dropped and counted when its source is an address of this host, the network or broadcast address of the probed interface, or a multicast or unspecified address. (3) One answer per source address per search; a second one is counted, not listed. (4) The cap keeps **already-registered matches first**, then arrival order, and `truncated: true` is drawn as a warning, not a note. (5) When the datagram cap is reached the socket is closed at once. (6) A candidate matched as `REGISTERED` by endpoint reference whose address differs from the stored one is marked `addressChanged` | 131 (1-5), 132 (4, 6 in the shape), 137 / 138 (text) | `M4-SEC-DISC-2` unit on the stub: clone from a second address -> two rows, both `conflict`, 0 testable; 300 responders -> 64, registered ones kept; source = own address / broadcast / network address -> dropped and counted; second answer from one source -> counted, not listed |
| SEC35-29 | **High** | **A search is allowed while a session records, and one uncaught exception in the handler ends the Core** — `03:457` (D80(4)); `05:489-494`; `05:530-533` (H-14); `index.ts:95` | §11.1 (b): an exception from our own code inside the parse callback leaves `parseString` synchronously; a recursive walk of a parsed answer overflows the stack within the size cap. Uncaught, either stops the Core process during a recording — from the network, without authentication, in the 3 s after an operator pressed Search | (1) The whole datagram handler is one `try` / `catch` that counts and drops; no code of ours runs outside it. (2) Parser options pinned in the one file: `strict: true`, `explicitArray: true`, `async: false`, no value or attribute processor. (3) The parsed answer is read **by fixed paths only** — no recursive walk, no serialisation, no clone, never handed to a logger. (4) The size cap is applied to the byte length before any text is made; a datagram containing `<!DOCTYPE` or `<!ENTITY` is dropped before parsing. (5) Bound per search stated in the spec: 256 datagrams x 16 KiB = 4 MiB read, each parsed and released before the next; a stored candidate is at most 2 KiB (hint lists capped at 8 entries of 120 characters). (6) **Order of work:** searching during `RECORDING` is switched on only after `M4-SEC-DISC-1` and `M4-SEC-DISC-3` pass; until then op 93 answers `409 INVALID_STATE` in that state (controller decision C-4) | 131 (1-5), 132 (6) | `M4-SEC-DISC-1` unit on the stub, fake clock: every case of ST-2 (`05:863`) plus 2,300-level nesting at 16 KiB, 1,300 attributes, a DOCTYPE, `__proto__` / `constructor` elements, and a handler made to throw -> 0 uncaught exceptions, the search completes, heap growth under 8 MiB. `M4-SEC-DISC-3` integration: a hostile flood during a fake-worker `RECORDING` session -> the session continues and its fragment counter advances; 2 runs |
| SEC35-30 | Low | **What the probe tells the network, and which networks it reaches** — `05:476` (DS-4), `:475` (DS-3), `:478` | The probe shows every listener this host's address, that an ONVIF client is here and when an operator is working. On a multi-homed host it is sent on up to 4 interfaces — a bridge, a shared or guest network — and a device found there can be adopted as a camera. IPv6: none (`udp4`); stated correctly as a gap | (1) The search result and its audit row carry the **number of interfaces probed**; the panel says "Searched N networks". (2) No interface name or address in any response, log or audit row (already DS-12). (3) Class C: one configuration key naming the camera interface of the Core device, decided when the device's network is known (the alternative row 123 set aside, `05:476`). (4) A static assertion that the socket type literal is `udp4` | 131 (1, 2, 4), 132 (1), class C-1 entry pack (3) | `M4-SEC-DISC-4`: with two fake interfaces the result reports 2 and the audit row carries the count only; the real-LAN check prints counts and model class only (0 address, MAC or serial pattern in the tool output and in every committed file) |

### 11.3 Point 2 — the connection test: not SSRF, not a port scan, but a credential sent on trust

**What holds.** No operation takes an address (`03:411`, `03:1110` N-9); the target is a candidate
id resolved in the caller's own live search (`03:447`); a foreign, expired or `testable: false`
candidate is refused with 0 outbound requests; a service address is used only when its host equals
the datagram source (`05:481`); `preserveAddress` pins every later request (P-9); no redirect is
followed (P-10); nothing but reads is called (`05:581`, `:1255`).

**What the anti-steering rule does not do.** It stops a responder from aiming the operator at a
third host. It does nothing about a responder that is itself the attacker, at its own address,
announcing the name and model the operator expects. And "digest only" is not "secret": per P-3 the
first authenticated request already hands the device the account name in clear and a SHA-1 digest
over a nonce and timestamp the device also receives — enough to test password guesses offline at
hashing speed. Over plain HTTP the same pair is readable by anyone who can see the traffic.

| ID | Sev | Title — where | Risk | Mitigation | Row | Check |
|---|---|---|---|---|---|---|
| SEC35-31 | **High** | **Credential phishing by a rogue responder; "never in clear" overstates the protection** — `05:572`, `:586` (CT-6), `:604` (CR-5); `03:448`; `08:797`, `:804`; P-1..P-5 | One "Connect" on a rogue or cloned row gives the attacker the camera's account name and an offline-attackable digest of its password; a typical camera password does not survive that. With `https:` the certificate is not checked (CT-6), so TLS does not identify the device either | **Reduce the chance, bound the exposure, say the truth.** (1) Protocol: Basic and `PasswordText` are impossible in 0.8.3 (P-1, P-2) — keep the Basic-only stub mode as the regression check (`05:864`). (2) Exposure: the credential is attached to **one** request first, after the pre-authentication calls ran on a client object that holds no credential (SEC35-38), and never again after a refusal; never an automatic retry (already R-9 AC-7). (3) Operator's knowledge: the dialog shows the address, the endpoint reference and the hardware hint, the sentence "This device has not been verified. Its name and model are what it announced.", and the outcome of SEC35-28 (`conflict`, `addressChanged`); **Test connection is enabled only after the operator ticks "I have checked that {{address}} is this camera"**. (4) Spec text: `05` CR-5 and `08` §8d.3 say "sent as a digest: not readable in transit, but a device that receives it can test guesses against it — use a password that is used for this camera only". (5) Class C (C-1 / C-2): HTTPS with the certificate recorded at adoption and compared at every later connection; a dedicated camera network. (6) Residual accepted by the user: U-1 | 142 (1, 2), 137 (3), 128 (4: spec texts 05 and 08), class C entry pack (5) | `M4-SEC-CONN-1` on the stub: Basic-only and `PasswordText`-demanding modes -> 0 requests that contain the fixture password, its base64 form or `Authorization: Basic`; outcome `AUTHENTICATION_FAILED`. `M4-SEC-UI-1` (web): Test is disabled until the confirmation is ticked; the dialog shows address and endpoint reference |
| SEC35-32 | Medium | **What is left of SSRF and port scanning** — `03:447`; `05:481`, `:583` | The **port and path** of the service address are the responder's choice, and with a spoofed source (SEC35-28 c) the host is any on-link machine: an operator's click makes the Core send an HTTP POST to a chosen on-link host and port, and the outcome tells open from closed. It needs an operator action per target and is rate-limited; the value to an attacker is small, the Core's own LAN address excepted | (1) SEC35-28 (2): this host's own addresses are never candidates. (2) Scheme `http` or `https` only, an explicit or default port in 1-65535, no user-info, no fragment, path of at most 128 characters from the URL-path character set; anything else -> `testable: false`. (3) The request agent is created per test with no proxy and no keep-alive; the environment's proxy settings are not consulted. (4) The stream address returned by `GetStreamUri` is compared and **stored never, contacted never** in this phase (D82). (5) `UNREACHABLE` is the only outcome for every transport failure — the response does not tell "refused" from "timed out" | 131 (2), 142 (3-5) | `M4-SEC-CONN-3` (shared with SEC35-33): service address with user-info, a host name, an IPv6 literal, port 0 -> not testable; a 302 answer -> 0 requests to the second host |
| SEC35-33 | Medium | **A hostile device answering the test** — `05:584` (CT-4), `:587` (CT-7); P-6, P-7, P-11, P-12 | The package collects an unlimited body, has no total deadline and no abort, walks answers recursively and reads `GetServices` without a guard. A device can hold a test open by dripping bytes, grow the Core's memory, or raise an exception; uncaught, that is a process exit (`index.ts:95`). Tests run only while no session is open (`03:457`), so a recording is not at risk — an export or a transcription job is | (1) One `http.Agent` / `https.Agent` per test, passed to the constructor (P-8): the route's `AbortSignal` destroys it at the 15 s deadline — the only way to enforce CT-4; (2) its sockets count received bytes and are destroyed above 1 MiB per test; (3) every package callback is wrapped (`try` / `catch`, called-once guard) and its error mapped to a closed code (CT-7); (4) **no listener** on `rawRequest`, `rawResponse`, `warning` (static rule; P-11); (5) the client object never leaves `onvif-session.ts`: the file exports a facade with the five reads of G-R11 (`05:1255`), so `set*`, reboot and PTZ are unreachable by construction, not only by a call list; (6) for `https:` `rejectUnauthorized: false` appears only in that file with `minVersion: 'TLSv1.2'`, and CT-6's sentence stays | 142 | `M4-SEC-CONN-3` on the stub: a body of 64 MiB, a one-byte-per-second drip, a one-service `GetServices` answer, a missing response element, a 3,000-level body -> one of the five outcomes inside the deadline, 0 uncaught exceptions, heap growth under 16 MiB |

### 11.4 Point 3 — credential handling: reuse, lifetime, logs, the browser

**No reuse across devices: holds by construction.** The test takes its credential from the request
(`03:411`, `:450`); nothing caches it; the stored credential of device A is reachable only through
the reveal function for device A (`04:1194-1199`); adapters hold no literal and no default table
(`05:1258`, G-R14). One correction to the wording of R-9 AC-7 (`01:293`: "from … the operation-89
entry written … for that same device"): by D80(7) / D81 the test takes it from the request body of
op 95 / 96, not from the store — the acceptance criterion should say so (hand-over §11.10).

| ID | Sev | Title — where | Risk | Mitigation | Row | Check |
|---|---|---|---|---|---|---|
| SEC35-34 | Medium | **The stated memory guarantee is not achievable** — `05:601-602` (CR-2, CR-3); `03:450`; `08:807-809` | CR-2 passes the secret as a `Buffer` and CR-3 zeroes it. The package needs a **string** (P-13), the JSON body parser already made one, and the web form holds another for two requests: the buffer protects nothing and the text implies an erasure that does not happen | **State the real guarantee and delete the rest:** "The credential is request-scoped on the Core: one request, never serialised, never persisted, never logged, not reachable from any object that outlives the request. It cannot be erased from memory; it stays until the garbage collector frees it and would be in a heap snapshot or a core dump of that moment." Then: (1) drop `Buffer` and `fill(0)` from CR-2 / CR-3; (2) the Core is not started with heap-snapshot or diagnostic-report options in any documented command; (3) the route's schema error for ops 89 / 95 / 96 never echoes a received value; (4) the web form keeps the values in component state only, for at most the two requests, and unmounts on close (`08:809` — kept) | 128 (spec 05 text), 142 (2, 3), 137 (4) | `M4-SEC-CRED-1` (canary, below) covers 3 and 4; a unit test asserts that the adapter, the candidate state and the registry hold no reference to the credential after the call returns |
| SEC35-35 | Low | **Characters the package mishandles** — `03:411` ("username: text 1..255, secret: text 1..1024"); P-13 | A password with a non-ASCII character is hashed from truncated bytes: the camera refuses a correct password, and each refusal counts toward the camera's lock-out. A username with `<`, `&`, a quote or a line break changes the SOAP envelope or the header | For ops 95 / 96 (and 89 for parity): username = 1..255 printable ASCII without `<`, `>`, `&`, `"`, `'`, `\`; secret = 1..1024 printable ASCII; anything else is `422 INVALID_INPUT` before any network request, with a field message that says which characters are accepted. Recorded as a limit of this phase (a camera with a non-ASCII password cannot be tested) | 142, 137 (message) | `M4-SEC-CRED-2` unit: each rejected class -> 422 and 0 outbound requests |
| SEC35-36 | Medium | **The username is credential material, and the shared blanking rule lets it through** — `redaction.ts:100-105`, `:137`, `:240`; `03:819-820`; `05:1260`; P-11 | **Decision of this review: the typed camera username is treated exactly like the password** — in no log, audit detail, error, realtime frame, alert, counter key or URL (`03` §5.1 already lists "typed username"). Checked: the audit keys of `CAPTURE_CONNECTION_TESTED` hold none (`03:822-831`); the lock-out counter is keyed by host (`03:459`) and must stay so — never by username. Gap: as an **object**, `{ credential: { username, secret } }` is blanked whole through its parent name; as **text** (a serialised body in an error message) the parent is skipped because its value is an object and only `secret` is blanked — the username survives; the body of op 89 (`{ username, secret }` at top level) loses only `secret` in both forms; the package's option object is `{ username, password }` | (1) One rule added to the shared module: a member named `username`, `user`, `login` or `account` is blanked when a sibling member is a credential name, and inside the span of a `credential` member in text form. (2) The capture log rule of G-R4 extended (`05:1260`) already names `username` — keep. (3) No CHECK swap is needed: `username`, `password`, `credential` and `secret` are already among the 28 denied top-level keys of `audit_log.details` and `events.params` (`apps/core-server/src/db/migrations/0006_stt_config.sql:33-34`). `host` and `endpointRef` are not denied and are used per C-3; the audit key is never named `onvifUuid` (denied). **Erratum PE-128-85 (D86 C-3, C-6).** (4) The package's option object and its error objects are never passed to a logger (SEC35-33 (3)) | 142 (1, 2, 4) | `M4-SEC-CRED-1`: a username canary and a secret canary through ops 89, 95 and 96 — success, every refusal, a forced 500, a timeout and an abort — give 0 hits in responses, the Core log, the error log, audit rows, events, alerts, realtime frames, the web error sink, the query cache, `localStorage`, `sessionStorage` and the URL; plus unit cases of the blanking rule for the three bodies in object and text form |
| SEC35-37 | Medium | **The browser side: autofill, the reveal control, Try-it** — `08:805-806`, `:1569` (OP-125-6); `try-it.ts:39-48`; `03:462` | (a) The worst autofill case is inward: the browser fills the **operator's own console password** into the camera fields and the operator sends it to a camera or a rogue device. (b) `autocomplete="new-password"` stops that but invites the browser to offer saving the camera password under the console's origin. (c) With no way to see what was typed, a typing mistake spends one of very few attempts against the camera's own lock-out. (d) Ops 95 / 96 are not yet in the deny list | (a, b) Keep `type="password"` and `autocomplete="new-password"` on the password and `autocomplete="off"` on the username; add neutral `name` / `id` values, `spellcheck="false"`, `autocapitalize="off"`, `autocorrect="off"` and the ignore hints of the common password managers; no native form submission. State plainly in the spec that no attribute is a guarantee and that the operator should decline an offer to save. (c) **OP-125-6 decided: a reveal control is allowed for the value being typed** — off by default, back to hidden on blur, on submit and on close, never for a stored value (none exists), and no screenshot or DOM capture of a gate report is taken while it is on. Availability of the camera account outweighs shoulder-surfing at an operator console; row 125's "0 flows show a stored credential" stays true. (d) `testCaptureCandidateConnection` and `adoptCaptureCandidate` join `TRY_IT_DENIED_OPERATIONS` (10 entries) in the row that registers them | 137 (a-c), 142 or 132 (d — whichever registers ops 95 / 96), 128 (spec 08 text) | `M4-SEC-UI-1` agent-browser: with a saved console login in the test profile both camera fields are empty at open, after 1 s and after focus; the attributes are present; the reveal control starts hidden and returns to hidden on blur, submit and close; the deny list has 10 entries and Try-it refuses 95 and 96 |

### 11.5 Point 4 — rate limits and the lock-out guard

| Scope | In the contract (`03:459`, `:1003-1016`) | Assessment |
|---|---|---|
| Search — per Core | one `RUNNING`; 6 per minute | sufficient as traffic: at most 96 datagrams per minute on 4 interfaces |
| Search — per operator session | 10 s between starts | sufficient; no hourly bound (SEC35-39) |
| Test — per candidate | one in progress | sufficient |
| Test — per host | 5 s between attempts; 3 `AUTHENTICATION_FAILED` in 15 minutes, counted per Core by host | counts tests where the camera counts requests (SEC35-38) |
| Test — per operator | none | add one (SEC35-39) |
| Test — per Core | 6 per minute | sufficient; `05:585` says "one at a time per Core" — reconcile |

| ID | Sev | Title — where | Risk | Mitigation | Row | Check |
|---|---|---|---|---|---|---|
| SEC35-38 | Medium | **The lock-out guard counts tests; a camera counts rejected requests — and the threshold is a guess** — `03:999-1001`, `:1014-1015`; `05:584-585`; P-3, P-4 | One test with a wrong password can deliver several rejected credentials: the retried `GetSystemDateAndTime` (P-4), `GetServices` and its fallback, `GetProfiles`, and one HTTP-digest round — so "3 failed tests" can be 6 to 12 failures at the camera. No camera's lock-out rule has a source in this repository; the contract's "about five" is labelled a hypothesis by its author | (1) **Budget in requests:** the pre-authentication calls run on a client object constructed **without** a credential (then P-3 and P-4 attach none); the credential is set for `GetProfiles`; the test stops at the first refusal; at most one digest follow-up -> **at most 2 rejected credential-bearing requests per failed test**, asserted on the stub. (2) **Conservative default, to be written into row 142 in these words:** "`CAPTURE_CONNECTION_TEST_MAX_FAILURES = 2` per host in `CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS = 1_800_000`. This value is a conservative default and is not derived from any camera's documentation. Before the first test against a real camera the user is asked for that model's lock-out rule and the constant is re-pinned (class C-1 entry item)." (3) Semantics: counted per Core by host; not reset by a new search, another session or another operator; reset by a `REACHABLE` outcome on that host; the re-verification of op 96 counts; `UNREACHABLE` does not count; a refusal makes 0 outbound requests. (4) The counter lives in memory and a Core restart clears it — accepted: a restart needs host access and is itself visible in the log; stated in the spec. (5) The row of the failure that trips the guard carries `guardTripped: true` (SEC35-46) | 142; 128 (constants in 03 §7 and 05 CT-4 / CT-5) | `M4-SEC-CONN-2` on the stub: wrong password -> at most 2 requests carrying a `UsernameToken` or an `Authorization` header, the two pre-authentication requests carry none, a 401 on `GetSystemDateAndTime` is not answered with a credential. `M4-SEC-CONN-4` fake clock: the semantics of (3), each as one case |
| SEC35-39 | Low | **Gaps and disagreements in the limit set** — `03:1005-1016` against `05:479`, `:483`, `:584-585` | No per-operator bound on tests (one operator can use the Core's whole budget); no long-window bound on searches (6 per minute for a day is 8,640 audit rows and a standing nuisance on the user's network); a pre-check search refused by the limit is skipped (`03:443`), so one operator's searching can silence another's pre-check search. The two specs disagree on four constants | (1) Tests: at least `CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS` between two tests of one operator session, on any host. (2) Searches: at most 30 per hour per operator session. (3) The pre-check search has its own allowance of one per pre-check run, outside the per-minute bound, still single-flight. (4) One value each, fixed at row 128: search window 3,000 ms (`05:479`, D82) not 5,000 (`03:1005`); test deadline 15 s (`05:584`) with `CAPTURE_CONNECTION_TEST_TIMEOUT_MS` renamed or re-valued (`03:1010` says 10 s); failure window and count per SEC35-38; search spacing per session 10 s **and** per Core 5 s | 132 (2, 3), 142 (1), 128 (4) | `M4-SEC-RATE-1` fake clock: one case per bound, each refusal with 0 datagrams or 0 outbound requests |

### 11.6 Point 5 — the development-only fence

**Who controls the flag.** `DEMS_CAPTURE_DEV_SOURCES` is an environment key read at boot through
one function (`05:188`, `:195`, G-R15 `:1259`); the environment is read by the entry point only
(`network.test.ts:115-117`). No operation and no database value sets it. So a production deployment
can be switched to development sources by whoever starts the Core process, and only after every
production device has been unassigned (`05:210`, row 8) — an audited operator action. What that
person then records is labelled `DEVELOPMENT` in the registry, in the UI and in the signed manifest.
A stored `LOCAL_DEVICE` row in a production database is refused at boot when assigned and inert when
not (`04:1329-1331`). **By configuration alone, a development source cannot be made to look like
production.** One path does that without touching the flag:

| ID | Sev | Title — where | Risk | Mitigation | Row | Check |
|---|---|---|---|---|---|---|
| SEC35-40 | **High** | **A package labelled `PRODUCTION` from whatever pushes into the loopback listener** — `05:204` (row 2: "nothing is recordable until a real camera is adopted"), `:417` (`openSource` for `ONVIF_RTSP` = class C-2), `:617-625`, `:697-699`; `packages/capture-protocol/src/index.ts:244`, `:263`; `06:867-869` (§H.5) | The worker **listens** on `127.0.0.1` and accepts the first RTSP push; it has no pull path and the listener has no authentication. In `REAL_PRODUCTION`, once a camera has been adopted and assigned, a session start opens that listener for 15 s although no product component will ever push to it. **Any local process that pushes a stream during the window is recorded, and the Core signs a manifest whose every source reads `PRODUCTION`** — the class comes from the adapter kind of the assigned device, not from what fed the ingest. This is the case §H.5 says cannot be told apart by a verifier, reachable without the signing key and without changing code or configuration | (1) **In this phase no listener opens for a slot that has no source opener:** the plan builder refuses a camera or microphone whose adapter kind cannot be opened by the Core (`ONVIF_RTSP`, `USB_AUDIO` today) with a typed refusal `SOURCE_KIND_NOT_RECORDABLE`, before `app.capture.start`; the session does not start and nothing listens. (2) Consequence stated in `05` §A.1.2 and `06` §H.5: **on this phase's code no all-`PRODUCTION` package can be sealed**; `REAL_PRODUCTION` serves search, test, adoption and assignment only (this is D82's consequence, made a rule). (3) Class C-2 entry criterion: the pull path (the recording process dials the camera, so no listener exists) or a per-session ingest secret; `06` §H.5 gains the guard "the Core itself opened the source". (4) Session start re-reads the four source rows it writes and refuses when their class is not the class of the running operation (the fence is otherwise checked at boot only) | 136 (1: the registry states which kinds have an opener, and its plan-builder part refuses the others), 66 and 71 (1, 4: plan builder and session start), 140 and 141 (the two checks), 128 (2: spec 05 and 06 text), class C-2 entry pack (3) | `M5-SEC-SRC-1` (row 140): `REAL_PRODUCTION` with a registered `ONVIF_RTSP` device row placed by the test set-up and assigned (a loopback candidate is never `ONVIF_RTSP`, SEC35-41 (a); **erratum PE-128-86**) -> session start refused with the typed code, socket snapshot shows 0 listeners in 8554-8564, a local push finds the port closed, 0 evidence files; 2 runs. `M7-SEC-SRC-2` (row 141): every package sealed on this Mac in this phase has `developmentSources = true` (the check `06` §H.5 proposes, made mandatory) |
| SEC35-41 | Medium | **Soft spots of the fence** — `05:156` (RG-1), `:201-212`; `03:447`, `:455`; `04:1305-1330`, D-DB-12 (`DEFAULT 'FAKE'`) | (a) In `REAL_DEVELOPMENT` the discovery and test half of `ONVIF_RTSP` is registered (RG-1); a candidate found through it — the loopback stub of the tests included — is adopted with a **production** kind unless a rule says otherwise. (b) A boot in development mode on a database that once held production evidence leaves no trace in the audit chain. (c) `DEFAULT 'FAKE'` makes an INSERT that forgets the column a development device: safe for the manifest, unsafe for the reset guard (SEC35-42). (d) The helper program path comes from the environment | (a) The class of a candidate is decided by the registry from **how it was found**, never from its own data: a candidate reached through the injected loopback target, or whose host is a loopback address, is `FAKE`; op 96 refuses to write `ONVIF_RTSP` for a loopback host. (b) Every boot writes one audit row naming the capture operation (`SIMULATED` / `REAL_PRODUCTION` / `REAL_DEVELOPMENT`); a refused boot writes its refusal code to the log. (c) A static pin: every INSERT into `capture_devices` names `adapter_kind`. (d) SEC35-43 | 136 (a, c), 142 (a), 61 (b) | `M4-SEC-FENCE-1`: one test per row of the table `05:201-212`; a loopback ONVIF candidate is never `PRODUCTION`; the boot audit row; the static pin |
| SEC35-42 | Medium | **The reset-guard exemption for development packages (D83, O-5)** — `04:1343`, `:1466`; `04:1114-1130` (N.4); `06:478` | Can it be used to erase real evidence? Not through the runtime role: `development_sources` is written at INSERT with no UPDATE grant, from `session_capture_sources` (INSERT only), from `adapter_kind` (no UPDATE grant). The database owner can change anything and is outside the guard's purpose (it guards against accidents). What remains: (a) `NULL` on every v1 and pre-migration item — an exemption written as "not false" would unprotect all of them; (b) a single summary column decides destruction; (c) real content recorded through development sources (an interview filmed with the laptop camera) is no longer protected, by design | (1) The predicate is `development_sources IS TRUE` — `NULL` and `false` block. (2) Cross-check before the reset proceeds: every exempted item's session has exactly four `session_capture_sources` rows and none has a production kind; any mismatch blocks with the item count. (3) The reset states how many development packages it will erase and proceeds only on the existing confirmation. (4) The narrowing of OD-19 is the user's to confirm (U-2); the label "Development source" on every such item is what tells an operator that it is not protected | 129 (the reset guard lives with the database code; row 128 confirms the owner) | `M4-SEC-RESET-1` on a throw-away database: `NULL` blocks; `true` with one production source row blocks; all-development passes and prints the count; 2 runs |
| SEC35-43 | Low | **The helper processes** — `05:650-656`, `:681-693` (HL-2..HL-13), `:791-794`, `:803` (ML-2), `:211` (row 9), `:1256` (G-R12) | Sound: fixed argument table, no shell, empty environment, the existing process door, no listener, standard error never logged raw. Remaining: (a) the program path is checked for mode only — not its owner, its parent directories or what a symbolic link resolves to; that program runs with this Mac's camera and microphone permission; (b) a device chosen by name: if the match is not exact equality, or the name is absent, FFmpeg may open another entry — the list holds two screen-capture entries (`05:660`), which would record the developer's **screen**; (c) ML-2 builds the pipe path from a session id and a device id while HL-3 says no database value reaches an argument; (d) a Core killed hard leaves its helpers to end by themselves | (a) Resolve the path, require owner = root or the Core's user, and no group- or other-writable directory on the way. (b) Enumerate first; start the helper only when exactly one entry **equals** the name; no argument table contains a screen-capture name or option; the list is re-read before every open (already asked of row 134). (c) Both ids are checked against their strict patterns before the path is built, and the resolved path must stay under the run directory. (d) At boot in development mode the Core looks for helper processes of an earlier run by the exact program path and refuses to start capture until none is left (it reports them; it kills nothing it did not start). (e) What FFmpeg can be made to open: only the two fixed inputs and the two validated outputs — keep the G-R12 test and add "no `-i` value outside the table, no `movie=` or `amovie=` filter, no `-f` outside `avfoundation`, `lavfi`, `rtsp`, `f32le`, `null`" | 136 (a, c, d, e), 134 (b), 135 (b, c) | `M4-SEC-HELPER-1`: unit tests for each refusal of (a) and (c); the static argument test of (e); a stub device list with a near-match name and with the name absent -> `DEVICE_NOT_FOUND`, 0 processes started |

### 11.7 Point 6 — privacy of local-device recordings

Local-device recordings are personal data of the developer and of anyone in the room: face, voice
and whatever is said. This extends SEC35-26 (§2) to a case that exists on this Mac in this phase,
before any real camera does.

| ID | Sev | Title — where | Risk | Mitigation | Row | Check |
|---|---|---|---|---|---|---|
| SEC35-44 | Medium | **Protection of local-device recordings rests on a git-ignore line** — `01:331-332` (R-11 AC-8, AC-9); `05:691-693` (HL-12..HL-14); `08` §8f.3; `.gitignore:47`, `:70` | (a) `.data/` is inside the repository folder under the user's Documents: a sync or backup tool that covers that folder copies the recordings off this Mac — not knowable by an agent (U-3). (b) Until sealing v2 (M7) the files of rows 134, 135 and 140 are plain fMP4 and PCM. (c) **An agent that opens a frame, a still or an audio file of such a recording with a viewing tool sends it to the model provider** — the project's red line on user data; the same holds for a transcript of what the developer said and for a spectrogram or waveform. (d) No retention rule exists: every 2 + 1 run adds recordings. (e) The microphone is live in pre-check (the short open of HL-12) and for the whole session; bystanders are recorded. (f) Evidence captures in gate reports: a screenshot of evidence playback of a local-device package shows the developer | (1) **Agent rule (process):** no agent opens, views, attaches or transcribes local-device media or a frame of it; checks on it are numeric and local only — duration, sample count, level in dBFS, keyframe interval, hashes; transcript checks use the fake or fixture audio; playback screenshots use an all-`FAKE` session. (2) **Docs rule** (tightens R-11 AC-8): from a local-device session no still, no audio excerpt, no waveform or spectrogram, no transcript text and no playback screenshot enters `docs/`; G-R6 extended stays the static half. (3) **Retention:** test recordings of rows 134, 135 and 140 are at most 10 s each; the row report lists their paths and sizes and hands the user one command that deletes them; an agent deletes them only when the user says so (red line on deletion); at handover the user is asked once (U-4). The development reset (SEC35-42) is the bulk deletion. (4) **Indicator:** whenever a `LOCAL_DEVICE` microphone or camera is open — pre-check included — every client shows a fixed, non-dismissable "This Mac's microphone is on" / "…camera is on" state from Core data; the product does not rely on the operating system's own indicator. (5) **Permission:** as specified — the user answers the system prompt; no agent runs a tool that reads or edits the permission database or system settings; a row that finds it missing stops with a one-click command. (6) Location: U-3 decides whether the data directory stays under this folder | 134, 135, 140 (1-3, 5); 137, 138 (4); 128 (2: spec 01 R-11 AC-8 text; 4: spec 08 §8f) | `M4-SEC-PRIV-1` at each gate of rows 134, 135, 140: `git status --porcelain` media count 0; 0 media, image, waveform or transcript files from a local-device session under `docs/`; the row's command log has 0 uses of an image- or audio-reading tool on `.data/` media and 0 permission-database tools; the deletion command is in the report. `M5-SEC-PRIV-2` (web, tablet, phone): the "is on" state is drawn during pre-check and session with the stub helper, and gone after |

### 11.8 Listener and socket summary after the delta (addition to §6)

| Socket | Direction | Address | When | Authority | Status |
|---|---|---|---|---|---|
| WS-Discovery probe socket | outbound datagrams to `239.255.255.250:3702`; receives unicast answers | one `udp4` socket, port 0, bound to the one eligible interface or to the wildcard when several | only during a search (3,000 ms), 0 before and after | C-N13 (`01:396`); D75; `05:473-477` | **the one exception to SEC35-23**; not a listener for clients; conditions SEC35-27..30 |
| Connection test | outbound TCP (HTTP or HTTPS) to a candidate's own address | Core-chosen from the search state | one operator action, at most 15 s, only with no session open | D76; `05:581-587` | new outbound door; pinned to one file (SEC35-27); SEC35-31..33 |
| Development helpers | outbound TCP to `127.0.0.1` (the worker's ingest); a named pipe | loopback only; no port bound | development mode, during pre-check and session | D73; `05:635-636`, `:685` | inside SEC35-23; SEC35-43 |
| Fake ONVIF stub (tests) | listens, TCP and UDP | `127.0.0.1`, inside 8554-8564 | automated suite only | `05:855-858` | inside SEC35-23; `M3-RTSP-BIND-1` covers it |
| Worker RTSP ingest | listens | `127.0.0.1:8554-8564` | from session start for the listen window | SEC35-23; `05:697-699` | unchanged address; **must not open for a slot without a source opener** (SEC35-40) |

OD-13 is not reopened: no listener for a client exists outside loopback. The statement "the server
opens no outbound connection" of the task-2 guard ends with this delta and is replaced by "…except
from the two pinned files" (SEC35-27).

### 11.9 Beyond the six points

| ID | Sev | Title — where | Risk | Mitigation | Row | Check |
|---|---|---|---|---|---|---|
| SEC35-45 | Low | **`WEB_CONSOLE_SESSION` is a property of the session, not proof of a browser** — `03:97`, `:397-400`; `decision.ts:185-188` | The server can tell only whether the session is bound to a paired device. A device token cannot forge the condition (a device-bound session stays bound), but any HTTP client that signs in with an operator's password and no device credential holds it. With every listener on loopback that is acceptable; it must not be described as an authentication factor. "Before the body is read" (`03:399`) is also stronger than the server's request cycle normally gives | (1) Spec wording: "a policy fence that keeps the camera credential off the tablet and phone code paths; not an authentication factor". (2) The requirement becomes "refused before the body is **used**, and nothing of the body reaches a log, an audit row or an error" — covered by the canary. (3) The refusal writes its `ACCESS_DENIED` row with `reason: WEB_CONSOLE_ONLY` (as specified). (4) Re-examined before any LAN listener (C-5) | 142 (materialises the condition), 128 (wording) | `M4-SEC-CRED-1` includes a device-bound session calling 89, 95, 96 with canaries -> 403, 0 hits anywhere |
| SEC35-46 | Medium | **Audit: what a later investigation can and cannot answer** — `03:795-797`, `:817-831`; `04:1142-1143`; `04:1471` (G-2) | Sound: every test attempt is audited for every outcome, `AUTHENTICATION_FAILED` included (`03:817-819`); refusals by lock, rate limit and validation write nothing, which keeps the chain free of noise. Two gaps: (a) the moment the lock-out guard trips is not marked, and the refused attempts after it are invisible; (b) **no record anywhere says which address a credential was sent to** — candidates are never stored and the audit row holds a random candidate id. After a suspected phishing (SEC35-31) nobody can say which device received which camera's password | (a) The `CAPTURE_CONNECTION_TESTED` row of the failure that trips the guard carries `guardTripped: true`; refusals stay unaudited. (b) **Recommended to the controller (C-3):** for candidates of class `PRODUCTION`, `CAPTURE_CONNECTION_TESTED` and `CAPTURE_CANDIDATE_ADOPTED` carry `host` and `endpointRef`. This fits D75: the audit table lives in the git-ignored database cluster under `.data/`, and committed documents keep quoting counts only; it lifts the sentence "never … the host" (`03:819-820`) for these two types only. The username stays out (SEC35-36) | 142, 128 (03 §5.2) | `M4-SEC-AUD-1`: two failures -> two rows, the second with `guardTripped: true`; a third attempt -> 429 and no row (D86 C-2; **erratum PE-128-84**); (if C-3 is taken) the `PRODUCTION` test row holds `host`, the `DEVELOPMENT` one does not |
| SEC35-47 | Low | **Op 96: second exposure, and what the re-verification proves** — `03:452-454`; `04:1198` (F-122-2) | Sound: the order puts the sealer check before any network request, so before row 84 op 96 never sends a credential; the network attempt is outside the transaction; a failure leaves 0 rows. Remaining: the credential is sent to the device a **second** time (one more exposure, one more count); the device at that address may not be the one tested 5 minutes earlier; F-122-2 (a short password fails the CHECK unless the sealer frames it) | (1) Kept: the re-verification is the only proof that the stored credential works. (2) It compares the set of profile tokens with the one the passing test read; a difference is `409 CONNECTION_TEST_FAILED` with the reason `DEVICE_CHANGED`. (3) No database transaction is open while the network attempt runs (stated). (4) F-122-2 stays with row 84: the sealer frames to a fixed block, which also hides the length | 142 (1-3), 84 (4) | `M4-SEC-ADOPT-1` on the stub: profiles changed between test and adoption -> 409, 0 rows; `M7` after row 84: a one-character secret is stored (row 122's check) |
| SEC35-48 | Low | **Untrusted device text is stored and shown everywhere** — `03:425`, `:455`; `08:724`; `05:482` | Name, model and scope texts come from an unauthenticated datagram, are shown on three clients and — after adoption — stored in `capture_devices.model` and carried into every later view. The UX spec draws them as text with bidirectional isolation; nothing removes control and direction-override characters at the source | In the adapter, before a candidate exists: percent-decoding once, removal of C0 / C1 control characters and of the Unicode direction-override and zero-width characters, normalisation, a cap of 120 characters; a text that is empty afterwards is `null`. The clients keep their text-node rule | 131; 137, 138 | `M4-SEC-TXT-1`: a stub device whose name holds markup, a direction override, a line break and 5,000 characters -> one line of at most 120 visible characters on each client, stored the same |
| SEC35-49 | Low | **The new dependency** — `05:504-507`, `:535-540`; P-14; §11.1 (b) | `onvif` brings every ONVIF write operation into the process (time, network, reboot, factory default, PTZ) behind one call list; its nonce comes from a non-cryptographic generator (`PKG lib/cam.js:1218-1222`), which weakens replay protection at the camera, not the password; `xml2js` is installed at 0.6.0 while the package asks for `^0.6.2` | The facade of SEC35-33 (5); exact pins for `onvif` and `xml2js`; row 131 re-runs the measurement of §11.1 (b) on the pinned versions and the dependency audit after the install (B2 baseline, `01` C-N10), and records the integrity value quoted in §11.1 (a) | 131, 142 | `M4-SEC-DEP-1`: the lockfile integrity of `onvif` equals the value of §11.1 (a); the audit shows no new high finding in the Core runtime class |

### 11.10 Hand-over: which spec needs which correction at the spec gate (row 128)

| # | Spec | Place | Correction | Finding |
|--:|---|---|---|---|
| 1 | `05_capture_architecture_spec.md` | §A.6.1 DS-8, failure modes (`:480`, `:489-494`) | drop "the first source address is kept"; add the conflict rule, the excluded source addresses, one answer per source, registered-first cap, close at the datagram cap | SEC35-28 |
| 2 | same | §A.6.1a (`:530-533`), §J H-14 | parser options pinned; handler containment; fixed-path reads; H-14 reworded per §11.1 (b) | SEC35-29 |
| 3 | same | §A.6.2 (`:571-575`, `:584-585`, `:589-594`), §A.8.1 ST-4, §G.1 G-R10 | remove the RTSP `OPTIONS` / `DESCRIBE` half and `rtsp-describe.ts` (D82); the pre-authentication calls without a credential; the request budget; the per-test agent with deadline and byte cap; the facade | SEC35-27, 33, 38 |
| 4 | same | §A.6.3 CR-2, CR-3, CR-5 (`:601-604`) | the real memory guarantee; "digest" wording | SEC35-31, 34 |
| 5 | same | §A.1.1 RG-1 (`:156`), §A.1.2 rows 1-2 (`:203-204`) | class decided by how a candidate was found; row 1 widened (row 122 O-2); `REAL_PRODUCTION` records nothing in this phase and opens no listener for a slot without an opener | SEC35-40, 41 |
| 6 | same | §A.6.4 HL-3, HL-8, HL-10; §A.7.1 ML-2; §A.1.2 row 9; §G.1 G-R9, G-R11, G-R12 | helper path checks, exact-name rule, id patterns, leftover check at boot; the exemptions of SEC35-27 | SEC35-27, 43 |
| 7 | `03_api_contract.md` | §2.6 shapes (`:411`, `:418-430`) | `conflict`, `addressChanged`, `interfaceCount`; the character sets of `username` / `secret` | SEC35-28, 30, 35 |
| 8 | same | §2.6 rules (`:443`, `:457`, `:459`), §7 (`:1003-1016`) | search during `RECORDING` gated (C-4); the limit set of SEC35-39; the guard of SEC35-38; one value per constant against spec 05 | SEC35-29, 38, 39 |
| 9 | same | §5.2 (`:817-847`), §0 (`:97`), access notes (`:397-400`) | `guardTripped`; `host` / `endpointRef` if C-3 is taken; the wording of `WEB_CONSOLE_SESSION` | SEC35-45, 46 |
| 10 | same | §2.6 "Adoption" (`:452`) | profile comparison at re-verification; no transaction during the network attempt | SEC35-47 |
| 11 | `01_specs.md` | R-9 AC-7 (`:293`), R-11 AC-8 (`:331`), C-N13 verification cell (`:396`) | AC-7: the credential comes from the request of op 95 / 96 (D80(7), D81), not from the op-89 entry; AC-8: the docs rule of SEC35-44 (2); C-N13: name the findings SEC35-27..30 | SEC35-44; consistency |
| 12 | `06_evidence_package_spec.md` | §H.5 (`:867-872`) | add the unauthenticated loopback ingest as the case the guards did not cover, and guard "the Core itself opened the source"; "On this computer": no all-`PRODUCTION` package in this phase | SEC35-40 |
| 13 | `04_database_contract.md` | §E.2, N.10 (`:1343`), N.15 O-5 (`:1466`), N.6 | the guard predicate and cross-check (**erratum PE-128-85**: the forbidden-key additions are void) | SEC35-36, 42 |
| 14 | `08_client_ux_spec.md` | §8c.3, §8d.2, §8d.3 (`:797`, `:804-809`), §8f, §15.3 OP-125-6 | conflict and address-changed rows; the confirmation tick; the field attributes and the honest sentence; the reveal control; the "is on" indicator; "Searched N networks" | SEC35-28, 30, 31, 37, 44 |
| 15 | `identification/02_structured.md` (task-architect) | rows 66, 71, 131, 142 | row 66 / 71: the refusal of SEC35-40; row 131: no TCP read of device information (already routed by D82); row 142: "takes its credential only from the write-only operation 89" contradicts D81 | SEC35-40; consistency |

**Checks for row 127** (24 names; method, depth and owning row are in the finding rows above):
`M4-SEC-NET-1`, `M4-SEC-DISC-1`, `M4-SEC-DISC-2`, `M4-SEC-DISC-3`, `M4-SEC-DISC-4`,
`M4-SEC-CONN-1`, `M4-SEC-CONN-2`, `M4-SEC-CONN-3`, `M4-SEC-CONN-4`, `M4-SEC-CRED-1`,
`M4-SEC-CRED-2`, `M4-SEC-UI-1`, `M4-SEC-RATE-1`, `M5-SEC-SRC-1`, `M7-SEC-SRC-2`, `M4-SEC-FENCE-1`,
`M4-SEC-RESET-1`, `M4-SEC-HELPER-1`, `M4-SEC-PRIV-1`, `M5-SEC-PRIV-2`, `M4-SEC-AUD-1`,
`M4-SEC-ADOPT-1`, `M4-SEC-TXT-1`, `M4-SEC-DEP-1`. The pinned total of Try-it denied operations
(`03:1151`, 8) becomes 10. The existing `X-SEC-1` secret sweep gains the device-identifying patterns
(address, MAC, serial) for every gate from row 131 on.

### 11.11 Hypotheses added by this row (for §J of spec 05 at row 128)

| # | Hypothesis | Why not verified | Falsified by |
|---|---|---|---|
| H-22 | With the client object built without a credential for the pre-authentication calls and the credential set before `GetProfiles`, a failed test delivers at most 2 rejected credential-bearing requests | read in the source (P-3, P-4), not run | `M4-SEC-CONN-2` counts more than 2 on the stub |
| H-23 | A per-test agent passed to the constructor is the socket source of every request the package makes, so destroying it ends the test at the deadline and its byte counter sees every received byte | P-8 read, not run; HTTPS path not read in full | `M4-SEC-CONN-3`: the drip or the large body outlives the deadline or the cap |
| H-24 | Exceptions raised in the package's own callbacks on a hostile answer are caught by its `try` around the parse call and reach our callback as an error, at most once after our called-once guard | P-12 and §11.1 (b) read and measured separately, not together | `M4-SEC-CONN-3`: an uncaught exception or a second callback |
| H-25 | Cameras lock an account after a small number of rejected logins within minutes, and count rejected requests, not operator actions | no source in this repository; device behaviour differs by maker | the manual of the target camera states another rule -> the constants of SEC35-38 are re-pinned |
| H-26 | The field attributes of SEC35-37 keep a browser from filling the console's saved login into the camera fields; they do not reliably stop an offer to save | reviewer's knowledge of browsers, not measured | `M4-SEC-UI-1` finds a filled field |

### 11.12 Decisions needed, GDPR / ISO view, self-gate

**Answered by the user (D87):** U-1 accepted (plain-HTTP exposure on the known development network; the dialog still shows the target address); U-2 confirmed; U-3 no sync — the residual is the user's accepted risk; U-4 recordings are deleted only on the user's instruction. **Recorded by the controller (D86):** C-1..C-8 accepted. **Erratum PE-128-87.**

**For the user (a decision, not a design fix).**

| # | Question | Recommendation |
|---|---|---|
| U-1 | A camera spoken to over plain HTTP receives the account name in clear and the password as a digest that the receiving device — or anyone reading the camera network — can test guesses against. A device that only pretends to be the camera gets the same (SEC35-31). Accept this for the phase? | Accept, with the dialog's confirmation step, a password used for that camera only, and a dedicated camera network when real cameras arrive (class C) |
| U-2 | D83 lets a database reset erase packages recorded from development sources (this Mac's camera and microphone, test sources). Confirm that such packages are not protected evidence (SEC35-42) | Confirm, with the three conditions of SEC35-42 |
| U-3 | Is the folder that holds this repository covered by a cloud-sync or backup tool? If so, recordings of your face and voice under `.data/` leave this Mac (SEC35-44). No agent will look this up | Tell the controller; if yes, exclude `.data/` from the tool or move the data directory before row 134 runs |
| U-4 | When may local-device test recordings be deleted? | After each gate of rows 134, 135 and 140, by the one command the row hands over, run by you |
| U-5 | (Information, at class C) The lock-out rule of the target camera model | Needed before the first real connection test (SEC35-38) |

**For the controller to record.** C-1: OP-125-6 — a reveal control for the typed value is allowed
under the four conditions of SEC35-37. C-2: lock-out guard default 2 failures per host in 30
minutes with the request budget of SEC35-38. C-3: `host` and `endpointRef` in the two audit types
for `PRODUCTION` candidates (SEC35-46) — lifts "never the host" for those two rows only. C-4:
searching while `RECORDING` waits for `M4-SEC-DISC-1` and `M4-SEC-DISC-3` (SEC35-29). C-5: no
listener and no session start for a source kind without an opener; no all-`PRODUCTION` package in
this phase (SEC35-40). C-6: the typed camera username is credential material (SEC35-36). C-7: the
agent rules of SEC35-44 (1) and of `M4-SEC-DISC-4` — no viewing tool on local-device media, no
device-identifying value in tool output. C-8: the four constant disagreements between specs 03 and
05 (SEC35-39 (4)) and the two wording contradictions with D81 (§11.10 rows 11, 15).

**GDPR and ISO 27001, design level (additions to §7).**

| Dimension | Status | Note |
|---|---|---|
| GDPR Art. 5 minimisation / storage limitation | Gap -> mitigated by SEC35-44 | local-device recordings are personal data of the developer and bystanders; 10 s test recordings, a deletion command, no copies in `docs/`; third-party device identifiers are never stored for non-adopted devices (`04:1132-1143`) — a good minimisation decision, in tension with forensics (SEC35-46) |
| GDPR Art. 25 / 32 | Partially met | credentials write-only and request-scoped; plain media under `.data/` until M7; cloud-sync exposure unknown (U-3) |
| GDPR Art. 30 / 35 | Carried from SEC35-26 | the DPIA entry of row 40 gains "development recordings of the developer" as a processing activity |
| ISO A.9 Access control | Met with findings | `CAPTURE_CONFIG` on every step; owner-session-only candidates; the web-only condition is policy, not authentication (SEC35-45) |
| ISO A.10 Cryptography | Met with findings | digest authentication only (P-1, P-2); SHA-1 and MD5 digests are what ONVIF devices accept and are offline-attackable (SEC35-31); no certificate validation (CT-6) |
| ISO A.12.4 Logging and monitoring | Met with findings | every attempt audited; guard trip and target address missing (SEC35-46); username not blanked in two forms (SEC35-36) |
| ISO A.12.6 Vulnerability management | Open until row 131 | new dependency read, integrity recorded, audit after install (SEC35-49) |
| ISO A.13 Communications security | Met with findings | first outbound network use of the Core: two pinned doors (SEC35-27); forged answers (SEC35-28); TTL 1; no listener added |
| ISO A.14.2 Security in development | Met with findings | static rules G-R9..G-R15 are specific and testable; exemptions must be by file (SEC35-27); development fence sound at boot, one bypass through the ingest (SEC35-40) |
| ISO A.16 Incident management | Gap | no way to answer "which device received this credential" (SEC35-46); the response to a suspected rogue device is to change the camera's password — to be written into the operator text of row 137 |

**Self-gate of the delta (blueprint row 126 verification text).**

| Point of the row | Finding IDs | Highest severity | Mitigation mapped to |
|---|---|---|---|
| 1 — SEC35-23 exception (one UDP socket, multicast egress) | SEC35-27, 28, 29, 30 | High | rows 131, 132, 137, 138, 142, 61 |
| 2 — connection test as a non-SSRF, non-port-scan primitive | SEC35-31, 32, 33 | High | rows 131, 142, 137 |
| 3 — no credential reuse; credential handling | SEC35-34, 35, 36, 37 | Medium | rows 142, 137, 129 |
| 4 — rate limit on connection tests (and searches) | SEC35-38, 39 | Medium | rows 142, 132 |
| 5 — development-only fence | SEC35-40, 41, 42, 43 | High | rows 136, 140, 141, 142, 129, 134, 135 (with 61, 66, 71) |
| 6 — privacy of local-device recordings | SEC35-44 | Medium | rows 134, 135, 140, 137, 138 |
| Beyond the six | SEC35-45, 46, 47, 48, 49 | Medium | rows 142, 131, 137, 138, 84 |

| Gate check | Result |
|---|---|
| Each of the six points has a finding ID, a severity and a mitigation mapped to a row of 129-142 | **6/6** (table above; the existing rows 61, 66, 71 and 84 appear beside rows of 129-142, never instead of them) |
| 0 Critical left without a mitigation | **0 Critical**; 4 High, each with a mitigation, an owning row and a named check |
| Every finding has ID, title, severity, where, risk, mitigation, row, check | **23/23** |
| Every claim cites `file:line`, a decision ID, `PKG path:line` or a quoted run; unverified claims are labelled | yes — hypotheses H-22..H-26; §11.1 states what was read and what was run |
| No specification, code or tracker edited by this row | yes — writes: this file and `delegation_progress/security_review_row126.md` |
| No secret, no device-identifying value, no media byte in this section | yes |

---
*Generated: 2026-10-07 17:40*
*Last Updated: 2026-10-09 15:04 (row-128 spec-gate fix pass PE-128-84..87 (D89, D91; `gateway_check/27_r9_r11_spec_gate.md`); blueprint row 126, PE-126-01..PE-126-05: §11 security design review delta for R-9..R-11, SEC35-27..SEC35-49, verdict of the delta CAUTION; D73-D84); 2026-10-09 (status sweep PE-R8-14..15: §10 confirmed by D24); 2026-10-08 (RV-SPEC: §10 addendum for the R-8 STT configuration surface, added as a proposal, D20)*
