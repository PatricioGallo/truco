// Cómo se dice cada cosa en la mesa
export const CALL_TEXT = {
  truco: '¡Truco!',
  retruco: '¡Quiero retruco!',
  vale4: '¡Quiero vale cuatro!',
  envido: 'Envido',
  real: 'Real envido',
  falta: 'Falta envido',
  flor: '¡Flor!',
  contraflor: 'Contraflor',
  contraflor_resto: 'Contraflor al resto',
}

export const BUTTON_TEXT = {
  truco: 'Truco',
  retruco: 'Retruco',
  vale4: 'Vale cuatro',
  envido: 'Envido',
  real: 'Real envido',
  falta: 'Falta envido',
  flor: 'Flor',
  contraflor: 'Contraflor',
  contraflor_resto: 'Contraflor al resto',
}

export function actionText(a) {
  if (a.type === 'call') return CALL_TEXT[a.call]
  if (a.type === 'accept') return 'Quiero'
  if (a.type === 'reject') return 'No quiero'
  if (a.type === 'achico') return 'Con flor me achico'
  if (a.type === 'mazo') return 'Me voy al mazo'
  if (a.type === 'buenas') return 'Son buenas'
  return ''
}

export const REASON_TEXT = {
  truco: 'la mano',
  'no quiero': 'el no quiero',
  mazo: 'el mazo',
  envido: 'el envido',
  flor: 'la flor',
}
