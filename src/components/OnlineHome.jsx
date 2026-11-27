import { useEffect, useState } from 'react'
import * as api from '@api'
import { displayName } from '../api/shared.js'
import Avatar from './Avatar.jsx'
import { LevelBadge, LevelPanel, useMyRating } from './Ranking.jsx'

/** Mesas públicas esperando gente (se actualiza sola). */
function useOpenTables() {
  const [tables, setTables] = useState(null)
  const [hosts, setHosts] = useState({})
  const [hostLevels, setHostLevels] = useState({})
  useEffect(() => {
    let alive = true
    const load = () =>
      api
        .openTables()
        .then(async (list) => {
          if (!alive) return
          setTables(list)
          const ids = [...new Set(list.map((t) => t.host_id))]
          if (ids.length) {
            const [ps, rs] = await Promise.all([api.profilesByIds(ids), api.ratingsByIds(ids)])
            if (alive) {
              setHosts((h) => ({ ...h, ...Object.fromEntries(ps.map((p) => [p.id, p])) }))
              setHostLevels((l) => ({ ...l, ...rs }))
            }
          }
        })
        .catch(() => alive && setTables((t) => t ?? []))
    load()
    const unsub = api.subscribeLobby(load)
    const t = setInterval(load, 15000)
    return () => {
      alive = false
      unsub()
      clearInterval(t)
    }
  }, [])
  return { tables, hosts, hostLevels }
}

/** Vos en modo online: mesas abiertas, crear mesa, sumarse con código, amigos y partidas en curso. */
export default function OnlineHome({ profile, friends, rooms, onNew, onFriends, onOpenRoom, onJoinCode, onJoinTable, onRanking, onBack }) {
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [filter, setFilter] = useState(0) // 0 todas, 2 mano a mano, 4 de a cuatro
  const [joining, setJoining] = useState(null)
  const [joinError, setJoinError] = useState('')
  const [partner, setPartner] = useState('') // amigo con quien sumarse en dupla
  const { tables, hosts, hostLevels } = useOpenTables()
  const myRating = useMyRating(profile.id, rooms.filter((r) => r.status === 'finished').length)
  const mine = new Set(rooms.map((r) => r.id))
  const visible = (tables ?? []).filter(
    (t) =>
      !mine.has(t.room_id) &&
      t.host_id !== profile.id &&
      (partner ? t.players === 4 && t.pair_open : !filter || t.players === filter)
  )
  const join = async (t) => {
    setJoining(t.room_id)
    setJoinError('')
    try {
      await onJoinTable(t.room_id, partner || null)
    } catch (e) {
      setJoinError(e.message)
      setJoining(null)
    }
  }
  const active = rooms.filter(
    (r) => ['waiting', 'playing'].includes(r.status) && !(r.status === 'waiting' && !r.seats[r.mySeat]?.joined)
  )
  const finished = rooms.filter((r) => r.status === 'finished').slice(0, 3)

  return (
    <main className="online-home">
      <button className="back" onClick={onBack}>
        ‹ Volver
      </button>
      <h2 className="page-title">Online</h2>
      <LevelPanel rating={myRating} onOpenRanking={onRanking} />

      {active.length > 0 && (
        <section className="block">
          <h2>Tus partidas</h2>
          <div className="room-list">
            {active.map((r) => (
              <button key={r.id} className="room-row" onClick={() => onOpenRoom(r.id)}>
                <span>
                  {r.players === 2 ? 'Mano a mano' : 'De a cuatro'}{' '}
                  <span className="muted">
                    {r.status === 'waiting'
                      ? `esperando jugadores (${r.code})`
                      : `${r.match?.score[r.mySeat % 2] ?? 0} a ${r.match?.score[1 - (r.mySeat % 2)] ?? 0}`}
                  </span>
                </span>
                <span className="tag tag-gold">{r.status === 'waiting' ? 'Sala' : 'Seguir'}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="block">
        <h2>Mesas abiertas</h2>
        {friends.friends.length > 0 && (
          <label className="field">
            <span>Ir con</span>
            <select value={partner} onChange={(e) => setPartner(e.target.value)}>
              <option value="">Solo</option>
              {friends.friends.map(({ profile: p }) => (
                <option key={p.id} value={p.id}>
                  {displayName(p)} de compañero
                </option>
              ))}
            </select>
          </label>
        )}
        {partner ? (
          <p className="muted small">
            Mesas de a cuatro con dos lugares juntos. Al entrar, a tu amigo le llega la invitación para sentarse con vos.
          </p>
        ) : (
        <div className="segmented" role="tablist">
          {[
            [0, 'Todas'],
            [2, 'Mano a mano'],
            [4, 'De a cuatro'],
          ].map(([v, text]) => (
            <button key={v} role="tab" aria-selected={filter === v} onClick={() => setFilter(v)}>
              {text}
            </button>
          ))}
        </div>
        )}
        {joinError && <p className="form-error">{joinError}</p>}
        {tables === null ? (
          <p className="muted small">Buscando mesas…</p>
        ) : visible.length === 0 ? (
          <p className="muted small">
            {partner
              ? 'No hay mesas de a cuatro con dos lugares juntos. Abrí una con tu amigo de compañero.'
              : 'No hay mesas abiertas ahora. ¡Abrí una y esperá que se sumen!'}
          </p>
        ) : (
          <div className="room-list">
            {visible.map((t) => (
              <button key={t.room_id} className="room-row table-row" disabled={joining !== null} onClick={() => join(t)}>
                <Avatar profile={hosts[t.host_id] ?? { username: '?' }} size={38} />
                <span className="person-text">
                  <b>{hosts[t.host_id] ? displayName(hosts[t.host_id]) : 'Jugador'}</b>
                  <span className="muted">
                    {t.players === 2 ? 'Mano a mano' : 'De a cuatro'} · a {t.target} · {t.flor ? 'con flor' : 'sin flor'}
                  </span>
                  <LevelBadge points={hostLevels[t.host_id]?.points ?? 0} />
                </span>
                <span className="tag tag-gold">{joining === t.room_id ? '…' : `${t.taken}/${t.players}`}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="block">
        <h2>Jugar</h2>
        <div className="mode-grid">
          <button className="mode mode-friends" onClick={onNew}>
            <span className="mode-title">Crear mesa</span>
            <span className="mode-sub">Pública o privada, a 15 o a 30</span>
          </button>
          <button className="mode mode-friends" onClick={onFriends}>
            <span className="mode-title">
              Amigos{friends.incoming.length > 0 && <span className="badge">{friends.incoming.length}</span>}
            </span>
            <span className="mode-sub">
              {friends.friends.length ? `${friends.friends.length} agregados` : 'Buscá y agregá jugadores'}
            </span>
          </button>
        </div>
        <form
          className="code-join"
          onSubmit={async (e) => {
            e.preventDefault()
            setCodeError('')
            try {
              await onJoinCode(code.trim())
            } catch (err) {
              setCodeError(err.message)
            }
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Código de mesa"
            maxLength={5}
            autoCapitalize="characters"
            autoCorrect="off"
          />
          <button className="btn btn-ghost" disabled={code.trim().length < 5}>
            Unirme
          </button>
        </form>
        {codeError && <p className="form-error">{codeError}</p>}
        {finished.length > 0 && (
          <p className="muted small">
            Últimas: {finished.map((r) => (r.match.winner === r.mySeat % 2 ? 'ganaste' : 'perdiste')).join(', ')}
          </p>
        )}
      </section>

    </main>
  )
}
