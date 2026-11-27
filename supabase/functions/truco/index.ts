// Servidor del truco online (Supabase Edge Function).
// Reparte, valida cada jugada con el mismo motor que la app y juega la compu.
// Guarda el estado completo en truco_rooms (privado) y a cada jugador
// le escribe solo su vista en truco_views (que le llega en tiempo real).
//
// Al desplegar se suben también: server/rooms.js, engine/game.js, engine/cards.js, engine/ai.js
// La app la llama en la región us-west-2, la misma de la base, para que cada jugada sea rápida.

import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  createRoom,
  joinRoom,
  declineRoom,
  startWithCpu,
  actRoom,
  timeoutRoom,
  viewForUser,
  newCode,
  invitedUserIds,
  leaveRoom,
  backRoom,
  lobbyEntry,
} from './server/rooms.js'
import { rateRoom } from './server/ranking.js'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })

class UserError extends Error {}

/** ¿Son amigos? (solo se puede invitar o ir de compañero con amigos) */
async function friendIds(userId: string) {
  const { data } = await admin
    .from('friendships')
    .select('requester, addressee')
    .eq('status', 'accepted')
    .or(`requester.eq.${userId},addressee.eq.${userId}`)
  return new Set((data ?? []).map((f: any) => (f.requester === userId ? f.addressee : f.requester)))
}

/** El token ya lo validó Supabase antes de llegar acá (verify_jwt): solo leemos el usuario. */
function userIdFrom(req: Request): string | null {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.role === 'authenticated' && payload.sub ? payload.sub : null
  } catch {
    return null
  }
}

async function load(where: { id?: string; code?: string }) {
  let q = admin.from('truco_rooms').select('state')
  q = where.id ? q.eq('id', where.id) : q.eq('code', String(where.code).toUpperCase())
  const { data, error } = await q.maybeSingle()
  if (error) throw error
  if (!data) throw new UserError('No encontramos esa partida.')
  return data.state
}

/** Guarda la sala y la vista de cada invitado en una sola llamada. `prev` evita pisar jugadas simultáneas. */
async function save(room: any, prev: number | null) {
  const views = invitedUserIds(room).map((uid: string) => ({ user_id: uid, view: viewForUser(room, uid) }))
  const { data, error } = await admin.rpc('truco_save', {
    p_id: room.id,
    p_code: room.code,
    p_host: room.hostId,
    p_status: room.status,
    p_state: room,
    p_version: room.version,
    p_prev: prev,
    p_views: views,
  })
  if (error) throw error
  if (data === false) throw new UserError('Alguien jugó al mismo tiempo. Probá de nuevo.')
  await syncLobby(room)
  if (room.status === 'finished' && room.visibility === 'public') await applyRanking(room)
}

/** Al terminar una mesa pública, actualiza el ranking de quienes jugaron (una sola vez por partida). */
async function applyRanking(room: any) {
  try {
    const ids = invitedUserIds(room)
    const { data: already } = await admin.from('truco_rating_log').select('user_id').eq('room_id', room.id).limit(1)
    if (already?.length) return
    const { data } = await admin.from('truco_ratings').select('*').in('user_id', ids)
    const ratings = Object.fromEntries((data ?? []).map((r: any) => [r.user_id, r]))
    const rows = rateRoom(room, ratings)
    if (!rows.length) return
    const { error } = await admin.rpc('truco_apply_ratings', { p_room: room.id, p_rows: rows })
    if (error) throw error
  } catch (e) {
    console.error('ranking', e)
  }
}

/** Mantiene la lista de mesas abiertas: aparece mientras la mesa pública espera gente. */
async function syncLobby(room: any) {
  const entry = lobbyEntry(room)
  const { error } = entry
    ? await admin.from('truco_lobby').upsert({ ...entry, updated_at: new Date().toISOString() })
    : await admin.from('truco_lobby').delete().eq('room_id', room.id)
  if (error) console.error('lobby', error)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const userId = userIdFrom(req)
    if (!userId) return json({ error: 'Iniciá sesión para jugar online.' }, 401)
    const body = await req.json()

    const update = async (fn: (prev: any) => any, where: { id?: string; code?: string }) => {
      const prev = await load(where)
      const room = fn(prev)
      await save(room, prev.version)
      return json({ view: viewForUser(room, userId) })
    }

    switch (body.op) {
      case 'create': {
        const players = body.players === 4 ? 4 : 2
        const target = body.target === 15 ? 15 : 30
        const visibility = body.visibility === 'public' ? 'public' : 'private'
        const seats = visibility === 'private' && Array.isArray(body.seats) ? body.seats.slice(0, players) : []
        const partnerId = visibility === 'public' && players === 4 && body.partnerId ? String(body.partnerId) : null
        // Solo se puede invitar a amigos
        const invited = [...seats.filter((s: any) => s?.userId).map((s: any) => s.userId), ...(partnerId ? [partnerId] : [])]
        if (invited.length) {
          const ok = await friendIds(userId)
          if (!invited.every((id: string) => ok.has(id))) throw new UserError('Solo podés invitar a tus amigos.')
        }
        for (let attempt = 0; attempt < 5; attempt++) {
          const room = createRoom({ id: crypto.randomUUID(), code: newCode(), hostId: userId, players, flor: body.flor !== false, target, visibility, seats, partnerId })
          try {
            await save(room, null)
            return json({ view: viewForUser(room, userId) })
          } catch (e: any) {
            if (!String(e?.message).includes('duplicate')) throw e
          }
        }
        throw new UserError('No se pudo crear la sala. Probá de nuevo.')
      }

      case 'join': {
        const partnerId = body.partnerId ? String(body.partnerId) : null
        if (partnerId && !(await friendIds(userId)).has(partnerId)) throw new UserError('Solo podés ir de compañero con un amigo.')
        return await update((prev) => joinRoom(prev, userId, Date.now(), { partnerId }), { id: body.roomId, code: body.code })
      }

      case 'decline': {
        const prev = await load({ id: body.roomId })
        await save(declineRoom(prev, userId), prev.version)
        await admin.from('truco_views').delete().eq('room_id', body.roomId).eq('user_id', userId)
        return json({ ok: true })
      }

      case 'start':
        return await update((prev) => startWithCpu(prev, userId), { id: body.roomId })

      case 'act':
        return await update((prev) => actRoom(prev, userId, body.action), { id: body.roomId })

      case 'timeout':
        return await update((prev) => timeoutRoom(prev, userId), { id: body.roomId })

      case 'leave': {
        // Salir de una mesa que todavía no arrancó
        const prev = await load({ id: body.roomId })
        await save(leaveRoom(prev, userId), prev.version)
        await admin.from('truco_views').delete().eq('room_id', body.roomId).eq('user_id', userId)
        return json({ ok: true })
      }

      case 'back':
        return await update((prev) => backRoom(prev, userId), { id: body.roomId })

      case 'dismiss':
        await admin.from('truco_views').delete().eq('room_id', body.roomId).eq('user_id', userId)
        return json({ ok: true })

      default:
        throw new UserError('Operación desconocida')
    }
  } catch (e: any) {
    const isUser =
      e instanceof UserError ||
      /inválida|empezó|completa|anfitrión|invitación|no estás|no está en juego|no terminó|todavía hay tiempo|ninguna jugada|solo con personas|se juega a|compañero|dupla|dos lugares|ya estás/i.test(
        e?.message ?? ''
      )
    if (!isUser) console.error(e)
    return json({ error: isUser ? e.message : 'Algo salió mal en el servidor. Probá de nuevo.' }, isUser ? 400 : 500)
  }
})
