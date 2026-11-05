"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import {
  qualityOrder,
  qualityProfiles,
  updateBridgeSettings,
  useBridgeSettings,
  type QualityChoice,
  type QualityId,
} from "../graphicsQuality";
import { livingOn, setLiving } from "../galaxy/flags";

type Props = {
  applied: QualityId;
  systemReduced: boolean;
  sound: boolean;
  onToggleSound: () => void;
  onClose: () => void;
};

// The ship's settings: graphics profile, motion and audio. Every switch takes effect at once.
export default function BridgeSettings({ applied, systemReduced, sound, onToggleSound, onClose }: Props) {
  const settings = useBridgeSettings();
  const [events, setEvents] = useState(() => livingOn("events"));
  const panel = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("input:checked, button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab" || !panel.current) return;
      const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>("button, input"));
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      previous?.focus?.();
    };
  }, []);
  const choices: { id: QualityChoice; label: string; note: string }[] = [
    { id: "auto", label: "Automatique", note: `Mesuré sur cet appareil · ${qualityProfiles[applied].label}` },
    ...qualityOrder.map((id) => ({
      id,
      label: qualityProfiles[id].label,
      note:
        id === "ultra"
          ? "Pleine résolution, poussière dense"
          : id === "high"
            ? "Équilibre recommandé sur ordinateur"
            : id === "medium"
              ? "Mobiles et portables légers, sans reflets d’objectif"
              : "Sans poussière ni reflets d’objectif",
    })),
  ];
  return (
    <motion.div
      className="modal-backdrop bridge-settings-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.section
        ref={panel}
        className="bridge-settings modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bridge-settings-title"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-top mono">
          <span>SYSTÈMES DE BORD</span>
          <button className="close-button" aria-label="Fermer les réglages" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <h2 id="bridge-settings-title">Réglages du vaisseau</h2>
        <fieldset className="bridge-quality">
          <legend className="mono">QUALITÉ GRAPHIQUE</legend>
          {choices.map((choice) => (
            <label key={choice.id} data-checked={settings.quality === choice.id}>
              <input
                type="radio"
                name="bridge-quality"
                value={choice.id}
                checked={settings.quality === choice.id}
                onChange={() => updateBridgeSettings({ quality: choice.id })}
              />
              <span>
                <b>{choice.label}</b>
                <small>{choice.note}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="bridge-toggles">
          <label>
            <input
              type="checkbox"
              checked={systemReduced || settings.reduceMotion}
              disabled={systemReduced}
              onChange={(event) => updateBridgeSettings({ reduceMotion: event.target.checked })}
            />
            <span>
              <b>Réduire les animations</b>
              <small>{systemReduced ? "Activé par la préférence de votre système" : "Trajets courts, caméra stable, sans scintillement"}</small>
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.shipSway}
              onChange={(event) => updateBridgeSettings({ shipSway: event.target.checked })}
            />
            <span>
              <b>Mouvement du vaisseau</b>
              <small>Léger roulis au repos</small>
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.copilot}
              onChange={(event) => updateBridgeSettings({ copilot: event.target.checked })}
            />
            <span>
              <b>Transmissions du copilote</b>
              <small>Messages de l’astromécano à l’approche des mondes</small>
            </span>
          </label>
          <label>
            <input type="checkbox" checked={events} onChange={(event) => { setLiving("events", event.target.checked); setEvents(event.target.checked); }} />
            <span>
              <b>Événements galactiques</b>
              <small>Tempêtes, poursuites, signaux de détresse… Effet complet au prochain atterrissage</small>
            </span>
          </label>
          <label>
            <input type="checkbox" checked={sound} onChange={onToggleSound} />
            <span>
              <b>Ambiance sonore</b>
              <small>Moteurs, radio et interfaces, après votre accord</small>
            </span>
          </label>
        </div>
      </motion.section>
    </motion.div>
  );
}
