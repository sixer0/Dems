/**
 * What a statement of a unit of work may be (plan row W21; checkpoint CP-B1, finding CPB1-4;
 * finding F53, decision D87).
 *
 * A unit of work is one transaction that changes rows. Its statements are read or change ROWS:
 * `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `MERGE`, a `WITH` query, `VALUES`, and the two settings
 * that end with the transaction (`SET LOCAL`, `SET CONSTRAINTS`). Everything else is refused
 * BEFORE it is sent, so the transaction stays usable and nothing of the unit stays behind on its
 * pooled connection.
 *
 * WHAT THIS IS. A guard against accidents: the query builder's own `transaction()`, a helper
 * that ends the transaction early, a statement that leaves an object or a setting on the
 * connection. It reads the text; it is not an SQL parser and not a security boundary. A statement
 * passes these rules, in this order:
 *
 *   R1  readable     every quote and every comment of the text ends;
 *   R2  row kind     after white space, comments and opening parentheses the text starts with one
 *                    of the words above. That refuses transaction control (`BEGIN`, `COMMIT`,
 *                    `ROLLBACK`, `SAVEPOINT`, ...), session settings (`SET`, `RESET`, `DISCARD`),
 *                    every `CREATE`, `DO`, `CALL`, `PREPARE`, `LISTEN`, `LOCK` and whatever else is
 *                    not a row statement;
 *   R3  one          nothing but white space follows the first `;`;
 *   R4  no INTO      the word `INTO` appears only as `INSERT INTO` or `MERGE INTO`: `SELECT ...
 *                    INTO name` creates a table, also a temporary one;
 *   R5  no control   none of these words outside a string, a quoted name or a comment: `COMMIT`,
 *                    `ROLLBACK`, `SAVEPOINT`, `START TRANSACTION`, `PREPARE TRANSACTION`, the
 *                    function that changes a setting, the name of the path setting, the name of
 *                    the temporary schema.
 *
 * The words of R4 and R5 are searched in the text WITHOUT its strings, quoted names and comments,
 * so a row statement may hold any of them as a value: `WHERE reason = 'ROLLBACK'`.
 *
 * WHAT REMAINS POSSIBLE, and why that is accepted:
 *   - a function called from a `SELECT` can have an effect that outlasts the unit (a session-level
 *     advisory lock, a notification). The guard names one function, the one that changes a
 *     setting; it does not know every function;
 *   - `SET LOCAL` of a setting other than the path (the unit's own statement limit, a lock
 *     timeout) ends with the transaction, and the pipeline's watchdog still ends a unit that runs
 *     too long;
 *   - a text that this reader takes for one statement and the server for two. The second
 *     protection is the protocol: every statement of a unit is sent with the extended protocol
 *     (`unit-of-work.ts`), in which the server refuses a text with more than one command;
 *   - a temporary table that code OUTSIDE a unit left on the connection. The third protection
 *     makes it harmless: the unit pins the search path for its transaction, so a table that is
 *     named without its schema is the real one (`unit-of-work.ts`, `plugins/db`).
 */

/** Why a statement is not a statement of a unit. For the error text and for tests. */
export const UnitStatementRule = {
  UNREADABLE: 'UNREADABLE',
  NOT_A_ROW_STATEMENT: 'NOT_A_ROW_STATEMENT',
  SEVERAL_STATEMENTS: 'SEVERAL_STATEMENTS',
  CREATES_A_TABLE: 'CREATES_A_TABLE',
  TRANSACTION_CONTROL: 'TRANSACTION_CONTROL',
  SESSION_SETTING: 'SESSION_SETTING',
  TEMPORARY_SCHEMA: 'TEMPORARY_SCHEMA',
} as const;
export type UnitStatementRule = (typeof UnitStatementRule)[keyof typeof UnitStatementRule];

const isWordChar = (char: string | undefined): boolean => char !== undefined && /[A-Za-z0-9_$]/.test(char);

