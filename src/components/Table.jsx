import { useEffect, useState } from 'react'
import { teamOf, TRUCO_NAMES } from '../engine/game.js'
import Card from './Card.jsx'
import Fosforos from './Fosforos.jsx'
import { BUTTON_TEXT, CALL_TEXT, REASON_TEXT } from '../texts.js'

const TEAM = ['Nosotros', 'Ellos']

/** Posición en la mesa de cada asiento, vista desde `me`. */
function position(seat, me, n) {
  const rel = (seat - me + n) % n
  if (n === 2) return rel === 0 ? 'bottom' : 'top'
  return ['bottom', 'right', 'top', 'left'][rel]
}

function pendingText(h, names) {
  const p = h.pending
  if (!p) return null
  const who = names[p.bySeat]
  const what = CALL_TEXT[p.kind === 'truco' ? TRUCO_NAMES[p.call] : p.call] ?? p.call
  return `${who}: ${what}`
}

export default function Table({ view, me, actions, names, bubbles, onAct, onNextHand, onRestart, onQuit, onBack }) {
  const m = view
  const h = m.hand
  const n = m.config.players
  const myTeam = teamOf(me)
  const plays = actions.filter((a) => a.type === 'play').map((a) => a.card)
  const pending = h.pending && h.pending.byTeam !== myTeam ? h.pending : null
  const waiting = h.pending && h.pending.byTeam === myTeam
  const calls = actions.filter((a) => a.type === 'call')
  const envidoCalls = calls.filter((a) => ['envido', 'real', 'falta'].includes(a.call))
  const otherCalls = calls.filter((a) => !['envido', 'real', 'falta'].includes(a.call))
  const responses = actions.filter((a) => ['accept', 'reject', 'achico'].includes(a.type))
  const mazo = actions.find((a) => a.type === 'mazo')
  const myTurn = plays.length > 0

  // Tanto (envido o flor querido): se muestra grande unos segundos y después queda chico en la mesa
  const tantoIdx = m.log.findLastIndex((e) => e.t === 'envido' || e.t === 'flor')
  const tanto = tantoIdx >= 0 ? m.log[tantoIdx] : null
  const tantoKey = tanto ? `${m.handNo}-${tantoIdx}` : null
  const [bigTanto, setBigTanto] = useState(null)
  useEffect(() => {
    if (!tantoKey) return
    setBigTanto(tantoKey)
    const t = setTimeout(() => setBigTanto((k) => (k === tantoKey ? null : k)), 4500)
    return () => clearTimeout(t)
  }, [tantoKey])
  const sideName = (us) => (n === 2 ? (us ? 'Vos' : names[(me + 1) % 2]) : us ? 'Nosotros' : 'Ellos')

  const turnText = h.finished
    ? null
    : pending
      ? null // ya lo dice el cartel de abajo
      : waiting
        ? 'Esperando respuesta…'
        : myTurn
          ? 'Te toca'
          : `Juega ${names[h.turn]}`

  return (
    <main className={`table players-${n}`}>
      <header className="scoreboard">
        {[myTeam, 1 - myTeam].map((t) => (
          <div key={t} className={`score-team ${t === myTeam ? 'is-us' : ''}`}>
            <span className="score-name">
              {TEAM[t === myTeam ? 0 : 1]} <b>{m.score[t]}</b>
            </span>
            <Fosforos points={m.score[t]} target={m.config.target} />
          </div>
        ))}
        <div className="score-meta">
          {onBack && (
            <button className="chip chip-back" onClick={onBack}>
              ‹ Inicio
            </button>
          )}
          <span className="chip">{h.truco.value > 1 ? `Vale ${h.truco.value}` : 'Sin truco'}</span>
          <span className="chip">Mano: {names[m.mano]}</span>
        </div>
      </header>

      <section className="felt">
        {[...Array(n).keys()].map((seat) => {
          const pos = position(seat, me, n)
          const played = h.rounds.flatMap((r, ri) =>
            r.plays.filter((p) => p.seat === seat).map((p) => ({ ...p, round: ri, won: r.winnerSeat === seat }))
          )
          return (
            <div key={seat} className={`seat seat-${pos} ${h.turn === seat && !h.finished && !h.pending ? 'is-turn' : ''}`}>
              {seat !== me && (
                <div className="seat-head">
                  <span className={`seat-name team-${teamOf(seat) === myTeam ? 'us' : 'them'}`}>{names[seat]}</span>
                  <span className="seat-hand">
                    {h.cards[seat].map((_, i) => (
                      <Card key={i} id={null} size="opp" />
                    ))}
                  </span>
                </div>
              )}
              <div className="played">
                {played.map((p) => (
                  <Card key={p.card} id={p.card} size="sm" className={p.won ? 'is-won' : ''} />
                ))}
              </div>
              {bubbles[seat] && (
                <span key={bubbles[seat].id} className={`bubble bubble-${pos}`}>
                  {bubbles[seat].text}
                </span>
              )}
            </div>
          )
        })}
        {turnText && !tanto && <p className="turn-text">{turnText}</p>}
        {tanto && !h.finished && (
          <div className={`tanto ${bigTanto === tantoKey ? '' : 'is-small'}`} role="status">
            <span className="tanto-title">{tanto.t === 'envido' ? 'Envido' : 'Flor'}</span>
            <span className="tanto-row">
              {[myTeam, 1 - myTeam].map((t) => (
                <span key={t} className={tanto.winner === t ? 'is-winner' : 'is-loser'}>
                  <b>{tanto.points[t]}</b>
                  {sideName(t === myTeam)}
                </span>
              ))}
            </span>
            <span className="tanto-result">
              {tanto.winner === myTeam ? (n === 2 ? 'Ganaste' : 'Ganamos') : `Gana ${sideName(false)}`}
              {tanto.points[0] === tanto.points[1] ? ' (empate: gana el mano)' : ''}
            </span>
          </div>
        )}
      </section>

      {pending && (
        <div className="prompt" role="alert">
          <p>{pendingText(h, names)}</p>
        </div>
      )}

      <section className="my-hand">
        {h.cards[me].map((id) => (
          <Card
            key={id}
            id={id}
            size="lg"
            onClick={() => onAct({ type: 'play', card: id })}
            disabled={!plays.includes(id)}
          />
        ))}
      </section>

      <nav className="actions">
        {responses.length > 0 && (
          <div className="action-row responses">
            {responses.map((a) => (
              <button key={a.type} className={`btn btn-${a.type}`} onClick={() => onAct(a)}>
                {a.type === 'accept' ? 'Quiero' : a.type === 'reject' ? 'No quiero' : 'Me achico'}
              </button>
            ))}
          </div>
        )}
        <div className="action-row">
          {otherCalls.map((a) => (
            <button key={a.call} className={`btn btn-call btn-${a.call}`} onClick={() => onAct(a)}>
              {BUTTON_TEXT[a.call]}
            </button>
          ))}
          {envidoCalls.map((a) => (
            <button key={a.call} className="btn btn-call btn-envido" onClick={() => onAct(a)}>
              {BUTTON_TEXT[a.call]}
            </button>
          ))}
          {mazo && (
            <button className="btn btn-mazo" onClick={() => onAct(mazo)}>
              Mazo
            </button>
          )}
        </div>
      </nav>

      {h.finished && m.winner === null && <HandSummary m={m} me={me} names={names} onNext={onNextHand} />}
      {m.winner !== null && <MatchOver m={m} me={me} onRestart={onRestart} onQuit={onQuit} />}
    </main>
  )
}

