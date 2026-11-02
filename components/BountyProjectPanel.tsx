"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Crosshair, X } from "lucide-react";
import type { Landing } from "./universe";
import styles from "./BountyProjectPanel.module.css";

type Props = {
  project: Landing["terminals"][number];
  onClose: () => void;
};

/** A separate dossier so opening the puck never sends the visitor back to a bay terminal. */
export default function BountyProjectPanel({ project, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const dialog = useRef<HTMLElement>(null), close = useRef<HTMLButtonElement>(null);
  const titleId = useId(), bodyId = useId();

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    close.current?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [mounted]);

  const keyDown = (event: KeyboardEvent<HTMLElement>) => {
    // Native scene handlers are attached to window; keep modal keys inside the dossier.
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault(); onClose(); return;
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href]:not([tabindex="-1"]), [tabindex="0"]',
    ) ?? []).filter(element => element.getClientRects().length > 0);
    const first = controls[0], last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  };

  if (!mounted) return null;
  return createPortal(
    <div
      className={styles.overlay}
      onPointerDown={event => event.stopPropagation()}
      onPointerUp={event => event.stopPropagation()}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        ref={dialog}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onKeyDown={keyDown}
        onKeyUp={event => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.signal}>
            <Crosshair size={17} aria-hidden="true" />
            <span>PRIME IDENTIFIÉE</span>
          </div>
          <button ref={close} className={styles.close} type="button" onClick={onClose} aria-label="Fermer le dossier projet">
            <X size={19} aria-hidden="true" />
          </button>
        </header>
        <div className={styles.content}>
          <p className={styles.eyebrow}>DOSSIER PROJET · {project.label.toUpperCase()}</p>
          <h2 id={titleId}>{project.heading}</h2>
          {project.meta && <p className={styles.meta}>{project.meta}</p>}
          <div className={styles.divider} aria-hidden="true"><i /><i /><i /></div>
          <p id={bodyId} className={styles.body}>{project.body}</p>
          {project.links && project.links.length > 0 && (
            <div className={styles.links}>
              {project.links.map((link, index) => (
                <a
                  key={`${link.href}-${index}`}
                  href={link.href}
                  target={link.href.startsWith("http") ? "_blank" : undefined}
                  rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                >
                  {link.label}<ArrowUpRight size={15} aria-hidden="true" />
                </a>
              ))}
            </div>
          )}
        </div>
        <footer className={styles.footer}><span className={styles.dot} aria-hidden="true" />TRANSMISSION HOLOGRAPHIQUE<span>ÉCHAP POUR FERMER</span></footer>
      </section>
    </div>,
    document.body,
  );
}
