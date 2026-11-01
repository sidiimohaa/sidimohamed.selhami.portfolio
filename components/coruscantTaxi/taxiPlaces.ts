import * as THREE from "three";

// Where the taxi goes and how it gets there. Pad 3-7 sits at the origin, as on the landing; the
// Jedi Temple stands to the south-west, into the sunset, and the Senate dome to the south-east.
// A trip is the departure from one place, a corridor through the city, then the approach of the
// other place. The city clears its towers around every trip, so a corridor only has to avoid
// the sculpted landmarks near the pad and the two monuments.

export type PlaceId = "pad" | "temple" | "senate";
type XYZ = [number, number, number];
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const TEMPLE = v(-640, 0, -1000);
// The Council meets in the north-east spire, the one that faces the pad.
export const COUNCIL = v(-588, 0, -948);
export const COUNCIL_FLOOR = 168;
export const COUNCIL_FACING = v(588, 0, 948).normalize();
export const SENATE = v(720, 0, -900);
export const SENATE_FACING = v(-720, 0, 900).normalize();
// A wide drum under a flat saucer; the plaza runs in under the overhang to the drum's doors.
export const SENATE_DRUM = 80;
export const SENATE_RIM = 137;
export const PLAZA = { top: 1, from: 82, to: 176, half: 16 };
// Where the taxi sets down on the plaza, beyond the saucer's edge.
export const SENATE_STOP = 150;
// The round esplanade the Senate stands on, level with the plaza.
export const ESPLANADE = 188;
// The taxi floats this far above where it rests.
export const HOVER = 0.22;

const along = (origin: THREE.Vector3, facing: THREE.Vector3, distance: number, y: number) => origin.clone().addScaledVector(facing, distance).setY(y);

export type Place = {
  id: PlaceId;
  name: string;
  rest: THREE.Vector3;
  yaw: number;
  // Approach points, from far to near, and departure points, from near to far.
  arrive: THREE.Vector3[];
  leave: THREE.Vector3[];
  // What the eye seeks on the way in, and the greeting on arrival.
  landmark: THREE.Vector3;
  welcome: string;
};

const templeRest = along(COUNCIL, COUNCIL_FACING, 27, COUNCIL_FLOOR + HOVER);
const senateRest = along(SENATE, SENATE_FACING, SENATE_STOP, PLAZA.top + HOVER);
const padRest = v(0, HOVER, -18.8);

export const places: Record<PlaceId, Place> = {
  pad: {
    id: "pad",
    name: "Plateforme 3-7",
    rest: padRest,
    yaw: Math.PI / 2,
    arrive: [v(-95, -8, -52), v(-40, 2, -26), v(-12, 1.2, -19.6)],
    leave: [v(10, 2.2, -19.4), v(34, 1, -26), v(80, -10, -52)],
    landmark: v(0, 3, 2),
    welcome: "Plateforme 3-7. Merci d’avoir voyagé avec nous.",
  },
  temple: {
    id: "temple",
    name: "Temple Jedi",
    rest: templeRest,
    yaw: Math.atan2(-COUNCIL_FACING.x, -COUNCIL_FACING.z),
    arrive: [
      along(COUNCIL, COUNCIL_FACING, 360, 74),
      along(COUNCIL, COUNCIL_FACING, 200, 150),
      along(COUNCIL, COUNCIL_FACING, 80, 178),
      along(COUNCIL, COUNCIL_FACING, 42, 171.5),
    ],
    leave: [templeRest.clone().setY(COUNCIL_FLOOR + 6), along(COUNCIL, COUNCIL_FACING, 52, COUNCIL_FLOOR + 14), along(COUNCIL, COUNCIL_FACING, 130, 150)],
    landmark: v(TEMPLE.x, 190, TEMPLE.z),
    welcome: "Temple Jedi, plateforme du Conseil. Le Conseil vous attend.",
  },
  senate: {
    id: "senate",
    name: "Sénat galactique",
    rest: senateRest,
    yaw: Math.atan2(-SENATE_FACING.x, -SENATE_FACING.z),
    arrive: [
      along(SENATE, SENATE_FACING, 560, -78),
      along(SENATE, SENATE_FACING, 410, -48),
      along(SENATE, SENATE_FACING, 305, -14),
      along(SENATE, SENATE_FACING, 252, 9),
      along(SENATE, SENATE_FACING, 200, 6),
    ],
    leave: [senateRest.clone().setY(PLAZA.top + 6), along(SENATE, SENATE_FACING, 215, 14), along(SENATE, SENATE_FACING, 268, 12), along(SENATE, SENATE_FACING, 335, -20)],
    landmark: v(SENATE.x, 30, SENATE.z),
    welcome: "Sénat galactique, Grande Place. La séance est ouverte.",
  },
};

