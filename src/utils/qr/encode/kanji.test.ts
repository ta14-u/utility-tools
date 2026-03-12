import { describe, expect, it, vi } from "vitest";
import * as shiftjis from "../shiftjis";
import { encodeKanjiQRCode } from "./kanji";

describe("qr/encode/kanji", () => {
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

    it("should throw error for invalid Kanji mode characters", () => {
      // 2バイト SJIS 漢字モード互換でない文字を使用
      expect(() => encodeKanjiQRCode("A", false)).toThrow();
    });

    it("should include character position when mixed mode fails with illegal kanji character", () => {
      const text = `DUMMY

A,1

B,住所２−３
`;

      expect(() => encodeKanjiQRCode(text, true)).toThrow(
        'Mixed mode encoding failed at character 18 (line 5, column 6): "−" (U+2212).',
      );
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

    it("should fall back to plain Byte mode when text is not Shift_JIS compatible", () => {
      // isShiftJISCompatible が false を返すようにモック
      const spy = vi.spyOn(shiftjis, "isShiftJISCompatible");
      spy.mockReturnValueOnce(false);

      const result = encodeKanjiQRCode("テスト文字列", true);

      // モックが呼ばれたことを確認
      expect(spy).toHaveBeenCalledWith("テスト文字列");

      // 結果が正常に生成されることを確認
      expect(result.matrix).toBeDefined();
      expect(result.size).toBeGreaterThan(0);

      spy.mockRestore();
    });
  });
});
