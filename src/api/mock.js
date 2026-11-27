// Backend simulado para probar sin Supabase: `npm run dev:mock`.
// Todo vive en localStorage; la sesión es por pestaña (sessionStorage), así se
// pueden abrir dos pestañas con dos usuarios y jugar entre ellos.
import { normalizeUsername, normalizeEmail, looksLikeEmail, validateSignUp, validateEmail, resizeImage } from './shared.js'
import * as rooms from '../server/rooms.js'

export const configured = true
const KEY = 'truco.mockdb'
const SESSION = 'truco.mock.session'
const authListeners = new Set()
const roomListeners = new Set()
const wait = () => new Promise((r) => setTimeout(r, 80))
const net = async () => {
  await wait()
  if (!navigator.onLine) throw new Error('Sin conexión. Revisá internet y probá de nuevo.')
}

function db() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY))
    if (d) return d
  } catch {
    /* nada */
  }
  return { users: {}, profiles: {}, friendships: [], rooms: {}, views: {}, seq: 1 }
}
function save(d) {
  localStorage.setItem(KEY, JSON.stringify(d))
  notifyRooms()
}
const session = () => sessionStorage.getItem(SESSION)

// ---------- Cuenta ----------
export async function getSessionUser() {
  const id = session()
  return id ? { id } : null
}
export function onAuthChange(cb) {
  authListeners.add(cb)
  return () => authListeners.delete(cb)
}
const emitAuth = (u) => authListeners.forEach((cb) => cb(u))

export async function signIn(raw, password) {
  await net()
  const ident = normalizeUsername(raw)
  const u = Object.values(db().users).find((x) => (looksLikeEmail(ident) ? x.email === ident : x.username === ident))
  if (!u || u.password !== password) throw new Error('Usuario o contraseña incorrectos.')
  sessionStorage.setItem(SESSION, u.id)
  emitAuth({ id: u.id })
  return { id: u.id }
}
export async function signUp({ username: raw, password, firstName = '', lastName = '', email: rawEmail = '' }) {
  await net()
  const username = normalizeUsername(raw)
  const email = normalizeEmail(rawEmail)
  const invalid = validateSignUp({ username, password, firstName, lastName }) || validateEmail(email)
  if (invalid) throw new Error(invalid)
  const d = db()
  if (Object.values(d.users).some((x) => x.username === username)) throw new Error('Ese usuario ya existe. Elegí otro.')
  if (email && Object.values(d.users).some((x) => x.email === email)) throw new Error('Ese mail ya está en uso en otra cuenta.')
  const id = crypto.randomUUID()
  d.users[id] = { id, username, password, email: email || null }
  d.profiles[id] = { id, username, first_name: firstName.trim() || null, last_name: lastName.trim() || null, avatar_url: null }
  save(d)
  sessionStorage.setItem(SESSION, id)
  emitAuth({ id })
  return { id }
}
export async function signOut() {
  sessionStorage.removeItem(SESSION)
  emitAuth(null)
}
export async function getMyEmail(id) {
  await net()
  return db().users[id]?.email || ''
}
export async function setMyEmail(id, rawEmail) {
  await net()
  const email = normalizeEmail(rawEmail)
  const invalid = validateEmail(email)
  if (invalid) throw new Error(invalid)
  const d = db()
  if (email && Object.values(d.users).some((x) => x.id !== id && x.email === email))
    throw new Error('Ese mail ya está en uso en otra cuenta.')
  d.users[id].email = email || null
  save(d)
  return email
}
export async function getProfile(id) {
  await net()
  return db().profiles[id]
}
export async function profilesByIds(ids) {
  const d = db()
  return ids.map((id) => d.profiles[id]).filter(Boolean)
}
export async function uploadAvatar(id, file) {
  await net()
  const blob = await resizeImage(file)
  const url = await new Promise((res) => {
    const fr = new FileReader()
    fr.onload = () => res(fr.result)
    fr.readAsDataURL(blob)
  })
  const d = db()
  d.profiles[id].avatar_url = url
  save(d)
  return d.profiles[id]
}

