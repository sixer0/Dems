# Row 111b - progress (driver, track D)

Status: **needs-review** (inputs (a) and (b) built, handed in and green on stand-in programs; input (c) - the scan's endpoint count / conflict flag - NOT built: it needs a second named amendment and a file that is not this row's). Record: `implementation/111b_commissioning_production_inputs.md`.

- THE ROWS (helper table `apps/core-server/src/capture/adapters/local/mic-helper-args.ts`): `/usr/sbin/ip -4 neigh show to <a.b.c.d>` and `/usr/bin/ping -n -q -c 1 -W 1 <a.b.c.d>`. ONE data argument each, the address, made by the one table function from four integers (private range, host part 1 to 254). No interface in any row.
- THE CALLER: `hostCommissioningInputsOf` in `src/capture/fence/production-parts.ts` - the destination rule before every program, the production door, an empty environment, bounds 1,500 / 2,500 ms, a strict reader, a closed set of thrown reasons; null off `linux` (nothing is started).
- THE HAND-OVER: `src/capture-composition.ts` - `inputs` into the set-IP job, `mac` into the scan. On a Linux production Core a job is no longer refused for missing inputs; on macOS it still is, by name.
- "DOES IT ANSWER" is one echo, then the neighbour table - NOT the duplicate-address tool: the host profile gives the Core's unit no packet socket (HOST-38, HOST-39).
- AFTER THE CONTAINER FINDING (record 079; an exit code of 0 is no proof): the echo row is judged by its STATED result in a strict form that must agree with its exit code; "free" needs the host's own `FAILED` / `INCOMPLETE` entry on the camera interface; no entry, and anything unparsable, is UNKNOWN and REFUSES the new address (`409 COMMISSIONING_NOT_AVAILABLE`). Cases added; second runs: composition unit 62, unit set 666, database 31 with "0 remain", static 567, typecheck 0, lint 0. The Core names no `arping` path. `mic-helper-args.ts:208` and its tests were not touched.
- NOT the runner of SR-11: its one use, its rule and its control are untouched.
- NAMED AMENDMENT: SR-12 proposed and built under (the address argument). SR-13 (a second call of the WS-Discovery file for the endpoint count) is needed for (c) and was NOT taken.
- CHECKS (each one run): composition unit 61 passed; capture static file 71 passed; 28 static files 567 passed; touched areas 772 passed; database - scan + composition 24 passed, job on the stub 7 passed, "0 remain" twice; typecheck 0; lint 0.
- REQUESTS: three `row 111b` lines in `file_requests.md` (SR-12; the endpoint count with the exact entry SR-13 and the unicast finding; the host profile: `ping` unnamed and its right to send inside the unit unstated, the path of `ip`, the limit on `arping`).
- UNPROVEN: everything on Linux and on a camera - `9A/H-13`, `H-14`, `H-15`; the real helper `9A/H-05`, `H-06`.
- EDIT-ONLY RULE KEPT. No real `ip`, `ping` or `arping` ran; every program was a stand-in script.
