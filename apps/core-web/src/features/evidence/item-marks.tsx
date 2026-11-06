import { Alert, Chip, EmptyState } from '@heroui/react'
import { causeWords } from './cause-words'
import { hasSealedValues } from '@dems/shared/sim'
import { Film, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWebLive } from '@/runtime'
import { isDemoItem, mediaReasonOf, readItemFacts, type DetailFacts } from './item-facts'

/**
 * The marks of the Evidence page that state a FACT OF THE ITEM as the Core server reports it
 * (wave H, driver C2). Each draws only what `item-facts.ts` read; a member that is absent draws
 * nothing, or the words "not reported" - never a guess.
 */

/**
 * G75-03 on the evidence surfaces: "Sealed — recording was interrupted" with its cause, on the list
 * row and the item header, when the item says `interrupted === true`. Absent or false: nothing (the
 * plain status chip stands). An icon and words, never colour alone.
 */
export function InterruptedMark({ item, testId }: { item: unknown; testId: string }) {
  const { t } = useTranslation()
  const facts = readItemFacts(item)
  // Wave J: "Sealed - recording was interrupted" is said of a SEALED item only; a never-sealed one carries `NotSealedMark`.
  if (facts.interrupted !== true || !hasSealedValues(item)) return null
  return (
    <span className="evi-cell-stack" data-testid={testId} data-cause={facts.interruptedCause ?? undefined}>
      <Chip size="sm" variant="soft" color="warning">
        <TriangleAlert className="size-3.5" aria-hidden="true" />
        <Chip.Label>{t('evidence.itemFacts.interrupted.status')}</Chip.Label>
      </Chip>
      <span className="evi-caption">
        {/* Fix wave J (JW-13 / JW-27): the cause by its name ("Storage full"), not the raw code. */}
        {facts.interruptedCause !== null ? t('evidence.itemFacts.interrupted.cause', { cause: causeWords(t, facts.interruptedCause) }) : t('evidence.itemFacts.interrupted.causeNotReported')}
      </span>
    </span>
  )
}

/**
 * Fix wave J (JW-01 / JW-27; truth rule 3a; contract J-S 1): THE MARK OF AN ITEM THAT WAS NEVER SEALED
 * (`hasSealedValues` is false: `sealedAt` is null). The list row and the header say what the item is -
 * "Not sealed" with the cause that interrupted the recording where the item states one - so an
 * INCOMPLETE recording never reads as a plain "Recorded" among sealed evidence.
 */
export function NotSealedMark({ item, testId }: { item: unknown; testId: string }) {
  const { t } = useTranslation()
  if (hasSealedValues(item)) return null
  const facts = readItemFacts(item)
  return (
    <span className="evi-cell-stack" data-testid={testId} data-not-sealed="true" data-cause={facts.interruptedCause ?? undefined}>
      <Chip size="sm" variant="soft" color="warning">
        <TriangleAlert className="size-3.5" aria-hidden="true" />
        <Chip.Label>{t('web.waveJ.evidence.notSealedChip')}</Chip.Label>
      </Chip>
      {facts.interruptedCause !== null ? <span className="evi-caption">{t('evidence.itemFacts.interrupted.cause', { cause: causeWords(t, facts.interruptedCause) })}</span> : null}
    </span>
  )
}

/**
 * Fix wave Q (CP-05, the web's side; truth rule 3a / 3f): THE MARK OF A DEMONSTRATION RECORD on a Core server. The
 * list row of such an item read plain "Sealed" while its own page says "Demonstration record of a simulated
 * session" and its verify result "Demonstration". The row and the item header draw this ONE mark, so the list says
 * what the page says. Drawn in Live mode for a v1 / simulated demonstration item (`isDemoItem`: the Core states
 * `integritySource` DEMO_PACKAGE or SIMULATED and no sealed package); Simulated mode draws none (its banner says
 * what every row is), and a recording sealed on this Core never carries it.
 */
export function DemonstrationRecordMark({ item, testId }: { item: unknown; testId: string }) {
  const { t } = useTranslation()
  const live = useWebLive() !== null
  if (!live || !isDemoItem(item)) return null
  return (
    <Chip size="sm" variant="soft" color="warning" className="evi-demonstration-chip" data-testid={testId} data-demonstration="true">
      <Chip.Label title={t('web.waveQ.evidence.demonstrationHint')}>{t('web.waveQ.evidence.demonstrationRecord')}</Chip.Label>
    </Chip>
  )
}

/**
 * JW-01: what the Hash & Integrity tab shows INSTEAD of sealed values, a manifest, a signature and a
 * Verify control for an item that was never sealed. Nothing here can turn green.
 */
export function NotSealedStatement({ item }: { item: unknown }) {
  const { t } = useTranslation()
  const facts = readItemFacts(item)
  return (
    <Alert status="warning" data-testid="evidence-not-sealed" role="status">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t('web.waveJ.evidence.notSealedTitle')}</Alert.Title>
        <Alert.Description>{t('web.waveJ.evidence.notSealedBody')}</Alert.Description>
        {facts.interruptedCause !== null ? <Alert.Description data-testid="evidence-not-sealed-cause">{t('evidence.itemFacts.interrupted.cause', { cause: causeWords(t, facts.interruptedCause) })}</Alert.Description> : null}
      </Alert.Content>
    </Alert>
  )
}

/**
 * G94-02 / G94-14: the Media tab of an item that is neither streamable nor a demo item. No player
 * and no picture: the state sentence and the reason the Core gave (worded for the known codes, shown
 * as a code otherwise, "reported no media source" when the member is absent).
 */
export function MediaNone({ facts }: { facts: DetailFacts | null }) {
  const { t } = useTranslation()
  const reason = mediaReasonOf(facts)
  return (
    <EmptyState className="evi-empty" data-testid="evidence-media-none" data-reason={reason === null ? undefined : reason.kind === 'NOT_REPORTED' ? 'NOT_REPORTED' : reason.reason}>
      <Film className="size-8 text-foreground-2" aria-hidden="true" />
      <p className="evi-empty-title">{t('evidence.itemFacts.media.noneTitle')}</p>
      <p className="evi-empty-body">{t('evidence.itemFacts.media.none')}</p>
      {reason !== null ? (
        <p className="evi-empty-body" data-testid="evidence-media-none-reason">
          {/* Fix wave J (JA2-02; contract J-S 2): a freshly sealed SIMULATED session is a demonstration record without media - said as that. */}
          {reason.kind === 'CODE' && reason.reason === 'DEMONSTRATION_RECORD'
            ? t('web.waveJ.evidence.demonstrationRecord')
            : reason.kind === 'WORDED'
            ? t(`evidence.itemFacts.media.reason.${reason.reason}`)
            : reason.kind === 'CODE'
              ? t('evidence.itemFacts.media.reasonOther', { reason: reason.reason })
              : t('evidence.itemFacts.media.reason.NOT_REPORTED')}
        </p>
      ) : null}
    </EmptyState>
  )
}
