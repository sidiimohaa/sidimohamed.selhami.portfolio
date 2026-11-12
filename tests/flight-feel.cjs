const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);

const { spring, stepSpring, createShake, stepVelocity, deadzone, readPad } = require("../components/flight/flightFeel.ts");

const forward = { x: 0, y: 0, z: -1 };
const speedOf = (v) => Math.hypot(v.x, v.y, v.z);
const fly = (velocity, seconds, target, thrust, boost, fps = 60) => {
  for (let i = 0; i < seconds * fps; i++) stepVelocity(velocity, forward, target, thrust, boost, 1 / fps);
};

// Thrust builds up instead of snapping to speed, and never overshoots the target.
{
  const v = { x: 0, y: 0, z: 0 };
  fly(v, 0.25, 8, true, false);
  assert.ok(speedOf(v) > 1.5 && speedOf(v) < 4.5, `a quarter second of thrust is a third of cruise, got ${speedOf(v)}`);
  fly(v, 2.5, 8, true, false);
  assert.ok(speedOf(v) > 7.6 && speedOf(v) <= 8, `cruise is reached in under three seconds, got ${speedOf(v)}`);
  fly(v, 2.5, 24, true, true);
  assert.ok(speedOf(v) > 23 && speedOf(v) <= 24, `boost is reached, got ${speedOf(v)}`);
}

// Released, the craft coasts on its inertia, then comes to a true stop: no drift left over.
{
  const v = { x: 0, y: 0, z: -8 };
  fly(v, 0.5, 8, false, false);
  assert.ok(speedOf(v) > 2 && speedOf(v) < 6, `still coasting after half a second, got ${speedOf(v)}`);
  fly(v, 1.5, 8, false, false);
  assert.equal(speedOf(v), 0, "at rest two seconds after releasing cruise");
  const fast = { x: 0, y: 0, z: -24 };
  fly(fast, 3, 24, false, false);
  assert.equal(speedOf(fast), 0, "at rest three seconds after releasing the boost");
}

// The same flight at 30 and 120 frames a second ends at nearly the same speed.
{
  const slow = { x: 0, y: 0, z: 0 }, quick = { x: 0, y: 0, z: 0 };
  fly(slow, 1, 8, true, false, 30);
  fly(quick, 1, 8, true, false, 120);
  assert.ok(Math.abs(speedOf(slow) - speedOf(quick)) < 0.05, "frame-rate independent thrust");
}

// A zero or negative time step (the first animation frame) changes nothing and never yields NaN.
{
  const v = { x: 0, y: 0, z: 0 };
  stepVelocity(v, forward, 8, false, false, -0.004);
  stepVelocity(v, forward, 8, false, false, 0);
  assert.deepEqual(v, { x: 0, y: 0, z: 0 });
  const s = spring(1);
  assert.equal(stepSpring(s, 0, 30, 7.6, -0.01), 1);
}

// The roll spring settles on its target, overshooting only a little, even through a long frame.
{
  const s = spring();
  let peak = 0;
  for (let i = 0; i < 240; i++) peak = Math.max(peak, stepSpring(s, 0.5, 30, 7.6, 1 / 60));
  assert.ok(Math.abs(s.value - 0.5) < 0.002, "settled");
  assert.ok(peak > 0.5 && peak < 0.56, `a touch of overshoot, got ${peak}`);
  const rough = spring();
  for (let i = 0; i < 20; i++) stepSpring(rough, 0.5, 30, 7.6, 0.25);
  assert.ok(Number.isFinite(rough.value) && Math.abs(rough.value - 0.5) < 0.01, "stable with quarter-second frames");
}

// Shake: bounded, decays to nothing, and a held floor lasts only while it is held.
{
  const shake = createShake(0.02), out = { x: 0, y: 0, z: 0 };
  shake.add(5);
  assert.equal(shake.trauma, 1);
  shake.step(1 / 60, 1, out);
  assert.ok(Math.abs(out.x) <= 0.02 && Math.abs(out.y) <= 0.02 && Math.abs(out.z) <= 0.02);
  for (let i = 0; i < 120; i++) shake.step(1 / 60, i / 60, out);
  assert.equal(shake.trauma, 0);
  assert.deepEqual([out.x, out.y, out.z].map(Math.abs), [0, 0, 0]);
  shake.hold(0.3);
  assert.ok(shake.trauma >= 0.3);
}

// Gamepad: dead zone, steering sense, triggers, and button presses reported once.
{
  assert.equal(deadzone(0.1), 0);
  assert.equal(deadzone(1), 1);
  assert.ok(deadzone(-0.58) < -0.45 && deadzone(-0.58) > -0.55);
  const button = (pressed, value = pressed ? 1 : 0) => ({ pressed, value });
  const buttons = Array.from({ length: 16 }, () => button(false));
  const pad = { connected: true, mapping: "standard", axes: [0.9, -0.9, 0, 0], buttons };
  const held = [];
  let frame = readPad([null, pad], held);
  assert.ok(frame.connected && frame.x > 0.8 && frame.y > 0.8, "stick right and up steers right and climbs");
  assert.ok(!frame.thrust && !frame.boost && frame.pressed.length === 0);
  buttons[0] = button(true);
  buttons[7] = button(false, 0.8);
  buttons[6] = button(true);
  frame = readPad([pad], held);
  assert.deepEqual(frame.pressed.includes(0), true);
  assert.ok(frame.thrust && frame.boost);
  frame = readPad([pad], held);
  assert.equal(frame.pressed.includes(0), false, "a held button is not pressed again");
  frame = readPad([], held);
  assert.ok(!frame.connected && frame.x === 0 && held.length === 0);
}

console.log("flight feel: ok");
