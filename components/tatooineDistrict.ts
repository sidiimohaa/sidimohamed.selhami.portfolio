import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { createCoruscantCargo } from "./coruscantCargo";
import { glowTexture, random, type Spot } from "./landingKit";
import { createHeroDroids } from "./tatooineCharacters";
import { createTatooineCantina } from "./tatooineCantina";
import { createDistrictMap } from "./tatooineMap";
import { createLandspeeder, createTatooineScenery } from "./tatooineScenery";
import { createStreetLife } from "./tatooineStreetLife";
export const TATOOINE_GATE = 2.58;
export function districtPoint(u: number, v: number) { return new THREE.Vector3(Math.cos(TATOOINE_GATE) * u + Math.sin(TATOOINE_GATE) * v, 0, -Math.sin(TATOOINE_GATE) * u + Math.cos(TATOOINE_GATE) * v); }
export function districtCoordinates(x: number, z: number) { return { u: Math.cos(TATOOINE_GATE) * x - Math.sin(TATOOINE_GATE) * z, v: Math.sin(TATOOINE_GATE) * x + Math.cos(TATOOINE_GATE) * z }; }
export function createTatooineDistrict(adobe: THREE.Material, groundHeight: (x: number, z: number) => number) {
    const paint=document.createElement("canvas");paint.width=1024;paint.height=512;
    const brush=paint.getContext("2d")!,rand=random(941977);
    brush.fillStyle="#d9ccb0";brush.fillRect(0,0,1024,512);
    for(let chip=0;chip<1400;chip++){
      const x=rand()*1024,y=rand()*512,w=1+rand()*20,h=1+rand()*8;
      brush.fillStyle=chip%3?"#786f581c":"#f8e9cb28";brush.beginPath();brush.moveTo(x,y);
      brush.lineTo(x+w*.8,y-2);brush.lineTo(x+w,y+h*.7);brush.lineTo(x+w*.25,y+h);brush.lineTo(x-3,y+h*.5);brush.fill();
    }
    brush.strokeStyle="#69594144";brush.lineWidth=1.2;
    for(let crack=0;crack<36;crack++){
      let x=rand()*1024,y=rand()*400;brush.beginPath();brush.moveTo(x,y);
      for(let step=0;step<7;step++)brush.lineTo(x+=(rand()-.5)*20,y+=rand()*12);brush.stroke();
    }
    const grime=brush.createLinearGradient(0,310,0,512);grime.addColorStop(0,"#60554000");grime.addColorStop(1,"#60554066");brush.fillStyle=grime;brush.fillRect(0,310,1024,202);
    const wallMap=new THREE.CanvasTexture(paint);wallMap.colorSpace=THREE.SRGBColorSpace;wallMap.anisotropy=8;
    adobe=new THREE.MeshStandardMaterial({map:wallMap,roughness:.96});
    const group = new THREE.Group();
    group.rotation.y = TATOOINE_GATE;
    group.name = "mos-eisley-district";
    const colliders: Spot[] = [], movers: Spot[] = [];
    const dark = new THREE.MeshStandardMaterial({ color: 0x3b3026, roughness: .9 });
    const rust = new THREE.MeshStandardMaterial({ color: 0x9c6238, metalness: .25, roughness: .85 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x727b78, metalness: .55, roughness: .7 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0xa56e42, roughness: 1, side: THREE.DoubleSide });
    const pale = new THREE.MeshStandardMaterial({ color: 0xc5b28d, roughness: .95, side: THREE.DoubleSide });
    const amber = new THREE.MeshBasicMaterial({ color: 0xf4bd58 });
    const footprints=document.createElement("canvas");footprints.width=256;footprints.height=1024;
    const sandMarks=footprints.getContext("2d")!;sandMarks.fillStyle="#6e563927";
    for(let mark=0;mark<170;mark++){
      const x=128+Math.sin(mark*.17)*65+(mark%2?-9:9),y=mark*6;
      sandMarks.beginPath();sandMarks.ellipse(x,y,2.6,4.1,.12,0,Math.PI*2);sandMarks.fill();
    }
    const printMap=new THREE.CanvasTexture(footprints);printMap.colorSpace=THREE.SRGBColorSpace;
    const tracks=new THREE.Mesh(new THREE.PlaneGeometry(7,49),new THREE.MeshBasicMaterial({map:printMap,transparent:true,depthWrite:false}));
    tracks.rotation.x=-Math.PI/2;tracks.position.set(0,-.044,45);group.add(tracks);
    const glow = glowTexture();
    const shadowMaterial = new THREE.MeshBasicMaterial({ map: glow, color: 0x2b1b0c, transparent: true, opacity: .32, depthWrite: false });
    const shadow = (parent: THREE.Object3D, w: number, d: number, y: number) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), shadowMaterial);
        m.rotation.x = -Math.PI / 2;
        m.position.y = y;
        parent.add(m);
    };
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const matrix = new THREE.Matrix4();
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
        matrix.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
        const g = geo.index ? geo.toNonIndexed() : geo.clone();
        geo.dispose();
        g.applyMatrix4(matrix);
        const parts = batches.get(mat) ?? [];
        parts.push(g);
        batches.set(mat, parts);
    };
    const box = (mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) => add(new RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * .12), mat, x, y, z, 0, ry);
    const block = (u: number, v: number, r: number) => { const p = districtPoint(u, v); colliders.push({ x: p.x, z: p.z, r }); };
    function sign(text: string, u: number, y: number, v: number, width = 2.5) {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 128;
        const c = canvas.getContext("2d")!;
        c.fillStyle = "#574732";
        c.fillRect(0, 0, 512, 128);
        c.strokeStyle = "#ac976a";
        c.lineWidth = 5;
        c.strokeRect(6, 6, 500, 116);
        c.fillStyle = "#e2cea5";
        c.textAlign = "center";
        c.font = "bold 35px monospace";
        c.fillText(text, 256, 63);
        c.font = "13px monospace";
        c.fillText("MOS EISLEY / PORT FRANC", 256, 99);
        const map = new THREE.CanvasTexture(canvas);
        map.colorSpace = THREE.SRGBColorSpace;
        const signMaterial=new THREE.MeshStandardMaterial({map,roughness:.9});
        for(const side of[-1,1]){
          const m=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),signMaterial);
          m.position.set(u,y,v+side*.015);m.rotation.y=side<0?Math.PI:0;group.add(m);
        }
    }
    function pipeDetail(u:number,v:number,r:number,side:number){
      for(const dz of[-1.4,1.4]){add(new THREE.CylinderGeometry(.09,.09,2.6,10),metal,u-side*(r+.09),1.3,v+dz);}
      for(const y of[.25,.45])box(adobe,.18,.1,3.8,u-side*(r+.03),y,v);
      box(metal,.2,.35,.32,u-side*(r+.14),1.2,v-2);
    }
    // An open street: every shop sits outside a pedestrian and speeder corridor.
    const shops = [[-9, 28, 4.1], [9, 38, 4.1], [-10, 42, 4.3], [10, 55, 4.3], [-10, 63, 4.1], [9, 69, 3.3]];
    for (let index = 0; index < shops.length; index++) {
        if(index===4)continue;
        const [u, v, r] = shops[index], height = 3.2 + (index % 3) * .55, side = Math.sign(u);
        if(index%2){box(adobe,r*1.9,height+1,r*1.7,u,(height+1)/2,v);}
        else add(new THREE.CylinderGeometry(r,r*1.03,height,32),adobe,u,height/2,v);
        add(new THREE.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), adobe, u, height, v);
        block(u,v,r*(index%2?1.38:1.06));
        // A dark arched doorway opens toward the street, between battered plaster jambs.
        box(dark, .1, 2.1, 1.35, u - side * r, 1.05, v);
        add(new THREE.CylinderGeometry(.12, .12, 2.5, 8), rust, u - side * (r + .08), 1.25, v - .9);
        add(new THREE.CylinderGeometry(.12, .12, 2.5, 8), rust, u - side * (r + .08), 1.25, v + .9);
        const awning = new THREE.PlaneGeometry(3.2, 5.8, 3, 8);
        awning.rotateX(-Math.PI / 2);
        const positions = awning.getAttribute("position");
        for (let i = 0; i < positions.count; i++)
            positions.setY(i, Math.sin((positions.getZ(i) + 2.9) / 5.8 * Math.PI) * -.23);
        awning.computeVertexNormals();
        add(awning, index % 2 ? cloth : pale, u - side * (r + 1.1), 2.65, v);
        for (const dz of [-2.85, 2.85]) {
            const postU = u - side * (r + 2.6);
            add(new THREE.CylinderGeometry(.045, .065, 2.7, 8), metal, postU, 1.35, v + dz);
            block(postU, v + dz, .07);
        }
        box(rust, .8, .8, 2.5, u - side * (r + .6), .4, v + .2);
        block(u - side * (r + .6), v + .2, 1.2);
        for(let item=0;item<8;item++){
          const atV=v-1+item*.28,atU=u-side*(r+.6);
          if(index%2)add(new THREE.CylinderGeometry(.08,.12,.28+(item%3)*.07,12),item%2?rust:pale,atU,1.03,atV);
          else {add(new THREE.TorusGeometry(.12,.055,6,16),rust,atU,.97,atV,Math.PI/2);}
        }
        for(let shutter=0;shutter<4;shutter++)box(dark,.09,.75,.18,u-side*(r+.06),1.75,v+1.5+shutter*.2);
        pipeDetail(u,v,r,side);
        for (let rib = 0; rib < 4; rib++)
            box(metal, .12, .12, .9, u - side * r, 2.3 + rib * .2, v + 1.2);
    }
    sign("PIÈCES / RÉPARATIONS", -8.6, 2.35, 23.8, 3.2);
    sign("RÉCUPÉRATION", 9, 2.4, 33.8, 2.8);
    sign("BAIE 94  ←", 0, 2.2, 20.7, 2.6);
    box(metal, .09, 2.3, .09, -1.4, 1.15, 20.8);
    block(-1.4, 20.8, .07);
    // A few pieces of salvage and a workbench frame the Jawa trading area.
    const cargo = createCoruscantCargo();
    cargo.group.scale.setScalar(.65);
    cargo.group.position.z = 49;
    group.add(cargo.group);
    cargo.colliders.forEach(c => block(c.x * .65, 49 + c.z * .65, c.r * .65));
    box(metal, 2.1, .12, .8, -8.5, 1.02, 45.8);
    for (const u of [-9.3, -7.7])
        box(dark, .1, 1, .55, u, .5, 45.8);
    block(-8.5, 45.8, 1.1);
    for (let part = 0; part < 4; part++)
        add(new THREE.TorusGeometry(.12 + part * .035, .045, 6, 16), metal, -9 + part * .35, 1.15, 45.8, Math.PI / 2);
    // An unmistakable sandcrawler silhouette rests farther out in the desert.
    box(rust, 7.5, 5.8, 12, -21, 4.1, 100);
    box(rust, 6.9, 1.9, 9.5, -21, 7.3, 100);
    box(dark, 7.55, .45, 3.4, -21, 6.5, 94.1);
    for (const side of [-1, 1]) {
        box(dark, 1.45, 2.3, 13, -21 + side * 3.6, 1.25, 100);
        for (let wheel = 0; wheel < 7; wheel++)
            add(new THREE.CylinderGeometry(.78, .78, .2, 12), rust, -21 + side * 4.36, 1.2, 94.8 + wheel * 1.7, 0, 0, Math.PI / 2);
        for (let seam = 0; seam < 8; seam++)
            box(dark, .035, 4.8, .045, -21 + side * 3.77, 4.1, 95.3 + seam * 1.3);
        box(amber, .25, .18, .05, -21 + side * 2.4, 4.8, 94.08);
    }
    const actors: {
        group: THREE.Group;
        arms: THREE.Group[];
        legs: THREE.Group[];
        u: number;
        v: number;
        range: number;
        phase: number;
        jawa: boolean;
        collider: Spot;
    }[] = [];
    function character(jawa: boolean, u: number, v: number, range: number, phase: number) {
        const g = new THREE.Group();
        const body = new THREE.MeshStandardMaterial({ color: jawa ? 0x62432c : [0xa99471, 0x7c7056, 0xb59c79][Math.floor(phase) % 3], roughness: 1 });
        const headMat = new THREE.MeshStandardMaterial({ color: jawa ? 0x141411 : 0xa57e5b, roughness: .95 });
        const piece = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g) => { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); parent.add(m); return m; };
        const h = jawa ? .72 : 1.32;
        piece(new THREE.CylinderGeometry(jawa ? .21 : .23, jawa ? .37 : .34, h, 12), body, 0, h / 2 + .08, 0);
        piece(new THREE.SphereGeometry(jawa ? .24 : .19, 12, 8), body, 0, h + .17, 0);
        piece(new THREE.SphereGeometry(jawa ? .17 : .145, 10, 8), headMat, 0, h + .16, .13);
        if (jawa)
            for (const x of [-.055, .055])
                piece(new THREE.SphereGeometry(.022, 6, 4), amber, x, h + .18, .28);
        else{
          const collar=piece(new THREE.TorusGeometry(.16,.045,6,16),body,0,h+.015,0);collar.rotation.x=Math.PI/2;
          for(const x of[-.052,.052])piece(new THREE.SphereGeometry(.014,6,4),dark,x,h+.19,.265);
          piece(new THREE.SphereGeometry(.03,8,6),headMat,0,h+.13,.279);
        }
        const arms: THREE.Group[] = [], legs: THREE.Group[] = [];
        for (const side of [-1, 1]) {
            const a = new THREE.Group();
            a.position.set(side * .25, h * .8, 0);
            g.add(a);
            arms.push(a);
            piece(new THREE.CylinderGeometry(.09, .12, jawa ? .32 : .52, 8), body, side * .04, -.17, 0, a);
            piece(new THREE.SphereGeometry(.065, 8, 6), headMat, side * .04, jawa ? -.31 : -.42, .02, a);
            const leg = new THREE.Group();
            leg.position.set(side * .13, .24, 0);
            g.add(leg);
            legs.push(leg);
            piece(new THREE.BoxGeometry(.16, .15, .29), dark, 0, -.13, .04, leg);
        }
        const p = districtPoint(u, v), collider = { x: p.x, z: p.z, r: jawa ? .32 : .39 };
        movers.push(collider);
        shadow(g, jawa ? .9 : 1.1, .7, .012);
        actors.push({ group: g, arms, legs, u, v, range, phase, jawa, collider });
        group.add(g);
        g.position.set(u, -.06, v);
    }
    character(true, -10.9, 46.4, .65, 2.4);
    character(false, 2.7, 31, 4, 1);
    character(false, -2.8, 38, 3, 3);
    character(false, 2.8, 59, 4, 5);
    character(false, -4.5, 26, 0, 2);
    character(false,-2.8,52,2,1.5);
    character(false,3.2,66,2.2,3.5);
    character(false,-3.4,35,.6,5.5);
    // Two landspeeders use a separate lane on the right and stop for a visitor in front.
    const speeders: {
        group: THREE.Group;
        v: number;
        direction: number;
        delay: number;
        colliders: Spot[];
    }[] = [];
    for (let i = 0; i < 2; i++) {
        const s = new THREE.Group();
        s.name = "mos-eisley-speeder";
        shadow(s,3,4.5,-.04);
        s.add(createLandspeeder(i?0x7f8273:0xa2633c));
        // Two circles along the hull keep the visitor out of its nose and tail, not just its middle.
        const colliders = [-1, 1].map(() => ({ x: 0, z: 0, r: 1.3 }));
        movers.push(...colliders);
        speeders.push({ group: s, v: 75 + i * 12, direction: -1, delay: i * 17, colliders });
        group.add(s);
    }
    const dust = Array.from({ length: 16 }, () => {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xcfb38e, transparent: true, opacity: 0, depthWrite: false }));
        sprite.visible = false;
        group.add(sprite);
        return { sprite, age: 2 };
    });
    // R2-D2 and C-3PO cross the distant dune thirty seconds after the visit begins.
    const pair = new THREE.Group();
    pair.name = "dune-droids";
    pair.visible = false;
    group.add(pair);
    const heroes=createHeroDroids(),{r2,c3}=heroes;
    c3.position.set(1.2,0,-.4);pair.add(r2,c3);shadow(r2,1.1,.7,.012);shadow(c3,.9,.7,.012);
    const cantina=createTatooineCantina(adobe);group.add(cantina.group);
    cantina.circles.forEach(c=>block(c.u,c.v,c.r));
    const bartender={x:0,z:0,r:cantina.bartender.r};movers.push(bartender);
    // Haggling Jawas, the checkpoint, a lizard patrol and a herd out on the dunes.
    const life=createStreetLife((u,v)=>{const p=districtPoint(u,v);return groundHeight(p.x,p.z);});group.add(life.group);
    life.colliders.forEach(c=>block(c.u,c.v,c.r));
    const map=createDistrictMap(shops.filter((_,i)=>i!==4),{u:-3.3,v:21.8,facing:Math.PI-.5});group.add(map.group);
    block(map.collider.u,map.collider.v,map.collider.r);
    const scenery=createTatooineScenery(adobe);group.add(scenery.group);
    scenery.colliders.forEach(c=>block(c.u,c.v,c.r));
    const troopSpots=scenery.movers.map(c=>{const p=districtPoint(c.u,c.v);return {x:p.x,z:p.z,r:c.r};});
    movers.push(...troopSpots);
    // Static decorations are baked into a handful of material batches.
    batches.forEach((parts, material) => { const geometry = mergeGeometries(parts, false); parts.forEach(p => p.dispose()); if (geometry)
        group.add(new THREE.Mesh(geometry, material)); });
    let clock = 0;
    return { group, colliders, movers, explorePoint:districtPoint(0,34),
        interior:{name:"CANTINA",entry:districtPoint(cantina.entry.u,cantina.entry.v),exit:districtPoint(cantina.exit.u,cantina.exit.v),contains:(x:number,z:number)=>{const p=districtCoordinates(x,z);return cantina.contains(p.u,p.v);}},
        isBlocked:(x:number,z:number)=>{const p=districtCoordinates(x,z);return cantina.isBlocked(p.u,p.v);},
        constrain:(walker:{x:number;z:number})=>{const p=districtCoordinates(walker.x,walker.z);cantina.constrain(p);const w=districtPoint(p.u,p.v);walker.x=w.x;walker.z=w.z;},
        // The band can be heard from the street, muffled and fading with distance from the porch.
        music:(walker:{x:number;z:number})=>{
          const p=districtCoordinates(walker.x,walker.z);
          if(cantina.contains(p.u,p.v))return{level:1,inside:true};
          return{level:Math.max(0,1-Math.hypot(p.u+3.2,p.v-62)/28)**1.6*.6,inside:false};
        },
        tick(dt: number, reduced: boolean, walker: {
            x: number;
            z: number;
        }) {
            if (!dt)
                return;
            clock += dt;
            const move = reduced ? 0 : dt;
            const local = districtCoordinates(walker.x, walker.z);
            cantina.tick(clock,reduced);scenery.tick(dt,clock,reduced,local);
            life.tick(clock,dt,reduced);map.tick(clock,reduced,local);
            const bar=districtPoint(cantina.bartender.u,cantina.bartender.v);bartender.x=bar.x;bartender.z=bar.z;
            scenery.movers.forEach((c,i)=>{const p=districtPoint(c.u,c.v);troopSpots[i].x=p.x;troopSpots[i].z=p.z;});
            actors.forEach((a, index) => {
                const targetV = a.v + Math.sin(clock * .22 + a.phase) * a.range;
                const near = Math.hypot(local.u - a.group.position.x, local.v - a.group.position.z) < 1.35;
                if (!reduced && !near)
                    a.group.position.z = targetV;
                const facing = near || !a.range ? Math.atan2(local.u - a.group.position.x, local.v - a.group.position.z) : (Math.cos(clock * .22 + a.phase) > 0 ? 0 : Math.PI);
                const gap = Math.atan2(Math.sin(facing - a.group.rotation.y), Math.cos(facing - a.group.rotation.y));
                if (!reduced)
                    a.group.rotation.y += gap * (1 - Math.exp(-dt * 3));
                a.arms.forEach((arm, i) => arm.rotation.x = reduced ? 0 : Math.sin(clock * (near ? 1.5 : 3.2) + index + i * Math.PI) * (a.range && !near ? .22 : .09));
                a.legs.forEach((leg, i) => leg.rotation.x = reduced || near || !a.range ? 0 : Math.sin(clock * 3.2 + i * Math.PI) * .16);
                const p = districtPoint(a.group.position.x, a.group.position.z);
                a.collider.x = p.x;
                a.collider.z = p.z;
            });
            speeders.forEach((s, index) => {
                const ahead = (local.v - s.v) * s.direction;
                const stopped = Math.abs(local.u) < 2.3 && ahead > 0 && ahead < 7;
                if (move && clock > s.delay && !stopped) {
                    s.v += s.direction * move * 2.5;
                    if (Math.floor(clock * 6) !== Math.floor((clock - dt) * 6)) {
                        const mote = dust.find(p => p.age >= 1.7);
                        if (mote) {
                            mote.age = 0;
                            mote.sprite.position.set(Math.sin(clock * 31) * .5, .18, s.v - s.direction * 1.7);
                        }
                    }
                }
                if (s.v < 23) {
                    s.v = 88;
                    s.delay = clock + 16 + index * 8;
                }
                s.group.position.set(0, .025 * Math.sin(clock * 2 + index), s.v);
                s.group.rotation.y = s.direction < 0 ? Math.PI : 0;
                s.colliders.forEach((collider, end) => {
                    const p = districtPoint(0, s.v + (end ? 1.05 : -1.05));
                    collider.x = p.x;
                    collider.z = p.z;
                });
            });
            dust.forEach(p => {
                p.age += move;
                p.sprite.visible = !reduced && p.age < 1.7;
                if (!p.sprite.visible)
                    return;
                p.sprite.material.opacity = .11 * (1 - p.age / 1.7);
                p.sprite.scale.setScalar(.6 + p.age * .65);
                p.sprite.position.x += move * .3;
                p.sprite.position.y += move * .12;
            });
            const age = clock - 30;
            pair.visible = !reduced && age >= 0 && age < 34;
            if (pair.visible) {
                const u = -7 + age * .7, v = 80;
                const p = districtPoint(u, v);
                pair.position.set(u, groundHeight(p.x, p.z), v);
                pair.rotation.y = Math.PI / 2;
                heroes.tick(age,reduced);
            }
        }
    };
}
