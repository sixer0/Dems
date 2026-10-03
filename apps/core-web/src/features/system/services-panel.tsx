import type { ReactNode } from 'react'
import { Chip, Table } from '@heroui/react'
import { motion } from 'motion/react'
import { Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { selectClockSecond, useSim, type ServiceEntry, type SimState } from '@dems/shared/sim'
import { useMotionPolicy } from '@/motion'
import { PANEL_BEAT_MS, useRowDelay } from './choreography'
import { countServices, formatUptime, SERVICE_TONE } from './model'
import { SystemPanel } from './panel'
import { selectServicesSince } from './sim-adapter'

const selectServices = (s: SimState): ServiceEntry[] => s.services

function Reveal({ delay, children }: { delay: number; children: ReactNode }) {
  const m = useMotionPolicy()
  return (
    <motion.span
      className="sys-reveal"
      initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...m.transitions.enter, delay }}
    >
      {children}
    </motion.span>
  )
}

/**
 * Services board (01_specs §14.5.8; design book §6.1 via 01_explore): the 16 Core services, names
 * verbatim, with the §6.1 responsibility, a status Chip (fault-derived by the sim) and the uptime
 * (the sim's `selectServicesSince`, 1 Hz). M-C-11: the first 10 rows stagger 30 ms; chips transition colour (400).
 */
export function ServicesPanel() {
  const { t } = useTranslation()
  const services = useSim(selectServices)
  const since = useSim(selectServicesSince)
  const nowSecond = useSim(selectClockSecond)
  const rowDelay = useRowDelay(PANEL_BEAT_MS.services)
  const counts = countServices(services.map((service) => service.status))
  const uptime = formatUptime(nowSecond * 1000 - since)

  return (
    <SystemPanel
      id="services"
      icon={Server}
      title={t('system.services.title')}
      action={
        <span className="sys-headline" data-testid="system-services-summary">
          <span className="sys-headline-strong">{t('system.services.summary', { running: counts.running, total: counts.total })}</span>
        </span>
      }
    >
      <Table variant="secondary" className="sys-services-table">
        <Table.ScrollContainer>
          <Table.Content aria-label={t('system.services.tableLabel')}>
            <Table.Header>
              <Table.Column id="index" className="sys-col-index">
                {t('system.services.columns.index')}
              </Table.Column>
              <Table.Column id="service" isRowHeader>
                {t('system.services.columns.service')}
              </Table.Column>
              <Table.Column id="status" className="sys-col-status">
                {t('system.services.columns.status')}
              </Table.Column>
              <Table.Column id="uptime" className="sys-col-uptime">
                {t('system.services.columns.uptime')}
              </Table.Column>
            </Table.Header>
            <Table.Body>
              {services.map((service, index) => {
                const delay = rowDelay(index)
                const responsibilityKey = `system.services.responsibility.${service.id}` as 'system.services.responsibility.SVC-01'
                return (
                  <Table.Row key={service.id} id={service.id} data-testid={`system-service-${service.id}`} data-status={service.status}>
                    <Table.Cell>
                      <Reveal delay={delay}>
                        <span className="sys-mono sys-muted">{String(index + 1).padStart(2, '0')}</span>
                      </Reveal>
                    </Table.Cell>
                    <Table.Cell>
                      <Reveal delay={delay}>
                        <span className="sys-service-name">{service.name}</span>
                        <span className="sys-service-role">{t(responsibilityKey, { defaultValue: '' })}</span>
                      </Reveal>
                    </Table.Cell>
                    <Table.Cell>
                      <Reveal delay={delay}>
                        <Chip size="sm" variant="soft" color={SERVICE_TONE[service.status]} className="sys-status-chip" data-tone={SERVICE_TONE[service.status]}>
                          <span className="sys-chip-dot" aria-hidden="true" />
                          <Chip.Label>{t(`common.serviceStatus.${service.status}`)}</Chip.Label>
                        </Chip>
                      </Reveal>
                    </Table.Cell>
                    <Table.Cell>
                      <Reveal delay={delay}>
                        <span className="sys-mono" data-testid={`system-uptime-${service.id}`}>
                          {service.status === 'STOPPED' ? '—' : uptime}
                        </span>
                      </Reveal>
                    </Table.Cell>
                  </Table.Row>
                )
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      <p className="sys-footnote">{t('system.services.uptimeNote')}</p>
    </SystemPanel>
  )
}
