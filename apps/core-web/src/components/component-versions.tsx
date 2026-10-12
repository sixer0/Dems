import type { ProductComponentRow } from '@/lib/product-versions'
import { useComponentVersionText } from './component-version-text'

/**
 * The component rows as definition rows (fix wave J round three, JW-26). `rowClassName` is the row
 * class of the list that holds them (`sys-identity-row` on System > About). Each value carries
 * `data-testid="<prefix>-<id>"` and `data-reported`.
 */
export function ComponentVersionRows({ rows, rowClassName, valueClassName, testIdPrefix }: { rows: readonly ProductComponentRow[]; rowClassName: string; valueClassName?: string; testIdPrefix: string }) {
  const text = useComponentVersionText()
  return (
    <>
      {rows.map((row) => {
        const { name, version } = text(row)
        return (
          <div key={row.id} className={rowClassName}>
            <dt>{name}</dt>
            <dd className={valueClassName} data-testid={`${testIdPrefix}-${row.id}`} data-reported={row.version === null ? 'false' : 'true'}>
              {version}
            </dd>
          </div>
        )
      })}
    </>
  )
}
