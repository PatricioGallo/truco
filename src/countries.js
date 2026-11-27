// Países para la nacionalidad del perfil (código ISO de 2 letras → nombre).
// Primero los de habla hispana y vecinos; después el resto, en orden alfabético.
export const COUNTRIES = [
  ['AR', 'Argentina'],
  ['UY', 'Uruguay'],
  ['PY', 'Paraguay'],
  ['CL', 'Chile'],
  ['BO', 'Bolivia'],
  ['BR', 'Brasil'],
  ['PE', 'Perú'],
  ['CO', 'Colombia'],
  ['VE', 'Venezuela'],
  ['EC', 'Ecuador'],
  ['MX', 'México'],
  ['ES', 'España'],
  ['CR', 'Costa Rica'],
  ['CU', 'Cuba'],
  ['DO', 'República Dominicana'],
  ['GT', 'Guatemala'],
  ['HN', 'Honduras'],
  ['NI', 'Nicaragua'],
  ['PA', 'Panamá'],
  ['PR', 'Puerto Rico'],
  ['SV', 'El Salvador'],
  ['DE', 'Alemania'],
  ['AU', 'Australia'],
  ['AT', 'Austria'],
  ['BE', 'Bélgica'],
  ['CA', 'Canadá'],
  ['CN', 'China'],
  ['DK', 'Dinamarca'],
  ['US', 'Estados Unidos'],
  ['FR', 'Francia'],
  ['GB', 'Reino Unido'],
  ['IE', 'Irlanda'],
  ['IL', 'Israel'],
  ['IT', 'Italia'],
  ['JP', 'Japón'],
  ['NL', 'Países Bajos'],
  ['NO', 'Noruega'],
  ['NZ', 'Nueva Zelanda'],
  ['PL', 'Polonia'],
  ['PT', 'Portugal'],
  ['SE', 'Suecia'],
  ['CH', 'Suiza'],
]

const NAMES = Object.fromEntries(COUNTRIES)

/** Bandera (emoji) a partir del código de país. */
export const flagOf = (code) =>
  code && /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : ''

export const countryName = (code) => NAMES[code] ?? code ?? ''
