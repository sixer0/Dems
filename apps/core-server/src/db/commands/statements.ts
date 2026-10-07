/**
 * The one text of `CREATE DATABASE` for an empty project database (review findings CPB1-19,
 * W91-6). `db:create`, the reset routine's staging database (R-4) and the template-clone test
 * helper's first template (§10.1) build their statement here, so the three cannot drift apart in
 * owner, template, encoding or locale (database contract §8.4; TI-6, DA-11).
 *
 * A utility statement takes no bind parameter (PG-19): the database and owner names are statement
 * text. Each caller passes names it has already guarded (and quoted, where it quotes); this file
 * adds only constant text. No import: the test helper loads it without the server's modules.
 */

/** The empty template of PostgreSQL: a project database starts from nothing (TI-6, DA-11). */
export const EMPTY_DATABASE_TEMPLATE = 'template0';
/** The encoding of every project database. */
export const DATABASE_ENCODING = 'UTF8';
/** The collation and character type of every project database. */
export const DATABASE_LOCALE = 'C';

/**
 * `CREATE DATABASE <database> OWNER <owner> TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'`.
 * `database` and `owner` are identifiers the caller guarded; nothing else is interpolated.
 */
export function createEmptyDatabaseStatement(database: string, owner: string): string {
  return `CREATE DATABASE ${database} OWNER ${owner} TEMPLATE ${EMPTY_DATABASE_TEMPLATE} ENCODING '${DATABASE_ENCODING}' LOCALE '${DATABASE_LOCALE}'`;
}
