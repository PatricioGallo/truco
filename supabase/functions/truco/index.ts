// Servidor del truco online (Supabase Edge Function).
// Reparte, valida cada jugada con el mismo motor que la app y juega la compu.
// Guarda el estado completo en truco_rooms (privado) y a cada jugador
// le escribe solo su vista en truco_views (que le llega en tiempo real).
//
// Al desplegar se suben también: server/rooms.js, engine/game.js, engine/cards.js, engine/ai.js

import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  createRoom,
  joinRoom,
  declineRoom,
  startWithCpu,
  actRoom,
  viewForUser,
  newCode,
  invitedUserIds,
} from './server/rooms.js'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

class UserError extends Error {}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const asUser = createClient(URL, ANON, { global: { headers: { Authorization: authHeader } } })
    const { data: auth } = await asUser.auth.getUser()
    const user = auth?.user
    if (!user) return json({ error: 'Iniciá sesión para jugar online.' }, 401)

    const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
    const body = await req.json()

    // Guarda la sala y la vista de cada invitado. `prevVersion` evita pisar jugadas simultáneas.
    async function save(room: any, prevVersion: number | null) {
      if (prevVersion === null) {
        const { error } = await admin
          .from('truco_rooms')
          .insert({ id: room.id, code: room.code, host_id: room.hostId, status: room.status, state: room, version: room.version })
        if (error) throw error
      } else {
        const { data, error } = await admin
          .from('truco_rooms')
          .update({ status: room.status, state: room, version: room.version, updated_at: new Date().toISOString() })
          .eq('id', room.id)
          .eq('version', prevVersion)
          .select('id')
        if (error) throw error
        if (!data?.length) throw new UserError('Alguien jugó al mismo tiempo. Probá de nuevo.')
      }
      const rows = invitedUserIds(room).map((uid: string) => ({
        room_id: room.id,
        user_id: uid,
        view: viewForUser(room, uid),
        version: room.version,
        updated_at: new Date().toISOString(),
      }))
      const { error: vErr } = await admin.from('truco_views').upsert(rows)
      if (vErr) throw vErr
    }

    async function load(where: { id?: string; code?: string }) {
      let q = admin.from('truco_rooms').select('state, version')
      q = where.id ? q.eq('id', where.id) : q.eq('code', String(where.code).toUpperCase())
      const { data, error } = await q.maybeSingle()
      if (error) throw error
      if (!data) throw new UserError('No encontramos esa partida.')
      return data.state
    }

    switch (body.op) {
      case 'create': {
        const players = body.players === 4 ? 4 : 2
        const seats = Array.isArray(body.seats) ? body.seats.slice(0, players) : []
        // Solo se puede invitar a amigos
        const invited = seats.filter((s: any) => s?.userId).map((s: any) => s.userId)
        if (invited.length) {
          const { data: friends } = await admin
            .from('friendships')
            .select('requester, addressee')
            .eq('status', 'accepted')
            .or(`requester.eq.${user.id},addressee.eq.${user.id}`)
          const ok = new Set((friends ?? []).map((f: any) => (f.requester === user.id ? f.addressee : f.requester)))
          if (!invited.every((id: string) => ok.has(id))) throw new UserError('Solo podés invitar a tus amigos.')
        }
        let room = null
        for (let attempt = 0; attempt < 5 && !room; attempt++) {
          const candidate = createRoom({
            id: crypto.randomUUID(),
            code: newCode(),
            hostId: user.id,
            players,
            flor: body.flor !== false,
            seats,
          })
          try {
            await save(candidate, null)
            room = candidate
          } catch (e: any) {
            if (!String(e?.message).includes('duplicate')) throw e
          }
        }
        if (!room) throw new UserError('No se pudo crear la sala. Probá de nuevo.')
        return json({ view: viewForUser(room, user.id) })
      }

      case 'join': {
        const prev = await load({ id: body.roomId, code: body.code })
        const room = joinRoom(prev, user.id)
        await save(room, prev.version)
        return json({ view: viewForUser(room, user.id) })
      }

      case 'decline': {
        const prev = await load({ id: body.roomId })
        const room = declineRoom(prev, user.id)
        await save(room, prev.version)
        await admin.from('truco_views').delete().eq('room_id', room.id).eq('user_id', user.id)
        return json({ ok: true })
      }

      case 'start': {
        const prev = await load({ id: body.roomId })
        const room = startWithCpu(prev, user.id)
        await save(room, prev.version)
        return json({ view: viewForUser(room, user.id) })
      }

      case 'act': {
        const prev = await load({ id: body.roomId })
        const room = actRoom(prev, user.id, body.action)
        await save(room, prev.version)
        return json({ view: viewForUser(room, user.id) })
      }

      case 'dismiss': {
        // Sacar de mi lista una partida terminada o cancelada
        await admin.from('truco_views').delete().eq('room_id', body.roomId).eq('user_id', user.id)
        return json({ ok: true })
      }

      default:
        throw new UserError('Operación desconocida')
    }
  } catch (e: any) {
    const isUser = e instanceof UserError || /inválida|empezó|completa|anfitrión|invitación|no estás|no está en juego|no terminó/i.test(e?.message ?? '')
    if (!isUser) console.error(e)
    return json({ error: isUser ? e.message : 'Algo salió mal en el servidor. Probá de nuevo.' }, isUser ? 400 : 500)
  }
})
