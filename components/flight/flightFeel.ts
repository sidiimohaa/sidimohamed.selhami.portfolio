// The weight of manual flight: springs for the craft's lean and its place in the frame, a trauma
// based camera shake, the thrust curve and the gamepad. No scene access here, so it can be tested.

export type Spring = { value: number; velocity: number };

export const spring = (value = 0): Spring => ({ value, velocity: 0 });

export function resetSpring(s: Spring, value = 0) {
  s.value = value;
  s.velocity = 0;
}

/** A damped spring, sub-stepped so a long frame cannot make it explode. */
export function stepSpring(s: Spring, target: number, stiffness: number, damping: number, dt: number) {
  if (!(dt > 0)) return s.value;
  const steps = Math.max(1, Math.ceil(dt / 0.012));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    s.velocity += ((target - s.value) * stiffness - s.velocity * damping) * h;
    s.value += s.velocity * h;
  }
  return s.value;
}

export type ShakeOffset = { x: number; y: number; z: number };

/** Camera shake from accumulated "trauma": squared, so small jolts stay small and big ones read. */
export function createShake(maxAngle = 0.02) {
  let trauma = 0;
  return {
    get trauma() {
      return trauma;
    },
    add(amount: number) {
      trauma = Math.min(1, trauma + amount);
    },
    /** A floor that lasts as long as it is asked for (sustained boost). */
    hold(level: number) {
      trauma = Math.max(trauma, Math.min(1, level));
    },
    reset() {
      trauma = 0;
    },
    step(dt: number, time: number, out: ShakeOffset) {
      trauma = Math.max(0, trauma - dt * 1.5);
      const power = trauma * trauma * maxAngle;
      // Sums of sines at unrelated rates: smooth, never repeating within a flight.
      out.x = power * (Math.sin(time * 37.1) * 0.6 + Math.sin(time * 61.7 + 1.3) * 0.4);
      out.y = power * (Math.sin(time * 41.3 + 2.1) * 0.6 + Math.sin(time * 53.9 + 0.4) * 0.4);
      out.z = power * 0.6 * (Math.sin(time * 29.7 + 4.2) * 0.6 + Math.sin(time * 47.3 + 3.1) * 0.4);
      return out;
    },
  };
}

export const FEEL = {
  // How fast the speed closes on its target (1/s): building up, under boost, and coasting.
  accelerate: 1.7,
  boost: 2.1,
  coast: 1.15,
  // Constant braking added while coasting, so the craft actually comes to rest (units/s²).
  friction: 2.2,
};

type Vec = { x: number; y: number; z: number };

/**
 * Moves the velocity toward thrust along `forward`. Under thrust it closes exponentially on the
 * target speed, which also lets the craft slide a little through a turn. Released, it coasts and
 * a constant brake brings it to a true stop.
 */
export function stepVelocity(velocity: Vec, forward: Vec, targetSpeed: number, thrusting: boolean, boosting: boolean, dt: number) {
  if (!(dt > 0)) return;
  const rate = thrusting ? (boosting ? FEEL.boost : FEEL.accelerate) : FEEL.coast;
  const k = 1 - Math.exp(-dt * rate);
  const goal = thrusting ? targetSpeed : 0;
  velocity.x += (forward.x * goal - velocity.x) * k;
  velocity.y += (forward.y * goal - velocity.y) * k;
  velocity.z += (forward.z * goal - velocity.z) * k;
  if (!thrusting) {
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
    const drop = FEEL.friction * dt;
    if (speed <= drop || speed < 1e-6) velocity.x = velocity.y = velocity.z = 0;
    else {
      const keep = (speed - drop) / speed;
      velocity.x *= keep;
      velocity.y *= keep;
      velocity.z *= keep;
    }
  }
}

/** Stick travel with a dead zone, rescaled so it still reaches ±1. */
export function deadzone(value: number, zone = 0.16) {
  const magnitude = Math.abs(value);
  if (magnitude <= zone) return 0;
  return Math.sign(value) * Math.min(1, (magnitude - zone) / (1 - zone));
}

export type PadFrame = {
  connected: boolean;
  x: number;
  y: number;
  thrust: boolean;
  boost: boolean;
  // Buttons that went down on this frame (standard mapping indices).
  pressed: number[];
};

type PadLike = { connected: boolean; mapping?: string; axes: readonly number[]; buttons: readonly { pressed: boolean; value: number }[] };

/**
 * Standard mapping: left stick steers, the right trigger or A thrusts, the left trigger, either
 * bumper or X boosts. `held` remembers last frame's buttons, to report presses once.
 */
export function readPad(pads: readonly (PadLike | null)[], held: boolean[]): PadFrame {
  const pad = pads.find((candidate) => candidate && candidate.connected) ?? null;
  const frame: PadFrame = { connected: !!pad, x: 0, y: 0, thrust: false, boost: false, pressed: [] };
  if (!pad) {
    held.length = 0;
    return frame;
  }
  frame.x = deadzone(pad.axes[0] ?? 0);
  // Pushing the stick up climbs, like the arrow keys.
  frame.y = -deadzone(pad.axes[1] ?? 0);
  const down = (index: number) => !!pad.buttons[index] && (pad.buttons[index].pressed || pad.buttons[index].value > 0.35);
  // The d-pad steers too.
  if (down(14)) frame.x = -1;
  if (down(15)) frame.x = 1;
  if (down(12)) frame.y = 1;
  if (down(13)) frame.y = -1;
  frame.thrust = down(7);
  frame.boost = down(6) || down(4) || down(5) || down(2);
  for (let index = 0; index < pad.buttons.length; index++) {
    const now = down(index);
    if (now && !held[index]) frame.pressed.push(index);
    held[index] = now;
  }
  return frame;
}
