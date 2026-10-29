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
  // A far-off blast: a short, low thud that rolls away.
  const boom = (level: number, pan: number) => {
    const time = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(260, time);
    filter.frequency.exponentialRampToValueAtTime(70, time + 1.8);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(level, time + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 2);
    const panner = context.createStereoPanner();
    panner.pan.value = pan;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(master);
    track(source);
    source.start(time, Math.random());
    source.stop(time + 2.05);
    source.onended = () => {
      voices.delete(source);
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
  };
  // A bird's call: a few quick whistled notes sweeping up and down.
  const chirp = (pan: number) => {
    const time = context.currentTime,
      notes = 2 + Math.floor(Math.random() * 4),
      base = 2200 + Math.random() * 1800;
    const gain = context.createGain();
    gain.gain.value = 0;
    const panner = context.createStereoPanner();
    panner.pan.value = pan;
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    for (let n = 0; n < notes; n++) {
      const at = time + n * 0.13;
      oscillator.frequency.setValueAtTime(base * (1 + (n % 2) * 0.18), at);
      oscillator.frequency.exponentialRampToValueAtTime(base * (1.35 - (n % 2) * 0.3), at + 0.08);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.012, at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
    }
    oscillator.connect(gain);
    gain.connect(panner);
    panner.connect(master);
    track(oscillator);
    oscillator.start(time);
    oscillator.stop(time + notes * 0.13 + 0.05);
    oscillator.onended = () => {
      voices.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
  };
  // Surface ambience: the city has a low rumble and passing traffic, the desert mostly wind,
  // the ice base a hum under a howling storm, with the battle thudding in the distance, and
  // the forest leaves stirring with birdsong.
  type Soundscape = "city" | "desert" | "ice" | "forest";
  let city: { stop: () => void; kind: Soundscape } | null = null;
  const startCity = (kind: Soundscape) => {
    const desert = kind === "desert",
      ice = kind === "ice",
      forest = kind === "forest";
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
    const rumble = layer("lowpass", desert ? 120 : ice ? 140 : forest ? 110 : 170, desert ? 0.035 : ice ? 0.045 : forest ? 0.018 : 0.07, 0),
      wind = layer("bandpass", desert ? 820 : ice ? 520 : forest ? 1500 : 620, desert ? 0.026 : ice ? 0.04 : forest ? 0.014 : 0.012, 0.7);
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
      wobble(desert ? 0.08 : ice ? 0.13 : 0.11, desert ? 0.02 : ice ? 0.03 : 0.009, wind.gain.gain),
      wobble(0.045, 260, wind.filter.frequency),
      wobble(0.07, 50, rumble.filter.frequency),
    ];
    let timer: ReturnType<typeof setTimeout>;
    const passBy = () => {
      if (enabled && forest) chirp((Math.random() - 0.5) * 1.6);
      else if (enabled && ice && Math.random() < 0.45) boom(0.035 + Math.random() * 0.04, (Math.random() - 0.5) * 1.2);
      else if (enabled) {
        const side = Math.random() < 0.5 ? -1 : 1;
        hiss({
          duration: desert ? 3.5 + Math.random() * 2 : 2.2 + Math.random() * 2,
          frequency: desert ? [1400 + Math.random() * 600, 500] : [700 + Math.random() * 300, 360],
          level: desert ? 0.008 + Math.random() * 0.008 : 0.01 + Math.random() * 0.01,
          pan: [side * 0.9, -side * 0.9],
        });
      }
      timer = setTimeout(passBy, desert ? 6000 + Math.random() * 9000 : ice ? 3000 + Math.random() * 5000 : forest ? 1200 + Math.random() * 3800 : 2500 + Math.random() * 5500);
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
  // The cantina band: an original eight-bar minor swing at 132 bpm (clarinet-like lead, walking
  // bass, bell-like comping, kick, snaps and shaker), rendered once into a seamless loop, a few
  // notes at a time so the frame rate never stutters while it is built.
  // Heard muffled through the walls outside, full inside; the master sound switch still owns it.
  const cantinaGain = context.createGain();
  cantinaGain.gain.value = 0;
  const cantinaWalls = context.createBiquadFilter();
  cantinaWalls.type = "lowpass";
  cantinaWalls.frequency.value = 800;
  cantinaGain.connect(cantinaWalls);
  cantinaWalls.connect(master);
  let cantinaSource: AudioBufferSourceNode | null = null,
    cantinaLoading = false;
  const band = async () => {
    const beat = 60 / 132,
      rate = context.sampleRate,
      frames = Math.ceil(32 * beat * rate);
    const buffer = context.createBuffer(2, frames, rate),
      left = buffer.getChannelData(0),
      right = buffer.getChannelData(1);
    const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
    // Every voice wraps round the end of the loop, so the seam is inaudible.
    const tasks: (() => void)[] = [];
    const voice = (
      start: number,
      seconds: number,
      pan: number,
      sample: (t: number, i: number) => number,
    ) => tasks.push(() => {
      const offset = Math.floor(start * beat * rate),
        count = Math.floor(seconds * rate),
        l = Math.cos((pan + 1) * Math.PI / 4),
        r = Math.sin((pan + 1) * Math.PI / 4);
      for (let i = 0; i < count; i++) {
        const value = sample(i / rate, i),
          at = (offset + i) % frames;
        left[at] += value * l;
        right[at] += value * r;
      }
    });
    // Lead: odd harmonics for a woody, reedy tone, with a late vibrato.
    const lead: [number, number, number][] = [
      [0, 0.67, 74], [0.67, 0.33, 72], [1, 0.67, 69], [1.67, 0.33, 72], [2, 1, 74], [3.67, 0.33, 77],
      [4, 0.67, 76], [4.67, 0.33, 74], [5, 0.67, 71], [5.67, 0.33, 74], [6, 1.5, 77], [7.67, 0.33, 76],
      [8, 0.67, 74], [8.67, 0.33, 72], [9, 0.67, 69], [9.67, 0.33, 65], [10, 0.67, 67], [10.67, 0.33, 69], [11, 1, 62],
      [12, 0.67, 73], [12.67, 0.33, 76], [13, 0.67, 79], [13.67, 0.33, 76], [14, 1.67, 73], [15.67, 0.33, 69],
      [16, 0.67, 74], [16.67, 0.33, 77], [17, 0.67, 81], [17.67, 0.33, 77], [18, 0.67, 74], [18.67, 0.33, 72], [19, 0.67, 74],
      [20, 0.67, 74], [20.67, 0.33, 70], [21, 0.67, 65], [21.67, 0.33, 68], [22, 1.5, 70], [23.67, 0.33, 69],
      [24, 0.67, 73], [24.67, 0.33, 71], [25, 0.67, 69], [25.67, 0.33, 67], [26, 0.67, 64], [26.67, 0.33, 67], [27, 0.67, 73], [27.67, 0.33, 76],
      [28, 1.5, 74], [29.67, 0.33, 69], [30, 0.67, 74], [30.67, 0.33, 77], [31, 0.67, 74],
    ];
    lead.forEach(([start, length, midi]) => {
      const seconds = length * beat * 0.92,
        frequency = hz(midi);
      let phase = 0;
      voice(start, seconds + 0.05, -0.3, (t) => {
        const vibrato = t > 0.15 ? Math.sin(t * 2 * Math.PI * 5.5) * 0.004 : 0;
        phase += (2 * Math.PI * frequency * (1 + vibrato)) / rate;
        const envelope = Math.min(1, t / 0.02) * Math.exp(-t * 1.6) * Math.min(1, Math.max(0, (seconds + 0.05 - t) / 0.06));
        return (Math.sin(phase) + 0.45 * Math.sin(3 * phase) + 0.22 * Math.sin(5 * phase) + 0.1 * Math.sin(7 * phase)) * envelope * 0.16;
      });
    });
    // Walking bass, one note a beat.
    [38, 41, 45, 48, 43, 47, 50, 47, 38, 41, 45, 44, 45, 49, 52, 49, 50, 45, 41, 45, 34, 38, 41, 44, 33, 37, 40, 43, 38, 45, 38, 33].forEach(
      (midi, i) => {
        const frequency = hz(midi);
        voice(i, beat * 0.95, 0, (t) => {
          const p = 2 * Math.PI * frequency * t;
          return (Math.sin(p) + 0.35 * Math.sin(2 * p) + 0.1 * Math.sin(3 * p)) * Math.min(1, t / 0.006) * Math.exp(-t * 4.5) * 0.36;
        });
      },
    );
    // Bell-like chord stabs on the off-beats: Dm7, G7, Dm7, A7, Dm7, B♭7, A7, Dm7.
    const chords = [[65, 69, 72], [65, 71, 74], [65, 69, 72], [61, 64, 67], [65, 69, 72], [62, 65, 68], [61, 64, 67], [65, 69, 72]];
    chords.forEach((chord, bar) =>
      [1, 3, 3.67].forEach((at) =>
        chord.forEach((midi) => {
          const frequency = hz(midi);
          voice(bar * 4 + at, 0.4, 0.45, (t) => {
            const p = 2 * Math.PI * frequency * t;
            return (Math.sin(p) + 0.4 * Math.sin(2 * p) + 0.18 * Math.sin(2.97 * p)) * Math.min(1, t / 0.003) * Math.exp(-t * 9) * 0.06;
          });
        }),
      ),
    );
    // Kick on one and three, finger snaps on two and four, a swung shaker throughout.
    let seed = 7;
    const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let b = 0; b < 32; b++) {
      if (b % 2 === 0)
        voice(b, 0.3, 0, (t) => Math.sin(2 * Math.PI * (45 * t + (65 / 18) * (1 - Math.exp(-t * 18)))) * Math.exp(-t * 10) * 0.42);
      else {
        let previous = 0;
        voice(b, 0.12, 0.2, (t) => {
          const n = noise(),
            snap = (n - previous) * Math.exp(-t * 38) * 0.14;
          previous = n;
          return snap;
        });
      }
      [0, 0.67].forEach((swing) => {
        let previous = 0;
        voice(b + swing, 0.06, 0.55, (t) => {
          const n = noise(),
            hiss = (n - previous) * Math.exp(-t * 70) * (swing ? 0.05 : 0.032);
          previous = n;
          return hiss;
        });
      });
    }
    let slice = performance.now();
    for (const task of tasks) {
      task();
      if (performance.now() - slice > 6) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        slice = performance.now();
      }
    }
    let peak = 0;
    for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    const scale = 0.85 / Math.max(peak, 1e-6);
    for (let i = 0; i < frames; i++) {
      left[i] *= scale;
      right[i] *= scale;
    }
    return buffer;
  };
  const cantina = (level: number, inside: boolean) => {
    if (closed) return;
    if (level > 0 && !cantinaLoading) {
      cantinaLoading = true;
      void band().then((buffer) => {
        if (closed) return;
        cantinaSource = context.createBufferSource();
        cantinaSource.buffer = buffer;
        cantinaSource.loop = true;
        cantinaSource.connect(cantinaGain);
        cantinaSource.start();
      });
    }
    cantinaGain.gain.setTargetAtTime(level * 0.06, context.currentTime, 0.3);
    cantinaWalls.frequency.setTargetAtTime(inside ? 16000 : 500 + level * 1400, context.currentTime, 0.25);
  };
  const dispose = () => {
    if (closed) return;
    city?.stop();
    city = null;
    closed = true;
    oscillators.forEach((oscillator) => oscillator.stop());
    noise.stop();
    cantinaSource?.stop();
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
    cantina,
    dispose,
  };
}
export type FlightAudio = ReturnType<typeof createFlightAudio>;
