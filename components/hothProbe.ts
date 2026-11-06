import * as THREE from "three";
import { galaxyAudio } from "./galaxy/audio";
import { hideSignalMarker, showSignalMarker } from "./galaxy/signalMarker";
import { galaxy } from "./galaxy/store";
import { glowTexture } from "./landingKit";
import { createProbeDroid } from "./probeDroid";

// The probe droid that finds Echo Base. When its event runs it comes in over the ridge and hovers
// off the hangar mouth; a marker on screen leads the visitor out to it. Once they are close, a bolt
// comes from the trench by the mouth, and the droid destroys itself, as it does in the film.

const HOVER = new THREE.Vector3(9, 7.5, 58);
const REACH = 24;
const EVENT = "hoth-probe";

export function createHothProbe() {
  const droid = createProbeDroid();
  droid.group.scale.setScalar(4);
  droid.group.visible = false;
  const group = new THREE.Group();
  group.name = "hoth-probe";
  group.add(droid.group);
  const path = new THREE.CatmullRomCurve3([new THREE.Vector3(-260, 44, 250), new THREE.Vector3(-110, 30, 150), new THREE.Vector3(-20, 16, 90), HOVER.clone()]);
  const glow = glowTexture();
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffc27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  flash.visible = false;
  group.add(flash);
  const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 6), new THREE.MeshBasicMaterial({ color: 0xff5a4a, toneMapped: false, fog: false }));
  bolt.visible = false;
  group.add(bolt);
  const smoke = Array.from({ length: 6 }, () => {
    const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x3a3f44, transparent: true, depthWrite: false, opacity: 0 }));
    puff.visible = false;
    group.add(puff);
    return puff;
  });
  const from = new THREE.Vector3(-7, 1.6, 36),
    scratch = new THREE.Vector3();
  let key = -1,
    age = 0,
    shot = -1,
    boom = -1,
    camera: THREE.Camera | null = null;
  return {
    group,
    attachCamera: (view: THREE.Camera) => (camera = view),
    /** Where the droid is, while there is one to see: for the radar. */
    position: () => (droid.group.visible ? droid.group.position : null),
    tick(dt: number, elapsed: number, reduced: boolean, walker: { x: number; z: number }, floor: number) {
      const run = galaxy().activeAt("hoth").find((item) => item.id === EVENT);
      if (run && run.key !== key) {
        key = run.key;
        age = 0;
        shot = boom = -1;
        droid.group.visible = true;
      }
      droid.tick(elapsed, reduced);
      if (run && shot < 0) {
        age += dt;
        const k = Math.min(1, age / 11);
        path.getPointAt(reduced ? 1 : k * k * (3 - 2 * k), droid.group.position);
        if (k >= 1 && !reduced) {
          droid.group.position.x += Math.sin(elapsed * 0.5) * 2.4;
          droid.group.position.y += Math.sin(elapsed * 0.9) * 0.6;
          droid.group.position.z += Math.cos(elapsed * 0.37) * 1.6;
        }
        droid.group.rotation.y = elapsed * 0.3;
        const away = Math.hypot(droid.group.position.x - walker.x, droid.group.position.z - walker.z);
        if (k >= 1 && away < REACH) {
          shot = 0;
          bolt.visible = true;
          bolt.position.copy(from);
          bolt.lookAt(droid.group.position);
        }
        if (camera) {
          scratch.copy(droid.group.position).applyMatrix4(camera.matrixWorldInverse);
          const behind = scratch.z > 0;
          scratch.copy(droid.group.position).project(camera);
          showSignalMarker(scratch.x, scratch.y, behind, `Sonde impériale · ${Math.round(away)} m`);
        }
      } else if (shot < 0) {
        droid.group.visible = false;
        hideSignalMarker();
      }
      // The bolt, then the droid blows itself up: the event is over and its report comes in.
      if (shot >= 0) {
        hideSignalMarker();
        if (boom < 0) {
          shot += dt;
          const reach = Math.min(1, shot / 0.45);
          bolt.position.lerpVectors(from, droid.group.position, reach);
          if (reach >= 1 || reduced) {
            boom = 0;
            bolt.visible = false;
            droid.group.visible = false;
            flash.visible = !reduced;
            flash.position.copy(droid.group.position);
            smoke.forEach((puff, i) => {
              puff.visible = !reduced;
              puff.position.copy(droid.group.position).add(scratch.set(Math.sin(i * 2.1) * 1.2, i * 0.3, Math.cos(i * 2.1) * 1.2));
            });
            galaxyAudio.thunder(0.5);
            galaxy().found(EVENT);
          }
        } else if (flash.visible || smoke[0].visible) {
          boom += dt;
          flash.scale.setScalar(6 + boom * 30);
          flash.material.opacity = Math.max(0, 1 - boom * 1.6);
          if (boom > 0.7) flash.visible = false;
          smoke.forEach((puff, i) => {
            puff.position.y += dt * (0.6 + i * 0.12);
            puff.scale.setScalar(3 + boom * 3);
            puff.material.opacity = Math.max(0, 0.26 - boom * 0.055);
            if (boom > 5) puff.visible = false;
          });
        }
      }
      void floor;
    },
  };
}
