import { useEffect, useState } from 'react'
import * as api from '@api'
import { COUNTRIES, flagOf } from '../countries.js'
import { pushStatus, enablePush, disablePush, platform } from '../pwa.js'
import { InstallGuide } from './InstallBanner.jsx'
import Icon from './Icon.jsx'

/** Interruptor con título y explicación. */
function Switch({ label, hint, checked, disabled, onChange }) {
  return (
    <label className={`switch-row ${disabled ? 'is-disabled' : ''}`}>
      <span className="switch-text">
        <b>{label}</b>
        {hint && <span className="muted small">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden="true" />
    </label>
  )
}

function useSaving() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const run = async (fn, ok) => {
    setBusy(true)
    setMsg('')
    try {
      await fn()
      if (ok) setMsg(ok)
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }
  return { busy, msg, run, setMsg }
}

// ---------- Tus datos ----------
function PersonalData({ profile, settings, onProfile, onSettings }) {
  const [form, setForm] = useState({ first_name: profile.first_name ?? '', last_name: profile.last_name ?? '', country: settings.country ?? '' })
  const { busy, msg, run } = useSaving()
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const changed =
    form.first_name.trim() !== (profile.first_name ?? '') ||
    form.last_name.trim() !== (profile.last_name ?? '') ||
    form.country !== (settings.country ?? '')
  const submit = (e) => {
    e.preventDefault()
    run(async () => {
      onProfile(await api.updateMyProfile(profile.id, form))
      if (form.country !== (settings.country ?? '')) onSettings(await api.saveSettings(profile.id, { country: form.country || null }))
    }, 'Datos guardados.')
  }
  return (
    <form className="settings-block" onSubmit={submit}>
      <h3>Tus datos</h3>
      <p className="muted small">Nombre y apellido son los mismos del Sudoku: si los cambiás acá, cambian en los dos juegos.</p>
      <div className="field-row">
        <label className="field">
          <span>Nombre</span>
          <input value={form.first_name} onChange={set('first_name')} maxLength={40} autoComplete="given-name" />
        </label>
        <label className="field">
          <span>Apellido</span>
          <input value={form.last_name} onChange={set('last_name')} maxLength={40} autoComplete="family-name" />
        </label>
      </div>
      <label className="field">
        <span>Nacionalidad</span>
        <select value={form.country} onChange={set('country')}>
          <option value="">Sin elegir</option>
          {COUNTRIES.map(([code, name]) => (
            <option key={code} value={code}>
              {flagOf(code)} {name}
            </option>
          ))}
        </select>
      </label>
      {msg && <p className="muted small">{msg}</p>}
      {changed && (
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
      )}
    </form>
  )
}

// ---------- Mail para entrar ----------
function LoginEmail({ userId }) {
  const [saved, setSaved] = useState(null)
  const [email, setEmail] = useState('')
  const { busy, msg, run } = useSaving()
  useEffect(() => {
    let alive = true
    api
      .getMyEmail(userId)
      .then((e) => alive && (setSaved(e), setEmail(e)))
      .catch(() => alive && setSaved(''))
    return () => {
      alive = false
    }
  }, [userId])
  if (saved === null) return null
  const changed = email.trim().toLowerCase() !== saved
  const submit = (e) => {
    e.preventDefault()
    let value
    run(
      async () => {
        value = await api.setMyEmail(userId, email)
        setSaved(value)
        setEmail(value)
      },
      email.trim() ? 'Listo: ya podés entrar con este mail.' : 'Mail borrado.'
    )
  }
  return (
    <form className="settings-block" onSubmit={submit}>
      <h3>Mail para entrar</h3>
      <label className="field">
        <span>Opcional: podés entrar escribiendo el mail en vez del usuario</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck="false"
          placeholder="tu@mail.com"
        />
      </label>
      {msg && <p className="muted small">{msg}</p>}
      {changed && (
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Guardando…' : email.trim() ? 'Guardar mail' : 'Borrar mail'}
        </button>
      )}
    </form>
  )
}

// ---------- Contraseña ----------
function Password({ profile }) {
  const [form, setForm] = useState({ current: '', next: '', repeat: '' })
  const { busy, msg, run, setMsg } = useSaving()
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const submit = (e) => {
    e.preventDefault()
    if (form.next !== form.repeat) return setMsg('Las dos contraseñas nuevas no coinciden.')
    run(async () => {
      await api.changePassword(profile.username, form.current, form.next)
      setForm({ current: '', next: '', repeat: '' })
    }, 'Contraseña cambiada. La próxima vez entrá con la nueva (también en el Sudoku).')
  }
  return (
    <form className="settings-block" onSubmit={submit}>
      <h3>Contraseña</h3>
      <label className="field">
        <span>Contraseña actual</span>
        <input type="password" value={form.current} onChange={set('current')} autoComplete="current-password" />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Nueva</span>
          <input type="password" value={form.next} onChange={set('next')} autoComplete="new-password" minLength={6} />
        </label>
        <label className="field">
          <span>Repetila</span>
          <input type="password" value={form.repeat} onChange={set('repeat')} autoComplete="new-password" minLength={6} />
        </label>
      </div>
      {msg && <p className="muted small">{msg}</p>}
      <button className="btn btn-ghost" disabled={busy || !form.current || form.next.length < 6 || !form.repeat}>
        {busy ? 'Cambiando…' : 'Cambiar contraseña'}
      </button>
    </form>
  )
}

// ---------- Privacidad ----------
function Privacy({ profile, settings, onSettings }) {
  const { busy, msg, run } = useSaving()
  const toggle = (k) => (v) => run(async () => onSettings(await api.saveSettings(profile.id, { [k]: v })))
  return (
    <section className="settings-block">
      <h3>Privacidad</h3>
      <Switch
        label="Perfil privado"
        hint="Tus estadísticas (partidas, ganadas, perdidas, racha) y tu nacionalidad solo las ven tus amigos. Tu nombre, foto y nivel se siguen viendo."
        checked={settings.private_profile}
        disabled={busy}
        onChange={toggle('private_profile')}
      />
      {msg && <p className="form-error">{msg}</p>}
    </section>
  )
}

// ---------- Notificaciones ----------
const STATUS_TEXT = {
  'need-install': 'En iPhone, las notificaciones solo funcionan con la app instalada. Instalala (más abajo) y activalas desde ahí.',
  unsupported: 'Este navegador no permite notificaciones.',
  'no-sw': 'Las notificaciones se activan desde la app publicada (en esta versión de prueba no están).',
  denied: 'Bloqueaste las notificaciones para esta página. Habilitalas en los ajustes del navegador y volvé acá.',
}

function Notifications({ profile, settings, onSettings }) {
  const [status, setStatus] = useState('loading')
  const { busy, msg, run, setMsg } = useSaving()
  const refresh = () => pushStatus().then(setStatus).catch(() => setStatus('unsupported'))
  useEffect(() => {
    refresh()
  }, [])
  const toggleDevice = (on) =>
    run(async () => {
      if (on) await enablePush()
      else await disablePush()
      await refresh()
    }, on ? 'Notificaciones activadas en este celular.' : 'Notificaciones desactivadas en este celular.')
  const toggle = (k) => (v) => run(async () => onSettings(await api.saveSettings(profile.id, { [k]: v })))
  const usable = status === 'on' || status === 'off'
  return (
    <section className="settings-block">
      <h3>Notificaciones</h3>
      {status === 'loading' ? (
        <p className="muted small">Revisando…</p>
      ) : usable ? (
        <Switch
          label={platform() === 'desktop' ? 'Avisos en esta compu' : 'Avisos en este celular'}
          hint="Te avisamos aunque tengas la app cerrada."
          checked={status === 'on'}
          disabled={busy}
          onChange={toggleDevice}
        />
      ) : (
        <p className="muted small">{STATUS_TEXT[status]}</p>
      )}
      <Switch
        label="Invitaciones a jugar"
        hint="Cuando te invitan a una mesa, te eligen de compañero o arranca una partida tuya."
        checked={settings.notify_invites}
        disabled={busy}
        onChange={toggle('notify_invites')}
      />
      <Switch
        label="Pedidos de amistad"
        checked={settings.notify_friends}
        disabled={busy}
        onChange={toggle('notify_friends')}
      />
      {status === 'on' && (
        <button
          className="btn btn-ghost btn-small"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const r = await api.pushTest()
              if (r && r.configured === false) throw new Error('El servidor todavía no tiene configurado el envío de avisos.')
            }, 'Te mandamos una notificación de prueba.')
          }
        >
          Probar una notificación
        </button>
      )}
      {msg && <p className="muted small">{msg}</p>}
      {status === 'denied' && (
        <button className="btn btn-ghost btn-small" onClick={() => (setMsg(''), refresh())}>
          Ya las habilité
        </button>
      )}
    </section>
  )
}

