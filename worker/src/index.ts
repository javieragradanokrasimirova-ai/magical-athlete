// API de salas de Magical Athlete: Cloudflare Worker + D1 (nivel gratuito).
import { createGame, act, publicGame } from '../../src/lib/engine';

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

async function room(req:Request, env:Env){try{const raw=await req.text();if(raw.length>4096)return json({error:'Petición demasiado grande'},413);const b=JSON.parse(raw);const db=env.DB;if(!db)return json({error:'Las salas todavía no están disponibles.'},503);if(b.type==='create'){const code=crypto.randomUUID().replace(/-/g,'').slice(0,12).toUpperCase(),key=token();const s=createGame([String(b.name||'Jugador 1').slice(0,30),'Jugador 2'],crypto.getRandomValues(new Uint32Array(1))[0]);await db.prepare('DELETE FROM rooms WHERE expires<?').bind(Date.now()).run();await db.prepare('INSERT INTO rooms (code,state,host,revision,expires) VALUES (?,?,?,0,?)').bind(code,JSON.stringify(s),await hash(key),Date.now()+7*86400000).run();return json({code,key,owner:0,game:publicGame(s,0),joined:false})}if(typeof b.code!=='string'||!/^[A-F0-9]{12}$/.test(b.code))return json({error:'Código no válido'},400);const room:any=await db.prepare('SELECT * FROM rooms WHERE code=?').bind(b.code).first();if(!room||room.expires<Date.now())return json({error:'La sala no existe o ha caducado'},404);if(b.type==='join'){if(room.guest)return json({error:'La sala ya tiene dos jugadores. Usa el dispositivo con el que entraste.'},409);const key=token(),s=JSON.parse(room.state);s.names[1]=String(b.name||'Jugador 2').slice(0,30);s.version++;const result=await db.prepare('UPDATE rooms SET guest=?,state=?,revision=revision+1 WHERE code=? AND guest IS NULL AND revision=?').bind(await hash(key),JSON.stringify(s),b.code,room.revision).run();if(!result.meta.changes)return json({error:'La sala ha cambiado. Inténtalo otra vez.'},409);return json({code:b.code,key,owner:1,game:publicGame(s,1),joined:true})}const h=await hash(String(b.key||'')),owner=h===room.host?0:h===room.guest?1:-1;if(owner<0)return json({error:'No tienes acceso a esta partida'},403);let s=JSON.parse(room.state);if(b.type==='act'){if(!room.guest)return json({error:'Espera a que entre tu pareja'},409);if(b.version!==s.version)return json({error:'La partida ha cambiado; vuelve a intentarlo'},409);s=act(s,owner,b.action);const result=await db.prepare('UPDATE rooms SET state=?,revision=revision+1 WHERE code=? AND revision=?').bind(JSON.stringify(s),b.code,room.revision).run();if(!result.meta.changes)return json({error:'Otra acción llegó antes; vuelve a intentarlo'},409)}else if(b.type!=='poll')return json({error:'Acción desconocida'},400);return json({game:publicGame(s,owner),joined:!!room.guest})}catch(e:any){return json({error:e.message||'No se pudo completar la acción'},400)}}

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
