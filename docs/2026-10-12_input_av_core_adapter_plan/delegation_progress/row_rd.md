# Row RD (wave 12, track D, data-analyst; decision C146, request 570) - status: complete

Design: `masterplan/07_design_retire_readopt.md` (Tier 1, short).

- READ-ONLY. No code was edited. Nothing under `apps/input-av/data/` or `.data/` was read, and no key or credential file was read. Nothing was committed and nothing is left running.
- What input-av does:
  - `DELETE /cameras/{id}` (`admin.py:391-400`) hard-deletes a camera or audio source, together with its credential, only when the camera has NO recording. Otherwise it refuses with `409` and tells the admin to disable the camera instead. It also removes the MediaMTX path and writes audit `camera.delete`.
  - `DELETE /devices/{id}` (`devices.py:49-58`) forgets a discovery row; the row comes back when the device is detected again.
  - `service.py:250` `_discard` deletes a failed retry recording part. It is not a device removal.
  - ONVIF re-registration refuses any known MAC (`registration.py:50`). So input-av also cannot re-adopt a camera that has recordings.
- Core facts:
  - Six RESTRICT foreign keys and the INSERT-only `session_capture_sources` hold a device row.
  - The sealed manifest names device ids by value (fields 35, 56 and 139). Fields 38-39 (model, firmware) are read from the registry row at seal time.
  - The runtime role has no DELETE on any of these tables. The engine refuses a device that leaves the slice (`changes.ts:232`).
  - A hard delete could reuse an id, because ids are minted as the maximum plus one.
- RECOMMENDATION: option B.
  - One new operation: 111 `retireCaptureDevice`, for cameras and microphones, under `CAPTURE_COMMISSION`, from the web console only, while idle.
  - The device's credential is destroyed through a definer function. Its row is kept and becomes unassignable.
  - Adopting the device again goes through the existing operations 95/96/99 and mints a NEW id.
  - Schema v15 / migration set 16 (`0032`/`0033`): `retired_at` and `retired_by`, partial unique indexes, a guard trigger, and the destroy function.
  - Rejected: an in-place "replace stored profiles", because it rewrites what the registry means and covers neither a replaced unit nor microphones. Also rejected: the same id, and a hard delete.
- Rows: RD1 schema (M), RD2 contract (M), RD3 Core op 111 (M), RD4a camera filters (M), RD4b microphone filters (S), RD5 web and tablet (M), RD6 security review (S).
- Open questions for the controller: Q1 permission (reuse `CAPTURE_COMMISSION`?); Q2 where retired devices are listed; Q3 option D later; Q4 a hard delete of a never-used device.
- Hypotheses: a demo reset carries the new column; the credential key is installation-wide; the file that holds op 89's handler.
