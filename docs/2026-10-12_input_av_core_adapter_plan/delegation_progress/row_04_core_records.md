---
row: 4
agent: database-specialist (model override: sonnet, per Execution Profile row 4)
status: complete
date: 2026-10-12
---

# Row 4 progress: Core records inventory

- Output: `research/02_collection_core_records.md` (Tier 2).
- All eight G2 record kinds found with a declaration `file:line`; none reported "none found". Marker has no table of its own: it is embedded in `active_session.timeline`, `active_session.marker_count`, `evidence_items.markers`, plus audit type `MARKER_ADDED` (search patterns recorded in the file).
- No database connection, no migration, no `apps/input-av/data/`, no `.env` touched. Only the task folder was written.
- Decision for the controller: "device registry entry" has two Core registries (`capture_devices` for capture hardware, `paired_devices` for client apps); both are reported, row 6 should map input-av devices to `capture_devices`.
- Not examined (listed in the file): migration SQL beyond two files, `core/audit-details.ts` contents, transcript tables beyond declarations, exact AUDIO-01 package file name.
- Citations were corrected once after a first draft (kept-tables, slices, vocabulary line numbers) by re-reading the lines; other line numbers come from the reads quoted in the file.
