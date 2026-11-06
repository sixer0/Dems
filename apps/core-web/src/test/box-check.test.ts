// The rules of the browser box check (`box-check.ts`; fix wave Q, driver Q-W: JW-18, CW-01, CW-02), each held
// against a small document whose geometry is GIVEN to the elements - jsdom lays nothing out. Every rule has its
// control: the same document without the defect passes.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { boxCheck, boxCheckFailures, type BoxCheckOptions } from './box-check'

interface Box {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  /** The size the content needs (default: the box). */
  readonly sw?: number
  readonly sh?: number
}

/** Gives an element the box a browser would have laid out. */
function place(element: HTMLElement, box: Box): HTMLElement {
  element.getBoundingClientRect = () => ({ x: box.x, y: box.y, left: box.x, top: box.y, right: box.x + box.w, bottom: box.y + box.h, width: box.w, height: box.h, toJSON: () => ({}) })
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: box.w })
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: box.h })
  Object.defineProperty(element, 'scrollWidth', { configurable: true, value: box.sw ?? box.w })
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: box.sh ?? box.h })
  return element
}

function add(parent: HTMLElement, tag: string, box: Box, attributes: Readonly<Record<string, string>> = {}, text = ''): HTMLElement {
  const element = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  if (text !== '') element.textContent = text
  parent.append(element)
  return place(element, box)
}

/** One line per word: a word named in `brokenWords` is laid out on that many lines. */
function lines(brokenWords: Readonly<Record<string, number>> = {}): BoxCheckOptions['rectsOf'] {
  return (node, start, end) => {
    const word = (node.textContent ?? '').slice(start, end)
    const count = brokenWords[word] ?? 1
    return Array.from({ length: count }, (_, line) => ({ left: 0, right: 20, top: line * 20, bottom: line * 20 + 18 }))
  }
}

