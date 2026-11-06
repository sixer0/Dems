# Row HC3 (agent HC3, track D) - 2026-10-13 - status: complete

**Task** (decision C103): take item 3 of row HC out - the Core's listing of the rule table - and only that.

**Removed:** in `apps/core-server/src/capture/boot/host-checks.ts` the row `/usr/sbin/nft list table inet dems_loopback` with its parser, the constants `PACKET_FILTER`, `RULE_TABLE`, `RULE_CHAIN`, `RULE_PARTS`, and the reason words `RULE_TABLE_ABSENT_OR_NOT_READABLE`, `RULE_CHAIN_MISSING`, `RULE_NOT_IN_CHAIN` (no other user anywhere in product, contract or scripts). The named entry and its control in `src/capture/__tests__/static.test.ts`. The table answers of the double and 7 test cases.

**Stays:** `CAPTURE_HOST_LOOPBACK_RULE_MISSING` / `RULE_UNIT_NOT_ACTIVE` (the unit's state, row 80, byte for byte) and its sentence (row HC never edited it). Items 1, 2, 4: `CAPTURE_HOST_ALIAS_HELPER_ABSENT`, `addressHelperSocket`, `CAPTURE_HOST_ALIAS_SOCKET_PATH`, `CAPTURE_HOST_FACTS_NOT_HANDED_IN` - product files not edited, tests unedited and green.

**Comment left** at the unit's row and in the file header: the table is not read; the Core's unit has no capability and the kernel refuses the listing (C103, `test/hc2_nft_listing_unprivileged.md`); do not add it again; the limit that follows.

**Blobs:** `boot/checks.ts` 90b3a1e6 -> 90b3a1e6 and `boot/index.ts` 63fe763e -> 63fe763e: EMPTY diff, zero hunks (item 3 was a row of `host-checks.ts` only). `host-checks.ts` fd7e637d -> 9d5d1341 (479 -> 453 lines, four hunks). `program-checks.ts` 15680a74 unchanged. `__tests__/host-support.ts` is the committed blob 8928710a again.

**Finding:** `git diff HEAD` WAS usable - the committed `host-checks.ts` (a88c6a1a) is the start blob of row HC, so the pre-HC text was read from git, not reconstructed.

**Tests restored:** `host-checks.test.ts` (no code asked twice; `ALL_CHECKS` members; the nine questions word for word; the loop keyed by code), `checks.test.ts` (the removed-one-at-a-time loop), `static.test.ts` (eight program literals; the refused list on the file itself), `host-support.ts` (`fakeHost.run`).

**Checks:** unit `Test Files 30 passed (30)`, `Tests 799 passed (799)`; database (fence.db, boot.db, capture-composition.db) `Tests 1 failed | 68 passed (69)`, 0 clones left - the one is `capture-composition.db.test.ts:924`, agent V6 (R119-04), not this row's; `tsc --noEmit` exit 0, no output; `oxlint` exit 0, no output.

**Request left:** one line for the document row - `9A/H-16` criterion 6 as a stated limit (text in the line).

**Driver decision (to confirm):** D-1 - the decision list `C49 (2)` in one comment line each of `checks.ts:68` and `index.ts:134` was left, so the two fence baselines do not move for a comment word.

**Record:** `implementation/hc3_nft_check_removed.md`.

**Rules:** Edit tool only on existing files; no commit, stage or restore; no host command; database on throw-away clones under both locks.
