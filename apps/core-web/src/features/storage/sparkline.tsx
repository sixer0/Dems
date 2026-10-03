import { sparklinePath } from './sparkline-path'

export interface SparklineProps {
  values: readonly number[]
  /** Accessible description of what the line shows. */
  label: string
  className?: string
  width?: number
  height?: number
}

/**
 * A tiny streaming line (the drive temperature over the last 1 Hz samples). Plain SVG, no chart
 * library: it re-draws with the simulator's 1 Hz health step and never animates (§9.3 streaming
 * series), so it costs one path update per second.
 */
export function Sparkline({ values, label, className, width = 88, height = 24 }: SparklineProps) {
  const d = sparklinePath(values, width, height)
  if (!d) return null
  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      data-points={values.length}
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
