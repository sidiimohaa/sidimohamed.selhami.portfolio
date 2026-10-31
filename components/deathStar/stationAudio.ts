// The station's sound, synthesised with Web Audio: no recording to license. A low industrial hum
// with the hiss of the air vents, doors, terminal chirps, the lift, a mouse droid and a breath.

export function createStationAudio() {
  const Context = typeof window !== "undefined" ? window.AudioContext : undefined;
  const ctx = Context ? new Context() : null;
  let enabled = false;
  const master = ctx?.createGain() ?? null;
  if (ctx && master) {
    master.gain.value = 0;
    master.connect(ctx.destination);
  }
  const noise = ctx ? ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate) : null;
  if (noise) {
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  // The hum: two detuned low saws and filtered air, always running, faded by the master.
  const bed: AudioScheduledSourceNode[] = [];
  if (ctx && master && noise) {
    const humGain = ctx.createGain();
    humGain.gain.value = 0.16;
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 140;
    low.connect(humGain).connect(master);
    for (const f of [41, 41.6, 82.3]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = f;
      osc.connect(low);
      osc.start();
      bed.push(osc);
    }
    const air = ctx.createBufferSource();
    air.buffer = noise;
    air.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 520;
    band.Q.value = 0.6;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.035;
    air.connect(band).connect(airGain).connect(master);
    air.start();
    bed.push(air);
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
    gain.gain.linearRampToValueAtTime(level, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + seconds + 0.05);
    osc.onended = () => gain.disconnect();
  };
  const hiss = (seconds: number, level: number, from: number, to: number, delay = 0) => {
    if (!ctx || !master || !noise || !enabled) return;
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain(),
      at = ctx.currentTime + delay;
    source.buffer = noise;
    filter.type = "bandpass";
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(to, at + seconds);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + seconds * 0.25);
    gain.gain.linearRampToValueAtTime(0, at + seconds);
    source.connect(filter).connect(gain).connect(master);
    source.start(at);
    source.stop(at + seconds + 0.05);
    source.onended = () => gain.disconnect();
  };
  return {
    setEnabled(value: boolean) {
      enabled = value;
      if (value && ctx?.state === "suspended") void ctx.resume().catch(() => undefined);
      if (ctx && master) master.gain.setTargetAtTime(value ? 0.55 : 0, ctx.currentTime, 0.3);
    },
    door: () => (hiss(0.55, 0.22, 2400, 500), tone(140, 70, 0.4, 0.05, "square")),
    open: () => [880, 1320, 1760].forEach((f, i) => tone(f, f, 0.09, 0.05, "sine", i * 0.06)),
    close: () => [1320, 880].forEach((f, i) => tone(f, f, 0.08, 0.045, "sine", i * 0.06)),
    step: () => hiss(0.08, 0.03, 900, 300),
    lift: () => (tone(60, 140, 2.2, 0.12, "sawtooth"), hiss(2.2, 0.08, 300, 1200)),
    intro: () => (tone(55, 38, 6, 0.18, "sawtooth"), hiss(5, 0.12, 200, 1800)),
    denied: () => (tone(220, 160, 0.2, 0.08, "square"), tone(220, 160, 0.2, 0.08, "square", 0.26)),
    granted: () => [660, 990, 1320].forEach((f, i) => tone(f, f, 0.16, 0.07, "triangle", i * 0.1)),
    droid: () => [2200, 2600, 2000, 2900].forEach((f, i) => tone(f, f * 1.1, 0.05, 0.05, "square", i * 0.07)),
    breath: () => [0, 1.6].forEach((d) => (hiss(0.9, 0.18, 380, 900, d), hiss(0.9, 0.14, 900, 300, d + 0.85))),
    dispose() {
      enabled = false;
      bed.forEach((node) => {
        try {
          node.stop();
        } catch {
          // Already stopped.
        }
      });
      if (ctx && ctx.state !== "closed") void ctx.close().catch(() => undefined);
    },
  };
}
export type StationAudio = ReturnType<typeof createStationAudio>;
