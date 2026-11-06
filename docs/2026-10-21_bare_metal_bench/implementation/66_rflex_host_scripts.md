# Row 114 (R2.1): firewall script wording S1-S4 and U-RF3 count pin

Status: complete. Spec: masterplan/01_specs_rflex_host_docs.md section 5 and 5.1.

## Changes
- scripts/host/40-network-firewall.sh: S1 two header comment lines after the UNPROVEN line (now :9-10); S2 HOST-19 title; S3 HOST-23 title; S3b `note` block (before the unchanged `act ufw allow`); S3d check line `no other rule names port 3702`; S3e confirm text; S4 HOST-24 title. S3c: `act` line unchanged. S5 untouched.
- scripts/host/test_host_profile_scripts.sh: U-RF3 pin added directly after the `would-run: ufw allow in on enp3s0 ...` expect (original :233-234): exactly one `would-run: ufw allow` line in values.txt.
- No `act`, `put_file`, `show_file`, `hp_need` line changed (git diff -U0 shows only item titles, comments, a note block, a check line, a confirm line, and the 2-line pin).

## Verification
- `bash -n` on both files: OK.
- `bash scripts/host/test_host_profile_scripts.sh`: run 1 exit 1, 171 passed / 1 failed ("files changed under scripts/host/", the run's own checksum manifest) because row 113 was writing the .md files in scripts/host in parallel. Nothing was fixed; run 2 exit 0, 172 passed / 0 failed. The pin printed `ok  one firewall rule is printed, the search-answer rule on the camera port (U-RF3)`.
- shellcheck not run (not installed; not installed per instruction). The test's own section 8 reports SKIPPED likewise.
