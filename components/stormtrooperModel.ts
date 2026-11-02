import * as THREE from "three";
import { bakePart, part, pipe, rounded } from "./tatooineCharacters";

type XYZ = [number, number, number];

function armorFinish() {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#f5f3ec"; c.fillRect(0, 0, 256, 256);
  let seed = 1977;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  // Fine sandy wear leaves the characteristic white armor readable at a distance.
  for (let i = 0; i < 500; i++) {
    c.fillStyle = i % 3 ? "#a3906d0b" : "#69675e17";
    c.fillRect(rand() * 256, rand() * 256, .4 + rand() * 1.2, .5 + rand() * 3);
  }
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  return map;
}

function plate(parent: THREE.Group, outline: [number, number][], depth: number, mat: THREE.Material, position: XYZ, bevel = .004) {
  const shape = new THREE.Shape(); outline.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
  return part(parent, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1 }), mat, position);
}

/** A shaped breastplate, including its curved collar and raised central chest. */
function chestShell(front: boolean) {
  const positions: number[] = [], indices: number[] = [], uvs: number[] = [];
  const across = 20, rows = 10, sign = front ? 1 : -1;
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= across; i++) {
    const u = i / across * 2 - 1, v = j / rows;
    const bottom = 1.055 + .045 * Math.abs(u), top = 1.405 - .055 * Math.pow(1 - Math.abs(u), 2);
    const width = .193 + .039 * Math.sin(v * Math.PI * .9);
    positions.push(u * width, bottom + (top - bottom) * v, sign * (.074 + .079 * Math.sqrt(Math.max(0, 1 - u * u)) + .028 * Math.sin(v * Math.PI)));
    uvs.push((u + 1) / 2, v);
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < across; i++) {
    const a = j * (across + 1) + i, b = a + 1, d = a + across + 1, e = d + 1;
    indices.push(...(front ? [a, b, d, b, e, d] : [a, d, b, b, d, e]));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
}

