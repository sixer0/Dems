/**
 * Support for the static guard on log calls (not a test file): it finds every call of a logger
 * method in a source text and lists the members of the object the call logs.
 *
 * It reads text, not a syntax tree. What it understands: strings, template literals with their
 * `${...}` parts, and the nesting of parentheses, brackets and braces. That is enough to cut the
 * first argument of a call out of the text and to split an object literal into its members. It
 * expects the text WITHOUT comments (`stripComments` of `scan.ts`).
 *
 * What it does not see: an object that is built in a variable and logged by its name, and a
 * member that arrives through a spread. The logger itself is the protection there
 * (`safeLogObject` in `src/plugins/logger/logger-options.ts`); this guard keeps the convention.
 */

/** `log.warn(`, `app.log.error(`, `request.log.info(`, `logger.debug(`. */
const LOG_CALL = /\b(?:log|logger)\s*\.\s*(trace|debug|info|warn|error|fatal)\s*\(/g;
/** `log.child(`, `app.log.child(`. */
const CHILD_CALL = /\b(?:log|logger)\s*\.\s*child\s*\(/g;

const OPENERS: Readonly<Record<string, string>> = { '(': ')', '[': ']', '{': '}' };

/**
 * The index just after the string or template literal that starts at `start`, or `text.length`
 * when it does not end.
 */
function skipQuoted(text: string, start: number): number {
  const quote = text[start];
  let index = start + 1;
  while (index < text.length) {
    const char = text[index];
    if (char === '\\') {
      index += 2;
    } else if (quote === '`' && char === '$' && text[index + 1] === '{') {
      index = skipBalanced(text, index + 1);
    } else if (char === quote) {
      return index + 1;
    } else {
      index += 1;
    }
  }
  return text.length;
}

/** The index just after the bracket that closes the one at `start`, or `text.length`. */
function skipBalanced(text: string, start: number): number {
  const close = OPENERS[text[start] ?? ''];
  if (close === undefined) return start + 1;
  let index = start + 1;
  while (index < text.length) {
    const char = text[index] ?? '';
    if (char === "'" || char === '"' || char === '`') {
      index = skipQuoted(text, index);
    } else if (char in OPENERS) {
      index = skipBalanced(text, index);
    } else if (char === close) {
      return index + 1;
    } else {
      index += 1;
    }
  }
  return text.length;
}

/** The parts of `text` between commas that are not inside a bracket or a string. */
function splitTopLevel(text: string): Array<{ readonly text: string; readonly offset: number }> {
  const parts: Array<{ text: string; offset: number }> = [];
  let start = 0;
  let index = 0;
  while (index < text.length) {
    const char = text[index] ?? '';
    if (char === "'" || char === '"' || char === '`') {
      index = skipQuoted(text, index);
    } else if (char in OPENERS) {
      index = skipBalanced(text, index);
    } else if (char === ',') {
      parts.push({ text: text.slice(start, index), offset: start });
      index += 1;
      start = index;
    } else {
      index += 1;
    }
  }
  parts.push({ text: text.slice(start), offset: start });
  return parts.filter((part) => part.text.trim() !== '');
}

export interface LoggedMember {
  /** The key the member has in the log line. */
  readonly key: string;
  /** `shorthand` for `{ error }`, `keyed` for `{ error: value }`. */
  readonly form: 'shorthand' | 'keyed';
  /** The text of the value: the name itself for the short form, the expression for a keyed member. */
  readonly value: string;
  /** Offset of the member in the text that was scanned. */
  readonly offset: number;
}

/**
 * True when the text of a value cannot be something that was caught: a string, a template, a
 * number, `true`, `false`, `null`, a constant in capitals (`CREDENTIAL_CONFLICT_REASON`) or a
 * member in capitals of a named object (`PipelineRefusal.CLOSED`).
 */
export function isFixedValue(value: string): boolean {
  const text = value.trim();
  if (/^(?:true|false|null|-?\d[\d_.]*)$/.test(text)) return true;
  if (/^[A-Z][A-Z0-9_]*$/.test(text)) return true;
  if (/^[A-Za-z_$][\w$]*(?:\.[A-Z][A-Z0-9_]*)+$/.test(text)) return true;
  const quote = text[0];
  return (quote === "'" || quote === '"' || quote === '`') && skipQuoted(text, 0) === text.length && !text.includes('${');
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const KEYED = /^(?:([A-Za-z_$][\w$]*)|'([^'\\]*)'|"([^"\\]*)"|\[\s*(?:'([^'\\]*)'|"([^"\\]*)")\s*\])\s*:(?!:)/;

/**
 * The absolute index of every object literal written directly in the operand of a spread, between
 * `from` and `to`. A spread can hide a member: `...(cond ? { cause: err } : {})`. The scan walks
 * the operand, descending through parentheses and brackets (a ternary wraps its branches in them),
 * but NOT into another object literal — those members `membersOf` reads itself, so they are not
 * listed twice. A spread of a variable (`...where`) holds no literal and yields nothing: its keys
 * are unknown here, as before.
 */
function inlineObjectStarts(text: string, from: number, to: number): number[] {
  const starts: number[] = [];
  let index = from;
  while (index < to) {
    const char = text[index] ?? '';
    if (char === "'" || char === '"' || char === '`') {
      index = skipQuoted(text, index);
    } else if (char === '{') {
      starts.push(index);
      index = skipBalanced(text, index);
    } else if (char === '(' || char === '[') {
      const close = skipBalanced(text, index);
      starts.push(...inlineObjectStarts(text, index + 1, close - 1));
      index = close;
    } else {
      index += 1;
    }
  }
  return starts;
}

/**
 * The members of the object literal whose `{` is at `open`, with those of the object literals
 * nested in it (as a member's value, or as an element of a member's array), and with those of the
 * object literals written inside a spread (`...(cond ? { cause: err } : {})`).
 */
function membersOf(text: string, open: number): LoggedMember[] {
  const end = skipBalanced(text, open);
  const inner = text.slice(open + 1, end - 1);
  const found: LoggedMember[] = [];
  for (const part of splitTopLevel(inner)) {
    const lead = part.text.length - part.text.trimStart().length;
    const member = part.text.trim();
    const offset = open + 1 + part.offset + lead;
    if (member.startsWith('...')) {
      // Look inside every object literal written in the spread operand, so a forbidden key cannot
      // hide behind a spread (finding of decision D123a: a rename of `cause` slipped past this
      // guard because the member arrived through `...(cond ? { cause: … } : {})`).
      const operandFrom = offset + 3;
      const operandTo = open + 1 + part.offset + part.text.length;
      for (const brace of inlineObjectStarts(text, operandFrom, operandTo)) {
        found.push(...membersOf(text, brace));
      }
      continue;
    }
    if (IDENTIFIER.test(member)) {
      found.push({ key: member, form: 'shorthand', value: member, offset });
      continue;
    }
    const keyed = KEYED.exec(member);
    if (keyed === null) continue;
    const key = keyed[1] ?? keyed[2] ?? keyed[3] ?? keyed[4] ?? keyed[5] ?? '';
    const rest = member.slice(keyed[0].length);
    found.push({ key, form: 'keyed', value: rest.trim(), offset });
    const valueOffset = offset + keyed[0].length + (rest.length - rest.trimStart().length);
    if (text[valueOffset] === '{') {
      found.push(...membersOf(text, valueOffset));
    } else if (text[valueOffset] === '[') {
      const listEnd = skipBalanced(text, valueOffset);
      for (const element of splitTopLevel(text.slice(valueOffset + 1, listEnd - 1))) {
        const elementLead = element.text.length - element.text.trimStart().length;
        const elementOffset = valueOffset + 1 + element.offset + elementLead;
        if (text[elementOffset] === '{') found.push(...membersOf(text, elementOffset));
      }
    }
  }
  return found;
}

export interface LogCall {
  /** The logger method: `info`, `warn`, ... */
  readonly level: string;
  /** Line of the call in the text (1-based). */
  readonly line: number;
  /** The members of the object the call logs; empty when its first argument is no object literal. */
  readonly members: readonly LoggedMember[];
}

const lineAt = (text: string, offset: number): number => text.slice(0, offset).split('\n').length;

/** Every call of a logger method in `text` (comments removed), with the object it logs. */
export function logCalls(text: string): LogCall[] {
  const calls: LogCall[] = [];
  for (const match of text.matchAll(LOG_CALL)) {
    const open = match.index + match[0].length - 1;
    let first = open + 1;
    while (first < text.length && /\s/.test(text[first] ?? '')) first += 1;
    calls.push({
      level: match[1] ?? '',
      line: lineAt(text, match.index),
      members: text[first] === '{' ? membersOf(text, first) : [],
    });
  }
  return calls;
}

/** The lines of `text` (comments removed) that create a child logger. */
export function childLoggerCalls(text: string): number[] {
  return [...text.matchAll(CHILD_CALL)].map((match) => lineAt(text, match.index));
}

export interface KeyUse {
  readonly path: string;
  readonly line: number;
  readonly key: string;
  readonly form: LoggedMember['form'];
}

/**
 * Every member of a logged object whose key is one of `keys` and whose value could be something
 * that was caught: the short form always, a keyed member unless its value is fixed
 * (`isFixedValue`).
 */
export function loggedKeys(files: ReadonlyArray<{ readonly path: string; readonly text: string }>, keys: ReadonlySet<string>): KeyUse[] {
  const uses: KeyUse[] = [];
  for (const file of files) {
    for (const call of logCalls(file.text)) {
      for (const member of call.members) {
        if (!keys.has(member.key)) continue;
        if (member.form === 'keyed' && isFixedValue(member.value)) continue;
        uses.push({ path: file.path, line: lineAt(file.text, member.offset), key: member.key, form: member.form });
      }
    }
  }
  return uses;
}
