/**
 * Scalar `customCss` (01_specs §14.9; 03_motion_spec §5.5; D49; 11_token_pipeline DR-a, DR-b).
 *
 * `customCss` = the generated token theme (`@dems/shared/theme/scalar.css`: the `--scalar-*`
 * variables, both keyframes, the token-timed shorthands and the reduced-motion switch) + the
 * element-level rules below, which bind that motion to Scalar's own DOM. Step 30 left the selector
 * binding here because only the running renderer can prove the selectors (verified in headless
 * Chromium against @scalar/api-reference 1.72.3, implementation/32_page_api_reference.md §3):
 *
 * - chevrons (sidebar groups, section accordions) rotate on the token transition (160 ms, `standard`);
 * - method pills brighten on hover (120 ms, a documented literal, D49);
 * - the selected sidebar operation (`a[aria-current=page]`) gets a gold edge, and a glow layer
 *   fades in on opacity (200 ms literal, D49; no animated box-shadow, motion spec §9);
 * - the Try-it response status dot pops once, and the SIMULATED badges shimmer once, when a
 *   response arrives: the page flips `data-dems-exchange` between `a` and `b` on the renderer
 *   container, and each parity names its own keyframe copy, so the animation restarts;
 * - status colours: Scalar maps 3xx to yellow and 4xx/5xx to red; 04 §5.9 wants **3xx blue and
 *   4xx amber** (5xx stays red). The Try-it response dot is keyed on the status link it sits in
 *   (its href ends in the code). The reference's own response tabs carry no status colour;
 * - `x-badges` render as the kit's soft chips (tinted fill, coloured text) instead of Scalar's
 *   solid fill, so LIVE / SIMULATED / RBAC + AUDIT read like the legend chips above the renderer.
 *
 * Reduced motion: the shared file sets the three `--dems-scalar-*` shorthands to `none`, and the
 * page-side copies below follow the same media query.
 */
import scalarThemeCss from '@dems/shared/theme/scalar.css?raw'
import { API_BADGES } from '@dems/shared/api'

/** The renderer container attribute the page flips on every answered Try-it exchange. */
export const EXCHANGE_ATTRIBUTE = 'data-dems-exchange'

const HOVER_MS = 120
const SELECTED_FADE_MS = 200

const ELEMENT_CSS = `
/* ── DEMS element bindings (features/api-reference/scalar-theme.ts) ───────────────────────── */
@keyframes dems-pop-b { from { transform: scale(0.9); } to { transform: scale(1); } }
@keyframes dems-sheen-b { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@keyframes dems-fade-in { from { opacity: 0; } to { opacity: 1; } }

/* Chevrons rotate 90° on the token transition: sidebar groups (modern layout: the rotating box
   inside button[aria-expanded]) and section accordions (classic layout). */
.dems-api-renderer button[aria-expanded] > .transition-transform,
.dems-api-renderer .section-accordion-chevron {
  transition: var(--dems-scalar-chevron-transition);
}

/* Method pills brighten on hover: sidebar pills and the operation header pill. */
.dems-api-renderer .sidebar-heading-type,
.dems-api-renderer .endpoint-method {
  transition: filter ${HOVER_MS}ms cubic-bezier(0.2, 0, 0, 1);
}
.dems-api-renderer a:hover .sidebar-heading-type,
.dems-api-renderer .endpoint-method:hover {
  filter: brightness(1.15);
}

/* The selected sidebar operation: a gold edge, and a glow layer fading in (opacity only). */
.dems-api-renderer a[aria-current='page'] {
  position: relative;
  box-shadow: inset 2px 0 0 0 var(--scalar-color-accent);
}
.dems-api-renderer a[aria-current='page']::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  box-shadow: 0 0 14px 0 color-mix(in srgb, var(--scalar-color-accent) 22%, transparent);
  animation: dems-fade-in ${SELECTED_FADE_MS}ms cubic-bezier(0.2, 0, 0, 1) 1 both;
}

/* x-badges as soft chips: tinted fill, coloured text, a hairline in the badge colour. */
.dems-api-renderer .badge-colored {
  background-color: color-mix(in srgb, var(--badge-color) 16%, transparent);
  background-image: linear-gradient(110deg, transparent 35%, color-mix(in srgb, var(--badge-color) 45%, transparent) 50%, transparent 65%);
  background-size: 200% 100%;
  background-position: 200% 0;
  background-repeat: no-repeat;
  border-color: color-mix(in srgb, var(--badge-color) 45%, transparent);
  color: var(--badge-color);
  font-family: var(--scalar-font);
  font-weight: 600;
  letter-spacing: 0.06em;
}

/* Response reveal: the SIMULATED badges shimmer once, the response status dot pops once. */
.dems-api-renderer[${EXCHANGE_ATTRIBUTE}='a'] .badge-colored[style*='${API_BADGES.SIMULATED.color}'] { animation: var(--dems-scalar-sheen); }
.dems-api-renderer[${EXCHANGE_ATTRIBUTE}='b'] .badge-colored[style*='${API_BADGES.SIMULATED.color}'] { animation: dems-sheen-b 1200ms cubic-bezier(0.2, 0, 0, 1) 1 both; }
.dems-api-renderer[${EXCHANGE_ATTRIBUTE}='a'] a[href*='/Status/'] > span[style],
.dems-api-renderer[${EXCHANGE_ATTRIBUTE}='a'] span > span.rounded-full[style] { animation: var(--dems-scalar-pop); }
.dems-api-renderer[${EXCHANGE_ATTRIBUTE}='b'] a[href*='/Status/'] > span[style],
.dems-api-renderer[${EXCHANGE_ATTRIBUTE}='b'] span > span.rounded-full[style] { animation: dems-pop-b 240ms cubic-bezier(0.22, 1, 0.36, 1) 1 both; }

/* Status colours (04 §5.9): 3xx blue, 4xx amber, 5xx red. The response dot sits inside the link
   to the status code's reference page, whose href ends in the code. */
.dems-api-renderer a[href*='/Status/3'] > span[style] { background-color: var(--scalar-color-blue) !important; }
.dems-api-renderer a[href*='/Status/4'] > span[style] { background-color: var(--scalar-color-orange) !important; }
.dems-api-renderer a[href*='/Status/5'] > span[style] { background-color: var(--scalar-color-red) !important; }

@media (prefers-reduced-motion: reduce) {
  .dems-api-renderer [style*='--badge-color'],
  .dems-api-renderer a[href*='/Status/'] > span[style],
  .dems-api-renderer span > span.rounded-full[style],
  .dems-api-renderer a[aria-current='page']::after { animation: none !important; }
  .dems-api-renderer .sidebar-heading-type,
  .dems-api-renderer .endpoint-method { transition: none; }
}
`

/** The whole `customCss` string handed to Scalar. */
export const SCALAR_CUSTOM_CSS = `${scalarThemeCss}\n${ELEMENT_CSS}`

/** The shared generated theme alone (the test checks it is included verbatim). */
export const SCALAR_THEME_CSS = scalarThemeCss
