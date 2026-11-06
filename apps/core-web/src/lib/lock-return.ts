/**
 * "Lock console" returns to the page that was locked (fix wave J, driver J-W; findings JT-18 / JW-19).
 *
 * Lock console ends the session on the Core (no operation keeps a locked session; the contract has
 * none), and the Login page says so honestly: "Console locked — sign in to continue" (ruling D244:
 * a distinct notice, the same words on the devices). What was
 * wrong for a LOCK is that the next sign-in opened the Dashboard, not the page that was locked. The
 * user menu marks the lock here; the shell layout takes the mark when it leaves for the Login page
 * and carries the page in `?redirect=`, exactly as it does after the idle expiry.
 *
 * One boolean in memory: nothing about the operator is kept, and a reload forgets it.
 */
let locked = false

/** The operator pressed "Lock console". */
export function markConsoleLocked(): void {
  locked = true
}

/** True once after a lock; the mark is cleared by the read. */
export function takeConsoleLocked(): boolean {
  const was = locked
  locked = false
  return was
}
