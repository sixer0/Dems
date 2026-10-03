import { createFileRoute } from '@tanstack/react-router'
import { SessionMonitorPage } from '@/features/session-monitor'

/** `/session`: Session Monitor (masterplan/01_specs.md §14.2, §14.5.2); NO SESSION state when idle. */
export const Route = createFileRoute('/_app/session/')({ component: SessionMonitorPage })
