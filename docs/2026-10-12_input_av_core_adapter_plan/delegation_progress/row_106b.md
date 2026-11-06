# Row 106b - the alias routes, the mount, the adapter, the scan's parts

Status: **needs-review**. Record: `implementation/106b_alias_routes_and_mount.md`. Date: 2026-10-13.

| Item | State | Result line |
|---|---|---|
| (1) routes of 104 / 105, deferrals ended | done | acceptance `contract.test.ts` + `rbac-matrix.test.ts`: `Test Files 2 passed (2)`, `Tests 82 passed (82)`; router 111, routed operations 108 |
| (2) the mount, `boot()` and `shutdown()` | done but ONE source | booted production Core, block "row 106b": `Tests 3 passed`; the entry statement unchanged. NOT wired: the interface-file source of an `add` (every `add` refused `INTERFACE_FILE_UNREADABLE` until then) |
| (3) the adapter, C78 DD-2, `alias` of the answer, the alias audit rows of a scan | done | `lifecycle.test.ts` 54 passed (11 of the adapter); through the route on the booted Core |
| (4) the scan's parts: 103 live | done on the helper double | the same block |
| (5) two static reds | done | R-5 green by a product change (`SESSION_IS_OPEN`); `search-path.test.ts` was already green |

Deferrals ended: operations 104 `getHostAlias` and 105 `removeHostAlias` in both acceptance files, by delta.

What row 111 gets: `productionHostAlias(app).jobs` (`HostAliasJobPort`: `helper`, `add`, `remove`, `state`); `NOT_DONE` = ask no removal, `UNKNOWN` = ask `remove`.

Under the heavy-host lock, one run after the last edit: `factory-scan/__tests__/service.test.ts` and `src/__tests__/host-alias-socket.test.ts` in full, `Test Files 2 passed (2)`, `Tests 94 passed (94)`. Typecheck 0 lines; lint exit 0.

Reds that are not this row's: `src/capture/__tests__/static.test.ts:220` (`capture/signer/host-key.ts`) and its C46 case (`capture/boot/index.ts`).

Requests left (six lines `row 106b (driver)` in `file_requests.md`): the runner for the interface file (K3 / S1 / controller, blocking for an `add` on an installation); information for S1; the interface for row 111; five rulings; the description step of 103 / 104 / 105 (V4); two reds of other rows.

Driver decisions: section 9 of the record (D-1 to D-8).

Edit tool only for every existing file; new files with Write.
