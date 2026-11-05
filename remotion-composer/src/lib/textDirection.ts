// Right-to-left detection shared by text components.
//
// Counts words, not characters, so an Arabic line that opens with a Latin
// brand name ("OpenMontage يحوّل الفيديو") still reads right to left.
const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const LTR_CHAR = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/;

export function textDirection(text: string): "ltr" | "rtl" {
  let rtl = 0;
  let ltr = 0;
  for (const word of text.split(/\s+/)) {
    if (RTL_CHAR.test(word)) rtl++;
    else if (LTR_CHAR.test(word)) ltr++;
  }
  return rtl > ltr ? "rtl" : "ltr";
}
