# row S06 (wave 12) - C-10 / S-06: ONVIF set-call source held to isSourceAddress

Status: complete; one request open (N4, static pin of the import list at `src/capture/__tests__/static.test.ts:662`).
Record: `implementation/s06_source_address_form.md`.

- Fixed: `apps/core-server/src/capture/adapters/camera/onvif-network.ts` (:356, via `sourceAdmitted` = `isSourceAddress` + not 169.254/16; import of `./stored-address`).
- Others found held only to the dotted form: none (session, stream-probe, relay-start, watch, relay use `isSourceAddress`; ws-discovery matches an interface address).
- Tests: one appended block in `camera/__tests__/onvif-network.test.ts` (5 refused sources, 0 sockets counted; 192.168.50.1 admitted; 127.0.0.1 control).
- Mutants: DOTTED_QUAD back RED 5/5; link-local clause removed RED 1.
- Checks: onvif-network test 33/33; camera tests + capture static 412/413 (the one red = N4 request); tsc 9 errors none in S06's files; oxlint exit 0.
- DRIVER DECISION: link-local refused locally (isSourceAddress admits it); loopback not refused (tests' double).
- Edit tool only for existing files; nothing running.
