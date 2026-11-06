// A short passage through black between two parts of a zone: the scene reads `level` for its veil,
// and what must change does so while the screen is dark.
export function createTransit() {
  let time = -1,
    change: (() => void) | null = null;
  const smooth = (x: number) => {
    const t = Math.min(1, Math.max(0, x));
    return t * t * (3 - 2 * t);
  };
  return {
    start(then: () => void, reduced: boolean) {
      if (reduced) {
        then();
        return;
      }
      change = then;
      time = 0;
    },
    busy: () => time >= 0,
    tick(dt: number) {
      if (time < 0) return;
      time += dt;
      if (time >= 0.42 && change) {
        change();
        change = null;
      }
      if (time > 1.1) time = -1;
    },
    level: () => (time < 0 ? 0 : smooth(time / 0.36) * (1 - smooth((time - 0.6) / 0.5))),
  };
}
