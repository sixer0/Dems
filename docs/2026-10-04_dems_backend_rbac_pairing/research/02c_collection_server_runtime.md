---
task_id: 2026-10-04_dems_backend_rbac_pairing
date: 2026-10-04
agent: data-collector
blueprint_row: 8
narrative_tier: 2
items_collected: 88
items_counting_rule: 44 package rows (tables T-A 16, T-B 20, T-C 8) + 44 numbered findings (E 3, N 7, C 13, P 5, S 8, A 8)
last_updated: 2026-10-04
---

# Data Collection Report: Server Runtime (Fastify 5, official plugins, WebSocket fan-out)

Blueprint row 8 (FIRM). Collection only: no analysis, no recommendation, no installs, no processes started.
Fetch date for every URL in this document: **2026-10-04** (task date). The host clock `date -u` printed `2026-10-03` at the time of the first fetch (the host is ahead of UTC), so a few registry timestamps below are `2026-10-03T..Z`.

## 1. Task Overview

Source of truth read: `identification/02_structured.md` (row 8, line 281). Row text: collect evidence on Fastify 5.x on Node 26; the current versions of the official plugins a database-backed API needs (CORS, WebSocket, cookie or session, rate limit, static files with range requests, OpenAPI generation, schema type providers for zod 4); single-process WebSocket fan-out patterns (topics, backpressure, 20 Hz broadcast, authentication at upgrade).

Narrative tier 2: every finding states what was found, why it matters, how it was verified, and the source (URL, fetch date 2026-10-04, or `file:line` in the repo).

Reading guide:
- Section 2: query log (exact strings and URLs). Section 3: environment facts from the repo.
- Section 4: Fastify 5.x on Node 26. Section 5: plugin tables (version, licence, Fastify 5 compatibility, URL).
- Section 6: capability facts per plugin. Section 7: WebSocket fan-out patterns. Section 8: authentication at upgrade.
- Section 9: gaps and "not confirmed" items. Appendix A: raw `npm view` output.

## 2. Query Log (confidentiality: generic technology queries only)

### 2.1 Web search queries (exact strings, all 2026-10-04)

| # | Exact query string | Used for |
|---|---|---|
| Q1 | `Node.js ws library bufferedAmount backpressure slow client drop messages broadcast` | discovery of backpressure sources; summaries are secondary, primary sources fetched afterwards |
| Q2 | `WebSocket pub/sub topics single process Node.js fan-out many subscribers publish once serialize` | discovery of in-process topic libraries; result list was low quality, not cited as evidence |
| Q3 | `WebSocket authentication handshake browser cannot set Authorization header cookie subprotocol token upgrade` | discovery; led to the fetched Ably article and the OWASP and RFC primary sources |
| Q4 | `Fastify 5 Node.js 26 support compatibility` | result states Node 20+ only; no Node 26 statement found (see N-6) |
| Q5 | `fastify-type-provider-zod zod 4 OpenAPI swagger transform response serialization` | discovery; the README was fetched directly |
| Q6 | `real-time telemetry WebSocket server latest value wins conflation slow consumer fixed rate broadcast Node.js` | discovery of conflation; the one forum page fetched was insufficient (see P-5) |

Confidentiality check performed after the fact: a read-only grep of the task and predecessor identification and research documents for the query words. `conflation`, `slow consumer`, `pub/sub`, `latest value`, `fixed rate`: no match. `fan-out`, `broadcast`, `backpressure`: appear in the blueprint text as generic technical words. `telemetry` (used in Q6): appears in the predecessor analysis (the predecessor task folder, file `research/03_analysis.md`, lines 179, 348, 354, 477) only in the sense of tool telemetry opt-out, not as a design-book concept. No project name, product name, person name, file content or design-book term was placed in any query or URL. The controller may judge the word `telemetry`.

### 2.2 npm registry lookups (read-only, no install)

- Command form: `npm view <pkg> version license time.modified peerDependencies engines "time[<version>]" --cache $TMPDIR/npmc8` (the extra items are metadata fields of the same lookup; `dependencies` was also read for 8 packages).
- Registry endpoint the CLI used: `https://registry.npmjs.org/<pkg>` (confirmed by the 404 line `GET https://registry.npmjs.org/uWebSockets.js - Not found`).
- First attempt without `--cache` failed: `npm error code EPERM ... Your cache folder contains root-owned files` for `~/.npm/_cacache/tmp`. Recovery: a scratch cache directory `/tmp/claude-501/npmc8` was passed with `--cache`. The host cache was not modified. Nothing was installed.
- Raw output of every lookup is in Appendix A.
- Package list (43 registry packages plus one registry miss): fastify, fastify-plugin, @fastify/cors, @fastify/websocket, @fastify/cookie, @fastify/session, @fastify/secure-session, @fastify/jwt, @fastify/rate-limit, @fastify/static, @fastify/send, @fastify/swagger, @fastify/swagger-ui, @fastify/helmet, @fastify/under-pressure, @fastify/auth, @fastify/sensible, @fastify/request-context, @fastify/compress, @fastify/sse, @fastify/error, @fastify/bearer-auth, @fastify/accepts, fastify-type-provider-zod, fastify-zod-openapi, @fastify/type-provider-typebox, @fastify/type-provider-json-schema-to-ts, zod, zod-openapi, openapi-types, typebox, @sinclair/typebox, ws, @types/ws, bufferutil, sodium-native, socket.io, fastify-socket.io, fastify-uws, fastify-sse-v2, mqemitter, @colyseus/core, colyseus; plus `uWebSockets.js` (404 on the registry).

### 2.3 Fetched URLs (curl, byte-exact; HTTP status in brackets)

Plugin READMEs and sources (host raw.githubusercontent.com):
- `fastify/fastify-websocket/main/README.md` [200], `.../index.js` [200], `.../package.json` [200], `.../.github/workflows/ci.yml` [200]
- `fastify/fastify-cors/main/README.md` [200], `.../index.js` [200]
- `fastify/fastify-cookie/main/README.md` [200], `.../index.js` [200] (`plugin.js` and `cookie.js` [404])
- `fastify/session/main/README.md` [200], `.../package.json` [200], `.../index.js` [200] (`lib/fastifySession.js` [404])
- `fastify/fastify-secure-session/main/README.md` [200], `.../index.js` [200], `.../package.json` [200]
- `fastify/fastify-jwt/main/README.md` [200], `.../index.js` [200] (`jwt.js` [404])
- `fastify/fastify-rate-limit/main/README.md` [200], `.../index.js` [200]
- `fastify/fastify-static/main/README.md` [200], `.../index.js` [200]; `fastify/send/main/README.md` [200]
- `fastify/fastify-swagger/main/README.md` [200], `.../index.js` [200]; `fastify/fastify-swagger-ui/main/README.md` [200], `.../index.js` [200]
- `turkerdev/fastify-type-provider-zod/main/README.md` [200]; `samchungy/fastify-zod-openapi/master/README.md` [200]
- `fastify/under-pressure/main/README.md` [200], `.../index.js` [200]; `fastify/fastify-helmet`, `fastify-auth`, `fastify-sensible`, `fastify-compress`, `fastify-request-context` `main/README.md` [200 each]
- `Vanilla-IceCream/fastify-uws/main/README.md` [200]; `mcollina/mqemitter/master/README.md` [200] (`main` [404]); `ducktors/fastify-socket.io/master/README.md` [200] (`main` [404])
- CI evidence: `fastify/fastify/{5.x,main}/.github/workflows/ci.yml` [200], `fastify/fastify/{5.x,main}/package.json` [200], `fastify/fastify/{5.x,main}/docs/Reference/LTS.md` [200], `fastify/fastify/5.x/docs/Guides/Migration-Guide-V5.md` [200], `fastify/workflows/main/.github/workflows/plugins-ci.yml` [200], `fastify/workflows/ef591e2186785d5ab36b9fe6a79c7ce2f1d94e57/.github/workflows/{plugins-ci,plugins-ci-redis}.yml` [200], and `.github/workflows/ci.yml` of eight plugin repos besides websocket's (cors, cookie, rate-limit, static, swagger, swagger-ui, session, secure-session; content returned)
- `nodejs/Release/main/schedule.json` [200]; `nodejs/node/main/doc/api/{timers,perf_hooks}.md` [200]; `nodejs/nodejs.org/main/apps/site/pages/en/learn/modules/backpressure-in-streams.md` [404, not used]

WebSocket sources:
- `websockets/ws/master/README.md` [200], `.../doc/ws.md` [200], `.../package.json` [200], `.../lib/websocket.js` [200]
- `uNetworking/uWebSockets.js/master/README.md` [200], `.../LICENSE` [200], `.../examples/{PubSub,Backpressure,Broadcast,UpgradeAsync}.mjs` [200 each] (`index.d.ts`, `package.json` and `examples/*.js` on master [404]); tag `v20.71.0`: `index.d.ts` [200], `package.json` [200]
- `api.github.com/repos/uNetworking/uWebSockets.js/{releases/latest, contents/examples, contents/, contents/?ref=v20.71.0}` [200] (`contents/dist` [404] with and without ref)
- `https://socket.io/docs/v4/emitting-events/` [200], `https://socket.io/docs/v4/rooms/` [200]
- `https://docs.colyseus.io/room` [200]
- `OWASP/CheatSheetSeries/master/cheatsheets/WebSocket_Security_Cheat_Sheet.md` [200]; `https://www.rfc-editor.org/rfc/rfc6455.txt` [200]; `mdn/content/main/files/en-us/web/api/websocket/bufferedamount/index.md` [200]
- `facebook/react-native/{main,v0.86.0,v0.86.3}/packages/react-native/Libraries/WebSocket/WebSocket.js` [200], `.../main/packages/react-native/package.json` [200]
- `https://ably.com/blog/websocket-authentication` [200]; `https://oneuptime.com/blog/post/2026-01-24-websocket-broadcast-failed-errors/view` [200]; `https://community.developers.lseg.com/discussion/132074/what-is-jit-conflation-rto-and-time-conflation-rtmds-websocket` [200, insufficient]
- GitHub REST API (`api.github.com/repos/fastify/session/contents/lib`) returned `API rate limit exceeded` (unauthenticated). That lookup was dropped; `index.js` was fetched instead.

