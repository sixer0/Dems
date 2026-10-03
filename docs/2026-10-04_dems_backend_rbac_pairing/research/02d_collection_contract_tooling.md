---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: 9
date: 2026-10-04
agent: data-collector
tier: 2
items_collected: 58
last_updated: 2026-10-04 01:54
---

# Data Collection Report: Contract Tooling (Row 9, Tier 2)

## Task Overview

Blueprint row 9 (`identification/02_structured.md`, step 9, FIRM): collect evidence on contract tooling with generic queries only. Four topics: (1) OpenAPI-first versus code-first for a TypeScript monorepo; (2) generators and typed clients usable in a browser and in React Native 0.86 on Hermes (fetch-based, no Node built-ins); (3) runtime validation with zod 4; (4) drift and conformance test tools. Constraint carried from the project: ready-made frameworks and libraries only.

This file collects. It draws no conclusion and makes no recommendation. Row 14 (data-analyst) decides.

### Conventions used in this file

- **Fetch date**: every URL and registry lookup was read on **2026-10-04** unless a row says otherwise.
- **Verification codes** (the "Verified by" column):
  - **NPM** = output of `npm view <pkg> ...` against the public registry (read-only lookup).
  - **SRC** = package source file read from the registry CDN (`unpkg.com`) and grepped. Static reading only, nothing was executed.
  - **LOCAL** = file on this host under `/Users/gsp-budi/Documents/DEMS` (read-only), cited as `path:line`.
  - **PAGE** = page read through the WebFetch tool. The tool returns a summary produced by a small model, so a PAGE claim is single-source unless another code is listed beside it. Where the summary contradicted a harder source, the harder source is used and the conflict is logged in "Conflicts and discarded results".
  - **API** = JSON from the PyPI or GitHub REST API.
- **"not confirmed"** means no source read in this task establishes it.
- **Hermes suitability** is stated as what the evidence shows about the runtime APIs a candidate needs. **No candidate was executed on Hermes or on a device in this task** (read-only task, no installs, no processes). Every Hermes cell is therefore "static reading" or "documented by the vendor", never "tested".

---

## Query Log

### Confidentiality statement

Every web query below is a generic technology query. No project name, product name, user name, file content or design-document term was placed in any query or URL. The repo facts in this file come from local reads only.

### Web search queries (exact strings, in order issued)

| # | Exact query string | Domain filter |
|---|---|---|
| Q1 | `OpenAPI-first versus code-first API development TypeScript monorepo trade-offs` | none |
| Q2 | `openapi-fetch React Native Hermes fetch Request compatibility` | none |
| Q3 | `zod 4 React Native Hermes compatibility issue` | none |
| Q4 | `Hey API openapi-ts zod plugin TanStack Query plugin fetch client` | none |
| Q5 | `React Native 0.86 release blog Hermes` | none |
| Q6 | `React Native 0.84 Hermes V1 default engine release` | none |
| Q7 | `ts-rest zod 4 support standard schema roadmap maintenance` | none |
| Q8 | `Schemathesis OpenAPI conformance testing property-based CLI` | none |
| Q9 | `oasdiff OpenAPI breaking changes detection CI` | none |
| Q10 | `oRPC typesafe client React Native Expo usage` | none |
| Q11 | `Expo SDK 56 changelog expo/fetch default global fetch` | expo.dev |
| Q12 | `Hey API openapi-ts Zod plugin documentation zod v4 mini` | heyapi.dev |
| Q13 | `oRPC React Native Fetch API limitations File Blob Event Iterator expo/fetch` | orpc.dev, orpc.unnoq.com |
| Q14 | `TypeScript monorepo shared zod schemas generate OpenAPI document typed client Fastify` | none |
| Q15 | `validate API responses against OpenAPI schema in tests Fastify inject contract test` | none |

### Pages fetched (WebFetch), in order

Result codes: ok = content returned; 404 = not found; 301 = redirect reported by the tool and re-fetched at the same host.

| # | URL | Result |
|---|---|---|
| P1 | https://openapi-ts.dev/openapi-fetch/ | ok |
| P2 | https://heyapi.dev/openapi-ts/clients/fetch | ok |
| P3 | https://reactnative.dev/docs/hermes | ok (page documents RN 0.87) |
| P4 | https://zod.dev/json-schema | ok |
| P5 | https://reactnative.dev/docs/network | ok (page documents RN 0.87) |
| P6 | https://orval.dev/ | ok |
| P7 | https://kubb.dev/ | ok |
| P8 | https://reactnative.dev/docs/0.86/hermes | ok |
| P9 | https://github.com/facebook/react-native/releases/tag/v0.86.0 | ok, summary discarded (wrong date, see Conflicts) |
| P10 | https://reactnative.dev/blog/2026/02/11/react-native-0.84 | ok |
| P11 | https://github.com/facebook/hermes/blob/main/doc/Features.md | ok (raw file also fetched with curl, see C-list) |
| P12 | https://github.com/openapi-ts/openapi-typescript/issues?q=is%3Aissue+react+native | ok |
| P13 | https://github.com/hey-api/openapi-ts/issues?q=is%3Aissue+react+native | ok |
| P14 | https://github.com/colinhacks/zod/issues?q=is%3Aissue+hermes | ok |
| P15 | https://github.com/colinhacks/zod/issues/5070 | ok |
| P16 | https://github.com/colinhacks/zod/issues/4690 | ok |
| P17 | https://github.com/colinhacks/zod/issues/4148 | ok |
| P18 | https://github.com/openapi-ts/openapi-typescript/issues/2554 | ok |
| P19 | https://openapi-ts.dev/introduction | ok |
| P20 | https://openapi-ts.dev/cli | ok |
| P21 | https://openapi-ts.dev/openapi-react-query/ | ok |
| P22 | https://heyapi.dev/openapi-ts/get-started | ok |
| P23 | https://heyapi.dev/openapi-ts/plugins/zod | 404 |
| P24 | https://heyapi.dev/openapi-ts/plugins/tanstack-query | ok |
| P25 | https://orval.dev/docs/guides/fetch | ok |
| P26 | https://orval.dev/docs/guides/zod | ok |
| P27 | https://heyapi.dev/openapi-ts/validators/zod | 404 |
| P28 | https://github.com/oazapfts/oazapfts | ok |
| P29 | https://github.com/asteasolutions/zod-to-openapi | ok |
| P30 | https://github.com/samchungy/zod-openapi | ok |
| P31 | https://github.com/turkerdev/fastify-type-provider-zod | ok |
| P32 | https://github.com/fastify/fastify-swagger | ok |
| P33 | https://orpc.dev/docs/openapi/getting-started | ok (page was about routing metadata only; nothing extracted) |
| P34 | https://ts-rest.com/docs/open-api | 404 |
| P35 | https://orpc.dev/docs/openapi/openapi-specification | ok |
| P36 | https://orpc.dev/docs/openapi/client/openapi-link | ok |
| P37 | https://github.com/ts-rest/ts-rest | ok |
| P38 | https://kubb.dev/plugins/plugin-client/ | 301 to http://kubb.dev/plugins/plugin-client |
| P39 | https://kubb.dev/plugins/plugin-client | ok |
| P40 | https://schemathesis.readthedocs.io/en/stable/ | ok |
| P41 | https://www.oasdiff.com/ | ok |
| P42 | https://swagger.io/blog/code-first-vs-design-first-api/ | ok |
| P43 | https://sookocheff.com/post/api/the-false-dichotomoy-of-design-first-and-code-first-api-development/ | ok |
| P44 | https://appmaster.io/blog/openapi-first-vs-code-first-api-development | ok |
| P45 | https://wundergraph.com/blog/never_write_openapi_specifications_again | ok |
| P46 | https://redocly.com/docs/cli/commands/lint | ok |
| P47 | https://github.com/stoplightio/spectral | ok |
| P48 | https://github.com/stoplightio/prism | ok |
| P49 | https://docs.pact.io/ | ok |
| P50 | https://heyapi.dev/openapi-ts/plugins | ok (core plugin list only) |
| P51 | https://heyapi.dev/docs/openapi/typescript/plugins/zod | 404 |
| P52 | https://heyapi.dev/docs/openapi/typescript/clients/fetch | ok |
| P53 | https://heyapi.dev/docs/openapi/typescript/plugins/zod/v4 | ok |
| P54 | https://heyapi.dev/docs/openapi/typescript/validators | ok |
| P55 | https://github.com/ts-rest/ts-rest/releases | ok |
| P56 | https://github.com/ts-rest/ts-rest/issues?q=is%3Aissue+zod+4 | ok |
| P57 | https://github.com/openapi-ts/openapi-typescript/issues?q=is%3Aissue+typescript+6 | ok |
| P58 | https://orpc.dev/docs/adapters/react-native | 404 (the earlier redirect from orpc.unnoq.com/docs/adapters/react-native pointed here) |
| P59 | https://orpc.dev/docs/adapters/expo | ok |
| P60 | https://orpc.dev/docs/requirements | ok |
| P61 | https://expo.dev/changelog/sdk-56 | ok |
| P62 | https://docs.expo.dev/versions/latest/sdk/expo/ | ok (page documents SDK v57.0.0) |

### Registry, CDN and API reads (curl, read-only GET)

