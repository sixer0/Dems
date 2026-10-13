# Row 85d - progress

Status: complete up to the door (doubles on this Mac). Record: `implementation/085d_admit_device.md`.

- Built: `admitDevice(entry)` and `admittedDevices()` on the production camera adapter (`camera/onvif-relay.ts`) and the production microphone adapter (`audio/usb-audio-production.ts`); idempotent for a known device; refuses another class, an id of another class, a stated other adapter kind or source class, a malformed entry. After the admission every use reads the store as for a device of the first list (stored address through the rule with its source; card by serial / port).
- No edit of `capture-composition.ts` or `fence/*`: the builder of row 85c finds the member by name.
- Before the lift: a registry still refuses the adapter and its one-entry view; A-9 green; existing tests unedited.
- Checks: adapter files 85 of 86 on run 1 (one wrong expectation of my own), then 45 passed; static and touched units 570 of 571 (the red is `test/static/search-path.test.ts`, the alias row's files); typecheck 0 errors in this row's files, 8 in three files of rows in flight.
- For row 88: `reader`, `onAdmission` sink, the opener list, the camera watch and the microphone loss watch of a later device (request line).
- Edit tool only for existing files; new files with Write.
