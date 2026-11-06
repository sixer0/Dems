# Row V7b (wave 12, agent V7b) - status: complete

Record: `implementation/v7b_network_config_contract.md`.

- Contract: `onvifPorts` on operations 101 (required) / 102 (optional): 1-8 integers 1-65535, distinct, order kept, default `[80]`; `CAPTURE_INTERFACE_NAME_PATTERN` widened to `^[A-Za-z0-9][A-Za-z0-9_.-]{0,14}$` (one constant, held equal to the table CHECK by a database test). OpenAPI regenerated (110 operations).
- Module: store reads/writes `onvif_ports`; `networkFactsOf` hands it as `allowedPorts` (before: unset, the rule always used `[80]`); reader carries it through load / committed / NF's reload; RELOAD_FAILED unchanged.
- Audit: `changedFields` takes the contract's list; optional `onvifPortCount` (1-8).
- C127 / S-04 fixed at both gates: dialled port = stored or 80; must be listed; `STORED_ADDRESS_PORT_MISMATCH` for an admission of another port. Existing tests unedited.
- 17 mutations red. Checks: shared 2913/2913; Core unit 226/226 (+ wider set: reds only N7, S06, N4 files); Core DB 94/94, 0 remain; web commissioning 29/29; typecheck 0 in shared/web/mobile, Core 9 lines none mine; lint clean.
- Counts unchanged: 110 / 85 / 52 / 9.
- Requests: W6 (ports field, words, name hint); tidy of four Core pattern copies.
- Edit tool only for existing files; nothing committed.
