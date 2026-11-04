"use client";
import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Camera, Radio, X } from "lucide-react";
import type { CopilotMessage } from "./copilot";

// The copilot's transmission: a short message from the astromech, gone after a few seconds.
export function CopilotComm({
  message,
  reduced,
  onDone,
  onSilence,
}: {
  message: CopilotMessage;
  reduced: boolean;
  onDone: () => void;
  onSilence: () => void;
}) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const timer = window.setTimeout(() => doneRef.current(), 8000);
    return () => clearTimeout(timer);
  }, [message.id]);
  return (
    <motion.aside
      className="copilot-comm"
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, x: reduced ? 0 : -14 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: reduced ? 0 : -10 }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="copilot-comm-top mono">
        <span>
          <Radio size={12} aria-hidden="true" /> ASTROMÉCANO · {message.title}
        </span>
        <button aria-label="Fermer la transmission du copilote" onClick={onDone}>
          <X size={13} />
        </button>
      </div>
      <p>{message.body}</p>
      <button className="copilot-silence mono" onClick={onSilence}>
        MODE SILENCIEUX
      </button>
    </motion.aside>
  );
}

// Photo mode: the interface hides, the visitor flies to frame the shot and sets the lens.
export function PhotoBar({
  fov,
  onFov,
  onCapture,
  onClose,
  busy,
}: {
  fov: number;
  onFov: (value: number) => void;
  onCapture: () => void;
  onClose: () => void;
  busy: boolean;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <motion.div
      className="photo-bar"
      role="toolbar"
      aria-label="Mode photo"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span className="mono photo-hint">PILOTEZ POUR CADRER · ÉCHAP POUR QUITTER</span>
      <label className="photo-fov mono">
        FOCALE
        <input type="range" min={28} max={80} step={1} value={fov} onChange={(event) => onFov(Number(event.target.value))} />
        <output>{Math.round(fov)}°</output>
      </label>
      <button className="photo-shoot mono" onClick={onCapture} disabled={busy}>
        <Camera size={14} aria-hidden="true" /> {busy ? "CAPTURE…" : "CAPTURER"}
      </button>
      <button className="photo-close mono" onClick={onClose}>
        QUITTER
      </button>
    </motion.div>
  );
}
