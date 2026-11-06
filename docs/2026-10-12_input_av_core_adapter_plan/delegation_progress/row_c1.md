# Row C1 (wave 12, agent C1) - hardware chapters, host profile, collectors

Status: complete (2026-10-14 09:20). Record: `implementation/c1_hw_chapters_and_collectors.md`.

Nothing was run on a host. Edit tool only for existing files; the two records are new files. No commit, no stage.

## Files changed (24)

- `scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md`, `-2-HOST-HELPER-AUDIO.md`, `-3-NETWORK-CAMERAS-SESSION.md`, `-4-HELPER-INSTALLATION.md` (each with a note "Revision 4 (2026-10-14)")
- `scripts/host/HOST-PROFILE-UBUNTU-24.04.md` (56 items as before; new section 3.11)
- `scripts/hardware-acceptance/collect-h05.sh`, `-h06`, `-h08`, `-h09`, `-h10`, `-h11`, `-h12`, `-h14`, `-h15`, `-h16`, `-h17`, `-h19`, `-h21`, `-h22`, `-h23`, `-h25`, `-h26`
- `scripts/hardware-acceptance/test_hw_collectors_host.sh`, `test_hw_collectors_camera.sh` (planted lines and expectations in the product's shapes; the number of checks unchanged)

## Groups

- Chapters, items 1 to 7: done.
- Host profile: done.
- Collectors: done; every searched name exists in the source, every removed name is named in the script's comment.

## Result lines

- Helper: SHA-256 `1e758a2407f862ebfc461768f11c491ff43f3e89fcbf9d9a2da45763c7d015b1`; `SHA256SUMS` 3 of 3 `OK`.
- `test_hw_collectors_host.sh`: `RESULT: 637 passed, 0 failed`.
- `test_hw_collectors_camera.sh`: `RESULT: 535 passed, 0 failed` (twice; the second after a last chapter sentence).
- `scripts/host/test_host_profile_scripts.sh`: `RESULT: 171 passed, 0 failed`.
- `packages/shared` `test/api-installation-acceptance.test.ts`: 21 passed.

## Marks

"to confirm" in the four chapters: 43; 39 name a check or step of the host run, 4 name blueprint rows 104 and 106 (the removal timer).

## For the controller

- Driver decisions 1 to 6: record, section 8 (the first: `9A/H-15` re-issued as a stated limit, because the scan as built always states `NOT_KNOWN`).
- Sources against decisions or records: record, section 7 (eight rows).
- Not mine, still open: `implementation/104_alias_helper.md:34` prints the old helper hash (C101, C-3 names it); the installer's note (agent C2) should say that `DEMS_CAPTURE_ALIAS_SOCKET` is set once the helper is installed.
- Requests written to `file_requests.md`: none.
