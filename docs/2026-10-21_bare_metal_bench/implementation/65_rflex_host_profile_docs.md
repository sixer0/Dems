---
task_id: 2026-10-21_bare_metal_bench
row: 113 (R2.1)
agent: coder-execution
date: 2026-10-22
status: complete
narrative_tier: 3
spec: masterplan/01_specs_rflex_host_docs.md §4, §6; masterplan/01_specs_rflex.md §5.5; decisions D16 (Q96-08 a+b, Q96-11 a)
---

# Row 113: R-FLEX host-document edits

## Changes (text only)

`scripts/host/HOST-PROFILE-UBUNTU-24.04.md` (new line numbers)

| Edit | Line | Change |
|---|---|---|
| E-P1 | 9 (after old :7) | Revision paragraph of 2026-10-22 (R-FLEX; D10, D11, D12); "items are HOST-01 to HOST-56 as before" |
| E-P2 | 40 (old :38) | `<camera-interface>` meaning |
| E-P3 | 80 (after old :76) | Posture paragraph; D11 posture sentence ("the user accepted that risk (D11)"); kept-guard list per 01_specs_rflex.md §5.5 = RG-1..RG-7 (literal, private, special classes, host-own, edges, port list, size/spacing); `[DEP-89-n]` markers resolved, not printed |
| E-P4 + E-P4b | 85 (old :81) | HOST-19 item cell (host hygiene); command cell gains the network-manager equivalent (Q96-11 a) |
| E-P7, E-P7b, E-P7c | 89 (old :85) | HOST-23 item, check ("no other rule names port 3702"), confirm (9A/H-12 typed address) |
| E-P8, E-P8b | 90 (old :86) | HOST-24 item and confirm cells (room network) |
| E-P10 | 136 (old :132) | HOST-46 first sentence (Q-R4 = bound, Q96-04 a) |
| E-P11 | 165 (old :161) | ping bullet last sentence |
| E-P12 | 280 (old :276) | open point 8 |
| E-P13 | 297 (old :293) | digest line + Q96-08 operating rule: (a) cameras stay on the static camera port, room network/Wi-Fi only for tests, the limit stated; (b) a camera reached outside the camera port has a static address or DHCP reservation. (c) identity check stated only as "not part of this profile; a follow-up outside this revision" (no rule) |
| E-P5, E-P6, E-P9, E-P14 | - | unchanged as specified |

`scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md`: N1 :235, N3 :246, N4 :258, N5 :259, N6 new bullet :295 (end of section 6). N2 :240 unchanged.

## Verification (commands and output)

- `git diff --stat` on the two files: `HOST-PROFILE-UBUNTU-24.04.md | 20 ++++++++++++--------`, `INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md | 9 +++++----`, `2 files changed, 17 insertions(+), 12 deletions(-)`.
- Hunks (`git diff -U0 | grep '^@@'`), profile: `-8,0 +9,2`, `-38 +40`, `-77,0 +80,2`, `-81 +85`, `-85,2 +89,2`, `-132 +136`, `-161 +165`, `-276 +280`, `-293 +297` = exactly delta lines 7(after), 38, 76(after), 81, 85, 86, 132, 161, 276, 293. Note: `-8,0`/`-77,0` are the blank-line + paragraph insertions after :7 and :76. Installer note: `-235 +235`, `-246 +246`, `-258,2 +258,2`, `-294,0 +295` = N1, N3, N4, N5, N6.
- HOST item count: `grep -c '^| HOST-'` = 56; unique ids `HOST-01`..`HOST-56`, 56 (unchanged).
- Q96-08: `grep -c 'stay on the static camera port'` = 1; `grep -c 'static address or a DHCP reservation'` = 1; `grep -c 'only for tests'` = 1; (c) appears only as "a follow-up outside this revision" (:297). `grep -c 'DEP-89\|Q-R4'` = 0.
- `bash scripts/host/test_host_profile_scripts.sh` (read-only, with row 114's parallel edits to 40-network-firewall.sh and the test present): `RESULT: 172 passed, 0 failed`; shellcheck `SKIPPED` (not installed, D17).

## Deviations

- None from the spec text. E-P1 `<date of row 113>` filled as 2026-10-22. E-P3 guard list worded per the reconciled 01_specs_rflex.md §5.5 (adds "special address classes" and "subnet edge addresses" to the 93 default). E-P13 Q96-08 sentences added per D16.
