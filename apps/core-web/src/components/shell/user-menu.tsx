import type { Key } from 'react'
import { Avatar, Button, Description, Dropdown, Label, toast } from '@heroui/react'
import { ChevronDown, IdCard, LockKeyhole, LogOut, UserRound } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { settle, useCoreActions } from '@dems/shared/live'
import { selectOperator, SignOutReason, useSim } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { useMotionPolicy } from '@/motion'
import { reportShellError } from './shell-report'

/** M-C-10: a changed label cross-fades over 120 ms (spec literal, D49). */
const ROLE_CROSS_FADE_MS = 120

/**
 * User block (01_specs §14.4 item 9; research/04 §2.1 #9, §9 #29): a ghost `Button` with an
 * `Avatar` (initials from the operator name) opening a `Dropdown`: Profile and Role (read-only),
 * Lock console, Sign out. Signing out or locking only changes the data source; the `_app` layout
 * sees the signed-out state and navigates to `/login` (one navigation path for every exit).
 *
 * Live mode (backend task; brief list row 16 of implementation/44_live_source.md §17.4): Lock
 * and Sign out never do nothing and never fail. The Live source ends the session here at once,
 * also with the link down, and tells the Core server when it can; the Login page reads its notice
 * from `lastSessionEnd`. The role line follows the role the Core server holds and cross-fades
 * when it changes (§6.3; M-C-10, the pattern of `features/devices/status-chip.tsx`).
 */
export function UserMenu() {
  const { t } = useTranslation()
  const operator = useSim(selectOperator)
  const actions = useCoreActions()
  const presentCoreError = useCoreErrorPresenter()
  const m = useMotionPolicy()
  if (!operator) return null
  const role = t(`common.roles.${operator.role}`)

  const signOut = (reason: SignOutReason) =>
    settle(() => actions.signOut(reason), {
      fail: (error) => {
        if (presentCoreError(error) !== null) return
        reportShellError('shell.signOut', error)
        toast.danger(t('common.errors.generic'))
      },
    })
  const onAction = (key: Key) => {
    if (key === 'lock') signOut(SignOutReason.LOCK)
    else if (key === 'signOut') signOut(SignOutReason.USER)
  }

  return (
    <Dropdown>
      <Button variant="ghost" className="dems-user-trigger" aria-label={`${t('shell.topBar.userMenu')}: ${operator.displayName}`} data-testid="user-menu">
        <Avatar size="sm" color="accent" variant="soft" className="dems-user-avatar">
          <Avatar.Fallback>{operator.initials}</Avatar.Fallback>
        </Avatar>
        <span className="dems-user-text">
          <span className="dems-user-caption">{t('shell.topBar.loggedInAs')}</span>
          <span className="dems-user-name">{operator.displayName}</span>
        </span>
        <ChevronDown className="dems-user-chevron" aria-hidden="true" size={18} />
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-[240px]">
        <Dropdown.Menu aria-label={t('shell.topBar.userMenu')} disabledKeys={['profile', 'role']} onAction={onAction}>
          <Dropdown.Item id="profile" textValue={`${t('shell.userMenu.profile')} ${operator.displayName}`}>
            <UserRound aria-hidden="true" size={16} />
            <div className="flex flex-col">
              <Label>{t('shell.userMenu.profile')}</Label>
              <Description>{operator.displayName}</Description>
            </div>
          </Dropdown.Item>
          <Dropdown.Item id="role" textValue={t('shell.userMenu.role', { role })}>
            <IdCard aria-hidden="true" size={16} />
            <Label>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={operator.role}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: m.seconds(ROLE_CROSS_FADE_MS) }}
                >
                  {t('shell.userMenu.role', { role })}
                </motion.span>
              </AnimatePresence>
            </Label>
          </Dropdown.Item>
          <Dropdown.Item id="lock" textValue={t('shell.userMenu.lockConsole')}>
            <LockKeyhole aria-hidden="true" size={16} />
            <Label>{t('shell.userMenu.lockConsole')}</Label>
          </Dropdown.Item>
          <Dropdown.Item id="signOut" variant="danger" textValue={t('shell.userMenu.signOut')}>
            <LogOut aria-hidden="true" size={16} />
            <Label>{t('shell.userMenu.signOut')}</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
