/**
 * THE LINK BETWEEN THE SEALED PLAYER AND THE TRANSCRIPT OF ONE ITEM (fix wave J, driver J-W; findings
 * JT-10 / JW-12). The transcript did not follow the playback (no segment was marked at 0:14 or 0:20)
 * and a click on a segment did not seek (30.4 s after a click on "0:06-0:09"). Both sit on the same tab
 * and knew nothing of each other.
 *
 * A tiny store per evidence id, outside React state so a time update re-renders only the pane rows
 * that change: the player publishes its position (ms; null = no playback open) and takes seek
 * requests; the pane reads the position and asks for a seek. Nothing is kept beyond the page.
 */
import { useEffect, useEffectEvent, useSyncExternalStore } from 'react'

interface Link {
  positionMs: number | null
  readonly listeners: Set<() => void>
  readonly seekers: Set<(ms: number) => void>
}

const links = new Map<string, Link>()

function linkOf(evidenceId: string): Link {
  let link = links.get(evidenceId)
  if (link === undefined) {
    link = { positionMs: null, listeners: new Set(), seekers: new Set() }
    links.set(evidenceId, link)
  }
  return link
}

/** The player's position, in whole 250 ms steps (a segment row changes at most four times a second). */
export function publishPlaybackPosition(evidenceId: string, positionMs: number | null): void {
  const link = linkOf(evidenceId)
  const next = positionMs === null ? null : Math.floor(positionMs / 250) * 250
  if (link.positionMs === next) return
  link.positionMs = next
  for (const listener of link.listeners) listener()
}

/** Asks the player of `evidenceId` to go to `ms`. False: no player is listening (the caller says so). */
export function requestPlaybackSeek(evidenceId: string, ms: number): boolean {
  const link = linkOf(evidenceId)
  if (link.seekers.size === 0) return false
  for (const seeker of link.seekers) seeker(ms)
  return true
}

/** The position the player of `evidenceId` published, or null. */
export function usePlaybackPosition(evidenceId: string): number | null {
  return useSyncExternalStore(
    (listener) => {
      const link = linkOf(evidenceId)
      link.listeners.add(listener)
      return () => link.listeners.delete(listener)
    },
    () => linkOf(evidenceId).positionMs,
    () => null,
  )
}

/** The player's side: `onSeek` is called for every request while the player is mounted. */
export function usePlaybackSeekRequests(evidenceId: string, onSeek: (ms: number) => void): void {
  const handle = useEffectEvent(onSeek)
  useEffect(() => {
    const link = linkOf(evidenceId)
    const seeker = (ms: number) => handle(ms)
    link.seekers.add(seeker)
    return () => {
      link.seekers.delete(seeker)
      publishPlaybackPosition(evidenceId, null)
    }
  }, [evidenceId])
}

/** The index of the segment that holds `positionMs` (start inclusive, end exclusive), or null. Pure. */
export function activeSegmentIndex(segments: readonly { readonly index: number; readonly startMs: number; readonly endMs: number }[], positionMs: number | null): number | null {
  if (positionMs === null) return null
  for (const segment of segments) if (positionMs >= segment.startMs && positionMs < segment.endMs) return segment.index
  return null
}
