/**
 * Copy and Download for the server strip and the Realtime panel. Each shows a friendly toast on
 * success and on failure (layer 1) and logs the failure (layer 2; no client log endpoint, D41(g)).
 * Nothing here touches the network: Download builds a Blob from the in-memory document.
 */
import { toast } from '@heroui/react'
import { logApiReference } from './log'

export async function copyToClipboard(text: string, messages: { ok: string; failed: string }, source: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
    await navigator.clipboard.writeText(text)
    toast.success(messages.ok)
    return true
  } catch (error) {
    logApiReference('warn', source, error, { length: text.length })
    toast.danger(messages.failed)
    return false
  }
}

/** Saves `text` as a file through a Blob URL (revoked right after the click). */
export function downloadText(
  text: string,
  fileName: string,
  messages: { ok: string; failed: string },
  source: string,
): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.rel = 'noopener'
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
    toast.success(messages.ok)
    return true
  } catch (error) {
    logApiReference('error', source, error, { fileName })
    toast.danger(messages.failed)
    return false
  }
}