/** Configuración completa de la cuenta. */
const TABS = [
  ['cuenta', 'user', 'Cuenta'],
  ['privacidad', 'lock', 'Privacidad'],
  ['avisos', 'bell', 'Avisos'],
  ['app', 'install', 'App'],
]
const TAB_KEY = 'truco.settingsTab'

export default function Settings({ profile, onProfile, onBack }) {
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTabState] = useState(() => {
    try {
      const t = localStorage.getItem(TAB_KEY)
      return TABS.some(([id]) => id === t) ? t : 'cuenta'
    } catch {
      return 'cuenta'
    }
  })
  const setTab = (t) => {
    setTabState(t)
    try {
      localStorage.setItem(TAB_KEY, t)
    } catch {
      /* sin storage */
    }
  }
  useEffect(() => {
    let alive = true
    api
      .getSettings(profile.id)
      .then((s) => alive && setSettings(s))
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [profile.id])
  const onSettings = (s) => setSettings((prev) => ({ ...prev, ...s }))

  return (
    <main className="settings">
      <button className="back" onClick={onBack}>
        ‹ Volver
      </button>
      <h2 className="page-title">Configuración</h2>
      <nav className="settings-tabs" role="tablist" aria-label="Secciones de la configuración">
        {TABS.map(([id, icon, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            <Icon name={icon} size={22} strokeWidth={1.9} />
            {label}
          </button>
        ))}
      </nav>
      {error && <p className="form-error">{error}</p>}
      {!settings ? (
        !error && <p className="muted">Cargando…</p>
      ) : (
        <div className="settings-panel" role="tabpanel" key={tab}>
          {tab === 'cuenta' && (
            <>
              <PersonalData profile={profile} settings={settings} onProfile={onProfile} onSettings={onSettings} />
              <LoginEmail userId={profile.id} />
              <Password profile={profile} />
              <section className="settings-block">
                <h3>Sesión</h3>
                <p className="muted small">Es la misma cuenta que el Sudoku: la foto y el nombre se ven en los dos juegos.</p>
                <button className="btn btn-ghost" onClick={() => api.signOut()}>
                  Cerrar sesión
                </button>
              </section>
            </>
          )}
          {tab === 'privacidad' && <Privacy profile={profile} settings={settings} onSettings={onSettings} />}
          {tab === 'avisos' && <Notifications profile={profile} settings={settings} onSettings={onSettings} />}
          {tab === 'app' && (
            <section className="settings-block">
              <h3>Instalar la app</h3>
              <p className="muted small">
                Instalada se abre a pantalla completa con su ícono, anda sin conexión contra la compu y te llegan los avisos.
              </p>
              <InstallGuide />
            </section>
          )}
        </div>
      )}
    </main>
  )
}
