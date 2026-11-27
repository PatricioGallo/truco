// Jugador de la compu. Decide solo con lo que vería una persona en su asiento
// (sus cartas, las jugadas y los cantos): nunca mira las cartas ajenas.

import { parseCard, rank, envidoPoints, hasFlor, florPoints } from './cards.js'
import { legalActions, teamOf, handWinner } from './game.js'

/** Niveles de la compu. */
export const LEVELS = ['facil', 'normal', 'dificil']

const strength = (id) => (rank(parseCard(id)) - 1) / 13 // 0 (un 4) a 1 (ancho de espada)

/** Estimación (0 a 1) de ganar la mano con lo que queda. */
function trucoChance(m, seat) {
  const h = m.hand
  const mine = h.cards[seat].filter(Boolean)
  const team = teamOf(seat)
  const done = h.rounds.filter((r) => r.winner !== null)
  const sorted = mine.map(strength).sort((a, b) => b - a)
  let est = sorted.length ? sorted[0] * 0.6 + (sorted[1] ?? sorted[0] * 0.5) * 0.4 : 0
  if (done[0]) est += done[0].winner === team ? 0.25 : done[0].winner === 'tie' ? 0 : -0.3
  if (done[1]) est += done[1].winner === team ? 0.3 : done[1].winner === 'tie' ? 0 : -0.35
  // Si ya hay cartas en la mesa en esta baza, ¿la puedo ganar?
  const round = h.rounds[h.rounds.length - 1]
  const rivals = round.plays.filter((p) => teamOf(p.seat) !== team).map((p) => rank(parseCard(p.card)))
  if (rivals.length) {
    const top = Math.max(...rivals)
    est += mine.some((c) => rank(parseCard(c)) > top) ? 0.15 : -0.2
  }
  return Math.max(0, Math.min(1, est))
}

// ---------------------------------------------------------------------------
// Dificultad difícil: en vez de estimar a ojo, simula muchas veces cómo puede
// terminar la mano repartiendo al azar las cartas que todavía no vio.
// ---------------------------------------------------------------------------

const ALL_IDS = ['espada', 'basto', 'oro', 'copa'].flatMap((s) => [1, 2, 3, 4, 5, 6, 7, 10, 11, 12].map((n) => `${n}${s[0]}`))
const rankOf = (id) => rank(parseCard(id))

/** Juega una baza con criterio simple: matar con la más baja que alcance o tirar la más baja. */
function greedyCard(hand, plays, seat, roundNo) {
  const sorted = hand.slice().sort((a, b) => rankOf(a) - rankOf(b))
  if (!plays.length) return roundNo === 0 && sorted.length === 3 ? sorted[1] : sorted[sorted.length - 1]
  const top = Math.max(...plays.map((p) => rankOf(p.card)))
  const mineTop = plays.some((p) => teamOf(p.seat) === teamOf(seat) && rankOf(p.card) === top)
  if (mineTop) return sorted[0]
  return sorted.find((c) => rankOf(c) > top) ?? sorted[0]
}

