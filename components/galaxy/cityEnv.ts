import * as THREE from "three";

// Coruscant's sky, shared by the landing platform and the air taxi so a ride starts and ends under
// the same weather: the hour, a storm, lightning, and a sector without power. With everything at
// zero the shaders draw exactly the permanent dusk the city has always had.

export const cityUniforms = {
  cityDay: { value: 0 },
  cityNight: { value: 0 },
  cityStorm: { value: 0 },
  cityFlash: { value: 0 },
  // x, z and radius of the sector without power, and how far the outage has spread (0 to 1).
  cityOutage: { value: new THREE.Vector4(0, 0, 1, 0) },
};
const BASE = { low: new THREE.Color(0.44, 0.2, 0.105), high: new THREE.Color(0.135, 0.12, 0.22) };
const NIGHT = { low: new THREE.Color(0.07, 0.05, 0.1), high: new THREE.Color(0.025, 0.03, 0.07) };
const DAY = { low: new THREE.Color(0.72, 0.62, 0.5), high: new THREE.Color(0.55, 0.62, 0.72) };
const STORM = { low: new THREE.Color(0.1, 0.1, 0.12), high: new THREE.Color(0.07, 0.08, 0.1) };
export const cityHaze = { low: { value: BASE.low.clone() }, high: { value: BASE.high.clone() } };
export const cityFogColor = new THREE.Color();

/** Added to the sky shaders: takes the dusk colour and returns the colour for the hour and weather. */
export const CITY_SKY_GLSL = /* glsl */ `
  uniform float cityDay,cityNight,cityStorm,cityFlash;
  vec3 citySky(vec3 c,float h){
    float up=clamp(h,0.0,1.0);
    vec3 night=mix(vec3(.05,.04,.075),vec3(.006,.009,.03),pow(up,.42));
    vec3 day=mix(vec3(.82,.74,.62),vec3(.2,.38,.68),pow(up,.5));
    c=mix(c,night,cityNight);
    c=mix(c,day,cityDay);
    c=mix(c,mix(vec3(.13,.13,.16),vec3(.035,.04,.055),pow(up,.55)),cityStorm*.92);
    return c+vec3(.62,.68,.85)*cityFlash*(.35+.65*up);
  }`;

export const cityBuildingUniforms = () => ({
  cityDay: cityUniforms.cityDay,
  cityNight: cityUniforms.cityNight,
  cityStorm: cityUniforms.cityStorm,
  cityFlash: cityUniforms.cityFlash,
  cityOutage: cityUniforms.cityOutage,
});

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Ten minutes for a full turn: dusk, night, dawn, day and back to dusk.
const PERIOD = 600;
let phase = Math.random() * 0.1;
const target = { storm: 0, outage: 0 };
let flash = 0;

export const setCityHour = (value: number) => (phase = ((value % 1) + 1) % 1);
export const setCityStorm = (level: number) => (target.storm = level);
export const setCityOutage = (level: number, x?: number, z?: number, radius?: number) => {
  target.outage = level;
  if (x !== undefined && z !== undefined) cityUniforms.cityOutage.value.set(x, z, radius ?? 260, cityUniforms.cityOutage.value.w);
};
export const strikeLightning = (power = 1) => (flash = Math.max(flash, power));

export function advanceCity(dt: number, options: { cycle: boolean; reduced: boolean }) {
  if (options.cycle && !options.reduced) phase = (phase + dt / PERIOD) % 1;
  const night = options.cycle ? smooth(0.08, 0.2, phase) * (1 - smooth(0.42, 0.54, phase)) : 0;
  const day = options.cycle ? smooth(0.54, 0.66, phase) * (1 - smooth(0.86, 0.98, phase)) : 0;
  const u = cityUniforms;
  u.cityNight.value = night;
  u.cityDay.value = day;
  u.cityStorm.value += (target.storm - u.cityStorm.value) * (1 - Math.exp(-dt / 5));
  const outage = u.cityOutage.value;
  // The dark spreads slowly from tower to tower, and comes back a little faster.
  outage.w = target.outage > outage.w ? Math.min(target.outage, outage.w + dt / 9) : Math.max(target.outage, outage.w - dt / 6);
  flash = options.reduced ? 0 : Math.max(0, flash - dt * 3.6);
  u.cityFlash.value = flash;
  const storm = u.cityStorm.value;
  for (const key of ["low", "high"] as const) {
    cityHaze[key].value.copy(BASE[key]).lerp(NIGHT[key], night).lerp(DAY[key], day).lerp(STORM[key], storm * 0.9);
  }
  cityFogColor.copy(cityHaze.high.value).lerp(cityHaze.low.value, 0.4);
  return { night, day, storm };
}

const warm = new THREE.Color(0xffc49a), white = new THREE.Color(0xfff4e6), blue = new THREE.Color(0x8aa0d8);
/** Sets the sun and the sky light of a scene for the hour and the weather. */
export function lightCity(sun: THREE.DirectionalLight, sky: THREE.HemisphereLight, base: { sun: number; sky: number }) {
  const { cityDay: day, cityNight: night, cityStorm: storm, cityFlash: bolt } = cityUniforms;
  sun.intensity = base.sun * (1 - night.value * 0.8) * (1 + day.value * 0.7) * (1 - storm.value * 0.65) + bolt.value * 1.6;
  sky.intensity = base.sky * (1 - night.value * 0.45) * (1 + day.value * 0.6) * (1 - storm.value * 0.3) + bolt.value * 0.8;
  sun.color.copy(warm).lerp(blue, night.value).lerp(white, day.value);
}
