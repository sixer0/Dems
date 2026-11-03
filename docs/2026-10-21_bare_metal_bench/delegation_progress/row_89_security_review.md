# Row 89 - security-review - R-FLEX security posture delta

- Status: complete (spec; posture assessment CAUTION)
- Output: masterplan/01_specs_rflex_security.md
- Also appended: delegation_progress/file_requests.md (1 line: DestinationRefusal.SOURCE_AMBIGUOUS)
- Verification: lifted/kept table covers all 25 DestinationRefusal codes (def lines :38-:86 re-grepped) plus point-4 size/spacing guards; RG-1..RG-14 each carry a threat; D11 quoted verbatim in section 0.
- Lifted (TYPED_PROBE, STORED_CAMERA only): OTHER_INTERFACE_SUBNET, OUTSIDE_CAMERA_SUBNET, NO_CAMERA_SOURCE, NOT_CONFIGURED ("no camera network" meaning). Kept for COMMISSIONING_SCAN, SET_IP, decideNewCameraAddress (recommended; row 96 Q89-5 = register Q-R4).
- New source rule: on-link only, discovery eligibility, refuse off-link (NW-R1 NO_SOURCE_INTERFACE) and ambiguous overlap without the camera interface (<REQ:...SOURCE_AMBIGUOUS>).
- Findings to carry: (1) FORM_ACCEPTED sentinel = NO_CAMERA_SOURCE via STORED_CAMERA (network/facts.ts:174,178) breaks when SC stops raising it -> rows 90/102. (2) RR-2 DHCP address reuse on Wi-Fi sends the stored camera digest to another device; no identity check found (keyword grep only). (3) HOST-23 per U-RF3: multicast answers on Wi-Fi dropped; Wi-Fi cameras by typed address only (conntrack admission of the reply = hypothesis, 9A/H-12).
- For row 96: Q89-1..Q89-5.
- No code, host or git touched. No secrets.
