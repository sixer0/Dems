# Driver rules, research wave 1 (rows 1-10)
- Read-only work. Write ONLY your own output file(s) named in your brief plus delegation_progress/<row_N>_<agent>.md. Never touch status_tasks.md or delegation_progress_report.md.
- Repo root /Users/gsp-budi/Documents/DEMS. Prefer graft (`graft ask "<q>" --source`, `graft grep`, `graft skeleton`) before grep.
- Host access (rows 6, 7 only): ssh -i ~/.ssh/id_ed25519_smartwms -o IdentitiesOnly=yes -o BatchMode=yes gsp-dems@192.168.0.73 ; LAN calls need the Bash sandbox disabled. READ-ONLY: no apt, no writes, no service start/stop, no sudo that changes anything (sudo -n for reads such as ufw status / iptables -S is fine).
- Never copy a secret value (passwords, keys, tokens). docs/2026-10-21_bench_deploy_findings/ holds plaintext passwords: cite by section only.
- Do not touch PC 192.168.0.72. Do not restart NetworkManager.
- Every claim carries its source: file:line, URL, or command + output (CLAUDE.md §8, Tier 2).
- Report back short: status, files, key answers, unknowns.

## Addendum 2026-10-22 (wave 1 launched on the user's word, D9)
- Host facts that changed since the blueprint (read, cite, do not re-derive): 02_host_wifi_outage_20261022.md (Wi-Fi outage root cause; F1-F3 applied: NM powersave off drop-in, /etc/modprobe.d/rtw88-dems.conf, dems-wifi-watchdog.timer) and 03_deployment_check_20261022.md (Docker leftovers, iptables now 0 rules after reboot, USB mic BOMGE on card 1 port 1-1 without serial, ALC897 now card 2, missing prerequisites list). Row 6 records these files as present host state; it does not touch them.
- The watchdog may reboot the host only after 15 min without the gateway and never within 1 h of boot. A dropped SSH call is not a reason to retry in a loop: retry once after 60 s, then report blocked.
- Each driver writes ONLY: its expected output file under research/ plus delegation_progress/row_<N>_<agent>.md. No claims file needed (no two rows share a path).
- Model: sonnet for every row 1-10 (Execution Profile).

## R-FLEX wave W-a (rows 80, 82-86), 2026-10-22, D12
- Read-only on code. Rows 82-86 write ONLY their research file + delegation_progress/row_<N>_<agent>.md. Row 80 additionally writes the snapshot folder under /Users/gsp-budi/Documents/DEMS/.data/ (git-ignored) and implementation/48_rflex_restore_point.md.
- Row 80 must not change git state: no add, commit, stash, checkout, reset, branch. `git status --porcelain` before == after (print both hashes).
- The RQ questions are defined in identification/02_structured.md lines 95-111 (RQ-A1..A6, RQ-N1..N6). Answer the ones your row owns with file:line or "unknown"; do NOT design the answer (specs come in rows 87-95), but list options the code makes possible.
- Rulings that frame the research: decisions.md D10, D11, D12.
- No host access in this wave.

## Spec waves (rows 81, 87-96, 11-16), 2026-10-22, user: "Lanjut: W-b (81 N/A + 87), W-c (88-94) dan baris 11-16 paralel sesuai blueprint, sampai lembar keputusan baris 96."
- Docs only. Each row writes ONLY its Expected Output + delegation_progress/row_<N>_<agent>.md. No code, no host, no git writes.
- Staging by C edges (contract must exist before use): S1 = 81 (N/A), 87, 12, 15. S2 (after 87) = 88, 89, 90, 91, 92, 93, 94. S3 = 11 (after 93), 13 (after 12, 91), 14 (after 12, 89); S4 = 16 (after 11, 12, 89). Then 95, then 96.
- Names: R-FLEX names come ONLY from masterplan/01_specs_rflex_register.md (row 87); install names ONLY from masterplan/01_specs_register.md (row 12). A name you need that is missing: write it as a request line in delegation_progress/file_requests.md (`row N | register | name | why`) and continue with a placeholder `<REQ:name>`.
- Inputs to read: research/01_explore_*.md, research/02_collection_*.md, research/01_explore_rflex_*.md, the last two rows of delegation_progress_report.md (carried findings), decisions.md D8-D12, 02_host_wifi_outage_20261022.md, 03_deployment_check_20261022.md.
- Fixed rulings (do not reopen): D10 (USB no port lock + exclusive binding + release on re-bind; ONVIF global; code first), D11 risk accepted, D12 (U-RF1..U-RF10 recommendations, U-RF3 HOST-23 camera port only, AC7 unchanged, U-RF6 no overlap, U-RF8 Node 26.12.1 if in engine range >=26.8.2 <27, U-RF9 LGPL, U-RF10 PG minor decided by row 13).
- Open questions you cannot decide go to a "For row 96" list at the end of your file, each with options and a recommendation.
- No secret values. Report back short.

## D13 widening (2026-10-22): rows 11, 13, 14, 16 run beside 88-94
- If a spec you depend on (89 security, 91 R-FLEX DB, 93 host docs, 11 applicability for row 16) already exists in masterplan/ or research/ when you reach the item, use it. If not, write `<DEP:rowNN:item>` with your default and continue; list all placeholders at the end under "Placeholders for row 95". Do not wait or poll.
