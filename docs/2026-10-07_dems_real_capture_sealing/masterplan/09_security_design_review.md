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
last_updated: 2026-10-07 17:40
---

# Security Design Review — real capture, sealing v2 and transcript (phase rows 29-33)

**VERDICT: PASS-WITH-FINDINGS. 0 Critical open.**

No finding makes the design unsafe inside the stated boundary, so the verdict is not FAIL and no
surface is a FAIL (a FAIL is reserved for an open Critical). The review raises **23 findings**: 4 High,
15 Medium, 4 Low, 0 Critical. Every finding names a severity, a concrete mitigation and the owning
spec section. This row changed no specification; findings route to rows 29-33 or to row 37/40.

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

## 10. Addendum — proposed R-8 STT configuration surface (RV-SPEC, 2026-10-08; pending Q-STT-CFG, D20)

Not reviewed by row 35 (R-8 did not exist then). Recorded here so the second-gate reader sees the new
surface; the formal review belongs to the security row of the milestone that implements R-8, if the
user confirms Q-STT-CFG. No finding is closed or added to the 23 counted above.

| Surface | Design in the proposed sections | Security expectation to verify at implementation |
|---|---|---|
| STT credential at rest | `stt_config` holds a REFERENCE (oMLX key stays in `~/.omlx/settings.json`, consistent with SEC35-14 "referenced by path only") or AES-256-GCM ciphertext with a `key_ref` into the Core credential store (`04 §B.13`) | column-level SELECT excludes the secret columns for `dems_app`; one reading module; never in slices/logs/audit; the D-DB-07 "no new DB roles" rule holds |
| API | ops 90-92 (`03 §2.5`): credential write-only, responses carry `credentialSet`/`credentialKind` only; `STT_CONFIG_CHANGED` carries field names only | exact detail-key list; both log-blanking lists cover the credential form; secret sweep `X-SEC-1` |
| Network | endpoint restricted to loopback by API rule and DB CHECK (`ENDPOINT_NOT_LOOPBACK`) | OD-13 holds; no LAN listener or outbound non-loopback call |
| RBAC | edit/test `CAPTURE_CONFIG` (SUPERVISOR + TECHNICIAN), read all roles | RBAC walk extended to ops 90-92 (five roles) |

---
*Generated: 2026-10-07 17:40*
*Last Updated: 2026-10-08 (RV-SPEC: §10 addendum for the proposed R-8 STT configuration surface, D20)*
