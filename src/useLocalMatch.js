// Partida contra la compu: el jugador es el asiento 0; el resto juega la IA.
import { useCallback, useEffect, useRef, useState } from 'react'
import { createMatch, deal, apply, legalActions, viewFor, teamOf, myEnvidoPoints } from './engine/game.js'
import { chooseAction } from './engine/ai.js'
import { actionText } from './texts.js'
import { TURN_MS } from './server/rooms.js'

const KEY = 'truco.local'
const ME = 0

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    return s?.match ? s : null
  } catch {
    return null
  }
}
function save(state) {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state))
    else localStorage.removeItem(KEY)
  } catch {
    /* sin storage */
  }
}

export const savedLocalMatch = () => load()

export function useLocalMatch(initial) {
  const [match, setMatch] = useState(() => initial)
  const [bubbles, setBubbles] = useState({}) // asiento -> { text, id }
  const timer = useRef(null)

  useEffect(() => save(match ? { match } : null), [match])

  const say = (seat, text) => {
    if (!text) return
    const id = Math.random()
    setBubbles((b) => ({ ...b, [seat]: { text, id } }))
    setTimeout(() => setBubbles((b) => (b[seat]?.id === id ? { ...b, [seat]: undefined } : b)), 2200)
  }

  const act = useCallback((seat, action) => {
    setMatch((m) => {
      try {
        if (action.type === 'declare') say(seat, `¡${myEnvidoPoints(m, seat)}!`)
        return apply(m, seat, action)
      } catch {
        return m
      }
    })
    if (action.type !== 'declare') say(seat, actionText(action))
  }, [])

  // Turno de la compu: actúa si el jugador no tiene nada para hacer
  useEffect(() => {
    clearTimeout(timer.current)
    if (!match?.hand || match.hand.finished || match.winner !== null) return
    if (legalActions(match, ME).length) return
    const seat = [...Array(match.config.players).keys()].find((s) => s !== ME && legalActions(match, s).length)
    if (seat === undefined) return
    const pending = match.hand.pending && teamOf(seat) !== match.hand.pending.byTeam
    timer.current = setTimeout(() => {
      const a = chooseAction(viewFor(match, seat), seat)
      if (a) act(seat, a)
    }, pending ? 900 : 750)
    return () => clearTimeout(timer.current)
  }, [match, act])

  // Tiempo para jugar: si se acaba, la compu juega por vos
  const myTurnKey = match && legalActions(match, ME).length ? `${match.handNo}-${match.log.length}` : null
  const [deadline, setDeadline] = useState(null)
  useEffect(() => setDeadline(myTurnKey ? Date.now() + TURN_MS : null), [myTurnKey])
  const expire = () => {
    if (!match || !legalActions(match, ME).length) return
    const a = chooseAction(viewFor(match, ME), ME, Math.random, 'normal') // por vos juega bien, aunque la compu sea fácil
    if (a) act(ME, a)
  }
  const turnTimer = { deadline, total: TURN_MS, onExpire: expire }

  const nextHand = () => setMatch((m) => deal(m))
  /** Partida nueva: { players, target, flor, level } */
  const restart = (opts) => setMatch(newLocalMatch(opts))
  const quit = () => setMatch(null)

  return { match, view: match ? viewFor(match, ME) : null, me: ME, act, bubbles, nextHand, restart, quit, timer: turnTimer }
}

/** Partida nueva contra la compu. `level`: 'facil' | 'normal' | 'dificil'. */
export function newLocalMatch({ players = 2, target = 30, flor = true, level = 'normal' } = {}) {
  const m = createMatch({ players, target, flor })
  m.config.level = level // la compu lo lee de la partida
  return deal(m)
}
