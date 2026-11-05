import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadArabicFont, withArabicFallback } from "../lib/localFonts";
import { textDirection } from "../lib/textDirection";

loadArabicFont(["400", "700"]);

const HERO_FONT = "Space Grotesk, Inter, system-ui, sans-serif";

type HeroTitleProps = {
  title: string;
  subtitle?: string;
  /** Color of the leading accent characters and the underline. */
  accentColor?: string;
  /** Color of the remaining title characters. Pass the theme's textColor. */
  textColor?: string;
  /** Subtitle color. */
  subtitleColor?: string;
  /**
   * Scrim painted behind the title so it separates from whatever is underneath.
   * Defaults to a dark wash; a light theme must pass a light one, otherwise the
   * scrim darkens the backdrop and cancels out the theme's dark text.
   */
  scrimBackground?: string;
};

const DEFAULT_SCRIM =
  "radial-gradient(ellipse at center, rgba(15,23,42,0.35) 0%, rgba(15,23,42,0.55) 100%)";

export const HeroTitle: React.FC<HeroTitleProps> = ({
  title,
  subtitle,
  accentColor = "#22D3EE",
  textColor = "#F8FAFC",
  subtitleColor = "#A78BFA",
  scrimBackground = DEFAULT_SCRIM,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Staggered letter-by-letter spring. Arabic letters join to their
  // neighbours, so splitting an Arabic title into one inline-block per letter
  // breaks every word into isolated letters and lays them out left to right.
  // RTL titles animate word by word instead, in reading order.
  const direction = textDirection(title);
  const rtl = direction === "rtl";
  const titleChars = rtl ? title.split(/(\s+)/).filter(Boolean) : title.split("");
  const step = rtl ? 4 : 1.2;
  const accentCount = rtl ? 1 : 8; // first word (RTL) or first 8 letters

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: scrimBackground,
      }}
    >
      <div dir={direction} style={{ direction, textAlign: "center", maxWidth: "85%" }}>
        {/* Main title with per-character spring */}
        <div
          style={{
            fontSize: 72,
            fontWeight: rtl ? 700 : 800,
            fontFamily: withArabicFallback(HERO_FONT),
            lineHeight: rtl ? 1.5 : 1.2,
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 0,
          }}
        >
          {titleChars.map((char, i) => {
            const delay = i * step;
            const charSpring = spring({
              frame: frame - delay,
              fps,
              config: { damping: 12, stiffness: 150 },
            });

            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  opacity: charSpring,
                  transform: `translateY(${interpolate(charSpring, [0, 1], [30, 0])}px)`,
                  color: i < accentCount ? accentColor : textColor, // Accent first word
                  whiteSpace: char === " " ? "pre" : undefined,
                  minWidth: char === " " ? "0.3em" : undefined,
                }}
              >
                {char}
              </span>
            );
          })}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div
            style={{
              marginTop: 20,
              opacity: spring({
                frame: frame - titleChars.length * step - 5,
                fps,
                config: { damping: 20 },
              }),
              fontSize: 28,
              fontWeight: 400,
              color: subtitleColor,
              fontFamily: withArabicFallback(HERO_FONT),
              // Letter spacing pulls joined Arabic letters apart.
              letterSpacing: rtl ? 0 : "0.1em",
              textTransform: rtl ? undefined : "uppercase",
            }}
          >
            {subtitle}
          </div>
        )}

        {/* Animated underline */}
        <div
          style={{
            margin: "24px auto 0",
            height: 3,
            backgroundColor: accentColor,
            borderRadius: 2,
            width: interpolate(
              spring({
                frame: frame - 15,
                fps,
                config: { damping: 15, stiffness: 60 },
              }),
              [0, 1],
              [0, 400]
            ),
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
