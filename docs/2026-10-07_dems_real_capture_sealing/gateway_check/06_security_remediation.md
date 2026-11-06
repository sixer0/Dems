---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: data-analyst-local
blueprint_row: 35-remediation
milestone: M0
tier: 1
type: security-remediation report
source_review: masterplan/09_security_design_review.md (row 35)
source_register: research/03_analysis.md
gate: M0 (row 39); implementation plan row 37 inherits these specs
status: done
verdict: APPLIED 21 / DEFERRED 2 / REJECTED 0
last_updated: 2026-10-07 17:45
---

# Security remediation — row 35 findings applied to the owning specs

This report applies the row-35 security design review (`masterplan/09_security_design_review.md`)
findings to their owning spec sections as **normative text**, so the M0 gate (row 39) and the
implementation plan (row 37) inherit corrected specs. No gate answer (D4) is weakened and no
row-32/33/36 decision (e.g. D-EV-1) is contradicted. Nothing in the review document itself was
changed; it stays as the record of what was found.

## 1. Findings disposition table (23/23)

| Finding | Severity | Owning spec (as routed) | Disposition |
|---|---|---|---|
| SEC35-01 | High | `03_api_contract.md` §2.2/§5.2 | **APPLIED** |
| SEC35-02 | High | `04_database_contract.md` §B.3/§D | **APPLIED** |
| SEC35-03 | Medium | `04_database_contract.md` §B.3 | **APPLIED** |
| SEC35-04 | Medium | `05_capture_architecture_spec.md` §A.6/§G | **APPLIED** |
| SEC35-06 | Medium | `06_evidence_package_spec.md` §C.3 | **APPLIED** |
| SEC35-07 | Medium | `06_evidence_package_spec.md` §C.3 | **APPLIED** |
| SEC35-08 | Medium | `05_capture_architecture_spec.md` §D.2 | **APPLIED** |
| SEC35-09 | Medium | `05_capture_architecture_spec.md` §D.2 | **APPLIED** |
| SEC35-10 | Medium | `05_capture_architecture_spec.md` §D.1 + `06_...` §B.6 | **APPLIED** |
| SEC35-11 | Medium | `06_evidence_package_spec.md` §A.1/§B.6/§D | **APPLIED** |
| SEC35-12 | Medium | `03_api_contract.md` §2.3/§2.4 | **APPLIED** |
| SEC35-13 | Medium | `06_evidence_package_spec.md` §G.4 (+ `03_...` §2.4/§7; `08_...` pointer) | **APPLIED** |
| SEC35-14 | Medium | `07_transcript_spec.md` §B.2 | **APPLIED** |
| SEC35-16 | High | `03_api_contract.md` §2.1/§2.2 | **APPLIED (provisional; needs second-gate confirmation)** |
| SEC35-17 | Low | `03_api_contract.md` §5.2 | **APPLIED** |
| SEC35-18 | Low | `03_api_contract.md` §0 | **DEFERRED** -> M2 implementation (rev-2 row 40) |
| SEC35-19 | Low | `03_api_contract.md` §4/§5.1 | **APPLIED** |
| SEC35-20 | Medium | `04_database_contract.md` §B.9 (+ `06_...` §B.9/§C.3) | **APPLIED** |
| SEC35-21 | Low | `03_api_contract.md` §2.3 + `04_...` §B.9 | **APPLIED** |
| SEC35-22 | Medium | `03_api_contract.md` §4/§5 (+ `04_...` §E.2, `07_...` §A.1) | **APPLIED** |
| SEC35-23 | High | `05_capture_architecture_spec.md` §A.2/§A.8 | **APPLIED** |
| SEC35-25 | Medium | `05_capture_architecture_spec.md` §G | **APPLIED** |
| SEC35-26 | Medium | `masterplan/01_specs.md` §A/§E.4 (row 28) | **DEFERRED** -> row 40 (privacy/DPIA) |

**Counts: APPLIED 21, DEFERRED 2, REJECTED 0.** No mitigation was rejected.