## 3. Environment Facts From the Repo

**E-1. Installed Fastify-family versions (the existing app).**
- Found: `apps/mock-core/package.json` pins `fastify 5.12.5` (line 19), `@fastify/cors 11.3.0` (17), `@fastify/websocket 11.3.1` (18), `tsx 4.23.15` (20); dev: `@types/node 26.6.3` (23), `@types/ws 8.18.2` (24), `oxlint 1.86.0` (25), `typescript 6.0.3` (26), `vitest 5.0.3` (27), `ws 8.22.0` (28). Installed copies match: `node_modules/fastify` 5.12.5, `@fastify/cors` 11.3.0, `@fastify/websocket` 11.3.1, `ws` 8.22.0, `fastify-plugin` 6.0.0, `zod` 4.6.5, `@types/ws` 8.18.2. Lockfile entries: `package-lock.json:3605` (cors 11.3.0), `:3715` (websocket 11.3.1), `:13744` (fastify 5.12.5), `:13777` (fastify-plugin 6.0.0), `:25587` (ws 8.22.0).
- Why it matters: it is the baseline against which "current version" below is compared.
- Verified: Read of `apps/mock-core/package.json`; Bash `grep -m1 '"version"' node_modules/<pkg>/package.json`; `grep -n` on `package-lock.json`.
- Source: repo files above (read 2026-10-04).

**E-2. Registry latest versus installed.**
- Found: registry latest equals installed for `fastify` (5.12.5), `@fastify/cors` (11.3.0), `ws` (8.22.0), `@types/ws` (8.18.2), `fastify-plugin` (6.0.0). `@fastify/websocket` differs: installed 11.3.1, registry latest **11.3.3**, published `2026-10-03T14:44:35.012Z` (about 11 hours before this lookup).
- Why it matters: shows which installed pin is behind.
- Verified: `npm view @fastify/websocket version "time[11.3.3]"` (Appendix A) against `apps/mock-core/package.json:18`.
- Source: `https://registry.npmjs.org/@fastify/websocket` (fetched 2026-10-04).

**E-3. Other stack facts the plugin ranges are compared against.**
- Found: zod 4.6.5 is pinned in `packages/shared/package.json:46`, `apps/core-web/package.json:38`, `apps/mobile/package.json:72`; registry latest is 4.6.5. `apps/mobile/package.json:32` has `expo ~57.0.26`, `:58` has `react-native 0.86.3`. Host: Node `v26.8.2`, npm `11.19.1`, `process.versions.modules` = 147.
- Why it matters: type-provider peer ranges, the React Native WebSocket API version and the native-module ABI (uWebSockets.js binaries) are stated against these.
- Verified: Grep and `node -e 'process.versions.modules'`.
- Source: repo files; `https://registry.npmjs.org/zod` (2026-10-04).

## 4. Fastify 5.x on Node 26

**N-1. Node 26 release status.**
- Found: `schedule.json` has `v26: {start: 2026-05-05, lts: 2026-10-28, maintenance: 2027-10-20, end: 2029-04-30}`; `v24: {start 2025-05-06, lts 2025-10-28, maintenance 2026-10-20, end 2028-04-30, codename Krypton}`; `v25: {start 2025-10-15, maintenance 2026-04-01, end 2026-06-01}`. On the task date 2026-10-04, Node 26 has not reached its `lts` date (2026-10-28).
- Why it matters: the host runs a line that is not yet LTS; Fastify's own LTS policy tests against supported Node lines.
- Verified: fetched file parsed with `node -e`.
- Source: `https://raw.githubusercontent.com/nodejs/Release/main/schedule.json` (2026-10-04).

**N-2. Fastify 5.x branch is tested on Node 26.**
- Found: on branch `5.x`, `package.json:3` is `"version": "5.12.5"` (equal to registry latest and dist-tag `latest`), and `.github/workflows/ci.yml:65` reads `node-version: [20, 22, 24, 26]`.
- Why it matters: direct CI evidence that the exact version in use is exercised on Node 26.
- Verified: curl + `grep -n`; `npm view fastify dist-tags.latest` = `5.12.5`.
- Source: `https://raw.githubusercontent.com/fastify/fastify/5.x/.github/workflows/ci.yml`, `.../5.x/package.json` (2026-10-04).

**N-3. Two Fastify documents disagree on the Node range of v5.**
- Found: `docs/Reference/LTS.md` on `main` line 63: `| 5.0.0 | 2024-09-17 | TBD | 20, 22, 24, 26 |`; on the `5.x` branch line 63: `| 5.0.0 | 2024-09-17 | TBD | 20, 22 |`. The 5.x-branch table is older than its own CI matrix (N-2).
- Why it matters: a reader of the 5.x branch doc alone would see Node 26 missing.
- Verified: both files fetched and grepped.
- Source: `https://raw.githubusercontent.com/fastify/fastify/main/docs/Reference/LTS.md`, `.../5.x/docs/Reference/LTS.md` (2026-10-04).

**N-4. Fastify v6 is unreleased.**
- Found: `main` branch `package.json:3` is `6.0.0-alpha.4`; `main` LTS table line 64: `| 6.0.0 | TDB | TBD | 24, 26 |`; `main` CI matrix (`ci.yml:65`) is `[24, 26]`. npm `dist-tags.latest` is `5.12.5`.
- Why it matters: the `main` branch is not the version npm serves; evidence for v5 must be read from branch `5.x`.
- Verified: fetched files and `npm view fastify "time[5.12.5]" dist-tags.latest`.
- Source: `https://raw.githubusercontent.com/fastify/fastify/main/package.json`, `.../main/.github/workflows/ci.yml` (2026-10-04).

**N-5. Node floor of Fastify 5, and plugin CI coverage of Node 26.**
- Found: `docs/Guides/Migration-Guide-V5.md:11` on `5.x`: "Fastify v5 will only support Node.js v20+." The nine plugin repos checked (websocket, cors, cookie, rate-limit, static, swagger, swagger-ui, session, secure-session) call the shared workflow `fastify/workflows` pinned at `ef591e21...` (v7.0.0), whose `plugins-ci.yml:34` and `plugins-ci-redis.yml:29` default to `["20", "22", "24", "26"]`; none of the repos' `ci.yml` sets `node-versions`. The unpinned `workflows/main` `plugins-ci.yml:34` default is `["24", "26"]` (newer).
- Why it matters: Node 26 is in the default CI matrix of every official plugin evaluated.
- Verified: curl + grep for `node-versions` in each repo's `ci.yml` and in the pinned workflow files.
- Source: URLs listed in section 2.3 (2026-10-04).

**N-6. No Node-26-specific defect found; search was not exhaustive.**
- Found: Q4 returned only the "Node.js v20+" statement and explicitly no Node 26 statement. The GitHub issue search could not be run (unauthenticated API rate limit reached).
- Why it matters: absence of a finding is not confirmation of absence of issues.
- Verified: Q4 result text; the rate-limit error body from `api.github.com`.
- Source: Q4 (2026-10-04); `https://api.github.com/repos/fastify/session/contents/lib` response.

**N-7. Not executed here.**
- Found: this collection ran no server and no test (read-only rule). Any statement in this document that Fastify or a plugin is tested on Node 26 rests on N-2 and N-5 (upstream CI definitions), not on a run on this host.
- Why it matters: separates upstream evidence from local evidence.
- Verified: by the rules of the row.
- Source: row 8 text, `identification/02_structured.md:281`.

## 5. Plugin Tables

All licences are the registry `license` field. All "published" values are the registry `time[<version>]`. URL column: the compatibility evidence URL (README table, source line or registry peer range); version and licence come from `https://registry.npmjs.org/<pkg>` via `npm view` (Appendix A). Fetch date for all rows: 2026-10-04.

### T-A. Packages for the capability list in row 8

