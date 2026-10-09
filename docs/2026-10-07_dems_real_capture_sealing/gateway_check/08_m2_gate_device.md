# M2 device gate (row 56b) — M2-LANE-1 verification run (+1) on devices

- Date: 2026-10-09, 09:20-09:25 WIB (02:20-02:25Z). Run by the Claude Code controller at the user's instruction ("kamu yang lanjutkan").
- Verdict: **PASS on lanes 2 and 3 (live). Lane 1 device clause OPEN** — `dems2_phone` (emulator-5558) still shows the keyguard; no agent types a device PIN.
- Device-to-lane map, read from `adb -s <serial> emu avd name` and `adb reverse --list` (unchanged since row 53):
  `emulator-5558 = dems2_phone -> lane 1 (4420->4421)`, `emulator-5556 = dems2_tablet -> lane 2 (4420->4422)`, `emulator-5554 = dems2_phone2 -> lane 3 (4420->4423)`.
- Note: the two phone AVDs sit on swapped ports against `device-session.sh` / `emulator-user-lock.sh` (which expect phone=5554, phone2=5558). The user's `emulator-user-lock.sh unlock` therefore unlocked the tablet and correctly REFUSED both phones. `dems2_phone2` has no lock (`isKeyguardShowing=false`).

## 1. Stack

The lane stack was down at the start (only PostgreSQL 4432 listening). Started with the row-44 command forms: `DEMS_CORE_PORT=4421..4423 npm run start:server`, `DEMS_CORE_PROXY_PORT=442N VITE_DEMS_CORE_MODE=live npm run dev -w @dems/core-web -- --port 5176..5178 --strictPort --host 127.0.0.1`, `npm run dev:mobile`.

```
4421/4422/4423 /api/v1/health: "status":"ok" ... "ready":{"database":true,"engine":true}
5176/5177/5178: root=200, proxied /api/v1/health "status":"ok"
8081: packager-status:running
listeners: 127.0.0.1:{4421,4422,4423,5176,5177,5178,8081} + postgres 127.0.0.1:4432
```

## 2. Per-lane pairing (supervisor sign-in through each lane's Vite origin, `GET /api/v1/pairing/devices`), two identical sweeps

```
== 2026-10-09T02:21:21Z and 02:21:22Z (identical)
lane 1: sign-in 200; list 200; count=1; ws.clients=0; DEV-0001:PAIRED online=false pairedAt=1791426649334
lane 2: sign-in 200; list 200; count=1; ws.clients=1; DEV-0001:PAIRED online=true  pairedAt=1791426674169
lane 3: sign-in 200; list 200; count=1; ws.clients=1; DEV-0001:PAIRED online=true  pairedAt=1791426593561
```

The three `pairedAt` values equal those of row 44 / row 53 (`50_m2_lane_v2_completion.md` §5.4): no device was re-paired across the v2 migration, the reseed, the snapshot bump and this restart. Lane 2 is new live evidence (row 53 could only show it at DB/API level while the tablet was locked).

## 3. Reconnect without re-pairing — lane 2, tablet (non-mutating, no session started)

```
before:            "clients":1
after force-stop:  "clients":0
am start -W ... "demsdemo:///login?core=LIVE&motion=off"  -> Status: ok
after relaunch:    "clients":1
Metro: GET /api/v1/pairing/device 200 ; GET /api/v1/auth/status 200
```

## 4. Screens

- `evidence_08/lane2_tablet_login_core_online.png` — Login, "Core online", "Core: DEMS-IR-01 - paired as DEV-0001".
- `evidence_08/lane3_phone2_login_core_online.png` — same on the phone layout.

## 5. Open

| Item | State | Owner |
|---|---|---|
| Lane 1 live clause (`dems2_phone`, emulator-5558) | pairing holds at API level (`PAIRED`, original `pairedAt`), socket closed by the keyguard | user unlocks the emulator by hand, then one relaunch + sweep |
| Phone AVD ports swapped against the helper scripts | works for the lanes, breaks `emulator-user-lock.sh` and `device-session.sh` targets | cold re-boot of both phones on their standard ports before the pre-handover session |
| Observation, not judged here: the tablet Login shows a footer line "SECURE RECORDING / TRUSTED EVIDENCE / SAFER COMMUNITIES" | - | user |
