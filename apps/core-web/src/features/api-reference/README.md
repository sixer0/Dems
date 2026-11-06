# src/features/api-reference

Up: [src/features](../README.md)

## Purpose

The API Reference page of the web console (`/developer/api`): the Core's OpenAPI document rendered with Scalar (`@scalar/api-reference-react`), a server strip (copy and download of the document), a service banner and the Realtime (WebSocket) panel. Try-it requests go to the in-browser simulator in Simulated mode or to the Core in Live mode, except a fixed list of denied operations that one click on a documentation page must never send.

## Files

| File | Role |
|---|---|
| [`actions.ts`](actions.ts) | `copyToClipboard`, `downloadText`: copy and download with a toast and a page-log record on failure; no network |
| [`api-document.ts`](api-document.ts) | Builds the OpenAPI document the page renders: demo example payloads for Try-it, Core-server badges, origin rewriting, replica identifiers |
| [`api-reference.css`](api-reference.css) | Page styles |
| [`choreography.ts`](choreography.ts) | Enter order and timings of the page (M-PG-API) |
| [`index.tsx`](index.tsx) | `ApiReferencePage`: page layout; root `data-testid="page-api-reference"`; the refusal sentences of the denied Try-it operations |
| [`log.ts`](log.ts) | `logApiReference`: the page's own log through the console's page reporter (prefix `api`) |
| [`panel.tsx`](panel.tsx) | `ApiPanel` card frame and `ApiPanelBoundary` |
| [`realtime-panel.tsx`](realtime-panel.tsx) | `RealtimePanel`: the Realtime panel; in Live mode it reads the console's one socket through the Live source (no second socket) |
| [`renderer-panel.tsx`](renderer-panel.tsx) | `RendererPanel`: loads the Scalar chunk lazily on its beat |
| [`scalar-config.ts`](scalar-config.ts) | `createScalarConfiguration`: pure Scalar configuration with telemetry off and the privacy flags |
| [`scalar-renderer.tsx`](scalar-renderer.tsx) | `ScalarRenderer`: the only runtime import of Scalar in the app, loaded with `lazy()` |
| [`scalar-theme.ts`](scalar-theme.ts) | Scalar `customCss`: the generated token theme plus element rules |
| [`server-strip.tsx`](server-strip.tsx) | `ServerStrip`: server chips and the copy and download of `openapi.json` |
| [`service-banner.tsx`](service-banner.tsx) | `ServiceBanner`: the Core server's words in Live mode, mock-core's otherwise |
| [`sim-adapter.ts`](sim-adapter.ts) | `answerSimulated`: answers a Try-it request from the simulator, with the one try/catch and structured log |
| [`sim-fetch.ts`](sim-fetch.ts) | `createSimAwareFetch`: Scalar's `customFetch`, deciding where each Try-it request goes |
| [`try-it.ts`](try-it.ts) | Try-it rules independent of the simulator: path normalising, the denied operations (credential-carrying and stored-record operations), Core-server-only operations, `createLiveTryItFetch` |
| [`use-live-realtime-feed.ts`](use-live-realtime-feed.ts) | `useLiveRealtimeFeed`: the Realtime panel's feed in Live mode, read from the Live source's socket |
| [`use-realtime-feed.ts`](use-realtime-feed.ts) | `useRealtimeFeed`: the panel's own heartbeat feed in Simulated mode |

## Main exports

- `ApiReferencePage` (`index.tsx`), the route component.
- Panels: `RendererPanel`, `ScalarRenderer`, `ServerStrip`, `ServiceBanner`, `RealtimePanel`.
- Model and hooks: `buildApiDocument`, `createScalarConfiguration`, `createSimAwareFetch`, `createLiveTryItFetch`, `TRY_IT_DENIED_OPERATIONS`, `useRealtimeFeed`, `useLiveRealtimeFeed`.

Routes: `/developer/api` (`src/routes/_app/developer/api.tsx`).

## Core operations, state and shared modules

- Try-it in Live mode sends requests to `{page origin}/api/v1/*`; the denied list in `try-it.ts` includes the operations whose body carries a camera credential (for example `setCameraNetwork`, `updateSttConfig`, `adoptCaptureCandidate`), operation 108 `testCaptureDeviceConnection`, and operations 109 `acceptInstallation` and 110 `revokeInstallationAcceptance`.
- Realtime: the Live source's socket in Live mode; a panel-scoped heartbeat socket in Simulated mode.
- Shared modules: `@dems/shared/api`, `@dems/shared/live`, `@dems/shared/sim`, `@dems/shared/realtime`, `@dems/shared/domain`, `@dems/shared/tokens`, `@dems/shared/demo-data`, and the theme file `@dems/shared/theme/scalar.css`.
- Console folders: [`src/lib`](../../lib/) (page reporter, download), [`src/runtime`](../../runtime/).

## Tests

- This folder has no `__tests__` folder.
- Page-level tests in [`src/test`](../../test/): `api-reference-static.test.tsx`, `live-api-reference-page.test.tsx`, `live-api-reference-document.test.tsx`, `scalar-config.test.ts`, `sim-fetch.test.ts`.

## Related decisions

None found in decisions.md.
