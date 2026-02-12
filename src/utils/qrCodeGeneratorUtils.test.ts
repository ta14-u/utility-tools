import { describe, expect, it } from "vitest";

import {
  encodeKanjiQRCode,
  isKanjiModeCompatible,
} from "./qrCodeGeneratorUtils";

describe("qrCodeGeneratorUtils", () => {
  describe("isKanjiModeCompatible", () => {
    it("returns true for Shift_JIS double-byte text", () => {
      expect(isKanjiModeCompatible("あああ")).toBe(true);
    });

    it("returns true for mixed hiragana and kanji", () => {
      expect(isKanjiModeCompatible("日本語")).toBe(true);
    });

    it("returns false for ASCII text", () => {
      expect(isKanjiModeCompatible("ABC123")).toBe(false);
    });

    it("returns false for mixed Japanese and ASCII", () => {
      expect(isKanjiModeCompatible("あいA1")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isKanjiModeCompatible("")).toBe(false);
    });
  });

  describe("encodeKanjiQRCode", () => {
    it("encodes Shift_JIS double-byte text in pure Kanji mode", () => {
      const result = encodeKanjiQRCode("あああ", false);

      expect(result).toHaveProperty("matrix");
      expect(result).toHaveProperty("size");
      expect(result.matrix.length).toBeGreaterThan(0);
      expect(result.size).toBeGreaterThan(0);
    });

    it("encodes Shift_JIS double-byte text with multiple characters", () => {
      const result = encodeKanjiQRCode("あああああ", false);

      expect(result).toHaveProperty("matrix");
      expect(result.matrix.length).toBeGreaterThan(0);
    });

    it("throws error for ASCII text in pure Kanji mode", () => {
      expect(() => encodeKanjiQRCode("ABC123", false)).toThrow(
        "Text contains characters incompatible with Kanji mode",
      );
    });

    it("throws error for mixed Japanese and ASCII in pure Kanji mode", () => {
      expect(() => encodeKanjiQRCode("あいA1", false)).toThrow(
        "Text contains characters incompatible with Kanji mode",
      );
    });

    it("encodes mixed text in mixed mode", () => {
      const result = encodeKanjiQRCode("aaaaa,\nあああああ", true);

      expect(result).toHaveProperty("matrix");
      expect(result).toHaveProperty("size");
      expect(result.matrix.length).toBeGreaterThan(0);
      expect(result.size).toBeGreaterThan(0);
    });

    it("encodes pure ASCII in mixed mode", () => {
      const result = encodeKanjiQRCode("Hello World", true);

      expect(result).toHaveProperty("matrix");
      expect(result.matrix.length).toBeGreaterThan(0);
    });

    it("encodes pure Japanese in mixed mode", () => {
      const result = encodeKanjiQRCode("こんにちは世界", true);

      expect(result).toHaveProperty("matrix");
      expect(result.matrix.length).toBeGreaterThan(0);
    });
  });
});
