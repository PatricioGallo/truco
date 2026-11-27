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

/** Mis puntos, mi nivel y mi posición en el ranking (se recarga cuando cambia `refresh`). */
export function useMyRating(userId, refresh) {
  const [rating, setRating] = useState(null)
  useEffect(() => {
    let alive = true
    api
      .ratingsByIds([userId])
      .then(async (r) => {
        const mine = r[userId] ?? { points: 0, games: 0, wins: 0, streak: 0 }
        const pos = mine.games ? await api.rankPosition(mine.points) : null
        if (alive) setRating({ ...mine, pos })
      })
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
        <span className="level-points">
          {rating.points} puntos
          {rating.pos ? <span className="world-chip">🌎 Ranking #{rating.pos}</span> : null}
        </span>
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
              : 'Jugá mesas públicas para sumar puntos y subir de nivel'}
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
        El <b>ranking</b> es tu posición entre todos los jugadores del mundo, ordenados por puntos. El <b>nivel</b> es tu
        carta, del 4 de copas al ancho de espada, y depende solo de tus puntos. Los puntos se ganan en las mesas públicas
        online: a 30 valen más que a 15, y si ganás seguido o jugás mejor que tu carta, sumás más.
      </p>
    </main>
  )
}

/** Puntos ganados o perdidos al terminar una partida pública (los busca hasta que el servidor los anota). */
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
  if (change === undefined) return <p className="muted small">Calculando puntos…</p>
  if (!change) return <p className="muted small">Esta partida no sumó ni restó puntos.</p>
  const lv = levelOf(change.points_after)
  const before = levelOf(change.points_after - change.delta)
  return (
    <div className="rating-result">
      <b className={change.delta >= 0 ? 'good' : 'bad'}>
        {change.delta >= 0 ? '+' : ''}
        {change.delta} puntos
      </b>
      <span className="level-badge">
        <Card id={lv.card.id} size="lvl" />
        <span>
          {lv.level > before.level ? '¡Subiste de nivel: ' : lv.level < before.level ? 'Bajaste de nivel: ' : 'Nivel: '}
          {lv.card.name}
          {lv.level !== before.level ? (lv.level > before.level ? '!' : '') : ''} · {change.points_after} pts
        </span>
      </span>
    </div>
  )
}

/** Tarjeta del inicio: mi nivel (carta), mi posición en el ranking y los tres primeros del mundo. */
export function HomeRanking({ profile, refresh, onOpen, onOpenPlayer }) {
  const [top, setTop] = useState(null)
  const [people, setPeople] = useState({})
  const [me, setMe] = useState(null)
  useEffect(() => {
    let alive = true
    api
      .leaderboard(5)
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
          <span className="muted small">Tu nivel</span>
          <b className="level-name">{lv.card.name}</b>
          <span className="level-points">{me?.points ?? 0} puntos</span>
        </span>
        <span className="world-rank">
          <span className="muted small">Ranking</span>
          <b>{me?.pos ? `#${me.pos}` : '—'}</b>
        </span>
      </button>
      <h2 className="home-rank-title">🌎 Ranking</h2>
      {top === null ? (
        <p className="muted small">Cargando…</p>
      ) : top.length === 0 ? (
        <p className="muted small">Todavía nadie jugó mesas públicas. ¡Jugá una y estrená el ranking!</p>
      ) : (
        <ol className="ranking-list home-rank-list">
          {top.map((r, i) => (
            <li key={r.user_id} className={r.user_id === profile.id ? 'is-me' : ''}>
              <button className="rank-row" onClick={() => onOpenPlayer(r.user_id)}>
                <span className="rank-pos">{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
                <Avatar profile={people[r.user_id] ?? { username: '?' }} size={32} />
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
          {me?.pos > top.length && (
            <li className="is-me">
              <button className="rank-row" onClick={() => onOpenPlayer(profile.id)}>
                <span className="rank-pos">{me.pos}</span>
                <Avatar profile={profile} size={32} />
                <span className="person-text">
                  <b>Vos</b>
                  <LevelBadge points={me.points} />
                </span>
                <span className="rank-points">{me.points}</span>
              </button>
            </li>
          )}
        </ol>
      )}
      <button className="btn btn-ghost btn-small" onClick={onOpen}>
        Ver ranking completo
      </button>
    </section>
  )
}
