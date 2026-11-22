// Partida contra la compu: el jugador es el asiento 0; el resto juega la IA.
import { useCallback, useEffect, useRef, useState } from 'react'
import { createMatch, deal, apply, legalActions, viewFor, teamOf, myEnvidoPoints } from './engine/game.js'
import { chooseAction } from './engine/ai.js'
import { actionText } from './texts.js'

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

  const nextHand = () => setMatch((m) => deal(m))
  const restart = (players, flor) => setMatch(deal(createMatch({ players, flor })))
  const quit = () => setMatch(null)

  return { match, view: match ? viewFor(match, ME) : null, me: ME, act, bubbles, nextHand, restart, quit }
}

export function newLocalMatch(players, flor = true) {
  return deal(createMatch({ players, flor }))
}
