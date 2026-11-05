// R-X7's voice, entirely synthesised: no recording from anywhere. Short warbles, a thinking trill, a
// servo whine. It only ever speaks once the visitor has allowed sound, and never starts on its own.

export type DroidSound = "wake" | "beep" | "chirp" | "think" | "confirm" | "error" | "servo" | "send";

// Each sound is a list of notes: start and end pitch (Hz), length (s), loudness, waveform.
type Note = [number, number, number, number, OscillatorType?];
const sounds: Record<DroidSound, Note[]> = {
  beep: [[1180, 1240, 0.07, 0.035], [1500, 1420, 0.06, 0.03]],
  chirp: [[900, 1700, 0.09, 0.04], [1700, 1050, 0.07, 0.035], [1250, 2050, 0.11, 0.04], [2050, 1500, 0.06, 0.03]],
  send: [[1050, 1500, 0.06, 0.03]],
  think: [[1300, 1420, 0.05, 0.022], [1420, 1180, 0.05, 0.022], [1180, 1560, 0.05, 0.022], [1560, 1280, 0.06, 0.022]],
  confirm: [[980, 980, 0.06, 0.035], [1470, 1560, 0.11, 0.04]],
  error: [[520, 330, 0.17, 0.045, "triangle"], [300, 240, 0.14, 0.04, "triangle"]],
  servo: [[170, 340, 0.15, 0.022, "sawtooth"], [340, 210, 0.1, 0.016, "sawtooth"]],
  wake: [[380, 900, 0.14, 0.03, "triangle"], [900, 1500, 0.1, 0.035], [1500, 1760, 0.07, 0.03]],
};

export function createDroidVoice() {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  return {
    play(name: DroidSound) {
      if (typeof AudioContext === "undefined") return;
      if (!context) {
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = 0.9;
        master.connect(context.destination);
      }
      if (context.state === "suspended") void context.resume();
      let time = context.currentTime + 0.01;
      for (const [from, to, length, level, wave] of sounds[name]) {
        const oscillator = context.createOscillator(),
          gain = context.createGain();
        oscillator.type = wave ?? "sine";
        // A little variation, so that it never sounds like the same sample twice.
        const drift = 0.96 + Math.random() * 0.08;
        oscillator.frequency.setValueAtTime(from * drift, time);
        oscillator.frequency.exponentialRampToValueAtTime(to * drift, time + length);
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(level, time + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
        oscillator.connect(gain);
        gain.connect(master!);
        oscillator.start(time);
        oscillator.stop(time + length + 0.02);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
        time += length * 0.92;
      }
    },
    dispose() {
      void context?.close();
      context = null;
    },
  };
}
