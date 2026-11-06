# `src/capture/host-alias`

Up: [`src/capture`](../README.md)

## Purpose

The Core's side of the address helper: its line protocol, the one caller, and the lifecycle, store and journal of the one temporary host address. The socket itself is not here; the platform transport is handed in by the composition.

## Contents

| File or folder | Role |
|---|---|
| [`caller.ts`](./caller.ts) | The Core's one caller of the address helper. |
| [`facts.ts`](./facts.ts) | The reader of the host's facts for the address helper's caller. |
| [`index.ts`](./index.ts) | The Core's side of the address helper: the line protocol and the one caller. |
| [`job-port.ts`](./job-port.ts) | The alias port of a job, over the lifecycle. |
| [`journal.ts`](./journal.ts) | The journal of the address helper's caller: the stored row and the audit entries around each call. |
| [`lifecycle.ts`](./lifecycle.ts) | The lifecycle of the one temporary host address. |
| [`protocol.ts`](./protocol.ts) | The line protocol of the address helper, as the Core speaks it. |
| [`store.ts`](./store.ts) | The stored side of a temporary host address. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `ALIAS_MINUTES_MAX`, `ALIAS_MINUTES_MIN`, `AliasAddressProblem`, `HELPER_ANSWER_MAX_BYTES`, `HELPER_CODES`, `HELPER_REQUEST_MAX_BYTES`, `HostAliasAction`, `addRequestLine`, `aliasMinutesOf`, `aliasQuadOf`, `delRequestLine`, `dottedOf`, `helperAnswerOf`, `quadOf`, `AliasQuad`, `AliasQuadDecision`, `HelperCodeName`, `HELPER_REFUSAL_KINDS`, `HostAliasCoreRefusal`, `HostAliasEffect`, `HostAliasRefusalKind`, `HostAliasTransportFailure`, `createHostAliasCaller`, `helperRefusalOf`, `interfaceAgreementRefusal`, `judgeExchange`, `wrongNetworkRefusal`, `HostAliasAddRequest`, `HostAliasCaller`, `HostAliasCallerDeps`, and 66 more.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`capture/fence`](../fence/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`capture`](../README.md)

- Workspace packages: `@dems/shared`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 3 | 1 |

1 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (1 folders): `src/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
