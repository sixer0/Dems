# `apps/mobile/src/components`

Up: [`src/`](../README.md)

## Purpose

Shared UI building blocks used by many features. Three groups: `kit` (small recipes on top of HeroUI Native parts), `composed` (the larger animated compositions C-1 to C-6 and the navigation chrome) and `media` (asset renderers for the emblem, the hero backdrop and the camera feed). A feature-specific component stays in its feature folder.

## Contents

| Entry | Role |
|---|---|
| [`composed/`](composed/README.md) | The composed components: GlowRing (C-1), DbfsMeter (C-2), SessionTimeline (C-3), Stepper (C-4), the navigation chrome (C-5, in `nav/`) and RollingNumber (C-6), plus the list-row selection glow. |
| [`kit/`](kit/README.md) | Kit recipes: design tokens and class names applied to HeroUI Native parts, not new primitives. |
| [`media/`](media/README.md) | Asset renderers (not UI primitives): the brand emblem with its draw-on animation, the hero backdrop with the topographic texture, and `CameraFeed`, which plays the bundled demo media for the Simulated Core or a live video source. |

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