| # | URL | Purpose |
|---|---|---|
| C1 | https://unpkg.com/openapi-fetch@0.17.0/package.json and `/dist/index.mjs` | runtime source of openapi-fetch 0.17.0 |
| C2 | https://unpkg.com/@hey-api/openapi-ts@0.99.0/?meta , `/package.json` , `/dist/clients/fetch/{client,utils,index}.ts` , `/dist/clients/core/serverSentEvents.ts` | bundled fetch client of Hey API 0.99.0 |
| C3 | https://unpkg.com/@orval/fetch@8.39.0/?meta and `/dist/index.mjs` | Orval fetch template |
| C4 | https://unpkg.com/@kubb/plugin-fetch@5.5.2/?meta and `/templates/fetch.ts` | Kubb fetch template |
| C5 | https://unpkg.com/@oazapfts/runtime@1.2.0/?meta and `/index.js` , `/headers.js` , `/query.js` , `/util.js` , `/package.json` | oazapfts runtime |
| C6 | https://unpkg.com/@orpc/standard-server-fetch@1.15.4/?meta , `/package.json` , `/dist/index.mjs` | oRPC fetch adapter |
| C7 | https://raw.githubusercontent.com/facebook/hermes/main/doc/Features.md | Hermes feature list (raw) |
| C8 | https://raw.githubusercontent.com/samchungy/zod-openapi/master/README.md | zod-openapi README (raw) |
| C9 | https://raw.githubusercontent.com/asteasolutions/zod-to-openapi/main/README.md | zod-to-openapi README (raw) |
| C10 | https://raw.githubusercontent.com/seriousme/fastify-openapi-glue/master/README.md | fastify-openapi-glue README (raw) |
| C11 | https://pypi.org/pypi/schemathesis/json | Schemathesis version and licence |
| C12 | https://api.github.com/repos/{oasdiff/oasdiff, schemathesis/schemathesis, stoplightio/prism, Redocly/redocly-cli, stoplightio/spectral, pact-foundation/pact-js, apiaryio/dredd, openapi-ts/openapi-typescript, orval-labs/orval, kubb-labs/kubb, colinhacks/zod, asteasolutions/zod-to-openapi, samchungy/zod-openapi, turkerdev/fastify-type-provider-zod, ts-rest/ts-rest, oazapfts/oazapfts} and `.../oasdiff/oasdiff/releases/latest` | licence, archived flag, last push |

Notes on C12: `hey-api/openapi-ts` and `unnoq/orpc` answered "Moved Permanently" (repositories renamed); a follow-up with redirects enabled hit "API rate limit exceeded" (unauthenticated), so their GitHub-side licence and push data were **not obtained**. Their licence is taken from NPM only.

### npm registry lookups

Command form: `npm view <pkg> version license time.modified peerDependencies --cache <scratchpad>/npmcache`.

The first attempt used the default cache and failed for every package with `EPERM ... Your cache folder contains root-owned files` (`~/.npm/_cacache`). The lookups were repeated with `--cache` pointed at the session scratchpad, which writes nothing to the project or to the user's cache. The line `ERROR: failed to copy trust settings of system certificate-NNNNN` printed by npm is noise from the host certificate store and was filtered out. Full results are in "Appendix A: npm lookup output".

### Query-log term check

A case-insensitive scan of this whole "Query Log" section for the task's domain vocabulary (the term list is kept in `delegation_progress/data_collector_step_9.md`) returned 0 hits at write time. Q1-Q15 and the P and C URL lists contain only technology names (OpenAPI, TypeScript, zod, Fastify, React Native, Hermes, Expo, vendor and package names). Host file reads are listed in their own section after this one because their paths contain repo directory names; they are not queries.

---

## Local Reads (host files, not queries)

Read-only. No command was executed besides `grep`, `sed`, `ls`, `curl` GET and `node -e` that prints a `package.json` field.

`packages/shared/{package.json, scripts/gen-openapi.ts, src/api/*, test/openapi.test.ts}`; `apps/{mobile,core-web,mock-core}/package.json`; `apps/mobile/android/gradle.properties`; `node_modules/react-native/{package.json, sdks/hermes-engine/version.properties, Libraries/Network/fetch.js, Libraries/Core/setUpXHR.js, Libraries/Blob/URL.js, Libraries/Blob/URLSearchParams.js}`; `node_modules/whatwg-fetch/dist/fetch.umd.js`; `node_modules/expo/src/winter/{runtime.native.ts, fetch/fetch.ts, fetch/FetchResponse.ts}`; `node_modules/zod/{package.json, v4/core/util.js, v4/core/schemas.js, v4/classic/external.js}`.

---

## Current Approach in the Repo (read first, as the task asked)

Scope: `packages/shared` only. All paths relative to `/Users/gsp-budi/Documents/DEMS/`.

