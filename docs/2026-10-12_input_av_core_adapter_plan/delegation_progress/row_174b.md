# Row 174b - status: needs-review (agent 174b, wave 12, 2026-10-14)

- Task: C127 caution C-4 - the locator query rule refuses a parameter name by substring class.
- Rule as built (`apps/core-server/src/capture/adapters/credential.ts`, `credentialLikeName`): case-folded name refused if it contains `pass pwd token key secret auth user login session`, or is `pw usr account`; exception `sessiontimeout` admitted with 1-6 digits only. Other bounds unchanged.
- Collisions: 1 with a camera form the product uses (`sessiontimeout`, resolved by the exception); 0 with recorded real-camera answers (none recorded - `9A/H-10`); row 174's synthetic control `onvif-session.test.ts:1049` flips by design.
- Tests: 6 cases appended to `credential.test.ts`; 5 mutants each RED.
- Checks: credential 18/18; six locator files 195 passed, 1 failed (the by-design case); static 107 passed, 3 failed (N9's `usb-audio-macos.ts`); tsc 16 errors, 0 in this row's files; oxlint exit 0.
- Request: `file_requests.md` row 174b - `onvif-session.test.ts:1048-1049` replacement (blocking yes for a green suite).
- C129: request applied by this row (`onvif-session.test.ts:1048-1049` + one refused case); six locator files `Tests 196 passed (196)`. Status now complete.
- Record: `implementation/174b_locator_name_class.md`. Edit tool only on existing files; nothing committed; nothing running.
