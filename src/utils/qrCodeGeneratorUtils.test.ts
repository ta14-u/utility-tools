import { describe, expect, it } from "vitest";

import {
  encodeKanjiQRCode,
  isKanjiModeCompatible,
} from "./qrCodeGeneratorUtils";

describe("qrCodeGeneratorUtils", () => {
  describe("isKanjiModeCompatible", () => {
    it("should return true for 2-byte Shift_JIS characters", () => {
      expect(isKanjiModeCompatible("あああ")).toBe(true);
    });

    it("should return true for mixed hiragana and kanji", () => {
      expect(isKanjiModeCompatible("日本語")).toBe(true);
    });

    it("should return false for ASCII characters", () => {
      expect(isKanjiModeCompatible("ABC123")).toBe(false);
    });

    it("should return false for mixed Japanese and ASCII", () => {
      expect(isKanjiModeCompatible("あいA1")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isKanjiModeCompatible("")).toBe(false);
    });
  });

  describe("encodeKanjiQRCode", () => {
    it("should encode 2-byte Shift_JIS in pure Kanji mode", () => {
      const result = encodeKanjiQRCode("あああ", false);

      expect(result).toHaveProperty("matrix");
      expect(result).toHaveProperty("size");
      expect(result.matrix.length).toBeGreaterThan(0);
      expect(result.size).toBeGreaterThan(0);
    });

    it("should encode 2-byte Shift_JIS with multiple characters", () => {
      const result = encodeKanjiQRCode("あああああ", false);

      expect(result).toHaveProperty("matrix");
      expect(result.matrix.length).toBeGreaterThan(0);
    });

    it("should throw error for ASCII characters in pure Kanji mode", () => {
      expect(() => encodeKanjiQRCode("ABC123", false)).toThrow(
        "Text contains characters incompatible with Kanji mode",
      );
    });

    it("should throw error for mixed Japanese and ASCII in pure Kanji mode", () => {
      expect(() => encodeKanjiQRCode("あいA1", false)).toThrow(
        "Text contains characters incompatible with Kanji mode",
      );
    });

    it("should encode mixed text in mixed mode", () => {
      const result = encodeKanjiQRCode("aaaaa,\nあああああ", true);

      expect(result).toHaveProperty("matrix");
      expect(result).toHaveProperty("size");
      expect(result.matrix.length).toBeGreaterThan(0);
      expect(result.size).toBeGreaterThan(0);
    });

    it("should encode pure ASCII in mixed mode", () => {
      const result = encodeKanjiQRCode("Hello World", true);

      expect(result).toHaveProperty("matrix");
      expect(result.matrix.length).toBeGreaterThan(0);
    });

    it("should encode pure Japanese in mixed mode", () => {
      const result = encodeKanjiQRCode("こんにちは世界", true);

      expect(result).toHaveProperty("matrix");
      expect(result.matrix.length).toBeGreaterThan(0);
    });
  });
});
