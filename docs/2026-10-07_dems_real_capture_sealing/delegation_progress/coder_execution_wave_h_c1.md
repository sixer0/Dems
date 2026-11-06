# coder-execution - wave H, driver C1 (evidence server)

status: complete
note: implementation/122_fix_wave_h_c1.md

## Files
NEW: apps/core-server/src/evidence-facts/{index.ts,sealed-facts.ts} ; src/engine/sealed-facts-doors.ts + __tests__/sealed-facts-doors.test.ts ; src/evidence-export/{finished.ts,receiver-cli.ts} + __tests__/{receiver-cli.test.ts,wave-h-c1.test.ts} ; apps/core-server/cli/verify-export.ts ; src/modules/evidence/__tests__/detail-facts.db.test.ts.
EDITED: packages/shared/src/api/{evidence.ts,state-slices.ts} (additive, optional) ; packages/shared/openapi/openapi.json (generator) ; packages/shared/src/sim/evidence-actions.ts (download note: optional archiveSha256) ; apps/core-server/src/engine/{host.ts (three own insertions),index.ts (one export line),__tests__/static.test.ts (pin 23)} ; src/media-stream/{source.ts,service.ts,index.ts} ; src/evidence-export/{export-manifest.ts,package-export.ts,jobs.ts,host.ts,service.ts,receiver-verify.ts,index.ts} + __tests__/{support.ts,export.test.ts,export-one-camera.test.ts,export-e2e.db.test.ts} ; src/modules/evidence/{index.ts,__tests__/{static,bulk.db,reads.db}.test.ts} ; src/modules/evidence-export/__tests__/{routes,download}.test.ts ; src/modules/media-stream/__tests__/{routes.test.ts,media-stream.db.test.ts} ; apps/core-server/{package.json (one script),tsconfig.json (include cli),test/static/imports.test.ts (closed list +1)} ; package.json (one script).
NOT touched: any migration, db/schema, db/mapping (no change was needed), sealing-host, session-machine, i18n, any client file, app.ts.

## Requests filed (file_requests.md, 10:20:00Z)
to wave H C2 (the built member names) ; to the docs owner (README command + limits, C3 section 5.2, ev G.1, ux flow 6) ; notice to the seal owner.

## Runs (each once; a second run only after a fail)
shared suite 108 files / 2505 passed ; shared api tests after the example 16 / 429 ; core-server unit, touched folders + test/static 37 / 500 ; db: 7 files / 121 (contract, rbac-matrix, detail-facts, reads, export-e2e, export-restart, media-stream.db) + bulk.db ; typecheck shared, core-server, core-web, mobile: 0 errors ; lint shared, core-server: 0.
