import { useState } from 'react'
import { displayName } from '../api/shared.js'

/** Armar una partida con amigos: modo, flor y quién va en cada asiento. */
export default function NewOnline({ friends, preset, onCreate, onBack }) {
  const [players, setPlayers] = useState(2)
  const [flor, setFlor] = useState(true)
  const presetValue = preset ? `friend:${preset.id}` : null
  // asientos 1..n-1 (el 0 sos vos). En 2v2: 2 es tu compañero; 1 y 3, los rivales.
  const [seats, setSeats] = useState({ 1: presetValue ?? 'open', 2: 'cpu', 3: 'cpu' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const switchPlayers = (n) => {
    setPlayers(n)
    setSeats(n === 2 ? { 1: presetValue ?? 'open', 2: 'cpu', 3: 'cpu' } : { 1: 'cpu', 2: presetValue ?? 'cpu', 3: 'cpu' })
  }

  const order = players === 2 ? [[1, 'Rival']] : [[2, 'Tu compañero'], [1, 'Rival 1'], [3, 'Rival 2']]
  const chosen = Object.entries(seats)
    .filter(([s]) => Number(s) < players)
    .map(([, v]) => v)
    .filter((v) => v.startsWith('friend:'))
  const repeated = chosen.length !== new Set(chosen).size

  const create = async () => {
    setBusy(true)
    setError('')
    try {
      const list = [null]
      for (let s = 1; s < players; s++) {
        const v = seats[s]
        list.push(v === 'cpu' ? 'cpu' : v === 'open' ? null : { userId: v.slice(7) })
      }
      await onCreate({ players, flor, seats: list })
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <main className="new-online">
      <button className="back" onClick={onBack}>
        ‹ Volver
      </button>
      <h2 className="page-title">Jugar con amigos</h2>

      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={players === 2} onClick={() => switchPlayers(2)}>
          Mano a mano
        </button>
        <button role="tab" aria-selected={players === 4} onClick={() => switchPlayers(4)}>
          De a cuatro
        </button>
      </div>

      <section className="panel">
        {order.map(([seat, label]) => (
          <label key={seat} className="field">
            <span>{label}</span>
            <select value={seats[seat]} onChange={(e) => setSeats((x) => ({ ...x, [seat]: e.target.value }))}>
              <option value="cpu">La compu</option>
              <option value="open">Cualquiera con el código</option>
              {friends.map(({ profile: p }) => (
                <option key={p.id} value={`friend:${p.id}`}>
                  {displayName(p)} (@{p.username})
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="toggle">
          <input type="checkbox" checked={flor} onChange={(e) => setFlor(e.target.checked)} />
          <span>Con flor</span>
        </label>
        {friends.length === 0 && (
          <p className="muted small">Todavía no tenés amigos. Podés crear la sala y pasarle el código a quien quieras.</p>
        )}
      </section>

      {repeated && <p className="form-error">Elegiste al mismo amigo en dos lugares.</p>}
      {error && <p className="form-error">{error}</p>}
      <button className="btn btn-primary" disabled={busy || repeated} onClick={create}>
        {busy ? 'Creando…' : 'Crear partida e invitar'}
      </button>
    </main>
  )
}
