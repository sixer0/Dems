// The control of the helper `press-outside.tsx` on its own: a dismissable kit Modal closes on the
// helper's press. Every JW-16 case calls the same control before it asserts "stayed open".
import { cleanup } from '@testing-library/react'
import { afterEach, describe, it } from 'vitest'
import { expectPressOutsideDismisses } from './press-outside'

afterEach(cleanup)

describe('pressOutside (test helper of JW-16)', () => {
  it('closes a kit Modal that is dismissable', async () => {
    await expectPressOutsideDismisses()
  })
})
