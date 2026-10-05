/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W0, item 2 (decision D153 ruling 5): the one pending-control hook, `@/lib/pending-control`,
// on its own (backend task 04_client_integration_spec §8.1 LB-1, LB-2, LB-4; AC-C-57, AC-C-58). The
// page behaviour is proven where it always was, unchanged: W64's fake-timer test
// (`live-session-new-pending.test.tsx`), W65's, W69's, W63's, W70's and W71's pending tests.
//
// | Criterion | Where |
// |-----------|-------|
// | A command that settles in the press (Simulated mode) changes nothing: no state, no render, no mark, no `onWait` | "settled in the press" |
// | The press guard: one command per control; a second press sends nothing and returns `false` | "the press guard" |
// | The reveal: no spinner at 300 ms, the spinner at 500 ms (the 420 ms token), scaled by the motion policy | "the reveal" |
// | The busy mark: `aria-busy="true"` on the element of `ref` from the press until the release, nothing else touched | "the busy mark" |
// | `settle(action, handlers)`: the shared `settle`, `onWait` once when the outcome is not known, `done` after the release | "the settle entry" |
// | `key`, a start that throws, an unmount while busy | "edges" |
// | Item 3: the kit's `Button` drops an `aria-busy` prop (so the mark is written through `ref`) | "item 3" |
// | The old copies are gone: no page folder holds its own press guard + late reveal | "one copy" |
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, render, renderHook } from '@testing-library/react'
import { useEffect, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from '@heroui/react'
import { LIVE_PENDING_REVEAL_MS } from '@dems/shared/live'
import { usePendingControl, usePendingReveal, type PendingControl } from '@/lib/pending-control'
import { MotionPolicyContext, STATIC_MOTION_POLICY } from '@/motion/use-motion-policy'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** The control rendered with its `ref` on a real button; `onCommit` gets it after every commit. */
function Host({ onCommit }: { onCommit: (control: PendingControl) => void }) {
  const control = usePendingControl()
  const { ref } = control
  useEffect(() => {
    onCommit(control)
  })
  return (
    <button type="button" ref={ref} data-testid="control">
      icon
    </button>
  )
}

/** A control on a real button, the latest value of the hook, how often the host committed, and every committed (busy, pending). */
function mountControl(timeScale = 1) {
  const seen: { control: PendingControl | null; renders: number; history: { busy: boolean; pending: boolean }[] } = { control: null, renders: 0, history: [] }
  const onCommit = (control: PendingControl) => {
    seen.control = control
    seen.renders += 1
    seen.history.push({ busy: control.busy, pending: control.pending })
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MotionPolicyContext.Provider value={{ ...STATIC_MOTION_POLICY, timeScale }}>{children}</MotionPolicyContext.Provider>
  )
  const view = render(<Host onCommit={onCommit} />, { wrapper })
  const button = view.getByTestId('control')
  return { seen, button, control: () => seen.control!, view }
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('settled in the press (every Simulated command): nothing of the control changes', () => {
  it('`run` with a start that releases at once: started, no state, no new render, no mark', () => {
    const { seen, button, control } = mountControl()
    const before = seen.renders
    let started = false
    act(() => {
      started = control().run((release) => release(), 'EV-1')
    })
    expect(started).toBe(true)
    expect(seen.renders).toBe(before)
    expect(control().busy).toBe(false)
    expect(control().pending).toBe(false)
    expect(control().key).toBeNull()
    expect(button).not.toHaveAttribute('aria-busy')
  })

  it('`settle` with a plain value: `ok` and `done` run in the press, `onWait` never, no new render', () => {
    const { seen, control } = mountControl()
    const before = seen.renders
    const order: string[] = []
    act(() => {
      control().settle(() => 42, {
        ok: (value) => order.push(`ok ${value}`),
        fail: () => order.push('fail'),
        done: () => order.push('done'),
        onWait: () => order.push('wait'),
      })
    })
    expect(order).toEqual(['ok 42', 'done'])
    expect(seen.renders).toBe(before)
  })

  it('a refusal thrown in the press goes to `fail`, then `done`; a second press is accepted at once', () => {
    const { control } = mountControl()
    const order: string[] = []
    act(() => {
      control().settle(
        () => {
          throw new Error('refused')
        },
        { fail: (error) => order.push(`fail ${(error as Error).message}`), done: () => order.push('done') },
      )
    })
    let again = false
    act(() => {
      again = control().run((release) => release())
    })
    expect(order).toEqual(['fail refused', 'done'])
    expect(again).toBe(true)
  })
})

describe('the press guard: one command per control', () => {
  it('while a command is out, a second `run` and a second `settle` return `false` and start nothing', () => {
    const { control } = mountControl()
    let release: () => void = () => undefined
    act(() => {
      control().run((done) => {
        release = done
      })
    })
    const second = vi.fn()
    let accepted = true
    act(() => {
      accepted = control().run(second)
    })
    expect(accepted).toBe(false)
    expect(second).not.toHaveBeenCalled()
    const action = vi.fn(() => 1)
    act(() => {
      accepted = control().settle(action, { fail: () => undefined })
    })
    expect(accepted).toBe(false)
    expect(action).not.toHaveBeenCalled()
    act(() => release())
    act(() => {
      accepted = control().run((done) => done())
    })
    expect(accepted).toBe(true)
  })

  it('a release called twice frees the control once (the second call changes nothing)', () => {
    const { control } = mountControl()
    let release: () => void = () => undefined
    act(() => {
      control().run((done) => {
        release = done
      })
    })
    act(() => release())
    let holder: () => void = () => undefined
    act(() => {
      control().run((done) => {
        holder = done
      })
    })
    expect(control().busy).toBe(true)
    // The FIRST command's release, called again: the second command stays out.
    act(() => release())
    expect(control().busy).toBe(true)
    act(() => holder())
    expect(control().busy).toBe(false)
  })
})

describe('the reveal: busy at once, the spinner after the token, scaled by the motion policy', () => {
  it('the token is 420 ms, between the 300 ms and 500 ms checkpoints of W64', () => {
    expect(LIVE_PENDING_REVEAL_MS).toBe(420)
  })

  it('busy at once; not pending at 300 ms (or at 419 ms); pending at 420 ms; both cleared by the release', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { control } = mountControl()
    let release: () => void = () => undefined
    act(() => {
      control().run((done) => {
        release = done
      })
    })
    expect(control().busy).toBe(true)
    expect(control().pending).toBe(false)
    await advance(300)
    expect(control().pending).toBe(false)
    await advance(119)
    expect(control().pending).toBe(false)
    await advance(1)
    expect(control().pending).toBe(true)
    act(() => release())
    expect(control().busy).toBe(false)
    expect(control().pending).toBe(false)
  })

  it('the spinner leaves in the same commit as the command: no committed state is pending without being busy', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { seen, control } = mountControl()
    let release: () => void = () => undefined
    act(() => {
      control().run((done) => {
        release = done
      })
    })
    await advance(500)
    expect(control().pending).toBe(true)
    act(() => release())
    await advance(0)
    expect(seen.history.some((state) => state.pending)).toBe(true)
    expect(seen.history.filter((state) => state.pending && !state.busy)).toEqual([])
    expect(seen.history.at(-1)).toEqual({ busy: false, pending: false })
  })

  it('an answer after 50 ms: never pending', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { control } = mountControl()
    let release: () => void = () => undefined
    const pendingSeen: boolean[] = []
    act(() => {
      control().run((done) => {
        release = done
      })
    })
    await advance(50)
    act(() => release())
    for (let step = 0; step < 10; step += 1) {
      await advance(100)
      pendingSeen.push(control().pending)
    }
    expect(pendingSeen.every((value) => !value)).toBe(true)
  })

  it('proof mode (time scale 2): pending only at 840 ms', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { control } = mountControl(2)
    act(() => {
      control().run(() => undefined)
    })
    await advance(839)
    expect(control().pending).toBe(false)
    await advance(1)
    expect(control().pending).toBe(true)
  })

  it('`usePendingReveal(busy)` on its own (the Devices page\'s keyed list): false while idle, true only after the token', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { result, rerender } = renderHook(({ busy }: { busy: boolean }) => usePendingReveal(busy), { initialProps: { busy: false } })
    await advance(1_000)
    expect(result.current).toBe(false)
    rerender({ busy: true })
    await advance(419)
    expect(result.current).toBe(false)
    await advance(1)
    expect(result.current).toBe(true)
    rerender({ busy: false })
    expect(result.current).toBe(false)
    rerender({ busy: true })
    expect(result.current).toBe(false)
  })
})

