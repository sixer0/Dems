# Row 58: first REAL_PRODUCTION boot; stop test; enable

Block P: ntp yes, flag root:root 644, Wi-Fi faults 0, root 8%. Start 2026-10-23 09:02:28.
`active`; REAL_PRODUCTION lines `6`; CAPTURE_HOST_ALIAS_HELPER_ABSENT `1` (warning, expected); codes: CAPTURE_BOOT_CHECKS_PASSED, CAPTURE_COMPOSITION_DONE, CAPTURE_CONFIG_LOADED, CAPTURE_FENCE_PASSED, CAPTURE_HOST_ALIAS_HELPER_ABSENT, CAPTURE_HOST_CHECKS_PASSED, CAPTURE_NETWORK_CONFIG_LOADED, CAPTURE_PRODUCTION_REGISTRY_BUILT, CAPTURE_PROGRAM_CHECKS_PASSED, CAPTURE_SUPERVISOR_BOOTED, HOST_ALIAS_BOOT_SWEEP, TRANSCRIBER_RESOLVED (one each; no refusal code); `/tmp/tsx-*` dems-core; DEMS listeners 127.0.0.1:4420/4432/5173 only; SYSTEM_BOOT addressHelperSocket `NOT_PRESENT`.
Idle stop test (R10): 'shutdown complete' `1`, forced exit `0` -> form A kept. `systemctl enable --now`: `enabled`, `active`; health 200. Block E: docker_du_equal, backup_ok.
This is the first REAL_PRODUCTION start of the product on a host.
