"""Arabic narration picks a native Arabic voice when no voice is given."""

import xml.etree.ElementTree as ET

import pytest

from tools.audio.arabic_voice import is_arabic_text, locale_from_voice, normalize_dialect
from tools.audio.azure_tts import AzureTTS
from tools.audio.google_tts import GoogleTTS
from tools.audio.piper_tts import PiperTTS
from tools.audio.tts_selector import TTSSelector

ARABIC = "OpenMontage يحوّل فكرتك إلى فيديو كامل"
ENGLISH = "Turn your idea into a finished video"


def _lang(ssml: str) -> str:
    return ET.fromstring(ssml).attrib["{http://www.w3.org/XML/1998/namespace}lang"]


def test_arabic_detection_counts_words():
    assert is_arabic_text(ARABIC)
    assert not is_arabic_text(ENGLISH)
    assert not is_arabic_text("")


def test_dialect_aliases_and_errors():
    assert normalize_dialect(None) == "msa"
    assert normalize_dialect("EG") == "egyptian"
    assert normalize_dialect("ksa") == "saudi"
    with pytest.raises(ValueError):
        normalize_dialect("klingon")


def test_locale_from_voice():
    assert locale_from_voice("ar-EG-ShakirNeural") == "ar-EG"
    assert locale_from_voice("andrew") == "en-US"


class TestAzure:
    def test_arabic_text_gets_arabic_voice_and_locale(self):
        tool = AzureTTS()
        voice = tool._resolve_voice({"text": ARABIC})
        assert voice == "ar-SA-HamedNeural"
        assert _lang(tool._build_ssml({"text": ARABIC}, voice)) == "ar-SA"

    def test_egyptian_dialect(self):
        tool = AzureTTS()
        voice = tool._resolve_voice({"text": ARABIC, "arabic_dialect": "egyptian"})
        assert voice == "ar-EG-ShakirNeural"
        assert _lang(tool._build_ssml({"text": ARABIC}, voice)) == "ar-EG"

    def test_arabic_aliases(self):
        tool = AzureTTS()
        assert tool._resolve_voice({"text": ARABIC, "voice": "salma"}) == "ar-EG-SalmaNeural"
        assert tool._resolve_voice({"text": ARABIC, "voice": "Zariyah"}) == "ar-SA-ZariyahNeural"

    def test_english_unchanged(self):
        tool = AzureTTS()
        voice = tool._resolve_voice({"text": ENGLISH})
        assert voice == AzureTTS.DEFAULT_VOICE
        assert _lang(tool._build_ssml({"text": ENGLISH}, voice)) == "en-US"

    def test_explicit_voice_and_locale_win(self):
        tool = AzureTTS()
        assert tool._resolve_voice({"text": ARABIC, "voice": "andrew"}) == "en-US-AndrewMultilingualNeural"
        assert _lang(tool._build_ssml({"text": ARABIC, "locale": "ar-AE"}, "ar-SA-HamedNeural")) == "ar-AE"

    def test_dialect_is_part_of_cache_key(self):
        assert "arabic_dialect" in AzureTTS.idempotency_key_fields


class TestGoogle:
    def test_arabic_text_gets_arabic_voice(self):
        voice = GoogleTTS._voice_name({"text": ARABIC})
        assert voice == "ar-XA-Chirp3-HD-Orus"
        assert GoogleTTS._locale_from_voice(voice) == "ar-XA"

    def test_english_and_explicit_unchanged(self):
        assert GoogleTTS._voice_name({"text": ENGLISH}) == "en-US-Chirp3-HD-Orus"
        assert GoogleTTS._voice_name({"text": ARABIC, "voice": "en-US-Studio-O"}) == "en-US-Studio-O"


class TestPiper:
    def test_arabic_text_gets_arabic_model(self):
        assert PiperTTS._model({"text": ARABIC}) == "ar_JO-kareem-medium"
        assert PiperTTS._model({"text": ENGLISH}) == "en_US-lessac-medium"
        assert PiperTTS._model({"text": ARABIC, "model": "x"}) == "x"


def test_selector_exposes_dialect_and_passes_it_to_azure():
    assert "arabic_dialect" in TTSSelector.input_schema["properties"]
    adapted = TTSSelector._adapt_inputs(AzureTTS(), {"text": ARABIC, "arabic_dialect": "egyptian"})
    assert adapted["arabic_dialect"] == "egyptian"
