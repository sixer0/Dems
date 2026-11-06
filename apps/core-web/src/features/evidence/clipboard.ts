/**
 * Clipboard helper for the hash and ID copy buttons. Friendly toast on success and failure; the
 * failure is logged (no clipboard permission in some embedded browsers).
 */
import { toast } from '@heroui/react'
import { logEvidence } from './log'

export async function copyText(text: string, messages: { ok: string; failed: string }, source: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
    await navigator.clipboard.writeText(text)
    toast.success(messages.ok)
    return true
  } catch (error) {
    logEvidence('warn', source, error, { length: text.length })
    toast.danger(messages.failed)
    return false
  }
}
