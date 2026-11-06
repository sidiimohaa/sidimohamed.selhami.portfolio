import * as THREE from "three";
import { createStandingHuman, type Human, type HumanLook } from "./humanFigure";
import { part } from "./tatooineCharacters";

// The people of Echo Base's command centre, dressed for an ice planet as in the film: quilted thermal
// vests over padded jackets, snow boots with gaiters, headsets on the controllers, the general in his
// dark uniform, a snowspeeder pilot in orange, a trooper in white with goggles and rifle.

const cloth = (color: number, roughness = 0.92) => {
  const material = new THREE.MeshStandardMaterial({ color, roughness });
  material.userData.surfaceKind = "cloth";
  return material;
};
const hard = (color: number, roughness = 0.5, metalness = 0.3) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
type Parts = Parameters<NonNullable<Parameters<typeof createStandingHuman>[1]>>[0];
type Shapes = Parameters<NonNullable<Parameters<typeof createStandingHuman>[1]>>[1];
type XYZ = [number, number, number];

// A quilted vest: padded ribs round the chest and a stand-up collar.
function vest(parts: Parts, s: Shapes, color: number, collar = color) {
  const padding = cloth(color);
  for (let i = 0; i < 6; i++) s.box(parts.body, [0, 1.13 + i * 0.056, -0.005], [0.385 - Math.abs(i - 3) * 0.008, 0.05, 0.228], padding, 0.024);
  s.box(parts.body, [0, 1.285, 0.117], [0.022, 0.32, 0.008], cloth(new THREE.Color(color).multiplyScalar(0.55).getHex()), 0.002);
  s.box(parts.body, [0, 1.44, -0.005], [0.21, 0.055, 0.17], cloth(collar), 0.024);
}
// A hood let down on the shoulders, lined with pale fur.
function hood(parts: Parts, s: Shapes, color: number) {
  s.ball(parts.body, [0, 1.445, -0.115], [0.155, 0.075, 0.085], cloth(color));
  s.ball(parts.body, [0, 1.47, -0.075], [0.125, 0.04, 0.06], cloth(0xdcd6c6, 1));
}
// Quilted snow boots: a gaiter round each shin.
function gaiters(parts: Parts, s: Shapes, color: number) {
  const gaiter = cloth(color);
  parts.legs.forEach((leg) => {
    for (let i = 0; i < 3; i++) s.rod(leg.joint, [0, -0.14 - i * 0.09, 0], [0, -0.21 - i * 0.09, 0.002], 0.066, 0.062, gaiter);
  });
}
// A wide belt with pouches and a comlink.
function pouches(parts: Parts, s: Shapes, color = 0x3a2c1e) {
  const leather = cloth(color, 0.75);
  for (const x of [-0.13, -0.05, 0.1]) s.box(parts.body, [x, 1.015, 0.115], [0.06, 0.07, 0.04], leather, 0.012);
  s.box(parts.body, [0.18, 1.02, 0], [0.03, 0.09, 0.09], hard(0x23262a), 0.008);
}
// The controllers' headset: an ear cup and a boom to the mouth.
function headset(parts: Parts, s: Shapes) {
  const plastic = hard(0x16181a, 0.45, 0.2);
  s.ball(parts.head, [0.112, 0.02, 0], [0.018, 0.038, 0.03], plastic);
  s.rod(parts.head, [0.11, 0.06, 0], [-0.03, 0.155, 0], 0.006, 0.006, plastic);
  s.rod(parts.head, [-0.03, 0.155, 0], [-0.108, 0.06, 0], 0.006, 0.006, plastic);
  s.rod(parts.head, [0.112, 0, 0.01], [0.055, -0.075, 0.09], 0.004, 0.004, plastic);
  s.ball(parts.head, [0.052, -0.078, 0.092], [0.011, 0.009, 0.009], plastic);
}
// Colour squares of rank on the chest, as Alliance officers wear them.
function rank(parts: Parts, s: Shapes, colors: number[]) {
  s.box(parts.body, [-0.09, 1.34, 0.118], [0.1, 0.03, 0.006], hard(0x101214), 0.002);
  colors.forEach((color, i) => s.box(parts.body, [-0.125 + i * 0.024, 1.34, 0.123], [0.015, 0.015, 0.003], new THREE.MeshBasicMaterial({ color, toneMapped: false }), 0.001));
}