| Capability | Package | Latest version | Published (UTC) | Licence | Fastify 5 compatibility (evidence) | Evidence URL (fetched 2026-10-04) |
|---|---|---|---|---|---|---|
| Core | `fastify` | 5.12.5 | 2026-09-16T07:37:06.302Z | MIT | is Fastify 5; Node 20/22/24/26 CI (N-2) | https://raw.githubusercontent.com/fastify/fastify/5.x/.github/workflows/ci.yml |
| CORS | `@fastify/cors` | 11.3.0 | 2026-07-08T15:06:39.052Z | MIT | README table: plugin `^11.x` and `^10.x` map to Fastify `^5.x`; `index.js:308` `fastify: '5.x'` | https://raw.githubusercontent.com/fastify/fastify-cors/main/README.md ; `.../index.js` |
| WebSocket | `@fastify/websocket` | 11.3.3 (installed 11.3.1) | 2026-10-03T14:44:35.012Z | MIT | no README table; `index.js:259` `fastify: '5.x'`; `package.json:64` `"fastify": "^5.0.0"` (npm shows empty `peerDependencies`); depends on `ws ^8.16.0` | https://raw.githubusercontent.com/fastify/fastify-websocket/main/index.js |
| Cookie | `@fastify/cookie` | 11.1.2 | 2026-07-15T21:29:27.207Z | MIT | README table: `>=10.x` maps to `^5.x`; `index.js:218` `fastify: '5.x'` | https://raw.githubusercontent.com/fastify/fastify-cookie/main/README.md ; `.../index.js` |
| Session (server-side) | `@fastify/session` | 11.1.3 | 2026-09-14T08:14:48.227Z | MIT | no README table; `index.js:262` `fastify: '5.x'`; `package.json:72` `"fastify": "^5.0.0"` | https://raw.githubusercontent.com/fastify/session/main/index.js |
| Session (stateless cookie) | `@fastify/secure-session` | 8.4.0 | 2026-09-22T13:06:51.814Z | MIT | no README table; `index.js:383` `fastify: '5.x'`; depends on `sodium-native ^5.0.1` (native addon, see C-5) | https://raw.githubusercontent.com/fastify/fastify-secure-session/main/index.js |
| Token alternative | `@fastify/jwt` | 10.2.2 | 2026-08-14T23:39:13.719Z | MIT | no README table; `index.js:577` `fastify: '5.x'` | https://raw.githubusercontent.com/fastify/fastify-jwt/main/index.js |
| Rate limit | `@fastify/rate-limit` | 11.2.0 | 2026-07-29T14:38:39.112Z | MIT | README table: `>=10.x` maps to `^5.x`; `index.js:380` `fastify: '5.x'` | https://raw.githubusercontent.com/fastify/fastify-rate-limit/main/README.md ; `.../index.js` |
| Static files + range | `@fastify/static` | 10.1.5 | 2026-09-26T07:38:36.557Z | MIT | README table: `>=8.x` maps to `^5.x`; `index.js:1012` `fastify: '5.x'`; depends on `@fastify/send ^4.0.0` | https://raw.githubusercontent.com/fastify/fastify-static/main/README.md ; `.../index.js` |
| (range engine) | `@fastify/send` | 4.1.1 | 2026-08-08T15:03:09.572Z | MIT | library, not a Fastify plugin; Fastify range not stated | https://raw.githubusercontent.com/fastify/send/main/README.md |
| OpenAPI generation | `@fastify/swagger` | 9.9.1 | 2026-09-30T16:03:21.006Z | MIT | README table: `>=9.x` maps to `^5.x`; `index.js:28` `fastify: '5.x'` | https://raw.githubusercontent.com/fastify/fastify-swagger/main/README.md ; `.../index.js` |
| OpenAPI UI | `@fastify/swagger-ui` | 6.1.1 | 2026-07-28T17:10:17.284Z | MIT | README table lists only `^5.x` (Fastify `^5.x`, swagger `^9.x`); the 6.x row is absent; `index.js:30` `fastify: '5.x'` | https://raw.githubusercontent.com/fastify/fastify-swagger-ui/main/index.js |
| zod 4 type provider | `fastify-type-provider-zod` | 7.0.0 | 2026-06-24T00:27:25.196Z | MIT | npm peers: `fastify ^5.5.0`, `zod >=4.1.5`, `@fastify/swagger >=9.5.1`, `openapi-types ^12.1.3`; README: v7 needs zod 4.2+ | https://raw.githubusercontent.com/turkerdev/fastify-type-provider-zod/main/README.md |
| zod 4 type provider (OpenAPI-metadata variant) | `fastify-zod-openapi` | 5.7.0 | 2026-07-20T13:32:11.597Z | MIT | npm peers: `fastify 5`, `zod ^3.25.74 \|\| ^4.0.0`, `@fastify/swagger ^9.0.0`, `@fastify/swagger-ui ^5.0.1 \|\| ^6.0.0`; engines `node >=20`; depends on `zod-openapi ^5.4.0`, `fastify-plugin ^5.0.0` | https://raw.githubusercontent.com/samchungy/fastify-zod-openapi/master/README.md |
| Schema library | `zod` | 4.6.5 | 2026-09-13T23:25:14.644Z | MIT | not a Fastify plugin; the repo pins 4.6.5 (E-3) | https://registry.npmjs.org/zod |
| OpenAPI from zod (engine of the variant above) | `zod-openapi` | 6.0.2 | 2026-08-31T08:08:59.842Z | MIT | not a Fastify plugin; peer `zod ^4.0.0`; engines `node >=22.14.0` | https://registry.npmjs.org/zod-openapi |

### T-B. Adjacent official and community packages encountered (supporting a database-backed API or fan-out)

| Package | Latest version | Published (UTC) | Licence | Fastify 5 compatibility (evidence) | Evidence URL (fetched 2026-10-04) |
|---|---|---|---|---|---|
| `fastify-plugin` | 6.0.0 | 2026-06-09T12:13:29.560Z | MIT | helper library; the `@fastify/*` packages above depend on `^6.0.0`; `fastify-zod-openapi` depends on `^5.0.0`. Fastify range: not stated in sources read | https://registry.npmjs.org/fastify-plugin |
| `@fastify/helmet` | 13.1.1 | 2026-08-19T10:02:18.430Z | MIT | README table: `>=12.x` maps to `^5.x` | https://raw.githubusercontent.com/fastify/fastify-helmet/main/README.md |
| `@fastify/under-pressure` | 9.2.0 | 2026-09-18T15:27:20.807Z | MIT | README table: `>=9.x` maps to `^5.x`; `index.js:306` `fastify: '5.x'` | https://raw.githubusercontent.com/fastify/under-pressure/main/README.md |
| `@fastify/auth` | 5.1.1 | 2026-09-16T12:41:12.149Z | MIT | README table: `>=5.x` maps to `^5.x` | https://raw.githubusercontent.com/fastify/fastify-auth/main/README.md |
| `@fastify/sensible` | 6.0.6 | 2026-09-26T16:46:14.945Z | MIT | README table: `>=6.x` maps to `^5.x` | https://raw.githubusercontent.com/fastify/fastify-sensible/main/README.md |
| `@fastify/request-context` | 7.0.0 | 2026-06-09T12:20:01.073Z | MIT | README table: `>=6.x` maps to `^5.x` | https://raw.githubusercontent.com/fastify/fastify-request-context/main/README.md |
| `@fastify/compress` | 9.2.0 | 2026-08-08T09:06:59.601Z | MIT | README table: `>=8.x` maps to `^5.x` | https://raw.githubusercontent.com/fastify/fastify-compress/main/README.md |
| `@fastify/sse` | 0.6.0 | 2026-07-27T19:28:32.885Z | MIT | npm peer `fastify ^5.x`; engines `node >=20.20.2`; version is 0.x | https://registry.npmjs.org/@fastify/sse |
| `@fastify/error` | 4.2.0 | 2025-06-01T07:56:14.569Z | MIT | helper; dependency of both type providers; Fastify range not stated | https://registry.npmjs.org/@fastify/error |
| `openapi-types` | 12.1.3 | 2023-05-24T22:26:38.839Z | MIT | types package, peer of `fastify-type-provider-zod`; no Fastify range | https://registry.npmjs.org/openapi-types |
| `ws` | 8.22.0 | 2026-09-26T15:00:57.748Z | MIT | not a Fastify plugin; the engine under `@fastify/websocket`; optional peers `bufferutil ^4.0.1`, `utf-8-validate >=5.0.2`; engines `node >=10.0.0` | https://raw.githubusercontent.com/websockets/ws/master/package.json |
| `@types/ws` | 8.18.2 | 2026-09-29T08:07:45.655Z | MIT | types; `@fastify/websocket` README says TypeScript users also install it | https://raw.githubusercontent.com/fastify/fastify-websocket/main/README.md |
| `bufferutil` | 4.1.0 | 2025-12-18T16:24:21.551Z | MIT | optional native accelerator of `ws`; engines `node >=6.14.2` | https://registry.npmjs.org/bufferutil |
| `sodium-native` | 5.1.0 | 2026-03-06T09:39:58.351Z | MIT | native dependency of `@fastify/secure-session`; engines field `bare >=1.16.0` (no `node` key) | https://registry.npmjs.org/sodium-native |
| `socket.io` | 4.8.4 | 2026-09-25T08:51:53.015Z | MIT | not a Fastify plugin; engines `node >=10.2.0` | https://registry.npmjs.org/socket.io |
| `fastify-socket.io` (community) | 5.1.0 | 2024-08-12T14:26:58.022Z | not confirmed (the registry `license` field is absent in the `npm view` output) | npm peer `fastify 4.x.x`; README: "Supports Fastify versions `4.x`". **Not Fastify 5** per both | https://raw.githubusercontent.com/ducktors/fastify-socket.io/master/README.md |
| `fastify-uws` (community) | 2.0.0 | 2026-04-18T08:14:29.053Z | MIT | README "Supported" for v2.x: Node.js v20, v22, v24; `fastify` v5.x; `@fastify/websocket` v11.x (Node 26 not listed) | https://raw.githubusercontent.com/Vanilla-IceCream/fastify-uws/main/README.md |
| `mqemitter` | 7.1.0 | 2025-07-14T08:41:19.160Z | ISC | not a Fastify plugin; in-process topic emitter; engines `node >=20` | https://raw.githubusercontent.com/mcollina/mqemitter/master/README.md |
| `uWebSockets.js` | v20.71.0 (GitHub tag; not on the npm registry) | 2026-09-16T09:06:05Z (GitHub release `published_at`) | Apache-2.0 (tag `package.json`; repo LICENSE) | not a Fastify plugin; reached from Fastify only through `fastify-uws` (row above) | https://api.github.com/repos/uNetworking/uWebSockets.js/releases/latest ; https://raw.githubusercontent.com/uNetworking/uWebSockets.js/v20.71.0/package.json |
| `@colyseus/core` | 0.18.18 | 2026-09-29T15:39:22.570Z | MIT | not a Fastify plugin; full game-server framework; engines `node >= 22.x`; peer `zod ^4.1.12`, `express`, `@pm2/io`, others (see Appendix A) | https://docs.colyseus.io/room |

### T-C. Looked up, compatibility not evaluated

These were returned by `npm view` while checking the capability list. Their Fastify 5 compatibility was not confirmed from any source read, so it is recorded as "not confirmed".

| Package | Latest version | Published (UTC) | Licence | Fastify 5 compatibility | Registry URL (fetched 2026-10-04) |
|---|---|---|---|---|---|
| `@fastify/type-provider-typebox` | 6.1.0 | 2025-10-19T18:06:49.218Z | MIT | not confirmed (peer `typebox ^1.0.13` only); not a zod provider | https://registry.npmjs.org/@fastify/type-provider-typebox |
| `@fastify/type-provider-json-schema-to-ts` | 5.0.0 | 2024-12-23T07:32:43.583Z | MIT | not confirmed; not a zod provider | https://registry.npmjs.org/@fastify/type-provider-json-schema-to-ts |
| `typebox` | 1.3.34 | 2026-09-18T09:41:07.752Z | MIT | not confirmed; not a Fastify plugin | https://registry.npmjs.org/typebox |
| `@sinclair/typebox` | 0.34.52 | 2026-07-11T21:08:28.286Z | MIT | not confirmed; not a Fastify plugin | https://registry.npmjs.org/@sinclair/typebox |
| `@fastify/bearer-auth` | 10.1.3 | 2026-08-08T15:03:17.802Z | MIT | not confirmed | https://registry.npmjs.org/@fastify/bearer-auth |
| `@fastify/accepts` | 5.0.6 | 2026-09-10T10:32:03.743Z | MIT | not confirmed | https://registry.npmjs.org/@fastify/accepts |
| `fastify-sse-v2` (community) | 4.2.2 | 2026-01-27T10:50:02.900Z | MIT | npm peer `fastify >=4` (does not name 5 explicitly) | https://registry.npmjs.org/fastify-sse-v2 |
| `colyseus` | 0.18.9 | 2026-09-30T21:47:53.821Z | MIT | not a Fastify plugin; not confirmed | https://registry.npmjs.org/colyseus |