| ID | Found | Why it matters | Verified by | Source |
|---|---|---|---|---|
| F9-01 | The contract is **code-first from zod**: 18 named zod schemas in `CORE_API_SCHEMAS`, and one hand-authored operation table `CORE_API_OPERATIONS` (10 operations: 1 live, 9 simulated). The header states this table is "the one table the OpenAPI document (`openapi.ts`) is built from". | Defines the "current approach" any candidate is compared with: zod is already the single source of truth for bodies. | LOCAL | `packages/shared/src/api/core-api.ts:17-18, 337-356, 418` ; `packages/shared/src/api/openapi.ts:5` |
| F9-02 | The OpenAPI 3.1.0 document is assembled **by hand-written code with no OpenAPI library**: own TypeScript interfaces for the emitted subset, paths built in a loop, `info`, `servers`, `tags`, `components` literal. Schemas come from zod's own `z.toJSONSchema(registry, { target: 'draft-2020-12', io: 'input', unrepresentable: 'throw', uri, override })`; two post-fixes remove zod's date-time `pattern` and the +/-2^53 integer bounds. | Shows which part is generated by zod itself and which part is bespoke glue. | LOCAL | `packages/shared/src/api/openapi.ts:26, 51, 75-130, 209-232, 323-368` |
| F9-03 | Generator script `scripts/gen-openapi.ts` writes `packages/shared/openapi/openapi.json` (95,021 bytes on disk) and has a **`--check` mode** that exits 1 when the file is missing or stale. Run as `npm run openapi:gen -w @dems/shared`; the script header records that inside the Claude sandbox the `tsx` CLI fails with `listen EPERM` and `node --import tsx scripts/gen-openapi.ts` is used instead. | A drift gate already exists as a script flag; the sandbox note affects how any generator CLI is run here. | LOCAL | `packages/shared/scripts/gen-openapi.ts:9-13, 21-26, 28-47` ; `packages/shared/package.json:28` ; `ls -la packages/shared/openapi` (95021 bytes) |
| F9-04 | The drift and conformance test (`test/openapi.test.ts`, 435 lines) does: (a) `validate()` and `dereference()` from `@scalar/openapi-parser` (pinned 0.29.9) with a **positive control** that a broken `$ref` is rejected; (b) exact operation count (10) and LIVE/SIMULATED badge counts; (c) permission-extension check against the role table; (d) **committed `openapi.json` equals a fresh build byte for byte**; (e) allowlist of `x-` extension keys; (f) every documented example parses with its schema; (g) drives the real in-process handlers and parses each response with `validateCoreApiResponse`, and asserts every documented status is produced at least once. | The existing drift test is generator-agnostic: it compares builder output to a committed file and to handler behaviour. | LOCAL | `packages/shared/test/openapi.test.ts:6, 77-97, 99-116, 118-134, 136-140, 152-157, 209-253, 286-304, 316-399` ; `packages/shared/package.json:35` |
| F9-05 | `validateCoreApiResponse(operationId, status, body)` checks the status is documented and the body `safeParse`s with that status's schema; returns a typed verdict (`UNKNOWN_OPERATION`, `UNDOCUMENTED_STATUS`, `UNEXPECTED_BODY`, `INVALID_BODY`). `matchCoreApiOperation(method, pathname)` is a hand-written router over the same table. | These two functions are bespoke versions of what response validators and typed-client generators provide. | LOCAL | `packages/shared/src/api/core-api.ts:660-731` ; `packages/shared/test/openapi.test.ts:255-270` |
| F9-06 | **WebSocket is outside the OpenAPI document**: the `Heartbeat` message is a zod schema (`HeartbeatSchema`, `WsServerMessageSchema` = `z.discriminatedUnion('type', [...])`) with a compile-time `Exact<>` type check against a hand-written interface; OpenAPI only describes it in prose under the Realtime tag. | The candidates below are HTTP/OpenAPI tools; none of them covers the socket message contract (realtime contract tooling was not in row 9's list and was not collected). | LOCAL | `packages/shared/src/api/realtime-messages.ts:25-43` ; `packages/shared/src/api/openapi.ts:15-16` |
| F9-07 | **No typed REST client exists in the repo.** `packages/shared/src` contains `api, brand, demo-data, domain, i18n, realtime, sim, tokens` and no `client/` folder. The web "API Reference" page builds its document with `createOpenApiDocument()` and renders it with `@scalar/api-reference-react` 0.9.76. | Establishes the baseline for the "typed clients" topic: nothing to compare against except the simulator route table. | LOCAL | `ls packages/shared/src` ; `apps/core-web/src/features/api-reference/api-document.ts:4, 19, 133` ; `apps/core-web/package.json:22` |
| F9-08 | Versions in play: `zod` 4.6.5, `typescript` 6.0.3, `vitest` 5.0.3, `@tanstack/react-query` 5.104.0 (web and mobile), `react-native` 0.86.3, `expo` ~57.0.26, `fastify` 5.12.5 (mock-core), `vite` 8.3.1, Node v26.8.2, npm 11.19.1. | The compatibility columns below are judged against these numbers. | LOCAL | `packages/shared/package.json` ; `apps/mobile/package.json:31,32,58,72,84` ; `apps/core-web/package.json:22,23,38,54-56` ; `apps/mock-core/package.json:19` ; `node --version`, `npm --version` |

---

## Runtime Facts for Browser and React Native 0.86 on Hermes

These facts bound what "fetch-based, no Node built-ins" can mean on the phone.

| ID | Found | Why it matters | Verified by | Source |
|---|---|---|---|---|
| F9-10 | Installed `react-native` is 0.86.3. It bundles Hermes legacy `0.17.0` and Hermes V1 `250829098.0.17` (`hermes-compiler` dependency `250829098.0.17`). Hermes V1 became the default engine in RN 0.84 (blog dated 2026-02-11; opt-out via `hermesV1Enabled=false` in `android/gradle.properties`). The app's `android/gradle.properties` sets `hermesEnabled=true` and no `hermesV1Enabled` line was found. | The engine the app runs is, from files, Hermes V1; vendor documentation for legacy Hermes may not apply. | LOCAL + PAGE | `node_modules/react-native/package.json` (dependencies) ; `node_modules/react-native/sdks/hermes-engine/version.properties` (`HERMES_VERSION_NAME=0.17.0`, `HERMES_V1_VERSION_NAME=250829098.0.17`) ; `apps/mobile/android/gradle.properties:42` ; https://reactnative.dev/blog/2026/02/11/react-native-0.84 (fetched 2026-10-04) |
| F9-11 | RN 0.86.3 core polyfills, in `setUpXHR.js`: `FormData`, `fetch`, `Headers`, `Request`, `Response`, `WebSocket`, `Blob`, `File`, `FileReader`, `URL`, `URLSearchParams`, `AbortController`, `AbortSignal`. `fetch` is the `whatwg-fetch` polyfill (`whatwg-fetch` `^3.0.0`, installed 3.6.20, MIT). | These are the globals a generated fetch client can assume on RN when the polyfill is the active `fetch`. | LOCAL | `node_modules/react-native/Libraries/Core/setUpXHR.js:25-45` ; `node_modules/react-native/Libraries/Network/fetch.js:15-22` ; `node_modules/whatwg-fetch/package.json` (version 3.6.20, license MIT) |
| F9-12 | In whatwg-fetch 3.6.20 the `Response` constructor assigns `type, status, ok, statusText, headers, url` and calls `_initBody`; **no `body` property (no stream) is defined**: a grep of `fetch.umd.js` for `get body`, `.body =` and `ReadableStream` returns nothing, and the only body-related fields are `bodyUsed` and the private `_bodyInit`, `_bodyText`, `_bodyBlob`. Reading goes through `.text()`, `.json()`, `.blob()`, `.arrayBuffer()`, `.formData()`. `Request` supports `signal` and abort. | Any client code that tests `response.body` (stream) sees `undefined` under the polyfill. | LOCAL (static reading; grep re-run precisely after a first, looser grep also matched `bodyUsed`) | `node_modules/whatwg-fetch/dist/fetch.umd.js:375-393, 469-489, 536-537, 626-632` |
| F9-13 | RN 0.86.3 `URL` implements `searchParams` (lazy `URLSearchParams`) and the other getters; `URLSearchParams` accepts a string, an array of pairs or a plain record. A grep for `ReadableStream`, `TextEncoder`, `TextDecoder`, `TextDecoderStream` over `Libraries/Core`, `Libraries/Blob`, `Libraries/Network`, `src/private/webapis` returned **no match**. | URL building in generated clients works on the RN polyfill; Web Streams and text-codec globals are not provided by RN core itself. | LOCAL | `node_modules/react-native/Libraries/Blob/URL.js:64-66, 125-199` ; `Libraries/Blob/URLSearchParams.js:20-46` ; grep result (empty) |
| F9-14 | **Expo 57.0.26 replaces the global `fetch` with `expo/fetch` on native** unless `EXPO_PUBLIC_USE_RN_FETCH` is `1` or `true`. `Request`, `Response`, `Headers` stay RN's polyfills (the file's comment says reading `Headers` triggers the RN polyfill chain that also installs them). The same file installs `TextDecoder`, `TextDecoderStream`, `TextEncoderStream`, `URL`, `URLSearchParams`, `DOMException`, `structuredClone`, patches `FormData`/`AbortSignal`, polyfills `Symbol.asyncIterator`, and states "ReadableStream is injected by Metro as a global". A grep for `EXPO_PUBLIC_USE_RN_FETCH` over `apps/mobile` (excluding `node_modules`, `android`, `ios`) returned no line, and no `.env*` file exists in `apps/mobile` or the repo root (`ls -a`), so no opt-out was found. | Under SDK 57 the default fetch on the phone is not the whatwg-fetch polyfill, which changes what `response.body` is. | LOCAL + PAGE | `node_modules/expo/src/winter/runtime.native.ts:14-53` ; https://expo.dev/changelog/sdk-56 (fetched 2026-10-04: "`expo/fetch` is now installed as the default implementation of `globalThis.fetch`", opt out with `EXPO_PUBLIC_USE_RN_FETCH=1`) ; https://docs.expo.dev/versions/latest/sdk/expo/ (fetched 2026-10-04, documents SDK v57.0.0: on Android and iOS `expo/fetch` is also the global `fetch`) |
| F9-15 | `expo/fetch`'s `fetch(input, init)` accepts a `Request`: it detects Request-like input, reads the whatwg-fetch hidden `_bodyInit` for the body, and takes `method`, `headers`, `signal`, `redirect`, `credentials` from it. Its `FetchResponse` has a `body` getter that returns a `ReadableStream` (created lazily). | Clients that build `new Request(...)` and then call `fetch(request)` are the pattern used by openapi-fetch and the Hey API fetch client (F9-50, F9-51); this is how the pair meets on SDK 57. | LOCAL (static reading) | `node_modules/expo/src/winter/fetch/fetch.ts:13-46` ; `node_modules/expo/src/winter/fetch/FetchResponse.ts:281-288` |
| F9-16 | RN docs (page for 0.87) list fetch gaps: `redirect:manual` and `credentials:omit` do not work; same-name headers on Android keep only the latest; cookie-based authentication is "currently unstable"; Android API 28+ blocks cleartext HTTP by default (manifest `usesCleartextTraffic` overrides). | Fetch-level behaviours any generated client inherits on the phone. | PAGE (single source) | https://reactnative.dev/docs/network (fetched 2026-10-04) |
| F9-17 | Hermes feature page: targets ES2015 plus listed extras; lists `Proxy`/`Reflect`, `Intl`, `BigInt` as supported; lists "Local mode `eval()`" as not supported. The page also still lists `async/await`, `let/const` and classes as "in progress", which contradicts RN 0.86 reality (modern syntax is compiled by Babel/Hermes parser); the page is treated as stale for syntax. | Gives the only vendor statement found on `eval`; `new Function` on Hermes is **not confirmed** by any source read. | PAGE + curl raw (cross-checked against the raw file: lines 6, 22, 26, 32-42, 48) | https://github.com/facebook/hermes/blob/main/doc/Features.md (fetched 2026-10-04) |
| F9-18 | oRPC's own requirements page states: oRPC always needs `ReadableStream`; "React Native ... runs JavaScript in Hermes, which does not provide the browser APIs above"; Web Streams missing; "React Native 0.78 is the floor" (class static initialization blocks); no `crypto` global on native at any Expo SDK; RN `Blob` lacks `arrayBuffer()`, `text()`, `stream()`. The Expo adapter page adds: RN's built-in fetch "is an `XMLHttpRequest` polyfill with no `response.body`"; from SDK 56 `expo/fetch` replaces the global fetch. **Docs-version caveat**: orpc.dev serves several doc lines (v1.orpc.dev, v2.orpc.dev were seen in search output); npm `latest` is 1.15.4 and `beta` is 2.0.0-beta.41; which line these pages describe is **not confirmed**. | The only candidate whose vendor documents Hermes behaviour in detail; the globals it names are the ones other candidates' stream paths touch. | PAGE (two pages, consistent with each other) + NPM dist-tags | https://orpc.dev/docs/requirements , https://orpc.dev/docs/adapters/expo (both fetched 2026-10-04); search listing for Q13 |

---

## OpenAPI-first versus Code-first: General Evidence