function main(): HTMLElement {
  return add(document.body, 'main', { x: 0, y: 0, w: 1280, h: 800 })
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('box check: a word broken inside itself (CW-01)', () => {
  it('fails on a heading whose word is laid out on more than one line, and names the word', () => {
    const page = main()
    add(page, 'h2', { x: 0, y: 0, w: 20, h: 200 }, { class: 'sm-card-title' }, 'AUDIO MONITOR')
    const result = boxCheck({ rectsOf: lines({ AUDIO: 3, MONITOR: 4 }) })
    expect(result.broken).toHaveLength(2)
    expect(result.broken[0]).toContain('"AUDIO"')
    expect(result.broken[1]).toContain('"MONITOR"')
    expect(boxCheckFailures(result).filter((line) => line.startsWith('BROKEN'))).toHaveLength(2)
  })

  it('fails on a label and a chip too ("SHA- / 256", "(UTC+0 / 7:00)")', () => {
    const page = main()
    add(page, 'span', { x: 0, y: 0, w: 30, h: 40 }, { class: 'sm-check-value' }, 'SHA-256')
    add(page, 'span', { x: 0, y: 60, w: 60, h: 40 }, { class: 'chip__label' }, 'GNSS (UTC+07:00)')
    const result = boxCheck({ rectsOf: lines({ 'SHA-256': 2, '(UTC+07:00)': 2 }) })
    expect(result.broken.map((line) => /"([^"]+)" of/.exec(line)?.[1])).toEqual(['SHA-256', '(UTC+07:00)'])
  })

  it('a long identifier in running text may wrap at its hyphens - not inside a part, and not in a heading or a label', () => {
    // One box per character: the line changes after the character at `breakAfter`.
    const perCharacter = (word: string, breakAfter: number): BoxCheckOptions['rectsOf'] => (node, start, end) => {
      const text = node.textContent ?? ''
      const from = text.indexOf(word)
      const boxOf = (index: number) => ({ left: 0, right: 8, top: index - from > breakAfter ? 20 : 0, bottom: (index - from > breakAfter ? 20 : 0) + 18 })
      if (end - start === 1) return [boxOf(start)]
      return text.slice(start, end) === word ? [boxOf(from), boxOf(from + word.length - 1)] : [boxOf(from)]
    }
    const page = main()
    const refs = add(page, 'span', { x: 0, y: 0, w: 100, h: 40 }, { class: 'sa-event-refs' }, 'SES-20261012-0110')
    // After the second hyphen (index 12): allowed in running text.
    expect(boxCheck({ rectsOf: perCharacter('SES-20261012-0110', 12) }).broken).toEqual([])
    // Inside "20261012" (after index 7): a part of the identifier is broken.
    expect(boxCheck({ rectsOf: perCharacter('SES-20261012-0110', 7) }).broken).toHaveLength(1)
    // An ordinary compound word may wrap at its hyphen in running text; a short name with digits may not.
    refs.textContent = 'Evidence Auto-Save'
    expect(boxCheck({ rectsOf: perCharacter('Auto-Save', 4) }).broken).toEqual([])
    refs.textContent = 'SHA-256'
    expect(boxCheck({ rectsOf: perCharacter('SHA-256', 3) }).broken).toHaveLength(1)
    // The same hyphen break in a table heading is a finding.
    refs.remove()
    add(page, 'th', { x: 0, y: 0, w: 100, h: 40 }, {}, 'SES-20261012-0110')
    expect(boxCheck({ rectsOf: perCharacter('SES-20261012-0110', 12) }).broken).toHaveLength(1)
  })

  it('CONTROL: the same heading with each word on one line passes', () => {
    const page = main()
    add(page, 'h2', { x: 0, y: 0, w: 160, h: 20 }, { class: 'sm-card-title' }, 'AUDIO MONITOR')
    expect(boxCheckFailures(boxCheck({ rectsOf: lines() }))).toEqual([])
  })

  it('does not fail on free text an operator typed, on a long code, or on text nobody sees', () => {
    const page = main()
    add(page, 'span', { x: 0, y: 0, w: 80, h: 60 }, { class: 'evi-strong evi-free', title: 'Wijayakusuma' }, 'Wijayakusuma')
    add(page, 'span', { x: 0, y: 80, w: 80, h: 60 }, {}, '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b')
    add(page, 'span', { x: 0, y: 160, w: 80, h: 60 }, { 'aria-hidden': 'true' }, 'DECORATION')
    const result = boxCheck({ rectsOf: lines({ Wijayakusuma: 2, '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b': 3, DECORATION: 2 }) })
    expect(result.broken).toEqual([])
  })
})

describe('box check: clipped text (CW-02, JW-18)', () => {
  it('fails on a text wider than its box that hides the rest without an ellipsis and a title', () => {
    const page = main()
    add(page, 'span', { x: 0, y: 0, w: 60, h: 18, sw: 140 }, { style: 'overflow-x: hidden; white-space: nowrap' }, 'Not checked by the Core')
    const result = boxCheck({ rectsOf: lines() })
    expect(result.cut).toHaveLength(1)
    expect(result.cut[0]).toContain('needs 140 has 60')
  })

  it('fails on an ellipsis WITHOUT a title, and on a title that does not hold the text', () => {
    const page = main()
    add(page, 'span', { x: 0, y: 0, w: 60, h: 18, sw: 140 }, { style: 'overflow-x: hidden; white-space: nowrap; text-overflow: ellipsis' }, 'Round Two Wijayakusuma')
    add(page, 'span', { x: 0, y: 30, w: 60, h: 18, sw: 140 }, { style: 'overflow-x: hidden; white-space: nowrap; text-overflow: ellipsis', title: 'Subject' }, 'Round Two Hadiningrat')
    expect(boxCheck({ rectsOf: lines() }).cut).toHaveLength(2)
  })

  it('CONTROL: an ellipsis WITH the whole text as its title passes; so does a text that fits', () => {
    const page = main()
    add(page, 'span', { x: 0, y: 0, w: 60, h: 18, sw: 140 }, { style: 'overflow-x: hidden; white-space: nowrap; text-overflow: ellipsis', title: 'Round Two Wijayakusuma' }, 'Round Two Wijayakusuma')
    const cell = add(page, 'td', { x: 0, y: 30, w: 80, h: 18 }, { title: 'Counsel present' })
    add(cell, 'span', { x: 0, y: 30, w: 60, h: 18, sw: 140 }, { style: 'overflow-x: hidden; white-space: nowrap; text-overflow: ellipsis' }, 'Counsel present')
    add(page, 'span', { x: 0, y: 60, w: 160, h: 18 }, { style: 'overflow-x: hidden' }, 'Not checked')
    expect(boxCheckFailures(boxCheck({ rectsOf: lines() }))).toEqual([])
  })

  it('fails on a text taller than its box (lines hidden below) and on a line cut by the box that holds it', () => {
    const page = main()
    add(page, 'p', { x: 0, y: 0, w: 200, h: 20, sh: 64 }, { style: 'overflow-y: hidden' }, 'No preview of this camera')
    // CW-02: the picture box is 44 px high; its three lines need 64 px and are centred, so the first starts above it.
    const frame = add(page, 'div', { x: 0, y: 100, w: 200, h: 44 }, { style: 'overflow-y: hidden', class: 'tile-frame' })
    add(frame, 'span', { x: 40, y: 90, w: 80, h: 16 }, {}, 'No preview')
    add(frame, 'span', { x: 40, y: 138, w: 80, h: 16 }, {}, 'Not checked')
    const result = boxCheck({ rectsOf: lines() })
    expect(result.cut).toHaveLength(1)
    expect(result.cut[0]).toContain('needs h 64 has 20')
    expect(result.clipped).toHaveLength(2)
    expect(result.clipped[0]).toContain('"No preview" clipped by .tile-frame')
  })

  it('CONTROL: the same lines inside a frame that holds them pass, and so does a line inside a scroll container', () => {
    const page = main()
    const frame = add(page, 'div', { x: 0, y: 100, w: 200, h: 64 }, { style: 'overflow-y: hidden' })
    add(frame, 'span', { x: 40, y: 104, w: 80, h: 16 }, {}, 'No preview')
    add(frame, 'span', { x: 40, y: 140, w: 80, h: 16 }, {}, 'Not checked')
    const list = add(page, 'div', { x: 0, y: 200, w: 200, h: 100 }, { style: 'overflow-y: auto' })
    add(list, 'span', { x: 0, y: 380, w: 80, h: 16 }, {}, 'Row below the fold')
    expect(boxCheckFailures(boxCheck({ rectsOf: lines() }))).toEqual([])
  })
})

describe('box check: the rules of the first check stay', () => {
  it('fails on a scroll container that hides a column sideways, unless it is one that says so', () => {
    const page = main()
    const wrap = add(page, 'div', { x: 0, y: 0, w: 1024, h: 300, sw: 1180 }, { style: 'overflow-x: auto', class: 'table__scroll-container' })
    add(wrap, 'span', { x: 0, y: 0, w: 80, h: 16 }, {}, 'Status')
    expect(boxCheck({ rectsOf: lines() }).inner).toEqual(['.table__scroll-container content 1180 in 1024'])
    expect(boxCheck({ rectsOf: lines(), allowedInner: '.table__scroll-container' }).inner).toEqual([])
    // A code view (the record's JSON) scrolls sideways by design.
    wrap.remove()
    const json = add(page, 'div', { x: 0, y: 0, w: 485, h: 300, sw: 1009 }, { style: 'overflow-x: auto', 'data-testid': 'evidence-json' })
    add(json, 'span', { x: 0, y: 0, w: 80, h: 16 }, {}, '"record": "CORE"')
    expect(boxCheck({ rectsOf: lines() }).inner).toEqual([])
  })

  it('fails on two texts that lie over each other, and passes when they stand beside each other', () => {
    const page = main()
    const a = add(page, 'span', { x: 0, y: 0, w: 100, h: 20 }, {}, 'No preview')
    add(page, 'span', { x: 40, y: 4, w: 100, h: 20 }, {}, 'Development source')
    expect(boxCheck({ rectsOf: lines() }).over).toEqual(['"No preview" over "Development source"'])
    place(a, { x: 0, y: 40, w: 100, h: 20 })
    expect(boxCheck({ rectsOf: lines() }).over).toEqual([])
  })
})

// ── The stylesheets (CW-01: where the ellipsis was, `overflow-wrap` took its place - and in a row that left a
// heading 20 px, it broke the heading inside its words) ─────────────────────────────────────────────────────────

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

function stylesheets(folder: string = SRC): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? (entry.name === 'node_modules' ? [] : stylesheets(join(folder, entry.name))) : entry.name.endsWith('.css') ? [join(folder, entry.name)] : [],
  )
}

