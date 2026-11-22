# truco

Truco argentino en React + Vite: contra la compu (1v1 y 2v2) y, próximamente, online con amigos.

## Reglas

- Mazo español de 40 cartas, partidas a 30 (15 malas y 15 buenas), tanteador con fósforos
- Envido, real envido y falta envido (en las malas la falta gana el partido; en las buenas,
  da lo que le falta al que va ganando). Empates: gana el mano
- Flor (opcional): 3 puntos; contraflor (6), contraflor al resto, "con flor me achico" (4)
- Truco, retruco y vale cuatro; solo sube quien aceptó. El envido está primero
- Pardas: primera ganada y segunda parda gana la primera; todo pardas, gana el mano

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # motor de reglas e IA
npm run build
```

El motor (`src/engine/`) es JavaScript puro y sin dependencias: el mismo código va a
correr en el servidor para las partidas online.
