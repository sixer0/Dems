# Row 87 - data-analyst - R-FLEX names-and-constants register

- Status: complete
- Date: 2026-10-22
- Output: masterplan/01_specs_rflex_register.md
- Read-only on the repo; no code, host or git writes.

## Key results
- Next migration: 0034 (generated) + 0035 (hand-written privileges/version), set 17, schema version 16 / dbc-17, contract-v16-delta.ts, set17.db.test.ts. Cited: src/db/migrations/meta/_journal.json:240 (last idx 33), schema/meta.ts:121,123, 0033:89. Used only if row 91 adds a DB object.
- No new operation recommended; next free number 112 reserved (api-registry.test.ts:362 = 111 ops; LCD diff adds no operation).
- FIRM removals: PORT_DIFFERS (adapter :287/:358; service :380/:439) with test callers listed. Network point-2 codes no longer raised for TYPED_PROBE/STORED_CAMERA; constant deletion provisional (RQ-N2).
- Found: NO_CAMERA_SOURCE is also the form-check sentinel FORM_ACCEPTED (network/facts.ts:174) - must be rewritten if the code is deleted.
- Found: op 111 retire is contract-only, unrouted until RD3 (contract.test.ts:233-235) - release-by-retire not recommended.
- Found: search answer contract forbids interface names (capture-discovery.ts:258) - no per-result interface member registered.
- New names: AUDIO_CARD_ALREADY_BOUND, boundTo, release, releasedDeviceId, audit change RELEASED, word keys W-A1..A5; provisional: MODEL_SHARED, NO_SOURCE_INTERFACE, interfaceSubnets, capture_audio_inputs_usb_identity_key, REBOUND.
- No new env/config names.

## For row 96 (new questions)
- Q-R1 exclusivity unit (physical card vs card input) - ruling gap.
- Q-R5 meaning of "line" in D10(1) (MIC input vs selector line).
- Plus Q-R2..Q-R4 (RQ-A2, RQ-A6, RQ-N2) with recommendations.
