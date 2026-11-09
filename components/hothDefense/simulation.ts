import type { DefenseEnemy, DefenseEvent, DefensePhase, DefenseProjectile, DefenseSimulation, DefenseState, Vec3, Weakpoint, WeakpointId } from "./types";

// Echo Base stands to the left of the battlefield, its shield generator tower visible over the dashboard.
const BASE: Vec3 = [-26, 4, -80], SHIP: Vec3 = [0, 1.55, 2.9];
const POOL = 96, SHOT_SPEED = 220, SHOT_DAMAGE = 10;
// The boss walker is drawn 1.45 times the base model's size; its weak points scale with it.
export const BOSS_SCALE = 1.45;
const offsets: Record<WeakpointId, Vec3> = {
  "left-leg": [-3.1 * BOSS_SCALE, 7 * BOSS_SCALE, 4.5 * BOSS_SCALE], "right-leg": [3.1 * BOSS_SCALE, 7 * BOSS_SCALE, 4.5 * BOSS_SCALE],
  weapons: [0, 15.1 * BOSS_SCALE, 13.2 * BOSS_SCALE], command: [0, 16.25 * BOSS_SCALE, 8.05 * BOSS_SCALE],
};
const copy = (p: Vec3): Vec3 => [p[0], p[1], p[2]];
/** Fraction of a swept segment entering a sphere. Tests the whole path, so fast bolts cannot tunnel. */
function sweep(a: Vec3, b: Vec3, c: Vec3, r: number) {
  const x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2],u=a[0]-c[0],v=a[1]-c[1],w=a[2]-c[2];
  const aa=x*x+y*y+z*z,cc=u*u+v*v+w*w-r*r;
  if(cc<=0)return 0;
  if(aa<1e-12)return Infinity;
  const bb=2*(u*x+v*y+w*z),disc=bb*bb-4*aa*cc;
  if(disc<0)return Infinity;
  const t=(-bb-Math.sqrt(disc))/(2*aa);
  return t>=0&&t<=1?t:Infinity;
}

