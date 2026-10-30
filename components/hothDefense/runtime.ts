import * as THREE from "three";
import { createDefenseSimulation } from "./simulation";
import { createHothDefenseWorld } from "./world";
import { createDefenseAudio } from "./audio";
import type { DefenseRecord, DefenseView, Vec3, WeakpointId } from "./types";

const RECORD_KEY = "orbital-defense-of-hoth-v1";
const names: Record<string, string> = { probe: "Droïde sonde", scout: "Éclaireur impérial", tank: "Blindé impérial", atat: "AT-AT" };
const components: Record<WeakpointId, string> = { "left-leg": "Articulation gauche", "right-leg": "Articulation droite", weapons: "Système de tir", command: "Module de commande" };
export function readDefenseRecord(): DefenseRecord {
  try {
    const r = JSON.parse(localStorage.getItem(RECORD_KEY) || "null");
    if (r && typeof r === "object") return { best: Number.isFinite(r.best) ? Math.max(0, Math.min(1e9, r.best)) : 0, badge: r.badge === true, flawless: r.flawless === true, rank: typeof r.rank === "string" ? r.rank.slice(0, 16) : null };
  } catch { /* Storage can be unavailable in private browsing. */ }
  return { best: 0, badge: false, flawless: false, rank: null };
}

export function createHothDefenseRuntime(options: {
  scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer;
  reduced: boolean; sound: boolean; volume: number; onView: (view: DefenseView) => void;
}) {
  const { scene, camera, renderer, onView } = options;
  const simulation = createDefenseSimulation();
  const world = createHothDefenseWorld();
  const prior = { fog: scene.fog, background: scene.background, environment: scene.environmentIntensity, fov: camera.fov, position: camera.position.clone(), rotation: camera.quaternion.clone(), ratio: renderer.getPixelRatio() };
  const lights: { light: THREE.Light; intensity: number; color: THREE.Color }[] = [];
  scene.traverse(o => { if (o instanceof THREE.Light) lights.push({ light: o, intensity: o.intensity, color: o.color.clone() }); });
  scene.add(world.group);
  scene.fog = new THREE.FogExp2(0xa8bfce, .0045);
  scene.background = new THREE.Color(0x9bb4c6);
  scene.environmentIntensity = .3;
  const alert = new THREE.PointLight(0xf4404c, 0, 6, 2); alert.position.set(0, 1.8, .5); scene.add(alert);
  const muzzle = new THREE.PointLight(0x76e4a0, 0, 6); muzzle.position.set(0, .9, -2); scene.add(muzzle);
  let audio: ReturnType<typeof createDefenseAudio> | null = null;
  let sound = options.sound, volume = options.volume, firing = false, zoom = false, disposed = false, recoil = 0, flash = 0, uiClock = 1, ratioClock = 0, slow = 0, saved = false, side = 1;
  // Combat mode: the cockpit's light turns red over a few seconds from launch; the alarm sounds at start.
  let clock = 0, combatBlend = options.reduced ? 1 : 0, alarmUntil = -1, glare = 0, hurt = 0, fog = .0045;
  const alertRed = new THREE.Color(0xff2a35);
  let record = readDefenseRecord(), target: string | null = null;
  const aim = new THREE.Vector2(0, .12), raycaster = new THREE.Raycaster(), sphere = new THREE.Sphere(), intersection = new THREE.Vector3(), point = new THREE.Vector3(), origin = new THREE.Vector3(), direction = new THREE.Vector3();
  const quiet = () => { firing = false; zoom = false; };
  const publish = () => {
    const state = simulation.state, boss = state.enemies.find(e => e.kind === "atat" && e.alive);
    onView({ ...state, enemies: state.enemies.filter(e => e.alive).map(e => ({ id: e.id, kind: e.kind, x: e.position[0], z: e.position[2], hp: e.hp, maxHp: e.maxHp })), boss: boss ? { hp: boss.hp, maxHp: boss.maxHp, weakpoints: boss.weakpoints.map(w => ({ id: w.id, hp: w.hp, maxHp: w.maxHp, vulnerable: w.vulnerable })) } : null, record: { ...record }, zoom, target, aim: [aim.x, aim.y], glare, hurt, alarm: clock < alarmUntil, critical: state.phase === "playing" && (state.base < 25 || state.shields < 25) });
  };
  const ensureAudio = () => {
    if (!audio) audio = createDefenseAudio();
    audio.setVolume(volume); audio.setEnabled(sound);
  };
  const soundAlarm = () => { alarmUntil = clock + 3.6; audio?.alarm(); };
  const start = () => { ensureAudio(); simulation.start(); quiet(); saved = false; soundAlarm(); publish(); };
  const pause = () => { simulation.pause(); quiet(); publish(); };
  const resume = () => { ensureAudio(); simulation.resume(); publish(); };
  const blur = () => { if (["playing", "transition"].includes(simulation.state.phase)) pause(); };
  const visibility = () => { if (document.hidden) blur(); };
  window.addEventListener("blur", blur);
  document.addEventListener("visibilitychange", visibility);
  publish();
  return {
    start, pause, resume,
    restart: () => { ensureAudio(); simulation.restart(); quiet(); saved = false; soundAlarm(); publish(); },
    setAim: (x: number, y: number) => { aim.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1)); },
    setFiring: (held: boolean) => { firing = held; },
    toggleZoom: () => { if (simulation.state.phase === "playing") { zoom = !zoom; publish(); } },
    special: () => { simulation.special(); }, cool: () => { simulation.cool(); },
    togglePause: () => { if (simulation.state.phase === "paused") resume(); else pause(); },
    nudge: (x: number, y: number) => { aim.x = THREE.MathUtils.clamp(aim.x + x, -1, 1); aim.y = THREE.MathUtils.clamp(aim.y + y, -1, 1); },
    setSound: (enabled: boolean) => { sound = enabled; if (enabled) ensureAudio(); audio?.setEnabled(enabled); },
    setVolume: (level: number) => { volume = THREE.MathUtils.clamp(level, 0, 1); audio?.setVolume(volume); },
    tick: (dt: number, reduced: boolean) => {
      if (disposed) return;
      const state = simulation.state;
      const playing = state.phase === "playing", frozen = state.phase === "paused";
      if (!frozen) camera.fov = THREE.MathUtils.damp(camera.fov, zoom ? (camera.aspect < .8 ? 64 : 32) : camera.aspect < .8 ? 88 : 58, 10, dt);
      camera.updateProjectionMatrix();
      if (!reduced) {
        camera.rotateY(-aim.x * .1);
        camera.position.x += Math.sin(state.time * 17) * recoil * .018;
        camera.position.y += Math.cos(state.time * 21) * recoil * .012;
      }
      camera.updateMatrixWorld();
      raycaster.setFromCamera(aim, camera);
      target = null;
      let nearest = Infinity;
      for (const enemy of state.enemies) {
        if (!enemy.alive) continue;
        const points = enemy.kind === "atat" ? enemy.weakpoints.filter(w => w.hp > 0) : [{ position: enemy.position, radius: enemy.radius, vulnerable: true, id: null }];
        for (const weak of points) {
          sphere.center.fromArray(weak.position);
          if (enemy.kind !== "probe" && enemy.kind !== "atat") sphere.center.y += 1.5;
          sphere.radius = weak.radius;
          if (raycaster.ray.intersectSphere(sphere, intersection)) {
            const d = intersection.distanceTo(camera.position);
            if (d < nearest) { nearest = d; target = weak.id ? `${components[weak.id]}${weak.vulnerable ? "" : " · blindé"}` : names[enemy.kind]; }
          }
        }
      }
      if (playing && firing) {
        point.copy(raycaster.ray.direction).multiplyScalar(Number.isFinite(nearest) ? nearest + 1 : 180).add(camera.position);
        origin.set(side * .72, .85, -3);
        direction.copy(point).sub(origin).normalize();
        if (simulation.fire(origin.toArray() as Vec3, direction.toArray() as Vec3)) side *= -1;
      }
      simulation.step(frozen ? 0 : dt);
      const events = simulation.drainEvents();
      for (const event of events) {
        audio?.play(event);
        if (event.type === "explosion") glare = Math.max(glare, (event.amount ?? 1) >= 4 ? 1 : .45);
        if (event.type === "damage" && event.target === "ship") hurt = 1;
        if (event.type === "shot" && !event.target) { recoil = Math.max(recoil, .2); flash = 1; }
        if (event.type === "boss" || event.type === "step") recoil = Math.max(recoil, event.type === "boss" ? .8 : .4);
        if (event.type === "damage") recoil = .75;
      }
      if (!frozen) {
        recoil = THREE.MathUtils.damp(recoil, 0, 5, dt);
        flash = THREE.MathUtils.damp(flash, 0, 24, dt);
      }
      clock += dt;
      combatBlend = reduced ? 1 : Math.min(1, combatBlend + dt / 2.5);
      const critical = state.phase === "playing" && (state.base < 25 || state.shields < 25);
      // A rotating beacon while the alarm sounds and in critical moments, then a steady red glow.
      const beacon = !reduced && (clock < alarmUntil || critical) ? Math.max(0, Math.sin(clock * (critical ? 9 : 7))) * 7 : 0;
      alert.intensity = 2 * combatBlend + beacon;
      muzzle.intensity = reduced ? 0 : flash * 3;
      for (const item of lights) {
        item.light.intensity = item.intensity * THREE.MathUtils.lerp(1, .45, combatBlend);
        item.light.color.copy(item.color).lerp(alertRed, .35 * combatBlend);
      }
      // The blizzard thickens as the AT-AT approaches, and its silhouette emerges as it clears.
      let fogGoal = .0045 + (reduced ? 0 : Math.sin(clock * .23) * .0006 + Math.sin(clock * .61) * .0003);
      if (state.wave === 3 && state.phase === "transition") fogGoal = .012;
      else if (state.wave === 3 && state.phase === "playing") fogGoal += Math.max(0, .0075 * (1 - state.phaseTime / 14));
      fog = THREE.MathUtils.damp(fog, fogGoal, 1.2, frozen ? 0 : dt);
      if (scene.fog instanceof THREE.FogExp2) scene.fog.density = fog;
      glare = THREE.MathUtils.damp(glare, 0, 3, frozen ? 0 : dt);
      hurt = THREE.MathUtils.damp(hurt, 0, 4, frozen ? 0 : dt);
      world.update(state, events, frozen ? 0 : dt, reduced);
      audio?.tick(state, frozen ? 0 : dt);
      if (!saved && state.phase === "victory") {
        saved = true;
        record = { best: Math.max(record.best, state.score), badge: true, flawless: record.flawless || state.totalDamage === 0, rank: state.score >= record.best ? state.rank : record.rank };
        try { localStorage.setItem(RECORD_KEY, JSON.stringify(record)); } catch { /* Keep this visit's record in memory. */ }
      }
      if (state.phase === "victory" || state.phase === "defeat") firing = false;
      if ((uiClock += dt) >= .08) { uiClock = 0; publish(); }
      if (!frozen && (ratioClock += dt) > 4) {
        if (dt > .038) slow++; else slow = Math.max(0, slow - 1);
        if (slow > 5) { renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() - .2)); world.setQuality(1); slow = 0; }
      }
    },
    dispose: () => {
      if (disposed) return;
      disposed = true; quiet();
      window.removeEventListener("blur", blur); document.removeEventListener("visibilitychange", visibility);
      audio?.dispose(); world.group.removeFromParent(); world.dispose(); alert.removeFromParent(); muzzle.removeFromParent();
      scene.fog = prior.fog; scene.background = prior.background; scene.environmentIntensity = prior.environment;
      camera.fov = prior.fov; camera.position.copy(prior.position); camera.quaternion.copy(prior.rotation); camera.updateProjectionMatrix();
      renderer.setPixelRatio(prior.ratio);
      for (const item of lights) { item.light.intensity = item.intensity; item.light.color.copy(item.color); }
    },
  };
}
export type HothDefenseRuntime = ReturnType<typeof createHothDefenseRuntime>;