// ---------- Amigos ----------
export async function searchUsers(query, myId) {
  await net()
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  return Object.values(db().profiles)
    .filter((p) => p.id !== myId && [p.username, p.first_name, p.last_name].some((x) => x?.toLowerCase().includes(q)))
    .slice(0, 20)
}
export async function friendsData(myId) {
  await net()
  const d = db()
  const out = { friends: [], incoming: [], outgoing: [] }
  for (const r of d.friendships) {
    if (r.requester !== myId && r.addressee !== myId) continue
    const item = { friendshipId: r.id, profile: d.profiles[r.requester === myId ? r.addressee : r.requester] }
    if (r.status === 'accepted') out.friends.push(item)
    else if (r.addressee === myId) out.incoming.push(item)
    else out.outgoing.push(item)
  }
  return out
}
export async function sendFriendRequest(myId, otherId) {
  await net()
  const d = db()
  if (d.friendships.some((f) => [f.requester, f.addressee].includes(myId) && [f.requester, f.addressee].includes(otherId)))
    throw new Error('Ya hay un pedido de amistad entre ustedes.')
  d.friendships.push({ id: d.seq++, requester: myId, addressee: otherId, status: 'pending' })
  save(d)
}
export async function acceptFriend(id) {
  await net()
  const d = db()
  d.friendships.find((f) => f.id === id).status = 'accepted'
  save(d)
}
export async function removeFriendship(id) {
  await net()
  const d = db()
  d.friendships = d.friendships.filter((f) => f.id !== id)
  save(d)
}

export function subscribeFriendships(myId, cb) {
  const onStorage = (e) => e.key === KEY && cb()
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}

// ---------- Partidas online (el "servidor" corre acá mismo) ----------
function persist(d, room) {
  d.rooms[room.id] = room
  for (const uid of rooms.invitedUserIds(room)) {
    d.views[room.id] ??= {}
    if (d.views[room.id][uid] !== 'dismissed') d.views[room.id][uid] = rooms.viewForUser(room, uid)
  }
  save(d)
}
const me = () => {
  const id = session()
  if (!id) throw new Error('Iniciá sesión para jugar online.')
  return id
}

export async function createRoom({ players, flor, seats }) {
  await net()
  const d = db()
  const uid = me()
  const room = rooms.createRoom({ id: crypto.randomUUID(), code: rooms.newCode(), hostId: uid, players, flor, seats })
  persist(d, room)
  return rooms.viewForUser(room, uid)
}
export async function joinRoom({ roomId, code }) {
  await net()
  const d = db()
  const prev = roomId ? d.rooms[roomId] : Object.values(d.rooms).find((r) => r.code === String(code).toUpperCase())
  if (!prev) throw new Error('No encontramos esa partida.')
  const room = rooms.joinRoom(prev, me())
  persist(d, room)
  return rooms.viewForUser(room, me())
}
export async function declineRoom(roomId) {
  await net()
  const d = db()
  const room = rooms.declineRoom(d.rooms[roomId], me())
  persist(d, room)
  delete d.views[roomId][me()]
  save(d)
}
export async function startRoom(roomId) {
  await net()
  const d = db()
  const room = rooms.startWithCpu(d.rooms[roomId], me())
  persist(d, room)
  return rooms.viewForUser(room, me())
}
export async function actRoom(roomId, action) {
  await net()
  const d = db()
  const room = rooms.actRoom(d.rooms[roomId], me(), action)
  persist(d, room)
  return rooms.viewForUser(room, me())
}
export async function timeoutRoom(roomId) {
  await net()
  const d = db()
  const room = rooms.timeoutRoom(d.rooms[roomId], me())
  persist(d, room)
  return rooms.viewForUser(room, me())
}
export async function getRoomView(roomId, myId) {
  await net()
  const v = db().views[roomId]?.[myId]
  return v && v !== 'dismissed' ? v : null
}
export async function dismissRoom(roomId) {
  const d = db()
  if (d.views[roomId]) d.views[roomId][me()] = 'dismissed'
  save(d)
}
export async function myRooms(myId) {
  await net()
  const d = db()
  return Object.values(d.views)
    .map((byUser) => byUser[myId])
    .filter((v) => v && v !== 'dismissed')
    .sort((a, b) => b.version - a.version)
}
export function subscribeRooms(myId, cb) {
  const fire = () => myRooms(myId).then((list) => list.forEach(cb)).catch(() => {})
  const listener = { myId, fire }
  roomListeners.add(listener)
  const onStorage = (e) => e.key === KEY && fire()
  window.addEventListener('storage', onStorage)
  return () => {
    roomListeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}
function notifyRooms() {
  setTimeout(() => roomListeners.forEach((l) => l.fire()), 0)
}

// Jugadores de ejemplo para probar el buscador
export function seedDemo() {
  const d = db()
  if (Object.keys(d.users).length) return
  for (const [username, f, l] of [
    ['lucia.m', 'Lucía', 'Méndez'],
    ['tomi_r', 'Tomás', 'Ríos'],
    ['caro', 'Carolina', null],
  ]) {
    const id = crypto.randomUUID()
    d.users[id] = { id, username, password: '123456' }
    d.profiles[id] = { id, username, first_name: f, last_name: l, avatar_url: null }
  }
  save(d)
}
