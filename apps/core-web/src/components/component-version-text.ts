import { useTranslation } from 'react-i18next'
import type { ProductComponentRow } from '@/lib/product-versions'

/**
 * How the console writes one component's version (fix wave J round three, finding JW-26; contract
 * J2-S 2, client rule 2): the component BY ITS NAME and its version - never a bare "v…" that could be
 * any of them. A version the Core has not stated reads "Not reported".
 */
export function useComponentVersionText(): (row: ProductComponentRow) => { readonly name: string; readonly version: string; readonly line: string } {
  const { t } = useTranslation()
  return (row) => {
    const name = t(`web.waveJ3.versions.component.${row.id}`)
    const version = row.version ?? t('common.platformNotReported.value')
    return { name, version, line: t('web.waveJ3.versions.line', { component: name, version }) }
  }
}
