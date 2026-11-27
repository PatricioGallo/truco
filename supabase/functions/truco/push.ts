// Notificaciones push (Web Push con claves VAPID).
// La clave privada vive en el secreto VAPID_PRIVATE_KEY de las Edge Functions.
// Si falta, los avisos simplemente no se mandan: el juego sigue andando igual.

export const VAPID_PUBLIC_KEY = 'BBGouHY2ycmG0xjmt-pOipVlrmWO6CltkfsPdJettHk5feu6x0dFo1pP9PJtXJ8PzB5KEGbRVzmpYFWIggb5j0U'

type Kind = 'invites' | 'friends' | 'test'
type Payload = { title: string; body: string; tag?: string; url?: string }

let webpush: any = null
async function client() {
  if (webpush) return webpush
  const secret = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!secret) return null
  // Se carga recién cuando hace falta, así un problema con la librería no afecta al juego
  const mod: any = await import('npm:web-push@3.6.7')
  const wp = mod.default ?? mod
  wp.setVapidDetails(Deno.env.get('SUPABASE_URL')!, VAPID_PUBLIC_KEY, secret)
  webpush = wp
  return wp
}

/** Manda un aviso a los celulares de esas personas (respetando lo que eligió cada una). */
export async function sendPush(admin: any, userIds: string[], kind: Kind, payload: Payload) {
  try {
    const ids = [...new Set(userIds.filter(Boolean))]
    if (!ids.length) return
    const wp = await client()
    if (!wp) return
    let targets = ids
    if (kind !== 'test') {
      const { data: settings } = await admin
        .from('truco_settings')
        .select('user_id, notify_invites, notify_friends')
        .in('user_id', ids)
      const off = new Set(
        (settings ?? [])
          .filter((s: any) => (kind === 'invites' ? !s.notify_invites : !s.notify_friends))
          .map((s: any) => s.user_id)
      )
      targets = ids.filter((id) => !off.has(id))
    }
    if (!targets.length) return
    const { data: subs } = await admin.from('truco_push_subs').select('endpoint, subscription').in('user_id', targets)
    await Promise.all(
      (subs ?? []).map(async (s: any) => {
        try {
          await wp.sendNotification(s.subscription, JSON.stringify({ url: './', ...payload }), { TTL: 3600 })
        } catch (e: any) {
          // El celular ya no acepta avisos (desinstaló o revocó el permiso): se borra
          if (e?.statusCode === 404 || e?.statusCode === 410) await admin.from('truco_push_subs').delete().eq('endpoint', s.endpoint)
          else console.error('push', e?.statusCode, e?.body ?? String(e))
        }
      })
    )
  } catch (e) {
    console.error('push', e)
  }
}
