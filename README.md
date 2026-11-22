# truco

Truco argentino en React + Vite: contra la compu (1v1 y 2v2) y online con amigos.

- Login con las mismas cuentas que el Sudoku (mismo proyecto de Supabase)
- Buscador de jugadores, pedidos de amistad y lista de amigos
- Partidas online por invitación o con código de sala; los asientos vacíos los juega la compu
- El servidor (`supabase/functions/truco`) reparte y valida cada jugada con el mismo motor;
  cada jugador recibe solo su vista, así nadie puede ver cartas ajenas

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
npm run dev       # http://localhost:5173 (con Supabase)
npm run dev:mock  # servidor simulado: abrí dos pestañas para jugar entre dos usuarios
npm test        # motor de reglas e IA
npm run build
```

El motor (`src/engine/`) es JavaScript puro y sin dependencias: el mismo código va a
correr en el servidor para las partidas online.

## Supabase

1. Correr `supabase/schema.sql` en el proyecto del Sudoku (tablas de amigos y salas).
2. Desplegar la función `truco` con `supabase/functions/truco/index.ts` más
   `src/server/rooms.js` y `src/engine/*.js` (en `server/` y `engine/`).

## Créditos

Naipes de la baraja española: dibujos de [Basquetteur](https://commons.wikimedia.org/wiki/User:Basquetteur)
(Wikimedia Commons), vía [spanish-playing-cards-svg](https://github.com/gjenkins20/spanish-playing-cards-svg),
con licencia [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Se convirtieron a WebP
(`public/naipes/`), con fondo blanco y esquinas redondeadas; se comparten con la misma licencia.
