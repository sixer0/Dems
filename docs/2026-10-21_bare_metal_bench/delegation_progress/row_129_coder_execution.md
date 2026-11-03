# row 129 | coder-execution | complete
- Report: implementation/75_rflex_audit_vocabulary.md
- Files: packages/shared/src/api/capture-audio-cards.ts; apps/core-server/src/core/audit-details.ts; apps/core-server/src/modules/capture-inputs/audio-cards/service.ts (MESSAGE_OF_CHANGE.RELEASED only); apps/core-server/src/core/__tests__/writers.test.ts; packages/shared/test/api-capture-discovery.test.ts
- Tests: writers 161/161; audit-details 35/35; api-capture-discovery 39/39; shared typecheck 0; core typecheck 2 pre-existing (row 131) only
- Request: openapi.json regenerate (row 100); openapi.test no-drift red until then
- Audit reader: no read path checks `change` (grep)
