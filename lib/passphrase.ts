// Password / passphrase generation, mirroring the legacy generator exactly.

export const WORDLIST: readonly string[] = [
  "apple","beach","cloud","dance","eagle","flame","grape","honey","igloo","jungle",
  "kite","lemon","maple","night","ocean","pizza","queen","river","storm","tiger",
  "ultra","vivid","water","xenon","yacht","zebra","amber","brave","crisp","delta",
  "ember","frost","gleam","hyper","ivory","joker","karma","lunar","magic","noble",
  "orbit","pearl","quill","radar","solar","tidal","umbra","vapor","woven","xylem",
  "yield","zonal","atlas","blaze","cedar","drift","elbow","fable","glide","haven",
  "inert","jewel","kneel","lance","metro","nerve","onset","prism","quest","relay",
  "spine","trove","unity","verse","whirl","expel","zesty","acorn","bloom","comet",
  "dunes","epoch","flint","glyph","haste","inlet","jarls","knack","lumen","manor",
  "nexus","optic","pixel","quota","relic","sweep","thorn","untie","visor","waltz",
  "xerox","yearn","zephyr","abode","brine","crest","dwelt","exile","forge","grove",
  "heron","irony","joust","knave","lyric","marsh","nymph","outdo","plume","quirk",
  "resin","swift","tryst","usher","vigor","wrath","expat","zippy","acrid","blunt",
  "cabin","depot","epoch","fleck","guild","hyena","irked","joist","knelt","latch",
  "medal","nudge","oaken","plank","qualm","rusty","scone","tabby","ulcer","venom",
  "wader","extol","zonal","angel","bride","crimp","donut","ether","funky","gavel",
  "hinds","index","joust","knobs","lilac","mirth","noble","oxide","pilot","query",
  "renew","scald","taboo","upset","vault","weary","expel","zippo","alibi","boxer",
  "chasm","disco","ember","fjord","guava","hippo","ingot","jelly","kudos","lingo",
];

export interface GenOptions {
  mode: "password" | "passphrase";
  length: number;
  words: number;
  separator: string;
  upper: boolean;
  lower: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
  capitalize: boolean;
  includeNumber: boolean;
}

export const DEFAULT_GEN: GenOptions = {
  mode: "password",
  length: 16,
  words: 4,
  separator: "-",
  upper: true,
  lower: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: true,
  capitalize: true,
  includeNumber: true,
};

const AMBIGUOUS = "0O1lI";

export function generateRandomPassword(opts: GenOptions): string {
  let chars = "";
  if (opts.upper) chars += opts.excludeAmbiguous ? "ABCDEFGHJKLMNPQRSTUVWXYZ" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (opts.lower) chars += opts.excludeAmbiguous ? "abcdefghjkmnpqrstuvwxyz" : "abcdefghijklmnopqrstuvwxyz";
  if (opts.numbers) chars += opts.excludeAmbiguous ? "23456789" : "0123456789";
  if (opts.symbols) chars += "!@#$%^&*-_+=?";
  if (!chars) chars = "abcdefghijklmnopqrstuvwxyz";

  let pw = "";
  const arr = crypto.getRandomValues(new Uint8Array(opts.length * 2));
  for (const b of arr) {
    if (pw.length >= opts.length) break;
    const c = chars[b % chars.length];
    if (!opts.excludeAmbiguous || !AMBIGUOUS.includes(c)) pw += c;
  }
  while (pw.length < opts.length) {
    const extra = crypto.getRandomValues(new Uint8Array(4));
    pw += chars[extra[0] % chars.length];
  }
  return pw;
}

export function generatePassphrase(opts: GenOptions): string {
  const arr = crypto.getRandomValues(new Uint8Array(opts.words * 2));
  const words: string[] = [];
  for (let i = 0; i < opts.words; i++) {
    let word = WORDLIST[arr[i] % WORDLIST.length];
    if (opts.capitalize) word = word.charAt(0).toUpperCase() + word.slice(1);
    words.push(word);
  }
  let phrase = words.join(opts.separator);
  if (opts.includeNumber) {
    const num = crypto.getRandomValues(new Uint8Array(1))[0] % 90 + 10;
    phrase += opts.separator + num;
  }
  return phrase;
}

export function generateOne(opts: GenOptions): string {
  if (opts.mode === "passphrase") return generatePassphrase(opts);
  return generateRandomPassword(opts);
}