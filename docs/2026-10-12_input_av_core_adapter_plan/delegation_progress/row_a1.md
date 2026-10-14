# Row A1 (wave 12) - worker baseline and kill matrix

Status: complete. Record: `test/a1_worker_baseline_and_kill_matrix.md` (Tier 2). No product or test file written; one line in `file_claims.md`.

- `make -C apps/capture-worker` rc 0 (nothing relinked); `check.sh src` / `--selftest` rc 0 / 0; `relay-check.sh src/relay` / `--selftest` rc 0 / 0.
- Baseline (unchanged from 08:31 to 10:17): worker `84c8eceb...0c9438`, relay `c375c92f...dce135`, guard `4f1e7a9c...893b67`; 17 source hashes in section 4 of the record.
- Series: run 1 159 of 160 (`m5_gap_analyser`, spacing off by 17 samples at the first switch; cause not established); re-run once of that check with its recording run: 2 of 2 -> 160 of 160. BR-09 17/17 and 21/21.
- Fixtures all green: row58 12/12 x3, row176 6/6, row175 2/2 + 14/14, row041 28/28, row042 21/21, row043 11/11, row186 23/23, row143b 14/14, row152 14/14, row153 6/6, fuzz controls 24/24, row046 db test 12/12.
- Kill matrix: 35 of 35 green, run once at 10:05 under both locks (db first), after PostgreSQL came up; 8554/8556 and 4420-4423/5173-5178 free, checked inside the locks.
- Left behind: nothing (processes, ports, databases checked). Wall time 6,431 s.
- Driver decisions: `--load-wait 60`; matrix lock order db -> heavy (runner's own command, `run.sh:37`); row 046 test added.
- For the controller: the `m5_gap_analyser` red in run 1 is relevant to the macOS microphone rows that will edit `audio.c`.
