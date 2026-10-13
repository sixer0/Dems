# Row 143b - the source half of the destination rule (driver record, short)

Status: **needs-review**. Record: `implementation/143b_source_address_bind.md`.

- Built: the judgement of a stored camera carries the rule's `sourceAddress`; the ONVIF session binds every socket of an exchange to it; the relay takes `source` in its start message (mandatory in record mode), binds before it connects at the first open and every re-open, and holds its camera socket to it in its own socket rule; the stream-level connection test of an adopted camera uses the same path.
- Not built: the camera watch's time read does not hand the source in yet (its file was another row's at the start; exact change in `file_requests.md`).
- Exit code: none added; 20 `CAMERA_UNREACHABLE` is used.
- Changed outside the first ownership list, declared in `file_claims.md`: `apps/capture-worker/relay-check.sh` (the rule "binds nothing" became the positive rule S13-11; security confirmation requested), `row041_relay.py`, `row044_door_parent.mts`, `adopted-test.ts` and its test, `connect/service.ts` (one type line), `test/support/stored-camera-address.ts`.
- Checks: `make rc=0` (relay unit 982 checks, fuzz 0 failures, import net OK); fuzz controls 24 of 24; `row143b_source_bind.py` 14 of 14; `row043_reopen.py drop` 11 of 11; Core unit 21 files, 482 passed; Core database 11 and 7 passed; typecheck 0.
- Unproven until hardware: a second interface (the camera sees the camera-interface address; nothing leaves by the other one; a running relay's re-open after the address is lost; an interface that is down with its address still configured).
- Messages from the controller during the row: the SR-2 and G-R10/11 reds are green again without an edit of that list (request line with the exact pin texts); `onvif-session.test.ts` fixed; `fake-onvif-stub.ts` was only used through its existing calls; row 85d's `admitDevice` is not built and nothing of this row stands in its way.
- Edit tool only for existing files (three edits with `replace_all`); new files with Write.
