/**
 * THE BOX CHECK OF THE WEB CONSOLE (fix wave J, driver J-W: the judges' `box.js`; fix wave Q, driver Q-W:
 * the two rules the confirmation asked for - JW-18, CW-01, CW-02). What is cut, clipped, broken or
 * overlapping ON THE PAGE AS DRAWN, read from the layout of a real browser.
 *
 * It is a module of the console so the check is ONE text, kept with the code it checks:
 *
 * - in a browser (the judging and fix sessions) the dev server serves it and the driver evaluates
 *   `(await import('/src/test/box-check.ts')).boxCheck()` in the page at 1280 x 800, 1440 x 900 and
 *   1920 x 1080; a page passes when `boxCheckFailures(result)` is empty;
 * - `box-check.test.ts` holds each rule against a small document whose geometry is given to the
 *   elements (jsdom has no layout), with a control per rule.
 *
 * | Finding | Rule |
 * |---|---|
 * | `cut` | an element with text of its own is wider (or taller) than its box and hides the rest (`overflow: hidden / clip`) - unless the cut is SAID: an ellipsis or a line clamp AND a `title` on the element or its cell that holds the whole text (rule (b) of wave Q; the first check failed every ellipsis and passed a clipped box without one) |
 * | `clipped` | a text sticks out of the nearest ancestor that clips (`overflow: hidden / clip`, not a scroll container) - a line cut by the picture box that holds it (CW-02) |
 * | `broken` | a word of a heading, a label, a chip, a button or any short text is laid out on more than one line: "AUDI / O / MON / ITOR", "SHA- / 256" (rule (a) of wave Q; CW-01). Skipped: free text an operator typed and long codes (a hash, a path), which may wrap anywhere; and a long identifier in running text ("SES-20261012-0110"), which may wrap at its hyphens and slashes |
 * | `inner` | a scroll container hides part of its content sideways (a table column outside the view). A code view (the record's JSON) scrolls sideways by design and is skipped |
 * | `over` | two texts of the page lie over each other |
 */

export interface BoxCheckResult {
  readonly vw: string
  readonly path: string
  readonly pageScrollX: number
  readonly cut: readonly string[]
  readonly clipped: readonly string[]
  readonly broken: readonly string[]
  readonly inner: readonly string[]
  readonly over: readonly string[]
}

export interface BoxCheckOptions {
  /** The document to check (default: the page's). */
  readonly root?: Document
  /**
   * The boxes of the characters `start..end` of a text node, one per line fragment (default: a DOM
   * `Range`). A test gives its own, because jsdom lays nothing out.
   */
  readonly rectsOf?: (node: Text, start: number, end: number) => readonly { readonly top: number; readonly bottom: number; readonly left: number; readonly right: number }[]
  /** Scroll containers that MAY hide content sideways because they say so (a table with its sideways cue): a selector. */
  readonly allowedInner?: string
}

/** A word longer than this is a code (a hash, a path, an address): it may break. */
const WORD_MAX = 24
/** Containers whose text an operator typed, or that print a code: a word inside may break anywhere. */
const FREE_TEXT = '.evi-free, [data-free-text], pre, code, textarea, input, .evi-mono, .sa-mono, .sys-mono, .font-mono, .api-rt-json-wrap, .evi-json, [data-box-check="free"]'

/** A token up to this length is a name ("SHA-256", "CAM-02", "UTC+07:00"): it stays whole everywhere. */
const NAME_MAX = 9
/** An ordinary compound word ("Auto-Save", "sign-in"): letters only, not all capitals. In running text it may wrap at its hyphen. */
const COMPOUND_WORD = /^(?=.*[a-z])[A-Za-z]+(?:-[A-Za-z]+)+[.,;:]?$/
/** A code view scrolls sideways by design (the record's JSON, a frame of the realtime panel). */
const CODE_VIEW = 'pre, code, [data-testid$=json], .api-rt-json-wrap'
/** Elements whose words never break, wherever the break would fall. */
const HEADING_LIKE = 'h1, h2, h3, h4, h5, h6, th, dt, label, legend, button, [role=tab], [class*=title], [class*=label], [class*=chip], [class*=badge], [class*=heading]'

