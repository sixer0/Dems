# src/features/sessions

Up: [src/features](../README.md)

## Purpose

The Sessions page: every finished session of the Core with its state. A session is either sealed (with a link to its evidence item) or INCOMPLETE with the cause and what became of its recording. A quarantined recording says where it is kept and what to do. The page is reached from the Dashboard, the Session Monitor and the Evidence page. The filter and the search live in the URL (`?state=`, `?q=`), as on the Evidence page.

## Files

| File | Role |
|---|---|
| [`__tests__/`](__tests__/) | Unit and page tests of this folder |
| [`causes.ts`](causes.ts) | `useSessionCauses` and its query options: in Live mode, walks operation 38 (`listSessionHistory`) to read the `unsealableCause` of quarantined sessions, which the replicated slice does not carry |
| [`index.tsx`](index.tsx) | `SessionsPage`: filter, search, the session table with state, cause and advice per row |
| [`model.ts`](model.ts) | Pure model: `sessionRows`, `matchesSession`, `SessionFilter`, `quarantinedSessionIds`, `sessionsWithoutItem`, `unsealableCauseOfRow` |
| [`sessions.css`](sessions.css) | Page styles; nothing truncates, a cause or an advice wraps (also imported by the Alerts page) |
| [`state.ts`](state.ts) | `SessionRowState`, `evidenceStatusOfHistory`: how the page words the state of one finished session (SEALED, QUARANTINED, RECORDED_NOT_SEALED, and the other INCOMPLETE kinds) |

## Main exports

- `SessionsPage` (`index.tsx`), root test ID `page-sessions`.
- Model: `sessionRows`, `matchesSession`, `quarantinedSessionIds`, `sessionsWithoutItem` (`model.ts`); `evidenceStatusOfHistory` (`state.ts`).
- Live reader: `useSessionCauses`, `sessionCausesQueryOptions`, `sessionCausesQueryKey`, `causesOfPage` (`causes.ts`).

Routes: `/session/history` (route file `src/routes/_app/session/history.tsx`).

## Core operations, state and shared modules

- State slices read with `useSim`: `sessionHistory` (the replicated session list, operation 38) and `alerts`.
- Operation 38 `listSessionHistory`, walked page by page in Live mode for the `unsealableCause` member.
- Shared modules: `@dems/shared/api` (typed client), `@dems/shared/realtime`, `@dems/shared/sim`.
- Console folders used: [`src/components/shell`](../../components/shell/) (`PageHeader`), [`src/features/evidence`](../evidence/) (`cause-words`, `model`), [`src/lib`](../../lib/) (`core-page-walk`, `core-queries`, `page-report`, `event-words`), [`src/runtime`](../../runtime/).

## Tests

- [`__tests__/`](__tests__/): `model.test.ts`, `page.test.tsx`.

## Related decisions

None found in decisions.md.
