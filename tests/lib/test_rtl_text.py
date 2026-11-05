"""Arabic (RTL) subtitles pick a font that has Arabic glyphs."""

from pathlib import Path

from lib.rtl_text import (
    ARABIC_FONT,
    BUNDLED_FONTS_DIR,
    font_for_subtitles,
    fontsdir_option,
    is_rtl_text,
    subtitle_file_is_rtl,
)
from tools.video.video_compose import VideoCompose

ARABIC_SRT = """1
00:00:00,000 --> 00:00:02,000
OpenMontage يحوّل فكرتك إلى فيديو

2
00:00:02,000 --> 00:00:04,000
بالتعليق الصوتي والترجمة
"""

ENGLISH_SRT = """1
00:00:00,000 --> 00:00:02,000
Turn your idea into a video
"""


def test_is_rtl_counts_words_not_first_letter():
    assert is_rtl_text("OpenMontage يحوّل فكرتك إلى فيديو")
    assert not is_rtl_text("Turn your idea into a video")
    assert not is_rtl_text("")


def test_subtitle_file_detection(tmp_path: Path):
    ar = tmp_path / "ar.srt"
    ar.write_text(ARABIC_SRT, encoding="utf-8")
    en = tmp_path / "en.srt"
    en.write_text(ENGLISH_SRT, encoding="utf-8")
    assert subtitle_file_is_rtl(ar)
    assert not subtitle_file_is_rtl(en)
    assert not subtitle_file_is_rtl(tmp_path / "missing.srt")


def test_ass_dialogue_text_is_read(tmp_path: Path):
    ass = tmp_path / "ar.ass"
    ass.write_text(
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
        "Dialogue: 0,0:00:00.00,0:00:02.00,Default,,0,0,0,,{\\b1}مرحبا بكم في الفيديو\n",
        encoding="utf-8",
    )
    assert subtitle_file_is_rtl(ass)


def test_latin_default_font_switches_to_arabic_font(tmp_path: Path):
    ar = tmp_path / "ar.srt"
    ar.write_text(ARABIC_SRT, encoding="utf-8")
    en = tmp_path / "en.srt"
    en.write_text(ENGLISH_SRT, encoding="utf-8")
    assert font_for_subtitles(ar, "Inter") == ARABIC_FONT
    assert font_for_subtitles(ar, None) == ARABIC_FONT
    # An explicit non-default font is respected.
    assert font_for_subtitles(ar, "Noto Kufi Arabic") == "Noto Kufi Arabic"
    assert font_for_subtitles(en, "Inter") == "Inter"


def test_bundled_font_files_exist():
    assert (BUNDLED_FONTS_DIR / "IBMPlexSansArabic-Regular.ttf").is_file()
    assert (BUNDLED_FONTS_DIR / "IBMPlexSansArabic-Bold.ttf").is_file()
    assert (BUNDLED_FONTS_DIR / "IBMPlexSansArabic-OFL.txt").is_file()
    assert fontsdir_option().startswith(":fontsdir='")


def test_compose_filter_uses_arabic_font_and_fontsdir_for_arabic(tmp_path: Path):
    ar = tmp_path / "ar.srt"
    ar.write_text(ARABIC_SRT, encoding="utf-8")
    vf = VideoCompose._subtitles_filter(ar, {"font": "Inter", "font_size": 30})
    assert f"FontName={ARABIC_FONT}" in vf
    assert ":fontsdir='" in vf
    en = tmp_path / "en.srt"
    en.write_text(ENGLISH_SRT, encoding="utf-8")
    assert "FontName=Inter" in VideoCompose._subtitles_filter(en, {})
