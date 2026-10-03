/**
 * Scalar configuration (01_specs §14.9; D26, D45, D62; AC-57). Pure data: no Scalar runtime code
 * is imported here (the type import is erased), so tests and the page frame can build it without
 * loading the renderer chunk.
 *
 * Privacy and scope (NFR1, D45):
 * - `telemetry: false`; the PostHog plugin is never loaded either.
 * - `withDefaultFonts: false`: no `fonts.scalar.com`; Inter and JetBrains Mono come from our own
 *   bundle through the theme's `--scalar-font*` variables.
 * - No `proxyUrl` / `proxy`: requests are never routed through `proxy.scalar.com`, and
 *   `simAwareFetch` answers every Try-it locally anyway.
 * - `agent: { disabled: true }` and `mcp: { disabled: true }`: on a local URL Scalar would
 *   otherwise enable its AI agent chat and the MCP button (`isLocalUrl(window.location.href)`),
 *   which pull in `@scalar/agent-chat` (the nested undici advisory, D45).
 * - `showDeveloperTools: 'never'`: no share/deploy toolbar (it talks to `dashboard.scalar.com`).
 * - `hideClientButton`, `documentDownloadType: 'none'` (the page has its own Download),
 *   `persistAuth: false`, dark only.
 */
import type { AnyApiReferenceConfiguration } from '@scalar/api-reference-react'
import type { OpenApiDocument } from '@dems/shared/api'
import type { FetchLike } from './sim-fetch'

/** The flags AC-57 checks, exactly as passed. */
export const SCALAR_PRIVACY_FLAGS = {
  telemetry: false,
  withDefaultFonts: false,
  showDeveloperTools: 'never',
  agent: { disabled: true },
  mcp: { disabled: true },
  persistAuth: false,
  hideClientButton: true,
  documentDownloadType: 'none',
} as const

/** Presentation: our theme only, dark only (D16). */
export const SCALAR_PRESENTATION = {
  theme: 'none',
  layout: 'modern',
  forceDarkModeState: 'dark',
  hideDarkModeToggle: true,
  defaultOpenFirstTag: true,
  showOperationId: false,
  hideModels: false,
} as const

export interface ScalarConfigInput {
  content: OpenApiDocument
  customFetch: FetchLike
  customCss: string
}

export type DemsScalarConfiguration = typeof SCALAR_PRIVACY_FLAGS &
  typeof SCALAR_PRESENTATION & {
    content: OpenApiDocument
    customFetch: FetchLike
    customCss: string
  }

/** Builds the configuration the renderer receives. Keep it referentially stable (memoize). */
export function createScalarConfiguration({ content, customFetch, customCss }: ScalarConfigInput): DemsScalarConfiguration {
  const configuration = {
    ...SCALAR_PRESENTATION,
    ...SCALAR_PRIVACY_FLAGS,
    content,
    customFetch,
    customCss,
  }
  // Compile-time check against Scalar's own configuration type (no runtime import).
  const check: AnyApiReferenceConfiguration = configuration
  void check
  return configuration
}