// Waypoints between one place's departure and the next place's approach.
const corridors: Record<string, XYZ[]> = {
  "pad>temple": [
    [130, -30, -122],
    [178, -48, -190],
    [150, -64, -278],
    [30, -72, -372],
    [-110, -44, -450],
    [-215, 6, -530],
  ],
  "pad>senate": [
    [128, -26, -112],
    [212, -56, -150],
    [262, -72, -258],
    [205, -60, -372],
    [270, -44, -462],
  ],
  "temple>senate": [
    [-420, 120, -720],
    [-250, 30, -700],
    [-60, -40, -640],
    [120, -60, -560],
    [260, -76, -500],
  ],
  "senate>temple": [
    [440, -40, -600],
    [250, -36, -690],
    [40, -8, -760],
    [-160, 34, -740],
    [-300, 58, -690],
  ],
  "temple>pad": [
    [-400, 70, -700],
    [-250, -20, -560],
    [-200, -40, -380],
    [-235, -30, -200],
    [-185, -16, -40],
  ],
  "senate>pad": [
    [410, -52, -560],
    [262, -64, -420],
    [130, -44, -290],
    [-20, -40, -305],
    [-210, -30, -185],
    [-185, -16, -40],
  ],
};

// What the pilot droid says on the way, as a share of the trip, and where the eye is drawn.
export type Cue = { at: number; line: string; look?: THREE.Vector3 };
const cues: Record<string, Cue[]> = {
  "pad>temple": [
    { at: 0.02, line: "Destination confirmée : Temple Jedi. Durée du trajet : moins d’une minute." },
    { at: 0.14, line: "Nous rejoignons le couloir aérien 3-7. Descente vers les niveaux inférieurs." },
    { at: 0.38, line: "Flux express à double sens. Trafic dense, restez bien assis." },
    { at: 0.6, line: "Devant nous, le Temple Jedi. Ses cinq flèches veillent sur la ville depuis des millénaires.", look: places.temple.landmark },
    { at: 0.86, line: "Approche de la plateforme du Conseil. Arrivée imminente." },
  ],
  "pad>senate": [
    { at: 0.02, line: "Destination confirmée : Sénat galactique, par le couloir des délégations." },
    { at: 0.18, line: "Nous passons sous les passerelles du district fédéral." },
    { at: 0.42, line: "Priorité diplomatique accordée. Nous doublons le trafic." },
    { at: 0.66, line: "Droit devant, le dôme du Sénat galactique.", look: places.senate.landmark },
    { at: 0.88, line: "Approche de la Grande Place. Arrivée imminente." },
  ],
  "temple>senate": [
    { at: 0.03, line: "Cap sur le Sénat galactique. Nous traversons le district fédéral." },
    { at: 0.4, line: "Derrière nous, le Temple s’éloigne dans le couchant." },
    { at: 0.7, line: "Le dôme du Sénat est en vue.", look: places.senate.landmark },
    { at: 0.9, line: "Approche finale de la Grande Place." },
  ],
  "senate>temple": [
    { at: 0.03, line: "Cap sur le Temple Jedi. Nous remontons vers le couchant." },
    { at: 0.55, line: "Le Temple Jedi se découpe sur le soleil couchant.", look: places.temple.landmark },
    { at: 0.88, line: "Approche de la plateforme du Conseil." },
  ],
  "temple>pad": [
    { at: 0.03, line: "Retour vers la plateforme 3-7." },
    { at: 0.45, line: "Nous retrouvons le flux de la ville basse." },
    { at: 0.86, line: "Plateforme 3-7 en vue. Votre X-wing vous attend.", look: places.pad.landmark },
  ],
  "senate>pad": [
    { at: 0.03, line: "Retour vers la plateforme 3-7." },
    { at: 0.45, line: "Nous longeons le district fédéral." },
    { at: 0.86, line: "Plateforme 3-7 en vue. Votre X-wing vous attend.", look: places.pad.landmark },
  ],
};

export type Trip = { from: PlaceId; to: PlaceId; curve: THREE.CatmullRomCurve3; length: number; cues: Cue[] };

export function tripBetween(from: PlaceId, to: PlaceId): Trip {
  const key = `${from}>${to}`;
  const points = [places[from].rest, ...places[from].leave, ...corridors[key].map(([x, y, z]) => v(x, y, z)), ...places[to].arrive, places[to].rest];
  const curve = new THREE.CatmullRomCurve3(points.map((point) => point.clone()), false, "centripetal", 0.5);
  curve.arcLengthDivisions = 2000;
  return { from, to, curve, length: curve.getLength(), cues: cues[key] };
}

export const TRIP_KEYS = Object.keys(corridors).map((key) => key.split(">") as [PlaceId, PlaceId]);
