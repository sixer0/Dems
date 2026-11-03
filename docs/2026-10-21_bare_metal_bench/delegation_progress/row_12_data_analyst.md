# Row 12 (data-analyst, spec stage S1) - complete
- Output: masterplan/01_specs_register.md (install names-and-constants register).
- Check: all 8 HOST-PROFILE §2 placeholders (HOST-PROFILE:31-40) have one value, none left to the user; W1 data dir /opt/dems/core/.data (research/01_explore_core_runtime.md:33-34), W2 DB port 4432 (config.ts:132, :386-389; research/01_explore_database_commands.md:29), W4 console 127.0.0.1:5173 (research/01_explore_core_runtime.md:41, :48). Secret scan of the file: 0 hits; secret slots named only.
- Key values: dems-core / dems-netalias (group only) / audio; /opt/dems/core; /opt/dems/ffmpeg-9.0.2; enp4s0 192.168.100.254/24; dems_demo; dems_owner, dems_app; pg.env and pg.owner.env dems-core:dems-core 0600 in the data dir; core.env root:dems-core 0640; DEMS-BENCH-01 (not reserved: checks.ts:423-430); Node 26.12.1 (in range); FFmpeg 9.0.2 LGPL; PG 18 minor by row 13.
- Hypotheses for later rows: sshd port 22 (row 36), postgresql@18-main.service / postgres / /var/lib/postgresql/18/main (rows 13, 39), camera web port 80 (row 62).
- Left to rows: pg.owner.env lifetime (13), cache location W6 (14), console account + unit vs manual, DEMS_CAPTURE_HELPER_FFMPEG, ExecStart (15/122).
- For row 96: installation display name (user decides); camera-forward local ports 18101/18102/18103/18117 (proposal).
- file_requests.md: no request.
