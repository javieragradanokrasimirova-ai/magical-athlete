import {useEffect,useRef,useState} from 'react';
import type {Game} from './engine';
import {card,RACERS} from './racers';
import {movementDuration,ROLL_DURATION} from './motionTiming';

const movement = / (se mueve|se teletransporta) de (\d+) a (\d+)/;
const roll = / saca ([1-6])\.$/;
const progressCue = /se mueve|se teletransporta|intercambia|se recupera|tropieza|llega|gana|elimina|acertó/;

function newLines(old:string[],next:string[]){
 for(let overlap=Math.min(old.length,next.length);overlap>0;overlap--){
  const offset=old.length-overlap;
  if(next.slice(0,overlap).every((line,i)=>line===old[offset+i]))return next.slice(overlap);
 }
 return next.slice(-30);
}

function narrate(stage:Game,line:string):{kind:string;ms:number}|undefined{
 if(line.startsWith('Turno de ')){
  stage.roll=null;
  stage.active=stage.runners.find(r=>line==='Turno de '+card(r.id).name+'.')?.id??null;
  return;
 }

 const id=RACERS.find(racer=>line.startsWith(racer.name+' '))?.id;
 const runner=stage.runners.find(racer=>racer.id===id);
 if(!runner)return;

 const moved=line.match(movement),rolled=line.match(roll);
 let kind:string;
 let ms:number;
 if(moved){
  runner.pos=Number(moved[3]);
  kind=moved[1]==='se mueve'?'move':'warp';
  ms=movementDuration(Math.abs(runner.pos-Number(moved[2])));
 }else if(rolled){
  stage.roll=Number(rolled[1]);
  kind='roll';
  ms=ROLL_DURATION;
 }else if(line.includes(' intercambia posición con ')){
  const target=line.split(' intercambia posición con ')[1];
  const other=stage.runners.find(racer=>target===card(racer.id).name+'.');
  if(other)[runner.pos,other.pos]=[other.pos,runner.pos];
  kind='warp';
  ms=540;
 }else if(line.includes(' tropieza.')||line.includes(' se recupera')){
  runner.trip=line.includes(' tropieza.');
  kind=runner.trip?'trip':'recover';
  ms=220;
 }else if(line.includes(' llega ')){
  runner.pos=30;
  runner.finished=true;
  kind='finish';
  ms=300;
 }else if(line.includes(' elimina a ')){
  const target=stage.runners.find(racer=>line.includes(' elimina a '+card(racer.id).name+'.'));
  if(target)target.out=true;
  kind='eliminate';
  ms=260;
 }else return;

 stage.active=runner.id;
 return {kind,ms};
}

export function usePlayback(game:Game,reduced:boolean,fast:boolean){
 const [shown,setShown]=useState(game);
 const [playing,setPlaying]=useState(false),[cue,setCue]=useState(''),[effect,setEffect]=useState(''),[rollKey,setRollKey]=useState(0);
 const [request,setRequest]=useState(0),[replaying,setReplaying]=useState(false);
 const pair=useRef<{old:Game;next:Game}|null>(null);
 const skipRef=useRef(false),wake=useRef<(()=>void)|null>(null);
 const current=useRef(game),seen=useRef(game.version),pending=useRef<Game[]>([]);
 const running=useRef(false),alive=useRef(true);
 const settings=useRef({reduced,fast});
 settings.current={reduced,fast};

 useEffect(()=>{
  alive.current=true;
  return ()=>{alive.current=false;wake.current?.();};
 },[]);
 useEffect(()=>{
  if(reduced)wake.current?.();
 },[reduced]);

 useEffect(()=>{
  if(game.version!==seen.current){
   seen.current=game.version;
   pending.current.push(game);
  }
  if(running.current||!pending.current.length)return;

  async function pump(){
   running.current=true;
   try{
    while(alive.current&&pending.current.length){
     const next=pending.current.shift()!,old=current.current;
     if(next.round!==old.round){
      pair.current=null;
      setCue('');
     }else if(old.phase==='race'&&!settings.current.reduced){
      const lines=newLines(old.log,next.log);
      const stage={...old,runners:old.runners.map(runner=>({...runner}))};
      const journal=[...old.log];
      let animated=false;
      for(const line of lines){
       if(!alive.current||settings.current.reduced||skipRef.current)break;
       journal.push(line);
       const frame=narrate(stage,line);
       if(!frame)continue;
       animated=true;
       setPlaying(true);
       setCue(line);
       setEffect(frame.kind);
       if(frame.kind==='roll')setRollKey(key=>key+1);
       setShown({...stage,runners:stage.runners.map(runner=>({...runner})),log:journal.slice(-160)});
       await new Promise<void>(resolve=>{
        const timer=setTimeout(done,frame.ms*(settings.current.fast?.45:1));
        function done(){clearTimeout(timer);wake.current=null;resolve();}
        wake.current=done;
       });
      }
      if(!alive.current)return;
      if(animated||lines.some(line=>roll.test(line)||progressCue.test(line)))pair.current={old,next};
      setCue(lines.filter(line=>progressCue.test(line)).at(-1)||'');
     }
     current.current=next;
     setShown(next);
     setEffect('');
    }
   }finally{
    running.current=false;
    skipRef.current=false;
    if(alive.current){setPlaying(false);setReplaying(false);}
   }
  }
  void pump();
 },[game,request]);

 function skip(){skipRef.current=true;wake.current?.();}
 function replay(){
  if(!pair.current||running.current)return;
  const {old,next}=pair.current;
  current.current=old;
  setShown(old);
  pending.current.push(next);
  setPlaying(true);
  setReplaying(true);
  setRequest(n=>n+1);
 }
 return {shown,playing:playing||shown.version!==game.version,cue,effect,rollKey,skip,replay,replaying,canReplay:!!pair.current};
}
