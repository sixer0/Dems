import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, toast } from '@heroui/react'
import { useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { CoreMode, LIVE_RESYNCED_NOTICE_MS, useLiveLink, useLiveSelector } from '@dems/shared/live'
import { useRetryCooldown } from '@dems/shared/realtime'
import { roleHas, selectOperator, useSim, type OperatorRole } from '@dems/shared/sim'
import { useWebLive, type WebLive } from '@/runtime'
import { isLinkLost, isLinkUp } from './mode-indicator-state'
import { useModeSwitch } from './mode-switch'
import { routePermission } from './route-permissions'

export interface LiveNoticesProps {
  /** True while an operator is signed in and the shell is not leaving: a notice is shown only then. */
  active: boolean
}

/**
 * What the shell says in Live mode (backend task 04_client_integration_spec §3.5, §6.3; RC-1;
 * AC-C-26, AC-C-49, AC-C-50; plan row W54). Mounted once by `AppShell`; in Simulated mode it
 * renders nothing and subscribes to nothing.
 *
 * | Event | What the operator sees |
 * |-------|------------------------|
 * | The Live link is lost while signed in | ONE persistent danger toast, "Core server unreachable. The screen shows the last state received. Reconnecting…", with "Retry now" (on the retry cooldown) and, where the build offers the choice, "Switch to Simulated mode". No element is inserted into the page |
 * | The link is back | That toast is closed and "Reconnected to the Core" shows for `LIVE_RESYNCED_NOTICE_MS` |
 * | The session's role changed (`session.updated`, or learned by a permission refresh or at a reconnect) | ONE info toast, "Your role is now … The available actions have changed.", and the guards of the matched routes run again |
 *
 * A call the Core refused is not an event of the link: a 403 and a 429 leave the link where it
 * is, so neither shows the link notice (LB-10). Their wording is the presenter's
 * (`lib/core-errors.ts`).
 */
export function LiveNotices({ active }: LiveNoticesProps) {
  const live = useWebLive()
  return live === null ? null : <LiveNoticesBody live={live} active={active} />
}

function LiveNoticesBody({ live, active }: LiveNoticesProps & { live: WebLive }) {
  useSessionChangeNotice()
  return <LinkNotice live={live} active={active} />
}

/**
 * The link notice (§3.5). The link counts as down from the moment it is lost (OFFLINE, STALE)
 * until it is up again, through every retry of the socket in between, so one outage is one toast.
 *
 * A session that ended is not an outage. The notice is shown only while signed in, and it is
 * closed, without "Reconnected", when the shell leaves. And a socket the Core server itself ended
 * (close 4401: the session is over, or another sign-in with this browser replaced it) is not a
 * lost link either: the Live source then signs this console out, or opens the socket of the
 * session that owns the credential now, and there is nothing to reconnect to in between.
 */
function LinkNotice({ live, active }: LiveNoticesProps & { live: WebLive }) {
  const { t } = useTranslation()
  const link = useLiveLink()
  const { selectable, request, dialog } = useModeSwitch()
  // `end` is set by a close with 4401 until the next socket is asked for; it changes with the link.
  const lost = isLinkLost(link) && live.socketStatus().end === null
  // Derived while rendering (the pattern of the sidebar's `seenMode`): sticky through CONNECTING.
  const [down, setDown] = useState(lost)
  if (!down && lost) setDown(true)
  else if (down && isLinkUp(link)) setDown(false)

  const showing = active && down
  const wasShowing = useRef(false)
  useEffect(() => {
    if (wasShowing.current && !showing && active) toast.success(t('common.coreLink.restored'), { timeout: LIVE_RESYNCED_NOTICE_MS })
    wasShowing.current = showing
  }, [showing, active, t])

  const switchToSimulated = useCallback(() => request(CoreMode.SIMULATED), [request])
  return (
    <>
      {showing ? <LinkLostToast live={live} onUseSimulated={selectable ? switchToSimulated : null} /> : null}
      {dialog}
    </>
  )
}

interface LinkLostToastProps {
  live: WebLive
  /** "Switch to Simulated mode" (step 1 of §3.3), or `null` where the build offers no choice. */
  onUseSimulated: (() => void) | null
}

/**
 * The persistent toast of one outage: shown when this component mounts, updated in place while
 * its retry control cools down, closed when it unmounts. "Retry now" asks the Live source for a
 * new socket at once (CL-11a) on the existing cooldown (3 s, 6 s, 12 s, at most three), so the
 * control cannot hammer the Core server; the socket goes on retrying by itself all the same. A
 * toast the operator closed is not shown again for this outage.
 */
function LinkLostToast({ live, onUseSimulated }: LinkLostToastProps) {
  const { t } = useTranslation()
  const reconnect = useCallback(() => {
    live.reconnect('RETRY')
  }, [live])
  const { retry, cooldown, exhausted, canRetry } = useRetryCooldown(reconnect)
  const retryLabel = exhausted
    ? t('common.errors.maxRetries')
    : cooldown > 0
      ? t('common.actions.retryIn', { seconds: cooldown })
      : t('common.coreLink.retryNow')
  const description = useMemo(
    () =>
      onUseSimulated === null ? (
        t('common.coreLink.lostBody')
      ) : (
        <span className="dems-link-notice">
          <span>{t('common.coreLink.lostBody')}</span>
          <Button size="sm" variant="outline" onPress={onUseSimulated} data-testid="link-notice-use-simulated">
            {t('common.coreMode.switchConfirm.SIMULATED')}
          </Button>
        </span>
      ),
    [t, onUseSimulated],
  )

  const shown = useRef<{ key: string; closing: boolean } | null>(null)
  const dismissed = useRef(false)
  useEffect(() => {
    if (dismissed.current) return
    const title = t('common.coreLink.lostTitle')
    const options = { description, timeout: 0, actionProps: { children: retryLabel, isDisabled: !canRetry, onPress: retry } }
    const current = shown.current
    if (current !== null) {
      current.key = toast.update(current.key, title, { ...options, variant: 'danger' })
      return
    }
    const entry = { key: '', closing: false }
    entry.key = toast.danger(title, {
      ...options,
      onClose: () => {
        // Closed by the operator, not by this component: it stays closed for this outage.
        if (!entry.closing) dismissed.current = true
        if (shown.current === entry) shown.current = null
      },
    })
    shown.current = entry
  }, [t, description, retryLabel, canRetry, retry])

  useEffect(
    () => () => {
      const entry = shown.current
      if (entry === null) return
      entry.closing = true
      shown.current = null
      toast.close(entry.key)
    },
    [],
  )
  return null
}

const readSession = (live: WebLive | null) => live?.session ?? null

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((entry) => b.includes(entry))
}