export function createSandtrooper(officer = false) {
  const group = new THREE.Group(); group.name = officer ? "sandtrooper-officer" : "sandtrooper";
  const armor = new THREE.MeshStandardMaterial({ color: 0xf2efe5, map: armorFinish(), roughness: .36, metalness: .06, side: THREE.DoubleSide });
  const black = new THREE.MeshStandardMaterial({ color: 0x12171a, roughness: .82 });
  const lens = new THREE.MeshStandardMaterial({ color: 0x080f12, roughness: .18, metalness: .18 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x697272, roughness: .57, metalness: .48 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x374952, roughness: .6 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xc47531, roughness: .77, side: THREE.DoubleSide });
  const box = (p: THREE.Group, w: number, h: number, d: number, mat: THREE.Material, at: XYZ, radius = .007) => part(p, rounded(w, h, d, radius), mat, at);
  const link = (p: THREE.Group, a: XYZ, b: XYZ, r1: number, r2: number, mat: THREE.Material) => {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
    const m = part(p, new THREE.CylinderGeometry(r2, r1, from.distanceTo(to), 16), mat);
    m.position.copy(from).add(to).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize()); return m;
  };

  const body = new THREE.Group(); group.add(body);
  box(body, .36, .42, .21, black, [0, 1.205, 0], .075);
  part(body, chestShell(true), armor); part(body, chestShell(false), armor);
  for (const side of [-1, 1]) {
    box(body, .069, .045, .19, armor, [side * .15, 1.405, -.005], .013);
    for (let rib = 0; rib < 4; rib++) box(body, .071, .009, .13, metal, [side * .15, 1.429, -.05 + rib * .033], .002);
  }
  part(body, new THREE.CylinderGeometry(.075, .08, .1, 20), black, [0, 1.44, 0]);
  for (let i = 0; i < 4; i++) part(body, new THREE.TorusGeometry(.077, .004, 5, 20), black, [0, 1.41 + i * .018, 0], [Math.PI / 2, 0, 0]);
  const abdomen = part(body, new THREE.CylinderGeometry(.167, .159, .24, 24), armor, [0, .975, 0]); abdomen.scale.z = .76;
  box(body, .16, .205, .035, armor, [0, .99, .133], .009);
  for (const side of [-1, 1]) {
    box(body, .012, .19, .02, metal, [side * .081, .985, .153], .002);
    for (let i = 0; i < 5; i++) part(body, new THREE.SphereGeometry(.006, 8, 6), i % 3 ? blue : metal, [side * .043, .94 + i * .025, .158]);
  }
  for (let i = 0; i < 6; i++) box(body, .025, .006, .011, metal, [0, .947 + i * .018, .158], .001);
  box(body, .32, .19, .2, black, [0, .795, -.005], .04);
  box(body, .415, .061, .26, armor, [0, .874, 0], .014);
  for (let i = 0; i < 6; i++) box(body, .047, .08, .039, armor, [-.156 + i * .0625, .864, .144], .006);
  for (const side of [-1, 1]) box(body, .055, .12, .08, armor, [side * .2, .836, .015], .007);
  plate(body, [[-.145, .827], [.145, .827], [.125, .755], [.058, .678], [-.058, .678], [-.125, .755]], .035, armor, [0, 0, .092], .008);
  part(body, new THREE.CylinderGeometry(.032, .032, .2, 16), metal, [0, .864, -.151], [0, 0, Math.PI / 2]);
  for (const side of [-1, 1]) part(body, new THREE.CylinderGeometry(.036, .036, .04, 16), armor, [side * .115, .864, -.151], [0, 0, Math.PI / 2]);
  // Desert field pack: frame, filter canisters, radio and bedroll.
  box(body, .305, .355, .13, black, [0, 1.2, -.213], .018);
  for (const side of [-1, 1]) {
    box(body, .025, .38, .025, metal, [side * .145, 1.2, -.29], .004);
    part(body, new THREE.CylinderGeometry(.05, .05, .17, 16), side === 1 ? armor : metal, [side * .104, 1.11, -.314]);
  }
  box(body, .14, .15, .05, blue, [-.037, 1.25, -.308], .008);
  for (let i = 0; i < 5; i++) box(body, .105, .008, .01, black, [-.037, 1.205 + i * .022, -.338], .001);
  part(body, new THREE.CylinderGeometry(.042, .042, .3, 16), metal, [0, 1.414, -.25], [0, 0, Math.PI / 2]);
  for (const x of [-.1, .1]) box(body, .012, .086, .08, black, [x, 1.414, -.25], .004);
  if (officer) {
    const p: number[] = [], uv: number[] = [], indices: number[] = [], trim: XYZ[] = [];
    for (let row = 0; row <= 6; row++) for (let col = 0; col <= 16; col++) {
      const u = col / 16, v = row / 6;
      const x = -.398 + .29 * u, y = 1.385 + .115 * Math.sin(u * Math.PI * .9) + .02 * (1 - Math.pow(v * 2 - 1, 2)), z = -.13 + .275 * v;
      p.push(x, y, z); uv.push(u, v);
      if (row === 6) trim.push([x, y, z]);
      if (row < 6 && col < 16) { const a = row * 17 + col; indices.push(a, a + 17, a + 1, a + 1, a + 17, a + 18); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals();
    part(body, g, orange); pipe(body, trim, .007, black);
  }
  bakePart(body);

  const head = new THREE.Group(); head.name = "stormtrooper-helmet"; head.position.y = 1.625; group.add(head);
  part(head, new THREE.SphereGeometry(.177, 32, 20), armor, [0, .01, -.014]).scale.set(1, 1.04, .91);
  part(head, new THREE.SphereGeometry(.176, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), armor, [0, .025, -.014]).scale.set(1.015, 1, .96);
  part(head, new THREE.TorusGeometry(.175, .009, 6, 40), black, [0, .025, -.014], [Math.PI / 2, 0, 0]).scale.z = .96;
  box(head, .302, .018, .019, black, [0, .026, .157], .005);
  for (const side of [-1, 1]) {
    // Separate angular eye sockets retain the original trilogy helmet silhouette.
    plate(head, [[side * .025, .012], [side * .142, .024], [side * .136, -.016], [side * .11, -.031], [side * .062, -.011]], .007, lens, [0, 0, .163], .004);
    plate(head, [[side * .025, -.014], [side * .057, -.029], [side * .113, -.054], [side * .166, -.035], [side * .162, -.064], [side * .112, -.077], [side * .051, -.044]], .012, armor, [0, 0, .16], .004);
    part(head, new THREE.CylinderGeometry(.045, .048, .027, 20), armor, [side * .182, -.017, -.008], [0, 0, Math.PI / 2]);
    part(head, new THREE.CylinderGeometry(.025, .025, .03, 16), metal, [side * .197, -.017, -.008], [0, 0, Math.PI / 2]);
    // Flared cheek tubes sweep forward to the two round aerators.
    pipe(head, [[side * .15, -.067, .07], [side * .168, -.105, .099], [side * .142, -.145, .154], [side * .079, -.15, .203]], .035, armor);
    for (let i = 0; i < 7; i++) part(head, new THREE.BoxGeometry(.005, .024, .006), blue, [side * (.147 - i * .006), -.083 - i * .005, .163 + i * .005], [0, side * .45, side * .42]);
    part(head, new THREE.TorusGeometry(.022, .006, 8, 18), armor, [side * .077, -.153, .226]);
    part(head, new THREE.CircleGeometry(.0175, 18), metal, [side * .077, -.153, .228]);
    part(head, new THREE.CircleGeometry(.009, 12), black, [side * .077, -.153, .229]);
  }
  // Raised nose bridge and frown grille: small gaps between pale teeth, not a T visor.
  const nose = new THREE.BufferGeometry();
  nose.setAttribute("position", new THREE.Float32BufferAttribute([-.022,.028,.165, .022,.028,.165, 0,-.047,.235, -.022,.028,.165, 0,-.047,.235, -.065,-.071,.195, .022,.028,.165, .065,-.071,.195, 0,-.047,.235],3)); nose.computeVertexNormals();
  const noseUV: number[] = [], nosePosition = nose.getAttribute("position");
  for (let i = 0; i < nosePosition.count; i++) noseUV.push(.5 + nosePosition.getX(i) * 3, .5 + nosePosition.getY(i) * 3);
  nose.setAttribute("uv", new THREE.Float32BufferAttribute(noseUV, 2));
  part(head, nose, armor);
  pipe(head, [[-.116,-.1,.186],[-.071,-.073,.215],[0,-.052,.237],[.071,-.073,.215],[.116,-.1,.186]], .01, black);
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const x=side*(.027+i*.023); box(head,.008,.017,.014,armor,[x,-.059-i*.012,.238-i*.013],.001);
  }
  plate(head,[[-.118,-.11],[-.058,-.078],[0,-.071],[.058,-.078],[.118,-.11],[.096,-.157],[.035,-.174],[-.035,-.174],[-.096,-.157]],.022,armor,[0,0,.19],.006);
  for (let i = 0; i < 7; i++) box(head,.006,.057-Math.abs(i-3)*.004,.014,black,[-.024+i*.008,-.143,.234],.003);
  bakePart(head);

  const legs: THREE.Group[] = [], knees: THREE.Group[] = [], arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(side * .116, .778, 0); group.add(leg); legs.push(leg);
    part(leg, new THREE.CylinderGeometry(.082,.07,.32,20),black,[0,-.17,0]);
    const thigh=part(leg,new THREE.CylinderGeometry(.092,.075,.29,24),armor,[0,-.172,0]); thigh.scale.z=1.12;
    box(leg,.012,.26,.018,armor,[side*.086,-.174,.028],.003);
    bakePart(leg);
    const knee=new THREE.Group(); knee.position.y=-.354; leg.add(knee); knees.push(knee);
    part(knee,new THREE.SphereGeometry(.064,16,10),black,[0,0,0]);
    if(side===-1)plate(knee,[[-.062,.034],[0,.066],[.063,.034],[.046,-.022],[-.043,-.026]],.025,armor,[0,0,.061],.004);
    else for(let i=0;i<5;i++)box(knee,.023,.036,.023,armor,[-.056+i*.028,.012,.075],.003);
    const shin=part(knee,new THREE.CylinderGeometry(.074,.057,.308,24),armor,[0,-.19,.013]); shin.scale.z=1.18;
    box(knee,.014,.27,.016,armor,[0,-.194,.096],.003);
    box(knee,.133,.076,.235,armor,[0,-.369,.067],.025);
    box(knee,.137,.016,.244,black,[0,-.414,.069],.005);
    bakePart(knee);
    const arm = new THREE.Group(); arm.position.set(side*.276,1.343,0);group.add(arm);arms.push(arm);
    part(arm,new THREE.SphereGeometry(.081,16,12),black,[0,-.023,0]);
    part(arm,new THREE.SphereGeometry(.113,24,14,0,Math.PI*2,0,2.08),armor,[0,.015,0]).scale.set(1,1.25,.96);
    link(arm,[0,-.077,0],[-side*.025,-.255,.022],.071,.063,armor);
    part(arm,new THREE.SphereGeometry(.051,16,10),black,[-side*.025,-.272,.022]);
    link(arm,[-side*.035,-.29,.044],[-side*.136,-.361,.217],.064,.047,armor);
    part(arm,new THREE.SphereGeometry(.047,16,10),black,[-side*.147,-.373,.245]).scale.set(.92,1,1.15);
    box(arm,.054,.018,.059,armor,[-side*.147,-.341,.256],.008);
    bakePart(arm);
  }
  const blaster=new THREE.Group();blaster.name="e11-blaster";
  part(blaster,new THREE.CylinderGeometry(.021,.021,.43,16),black,[-.067,1.018,.3],[0,0,Math.PI/2]);
  box(blaster,.2,.064,.066,black,[.09,1.018,.3],.006);
  box(blaster,.035,.088,.035,black,[.11,.966,.3],.004);
  box(blaster,.08,.045,.071,metal,[.013,1.015,.276],.003);
  link(blaster,[-.08,1.077,.3],[.055,1.077,.3],.015,.019,black);
  box(blaster,.1,.021,.03,metal,[-.01,1.052,.3],.003);
  for(let i=0;i<6;i++)part(blaster,new THREE.TorusGeometry(.023,.004,6,12),metal,[-.24+i*.035,1.018,.3],[0,Math.PI/2,0]);
  box(blaster,.12,.035,.043,black,[.248,1.013,.3],.004);
  bakePart(blaster);group.add(blaster);
  // Existing street scenes can still pose each whole arm/leg for scanning and riding.
  return {group,head,arms,legs,knees,blaster,tick:(time:number,walking:boolean,reduced:boolean)=>{
    const moving=walking&&!reduced, t=reduced?0:time;
    head.rotation.y=reduced?0:Math.sin(t*.45)*.16;
    legs.forEach((leg,i)=>{const stride=t*3.1+i*Math.PI;leg.rotation.x=moving?Math.sin(stride)*.22:0;knees[i].rotation.x=moving?.04+Math.max(0,Math.cos(stride))*.3:.025;});
    arms.forEach((arm,i)=>arm.rotation.x=-.15+(moving?Math.sin(t*3.1+i*Math.PI)*.035:0));
  }};
}
