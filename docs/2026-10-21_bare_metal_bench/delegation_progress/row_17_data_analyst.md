# Row 17 (data-analyst): install reconciliation

- Status: complete
- Date: 2026-10-22 17:45
- Files created: masterplan/01_specs.md
- Files updated: masterplan/01_specs_register.md (line 63 corrected per D16 I-01; section 11 added, additive)
- Placeholders: 25 distinct `<DEP:...>`/`<REQ:...>` strings (86 mentions) in rows 11, 13, 14, 15, 16 resolved (01_specs.md section 2); 0 open. Key values: 34 migrations / schema 15 / dbc-16; no down migration; dump via socket (`sudo -u postgres pg_dump -p 4432 -Fc dems_demo`), globals with `--no-role-passwords`; cli_cache_dir N/A (I-03)
- Register: 8 requested names added + tree_staging_dir, ffmpeg_build_dir, host_build_unit, VITE_DEMS_CORE_MODE; each defined once (grep `^| \`name\`` = 1 in install register, 0 in R-FLEX register)
- Name conflicts: 0 with the install register, 0 with the R-FLEX register (01_specs.md section 8.2)
- AC1-AC9: each mapped to spec items and rows (01_specs.md section 5); AC9 = SPEC-RF section 7 text (D16 Q96-17 a)
- Cross-delta corrections for the controller to record: C-1 (SET lines before ALTER ROLE; scan pattern widened to `[A-Za-z0-9_-]{43}`), C-3 (row-16 baseline block fails as written: `$B/ufw` file/dir collision; use `cp -a --parents`), C-4/C-5 (dump forms)
- Row 19 requests: E-1..E-17 (01_specs.md section 6), all proposed MINOR
- Secret scan (row 14 section 7 patterns, 43-char class widened) on both files: no file listed (grep exit 1)
- No host access, no code change, no git write
