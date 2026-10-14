# Row HA - a removal the helper answers NOT_MARKED is not recorded as removed (agent HA, wave 12, 2026-10-14)

Status: **complete**. Record: `implementation/ha_alias_removal_not_confirmed.md`. Caution R119c-01 (C122).

- **Entry for `NOT_MARKED`:** `HOST_ALIAS_REMOVE_FAILED` with `failureReason: 'HELPER_NOT_MARKED'` (admitted: the closed
  list's `failureReason` is `code(REQUIRED)`), `removeReason` = the removal's own reason, `aliasId` with a row; WARNING
  when the Core's table shows the address or cannot be read, else INFO; words never say "removed". Never `HOST_ALIAS_REMOVED`.
- **Kept:** row CLOSED, no retry, next add not blocked; `ADD_UNCONFIRMED` on F-9's path. New optional `confirmed: false`
  on `HostAliasReleased`; report `HOST_ALIAS_REMOVAL_NOT_CONFIRMED`.
- **Expectations changed:** `lifecycle.test.ts` (row NF's NOT_MARKED case); `capture-composition.db.test.ts:715` (claimed).
- **Mutants:** 10, each red (record section 4).
- **Checks:** unit 1009/1010 (red not mine: capture-config static R-5, `adopted-profiles.ts`, row PR); db host-alias 11/11,
  composition 15/15, acceptance pair 83/83; typecheck 0 errors.
- **Requests:** 3 lines, non-blocking (lifetime member; state set has no "not confirmed"; table marker).
- **Files:** `journal.ts`, `lifecycle.ts`, `lifecycle.test.ts`, `lifecycle.db.test.ts`, `capture-composition.db.test.ts`
  (one expectation). Edit tool only for existing files.
