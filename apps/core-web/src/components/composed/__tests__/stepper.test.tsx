// Step 39: Stepper (01_specs §14.6 accessibility contract; 03_motion_spec M-C-09).
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Stepper, StepperStamp, type StepperStep } from '../stepper'
import { withProviders } from './test-utils'

afterEach(() => cleanup())

const WIZARD: StepperStep[] = [
  { id: 'details', label: 'Session details', status: 'done' },
  { id: 'checks', label: 'Pre-checks', status: 'active' },
  { id: 'start', label: 'Start', status: 'pending' },
]

const FINALIZATION = (active: number): StepperStep[] =>
  ['Finalize tracks', 'Calculate hashes', 'Build manifest', 'Encrypt evidence payload', 'Sign manifest', 'Store sealed evidence package'].map(
    (label, index) => ({
      id: `F${index}`,
      label,
      status: index < active ? 'done' : index === active ? 'active' : 'pending',
    }),
  )

describe('Stepper', () => {
  it('is an ordered list with aria-current="step" on the active step only (§14.6)', () => {
    render(withProviders(<Stepper steps={WIZARD} orientation="horizontal" variant="wizard" ariaLabel="Start New Session" />, { sim: null }))
    const list = screen.getByRole('list', { name: 'Start New Session' })
    expect(list.tagName.toLowerCase()).toBe('ol')
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items.map((item) => item.getAttribute('aria-current'))).toEqual([null, 'step', null])
    expect(items.map((item) => item.getAttribute('data-status'))).toEqual(['done', 'active', 'pending'])
    // Each step states its position and status for assistive technology.
    expect(within(items[0] as HTMLElement).getByText('1/3: Done')).toHaveClass('sr-only')
    expect(within(items[1] as HTMLElement).getByText('2/3: Active')).toBeInTheDocument()
  })

  it('numbers wizard badges, fills the connector of completed steps and draws the check', () => {
    render(withProviders(<Stepper steps={WIZARD} orientation="horizontal" variant="wizard" />, { sim: null }))
    const connectors = [...document.querySelectorAll('[data-step-connector]')]
    expect(connectors.map((c) => c.getAttribute('data-step-connector'))).toEqual(['filled', 'empty'])
    const badges = [...document.querySelectorAll('[data-step-badge]')]
    expect(badges.map((b) => b.getAttribute('data-step-badge'))).toEqual(['done', 'active', 'pending'])
    expect(badges[0]?.querySelector('svg path')).not.toBeNull()
    expect(badges[2]).toHaveTextContent('3')
  })

  it('shows a Spinner on the running pipeline step and advances in place', () => {
    const { rerender } = render(
      withProviders(<Stepper steps={FINALIZATION(1)} orientation="vertical" variant="pipeline" />, { sim: null }),
    )
    expect(screen.getByTestId('stepper')).toHaveAttribute('data-orientation', 'vertical')
    const active = document.querySelector('[data-status="active"]') as HTMLElement
    expect(active).toHaveAttribute('data-step', 'F1')
    expect(active.querySelector('[data-slot="spinner-icon"]')).not.toBeNull()

    rerender(withProviders(<Stepper steps={FINALIZATION(2)} orientation="vertical" variant="pipeline" />, { sim: null }))
    expect(document.querySelector('[aria-current="step"]')).toHaveAttribute('data-step', 'F2')
    expect(document.querySelectorAll('[data-step-connector="filled"]')).toHaveLength(2)
  })

  it('renders warn and error states', () => {
    render(
      withProviders(
        <Stepper
          steps={[
            { id: 'a', label: 'Lens 1', status: 'warn', description: 'MIC 2 clipping' },
            { id: 'b', label: 'Storage', status: 'error', description: 'Evidence storage full' },
          ]}
          orientation="vertical"
          variant="pipeline"
        />,
        { sim: null },
      ),
    )
    expect(screen.getByText('1/2: Warning')).toBeInTheDocument()
    expect(screen.getByText('2/2: Fault')).toBeInTheDocument()
    expect(screen.getByText('Evidence storage full')).toBeInTheDocument()
    expect(document.querySelector('[aria-current="step"]')).toBeNull()
  })

  it('is marked reduced under reduced motion (§8)', () => {
    render(withProviders(<Stepper steps={WIZARD} orientation="horizontal" variant="wizard" />, { sim: null, reduced: true }))
    expect(screen.getByTestId('stepper')).toHaveAttribute('data-motion', 'reduced')
  })
})

describe('StepperStamp', () => {
  it('shows the violet SEALED stamp when the pipeline ends', () => {
    const { rerender } = render(withProviders(<StepperStamp show={false} />, { sim: null }))
    expect(screen.queryByTestId('stepper-stamp')).toBeNull()
    rerender(withProviders(<StepperStamp show />, { sim: null }))
    expect(screen.getByTestId('stepper-stamp')).toHaveTextContent('Sealed')
  })
})
