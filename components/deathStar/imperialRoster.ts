import type { RoomId } from "./stationWorld";

export type ImperialPresenceId = "krennic" | "motti" | "tarkin" | "palpatine";
type Presence = {
  id: ImperialPresenceId; name: string; room: RoomId; location: string;
  position: [number, number, number]; yaw: number; radius: number;
  approach: [number, number]; description: string; transmission: string;
};

/** Placement and copy shared by the physical figures, their encounters and the station map. */
export const IMPERIAL_PRESENCES: Presence[] = [
  { id: "krennic", name: "Directeur Krennic", room: "hangar", location: "Hangar impérial",
    position: [-9, 0, -33], yaw: .42, radius: .8, approach: [-7.3, -29.6],
    description: "Tunique blanche, longue cape immaculée, gants noirs : Orson Krennic, directeur de la recherche avancée, inspecte chaque arrivée comme si la station lui appartenait encore. Le projet a été le sien bien avant qu’on le lui prenne.",
    transmission: "Vos archives sont en ordre. Tout, ici, a été construit pour que rien ne se perde." },
  { id: "motti", name: "Amiral Motti", room: "formation", location: "Centre de formation",
    position: [48, 0, -98.5], yaw: -.65, radius: .7, approach: [45.8, -95.6],
    description: "L’amiral Motti croit à la puissance de la station et à rien d’autre. Sa plaque de grade brille sur l’uniforme olive ; sa confiance a déjà failli lui coûter le souffle devant l’état-major.",
    transmission: "L’apprentissage révèle la discipline. La suite dépend de vous." },
  { id: "tarkin", name: "Grand Moff Tarkin", room: "archives", location: "Archives impériales",
    position: [-51, 0, -98.5], yaw: .7, radius: .7, approach: [-48.8, -95.6],
    description: "Silhouette sèche, cheveux d’argent, deux rangées de grade : Wilhuff Tarkin commande cette station et lit chaque rapport lui-même. Il attend d’un dossier ce qu’il attend d’un officier : des faits.",
    transmission: "Un parcours se juge à ses actes. Prenez le temps de consulter ces archives." },
  { id: "palpatine", name: "Palpatine", room: "command", location: "Salle de commandement",
    position: [102, .18, -55.8], yaw: 0, radius: .9, approach: [102, -52.5],
    description: "Sous une profonde capuche noire, le visage de l’Empereur émerge de l’ombre. Deux gardes en robes écarlates, casques lustrés et piques argentées encadrent l’estrade.",
    transmission: "Les projets sont devant vous. Montrez-moi ce que vous êtes venu découvrir." },
];
