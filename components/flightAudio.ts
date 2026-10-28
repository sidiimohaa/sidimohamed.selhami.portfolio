export type FlightMix = { throttle: number; boost: boolean };

export function createFlightAudio() {
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = 0;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -18;
  limiter.ratio.value = 4;
  master.connect(limiter);
  limiter.connect(context.destination);
  let enabled = false,
    closed = false;
  const engine = context.createGain();
  engine.gain.value = 0.01;
  const engineFilter = context.createBiquadFilter();
  engineFilter.type = "lowpass";
  engineFilter.frequency.value = 220;
  engine.connect(engineFilter);
  engineFilter.connect(master);
  const oscillators = [44, 66, 88].map((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = index === 0 ? "sawtooth" : "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(engine);
    oscillator.start();
    return oscillator;
  });
  const noiseBuffer = context.createBuffer(
    1,
    context.sampleRate * 2,
    context.sampleRate,
  );
  const samples = noiseBuffer.getChannelData(0);
  let seed = 1977;
  for (let i = 0; i < samples.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    samples[i] = (seed / 4294967296 - 0.5) * 2;
  }
  const noise = context.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;
  const noiseFilter = context.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = 160;
  const noiseGain = context.createGain();
  noiseGain.gain.value = 0.002;
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(master);
  noise.start();
  const voices = new Set<AudioBufferSourceNode | OscillatorNode>();
  const track = (voice: AudioBufferSourceNode | OscillatorNode) => {
    voices.add(voice);
    voice.onended = () => {
      voices.delete(voice);
      voice.disconnect();
    };
  };
  const setEnabled = (value: boolean) => {
    if (closed) return;
    enabled = value;
    if (value) void context.resume();
    master.gain.setTargetAtTime(value ? 0.6 : 0, context.currentTime, 0.08);
  };
  const flight = ({ throttle, boost }: FlightMix) => {
    if (closed) return;
    const value = Math.max(0, Math.min(1, throttle)),
      time = context.currentTime;
    engine.gain.setTargetAtTime(0.009 + value * 0.025, time, 0.08);
    engineFilter.frequency.setTargetAtTime(220 + value * 1050, time, 0.08);
    noiseGain.gain.setTargetAtTime(0.002 + value * 0.026, time, 0.08);
    noiseFilter.frequency.setTargetAtTime(160 + value * 650, time, 0.08);
    oscillators.forEach((oscillator, index) =>
      oscillator.frequency.setTargetAtTime(
        [44, 66, 88][index] * (1 + value * (boost ? 1.2 : 0.7)),
        time,
        0.09,
      ),
    );
  };
  const exit = (level = 1) => {
    if (!enabled || closed) return;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.7;
    const gain = context.createGain(),
      time = context.currentTime;
    filter.frequency.setValueAtTime(1800, time);
    filter.frequency.exponentialRampToValueAtTime(120, time + 1.65);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.07 * level, time + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.7);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    track(source);
    source.start(time);
    source.stop(time + 1.8);
    source.onended = () => {
      voices.delete(source);
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  };
  // A distant ship charging, then the low thump of the jump to lightspeed.
  const jump = () => {
    if (!enabled || closed) return;
    const time = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(260, time);
    filter.frequency.exponentialRampToValueAtTime(3200, time + 0.55);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.045, time + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.95);
    const thump = context.createOscillator(),
      thumpGain = context.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(140, time + 0.48);
    thump.frequency.exponentialRampToValueAtTime(38, time + 1.1);
    thumpGain.gain.setValueAtTime(0.0001, time + 0.46);
    thumpGain.gain.exponentialRampToValueAtTime(0.08, time + 0.52);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, time + 1.15);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    thump.connect(thumpGain);
    thumpGain.connect(master);
    track(source);
    track(thump);
    source.start(time);
    source.stop(time + 1);
    thump.start(time + 0.46);
    thump.stop(time + 1.2);
    source.onended = () => {
      voices.delete(source);
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    thump.onended = () => {
      voices.delete(thump);
      thump.disconnect();
      thumpGain.disconnect();
    };
  };
  const droid = () => {
    if (!enabled || closed) return;
    [880, 1320, 740].forEach((frequency, index) => {
      const oscillator = context.createOscillator(),
        gain = context.createGain(),
        time = context.currentTime + index * 0.12;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, time);
      oscillator.frequency.exponentialRampToValueAtTime(
        frequency * (index === 1 ? 1.15 : 0.84),
        time + 0.11,
      );
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(0.055, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
      oscillator.connect(gain);
      gain.connect(master);
      track(oscillator);
      oscillator.start(time);
      oscillator.stop(time + 0.14);
      oscillator.onended = () => {
        voices.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  };
  // A filtered noise voice for passing traffic, swept in pitch and across the stereo field.
  const hiss = (options: {
    duration: number;
    frequency: [number, number];
    level: number;
    pan: [number, number];
  }) => {
    const time = context.currentTime,
      end = time + options.duration;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(options.frequency[0], time);
    filter.frequency.exponentialRampToValueAtTime(options.frequency[1], end);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(options.level, time + options.duration * 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    const panner = context.createStereoPanner();
    panner.pan.setValueAtTime(options.pan[0], time);
    panner.pan.linearRampToValueAtTime(options.pan[1], end);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(master);
    track(source);
    source.start(time, Math.random() * 1.5);
    source.stop(end + 0.05);
    source.onended = () => {
      voices.delete(source);
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
  };
  // Surface ambience: the city has a low rumble and passing traffic, the desert mostly wind.
  type Soundscape = "city" | "desert";
  let city: { stop: () => void; kind: Soundscape } | null = null;
  const startCity = (kind: Soundscape) => {
    const desert = kind === "desert";
    const time = context.currentTime;
    const bed = context.createGain();
    bed.gain.setValueAtTime(0.0001, time);
    bed.gain.exponentialRampToValueAtTime(1, time + 2);
    bed.connect(master);
    const layer = (type: BiquadFilterType, frequency: number, level: number, offset: number) => {
      const source = context.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = frequency;
      filter.Q.value = 0.5;
      const gain = context.createGain();
      gain.gain.value = level;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(bed);
      source.start(time, offset);
      return { source, filter, gain };
    };
    const rumble = layer("lowpass", desert ? 120 : 170, desert ? 0.035 : 0.07, 0),
      wind = layer("bandpass", desert ? 820 : 620, desert ? 0.026 : 0.012, 0.7);
    const wobble = (frequency: number, depth: number, target: AudioParam) => {
      const oscillator = context.createOscillator(),
        amount = context.createGain();
      oscillator.frequency.value = frequency;
      amount.gain.value = depth;
      oscillator.connect(amount);
      amount.connect(target);
      oscillator.start(time);
      return oscillator;
    };
    const motion = [
      wobble(desert ? 0.08 : 0.11, desert ? 0.02 : 0.009, wind.gain.gain),
      wobble(0.045, 260, wind.filter.frequency),
      wobble(0.07, 50, rumble.filter.frequency),
    ];
    let timer: ReturnType<typeof setTimeout>;
    const passBy = () => {
      if (enabled) {
        const side = Math.random() < 0.5 ? -1 : 1;
        hiss({
          duration: desert ? 3.5 + Math.random() * 2 : 2.2 + Math.random() * 2,
          frequency: desert ? [1400 + Math.random() * 600, 500] : [700 + Math.random() * 300, 360],
          level: desert ? 0.008 + Math.random() * 0.008 : 0.01 + Math.random() * 0.01,
          pan: [side * 0.9, -side * 0.9],
        });
      }
      timer = setTimeout(passBy, desert ? 6000 + Math.random() * 9000 : 2500 + Math.random() * 5500);
    };
    timer = setTimeout(passBy, 1500);
    return {
      kind,
      stop: () => {
        clearTimeout(timer);
        const now = context.currentTime;
        bed.gain.cancelScheduledValues(now);
        bed.gain.setValueAtTime(Math.max(bed.gain.value, 0.0001), now);
        bed.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
        [rumble.source, wind.source, ...motion].forEach((node) => node.stop(now + 0.9));
        setTimeout(() => bed.disconnect(), 1000);
      },
    };
  };
  const ambience = (kind: Soundscape | null) => {
    if (closed) return;
    // On the ground the space engine falls silent and the surface takes over.
    const time = context.currentTime;
    engine.gain.setTargetAtTime(kind ? 0 : 0.009, time, 0.3);
    noiseGain.gain.setTargetAtTime(kind ? 0 : 0.002, time, 0.3);
    if (city && city.kind !== kind) {
      city.stop();
      city = null;
    }
    if (kind && !city) city = startCity(kind);
  };
  // A boot on the metal deck: a short click over a soft thump.
  const step = () => {
    if (!enabled || closed || !city) return;
    const time = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1300 + Math.random() * 500;
    filter.Q.value = 1.4;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.016, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
    const thump = context.createOscillator(),
      body = context.createGain();
    thump.frequency.setValueAtTime(110, time);
    thump.frequency.exponentialRampToValueAtTime(55, time + 0.08);
    body.gain.setValueAtTime(0.0001, time);
    body.gain.exponentialRampToValueAtTime(0.018, time + 0.005);
    body.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    thump.connect(body);
    body.connect(master);
    track(source);
    track(thump);
    source.start(time, Math.random() * 1.8);
    source.stop(time + 0.12);
    thump.start(time);
    thump.stop(time + 0.12);
    source.onended = () => {
      voices.delete(source);
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    thump.onended = () => {
      voices.delete(thump);
      thump.disconnect();
      body.disconnect();
    };
  };
  // A soft rising chord when a hologram comes alive.
  const chime = () => {
    if (!enabled || closed) return;
    [1046.5, 1568, 2093].forEach((frequency, index) => {
      const time = context.currentTime + index * 0.05;
      const tone = context.createOscillator(),
        gain = context.createGain();
      tone.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(0.02 / (index + 1), time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.5);
      tone.connect(gain);
      gain.connect(master);
      track(tone);
      tone.start(time);
      tone.stop(time + 0.55);
      tone.onended = () => {
        voices.delete(tone);
        tone.disconnect();
        gain.disconnect();
      };
    });
  };
  // An air taxi gliding in from the left, or pulling away to the right.
  const speeder = (phase: "arrive" | "leave") => {
    if (!enabled || closed) return;
    const arriving = phase === "arrive",
      duration = arriving ? 6.5 : 5.5,
      time = context.currentTime;
    hiss({
      duration,
      frequency: arriving ? [300, 900] : [900, 320],
      level: 0.03,
      pan: arriving ? [-0.8, 0] : [0, 0.8],
    });
    const hum = context.createOscillator(),
      filter = context.createBiquadFilter(),
      gain = context.createGain(),
      panner = context.createStereoPanner();
    hum.type = "sawtooth";
    hum.frequency.setValueAtTime(arriving ? 150 : 95, time);
    hum.frequency.exponentialRampToValueAtTime(arriving ? 88 : 170, time + duration);
    filter.type = "lowpass";
    filter.frequency.value = 520;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.02, time + (arriving ? duration * 0.8 : 0.6));
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    panner.pan.setValueAtTime(arriving ? -0.6 : 0, time);
    panner.pan.linearRampToValueAtTime(arriving ? 0 : 0.7, time + duration);
    hum.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(master);
    track(hum);
    hum.start(time);
    hum.stop(time + duration + 0.05);
    hum.onended = () => {
      voices.delete(hum);
      hum.disconnect();
      filter.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
  };
  const dispose = () => {
    if (closed) return;
    city?.stop();
    city = null;
    closed = true;
    oscillators.forEach((oscillator) => oscillator.stop());
    noise.stop();
    voices.forEach((voice) => {
      try {
        voice.stop();
      } catch {}
    });
    voices.clear();
    void context.close();
  };
  return {
    setEnabled,
    flight,
    exit,
    jump,
    droid,
    chime,
    step,
    speeder,
    ambience,
    dispose,
  };
}
export type FlightAudio = ReturnType<typeof createFlightAudio>;
