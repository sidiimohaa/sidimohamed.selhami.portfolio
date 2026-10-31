import type { RoomId } from "./stationWorld";

export type ImperialPresenceId = "grievous" | "maul" | "dooku" | "palpatine";
type Presence = {
  id: ImperialPresenceId; name: string; room: RoomId; location: string;
  position: [number, number, number]; yaw: number; radius: number;
  approach: [number, number]; description: string; transmission: string;
};

/** Placement and copy shared by the physical figures, their encounters and the station map. */
export const IMPERIAL_PRESENCES: Presence[] = [
  { id: "grievous", name: "Général Grievous", room: "hangar", location: "Hangar impérial",
    position: [-9, 0, -33], yaw: .42, radius: 1.3, approach: [-7.3, -29.6],
    description: "Sous la cape sombre, les articulations mécaniques s’ajustent avec précision. Le masque ivoire se relève, les yeux jaunes vous suivent et quatre lames éclairent le métal du hangar.",
    transmission: "Inspection terminée. Vos archives sont intactes… pour le moment." },
  { id: "maul", name: "Dark Maul", room: "formation", location: "Centre de formation",
    position: [48, 0, -98.5], yaw: -.65, radius: 1.1, approach: [45.8, -95.6],
    description: "Une couronne de petites cornes, un visage rouge traversé de marques noires et un double sabre : Maul attend près du cercle d’entraînement. Sa garde reste basse, mais son regard ne vous quitte pas.",
    transmission: "L’apprentissage révèle la discipline. La suite dépend de vous." },
  { id: "dooku", name: "Comte Dooku", room: "archives", location: "Archives impériales",
    position: [-51, 0, -98.5], yaw: .7, radius: .95, approach: [-48.8, -95.6],
    description: "La cape brune retombe sur une tunique noire à col haut. Une chaînette ferme le manteau ; sous les cheveux argentés, le visage reste impassible. La poignée courbe du sabre accompagne une posture mesurée.",
    transmission: "Un parcours se juge à ses actes. Prenez le temps de consulter ces archives." },
  { id: "palpatine", name: "Palpatine", room: "command", location: "Salle de commandement",
    position: [102, .18, -55.8], yaw: 0, radius: .9, approach: [102, -52.5],
    description: "Sous une profonde capuche noire, le visage de l’Empereur émerge de l’ombre. Deux gardes en robes écarlates, casques lustrés et piques argentées encadrent l’estrade. Le commandement veille sur la station.",
    transmission: "Les projets sont devant vous. Montrez-moi ce que vous êtes venu découvrir." },
];
