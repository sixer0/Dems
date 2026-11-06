# `apps/mobile/src/components/kit`

Up: [`src/components/`](../README.md)

## Purpose

Kit recipes: design tokens and class names applied to HeroUI Native parts, not new primitives. `StatusChip`, `SubjectTypeChip`, `SectionCard`, `KeyValueList` and the `cn` class joiner.

## Contents

| Entry | Role |
|---|---|
| `cn.ts` | Joins class lists (falsy values skipped) and resolves Tailwind conflicts, last one wins. |
| `index.ts` | Public surface of the kit recipes (re-exports). |
| `key-value-list.tsx` | Key-value list recipe: a kit `ListGroup`, one row per item, muted label on the left and the value on the right. A text row reads as one unit to TalkBack ("label, value"). |
| `kit.test.tsx` | Test: Kit recipes: StatusChip, SubjectTypeChip, SectionCard, KeyValueList, cn. |
| `section-card.tsx` | Section card recipe: the kit `Card` at the design radius (`rounded-xl`, 12 dp; the kit default of 24 dp is off the design scale) with an optional header (title, description, action) and footer. Elevation 1 (bronze ... |
| `status-chip.tsx` | Status chip recipe: a kit `Chip` in the tone's colour. The five kit tones map straight to `Chip color`; `info` and `sealed` use `color="default"` plus the shared className recipe, and their label takes the token text ... |
| `subject-type-chip.tsx` | Subject types, verbatim Indonesian domain terms. Two spellings are accepted: - the simulator codes `TERSANGKA` / `SAKSI` / `LAINNYA` (`SubjectType` of `@dems/shared/sim`), which screens pass straight from simulator ... |

## Main exports

- Public surface (`index.ts`): `cn`, `StatusChip`, `SUBJECT_TYPES`, `SubjectTypeChip`, `SubjectTypeTone`, `SectionCard`, `KeyValueList`.
- Components: `KeyValueList`, `SectionCard`, `StatusChip`, `SubjectTypeChip`.

## Tests

1 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
