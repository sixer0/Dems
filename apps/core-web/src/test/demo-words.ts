// Fix wave J (JW-07; truth rule 3f; contract J-S 7): a console in Live mode on a Core that runs the DEMONSTRATION marks
// every feed, recording state and integrity statement as that. The Live page tests were written under the older rule "a
// Live screen never says simulated" and their bed's Core IS a simulated one - so the mark is now the only place where the
// word may stand. This helper removes the mark's own words; what is left must still not speak of a simulation.
import { enWeb } from '@/i18n-web'

const DEMO = enWeb.web.waveJ.demo
const MARK_WORDS: readonly string[] = [DEMO.hint, DEMO.modeTooltip, DEMO.chip, DEMO.modeChip, DEMO.feedNote]

/** `words` without the demonstration marks' own chip, hint and tooltip sentences. */
export function withoutDemoMarks(words: string): string {
  let rest = words
  for (const phrase of MARK_WORDS) rest = rest.split(phrase).join(' ')
  return rest
}

/** The blocks that carry a demonstration mark on the page (`data-demo-block`). */
export function demoMarkBlocks(root: ParentNode = document): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-demo-block]'), (element) => element.dataset.demoBlock ?? '')
}
