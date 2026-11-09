export type HorizonPhase = "anomaly" | "birth" | "infall" | "void" | "rebirth";
export const clamp = (value: number) => Math.max(0, Math.min(1, value));
export const smooth = (start: number, end: number, value: number) => {
  const p = clamp((value - start) / (end - start));
  return p * p * (3 - 2 * p);
};

// One clock drives the GPU, camera, DOM and sound: about twenty seconds, with one
// second of absolute darkness and silence. Reduced motion replaces the flight with a shorter dissolve.
export function horizonFrame(seconds: number, reduced = false) {
  const birthAt = reduced ? 1.5 : 2.5;
  const infallAt = reduced ? 3.5 : 6.5;
  const voidAt = reduced ? 5.5 : 13;
  const rebirthAt = reduced ? 6.5 : 14;
  const duration = reduced ? 11 : 20;
  const phase: HorizonPhase = seconds < birthAt ? "anomaly"
    : seconds < infallAt ? "birth"
      : seconds < voidAt ? "infall"
        : seconds < rebirthAt ? "void" : "rebirth";
  const birth = smooth(birthAt, infallAt, seconds);
  const pull = smooth(infallAt, voidAt - 0.4, seconds);
  const rebuild = smooth(rebirthAt + 0.3, duration - 1.2, seconds);
  const collapse = phase === "rebirth" ? 1 - rebuild : pull;
  const blackout = smooth(voidAt - 0.8, voidAt, seconds) * (1 - smooth(rebirthAt, rebirthAt + 1.4, seconds));
  return {
    seconds, phase, duration, birth, pull, collapse, rebuild, blackout,
    flash: Math.sin(smooth(rebirthAt, rebirthAt + 1.8, seconds) * Math.PI) * (reduced ? 0.22 : 0.8),
    pressure: phase === "void" || phase === "rebirth" ? 0 : smooth(0, infallAt, seconds),
    done: seconds >= duration,
  };
}
export type HorizonFrame = ReturnType<typeof horizonFrame>;
