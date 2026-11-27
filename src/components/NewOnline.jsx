import { useState } from 'react'
import { displayName } from '../api/shared.js'

/** Crear una mesa online: pública (cualquiera se suma, suma puntos) o privada (amigos, código, compu). */
export default function NewOnline({ friends, preset, onCreate, onBack }) {
  const [visibility, setVisibility] = useState(preset ? 'private' : 'public')
  const [players, setPlayers] = useState(2)
  const [target, setTarget] = useState(30)
  const [flor, setFlor] = useState(true)
  const presetValue = preset ? `friend:${preset.id}` : null
  // asientos 1..n-1 (el 0 sos vos). En 2v2: 2 es tu compañero; 1 y 3, los rivales.
  const [seats, setSeats] = useState({ 1: presetValue ?? 'open', 2: 'cpu', 3: 'cpu' })
  const [partner, setPartner] = useState(preset?.id ?? '') // mesa pública de a cuatro: amigo de compañero
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isPublic = visibility === 'public'

  const switchPlayers = (n) => {
    setPlayers(n)
    setSeats(n === 2 ? { 1: presetValue ?? 'open', 2: 'cpu', 3: 'cpu' } : { 1: 'cpu', 2: presetValue ?? 'cpu', 3: 'cpu' })
  }

  const order = players === 2 ? [[1, 'Rival']] : [[2, 'Tu compañero'], [1, 'Rival 1'], [3, 'Rival 2']]
  const chosen = Object.entries(seats)
    .filter(([s]) => Number(s) < players)
    .map(([, v]) => v)
    .filter((v) => v.startsWith('friend:'))
  const repeated = !isPublic && chosen.length !== new Set(chosen).size

  const create = async () => {
    setBusy(true)
    setError('')
    try {
      const list = [null]
      if (!isPublic) {
        for (let s = 1; s < players; s++) {
          const v = seats[s]
          list.push(v === 'cpu' ? 'cpu' : v === 'open' ? null : { userId: v.slice(7) })
        }
      }
      await onCreate({ players, flor, target, visibility, seats: list, partnerId: isPublic && players === 4 && partner ? partner : null })
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const Tabs = ({ value, options, onChange }) => (
    <div className="segmented" role="tablist">
      {options.map(([v, text]) => (
        <button key={String(v)} type="button" role="tab" aria-selected={value === v} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  )

  return (
    <main className="new-online">
      <button className="back" onClick={onBack}>
        ‹ Volver
      </button>
      <h2 className="page-title">Crear mesa</h2>

      <Tabs
        value={visibility}
        options={[
          ['public', 'Pública'],
          ['private', 'Privada'],
        ]}
        onChange={setVisibility}
      />
      <p className="muted small">
        {isPublic
          ? 'Aparece en la lista de mesas abiertas y se suma cualquiera. Arranca cuando se llena y suma puntos para tu nivel y el ranking.'
          : 'Solo para tus amigos o quien tenga el código. Podés completar con la compu. No suma puntos.'}
      </p>

      <section className="panel">
        <div className="field">
          <span>Jugadores</span>
          <Tabs
            value={players}
            options={[
              [2, 'Mano a mano'],
              [4, 'De a cuatro'],
            ]}
            onChange={switchPlayers}
          />
        </div>
        <div className="field">
          <span>Partida a</span>
          <Tabs
            value={target}
            options={[
              [15, '15 puntos'],
              [30, '30 puntos'],
            ]}
            onChange={setTarget}
          />
        </div>
        {isPublic && players === 4 && (
          <label className="field">
            <span>Tu compañero</span>
            <select value={partner} onChange={(e) => setPartner(e.target.value)}>
              <option value="">Cualquiera que se sume</option>
              {friends.map(({ profile: p }) => (
                <option key={p.id} value={p.id}>
                  {displayName(p)} (@{p.username})
                </option>
              ))}
            </select>
          </label>
        )}
        {!isPublic &&
          order.map(([seat, label]) => (
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
        {!isPublic && friends.length === 0 && (
          <p className="muted small">Todavía no tenés amigos. Podés crear la mesa y pasarle el código a quien quieras.</p>
        )}
      </section>

      {repeated && <p className="form-error">Elegiste al mismo amigo en dos lugares.</p>}
      {error && <p className="form-error">{error}</p>}
      <button className="btn btn-primary" disabled={busy || repeated} onClick={create}>
        {busy ? 'Creando…' : isPublic ? 'Abrir mesa' : 'Crear mesa e invitar'}
      </button>
    </main>
  )
}
