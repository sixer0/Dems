---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: 9
agent: data-collector
status: complete
date: 2026-10-04
last_updated: 2026-10-04 02:03
---

# data-collector, step 9 (contract tooling): progress file

## Status

complete

## Files created or updated

| File | Action |
|---|---|
| `docs/2026-10-04_dems_backend_rbac_pairing/research/02d_collection_contract_tooling.md` | created (Tier 2 collection, ~66 KB) |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/data_collector_step_9.md` | created (this file) |

Nothing else was written. `delegation_progress_report.md` and `status_tasks.md` were not touched (parallel run). Scratch files (npm cache, CDN downloads, two small patch scripts) live only under the session scratchpad and `$TMPDIR`.

## Milestones

1. Read `identification/02_structured.md` (row 9) and the current contract code: `packages/shared/src/api/{core-api,openapi,realtime-messages}.ts`, `scripts/gen-openapi.ts`, `test/openapi.test.ts`.
2. 15 generic web searches, 62 page fetches, 12 CDN/registry/API read groups, npm registry lookups for 49 packages (Appendix A) plus dist-tags, engines and dependency lookups. Exact strings and URLs are in the collection's "Query Log".
3. Collected candidates: OpenAPI-first 6 groups (A1 to A6), code-first 7 (B1 to B7), drift and conformance 14 (D1 to D14), plus 29 numbered findings (F9-01 to F9-65 with gaps in numbering by section) and a client-runtime cross-view.
4. Hermes and Expo runtime facts verified against files installed on this host (RN 0.86.3, expo 57.0.26, whatwg-fetch 3.6.20, zod 4.6.5) in addition to web pages.
5. Corrections applied after self-review: a looser grep that also matched `bodyUsed` was re-run precisely; a grep for `EXPO_PUBLIC_USE_RN_FETCH` that had failed on a shell glob was re-run correctly; the host-file list was moved out of the Query Log section so that section holds queries only.

## Self-check against the row-9 verification

| Check | Result |
|---|---|
| At least 2 candidates per approach, each with version, licence, Hermes suitability, URL with fetch date | Met: A has 6 groups, B has 7; every row has all four; all URLs fetched 2026-10-04 |
| Query log has no design-book term | Met: scan of the final "Query Log" section returned 0 hits |
| Tier 2 narrative (found, why it matters, how verified, source) | Met: findings tables carry the four fields; candidate tables carry them as columns |
| Fabrication guard | Every version and licence comes from `npm view`, PyPI or GitHub API output. Unconfirmed facts are written "not confirmed" (12 items in the collection's Gaps section) |

Term list used for the Query Log scan (kept here, not in the collection, so that section stays free of them): DEMS, evidence, custody, pairing, RBAC, operator, audit, biometric, tablet, mock-core, simulat*, interview, witness, recording, portal, Core API, enrol*, hash chain. Case-insensitive. 0 hits in the final Query Log section.

## Blockers

None blocking. Limits the controller should know:

1. **Nothing was executed on Hermes or a device.** Every Hermes-suitability cell is static source reading or vendor documentation. This matches the read-only rule (no installs, no processes) but means "suitable" is never "tested". Row 14 or a later spike must decide whether a runtime check is needed.
2. **npm cache**: the default `~/.npm/_cacache` is root-owned, so `npm view` failed with EPERM until `--cache <scratchpad>/npmcache` was used. Not a project change; worth a line in the Host Impact Register (the user's cache folder needs `sudo chown -R 501:20 ~/.npm` before any real `npm install` can use it, per npm's own message). This was not done and was not attempted.
3. **GitHub unauthenticated rate limit** was exhausted on the last API call; licence and activity for `hey-api/openapi-ts` and the oRPC repository came from npm only (MIT).
4. **WebFetch summaries come from a small model.** Where a summary conflicted with harder evidence it was discarded and logged (Conflicts X1 to X6 in the collection). One example: the RN v0.86.0 release-page summary gave an impossible date and was dropped.

## Findings the controller may want to pass to row 14 (facts only, no recommendation)

These are the evidence items most likely to affect a decision. They are collected facts, not conclusions.

1. **Expo SDK 57 changes the default `fetch` on the phone.** `node_modules/expo/src/winter/runtime.native.ts:41-53` installs `expo/fetch` as the global `fetch` unless `EXPO_PUBLIC_USE_RN_FETCH=1`; no opt-out exists in `apps/mobile`. Under the older polyfill `response.body` is undefined; under `expo/fetch` it is a `ReadableStream`. One candidate (Kubb `plugin-fetch` 5.5.2) returns no data when `response.body` is falsy (`templates/fetch.ts:784`).
2. **oRPC's own docs state that Hermes lacks Web Streams** and that oRPC always needs `ReadableStream`; which doc line (1.x or 2.0 beta) those pages describe is not confirmed.
3. **TypeScript 6.0.3 vs peer ranges**: `openapi-typescript` 7.13.0 declares `typescript ^5.x` (open issue "Add support for TypeScript 6"); `@hey-api/openapi-ts` 0.99.0 declares `>=5.5.3 || >=6.0.0`.
4. **zod 4 coverage**: `@ts-rest/*` stable line peers zod ^3; its Zod 4 support is only in `3.53.0-rc.1`; `zod-to-openapi` 9.1.0, `zod-openapi` 6.0.2, `fastify-type-provider-zod` 7.0.0, `@kubb/plugin-zod` 5.4.1 declare zod 4 peers.
5. **Hey API is 0.x** and says to pin an exact version; Orval, Kubb and Hey API CLIs need Node >= 22 (Orval and Hey API >= 22.18.0); host Node is 26.8.2.
6. **The repo's current contract path needs no OpenAPI library**: zod's own `z.toJSONSchema` plus hand-built document code, a `--check` flag and a byte-equality test already exist (`gen-openapi.ts:13`, `openapi.test.ts:136-140`). No typed REST client exists yet.
7. **Conformance tools that are not Node packages**: oasdiff (Go binary, v1.33.0) and Schemathesis (Python, 4.29.0). Installing either would need a host change, which row 9 does not authorise.
8. **Stale conformance libraries**: `jest-openapi`, `chai-openapi-response-validator`, `openapi-response-validator`, `api-contract-validator` have no registry activity since 2022-2023; Dredd's repository is archived.

## Decisions

No decisions were taken. No scope change. No confidentiality incident: all queries were generic technology strings (see Query Log).

## Documentation contract

- Output folder: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/`.
- Shared files (`delegation_progress_report.md`, `status_tasks.md`) untouched.
- Naming follows CLAUDE.md section 3 (snake_case, numeric prefixes).
