import * as THREE from "three";
import { CORUSCANT_LANDMARKS } from "../coruscantSkyline";
import { vehicleGeometry } from "../coruscantTaxi/taxiTraffic";
import { galaxyAudio } from "./audio";
import { cityUniforms, setCityOutage, setCityStorm, strikeLightning } from "./cityEnv";
import type { ActiveEvent } from "./director";
import { galaxy } from "./store";

// Coruscant's five events, drawn wherever the visitor is in the city: on the platform or in the
// taxi. Everything arrives from the haze and leaves into it, and the shared sky carries the rest.

export type CityEffects = { traffic: number; power: number; alert: boolean; fog: number };
const calm = (): CityEffects => ({ traffic: 1, power: 1, alert: false, fog: 1 });

function flyer(kind: "speeder" | "shuttle", paint: number, glow: THREE.Texture, lights: number[]) {
  const material = new THREE.MeshStandardMaterial({ color: paint, vertexColors: true, metalness: 0.45, roughness: 0.42 });
  const root = new THREE.Group();
  root.add(new THREE.Mesh(vehicleGeometry(kind), material));
  const beacons = lights.map((color, i) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.position.set(i % 2 ? 0.7 : -0.7, 1.3, 0.2);
    sprite.scale.setScalar(3.4);
    root.add(sprite);
    return sprite;
  });
  root.visible = false;
  return { root, beacons };
}

function alertPanel() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "rgba(60,4,4,.7)";
  c.fillRect(0, 0, 512, 256);
  c.strokeStyle = "#ff5a4a";
  c.lineWidth = 8;
  c.strokeRect(10, 10, 492, 236);
  c.fillStyle = "#ffe2dc";
  c.font = "bold 62px Arial, Helvetica, sans-serif";
  c.fillText("ALERTE", 40, 100);
  c.font = "30px SFMono-Regular, Consolas, monospace";
  c.fillStyle = "#ff9d8c";
  c.fillText("SÉCURITÉ DE CORUSCANT", 40, 152);
  c.fillText("COULOIRS DÉVIÉS", 40, 196);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function rainLayer(count: number) {
  const position = new Float32Array(count * 6),
    end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = Math.random(), y = Math.random(), z = Math.random();
    position.set([x, y, z, x, y, z], i * 6);
    end[i * 2 + 1] = 1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("tip", new THREE.BufferAttribute(end, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, centre: { value: new THREE.Vector3() }, level: { value: 0 } },
    vertexShader: `attribute float tip;uniform float time;uniform vec3 centre;varying float vTip;
      void main(){
        const vec3 box=vec3(70.,46.,70.);
        vec3 p=mod(position*box+vec3(time*5.,-time*42.,time*2.),box)-box*.5;
        p+=vec3(.12,-1.,.05)*tip*1.5;
        vTip=tip;
        gl_Position=projectionMatrix*viewMatrix*vec4(p+centre,1.);
      }`,
    fragmentShader: `uniform float level;varying float vTip;void main(){gl_FragColor=vec4(.72,.8,.95,(.06+.2*vTip)*level);}`,
    transparent: true,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  lines.visible = false;
  return { lines, material };
}

/** The neighbouring platform where official shuttles set down. */
function envoyPlatform(at: THREE.Vector3, glow: THREE.Texture) {
  const group = new THREE.Group();
  group.position.copy(at);
  const metal = new THREE.MeshStandardMaterial({ color: 0x2f333c, metalness: 0.7, roughness: 0.45 });
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(11.5, 9.5, 1.2, 32), metal);
  deck.position.y = -0.6;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 5.5, 180, 16), metal);
  column.position.y = -91;
  const kiosk = new THREE.Mesh(new THREE.BoxGeometry(3, 3.2, 2.4), metal);
  kiosk.position.set(0, 1.6, -9);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(11.3, 0.1, 6, 48).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd9a8, toneMapped: false }));
  const lamps = Array.from({ length: 8 }, (_, i) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x8fd8ff, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }));
    const a = (i / 8) * Math.PI * 2;
    sprite.position.set(Math.cos(a) * 10.2, 0.5, Math.sin(a) * 10.2);
    sprite.scale.setScalar(1.8);
    return sprite;
  });
  // The honour guard: plain robed figures, seen from across the gap, not close up.
  const robe = new THREE.MeshStandardMaterial({ color: 0x8e2a2e, roughness: 0.7 });
  const guards = Array.from({ length: 6 }, (_, i) => {
    const guard = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.25, 3, 8), robe);
    body.position.y = 0.95;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), robe);
    head.position.y = 1.95;
    guard.add(body, head);
    guard.visible = false;
    const side = i % 2 ? 1 : -1;
    return { guard, post: new THREE.Vector3(side * 2.8, 0, -6 + Math.floor(i / 2) * 4.4) };
  });
  group.add(deck, column, kiosk, rim, ...lamps, ...guards.map((item) => item.guard));
  return { group, lamps, guards, at };
}

