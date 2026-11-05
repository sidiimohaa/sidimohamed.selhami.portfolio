import type { DefenseEvent, DefenseState } from "./types";

type Voice = { stop: () => void };
const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));

/** Original Web Audio effects, created by the caller inside the Start gesture. */
export function createDefenseAudio() {
  const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  let disposed = false, enabled = false, volume = .55, lastAlarm = -Infinity;
  const ctx = Context ? new Context() : null;
  const voices = new Set<Voice>();
  const master = ctx?.createGain() ?? null;
  if (ctx && master) { master.gain.value = 0; master.connect(ctx.destination); }
  const noise = ctx?.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate) ?? null;
  if (noise) {
    const samples = noise.getChannelData(0); let seed = 1980;
    for (let i = 0; i < samples.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; samples[i] = seed / 4294967296 * 2 - 1; }
  }
  const wind = ctx?.createBufferSource() ?? null, windFilter = ctx?.createBiquadFilter() ?? null, windGain = ctx?.createGain() ?? null;
  const engine = ctx?.createOscillator() ?? null, engineGain = ctx?.createGain() ?? null;
  // The low growl of Imperial ground vehicles, louder the more of them are on the field.
  const armour = ctx?.createOscillator() ?? null, armourFilter = ctx?.createBiquadFilter() ?? null, armourGain = ctx?.createGain() ?? null;
  if (ctx && wind && windFilter && windGain && engine && engineGain && master) {
    wind.buffer = noise; wind.loop = true; windFilter.type = "lowpass"; windFilter.frequency.value = 380;
    windGain.gain.value = 0; wind.connect(windFilter).connect(windGain).connect(master); wind.start();
    engine.type = "triangle"; engine.frequency.value = 49; engineGain.gain.value = 0;
    engine.connect(engineGain).connect(master); engine.start();
    if (armour && armourFilter && armourGain) {
      armour.type = "sawtooth"; armour.frequency.value = 36; armourFilter.type = "lowpass"; armourFilter.frequency.value = 160; armourGain.gain.value = 0;
      armour.connect(armourFilter).connect(armourGain).connect(master); armour.start();
    }
  }
  const resume = () => { if (ctx?.state === "suspended") void ctx.resume().catch(() => undefined); };
  const register = (source: AudioScheduledSourceNode, nodes: AudioNode[], end: number) => {
    if (!ctx) return;
    if (voices.size >= 24) voices.values().next().value?.stop();
    let done = false;
    const cleanup = () => { if (done) return; done = true; for (const node of [source, ...nodes]) { try { node.disconnect(); } catch {} } voices.delete(voice); };
    const voice: Voice = { stop: () => { try { source.stop(); } catch {} cleanup(); } };
    voices.add(voice); source.onended = cleanup; source.start(); source.stop(end);
  };
  const tone = (from: number, to: number, seconds: number, level: number, type: OscillatorType = "sine", delay = 0) => {
    if (!ctx || !master || disposed || !enabled) return;
    const source = ctx.createOscillator(), gain = ctx.createGain(), now = ctx.currentTime + delay;
    source.type = type; source.frequency.setValueAtTime(from, now); source.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + seconds);
    gain.gain.setValueAtTime(0, ctx.currentTime); gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(level, now + .008); gain.gain.exponentialRampToValueAtTime(.0001, now + seconds);
    source.connect(gain).connect(master); register(source, [gain], now + seconds + .025);
  };
  const burst = (seconds: number, level: number, cutoff: number, resonance = .7) => {
    if (!ctx || !noise || !master || disposed || !enabled) return;
    const source = ctx.createBufferSource(), gain = ctx.createGain(), filter = ctx.createBiquadFilter(), now = ctx.currentTime;
    source.buffer = noise; filter.type = "lowpass"; filter.frequency.setValueAtTime(cutoff, now); filter.frequency.exponentialRampToValueAtTime(65, now + seconds); filter.Q.value = resonance;
    gain.gain.setValueAtTime(level, now); gain.gain.exponentialRampToValueAtTime(.0001, now + seconds);
    source.connect(filter).connect(gain).connect(master); register(source, [filter, gain], now + seconds + .025);
  };
  return {
    /** The cockpit klaxon at the start of the mission: three rising and falling whoops. */
    alarm() {
      for (let i = 0; i < 3; i++) { tone(380, 760, .42, .11, "square", i * .62); tone(760, 380, .16, .08, "square", i * .62 + .42); }
    },
    setEnabled(value: boolean) {
      if (disposed) return;
      enabled = value;
      if (value) resume(); else for (const voice of [...voices]) voice.stop();
      if (ctx && master) master.gain.setTargetAtTime(value ? volume * .55 : 0, ctx.currentTime, .04);
    },
    setVolume(value: number) {
      if (disposed) return;
      volume = clamp(Number.isFinite(value) ? value : .55);
      if (ctx && master) master.gain.setTargetAtTime(enabled ? volume * .55 : 0, ctx.currentTime, .04);
    },
    play(event: DefenseEvent) {
      if (!enabled || disposed || !ctx) return;
      switch (event.type) {
        case "shot": tone(840, 125, .13, .24, "sawtooth"); tone(260, 60, .1, .12, "triangle"); break;
        case "hit": tone(event.amount === 0 ? 510 : 1200, 190, .055, .15, "triangle"); break;
        case "explosion": burst(.55, clamp((event.amount ?? 1) * .38, .25, .9), 900); tone(75, 24, .42, .34, "triangle"); break;
        case "damage": burst(.16, .28, 750); tone(155, 80, .17, .16, "square"); break;
        // A ground-shaking thud, then the whine of the walker's leg servos.
        case "step": burst(.18, .18, 160); tone(46, 25, .22, .2, "triangle"); tone(230, 150, .38, .045, "sawtooth", .1); break;
        case "special": tone(190, 1450, .65, .15, "sine"); burst(.55, .26, 1700); break;
        case "cooldown": burst(.38, .18, 2400); tone(640, 1000, .18, .07); break;
        case "overheat": tone(610, 480, .21, .12, "square"); tone(610, 480, .21, .12, "square", .25); break;
        case "wave": tone(350, 350, .16, .11); tone(540, 540, .19, .1, "sine", .2); break;
        case "boss": tone(65, 38, 1.1, .3, "sawtooth"); tone(180, 110, .7, .09, "triangle", .3); burst(1.6, .3, 220, 2); break;
        case "victory": [330, 415, 495, 660].forEach((frequency, i) => tone(frequency, frequency, .3, .12, "triangle", i * .17)); break;
        case "defeat": [220, 165, 110].forEach((frequency, i) => tone(frequency, frequency * .8, .4, .1, "triangle", i * .22)); break;
        case "radio": tone(1540, 1280, .045, .035, "sine"); tone(1050, 1050, .045, .025, "sine", .08); break;
      }
    },
    tick(state: DefenseState, _dt: number) {
      if (!ctx || disposed) return;
      const active = enabled && (state.phase === "playing" || state.phase === "transition");
      windGain?.gain.setTargetAtTime(active ? .065 + Math.sin(state.time * .4) * .012 : 0, ctx.currentTime, .15);
      windFilter?.frequency.setTargetAtTime(280 + Math.sin(state.time * .2) * 120, ctx.currentTime, .3);
      engineGain?.gain.setTargetAtTime(active ? .025 : 0, ctx.currentTime, .15);
      engine?.frequency.setTargetAtTime(49 + state.heat * .06, ctx.currentTime, .2);
      const vehicles = state.enemies.filter(e => e.alive && (e.kind === "scout" || e.kind === "tank" || e.kind === "atat")).length;
      armourGain?.gain.setTargetAtTime(active ? Math.min(.05, vehicles * .009) : 0, ctx.currentTime, .4);
      if (active && state.phase === "playing" && (state.base < 25 || state.shields < 25) && state.time - lastAlarm > 3) {
        lastAlarm = state.time; tone(440, 330, .2, .07, "sine"); tone(440, 330, .2, .07, "sine", .28);
      }
      if (state.phase === "paused" || state.phase === "briefing") { for (const voice of [...voices]) voice.stop(); if (state.phase === "briefing") lastAlarm = -Infinity; }
    },
    dispose() {
      if (disposed) return; disposed = true; enabled = false;
      for (const voice of [...voices]) voice.stop();
      for (const source of [wind, engine, armour]) { try { source?.stop(); } catch {} }
      for (const node of [wind, windFilter, windGain, engine, engineGain, armour, armourFilter, armourGain, master]) { try { node?.disconnect(); } catch {} }
      if (ctx && ctx.state !== "closed") void ctx.close().catch(() => undefined);
    },
  };
}
