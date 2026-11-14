import {Game,Runner,effectivePower} from './engine';
import {card} from './racers';

// Read the public log so quick moves, polling, reconnects and replays agree.
export function lastRoll(g:Game){
 for(let i=g.log.length-1;i>=0;i--){
  const line=g.log[i];
  if(/^Carrera \d+:/.test(line))break;
  const match=line.match(/^(.+) saca ([1-6])\.$/);
  if(!match)continue;
  const r=g.runners.find(r=>card(r.id).name===match[1]);
  if(r)return {value:Number(match[2]),runnerId:r.id,owner:r.owner,key:`${g.round}-${i}-${line}`};
 }
 return null;
}
export function lastTurnRunner(g:Game){
 for(let i=g.log.length-1;i>=0;i--){
  if(/^Carrera \d+:/.test(g.log[i]))break;
  const r=g.runners.find(r=>g.log[i]===`Turno de ${card(r.id).name}.`);
  if(r)return r;
 }
 return null;
}

export function place(g:Game,r:Runner){
 if(r.out)return 'Fuera';
 if(r.finished)return `${g.winners.indexOf(r.id)+1}º`;
 const ahead=g.runners.filter(a=>!a.out&&(a.finished||a.pos>r.pos)).length;
 const tied=g.runners.some(a=>a.id!==r.id&&!a.out&&!a.finished&&a.pos===r.pos);
 return `${ahead+1}º${tied?' =':''}`;
}
export function movementHints(g:Game,r:Runner){
 const others=g.runners.filter(a=>!a.out&&!a.finished);
 const hints:{name:string,value:number}[]=[];
 const p=effectivePower(g,r);
 if(p==='hare')hints.push({name:card(r.id).name,value:2});
 if(p==='blimp')hints.push({name:card(r.id).name,value:g.origin<15?3:-1});
 if(p==='party'){const n=others.filter(a=>a.id!==r.id&&a.pos===r.pos).length;if(n)hints.push({name:card(r.id).name,value:n})}
 for(const a of others){const power=effectivePower(g,a);if(power==='gunk'&&a.id!==r.id)hints.push({name:card(a.id).name,value:-1});if(power==='coach'&&a.pos===r.pos)hints.push({name:card(a.id).name,value:1})}
 return hints;
}
export function racePoints(g:Game,owner:number){
 const medals=g.winners.reduce((sum,id,i)=>sum+(g.runners.find(r=>r.id===id)?.owner===owner?(i===0?[3,4,4,5][g.round]:[1,2,2,3][g.round]):0),0);
 const total=g.scores[owner]-g.roundScores[owner];
 return {medals,other:total-medals,total};
}
