import { useEffect, useState } from 'react'

/** Cuenta regresiva de la jugada. `deadline` es una hora (ms); al llegar a 0 llama a onExpire una vez. */
export default function TurnTimer({ deadline, total, mine, onExpire }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!deadline) return
    let fired = false
    const tick = () => {
      const t = Date.now()
      setNow(t)
      if (!fired && t >= deadline) {
        fired = true
        onExpire?.()
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [deadline]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!deadline) return null
  const left = Math.max(0, deadline - now)
  const secs = Math.ceil(left / 1000)
  const ratio = Math.min(1, left / total)
  return (
    <div className={`turn-timer ${secs <= 7 ? 'is-urgent' : ''} ${mine ? 'is-mine' : ''}`} role="timer" aria-live="off">
      <span className="turn-timer-bar">
        <i style={{ transform: `scaleX(${ratio})` }} />
      </span>
      <span className="turn-timer-text">
        {secs > 0 ? `${mine ? 'Te quedan' : 'Quedan'} ${secs} s` : mine ? 'Se acabó: juega la compu por vos' : 'Se acabó el tiempo'}
      </span>
    </div>
  )
}
