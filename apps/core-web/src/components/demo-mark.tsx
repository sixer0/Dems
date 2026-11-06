import { Chip } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useDemonstrationCore } from './demonstration-core'

/**
 * THE MARK OF A FEED, A RECORDING STATE OR AN INTEGRITY STATEMENT OF THE DEMONSTRATION (JW-07): the
 * judge found a still photograph as the "LIVE SESSION FEED" with REC under "All integrity checks
 * passing", a TPM "Verified" and a LAN address, with no DEMO or SIMULATED word under a header chip
 * that read "LIVE". Drawn only on a demonstration Core; a Core in its own capture draws none.
 */
export function DemoMark({ block, className, overlay = false, long = false }: { block: string; className?: string; overlay?: boolean; /** The whole words "DEMO · SIMULATED" (the ring, the strip, a banner); a card header and a picture carry the short word "DEMO". */ long?: boolean }) {
  const { t } = useTranslation()
  const demo = useDemonstrationCore()
  if (!demo) return null
  return (
    <Chip size="sm" variant={overlay ? 'secondary' : 'soft'} color="warning" className={className} data-testid={`demo-mark-${block}`} data-demo-block={block}>
      <Chip.Label title={t('web.waveJ.demo.hint')} aria-label={t('web.waveJ.demo.chip')}>{long ? t('web.waveJ.demo.chip') : t('web.waveJ.demo.short')}</Chip.Label>
    </Chip>
  )
}