/** Probabilidad (0 a 1) de que el equipo de `seat` gane la mano jugándola hasta el final. */
export function simulatedChance(m, seat, random = Math.random, samples = 80) {
  const h = m.hand
  const n = m.config.players
  const seen = new Set([...h.initial[seat], ...h.rounds.flatMap((r) => r.plays.map((p) => p.card))])
  const pool = ALL_IDS.filter((id) => !seen.has(id))
  const team = teamOf(seat)
  let wins = 0
  for (let k = 0; k < samples; k++) {
    // Reparto al azar de las cartas que no veo
    const deck = pool.slice()
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[deck[i], deck[j]] = [deck[j], deck[i]]
    }
    const hands = h.cards.map((c, s) => (s === seat ? c.slice() : c.map(() => deck.pop())))
    const rounds = h.rounds.map((r) => ({ ...r, plays: r.plays.slice() }))
    let winner = null
    let guard = 0
    while (winner === null && guard++ < 12) {
      const r = rounds[rounds.length - 1]
      if (r.plays.length < n) {
        const s = (r.lead + r.plays.length) % n
        const card = greedyCard(hands[s], r.plays, s, rounds.length - 1)
        hands[s] = hands[s].filter((c) => c !== card)
        r.plays.push({ seat: s, card })
        continue
      }
      const top = Math.max(...r.plays.map((p) => rankOf(p.card)))
      const best = r.plays.filter((p) => rankOf(p.card) === top)
      const teams = new Set(best.map((p) => teamOf(p.seat)))
      r.winner = teams.size === 1 ? teamOf(best[0].seat) : 'tie'
      r.winnerSeat = teams.size === 1 ? best[0].seat : null
      winner = handWinner(rounds, teamOf(m.mano))
      if (winner === null) {
        if (rounds.length === 3) break
        rounds.push({ lead: r.winner === 'tie' ? r.lead : r.winnerSeat, plays: [], winner: null, winnerSeat: null })
      }
    }
    if (winner === team) wins++
  }
  return wins / samples
}

/** Fácil: a veces se equivoca a propósito. Devuelve null para decidir normalmente. */
function easyMistake(m, seat, acts, random) {
  const p = m.hand.pending
  if (p?.kind === 'declare' || p?.kind === 'flor') return null
  if (p) {
    if (random() < 0.35) return pick(acts, (a) => a.type === (random() < 0.5 ? 'accept' : 'reject'))
    return null
  }
  const plays = acts.filter((a) => a.type === 'play')
  if (plays.length && random() < 0.4) return plays[Math.floor(random() * plays.length)]
  return null
}

const pick = (acts, pred) => acts.find(pred)
const callOf = (acts, c) => pick(acts, (a) => a.type === 'call' && a.call === c)

/** Elige la carta: matar con la más baja que alcance, o tirar la más baja. */
function chooseCard(m, seat, acts) {
  const h = m.hand
  const team = teamOf(seat)
  const plays = acts.filter((a) => a.type === 'play')
  const byRank = plays.map((a) => ({ a, r: rank(parseCard(a.card)) })).sort((x, y) => x.r - y.r)
  const round = h.rounds[h.rounds.length - 1]
  const lowest = byRank[0].a
  const highest = byRank[byRank.length - 1].a

  if (round.plays.length) {
    const top = Math.max(...round.plays.map((p) => rank(parseCard(p.card))))
    const topIsPartner = round.plays.some((p) => teamOf(p.seat) === team && rank(parseCard(p.card)) === top)
    if (topIsPartner) return lowest // el compañero ya la tiene
    const winner = byRank.find((x) => x.r > top)
    if (winner) return winner.a
    const tie = byRank.find((x) => x.r === top)
    const wonFirst = h.rounds[0].winner === team
    if (tie && wonFirst) return tie.a // empardar alcanza si ganamos la primera
    return lowest
  }

  // Abro la baza
  const done = h.rounds.filter((r) => r.winner !== null)
  if (done.length === 0) return byRank.length === 3 ? byRank[1].a : highest // guardo la mejor
  return highest
}

/**
 * Decide la acción de la compu.
 * @param m vista del partido para ese asiento (viewFor)
 * @param random función aleatoria (para que a veces mienta)
 * @param level 'facil' | 'normal' | 'dificil' (si no se pasa, el de la partida o 'normal')
 */
