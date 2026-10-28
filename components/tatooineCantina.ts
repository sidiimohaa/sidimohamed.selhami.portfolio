import * as THREE from "three";
import { bakePart, part, pipe, rounded } from "./tatooineCharacters";
export type CantinaWall = {
    minU: number;
    maxU: number;
    minV: number;
    maxV: number;
};
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
    ];
    walls.forEach(w => box(shell, adobe, w.maxU - w.minU, 4.8, w.maxV - w.minV, (w.minU + w.maxU) / 2, 2.35, (w.minV + w.maxV) / 2));
    // A wide arched entrance remains open all the way to the interior.
    box(shell, adobe, .65, 1.9, 2.6, -5, 3.8, 62);
    part(shell, new THREE.TorusGeometry(1.3, .16, 8, 28, Math.PI), stone, [-4.62, 1.55, 62], [0, Math.PI / 2, 0]);
    for (const z of [60.7, 63.3])
        box(shell, stone, .38, 1.55, .3, -4.6, .75, z);
    box(shell, adobe, 18, .4, 18, -13.5, 4.75, 62.5);
    part(shell, new THREE.SphereGeometry(6.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), adobe, [-14, 4.8, 62]).scale.y = .25;
    box(inside, plaster, 16.5, .1, 16.3, -13.5, 4.49, 62.5);
    box(inside, stone, 16.9, .035, 16.4, -13.5, -.035, 62.5, .005);
    // Interior wall linings and a continuous dado avoid a bright exterior plaster look.
    box(inside, plaster, .04, 4.6, 16.6, -21.76, 2.25, 62.5, .005);
    for (const z of [54.33, 70.67])
        box(inside, plaster, 16.6, 4.6, .04, -13.5, 2.25, z, .005);
    for(const [v,depth] of[[57.5,6.4],[67.1,7.2]])box(inside,plaster,.04,4.6,depth,-5.34,2.25,v,.005);
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
    const patrons = new THREE.Group();
    group.add(patrons);
    const heads: THREE.Group[] = [];
    for (let i = 0; i < 4; i++) {
        const u = i < 3 ? -20.55 : -8.3, v = i < 3 ? [55.9, 63.5, 67.1][i] : 68.35;
        const p = new THREE.Group();
        p.position.set(u, .35, v);
        p.rotation.y = i % 2 ? Math.PI : 0;
        patrons.add(p);
        const coat = new THREE.MeshStandardMaterial({ color: [0x4c4d3e, 0x836044, 0x455958, 0x78523d][i], roughness: .95 });
        const skin = new THREE.MeshStandardMaterial({ color: i % 2 ? 0x748060 : 0xad9172, roughness: .85 });
        part(p, new THREE.CylinderGeometry(.22, .27, .55, 12), coat, [0, .55, 0]);
        const head = new THREE.Group();
        head.position.y = .98;
        p.add(head);
        heads.push(head);
        part(head, new THREE.SphereGeometry(.19, 16, 12), skin).scale.set(1, i % 2 ? 1.16 : 1, .9);
        if (i % 2)
            for (const side of [-1, 1])
                part(head, new THREE.SphereGeometry(.055, 10, 8), trim, [side * .15, .08, .11]);
        else for(const side of[-1,1])part(head,new THREE.SphereGeometry(.018,8,6),trim,[side*.065,.03,.166]);
        for (const side of [-1, 1])
            part(p, new THREE.CylinderGeometry(.075, .09, .4, 8), coat, [side * .25, .62, .12], [.9, 0, 0]);
        bakePart(p);
    }
    const bartender = new THREE.Group();
    bartender.position.set(-14.7, 0, 62);
    bartender.rotation.y=Math.PI/2;
    patrons.add(bartender);
    part(bartender, rounded(.4, .6, .26), trim, [0, 1.12, 0]);
    part(bartender, new THREE.SphereGeometry(.18, 16, 12), stone, [0, 1.65, 0]);
    for(const side of[-1,1])part(bartender,new THREE.SphereGeometry(.019,8,6),trim,[side*.065,1.68,.165]);
    part(bartender,new THREE.SphereGeometry(.035,10,8),stone,[0,1.63,.188]);
    const hand = new THREE.Group();
    hand.position.set(.22, 1.38, 0);
    bartender.add(hand);
    part(hand, new THREE.CylinderGeometry(.065, .055, .45, 10), stone, [0, -.15, .12], [.75, 0, 0]);
    part(hand, new THREE.SphereGeometry(.07, 10, 8), stone, [0, -.29, .27]);
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
    part(shell, new THREE.PlaneGeometry(2.8, .7), new THREE.MeshStandardMaterial({ map, emissive: 0xd7ad62, emissiveIntensity: .3 }), [-4.61, 3.35, 62], [0, Math.PI / 2, 0]);
    for (const [u, v, y] of [[-13, 61, 3.5], [-18, 66, 2.8], [-6.3, 62, 2.25]]) {
        part(inside, new THREE.SphereGeometry(.13, 12, 8), glow, [u, y, v]);
        const light = new THREE.PointLight(0xffb66e, u === -6.3 ? 17 : 34, 13, 2);
        light.position.set(u, y - .15, v);
        group.add(light);
    }
    bakePart(shell);
    bakePart(inside);
    const contains = (u: number, v: number) => u < -5.05 && u > -21.8 && v > 54.3 && v < 70.7;
    const isBlocked = (u: number, v: number) => walls.some(w => u > w.minU - .35 && u < w.maxU + .35 && v > w.minV - .35 && v < w.maxV + .35);
    return { group, circles, contains, isBlocked, entry: { u: -8.2, v: 62 }, exit: { u: -2, v: 62 },
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
        tick: (time: number, reduced: boolean) => { hand.rotation.z = reduced ? 0 : Math.sin(time * 1.7) * .16; }
    };
}
