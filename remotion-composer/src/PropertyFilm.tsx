// Real-estate film built from still renders: Ken Burns motion per shot,
// fade / hard-cut / zoom-punch transitions, Arabic-first (RTL) text overlays,
// word-highlight captions and one mixed audio track. Works at any aspect
// ratio, so the same props shape drives a 16:9 film and a 9:16 reel.
import React from "react";
import {
  AbsoluteFill,
  Audio,
  CalculateMetadataFunction,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { CaptionOverlay, WordCaption } from "./components/CaptionOverlay";
import { loadArabicFont, withArabicFallback } from "./lib/localFonts";
import { textDirection } from "./lib/textDirection";
import { resolveAsset } from "./lib/resolveAsset";

loadArabicFont(["400", "700"]);
const FONT = withArabicFallback("Inter, system-ui, sans-serif");

type Motion = "zoomIn" | "zoomOut" | "panUp" | "panDown" | "panLeft" | "panRight" | "none";

interface Shot {
  src: string;
  start: number;
  end: number;
  motion?: Motion;
  /** cover fills the frame; contain-blur shows the whole image on a blurred copy. */
  fit?: "cover" | "contain-blur";
  /** split puts the image on the left and leaves the right for a text panel (RTL). */
  layout?: "full" | "split";
  transition?: "fade" | "cut" | "zoom";
  transitionSec?: number;
  /** 0-1 dark gradient at the bottom for caption/text legibility. */
  shade?: number;
}

interface Feature {
  icon: "pool" | "gym" | "cafe" | "parking" | "building" | "pin";
  label: string;
  at: number; // seconds, absolute
}

interface Overlay {
  type: "title" | "bigText" | "stat" | "lowerThird" | "features" | "endCard" | "chips" | "brand";
  start: number;
  end: number;
  text?: string;
  subtitle?: string;
  value?: number;
  suffix?: string;
  label?: string;
  features?: Feature[];
  chips?: { label: string; at: number }[];
  /** Position for bigText/stat: "center" | "top" | "bottom" | "panel". */
  position?: string;
  stats?: { value: number; label: string; at: number }[];
  /** endCard: icon before the subtitle ("none" hides it). Default "pin". */
  subIcon?: Feature["icon"] | "none";
  /** brand: logo mark image; endCard: full logo lockup image (public path). */
  src?: string;
}

export interface PropertyFilmProps {
  [key: string]: unknown;
  width: number;
  height: number;
  durationSec: number;
  theme: { bg: string; text: string; accent: string; panel: string; muted: string };
  shots: Shot[];
  overlays: Overlay[];
  captions?: WordCaption[];
  captionFontSize?: number;
  captionWordsPerPage?: number;
  captionBottom?: number;
  audio?: string;
}

export const calculatePropertyFilmMetadata: CalculateMetadataFunction<PropertyFilmProps> = async ({ props }) => ({
  width: props.width || 1920,
  height: props.height || 1080,
  durationInFrames: Math.ceil((props.durationSec || 30) * 30),
});

const ease = Easing.bezier(0.33, 0, 0.2, 1);

// ---------------------------------------------------------------------------
// Shots
// ---------------------------------------------------------------------------

const MovingImage: React.FC<{ src: string; motion: Motion; fit: "cover" | "contain-blur"; strength?: number }> = ({
  src,
  motion,
  fit,
  strength = 1,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp", easing: ease });
  const z = 0.12 * strength;
  const pan = 6 * strength; // percent
  let scale = 1.08;
  let x = 0;
  let y = 0;
  switch (motion) {
    case "zoomIn":
      scale = 1.02 + z * p;
      break;
    case "zoomOut":
      scale = 1.02 + z * (1 - p);
      break;
    case "panLeft":
      scale = 1.14;
      x = interpolate(p, [0, 1], [pan, -pan]);
      break;
    case "panRight":
      scale = 1.14;
      x = interpolate(p, [0, 1], [-pan, pan]);
      break;
    case "panUp":
      scale = 1.14;
      y = interpolate(p, [0, 1], [-pan, pan]);
      break;
    case "panDown":
      scale = 1.14;
      y = interpolate(p, [0, 1], [pan, -pan]);
      break;
  }
  // For a tall image in cover mode, panUp/panDown travel the full height:
  // objectPosition moves from the bottom of the building to its crown.
  const tilt = motion === "panUp" || motion === "panDown";
  const objectPosition = tilt
    ? `50% ${motion === "panUp" ? interpolate(p, [0, 1], [100, 0]) : interpolate(p, [0, 1], [0, 100])}%`
    : "50% 50%";
  const img = (
    <Img
      src={resolveAsset(src)}
      style={{
        width: "100%",
        height: "100%",
        objectFit: fit === "cover" ? "cover" : "contain",
        objectPosition,
        transform: tilt ? `scale(${1.04 + 0.04 * p})` : `scale(${scale}) translate(${x}%, ${y}%)`,
      }}
    />
  );
  if (fit === "cover") return <AbsoluteFill style={{ overflow: "hidden" }}>{img}</AbsoluteFill>;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img
        src={resolveAsset(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "blur(40px) brightness(0.55)",
          transform: "scale(1.2)",
        }}
      />
      {img}
    </AbsoluteFill>
  );
};

const ShotView: React.FC<{ shot: Shot; theme: PropertyFilmProps["theme"] }> = ({ shot, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const tf = Math.round((shot.transitionSec ?? 0.7) * fps);
  const t = shot.transition ?? "fade";
  const opacity = t === "fade" ? interpolate(frame, [0, tf], [0, 1], { extrapolateRight: "clamp" }) : 1;
  const punch = t === "zoom" ? interpolate(frame, [0, 8], [1.18, 1], { extrapolateRight: "clamp", easing: ease }) : 1;
  const flash = t === "zoom" ? interpolate(frame, [0, 5], [0.55, 0], { extrapolateRight: "clamp" }) : 0;
  const split = shot.layout === "split";
  const shade = shot.shade ?? 0.45;

  const image = <MovingImage src={shot.src} motion={shot.motion ?? "zoomIn"} fit={shot.fit ?? "cover"} />;

  return (
    <AbsoluteFill style={{ opacity, transform: `scale(${punch})` }}>
      {split ? (
        <AbsoluteFill style={{ background: theme.panel }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: "56%",
              overflow: "hidden",
              clipPath: `inset(0 ${interpolate(frame, [0, tf + 6], [100, 0], { extrapolateRight: "clamp", easing: ease })}% 0 0)`,
            }}
          >
            {image}
          </div>
          <div
            style={{
              position: "absolute",
              left: "56%",
              top: "18%",
              bottom: "18%",
              width: Math.max(4, width * 0.003),
              background: theme.accent,
            }}
          />
        </AbsoluteFill>
      ) : (
        image
      )}
      {!split && shade > 0 && (
        <AbsoluteFill
          style={{
            background: `linear-gradient(180deg, rgba(0,0,0,${shade * 0.35}) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 55%, rgba(0,0,0,${shade}) 100%)`,
          }}
        />
      )}
      {flash > 0 && <AbsoluteFill style={{ background: "#FFFFFF", opacity: flash }} />}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Icons (inline SVG, stroke only)
// ---------------------------------------------------------------------------

const Icon: React.FC<{ name: Feature["icon"]; size: number; color: string }> = ({ name, size, color }) => {
  const p = { fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<Feature["icon"], React.ReactNode> = {
    pool: (
      <>
        <path {...p} d="M3 17c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0" />
        <path {...p} d="M3 21c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0" />
        <path {...p} d="M8 15V5a2 2 0 0 1 4 0M16 15V5a2 2 0 0 0-4 0M8 9h8" />
      </>
    ),
    gym: (
      <>
        <path {...p} d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
      </>
    ),
    cafe: (
      <>
        <path {...p} d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z" />
        <path {...p} d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3" />
      </>
    ),
    parking: (
      <>
        <rect {...p} x="3.5" y="3.5" width="17" height="17" rx="3" />
        <path {...p} d="M9.5 17V7h3.5a3 3 0 0 1 0 6H9.5" />
      </>
    ),
    building: (
      <>
        <path {...p} d="M6 21V4h9v17M15 9h4v12M3 21h18M9 7h3M9 10.5h3M9 14h3M9 17.5h3" />
      </>
    ),
    pin: (
      <>
        <path {...p} d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
        <circle {...p} cx="12" cy="10" r="2.5" />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------

// Dark glass card behind text that sits on a photo, so it reads on bright sky.
const glass = (base: number): React.CSSProperties => ({
  background: "rgba(20,18,15,0.58)",
  backdropFilter: "blur(8px)",
  borderRadius: base * 0.025,
  padding: `${base * 0.025}px ${base * 0.04}px`,
  boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
});

const Scrim: React.FC<{ strength?: number }> = ({ strength = 0.55 }) => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, rgba(15,13,10,${strength}) 0%, rgba(15,13,10,${strength * 0.6}) 45%, rgba(15,13,10,0) 75%)` }} />
);

const useRise = (delayFrames = 0, damping = 18) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delayFrames, fps, config: { damping, stiffness: 110 } });
};

const useExit = (fadeFrames = 10) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return interpolate(frame, [durationInFrames - fadeFrames, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

/** Words that rise one by one in reading order (right to left for Arabic). */
const WordsIn: React.FC<{ text: string; size: number; color: string; weight?: number; step?: number; accentFirst?: string }> = ({
  text,
  size,
  color,
  weight = 700,
  step = 4,
  accentFirst,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dir = textDirection(text);
  const words = text.split(" ");
  return (
    <div dir={dir} style={{ direction: dir, fontFamily: FONT, fontSize: size, fontWeight: weight, color, lineHeight: 1.5, textAlign: "center" }}>
      {words.map((w, i) => {
        const s = spring({ frame: frame - i * step, fps, config: { damping: 16, stiffness: 120 } });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: s,
              transform: `translateY(${interpolate(s, [0, 1], [size * 0.45, 0])}px)`,
              color: i === 0 && accentFirst ? accentFirst : color,
              textShadow: "0 4px 24px rgba(0,0,0,0.45)",
            }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </div>
  );
};

const Title: React.FC<{ o: Overlay; theme: PropertyFilmProps["theme"] }> = ({ o, theme }) => {
  const { width, height } = useVideoConfig();
  const exit = useExit(18);
  const line = useRise(10, 24);
  const sub = useRise(18, 22);
  const base = Math.min(width, height);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: exit }}>
      <div style={{ ...glass(base), display: "flex", flexDirection: "column", alignItems: "center", padding: `${base * 0.03}px ${base * 0.06}px` }}>
      {o.label && (
        <div dir="rtl" style={{ fontFamily: FONT, fontSize: base * 0.04, fontWeight: 700, color: theme.accent, opacity: sub, letterSpacing: 1, marginBottom: base * 0.015, textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
          {o.label}
        </div>
      )}
      <WordsIn text={o.text ?? ""} size={base * 0.11} color={theme.text} accentFirst={theme.accent} step={5} />
      <div style={{ width: interpolate(line, [0, 1], [0, base * 0.35]), height: Math.max(2, base * 0.004), background: theme.accent, margin: `${base * 0.02}px 0` }} />
      {o.subtitle && (
        <div dir="rtl" style={{ fontFamily: FONT, fontSize: base * 0.04, color: theme.text, opacity: sub, fontWeight: 400, textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
          {o.subtitle}
        </div>
      )}
      </div>
    </AbsoluteFill>
  );
};

const BigText: React.FC<{ o: Overlay; theme: PropertyFilmProps["theme"] }> = ({ o, theme }) => {
  const { width, height } = useVideoConfig();
  const exit = useExit(6);
  const base = Math.min(width, height);
  const pos = o.position ?? "center";
  const justify = pos === "top" ? "flex-start" : pos === "bottom" ? "flex-end" : "center";
  return (
    <AbsoluteFill style={{ justifyContent: justify, alignItems: "center", padding: `${height * 0.16}px ${width * 0.07}px`, opacity: exit }}>
      <div style={glass(base)}>
      <WordsIn text={o.text ?? ""} size={base * 0.1} color={theme.text} accentFirst={theme.accent} step={3} />
      </div>
    </AbsoluteFill>
  );
};

const CountUp: React.FC<{ value: number; at: number; size: number; color: string }> = ({ value, at, size, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame - at * fps, [0, fps * 0.9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return (
    <span style={{ fontFamily: FONT, fontSize: size, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
      {Math.round(value * p).toLocaleString("ar-SA")}
    </span>
  );
};

const Stat: React.FC<{ o: Overlay; theme: PropertyFilmProps["theme"] }> = ({ o, theme }) => {
  const { width, height } = useVideoConfig();
  const exit = useExit(8);
  const base = Math.min(width, height);
  const inPanel = o.position === "panel";
  const stats = o.stats ?? [{ value: o.value ?? 0, label: o.label ?? "", at: 0 }];
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        left: inPanel ? "57%" : 0,
        width: inPanel ? "43%" : "100%",
        justifyContent: "center",
        alignItems: "center",
        gap: base * 0.05,
        flexDirection: "column",
        opacity: exit,
      }}
    >
      {!inPanel && <Scrim />}
      {stats.map((s, i) => {
        const rise = spring({ frame: frame - s.at * fps, fps, config: { damping: 18, stiffness: 110 } });
        return (
          <div key={i} dir="rtl" style={{ textAlign: "center", opacity: rise, transform: `translateY(${interpolate(rise, [0, 1], [30, 0])}px)` }}>
            <CountUp value={s.value} at={s.at} size={base * (inPanel ? 0.2 : 0.24)} color={theme.accent} />
            <div style={{ fontFamily: FONT, fontSize: base * 0.05, color: theme.text, fontWeight: 700, marginTop: -base * 0.02, textShadow: inPanel ? "none" : "0 2px 16px rgba(0,0,0,0.6)" }}>
              {s.label}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const LowerThird: React.FC<{ o: Overlay; theme: PropertyFilmProps["theme"] }> = ({ o, theme }) => {
  const { width, height } = useVideoConfig();
  const exit = useExit(10);
  const bar = useRise(0, 22);
  const txt = useRise(6, 20);
  const base = Math.min(width, height);
  return (
    <AbsoluteFill style={{ opacity: exit }}>
      <div
        dir="rtl"
        style={{
          position: "absolute",
          right: width * 0.05,
          bottom: height * 0.22,
          display: "flex",
          alignItems: "center",
          gap: base * 0.025,
          transform: `translateX(${interpolate(bar, [0, 1], [width * 0.1, 0])}px)`,
          opacity: bar,
        }}
      >
        <div style={{ width: Math.max(4, base * 0.008), height: base * 0.13, background: theme.accent, borderRadius: 2 }} />
        <div style={{ opacity: txt, ...glass(base) }}>
          <div style={{ fontFamily: FONT, fontSize: base * 0.055, fontWeight: 700, color: theme.text, textShadow: "0 2px 14px rgba(0,0,0,0.6)" }}>{o.text}</div>
          {o.subtitle && (
            <div style={{ fontFamily: FONT, fontSize: base * 0.032, color: theme.text, opacity: 0.85, textShadow: "0 2px 10px rgba(0,0,0,0.6)" }}>{o.subtitle}</div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Features: React.FC<{ o: Overlay; theme: PropertyFilmProps["theme"] }> = ({ o, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const exit = useExit(8);
  const base = Math.min(width, height);
  const inPanel = o.position === "panel";
  return (
    <AbsoluteFill
      style={{
        left: inPanel ? "57%" : 0,
        width: inPanel ? "43%" : "100%",
        justifyContent: "center",
        alignItems: inPanel ? "center" : "flex-end",
        padding: inPanel ? 0 : `0 ${width * 0.06}px`,
        opacity: exit,
      }}
    >
      <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: base * 0.035, ...(inPanel ? {} : glass(base)) }}>
        {o.text && (
          <div style={{ fontFamily: FONT, fontSize: base * 0.045, color: theme.muted, fontWeight: 400, marginBottom: base * 0.01 }}>{o.text}</div>
        )}
        {(o.features ?? []).map((f, i) => {
          const s = spring({ frame: frame - f.at * fps, fps, config: { damping: 16, stiffness: 120 } });
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: base * 0.03, opacity: s, transform: `translateX(${interpolate(s, [0, 1], [-60, 0])}px)` }}>
              <div
                style={{
                  width: base * 0.11,
                  height: base * 0.11,
                  borderRadius: base * 0.03,
                  border: `2px solid ${theme.accent}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: inPanel ? "transparent" : "rgba(0,0,0,0.35)",
                }}
              >
                <Icon name={f.icon} size={base * 0.07} color={theme.accent} />
              </div>
              <div style={{ fontFamily: FONT, fontSize: base * 0.06, fontWeight: 700, color: theme.text, textShadow: inPanel ? "none" : "0 2px 14px rgba(0,0,0,0.6)" }}>
                {f.label}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Chips: React.FC<{ o: Overlay; theme: PropertyFilmProps["theme"] }> = ({ o, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const exit = useExit(8);
  const base = Math.min(width, height);
  return (
    <AbsoluteFill style={{ justifyContent: o.position === "top" ? "flex-start" : "center", alignItems: "center", paddingTop: height * 0.14, opacity: exit }}>
      <div dir="rtl" style={{ display: "flex", flexWrap: "wrap", gap: base * 0.025, justifyContent: "center", maxWidth: width * 0.9 }}>
        {(o.chips ?? []).map((c, i) => {
          const s = spring({ frame: frame - c.at * fps, fps, config: { damping: 12, stiffness: 160 } });
          return (
            <div
              key={i}
              style={{
                fontFamily: FONT,
                fontSize: base * 0.055,
                fontWeight: 700,
                color: theme.bg,
                background: theme.accent,
                padding: `${base * 0.012}px ${base * 0.04}px`,
                borderRadius: base * 0.05,
                transform: `scale(${s})`,
                boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
              }}
            >
              {c.label}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Small corner wordmark that stays on screen (office identity on social posts). */
const Brand: React.FC<{ o: Overlay; theme: PropertyFilmProps["theme"] }> = ({ o, theme }) => {
  const { width, height } = useVideoConfig();
  const fade = useRise(0, 20);
  const exit = useExit(10);
  const base = Math.min(width, height);
  const top = (o.position ?? "top") !== "bottom";
  return (
    <AbsoluteFill style={{ justifyContent: top ? "flex-start" : "flex-end", alignItems: "flex-end", padding: `${base * 0.045}px ${base * 0.05}px`, opacity: fade * exit }}>
      <div dir="rtl" style={{ display: "flex", alignItems: "center", gap: base * 0.014, background: "rgba(43,40,35,0.45)", borderRadius: base * 0.012, padding: `${base * 0.01}px ${base * 0.018}px`, backdropFilter: "blur(6px)" }}>
        {o.src ? <Img src={resolveAsset(o.src)} style={{ height: base * 0.05 }} /> : <Icon name="building" size={base * 0.04} color={theme.accent} />}
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span style={{ fontFamily: FONT, fontSize: base * 0.03, fontWeight: 700, color: theme.text }}>{o.text ?? "أركان العز"}</span>
          {o.subtitle && <span style={{ fontFamily: FONT, fontSize: base * 0.018, color: theme.accent }}>{o.subtitle}</span>}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const EndCard: React.FC<{ o: Overlay; theme: PropertyFilmProps["theme"] }> = ({ o, theme }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const bg = interpolate(frame, [0, 18], [0, 0.88], { extrapolateRight: "clamp" });
  const base = Math.min(width, height);
  const sub = useRise(22, 22);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <AbsoluteFill style={{ background: theme.bg, opacity: bg }} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {o.src ? (
        <>
          <Img src={resolveAsset(o.src)} style={{ width: base * 0.62, opacity: sub, transform: `translateY(${(1 - sub) * base * 0.03}px)` }} />
          {o.label && (
            <div dir="rtl" style={{ fontFamily: FONT, fontSize: base * 0.05, fontWeight: 700, color: theme.text, opacity: sub, marginTop: base * 0.045, padding: `${base * 0.008}px ${base * 0.03}px`, borderTop: `2px solid ${theme.accent}`, textShadow: "0 2px 14px rgba(0,0,0,0.85)" }}>
              {o.label}
            </div>
          )}
        </>
      ) : (<>
      <div style={{ marginBottom: base * 0.03, opacity: sub }}>
        <Icon name="building" size={base * 0.12} color={theme.accent} />
      </div>
      {o.label && (
        <div dir="rtl" style={{ fontFamily: FONT, fontSize: base * 0.035, color: theme.accent, opacity: sub, marginBottom: base * 0.01 }}>
          {o.label}
        </div>
      )}
      <WordsIn text={o.text ?? ""} size={base * 0.09} color={theme.text} accentFirst={theme.accent} step={5} />
      {o.subtitle && (
        <div dir="rtl" style={{ display: "flex", alignItems: "center", gap: base * 0.015, marginTop: base * 0.02, opacity: sub }}>
          {o.subIcon !== "none" && <Icon name={o.subIcon ?? "pin"} size={base * 0.05} color={theme.accent} />}
          <span style={{ fontFamily: FONT, fontSize: base * 0.045, color: theme.text }}>{o.subtitle}</span>
        </div>
      )}
      </>)}
      </div>
    </AbsoluteFill>
  );
};

const OverlayView: React.FC<{ o: Overlay; theme: PropertyFilmProps["theme"] }> = ({ o, theme }) => {
  switch (o.type) {
    case "title":
      return <Title o={o} theme={theme} />;
    case "bigText":
      return <BigText o={o} theme={theme} />;
    case "stat":
      return <Stat o={o} theme={theme} />;
    case "lowerThird":
      return <LowerThird o={o} theme={theme} />;
    case "features":
      return <Features o={o} theme={theme} />;
    case "chips":
      return <Chips o={o} theme={theme} />;
    case "endCard":
      return <EndCard o={o} theme={theme} />;
    case "brand":
      return <Brand o={o} theme={theme} />;
  }
};

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

export const PropertyFilm: React.FC<PropertyFilmProps> = (props) => {
  const { fps } = useVideoConfig();
  const { theme } = props;
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      {props.shots.map((s, i) => {
        const from = Math.round(s.start * fps);
        const dur = Math.max(1, Math.round((s.end - s.start) * fps) + (s.transition === "cut" || s.transition === "zoom" ? 0 : Math.round((props.shots[i + 1]?.transitionSec ?? 0.7) * fps)));
        return (
          <Sequence key={`shot-${i}`} from={from} durationInFrames={dur}>
            <ShotView shot={s} theme={theme} />
          </Sequence>
        );
      })}
      {props.overlays.map((o, i) => {
        const from = Math.round(o.start * fps);
        const dur = Math.max(1, Math.round((o.end - o.start) * fps));
        // Overlay animations read absolute times (feature.at); shift them to the sequence.
        const local: Overlay = {
          ...o,
          features: o.features?.map((f) => ({ ...f, at: f.at - o.start })),
          chips: o.chips?.map((c) => ({ ...c, at: c.at - o.start })),
          stats: o.stats?.map((s) => ({ ...s, at: s.at - o.start })),
        };
        return (
          <Sequence key={`ov-${i}`} from={from} durationInFrames={dur}>
            <OverlayView o={local} theme={theme} />
          </Sequence>
        );
      })}
      {props.captions && props.captions.length > 0 && (
        <AbsoluteFill style={{ transform: `translateY(-${props.captionBottom ?? 0}px)` }}>
          <CaptionOverlay
            words={props.captions}
            wordsPerPage={props.captionWordsPerPage ?? 6}
            fontSize={props.captionFontSize ?? 44}
            color={theme.text}
            highlightColor={theme.accent}
            backgroundColor="rgba(20,18,15,0.55)"
            fontFamily={FONT}
          />
        </AbsoluteFill>
      )}
      {props.audio && <Audio src={resolveAsset(props.audio)} />}
    </AbsoluteFill>
  );
};
