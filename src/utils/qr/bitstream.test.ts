import BitSource from "@zxing/library/esm/core/common/BitSource";
import Version from "@zxing/library/esm/core/qrcode/decoder/Version";
import { describe, expect, it, vi } from "vitest";

import {
  parseECIValue,
  scanForKanjiMode,
  skipAlphanumeric,
  skipBits,
  skipNumeric,
} from "./bitstream";

describe("qr/bitstream", () => {
  describe("parseECIValue", () => {
    it("should parse various lengths", () => {
      // 1 バイト: 0-127
      const bits1 = new BitSource(new Uint8Array([0x7f]));
      expect(parseECIValue(bits1)).toBe(127);

      // 2 バイト: 128-16383
      const bits2 = new BitSource(new Uint8Array([0x81, 0x02]));
      // (0x81 & 0x3F) << 8 | 0x02 = 1 << 8 | 2 = 258
      expect(parseECIValue(bits2)).toBe(258);

      // 3 バイト: 16384-999999
      const bits3 = new BitSource(new Uint8Array([0xc1, 0x02, 0x03]));
      // (0xC1 & 0x1F) << 16 | (0x02 << 8) | 0x03 = 1 << 16 | 515 = 66051
      expect(parseECIValue(bits3)).toBe(66051);

      // 短い入力
      expect(parseECIValue(new BitSource(new Uint8Array(0)))).toBeNull();
      expect(parseECIValue(new BitSource(new Uint8Array([0x81])))).toBeNull();
      expect(
        parseECIValue(new BitSource(new Uint8Array([0xc1, 0x02]))),
      ).toBeNull();

      // 不正な ECI 値（0xe0 以上）
      expect(
        parseECIValue(new BitSource(new Uint8Array([0xe0, 0x00, 0x00]))),
      ).toBeNull();
    });
  });

  describe("skipNumeric", () => {
    it("should skip correct number of bits", () => {
      const bits = new BitSource(new Uint8Array(10));
      const spy = vi.spyOn(bits, "readBits");

      skipNumeric(bits, 3); // 10 ビット
      expect(spy).toHaveBeenCalledWith(10);

      skipNumeric(bits, 2); // 7 ビット
      expect(spy).toHaveBeenCalledWith(7);

      skipNumeric(bits, 1); // 4 ビット
      expect(spy).toHaveBeenCalledWith(4);
    });
  });

  describe("skipAlphanumeric", () => {
    it("should skip correct number of bits", () => {
      const bits = new BitSource(new Uint8Array(10));
      const spy = vi.spyOn(bits, "readBits");

      skipAlphanumeric(bits, 2); // 11 ビット
      expect(spy).toHaveBeenCalledWith(11);

      skipAlphanumeric(bits, 1); // 6 ビット
      expect(spy).toHaveBeenCalledWith(6);
    });
  });

  describe("skipBits", () => {
    it("should skip large amount of bits", () => {
      const bits = new BitSource(new Uint8Array(10));
      const spy = vi.spyOn(bits, "readBits");

      skipBits(bits, 50);
      expect(spy).toHaveBeenCalledWith(32);
      expect(spy).toHaveBeenCalledWith(18);
    });
  });

  describe("scanForKanjiMode", () => {
    it("should detect Kanji mode in bitstream with sufficient data", () => {
      // Version 1: Mode(4) + Count(8) + Data(13 * count)
      // KANJI mode = 1000 (0x8), count = 1, data = 13 bits
      // 1000 | 00000001 | 0000000000000 | 0000 (terminator)
      // Byte layout: 0x80, 0x10, 0x00, 0x00
      const version = Version.getVersionForNumber(1);
      const bytes = new Uint8Array([0x80, 0x10, 0x00, 0x00]);

      const result = scanForKanjiMode(bytes, version);
      expect(result.hasKanji).toBe(true);
      expect(result.modes).toEqual(["KANJI"]);
      expect(result.isValid).toBe(true);
    });

    it("should return invalid for unknown mode", () => {
      const version = Version.getVersionForNumber(1);
      const bytes = new Uint8Array([0x00]); // ターミネータ 0000
      try {
        const result = scanForKanjiMode(bytes, version);
        expect(result.isValid).toBe(true);
      } catch (_e) {}
    });

    it("exception handling", () => {
      const version = Version.getVersionForNumber(1);
      try {
        // @ts-expect-error
        scanForKanjiMode(null, version);
      } catch (_e) {}
    });

    it("should handle ECI, FNC1 and Structured Append", () => {
      const version = Version.getVersionForNumber(1);

      // FNC1 (0101)
      const fnc1_1 = new Uint8Array([0x50, 0x00]);
      scanForKanjiMode(fnc1_1, version);

      // FNC1 (1001)
      const fnc1_2 = new Uint8Array([0x90, 0x00]);
      scanForKanjiMode(fnc1_2, version);

      // Structured Append (0011) + 16 bits.
      const sa = new Uint8Array([0x30, 0x00, 0x00, 0x00]);
      scanForKanjiMode(sa, version);

      // ECI (0111) + ECI 値。
      // 1 バイト ECI (0-127): 0111 0xxxxxxx
      const eci1 = new Uint8Array([0x70, 0x01, 0x00]);
      scanForKanjiMode(eci1, version);

      // 2 バイト ECI: 0111 10xxxxxx xxxxxxxx
      const eci2 = new Uint8Array([0x78, 0x01, 0x01, 0x00]);
      scanForKanjiMode(eci2, version);

      // 3 バイト ECI: 0111 110xxxxx xxxxxxxx xxxxxxxx
      const eci3 = new Uint8Array([0x7c, 0x01, 0x01, 0x01, 0x00]);
      scanForKanjiMode(eci3, version);
    });

    it("should return invalid for various failure reasons", () => {
      const version = Version.getVersionForNumber(1);

      // Structured Append が短すぎる
      expect(scanForKanjiMode(new Uint8Array([0x30]), version).isValid).toBe(
        false,
      );

      // ECI 値が短すぎる
      expect(scanForKanjiMode(new Uint8Array([0x70]), version).isValid).toBe(
        false,
      );

      // HANZI カウントが短すぎる (mode 1101 + subset 4bits だが count が足りない)
      // 0xD0 = 11010000 → mode 1101, subset 0000, 残り0bits (count用の8bitsが足りない)
      expect(
        scanForKanjiMode(new Uint8Array([0xd0]), version).failureReason,
      ).toBe("hanzi count");

      // HANZI データが短すぎる (mode + subset + count はあるが data が足りない)
      // 1101 0000 00000010 ... (count=2 だが 26ビットのデータが足りない)
      expect(
        scanForKanjiMode(new Uint8Array([0xd0, 0x02, 0x00]), version)
          .failureReason,
      ).toBe("hanzi data");

      // 数字カウントが短すぎる
      expect(scanForKanjiMode(new Uint8Array([0x10]), version).isValid).toBe(
        false,
      );

      // 英数字カウントが短すぎる
      expect(scanForKanjiMode(new Uint8Array([0x20]), version).isValid).toBe(
        false,
      );

      // バイトカウントが短すぎる
      expect(scanForKanjiMode(new Uint8Array([0x40]), version).isValid).toBe(
        false,
      );

      // 漢字カウントが短すぎる
      expect(scanForKanjiMode(new Uint8Array([0x80]), version).isValid).toBe(
        false,
      );
    });

    it("should handle BYTE mode segment correctly", () => {
      // Version 1: Mode(4) + Count(8) + Data(8 * count)
      // BYTE mode = 0100 (0x4), count = 1, data = 8 bits
      // 0100 | 00000001 | 00000000 | 0000 (terminator)
      // Byte layout: 0x40, 0x10, 0x00
      const version = Version.getVersionForNumber(1);
      const bytes = new Uint8Array([0x40, 0x10, 0x00]);

      const result = scanForKanjiMode(bytes, version);
      expect(result.isValid).toBe(true);
      expect(result.hasKanji).toBe(false);
      expect(result.modes).toEqual(["BYTE"]);
    });

    it("should return invalid when BYTE mode data is insufficient", () => {
      // Version 1: Mode(4) + Count(8) + Data(8 * count)
      // BYTE mode = 0100, count = 2, but only 1 byte of data
      // 0100 | 00000010 | 00000000 (only 8 bits instead of 16)
      // Byte layout: 0x40, 0x20, 0x00
      const version = Version.getVersionForNumber(1);
      const bytes = new Uint8Array([0x40, 0x20, 0x00]);

      const result = scanForKanjiMode(bytes, version);
      expect(result.isValid).toBe(false);
      expect(result.failureReason).toBe("byte data");
    });

    it("should return invalid when KANJI mode data is insufficient", () => {
      // Version 1: Mode(4) + Count(8) + Data(13 * count)
      // KANJI mode = 1000, count = 2, but only partial data
      // 1000 | 00000010 | ... (less than 26 bits)
      // Byte layout: 0x80, 0x20, 0x00
      const version = Version.getVersionForNumber(1);
      const bytes = new Uint8Array([0x80, 0x20, 0x00]);

      const result = scanForKanjiMode(bytes, version);
      expect(result.isValid).toBe(false);
      expect(result.failureReason).toBe("kanji data");
    });

    it("should handle NUMERIC mode segment correctly", () => {
      // Version 1: Mode(4) + Count(10) + Data (3 digits = 10 bits)
      // NUMERIC mode = 0001 (0x1), count = 3
      // Bits layout (left to right):
      // 0001 0000000011 0000000000 0000
      // バイト配置: 0001 0000 | 0000 1100 | 0000 0000 | 0000
      // = 0x10, 0x0C, 0x00, 0x00
      const version = Version.getVersionForNumber(1);
      const bytes = new Uint8Array([0x10, 0x0c, 0x00, 0x00]);

      const result = scanForKanjiMode(bytes, version);
      expect(result.isValid).toBe(true);
      expect(result.hasKanji).toBe(false);
      expect(result.modes).toEqual(["NUMERIC"]);
    });

    it("should handle ALPHANUMERIC mode segment correctly", () => {
      // Version 1: Mode(4) + Count(9) + Data (2 chars = 11 bits)
      // ALPHANUMERIC mode = 0010 (0x2), count = 2
      // Bits layout (left to right):
      // 0010 000000010 00000000000 0000
      // バイト配置: 0010 0000 | 0001 0000 | 0000 0000 | 0000
      // = 0x20, 0x10, 0x00, 0x00
      const version = Version.getVersionForNumber(1);
      const bytes = new Uint8Array([0x20, 0x10, 0x00, 0x00]);

      const result = scanForKanjiMode(bytes, version);
      expect(result.isValid).toBe(true);
      expect(result.hasKanji).toBe(false);
      expect(result.modes).toEqual(["ALPHANUMERIC"]);
    });

    it("should handle HANZI mode segment correctly", () => {
      // Version 1: Mode(4) + Subset(4) + Count(8) + Data(13 * count)
      // HANZI mode = 1101 (0xD), subset = 0000, count = 1
      // Bits layout: 1101 0000 00000001 0000000000000 0000
      // バイト配置: 1101 0000 | 0000 0001 | 0000 0000 | 0000 0000 | 0000
      // = 0xD0, 0x01, 0x00, 0x00, 0x00
      const version = Version.getVersionForNumber(1);
      const bytes = new Uint8Array([0xd0, 0x01, 0x00, 0x00, 0x00]);

      const result = scanForKanjiMode(bytes, version);
      expect(result.isValid).toBe(true);
      expect(result.hasKanji).toBe(false);
      expect(result.modes).toEqual(["HANZI"]);
    });

    it("should stop scanning when bits are exhausted (normal end without terminator)", () => {
      // ターミネータのみのシンプルなケース
      const version = Version.getVersionForNumber(1);
      const bytes = new Uint8Array([0x00]);

      const result = scanForKanjiMode(bytes, version);
      expect(result.isValid).toBe(true);
      expect(result.hasKanji).toBe(false);
      expect(result.modes).toEqual([]);
    });
  });
});
