# Row 91 - database-specialist - R-FLEX database delta
- Status: needs-review (recommended path complete; Q-DB1, Q-R3, Q-R1 refined go to row 96; Q-DB2 to row 95)
- Output: masterplan/01_specs_rflex_database.md
- Also appended 2 lines to delegation_progress/file_requests.md (RELEASE_AUDIO_INPUT; option-B data-step file name)
- Key decisions: service-only exclusivity inside the op-99 unit (pipeline + audit chain lock already serialise, core/pipeline.ts:2-8, core/unit-of-work.ts:15-18); release = slot clear + usb_serial/usb_port cleared (grants 0018:40, 0005:35-37); keep usb_port; no capture_network_config change; NO MIGRATION, version stays 15/dbc-16 (DB-M1..M5 unused). Option B (0034/0035, set 17, v16, dbc-17) fully specified for row 96.
- Cross-row dependencies: row 88 must keep "no serial AND no port = never opened" (RM-A3/A4) for the release form; row 88 owns macOS re-key on port move; row 90 column change would void "no migration"; Q-R1 recommendation (b) differs from register (a).
- Nothing run against a database; no code, host or git writes.
