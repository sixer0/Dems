# src/features/alerts

Up: [src/features](../README.md)

## Purpose

The Alerts page of the web console. It lists every alert the Core holds, newest first and the active ones before the cleared ones, states each alert's state in words, and lets the operator acknowledge an alert. The Core decides who may acknowledge.

## Files

| File | Role |
|---|---|
| [`index.tsx`](index.tsx) | `AlertsPage`: the page (header, alert list, per-alert acknowledge button with pending state, acknowledge-all control, capture notices) |
| [`model.ts`](model.ts) | `alertRows`: pure ordering of the alerts (newest first, active before cleared) |

## Main exports

- `AlertsPage` (`index.tsx`), root test ID `page-alerts`.
- `alertRows` (`model.ts`), pure.

Routes: `/alerts` (route file `src/routes/_app/alerts.tsx`).

## Core operations, state and shared modules

- Operation 70, through the `acknowledgeAlert` action of `useCoreActions()`; the result is handled with `settle`.
- State slice read with `useSim`: `alerts`. `isUnsealableAlert` from the simulator types marks alerts of sessions that could not be sealed.
- Shared modules: `@dems/shared/live` (`useCoreActions`, `settle`), `@dems/shared/realtime` (date formatting), `@dems/shared/sim` (`useSim`, alert types).
- Console folders used: [`src/components/shell`](../../components/shell/) (`AcknowledgeAllAlerts`, `PageHeader`, `reportShellError`), [`src/lib`](../../lib/) (`capture-notices`, `core-errors`, `event-words`, `pending-control`), and the stylesheet of [`src/features/sessions`](../sessions/).

## Tests

This folder has no `__tests__` folder, and no file in `src/test` names this page (a grep for `page-alerts` and `features/alerts` finds none).

## Related decisions

None found in decisions.md.
