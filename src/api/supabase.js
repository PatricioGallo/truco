// Backend real: Supabase. Mismo proyecto y mismas cuentas que el Sudoku.
import { createClient, FunctionRegion } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js'
import {
  normalizeUsername,
  normalizeEmail,
  looksLikeEmail,
  validateSignUp,
  validateEmail,
  resizeImage,
} from './shared.js'

export const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
const sb = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

// Igual que en el Sudoku: así una cuenta sirve para los dos juegos
const EMAIL_DOMAIN = 'jugadores.sudoku-pato.app'
const toEmail = (username) => `${username}@${EMAIL_DOMAIN}`

function explain(error) {
  const msg = error?.message || ''
  if (/invalid login credentials/i.test(msg)) return 'Usuario o contraseña incorrectos.'
  if (/already registered|already exists/i.test(msg)) return 'Ese usuario ya existe. Elegí otro.'
  if (/database error saving new user/i.test(msg)) return 'No se pudo crear la cuenta. Puede que ese mail ya esté en uso.'
  if (/password should be at least/i.test(msg)) return 'La contraseña tiene que tener al menos 6 caracteres.'
  if (/fetch|network|load failed/i.test(msg)) return 'Sin conexión. Revisá internet y probá de nuevo.'
  return msg || 'Algo salió mal. Probá de nuevo.'
}
const check = ({ data, error }) => {
  if (error) throw new Error(explain(error))
  return data
}

// ---------- Cuenta ----------
export async function getSessionUser() {
  const { data } = await sb.auth.getSession()
  return data.session?.user ?? null
}
export function onAuthChange(cb) {
  const { data } = sb.auth.onAuthStateChange((_e, session) => cb(session?.user ?? null))
  return () => data.subscription.unsubscribe()
}
// Se puede entrar con el usuario o con el mail que la persona cargó
export async function signIn(raw, password) {
  let username = normalizeUsername(raw)
  if (looksLikeEmail(username)) {
    username = check(await sb.rpc('username_for_email', { p_email: normalizeEmail(raw) }))
    if (!username) throw new Error('Usuario o contraseña incorrectos.')
  }
  return check(await sb.auth.signInWithPassword({ email: toEmail(username), password })).user
}
export async function signUp({ username: raw, password, firstName = '', lastName = '', email: rawEmail = '' }) {
  const username = normalizeUsername(raw)
  const email = normalizeEmail(rawEmail)
  const invalid = validateSignUp({ username, password, firstName, lastName }) || validateEmail(email)
  if (invalid) throw new Error(invalid)
  const taken = check(await sb.from('profiles').select('id').eq('username', username).maybeSingle())
  if (taken) throw new Error('Ese usuario ya existe. Elegí otro.')
  if (email && check(await sb.rpc('username_for_email', { p_email: email })))
    throw new Error('Ese mail ya está en uso en otra cuenta.')
  const data = check(
    await sb.auth.signUp({
      email: toEmail(username),
      password,
      options: {
        data: { username, first_name: firstName.trim(), last_name: lastName.trim(), ...(email && { contact_email: email }) },
      },
    })
  )
  if (!data.session) throw new Error('La cuenta se creó pero falta confirmarla. Probá entrar en un rato.')
  return data.user
}
export const signOut = () => sb.auth.signOut()

/** El mail para entrar (solo lo ve el dueño). '' si no cargó ninguno. */
export async function getMyEmail(userId) {
  const row = check(await sb.from('account_emails').select('email').eq('user_id', userId).maybeSingle())
  return row?.email ?? ''
}
/** Guarda, cambia o (con '') borra el mail para entrar. */
export async function setMyEmail(userId, rawEmail) {
  const email = normalizeEmail(rawEmail)
  const invalid = validateEmail(email)
  if (invalid) throw new Error(invalid)
  if (!email) {
    check(await sb.from('account_emails').delete().eq('user_id', userId))
    return ''
  }
  const { error } = await sb
    .from('account_emails')
    .upsert({ user_id: userId, email, updated_at: new Date().toISOString() })
  if (error?.code === '23505') throw new Error('Ese mail ya está en uso en otra cuenta.')
  if (error) throw new Error(explain(error))
  return email
}