## 6. Capability Facts per Plugin

Every fact below was read in the fetched README or source; **none was executed** (no server ran).

**C-1. CORS (`@fastify/cors` 11.3.0).**
- Found: adds an `onRequest` hook and a wildcard OPTIONS route (README "Usage"). Option `methods` defaults to the CORS-safelisted methods `GET,HEAD,POST` (README "Options"). `origin` accepts Boolean, String, RegExp, Array, or Function; the default `*` allows any origin. `credentials: true` emits `Access-Control-Allow-Credentials`; `allowedHeaders` defaults to reflecting the request header; `exposedHeaders` exposes nothing by default (README example value `'Content-Range,X-Content-Range'`); `strictPreflight` defaults to `true` (preflight lacking `Access-Control-Request-Method` or `Origin` gets 400); `hook` defaults to `onRequest`. README warning: using a RegExp or function for `origin` "may enable Denial of Service attacks".
- Why it matters: the default method list excludes PUT, PATCH and DELETE; credentialed browser calls need `credentials` plus explicit origins.
- Verified: README read (curl, 8,983 bytes, 2026-10-04); `index.js:308-309` declares `fastify: '5.x'`, `name: '@fastify/cors'`.
- Source: https://raw.githubusercontent.com/fastify/fastify-cors/main/README.md (2026-10-04).

**C-2. Cookie (`@fastify/cookie` 11.1.2).**
- Found: `secret` accepts String, Buffer, Array (key rotation) or Object; signing uses `cookie-signature`; `algorithm` default `sha256`; README: "It is recommended to use `sha256` or stronger hashing algorithm as well as a `secret` that is at least 20 bytes long" (line 112). Cookie option defaults per the README: `HttpOnly` "By default ... not set", `Secure` "By default ... not set", `Partitioned` "By default ... not set"; the `SameSite` section lists the values (`true`/`'strict'`, `'lax'`, `'none'`, `false`) and states no default (not confirmed); `secure: "auto"` sets Secure only on TLS. Cookies are parsed in `onRequest` by default (`hook` option can move it to `preParsing`, `preValidation`, `preHandler` or disable it). README lines 237-238: use `httpOnly` to prevent XSS; use signed cookies against client-side tampering.
- Why it matters: session and device-credential cookies inherit these defaults unless set.
- Verified: README read; `index.js:218-219`.
- Source: https://raw.githubusercontent.com/fastify/fastify-cookie/main/README.md (2026-10-04).

**C-3. Server-side session (`@fastify/session` 11.1.3).**
- Found: `secret` is required, "a string with a length of 32 or greater" or an array (first signs, others verify; rotation) or a custom signer (README lines 54-55). Default store is "a simple in-memory store"; README: "The default store should not be used in a production environment because it will leak memory" (lines 90-91). Store interface: `set(sessionId, session, callback)`, `get(sessionId, callback)`, `destroy(sessionId, callback)` (compatible with express-session stores, lines 79-85). Cookie options: `httpOnly` default true; `secure` default true (set `false` for plain HTTP, or `auto`); `sameSite` accepts boolean or string; with `secure: 'auto'` over HTTP the cookie becomes `Lax`. `rolling` default true; `saveUninitialized` default true. API: `session.destroy()`, `session.touch()`, `session.regenerate([ignoreFields])`, `session.options({maxAge})`. README NOTE (line 37): for unencrypted HTTP connections set the `secure` cookie option to `false`.
- Why it matters: the loopback HTTP case needs `secure` false or `auto`; a durable store implementation is not bundled.
- Verified: README read (9,942 bytes); `index.js:262-263`.
- Source: https://raw.githubusercontent.com/fastify/session/main/README.md (2026-10-04).

**C-4. Cookie-borne stateless session (`@fastify/secure-session` 8.4.0).**
- Found: "secure stateless cookie session ... based on libsodium's Secret Key Box Encryption and @fastify/cookie". Key is a file or `Buffer.from(hex)` of length `crypto_secretbox_KEYBYTES`; key generated with `npx @fastify/secure-session > secret-key`; `expiry` default 1 day (`24 * 60 * 60`); `session.delete()`, `session.regenerate([keepKeys])`; supports multiple named sessions. README states reading the key from a file "is poor practice" and names Vault/KMS-style storage as ideal.
- Why it matters: no server-side session table is involved; revocation of a single cookie before expiry is not documented in the README read (not confirmed either way).
- Verified: README read (15,253 bytes); `index.js:383`; dependencies read from the fetched `package.json`: `{ "@fastify/cookie": "^11.0.1", "fastify-plugin": "^6.0.0", "sodium-native": "^5.0.1" }`.
- Source: https://raw.githubusercontent.com/fastify/fastify-secure-session/main/README.md (2026-10-04).

**C-5. Native dependency footprint of the cookie-session option.**
- Found: `sodium-native` 5.1.0 is MIT; its registry `engines` is `{ bare: '>=1.16.0' }` (no `node` key). Whether a prebuilt binary exists for darwin-arm64 on Node 26 was not checked.
- Why it matters: it is a native add-on in a plugin family that otherwise has none.
- Verified: `npm view sodium-native ... engines`.
- Source: https://registry.npmjs.org/sodium-native (2026-10-04).

**C-6. Token plugin (`@fastify/jwt` 10.2.2).**
- Found: registry version, MIT, published 2026-08-14T23:39:13.719Z; `index.js:577-578` declares `fastify: '5.x'`, `name: '@fastify/jwt'`. README has no compatibility table. Feature list was not read in depth.
- Why it matters: the row names "cookie or session"; JWT is recorded only as the plugin-family alternative.
- Verified: curl of `index.js` and `grep -n`.
- Source: https://raw.githubusercontent.com/fastify/fastify-jwt/main/index.js (2026-10-04).

**C-7. Rate limit (`@fastify/rate-limit` 11.2.0).**
- Found: "adds an `onRequest` hook" (README line 33). Defaults from the README options block: `global` true, `max` 1000, `timeWindow` `1000 * 60`, `hook` `'onRequest'` (can be `preHandler`), `ban` `-1` (after N 429s answer 403), `cache` 5000, `allowList` `[]`, `redis` null, `nameSpace` `'fastify-rate-limit-'`, `continueExceeding` false, `skipOnError` false, `keyGenerator` `(request) => normalizeIP(request.ip, ipv6Subnet)`, `ipv6Subnet` 64, `enableDraftSpec` false. Response headers: `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`, plus `retry-after` when the limit is reached. Store: in-memory by default; `redis` (via `ioredis`) for multi-server; `store` option for a custom store ("using an RDBMS, MongoDB, etc."), with a Knex.js example in `example/`. Per-route overrides and `groupId` for grouping routes.
- Why it matters: keying on something other than IP (for example a user or device id) is a documented option (`keyGenerator`; `max` and `timeWindow` can be async functions of `(request, key)`).
- Verified: README read (23,858 bytes); `index.js:380-381`. Application to WebSocket upgrade requests was not tested; the websocket README says `onRequest` hooks run before the upgrade (C-10).
- Source: https://raw.githubusercontent.com/fastify/fastify-rate-limit/main/README.md (2026-10-04).

**C-8. Static files and range requests (`@fastify/static` 10.1.5, `@fastify/send` 4.1.1).**
- Found: `@fastify/static` README passes `acceptRanges`, `cacheControl`, `etag`, `immutable`, `lastModified`, `maxAge` through to `@fastify/send` (lines 208-217). `@fastify/send` README: "`acceptRanges` Enable or disable accepting ranged requests, defaults to true. Disabling this will not send `Accept-Ranges` and ignore the contents of the `Range` request header." and "`maxContentRangeChunkSize` Specify the maximum response content size, defaults to the entire file size. This will be used when `acceptRanges` is true." The send README opens by naming "partial responses (Ranges), conditional-GET negotiation (If-Match, ...)". Other documented options: `preCompressed` (brotli, gzip, original; sets `Vary: Accept-Encoding`), `wildcard`, `allowedPath`, `decorateReply` (adds `reply.sendFile`), `reply.download`. README warning: with `preCompressed`, `allowedPath` is evaluated against the requested path, not the selected `.gz` or `.br` variant. On a case-insensitive filesystem, differently cased aliases of a file are rejected with 403 under default `wildcard: true`.
- Why it matters: range and conditional requests need no extra plugin for files served from a directory; the case-insensitive 403 rule applies on macOS default volumes.
- Verified: both READMEs read (static 17,671 bytes; send 9,409 bytes); `index.js:1012-1013` `fastify: '5.x'`. Behaviour was not exercised (no server).
- Source: https://raw.githubusercontent.com/fastify/fastify-static/main/README.md ; https://raw.githubusercontent.com/fastify/send/main/README.md (2026-10-04).

**C-9. OpenAPI generation (`@fastify/swagger` 9.9.1, `@fastify/swagger-ui` 6.1.1).**
- Found: `dynamic` mode (default) generates the document from route schemas; `static` mode serves a supplied document. The generated document is Swagger 2 by default; passing the `openapi` option produces OpenAPI. The OpenAPI version string is taken from `openapi.openapi` ("`3.0.3` by default"); "Set it to `3.1.0` or `3.2.0` to generate a document for that version" (README lines 203-205). A `transform` option is the hook the zod providers use (C-11). `@fastify/websocket` marks its routes `schema.hide = true` (`index.js:179`), so websocket routes are excluded from the generated document.
- Why it matters: the OpenAPI version written is chosen by one string; WebSocket endpoints do not appear in the generated paths.
- Verified: README read (39,078 bytes); `@fastify/websocket` `index.js:179`.
- Source: https://raw.githubusercontent.com/fastify/fastify-swagger/main/README.md ; https://raw.githubusercontent.com/fastify/fastify-websocket/main/index.js (2026-10-04).

