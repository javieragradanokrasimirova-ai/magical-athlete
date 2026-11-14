import { RACERS,card } from './racers';
export { pow as effectivePower };
export type Runner={id:string,owner:number,pos:number,trip:boolean,out:boolean,finished:boolean,power:string,pred?:string,genius?:number,first:boolean,copyTarget?:string,copyKey?:string};
type Event={type:string,id?:string,n?:number,target?:string,ids?:string[],warp?:boolean,main?:boolean,label?:string,source?:string};
type Option={label:string,events:Event[]};
export type Game={version:number,seed:number,phase:string,names:string[],scores:number[],round:number,deck:string[],market:string[],teams:string[][],picks:string[][],draftIndex:number,draftFirst:number,owner:number,startOwner:number,runners:Runner[],queue:Event[],choice:null|{owner:number,title:string,options:Option[]},log:string[],winners:string[],history:string[],acted:string[],firstTurn:boolean[],active:string|null,origin:number,roll:number|null,rollCount:number,merchantUsed:boolean,steps:number,seen:string[],roundScores:number[],ready:boolean[],nextId?:string,extraId?:string,historyPowers?:Record<string,string>,bronze?:number[],racersPerPlayer?:number,eliminated?:string[]};
export const FINISH=30;
export const WILD:Record<number,string>={1:'star',5:'trip',7:'3',11:'1',13:'star',16:'4',17:'trip',23:'2',24:'-2',26:'trip'};
function random(s:Game){let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x>>>0;return s.seed/4294967296;}
function die(s:Game){return 1+Math.floor(random(s)*6)}
function bronze(s:Game,owner:number,n:number){s.bronze??=s.names.map(()=>0);const change=n<0?-Math.min(s.bronze[owner],-n):n;s.bronze[owner]+=change;s.scores[owner]+=change}
function note(s:Game,t:string){s.log.push(t);if(s.log.length>160)s.log.shift()}
function live(s:Game){return s.runners.filter(r=>!r.out&&!r.finished)}
function runner(s:Game,id?:string){return s.runners.find(r=>r.id===id)!}
function pow(s:Game,r:Runner):string{if(r.power!=='copy')return r.power;const others=live(s).filter(a=>a.id!==r.id&&a.power!=='copy');if(!others.length)return '';const top=Math.max(...others.map(a=>a.pos));return (others.find(a=>a.pos===top&&a.id===r.copyTarget)||others.find(a=>a.pos===top))?.power||''}
function withPower(s:Game,p:string){return live(s).filter(r=>pow(s,r)===p)}
function name(id:string){return card(id)?.name||id}
function add(s:Game,...e:Event[]){s.queue.unshift(...e)}
function move(id:string,n:number,source?:string):Event{return {type:'move',id,n,source}}
function ask(s:Game,owner:number,title:string,options:Option[]){s.choice={owner,title,options}}
function optional(s:Game,r:Runner,title:string,events:Event[]){ask(s,r.owner,title,[{label:'Usar poder',events:[{type:'power',id:r.id},...events]},{label:'Pasar',events:[]}])}
function power(s:Game,r:Runner){for(const a of withPower(s,'scoocher'))if(a.id!==r.id)add(s,move(a.id,1,'scoocher'))}
export const MIN_PLAYERS=2;
export const MAX_PLAYERS=6;
const RACES=4;

export function racersNeeded(s:Game){return s.racersPerPlayer??2}

function players(s:Game){return s.names.map((_,i)=>i)}

function rollOff(s:Game,candidates=players(s)):number{
 if(candidates.length===1)return candidates[0];
 const rolls=candidates.map(owner=>({owner,value:die(s)}));
 const unique=rolls.filter(r=>rolls.filter(other=>other.value===r.value).length===1);
 if(!unique.length)return rollOff(s,candidates);
 return unique.reduce((best,r)=>r.value>best.value?r:best).owner;
}

function draftSize(s:Game){return s.names.length===2?8:2*s.names.length}

