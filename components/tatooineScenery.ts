import * as THREE from "three";
import { bakePart, createSandtrooper, part, pipe, rounded } from "./tatooineCharacters";
export function createLandspeeder(color = 0x9e5b43) {
    const group = new THREE.Group();
    group.name = "x34-landspeeder";
    const paint = new THREE.MeshStandardMaterial({ color, roughness: .72, metalness: .36 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xbab29a, roughness: .66, metalness: .38 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x252c29, roughness: .8 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x71766e, roughness: .48, metalness: .75 });
    part(group, rounded(1.8, .42, 3.5, .2), paint, [0, .57, 0]);
    part(group, rounded(1.87, .12, 3.37, .06), cream, [0, .49, .04]);
    part(group, rounded(1.3, .12, 1.4, .05), dark, [0, .83, -.44]);
    for (const x of [-.38, .38]) {
        part(group, rounded(.6, .14, .65, .05), dark, [x, .85, -.4]);
        part(group, rounded(.58, .4, .12, .04), cream, [x, 1, -.74]);
    }
    for (let stripe = 0; stripe < 6; stripe++)
        part(group, new THREE.BoxGeometry(1.35, .014, .035), steel, [0, .49 + stripe * .029, 1.75]);
    for (const x of [-1.02, 1.02]) {
        part(group, new THREE.CylinderGeometry(.23, .24, 1.2, 20), steel, [x, .66, -.92], [Math.PI / 2, 0, 0]);
        part(group, new THREE.CylinderGeometry(.18, .18, .03, 20), dark, [x, .66, -1.54], [Math.PI / 2, 0, 0]);
        for (const z of [-1.35, -.6])
            part(group, new THREE.TorusGeometry(.238, .02, 6, 20), cream, [x, .66, z]);
    }
    part(group, new THREE.CylinderGeometry(.19, .19, .9, 16), steel, [0, 1.12, -1.19], [Math.PI / 2, 0, 0]);
    for (const x of [-.74, .74])
        pipe(group, [[x, .78, .34], [x, .98, .55], [x, 1.14, .32]], .018, steel);
    bakePart(group);
    part(group, rounded(1.35, .29, .035, .015), new THREE.MeshStandardMaterial({ color: 0x718e90, transparent: true, opacity: .45, metalness: .1, roughness: .18 }), [0, 1.02, .38], [-.35, 0, 0]);
    return group;
}
export function createTatooineScenery(adobe: THREE.Material) {
    const group = new THREE.Group();
    group.name = "tatooine-street-details";
    const scenery = new THREE.Group();
    group.add(scenery);
    const rusty = new THREE.MeshStandardMaterial({ color: 0x825239, roughness: .87, metalness: .33 });
    const pale = new THREE.MeshStandardMaterial({ color: 0xbeb9a4, roughness: .72, metalness: .45 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x30332c, roughness: .88 });
    const brass = new THREE.MeshStandardMaterial({ color: 0x8c7650, roughness: .62, metalness: .65 });
    const colliders: {
        u: number;
        v: number;
        r: number;
    }[] = [];
    // Distinct rooflines, aerials and narrow moisture towers in the background.
    for (const [u, v, height] of [[-17, 31, 8], [19, 65, 12], [-25, 44, 7]]) {
        part(scenery, new THREE.CylinderGeometry(1.15, 1.5, height, 12), adobe, [u, height / 2, v]);
        part(scenery, new THREE.CylinderGeometry(1.6, 1.6, .22, 16), pale, [u, height - .7, v]);
        for (let i = 0; i < 5; i++)
            part(scenery, new THREE.CylinderGeometry(.3, .36, .18, 12), brass, [u, height + i * .8, v]);
        part(scenery, new THREE.CylinderGeometry(.07, .14, 5, 8), pale, [u, height + 1.8, v]);
        colliders.push({ u, v, r: 1.6 });
    }
    for (const [u, v] of [[-9, 28], [9, 38], [-10, 42], [10, 55], [9, 69]]) {
        for (let i = 0; i < 3; i++) {
            const x = u + (i - 1) * 1.1, z = v + .6;
            part(scenery, new THREE.CylinderGeometry(.04, .07, 2.3 + i * .5, 8), dark, [x, 6.7 + i * .2, z]);
            part(scenery, new THREE.CylinderGeometry(.15, .15, .08, 10), brass, [x, 7.3 + i * .5, z]);
        }
        pipe(scenery, [[u - 2, 4.1, v - 2], [u - 2, 4.7, v - 2], [u + 1, 4.7, v - 2], [u + 1, 3.9, v - 2]], .075, rusty);
        for (let panel = 0; panel < 3; panel++)
            part(scenery, rounded(.7, 1.2, .12, .03), pale, [u + (panel - 1) * .9, 1.6, v - 3.5]);
    }
    // Hanging service cables sag between the buildings, clear of the flight corridor.
    pipe(scenery, [[-7, 5, 28], [-2, 4.3, 33], [6, 5.7, 38]], .025, dark);
    pipe(scenery, [[-7, 5.2, 42], [0, 4.2, 48], [7, 5.6, 55]], .027, dark);
    // A half-dismantled fighter, its scarred fuselage and broken wing resting in the sand.
    const wreck = new THREE.Group();
    wreck.name = "jawa-salvage-wreck";
    wreck.position.set(-18, .05, 49);
    wreck.rotation.y = -.6;
    scenery.add(wreck);
    part(wreck, new THREE.CylinderGeometry(.43, .68, 5.5, 8), pale, [0, .72, 0], [Math.PI / 2, 0, 0]);
    part(wreck, new THREE.ConeGeometry(.44, 2, 8), pale, [0, .72, 3.7], [Math.PI / 2, 0, 0]);
    part(wreck, rounded(.8, .5, 1.6, .08), dark, [0, 1.04, .65], [-.18, 0, 0]);
    part(wreck, new THREE.CylinderGeometry(.53, .53, 2.5, 16), rusty, [-1.25, .72, -.7], [Math.PI / 2, 0, 0]);
    part(wreck, new THREE.CylinderGeometry(.4, .4, .05, 16), dark, [-1.25, .72, -2], [Math.PI / 2, 0, 0]);
    for (let ring = 0; ring < 6; ring++)
        part(wreck, new THREE.TorusGeometry(.54, .025, 6, 20), brass, [-1.25, .72, -1.8 + ring * .35]);
    const wing = new THREE.Shape();
    wing.moveTo(0, 0);
    wing.lineTo(3.6, -1);
    wing.lineTo(3.2, 1);
    wing.lineTo(2.7, .55);
    wing.lineTo(1.8, 1.2);
    wing.lineTo(0, 1.1);
    part(wreck, new THREE.ExtrudeGeometry(wing, { depth: .12, bevelEnabled: false }), pale, [.4, .35, -1], [Math.PI / 2, 0, .12]);
    part(wreck, rounded(2.3, .09, .35), rusty, [1.5, .22, -1.5], [0, .3, 0]);
    for (let scrap = 0; scrap < 8; scrap++)
        part(wreck, rounded(.3 + scrap % 3 * .2, .08, .4), scrap % 2 ? rusty : dark, [-2 + Math.sin(scrap * 3) * 1.2, .06, -2 + Math.cos(scrap * 2) * 1.7], [.05, scrap, .1]);
    colliders.push({ u: -18, v: 49, r: 4.5 });
    // Parked X-34 being inspected, set back from the central pedestrian lane.
    const checkpoint = new THREE.Group();
    checkpoint.name = "imperial-checkpoint";
    checkpoint.position.set(7, 0, 27);
    checkpoint.rotation.y = .2;
    group.add(checkpoint);
    checkpoint.add(createLandspeeder());
    colliders.push({ u: 7, v: 27, r: 2.3 });
    for (const z of [24.4, 30.4]) {
        part(scenery, new THREE.CylinderGeometry(.12, .18, .65, 10), dark, [4.3, .31, z]);
        part(scenery, new THREE.CylinderGeometry(.13, .13, .09, 10), brass, [4.3, .62, z]);
        colliders.push({ u: 4.3, v: z, r: .2 });
    }
    bakePart(scenery);
    const troops = [
        { model: createSandtrooper(true), u: 4.2, v: 26.5, patrol: 0, phase: 0 },
        { model: createSandtrooper(), u: 8.2, v: 30.2, patrol: 0, phase: 1 },
        { model: createSandtrooper(), u: 1.8, v: 45, patrol: 4.5, phase: 0 },
        { model: createSandtrooper(), u: 2.8, v: 46.4, patrol: 4.5, phase: .15 },
    ];
    const movers = troops.map(t => ({ u: t.u, v: t.v, r: .42 }));
    troops.filter(t=>!t.patrol).forEach(t=>colliders.push({u:t.u,v:t.v,r:.42}));
    troops.forEach(t => { t.model.group.position.set(t.u, -.06, t.v); t.model.group.rotation.y = t.patrol ? 0 : Math.PI / 2; group.add(t.model.group); });
    return { group, colliders, movers, tick: (dt: number, time: number, reduced: boolean, walker: {
            u: number;
            v: number;
        }) => {
            troops.forEach((t, i) => {
                const g = t.model.group, near = Math.hypot(walker.u - g.position.x, walker.v - g.position.z) < 1.7;
                if (!reduced && dt && t.patrol && !near) {
                    g.position.z = t.v + Math.sin(time * .19 + t.phase) * t.patrol;
                    const target = Math.cos(time * .19 + t.phase) > 0 ? 0 : Math.PI;
                    g.rotation.y += Math.atan2(Math.sin(target - g.rotation.y), Math.cos(target - g.rotation.y)) * (1 - Math.exp(-dt * 3));
                }
                t.model.tick(time, !!t.patrol && !near, reduced);
                movers[i].u = g.position.x;
                movers[i].v = g.position.z;
            });
        } };
}
