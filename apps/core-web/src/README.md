# src

Up: [apps/core-web](../README.md)

## Purpose

The source of the DEMS web console (`@dems/core-web`): a React app built with Vite, `@tanstack/react-router`, `@tanstack/react-query`, `@heroui/react` and Tailwind CSS. `main.tsx` boots the data mode (LIVE against the Core, or SIMULATED with the in-browser simulator of `@dems/shared`), builds the router from `router.tsx` and mounts the app. This README is the index of the folders below.

## Files

| File | Role |
|---|---|
| [`assets/`](assets/README.md) | Brand assets of the console |
| [`components/`](components/README.md) | Shared components: the signed-in shell, UI kit wrappers, composed widgets, media |
| [`env.d.ts`](env.d.ts) | Types of the build-time `VITE_*` keys the app reads (no `.env` file is used) |
| [`features/`](features/README.md) | One folder per page area (Dashboard, Devices, Evidence, Session Monitor and the others) |
| [`i18n-web.ts`](i18n-web.ts) | Sentences of the web console only (`enWeb`, the `web` namespace), merged over the shared words |
| [`i18n.ts`](i18n.ts) | The i18next runtime: one `translation` namespace with `mergeResources(en, enWeb)`, English only; missing-key tracking for tests |
| [`index.css`](index.css) | Global stylesheet: imports `@heroui/styles` (which brings Tailwind v4) and the shared HeroUI theme of `@dems/shared`, scans the shared sources for class recipes, sets the base background |
| [`lib/`](lib/README.md) | Core endpoint and query factories, error words, downloads, CSP, small helpers |
| [`main.tsx`](main.tsx) | App entry: runs Zod without its JIT (packaged CSP), then loads the simulator, i18n and router in order and renders the app |
| [`motion/`](motion/README.md) | Motion policy, variants and ambient animation helpers |
| [`routeTree.gen.ts`](routeTree.gen.ts) | Generated route tree (from `routes/`); not edited by hand |
| [`router.tsx`](router.tsx) | Router factory (`createAppRouter`): route tree and router context (data source `sim`, `queryClient`, optional heartbeat socket factory and `coreMode`), used by the app and the route tests |
| [`routes/`](routes/README.md) | File routes: `/login`, the signed-in shell `_app` and its pages |
| [`runtime/`](runtime/README.md) | Boot, data mode, production lock, live host, error sink, query bridge |
| [`test/`](test/README.md) | Page-level and live integration tests, and the test setup |
| [`version.ts`](version.ts) | `WEB_CONSOLE_VERSION`, the console's own build version (equal to `package.json`) |

## Main exports

- `createAppRouter`, `RouterContext`, `AppRouter` (`router.tsx`).
- `createI18n`, `i18n`, `getMissingI18nKeys`, `resetMissingI18nKeys` (`i18n.ts`); `enWeb` (`i18n-web.ts`).
- `WEB_CONSOLE_VERSION` (`version.ts`), shown next to the Core's version (operation 64).

## Core operations, state and shared modules

- `router.tsx` uses `@dems/shared/live`, `@dems/shared/realtime` and `@dems/shared/sim`; `main.tsx` uses `@dems/shared/sim`; the i18n files use `@dems/shared/i18n`.
- Core operations and state slices are read in the folders: see [`features/`](features/README.md), [`lib/`](lib/README.md) and [`runtime/`](runtime/README.md).

## Tests

- Per-folder `__tests__/` folders, for example [`lib/__tests__/`](lib/__tests__/) and [`components/shell/__tests__/`](components/shell/__tests__/).
- Page-level tests and the setup in [`test/`](test/README.md), including `routes.test.tsx` which builds the router with `createAppRouter`.

## Related decisions

- D47: the web decided the data mode in `boot.ts`; the fix is the production lock (`VITE_DEMS_PRODUCTION_LOCK=1`, LIVE only).
- D34, D101: core-web is always typechecked with `tsc -b` (project references).
- D279: the console README at the app root. D280: these per-folder READMEs.
