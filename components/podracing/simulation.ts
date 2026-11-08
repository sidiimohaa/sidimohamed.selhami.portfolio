import { branchOffset, hazardLane } from "./tracks";
import { podModules, type PodModuleId, type PodModuleStats } from "./modules";
import { neutralInput, upgradeKeys } from "./types";
import type { GhostFrame, PodInput, PodRaceEvent, PodRaceOptions, PodRaceState, PodResult, PodSimulation, PodUpgrades, PodVehicle } from "./types";

const STEP = 1 / 120;
const MAX_FRAME = 0.25;
const POD_HALF_WIDTH = 2.1;
const POD_HALF_LENGTH = 3.5;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const unit = (n: number) => clamp(n, 0, 1);
const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));
const localDistance = (d: number, length: number) => ((d % length) + length) % length;
const difference = (d: number, length: number) => d - Math.round(d / length) * length;

type Pilot = {
  id: string;
  name: string;
  color: number;
  module: PodModuleId;
  power: number;
  aggression: number;
  risk: number;
  bias: number;
};
const rivals: Pilot[] = [
  { id: "sebulba", name: "Sebulba", color: 0xf58a39, module: "mammoth", power: 1.035, aggression: .95, risk: .88, bias: .32 },
  { id: "gasgano", name: "Gasgano", color: 0x76edab, module: "pedrovia", power: 1.00, aggression: .35, risk: .48, bias: -.42 },
  { id: "beedo", name: "Aldar Beedo", color: 0xc7a0ff, module: "manta", power: .982, aggression: .32, risk: .72, bias: .15 },
  { id: "mawhonic", name: "Mawhonic", color: 0xe96a87, module: "gpe", power: .958, aggression: .18, risk: .38, bias: -.25 },
  { id: "pagalies", name: "Teemto Pagalies", color: 0xe2d07c, module: "longtail", power: .97, aggression: .49, risk: .60, bias: .45 },
  { id: "quadinaros", name: "Ben Quadinaros", color: 0x70c7ff, module: "quadra", power: .95, aggression: .22, risk: .51, bias: -.48 },
];

type Racer = {
  vehicle: PodVehicle;
  pilot?: Pilot;
  upgrades: PodUpgrades;
  stats: PodModuleStats;
  overheating: [boolean, boolean];
  nextPlan: number;
  targetLane: number;
  aiBoost: boolean;
  aiBrake: boolean;
  aiDrift: boolean;
  aiRepair: boolean;
  errorUntil: number;
  errorSide: number;
  contactCooldown: number;
  boostCooldown: number;
  branchMetres: number;
  branchLap: number;
  creditedBranches: Set<number>;
  lastPad: number;
  startedLapAt: number | null;
  bestLap: number | null;
};

function randomGenerator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function levels(value?: PodUpgrades): PodUpgrades {
  return Object.fromEntries(upgradeKeys.map((key) => [key, clamp(Math.floor(value?.[key] || 0), 0, 4)])) as PodUpgrades;
}

function createRacer(id: string, name: string, color: number, module: PodModuleId, distance: number, lane: number, upgrades: PodUpgrades, pilot?: Pilot): Racer {
  return {
    vehicle: { id, name, color, module, distance, lane, speed: 0, lateral: 0, roll: 0, heat: [.06, .08], health: [1, 1], boost: 1, boosting: false, repairing: false, drifting: false, driftCharge: 0, miniTurbo: 0, slipstream: 0, hit: 0, branch: -1, finishedAt: null },
    pilot, upgrades, stats: podModules[module].stats, overheating: [false, false], nextPlan: 0, targetLane: lane, aiBoost: false, aiBrake: false, aiDrift: false, aiRepair: false,
    errorUntil: 0, errorSide: 0, contactCooldown: 0, boostCooldown: 0, branchMetres: 0, branchLap: -1,
    creditedBranches: new Set(), lastPad: -1, startedLapAt: null, bestLap: null,
  };
}

