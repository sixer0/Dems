---
row: 87b
wave: 12
track: D (documents only)
date: 2026-10-14
agent: document-writer
source: verification/086_pre_lift_security.md caution C-7 (:82), answer (6) (:123-136), section 6 items 1 and 5 (:203, :207); decisions/decisions.md C127 (:170)
status: complete
---

# Row 87b - re-issue of the lift texts after review 086

## Files
- Changed (Edit only): `decisions/087_lift_texts.md` (header marked "re-issued by row 87b, 2026-10-14, after review 086"; change list in its new section 9, 19 lines).
- Written: this file.
- Not touched: `decisions/decisions.md` (AM-1 NOT recorded; the controller records it), any product file, the task-3 folder.

## Items of the brief
| Item | Applied at (section of 087) | Source |
|---|---|---|
| (a) U24 replaces U18 | AM-1 (5); P-10; section 2.3; A-1 | U24 `decisions.md:141`; 086 answer (6) |
| (b) row P1 / C97 replaces (6) | AM-1 (6); H.5 "does not 2" | C97 `:135`; U21 (2) `:123` |
| (c) 128 bits | AM-1 (3)(f); H.5 "does 3"; gaps | `ingest-address.ts:37`; 086 `:58` (row 179's record states no size) |
| (d) `darwin` `USB_AUDIO` sentence | AM-1 (3)(h) | 086 section 6 item 5; C127; C110 (M2b gates); C92 |
| (e) C-5 known limit + hardening row before M6 | AM-1 (6); H.5 "does not 3" (now CONFIRMED) | 086 C-5 `:80`, `:128`, `:222` |
| (f) rest of answer (6) | P-8 closed (79b); E-A2 `:110`; text 4 to `0031`; X-5 confirmed (C92/U22); F-2 sharpened in AM-1 (5), 2.3, section 5, F-2; F-3 Linux closed | 086 `:127-136` |

Also: "state at the re-issue" notes on P-1, P-2, P-3, P-4, P-6 (boxes left for row 88 to tick).

## Not reconciled (put to the controller)
- **X-9**: blueprint `:1101` / exit condition 6 (stage 1 withdraws no limit) and H.5 `06:1139` ("cannot occur") vs F-2 sharpened (086 `:135`): the user's own recordings on this Mac will state `developmentSources = false`, so `M7-SEC-SRC-2` must be rescoped. Whether rescoping counts as withdrawing a limit is gate 92's / the controller's call.
- **X-10**: "P1 / C97" in 086 names work row P1 (C97); decision row P1 (`decisions.md:5`) is unrelated. Read as row P1.

## Verification
- Every AM-1 and X-table row keeps its column count (pipe count checked by `awk`: AM-1 row 6 separators, X-1..X-10 6 each).
- Cited code lines re-read: `relay-start.ts:110` (the one `credentialAtInjection` call), `ingest-address.ts:37`; migrations list ends at `0031`.
- Nothing was run, built or connected.
