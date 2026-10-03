import { useMemo } from 'react'
import { ScrollShadow } from '@heroui/react'
import { cn } from '@/lib/utils'
import { tokenizeJson } from './json-tokens'

export interface JsonViewProps {
  /** JSON (or JSON lines) text, shown exactly as stored: hashing it must still give the signed digest. */
  text: string
  label: string
  className?: string
}

/**
 * Read-only JSON viewer (01_specs §14.5.3 "JSON in Typography Code inside ScrollShadow"; closes S19
 * without a new library): the stored bytes as text, with token colours, in a kit ScrollShadow.
 */
export function JsonView({ text, label, className }: JsonViewProps) {
  const tokens = useMemo(() => tokenizeJson(text), [text])
  return (
    <ScrollShadow className={cn('evi-json', className)} size={32} aria-label={label} role="region" tabIndex={0} data-testid="evidence-json">
      <pre className="evi-json-pre">
        <code>
          {tokens.map((token, index) =>
            token.kind === 'space' || token.kind === 'punct' ? (
              token.text
            ) : (
              <span key={index} className={`evi-json-${token.kind}`}>
                {token.text}
              </span>
            ),
          )}
        </code>
      </pre>
    </ScrollShadow>
  )
}
