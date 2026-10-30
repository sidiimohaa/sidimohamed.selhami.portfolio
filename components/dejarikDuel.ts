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
    },
  };
}