| ID | Found | Why it matters | Verified by | Source |
|---|---|---|---|---|
| F9-20 | Swagger (vendor of the spec tooling) defines **design-first** as "creating a detailed API definition before writing any code" and **code-first** as "writing code first and then documenting it after the fact". Listed pros of design-first: code generation in multiple languages, consistency, more reliable tests. Listed pros of code-first: shorter time to market, suits rapid prototyping, small teams. Con of code-first: harder for non-developers to understand the API. Page title "Code-First vs. Design-First: Eliminate Friction with API Exploration", dated 2023-04-24 as shown by the fetch summary. | Vendor-side framing of the two approaches. | PAGE (single source) | https://swagger.io/blog/code-first-vs-design-first-api/ (fetched 2026-10-04) |
| F9-21 | Author argues the binary is a continuum "centered on the prominence of the API description document"; names "Coded API Description and API Framework" as hybrid middle approaches; observes that with implementation-first "the API description will get out-of-sync with the implementation". Dated 2021-06-08 as shown by the fetch summary. | Source for the hybrid class (code produces the description) and for the drift risk; the existing repo approach (F9-01 to F9-04) is of that hybrid class. | PAGE (single source) | https://sookocheff.com/post/api/the-false-dichotomoy-of-design-first-and-code-first-api-development/ (fetched 2026-10-04) |
| F9-22 | Article (dated 2025-12-16 as shown) frames the question as keeping "the contract, runtime behavior, and client expectations aligned"; drift prevention listed: contract checks in CI so "mismatches fail fast", "fail the build if the spec breaks backward compatibility", tests or middleware that validate requests and responses against the schema, one authoritative artefact, pinned client versions. States generated clients pay off "when more than one team (or app) consumes the same API". | Concrete list of drift controls that map to the tool classes in the "Drift and Conformance" section. | PAGE (single source, commercial blog) | https://appmaster.io/blog/openapi-first-vs-code-first-api-development (fetched 2026-10-04) |
| F9-23 | Article (dated 2023-03-09 as shown) argues for "TypeScript first": write handlers and "the compiler will generate an OpenAPI specification"; says hand-written specs are "tedious" and that "the tooling to generate server stubs from OpenAPI specifications is not great". The author is the vendor of a TypeScript-first API product. | A TypeScript-ecosystem argument for code-first, from a party with a commercial interest. | PAGE (single source, vendor blog) | https://wundergraph.com/blog/never_write_openapi_specifications_again (fetched 2026-10-04) |
| F9-24 | Search results for the two monorepo queries (Q1, Q14) surfaced further articles (apiscout.dev "api first vs code first 2026", codercops "openapi first api development 2026", leapcell "Sharing Types and Validations with Zod Across a Monorepo") but **their pages were not fetched**; only the search tool's snippet was seen. The leapcell snippet says a shared workspace package of zod schemas lets the frontend and a Fastify backend "operate on the same understanding of data". | Existence of further sources; not usable as evidence beyond a snippet. | Search snippet only (not verified) | https://leapcell.io/blog/sharing-types-and-validations-with-zod-across-a-monorepo ; https://apiscout.dev/guides/api-first-vs-code-first-2026 ; https://blog.codercops.com/blog/openapi-first-api-development-2026 (listed by search on 2026-10-04, not fetched) |
| F9-25 | `fastify-openapi-glue` describes itself as a Fastify plugin for "design first" development: "you write or obtain an API specification and use that to generate code"; it takes an OpenAPI v2/v3 file (JSON or YAML) and configures routes and validation schemas from it; `serviceHandlers` or `operationResolver` supply the handlers. | The server-side counterpart of OpenAPI-first on Fastify: the spec drives route registration. | C10 raw README (read in full by grep) | https://github.com/seriousme/fastify-openapi-glue (README read 2026-10-04) |

---

## Approach A: OpenAPI-first (specification is the input, code is generated or driven from it)

Candidates (6 groups). "Hermes suitability" is the runtime-API evidence for the part that ships to the device; build-time tools are marked n/a with the reason.

| # | Candidate (role) | Version | Licence | npm `time.modified` | Hermes suitability (evidence, static reading only) | Key facts | Source (fetched 2026-10-04) |
|---|---|---|---|---|---|---|---|
| A1 | **openapi-typescript** (spec to `.d.ts` types; build-time CLI) | 7.13.0 (`latest`) | MIT | 2026-06-15 | n/a at runtime: output is "runtime-free types" (.d.ts). The CLI runs in Node at build time | OpenAPI 3.0 and 3.1; Node 20+ recommended; **`--check` flag: "Check that the generated types are up-to-date"**; `--root-types`, `--immutable`, Redocly config for several schemas. **Peer `typescript: ^5.x` while the repo uses TypeScript 6.0.3**; open issue #2723 "Add support for TypeScript 6" (opened 2026-03-27 per fetch summary) | NPM ; https://openapi-ts.dev/introduction ; https://openapi-ts.dev/cli ; https://github.com/openapi-ts/openapi-typescript/issues?q=is%3Aissue+typescript+6 |
| A1b | **openapi-fetch** (typed fetch client over A1 types) | 0.17.0 | MIT | 2026-06-15 | Runtime source (`dist/index.mjs`, 17,235 bytes) has **no `node:` import or `require`**; uses `globalThis.Request`, `globalThis.fetch`, `Headers`, `URLSearchParams`; one Node probe (`process.versions.undici`) is guarded by `typeof process === "object"`; `fetch` and `Request` can be injected (`createClient({ fetch, Request })`); JSON read via `response.text()` when no `Content-Length`, else `response[parseAs]()`; `parseAs: "stream"` returns `response.body`. Open issue #2554 "Multipart Upload Throws Error on Expo RN App" (openapi-fetch 0.15.0, Expo 54, Android, state open). On-device run not performed | 6 kb min, "virtually zero runtime"; middleware; one dependency `openapi-typescript-helpers ^0.1.0`; no peer dependencies | NPM ; SRC (C1) ; https://openapi-ts.dev/openapi-fetch/ ; https://github.com/openapi-ts/openapi-typescript/issues/2554 |
| A1c | **openapi-react-query** (TanStack Query hooks over A1b) | 0.5.4 | MIT | 2026-02-11 | n/a beyond A1b: "tiny wrapper (1 kb) around @tanstack/react-query"; React Native not mentioned on its page | Peers `@tanstack/react-query ^5.80.0` (repo has 5.104.0) and `openapi-fetch ^0.17.0`; `useQuery`, `useSuspenseQuery`, `useInfiniteQuery`, `queryOptions` | NPM ; https://openapi-ts.dev/openapi-react-query/ |
| A2 | **@hey-api/openapi-ts** (spec to SDK, types, Zod schemas, TanStack Query options; build-time CLI) | 0.99.0 (`latest`; dist-tag `next` also exists) | MIT | 2026-09-30 | The **fetch client is bundled** as TypeScript source (`dist/clients/fetch/*.ts`): no `node:` import found; `globalThis.fetch` default with a `fetch` option to replace it; builds `new Request(url, init)` then `_fetch(request)`; JSON is read with `response.text()` + `JSON.parse` (not `response.json()`); `response.body` only for `parseAs: 'stream'` and an empty-body stream branch; the SSE helper uses `TextDecoderStream` (only on the SSE path). Closed issues #1665 "Body not being serialized correctly into form-url-encoded data [React-Native]" (2025-02-05) and #1563 "[React Native] Photo object passed into form data is being stringified by `formDataBodySerializer`" (2025-01-15). On-device run not performed | `engines.node >=22.18.0` (generator only); peer `typescript >=5.5.3 \|\| >=6.0.0 \|\| 6.0.1-rc` (names TS 6); package is **0.x**: docs say "pin an exact version" and publish migration notes for every breaking release; plugin pages for **Zod v4**, **Zod Mini**, **TanStack Query v5** (React, Vue, Solid, Svelte, Angular, Preact); validators page lists Zod and Valibot as natively supported and ArkType, Ajv, Joi, TypeBox, Yup marked "Vote"; `validator: true` on the SDK plugin enables request/response validation; **conflict**: the `@hey-api/client-fetch` 0.13.1 package is npm-deprecated ("bundled directly inside @hey-api/openapi-ts" since v0.73.0) while one docs page still says to install it separately | NPM ; SRC (C2) ; https://heyapi.dev/openapi-ts/get-started ; https://heyapi.dev/docs/openapi/typescript/plugins/zod/v4 ; https://heyapi.dev/openapi-ts/plugins/tanstack-query ; https://heyapi.dev/docs/openapi/typescript/validators ; https://heyapi.dev/docs/openapi/typescript/clients/fetch ; https://github.com/hey-api/openapi-ts/issues?q=is%3Aissue+react+native |
| A3 | **Orval** (spec to typed clients: fetch, axios, react-query, SWR, zod, MSW mocks; build-time CLI) | 8.39.0 | MIT | 2026-09-30 | Generated fetch code is plain `fetch`, `URLSearchParams` for query strings, `res.text()` then `JSON.parse` (template strings in `@orval/fetch@8.39.0` `dist/index.mjs`); docs: "native browser API requiring no additional dependencies"; custom fetch through a `mutator`. React Native is **not mentioned** on the pages read. On-device run not performed | `engines.node >=22.18.0`; peers `typedoc`, `prettier`, `typedoc-plugin-markdown` all marked optional; Zod output baseline is Zod 4, Zod 3 supported (`version: 4 \| 3 \| 'auto'`), `variant: 'mini'` for tree-shaking; React Query variant depends on `@tanstack/react-query` | NPM ; SRC (C3) ; https://orval.dev/ ; https://orval.dev/docs/guides/fetch ; https://orval.dev/docs/guides/zod |
| A4 | **Kubb** (plugin pipeline: `plugin-ts`, `plugin-client`, `plugin-fetch`, `plugin-zod`, `plugin-react-query`; build-time CLI) | `@kubb/core` 5.4.3; `plugin-client` 5.5.2; `plugin-fetch` 5.5.2; `plugin-ts` 5.0.2; `plugin-zod` 5.4.1; `plugin-react-query` 5.1.3 | MIT (all) | 2026-10-01 to 2026-10-02 | `plugin-client` "does not choose a transport ... generated code has no Fetch, Axios, or Kubb dependency". The **fetch template** (`@kubb/plugin-fetch@5.5.2` `templates/fetch.ts`) sends `globalThis.fetch(new Request(...))`, reads JSON with `response.text()` + `JSON.parse`, but its `parseResponse` returns `undefined` early when **`!response.body`** (line 784), and its SSE helpers use `ReadableStream`, `getReader`, `TextDecoder` (lines 852-906). Per F9-12 the whatwg-fetch `Response` has no `body`; per F9-14/F9-15 the SDK 57 default `fetch` does. React Native is **not mentioned** on the Kubb pages read. On-device run not performed | `@kubb/core` `engines.node >=22`; `plugin-zod` peers `zod ^4.0.0`, `kubb ^5.4.0`; `plugin-react-query` peer `@tanstack/react-query ^5.0.0`; docs header "Kubb v5.4.1" | NPM ; SRC (C4) ; https://kubb.dev/ ; https://kubb.dev/plugins/plugin-client |
| A5 | **oazapfts** (spec to a single-file TypeScript client; build-time CLI) plus **@oazapfts/runtime** | 7.5.0; runtime 1.2.0 | MIT (npm; the GitHub API reports licence `null` for the repo) | 2026-03-20; 2026-02-13 | Runtime source has **no `node:` import**; uses global `Headers`, `FormData` (with an injectable constructor), `.text()` and `.blob()`; a custom `fetch` can be passed in request options. React Native or Hermes is **not mentioned** by the README. On-device run not performed | Since 6.0.0 the runtime is a separate package; generated "functions and types are co-located in one single self-contained file"; peer `@oazapfts/runtime ^1.2.0`; maintenance: repo not archived, last push 2026-08-04 | NPM ; SRC (C5) ; API (C12) ; https://github.com/oazapfts/oazapfts |
| A6 | **fastify-openapi-glue** (server side: OpenAPI file drives Fastify routes and validation schemas) | 4.11.5 | MIT | 2026-09-18 | n/a: runs in the server process; ships nothing to a device | "design first"; OpenAPI v2/v3 JSON or YAML; `serviceHandlers`, `securityHandlers`, `operationResolver`; `x-` extension handling; also a project generator CLI. **Fastify 5 compatibility and OpenAPI 3.1 support were not stated in the README text read: not confirmed** | NPM ; C10 raw README ; https://github.com/seriousme/fastify-openapi-glue |

