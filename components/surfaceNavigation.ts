import * as THREE from "three";
/** A small navigation grid shared by automatic walking and the physical collision rules. */
export function createSurfaceNavigator(radius: number, isFree: (x: number, z: number) => boolean) {
    const step = 1.25, half = Math.ceil(radius / step), size = half * 2 + 1;
    const free = new Uint8Array(size * size);
    const point = (id: number) => new THREE.Vector3((id % size - half) * step, 0, (Math.floor(id / size) - half) * step);
    for (let id = 0; id < free.length; id++) {
        const p = point(id);
        free[id] = Number(isFree(p.x, p.z));
    }
    const clear = (a: THREE.Vector3, b: THREE.Vector3) => {
        const count = Math.ceil(a.distanceTo(b) / .3);
        for (let i = 0; i <= count; i++) {
            const t = count ? i / count : 0;
            if (!isFree(THREE.MathUtils.lerp(a.x, b.x, t), THREE.MathUtils.lerp(a.z, b.z, t)))
                return false;
        }
        return true;
    };
    const closest = (p: THREE.Vector3) => {
        const gx = Math.round(p.x / step) + half, gz = Math.round(p.z / step) + half;
        let found = -1, best = Infinity;
        for (let dz = -4; dz <= 4; dz++)
            for (let dx = -4; dx <= 4; dx++) {
                const x = gx + dx, z = gz + dz, id = z * size + x;
                if (x < 0 || z < 0 || x >= size || z >= size || !free[id])
                    continue;
                const q = point(id), distance = p.distanceToSquared(q);
                if (distance < best && clear(p, q)) {
                    best = distance;
                    found = id;
                }
            }
        return found;
    };
    return (from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] => {
        if (!isFree(to.x, to.z))
            return [];
        if (clear(from, to))
            return [to.clone()];
        const start = closest(from), goal = closest(to);
        if (start < 0 || goal < 0)
            return [];
        const costs = new Float32Array(free.length).fill(Infinity), parents = new Int32Array(free.length).fill(-1), closed = new Uint8Array(free.length);
        const heap: {
            id: number;
            priority: number;
        }[] = [];
        const push = (id: number, priority: number) => { let i = heap.length; heap.push({ id, priority }); while (i > 0) {
            const p = (i - 1) >> 1;
            if (heap[p].priority <= priority)
                break;
            heap[i] = heap[p];
            i = p;
        } heap[i] = { id, priority }; };
        const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) {
            let i = 0;
            while (i * 2 + 1 < heap.length) {
                let c = i * 2 + 1;
                if (c + 1 < heap.length && heap[c + 1].priority < heap[c].priority)
                    c++;
                if (heap[c].priority >= last.priority)
                    break;
                heap[i] = heap[c];
                i = c;
            }
            heap[i] = last;
        } return top.id; };
        costs[start] = 0;
        push(start, 0);
        while (heap.length) {
            const id = pop();
            if (closed[id])
                continue;
            if (id === goal)
                break;
            closed[id] = 1;
            const x = id % size, z = Math.floor(id / size);
            for (let dz = -1; dz <= 1; dz++)
                for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dz)
                        continue;
                    const nx = x + dx, nz = z + dz, next = nz * size + nx;
                    if (nx < 0 || nz < 0 || nx >= size || nz >= size || !free[next] || closed[next])
                        continue;
                    if (dx && dz && (!free[z * size + nx] || !free[nz * size + x]))
                        continue;
                    const cost = costs[id] + Math.hypot(dx, dz);
                    if (cost >= costs[next])
                        continue;
                    costs[next] = cost;
                    parents[next] = id;
                    push(next, cost + Math.hypot(nx - goal % size, nz - Math.floor(goal / size)));
                }
        }
        if (start !== goal && parents[goal] < 0)
            return [];
        const raw: THREE.Vector3[] = [to.clone()];
        let id = goal;
        while (id !== start) {
            raw.push(point(id));
            id = parents[id];
            if (id < 0)
                return [];
        }
        raw.push(point(start));
        raw.reverse();
        const route: THREE.Vector3[] = [];
        let origin = from, index = 0;
        while (index < raw.length) {
            let furthest = index;
            for (let j = index + 1; j < raw.length; j++) {
                if (clear(origin, raw[j]))
                    furthest = j;
            }
            route.push(raw[furthest]);
            origin = raw[furthest];
            index = furthest + 1;
        }
        return route;
    };
}
