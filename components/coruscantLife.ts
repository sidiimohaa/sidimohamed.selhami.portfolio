import * as THREE from "three";
import { createDroidKit } from "./droidModels";

export type PadEvent = "droid" | "speeder-arrive" | "speeder-leave";
type Point = [number, number];
type Spot = { x: number; z: number };

const shortest = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const turnTowards = (from: number, to: number, rate: number) => from + shortest(to - from) * rate;

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number] = [0, 0, 0],
) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.rotation.set(...rotation);
  return item;
}
function glowSprite(texture: THREE.Texture, color: number, size: number) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      color,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  sprite.scale.setScalar(size);
  return sprite;
}

// Walk a polyline, looping or back and forth, pausing at chosen waypoints.
function patrol(points: Point[], speed: number, loop: boolean, pause: (index: number) => number) {
  let from = 0,
    to = 1,
    step = 1,
    along = 0,
    wait = 0,
    heading = Math.atan2(points[1][0] - points[0][0], points[1][1] - points[0][1]);
  const position = new THREE.Vector2(...points[0]);
  return {
    position,
    heading: () => heading,
    advance(dt: number) {
      if (wait > 0) {
        wait -= dt;
        return false;
      }
      const [ax, az] = points[from],
        [bx, bz] = points[to],
        length = Math.hypot(bx - ax, bz - az);
      heading = Math.atan2(bx - ax, bz - az);
      along += speed * dt;
      if (along >= length) {
        along = 0;
        position.set(bx, bz);
        wait = pause(to);
        from = to;
        if (loop) to = (from + 1) % points.length;
        else {
          if (from + step < 0 || from + step >= points.length) step = -step;
          to = from + step;
        }
        return true;
      }
      position.set(ax + ((bx - ax) * along) / length, az + ((bz - az) * along) / length);
      return true;
    },
  };
}
// Someone stands in the way when close and roughly ahead of the direction of travel.
function inTheWay(x: number, z: number, heading: number, other: Spot, range: number) {
  const dx = other.x - x,
    dz = other.z - z,
    distance = Math.hypot(dx, dz);
  return (
    distance < range &&
    (dx * Math.sin(heading) + dz * Math.cos(heading)) / Math.max(distance, 0.001) > 0.3
  );
}

// Steam and sparks share one point shader: each particle fades over its own life.
function particles(
  texture: THREE.Texture,
  count: number,
  look: { color: number; size: number; grow: number; opacity: number; additive: boolean; puff: boolean },
) {
  const positions = new Float32Array(count * 3),
    life = new Float32Array(count).fill(1),
    velocities = new Float32Array(count * 3),
    durations = new Float32Array(count).fill(1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("life", new THREE.BufferAttribute(life, 1));
  const uniforms = {
    map: { value: texture },
    color: { value: new THREE.Color(look.color) },
    viewport: { value: 800 },
  };
  const points = new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `attribute float life;uniform float viewport;varying float vLife;
       void main(){
        vLife=life;
        vec4 view=modelViewMatrix*vec4(position,1.0);
        float size=${look.size.toFixed(3)}*(1.0+life*${look.grow.toFixed(3)});
        gl_PointSize=life>=1.0?0.0:size*projectionMatrix[1][1]*viewport*0.5/max(-view.z,0.1);
        gl_Position=projectionMatrix*view;
       }`,
      fragmentShader: `uniform sampler2D map;uniform vec3 color;varying float vLife;
       void main(){
        float fade=${look.puff ? "sin(3.14159*vLife)" : "1.0-vLife"};
        float alpha=texture2D(map,gl_PointCoord).a*fade*${look.opacity.toFixed(3)};
        if(alpha<.003)discard;
        gl_FragColor=vec4(color,alpha);
       }`,
      transparent: true,
      depthWrite: false,
      blending: look.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }),
  );
  points.frustumCulled = false;
  let cursor = 0;
  return {
    points,
    uniforms,
    emit(at: THREE.Vector3, velocity: THREE.Vector3, duration: number) {
      for (let tries = 0; tries < count; tries++) {
        cursor = (cursor + 1) % count;
        if (life[cursor] < 1) continue;
        at.toArray(positions, cursor * 3);
        velocity.toArray(velocities, cursor * 3);
        durations[cursor] = duration;
        life[cursor] = 0;
        return;
      }
    },
    update(dt: number, gravity: number, drift: number) {
      for (let i = 0; i < count; i++) {
        if (life[i] >= 1) continue;
        life[i] = Math.min(1, life[i] + dt / durations[i]);
        velocities[i * 3 + 1] += gravity * dt;
        velocities[i * 3] += drift * dt;
        positions[i * 3] += velocities[i * 3] * dt;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
      }
      geometry.getAttribute("position").needsUpdate = true;
      geometry.getAttribute("life").needsUpdate = true;
    },
  };
}

