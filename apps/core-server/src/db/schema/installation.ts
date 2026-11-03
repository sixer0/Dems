/**
 * Typed schema, group `installation`: T-48 `installation_acceptances` (schema v11, migration set
 * 12, `0024` + `0025`; schema set C of task 4, design
 * `docs/2026-10-12_input_av_core_adapter_plan/masterplan/03_db_schema_extension.md` section 2.6;
 * decisions U11 (OQ-2: the acceptance is stored in the Core, as its own set) and C2 (the row is
 * written by the acceptance operation of WP-26b, not by this folder); security finding S13-13).
 *
 * WHAT A ROW IS. The record that an installation was accepted: who accepted it and when, the
 * software version, a point-in-time copy of the site (the Core's id, name and room as they were,
 * and the site address, which has no other home), the steps that were checked and the diagnostics
 * run as it was. A copy, never a reference: a later change of the device name does not change
 * what an old acceptance says (assumption AS-2 of the design).
 *
 * ONE ACCEPTANCE IN FORCE. A row is in force while `revoked_at` is NULL. The partial unique index
 * `installation_acceptances_in_force_key` holds at most one such row: a second acceptance is
 * refused by the database until the first is revoked. The history stays - the runtime role
 * inserts, revokes, and never deletes (input-av replaces or deletes its one row).
 *
 * NO FREE JSON (S13-13). `steps` and `diagnostics` are documents, and what the database holds
 * them to is written out below: the shape (a list of at most 32 flat objects; an object of at
 * most four levels), none of the 28 denied key names AT ANY DEPTH, a size bound, and a bound on
 * every text. The CLOSED KEY LIST of each document is the contract's (row 116, in code): the
 * database is the backstop that holds whoever wrote the row.
 *
 * Runtime role (`0025`): SELECT, INSERT, UPDATE on the three revoke columns only; no DELETE. What
 * was accepted is never rewritten.
 *
 * NOT YET IN THE KEPT SET OF A RESET: the design keeps this table across a demo reset (section
 * 3.3, mode `insert`); `db/reset/kept-tables.ts` is the reset's file and does not name it yet.
 */