/**
 * RC-1: the one place where the shell reacts to a change of the signed-in session.
 *
 * The Core server tells a role change twice: `session.updated` replaces the session of the Live
 * source (its role and its permission list), and a delta replaces the operator's row in the
 * replicated `operators` slice. Either can arrive first, and the guard of `/session/new` reads the
 * second while the guards of the administration routes read the first. So both are watched here,
 * each by comparing what was known with what is known now; that also finds a change the Live
 * source learned without `session.updated` (a permission refresh after a refusal, the session read
 * at a reconnect).
 *
 * | What changed | What the shell does |
 * |--------------|---------------------|
 * | The role of the signed-in operator, by whichever of the two said it first | ONE info toast names the new role. When the page that is open needs a permission the new role does not have, the toast also says that the console went back to the Dashboard |
 * | The role, the permission list, or who the operator is (another sign-in with this browser, heard on the open socket) | `router.invalidate()`: the guards of the matched routes run again and the one whose permission is gone redirects to `/dashboard` (CA-03 holds on TanStack Router 1.170: `invalidate` loads the matches again, `beforeLoad` included). Every other page stays, and nothing typed is discarded |
 *
 * The query bridge has emptied the `['core', …]` cache in the turn of the store update, before
 * this effect runs (RC-3). Nobody is signed out by a role change.
 */
function useSessionChangeNotice(): void {
  const { t } = useTranslation()
  const router = useRouter()
  const session = useLiveSelector(readSession)
  const operator = useSim(selectOperator)

  const known = useRef({ session, operator })
  /** The operator and role the last notice named, so the second of the two messages says nothing. */
  const announced = useRef<string | null>(null)
  useEffect(() => {
    const previous = known.current
    known.current = { session, operator }
    // Signed out, or the first run: nothing to compare. The leave path of a session end is `AppLayout`'s.
    if (session === null || previous.session === null) return

    const needed = routePermission(router.state.location.pathname)
    const announce = (operatorId: string, role: OperatorRole, left: boolean) => {
      const tag = `${operatorId}:${role}`
      if (announced.current === tag) return
      announced.current = tag
      toast.info(t('shell.roleNotice.changed', { role: t(`common.roles.${role}`) }), left ? { description: t('shell.roleNotice.pageLeft') } : undefined)
    }

    let changed = false
    const before = previous.session
    if (before !== session) {
      if (before.operator.id !== session.operator.id) changed = true
      else if (before.operator.role !== session.operator.role) {
        changed = true
        announce(session.operator.id, session.operator.role, needed !== null && before.permissions.includes(needed) && !session.permissions.includes(needed))
      } else if (!sameList(before.permissions, session.permissions)) changed = true
    }
    // The same operator's row with another role. (Another operator is found above, by the session.)
    const row = previous.operator
    if (row !== null && operator !== null && row.id === operator.id && row.role !== operator.role) {
      changed = true
      announce(operator.id, operator.role, needed !== null && roleHas(row.role, needed) && !roleHas(operator.role, needed))
    }
    if (changed) void router.invalidate()
  }, [session, operator, router, t])
}
