# explore, blueprint row 5: service and packaging coupling

- Status: complete
- Started and finished: 2026-10-04, about 01:15 to 01:40 local
- Output: `research/01e_explore_services_packaging.md` (Tier 2, 577 lines)
- Progress file: this file

## Milestones

1. Read `identification/02_structured.md` (rows, P1-P22, single-writer scan) and `01_translated.md` lines on the 0.1.0 packages.
2. Graft available (`graft map`, `graft skeleton`, `graft callers`); used for orientation and the `buildApp` caller list. Everything else by direct reads.
3. Read all of `apps/mock-core` (src, test, scripts, standalone launcher, manifests), `scripts/release/*` (headers, input roots, `--verify-inputs`, gate, writes), root `package.json`, `tsconfig.base.json`, `.gitignore`, `.npmrc`, `.node-version`, `.locks/` listing, `release/` listing and checksum files.
4. Read-only hash checks: `shasum -a 256 -c release/web/BUILD-INPUTS.txt` gave OK=748 FAILED=0 and a `find` of the 16 input roots found 0 added and 0 removed; the 6 web archives, the APK and the 7 licence files match their checksum files.
5. Wrote the output file; corrected 13 line-number or count slips found on a re-check against the sources.
6. Confirmed with `find -mmin -60` and `git status --porcelain` that nothing under `apps/`, `packages/`, `scripts/` or `release/` changed.

## Blockers

None.

## Decisions needed (for the controller; none made here)

- DN-1: how to read "0.1.0 sources must keep working unchanged" given that 8 of the 16 hash-pinned build-input roots are written by provisional rows (core-web src and package.json; shared src, openapi and package.json; THIRD_PARTY_NOTICES.md; root package.json; package-lock.json).
- DN-2: row 100 plans to add npm dependencies to `THIRD_PARTY_NOTICES.md`, whose line 3 says npm dependencies are not listed there.
- DN-3: `HealthResponseSchema` fixes `service` to `'dems-mock-core'`.
- DN-4: stale `user-manual-test` markers under `.locks/mock-core.users/` and `.locks/vite.users/`.
- DN-5: where the new CORS and socket origin lists live (`WEB_DEV_ORIGINS` is a build input and lacks 5178).
- DN-6: root `typecheck`, `lint`, `test` auto-run any new `apps/*` workspace; root `build` and `theme:gen` rewrite `packages/shared/theme/*`.

## Deviations from the row

- Ran `shasum` checks (read-only, about 1.1 GB read) instead of `--verify-inputs`, because the script starts Node with tsx and the instruction was to read the file and not run a build. The shasum plus `find` check is equivalent for changed, removed and added files.
- Graft refreshes its own cache under the git-ignored `graft/` folder when queried; nothing else was written.
- Created the `research/` folder (it did not exist).

## Files created or updated

- `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/research/01e_explore_services_packaging.md`
- `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/explore_step_5.md`