describe('the busy mark: `aria-busy` on the pressed control through `ref`', () => {
  it('set at the press, removed at the release; the control\'s content and other attributes untouched', () => {
    const { button, control } = mountControl()
    const content = button.innerHTML
    const attributes = () => Array.from(button.attributes).map((attribute) => attribute.name).filter((name) => name !== 'aria-busy').sort()
    const others = attributes()
    let release: () => void = () => undefined
    act(() => {
      control().run((done) => {
        release = done
      })
    })
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button.innerHTML).toBe(content)
    expect(attributes()).toEqual(others)
    act(() => release())
    expect(button).not.toHaveAttribute('aria-busy')
    expect(attributes()).toEqual(others)
  })
})

describe('item 3 (F63-2): why the mark goes through `ref` and not through a prop', () => {
  it('the kit\'s `Button` (`@heroui/react` over React Aria) drops an `aria-busy` prop; a `data-*` prop and the ref reach the element', () => {
    const view = render(
      <Button aria-busy data-probe="kept">
        Save
      </Button>,
    )
    const element = view.getByRole('button')
    expect(element).not.toHaveAttribute('aria-busy')
    expect(element).toHaveAttribute('data-probe', 'kept')
    // If this ever fails, the kit forwards the prop: the hook may then return it instead of the ref.
  })
})

