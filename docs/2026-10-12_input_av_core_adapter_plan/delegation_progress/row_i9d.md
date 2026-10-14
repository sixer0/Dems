# Row I-9d (wave 12, integration pass) - status: complete, item 6 stopped

Record: `implementation/i9d_integration_pass.md`.

- Items 1, 2, 3, 4, 5, 7 done; item 6 (HA files import of `CAPTURE_INTERFACE_NAME_PATTERN`) stopped and reverted: refused by the import pins `capture/host-alias/__tests__/caller.test.ts:474-476` and `lifecycle.test.ts:1033-1035` (both lists must gain `'@dems/shared/api'` in the same step as the import).
- Files changed (Edit only): capture/__tests__/static.test.ts, config.ts, capture/adapters/audio/__tests__/usb-audio-production.test.ts, core/audit-details.ts, core/__tests__/writers.test.ts, capture/adapters/__tests__/static.test.ts; caller.ts and facts.ts touched and restored.
- Results: capture static 80/80, adapters static 35/35, capture-config static 17/17, writers 157/157, usb-audio-production 45/45, caller 22/22, lifecycle 99/99, capture-composition 76 + 1 skipped, onvif-network 33/33 (outside the sandbox; EPERM inside it).
- Typecheck: 9 known errors in mic-transport.ts, fault-lifecycle / forwarder-advisories / forwarder-engine / development-session.db tests, test/support/capture.ts; none mine. Lint: no finding in my files.
- No driver decisions. No new request lines.
