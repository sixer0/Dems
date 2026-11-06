# `src/modules/security-audit`

Up: [`src/modules`](../README.md)

## Purpose

Security and audit: operations 58 to 63 of the shared registry (security status, audit rows, audit chain verification, audit and log export).

## Contents

| File or folder | Role |
|---|---|
| [`cursor.ts`](./cursor.ts) | The cursors of the two lists of the security-audit module. |
| [`export-request.ts`](./export-request.ts) | The body of `exportAudit` and `exportLogs`. |
| [`index.ts`](./index.ts) | Security-audit module: operations 58 to 63 of the shared registry. |
| [`reads.ts`](./reads.ts) | The reads of the security-audit module, from PostgreSQL. |
| [`stored-chain.ts`](./stored-chain.ts) | The stored-chain check of `verifyAuditChain`, result `stored`. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `SECURITY_AUDIT_MODULE_OPERATIONS`, `evidenceVerificationCountsOf`, `securityAuditControl`, `securityAuditModule`, `createStoredChainVerifier`, `StoredChainStats`, `StoredChainStatus`, `StoredChainVerifier`.
- Types exported from `index.ts`: `SecurityAuditModuleOperation`, `SecurityAuditControl`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`

Outbound (what this folder imports inside `src`):

- [`db/mapping`](../../db/mapping/README.md)
- [`db/schema`](../../db/schema/README.md)
- [`plugins/error-envelope`](../../plugins/error-envelope/README.md)
- [`plugins/logger`](../../plugins/logger/README.md)
- [`plugins/permission-guard`](../../plugins/permission-guard/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `drizzle-orm`, `fastify`, `fastify-type-provider-zod`, `pg`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 11 | 6 |

6 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
