import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelfCaptureCore } from '@/lib/own-capture'

/**
 * Fix wave L (G75d-07, ruling D224 (3) / D228 (3)) drew a "Synthetic demo values" chip over every block that
 * still showed the simulator's appliance model on a Core in its own capture.
 *
 * Audit fix row 104 (DF-21, ruling D25 N3): a Core in its own capture (the REAL_PRODUCTION console) never
 * renders a synthetic slice. A block without a producer draws `NoProducerNotice` ("Not reported", register
 * S7 `system.noProducer`) in place of the model's values: a whole block through its page's panel shell
 * (`NO_PRODUCER_BLOCKS` with `useSelfCaptureCore` of `@/lib/own-capture`), a part of a block through
 * `NoProducerGate`. The chip is gone from the web console; the simulated lane is unchanged (no notice).
 * The file keeps its name (no rename without the user's word).
 */
/**
 * The "Not reported" state of a block without a producer (register S7 `system.noProducer`; the same honest
 * pattern as Security / Network / TPM "Not reported", U-08). `data-no-producer-block` names the block.
 */
export function NoProducerNotice({ block, className }: { block: string; className?: string }) {
  const { t } = useTranslation()
  return (
    <p className={className ?? 'text-caption text-foreground-2'} data-testid={`no-producer-${block}`} data-no-producer-block={block}>
      {t('system.noProducer')}
    </p>
  )
}

/**
 * Draws `children` (the model's values) on the simulated lane and `NoProducerNotice` on a Core in its own
 * capture: a REAL_PRODUCTION console never renders a synthetic slice.
 */
export function NoProducerGate({ block, className, children }: { block: string; className?: string; children: ReactNode }) {
  // Audit fix row 104 (DF-21, D25 N3): no producer here when the Core runs its own capture (`useSelfCaptureCore`, the one rule).
  const noProducer = useSelfCaptureCore()
  if (noProducer) return <NoProducerNotice block={block} className={className} />
  return <>{children}</>
}
