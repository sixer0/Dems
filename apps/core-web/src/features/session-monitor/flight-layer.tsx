import { useCallback, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Chip } from '@heroui/react'
import { motion } from 'motion/react'
import { Bookmark } from 'lucide-react'
import { useMotionPolicy } from '@/motion'
import { FlightContext, type FlightRequest, type Launch } from './flight-context'

interface Flight extends FlightRequest {
  id: number
}


/** ≈520 ms spring `gentle` flight (M-C-17). */
const SNAPSHOT_SIZE = { width: 128, height: 72 }

/**
 * A fixed overlay (portal to `<body>`, so no transformed ancestor offsets it) that flies a small
 * element from one rectangle to another with translate and scale only (§9.2), then fades it at the
 * destination. Reduced motion or `sharedLayout` off: no flight, `onLand` fires at once.
 */
export function FlightLayer({ children }: { children: ReactNode }) {
  const m = useMotionPolicy()
  const [flights, setFlights] = useState<Flight[]>([])
  const nextId = useRef(1)
  const shared = m.flags.sharedLayout

  const launch = useCallback<Launch>(
    (request) => {
      if (!shared || typeof document === 'undefined') {
        request.onLand?.()
        return
      }
      const id = nextId.current++
      setFlights((current) => [...current, { ...request, id }])
    },
    [shared],
  )

  const land = useCallback((flight: Flight) => {
    flight.onLand?.()
    setFlights((current) => current.filter((item) => item.id !== flight.id))
  }, [])

  return (
    <FlightContext.Provider value={launch}>
      {children}
      {flights.length > 0 && typeof document !== 'undefined'
        ? createPortal(
            <div className="sm-flight-layer" aria-hidden="true">
              {flights.map((flight) => (
                <FlightElement key={flight.id} flight={flight} onLand={land} />
              ))}
            </div>,
            document.body,
          )
        : null}
    </FlightContext.Provider>
  )
}

function FlightElement({ flight, onLand }: { flight: Flight; onLand: (flight: Flight) => void }) {
  const m = useMotionPolicy()
  const isSnapshot = flight.kind === 'snapshot'
  const width = isSnapshot ? SNAPSHOT_SIZE.width : Math.min(220, Math.max(120, flight.from.width))
  const height = isSnapshot ? SNAPSHOT_SIZE.height : 30
  const startX = flight.from.left + flight.from.width / 2 - width / 2
  const startY = flight.from.top + flight.from.height / 2 - height / 2
  const endX = flight.to.left + flight.to.width / 2 - width / 2
  const endY = flight.to.top + flight.to.height / 2 - height / 2
  const endScale = isSnapshot ? 0.35 : 0.8

  return (
    <motion.div
      className="sm-flight"
      data-flight={flight.kind}
      style={{ left: startX, top: startY, width, height }}
      initial={{ x: 0, y: 0, scale: isSnapshot ? 1.6 : 1, opacity: 0 }}
      animate={{
        x: endX - startX,
        y: endY - startY,
        scale: endScale,
        opacity: [0, 1, 1, 0],
      }}
      transition={{
        x: m.transitions.enter,
        y: m.transitions.enter,
        scale: m.transitions.enter,
        opacity: { duration: m.seconds(620), times: [0, 0.12, 0.8, 1], ease: 'linear' },
      }}
      onAnimationComplete={() => onLand(flight)}
    >
      {isSnapshot ? (
        flight.image ? (
          <img src={flight.image} alt="" className="size-full rounded-md border border-accent/70 object-cover" />
        ) : (
          <span className="block size-full rounded-md border border-accent/70 bg-surface" />
        )
      ) : (
        <Chip color="accent" variant="soft" size="sm" className="h-full w-full justify-center gap-1.5 border border-accent/50">
          <Bookmark className="size-3.5" aria-hidden="true" />
          <Chip.Label className="truncate">{flight.label}</Chip.Label>
        </Chip>
      )}
    </motion.div>
  )
}
