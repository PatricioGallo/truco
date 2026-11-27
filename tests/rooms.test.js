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

test('si se acaba el tiempo, la compu juega por quien no jugó', async () => {
  const { timeoutRoom, TURN_MS } = await import('../src/server/rooms.js')
  let r = createRoom({ id: 'r', code: 'X', hostId: A, players: 2, seats: [null, { userId: B }], now: 0 })
  r = joinRoom(r, B, 1000)
  const turnSeat = r.match.hand.turn
  assert.throws(() => timeoutRoom(r, A, 1000 + 5000), /Todavía hay tiempo/)
  // Cualquiera de los dos puede pedirlo (aunque no sea su turno)
  const asker = turnSeat === 0 ? B : A
  const after = timeoutRoom(r, asker, 1000 + TURN_MS)
  assert.equal(after.version, r.version + 1)
  assert.ok(after.match.log.some((e) => e.t === 'timeout' && e.seat === turnSeat))
  assert.equal(after.turnAt, 1000 + TURN_MS)
  // Un desconocido no puede
  assert.throws(() => timeoutRoom(r, C, 1000 + TURN_MS))
})

test('mesa pública: todos los lugares libres, a 15, y no arranca con la compu', async () => {
  const { lobbyEntry } = await import('../src/server/rooms.js')
  let r = createRoom({ id: 'p', code: 'PUB01', hostId: A, players: 4, target: 15, visibility: 'public', seats: [null, 'cpu', { userId: B }, 'cpu'] })
  assert.deepEqual(r.seats.map((s) => s.type), ['user', 'open', 'open', 'open'])
  assert.throws(() => startWithCpu(r, A), /solo con personas/)
  assert.deepEqual(lobbyEntry(r), { room_id: 'p', code: 'PUB01', host_id: A, players: 4, target: 15, flor: true, taken: 1, pair_open: true })
  r = joinRoom(r, B)
  r = joinRoom(r, C)
  assert.equal(lobbyEntry(r).taken, 3)
  r = joinRoom(r, 'user-d')
  assert.equal(r.status, 'playing')
  assert.equal(r.match.config.target, 15)
  assert.equal(lobbyEntry(r), null) // ya no aparece en la lista
  assert.equal(viewForUser(r, A).target, 15)
})

test('salir de una mesa que no arrancó: libera el lugar; si sale el anfitrión, se cierra', async () => {
  const { leaveRoom } = await import('../src/server/rooms.js')
  let r = createRoom({ id: 'p', code: 'X', hostId: A, players: 4, visibility: 'public' })
  r = joinRoom(r, B)
  assert.equal(r.seats[2].userId, B) // solo: primero el lugar del equipo del anfitrión
  r = leaveRoom(r, B)
  assert.equal(r.seats[2].type, 'open')
  assert.equal(r.status, 'waiting')
  r = leaveRoom(r, A)
  assert.equal(r.status, 'cancelled')
})

test('ausente: después del tiempo la compu juega por él hasta que vuelve', async () => {
  const { timeoutRoom, backRoom, TURN_MS } = await import('../src/server/rooms.js')
  let r = createRoom({ id: 'p', code: 'X', hostId: A, players: 2, visibility: 'public', now: 0 })
  r = joinRoom(r, B, 0)
  const absentSeat = r.match.hand.turn
  const absent = absentSeat === 0 ? A : B
  const present = absentSeat === 0 ? B : A
  r = timeoutRoom(r, present, TURN_MS)
  assert.equal(r.seats[absentSeat].away, true)
  // Mientras está ausente, cuando el que está le pasa el turno, la compu contesta al instante
  let guard = 0
  while (r.status === 'playing' && guard++ < 50) {
    const seat = absentSeat === 0 ? 1 : 0
    if (r.match.hand.finished) break
    const acts = legalActions(r.match, seat)
    assert.ok(acts.length, 'al que está presente siempre le toca')
    r = actRoom(r, present, acts.find((a) => a.type === 'play') ?? acts.find((a) => a.type === 'accept') ?? acts[0])
  }
  r = backRoom(r, absent)
  assert.equal(r.seats[absentSeat].away, undefined)
})

test('en una pública, irse no cancela: la compu termina la partida por quien se fue', () => {
  let r = createRoom({ id: 'p', code: 'X', hostId: A, players: 2, visibility: 'public' })
  r = joinRoom(r, B)
  r = actRoom(r, B, { type: 'leave' })
  assert.equal(r.status, 'playing')
  assert.equal(r.seats[1].left, true)
  let guard = 0
  while (r.status === 'playing' && guard++ < 2000) {
    if (r.match.hand.finished) { r = actRoom(r, A, { type: 'next' }); continue }
    const acts = legalActions(r.match, 0)
    assert.ok(acts.length)
    r = actRoom(r, A, acts.find((a) => a.type === 'play') ?? acts.find((a) => a.type === 'accept') ?? acts[0])
  }
  assert.equal(r.status, 'finished')
  assert.equal(r.seats[1].left, true)
})

test('dupla: crear mesa pública de a cuatro con un amigo de compañero', async () => {
  const { lobbyEntry } = await import('../src/server/rooms.js')
  let r = createRoom({ id: 'd', code: 'X', hostId: A, players: 4, visibility: 'public', partnerId: B })
  assert.deepEqual(r.seats.map((s) => s.type), ['user', 'open', 'user', 'open'])
  assert.equal(r.seats[2].joined, false)
  assert.equal(r.seats[2].invitedBy, A)
  assert.equal(lobbyEntry(r).taken, 2)
  assert.equal(lobbyEntry(r).pair_open, true) // quedan juntos los dos rivales
  // Si el amigo rechaza, el lugar queda libre (no entra la compu)
  const declined = declineRoom(r, B)
  assert.equal(declined.seats[2].type, 'open')
  r = joinRoom(r, B)
  assert.equal(r.seats[2].joined, true)
  // Privadas no aceptan compañero por este camino
  assert.throws(() => createRoom({ id: 'x', code: 'X', hostId: A, players: 4, partnerId: B }), /Compañero/)
})

test('dupla: sumarse con un amigo ocupa los dos lugares del equipo rival', async () => {
  const { lobbyEntry, leaveRoom } = await import('../src/server/rooms.js')
  const D = 'user-d'
  let r = createRoom({ id: 'd', code: 'X', hostId: A, players: 4, visibility: 'public' })
  r = joinRoom(r, C, Date.now(), { partnerId: D })
  assert.equal(r.seats[1].userId, C)
  assert.equal(r.seats[3].userId, D)
  assert.equal(r.seats[3].joined, false)
  assert.equal(r.seats[3].invitedBy, C)
  assert.equal(lobbyEntry(r).pair_open, false)
  // Ya no entra otra dupla, pero sí alguien solo (al lugar del anfitrión)
  assert.throws(() => joinRoom(r, B, Date.now(), { partnerId: 'user-e' }), /dos lugares/)
  const solo = joinRoom(r, B)
  assert.equal(solo.seats[2].userId, B)
  // Si el que armó la dupla se va antes de empezar, se libera también el lugar del amigo
  const gone = leaveRoom(r, C)
  assert.deepEqual(gone.seats.map((s) => s.type), ['user', 'open', 'open', 'open'])
  // Cuando entran todos, arranca
  r = joinRoom(solo, D)
  assert.equal(r.status, 'playing')
  assert.equal(r.seats[1].userId, C)
  assert.equal(r.seats[3].userId, D) // mismo equipo: asientos 1 y 3
})
