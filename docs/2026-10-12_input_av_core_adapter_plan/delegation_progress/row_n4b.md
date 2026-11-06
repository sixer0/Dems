# Row N4b (wave 12, track D) - the one run of design 4.3.3

- Status: **needs-review**. Part A complete; part B stopped before any open (the device runs at 96,000 Hz), as briefed.
- Record: `test/n4b_helper_rows_run.md`.
- Helper: `.data/helpers/ffmpeg`, `ffmpeg version 9.0.2`, SHA-256 `c8173e97...f4e4e1a8`.
- Method: `.cache/task4-n4b/product.ts` calls the product's builders and readers; `n4b.py` hands each array to the helper unchanged. Part A substitutes only the four input words by a generated six-channel source.

## Result

| Item | Result |
|---|---|
| SR-15 (3), the pre-check template | HOLDS: accepted, exit 0, 48,000 of 48,000 samples on standard output, the selected channel alone |
| SR-15 (2) with one section | HOLDS: accepted, exit 0, 288,000 of 288,000 |
| Two sections | 288,000 of 288,000 each; the same source index at every position |
| Stall of 3 s | the other output loses 0 (either direction); the stalled one loses one run of about 141,000 samples; `FIFO queue full` 0.40 s after the stall, `FIFO queue flushed` at the resume |
| Queue lines against N8's constants | no difference; classified by the product's reader in 12 of 12 lines |
| A word refused by the build | none |
| Form (c), reader absent | the helper waits and drops; a helper with a never-opened pipe does not end on SIGTERM (SIGKILL only) |
| Form (d), reader closes | the WHOLE helper ends, status 224; the other output does not live on |
| Listing tie on real texts | `ok` true, 1 card, 0 undecided, index 2, 6 inputs, 96,000 Hz |
| Part B on the device | NOT RUN: 0 helper starts |
| N8's fold | withdraws the stream statement on the device's real line order (`Stream mapping:` block) |

## Requests left (file_requests.md)

1. To N8: the fold and its test fixture. Blocking for N9.
2. To N9 and the controller: the three facts of forms (c), (d).
3. To the controller, for the user: the device is at 96,000 Hz; part B waits for 48,000.

## Driver decisions (for the controller to confirm)

| # | Decision |
|---|---|
| DD-1 | The stand-in input is `-re -readrate_initial_burst 0.001 -f lavfi -i aevalsrc...:n=512`: real-time pace without the default start burst, packets of 512 samples. The first five runs used the plain `-re` form and 1,024-sample packets; same counts; replaced |
| DD-2 | Beside the forms the brief and the design name, six more runs on the generated source (second pre-check, stall of either output and of a single output, absent reader with and without SIGTERM, the ordered stop) |
| DD-3 | Part B aborts unless the tie states exactly ONE card with 6 inputs and no undecided device (stricter than "the tie is undecided"): the guard against opening anything but the interface |
| DD-4 | With no stream line of today, the device's recorded lines of row MM3 were fed to the product's reader instead (no device) |

## End state

Captures and pipes: none left. `.cache/task4-n4b/`: three scripts and 17 number files. Processes: none. No product file changed; nothing committed.
