import { useState } from 'react'
import { legalActions } from './engine/game.js'
import { useLocalMatch, newLocalMatch, savedLocalMatch } from './useLocalMatch.js'
import Table from './components/Table.jsx'
import Card from './components/Card.jsx'

const NAMES = {
  2: ['Vos', 'La compu'],
  4: ['Vos', 'Compu 1', 'Compañero', 'Compu 2'],
}

export default function App() {
  const [initial] = useState(() => savedLocalMatch()?.match ?? null)
  const game = useLocalMatch(initial)
  const [flor, setFlor] = useState(true)

  if (!game.match) return <Home onPlay={(players) => game.restart(players, flor)} flor={flor} setFlor={setFlor} />

  const n = game.match.config.players
  return (
    <div className="screen">
      <Table
        view={game.view}
        me={game.me}
        actions={legalActions(game.match, game.me)}
        names={NAMES[n]}
        bubbles={game.bubbles}
        onAct={(a) => game.act(game.me, a)}
        onNextHand={game.nextHand}
        onRestart={() => game.restart(n, game.match.config.flor)}
        onQuit={game.quit}
      />
    </div>
  )
}

function Home({ onPlay, flor, setFlor }) {
  return (
    <div className="screen home">
      <div className="home-hero">
        <div className="hero-cards" aria-hidden="true">
          <Card id="1e" size="lg" className="fan fan-1" />
          <Card id="1b" size="lg" className="fan fan-2" />
          <Card id="7e" size="lg" className="fan fan-3" />
        </div>
        <h1 className="title">Truco</h1>
        <p className="tagline">A 30, con fósforos y sin mentirle al compañero.</p>
      </div>

      <section className="home-menu">
        <h2>Contra la compu</h2>
        <div className="mode-grid">
          <button className="mode" onClick={() => onPlay(2)}>
            <span className="mode-title">Mano a mano</span>
            <span className="mode-sub">Vos contra la compu</span>
          </button>
          <button className="mode" onClick={() => onPlay(4)}>
            <span className="mode-title">De a cuatro</span>
            <span className="mode-sub">Vos y un compañero contra dos</span>
          </button>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={flor} onChange={(e) => setFlor(e.target.checked)} />
          <span>Con flor</span>
        </label>
        <p className="soon">Online con amigos: próximamente.</p>
      </section>
    </div>
  )
}
