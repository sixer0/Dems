# Row 226c (driver) - complete

- (1) BOUND TO THE BOOT'S KEY - done. `capture/boot/index.ts`: the control's door `judgedSigningKey()` (the key id of the boot step's one load, set after the checks passed). `capture/signer/host-key.ts`: `signerHeldToBoot` (`ACTIVE_KEY_CHANGED` when the signer is not of the boot's key, when taken and before each signature). `sealing-host/index.ts`: `signingNow` hands the kept signer out only through the hold; transcript revisions take the same signer (`provideRevisionSigner`). Bound in REAL_PRODUCTION and REAL_DEVELOPMENT (check 4 loads the store in both); SIMULATED unchanged (host not mounted, the route loads per request).
- (2) VALIDITY AT SIGNING - done. The hold asks the certificate's validity on `app.clock` and refuses `CERTIFICATE_NOT_VALID_NOW` - the signer's existing code and the boot's reason. No shared member, no request needed.
- (3) THE EXPORT'S REASON - done within the existing contracts. `evidence-export/host.ts`: `exportSignerWithRefusal`, `reportExportSignerRefusal`: the job's code is unchanged; the signer's code is in the Core's log and persistent error log (source `evidence-export.signer`, `signerReason`). The job body and the audit row have no member for it: one request line.
- Existing tests edited: none. Extended: `sign-time-guard.test.ts` (+6), `export.test.ts` (+5), `export-trust-list.db.test.ts` (+1), `sealing-host.test.ts` (+1).
- Checks: unit `96 files, 1655 passed` (+ sealing-host `26 passed`); database `2 passed` (extended file, third run - two failures of my own new case) and `17 files, 245 passed`; typecheck exit 0; `boot/checks.ts` blob 3dfea759 unchanged.
- Row-229 driver re-run: `RESULT: every expectation of the session held (46 held, 1 recorded as observations, 0 difference(s) from the design)`. Expectations changed for 2c, 2d, 5c, 8a only; 5c also takes the kept signer through the product's hold (said in the record).
- Driver decisions D-1 to D-5 in the record (REAL_DEVELOPMENT bound; revisions through the one held signer; the refusal names the boot's key; `SIGNER_UNAVAILABLE` in the lazy order; the hold at the taker, not in `loadSealingSigner`).
- Requests: two lines in `file_requests.md`, not blocking.
- Not run: full suites; the worker e2e files (ports a driver may not bind).
- Record: `implementation/226c_sign_time_guard.md`. Edit tool only for existing files; nothing committed.
