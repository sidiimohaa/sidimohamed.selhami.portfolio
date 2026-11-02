"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Props = {
  // A step of the presentation to open at; without it the presentation plays from its intro.
  at?: number;
  title: string;
  onClose: () => void;
};

/** The "Mes passions" presentation, opened over Endor in a firelit frame. */
export default function PassionsViewer({ at, title, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null),
    close = useRef<HTMLButtonElement>(null),
    leave = useRef(onClose);
  leave.current = onClose;
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      leave.current();
    };
    window.addEventListener("keydown", escape, true);
    return () => {
      window.removeEventListener("keydown", escape, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [mounted]);
  // The presentation is driven by its own keys and scroll, so it takes the focus once loaded;
  // Escape inside it closes the viewer too.
  const loaded = () => {
    const inner = frame.current?.contentWindow;
    if (!inner) return;
    inner.focus();
    try {
      inner.addEventListener("keydown", (event) => {
        if (event.key === "Escape") leave.current();
      });
    } catch {}
  };
  if (!mounted) return null;
  return createPortal(
    <div className="passions-viewer" role="dialog" aria-modal="true" aria-label={`Mes passions · ${title}`}>
      <header className="passions-viewer-bar mono">
        <span>
          <i aria-hidden="true" /> RÉCIT DE L’ANCIEN · {title.toUpperCase()}
        </span>
        <button ref={close} type="button" onClick={onClose} aria-label="Fermer le récit et revenir à Endor">
          ÉCHAP · REVENIR À ENDOR <X size={15} aria-hidden="true" />
        </button>
      </header>
      <iframe
        ref={frame}
        className="passions-viewer-frame"
        src={`/passions/index.html${at === undefined ? "" : `#at=${at}`}`}
        title={`Mes passions · ${title}`}
        allow="fullscreen"
        onLoad={loaded}
      />
    </div>,
    document.body,
  );
}
