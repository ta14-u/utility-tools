import jsQR from "jsqr";
import { describe, expect, it, vi } from "vitest";

import { decodeWithJsQR } from "./jsqr";

vi.mock("jsqr", () => ({
  default: vi.fn(),
}));

describe("qr/decode/jsqr", () => {
  describe("decodeWithJsQR", () => {
    it("should return null when jsQR returns null", () => {
      vi.mocked(jsQR).mockReturnValue(null);

      const rgba = new Uint8ClampedArray(100);
      const result = decodeWithJsQR(rgba, 10, 10);

      expect(result).toBeNull();
    });

    it("should detect Shift-JIS Kanji mode for Japanese text", () => {
      vi.mocked(jsQR).mockReturnValue({
        data: "こんにちは",
        binaryData: [0x82, 0xb1, 0x82, 0xf1],
        chunks: [],
        location: {
          topLeftCorner: { x: 0, y: 0 },
          topRightCorner: { x: 10, y: 0 },
          bottomLeftCorner: { x: 0, y: 10 },
          bottomRightCorner: { x: 10, y: 10 },
          topRightFinderPattern: { x: 10, y: 0 },
          topLeftFinderPattern: { x: 0, y: 0 },
          bottomLeftFinderPattern: { x: 0, y: 10 },
        },
        version: 1,
      });

      const rgba = new Uint8ClampedArray(100);
      const result = decodeWithJsQR(rgba, 10, 10);

      expect(result).toEqual({
        text: "こんにちは",
        encoding: "Shift-JIS (Kanji mode)",
      });
    });

    it("should detect Shift-JIS for non-Japanese text when SJIS matches", () => {
      vi.mocked(jsQR).mockReturnValue({
        data: "abc",
        binaryData: [0x61, 0x62, 0x63],
        chunks: [],
        location: {
          topLeftCorner: { x: 0, y: 0 },
          topRightCorner: { x: 10, y: 0 },
          bottomLeftCorner: { x: 0, y: 10 },
          bottomRightCorner: { x: 10, y: 10 },
          topRightFinderPattern: { x: 10, y: 0 },
          topLeftFinderPattern: { x: 0, y: 0 },
          bottomLeftFinderPattern: { x: 0, y: 10 },
        },
        version: 1,
      });

      // TextDecoder をモック
      const originalTextDecoder = globalThis.TextDecoder;
      globalThis.TextDecoder = class extends originalTextDecoder {
        _label: string;
        constructor(label: string, options?: TextDecoderOptions) {
          super(label, options);
          this._label = label;
        }
        decode(_input?: BufferSource, _options?: TextDecodeOptions): string {
          if (this._label === "shift-jis") {
            return "abc";
          }
          return super.decode(_input, _options);
        }
      } as unknown as typeof TextDecoder;

      const rgba = new Uint8ClampedArray(100);
      const result = decodeWithJsQR(rgba, 10, 10);

      expect(result).toEqual({ text: "abc", encoding: "Shift-JIS" });

      globalThis.TextDecoder = originalTextDecoder;
    });

    it("should return UTF-8 for standard text", () => {
      vi.mocked(jsQR).mockReturnValue({
        data: "Hello World",
        binaryData: [0x48, 0x65, 0x6c, 0x6c, 0x6f],
        chunks: [],
        location: {
          topLeftCorner: { x: 0, y: 0 },
          topRightCorner: { x: 10, y: 0 },
          bottomLeftCorner: { x: 0, y: 10 },
          bottomRightCorner: { x: 10, y: 10 },
          topRightFinderPattern: { x: 10, y: 0 },
          topLeftFinderPattern: { x: 0, y: 0 },
          bottomLeftFinderPattern: { x: 0, y: 10 },
        },
        version: 1,
      });

      const rgba = new Uint8ClampedArray(100);
      const result = decodeWithJsQR(rgba, 10, 10);

      expect(result).toEqual({ text: "Hello World", encoding: "UTF-8" });
    });

    it("should decode empty string with UTF-8 binary data", () => {
      vi.mocked(jsQR).mockReturnValue({
        data: "",
        binaryData: [0x48, 0x65, 0x6c, 0x6c, 0x6f], // "Hello"
        chunks: [],
        location: {
          topLeftCorner: { x: 0, y: 0 },
          topRightCorner: { x: 10, y: 0 },
          bottomLeftCorner: { x: 0, y: 10 },
          bottomRightCorner: { x: 10, y: 10 },
          topRightFinderPattern: { x: 10, y: 0 },
          topLeftFinderPattern: { x: 0, y: 0 },
          bottomLeftFinderPattern: { x: 0, y: 10 },
        },
        version: 1,
      });

      // TextDecoder をモック
      const originalTextDecoder = globalThis.TextDecoder;
      globalThis.TextDecoder = class extends originalTextDecoder {
        _label: string;
        constructor(label: string, options?: TextDecoderOptions) {
          super(label, options);
          this._label = label;
        }
        decode(input?: BufferSource, _options?: TextDecodeOptions): string {
          const bytes = new Uint8Array(input as ArrayBuffer);
          if (this._label === "utf-8" && bytes.length === 5) {
            return "Hello";
          }
          if (this._label === "shift-jis") {
            throw new Error("Invalid Shift-JIS");
          }
          return super.decode(input, _options);
        }
      } as unknown as typeof TextDecoder;

      const rgba = new Uint8ClampedArray(100);
      const result = decodeWithJsQR(rgba, 10, 10);

      expect(result).toEqual({ text: "Hello", encoding: "UTF-8" });

      globalThis.TextDecoder = originalTextDecoder;
    });

    it("should decode empty string with Shift-JIS binary data", () => {
      vi.mocked(jsQR).mockReturnValue({
        data: "",
        binaryData: [0x82, 0xa0], // SJIS "あ"
        chunks: [],
        location: {
          topLeftCorner: { x: 0, y: 0 },
          topRightCorner: { x: 10, y: 0 },
          bottomLeftCorner: { x: 0, y: 10 },
          bottomRightCorner: { x: 10, y: 10 },
          topRightFinderPattern: { x: 10, y: 0 },
          topLeftFinderPattern: { x: 0, y: 0 },
          bottomLeftFinderPattern: { x: 0, y: 10 },
        },
        version: 1,
      });

      // TextDecoder をモック
      const originalTextDecoder = globalThis.TextDecoder;
      globalThis.TextDecoder = class extends originalTextDecoder {
        _label: string;
        constructor(label: string, options?: TextDecoderOptions) {
          super(label, options);
          this._label = label;
        }
        decode(_input?: BufferSource, _options?: TextDecodeOptions): string {
          if (this._label === "utf-8") {
            throw new Error("Invalid UTF-8");
          }
          if (this._label === "shift-jis") {
            return "あ";
          }
          return super.decode(_input, _options);
        }
      } as unknown as typeof TextDecoder;

      const rgba = new Uint8ClampedArray(100);
      const result = decodeWithJsQR(rgba, 10, 10);

      expect(result).toEqual({ text: "あ", encoding: "Shift-JIS" });

      globalThis.TextDecoder = originalTextDecoder;
    });

    it("should return Binary encoding for empty string with invalid binary data", () => {
      vi.mocked(jsQR).mockReturnValue({
        data: "",
        binaryData: [0xff, 0xfe, 0xfd],
        chunks: [],
        location: {
          topLeftCorner: { x: 0, y: 0 },
          topRightCorner: { x: 10, y: 0 },
          bottomLeftCorner: { x: 0, y: 10 },
          bottomRightCorner: { x: 10, y: 10 },
          topRightFinderPattern: { x: 10, y: 0 },
          topLeftFinderPattern: { x: 0, y: 0 },
          bottomLeftFinderPattern: { x: 0, y: 10 },
        },
        version: 1,
      });

      // TextDecoder をモック
      const originalTextDecoder = globalThis.TextDecoder;
      globalThis.TextDecoder = class extends originalTextDecoder {
        _label: string;
        constructor(label: string, options?: TextDecoderOptions) {
          super(label, options);
          this._label = label;
        }
        decode(_input?: BufferSource, _options?: TextDecodeOptions): string {
          throw new Error("Invalid encoding");
        }
      } as unknown as typeof TextDecoder;

      const rgba = new Uint8ClampedArray(100);
      const result = decodeWithJsQR(rgba, 10, 10);

      expect(result?.encoding).toBe("Binary");
      expect(result?.text).toContain("3 bytes");

      globalThis.TextDecoder = originalTextDecoder;
    });

    it("should handle half-width katakana as Japanese text", () => {
      vi.mocked(jsQR).mockReturnValue({
        data: "ｱｲｳ", // 半角カタカナ
        binaryData: [0xa7, 0xa8, 0xa9],
        chunks: [],
        location: {
          topLeftCorner: { x: 0, y: 0 },
          topRightCorner: { x: 10, y: 0 },
          bottomLeftCorner: { x: 0, y: 10 },
          bottomRightCorner: { x: 10, y: 10 },
          topRightFinderPattern: { x: 10, y: 0 },
          topLeftFinderPattern: { x: 0, y: 0 },
          bottomLeftFinderPattern: { x: 0, y: 10 },
        },
        version: 1,
      });

      const rgba = new Uint8ClampedArray(100);
      const result = decodeWithJsQR(rgba, 10, 10);

      expect(result).toEqual({
        text: "ｱｲｳ",
        encoding: "Shift-JIS (Kanji mode)",
      });
    });

    it("should handle mixed Japanese and ASCII text", () => {
      vi.mocked(jsQR).mockReturnValue({
        data: "Hello世界",
        binaryData: [0x48, 0x65, 0x6c, 0x6c, 0x6f],
        chunks: [],
        location: {
          topLeftCorner: { x: 0, y: 0 },
          topRightCorner: { x: 10, y: 0 },
          bottomLeftCorner: { x: 0, y: 10 },
          bottomRightCorner: { x: 10, y: 10 },
          topRightFinderPattern: { x: 10, y: 0 },
          topLeftFinderPattern: { x: 0, y: 0 },
          bottomLeftFinderPattern: { x: 0, y: 10 },
        },
        version: 1,
      });

      const rgba = new Uint8ClampedArray(100);
      const result = decodeWithJsQR(rgba, 10, 10);

      expect(result).toEqual({
        text: "Hello世界",
        encoding: "Shift-JIS (Kanji mode)",
      });
    });
  });
});
