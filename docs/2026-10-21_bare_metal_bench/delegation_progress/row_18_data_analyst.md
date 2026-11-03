# Row 18 (data-analyst): install command runbook

- Status: complete
- Date: 2026-10-22 17:30
- Files created: masterplan/02_plan.md
- Coverage: rows 20-79 and 122-128 each have a section (61 `### Row` headings; 62-65 and 66-69 grouped). HIL sections with PREPARE / USER / VERIFY: 36, 41, 47, 50, 51, 54, 55, 56, 57 (name), 62-65, 66-69, 71, 125-127, 128 (search part)
- Written as after E-1..E-17: flag right after 21 (I-17), HOST-17 in 21, 41 after 25/26, 43 after 40, 124 N/A, 32 N/A, interfaceCount checks in 66-69/128, Block K inside 44/57/71 (E-12)
- Node 26.12.1: no checksum written; row 25 fetches SHASUMS256.txt + .asc + the GitHub keyring on the host, verifies the signature with gpgv, checks the signed line equals the .txt line, then `sha256sum -c`; the register §7.1 line is only a cross-check. Note: the brief says the value is not in row 8's file; research/02_collection_node.md §2 holds it "for reference only" (and register §7.1 cites it). Recorded as G-7
- `pg_dumpall --no-role-passwords` support: pre-check in row 39 (`pg_dumpall --help` grep), STOP to the controller before row 44 if absent (R18-11)
- Secret scan (SEC §7 with C-1 widened pattern) on masterplan/02_plan.md: 2 lines matched, both false positives (no value): line ~910 the DB §4.4 generator template `DEMS_PG_${k}_PASSWORD=${secret}`; line ~929 the count-only grep pattern `'^DEMS_PG_APP_PASSWORD=.'`. Same text exists in masterplan/01_specs_database.md §4.4, §7
- Ban self-check: purge/autoremove/netplan apply/NetworkManager strings only in the ban list and prose; no rm/mv/chown/chmod/tar -x/rsync --delete with a kept path
- Requests for row 19 (MINOR proposals): R18-1..R18-11 (02_plan.md §6). Notable: R18-3 spec defect in IMP R8 copy form (`tar ... .` would re-mode /opt/dems/core to the staging 0700; fix `--no-overwrite-dir` + stat); R18-4 guard links no FFmpeg library, so "guard states library version" cannot pass; R18-5 do not enable dems-core at row 43 (enable at 58); R18-7 row 128 needs the user for the search
- No host access, no code change, no git write
