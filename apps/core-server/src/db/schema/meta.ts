/**
 * Typed schema, group `meta`: T-29 `schema_meta` (database contract §4.29), and the two
 * constants the server compares it with at boot (B-3).
 *
 * The one row is written by the last file of a migration set and by nothing else (MG-5). The
 * migrator's own bookkeeping table lives in schema `drizzle`, which the runtime role cannot
 * read (OW-5, D38); the runtime role reads the version here.
 */
import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgTable, text } from 'drizzle-orm/pg-core';

/**
 * The schema version this code expects: 1 for the first migration set. A later set adds 1 in
 * its last file, and this constant changes in the same commit (MG-5).
 */
export const DB_SCHEMA_VERSION = 1;
/** The revision of the database contract the migration set was written from. */
export const DB_CONTRACT_REVISION = 'dbc-2';

/** T-29. One row. */
export const schemaMeta = pgTable(
  'schema_meta',
  {
    singleton: boolean('singleton').primaryKey().default(true),
    schemaVersion: integer('schema_version').notNull(),
    contractRevision: text('contract_revision').notNull(),
  },
  (t) => [check('schema_meta_singleton_check', sql`${t.singleton} AND ${t.schemaVersion} >= 1`)],
);

export type SchemaMetaRow = typeof schemaMeta.$inferSelect;
