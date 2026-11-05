import * as THREE from "three";
import { bakePart, part, pipe, rounded } from "./tatooineCharacters";

type XYZ = [number, number, number];

/** Classic cream shirt and pocketed vest, seated at a cantina table and facing +Z. */
export function createSeatedHanSolo(seatHeight = .55) {
  const group = new THREE.Group(); group.name = "cantina-han-solo"; group.userData.character = true;
  const shirt = new THREE.MeshStandardMaterial({ color: 0xe5d6af, roughness: .92 });
  const seam = new THREE.MeshStandardMaterial({ color: 0xb7a787, roughness: 1 });
  const vest = new THREE.MeshStandardMaterial({ color: 0x242724, roughness: .88 });
  const trousers = new THREE.MeshStandardMaterial({ color: 0x263242, roughness: .93 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0x8d3f2f, roughness: .88 });
  const boots = new THREE.MeshStandardMaterial({ color: 0x1f2220, roughness: .48 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x62412c, roughness: .78 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb8b9aa, roughness: .35, metalness: .8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xcfa789, roughness: .69 });
  const lip = new THREE.MeshStandardMaterial({ color: 0x9b6d56, roughness: .87 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x443124, roughness: .9 });
  const hairLight = new THREE.MeshStandardMaterial({ color: 0x604631, roughness: .88 });
  const white = new THREE.MeshStandardMaterial({ color: 0xd7cdb9, roughness: .65 });
  const box = (g: THREE.Group, at: XYZ, size: XYZ, mat: THREE.Material, r = .008) => part(g, rounded(...size, r), mat, at);
  const ball = (g: THREE.Group, at: XYZ, scale: XYZ, mat: THREE.Material) => {
    const mesh = part(g, new THREE.SphereGeometry(1, 18, 12), mat, at); mesh.scale.set(...scale); return mesh;
  };
  const rod = (g: THREE.Group, a: XYZ, b: XYZ, r1: number, r2: number, mat: THREE.Material) => {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), span = to.clone().sub(from);
    const mesh = part(g, new THREE.CylinderGeometry(r2, r1, span.length(), 14), mat);
    mesh.position.copy(from).add(to).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), span.normalize()); return mesh;
  };
  const panel = (g: THREE.Group, points: [number, number][], at: XYZ, mat: THREE.Material, depth = .012) => {
    const shape = new THREE.Shape(); points.forEach(([x,y],i)=>i ? shape.lineTo(x,y) : shape.moveTo(x,y)); shape.closePath();
    return part(g, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .003, bevelSize: .003, bevelSegments: 1 }), mat, at);
  };
  const scar = new THREE.MeshStandardMaterial({ color: 0xe0bfa4, roughness: .7 });
  for (const material of [shirt, seam, vest, trousers, stripe]) material.userData.surfaceKind = "cloth";
  for (const material of [skin, lip, scar]) material.userData.surfaceKind = "skin";
  for (const material of [hair, hairLight]) material.userData.surfaceKind = "fur";
  for (const material of [boots, leather]) material.userData.surfaceKind = "leather";
  metal.userData.surfaceKind = "metal";
  white.userData.skipSurfaceDetail = true;
  // A relaxed hand: palm, four jointed fingers curling over and a thumb on the inside.
  const hand = (g: THREE.Group, x: number, y: number, z: number, side: number, curl: number) => {
    box(g, [x, y, z], [.068, .03, .08], skin, .014);
    for (let f = 0; f < 4; f++) {
      const fx = x - .025 + f * .0167, len = f === 0 || f === 3 ? .82 : 1;
      const a: XYZ = [fx, y - .003, z + .036], b: XYZ = [fx, y - .006 - curl * .01, z + .036 + .025 * len], c: XYZ = [fx, y - .012 - curl * .024, z + .05 + .028 * len - curl * .014];
      ball(g, a, [.0088, .0085, .0088], skin);
      rod(g, a, b, .0078, .0072, skin);
      ball(g, b, [.0072, .0072, .0072], skin);
      rod(g, b, c, .0072, .006, skin);
      ball(g, c, [.006, .006, .0065], lip);
    }
    const t0: XYZ = [x - side * .03, y - .004, z - .012], t1: XYZ = [x - side * .043, y - .009, z + .02], t2: XYZ = [x - side * .041, y - .013, z + .044];
    ball(g, t0, [.014, .012, .016], skin);
    rod(g, t0, t1, .011, .009, skin);
    rod(g, t1, t2, .009, .0075, skin);
    ball(g, t2, [.0075, .0075, .008], skin);
  };
  const hip = seatHeight + .065, shoulder = seatHeight + .58;
  const body = new THREE.Group(); group.add(body);
  box(body, [0,hip,.015], [.32,.14,.24], trousers, .032);
  ball(body, [0,hip+.27,-.008], [.172,.25,.105], shirt);
  box(body, [0,hip+.28,-.075], [.35,.4,.075], vest, .028);
  // Two open waistcoat fronts leave the shirt and its unbuttoned collar visible.
  for(const side of [-1,1]) {
    const points: [number,number][] = [[side*.047,0],[side*.176,.018],[side*.181,.39],[side*.118,.47],[side*.072,.393]];
    panel(body,points,[0,hip+.095,.096],vest);
    for(const [y,w,h] of [[.19,.098,.074],[.365,.075,.052]]) {
      box(body,[side*.119,hip+y,.116],[w,h,.018],vest,.006);
      box(body,[side*.119,hip+y+h*.43,.128],[w+.008,.014,.012],vest,.003);
      pipe(body,[[side*.119-w*.45,hip+y-h*.43,.13],[side*.119+w*.45,hip+y-h*.43,.13]],.0024,seam);
    }
  }
  rod(body,[0,shoulder-.03,0],[0,shoulder+.10,0],.06,.054,skin);
  // Deep open neckline with soft pointed cream collar tabs.
  panel(body,[[-.065,.16],[.065,.16],[.02,-.01],[-.018,-.012]],[0,hip+.396,.108],skin,.005);
  for(const side of [-1,1]) {
    const collar=panel(body,[[side*.018,.11],[side*.072,.16],[side*.095,.035],[side*.039,.055]],[0,hip+.407,.129],shirt,.008);
    collar.rotation.y=side*-.16;
    pipe(body,[[side*.028,hip+.39,.12],[side*.025,hip+.32,.113]],.003,seam);
  }
  // Utility belt, two visible silver catches and the right-thigh holster.
  box(body,[0,hip+.083,.006],[.345,.058,.26],leather,.01);
  box(body,[0,hip+.083,.146],[.07,.048,.018],metal,.004);
  box(body,[0,hip+.083,.158],[.036,.022,.007],boots,.002);
  for(const x of [-.12,.12]) box(body,[x,hip+.067,.152],[.06,.075,.038],leather,.009);
  box(body,[-.12,hip+.092,.176],[.047,.012,.005],metal,.002);
  for(const side of [-1,1]) {
    const x=side*.106,kx=side*.145,knee=.35;
    rod(body,[x,hip,.03],[kx,hip-.01,knee],.088,.078,trousers);
    ball(body,[kx,hip-.025,knee],[.077,.073,.084],trousers);
    // Narrow red Corellian bloodstripe along the outside seam of each thigh.
    pipe(body,[[x+side*.081,hip+.025,.04],[kx+side*.076,hip+.02,.21],[kx+side*.073,hip-.014,.35]],.009,stripe);
    rod(body,[kx,hip-.065,knee],[kx,.105,knee+.012],.067,.054,boots);
    box(body,[kx,(hip+.12)/2,knee+.057],[.096,Math.max(.18,hip-.23),.035],boots,.012);
    box(body,[kx,.059,knee+.088],[.14,.105,.26],boots,.024);
    box(body,[kx,.015,knee+.09],[.145,.018,.27],vest,.004);
    part(body,new THREE.TorusGeometry(.064,.007,5,18),leather,[kx,hip-.09,knee],[Math.PI/2,0,0]).scale.z=.85;
  }
  const holster=box(body,[.21,hip-.035,.18],[.065,.25,.10],leather,.012);holster.rotation.x=-.23;
  box(body,[.19,hip-.035,.17],[.037,.04,.24],leather,.007);
  box(body,[.21,hip+.118,.129],[.041,.085,.04],boots,.006).rotation.z=-.24;
  box(body,[.228,hip+.09,.158],[.023,.027,.035],metal,.003);
  bakePart(body);

  // Arms are separate baked groups so the playing hand can reach across the board.
  const arms = [-1,1].map(side=>{
    const arm=new THREE.Group();arm.name=side===1?"han-playing-arm":"han-resting-arm";
    arm.position.set(side*.205,shoulder-.018,0);group.add(arm);
    ball(arm,[0,-.025,0],[.075,.09,.078],shirt);
    rod(arm,[0,-.04,0],[side*.018,-.235,.055],.061,.05,shirt);
    ball(arm,[side*.018,-.244,.058],[.052,.053,.055],shirt);
    rod(arm,[side*.018,-.24,.065],[-side*.024,-.34,.31],.05,.038,shirt);
    for(let i=0;i<3;i++)pipe(arm,[[side*.018-.028,-.19-i*.016,.101],[side*.018+.027,-.2-i*.016,.108]],.0028,seam);
    rod(arm,[-side*.022,-.333,.285],[-side*.025,-.351,.328],.041,.04,shirt);
    hand(arm,-side*.024,-.354,.35,side,side===1?.35:.8);
    bakePart(arm);return arm;
  });

  const head=new THREE.Group();head.name="han-solo-head";head.position.set(0,seatHeight+.79,.008);group.add(head);
  // A continuous jaw and forehead avoid intersecting spheres across the cheeks.
  const face = new THREE.SphereGeometry(1, 32, 24);
  const vertices = face.getAttribute("position");
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
    const jaw = THREE.MathUtils.smoothstep(y, -.9, -.12);
    const width = THREE.MathUtils.lerp(.082, .112, jaw);
    const chin = (1 - THREE.MathUtils.smoothstep(y, -.95, -.35)) * .026;
    vertices.setXYZ(i, x * width, y * .151 + .016, z * .103 - .006 + chin);
  }
  face.computeVertexNormals();
  part(head, face, skin);
  ball(head,[0,-.102,.047],[.062,.027,.05],skin);
  for(const side of [-1,1]) {
    ball(head,[side*.109,-.012,-.005],[.023,.042,.022],skin);
    ball(head,[side*.111,-.01,.013],[.009,.021,.005],lip);
    ball(head,[side*.058,-.012,.07],[.036,.044,.035],skin);
    ball(head,[side*.043,.024,.087],[.025,.012,.013],white);
    pipe(head,[[side*.019,.032,.1],[side*.041,.039,.098],[side*.067,.027,.087]],.0042,skin);
    pipe(head,[[side*.019,.02,.1],[side*.042,.013,.103],[side*.068,.022,.089]],.0032,skin);
    pipe(head,[[side*.024,.043,.097],[side*.044,.046,.095],[side*.066,.036,.086]],.0016,lip);
    pipe(head,[[side*.019,.05,.097],[side*.043,.056,.094],[side*.071,.043,.077]],.0048,hair);
  }
  // Straight nose with a defined bridge, tip and nostril wings.
  rod(head,[0,.051,.095],[0,-.013,.12],.009,.014,skin);
  ball(head,[0,-.017,.119],[.018,.014,.016],skin);
  for(const side of [-1,1]) {
    ball(head,[side*.015,-.02,.111],[.008,.009,.009],skin);
    ball(head,[side*.012,-.026,.121],[.0045,.0024,.0034],lip);
    pipe(head,[[side*.02,-.034,.106],[side*.032,-.047,.101]],.0014,lip);
  }
  pipe(head,[[0,-.033,.112],[0,-.048,.105]],.0022,skin);
  // A small scar under the lip, on the left of the chin.
  pipe(head,[[.012,-.082,.098],[.02,-.093,.094]],.0018,scar);
  // Cheekbones.
  for(const side of [-1,1]) ball(head,[side*.07,-.03,.07],[.03,.022,.025],skin);
  pipe(head,[[-.025,-.061,.098],[0,-.065,.102],[.026,-.06,.097]],.0035,skin);
  // Swept seventies hair: a shaped cap, side part and layered locks at the temples.
  const cap=new THREE.SphereGeometry(1,28,16,0,Math.PI*2,0,Math.PI*.62),cp=cap.getAttribute('position');
  for(let i=0;i<cp.count;i++){
    const x=cp.getX(i),y=cp.getY(i),z=cp.getZ(i);
    cp.setXYZ(i,x*.119,y*.15+.032+Math.max(0,z)*.013,z*.114-.025);
  }
  cap.computeVertexNormals();part(head,cap,hair);
  for(let i=0;i<7;i++) {
    const x=-.091+i*.025;
    pipe(head,[[x*.6,.157,-.006],[x-.02,.144,.055],[x-.03,.097,.087]],.009+(i%2)*.002,i%3===0?hairLight:hair);
  }
  for(const side of [-1,1]) {
    ball(head,[side*.099,.013,-.045],[.027,.073,.065],hair);
    ball(head,[side*.098,.041,.035],[.018,.068,.035],hair);
    pipe(head,[[side*.106,.066,.02],[side*.107,.01,.009],[side*.099,-.025,.006]],.01,hairLight);
  }
  bakePart(head);
  // Hazel irises with a catchlight slide across the eye whites to aim his gaze; the lids blink.
  const iris = new THREE.MeshStandardMaterial({ color: 0x5a4a2e, roughness: .25 });
  const pupil = new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: .15 });
  const glint = new THREE.MeshBasicMaterial({ color: 0xfff6e8 });
  iris.userData.skipSurfaceDetail = true;
  pupil.userData.skipSurfaceDetail = true;
  const gazes = [-1,1].map(side=>{
    const g=new THREE.Group();g.position.set(side*.043,.024,.1005);head.add(g);
    part(g,new THREE.CircleGeometry(.0095,16),iris);
    part(g,new THREE.CircleGeometry(.0045,12),pupil,[0,0,.0004]);
    part(g,new THREE.CircleGeometry(.0018,8),glint,[-.003,.003,.0008]);
    return g;
  });
  const lids = [-1,1].map(side=>{
    const lid=ball(head,[side*.043,.042,.089],[.027,.01,.0145],skin);
    return lid;
  });
  // The mouth is its own piece so the famous crooked grin can tug one corner up.
  const mouth=new THREE.Group();mouth.position.set(0,-.056,.1);head.add(mouth);
  pipe(mouth,[[-.032,.002,-.002],[0,-.002,.006],[.032,.003,-.003]],.003,lip);
  let gesture=0,lastTime=0,still=false;
  const mood={look:0,smug:0,annoyed:0};
  const pose=()=>{
    const t=still?0:lastTime,{look,smug,annoyed}=mood;
    // Eyes down on the board while it plays, up at Chewie to gloat or to argue.
    head.rotation.x=.055+gesture*.085+(1-look)*.2-smug*.08+(still?0:Math.sin(t*.23)*.009);
    head.rotation.y=-.04+(still?0:Math.sin(t*.25)*.045)+annoyed*Math.sin(t*6.5)*.1;
    head.rotation.z=smug*.07-annoyed*.03;
    gazes.forEach(g=>g.position.y=.024+(look-.6)*.003);
    const blinkPhase = (t + .8) % 4.7;
    const blink = !still && blinkPhase < .18 ? Math.sin(Math.PI * blinkPhase / .18) : 0;
    lids.forEach(l=>{l.position.y=.042-blink*.018;l.scale.y=.01+blink*.006;});
    gazes.forEach((g, i)=>g.position.x=(i===0?-.043:.043)+(still?0:Math.sin(t*.31)*.002));
    mouth.rotation.z=smug*.22-annoyed*.08;
    mouth.position.y=-.056+smug*.002;
    // A shrug with the free arm when Chewie wins the exchange; a lazy flourish when Han does.
    arms[0].rotation.x=-annoyed*.35;arms[0].rotation.z=.025-annoyed*.3;
    arms[1].rotation.x=-gesture*.31-smug*.22;
    arms[1].rotation.z=-gesture*.12+smug*.16;
    arms[1].rotation.y=-gesture*.11;
  };
  return {group,
    tick:(time:number,reduced:boolean)=>{lastTime=time;still=reduced;pose();},
    play:(amount:number)=>{gesture=THREE.MathUtils.clamp(amount,0,1);pose();},
    react:(next:{look:number;smug:number;annoyed:number})=>{Object.assign(mood,still?{look:0,smug:0,annoyed:0}:next);pose();},
  };
}
