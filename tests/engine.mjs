import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';

fs.mkdirSync('.test-build',{recursive:true});
for(const file of ['racers','engine']){
 const {outputText}=ts.transpileModule(fs.readFileSync(`src/lib/${file}.ts`,'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}
 });
 fs.writeFileSync(`.test-build/${file}.mjs`,outputText.replace("'./racers'","'./racers.mjs'"));
}
const {createGame,act,actor,publicGame,turnRunners,racersNeeded}=await import('../.test-build/engine.mjs');

const first=createGame(['A','B'],1234);
assert.deepEqual(first,createGame(['A','B'],1234));
assert.throws(()=>act(first,1-first.owner,{type:'draft',id:first.market[0]}));
assert.throws(()=>createGame(['A']));
assert.throws(()=>createGame(Array(7).fill('A')));

for(const [count,double] of [[2,false],[3,false],[3,true],[4,false],[5,false],[6,false]]){
 let actions=0;
 for(let seed=1;seed<=30;seed++){
  let game=createGame(Array.from({length:count},(_,i)=>String(i)),seed,double);
  if(seed===1&&count===2)delete game.racersPerPlayer;
  const picks=racersNeeded(game);
  const size=count===2?8:count*2;
  const clockwise=Array.from({length:count},(_,i)=>i);
  const snake=[...clockwise,...clockwise.toReversed()];
  for(let i=0;game.phase==='draft';i++){
   const batch=Math.floor(i/size);
   assert.equal(game.owner,(game.draftFirst+batch+snake[i%size%(count*2)])%count);
   assert.equal(game.market.length,size-i%size);
   game=act(game,game.owner,{type:'draft',id:game.market[0]});
  }
  assert.ok(game.teams.every(team=>team.length===4*picks));
  assert.equal(new Set(game.teams.flat()).size,count*4*picks);

  let moves=0;
  while(game.phase!=='finished'&&moves<4000){
   moves++;
   if(game.phase==='select'){
    const player=game.ready.findLastIndex(value=>!value);
    const ids=game.teams[player].slice(0,picks);
    game=act(game,player,{type:'select',ids});
    if(game.phase==='select'){
     const view=publicGame(game,(player+1)%count);
     assert.deepEqual(view.picks[player],[]);
     assert.deepEqual(view.deck,[]);
     assert.equal(view.seed,0);
    }else assert.equal(game.runners.length,count*picks);
   }else if(game.phase==='results'){
    const previous=game;
    game=act(game,actor(game),{type:'continue'});
    if(game.phase==='select'){
     if(picks===2){
      const gains=previous.scores.map((points,i)=>points-previous.roundScores[i]);
      assert.equal(gains[game.startOwner],Math.min(...gains));
     }else{
      const firstOut=previous.runners.find(r=>r.id===previous.eliminated?.[0]);
      if(firstOut)assert.equal(game.startOwner,firstOut.owner);
      else assert.equal(previous.runners.find(r=>r.owner===game.startOwner).pos,Math.min(...previous.runners.map(r=>r.pos)));
     }
    }
   }else if(game.choice){
    const options=game.choice.options;
    const pass=options.findIndex(o=>o.label==='Pasar');
    const index=pass>=0&&moves%3!==0?pass:(seed+moves)%options.length;
    game=act(game,actor(game),{type:'choice',index});
   }else{
    const [runner]=turnRunners(game);
    assert.ok(runner,`Turno vacío: ${count} jugadores, semilla ${seed}, carrera ${game.round+1}`);
    game=act(game,game.owner,{type:'runner',id:runner.id,quick:true});
   }
   assert.ok(game.scores.every(Number.isFinite));
   assert.ok(game.runners.every(r=>r.pos>=0&&r.pos<=30));
  }
  assert.equal(game.phase,'finished',`${count} jugadores, variante doble=${double}, semilla ${seed}`);
  assert.equal(game.round,3);
  assert.ok(game.teams.every(team=>team.length===0));
  actions+=moves;
 }
 console.log(`PASS: ${count} jugadores${double?' (variante doble)':''}, 30 partidas completas, ${actions} acciones.`);
}
