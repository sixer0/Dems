# Row 16 - data-analyst - install impact assessment

- Status: complete
- Output: research/03_analysis_impact.md (Tier 1)
- Also appended: delegation_progress/file_requests.md (4 register requests: host_baseline_dir, install_backup_dir, ufw_revert_unit, disk_free_threshold)
- Dependencies: row 89 (masterplan/01_specs_rflex_security.md) PRESENT at 16:51, used (RG-1..RG-14, RR-1..RR-5, Q89-2/3/5). Row 11 ABSENT -> <DEP:row11:HOST-29_applicability>, <DEP:row11:HOST-37_apport_file>. Also <DEP:row13:dump_command(_globals)>, <DEP:row13:db_status_invocation>, <DEP:row91:down_migration>.
- Coverage: R1 SSH lock-out (auto-revert), R2 Wi-Fi wedge, R3 W12 watchdog flag (U-RF7), R4 camera LAN, R5 clock, R6 disk, R7 kept Docker data (D7), R8 .data scope (W1), R9 REAL_PRODUCTION refusal, R10 tsx SIGTERM race (KillMode=mixed), R11 PostgreSQL, R12 D11 posture; section 6 per-stage rollback; section 7 R-A / R-B / Docker restore.
- Key findings: (1) apt purge/dpkg -P/autoremove forbidden (would reach the rc Docker packages or git/pigz); (2) .data inside the tree: copy without delete, no recursive chown, backups exclude signer/ (INSTALLER-NOTE:146); (3) a Wi-Fi loss also removes console control of a recording -> recordings attended; (4) with enp4s0 down, RG-12 is what keeps camera digests off the office router; (5) HOST-PROFILE §6 unmask/netplan apply do not fit .73 (deviation for row 78).
- For row 96: 96-R16-1 (flag right after row 21), 96-R16-2 (attended recordings), 96-R16-3 (R-A default), 96-R16-4 (Docker restore not planned).
- No host, repo or git writes. No secret values.
