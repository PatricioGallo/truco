// Jugador de la compu. Decide solo con lo que vería una persona en su asiento
// (sus cartas, las jugadas y los cantos): nunca mira las cartas ajenas.

import { parseCard, rank, envidoPoints, hasFlor, florPoints } from './cards.js'
import { legalActions, teamOf } from './game.js'

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
 */
export function chooseAction(m, seat, random = Math.random) {
  const acts = legalActions(m, seat)
  if (!acts.length) return null
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
      const chance = trucoChance(m, seat)
      const raise = acts.find((a) => a.type === 'call' && ['retruco', 'vale4'].includes(a.call))
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
    const chance = trucoChance(m, seat)
    if (chance > 0.72 || (chance < 0.25 && random() < 0.06)) return trucoCall
  }

  return chooseCard(m, seat, acts)
}
