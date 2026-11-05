"""Right-to-left (Arabic) text helpers for subtitle rendering.

FFmpeg's ``subtitles`` filter (libass) shapes Arabic correctly through
HarfBuzz/FriBidi, but only when the chosen font actually has Arabic glyphs.
The default caption fonts (Inter, Arial, Segoe UI) do not on most Linux and
many macOS machines, so Arabic came out as boxes or as a random fallback font.

OpenMontage ships Noto Sans Arabic (SIL OFL 1.1, Latin + Arabic) in ``assets/fonts`` and
points libass at that folder with ``fontsdir``, so an Arabic subtitle renders
the same on every machine without installing anything.
"""

from __future__ import annotations

import re
from pathlib import Path

BUNDLED_FONTS_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"
# Picked after rendering "OpenMontage للاستشارات إلى يحوّل لا" through libass
# (FFmpeg 6.1): Cairo and Tajawal draw boxes for hamza-under-alef (إ) and
# shadda, IBM Plex Sans Arabic draws a box for every lam-alef (لا, لل).
# Noto Sans Arabic and Noto Kufi Arabic render all of it. Browsers (Remotion)
# shape all five correctly; this is a libass-only problem.
ARABIC_FONT = "Noto Sans Arabic"

# Arabic, Hebrew, Syriac, Thaana, N'Ko, Arabic Supplement/Extended and the
# Arabic presentation forms.
_RTL_CHAR = re.compile(r"[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]")
_LTR_CHAR = re.compile(r"[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]")

# Fonts an RTL subtitle is switched away from: OpenMontage's Latin-only caption
# defaults, which have no Arabic glyphs, and the Arabic fonts above that libass
# renders with missing glyphs.
_LATIN_ONLY_DEFAULTS = {"", "inter", "arial", "segoe ui", "space grotesk", "helvetica"}
_LIBASS_BROKEN_ARABIC = {"ibm plex sans arabic", "cairo", "tajawal"}

# SRT/VTT cue numbers, timing lines and ASS override tags are not text.
_TIMING_LINE = re.compile(r"-->")
_ASS_TAG = re.compile(r"\{[^}]*\}")


def is_rtl_text(text: str) -> bool:
    """True when most words of ``text`` are in a right-to-left script.

    Counts words, not characters, so an Arabic line that opens with a Latin
    brand name ("OpenMontage يحوّل الفيديو") still counts as RTL.
    """
    rtl = ltr = 0
    for word in text.split():
        if _RTL_CHAR.search(word):
            rtl += 1
        elif _LTR_CHAR.search(word):
            ltr += 1
    return rtl > ltr


def subtitle_file_is_rtl(path: str | Path) -> bool:
    """True when the text of an SRT/VTT/ASS file is mostly right-to-left."""
    try:
        raw = Path(path).read_text(encoding="utf-8-sig", errors="ignore")
    except OSError:
        return False
    lines = []
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.isdigit() or _TIMING_LINE.search(line) or line.upper() == "WEBVTT":
            continue
        if line.startswith("Dialogue:"):
            # ASS: the text is the 10th comma-separated field.
            parts = line.split(",", 9)
            line = parts[9] if len(parts) == 10 else ""
        elif line.startswith(("[", "Format:", "Style:", "ScriptType:", "PlayRes")):
            continue
        lines.append(_ASS_TAG.sub("", line))
    return is_rtl_text(" ".join(lines))


def font_for_subtitles(path: str | Path, font: str | None) -> str | None:
    """Return the font to burn ``path`` with.

    Keeps ``font`` unless the subtitles are RTL and ``font`` is a Latin-only
    default or an Arabic font libass draws with missing glyphs, in which case
    the bundled Arabic font is used.
    """
    key = (font or "").strip().lower()
    if key in _LATIN_ONLY_DEFAULTS | _LIBASS_BROKEN_ARABIC and subtitle_file_is_rtl(path):
        return ARABIC_FONT
    return font


def fontsdir_option() -> str:
    """``:fontsdir='...'`` for the FFmpeg subtitles filter, or "" if missing."""
    if not BUNDLED_FONTS_DIR.is_dir():
        return ""
    escaped = str(BUNDLED_FONTS_DIR).replace("\\", "/").replace(":", "\\:").replace("'", "")
    return f":fontsdir='{escaped}'"