**Deferred reasons.** SEC35-18 (`SESSION_HOLDER`) is a code/schema deliverable, already carried by
row 29 §0 as an M2 item; its fix is code, so it is deferred with the exact mandating sentence (§5).
SEC35-26 (privacy/GDPR) is owned by `01_specs.md`, which this pass may only touch for S4/S5
client-facing findings; SEC35-26 is S8/privacy, so it is deferred to row 40 with the mandated
sentence (§5).

## 2. Per-APPLIED finding

Line numbers are in the edited file after the edit.

### SEC35-01 (High) — missing credential-write operation + audit type

- **What changed / where.** `03_api_contract.md`: §0 remediation note (L73); §1 operation-count
  table (L104-L110) and the rewritten *"Why 89, not 88"* paragraph (L116-L122); §2.1 RBAC row
  (L148); §2.2 identity table new row 89 and access notes (L173, L178-L188); §2.3 shape table row 89
  (L207); §2.4 *"Credential (89)"* (L291); §5.2 new `CAPTURE_CREDENTIAL_SET` (L511-L518); §8 offline
  list (L640) and projected counts (L648-L650); §10 self-gate (L680-L683). The operation-numbering
  conflict is resolved by **extending to op 89** (76-88 were fully occupied; no existing op is
  renumbered) — the record is in §3 below.
- **New normative text (trimmed).**
  - Op row: `| 89 | setCaptureDeviceCredential | POST | /api/v1/capture/devices/{id}/credential | Device | simulated | PERMISSION CAPTURE_CONFIG | CAPTURE_CREDENTIAL_SET / ACCESS_DENIED | RK-12, T-33, E-30, SH-03; SEC35-01; R-1; M4 |`
  - `89 needs CAPTURE_CONFIG, is idle-only (409 CAPTURE_CONFIG_LOCKED), and is write-only: the response never echoes the credential and the audit detail carries deviceId only.`
  - Audit type: `CAPTURE_CREDENTIAL_SET — category SECURITY — written by op 89 … Never the username, the secret, the ciphertext, the nonce or the key` (keys: `deviceId`, `operationId`, optional `permission`).
- **Register row it implements.** `RK-12` + `T-33` (map §6 `capture_device_credentials`) + `E-30`
  (audited refusals) + `SH-03` (vocabulary).
- **Verification hook.** Row 36 `M2-CRD-1` (credential write-only API) and `M2-AUD-1`
  (audit-type inventory) — M2-AUD-1 must now expect **9** new types, not 7. Row 36/37 addition:
  extend `M2-API-1`/`M2-API-2` to **89 ops, 34 GET / 55 POST** and the offline set to 23.

### SEC35-02 (High) — reveal function granted to the whole runtime role

- **What changed / where.** `04_database_contract.md` §B.3 reveal control (L274-L286); §D 0005 SQL
  comment + grant (L599-L605); §D privilege matrix (L618); §L self-gate (L832); §M open points
  (L840).
- **New normative text (trimmed).**
  - `GRANT EXECUTE is not a blanket capability: PUBLIC is revoked and the grant is held only by the sole runtime role; the runtime role's reach is narrowed to exactly one module, apps/core-server/src/modules/capture-config/credential-reveal.ts, enforced by a static rule in the capture-config guard (G-R4 family) — no other module may reference the function.`
  - `… every invocation writes CAPTURE_CREDENTIAL_REVEALED with deviceId and a reason code only … A 4th, narrower DB role was considered and rejected: D-DB-07 and section B forbid new DB roles, so the narrowing is application-layer + static + audited rather than a second role.`