**C-10. WebSocket plugin (`@fastify/websocket` 11.3.3).**
- Found: "Built upon ws@8". Route declared as `fastify.get(path, { websocket: true }, (socket, req) => ...)`; the plugin decorates `fastify.websocketServer` (the `ws` server, `index.js:52`) and `fastify.injectWS` for tests; it refuses a `noServer` option (`index.js:35-36`) and builds the `ws` server with `Object.assign({ noServer: true }, opts.options)` (`index.js:39`) so `ws` options such as `maxPayload`, `perMessageDeflate`, `clientTracking` pass through `options`. Upgrade requests are dispatched through the normal router (`index.js:123` `fastify.routing(rawRequest, rawResponse)`), so "Hooks that run **before** the websocket connection is established will be called - this includes `onRequest`, `preParsing`, `preValidation`, and `preHandler`" (README line 115); `preSerialization` and `onSend` do not run (line 117). It must be registered before the routes. The README states message handlers must be attached synchronously or messages are silently dropped while async work runs. README: "By default, all ws connections are closed when the server closes" (the default `preClose` iterates `server.clients`, `index.js:232-233`). An `errorHandler` option handles errors after the upgrade. The plugin README and source contain no topic, subscribe, publish or room API (grep for `topic|subscribe|broadcast|publish|room` found only `server.clients` in the `preClose` example and the `clientTracking` option).
- Why it matters: topics and broadcast are not provided by the plugin; the `ws` server and its client set are exposed through `fastify.websocketServer`.
- Verified: README (14,464 bytes) and `index.js` (8,613 bytes) read; grep counts as stated.
- Source: https://raw.githubusercontent.com/fastify/fastify-websocket/main/README.md ; `.../index.js` (2026-10-04).

**C-11. Zod 4 type provider, option 1: `fastify-type-provider-zod` 7.0.0.**
- Found: README "Zod compatibility" table: `<=4.x` with zod v3; `>=5.x <7.x` with zod v4; `>=7.x` with zod v4.2+. v7 "uses Zod's `.encode()` / `.decode()` APIs introduced in Zod 4.2", and "response serialization is now based on `z.output<T>` instead of `z.input<T>`". Wiring: `app.setValidatorCompiler(validatorCompiler)`, `app.setSerializerCompiler(serializerCompiler)`, `app.withTypeProvider<ZodTypeProvider>().route({... schema: { querystring: z.object(...), response: { 200: z.string() } } })`. With swagger: `register(fastifySwagger, { openapi: {...}, transform: jsonSchemaTransform })`; for `$ref` components, `z.globalRegistry.add(schema, { id: 'User' })` plus `transformObject: jsonSchemaTransformObject`. `createJsonSchemaTransform({ zodToJsonConfig: { target } })`: "By default target `openapi-3.0` is used for documents with `openapi` set to `3.0.x`, and target `draft-2020-12` ... `3.1.x`". README imports use `import { z } from 'zod/v4'`. npm peers: `fastify ^5.5.0`, `zod >=4.1.5`, `@fastify/swagger >=9.5.1`, `openapi-types ^12.1.3`.
- Why it matters: the repo's zod 4.6.5 (E-3) sits inside both stated zod ranges (`>=4.1.5`; README 4.2+).
- Verified: README read (9,878 bytes); `npm view` peers.
- Source: https://raw.githubusercontent.com/turkerdev/fastify-type-provider-zod/main/README.md (2026-10-04).

**C-12. Zod 4 type provider, option 2: `fastify-zod-openapi` 5.7.0.**
- Found: wraps `zod-openapi`; exports `serializerCompiler`, `validatorCompiler`, `FastifyZodOpenApiTypeProvider`, `FastifyZodOpenApiSchema`, `FastifyPluginAsyncZodOpenApi`; descriptions and examples are attached with zod's `.meta({...})`; Node badge `>=20`. README line 243: "the `parameters` components do not appear to be supported by the `@fastify/swagger` library"; line 261: a `createSerializerCompiler` restores previous `JSON.stringify` behaviour (it otherwise serializes through `fast-json-stringify ^7.0.1`). npm peers include `@fastify/swagger-ui ^5.0.1 || ^6.0.0` and `fastify 5`; it depends on `zod-openapi ^5.4.0` while the registry latest `zod-openapi` is 6.0.2.
- Why it matters: two zod 4 providers exist with different OpenAPI engines and different peer sets.
- Verified: README read (12,004 bytes); `npm view` peers and dependencies.
- Source: https://raw.githubusercontent.com/samchungy/fastify-zod-openapi/master/README.md (2026-10-04).

**C-13. Event-loop guard plugin (`@fastify/under-pressure` 9.2.0).**
- Found: checks `maxEventLoopDelay`, `maxHeapUsedBytes`, `maxRssBytes`, `maxEventLoopUtilization`; defaults of all four are `0` (disabled); README: "will automatically handle for you the `Service Unavailable` error once one of the thresholds has been reached" with configurable `message` and `retryAfter` (the `Retry-After` header); README compatibility table `>=9.x` maps to `^5.x`; `index.js:306` `fastify: '5.x'`.
- Why it matters: it is the official option for observing event-loop delay on a single-process server that also runs a 20 Hz timer (see S-3).
- Verified: README read (10,956 bytes); grep of option names.
- Source: https://raw.githubusercontent.com/fastify/under-pressure/main/README.md (2026-10-04).

## 7. WebSocket Fan-out Patterns (single process)

### Pattern P-1: `ws` through `@fastify/websocket` with an application-owned topic registry

- Found: `@fastify/websocket` exposes the `ws` server (C-10) which keeps a `server.clients` Set "only added when the `clientTracking` is truthy" (ws API doc `server.clients`). The `ws` README "Server broadcast" example iterates `wss.clients`, checks `client.readyState === WebSocket.OPEN` and calls `client.send(data, { binary: isBinary })` for each. Neither `ws` nor `@fastify/websocket` documents topics; a topic map would be application code. A helper for topic matching inside one process exists: `mqemitter` 7.1.0 (ISC, Node >=20; wildcards `wildcardOne` default `+`, `wildcardSome` default `#`, `separator` default `/`, `concurrency` default `0`).
- Why it matters: this is the pattern that uses the Fastify plugin already installed; topics, per-topic membership and per-client send policy are not supplied by it.
- Verified: ws README lines 330-352 read; `ws` API doc read; `@fastify/websocket` README/source grep (C-10); `mqemitter` README read.
- Source: https://raw.githubusercontent.com/websockets/ws/master/README.md ; https://raw.githubusercontent.com/websockets/ws/master/doc/ws.md ; https://raw.githubusercontent.com/mcollina/mqemitter/master/README.md (2026-10-04).

### Pattern P-2: uWebSockets.js native topics (`subscribe` / `publish`)

- Found: typed API (tag v20.71.0 `index.d.ts`): `ws.subscribe(topic)`, `ws.unsubscribe`, `ws.isSubscribed`, `ws.getTopics()`, `ws.publish(topic, message, isBinary?, compress?)` ("Backpressure is managed according to maxBackpressure, closeOnBackpressureLimit settings. Order is guaranteed since v20."), `app.publish`, `app.numSubscribers(topic)`. Behaviour options: `maxBackpressure` ("Maximum length of allowed backpressure per socket ... Slow receivers with too high backpressure will be skipped until they catch up or timeout. Defaults to 64 * 1024."), `closeOnBackpressureLimit` (default false), `idleTimeout` (default 120 s; granularity about 4 s), `compression` (default `uWS.DISABLED`), `maxPayloadLength` (default 16 * 1024), `sendPingsAutomatically`, and a `drain` handler. `ws.send` returns "1 for success, 2 for dropped due to backpressure limit, and 0 for built up backpressure that will drain over time"; `getBufferedAmount()` is the counterpart of the browser property. The repo's `examples/PubSub.mjs` subscribes each socket to `'home/sensors/#'` in `open` and states "The library guarantees proper unsubscription at close". `examples/UpgradeAsync.mjs` shows an `upgrade` handler that copies request data, does async work, checks an aborted flag and then calls `res.upgrade(...)`. The library is "exposed to Node.js as a simple-to-use, native V8 addon"; the README states it is not in the npm registry and is installed with `npm install uNetworking/uWebSockets.js#v20.70.0` (the README text names v20.70.0; the latest release is v20.71.0). Licence: Apache-2.0 (tag `package.json`). The tag `v20.71.0` contains `uws_darwin_arm64_147.node` (also `_127`, `_137`; also darwin_x64, linux arm64 and x64, win32_x64 at the same three ABIs); this host reports ABI 147 (E-3). Vendor claim, not verified: README says it is "13x faster than Fastify". Access from Fastify: `fastify-uws` 2.0.0 (replaces the HTTP server; lists Node 20, 22, 24 only).
- Why it matters: this is the only candidate read with built-in topics and built-in per-socket backpressure limits in one library; it replaces the `ws` engine and is installed from GitHub, not from the registry.
- Verified: tag `index.d.ts` (27,689 bytes), examples `PubSub.mjs`, `Backpressure.mjs`, `UpgradeAsync.mjs` read; GitHub contents listing of tag `v20.71.0`; local `process.versions.modules`.
- Source: https://raw.githubusercontent.com/uNetworking/uWebSockets.js/v20.71.0/index.d.ts ; https://raw.githubusercontent.com/uNetworking/uWebSockets.js/master/examples/PubSub.mjs ; https://raw.githubusercontent.com/uNetworking/uWebSockets.js/master/README.md ; https://api.github.com/repos/uNetworking/uWebSockets.js/contents/?ref=v20.71.0 (2026-10-04).

### Pattern P-3: Socket.IO rooms with volatile emits