export function createGame(names=['Jugador 1','Jugador 2'],seed=Date.now()>>>0,doubleRacers=false):Game{
 if(names.length<MIN_PLAYERS||names.length>MAX_PLAYERS)throw Error('La partida admite de 2 a 6 jugadores');
 if(doubleRacers&&names.length!==3)throw Error('La variante doble requiere tres jugadores');
 const s:Game={
  version:0,seed:seed||1,phase:'draft',names:[...names],racersPerPlayer:names.length===2||doubleRacers?2:1,
  scores:names.map(()=>0),round:0,deck:RACERS.map(r=>r.id),market:[],teams:names.map(()=>[]),picks:names.map(()=>[]),
  draftIndex:0,draftFirst:0,owner:0,startOwner:0,runners:[],queue:[],choice:null,log:[],winners:[],history:[],
  acted:[],firstTurn:names.map(()=>false),active:null,origin:0,roll:null,rollCount:0,merchantUsed:false,steps:0,
  seen:[],roundScores:names.map(()=>0),ready:names.map(()=>false),
 };
 for(let i=s.deck.length-1;i>0;i--){
  const j=Math.floor(random(s)*(i+1));
  [s.deck[i],s.deck[j]]=[s.deck[j],s.deck[i]];
 }
 s.draftFirst=rollOff(s);
 s.owner=s.draftFirst;
 s.market=s.deck.splice(0,draftSize(s));
 note(s,'Comienza la selección de equipos.');
 return s;
}