export function createCityEvents(options: { glow: THREE.Texture; rain: number; platform?: THREE.Vector3; yaw?: () => number }) {
  const { glow } = options;
  const group = new THREE.Group();
  group.name = "city-events";
  const suspect = flyer("speeder", 0xc2462e, glow, [0xffa050]);
  const police = [flyer("speeder", 0x2a3c66, glow, [0xff3030, 0x3a70ff]), flyer("speeder", 0x2a3c66, glow, [0xff3030, 0x3a70ff])];
  const patrols = [flyer("speeder", 0x2a3c66, glow, [0xff3030, 0x3a70ff]), flyer("speeder", 0x2a3c66, glow, [0xff3030, 0x3a70ff])];
  const envoyShip = flyer("shuttle", 0xd8d2bc, glow, [0xbfe6ff, 0xbfe6ff]);
  envoyShip.root.scale.setScalar(1.9);
  police[0].root.name = "chase-police";
  patrols[0].root.name = "alert-patrol";
  group.add(suspect.root, ...police.map((p) => p.root), ...patrols.map((p) => p.root), envoyShip.root);
  const rain = rainLayer(options.rain);
  group.add(rain.lines);
  const platform = options.platform ? envoyPlatform(options.platform, glow) : null;
  if (platform) group.add(platform.group);
  // Alert panels on the nearest towers, shown only during an alert.
  const panelMap = options.platform ? alertPanel() : null;
  const panels = panelMap
    ? [...CORUSCANT_LANDMARKS].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)).slice(0, 4).map((mark, i) => {
        const reach = Math.hypot(mark.x, mark.z) || 1;
        const material = new THREE.MeshBasicMaterial({ map: panelMap, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
        const scale = 0.12 * Math.max(180, reach);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * scale, scale), material);
        mesh.position.set(mark.x * (1 - (mark.r + 2) / reach), 44 + i * 6, mark.z * (1 - (mark.r + 2) / reach));
        mesh.lookAt(0, mesh.position.y * 0.5, 0);
        mesh.visible = false;
        group.add(mesh);
        return { mesh, material };
      })
    : [];

  const seen = new Map<number, string>();
  const chase = { curve: null as THREE.CatmullRomCurve3 | null, t: 0, length: 1, wait: 0, wanted: false };
  let nextStrike = 4;
  const at = new THREE.Vector3(), ahead = new THREE.Vector3(), lookAtPoint = new THREE.Vector3();
  const effects = calm();

  const flash = (item: ReturnType<typeof flyer>, elapsed: number, reduced: boolean) => {
    item.beacons.forEach((sprite, i) => {
      sprite.material.opacity = reduced ? 0.8 : Math.sin(elapsed * 22 + i * Math.PI) > 0 ? 1 : 0.08;
    });
  };
  const newPass = (viewer: THREE.Vector3) => {
    const a = Math.random() * Math.PI * 2,
      dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)),
      across = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(Math.random() < 0.5 ? -1 : 1),
      near = viewer.clone().addScaledVector(across, 58 + Math.random() * 70);
    near.y = viewer.y + 2 + Math.random() * 26;
    chase.curve = new THREE.CatmullRomCurve3([
      near.clone().addScaledVector(dir, -620).addScaledVector(across, 90).setY(near.y + 46),
      near.clone().addScaledVector(dir, -240).addScaledVector(across, 26).setY(near.y + 14),
      near.clone(),
      near.clone().addScaledVector(dir, 240).addScaledVector(across, 34).setY(near.y - 8),
      near.clone().addScaledVector(dir, 640).addScaledVector(across, 110).setY(near.y - 30),
    ]);
    chase.length = chase.curve.getLength();
    chase.t = 0;
  };
  const putOnCurve = (item: ReturnType<typeof flyer>, d: number) => {
    const curve = chase.curve!;
    if (d < 0 || d > chase.length - 1) return (item.root.visible = false);
    item.root.visible = true;
    curve.getPointAt(d / chase.length, at);
    curve.getPointAt(Math.min(1, (d + 2) / chase.length), ahead);
    item.root.position.copy(at);
    item.root.lookAt(ahead);
    return true;
  };

  return {
    group,
    /** Draws what is active and says what it changes for traffic and holograms. */
    tick(dt: number, elapsed: number, reduced: boolean, viewer: THREE.Vector3, yaw: number, runs: ActiveEvent[]): CityEffects {
      const has = (id: string) => runs.find((run) => run.id === id);
      Object.assign(effects, calm());
      const keys = new Set(runs.map((run) => run.key));
      for (const [key, id] of seen) {
        if (keys.has(key)) continue;
        seen.delete(key);
        // Those who stayed to the end learn what it was about.
        galaxy().witness(id);
      }
      runs.forEach((run) => seen.set(run.key, run.id));

      // A: chase. Passes follow one another; the last one is flown to its end before it stops.
      chase.wanted = !!has("city-chase");
      let chaseLevel = 0;
      if (chase.curve || chase.wanted) {
        if (!chase.curve && (chase.wait -= dt) <= 0) newPass(viewer);
        if (chase.curve) {
          chase.t += (reduced ? 40 : 96) * dt;
          putOnCurve(suspect, chase.t);
          putOnCurve(police[0], chase.t - 34);
          putOnCurve(police[1], chase.t - 66);
          flash(police[0], elapsed, reduced);
          flash(police[1], elapsed, reduced);
          flash(suspect, elapsed * 0.3, reduced);
          if (police[0].root.visible) {
            const gap = police[0].root.position.distanceTo(viewer);
            chaseLevel = Math.max(0, 1 - gap / 520);
          }
          if (chase.t - 66 > chase.length) {
            chase.curve = null;
            chase.wait = 3 + Math.random() * 3;
            [suspect, ...police].forEach((item) => (item.root.visible = false));
          }
        }
      }

      // B: alert. Panels and patrols; the traffic gets out of the way.
      const alert = has("city-alert");
      effects.alert = !!alert;
      let patrolLevel = 0;
      panels.forEach((panel, i) => {
        panel.mesh.visible = !!alert;
        panel.material.opacity = reduced ? 0.9 : 0.72 + 0.28 * (Math.sin(elapsed * 6 + i) > 0 ? 1 : 0.4);
      });
      patrols.forEach((patrol, i) => {
        patrol.root.visible = !!alert;
        if (!alert) return;
        const a = elapsed * 0.26 * (i ? 1 : -1) + i * 2;
        patrol.root.position.set(viewer.x + Math.cos(a) * (120 + i * 45), viewer.y + 16 + i * 12, viewer.z + Math.sin(a) * (120 + i * 45));
        lookAtPoint.set(viewer.x + Math.cos(a + (i ? 0.1 : -0.1)) * (120 + i * 45), patrol.root.position.y, viewer.z + Math.sin(a + (i ? 0.1 : -0.1)) * (120 + i * 45));
        patrol.root.lookAt(lookAtPoint);
        flash(patrol, elapsed, reduced);
        patrolLevel = 0.42;
      });
      if (alert) effects.traffic *= 0.4;

      // D: outage. The shared shader darkens a sector tower by tower; boards stutter.
      const outage = has("city-outage");
      if (outage && cityUniforms.cityOutage.value.w < 0.02) {
        const a = (outage.key * 2.399) % (Math.PI * 2);
        setCityOutage(1, viewer.x + Math.cos(a) * 240, viewer.z + Math.sin(a) * 240, 340);
      } else if (!outage) setCityOutage(0);
      if (outage) {
        effects.traffic *= 0.72;
        effects.power = Math.min(effects.power, 0.55);
      }

      // E: storm. The sky goes dark, rain and lightning, and most traffic lands.
      const storm = has("city-storm");
      setCityStorm(storm ? 1 : 0);
      const stormLevel = cityUniforms.cityStorm.value;
      rain.lines.visible = stormLevel > 0.03 && !reduced;
      if (rain.lines.visible) {
        rain.material.uniforms.level.value = stormLevel;
        rain.material.uniforms.time.value = elapsed;
        rain.material.uniforms.centre.value.copy(viewer);
      }
      if (storm) {
        effects.traffic *= 0.36;
        effects.power = Math.min(effects.power, 0.8);
        effects.fog = 1.55;
        if ((nextStrike -= dt) <= 0 && stormLevel > 0.4) {
          nextStrike = 5 + Math.random() * 9;
          const distance = Math.random();
          strikeLightning(1 - distance * 0.45);
          galaxyAudio.thunder(distance);
        }
      } else effects.fog = 1 + stormLevel * 0.55;

      // C: a diplomatic shuttle sets down on the neighbouring platform.
      const envoy = platform ? has("city-envoy") : undefined;
      if (platform) {
        const life = envoy ? galaxy().now() - envoy.startedAt : 0;
        const span = envoy ? envoy.endsAt - envoy.startedAt : 1;
        envoyShip.root.visible = !!envoy;
        platform.lamps.forEach((lamp, i) => {
          lamp.material.opacity = envoy && !reduced ? 0.25 + 0.75 * Math.max(0, Math.sin(elapsed * 4 - i * 0.8)) : 0.2;
        });
        platform.guards.forEach(({ guard, post }, i) => {
          // They file out of the kiosk once the ship is down, and go back in before it leaves.
          const out = envoy ? THREE.MathUtils.clamp((life - 15 - i * 0.7) / 4, 0, 1) * THREE.MathUtils.clamp((span - 10 - life) / 3, 0, 1) : 0;
          guard.visible = out > 0;
          guard.position.set(post.x * out, 0, -9 + (post.z + 9) * out);
        });
        if (envoy) {
          const down = platform.at.clone().setY(platform.at.y + 0.2);
          const high = platform.at.clone().add(new THREE.Vector3(240, 130, -320));
          const away = platform.at.clone().add(new THREE.Vector3(-280, 150, -260));
          const leave = span - 9;
          if (life < 14) {
            const t = life / 14,
              k = 1 - Math.pow(1 - t, 3);
            at.lerpVectors(high, down, k);
            at.y = THREE.MathUtils.lerp(high.y, down.y, Math.min(1, k * k * 1.02));
            envoyShip.root.position.copy(at);
            lookAtPoint.copy(down).setY(at.y);
            if (t < 0.97) envoyShip.root.lookAt(lookAtPoint);
          } else if (life < leave) envoyShip.root.position.copy(down);
          else {
            const t = THREE.MathUtils.clamp((life - leave) / 9, 0, 1),
              k = t * t;
            at.lerpVectors(down, away, k);
            envoyShip.root.position.copy(at);
            if (t > 0.02) envoyShip.root.lookAt(lookAtPoint.copy(away).setY(at.y + 1));
          }
        }
      }
      // Sirens come from the nearest patrol, panned to where it is against where the visitor looks.
      const sirenLevel = reduced ? 0 : Math.max(chaseLevel, patrolLevel);
      const source = chaseLevel > patrolLevel ? police[0].root.position : patrols[0].root.position;
      const bearing = Math.atan2(source.x - viewer.x, source.z - viewer.z);
      galaxyAudio.siren(sirenLevel, Math.sin(yaw - bearing));
      return effects;
    },
    stop() {
      galaxyAudio.siren(0, 0);
    },
  };
}