function figure(look: HumanLook, dress: (parts: Parts, s: Shapes) => void) {
  return createStandingHuman(look, dress);
}
export function createGeneral() {
  // Grey-haired, in the dark padded uniform of the base's commander.
  return figure({ name: "echo-general", skin: 0xd3af95, hair: 0xa6a29a, iris: 0x4c5660, hairStyle: "short", tunic: 0x4b5057, sleeves: 0x43484e, trousers: 0x3a3e44, boots: 0x15130f, belt: 0x17161a }, (parts, s) => {
    vest(parts, s, 0x565b62, 0x3a3e44);
    rank(parts, s, [0xc23a2c, 0xc23a2c, 0x3f7fc4, 0xe0c060]);
    pouches(parts, s, 0x17161a);
  });
}
export function createController() {
  // The base's controller at the main board: hair pinned up, a thermal vest and her headset.
  return figure({ name: "echo-controller", skin: 0xc99b7c, hair: 0x4a2c18, iris: 0x35241a, hairStyle: "short", tunic: 0xa4987c, sleeves: 0x8f846a, trousers: 0x5c5848, boots: 0x2a221a, belt: 0x2c2118 }, (parts, s) => {
    vest(parts, s, 0xbcb092, 0x8f846a);
    headset(parts, s);
    s.ball(parts.head, [0, 0.11, -0.12], [0.06, 0.055, 0.055], cloth(0x4a2c18));
    rank(parts, s, [0x3f7fc4, 0xc23a2c]);
    pouches(parts, s);
  });
}
export function createTechnician(variant: number) {
  const tones: [number, number, number][] = [
    [0x8a5e42, 0xb5a67f, 0x4f4b3e],
    [0xe0bda0, 0xa39a80, 0x46443a],
    [0xc99a7c, 0xbfb49a, 0x57523f],
  ];
  const [skin, parka, trousers] = tones[variant % tones.length];
  // A padded beige parka with its hood down, and white snow boots.
  return figure({ name: "echo-technician", skin, hair: variant % 2 ? 0x6b4a2c : 0x1c1612, iris: 0x35241a, hairStyle: variant === 1 ? "swept" : "short", tunic: parka, trousers, boots: 0xc9c6bc, belt: 0x33291e, gloves: 0x4b4032 }, (parts, s) => {
    vest(parts, s, new THREE.Color(parka).multiplyScalar(0.86).getHex());
    hood(parts, s, parka);
    gaiters(parts, s, 0xc9c6bc);
    headset(parts, s);
    pouches(parts, s);
  });
}
export function createPilot() {
  // A snowspeeder pilot, come in from the line: orange suit, white vest and tubes, helmet in hand.
  const white = cloth(0xdcd8cd, 0.8);
  const human = figure({ name: "echo-pilot", skin: 0xd6b39a, hair: 0x7a4f2a, iris: 0x3a4a30, hairStyle: "swept", tunic: 0xc4622c, sleeves: 0xc4622c, trousers: 0xb9582a, boots: 0x201a14, belt: 0x201a14, gloves: 0x201a14 }, (parts, s) => {
    for (let i = 0; i < 4; i++) s.box(parts.body, [0, 1.17 + i * 0.075, 0], [0.34, 0.066, 0.215], white, 0.02);
    s.box(parts.body, [0, 1.25, 0.122], [0.13, 0.12, 0.03], hard(0x2a2d30), 0.012);
    s.rod(parts.body, [-0.05, 1.3, 0.13], [-0.13, 1.42, 0.09], 0.012, 0.012, hard(0x8a8f92));
    s.rod(parts.body, [0.05, 1.3, 0.13], [0.13, 1.42, 0.09], 0.012, 0.012, hard(0x8a8f92));
    // The helmet at his hip, its stripes and dark visor.
    const hand = parts.arms[1].joint;
    s.ball(hand, [0.02, -0.4, 0.09], [0.125, 0.12, 0.13], hard(0xdcd8cd, 0.35, 0.1));
    s.box(hand, [0.02, -0.39, 0.205], [0.17, 0.05, 0.03], hard(0x101214, 0.15, 0.5), 0.01);
    s.box(hand, [0.02, -0.29, 0.09], [0.03, 0.012, 0.2], new THREE.MeshBasicMaterial({ color: 0xc4622c }), 0.003);
  });
  return human;
}
export function createSnowTrooper() {
  // Base guard in white: quilted coat skirts, helmet with visor and goggles, A280 across the chest.
  return figure({ name: "echo-trooper", skin: 0xbf9278, hair: 0x1c1612, iris: 0x35241a, hairStyle: "short", tunic: 0xd4d2c8, sleeves: 0xc6c4ba, trousers: 0xb9b8ae, boots: 0xd4d2c8, belt: 0x3a2c1e, gloves: 0x3f3a30 }, (parts, s) => {
    vest(parts, s, 0xcfccc0, 0xb9b8ae);
    gaiters(parts, s, 0xd8d6cc);
    pouches(parts, s);
    const shell = hard(0xbdbcb2, 0.55, 0.15);
    s.ball(parts.head, [0, 0.062, -0.008], [0.128, 0.118, 0.13], shell);
    s.box(parts.head, [0, 0.135, 0.105], [0.21, 0.018, 0.08], shell, 0.006);
    s.box(parts.head, [0, 0.03, 0.105], [0.19, 0.06, 0.03], hard(0x0f1113, 0.2, 0.6), 0.012);
    s.box(parts.head, [0, 0.03, 0], [0.23, 0.02, 0.2], hard(0x24201a, 0.8, 0), 0.006);
    s.box(parts.head, [0, -0.1, 0.05], [0.17, 0.09, 0.15], cloth(0xc6c4ba), 0.04);
    s.box(parts.body, [0, 1.25, -0.15], [0.3, 0.32, 0.1], hard(0x6b6a60, 0.7, 0.2), 0.02);
    // The rifle, held slantwise, on the group so the arms can stay where they are.
    const steel = hard(0x24262a, 0.45, 0.65);
    s.rod(parts.group as unknown as THREE.Group, [-0.2, 1.05, 0.19], [0.28, 1.34, 0.21], 0.02, 0.02, steel);
    s.rod(parts.group as unknown as THREE.Group, [0.26, 1.33, 0.21], [0.5, 1.48, 0.22], 0.008, 0.008, steel);
    s.box(parts.group as unknown as THREE.Group, [-0.14, 1.08, 0.19], [0.08, 0.05, 0.05], steel, 0.01);
  });
}
/** A datapad carried in the hand of whoever walks about. */
export function giveDatapad(human: Human) {
  const pad = part(human.arms[0].joint, new THREE.BoxGeometry(0.14, 0.2, 0.012), hard(0x1b1d20));
  pad.position.set(0, -0.32, 0.09);
  pad.rotation.x = 0.8;
  const screen = part(human.arms[0].joint, new THREE.PlaneGeometry(0.11, 0.16), new THREE.MeshBasicMaterial({ color: 0x7fd0f5, toneMapped: false }));
  screen.position.set(0, -0.316, 0.097);
  screen.rotation.x = 0.8 - Math.PI / 2 + Math.PI / 2;
}
export type { XYZ };
