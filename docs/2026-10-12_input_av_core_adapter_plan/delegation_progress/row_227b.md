# Row 227b - the export's trust list after a rotation

Status: **needs-review** on one point (a package under a key marked compromised); everything else complete.
Record: `implementation/227b_export_trust_list.md`.

- Built: `evidence-export/host.ts` - `exportTrustedCertificates` (= `sealingVerifyTrust(...).trusted`) and the wiring line; the active certificate alone is no longer the list.
- Tests: `export.test.ts` extended (4 cases, no existing case edited); NEW `export-trust-list.db.test.ts` (1 case).
- Checks: unit `Tests 26 passed (26)` (run 2; run 1 failed on my own new expectation); static files + export unit suites `Tests 400 passed (400)`; database new `Tests 1 passed (1)`; existing export database suites unedited `Tests 2 passed (2)`; `tsc --noEmit` exit 0.
- Static rule `capture/adapters/__tests__/static.test.ts` was red on my first version (import of the adapter layer); fixed in `host.ts`, list not edited; green in the 400.
- Compromised key: its package is NOT exported (`SOURCE_VERIFY_FAILED`); stating the mark in an export waits for contract step V4.
- Expectations of existing tests changed: none.
- Requests: three lines in `file_requests.md` beginning `row 227b`.
- Driver decisions: four, listed in the record.
- Edit tool only on existing files: kept.
