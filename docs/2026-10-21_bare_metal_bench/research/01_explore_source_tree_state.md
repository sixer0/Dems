---
task_id: 2026-10-21_bare_metal_bench
date: 2026-10-22
agent: explore (row 7)
scope: Q9 - host tree ~/Desktop/DEMS-source vs Mac working tree
---

# Q9: host source tree vs Mac working tree

## Conclusion
CODE IS IDENTICAL. Same HEAD, same 22 modified tracked files (identical `git diff HEAD --binary` hash), same 22 untracked code/doc files with identical content hashes. The only differences are docs: the Mac has 12 extra untracked files under `docs/2026-10-21_bare_metal_bench/` (this task's own folder, created after the copy). No `graft/` directory shows in either tree's untracked list (not present or ignored). Nothing needs to be copied for the install.

## Commands (run identically on both sides, read-only)
`git rev-parse HEAD`; `git rev-parse --abbrev-ref HEAD`; `git status --porcelain`; `git diff HEAD --binary | sha256sum` (Mac: `shasum -a 256`); `git ls-files -o --exclude-standard -z | sort -z | xargs -0 sha256sum`, then a sha256 of that list. Host path: `/home/gsp-dems/Desktop/DEMS-source` (via ssh, `bash -s`, script read from the Mac scratchpad `q9.sh`). Mac path: `/Users/gsp-budi/Documents/DEMS`.

## Side by side
| Item | Host | Mac |
|---|---|---|
| HEAD | e05a156711c046fc524d23a53a8539a95e6b0bf5 | e05a156711c046fc524d23a53a8539a95e6b0bf5 |
| Branch | task4/input-av-core-port | task4/input-av-core-port |
| porcelain lines | 32 (22 M + 10 ??) | 33 (22 M + 11 ??) |
| sha256 `git diff HEAD --binary` | ec4896961a7e25db0b7729367d4cfbfca97362d0b02946c18417a6ed91d48501 | ec4896961a7e25db0b7729367d4cfbfca97362d0b02946c18417a6ed91d48501 |
| sha256 of untracked hash list (all) | 0a53e6036b71be57558ea7351548253fdd7fc1ccc11e849b9ccfee68944c00fe | 1ae512a9a66b99c66ba7785fa5782a3d4351dba006c1028416f1f9cfab0fd5dd (differs: docs only) |
| untracked files hashed | 22 | 34 |
| sha256 of untracked list, sorted by path, excluding `docs/2026-10-21_bare_metal_bench/` | 2675a29a070fe5f58046f9303a3c70dfe21e2111a4ddeaef256e5126567b0a50 | 2675a29a070fe5f58046f9303a3c70dfe21e2111a4ddeaef256e5126567b0a50 |

Note: the Mac list has one extra `?? docs/2026-10-21_bare_metal_bench/` directory entry; all other porcelain lines are identical.

## Porcelain, both sides (identical except the last line of Mac)
22 modified (` M`): README.md; apps/core-server/src/config.ts; apps/core-server/src/modules/devices/__tests__/static.test.ts; apps/core-server/src/modules/devices/index.ts; apps/core-server/src/plugins/config/__tests__/load-config.test.ts; apps/core-server/src/plugins/config/load-config.ts; apps/core-server/test/static/imports.test.ts; apps/core-server/test/static/network.test.ts; apps/core-web/src/features/devices/devices.css; apps/core-web/src/features/devices/index.tsx; apps/core-web/src/i18n-web.ts; deploy/docker/.env.example; deploy/docker/Dockerfile; deploy/docker/README.md; deploy/docker/build-image.sh; deploy/docker/compose.isolated.yaml; deploy/docker/compose.yaml; deploy/docker/smoke-test.sh; packages/shared/openapi/openapi.json; packages/shared/src/api/capture-retire.ts; packages/shared/src/api/core-api.ts; packages/shared/src/api/index.ts.

Untracked (`??`, both): apps/core-server/src/lcd/; apps/core-web/src/features/devices/__tests__/lcd-connection.test.tsx; apps/core-web/src/features/devices/lcd-connection.tsx; apps/lcd-backend/; deploy/docker/build-installer.sh; deploy/docker/installer/; docs/2026-10-19_lcd_installer/; docs/2026-10-19_lcd_integration/; ffprobe-export.txt; packages/shared/src/api/lcd.ts.
Mac only: `?? docs/2026-10-21_bare_metal_bench/`.

## Differing paths
Code differences: none.
Docs-only differences (Mac has, host has not; this task's own folder, created after the 2026-10-21 copy): 12 files under `docs/2026-10-21_bare_metal_bench/` (01_backup_and_docker_removal.md, 02_host_wifi_outage_20261022.md, 03_deployment_check_20261022.md, README.md, decisions/decisions.md, delegation_progress/driver_rules.md, delegation_progress_report.md, gateway_check/01_gate_report.md, identification/01_original.md, 01_translated.md, 02_structured.md, status_tasks.md) at the moment of the hash run. Row outputs written later by other rows are also docs-only.
graft/: not in either untracked list.

## Untracked content hashes (identical both sides; 22 files)
Examples: packages/shared/src/api/lcd.ts (full) 100d8949fb4d50e4601a9fe37072ff44556c00e21f1c2bd3df8d7f564e114491); ffprobe-export.txt 8e3fd04a9d3f3728b73f1821d5213979970816f4f92b355ebc0ad95445665cf5; deploy/docker/installer/install.sh 9ef95673bfd191de9e19240971d968af8ec60b19dd6753122b7d93992bf165de (all 22 host hashes match the Mac hashes line for line in `diff` of the sorted `hash  path` lists; the only diff output was the 12 Mac-only docs lines).

## Limits
- Tracked-modified per-file hashes were not compared for all 22 files (the Mac-side per-file loop failed on BSD xargs); the identical `git diff HEAD --binary` hash covers them. Host per-file hashes of README.md and apps/core-server/src/config.ts also equal the Mac's (6fa26d68..., 03d37afe...).
- `git diff HEAD` does not cover files that are gitignored; ignored files were not compared (out of Q9 scope).
- Host reachable on first call; no retry needed. No write on either side.