import { sql } from 'drizzle-orm';
import { bigint, check, foreignKey, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { matches, noSecretKeysAnywhere } from './checks';
import { operators } from './rbac';

/** A single-line text of 1 to 64 characters: the software version as the Core states it. */
const VERSION_TEXT = '^[^[:cntrl:]]{1,64}$';
/** A single-line text of 1 to 200 characters: the id, the name and the room of the Core as they were. */
const SITE_TEXT = '^[^[:cntrl:]]{1,200}$';
/**
 * The SQL/JSON path that finds a text value, at any depth, outside its bound: a string that is
 * not 0 to 200 characters free of control characters. 200, not more: the repetition count of a
 * pattern is at most 255 in PostgreSQL. A literal of this file: statement text for the CHECK,
 * never a bind parameter. Written in the form PostgreSQL prints a path back.
 */
const TEXT_OUT_OF_BOUND = `'strict $.**?(@.type() == "string" && !(@ like_regex "^[^[:cntrl:]]{0,200}$"))'`;
/** An element of the list that is no object. */
const STEP_NOT_AN_OBJECT = `'strict $[*]?(@.type() != "object")'`;
/** Anything at the third level of the list or below: a step is a FLAT object (list, object, scalar member). */
const STEP_DEEPER_THAN_FLAT = `'strict $.**{3 to last}'`;
/**
 * Anything at the fifth level of the diagnostics or below. Four levels are what the Core's own
 * diagnostics run has (`DiagnosticsRun` of the shared types: the run, its list of checks, a
 * check, the flat `params` of a check, a value).
 */
const DIAGNOSTICS_DEEPER_THAN_A_RUN = `'strict $.**{5 to last}'`;

/** One step of an acceptance: a flat object. Its key list is the contract's (row 116). */
export type InstallationAcceptanceStep = Readonly<Record<string, string | number | boolean | null>>;
/** The diagnostics of an acceptance: an object of at most four levels. Its key list is the contract's (row 116). */
export type InstallationAcceptanceDiagnostics = Readonly<Record<string, unknown>>;

/** T-48. One row per acceptance; at most one in force. */
export const installationAcceptances = pgTable(
  'installation_acceptances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    acceptedAt: bigint('accepted_at', { mode: 'number' }).notNull(),
    acceptedBy: text('accepted_by'),
    softwareVersion: text('software_version').notNull(),
    coreDeviceId: text('core_device_id').notNull(),
    siteName: text('site_name').notNull(),
    room: text('room').notNull(),
    siteAddress: text('site_address'),
    steps: jsonb('steps').$type<readonly InstallationAcceptanceStep[]>().notNull(),
    diagnostics: jsonb('diagnostics').$type<InstallationAcceptanceDiagnostics>().notNull(),
    revokedAt: bigint('revoked_at', { mode: 'number' }),
    revokedBy: text('revoked_by'),
    revokeReason: text('revoke_reason'),
  },
  (t) => [
    // Migration 0036 (principal, 2026-11-02): a reference to a record OF THE UNIT drops its
    // attribution when the operator goes, instead of holding the record in place.
    // The acceptance of a site is a fact about the site, so it outlives the operator who signed
    // it; only the name of who signed or revoked becomes unknown.
    foreignKey({
      name: 'installation_acceptances_accepted_by_fkey',
      columns: [t.acceptedBy],
      foreignColumns: [operators.id],
    })
      .onDelete('set null')
      .onUpdate('no action'),
    foreignKey({
      name: 'installation_acceptances_revoked_by_fkey',
      columns: [t.revokedBy],
      foreignColumns: [operators.id],
    })
      .onDelete('set null')
      .onUpdate('no action'),
    // ONE ACCEPTANCE IN FORCE: every row that is not revoked has the same value of the indexed
    // expression, so a second one is refused (23505) - the form of `host_network_aliases_one_open_key`.
    uniqueIndex('installation_acceptances_in_force_key')
      .on(sql`(${t.revokedAt} IS NULL)`)
      .where(sql`${t.revokedAt} IS NULL`),
    check('installation_acceptances_software_version_check', matches(t.softwareVersion, VERSION_TEXT)),
    // The point-in-time copy of the site: three single-line texts, none empty.
    check(
      'installation_acceptances_site_check',
      sql`${matches(t.coreDeviceId, SITE_TEXT)} AND ${matches(t.siteName, SITE_TEXT)} AND ${matches(t.room, SITE_TEXT)}`,
    ),
    // An address may have several lines; it is bounded in length only (input-av: 500).
    check('installation_acceptances_site_address_check', sql`${t.siteAddress} IS NULL OR char_length(${t.siteAddress}) BETWEEN 1 AND 500`),
    // `steps`: a list of at most 32 FLAT objects. CASE, not AND: the length of something that is no
    // list is an error, and a CHECK must refuse it as a rule (23514).
    check(
      'installation_acceptances_steps_check',
      sql`CASE WHEN jsonb_typeof(${t.steps}) = 'array' THEN jsonb_array_length(${t.steps}) <= 32 AND NOT jsonb_path_exists(${t.steps}, ${sql.raw(STEP_NOT_AN_OBJECT)}) AND NOT jsonb_path_exists(${t.steps}, ${sql.raw(STEP_DEEPER_THAN_FLAT)}) ELSE false END`,
    ),
    check('installation_acceptances_steps_no_secret_keys_check', noSecretKeysAnywhere(t.steps)),
    check(
      'installation_acceptances_steps_bound_check',
      sql`octet_length(${t.steps}::text) <= 8192 AND NOT jsonb_path_exists(${t.steps}, ${sql.raw(TEXT_OUT_OF_BOUND)})`,
    ),
    // `diagnostics`: an object of at most four levels (the shape of the Core's diagnostics run).
    check(
      'installation_acceptances_diagnostics_check',
      sql`CASE WHEN jsonb_typeof(${t.diagnostics}) = 'object' THEN NOT jsonb_path_exists(${t.diagnostics}, ${sql.raw(DIAGNOSTICS_DEEPER_THAN_A_RUN)}) ELSE false END`,
    ),
    check('installation_acceptances_diagnostics_no_secret_keys_check', noSecretKeysAnywhere(t.diagnostics)),
    check(
      'installation_acceptances_diagnostics_bound_check',
      sql`octet_length(${t.diagnostics}::text) <= 16384 AND NOT jsonb_path_exists(${t.diagnostics}, ${sql.raw(TEXT_OUT_OF_BOUND)})`,
    ),
    check('installation_acceptances_revoked_at_check', sql`${t.revokedAt} IS NULL OR ${t.revokedAt} >= ${t.acceptedAt}`),
    // The three revoke columns are all NULL (in force) or all set (revoked), and a reason is 5 to
    // 500 characters (input-av: a reason is required to open the setup again).
    check(
      'installation_acceptances_revoke_check',
      sql`((${t.revokedAt} IS NULL) = (${t.revokedBy} IS NULL)) AND ((${t.revokedAt} IS NULL) = (${t.revokeReason} IS NULL)) AND (${t.revokeReason} IS NULL OR char_length(${t.revokeReason}) BETWEEN 5 AND 500)`,
    ),
  ],
);

export type InstallationAcceptanceRow = typeof installationAcceptances.$inferSelect;
export type NewInstallationAcceptanceRow = typeof installationAcceptances.$inferInsert;
