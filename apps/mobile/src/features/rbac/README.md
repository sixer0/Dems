# `apps/mobile/src/features/rbac`

Up: [`src/features/`](../README.md)

## Purpose

One role gate for the controls that ruling R2 locks on the phone and the tablet: Start Session needs `SESSION_START`, Install update needs `MAINTENANCE`. A locked control stays in place, disabled, with "Requires the X role". In Live mode the gate reads the Live session's own permission list sent by the Core (D176, row 212); while the role is not yet known the control is disabled with "Checking your permissions".

## Contents

| Entry | Role |
|---|---|
| `live-role-gate-r2.test.tsx` | Test: On the app's own Live source over the contract-checked fake transport, signed in once as the contract's INVESTIGATOR. The Core then changes the operator's role the way §6.3 ... |
| `role-gate-r2.test.tsx` | Test: In SIMULATED mode, through a small Expo Router tree with the REAL route files of `/sessions` and `/session/new`, the real Home quick actions and the real System Maintenance section, inside ... |
| `use-role-gate.ts` | One role gate for the controls ruling R2 locks on the phone and the tablet: Start Session (Home quick action, Sessions hub, any start entry) needs `SESSION_START`; Install update needs `MAINTENANCE`. |

## Main exports

- Hooks: `useRoleGate`.

## Core operations and state

- Replica state read through `useSim` selectors (`@dems/shared/sim` or local): `selectCan`, `selectRole`.

Core origin: this folder never builds a Core URL. Every call goes through the runtime, whose Live client, socket and media transport are built in `src/runtime/sim-adapters.ts` from `coreOriginOf(getCoreAddress())` of `src/runtime/core-address.ts` (D263, D265).

## Tests

2 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

From `decisions.md` of the 2026-11-05 team update audit:

- D176: row 212: `operatorPermissionGate` reads the Core session permission list.