// Coruscant gets the full cast; other worlds switch off what does not belong there.
export function createPadLife(options: {
  glow: THREE.Texture;
  engines: THREE.Object3D[];
  notify: (event: PadEvent) => void;
  guard?: boolean;
  drone?: boolean;
  taxi?: boolean;
  ground?: "grates" | "sand" | "snow";
  steam?: number;
}) {
  const { glow, engines, notify } = options;
  const has = {
    guard: options.guard ?? true,
    drone: options.drone ?? true,
    taxi: options.taxi ?? true,
    sand: options.ground === "sand" || options.ground === "snow",
  };
  const group = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: 0xc8692d, roughness: 0.6, metalness: 0.25 }),
    dark = new THREE.MeshStandardMaterial({ color: 0x2c3135, roughness: 0.55, metalness: 0.6 }),
    visor = new THREE.MeshStandardMaterial({ color: 0x0d1215, roughness: 0.18, metalness: 0.85 }),
    paint = new THREE.MeshStandardMaterial({ color: 0xd39b3c, roughness: 0.38, metalness: 0.45 }),
    hover = new THREE.MeshBasicMaterial({
      color: 0x7fd8ff,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  const movers: { x: number; z: number; r: number }[] = [];

  const droids = createDroidKit();

  // An astromech on its rounds around the ship; it stops and chirps when someone blocks it.
  const { droid: astromech, dome, eye } = droids.astromech();
  group.add(astromech);
  const rounds = patrol(
    Array.from({ length: 48 }, (_, i) => {
      const angle = (i / 48) * Math.PI * 2;
      return [Math.cos(angle) * 6.6, 3 + Math.sin(angle) * 7.8] as Point;
    }),
    1.1,
    true,
    (index) => (index === 12 || index === 36 ? 3 : 0),
  );
  const astromechSpot = { x: 0, z: 0, r: 0.45 };
  movers.push(astromechSpot);
  let chirpedAt = -Infinity,
    blockedFor = 0;

  // A pit droid scampering about behind the ship.
  const scout = droids.pitDroid();
  group.add(scout.droid);
  const dashes = patrol(
    [
      [-3.6, -4.6],
      [-1, -6.6],
      [2.6, -6],
      [4.4, -4.4],
      [2, -4],
      [-1.8, -3.6],
    ],
    2,
    true,
    () => 0.3 + Math.random() * 1.1,
  );
  const scoutSpot = { x: 0, z: 0, r: 0.3 };
  movers.push(scoutSpot);
  let scoutPhase = 0;

  // Ground crew dressed as fighter pilots: orange flight suit, ribbed white vest with a chest
  // box, harness straps, black gloves and boots, white helmet with red markings and an orange visor.
  const checker = document.createElement("canvas");
  checker.width = 64;
  checker.height = 16;
  const tiles = checker.getContext("2d")!;
  for (let x = 0; x < 8; x++)
    for (let y = 0; y < 2; y++) {
      tiles.fillStyle = (x + y) % 2 ? "#e8e6dc" : "#557f3a";
      tiles.fillRect(x * 8, y * 8, 8, 8);
    }
  const bootBand = new THREE.CanvasTexture(checker);
  bootBand.colorSpace = THREE.SRGBColorSpace;
  const flightSuit = new THREE.MeshStandardMaterial({ color: 0xd25a24, roughness: 0.85 }),
    vest = new THREE.MeshStandardMaterial({ color: 0xe1ded6, roughness: 0.7 }),
    rib = new THREE.MeshStandardMaterial({ color: 0x8f9192, roughness: 0.65, metalness: 0.2 }),
    strap = new THREE.MeshStandardMaterial({ color: 0xa9aca8, roughness: 0.6 }),
    leather = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.55, metalness: 0.1 }),
    band = new THREE.MeshStandardMaterial({ map: bootBand, roughness: 0.7 }),
    helmet = new THREE.MeshStandardMaterial({ color: 0xece9e2, roughness: 0.35, metalness: 0.1 }),
    marking = new THREE.MeshStandardMaterial({ color: 0xb52f22, roughness: 0.5 }),
    goggles = new THREE.MeshStandardMaterial({
      color: 0xff8a2b,
      emissive: 0x4a1e04,
      roughness: 0.15,
      metalness: 0.4,
      transparent: true,
      opacity: 0.9,
    });
  const indicators = [0x6fb7ff, 0xffffff, 0xff5a3c].map((color) => new THREE.MeshBasicMaterial({ color }));
  const crewMember = (skin: number) => {
    const person = new THREE.Group();
    const face = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.75 });
    const legs = [-1, 1].map((side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.1, 0.9, 0);
      hip.add(
        mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.42, 10), flightSuit, [0, -0.21, 0]),
        mesh(new THREE.CylinderGeometry(0.089, 0.089, 0.04, 10), strap, [0, -0.13, 0]),
        mesh(new THREE.BoxGeometry(0.12, 0.1, 0.06), flightSuit, [0, -0.4, 0.06]),
        mesh(new THREE.CylinderGeometry(0.072, 0.07, 0.14, 10), flightSuit, [0, -0.49, 0]),
        mesh(new THREE.CylinderGeometry(0.076, 0.076, 0.04, 12), band, [0, -0.565, 0]),
        mesh(new THREE.CylinderGeometry(0.072, 0.07, 0.29, 10), leather, [0, -0.725, 0]),
        mesh(new THREE.BoxGeometry(0.11, 0.07, 0.25), leather, [0, -0.865, 0.05]),
      );
      person.add(hip);
      return hip;
    });
    const arms = [-1, 1].map((side) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.245, 1.44, 0);
      shoulder.add(
        mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.32, 10), flightSuit, [0, -0.16, 0]),
        mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 10), flightSuit, [0, -0.38, 0]),
        mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.16, 10), leather, [0, -0.5, 0]),
        mesh(new THREE.BoxGeometry(0.07, 0.1, 0.05), leather, [0, -0.62, 0]),
      );
      person.add(shoulder);
      return shoulder;
    });
    const hose = mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 18, Math.PI), rib, [0, 1.27, 0.135]);
    hose.rotation.z = Math.PI;
    person.add(
      mesh(new THREE.BoxGeometry(0.34, 0.2, 0.22), flightSuit, [0, 0.98, 0]),
      mesh(new THREE.BoxGeometry(0.36, 0.07, 0.24), strap, [0, 1.06, 0]),
      mesh(new THREE.BoxGeometry(0.08, 0.05, 0.02), rib, [0, 1.06, 0.125]),
      mesh(new THREE.BoxGeometry(0.38, 0.42, 0.22), flightSuit, [0, 1.28, 0]),
      mesh(new THREE.BoxGeometry(0.4, 0.26, 0.25), vest, [0, 1.36, 0]),
      ...[0, 1, 2, 3, 4].map((i) =>
        mesh(new THREE.BoxGeometry(0.405, 0.012, 0.255), rib, [0, 1.255 + i * 0.05, 0]),
      ),
      mesh(new THREE.BoxGeometry(0.12, 0.09, 0.05), rib, [0, 1.38, 0.14]),
      ...(
        [
          [-0.03, 1.395, 0],
          [0, 1.395, 1],
          [0.03, 1.395, 0],
          [-0.03, 1.365, 2],
          [0.03, 1.365, 1],
        ] as const
      ).map(([x, y, light]) => mesh(new THREE.BoxGeometry(0.018, 0.018, 0.01), indicators[light], [x, y, 0.166])),
      ...[-1, 1].map((side) => mesh(new THREE.BoxGeometry(0.04, 0.2, 0.012), strap, [side * 0.07, 1.15, 0.118])),
      mesh(new THREE.BoxGeometry(0.04, 0.16, 0.012), strap, [0, 0.96, 0.115]),
      hose,
      mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10), face, [0, 1.53, 0]),
    );
    // The helmet leaves the face open under an orange visor, with headphones and a microphone.
    const head = new THREE.Group();
    head.position.y = 1.64;
    const skull = mesh(new THREE.SphereGeometry(0.105, 16, 12), face);
    skull.scale.set(0.95, 1.1, 1);
    const shell = (phiStart: number, phiLength: number, thetaStart: number, thetaLength: number, material: THREE.Material, radius = 0.135) =>
      mesh(new THREE.SphereGeometry(radius, 20, 8, phiStart, phiLength, thetaStart, thetaLength), material, [0, 0.02, 0]);
    const mic = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.12, 6), leather, [0.095, -0.055, 0.075]);
    mic.rotation.set(Math.PI / 2, 0, 0.85);
    head.add(
      skull,
      shell(0, Math.PI * 2, 0, Math.PI * 0.34, helmet),
      shell(Math.PI / 2 + 0.62, Math.PI * 2 - 1.24, Math.PI * 0.34, Math.PI * 0.26, helmet),
      shell(Math.PI / 2 - 0.62, 1.24, Math.PI * 0.36, Math.PI * 0.13, goggles, 0.142),
      shell(Math.PI / 2 - 0.12, 0.24, 0.04, Math.PI * 0.3, marking, 0.137),
      shell(Math.PI * 1.5 - 0.12, 0.24, 0.04, Math.PI * 0.5, marking, 0.137),
      ...[-1, 1].map((side) =>
        mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 14), helmet, [side * 0.135, -0.01, 0], [0, 0, Math.PI / 2]),
      ),
      ...[-1, 1].map((side) =>
        mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 12), marking, [side * 0.152, -0.01, 0], [0, 0, Math.PI / 2]),
      ),
      mic,
    );
    person.add(head);
    group.add(person);
    return { person, legs, arms };
  };
  const stride = (member: ReturnType<typeof crewMember>, phase: number, amount: number) => {
    member.legs.forEach((hip, i) => (hip.rotation.x = Math.sin(phase + i * Math.PI) * 0.5 * amount));
    member.arms.forEach(
      (shoulder, i) => (shoulder.rotation.x = Math.sin(phase + (1 - i) * Math.PI) * 0.4 * amount),
    );
  };
  const mechanic = crewMember(0xc89878);
  mechanic.person.position.set(2.9, 0, -2.75);
  mechanic.person.rotation.y = Math.atan2(1.7 - 2.9, -1.6 + 2.75);
  const tool = mesh(new THREE.BoxGeometry(0.05, 0.05, 0.2), dark, [0, -0.64, 0.06]);
  mechanic.arms[0].add(tool);
  movers.push({ x: 2.9, z: -2.75, r: 0.45 });
  const sparks = particles(glow, 80, {
    color: 0xffb35c,
    size: 0.06,
    grow: 0,
    opacity: 1,
    additive: true,
    puff: false,
  });
  group.add(sparks.points);

  // Two pit droids at the port engines: one welds overhead, the other waves directions.
  const welder = droids.pitDroid(),
    spotter = droids.pitDroid();
  welder.droid.position.set(-2.45, 0, -2.7);
  welder.droid.rotation.y = Math.atan2(0.65, 1.1);
  welder.head.rotation.x = -0.15;
  welder.arms[0].elbow.rotation.x = -0.4;
  welder.arms[1].shoulder.rotation.x = -0.5;
  const torch = new THREE.Object3D();
  torch.position.y = -0.2;
  welder.arms[0].elbow.add(torch);
  spotter.droid.position.set(-3.3, 0, -2.45);
  spotter.droid.rotation.y = Math.atan2(1.2, 0.75);
  spotter.arms[1].shoulder.rotation.x = -0.35;
  group.add(welder.droid, spotter.droid);
  movers.push({ x: -2.45, z: -2.7, r: 0.3 }, { x: -3.3, z: -2.45, r: 0.3 });
  const welders = [
    { tool, timer: 2, burst: 0 },
    { tool: torch, timer: 3.4, burst: 0 },
  ];

  // A battle droid on guard at the bow of the pad, pacing between the floodlights.
  const guard = droids.sentry();
  if (has.guard) group.add(guard.droid);
  const beat = patrol(
    [
      [-2.6, -13.2],
      [2.6, -13.2],
    ],
    0.9,
    false,
    () => 2.5,
  );
  const guardSpot = { x: 0, z: 0, r: 0.35 };
  if (has.guard) movers.push(guardSpot);
  let guardPhase = 0;

  const deckhand = crewMember(0x7a4e35);
  const datapad = mesh(
    new THREE.BoxGeometry(0.16, 0.02, 0.22),
    new THREE.MeshBasicMaterial({ color: 0x7fd8ff }),
    [0, -0.62, 0.08],
  );
  deckhand.arms[1].add(datapad);
  const errands = patrol(
    [
      [10.3, 1.7],
      [7.2, 1.4],
      [6.2, -2.4],
    ],
    1.3,
    false,
    (index) => (index === 0 || index === 2 ? 2.5 : 0),
  );
  const deckhandSpot = { x: 0, z: 0, r: 0.4 };
  movers.push(deckhandSpot);
  let deckhandPhase = 0;

  // A hover cart shuttling a crate between the cargo stack and the ship.
  const cart = new THREE.Group();
  cart.add(
    mesh(new THREE.BoxGeometry(0.9, 0.24, 1.3), dark),
    mesh(new THREE.BoxGeometry(0.92, 0.06, 0.1), orange, [0, 0.1, 0.62]),
    mesh(new THREE.BoxGeometry(0.92, 0.06, 0.1), orange, [0, 0.1, -0.62]),
    mesh(new THREE.BoxGeometry(0.75, 0.75, 0.75), orange, [0, 0.5, 0.1]),
    mesh(new THREE.BoxGeometry(0.7, 0.05, 0.05), dark, [0, 0.62, -0.66]),
    mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), dark, [-0.32, 0.37, -0.66]),
    mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), dark, [0.32, 0.37, -0.66]),
  );
  const underglow = mesh(new THREE.PlaneGeometry(0.8, 1.2), hover, [0, -0.14, 0]);
  underglow.rotation.x = Math.PI / 2;
  cart.add(underglow);
  [
    [-0.35, -0.5],
    [0.35, -0.5],
    [-0.35, 0.5],
    [0.35, 0.5],
  ].forEach(([x, z]) => {
    const pad = glowSprite(glow, 0x7fd8ff, 0.35);
    pad.position.set(x, -0.16, z);
    cart.add(pad);
  });
  group.add(cart);
  const haul = patrol(
    [
      [-10.2, 1],
      [-7, -0.6],
      [-5.9, -3],
    ],
    1.1,
    false,
    (index) => (index === 0 || index === 2 ? 3 : 0),
  );
  const cartSpot = { x: 0, z: 0, r: 0.85 };
  movers.push(cartSpot);

  // A surveillance drone circling above the pad.
  const drone = new THREE.Group();
  const droneLight = glowSprite(glow, 0xff4a3a, 0.3);
  droneLight.position.y = -0.18;
  const ring = mesh(new THREE.TorusGeometry(0.24, 0.02, 6, 24), orange);
  ring.rotation.x = Math.PI / 2;
  drone.add(mesh(new THREE.SphereGeometry(0.16, 14, 10), dark), ring, droneLight);
  if (has.drone) group.add(drone);

  // Steam: coolant venting from the engines after touchdown, and bursts from floor grates.
  const steam = particles(glow, 150, {
    color: options.steam ?? 0x9a948c,
    size: 0.5,
    grow: 3.2,
    opacity: 0.24,
    additive: false,
    puff: true,
  });
  group.add(steam.points);
  // On sand or snow there are no grates: gusts lift dust or powder off the floor instead.
  const dust = particles(glow, 120, {
    color: options.ground === "snow" ? 0xe9f0f6 : 0xc9a273,
    size: 0.7,
    grow: 2.6,
    opacity: 0.2,
    additive: false,
    puff: true,
  });
  if (has.sand) group.add(dust.points);
  const wind = new THREE.Vector3(0.55, 0, 0.84);
  const grates = [2.25, 3.55, 5.25].map((angle) => {
    const grate = mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.04, 20), dark, [
      Math.cos(angle) * 14,
      0.02,
      Math.sin(angle) * 14,
    ]);
    if (!has.sand) group.add(grate);
    return { at: grate.position.clone(), next: 2 + Math.random() * 6, venting: 0 };
  });
  let parkedFor = -1;

  // An air taxi drops down to the edge of the pad, waits, then rejoins the traffic.
  const taxi = new THREE.Group();
  taxi.rotation.order = "YXZ";
  const hull = mesh(new THREE.CapsuleGeometry(0.55, 2.4, 6, 18).rotateX(Math.PI / 2), paint);
  hull.scale.set(1.05, 0.6, 1);
  const canopy = mesh(new THREE.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), visor, [
    0,
    0.2,
    0.35,
  ]);
  canopy.scale.set(0.85, 0.75, 1.5);
  taxi.add(
    hull,
    canopy,
    mesh(new THREE.BoxGeometry(1.17, 0.05, 2.2), dark, [0, -0.06, 0]),
    mesh(new THREE.BoxGeometry(0.06, 0.4, 0.6), paint, [0, 0.42, -1.2]),
  );
  [-1, 1].forEach((side) => {
    taxi.add(
      mesh(new THREE.CylinderGeometry(0.2, 0.24, 1.7, 14).rotateX(Math.PI / 2), dark, [
        side * 0.78,
        -0.1,
        -0.45,
      ]),
      mesh(new THREE.ConeGeometry(0.2, 0.4, 14).rotateX(Math.PI / 2), paint, [side * 0.78, -0.1, 0.6]),
    );
    const head = glowSprite(glow, 0xfff1d6, 0.55);
    head.position.set(side * 0.32, 0, 1.78);
    const tail = glowSprite(glow, 0xff4a3a, 0.4);
    tail.position.set(side * 0.5, 0.02, -1.78);
    const thrust = glowSprite(glow, 0xffa868, 0.5);
    thrust.position.set(side * 0.78, -0.1, -1.32);
    taxi.add(head, tail, thrust);
  });
  const taxiGlow = mesh(new THREE.PlaneGeometry(1.2, 2.6), hover, [0, -0.36, 0]);
  taxiGlow.rotation.x = Math.PI / 2;
  taxi.add(taxiGlow);
  taxi.visible = false;
  group.add(taxi);
  const dock = new THREE.Vector3(0, 0.6, -18.8);
  const inbound = [new THREE.Vector3(-240, 40, -120), new THREE.Vector3(-55, 12, -34), dock];
  const outbound = [dock, new THREE.Vector3(60, 5, -34), new THREE.Vector3(260, 60, -160)];
  const curve = (points: THREE.Vector3[], t: number, at: THREE.Vector3, slope: THREE.Vector3) => {
    const [a, b, c] = points,
      u = 1 - t;
    at.set(0, 0, 0).addScaledVector(a, u * u).addScaledVector(b, 2 * u * t).addScaledVector(c, t * t);
    slope.subVectors(b, a).multiplyScalar(2 * u).addScaledVector(c.clone().sub(b), 2 * t);
  };
  let taxiPhase: "away" | "inbound" | "docked" | "outbound" = "away",
    taxiClock = 0,
    taxiWait = 6;

  const at = new THREE.Vector3(),
    slope = new THREE.Vector3(),
    puff = new THREE.Vector3();
  return {
    group,
    movers,
    setViewport: (height: number) => {
      steam.uniforms.viewport.value = height;
      sparks.uniforms.viewport.value = height;
    },
    settle: (parked: boolean) => {
      if (parked && parkedFor < 0) parkedFor = 0;
      if (!parked) parkedFor = -1;
    },
    tick: (dt: number, elapsed: number, reduced: boolean, walker: Spot) => {
      const live = reduced ? 0 : dt;

      // Astromech: yields to the walker and to every other moving thing on the pad.
      const blocked =
        inTheWay(astromechSpot.x, astromechSpot.z, rounds.heading(), walker, 1.7) ||
        [scoutSpot, deckhandSpot, cartSpot, ...(has.guard ? [guardSpot] : [])].some((other) =>
          inTheWay(astromechSpot.x, astromechSpot.z, rounds.heading(), other, 1.3),
        );
      const facesWalker = inTheWay(astromechSpot.x, astromechSpot.z, rounds.heading(), walker, 1.7);
      blockedFor = facesWalker ? blockedFor + dt : 0;
      if (!blocked) rounds.advance(live);
      astromechSpot.x = rounds.position.x;
      astromechSpot.z = rounds.position.y;
      astromech.position.set(astromechSpot.x, 0, astromechSpot.z);
      astromech.rotation.y = turnTowards(astromech.rotation.y, rounds.heading(), 1 - Math.exp(-dt * 5));
      astromech.rotation.z = blocked || reduced ? 0 : Math.sin(elapsed * 9) * 0.035;
      const towardsWalker =
        Math.atan2(walker.x - astromechSpot.x, walker.z - astromechSpot.z) - astromech.rotation.y;
      dome.rotation.y = turnTowards(
        dome.rotation.y,
        facesWalker ? towardsWalker : reduced ? 0 : Math.sin(elapsed * 0.7) * 0.7,
        1 - Math.exp(-dt * 4),
      );
      eye.color.setHex(
        facesWalker && Math.sin(elapsed * 18) > 0 ? 0xffffff : 0x8fdcff,
      );
      if (blockedFor > 0.4 && elapsed - chirpedAt > 8) {
        chirpedAt = elapsed;
        notify("droid");
      }

      // Pit droid scout: scampers between spots, glancing around whenever it stops.
      const scampering =
        !inTheWay(scoutSpot.x, scoutSpot.z, dashes.heading(), walker, 1.1) && dashes.advance(live);
      scoutSpot.x = dashes.position.x;
      scoutSpot.z = dashes.position.y;
      if (scampering) scoutPhase += live * 14;
      scout.droid.position.set(
        scoutSpot.x,
        scampering && !reduced ? Math.abs(Math.sin(scoutPhase)) * 0.05 : 0,
        scoutSpot.z,
      );
      scout.droid.rotation.y = turnTowards(scout.droid.rotation.y, dashes.heading(), 1 - Math.exp(-dt * 10));
      scout.legs.forEach(
        (hip, i) => (hip.rotation.x = scampering ? Math.sin(scoutPhase + i * Math.PI) * 0.6 : 0),
      );
      scout.arms.forEach(
        ({ shoulder }, i) =>
          (shoulder.rotation.x = scampering ? Math.sin(scoutPhase + (1 - i) * Math.PI) * 0.5 : -0.3),
      );
      scout.head.rotation.y = turnTowards(
        scout.head.rotation.y,
        scampering || reduced ? 0 : Math.sin(elapsed * 2.2) * 0.7,
        1 - Math.exp(-dt * 6),
      );

      // Mechanic: works on the engine with the odd shower of sparks.
      mechanic.arms[0].rotation.x = -1.25 + (reduced ? 0 : Math.sin(elapsed * 3) * 0.08);
      mechanic.arms[1].rotation.x = -0.2;
      mechanic.person.rotation.z = reduced ? 0 : Math.sin(elapsed * 1.3) * 0.02;
      // Pit crew: the welder reaches into the engine, the spotter waves and hops about.
      welder.arms[0].shoulder.rotation.x = -2.2 + (reduced ? 0 : Math.sin(elapsed * 5) * 0.06);
      spotter.droid.position.y = reduced ? 0 : Math.pow(Math.max(0, Math.sin(elapsed * 1.3)), 10) * 0.16;
      spotter.arms[0].shoulder.rotation.set(-1.1, 0, -0.5 + (reduced ? 0 : Math.sin(elapsed * 4) * 0.45));
      spotter.head.rotation.z = reduced ? 0 : Math.sin(elapsed * 2) * 0.15;
      welders.forEach((welding) => {
        if (!reduced && (welding.timer -= dt) <= 0) {
          welding.burst = 0.6;
          welding.timer = 2.5 + Math.random() * 3;
        }
        if (welding.burst <= 0) return;
        welding.burst -= dt;
        welding.tool.getWorldPosition(at);
        for (let i = 0; i < 2; i++)
          sparks.emit(
            at,
            puff.set((Math.random() - 0.5) * 2.4, 0.6 + Math.random() * 1.6, (Math.random() - 0.5) * 2.4),
            0.4 + Math.random() * 0.35,
          );
      });
      sparks.update(live, -9.8, 0);

      // Battle droid: paces its beat, but halts and turns its head when the walker comes close.
      if (has.guard) {
        const watching = Math.hypot(walker.x - guardSpot.x, walker.z - guardSpot.z) < 2.8;
        const pacing = !watching && beat.advance(live);
        guardSpot.x = beat.position.x;
        guardSpot.z = beat.position.y;
        guard.droid.position.set(guardSpot.x, 0, guardSpot.z);
        const towardsVisitor = Math.atan2(walker.x - guardSpot.x, walker.z - guardSpot.z);
        guard.droid.rotation.y = turnTowards(
          guard.droid.rotation.y,
          watching ? towardsVisitor : beat.heading(),
          1 - Math.exp(-dt * (watching ? 2 : 5)),
        );
        if (pacing) guardPhase += live * 6.5;
        guard.legs.forEach(({ hip, knee }, i) => {
          const swing = pacing ? Math.sin(guardPhase + i * Math.PI) : 0;
          hip.rotation.x = swing * 0.35;
          knee.rotation.x = Math.max(0, -swing) * 0.45;
        });
        guard.arms.forEach(
          ({ shoulder }, i) =>
            (shoulder.rotation.x = pacing ? Math.sin(guardPhase + (1 - i) * Math.PI) * 0.18 : 0),
        );
        guard.head.rotation.y = turnTowards(
          guard.head.rotation.y,
          watching
            ? THREE.MathUtils.clamp(shortest(towardsVisitor - guard.droid.rotation.y), -1, 1)
            : pacing || reduced
              ? 0
              : Math.sin(elapsed * 0.9) * 0.6,
          1 - Math.exp(-dt * 4),
        );
      }

      // Deckhand: back and forth to the cargo stack, waiting if the walker is in the way.
      const deckhandMoving =
        !inTheWay(deckhandSpot.x, deckhandSpot.z, errands.heading(), walker, 1.3) &&
        errands.advance(live);
      deckhandSpot.x = errands.position.x;
      deckhandSpot.z = errands.position.y;
      deckhand.person.position.set(deckhandSpot.x, 0, deckhandSpot.z);
      deckhand.person.rotation.y = turnTowards(
        deckhand.person.rotation.y,
        errands.heading(),
        1 - Math.exp(-dt * 6),
      );
      if (deckhandMoving) deckhandPhase += live * 7;
      stride(deckhand, deckhandPhase, deckhandMoving ? 1 : 0);
      if (!deckhandMoving) deckhand.arms[1].rotation.x = -0.9;

      // Hover cart.
      if (!inTheWay(cartSpot.x, cartSpot.z, haul.heading(), walker, 1.8)) haul.advance(live);
      cartSpot.x = haul.position.x;
      cartSpot.z = haul.position.y;
      cart.position.set(cartSpot.x, 0.36 + (reduced ? 0 : Math.sin(elapsed * 2.4) * 0.03), cartSpot.z);
      cart.rotation.y = turnTowards(cart.rotation.y, haul.heading(), 1 - Math.exp(-dt * 3));

      // Drone.
      const orbit = reduced ? 0.6 : elapsed * 0.25;
      drone.position.set(Math.cos(orbit) * 7, 5.5 + (reduced ? 0 : Math.sin(elapsed * 1.7) * 0.2), 2 + Math.sin(orbit) * 7);
      droneLight.material.opacity = Math.pow(Math.max(0, Math.sin(elapsed * 2.6)), 8);

      // Steam from the engines fades from a hiss after touchdown to a slow idle.
      if (parkedFor >= 0) parkedFor += dt;
      if (!reduced && parkedFor >= 0) {
        const rate = 1 + 7 * Math.exp(-parkedFor / 14);
        engines.forEach((engine) => {
          if (Math.random() > rate * dt) return;
          engine.getWorldPosition(at);
          steam.emit(
            at,
            puff.set((Math.random() - 0.5) * 0.25, 0.25 + Math.random() * 0.25, -0.2 - Math.random() * 0.2),
            3 + Math.random() * 1.5,
          );
        });
      }
      grates.forEach((grate) => {
        if (reduced) return;
        if ((grate.next -= dt) <= 0) {
          grate.venting = 1.4;
          grate.next = 6 + Math.random() * 5;
        }
        if (grate.venting > 0) {
          grate.venting -= dt;
          if (has.sand) {
            if (Math.random() < 22 * dt)
              dust.emit(
                puff.copy(grate.at).add(at.set((Math.random() - 0.5) * 3, 0.1, (Math.random() - 0.5) * 3)),
                at.copy(wind).multiplyScalar(1.4 + Math.random()).setY(0.12 + Math.random() * 0.2),
                2.6 + Math.random() * 1.4,
              );
          } else if (Math.random() < 16 * dt)
            steam.emit(
              puff.copy(grate.at).add(at.set((Math.random() - 0.5) * 0.4, 0.05, (Math.random() - 0.5) * 0.4)),
              at.set((Math.random() - 0.5) * 0.2, 0.8 + Math.random() * 0.5, (Math.random() - 0.5) * 0.2),
              2.4 + Math.random() * 1.2,
            );
        }
      });
      steam.update(live, 0.04, 0.05);
      if (has.sand) dust.update(live, -0.02, 0.08);

      // Air taxi.
      if (!has.taxi) return;
      if (reduced) {
        taxi.visible = true;
        taxi.position.copy(dock);
        taxi.rotation.set(0, Math.PI / 2, 0);
        return;
      }
      taxiClock += dt;
      if (taxiPhase === "away") {
        taxi.visible = false;
        if (taxiClock > taxiWait) {
          taxiPhase = "inbound";
          taxiClock = 0;
          notify("speeder-arrive");
        }
      } else if (taxiPhase === "inbound" || taxiPhase === "outbound") {
        const duration = taxiPhase === "inbound" ? 7 : 6,
          k = Math.min(1, taxiClock / duration);
        curve(
          taxiPhase === "inbound" ? inbound : outbound,
          taxiPhase === "inbound" ? 1 - Math.pow(1 - k, 3) : Math.pow(k, 2.4),
          at,
          slope,
        );
        taxi.visible = true;
        taxi.position.copy(at);
        if (slope.lengthSq() > 0.0001) {
          taxi.rotation.y = turnTowards(taxi.rotation.y, Math.atan2(slope.x, slope.z), 1 - Math.exp(-dt * 4));
          taxi.rotation.x = -Math.atan2(slope.y, Math.hypot(slope.x, slope.z)) * 0.6;
        }
        if (k >= 1) {
          taxiClock = 0;
          if (taxiPhase === "inbound") taxiPhase = "docked";
          else {
            taxiPhase = "away";
            taxiWait = 10 + Math.random() * 8;
          }
        }
      } else {
        taxi.position.copy(dock).setY(dock.y + Math.sin(elapsed * 2) * 0.05);
        taxi.rotation.y = turnTowards(taxi.rotation.y, Math.PI / 2, 1 - Math.exp(-dt * 2));
        taxi.rotation.x *= 1 - Math.min(1, dt * 3);
        if (taxiClock > 6) {
          taxiPhase = "outbound";
          taxiClock = 0;
          notify("speeder-leave");
        }
      }
    },
  };
}
