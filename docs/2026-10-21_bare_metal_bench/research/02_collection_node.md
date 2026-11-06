---
task_id: 2026-10-21_bare_metal_bench
date: 2026-10-22
agent: data-collector
items_collected: 9
---

# Collection: Node.js linux-x64 archive and checksums (Q10, row 8)

Tier 2. Collection only. Fetched 2026-10-22 with curl from nodejs.org.

## 1. Repo pin (source: repo files)
- `package.json:6-8`: `"engines": { "node": ">=26.8.2 <27" }`
- `.node-version`: content `26.8.2` (cat output). `.nvmrc`: does not exist.
- `scripts/host/HOST-PROFILE-UBUNTU-24.04.md:66` (HOST-09): "Node.js 26.8.2, the version the repository pins (`.node-version`), installed under a root-owned path"; method: official Linux binary archive unpacked as root, checksum compared with the publisher's list by the user; check `node --version` prints `v26.8.2`.

## 2. Version in range
- 26.8.2 exists on nodejs.org (dist index: v26.8.2, date 2026-09-09, lts=false, security=false) - https://nodejs.org/dist/index.json
- Later 26.x releases exist inside `>=26.8.2 <27`: v26.9.0 (2026-09-16), v26.10.0 (2026-09-21), v26.11.0/v26.11.1 (2026-10-07), v26.12.0 (2026-10-14), v26.12.1 (2026-10-21, flagged security=true in index.json). Latest in index at fetch: v26.12.1.
- The repo exact pin is `.node-version` = 26.8.2 and HOST-09 names 26.8.2; so 26.8.2 matches the pin exactly and is within the engines range. A later patch inside the range exists (v26.12.1); choosing it would deviate from `.node-version` / HOST-09 (controller decision, not made here).
- For reference only, v26.12.1 linux-x64.tar.xz line (https://nodejs.org/dist/v26.12.1/SHASUMS256.txt): `6170b2d474e1c626f43cff3adc118df9fe3b573258a4fc3d850c8dbc6b079bbd  node-v26.12.1-linux-x64.tar.xz`

## 3. Publisher URLs for 26.8.2 (all HTTP 200 on HEAD/GET)
- Archive (.tar.xz): https://nodejs.org/dist/v26.8.2/node-v26.8.2-linux-x64.tar.xz
- Alternative (.tar.gz): https://nodejs.org/dist/v26.8.2/node-v26.8.2-linux-x64.tar.gz
- Checksum list: https://nodejs.org/dist/v26.8.2/SHASUMS256.txt
- Signed (clearsigned) form: https://nodejs.org/dist/v26.8.2/SHASUMS256.txt.asc (begins `-----BEGIN PGP SIGNED MESSAGE-----`, `Hash: SHA256`)
- Detached signature: https://nodejs.org/dist/v26.8.2/SHASUMS256.txt.sig
- Directory: https://nodejs.org/dist/v26.8.2/

## 4. Checksum line, verbatim from the publisher list
From https://nodejs.org/dist/v26.8.2/SHASUMS256.txt (identical line in SHASUMS256.txt.asc):
```
40e1d3225c1c9ae9a2671c98ecb9857e4d5555026394f348645676798840d5c5  node-v26.8.2-linux-x64.tar.xz
```
Do not confuse with the musl and gz lines in the same list (not the target):
```
badb3fe6a61b85e1352ca6564dc56b8b7bd5ecd5c474c52acc21dd0cdd586f35  node-v26.8.2-linux-x64.tar.gz
e174fe6faf29bf1b02531e81e97989cb62690c305684e7364cdc1c24f482c237  node-v26.8.2-linux-x64-musl.tar.xz
```
The SHASUMS256.txt.asc signature itself was NOT verified here (no gpg step run; read-only collection).

## 5. Where the release signing keys are published
Note: these are on github.com/nodejs, not nodejs.org (nodejs.org carries the files above; the key list is in the Node.js README, which the nodejs.org download page defers to). Not fetched from nodejs.org.
- Release keys repository: https://github.com/nodejs/release-keys
- Trusted keyring (README.md of nodejs/node, lines 113-116): `curl -fsLo "/path/to/nodejs-keyring.kbx" "https://github.com/nodejs/release-keys/raw/HEAD/gpg/pubring.kbx"`
- Active-keys keyring (README.md line 812): https://github.com/nodejs/release-keys/raw/refs/heads/main/gpg-only-active-keys/pubring.kbx (HTTP 200)
- README key list: https://github.com/nodejs/node#release-keys. Current releasers and fingerprints as printed there (lines 818-825, `gpg --keyserver hkps://keys.openpgp.org --recv-keys <fpr>`):
  - Antoine du Hamel 5BE8A3F6C8A5C01D106C0AD820B1A390B168D356
  - Juan Jose Arboleda DD792F5973C6DE52C432CBDAC77ABFA00DDBF2B7
  - Marco Ippolito CC68F5A3106FF448322E48ED27F5E38D5B0A215F
  - Rafael Gonzaga 890C08DB8579162FEE0DF9DB8BEAB4DFCF555EF4
  - Richard Lau C82FA3AE1CBEDC6BE46B9360C43CEC45C17AB93C
  - Ruy Adorno 108F52B48DB57BB0CC439B2997B01419BD92F80A
  - Stewart X Addison 655F3B5C1FB3FA8D1A0CA6BDE4A7D232B936D2FD
  - Ulises Gascon A363A499291CBBC940DD62E41F10027AF002F8B0
- Which key signed the 26.8.2 list: not determined (signature not inspected).

## Gaps
- Signature verification and signer key id for 26.8.2 not checked.
- Key list taken from the GitHub README (raw.githubusercontent.com), outside the nodejs.org-only restriction; flagged for the controller.
