import { clamp, smooth } from "./timeline";

const properties = ["translate", "rotate", "scale", "opacity", "will-change"] as const;
type Fragment = {
  element: HTMLElement;
  original: { value: string; priority: string }[];
  x: number; y: number; opacity: number; seed: number; backdrop: boolean;
};

// Individual CSS transforms compose with Motion's existing `transform`. Nothing is
// cloned, unmounted or written to storage; every inline property is restored verbatim.
export function captureInterface(root: HTMLElement, overlay: HTMLElement) {
  const fragments: Fragment[] = [];
  const seen = new Set<HTMLElement>();
  const inert = new Map<HTMLElement, boolean>();
  const width = window.innerWidth, height = window.innerHeight;
  const collect = (element: HTMLElement) => {
    if (element === overlay || overlay.contains(element) || seen.has(element)) return;
    if (element.tagName === "CANVAS" && element.closest(".space-canvas")) return;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return;
    const children = Array.from(element.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
    const semantic = /^(BUTTON|A|P|H[1-6]|ASIDE|SECTION|LABEL|FIGURE)$/.test(element.tagName);
    if ((!semantic && children.length) || element.classList.contains("space-canvas")) {
      children.forEach(collect);
      return;
    }
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > height || rect.right < 0 || rect.left > width) return;
    seen.add(element);
    fragments.push({
      element, original: properties.map((property) => ({ value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) })),
      x: (rect.left + rect.width / 2) / width,
      y: (rect.top + rect.height / 2) / height,
      opacity: Number(style.opacity), seed: ((fragments.length * 37 + 11) % 101) / 101,
      backdrop: rect.width > width * 0.95 && rect.height > height * 0.95,
    });
    element.style.willChange = "translate, rotate, scale, opacity";
  };
  const scan = () => {
    for (const child of Array.from(root.children)) {
      if (!(child instanceof HTMLElement) || child === overlay) continue;
      if (!inert.has(child)) { inert.set(child, child.inert); child.inert = true; }
      collect(child);
    }
  };
  scan();
  const observer = new MutationObserver((changes) => {
    if (changes.some((change) => change.addedNodes.length)) scan();
  });
  observer.observe(root, { childList: true, subtree: true });
  let restored = false;
  return {
    update(collapse: number, centerX: number, centerY: number, time: number, reduced: boolean) {
      for (const fragment of fragments) {
        const { element, seed, backdrop } = fragment;
        if (backdrop || reduced) {
          element.style.opacity = String(fragment.opacity * (1 - smooth(0, 0.9, collapse)));
          continue;
        }
        const p = clamp((collapse - seed * 0.12) / (1 - seed * 0.12));
        const angle = p * p * (2.4 + seed * 1.8);
        const radius = Math.pow(1 - p, 2.2);
        const dx = (fragment.x - centerX) * window.innerWidth;
        const dy = (fragment.y - centerY) * window.innerHeight;
        const x = centerX * window.innerWidth + (dx * Math.cos(angle) - dy * Math.sin(angle)) * radius;
        const y = centerY * window.innerHeight + (dx * Math.sin(angle) + dy * Math.cos(angle)) * radius;
        const tremor = Math.sin(time * 17 + seed * 20) * Math.min(1, time / 4) * (1 - p) * 0.6;
        element.style.translate = `${x - fragment.x * window.innerWidth + tremor}px ${y - fragment.y * window.innerHeight}px`;
        element.style.rotate = `${p * p * (180 + seed * 160)}deg`;
        element.style.scale = `${Math.max(0.001, Math.pow(1 - p, 1.4))} ${Math.max(0.001, Math.pow(1 - p, 0.8) * (1 + Math.sin(p * Math.PI) * 1.7))}`;
        element.style.opacity = String(fragment.opacity * (1 - smooth(0.77, 1, p)));
      }
    },
    restore() {
      if (restored) return;
      restored = true;
      observer.disconnect();
      for (const { element, original } of fragments) properties.forEach((property, i) => {
        const { value, priority } = original[i];
        if (value) element.style.setProperty(property, value, priority);
        else element.style.removeProperty(property);
      });
      inert.forEach((value, element) => { element.inert = value; });
    },
  };
}