function draft(s:Game,owner:number,id:string){
 if(!s.market.includes(id))throw Error('Atleta no disponible');
 s.teams[owner].push(id);
 s.market=s.market.filter(racer=>racer!==id);
 s.draftIndex++;
 if(s.draftIndex===s.names.length*RACES*racersNeeded(s)){
  s.phase='select';
  s.owner=0;
  s.startOwner=rollOff(s);
  return;
 }
 const size=draftSize(s),pick=s.draftIndex%size,count=s.names.length;
 if(!pick)s.market=s.deck.splice(0,size);
 const leg=pick%(2*count);
 const offset=leg<count?leg:2*count-1-leg;
 s.owner=(s.draftFirst+Math.floor(s.draftIndex/size)+offset)%count;
}
function finish(s:Game,r:Runner){if(r.finished||r.out)return;r.finished=true;r.pos=FINISH;s.winners.push(r.id);const pts=s.winners.length===1?[3,4,4,5][s.round]:[1,2,2,3][s.round];s.scores[r.owner]+=pts;note(s,`${name(r.id)} llega ${s.winners.length}º y gana ${pts} puntos.`);if(s.winners.length===1){s.history.push(r.id);s.historyPowers??={};s.historyPowers[r.id]=r.power;const m=s.runners.find(a=>!a.out&&pow(s,a)==='mastermind'&&a.pred===r.id);if(m){m.finished=true;s.winners.push(m.id);s.scores[m.owner]+=[1,2,2,3][s.round];note(s,`${name(m.id)} acertó su predicción y obtiene la plata.`)}}if(s.winners.length>=2||!live(s).length)endRace(s)}
function endRace(s:Game){s.phase='results';s.queue=[];s.choice=null;s.active=null;note(s,'Carrera terminada.');}
function startRace(s:Game){s.phase='race';s.queue=[];s.steps=0;s.seen=[];s.nextId=undefined;s.extraId=undefined;s.roundScores=[...s.scores];s.runners=s.picks.flatMap((ids,owner)=>ids.map(id=>({id,owner,pos:0,trip:false,out:false,finished:false,power:id,first:true})));s.picks=s.names.map(()=>[]);s.ready=s.names.map(()=>false);s.winners=[];s.eliminated=[];s.acted=[];s.firstTurn=s.names.map(()=>s.racersPerPlayer===undefined);s.active=null;s.roll=null;s.owner=s.startOwner;for(const r of s.runners){s.teams[r.owner]=s.teams[r.owner].filter(id=>id!==r.id);s.queue.push({type:'setup',id:r.id})}note(s,`Carrera ${s.round+1}: ${s.round%2?'Wild Wilds':'Mild Mile'}.`);drain(s)}
function setup(s:Game,r:Runner){const p=pow(s,r);if(p==='sisyphus'){bronze(s,r.owner,4);note(s,`${name(r.id)} comienza con 4 puntos de bronce.`)}if(p==='egg'){const ids=s.deck.splice(0,3);ask(s,r.owner,'Elige el poder del Huevo',ids.map(id=>({label:name(id),events:[{type:'copy',id:r.id,target:id},{type:'setup',id:r.id}]})))}if(p==='twin'&&s.history.length)ask(s,r.owner,'Elige un ganador al que copiar',[...new Set(s.history)].map(id=>({label:name(id),events:[{type:'copy',id:r.id,target:s.historyPowers?.[id]||id},{type:'setup',id:r.id}]})))}
function start(s:Game,r:Runner){if(r.power==='copy'){const candidates=live(s).filter(a=>a.id!==r.id&&a.power!=='copy');const top=Math.max(...candidates.map(a=>a.pos));const leaders=candidates.filter(a=>a.pos===top);if(leaders.length>1&&!r.copyTarget){ask(s,r.owner,'¿Qué poder quieres copiar?',leaders.map(a=>({label:name(a.id),events:[{type:'copyTarget',id:r.id,target:a.id},{type:'start',id:r.id}]})));return}}s.active=r.id;s.origin=r.pos;s.roll=null;s.rollCount=0;s.merchantUsed=false;s.seen=[];s.steps=0;note(s,`Turno de ${name(r.id)}.`);add(s,{type:'before',id:r.id},{type:'main',id:r.id},{type:'end',id:r.id});}
function before(s:Game,r:Runner){const p=pow(s,r),all=live(s),others=all.filter(a=>a.id!==r.id);if(p==='mastermind'&&r.first){ask(s,r.owner,'¿Quién ganará esta carrera?',all.map(a=>({label:name(a.id),events:[{type:'predict',id:r.id,target:a.id}]})))}else if(p==='loser'&&others.every(a=>a.pos>r.pos)){bronze(s,r.owner,1);power(s,r);note(s,`${name(r.id)} gana 1 punto por ir solo en último lugar.`)}else if(p==='party'){power(s,r);add(s,...others.map(a=>move(a.id,Math.sign(r.pos-a.pos),'party')))}else if(p==='cheer'){const last=Math.min(...all.map(a=>a.pos));optional(s,r,'¿Animar a quienes van últimos?',[...all.filter(a=>a.pos===last).map(a=>move(a.id,2,'cheer')),move(r.id,1,'cheer')])}else if(p==='hypnotist'&&others.length){ask(s,r.owner,'¿A quién atraes a tu casilla?',[...others.map(a=>({label:name(a.id),events:[{type:'power',id:r.id},{type:'warp',id:a.id,n:r.pos}]})),{label:'Pasar',events:[]}])}else if(p==='third'){const targets=[...new Set(all.map(a=>a.pos))].filter(pos=>all.filter(a=>a.pos===pos).length===2);if(targets.length)ask(s,r.owner,'¿Teletransportarte a una pareja?',[...targets.map(n=>({label:`Casilla ${n}`,events:[{type:'power',id:r.id},{type:'warp',id:r.id,n}]})),{label:'Pasar',events:[]}])}r.first=false}
function main(s:Game,r:Runner){if(r.out||r.finished)return;if(r.trip){r.trip=false;note(s,`${name(r.id)} se recupera de la caída.`);return}const p=pow(s,r);if(p==='hare'&&live(s).filter(a=>a.id!==r.id).every(a=>a.pos<r.pos)){power(s,r);note(s,`${name(r.id)} se detiene al ir solo en cabeza.`);return}const opts:Option[]=[{label:'Tirar el dado',events:[{type:'roll',id:r.id}]}];if(p==='legs')opts.push({label:'Avanzar 5',events:[{type:'power',id:r.id},{type:'mainmove',id:r.id,n:5}]});if(p==='flip')for(const a of live(s).filter(a=>a.id!==r.id))opts.push({label:`Cambiar con ${name(a.id)}`,events:[{type:'power',id:r.id},{type:'swap',id:r.id,target:a.id}]});if(p==='genius'){ask(s,r.owner,'Predice el resultado del dado',[{label:'Sin predicción',events:[{type:'genius',id:r.id,n:0},{type:'roll',id:r.id}]},...[1,2,3,4,5,6].map(n=>({label:String(n),events:[{type:'genius',id:r.id,n},{type:'roll',id:r.id}]}))]);return}ask(s,r.owner,`Movimiento de ${name(r.id)}`,opts)}
function roll(s:Game,r:Runner){s.roll=die(s);note(s,`${name(r.id)} saca ${s.roll}.`);add(s,{type:'rolloptions',id:r.id})}
function rolloptions(s:Game,r:Runner){const p=pow(s,r),opts:Option[]=[{label:`Conservar ${s.roll}`,events:[{type:'resolveRoll',id:r.id,n:s.roll!}]}];if(p==='magician'&&s.rollCount<2)opts.push({label:`Repetir (${2-s.rollCount} restantes)`,events:[{type:'reroll',id:r.id}]});if(withPower(s,'merchant').length&&!s.merchantUsed)opts.push({label:'Repetir con el Mercader',events:[{type:'merchantRoll',id:r.id}]});if(opts.length>1)ask(s,r.owner,'¿Conservas el dado?',opts);else add(s,...opts[0].events)}
function resolveRoll(s:Game,r:Runner,n:number){const p=pow(s,r);for(const a of withPower(s,'skipper'))if(n===1){s.nextId=a.id;power(s,a)}if(p==='genius'&&r.genius===n){s.extraId=r.id;power(s,r)}if(p==='sisyphus'&&n===6){bronze(s,r.owner,-1);power(s,r);add(s,{type:'warp',id:r.id,n:0});return}const worms=withPower(s,'worm').filter(a=>a.id!==r.id);if(n===1&&worms.length){add(s,...worms.flatMap(a=>[{type:'power',id:a.id},move(a.id,1,'worm')]));return}if(n===6)add(s,...withPower(s,'lackey').filter(a=>a.id!==r.id).flatMap(a=>[{type:'power',id:a.id},move(a.id,2,'lackey')]),{type:'rollPower',id:r.id,n});else add(s,{type:'rollPower',id:r.id,n})}
function rollPower(s:Game,r:Runner,n:number){const p=pow(s,r);if(p==='rocket')ask(s,r.owner,'¿Duplicar el dado y tropezar?',[{label:`Avanzar ${n}`,events:[{type:'mainmove',id:r.id,n}]},{label:`Duplicar a ${n*2}`,events:[{type:'power',id:r.id},{type:'mainmove',id:r.id,n:n*2},{type:'trip',id:r.id}]}]);else if(p==='alchemist'&&n<=2)ask(s,r.owner,'¿Transformar el dado?',[{label:`Avanzar ${n}`,events:[{type:'mainmove',id:r.id,n}]},{label:'Avanzar 4',events:[{type:'power',id:r.id},{type:'mainmove',id:r.id,n:4}]}]);else add(s,{type:'mainmove',id:r.id,n})}
function mainmove(s:Game,r:Runner,n:number){const p=pow(s,r);if(p==='hare'){n+=2;power(s,r)}if(p==='blimp'){n+=s.origin<15?3:-1;power(s,r)}if(p==='party')n+=live(s).filter(a=>a.id!==r.id&&a.pos===r.pos).length;for(const a of withPower(s,'coach').filter(a=>a.pos===r.pos)){n++;power(s,a)}for(const a of withPower(s,'gunk').filter(a=>a.id!==r.id)){n--;power(s,a)}add(s,move(r.id,Math.max(0,n),'main'))}
function movement(s:Game,r:Runner,n:number,warp=false){if(r.out||r.finished||(!n&&!warp))return;const from=r.pos,all=live(s),p=pow(s,r);let to=warp?n:r.pos+n;if(!warp&&p==='toad'){to=from;for(let i=0;i<Math.abs(n);i++){to+=Math.sign(n);while(to>0&&to<FINISH&&all.some(a=>a.id!==r.id&&a.pos===to)){to+=Math.sign(n);power(s,r)}}}if(!warp&&to>FINISH&&withPower(s,'stickler').some(a=>a.id!==r.id)){note(s,`${name(r.id)} necesita un movimiento exacto para llegar.`);return}to=Math.max(0,Math.min(FINISH,to));if(from===to)return;r.pos=to;note(s,`${name(r.id)} ${warp?'se teletransporta':'se mueve'} de ${from} a ${to}.`);const events:Event[]=[];if(!warp){for(const a of all.filter(a=>a.id!==r.id)){if(from<a.pos&&to>a.pos){if(pow(s,a)==='banana')events.push({type:'power',id:a.id},{type:'trip',id:r.id});if(p==='centaur')events.push({type:'power',id:r.id},move(a.id,-2,'centaur'))}if(a.pos===from&&pow(s,a)==='sucker')events.push({type:'follow',id:a.id,n:to,target:r.id})}}if(to>=FINISH){finish(s,r);if(s.phase==='race')add(s,...events);return}events.push({type:'stop',id:r.id});add(s,...events)}
function stop(s:Game,r:Runner){if(r.out||r.finished)return;const all=live(s),same=all.filter(a=>a.id!==r.id&&a.pos===r.pos);const baby=same.find(a=>pow(s,a)==='baby');if(r.pos>0&&baby){power(s,baby);add(s,{type:'warp',id:r.id,n:r.pos-1});return}if(r.pos>0&&pow(s,r)==='baby'&&same.length){power(s,r);add(s,...same.map(a=>({type:'warp',id:a.id,n:r.pos-1})));return}let e:Event[]=[];if(s.round%2){const tile=WILD[r.pos];if(tile==='star'){bronze(s,r.owner,1);note(s,`${name(r.id)} recoge una estrella.`)}else if(tile==='trip')e.push({type:'trip',id:r.id});else if(tile)e.push(move(r.id,Number(tile),'track'))}if(pow(s,r)==='mouth'&&same.length===1){power(s,r);same[0].out=true;(s.eliminated??=[]).push(same[0].id);note(s,`${name(r.id)} elimina a ${name(same[0].id)}.`)}if(pow(s,r)==='baba'&&same.length){power(s,r);e.push(...same.map(a=>({type:'trip',id:a.id})))}for(const a of same.filter(a=>pow(s,a)==='baba'))e.push({type:'power',id:a.id},{type:'trip',id:r.id});if(same.length===1)for(const a of withPower(s,'romantic'))e.push({type:'power',id:a.id},move(a.id,2,'romantic'));for(const a of [r,...same].filter(a=>pow(s,a)==='duelist')){for(const b of [r,...same].filter(b=>b.id!==a.id))e.push({type:'duelOffer',id:a.id,target:b.id})}add(s,...e);if(live(s).length===1){finish(s,live(s)[0]);endRace(s)}else if(!live(s).length)endRace(s)}
function end(s:Game,r:Runner){if(Math.abs(r.pos-s.origin)<=1)for(const a of withPower(s,'heckler')){power(s,a);add(s,move(a.id,2,'heckler'))}s.active=null;s.acted.push(r.id);s.queue.push({type:'next'});}
function availableRunners(s:Game,owner=s.owner){
 return live(s).filter(r=>r.owner===owner&&!s.acted.includes(r.id));
}