/** True when every line break inside the word falls right after a hyphen or a slash. */
function breaksOnlyAtSeparators(node: Text, start: number, word: string, rectsOf: NonNullable<BoxCheckOptions['rectsOf']>): boolean {
  let previousTop: number | null = null
  for (let index = 0; index < word.length; index += 1) {
    const box = rectsOf(node, start + index, start + index + 1)[0]
    if (box === undefined) continue
    if (previousTop !== null && Math.abs(box.top - previousTop) > Math.max(1, box.bottom - box.top) / 2 && !/[-/]/.test(word[index - 1] ?? '')) return false
    previousTop = box.top
  }
  return true
}

const SKIP = '[aria-hidden=true], .sr-only, .dems-skip-link, svg, script, style, [data-box-check="skip"]'

function nameOf(element: Element): string {
  const testId = element instanceof HTMLElement && element.dataset['testid'] ? `#${element.dataset['testid']}` : ''
  const classes = typeof element.className === 'string' ? element.className.split(' ').filter(Boolean).slice(0, 2).join('.') : ''
  return `${testId}.${classes}`
}

function textOf(element: Element, max: number): string {
  return (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, max)
}

/** The `title` that says the whole text of a cut element: its own, or the one of its parent or grandparent (a cell that carries it). */
function saidInTitle(element: Element): boolean {
  const text = (element.textContent ?? '').trim().replace(/\s+/g, ' ')
  let holder: Element | null = element
  for (let depth = 0; depth < 3 && holder !== null; depth += 1) {
    const title = holder.getAttribute('title')?.trim().replace(/\s+/g, ' ')
    if (title !== undefined && title !== '' && (title === text || title.includes(text))) return true
    holder = holder.parentElement
  }
  return false
}

