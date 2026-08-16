import { describe, expect, it } from "vitest";
import {
  DEFAULT_GEN,
  generateOne,
  generatePassphrase,
  generateRandomPassword,
  WORDLIST,
} from "../lib/passphrase";

describe("generator", () => {
  it("exposes a 190-word wordlist", () => {
    expect(WORDLIST.length).toBe(190);
    expect(WORDLIST).toContain("apple");
    expect(WORDLIST).toContain("zebra");
  });

  it("generates password of requested length", () => {
    const pw = generateRandomPassword({ ...DEFAULT_GEN, length: 24 });
    expect(pw.length).toBe(24);
    expect(pw).toMatch(/[A-Z]/);
    expect(pw).toMatch(/[a-z]/);
    expect(pw).toMatch(/[0-9]/);
  });

  it("excludes ambiguous chars when enabled", () => {
    const set = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const pw = generateRandomPassword({
        ...DEFAULT_GEN,
        excludeAmbiguous: true,
        length: 64,
      });
      for (const c of pw) set.add(c);
    }
    for (const c of "0O1lI") expect(set.has(c)).toBe(false);
  });

  it("respects allowed character classes", () => {
    const pw = generateRandomPassword({
      ...DEFAULT_GEN,
      upper: true,
      lower: true,
      numbers: false,
      symbols: false,
      excludeAmbiguous: false,
      length: 8,
    });
    expect(pw).toMatch(/^[A-Za-z]+$/);
  });

  it("generates a passphrase with separators and optional number", () => {
    const phrase = generatePassphrase({
      ...DEFAULT_GEN,
      words: 4,
      separator: "-",
      capitalize: false,
      includeNumber: true,
    });
    const parts = phrase.split("-");
    expect(parts.length).toBe(5);
    expect(parts[4]).toMatch(/^\d{2}$/);
    for (const w of parts.slice(0, 4)) expect(WORDLIST).toContain(w);
  });

  it("capitalizes passphrase words when enabled", () => {
    const phrase = generatePassphrase({
      ...DEFAULT_GEN,
      words: 3,
      separator: " ",
      capitalize: true,
      includeNumber: false,
    });
    for (const w of phrase.split(" ")) {
      expect(w.charAt(0)).toMatch(/[A-Z]/);
    }
  });

  it("generateOne dispatches on mode", () => {
    const pw = generateOne({ ...DEFAULT_GEN, mode: "password" });
    const phrase = generateOne({
      ...DEFAULT_GEN,
      mode: "passphrase",
      words: 3,
      includeNumber: false,
    });
    expect(pw.length).toBe(DEFAULT_GEN.length);
    expect(phrase.split("-").length).toBe(3);
  });
});