// A press OUTSIDE an open kit dialog, for the tests of finding JW-16 (fix wave J): the Revise, Connect
// and End Session dialogs must not close - and lose what was typed - on such a press. Not a test file;
// no production file imports it.
//
// | Export | What it gives a test |
// |--------|----------------------|
// | `pressOutside()` | One full pointer press and click on the overlay BEHIND the top dialog (its backdrop), else on the document body |
// | `expectPressOutsideDismisses()` | THE CONTROL of the helper: a kit Modal that IS dismissable closes on `pressOutside()`. A test calls it once, so "the dialog stayed open" cannot be an artefact of a press that reached nothing |
import type { ReactElement } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Modal } from '@heroui/react'
import { expect } from 'vitest'

const POINTER = { pointerId: 9, pointerType: 'mouse', button: 0, width: 1, height: 1, pressure: 0.5, bubbles: true } as const

/** The element behind the top dialog: the kit's backdrop / underlay of the last open overlay, else the body. */
function outsideTarget(): Element {
  const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]'))
  const top = dialogs.at(-1)
  let node: Element | null = top?.parentElement ?? null
  // Walk up to the outermost wrapper of the overlay that is a direct child of <body>: the backdrop.
  while (node !== null && node.parentElement !== null && node.parentElement !== document.body) node = node.parentElement
  return node ?? document.body
}

export async function pressOutside(): Promise<void> {
  const target = outsideTarget()
  await act(async () => {
    fireEvent.pointerDown(target, POINTER)
    fireEvent.mouseDown(target, { button: 0 })
    fireEvent.pointerUp(target, POINTER)
    fireEvent.mouseUp(target, { button: 0 })
    fireEvent.click(target, { button: 0 })
    await Promise.resolve()
  })
}

/** The control: the same press closes a dialog that is dismissable. Mounts and unmounts its own probe. */
export async function expectPressOutsideDismisses(): Promise<void> {
  const view = (open: boolean): ReactElement => (
    <Modal.Backdrop isOpen={open} onOpenChange={(next) => probe.rerender(view(next))} isDismissable>
      <Modal.Container>
        <Modal.Dialog aria-label="press-outside probe" data-testid="press-outside-probe">
          <Modal.Body>probe</Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
  const probe = render(view(true))
  await screen.findByTestId('press-outside-probe')
  await pressOutside()
  await waitFor(() => expect(screen.queryByTestId('press-outside-probe')).toBeNull())
  probe.unmount()
}
