// Maps an HTML element of size (w, h) onto four projected screen points with a CSS matrix3d, so a
// real, focusable interface can sit on a plane inside the 3D cockpit and follow its perspective.

type M3 = number[];
const adjugate = (m: M3): M3 => [
  m[4] * m[8] - m[5] * m[7],
  m[2] * m[7] - m[1] * m[8],
  m[1] * m[5] - m[2] * m[4],
  m[5] * m[6] - m[3] * m[8],
  m[0] * m[8] - m[2] * m[6],
  m[2] * m[3] - m[0] * m[5],
  m[3] * m[7] - m[4] * m[6],
  m[1] * m[6] - m[0] * m[7],
  m[0] * m[4] - m[1] * m[3],
];
const multiply = (a: M3, b: M3): M3 => {
  const c: M3 = [];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) sum += a[3 * i + k] * b[3 * k + j];
      c[3 * i + j] = sum;
    }
  return c;
};
const apply = (m: M3, v: number[]) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
// The projective map taking the unit square's corners to four points.
function basis(p: [number, number][]): M3 {
  const m = [p[0][0], p[1][0], p[2][0], p[0][1], p[1][1], p[2][1], 1, 1, 1];
  const v = apply(adjugate(m), [p[3][0], p[3][1], 1]);
  return multiply(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
}

/** Corners in order: top-left, top-right, bottom-left, bottom-right, in CSS pixels. */
export function holoMatrix(w: number, h: number, corners: [number, number][]) {
  const from = basis([
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ]);
  const to = basis(corners);
  const t = multiply(to, adjugate(from));
  const n = t.map((value) => value / t[8]);
  return `matrix3d(${n[0]},${n[3]},0,${n[6]},${n[1]},${n[4]},0,${n[7]},0,0,1,0,${n[2]},${n[5]},0,${n[8]})`;
}
