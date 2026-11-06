# Row 38: sleep and time (HOST-29 re-check, -31, -32)

Date: 2026-10-22, host .73 (D30). Output: `4 masked` (no change); NTPSynchronized `yes`; `systemd-time-wait-sync.service` enabled (symlink in sysinit.target.wants); `TimeoutStartUSec=infinity` recorded (IMP R5: with no NTP source at boot, units ordered after time-sync.target wait). Rollback: `sudo systemctl disable systemd-time-wait-sync.service`.
