import { markerSpot } from "./spacePlacement";

// The on-screen marker of a signal to reach. The interface owns the element; the scene moves it each
// frame without going through React.

let element: HTMLElement | null = null;
let label: HTMLElement | null = null;
let shownText = "";

export const registerSignalMarker = (node: HTMLElement | null) => {
  element = node;
  label = (node?.querySelector("span") as HTMLElement | null) ?? null;
  shownText = "";
};

export const hideSignalMarker = () => {
  if (element) element.style.display = "none";
};

export function showSignalMarker(ndcX: number, ndcY: number, behind: boolean, text: string) {
  if (!element) return;
  const spot = markerSpot(ndcX, ndcY, behind, window.innerWidth, window.innerHeight);
  element.style.display = "block";
  element.style.transform = `translate(${spot.x.toFixed(1)}px, ${spot.y.toFixed(1)}px)`;
  element.dataset.edge = spot.onScreen ? "false" : "true";
  element.style.setProperty("--arrow", `${spot.angle.toFixed(3)}rad`);
  if (label && text !== shownText) {
    shownText = text;
    label.textContent = text;
  }
}
