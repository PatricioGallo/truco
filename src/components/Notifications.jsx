// Notificaciones dentro de la app: un aviso arriba cuando llega algo nuevo
// y una campanita con la lista completa.
import { useEffect, useRef, useState } from 'react'
import { displayName } from '../api/shared.js'
import Avatar from './Avatar.jsx'

const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* sin storage */
  }
}

/**
 * Arma la lista de notificaciones a partir de lo que ya sabe la app:
 * pedidos de amistad recibidos, amigos que aceptaron y partidas a las que te invitaron.
 */
export function useNotifications({ profile, friends, rooms, people }) {
  const key = (k) => `truco.notif.${k}.${profile.id}`
  // Amistades aceptadas: se detectan cuando un pedido enviado pasa a ser amigo
  const [accepted, setAccepted] = useState(() => read(key('accepted'), []))
  const prevOutgoing = useRef(null)
  useEffect(() => {
    const outgoingIds = friends.outgoing.map((f) => f.friendshipId)
    if (prevOutgoing.current) {
      const nowFriends = friends.friends.filter((f) => prevOutgoing.current.includes(f.friendshipId))
      if (nowFriends.length) {
        setAccepted((list) => {
          const next = [
            ...nowFriends.map((f) => ({ friendshipId: f.friendshipId, profile: f.profile, at: Date.now() })),
            ...list,
          ].slice(0, 20)
          write(key('accepted'), next)
          return next
        })
      }
    }
    prevOutgoing.current = outgoingIds
  }, [friends]) // eslint-disable-line react-hooks/exhaustive-deps

  const invites = rooms.filter(
    (r) => r.status === 'waiting' && r.seats[r.mySeat]?.type === 'user' && !r.seats[r.mySeat].joined
  )

  const items = [
    ...invites.map((r) => ({
      id: `inv-${r.id}`,
      kind: 'invite',
      room: r,
      profile: people[r.hostId],
      text: `${displayName(people[r.hostId]) || 'Un amigo'} te invitó a ${r.players === 2 ? 'un mano a mano' : 'jugar de a cuatro'}`,
    })),
    ...friends.incoming.map((f) => ({
      id: `fr-${f.friendshipId}`,
      kind: 'friend',
      friendshipId: f.friendshipId,
      profile: f.profile,
      text: `${displayName(f.profile)} te quiere agregar como amigo`,
    })),
    ...accepted.map((a) => ({
      id: `ok-${a.friendshipId}`,
      kind: 'accepted',
      friendshipId: a.friendshipId,
      profile: a.profile,
      text: `${displayName(a.profile)} aceptó tu pedido de amistad`,
    })),
  ]

  // Leídas (para la campanita) y ya avisadas (para no repetir el aviso de arriba)
  const [seen, setSeen] = useState(() => read(key('seen'), []))
  const unread = items.filter((i) => !seen.includes(i.id)).length
  const markAllSeen = () => {
    const ids = items.map((i) => i.id)
    setSeen(ids)
    write(key('seen'), ids)
  }
  const dismissAccepted = (friendshipId) =>
    setAccepted((list) => {
      const next = list.filter((a) => a.friendshipId !== friendshipId)
      write(key('accepted'), next)
      return next
    })

  const [toast, setToast] = useState(null)
  const toasted = useRef(new Set(read(key('toasted'), [])))
  useEffect(() => {
    const fresh = items.find((i) => !toasted.current.has(i.id))
    if (!fresh) return
    items.forEach((i) => toasted.current.add(i.id))
    write(key('toasted'), [...toasted.current].slice(-200))
    setToast({ ...fresh, shownAt: Date.now() })
    try {
      navigator.vibrate?.(60)
    } catch {
      /* nada */
    }
  }, [items.map((i) => i.id).join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast((x) => (x?.shownAt === toast.shownAt ? null : x)), 6000)
    return () => clearTimeout(t)
  }, [toast])

  // El aviso se arma con los datos más nuevos (ej.: el nombre de quien invita llega después)
  const liveToast = toast && { ...toast, ...(items.find((i) => i.id === toast.id) || {}) }
  return { items, unread, markAllSeen, dismissAccepted, toast: liveToast, closeToast: () => setToast(null) }
}

/** Botones de cada notificación (aceptar amistad, ver la partida...). */
function Actions({ item, onAcceptFriend, onRejectFriend, onOpenRoom, onDone }) {
  if (item.kind === 'friend')
    return (
      <span className="notif-actions">
        <button className="btn btn-small btn-accept" onClick={() => (onAcceptFriend(item.friendshipId), onDone?.())}>
          Aceptar
        </button>
        <button className="btn btn-small btn-ghost" onClick={() => (onRejectFriend(item.friendshipId), onDone?.())}>
          No
        </button>
      </span>
    )
  if (item.kind === 'invite')
    return (
      <span className="notif-actions">
        <button className="btn btn-small btn-primary" onClick={() => (onOpenRoom(item.room.id), onDone?.())}>
          Ver
        </button>
      </span>
    )
  return null
}

/** Aviso que baja desde arriba cuando llega algo nuevo. */
export function Toast({ notif, onClose, ...handlers }) {
  if (!notif.toast) return null
  const item = notif.toast
  return (
    <div className="notif-toast" role="alert" key={item.id}>
      <Avatar profile={item.profile} size={40} />
      <span className="notif-text">{item.text}</span>
      <Actions item={item} {...handlers} onDone={notif.closeToast} />
      <button className="notif-close" onClick={notif.closeToast} aria-label="Cerrar aviso">
        ×
      </button>
    </div>
  )
}

/** Campanita con la cantidad de notificaciones nuevas y la lista. */
export function Bell({ notif, ...handlers }) {
  const [open, setOpen] = useState(false)
  const toggle = () => {
    if (!open) notif.markAllSeen()
    setOpen((o) => !o)
  }
  return (
    <>
      <button className="bell" onClick={toggle} aria-label={`Notificaciones${notif.unread ? `: ${notif.unread} nuevas` : ''}`}>
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path
            d="M12 3a6 6 0 0 0-6 6v3.6L4.3 15.4A1 1 0 0 0 5.2 17h13.6a1 1 0 0 0 .9-1.6L18 12.6V9a6 6 0 0 0-6-6zm-2.5 15a2.5 2.5 0 0 0 5 0z"
            fill="currentColor"
          />
        </svg>
        {notif.unread > 0 && <span className="badge bell-badge">{notif.unread}</span>}
      </button>
      {open && (
        <div className="notif-backdrop" onClick={() => setOpen(false)}>
          <div className="notif-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Notificaciones</h3>
            {notif.items.length === 0 ? (
              <p className="muted">No tenés notificaciones. Acá te avisamos cuando te inviten a jugar o te agreguen.</p>
            ) : (
              <ul className="notif-list">
                {notif.items.map((item) => (
                  <li key={item.id} className="notif-item">
                    <Avatar profile={item.profile} size={38} />
                    <span className="notif-text">{item.text}</span>
                    {item.kind === 'accepted' ? (
                      <button className="notif-close" onClick={() => notif.dismissAccepted(item.friendshipId)} aria-label="Borrar">
                        ×
                      </button>
                    ) : (
                      <Actions item={item} {...handlers} onDone={() => setOpen(false)} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  )
}
