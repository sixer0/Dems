# Row 41 (HIL per OI-4, option B): roles and pg.env by Block R

Date: 2026-10-22, host .73 (D30). The user types nothing under OI-4 option B (D8); no value was shown.
- Dry check: `function`. Block R: `block_r_done`.
- Verify: `dems_app|f|f|f|f|f|t|f`, `dems_owner|f|t|f|f|f|t|t`; pg.env `dems-core dems-core 600`; key names DEMS_PG_HOST, DEMS_PG_PORT, DEMS_PG_DATABASE, DEMS_PG_APP_ROLE, DEMS_PG_APP_PASSWORD; `1`; `owner_file_absent` (C-19); `ALTER ROLE` lines in the server log `0`. All as expected.
