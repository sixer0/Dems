---
task_id: 2026-10-21_bare_metal_bench
row: 10
source_question: Q12
agent: data-collector
date: 2026-10-22
tier: 2
---
# Q12: PGDG apt repository for Ubuntu 24.04 (noble), PostgreSQL 18

Collection only. Checked 2026-10-22 (fetched live).

## 1. Major version the project expects
- `deploy/docker/compose.yaml:34`: `image: ${DEMS_POSTGRES_IMAGE:-postgres:18.4@sha256:a02db8ca...}` -> major 18, minor 18.4.
- `scripts/host/HOST-PROFILE-UBUNTU-24.04.md:144`: dev machine runs PostgreSQL 18.4 (embedded macOS binaries); no Linux procedure exists.
- HOST-50 (line 148): open choice A distro package (author recalls 16), B PGDG packages "version 18", C embedded binaries (not usable).
- HOST-51 (line 149): "18.4 is the only one the migrations and the database tests have run on"; another major = untested server unless B/C is taken.
- HOST-52..56 (lines 150-154): data dir 0700 outside install-dir; listen 127.0.0.1 only; owner + runtime roles; database `dems_demo`; Core starts after the DB server (unit name depends on HOST-50).

## 2. Repository (official, deb822)
Source: https://www.postgresql.org/download/linux/ubuntu/ (manual configuration). The page's example uses suite `resolute`; the noble form below substitutes the codename as the page instructs ("The distributions are called codename-pgdg"). The substitution is mine, the structure is the page's.

```
sudo apt install curl ca-certificates
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
```
`/etc/apt/sources.list.d/pgdg.sources`:
```
Types: deb deb-src
URIs: https://apt.postgresql.org/pub/repos/apt
Suites: noble-pgdg
Architectures: amd64
Components: main
Signed-By: /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
```
Then `sudo apt update` and `sudo apt install postgresql-18`.
Wiki https://wiki.postgresql.org/wiki/Apt lists "noble (24.04)" as supported and gives the same deb822 template. Suite check: https://apt.postgresql.org/pub/repos/apt/dists/noble-pgdg/Release (Suite/Codename noble-pgdg, Date Mon, 19 Oct 2026 15:01:16 UTC, Architectures amd64 arm64 ppc64el, Components include 18).

## 3. Signing key
- URL: https://www.postgresql.org/media/keys/ACCC4CF8.asc (key ID ACCC4CF8, from the URL).
- Fingerprint as PUBLISHED: neither the download page nor the wiki page Apt states a fingerprint (WebFetch of both, plus grep of raw HTML for "fingerprint" / the ID: no hit). Not found on postgresql.org pages fetched.
- Fingerprint COMPUTED by me from the downloaded key file (4812 bytes, not a published value): v4 primary key, SHA-1 over the primary key packet (python, no gpg on this Mac):
  `B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8`
  Its last 8 hex digits equal the published key ID ACCC4CF8, which is consistent. Hypothesis until compared on the host with `gpg --show-keys --with-fingerprint` against an independent official source; row 39 gate "fingerprint matches row 10" should use this value only after that check.

## 4. Package names and versions (noble, amd64)
Source: https://apt.postgresql.org/pub/repos/apt/dists/noble-pgdg/main/binary-amd64/Packages.gz (Release dated 2026-10-19).
| Package | Role | Versions in index |
|---|---|---|
| `postgresql-18` | server | 18.6-1.pgdg24.04+2 (current), 18.4-1.pgdg24.04+1, 18.3-1.pgdg24.04+1 |
| `postgresql-client-18` | client (psql etc.) | same three versions |
| contrib | no `postgresql-contrib-18` exists; the index lists `postgresql-contrib-*` only for 8.2-9.x. Contrib is therefore not a separate package for 18 (index evidence; the contents of postgresql-18 were not listed) | - |
| `postgresql-server-dev-18`, `postgresql-doc-18`, `libpq-dev` | per postgresql.org download page | not checked in index |
- postgresql-18 Depends (18.6): postgresql-client-18 (= same version), postgresql-common (>= 275~), ssl-cert, libicu74, libpq5 (>= 17~~), liburing2, etc.
- Current 18.x for noble: 18.6. The project's 18.4 is still in the index (pinnable: `apt install postgresql-18=18.4-1.pgdg24.04+1 postgresql-client-18=18.4-1.pgdg24.04+1`; older versions may be pruned later).
- Index also lists 19 and 20 pool directories (https://apt.postgresql.org/pub/repos/apt/dists/noble-pgdg/): a plain `postgresql` metapackage may point at a newer major, so name `postgresql-18` explicitly.

## 5. Alternative: script route
Source: https://www.postgresql.org/download/linux/ubuntu/
```
sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh
```
Wiki quickstart: `sudo apt install -y postgresql-common ca-certificates` then the same script; it sets the suite from VERSION_CODENAME in /etc/os-release. The script was not run or read here (contents unseen).

## Gaps
- Published fingerprint not found on postgresql.org; computed value above needs independent confirmation.
- Contents of postgresql-18 (contrib extensions present) not verified.
- Whether the host can reach apt.postgresql.org (HOST-50 note) not checked here.
