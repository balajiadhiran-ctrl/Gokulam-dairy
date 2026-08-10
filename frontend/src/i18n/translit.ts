// Lightweight phonetic transliteration of romanized (English) names into
// Devanagari (Hindi) and Tamil. This is an *approximate* starting point meant
// to be edited by a human — the schwa/retroflex/long-vowel ambiguities of Latin
// spelling can't be resolved perfectly without a dictionary.

// Spoken letter names, for single-letter initials like "R." → "आर."
const LETTER_HI: Record<string, string> = {
  a: "ए", b: "बी", c: "सी", d: "डी", e: "ई", f: "एफ", g: "जी", h: "एच",
  i: "आई", j: "जे", k: "के", l: "एल", m: "एम", n: "एन", o: "ओ", p: "पी",
  q: "क्यू", r: "आर", s: "एस", t: "टी", u: "यू", v: "वी", w: "डब्ल्यू",
  x: "एक्स", y: "वाई", z: "ज़ेड",
};
const LETTER_TA: Record<string, string> = {
  a: "ஏ", b: "பி", c: "சி", d: "டி", e: "ஈ", f: "எஃப்", g: "ஜி", h: "எச்",
  i: "ஐ", j: "ஜே", k: "கே", l: "எல்", m: "எம்", n: "என்", o: "ஓ", p: "பி",
  q: "க்யூ", r: "ஆர்", s: "எஸ்", t: "டி", u: "யூ", v: "வி", w: "டபிள்யூ",
  x: "எக்ஸ்", y: "வை", z: "செட்",
};

// Vowels: independent form + dependent sign (matra). "" matra = inherent 'a'.
const HI_VOWEL: Record<string, [string, string]> = {
  aa: ["आ", "ा"], ai: ["ऐ", "ै"], au: ["औ", "ौ"], ee: ["ई", "ी"], ii: ["ई", "ी"],
  oo: ["ऊ", "ू"], uu: ["ऊ", "ू"], a: ["अ", ""], e: ["ए", "े"], i: ["इ", "ि"],
  o: ["ओ", "ो"], u: ["उ", "ु"],
};
const TA_VOWEL: Record<string, [string, string]> = {
  aa: ["ஆ", "ா"], ai: ["ஐ", "ை"], au: ["ஔ", "ௌ"], ee: ["ஈ", "ீ"], ii: ["ஈ", "ீ"],
  oo: ["ஊ", "ூ"], uu: ["ஊ", "ூ"], a: ["அ", ""], e: ["ஏ", "ே"], i: ["இ", "ி"],
  o: ["ஓ", "ோ"], u: ["உ", "ு"],
};

const HI_CONS: Record<string, string> = {
  chh: "छ", ksh: "क्ष", sh: "श", ch: "च", kh: "ख", gh: "घ", th: "थ", dh: "ध",
  ph: "फ", bh: "भ", ng: "ंग", ny: "ञ", gy: "ज्ञ",
  k: "क", g: "ग", c: "च", j: "ज", t: "त", d: "द", n: "न", p: "प", f: "फ",
  b: "ब", m: "म", y: "य", r: "र", l: "ल", v: "व", w: "व", s: "स", h: "ह",
};
const TA_CONS: Record<string, string> = {
  chh: "ச", ksh: "க்ஷ", sh: "ஷ", ch: "ச", kh: "க", gh: "க", th: "த", dh: "த",
  ph: "ப", bh: "ப", ng: "ங", ny: "ஞ", gy: "ஞ",
  k: "க", g: "க", c: "ச", j: "ஜ", t: "த", d: "த", n: "ன", p: "ப", f: "ஃப",
  b: "ப", m: "ம", y: "ய", r: "ர", l: "ல", v: "வ", w: "வ", s: "ஸ", h: "ஹ",
};

// Longest keys first so digraphs win over single letters.
const VOWEL_KEYS = ["aa", "ai", "au", "ee", "ii", "oo", "uu", "a", "e", "i", "o", "u"];
const CONS_KEYS = ["chh", "ksh", "sh", "ch", "kh", "gh", "th", "dh", "ph", "bh", "ng", "ny", "gy",
  "k", "g", "c", "j", "t", "d", "n", "p", "f", "b", "m", "y", "r", "l", "v", "w", "s", "h"];

type Tok = { type: "V" | "C"; key: string };

function tokenize(word: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < word.length) {
    let matched = false;
    for (const k of CONS_KEYS) {
      if (word.startsWith(k, i)) {
        toks.push({ type: "C", key: k });
        i += k.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    for (const k of VOWEL_KEYS) {
      if (word.startsWith(k, i)) {
        toks.push({ type: "V", key: k });
        i += k.length;
        matched = true;
        break;
      }
    }
    if (!matched) i += 1; // skip unknown char
  }
  return toks;
}

function buildWord(
  word: string,
  cons: Record<string, string>,
  vowel: Record<string, [string, string]>,
  virama: string,
  finalVirama: boolean, // Tamil marks final pure consonants; Hindi drops the schwa
  nasalAnusvara: string | null, // Hindi: 'n'/'m' before a consonant → anusvara
): string {
  const toks = tokenize(word);
  let out = "";
  let prevC = false;
  for (let idx = 0; idx < toks.length; idx++) {
    const tk = toks[idx];
    if (tk.type === "V") {
      const [indep, matra] = vowel[tk.key] ?? ["", ""];
      out += prevC ? matra : indep;
      prevC = false;
    } else {
      const next = toks[idx + 1];
      if (nasalAnusvara && (tk.key === "n" || tk.key === "m") && next && next.type === "C") {
        out += nasalAnusvara;
        prevC = false;
        continue;
      }
      if (prevC) out += virama;
      out += cons[tk.key] ?? "";
      prevC = true;
    }
  }
  if (prevC && finalVirama) out += virama; // Tamil pulli on trailing consonant
  return out;
}

function transliterate(
  name: string,
  letters: Record<string, string>,
  cons: Record<string, string>,
  vowel: Record<string, [string, string]>,
  virama: string,
  finalVirama: boolean,
  nasalAnusvara: string | null,
): string {
  if (!name.trim()) return "";
  return name
    .split(/(\s+)/) // keep whitespace chunks
    .map((chunk) => {
      if (/^\s+$/.test(chunk)) return chunk;
      const hasDot = chunk.endsWith(".");
      const core = chunk.replace(/\./g, "").toLowerCase();
      if (core.length === 0) return chunk;
      // Single-letter initial → spoken letter name (e.g. "R." → "आर.").
      if (core.length === 1 && letters[core]) {
        return letters[core] + (hasDot ? "." : "");
      }
      return buildWord(core, cons, vowel, virama, finalVirama, nasalAnusvara) + (hasDot ? "." : "");
    })
    .join("");
}

export function toDevanagari(name: string): string {
  return transliterate(name, LETTER_HI, HI_CONS, HI_VOWEL, "्", false, "ं");
}

export function toTamil(name: string): string {
  return transliterate(name, LETTER_TA, TA_CONS, TA_VOWEL, "்", true, null);
}
