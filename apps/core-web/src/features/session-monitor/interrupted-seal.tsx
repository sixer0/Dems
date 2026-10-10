import { useInterruptedSeal } from './use-interrupted-seal'

/** The status line of the seal dialog: the title, the cause, what the evidence holds. Draws nothing for any other session. */
export function InterruptedSealNotice({ sessionId }: { sessionId: string | null }) {
  const words = useInterruptedSeal(sessionId)
  if (words === null) return null
  return (
    <p className="sm-final-incomplete" role="status" data-testid="sm-interrupted-seal">
      {`${words.title}. ${words.cause} ${words.kept}`}
    </p>
  )
}
