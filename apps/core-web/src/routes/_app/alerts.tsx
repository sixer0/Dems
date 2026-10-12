import { createFileRoute } from '@tanstack/react-router'
import { AlertsPage } from '@/features/alerts'

/** `/alerts`: every alert the Core holds, with its state and its acknowledgement (fix wave J, finding JW-21). */
export const Route = createFileRoute('/_app/alerts')({ component: AlertsPage })
