// Ranking de las mesas públicas online.
// Cada jugador tiene puntos visibles (definen su carta/nivel) y un nivel real
// oculto (tipo Elo) que estima contra quién gana. Cuanto más lejos está la carta
// del nivel real, más rápido se acomoda: sube rápido si es mejor de lo que dice
// su carta y tiende a bajar si es peor.
// Lo usan el servidor (para calcular) y la app (para mostrar las cartas).

/** Las 14 cartas de los niveles, de la más baja a la más alta (jerarquía del truco). */
export const LEVEL_CARDS = [
  { id: '4c', name: '4 de copas' },
  { id: '5o', name: '5 de oro' },
  { id: '6b', name: '6 de basto' },
  { id: '7c', name: '7 de copas' },
  { id: '10o', name: 'Sota de oro' },
  { id: '11b', name: 'Caballo de basto' },
  { id: '12e', name: 'Rey de espada' },
  { id: '1c', name: 'Ancho de copas' },
  { id: '2b', name: '2 de basto' },
  { id: '3o', name: '3 de oro' },
  { id: '7o', name: '7 de oro' },
  { id: '7e', name: '7 de espada' },
  { id: '1b', name: 'Ancho de basto' },
  { id: '1e', name: 'Ancho de espada' },
]
export const MAX_LEVEL = LEVEL_CARDS.length

/** Puntos necesarios para llegar a cada nivel: cada escalón cuesta 1,5 veces el anterior. */
export const LEVEL_MIN = LEVEL_CARDS.reduce((acc, _, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + Math.round(50 * 1.5 ** (i - 1)))
  return acc
}, [])

/** Nivel de unos puntos: número, carta y cuánto falta para el siguiente. */
export function levelOf(points = 0) {
  let level = 1
  while (level < MAX_LEVEL && points >= LEVEL_MIN[level]) level++
  const min = LEVEL_MIN[level - 1]
  const next = level < MAX_LEVEL ? LEVEL_MIN[level] : null
  return {
    level,
    card: LEVEL_CARDS[level - 1],
    points,
    min,
    next,
    progress: next ? (points - min) / (next - min) : 1,
  }
}

export const NEW_PLAYER = { points: 0, mmr: 1000, games: 0, wins: 0, streak: 0 }

/** Nivel (con decimales) que corresponde al nivel real oculto: 1000 es el 6, cada 75 es un nivel. */
const levelFromMmr = (mmr) => Math.min(MAX_LEVEL, Math.max(1, 6 + (mmr - 1000) / 75))
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))

/**
 * Cambio de ranking de un jugador después de una partida.
 * @param me     { points, mmr, games, wins, streak } (streak > 0 victorias seguidas, < 0 derrotas)
 * @param oppMmr nivel real promedio de los rivales
 * @param won    ganó o perdió
 * @param target 15 o 30 (las partidas largas valen más)
 */
export function rateOne(me, oppMmr, won, target) {
  const base = target === 15 ? 10 : 25
  const level = levelOf(me.points).level
  // Nivel real oculto (Elo): se mueve más en las primeras partidas
  const expected = 1 / (1 + 10 ** ((oppMmr - me.mmr) / 400))
  const k = (me.games < 20 ? 40 : 24) * (target === 15 ? 0.7 : 1)
  const mmr = me.mmr + k * ((won ? 1 : 0) - expected)
  // Distancia entre la carta que tiene y el nivel que juega de verdad
  const gap = levelFromMmr(mmr) - level
  const streak = won ? (me.streak > 0 ? me.streak + 1 : 1) : me.streak < 0 ? me.streak - 1 : -1
  const streakBonus = clamp(1 + 0.15 * (Math.abs(streak) - 2), 1, 1.75)
  let delta
  if (won) {
    delta = Math.max(1, Math.round(base * clamp(1 + 0.25 * gap, 0.4, 2.5) * streakBonus))
  } else {
    const lossShare = 0.15 + 0.05 * (level - 1) // en los niveles bajos se pierde poco
    delta = -Math.round(base * lossShare * clamp(1 - 0.25 * gap, 0.4, 2.5) * streakBonus)
  }
  const points = Math.max(0, me.points + delta)
  return {
    delta: points - me.points,
    points,
    mmr: Math.round(mmr * 10) / 10,
    games: me.games + 1,
    wins: me.wins + (won ? 1 : 0),
    streak,
    level: levelOf(points).level,
  }
}

/**
 * Cambios de ranking al terminar una mesa pública.
 * Quien se fue (o no volvió) y su equipo perdió: pierde, y los rivales ganan normalmente.
 * Si el equipo de quien se fue ganó igual (jugó la compu): ni el que se fue suma ni los rivales restan.
 * @param ratings { [userId]: { points, mmr, games, wins, streak } } (los que falten arrancan de cero)
 * @returns lista de { user_id, delta, points, mmr, games, wins, streak, level }
 */
export function rateRoom(room, ratings = {}) {
  if (room.visibility !== 'public' || room.status !== 'finished' || !room.match || room.match.winner === null) return []
  const winner = room.match.winner
  const target = room.match.config.target
  const humans = room.seats
    .map((s, seat) => ({ s, seat, team: seat % 2 }))
    .filter(({ s }) => s.type === 'user')
  const gone = (s) => s.away || s.left
  const r = (uid) => ({ ...NEW_PLAYER, ...ratings[uid] })
  const teamMmr = (team) => {
    const list = humans.filter((h) => h.team === team)
    return list.length ? list.reduce((sum, h) => sum + r(h.s.userId).mmr, 0) / list.length : 1000
  }
  const winnersHadAbsent = humans.some((h) => h.team === winner && gone(h.s))
  const rows = []
  for (const h of humans) {
    const won = h.team === winner
    if (won && gone(h.s)) continue // ganó jugando la compu por él: no suma
    if (!won && winnersHadAbsent) continue // le ganó la compu: no resta
    rows.push({ user_id: h.s.userId, ...rateOne(r(h.s.userId), teamMmr(1 - h.team), won, target) })
  }
  return rows
}
