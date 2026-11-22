import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRoom, joinRoom, declineRoom, startWithCpu, actRoom, viewForUser } from '../src/server/rooms.js'
import { legalActions } from '../src/engine/game.js'

const A = 'user-a', B = 'user-b', C = 'user-c'

test('1v1 con un amigo: espera que acepte y arranca', () => {
  let r = createRoom({ id: 'r1', code: 'ABCDE', hostId: A, players: 2, seats: [null, { userId: B }] })
  assert.equal(r.status, 'waiting')
  assert.throws(() => actRoom(r, A, { type: 'play', card: 'x' }))
  r = joinRoom(r, B)
  assert.equal(r.status, 'playing')
  const va = viewForUser(r, A), vb = viewForUser(r, B)
  assert.equal(va.mySeat, 0); assert.equal(vb.mySeat, 1)
  assert.deepEqual(va.match.hand.cards[1], [null, null, null]) // no ve las cartas del otro
  assert.equal(vb.match.hand.cards[0][0], null)
})

test('un desconocido no puede jugar ni ver la partida', () => {
  let r = joinRoom(createRoom({ id: 'r', code: 'X', hostId: A, seats: [null, { userId: B }] }), B)
  assert.throws(() => actRoom(r, C, { type: 'mazo' }))
  assert.equal(viewForUser(r, C).match, null)
})

test('si rechaza la invitación juega la compu', () => {
  let r = createRoom({ id: 'r', code: 'X', hostId: A, seats: [null, { userId: B }] })
  r = declineRoom(r, B)
  assert.equal(r.status, 'playing')
  assert.equal(r.seats[1].type, 'cpu')
})

test('2v2 con un amigo de compañero y la compu en contra', () => {
  let r = createRoom({ id: 'r', code: 'X', hostId: A, players: 4, seats: [null, 'cpu', { userId: B }, 'cpu'] })
  r = joinRoom(r, B)
  assert.equal(r.status, 'playing')
  // Siempre le toca a una persona cuando el servidor devuelve la sala
  const humans = [A, B]
  let guard = 0
  while (r.status === 'playing' && guard++ < 3000) {
    if (r.match.hand.finished) { r = actRoom(r, A, { type: 'next' }); continue }
    const who = humans.find((u) => legalActions(r.match, r.seats.findIndex((s) => s.userId === u)).length)
    assert.ok(who, 'después de la compu siempre le toca a alguien')
    const seat = r.seats.findIndex((s) => s.userId === who)
    const acts = legalActions(r.match, seat)
    const plays = acts.filter((a) => a.type === 'play')
    const a = plays.length ? plays[0] : acts.find((x) => x.type === 'accept') ?? acts[0]
    r = actRoom(r, who, a)
  }
  assert.equal(r.status, 'finished')
  assert.equal(Math.max(...r.match.score), 30)
})

test('el anfitrión puede arrancar con la compu si falta gente; irse cancela', () => {
  let r = createRoom({ id: 'r', code: 'X', hostId: A, players: 4, seats: [null, { userId: B }, { userId: C }, null] })
  assert.throws(() => startWithCpu(r, B))
  r = joinRoom(r, C)
  r = startWithCpu(r, A)
  assert.equal(r.status, 'playing')
  assert.deepEqual(r.seats.map((s) => s.type), ['user', 'cpu', 'user', 'cpu'])
  r = actRoom(r, C, { type: 'leave' })
  assert.equal(r.status, 'cancelled')
})

test('con el código se puede sumar alguien a un asiento libre', () => {
  let r = createRoom({ id: 'r', code: 'X', hostId: A, players: 2, seats: [null, null] })
  r = joinRoom(r, C)
  assert.equal(r.status, 'playing')
  assert.equal(r.seats[1].userId, C)
  assert.throws(() => joinRoom(r, B))
})
