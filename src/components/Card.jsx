// Naipe español dibujado en SVG: marco con pintas, palos repetidos en su
// posición clásica, figuras para sota, caballo y rey, y anchos decorados.
import { parseCard } from '../engine/cards.js'

const COLORS = { oro: '#C9921C', copa: '#C23A2E', espada: '#2D5BA6', basto: '#3E7A36' }
const FIGURES = { 10: 'Sota', 11: 'Caballo', 12: 'Rey' }
const GOLD = '#D9A93A'
const GOLD_DARK = '#9C6E12'
const INK = '#2A1B14'

// ---------- Palos (dibujados en una caja de 40x40) ----------
function Oro() {
  return (
    <g>
      <circle cx="20" cy="20" r="16" fill={GOLD} stroke={GOLD_DARK} strokeWidth="1.6" />
      <circle cx="20" cy="20" r="11.5" fill="none" stroke={GOLD_DARK} strokeWidth="1.1" />
      {Array.from({ length: 12 }, (_, i) => (
        <line
          key={i}
          x1="20"
          y1="6.5"
          x2="20"
          y2="9"
          stroke={GOLD_DARK}
          strokeWidth="1.1"
          transform={`rotate(${i * 30} 20 20)`}
        />
      ))}
      <circle cx="20" cy="20" r="6" fill="#F3D27A" stroke={GOLD_DARK} strokeWidth="1" />
      <circle cx="20" cy="20" r="2" fill={GOLD_DARK} />
    </g>
  )
}

function Copa() {
  return (
    <g>
      <path d="M8 7h24c0 9-5 15-12 15S8 16 8 7z" fill="#C23A2E" stroke="#7E1E16" strokeWidth="1.2" />
      <path d="M8.5 9.5h23" stroke={GOLD} strokeWidth="2.2" />
      <circle cx="20" cy="15" r="2.2" fill={GOLD} />
      <path d="M17.5 21.5h5l-.8 5h-3.4z" fill={GOLD} stroke={GOLD_DARK} strokeWidth="0.8" />
      <ellipse cx="20" cy="27.5" rx="3.6" ry="1.6" fill="#C23A2E" />
      <path d="M18.6 28.5h2.8v3h-2.8z" fill={GOLD} />
      <path d="M10.5 36c0-3.6 4.2-5.2 9.5-5.2s9.5 1.6 9.5 5.2z" fill="#C23A2E" stroke="#7E1E16" strokeWidth="1.2" />
      <path d="M12 34.3h16" stroke={GOLD} strokeWidth="1.4" />
    </g>
  )
}

function Espada() {
  return (
    <g>
      <path d="M18.4 3.5l1.6-2 1.6 2 1 22h-5.2z" fill="#3E6FBF" stroke="#1E3F78" strokeWidth="1" />
      <path d="M20 4v21" stroke="#BFD3F2" strokeWidth="0.9" />
      <path d="M9.5 25.5c2.5-1.8 6-1.6 10.5-1.6s8 -.2 10.5 1.6c-2.5 1.6-6 1.6-10.5 1.6s-8 0-10.5-1.6z" fill={GOLD} stroke={GOLD_DARK} strokeWidth="0.9" />
      <circle cx="9.3" cy="25.5" r="1.6" fill={GOLD} stroke={GOLD_DARK} strokeWidth="0.7" />
      <circle cx="30.7" cy="25.5" r="1.6" fill={GOLD} stroke={GOLD_DARK} strokeWidth="0.7" />
      <rect x="18.3" y="27" width="3.4" height="7.5" rx="1" fill="#8A3B22" stroke="#5A2412" strokeWidth="0.7" />
      <path d="M18.3 29l3.4 1.4M18.3 31.5l3.4 1.4" stroke="#5A2412" strokeWidth="0.6" />
      <circle cx="20" cy="36.3" r="2.4" fill={GOLD} stroke={GOLD_DARK} strokeWidth="0.8" />
    </g>
  )
}

