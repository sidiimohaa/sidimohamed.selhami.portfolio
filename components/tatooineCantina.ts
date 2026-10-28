import * as THREE from "three";
import { createCantinaCrowd } from "./cantinaCrowd";
import { glowTexture } from "./landingKit";
import { bakePart, part, pipe, rounded } from "./tatooineCharacters";
export type CantinaWall = {
    minU: number;
    maxU: number;
    minV: number;
    maxV: number;
};
// The room's centre, under the apex of the great dome.
const CENTRE = { u: -13.5, v: 62.5 };
function squareWithHole(size: number, hole: number) {
    const shape = new THREE.Shape();
    shape.moveTo(-size / 2, -size / 2);
    shape.lineTo(size / 2, -size / 2);
    shape.lineTo(size / 2, size / 2);
    shape.lineTo(-size / 2, size / 2);
    shape.closePath();
    const opening = new THREE.Path();
    opening.absarc(0, 0, hole, 0, Math.PI * 2, true);
    shape.holes.push(opening);
    return new THREE.ExtrudeGeometry(shape, { depth: .1, bevelEnabled: false, curveSegments: 48 }).rotateX(-Math.PI / 2);
}
export function createTatooineCantina(adobe: THREE.Material) {
    const group = new THREE.Group();
    group.name = "mos-eisley-cantina";
    const shell = new THREE.Group(), inside = new THREE.Group();
    group.add(shell, inside);
    const plaster = new THREE.MeshStandardMaterial({ color: 0x87634b, map:adobe instanceof THREE.MeshStandardMaterial?adobe.map:null, roughness: .98 });
    const stone = new THREE.MeshStandardMaterial({ color: 0xa88660, roughness: .91 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x302d29, roughness: .66, metalness: .4 });
    const copper = new THREE.MeshStandardMaterial({ color: 0xa7733c, roughness: .34, metalness: .78 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x694136, roughness: .8 });
    const counter = new THREE.MeshStandardMaterial({ color: 0xcac5ad, roughness: .36, metalness: .25, emissive: 0xf4ce93, emissiveIntensity: .18 });
    const glow = new THREE.MeshBasicMaterial({ color: 0xfce5ae });
    const lampRed = new THREE.MeshBasicMaterial({ color: 0xff704f });
    const cupMaterials = [0x66d8b6, 0x5fbcdb, 0xcf71ba].map(color => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .55, metalness: .25, roughness: .27 }));
    const box = (root: THREE.Object3D, mat: THREE.Material, w: number, h: number, d: number, u: number, y: number, v: number, r = .04) => part(root, rounded(w, h, d, r), mat, [u, y, v]);
    const walls: CantinaWall[] = [
        { minU: -22.3, maxU: -21.8, minV: 53.7, maxV: 71.3 },
        { minU: -22.3, maxU: -4.7, minV: 53.7, maxV: 54.3 },
        { minU: -22.3, maxU: -4.7, minV: 70.7, maxV: 71.3 },
        { minU: -5.3, maxU: -4.7, minV: 54, maxV: 60.7 },
        { minU: -5.3, maxU: -4.7, minV: 63.3, maxV: 71 },
        // The porch in front of the door.
        { minU: -4.7, maxU: -3.2, minV: 59.85, maxV: 60.45 },
        { minU: -4.7, maxU: -3.2, minV: 63.55, maxV: 64.15 },
    ];
    walls.forEach((w, i) => box(shell, adobe, w.maxU - w.minU, i > 4 ? 3.4 : 4.8, w.maxV - w.minV, (w.minU + w.maxU) / 2, i > 4 ? 1.7 : 2.35, (w.minV + w.maxV) / 2));
    // A wide arched entrance remains open all the way to the interior.
    box(shell, adobe, .65, 1.9, 2.6, -5, 3.8, 62);
    part(shell, new THREE.TorusGeometry(1.3, .16, 8, 28, Math.PI), stone, [-4.62, 1.55, 62], [0, Math.PI / 2, 0]);
    for (const z of [60.7, 63.3])
        box(shell, stone, .38, 1.55, .3, -4.6, .75, z);
    // A deep porch frames the door, its vaulted lintel carrying the sign.
    box(shell, adobe, 1.5, .95, 4.3, -3.95, 3.4, 62);
    part(shell, new THREE.CylinderGeometry(2.15, 2.15, 1.5, 28, 1, false, 0, Math.PI), adobe, [-3.95, 3.85, 62], [0, 0, Math.PI / 2]).scale.x = .35;
    part(shell, new THREE.TorusGeometry(1.45, .16, 8, 28, Math.PI), stone, [-3.18, 1.45, 62], [0, Math.PI / 2, 0]);
    // Rounded buttresses soften the corners of the square base, set out far enough to stay clear of the room.
    const buttresses = [[-22.85, 53.15], [-22.85, 71.85], [-4.15, 53.15], [-4.15, 71.85]];
    for (const [u, v] of buttresses) {
        part(shell, new THREE.CylinderGeometry(.85, 1.05, 4.9, 20), adobe, [u, 2.45, v]);
        part(shell, new THREE.SphereGeometry(.85, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), adobe, [u, 4.9, v]);
    }
    // The great dome, the cantina's landmark from anywhere in the street: a flat roof ring,
    // a low drum and a lip, then the dome itself, crowned by the skylight's lantern.
    part(shell, squareWithHole(18, 8.05), adobe, [CENTRE.u, 4.55, CENTRE.v]).scale.y = 4;
    part(shell, new THREE.CylinderGeometry(8.9, 9, .6, 72, 1, true), adobe, [CENTRE.u, 5.25, CENTRE.v]);
    part(shell, new THREE.TorusGeometry(8.85, .26, 10, 96), stone, [CENTRE.u, 5.55, CENTRE.v], [Math.PI / 2, 0, 0]);
    part(shell, new THREE.SphereGeometry(8.7, 72, 22, 0, Math.PI * 2, 0, Math.PI / 2), adobe, [CENTRE.u, 5.5, CENTRE.v]).scale.y = .64;
    for (let ring = 0; ring < 3; ring++) {
        // Faint banding where the plaster was laid in courses.
        const height = .28 + ring * .2, radius = 8.7 * Math.sqrt(1 - height * height);
        part(shell, new THREE.TorusGeometry(radius + .02, .05, 6, 96), stone, [CENTRE.u, 5.5 + height * 8.7 * .64, CENTRE.v], [Math.PI / 2, 0, 0]);
    }
    part(shell, new THREE.CylinderGeometry(1.25, 1.35, .55, 28), adobe, [CENTRE.u, 11.1, CENTRE.v]);
    part(shell, new THREE.SphereGeometry(1.3, 28, 8, 0, Math.PI * 2, 0, Math.PI / 2), adobe, [CENTRE.u, 11.35, CENTRE.v]).scale.y = .45;
    for (let vent = 0; vent < 8; vent++) {
        const a = vent / 8 * Math.PI * 2;
        part(shell, rounded(.34, .2, .06, .02), trim, [CENTRE.u + Math.cos(a) * 1.3, 11.15, CENTRE.v + Math.sin(a) * 1.3], [0, -a - Math.PI / 2, 0]);
    }
    // A smaller domed annex and a vent tower behind the north wall.
    part(shell, new THREE.CylinderGeometry(2.8, 2.9, 3, 28), adobe, [-10.5, 1.5, 74.6]);
    part(shell, new THREE.SphereGeometry(2.8, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), adobe, [-10.5, 3, 74.6]).scale.y = .75;
    part(shell, new THREE.CylinderGeometry(1.1, 1.4, 6.4, 18), adobe, [-17, 3.2, 73.4]);
    part(shell, new THREE.CylinderGeometry(1.25, 1.25, .25, 18), stone, [-17, 6.4, 73.4]);
    part(shell, new THREE.CylinderGeometry(.06, .1, 3, 8), trim, [-17, 7.9, 73.4]);
    // Inside, a ceiling ring opens onto the plastered underside of the dome.
    part(inside, squareWithHole(16.6, 8.05), plaster, [CENTRE.u, 4.4, CENTRE.v]);
    const vault = part(inside, new THREE.SphereGeometry(8.05, 64, 20, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6f5040, map: plaster.map, roughness: 1, side: THREE.BackSide }), [CENTRE.u, 4.45, CENTRE.v]);
    vault.scale.y = .58;
    // Dark ribs run from the springing line up to the skylight.
    const ribs = new THREE.Group();
    ribs.position.set(CENTRE.u, 4.45, CENTRE.v);
    ribs.scale.y = .58;
    inside.add(ribs);
    for (let rib = 0; rib < 6; rib++)
        part(ribs, new THREE.TorusGeometry(7.95, .09, 6, 48, Math.PI), trim, [0, 0, 0], [0, rib / 6 * Math.PI, 0]);
    part(ribs, new THREE.TorusGeometry(7.95, .12, 6, 72), trim, [0, .02, 0], [Math.PI / 2, 0, 0]);
    part(inside, new THREE.TorusGeometry(.95, .1, 8, 32), copper, [CENTRE.u, 9.02, CENTRE.v], [Math.PI / 2, 0, 0]);
    box(inside, stone, 16.9, .035, 16.4, -13.5, -.035, 62.5, .005);
    // Interior wall linings and a continuous dado avoid a bright exterior plaster look.
    box(inside, plaster, .04, 4.6, 16.6, -21.76, 2.25, 62.5, .005);
    for (const z of [54.33, 70.67])
        box(inside, plaster, 16.6, 4.6, .04, -13.5, 2.25, z, .005);
    for(const [v,depth] of[[57.5,6.4],[67.1,7.2]])box(inside,plaster,.04,4.6,depth,-5.34,2.25,v,.005);
    box(inside, plaster, .04, 1.7, 2.8, -5.34, 3.7, 62, .005);
    for (const z of [54.4, 70.6])
        box(inside, trim, 16.2, .17, .12, -13.5, .35, z);
    // The long island bar has rounded ends and an illuminated ivory worktop.
    box(inside, trim, 3.05, .94, 5.5, -14.7, .44, 62);
    box(inside, counter, 3.3, .12, 5.5, -14.7, .98, 62);
    for (const z of [59.25, 64.75]) {
        part(inside, new THREE.CylinderGeometry(1.52, 1.52, .94, 32), trim, [-14.7, .44, z]);
        part(inside, new THREE.CylinderGeometry(1.65, 1.65, .12, 32), counter, [-14.7, .98, z]);
        part(inside, new THREE.TorusGeometry(1.64, .035, 8, 40), copper, [-14.7, 1.055, z], [Math.PI / 2, 0, 0]);
    }
    for (const u of [-16.1, -13.3])
        pipe(inside, [[u, .18, 58.3], [u, .18, 62], [u, .18, 65.7]], .045, copper);
    // Drink apparatus, stills, tap handles and copper piping, following the reference.
    for (let i = 0; i < 4; i++) {
        const v = 59.3 + i * 1.7, r = i % 2 ? .23 : .31;
        part(inside, new THREE.CylinderGeometry(r, r * 1.16, .8 + i % 2 * .25, 20), trim, [-14.7, 1.47, v]);
        for (const y of [1.12, 1.45, 1.78])
            part(inside, new THREE.TorusGeometry(r * 1.06, .025, 6, 24), copper, [-14.7, y, v], [Math.PI / 2, 0, 0]);
        part(inside, new THREE.ConeGeometry(r, .3, 20), copper, [-14.7, 1.99, v]);
        pipe(inside, [[-14.7, 1.95, v], [-14.7, 2.45 + i % 2 * .4, v], [-13.5, 2.45 + i % 2 * .4, v], [-13.5, 1.25, v]], .045, copper);
        box(inside, trim, .2, .08, .12, -13.5, 1.22, v);
        part(inside, new THREE.CylinderGeometry(.03, .03, .14, 8), copper, [-13.5, 1.33, v]);
    }
    pipe(inside, [[-14.7, 2.6, 58.8], [-14.7, 3.5, 58.8], [-14.7, 3.5, 65.8], [-14.7, 2.65, 65.8]], .055, copper);
    const circles: {
        u: number;
        v: number;
        r: number;
    }[] = [59.2, 62, 64.8].map(v => ({ u: -14.7, v, r: 1.7 }));
    buttresses.forEach(([u, v]) => circles.push({ u, v, r: 1.1 }));
    circles.push({ u: -10.5, v: 74.6, r: 3 }, { u: -17, v: 73.4, r: 1.5 });
    const drink = (u: number, v: number, color: number, y = .99) => {
        part(inside, new THREE.CylinderGeometry(.065, .06, .17, 14, 1, true), cupMaterials[color % 3], [u, y + .11, v]);
        part(inside, new THREE.TorusGeometry(.065, .008, 6, 14), cupMaterials[color % 3], [u, y + .195, v], [Math.PI / 2, 0, 0]);
    };
    for (let i = 0; i < 6; i++)
        drink(i % 2 ? -13.3 : -16, 58.7 + i * 1.23, i);
    // Deep arched booths, each with its own round table and colored drinking vessels.
    const seat = (u: number, v: number, rotation = 0) => {
        const s = new THREE.Group();
        s.position.set(u, 0, v);
        s.rotation.y = rotation;
        inside.add(s);
        box(s, leather, 1.4, .26, .72, 0, .42, 0);
        box(s, leather, 1.4, .9, .16, 0, .97, -.32);
        for (const y of [.68, .84, 1, 1.16])
            box(s, trim, 1.3, .018, .02, 0, y, -.225, .005);
    };
    const table = (u: number, v: number, r = .57) => {
        part(inside, new THREE.CylinderGeometry(r, r * .9, .22, 24), trim, [u, .65, v]);
        part(inside, new THREE.CylinderGeometry(r * .94, r * .94, .035, 24), counter, [u, .775, v]);
        part(inside, new THREE.CylinderGeometry(.2, .35, .54, 16), trim, [u, .27, v]);
        circles.push({ u, v, r: r + .1 });
        drink(u - .18, v, 0, .76);
        drink(u + .18, v + .13, 1, .76);
    };
    for (const v of [56.9, 62.5, 68.1]) {
        // Arch plane is parallel to the back wall and faces the room.
        part(inside, new THREE.TorusGeometry(1.7, .14, 8, 28, Math.PI), trim, [-21.5, 1.45, v], [0, Math.PI / 2, 0]);
        for (const dz of [-1.7, 1.7])
            box(inside, trim, .22, 1.45, .22, -21.5, .69, v + dz);
        box(inside, leather, .35, 1, 2.8, -21.4, .9, v);
        seat(-20.55, v - 1.05, 0);
        seat(-20.55, v + 1.05, Math.PI);
        table(-20.3, v, .65);
        circles.push({ u: -20.7, v, r: 1.48 });
        part(inside, new THREE.SphereGeometry(.09, 12, 8), lampRed, [-21.45, 2.75, v]);
    }
    for (const v of [57.4, 67.3]) {
        table(-8.3, v, .65);
        seat(-8.3, v - 1.1, 0);
        seat(-8.3, v + 1.1, Math.PI);
        circles.push({ u: -8.3, v: v - 1.1, r: .65 }, { u: -8.3, v: v + 1.1, r: .65 });
    }
    // Padded booths and scattered tables leave a clear aisle from the street to the bar.
    const crowd = createCantinaCrowd();
    group.add(crowd.group);
    circles.push(...crowd.circles);
    // A sign can be read while approaching along the street.
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "#342b25";
    c.fillRect(0, 0, 512, 128);
    c.strokeStyle = "#bc8b4d";
    c.lineWidth = 7;
    c.strokeRect(8, 8, 496, 112);
    c.fillStyle = "#f5ce86";
    c.textAlign = "center";
    c.font = "bold 52px monospace";
    c.fillText("CANTINA", 256, 79);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    part(shell, new THREE.PlaneGeometry(2.8, .7), new THREE.MeshStandardMaterial({ map, emissive: 0xd7ad62, emissiveIntensity: .3 }), [-3.17, 3.42, 62], [0, Math.PI / 2, 0]);
    // Dim, warm pools of light: over the bar, the band, the booths and the door.
    for (const [u, v, y, color, power, reach] of [[-14.7, 62, 3.7, 0xffb066, 26, 11], [-11.2, 68.4, 3.1, 0xff8a4a, 15, 7], [-19.6, 62.5, 2.7, 0xff6a3a, 11, 9], [-6.3, 62, 2.25, 0xffb66e, 12, 8]]) {
        if (u !== -19.6) {
            // Each bulb hangs on a cord from the vault (or the flat ceiling beyond it).
            const reach = Math.hypot(u - CENTRE.u, v - CENTRE.v) / 8.05, top = reach < 1 ? 4.45 + 4.67 * Math.sqrt(1 - reach * reach) : 4.4;
            part(inside, new THREE.SphereGeometry(.13, 12, 8), glow, [u, y, v]);
            part(inside, new THREE.CylinderGeometry(.012, .012, top - y, 6), trim, [u, (top + y) / 2, v]);
        }
        const light = new THREE.PointLight(color, power, reach, 2);
        light.position.set(u, y - .15, v);
        group.add(light);
    }
    // The skylight lets a faint shaft down onto the bar.
    const sky = new THREE.MeshBasicMaterial({ color: 0xffe9c4, side: THREE.DoubleSide });
    part(inside, new THREE.CircleGeometry(.88, 32), sky, [CENTRE.u, 9.04, CENTRE.v], [Math.PI / 2, 0, 0]);
    const beam = (radiusTop: number, radiusBottom: number, opacity: number) => part(group, new THREE.CylinderGeometry(radiusTop, radiusBottom, 8.4, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xffdcaa, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), [CENTRE.u, 4.8, CENTRE.v]);
    const shafts = [beam(.85, 1.9, .035), beam(.6, 1.3, .03)];
    const pool = part(group, new THREE.CircleGeometry(2, 32), new THREE.MeshBasicMaterial({ color: 0xffcf96, transparent: true, opacity: .06, depthWrite: false, blending: THREE.AdditiveBlending }), [CENTRE.u, 1.07, CENTRE.v], [-Math.PI / 2, 0, 0]);
    // Wall sconces glow amber between the booths and along the side walls.
    const halo = glowTexture();
    const sconce = new THREE.MeshStandardMaterial({ color: 0x3a2618, emissive: 0xff9a4a, emissiveIntensity: 1.6, roughness: .6 });
    const flames: THREE.Sprite[] = [];
    for (const [u, v, turn] of [[-18, 54.42, 0], [-12.5, 54.42, 0], [-8, 54.42, 0], [-18, 70.58, Math.PI], [-6.6, 70.58, Math.PI], [-21.72, 59.7, Math.PI / 2], [-21.72, 65.3, Math.PI / 2], [-5.36, 57.2, -Math.PI / 2], [-5.36, 67.6, -Math.PI / 2]]) {
        part(inside, new THREE.CylinderGeometry(.14, .07, .32, 12, 1, false, 0, Math.PI), sconce, [u, 2.55, v], [0, turn - Math.PI / 2, 0]);
        const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0xff9a50, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
        flame.position.set(u + Math.sin(turn) * .12, 2.7, v + Math.cos(turn) * .12);
        flame.scale.setScalar(.9);
        group.add(flame);
        flames.push(flame);
    }
    bakePart(shell);
    bakePart(inside);
    const contains = (u: number, v: number) => u < -5.05 && u > -21.8 && v > 54.3 && v < 70.7;
    const isBlocked = (u: number, v: number, clearance=.35) => walls.some(w => u > w.minU - clearance && u < w.maxU + clearance && v > w.minV - clearance && v < w.maxV + clearance);
    return { group, circles, contains, isBlocked, bartender: crowd.bartenderSpot, entry: { u: -8.2, v: 62 }, exit: { u: -1.8, v: 62 },
        constrain: (walker: {
            u: number;
            v: number;
        }) => {
            for (const w of walls) {
                const a = w.minU - .35, b = w.maxU + .35, c = w.minV - .35, d = w.maxV + .35;
                if (walker.u <= a || walker.u >= b || walker.v <= c || walker.v >= d)
                    continue;
                const distances = [walker.u - a, b - walker.u, walker.v - c, d - walker.v], side = distances.indexOf(Math.min(...distances));
                if (side === 0)
                    walker.u = a - .001;
                else if (side === 1)
                    walker.u = b + .001;
                else if (side === 2)
                    walker.v = c - .001;
                else
                    walker.v = d + .001;
            }
        },
        tick: (time: number, reduced: boolean) => {
            crowd.tick(time, reduced);
            if (reduced)
                return;
            // Candle-like flicker on the sconces; the skylight shaft breathes with the haze.
            flames.forEach((flame, i) => flame.material.opacity = .5 + Math.sin(time * 9 + i * 2.1) * .04 + Math.sin(time * 23 + i) * .03);
            shafts.forEach((shaft, i) => shaft.material.opacity = (i ? .03 : .035) * (1 + Math.sin(time * .4 + i) * .2));
            pool.material.opacity = .06 * (1 + Math.sin(time * .4) * .15);
        }
    };
}