export async function getProfile(id) {
  return check(await sb.from('profiles').select('*').eq('id', id).single())
}
export async function profilesByIds(ids) {
  if (!ids.length) return []
  return check(await sb.from('profiles').select('id, username, first_name, last_name, avatar_url').in('id', ids))
}
export async function uploadAvatar(userId, file) {
  const blob = await resizeImage(file)
  const path = `${userId}/avatar.jpg`
  check(await sb.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' }))
  const url = `${sb.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
  return check(await sb.from('profiles').update({ avatar_url: url }).eq('id', userId).select().single())
}

// ---------- Amigos ----------
/** Busca jugadores por usuario, nombre o apellido. */
export async function searchUsers(query, myId) {
  const q = query.trim().replace(/[%,()]/g, '')
  if (q.length < 2) return []
  const rows = check(
    await sb
      .from('profiles')
      .select('id, username, first_name, last_name, avatar_url')
      .or(`username.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      .neq('id', myId)
      .order('username')
      .limit(20)
  )
  return rows
}

/** Amigos, pedidos recibidos y enviados. */
export async function friendsData(myId) {
  const rows = check(
    await sb
      .from('friendships')
      .select('id, requester, addressee, status')
      .or(`requester.eq.${myId},addressee.eq.${myId}`)
  )
  const otherOf = (r) => (r.requester === myId ? r.addressee : r.requester)
  const profiles = await profilesByIds([...new Set(rows.map(otherOf))])
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]))
  const out = { friends: [], incoming: [], outgoing: [] }
  for (const r of rows) {
    const item = { friendshipId: r.id, profile: byId[otherOf(r)] }
    if (!item.profile) continue
    if (r.status === 'accepted') out.friends.push(item)
    else if (r.addressee === myId) out.incoming.push(item)
    else out.outgoing.push(item)
  }
  return out
}

export async function sendFriendRequest(myId, otherId) {
  check(await sb.from('friendships').insert({ requester: myId, addressee: otherId }))
}
export async function acceptFriend(friendshipId) {
  check(await sb.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId))
}
export async function removeFriendship(friendshipId) {
  check(await sb.from('friendships').delete().eq('id', friendshipId))
}

/** Avisa cuando cambia algún pedido de amistad mío (recibido o enviado). */
export function subscribeFriendships(myId, cb) {
  const channel = sb
    .channel(`friendships-${myId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `addressee=eq.${myId}` }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `requester=eq.${myId}` }, cb)
    .subscribe()
  return () => sb.removeChannel(channel)
}

// ---------- Partidas online ----------
async function server(op, payload = {}) {
  // Se ejecuta en la misma región que la base de datos: cada jugada hace menos viajes largos
  const { data, error } = await sb.functions.invoke('truco', { body: { op, ...payload }, region: FunctionRegion.UsWest2 })
  if (error) {
    let msg = error.message
    try {
      msg = (await error.context.json()).error ?? msg
    } catch {
      /* respuesta sin JSON */
    }
    throw new Error(explain({ message: msg }))
  }
  return data
}

export const createRoom = (opts) => server('create', opts).then((d) => d.view)
export const joinRoom = (where) => server('join', where).then((d) => d.view)
export const declineRoom = (roomId) => server('decline', { roomId })
export const startRoom = (roomId) => server('start', { roomId }).then((d) => d.view)
export const actRoom = (roomId, action) => server('act', { roomId, action }).then((d) => d.view)
export const dismissRoom = (roomId) => server('dismiss', { roomId })
export const timeoutRoom = (roomId) => server('timeout', { roomId }).then((d) => d.view)
export const leaveRoom = (roomId) => server('leave', { roomId })
export const backRoom = (roomId) => server('back', { roomId }).then((d) => d.view)

/** Mesas públicas esperando gente (las de la última media hora). */
export async function openTables() {
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  return check(
    await sb.from('truco_lobby').select('*').gt('updated_at', since).order('created_at', { ascending: false }).limit(50)
  )
}

/** Avisa cuando cambia la lista de mesas abiertas. */
export function subscribeLobby(cb) {
  const channel = sb
    .channel('truco-lobby')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'truco_lobby' }, () => cb())
    .subscribe()
  return () => sb.removeChannel(channel)
}

/** Mi vista de una partida (por si se perdió algún aviso en tiempo real). */
export async function getRoomView(roomId, myId) {
  const row = check(await sb.from('truco_views').select('view').eq('room_id', roomId).eq('user_id', myId).maybeSingle())
  return row?.view ?? null
}

/** Mis partidas (invitaciones, en juego y terminadas). */
export async function myRooms(myId) {
  const rows = check(
    await sb.from('truco_views').select('view').eq('user_id', myId).order('updated_at', { ascending: false }).limit(30)
  )
  return rows.map((r) => r.view)
}

/** Avisa cada vez que cambia alguna de mis partidas. */
export function subscribeRooms(myId, cb) {
  const channel = sb
    .channel(`truco-views-${myId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'truco_views', filter: `user_id=eq.${myId}` }, (p) => {
      if (p.new?.view) cb(p.new.view)
    })
    .subscribe()
  return () => sb.removeChannel(channel)
}
