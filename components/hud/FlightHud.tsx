"use client";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { destinations } from "../universe";

// The flight instruments drawn over open space: a heading-up radar of the five
// destinations, speed and thrust, and markers on the screen edge for the worlds out of view.
// The scene writes to it every frame through `update`; React never re-renders it in flight.

export type HudMode = "idle" | "cruise" | "boost" | "coast" | "auto" | "orbit";

export type HudBody = {
  // Bearing relative to the nose, in degrees: negative to port, positive to starboard.
  bearing: number;
  // Radar position, each in -1..1, nose up.
  radarX: number;
  radarY: number;
  elevation: -1 | 0 | 1;
  // Distance to the surface, in scene units.
  distance: number;
  // Where to pin the off-screen marker, in pixels, or hidden when the world is in view.
  edge: boolean;
  edgeX: number;
  edgeY: number;
  edgeAngle: number;
};

export type HudFrame = {
  visible: boolean;
  mode: HudMode;
  speed: number;
  // Share of the top speed, 0..1.
  throttle: number;
  aimed: number | null;
  course: number | null;
  bodies: HudBody[];
};

export type FlightHudHandle = { update: (frame: HudFrame) => void };

export const hudFrame = (): HudFrame => ({
  visible: false,
  mode: "idle",
  speed: 0,
  throttle: 0,
  aimed: null,
  course: null,
  bodies: destinations.map(() => ({ bearing: 0, radarX: 0, radarY: 0, elevation: 0, distance: 0, edge: false, edgeX: 0, edgeY: 0, edgeAngle: 0 })),
});

const modeLabels: Record<HudMode, string> = {
  idle: "À L’ARRÊT",
  cruise: "CROISIÈRE",
  boost: "POSTCOMBUSTION",
  coast: "INERTIE",
  auto: "PILOTE AUTO",
  orbit: "EN ORBITE",
};
const shortName = (name: string) => (name.startsWith("L’") ? "ÉTOILE" : name.toUpperCase());
const distanceFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

const FlightHud = forwardRef<FlightHudHandle>(function FlightHud(_, ref) {
  const root = useRef<HTMLDivElement>(null),
    speed = useRef<HTMLElement>(null),
    thrust = useRef<HTMLElement>(null),
    mode = useRef<HTMLElement>(null),
    radar = useRef<HTMLDivElement>(null);
  const blips = useRef<(HTMLElement | null)[]>([]),
    edges = useRef<(HTMLDivElement | null)[]>([]),
    edgeArrows = useRef<(HTMLElement | null)[]>([]),
    edgeRanges = useRef<(HTMLElement | null)[]>([]);
  // What was last written, so an unchanged value costs nothing.
  const written = useRef<Record<string, string>>({});
  useImperativeHandle(ref, () => {
    const set = (key: string, value: string, apply: (value: string) => void) => {
      if (written.current[key] === value) return;
      written.current[key] = value;
      apply(value);
    };
    return {
      update(frame) {
        const host = root.current;
        if (!host) return;
        set("on", String(frame.visible), (value) => (host.dataset.on = value));
        if (!frame.visible) return;
        set("mode", frame.mode, (value) => {
          host.dataset.mode = value;
          if (mode.current) mode.current.textContent = modeLabels[frame.mode];
        });
        set("speed", String(Math.round(frame.speed * 10) * 10).padStart(4, "0"), (value) => {
          if (speed.current) speed.current.textContent = value;
        });
        if (thrust.current) thrust.current.style.transform = `scaleX(${frame.throttle.toFixed(3)})`;
        const reach = (radar.current?.clientWidth ?? 132) / 2 - 9;
        frame.bodies.forEach((body, index) => {
          const state = index === frame.course ? "course" : index === frame.aimed ? "aimed" : "idle";
          const blip = blips.current[index];
          if (blip) {
            blip.style.transform = `translate3d(${(body.radarX * reach).toFixed(1)}px,${(body.radarY * reach).toFixed(1)}px,0)`;
            set(`blip${index}`, `${state}|${body.elevation}`, (value) => {
              const [tone, elevation] = value.split("|");
              blip.dataset.state = tone;
              blip.dataset.elevation = elevation;
            });
          }
          const edge = edges.current[index];
          if (edge) {
            set(`edge${index}`, `${body.edge}|${state}`, (value) => {
              const [shown, tone] = value.split("|");
              edge.dataset.on = shown;
              edge.dataset.state = tone;
            });
            if (body.edge) {
              edge.style.transform = `translate3d(${body.edgeX.toFixed(1)}px,${body.edgeY.toFixed(1)}px,0)`;
              const arrow = edgeArrows.current[index];
              if (arrow) arrow.style.transform = `rotate(${body.edgeAngle.toFixed(3)}rad)`;
              // The label sits on the inner side of its arrow.
              set(`edgeSide${index}`, Math.cos(body.edgeAngle) > 0.35 ? "right" : Math.cos(body.edgeAngle) < -0.35 ? "left" : Math.sin(body.edgeAngle) > 0 ? "bottom" : "top", (value) => (edge.dataset.side = value));
              set(`edgeRange${index}`, `${distanceFormat.format(Math.round(body.distance * 10) * 10)} km`, (value) => {
                const range = edgeRanges.current[index];
                if (range) range.textContent = value;
              });
            }
          }
        });
      },
    };
  }, []);
  return (
    <div ref={root} className="flight-hud" data-on="false" data-mode="idle" aria-hidden="true">
      <div className="hud-cluster">
        <div ref={radar} className="hud-radar">
          <i className="hud-radar-sweep" />
          <i className="hud-radar-ship" />
          {destinations.map((destination, index) => (
            <i
              key={destination.name}
              ref={(element) => {
                blips.current[index] = element;
              }}
              className="hud-blip"
              data-world={destination.className}
              data-state="idle"
              data-elevation="0"
            >
              <em>{destination.number}</em>
            </i>
          ))}
        </div>
        <div className="hud-speed">
          <span className="hud-label">VITESSE</span>
          <p>
            <b ref={speed}>0000</b>
            <em>km/s</em>
          </p>
          <div className="hud-thrust">
            <i ref={thrust} />
          </div>
          <strong ref={mode}>{modeLabels.idle}</strong>
        </div>
      </div>
      {destinations.map((destination, index) => (
        <div
          key={destination.name}
          ref={(element) => {
            edges.current[index] = element;
          }}
          className="hud-edge"
          data-world={destination.className}
          data-on="false"
          data-state="idle"
          data-side="right"
        >
          <i
            ref={(element) => {
              edgeArrows.current[index] = element;
            }}
          />
          <span>
            <b>
              {destination.number} · {shortName(destination.name)}
            </b>
            <em
              ref={(element) => {
                edgeRanges.current[index] = element;
              }}
            />
          </span>
        </div>
      ))}
    </div>
  );
});

export default FlightHud;