export function turnRunners(s:Game,owner=s.owner){
 const candidates=availableRunners(s,owner);
 return s.racersPerPlayer===undefined?candidates:candidates.slice(0,1);
}

function next(s:Game){
 const id=s.nextId||s.extraId;
 const skipper=!!s.nextId;
 s.nextId=undefined;
 s.extraId=undefined;
 const r=runner(s,id);
 if(r&&!r.out&&!r.finished){
  if(skipper){
   s.owner=r.owner;
   const order=s.runners.filter(a=>a.owner===r.owner);
   s.acted=s.racersPerPlayer===undefined?[]:order.slice(0,order.indexOf(r)).map(a=>a.id);
   s.firstTurn[r.owner]=false;
  }else s.acted=s.acted.filter(x=>x!==id);
  start(s,r);
  return;
 }
 if(availableRunners(s).length&&!s.firstTurn[s.owner])return;
 s.firstTurn[s.owner]=false;
 s.acted=[];
 for(let offset=1;offset<=s.names.length;offset++){
  const owner=(s.owner+offset)%s.names.length;
  if(availableRunners(s,owner).length){
   s.owner=owner;
   return;
  }
 }
 endRace(s);
}

function event(s:Game,e:Event){const r=runner(s,e.id);if(e.id&&(!r||r.out||r.finished)&&!['end','extra','predict'].includes(e.type))return;switch(e.type){case 'start':start(s,r);break;case 'copyTarget':r.copyTarget=e.target;r.copyKey=e.label;break;case 'setup':if(r.power!=='copy')setup(s,r);break;case 'copy':r.power=e.target!;break;case 'predict':r.pred=e.target;break;case 'genius':r.genius=e.n;break;case 'power':power(s,r);break;case 'before':before(s,r);break;case 'main':main(s,r);break;case 'roll':roll(s,r);break;case 'rolloptions':rolloptions(s,r);break;case 'reroll':s.rollCount++;power(s,r);roll(s,r);break;case 'merchantRoll':s.merchantUsed=true;for(const a of withPower(s,'merchant')){power(s,a);if(a.id!==r.id)add(s,move(a.id,1,'merchant'))}add(s,{type:'roll',id:r.id});break;case 'resolveRoll':resolveRoll(s,r,e.n!);break;case 'rollPower':rollPower(s,r,e.n!);break;case 'mainmove':mainmove(s,r,e.n!);break;case 'move':movement(s,r,e.n!);break;case 'warp':movement(s,r,e.n!,true);break;case 'stop':stop(s,r);break;case 'trip':r.trip=true;note(s,`${name(r.id)} tropieza.`);break;case 'swap':{const t=runner(s,e.target),old=r.pos;r.pos=t.pos;t.pos=old;note(s,`${name(r.id)} intercambia posición con ${name(t.id)}.`);add(s,{type:'stop',id:r.id},{type:'stop',id:t.id});break}case 'follow':optional(s,r,`¿Acompañar a ${name(e.target!)}?`,[move(r.id,e.n!-r.pos,'sucker')]);break;case 'duelOffer':if(r.pos===runner(s,e.target)?.pos)optional(s,r,`¿Retar a ${name(e.target!)}?`,[{type:'duel',id:r.id,target:e.target}]);break;case 'duel':{const a=die(s),b=die(s),id=a>=b?r.id:e.target!;note(s,`Duelo: ${a} contra ${b}. Gana ${name(id)}.`);add(s,move(id,2,'duel'));break}case 'end':end(s,r);break;case 'next':next(s);break;case 'extra':if(r&&!r.out&&!r.finished){s.owner=r.owner;s.active=r.id;s.origin=r.pos;add(s,{type:'before',id:r.id},{type:'main',id:r.id},{type:'end',id:r.id})}break}}
function refreshCopy(s:Game){for(const r of live(s).filter(a=>a.power==='copy')){const others=live(s).filter(a=>a.id!==r.id&&a.power!=='copy');const top=Math.max(...others.map(a=>a.pos));const leaders=others.filter(a=>a.pos===top);if(!leaders.length)continue;if(leaders.length===1){r.copyTarget=leaders[0].id;r.copyKey=leaders[0].id;continue}const key=leaders.map(a=>a.id).join(',');if(r.copyKey!==key){ask(s,r.owner,'Imitador: elige entre los líderes empatados',leaders.map(a=>({label:name(a.id),events:[{type:'copyTarget',id:r.id,target:a.id,label:key}]})));return}}}
function drain(s:Game){while(s.queue.length&&!s.choice&&s.phase==='race'){if(s.queue[0].type!=='copyTarget'&&!s.queue.some(e=>e.type==='setup')){refreshCopy(s);if(s.choice)break;}if(++s.steps>600){s.queue=[];s.choice=null;note(s,'Se ha detenido una cadena excepcional de efectos.');break}const e=s.queue.shift()!;const sig=JSON.stringify([e,s.runners.map(r=>[r.id,r.pos,r.trip,r.out,r.finished])]);if(['move','warp','stop','duelOffer','follow'].includes(e.type)){if(s.seen.includes(sig)){note(s,'Se cierra una repetición de efectos.');continue}s.seen.push(sig)}event(s,e)}}
export function actor(s:Game){return s.choice?.owner??s.owner}
function quickRoll(s:Game,owner:number){const choice=s.choice;if(choice?.owner===owner&&choice.options.length===1&&choice.options[0].events.length===1&&choice.options[0].events[0].type==='roll'){s.choice=null;add(s,...choice.options[0].events);drain(s)}}
function nextStarter(s:Game){
 if(racersNeeded(s)===2){
  const gained=s.scores.map((n,i)=>n-s.roundScores[i]);
  return rollOff(s,players(s).filter(i=>gained[i]===Math.min(...gained)));
 }
 const firstOut=s.runners.find(r=>r.id===s.eliminated?.[0]);
 if(firstOut)return firstOut.owner;
 const last=Math.min(...s.runners.map(r=>r.pos));
 return rollOff(s,s.runners.filter(r=>r.pos===last).map(r=>r.owner));
}

