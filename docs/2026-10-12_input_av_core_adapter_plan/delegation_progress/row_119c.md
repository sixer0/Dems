# Row 119c - the helper statement for hash 3621e79c (security-review, 2026-10-14)

Status: **complete.** Record: `verification/119c_helper_statement_3621e79c.md`. Read-only on source; two files written (the record and this one).

- **Hash verified first:** `scripts/host/netalias/dems-core-netalias` = SHA-256 `3621e79ccebb05d052efa06b9c1c0dd4d5d4e30d08c2f55f39019857cc7e4914`, before and after the suite; `shasum -a 256 -c SHA256SUMS` three times `OK`; unit files unchanged (`8623c1cd...`, `7e40f25e...`).
- **The diff against the reviewed file:** `git show 1fbeada7:scripts/host/netalias/dems-core-netalias` hashes to `1e758a24...c7d015b1`; `diff -u` against the working file prints **two hunks and nothing else** (`add` `:738-749`, `delete` `:773-777`; 17 lines added, 2 removed).
- **The statement "S13-08 to S13-10 are closed in the helper as delivered": MADE for `3621e79c...7e4914`, with four conditions.**
  - C-1: S13-10 (a) remains for the host (`9A/H-06`); no use on an installation before it passes.
  - C-2: `HI-01` to `HI-08`, `9A/H-05`, `9A/H-25` remain for the host, with three added readings (record section 8).
  - C-3: **MET for the hash** (`SHA256SUMS:1`; chapter 4 `:179`, `:213`, `:532`; chapter 1 `:309`; chapter 2 `:361`). Sentences left: chapter 4 `:19`, `:36` ("still to be made"), `:166`, `:586` (name record 119b and C101).
  - C-4: one hash; any change, the removal of the dead function included, needs a re-read.
- **Hunk 2 (F-1, `delete`):** refuses in the right cases; cannot refuse a removal the Core needs (the changed line is inside the branch that never started `ip addr del`); the kernel lifetime is untouched.
- **Hunk 1 (R119b-01, `add`):** every refusal of the second read lies before the mark: no mark, no address. 42 / 40 / 43 on the second read are right; the Core reads them as `NOT_DONE`. Residual gap: milliseconds between the second read and the add; a carrier that goes and returns inside the probe. Accepted.
- **What the Core does with `NOT_MARKED` on a removal:** treats it as "gone" (`journal.ts:225`, `lifecycle.ts:281`): closes the row with the removal's own reason, arms no retry, does not block the next `add`; with a row it writes `HOST_ALIAS_REMOVED`, without one `HOST_ALIAS_REMOVE_FAILED` (INFO).
- **New cautions, no FAIL:**
  - R119c-01 (Medium, in the Core, not a condition): a removal with a row answered `NOT_MARKED` is still recorded "Alias address removed"; F-1's purpose does not reach the audit entry. Row: owner of `journal.ts` / `lifecycle.ts`, after a ruling (C114 F-9 reads the same lines).
  - R119c-02 (Low): the time bounds of one `add` now sum to 33 s, above the unit's `RuntimeMaxSec=30`; the end state is the safe "killed between mark and add". Row: the next helper change; a host reading.
  - R119c-03 (Low, documents): the chapter sentences above; chapter 4 `:59`; record H5's sentence on `ADD_UNCONFIRMED`; three readings for `9A/H-25`. Rows 127 / 125 / 128.
- **The dead function `on_camera_interface`:** harmless, no caller, no call by name possible; remove with the next hash move.
- **Checks run:** `shasum -a 256` (helper, before and after; `-c SHA256SUMS`); `py_compile` ok (byte-code outside the tree); the helper's suite on doubles `Ran 96 tests in 61.563s`, `OK`. No mutant planted by this row: five of row H5's mutant copies compared with the delivered file, fifteen logs read.
- **Limits:** nothing on Linux or under systemd; the Core's suites not run; three statements about the service manager and the kernel marked as hypotheses.
- Not written: `decisions.md`, the tracking files.