- Found: Socket.IO docs: "A room is an arbitrary channel that sockets can join and leave. It can be used to broadcast events to a subset of clients"; "rooms are a server-only concept"; "Upon disconnection, sockets leave all the channels they were part of automatically". Volatile events "will not be sent if the underlying connection is not ready (a bit like UDP, in terms of reliability)" and suit "the position of the characters in an online game (as only the latest values are useful)" (`socket.volatile.emit`). `socket.io` 4.8.4, MIT. The Fastify binding `fastify-socket.io` 5.1.0 is Fastify 4 only (T-B).
- Why it matters: it supplies rooms and a drop-if-not-ready send as documented features; its Fastify glue package is not Fastify 5.
- Verified: both pages fetched as HTML and text-extracted; quotes copied from the extracted text.
- Source: https://socket.io/docs/v4/rooms/ ; https://socket.io/docs/v4/emitting-events/ (2026-10-04).

### Pattern P-4: Fixed-rate state patch broadcast in a framework (Colyseus)

- Found: Room property `patchRate` default `50` ("Frequency to send state updates to clients, in milliseconds (20fps)"); `patchRate = null` disables automatic patches and `this.broadcastPatch()` can be called from a custom clock interval; `maxClients`, `maxMessagesPerSecond` (a client exceeding it is disconnected). `@colyseus/core` 0.18.18 is MIT with engines `node >= 22.x` and peers including `zod ^4.1.12`, `express`, `@pm2/io`.
- Why it matters: it is a published single-process example of a 20 Hz (50 ms) broadcast tick with a built-in per-client message cap; it is a whole server framework, not a Fastify plugin.
- Verified: docs page fetched (HTML to text); `npm view @colyseus/core`.
- Source: https://docs.colyseus.io/room (2026-10-04).

### Pattern P-5: Latest-value conflation (term and evidence limits)

- Found: Socket.IO's volatile-event text (P-3) is the only primary-source statement read that ties "only the latest values are useful" to dropping events. A forum page on conflation in a market-data WebSocket service was fetched; its extracted text (2,311 characters) holds a question about "JIT conflation" and "Time conflation (300ms Conflated Service)" but no explanation, so it is **not cited as evidence**.
- Why it matters: no general-purpose source defining a per-client "keep only the latest frame" queue for Node was found.
- Verified: page fetched and text-extracted; Q6 results.
- Source: https://community.developers.lseg.com/discussion/132074/what-is-jit-conflation-rto-and-time-conflation-rtmds-websocket (2026-10-04).

### S-series: sub-topic facts for any pattern

**S-1. Backpressure signal in `ws`.**
- Found: `websocket.bufferedAmount` is "the number of bytes of data that have been queued using calls to `send()` but not yet transmitted to the network", with two stated deviations from the HTML standard: "If the data is immediately sent, the value is `0`" and "All framing bytes are included" (ws API doc lines 498-508). MDN defines the browser property the same way ("queued using calls to `send()` but not yet transmitted to the network"). `websocket.send(data[, options][, callback])` documents a write-complete callback and "throws an error if the ready state is `CONNECTING`". In `lib/websocket.js:468-498` `send` has no return statement, so it returns `undefined`.
- Why it matters: a Q1 search summary said `ws` `.send()` returns a boolean and a `'drain'` event exists; that is **not supported** by the `ws` docs or source read (the boolean-and-drain pattern belongs to Node streams and to uWebSockets.js, whose `send` returns a number).
- Verified: `ws.md` and `lib/websocket.js` read; MDN page read.
- Source: https://raw.githubusercontent.com/websockets/ws/master/doc/ws.md ; https://raw.githubusercontent.com/websockets/ws/master/lib/websocket.js ; https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/websocket/bufferedamount/index.md (2026-10-04).

**S-2. Drop-by-threshold example (secondary source).**
- Found: an article shows a broadcast manager that skips a client when `ws.bufferedAmount > this.maxBufferSize`, counts `droppedMessages`, logs a warning at most every 5 s, and warns above `warningThreshold`. It is a blog on a monitoring vendor's site, not a library document.
- Why it matters: it is the written form of a "check `bufferedAmount` before each send" policy for `ws`.
- Verified: HTML fetched and text-extracted; code excerpt copied.
- Source: https://oneuptime.com/blog/post/2026-01-24-websocket-broadcast-failed-errors/view (2026-10-04).

**S-3. 20 Hz timer facts (Node).**
- Found: Node timers doc for `setTimeout`: "The callback will likely not be invoked in precisely `delay` milliseconds. Node.js makes no guarantees about the exact timing of when callbacks will fire" (timers.md lines 274-277); `setInterval` "Schedules repeated execution of `callback` every `delay` milliseconds" (line 244) with a promise variant `timersPromises.setInterval`. `perf_hooks.monitorEventLoopDelay([options])` exists (perf_hooks.md line 1924; example with `{ resolution: 20 }` at line 1981) and `performance.eventLoopUtilization()` (line 117). `@fastify/under-pressure` exposes event-loop delay and utilisation limits (C-13).
- Why it matters: a 50 ms tick has no timing guarantee from the platform; event-loop delay can be measured with built-ins.
- Verified: both Node doc files fetched and grepped.
- Source: https://raw.githubusercontent.com/nodejs/node/main/doc/api/timers.md ; https://raw.githubusercontent.com/nodejs/node/main/doc/api/perf_hooks.md (2026-10-04).

**S-4. Compression and size limits in `ws`.**
- Found: "The extension [permessage-deflate] is disabled by default on the server and enabled by default on the client. It adds a significant overhead in terms of performance and memory consumption so we suggest to enable it only if it is really needed." (README lines 104-106), with a warning about zlib memory fragmentation under concurrency. `maxPayload` default 104857600 (100 MiB). Also documented: `maxBufferedChunks` default 262144, `maxFragments` default 16384, `skipUTF8Validation` default false, `closeTimeout` default 30000, `autoPong` default true. OWASP suggests message size limits "typically 64KB or less" and "100 messages per minute is a common starting point".
- Why it matters: library defaults are far above the sizes OWASP names; the repo's mock-core already passes options through `@fastify/websocket`.
- Verified: README lines 100-115 and ws API doc lines 80-110 read; OWASP lines 146 and 206.
- Source: ws README and doc as above; https://raw.githubusercontent.com/OWASP/CheatSheetSeries/master/cheatsheets/WebSocket_Security_Cheat_Sheet.md (2026-10-04).

**S-5. Liveness (heartbeat) in `ws`.**
- Found: README "How to detect and close broken connections?": a server `setInterval` of 30000 ms that calls `ws.terminate()` on a client whose `isAlive` is false, otherwise sets `isAlive = false` and `ws.ping()`; clients answer with `pong`. uWebSockets.js has `idleTimeout` plus `sendPingsAutomatically` (P-2).
- Why it matters: it is the documented pattern for dropping subscribers that vanished without a close frame.
- Verified: README lines 450-485 read.
- Source: https://raw.githubusercontent.com/websockets/ws/master/README.md (2026-10-04).

**S-6. Testing hook.**
- Found: `@fastify/websocket` decorates `injectWS([path], [upgradeContext])` for testing; the README example registers a `preValidation` hook that returns 401 when an `api-key` header is wrong.
- Why it matters: an upgrade-time rejection can be exercised without opening a port.
- Verified: README "Testing" section read; `index.js:55-110`.
- Source: https://raw.githubusercontent.com/fastify/fastify-websocket/main/README.md (2026-10-04).

**S-7. Server-Sent Events as an alternative transport.**
- Found: `@fastify/sse` 0.6.0 (MIT; peer `fastify ^5.x`; engines `node >=20.20.2`); the `fastify-uws` v2 README states Fastify "now provides official Server-Sent Events (SSE) support via `@fastify/sse`".
- Why it matters: only recorded as the one official one-way push option found; not evaluated for fan-out.
- Verified: `npm view @fastify/sse`; `fastify-uws` README read.
- Source: https://registry.npmjs.org/@fastify/sse ; https://raw.githubusercontent.com/Vanilla-IceCream/fastify-uws/main/README.md (2026-10-04).

**S-8. Single-process scope.**
- Found: every pattern above keeps state in one Node process: P-1 `server.clients`, P-2 uWebSockets topics, P-3 rooms (Socket.IO docs mention adapters for multiple servers, not read in depth), P-4 room clock. `@fastify/rate-limit` uses an in-memory store by default and names Redis for multiple servers (C-7).
- Why it matters: the evidence for multi-process scale-out was not collected, as the row says single-process.
- Verified: the documents above.
- Source: the sources cited in P-1 to P-4 and C-7 (2026-10-04).

## 8. Authentication at Upgrade

**A-1. The protocol leaves the mechanism open.**
- Found: RFC 6455 section 10.5: "This protocol doesn't prescribe any particular way that servers can authenticate clients during the WebSocket handshake. The WebSocket server can use any client authentication mechanism available to a generic HTTP server, such as cookies, HTTP authentication, or TLS authentication."
- Why it matters: any of the mechanisms in A-3 to A-6 is protocol-conformant.
- Verified: RFC text extracted by line (section at line 2919 of the fetched file).
- Source: https://www.rfc-editor.org/rfc/rfc6455.txt (2026-10-04).

**A-2. Origin check at the handshake.**
- Found: RFC 6455 section 10.2: "Servers that are not intended to process input from any web page but only for certain sites SHOULD verify the |Origin| field is an origin they expect. If the origin indicated is unacceptable to the server, then it SHOULD respond to the WebSocket handshake with a reply containing HTTP 403 Forbidden status code." OWASP: "Validate the `Origin` header on every handshake. Always use an explicit allowlist ... For Node.js `ws`, validate the `Origin` header in the HTTP server's `upgrade` event before calling `handleUpgrade`." OWASP names Cross-Site WebSocket Hijacking (CSWSH) because "Browsers include cookies in WebSocket handshake requests"; it recommends `SameSite=Lax` or `Strict` cookies and CSRF tokens in handshakes where CSRF protection exists.
- Why it matters: CORS (C-1) is a browser fetch mechanism, and the OWASP and RFC text above place the Origin decision on the WebSocket server.
- Verified: RFC section 10.2 (line 2787 of the file) and OWASP lines 74-99 read.
- Source: RFC URL above; https://raw.githubusercontent.com/OWASP/CheatSheetSeries/master/cheatsheets/WebSocket_Security_Cheat_Sheet.md (2026-10-04).

