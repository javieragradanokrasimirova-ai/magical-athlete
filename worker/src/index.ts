// API de salas de Magical Athlete: Cloudflare Worker + D1 (nivel gratuito).
import { createGame, act, publicGame, MIN_PLAYERS, MAX_PLAYERS, type Game } from '../../src/lib/engine';

interface Env { DB: D1Database }

const ALLOWED = ['https://javieragradanokrasimirova-ai.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173'];
const cors = (req: Request): Record<string, string> => {
  const o = req.headers.get('Origin') || '';
  return ALLOWED.includes(o)
    ? { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
    : { Vary: 'Origin' };
};

const json=(body:any,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function hash(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
const token=()=>crypto.randomUUID()+crypto.randomUUID();

interface StoredRoom {
 code: string;
 state: string | null;
 host: string;
 guest: string | null;
 revision: number;
 expires: number;
}

function guestHashes(value: string | null): string[] {
 if (!value) return [];
 return value.startsWith('[') ? JSON.parse(value) : [value];
}

function playerName(value: unknown, owner: number) {
 return (typeof value === 'string' && value.trim().slice(0, 30)) || `Jugador ${owner + 1}`;
}

function roomView(game: Game, owner: number, guests: string[], revision: number) {
 const seats = game.names.slice(0, guests.length + 1);
 return { game: publicGame(game, owner), revision, seats, joined: seats.length === game.names.length };
}

async function room(req: Request, env: Env) {
 try {
  const raw = await req.text();
  if (raw.length > 4096) return json({error:'Petición demasiado grande'}, 413);
  const body = JSON.parse(raw);
  const db = env.DB;
  if (!db) return json({error:'Las salas todavía no están disponibles.'}, 503);

  if (body.type === 'create') {
   const size = body.size ?? 2;
   if (!Number.isInteger(size) || size < MIN_PLAYERS || size > MAX_PLAYERS) {
    return json({error:'La sala admite de 2 a 6 jugadores'}, 400);
   }
   const code = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
   const key = token();
   const names = Array.from({length: size}, (_, i) => playerName(i === 0 ? body.name : undefined, i));
   const game = createGame(names, crypto.getRandomValues(new Uint32Array(1))[0], body.doubleRacers === true);
   await db.prepare('DELETE FROM rooms WHERE expires<?').bind(Date.now()).run();
   await db.prepare('INSERT INTO rooms (code,state,host,revision,expires) VALUES (?,?,?,0,?)')
    .bind(code, JSON.stringify(game), await hash(key), Date.now() + 7 * 86400000).run();
   return json({code, key, owner:0, ...roomView(game, 0, [], 0)});
  }
  if (typeof body.code !== 'string' || !/^[A-F0-9]{12}$/.test(body.code)) {
   return json({error:'Código no válido'}, 400);
  }

  const key = body.type === 'join' ? token() : String(body.key || '');
  const hashedKey = await hash(key);
  const knownRevision = body.type === 'poll' && Number.isSafeInteger(body.knownRevision) && body.knownRevision >= 0
   ? body.knownRevision : null;
  for (let attempt = 0; attempt < MAX_PLAYERS; attempt++) {
   const stored = await db.prepare(
    'SELECT host,guest,revision,expires,CASE WHEN revision=? THEN NULL ELSE state END AS state FROM rooms WHERE code=?'
   ).bind(knownRevision, body.code).first<StoredRoom>();
   if (!stored || stored.expires < Date.now()) return json({error:'La sala no existe o ha caducado'}, 404);
   const guests = guestHashes(stored.guest);
   if (body.type === 'join') {
    const game: Game = JSON.parse(stored.state!);
    const owner = guests.length + 1;
    if (owner >= game.names.length) return json({error:'La sala ya está completa'}, 409);
    guests.push(hashedKey);
    game.names[owner] = playerName(body.name, owner);
    game.version++;
    const guest = game.names.length === 2 ? guests[0] : JSON.stringify(guests);
    const result = await db.prepare('UPDATE rooms SET guest=?,state=?,revision=revision+1 WHERE code=? AND revision=?')
     .bind(guest, JSON.stringify(game), body.code, stored.revision).run();
    if (result.meta.changes) return json({code:body.code, key, owner, ...roomView(game, owner, guests, stored.revision + 1)});
    continue;
   }

   const guestIndex = guests.indexOf(hashedKey);
   const owner = hashedKey === stored.host ? 0 : guestIndex < 0 ? -1 : guestIndex + 1;
   if (owner < 0) return json({error:'No tienes acceso a esta partida'}, 403);
   if (stored.revision === knownRevision) return json({unchanged:true});
   const game: Game = JSON.parse(stored.state!);
   if (body.type === 'poll') return json(roomView(game, owner, guests, stored.revision));
   if (body.type !== 'act') return json({error:'Acción desconocida'}, 400);
   if (guests.length + 1 < game.names.length) return json({error:'Espera a que se complete la sala'}, 409);
   const simultaneousPick = body.action?.type === 'select' && game.phase === 'select' && body.action.round === game.round;
   if (body.version !== game.version && !simultaneousPick) {
    return json({error:'La partida ha cambiado. Vuelve a intentarlo.'}, 409);
   }
   const next = act(game, owner, body.action);
   const result = await db.prepare('UPDATE rooms SET state=?,revision=revision+1 WHERE code=? AND revision=?')
    .bind(JSON.stringify(next), body.code, stored.revision).run();
   if (result.meta.changes) return json(roomView(next, owner, guests, stored.revision + 1));
   if (!simultaneousPick) break;
  }
  return json({error:'La partida ha cambiado. Vuelve a intentarlo.'}, 409);
 } catch (error) {
  return json({error:error instanceof Error ? error.message : 'No se pudo completar la acción'}, 400);
 }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const headers = cors(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const { pathname } = new URL(req.url);
    if (req.method === 'POST' && pathname === '/room') {
      if (!ALLOWED.includes(req.headers.get('Origin') || '')) return new Response('Origen no permitido', { status: 403 });
      const res = await room(req, env);
      const out = new Response(res.body, res);
      for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
      return out;
    }
    return new Response('Magical Athlete API', { status: 200 });
  },
};
