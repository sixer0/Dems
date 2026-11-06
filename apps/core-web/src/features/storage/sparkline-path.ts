/**
 * SVG path for a sparkline over `values`, scaled into `width × height` with 2 px of vertical
 * padding. The domain is padded to at least 2 units so sensor noise does not look like a swing.
 * Returns `null` for fewer than two points.
 */
export function sparklinePath(values: readonly number[], width: number, height: number): string | null {
  if (values.length < 2) return null
  let min = Infinity
  let max = -Infinity
  for (const value of values) {
    if (value < min) min = value
    if (value > max) max = value
  }
  const span = Math.max(2, max - min)
  const mid = (max + min) / 2
  const lo = mid - span / 2
  const pad = 2
  const step = width / (values.length - 1)
  return values
    .map((value, i) => {
      const x = i * step
      const y = pad + (1 - (value - lo) / span) * (height - pad * 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}
