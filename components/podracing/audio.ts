import type { PodRaceEvent, PodRaceState } from "./types";

/** The two turbines have independent pitch, colour and stereo position. */
export function createPodAudio() {
  const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  let ctx: AudioContext;
  try { ctx = new Context(); } catch { return null; }
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  const engines = [-1, 1].map((side) => {
    const carrier = ctx.createOscillator();
    carrier.type = side < 0 ? "sawtooth" : "triangle";
    carrier.frequency.value = side < 0 ? 39 : 48;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 180;
    const volume = ctx.createGain();
    volume.gain.value = 0;
    const pan = ctx.createStereoPanner();
    pan.pan.value = -side * .58;
    carrier.connect(filter).connect(volume).connect(pan).connect(master);
    carrier.start();
    return { carrier, filter, volume };
  });

  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const noise = buffer.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < noise.length; i++) {
    brown = brown * .86 + (Math.random() * 2 - 1) * .14;
    noise[i] = brown;
  }
  const wind = ctx.createBufferSource();
  wind.buffer = buffer;
  wind.loop = true;
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = "bandpass";
  windFilter.frequency.value = 480;
  const windVolume = ctx.createGain();
  windVolume.gain.value = 0;
  wind.connect(windFilter).connect(windVolume).connect(master);
  wind.start();

  let enabled = false;
  let disposed = false;
  const unlock = () => {
    if (enabled && !disposed && ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  };
  window.addEventListener("pointerdown", unlock, true);
  window.addEventListener("pointerup", unlock, true);
  const voices = new Set<OscillatorNode>();
  const tone = (from: number, to: number, seconds: number, strength: number, type: OscillatorType = "sine", delay = 0) => {
    if (!enabled || disposed || voices.size >= 14 || ctx.state !== "running") return;
    const time = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, time);
    oscillator.frequency.exponentialRampToValueAtTime(to, time + seconds);
    envelope.gain.setValueAtTime(.0001, time);
    envelope.gain.exponentialRampToValueAtTime(strength, time + .018);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + seconds);
    oscillator.connect(envelope).connect(master);
    voices.add(oscillator);
    oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(time);
    oscillator.stop(time + seconds + .01);
  };
  return {
    resume: unlock,
    setEnabled(value: boolean) {
      enabled = value;
      if (value) void ctx.resume().catch(() => undefined);
      master.gain.setTargetAtTime(value ? .52 : 0, ctx.currentTime, .045);
    },
    tick(state: PodRaceState, quiet: boolean) {
      const time = ctx.currentTime;
      const player = state.player;
      const throttle = player.speed / 145;
      engines.forEach((engine, index) => {
        const damage = 1 - player.health[index];
        const flutter = Math.sin(time * (index ? 31 : 26)) * damage * 8;
        engine.carrier.frequency.setTargetAtTime((index ? 48 : 39) + throttle * (index ? 117 : 104) + flutter, time, .045);
        engine.filter.frequency.setTargetAtTime(200 + throttle * 1100 + (player.boosting ? 500 : 0), time, .08);
        engine.volume.gain.setTargetAtTime(quiet ? 0 : (.052 + throttle * .06) * (1 - damage * .66), time, .09);
      });
      windVolume.gain.setTargetAtTime(quiet ? 0 : Math.min(.32, throttle * .19 + player.slipstream * .065), time, .07);
      windFilter.frequency.setTargetAtTime(400 + throttle * 900, time, .1);
    },
    event(event: PodRaceEvent) {
      switch (event) {
        case "countdown": tone(420, 410, .16, .19, "triangle"); break;
        case "go": tone(680, 870, .29, .23, "triangle"); break;
        case "hit": tone(118, 29, .31, .32, "sawtooth"); break;
        case "boost": tone(145, 620, .48, .17, "sawtooth"); break;
        case "pad":
        case "mini": tone(370, 890, .22, .18, "triangle"); break;
        case "overheat": tone(560, 510, .17, .22, "square"); tone(560, 510, .17, .2, "square", .22); break;
        case "near":
        case "overtake": tone(250, 130, .19, .12, "triangle"); break;
        case "shot": tone(1500, 240, .2, .2, "square"); tone(1100, 180, .24, .12, "sawtooth", .05); break;
        case "dodge": tone(520, 760, .16, .12, "triangle"); break;
        case "lap": tone(610, 690, .25, .17, "sine"); break;
        case "finish": tone(440, 440, .35, .2); tone(554, 554, .35, .2, "sine", .14); tone(659, 659, .55, .2, "sine", .27); break;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("pointerup", unlock, true);
      for (const voice of voices) { try { voice.stop(); } catch {} }
      for (const engine of engines) engine.carrier.stop();
      wind.stop();
      void ctx.close().catch(() => undefined);
    },
  };
}