Seen but not evaluated beyond metadata: `@openapitools/openapi-generator-cli` (npm lookup failed in the first, cache-broken run and was not repeated; no facts collected), `openapi-zod-client` 1.18.3 (ISC, npm modified 2026-06-15; no README read; zod version support **not confirmed**).

---

## Approach B: Code-first (code or schemas are the input, the OpenAPI document is generated)

| # | Candidate (role) | Version | Licence | npm `time.modified` | Hermes suitability (evidence) | Key facts | Source (fetched 2026-10-04) |
|---|---|---|---|---|---|---|---|
| B1 | **zod 4 native JSON Schema** (`z.toJSONSchema`; the approach the repo uses today) | zod 4.6.5 (installed and npm `latest`) | MIT | 2026-10-02 | Ships to the device as the validator anyway (see "Runtime Validation"); `toJSONSchema` itself is a build-time use here | Targets `draft-2020-12` (default), `draft-07`, `draft-04`, `openapi-3.0`; `io: "input"` vs output; `unrepresentable: "throw" \| "any"` (types such as `date`, `bigint`, `transform`, `custom` cannot be represented); registries with an `id` give `$ref`; `uri` option maps ids to URIs. `z.fromJSONSchema()` is documented as "experimental ... not considered part of Zod's stable API" although it is exported in 4.6.5. It emits **schemas only**, not paths, parameters or responses | NPM ; LOCAL `node_modules/zod/v4/classic/external.js:8-9` ; https://zod.dev/json-schema |
| B2 | **@asteasolutions/zod-to-openapi** (zod schemas plus `registerPath` to a full OpenAPI document) | 9.1.0 | MIT | 2026-07-19 | n/a: build-time/server-side generator; depends on `openapi3-ts ^4.6.0` | Peer `zod ^4.0.0`; Zod 3 line is v7.3.4 ("we do not intend to actively support that version"); `OpenAPIRegistry`, `registerPath` (request body, params, query, headers, responses), generators `OpenApiGeneratorV3`, `V31`, `V32`; since v8 reads zod `.meta` | NPM ; C9 raw README ; https://github.com/asteasolutions/zod-to-openapi |
| B3 | **zod-openapi** (samchungy; `createDocument` from zod schemas and path objects) plus **fastify-zod-openapi** (Fastify plugin) | zod-openapi 6.0.2; fastify-zod-openapi 5.7.0 | MIT (both) | 2026-08-31; 2026-07-20 | n/a: build-time/server-side | zod-openapi peer `zod ^4.0.0`; README "Supported OpenAPI Versions": `3.1.0` (minimum) and `3.1.1`; uses zod `.meta()`; `fastify-zod-openapi` peers `@fastify/swagger ^9.0.0`, `@fastify/swagger-ui ^5.0.1 \|\| ^6.0.0`, `fastify 5`, `zod ^3.25.74 \|\| ^4.0.0` and "includes type provider, Zod schema validation, Zod schema serialization and Swagger UI support" | NPM ; C8 raw README ; https://github.com/samchungy/zod-openapi |
| B4 | **fastify-type-provider-zod** plus **@fastify/swagger** (+ **@fastify/swagger-ui**) (Fastify routes carry zod schemas; the plugin emits OpenAPI) | fastify-type-provider-zod 7.0.0; @fastify/swagger 9.9.1; @fastify/swagger-ui 6.1.1 | MIT (all three) | 2026-06-24; 2026-09-30; 2026-09-04 | n/a: server-side | Provider peers `fastify ^5.5.0`, `zod >=4.1.5`, `@fastify/swagger >=9.5.1`, `openapi-types ^12.1.3`; README: needs "zod v4.2+" for `>=7.x`, uses `.encode()`/`.decode()` from Zod 4.2, response serialisation "based on `z.output<T>`"; exports `validatorCompiler`, `serializerCompiler`, `jsonSchemaTransform`; `@fastify/swagger` v9.x targets Fastify ^5, emits Swagger 2, OpenAPI 3.0.x, 3.1.x and 3.2.0, has a dynamic mode (from route schemas) and a static mode (serve an existing document), `transform` hook, document export as JSON or YAML | NPM ; https://github.com/turkerdev/fastify-type-provider-zod ; https://github.com/fastify/fastify-swagger |
| B5 | **oRPC** (contract-first TypeScript RPC; OpenAPI is generated from the contract or router; not "OpenAPI-first") | `@orpc/contract`, `@orpc/openapi`, `@orpc/client`, `@orpc/server` 1.15.4 (`latest`); `2.0.0-beta.41` on `beta` | MIT | 2026-10-01 | **Documented by the vendor** (F9-18): needs `ReadableStream`, Hermes lacks Web Streams, RN floor 0.78, no `crypto` global; on Expo SDK 56+ `expo/fetch` is global. Source of the 1.15.4 fetch adapter (`@orpc/standard-server-fetch` `dist/index.mjs`) references `ReadableStream` (e.g. line 196 `body instanceof ReadableStream` in `toFetchBody`), `TextDecoderStream`, `TextEncoderStream`, `Blob`, `FormData`. On-device run not performed | `OpenAPIGenerator` "turns a contract or a router into an OpenAPI document", default version 3.2.0 (3.0.x, 3.1.x, 3.2.x selectable), converters for Zod, Valibot, ArkType; `OpenAPILink` plus `createORPCClient` give a typed fetch client; `@orpc/zod` peer `zod >=3.25.0`; `@orpc/tanstack-query` peer `@tanstack/query-core >=5.80.2`; `@orpc/server` peers `ws >=8.18.1`, `crossws >=0.3.4`; Hey API also lists an "oRPC v2 Plugin" page (title seen in search only) | NPM ; SRC (C6) ; https://orpc.dev/docs/openapi/openapi-specification ; https://orpc.dev/docs/openapi/client/openapi-link ; https://orpc.dev/docs/requirements ; https://orpc.dev/docs/adapters/expo |
| B6 | **ts-rest** (contract-first TypeScript; optional OpenAPI generator) | `@ts-rest/core`, `@ts-rest/open-api`, `@ts-rest/react-query` 3.52.1 (`latest`, published 2025-03-04); `3.53.0-rc.1` (2025-06-02) on `rc` | MIT | 2025-06-02 (equals the publish time of `3.53.0-rc.1`, the most recent publish; `latest` 3.52.1 dates 2025-03-04) | No React Native statement found on the page read; the client's transport is not stated on the page read (README says "no code generation", "RPC-like client"). On-device run not performed | **Stable line peers `zod ^3.22.3`** (`@ts-rest/react-query` also `react ^16.8 \|\| ^17 \|\| ^18`); the 3.53.0 pre-releases add "Standard Schema" support for Zod 4, Valibot, ArkType; open Zod 4 issues seen: #872, #852, #838, #813; closed: #840, #793. GitHub repo not archived, last push 2026-02-06. The year shown by the fetch summary for the releases (2024) disagrees with the npm times (2025); npm is used | NPM (`dist-tags`, `time`) ; API (C12) ; https://github.com/ts-rest/ts-rest ; https://github.com/ts-rest/ts-rest/releases ; https://github.com/ts-rest/ts-rest/issues?q=is%3Aissue+zod+4 |
| B7 | **TypeBox route** (not zod): `@fastify/type-provider-typebox` | 6.1.0 | MIT | 2026-08-12 | n/a: server-side | Peer `typebox ^1.0.13`. Metadata only; no README read. Interoperability with the repo's zod schemas **not confirmed** | NPM |

