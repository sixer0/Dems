# apps/core-web/src/routes

Up: [src](../README.md)

## Purpose

`@tanstack/react-router` file routes of the console. Each file declares one route with `createFileRoute(...)`; the router tooling generates `src/routeTree.gen.ts` from this folder (generated output, not edited by hand). A file or folder whose name starts with `-` is kept out of the generated tree. Route files stay thin: they hold guards (`beforeLoad`), search-param schemas (`validateSearch`) and the page component, which comes from [`../features/`](../features/README.md) or [`../components/shell/`](../components/shell/README.md).

## Files

| File | Role |
|---|---|
| [`-search.ts`](-search.ts) | Lenient search-param schemas shared by route files: `searchText`, `searchDate`, `searchPage`, `searchRedirect`. A malformed value falls back instead of failing the route. |
| [`__root.tsx`](__root.tsx) | Root route: the app-wide providers, outermost first Query, Heartbeat (one socket client), Sim, i18n, React Aria router bridge, `MotionPolicyProvider`, then the full-viewport surface with the toast region; root error component. In Live mode it reuses the Live source's heartbeat, attaches the query bridge and installs the presentation-mode follow-up. |
| [`_app/`](_app/README.md) | Every page of the signed-in shell. |
| [`_app.tsx`](_app.tsx) | Pathless shell layout (`AppLayout`). Guard: a signed-out visit goes to `/login?redirect=<requested href>`. |
| [`login.tsx`](login.tsx) | `/login` (`LoginPage`), outside the shell, with `?redirect=`; a signed-in visit goes to `/dashboard`. |

## Main exports

Each route file exports `Route`.

| File | URL | Renders |
|---|---|---|
| __root.tsx | (root) | providers around `/login` and the `_app` shell |
| _app.tsx | (pathless layout) | `AppLayout` from [`../components/shell/`](../components/shell/README.md) |
| login.tsx | `/login` | `LoginPage` from [`../features/login/`](../features/login/README.md) |

The pages under the shell are listed in [`_app/README.md`](_app/README.md).

## Core operations, state and shared modules

- No Core operation is called here. The guards read the signed-in state from the store of `context.sim` in the router context (`selectIsSignedIn` of `@dems/shared/sim`).
- Shared package modules in `__root.tsx`: `@dems/shared/api`, `@dems/shared/live`, `@dems/shared/live/source`, `@dems/shared/realtime`, `@dems/shared/sim`.
- Console folders used: [`../runtime/`](../runtime/README.md) (`query-bridge.ts`, `presentation-follow.ts`), [`../motion/`](../motion/README.md) (`MotionPolicyProvider`), [`../lib/core-endpoint.ts`](../lib/core-endpoint.ts), [`../components/shell/`](../components/shell/README.md) (`root-error`, `shell-entrance`, `app-layout`), `src/i18n.ts`, `src/router.tsx`.

## Tests

No `__tests__/` here. Route coverage is in [`../test/routes.test.tsx`](../test/routes.test.tsx) (every page path and the signed-out guard) and [`../test/shell-motion.test.tsx`](../test/shell-motion.test.tsx) (motion provider at the root).

## Related decisions

None found in decisions.md for this folder.
