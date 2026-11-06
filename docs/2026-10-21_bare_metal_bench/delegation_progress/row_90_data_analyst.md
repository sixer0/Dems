# Row 90 - data-analyst - R-FLEX network functional delta

- Status: needs-review (complete as a spec; items depending on row 89 are recommendations until row 89/95 reconcile)
- Date: 2026-10-22
- Output: masterplan/01_specs_rflex_network.md
- Also appended: delegation_progress/file_requests.md (1 line: SOURCE_INTERFACE_AMBIGUOUS)

## Decided
- RQ-N1: 7 production call sites, 2 test-only, 6 builders, 9 consumers each with new behaviour (section 4).
- RQ-N2 (half): TYPED_PROBE, STORED_CAMERA global; source = address of the eligible interface whose subnet holds the target (longest prefix; tie across interfaces refused; off-link refused NW-R1).
- RQ-N3: property-based, Wi-Fi included; DISCOVERY_MAX_INTERFACES stays 4; typed-probe source interface always probed first.
- RQ-N4: interface_name/camera_subnet stay nullable; required only for scan, set-IP, alias helper; console step optional; no DB change.
- Boot: HOST-46 and host-alias agreement unchanged in behaviour; fence fallback HOST_NOT_CONFIGURED re-shaped; connect-service F3-06 COMMISSIONING_NOT_CONFIGURED branch removed.

## For row 96 (N-96-1..6)
- N-96-1 scan/set-IP stay bound (rec.) - depends on row 89
- N-96-2 off-link targets refused (rec.) - depends on row 89
- N-96-3 source interfaces = discovery eligibility (rec.) - depends on row 89
- N-96-4 bound 4 kept (rec.)
- N-96-5 U-RF3 consequence: off camera port = typed address only (hypothesis on conntrack, needs bench check)
- N-96-6 HIL row 124 N/A unless re-addressing used

## Blockers
- None. Row 89 output absent at write time.