Seen but not evaluated beyond metadata: `@zodios/core` 10.9.6 (MIT, npm modified 2023-08-22, peers `zod ^3.x` and `axios`).

---

## Typed Clients Usable in a Browser and in React Native 0.86 on Hermes

Cross-view of the client-side runtime of every candidate that ships code to the device. Only static reading was possible; none was run on Hermes.

| Client | Transport | Node built-ins in the runtime part | Web APIs it touches beyond `fetch`/`Request`/`Headers`/`URLSearchParams` | Reads JSON through | Uses `response.body` | Source |
|---|---|---|---|---|---|---|
| openapi-fetch 0.17.0 | `globalThis.fetch`, replaceable | none found (`node:`/`require` absent; one guarded `process` probe) | none found | `text()` + `JSON.parse` (no `Content-Length`) or `response.json()` | only for `parseAs: "stream"` | SRC C1 |
| Hey API fetch client (bundled in openapi-ts 0.99.0) | `globalThis.fetch`, replaceable; interceptors | none found | `FormData` (for `formData` parse), `TextDecoderStream` on the SSE path | `text()` + `JSON.parse` | for `parseAs: 'stream'` and empty-body stream | SRC C2 |
| Orval 8.39.0 generated fetch functions | `fetch`, replaceable via `mutator` | none found in the template | none beyond `URLSearchParams` | `text()` + `JSON.parse` | not in the default JSON path (found in no template line read) | SRC C3 |
| Kubb `plugin-fetch` 5.5.2 template | `globalThis.fetch(new Request(...))`, replaceable | none found (`import` lines are relative) | `ReadableStream`, `TextDecoder` on stream/SSE helpers | `text()` + `JSON.parse` | **yes, as a gate: `!response.body` returns no data** (line 784) | SRC C4 |
| oazapfts runtime 1.2.0 | `fetch`, passed or global | none found | `FormData`, `Headers`, `Blob` (via `.blob()`) | `text()` | not found | SRC C5 |
| oRPC client 1.15.4 (`@orpc/client` + `standard-server-fetch`) | `fetch` adapter (`OpenAPILink` or RPC link) | none found in the adapter file | `ReadableStream`, `TextDecoderStream`, `TextEncoderStream`, `Blob`, `FormData`, `File` | `text()` + `parseEmptyableJSON` | for event streams; `toFetchBody` tests `body instanceof ReadableStream` on every request build | SRC C6 ; https://orpc.dev/docs/requirements |
| ts-rest client | fetch-based per README | not examined | not examined | not examined | not examined | https://github.com/ts-rest/ts-rest (PAGE only) |

What the runtime facts add (F9-12, F9-14, F9-15): under the whatwg-fetch polyfill `response.body` is `undefined`; under the SDK 57 default `expo/fetch` it is a `ReadableStream`; `Request` objects built from the RN polyfill are accepted by `expo/fetch`. Whether each client works end to end on a device is **not confirmed** by this task.

---

## Runtime Validation with zod 4

| ID | Found | Why it matters | Verified by | Source |
|---|---|---|---|---|
| F9-60 | Installed zod is 4.6.5 (MIT). The object parser has a **JIT fast path** gated by `allowsEval`, which tries `new Function("")` inside `try/catch` and falls back to the interpreted path; the probe is skipped when `z.config({ jitless: true })` is set or when `navigator.userAgent` contains "Cloudflare". The `navigator` access is guarded by `typeof navigator !== "undefined"`. Zod ships `zod/mini` (`./mini`, `./v4-mini`) and `./locales` exports. | These are the places where a zod build touches engine features (`Function`, `navigator`); the guard and the `jitless` switch are in the installed version. Whether `new Function` works on Hermes V1 is **not confirmed**. | LOCAL | `node_modules/zod/v4/core/util.js:218-233` ; `node_modules/zod/v4/core/schemas.js:1166-1183` ; `node_modules/zod/package.json` (exports map entries `./mini`, `./v4-mini`, `./locales`) |
| F9-61 | zod GitHub issues touching React Native or Hermes (state as shown in the issue list, 2026-10-04): **#4690** "Zod v4 and React Native compatibility" (closed; report: error from `navigator.userAgent` read at `util.ts#L326`); **#4148** "v4: Error - 'Cannot call a class as a function' in React Native." (closed; linked PR #4482; reporter suspected Metro bundling of `$constructor`); **#5070** "[V4] Invalid element at key ... expected a Zod schema | Hermes JS engine" (closed 2025-08-09; reporter on RN 0.74.5 / Expo SDK 51 suspected `instanceof` behaviour on Hermes; **no resolution visible in the excerpt**); **#2269** "v3.21.0 Incompatible with React Native environment" (closed). For #4690 the fetch summary could not show the fix; the installed 4.6.5 source does guard `navigator` (F9-60). | Prior RN/Hermes incidents with zod 4; two of the three are reported against the first zod 4 releases and an older RN/Expo pair. Current-release behaviour on RN 0.86 is **not confirmed** by a run. | PAGE (4 fetches, partial excerpts) + LOCAL cross-check for #4690 | https://github.com/colinhacks/zod/issues?q=is%3Aissue+hermes ; .../issues/5070 ; .../issues/4690 ; .../issues/4148 (all fetched 2026-10-04) |
| F9-62 | The repo already runs zod 4.6.5 in the mobile app (`apps/mobile/package.json:72`) and its shared simulator code is tested to import nothing from `node:`, `react-native` or `expo`; `packages/shared` imports zod in the contract (`z.toJSONSchema` use is build/test-time). | Shows zod is already on the phone's dependency list today. This task did not check whether the mobile bundle imports `@dems/shared/api` at runtime. | LOCAL | `apps/mobile/package.json:72` ; `packages/shared/src/api/core-api.ts:23` ; `packages/shared/test/sim-platform-neutral.test.ts:215-220` (cited by `identification/02_structured.md` F-A5, not re-read here) |
| F9-63 | Generators that **emit zod 4 validators** from an OpenAPI document: Hey API Zod v4 plugin (schemas for "every request layer of each endpoint", a response union, every reusable definition; enable with `validator`/`transformer: true` on the SDK plugin; also a Zod Mini variant); Orval (`version: 4`, `variant: 'mini'`); Kubb `plugin-zod` (peer `zod ^4.0.0`; `plugin-client` stops with an error if `plugin-zod` is missing when validation is requested). | Shows which OpenAPI-first generators close the loop to runtime validation with zod 4. | PAGE + NPM | https://heyapi.dev/docs/openapi/typescript/plugins/zod/v4 ; https://orval.dev/docs/guides/zod ; https://kubb.dev/plugins/plugin-client (all fetched 2026-10-04) ; NPM `@kubb/plugin-zod` |
| F9-64 | Code-first side with zod 4: `fastify-type-provider-zod` 7.0.0 validates requests with `validatorCompiler` and **serialises responses through the response schema** (`serializerCompiler`, `z.output`), so a handler returning a wrong shape fails at serialisation; `fastify-zod-openapi` 5.7.0 advertises the same pair. | The server-side runtime check that backs a generated or hand-written contract. | PAGE (README) | https://github.com/turkerdev/fastify-type-provider-zod ; https://github.com/samchungy/zod-openapi (ecosystem section, C8) |
| F9-65 | Other validators appear in the generators' lists (Valibot, ArkType, Ajv, Joi, TypeBox, Yup for Hey API; Zod, Valibot, ArkType converters for oRPC). Ajv 8.20.0 (MIT, npm modified 2026-04-24) appears only as metadata. Their behaviour on Hermes was **not examined**. | Completeness of the validator landscape; not pursued because zod 4 is in use. | PAGE + NPM | https://heyapi.dev/docs/openapi/typescript/validators ; https://orpc.dev/docs/openapi/openapi-specification |

---

## Drift and Conformance Test Tools

Classes: (1) document validity, (2) generated-artefact freshness, (3) breaking-change diff between two documents, (4) lint rules on the document, (5) black-box conformance of a running server against the document, (6) response validation inside tests, (7) consumer-driven contracts.

