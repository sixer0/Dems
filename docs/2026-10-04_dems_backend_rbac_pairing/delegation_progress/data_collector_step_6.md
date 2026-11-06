---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: data-collector
blueprint_row: 6
status: complete
date: 2026-10-04
last_updated: 2026-10-04 01:58 WIB
---

# Progress: data-collector, step 6 (PostgreSQL provisioning evidence)

## Status

complete

## Files created

| Path | Purpose |
|---|---|
| `research/02_collection.md` | The Tier 2 collection (577 lines): host facts H1-H10, candidates C1-C12 (each with version, licence, maintainer, platform coverage, install size, start/stop/removal, known issues, Node 26 status, URL and fetch date), exclusions X1-X7, five fact matrices, generic `pg_ctl`/`initdb` command facts from the PostgreSQL docs, the full query log, gaps G1-G13 |
| `delegation_progress/data_collector_step_6.md` | This file |

No other file in the repository was written. Temporary text fetched for reading was written only to the session scratchpad.

## Milestones

| Time (WIB) | Milestone |
|---|---|
| 01:28 | Read row 6 and decision D5; probed host (macOS 27.0.1 arm64, Node v26.8.2, npm 11.19.1, Homebrew 6.0.22) |
| 01:31 | Homebrew keg facts: formula source, `brew info`, OCI manifests for bottle and installed sizes |
| 01:35 | npm candidates enumerated by registry search and per-package `npm view` |
| 01:43 | Other routes collected (Postgres.app, EDB archives, theseus-rs archives, Maven Central artifacts, PyPI, conda-forge, PGlite) |
| 01:55 | Collection written; corrections applied after cross-checking line numbers and page contents |

## Verification-criteria check (row 6)

| Criterion | Result |
|---|---|
| At least 3 candidates, each with URL and fetch date for version, licence and platform coverage | 12 candidates; C1, C2, C3 carry full tables with sources; every section cites URLs fetched 2026-10-04 |
| Candidates needing Docker, an account, a cloud service or a system service marked excluded with the reason | X1-X7 (Docker image, Testcontainers, `@databases/pg-test`, `brew services` mode, EDB interactive installer, `pg-mem`, hosted products). X5's service registration is flagged not confirmed from a primary source |
| Query log lists every query; no design-book term | 7 web queries, 6 registry searches, the registry and Homebrew lookups and 28 URL groups listed; the Query Log section was scanned and contains none of the project or domain terms checked |

## Findings the controller may want in findings.md (facts, not conclusions)

| Ref | Fact | Source (all fetched 2026-10-04) |
|---|---|---|
| FX1 | npm route 1: `embedded-postgres` 18.4.0-beta.17 (MIT wrapper, platform package 147.7 MB unpacked on macOS arm64, covers macOS arm64/x64, Windows x64, Linux x64). It needs a `postinstall` to recreate dylib symlinks; the bundle holds only `initdb`, `pg_ctl`, `postgres` (no `psql`, `pg_dump`); the package ships no PostgreSQL COPYRIGHT file; open lifecycle issues #32, #33, #34, #38 | registry; upstream README and issue tracker |
| FX2 | npm route 2: `@serve-tools/postgres` 0.1.0 (PostgreSQL 18.4.0, 33.7 MB unpacked on macOS arm64, no install script, full client tools, PostgreSQL licence text shipped). Created 2026-08-07, one maintainer, no attestations returned by the registry. CI runs its verify job on Node 22, 24 and 26 (Linux) | registry; upstream README, CI file |
| FX3 | Homebrew `postgresql@18` 18.6 / `postgresql@17` 17.11: bottle for macOS 27 arm64 exists (20.8 MB bottle, 77.7 MB installed). The formula's `post_install_steps` creates a default cluster at `/opt/homebrew/var/postgresql@18` and symlink trees under `/opt/homebrew`; `krb5` is the one missing dependency on this host; no Windows bottle, no Intel-macOS bottle for `@18` | formula source lines 119-129; OCI manifests |
| FX4 | PGlite 0.5.8 is PostgreSQL compiled to WebAssembly in single-user mode; the socket server multiplexes connections with a documented caveat. Open Node issue `nodejs/node#64500` concerns intermittent V8 WebAssembly crashes with PGlite on Node 22 to 26 | PGlite README; Node issue API |
| FX5 | The current PostgreSQL minors are 18.6 and 17.11 (postgresql.org); the npm wrapper `embedded-postgres` and the loader `@serve-tools/postgres` both carry 18.4.0, while Homebrew, theseus-rs, Maven Central (zonky) and Postgres.app carry 18.6 | versioning page; each source |
| FX6 | Rosetta 2 is not installed on the host, so an x86_64-only macOS archive cannot run here; the EDB macOS archive's architecture is unconfirmed | `arch -x86_64 /usr/bin/true` probe |
| FX7 | Docker and Colima are installed on the host; D5 excludes them regardless | `command -v` probe |

## Blockers

None blocking. Two environment notes:

1. The sandbox blocked npm's default cache directory (`EPERM`). All `npm view` and `npm search` calls were run with `NPM_CONFIG_CACHE` set to a folder in the session scratchpad. No sandbox bypass was used anywhere.
2. The `Edit` tool was unavailable in this session; corrections to the output file were applied with a small script that asserted each target string matched exactly once (11 of 11 applied).

## Decisions and judgement calls recorded

1. **Header-only requests were used** for EDB archive existence, Maven JAR sizes and npm tarballs. No archive, JAR, tarball, DMG or binary body was downloaded. The OCI manifest fetches from the Homebrew registry used an anonymous token and returned JSON only. If the controller reads "metadata lookups ... contact the npm registry / Homebrew API only" strictly, the GHCR, unpkg, Maven Central, GitHub API and EDB header requests go slightly beyond those two hosts; all are read-only metadata, and none installed or started anything.
2. **One diagnostic process was spawned**: `arch -x86_64 /usr/bin/true`, to test for Rosetta. It is not a PostgreSQL process.
3. **No ranking or recommendation** was written. The preference order between C1, C2 and C3 is left to row 14 (TD-02); the document gives facts per candidate and notes which D5 rule each fact touches.
4. **Claims resting on summarising readers** (the fetch tool) are labelled as such in the document where they carry weight (Postgres.app and postgresql.org macOS pages, Testcontainers runtime page, EDB installer docs); where a raw-HTML or API cross-check was possible it was done and the raw result used (EDB page, PGlite and zonky details, Homebrew formula).
5. **Not confirmed items** (G1-G13 in the document) were left as "not confirmed" rather than estimated, notably: runtime behaviour on Node 26.8.2 (no installs allowed), PGlite's embedded PostgreSQL major version, universal-binary status of the darwin builds, EDB macOS architecture, npm provenance of `@serve-tools/postgres`, quarantine and Gatekeeper behaviour of extracted binaries on macOS 27.

## Suggested follow-ups for the controller (not done by this row)

- Row 14 needs a decision on whether a short execution trial of the chosen npm route on Node 26.8.2 belongs in the initialization step (G1, G7, G8 can only be closed by running it).
- If a portable live package is costed (TD-13), the Q7 platform columns are in matrices M2 and M3 of the collection.
