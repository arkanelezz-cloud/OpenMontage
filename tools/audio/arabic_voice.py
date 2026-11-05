"""Arabic narration defaults shared by the TTS provider tools.

Every provider used to fall back to an English voice when no voice was
given, so Arabic narration was read by an English speaker (Google, Piper)
or with an en-US locale (Azure). These helpers let each provider notice
Arabic text and pick a native Arabic voice instead, with an optional
dialect for providers that offer one.
"""

from __future__ import annotations

import re

# Arabic letters, Arabic Supplement/Extended and the presentation forms.
_ARABIC_CHAR = re.compile(r"[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]")
_LATIN_CHAR = re.compile(r"[A-Za-zÀ-ɏ]")

DIALECTS = ("msa", "saudi", "egyptian")

# Azure neural voices: (voice short name, locale). Male narrators by default;
# the female voices are available through the aliases below.
AZURE_DIALECT_VOICES = {
    "msa": ("ar-SA-HamedNeural", "ar-SA"),
    "saudi": ("ar-SA-HamedNeural", "ar-SA"),
    "egyptian": ("ar-EG-ShakirNeural", "ar-EG"),
}
AZURE_ARABIC_ALIASES = {
    "hamed": "ar-SA-HamedNeural",      # Saudi, male
    "zariyah": "ar-SA-ZariyahNeural",  # Saudi, female
    "shakir": "ar-EG-ShakirNeural",    # Egyptian, male
    "salma": "ar-EG-SalmaNeural",      # Egyptian, female
}

# Google offers one Arabic locale (ar-XA, Modern Standard Arabic).
GOOGLE_ARABIC_VOICE = "ar-XA-Chirp3-HD-Orus"

# The only Arabic Piper voice in the official voice list.
PIPER_ARABIC_MODEL = "ar_JO-kareem-medium"


def is_arabic_text(text: str) -> bool:
    """True when most words of ``text`` are Arabic.

    Counts words rather than characters, so a sentence that opens with a Latin
    brand name ("OpenMontage يحوّل الفيديو") still counts as Arabic.
    """
    arabic = latin = 0
    for word in (text or "").split():
        if _ARABIC_CHAR.search(word):
            arabic += 1
        elif _LATIN_CHAR.search(word):
            latin += 1
    return arabic > latin


def normalize_dialect(dialect: str | None) -> str:
    """Return a known dialect key, defaulting to Modern Standard Arabic."""
    key = (dialect or "").strip().lower()
    aliases = {"sa": "saudi", "ksa": "saudi", "gulf": "saudi", "eg": "egyptian", "masri": "egyptian",
               "fusha": "msa", "standard": "msa"}
    key = aliases.get(key, key)
    if key and key not in DIALECTS:
        raise ValueError(f"Unknown Arabic dialect {dialect!r}; use one of {', '.join(DIALECTS)}")
    return key or "msa"


def locale_from_voice(voice_name: str, fallback: str = "en-US") -> str:
    """Derive the BCP-47 locale from a voice name like ar-EG-ShakirNeural."""
    match = re.match(r"^([a-z]{2,3}-[A-Z]{2})-", voice_name or "")
    return match.group(1) if match else fallback
