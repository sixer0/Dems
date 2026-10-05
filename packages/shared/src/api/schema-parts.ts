/**
 * Building blocks of the Core-server schemas (backend task: 2026-10-04 01_specs §7.1 API-5, §7.18).
 *
 * Internal to `src/api`: `index.ts` does not re-export this module. Each helper returns a fresh
 * schema, so a named component never shares an instance with another one by accident.
 */
import { z } from 'zod';
import { API_PAGE_LIMIT_DEFAULT, API_PAGE_LIMIT_MAX } from './constants';
import {
  DEVICE_ID_PATTERN,
  EVIDENCE_ID_PATTERN,
  LIST_CURSOR_PATTERN,
  OPERATOR_ID_PATTERN,
  SESSION_ID_PATTERN,
  SHA256_HEX_PATTERN,
} from './patterns';
import { apiText } from './text';

/**
 * API-5: every schema of the backend task writes time as epoch milliseconds on the server clock.
 * The ten existing operations keep their ISO-8601 strings.
 */
export const epochMs = () => z.int().nonnegative();
export const nullableEpochMs = () => epochMs().nullable();
export const count = () => z.int().nonnegative();
export const operatorId = () => z.string().regex(OPERATOR_ID_PATTERN);
export const deviceId = () => z.string().regex(DEVICE_ID_PATTERN);
export const sessionId = () => z.string().regex(SESSION_ID_PATTERN);
export const evidenceId = () => z.string().regex(EVIDENCE_ID_PATTERN);
export const sha256Hex = () => z.string().regex(SHA256_HEX_PATTERN);

/** Free text of 1 to `max` characters after trimming, with the text rule (API-13). */
export const trimmedText = (max: number) =>
  apiText()
    .overwrite((value) => value.trim())
    .min(1)
    .max(max);

/** A value the server returns as text and a client only displays: non-empty, with the text rule. */
export const displayText = () => apiText().min(1);

/** Message of the code-unit bound of a free text. It quotes no input. */
export const codeUnitBoundMessage = (max: number): string => `The text is longer than ${max} UTF-16 code units.`;

/**
 * Free text, trimmed, of `min` to `max` characters **and** at most `max` UTF-16 code units, with
 * the text rule (API-13).
 *
 * zod's `.max()` counts code points, while the simulator bounds and cuts its texts by code units
 * (`value.length`; a character outside the Basic Multilingual Plane is two). The extra bound makes
 * the contract refuse what the hosted action would refuse or cut, so the engine is never asked to
 * cut a text that passed validation (decision on finding F-1 of contract B). `.max()` stays for
 * the `maxLength` of the JSON Schema; the code-unit bound is the stricter of the two.
 */
export const boundedText = (max: number, min = 1) =>
  apiText()
    .overwrite((value) => value.trim())
    .min(min)
    .max(max)
    .refine((value) => value.length <= max, { error: codeUnitBoundMessage(max) });

// ── Query members of a list read (01_specs §7.1 API-9; decision D51) ──────────────────────────
// A query schema serves three readers: the typed client parses the caller's object with it and
// sends the result, the server parses the text of the URL with it, and the document lists its
// members as parameters. So every member is optional and has no default (a client that gives none
// sends none, and the server applies the default), and every member is a string, a number or a
// boolean after parsing.

/** `cursor`: the `nextCursor` of the page before. */
export const pageCursor = () =>
  z
    .string()
    .regex(LIST_CURSOR_PATTERN)
    .optional()
    .describe('Opaque position: the `nextCursor` of the page before. Omit it for the first page.');

/**
 * `limit`: a whole number from 1 to 200. The URL carries it as decimal text, so the server's parse
 * coerces text to a number; a client passes a number.
 */
export const pageLimit = () =>
  z.coerce
    .number<number | string>()
    .int()
    .min(1)
    .max(API_PAGE_LIMIT_MAX)
    .optional()
    .describe(`Rows of the page: 1 to ${API_PAGE_LIMIT_MAX}. The server uses ${API_PAGE_LIMIT_DEFAULT} when it is omitted.`);

/** `nextCursor` of a page: the cursor of the next page, or null on the last one. */
export const nextCursor = () =>
  z
    .string()
    .regex(LIST_CURSOR_PATTERN)
    .nullable()
    .describe('The `cursor` of the next page, or null when this page is the last.');
