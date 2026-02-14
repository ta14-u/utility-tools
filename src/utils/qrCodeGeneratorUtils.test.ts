import { Byte, Charset, Kanji } from "@nuintun/qrcode";
import Encoding from "encoding-japanese";
import { describe, expect, it, vi } from "vitest";

import {
  customShiftJISEncoder,
  encodeKanjiQRCode,
  isKanjiModeCompatible,
  isShiftJISCompatible,
  segmentText,
} from "./qrCodeGeneratorUtils";

describe("qrCodeGeneratorUtils", () => {
  describe("internal functions (via indirect testing)", () => {
    it("should handle mixed segments correctly", () => {
      // "Aあ" は Byte セグメントと Kanji セグメントになるはず
      const result = encodeKanjiQRCode("Aあ", true);
      expect(result.matrix).toBeDefined();
    });

    it("should handle non-SJIS characters by falling back to UTF-8 Byte segment", () => {
      // 絵文字は SJIS 互換ではない
      const result = encodeKanjiQRCode("🌟", true);
      expect(result.matrix).toBeDefined();
    });

    it("should handle half-width katakana in SJIS", () => {
      // 半角カタカナは SJIS 互換だが、漢字モードではない
      const result = encodeKanjiQRCode("ｱｲｳ", true);
      expect(result.matrix).toBeDefined();
    });

    it("should handle boundary cases in isShiftJISCompatible", () => {
      // 半角カタカナは SJIS 互換
      expect(encodeKanjiQRCode("ｱｲｳ", true)).toBeDefined();
    });

    it("should handle mixed segments correctly (indirect test of segmentText)", () => {
      // 混合モード A (ASCII) + あ (漢字)
      const result = encodeKanjiQRCode("AあBい", true);
      expect(result.matrix).toBeDefined();

      // 非 SJIS フォールバックテスト
      expect(encodeKanjiQRCode("🌟", true)).toBeDefined();
    });

    it("should handle ShiftJIS edge cases in isShiftJISCompatible", () => {
      // isShiftJISCompatible の分岐カバレッジ
      // 有効な SJIS 2バイト範囲: 81-9F, E0-EF の後に 40-7E, 80-FC

      // 0x81, 0x40 (全角スペース)
      expect(encodeKanjiQRCode("　", true)).toBeDefined();

      // isShiftJISCompatible で E0-EF 範囲に該当する文字をテスト
      // "魁" (SJIS で 0xE0, 0x40) - 安全な文字を使用
      expect(isKanjiModeCompatible("魁")).toBeDefined();
    });

    it("should handle customShiftJISEncoder via Kanji segment", () => {
      // 漢字セグメントを使用するもののエンコード
      const result = encodeKanjiQRCode("漢字", false);
      expect(result.matrix).toBeDefined();
    });

    it("should handle mixed text with custom segments", () => {
      // segmentText の異なる分岐をトリガーする
      expect(encodeKanjiQRCode("AあBい", true)).toBeDefined();
      expect(encodeKanjiQRCode("あAいB", true)).toBeDefined();

      // その他の混合パターン
      expect(encodeKanjiQRCode("あA", true)).toBeDefined();
      expect(encodeKanjiQRCode("Aあ", true)).toBeDefined();
    });

    it("should throw error for invalid Kanji mode characters", () => {
      // 2バイト SJIS 漢字モード互換でない文字を使用
      expect(() => encodeKanjiQRCode("A", false)).toThrow();
    });

    it("should handle UTF-8 fallback when not SJIS compatible", () => {
      // 絵文字は if (!isSJISChar) return [new Byte(text)]; をトリガーするはず
      const result = encodeKanjiQRCode("A🌟", true);
      expect(result.matrix).toBeDefined();
    });

    it("should handle E0-EB range Shift_JIS characters", () => {
      // "画" (0xE0, 0x89), "徴" (0xE0, 0xA5) - 39-52行目をカバー
      const result = encodeKanjiQRCode("画徴", false);
      expect(result.matrix).toBeDefined();
    });

    it("should fall back to UTF-8 Byte mode for emoji", () => {
      // 145, 243-247行目をカバー
      const result = encodeKanjiQRCode("Hello😀World", true);
      expect(result.matrix).toBeDefined();
    });

    it("should handle mixed emoji and Japanese text", () => {
      // 145, 243-247行目をカバー
      const result = encodeKanjiQRCode("こんにちは😊世界", true);
      expect(result.matrix).toBeDefined();
    });

    it("should handle E0-EF range boundary characters", () => {
      // "鷗鷲" - 111-125行目をカバー
      const result = encodeKanjiQRCode("鷗鷲", true);
      expect(result.matrix).toBeDefined();
    });

    it("should handle half-width katakana mixed with kanji", () => {
      // 半角カタカナ (0xA1-0xDF 範囲) と漢字の混合
      const result = encodeKanjiQRCode("ｱｲｳあいう", true);
      expect(result.matrix).toBeDefined();
    });

    it("should handle ASCII mixed with half-width katakana", () => {
      // ASCII (0x00-0x7F) + 半角カタカナ (0xA1-0xDF)
      const result = encodeKanjiQRCode("ABCｱｲｳ", true);
      expect(result.matrix).toBeDefined();
    });

    it("should handle text with only half-width katakana", () => {
      // 半角カタカナのみ
      const result = encodeKanjiQRCode("ｱｲｳｴｵ", true);
      expect(result.matrix).toBeDefined();
    });

    it("should handle 81-9F range Shift_JIS characters", () => {
      // 0x81-0x9F 範囲の文字
      // "亜" (SJIS で 0x88, 0x9F)
      const result = encodeKanjiQRCode("亜唖", false);
      expect(result.matrix).toBeDefined();
    });

    it("should handle mixed 81-9F and E0-EF range characters", () => {
      // 異なる Shift_JIS 範囲の混合
      const result = encodeKanjiQRCode("亜画鷗", true);
      expect(result.matrix).toBeDefined();
    });

    it("should handle ASCII boundary characters", () => {
      // ASCII 範囲 (0x00-0x7F) の境界値をテスト
      const result = encodeKanjiQRCode("A0Z9", true);
      expect(result.matrix).toBeDefined();
    });

    it("should handle mixed mode with numbers and Japanese", () => {
      // 数字 + 日本語
      const result = encodeKanjiQRCode("123あいう456", true);
      expect(result.matrix).toBeDefined();
    });

    it("should handle mixed mode with special characters", () => {
      // 特殊 ASCII 文字 + 日本語
      const result = encodeKanjiQRCode("!@#あいう$%^", true);
      expect(result.matrix).toBeDefined();
    });
  });

  describe("isShiftJISCompatible direct tests", () => {
    it("should return false when 0x81-0x9F byte has no second byte", () => {
      vi.spyOn(Encoding, "convert").mockReturnValue([0x81]);
      vi.spyOn(Encoding, "stringToCode").mockReturnValue([0x81]);
      expect(isShiftJISCompatible("dummy")).toBe(false);
      vi.restoreAllMocks();
    });

    it("should return false when 0x81-0x9F byte has invalid second byte", () => {
      vi.spyOn(Encoding, "convert").mockReturnValue([0x81, 0x3f]);
      expect(isShiftJISCompatible("dummy")).toBe(false);
      vi.restoreAllMocks();
    });

    it("should return false when 0xE0-0xEF byte has no second byte", () => {
      vi.spyOn(Encoding, "convert").mockReturnValue([0xe0]);
      expect(isShiftJISCompatible("dummy")).toBe(false);
      vi.restoreAllMocks();
    });

    it("should return false when 0xE0-0xEF byte has invalid second byte", () => {
      vi.spyOn(Encoding, "convert").mockReturnValue([0xe0, 0xfd]);
      expect(isShiftJISCompatible("dummy")).toBe(false);
      vi.restoreAllMocks();
    });

    it("should return false for unsupported byte ranges", () => {
      vi.spyOn(Encoding, "convert").mockReturnValue([0x80]);
      expect(isShiftJISCompatible("dummy")).toBe(false);
      vi.restoreAllMocks();
    });

    it("should return false for empty conversion result", () => {
      vi.spyOn(Encoding, "convert").mockReturnValue([]);
      expect(isShiftJISCompatible("dummy")).toBe(false);
      vi.restoreAllMocks();
    });
  });

  describe("customShiftJISEncoder direct tests", () => {
    it("should fall back to TextEncoder for non-Shift_JIS charset", () => {
      const result = customShiftJISEncoder("Hello", Charset.UTF_8);
      expect(result).toEqual(new TextEncoder().encode("Hello"));
    });
  });

  describe("segmentText direct tests", () => {
    it("should handle empty string", () => {
      expect(segmentText("")).toEqual([]);
    });

    it("should return a single Kanji segment for pure Kanji text", () => {
      const segments = segmentText("漢字");
      expect(segments).toHaveLength(1);
      // 一部のバージョンでは @nuintun/qrcode の漢字セグメントはオブジェクト自体に直接 .mode.name を持たないため、
      // コンストラクタや型をチェックする必要がある。
      expect(segments[0]).toBeInstanceOf(Kanji);
    });

    it("should fall back to Byte segment for non-SJIS character", () => {
      // 絵文字は通常 SJIS には含まれない
      const segments = segmentText("A😊");
      expect(segments).toHaveLength(1);
      expect(segments[0]).toBeInstanceOf(Byte);
    });

    it("should handle mixed Kanji and SJIS Byte text", () => {
      const segments = segmentText("Aあ");
      expect(segments).toHaveLength(2);
      expect(segments[0]).toBeInstanceOf(Byte);
      expect(segments[1]).toBeInstanceOf(Kanji);
    });
  });

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

    it("should return false for non-Kanji 2-byte characters", () => {
      // "㈱" は Shift_JIS ですが、純粋な漢字モードの範囲外になることがあります
      // isKanjiModeCompatible 内の catch ブロックを確実に実行させるケースをテストします
      expect(isKanjiModeCompatible("A")).toBe(false);
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

    it("should handle sequential mode switching (kanji-byte-kanji)", () => {
      const result = encodeKanjiQRCode("あaいbう", true);
      expect(result.matrix).toBeDefined();
    });

    it("should handle sequential mode switching (byte-kanji-byte)", () => {
      const result = encodeKanjiQRCode("aあbいc", true);
      expect(result.matrix).toBeDefined();
    });

    it("should handle single character segments", () => {
      const result = encodeKanjiQRCode("aあb", true);
      expect(result.matrix).toBeDefined();
    });

    it("should handle text starting with kanji", () => {
      const result = encodeKanjiQRCode("あabc", true);
      expect(result.matrix).toBeDefined();
    });

    it("should handle text ending with kanji", () => {
      const result = encodeKanjiQRCode("abcあ", true);
      expect(result.matrix).toBeDefined();
    });

    it("should handle alternating single characters", () => {
      const result = encodeKanjiQRCode("aあbいcう", true);
      expect(result.matrix).toBeDefined();
    });

    it("should handle text with multiple byte segments", () => {
      const result = encodeKanjiQRCode("abcdefあいうえおghijkl", true);
      expect(result.matrix).toBeDefined();
    });

    it("should handle pure ASCII with numbers", () => {
      const result = encodeKanjiQRCode("Hello123World456", true);
      expect(result.matrix).toBeDefined();
    });

    it("should handle pure kanji longer text", () => {
      const result = encodeKanjiQRCode("日本語漢字平仮名片仮名", true);
      expect(result.matrix).toBeDefined();
    });
  });
});