- **Mechanism note (deviation, flagged).** The review headline says "revoke `GRANT EXECUTE` from
  `dems_app`"; a literal revoke would make the reveal unreachable and force a fourth DB role, which
  `D-DB-07` and §B forbid. The applied mechanism is the second option the task allows ("invoked only
  through the write-only API with the permission check stated") plus a single-module static rule. If
  the reviewer intended a fourth DB role, `D-DB-07` must be revisited — flagged in §4.
- **Verification hook.** Row 36 `M2-MT-4` (asserts `SELECT capture_device_credentials` fails `42501`
  for `dems_app`); the capture-config static test (G-R4 family) asserts the single calling module.
  New audit type `CAPTURE_CREDENTIAL_REVEALED` extends `M2-AUD-1` to 9 types.

### SEC35-03 (Medium) — encryption-key store for `secret_ciphertext`

- **What changed / where.** `04_database_contract.md` §B.3 *"Key store (SEC35-03)"* (L267-L273);
  cross-referenced from `05_capture_architecture_spec.md` §D.2 (L466).
- **New normative text (trimmed).** `key_ref resolves to the per-camera AES-256-GCM key in the Core credential store …, one random 256-bit key per credential, held separately from the media volume and never in the DB, a slice, a log or an audit row … Rotation writes a new key and updates key_ref + rotated_at in one UPDATE; the previous key is retained read-only until the credential is re-encrypted, then destroyed.`
- **Verification hook.** Boot checks CS-22 (key present) and the M2 migration/privilege test `M2-MT-4`.

### SEC35-04 (Medium) — credential-bearing RTSP pull URL / FFmpeg stderr

- **What changed / where.** `05_capture_architecture_spec.md` §A.6 *"Credential handling
  (SEC35-04)"* (L232); §G G-R4 blanked forms (L540). Cross-ref: `06_evidence_package_spec.md` §G.4
  (L637) and `08_client_ux_spec.md` P-07 (L591).
- **New normative text (trimmed).** `the credential-bearing pull URL (rtsp://user:pass@host) is composed outside any log/audit call; CameraAdapter.pullUrl returns the host/path form and the credential is injected only at the worker spawn point; the FFmpeg worker stderr is captured by code (parsed for the failure, never logged raw); the camera-credential form is added to G-R4 and to both log-blanking lists.`
- **Verification hook.** Row 36 `M8-BLK-1` (blanking) extended to the camera-credential form; the
  M3 capture-config static rule (G-R4).

### SEC35-06 (Medium) — signer threat model

- **What changed / where.** `06_evidence_package_spec.md` §C.3 *"Threat model (SEC35-06)"* (L445).
- **New normative text (trimmed).** `the signer defends integrity, not confidentiality: an adversary who can replace the Core key and certificate can forge a signature, so the trust anchor is out-of-band certificate distribution; at-rest package theft cannot forge a signature (only the live Core key can).`
- **Verification hook.** Documentation-level; carried into row 36 `M7` verify checks and the DOC-05/
  README wording (row 40).

### SEC35-07 (Medium) — signer key at-rest protection + compromise/revocation runbook

- **What changed / where.** `06_evidence_package_spec.md` §C.3 *"Key storage hardening (SEC35-07)"*
  (L443) and *"Compromise / revocation runbook (SEC35-07)"* (L444).
- **New normative text (trimmed).** `the signer private key is held encrypted at rest (OS keychain or an encrypted file) with restrictive mode (0600) … boot (CS-22) fails closed if the key is absent or unreadable`; runbook `(a) stop signing, (b) mark the key compromised, (c) issue a new key id + certificate, (d) re-verify every package whose signature.keyId equals the compromised key against the retained certificate, (e) record the event (fact only).`
- **Verification hook.** Row 36 `M7`/`M9` security-audit checks; CS-22 boot check.

### SEC35-08 (Medium) — session GCM key store

- **What changed / where.** `05_capture_architecture_spec.md` §D.2 *"Storage (SEC35-08)"*
  (L466).
- **New normative text (trimmed).** `the Core credential store — held separately from the media volume; never in the worker output dir, never beside the media, never in audit/log. Access is limited to the single sealing/Range module pair; the key is referenced by keyId only.`
- **Verification hook.** Row 36 `M7-TP-1` (tamper/key) and CS-22 boot check; implementation routed to
  row 37/40 as the review requires.

### SEC35-09 (Medium) — key-loss consequence

- **What changed / where.** `05_capture_architecture_spec.md` §D.2 *"Key loss (SEC35-09)"* (L470);
  `06_evidence_package_spec.md` §G.1 *"Key requirement (SEC35-09)"* (L611).
- **New normative text (trimmed).** `key lost = data unreadable: without the session key the plaintext export (V-05) and Range playback are impossible, while the stored-bytes verification (V-04/V-06) still passes. Decision recorded here: no key escrow/backup by default … Flagged for the second blueprint gate if a custody/escrow policy is wanted.`
- **Verification hook.** Verify checks V-04/V-05/V-06 (row 36 `M7-VV-SRV`).

### SEC35-10 (Medium) — GCM additional-authenticated-data

- **What changed / where.** `05_capture_architecture_spec.md` §D.1 *"GCM AAD (SEC35-10)"*
  (L454); `06_evidence_package_spec.md` §B.6 *"GCM AAD (SEC35-10)"* (L266) and §D V-02 (L464).
- **New normative text (trimmed).** `the additional-authenticated-data of each fragment's GCM message is the canonical encoding (trackId, seq, byteOffset, keyId). It is derived, not stored (the field count stays 17), and V-02/V-06 recompute it on verify.`
- **Verification hook.** Row 36 `M7-TP-1`; V-02 extended (field count stays 120).

### SEC35-11 (Medium) — `fragments.json` integrity coverage

- **What changed / where.** `06_evidence_package_spec.md` §A.1 *"`fragments.json` coverage
  (SEC35-11)"* (L118); §D V-02 (L464).
- **New normative text (trimmed).** `its files[].fragments[] array is the exact serialization of the manifest's files[].fragments[] records — one source of truth. Verify V-02 asserts that equality, so a reader using fragments.json cannot be fed altered IV/tag/keyId without breaking the signed manifest.`
- **Verification hook.** Verify V-02 (row 36 `M7-VV-SRV`); verify count stays 14.

### SEC35-12 (Medium) — media-session signing key / TTL / binding

- **What changed / where.** `03_api_contract.md` §2.4 *"Media-session signing, binding and TTL
  (SEC35-12)"* (L265-L272); §7 constants (L598-L600); `08_client_ux_spec.md` §6.4 G7 (L427).
- **New normative text (trimmed).** `the URL is HMAC-signed with a separate media-session signing key (MEDIA_SESSION_SIGNING_KEY_ID, held in the Core credential store, never the evidence Signer key …) ; the token binds to one (operatorId, sessionId, evidenceId, fileId) … its lifetime is the short constant EVIDENCE_MEDIA_SESSION_TTL_MS … the replay window is exactly that TTL.`
- **Verification hook.** Row 36 `M8-RNG-1` (Range server unit; no credential in logged URLs) and
  `M8-BLK-1`; the new constants are picked up by `M2-API-3`/contract-values (CS-25).

### SEC35-13 (Medium) — media-token prefix + insertion points

- **What changed / where.** `06_evidence_package_spec.md` §G.4 *"Blanking (SEC35-13)"* (L637) and
  §G.4 M8 check (L639); `03_api_contract.md` §2.4 *"Media-token prefix (SEC35-13)"* (L274-L280) and
  §7 constant (L599); `08_client_ux_spec.md` §6.6 Blanking (L447) and P-07 (L591).
- **New normative text (trimmed).** `the signed-URL/token prefix is pinned to EVIDENCE_MEDIA_TOKEN_PREFIX = 'mts_' … added to BOTH log-blanking lists: the web error sink (apps/core-web/src/runtime/error-sink.ts:52) and the mobile log (apps/mobile/src/runtime/log.ts:46), whose regex becomes \b(ses|dvc|bio|mts)_.`
- **Verification hook.** Row 36 `M8-BLK-1` — extend to the `mts_` prefix (addition for row 36/37).

### SEC35-14 (Medium) — oMLX API key blanking

- **What changed / where.** `07_transcript_spec.md` §B.2 *"API key handling (SEC35-14)"* (L215).
- **New normative text (trimmed).** `the key at ~/.omlx/settings.json auth.api_key is referenced by path only, never printed or logged; read at start into memory only, sent only as an Authorization header to the loopback endpoint, never persisted, audited, placed in a slice or copied into an env var … a static test asserts apps/transcriber/** reads the settings file only in the single key-loader module and never logs a header.`
  (The key value is never printed; only the file path is referenced.)
- **Verification hook.** Row 36 `apps/transcriber` static test (D.1: "never reads `~/.omlx/settings.json`
  or prints the API key") and `M1-TT-7`; `X-SEC-1` secret sweep.

### SEC35-16 (High) — REAL-evidence case scope for `EVIDENCE_VIEW` / op 88

- **What changed / where.** `03_api_contract.md` §2.1 RBAC row (L147) and §2.2 access notes
  (L186-L188); §2.4 *"REAL-evidence case scope (SEC35-16, provisional)"* (L282-L289).
- **New normative text (trimmed).** `For an item whose integrity_source='REAL', op 88 (and the EVIDENCE_VIEW reads 84/86) additionally require the caller to be the owner of that case/session (the session creator) or a SUPERVISOR; a mere EVIDENCE_VIEW holder is refused 403 NOT_PERMITTED. This narrows the pre-existing all-roles EVIDENCE_VIEW reach for REAL evidence and is not decided by OD-10/OD-15, so it is recorded as provisional and flagged needs user confirmation at the second blueprint gate … before M8 ships.`
- **Flag.** Changes a role's effective power beyond what OD-10/OD-15 decided — **needs user
  confirmation at the second blueprint gate** (see §4). Simulated/demo evidence keeps the existing
  all-roles read (P2 §8 R-12 stays true there).
- **Verification hook.** Row 36 `M8` playback checks (client 403 path); a new DB/route check is
  proposed as `M8-EV-SCOPE-1` (addition for row 36/37).

### SEC35-17 (Low) — `sendingDeviceId` required for a device actor

- **What changed / where.** `03_api_contract.md` §5.2 `AUDIO_SOURCE_SWITCHED` table (L441) and the
  paragraph after it.
- **New normative text (trimmed).** `required when the caller is a paired mobile device (B15/OD-09); optional only for a web operator session.`
- **Verification hook.** Row 36 `M2-AUD-2` (refusal/audit rules) and the shared vocabulary test
  (`contract-values.test.ts`).

### SEC35-19 (Low) — idle-lock refusal audit

- **What changed / where.** `03_api_contract.md` §2.2 access notes (L178) and §5.1/§5.2 context.
- **New normative text (trimmed).** The idle-lock refusal is stated explicitly: `409 CAPTURE_CONFIG_LOCKED`, and **no** audit row of either type is written — not `CAPTURE_CONFIG_CHANGED` and not `ACCESS_DENIED` (the existing `(no audit row on this refusal)` note is now unambiguous). This matches the one-row-per-refusal tradition (P2 SD-03) for a state refusal before any state change.
- **Verification hook.** Row 36 `M2-AUD-2` (refusal audit rules).

### SEC35-20 (Medium) — per-revision certificate retention

- **What changed / where.** `04_database_contract.md` §B.9 new column
  `signature_certificate_sha256` (L409) and the mapping note (L417-L419);
  `06_evidence_package_spec.md` §C.3 Rotation (L447) and §D V-11 (L473).
- **New normative text (trimmed).** `signature_certificate_sha256 binds each revision to the certificate that signed it; the package retains the certificate set … so an old revision verifies after rotation.` V-11: `verifies … against the revision's retained signature_certificate_sha256`.
- **Verification hook.** Verify V-11 (row 36 `M7-VV-SRV`); the column is part of the 0004 typed
  schema (M2).

### SEC35-21 (Low) — `baseRevision` mapping

- **What changed / where.** `03_api_contract.md` §2.4 *"`baseRevision` mapping (SEC35-21)"*
  (L249-L253); `04_database_contract.md` §B.9 mapping note (L414-L416).
- **New normative text (trimmed).** `baseRevision (op 85) is defined as the item's current max(revision_no) (0 when no revision exists), read and compared inside the same INSERT transaction that mints revision_no = max+1 … a mismatch is 409 TRANSCRIPT_REVISION_CONFLICT. There is no baseRevision column.`
- **Verification hook.** Row 36 transcript checks (op 85 conflict) and the M2 schema test.

### SEC35-22 (Medium) — cross-spec error-code/audit-type reconciliation

- **What changed / where.** `03_api_contract.md` §4 (L342, new rows L364-L365), §5 (L393-L394),
  §5.2 (L511-L525), §5.2 category paragraph; `04_database_contract.md` §E.2 (L656);
  `07_transcript_spec.md` §A.1 (L111).
- **New normative text (trimmed).** `9 new codes → 40` (`RESET_BLOCKED_REAL_EVIDENCE` 409 by op 75;
  `TRANSCRIPT_AUDIO_UNAVAILABLE` 409 by 84/85/86); `9 new types → 62` (`CAPTURE_CREDENTIAL_SET`,
  `CAPTURE_CREDENTIAL_REVEALED` added to the seven). `RESET_BLOCKED_REAL_EVIDENCE` is `reconciled into
  row 29's final error list`; `TRANSCRIPT_AUDIO_UNAVAILABLE` is `now in row 29's final error-code
  list`.
- **Verification hook.** Row 36 `M2-API-1` (error codes), `M2-AUD-1` (audit types) — both counts
  change (38 -> 40 codes; 60 -> 62 types); row 36/37 must update them.

### SEC35-23 (High) — RTSP ingest bind address

- **What changed / where.** `05_capture_architecture_spec.md` §A.2 failure modes (L125); §A.4
  *"Bind address (SEC35-23)"* (L165) and test hook (L184-L187); §A.8 fixtures (L300-L302).
- **New normative text (trimmed).** `the RTSP listen ingest input URL host literal MUST be 127.0.0.1; FFmpeg -rtsp_flags listen -listen 1 defaults to 0.0.0.0, so the command is built as -rtsp_flags listen -listen 1 -listen_timeout <ms> -i rtsp://127.0.0.1:<port>/<name> and never with a wildcard (0.0.0.0, ::, a LAN address or a bare rtsp://:<port>). LAN binding is class C, opened only after OD-13's preconditions (demo-password replacement, B3, TLS/origin rules).`
  Fixtures: `The fake RTSP fixture readers and the worker ingest listen only on 127.0.0.1:8554-8564.`
- **Verification hook.** New check `M3-RTSP-BIND-1` (proposed addition for row 36/37, sibling of
  `M3-WI-1`): starts the ingest and asserts with `lsof -nP -iTCP:<port>` / `netstat -an` that the
  socket is bound to `127.0.0.1` only.
- **Note.** The review also routes SP `C-N4`; `01_specs.md` is cross-reference-only and S7 is not
  S4/S5, so SP was not edited. Row 37/40 should fold "RTSP ingest is loopback" into SP `C-N4` (a
  doc-sync item, not a gate question).

### SEC35-25 (Medium) — `src/capture/**` static allowlist

- **What changed / where.** `05_capture_architecture_spec.md` §G G-R2 (L538) and G-R4 (L540);
  remediation self-gate row (L633).
- **New normative text (trimmed).** `may import node:fs/node:child_process only in the pinned allowlist apps/core-server/src/capture/supervisor.ts and apps/core-server/src/capture/ipc.ts … every other file under src/capture/** — and any path that reads a signer key, ~/.omlx/settings.json, .data/pg.* or a credential/key/env file — is denied; a test asserts no other src/capture/** file imports them.`
- **Verification hook.** Row 36 `M3-SR-1`/`M3-SR-2` (static guards).

## 3. Operation renumbering record (SEC35-01)

| Item | Before | After |
|---|---|---|
| Conflict | `D §B.3` said "operation 80"; `A §2.2` op 80 = `setPrimaryMic` | resolved |
| Free number in 76-88 | none — all 13 slots (76-88) occupied | extension to **89** (no existing op renumbered) |
| New operation | — | **89 `setCaptureDeviceCredential`** — `POST /api/v1/capture/devices/{id}/credential`, tag Device, mode `simulated`, access `PERMISSION CAPTURE_CONFIG` (SUPERVISOR + TECHNICIAN), audit success `CAPTURE_CREDENTIAL_SET` / denial `ACCESS_DENIED` |
| Registry total | 88 operations (34 GET / 54 POST) | **89 operations (34 GET / 55 POST)** |
| New operations this phase | 13 (76-88) | **14 (76-89)** |
| `offline` scope | 22 | **23** |
| Register rows implemented | — | `RK-12`, `T-33`, `E-30`, `SH-03` |
| Row-29 gate requirement | total count stated | **stated: 89** |

Row 36/37 pick-ups triggered by the count change: `M2-API-1`/`M2-API-2` (88 -> 89; `M2-API-2`'s
"88-1 live-only" becomes 89-1), `M2-AUD-1` (7 -> 9 new types; 53 -> 62), the error-code count
(38 -> 40), the `section-C` pin family "75 -> 88" -> "75 -> 89", and `M2-CRD-1` for the new op.

## 4. Needs user confirmation at the second blueprint gate

| Finding | What is provisional | Decision it touches |
|---|---|---|
| SEC35-16 | REAL-evidence case scope on op 88 / `EVIDENCE_VIEW` reads (owner-or-SUPERVISOR); narrows INVESTIGATOR/TECHNICIAN | **OD-10 / OD-15** (role power); predecessor `P2 §8 R-12` blanket-read acceptance |
| SEC35-09 | Default recorded: **no key escrow**; loss of the session key makes export/playback impossible | OD-16 export / OD-19 custody area (no gate answer explicitly covers key custody) |
| SEC35-02 | Mechanism chosen under the three-role convention (single-module static rule + audit) instead of a literal `dems_app` revoke | **D-DB-07** / §B "no new DB roles" — confirm the intended mechanism |
| SEC35-26 | Privacy/DPIA deferred (see §5) | predecessor `P2 §9` synthetic-data GDPR exemption lapses for REAL capture |

## 5. Deferred items and their rev-2 target row

| Finding | Target row | Exact spec sentence that mandates the deferred work |
|---|---|---|
| SEC35-18 | **M2 implementation** (rev-2 row 40 keeps the M2 deliverable; check `M2-API-3`) | `03_api_contract.md` §0: "The `SESSION_HOLDER` access condition is proposed, not yet in `contract-model.ts` (§0) — M2 adds it" (§10 item 4). |
| SEC35-26 | **row 40** (privacy/DPIA entry; owning spec `01_specs.md` §A/§E.4 is cross-reference-only and SEC35-26 is S8/privacy, not S4/S5) | Mandated content: "processing is under the operator's legal mandate, sealed evidence is under legal hold (no erasure), loopback/demo until Q-HW; record a DPIA entry in row 40" (review SEC35-26). |

## 6. Before/after self-gate counts for every edited file

| File | Count item | Before | After | Holds? |
|---|---|---|---|---|
| `03_api_contract.md` | operations (row-29 gate) | 88 | **89** | yes (stated) |
| | GET / POST | 34 / 54 | **34 / 55** | yes |
| | new operations | 13 (76-88) | **14 (76-89)** | yes |
| | `offline` scope | 22 | **23** | yes |
| | error codes | 31 -> 38 | **31 -> 40** | yes (count statement fixed) |
| | audit types | 53 -> 60 | **53 -> 62** | yes (count statement fixed) |
| | audit types with detail lists | 7/7 | **9/9** | yes |
| | modified operations | 24/24 | 24/24 | unchanged |
| | gate answers cited | 6/6 | 6/6 | unchanged |
| `04_database_contract.md` | tables | 30 -> 39 | 30 -> 39 | unchanged |
| | new/changed | 9/5 | 9/5 | unchanged |
| | FAULT_KIND CHECK sites | 3/3 | 3/3 | unchanged |
| | forbidden-key list | 17 | **25** | yes (statement fixed) |
| | `transcript_revisions` columns | n | **n+1** (`signature_certificate_sha256`) | yes |
| | kept-on-reset set | unchanged | unchanged | unchanged |
| `05_capture_architecture_spec.md` | NM module IDs/interface | 9/9 | 9/9 | unchanged |
| | P25 edits | 12/12 | 12/12 | unchanged |
| | hypotheses H-1..H-9 | 9 | 9 | unchanged |
| | new bind rule / check | — | +`M3-RTSP-BIND-1` | addition for row 36 |
| `06_evidence_package_spec.md` | manifest fields | 120/120 | **120/120** | unchanged (AAD derived, not stored) |
| | sealing steps | 8/8 | 8/8 | unchanged |
| | verify checks | 14 | 14 | unchanged (V-02/V-11 extended, not added) |
| | OD citations | 7/7 | 7/7 | unchanged |
| `07_transcript_spec.md` | pipeline stages | 6/6 | 6/6 | unchanged |
| | licence components | 15 | 15 | unchanged |
| `08_client_ux_spec.md` | P-01..P-16 | 16/16 | 16/16 | unchanged (pointers only) |
| | E-13..E-17 | 5/5 | 5/5 | unchanged |
| | gated controls | 10 | 10 | unchanged |

No count was broken silently: the 03 operation count (89), offline count (23), the error-code count
(40) and the audit-type count (62) were **re-stated**, and the 04 forbidden-key count was
re-stated (25). `06`'s field/step/check counts are intentionally unchanged because AAD is derived
and V-02/V-11 were extended rather than added.

## 7. Files edited (only the allowed set)

| File | Sections touched | Findings |
|---|---|---|
| `masterplan/03_api_contract.md` | §0, §1, §2.1, §2.2, §2.3, §2.4, §4, §5, §7, §8, §10, footer | 01, 12, 13, 16, 17, 19, 21, 22 |
| `masterplan/04_database_contract.md` | §B.3, §B.9, §C.6, §D, §E.2, §L, §M, footer | 02, 03, 20, 21, 22 |
| `masterplan/05_capture_architecture_spec.md` | §A.2, §A.4, §A.6, §A.8, §D.1, §D.2, §G, §J self-gate, footer | 04, 08, 09, 10, 23, 25 |
| `masterplan/06_evidence_package_spec.md` | §A.1, §B.6, §C.3, §D V-02/V-11, §G.1, §G.4, §I self-gate, footer | 06, 07, 10, 11, 13, 20 |
| `masterplan/07_transcript_spec.md` | §A.1, §B.2, §H self-gate, footer | 14, 22 |
| `masterplan/08_client_ux_spec.md` | §6.4, §6.6, §9 (P-07), footer — **one-line pointers only** | 12, 13 |

Not edited: `masterplan/01_specs.md` (cross-reference-only; SEC35-26 deferred, SEC35-23's SP `C-N4`
doc-sync left to row 37/40) and `masterplan/09_security_design_review.md` (the finding record).
No file in `decisions/`, `status_tasks.md`, `identification/`, `research/`, test files or source was
touched.

## 8. Red-line compliance

No emoji; English; tables over prose; only the allowed spec files + this report + the progress file
written; no gate answer (D4) weakened; no row-32/33/36 decision contradicted (D-EV-1 preserved — the
`TRANSCRIPT_AUDIO_UNAVAILABLE` addition is consistent with `transcript.state='PARTIAL'`); the oMLX
API key (`~/.omlx/settings.json`) and `.data/pg*` are referenced by path only and never printed; no
external service used.

---
*Generated: 2026-10-07 17:45*
*Last Updated: 2026-10-07 17:45*
