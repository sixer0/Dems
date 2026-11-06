/**
 * The one way to start a Core command (or a query refresh) from an effect (plan row W0, item 1;
 * finding F69-1, decision D158 DC-2).
 *
 * The console renders under React StrictMode (`main.tsx`), and Live mode exists only in dev builds,
 * where StrictMode runs every effect twice on mount (set-up, clean-up, set-up). A command sent from
 * the set-up is therefore sent TWICE in every Live session; in Simulated mode the simulator answers
 * inside the first set-up, so a guard kept in a ref is already cleared when the second one runs.
 *
 * `deferEffectStart(start)` schedules `start` one task later and returns the clean-up that cancels
 * it. StrictMode's clean-up runs before that task, so only the second set-up's start remains: one
 * command. A production build (no double run) starts one task later than a synchronous call, which
 * no operator can see.
 *
 * Use it as the effect's return value, after the effect's own conditions:
 *
 * ```ts
 * useEffect(() => {
 *   if (!wanted) return undefined
 *   return deferEffectStart(() => {
 *     settle(() => actions.verify(id), { fail: (error) => { if (presentCoreError(error) !== null) return; ... } })
 *   })
 * }, [wanted, id])
 * ```
 *
 * A change of the effect's dependencies within that task cancels the pending start and schedules
 * the new one, so a guard that must hold for the command itself (an in-flight marker) is checked and
 * set inside `start`. `start` handles its own failures (`settle`'s `fail`, the presenter first):
 * nothing here catches. `src/test/live-strict-mode-starts.test.tsx` fails the workspace when a file
 * under `features/` starts a command from an effect without returning this helper.
 */
export function deferEffectStart(start: () => void): () => void {
  const handle = setTimeout(start, 0)
  return () => clearTimeout(handle)
}
