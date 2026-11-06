---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: data-collector
blueprint_row: 8
status: complete
date: 2026-10-04
---

# Progress: data-collector, row 8 (server runtime evidence)

## Status

complete. The Expected Output exists and is non-empty: `research/02c_collection_server_runtime.md` (764 lines, 73,546 bytes).

## Files created or updated

| Path | Action |
|---|---|
| `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/research/02c_collection_server_runtime.md` | created (Tier 2 collection) |
| `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/data_collector_step_8.md` | created (this file) |

No other repo file was written. Scratch downloads sit under `$TMPDIR` (`/tmp/claude-501/r8`, `/tmp/claude-501/npmc8`), outside the repo.

## Milestones

1. Read `identification/02_structured.md` row 8 and `apps/mock-core/package.json`.
2. `npm view` for 43 registry packages (one more, `uWebSockets.js`, is not on the registry); output recorded in the appendix of the collection.
3. Fetched upstream READMEs, plugin sources, CI workflows, Node release schedule, `ws` docs, uWebSockets.js tag files, Socket.IO docs, Colyseus docs, OWASP and RFC 6455 text, React Native WebSocket source.
4. Wrote the collection: query log, 3 plugin tables (44 rows), 44 numbered findings, 5 fan-out patterns, 8 upgrade-authentication findings, 14 gaps.

## Verification evidence (against the controller's three checks)

- Every T-A row (16) has version, licence, Fastify 5 evidence and a URL with the fetch date 2026-10-04 (table header carries the date; also stated in each Source line). T-B and T-C rows carry the same fields; where a fact could not be confirmed the cell says "not confirmed" (`fastify-socket.io` licence; Fastify 5 status of 7 packages in T-C).
- Fan-out patterns with sources: 4 patterns with primary sources (P-1 `ws` + application topic registry, P-2 uWebSockets.js topics, P-3 Socket.IO rooms + volatile, P-4 Colyseus 50 ms patch) and P-5 recorded as insufficient evidence.
- Query log: 6 web search strings listed verbatim in section 2.1 plus every npm command and fetched URL. A post-hoc grep of the query words against the task and predecessor documents is recorded in section 2.1.

## Blockers and anomalies for the controller to record

1. **npm cache EPERM.** `npm view` without options failed with `EPERM` on `~/.npm/_cacache/tmp` ("cache folder contains root-owned files"). Recovered with `--cache /tmp/claude-501/npmc8` (a scratch directory). The host cache was not touched. The user may want to run the `sudo chown -R 501:20 "$HOME/.npm"` that npm printed before any later `npm install` row; that command was not run (outside this row).
2. **Word `telemetry` in query Q6.** It also occurs in the predecessor's analysis, in the sense of tool telemetry opt-out. It is a generic technology word, not a design-book concept, but the controller's "no design-book term" check should be judged knowingly. Details in section 2.1 of the collection.
3. **`@fastify/websocket` is behind.** Installed 11.3.1 in `apps/mock-core/package.json:18`; registry latest 11.3.3, published 2026-10-03T14:44:35Z.
4. **Fastify docs disagree on Node 26.** The 5.x branch `LTS.md` lists Node 20 and 22 for v5 while the 5.x branch CI matrix runs 20, 22, 24, 26 (collection N-2, N-3). The Node 26 claim in the collection rests on the CI matrix.
5. **Community packages that do not fit Fastify 5.** `fastify-socket.io` is Fastify 4 only. `fastify-uws` v2 lists Node 20, 22 and 24 (not 26).
6. **uWebSockets.js is not on the npm registry.** It installs from a GitHub tag; the v20.71.0 tag has a darwin-arm64 binary for ABI 147 and this host reports ABI 147. Not load-tested.
7. **Contradicted search summary.** A Q1 search summary claimed `ws` `send()` returns a boolean with a `drain` event. The `ws` docs and `lib/websocket.js:468-498` show no return value. Recorded in S-1 so no later row relies on the summary.
8. **GitHub API rate limit.** Unauthenticated `api.github.com` calls hit the limit, so no Fastify issue-tracker search for Node 26 defects was done (gap G-4).
9. **Tool note.** The Edit tool was unavailable in this session. The collection was written with Write; the raw `npm view` appendix was appended with a shell redirect, and two string replacements in my own output file were made with a scoped Node script. No other file was modified this way.

## Decisions taken inside this row (no design decisions)

- Included T-B (adjacent packages) and T-C (looked up, not evaluated) tables beyond the seven named capabilities, because the fan-out and upgrade topics surfaced them; compatibility is marked "not confirmed" where unknown.
- Treated Fastify branch `5.x` (not `main`) as the evidence for v5, because `main` is `6.0.0-alpha.4`.
- No recommendation, ranking or choice is given anywhere in the collection (that belongs to row 14).

*Generated: 2026-10-04*
