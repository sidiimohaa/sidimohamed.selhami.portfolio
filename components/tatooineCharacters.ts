import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
type XYZ = [
    number,
    number,
    number
];
export function part(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, position: XYZ = [0, 0, 0], rotation: XYZ = [0, 0, 0]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    parent.add(mesh);
    return mesh;
}
export const rounded = (w: number, h: number, d: number, r = .03) => new RoundedBoxGeometry(w, h, d, 2, r);
export function pipe(parent: THREE.Object3D, points: XYZ[], radius: number, material: THREE.Material) {
    return part(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(8, points.length * 5), radius, 6, false), material);
}
/** Bake static details per material, keeping articulated parts as separate groups. */
export function bakePart(root: THREE.Group) {
    root.updateMatrixWorld(true);
    const inverse = root.matrixWorld.clone().invert(), batches = new Map<THREE.Material, THREE.BufferGeometry[]>(), originals: THREE.Mesh[] = [];
    root.traverse(object => {
        if (!(object instanceof THREE.Mesh) || Array.isArray(object.material))
            return;
        const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
        geometry.applyMatrix4(inverse.clone().multiply(object.matrixWorld));
        const list = batches.get(object.material) ?? [];
        list.push(geometry);
        batches.set(object.material, list);
        originals.push(object);
    });
    originals.forEach(object => { object.removeFromParent(); object.geometry.dispose(); });
    batches.forEach((list, material) => { const geometry = mergeGeometries(list, false); list.forEach(g => g.dispose()); if (geometry)
        root.add(new THREE.Mesh(geometry, material)); });
}
export function createHeroDroids() {
    const white = new THREE.MeshStandardMaterial({ color: 0xd9d6c8, roughness: .48, metalness: .24 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x153b85, roughness: .3, metalness: .6 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xaeb6b7, roughness: .22, metalness: .92 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd4a644, roughness: .24, metalness: .94 });
    const edgeGold = new THREE.MeshStandardMaterial({ color: 0xa57627, roughness: .38, metalness: .85 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x151c1c, roughness: .65, metalness: .4 });
    const dirt = new THREE.MeshStandardMaterial({ color: 0x8c8067, roughness: .95 });
    const eye = new THREE.MeshBasicMaterial({ color: 0xf1db79 });
    const signal = new THREE.MeshBasicMaterial({ color: 0x69c7ff });
    const r2 = new THREE.Group();
    r2.name = "r2-d2";
    r2.scale.setScalar(.87);
    const shell = new THREE.Group();
    r2.add(shell);
    part(shell, new THREE.CylinderGeometry(.32, .32, .72, 32), white, [0, .61, 0]);
    for (const y of [.26, .96])
        part(shell, new THREE.TorusGeometry(.322, .017, 6, 32), chrome, [0, y, 0], [Math.PI / 2, 0, 0]);
    // Recessed front hatches, blue utility strips and the two characteristic vents.
    for (const y of [.84, .75])
        part(shell, rounded(.37, .056, .018, .008), blue, [0, y, .323]);
    for (const x of [-.21, .21]) {
        part(shell, rounded(.095, .39, .018, .008), dirt, [x, .53, .25]);
        part(shell, rounded(.078, .37, .022, .006), white, [x, .53, .262]);
    }
    for (const y of [.61, .43]) {
        part(shell, rounded(.15, .13, .023, .025), chrome, [0, y, .325]);
        part(shell, rounded(.12, .1, .025, .02), dark, [0, y, .34]);
        for (let l = 0; l < 3; l++)
            part(shell, new THREE.BoxGeometry(.11, .012, .018), chrome, [0, y - .03 + l * .03, .359]);
    }
    part(shell, new THREE.TorusGeometry(.055, .016, 6, 16), chrome, [0, .3, .334]);
    part(shell, new THREE.CircleGeometry(.042, 16), blue, [0, .3, .337]);
    for (let i = 0; i < 8; i++)
        part(shell, new THREE.BoxGeometry(.053, .025, .015), i % 2 ? white : dirt, [-.22 + i * .063, .23, .24]);
    for (const side of [-1, 1]) {
        part(shell, new THREE.CylinderGeometry(.13, .13, .16, 16), chrome, [side * .37, .78, 0], [0, 0, Math.PI / 2]);
        part(shell, rounded(.17, .64, .18, .06), white, [side * .43, .47, 0]);
        part(shell, rounded(.075, .35, .035, .009), blue, [side * .43, .41, .105]);
        part(shell, rounded(.26, .16, .4, .035), white, [side * .43, .1, .045]);
        part(shell, new THREE.BoxGeometry(.21, .035, .34), dirt, [side * .43, .018, .045]);
        pipe(shell, [[side * .44, .31, .1], [side * .49, .18, .17], [side * .48, .11, .23]], .023, edgeGold);
    }
    part(shell, rounded(.18, .13, .29, .025), white, [0, .07, .08]);
    bakePart(shell);
    const dome = new THREE.Group();
    dome.name = "r2-dome";
    dome.position.y = .98;
    r2.add(dome);
    part(dome, new THREE.SphereGeometry(.325, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), chrome);
    part(dome, new THREE.CylinderGeometry(.328, .328, .052, 32), blue, [0, .025, 0]);
    for (let i = 0; i < 6; i++)
        part(dome, new THREE.SphereGeometry(.327, 6, 4, i * Math.PI / 3 + .08, .72, .24, .78), blue);
    part(dome, new THREE.CylinderGeometry(.125, .125, .025, 24), blue, [0, .32, 0]);
    part(dome, rounded(.15, .14, .055, .013), blue, [-.095, .16, .26], [-.25, 0, 0]);
    part(dome, new THREE.SphereGeometry(.056, 16, 12), dark, [-.095, .17, .299]);
    part(dome, new THREE.CircleGeometry(.039, 16), signal, [.09, .063, .328]);
    part(dome, new THREE.TorusGeometry(.041, .012, 6, 16), chrome, [.21, .076, .252], [0, .65, 0]);
    for (let i = 0; i < 2; i++)
        part(dome, new THREE.BoxGeometry(.047, .034, .015), signal, [-.19, .055 + i * .047, .267]);
    bakePart(dome);
    const c3 = new THREE.Group();
    c3.name = "c-3po";
    c3.scale.setScalar(.94);
    const torso = new THREE.Group();
    c3.add(torso);
    part(torso, rounded(.4, .4, .2, .07), gold, [0, 1.22, 0]);
    for (const side of [-1, 1])
        part(torso, new THREE.SphereGeometry(.15, 16, 12), gold, [side * .095, 1.25, .065]).scale.set(1, 1.25, .6);
    part(torso, new THREE.CylinderGeometry(.13, .15, .24, 16), dark, [0, .9, 0]);
    for (let i = 0; i < 13; i++) {
        const x = -.135 + i * .022;
        pipe(torso, [[x, 1.025, .1], [x * .85, .92, .13], [x * .9, .795, .1]], .006, i % 3 ? edgeGold : chrome);
    }
    part(torso, new THREE.TorusGeometry(.105, .022, 8, 24), edgeGold, [0, 1.065, .145]);
    part(torso, new THREE.CircleGeometry(.087, 24), gold, [0, 1.065, .149]);
    part(torso, new THREE.TorusGeometry(.065, .008, 6, 24), edgeGold, [0, 1.065, .153]);
    part(torso, new THREE.CylinderGeometry(.17, .14, .14, 16), gold, [0, .77, 0]);
    part(torso, new THREE.CylinderGeometry(.075, .07, .13, 16), chrome, [0, 1.48, 0]);
    for (const y of [1.44, 1.47, 1.5])
        part(torso, new THREE.TorusGeometry(.078, .008, 6, 16), gold, [0, y, 0], [Math.PI / 2, 0, 0]);
    bakePart(torso);
    const head = new THREE.Group();
    head.position.y = 1.65;
    c3.add(head);
    part(head, new THREE.SphereGeometry(.157, 24, 18), gold).scale.set(1, 1.3, .86);
    part(head, rounded(.2, .11, .13, .045), gold, [0, -.12, .015]);
    for (const side of [-1, 1]) {
        part(head, new THREE.TorusGeometry(.044, .014, 8, 20), edgeGold, [side * .062, .025, .125]);
        part(head, new THREE.CircleGeometry(.033, 16), eye, [side * .062, .025, .139]);
        for (let slot = 0; slot < 4; slot++)
            part(head, new THREE.BoxGeometry(.004, .052, .004), edgeGold, [side * .062 - .02 + slot * .013, .025, .143]);
        part(head, new THREE.CylinderGeometry(.045, .045, .025, 16), edgeGold, [side * .16, 0, 0], [0, 0, Math.PI / 2]);
    }
    part(head, new THREE.BoxGeometry(.07, .015, .014), dark, [0, -.078, .139]);
    part(head, rounded(.027, .059, .025, .008), edgeGold, [0, -.027, .143]);
    pipe(head, [[0, -.13, -.1], [0, .1, -.12], [0, .207, 0], [0, .09, .126]], .008, edgeGold);
    bakePart(head);
    const legs: THREE.Group[] = [], arms: THREE.Group[] = [];
    for (const side of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(side * .12, .73, 0);
        c3.add(leg);
        legs.push(leg);
        const finish = side === 1 ? chrome : gold;
        part(leg, new THREE.CylinderGeometry(.077, .06, .29, 12), gold, [0, -.17, 0]);
        part(leg, new THREE.SphereGeometry(.068, 12, 8), edgeGold, [0, -.335, 0]);
        part(leg, new THREE.CylinderGeometry(.05, .068, .27, 12), finish, [0, -.505, 0]);
        part(leg, new THREE.TorusGeometry(.054, .014, 6, 16), edgeGold, [0, -.33, .025]);
        part(leg, rounded(.15, .075, .26, .03), finish, [0, -.69, .055]);
        pipe(leg, [[side * .06, -.06, 0], [side * .07, -.25, 0], [side * .06, -.3, 0]], .013, chrome);
        bakePart(leg);
        const arm = new THREE.Group();
        arm.position.set(side * .265, 1.365, 0);
        c3.add(arm);
        arms.push(arm);
        part(arm, new THREE.SphereGeometry(.09, 16, 10), gold);
        part(arm, new THREE.CylinderGeometry(.06, .05, .24, 12), gold, [side * .018, -.16, 0]);
        part(arm, new THREE.SphereGeometry(.052, 12, 8), dark, [side * .025, -.3, 0]);
        part(arm, new THREE.CylinderGeometry(.05, .038, .23, 12), gold, [side * .025, -.435, .03], [-.12, 0, 0]);
        part(arm, rounded(.092, .1, .045, .015), gold, [side * .025, -.595, .055]);
        for (let finger = 0; finger < 4; finger++)
            part(arm, new THREE.CylinderGeometry(.009, .008, .066, 6), gold, [side * .025 - .033 + finger * .022, -.665, .055]);
        pipe(arm, [[side * .07, -.08, 0], [side * .075, -.26, .01], [side * .07, -.41, .04]], .012, edgeGold);
        bakePart(arm);
    }
    return { r2, c3, rig: { head, legs, arms }, tick: (age: number, reduced: boolean) => {
            const t = reduced ? 0 : age;
            legs.forEach((leg, i) => leg.rotation.x = Math.sin(t * 3.4 + i * Math.PI) * .27);
            arms.forEach((arm, i) => { arm.rotation.x = .12 + Math.sin(t * 3.4 + i * Math.PI + Math.PI) * .13; arm.rotation.z = (i ? 1 : -1) * .09; });
            head.rotation.y = Math.sin(t * .75) * .12;
            dome.rotation.y = Math.sin(t * .55) * .2;
            r2.rotation.z = Math.sin(t * 2.3) * .015;
        } };
}
export { createSandtrooper } from "./stormtrooperModel";
