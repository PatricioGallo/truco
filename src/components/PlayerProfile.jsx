import { useEffect, useState } from 'react'
import * as api from '@api'
import { displayName } from '../api/shared.js'
import { flagOf, countryName } from '../countries.js'
import Avatar from './Avatar.jsx'
import { LevelPanel } from './Ranking.jsx'

const EMPTY = { points: 0, games: 0, wins: 0, streak: 0 }

/** Puntos, nivel, estadísticas y posición en el ranking mundial de un jugador. */
export function usePlayerStats(userId, refresh) {
  const [stats, setStats] = useState(null)
  useEffect(() => {
    let alive = true
    api
      .ratingsByIds([userId])
      .then(async (r) => {
        const rating = { ...EMPTY, ...r[userId] }
        if (r[userId] && r[userId].games === null) rating.games = null // perfil privado
        const pos = rating.games ? await api.rankPosition(rating.points) : null
        if (alive) setStats({ ...rating, pos })
      })
      .catch(() => alive && setStats({ ...EMPTY, pos: null }))
    return () => {
      alive = false
    }
  }, [userId, refresh])
  return stats
}

/** Partidas, ganadas, perdidas, efectividad, racha y ranking mundial. */
export function StatsGrid({ stats }) {
  if (!stats) return <p className="muted small center">Cargando estadísticas…</p>
  if (stats.games === null)
    return (
      <section className="stats-grid is-private">
        <p className="muted center">🔒 Perfil privado: sus estadísticas solo las ven sus amigos.</p>
      </section>
    )
  const lost = stats.games - stats.wins
  const pct = stats.games ? Math.round((stats.wins / stats.games) * 100) : 0
  const items = [
    ['Partidas', stats.games],
    ['Ganadas', stats.wins],
    ['Perdidas', lost],
    ['Efectividad', stats.games ? `${pct}%` : '—'],
    [stats.streak > 0 ? 'Ganando seguidas' : stats.streak < 0 ? 'Perdiendo seguidas' : 'Racha', stats.streak ? Math.abs(stats.streak) : '—'],
    ['Ranking mundial', stats.pos ? `#${stats.pos}` : '—'],
  ]
  return (
    <section className="stats-grid" aria-label="Estadísticas online">
      {items.map(([label, value]) => (
        <div key={label} className="stat">
          <b>{value}</b>
          <span>{label}</span>
        </div>
      ))}
      <p className="muted small stats-note">Cuentan las mesas públicas online.</p>
    </section>
  )
}

/** Nombre completo, usuario y nacionalidad. */
export function PlayerHeader({ profile, country, big = false, hideAvatar = false }) {
  return (
    <div className="player-head">
      {!hideAvatar && <Avatar profile={profile} size={big ? 112 : 88} />}
      <h2 className="page-title center">{displayName(profile)}</h2>
      <p className="muted center player-sub">
        @{profile.username}
        {country && (
          <span className="player-country">
            {' · '}
            {flagOf(country)} {countryName(country)}
          </span>
        )}
      </p>
    </div>
  )
}

/** Perfil de otro jugador: foto, nombre, nacionalidad, nivel, estadísticas y amistad. */
export default function PlayerProfile({ userId, me, friends, reloadFriends, onPlayWith, onBack }) {
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const stats = usePlayerStats(userId)

  useEffect(() => {
    let alive = true
    api
      .getProfile(userId)
      .then((p) => alive && setProfile(p))
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [userId])

  const isMe = userId === me.id
  const friend = friends.friends.find((f) => f.profile.id === userId)
  const incoming = friends.incoming.find((f) => f.profile.id === userId)
  const sent = friends.outgoing.some((f) => f.profile.id === userId)
  const run = async (fn) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      await reloadFriends()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="player-profile">
      <button className="back" onClick={onBack}>
        ‹ Volver
      </button>
      {!profile ? (
        <p className="muted">{error || 'Cargando…'}</p>
      ) : (
        <>
          <PlayerHeader profile={profile} country={stats?.country} />
          {!isMe && (
            <div className="player-actions">
              {friend ? (
                <>
                  <span className="tag tag-ok">Son amigos</span>
                  {onPlayWith && (
                    <button className="btn btn-small btn-primary" onClick={() => onPlayWith(profile)}>
                      Invitar a jugar
                    </button>
                  )}
                </>
              ) : incoming ? (
                <button className="btn btn-small btn-accept" disabled={busy} onClick={() => run(() => api.acceptFriend(incoming.friendshipId))}>
                  Aceptar amistad
                </button>
              ) : sent ? (
                <span className="tag">Pedido de amistad enviado</span>
              ) : (
                <button className="btn btn-small btn-primary" disabled={busy} onClick={() => run(() => api.sendFriendRequest(me.id, userId))}>
                  Agregar de amigo
                </button>
              )}
            </div>
          )}
          {error && <p className="form-error">{error}</p>}
          <LevelPanel rating={stats} />
          <StatsGrid stats={stats} />
        </>
      )}
    </main>
  )
}