export function chooseAction(m, seat, random = Math.random, level = m.config?.level ?? 'normal') {
  const acts = legalActions(m, seat)
  if (!acts.length) return null
  if (level === 'facil') {
    const oops = easyMistake(m, seat, acts, random)
    if (oops) return oops
  }
  const hard = level === 'dificil'
  const chanceOf = () => (hard ? simulatedChance(m, seat, random) : trucoChance(m, seat))
  const h = m.hand
  const mine = h.initial[seat].map(parseCard)
  const envido = envidoPoints(mine)
  const manoBonus = teamOf(seat) === teamOf(m.mano) ? 1 : 0 // los empates los gana el mano
  const p = h.pending

  // --- Cantar los puntos del envido: siempre la verdad ---
  if (p?.kind === 'declare') {
    return pick(acts, (a) => a.type === 'declare') ?? pick(acts, (a) => a.type === 'buenas')
  }

  // --- Responder un canto ---
  if (p) {
    if (p.kind === 'flor') {
      const fp = hasFlor(mine) ? florPoints(mine) : 0
      const last = h.flor.chain[h.flor.chain.length - 1]
      if (last === 'flor') {
        if (fp >= 36 && callOf(acts, 'contraflor_resto')) return callOf(acts, 'contraflor_resto')
        if (fp >= 31 && callOf(acts, 'contraflor')) return callOf(acts, 'contraflor')
        return pick(acts, (a) => a.type === 'achico')
      }
      if (fp >= (last === 'contraflor_resto' ? 35 : 32)) return pick(acts, (a) => a.type === 'accept')
      return pick(acts, (a) => a.type === 'reject')
    }

    if (callOf(acts, 'flor')) return callOf(acts, 'flor') // la flor se canta siempre

    if (p.kind === 'envido') {
      const chain = h.envido.chain
      const need = chain.includes('falta') ? 31 : chain.includes('real') ? 28 : chain.length > 1 ? 28 : 26
      if (envido + manoBonus >= 32 && callOf(acts, 'falta') && m.score[teamOf(seat)] < m.config.target / 2)
        return callOf(acts, 'falta')
      if (envido + manoBonus >= 30 && callOf(acts, 'real')) return callOf(acts, 'real')
      if (envido + manoBonus >= need) return pick(acts, (a) => a.type === 'accept')
      return pick(acts, (a) => a.type === 'reject')
    }

    if (p.kind === 'truco') {
      // El envido está primero
      if (envido >= 29 && callOf(acts, 'envido')) return callOf(acts, 'envido')
      const chance = chanceOf()
      const raise = acts.find((a) => a.type === 'call' && ['retruco', 'vale4'].includes(a.call))
      if (hard) {
        // Aceptar conviene si la chance de ganar compensa lo que se arriesga
        const stake = p.call // lo que vale si se acepta
        const lose = p.prevValue // lo que se pierde si se rechaza
        // Si el rival canta, seguramente tiene con qué: se desconfía un poco de la simulación
        const c = chance - 0.12
        if (raise && c > 0.72) return raise
        if (c * stake - (1 - c) * stake > -lose) return pick(acts, (a) => a.type === 'accept')
        return pick(acts, (a) => a.type === 'reject')
      }
      if (raise && (chance > 0.8 || (chance > 0.55 && random() < 0.12))) return raise
      if (chance > 0.42 || random() < 0.08) return pick(acts, (a) => a.type === 'accept')
      return pick(acts, (a) => a.type === 'reject')
    }
  }

  // --- Mi turno ---
  if (callOf(acts, 'flor')) return callOf(acts, 'flor')

  if (callOf(acts, 'envido')) {
    if (envido >= 33 && random() < 0.3 && m.score[teamOf(seat)] < m.config.target / 2) return callOf(acts, 'falta')
    if (envido >= 30 && random() < 0.5) return callOf(acts, 'real')
    if (envido >= 27) return callOf(acts, 'envido')
    if (envido <= 21 && random() < 0.07) return callOf(acts, 'envido') // a veces miente
  }

  const trucoCall = acts.find((a) => a.type === 'call' && ['truco', 'retruco', 'vale4'].includes(a.call))
  if (trucoCall) {
    const chance = chanceOf()
    if (hard) {
      if (chance > 0.66 || (chance < 0.2 && random() < 0.1)) return trucoCall
    } else if (chance > 0.72 || (chance < 0.25 && random() < 0.06)) return trucoCall
  }

  return chooseCard(m, seat, acts)
}
