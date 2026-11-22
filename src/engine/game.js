// Motor de reglas del truco argentino (1v1 y 2v2, con flor opcional, partidas a 30).
// Todo el estado es JSON plano: sirve igual en el celular y en el servidor.
// `apply` nunca modifica el estado recibido: devuelve uno nuevo.

import { newDeck, shuffle, cardId, parseCard, rank, envidoPoints, hasFlor, florPoints } from './cards.js'

export const teamOf = (seat) => seat % 2
const other = (team) => 1 - team
const clone = (x) => JSON.parse(JSON.stringify(x))

export const TRUCO_NAMES = { 2: 'truco', 3: 'retruco', 4: 'vale4' }
const ENVIDO_VALUE = { envido: 2, real: 3 }

// ---------------------------------------------------------------------------
// Partida
// ---------------------------------------------------------------------------

export function createMatch({ players = 2, target = 30, flor = true } = {}) {
  if (players !== 2 && players !== 4) throw new Error('Se juega de a 2 o de a 4')
  return {
    config: { players, target, flor },
    score: [0, 0],
    mano: 0,
    handNo: 0,
    winner: null,
    hand: null,
    log: [],
  }
}

/** Reparte una mano nueva. La primera mano la es el asiento 0; después rota. */
export function deal(match, random = Math.random) {
  const m = clone(match)
  if (m.winner !== null) throw new Error('La partida terminó')
  const n = m.config.players
  if (m.hand) m.mano = (m.mano + 1) % n
  m.handNo++
  const deck = shuffle(newDeck(), random)
  const cards = Array.from({ length: n }, (_, s) => [0, 1, 2].map((k) => cardId(deck[k * n + s])))
  m.hand = {
    initial: cards.map((c) => c.slice()),
    cards,
    rounds: [{ lead: m.mano, plays: [], winner: null, winnerSeat: null }],
    turn: m.mano,
    truco: { value: 1, raiseTeam: null }, // raiseTeam: quién puede subir (null = cualquiera)
    envido: { done: false, chain: [] },
    flor: { done: false, chain: [], team: null },
    pending: null, // canto esperando respuesta
    suspended: null, // truco en espera mientras se resuelve el envido ("el envido está primero")
    finished: false,
    result: null,
    showdown: false,
  }
  m.log = [{ t: 'deal', handNo: m.handNo, mano: m.mano }]
  return m
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

const cardsOf = (m, seat) => m.hand.initial[seat].map(parseCard)
const currentRound = (h) => h.rounds[h.rounds.length - 1]
const hasPlayedThisHand = (h, seat) => h.rounds.some((r) => r.plays.some((p) => p.seat === seat))
const seatsOfTeam = (m, team) => [...Array(m.config.players).keys()].filter((s) => teamOf(s) === team)
const teamHasFlor = (m, team) => seatsOfTeam(m, team).some((s) => hasFlor(cardsOf(m, s)))

/** Orden de los asientos empezando por el mano (para desempatar). */
const fromMano = (m) => [...Array(m.config.players).keys()].map((k) => (m.mano + k) % m.config.players)

function envidoAvailable(m, seat) {
  const h = m.hand
  return (
    h.rounds.length === 1 &&
    !h.envido.done &&
    !h.flor.done &&
    h.flor.chain.length === 0 &&
    h.truco.value === 1 &&
    !hasPlayedThisHand(h, seat)
  )
}

function canSingFlor(m, seat) {
  const h = m.hand
  return (
    m.config.flor &&
    h.rounds.length === 1 &&
    h.flor.chain.length === 0 &&
    !hasPlayedThisHand(h, seat) &&
    hasFlor(cardsOf(m, seat))
  )
}

function canCallTruco(m, team) {
  const t = m.hand.truco
  return t.value < 4 && (t.raiseTeam === null || t.raiseTeam === team)
}

function envidoRaises(chain) {
  const has = (c) => chain.includes(c)
  const envidos = chain.filter((c) => c === 'envido').length
  const out = []
  if (!has('real') && !has('falta') && envidos < 2) out.push('envido')
  if (!has('real') && !has('falta')) out.push('real')
  if (!has('falta')) out.push('falta')
  return out
}

/** Acciones válidas para un asiento en este momento. */
export function legalActions(match, seat) {
  const m = match
  const h = m.hand
  if (!h || h.finished || m.winner !== null) return []
  const team = teamOf(seat)
  const acts = []

  if (h.pending) {
    const p = h.pending
    if (p.byTeam === team) return [] // esperando la respuesta del otro equipo
    if (p.kind === 'truco') {
      acts.push({ type: 'accept' }, { type: 'reject' })
      if (p.call < 4) acts.push({ type: 'call', call: TRUCO_NAMES[p.call + 1] })
      if (p.call === 2 && envidoAvailable(m, seat)) {
        for (const c of ['envido', 'real', 'falta']) acts.push({ type: 'call', call: c })
      }
      if (canSingFlor(m, seat)) acts.push({ type: 'call', call: 'flor' })
    } else if (p.kind === 'envido') {
      acts.push({ type: 'accept' }, { type: 'reject' })
      for (const c of envidoRaises(h.envido.chain)) acts.push({ type: 'call', call: c })
      if (canSingFlor(m, seat)) acts.push({ type: 'call', call: 'flor' })
    } else if (p.kind === 'flor') {
      const chain = h.flor.chain
      const last = chain[chain.length - 1]
      if (!hasFlor(cardsOf(m, seat))) return [] // contesta quien tiene flor
      if (last === 'flor') {
        acts.push({ type: 'call', call: 'contraflor' }, { type: 'call', call: 'contraflor_resto' }, { type: 'achico' })
      } else {
        acts.push({ type: 'accept' }, { type: 'reject' })
        if (last === 'contraflor') acts.push({ type: 'call', call: 'contraflor_resto' })
      }
    }
    return acts
  }

  if (h.turn !== seat) return []
  for (const card of h.cards[seat]) acts.push({ type: 'play', card })
  if (canCallTruco(m, team)) acts.push({ type: 'call', call: TRUCO_NAMES[h.truco.value + 1] })
  if (canSingFlor(m, seat)) acts.push({ type: 'call', call: 'flor' })
  else if (envidoAvailable(m, seat) && !(m.config.flor && hasFlor(cardsOf(m, seat)))) {
    for (const c of ['envido', 'real', 'falta']) acts.push({ type: 'call', call: c })
  }
  acts.push({ type: 'mazo' })
  return acts
}

export const isLegal = (match, seat, action) =>
  legalActions(match, seat).some((a) => JSON.stringify(a) === JSON.stringify(action))

// ---------------------------------------------------------------------------
// Puntos
// ---------------------------------------------------------------------------

/** Puntos de la falta: en las malas gana el partido; en las buenas, lo que le falta al que va ganando. */
export function faltaPoints(m, winnerTeam) {
  const { target } = m.config
  const leader = Math.max(...m.score)
  return leader < target / 2 ? target - m.score[winnerTeam] : target - leader
}

function envidoAcceptedValue(m, chain, winnerTeam) {
  if (chain.includes('falta')) return faltaPoints(m, winnerTeam)
  return chain.reduce((s, c) => s + ENVIDO_VALUE[c], 0)
}

function envidoRejectedValue(m, chain, callerTeam) {
  if (chain.length === 1) return 1
  return envidoAcceptedValue(m, chain.slice(0, -1), callerTeam)
}

function addPoints(m, team, points, reason) {
  if (points <= 0 || m.winner !== null) return
  m.score[team] = Math.min(m.config.target, m.score[team] + points)
  m.log.push({ t: 'points', team, points, reason })
  if (m.score[team] >= m.config.target) {
    m.winner = team
    m.hand.finished = true
    m.hand.result ??= { team, points, reason }
    m.log.push({ t: 'match', winner: team })
  }
}

/** Mejor valor por equipo y quién gana (empate: el más cercano al mano). */
function compareTeams(m, valueOf) {
  const best = [-1, -1]
  for (const s of fromMano(m)) best[teamOf(s)] = Math.max(best[teamOf(s)], valueOf(s))
  if (best[0] !== best[1]) return { winner: best[0] > best[1] ? 0 : 1, best }
  const manoTeam = teamOf(fromMano(m).find((s) => valueOf(s) === best[0]))
  return { winner: manoTeam, best }
}

// ---------------------------------------------------------------------------
// Resolución de cantos
// ---------------------------------------------------------------------------

function restoreSuspended(h) {
  h.pending = h.suspended
  h.suspended = null
}

function resolveEnvido(m, accepted) {
  const h = m.hand
  const chain = h.envido.chain
  const callerTeam = h.pending.byTeam
  if (accepted) {
    const { winner, best } = compareTeams(m, (s) => envidoPoints(cardsOf(m, s)))
    m.log.push({ t: 'envido', points: best, winner })
    h.showdown = true // al final de la mano se muestran las cartas para comprobar
    addPoints(m, winner, envidoAcceptedValue(m, chain, winner), 'envido')
  } else {
    addPoints(m, callerTeam, envidoRejectedValue(m, chain, callerTeam), 'envido')
  }
  h.envido.done = true
  restoreSuspended(h)
}

function resolveFlor(m, outcome) {
  const h = m.hand
  const chain = h.flor.chain
  const last = chain[chain.length - 1]
  if (outcome === 'unopposed') {
    const count = seatsOfTeam(m, h.flor.team).filter((s) => hasFlor(cardsOf(m, s))).length
    addPoints(m, h.flor.team, 3 * count, 'flor')
  } else if (outcome === 'achico') {
    addPoints(m, h.flor.team, 4, 'flor')
  } else if (outcome === 'accept') {
    const { winner, best } = compareTeams(m, (s) => (hasFlor(cardsOf(m, s)) ? florPoints(cardsOf(m, s)) : -1))
    m.log.push({ t: 'flor', points: best, winner })
    h.showdown = true
    addPoints(m, winner, last === 'contraflor_resto' ? faltaPoints(m, winner) : 6, 'flor')
  } else if (outcome === 'reject') {
    addPoints(m, h.pending.byTeam, chain.length === 2 ? 4 : 6, 'flor')
  }
  h.flor.done = true
  h.envido.done = true // con flor no hay envido
  h.pending = null
  restoreSuspended(h)
}

// ---------------------------------------------------------------------------
// Bazas
// ---------------------------------------------------------------------------

/** Quién gana la mano según las bazas jugadas (null si todavía no se sabe). */
export function handWinner(rounds, manoTeam) {
  const r = rounds.filter((x) => x.winner !== null).map((x) => x.winner)
  if (r.length < 2) return null
  const [a, b, c] = r
  if (r.length === 2) {
    if (a !== 'tie' && a === b) return a
    if (a !== 'tie' && b === 'tie') return a
    if (a === 'tie' && b !== 'tie') return b
    return null
  }
  if (c !== 'tie') return c
  if (a !== 'tie') return a // primera ganada y tercera parda
  return manoTeam // todo pardas
}

function finishHand(m, team, points, reason) {
  const h = m.hand
  if (h.finished) return
  h.result = { team, points, reason }
  m.log.push({ t: 'hand', team, points, reason })
  h.finished = true
  addPoints(m, team, points, reason)
}

function resolveRound(m) {
  const h = m.hand
  const round = currentRound(h)
  const top = Math.max(...round.plays.map((p) => rank(parseCard(p.card))))
  const best = round.plays.filter((p) => rank(parseCard(p.card)) === top)
  const teams = new Set(best.map((p) => teamOf(p.seat)))
  if (teams.size === 1) {
    round.winner = teamOf(best[0].seat)
    round.winnerSeat = best[0].seat
  } else {
    round.winner = 'tie'
  }
  m.log.push({ t: 'round', winner: round.winner, seat: round.winnerSeat })

  const winner = handWinner(h.rounds, teamOf(m.mano))
  if (winner !== null) return finishHand(m, winner, h.truco.value, 'truco')
  // Abre la próxima baza quien ganó la anterior; si fue parda, quien la abrió
  const lead = round.winner === 'tie' ? round.lead : round.winnerSeat
  h.rounds.push({ lead, plays: [], winner: null, winnerSeat: null })
  h.turn = lead
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

/** Aplica una acción de un asiento y devuelve el estado nuevo. */
export function apply(match, seat, action) {
  if (!isLegal(match, seat, action)) throw new Error(`Acción inválida: ${JSON.stringify(action)}`)
  const m = clone(match)
  const h = m.hand
  const team = teamOf(seat)
  const n = m.config.players

  switch (action.type) {
    case 'play': {
      h.cards[seat] = h.cards[seat].filter((c) => c !== action.card)
      currentRound(h).plays.push({ seat, card: action.card })
      m.log.push({ t: 'play', seat, card: action.card })
      if (currentRound(h).plays.length === n) resolveRound(m)
      else h.turn = (seat + 1) % n
      break
    }

    case 'mazo': {
      m.log.push({ t: 'mazo', seat })
      finishHand(m, other(team), h.truco.value, 'mazo')
      break
    }

    case 'call': {
      const call = action.call
      m.log.push({ t: 'call', seat, call })
      if (call === 'truco' || call === 'retruco' || call === 'vale4') {
        const level = { truco: 2, retruco: 3, vale4: 4 }[call]
        if (h.pending?.kind === 'truco') h.truco.value = h.pending.call // subir implica aceptar
        h.pending = { kind: 'truco', call: level, byTeam: team, bySeat: seat, prevValue: h.truco.value }
      } else if (call === 'envido' || call === 'real' || call === 'falta') {
        if (h.pending?.kind === 'truco') h.suspended = h.pending // el envido está primero
        h.envido.chain.push(call)
        h.pending = { kind: 'envido', call, byTeam: team, bySeat: seat }
      } else if (call === 'flor') {
        if (h.pending?.kind === 'truco') h.suspended = h.pending
        h.pending = null // anula el envido que hubiera
        h.envido.done = true
        h.flor.chain = ['flor']
        h.flor.team = team
        if (teamHasFlor(m, other(team))) h.pending = { kind: 'flor', call, byTeam: team, bySeat: seat }
        else {
          h.pending = { kind: 'flor', call, byTeam: team, bySeat: seat }
          resolveFlor(m, 'unopposed')
        }
      } else if (call === 'contraflor' || call === 'contraflor_resto') {
        h.flor.chain.push(call)
        h.pending = { kind: 'flor', call, byTeam: team, bySeat: seat }
      }
      break
    }

    case 'accept': {
      const p = h.pending
      m.log.push({ t: 'accept', seat, kind: p.kind })
      if (p.kind === 'truco') {
        h.truco.value = p.call
        h.truco.raiseTeam = team
        h.pending = null
      } else if (p.kind === 'envido') resolveEnvido(m, true)
      else resolveFlor(m, 'accept')
      break
    }

    case 'reject': {
      const p = h.pending
      m.log.push({ t: 'reject', seat, kind: p.kind })
      if (p.kind === 'truco') {
        h.pending = null
        finishHand(m, p.byTeam, p.prevValue, 'no quiero')
      } else if (p.kind === 'envido') resolveEnvido(m, false)
      else resolveFlor(m, 'reject')
      break
    }

    case 'achico': {
      m.log.push({ t: 'achico', seat })
      resolveFlor(m, 'achico')
      break
    }
  }
  return m
}

// ---------------------------------------------------------------------------
// Vista de un jugador (oculta las cartas de los demás)
// ---------------------------------------------------------------------------

export function viewFor(match, seat) {
  const m = clone(match)
  if (!m.hand) return m
  const h = m.hand
  // Las cartas ajenas no jugadas solo se muestran al final si hubo envido o flor querido
  const reveal = h.finished && h.showdown
  h.cards = h.cards.map((c, s) => (s === seat ? c : c.map(() => null)))
  h.initial = h.initial.map((c, s) => (s === seat || reveal ? c : null))
  return m
}
