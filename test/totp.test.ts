import { describe, it, expect } from "vitest";
import { isValidBase32, base32Decode, generateTOTP } from "../lib/totp";

describe("base32", () => {
  it("decodes ASCII secret per RFC 4648", () => {
    const bytes = base32Decode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(new TextDecoder().decode(bytes)).toBe("12345678901234567890");
  });

  it("tolerates no-padding and lowercase", () => {
    expect(
      new TextDecoder().decode(base32Decode("gezdgnbvgy3tqojqgezdgnbvgy3tqojq")),
    ).toBe("12345678901234567890");
    expect(() => base32Decode("0!!!")).toThrow();
  });

  it("validates shape", () => {
    expect(isValidBase32("JBSWY3DPEHPK3PXP")).toBe(true);
    expect(isValidBase32("")).toBe(false);
    expect(isValidBase32("ABC{")).toBe(false);
  });
});

describe("generateTOTP", () => {
  // RFC 6238 SHA-1 6-digit vectors (secret = ASCII "12345678901234567890").
  it("matches known vectors", async () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(await generateTOTP(secret, 59)).toBe("287082");
    expect(await generateTOTP(secret, 1111111109)).toBe("081804");
    expect(await generateTOTP(secret, 1111111111)).toBe("050471");
    expect(await generateTOTP(secret, 2000000000)).toBe("279037");
    expect(await generateTOTP(secret, 20000000000)).toBe("353130");
  });
});