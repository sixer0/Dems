/**
 * The ONE `bytea` column type of the typed schema (database contract TY-5; decision D38).
 *
 * drizzle-orm 0.45.3 has no built-in `bytea` column, so this custom type is the only route. It is
 * declared once, here, and every table imports it: a second declaration would be a second place
 * to get the driver mapping wrong.
 *
 * The driver hands a `bytea` over as a `Buffer` in both directions. Every column of this type
 * holds the hash of a secret (or a salt) and must never be rendered as text, logged or returned
 * (NL-1): a repository function that feeds an answer or a log uses the public column sets of
 * `public-columns.ts`, never `SELECT *`.
 *
 * The type name stays lower-case: the generated DDL quotes it, and the catalog name is `bytea`.
 */
import { customType } from 'drizzle-orm/pg-core';

export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});
