/**
 * The console's one Blob-URL download (FXR-W, finding W92-7 of
 * `verification/11_code_review_shared_web.md`; decision D242; D182).
 *
 * Four near-copies (the Evidence export, the API Reference download, the System log export and the
 * Security & Audit export) revoked their URL after 30 s, 0 ms and 1 s. Revoking in the same turn as
 * `click()` can cancel the download in some browsers (a hypothesis of the review, not tested in a
 * browser here), so every download now goes through `downloadBlob`, which revokes after
 * `DOWNLOAD_REVOKE_DELAY_MS`, long enough for a large export zip to be handed over.
 *
 * Nothing here touches the network: the bytes are already in memory.
 */

/** How long a download's Blob URL lives after the click (at least 1 s, by the finding). */
export const DOWNLOAD_REVOKE_DELAY_MS = 30_000

/** Whether this page can create Blob URLs (a test page or an old engine may not). */
export function canDownload(): boolean {
  return typeof URL.createObjectURL === 'function'
}

/**
 * Hands `blob` to the browser as the file `fileName`. Throws when the platform cannot create a Blob
 * URL (the caller's own error path says so to the operator).
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.append(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    // `revokeObjectURL` is optional only because a test page (jsdom) may lack it.
    setTimeout(() => URL.revokeObjectURL?.(url), DOWNLOAD_REVOKE_DELAY_MS)
  }
}

/** `data` as pretty-printed JSON (two spaces), downloaded as `fileName`. */
export function downloadJsonFile(fileName: string, data: unknown): void {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), fileName)
}
