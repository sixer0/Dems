# Row V5 - rotation audit, the receiver's marks list, export under a marked key

Status: **complete** (agent V5, 2026-10-13). Record: `implementation/v5_rotation_audit_receiver_export.md`.

| Item | Result |
|---|---|
| R-1 | done. The next boot's `SYSTEM_BOOT` entry states `signingKeysRetained`, `signingKeysCompromised`, `signingCertificatesSha256`, `signingStoreChange` (`NO_EARLIER_STATEMENT`, `NONE`, `NOT_READ`, `KEY_ROTATED`, `KEY_MARKED_COMPROMISED`, `KEY_MARK_REMOVED`, `RETAINED_SET_CHANGED`); WARNING when a change is named. A verification under a marked key is audited with `details.notice: SIGNED_BY_COMPROMISED_KEY`, never as a plain pass |
| R-2 | done. `VerifyExpectations.compromisedCertificateSha256`; `evidence:verify-export ... [--compromised <certificate sha256>]...`; verdict `RESULT: NOT A PASS - signature valid, key reported compromised by the list supplied`, exit 3. Without the input: unchanged |
| R-3 | done. A package under a marked key that is the one of record is exported; the export manifest carries `sourceSigningKey { state: MARKED_COMPROMISED, certificateSha256: [...], verifiedAs: STORED_DIGEST }`. Not of record: `SOURCE_SIGNED_BY_COMPROMISED_KEY` |

Counts: 110 operations (39 GET / 71 POST), 82 audit types, 51 actions - unchanged; no count pin moved; no schema change.

Checks: shared `105 files / 2881 passed`; Core unit `90 / 1720 passed`; Core database `8 / 148 passed`, 0 clones left; typecheck 0 in six workspaces; row-229 driver `46 held, 1 recorded as observations, 0 difference(s)`.

Red seen, not mine: `apps/core-server/src/engine/__tests__/boot-checks-runner.test.ts:81` (the core index exports `SYSTEM_BOOT_SIGNING_DETAIL_RULES` since another row).

Requests: five lines `row V5` in `file_requests.md`. Driver decisions D-1 to D-10 in the record, section 8.

Edit-only rule kept; `openapi.json` by the repository's generator, once, last.
