---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: data-analyst
step: controller row 20c
type: mechanical text patch (tier 3 evidence file)
status: complete
date: 2026-10-04
last_updated: 2026-10-04 06:18
---

# Step 20c: work-row citations and shell-variable name aligned with plan rev 2.1

Scope: two files patched in place, nothing else touched. Reference (read-only): `masterplan/02_plan.md` rev 2.1, section 21 (lines 1620-1676) and section 3.4 (line 333, line 342).

Files patched:
- `masterplan/01_specs.md` (rev 2.1 to 2.2)
- `masterplan/04_client_integration_spec.md` (rev 2.1 to 2.2)

Method: grep before; one Python run of exact-string replacements that print expected versus actual count per pattern; grep after; line-level diff against a backup of the originals (kept outside the repo in `$TMPDIR/bak20c`, `/tmp/claude-501/bak20c`). Line numbers in "before" are the original numbers; in "after" they are +1 below the inserted revision row (the new row is line 63 in 01_specs and line 47 in 04).

Evidence that the plan agrees (read before editing): plan section 21 line 1630 maps row 25 to "W03 (manifest), W08" and says W09 is not listed; line 1661 maps row 79 to "W15 (the AVD probe ...), W56"; the union of the rows named by SU-2 (23 = W03, W07; 25 = W03, W08; 57 = W03, W14; 77 = W13) is W03, W07, W08, W13, W14.

## 1. Counts per pattern

| # | File | Pattern (old form) | Plan owner's count | Actual occurrences | Actual lines | Result |
|--:|---|---|--:|--:|--:|---|
| A1 | 01_specs | `W03, W08, W09` to `W03, W08` | 4 | 4 | 4 | MATCH |
| A2 | 01_specs | `W07 to W09` (applied as the full list `W03, W07 to W09, W13, W14` to `W03, W07, W08, W13, W14`) | 2 | 2 | 2 | MATCH (see decision D-2) |
| B3a | 04 | `79 (W56)` to `79 (W15, W56)` | 16 | **18** | 16 | DIFFERS: the plan owner counted lines; lines 173 and 1274 hold two each. All 18 changed under the rule |
| B3b | 04 | `79, 112 (W56, W100)` to `79, 112 (W15, W56, W100)` | 1 | 1 | 1 | MATCH |
| B3c | 04 | `79, 97 (W56, W82)` to `79, 97 (W15, W56, W82)` | 1 | 1 | 1 | MATCH |
| B4 | 04 | `CORE_SERVER_PORT` (shell variable) to `DEMS_CORE_HOST_PORT` | not stated | 4 | 4 | all 4 are the shell variable |
| C | both | `revision: 2.1` to `revision: 2.2` | 1 each | 1 each | 1 each | MATCH (hard assert) |
| C | both | one revision-history row 2.2 inserted after the 2.1 row | 1 each | 1 each | - | done |

Changed lines per file (diff against the original): 01_specs 9 changed + 1 inserted (6 content lines, 2 front-matter lines, 1 footer); 04 25 changed + 1 inserted (22 content lines, 2 front-matter lines, 1 footer). No other line differs.

## 2. BEFORE (original line numbers)

### 01_specs.md

`W03, W08, W09` (4 lines):
```
194:  SA-13 ... | Row 25 (W03, W08, W09) |
1512: OR-9 ... the option names are confirmed by row 25 (W03, W08, W09; SA-13). `Strict-Transport-Security` is not sent ...
2180: "Row 18" | 6 ... in the dependency list of row 25 (W03, W08, W09); the trial steps of SD-01 and SD-15 in row 23 (W03, W07); ...
2214: item 10 ... recorded by row 25 (W03, W08, W09) | SD-14 | No TLS | OR-9
```
`W07 to W09` (2 lines):
```
1544: SU-2 ... rows 23, 25, 57 and 77 (W03, W07 to W09, W13, W14) |
1860: AC-B-91 ... The records of rows 23, 25, 57 and 77 (W03, W07 to W09, W13, W14); `shasum -a 256` in verification row 105 (W90) | SC10 |
```
W09 citations that were NOT touched (row 32 or its own; same before and after, after-numbers shown): lines 193, 194 (SA-12, "Row 32 (W09, W23, W24, W41)"), 2054 (GS-12), 2071 (GS-29, "rows 27, 32"); SA-11 on line 193 "Rows 32, 33, 38, 106 (W09, ...)".

### 04_client_integration_spec.md

`79 (W56)` (18 occurrences on 16 lines; "x2" = two on that line):
```
173 x2 (CA-06: "row 79 (W56)" and "Row 79 (W56)")   174 (CA-07)            683 (7.4 group `auth`)
889 (MB-6)       892 (MB-8)       1158 (12.3 traceability row "79 (W56)")
1270 (AC-C-67)   1272 (AC-C-69)   1273 (AC-C-70)   1274 x2 (AC-C-71)
1337 (AC-C-105)  1340 (AC-C-108)  1489 (GC-17)     1554 (DEPARTURE-6)
1565 ("Row 18" item 2)            1569 ("Row 18" item 6)
```
Other two forms:
```
1268: AC-C-65 ... | 79, 112 (W56, W100) | SC10 |
1271: AC-C-68 ... | 79, 97 (W56, W82) | SC5 |
```
`CORE_SERVER_PORT` (4 lines; each read in context):
```
955:  9.6 table, device-session.sh row: "A new optional environment variable (proposed `CORE_SERVER_PORT`). Unset: nothing changes. Set to 4420-4423: the script also runs `adb -s <serial> reverse tcp:4420 tcp:<value>` ..."   -> shell variable, CHANGED
1292: AC-C-84: "`device-session.sh` with `CORE_SERVER_PORT=4421` maps device `tcp:4420` to host `tcp:4421` ..."   -> shell variable, CHANGED
1523: 17.1 item 18: "`device-session.sh` gets `CORE_SERVER_PORT`; the device side stays `tcp:4420`"   -> shell variable, CHANGED
1564: 17.4 "Row 18" item 1: "Pin the names ... of the environment variables (`VITE_DEMS_CORE_MODE`, the proxy port variable, `CORE_SERVER_PORT`)"   -> shell variable (an environment-variable list, not the constants list), CHANGED
```

