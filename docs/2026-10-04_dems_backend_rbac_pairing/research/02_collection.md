---
task_id: 2026-10-04_dems_backend_rbac_pairing
date: 2026-10-04
agent: data-collector
blueprint_row: 6 (FIRM)
tier: 2
items_collected: 12 evaluated candidates (C1-C12), 7 excluded or not-evaluated routes (X1-X7), 10 host facts (H1-H10); all queries and URLs are listed in the Query Log
last_updated: 2026-10-04 01:55
fetch_date_for_all_sources: 2026-10-04
status: complete
---

# Data Collection Report: providing a real PostgreSQL server on macOS arm64 without Docker and without a host service

> Collection only. This document records what each source says and how it was checked. It contains no ranking, no choice and no recommendation: row 14 (TD-02, TD-13) decides. Where a fact could not be confirmed it says "not confirmed".

## Task Overview

- **Blueprint row 6** (`identification/02_structured.md`): collect evidence on providing a real PostgreSQL server on macOS arm64 without Docker and without a host service, using generic technology queries only. Per candidate: version, licence, maintainer, platform coverage (macOS arm64, and for the later portable-package cost also Windows x64, Linux x64, macOS x64), install size, start, stop and removal commands, known issues on Node 26.
- **Rule from decision D5** (`decisions/decisions.md`): no Docker, no login or background service, no shell-profile edit, loopback only, project-local data directory, removable with one command. Order of preference to be settled by row 14: npm-distributed binaries first, Homebrew keg second.
- **Narrative tier 2**: each finding states what was found, why it matters, how it was verified, and the source (URL, fetched 2026-10-04).
- **How to read "Why it matters"**: it points to the D5 rule or to a downstream cost item (Q7 portable package), never to a verdict.

## Host Facts (read-only probes on the actual host)

| # | Fact | How verified (command) | Why it matters |
|---|---|---|---|
| H1 | Host is macOS 27.0.1 arm64; Node v26.8.2; npm 11.19.1; Homebrew 6.0.22 at `/opt/homebrew` | `uname -m` printed `arm64`; `node -v`; `npm -v`; `brew --version`; `brew config` line `macOS: 27.0.1-arm64` | Fixes the platform every "macOS arm64" row is judged against |
| H2 | No PostgreSQL tooling present: `psql`, `postgres`, `pg_ctl`, `initdb` are not on PATH; no `postgres` or `libpq` Homebrew formula is installed; `/opt/homebrew/var` holds only `cache`, `homebrew`, `log` | `command -v` loop; `brew list --formula \| grep -i -E "postgres\|^pg\|libpq"` printed nothing; `ls /opt/homebrew/var` | Confirms nothing to reuse or to collide with (decision F1) |
| H3 | `docker` (`/opt/homebrew/bin/docker`) and `colima` (`/opt/homebrew/bin/colima`) exist on the host. `podman`, `conda`, `mamba`, `micromamba`, `nix`, `port`, `mise`, `asdf` do not | `command -v` loop | Docker is present but D5/U1 excludes it; the absence of conda, nix, MacPorts matters for the "other distribution" routes |
| H4 | `python3` is Python 3.14 at `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`; `java` is OpenJDK 17 from Homebrew | `command -v python3`, `command -v java` | Python 3.14 matters for the pgserver wheel set (C11); Java is not needed by any route |
| H5 | Rosetta 2 is not installed: running `arch -x86_64 /usr/bin/true` printed `Bad CPU type in executable`; `/Library/Apple/usr/share/rosetta` does not exist | probe command (a one-shot `/usr/bin/true`, not a PostgreSQL process) | An x86_64-only macOS build could not run on this host |
| H6 | npm lifecycle scripts are enabled: `npm config get ignore-scripts` printed `false`. The workspace `.npmrc` contains only `save-exact=true`. Root `package.json` engines: `node >=26.8.2 <27`, `packageManager npm@11.19.1` | `npm config get ignore-scripts`; `cat .npmrc`; `package.json` read | The npm route in C1 depends on a postinstall step; this shows whether it would run here |
| H7 | npm registry is `https://registry.npmjs.org/` | `npm config get registry` | Source of all `npm view` facts below |
| H8 | The Homebrew bottle tag for this host is `arm64_golden_gate` and the OCI manifest labels it `os.version=macOS 27` | `brew info --json=v2` listed only that tag; manifest annotation (see C3) | Confirms a prebuilt bottle exists for macOS 27 arm64 |
| H9 | Free disk on the data volume: 675 GiB available | `df -h` | Size figures below are small against it |
| H10 | The sandbox blocked npm's default cache (`~/.npm/_cacache/tmp`, error EPERM) so all `npm view` and `npm search` calls were run with `NPM_CONFIG_CACHE` pointing at the session scratchpad; no sandbox bypass was used | first `npm view` call error output | Explains the `NPM_CONFIG_CACHE` prefix in the query log |

## Candidate Index

| ID | Candidate | Route | Status for this row |
|---|---|---|---|
| C1 | `embedded-postgres` + `@embedded-postgres/<platform>` | npm | Evaluated |
| C2 | `@serve-tools/postgres` + `@serve-tools/postgres-<platform>` | npm | Evaluated |
| C3 | Homebrew keg `postgresql@17` / `postgresql@18`, run with `pg_ctl` | Homebrew | Evaluated |
| C4 | `@electric-sql/pglite` + `@electric-sql/pglite-socket` | npm (WASM) | Evaluated |
| C5 | `theseus-rs/postgresql-binaries` release archives | GitHub Releases (direct archive) | Evaluated |
| C6 | `io.zonky.test.postgres:embedded-postgres-binaries-*` JARs | Maven Central (direct artifact) | Evaluated |
| C7 | Postgres.app | macOS app (DMG) | Evaluated |
| C8 | EDB "binaries from installer" archives | zip from EDB | Evaluated |
| C9 | `pg-embedded` + `@pg-ts/pg-embedded-<platform>` | npm (Rust addon) | Evaluated |
| C10 | `postgresql-dist` + `postgresql-dist-<platform>` | npm | Evaluated (stale) |
| C11 | `pgserver` | PyPI | Evaluated |
| C12 | conda-forge `postgresql` | conda | Evaluated (prerequisite absent) |
| X1 | Docker `postgres` image (Docker or Colima) | container | EXCLUDED |
| X2 | `@testcontainers/postgresql` | npm + container runtime | EXCLUDED |
| X3 | `@databases/pg-test` | npm + Docker | EXCLUDED |
| X4 | `brew services start postgresql@NN` mode | launchd service | EXCLUDED (as a start mode) |
| X5 | EDB interactive installer | system installer | EXCLUDED (precaution; see note) |
| X6 | `pg-mem` | npm | EXCLUDED (not a PostgreSQL server) |
| X7 | Hosted or cloud PostgreSQL products | cloud | EXCLUDED by category, no product evaluated |

---

## Candidate Findings

### C1. `embedded-postgres` (npm wrapper) with `@embedded-postgres/*` platform packages

**What was found**