export function boxCheck(options: BoxCheckOptions = {}): BoxCheckResult {
  const doc = options.root ?? document
  const view = doc.defaultView ?? window
  const style = (element: Element): CSSStyleDeclaration => view.getComputedStyle(element)
  const visible = (element: Element): boolean => {
    const rect = element.getBoundingClientRect()
    const s = style(element)
    return rect.width > 1 && rect.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'
  }
  const ownText = (element: Element): boolean => [...element.childNodes].some((node) => node.nodeType === 3 && (node.textContent ?? '').trim().length > 1)
  const hides = (value: string): boolean => value === 'hidden' || value === 'clip'
  const clamp = (s: CSSStyleDeclaration): boolean => {
    const value = s.getPropertyValue('-webkit-line-clamp')
    return value !== '' && value !== 'none'
  }
  const rectsOf =
    options.rectsOf ??
    ((node: Text, start: number, end: number) => {
      const range = doc.createRange()
      range.setStart(node, start)
      range.setEnd(node, end)
      return [...range.getClientRects()]
    })

  const cut: string[] = []
  const clipped: string[] = []
  const broken: string[] = []
  const elements = [...doc.querySelectorAll('body *')].filter((element) => element.closest(SKIP) === null && visible(element))

  for (const element of elements) {
    if (!ownText(element)) continue
    const s = style(element)
    const said = (s.textOverflow === 'ellipsis' || clamp(s)) && saidInTitle(element)
    // (b) clipped text: wider or taller than the box, the rest hidden, and the cut not said.
    if (element.scrollWidth > element.clientWidth + 1 && hides(s.overflowX)) {
      if (!said) cut.push(`${nameOf(element)} "${textOf(element, 70)}" needs ${element.scrollWidth} has ${element.clientWidth}`)
    } else if (element.scrollHeight > element.clientHeight + 3 && hides(s.overflowY) && element.clientHeight > 0 && s.display !== 'inline') {
      if (!said) cut.push(`${nameOf(element)} "${textOf(element, 70)}" needs h ${element.scrollHeight} has ${element.clientHeight}`)
    }
    // A text that sticks out of the nearest ancestor that clips (CW-02: the lines of a tile cut by its picture box).
    const rect = element.getBoundingClientRect()
    for (let parent = element.parentElement; parent !== null && parent !== doc.body; parent = parent.parentElement) {
      const ps = style(parent)
      const clipsX = hides(ps.overflowX)
      const clipsY = hides(ps.overflowY)
      if (!clipsX && !clipsY) {
        // A scroll container shows the rest when scrolled: the search ends there.
        if (ps.overflowX === 'auto' || ps.overflowX === 'scroll' || ps.overflowY === 'auto' || ps.overflowY === 'scroll') break
        continue
      }
      const box = parent.getBoundingClientRect()
      const outX = clipsX && (rect.right > box.right + 2 || rect.left < box.left - 2)
      const outY = clipsY && (rect.bottom > box.bottom + 2 || rect.top < box.top - 2)
      if ((outX || outY) && !(said || ((style(parent).textOverflow === 'ellipsis' || clamp(ps)) && saidInTitle(parent)))) {
        clipped.push(`${nameOf(element)} "${textOf(element, 50)}" clipped by ${nameOf(parent)}`)
      }
      break
    }
    // (a) a word broken inside itself.
    if (element.closest(FREE_TEXT) !== null) continue
    for (const node of element.childNodes) {
      if (node.nodeType !== 3) continue
      const text = node.textContent ?? ''
      const words = text.matchAll(/\S+/g)
      for (const match of words) {
        const word = match[0]
        if (word.length < 2 || word.length > WORD_MAX || !/[A-Za-z0-9]/.test(word)) continue
        const lines = rectsOf(node as Text, match.index, match.index + word.length).filter((box) => box.right - box.left > 0.5)
        if (lines.length < 2) continue
        const first = lines[0]!
        const height = Math.max(1, first.bottom - first.top)
        if (lines.some((box) => Math.abs(box.top - first.top) > height / 2)) {
          // A long identifier ("SES-20261012-0110", "LP/2026/1012-9954") and an ordinary compound word ("Auto-Save") in
          // running text may wrap AT their hyphens and slashes - never in a heading, a label, a chip or a button, and
          // never a short name ("SHA-256", "CAM-02").
          if ((word.length > NAME_MAX || COMPOUND_WORD.test(word)) && element.closest(HEADING_LIKE) === null && breaksOnlyAtSeparators(node as Text, match.index, word, rectsOf)) continue
          broken.push(`${nameOf(element)} "${word}" of "${textOf(element, 40)}" is on ${new Set(lines.map((box) => Math.round(box.top))).size} lines`)
        }
      }
    }
  }

  // A scroll container that hides part of its content sideways (a table column outside the view).
  const inner: string[] = []
  for (const element of elements) {
    const s = style(element)
    if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && element.scrollWidth > element.clientWidth + 2) {
      if (options.allowedInner !== undefined && element.closest(options.allowedInner) !== null) continue
      if (element.matches(CODE_VIEW) || element.closest(CODE_VIEW) !== null) continue
      inner.push(`${nameOf(element)} content ${element.scrollWidth} in ${element.clientWidth}`)
    }
  }

  // Texts of the page that lie over each other (labels printed over each other).
  const over: string[] = []
  const leaves = [...doc.querySelectorAll('main *')].filter(
    (element) => element.closest(SKIP) === null && visible(element) && ownText(element) && style(element).position !== 'absolute' && element.closest('[class*=absolute]') === null,
  )
  for (let i = 0; i < leaves.length && over.length < 12; i += 1) {
    const a = leaves[i]!.getBoundingClientRect()
    for (let j = i + 1; j < Math.min(leaves.length, i + 40); j += 1) {
      if (leaves[i]!.contains(leaves[j]!) || leaves[j]!.contains(leaves[i]!)) continue
      const b = leaves[j]!.getBoundingClientRect()
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      const listed = 'table,[role=grid],[role=row],ol,ul'
      if (w > 6 && h > 6 && leaves[i]!.closest(listed) === null && leaves[j]!.closest(listed) === null) over.push(`"${textOf(leaves[i]!, 30)}" over "${textOf(leaves[j]!, 30)}"`)
    }
  }

  const page = doc.documentElement
  return {
    vw: `${view.innerWidth}x${view.innerHeight}`,
    path: view.location.pathname + view.location.search,
    pageScrollX: page.scrollWidth > page.clientWidth + 1 ? page.scrollWidth - page.clientWidth : 0,
    cut: [...new Set(cut)].slice(0, 40),
    clipped: [...new Set(clipped)].slice(0, 30),
    broken: [...new Set(broken)].slice(0, 40),
    inner: [...new Set(inner)].slice(0, 10),
    over: [...new Set(over)],
  }
}

/** Every finding of a result as one list; empty = the page passes. */
export function boxCheckFailures(result: BoxCheckResult): string[] {
  return [
    ...result.cut.map((line) => `CUT ${line}`),
    ...result.clipped.map((line) => `CLIPPED ${line}`),
    ...result.broken.map((line) => `BROKEN ${line}`),
    ...result.inner.map((line) => `INNER ${line}`),
    ...result.over.map((line) => `OVER ${line}`),
    ...(result.pageScrollX > 0 ? [`PAGE scrolls sideways by ${result.pageScrollX}`] : []),
  ]
}
