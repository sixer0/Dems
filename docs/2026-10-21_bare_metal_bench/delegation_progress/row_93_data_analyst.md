# Row 93, data-analyst: R-FLEX host-profile and installer delta

- Status: complete
- Output: masterplan/01_specs_rflex_host_docs.md
- Verification against the row check:
  - Each HOST item amended or kept with a reason (section 3):
    - HOST-20, 21, 22 and 25: kept unchanged.
    - HOST-19, 23, 24 and 46: kept with amended wording.
  - Each affected install row is named (section 7).
  - The AC6, AC7 and AC9 text is worded (section 8).
- Key decisions and findings for the controller:
  - The HOST-23 rule and its test pin (test_host_profile_scripts.sh:234) stay unchanged: the `act` line is not touched. Proposed: one added pin, so that exactly one `ufw allow` line is printed (U-RF3).
  - Rows 66-69 and 128 check "search result names the interface". That check cannot be met, because the contract carries only `interfaceCount` (register F9 and NW-S1). It is replaced by a check on the `interfaceCount` value, which row 19 must adopt.
  - HOST-20 is also a Core start refusal (`CAPTURE_HOST_FORWARDING_ON`, host-checks.ts:113-114, 250-255). This is a reason to keep it.
- Dependencies:
  - Row 89 did not exist when this file was written. The DEP-89-1..4 defaults apply (section 9).
  - Q-R4 (row 96) is assumed to be "scan and set-IP stay bound".
- For row 96: F96-1 (accept a network-manager equivalent for HOST-19), F96-2 (digest condition for cameras off the camera port), F96-3 (hardware-acceptance docs left for later).
- File requests: none (all names come from the two registers).
