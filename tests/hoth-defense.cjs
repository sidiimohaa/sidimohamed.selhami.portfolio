const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {createDefenseSimulation}=require('../components/hothDefense/simulation.ts');
const origin=[0,1.55,2.9];
const aim=(p)=>{const d=p.map((v,i)=>v-origin[i]),n=Math.hypot(...d);return d.map(v=>v/n);};
const step=(s,t)=>{for(let a=0;a<t-.0001;a+=.025)s.step(.025);};
const s=createDefenseSimulation(11);s.step(.25);assert.equal(s.state.time,0,'Briefing does not run combat');assert.equal(s.fire(origin,[0,0,-1]),false);
s.start();step(s,1);s.pause();const saved=JSON.stringify(s.state);step(s,2);assert.equal(JSON.stringify(s.state),saved,'Pause freezes transition/state');s.resume();step(s,2.1);assert.equal(s.state.phase,'playing');assert.equal(s.state.enemies[0].kind,'probe');
assert.equal(s.fire(origin,[0,0,0]),false,'Reject zero ray');
const target=s.state.enemies[0];let hitsBefore=s.state.hits;
for(let i=0;i<80&&target.alive;i++){s.fire(origin,aim(target.position));s.step(.025);}
assert.ok(s.state.hits>hitsBefore,'Swept physical bolt hits moving enemy');
for(let i=0;i<160;i++){s.fire(origin,[0,1,0]);s.step(.025);}
assert.ok(s.state.overheated,'Repeated fire overheats');assert.equal(s.fire(origin,[0,0,-1]),false);assert.equal(s.cool(),true);assert.equal(s.state.overheated,false);assert.equal(s.cool(),false,'Emergency cooldown cannot be spammed');
assert.equal(s.special(),true);assert.equal(s.special(),false,'Ion pulse cooldown enforced');
s.pause();const combatPaused=JSON.stringify(s.state);s.step(.25);assert.equal(JSON.stringify(s.state),combatPaused,'Combat/projectiles freeze');s.resume();
s.restart();assert.equal(s.state.shots,0);assert.equal(s.state.enemies.length,0);assert.equal(s.state.projectiles.filter(p=>p.active).length,0);assert.equal(s.state.phase,'transition');
// A real aiming solver shoots moving spheres, never mutates health, phase or enemy objects.
const game=createDefenseSimulation(1980);game.start();const seen=new Set(),history=new Map();let bossChecked=false,collapse=false,vulnerable=false;const eventTypes=new Set();
for(let frame=0;frame<240/.025;frame++){
 const state=game.state;seen.add(state.wave);
 if(state.phase==='playing'){
  const candidates=state.enemies.filter(e=>e.alive);
  let selected=candidates.find(e=>e.target==='ship')||candidates[0];
  if(selected){
   let p=selected.kind==='atat'?(selected.weakpoints.find(w=>w.hp>0&&w.vulnerable)||{}).position:selected.position.slice();
   if(selected.kind==='atat'){
    const command=selected.weakpoints.find(w=>w.id==='command');
    if(!bossChecked){assert.equal(command.vulnerable,false,'Command locked at boss entry');bossChecked=true;}
    if(command.vulnerable)vulnerable=true;
    if(selected.collapse>0)collapse=true;
   }else if(selected.kind!=='probe')p[1]+=1.5;
   const old=history.get(selected.id),flight=Math.hypot(p[0]-origin[0],p[1]-origin[1],p[2]-origin[2])/220;
   if(old&&selected.kind==='probe'){
     const dt=state.time-old.time;
     if(dt>0&&dt<.1)for(let a=0;a<3;a++)p[a]+=(selected.position[a]-old.p[a])/dt*flight;
   }
   history.set(selected.id,{time:state.time,p:selected.position.slice()});
   game.fire(origin,aim(p));
  }
  if(state.heat>76)game.cool();
  // Hold the pulse for waves 2/3 so projectile targeting is exercised for the entire first wave.
  if(state.wave>=2&&state.enemies.some(e=>e.alive))game.special();
 }
 game.step(.025);for(const event of game.drainEvents())eventTypes.add(event.type);
 if(['victory','defeat'].includes(state.phase))break;
}
assert.equal(game.state.phase,'victory',JSON.stringify({phase:game.state.phase,time:game.state.time,wave:game.state.wave,base:game.state.base,shield:game.state.shields,shots:game.state.shots,hits:game.state.hits,boss:game.state.enemies.find(e=>e.kind==='atat')}));
assert.ok(seen.has(1)&&seen.has(2)&&seen.has(3));assert.ok(collapse&&vulnerable);assert.equal(game.state.kills,15);assert.ok(game.state.score>0&&game.state.rank);assert.equal(game.state.projectiles.length,96);
// A second run destroys the boss guns first and checks locked command armour with real bolts.
const perfect=createDefenseSimulation(1980);perfect.start();const prev=new Map();let commandWindow=-1,armourChecked=false,mystery=false;
for(let frame=0;frame<240/.025;frame++){
 const st=perfect.state;
 if(st.phase==='playing'){
  const enemies=st.enemies.filter(e=>e.alive),e=enemies.find(e=>e.target==='ship')||enemies[0];
  if(e){
   let p;
   if(e.kind==='atat'){
    const gun=e.weakpoints.find(w=>w.id==='weapons'),command=e.weakpoints.find(w=>w.id==='command');
    if(gun.hp===0&&!armourChecked){
      if(commandWindow<0)commandWindow=st.time;
      assert.equal(command.vulnerable,false);assert.equal(command.hp,command.maxHp,'Armoured command takes no damage');
      p=command.position.slice();
      if(st.time-commandWindow>2){armourChecked=true;p=null;}
    }
    if(!p){const w=['weapons','left-leg','right-leg','command'].map(id=>e.weakpoints.find(w=>w.id===id)).find(w=>w.hp>0&&w.vulnerable);p=w.position.slice();}
   }else{
    p=e.position.slice();if(e.kind!=='probe')p[1]+=1.5;
    const old=prev.get(e.id),flight=Math.hypot(p[0]-origin[0],p[1]-origin[1],p[2]-origin[2])/220;
    if(old&&e.kind==='probe'&&st.time-old.time<.1)for(let a=0;a<3;a++)p[a]+=(e.position[a]-old.p[a])/(st.time-old.time)*flight;
    prev.set(e.id,{time:st.time,p:e.position.slice()});
   }
   perfect.fire(origin,aim(p));
  }
  if(st.heat>76)perfect.cool();if(st.wave>=2&&st.enemies.some(e=>e.alive))perfect.special();
 }
 perfect.step(.025);for(const event of perfect.drainEvents())if(event.text?.includes('1138'))mystery=true;
 if(['victory','defeat'].includes(st.phase))break;
}
assert.equal(perfect.state.phase,'victory');assert.ok(armourChecked);assert.equal(perfect.state.totalDamage,0,'A flawless run is possible');assert.equal(perfect.state.rank,'Légende');assert.ok(mystery,'Perfect victory receives a mysterious transmission');
const loss=createDefenseSimulation(4);loss.start();for(let i=0;i<150/.025&&loss.state.phase!=='defeat';i++)loss.step(.025);assert.equal(loss.state.phase,'defeat','Ignoring attacks loses base or ship');
assert.ok(loss.state.totalDamage>=100);assert.ok(loss.state.base===0||loss.state.shields===0);
for(const v of [game.state.base,game.state.shields,game.state.heat,game.state.score,game.state.time])assert.ok(Number.isFinite(v));
console.log(JSON.stringify({victory:true,missionSeconds:game.state.time,base:game.state.base,shields:game.state.shields,shots:game.state.shots,hits:game.state.hits,rank:game.state.rank,kills:game.state.kills,score:game.state.score,allThreeWaves:true,bossArmour:true,bossCollapse:true,poolSize:96,pause:true,cooldowns:true,restart:true,defeat:true,perfectVictory:true,armourBlocksActualBolts:true,events:[...eventTypes]}));
