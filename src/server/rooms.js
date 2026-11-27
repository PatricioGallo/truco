// Salas online: la lógica que corre en el servidor (y en el servidor simulado).
// La sala guarda el partido completo (con todas las cartas); a cada jugador
// solo se le manda su vista (viewFor), así nadie puede ver cartas ajenas.

import { createMatch, deal, apply, legalActions, viewFor, teamOf } from '../engine/game.js'
import { chooseAction } from '../engine/ai.js'

const clone = (x) => JSON.parse(JSON.stringify(x))

/** Tiempo para cada jugada. Si se acaba, la compu juega por quien no jugó. */
export const TURN_MS = 30000
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function newCode(random = Math.random) {
  return Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(random() * CODE_CHARS.length)]).join('')
}

/**
 * Crea una mesa.
 * @param visibility 'private': con invitados, código y la compu si falta gente.
 *                   'public': aparece en la lista de mesas abiertas y arranca solo con personas.
 * @param seats (solo privadas) lista por asiento: { userId } invitado, 'cpu' o null (libre para quien tenga el código)
 * El anfitrión siempre es el asiento 0.
 */
export function createRoom({ id, code, hostId, players = 2, flor = true, target = 30, visibility = 'private', seats, now = Date.now() }) {
  if (players !== 2 && players !== 4) throw new Error('Se juega de a 2 o de a 4')
  if (target !== 15 && target !== 30) throw new Error('Se juega a 15 o a 30')
  const isPublic = visibility === 'public'
  const list = Array.from({ length: players }, (_, s) => (s === 0 ? { userId: hostId } : isPublic ? null : seats?.[s] ?? null))
  const room = {
    id,
    code,
    hostId,
    players,
    flor,
    target,
    visibility: isPublic ? 'public' : 'private',
    status: 'waiting', // waiting | playing | finished | cancelled
    seats: list.map((x) =>
      x === 'cpu' ? { type: 'cpu' } : x?.userId ? { type: 'user', userId: x.userId, joined: x.userId === hostId } : { type: 'open' }
    ),
    match: null,
    version: 0,
    turnAt: now,
  }
  return maybeStart(room)
}

export const seatOf = (room, userId) => room.seats.findIndex((s) => s.type === 'user' && s.userId === userId)
export const invitedUserIds = (room) => room.seats.filter((s) => s.type === 'user').map((s) => s.userId)
export const memberIds = (room) => room.seats.filter((s) => s.type === 'user' && s.joined).map((s) => s.userId)
/** Asientos que juega la compu: los suyos y los de quien está ausente. */
const isBot = (s) => s.type === 'cpu' || (s.type === 'user' && s.away)

function maybeStart(room) {
  if (room.status === 'waiting' && room.seats.every((s) => s.type === 'cpu' || (s.type === 'user' && s.joined))) {
    room.status = 'playing'
    room.match = deal(createMatch({ players: room.players, flor: room.flor, target: room.target ?? 30 }))
    runCpu(room)
  }
  return room
}

/** Se suma a la sala: si estaba invitado ocupa su asiento; si no, el primero libre. */
export function joinRoom(prev, userId, now = Date.now()) {
  const room = clone(prev)
  if (room.status !== 'waiting') throw new Error('La partida ya empezó')
  let seat = seatOf(room, userId)
  if (seat === -1) {
    seat = room.seats.findIndex((s) => s.type === 'open')
    if (seat === -1) throw new Error('La sala está completa')
    room.seats[seat] = { type: 'user', userId, joined: true }
  } else room.seats[seat].joined = true
  room.version++
  room.turnAt = now
  return maybeStart(room)
}

/** Rechazar una invitación: el asiento lo ocupa la compu. */
export function declineRoom(prev, userId, now = Date.now()) {
  const room = clone(prev)
  const seat = seatOf(room, userId)
  if (seat <= 0 || room.status !== 'waiting') throw new Error('No hay invitación para rechazar')
  room.seats[seat] = { type: 'cpu' }
  room.version++
  room.turnAt = now
  return maybeStart(room)
}

/** El anfitrión completa con la compu los asientos que faltan y arranca. */
export function startWithCpu(prev, userId, now = Date.now()) {
  const room = clone(prev)
  if (room.hostId !== userId) throw new Error('Solo el anfitrión puede arrancar')
  if (room.status !== 'waiting') throw new Error('La partida ya empezó')
  if (room.visibility === 'public') throw new Error('Las mesas públicas arrancan solo con personas')
  room.seats = room.seats.map((s) => (s.type === 'user' && s.joined ? s : { type: 'cpu' }))
  room.version++
  room.turnAt = now
  return maybeStart(room)
}

/** Salir de una mesa que todavía no arrancó. Si sale el anfitrión, la mesa se cierra. */
export function leaveRoom(prev, userId, now = Date.now()) {
  const room = clone(prev)
  if (room.status !== 'waiting') throw new Error('La partida ya empezó')
  const seat = seatOf(room, userId)
  if (seat === -1) throw new Error('No estás en esta partida')
  if (seat === 0) {
    room.status = 'cancelled'
    room.leftBy = userId
  } else room.seats[seat] = { type: 'open' }
  room.version++
  room.turnAt = now
  return room
}