function Basto() {
  return (
    <g>
      <path d="M16.2 37.5l1.6-30c.2-3 1.6-5 3.6-5s3.4 2 3.2 5l-1.4 30z" fill="#4F8A3C" stroke="#2C5A1E" strokeWidth="1.1" />
      <path d="M19.6 5.5c-.4 10-.8 20-1.2 31" stroke="#8CC06F" strokeWidth="1" />
      <circle cx="23.8" cy="11" r="2.1" fill="#7A4E26" stroke="#4E3014" strokeWidth="0.7" />
      <circle cx="17.6" cy="18" r="2" fill="#7A4E26" stroke="#4E3014" strokeWidth="0.7" />
      <circle cx="23" cy="25" r="2" fill="#7A4E26" stroke="#4E3014" strokeWidth="0.7" />
      <path d="M24.5 14.5c4-1.5 6.5 0 7.5 2-3 .8-5.6.4-7.5-2z" fill="#6FAF52" stroke="#2C5A1E" strokeWidth="0.7" />
      <path d="M17.2 21.5c-4-1.2-6.4.5-7.2 2.5 3 .6 5.4.1 7.2-2.5z" fill="#6FAF52" stroke="#2C5A1E" strokeWidth="0.7" />
    </g>
  )
}

const SUIT = { oro: Oro, copa: Copa, espada: Espada, basto: Basto }

/** Ícono suelto (para usar fuera de las cartas). */
export function SuitIcon({ suit, size = 40 }) {
  const S = SUIT[suit]
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <S />
    </svg>
  )
}

/** Un palo dentro de la carta, centrado en (x, y), con tamaño s y rotación r. */
function Pip({ suit, x, y, s = 18, r = 0 }) {
  const S = SUIT[suit]
  const k = s / 40
  return (
    <g transform={`translate(${x - s / 2} ${y - s / 2}) rotate(${r} ${s / 2} ${s / 2}) scale(${k})`}>
      <S />
    </g>
  )
}

// Posiciones clásicas de los palos (caja de 100x150)
const L = 31, C = 50, R = 69
const LAYOUTS = {
  2: [[C, 42], [C, 108]],
  3: [[C, 36], [C, 75], [C, 114]],
  4: [[L, 42], [R, 42], [L, 108], [R, 108]],
  5: [[L, 40], [R, 40], [C, 75], [L, 110], [R, 110]],
  6: [[L, 38], [R, 38], [L, 75], [R, 75], [L, 112], [R, 112]],
  7: [[L, 36], [R, 36], [C, 56], [L, 78], [R, 78], [L, 114], [R, 114]],
}

/** Marco con pintas: cortes en el borde que indican el palo. */
function Frame({ suit, color }) {
  const gaps = { oro: 0, copa: 1, espada: 2, basto: 3 }[suit]
  const x0 = 9, x1 = 91, y0 = 22, y1 = 128
  // Tramos de las líneas de arriba y abajo con `gaps` cortes
  const segs = []
  const pieces = gaps + 1
  const w = (x1 - x0) / pieces
  for (let i = 0; i < pieces; i++) segs.push([x0 + i * w + (i ? 3 : 0), x0 + (i + 1) * w - (i < gaps ? 3 : 0)])
  return (
    <g stroke={color} strokeWidth="1.4" fill="none" opacity="0.85">
      {segs.map(([a, b], i) => (
        <g key={i}>
          <line x1={a} y1={y0} x2={b} y2={y0} />
          <line x1={a} y1={y1} x2={b} y2={y1} />
        </g>
      ))}
      <line x1={x0} y1={y0} x2={x0} y2={y1} />
      <line x1={x1} y1={y0} x2={x1} y2={y1} />
    </g>
  )
}