| # | Tool (class) | Version | Licence | Last activity | Runs as | Hermes suitability | Key facts | Source (fetched 2026-10-04) |
|---|---|---|---|---|---|---|---|---|
| D1 | **@scalar/openapi-parser** (1, validity and `$ref` resolution) | 0.29.10 (repo pins 0.29.9) | MIT | npm 2026-10-02 | Node library, **already used** by `openapi.test.ts` | n/a (test-time) | `validate()` and `dereference()`; result carries `valid`, `errors`, `version` ('3.1') | NPM ; LOCAL `packages/shared/test/openapi.test.ts:6, 81-97` |
| D2 | **openapi-typescript `--check`** (2, freshness of generated types) | 7.13.0 | MIT | npm 2026-06-15 | Node CLI | n/a (build-time) | "Check that the generated types are up-to-date" without overwriting | https://openapi-ts.dev/cli |
| D3 | **Generator-output equals committed file** (2; pattern in use) | n/a | n/a | n/a | Vitest + the repo's own script | n/a | Current repo practice: `--check` flag plus a byte-equality test (F9-03, F9-04) | LOCAL |
| D4 | **oasdiff** (3, breaking-change detection between two OpenAPI files) | v1.33.0 (GitHub release 2026-10-01) | Apache-2.0 | repo push 2026-10-03, not archived | **Go binary** (Homebrew, `go install`, Docker, binary download); **not an npm package** | n/a (CI-time) | Commands `breaking`, `changelog`, `diff`; site claims "755 distinct changes"; OpenAPI 3.0, 3.1, 3.2; a paid Pro tier exists next to the free CLI | API (C12) ; https://www.oasdiff.com/ ; search Q9 snippet |
| D5 | **Spectral CLI** (4, lint) | 6.17.0 | Apache-2.0 | npm 2026-10-01; repo push 2026-10-02 | Node CLI (npm, yarn or Docker) | n/a | OpenAPI v3.1, v3.0, v2.0, Arazzo v1.0, AsyncAPI v2.x; rulesets such as `spectral:oas`; custom rules | NPM ; API ; https://github.com/stoplightio/spectral |
| D6 | **Redocly CLI** (4, lint) | 2.57.0 | MIT | npm 2026-09-30; repo push 2026-10-03 | Node CLI | n/a | `redocly lint`; rulesets `spec`, `minimal`, `recommended`, `recommended-strict`; output formats include `junit`, `github-actions`, `json`; **supported OpenAPI versions and exit codes not stated on the page read: not confirmed** | NPM ; API ; https://redocly.com/docs/cli/commands/lint |
| D7 | **Schemathesis** (5, property-based black-box conformance against a running server) | 4.29.0 (PyPI upload 2026-10-01) | MIT | repo push 2026-10-03 | **Python** CLI/library (`requires_python >=3.10`), pytest and GitHub Actions integration | n/a (CI-time) | "automatically generates property-based tests from your OpenAPI or GraphQL schema"; OpenAPI 2.0, 3.0, 3.1, 3.2; needs a reachable server or an in-process app; **the fetched page did not detail which response checks run: not confirmed from that page** (the search snippet for older releases lists content-type, schema and status-code checks) | API (C11, C12) ; https://schemathesis.readthedocs.io/en/stable/ ; search Q8 snippet |
| D8 | **Prism** `@stoplight/prism-cli` (5, mock server and validation proxy) | 5.16.0 | Apache-2.0 | npm 2026-07-17; repo push 2026-10-01 | Node CLI (Node >=18.20.1) or Docker | n/a | `prism proxy` funnels traffic to "check for discrepencies between your API implementation and the OpenAPI document"; OpenAPI 3.1, 3.0, 2.0, Postman collections | NPM ; API ; https://github.com/stoplightio/prism |
| D9 | **Response validators for tests**: `openapi-response-validator` 12.1.3 (MIT, npm 2023-05-24); `jest-openapi` 0.14.2 (MIT, 2022-05-06); `chai-openapi-response-validator` 0.14.2 (MIT, 2022-04-12); `api-contract-validator` 2.2.8 (Apache-2.0, 2022-08-11) (6) | as listed | as listed | **stale by registry date (2022-2023)** | Node libraries; `jest-openapi` targets Jest, `chai-...` targets Chai; **Vitest 5 compatibility not confirmed**; `api-contract-validator` was listed by a search snippet as supporting `light-my-request` (Fastify's `inject`) and OpenAPI 3.0 only; its page was not fetched | n/a (test-time) | OpenAPI 3.1 support not confirmed for any of the four | NPM ; search Q15 snippet |
| D10 | **fastify-type-provider-zod `serializerCompiler`** (6, response conformance at serialisation inside the app) | 7.0.0 | MIT | npm 2026-06-24 | Fastify plugin | n/a (server) | See F9-64 | https://github.com/turkerdev/fastify-type-provider-zod |
| D11 | **Pact** `@pact-foundation/pact` (7, consumer-driven contract tests) | 17.1.4 | MIT per npm; GitHub licence API says `NOASSERTION` | npm 2026-09-07; repo push 2026-10-03 | Node library | n/a (test-time) | Described as "a code-first consumer-driven contract testing tool"; "contract by example" versus a schema that "describes all possible states of a resource"; the introduction page did not say whether a broker is mandatory or list JavaScript explicitly | NPM ; API ; https://docs.pact.io/ |
| D12 | **Dredd** (5, spec-driven API tests) | 14.1.0 | MIT | npm 2023-02-13; **GitHub repo `archived: true`**, last push 2024-05-11 | Node CLI | n/a | Included because it is a well-known name; archived | NPM ; API (C12) |
| D13 | **@apidevtools/swagger-parser** (1, parse, validate, dereference) | 13.1.0 | MIT | npm 2026-09-20 | Node library; peer `openapi-types >=7` | n/a | Metadata only; no page read | NPM |
| D14 | **@fastify/swagger static mode** (2, serve an existing document; or dynamic mode to export what the routes declare) | 9.9.1 | MIT | npm 2026-09-30 | Fastify plugin | n/a | Dynamic mode "auto-generates API schemas from route schemas"; static mode serves a document passed in `specification.path`; export function returns the document as JSON (or YAML) | https://github.com/fastify/fastify-swagger |

---

## Findings Register: Candidate Coverage Check against the Row-9 Verification

| Requirement (row 9) | Where it is met |
|---|---|
| At least 2 candidates per approach, each with version, licence, Hermes suitability and a URL with fetch date | Approach A: A1/A1b/A1c, A2, A3, A4, A5, A6 (6 groups). Approach B: B1, B2, B3, B4, B5, B6, B7 (7). Every row has version, licence, a Hermes-suitability cell and URLs; all URLs were fetched on 2026-10-04 |
| Query log contains no design-book term | "Query Log" section; strings Q1-Q15 reproduced exactly |
| Tier 2 narrative: found, why it matters, how verified, source | Findings tables F9-01 to F9-65 carry the four fields; candidate tables carry them as columns (Key facts, Verified-by code in Source, Source) |

---

## Conflicts and Discarded Results

| # | Item | Treatment |
|---|---|---|
| X1 | The GitHub release-page summary for RN `v0.86.0` stated a release date in 2024 and "Hermes V1 now standard". The date is impossible for this release line. | Whole summary discarded. Hermes engine facts come from the installed files (F9-10) and the 0.84 blog post. A search result (Q5) listed `v0.86.0` as released 2026-06-09; that is a snippet only and is not relied on |
| X2 | Hey API docs page `clients/fetch` says to add `@hey-api/client-fetch` as a plugin and install it separately; npm marks `@hey-api/client-fetch` 0.13.1 deprecated: "Starting with v0.73.0, this package is bundled directly inside @hey-api/openapi-ts"; the bundled client is present in `@hey-api/openapi-ts@0.99.0` under `dist/clients/fetch/`. | npm and the package contents are used; the docs page is recorded as out of step |
| X3 | The ts-rest releases page summary shows 2024 dates for 3.53.0 pre-releases; npm shows them in 2025-05 and 2025-06. | npm times used |
| X4 | Several Hey API and Kubb doc URLs moved: `heyapi.dev/openapi-ts/plugins/zod` and `/validators/zod` and `/docs/openapi/typescript/plugins/zod` returned 404; the Zod pages are at `/docs/openapi/typescript/plugins/zod/v4` and `/zod/mini`. `ts-rest.com/docs/open-api` 404. `orpc.dev/docs/adapters/react-native` 404 (the Expo page is `/docs/adapters/expo`) | Working URLs are the ones cited |
| X5 | zod issue pages: the fetch summaries for #4690 and #5070 did not show comments or resolutions even though the list marks them closed. | Reported as "closed per issue list; resolution not shown", never as "fixed" |
| X6 | GitHub REST API: unauthenticated rate limit was exhausted on the last call (hey-api and orpc repositories, renamed). | Their GitHub licence and push data were not obtained; licence from npm only (MIT) |

---

## Gaps / Needs More Data

1. **No candidate was run on Hermes or on a device.** Every Hermes cell is static reading or vendor documentation. A runtime check needs a build and an emulator (not part of this read-only row).
2. `new Function` and `eval` behaviour on Hermes V1 (relevant to zod's JIT probe): only the Hermes feature page was found ("Local mode eval()" unsupported); the Function constructor is **not confirmed**.
3. Which doc line orpc.dev describes (1.x or 2.0 beta) is not confirmed; the oRPC Hermes statements (F9-18) are tied to that page, not to a tested 1.15.4 build.
4. Fastify 5 and OpenAPI 3.1 support of `fastify-openapi-glue` was not stated in the README text read.
5. `zod-openapi` supported OpenAPI versions are listed as 3.1.0 and 3.1.1 by its README; whether a newer minor (3.2) is supported was not stated there.
6. TypeBox route (B7), `openapi-zod-client`, `@openapitools/openapi-generator-cli`, `@zodios/core`: metadata only or nothing.
7. Realtime (WebSocket) message contract tooling (for example AsyncAPI) was **not collected**: it is outside the four topics of row 9 (F9-06).
8. Redocly CLI: supported OpenAPI versions and exit codes not found. Schemathesis: response checks not confirmed from the fetched page.
9. Vitest 5 compatibility of the test-time response validators (D9) not confirmed; all four are stale by registry date.
10. Typed-client behaviour with `EXPO_PUBLIC_USE_RN_FETCH=1` (polyfill fetch) versus default (`expo/fetch`) is documented by sources but not exercised.
11. GitHub licence and activity data for `hey-api/openapi-ts` and the oRPC repository (rate limit, X6).
12. The sandbox note in `gen-openapi.ts:9-11` says the `tsx` CLI fails with `listen EPERM` here; whether the generator CLIs above (all Node CLIs) hit the same limit was not tested.

---

## Appendix A: npm lookup output (all read 2026-10-04 with `--cache <scratchpad>/npmcache`)

Format: `package | version | license | time.modified | peerDependencies`. "-" means the field was empty in the output.

| Package | version | license | time.modified | peerDependencies |
|---|---|---|---|---|
| openapi-typescript | 7.13.0 | MIT | 2026-06-15T07:56:25Z | `typescript ^5.x` |
| openapi-fetch | 0.17.0 | MIT | 2026-06-15T07:55:35Z | - (dependencies: `openapi-typescript-helpers ^0.1.0`) |
| openapi-react-query | 0.5.4 | MIT | 2026-02-11T16:02:21Z | `@tanstack/react-query ^5.80.0`, `openapi-fetch ^0.17.0` |
| @hey-api/openapi-ts | 0.99.0 | MIT | 2026-09-30T19:13:44Z | `typescript >=5.5.3 \|\| >=6.0.0 \|\| 6.0.1-rc` (engines node `>=22.18.0`; dist-tags latest 0.99.0, next 0.0.0-next-20260930190945) |
| @hey-api/client-fetch | 0.13.1 | MIT | 2025-06-14T08:55:11Z | `@hey-api/openapi-ts < 2`; **deprecated**: "Starting with v0.73.0, this package is bundled directly inside @hey-api/openapi-ts." |
| orval | 8.39.0 | MIT | 2026-09-30T20:27:44Z | `typedoc ^0.28.19`, `prettier >=3.0.0`, `typedoc-plugin-markdown ^4.10.0` (all optional); engines node `>=22.18.0` |
| @orval/fetch | 8.39.0 | MIT | - | - |
| @kubb/core | 5.4.3 | MIT | 2026-10-02T15:10:24Z | - (engines node `>=22`) |
| @kubb/plugin-ts | 5.0.2 | MIT | 2026-10-01T14:45:28Z | `kubb ^5.2.0` |
| @kubb/plugin-client | 5.5.2 | MIT | 2026-10-01T14:45:55Z | `kubb ^5.4.0` (dependencies `@kubb/plugin-ts ^5.0.2`, `@kubb/plugin-zod ^5.4.1`) |
| @kubb/plugin-fetch | 5.5.2 | MIT | 2026-10-01T14:45:33Z | `kubb ^5.3.19` |
| @kubb/plugin-zod | 5.4.1 | MIT | 2026-10-01T14:45:27Z | `zod ^4.0.0`, `kubb ^5.4.0` |
| @kubb/plugin-react-query | 5.1.3 | MIT | 2026-10-01T14:45:38Z | `kubb ^5.3.19`, `@tanstack/react-query ^5.0.0` |
| oazapfts | 7.5.0 | MIT | 2026-03-20T12:46:05Z | `@oazapfts/runtime ^1.2.0` |
| @oazapfts/runtime | 1.2.0 | MIT | 2026-02-13T22:42:50Z | - |
| fastify-openapi-glue | 4.11.5 | MIT | 2026-09-18T08:40:23Z | - |
| zod | 4.6.5 | MIT | 2026-10-02T16:52:44Z | - |
| @asteasolutions/zod-to-openapi | 9.1.0 | MIT | 2026-07-19T10:59:33Z | `zod ^4.0.0` (dependencies `openapi3-ts ^4.6.0`) |
| zod-openapi | 6.0.2 | MIT | 2026-08-31T08:09:00Z | `zod ^4.0.0` |
| fastify-zod-openapi | 5.7.0 | MIT | 2026-07-20T13:32:11Z | `@fastify/swagger ^9.0.0`, `@fastify/swagger-ui ^5.0.1 \|\| ^6.0.0`, `fastify 5`, `zod ^3.25.74 \|\| ^4.0.0` |
| fastify-type-provider-zod | 7.0.0 | MIT | 2026-06-24T00:27:25Z | `@fastify/swagger >=9.5.1`, `fastify ^5.5.0`, `openapi-types ^12.1.3`, `zod >=4.1.5` |
| @fastify/swagger | 9.9.1 | MIT | 2026-09-30T16:03:21Z | - |
| @fastify/swagger-ui | 6.1.1 | MIT | 2026-09-04T11:16:55Z | - |
| @fastify/type-provider-typebox | 6.1.0 | MIT | 2026-08-12T20:02:10Z | `typebox ^1.0.13` |
| @orpc/contract | 1.15.4 | MIT | 2026-10-01T14:24:47Z | - |
| @orpc/openapi | 1.15.4 | MIT | 2026-10-01T14:24:45Z | - |
| @orpc/client | 1.15.4 | MIT | 2026-10-01T14:21:20Z | - (dist-tags: latest 1.15.4, beta 2.0.0-beta.41, alpha 0.8.0-alpha.2, next 0.0.0-next.47dbd93) |
| @orpc/server | 1.15.4 | MIT | 2026-10-01T14:22:49Z | `ws >=8.18.1`, `crossws >=0.3.4` |
| @orpc/zod | 1.15.4 | MIT | 2026-10-01T14:27:31Z | `zod >=3.25.0`, `@orpc/server 1.15.4`, `@orpc/contract 1.15.4` |
| @orpc/tanstack-query | 1.15.4 | MIT | 2026-10-01T14:25:53Z | `@orpc/client 1.15.4`, `@tanstack/query-core >=5.80.2` |
| @orpc/standard-server-fetch | 1.15.4 | MIT | 2026-09-23T15:11:04Z | - |
| @orpc/openapi-client | 1.15.4 | MIT | 2026-09-23T15:10:24Z | - |
| @ts-rest/core | 3.52.1 | MIT | 2025-06-02T09:56:04Z | `zod ^3.22.3`, `@types/node ^18.18.7 \|\| >=20.8.4` (dist-tags: latest 3.52.1, rc 3.53.0-rc.1, alpha 3.53.0-alpha.3) |
| @ts-rest/open-api | 3.52.1 | MIT | 2025-06-02T09:56:04Z | `zod ^3.22.3`, `@ts-rest/core ~3.52.0` |
| @ts-rest/react-query | 3.52.1 | MIT | 2025-06-02T09:56:04Z | `zod ^3.22.3`, `react ^16.8.0 \|\| ^17 \|\| ^18`, `@ts-rest/core ~3.52.0`, `@tanstack/react-query ^4 \|\| ^5` |
| @zodios/core | 10.9.6 | MIT | 2023-08-22T00:35:54Z | `axios ^0.x \|\| ^1.0.0`, `zod ^3.x` |
| openapi-zod-client | 1.18.3 | ISC | 2026-06-15T07:55:46Z | - |
| @scalar/openapi-parser | 0.29.10 | MIT | 2026-10-02T04:46:15Z | - |
| @redocly/cli | 2.57.0 | MIT | 2026-09-30T12:47:59Z | - |
| @stoplight/spectral-cli | 6.17.0 | Apache-2.0 | 2026-10-01T12:40:18Z | - |
| @stoplight/prism-cli | 5.16.0 | Apache-2.0 | 2026-07-17T08:02:36Z | - |
| openapi-response-validator | 12.1.3 | MIT | 2023-05-24T22:26:40Z | - |
| jest-openapi | 0.14.2 | MIT | 2022-05-06T12:36:40Z | - |
| chai-openapi-response-validator | 0.14.2 | MIT | 2022-04-12T05:51:51Z | - |
| api-contract-validator | 2.2.8 | Apache-2.0 | 2022-08-11T13:03:32Z | - |
| @pact-foundation/pact | 17.1.4 | MIT | 2026-09-07T07:08:49Z | - |
| dredd | 14.1.0 | MIT | 2023-02-13T07:51:35Z | - |
| @apidevtools/swagger-parser | 13.1.0 | MIT | 2026-09-20T19:30:54Z | `openapi-types >=7` |
| ajv | 8.20.0 | MIT | 2026-04-24T15:22:16Z | - |

PyPI (API): `schemathesis` 4.29.0, MIT, `requires_python >=3.10`, uploaded 2026-10-01T23:22:38Z.
GitHub API (licence, archived, last push): oasdiff/oasdiff Apache-2.0, false, 2026-10-03; schemathesis/schemathesis MIT, false, 2026-10-03; stoplightio/prism Apache-2.0, false, 2026-10-01; Redocly/redocly-cli MIT, false, 2026-10-03; stoplightio/spectral Apache-2.0, false, 2026-10-02; pact-foundation/pact-js NOASSERTION, false, 2026-10-03; apiaryio/dredd MIT, **true**, 2024-05-11; openapi-ts/openapi-typescript MIT, false, 2026-09-25; orval-labs/orval MIT, false, 2026-10-03; kubb-labs/kubb MIT, false, 2026-10-03; colinhacks/zod MIT, false, 2026-10-02; asteasolutions/zod-to-openapi MIT, false, 2026-10-02; samchungy/zod-openapi MIT, false, 2026-08-31; turkerdev/fastify-type-provider-zod MIT, false, 2026-10-01; ts-rest/ts-rest MIT, false, 2026-02-06; oazapfts/oazapfts licence `null`, false, 2026-08-04; oasdiff latest release v1.33.0 published 2026-10-01T16:27:59Z.

---
*Generated: 2026-10-04 01:54*
*Last Updated: 2026-10-04 01:54*
