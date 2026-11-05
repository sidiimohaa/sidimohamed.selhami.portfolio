// The taxi's sound, synthesised with Web Audio: engine and air rush that follow the speed, the
// whoosh of passing traffic, dashboard chimes, the door, the pilot droid's chirps, a calm pad in
// the Temple and the murmur of the Senate. The droid's announcements are spoken by the
// browser's French voice when there is one.

export type TaxiScene = "pad" | "flight" | "temple" | "senate";

export function createTaxiAudio() {
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
  const sources: AudioScheduledSourceNode[] = [];
  const bus = (level: number) => {
    const gain = ctx!.createGain();
    gain.gain.value = level;
    gain.connect(master!);
    return gain;
  };
  const loop = (filterType: BiquadFilterType, frequency: number, q: number, out: AudioNode) => {
    const source = ctx!.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const filter = ctx!.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    source.connect(filter).connect(out);
    source.start();
    sources.push(source);
    return filter;
  };
  const osc = (type: OscillatorType, frequency: number, out: AudioNode) => {
    const node = ctx!.createOscillator();
    node.type = type;
    node.frequency.value = frequency;
    node.connect(out);
    node.start();
    sources.push(node);
    return node;
  };

  // Beds, always running and faded in and out.
  let engine: { gain: GainNode; turbine: OscillatorNode; air: GainNode; airFilter: BiquadFilterNode } | null = null;
  let beds: Record<TaxiScene, GainNode> | null = null;
  if (ctx && master && noise) {
    const engineGain = bus(0);
    const hum = ctx.createBiquadFilter();
    hum.type = "lowpass";
    hum.frequency.value = 240;
    hum.connect(engineGain);
    osc("sawtooth", 57, hum);
    osc("sawtooth", 57.6, hum);
    const whine = ctx.createGain();
    whine.gain.value = 0.05;
    whine.connect(engineGain);
    const turbine = osc("triangle", 180, whine);
    const air = bus(0);
    const airFilter = loop("bandpass", 700, 0.5, air);
    engine = { gain: engineGain, turbine, air, airFilter };

    const city = bus(0);
    loop("lowpass", 260, 0.7, city);
    const wind = ctx.createGain();
    wind.gain.value = 0.25;
    wind.connect(city);
    loop("bandpass", 2300, 0.4, wind);
    const temple = bus(0);
    [110, 164.8, 277.2, 220].forEach((f, i) => {
      const voice = ctx.createGain();
      voice.gain.value = 0.05;
      voice.connect(temple);
      osc("sine", f, voice);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07 + i * 0.03;
      const depth = ctx.createGain();
      depth.gain.value = 0.035;
      lfo.connect(depth).connect(voice.gain);
      lfo.start();
      sources.push(lfo);
    });
    const senate = bus(0);
    const drone = ctx.createBiquadFilter();
    drone.type = "lowpass";
    drone.frequency.value = 170;
    drone.connect(senate);
    osc("sawtooth", 46, drone);
    const murmur = ctx.createGain();
    murmur.gain.value = 0.5;
    murmur.connect(senate);
    loop("bandpass", 620, 1.4, murmur);
    const sway = ctx.createOscillator();
    sway.frequency.value = 0.31;
    const swayDepth = ctx.createGain();
    swayDepth.gain.value = 0.3;
    sway.connect(swayDepth).connect(murmur.gain);
    sway.start();
    sources.push(sway);
    beds = { pad: city, flight: city, temple, senate };
  }
  const levels: Record<TaxiScene, number> = { pad: 0.16, flight: 0.12, temple: 0.9, senate: 0.5 };
  let scene: TaxiScene = "pad";
  const ramp = (param: AudioParam, value: number, seconds = 0.8) => {
    if (!ctx) return;
    param.cancelScheduledValues(ctx.currentTime);
    param.setTargetAtTime(value, ctx.currentTime, seconds / 3);
  };
  const applyScene = () => {
    if (!beds) return;
    (Object.keys(beds) as TaxiScene[]).forEach((key) => ramp(beds![key].gain, 0));
    ramp(beds[scene].gain, levels[scene], 1.6);
  };

  const tone = (from: number, to: number, seconds: number, level: number, type: OscillatorType = "sine", delay = 0, pan = 0) => {
    if (!ctx || !master || !enabled) return;
    const node = ctx.createOscillator(),
      gain = ctx.createGain(),
      panner = ctx.createStereoPanner(),
      at = ctx.currentTime + delay;
    node.type = type;
    node.frequency.setValueAtTime(from, at);
    node.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + seconds);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    panner.pan.value = pan;
    node.connect(gain).connect(panner).connect(master);
    node.start(at);
    node.stop(at + seconds + 0.05);
    node.onended = () => panner.disconnect();
  };
  const hiss = (seconds: number, level: number, from: number, to: number, delay = 0, pan = 0) => {
    if (!ctx || !master || !noise || !enabled) return;
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain(),
      panner = ctx.createStereoPanner(),
      at = ctx.currentTime + delay;
    source.buffer = noise;
    filter.type = "bandpass";
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(to, at + seconds);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + seconds * 0.35);
    gain.gain.linearRampToValueAtTime(0, at + seconds);
    panner.pan.setValueAtTime(-pan, at);
    panner.pan.linearRampToValueAtTime(pan, at + seconds);
    source.connect(filter).connect(gain).connect(panner).connect(master);
    source.start(at, Math.random() * 1.5);
    source.stop(at + seconds + 0.05);
    source.onended = () => panner.disconnect();
  };

  return {
    setEnabled: (on: boolean) => {
      enabled = on;
      if (!ctx || !master) return;
      if (on && ctx.state === "suspended") void ctx.resume();
      ramp(master.gain, on ? 0.85 : 0, 0.4);
      if (on) applyScene();
    },
    setScene: (next: TaxiScene) => {
      scene = next;
      applyScene();
    },
    // Engine level 0 to 1 (idle to full thrust) and the speed it pushes through the air.
    setEngine: (level: number, speed: number) => {
      if (!engine || !ctx) return;
      ramp(engine.gain.gain, 0.05 + level * 0.11, 0.3);
      ramp(engine.turbine.frequency, 170 + speed * 380, 0.4);
      ramp(engine.air.gain, speed * speed * 0.2, 0.4);
      ramp(engine.airFilter.frequency, 500 + speed * 1100, 0.4);
    },
    whoosh: (pan: number, level: number) => {
      hiss(0.9, 0.22 * level, 360, 1700, 0, pan);
      tone(190, 120, 0.8, 0.04 * level, "sawtooth", 0.05, pan);
    },
    chime: (kind: "hover" | "select" | "confirm" | "arrive" | "holocron") => {
      if (kind === "hover") tone(1760, 1700, 0.06, 0.03);
      else if (kind === "select") {
        tone(880, 880, 0.12, 0.06);
        tone(1318, 1318, 0.16, 0.05, "sine", 0.07);
      } else if (kind === "confirm") [659, 880, 1318].forEach((f, i) => tone(f, f, 0.35, 0.06, "sine", i * 0.09));
      else if (kind === "arrive") [523, 659, 784, 1046].forEach((f, i) => tone(f, f * 0.995, 1.2, 0.05, "sine", i * 0.14));
      else [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, f, 0.5, 0.025, "triangle", i * 0.06));
    },
    door: (open: boolean) => {
      hiss(0.7, 0.12, open ? 1800 : 600, open ? 500 : 1800);
      tone(open ? 140 : 110, open ? 90 : 70, 0.25, 0.08, "square", open ? 0.55 : 0.6);
    },
    droid: () => {
      const count = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const f = 900 + Math.random() * 1400;
        tone(f, f * (0.7 + Math.random() * 0.8), 0.07 + Math.random() * 0.06, 0.035, "sine", i * 0.09);
      }
    },
    vote: () => {
      [392, 494, 587, 784, 988].forEach((f, i) => tone(f, f, 0.9, 0.05, "sine", i * 0.16));
      hiss(3.2, 0.1, 500, 900, 0.3);
    },
    dispose: () => {
      sources.forEach((source) => {
        try {
          source.stop();
        } catch {
          // Already stopped.
        }
      });
      void ctx?.close();
    },
  };
}
export type TaxiAudio = ReturnType<typeof createTaxiAudio>;
