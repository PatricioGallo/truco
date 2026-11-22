// Naipe de la baraja española (dibujos de Basquetteur, CC BY-SA 3.0; ver public/naipes/LICENCIA.txt).
import { parseCard } from '../engine/cards.js'

const FIGURES = { 10: 'Sota', 11: 'Caballo', 12: 'Rey' }
const src = (name) => `${import.meta.env.BASE_URL}naipes/${name}.webp`

/** Carta boca arriba (`id`) o boca abajo (`id` = null). */
export default function Card({ id, size = 'md', onClick, disabled, highlight, className = '', style }) {
  if (!id) {
    return (
      <span className={`card card-${size} card-back ${className}`} style={style} aria-label="Carta boca abajo">
        <img src={src('dorso')} alt="" draggable="false" />
      </span>
    )
  }
  const c = parseCard(id)
  const label = `${FIGURES[c.num] ?? c.num} de ${c.suit}`
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      className={`card card-${size} ${highlight ? 'is-highlight' : ''} ${className}`}
      style={style}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      aria-label={label}
    >
      <img src={src(id)} alt="" draggable="false" />
    </Tag>
  )
}
