// Ejecuta las comprobaciones del motor de reglas y de la presentación.
import { spawnSync } from 'node:child_process';
let fail = 0;
for (const t of ['engine', 'presentation']) {
  const r = spawnSync(process.execPath, [`tests/${t}.mjs`], { stdio: 'inherit' });
  if (r.error || r.status !== 0) fail = 1;
}
process.exit(fail);
