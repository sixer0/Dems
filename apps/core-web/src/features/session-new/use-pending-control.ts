// Plan row W0, item 2: the one pending-control hook now lives in `@/lib/pending-control` (this folder's
// page imports it from there); this line keeps the folder's file that W64's tests read.
export { usePendingControl, type PendingControl } from '@/lib/pending-control'
