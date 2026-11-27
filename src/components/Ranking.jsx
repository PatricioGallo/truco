import { useEffect, useState } from 'react'
import * as api from '@api'
import { levelOf, LEVEL_CARDS, LEVEL_MIN } from '../server/ranking.js'
import { displayName } from '../api/shared.js'
import Card from './Card.jsx'
import Avatar from './Avatar.jsx'
import { flagOf } from '../countries.js'

/** Carta de nivel chiquita con el nombre (para listas y mesas). */
export function LevelBadge({ points = 0, showName = true }) {
  const lv = levelOf(points)
  return (
    <span className="level-badge" title={`Nivel ${lv.level}: ${lv.card.name}`}>
      <Card id={lv.card.id} size="lvl" />
      {showName && <span>{lv.card.name}</span>}
    </span>
  )
}

/** Mi ranking (se recarga cuando cambia `refresh`). */
export function useMyRating(userId, refresh) {
  const [rating, setRating] = useState(null)
  useEffect(() => {
    let alive = true
    api
      .ratingsByIds([userId])
      .then((r) => alive && setRating(r[userId] ?? { points: 0, games: 0, wins: 0, streak: 0 }))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [userId, refresh])
  return rating
}

/** Panel con la carta grande, los puntos y cuánto falta para el siguiente nivel. */
export function LevelPanel({ rating, onOpenRanking }) {
  if (!rating) return null
  const lv = levelOf(rating.points)
  return (
    <section className="panel level-panel">
      <Card id={lv.card.id} size="md" className="level-card" />
      <div className="level-info">
        <span className="muted small">Nivel {lv.level} de {LEVEL_CARDS.length}</span>
        <b className="level-name">{lv.card.name}</b>
        <span className="level-points">{rating.points} puntos</span>
        {lv.next !== null ? (
          <>
            <span className="level-bar">
              <i style={{ transform: `scaleX(${lv.progress})` }} />
            </span>
            <span className="muted small">
              Faltan {lv.next - rating.points} para el {LEVEL_CARDS[lv.level].name}
            </span>
          </>
        ) : (
          <span className="muted small">¡Llegaste a lo más alto!</span>
        )}
        <span className="muted small">
          {rating.games === null
            ? '🔒 Perfil privado'
            : rating.games
              ? `${rating.wins} ganadas de ${rating.games}`
              : 'Jugá mesas públicas para entrar al ranking'}
          {rating.streak >= 3 ? ` · racha de ${rating.streak} 🔥` : ''}
        </span>
      </div>
      {onOpenRanking && (
        <button className="btn btn-ghost btn-small level-more" onClick={onOpenRanking}>
          Ver ranking
        </button>
      )}
    </section>
  )
}

/** Tabla de posiciones. */
export function RankingScreen({ profile, onBack, onOpenPlayer }) {
  const [rows, setRows] = useState(null)
  const [people, setPeople] = useState({})
  const [me, setMe] = useState(null)
  const [tab, setTab] = useState('ranking')
  useEffect(() => {
    let alive = true
    api
      .leaderboard(50)
      .then(async (list) => {
        if (!alive) return
        setRows(list)
        const ps = await api.profilesByIds(list.map((r) => r.user_id))
        if (alive) setPeople(Object.fromEntries(ps.map((p) => [p.id, p])))
      })
      .catch(() => alive && setRows([]))
    api
      .ratingsByIds([profile.id])
      .then(async (r) => {
        const mine = r[profile.id] ?? { points: 0, games: 0, wins: 0, streak: 0 }
        const pos = mine.games ? await api.rankPosition(mine.points) : null
        if (alive) setMe({ ...mine, pos })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [profile.id])

  const inTop = rows?.some((r) => r.user_id === profile.id)
  return (
    <main className="ranking">
      <button className="back" onClick={onBack}>
        ‹ Volver
      </button>
      <h2 className="page-title">Ranking</h2>
      <LevelPanel rating={me} />
      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={tab === 'ranking'} onClick={() => setTab('ranking')}>
          Posiciones
        </button>
        <button role="tab" aria-selected={tab === 'levels'} onClick={() => setTab('levels')}>
          Niveles
        </button>
      </div>

      {tab === 'levels' ? (
        <ol className="levels-list">
          {LEVEL_CARDS.map((c, i) => (
            <li key={c.id} className={me && levelOf(me.points).level === i + 1 ? 'is-me' : ''}>
              <Card id={c.id} size="lvl" />
              <span className="person-text">
                <b>{c.name}</b>
                <span className="muted">Nivel {i + 1}</span>
              </span>
              <span className="tag">{LEVEL_MIN[i]} pts</span>
            </li>
          ))}
        </ol>
      ) : rows === null ? (
        <p className="muted">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="muted">Todavía nadie jugó mesas públicas. ¡Sé el primero!</p>
      ) : (
        <ol className="ranking-list">
          {rows.map((r, i) => (
            <li key={r.user_id} className={r.user_id === profile.id ? 'is-me' : ''}>
              <button className="rank-row" onClick={() => onOpenPlayer?.(r.user_id)}>
                <span className="rank-pos">{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
                <Avatar profile={people[r.user_id] ?? { username: '?' }} size={36} />
                <span className="person-text">
                  <b>
                    {r.user_id === profile.id ? 'Vos' : people[r.user_id] ? displayName(people[r.user_id]) : 'Jugador'}{' '}
                    {flagOf(r.country)}
                  </b>
                  <LevelBadge points={r.points} />
                </span>
                <span className="rank-points">{r.points}</span>
              </button>
            </li>
          ))}
          {!inTop && me?.pos && (
            <li className="is-me">
              <button className="rank-row" onClick={() => onOpenPlayer?.(profile.id)}>
                <span className="rank-pos">{me.pos}</span>
                <Avatar profile={profile} size={36} />
                <span className="person-text">
                  <b>Vos {flagOf(me.country)}</b>
                  <LevelBadge points={me.points} />
                </span>
                <span className="rank-points">{me.points}</span>
              </button>
            </li>
          )}
        </ol>
      )}
      <p className="hint">
        Suman las mesas públicas online. A 30 vale más que a 15. Si ganás seguido o jugás mejor que tu carta, subís más
        rápido.
      </p>
    </main>
  )
}

/** Resultado de ranking al terminar una partida pública (lo busca hasta que el servidor lo anota). */
export function RatingResult({ roomId, userId }) {
  const [change, setChange] = useState(undefined)
  useEffect(() => {
    let alive = true
    let tries = 0
    const look = () =>
      api
        .ratingChange(roomId, userId)
        .then((c) => {
          if (!alive) return
          if (c || ++tries >= 4) setChange(c ?? null)
          else setTimeout(look, 1500)
        })
        .catch(() => alive && setChange(null))
    look()
    return () => {
      alive = false
    }
  }, [roomId, userId])
  if (change === undefined) return <p className="muted small">Calculando ranking…</p>
  if (!change) return <p className="muted small">Esta partida no cambió tu ranking.</p>
  const lv = levelOf(change.points_after)
  const before = levelOf(change.points_after - change.delta)
  return (
    <div className="rating-result">
      <b className={change.delta >= 0 ? 'good' : 'bad'}>
        {change.delta >= 0 ? '+' : ''}
        {change.delta} puntos de ranking
      </b>
      <span className="level-badge">
        <Card id={lv.card.id} size="lvl" />
        <span>
          {lv.level > before.level ? '¡Subiste a ' : lv.level < before.level ? 'Bajaste a ' : ''}
          {lv.card.name}
          {lv.level !== before.level ? (lv.level > before.level ? '!' : '') : ''} · {change.points_after} pts
        </span>
      </span>
    </div>
  )
}

/** Tarjeta del inicio: mi nivel y puesto, y los tres primeros del ranking. */
export function HomeRanking({ profile, refresh, onOpen, onOpenPlayer }) {
  const [top, setTop] = useState(null)
  const [people, setPeople] = useState({})
  const [me, setMe] = useState(null)
  useEffect(() => {
    let alive = true
    api
      .leaderboard(3)
      .then(async (list) => {
        if (!alive) return
        setTop(list)
        const ps = await api.profilesByIds(list.map((r) => r.user_id))
        if (alive) setPeople(Object.fromEntries(ps.map((p) => [p.id, p])))
      })
      .catch(() => alive && setTop([]))
    api
      .ratingsByIds([profile.id])
      .then(async (r) => {
        const mine = r[profile.id] ?? { points: 0, games: 0 }
        const pos = mine.games ? await api.rankPosition(mine.points) : null
        if (alive) setMe({ ...mine, pos })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [profile.id, refresh])
  const lv = levelOf(me?.points ?? 0)
  return (
    <section className="home-ranking">
      <button className="home-ranking-me" onClick={onOpen}>
        <Card id={lv.card.id} size="sm" />
        <span className="person-text">
          <span className="muted small">Tu ranking</span>
          <b className="level-name">{lv.card.name}</b>
          <span className="level-points">
            {me?.points ?? 0} pts{me?.pos ? ` · puesto #${me.pos}` : ''}
          </span>
        </span>
        <span className="category-arrow" aria-hidden="true">›</span>
      </button>
      {top?.length > 0 && (
        <ol className="home-top3">
          {top.map((r, i) => (
            <li key={r.user_id}>
              <button onClick={() => onOpenPlayer(r.user_id)}>
                <span>{['🥇', '🥈', '🥉'][i]}</span>
                <Avatar profile={people[r.user_id] ?? { username: '?' }} size={28} />
                <b>{r.user_id === profile.id ? 'Vos' : people[r.user_id] ? people[r.user_id].first_name || people[r.user_id].username : '…'}</b>
                <span className="muted">{r.points}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