function HandSummary({ m, me, names, onNext }) {
  const myTeam = teamOf(me)
  const lines = []
  for (const e of m.log) {
    if (e.t === 'envido' || e.t === 'flor') {
      lines.push({
        key: `${e.t}-d`,
        text: `${e.t === 'envido' ? 'Envido' : 'Flor'}: ${TEAM[0]} ${e.points[myTeam]}, ${TEAM[1]} ${e.points[1 - myTeam]}`,
      })
    }
    if (e.t === 'points')
      lines.push({
        key: `${e.reason}-${e.team}-${lines.length}`,
        text: `+${e.points} ${e.team === myTeam ? TEAM[0] : TEAM[1]} por ${REASON_TEXT[e.reason] ?? e.reason}`,
        good: e.team === myTeam,
      })
  }
  const revealed = m.hand.initial.map((c, s) => (s !== me && c ? { seat: s, cards: c } : null)).filter(Boolean)
  return (
    <div className="sheet-backdrop">
      <div className="sheet">
        <h2>{m.hand.result.team === myTeam ? 'Mano para nosotros' : 'Mano para ellos'}</h2>
        <ul className="summary">
          {lines.map((l) => (
            <li key={l.key} className={l.good === undefined ? 'muted' : l.good ? 'good' : 'bad'}>
              {l.text}
            </li>
          ))}
        </ul>
        {revealed.length > 0 && (
          <div className="revealed">
            {revealed.map((r) => (
              <div key={r.seat}>
                <span className="muted">{names[r.seat]} tenía</span>
                <div className="revealed-cards">
                  {r.cards.map((id) => (
                    <Card key={id} id={id} size="sm" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <button className="btn btn-primary" onClick={onNext}>
          Siguiente mano
        </button>
      </div>
    </div>
  )
}

function MatchOver({ m, me, onRestart, onQuit }) {
  const won = m.winner === teamOf(me)
  return (
    <div className="sheet-backdrop">
      <div className={`sheet match-over ${won ? 'is-win' : 'is-loss'}`}>
        <p className="big-word">{won ? '¡Ganamos!' : 'Perdimos'}</p>
        <p className="final-score">
          {m.score[teamOf(me)]} a {m.score[1 - teamOf(me)]}
        </p>
        <div className={onRestart ? 'sheet-actions' : 'sheet-actions single'}>
          {onRestart && (
            <button className="btn btn-primary" onClick={onRestart}>
              Revancha
            </button>
          )}
          <button className={onRestart ? 'btn btn-ghost' : 'btn btn-primary'} onClick={onQuit}>
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  )
}
