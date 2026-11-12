"use client";
import { motion } from "motion/react";
import { Check, FastForward } from "lucide-react";

// A playable primer of about fifteen seconds: fly, boost, set a course. Each step is ticked by
// actually doing it, and the whole thing can be skipped at any time.

export type TutorialStep = 0 | 1 | 2 | 3;

const steps = [
  {
    title: "PILOTER",
    desktop: (
      <>
        Maintenez <kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd> ou <kbd>ZQSD</kbd>, ou glissez dans l’espace
      </>
    ),
    touch: <>Posez un doigt et glissez pour diriger le vaisseau</>,
  },
  {
    title: "POSTCOMBUSTION",
    desktop: (
      <>
        Maintenez <kbd>MAJ</kbd> pour pousser les réacteurs
      </>
    ),
    touch: <>Maintenez le bouton BOOST</>,
  },
  {
    title: "METTRE LE CAP",
    desktop: (
      <>
        Visez une planète puis <kbd>E</kbd>, ou cliquez dessus
      </>
    ),
    touch: <>Touchez une planète pour la rejoindre</>,
  },
];

export default function FlightTutorial({ step, reduced, onSkip }: { step: TutorialStep; reduced: boolean; onSkip: () => void }) {
  const done = step >= 3;
  const current = steps[Math.min(step, 2)];
  return (
    <motion.section
      className="flight-tutorial"
      data-done={done}
      aria-label="Prise en main du vaisseau"
      initial={{ opacity: 0, y: reduced ? 0 : 10 }}
      animate={{ opacity: 1, y: 0, transition: { delay: reduced ? 0 : 0.5 } }}
      exit={{ opacity: 0, y: reduced ? 0 : 6 }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <ol aria-hidden="true">
        {steps.map((entry, index) => (
          <li key={entry.title} data-state={index < step ? "done" : index === step ? "now" : "next"}>
            {index < step ? <Check size={11} strokeWidth={3} /> : index + 1}
          </li>
        ))}
      </ol>
      <div className="flight-tutorial-text" role="status" aria-live="polite">
        {done ? (
          <>
            <b>PARÉ AU VOL</b>
            <span>Bonne exploration, commandant.</span>
          </>
        ) : (
          <>
            <b>{current.title}</b>
            <span className="flight-tutorial-desktop">{current.desktop}</span>
            <span className="flight-tutorial-touch">{current.touch}</span>
          </>
        )}
      </div>
      {!done && (
        <button className="flight-tutorial-skip" onClick={onSkip}>
          PASSER <FastForward size={12} aria-hidden="true" />
        </button>
      )}
    </motion.section>
  );
}