/** Every `selector { body }` of a stylesheet, comments removed (a nested at-rule gives its inner rules). */
function rules(path: string): { readonly selector: string; readonly body: string }[] {
  const flat = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  return [...flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({ selector: match[1]!.replace(/\s+/g, ' ').trim(), body: match[2]!.replace(/\s+/g, ' ').trim() }))
}

/**
 * Where a text MAY still break at any character, and why. Everything here is DATA (an address, a hash, an id, a
 * name or a sentence somebody typed, the Core's own message) inside a box of a set width - never a heading, a
 * label, a chip or a button. A new rule of this kind fails the test until it is listed with its reason.
 */
const BREAKS_ANYWHERE: Readonly<Record<string, string>> = {
  '.api-kv dd': 'a value of the API reference: an address, an id',
  '.api-rt-json-wrap': 'a JSON frame of the realtime panel',
  '.dev-lcd-connection': 'the value line of the panel bridge card (a device path)',
  '.dev-connect-target dd': 'the address a camera was asked at',
  '.dev-cam-meta dd': 'a camera fact: an address, a device id',
  '.dev-facts-row dd': 'a device fact: an address, a serial',
  '.evi-mono': 'hashes, signatures and ids (`word-break: break-all`; the custody time opts out)',
  '.evi-table .evi-free': 'free text of an evidence row (subject, case number, investigator), cut after three lines with its title',
  '.evi-custody-table :is(.evi-custody-action, .evi-custody-actor, .evi-custody-detail)': 'cells of the fixed-width custody table: a word breaks only when it is longer than its column',
  '.evi-cert-subject': 'the subject name of a certificate',
  '.evi-transcript-text': 'the transcript: what was said',
  '.nt-kv-item dd, .nt-facts dd': 'a network or time value: an address, a server name',
  '.pd-reason': 'the reason an operator typed for a revocation',
  '.sa-export-result dd': 'a value of an audit export: an id, a hash',
  '.sn-check-detail': 'the sentence of a pre-check row, with device ids',
  '.ses-caption': 'the sentence under a session row, with ids and the code the Core recorded',
  '.alr-message': 'the message of an alert as the Core wrote it',
}

