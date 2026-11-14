# Magical Athlete

Adaptación web **no oficial** del juego de carreras Magical Athlete para dos jugadores: 36 atletas, draft con selecciones ocultas, cuatro carreras con poderes y eventos, tablero en 3D o plano, y partidas en una misma pantalla o en **salas remotas** con un código.

**Jugar:** https://javieragradanokrasimirova-ai.github.io/magical-athlete/

> Juego original de Takashi Ishida, actualizado por Richard Garfield. Ilustraciones y tablero pertenecen a sus autores; este proyecto es una adaptación sin ánimo de lucro. Las reglas pueden no ser fieles en casos excepcionales (ver `RULES-RESEARCH.md`).

## Cómo está hecho

- **Web estática** (React 19 + TypeScript + Vite, tablero 3D con three.js) publicada en GitHub Pages.
- **Salas remotas:** un Cloudflare Worker con base de datos D1 (nivel gratuito) en `worker/`. La web consulta cada pocos segundos; el servidor valida cada jugada con el mismo motor de reglas (`src/lib/engine.ts`) y guarda el estado. No hay cuentas: se entra con un nombre y las salas caducan a los 7 días.
- **Motor de reglas determinista** con pruebas: `npm test` simula 150 partidas completas.

## Desarrollo

```bash
npm install
npm test
npm run worker:dev   # API local en 127.0.0.1:8787 (necesita D1 local)
npm run dev          # web en http://localhost:5173
npm run build
```

Desplegar el Worker: crear una base D1, poner su `database_id` en `worker/wrangler.toml`, aplicar `worker/schema.sql` y ejecutar `npm run worker:deploy`. La URL del Worker se define en `.github/workflows/deploy.yml` (`VITE_API_URL`) y los orígenes permitidos en `worker/src/index.ts`.

## Cómo se hizo

Proyecto personal de Javier Agradano Krasimirova. Desarrollado con asistentes de IA bajo mi dirección: yo definí la idea y las decisiones de producto, y revisé y probé cada cambio.
