/**
 * Search-param schemas shared by the route files (masterplan/01_specs.md §14.2). The `-` prefix
 * keeps this file out of the generated route tree.
 *
 * Every field is lenient: a malformed value falls back (`.catch`) instead of failing the route,
 * so a hand-edited URL never lands on the error screen. TanStack Router parses search values as
 * JSON first, so `?q=123` arrives as a number; `searchText` accepts both.
 */
import { z } from 'zod'

/** Free text from the URL, as a trimmed string of at most `max` characters. */
export function searchText(max = 200) {
  return z
    .union([z.string(), z.number()])
    .transform((value) => String(value).trim().slice(0, max))
    .optional()
    .catch(undefined)
}

/** `YYYY-MM-DD` (the evidence date-range filter). */
export const searchDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined)

/** 1-based page number. */
export const searchPage = z.number().int().min(1).max(10_000).optional().catch(undefined)

/**
 * A same-origin path to return to after sign-in: starts with one `/`, no scheme, no `//` or `/\`
 * (open-redirect guard), at most 512 characters.
 */
export const searchRedirect = z
  .string()
  .max(512)
  .regex(/^\/(?![/\\])[^\s]*$/)
  .optional()
  .catch(undefined)
