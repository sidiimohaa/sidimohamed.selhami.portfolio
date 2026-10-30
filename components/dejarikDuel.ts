import * as THREE from "three";
import { createDejarikTable } from "./dejarikTable";
import { createSeatedHanSolo } from "./hanSoloModel";
import { createSeatedChewbacca } from "./chewbaccaModel";

/** Han and Chewie take turns at the south booth, in table-local coordinates. */
export function createDejarikDuel() {
  const table = createDejarikTable();
  const group = new THREE.Group();
  group.name = "cantina-han-chewbacca-dejarik";
  const han = createSeatedHanSolo(.55), chewie = createSeatedChewbacca(.55);
  han.group.position.z = -1.1;
  chewie.group.position.z = 1.1;
  chewie.group.rotation.y = Math.PI;
  group.add(table.group, han.group, chewie.group);
  const objects = [...table.objects];
  for (const player of [han, chewie]) player.group.traverse(object => {
    if (object instanceof THREE.Mesh) objects.push(object);
  });
  let clock = 0, nextTurn = 4, started = -Infinity, turn = 0, active = false;
  let last = 0;
  const mood = { look: 0, smug: 0, annoyed: 0, roar: 0, proud: 0 };
  const activate = (reduced: boolean) => {
    if (active) return;
    table.activate(reduced);
    started = clock;
    turn++;
    active = !reduced;
    nextTurn = clock + 8.5;
  };
  return {
    group, objects, activate,
    tick: (time: number, reduced: boolean) => {
      clock = time;
      table.tick(time, reduced);
      han.tick(time, reduced);
      chewie.tick(time, reduced);
      if (reduced) {
        active = false;
        nextTurn = time + 8.5;
        han.play(0); chewie.play(0);
        han.react({ look: 0, smug: 0, annoyed: 0 });
        chewie.react({ look: 0, roar: 0, proud: 0 });
        return;
      }
      const age = Math.max(0, time - started);
      if (active && age >= 2.7) active = false;
      if (!active && time >= nextTurn) activate(false);
      const elapsed = Math.max(0, time - started);
      const reach = active && elapsed < 1.2 ? Math.sin(elapsed / 1.2 * Math.PI) : 0;
      const react = active && elapsed > 1.2 ? Math.sin(Math.min(1, (elapsed - 1.2) / 1.5) * Math.PI) * .35 : 0;
      han.play(turn % 2 ? reach : react);
      chewie.play(turn % 2 ? react : reach);
      // Both watch the board while the pieces fight, then the exchange plays out between them:
      // Han gloats and Chewie roars at his move; Chewie nods, pleased, and Han shrugs at his.
      const dt = Math.min(.1, Math.max(0, time - last));
      last = time;
      const after = elapsed - 2.7, outcome = after > 0 && after < 3.4 ? Math.sin(after / 3.4 * Math.PI) : 0;
      const hanWon = turn % 2 === 1, watching = elapsed < 2.7;
      // Between turns they glance up at each other now and then.
      const glance = Math.sin(time * .31) > .6 ? 1 : 0;
      const target = { look: watching ? 0 : Math.max(outcome > .05 ? 1 : 0, glance), smug: hanWon ? outcome : 0, annoyed: hanWon ? 0 : outcome * .9, roar: hanWon ? outcome : 0, proud: hanWon ? 0 : outcome };
      const ease = 1 - Math.exp(-dt * 5);
      (Object.keys(mood) as (keyof typeof mood)[]).forEach(key => mood[key] += (target[key] - mood[key]) * ease);
      han.react({ look: mood.look, smug: mood.smug, annoyed: mood.annoyed });
      chewie.react({ look: mood.look, roar: mood.roar, proud: mood.proud });
    },
  };
}