/**
 * The text with every comment replaced by a space and the content of every string, quoted name
 * and dollar-quoted string removed (`''`, `""`, `$$`). Null when a quote or a comment does not
 * end. Strings follow the standard: a quote is doubled to stand for itself; a backslash escapes
 * only in a string with the prefix `E`.
 */
export function withoutLiterals(text: string): string | null {
  let out = '';
  let index = 0;
  while (index < text.length) {
    const char = text[index] ?? '';
    const next = text[index + 1];

    if (char === '-' && next === '-') {
      const end = text.indexOf('\n', index);
      index = end < 0 ? text.length : end;
      out += ' ';
    } else if (char === '/' && next === '*') {
      // Comments nest in PostgreSQL.
      let depth = 1;
      index += 2;
      while (index < text.length && depth > 0) {
        if (text[index] === '/' && text[index + 1] === '*') {
          depth += 1;
          index += 2;
        } else if (text[index] === '*' && text[index + 1] === '/') {
          depth -= 1;
          index += 2;
        } else {
          index += 1;
        }
      }
      if (depth > 0) return null;
      out += ' ';
    } else if (char === "'" || char === '"') {
      const escapes = char === "'" && /[Ee]/.test(text[index - 1] ?? '') && !isWordChar(text[index - 2]);
      index += 1;
      let closed = false;
      while (index < text.length) {
        const inside = text[index];
        if (escapes && inside === '\\') {
          index += 2;
        } else if (inside === char) {
          if (text[index + 1] === char) {
            index += 2;
          } else {
            closed = true;
            index += 1;
            break;
          }
        } else {
          index += 1;
        }
      }
      if (!closed) return null;
      out += char + char;
    } else if (char === '$' && !isWordChar(text[index - 1])) {
      // `$tag$ ... $tag$`. A parameter (`$1`) is a dollar sign followed by a digit.
      const tag = /^\$(?:[A-Za-z_\u0080-￿][A-Za-z0-9_\u0080-￿]*)?\$/.exec(text.slice(index));
      if (tag === null) {
        out += char;
        index += 1;
      } else {
        const end = text.indexOf(tag[0], index + tag[0].length);
        if (end < 0) return null;
        index = end + tag[0].length;
        out += '$$';
      }
    } else {
      out += char;
      index += 1;
    }
  }
  return out;
}

/** R2: what a statement of a unit starts with, after white space and opening parentheses. */
const ROW_STATEMENT = /^[\s(]*(?:select|insert|update|delete|merge|with|values|set\s+(?:local|constraints))\b/i;
/** R3: something follows the first `;`. */
const SECOND_STATEMENT = /;\s*\S/;
/** R4: `INTO` that is not `INSERT INTO` or `MERGE INTO`. */
const SELECT_INTO = /(?<!\b(?:insert|merge)\s+)\binto\b/i;
/** R5, by the rule that names each. */
const FORBIDDEN_WORDS: ReadonlyArray<readonly [rule: UnitStatementRule, pattern: RegExp]> = [
  [UnitStatementRule.TRANSACTION_CONTROL, /\b(?:commit|rollback|savepoint|start\s+transaction|prepare\s+transaction)\b/i],
  [UnitStatementRule.SESSION_SETTING, /\bset_config\s*\(|\bsearch_path\b/i],
  [UnitStatementRule.TEMPORARY_SCHEMA, /\bpg_temp(?:_\d+)?\b/i],
];

/**
 * The rule that refuses `text` as a statement of a unit of work, or null when it may be sent.
 * See the header for the rules and for what they do not cover.
 */
export function unitStatementRefusal(text: string): UnitStatementRule | null {
  const code = withoutLiterals(text);
  if (code === null) return UnitStatementRule.UNREADABLE;
  if (!ROW_STATEMENT.test(code)) return UnitStatementRule.NOT_A_ROW_STATEMENT;
  if (SECOND_STATEMENT.test(code)) return UnitStatementRule.SEVERAL_STATEMENTS;
  if (SELECT_INTO.test(code)) return UnitStatementRule.CREATES_A_TABLE;
  for (const [rule, pattern] of FORBIDDEN_WORDS) if (pattern.test(code)) return rule;
  return null;
}
