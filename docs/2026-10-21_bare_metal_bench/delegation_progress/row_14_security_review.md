# Row 14 - security-review - install security delta

- Status: complete (assessment CAUTION: 7 hypotheses settled by host rows, spec §9)
- Output: masterplan/01_specs_security.md
- Also appended: delegation_progress/file_requests.md (1 line: ufw_revert_unit)

## Verification criteria (02_structured.md row 14)
- Each secret has a who-types / where-stored / never-printed line: spec §1, S1-S9 (operator passwords OI-1, console forward OI-2, DB role secrets OI-4, camera passwords, production key, Docker backup secrets, old plaintext findings by section only, Wi-Fi PSK, sudo).
- ufw rules in order with auto-revert: spec §2.2 R0-R8 (SSH on wlp3s0 first, defaults deny incoming/routed, HOST-23 on enp4s0 only, systemd-run revert armed before `ufw --force enable`, disarmed only after a fresh non-multiplexed SSH login).
- HOST-23 scope cites row 89: masterplan/01_specs_rflex_security.md §6 was present when written; no DEP placeholder.

## Decisions / findings for the controller
- W4 premise corrected: Vite 8.3.1 does check the Host header by default but accepts any IP literal and localhost (node_modules/vite/dist/node/chunks/node.js:16832-16846, :24877, :24982). Ruling unchanged: loopback-only, separate account.
- F8: npm ci as root with --ignore-scripts, five workspaces, throw-away cache (Docker precedent Dockerfile:177-180). Options B-D rejected (gsp-dems has NOPASSWD sudo, so it is not lower privilege).
- W6/F-S1: security concurs with service spec: home /nonexistent, direct-tsx CLI form; no npm cache dir needed.
- New finding: a newer copy of the HANDOFF file with plaintext passwords sits on the host Desktop; docs/2026-10-21_bench_deploy_findings/ is mode 0755. Row 96 item R14-3.
- DB secret rule: fixed 43-char alnum form so the doc scan can detect a leak; psql session sets log_min_error_statement panic before ALTER ROLE.
- For row 96: R14-1..R14-5.

## Secret scan of the output (spec §7 patterns, -c per pattern)
- private key 0; secret-named key with value 1 (line 45: false positive, the check command `grep -c '^DEMS_PG_APP_PASSWORD=.'`, no value); URL with credentials 0; 43-char run 0; psk 0.
- No secret value read: findings folder grepped for keywords with line numbers only.
