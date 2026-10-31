// Small synthesised sounds for Galactic Arcade and its simulations: interface chirps, lasers,
// explosions, alarms, engines. All generated with Web Audio; nothing recorded or downloaded.

export type ArcadeAudio = ReturnType<typeof createArcadeAudio>;

export function createArcadeAudio() {
  const Context = typeof window !== "undefined" ? window.AudioContext : undefined;
  const ctx = Context ? new Context() : null;
  let enabled = false;
  const master = ctx?.createGain() ?? null;
  if (ctx && master) {
    master.gain.value = 0;
    master.connect(ctx.destination);
  }
  const noise = ctx ? ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate) : null;
  if (noise) {
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  // A continuous engine hum whose level and pitch the games set every frame.
  const hum = ctx?.createOscillator() ?? null,
    humFilter = ctx?.createBiquadFilter() ?? null,
    humGain = ctx?.createGain() ?? null;
  if (ctx && hum && humFilter && humGain && master) {
    hum.type = "sawtooth";
    hum.frequency.value = 55;
    humFilter.type = "lowpass";
    humFilter.frequency.value = 300;
    humGain.gain.value = 0;
    hum.connect(humFilter).connect(humGain).connect(master);
    hum.start();
  }
  const tone = (from: number, to: number, seconds: number, level: number, type: OscillatorType = "sine", delay = 0) => {
    if (!ctx || !master || !enabled) return;
    const osc = ctx.createOscillator(),
      gain = ctx.createGain(),
      at = ctx.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + seconds);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + seconds + 0.05);
    osc.onended = () => gain.disconnect();
  };
  const burst = (seconds: number, level: number, cutoff: number) => {
    if (!ctx || !master || !noise || !enabled) return;
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain(),
      at = ctx.currentTime;
    source.buffer = noise;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, at);
    filter.frequency.exponentialRampToValueAtTime(60, at + seconds);
    gain.gain.setValueAtTime(level, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    source.connect(filter).connect(gain).connect(master);
    source.start(at);
    source.stop(at + seconds + 0.05);
    source.onended = () => gain.disconnect();
  };
  return {
    setEnabled(value: boolean) {
      enabled = value;
      if (value && ctx?.state === "suspended") void ctx.resume().catch(() => undefined);
      if (ctx && master) master.gain.setTargetAtTime(value ? 0.5 : 0, ctx.currentTime, 0.05);
    },
    ui(kind: "hover" | "select" | "back" | "boot" | "error" | "coin" | "unlock") {
      if (kind === "hover") tone(1800, 1700, 0.04, 0.03);
      if (kind === "select") (tone(900, 1400, 0.08, 0.06, "triangle"), tone(1400, 1400, 0.06, 0.04, "sine", 0.07));
      if (kind === "back") tone(1100, 700, 0.09, 0.05, "triangle");
      if (kind === "boot") [520, 780, 1040, 1560].forEach((f, i) => tone(f, f * 1.02, 0.14, 0.05, "sine", i * 0.11));
      if (kind === "error") (tone(240, 180, 0.18, 0.08, "square"), tone(240, 180, 0.18, 0.08, "square", 0.22));
      if (kind === "coin") [988, 1319].forEach((f, i) => tone(f, f, 0.12, 0.06, "square", i * 0.08));
      if (kind === "unlock") [660, 880, 1320, 1760].forEach((f, i) => tone(f, f, 0.18, 0.07, "triangle", i * 0.09));
    },
    laser: () => (tone(1500, 220, 0.14, 0.12, "sawtooth"), tone(420, 90, 0.1, 0.06, "triangle")),
    enemyLaser: () => tone(700, 160, 0.18, 0.06, "square"),
    torpedo: () => (tone(240, 60, 0.5, 0.14, "sawtooth"), burst(0.4, 0.12, 2200)),
    hit: () => tone(1300, 300, 0.06, 0.08, "triangle"),
    explosion: (size = 1) => (burst(0.5 + size * 0.4, Math.min(0.9, 0.3 + size * 0.3), 900), tone(90, 25, 0.5, 0.25 * size, "triangle")),
    damage: () => (burst(0.2, 0.3, 700), tone(160, 70, 0.2, 0.15, "square")),
    alarm: () => [0, 0.6, 1.2].forEach((d) => (tone(400, 780, 0.4, 0.08, "square", d), tone(780, 400, 0.15, 0.06, "square", d + 0.4))),
    boost: () => (burst(0.6, 0.18, 3200), tone(180, 520, 0.5, 0.08, "sawtooth")),
    whoosh: () => burst(0.35, 0.16, 2600),
    // A TIE fighter's howl as it screams past the canopy.
    scream: () => (tone(1250, 420, 0.7, 0.05, "sawtooth"), tone(1310, 450, 0.7, 0.04, "square")),
    crash: () => (burst(0.6, 0.6, 1100), tone(110, 30, 0.4, 0.3, "square")),
    success: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.32, 0.09, "triangle", i * 0.15)),
    fail: () => [330, 262, 196].forEach((f, i) => tone(f, f * 0.85, 0.4, 0.09, "triangle", i * 0.2)),
    engine(level: number, pitch = 55) {
      if (!ctx || !humGain || !hum) return;
      humGain.gain.setTargetAtTime(enabled ? Math.max(0, Math.min(0.12, level)) : 0, ctx.currentTime, 0.1);
      hum.frequency.setTargetAtTime(pitch, ctx.currentTime, 0.1);
    },
    dispose() {
      enabled = false;
      try {
        hum?.stop();
      } catch {
        // Already stopped.
      }
      if (ctx && ctx.state !== "closed") void ctx.close().catch(() => undefined);
    },
  };
}
