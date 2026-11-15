'use client';
import {useEffect,useRef,useState} from 'react';
import {actor,Game,effectivePower,turnRunners} from './lib/engine';
import {card,artwork} from './lib/racers';
import Board from './Board';
import {Flag, Gauge, Maximize2, Minimize2, RotateCcw, SkipForward, Sparkles} from 'lucide-react';
import {usePlayback} from './lib/usePlayback';
import {place,movementHints,racePoints,lastRoll,lastTurnRunner} from './lib/presentation';

function Counter({value}:{value:number}){const [n,setN]=useState(value);const last=useRef(value);useEffect(()=>{const from=last.current;last.current=value;let id=0;const start=performance.now();const tick=(t:number)=>{const p=Math.min(1,(t-start)/500);setN(Math.round(from+(value-from)*(1-(1-p)**3)));if(p<1)id=requestAnimationFrame(tick)};id=requestAnimationFrame(tick);return()=>cancelAnimationFrame(id)},[value]);return <>{n}</>}
const dots:Record<number,number[]>={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
function Dice({value,rollKey,rolling,onRoll}:{value:number|null,rollKey:number,rolling:boolean,onRoll?:()=>void}){const die=<div className="dice-stage" aria-label={value?`Dado: ${value}`:'Dado preparado'}><div className={`dice-cube ${rolling?'is-rolling':''}`} key={rollKey} aria-hidden="true">{[1,6,2,5,3,4].map((n,i)=><div className={`dice-face face-${i}`} key={n}>{i===0&&value===null?<b className="dice-question">?</b>:(dots[i===0?value!:n]).map(p=><i key={p} style={{gridArea:`${Math.ceil(p/3)} / ${(p-1)%3+1}`}}/>)}</div>)}</div><span className="dice-shadow"/>{value!==null&&<span className="dice-value">Resultado: <b>{value}</b></span>}</div>;return onRoll?<button className="throw-dice" aria-label="Tirar el dado" onClick={onRoll}>{die}<span>Tirar el dado</span></button>:die}

function RollSummary({game:g,replay}:{game:Game,replay:boolean}){
 const roll=lastRoll(g);
 return <div className={`roll-summary ${roll?`player-${roll.owner}`:''}`} aria-label="Última tirada" data-roll-value={roll?.value}>
  <span key={roll?.key??'empty'} className={`result-die ${roll?'has-result':''}`} aria-hidden="true">{roll?dots[roll.value].map(p=><i key={p} style={{gridArea:`${Math.ceil(p/3)} / ${(p-1)%3+1}`}}/>):'—'}</span>
  <div><span className="roll-label">{replay?'Tirada en repetición':'Última tirada'}</span><strong>{roll?`Sacó un ${roll.value}`:'Sin tiradas todavía'}</strong><small>{roll?`${g.names[roll.owner]} · ${card(roll.runnerId).name}`:'El resultado quedará visible aquí'}</small></div>
 </div>;
}

export default function RaceView({game,owner,online=false,canAct,busy,action,inspect,onHome}:{game:Game,owner:number,online?:boolean,canAct:boolean,busy:boolean,action:(a:any)=>void|Promise<void>,inspect:(id:string)=>void,onHome:()=>void}){
 const [fast,setFast]=useState(false),[reduced,setReduced]=useState(false),[logOpen,setLogOpen]=useState(false),[zoom,setZoom]=useState(false);
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');setReduced(media.matches);const update=()=>setReduced(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);
 const {shown:g,playing,cue,effect,rollKey,skip,replay,replaying,canReplay}=usePlayback(game,reduced,fast);
 const active=g.runners.find(r=>r.id===g.active),turn=playing?(lastTurnRunner(g)?.owner??actor(g)):actor(game),available=turnRunners(game,owner);
 const leaders=game.names.filter((_,i)=>game.scores[i]===Math.max(...game.scores));
 const heading=playing?'El caos está en marcha…':game.phase==='race'?(!canAct?`${game.names[turn]} está decidiendo`:game.choice?.title||(available.length===1?'Tu atleta está listo':'Elige quién corre')):game.phase==='finished'?(leaders.length>1?'¡Victoria compartida!':leaders[0]+' gana'):'¡Carrera terminada!';
 const ranked=[...g.runners].sort((a,b)=>Number(a.out)-Number(b.out)||Number(b.finished)-Number(a.finished)||(a.finished&&b.finished?g.winners.indexOf(a.id)-g.winners.indexOf(b.id):b.pos-a.pos));
 const result=!playing&&game.phase!=='race';
 const deciding=game.runners.find(r=>r.id===game.active),powerRunner=playing?active:deciding;
 const rollIndex=game.choice?.options.findIndex(o=>o.events.length===1&&o.events[0].type==='roll')??-1;
 const canRoll=!playing&&!result&&canAct&&!busy&&rollIndex>=0;
 const hints=powerRunner?movementHints(game,powerRunner):[];
 const powerId=powerRunner?effectivePower(game,powerRunner):'';
 const dieValue=playing?g.roll:canRoll?null:g.roll;
 const turnLabel=playing?(replaying?'REPETICIÓN · JUGADA DE':'JUGADA DE'):result?'RESULTADO':online?(canAct?'TE TOCA':'TURNO DE'):'TURNO DE';
 const turnInstruction=playing?'Resolviendo los efectos de su jugada':result?'Todos los puntos cuentan':!canAct?`Espera a que ${game.names[turn]} termine`:game.choice?'Decide cómo utilizar tu poder':(available.length===1?'Juega el turno de tu atleta':'Elige uno de tus atletas para jugar');
 const roll=lastRoll(g);
 const announcement=result?'Carrera terminada.':`${playing?'Jugada':'Turno'} de ${game.names[turn]}.${roll?` Última tirada: ${game.names[roll.owner]}, ${card(roll.runnerId).name}, ${roll.value}.`:''}`;
 async function activate(id:string){await action({type:'runner',id,quick:true})}
 return <section className={`race-experience ${g.round%2?'wild-track':'mild-track'} ${reduced?'reduce-motion':''} ${fast?'fast-motion':''}`}>
 <div className="race-toolbar"><div className="race-progress" aria-label={`Carrera ${g.round+1} de 4`}>{[0,1,2,3].map(n=><span key={n} aria-current={n===g.round?'step':undefined} className={n===g.round?'current':n<g.round?'complete':''}>{n<g.round?'✓':n+1}<small>{n%2?'WILD':'MILD'}</small></span>)}</div><div className="playback-settings">{playing?<button onClick={skip}><SkipForward size={15} aria-hidden="true"/> Saltar secuencia</button>:canReplay&&!reduced&&<button onClick={replay}><RotateCcw size={15} aria-hidden="true"/> Repetir jugada</button>}<button onClick={()=>setFast(!fast)} aria-pressed={fast} title="Velocidad de las animaciones"><Gauge size={15} aria-hidden="true"/>{fast?'Rápido':'Normal'}</button><button onClick={()=>setReduced(!reduced)} aria-pressed={!reduced}><Sparkles size={15} aria-hidden="true"/>{reduced?'Activar animaciones':'Animaciones activas'}</button></div></div>
 <p className="race-sr-only" role="status" aria-atomic="true">{announcement}</p>
 <div className={`turn-ribbon player-${turn} ${!playing&&!result?'turn-ready':''}`}>
  <div className="turn-identity" key={`${g.round}-${turn}-${playing?'playing':'ready'}`}><span className="turn-player" aria-hidden="true">J{turn+1}</span><div><small>{turnLabel}</small><strong>{result?'Nos vemos en el podio':game.names[turn]}</strong><p>{turnInstruction}</p></div></div>
  <RollSummary game={g} replay={replaying}/>
  <div className="ribbon-points">{g.names.map((n,i)=><span key={i} className={`player-${i} ${i===turn&&!result?'score-in-turn':''}`}><small>{n}</small><b><Counter value={g.scores[i]}/><em> pts</em></b></span>)}</div>
 </div>
 <div className="race-arena"><div className={`board-column ${zoom?'board-zoomed':''}`}><div className="board-controls"><span><i className="dot"/>{g.round%2?'WILD WILDS · CIRCUITO CON SORPRESAS':'MILD MILE · CIRCUITO CLÁSICO'}</span><button onClick={()=>setZoom(!zoom)} aria-pressed={zoom}>{zoom?<Minimize2 size={15} aria-hidden="true"/>:<Maximize2 size={15} aria-hidden="true"/>}{zoom?'Ajustar':'Ampliar'}</button></div><Board game={g} inspect={inspect} effect={effect} reduced={reduced} fast={fast} follow={zoom}/><div className={`event-cue cue-${effect}`}><span className="cue-symbol">{effect==='roll'?'⚄':effect==='trip'?'↯':effect==='finish'?'★':effect==='warp'?'✧':'↗'}</span><span key={cue}>{cue||'Pasa el cursor o pulsa una ficha para consultar su poder.'}</span>{playing&&<span className="activity-dots"><i/><i/><i/></span>}</div>
 <div className="lineup">
  <div className="lineup-heading"><h2><Flag size={20} aria-hidden="true"/> En pista</h2></div>
  <div className="race-lineup">{ranked.map(r=><button type="button" onClick={()=>inspect(r.id)} key={r.id}
   className={'runner-tile player-'+r.owner+(g.active===r.id?' runner-active':'')+(r.out?' runner-out':'')}>
   <span className="runner-rank">{r.out?'×':place(g,r)}</span>
   <img src={artwork(r.id)} alt=""/>
   <span className="runner-name"><strong>{card(r.id).name}</strong><small>{g.names[r.owner]}</small></span>
   <span className={'runner-status'+(r.trip?' is-tripped':'')}>{r.out?'Fuera':r.finished?'Meta':r.trip?'Caído':'Casilla '+r.pos+' / 30'}</span>
   <span className="runner-meter" aria-hidden="true"><i style={{width:(r.pos/30*100)+'%'}}/></span>
  </button>)}</div>
 </div></div>
 <aside aria-label="Decisiones de carrera" className={`decision-panel player-${turn} ${result?'result-panel':''}`}><div className="decision-eyebrow">{result?'LA LÍNEA DE META':`${playing?'JUGADA DE':online?(canAct?'TE TOCA':'ESPERANDO A'):'TURNO DE'} ${game.names[turn]}`}</div>{active&&!result&&<button className="active-portrait" onClick={()=>inspect(active.id)}><img src={artwork(active.id)} alt={card(active.id).name}/><span>Consultar poder ↗</span></button>}<h2>{heading}</h2>
 {!result&&powerRunner&&<div className="power-context"><b>{card(powerRunner.id).name}{powerId!==powerRunner.id&&card(powerId)?` · ${card(powerId).name}`:''}</b><p>{card(powerId)?.power||card(powerRunner.id).power}</p>{hints.length>0&&<div className="move-modifiers"><span>Movimiento principal</span>{hints.map((h,i)=><b key={i} className={h.value<0?'negative':''}>{h.value>0?'+':''}{h.value} {h.name}</b>)}</div>}</div>}
 {!result&&(playing||!!game.choice)&&<Dice value={dieValue} rollKey={rollKey} rolling={playing&&effect==='roll'} onRoll={canRoll?()=>action({type:'choice',index:rollIndex}):undefined}/>}
 {playing?<p className="decision-hint">{cue||'Resolviendo los efectos de la jugada…'}</p>:result?<><div className="finish-confetti" aria-hidden="true">{Array.from({length:22},(_,i)=><i key={i} style={{'--i':i,'--x':`${(i*37)%100}%`,'--c':['#f6d248','#9d81d4','#f18b68','#90b65e'][i%4]} as any}/>)}</div><div className="race-podium">{game.winners.map((id,i)=><div key={`${id}-${i}`}><span>{i===0?'🥇':'🥈'}</span><img src={artwork(id)} alt=""/><strong>{card(id).name}<small>{game.names[game.runners.find(r=>r.id===id)!.owner]}</small></strong></div>)}</div><div className="points-breakdown">{game.names.map((n,i)=>{const points=racePoints(game,i);return <div key={i}><b>{n}<strong>{points.total>=0?'+':''}{points.total}</strong></b><span>Medallas <em>{points.medals}</em></span><span>Poderes y estrellas <em>{points.other}</em></span><span>Total acumulado <em>{game.scores[i]}</em></span></div>})}</div>{game.phase==='results'&&canAct&&<button className="primary" disabled={busy} onClick={()=>action({type:'continue'})}>{game.round===3?'Ver resultado final':'Siguiente carrera'} →</button>}{game.phase==='results'&&!canAct&&<p className="decision-hint">Espera a que se confirme el resultado.</p>}{game.phase==='finished'&&leaders.length>1&&<p className="shared-win">{leaders.join(' · ')}</p>}{game.phase==='finished'&&<button className="primary" onClick={onHome}>Volver a la salida ↗</button>}</>:!canAct?<div className="waiting-decision"><span className="activity-dots"><i/><i/><i/></span><p>{game.names[turn]} está decidiendo.<br/>Su jugada aparecerá aquí.</p></div>:<div className="decision-options">{game.choice?game.choice.options.map((o,i)=>i===rollIndex&&canRoll?null:<button className={i===0?'primary':'outline'} key={`${game.choice!.title}-${i}`} disabled={busy} onClick={()=>action({type:'choice',index:i})}><span>{o.label}</span><b>→</b></button>):available.map(r=><button className="choose-runner" key={r.id} disabled={busy} onClick={()=>activate(r.id)}><img src={artwork(r.id)} alt=""/><span><strong>{card(r.id).name}</strong><small>{r.trip?'Se recuperará de la caída':`Casilla ${r.pos} · ${30-r.pos} hasta meta`}</small><p className="choice-power">{card(effectivePower(game,r))?.power||card(r.id).power}</p></span><b>→</b></button>)}</div>}
 {!playing&&!result&&!game.choice&&canAct&&available.length>1&&<p className="decision-hint">Resuelve por completo un atleta antes de activar al siguiente.</p>}</aside></div>
 <details className="journal" open={logOpen} onToggle={e=>setLogOpen(e.currentTarget.open)}><summary><span>↶ Diario de carrera <b>{g.log.length}</b></span><small>{logOpen?'Ocultar':'Ver todos los efectos'} <span>⌄</span></small></summary><ol>{g.log.slice(-35).reverse().map((line,i)=><li key={`${g.log.length-i}-${line}`}><span>{String(g.log.length-i).padStart(2,'0')}</span>{line}</li>)}</ol></details>
 </section>
}