/** Browser-independent, deterministic combat simulation. All mutable pools stay bounded. */
export function createDefenseSimulation(initialSeed = 1980): DefenseSimulation {
  let randomSeed=initialSeed>>>0;
  const rand=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};
  const projectiles: DefenseProjectile[] = Array.from({length:POOL},(_,id)=>({id,owner:"player",position:[0,0,0],previous:[0,0,0],velocity:[0,0,0],damage:0,ttl:0,active:false}));
  const targets: ("base"|"ship"|null)[]=Array(POOL).fill(null);
  const state: DefenseState={phase:"briefing",wave:0,time:0,phaseTime:0,base:100,shields:100,heat:0,overheated:false,specialReadyAt:0,coolingReadyAt:0,score:0,multiplier:1,shots:0,hits:0,kills:0,totalDamage:0,enemies:[],projectiles,message:"Base Écho : en attente de votre autorisation.",rank:null};
  let events:DefenseEvent[]=[],waveTime=0,spawned=0,nextShot=0,enemyId=0,streak=0,misses=0,nextMissComment=0,nextStep=0;
  let pausedFrom:DefensePhase="playing";
  const meta=new Map<number,{spawn:number;homeX:number;fireAt:number;phase:number}>();
  const emit=(event:DefenseEvent)=>{if(events.length<128)events.push(event);};
  const radio=(text:string)=>{state.message=text;emit({type:"radio",text});};
  const phase=(value:DefensePhase)=>{state.phase=value;state.phaseTime=0;};
  const bolt=(owner:"player"|"enemy",origin:Vec3,direction:Vec3,speed:number,damage:number,target:"base"|"ship"|null)=>{
    const slot=projectiles.find(p=>!p.active);if(!slot)return false;
    const length=Math.hypot(...direction);if(!Number.isFinite(length)||length<1e-8)return false;
    slot.owner=owner;slot.active=true;slot.damage=damage;slot.ttl=owner==="player"?2.2:7;
    for(let axis=0;axis<3;axis++){slot.position[axis]=slot.previous[axis]=origin[axis];slot.velocity[axis]=direction[axis]/length*speed;}
    targets[slot.id]=target;return true;
  };
  const miss=()=>{
    streak=0;state.multiplier=1;
    if(++misses>=6&&state.time>nextMissComment){radio("Droïde : les flocons ne sont pas nos ennemis, commandant.");nextMissComment=state.time+18;misses=0;}
  };
  const finish=(won:boolean)=>{
    phase(won?"victory":"defeat");projectiles.forEach(p=>p.active=false);
    if(won){
      const accuracy=state.shots?state.hits/state.shots:0;
      state.score+=Math.round(state.base*15+state.shields*8);
      state.rank=state.totalDamage===0?"Légende":state.base>=75&&accuracy>=.35?"Or":state.base>=40?"Argent":"Bronze";
      radio(state.totalDamage===0?"Transmission inconnue : la Force est puissante en vous. Canal 1138 fermé.":"Base Écho : offensive repoussée. Mission accomplie !");
    }else radio(state.base<=0?"Base Écho : nos défenses sont tombées. Évacuez la zone !":"Droïde : boucliers épuisés. Liaison de combat interrompue.");
    emit({type:won?"victory":"defeat",text:state.message});
  };
  const hurt=(target:"base"|"ship",damage:number,position:Vec3)=>{
    if(state.phase!=="playing")return;
    if(target==="base")state.base=Math.max(0,state.base-damage);else state.shields=Math.max(0,state.shields-damage);
    state.totalDamage+=damage;emit({type:"damage",target,amount:damage,position:copy(position)});
    if(state.base<=0||state.shields<=0)finish(false);
  };
  const bossPoints=(enemy:DefenseEnemy)=>{
    const down=enemy.collapse*7.5*BOSS_SCALE;
    for(const point of enemy.weakpoints){const o=offsets[point.id];point.position[0]=enemy.position[0]+o[0];point.position[1]=enemy.position[1]+o[1]-down;point.position[2]=enemy.position[2]+o[2];}
    const protectedParts=enemy.weakpoints.filter(p=>p.id!=="command");
    const command=enemy.weakpoints.find(p=>p.id==="command")!;command.vulnerable=protectedParts.every(p=>p.hp===0);
    enemy.hp=enemy.weakpoints.reduce((sum,p)=>sum+p.hp,0);
  };
  const destroy=(enemy:DefenseEnemy)=>{
    enemy.alive=false;enemy.hp=0;state.kills++;state.score+=(enemy.kind==="atat"?3000:enemy.kind==="tank"?450:enemy.kind==="scout"?250:150)*state.multiplier;
    emit({type:"explosion",position:copy(enemy.position),amount:enemy.kind==="atat"?4:1});
  };
  const hit=(enemy:DefenseEnemy,point:Weakpoint|undefined,damage:number,fromShot:boolean)=>{
    if(!enemy.alive)return;
    if(point&&!point.vulnerable){emit({type:"hit",position:copy(point.position),amount:0});return;}
    if(fromShot){state.hits++;misses=0;state.multiplier=Math.min(5,1+Math.floor(++streak/5));}
    enemy.flash=.16;
    if(point){
      point.hp=Math.max(0,point.hp-damage);bossPoints(enemy);
      emit({type:"hit",position:copy(point.position),amount:damage});
      if(point.hp===0){state.score+=150*state.multiplier;radio(point.id==="command"?"Droïde : module de commande neutralisé.":point.id==="weapons"?"Droïde : systèmes de tir impériaux hors service.":"Droïde : articulation neutralisée. Maintenez la pression !");}
      if(enemy.hp===0)destroy(enemy);
    }else{enemy.hp=Math.max(0,enemy.hp-damage);emit({type:"hit",position:copy(enemy.position),amount:damage});if(enemy.hp===0)destroy(enemy);}
  };
  const spawn=(kind:DefenseEnemy["kind"],index:number)=>{
    const boss=kind==="atat",probe=kind==="probe";
    const x=boss?0:(index%2?-1:1)*(8+rand()*19),z=boss?-118:probe?-90-rand()*15:-112-rand()*15;
    const hp=boss?540:probe?30:kind==="tank"?75:45;
    const enemy:DefenseEnemy={id:++enemyId,kind,position:[x,probe?1+rand()*7:-8,z],radius:boss?16:probe?2:kind==="tank"?3.8:2.7,hp,maxHp:hp,alive:true,target:boss||index%3!==1?"base":"ship",weakpoints:[],collapse:0,flash:0};
    if(boss)enemy.weakpoints=(["left-leg","right-leg","weapons","command"] as WeakpointId[]).map(id=>({id,position:[0,0,0],radius:(id==="command"?2.25:id==="weapons"?1.9:2.2)*1.3,hp:id==="command"?180:id==="weapons"?100:130,maxHp:id==="command"?180:id==="weapons"?100:130,vulnerable:id!=="command"}));
    if(boss)bossPoints(enemy);
    state.enemies.push(enemy);meta.set(enemy.id,{spawn:state.time,homeX:x,fireAt:state.time+(probe?8:10)+rand()*4,phase:rand()*Math.PI*2});
  };
  const enterWave=()=>{
    phase("playing");waveTime=0;spawned=0;
    state.enemies=state.enemies.filter(e=>e.alive);meta.clear();
    emit({type:"wave",amount:state.wave});
    if(state.wave===1)radio("Droïde : reconnaissance impériale. Interceptez les sondes avant qu’elles transmettent !");
    if(state.wave===2)radio("Base Écho : blindés en approche. Certains appareils verrouillent votre vaisseau.");
    if(state.wave===3){spawn("atat",0);spawned=1;nextStep=state.time+1.4;radio("Droïde : blindage AT-AT impénétrable. Visez les articulations et les canons, puis la commande !");}
  };
  const advance=()=>{
    if(state.wave===3){finish(true);return;}
    state.wave++;phase("transition");waveTime=0;spawned=0;
    if(state.wave===3){emit({type:"boss",position:[0,-8,-118]});radio("Base Écho : contact lourd dans le blizzard. Un AT-AT arrive !");}
    else radio("Droïde : première ligne neutralisée. Préparez-vous à l’offensive terrestre.");
    projectiles.forEach(p=>{if(p.owner==="enemy")p.active=false;});
  };
  const update=(dt:number)=>{
    if(!["playing","transition"].includes(state.phase))return;
    state.time+=dt;state.phaseTime+=dt;
    state.heat=Math.max(0,state.heat-dt*(state.overheated?16:11));
    if(state.overheated&&state.heat<=28){state.overheated=false;emit({type:"cooldown"});}
    if(state.phase==="transition"){
      if(state.phaseTime>=(state.wave===3?8:state.wave===1?3:4))enterWave();
      return;
    }
    waveTime+=dt;
    const count=state.wave===1?6:state.wave===2?8:1,interval=state.wave===1?5.5:6.5;
    if(state.wave<3&&spawned<count&&waveTime>=spawned*interval){spawn(state.wave===1?"probe":spawned%3===0?"tank":"scout",spawned);spawned++;}
    for(const enemy of state.enemies){
      if(!enemy.alive)continue;
      const m=meta.get(enemy.id)!;enemy.flash=Math.max(0,enemy.flash-dt);
      if(enemy.kind==="probe"){
        const flank=m.homeX+Math.sin((state.time-m.spawn)*.9+m.phase)*5.5;
        const merge=Math.max(0,Math.min(1,(enemy.position[2]+90)/50));
        const centred=Math.max(-17,Math.min(17,flank*.55));
        enemy.position[0]=flank+(centred-flank)*merge;
        enemy.position[1]=3.5+Math.sin((state.time-m.spawn)*1.15+m.phase)*3;
        enemy.position[2]=Math.min(-40,enemy.position[2]+dt*1.35);
      }else if(enemy.kind==="atat"){
        const left=enemy.weakpoints.find(p=>p.id==="left-leg")!,right=enemy.weakpoints.find(p=>p.id==="right-leg")!;
        if(left.hp===0&&right.hp===0)enemy.collapse=Math.min(1,enemy.collapse+dt*.42);
        if(enemy.collapse===0)enemy.position[2]=Math.min(-70,enemy.position[2]+dt*(enemy.position[2]<-95?.9:.5));
        bossPoints(enemy);
        if(state.time>=nextStep&&enemy.collapse<.1){nextStep=state.time+2.2;emit({type:"step",position:copy(enemy.position)});}
      }else{
        // Stop short of the cockpit dashboard silhouette: ground targets stay visible through the canopy.
        enemy.position[2]=Math.min(-82,enemy.position[2]+dt*(enemy.kind==="tank"?.72:1.2));
        // Flanking units converge on the defended sector instead of escaping a narrow cockpit view.
        const flank=m.homeX+Math.sin((state.time-m.spawn)*.25+m.phase)*2;
        const merge=Math.max(0,Math.min(1,(enemy.position[2]+90)/50));
        const centred=Math.max(-17,Math.min(17,flank*.55));
        enemy.position[0]=flank+(centred-flank)*merge;
      }
      const weapon=enemy.weakpoints.find(p=>p.id==="weapons");
      if(state.time>=m.fireAt&&(!weapon||weapon.hp>0)){
        const target=enemy.target==="base"?BASE:SHIP;
        const origin:Vec3=enemy.kind==="atat"?copy(weapon!.position):[enemy.position[0],enemy.position[1]+(enemy.kind==="probe"?0:2),enemy.position[2]+2];
        const direction:Vec3=[target[0]-origin[0],target[1]-origin[1],target[2]-origin[2]];
        bolt("enemy",origin,direction,enemy.kind==="probe"?30:38,enemy.kind==="atat"?8:enemy.kind==="tank"?5:3,enemy.target);
        m.fireAt=state.time+(enemy.kind==="atat"?4:enemy.kind==="probe"?8:7)+rand()*2;
        emit({type:"shot",position:origin,target:enemy.target});
      }
    }
    for(const p of projectiles){
      if(!p.active)continue;
      for(let a=0;a<3;a++){p.previous[a]=p.position[a];p.position[a]+=p.velocity[a]*dt;}
      p.ttl-=dt;
      if(p.owner==="player"){
        let closest=Infinity,hitEnemy:DefenseEnemy|undefined,hitPoint:Weakpoint|undefined;
        for(const enemy of state.enemies){if(!enemy.alive)continue;
          if(enemy.kind==="atat"){
            for(const point of enemy.weakpoints){if(point.hp<=0)continue;const t=sweep(p.previous,p.position,point.position,point.radius);if(t<closest){closest=t;hitEnemy=enemy;hitPoint=point;}}
          }else{const centre:Vec3=[enemy.position[0],enemy.position[1]+(enemy.kind==="probe"?0:1.5),enemy.position[2]];const t=sweep(p.previous,p.position,centre,enemy.radius);if(t<closest){closest=t;hitEnemy=enemy;hitPoint=undefined;}}
        }
        if(hitEnemy){p.active=false;hit(hitEnemy,hitPoint,p.damage,true);}
      }else{
        const target=targets[p.id];if(target){const spot=target==="base"?BASE:SHIP;if(sweep(p.previous,p.position,spot,target==="base"?4:2)<Infinity){p.active=false;hurt(target,p.damage,spot);}}
      }
      if(p.active&&p.ttl<=0){p.active=false;if(p.owner==="player")miss();}
      if(state.phase!=="playing")break;
    }
    if(state.phase==="playing"&&spawned===count&&state.enemies.every(e=>!e.alive))advance();
  };
  const reset=()=>{
    randomSeed=initialSeed>>>0;events=[];waveTime=spawned=nextShot=enemyId=streak=misses=nextMissComment=nextStep=0;meta.clear();targets.fill(null);
    projectiles.forEach(p=>{p.active=false;p.ttl=0;p.damage=0;for(let a=0;a<3;a++)p.position[a]=p.previous[a]=p.velocity[a]=0;});
    Object.assign(state,{phase:"briefing",wave:0,time:0,phaseTime:0,base:100,shields:100,heat:0,overheated:false,specialReadyAt:0,coolingReadyAt:0,score:0,multiplier:1,shots:0,hits:0,kills:0,totalDamage:0,enemies:[],message:"Base Écho : en attente de votre autorisation.",rank:null});
  };
  const start=()=>{if(state.phase!=="briefing")return;state.wave=1;phase("transition");radio("Droïde : systèmes de défense actifs. Protégez la base Écho, commandant !");};
  return {
    state,start,restart:()=>{reset();start();},
    pause:()=>{if(state.phase==="playing"||state.phase==="transition"){pausedFrom=state.phase;state.phase="paused";}},
    resume:()=>{if(state.phase==="paused")state.phase=pausedFrom;},
    fire:(origin,direction)=>{
      if(state.phase!=="playing"||state.overheated||state.time+1e-7<nextShot||!origin.every(Number.isFinite)||!direction.every(Number.isFinite))return false;
      if(!bolt("player",origin,direction,SHOT_SPEED,SHOT_DAMAGE,null))return false;
      state.shots++;nextShot=state.time+.2;state.heat=Math.min(100,state.heat+12);
      emit({type:"shot",position:copy(origin)});
      if(state.heat>=100){state.overheated=true;emit({type:"overheat",text:"Canons en surchauffe. Appuyez sur R pour refroidir."});radio("Droïde : canons en surchauffe. Laissez-les respirer !");}
      return true;
    },
    cool:()=>{if(state.phase!=="playing"||state.time<state.coolingReadyAt)return false;state.heat=Math.max(0,state.heat-85);state.overheated=false;state.coolingReadyAt=state.time+20;emit({type:"cooldown",text:"Refroidissement d’urgence activé."});return true;},
    special:()=>{
      if(state.phase!=="playing"||state.time<state.specialReadyAt)return false;
      state.specialReadyAt=state.time+30;emit({type:"special",text:"Impulsion ionique déployée."});
      for(const enemy of state.enemies){if(!enemy.alive)continue;if(enemy.kind==="atat"){const points=enemy.weakpoints.filter(p=>p.vulnerable&&p.hp>0);for(const p of points)hit(enemy,p,25,false);}else hit(enemy,undefined,45,false);}
      return true;
    },
    step:(dt)=>{if(!Number.isFinite(dt)||dt<=0)return;let remaining=Math.min(dt,.25);while(remaining>1e-8){const step=Math.min(.025,remaining);update(step);remaining-=step;}},
    drainEvents:()=>{const out=events;events=[];return out;},
  };
}
