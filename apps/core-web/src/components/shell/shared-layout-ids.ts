/**
 * R5 shared-element IDs owned by the shell (03_motion_spec §3 R5, §4 M-APP-01/02). A tiny module,
 * so the Login page (step 43) can import the ID without pulling the shell into its chunk.
 *
 * Both sides render `<motion.* layoutId={BRAND_EMBLEM_LAYOUT_ID} transition={m.transitions.layout}>`
 * inside the root `LayoutGroup` (`routes/__root.tsx`), and drop the `layoutId` when
 * `m.flags.sharedLayout` is false (reduced motion: cross-fade instead of a flight).
 */
export const BRAND_EMBLEM_LAYOUT_ID = 'brand-emblem'
