import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LEVEL_MIN, LEVEL_CARDS, levelOf, rateOne, rateRoom, NEW_PLAYER } from '../src/server/ranking.js'

test('niveles: 14 cartas, del 4 de copas al ancho de espada, cada vez más caros', () => {
  assert.equal(LEVEL_CARDS.length, 14)
  assert.equal(LEVEL_CARDS[0].name, '4 de copas')
  assert.equal(LEVEL_CARDS[13].name, 'Ancho de espada')
  for (let i = 2; i < LEVEL_MIN.length; i++) {
    assert.ok(LEVEL_MIN[i] - LEVEL_MIN[i - 1] > LEVEL_MIN[i - 1] - LEVEL_MIN[i - 2])
  }
  assert.equal(levelOf(0).level, 1)
  assert.equal(levelOf(49).level, 1)
  assert.equal(levelOf(50).level, 2)
  assert.equal(levelOf(10 ** 9).level, 14)
  assert.equal(levelOf(10 ** 9).next, null)
  console.log('  puntos para cada nivel:', LEVEL_MIN.join(', '))
})

test('a 30 vale más que a 15; ganar suma y perder resta (poco en niveles bajos)', () => {
  const p = { ...NEW_PLAYER, points: 200, mmr: 1000, games: 30 }
  const w30 = rateOne(p, 1000, true, 30)
  const w15 = rateOne(p, 1000, true, 15)
  const l30 = rateOne(p, 1000, false, 30)
  assert.ok(w30.delta > w15.delta)
  assert.ok(w30.delta > 0 && l30.delta < 0)
  assert.ok(Math.abs(l30.delta) < w30.delta)
  // En un nivel alto se pierde más
  const high = { ...NEW_PLAYER, points: 15000, mmr: 1500, games: 300 }
  const lowLoss = rateOne({ ...p, mmr: 850 }, 850, false, 30).delta
  const highLoss = rateOne(high, 1500, false, 30).delta
  assert.ok(Math.abs(highLoss) > Math.abs(lowLoss))
  // Nunca baja de cero
  assert.equal(rateOne(NEW_PLAYER, 1400, false, 30).points, 0)
})

test('racha: muchas victorias seguidas suben más rápido; derrotas seguidas bajan más', () => {
  const base = { ...NEW_PLAYER, points: 300, mmr: 1100, games: 50 }
  const normal = rateOne({ ...base, streak: 0 }, 1100, true, 30).delta
  const hot = rateOne({ ...base, streak: 5 }, 1100, true, 30).delta
  assert.ok(hot > normal)
  const lose = rateOne({ ...base, streak: 0 }, 1100, false, 30).delta
  const cold = rateOne({ ...base, streak: -5 }, 1100, false, 30).delta
  assert.ok(cold < lose)
})

test('se acomoda: cada jugador termina cerca de su nivel real y el fuerte sube rápido', () => {
  // Jugador con habilidad fija (Elo) contra rivales del nivel que muestra su carta
  const run = (skill, seed) => {
    let s = seed
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    let me = { ...NEW_PLAYER }
    const levels = []
    for (let g = 0; g < 400; g++) {
      const oppMmr = 1000 + (levelOf(me.points).level - 6) * 75
      const won = rnd() < 1 / (1 + 10 ** ((oppMmr - skill) / 400))
      me = { ...me, ...rateOne(me, oppMmr, won, 30) }
      levels.push(levelOf(me.points).level)
    }
    const last = levels.slice(-100)
    return { levels, avg: last.reduce((a, b) => a + b, 0) / last.length }
  }
  const strong = run(1300, 3) // le corresponde el nivel 10
  const average = run(1000, 5) // el 6
  const weak = run(775, 9) // el 3
  console.log(`  nivel promedio en las últimas 100: fuerte ${strong.avg.toFixed(1)}, promedio ${average.avg.toFixed(1)}, flojo ${weak.avg.toFixed(1)}`)
  console.log(`  el fuerte llegó al nivel 6 en la partida ${strong.levels.findIndex((l) => l >= 6) + 1}, al 9 en la ${strong.levels.findIndex((l) => l >= 9) + 1}`)
  assert.ok(Math.abs(strong.avg - 10) < 1.6)
  assert.ok(Math.abs(average.avg - 6) < 1.6)
  assert.ok(Math.abs(weak.avg - 3) < 1.6)
  assert.ok(strong.levels.findIndex((l) => l >= 6) < 60, 'el fuerte sube rápido')
})

const room = (seats, winner, target = 30) => ({
  visibility: 'public',
  status: 'finished',
  seats,
  match: { winner, config: { target } },
})
const u = (userId, extra = {}) => ({ type: 'user', userId, joined: true, ...extra })

test('mesa pública 1v1: el ganador suma y el perdedor resta', () => {
  const rows = rateRoom(room([u('a'), u('b')], 0))
  const a = rows.find((x) => x.user_id === 'a')
  const b = rows.find((x) => x.user_id === 'b')
  assert.ok(a.delta > 0)
  assert.ok(b.delta <= 0)
  assert.equal(a.wins, 1)
  assert.equal(b.streak, -1)
})

test('privadas no rankean', () => {
  assert.deepEqual(rateRoom({ ...room([u('a'), u('b')], 0), visibility: 'private' }), [])
})

test('abandono: si su equipo pierde, el rival suma y el que se fue resta', () => {
  const rows = rateRoom(room([u('a'), u('b', { left: true, away: true })], 0))
  assert.ok(rows.find((x) => x.user_id === 'a').delta > 0)
  assert.ok(rows.find((x) => x.user_id === 'b').delta <= 0)
})

test('abandono: si la compu ganó por él, ni él suma ni el rival resta', () => {
  const rows = rateRoom(room([u('a'), u('b', { away: true })], 1))
  assert.deepEqual(rows, [])
  // En 2v2 el compañero que se quedó sí suma la victoria
  const rows4 = rateRoom(room([u('a'), u('b'), u('c', { left: true, away: true }), u('d')], 0))
  assert.deepEqual(rows4.map((x) => x.user_id), ['a'])
})
