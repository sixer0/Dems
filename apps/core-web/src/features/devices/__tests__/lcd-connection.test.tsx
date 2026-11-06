import { cleanup, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, describe, expect, it } from 'vitest'
import type { LcdIntegrationStatus } from '@dems/shared/api'
import { createI18n } from '@/i18n'
import { LcdConnectionView } from '../lcd-connection'

afterEach(cleanup)
const connected: LcdIntegrationStatus = {
  backendUrl: 'http://127.0.0.1:8090', reachable: true, panelConnected: false,
  lastSyncAt: Date.now(), health: 'warn', error: null,
  channels: [{ channel: 1, track: 'VIDEO-01', recording: true, cameraConnected: true }],
}
function show(props: Partial<Parameters<typeof LcdConnectionView>[0]> = {}) {
  return render(<I18nextProvider i18n={createI18n()}><LcdConnectionView simulated={false} loading={false} failed={false} status={null} {...props} /></I18nextProvider>)
}
describe('LCD connection truth', () => {
  it('shows startup configuration when disabled', () => {
    show()
    expect(screen.getByText(/not configured/)).toBeInTheDocument()
    expect(screen.getByText(/DEMS_LCD_BACKEND_URL/)).toBeInTheDocument()
  })
  it('separates HTTP reachability from USB liveness', () => {
    show({ status: connected })
    expect(screen.getByText(/8090 · Reachable/)).toBeInTheDocument()
    expect(screen.getByText('No recent response')).toBeInTheDocument()
    expect(screen.getByText(/CH1 → VIDEO-01/)).toBeInTheDocument()
  })
  it('hides cached success on a failed read', () => {
    show({ status: connected, failed: true })
    expect(screen.getByRole('alert')).toHaveTextContent('could not be read')
    expect(screen.queryByText(/8090/)).not.toBeInTheDocument()
  })
  it('labels simulation as preview only', () => {
    show({ simulated: true })
    expect(screen.getByText(/Preview only/)).toBeInTheDocument()
  })
  it('reports a pending read', () => {
    show({ loading: true })
    expect(screen.getByRole('status')).toHaveTextContent('Reading LCD configuration')
  })
})
