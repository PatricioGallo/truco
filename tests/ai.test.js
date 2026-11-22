import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMatch, deal, apply, legalActions, viewFor, teamOf } from '../src/engine/game.js'
import { chooseAction } from '../src/engine/ai.js'

function seeded(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
}

/** Juega un partido completo. `brain(seat)` devuelve 'ai' o 'random'. */
function playMatch(players, brain, rnd) {
  let m = deal(createMatch({ players }), rnd)
  let guard = 0
  while (m.winner === null) {
    if (m.hand.finished) {
      m = deal(m, rnd)
      continue
    }
    const seat = [...Array(players).keys()].find((s) => legalActions(m, s).length)
    const acts = legalActions(m, seat)
    let a
    if (brain(seat) === 'ai') a = chooseAction(viewFor(m, seat), seat, rnd)
    else {
      const plays = acts.filter((x) => x.type === 'play')
      const pool = plays.length && rnd() < 0.75 ? plays : acts.filter((x) => x.type !== 'mazo')
      a = pool[Math.floor(rnd() * pool.length)]
    }
    m = apply(m, seat, a)
    assert.ok(++guard < 4000)
  }
  return m.winner
}

test('la compu le gana a un jugador al azar la gran mayoría de las veces', () => {
  const rnd = seeded(42)
  for (const players of [2, 4]) {
    let wins = 0
    const N = 150
    for (let g = 0; g < N; g++) {
      const aiTeam = g % 2
      if (playMatch(players, (s) => (teamOf(s) === aiTeam ? 'ai' : 'random'), rnd) === aiTeam) wins++
    }
    console.log(`  ${players === 2 ? '1v1' : '2v2'}: la compu ganó ${wins} de ${N}`)
    assert.ok(wins / N > 0.75)
  }
})

test('compu contra compu: los partidos terminan y el reparto es parejo', () => {
  const rnd = seeded(7)
  const wins = [0, 0]
  for (let g = 0; g < 200; g++) wins[playMatch(2, () => 'ai', rnd)]++
  console.log(`  compu contra compu: ${wins[0]} a ${wins[1]}`)
  assert.ok(Math.min(...wins) > 60)
})
