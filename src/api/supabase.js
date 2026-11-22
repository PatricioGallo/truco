// Backend real: Supabase. Mismo proyecto y mismas cuentas que el Sudoku.
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js'
import { normalizeUsername, validateSignUp, resizeImage } from './shared.js'

export const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
const sb = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

// Igual que en el Sudoku: así una cuenta sirve para los dos juegos
const EMAIL_DOMAIN = 'jugadores.sudoku-pato.app'
const toEmail = (username) => `${username}@${EMAIL_DOMAIN}`

function explain(error) {
  const msg = error?.message || ''
  if (/invalid login credentials/i.test(msg)) return 'Usuario o contraseña incorrectos.'
  if (/already registered|already exists/i.test(msg)) return 'Ese usuario ya existe. Elegí otro.'
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
export async function signIn(raw, password) {
  return check(await sb.auth.signInWithPassword({ email: toEmail(normalizeUsername(raw)), password })).user
}
export async function signUp({ username: raw, password, firstName = '', lastName = '' }) {
  const username = normalizeUsername(raw)
  const invalid = validateSignUp({ username, password, firstName, lastName })
  if (invalid) throw new Error(invalid)
  const taken = check(await sb.from('profiles').select('id').eq('username', username).maybeSingle())
  if (taken) throw new Error('Ese usuario ya existe. Elegí otro.')
  const data = check(
    await sb.auth.signUp({
      email: toEmail(username),
      password,
      options: { data: { username, first_name: firstName.trim(), last_name: lastName.trim() } },
    })
  )
  if (!data.session) throw new Error('La cuenta se creó pero falta confirmarla. Probá entrar en un rato.')
  return data.user
}
export const signOut = () => sb.auth.signOut()

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

// ---------- Partidas online ----------
async function server(op, payload = {}) {
  const { data, error } = await sb.functions.invoke('truco', { body: { op, ...payload } })
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
