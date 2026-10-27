"use client";
import dynamic from "next/dynamic";
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });
import { motion } from "motion/react";
const orbit = {
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: 90,
  w: 200,
  h: 200,
  nm: "Orbital navigation",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "Orbit",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: {
          a: 1,
          k: [
            { t: 0, s: [0] },
            { t: 90, s: [360] },
          ],
        },
        p: { a: 0, k: [100, 100, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      shapes: [
        {
          ty: "gr",
          it: [
            {
              ty: "el",
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [136, 136] },
              d: 1,
            },
            {
              ty: "st",
              c: { a: 0, k: [0.92, 0.56, 0.34, 1] },
              o: { a: 0, k: 100 },
              w: { a: 0, k: 1 },
              lc: 2,
              lj: 1,
            },
            {
              ty: "tm",
              s: { a: 0, k: 0 },
              e: { a: 0, k: 72 },
              o: { a: 0, k: 0 },
              m: 1,
            },
            {
              ty: "tr",
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
        },
      ],
      ip: 0,
      op: 90,
      st: 0,
      bm: 0,
    },
  ],
};
export default function Preloader({
  progress,
  reduced,
}: {
  progress: number;
  reduced: boolean;
}) {
  return (
    <motion.div
      className="preloader"
      role="status"
      aria-label="Préparation du voyage spatial"
      initial={{ opacity: 1 }}
      exit={{
        opacity: 0,
        filter: reduced ? "none" : "blur(12px)",
        transition: { duration: reduced ? 0.15 : 0.7 },
      }}
    >
      <div className="preloader-top">
        <span>ORBITAL®</span>
        <span>PROTOCOLE DE DÉPART / 001</span>
      </div>
      <div className="loader-core">
        <div className="loader-orbits">
          <Lottie animationData={orbit} loop autoplay={!reduced} />
          <span className="loader-cross">✦</span>
        </div>
        <p>
          IL Y A TANT D’UNIVERS
          <br />À EXPLORER.
        </p>
        <span className="mono loading-label">
          {progress < 40
            ? "ÉTABLISSEMENT DE LA LIAISON"
            : progress < 80
              ? "CALIBRAGE DE L’HYPERPROPULSEUR"
              : "TOUS LES SYSTÈMES SONT PRÊTS"}
        </span>
      </div>
      <div className="loader-bottom">
        <span className="mono">PRÉPARATION DU SAUT HYPERSPATIAL</span>
        <span className="loader-percent">
          {String(progress).padStart(3, "0")}
          <small>%</small>
        </span>
        <div className="loader-line">
          <motion.i style={{ width: progress + "%" }} />
        </div>
      </div>
    </motion.div>
  );
}