**A-3. Where a check can sit: `ws` and `@fastify/websocket`.**
- Found: the `ws` README "Client authentication" example authenticates in `server.on('upgrade', ...)` and on failure writes `HTTP/1.1 401 Unauthorized` and destroys the socket before `wss.handleUpgrade`. The `ws` API doc: "Use of `verifyClient` is discouraged. Rather handle client authentication in the `'upgrade'` event of the HTTP server." `@fastify/websocket` instead routes the upgrade through Fastify so `onRequest`, `preParsing`, `preValidation` and `preHandler` hooks can authenticate (C-10); its README example uses `fastify.addHook('preValidation', ...)` returning 401, and its custom-error-handler example passes `verifyClient` inside `options`. Errors thrown by hooks before the upgrade use the normal Fastify error handlers.
- Why it matters: two documented places exist for the check; the plugin README does not state which it prefers (not confirmed).
- Verified: `ws` README lines 285-328; ws API doc lines 107-127; websocket README read.
- Source: ws README and doc; fastify-websocket README (2026-10-04).

**A-4. Browser clients cannot set an `Authorization` header on the upgrade.**
- Found: Ably article: "the WebSocket browser API makes it impossible to set an Authorization header with a token"; it lists cookies, a token in the query string, a token smuggled in `Sec-WebSocket-Protocol`, and a first message after connect. Source type: vendor blog (Ably sells a realtime service); it restates browser behaviour, not a library specification.
- Why it matters: it limits what an upgrade-time check can read from a browser.
- Verified: HTML fetched and extracted; quotes copied.
- Source: https://ably.com/blog/websocket-authentication (2026-10-04).

**A-5. React Native allows request headers on the upgrade.**
- Found: React Native `v0.86.3` `Libraries/WebSocket/WebSocket.js:101` declares `options: ?{headers?: {origin?: string, ...}, ...}` and `:148` calls `NativeWebSocketModule.connect(url, protocols, {headers}, this._socketId)`; the same constructor shape is in `v0.86.0` and `main`. The repo pins `react-native 0.86.3` (E-3).
- Why it matters: the mobile client has a header option the browser does not; the file shows the API shape only, not behaviour on the Android emulator.
- Verified: the three tagged files fetched and grepped.
- Source: https://raw.githubusercontent.com/facebook/react-native/v0.86.3/packages/react-native/Libraries/WebSocket/WebSocket.js (2026-10-04).

**A-6. Token in query string versus first message.**
- Found: OWASP: "Tokens can be passed in query strings (note: tokens will appear in access logs and should be redacted) or as part of WebSocket messages after connection establishment. Message-based token passing avoids log exposure but requires protocol design considerations."
- Why it matters: it states the log-exposure trade-off of the query-string option.
- Verified: OWASP line 118.
- Source: OWASP cheat sheet URL above (2026-10-04).

**A-7. Lifetime of an authenticated socket.**
- Found: OWASP: "Handle session expiration by implementing server-side validation for long-running connections. Close WebSocket connections when sessions expire. Re-validate user sessions periodically (every 30 minutes is common)" with `ws.close(1008, 'Session expired')`; "When users log out, close all their WebSocket connections immediately. Maintain a mapping of sessions to active connections"; "Don't assume WebSocket connection equals unlimited access. Check authorization for each action"; "Rotate tokens in long-lived connections".
- Why it matters: it names the revocation-while-connected case; the mapping of sessions to connections is application code under every pattern in section 7.
- Verified: OWASP lines 95-135 read.
- Source: OWASP cheat sheet URL above (2026-10-04).

**A-8. Logging at upgrade.**
- Found: OWASP: "Avoid logging sensitive data - never log complete message contents, authentication tokens, session IDs"; traditional HTTP access logs "only capture the initial WebSocket upgrade request, not subsequent message traffic."
- Why it matters: it bears on query-string tokens (A-6) and on what an access log of the upgrade holds.
- Verified: OWASP lines 220-224 read.
- Source: OWASP cheat sheet URL above (2026-10-04).

## 9. Gaps / Not Confirmed

| # | Item | Status |
|---|---|---|
| G-1 | `@fastify/cookie` default of the `SameSite` option | not stated in the README section read |
| G-2 | `@fastify/swagger-ui` 6.x row in its README compatibility table | absent; compatibility rests on `index.js:30` `fastify: '5.x'` and on the `fastify-zod-openapi` peer range `^5.0.1 \|\| ^6.0.0` |
| G-3 | Plugin behaviour on Node 26 by execution | not run (read-only rule); rests on upstream CI definitions (N-2, N-5) |
| G-4 | Fastify issue tracker search for Node 26 defects | not done (GitHub API unauthenticated limit reached) |
| G-5 | `fastify-socket.io` licence | not confirmed (registry `license` field absent) |
| G-6 | `sodium-native` prebuilt binary for darwin-arm64 on Node 26 | not checked |
| G-7 | `uWebSockets.js` behaviour on Node 26 | only the presence of `uws_darwin_arm64_147.node` in the v20.71.0 tag and ABI 147 on this host; no load test |
| G-8 | Revocation of a single `@fastify/secure-session` cookie before expiry | not stated in the README read |
| G-9 | Whether `ws` frames a broadcast payload once or per socket | not stated in the docs read; `lib/sender.js` not read |
| G-10 | Socket.IO adapter behaviour for multiple servers | not read (out of the single-process scope) |
| G-11 | Application of `@fastify/rate-limit` and `@fastify/cors` hooks to upgrade requests | README statements only; not tested |
| G-12 | `@fastify/jwt` feature list, `@fastify/auth` feature list | not read beyond compatibility |
| G-13 | RBAC library comparison | out of row 8 (row 10 collects it) |
| G-14 | Query Q2 results (in-process pub/sub libraries) | low quality; not used as evidence |

---

## Appendix A. Raw `npm view` output

Every block below is the unedited output of the command shown in its first line (the notice lines of npm and the macOS certificate warnings were filtered out by `grep -v`). `uWebSockets.js` is not in this list: `npm view uWebSockets.js` returned `E404 ... name can no longer contain capital letters` (the package is not on the registry).

