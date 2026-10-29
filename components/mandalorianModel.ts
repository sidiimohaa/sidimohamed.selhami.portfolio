import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { bakePart, part, pipe } from "./tatooineCharacters";

type XYZ = [number, number, number];

function plate(parent: THREE.Group, outline: [number, number][], depth: number, material: THREE.Material, at: XYZ, bevel = .004) {
  const shape = new THREE.Shape();
  outline.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
  return part(parent, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1 }), material, at);
}

/** A flat-shaded front panel whose facets catch the room's reflections independently. */
function facets(parent: THREE.Group, points: XYZ[], faces: number[][], material: THREE.Material) {
  const positions: number[] = [], uv: number[] = [];
  for (const face of faces) for (let i = 1; i < face.length - 1; i++) {
    let [a, b, c] = [points[face[0]], points[face[i]], points[face[i + 1]]];
    const normal = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).cross(new THREE.Vector3(...c).sub(new THREE.Vector3(...a)));
    if (normal.z < 0) [b, c] = [c, b];
    for (const p of [a, b, c]) { positions.push(...p); uv.push(.5 + p[0] * 2, .5 + p[1] * 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return part(parent, g, material);
}

/** Din's quiet booth pose. The origin is the floor, the character faces +Z. */
export function createSeatedMandalorian(seatHeight = .55) {
  const group = new THREE.Group(); group.name = "cantina-mandalorian";
  const beskar = new THREE.MeshStandardMaterial({ color: 0xaebbc3, metalness: .91, roughness: .28 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x606b72, metalness: .78, roughness: .4 });
  const visor = new THREE.MeshStandardMaterial({ color: 0x080e12, metalness: .28, roughness: .16 });
  const suit = new THREE.MeshStandardMaterial({ color: 0x2d2826, roughness: .93 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x4e3527, roughness: .83 });
  const gloves = new THREE.MeshStandardMaterial({ color: 0x715638, roughness: .88 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x3c3631, roughness: 1, side: THREE.DoubleSide });
  const box = (p: THREE.Group, w: number, h: number, d: number, mat: THREE.Material, pos: XYZ, r = .008) =>
    part(p, new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 3, h / 3, d / 3)), mat, pos);
  const rod = (p: THREE.Group, a: XYZ, b: XYZ, ra: number, rb: number, mat: THREE.Material) => {
    const from = new THREE.Vector3(...a), span = new THREE.Vector3(...b).sub(from);
    const m = part(p, new THREE.CylinderGeometry(rb, ra, span.length(), 14), mat);
    m.position.copy(from).addScaledVector(span, .5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), span.normalize()); return m;
  };
  const hip = seatHeight + .065, shoulder = seatHeight + .565, chestY = seatHeight + .395;
  const body = new THREE.Group(); group.add(body);
  box(body, .31, .14, .24, suit, [0, hip, .005], .035);
  box(body, .345, .44, .22, suit, [0, hip + .265, -.012], .055);
  // Two shaped pectoral plates, separated by the small central diamond.
  for (const side of [-1, 1]) {
    const p: [number, number][] = [[side * .177, .125], [side * .029, .108], [side * .019, .025], [side * .052, -.065], [side * .142, -.08], [side * .184, .025]];
    const chest = plate(body, p, .024, beskar, [0, chestY, .11], .007); chest.rotation.y = side * -.05;
    box(body, .065, .072, .025, steel, [side * .142, chestY + .073, .139], .004);
  }
  plate(body, [[0,.031],[.019,0],[0,-.031],[-.019,0]], .014, beskar, [0,chestY+.019,.142], .003);
  for (let row = 0; row < 3; row++) {
    const w = .28 - row * .017;
    plate(body, [[-w/2,.024],[w/2,.024],[w*.42,-.026],[-w*.42,-.026]], .023, steel, [0,hip+.185-row*.063,.107], .005);
  }
  // Leather utility belt and a diagonal cartridge bandolier.
  box(body, .352, .061, .255, leather, [0, hip + .083, .005], .012);
  box(body, .066, .047, .022, beskar, [0, hip + .083, .144], .003);
  for (const x of [-.125, .115]) box(body, .059, .09, .045, leather, [x, hip + .055, .142], .008);
  const strap = box(body, .044, .523, .017, leather, [.005, hip + .31, .166], .005); strap.rotation.z = -.64;
  for (let i = 0; i < 5; i++) {
    const x = -.1 + i * .045, y = hip + .183 + i * .061;
    const cartridge = box(body,.029,.06,.025,steel,[x,y,.186],.003);cartridge.rotation.z=-.64;
    box(body,.035,.009,.029,beskar,[x,y+.019,.189],.002);
  }
  rod(body,[0,shoulder+.001,0],[0,shoulder+.09,0],.063,.06,suit);
  // The short cape is kept forward of the booth's backrest.
  const cape = new THREE.PlaneGeometry(.39,.51,8,10), cp = cape.getAttribute("position");
  for(let i=0;i<cp.count;i++){
    const x=cp.getX(i),y=cp.getY(i);
    cp.setXYZ(i,x*(1+( .255-y)*.14),y+(y<-.23?Math.sin(x*36)*.011:0),-.016*Math.cos(x*37)-.009*Math.sin(y*18));
  }
  cape.computeVertexNormals();part(body,cape,cloth,[-.017,hip+.285,-.18]);
  pipe(body,[[-.17,shoulder-.012,-.08],[-.07,shoulder+.028,-.11],[.06,shoulder+.025,-.1]],.035,cloth);
  // Seated thighs lead forward to plated knees; the lower legs drop to the floor.
  for (const side of [-1, 1]) {
    const x = side * .113, kneeZ = .345;
    rod(body,[x,hip,.02],[side*.14,hip-.018,kneeZ],.083,.076,suit);
    box(body,.123,.032,.245,beskar,[side*.13,hip+.065,.188],.015);
    part(body,new THREE.SphereGeometry(.079,16,10),suit,[side*.14,hip-.025,kneeZ]);
    plate(body,[[-.058,.042],[.05,.045],[.068,-.027],[0,-.052],[-.067,-.025]],.024,beskar,[side*.14,hip-.014,kneeZ+.073],.005);
    rod(body,[side*.14,hip-.06,kneeZ],[side*.146,.115,kneeZ+.012],.065,.055,suit);
    box(body,.094,Math.max(.19,hip-.23),.034,steel,[side*.146,(hip+.12)/2,kneeZ+.06],.013);
    box(body,.139,.094,.247,leather,[side*.146,.056,kneeZ+.068],.018);
    box(body,.145,.018,.255,suit,[side*.146,.013,kneeZ+.069],.004);
    // Small holster on the right hip; no weapon is being handled in the cantina.
    if(side===1){const holster=box(body,.058,.21,.09,leather,[.194,hip-.035,.095],.01);holster.rotation.x=-.2;box(body,.031,.045,.06,steel,[.194,hip+.086,.081],.005);}
    const arm = new THREE.Group(); arm.position.set(side*.214,shoulder-.014,0); body.add(arm);
    part(arm,new THREE.SphereGeometry(.072,16,12),suit,[0,-.015,0]);
    part(arm,new THREE.SphereGeometry(.08,20,12,0,Math.PI*2,0,1.95),beskar,[side*.005,.005,.008]).scale.set(1,1.18,.97);
    rod(arm,[0,-.057,0],[side*.016,-.227,.04],.056,.049,suit);
    part(arm,new THREE.SphereGeometry(.046,12,8),suit,[side*.016,-.245,.046]);
    const hand:XYZ=[-side*.025,-.365,.31];
    rod(arm,[side*.015,-.26,.065],hand,.05,.039,suit);
    const gauntlet=rod(arm,[side*.009,-.278,.098],[-side*.014,-.345,.253],.058,.047,beskar);
    gauntlet.scale.x=1.02;
    box(arm,.056,.028,.103,steel,[-side*.012,-.292,.174],.006);
    for(let i=0;i<3;i++)box(arm,.009,.009,.043,beskar,[-.018+i*.017,-.275,.181],.002);
    part(arm,new THREE.SphereGeometry(.042,14,10),leather,hand).scale.set(.95,.72,1.22);
    for(let finger=0;finger<3;finger++)box(arm,.013,.02,.038,gloves,[-side*.025-.02+finger*.02,-.375,.34],.004);
  }
  bakePart(body);

  const head = new THREE.Group(); head.name = "mandalorian-helmet"; head.position.set(0,seatHeight+.755,.006); group.add(head);
  // Domed crown, rear skirt and the narrow continuous T-shaped black visor.
  part(head,new THREE.SphereGeometry(.149,32,18,0,Math.PI*2,0,Math.PI/2),beskar,[0,.024,-.013]).scale.z=.97;
  const skirt=part(head,new THREE.CylinderGeometry(.149,.151,.17,32),beskar,[0,-.061,-.013]);skirt.scale.z=.94;
  plate(head,[[-.144,.025],[.144,.025],[.144,-.002],[.016,-.002],[.016,-.155],[-.016,-.155],[-.016,-.002],[-.144,-.002]],.008,visor,[0,0,.144],.0015);
  for(const side of[-1,1]){
    facets(head,[[side*.026,-.008,.165],[side*.14,-.008,.137],[side*.149,-.112,.104],[side*.104,-.158,.128],[side*.028,-.158,.176],[side*.061,-.057,.169]],[[0,1,2,5],[2,3,4,5],[0,5,4]],beskar);
    pipe(head,[[side*.14,-.02,.11],[side*.144,-.08,.1],[side*.128,-.138,.108]],.008,steel);
    part(head,new THREE.CylinderGeometry(.035,.035,.023,18),steel,[side*.155,-.012,-.016],[0,0,Math.PI/2]);
    box(head,.013,.112,.024,beskar,[side*.161,-.075,.029],.003);
    for(let i=0;i<3;i++)box(head,.015,.008,.017,visor,[side*.151,-.05-i*.018,-.04],.001);
  }
  // Raised central ridge curves over the polished crown.
  pipe(head,[[0,.171,-.012],[0,.153,.065],[0,.102,.118],[0,.045,.139]],.008,steel);
  bakePart(head);
  return {group,head,tick:(time:number,reduced:boolean)=>{
    const t=reduced?0:time;
    head.rotation.y=.105+(reduced?0:Math.sin(t*.29)*.035);
    head.rotation.x=-.022+(reduced?0:Math.sin(t*.21)*.008);
  }};
}
