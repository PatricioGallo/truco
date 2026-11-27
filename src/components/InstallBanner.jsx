import { useEffect, useState } from 'react'
import { platform, isStandalone, isIosSafari, canPromptInstall, onInstallAvailable, promptInstall } from '../pwa.js'

const DISMISS_KEY = 'truco.installDismissedAt'
const REMIND_AFTER = 3 * 24 * 60 * 60 * 1000 // vuelve a aparecer a los 3 días

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="inline-icon">
    <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 11H5.5A1.5 1.5 0 0 0 4 12.5v7A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5H17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)
const DotsIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="inline-icon">
    <circle cx="12" cy="5" r="2" fill="currentColor" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
    <circle cx="12" cy="19" r="2" fill="currentColor" />
  </svg>
)

/** Pasos para instalar la app según el celular. */
export function InstallSteps({ os }) {
  if (os === 'ios') {
    return (
      <ol className="install-steps">
        {isIosSafari() || platform() !== 'ios' ? (
          <li>
            En <b>Safari</b>, tocá el botón <b>Compartir</b> <ShareIcon /> (abajo en el medio).
          </li>
        ) : (
          <li>
            Tocá el botón <b>Compartir</b> <ShareIcon /> (en Chrome está arriba a la derecha). Si no aparece, abrí esta página en{' '}
            <b>Safari</b>.
          </li>
        )}
        <li>
          Bajá y elegí <b>Agregar a inicio</b> (o "Agregar a pantalla de inicio").
        </li>
        <li>
          Tocá <b>Agregar</b>. Listo: el Truco queda como una app más, con su ícono.
        </li>
      </ol>
    )
  }
  return (
    <ol className="install-steps">
      <li>
        En <b>Chrome</b>, tocá el menú <DotsIcon /> (arriba a la derecha).
      </li>
      <li>
        Elegí <b>Instalar app</b> (o "Agregar a la pantalla principal").
      </li>
      <li>
        Confirmá con <b>Instalar</b>. El Truco queda con su ícono, a pantalla completa y anda sin conexión contra la compu.
      </li>
    </ol>
  )
}

/** Guía completa (para la configuración): pestañas Android / iPhone. */
export function InstallGuide() {
  const mine = platform()
  const [os, setOs] = useState(mine === 'ios' ? 'ios' : 'android')
  const [canInstall, setCanInstall] = useState(canPromptInstall())
  useEffect(() => onInstallAvailable(setCanInstall), [])
  if (isStandalone()) return <p className="muted small">Ya estás usando la app instalada. 👌</p>
  return (
    <div className="install-guide">
      {canInstall && (
        <button className="btn btn-primary" onClick={() => promptInstall()}>
          Instalar ahora
        </button>
      )}
      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={os === 'android'} onClick={() => setOs('android')}>
          Android
        </button>
        <button role="tab" aria-selected={os === 'ios'} onClick={() => setOs('ios')}>
          iPhone
        </button>
      </div>
      <InstallSteps os={os} />
    </div>
  )
}

/** Banner del inicio: solo en el celular y si la app no está instalada. Se puede cerrar y vuelve a los 3 días. */
export default function InstallBanner() {
  const os = platform()
  const [hidden, setHidden] = useState(() => {
    try {
      return Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < REMIND_AFTER
    } catch {
      return false
    }
  })
  const [open, setOpen] = useState(false)
  const [canInstall, setCanInstall] = useState(canPromptInstall())
  useEffect(() => onInstallAvailable(setCanInstall), [])

  if (hidden || os === 'desktop' || isStandalone()) return null
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* sin storage */
    }
    setHidden(true)
  }
  const install = async () => {
    if (await promptInstall()) setHidden(true)
  }

  return (
    <section className="install-banner" role="region" aria-label="Instalar la app">
      <div className="install-head">
        <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="install-icon" />
        <span className="install-text">
          <b>Instalá el Truco en tu {os === 'ios' ? 'iPhone' : 'celular'}</b>
          <span>Se abre a pantalla completa, con su ícono, y te llegan los avisos.</span>
        </span>
        <button className="notif-close" onClick={dismiss} aria-label="Ahora no">
          ×
        </button>
      </div>
      {open && <InstallSteps os={os} />}
      <div className="install-actions">
        {canInstall ? (
          <button className="btn btn-primary btn-small" onClick={install}>
            Instalar
          </button>
        ) : (
          <button className="btn btn-primary btn-small" onClick={() => setOpen((o) => !o)}>
            {open ? 'Ocultar pasos' : '¿Cómo la instalo?'}
          </button>
        )}
        <button className="btn btn-ghost btn-small" onClick={dismiss}>
          Ahora no
        </button>
      </div>
    </section>
  )
}
