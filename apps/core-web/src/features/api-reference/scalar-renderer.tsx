/**
 * The ONLY runtime import of Scalar in the app (AC-73: no `@scalar` code outside
 * `features/api-reference`, and none in the entry chunk). The renderer panel loads this module with
 * `lazy()`, so Scalar (Vue, the API client and its CSS) is its own chunk below the already-lazy
 * `/developer/api` route chunk, and the page frame paints before it arrives.
 */
import { ApiReferenceReact } from '@scalar/api-reference-react'
// The wrapper's JS does not import its stylesheet (its .d.ts claims it does); bring it here so the
// CSS ships in this lazy chunk too. It holds no remote URL (no @import, no font CDN).
import '@scalar/api-reference-react/style.css'
import type { DemsScalarConfiguration } from './scalar-config'

export interface ScalarRendererProps {
  /** Memoized by the caller: the wrapper calls `updateConfiguration` whenever the object changes. */
  configuration: DemsScalarConfiguration
}

export default function ScalarRenderer({ configuration }: ScalarRendererProps) {
  return <ApiReferenceReact configuration={configuration} />
}
