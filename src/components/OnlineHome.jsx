import { useState } from 'react'

/** Vos en modo online: crear mesa, sumarse con código, amigos y partidas en curso. */
export default function OnlineHome({ friends, rooms, onNew, onFriends, onOpenRoom, onJoinCode, onBack }) {
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const active = rooms.filter(
    (r) => ['waiting', 'playing'].includes(r.status) && !(r.status === 'waiting' && !r.seats[r.mySeat]?.joined)
  )
  const finished = rooms.filter((r) => r.status === 'finished').slice(0, 3)

  return (
    <main className="online-home">
      <button className="back" onClick={onBack}>
        ‹ Volver
      </button>
      <h2 className="page-title">Online</h2>

      {active.length > 0 && (
        <section className="block">
          <h2>Tus partidas</h2>
          <div className="room-list">
            {active.map((r) => (
              <button key={r.id} className="room-row" onClick={() => onOpenRoom(r.id)}>
                <span>
                  {r.players === 2 ? 'Mano a mano' : 'De a cuatro'}{' '}
                  <span className="muted">
                    {r.status === 'waiting'
                      ? `esperando jugadores (${r.code})`
                      : `${r.match?.score[r.mySeat % 2] ?? 0} a ${r.match?.score[1 - (r.mySeat % 2)] ?? 0}`}
                  </span>
                </span>
                <span className="tag tag-gold">{r.status === 'waiting' ? 'Sala' : 'Seguir'}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="block">
        <h2>Jugar</h2>
        <div className="mode-grid">
          <button className="mode mode-friends" onClick={onNew}>
            <span className="mode-title">Crear mesa</span>
            <span className="mode-sub">Invitá amigos o compartí el código</span>
          </button>
          <button className="mode mode-friends" onClick={onFriends}>
            <span className="mode-title">
              Amigos{friends.incoming.length > 0 && <span className="badge">{friends.incoming.length}</span>}
            </span>
            <span className="mode-sub">
              {friends.friends.length ? `${friends.friends.length} agregados` : 'Buscá y agregá jugadores'}
            </span>
          </button>
        </div>
        <form
          className="code-join"
          onSubmit={async (e) => {
            e.preventDefault()
            setCodeError('')
            try {
              await onJoinCode(code.trim())
            } catch (err) {
              setCodeError(err.message)
            }
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Código de mesa"
            maxLength={5}
            autoCapitalize="characters"
            autoCorrect="off"
          />
          <button className="btn btn-ghost" disabled={code.trim().length < 5}>
            Unirme
          </button>
        </form>
        {codeError && <p className="form-error">{codeError}</p>}
        {finished.length > 0 && (
          <p className="muted small">
            Últimas: {finished.map((r) => (r.match.winner === r.mySeat % 2 ? 'ganaste' : 'perdiste')).join(', ')}
          </p>
        )}
      </section>

      <p className="hint">Muy pronto: mesas abiertas de otros jugadores y ranking.</p>
    </main>
  )
}
