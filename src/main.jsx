import React from 'react'
import { createRoot } from 'react-dom/client'
import * as api from '@api'
import App from './App.jsx'
import Card from './components/Card.jsx'
import './styles.css'
import { registerSW } from 'virtual:pwa-register'

// La app queda guardada en el celular. Cada vez que se vuelve a ella (o cada hora)
// se fija si hay una versión nueva; si la hay, la instala y recarga sola.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const check = () => registration.update().catch(() => {})
    setInterval(check, 60 * 60 * 1000)
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
  },
})

if (import.meta.env.MODE === 'mock') api.seedDemo?.()

// En modo de prueba, ?mazo muestra las 40 cartas para revisarlas
const showDeck = import.meta.env.MODE === 'mock' && location.search.includes('mazo')
const Deck = () => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12, background: '#1F5A45' }}>
    {['e', 'b', 'o', 'c'].flatMap((s) =>
      [1, 2, 3, 4, 5, 6, 7, 10, 11, 12].map((n) => <Card key={n + s} id={`${n}${s}`} size="md" />)
    )}
  </div>
)

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Franja sólida bajo el notch / Dynamic Island: tapa lo que pasa por debajo al hacer scroll */}
    <div className="safe-top" aria-hidden="true" />
    {showDeck ? <Deck /> : <App />}
  </React.StrictMode>
)
