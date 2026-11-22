import { useEffect, useRef, useState } from 'react'
import * as api from '@api'
import { legalActions } from '../engine/game.js'
import { displayName } from '../api/shared.js'
import { actionText } from '../texts.js'
import Table from './Table.jsx'
import Avatar from './Avatar.jsx'

/** Sala online: espera de jugadores y mesa. `room` es mi vista (llega en tiempo real). */
export default function OnlineRoom({ room, profile, people, onBack }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [bubbles, setBubbles] = useState({})
  const seen = useRef({ handNo: null, len: 0 })

  const names = room.seats.map((s, i) => {
    if (i === room.mySeat) return 'Vos'
    if (s.type === 'cpu') return 'La compu'
    if (s.type === 'open') return 'Libre'
    const p = people[s.userId]
    return p ? p.first_name || p.username : 'Jugador'
  })

  // Globitos con lo que dicen los demás (a partir del registro de la mano)
  const log = room.match?.log ?? []
  const handNo = room.match?.handNo
  useEffect(() => {
    const prev = seen.current
    const start = prev.handNo === handNo ? prev.len : 0
    const fresh = log.slice(start).filter((e) => ['call', 'accept', 'reject', 'achico', 'mazo', 'declare', 'buenas'].includes(e.t))
    seen.current = { handNo, len: log.length }
    if (prev.handNo === null) return // al abrir la sala no repetimos lo viejo
    for (const e of fresh) {
      if (e.seat === room.mySeat) continue
      const text =
        e.t === 'call'
          ? actionText({ type: 'call', call: e.call })
          : e.t === 'declare'
            ? `¡${e.points}!`
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
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // ----- Sala de espera -----
  if (room.status === 'waiting') {
    const isHost = room.hostId === profile.id
    const mine = room.seats[room.mySeat]
    const invitedNotJoined = mine?.type === 'user' && !mine.joined
    return (
      <main className="lobby">
        <button className="back" onClick={onBack}>
          ‹ Volver
        </button>
        <h2 className="page-title">{room.players === 2 ? 'Mano a mano' : 'De a cuatro'}</h2>
        <p className="code-line">
          Código de la sala: <b className="code">{room.code}</b>
        </p>
        <ul className="lobby-seats">
          {room.seats.map((s, i) => (
            <li key={i} className="lobby-seat">
              <Avatar profile={s.type === 'user' ? people[s.userId] : { username: s.type === 'cpu' ? 'compu' : '?' }} size={38} />
              <span className="person-text">
                <b>{i === room.mySeat ? 'Vos' : s.type === 'cpu' ? 'La compu' : s.type === 'open' ? 'Lugar libre' : displayName(people[s.userId])}</b>
                <span className="muted">
                  {room.players === 4 ? (i % 2 === room.mySeat % 2 ? 'Tu equipo' : 'Rivales') : i === room.mySeat ? '' : 'Rival'}
                </span>
              </span>
              <span className={`tag ${s.type === 'cpu' || s.joined ? 'tag-ok' : ''}`}>
                {s.type === 'cpu' ? 'Lista' : s.type === 'open' ? 'Con el código' : s.joined ? 'Adentro' : 'Invitado'}
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
            <p className="muted">Esperando a que entren todos. La partida arranca sola cuando estén.</p>
            {isHost && (
              <button className="btn btn-ghost" disabled={busy} onClick={() => run(() => api.startRoom(room.id))}>
                Arrancar ya, la compu completa
              </button>
            )}
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

  const actions = busy ? [] : legalActions(room.match, room.mySeat)
  return (
    <>
      {error && <p className="form-error floating">{error}</p>}
      <Table
        view={room.match}
        me={room.mySeat}
        actions={actions}
        names={names}
        bubbles={bubbles}
        onAct={(a) => run(() => api.actRoom(room.id, a))}
        onNextHand={() => run(() => api.actRoom(room.id, { type: 'next' }).catch(() => {}))}
        onRestart={null}
        onQuit={() => (room.status === 'finished' ? (api.dismissRoom(room.id), onBack()) : onBack())}
        onBack={onBack}
      />
    </>
  )
}
