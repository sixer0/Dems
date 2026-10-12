/**
 * A PAGE THE BROWSER RESTORED FROM ITS BACK / FORWARD CACHE IS LOADED AGAIN (fix wave J, driver J-W;
 * finding JW-15). After "Sign out", the browser's Back could bring back a page as it stood - the
 * operator's name in the header, the supervisor's navigation - and a page that does not poll (API
 * Reference) kept it for many seconds. A restored document (`pageshow` with `persisted: true`) holds
 * a replica and a session that may be gone, so it is reloaded: the start-up then reads the session
 * from the Core and the guard of the shell decides, as for any page load. Installed by the shell layout
 * (`app-layout.tsx`) while it is mounted; the returned function removes the listener.
 */
export function installRestoredPageGuard(target: Pick<Window, 'addEventListener' | 'removeEventListener'> & { location: Pick<Location, 'reload'> } = window): () => void {
  const onShow = (event: Event) => {
    if ((event as PageTransitionEvent).persisted === true) target.location.reload()
  }
  target.addEventListener('pageshow', onShow)
  return () => target.removeEventListener('pageshow', onShow)
}
