"use client";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Briefcase, Send, Volume2, VolumeX, X } from "lucide-react";
import { softwareRendering, type QualityId } from "../graphicsQuality";
import { droidActions, isDroidAction, type DroidLang } from "./actions";
import { detectLang, freshMemory, isRecruiterStatement, localReply, suggestions, type DroidMemory, type DroidMood } from "./brain";
import { createDroidVoice, type DroidSound } from "./droidSounds";
import type { DroidStage, DroidState } from "./droidStage";

// R-X7 and its holographic terminal, at the bottom right of the bridge. Closed, only a small icon
// shows there; that icon or the astromech on the X-wing opens it, and its 3D stage only exists
// while the conversation is open. The language model is tried
// first; if it cannot answer, the local archives do, and the panel always says which it was. A reply
// can only offer buttons from the actions list: the visitor's click is what makes anything happen.

type Line = { id: number; from: "visitor" | "droid"; text: string; actions?: string[] };
type Source = "ai" | "local";

const text = {
  fr: { open: "Parler à R-X7, l’astromécano", openShort: "Parler à R-X7",  close: "Fermer la conversation", intro: "Bip-boup ! Ici R-X7, astromécano de bord. Pose-moi une question sur mon pilote, ou laisse-moi te guider.", placeholder: "Écris à R-X7…", send: "Envoyer", label: "Message pour R-X7", typing: "R-X7 calcule…", title: "CANAL R-X7", sound: "Activer les sons de R-X7", mute: "Couper les sons de R-X7", ai: "IA CONNECTÉE", local: "ARCHIVES LOCALES", recruiter: "MODE RECRUTEUR", notice: "Messages transmis à OpenAI pour obtenir une réponse : pas de données personnelles, merci.", localNote: "IA indisponible : réponses tirées des archives du portfolio.", busy: "Trop de messages d’un coup : je réponds depuis mes archives." },
  en: { open: "Talk to R-X7, the astromech", openShort: "Talk to R-X7",  close: "Close the conversation", intro: "Beep-boop! R-X7 here, ship's astromech. Ask me about my pilot, or let me guide you.", placeholder: "Message R-X7…", send: "Send", label: "Message for R-X7", typing: "R-X7 is computing…", title: "R-X7 CHANNEL", sound: "Turn R-X7's sounds on", mute: "Mute R-X7's sounds", ai: "AI CONNECTED", local: "LOCAL ARCHIVES", recruiter: "RECRUITER MODE", notice: "Your messages go through OpenAI to get an answer. Please leave personal data out.", localNote: "AI unavailable: answers come from the portfolio's archives.", busy: "Too many messages at once: answering from my archives." },
};

const MUTE_KEY = "orbital-droid-muted";
const readMuted = () => {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
};

function DroidGlyph() {
  // The 2D R-X7, for phones and for machines without a graphics card.
  return (
    <svg className="droid-glyph" viewBox="0 0 64 72" aria-hidden="true">
      <path d="M12 36a20 20 0 0 1 40 0z" fill="#8e979d" stroke="#d8d4c8" strokeWidth="1.5" />
      <rect x="12" y="36" width="40" height="4" fill="#d8d4c8" />
      <path d="M14 40h36l-2 22H16z" fill="#dcd8cc" />
      <rect x="14" y="44" width="36" height="3" fill="#c9782f" />
      <rect x="25" y="50" width="14" height="9" rx="1" fill="#26566f" />
      <rect x="4" y="42" width="7" height="24" rx="2" fill="#d8d4c8" />
      <rect x="53" y="42" width="7" height="24" rx="2" fill="#d8d4c8" />
      <path d="M24 17V6M40 18V10" stroke="#7f888e" strokeWidth="1.5" />
      <circle cx="24" cy="6" r="2" fill="#d4792a" />
      <circle cx="40" cy="10" r="1.6" fill="#d4792a" />
      <circle cx="35" cy="27" r="6" fill="#23282c" />
      <circle className="droid-glyph-eye" cx="35" cy="27" r="3.6" fill="#7fe6ff" />
      <circle cx="21" cy="28" r="1.6" fill="#ff9a3c" />
    </svg>
  );
}

