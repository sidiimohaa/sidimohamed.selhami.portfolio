export type HorizonPhase = "anomaly" | "birth" | "infall" | "void" | "rebirth";
export const clamp = (value: number) => Math.max(0, Math.min(1, value));
export const smooth = (start: number, end: number, value: number) => {
  const p = clamp((value - start) / (end - start));
  return p * p * (3 - 2 * p);
};

// One clock drives the GPU, camera, DOM, captions and sound. Reduced motion keeps the
// two seconds of absolute silence, but replaces the flight with a shorter dissolve.
export function horizonFrame(seconds: number, reduced = false) {
  const birthAt = reduced ? 2 : 4.5;
  const infallAt = reduced ? 5 : 10.5;
  const voidAt = reduced ? 7 : 21;
  const rebirthAt = reduced ? 12 : 26;
  const duration = reduced ? 16 : 32;
  const phase: HorizonPhase = seconds < birthAt ? "anomaly"
    : seconds < infallAt ? "birth"
      : seconds < voidAt ? "infall"
        : seconds < rebirthAt ? "void" : "rebirth";
  const birth = smooth(birthAt, infallAt, seconds);
  const pull = smooth(infallAt, voidAt - 0.4, seconds);
  const rebuild = smooth(rebirthAt + 0.3, duration - 1.2, seconds);
  const collapse = phase === "rebirth" ? 1 - rebuild : pull;
  const blackout = smooth(voidAt - 0.8, voidAt, seconds) * (1 - smooth(rebirthAt, rebirthAt + 1.4, seconds));
  const message = phase === "void"
    ? seconds < voidAt + 2 ? "" : seconds < voidAt + 3.5 ? "REALITY HAS COLLAPSED" : "REINITIALIZING GALACTIC SYSTEMS..."
    : phase === "rebirth" ? seconds > duration - 2.4 ? "EVENT HORIZON — SECRET DISCOVERED" : "RESTORING GALACTIC SYSTEMS"
      : phase === "anomaly" ? "WARNING — GRAVITATIONAL ANOMALY DETECTED"
        : phase === "birth" ? "THE SINGULARITY" : "EVENT HORIZON — NO ESCAPE";
  return {
    seconds, phase, duration, birth, pull, collapse, rebuild, blackout, message,
    flash: Math.sin(smooth(rebirthAt, rebirthAt + 1.8, seconds) * Math.PI) * (reduced ? 0.22 : 0.8),
    pressure: phase === "void" || phase === "rebirth" ? 0 : smooth(0, infallAt, seconds),
    done: seconds >= duration,
  };
}
export type HorizonFrame = ReturnType<typeof horizonFrame>;