/** Figura: sota (de pie), caballo (cabeza de caballo) o rey (con corona). */
function Figure({ num, suit, color }) {
  const robe = color
  return (
    <g>
      {/* Cuerpo */}
      <path d="M32 126 L36 84 Q50 74 64 84 L68 126 Z" fill={robe} stroke={INK} strokeWidth="1.2" />
      <path d="M50 80 L50 126" stroke={GOLD} strokeWidth="2.4" />
      <path d="M36 98 H64" stroke={GOLD} strokeWidth="1.6" />
      {num === 11 ? (
        // Caballo: cabeza de caballo sobre el cuerpo
        <g>
          <path
            d="M40 84 C38 70 42 56 52 50 C58 46 66 48 68 54 L70 66 C70 70 66 71 63 68 L58 64 C57 72 56 78 58 84 Z"
            fill="#8B5A2B"
            stroke={INK}
            strokeWidth="1.2"
          />
          <path d="M52 50 C48 54 46 62 46 70" stroke="#5A3412" strokeWidth="3" fill="none" />
          <circle cx="62" cy="56" r="1.6" fill={INK} />
          <path d="M60 64 L70 62" stroke={GOLD} strokeWidth="1.2" />
        </g>
      ) : (
        <g>
          {/* Cara */}
          <circle cx="50" cy="66" r="10" fill="#F2C9A0" stroke={INK} strokeWidth="1.2" />
          <circle cx="46.5" cy="65" r="1.1" fill={INK} />
          <circle cx="53.5" cy="65" r="1.1" fill={INK} />
          <path d="M47 70 Q50 72 53 70" stroke={INK} strokeWidth="1" fill="none" />
          {num === 12 ? (
            <>
              {/* Barba y corona */}
              <path d="M41 68 Q50 84 59 68 Q57 77 50 78 Q43 77 41 68z" fill="#8B5A2B" stroke={INK} strokeWidth="0.8" />
              <path d="M40 57 L42 46 L46 52 L50 44 L54 52 L58 46 L60 57 Z" fill={GOLD} stroke={GOLD_DARK} strokeWidth="1" />
              <circle cx="50" cy="51" r="1.4" fill="#C23A2E" />
            </>
          ) : (
            // Sota: gorro con pluma
            <>
              <path d="M39 60 Q50 46 61 60 Z" fill={robe} stroke={INK} strokeWidth="1" />
              <path d="M58 54 Q66 44 70 46 Q64 50 60 57" fill="#F3D27A" stroke={GOLD_DARK} strokeWidth="0.8" />
            </>
          )}
        </g>
      )}
      {/* Lleva su palo */}
      <Pip suit={suit} x={num === 11 ? 30 : 70} y={102} s={20} />
    </g>
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
  const simple = size === 'sm' || size === 'xs' // en chico, solo número y un palo

  let body
  if (simple) body = <Pip suit={c.suit} x={50} y={78} s={46} />
  else if (FIGURES[c.num]) body = <Figure num={c.num} suit={c.suit} color={color} />
  else if (c.num === 1) {
    const diagonal = c.suit === 'espada' || c.suit === 'basto'
    body = (
      <g>
        {/* Adornos del ancho */}
        <path d="M22 75 C22 50 35 36 50 34 C65 36 78 50 78 75 C78 100 65 114 50 116 C35 114 22 100 22 75Z" fill="none" stroke={color} strokeWidth="0.9" opacity="0.35" />
        <path d="M30 40 q6 -8 14 -6 M70 110 q-6 8 -14 6 M70 40 q-6 -8 -14 -6 M30 110 q6 8 14 6" stroke={GOLD_DARK} strokeWidth="1.2" fill="none" />
        <Pip suit={c.suit} x={50} y={75} s={c.suit === 'espada' ? 92 : c.suit === 'basto' ? 86 : 66} r={diagonal ? -18 : 0} />
      </g>
    )
  } else {
    const tilt = c.suit === 'espada' || c.suit === 'basto'
    body = LAYOUTS[c.num].map(([x, y], i) => (
      <Pip key={i} suit={c.suit} x={x} y={y} s={(c.num >= 6 ? 24 : 30) * (tilt ? 1.25 : 1)} r={tilt ? (i % 2 ? 22 : -22) : 0} />
    ))
  }

  return (
    <Tag
      className={`card card-${size} ${highlight ? 'is-highlight' : ''} ${className}`}
      style={{ '--suit': color, ...style }}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      aria-label={label}
    >
      <svg viewBox="0 0 100 150" className="card-face" aria-hidden="true">
        {!simple && <Frame suit={c.suit} color={color} />}
        {body}
        <text x="10" y="17" className="card-index" fill={color}>
          {c.num}
        </text>
        {!simple && (
          <text x="90" y="133" className="card-index" fill={color} transform="rotate(180 90 133)">
            {c.num}
          </text>
        )}
      </svg>
    </Tag>
  )
}
