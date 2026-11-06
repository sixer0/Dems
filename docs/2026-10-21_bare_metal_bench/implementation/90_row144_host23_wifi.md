# Row 144 (new, controller): HOST-23 admits camera-search answers on the Wi-Fi port too (D33 M-6)

Date: 2026-10-22, host .73. Source: decision D33 (user at G-RF: "Buka HOST-23 ke Wi-Fi"), security finding M-6 (`verification/06_rflex_security.md` section 5). Replaces D12 U-RF3.

## Change
- `scripts/host/host-profile-lib.sh`: new placeholder `<search-interface>` / option `--search-interface IF` (checked by `hp_check_interface`, the same check as `--camera-interface`), usage line, `hp_need search-interface`, substitution.
- `scripts/host/40-network-firewall.sh`: HOST-23 prints two rules - `ufw allow in on <camera-interface> proto udp from any port 3702` and `ufw allow in on <search-interface> proto udp from any port 3702 comment 'DEMS camera search answers (Wi-Fi, D33)'`; the check lists both; `--apply` needs `--search-interface`.
- `scripts/host/test_host_profile_scripts.sh`: 3 refusal cases for `--search-interface` (`'wlan0;reboot'`, `lo`, no value); the values run passes `--search-interface wlp3s0`; the U-RF3 pin "one rule" became "two rules" plus a check of the Wi-Fi rule line.
- `scripts/host/HOST-PROFILE-UBUNTU-24.04.md`: revision note, posture paragraph, HOST-23 row (command and check), open point 8, removal text.
- `scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md`: step 10 (Wi-Fi cameras listed by the search; static address or DHCP reservation first - this also closes security L-4) and the "to confirm" line.
- Runbook `masterplan/02_plan.md`: row 36 R3 (second rule), R4 and R8 expectations (`2`, `1`, `1`), the check after row 69 and row 72.

## Evidence
- Before the test update the old pin failed as it should: `NOT OK one firewall rule is printed, the search-answer rule on the camera port (U-RF3)` (`RESULT: 143 passed, 1 failed`).
- After: `bash scripts/host/test_host_profile_scripts.sh` -> `RESULT: 145 passed, 0 failed` (shellcheck section skipped: not installed).
- `bash scripts/host/40-network-firewall.sh --camera-interface enp4s0 --search-interface wlp3s0 --service-user dems-core` prints `would-run: ufw allow in on enp4s0 proto udp from any port 3702 ...` and `would-run: ufw allow in on wlp3s0 proto udp from any port 3702 ...`.

## Risk (accepted by the user, D33)
The Core's WS-Discovery answer reader is reachable from the office Wi-Fi network (it was reachable only from the camera port under U-RF3). The Core's parser guards (datagram bound, hostile-answer drop, 256-datagram close; ws-discovery tests M4-SEC-DISC-1) are unchanged. Adoption policy is unchanged: production cameras stay on the camera port (Q96-08; row 69 STOP).
