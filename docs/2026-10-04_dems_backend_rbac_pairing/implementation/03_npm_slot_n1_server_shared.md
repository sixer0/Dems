---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 25
plan_row: W03
title: npm slot N1 (server, shared package, PostgreSQL binaries); early proof (b), trial steps T1 and T8
date: 2026-10-04
agent: coder-execution (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
evidence_tier: 3
status: needs-review
---

# W03: npm slot N1 (server, shared, PostgreSQL binaries)

All times are WIB (UTC+7) on 2026-10-04. Every command ran from `/Users/gsp-budi/Documents/DEMS`;
no command changed into a subfolder. Baseline for every comparison is commit `acaff20`.

## 1. Result

| Item | Result |
|---|---|
| Status | **needs-review** on one check only (section 9, check 3). Every deliverable exists and the six other checks pass |
| Why needs-review | `npm install-scripts ls` does not print an empty list. It lists 7 packages: 5 were already listed at the baseline, before this row changed anything, and 2 are new (two nested `esbuild` copies that `drizzle-kit` 0.31.11 brings). None of the 7 is approved. Their script does more than local file work, so this row may not approve it, and recording a denial is a controller decision (section 12, DN-1) |
| Trial T1 | PASS: install exit 0; lockfile diff additive; `native/lib/libicudata.77.dylib` exists after the approved script ran |
| Trial T8 | Recorded: registry signatures verified for 1,719 of 1,719 packages, none invalid, none missing; the script list is quoted in section 7.5 |
| Not done, by design | PostgreSQL was not started, `initdb` was not run, `.data/` was not created (W07 owns that) |

## 2. What was done, in order

| # | Time | Step | Evidence |
|---|---|---|---|
| 1 | until 06:33 | Read the binding documents; recorded the baseline of `npm install-scripts ls` and of the React tree; looked up the 13 pinned packages and `@types/pg` in the registry | sections 5.1, 7.5 |
| 2 | 06:33 | Rollback pre-image (P23): `.cache/rollback/W03.pre.patch`, 0 bytes, because no earlier writer exists | section 4 |
| 3 | 06:33 | `/.data/` appended to `.gitignore`, before any other edit | section 9, check 0 |
| 4 | 06:34 | Skeleton of `apps/core-server` (5 files), four placeholders and four export subpaths in `@dems/shared`, root scripts and root dev dependencies | section 4 |
| 5 | 06:35:00 | `npm install --ignore-scripts --dry-run` under the npm lock: "added 47 packages", exit 0, nothing written | |
| 6 | **06:35:40 to 06:35:56** | **Install window** (two commands under the npm lock, section 3) | section 9, check 1 |
| 7 | 06:36 | Read the install script and its symlink list; hashed both; checked all 17 entries; approved the one package by exact name | section 7 |
| 8 | 06:36:43 to 06:36:44 | `npm rebuild @embedded-postgres/darwin-arm64` under the npm lock: the approved script created 17 symlinks | section 7.4 |
| 9 | 06:37 | `npm audit signatures`, `npm audit` | sections 7.6, 7.7, Appendix A |
| 10 | 06:39 to 06:40 | Root typecheck, root lint, `@dems/core-server` unit project, `@dems/shared` suite | section 9 |
| 11 | 06:43 | Final check: hashes recomputed, `git check-ignore`, `git status`, npm lock free | section 9 |

## 3. Install window (P11)

| Window | Command | Result |
|---|---|---|
| 06:35:40 to 06:35:55 | `/usr/bin/lockf -k -t 3600 .locks/npm.lock npm install --ignore-scripts` | "added 47 packages, and audited 1729 packages in 15s", exit 0 |
| 06:35:55 to 06:35:56 | `/usr/bin/lockf -k -t 3600 .locks/npm.lock npm install --save-dev --save-exact --ignore-scripts @types/pg@8 -w @dems/core-server` | "added 1 package, and audited 1730 packages in 1s", exit 0 |
| 06:36:43 to 06:36:44 | `/usr/bin/lockf -k -t 3600 .locks/npm.lock npm rebuild @embedded-postgres/darwin-arm64` | "rebuilt dependencies successfully", exit 0; it wrote only 17 symlinks inside that package |

`node_modules` was rewritten once, between 06:35:40 and 06:35:56 (16 seconds). A typecheck or a test
of another row that failed inside that window may be repeated under P11. No existing package was
moved, removed or changed (section 6), so nothing outside that window can come from this row.

Both install commands and the two audit commands ran with the per-command sandbox bypass (P10):
inside the sandbox the registry answers `E502 Bad Gateway` through the proxy (quoted in section 11,
F-4). Everything else ran inside the sandbox.

## 4. Files written (the owned write paths of W03, nothing else)

| Path | Change | Content |
|---|---|---|
| `.gitignore` | modify, append only | One block of 4 lines at the end: `/.data/`, anchored |
| `package.json` | modify | 15 scripts appended after `test`; `devDependencies` with `embedded-postgres` 18.4.0-beta.17 and `pg` 8.23.1; one `allowScripts` entry added by `npm install-scripts approve` |
| `package-lock.json` | modify | 102 entries added, 0 removed, 0 existing entries changed (section 6) |
| `apps/core-server/package.json` | create | `@dems/core-server` 0.2.0, private, ESM; 13 scripts; 14 dependencies, 9 dev dependencies, all exact |
| `apps/core-server/tsconfig.json` | create | Extends `tsconfig.base.json`; `types: ["node"]`; includes `src`, `test`, `vitest.config.ts`, `drizzle.config.ts` |
| `apps/core-server/vitest.config.ts` | create | `maxWorkers: 2`; coverage with provider `v8`; projects `unit` and `db` |
| `apps/core-server/src/version.ts` | create | `CORE_SERVER_VERSION = '0.2.0'` |
| `apps/core-server/src/version.test.ts` | create | One test: the constant is 0.2.0 and equals the manifest's `version` |
| `packages/shared/package.json` | modify | Four export subpaths: `./client`, `./live`, `./live/source`, `./live/testing` |
| `packages/shared/src/client/index.ts` | create | One line: `export {};` with a comment naming the owner row W12 |
| `packages/shared/src/live/index.ts` | create | One line, owner row W18 |
| `packages/shared/src/live/source/index.ts` | create | One line, owner row W44 |
| `packages/shared/src/live/testing/index.ts` | create | One line, owner row W31 |

Outside the tracked tree, both git-ignored: `.cache/rollback/W03.pre.patch` (P23, 0 bytes) and the
npm cache. Under the task folder: this document and `delegation_progress/coder_execution_step_25.md`.

### 4.1 Scripts of `@dems/core-server` (names pinned by 02_plan §3.4)

| Script | Command |
|---|---|
| `dev`, `start` | `tsx watch src/index.ts`, `tsx src/index.ts` |
| `typecheck`, `lint` | `tsc --noEmit`, `oxlint` (needed by the root gate; same commands as mock-core) |
| `test` | `vitest run --project unit` |
| `test:db` | `vitest run --project db` |
| `coverage` | `vitest run --coverage` (both projects) |
| `db:create`, `db:migrate`, `db:status` | `tsx src/db/commands/create.ts`, `migrate.ts`, `status.ts` |
| `db:seed` | `tsx src/db/seed/cli.ts` |
| `db:reset` | `tsx src/db/reset/cli.ts` |
| `db:generate` | `drizzle-kit generate` |

The entry files of `dev`, `start` and the `db:*` scripts do not exist yet; their rows create them.
The manifest can be written only in an npm slot (P1), so the entry paths are fixed by this row
(section 12, DN-4).

### 4.2 Root scripts added

`dev:server`, `start:server`, `db:create`, `db:migrate`, `db:seed`, `db:reset`, `db:status`,
`test:db`: each is `npm run <name> -w @dems/core-server --` (the pattern of the existing `probe:ws`).
`pg:init`, `pg:start`, `pg:stop`, `pg:status`, `pg:remove-data`, `pg:remove`: each is
`node scripts/pg/<name>.mjs`. `test:pg-scripts` is `node --test scripts/pg/`. The directory form of
`node --test` was checked on Node 26.8.2 with a scratch folder outside the repository: it ran the
two `*.test.mjs` files, one of them in a subfolder, and did not run a plain `.mjs` file beside them.

## 5. Pins

### 5.1 New direct dependencies (02_plan §3.1, slot N1)

"Registry" is the answer of `npm view <name>@<version>` before the install. "Integrity" is the
lockfile value; for the 13 packages looked up beforehand it equals the registry's `dist.integrity`
(compared by script, 13 of 13 equal).

| Package | Version | Licence | Declared in | Lockfile integrity (sha512) |
|---|---|---|---|---|
| `embedded-postgres` | 18.4.0-beta.17 | MIT | root (dev) | `sha512-ORT/A1YiO6ecpRHpyIIBgyCR/8ASqqYZuFw11aX9PkqTX3FUM5+9sNOXY1mGIixxsm2TWSIA5WghJEk7A5ZxVw==` |
| `@embedded-postgres/darwin-arm64` (installed by the above) | 18.4.0-beta.17 | MIT | (optional dependency of the wrapper) | `sha512-Kg1ZMNFzkVIJs3g4V2UYEc5X005km9rGinxFBH8R1sOU2Rblvz4pt2Uf93Pu8Rk273Ue9HIdrbMPpgUqwjUi0Q==` |
| `pg` | 8.23.1 | MIT | `@dems/core-server`; root (dev) | `sha512-aL96AHANtWjPLDOLqnhx+ngp9+UK7ETEU8VJrDCGvsSSi/mGLcWYsS6Herg7lmaBJe4uwrfqsa7gTEFaSizDoQ==` |
| **`@types/pg`** | **8.23.1** (resolved from `@types/pg@8` with `--save-exact`; also the registry's `latest` and `ts6.0` tags) | **MIT** | `@dems/core-server` (dev) | `sha512-fKVHpikPdg4GKks3JuLEhvwSyvwzF23hnabPy6DD8ljVbC7+6J5dQzdv4arV6jqq57djnMgs1HKBxX4P8aBI3A==` |
| `drizzle-orm` | 0.45.3 | Apache-2.0 | `@dems/core-server` | `sha512-CAloER21cDdcgZ1OmjrZX82EeRNsdP+y0onX/eyoYDaYzki/adrAa91lzM5jWh7zZPK4qUbw/6LGv9J+A+uizA==` |
| `drizzle-kit` | 0.31.11 | MIT | `@dems/core-server` (dev) | `sha512-YCYqxTLIB2OCqf6w9/Vef13baBVbwQIPcbT4Y56AfO6B9ajZhDhD8Jkveg/hJvT/iuMloKD/IYYkyMMNhr7Kqg==` |
| `@fastify/cookie` | 11.1.2 | MIT | `@dems/core-server` | `sha512-Dtrpk/YOGUsbRMvP/8ZqPpwnMRv0qSqodFdoQ2B589Obc7jw4s4Qla+cV72Bsm7WsZJnqlYFX/i7uSBq0xzg6g==` |
| `@fastify/rate-limit` | 11.2.0 | MIT | `@dems/core-server` | `sha512-X7osJd4XSvMoejYrnJkSZYYjY1eNYoBqhjlzf1RakC2204qExFqZFTKj5+T7VuzA/iUI9Z3UoSqQRkB2HpG0oQ==` |
| `fastify-type-provider-zod` | 7.0.0 | MIT | `@dems/core-server` | `sha512-yUEKMyy+kml+4fzUU9GxVtYVKmPKNFo8OVd2N/RH2I/7JZiKvOqF1BUj3f/JJU3DDQDM7pMv2bf/Y8COPaxUWg==` |
| `@fastify/swagger` | 9.9.1 | MIT | `@dems/core-server` | `sha512-RlpdOjU6NC29799y5v0beSlmEu8spEbx7cYNzVaCCihEM0xh9hIdxSQDzom2U9W9ar0KuMA6JnXuFCrcuz9B5A==` |
| `openapi-types` | 12.1.3 | MIT | `@dems/core-server` | `sha512-N4YtSYJqghVu4iek2ZUvcN/0aqH1kRDuNqzcycDxhOUpg7GdvLa2F3DgS6yBNhInhv2r/6I0Flkn7CqL8+nIcw==` |
| `rate-limiter-flexible` | 11.2.1 | ISC | `@dems/core-server` | `sha512-JAaz01HZ893zAw+Hx5MdM1z3lLAkyVvNpqR+GNp0k3kjuQB8gY91fXhf5C0osWs+A7iKgFv585qzwmjS3aBHlA==` |
| `@vitest/coverage-v8` | 5.0.3 | MIT | `@dems/core-server` (dev) | `sha512-+klsyz7BvT1vCU28Zkfzms1Ia78XD0V41U3FUtRaa3S+vOr/EXvK1O6BvVD7l1RzEjm6SONR2aybOvDDf9u0mQ==` |
| `@fastify/helmet` | 13.1.1 | MIT | `@dems/core-server` | `sha512-bSat5DTq8geASv8G6P0KW1UbltZ+xGD/zyd9S72pT7ogAHehcsWL85GdjMRCjDsExJvaEvgEZ52qU/2HXirVCw==` |

Every version is the one 02_plan §3.1 names; none was substituted. Peer ranges read from the
registry: `fastify-type-provider-zod` 7.0.0 asks `fastify ^5.5.0`, `@fastify/swagger >=9.5.1`,
`openapi-types ^12.1.3`, `zod >=4.1.5`; `@vitest/coverage-v8` 5.0.3 asks `vitest 5.0.3`;
`drizzle-orm` 0.45.3 asks `pg >=8` and `@types/pg *` (both optional). All are met by the installed
pins. `engines` where declared: `node >=16`. `@types/pg` 8.23.1 declares `typeScriptVersion` 5.6 and
depends on `@types/node`, `pg-protocol` and `pg-types`.

### 5.2 Reused at their installed pins (02_plan §3.2)

Declared in the new manifest and resolved to the copy that was already hoisted; no second copy was
created (`apps/core-server/node_modules` holds no package):

`fastify` 5.12.5, `@fastify/websocket` 11.3.1, `ws` 8.22.0, `@types/ws` 8.18.2, `zod` 4.6.5,
`tsx` 4.23.15, `typescript` 6.0.3, `oxlint` 1.86.0, `@types/node` 26.6.3, `vitest` 5.0.3,
`@dems/shared` `*`.

## 6. Lockfile diff against `acaff20` (check 2)

Method: both lockfiles parsed and compared entry by entry (`git show acaff20:package-lock.json`
against the working file).

```
lockfileVersion 3 -> 3 | entries 1804 -> 1906
REMOVED entries: 0 []
CHANGED entries (same path, different content): 1
   "" version 0.1.0 -> 0.1.0 | differing keys: devDependencies
       devDependencies : undefined => {"embedded-postgres":"18.4.0-beta.17","pg":"8.23.1"}
ADDED entries: 102
existing entries keep their relative order: true
existing entries whose version, resolved or integrity changed: 0 of 1804
```

```
$ git diff --minimal --numstat acaff20 -- package-lock.json
1729	0	package-lock.json
```

The default `git diff --stat` prints "3822 insertions(+), 2064 deletions(-)" for the same file. That
is the diff heuristic, not removed content: with `--minimal` the diff is 1,729 inserted lines and no
deleted line, which agrees with the entry comparison.

**No existing package changed version** (0 of 1,804 entries differ in `version`, `resolved` or
`integrity`). The one changed entry is the root project itself, which gained its dev dependencies.

The 102 added entries: the workspace (`apps/core-server`) and its link (`node_modules/@dems/core-server`);
45 named packages (table below); and 55 optional platform entries that exist in the lockfile only
(7 other platforms of `@embedded-postgres/*` 18.4.0-beta.17, 26 of `@esbuild/*` 0.25.12 and 22 of
`@esbuild/*` 0.18.20; of these, only the two `@esbuild/darwin-arm64` copies are on disk).
On disk npm reported 47 + 1 = 48 added packages.

| Added package | Version | Licence | Required by |
|---|---|---|---|
| `embedded-postgres` | 18.4.0-beta.17 | MIT | root |
| `@embedded-postgres/darwin-arm64` | 18.4.0-beta.17 | MIT | `embedded-postgres` |
| `async-exit-hook` | 2.0.1 | MIT | `embedded-postgres` |
| `pg` | 8.23.1 | MIT | root, `@dems/core-server`, `drizzle-orm`, `embedded-postgres`, `pg-pool` |
| `pg-cloudflare` (optional) | 1.4.1 | MIT | `pg` |
| `pg-connection-string` | 2.14.1 | MIT | `pg` |
| `pg-pool` | 3.14.0 | MIT | `pg` |
| `pg-protocol` | 1.16.1 | MIT | `pg`, `@types/pg` |
| `pg-types` | 2.2.0 | MIT | `pg`, `@types/pg` |
| `pgpass` | 1.0.5 | MIT | `pg` |
| `pg-int8` | 1.0.1 | ISC | `pg-types` |
| `postgres-array` | 2.0.0 | MIT | `pg-types` |
| `postgres-bytea` | 1.0.1 | MIT | `pg-types` |
| `postgres-date` | 1.0.7 | MIT | `pg-types` |
| `postgres-interval` | 1.2.0 | MIT | `pg-types` |
| `xtend` | 4.0.2 | MIT | `postgres-interval` |
| **`@types/pg`** | **8.23.1** | MIT | `@dems/core-server`, `drizzle-orm` (optional peer) |
| `drizzle-orm` | 0.45.3 | Apache-2.0 | `@dems/core-server` |
| `drizzle-kit` | 0.31.11 | MIT | `@dems/core-server` |
| `@drizzle-team/brocli` | 0.10.2 | Apache-2.0 | `drizzle-kit` |
| `esbuild` (nested under `drizzle-kit`) | 0.25.12 | MIT | `drizzle-kit` |
| `@esbuild-kit/esm-loader` (deprecated) | 2.6.5 | MIT | `drizzle-kit` |
| `@esbuild-kit/core-utils` (deprecated) | 3.3.2 | MIT | `@esbuild-kit/esm-loader` |
| `esbuild` (nested under `@esbuild-kit/core-utils`) | 0.18.20 | MIT | `@esbuild-kit/core-utils` |
| `@fastify/cookie` | 11.1.2 | MIT | `@dems/core-server` |
| `cookie` (nested under `@fastify/cookie`) | 2.0.1 | MIT | `@fastify/cookie` |
| `@fastify/helmet` | 13.1.1 | MIT | `@dems/core-server` |
| `helmet` | 8.3.0 | MIT | `@fastify/helmet` |
| `@fastify/rate-limit` | 11.2.0 | MIT | `@dems/core-server` |
| `@lukeed/ms` | 2.0.2 | MIT | `@fastify/rate-limit` |
| `ip-address` | 10.7.3 | MIT | `@fastify/rate-limit` |
| `@fastify/swagger` | 9.9.1 | MIT | `@dems/core-server`, `fastify-type-provider-zod` |
| `json-schema-resolver` | 3.0.0 | MIT | `@fastify/swagger` |
| `fast-uri` (nested under `json-schema-resolver`) | 3.1.8 | BSD-3-Clause | `json-schema-resolver` |
| `openapi-types` | 12.1.3 | MIT | `@dems/core-server`, `@fastify/swagger`, `fastify-type-provider-zod` |
| `fastify-type-provider-zod` | 7.0.0 | MIT | `@dems/core-server` |
| `rate-limiter-flexible` | 11.2.1 | ISC | `@dems/core-server` |
| `@vitest/coverage-v8` | 5.0.3 | MIT | `@dems/core-server`, `vitest` (optional peer) |
| `@bcoe/v8-coverage` (nested) | 1.0.2 | MIT | `@vitest/coverage-v8` |
| `@vitest/istanbul-lib-coverage` | 1.0.2 | MIT | `@vitest/coverage-v8` |
| `@vitest/istanbul-lib-report` | 1.0.2 | MIT | `@vitest/coverage-v8` |
| `ast-v8-to-istanbul` | 1.0.7 | MIT | `@vitest/coverage-v8` |
| `js-tokens` (nested under `ast-v8-to-istanbul`) | 10.0.0 | MIT | `ast-v8-to-istanbul` |
| `magicast` | 0.5.5 | MIT | `@vitest/coverage-v8` |
| `tinyrainbow` | 3.2.0 | MIT | `@vitest/coverage-v8` |

Licences over the 102 entries: MIT 95, Apache-2.0 2, ISC 2, BSD-3-Clause 1, plus the workspace and
its link. Every added package is one of §3.1 or a dependency of one of §3.1.

## 7. Supply-chain records (SR-80, AC-B-91; SU-1 to SU-3; F21)

### 7.1 Order of events

The install ran with `--ignore-scripts`, so no dependency script could run before it was read. After
the install and before the approval the package held **0 symlinks**, and
`native/lib/libicudata.77.dylib` did not exist. The script was then read, hashed and checked, the
package was approved by exact name, and `npm rebuild` ran the script: **17 symlinks**.

### 7.2 SU-1: SHA-256 of what was read, and of what was installed

Computed with `shasum -a 256` at 06:36 (as read, before approval) and again at 06:43 (after the
script ran): the same five values both times.

| File (under `node_modules/@embedded-postgres/darwin-arm64/`) | Bytes | SHA-256 |
|---|--:|---|
| `scripts/hydrate-symlinks.js` (the install script) | 1,397 | `3596fdda55321a3672bd77bcaecf00d46462914409346ccfa1932a19c5977e11` |
| `native/pg-symlinks.json` (its symlink list) | 1,363 | `badbb4ed4901bcdc87c47e2f0e57778289e1e481bf7baf33e422e240a6e33e67` |
| `native/bin/postgres` | 19,458,112 | `515d8e4c690ecd6ae86074eedd5d6d0ed50df434b3743274085b9692f1e923f9` |
| `native/bin/initdb` | 440,656 | `b81069a19bcec5d2dd263f5c9bce2ce0b5075ae0f9b8a5c81b79f34bef503c39` |
| `native/bin/pg_ctl` | 245,792 | `2c37317f9f606d9716e493d6765ff14f84d8df9b8c07eaa722431de16446f071` |

The first two are the values W03 owes. The three binaries are W07's record under SU-1; they are
given here so that W07 can confirm that nothing changed between the install and provisioning.
The lockfile `integrity` values of the two packages are in section 5.1.

### 7.3 The install script: what was read

The package manifest declares one lifecycle script, `postinstall`, which runs
`node scripts/hydrate-symlinks.js`. Its `files` list ships that one script only; the `download`
script the manifest also names is not in the package. The script and the symlink list were printed
in full and read; neither holds a non-ASCII or control character.

The script text is third-party source and is not copied into this document. The SHA-256 above
identifies it exactly, and `cat node_modules/@embedded-postgres/darwin-arm64/scripts/hydrate-symlinks.js`
prints it. What it does, statement by statement:

1. It imports two Node core modules, `fs/promises` and `path`. Nothing else is imported or required.
2. It builds one path, `<current directory>/native/pg-symlinks.json`, and remembers the current
   directory. Under npm the current directory of a lifecycle script is the package folder.
3. It reads that file as UTF-8 and parses it as JSON. If the read or the parse fails, it continues
   with an empty list.
4. For each `{ source, target }` pair it takes the folder of `source`, makes both names relative to
   that folder, changes into the folder, creates one symbolic link (the call is
   "`await fs.symlink(relSource, relTarget);`"), ignores any error such as an existing file, and
   changes back.
5. It calls that one function and ends.

The symlink list, as read (17 pairs; every name is a plain file name inside `native/lib/`):

| Link created | Points to |
|---|---|
| `libcrypto.dylib` | `libcrypto.3.dylib` |
| `libedit.dylib` | `libedit.0.dylib` |
| `libicudata.77.dylib`, `libicudata.dylib` | `libicudata.77.1.dylib` |
| `libicui18n.77.dylib`, `libicui18n.dylib` | `libicui18n.77.1.dylib` |
| `libicuuc.77.dylib`, `libicuuc.dylib` | `libicuuc.77.1.dylib` |
| `liblz4.1.dylib`, `liblz4.dylib` | `liblz4.1.10.0.dylib` |
| `libpq.dylib` | `libpq.5.dylib` |
| `libssl.dylib` | `libssl.3.dylib` |
| `libxml2.dylib` | `libxml2.16.dylib` |
| `libz.1.dylib`, `libz.dylib` | `libz.1.3.2.dylib` |
| `libzstd.1.dylib`, `libzstd.dylib` | `libzstd.1.5.7.dylib` |

Checks run on the list before approval (a script over the parsed file):

```
entries: 17 | entries outside native/lib, with .. or absolute, with a missing source, or overwriting an existing file: 0
```

A search of the package's JavaScript (`scripts/hydrate-symlinks.js`, `dist/index.js`) for
`child_process`, `http`, `https`, `net`, `fetch(`, `eval(`, `Function(`, `process.env` and
`require(` found nothing. `dist/index.js` only exports the three binary paths.

**Assessment.** The script recreates symbolic links between library files that the package itself
ships, and does nothing else. Files touched: 17 new links, all inside `native/lib/` of its own
package folder; each points to a regular file in the same folder; none replaces an existing file.
Network access: none. Process start: none. Downloaded code: none; it reads one JSON file that came
in the same tarball, whose integrity hash is in the lockfile. Environment: not read. The one thing
the script trusts is the JSON list: a list with `..` or absolute paths would place links elsewhere.
The list as read has no such entry, its hash is recorded, and the approval is pinned to this exact
version, so a different list cannot arrive without a new review. This is within the rule of this
row ("recreating symlinks inside its own package folder"), so the package was approved.

### 7.4 The approval, and the proof that the approved script ran

```
$ /usr/bin/lockf -k -t 3600 .locks/npm.lock npm install-scripts approve @embedded-postgres/darwin-arm64
Approved @embedded-postgres/darwin-arm64:
  added @embedded-postgres/darwin-arm64@18.4.0-beta.17
exit=0

$ node -p 'JSON.stringify(require("./package.json").allowScripts)'
{"@shopify/react-native-skia@2.6.2":true,"@embedded-postgres/darwin-arm64@18.4.0-beta.17":true}

$ /usr/bin/lockf -k -t 3600 .locks/npm.lock npm rebuild @embedded-postgres/darwin-arm64
npm warn rebuild 7 packages have install scripts not yet covered by allowScripts. Run `npm install-scripts ls` to review.
rebuilt dependencies successfully
exit(npm rebuild)=0

$ npm install-scripts prune --dry-run
No unused allowScripts entries.
```

After the rebuild: 17 symbolic links in the package, the 17 of the list; none leaves `native/lib/`
and none dangles.

```
lrwxr-xr-x@ 1 gsp-budi  staff  21 Oct  4 06:36 node_modules/@embedded-postgres/darwin-arm64/native/lib/libicudata.77.dylib -> libicudata.77.1.dylib
```

That is the link issue #30 names (T1). The approval is one pinned entry for one package. `--all` was
not used, and no npm configuration was changed (SU-3).

### 7.5 `npm install-scripts ls` (T8, SU-3)

The command exists on npm 11.19.1 as `npm install-scripts ls` (`npm help install-scripts`).

Baseline, before this row changed anything (before 06:33):

```
5 packages have install scripts not yet covered by allowScripts:
  esbuild@0.28.2 (postinstall: node install.js)
  unrs-resolver@1.12.2 (postinstall: node postinstall.js)
  vue-demi@0.14.10 (postinstall: node -e "try{require('./scripts/postinstall.js')}catch(e){}")
  vue-demi@0.14.10 (postinstall: node -e "try{require('./scripts/postinstall.js')}catch(e){}")
  vue-demi@0.14.10 (postinstall: node -e "try{require('./scripts/postinstall.js')}catch(e){}")
```

After the install, before the approval: 8 (the 5 above, `@embedded-postgres/darwin-arm64@18.4.0-beta.17`,
`esbuild@0.25.12`, `esbuild@0.18.20`).

Final (06:38):

```
7 packages have install scripts not yet covered by allowScripts:
  esbuild@0.28.2 (postinstall: node install.js)
  unrs-resolver@1.12.2 (postinstall: node postinstall.js)
  vue-demi@0.14.10 (postinstall: node -e "try{require('./scripts/postinstall.js')}catch(e){}")
  esbuild@0.25.12 (postinstall: node install.js)
  esbuild@0.18.20 (postinstall: node install.js)
  vue-demi@0.14.10 (postinstall: node -e "try{require('./scripts/postinstall.js')}catch(e){}")
  vue-demi@0.14.10 (postinstall: node -e "try{require('./scripts/postinstall.js')}catch(e){}")

Run `npm install-scripts approve <pkg>` to allow, or `npm install-scripts deny <pkg>` to deny.
exit=0
```

| Entry | Origin | State |
|---|---|---|
| `esbuild@0.28.2`, `unrs-resolver@1.12.2`, `vue-demi@0.14.10` (three copies) | Present at the baseline; installed by the predecessor task | Not approved, not denied; not touched by this row |
| `esbuild@0.25.12` | New: direct dependency of `drizzle-kit` 0.31.11 | Not approved, not denied |
| `esbuild@0.18.20` | New: `drizzle-kit` → `@esbuild-kit/esm-loader` → `@esbuild-kit/core-utils` | Not approved, not denied |

The two new scripts were read as far as SU-3 asks (listed, read). `install.js` of both copies
(289 and 287 lines; SHA-256 `10f6fa3644d8d23d066ff67b0ae449074e75884503546a9fedb667f1dcb9ade2` and
`18f7ff75bb18580d3c63fcecee46b6d8c3872f01a46a86c2cddb87303378d281`) requires `child_process`, `https`,
`fs`, `os`, `path` and `zlib`, and holds fallback paths that run `npm install` or fetch from
`registry.npmjs.org`. That is more than local file work, so this row did not approve them. They are
not needed: both copies work with the script skipped, because the platform package
`@esbuild/darwin-arm64` is installed beside each (output condensed to one line per copy).

```
node_modules/drizzle-kit/node_modules/esbuild (0.25.12)   version 0.25.12 | transformSync -> "let x = 1;"
node_modules/@esbuild-kit/core-utils/node_modules/esbuild (0.18.20)   version 0.18.20 | transformSync -> "let x = 1;"
$ node_modules/.bin/drizzle-kit --version
drizzle-kit: v0.31.11
drizzle-orm: v0.45.3
```

### 7.6 `npm audit signatures` (M4, T8)

```
$ npm audit signatures
audited 1719 packages in 13s

1719 packages have verified registry signatures

401 packages have verified attestations
(use --json --include-attestations to view attestation details)
exit=0
```

With `--json --include-attestations`: `invalid` 0, `missing` 0, `verified` 401. Neither
`embedded-postgres` nor `@embedded-postgres/darwin-arm64` is among the 401: both have a verified
registry signature and **no provenance attestation**. Of the other direct pins, `drizzle-orm`,
`drizzle-kit`, `fastify-type-provider-zod` and `@vitest/coverage-v8` have an attestation. No
signature failed, so by TD-02 this is not a T1 failure; it closes gap G-05 as a recorded fact.

### 7.7 `npm audit` (SU-2)

```
80 vulnerabilities (5 low, 25 moderate, 50 high)
exit=1
```

The full output is Appendix A. Read against the lockfile comparison (JSON form of the same audit):

| Group | Entries | Severity | Root cause |
|---|--:|---|---|
| On packages added by this row | 4 | 4 moderate | One advisory, GHSA-67mh-4wv8-2f99, on `esbuild` 0.18.20 (range `<=0.24.2`: its development server answers requests from any website). The three other entries are the chain above it: `@esbuild-kit/core-utils`, `@esbuild-kit/esm-loader`, `drizzle-kit` |
| On packages that were already installed at `acaff20` | 76 | 5 low, 21 moderate, 50 high | Six packages with an advisory of their own (`@ai-sdk/provider-utils`, `braces`, `decode-uri-component`, `node-forge`, `undici`, `uuid`) and 70 entries that depend on them |

The block for the new entries, verbatim:

```
esbuild  <=0.24.2
Severity: moderate
esbuild enables any website to send any requests to the development server and read the response - https://github.com/advisories/GHSA-67mh-4wv8-2f99
fix available via `npm audit fix --force`
Will install drizzle-kit@0.18.1, which is a breaking change
node_modules/@esbuild-kit/core-utils/node_modules/esbuild
  @esbuild-kit/core-utils  *
  Depends on vulnerable versions of esbuild
  node_modules/@esbuild-kit/core-utils
    @esbuild-kit/esm-loader  *
    Depends on vulnerable versions of @esbuild-kit/core-utils
    node_modules/@esbuild-kit/esm-loader
      drizzle-kit  0.19.0 - 1.0.0-beta.1-fd8bfcc
      Depends on vulnerable versions of @esbuild-kit/esm-loader
      node_modules/drizzle-kit
```

`npm audit fix` was not run. The install summary of 06:35:55 printed a different total for the same
tree ("84 vulnerabilities (5 low, 25 moderate, 54 high)"); the `npm audit` figure is the one recorded.

## 8. The binaries are present and executable (no server start)

```
$ B=node_modules/@embedded-postgres/darwin-arm64/native/bin
$ $B/postgres --version
postgres (PostgreSQL) 18.4
$ $B/initdb --version
initdb (PostgreSQL) 18.4
$ $B/pg_ctl --version
pg_ctl (PostgreSQL) 18.4
```

Each exit code is 0. The three files are Mach-O universal binaries (x86_64 and arm64), mode 0755.
The package is 145 MB on disk. A version print starts no server: `.data/` does not exist, and
nothing was bound.

## 9. Verification

### Check 0: `.gitignore` before anything else

```
$ git diff acaff20 -- .gitignore
@@ -63,3 +63,8 @@ coverage/
 # packager sources in scripts/release/ (step 95).
 /release/
 apps/mobile/signing/
+
+# Project-local PostgreSQL (backend task 2026-10-04, plan W03 / W07; SR-60, AC-B-64):
+# the cluster, the server log and the three credential files. Never version them.
+# `/.data/` is anchored to the repo root, like `/release/` above.
+/.data/

$ git check-ignore -v .data/postgres .data/pg.pwfile .data/pg.env .data/pg.owner.env
.gitignore:70:/.data/	.data/postgres
.gitignore:70:/.data/	.data/pg.pwfile
.gitignore:70:/.data/	.data/pg.env
.gitignore:70:/.data/	.data/pg.owner.env
exit=0
```

Append only: 5 lines added, none removed or moved. The rule is anchored: `apps/core-server/.data/x`
is not ignored by it (`git check-ignore` exit 1).

### Check 1: `npm install` exits 0. PASS

```
INSTALL WINDOW START: 2026-10-04 06:35:40 WIB
npm warn deprecated @esbuild-kit/esm-loader@2.6.5: Merged into tsx: https://tsx.hirok.io
npm warn deprecated @esbuild-kit/core-utils@3.3.2: Merged into tsx: https://tsx.hirok.io

added 47 packages, and audited 1729 packages in 15s
exit(npm install)=0
STEP 1 END: 2026-10-04 06:35:55 WIB

added 1 package, and audited 1730 packages in 1s
exit(npm install @types/pg)=0
INSTALL WINDOW END: 2026-10-04 06:35:56 WIB
```

### Check 2: lockfile diff holds only slot N1 and its dependencies. PASS

Section 6. `@types/pg` resolved to **8.23.1**. No existing package changed version.

### Check 3: `npm install-scripts ls` prints no unreviewed script. NOT MET as written

Section 7.5. The one approval is shown in section 7.4. The list is not empty: 5 entries predate this
row and 2 are new. None is approved. Decision DN-1.

### Check 4: one copy of React and of React DOM. PASS

```
$ npm ls react react-dom --all        (exit 0; tally of the react and react-dom nodes of the tree)
  44 react-dom@19.2.3 deduped
   1 react-dom@19.2.3 overridden
 115 react@19.2.3 deduped
   1 react@19.2.3 overridden
```

On disk and in the lockfile there is one of each: `node_modules/react` 19.2.3 and
`node_modules/react-dom` 19.2.3. The new workspace does not appear in that tree.

### Check 5: typecheck, lint, tests. PASS

Condensed to one line per workspace; nothing else was printed.

```
$ npm run typecheck        (06:39:03 to 06:39:16)
> @dems/shared@0.1.0 typecheck        > tsc --noEmit
> @dems/core-server@0.2.0 typecheck   > tsc --noEmit
> @dems/core-web@0.1.0 typecheck      > tsc -b
> @dems/mobile@0.1.0 typecheck        > tsc --noEmit
> @dems/mock-core@0.1.0 typecheck     > tsc --noEmit
exit(npm run typecheck)=0

$ npm run lint             (06:39:20 to 06:39:29)
> @dems/shared@0.1.0 lint        > oxlint
> @dems/core-server@0.2.0 lint   > oxlint
> @dems/core-web@0.1.0 lint      > oxlint
> @dems/mobile@0.1.0 lint        > eslint .
> @dems/mock-core@0.1.0 lint     > oxlint
exit(npm run lint)=0

$ npm run test -w @dems/core-server -- --maxWorkers=2
> vitest run --project unit --maxWorkers=2
 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/core-server
 Test Files  1 passed (1)
      Tests  1 passed (1)
exit=0

$ npm run test -w @dems/shared -- --maxWorkers=2
> vitest run --maxWorkers=2
 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/packages/shared
 Test Files  28 passed (28)
      Tests  508 passed (508)
exit=0
```

The four subpaths resolve and load:

```
@dems/shared/client -> packages/shared/src/client/index.ts          exports: 0
@dems/shared/live -> packages/shared/src/live/index.ts              exports: 0
@dems/shared/live/source -> packages/shared/src/live/source/index.ts    exports: 0
@dems/shared/live/testing -> packages/shared/src/live/testing/index.ts  exports: 0
```

Not run by this row: the suites of `@dems/core-web`, `@dems/mobile` and `@dems/mock-core`. This row
wrote none of those workspaces, their lockfile entries are unchanged, and two other rows were
editing `apps/core-web` at the time.

### Check 6: `git status --porcelain`. PASS

```
 M .gitignore
 M package-lock.json
 M package.json
 M packages/shared/package.json
?? apps/core-server/package.json
?? apps/core-server/src/version.test.ts
?? apps/core-server/src/version.ts
?? apps/core-server/tsconfig.json
?? apps/core-server/vitest.config.ts
?? packages/shared/src/client/index.ts
?? packages/shared/src/live/index.ts
?? packages/shared/src/live/source/index.ts
?? packages/shared/src/live/testing/index.ts
```

Also listed, and **not written by this row**: `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx`
and `apps/core-web/src/test/sim-fetch.test.ts` (the two test files of W01);
`apps/core-web/vite.config.ts` (W05); and files under the task folder written by the controller and
by other rows (`decisions/decisions.md`, `delegation_progress_report.md`, `status_tasks.md`,
`delegation_progress/coder_execution_step_23.md`, `_24.md`, `_26.md`, `git_specialist_step_22.md`,
`verifier_step_28.md`, `initialization/01_env_check.md`, `initialization/05_emulator_cold_boot.md`,
`implementation/`). `git status --porcelain -- apps/mock-core release scripts/release packages/shared/src/sim packages/shared/src/demo-data packages/shared/assets apps/mobile`
prints nothing. The npm lock is free (`/usr/bin/lockf -k -t 0 .locks/npm.lock true` exits 0). This
row started no process that is still running.

### Check 7: test ledger (P24)

| Workspace | Before | After | New test file |
|---|---|---|---|
| `@dems/shared` | 508 tests in 28 files (baseline of row 13, `initialization/02_baseline_gate.md`; not re-measured by this row before its edit) | 508 passed in 28 files (measured, 06:40) | none |
| `@dems/core-server`, project `unit` | the workspace did not exist | 1 passed in 1 file | `apps/core-server/src/version.test.ts` |
| `@dems/core-server`, project `db` | the workspace did not exist | 0 tests in 0 files | none |
| `@dems/core-web`, `@dems/mobile`, `@dems/mock-core` | not written, not run | not written, not run | none |

Ledger addition from this row: `@dems/core-server` `unit` +1 test, +1 file.

## 10. The root gate needs no database (GR-1, AC-B-58): how

1. The root `test` script is `npm run test --workspaces --if-present`. In the new workspace `test`
   is `vitest run --project unit`. The project `db` runs only through `test:db`.
2. The file layout of 02_plan §3.4 is in the config: `db` takes `*.db.test.ts` under `src/` and
   `test/`, and everything under `test/acceptance/`; `unit` takes every other `*.test.ts` and
   excludes those patterns.
3. The global setup of the database tests (`test/global-setup.db.ts`, owned by W11) is attached to
   the project `db` only, so a `unit` run does not load it.

Evidence, with the real config and a scratch layout outside the repository
(`vitest list --filesOnly --root <scratch> --config apps/core-server/vitest.config.ts`):

```
== project unit
[unit] src/a.test.ts
[unit] src/modules/identity/__tests__/b.test.ts
[unit] test/static/d.test.ts
== project db
[db] src/db/seed/c.db.test.ts
[db] test/acceptance/g.test.ts
[db] test/acceptance/pairing/h.test.ts
[db] test/db/e.db.test.ts
[db] test/helpers/db/f.db.test.ts
```

In the repository today: `vitest list --project unit --filesOnly` prints `[unit] src/version.test.ts`
and the same command for `db` prints nothing.

The project `db` fails and does not skip. Today `npm run test:db -w @dems/core-server` exits 1
("No test files found"). With a database test present and no global setup file (scratch layout) it
exits 1 with "Failed to load url .../test/global-setup.db.ts". Reaching PostgreSQL is W11's part.

## 11. Findings

| ID | Finding | Evidence |
|---|---|---|
| F-1 | `@types/pg` resolved to 8.23.1, MIT. It closes GP-01 | section 5.1 |
| F-2 | `npm rebuild <package>` runs an approved install script on npm 11.19.1 (a hypothesis of TD-02). Assumption AS-09 is confirmed for `rebuild` only: the install itself ran with `--ignore-scripts`, so the default behaviour of `npm install` towards an unapproved script was not observed | section 7.4 |
| F-3 | `embedded-postgres` and its platform package have a verified registry signature and no provenance attestation (closes G-05) | section 7.6 |
| F-4 | Inside the sandbox the registry is not reachable: `npm view @types/pg` answers `npm error 502 Bad Gateway - GET https://registry.npmjs.org/@types%2fpg`. Lookups, installs and audits need the per-command bypass. No ownership problem exists and no `sudo` or `chown` was run (F10 stands) | section 3 |
| F-5 | `npm install-scripts ls` already listed 5 packages at the baseline. The predecessor left them unapproved and the stack works without them | section 7.5 |
| F-6 | `drizzle-kit` 0.31.11 brings two more `esbuild` copies with an install script (0.25.12, 0.18.20), two deprecated packages (`@esbuild-kit/esm-loader` 2.6.5, `@esbuild-kit/core-utils` 3.3.2: "Merged into tsx") and one moderate advisory on the 0.18.20 copy | sections 6, 7.5, 7.7 |
| F-7 | `npm audit` reports 76 entries (50 high) on packages that were installed before this task. The predecessor's security verification recorded "1 high" (`docs/2026-09-30_dems_demo_stack_setup/verification/02_security.md:275`). No package of that set changed in this row, so the difference is not caused by it; the cause was not investigated here | section 7.7, Appendix A |
| F-8 | One transitive licence outside the set the plan names for chosen packages: `fast-uri` 3.1.8, BSD-3-Clause (under `json-schema-resolver`, from `@fastify/swagger`). `@drizzle-team/brocli` 0.10.2 is Apache-2.0 | section 6 |
| F-9 | The platform package holds universal binaries (x86_64 and arm64) and is 145 MB on disk; the lockfile also lists the 7 other platform packages as optional entries | sections 6, 8 |
| F-10 | The default `git diff --stat` overstates the lockfile change (3,822 and 2,064 lines); `--minimal` shows 1,729 insertions and 0 deletions | section 6 |
| F-11 | `node --test scripts/pg/` (directory form) works on Node 26.8.2 | section 4.2 |
| F-12 | On a checkout where `npm install` runs without `--ignore-scripts`, the approved entry lets npm run the script during the install. If scripts were skipped, `npm rebuild @embedded-postgres/darwin-arm64` creates the links. Input for the README row (W86); the first sentence is npm's documented behaviour and was not executed here | `npm help install-scripts` |

## 12. Deviations and decisions for the controller

### Deviations from the row text

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | Both install commands carried `--ignore-scripts` | So that no dependency script could run before it was read, whichever way npm treats an unapproved script (AS-09). No workspace manifest has a lifecycle install script, so nothing else was skipped |
| DV-2 | Two install commands, not one | The second resolves `@types/pg@8` with `--save-exact`, as D17 asks. Both ran inside one 16-second window |
| DV-3 | The install script is described statement by statement and identified by its SHA-256; its text is not copied into this document | It is third-party source. The hash pins the exact text and one command prints it (section 7.3). The symlink list, which is data, is given in full |
| DV-4 | Check 3 is not met as written | Section 7.5; decision DN-1 |
| DV-5 | `.cache/rollback/W03.pre.patch` was written although it is not in the row's path list | P23 asks for it; it is empty and git-ignored |
| DV-6 | The shared tracking files (`masterplan/02_plan.md`, `status_tasks.md`, `implementation/99_implementation_report.md`) were not written | Parallel run: the controller writes them (CLAUDE.md §3.4, P8) |

### Decisions needed

| ID | Question | Options | Recommendation |
|---|---|---|---|
| DN-1 | The 7 packages that `npm install-scripts ls` still lists | (A) Record a denial by name: `/usr/bin/lockf -k -t 3600 .locks/npm.lock npm install-scripts deny esbuild unrs-resolver vue-demi`. It writes three name-only `false` entries, changes no behaviour (the scripts are skipped today), empties the list and keeps a later `approve --all` from taking them. It is a write to the root manifest, so it belongs to an npm slot. (B) Leave them as they are and read check 3 as "no approval other than the reviewed one"; TD-02 already calls T8 "recorded, not gating". (C) Approve `esbuild` by exact version | (A) or (B). Not (C): the script can start processes and reach the registry, and nothing needs it |
| DN-2 | The moderate advisory GHSA-67mh-4wv8-2f99 on the nested `esbuild` 0.18.20 | Accept, or leave `drizzle-kit` for the fallback of TD-03 | Accept and record: `drizzle-kit` is a development tool used by `db:generate` only, and no esbuild development server runs in this project. The fix npm offers is a downgrade to `drizzle-kit` 0.18.1 |
| DN-3 | The 76 audit entries on packages of the predecessor task (F-7) | Route to the security rows (W99) | Out of scope for W03; recorded with the full output so that W99 has the starting point |
| DN-4 | Entry paths of the workspace scripts, fixed by this row because no later row may edit the manifest | `src/index.ts` (W08); `src/db/commands/create.ts`, `migrate.ts`, `status.ts` (W17); `src/db/seed/cli.ts` (W20); `src/db/reset/cli.ts` (W29); global setup `test/global-setup.db.ts` (W11); `drizzle.config.ts` at the workspace root (W17) | Pass these paths to W08, W11, W17, W20 and W29. Each lies inside the folder its row owns |
| DN-5 | `fast-uri` 3.1.8 is BSD-3-Clause (F-8) | Note it in the notices row (W85) | Record |

## 13. Rollback: H-01 (02_plan §14.3, verbatim; not executed)

```sh
# Variables
ROOT=/Users/gsp-budi/Documents/DEMS
PGBIN="$ROOT/node_modules/@embedded-postgres/darwin-arm64/native/bin"
PGDATA="$ROOT/.data/postgres"

# RB-01  remove the PostgreSQL binary package and the root driver (after RB-02)
/usr/bin/lockf -k -t 3600 "$ROOT/.locks/npm.lock" npm uninstall embedded-postgres pg
npm install-scripts prune            # drops the allowScripts entry of the binary package
# RB-02 followed by RB-01 is what "npm run pg:remove" runs.
```

For the tracked files of this row (02_plan §14.3, last paragraph; not executed):
`git checkout acaff20 -- .gitignore package.json package-lock.json packages/shared/package.json`,
removal of `apps/core-server`, `packages/shared/src/client` and `packages/shared/src/live`, then one
`npm install` under the npm lock. The pre-image `.cache/rollback/W03.pre.patch` is empty, because
this row is the first writer of every path it shares.

---
## Appendix A. `npm audit` output, verbatim (SU-2)

Run at 06:37 WIB on 2026-10-04 from the workspace root, after the install and the approval; exit code 1.
It is the command output, copied by the shell and not retyped.

```text
# npm audit report

@ai-sdk/provider-utils  4.0.0-beta.10 - 4.0.32
@ai-sdk/provider-utils has an Uncontrolled Resource Consumption issue - https://github.com/advisories/GHSA-866g-f22w-33x8
fix available via `npm audit fix --force`
Will install @scalar/api-reference-react@0.8.36, which is a breaking change
node_modules/@ai-sdk/provider-utils
  @ai-sdk/gateway  <=0.0.0-98261322-20260122142521 || 1.1.0-beta.0 - 2.0.0-beta.93 || 3.0.0 - 3.0.138
  Depends on vulnerable versions of @ai-sdk/provider-utils
  node_modules/@ai-sdk/gateway
    ai  <=0.0.0-fd764a60-20260114143805 || 5.1.0-beta.0 - 6.0.213 || 7.0.0-beta.0 - 7.0.0-beta.1-gr2m-test
    Depends on vulnerable versions of @ai-sdk/gateway
    Depends on vulnerable versions of @ai-sdk/provider-utils
    node_modules/ai
      @ai-sdk/vue  <=0.0.0-fd764a60-20260114143805 || 2.1.0-beta.0 - 3.0.213
      Depends on vulnerable versions of @ai-sdk/provider-utils
      Depends on vulnerable versions of ai
      node_modules/@ai-sdk/vue
        @scalar/agent-chat  0.1.2 || >=0.2.5
        Depends on vulnerable versions of @ai-sdk/vue
        Depends on vulnerable versions of @scalar/api-client
        Depends on vulnerable versions of @scalar/json-magic
        Depends on vulnerable versions of @scalar/workspace-store
        Depends on vulnerable versions of ai
        node_modules/@scalar/agent-chat
          @scalar/api-reference  >=1.44.0
          Depends on vulnerable versions of @scalar/agent-chat
          Depends on vulnerable versions of @scalar/api-client
          Depends on vulnerable versions of @scalar/blocks
          Depends on vulnerable versions of @scalar/oas-utils
          Depends on vulnerable versions of @scalar/openapi-to-markdown
          Depends on vulnerable versions of @scalar/sidebar
          Depends on vulnerable versions of @scalar/workspace-store
          node_modules/@scalar/api-reference
            @scalar/api-reference-react  >=0.8.37
            Depends on vulnerable versions of @scalar/api-reference
            node_modules/@scalar/api-reference-react

braces  *
Severity: high
braces vulnerable to stack-exhaustion denial of service through deeply nested patterns - https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
fix available via `npm audit fix --force`
Will install expo@44.0.6, which is a breaking change
node_modules/braces
  micromatch  >=0.2.0
  Depends on vulnerable versions of braces
  node_modules/micromatch
    @expo/metro-file-map  *
    Depends on vulnerable versions of micromatch
    node_modules/@expo/metro-file-map
      @expo/cli  <=0.0.0-canary-20231123-1b19f96-4 || >=0.0.1-canary-20231125-d600e44
      Depends on vulnerable versions of @expo/code-signing-certificates
      Depends on vulnerable versions of @expo/config
      Depends on vulnerable versions of @expo/config-plugins
      Depends on vulnerable versions of @expo/inline-modules
      Depends on vulnerable versions of @expo/metro
      Depends on vulnerable versions of @expo/metro-config
      Depends on vulnerable versions of @expo/metro-file-map
      Depends on vulnerable versions of @expo/prebuild-config
      Depends on vulnerable versions of node-forge
      node_modules/@expo/cli
        expo  >=45.0.0-beta.1
        Depends on vulnerable versions of @expo/cli
        Depends on vulnerable versions of @expo/config
        Depends on vulnerable versions of @expo/config-plugins
        Depends on vulnerable versions of @expo/local-build-cache-provider
        Depends on vulnerable versions of @expo/metro
        Depends on vulnerable versions of @expo/metro-config
        node_modules/expo
    @jest/core  <=30.2.0
    Depends on vulnerable versions of @jest/console
    Depends on vulnerable versions of @jest/reporters
    Depends on vulnerable versions of @jest/test-result
    Depends on vulnerable versions of @jest/transform
    Depends on vulnerable versions of jest-config
    Depends on vulnerable versions of jest-haste-map
    Depends on vulnerable versions of jest-message-util
    Depends on vulnerable versions of jest-resolve
    Depends on vulnerable versions of jest-resolve-dependencies
    Depends on vulnerable versions of jest-runner
    Depends on vulnerable versions of jest-runtime
    Depends on vulnerable versions of jest-snapshot
    Depends on vulnerable versions of jest-watcher
    Depends on vulnerable versions of micromatch
    node_modules/@jest/core
      jest  24.2.0-alpha.0 - 30.2.0
      Depends on vulnerable versions of @jest/core
      Depends on vulnerable versions of jest-cli
      node_modules/jest
        jest-watch-typeahead  0.6.0 - 2.2.2
        Depends on vulnerable versions of jest
        Depends on vulnerable versions of jest-watcher
        node_modules/jest-watch-typeahead
          jest-expo  >=33.0.0-rc.0
          Depends on vulnerable versions of @jest/globals
          Depends on vulnerable versions of @react-native/jest-preset
          Depends on vulnerable versions of babel-jest
          Depends on vulnerable versions of jest-environment-jsdom
          Depends on vulnerable versions of jest-snapshot
          Depends on vulnerable versions of jest-watch-typeahead
          node_modules/jest-expo
      jest-cli  23.5.0 - 30.2.0
      Depends on vulnerable versions of @jest/core
      Depends on vulnerable versions of @jest/test-result
      Depends on vulnerable versions of create-jest
      Depends on vulnerable versions of jest-config
      node_modules/jest-cli
    @jest/transform  <=30.2.0
    Depends on vulnerable versions of jest-haste-map
    Depends on vulnerable versions of micromatch
    node_modules/@jest/transform
      @jest/reporters  <=30.2.0
      Depends on vulnerable versions of @jest/console
      Depends on vulnerable versions of @jest/test-result
      Depends on vulnerable versions of @jest/transform
      Depends on vulnerable versions of jest-message-util
      node_modules/@jest/reporters
      babel-jest  24.2.0-alpha.0 - 30.2.0
      Depends on vulnerable versions of @jest/transform
      node_modules/babel-jest
        @react-native/jest-preset  *
        Depends on vulnerable versions of babel-jest
        Depends on vulnerable versions of jest-environment-node
        node_modules/@react-native/jest-preset
          react-native  >=0.73.0-nightly-20230506-1af868c52
          Depends on vulnerable versions of @react-native/community-cli-plugin
          Depends on vulnerable versions of @react-native/jest-preset
          Depends on vulnerable versions of @react-native/virtualized-lists
          node_modules/react-native
            @react-native/virtualized-lists  0.85.0-nightly-20260108-1236b6be4 - 0.87.0-rc.4
            Depends on vulnerable versions of react-native
            node_modules/@react-native/virtualized-lists
        jest-config  18.1.0 - 18.5.0-alpha.7da3df39 || 23.5.0 - 30.2.0
        Depends on vulnerable versions of @jest/test-sequencer
        Depends on vulnerable versions of babel-jest
        Depends on vulnerable versions of jest-circus
        Depends on vulnerable versions of jest-environment-node
        Depends on vulnerable versions of jest-resolve
        Depends on vulnerable versions of jest-runner
        Depends on vulnerable versions of micromatch
        node_modules/jest-config
          create-jest  29.7.0 - 30.2.0
          Depends on vulnerable versions of jest-config
          node_modules/create-jest
      jest-runner  21.0.0-alpha.1 - 30.2.0
      Depends on vulnerable versions of @jest/console
      Depends on vulnerable versions of @jest/environment
      Depends on vulnerable versions of @jest/test-result
      Depends on vulnerable versions of @jest/transform
      Depends on vulnerable versions of jest-environment-node
      Depends on vulnerable versions of jest-haste-map
      Depends on vulnerable versions of jest-message-util
      Depends on vulnerable versions of jest-resolve
      Depends on vulnerable versions of jest-runtime
      Depends on vulnerable versions of jest-watcher
      node_modules/jest-runner
      jest-runtime  18.1.0 - 30.2.0
      Depends on vulnerable versions of @jest/environment
      Depends on vulnerable versions of @jest/fake-timers
      Depends on vulnerable versions of @jest/globals
      Depends on vulnerable versions of @jest/test-result
      Depends on vulnerable versions of @jest/transform
      Depends on vulnerable versions of jest-haste-map
      Depends on vulnerable versions of jest-message-util
      Depends on vulnerable versions of jest-resolve
      Depends on vulnerable versions of jest-snapshot
      node_modules/jest-runtime
        jest-circus  20.1.0-alpha.1 - 30.2.0
        Depends on vulnerable versions of @jest/environment
        Depends on vulnerable versions of @jest/expect
        Depends on vulnerable versions of @jest/test-result
        Depends on vulnerable versions of jest-message-util
        Depends on vulnerable versions of jest-runtime
        Depends on vulnerable versions of jest-snapshot
        node_modules/jest-circus
      jest-snapshot  23.3.0 - 30.2.0
      Depends on vulnerable versions of @jest/transform
      Depends on vulnerable versions of expect
      Depends on vulnerable versions of jest-message-util
      node_modules/jest-snapshot
        @jest/expect  <=30.2.0
        Depends on vulnerable versions of expect
        Depends on vulnerable versions of jest-snapshot
        node_modules/@jest/expect
          @jest/globals  <=30.2.0
          Depends on vulnerable versions of @jest/environment
          Depends on vulnerable versions of @jest/expect
          node_modules/@jest/globals
        jest-resolve-dependencies  27.0.0-next.0 - 30.2.0
        Depends on vulnerable versions of jest-snapshot
        node_modules/jest-resolve-dependencies
    jest-haste-map  18.1.0 - 30.2.0
    Depends on vulnerable versions of micromatch
    node_modules/jest-haste-map
      @jest/test-sequencer  <=30.2.0
      Depends on vulnerable versions of @jest/test-result
      Depends on vulnerable versions of jest-haste-map
      node_modules/@jest/test-sequencer
      jest-resolve  18.1.0 - 19.0.2 || 24.2.0-alpha.0 - 24.5.0 || 27.1.0 - 30.2.0
      Depends on vulnerable versions of jest-haste-map
      node_modules/jest-resolve
    jest-message-util  18.5.0-alpha.7da3df39 - 30.2.0
    Depends on vulnerable versions of micromatch
    node_modules/jest-message-util
      @jest/console  25.4.0 - 30.2.0
      Depends on vulnerable versions of jest-message-util
      node_modules/@jest/console
        @jest/test-result  25.4.0 - 30.2.0
        Depends on vulnerable versions of @jest/console
        node_modules/@jest/test-result
          jest-watcher  25.4.0 - 30.2.0
          Depends on vulnerable versions of @jest/test-result
          node_modules/jest-watcher
      @jest/fake-timers  <=30.2.0
      Depends on vulnerable versions of jest-message-util
      node_modules/@jest/fake-timers
        @jest/environment  <=30.2.0
        Depends on vulnerable versions of @jest/fake-timers
        node_modules/@jest/environment
          jest-environment-jsdom  24.2.0-alpha.0 - 30.2.0
          Depends on vulnerable versions of @jest/environment
          Depends on vulnerable versions of @jest/fake-timers
          node_modules/jest-environment-jsdom
          jest-environment-node  24.2.0-alpha.0 - 30.2.0
          Depends on vulnerable versions of @jest/environment
          Depends on vulnerable versions of @jest/fake-timers
          node_modules/jest-environment-node
      expect  21.0.0-beta.1 - 30.2.0
      Depends on vulnerable versions of jest-message-util
      node_modules/expect
    metro-file-map  *
    Depends on vulnerable versions of micromatch
    node_modules/metro-config/node_modules/metro-file-map
    node_modules/metro-file-map
      @expo/metro  *
      Depends on vulnerable versions of metro
      Depends on vulnerable versions of metro-config
      Depends on vulnerable versions of metro-file-map
      Depends on vulnerable versions of metro-transform-worker
      node_modules/@expo/metro
        @expo/metro-config  <=0.0.1-canary-20240418-8d74597 || >=0.1.49-alpha.0
        Depends on vulnerable versions of @expo/config
        Depends on vulnerable versions of @expo/metro
        node_modules/@expo/metro-config
      metro  >=0.71.0
      Depends on vulnerable versions of metro-config
      Depends on vulnerable versions of metro-file-map
      Depends on vulnerable versions of metro-transform-worker
      node_modules/metro
      node_modules/metro-config/node_modules/metro
        @react-native/community-cli-plugin  *
        Depends on vulnerable versions of @react-native/metro-config
        Depends on vulnerable versions of metro
        Depends on vulnerable versions of metro-config
        node_modules/@react-native/community-cli-plugin
        metro-config  >=0.71.0
        Depends on vulnerable versions of metro
        node_modules/@expo/metro/node_modules/metro-config
        node_modules/metro-config
        node_modules/metro/node_modules/metro-config
          @react-native/metro-config  *
          Depends on vulnerable versions of metro-config
          node_modules/@react-native/metro-config
            react-native-worklets  >=0.8.0-bundle-mode-preview-1
            Depends on vulnerable versions of @react-native/metro-config
            node_modules/react-native-worklets
              react-native-reanimated  3.20.0-nightly-20250722-b6c8b9a3c - 4.0.0-nightly-20250309-9ce9085cb || 4.2.0-nightly-20250829-e8916d7ed - 4.2.0-nightly-20251017-235c127fd || 4.4.0-nightly-20260325-414e8adaf - 4.7.1
              Depends on vulnerable versions of react-native-worklets
              node_modules/react-native-reanimated
        metro-transform-worker  >=0.71.0
        Depends on vulnerable versions of metro
        node_modules/metro-config/node_modules/metro-transform-worker
        node_modules/metro-transform-worker

decode-uri-component  <=0.4.2
Severity: moderate
decode-uri-component: Denial of service via exponential decoding of malformed percent-encoded input - https://github.com/advisories/GHSA-vcc3-ghjq-m6fr
fix available via `npm audit fix --force`
Will install expo-router@58.0.13, which is a breaking change
node_modules/decode-uri-component
  query-string  5.0.0 - 9.4.1
  Depends on vulnerable versions of decode-uri-component
  node_modules/query-string
    expo-router  1.2.2 - 3.1.2 || 5.2.0-canary-20250611-f0afe80 - 58.0.12
    Depends on vulnerable versions of query-string
    node_modules/expo-router

esbuild  <=0.24.2
Severity: moderate
esbuild enables any website to send any requests to the development server and read the response - https://github.com/advisories/GHSA-67mh-4wv8-2f99
fix available via `npm audit fix --force`
Will install drizzle-kit@0.18.1, which is a breaking change
node_modules/@esbuild-kit/core-utils/node_modules/esbuild
  @esbuild-kit/core-utils  *
  Depends on vulnerable versions of esbuild
  node_modules/@esbuild-kit/core-utils
    @esbuild-kit/esm-loader  *
    Depends on vulnerable versions of @esbuild-kit/core-utils
    node_modules/@esbuild-kit/esm-loader
      drizzle-kit  0.19.0 - 1.0.0-beta.1-fd8bfcc
      Depends on vulnerable versions of @esbuild-kit/esm-loader
      node_modules/drizzle-kit

node-forge  *
Severity: high
node-forge RSA PKCS#1 v1.5 signature verification accepts extra nested DigestAlgorithm elements - https://github.com/advisories/GHSA-86w9-cpqp-85rv
fix available via `npm audit fix --force`
Will install expo@44.0.6, which is a breaking change
node_modules/node-forge
  @expo/code-signing-certificates  *
  Depends on vulnerable versions of node-forge
  node_modules/@expo/code-signing-certificates

undici  7.0.0 - 7.29.0
Severity: high
undici vulnerable to Denial of Service via unhandled error in WebSocket permessage-deflate decompression - https://github.com/advisories/GHSA-3wwx-pv8p-q78v
undici vulnerable to Denial of Service via orphaned RetryHandler response body - https://github.com/advisories/GHSA-pmjh-fq2x-6v4x
undici vulnerable to downstream response splitting via retry interceptor - https://github.com/advisories/GHSA-r53p-7pc4-xj5r
undici vulnerable to Denial of Service via unrequested WebSocket subprotocol - https://github.com/advisories/GHSA-rfgv-xxqx-mfg5
undici vulnerable to Denial of Service via unbounded decompression of compressed responses - https://github.com/advisories/GHSA-3xpg-4rpp-hhhm
undici vulnerable to cross-user cookie disclosure via Set-Cookie caching in shared caches - https://github.com/advisories/GHSA-2jfj-6hjv-fm6j
undici vulnerable to response truncation via oversized chunked responses in the dump interceptor - https://github.com/advisories/GHSA-2gqq-gqf2-x968
undici vulnerable to TLS certificate validation bypass via dropped connect options in BalancedPool - https://github.com/advisories/GHSA-w293-vg96-wgc3
undici vulnerable to caching and replay of unsafe HTTP method responses - https://github.com/advisories/GHSA-8436-99hf-9mmv
undici vulnerable to Denial of Service via WebSocketStream unclean close - https://github.com/advisories/GHSA-rx4f-c7p8-82vq
fix available via `npm audit fix --force`
Will install @scalar/api-reference-react@0.8.36, which is a breaking change
node_modules/@scalar/json-magic/node_modules/undici
  @scalar/json-magic  0.15.2 - 0.15.3
  Depends on vulnerable versions of undici
  node_modules/@scalar/json-magic
    @scalar/openapi-parser  0.29.7 - 0.29.9
    Depends on vulnerable versions of @scalar/json-magic
    node_modules/@scalar/openapi-parser
    @scalar/openapi-to-markdown  1.3.0 - 1.5.0
    Depends on vulnerable versions of @scalar/json-magic
    Depends on vulnerable versions of @scalar/workspace-store
    node_modules/@scalar/openapi-to-markdown
    @scalar/workspace-store  0.67.0 - 0.67.2
    Depends on vulnerable versions of @scalar/json-magic
    node_modules/@scalar/workspace-store
      @scalar/api-client  3.21.1 - 3.21.3
      Depends on vulnerable versions of @scalar/blocks
      Depends on vulnerable versions of @scalar/oas-utils
      Depends on vulnerable versions of @scalar/sidebar
      Depends on vulnerable versions of @scalar/workspace-store
      node_modules/@scalar/api-client
      @scalar/blocks  0.4.0 - 0.4.2
      Depends on vulnerable versions of @scalar/workspace-store
      node_modules/@scalar/blocks
      @scalar/oas-utils  0.20.6 - 0.20.8
      Depends on vulnerable versions of @scalar/workspace-store
      node_modules/@scalar/oas-utils
      @scalar/sidebar  0.11.8 - 0.11.10
      Depends on vulnerable versions of @scalar/workspace-store
      node_modules/@scalar/sidebar

uuid  <11.1.1
Severity: moderate
uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided - https://github.com/advisories/GHSA-w5hq-g745-h8pq
fix available via `npm audit fix --force`
Will install expo@44.0.6, which is a breaking change
node_modules/uuid
  xcode  >=0.9.2
  Depends on vulnerable versions of uuid
  node_modules/xcode
    @expo/config-plugins  *
    Depends on vulnerable versions of xcode
    node_modules/@expo/config-plugins
      @expo/config  <=0.0.1-canary-20240418-8d74597 || >=3.3.23-alpha.0
      Depends on vulnerable versions of @expo/config-plugins
      node_modules/@expo/config
        @expo/local-build-cache-provider  *
        Depends on vulnerable versions of @expo/config
        node_modules/@expo/local-build-cache-provider
        @expo/prebuild-config  *
        Depends on vulnerable versions of @expo/config
        Depends on vulnerable versions of @expo/config-plugins
        node_modules/@expo/prebuild-config
      @expo/inline-modules  >=0.0.2-canary-20260409-6fc2991
      Depends on vulnerable versions of @expo/config-plugins
      node_modules/@expo/inline-modules
      expo-splash-screen  55.0.10-canary-20260424-7bedc9d - 55.0.10-canary-20260429-a5e59cf || >=56.0.0-canary-20260212-4f61309
      Depends on vulnerable versions of @expo/config-plugins
      node_modules/expo-splash-screen

80 vulnerabilities (5 low, 25 moderate, 50 high)

To address all issues (including breaking changes), run:
  npm audit fix --force
```

---
*Generated: 2026-10-04 06:47*
*Last Updated: 2026-10-04 06:47*
