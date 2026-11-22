// Mazo español de 40 cartas (sin 8 ni 9), jerarquía del truco, envido y flor.

export const SUITS = ['espada', 'basto', 'oro', 'copa']
export const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]

export const cardId = (c) => `${c.num}${c.suit[0]}`
export const parseCard = (id) => {
  const suit = SUITS.find((s) => s[0] === id.at(-1))
  return { num: Number(id.slice(0, -1)), suit }
}

export function newDeck() {
  return SUITS.flatMap((suit) => NUMBERS.map((num) => ({ num, suit })))
}

// Jerarquía (14 = la más alta)
const SPECIAL = { '1e': 14, '1b': 13, '7e': 12, '7o': 11 }
const BY_NUMBER = { 3: 10, 2: 9, 1: 8, 12: 7, 11: 6, 10: 5, 7: 4, 6: 3, 5: 2, 4: 1 }

export function rank(card) {
  return SPECIAL[cardId(card)] ?? BY_NUMBER[card.num]
}

// Valor de una carta para el envido / la flor: las figuras valen 0
export const envidoValue = (card) => (card.num >= 10 ? 0 : card.num)

/** Puntos de envido de una mano (2 o 3 cartas). */
export function envidoPoints(cards) {
  let best = 0
  for (const suit of SUITS) {
    const vals = cards.filter((c) => c.suit === suit).map(envidoValue).sort((a, b) => b - a)
    if (vals.length >= 2) best = Math.max(best, 20 + vals[0] + vals[1])
    else if (vals.length === 1) best = Math.max(best, vals[0])
  }
  return best
}

/** ¿Tiene flor? (las tres cartas del mismo palo) */
export const hasFlor = (cards) => cards.length === 3 && cards.every((c) => c.suit === cards[0].suit)

/** Puntos de flor: 20 + las tres cartas. */
export const florPoints = (cards) => 20 + cards.reduce((s, c) => s + envidoValue(c), 0)

/** Mezcla con una función aleatoria (inyectable para tests y para el servidor). */
export function shuffle(deck, random = Math.random) {
  const d = deck.slice()
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

export function cardName(c) {
  const names = { 1: 'Ancho', 10: 'Sota', 11: 'Caballo', 12: 'Rey' }
  if (c.num === 1 && c.suit === 'espada') return 'Ancho de espada'
  if (c.num === 1 && c.suit === 'basto') return 'Ancho de basto'
  const n = c.num === 1 ? '1' : names[c.num] ?? String(c.num)
  return `${n} de ${c.suit}`
}
