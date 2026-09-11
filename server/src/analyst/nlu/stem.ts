/*
 * Tiny Russian normaliser: lower-case, ё→е, split into tokens, strip the
 * most common inflectional endings. It is not a linguist's stemmer — it only
 * has to make "выручка / выручку / выручкой" collapse to one stem, and the
 * lexicon is written in the same stems, so both sides agree.
 */

const ENDINGS = [
  "иями", "ями", "ами", "иях", "ией", "ием", "ого", "его", "ому", "ему", "ыми", "ими",
  "ешь", "ишь", "ете", "ите", "ует", "уют", "ают", "яют", "ала", "ила", "или", "ыли",
  "ать", "ять", "еть", "ить", "оть", "уть",
  "ла", "ло", "ли", "ть", "ой", "ей", "ый", "ий", "ая", "яя", "ое", "ее", "ые", "ие",
  "ых", "их", "ым", "им", "ом", "ем", "ов", "ев", "ам", "ям", "ах", "ях", "ую", "юю",
  "ию", "ия", "ии", "ет", "ит", "ут", "ют", "ат", "ят", "ал", "ил", "ел",
  "а", "я", "ы", "и", "о", "е", "у", "ю", "ь", "й",
].sort((a, b) => b.length - a.length);

const MIN_STEM = 3;

export function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, "е").replace(/[–—]/g, "-");
}

/** Words and numbers; dotted dates like 10.09.2026 survive as one token. */
export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-zа-я0-9.]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter((t) => t.length > 0);
}

export function stem(word: string): string {
  let w = word;
  if (!/[а-я]/.test(w)) return w; // Latin / numbers: as is
  if (w.length > MIN_STEM + 2 && (w.endsWith("ся") || w.endsWith("сь"))) w = w.slice(0, -2);
  for (const e of ENDINGS) {
    if (w.endsWith(e) && w.length - e.length >= MIN_STEM) return w.slice(0, -e.length);
  }
  return w;
}

/** Equal stems, or one is a ≥4-char prefix of the other ("загруз" ~ "загрузк"). */
export function stemsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const short = a.length < b.length ? a : b;
  const long = short === a ? b : a;
  return short.length >= 4 && long.startsWith(short);
}

export function stemPhrase(phrase: string): string[] {
  return tokenize(phrase).map(stem);
}

/** Index where `phrase` (as stems) occurs consecutively in `stems`, or -1. */
export function findPhrase(stems: string[], phrase: string[]): number {
  if (!phrase.length || phrase.length > stems.length) return -1;
  outer: for (let i = 0; i + phrase.length <= stems.length; i++) {
    for (let j = 0; j < phrase.length; j++) {
      if (!stemsMatch(stems[i + j], phrase[j])) continue outer;
    }
    return i;
  }
  return -1;
}
