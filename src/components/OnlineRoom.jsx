import { useEffect, useRef, useState } from 'react'
import * as api from '@api'
import { legalActions, apply } from '../engine/game.js'
import { TURN_MS } from '../server/rooms.js'
import { displayName } from '../api/shared.js'
import { actionText } from '../texts.js'
import Table from './Table.jsx'
import Avatar from './Avatar.jsx'
import { LevelBadge, RatingResult } from './Ranking.jsx'

/** Sala online: espera de jugadores y mesa. `room` es mi vista (llega en tiempo real). */
export default function OnlineRoom({ room, profile, people, onBack, onView, onOpenPlayer }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [bubbles, setBubbles] = useState({})
  const seen = useRef({ handNo: null, len: 0 })
  const [optimistic, setOptimistic] = useState(null) // jugada propia mostrada antes de que conteste el servidor
  const [deadline, setDeadline] = useState(null)
  const [levels, setLevels] = useState({}) // puntos (y nivel) de quienes están en la mesa
  const userIds = room.seats.filter((s) => s.type === 'user').map((s) => s.userId).join(',')
  useEffect(() => {
    if (room.visibility !== 'public' || !userIds) return
    api.ratingsByIds(userIds.split(',')).then(setLevels).catch(() => {})
  }, [userIds, room.visibility])

  // Cada vez que cambia la partida arranca el tiempo de la jugada siguiente
  useEffect(() => {
    setOptimistic(null)
    setDeadline(room.status === 'playing' ? Date.now() + TURN_MS : null)
  }, [room.version, room.status])

  // Por si se pierde un aviso en tiempo real: cada 4 segundos se fija si hay algo nuevo
  useEffect(() => {
    if (room.status !== 'playing' && room.status !== 'waiting') return
    const id = setInterval(() => {
      api
        .getRoomView(room.id, profile.id)
        .then((v) => v && v.version > room.version && onView(v))
        .catch(() => {})
    }, 4000)
    return () => clearInterval(id)
  }, [room.id, room.version, room.status, profile.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const expire = () => {
    // Se acabó el tiempo: le pedimos al servidor que juegue la compu por quien no jugó
    api
      .timeoutRoom(room.id)
      .then((v) => onView(v))
      .catch(() => setDeadline(Date.now() + 2500)) // si el otro ya lo pidió, o todavía hay unos segundos, reintenta
  }

  const names = room.seats.map((s, i) => {
    if (i === room.mySeat) return 'Vos'
    if (s.type === 'cpu') return 'La compu'
    if (s.type === 'open') return 'Libre'
    const p = people[s.userId]
    const name = p ? p.first_name || p.username : 'Jugador'
    return s.away ? `${name} (compu)` : name
  })

  // Globitos con lo que dicen los demás (a partir del registro de la mano)
  const log = room.match?.log ?? []
  const handNo = room.match?.handNo
  useEffect(() => {
    const prev = seen.current
    const start = prev.handNo === handNo ? prev.len : 0
    const fresh = log.slice(start).filter((e) => ['call', 'accept', 'reject', 'achico', 'mazo', 'declare', 'buenas', 'timeout'].includes(e.t))
    seen.current = { handNo, len: log.length }
    if (prev.handNo === null) return // al abrir la sala no repetimos lo viejo
    for (const e of fresh) {
      if (e.seat === room.mySeat) continue
      const text =
        e.t === 'call'
          ? actionText({ type: 'call', call: e.call })
          : e.t === 'declare'
            ? `¡${e.points}!`
            : e.t === 'timeout'
              ? 'Se le acabó el tiempo'
              : actionText({ type: e.t })
      const id = Math.random()
      setBubbles((b) => ({ ...b, [e.seat]: { text, id } }))
      setTimeout(() => setBubbles((b) => (b[e.seat]?.id === id ? { ...b, [e.seat]: undefined } : b)), 2200)
    }
  }, [log.length, handNo]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setOptimistic(null)
      setError(e.message)
      setTimeout(() => setError(''), 3500)
    } finally {
      setBusy(false)
    }
  }

  // ----- Sala de espera -----
  if (room.status === 'waiting') {
    const isHost = room.hostId === profile.id
    const isPublic = room.visibility === 'public'
    const mine = room.seats[room.mySeat]
    const invitedNotJoined = mine?.type === 'user' && !mine.joined
    return (
      <main className="lobby">
        <button className="back" onClick={onBack}>
          ‹ Volver
        </button>
        <h2 className="page-title">{room.players === 2 ? 'Mano a mano' : 'De a cuatro'}</h2>
        <p className="muted">
          {isPublic ? 'Mesa pública' : 'Mesa privada'} · a {room.target ?? 30} · {room.flor ? 'con flor' : 'sin flor'}
          {isPublic ? ' · suma puntos' : ''}
        </p>
        <p className="code-line">
          Código de la mesa: <b className="code">{room.code}</b>
        </p>
        <ul className="lobby-seats">
          {room.seats.map((s, i) => (
            <li key={i} className="lobby-seat">
              <button
                className="person-open"
                disabled={s.type !== 'user'}
                onClick={() => onOpenPlayer?.(s.userId)}
                aria-label="Ver perfil"
              >
                <Avatar profile={s.type === 'user' ? people[s.userId] : { username: s.type === 'cpu' ? 'compu' : '?' }} size={38} />
              </button>
              <span className="person-text">
                <b>{i === room.mySeat ? 'Vos' : s.type === 'cpu' ? 'La compu' : s.type === 'open' ? 'Lugar libre' : displayName(people[s.userId])}</b>
                <span className="muted">
                  {room.players === 4 ? (i % 2 === room.mySeat % 2 ? 'Tu equipo' : 'Rivales') : i === room.mySeat ? '' : 'Rival'}
                </span>
                {isPublic && s.type === 'user' && <LevelBadge points={levels[s.userId]?.points ?? 0} />}
              </span>
              <span className={`tag ${s.type === 'cpu' || s.joined ? 'tag-ok' : ''}`}>
                {s.type === 'cpu' ? 'Lista' : s.type === 'open' ? (isPublic ? 'Libre' : 'Con el código') : s.joined ? 'Adentro' : 'Invitado'}
              </span>
            </li>
          ))}
        </ul>
        {error && <p className="form-error">{error}</p>}
        {invitedNotJoined ? (
          <div className="sheet-actions">
            <button className="btn btn-primary" disabled={busy} onClick={() => run(() => api.joinRoom({ roomId: room.id }))}>
              Entrar a jugar
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => run(async () => (await api.declineRoom(room.id), onBack()))}>
              No puedo
            </button>
          </div>
        ) : (
          <>
            <p className="muted">
              {isPublic
                ? 'La mesa está en la lista de mesas abiertas. Arranca sola cuando se llene.'
                : 'Esperando a que entren todos. La partida arranca sola cuando estén.'}
            </p>
            {isHost && !isPublic && (
              <button className="btn btn-ghost" disabled={busy} onClick={() => run(() => api.startRoom(room.id))}>
                Arrancar ya, la compu completa
              </button>
            )}
            <button className="btn btn-mazo" disabled={busy} onClick={() => run(async () => (await api.leaveRoom(room.id), onBack()))}>
              {isHost ? 'Cerrar la mesa' : 'Salir de la mesa'}
            </button>
          </>
        )}
      </main>
    )
  }

  if (room.status === 'cancelled') {
    return (
      <main className="lobby">
        <h2 className="page-title">Partida cancelada</h2>
        <p className="muted">
          {room.leftBy === profile.id ? 'Te fuiste de la partida.' : 'Alguien se fue de la partida.'}
        </p>
        <button className="btn btn-primary" onClick={() => (api.dismissRoom(room.id), onBack())}>
          Volver al inicio
        </button>
      </main>
    )
  }

  const match = optimistic?.version === room.version ? optimistic.match : room.match
  const actions = busy ? [] : legalActions(match, room.mySeat)
  const send = (a) => {
    // Mostrar la jugada al instante; el servidor confirma enseguida
    try {
      setOptimistic({ version: room.version, match: apply(room.match, room.mySeat, a) })
    } catch {
      /* si no se puede anticipar (necesita datos del servidor), se espera la respuesta */
    }
    run(async () => onView(await api.actRoom(room.id, a)))
  }
  const away = room.seats[room.mySeat]?.away && room.status === 'playing'
  return (
    <>
      {error && <p className="form-error floating">{error}</p>}
      {away && (
        <div className="away-banner" role="alert">
          <span>Se te acabó el tiempo: la compu está jugando por vos.</span>
          <button className="btn btn-primary btn-small" disabled={busy} onClick={() => run(async () => onView(await api.backRoom(room.id)))}>
            Volver a jugar
          </button>
        </div>
      )}
      <Table
        view={match}
        me={room.mySeat}
        actions={actions}
        names={names}
        bubbles={bubbles}
        onAct={send}
        onNextHand={() => run(() => api.actRoom(room.id, { type: 'next' }).then(onView).catch(() => {}))}
        timer={{ deadline, total: TURN_MS, onExpire: expire }}
        onRestart={null}
        matchExtra={room.visibility === 'public' ? <RatingResult roomId={room.id} userId={profile.id} /> : null}
        onQuit={() => (room.status === 'finished' ? (api.dismissRoom(room.id), onBack()) : onBack())}
        onBack={onBack}
      />
    </>
  )
}
