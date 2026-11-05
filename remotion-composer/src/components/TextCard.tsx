import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadArabicFont, withArabicFallback } from "../lib/localFonts";
import { textDirection } from "../lib/textDirection";

loadArabicFont(["700"]);

interface TextCardProps {
  text: string;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
}

export const TextCard: React.FC<TextCardProps> = ({
  text,
  fontSize = 64,
  color = "#FFFFFF",
  backgroundColor = "#1F2937",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = spring({ frame, fps, config: { damping: 20 } });
  const scale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
    from: 0.95,
    to: 1,
  });

  const direction = textDirection(text);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: backgroundColor,
      }}
    >
      <div
        dir={direction}
        style={{
          direction,
          opacity,
          transform: `scale(${scale})`,
          fontSize,
          color,
          fontFamily: withArabicFallback("Inter, system-ui, sans-serif"),
          fontWeight: 700,
          textAlign: "center",
          maxWidth: "80%",
          lineHeight: direction === "rtl" ? 1.6 : 1.3,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
