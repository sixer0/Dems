/** Display tokens of JSON text for the read-only viewer (keys, strings, numbers, literals, punctuation). */
export type TokenKind = 'key' | 'string' | 'number' | 'literal' | 'punct' | 'space'

export interface Token {
  kind: TokenKind
  text: string
}

const TOKEN_PATTERN = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],])|(\s+)|(.)/g

/** Splits JSON text into display tokens (keys, strings, numbers, literals, punctuation). */
export function tokenizeJson(text: string): Token[] {
  const tokens: Token[] = []
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const [, str, colon, num, literal, punct, space, other] = match
    if (str !== undefined) {
      if (colon !== undefined) {
        tokens.push({ kind: 'key', text: str }, { kind: 'punct', text: colon })
      } else tokens.push({ kind: 'string', text: str })
    } else if (num !== undefined) tokens.push({ kind: 'number', text: num })
    else if (literal !== undefined) tokens.push({ kind: 'literal', text: literal })
    else if (punct !== undefined) tokens.push({ kind: 'punct', text: punct })
    else if (space !== undefined) tokens.push({ kind: 'space', text: space })
    else if (other !== undefined) tokens.push({ kind: 'punct', text: other })
  }
  return tokens
}

