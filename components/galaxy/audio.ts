// Event sounds, synthesised so nothing protected is ever played: sirens that follow their source,
// thunder, a distant hum of traffic and radio blips. Silent until sound is on and a gesture has
// unlocked audio, as every browser requires.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = false;
let siren: { osc: OscillatorNode; gain: GainNode; pan: StereoPannerNode; lfo: OscillatorNode } | null = null;

function ensure() {
  if (ctx || typeof window === "undefined") return ctx;
  const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  try {
    ctx = new Context();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}
const running = () => enabled && ctx?.state === "running" && !!master;

export const galaxyAudio = {
  setEnabled(on: boolean) {
    enabled = on;
    if (on) {
      ensure();
      void ctx?.resume().catch(() => undefined);
    }
    if (ctx && master) master.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.1);
  },
  /** Holds a siren at a level (0 stops it) and a stereo position (-1 to 1). */
  siren(level: number, pan: number) {
    if (!ctx || !master) return;
    if (level <= 0.001 || !enabled) {
      if (siren) {
        const old = siren;
        siren = null;
        old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
        window.setTimeout(() => {
          try {
            old.osc.stop();
            old.lfo.stop();
          } catch {
            // Already stopped.
          }
        }, 700);
      }
      return;
    }
    if (!running()) return;
    if (!siren) {
      const osc = ctx.createOscillator(),
        lfo = ctx.createOscillator(),
        depth = ctx.createGain(),
        gain = ctx.createGain(),
        panner = ctx.createStereoPanner();
      osc.type = "triangle";
      osc.frequency.value = 760;
      lfo.frequency.value = 1.5;
      depth.gain.value = 230;
      gain.gain.value = 0;
      lfo.connect(depth).connect(osc.frequency);
      osc.connect(gain).connect(panner).connect(master);
      osc.start();
      lfo.start();
      siren = { osc, gain, pan: panner, lfo };
    }
    siren.gain.gain.setTargetAtTime(level * 0.1, ctx.currentTime, 0.2);
    siren.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime, 0.2);
  },
  /** Thunder: filtered noise, later and duller the further away the strike. */
  thunder(distance = 0.5) {
    if (!running() || !ctx || !master) return;
    const length = 2.6,
      frames = Math.floor(ctx.sampleRate * length),
      buffer = ctx.createBuffer(1, frames, ctx.sampleRate),
      data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain(),
      at = ctx.currentTime + 0.25 + distance * 1.4;
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = 420 - distance * 240;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.5 * (1 - distance * 0.55), at + 0.09);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    source.connect(filter).connect(gain).connect(master);
    source.start(at);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  },
  /** The astromech opening a channel: two short notes. */
  radio(urgent = false) {
    if (!running() || !ctx || !master) return;
    const time = ctx.currentTime;
    [0, 0.13].forEach((delay, i) => {
      const osc = ctx!.createOscillator(),
        gain = ctx!.createGain();
      osc.type = urgent ? "square" : "sine";
      osc.frequency.value = (urgent ? [620, 620] : [880, 1180])[i];
      gain.gain.setValueAtTime(0.0001, time + delay);
      gain.gain.exponentialRampToValueAtTime(urgent ? 0.05 : 0.08, time + delay + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + delay + 0.11);
      osc.connect(gain).connect(master!);
      osc.start(time + delay);
      osc.stop(time + delay + 0.13);
    });
  },
};
