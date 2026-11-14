import {useEffect,useState,type CSSProperties,type ReactNode} from 'react';
import {ArrowRight,BookOpen,Check,Copy,Dices,Flag,Layers,Users,X} from 'lucide-react';
import {RACERS,card,artwork} from './lib/racers';
import {createGame,act,actor,racersNeeded,MIN_PLAYERS,MAX_PLAYERS,type Game} from './lib/engine';
import RaceView from './RaceView';

type Session={code:string;key:string;owner:number};
type Room={game:Game;joined:boolean;seats?:string[]};
type Mode='local'|'create'|'join';
const counts=Array.from({length:MAX_PLAYERS-MIN_PLAYERS+1},(_,i)=>i+MIN_PLAYERS);
const defaultName=(i:number)=>`Jugador ${i+1}`;

async function api<T>(body:object):Promise<T>{
 const res=await fetch(import.meta.env.VITE_API_URL+'/room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await res.json();
 if(!res.ok)throw Error(data.error||'Error de conexión');
 return data;
}

function RacerCard({id,onClick,selected,order,compact=false}:{
 id:string;onClick:()=>void;selected?:boolean;order?:number;compact?:boolean
}){
 const racer=card(id);
 return <button className={`racer-card ${compact?'compact':''} ${selected?'selected':''}`}
  style={{'--card':racer.color} as CSSProperties} onClick={onClick} aria-pressed={selected}>
  <strong>{racer.name}</strong><img className="portrait" src={artwork(id)} alt="" loading="lazy"/>
  {!compact&&<span className="power">{racer.power}</span>}
  {!!order&&<b className="check" aria-label={`Orden ${order}`}>{order}</b>}
 </button>;
}

function Dialog({title,children,close,wide=false}:{title:string;children:ReactNode;close?:()=>void;wide?:boolean}){
 return <div className="modal-backdrop" onClick={close}>
  <section className={`modal ${wide?'wide':''}`} role="dialog" aria-label={title} aria-modal="true" onClick={e=>e.stopPropagation()}>
   {close&&<button className="close" onClick={close} aria-label="Cerrar"><X size={23}/></button>}
   <h2>{title}</h2>{children}
  </section>
 </div>;
}

export default function App(){
 const [local,setLocal]=useState<Game|null>(null);
 const [room,setRoom]=useState<Room|null>(null);
 const [session,setSession]=useState<Session|null>(null);
 const [mode,setMode]=useState<Mode>('local');
 const [size,setSize]=useState(4);
 const [double,setDouble]=useState(false);
 const [names,setNames]=useState<string[]>(Array(MAX_PLAYERS).fill(''));
 const [code,setCode]=useState('');
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [selected,setSelected]=useState<string[]>([]);
 const [modal,setModal]=useState<'rules'|'catalog'|null>(null);
 const [inspect,setInspect]=useState<string|null>(null);
 const [saved,setSaved]=useState(false);
 const [curtain,setCurtain]=useState(false);
 const [home,setHome]=useState(true);
 const [connected,setConnected]=useState(true);

 useEffect(()=>{
  setSaved(!!localStorage.getItem('ma-game')||!!localStorage.getItem('ma-session'));
  const invitation=new URLSearchParams(location.search).get('sala');
  if(invitation){setCode(invitation.toUpperCase().replace(/[^0-9A-F]/g,'').slice(0,12));setMode('join');}
 },[]);
 useEffect(()=>{
  function escape(e:KeyboardEvent){if(e.key==='Escape'){if(inspect)setInspect(null);else setModal(null);}}
  window.addEventListener('keydown',escape);
  return ()=>window.removeEventListener('keydown',escape);
 },[inspect]);

 function updateRoom(next:Room){
  setRoom(current=>!current||next.game.version>=current.game.version?next:current);
  setConnected(true);
 }
 useEffect(()=>{
  if(!session||home)return;
  let active=true,timer:ReturnType<typeof setTimeout>;
  async function poll(){
   try{const next=await api<Room>({type:'poll',...session});if(active)updateRoom(next);}
   catch{if(active)setConnected(false);}
   finally{if(active)timer=setTimeout(poll,1500);}
  }
  void poll();
  return ()=>{active=false;clearTimeout(timer);};
 },[session,home]);

 const g=session?room?.game:local;
 const owner=session?.owner??(g?actor(g):0);
 const ready=!session||!!room?.joined;
 const picks=g?racersNeeded(g):1;
 const isTurn=!!g&&ready&&actor(g)===owner;

 function save(next:Game){
  setLocal(next);
  localStorage.setItem('ma-game',JSON.stringify(next));
  setSaved(true);
 }
 function resume(){
  try{
   const stored=localStorage.getItem('ma-session');
   if(stored){setRoom(null);setSession(JSON.parse(stored));setCurtain(false);}
   else{
    const next:Game=JSON.parse(localStorage.getItem('ma-game')!);
    setLocal(next);setSession(null);setCurtain(next.phase==='select');
   }
   setSelected([]);setHome(false);
  }catch{setNotice('No se pudo recuperar la partida.');}
 }
 async function start(){
  if(busy)return;
  setNotice('');setSelected([]);setCurtain(false);
  const players=names.slice(0,size).map((name,i)=>name.trim()||defaultName(i));
  const doubleRacers=size===3&&double;
  if(mode==='local'){
   setSession(null);localStorage.removeItem('ma-session');save(createGame(players,undefined,doubleRacers));setHome(false);
   return;
  }
  setBusy(true);
  try{
   const next=await api<Room&Session>({type:mode,name:names[0].trim(),code,size,doubleRacers});
   const seat={code:next.code,key:next.key,owner:next.owner};
   setSession(seat);setRoom(next);setConnected(true);
   localStorage.setItem('ma-session',JSON.stringify(seat));setSaved(true);setHome(false);
  }catch(error){setNotice(error.message);}
  finally{setBusy(false);}
 }
 async function action(move:{type:string;[key:string]:unknown}){
  if(!g||busy)return;
  setBusy(true);setNotice('');
  try{
   if(session)updateRoom(await api<Room>({type:'act',...session,version:g.version,action:{...move,round:g.round}}));
   else{
    const next=act(g,owner,move);
    save(next);
    if(next.phase==='select'&&actor(next)!==owner)setCurtain(true);
   }
   setSelected([]);
  }catch(error){setNotice(error.message);}
  finally{setBusy(false);}
 }
 function toggle(id:string){
  if(g?.ready[owner]){setInspect(id);return;}
  setSelected(current=>current.includes(id)?current.filter(r=>r!==id):picks===1?[id]:current.length<picks?[...current,id]:current);
 }
 async function invite(){
  if(!session)return;
  const url=new URL(location.pathname,location.origin);
  url.searchParams.set('sala',session.code);
  try{await navigator.clipboard.writeText(url.href);setNotice('Enlace de invitación copiado.');}
  catch{setNotice(`Comparte el código ${session.code}.`);}
 }

 return <main className={`app-shell ${home?'home':`in-game phase-${g?.phase??'loading'}`}`}>
  <header className="site-header">
   <button className="brand" onClick={()=>setHome(true)} aria-label="Magical Athlete, inicio"><Flag size={18}/><span>Magical Athlete</span></button>
   <nav><button onClick={()=>setModal('catalog')}><Layers size={17}/> Atletas</button>
    <button onClick={()=>setModal('rules')}><BookOpen size={17}/> Cómo jugar</button></nav>
  </header>
  {home?<><section className="hero">
   <div className="cover">
    <span className="cover-format"><Users size={17}/> 2–6 jugadores <span>·</span> 4 carreras</span>
    <h1><span>Magical</span><span>Athlete</span></h1>
    <div className="cover-art" aria-hidden="true">
     <img src={artwork('party')} alt="" className="racer-left"/><img src={artwork('banana')} alt="" className="racer-middle"/>
     <img src={artwork('toad')} alt="" className="racer-right"/><Dices className="cover-dice"/>
    </div>
    <div className="cover-stripe" aria-hidden="true"/>
   </div>
   <section className="start-panel" aria-labelledby="new-game">
    <h2 id="new-game">A la salida</h2>
    <div className="entry-modes" role="group" aria-label="Modo de partida">
     {([['local','En esta pantalla'],['create','Crear sala'],['join','Unirse']] as const).map(([id,label])=>
      <button type="button" key={id} aria-pressed={mode===id} onClick={()=>{setMode(id);setNotice('');}}>{label}</button>)}
    </div>
    <form onSubmit={e=>{e.preventDefault();void start();}}>
     {mode!=='join'&&<fieldset><legend>Jugadores</legend><div className="seat-options">{counts.map(count=>
      <button type="button" key={count} aria-pressed={size===count} onClick={()=>setSize(count)}>{count}</button>)}</div></fieldset>}
     {mode!=='join'&&size===3&&<label className="variant"><input type="checkbox" checked={double}
      onChange={e=>setDouble(e.target.checked)}/> Dos atletas por persona y carrera</label>}
     <div className={`player-fields ${mode==='local'?'local-fields':''}`}>
      {names.slice(0,mode==='local'?size:1).map((name,i)=><label key={i}>{mode==='local'?defaultName(i):'Tu nombre'}
       <input maxLength={30} value={name} placeholder={defaultName(i)} autoComplete="off"
        onChange={e=>setNames(current=>current.map((value,j)=>j===i?e.target.value:value))}/></label>)}
     </div>
     {mode==='join'&&<label>Código de sala<input className="code-input" value={code} maxLength={12} placeholder="12 caracteres"
      onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^0-9A-F]/g,''))}/></label>}
     <button className="primary" disabled={busy||(mode==='join'&&!/^[0-9A-F]{12}$/.test(code))}>
      {busy?'Conectando…':mode==='local'?'Empezar partida':mode==='create'?'Crear sala a distancia':'Entrar en la sala'} <ArrowRight size={20}/></button>
    </form>
    {saved&&<button className="resume" onClick={resume}>Continuar partida guardada</button>}
   </section>
  </section><section className="meet">
   <div className="section-title"><h2>Los atletas</h2><button onClick={()=>setModal('catalog')}>Ver los 36 <ArrowRight size={16}/></button></div>
   <div className="cards featured">{['baby','rocket','magician','loser','egg','sucker'].map(id=>
    <RacerCard key={id} id={id} compact onClick={()=>setInspect(id)}/>)}</div>
  </section></>:!g?<p className="loading-room" role="status">{connected?'Cargando la sala…':'Reconectando con la sala…'}</p>:<>
   <section className="game-top"><div>
    <p className="eyebrow">{session?`Sala ${session.code} · ${connected?'En línea':'Reconectando…'}`:'En esta pantalla'}</p>
    <h1>{!ready?'Sala de espera':g.phase==='draft'?'Reclutad vuestro equipo':g.phase==='select'?'Preparad la carrera':
     g.phase==='finished'?'Clasificación final':`Carrera ${g.round+1} de 4`}</h1>
   </div>{ready&&['draft','select'].includes(g.phase)&&<div className="scores">{g.names.map((name,i)=>
    <div key={i} className={`score player-${i} ${owner===i?'you':''}`}>
     <span>{name}{!!session&&owner===i?' · Tú':''}</span><strong>{g.scores[i]} <small>pts</small></strong></div>)}</div>}</section>
   {!ready?<section className="waiting"><Users size={34}/>
    <h2>{room?.seats?.length??owner+1} de {g.names.length} en la sala</h2>
    <p>La partida empieza cuando se completen las plazas.</p>
    <ol>{g.names.map((_,i)=><li key={i} className={`player-${i}`}>{room?.seats?.[i]??(i<=owner?g.names[i]:'Plaza libre')}</li>)}</ol>
    <strong className="room-code">{session?.code}</strong><button className="primary" onClick={invite}>Copiar invitación <Copy size={18}/></button>
   </section>:<>
    {g.phase==='draft'&&<section className="draft-table">
     <div className={`phase-banner player-${g.owner}`}>
      <span>Reclutamiento · {g.draftIndex+1} de {g.names.length*4*picks}</span>
      <h2>{g.names[g.owner]} elige un atleta</h2><p>{isTurn?'Elige una carta para sumarla a tu equipo.':'Puedes consultar las cartas mientras esperas.'}</p>
     </div>
     <div className="cards draft">{g.market.map(id=><RacerCard key={id} id={id}
      onClick={()=>isTurn&&!busy?void action({type:'draft',id}):setInspect(id)}/>)}</div>
     <div className="teams">{g.teams.map((ids,i)=><section key={i} className={`player-${i}`}>
      <h3>{g.names[i]} <span>{ids.length}/{4*picks}</span></h3>
      <div className="mini-team">{ids.map(id=><button key={id} aria-label={card(id).name} onClick={()=>setInspect(id)}>
       <img src={artwork(id)} alt=""/></button>)}</div></section>)}</div>
    </section>}
    {g.phase==='select'&&<section className="draft-table">
     <div className={`phase-banner player-${owner}`}>
      <span>Carrera {g.round+1} · {g.round%2?'Wild Wilds':'Mild Mile'}</span>
      <h2>{g.ready[owner]?'Elección guardada':`${g.names[owner]}, elige ${picks===1?'un atleta':'dos atletas'}`}</h2>
      <p>{g.ready[owner]?`${g.ready.filter(Boolean).length} de ${g.names.length} listos`:picks===2?
       'El orden de selección será su orden de salida.':'Cada atleta puede correr una vez.'}</p>
     </div>
     {!curtain&&<div className="cards draft">{g.teams[owner].map(id=>{
      const ids=g.ready[owner]?g.picks[owner]:selected;
      return <RacerCard key={id} id={id} selected={ids.includes(id)} order={ids.indexOf(id)+1} onClick={()=>toggle(id)}/>;
     })}</div>}
     <div className="selection-footer"><b>{g.ready[owner]?picks:selected.length} de {picks}</b>
      <button className="primary" disabled={busy||selected.length!==picks||g.ready[owner]}
       onClick={()=>action({type:'select',ids:selected})}>Confirmar en secreto <Check size={19}/></button></div>
    </section>}
    {['race','results','finished'].includes(g.phase)&&<RaceView game={g} owner={owner} online={!!session} canAct={isTurn}
     busy={busy} action={action} inspect={setInspect} onHome={()=>setHome(true)}/>}
   </>}
  </>}
  <footer><span>Magical Athlete</span>
   <p className="legal">Adaptación digital no oficial y sin ánimo de lucro. Diseño original de Takashi Ishida, revisión de Richard Garfield e ilustraciones de Angela Kirkwood. Edición de CMYK. Los derechos del juego y sus ilustraciones pertenecen a sus respectivos titulares. Esta web funciona de forma independiente.</p>
   <button onClick={()=>setModal('rules')}>Reglas y créditos <ArrowRight size={15}/></button></footer>
  {notice&&<div className="toast" role="status">{notice}<button onClick={()=>setNotice('')} aria-label="Cerrar aviso"><X size={19}/></button></div>}
  {curtain&&!home&&g?.phase==='select'&&<Dialog title={`Pasa la pantalla a ${g.names[owner]}`}>
   <p>Las elecciones anteriores quedan ocultas hasta la salida.</p><button className="primary" onClick={()=>setCurtain(false)}>Ya estoy en mi turno <ArrowRight size={18}/></button></Dialog>}
  {inspect?<Dialog title={card(inspect).name} close={()=>setInspect(null)}><img className="giant" src={artwork(inspect)} alt=""/>
   <p>{card(inspect).power}</p></Dialog>:modal==='catalog'?<Dialog title="Los 36 atletas" close={()=>setModal(null)} wide>
   <div className="cards catalog">{RACERS.map(r=><RacerCard key={r.id} id={r.id} onClick={()=>setInspect(r.id)}/>)}</div>
  </Dialog>:modal==='rules'&&<Dialog title="Cómo jugar" close={()=>setModal(null)}>
   <ol className="rules">
    <li><b>Reclutad.</b> Elegid en serpiente. En el formato estándar cada persona recluta cuatro atletas. Con dos jugadores o la variante doble de tres, cada persona recluta ocho.</li>
    <li><b>Preparad la salida.</b> Elegid en secreto un atleta por carrera, o dos en las variantes dobles. Cada atleta corre una sola vez.</li>
    <li><b>Corred.</b> Tirad el dado y resolved el movimiento. Los poderes pueden cambiar tiradas, mover fichas o alterar el turno.</li>
    <li><b>Contad los puntos.</b> Disputad cuatro carreras alternando Mild Mile y Wild Wilds. El oro vale 3, 4, 4 y 5 puntos y la plata 1, 2, 2 y 3. Las estrellas y algunos poderes también puntúan.</li>
   </ol><a href="https://www.cmyk.games/products/magical-athlete" target="_blank" rel="noreferrer">Ver el juego de mesa de CMYK</a>
  </Dialog>}
 </main>;
}
