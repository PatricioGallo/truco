// Naipe español dibujado en SVG: palo con su color clásico, número y figura.
import { parseCard } from '../engine/cards.js'

const COLORS = { oro: '#C9921C', copa: '#C23A2E', espada: '#2D5BA6', basto: '#3E7A36' }
const FIGURES = { 10: 'Sota', 11: 'Caballo', 12: 'Rey' }

export function SuitIcon({ suit, size = 40 }) {
  const c = COLORS[suit]
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      {suit === 'oro' && (
        <g>
          <circle cx="20" cy="20" r="15" fill={c} />
          <circle cx="20" cy="20" r="10.5" fill="none" stroke="#FFE7A3" strokeWidth="2" />
          <circle cx="20" cy="20" r="4" fill="#FFE7A3" />
        </g>
      )}
      {suit === 'copa' && (
        <g fill={c}>
          <path d="M9 6h22c0 9-4 15-11 15S9 15 9 6z" />
          <rect x="18" y="20" width="4" height="9" />
          <path d="M11 34c0-4 4-6 9-6s9 2 9 6z" />
          <path d="M12 9h16" stroke="#FFE7A3" strokeWidth="2" />
        </g>
      )}
      {suit === 'espada' && (
        <g fill={c}>
          <path d="M18.5 3h3l1.5 23h-6z" />
          <rect x="11" y="25" width="18" height="3.5" rx="1.5" />
          <rect x="18" y="28" width="4" height="7" rx="1" fill="#8A5A2B" />
          <circle cx="20" cy="36.5" r="2.5" fill={c} />
        </g>
      )}
      {suit === 'basto' && (
        <g fill={c}>
          <path d="M17 36l2-30c0-2 1-3 2.5-3S24 4 24 6l-1 30z" />
          <circle cx="23" cy="12" r="2.6" />
          <circle cx="18.5" cy="19" r="2.6" />
          <circle cx="23" cy="26" r="2.6" />
        </g>
      )}
    </svg>
  )
}

/** Carta boca arriba (`id`) o boca abajo (`id` = null). */
export default function Card({ id, size = 'md', onClick, disabled, highlight, className = '', style }) {
  if (!id) {
    return (
      <span className={`card card-${size} card-back ${className}`} style={style} aria-label="Carta boca abajo">
        <span className="card-back-pattern" />
      </span>
    )
  }
  const c = parseCard(id)
  const color = COLORS[c.suit]
  const label = FIGURES[c.num] ? `${FIGURES[c.num]} de ${c.suit}` : `${c.num} de ${c.suit}`
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      className={`card card-${size} ${highlight ? 'is-highlight' : ''} ${className}`}
      style={{ '--suit': color, ...style }}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      aria-label={label}
    >
      <span className="card-num">{c.num}</span>
      <span className="card-center">
        <SuitIcon suit={c.suit} size={size === 'sm' ? 22 : size === 'lg' ? 46 : 34} />
        {FIGURES[c.num] && <span className="card-figure">{FIGURES[c.num]}</span>}
      </span>
      <span className="card-num card-num-bottom">{c.num}</span>
    </Tag>
  )
}
