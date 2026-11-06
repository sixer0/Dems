/**
 * Copy and Download for the server strip and the Realtime panel. Each shows a friendly toast on
 * success and on failure (layer 1) and writes the failure to the page's own log (layer 2; no client
 * log endpoint, D41(g); a fixed sentence and the cause's class, never the copied text, AR-9).
 * Nothing here touches the network: Download builds a Blob from the in-memory document.
 */
import { toast } from '@heroui/react'
import { downloadBlob } from '@/lib/download'
import { logApiReference } from './log'

export async function copyToClipboard(text: string, messages: { ok: string; failed: string }, source: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
    await navigator.clipboard.writeText(text)
    toast.success(messages.ok)
    return true
  } catch (error) {
    logApiReference('warn', source, error, 'The clipboard did not take the text.')
    toast.danger(messages.failed)
    return false
  }
}

/** Saves `text` as a file through the console's one Blob-URL download (`lib/download.ts`, W92-7: revoked after 30 s, no longer in the click's turn). */
export function downloadText(
  text: string,
  fileName: string,
  messages: { ok: string; failed: string },
  source: string,
): boolean {
  try {
    downloadBlob(new Blob([text], { type: 'application/json' }), fileName)
    toast.success(messages.ok)
    return true
  } catch (error) {
    logApiReference('error', source, error, 'The file could not be created.')
    toast.danger(messages.failed)
    return false
  }
}
