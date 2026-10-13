# Row 119b - the helper statement re-examined (security-review, 2026-10-13)

Status: **complete.** Record: `verification/119b_helper_statement.md`. Read-only on source; two files written (the record and this one).

- **Hash verified first:** `scripts/host/netalias/dems-core-netalias` = SHA-256 `1e758a2407f862ebfc461768f11c491ff43f3e89fcbf9d9a2da45763c7d015b1` (equal to `SHA256SUMS`; equal again after the suite). Unit files unchanged (`8623c1cd...`, `7e40f25e...`).
- **The statement "S13-08 to S13-10 are closed in the helper as delivered": MADE for that hash, with four conditions.** Closed in code: S13-08 all nine bounds, S13-09 as a form; S13-10 (b), (c) in the Core as rated by row 119.
  - C-1: S13-10 (a) remains for the host (`9A/H-06`); the function is not used on an installation before it passes; if it fails the helper changes and the statement is void.
  - C-2: `HI-01` to `HI-08`, `9A/H-05`, `9A/H-25` remain for the host; a failed criterion reopens its bound.
  - C-3: the procedure must print this hash before the user installs. NOT met today: `scripts/hardware-acceptance/HW-ACCEPTANCE-4-HELPER-INSTALLATION.md:151,185,489` and `implementation/104_alias_helper.md` still print `62c0b726...`.
  - C-4: one hash; any change of the helper needs a re-read of the changed lines.
- **R119-01: closed** (`refuse_unless_askable:544`, `conflict_verdict:561`, `_expected_conflict_tool:257`, the one gate `add:736`). **R119-02: closed** (`mark_stands:663`, `standing_marks:684`, `delete:753`).
- **New cautions, all Low, no FAIL:**
  - R119b-01: a carrier lost between the flag read (`add:716`) and the end of the probe (about 3 s) gives `FREE` with nobody asked; fix = read the host again after `FREE`, before the mark. Moves the hash. Not a condition. Row: follow-up of H2.
  - R119b-02: if the kernel does not remove an expired address, the helper stops honouring its own mark 60 s later; `9A/H-06` gains two lines. Row: writer of `9A/H-06`.
  - R119b-03: the Core's `protocol.ts` has 36 of 41 pairs; acceptable for releasing the helper (an unknown code is a refusal plus one extra `del`), a gate before the first hardware check that calls the helper through the Core. Row: owner of `protocol.ts` (`file_requests.md:440`).
  - R119b-04: documents on the old hash (C-3); `HI-06` and `9A/H-25` name none of 38, 46, 47, 48, 55. Rows 127, 104, 125, collectors.
- Notes: N-1 the captured texts are read by no test; N-2 the limit of one alias is serialised by the socket unit's `MaxConnections=1`, not by a lock in the helper.
- **Checks run:** `shasum -a 256` (helper, two unit files); `python3 -m py_compile` exit 0 (byte-code outside the tree); the helper's suite on doubles `Ran 75 tests in 51.390s`, `OK`. No network command, nothing installed, no container.
- **Limits:** row H3's captures taken as recorded, not replayed; two kernel statements marked as hypotheses in the record; the other 45 rows of row 119 not re-read.
- Not written: `decisions.md`, the tracking files.
