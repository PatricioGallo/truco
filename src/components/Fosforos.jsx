// Tanteador con fósforos: grupos de 5 (cuadrado + diagonal), como en la mesa.

function Group({ n }) {
  // Posiciones: arriba, derecha, abajo, izquierda, diagonal
  const sticks = [
    { x1: 4, y1: 4, x2: 26, y2: 4 },
    { x1: 26, y1: 4, x2: 26, y2: 26 },
    { x1: 26, y1: 26, x2: 4, y2: 26 },
    { x1: 4, y1: 26, x2: 4, y2: 4 },
    { x1: 4, y1: 26, x2: 26, y2: 4 },
  ].slice(0, n)
  return (
    <svg viewBox="0 0 30 30" className="fosforo-group" aria-hidden="true">
      {sticks.map((s, i) => (
        <g key={i}>
          <line {...s} stroke="#E8C58E" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx={s.x2} cy={s.y2} r="2.6" fill="#C8352E" />
        </g>
      ))}
    </svg>
  )
}

export default function Fosforos({ points, target = 30 }) {
  const groups = []
  for (let left = points; left > 0; left -= 5) groups.push(Math.min(5, left))
  const half = target / 2
  return (
    <span className="fosforos" aria-label={`${points} puntos`}>
      {groups.map((n, i) => (
        <span key={i} className={i === half / 5 ? 'fosforo-buenas' : ''}>
          <Group n={n} />
        </span>
      ))}
      {points === 0 && <span className="fosforos-zero">0</span>}
    </span>
  )
}
