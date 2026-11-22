import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rank, parseCard, envidoPoints, florPoints, hasFlor } from '../src/engine/cards.js'
import { createMatch, deal, apply, legalActions, handWinner, viewFor, faltaPoints } from '../src/engine/game.js'

const C = (id) => parseCard(id)

/** Partida con cartas fijas: hands = [['1e','7o','4c'], ...] por asiento. */
function fixed(hands, opts = {}, score) {
  let m = deal(createMatch({ players: hands.length, ...opts }))
  m.hand.cards = hands.map((h) => h.slice())
  m.hand.initial = hands.map((h) => h.slice())
  if (score) m.score = score.slice()
  return m
}
const act = (m, seat, a) => apply(m, seat, a)
const play = (m, seat, card) => apply(m, seat, { type: 'play', card })
const call = (m, seat, c) => apply(m, seat, { type: 'call', call: c })
const yes = (m, seat) => apply(m, seat, { type: 'accept' })
const no = (m, seat) => apply(m, seat, { type: 'reject' })
/** Ronda de cantar los puntos: cada uno dice los suyos si le alcanzan, si no "son buenas". */
function sayPoints(m) {
  const said = []
  while (m.hand.pending?.kind === 'declare') {
    const seat = [...Array(m.config.players).keys()].find((s) => legalActions(m, s).length)
    const acts = legalActions(m, seat)
    const a = acts.find((x) => x.type === 'declare') ?? acts[0]
    said.push([seat, a.type])
    m = apply(m, seat, a)
  }
  return [m, said]
}

test('jerarquía de cartas', () => {
  const order = ['1e', '1b', '7e', '7o', '3c', '2o', '1c', '12b', '11e', '10o', '7c', '6e', '5b', '4o']
  for (let i = 0; i < order.length - 1; i++) assert.ok(rank(C(order[i])) > rank(C(order[i + 1])), order[i])
  assert.equal(rank(C('1o')), rank(C('1c'))) // anchos falsos
  assert.equal(rank(C('7b')), rank(C('7c')))
})

test('envido y flor', () => {
  assert.equal(envidoPoints(['7e', '6e', '1o'].map(C)), 33)
  assert.equal(envidoPoints(['12e', '11e', '1o'].map(C)), 20)
  assert.equal(envidoPoints(['4o', '5c', '6b'].map(C)), 6)
  assert.equal(envidoPoints(['12o', '10c', '11b'].map(C)), 0)
  assert.ok(hasFlor(['7e', '6e', '5e'].map(C)))
  assert.equal(florPoints(['7e', '6e', '12e'].map(C)), 33)
})

test('quién gana la mano según las bazas', () => {
  const w = (...xs) => handWinner(xs.map((winner) => ({ winner })), 0)
  assert.equal(w(1, 1), 1)
  assert.equal(w(1, 'tie'), 1)
  assert.equal(w('tie', 1), 1)
  assert.equal(w(0, 1), null)
  assert.equal(w(0, 1, 1), 1)
  assert.equal(w(0, 1, 'tie'), 0) // primera y parda la tercera
  assert.equal(w('tie', 'tie', 1), 1)
  assert.equal(w('tie', 'tie', 'tie'), 0) // gana el mano
})

test('mano simple sin cantos: 1 punto', () => {
  let m = fixed([['1e', '4c', '5c'], ['7o', '6b', '4o']])
  m = play(m, 0, '1e')
  m = play(m, 1, '4o')
  assert.equal(m.hand.turn, 0) // gana la baza y abre
  m = play(m, 0, '4c')
  m = play(m, 1, '7o')
  assert.equal(m.hand.turn, 1)
  m = play(m, 1, '6b')
  m = play(m, 0, '5c')
  assert.equal(m.hand.finished, true)
  assert.deepEqual(m.score, [0, 1]) // 1-1 y gana la tercera el 6
})

test('truco querido vale 2; no querido, 1', () => {
  let m = fixed([['1e', '1b', '4c'], ['5o', '6b', '4o']])
  m = call(m, 0, 'truco')
  assert.deepEqual(legalActions(m, 0), []) // espera respuesta
  m = yes(m, 1)
  m = play(m, 0, '1e'); m = play(m, 1, '4o')
  m = play(m, 0, '1b'); m = play(m, 1, '5o')
  assert.deepEqual(m.score, [2, 0])

  let n = fixed([['1e', '1b', '4c'], ['5o', '6b', '4o']])
  n = call(n, 0, 'truco')
  n = no(n, 1)
  assert.deepEqual(n.score, [1, 0])
})

