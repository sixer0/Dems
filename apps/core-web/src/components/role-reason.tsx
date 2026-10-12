import { useTranslation } from 'react-i18next'
import type { OperatorRole, Permission } from '@dems/shared/sim'
import { roleReasonText } from './role-reason-text'
import { cn } from '@/lib/utils'

/**
 * THE ONE RULE OF THE WEB CONSOLE FOR "THE ROLE MAY NOT" (fix wave J, driver J-W; finding JW-14).
 *
 * The judge met five expressions of one fact: disabled with a reason, disabled without, enabled and
 * then refused two steps later, a silent redirect, and hidden. The rule:
 *
 * | What | How it is shown |
 * |---|---|
 * | A control the role may not use | DISABLED, with a VISIBLE sentence naming the role(s) that may (`RoleReason`: "Requires the Supervisor role") - not only a tooltip, which a keyboard or a touch user never opens |
 * | A page the role may not open | the guard leaves for the Dashboard (as specified) and the shell SAYS which page was refused and which role opens it (`lib/denied-page.ts`, `app-layout.tsx`) - never a redirect without a word |
 *
 * The sentence is the one the export wizard and "Retry sealing" already used (`common.rbac.requiresRole`).
 * It is a hint, like every permission display of a client: the Core decides every call.
 */
export interface RoleReasonProps {
  /** The permission the control needs, or the roles that may use it. */
  permission: Permission | readonly OperatorRole[]
  /** The `id` a disabled control names with `aria-describedby`. */
  id?: string
  className?: string
}

/** The visible reason beside a control the role may not use. */
export function RoleReason({ permission, id, className }: RoleReasonProps) {
  const { t } = useTranslation()
  return (
    <span id={id} className={cn('dems-role-reason', className)} data-testid="role-reason" data-role-reason={typeof permission === 'string' ? permission : permission.join(',')}>
      {roleReasonText(t, permission)}
    </span>
  )
}