export function act(input:Game,owner:number,action:any):Game{
 const s=structuredClone(input);
 if(!Number.isInteger(owner)||owner<0||owner>=s.names.length)throw Error('Jugador desconocido');
 if(action.type==='select'&&s.phase==='select'){
  if(s.ready[owner])throw Error('Elección confirmada');
  const ids=action.ids,count=racersNeeded(s);
  if(!Array.isArray(ids)||ids.length!==count||new Set(ids).size!==count||ids.some(id=>!s.teams[owner].includes(id))){
   throw Error(count===1?'Elige un atleta de tu equipo':'Elige dos atletas de tu equipo');
  }
  s.picks[owner]=ids;
  s.ready[owner]=true;
  if(s.ready.every(Boolean))startRace(s);
  else s.owner=s.ready.findIndex(ready=>!ready);
 }else{
  if(actor(s)!==owner)throw Error('Es el turno de otro jugador');
  if(action.type==='draft'&&s.phase==='draft'){
   draft(s,owner,action.id);
  }else if(action.type==='runner'&&s.phase==='race'&&!s.active&&!s.choice){
   const r=turnRunners(s,owner).find(r=>r.id===action.id);
   if(!r)throw Error('Atleta no disponible');
   start(s,r);
   drain(s);
   if(action.quick)quickRoll(s,owner);
  }else if(action.type==='choice'&&s.choice){
   const option=Number.isInteger(action.index)?s.choice.options[action.index]:undefined;
   if(!option)throw Error('Opción no válida');
   s.choice=null;
   add(s,...option.events);
   drain(s);
  }else if(action.type==='continue'&&s.phase==='results'){
   if(s.round===RACES-1)s.phase='finished';
   else{
    s.startOwner=nextStarter(s);
    s.round++;
    s.phase='select';
    s.owner=0;
    s.picks=s.names.map(()=>[]);
    s.ready=s.names.map(()=>false);
   }
  }else throw Error('Acción no disponible');
 }
 s.version++;
 return s;
}

export function publicGame(s:Game,owner:number){const result=structuredClone(s);result.seed=0;result.deck=[];result.queue=[];if(result.choice&&result.choice.owner!==owner)result.choice.options=[];result.picks=result.picks.map((p,i)=>i===owner?p:[]);return result}
