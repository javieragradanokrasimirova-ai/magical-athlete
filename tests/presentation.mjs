import './engine.mjs';
import ts from 'typescript';import fs from 'node:fs';import assert from 'node:assert/strict';
fs.writeFileSync('.test-build/presentation.mjs',ts.transpileModule(fs.readFileSync('src/lib/presentation.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace("'./engine'","'./engine.mjs'").replace("'./racers'","'./racers.mjs'"));
const {createGame,act}=await import('../.test-build/engine.mjs');
const {place,racePoints,movementHints,lastRoll,lastTurnRunner}=await import('../.test-build/presentation.mjs');
function race(){const s=createGame(['A','B'],123);s.phase='race';s.owner=0;s.runners=['banana','legs','blimp','gunk'].map((id,i)=>({id,owner:i<2?0:1,pos:0,trip:false,out:false,finished:false,power:id,first:true}));return s}
let g=race();assert.equal(place(g,g.runners[0]),'1º =');g.runners[0].pos=5;assert.equal(place(g,g.runners[0]),'1º');assert.equal(place(g,g.runners[1]),'2º =');
const quick=act(race(),0,{type:'runner',id:'banana',quick:true});assert.ok(quick.log.some(s=>s.includes(' saca ')));assert.ok(!quick.choice);
const optional=act(race(),0,{type:'runner',id:'legs',quick:true});assert.equal(optional.roll,null);assert.equal(optional.choice.options.length,2);
g=race();g.runners[0].trip=true;const tripped=act(g,0,{type:'runner',id:'banana',quick:true});assert.equal(tripped.roll,null);assert.equal(tripped.runners[0].trip,false);
g=race();g.winners=['banana','legs'];g.scores=[7,1];g.roundScores=[2,0];assert.deepEqual(racePoints(g,0),{medals:4,other:1,total:5});assert.equal(movementHints(g,g.runners[2]).reduce((sum,h)=>sum+h.value,0),2);
console.log('PASS: tied positions, quick rolls, optional actions retained, recovery without rolling, points breakdown and movement modifiers.');

g=race();assert.equal(lastRoll(g),null);
assert.equal(lastRoll(quick).runnerId,'banana','Quick actions still expose their die after the panel changes');
assert.equal(lastRoll(optional),null,'Do not invent a die for an athlete waiting to choose a fixed move');
assert.equal(lastRoll(tripped),null,'Recovering without rolling must not display a die');
g.log=['Carrera 1: Mild Mile.','Turno de Banana.','Banana saca 2.','Banana se mueve de 0 a 2.','Dirigible se mueve de 0 a 1.'];
assert.equal(lastTurnRunner(g).id,'banana','A secondary effect must not change whose move is replaying');
assert.deepEqual(lastRoll(g),{value:2,runnerId:'banana',owner:0,key:'0-2-Banana saca 2.'});
g.log.push('Turno de Dirigible.');g.roll=null;
assert.equal(lastRoll(g).runnerId,'banana','The previous die must stay attributed after the next athlete starts');
g.log.push('Dirigible saca 6.','Dirigible saca 3.');
assert.equal(lastRoll(g).value,3,'Show the latest reroll');assert.equal(lastRoll(g).owner,1);
g.log.push('Duelo: 1 contra 5. Gana Banana.');assert.equal(lastRoll(g).value,3,'Do not mistake duel dice for the main die');
g.round=1;g.log.push('Carrera 2: Wild Wilds.');assert.equal(lastRoll(g),null);assert.equal(lastTurnRunner(g),null);
console.log('PASS: persistent dice attribution, rerolls, replay turn ownership, and clearing dice between races.');
