const fs=require('node:fs'),ts=require('typescript'),THREE=require('three'),assert=require('node:assert/strict');
for(const extension of ['.ts','.tsx'])require.extensions[extension]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
// Canvas painting is irrelevant to navigation and timing; all actual scene geometry runs.
global.document={createElement:()=>{const canvas={width:1,height:1};const noop=()=>{};const context=new Proxy({canvas,measureText:t=>({width:t.length*8}),createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop})},{get:(o,k)=>k in o?o[k]:noop});canvas.getContext=()=>context;return canvas;}};

const {createHothDefenseWorld}=require('../components/hothDefense/world.ts'),{createDefenseSimulation}=require('../components/hothDefense/simulation.ts');
const world=createHothDefenseWorld(),sim=createDefenseSimulation();
sim.start();for(let i=0;i<160;i++){sim.step(.05);world.update(sim.state,sim.drainEvents(),.05,false);}
assert.ok(world.group.getObjectByName('battle-enemy-probe'));
const snow=world.group.getObjectByName('hoth-battle-blizzard');const before=Array.from(snow.geometry.attributes.position.array);
sim.pause();world.update(sim.state,[],.05,false);assert.deepEqual(Array.from(snow.geometry.attributes.position.array),before,'pause freezes snow');
sim.resume();world.update(sim.state,[{type:'special'}],.05,false);
world.setQuality(0);assert.equal(snow.geometry.drawRange.count,180);
// A fixture drives the same boss visual contract as the real simulation.
const boss={id:99,kind:'atat',position:[0,-8,-100],radius:11,hp:420,maxHp:420,alive:true,target:'base',weakpoints:[{id:'left-leg',position:[-3.1,-1,-95.5],radius:1.2,hp:100,maxHp:100,vulnerable:true},{id:'right-leg',position:[3.1,-1,-95.5],radius:1.2,hp:100,maxHp:100,vulnerable:true},{id:'weapons',position:[0,7.1,-86.8],radius:1.2,hp:80,maxHp:80,vulnerable:true},{id:'command',position:[0,8.25,-91.95],radius:1.4,hp:140,maxHp:140,vulnerable:false}],collapse:0,flash:0};
sim.state.enemies.push(boss);world.update(sim.state,[],.05,false);boss.collapse=1;world.update(sim.state,[],.05,false);boss.alive=false;world.update(sim.state,[{type:'explosion',position:[0,-8,-100],amount:4}],.05,false);
let meshes=0,vertices=0;world.group.traverse(o=>{if(o.isMesh||o.isPoints||o.isLine){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)assert.ok(Number.isFinite(p.getX(i))&&Number.isFinite(p.getY(i))&&Number.isFinite(p.getZ(i)));meshes++;vertices+=p.count;}});
sim.restart();world.update(sim.state,[],0,false);assert.equal(world.group.getObjectByName('hoth-live-projectiles').count,0);
world.dispose();assert.equal(world.group.children.length,0);console.log({geometry:true,pause:true,restart:true,quality:true,boss:true,dispose:true,meshes,vertices});