| Item | Value | Source |
|---|---|---|
| Version (npm `latest`, only dist-tag) | `18.4.0-beta.17`, published 2026-06-05T10:13:13Z. The `-beta.NN` suffix is part of every release name from 9.x to 18.x (the version is the PostgreSQL version plus a project build counter). Also published: `17.10.0-beta.17` (2026-06-05), `16.14.0-beta.17`, `15.18.0-beta.17`, `14.23.0-beta.17` | `https://registry.npmjs.org/embedded-postgres` (versions, time, dist-tags), fetched 2026-10-04 |
| PostgreSQL version bundled | 18.4.0 (README matrix columns 14.23.0, 15.18.0, 16.14.0, 17.10.0, 18.4.0). postgresql.org lists current minors 18.6 and 17.11, so this line is behind the current minor | `https://raw.githubusercontent.com/leinelissen/embedded-postgres/main/README.md` lines 78-93; `https://www.postgresql.org/support/versioning/`; fetched 2026-10-04 |
| Licence | Wrapper and platform packages: `MIT` (npm field; `LICENSE.md` text "MIT License, Copyright (c) 2022 Lei Nelissen"). README line 192: "The binaries are made available under the Apache License 2.0, whereas the specific code in this package is made available under the MIT license." PostgreSQL itself is under the PostgreSQL License (OSI approved). The file listing of `@embedded-postgres/darwin-arm64@18.4.0-beta.17` contains `LICENSE.md` only; no PostgreSQL `COPYRIGHT` file is in it | registry; `https://unpkg.com/@embedded-postgres/darwin-arm64@18.4.0-beta.17/LICENSE.md`; unpkg `?meta` listing; `https://www.postgresql.org/about/licence/`; fetched 2026-10-04 |
| Maintainer | npm maintainer `leinelissen`; README: created by Lei Nelissen for BMD Studio, "currently maintained by Studio Falkland"; built on zonky's embedded-postgres-binaries | registry; README lines 187-190 |
| Repository signals | `github.com/leinelissen/embedded-postgres`, licence MIT, 147 stars, last push 2026-06-05, not archived, 12 open issues (excluding PRs), 3 PRs open | `https://api.github.com/repos/leinelissen/embedded-postgres`; `.../issues?state=open`; fetched 2026-10-04 |
| Platform coverage | macOS arm64 (`@embedded-postgres/darwin-arm64`), macOS x64 (`darwin-x64`), Windows x64 (`windows-x64`), Linux x64, arm64, arm, ia32, ppc64. Registry `os` and `cpu` fields confirm each package. `@embedded-postgres/windows-ia32` does not exist (HTTP 404) | registry per package; README lines 84-93 |
| Install size (registry `dist.unpackedSize`, bytes) | wrapper 35,045; darwin-arm64 147,710,671 (1,027 files); darwin-x64 147,710,651; windows-x64 109,333,174; linux-x64 59,216,961; linux-arm64 58,989,689; linux-arm 51,213,536; linux-ia32 58,339,553; linux-ppc64 69,627,553. The wrapper lists all eight platform packages as `optionalDependencies`; npm installs only the one matching `os` and `cpu`. Compressed download size: not confirmed (registry returned no Content-Length on a header request) | registry; unpkg listing; fetched 2026-10-04 |
| Contents of darwin-arm64 package | `native/bin/` holds exactly three programs: `initdb` (440,656 B), `pg_ctl` (245,792 B), `postgres` (19,458,112 B). No `psql`, `pg_dump`, `pg_restore`, `createdb`. `native/lib` is 125,214,336 B and includes `libicu*.77.1`, `libssl.3`, `libcrypto.3`, `libxml2`, `libkrb5`, `libpq.5`, `libpq-oauth-18`, `libuuid`, `libz`, `libzstd`, `liblz4` and 90 modules under `lib/postgresql`. 62 extension control files, including `pgcrypto`, `citext`, `pg_trgm`, `uuid-ossp`, `hstore`, `ltree`, `btree_gin`, `btree_gist`, `unaccent`, `pg_stat_statements`. Both macOS packages differ by 20 bytes in unpacked size; a reporter in issue #30 says `otool -L` shows "both architectures" in a dylib (macOS dylibs may be universal; not confirmed here) | unpkg `?meta` listing computed with Node; issue #30 |
| Lifecycle from the wrapper (API) | `new EmbeddedPostgres({ databaseDir, user, password, port, persistent, authMethod, initdbFlags, postgresFlags, createPostgresUser, onLog, onError })`; `await pg.initialise()` (runs `initdb --auth=<authMethod> --pwfile=<tmp file>` plus `initdbFlags`), `await pg.start()` (spawns `postgres -D <databaseDir> -p <port> <postgresFlags>`, resolves when stderr contains "database system is ready to accept connections"), `await pg.createDatabase(name)`, `await pg.stop()`. Defaults: `databaseDir ./data/db`, `port 5432`, `authMethod password`, `persistent true`. The wrapper does not set `listen_addresses` or the socket directory; callers can add them through `postgresFlags`. `stop()` sends SIGINT to the `postgres` process on Unix and runs `taskkill /pid <pid> /f /t` on Windows | README lines 40-66, 112-122; `src/index.ts` lines 56-66 (defaults), 172-183, 239-246, 287-300 |
| Lifecycle without the wrapper | The platform package exports the absolute paths `pg_ctl`, `initdb`, `postgres`; its README says it can be used directly ("Using just the binaries"). The standard commands then apply (section "Generic lifecycle commands") | `https://unpkg.com/@embedded-postgres/darwin-arm64@18.4.0-beta.17/README.md` |
| Removal | `npm uninstall embedded-postgres` removes the wrapper and the platform package from `node_modules`; the project-local data directory is removed by deleting it; nothing is written outside the project by the packages themselves (the wrapper's `createPostgresUser: true` option "WILL irreversibly modify your host system" and is off by default) | README line 122; `npm uninstall` is the standard npm command (not executed) |
| Install-time step | Platform packages declare `"postinstall": "node scripts/hydrate-symlinks.js"` because "NPM doesn't supports symlinks in their tarballs"; the script recreates dylib symlinks from `native/pg-symlinks.json`. README: "Embedded Postgres requires post-install scripts to function" | `https://unpkg.com/@embedded-postgres/darwin-arm64@18.4.0-beta.17/package.json`; `scripts/hydrate-symlinks.js`; README lines 24-31 |

**Known issues (all from the upstream tracker, fetched 2026-10-04)**

| Issue | State | Detail |
|---|---|---|
| #30 darwin-arm64 18.4.0-beta.17 "missing libicudata.77.dylib" | closed 2026-07-13 | A downstream installer extracted the tarball without running the postinstall; maintainer-side comment: package ships `pg-symlinks.json` and the postinstall that recreates the link, "not a defect in the package when installed" normally |
| PR #27 "hydrate symlinks at runtime when postinstall is skipped" | open PR since 2026-04-11 | Lists `bunx`, `pnpm --ignore-scripts`, some yarn PnP setups and `npm --ignore-scripts` as cases that skip the step and then crash with `dyld: Library not loaded` |
| #32 `stop()` never resolves if the postmaster already exited | open | Exit hook stalls process exit by about 10 s (async-exit-hook default timeout). Reporter environment: embedded-postgres 16.14.0-beta.17, Node v24.14.1, macOS 15 arm64; "reproduced by inspection" in 18.4.0 |
| #34 `initialise()` and `start()` may never settle when subprocesses stall | open | No timeout; readiness message can be missed if split across stream chunks; spawn failure does not reliably reject |
| #33 password temp file written with default permissions | open | `fs.writeFile(passwordFile, ...)` without a mode; with umask 022 the file is 0644 until removed |
| #38 smooth shutdown | open | `stop()` does not use `pg_ctl stop -m fast`; reporter (on Windows) sees roughly 4 s crash recovery on next start |
| #35 opt out of automatic process-exit shutdown; #28 Windows lifecycle for persistent reused clusters; #36 Alpine Docker with `createPostgresUser` | open | Lifecycle behaviours of the wrapper |
| #24 chmod of binary at runtime fails on a read-only filesystem | closed 2026-01-28 | `ensureBinIsExecutable` (index.ts line 172 and its twin for `postgres`) |

**Node 26**: no issue or PR found that names Node 26 (GitHub search `repo:leinelissen/embedded-postgres node 24` returned #24 and #14, neither about the Node version; `Tahoe` returned 0; `macOS arm64` returned #27, #30, #32). The upstream CI workflow runs Node `20.x` on `ubuntu-latest`, `windows-latest` and `macos-latest` only (`.github/workflows/test.yml` lines 11-19). The wrapper has no native addon; its two runtime dependencies are `async-exit-hook@2.0.1` (MIT, last npm publish 2022-06-13) and `pg@^8.7.3`. `pg@8.23.1` (MIT, `engines.node >= 16`) has a CI matrix that includes Node 26 against PostgreSQL 13 to 18 (`.github/workflows/ci.yml` lines 54-59). Whether the wrapper runs on Node 26.8.2 was not tested (no install allowed): **not confirmed by execution**.

**Why it matters**: it is the only npm route that offers every platform in the Q7 cost list (macOS arm64 and x64, Windows x64, Linux x64) from one dependency; the postinstall dependency (H6 shows scripts are enabled here), the absence of `psql` and `pg_dump` in the bundle, the default `authMethod password` and the lifecycle issues are the facts row 14 has to weigh.

**How verified**: `npm view` against the registry, unpkg `?meta` file listing (a JSON listing, no binary downloaded), upstream README, source and issue API read as text.

**Sources (all fetched 2026-10-04)**: `https://registry.npmjs.org/embedded-postgres`, `https://registry.npmjs.org/@embedded-postgres/darwin-arm64` (and the seven sibling platform URLs), `https://github.com/leinelissen/embedded-postgres`, `https://raw.githubusercontent.com/leinelissen/embedded-postgres/main/README.md`, `.../packages/embedded-postgres/src/index.ts`, `.../src/binary.ts`, `.../.github/workflows/test.yml`, `https://api.github.com/repos/leinelissen/embedded-postgres/issues?state=open&per_page=60`, issues 24, 27, 30, `https://unpkg.com/@embedded-postgres/darwin-arm64@18.4.0-beta.17/?meta`.

---

### C2. `@serve-tools/postgres` (npm loader) with `@serve-tools/postgres-<platform>` packages

**What was found**

| Item | Value | Source |
|---|---|---|
| Version | Loader and five platform packages all `0.1.0`, all modified on 2026-08-07 (loader `time.created` 2026-08-07T02:27:11Z). Platform build manifest: `"postgresql": "18.4.0"`, `"profile": "runtime-v1"`. Package versions are independent of the PostgreSQL release; the loader exports `postgresqlVersion` | `https://registry.npmjs.org/@serve-tools/postgres`; `https://unpkg.com/@serve-tools/postgres-darwin-arm64@0.1.0/build-manifest.json`; README |
| Licence | Loader `MIT-0`; platform packages `PostgreSQL` (npm field). The platform package ships `pg/COPYRIGHT` (the PostgreSQL copyright and licence text, "Portions Copyright (c) 1996-2026, PostgreSQL Global Development Group") and `pg/LICENSE` | registry per package; `https://unpkg.com/@serve-tools/postgres-darwin-arm64@0.1.0/pg/COPYRIGHT` |
| Maintainer | npm maintainer `jonathantneal`; package author "Jonathan Neal". Single maintainer on every package. Repository `github.com/serve-tools/postgres`: created 2026-08-06, 0 stars, 0 forks, licence MIT-0, last push 2026-09-24; its 12 issue-tracker entries are all dependency-bump PRs (#12 open); no bug report exists | registry; `https://api.github.com/repos/serve-tools/postgres`; `.../issues?state=all` |
| Provenance of binaries | Archives come from `theseus-rs/postgresql-binaries` (C5), pinned by URL and SHA-256 in `postgresql-binaries.lock.json`; each package has a `build-manifest.json` with archive URL, SHA-256 and a payload tree digest (darwin-arm64: 411 entries, 33,691,082 bytes). `publishConfig.provenance: true` is set; the registry did not return `dist.attestations` for 0.1.0 when queried, so published provenance is **not confirmed** | README "Guarantees" and "Payload policy"; build-manifest; `npm view @serve-tools/postgres@0.1.0 dist.attestations` |
| Platform coverage | macOS arm64 and x64 (native), Linux arm64 and x64 with glibc, Windows x64 (native). Linux musl (Alpine) not supported. Loader uses exact `optionalDependencies` so only the matching platform package installs. Node `>=22` required | README "Supported targets"; registry `os`, `cpu`, `libc` fields |
| Install size (registry `dist.unpackedSize`, bytes) | loader 14,898; darwin-arm64 33,694,405 (411 files); darwin-x64 32,086,446; linux-x64-gnu 27,129,169 (421 files); linux-arm64-gnu 31,420,819; win32-x64 101,707,701 (1,546 files). Compressed size: not confirmed | registry |
| Contents of darwin-arm64 package | 37 programs under `pg/bin`: `initdb`, `pg_ctl`, `postgres`, `psql`, `pg_dump`, `pg_dumpall`, `pg_restore`, `createdb`, `dropdb`, `pg_isready`, `pg_basebackup`, `pgbench`, `vacuumdb`, and others. 46 extension control files, including `pgcrypto`, `citext`, `pg_trgm`, `uuid-ossp`, `hstore`, `ltree`, `unaccent`, `pg_stat_statements`. Excluded by the `runtime-v1` profile: `include/**`, static libraries, `.pc` files | unpkg `?meta` listing; build manifest |
| Lifecycle | No postinstall and no install-time or runtime download (README: "no Docker, lifecycle script, or install-time/runtime download"). API: `binPath("pg_ctl")` and `pgHome()` return absolute paths, so the standard commands apply; `createEphemeralCluster({ user })` starts a disposable cluster on a private Unix-domain socket (macOS, Linux) or loopback TCP with a random SCRAM password (Windows) and `stop()` "stops PostgreSQL and removes the data and socket directories"; README says clusters are "intentionally disposable test and local-development resources", not durable services | README "Temporary clusters", "Program paths" |
| Removal | `npm uninstall @serve-tools/postgres` removes loader and platform package; project-local data directory removed by deleting it. The ephemeral helper removes its own data and socket directories on `stop()` | standard npm command (not executed); README |

**Known issues**: none filed (see maintainer row). Newness: 0.1.0, one maintainer, about two months old on the fetch date. The pinned PostgreSQL is 18.4.0 while the upstream archive source has 18.6.0 (C5); README documents `npm run source:update -- --version 18.5.0` as the update path.

**Node 26**: CI workflow `ci.yml` job "Verify (Node ${{ matrix.node }})" runs `node: [22, 24, 26]` on `ubuntu-24.04`; job "Native" runs on `macos-15` (arm64), `macos-15-intel`, `ubuntu-24.04-arm`, `ubuntu-24.04`, `windows-2025` with Node 24 and runs `npm run smoke`. So Node 26 is exercised on Linux only, and macOS arm64 only on Node 24. Run on this host: **not confirmed (no install allowed)**.

**Why it matters**: it is an npm route with no install-time script (H6 shows scripts are enabled here, so this removes that dependency), a smaller macOS payload than C1, a full client tool set (`psql`, `pg_dump`) and a licence file for the PostgreSQL code; against that stand its age, single maintainer, 18.4.0 pin and absence of published attestations.

**How verified**: registry `npm view` per package; raw README, `package.json`, `ci.yml` from GitHub; unpkg listing, build manifest and COPYRIGHT text read as text; GitHub API for repository and issues.

**Sources (fetched 2026-10-04)**: `https://registry.npmjs.org/@serve-tools/postgres` and `.../@serve-tools/postgres-darwin-arm64`, `-darwin-x64`, `-linux-x64-gnu`, `-linux-arm64-gnu`, `-win32-x64`; `https://github.com/serve-tools/postgres`; `https://raw.githubusercontent.com/serve-tools/postgres/main/README.md`, `.../package.json`, `.../.github/workflows/ci.yml`; `https://api.github.com/repos/serve-tools/postgres`; `https://unpkg.com/@serve-tools/postgres-darwin-arm64@0.1.0/?meta`, `.../build-manifest.json`, `.../pg/COPYRIGHT`, `.../package.json`.

---

### C3. Homebrew keg `postgresql@17` / `postgresql@18` run with `pg_ctl` from project scripts

**What was found**

| Item | Value | Source |
|---|---|---|
| Version | `postgresql@18` stable 18.6 (bottle rebuild 1); `postgresql@17` stable 17.11 (rebuild 0). Both "keg-only" (`:versioned_formula`), not deprecated; formula deprecation dates 2030-11-14 (@18) and 2029-11-08 (@17); disable dates 2031-11-14 and 2030-11-08. postgresql.org support table: 18 supported until 2030-11-14, 17 until 2029-11-08 | `brew info postgresql@18`, `brew info --json=v2 postgresql@17 postgresql@18`; formula source lines 13-26; `https://www.postgresql.org/support/versioning/`; fetched 2026-10-04 |
| Licence | `PostgreSQL` (formula `license "PostgreSQL"`, brew info `License: PostgreSQL`) | formula line 6; `brew info` |
| Maintainer | Homebrew (tap `homebrew/core`, `Formula/p/postgresql@18.rb`) | `brew info` output "From: https://github.com/Homebrew/homebrew-core/blob/HEAD/Formula/p/postgresql@18.rb" |
| Platform coverage (bottle tags in the formula) | `@18`: `arm64_golden_gate` (macOS 27), `arm64_tahoe` (26), `arm64_sequoia` (15), `arm64_linux`, `x86_64_linux`. `@17`: the same plus `arm64_sonoma` (14) and `sonoma` (macOS 14 on Intel x86_64). So Intel macOS has a bottle for `@17` only, none for `@18`. No Windows | formula `bottle do` blocks (`@18` lines 13-20; `@17` lines 13-21); OCI manifests list `os.version` per tag |
| Install size (OCI manifest annotations `sh.brew.bottle.size` and `installed_size`, bytes) | `@18` on macOS 27 arm64: bottle 20,767,835; installed 77,712,379. `@17` on macOS 27 arm64: bottle 20,054,981; installed 75,228,411. `@17` Intel `sonoma`: 20,140,590 / 71,921,206. Linux x86_64 `@18`: 22,981,917 / 81,296,298 | `https://ghcr.io/v2/homebrew/core/postgresql/18/manifests/18.6-1` and `.../postgresql/17/manifests/17.11` (anonymous token, manifest only, no blob fetched) |
| Dependencies | Runtime: `icu4c@78`, `krb5`, `lz4`, `openssl@3`, `readline`, `zstd`, `gettext` (plus transitive `ca-certificates`, `xz`, `json-c`, `libunistring`). On this host six are already installed (`gettext 1.0`, `icu4c@78 78.3`, `lz4 1.10.0`, `openssl@3 3.6.4`, `readline 8.3.3`, `zstd 1.5.7_1`); **`krb5` is not installed**: version 1.22.2, bottle 1,332,838 B, installed 5,203,257 B on macOS 27 arm64 | `brew deps --tree postgresql@18`; `brew list --versions ...`; `brew list --versions krb5` exit 1; krb5 manifest `https://ghcr.io/v2/homebrew/core/krb5/manifests/1.22.2` |
| What an install writes (formula source) | Keg under `/opt/homebrew/Cellar/postgresql@18/18.6`. `post_install_steps` (formula lines 119-129): creates `/opt/homebrew/var/log`, symlinks the keg's `include`, `lib` and `share` trees into `/opt/homebrew/{include,lib,share}/postgresql@18`, links versioned executables into `/opt/homebrew/bin` with suffix `-18`, and runs `init_data_dir formula_name, using: :postgresql, base: :var`, i.e. **creates a default database cluster at `/opt/homebrew/var/postgresql@18`** (the caveats text says "This formula has created a default database cluster with: initdb --locale=en_US.UTF-8 -E UTF-8 /opt/homebrew/var/postgresql@18"). The JSON field `post_install_defined` reads `false` although the source defines `post_install_steps`; the source and the caveats text agree with each other. Configure arguments hard-code `--datadir=/opt/homebrew/share/postgresql@18` (line 79) and the source comment (line 109) states "Removing symlinks may break PostgreSQL as its binaries expect paths from ./configure step" | formula source `https://raw.githubusercontent.com/Homebrew/homebrew-core/HEAD/Formula/p/postgresql@18.rb` lines 63, 79, 109, 119-129, 140-150; `brew info` Caveats |
| Start and stop (service block) | Formula `service do` (lines 154-162): `run [opt_bin/"postgres", "-D", f.postgresql_datadir]`, `keep_alive crashed: true`, `LC_ALL=en_US.UTF-8`, log `/opt/homebrew/var/log/postgresql@18.log`. That is the launchd path used by `brew services start`; brew info also prints the no-service alternative: `LC_ALL="en_US.UTF-8" /opt/homebrew/opt/postgresql@18/bin/postgres -D /opt/homebrew/var/postgresql@18` | formula lines 154-162; `brew info postgresql@18` Caveats |
| Running with `pg_ctl` from project scripts | The keg contains the standard programs (the formula runs `make install-world`, line 110), reachable at `/opt/homebrew/opt/postgresql@18/bin/{initdb,pg_ctl,postgres,psql,pg_dump,...}`. A project script then uses the standard commands with a project-local `-D` (section "Generic lifecycle commands"); the programs read their own configured paths under `/opt/homebrew`. The keg is not relocatable (see the line-109 comment), so it cannot be copied to another PC | formula source; `brew info` "keg-only ... not symlinked into /opt/homebrew" |
| Removal | `brew uninstall postgresql@18` (brew help: "Uninstall a formula or cask"). The caveats say "When uninstalling, some dead symlinks are left behind so you may want to run: `brew cleanup --prune-prefix`" (brew help: "Only prune the symlinks and directories from the prefix and remove no other files"). The default cluster `/opt/homebrew/var/postgresql@18` and the log file are not removed by those commands (not confirmed by execution; no formula step deletes them). Dependencies installed only for it (here `krb5`) are removed by `brew autoremove` ("Uninstall formulae that were only installed as a dependency of another formula and are now no longer needed"). Project data directory: delete it | `brew help uninstall`, `brew help cleanup`, `brew help autoremove`; formula caveats |

**Known issues**: caveats text for `@18` warns of a stale `postmaster.pid` after an unclean shutdown ("rm /opt/homebrew/var/postgresql@18/postmaster.pid"). Node 26: not applicable, no Node component in this route.

**Why it matters**: D5 allows this route second. The facts that touch the D5 rule are: install writes outside the project (Cellar, symlink trees in `/opt/homebrew`, a default cluster in `/opt/homebrew/var`), pulls one missing dependency (`krb5`), is not removable by `brew uninstall` alone, and has no Windows or (for `@18`) Intel-macOS bottle, so it does not serve the Q7 portable cost.

**How verified**: `brew info`, `brew info --json=v2`, `brew deps`, `brew help` on the host (read-only, `HOMEBREW_NO_AUTO_UPDATE=1`); formula source read as text; GHCR OCI index manifests read (JSON only).

**Sources (fetched 2026-10-04)**: `https://raw.githubusercontent.com/Homebrew/homebrew-core/HEAD/Formula/p/postgresql@18.rb`, `.../postgresql@17.rb`; `https://ghcr.io/v2/homebrew/core/postgresql/18/manifests/18.6-1`, `.../postgresql/17/manifests/17.11`, `.../krb5/manifests/1.22.2`; local `brew` output.

---

### C4. `@electric-sql/pglite` with `@electric-sql/pglite-socket` (PostgreSQL compiled to WebAssembly)

**What was found**

| Item | Value | Source |
|---|---|---|
| Version | `@electric-sql/pglite` 0.5.8 (modified 2026-08-26); `@electric-sql/pglite-socket` 0.2.11 (2026-08-26). Embedded PostgreSQL major version for 0.5.8: **not confirmed**. The PostgreSQL fork repo `electric-sql/postgres-pglite` has default branch `REL_18_3-pglite` (GitHub API) | registry; `https://api.github.com/repos/electric-sql/postgres-pglite` |
| Licence | npm `Apache-2.0`; README: "dual-licensed under the terms of the Apache License 2.0 and the PostgreSQL License, you can choose which you prefer"; changes to the Postgres source are PostgreSQL License | registry; `https://raw.githubusercontent.com/electric-sql/pglite/main/README.md` line 194 |
| Maintainer | ElectricSQL; four npm maintainers (`thruflo`, `icehaunter`, `kylemathews`, `sgwillis`). Repo 16,116 stars, 169 open issues, last push 2026-08-26 | registry; `https://api.github.com/repos/electric-sql/pglite` |
| Platform coverage | Any runtime that runs the WASM: browser, Node.js, Bun, Deno (README). No native binary, so macOS arm64 and x64, Windows x64 and Linux x64 are all covered by the same package; no `os` or `cpu` restriction in the registry | README lines 36, 79-98 |
| Install size | `@electric-sql/pglite` 25,437,263 bytes unpacked; `@electric-sql/pglite-socket` 346,701. README claims "only 3mb gzipped" for the library | registry; README line 36 |
| Nature of the server | Postgres in single-user mode compiled with Emscripten: "PGlite is single user/connection" (README line 125). The socket wrapper "allows PGlite to be used as a PostgreSQL server"; README note: "Although PGlite is a single-connection database, it is possible to open and use multiple simultaneous connections with pglite-server ... achieved through a multiplexer ... This is different from a normal Postgres installation, so not all use cases are guaranteed to work." Default `--max-connections` is 1 | `pglite-socket` README lines 12, 167; v0.4 release post (`https://electric-sql.com/blog/2026/03/25/announcing-pglite-v04`, "PGlite runs in Postgres single-user mode, which means a single connection") |
| Start, stop | CLI `pglite-server --db=./data/mydb --port=5433` (default host `127.0.0.1`, default db `memory://`); optional `--path=<unix socket>`; API `new PGLiteSocketServer({ db, port, host })` with `start()` and `stop()`. A separate stop command for the CLI: not documented beyond ending the process (not confirmed) | `pglite-socket` README lines 27-63, 140-167, 193 |
| Removal | `npm uninstall @electric-sql/pglite @electric-sql/pglite-socket` (standard npm command, not executed) and delete the database folder | npm CLI |
| Related npm packages | `@prisma/dev` 0.25.2 (ISC) depends on `@electric-sql/pglite` 0.4.3 and pglite-socket 0.1.3; `tinbase` 0.19.0 (MIT) depends on `@electric-sql/pglite ^0.5.4`. Whether either needs an account: **not confirmed** | registry `dependencies` |

**Known issues relevant to Node versions**: issue #1053 (closed 2026-09-18) "Concurrent Node processes initializing PGlite can SIGSEGV the Node runtime" reproduced on `node:26-bookworm` (Node v26.5.0, V8 14.6) on Linux x64 with PGlite 0.5.4 and "also reproduced on Node 22, 24, 25 and a Node 27 V8 canary"; the reporter's final update attributes the original failure to a machine-specific hardware fault after an RMA, not to PGlite or Node. The linked Node issue `nodejs/node#64500` is still **open** (updated 2026-09-28); a commenter reports a V8 check failure `code-range.cc ... jit_page_->allocations_.erase(addr) == 1` on Node 24.16 to 24.19 in a single-process Linux CI with PGlite 0.5.4 and another commenter (2026-09-28) says it is an import-wrapper double free fixed in a V8 commit that "isn't in 24.x" (tracked in `nodejs/node#66366`). Whether Node 26.8.2 contains that V8 fix: **not confirmed**. Other open PGlite issues seen: #1058 (a synchronous call can spin at 100% CPU when the backend exits mid-message), #1115 (failed statements permanently use stack-depth budget). No macOS-specific search of the PGlite tracker was made, so macOS arm64 reports are **not confirmed either way**.

**Why it matters**: PGlite is the only candidate where the server is not a native PostgreSQL process, which bears on the request for "a real PostgreSQL server"; the single-connection model and the open Node/V8 WebAssembly issue are the facts row 14 has to weigh against its zero-binary, all-platform coverage.

**How verified**: registry `npm view`; README text from the repository and the npm `readme` field; GitHub issue API read as text.

**Sources (fetched 2026-10-04)**: `https://registry.npmjs.org/@electric-sql/pglite`, `.../@electric-sql/pglite-socket`, `.../@prisma/dev`, `.../tinbase`; `https://github.com/electric-sql/pglite`; `https://raw.githubusercontent.com/electric-sql/pglite/main/README.md`; `https://api.github.com/repos/electric-sql/pglite/issues/1053` (and `/1053/comments`); `https://api.github.com/repos/nodejs/node/issues/64500` (and `/comments`).

---

### C5. `theseus-rs/postgresql-binaries` (release archives, direct download from GitHub)

**What was found**

| Item | Value | Source |
|---|---|---|
| Version | Latest release `18.6.0` published 2026-08-15; same day `17.11.0`, `16.15.0`, `15.19.0`, `14.24.0`. Version scheme `<pg major>.<pg minor>.<build release>` | `https://api.github.com/repos/theseus-rs/postgresql-binaries/releases` and `/releases/latest` |
| Licence | Repo licence `PostgreSQL` (GitHub API); README: "PostgreSQL is covered under The PostgreSQL License" | `https://api.github.com/repos/theseus-rs/postgresql-binaries`; README |
| Maintainer | GitHub organisation `theseus-rs`; 78 stars, 14 open issues, last push 2026-10-01, not archived | GitHub API |
| Platform coverage (assets of 18.6.0, bytes) | macOS arm64 `aarch64-apple-darwin.tar.gz` 13,081,312; macOS x64 `x86_64-apple-darwin.tar.gz` 13,435,995; Windows x64 `x86_64-pc-windows-msvc.zip` 54,084,095 (also `.tar.gz` 54,068,902); Linux x64 glibc `x86_64-unknown-linux-gnu.tar.gz` 12,184,736 and musl 26,108,430; Linux arm64 gnu 11,979,851; plus arm, i586/i686, mips64, powerpc64le, s390x targets. 24 archives, each with a matching `.sha256` asset (48 assets) | `/releases/latest` asset list |
| Install size | Archive sizes above are compressed downloads; the extracted size for darwin-arm64 is the pruned 33,691,082 bytes in C2's build manifest (C2 prunes headers and static libraries from this same archive family, 18.4.0). Extracted size of the unpruned 18.6.0 archive: not confirmed | C2 build manifest; asset list |
| Lifecycle | No installer or wrapper: download the archive for the target triple (README: "`postgresql-<version>-<target>.<extension>`"), extract, and use the standard programs; start, stop and `initdb` are the generic commands. The upstream's Rust crate `postgresql_embedded` documents it as the default binary source | README "Choosing an installation package"; `https://raw.githubusercontent.com/theseus-rs/postgresql-embedded/main/README.md` line 60 |
| Removal | Delete the extraction directory and the data directory; nothing else is written by the archive | no installer exists (README) |
| Known issues | Not collected beyond the 14 open issues' existence (titles not read). Node 26: not applicable (no Node component) | GitHub API |

**Why it matters**: it is the upstream of C2 and of the Rust crate behind C9, and is the only candidate that lists one archive per target for all four Q7 platforms plus musl, with a checksum file per archive. It involves no npm package, so a project script would have to download and unpack it (the download is a network action the controller must clear before use).

**How verified**: GitHub API read as JSON; no archive downloaded.

**Sources (fetched 2026-10-04)**: `https://api.github.com/repos/theseus-rs/postgresql-binaries`, `.../releases/latest`, `.../releases?per_page=30`; `https://raw.githubusercontent.com/theseus-rs/postgresql-binaries/main/README.md`.

---

### C6. `io.zonky.test.postgres:embedded-postgres-binaries-*` (Maven Central artifacts)

**What was found**

| Item | Value | Source |
|---|---|---|
| Version | `release 18.6.0`, `lastUpdated 20260827234251` (darwin-arm64v8); siblings the same version. README example uses `18.6.0` and `-PpgVersion=18.6` | `https://repo1.maven.org/maven2/io/zonky/test/postgres/embedded-postgres-binaries-darwin-arm64v8/maven-metadata.xml` and siblings; `https://raw.githubusercontent.com/zonkyio/embedded-postgres-binaries/master/README.md` |
| Licence | POM `<license>`: "The Apache License, Version 2.0" (applies to the packaging project; the PostgreSQL code inside is under the PostgreSQL License). README: "released under version 2.0 of the Apache License" | `.../embedded-postgres-binaries-darwin-arm64v8/18.6.0/...-18.6.0.pom`; README |
| Maintainer | `zonkyio` (GitHub organisation) | POM `<scm>`; README |
| Platform coverage | README: platforms Darwin, Windows, Linux, Alpine; architectures amd64, i386, arm32v6, arm32v7, arm64v8, ppc64le. Checked artifacts at 18.6.0: `darwin-arm64v8`, `darwin-amd64`, `windows-amd64`, `linux-amd64` all HTTP 200 | metadata XML; header request |
| Install size (JAR `Content-Length`, bytes) | darwin-arm64v8 71,185,174; darwin-amd64 71,185,174 (identical size); windows-amd64 25,366,735; linux-amd64 15,119,738. README describes the bundles as "lightweight ... reduced size ... intended for testing purposes" | header-only requests; README |
| Lifecycle | The JAR is a zip holding a compressed tar; extraction (`unzip`, then `tar`) gives the standard programs; commands as in the generic section. Not an npm route: it is the upstream of C1 | README "Projects using the embedded binaries" lists `leinelissen/embedded-postgres` (NodeJS) |
| Removal | Delete the extraction directory and the data directory | no installer |
| Known issues | Older reports of M1 `dyld ... libintl` failures exist on the Java wrapper tracker (2022 era; a search snippet only, issue pages not read) | search W2 result list |

**Why it matters**: shows where C1's binaries originate and gives a direct-artifact path for the same builds at 18.6.0, which is newer than C1's npm 18.4.0.

**How verified**: Maven Central metadata and POM read as text; header-only requests for sizes; no JAR body downloaded.

**Sources (fetched 2026-10-04)**: `https://repo1.maven.org/maven2/io/zonky/test/postgres/embedded-postgres-binaries-darwin-arm64v8/maven-metadata.xml`, `.../embedded-postgres-binaries-darwin-amd64/...`, `.../embedded-postgres-binaries-windows-amd64/...`, `.../embedded-postgres-binaries-linux-amd64/...`, the 18.6.0 `.pom` and `.jar` URLs, `https://github.com/zonkyio/embedded-postgres-binaries`.

---

### C7. Postgres.app

**What was found**

| Item | Value | Source |
|---|---|---|
| Version | Release `v2.9.6` (2026-08-13) with PostgreSQL 18.6, 17.11, 16.15, 15.19, 14.24 | `https://api.github.com/repos/PostgresApp/PostgresApp/releases/latest` |
| Licence | README: "Postgres.app is released under the PostgreSQL License". GitHub API reports `NOASSERTION` for the repository licence field | README line 180; GitHub API |
| Maintainer | GitHub organisation `PostgresApp`; 7,784 stars, 149 open issues, last push 2026-09-30 | GitHub API |
| Platform coverage | macOS only. Binaries for PostgreSQL 17 and 18 are built on macOS 14 (README lines 40-48); the README lists "cmake (when building universal binaries - PostgreSQL 14 or later)" as a build prerequisite. Minimum macOS version of the 2.9.6 build and whether the DMG is universal: **not confirmed**. No Windows or Linux build | README lines 40-54, 105 |
| Install size (DMG assets of 2.9.6, bytes) | PostgreSQL 18 only 122,517,005; 17 only 119,621,638; 16 only 112,949,293; 15 only 104,768,613; 14 only 88,387,881; all versions 532,978,656 | release asset list |
| Lifecycle | A menu-bar app: "Open the app, and you have a PostgreSQL server ready ... Close the app, and the server shuts down" (postgresql.org macOS page). On first start it runs `initdb -D DATA_DIRECTORY -U postgres --encoding=UTF-8 --locale=en_US.UTF-8` (from 15 on adds `--locale-provider=icu --icu-locale=en-US --data-checksums`) then `pg_ctl start -D DATA_DIRECTORY --wait --log=DATA_DIRECTORY/postgres-server.log --options="-p PORT"`; default data directory `~/Library/Application Support/Postgres/var-xx`. The command-line tools sit at `/Applications/Postgres.app/Contents/Versions/latest/bin` (so they can be called directly with a project-local `-D`). The site's PATH instruction uses `sudo` to write `/etc/paths.d/postgresapp` (optional) | README lines 127-136; `https://postgresapp.com/`; `https://www.postgresql.org/download/macosx/` |
| Install and removal | "Download, move to Applications folder, double click" (site). Removal: move the app out of `/Applications` and delete its data directory; the site gives no explicit uninstall steps for the app itself (not confirmed) | `https://postgresapp.com/` |

**Why it matters**: runs as a user app, not a launchd service, and ships the standard programs; it is macOS-only and installs a DMG into a host folder, which bears on D5's "project-local" and on Q7.

**How verified**: GitHub API (JSON), README read as text, two web pages read through the fetch tool (a summarising reader; quoted phrases are the reader's quotations of the page, not re-checked in raw HTML).

**Sources (fetched 2026-10-04)**: `https://api.github.com/repos/PostgresApp/PostgresApp`, `.../releases/latest`; `https://raw.githubusercontent.com/PostgresApp/PostgresApp/master/README.md`; `https://postgresapp.com/`; `https://www.postgresql.org/download/macosx/`.

---

### C8. EDB "binaries from installer" archives (zip)

**What was found**

| Item | Value | Source |
|---|---|---|
| Version | Versions listed: 18.6, 17.11, 16.15, 15.19, 14.24 (supported) and 13.23 down to 9.1.24 (marked "Not supported"). Archive file name pattern `postgresql-<ver>-1-<platform>-binaries.zip` | `https://www.enterprisedb.com/download-postgresql-binaries` (raw HTML text) |
| Licence | The download page states no licence terms (searched the page text for licence, terms) | same |
| Maintainer | EDB | same |
| Platform coverage (header-only checks of the 18.6-1 and 17.11-1 files) | `...-osx-binaries.zip` HTTP 200 for both (platform label on the page is "Mac OS X"; **CPU architecture not confirmed**); `...-windows-x64-binaries.zip` HTTP 200 for both; `...-linux-x64-binaries.tar.gz` HTTP 403 for both, i.e. no file at that inferred name (whether a Linux archive exists under another name for 17 or 18: not confirmed; the fetch-tool reading of the page said Linux x86-64 and x86-32 are offered for "older versions only"). The static HTML carries archive links only for 9.2.24 and 9.3.25 (each with `linux`, `linux-x64`, `osx`, `windows`, `windows-x64`); the 18.x and 17.x links are not in it, so those URLs were inferred from that pattern and checked by header only. Rosetta 2 is absent on this host (H5) | HEAD requests; page text |
| Install size (zip `Content-Length`, bytes) | 18.6-1 macOS 445,659,767; Windows x64 343,808,005; 17.11-1 macOS 436,669,780; Windows x64 340,719,294 | header-only requests |
| Terms of the archives | "These archives are provided as a convenience for expert users; unless you specifically need these files, you should download an installer instead." The header requests above returned HTTP 200 with no credentials, so no account was needed to reach the files (the page itself has a "Sign In" navigation link) | page text; HEAD requests |
| Lifecycle, removal | Archives of "the files installed by our PostgreSQL installers"; extract and use the standard programs; delete the folder to remove (no installer, no service) | page text |

**Why it matters**: the only vendor-built Windows x64 archive in the set, but 344 MB; the macOS archive's architecture is unconfirmed, and this host cannot run x86_64.

**How verified**: raw page HTML and HEAD requests (no body downloaded).

**Sources (fetched 2026-10-04)**: `https://www.enterprisedb.com/download-postgresql-binaries`; `https://get.enterprisedb.com/postgresql/postgresql-18.6-1-osx-binaries.zip` (HEAD), `.../postgresql-18.6-1-windows-x64-binaries.zip` (HEAD), `.../postgresql-17.11-1-osx-binaries.zip` (HEAD), `.../postgresql-17.11-1-windows-x64-binaries.zip` (HEAD), `.../postgresql-18.6-1-linux-x64-binaries.tar.gz` and `.../postgresql-17.11-1-linux-x64-binaries.tar.gz` (HEAD, 403).

---

### C9. `pg-embedded` with `@pg-ts/pg-embedded-<platform>` (npm, Rust native addon)

**What was found**

| Item | Value | Source |
|---|---|---|
| Version | `pg-embedded` 0.2.3 (published 2025-09-28; version string of platform packages `0.2.3+pg18.0`, i.e. PostgreSQL 18.0). No release since: about 12 months before the fetch date | `https://registry.npmjs.org/pg-embedded` |
| Licence | `Apache-2.0` (loader and platform packages); repo licence Apache-2.0 | registry; `https://api.github.com/repos/PgTsLabs/pg-embedded` |
| Maintainer | npm maintainer `kingsword09`; repository organisation `PgTsLabs`; 8 stars, 1 open issue, last push 2025-11-03 | registry; GitHub API |
| Platform coverage | optional dependencies: darwin-arm64, darwin-x64, linux-x64-gnu, linux-x64-musl, linux-arm64-gnu, linux-arm64-musl, linux-arm-gnueabihf, win32-x64-msvc, android-arm64, android-arm-eabi. README: "Works on macOS, Linux, and Windows" | registry `optionalDependencies`; README line 18 |
| Install size (unpacked, bytes) | loader 135,368; darwin-arm64 12,418,326; darwin-x64 12,653,795; win32-x64-msvc 55,420,781; linux-x64-gnu 15,947,392 | registry |
| Binary delivery | Rust crate dependencies in `Cargo.toml`: `postgresql_embedded 0.20.0` with feature `bundled` and `postgresql_commands`. The crate README says the "bundled" feature "will download the PostgreSQL installation archive at compile time, include it in your binary and install from the binary version at runtime"; default archive source is theseus-rs (C5). Where the runtime extracts to by default: not confirmed; the options include `installationDir`, `dataDir`, `persistent` | `https://raw.githubusercontent.com/PgTsLabs/pg-embedded/main/Cargo.toml` lines 23-39; `https://raw.githubusercontent.com/theseus-rs/postgresql-embedded/main/README.md` lines 12-17; npm README lines 405-417 |
| Lifecycle, removal | Library API (`start`, `cleanup`, plus bundled `pg_dump`, `pg_restore`, `psql` wrappers per README features); `npm uninstall pg-embedded` and delete the installation and data folders | npm README |
| Node 26 | `engines.node >= 10`; N-API addon; no Node 26 report found; not tested: **not confirmed** | registry |

**Why it matters**: another npm path whose PostgreSQL line (18.0) is older than the others, with no release in a year.

**How verified**: registry and README; Cargo manifest read as text.

**Sources (fetched 2026-10-04)**: `https://registry.npmjs.org/pg-embedded`, `.../@pg-ts/pg-embedded-darwin-arm64`, `.../@pg-ts/pg-embedded-darwin-x64`, `.../@pg-ts/pg-embedded-win32-x64-msvc`, `.../@pg-ts/pg-embedded-linux-x64-gnu`; `https://github.com/PgTsLabs/pg-embedded`.

---

### C10. `postgresql-dist` with `postgresql-dist-<platform>` (npm)

| Item | Value | Source |
|---|---|---|
| Version, date | `15.6.0-8`, last modified 2024-04-13; PostgreSQL 15.6 while postgresql.org lists 15.19 as the current 15 minor | `https://registry.npmjs.org/postgresql-dist`; `https://www.postgresql.org/support/versioning/` |
| Licence, maintainer | npm field `MIT`; maintainer `svanterichter`; repo `webivy-team/postgresql-dist` | registry |
| Platform coverage | darwin-arm64, darwin-x64, linux-x64, win32-x64 (also linux-arm64 per its scripts) | registry |
| Install size (unpacked, bytes) | darwin-arm64 332,759,883; darwin-x64 332,759,879; linux-x64 165,206,831; win32-x64 104,072,333; loader 17,222 | registry |
| Lifecycle, known issues | Not collected (README not read). Node 26: not confirmed | n/a |

Why it matters: listed because it appeared in a registry search; the facts above show it is not current. Fetched 2026-10-04.

### C11. `pgserver` (PyPI)

| Item | Value | Source |
|---|---|---|
| Version, date | 0.1.4, uploaded 2024-06-08 | `https://pypi.org/pypi/pgserver/json` |
| Licence | PyPI `license` and `license_expression` fields are empty: **not confirmed** | PyPI JSON |
| Maintainer | author "Oscar Moll" | PyPI JSON |
| Platform coverage | wheels for CPython 3.9, 3.10, 3.11, 3.12 only: `macosx_11_0_arm64` (9,822,137 B for cp312), `macosx_10_9_x86_64` (10,378,168), `manylinux_2_17_x86_64` (11,266,316), `win_amd64` (12,797,714). No wheel for CPython 3.13 or 3.14; the host's `python3` is 3.14 (H4) | PyPI JSON |
| PostgreSQL version bundled | not confirmed | n/a |

Why it matters: it is a Python route, not npm; the wheel set does not include the host's Python. Fetched 2026-10-04.

### C12. conda-forge `postgresql`

| Item | Value | Source |
|---|---|---|
| Version, licence | latest 18.6, licence `PostgreSQL` | `https://api.anaconda.org/package/conda-forge/postgresql` |
| Platform coverage | linux-64, linux-aarch64, linux-ppc64le, osx-64, osx-arm64, win-32, win-64 | same |
| Prerequisite | needs a conda or mamba distribution; none is on the host (H3). Installed size: not collected | `command -v` probe |

Why it matters: the package covers all four Q7 platforms, but needs a package-manager install that does not exist here. Fetched 2026-10-04.

### Other npm search results noted (not evaluated)

| Package | Version, date | What the registry says | Note |
|---|---|---|---|
| `@flasham/embedded-postgres-windows-x64` (and sibling downloader) | 17.6.0-beta.22, 2025-10-13 | MIT; maintainer `flasham`; repository field points to leinelissen/embedded-postgres | A fork of C1 with PostgreSQL 17.6 |
| `postgresql-dev-server` | 1.0.6, 2018-04-03 | "Downloads postgresql binaries and start a dev server" | 2018 |
| `pg-server-9.5-win-x86` | 1.0.5, 2018-01-27 | "postgresql binaries for windows" | PostgreSQL 9.5, Windows x86 |
| `window-postgres-installer` | 0.1.2, 2024-03-18 | "helper package to install Postgresql binaries on a window system" | Windows only |
| `embedded-postgres-cli` | 0.0.2, 2023-10-27 | CLI for embedded postgres | 2023 |

---

## Excluded Candidates (with reason)

| ID | Candidate | Reason for exclusion | Evidence | Fetched |
|---|---|---|---|---|
| X1 | Docker `postgres` image run by Docker Desktop or Colima | Needs Docker (U1, D5). The host has `docker` and `colima` installed, but D5 excludes both | `command -v docker colima` output (H3); decision D5 | 2026-10-04 |
| X2 | `@testcontainers/postgresql` 12.2.0 (MIT) | Needs a Docker-compatible container runtime. The supported-runtime page lists Docker, Podman, Colima, Rancher Desktop and instructs setting `DOCKER_HOST` for the non-Docker ones | `https://registry.npmjs.org/@testcontainers/postgresql`; `https://node.testcontainers.org/supported-container-runtimes/` (read through the fetch tool; reader noted the page does not state a blanket requirement sentence, so "needs a container runtime" rests on the runtime list and `DOCKER_HOST` instructions) | 2026-10-04 |
| X3 | `@databases/pg-test` 4.0.0 (MIT) | Needs Docker: docs state "The `@databases/pg-test` library uses docker to allow you to run tests against a real postgres database" and "You should install docker" | `https://www.atdatabases.org/docs/pg-test` (fetch tool); `https://registry.npmjs.org/@databases/pg-test` | 2026-10-04 |
| X4 | `brew services start postgresql@NN` as the way to run C3 | Registers a launchd job (formula `service` block, `keep_alive crashed: true`); excluded as a start mode (D5: no login or background service). C3 stays listed with the `pg_ctl` start mode | formula lines 154-162; `brew info` Caveats ("restart at login") | 2026-10-04 |
| X5 | EDB interactive installer (graphical, command-line or silent) | System-wide installer (it is the thing the C8 page tells experts to avoid). That it registers a launchd service is reported only by a search-result summary; the EDB docs page read for confirmation does not address it. Excluded as a precaution; service registration **not confirmed** from a primary source. postgresql.org's macOS page lists the installer's matrix as Postgres 18 on macOS 13+ for both amd64 and arm64 | search W6; `https://www.enterprisedb.com/docs/postgresql_journey/02_installing/04_macos/` (page silent); `https://www.postgresql.org/download/macosx/` | 2026-10-04 |
| X6 | `pg-mem` 3.0.14 (MIT) | Not a PostgreSQL server: README line 12 "pg-mem is an experimental in-memory emulation of a postgres database" | `https://registry.npmjs.org/pg-mem` (readme field) | 2026-10-04 |
| X7 | Hosted or cloud PostgreSQL products | Excluded by category (cloud service and account, D5/U5). No specific product was looked up, so no product facts are recorded | none (no query made) | 2026-10-04 |

Other routes seen but not collected: MacPorts and Fink (listed on the postgresql.org macOS page; `port` is absent from the host, and a MacPorts install is a system-level package-manager install); Nix, mise and asdf (not present on the host, H3; not looked up).

---

## Comparison Matrices (facts only)

### M1. Version, licence, maintainer

| ID | PostgreSQL version | Package or release version | Licence of the PostgreSQL payload as stated by the source | Maintainer |
|---|---|---|---|---|
| C1 | 18.4.0 (also 17.10.0) | 18.4.0-beta.17, 2026-06-05 | MIT wrapper; README says binaries Apache-2.0; no PostgreSQL COPYRIGHT file in the package | leinelissen |
| C2 | 18.4.0 | 0.1.0, 2026-08-07 | platform packages `PostgreSQL`; loader MIT-0 | jonathantneal |
| C3 | 18.6 / 17.11 | formula 18.6 (rebuild 1) / 17.11 | `PostgreSQL` | Homebrew |
| C4 | not confirmed (fork branch REL_18_3) | 0.5.8, 2026-08-26 | Apache-2.0 or PostgreSQL (dual) | ElectricSQL |
| C5 | 18.6.0 (also 17.11.0 and older) | 18.6.0, 2026-08-15 | `PostgreSQL` | theseus-rs |
| C6 | 18.6.0 | 18.6.0, updated 2026-08-27 | Apache-2.0 (POM) for the packaging | zonkyio |
| C7 | 18.6 / 17.11 / 16.15 / 15.19 / 14.24 | v2.9.6, 2026-08-13 | PostgreSQL License | PostgresApp |
| C8 | 18.6, 17.11, 16.15, 15.19, 14.24 | 18.6-1 etc. | not stated on the page | EDB |
| C9 | 18.0 | 0.2.3, 2025-09-28 | Apache-2.0 | kingsword09 / PgTsLabs |
| C10 | 15.6 | 15.6.0-8, 2024-04-13 | MIT (npm field) | svanterichter |
| C11 | not confirmed | 0.1.4, 2024-06-08 | not declared in metadata | Oscar Moll |
| C12 | 18.6 | 18.6 | PostgreSQL | conda-forge |

### M2. Platform coverage (yes means a package or archive exists; sources in the candidate sections)

| ID | macOS arm64 | macOS x64 | Windows x64 | Linux x64 |
|---|---|---|---|---|
| C1 | yes | yes | yes | yes |
| C2 | yes | yes | yes | yes (glibc only) |
| C3 | yes (macOS 15, 26, 27; @17 also 14) | @17 only (macOS 14 `sonoma`) | no | yes (Linuxbrew bottle) |
| C4 | yes (WASM, any Node) | yes (WASM) | yes (WASM) | yes (WASM) |
| C5 | yes | yes | yes | yes (gnu and musl) |
| C6 | yes | yes | yes | yes |
| C7 | yes (macOS only) | not confirmed | no | no |
| C8 | not confirmed (page says "Mac OS X"; host cannot run x86_64) | not confirmed | yes | not confirmed (403 at the inferred name for 17 and 18) |
| C9 | yes | yes | yes | yes |
| C10 | yes | yes | yes | yes |
| C11 | yes (CPython 3.9-3.12 only) | yes | yes | yes |
| C12 | yes | yes | yes | yes |

### M3. Install size per platform (bytes; unpacked unless marked)

| ID | macOS arm64 | macOS x64 | Windows x64 | Linux x64 |
|---|---|---|---|---|
| C1 (unpacked) | 147,710,671 | 147,710,651 | 109,333,174 | 59,216,961 |
| C2 (unpacked) | 33,694,405 | 32,086,446 | 101,707,701 | 27,129,169 |
| C3 (bottle / installed, @18) | 20,767,835 / 77,712,379 (+ krb5 1,332,838 / 5,203,257) | none for @18 (@17: 20,140,590 / 71,921,206) | none | 22,981,917 / 81,296,298 |
| C4 (unpacked, all platforms) | 25,437,263 + 346,701 | same | same | same |
| C5 (compressed archive) | 13,081,312 | 13,435,995 | 54,084,095 (zip) | 12,184,736 |
| C6 (JAR) | 71,185,174 | 71,185,174 | 25,366,735 | 15,119,738 |
| C7 (DMG, PG 18 only) | 122,517,005 | not confirmed | n/a | n/a |
| C8 (zip, 18.6-1) | 445,659,767 (architecture unconfirmed) | not confirmed | 343,808,005 | not confirmed (403) |
| C9 (unpacked) | 12,418,326 | 12,653,795 | 55,420,781 | 15,947,392 |
| C10 (unpacked) | 332,759,883 | 332,759,879 | 104,072,333 | 165,206,831 |
| C11 (wheel, cp312) | 9,822,137 | 10,378,168 | 12,797,714 | 11,266,316 |

### M4. Start, stop, removal (commands are derived from the PostgreSQL 18 documentation and each source's path facts; none was executed)

| ID | Initialise | Start | Stop | Removal |
|---|---|---|---|---|
| C1 | wrapper `await pg.initialise()` or `<bin>/initdb ...` | wrapper `await pg.start()` or `pg_ctl ... start` | wrapper `await pg.stop()` (SIGINT; `taskkill /f` on Windows) or `pg_ctl ... stop -m fast` | `npm uninstall embedded-postgres`; delete the data directory |
| C2 | `binPath("initdb")` then `initdb ...` | `binPath("pg_ctl")` then `pg_ctl ... start`; disposable: `createEphemeralCluster()` | `pg_ctl ... stop -m fast`; disposable: `cluster.stop()` | `npm uninstall @serve-tools/postgres`; delete the data directory |
| C3 | `/opt/homebrew/opt/postgresql@18/bin/initdb -D <dir> ...` | `/opt/homebrew/opt/postgresql@18/bin/pg_ctl -D <dir> -l <log> -o "..." start` | `pg_ctl -D <dir> stop -m fast` | `brew uninstall postgresql@18`; `brew cleanup --prune-prefix`; delete `/opt/homebrew/var/postgresql@18` and its log; `brew autoremove` for `krb5`; delete the project data directory |
| C4 | not needed (`--db=<dir>` creates it) | `pglite-server --db=<dir> --port=<port> --host=127.0.0.1` | end the process or `server.stop()` in the API | `npm uninstall @electric-sql/pglite @electric-sql/pglite-socket`; delete the database folder |
| C5, C6, C8 | `initdb ...` from the extracted folder | `pg_ctl ... start` | `pg_ctl ... stop -m fast` | delete the extraction folder and the data directory |
| C7 | the app runs `initdb` on first start; or call `/Applications/Postgres.app/Contents/Versions/<N>/bin/initdb` | the app, or `pg_ctl ... start` | quit the app, or `pg_ctl ... stop` | remove the app from `/Applications`; delete its data directory |
| C9 | library call | library `start()` | library `cleanup()` | `npm uninstall pg-embedded`; delete the installation and data folders |

### M5. Known issues and Node 26 status

| ID | Node 26 evidence | Other known issues |
|---|---|---|
| C1 | none reported; upstream CI on Node 20.x only; pure JS wrapper, no native addon; run on this host not tested | postinstall needed (#30, PR #27); `stop()` stall (#32); no start timeout (#34); password temp-file mode (#33); SIGINT/force-kill shutdown (#38); two minors behind current |
| C2 | CI verify job on Node 22, 24, 26 (Linux); macOS arm64 smoke on Node 24; run on this host not tested | 0.1.0; single maintainer; no issues filed |
| C3 | not applicable | install creates a cluster under `/opt/homebrew/var`; non-relocatable; stale `postmaster.pid` caveat |
| C4 | open `nodejs/node#64500` about intermittent V8 WebAssembly crashes with PGlite on Node 22 to 26 (Linux x64 reports); original reporter attributes his case to hardware; Node 26.8.2 status not confirmed | single connection; multiplexer caveat; 169 open issues |
| C5, C6, C8 | not applicable | none collected |
| C7 | not applicable | none collected |
| C9 | not confirmed | no release in about 12 months; PostgreSQL 18.0 |
| C10, C11 | not confirmed | stale (2024); C11 no wheel for the host Python |
| C12 | not applicable | needs conda (absent) |

---

## Generic Lifecycle Commands (PostgreSQL 18 documentation; apply to every candidate that ships `initdb` and `pg_ctl`)

All quoted facts fetched 2026-10-04 from `https://www.postgresql.org/docs/18/app-pg-ctl.html`, `.../app-initdb.html`, `.../runtime-config-connection.html`.

| Topic | Documented fact |
|---|---|
| `pg_ctl` synopsis | `pg_ctl start [-D datadir] [-l filename] [-W] [-t seconds] [-s] [-o options] [-p path] [-c]`; `pg_ctl stop [-D datadir] [-m s[mart]\|f[ast]\|i[mmediate]] ...`; `pg_ctl status [-D datadir]` |
| Shutdown mode | "`mode` can be `smart`, `fast`, or `immediate` ... If this option is omitted, `fast` is the default." |
| Passing server options | "`-o options` ... Specifies options to be passed directly to the `postgres` command. `-o` can be specified multiple times" |
| `initdb` options | `-D directory` / `--pgdata`, `-U username`, `-A authmethod`, `--auth-host`, `--auth-local`, `--pwfile=filename`, `-k` / `--data-checksums`, `--locale-provider={builtin\|libc\|icu}` |
| `listen_addresses` | "The default value is `localhost`, which allows only local TCP/IP 'loopback' connections to be made" |
| `unix_socket_directories` | "The default value is normally `/tmp`, but that can be changed at build time. On Windows, the default is empty, which means no Unix-domain socket is created by default." Settable only at server start |
| Illustrative command shapes (not executed, `<...>` are placeholders) | `<bin>/initdb -D <datadir> -U <user> --auth-local=<method> --auth-host=<method> --pwfile=<file>`; `<bin>/pg_ctl -D <datadir> -l <logfile> -o "-p <port> -c listen_addresses=127.0.0.1 -c unix_socket_directories=<dir>" start`; `<bin>/pg_ctl -D <datadir> stop -m fast` |
| Support windows (postgresql.org) | 18: 18.6, supported until 2030-11-14; 17: 17.11, until 2029-11-08; 16: 16.15, until 2028-11-09; 15: 15.19, until 2027-11-11; 14: 14.24, until 2026-11-12 |

---

## Query Log

Every web query string, registry search, registry lookup and fetched URL made for this row. All queries are generic technology queries. No project name, product name, personal name, file content or design-document term appears in any query or URL. Local read-only probes are listed separately below.

### Web search queries (WebSearch tool, mode standard)

| # | Exact query string |
|---|---|
| W1 | `postgresql binaries npm package macOS arm64 without docker` |
| W2 | `embedded postgres node.js macOS arm64 dyld library not loaded known issue` |
| W3 | `node-postgres pg Node.js 26 compatibility` |
| W4 | `homebrew postgresql keg-only run pg_ctl without brew services custom data directory` |
| W5 | `PGlite WASM Postgres which PostgreSQL major version single connection extensions limitations` (the search tool issued one further internal follow-up search for the PostgreSQL major version; its text is not exposed) |
| W6 | `EDB PostgreSQL graphical installer macOS creates launchd service postgres user administrator password` |
| W7 | `postgresql windows zip binaries initdb pg_ctl start without installer or service` |

### npm registry searches (`npm search "<text>" --json`, registry `https://registry.npmjs.org/-/v1/search`)

| # | Exact search text |
|---|---|
| N1 | `embedded postgres` |
| N2 | `postgresql binaries` |
| N3 | `portable postgres server` |
| N4 | `postgres binaries` |
| N5 | `pg embedded server` |
| N6 | `postgresql local server test database` |

### npm registry lookups (`npm view <package> <fields>`, registry URL `https://registry.npmjs.org/<package>`, with `NPM_CONFIG_CACHE` in a temporary scratch folder)

`embedded-postgres` (version, license, unpackedSize, maintainers, repository, time, engines, dist-tags, dependencies, optionalDependencies, versions, time); `@embedded-postgres/darwin-arm64`, `darwin-x64`, `linux-x64`, `windows-x64`, `linux-arm64`, `linux-arm`, `linux-ia32`, `linux-ppc64`, `windows-ia32` (HTTP 404); `pg`; `async-exit-hook`; `@serve-tools/postgres` (including `readme`, `dist.attestations`); `@serve-tools/postgres-darwin-arm64`, `-darwin-x64`, `-linux-x64-gnu`, `-linux-arm64-gnu`, `-win32-x64`; `@electric-sql/pglite`; `@electric-sql/pglite-socket` (including `readme`); `@prisma/dev`; `tinbase`; `@flasham/embedded-postgres-windows-x64`; `postgresql-dist-darwin-arm64`, `-darwin-x64`, `-linux-x64`, `-win32-x64`, `postgresql-dist`; `pg-embedded` (including `readme`); `@pg-ts/pg-embedded-darwin-arm64`, `-darwin-x64`, `-win32-x64-msvc`, `-linux-x64-gnu`, `-win32-x64` (HTTP 404); `@testcontainers/postgresql`; `@databases/pg-test`; `pg-mem` (including `readme`).

### Homebrew lookups (local `brew`, read-only, `HOMEBREW_NO_AUTO_UPDATE=1`)

`brew --version`; `brew config`; `brew info postgresql@17`; `brew info postgresql@18`; `brew info --json=v2 postgresql@17 postgresql@18`; `brew info --json=v2 krb5`; `brew deps --tree postgresql@18`; `brew deps krb5`; `brew list --versions icu4c@78 krb5 lz4 openssl@3 readline zstd gettext`; `brew list --formula`; `brew help uninstall`; `brew help autoremove`; `brew help cleanup`.

### Fetched URLs (text or JSON; no binary payload downloaded)

| # | URL | Method | Used for |
|---|---|---|---|
| U1 | `https://github.com/leinelissen/embedded-postgres` | fetch tool | C1 overview (cross-checked against raw README) |
| U2 | `https://raw.githubusercontent.com/leinelissen/embedded-postgres/main/README.md` | curl and fetch tool | C1 licence, platforms, options, Node note |
| U3 | `.../embedded-postgres/main/LICENSE` | curl (HTTP 404) | no root licence file |
| U4 | `.../embedded-postgres/main/package.json` | curl | root workspace manifest |
| U5 | `.../embedded-postgres/main/packages/embedded-postgres/src/index.ts`, `.../src/binary.ts`, `.../src/postgres-options.ts` (HTTP 404) | curl | C1 start and stop code |
| U6 | `.../embedded-postgres/main/.github/workflows/test.yml` | curl | C1 CI matrix |
| U7 | `https://api.github.com/repos/leinelissen/embedded-postgres`, `.../issues?state=open&per_page=60`, `.../issues/{24,27,30}` and their `/comments`, `https://api.github.com/search/issues?q=repo:leinelissen/embedded-postgres+node+24` (also `+macOS+arm64`, `+Tahoe`) | curl | C1 known issues |
| U8 | `https://unpkg.com/@embedded-postgres/darwin-arm64@18.4.0-beta.17/?meta`, `/LICENSE.md`, `/README.md`, `/scripts/hydrate-symlinks.js`, `/package.json` | curl | C1 package contents |
| U9 | `https://raw.githubusercontent.com/zonkyio/embedded-postgres-binaries/master/README.md`, `.../zonkyio/embedded-postgres/master/README.md` | curl | C6 |
| U10 | `https://www.postgresql.org/about/licence/` | fetch tool | PostgreSQL License facts |
| U11 | `https://www.postgresql.org/support/versioning/` | curl | current minors and support windows |
| U12 | `https://www.postgresql.org/docs/18/app-pg-ctl.html`, `.../app-initdb.html`, `.../runtime-config-connection.html` | curl | generic lifecycle |
| U13 | `https://raw.githubusercontent.com/Homebrew/homebrew-core/HEAD/Formula/p/postgresql@18.rb`, `.../postgresql@17.rb` | curl | C3 formula |
| U14 | `https://ghcr.io/token?service=ghcr.io&scope=repository:homebrew/core/postgresql/18:pull` (also `postgresql/17`, `krb5`), then `https://ghcr.io/v2/homebrew/core/postgresql/18/manifests/18.6-1`, `.../postgresql/17/manifests/17.11`, `.../krb5/manifests/1.22.2`, `.../krb5/manifests/latest` (HTTP 404) | curl (anonymous token, manifest JSON only) | C3 sizes |
| U15 | `https://unpkg.com/@serve-tools/postgres-darwin-arm64@0.1.0/?meta`, `/build-manifest.json`, `/pg/COPYRIGHT`, `/package.json` | curl | C2 |
| U16 | `https://raw.githubusercontent.com/serve-tools/postgres/main/README.md`, `.../LICENSE` (HTTP 404), `.../package.json`, `.../.github/workflows/ci.yml` (also `test.yml`, `verify.yml`: HTTP 404) | curl | C2 |
| U17 | `https://api.github.com/repos/serve-tools/postgres`, `.../issues?state=all&per_page=20`, `.../contents/.github/workflows` | curl | C2 |
| U18 | `https://api.github.com/repos/theseus-rs/postgresql-binaries`, `.../releases/latest`, `.../releases?per_page=30`; `https://raw.githubusercontent.com/theseus-rs/postgresql-binaries/main/README.md`; `https://raw.githubusercontent.com/theseus-rs/postgresql-embedded/main/README.md` | curl | C5 |
| U19 | `https://api.github.com/repos/PostgresApp/PostgresApp`, `.../releases/latest`; `https://raw.githubusercontent.com/PostgresApp/PostgresApp/master/README.md`; `https://postgresapp.com/`; `https://www.postgresql.org/download/macosx/` | curl and fetch tool | C7 |
| U20 | `https://www.enterprisedb.com/download-postgresql-binaries` (curl and fetch tool); `https://get.enterprisedb.com/postgresql/postgresql-{18.6,17.11}-1-{osx,windows-x64,linux-x64}-binaries.{zip,tar.gz}` (HEAD requests only); `https://www.enterprisedb.com/docs/supported-open-source/postgresql/installing/macos/` (curl); `https://www.enterprisedb.com/docs/postgresql_journey/02_installing/04_macos/` (fetch tool) | curl, fetch tool | C8, X5 |
| U21 | `https://pypi.org/pypi/pgserver/json`; `https://api.anaconda.org/package/conda-forge/postgresql` | curl | C11, C12 |
| U22 | `https://repo1.maven.org/maven2/io/zonky/test/postgres/embedded-postgres-binaries-{darwin-arm64v8,darwin-amd64,windows-amd64,linux-amd64}/maven-metadata.xml`, the 18.6.0 `.jar` (HEAD only) and the darwin-arm64v8 18.6.0 `.pom` | curl | C6 |
| U23 | `https://raw.githubusercontent.com/electric-sql/pglite/main/README.md`, `.../.gitmodules`, `.../packages/pglite/package.json`; `https://api.github.com/repos/electric-sql/pglite`, `.../electric-sql/postgres-pglite`, `.../electric-sql/pglite/issues/{1053,884}` and `/1053/comments`, search `repo:electric-sql/pglite+node+26` and `+"node+24"`; `https://pglite.dev/docs/upgrade`, `https://pglite.dev/docs/`; `https://electric-sql.com/blog/2026/03/25/announcing-pglite-v04` | curl | C4 |
| U24 | `https://api.github.com/repos/nodejs/node/issues/64500` and `/comments` | curl | C4 Node issue state |
| U25 | `https://raw.githubusercontent.com/PgTsLabs/pg-embedded/main/Cargo.toml`; `https://api.github.com/repos/PgTsLabs/pg-embedded` | curl | C9 |
| U26 | `https://node-postgres.com/`; `https://raw.githubusercontent.com/brianc/node-postgres/master/.github/workflows/ci.yml` | curl | `pg` Node 26 CI |
| U27 | `https://node.testcontainers.org/` and `.../supported-container-runtimes/`; `https://www.atdatabases.org/docs/pg-test` | fetch tool | X2, X3 |
| U28 | `https://api.github.com/repos/tapppi/async-exit-hook` | curl | wrapper dependency state |

### Local read-only probes

`date`; `uname -m`; `node -v`; `npm -v`; `npm config get ignore-scripts`; `npm config get registry`; `cat .npmrc`; root `package.json` read; `command -v` for `docker podman colima conda mamba micromamba nix port mise asdf python3 psql postgres pg_ctl initdb java`; `ls ~/Library/LaunchAgents` (filtered for postgres or homebrew; none); `ls /opt/homebrew/var`; `df -h` on the workspace volume; `arch -x86_64 /usr/bin/true` (Rosetta probe; the only process spawned besides the tools above, and not a PostgreSQL process); `pgrep -x oahd` (could not read the process list in the sandbox: inconclusive, the `arch` probe is the result relied on). No PostgreSQL process was started, nothing was installed, no package or binary body was downloaded; temporary text files were written only to a temporary scratch folder.

---

## Gaps / Needs More Data

| # | Gap | Why not closed |
|---|---|---|
| G1 | Whether C1, C2, C4 or C9 actually run on Node 26.8.2 on this host | Install and execution are outside the row's rules. No Node 26 failure report was found for C1 or C2 |
| G2 | PostgreSQL major version inside `@electric-sql/pglite` 0.5.8 | Not stated in the README or docs read; only the fork's default branch name is known |
| G3 | Whether the darwin binaries in C1 and C6 are universal (arm64 plus x86_64) | Package sizes are near-identical and one issue mentions "both architectures"; no file inspection was done |
| G4 | Whether the EDB macOS archive is arm64, x86_64 or universal | The page label is "Mac OS X"; the archive was not opened |
| G5 | Whether `@serve-tools/postgres` 0.1.0 carries npm provenance attestations | `dist.attestations` was absent in `npm view`, while `publishConfig.provenance` is true |
| G6 | Whether Homebrew's `brew uninstall` leaves `/opt/homebrew/var/postgresql@18` in place | Inferred from the formula source and `brew help` text; not run |
| G7 | Whether files fetched through npm or curl carry the macOS quarantine attribute and how Gatekeeper treats the unsigned or ad-hoc-signed PostgreSQL binaries on macOS 27 | Not tested; no file was downloaded |
| G8 | The unix-socket location and `listen_addresses` actually used by C1's wrapper at runtime | Wrapper source sets neither; the result depends on the binary's build defaults and caller flags |
| G9 | Minimum macOS version of the Postgres.app 2.9.6 binaries; macOS x64 support of the DMG | Not stated in the README or release notes read |
| G10 | Open issues of C5 (14 open) and of Postgres.app (149 open) were counted, not read | Out of the row's depth |
| G11 | PostgreSQL version bundled by pgserver 0.1.4; licence field of pgserver | Not in the PyPI metadata |
| G12 | Compressed download sizes for the npm tarballs | The registry returned no Content-Length on header requests |
| G13 | Hosted or cloud products | Excluded by category; nothing collected |

---

## Collection Log

Times are approximate, WIB, 2026-10-04.

| Time | Action | Details |
|---|---|---|
| 01:28 | Read | `identification/02_structured.md` (row 6), `decisions/decisions.md` (D5) |
| 01:28 | Probed | host versions; first `npm view` blocked by cache EPERM; switched to scratchpad cache |
| 01:29 | Collected | npm metadata for C1 and its platform packages |
| 01:30 | Collected | C1 README, source, package contents (unpkg listing) |
| 01:31 | Collected | C3: `brew info`, formula source, OCI manifests |
| 01:33 | Collected | C2 and its upstream C5 |
| 01:35 | Searched | npm registry searches N1-N6 and web searches W1-W4 |
| 01:36 | Collected | C4 (PGlite), C7 (Postgres.app), C8 (EDB) |
| 01:39 | Collected | C6, C9, C10, C11, C12 metadata; exclusion evidence X2, X3, X6 |
| 01:41 | Collected | known issues for C1 and C4, nodejs/node#64500; PostgreSQL docs for generic lifecycle |
| 01:43 | Searched | W5, W6, W7; EDB page and postgresql.org macOS page |
| 01:55 | Wrote | this file and the progress file |

---
*Generated: 2026-10-04 01:55 WIB*
*Last Updated: 2026-10-04 01:55 WIB*
