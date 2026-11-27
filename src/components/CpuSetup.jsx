import { useState } from 'react'

const PREFS_KEY = 'truco.cpuPrefs'
const LEVEL_TEXT = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' }
const DEFAULTS = { players: 2, target: 30, flor: true, level: 'normal' }

function loadPrefs() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY)) }
  } catch {
    return DEFAULTS
  }
}
function savePrefs(p) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    /* sin storage */
  }
}

/** Opciones con botones tipo pestaña. */
function Choice({ label, value, options, onChange }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="segmented" role="tablist">
        {options.map(([v, text]) => (
          <button key={String(v)} type="button" role="tab" aria-selected={value === v} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Vos contra la máquina: retomar la partida guardada o armar una nueva. */
export default function CpuSetup({ saved, onResume, onStart, onBack }) {
  const [prefs, setPrefs] = useState(loadPrefs)
  const set = (k) => (v) => setPrefs((p) => ({ ...p, [k]: v }))
  const start = () => {
    savePrefs(prefs)
    onStart(prefs)
  }
  const c = saved?.config

  return (
    <main className="cpu-setup">
      <button className="back" onClick={onBack}>
        ‹ Volver
      </button>
      <h2 className="page-title">Contra la máquina</h2>

      {saved && (
        <section className="panel invites">
          <h3>Tenés una partida empezada</h3>
          <button className="room-row" onClick={onResume}>
            <span>
              {c.players === 2 ? 'Mano a mano' : 'De a cuatro'}{' '}
              <span className="muted">
                {saved.score[0]} a {saved.score[1]} · a {c.target} · {LEVEL_TEXT[c.level ?? 'normal']}
              </span>
            </span>
            <span className="tag tag-gold">Seguir</span>
          </button>
          <p className="muted small">Si empezás una nueva, esta se pierde.</p>
        </section>
      )}

      <section className="panel">
        <Choice
          label="Jugadores"
          value={prefs.players}
          options={[
            [2, 'Mano a mano'],
            [4, 'De a cuatro'],
          ]}
          onChange={set('players')}
        />
        <Choice
          label="Partida a"
          value={prefs.target}
          options={[
            [15, '15 puntos'],
            [30, '30 puntos'],
          ]}
          onChange={set('target')}
        />
        <Choice
          label="Dificultad"
          value={prefs.level}
          options={Object.entries(LEVEL_TEXT)}
          onChange={set('level')}
        />
        <label className="toggle">
          <input type="checkbox" checked={prefs.flor} onChange={(e) => set('flor')(e.target.checked)} />
          <span>Con flor</span>
        </label>
      </section>

      <button className="btn btn-primary" onClick={start}>
        {saved ? 'Empezar una nueva' : 'Jugar'}
      </button>
    </main>
  )
}