/** Vuelve a jugar quien estaba ausente (mientras tanto jugó la compu por él). */
export function backRoom(prev, userId, now = Date.now()) {
  const room = clone(prev)
  const seat = seatOf(room, userId)
  if (seat === -1) throw new Error('No estás en esta partida')
  if (!room.seats[seat].away) return room
  delete room.seats[seat].away
  room.version++
  room.turnAt = now
  return room
}

/** Juega la compu en sus asientos (y en los de los ausentes) hasta que le toque a una persona. */
function runCpu(room, random = Math.random) {
  let guard = 0
  while (room.match && room.match.winner === null && !room.match.hand.finished && guard++ < 200) {
    const seat = room.seats.findIndex((s, i) => isBot(s) && legalActions(room.match, i).length)
    if (seat === -1) break
    // Si una persona también puede responder (2v2, mismo equipo), le dejamos la decisión
    const humanCan = room.seats.some(
      (s, i) => !isBot(s) && teamOf(i) === teamOf(seat) && legalActions(room.match, i).length
    )
    if (humanCan) break
    const action = chooseAction(viewFor(room.match, seat), seat, random)
    room.match = apply(room.match, seat, action)
  }
}

/** Acción de una persona: jugar, cantar, responder, irse al mazo o pasar a la mano siguiente. */
export function actRoom(prev, userId, action, now = Date.now()) {
  const room = clone(prev)
  if (room.status !== 'playing') throw new Error('La partida no está en juego')
  const seat = seatOf(room, userId)
  if (seat === -1) throw new Error('No estás en esta partida')
  if (action.type !== 'leave') {
    // Si juega, ya no está ausente
    delete room.seats[seat].away
    delete room.seats[seat].left
  }
  if (action.type === 'next') {
    if (!room.match.hand.finished || room.match.winner !== null) throw new Error('La mano no terminó')
    room.match = deal(room.match)
  } else if (action.type === 'leave') {
    if (room.visibility === 'public') {
      // En las públicas la partida sigue: la compu juega por quien se fue
      room.seats[seat].away = true
      room.seats[seat].left = true
    } else {
      room.status = 'cancelled'
      room.leftBy = userId
    }
  } else {
    room.match = apply(room.match, seat, action)
  }
  runCpu(room)
  if (room.match?.winner !== null && room.match?.winner !== undefined) room.status = 'finished'
  room.version++
  room.turnAt = now
  return room
}

/**
 * Se acabó el tiempo: la compu hace la jugada de quien no jugó (o reparte la mano siguiente).
 * Lo puede pedir cualquiera de la partida, así no se traba si alguien cerró la app.
 */
export function timeoutRoom(prev, userId, now = Date.now()) {
  const room = clone(prev)
  if (room.status !== 'playing') throw new Error('La partida no está en juego')
  if (seatOf(room, userId) === -1) throw new Error('No estás en esta partida')
  if (now - (room.turnAt ?? 0) < TURN_MS - 1500) throw new Error('Todavía hay tiempo para jugar')
  const m = room.match
  if (m.hand.finished) {
    if (m.winner === null) room.match = deal(m)
  } else {
    const seat = room.seats.findIndex((s, i) => s.type === 'user' && legalActions(m, i).length)
    if (seat === -1) throw new Error('No hay ninguna jugada pendiente')
    room.match = apply(m, seat, chooseAction(viewFor(m, seat), seat))
    room.match.log.push({ t: 'timeout', seat })
    room.seats[seat].away = true // hasta que vuelva, juega la compu por él
  }
  runCpu(room)
  if (room.match.winner !== null) room.status = 'finished'
  room.version++
  room.turnAt = now
  return room
}

/** Lo que ve cada jugador: datos de la sala + su vista del partido. */
export function viewForUser(room, userId) {
  const seat = seatOf(room, userId)
  return {
    id: room.id,
    code: room.code,
    players: room.players,
    flor: room.flor,
    target: room.target ?? 30,
    visibility: room.visibility ?? 'private',
    hostId: room.hostId,
    status: room.status,
    seats: room.seats,
    mySeat: seat,
    version: room.version,
    match: room.match && seat !== -1 ? viewFor(room.match, seat) : null,
    leftBy: room.leftBy ?? null,
    turnAt: room.turnAt ?? null,
  }
}

/** Fila para la lista de mesas abiertas (sin cartas). null si la mesa no tiene que aparecer. */
export function lobbyEntry(room) {
  if (room.visibility !== 'public' || room.status !== 'waiting') return null
  return {
    room_id: room.id,
    code: room.code,
    host_id: room.hostId,
    players: room.players,
    target: room.target ?? 30,
    flor: room.flor,
    taken: room.seats.filter((s) => s.type === 'user').length,
  }
}
