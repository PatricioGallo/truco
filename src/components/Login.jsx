import { useState } from 'react'
import * as api from '@api'
import Card from './Card.jsx'

export default function Login() {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ username: '', password: '', firstName: '', lastName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const signup = mode === 'signup'

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (signup) await api.signUp(form)
      else await api.signIn(form.username, form.password)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className={`screen login ${signup ? 'is-signup' : ''}`}>
      <div className="home-hero">
        <div className="hero-cards" aria-hidden="true">
          <Card id="1e" size="lg" className="fan fan-1" />
          <Card id="1b" size="lg" className="fan fan-2" />
          <Card id="7e" size="lg" className="fan fan-3" />
        </div>
        <h1 className="title">Truco</h1>
      </div>

      <form className="login-form" onSubmit={submit}>
        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={!signup} onClick={() => (setMode('login'), setError(''))}>
            Entrar
          </button>
          <button type="button" role="tab" aria-selected={signup} onClick={() => (setMode('signup'), setError(''))}>
            Crear cuenta
          </button>
        </div>
        <label className="field">
          <span>Usuario</span>
          <input
            value={form.username}
            onChange={set('username')}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            required
          />
        </label>
        {signup && (
          <div className="field-row">
            <label className="field">
              <span>Nombre</span>
              <input value={form.firstName} onChange={set('firstName')} autoComplete="given-name" maxLength={40} />
            </label>
            <label className="field">
              <span>Apellido</span>
              <input value={form.lastName} onChange={set('lastName')} autoComplete="family-name" maxLength={40} />
            </label>
          </div>
        )}
        <label className="field">
          <span>Contraseña</span>
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            autoComplete={signup ? 'new-password' : 'current-password'}
            minLength={signup ? 6 : undefined}
            required
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary" disabled={loading}>
          {loading ? (signup ? 'Creando cuenta…' : 'Entrando…') : signup ? 'Crear cuenta' : 'Entrar'}
        </button>
        <p className="hint">Si jugás al Sudoku, entrá con la misma cuenta.</p>
      </form>
    </div>
  )
}