describe('the settle entry', () => {
  it('a Live result: `onWait` once right after the press; `ok` then `done` on the answer; `done` sees the control free', async () => {
    const { control } = mountControl()
    const order: string[] = []
    let answer: (value: string) => void = () => undefined
    const result = new Promise<string>((resolve) => {
      answer = resolve
    })
    act(() => {
      control().settle(() => result, {
        ok: (value) => order.push(`ok ${value}`),
        fail: () => order.push('fail'),
        done: () => {
          order.push('done')
          // The control is released before `done`: a press from here is accepted.
          order.push(`accepted ${String(control().run((release) => release()))}`)
        },
        onWait: () => order.push('wait'),
      })
    })
    expect(order).toEqual(['wait'])
    expect(control().busy).toBe(true)
    await act(async () => {
      answer('PASS')
      await result
    })
    expect(order).toEqual(['wait', 'ok PASS', 'done', 'accepted true'])
    expect(control().busy).toBe(false)
  })

  it('a Live refusal: `fail` then `done`, the control free again', async () => {
    const { control } = mountControl()
    const order: string[] = []
    let refuse: (error: Error) => void = () => undefined
    const result = new Promise<never>((_, reject) => {
      refuse = reject
    })
    act(() => {
      control().settle(() => result, { fail: (error) => order.push(`fail ${(error as Error).message}`), done: () => order.push('done') })
    })
    await act(async () => {
      refuse(new Error('403'))
      await result.catch(() => undefined)
    })
    expect(order).toEqual(['fail 403', 'done'])
    expect(control().busy).toBe(false)
  })
})

describe('edges', () => {
  it('`key` names the command out, and is cleared with it', () => {
    const { control } = mountControl()
    let release: () => void = () => undefined
    act(() => {
      control().run((done) => {
        release = done
      }, 'EV-20260929-0001')
    })
    expect(control().key).toBe('EV-20260929-0001')
    act(() => release())
    expect(control().key).toBeNull()
  })

  it('a start that throws frees the control and the error reaches the caller', () => {
    const { control } = mountControl()
    expect(() =>
      act(() => {
        control().run(() => {
          throw new Error('boom')
        })
      }),
    ).toThrow('boom')
    let accepted = false
    act(() => {
      accepted = control().run((release) => release())
    })
    expect(accepted).toBe(true)
    expect(control().busy).toBe(false)
  })

  it('an unmount while busy leaves no timer behind', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { control, view } = mountControl()
    act(() => {
      control().run(() => undefined)
    })
    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('one copy: no page folder holds its own "busy at once, spinner late"', () => {
  const FEATURES = resolve(import.meta.dirname, '../features')
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return name === '__tests__' ? [] : files(path)
      return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : []
    })
  const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
  const LANDED = ['dashboard', 'session-new', 'session-monitor', 'evidence', 'devices', 'storage', 'network-time']

  it('the landed page folders read `LIVE_PENDING_REVEAL_MS` nowhere (the reveal is `@/lib/pending-control`\'s)', () => {
    const readers = LANDED.flatMap((folder) => files(join(FEATURES, folder)))
      .filter((path) => /\bLIVE_PENDING_REVEAL_MS\b/.test(code(readFileSync(path, 'utf8'))))
      .map((path) => path.slice(FEATURES.length + 1))
    expect(readers).toEqual([])
  })

  it('the hooks of W64, W65, W69 are gone or point at the shared one; every caller imports `@/lib/pending-control`', () => {
    const all = files(FEATURES).map((path) => ({ file: path.slice(FEATURES.length + 1), text: code(readFileSync(path, 'utf8')) }))
    expect(all.map(({ file }) => file)).not.toContain('session-monitor/use-pending-press.ts')
    expect(all.map(({ file }) => file)).not.toContain('evidence/use-pending-action.ts')
    expect(all.find(({ file }) => file === 'session-new/use-pending-control.ts')?.text.trim()).toBe(
      "export { usePendingControl, type PendingControl } from '@/lib/pending-control'",
    )
    const callers = all.filter(({ text }) => /\busePendingControl\(\)|\busePendingReveal\(/.test(text)).map(({ file }) => file).sort()
    // A minimum (decision D172, finding F77-2): every later page row is required to call the hook too.
    expect(callers).toEqual(expect.arrayContaining([
      'dashboard/devices-panel.tsx',
      'devices/audio-input-card.tsx',
      'devices/device-menu.tsx',
      'evidence/export-wizard.tsx',
      'evidence/use-archive.ts',
      'session-monitor/action-bar.tsx',
      'session-monitor/index.tsx',
      'session-monitor/live-feed-panel.tsx',
      'session-new/index.tsx',
      'storage/manage-drawer.tsx',
    ]))
    for (const file of callers) expect(all.find((entry) => entry.file === file)?.text, file).toMatch(/from '@\/lib\/pending-control'/)
  })
})
