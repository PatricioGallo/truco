// Íconos propios de la app: trazo redondeado que toma el color del texto,
// en la misma línea que el engranaje y la campana del encabezado.

const PATHS = {
  // Contra la máquina: cabeza de robot
  robot: (
    <>
      <path d="M12 3v2.5" />
      <circle cx="12" cy="2.6" r="0.9" fill="currentColor" stroke="none" />
      <rect x="4.5" y="5.5" width="15" height="12" rx="3.5" />
      <circle cx="9" cy="11" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="15" cy="11" r="1.6" fill="currentColor" stroke="none" />
      <path d="M9.5 14.6h5" />
      <path d="M4.5 10.5H3a1 1 0 0 0-1 1v1.5a1 1 0 0 0 1 1h1.5M19.5 10.5H21a1 1 0 0 1 1 1v1.5a1 1 0 0 1-1 1h-1.5" />
      <path d="M8.5 17.5v3h7v-3" />
    </>
  ),
  // Online: el mundo con meridianos
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.5 3.9 5.5 3.9 9s-1.3 6.5-3.9 9c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3Z" />
      <path d="M4.6 7.5h14.8M4.6 16.5h14.8" />
    </>
  ),
  // Competitivo: copa
  trophy: (
    <>
      <path d="M7 3.5h10v5.5a5 5 0 0 1-10 0V3.5Z" />
      <path d="M7 5.5H4.5v1.2A3.3 3.3 0 0 0 7.6 10M17 5.5h2.5v1.2a3.3 3.3 0 0 1-3.1 3.3" />
      <path d="M12 14v3.5M8.5 20.5h7M9.5 17.5h5l.8 3h-6.6l.8-3Z" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l1.6-2.5h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.6" />
    </>
  ),
  gear: (
    <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-2.5a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.3 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6Z" />
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <path d="M12 14.5v2.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="4" />
      <path d="M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2Z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  // Instalar la app: celular con flecha
  install: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M12 7v7.5M9 11.8l3 3 3-3" />
      <path d="M10.5 18.5h3" />
    </>
  ),
  flame: (
    <path d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-3.8 3.3-5.6 3.8-9.5 2.7 1.6 4 3.8 4 6.2.9-.6 1.5-1.6 1.6-2.9 2 1.6 3.6 3.6 3.6 6.2 0 3.4-2.6 6-6.5 6Z" />
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
}

/** Ícono de línea. `name`: robot, globe, trophy, camera, gear, search, lock, user, bell, install, flame, check. */
export default function Icon({ name, size = 22, className = '', strokeWidth = 1.8, title }) {
  return (
    <svg
      className={`icon ${className}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  )
}

const MEDALS = [
  ['#f3d77a', '#b8892b', '#7a5a14'], // oro
  ['#eef0f2', '#a3a9b0', '#5f656c'], // plata
  ['#e8a873', '#a9612f', '#6a3814'], // bronce
]

/** Medalla de los tres primeros del ranking: moneda con cinta y el número del puesto. */
export function Medal({ place, size = 28 }) {
  const [light, mid, dark] = MEDALS[place - 1]
  const id = `medal-${place}`
  return (
    <svg className="medal" viewBox="0 0 24 28" width={size * (24 / 28)} height={size} role="img" aria-label={`Puesto ${place}`}>
      <defs>
        <radialGradient id={id} cx="38%" cy="35%" r="70%">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={mid} />
        </radialGradient>
      </defs>
      <path d="M7 1h4l2.2 8H9.2L7 1ZM17 1h-4l-2.2 8h4L17 1Z" fill="#c23a2e" stroke="#7d1f17" strokeWidth="0.8" strokeLinejoin="round" />
      <circle cx="12" cy="17.5" r="9" fill={`url(#${id})`} stroke={dark} strokeWidth="1.2" />
      <circle cx="12" cy="17.5" r="6.6" fill="none" stroke={dark} strokeOpacity="0.45" strokeWidth="0.8" />
      <text
        x="12"
        y="21.4"
        textAnchor="middle"
        fontFamily="'Alfa Slab One', serif"
        fontSize="10.5"
        fill={dark}
      >
        {place}
      </text>
    </svg>
  )
}
