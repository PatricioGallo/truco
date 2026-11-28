import { useEffect, useState } from 'react'
import * as api from '@api'
import { displayName } from '../api/shared.js'
import Avatar from './Avatar.jsx'
import Icon from './Icon.jsx'

/** Buscador de jugadores, pedidos de amistad y lista de amigos. */
export default function Friends({ profile, data, reload, onPlayWith, onOpenPlayer, onBack }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      api
        .searchUsers(query, profile.id)
        .then(setResults)
        .catch((e) => setError(e.message))
    }, 250)
    return () => clearTimeout(t)
  }, [query, profile.id])

  const run = async (key, fn) => {
    setBusy(key)
    setError('')
    try {
      await fn()
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const relation = (id) => {
    if (data.friends.some((f) => f.profile.id === id)) return 'friend'
    if (data.outgoing.some((f) => f.profile.id === id)) return 'sent'
    if (data.incoming.some((f) => f.profile.id === id)) return 'incoming'
    return 'none'
  }

  return (
    <main className="friends">
      <button className="back" onClick={onBack}>
        ‹ Volver
      </button>
      <h2 className="page-title">Amigos</h2>

      <label className="search">
        <span className="search-icon" aria-hidden="true">
          <Icon name="search" size={20} strokeWidth={2} />
        </span>
        <input
          type="search"
          placeholder="Buscar por usuario o nombre"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
        />
      </label>
      {error && <p className="form-error">{error}</p>}

      {query.trim().length >= 2 && (
        <section className="panel">
          <h3>Resultados</h3>
          {results.length === 0 ? (
            <p className="muted">No encontramos a nadie con "{query.trim()}".</p>
          ) : (
            <ul className="people">
              {results.map((p) => {
                const rel = relation(p.id)
                const incoming = data.incoming.find((f) => f.profile.id === p.id)
                return (
                  <li key={p.id} className="person">
                    <button className="person-open" onClick={() => onOpenPlayer?.(p.id)} aria-label={`Ver perfil de ${displayName(p)}`}>
                      <Avatar profile={p} size={40} />
                    </button>
                    <span className="person-text">
                      <b className="person-link" onClick={() => onOpenPlayer?.(p.id)}>{displayName(p)}</b>
                      <span className="muted">@{p.username}</span>
                    </span>
                    {rel === 'none' && (
                      <button
                        className="btn btn-small btn-primary"
                        disabled={busy === p.id}
                        onClick={() => run(p.id, () => api.sendFriendRequest(profile.id, p.id))}
                      >
                        Agregar
                      </button>
                    )}
                    {rel === 'sent' && <span className="tag">Pedido enviado</span>}
                    {rel === 'friend' && <span className="tag tag-ok">Amigos</span>}
                    {rel === 'incoming' && (
                      <button
                        className="btn btn-small btn-accept"
                        onClick={() => run(p.id, () => api.acceptFriend(incoming.friendshipId))}
                      >
                        Aceptar
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {data.incoming.length > 0 && (
        <section className="panel">
          <h3>Te quieren agregar</h3>
          <ul className="people">
            {data.incoming.map(({ friendshipId, profile: p }) => (
              <li key={friendshipId} className="person">
                <button className="person-open" onClick={() => onOpenPlayer?.(p.id)} aria-label={`Ver perfil de ${displayName(p)}`}>
                      <Avatar profile={p} size={40} />
                    </button>
                <span className="person-text">
                  <b className="person-link" onClick={() => onOpenPlayer?.(p.id)}>{displayName(p)}</b>
                  <span className="muted">@{p.username}</span>
                </span>
                <span className="person-actions">
                  <button
                    className="btn btn-small btn-accept"
                    disabled={busy === friendshipId}
                    onClick={() => run(friendshipId, () => api.acceptFriend(friendshipId))}
                  >
                    Aceptar
                  </button>
                  <button
                    className="btn btn-small btn-ghost"
                    disabled={busy === friendshipId}
                    onClick={() => run(friendshipId, () => api.removeFriendship(friendshipId))}
                  >
                    No
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <h3>Tus amigos</h3>
        {data.friends.length === 0 ? (
          <p className="muted">Todavía no tenés amigos agregados. Buscalos por su usuario o su nombre.</p>
        ) : (
          <ul className="people">
            {data.friends.map(({ friendshipId, profile: p }) => (
              <li key={friendshipId} className="person">
                <button className="person-open" onClick={() => onOpenPlayer?.(p.id)} aria-label={`Ver perfil de ${displayName(p)}`}>
                      <Avatar profile={p} size={40} />
                    </button>
                <span className="person-text">
                  <b className="person-link" onClick={() => onOpenPlayer?.(p.id)}>{displayName(p)}</b>
                  <span className="muted">@{p.username}</span>
                </span>
                <button className="btn btn-small btn-truco" onClick={() => onPlayWith(p)}>
                  Jugar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.outgoing.length > 0 && (
        <p className="muted small">
          Pedidos enviados: {data.outgoing.map((f) => `@${f.profile.username}`).join(', ')}
        </p>
      )}
    </main>
  )
}