## 3. AFTER

Old forms remaining (grep -c -F, expect 0):
```
01_specs  W03, W08, W09                -> 0
01_specs  W07 to W09                   -> 0
04        79 (W56)                     -> 0
04        79, 112 (W56, W100)          -> 0
04        79, 97 (W56, W82)            -> 0
04        CORE_SERVER_PORT             -> 0
04        lines with W56 but no W15    -> 0
```
New forms, 01_specs (fragment, new line number):
```
195:  Row 25 (W03, W08) |
1513: confirmed by row 25 (W03, W08; SA-13). `Strict-Transport-Security` ...
2181: in the dependency list of row 25 (W03, W08); the trial steps ...
2215: recorded by row 25 (W03, W08) | SD-14 | No TLS | OR-9
1545: rows 23, 25, 57 and 77 (W03, W07, W08, W13, W14) |
1861: records of rows 23, 25, 57 and 77 (W03, W07, W08, W13, W14); `shasum -a 256` ...
63:   (the new revision row itself names the same list)
```
Untouched W09 citations after the patch (rows 32 and own): lines 193, 194, 2054, 2071 still read `(W09, ...)`.

New forms, 04: `79 (W15, W56)` occurs 18 times (`grep -o -F | wc -l` = 18) at new lines 174 (x2), 175, 684, 890, 893, 1159, 1271, 1273, 1274, 1275 (x2), 1338, 1341, 1490, 1555, 1566, 1570; `79, 112 (W15, W56, W100)` at 1269; `79, 97 (W15, W56, W82)` at 1272.

`DEMS_CORE_HOST_PORT` in 04: new lines 956 (9.6), 1293 (AC-C-84), 1524 (17.1 item 18), 1565 (17.4 item 1), and 47 (the revision row).

Front matter and footers: both files `revision: 2.2`, `last_updated: 2026-10-04 06:16`, footer `*Last Updated: 2026-10-04 06:16 (revision 2.2)*`; revision row 2.2 at line 63 (01_specs) and line 47 (04).

## 4. Occurrences left unchanged, and why

- `CORE_SERVER_PORT`: none left unchanged in 04. The file names the shared constant nowhere (grep of the original found exactly 4 lines, all four are the shell variable of `device-session.sh`). 01_specs contains neither `CORE_SERVER_PORT` nor `DEMS_CORE_HOST_PORT` (grep, empty), so nothing to change there.
- W09 citations on lines 193, 194, 2054, 2071 of 01_specs (new numbering): they cite W09 for row 32 (and SA-11 / GS-12 / GS-29 lists), as the rule says. Not touched.
- 01_specs line 115 (new 115, unchanged): "Rows 25-56 (W03, W04, W08 to W11, ...)" is a range citation for rows 25 to 56, W09 inside it belongs to row 32; outside the rule. Reported for information only.
- Both files, front matter `blueprint_row:` and `sibling_specs:` lines: unchanged (see D-3).

## 5. Decisions and deviations for the controller to record

- D-1 (count variance): B3a actual is 18 occurrences on 16 lines, not 16; the plan owner's 16 is a line count. Rule applied to all 18. No other pattern differed.
- D-2 (A2 phrase): the instruction says the phrase "W07 to W09" becomes "W03, W07, W08, W13, W14". Replacing only that phrase inside "(W03, W07 to W09, W13, W14)" would give "W03, W03, W07, W08, W13, W14, W13, W14" (duplicates). I replaced the whole parenthetical list `W03, W07 to W09, W13, W14` with `W03, W07, W08, W13, W14`, which is the stated end result and equals the union in plan section 21. Both places (SU-2, AC-B-91) now read exactly that list.
- D-3 (metadata beyond the literal rule): the footer line `*Last Updated: ... (revision 2.1)*` and the front-matter `last_updated` were updated with the revision bump (06:04 to 06:16, "(revision 2.2)"), because the footer would otherwise state the wrong revision. Easy to revert if the controller wants a strict reading.
- D-4 (revision-row wording): the 2.2 row of 01_specs says that `DEMS_CORE_HOST_PORT` does not occur in that file, to keep the history accurate; the 04 row carries the instructed wording and avoids repeating the old literal forms, so the grep for old forms stays at zero.
- Open for the controller, not changed (outside "change nothing else"): `sibling_specs` in 01_specs line 17 still says the client specification is "revision 2.1" and the plan "revision 2"; in 04 line 17 it says 01_specs is "revision 2.1" and the plan "revision 2". The plan itself is rev 2.1, and both specs are now 2.2. Consider aligning these cross-references in a later pass.
- Plan note (plan section 23.3 item 6, "the owner of that file may align the text") is now satisfied for 04; the plan's own statement that 04 "still shows the proposed name" is therefore out of date and can be marked done.

No credential, token or password value was read, printed or written. No install, no code, no process was run; the only commands were grep, diff, cp (backup) and one Python text replacement.

## 6. Files created or updated

- Updated: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/01_specs.md`
- Updated: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/04_client_integration_spec.md`
- Created: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/data_analyst_step_20c.md` (this file)