test('retruco no querido da 2 a quien lo cantó; solo sube quien aceptó', () => {
  let m = fixed([['1e', '1b', '4c'], ['7e', '6b', '4o']])
  m = call(m, 0, 'truco')
  m = call(m, 1, 'retruco') // sube = acepta el truco
  m = no(m, 0)
  assert.deepEqual(m.score, [0, 2])

  let n = fixed([['1e', '1b', '4c'], ['7e', '6b', '4o']])
  n = call(n, 0, 'truco')
  n = yes(n, 1)
  assert.ok(!legalActions(n, 0).some((a) => a.call === 'retruco')) // el que cantó no puede subir
  n = play(n, 0, '4c')
  assert.ok(legalActions(n, 1).some((a) => a.call === 'retruco'))
})

test('envido querido: gana el de más puntos; empate gana el mano', () => {
  let m = fixed([['7e', '6e', '4c'], ['5o', '4o', '1b']]) // 33 contra 29
  m = call(m, 0, 'envido')
  m = yes(m, 1)
  let said
  ;[m, said] = sayPoints(m)
  assert.deepEqual(said, [[0, 'declare'], [1, 'buenas']]) // el mano dice 33; el otro: son buenas
  assert.deepEqual(m.score, [2, 0])
  assert.ok(m.log.some((e) => e.t === 'envido' && e.winner === 0 && e.points[1] === null))

  let t = fixed([['7c', '1c', '4b'], ['7e', '1e', '4o']]) // 28 y 28: gana el mano (asiento 0)
  t = play(t, 0, '4b')
  t = call(t, 1, 'envido')
  t = yes(t, 0)
  ;[t] = sayPoints(t)
  assert.deepEqual(t.score, [2, 0])
})

test('envido, envido, real envido no querido = 4; falta en las malas gana el partido', () => {
  let m = fixed([['7e', '6e', '4c'], ['5o', '4o', '1b']])
  m = call(m, 0, 'envido')
  m = call(m, 1, 'envido')
  m = call(m, 0, 'real')
  m = no(m, 1)
  assert.deepEqual(m.score, [4, 0])

  let f = fixed([['7e', '6e', '4c'], ['5o', '4o', '1b']], {}, [3, 10])
  assert.equal(faltaPoints(f, 0), 27) // en las malas: lo que le falta para ganar
  f = call(f, 0, 'falta')
  f = yes(f, 1)
  ;[f] = sayPoints(f)
  assert.equal(f.winner, 0)
  assert.deepEqual(f.score, [30, 10])

  const b = fixed([['7e', '6e', '4c'], ['5o', '4o', '1b']], {}, [20, 12])
  assert.equal(faltaPoints(b, 1), 10) // en las buenas: lo que le falta al que va ganando
})

test('el envido está primero: se puede contestar el truco con envido', () => {
  let m = fixed([['1e', '1b', '4c'], ['7e', '6e', '4o']])
  m = call(m, 0, 'truco')
  m = call(m, 1, 'envido')
  m = yes(m, 0)
  let said
  ;[m, said] = sayPoints(m)
  assert.deepEqual(said, [[0, 'declare'], [1, 'declare']]) // el mano dice 5, el otro 33
  assert.deepEqual(m.score, [0, 2]) // 33 contra 5
  assert.equal(m.hand.pending.kind, 'truco') // sigue pendiente el truco
  m = yes(m, 1)
  assert.equal(m.hand.truco.value, 2)
})

test('cantar los puntos: el mano primero; con menos solo se puede decir son buenas', () => {
  let m = fixed([['4c', '5o', '6b'], ['7e', '6e', '1o']]) // 6 contra 33
  m = call(m, 0, 'envido')
  m = yes(m, 1)
  assert.deepEqual(legalActions(m, 1), []) // primero habla el mano
  assert.deepEqual(legalActions(m, 0), [{ type: 'declare' }]) // el mano tiene que decirlos
  m = apply(m, 0, { type: 'declare' })
  assert.deepEqual(legalActions(m, 1), [{ type: 'declare' }, { type: 'buenas' }])
  // Quien dice "son buenas" pierde aunque tenga más, y sus cartas no se muestran
  m = apply(m, 1, { type: 'buenas' })
  assert.deepEqual(m.score, [2, 0])
  m = play(m, 0, '4c'); m = play(m, 1, '7e'); m = play(m, 1, '6e'); m = play(m, 0, '5o')
  assert.equal(m.hand.finished, true)
  const v = viewFor(m, 0)
  assert.equal(v.hand.initial[1], null)
})

