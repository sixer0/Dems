import { Chip, EmptyState } from '@heroui/react'
import { Film, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { mediaReasonOf, readItemFacts, type DetailFacts } from './item-facts'

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
  if (facts.interrupted !== true) return null
  return (
    <span className="evi-cell-stack" data-testid={testId} data-cause={facts.interruptedCause ?? undefined}>
      <Chip size="sm" variant="soft" color="warning">
        <TriangleAlert className="size-3.5" aria-hidden="true" />
        <Chip.Label>{t('evidence.itemFacts.interrupted.status')}</Chip.Label>
      </Chip>
      <span className="evi-caption">
        {facts.interruptedCause !== null ? t('evidence.itemFacts.interrupted.cause', { cause: facts.interruptedCause }) : t('evidence.itemFacts.interrupted.causeNotReported')}
      </span>
    </span>
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
          {reason.kind === 'WORDED'
            ? t(`evidence.itemFacts.media.reason.${reason.reason}`)
            : reason.kind === 'CODE'
              ? t('evidence.itemFacts.media.reasonOther', { reason: reason.reason })
              : t('evidence.itemFacts.media.reason.NOT_REPORTED')}
        </p>
      ) : null}
    </EmptyState>
  )
}