/** A deterministic fixed-step simulation shared by the renderer, replay and headless tests. */
export function createPodSimulation(options: PodRaceOptions): PodSimulation {
  const { track, mode, difficulty } = options;
  const arcade = mode === "arcade";
  const solo = mode === "time" || mode === "challenge";
  const laps = clamp(Math.floor(options.laps || 1), 1, 5);
  const finishDistance = track.length * laps;
  const random = randomGenerator(options.seed ?? 1999);
  const playerModule = options.pod?.module ?? "ulzer";
  const player = createRacer("player", "Toi", options.pod?.color ?? 0x68c5ff, playerModule, solo ? 0 : -24, 0, levels(options.upgrades));
  const opponents = solo ? [] : rivals.map((pilot, i) => createRacer(pilot.id, pilot.name, pilot.color, pilot.module, -Math.floor(i / 2) * 8 - 2, i % 2 ? 3.6 : -3.6, levels(), pilot));
  const racers = [player, ...opponents];
  const state: PodRaceState = {
    phase: "countdown", countdown: 3, time: 0, lap: 1, laps, position: racers.length,
    player: player.vehicle, opponents: opponents.map((racer) => racer.vehicle), standings: [],
    crashes: 0, miniTurbos: 0, shortcuts: 0, nearMisses: 0, dodges: 0, shots: [], topSpeed: 0, alert: "",
  };
  const events: PodRaceEvent[] = ["countdown"];
  const ghost: GhostFrame[] = [];
  const previousDistance = racers.map((racer) => racer.vehicle.distance);
  const previousLane = racers.map((racer) => racer.vehicle.lane);
  let accumulator = 0;
  let countdownSteps = Math.round(state.countdown / STEP);
  let nextGhost = 0;
  let ghostInterval = .1;
  let alertUntil = 0;
  let nextOvertake = 0;
  let lastPosition = racers.length;
  // Tusken raiders fire once per lap each, at where the visitor is heading. Recruits get half of
  // them, and more time to see the shot coming.
  const raiders = options.raiders ? track.raiders : [];
  const raiderLap = raiders.map(() => -1);
  const shotFlight = difficulty === "rookie" ? 1.35 : difficulty === "ace" ? .95 : 1.12;
  let nextShot = 0;

  const announce = (event: PodRaceEvent, message = "") => {
    events.push(event);
    if (message) {
      state.alert = message;
      alertUntil = state.time + 2.3;
    }
  };
  const ranking = () => {
    const order = [...racers].sort((a, b) => {
      const av = a.vehicle;
      const bv = b.vehicle;
      if (av.finishedAt !== null || bv.finishedAt !== null) return (av.finishedAt ?? Infinity) - (bv.finishedAt ?? Infinity);
      return bv.distance - av.distance || (a === player ? 1 : b === player ? -1 : 0);
    });
    state.position = order.indexOf(player) + 1;
    state.standings = order.map(({ vehicle }, i) => ({ id: vehicle.id, name: vehicle.name, position: i + 1, time: vehicle.finishedAt }));
  };

  function recordGhost(force = false) {
    if (!force && state.time + STEP / 2 < nextGhost) return;
    const v = player.vehicle;
    const frame = { time: Number(state.time.toFixed(3)), distance: Number(v.distance.toFixed(2)), lane: Number(v.lane.toFixed(2)) };
    if (ghost.length && ghost[ghost.length - 1].time === frame.time) ghost[ghost.length - 1] = frame;
    else ghost.push(frame);
    nextGhost = state.time + ghostInterval;
    if (ghost.length > 3000) {
      for (let i = 1; i * 2 < ghost.length; i++) ghost[i] = ghost[i * 2];
      ghost.length = Math.ceil(ghost.length / 2);
      ghostInterval *= 2;
      nextGhost = state.time + ghostInterval;
    }
  }

  function damage(racer: Racer, side: 0 | 1, amount: number, message: string, slowdown: number) {
    if (racer.contactCooldown > 0 || racer.vehicle.finishedAt !== null) return false;
    const v = racer.vehicle;
    racer.contactCooldown = .64;
    const hit = amount / (1 + racer.upgrades.armor * .21) * (arcade ? .73 : 1) / racer.stats.armor;
    v.health[side] = unit(v.health[side] - hit);
    v.health[1 - side] = unit(v.health[1 - side] - hit * .18);
    v.heat[side] = unit(v.heat[side] + hit * .65);
    v.hit = 1;
    v.driftCharge = 0;
    v.speed *= slowdown;
    if (racer === player) {
      state.crashes++;
      announce("hit", message);
    }
    return true;
  }

  function draft(racer: Racer) {
    const v = racer.vehicle;
    let wake = 0;
    let turbulence = 0;
    if (v.speed < 22) return { wake, turbulence };
    for (const other of racers) {
      if (other === racer || other.vehicle.finishedAt !== null) continue;
      const o = other.vehicle;
      const gap = difference(o.distance - v.distance, track.length);
      const lateral = Math.abs(o.lane - v.lane);
      if (gap > 6 && gap < 45 && lateral < 3.6) {
        wake = Math.max(wake, (1 - (gap - 6) / 39) * (1 - lateral / 3.6));
        if (o.boosting && gap < 13) turbulence = Math.max(turbulence, (13 - gap) / 7);
      }
    }
    return { wake, turbulence };
  }

  function planAi(racer: Racer) {
    const v = racer.vehicle;
    const pilot = racer.pilot!;
    const current = track.sample(v.distance);
    const d = localDistance(v.distance, track.length);
    const future = track.sample(v.distance + Math.max(18, v.speed * .72));
    const half = Math.min(current.width, future.width) - POD_HALF_WIDTH - .6;
    const lookahead = Math.max(32, v.speed * 1.0);
    const candidates = [-half * .82, -half * .38, 0, half * .38, half * .82];
    const branch = track.branches.find((route) => d >= route.start - 35 && d < route.end - 16);
    const branching = branch && difficulty !== "rookie" && pilot.risk > (difficulty === "ace" ? .4 : .62);
    if (branch && (branching || v.branch >= 0)) candidates.push(branchOffset(branch, d + Math.min(lookahead * .52, 39)));

    let minimum = Infinity;
    let best = 0;
    for (const lane of candidates) {
      const inBranch = branch && Math.abs(lane - branchOffset(branch, d + 39)) < branch.width && Math.abs(lane) > half * .72;
      let score = Math.abs(lane - pilot.bias * half) * .13 + Math.abs(lane - v.lane) * .075;
      if (inBranch && branching) score -= 2.25 + pilot.risk * 2;
      for (const hazard of track.hazards) {
        const gap = localDistance(hazard.distance - d, track.length);
        if (gap > lookahead || gap < 2) continue;
        const delta = Math.abs(lane - hazardLane(hazard, state.time + gap / Math.max(26, v.speed)));
        const margin = hazard.radius + POD_HALF_WIDTH + (difficulty === "rookie" ? .5 : 1.2);
        if (delta < margin) score += (margin - delta) * (4.8 - gap / lookahead);
      }
      for (const other of racers) {
        if (other === racer || other.vehicle.finishedAt !== null) continue;
        const o = other.vehicle;
        const gap = difference(o.distance - v.distance, track.length);
        if (gap > 44 || gap < -10) continue;
        const delta = Math.abs(lane - o.lane);
        // Faster pilots choose free air for an overtake. Sebulba sometimes leans into a duel.
        const duel = pilot.aggression > .8 && Math.abs(gap) < 11 && Math.abs(v.speed - o.speed) < 15;
        if (duel) score += Math.abs(delta - 2.1) * .53;
        else if (delta < 3.7) score += (3.7 - delta) * (gap < 17 ? 2.3 : .8);
      }
      if (score < minimum) {
        minimum = score;
        best = lane;
      }
    }
    const chance = difficulty === "rookie" ? .036 : difficulty === "pilot" ? .015 : .006;
    if (random() < chance) {
      racer.errorUntil = state.time + .3 + random() * .37;
      racer.errorSide = random() < .5 ? -1 : 1;
    }
    racer.targetLane = best;
    const curvature = Math.max(Math.abs(current.curve), Math.abs(future.curve));
    const hot = Math.max(...v.heat);
    racer.aiRepair = Math.min(...v.health) < (.37 + pilot.risk * .06) && curvature < .010;
    racer.aiBoost = !racer.aiRepair && hot < (.57 + pilot.risk * .29) && v.boost > .17 && v.speed > 36
      && curvature < (difficulty === "ace" ? .009 : .007) && Math.abs(v.lane) < current.width * .72 && minimum < 7
      && (difficulty !== "rookie" || (state.time + pilot.risk * 8) % 8 < 2.6);
    racer.aiBrake = curvature > .022 && v.speed > 100 && Math.abs(v.lane) > current.width * .62;
    racer.aiDrift = difficulty !== "rookie" && curvature > .0032 && curvature < .02 && Math.abs(v.lane) < current.width * .74
      && v.speed > 46 && !racer.aiBoost && !racer.aiRepair;
    racer.nextPlan = state.time + (difficulty === "ace" ? .14 : difficulty === "pilot" ? .21 : .32) + random() * .07;
  }

  function aiInput(racer: Racer): PodInput {
    if (state.time >= racer.nextPlan) planAi(racer);
    const v = racer.vehicle;
    const curve = track.sample(v.distance + 8).curve;
    const correction = (racer.targetLane - v.lane) * .23 - v.lateral * .043 + curve * v.speed * .055;
    const mistake = state.time < racer.errorUntil ? racer.errorSide * .53 : 0;
    return { steer: clamp(correction + mistake, -1, 1), throttle: !racer.aiBrake, brake: racer.aiBrake, boost: racer.aiBoost, drift: racer.aiDrift, repair: racer.aiRepair };
  }

  function move(racer: Racer, input: PodInput) {
    const v = racer.vehicle;
    if (v.finishedAt !== null) {
      // Give the finish line a runout; the timestamp still fixes the ranking.
      v.speed = damp(v.speed, 0, 1.18, STEP);
      v.distance += v.speed * STEP;
      v.boosting = false;
      v.drifting = false;
      return;
    }
    if (v.health[0] <= 0 && v.health[1] <= 0) {
      v.speed = 0;
      v.boosting = false;
      v.drifting = false;
      return;
    }
    const dt = STEP;
    racer.contactCooldown = Math.max(0, racer.contactCooldown - dt);
    racer.boostCooldown = Math.max(0, racer.boostCooldown - dt);
    v.hit = Math.max(0, v.hit - dt * 2.8);
    v.miniTurbo = Math.max(0, v.miniTurbo - dt);
    const d = localDistance(v.distance, track.length);
    const frame = track.sample(v.distance);
    const steer = clamp(Number.isFinite(input.steer) ? input.steer : 0, -1, 1);
    const upgrades = racer.upgrades;
    const { wake, turbulence } = draft(racer);
    v.slipstream = damp(v.slipstream, wake, wake > v.slipstream ? 1.4 : 3.5, dt);
    const health = (v.health[0] + v.health[1]) / 2;
    const oldBoost = v.boosting;
    v.repairing = input.repair && (health < .998 || Math.max(...v.heat) > .19);
    v.boosting = input.throttle && input.boost && !input.brake && !v.repairing && v.speed > 15 && v.boost > .015
      && racer.boostCooldown <= 0 && !racer.overheating.some(Boolean) && Math.min(...v.health) > .06;
    if (v.boosting && !oldBoost && racer === player) announce("boost");

    const drifting = input.drift && !v.repairing && !input.brake && v.speed > 30 && Math.abs(steer) > .18;
    if (drifting) {
      const corner = Math.abs(frame.curve) > .0016 && steer * frame.curve > 0;
      const controlled = Math.abs(v.lane) < frame.width - 1.1 && v.hit < .15;
      if (controlled) v.driftCharge = unit(v.driftCharge + dt * (corner ? .95 : arcade ? .64 : .41) * (.72 + Math.abs(steer) * .4));
      else v.driftCharge = Math.max(0, v.driftCharge - dt * .8);
    } else if (v.driftCharge > 0 && (!input.drift || input.brake || v.repairing)) {
      if (v.driftCharge >= .34 && !input.brake && !v.repairing && v.hit < .4) {
        v.miniTurbo = Math.max(v.miniTurbo, .54 + v.driftCharge * (arcade ? 1.21 : .92));
        if (racer === player) {
          state.miniTurbos++;
          announce("mini", v.driftCharge > .75 ? "MINI-TURBO MAXIMAL" : "MINI-TURBO");
        }
      }
      v.driftCharge = 0;
    }
    v.drifting = drifting;

    if (v.boosting) v.boost = unit(v.boost - dt * .178 / (1 + upgrades.boost * .12));
    else v.boost = unit(v.boost + dt * (.084 + v.slipstream * .051 + (arcade ? .027 : 0)));
    for (const side of [0, 1] as const) {
      const turnLoad = Math.max(0, steer * (side === 0 ? -1 : 1));
      const cold = (v.repairing ? .36 : input.brake ? .22 : .136) * (1 + upgrades.cooling * .18) * racer.stats.cooling;
      const hot = (.218 + turnLoad * .04 + (side === 0 ? .011 : 0)) / (1 + upgrades.cooling * .12) / racer.stats.cooling;
      const flux = v.boosting ? hot : -cold;
      v.heat[side] = unit(v.heat[side] + dt * (flux + turbulence * .08));
      if (v.heat[side] >= 1 && !racer.overheating[side]) {
        racer.overheating[side] = true;
        racer.boostCooldown = 1.0;
        v.health[side] = unit(v.health[side] - (arcade ? .12 : .21) / (1 + upgrades.armor * .15));
        v.hit = Math.max(v.hit, .48);
        if (racer === player) announce("overheat", side === 0 ? "SURCHAUFFE · MOTEUR DROIT" : "SURCHAUFFE · MOTEUR GAUCHE");
      } else if (v.heat[side] < .69) racer.overheating[side] = false;
      if (v.repairing) v.health[side] = unit(v.health[side] + dt * (.124 + upgrades.repair * .026));
    }
    if (racer.overheating.some(Boolean)) v.boosting = false;

    const difficultyPower = difficulty === "rookie" ? .84 : difficulty === "ace" ? 1.055 : 1;
    const base = (93 + upgrades.speed * 5.4) * (racer.pilot ? racer.pilot.power * difficultyPower : 1) * racer.stats.speed;
    const engineLimit = .55 + health * .45;
    const boostSpeed = v.boosting ? 52 + upgrades.boost * 5.8 : 0;
    const miniSpeed = v.miniTurbo > 0 ? (arcade ? 26 : 21) : 0;
    let target = (base + boostSpeed + miniSpeed + v.slipstream * 8) * engineLimit;
    if (!input.throttle) target = 0;
    if (input.brake) target = 0;
    if (v.repairing) target = Math.min(target, 38 + upgrades.repair * 1.5);
    if (v.drifting) target *= .90;
    if (racer.overheating.some(Boolean)) target *= .79;
    const acceleration = ((v.boosting ? 39 : 27) + upgrades.acceleration * 4.2) * racer.stats.acceleration;
    const braking = input.brake ? 54 : v.repairing ? 32 : input.throttle ? 25 : 12;
    v.speed = Math.max(0, v.speed + clamp(target - v.speed, -braking * dt, acceleration * dt));

    const velocity = Math.min(1, v.speed / 27);
    const response = (v.drifting ? 3.7 : 6.2) + upgrades.handling * .65;
    const steerSpeed = ((v.drifting ? 19.7 : 16.3) + upgrades.handling * .8) * racer.stats.handling;
    const centreAssist = Math.abs(steer) < .08 && v.branch < 0 ? -clamp(v.lane * .42, -5.3, 5.3) : 0;
    v.lateral = damp(v.lateral, (steer * steerSpeed + centreAssist) * velocity, response, dt);
    v.lateral -= frame.curve * v.speed ** 2 * (v.drifting ? .108 : .062) * dt;
    v.lateral += (v.health[1] - v.health[0]) * dt * velocity * 2.4;
    v.lateral += Math.sin(state.time * 21 + v.lane) * turbulence * dt * 4.7;
    v.lane += v.lateral * dt;
    v.roll = damp(v.roll, -steer * (v.drifting ? .47 : .28) - clamp(v.lateral / 36, -.21, .21), 8, dt);

    // A branch is physically adjacent to the main surface. Its width and entry taper
    // use the same offsets as the visible road, including on the way back to the circuit.
    const mainHalf = frame.width - POD_HALF_WIDTH;
    let nearestEdge = clamp(v.lane, -mainHalf, mainHalf);
    let branchIndex = -1;
    let gain = 0;
    for (let i = 0; i < track.branches.length; i++) {
      const route = track.branches[i];
      if (d <= route.start || d >= route.end) continue;
      const centre = branchOffset(route, d);
      const width = route.width - POD_HALF_WIDTH;
      const edge = clamp(v.lane, centre - width, centre + width);
      if (Math.abs(edge - v.lane) < Math.abs(nearestEdge - v.lane)) nearestEdge = edge;
      if (Math.abs(v.lane - centre) <= width + .38 && Math.abs(centre) > 1.4 && Math.abs(v.lane - centre) + .6 < Math.abs(v.lane)) {
        branchIndex = i;
        gain = route.gain * Math.abs(centre / route.offset);
      }
    }
    if (v.branch !== branchIndex) racer.branchMetres = 0;
    v.branch = branchIndex;
    if (branchIndex >= 0) {
      racer.branchMetres += v.speed * dt;
      const lap = Math.floor(v.distance / track.length);
      if (racer.branchLap !== lap) {
        racer.branchLap = lap;
        racer.creditedBranches.clear();
      }
      if (racer === player && racer.branchMetres > 52 && !racer.creditedBranches.has(branchIndex)) {
        racer.creditedBranches.add(branchIndex);
        state.shortcuts++;
        announce("near", "RACCOURCI · TRAJECTOIRE RISQUÉE");
      }
    }
    const excess = v.lane - nearestEdge;
    if (Math.abs(excess) > .2) {
      v.speed = Math.max(0, v.speed - dt * (18 + Math.min(28, Math.abs(excess) * 11)));
      if (Math.abs(excess) > 1.08) {
        if (v.speed > 21) damage(racer, excess < 0 ? 0 : 1, .11 + v.speed * .0007, "CONTACT · BORD DE PISTE", .78);
        v.lane = nearestEdge + Math.sign(excess) * 1.03;
        v.lateral = -Math.sign(excess) * Math.abs(v.lateral) * .31;
      }
    }
    const bendLength = clamp(1 - frame.curve * v.lane, .79, 1.24);
    v.distance += v.speed * dt * (1 + gain) / bendLength;
  }

  function courseContacts(racer: Racer, i: number) {
    const v = racer.vehicle;
    if (v.finishedAt !== null || v.speed < 4) return;
    const from = previousDistance[i];
    const advance = v.distance - from;
    const lapFrom = localDistance(from, track.length);
    for (const hazard of track.hazards) {
      const gap = difference(hazard.distance - lapFrom, track.length);
      const limit = hazard.radius + POD_HALF_LENGTH;
      if (gap < -limit || gap > advance + limit) continue;
      const cross = advance > 0 ? clamp(gap / advance, 0, 1) : 0;
      const atLane = previousLane[i] + (v.lane - previousLane[i]) * cross;
      const obstacle = hazardLane(hazard, state.time - STEP * (1 - cross));
      const lateral = Math.abs(atLane - obstacle);
      const span = hazard.radius + POD_HALF_WIDTH;
      if (lateral < span && Math.abs(gap - advance * cross) < limit) {
        const side = obstacle < atLane ? 0 : 1;
        if (damage(racer, side, .15 + v.speed * .0012, hazard.kind === "sweeper" ? "OBSTACLE MOBILE · IMPACT" : "IMPACT · MOTEUR ENDOMMAGÉ", .63)) {
          v.lateral += (side === 0 ? 1 : -1) * 2.6;
        }
      } else if (racer === player && gap >= 0 && gap < advance && lateral < span + 2.0 && v.speed > 54) {
        state.nearMisses++;
        v.boost = unit(v.boost + (arcade ? .08 : .035));
        announce("near", "PASSAGE AU RAS · ÉNERGIE RÉCUPÉRÉE");
      }
    }
    const d = localDistance(v.distance, track.length);
    const pad = track.pads.findIndex((p) => d >= p.start && d <= p.end && Math.abs(v.lane - p.lane) <= p.width);
    if (pad >= 0 && pad !== racer.lastPad) {
      v.miniTurbo = Math.max(v.miniTurbo, arcade ? 1.45 : 1.08);
      v.boost = unit(v.boost + .14);
      if (racer === player) announce("pad", "BALISE D’IMPULSION");
    }
    racer.lastPad = pad;
  }

  function tuskenFire() {
    const v = player.vehicle;
    if (v.distance < 0 || v.finishedAt !== null || state.phase !== "racing") return;
    const d = localDistance(v.distance, track.length);
    const lap = Math.floor(v.distance / track.length);
    raiders.forEach((raider, i) => {
      if (raiderLap[i] === lap || (difficulty === "rookie" && i % 2)) return;
      const gap = localDistance(raider.distance - d, track.length);
      if (gap > Math.max(90, v.speed * 1.5)) return;
      raiderLap[i] = lap;
      state.shots.push({
        id: nextShot++, raider: i, radius: 1.4, firedAt: state.time, impactAt: state.time + shotFlight,
        distance: v.distance + Math.max(v.speed, 35) * shotFlight,
        lane: v.lane + clamp(v.lateral * .4, -4, 4),
      });
      // A positive lane is on the left of the screen in the chase view.
      announce("shot", `TIREURS TUSKEN ${raider.side > 0 ? "À GAUCHE" : "À DROITE"} · ÉCARTE-TOI`);
    });
    for (let i = state.shots.length - 1; i >= 0; i--) {
      const shot = state.shots[i];
      if (state.time < shot.impactAt) continue;
      state.shots.splice(i, 1);
      const along = Math.abs(v.distance - shot.distance);
      const across = Math.abs(v.lane - shot.lane);
      if (along < shot.radius + POD_HALF_LENGTH && across < shot.radius + POD_HALF_WIDTH) {
        damage(player, shot.lane < v.lane ? 0 : 1, .13 + v.speed * .0006, "TIR TUSKEN · MOTEUR TOUCHÉ", .8);
      } else {
        state.dodges++;
        v.boost = unit(v.boost + .05);
        announce("dodge", "TIR ÉVITÉ · ÉNERGIE RÉCUPÉRÉE");
      }
    }
  }

  function rivalContacts() {
    for (let i = 0; i < racers.length; i++) {
      const a = racers[i];
      if (a.vehicle.finishedAt !== null) continue;
      for (let j = i + 1; j < racers.length; j++) {
        const b = racers[j];
        if (b.vehicle.finishedAt !== null || (a.contactCooldown > 0 && b.contactCooldown > 0)) continue;
        const av = a.vehicle;
        const bv = b.vehicle;
        const gap = difference(bv.distance - av.distance, track.length);
        const lateral = bv.lane - av.lane;
        if (Math.abs(gap) >= POD_HALF_LENGTH * 1.67 || Math.abs(lateral) >= POD_HALF_WIDTH * 1.72 || av.speed + bv.speed < 30) continue;
        const side = lateral >= 0 ? 1 : 0;
        const push = 2.3 + Math.min(3, Math.abs(av.lateral - bv.lateral) * .17);
        const force = .049 + Math.min(.072, Math.abs(av.speed - bv.speed) * .0021);
        damage(a, side, force, "CONTACT LATÉRAL", gap > 0 ? .86 : .94);
        damage(b, side === 0 ? 1 : 0, force, "CONTACT LATÉRAL", gap < 0 ? .86 : .94);
        av.lateral -= (side === 1 ? 1 : -1) * push;
        bv.lateral += (side === 1 ? 1 : -1) * push;
      }
    }
  }

  function updateLaps(racer: Racer, previous: number) {
    const v = racer.vehicle;
    if (v.finishedAt !== null) return;
    if (racer.startedLapAt === null && previous < 0 && v.distance >= 0) {
      racer.startedLapAt = state.time - STEP * v.distance / (v.distance - previous);
    }
    const lap = Math.floor(v.distance / track.length);
    const oldLap = Math.floor(previous / track.length);
    if (lap <= oldLap || lap < 1) return;
    const at = state.time - STEP * (v.distance - lap * track.length) / (v.distance - previous);
    const split = at - (racer.startedLapAt ?? 0);
    racer.bestLap = racer.bestLap === null ? split : Math.min(racer.bestLap, split);
    racer.startedLapAt = at;
    if (v.distance >= finishDistance) {
      v.finishedAt = at;
      if (racer === player) {
        state.time = at;
        state.phase = "finished";
        announce("finish", "LIGNE D’ARRIVÉE");
      }
    } else if (racer === player) {
      state.lap = lap + 1;
      announce("lap", `TOUR ${state.lap} / ${laps}`);
    }
  }

  function fixedStep(input: PodInput) {
    if (state.phase === "countdown") {
      const previousBeat = Math.ceil(state.countdown);
      countdownSteps = Math.max(0, countdownSteps - 1);
      state.countdown = countdownSteps * STEP;
      if (Math.ceil(state.countdown) !== previousBeat && countdownSteps > 0) announce("countdown");
      if (countdownSteps === 0) {
        state.phase = "racing";
        for (const racer of racers) if (racer.vehicle.distance >= 0) racer.startedLapAt = 0;
        announce("go", "DÉPART");
        recordGhost();
      }
      return;
    }
    state.time += STEP;
    if (state.time >= alertUntil) state.alert = "";
    racers.forEach((racer, i) => {
      previousDistance[i] = racer.vehicle.distance;
      previousLane[i] = racer.vehicle.lane;
      move(racer, racer === player ? input : aiInput(racer));
      courseContacts(racer, i);
    });
    rivalContacts();
    if (raiders.length) tuskenFire();
    // Complete opponent crossings before fixing the player's final timestamp.
    for (let i = 1; i < racers.length; i++) updateLaps(racers[i], previousDistance[i]);
    updateLaps(player, previousDistance[0]);
    state.topSpeed = Math.max(state.topSpeed, player.vehicle.speed);
    ranking();
    if (state.position < lastPosition && state.time > nextOvertake && state.time > 1.4 && state.phase === "racing") {
      nextOvertake = state.time + .7;
      player.vehicle.boost = unit(player.vehicle.boost + .045);
      announce("overtake", "DÉPASSEMENT · ÉNERGIE RÉCUPÉRÉE");
    }
    lastPosition = state.position;
    if (state.phase !== "racing") state.shots.length = 0;
    if (state.phase === "racing" && player.vehicle.health[0] <= 0 && player.vehicle.health[1] <= 0) {
      state.phase = "wrecked";
      announce("finish", "DEUX MOTEURS HORS SERVICE");
    }
    recordGhost(state.phase !== "racing");
  }

  ranking();
  return {
    state,
    step(dt, input = neutralInput) {
      if (!Number.isFinite(dt) || dt <= 0 || (state.phase !== "countdown" && state.phase !== "racing")) return;
      accumulator += Math.min(dt, MAX_FRAME);
      while (accumulator + 1e-9 >= STEP && (state.phase === "countdown" || state.phase === "racing")) {
        accumulator -= STEP;
        fixedStep(input);
      }
    },
    drainEvents: () => events.splice(0),
    result(): PodResult {
      return {
        finished: state.phase === "finished", position: state.position, time: state.time, bestLap: player.bestLap,
        crashes: state.crashes, miniTurbos: state.miniTurbos, shortcuts: state.shortcuts, nearMisses: state.nearMisses, dodges: state.dodges,
        topSpeed: state.topSpeed, standings: state.standings.map((item) => ({ ...item })), ghost: ghost.map((frame) => ({ ...frame })),
      };
    },
  };
}