test('cantar los puntos de a cuatro: va pasando y no habla el equipo que va ganando', () => {
  // mano asiento 0 (equipo 0). Envido: 0 tiene 25, 1 tiene 27, 2 (compañero de 0) tiene 31, 3 tiene 20
  let m = fixed([['5c', '10c', '4o'], ['7b', '10b', '4e'], ['6o', '5o', '1c'], ['12e', '11e', '10o']])
  m = call(m, 0, 'envido')
  m = yes(m, 1)
  let said
  ;[m, said] = sayPoints(m)
  assert.deepEqual(said, [
    [0, 'declare'], // 25
    [1, 'declare'], // 27, mejor
    [2, 'declare'], // 31, mejor
    [3, 'buenas'], // 20: son buenas
  ])
  assert.deepEqual(m.score, [2, 0])
})

test('flor sin flor en contra: 3 puntos y no hay envido', () => {
  let m = fixed([['7e', '6e', '5e'], ['7o', '6b', '4o']])
  assert.ok(!legalActions(m, 0).some((a) => a.call === 'envido'))
  m = call(m, 0, 'flor')
  assert.deepEqual(m.score, [3, 0])
  m = play(m, 0, '5e')
  assert.ok(!legalActions(m, 1).some((a) => a.call === 'envido'))
})

test('flor contra flor: contraflor querida vale 6; me achico, 4', () => {
  let m = fixed([['7e', '6e', '5e'], ['7o', '6o', '4o']]) // 38 contra 37
  m = call(m, 0, 'flor')
  m = call(m, 1, 'contraflor')
  m = yes(m, 0)
  assert.deepEqual(m.score, [6, 0])

  let a = fixed([['7e', '6e', '5e'], ['7o', '6o', '4o']])
  a = call(a, 0, 'flor')
  a = act(a, 1, { type: 'achico' })
  assert.deepEqual(a.score, [4, 0])
})

test('2v2: turnos, compañeros y parda', () => {
  // equipos: 0 y 2 contra 1 y 3
  let m = fixed([['3e', '4c', '5c'], ['3o', '4o', '5o'], ['1e', '6c', '7c'], ['2b', '6b', '7b']])
  m = play(m, 0, '3e')
  assert.equal(m.hand.turn, 1)
  m = play(m, 1, '3o')
  m = play(m, 2, '1e') // el compañero mata
  m = play(m, 3, '2b')
  assert.equal(m.hand.rounds[0].winner, 0)
  assert.equal(m.hand.turn, 2) // abre quien ganó la baza
  m = play(m, 2, '6c'); m = play(m, 3, '6b'); m = play(m, 0, '4c'); m = play(m, 1, '4o')
  assert.equal(m.hand.rounds[1].winner, 'tie') // 6 contra 6
  assert.deepEqual(m.score, [1, 0]) // primera ganada y segunda parda
})

test('la vista de un jugador no muestra las cartas ajenas', () => {
  const m = fixed([['1e', '1b', '4c'], ['7e', '6e', '4o']])
  const v = viewFor(m, 0)
  assert.deepEqual(v.hand.cards[0], ['1e', '1b', '4c'])
  assert.deepEqual(v.hand.cards[1], [null, null, null])
  assert.equal(v.hand.initial[1], null)
})

test('miles de partidas al azar terminan sin errores', () => {
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (const players of [2, 4]) {
    for (const flor of [true, false]) {
      for (let g = 0; g < 400; g++) {
        let m = deal(createMatch({ players, flor }), rnd)
        let steps = 0
        while (m.winner === null) {
          if (m.hand.finished) {
            m = deal(m, rnd)
            continue
          }
          const options = [...Array(players).keys()].flatMap((s) => legalActions(m, s).map((a) => [s, a]))
          assert.ok(options.length > 0, 'siempre alguien puede actuar')
          // jugar cartas más seguido que cantar, para que las partidas avancen
          const plays = options.filter(([, a]) => a.type === 'play')
          const pool = plays.length && rnd() < 0.7 ? plays : options.filter(([, a]) => a.type !== 'mazo' || rnd() < 0.1)
          const [s, a] = (pool.length ? pool : options)[Math.floor(rnd() * (pool.length || options.length))]
          m = apply(m, s, a)
          assert.ok(m.score.every((x) => x >= 0 && x <= 30))
          assert.ok(++steps < 5000)
        }
        assert.equal(m.score[m.winner], 30)
      }
    }
  }
})
