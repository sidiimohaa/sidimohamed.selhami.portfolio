import type { HorizonFrame } from "./timeline";

export function createHorizonAudio() {
  if (typeof AudioContext === "undefined") return null;
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = 0;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -20;
  limiter.ratio.value = 8;
  master.connect(limiter).connect(context.destination);
  const pan = context.createStereoPanner();
  pan.connect(master);
  const bass = context.createGain();
  bass.gain.value = 0.22;
  bass.connect(pan);
  const tones = [35, 52.7, 71].map((frequency, i) => {
    const node = context.createOscillator();
    node.type = i === 1 ? "triangle" : "sine";
    node.frequency.value = frequency;
    node.connect(bass);
    node.start();
    return node;
  });
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 1138, brown = 0;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    brown = (brown + (seed / 4294967296 - 0.5) * 0.04) / 1.02;
    data[i] = brown * 3.5;
  }
  const noise = context.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 100;
  noise.connect(filter).connect(pan);
  noise.start();
  void context.resume().catch(() => undefined);
  let closed = false;
  return {
    update(frame: HorizonFrame) {
      if (closed) return;
      const t = context.currentTime;
      const silent = frame.phase === "void";
      const level = silent ? 0 : frame.phase === "rebirth" ? frame.flash * 0.11 : 0.025 + frame.pressure * 0.13;
      if (silent) {
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(0, t);
      } else master.gain.setTargetAtTime(level, t, 0.06);
      filter.frequency.setTargetAtTime(frame.phase === "rebirth" ? 1800 : 90 + frame.pull * 1200, t, 0.12);
      pan.pan.setTargetAtTime(Math.sin(frame.seconds * 0.38) * 0.6, t, 0.1);
      tones.forEach((node, i) => node.frequency.setTargetAtTime([35, 52.7, 71][i] * (1 + frame.pull * 0.65), t, 0.12));
    },
    dispose() {
      if (closed) return;
      closed = true;
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setValueAtTime(0, context.currentTime);
      noise.stop();
      tones.forEach((node) => node.stop());
      void context.close().catch(() => undefined);
    },
  };
}