```text
$ npm view fastify version license time.modified peerDependencies engines   (+ time[5.12.5])
version = '5.12.5'
license = 'MIT'
time.modified = '2026-09-16T10:23:05.222Z'
time[5.12.5] = '2026-09-16T07:37:06.302Z'

$ npm view fastify-plugin version license time.modified peerDependencies engines   (+ time[6.0.0])
version = '6.0.0'
license = 'MIT'
time.modified = '2026-08-02T10:41:55.952Z'
time[6.0.0] = '2026-06-09T12:13:29.560Z'

$ npm view @fastify/cors version license time.modified peerDependencies engines   (+ time[11.3.0])
version = '11.3.0'
license = 'MIT'
time.modified = '2026-09-04T11:16:36.629Z'
time[11.3.0] = '2026-07-08T15:06:39.052Z'

$ npm view @fastify/websocket version license time.modified peerDependencies engines   (+ time[11.3.3])
version = '11.3.3'
license = 'MIT'
time.modified = '2026-10-03T14:44:35.209Z'
time[11.3.3] = '2026-10-03T14:44:35.012Z'

$ npm view @fastify/cookie version license time.modified peerDependencies engines   (+ time[11.1.2])
version = '11.1.2'
license = 'MIT'
time.modified = '2026-09-04T11:16:38.638Z'
time[11.1.2] = '2026-07-15T21:29:27.207Z'

$ npm view @fastify/session version license time.modified peerDependencies engines   (+ time[11.1.3])
version = '11.1.3'
license = 'MIT'
time.modified = '2026-09-14T08:14:48.436Z'
time[11.1.3] = '2026-09-14T08:14:48.227Z'

$ npm view @fastify/secure-session version license time.modified peerDependencies engines   (+ time[8.4.0])
version = '8.4.0'
license = 'MIT'
time.modified = '2026-09-22T13:06:52.033Z'
time[8.4.0] = '2026-09-22T13:06:51.814Z'

$ npm view @fastify/jwt version license time.modified peerDependencies engines   (+ time[10.2.2])
version = '10.2.2'
license = 'MIT'
time.modified = '2026-09-04T11:16:44.008Z'
time[10.2.2] = '2026-08-14T23:39:13.719Z'

$ npm view @fastify/rate-limit version license time.modified peerDependencies engines   (+ time[11.2.0])
version = '11.2.0'
license = 'MIT'
time.modified = '2026-09-04T11:16:44.091Z'
time[11.2.0] = '2026-07-29T14:38:39.112Z'

$ npm view @fastify/static version license time.modified peerDependencies engines   (+ time[10.1.5])
version = '10.1.5'
license = 'MIT'
time.modified = '2026-09-26T07:38:36.770Z'
time[10.1.5] = '2026-09-26T07:38:36.557Z'

$ npm view @fastify/send version license time.modified peerDependencies engines   (+ time[4.1.1])
version = '4.1.1'
license = 'MIT'
time.modified = '2026-08-12T20:02:07.993Z'
time[4.1.1] = '2026-08-08T15:03:09.572Z'

$ npm view @fastify/swagger version license time.modified peerDependencies engines   (+ time[9.9.1])
version = '9.9.1'
license = 'MIT'
time.modified = '2026-09-30T16:03:21.537Z'
time[9.9.1] = '2026-09-30T16:03:21.006Z'

$ npm view @fastify/swagger-ui version license time.modified peerDependencies engines   (+ time[6.1.1])
version = '6.1.1'
license = 'MIT'
time.modified = '2026-09-04T11:16:55.526Z'
time[6.1.1] = '2026-07-28T17:10:17.284Z'

$ npm view @fastify/helmet version license time.modified peerDependencies engines   (+ time[13.1.1])
version = '13.1.1'
license = 'MIT'
time.modified = '2026-09-04T11:16:42.171Z'
time[13.1.1] = '2026-08-19T10:02:18.430Z'

$ npm view @fastify/under-pressure version license time.modified peerDependencies engines   (+ time[9.2.0])
version = '9.2.0'
license = 'MIT'
time.modified = '2026-09-18T15:27:20.973Z'
time[9.2.0] = '2026-09-18T15:27:20.807Z'

$ npm view @fastify/auth version license time.modified peerDependencies engines   (+ time[5.1.1])
version = '5.1.1'
license = 'MIT'
time.modified = '2026-09-16T12:41:12.347Z'
time[5.1.1] = '2026-09-16T12:41:12.149Z'

$ npm view @fastify/sensible version license time.modified peerDependencies engines   (+ time[6.0.6])
version = '6.0.6'
license = 'MIT'
time.modified = '2026-09-26T16:46:15.098Z'
time[6.0.6] = '2026-09-26T16:46:14.945Z'

$ npm view @fastify/request-context version license time.modified peerDependencies engines   (+ time[7.0.0])
version = '7.0.0'
license = 'MIT'
time.modified = '2026-09-04T11:16:45.393Z'
time[7.0.0] = '2026-06-09T12:20:01.073Z'

$ npm view @fastify/compress version license time.modified peerDependencies engines   (+ time[9.2.0])
version = '9.2.0'
license = 'MIT'
time.modified = '2026-09-04T11:16:35.971Z'
time[9.2.0] = '2026-08-08T09:06:59.601Z'

$ npm view @fastify/sse version license time.modified peerDependencies engines   (+ time[0.6.0])
version = '0.6.0'
license = 'MIT'
time.modified = '2026-09-04T11:16:53.530Z'
peerDependencies = { fastify: '^5.x' }
engines = { node: '>=20.20.2' }
time[0.6.0] = '2026-07-27T19:28:32.885Z'

$ npm view @fastify/error version license time.modified peerDependencies engines   (+ time[4.2.0])
version = '4.2.0'
license = 'MIT'
time.modified = '2026-08-12T20:02:04.362Z'
time[4.2.0] = '2025-06-01T07:56:14.569Z'

$ npm view @fastify/bearer-auth version license time.modified peerDependencies engines   (+ time[10.1.3])
version = '10.1.3'
license = 'MIT'
time.modified = '2026-09-04T11:16:37.972Z'
time[10.1.3] = '2026-08-08T15:03:17.802Z'

$ npm view @fastify/accepts version license time.modified peerDependencies engines   (+ time[5.0.6])
version = '5.0.6'
license = 'MIT'
time.modified = '2026-09-10T10:32:03.932Z'
time[5.0.6] = '2026-09-10T10:32:03.743Z'

$ npm view fastify-type-provider-zod version license time.modified peerDependencies engines   (+ time[7.0.0])
version = '7.0.0'
license = 'MIT'
time.modified = '2026-06-24T00:27:25.446Z'
peerDependencies = {
  '@fastify/swagger': '>=9.5.1',
  fastify: '^5.5.0',
  'openapi-types': '^12.1.3',
  zod: '>=4.1.5'
}
time[7.0.0] = '2026-06-24T00:27:25.196Z'

$ npm view fastify-zod-openapi version license time.modified peerDependencies engines   (+ time[5.7.0])
version = '5.7.0'
license = 'MIT'
time.modified = '2026-07-20T13:32:11.927Z'
peerDependencies = {
  '@fastify/swagger': '^9.0.0',
  '@fastify/swagger-ui': '^5.0.1 || ^6.0.0',
  fastify: '5',
  zod: '^3.25.74 || ^4.0.0'
}
engines = { node: '>=20' }
time[5.7.0] = '2026-07-20T13:32:11.597Z'

$ npm view @fastify/type-provider-typebox version license time.modified peerDependencies engines   (+ time[6.1.0])
version = '6.1.0'
license = 'MIT'
time.modified = '2026-08-12T20:02:10.195Z'
peerDependencies = { typebox: '^1.0.13' }
time[6.1.0] = '2025-10-19T18:06:49.218Z'

$ npm view @fastify/type-provider-json-schema-to-ts version license time.modified peerDependencies engines   (+ time[5.0.0])
version = '5.0.0'
license = 'MIT'
time.modified = '2026-08-12T20:02:09.107Z'
time[5.0.0] = '2024-12-23T07:32:43.583Z'

$ npm view zod version license time.modified peerDependencies engines   (+ time[4.6.5])
version = '4.6.5'
license = 'MIT'
time.modified = '2026-10-02T16:52:44.621Z'
time[4.6.5] = '2026-09-13T23:25:14.644Z'

$ npm view zod-openapi version license time.modified peerDependencies engines   (+ time[6.0.2])
version = '6.0.2'
license = 'MIT'
time.modified = '2026-08-31T08:09:00.148Z'
peerDependencies = { zod: '^4.0.0' }
engines = { node: '>=22.14.0' }
time[6.0.2] = '2026-08-31T08:08:59.842Z'

$ npm view openapi-types version license time.modified peerDependencies engines   (+ time[12.1.3])
version = '12.1.3'
license = 'MIT'
time.modified = '2023-05-24T22:26:38.944Z'
time[12.1.3] = '2023-05-24T22:26:38.839Z'

$ npm view typebox version license time.modified peerDependencies engines   (+ time[1.3.34])
version = '1.3.34'
license = 'MIT'
time.modified = '2026-09-18T09:41:08.082Z'
time[1.3.34] = '2026-09-18T09:41:07.752Z'

$ npm view @sinclair/typebox version license time.modified peerDependencies engines   (+ time[0.34.52])
version = '0.34.52'
license = 'MIT'
time.modified = '2026-07-16T10:18:21.446Z'
time[0.34.52] = '2026-07-11T21:08:28.286Z'

$ npm view ws version license time.modified peerDependencies engines   (+ time[8.22.0])
version = '8.22.0'
license = 'MIT'
time.modified = '2026-09-26T15:00:58.022Z'
peerDependencies = { bufferutil: '^4.0.1', 'utf-8-validate': '>=5.0.2' }
engines = { node: '>=10.0.0' }
time[8.22.0] = '2026-09-26T15:00:57.748Z'

$ npm view @types/ws version license time.modified peerDependencies engines   (+ time[8.18.2])
version = '8.18.2'
license = 'MIT'
time.modified = '2026-09-29T08:07:45.836Z'
peerDependencies = {}
time[8.18.2] = '2026-09-29T08:07:45.655Z'

$ npm view bufferutil version license time.modified peerDependencies engines   (+ time[4.1.0])
version = '4.1.0'
license = 'MIT'
time.modified = '2026-07-30T17:57:13.921Z'
engines = { node: '>=6.14.2' }
time[4.1.0] = '2025-12-18T16:24:21.551Z'

$ npm view sodium-native version license time.modified peerDependencies engines   (+ time[5.1.0])
version = '5.1.0'
license = 'MIT'
time.modified = '2026-05-06T13:41:36.188Z'
engines = { bare: '>=1.16.0' }
time[5.1.0] = '2026-03-06T09:39:58.351Z'

$ npm view socket.io version license time.modified peerDependencies engines   (+ time[4.8.4])
version = '4.8.4'
license = 'MIT'
time.modified = '2026-09-25T08:51:53.253Z'
engines = { node: '>=10.2.0' }
time[4.8.4] = '2026-09-25T08:51:53.015Z'

$ npm view fastify-socket.io version license time.modified peerDependencies engines   (+ time[5.1.0])
version = '5.1.0'
time.modified = '2024-08-12T14:26:58.183Z'
peerDependencies = { fastify: '4.x.x', 'socket.io': '>=4' }
time[5.1.0] = '2024-08-12T14:26:58.022Z'

$ npm view fastify-uws version license time.modified peerDependencies engines   (+ time[2.0.0])
version = '2.0.0'
license = 'MIT'
time.modified = '2026-04-18T08:14:29.156Z'
time[2.0.0] = '2026-04-18T08:14:29.053Z'

$ npm view fastify-sse-v2 version license time.modified peerDependencies engines   (+ time[4.2.2])
version = '4.2.2'
license = 'MIT'
time.modified = '2026-01-27T10:50:03.020Z'
peerDependencies = { fastify: '>=4' }
time[4.2.2] = '2026-01-27T10:50:02.900Z'

$ npm view mqemitter version license time.modified peerDependencies engines   (+ time[7.1.0])
version = '7.1.0'
license = 'ISC'
time.modified = '2025-07-14T08:41:19.337Z'
engines = { node: '>=20' }
time[7.1.0] = '2025-07-14T08:41:19.160Z'

$ npm view @colyseus/core version license time.modified peerDependencies engines   (+ time[0.18.18])
version = '0.18.18'
license = 'MIT'
time.modified = '2026-09-30T03:25:20.507Z'
peerDependencies = {
  zod: '^4.1.12',
  '@pm2/io': '^6.1.0',
  express: '^4.16.0 || ^5.0.0',
  '@colyseus/auth': '^0.18.3',
  '@colyseus/schema': '^5.0.8',
  '@colyseus/better-call': '^1.3.1',
  '@colyseus/ws-transport': '^0.18.4'
}
engines = { node: '>= 22.x' }
time[0.18.18] = '2026-09-29T15:39:22.570Z'

$ npm view colyseus version license time.modified peerDependencies engines   (+ time[0.18.9])
version = '0.18.9'
license = 'MIT'
time.modified = '2026-09-30T21:47:53.988Z'
peerDependencies = {
  vite: '>=6.0.0',
  '@colyseus/auth': '0.18.x',
  '@colyseus/core': '0.18.x',
  '@colyseus/schema': '^5.0.8',
  '@colyseus/redis-driver': '0.18.x',
  '@colyseus/ws-transport': '0.18.x',
  '@colyseus/redis-presence': '0.18.x',
  '@colyseus/uwebsockets-transport': '0.18.x'
}
engines = { node: '>= 22.x' }
time[0.18.9] = '2026-09-30T21:47:53.821Z'

```

---
*Generated: 2026-10-04*
*Last Updated: 2026-10-04*