describe('the stylesheets: a heading or a label never breaks inside a word (CW-01)', () => {
  const files = stylesheets()

  it('every rule that lets a text break at any character is one of the listed data cells', () => {
    expect(files.length).toBeGreaterThan(10)
    const found = files.flatMap((file) =>
      rules(file)
        .filter((rule) => /overflow-wrap:\s*anywhere|word-break:\s*break-(all|word)/.test(rule.body))
        .map((rule) => rule.selector.replace(/^.*[;}]\s*/, '')),
    )
    expect(found.toSorted()).toEqual(Object.keys(BREAKS_ANYWHERE).toSorted())
    for (const selector of found) expect(selector, 'a heading, title, label, chip or button').not.toMatch(/title|heading|label|chip|badge|button|\bh[1-6]\b/i)
  })

  it('the Session Monitor card header wraps its control under the title, and the title is never narrower than its longest word', () => {
    const monitor = rules(join(SRC, 'features/session-monitor/session-monitor.css'))
    const body = (selector: string): string => monitor.find((rule) => rule.selector === selector)?.body ?? ''
    expect(body('.sm-card-header')).toContain('flex-wrap: wrap;')
    const title = body('.sm-card-title')
    expect(title).toContain('min-width: min-content;')
    expect(title).toContain('overflow-wrap: normal;')
    expect(title).not.toContain('min-width: 0;')
    expect(title).not.toMatch(/break-word|anywhere|break-all/)
  })
})