export default function DroidLayer({
  visible,
  reduced,
  sound,
  quality,
  openSignal,
  onEnableSound,
  onAction,
}: {
  visible: boolean;
  reduced: boolean;
  sound: boolean;
  quality: QualityId;
  // Goes up by one each time the visitor clicks the astromech on the X-wing.
  openSignal: number;
  onEnableSound: () => void;
  onAction: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<DroidLang>("fr");
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [recruiter, setRecruiter] = useState(false);
  const [muted, setMuted] = useState(false);
  const [threeD, setThreeD] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [stageReady, setStageReady] = useState(false);

  const memory = useRef<DroidMemory>(freshMemory());
  const nextId = useRef(1);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<DroidStage | null>(null);
  const voice = useRef<ReturnType<typeof createDroidVoice> | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const lastActivity = useRef(0);
  const request = useRef<AbortController | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const speaking = sound && !muted;
  const speakingRef = useRef(speaking);
  speakingRef.current = speaking;
  const words = text[lang];

  useEffect(() => {
    setMuted(readMuted());
    const language: DroidLang = navigator.language?.toLowerCase().startsWith("fr") ? "fr" : navigator.language?.toLowerCase().startsWith("en") ? "en" : "fr";
    setLang(language);
    memory.current = freshMemory(language);
    lastActivity.current = performance.now();
  }, []);

  const play = useCallback((name: DroidSound) => {
    if (!speakingRef.current) return;
    voice.current ??= createDroidVoice();
    voice.current.play(name);
  }, []);
  const act = useCallback((state: DroidState) => stage.current?.setState(state), []);
  const wake = useCallback(() => {
    lastActivity.current = performance.now();
    if (stage.current?.state() === "sleeping") {
      act("waking");
      play("wake");
    }
  }, [act, play]);

  // The 3D droid, only where it can run lightly and has room; otherwise the 2D one.
  const wants3D = visible && open && !softwareRendering() && quality !== "eco" && quality !== "lite";
  useEffect(() => {
    const roomy = () => window.innerWidth > 640;
    const update = () => setThreeD(wants3D && roomy());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [wants3D]);
  useEffect(() => {
    if (!threeD || !canvas.current) return;
    let cancelled = false,
      created: DroidStage | null = null;
    import("./droidStage")
      .then(({ createDroidStage }) => {
        if (cancelled || !canvas.current) return;
        created = createDroidStage(canvas.current, { reduced, onContextLost: () => setThreeD(false) });
        stage.current = created;
        setStageReady(true);
        created.setState("happy");
      })
      .catch(() => setThreeD(false));
    return () => {
      cancelled = true;
      created?.dispose();
      stage.current = null;
      setStageReady(false);
    };
  }, [threeD, reduced]);

  useEffect(() => {
    if (!visible) {
      setOpen(false);
      request.current?.abort();
    }
  }, [visible]);

  // Idling: an occasional beep with sound on, and sleep after a while with nothing going on.
  useEffect(() => {
    if (!visible) return;
    const seen = () => {
      if (performance.now() - lastActivity.current > 2000) wake();
      lastActivity.current = performance.now();
    };
    window.addEventListener("pointermove", seen, { passive: true });
    window.addEventListener("keydown", seen);
    const timer = window.setInterval(() => {
      const quiet = performance.now() - lastActivity.current;
      if (quiet > 75000 && stage.current?.state() === "idle") act("sleeping");
      else if (quiet < 60000 && stage.current?.state() === "idle" && Math.random() < 0.05) play(Math.random() < 0.5 ? "beep" : "servo");
    }, 4000);
    return () => {
      window.removeEventListener("pointermove", seen);
      window.removeEventListener("keydown", seen);
      clearInterval(timer);
    };
  }, [visible, act, play, wake]);

  useEffect(() => () => voice.current?.dispose(), []);

  const openChat = () => {
    wake();
    setOpen(true);
    play("wake");
    setLines((current) => (current.length ? current : [{ id: nextId.current++, from: "droid", text: text[memory.current.lang].intro }]));
    if (window.matchMedia("(pointer: fine)").matches) window.setTimeout(() => input.current?.focus(), 60);
  };
  const closeChat = useCallback(() => {
    setOpen(false);
    act("idle");
    play("servo");
  }, [act, play]);

  // The click on the X-wing's astromech. The first value is the page loading, not a click.
  const seenSignal = useRef(openSignal);
  useEffect(() => {
    if (openSignal === seenSignal.current) return;
    seenSignal.current = openSignal;
    if (visible && !openRef.current) openChat();
    // Only a new click counts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [lines, busy, reduced]);

  const ask = async (raw: string) => {
    const message = raw.trim().slice(0, 600);
    if (!message || busy) return;
    setDraft("");
    setBusy(true);
    setNote(null);
    act("thinking");
    play("send");
    // The local engine always runs: it holds the session's memory, and is the answer if all else fails.
    const nextLang = detectLang(message, memory.current.lang);
    if (nextLang !== memory.current.lang) setLang(nextLang);
    const local = localReply(message, memory.current);
    memory.current = local.memory;
    if (local.memory.recruiter) setRecruiter(true);
    const history = lines.filter((line) => line.id > 1 || line.from === "visitor").slice(-8).map((line) => ({ role: line.from === "visitor" ? "user" : "assistant", content: line.text.slice(0, 1200) }));
    setLines((current) => [...current, { id: nextId.current++, from: "visitor", text: message }]);
    const thinking = window.setTimeout(() => play("think"), 350);

    let answer = local.reply as { text: string; actions: string[]; mood: DroidMood };
    let origin: Source = "local";
    let notice: string | null = text[nextLang].localNote;
    // Stating one's role is answered at once: it is the visit itself that changes, not a question.
    if (!isRecruiterStatement(message)) {
      const controller = new AbortController();
      request.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), 18000);
      try {
        const response = await fetch("/api/droid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ messages: [...history, { role: "user", content: message }], recruiter: memory.current.recruiter, lang: nextLang }),
        });
        if (response.status === 429) notice = text[nextLang].busy;
        if (response.ok) {
          const data = (await response.json()) as { reply?: unknown; actions?: unknown; mood?: DroidMood };
          if (typeof data.reply === "string" && data.reply) {
            answer = { text: data.reply, actions: Array.isArray(data.actions) ? data.actions.filter(isDroidAction) : [], mood: data.mood ?? "talking" };
            origin = "ai";
            notice = null;
          }
        }
      } catch {
        // No network, a timeout, or a host without the endpoint: the archives answer.
      } finally {
        clearTimeout(timeout);
      }
    } else notice = null;
    clearTimeout(thinking);
    if (!visibleRef.current) return;
    setSource(origin);
    setNote(notice);
    setBusy(false);
    setLines((current) => [...current, { id: nextId.current++, from: "droid", text: answer.text, actions: answer.actions }]);
    const expression: DroidState = answer.mood === "confused" ? "confused" : answer.mood === "happy" ? "happy" : answer.mood === "scanning" ? "scanning" : "talking";
    act(expression);
    play(answer.mood === "confused" ? "error" : answer.mood === "happy" ? "chirp" : "confirm");
    // Back to rest once it has had time to be read.
    if (expression === "talking") window.setTimeout(() => stage.current?.state() === "talking" && act("idle"), Math.min(9000, 1600 + answer.text.length * 26));
    if (window.matchMedia("(pointer: fine)").matches) input.current?.focus();
  };
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const runAction = (id: string) => {
    if (!isDroidAction(id)) return;
    play("confirm");
    setOpen(false);
    onAction(id);
  };
  const toggleVoice = () => {
    if (!sound) {
      onEnableSound();
      setMuted(false);
      try {
        window.localStorage.removeItem(MUTE_KEY);
      } catch {
        // The choice still holds for this visit.
      }
      return;
    }
    const next = !muted;
    setMuted(next);
    try {
      if (next) window.localStorage.setItem(MUTE_KEY, "1");
      else window.localStorage.removeItem(MUTE_KEY);
    } catch {
      // The choice still holds for this visit.
    }
  };
  const onPanelKey = (event: ReactKeyboardEvent) => {
    // Typing must never fly the ship: nothing here reaches the bridge's keyboard controls.
    event.stopPropagation();
    if (event.key === "Escape") closeChat();
  };

  if (!visible) return null;
  // Closed, only a small icon in the corner says the droid is there.
  if (!open)
    return (
      <button className="droid-launcher" aria-label={words.open} onClick={openChat} onPointerDown={(event) => event.stopPropagation()}>
        <DroidGlyph />
        <span className="mono" aria-hidden="true">{words.openShort}</span>
      </button>
    );
  const offers = suggestions({ ...memory.current, recruiter, lang });
  const asked = new Set(lines.filter((line) => line.from === "visitor").map((line) => line.text));
  const fresh = offers.filter((item) => !asked.has(item));
  return (
    <div className={`droid-layer ${open ? "is-open" : ""}`} onPointerDown={(event) => event.stopPropagation()}>
      <button className="droid-trigger" aria-label={words.close} onClick={closeChat} onPointerEnter={wake}>
        {threeD && <canvas ref={canvas} className="droid-canvas" aria-hidden="true" style={{ opacity: stageReady ? 1 : 0 }} />}
        {(!threeD || !stageReady) && <DroidGlyph />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.section
            key="chat"
            className="droid-chat"
            role="dialog"
            aria-label="R-X7"
            initial={{ opacity: 0, scale: reduced ? 1 : 0.92, x: reduced ? 0 : 18, filter: reduced ? "none" : "brightness(1.8)" }}
            animate={{ opacity: 1, scale: 1, x: 0, filter: "brightness(1)" }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0.95, x: reduced ? 0 : 10 }}
            transition={{ duration: reduced ? 0.01 : 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            onKeyDown={onPanelKey}
            onKeyUp={(event) => event.stopPropagation()}
          >
            <i className="droid-chat-scan" aria-hidden="true" />
            <header className="droid-chat-top mono">
              <span className="droid-chat-title">
                <span className="droid-chat-icon"><DroidGlyph /></span>
                {words.title}
                {source && <em className={source === "ai" ? "is-ai" : ""}>{source === "ai" ? words.ai : words.local}</em>}
              </span>
              <span className="droid-chat-tools">
                <button aria-label={speaking ? words.mute : words.sound} aria-pressed={speaking} onClick={toggleVoice}>
                  {speaking ? <Volume2 size={15} aria-hidden="true" /> : <VolumeX size={15} aria-hidden="true" />}
                </button>
                <button aria-label={words.close} onClick={closeChat}>
                  <X size={16} aria-hidden="true" />
                </button>
              </span>
            </header>
            {recruiter && (
              <p className="droid-chat-mode mono">
                <Briefcase size={12} aria-hidden="true" /> {words.recruiter}
              </p>
            )}
            <div ref={log} className="droid-chat-log" role="log" aria-live="polite">
              {lines.map((line) => (
                <div key={line.id} className={`droid-line from-${line.from}`}>
                  <p>{line.text}</p>
                  {!!line.actions?.length && (
                    <div className="droid-line-actions">
                      {line.actions.map((id) => {
                        const info = droidActions[id];
                        const label = info[lang];
                        return info.href ? (
                          <a key={id} className="droid-action mono" href={info.href} target={info.external ? "_blank" : undefined} rel={info.external ? "noopener noreferrer" : undefined} download={id === "cv" ? true : undefined} onClick={() => play("confirm")}>
                            {label}
                          </a>
                        ) : (
                          <button key={id} className="droid-action mono" onClick={() => runAction(id)}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              {busy && (
                <p className="droid-typing mono" role="status">
                  <i /><i /><i /> {words.typing}
                </p>
              )}
              {note && <p className="droid-note">{note}</p>}
            </div>
            {!busy && fresh.length > 0 && (
              <div className="droid-suggestions">
                {fresh.slice(0, lines.length > 3 ? 3 : 8).map((item) => (
                  <button key={item} onClick={() => void ask(item)}>
                    {item}
                  </button>
                ))}
              </div>
            )}
            <form
              className="droid-chat-input"
              onSubmit={(event) => {
                event.preventDefault();
                void ask(draft);
              }}
            >
              <textarea
                ref={input}
                rows={1}
                value={draft}
                maxLength={600}
                placeholder={words.placeholder}
                aria-label={words.label}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void ask(draft);
                  }
                }}
              />
              <button type="submit" aria-label={words.send} disabled={busy || !draft.trim()}>
                <Send size={15} aria-hidden="true" />
              </button>
            </form>
            {source !== "local" && <p className="droid-chat-notice">{words.notice}</p>}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
